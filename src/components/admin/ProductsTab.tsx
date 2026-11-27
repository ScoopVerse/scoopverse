import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Crop, ImagePlus, Package, Pencil, Plus, Trash2, X } from 'lucide-react';
import { GENDER_LABEL, type AdminProduct, type CropArea, type Gender } from '../../types';
import { centsToDollars, dollarsToCents, formatPrice } from '../../money';
import { Dialog } from './CustomersTab';
import { ImageCropper } from './ImageCropper';
import { RichTextEditor } from './RichTextEditor';

interface Props {
  // Called when the server says the admin session has ended.
  onSessionExpired: () => void;
}

const IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const ORIGINAL_MAX_BYTES = 30 * 1024 * 1024; // must match the server
const MAX_PICTURES = 6; // must match the server

// One picture in the form. `photo` is set when it was changed here and not saved yet (see the form's state).
interface Pic {
  key: string;
  id?: string; // missing = a new picture, not saved yet
  url: string; // the saved (cropped) picture
  hasOriginal: boolean;
  crop: CropArea | null;
  photo?: File;
  upload?: boolean;
  preview?: string;
}
const fromProduct = (p: AdminProduct): Pic[] => p.images.map((i) => ({ key: `s${i.id}`, id: i.id, url: i.url, hasOriginal: i.hasOriginal, crop: i.crop }));

// Thrown inside the save when the server says the admin's session has ended.
class SessionEnded extends Error {}

const inputClass =
  'w-full px-4 py-3 rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc] focus:border-[#9d84b7] focus:bg-white focus:outline-hidden text-sm transition-all text-[#1c1c18] placeholder-[#7b757e]';
const labelClass = 'text-xs font-bold uppercase tracking-wider text-[#7b757e] block';

// "Bergamot, Lavender ,, Mint" -> ['Bergamot', 'Lavender', 'Mint']
const splitNotes = (text: string) => text.split(',').map((n) => n.trim()).filter(Boolean);

const NOTE_FIELDS = [
  { key: 'top', label: 'Top notes', hint: 'what you smell first', placeholder: 'Bergamot, Lavender, Mint' },
  { key: 'heart', label: 'Heart notes', hint: 'the main character', placeholder: 'Rose, Jasmine, Pepper' },
  { key: 'base', label: 'Base notes', hint: 'what lingers', placeholder: 'Vanilla, Amber, Musk' },
] as const;

async function sendJson(method: string, url: string, body?: unknown) {
  const res = await fetch(url, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { res, data: await res.json().catch(() => ({})) };
}

export const ProductsTab: React.FC<Props> = ({ onSessionExpired }) => {
  const [products, setProducts] = useState<AdminProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  // 'new' = the add form; a product = the edit form for it.
  const [editing, setEditing] = useState<AdminProduct | 'new' | null>(null);
  const [deleting, setDeleting] = useState<AdminProduct | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  // Ticked products (ids) for "Delete selected".
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const toggleSelected = (id: string) =>
    setSelected((s) => {
      const next = new Set(s);
      if (!next.delete(id)) next.add(id);
      return next;
    });
  const allSelected = products.length > 0 && selected.size === products.length;

  useEffect(() => {
    fetch('/api/admin/products')
      .then(async (res) => {
        if (res.status === 401) return onSessionExpired();
        const data = await res.json();
        if (!res.ok) throw new Error(data.error);
        setProducts(data.products);
      })
      .catch(() => setError('Could not load products. Please try again.'))
      .finally(() => setLoading(false));
  }, []);

  // Put a saved product into the list (new ones go on top).
  const upsert = (p: AdminProduct) =>
    setProducts((list) => (list.some((x) => x.id === p.id) ? list.map((x) => (x.id === p.id ? p : x)) : [p, ...list]));

  const toggleActive = async (p: AdminProduct) => {
    setBusyId(p.id);
    setError(null);
    try {
      const { res, data } = await sendJson('PATCH', `/api/admin/products/${p.id}/active`, { active: !p.active });
      if (res.status === 401) return onSessionExpired();
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Please try again.');
      upsert(data.product);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-4">
          <p className="text-sm text-[#7b757e]">
            {products.length} {products.length === 1 ? 'product' : 'products'}
          </p>
          {products.length > 0 && (
            <label className="inline-flex items-center gap-2 text-sm font-semibold text-[#4a454e] cursor-pointer">
              <input
                type="checkbox"
                checked={allSelected}
                onChange={() => setSelected(allSelected ? new Set() : new Set(products.map((p) => p.id)))}
                className="w-4 h-4 rounded accent-[#695282]"
              />
              Select all
            </label>
          )}
        </div>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 text-sm font-bold text-white bg-[#695282] hover:bg-[#533d6b] px-5 py-2.5 rounded-full shadow-sm transition-all"
        >
          <Plus className="w-4 h-4 text-[#ffd1b3]" />
          Add product
        </button>
      </div>

      {selected.size > 0 && (
        <div className="sticky top-[7.5rem] z-20 flex flex-wrap items-center gap-2 bg-[#2d2438] text-white rounded-2xl px-4 py-3 shadow-lg">
          <span className="text-sm font-bold mr-1">{selected.size} selected</span>
          <button onClick={() => setSelected(new Set())} className="text-sm font-semibold text-[#d9c8ec] hover:text-white underline underline-offset-2">
            Clear
          </button>
          {selected.size > BULK_MAX && <span className="text-xs text-[#ffd1b3]">You can delete up to {BULK_MAX} products at a time.</span>}
          <button
            onClick={() => setBulkDeleting(true)}
            disabled={selected.size > BULK_MAX}
            className="ml-auto inline-flex items-center gap-2 text-sm font-bold bg-[#a33a3a] hover:bg-[#862e2e] disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-full transition-all"
          >
            <Trash2 className="w-4 h-4" />
            Delete selected
          </button>
        </div>
      )}

      {notice && (
        <p role="status" className="flex items-start gap-2 text-sm text-[#2f5d50] bg-[#e6f4ef] border border-[#b9e5d8] rounded-xl px-4 py-2.5">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-[#2f5d50]/70 hover:text-[#2f5d50]">
            <X className="w-4 h-4" />
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="bg-white rounded-3xl border border-[#efe7f5] shadow-xs overflow-hidden">
        {loading && <div className="px-5 py-10 text-center text-sm text-[#7b757e]">Loading…</div>}
        {!loading && products.length === 0 && (
          <div className="px-5 py-14 text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#efdbff]/70 text-[#695282] flex items-center justify-center mx-auto">
              <Package className="w-6 h-6" />
            </div>
            <p className="text-sm text-[#7b757e]">No products yet. Add your first one.</p>
          </div>
        )}
        <ul className="divide-y divide-[#efe7f5]">
          {products.map((p) => (
            <li key={p.id} className={`px-4 sm:px-5 py-4 flex flex-wrap sm:flex-nowrap items-center gap-x-4 gap-y-3 ${p.active ? '' : 'bg-[#faf8f5]'}`}>
              <input
                type="checkbox"
                checked={selected.has(p.id)}
                onChange={() => toggleSelected(p.id)}
                aria-label={`Select ${p.name}`}
                className="w-4 h-4 rounded accent-[#695282] shrink-0"
              />
              <Thumb url={p.imageUrl} className="w-14 h-14 shrink-0" />
              <div className="min-w-0 flex-1 basis-40">
                <p className={`font-bold truncate ${p.active ? 'text-[#1c1c18]' : 'text-[#7b757e]'}`}>{p.name}</p>
                <p className="text-sm text-[#4a454e]">
                  {p.kind !== 'other' && (
                    <>
                      <span className="font-semibold text-[#695282]">{p.kind === 'perfume' ? 'Perfume' : 'Scoop'}</span>
                      <span className="text-[#c9c3cc]"> · </span>
                    </>
                  )}
                  {formatPrice(p.priceCents)}
                  <span className="text-[#c9c3cc]"> · </span>
                  {p.stock > 0 ? (
                    <span className="text-[#7b757e]">{p.stock} in stock</span>
                  ) : (
                    <span className="font-semibold text-[#8a5a1c]">Out of stock</span>
                  )}
                </p>
              </div>

              <button
                role="switch"
                aria-checked={p.active}
                aria-label={`${p.name}: ${p.active ? 'visible in shop' : 'hidden from shop'}`}
                onClick={() => toggleActive(p)}
                disabled={busyId === p.id}
                className="inline-flex items-center gap-2 text-xs font-bold text-[#4a454e] disabled:opacity-60"
              >
                <span className={`relative w-10 h-6 rounded-full transition-colors ${p.active ? 'bg-[#695282]' : 'bg-[#c9c3cc]'}`}>
                  <span className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow-sm transition-all ${p.active ? 'left-[1.1rem]' : 'left-0.5'}`} />
                </span>
                <span className="w-14 text-left">{p.active ? 'Visible' : 'Hidden'}</span>
              </button>

              <div className="flex gap-2 ml-auto">
                <button
                  onClick={() => setEditing(p)}
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#695282] hover:text-[#533d6b] bg-white px-4 py-2 rounded-full border border-[#9d84b7]/30 hover:border-[#9d84b7]/60 transition-all"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={() => setDeleting(p)}
                  aria-label={`Delete ${p.name}`}
                  className="inline-flex items-center text-[#a33a3a] hover:text-white bg-white hover:bg-[#a33a3a] p-2.5 rounded-full border border-[#f1cccc] hover:border-[#a33a3a] transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>

      {editing && (
        <ProductForm
          product={editing === 'new' ? null : editing}
          onClose={() => setEditing(null)}
          onSaved={(p, isNew) => {
            upsert(p);
            setEditing(null);
            setNotice(isNew ? `Added "${p.name}".` : `Saved "${p.name}".`);
          }}
          onChanged={upsert}
          onSessionExpired={onSessionExpired}
        />
      )}

      {deleting && (
        <DeleteProductDialog
          product={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            setProducts((list) => list.filter((x) => x.id !== deleting.id));
            setSelected((s) => new Set([...s].filter((id) => id !== deleting.id)));
            setNotice(`Deleted "${deleting.name}".`);
            setDeleting(null);
          }}
          onSessionExpired={onSessionExpired}
        />
      )}

      {bulkDeleting && (
        <BulkDeleteDialog
          ids={[...selected]}
          onClose={() => setBulkDeleting(false)}
          onDeleted={(count) => {
            setProducts((list) => list.filter((x) => !selected.has(x.id)));
            setSelected(new Set());
            setNotice(`Deleted ${count} ${count === 1 ? 'product' : 'products'}.`);
            setBulkDeleting(false);
          }}
          onSessionExpired={onSessionExpired}
        />
      )}
    </div>
  );
};

const Thumb: React.FC<{ url: string | null; className?: string }> = ({ url, className = '' }) =>
  url ? (
    <img src={url} alt="" loading="lazy" draggable={false} className={`object-contain rounded-2xl bg-[#f7f3ed] ${className}`} />
  ) : (
    <span className={`rounded-2xl bg-[#f7f3ed] border border-dashed border-[#d9d2dc] text-[#b9b2bd] flex items-center justify-center ${className}`}>
      <ImagePlus className="w-5 h-5" />
    </span>
  );

// Shows the chosen square of a photo (crop is in percent of the photo) without making a new file.
const CropPreview: React.FC<{ url: string; crop: CropArea; className?: string }> = ({ url, crop, className = '' }) =>
  crop.width >= 100 && crop.height >= 100 ? (
    <Thumb url={url} className={className} />
  ) : (
  <span className={`relative block overflow-hidden rounded-2xl bg-[#f7f3ed] ${className}`}>
    <img
      src={url}
      alt=""
      draggable={false}
      className="absolute max-w-none"
      style={{ width: `${10000 / crop.width}%`, left: `${(-crop.x / crop.width) * 100}%`, top: `${(-crop.y / crop.height) * 100}%` }}
    />
  </span>
  );

interface FormProps {
  product: AdminProduct | null; // null = adding a new one
  onClose: () => void;
  onSaved: (p: AdminProduct, isNew: boolean) => void;
  // Keeps the list current when the product saved but the image didn't.
  onChanged: (p: AdminProduct) => void;
  onSessionExpired: () => void;
}

const ProductForm: React.FC<FormProps> = ({ product, onClose, onSaved, onChanged, onSessionExpired }) => {
  // After a first save whose image upload failed, the form switches to editing that saved product.
  const [saved, setSaved] = useState<AdminProduct | null>(product);
  const [name, setName] = useState(product?.name ?? '');
  const [description, setDescription] = useState(product?.description ?? '');
  const [price, setPrice] = useState(product ? centsToDollars(product.priceCents) : '');
  const [stock, setStock] = useState(String(product?.stock ?? 0));
  const [active, setActive] = useState(product?.active ?? true);
  // Listing type. Only a perfume has its own detail boxes so far.
  const [kind, setKind] = useState<'perfume' | 'scoop' | 'other'>(product?.kind ?? 'other');
  const pd = product?.kind === 'perfume' ? product.details : null;
  const sd = product?.kind === 'scoop' ? product.details : null;
  const [scoops, setScoops] = useState(sd ? String(sd.scoops) : '');
  const [offlinePrice, setOfflinePrice] = useState(sd ? centsToDollars(sd.offlinePriceCents) : '');
  const [beadsMin, setBeadsMin] = useState(sd ? String(sd.beadsMin) : '');
  const [beadsMax, setBeadsMax] = useState(sd ? String(sd.beadsMax) : '');
  const [inspiredBy, setInspiredBy] = useState(pd?.inspiredBy ?? '');
  const [concentration, setConcentration] = useState<'EDP' | 'EDT'>(pd?.concentration ?? 'EDP');
  const [gender, setGender] = useState<Gender | null>(pd?.gender ?? null);
  const [hoursMin, setHoursMin] = useState(pd ? String(pd.hoursMin) : '');
  const [hoursMax, setHoursMax] = useState(pd ? String(pd.hoursMax) : '');
  const [tagline, setTagline] = useState(pd?.tagline ?? '');
  // Notes are typed as comma-separated text and sent as lists.
  const [noteText, setNoteText] = useState({
    top: pd?.notes?.top.join(', ') ?? '',
    heart: pd?.notes?.heart.join(', ') ?? '',
    base: pd?.notes?.base.join(', ') ?? '',
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // The form's pictures, in order (the first is the cover). Saved ones have an id. Changes wait for "Save":
  // `photo` is the full photo of a changed picture (shown through `preview`); `upload` says whether it must be sent
  // (a new picture, or a replacement) or only its crop changed (the server already has the original).
  const [pics, setPics] = useState<Pic[]>(() => (product ? fromProduct(product) : []));
  const [removedIds, setRemovedIds] = useState<string[]>([]);
  // What the crop screen is showing right now (null = closed; key null = a new picture), and chosen files waiting their turn.
  const [draft, setDraft] = useState<{ key: string | null; file: File; initial: CropArea | null; upload: boolean } | null>(null);
  const [queue, setQueue] = useState<File[]>([]);
  const [dragKey, setDragKey] = useState<string | null>(null);
  const nextKey = useRef(0);
  const blobUrls = useRef<string[]>([]);
  useEffect(() => () => blobUrls.current.forEach((u) => URL.revokeObjectURL(u)), []);

  // Big phone photos are fine: the server shrinks them (max 30 MB to upload). Several can be chosen at once; each opens the crop screen in turn.
  const choose = (list: FileList | null) => {
    const files = [...(list ?? [])];
    if (files.length === 0) return;
    if (files.some((f) => !IMAGE_TYPES.includes(f.type))) return setError('Please choose JPG, PNG or WebP images.');
    if (files.some((f) => f.size > ORIGINAL_MAX_BYTES)) return setError('That image is too big (max 30 MB).');
    const room = MAX_PICTURES - pics.length;
    setError(files.length > room ? `A listing can have up to ${MAX_PICTURES} pictures, so only the first ${room} will be added.` : null);
    const [first, ...rest] = files.slice(0, room);
    setQueue(rest);
    setDraft({ key: null, file: first, initial: null, upload: true });
  };

  const applyCrop = (crop: CropArea) => {
    if (!draft) return;
    const preview = URL.createObjectURL(draft.file);
    blobUrls.current.push(preview);
    if (draft.key === null) {
      setPics((list) => [...list, { key: `n${nextKey.current++}`, url: preview, hasOriginal: true, crop, photo: draft.file, upload: true, preview }]);
    } else {
      setPics((list) => list.map((x) => (x.key === draft.key ? { ...x, crop, photo: draft.file, upload: draft.upload, preview } : x)));
    }
    const [next, ...rest] = queue;
    setQueue(rest);
    setDraft(next ? { key: null, file: next, initial: null, upload: true } : null);
  };
  const cancelCrop = () => {
    setDraft(null);
    setQueue([]);
  };

  // Put the picture with this key at position `to`.
  const movePic = (key: string, to: number) =>
    setPics((list) => {
      const from = list.findIndex((x) => x.key === key);
      if (from < 0 || to < 0 || to >= list.length) return list;
      const next = [...list];
      next.splice(to, 0, next.splice(from, 1)[0]);
      return next;
    });
  const removePic = (p: Pic) => {
    if (p.id) setRemovedIds((ids) => [...ids, p.id!]);
    setPics((list) => list.filter((x) => x.key !== p.key));
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceCents = dollarsToCents(price);
    const stockNumber = Number(stock);
    if (priceCents === null) return setError('Enter a price like 12.50 (from 0.01 to 999999.99).');
    if (!/^\d{1,7}$/.test(stock.trim()) || stockNumber > 1_000_000) return setError('Stock must be a whole number from 0 to 1,000,000.');

    let details = null;
    if (kind === 'scoop') {
      const offlinePriceCents = dollarsToCents(offlinePrice);
      const whole = (t: string) => (/^\d{1,3}$/.test(t.trim()) ? Number(t) : NaN);
      const [n, lo, hi] = [whole(scoops), whole(beadsMin), whole(beadsMax)];
      if (!(n >= 1 && n <= 20)) return setError('Enter the number of scoops as a whole number from 1 to 20.');
      if (offlinePriceCents === null || offlinePriceCents > priceCents) return setError('The offline price must be a price like 11.50, not higher than the live price.');
      if (!(lo >= 1 && hi <= 500 && lo <= hi)) return setError('Enter the perfumes as whole numbers, e.g. 3 to 5 (the first number not above the second).');
      details = { scoops: n, offlinePriceCents, beadsMin: lo, beadsMax: hi };
    }
    if (kind === 'perfume') {
      const min = Number(hoursMin);
      const max = Number(hoursMax);
      if (!inspiredBy.trim()) return setError('Please enter what the perfume is inspired by.');
      if (!gender) return setError('Please choose Women, Men or Unisex.');
      if (!/^\d{1,2}$/.test(hoursMin.trim()) || !/^\d{1,2}$/.test(hoursMax.trim()) || min < 1 || max > 48 || min > max) {
        return setError('Enter how long it lasts as whole hours from 1 to 48, e.g. 6 to 8.');
      }
      const notes = { top: splitNotes(noteText.top), heart: splitNotes(noteText.heart), base: splitNotes(noteText.base) };
      if (Object.values(notes).some((l) => l.length > 10 || l.some((n) => n.length > 30))) {
        return setError('Each notes list can have up to 10 notes, each up to 30 characters.');
      }
      details = { inspiredBy, concentration, gender, hoursMin: min, hoursMax: max, tagline, notes };
    }

    setBusy(true);
    setError(null);
    try {
      const body = { name, description, priceCents, stock: stockNumber, active, kind, details };
      const { res, data } = saved
        ? await sendJson('PATCH', `/api/admin/products/${saved.id}`, body)
        : await sendJson('POST', '/api/admin/products', body);
      if (res.status === 401) return onSessionExpired();
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Please try again.');
      let result: AdminProduct = data.product;
      const isNew = !saved;

      // The details are saved. Now the pictures: removals first (to free slots), then each change, then the order.
      let latest = result;
      try {
        const call = async (method: string, url: string, body?: BodyInit, type?: string) => {
          const r = await fetch(url, { method, headers: type ? { 'Content-Type': type } : undefined, body });
          if (r.status === 401) throw new SessionEnded();
          const d = await r.json().catch(() => ({}));
          if (!r.ok) throw new Error(d.error ?? 'please try again.');
          latest = d.product as AdminProduct;
          return latest;
        };
        const base = `/api/admin/products/${result.id}/images`;
        for (const id of removedIds) await call('DELETE', `${base}/${id}`);
        const ids: string[] = [];
        for (const p of pics) {
          const q = p.crop ? `?crop=${p.crop.x},${p.crop.y},${p.crop.width},${p.crop.height}` : '';
          if (!p.id) {
            const r = await call('POST', base + q, p.photo, p.photo!.type);
            ids.push(r.images[r.images.length - 1].id); // new pictures are added at the end
          } else {
            ids.push(p.id);
            if (p.photo && p.upload) await call('PUT', `${base}/${p.id}${q}`, p.photo, p.photo.type);
            else if (p.photo) await call('PUT', `${base}/${p.id}/crop`, JSON.stringify(p.crop), 'application/json');
          }
        }
        if (ids.join() !== latest.images.map((i) => i.id).join()) await call('PUT', `${base}/order`, JSON.stringify({ ids }), 'application/json');
      } catch (err) {
        if (err instanceof SessionEnded) return onSessionExpired();
        // The details are saved and some pictures may be too. Show what the server has so the rest can be redone.
        onChanged(latest);
        setSaved(latest);
        setPics(fromProduct(latest));
        setRemovedIds([]);
        return setError(`Saved, but not all pictures were saved: ${(err as Error).message} The pictures shown are what is saved now; please redo the rest.`);
      }
      onSaved(latest, isNew);
      onSaved(result, isNew);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  // Reopen the crop screen on the full photo, with the crop used last time. Pictures saved before originals were
  // kept (no stored original) fall back to cropping the saved picture itself.
  const startCrop = async (pic: Pic) => {
    if (pic.photo) return setDraft({ key: pic.key, file: pic.photo, initial: pic.crop, upload: !!pic.upload });
    if (!pic.id || !saved) return;
    setBusy(true);
    setError(null);
    try {
      const blob = await (await fetch(pic.hasOriginal ? `/api/admin/products/${saved.id}/images/${pic.id}/original` : pic.url)).blob();
      setDraft({ key: pic.key, file: new File([blob], 'photo.webp', { type: blob.type }), initial: pic.hasOriginal ? pic.crop : null, upload: !pic.hasOriginal });
    } catch {
      setError('Could not load the picture. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2d2438]/30 backdrop-blur-sm" onClick={onClose}>
      <div className="min-h-full flex items-center justify-center p-4">
        <form
          role="dialog"
          aria-modal="true"
          aria-label={saved ? 'Edit product' : 'Add product'}
          onSubmit={submit}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-[70.4rem] bg-white rounded-3xl p-6 sm:p-8 border border-white shadow-xl space-y-5"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#7b757e] hover:text-[#695282] hover:bg-[#efdbff]/50 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
          <h2 className="font-serif-display text-2xl font-bold pr-10">{saved ? 'Edit product' : 'Add product'}</h2>

          <div className="space-y-2">
            <span className={labelClass}>
              Pictures ({pics.length} of {MAX_PICTURES})
            </span>
            <ul className="flex flex-wrap gap-3">
              {pics.map((p, i) => (
                <li
                  key={p.key}
                  draggable
                  onDragStart={() => setDragKey(p.key)}
                  onDragEnd={() => setDragKey(null)}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={() => {
                    if (dragKey && dragKey !== p.key) movePic(dragKey, i);
                    setDragKey(null);
                  }}
                  className={`relative w-24 shrink-0 cursor-grab ${dragKey === p.key ? 'opacity-40' : ''}`}
                >
                  {p.preview && p.crop ? <CropPreview url={p.preview} crop={p.crop} className="w-24 h-24" /> : <Thumb url={p.url} className="w-24 h-24" />}
                  {i === 0 && <span className="absolute left-1.5 top-1.5 rounded-full bg-[#695282] px-2 py-0.5 text-[0.7rem] font-bold text-white">Cover</span>}
                  <button
                    type="button"
                    onClick={() => removePic(p)}
                    aria-label={`Remove picture ${i + 1}`}
                    className="absolute right-1.5 top-1.5 flex h-6 w-6 items-center justify-center rounded-full bg-white/90 text-[#a33a3a] shadow-sm hover:bg-white"
                  >
                    <X className="w-3.5 h-3.5" />
                  </button>
                  <div className="mt-1.5 flex items-center justify-between">
                    <button
                      type="button"
                      onClick={() => movePic(p.key, i - 1)}
                      disabled={i === 0}
                      aria-label={`Move picture ${i + 1} earlier`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[#695282] hover:bg-[#efdbff]/50 disabled:opacity-30"
                    >
                      <ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => startCrop(p)}
                      disabled={busy}
                      aria-label={`Crop picture ${i + 1}`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[#695282] hover:bg-[#efdbff]/50 disabled:opacity-40"
                    >
                      <Crop className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => movePic(p.key, i + 1)}
                      disabled={i === pics.length - 1}
                      aria-label={`Move picture ${i + 1} later`}
                      className="flex h-7 w-7 items-center justify-center rounded-full text-[#695282] hover:bg-[#efdbff]/50 disabled:opacity-30"
                    >
                      <ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </li>
              ))}
              {pics.length < MAX_PICTURES && (
                <li className="w-24 shrink-0">
                  <label className="flex h-24 w-24 cursor-pointer flex-col items-center justify-center gap-1 rounded-2xl border border-dashed border-[#9d84b7]/60 bg-[#faf8f5] text-center text-xs font-bold text-[#695282] transition-all hover:bg-[#efdbff]/40 focus-within:ring-2 focus-within:ring-[#9d84b7]">
                    <ImagePlus className="w-5 h-5" />
                    {pics.length === 0 ? 'Add pictures' : 'Add more'}
                    <input
                      type="file"
                      multiple
                      accept={IMAGE_TYPES.join(',')}
                      className="sr-only"
                      onChange={(e) => {
                        choose(e.target.files);
                        e.target.value = ''; // so picking the same file again still opens the crop screen
                      }}
                    />
                  </label>
                </li>
              )}
            </ul>
            <p className="text-xs text-[#7b757e]">
              JPG, PNG or WebP, up to {MAX_PICTURES}. Drag a picture to reorder (or use the arrows). The first one is the cover shown on the shop tiles. Each is cropped to a square.
            </p>
          </div>

          <div className="space-y-2">
            <span className={labelClass}>Listing type</span>
            <div role="group" aria-label="Listing type" className="inline-flex flex-wrap gap-1.5 p-1 rounded-full bg-[#f7f3ed] border border-[#e6e2dc]">
              {(['perfume', 'scoop', 'other'] as const).map((k) => (
                <button
                  key={k}
                  type="button"
                  aria-pressed={kind === k}
                  onClick={() => setKind(k)}
                  className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${kind === k ? 'bg-[#695282] text-white shadow-sm' : 'text-[#4a454e] hover:bg-white'}`}
                >
                  {k === 'perfume' ? 'Perfume' : k === 'scoop' ? 'Scoop' : 'Other'}
                </button>
              ))}
            </div>
          </div>
          <div className="space-y-2">
            <label htmlFor="product-name" className={labelClass}>Name</label>
            <input id="product-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Midnight Vanilla Scoop" />
          </div>
          {kind === 'scoop' && (
            <fieldset className="rounded-2xl border border-[#e3d2f3] bg-[#f8f1fd]/60 p-4 sm:p-5 space-y-4">
              <legend className="px-2 text-xs font-bold uppercase tracking-wider text-[#695282]">Scoop details (shown in a box in the shop)</legend>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <label htmlFor="scoop-count" className={labelClass}>Number of scoops</label>
                  <input id="scoop-count" inputMode="numeric" maxLength={2} value={scoops} onChange={(e) => setScoops(e.target.value)} className={inputClass} placeholder="1, 3 or 5" />
                </div>
                <div className="space-y-2">
                  <label htmlFor="scoop-offline" className={labelClass}>Offline price (RM)</label>
                  <input id="scoop-offline" inputMode="decimal" value={offlinePrice} onChange={(e) => setOfflinePrice(e.target.value)} className={inputClass} placeholder="Lower than the live price" />
                </div>
              </div>
              <div className="space-y-2">
                <span className={labelClass}>Perfumes you get in total (about, not counting filler and +1 beads)</span>
                <div className="flex items-center gap-2 sm:max-w-xs">
                  <input aria-label="Perfumes from" inputMode="numeric" maxLength={3} value={beadsMin} onChange={(e) => setBeadsMin(e.target.value)} className={`${inputClass} text-center`} placeholder="3" />
                  <span className="text-[#7b757e] font-bold">to</span>
                  <input aria-label="Perfumes up to" inputMode="numeric" maxLength={3} value={beadsMax} onChange={(e) => setBeadsMax(e.target.value)} className={`${inputClass} text-center`} placeholder="5" />
                </div>
                <p className="text-xs text-[#7b757e]">e.g. 1 scoop: 3 to 5. 5 scoops: about 22 to 28. The Price below is the Live price.</p>
              </div>
            </fieldset>
          )}
          {kind === 'perfume' && (
            <fieldset className="rounded-2xl border border-[#e3d2f3] bg-[#f8f1fd]/60 p-4 sm:p-5 space-y-4">
              <legend className="px-2 text-xs font-bold uppercase tracking-wider text-[#695282]">Perfume details (shown in a box in the shop)</legend>
              <div className="space-y-2">
                <label htmlFor="perfume-inspired" className={labelClass}>Inspired by</label>
                <input id="perfume-inspired" maxLength={80} value={inspiredBy} onChange={(e) => setInspiredBy(e.target.value)} className={inputClass} placeholder="e.g. Versace Eros" />
              </div>
              <div className="space-y-2">
                <span className={labelClass}>For</span>
                <div role="group" aria-label="Perfume is for" className="inline-flex gap-1.5 p-1 rounded-full bg-white border border-[#e6e2dc]">
                  {(Object.keys(GENDER_LABEL) as Gender[]).map((g) => (
                    <button
                      key={g}
                      type="button"
                      aria-pressed={gender === g}
                      onClick={() => setGender(g)}
                      className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${gender === g ? 'bg-[#695282] text-white shadow-sm' : 'text-[#4a454e] hover:bg-[#efdbff]/50'}`}
                    >
                      {GENDER_LABEL[g]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="grid sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <span className={labelClass}>Type</span>
                  <div role="group" aria-label="Perfume type" className="inline-flex gap-1.5 p-1 rounded-full bg-white border border-[#e6e2dc]">
                    {(['EDP', 'EDT'] as const).map((c) => (
                      <button
                        key={c}
                        type="button"
                        aria-pressed={concentration === c}
                        onClick={() => setConcentration(c)}
                        className={`px-4 py-1.5 rounded-full text-sm font-bold transition-all ${concentration === c ? 'bg-[#695282] text-white shadow-sm' : 'text-[#4a454e] hover:bg-[#efdbff]/50'}`}
                      >
                        {c}
                      </button>
                    ))}
                  </div>
                  <p className="text-xs text-[#7b757e]">EDP = Eau de Parfum, EDT = Eau de Toilette</p>
                </div>
                <div className="space-y-2">
                  <span className={labelClass}>Lasts (hours)</span>
                  <div className="flex items-center gap-2">
                    <input aria-label="Lasts from (hours)" inputMode="numeric" maxLength={2} value={hoursMin} onChange={(e) => setHoursMin(e.target.value)} className={`${inputClass} text-center`} placeholder="6" />
                    <span className="text-[#7b757e] font-bold">to</span>
                    <input aria-label="Lasts up to (hours)" inputMode="numeric" maxLength={2} value={hoursMax} onChange={(e) => setHoursMax(e.target.value)} className={`${inputClass} text-center`} placeholder="8" />
                  </div>
                </div>
              </div>
              <div className="space-y-2">
                <label htmlFor="perfume-tagline" className={labelClass}>Special line (optional)</label>
                <input id="perfume-tagline" maxLength={140} value={tagline} onChange={(e) => setTagline(e.target.value)} className={inputClass} placeholder="One line on who it suits, e.g. Bold and fresh for date nights" />
              </div>
            </fieldset>
          )}
          {kind === 'perfume' && (
            <fieldset className="rounded-2xl border border-[#f1dcc6] bg-[#fff7ee]/70 p-4 sm:p-5 space-y-4">
              <legend className="px-2 text-xs font-bold uppercase tracking-wider text-[#8a5a1c]">Fragrance notes (optional, shown in a second box)</legend>
              {NOTE_FIELDS.map((f) => (
                <div key={f.key} className="space-y-2">
                  <label htmlFor={`notes-${f.key}`} className={labelClass}>
                    {f.label} <span className="normal-case tracking-normal font-medium">· {f.hint}</span>
                  </label>
                  <input
                    id={`notes-${f.key}`}
                    value={noteText[f.key]}
                    onChange={(e) => setNoteText((t) => ({ ...t, [f.key]: e.target.value }))}
                    className={inputClass}
                    placeholder={f.placeholder}
                  />
                </div>
              ))}
              <p className="text-xs text-[#7b757e]">Separate the notes with commas. Up to 10 per row; leave a row empty to hide it in the shop.</p>
            </fieldset>
          )}
          <div className="space-y-2">
            <span className={labelClass}>Description</span>
            <RichTextEditor value={description} onChange={setDescription} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="product-price" className={labelClass}>{kind === 'scoop' ? 'Live price (RM)' : 'Price (RM)'}</label>
              <input id="product-price" required inputMode="decimal" value={price} onChange={(e) => setPrice(e.target.value)} className={inputClass} placeholder="12.50" />
            </div>
            <div className="space-y-2">
              <label htmlFor="product-stock" className={labelClass}>Stock</label>
              <input id="product-stock" required inputMode="numeric" value={stock} onChange={(e) => setStock(e.target.value)} className={inputClass} placeholder="0" />
            </div>
          </div>
          <label className="flex items-center gap-3 text-sm font-semibold text-[#4a454e] cursor-pointer">
            <input type="checkbox" checked={active} onChange={(e) => setActive(e.target.checked)} className="w-4 h-4 rounded accent-[#695282]" />
            Visible in the shop
          </label>

          {error && (
            <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}
          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onClose} className="text-sm font-bold text-[#7b757e] hover:text-[#4a454e] px-4 py-2 rounded-full">
              {saved && !product ? 'Close' : 'Cancel'}
            </button>
            <button type="submit" disabled={busy} className="text-sm font-bold text-white bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 px-6 py-2 rounded-full shadow-sm transition-all">
              {busy ? 'Saving…' : saved ? 'Save changes' : 'Add product'}
            </button>
          </div>
        </form>
      </div>
    </div>
    {draft && <ImageCropper key={`${draft.key}-${draft.file.size}-${draft.file.lastModified}`} file={draft.file} initialArea={draft.initial} onCancel={cancelCrop} onDone={applyCrop} />}
    </>
  );
};

const BULK_MAX = 100; // must match BATCH_MAX in server/products.ts

const BulkDeleteDialog: React.FC<{
  ids: string[];
  onClose: () => void;
  onDeleted: (count: number) => void;
  onSessionExpired: () => void;
}> = ({ ids, onClose, onDeleted, onSessionExpired }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await sendJson('POST', '/api/admin/products/batch-delete', { ids });
      if (res.status === 401) return onSessionExpired();
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Please try again.');
      onDeleted(ids.length);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Delete ${ids.length} ${ids.length === 1 ? 'product' : 'products'}?`} icon={Trash2} danger onClose={onClose}>
      <p className="text-sm text-[#4a454e]">
        The {ids.length} selected {ids.length === 1 ? 'product and its picture' : 'products and their pictures'} will be deleted permanently. This
        cannot be undone.
      </p>
      {error && (
        <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="text-sm font-bold text-[#7b757e] hover:text-[#4a454e] px-4 py-2 rounded-full">
          Cancel
        </button>
        <button onClick={confirm} disabled={busy} className="text-sm font-bold text-white bg-[#a33a3a] hover:bg-[#862e2e] disabled:opacity-60 px-5 py-2 rounded-full transition-all">
          {busy ? 'Deleting…' : `Delete ${ids.length}`}
        </button>
      </div>
    </Dialog>
  );
};

const DeleteProductDialog: React.FC<{
  product: AdminProduct;
  onClose: () => void;
  onDeleted: () => void;
  onSessionExpired: () => void;
}> = ({ product, onClose, onDeleted, onSessionExpired }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await sendJson('DELETE', `/api/admin/products/${product.id}`);
      if (res.status === 401) return onSessionExpired();
      if (!res.ok && res.status !== 404) return setError(data.error ?? 'Something went wrong. Please try again.');
      onDeleted(); // 404 means it's already gone
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title="Delete this product?" icon={Trash2} danger onClose={onClose}>
      <p className="text-sm text-[#4a454e]">
        <b>{product.name}</b> and its picture will be deleted permanently. To only take it off the shop for now, switch it to
        Hidden instead.
      </p>
      {error && (
        <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="text-sm font-bold text-[#7b757e] hover:text-[#4a454e] px-4 py-2 rounded-full">
          Cancel
        </button>
        <button onClick={confirm} disabled={busy} className="text-sm font-bold text-white bg-[#a33a3a] hover:bg-[#862e2e] disabled:opacity-60 px-5 py-2 rounded-full transition-all">
          {busy ? 'Deleting…' : 'Delete product'}
        </button>
      </div>
    </Dialog>
  );
};

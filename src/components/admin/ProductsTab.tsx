import React, { useEffect, useState } from 'react';
import { Crop, ImagePlus, Package, Pencil, Plus, Trash2, X } from 'lucide-react';
import type { AdminProduct, CropArea } from '../../types';
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

const inputClass =
  'w-full px-4 py-3 rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc] focus:border-[#9d84b7] focus:bg-white focus:outline-hidden text-sm transition-all text-[#1c1c18] placeholder-[#7b757e]';
const labelClass = 'text-xs font-bold uppercase tracking-wider text-[#7b757e] block';

const productBody = (p: AdminProduct, changes: Partial<AdminProduct> = {}) => {
  const m = { ...p, ...changes };
  return { name: m.name, description: m.description, priceCents: m.priceCents, stock: m.stock, active: m.active };
};

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
      const { res, data } = await sendJson('PATCH', `/api/admin/products/${p.id}`, productBody(p, { active: !p.active }));
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
        <p className="text-sm text-[#7b757e]">
          {products.length} {products.length === 1 ? 'product' : 'products'}
        </p>
        <button
          onClick={() => setEditing('new')}
          className="inline-flex items-center gap-2 text-sm font-bold text-white bg-[#695282] hover:bg-[#533d6b] px-5 py-2.5 rounded-full shadow-sm transition-all"
        >
          <Plus className="w-4 h-4 text-[#ffd1b3]" />
          Add product
        </button>
      </div>

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
              <Thumb url={p.imageUrl} className="w-14 h-14 shrink-0" />
              <div className="min-w-0 flex-1 basis-40">
                <p className={`font-bold truncate ${p.active ? 'text-[#1c1c18]' : 'text-[#7b757e]'}`}>{p.name}</p>
                <p className="text-sm text-[#4a454e]">
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
            setNotice(`Deleted "${deleting.name}".`);
            setDeleting(null);
          }}
          onSessionExpired={onSessionExpired}
        />
      )}
    </div>
  );
};

const Thumb: React.FC<{ url: string | null; className?: string }> = ({ url, className = '' }) =>
  url ? (
    <img src={url} alt="" loading="lazy" className={`object-cover rounded-2xl bg-[#f7f3ed] ${className}`} />
  ) : (
    <span className={`rounded-2xl bg-[#f7f3ed] border border-dashed border-[#d9d2dc] text-[#b9b2bd] flex items-center justify-center ${className}`}>
      <ImagePlus className="w-5 h-5" />
    </span>
  );

// Shows the chosen square of a photo (crop is in percent of the photo) without making a new file.
const CropPreview: React.FC<{ url: string; crop: CropArea; className?: string }> = ({ url, crop, className = '' }) => (
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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // What the crop screen is showing right now (null = closed). `saved` = the photo came from the server's stored
  // original, so only the crop needs sending; otherwise the photo itself is uploaded too.
  const [draft, setDraft] = useState<{ file: File; saved: boolean; initial: CropArea | null } | null>(null);
  // A picture change waiting for "Save": the full photo and the chosen crop.
  const [pending, setPending] = useState<{ file: File; crop: CropArea; upload: boolean } | null>(null);
  const [pendingUrl, setPendingUrl] = useState<string | null>(null);

  useEffect(() => {
    if (!pending) return setPendingUrl(null);
    const url = URL.createObjectURL(pending.file);
    setPendingUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [pending?.file]);

  // Big phone photos are fine: the server shrinks them (max 30 MB to upload).
  const choose = (f: File | undefined) => {
    if (!f) return;
    if (!IMAGE_TYPES.includes(f.type)) return setError('Please choose a JPG, PNG or WebP image.');
    if (f.size > ORIGINAL_MAX_BYTES) return setError('That image is too big (max 30 MB).');
    setError(null);
    setDraft({ file: f, saved: false, initial: null });
  };

  const applyCrop = (crop: CropArea) => {
    if (draft) setPending({ file: draft.file, crop, upload: !draft.saved });
    setDraft(null);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const priceCents = dollarsToCents(price);
    const stockNumber = Number(stock);
    if (priceCents === null) return setError('Enter a price like 12.50 (from 0.01 to 999999.99).');
    if (!/^\d{1,7}$/.test(stock.trim()) || stockNumber > 1_000_000) return setError('Stock must be a whole number from 0 to 1,000,000.');

    setBusy(true);
    setError(null);
    try {
      const body = { name, description, priceCents, stock: stockNumber, active };
      const { res, data } = saved
        ? await sendJson('PATCH', `/api/admin/products/${saved.id}`, body)
        : await sendJson('POST', '/api/admin/products', body);
      if (res.status === 401) return onSessionExpired();
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Please try again.');
      let result: AdminProduct = data.product;
      const isNew = !saved;

      if (pending) {
        const { x, y, width, height } = pending.crop;
        const up = pending.upload
          ? await fetch(`/api/admin/products/${result.id}/image?crop=${x},${y},${width},${height}`, {
              method: 'PUT',
              headers: { 'Content-Type': pending.file.type },
              body: pending.file,
            })
          : await fetch(`/api/admin/products/${result.id}/crop`, {
              method: 'PUT',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify(pending.crop),
            });
        if (up.status === 401) return onSessionExpired();
        const upData = await up.json().catch(() => ({}));
        if (!up.ok) {
          // The details are saved; only the picture failed. Stay open so it can be retried.
          onChanged(result);
          setSaved(result);
          return setError(`Saved, but the image was not uploaded: ${upData.error ?? 'please try again.'}`);
        }
        result = upData.product;
      }
      onSaved(result, isNew);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const hasPicture = !!pending || !!saved?.imageUrl;

  // Reopen the crop screen on the full photo, with the crop used last time. Pictures saved before originals were
  // kept (no stored original) fall back to cropping the saved picture itself.
  const startCrop = async () => {
    if (pending) return setDraft({ file: pending.file, saved: !pending.upload, initial: pending.crop });
    if (!saved?.imageUrl) return;
    setBusy(true);
    setError(null);
    try {
      const fromServer = saved.hasOriginal;
      const blob = await (await fetch(fromServer ? `/api/admin/products/${saved.id}/original` : saved.imageUrl)).blob();
      setDraft({ file: new File([blob], 'photo.webp', { type: blob.type }), saved: fromServer, initial: fromServer ? saved.crop : null });
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
          className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 border border-white shadow-xl space-y-5"
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

          <div className="flex items-center gap-4">
            {pending && pendingUrl ? (
              <CropPreview url={pendingUrl} crop={pending.crop} className="w-24 h-24 shrink-0" />
            ) : (
              <Thumb url={saved?.imageUrl ?? null} className="w-24 h-24 shrink-0" />
            )}
            <div className="space-y-1.5 min-w-0">
              <label className="inline-flex items-center gap-2 text-sm font-bold text-[#695282] hover:text-[#533d6b] bg-white px-4 py-2 rounded-full border border-[#9d84b7]/30 hover:border-[#9d84b7]/60 cursor-pointer transition-all focus-within:ring-2 focus-within:ring-[#9d84b7]">
                <ImagePlus className="w-4 h-4" />
                {hasPicture ? 'Change image' : 'Choose image'}
                <input
                  type="file"
                  accept={IMAGE_TYPES.join(',')}
                  className="sr-only"
                  onChange={(e) => {
                    choose(e.target.files?.[0]);
                    e.target.value = ''; // so picking the same file again still opens the crop screen
                  }}
                />
              </label>
              {hasPicture && (
                <button type="button" onClick={startCrop} disabled={busy} className="ml-2 inline-flex items-center gap-1.5 text-sm font-bold text-[#695282] hover:text-[#533d6b] underline underline-offset-2 disabled:opacity-60">
                  <Crop className="w-4 h-4" />
                  Crop
                </button>
              )}
              <p className="text-xs text-[#7b757e]">JPG, PNG or WebP. You can crop and zoom it next.</p>
            </div>
          </div>

          <div className="space-y-2">
            <label htmlFor="product-name" className={labelClass}>Name</label>
            <input id="product-name" required maxLength={120} value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="e.g. Midnight Vanilla Scoop" />
          </div>
          <div className="space-y-2">
            <span className={labelClass}>Description</span>
            <RichTextEditor value={description} onChange={setDescription} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <label htmlFor="product-price" className={labelClass}>Price (S$)</label>
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
    {draft && <ImageCropper file={draft.file} initialArea={draft.initial} onCancel={() => setDraft(null)} onDone={applyCrop} />}
    </>
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

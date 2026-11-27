import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, Clock, Droplets, Minus, Package, Plus, Radio, Users, ShoppingBag, Sparkles, X } from 'lucide-react';
import { GENDER_LABEL, type Gender, type PerfumeDetails, type PerfumeNotes, type Product, type ScoopDetails } from '../types';
import { formatPrice } from '../money';
import { useAccount } from '../useAccount';
import { useLive } from '../useLive';
import { useCart } from '../useCart';
import { AuthModal } from './AuthModal';
import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { ProductTile } from './ProductTile';
import { FramedImage } from './FramedImage';
import { CartDrawer } from './CartDrawer';
import { LegendBeads, LegendModal } from './Legend';

type Filter = 'all' | 'perfume' | 'scoop' | 'other';
type Sort = 'newest' | 'price-asc' | 'price-desc';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'perfume', label: 'Perfumes' },
  { key: 'scoop', label: 'Scoops' },
  { key: 'other', label: 'Other' },
];

// The pop-up is addressed by the page's #hash (/shop#12), so a product can be linked to and the Back button closes it.
const hashId = () => window.location.hash.slice(1) || null;

// /shop: every product the admin has made visible, filterable by type and sortable by price. Adding to cart comes in the next phase.
export const ShopPage: React.FC = () => {
  const { user, setUser, authOpen, setAuthOpen, logout } = useAccount();
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  const [filter, setFilter] = useState<Filter>('all');
  const [gender, setGender] = useState<Gender | null>(null);
  const [sort, setSort] = useState<Sort>('newest');
  const [openId, setOpenId] = useState<string | null>(hashId);
  const live = useLive();
  const cart = useCart(user);
  // An "Add to cart" pressed while logged out waits here, and goes through once the customer has logged in.
  const pendingAdd = useRef<{ productId: string; mode: string; quantity: number; from?: Fly } | null>(null);
  // A picture flying from "Add to cart" to the cart button; the badge count waits (holdCount) until it lands.
  const [fly, setFly] = useState<Fly | null>(null);
  const [holdCount, setHoldCount] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'Shop — ScoopVerse';
    fetch('/api/products')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setProducts((await res.json()).products);
      })
      .catch(() => setError(true));
    const sync = () => setOpenId(hashId());
    window.addEventListener('popstate', sync);
    return () => window.removeEventListener('popstate', sync);
  }, []);

  const open = (p: Product) => {
    window.history.pushState({ shopOpen: true }, '', `#${p.id}`);
    setOpenId(p.id);
  };
  // Back out of the entry the pop-up added; when the page was opened straight onto a product, just drop the hash.
  const close = useCallback(() => {
    if (window.history.state?.shopOpen) return window.history.back();
    window.history.replaceState(null, '', window.location.pathname + window.location.search);
    setOpenId(null);
  }, []);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: products?.length ?? 0, perfume: 0, scoop: 0, other: 0 };
    for (const p of products ?? []) c[p.kind === 'perfume' || p.kind === 'scoop' ? p.kind : 'other']++;
    return c;
  }, [products]);
  const genderCounts = useMemo(() => {
    const c: Record<Gender, number> = { women: 0, men: 0, unisex: 0 };
    for (const p of products ?? []) if (p.kind === 'perfume' && p.details?.gender) c[p.details.gender]++;
    return c;
  }, [products]);
  const genders = (Object.keys(genderCounts) as Gender[]).filter((g) => genderCounts[g] > 0);
  // Only perfumes have a "for" tag, so choosing a type without them drops the tag.
  const pickType = (f: Filter) => {
    setFilter(f);
    if (f === 'scoop' || f === 'other') setGender(null);
  };
  const filters = FILTERS.filter((f) => f.key === 'all' || counts[f.key] > 0);

  const shown = useMemo(() => {
    const list = (products ?? []).filter((p) => (!gender || (p.kind === 'perfume' && p.details?.gender === gender)) && (filter === 'all' || (filter === 'other' ? p.kind !== 'perfume' && p.kind !== 'scoop' : p.kind === filter)));
    if (sort === 'price-asc') return [...list].sort((a, b) => a.priceCents - b.priceCents);
    if (sort === 'price-desc') return [...list].sort((a, b) => b.priceCents - a.priceCents);
    return list;
  }, [products, filter, gender, sort]);

  // Adds to the cart (asking the customer to log in first). Returns an error message, or null when it worked.
  const addToCart = async (productId: string, mode: string, quantity: number, from?: Fly) => {
    if (!user) {
      pendingAdd.current = { productId, mode, quantity, from };
      setAuthOpen(true);
      return null;
    }
    const before = cart.cart?.count ?? 0;
    const err = await cart.add(productId, mode, quantity);
    if (!err) added(before, from);
    return err;
  };
  const added = (before: number, from?: Fly) => {
    close();
    if (from) {
      setHoldCount(before);
      setFly(from);
    }
  };

  const openProduct = products?.find((p) => p.id === openId) ?? null;

  return (
    <div className="site min-h-screen selection:bg-accent/20">
      <SiteNav user={user} onLogin={() => setAuthOpen(true)} onLogout={logout} current="shop" onCart={() => (user ? cart.setOpen(true) : setAuthOpen(true))} cartCount={holdCount ?? cart.cart?.count} />

      <main>
        <div className="page-wrap grid items-end gap-x-16 gap-y-4 pb-10 pt-12 lg:grid-cols-12">
          <h1 className="text-display-s lg:col-span-6">The Shop</h1>
          <p className="lead text-ink-2 lg:col-span-5 lg:col-start-8">Mystery fragrance scoops, full bottles and more.</p>
        </div>

        {products && products.length > 0 && (
          <div className="z-30 border-y border-rule bg-paper lg:sticky lg:top-(--nav-height)">
            <div className="page-wrap flex flex-wrap items-center justify-between gap-x-8 gap-y-2 py-2">
              {filters.length > 2 ? (
                <div role="group" aria-label="Filter by type" className="flex flex-wrap gap-x-2">
                  {filters.map((f) => (
                    <button
                      key={f.key}
                      type="button"
                      aria-pressed={filter === f.key}
                      onClick={() => pickType(f.key)}
                      className="inline-flex min-h-11 items-center gap-1.5 border-b-2 border-transparent px-2 font-semibold text-ink-2 transition-colors hover:text-accent aria-pressed:border-accent aria-pressed:text-ink"
                    >
                      {f.label}
                      <span className="num text-sm font-medium text-muted">{counts[f.key]}</span>
                    </button>
                  ))}
                </div>
              ) : (
                <span />
              )}
              <div className="flex items-center gap-4">
                <p role="status" className="num text-sm text-muted">
                  {shown.length} {shown.length === 1 ? 'product' : 'products'}
                </p>
                <label className="flex items-center gap-2 text-sm text-ink-2">
                  Sort by
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as Sort)}
                    className="min-h-11 rounded-card border border-rule bg-paper px-3 font-semibold text-ink"
                  >
                    <option value="newest">Newest</option>
                    <option value="price-asc">Price, low to high</option>
                    <option value="price-desc">Price, high to low</option>
                  </select>
                </label>
              </div>
            </div>
            {genders.length > 0 && (
              <div className="page-wrap flex flex-wrap items-center gap-x-3 gap-y-2 border-t border-rule py-2">
                <span className="text-sm text-muted">Perfumes for</span>
                <div role="group" aria-label="Filter perfumes by who they are for" className="flex flex-wrap gap-2">
                  {([null, ...genders] as (Gender | null)[]).map((g) => (
                    <button
                      key={g ?? 'everyone'}
                      type="button"
                      aria-pressed={gender === g}
                      onClick={() => setGender(g)}
                      className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-rule px-4 text-sm font-semibold text-ink-2 transition-colors hover:border-accent hover:text-accent aria-pressed:border-ink aria-pressed:bg-ink aria-pressed:text-paper"
                    >
                      {g ? GENDER_LABEL[g] : 'Everyone'}
                      {g && <span className="num font-medium opacity-70">{genderCounts[g]}</span>}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        <div className="page-wrap pt-10">
          {error && (
            <p role="alert" className="max-w-md rounded-card border border-error/30 px-4 py-3 text-error">
              We couldn’t load the shop. Please refresh and try again.
            </p>
          )}

          {!products && !error && (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3 xl:grid-cols-4" aria-hidden>
              {[0, 1, 2, 3].map((i) => (
                <li key={i} className="space-y-3">
                  <div className="aspect-square rounded-card bg-paper-3 motion-safe:animate-pulse" />
                  <div className="h-4 w-2/3 rounded-card bg-paper-3 motion-safe:animate-pulse" />
                </li>
              ))}
            </ul>
          )}

          {products?.length === 0 && (
            <div className="max-w-[52ch] space-y-2 py-10">
              <h2 className="text-3xl">Nothing here yet</h2>
              <p className="text-ink-2">New scoops are on their way. Check back soon.</p>
            </div>
          )}

          {products && products.length > 0 && shown.length === 0 && (
            <div className="max-w-[52ch] space-y-4 py-10">
              <p className="text-ink-2">Nothing in this category yet.</p>
              <button type="button" onClick={() => { setFilter('all'); setGender(null); }} className="btn btn-quiet">
                Show everything
              </button>
            </div>
          )}

          {shown.length > 0 && (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((p, i) => (
                <li key={p.id}>
                  <ProductTile product={p} onOpen={() => open(p)} eager={i < 4} live={live} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <SiteFooter />

      {openProduct && <ProductDetail product={openProduct} onClose={close} live={live} onAdd={addToCart} />}
      {fly && <FlyingPicture {...fly} onDone={() => { setFly(null); setHoldCount(null); }} />}
      {cart.open && <CartDrawer cart={cart.cart} onClose={() => cart.setOpen(false)} onQuantity={cart.setQuantity} onRemove={cart.remove} />}
      <AuthModal
        open={authOpen}
        onClose={() => {
          pendingAdd.current = null;
          setAuthOpen(false);
        }}
        onAuthed={async (u) => {
          setUser(u);
          setAuthOpen(false);
          const pending = pendingAdd.current;
          pendingAdd.current = null;
          const before = cart.cart?.count ?? 0;
          if (pending && !(await cart.add(pending.productId, pending.mode, pending.quantity))) added(before, pending.from);
        }}
      />
    </div>
  );
};

// Where a flying picture starts, and which picture it is.
type Fly = { rect: DOMRect; src: string | null };

// The product's picture, shrinking along an arc from the Add to cart button to the cart button in the top bar.
// Only transform and opacity move; with reduced motion there is no flight (the badge just changes).
const FlyingPicture: React.FC<Fly & { onDone: () => void }> = ({ rect, src, onDone }) => {
  const ref = useRef<HTMLSpanElement>(null);
  useEffect(() => {
    const target = document.querySelector('[data-cart-button]')?.getBoundingClientRect();
    if (!target || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return onDone();
    const x = target.left + target.width / 2 - (rect.left + rect.width / 2);
    const y = target.top + target.height / 2 - (rect.top + rect.height / 2);
    const flight = ref.current!.animate(
      [
        { transform: 'translate(0, 0) scale(1)', opacity: 1 },
        { transform: `translate(${x * 0.55}px, ${y * 0.55 - 90}px) scale(0.8)`, opacity: 1, offset: 0.5 },
        { transform: `translate(${x}px, ${y}px) scale(0.3)`, opacity: 0.7 },
      ],
      { duration: 800, easing: 'cubic-bezier(0.4, 0, 0.2, 1)' },
    );
    flight.onfinish = onDone;
    return () => flight.cancel();
  }, []);
  return (
    <span
      ref={ref}
      aria-hidden
      style={{ left: rect.left + rect.width / 2 - 28, top: rect.top + rect.height / 2 - 28 }}
      className="pointer-events-none fixed z-[70] grid h-14 w-14 place-items-center overflow-hidden rounded-full border-2 border-accent bg-paper-2 text-accent shadow-lg"
    >
      {src ? <img src={src} alt="" className="h-full w-full object-cover" /> : <ShoppingBag className="h-6 w-6" />}
    </span>
  );
};

const ProductImage: React.FC<{ product: Product; src: string | null }> = ({ product, src }) =>
  src ? (
    <FramedImage src={src} alt={product.name} eager className={product.inStock ? '' : 'opacity-60'} />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-paper-3 text-accent">
      <Sparkles className="h-10 w-10" aria-hidden />
    </div>
  );

const CONCENTRATION_NAME = { EDP: 'Eau de Parfum', EDT: 'Eau de Toilette' };

// Strength and staying power as two chips laid over the picture's bottom edge.
const FragranceChips: React.FC<{ details: PerfumeDetails; lifted: boolean }> = ({ details: d, lifted }) => {
  const chip = 'inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs font-bold text-accent-deep';
  return (
    // Lifted above the thumbnail strip when the listing has more than one picture.
    <div className={`absolute left-4 right-4 flex flex-wrap gap-2 ${lifted ? 'bottom-20' : 'bottom-4'}`}>
      <span className={chip}>
        <Droplets className="h-3.5 w-3.5 text-accent" aria-hidden />
        {d.concentration} <span className="font-semibold text-muted">{CONCENTRATION_NAME[d.concentration]}</span>
      </span>
      {d.gender && (
        <span className={chip}>
          <Users className="h-3.5 w-3.5 text-accent" aria-hidden />
          {GENDER_LABEL[d.gender]}
        </span>
      )}
      <span className={chip}>
        <Clock className="h-3.5 w-3.5 text-accent" aria-hidden />
        Lasts {d.hoursMin === d.hoursMax ? d.hoursMin : `${d.hoursMin}–${d.hoursMax}`} hours
      </span>
    </div>
  );
};

// What it is inspired by, and the one-line pitch.
const FragranceBox: React.FC<{ details: PerfumeDetails }> = ({ details: d }) => (
  <div className="shrink-0 space-y-1.5 border-y border-rule py-3">
    <p className="flex flex-wrap items-baseline gap-x-2 [overflow-wrap:anywhere]">
      <span className="text-sm text-muted">Inspired by</span>
      <span className="font-display text-xl font-bold leading-snug text-ink">{d.inspiredBy}</span>
    </p>
    {d.tagline && (
      <p className="flex items-start gap-2 text-sm italic leading-snug text-ink-2 [overflow-wrap:anywhere]">
        <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
        {d.tagline}
      </p>
    )}
  </div>
);

const NOTE_ROWS = [
  { key: 'top', label: 'Top', hint: 'opening' },
  { key: 'heart', label: 'Heart', hint: 'core' },
  { key: 'base', label: 'Base', hint: 'lasting' },
] as const;

// The notes: top, heart and base notes as chips. Rows with no notes are left out; no notes at all, nothing.
const NotesBox: React.FC<{ notes: PerfumeNotes }> = ({ notes }) => {
  const rows = NOTE_ROWS.filter((r) => notes[r.key].length > 0);
  if (rows.length === 0) return null;
  return (
    <div className="shrink-0 space-y-2.5 border-b border-rule pb-3">
      <p className="text-sm font-semibold text-muted">Fragrance notes</p>
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[3.75rem_minmax(0,1fr)] items-start gap-3" title={r.hint}>
          <p className="pt-0.5 text-sm font-bold text-ink">{r.label}</p>
          <ul className="flex flex-wrap gap-1.5" aria-label={`${r.label} notes`}>
            {notes[r.key].map((n, i) => (
              <li key={i} className="rounded-full bg-paper-3 px-2.5 py-0.5 text-xs font-semibold text-accent-deep [overflow-wrap:anywhere]">
                {n}
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
};

// Two things shown in a scoop's pop-up: how many beads you get, and the duplicate rule.
const ScoopBox: React.FC<{ details: ScoopDetails; onLegend: () => void }> = ({ details: d, onLegend }) => {
  const stat = 'flex flex-col';
  return (
    <div className="shrink-0 space-y-3">
      <p className="font-display text-lg font-bold leading-snug text-accent-deep">Can’t smell it online? Let the scoop help you decide.</p>
      <LegendBeads onOpen={onLegend} />
      <div className="space-y-2.5 rounded-card bg-paper-3 p-3.5">
        <dl className="grid grid-cols-3 gap-3">
          <div className={stat}>
            <dd className="num font-display text-2xl font-bold leading-none text-ink">{d.scoops}</dd>
            <dt className="mt-1 text-sm text-ink-2">{d.scoops === 1 ? 'scoop' : 'scoops in a row'}</dt>
          </div>
          <div className={stat}>
            <dd className="num font-display text-2xl font-bold leading-none text-ink">{d.beadsMin === d.beadsMax ? d.beadsMin : `${d.beadsMin}–${d.beadsMax}`}</dd>
            <dt className="mt-1 text-sm text-ink-2">perfumes in total</dt>
          </div>
          <div className={stat}>
            <dd className="num font-display text-2xl font-bold leading-none text-ink">2 ml</dd>
            <dt className="mt-1 text-sm text-ink-2">per decant</dt>
          </div>
        </dl>
        <p className="text-sm leading-snug text-ink-2">
          Every scoop gives at least 3 perfumes. Filler beads are blank, and each +1 bead earns an extra scoop after the rest.
        </p>
        <p className="flex items-start gap-2 text-sm font-semibold leading-snug text-accent-deep">
          <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-accent" aria-hidden />
          Same scent twice? Both 2 ml decants become one 5 ml decant.
        </p>
      </div>
    </div>
  );
};

type Mode = 'live' | 'offline';

// Go Live (full price, we scoop on the spot during a live) or Offline (lower price, no video guaranteed).
const OrderOptions: React.FC<{ details: ScoopDetails; livePrice: number; live: boolean; mode: Mode; onMode: (m: Mode) => void }> = ({
  details: d,
  livePrice,
  live,
  mode,
  onMode,
}) => {
  const card = 'flex flex-col gap-0.5 rounded-card border-2 p-3 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60';
  const pick = (on: boolean) => (on ? 'border-accent bg-paper-3' : 'border-rule bg-paper hover:border-accent');
  return (
    <div role="radiogroup" aria-label="How do you want to order?" className="grid shrink-0 grid-cols-2 gap-2">
      <button type="button" role="radio" aria-checked={mode === 'live'} disabled={!live} onClick={() => onMode('live')} className={`${card} ${pick(mode === 'live')}`}>
        <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Radio className="h-4 w-4 text-accent" aria-hidden />
          Go Live
        </span>
        <span className="num font-bold text-accent-deep">{formatPrice(livePrice)}</span>
        <span className="text-xs leading-snug text-muted">{live ? 'We scoop it on TikTok or IG live.' : 'Not live right now. Opens when we go live.'}</span>
      </button>
      <button type="button" role="radio" aria-checked={mode === 'offline'} onClick={() => onMode('offline')} className={`${card} ${pick(mode === 'offline')}`}>
        <span className="flex items-center gap-1.5 text-sm font-bold text-ink">
          <Package className="h-4 w-4 text-accent" aria-hidden />
          Offline
        </span>
        <span className="num font-bold text-accent-deep">{formatPrice(d.offlinePriceCents)}</span>
        <span className="text-xs leading-snug text-muted">Cheaper. We can’t promise a video.</span>
      </button>
    </div>
  );
};

const ProductDetail: React.FC<{ product: Product; onClose: () => void; live: boolean; onAdd: (productId: string, mode: string, quantity: number, from?: Fly) => Promise<string | null> }> = ({ product, onClose, live, onAdd }) => {
  // The list doesn't carry descriptions; this one product's comes when its pop-up opens.
  const [description, setDescription] = useState<string | undefined>();
  // Every picture of the listing (the list only carries the cover), and which one is showing.
  const [images, setImages] = useState<string[]>(product.imageUrl ? [product.imageUrl] : []);
  const [shot, setShot] = useState(0);
  const dialogRef = useRef<HTMLDivElement>(null);
  const [adding, setAdding] = useState(false);
  const [quantity, setQuantity] = useState(1);
  const [addError, setAddError] = useState<string | null>(null);
  const perfume = product.kind === 'perfume' ? product.details : null;
  const scoop = product.kind === 'scoop' ? product.details : null;
  // Go Live is only on offer while the shop is live; otherwise (or if the live ends while this is open) it's Offline.
  const [pickedMode, setPickedMode] = useState<Mode | null>(null);
  // The full list of scents opens over this pop-up; it handles its own Esc and Tab (see Legend.tsx).
  const [legendOpen, setLegendOpen] = useState(false);
  const mode: Mode = scoop && live && (pickedMode ?? 'live') === 'live' ? 'live' : 'offline';
  const price = scoop && mode === 'offline' ? scoop.offlinePriceCents : product.priceCents;

  useEffect(() => {
    fetch(`/api/products/${product.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        setDescription(data?.product.description);
        if (data?.product.images?.length) setImages(data.product.images);
      })
      .catch(() => {});
  }, [product.id]);

  // Keyboard: focus moves into the pop-up, Tab stays inside it, Esc closes it, and focus goes back to the product that was clicked.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = dialogRef.current!;
    dialog.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab') return;
      const items = dialog.querySelectorAll<HTMLElement>('button:not([disabled]), [tabindex="0"]');
      const first = items[0];
      const last = items[items.length - 1];
      const here = document.activeElement;
      if (e.shiftKey && (here === first || here === dialog)) {
        last.focus();
        e.preventDefault();
      } else if (!e.shiftKey && here === last) {
        first.focus();
        e.preventDefault();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      opener?.focus();
    };
  }, [onClose]);

  return (
    <>
    <div className="fixed inset-0 z-50 overflow-y-auto bg-ink/40" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={product.name}
          onClick={(e) => e.stopPropagation()}
          // 1296px wide on big screens; the text column is half the width, so the square picture is about 653px tall.
          className="relative grid w-full max-w-[81rem] overflow-hidden rounded-3xl bg-white outline-hidden lg:grid-cols-[minmax(0,1fr)_49.6%]"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 z-10 flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink-2 transition-colors hover:text-accent"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          {/* Always square, so the picture is never stretched however long the text is. */}
          <div className="relative aspect-square bg-paper-2">
            <ProductImage product={product} src={images[shot] ?? null} />
            {perfume && <FragranceChips details={perfume} lifted={images.length > 1} />}
            {images.length > 1 && (
              <>
                {[-1, 1].map((step) => (
                  <button
                    key={step}
                    type="button"
                    onClick={() => setShot((shot + step + images.length) % images.length)}
                    aria-label={step < 0 ? 'Previous picture' : 'Next picture'}
                    className={`absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-paper/90 text-ink-2 transition-colors hover:text-accent ${step < 0 ? 'left-3' : 'right-3'}`}
                  >
                    {step < 0 ? <ChevronLeft className="h-5 w-5" aria-hidden /> : <ChevronRight className="h-5 w-5" aria-hidden />}
                  </button>
                ))}
                <ul className="absolute bottom-3 left-1/2 flex -translate-x-1/2 gap-2 rounded-full bg-paper/90 p-1.5" aria-label="Pictures">
                  {images.map((src, i) => (
                    <li key={src}>
                      <button
                        type="button"
                        onClick={() => setShot(i)}
                        aria-label={`Picture ${i + 1} of ${images.length}`}
                        aria-current={i === shot}
                        className={`block h-11 w-11 overflow-hidden rounded-full border-2 transition-colors ${i === shot ? 'border-accent' : 'border-transparent hover:border-rule'}`}
                      >
                        <img src={src} alt="" className="h-full w-full bg-paper-2 object-contain" />
                      </button>
                    </li>
                  ))}
                </ul>
              </>
            )}
          </div>
          {/* Wide screens: this column is exactly as tall as the picture (the content is laid over it), so the pop-up never
              grows with the text; the description scrolls instead. Narrow screens: stacked, description height capped. */}
          <div className="relative min-w-0">
            <div className="flex flex-col gap-4 p-6 sm:p-8 lg:absolute lg:inset-0 lg:gap-3 lg:p-6">
              <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 lg:pr-12">
                <h2 className="min-w-0 flex-1 basis-48 pr-12 font-display text-3xl font-bold leading-tight [overflow-wrap:anywhere] lg:pr-0">{product.name}</h2>
                <p className="num shrink-0 text-xl font-bold text-accent-deep">{formatPrice(price)}</p>
              </div>
              {perfume && <FragranceBox details={perfume} />}
              {scoop && <ScoopBox details={scoop} onLegend={() => setLegendOpen(true)} />}
              {/* Wide screens: the notes and the description scroll together under the fixed perfume box. Narrow screens:
                  the page scrolls and only the description is height-capped. */}
              {(perfume?.notes || description) && (
                <div
                  className="flex min-h-0 flex-col gap-4 [scrollbar-color:var(--color-muted)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] lg:flex-1 lg:overflow-y-auto"
                  tabIndex={0}
                  aria-label="Product details"
                >
                  {perfume?.notes && <NotesBox notes={perfume.notes} />}
                  {/* Already cleaned by the server (allow-listed tags only), so it is safe to show as HTML. */}
                  {description && (
                    <div
                      className="rich-text max-h-[max(6rem,20vh)] overflow-y-auto text-sm leading-relaxed text-ink-2 [scrollbar-color:var(--color-muted)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] lg:max-h-none lg:overflow-visible"
                      aria-label="Product description"
                      dangerouslySetInnerHTML={{ __html: description }}
                    />
                  )}
                </div>
              )}
              <div className="mt-auto shrink-0 space-y-2 pt-1">
                {scoop && <OrderOptions details={scoop} livePrice={product.priceCents} live={live} mode={mode} onMode={setPickedMode} />}
                <div className="flex gap-3">
                {product.inStock && (
                  <div role="group" aria-label="Quantity" className="flex shrink-0 items-center rounded-full border border-rule">
                    <button type="button" onClick={() => setQuantity((q) => q - 1)} disabled={quantity <= 1} aria-label="One less" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-accent disabled:opacity-40 disabled:hover:text-ink-2">
                      <Minus className="h-4 w-4" aria-hidden />
                    </button>
                    <span className="num w-7 text-center font-semibold" aria-live="polite" aria-label={`Quantity ${quantity}`}>{quantity}</span>
                    <button type="button" onClick={() => setQuantity((q) => q + 1)} disabled={quantity >= 10} aria-label="One more" className="inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-accent disabled:opacity-40 disabled:hover:text-ink-2">
                      <Plus className="h-4 w-4" aria-hidden />
                    </button>
                  </div>
                )}
                <button
                  disabled={!product.inStock || adding}
                  onClick={async (e) => {
                    setAdding(true);
                    setAddError(await onAdd(product.id, scoop ? mode : 'standard', quantity, { rect: e.currentTarget.getBoundingClientRect(), src: images[0] ?? null }));
                    setAdding(false);
                  }}
                  className="btn btn-primary min-w-0 flex-1"
                >
                  <ShoppingBag className="h-4 w-4" aria-hidden />
                  {product.inStock ? 'Add to cart' : 'Sold out'}
                </button>
                </div>
                {addError && (
                  <p role="alert" className="text-center text-sm text-error">
                    {addError}
                  </p>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
    {legendOpen && <LegendModal onClose={() => setLegendOpen(false)} />}
    </>
  );
};

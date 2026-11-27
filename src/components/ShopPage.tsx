import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Clock, Droplets, ShoppingBag, Sparkles, X } from 'lucide-react';
import type { PerfumeDetails, PerfumeNotes, Product } from '../types';
import { formatPrice } from '../money';
import { useAccount } from '../useAccount';
import { AuthModal } from './AuthModal';
import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { ProductTile } from './ProductTile';

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
  const [sort, setSort] = useState<Sort>('newest');
  const [openId, setOpenId] = useState<string | null>(hashId);

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
  const filters = FILTERS.filter((f) => f.key === 'all' || counts[f.key] > 0);

  const shown = useMemo(() => {
    const list = (products ?? []).filter((p) => filter === 'all' || (filter === 'other' ? p.kind !== 'perfume' && p.kind !== 'scoop' : p.kind === filter));
    if (sort === 'price-asc') return [...list].sort((a, b) => a.priceCents - b.priceCents);
    if (sort === 'price-desc') return [...list].sort((a, b) => b.priceCents - a.priceCents);
    return list;
  }, [products, filter, sort]);

  const openProduct = products?.find((p) => p.id === openId) ?? null;

  return (
    <div className="site min-h-screen selection:bg-accent/20">
      <SiteNav user={user} onLogin={() => setAuthOpen(true)} onLogout={logout} current="shop" />

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
                      onClick={() => setFilter(f.key)}
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
              <button type="button" onClick={() => setFilter('all')} className="btn btn-quiet">
                Show everything
              </button>
            </div>
          )}

          {shown.length > 0 && (
            <ul className="grid grid-cols-2 gap-x-6 gap-y-10 lg:grid-cols-3 xl:grid-cols-4">
              {shown.map((p, i) => (
                <li key={p.id}>
                  <ProductTile product={p} onOpen={() => open(p)} eager={i < 4} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </main>

      <SiteFooter />

      {openProduct && <ProductDetail product={openProduct} onClose={close} />}
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={(u) => {
          setUser(u);
          setAuthOpen(false);
        }}
      />
    </div>
  );
};

const ProductImage: React.FC<{ product: Product }> = ({ product }) =>
  product.imageUrl ? (
    <img src={product.imageUrl} alt={product.name} className={`h-full w-full object-cover ${product.inStock ? '' : 'opacity-60'}`} />
  ) : (
    <div className="flex h-full w-full items-center justify-center bg-paper-3 text-accent">
      <Sparkles className="h-10 w-10" aria-hidden />
    </div>
  );

const CONCENTRATION_NAME = { EDP: 'Eau de Parfum', EDT: 'Eau de Toilette' };

// Strength and staying power as two chips laid over the picture's bottom edge.
const FragranceChips: React.FC<{ details: PerfumeDetails }> = ({ details: d }) => {
  const chip = 'inline-flex items-center gap-1.5 rounded-full bg-paper px-3 py-1.5 text-xs font-bold text-accent-deep';
  return (
    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
      <span className={chip}>
        <Droplets className="h-3.5 w-3.5 text-accent" aria-hidden />
        {d.concentration} <span className="font-semibold text-muted">{CONCENTRATION_NAME[d.concentration]}</span>
      </span>
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

const ProductDetail: React.FC<{ product: Product; onClose: () => void }> = ({ product, onClose }) => {
  // The list doesn't carry descriptions; this one product's comes when its pop-up opens.
  const [description, setDescription] = useState<string | undefined>();
  const dialogRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch(`/api/products/${product.id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => setDescription(data?.product.description))
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
            <ProductImage product={product} />
            {product.details && <FragranceChips details={product.details} />}
          </div>
          {/* Wide screens: this column is exactly as tall as the picture (the content is laid over it), so the pop-up never
              grows with the text; the description scrolls instead. Narrow screens: stacked, description height capped. */}
          <div className="relative min-w-0">
            <div className="flex flex-col gap-4 p-6 sm:p-8 lg:absolute lg:inset-0 lg:gap-3 lg:p-6">
              <div className="flex shrink-0 flex-wrap items-baseline justify-between gap-x-4 gap-y-1 lg:pr-12">
                <h2 className="min-w-0 flex-1 basis-48 pr-12 font-display text-3xl font-bold leading-tight [overflow-wrap:anywhere] lg:pr-0">{product.name}</h2>
                <p className="num shrink-0 text-xl font-bold text-accent-deep">{formatPrice(product.priceCents)}</p>
              </div>
              {product.details && <FragranceBox details={product.details} />}
              {/* Wide screens: the notes and the description scroll together under the fixed perfume box. Narrow screens:
                  the page scrolls and only the description is height-capped. */}
              {(product.details?.notes || description) && (
                <div
                  className="flex min-h-0 flex-col gap-4 [scrollbar-color:var(--color-muted)_transparent] [scrollbar-gutter:stable] [scrollbar-width:thin] lg:flex-1 lg:overflow-y-auto"
                  tabIndex={0}
                  aria-label="Product details"
                >
                  {product.details?.notes && <NotesBox notes={product.details.notes} />}
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
              <div className="mt-auto shrink-0 space-y-1.5 pt-1">
                <button disabled className="btn btn-primary w-full">
                  <ShoppingBag className="h-4 w-4" aria-hidden />
                  {product.inStock ? 'Add to cart' : 'Sold out'}
                </button>
                {product.inStock && <p className="text-center text-sm text-muted">Ordering opens soon.</p>}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

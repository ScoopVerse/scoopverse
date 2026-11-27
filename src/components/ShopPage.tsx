import React, { useCallback, useEffect, useRef, useState } from 'react';
import { ArrowLeft, Clock, Droplets, ShoppingBag, Sparkles, X } from 'lucide-react';
import type { PerfumeDetails, PerfumeNotes, Product } from '../types';
import { formatPrice } from '../money';
import { ScoopVerseLogo } from './ScoopVerseLogo';

// /shop: every product the admin has made visible. Adding to cart comes in the next phase.
export const ShopPage: React.FC = () => {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<Product | null>(null);
  const close = useCallback(() => setOpen(null), []);

  useEffect(() => {
    document.title = 'Shop — ScoopVerse';
    fetch('/api/products')
      .then(async (res) => {
        if (!res.ok) throw new Error();
        setProducts((await res.json()).products);
      })
      .catch(() => setError(true));
  }, []);

  return (
    <div className="min-h-screen bg-[#fdf9f3] font-sans-ui text-[#1c1c18] selection:bg-[#9d84b7]/20 selection:text-[#2d2438]">
      <header className="max-w-6xl mx-auto px-4 sm:px-6 pt-6 pb-2 flex items-center justify-between gap-3">
        <a href="/" className="inline-flex items-center gap-2 text-sm font-semibold text-[#695282] hover:text-[#533d6b] transition-colors">
          <ArrowLeft className="w-4 h-4" />
          Home
        </a>
        <ScoopVerseLogo size="sm" />
        <span className="w-16" aria-hidden />
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 pb-16 space-y-8">
        <div className="text-center space-y-3 pt-4">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#efdbff] text-[#533d6b] text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-[#695282]" />
            <span>Mystery Fragrance Scoops</span>
          </div>
          <h1 className="font-serif-display text-4xl sm:text-5xl font-bold">The Shop</h1>
        </div>

        {error && (
          <p role="alert" className="max-w-md mx-auto text-center text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-3">
            We couldn't load the shop. Please refresh and try again.
          </p>
        )}

        {!products && !error && (
          <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <li key={i} className="space-y-3">
                <div className="aspect-square rounded-3xl bg-[#efe7f5]/70 animate-pulse" />
                <div className="h-4 w-2/3 rounded-full bg-[#efe7f5]/70 animate-pulse" />
              </li>
            ))}
          </ul>
        )}

        {products?.length === 0 && (
          <div className="text-center py-16 space-y-3">
            <div className="w-16 h-16 rounded-full bg-[#efdbff]/70 text-[#695282] flex items-center justify-center mx-auto">
              <ShoppingBag className="w-7 h-7" />
            </div>
            <h2 className="font-serif-display text-2xl font-bold">Nothing here yet</h2>
            <p className="text-sm text-[#4a454e]">New scoops are on their way. Check back soon.</p>
          </div>
        )}

        {products && products.length > 0 && (
          <ul className="grid grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6">
            {products.map((p) => (
              <li key={p.id}>
                <button onClick={() => setOpen(p)} className="group w-full text-left space-y-3 rounded-3xl focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-[#9d84b7]">
                  <div className="relative aspect-square rounded-3xl overflow-hidden bg-white border border-[#efe7f5] shadow-xs group-hover:shadow-lg group-hover:-translate-y-0.5 transition-all">
                    <ProductImage product={p} />
                    {!p.inStock && (
                      <span className="absolute top-3 left-3 px-3 py-1 rounded-full bg-[#2d2438]/85 text-white text-xs font-bold">Sold out</span>
                    )}
                  </div>
                  <div className="px-1 space-y-0.5">
                    <p className="font-bold leading-snug line-clamp-2 [overflow-wrap:anywhere]">{p.name}</p>
                    {p.details && <p className="text-xs text-[#7b757e] line-clamp-1 [overflow-wrap:anywhere]">Inspired by {p.details.inspiredBy}</p>}
                    <p className="text-sm font-semibold text-[#695282]">
                      {formatPrice(p.priceCents)}
                      {p.details && <span className="ml-2 px-2 py-0.5 rounded-full bg-[#efdbff]/70 text-[#533d6b] text-[11px] font-bold">{p.details.concentration}</span>}
                    </p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {open && <ProductDetail product={open} onClose={close} />}
    </div>
  );
};

const ProductImage: React.FC<{ product: Product }> = ({ product }) =>
  product.imageUrl ? (
    <img src={product.imageUrl} alt={product.name} loading="lazy" className={`w-full h-full object-cover ${product.inStock ? '' : 'opacity-60'}`} />
  ) : (
    <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-[#efdbff]/60 via-[#fdf9f3] to-[#ffd1b3]/40 text-[#9d84b7]">
      <Sparkles className="w-10 h-10" />
    </div>
  );

const CONCENTRATION_NAME = { EDP: 'Eau de Parfum', EDT: 'Eau de Toilette' };

// Strength and staying power as two glass chips laid over the picture's bottom edge.
const FragranceChips: React.FC<{ details: PerfumeDetails }> = ({ details: d }) => {
  const chip = 'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/90 backdrop-blur-sm shadow-xs text-xs font-bold text-[#533d6b]';
  return (
    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-2">
      <span className={chip}>
        <Droplets className="w-3.5 h-3.5 text-[#9d84b7]" />
        {d.concentration} <span className="font-semibold text-[#7b757e]">{CONCENTRATION_NAME[d.concentration]}</span>
      </span>
      <span className={chip}>
        <Clock className="w-3.5 h-3.5 text-[#9d84b7]" />
        Lasts {d.hoursMin === d.hoursMax ? d.hoursMin : `${d.hoursMin}–${d.hoursMax}`} hours
      </span>
    </div>
  );
};

// What it is inspired by, and the one-line pitch.
const FragranceBox: React.FC<{ details: PerfumeDetails }> = ({ details: d }) => (
  <div className="shrink-0 rounded-2xl border border-[#e3d2f3] bg-gradient-to-br from-[#f8f1fd] to-[#fff4ea] px-4 py-3 space-y-1.5">
    <p className="flex flex-wrap items-baseline gap-x-2 [overflow-wrap:anywhere]">
      <span className="text-xs font-semibold text-[#7b757e]">Inspired by</span>
      <span className="font-serif-display text-xl font-bold leading-snug text-[#2d2438]">{d.inspiredBy}</span>
    </p>
    {d.tagline && (
      <p className="flex items-start gap-2 text-sm italic leading-snug text-[#533d6b] [overflow-wrap:anywhere]">
        <Sparkles className="w-4 h-4 shrink-0 mt-0.5 text-[#d4af37]" />
        {d.tagline}
      </p>
    )}
  </div>
);

const NOTE_ROWS = [
  { key: 'top', label: 'Top', hint: 'opening', dot: 'bg-[#f2b880]', chip: 'bg-[#fff0e0] text-[#8a5a1c] border-[#f3d9b8]' },
  { key: 'heart', label: 'Heart', hint: 'core', dot: 'bg-[#b793d6]', chip: 'bg-[#f3e8fb] text-[#533d6b] border-[#e3d2f3]' },
  { key: 'base', label: 'Base', hint: 'lasting', dot: 'bg-[#8a6a52]', chip: 'bg-[#ece4dc] text-[#5a4636] border-[#dacbbd]' },
] as const;

// The notes box: top, heart and base notes as coloured chips. Rows with no notes are left out; no notes at all, no box.
const NotesBox: React.FC<{ notes: PerfumeNotes }> = ({ notes }) => {
  const rows = NOTE_ROWS.filter((r) => notes[r.key].length > 0);
  if (rows.length === 0) return null;
  return (
    <div className="shrink-0 rounded-2xl border border-[#e6e2dc] bg-[#fdfaf6] px-4 py-3 space-y-2.5">
      <p className="text-xs font-semibold text-[#7b757e]">Fragrance notes</p>
      {rows.map((r) => (
        <div key={r.key} className="grid grid-cols-[3.75rem_minmax(0,1fr)] gap-3 items-start" title={r.hint}>
          <div className="flex items-center gap-2 pt-1">
            <span className={`w-2 h-2 rounded-full shrink-0 ${r.dot}`} aria-hidden />
            <p className="text-xs font-bold leading-none text-[#2d2438]">{r.label}</p>
          </div>
          <ul className="flex flex-wrap gap-1.5" aria-label={`${r.label} notes`}>
            {notes[r.key].map((n, i) => (
              <li key={i} className={`px-2.5 py-0.5 rounded-full border text-xs font-semibold [overflow-wrap:anywhere] ${r.chip}`}>{n}</li>
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
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2d2438]/30 backdrop-blur-sm" onClick={onClose}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          ref={dialogRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={product.name}
          onClick={(e) => e.stopPropagation()}
          // 1296px wide on big screens; the text column is half the width, so the square picture is about 653px tall.
          className="relative w-full max-w-[81rem] outline-hidden bg-white rounded-3xl overflow-hidden border border-white shadow-xl grid lg:grid-cols-[minmax(0,1fr)_49.6%]"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-white/85 text-[#7b757e] hover:text-[#695282] hover:bg-white shadow-xs transition-all"
          >
            <X className="w-4 h-4" />
          </button>
          {/* Always square, so the picture is never stretched however long the text is. */}
          <div className="relative aspect-square bg-[#f7f3ed]">
            <ProductImage product={product} />
            {product.details && <FragranceChips details={product.details} />}
          </div>
          {/* Wide screens: this column is exactly as tall as the picture (the content is laid over it), so the pop-up never
              grows with the text; the description scrolls instead. Narrow screens: stacked, description height capped. */}
          <div className="relative min-w-0">
          <div className="p-6 sm:p-8 flex flex-col gap-4 lg:p-6 lg:gap-3 lg:absolute lg:inset-0">
            <div className="shrink-0 flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 lg:pr-10">
              <h2 className="font-serif-display text-3xl font-bold leading-tight min-w-0 flex-1 basis-48 pr-8 lg:pr-0 [overflow-wrap:anywhere]">{product.name}</h2>
              <p className="text-xl font-bold text-[#695282] shrink-0">{formatPrice(product.priceCents)}</p>
            </div>
            {product.details && <FragranceBox details={product.details} />}
            {/* Wide screens: the notes box and the description scroll together under the fixed perfume box. Narrow screens:
                the page scrolls and only the description is height-capped, as before. */}
            {(product.details?.notes || description) && (
              <div
                className="flex flex-col gap-4 min-h-0 lg:flex-1 lg:overflow-y-auto [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:#c9b6dc_transparent]"
                tabIndex={0}
                aria-label="Product details"
              >
                {product.details?.notes && <NotesBox notes={product.details.notes} />}
                {/* Already cleaned by the server (allow-listed tags only), so it is safe to show as HTML. */}
                {description && (
                  <div
                    className="rich-text text-sm text-[#4a454e] leading-relaxed overflow-y-auto max-h-[max(6rem,20vh)] lg:max-h-none lg:overflow-visible [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:#c9b6dc_transparent]"
                    aria-label="Product description"
                    dangerouslySetInnerHTML={{ __html: description }}
                  />
                )}
              </div>
            )}
            <div className="mt-auto pt-1 space-y-1.5 shrink-0">
              <button
                disabled
                className="w-full py-4 lg:py-3.5 rounded-2xl bg-[#c9c3cc] text-white font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2"
              >
                <ShoppingBag className="w-4 h-4" />
                {product.inStock ? 'ADD TO CART' : 'SOLD OUT'}
              </button>
              {product.inStock && <p className="text-xs text-center text-[#7b757e]">Ordering opens soon.</p>}
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
};

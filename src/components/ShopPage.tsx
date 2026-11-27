import React, { useEffect, useState } from 'react';
import { ArrowLeft, ShoppingBag, Sparkles, X } from 'lucide-react';
import type { Product } from '../types';
import { formatPrice } from '../money';
import { ScoopVerseLogo } from './ScoopVerseLogo';

// /shop: every product the admin has made visible. Adding to cart comes in the next phase.
export const ShopPage: React.FC = () => {
  const [products, setProducts] = useState<Product[] | null>(null);
  const [error, setError] = useState(false);
  const [open, setOpen] = useState<Product | null>(null);

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
                    <p className="text-sm font-semibold text-[#695282]">{formatPrice(p.priceCents)}</p>
                  </div>
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>

      {open && <ProductDetail product={open} onClose={() => setOpen(null)} />}
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

const ProductDetail: React.FC<{ product: Product; onClose: () => void }> = ({ product, onClose }) => {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-[#2d2438]/30 backdrop-blur-sm" onClick={onClose}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label={product.name}
          onClick={(e) => e.stopPropagation()}
          // 1296px wide on big screens; the text column is half the width, so the square picture is about 653px tall.
          className="relative w-full max-w-[81rem] bg-white rounded-3xl overflow-hidden border border-white shadow-xl grid lg:grid-cols-[minmax(0,1fr)_49.6%]"
        >
          <button
            onClick={onClose}
            aria-label="Close"
            className="absolute top-3 right-3 z-10 w-9 h-9 rounded-full flex items-center justify-center bg-white/85 text-[#7b757e] hover:text-[#695282] hover:bg-white shadow-xs transition-all"
          >
            <X className="w-4 h-4" />
          </button>
          {/* Always square, so the picture is never stretched however long the text is. */}
          <div className="aspect-square bg-[#f7f3ed]">
            <ProductImage product={product} />
          </div>
          {/* Wide screens: this column is exactly as tall as the picture (the content is laid over it), so the pop-up never
              grows with the text; the description scrolls instead. Narrow screens: stacked, description height capped. */}
          <div className="relative min-w-0">
          <div className="p-6 sm:p-8 flex flex-col gap-4 lg:absolute lg:inset-0">
            <div className="space-y-2 shrink-0">
              <h2 className="font-serif-display text-3xl font-bold leading-tight pr-8 lg:pr-0 [overflow-wrap:anywhere]">{product.name}</h2>
              <p className="text-xl font-bold text-[#695282]">{formatPrice(product.priceCents)}</p>
            </div>
            {/* Already cleaned by the server (allow-listed tags only), so it is safe to show as HTML. */}
            {product.description && (
              <div
                className="rich-text text-sm text-[#4a454e] leading-relaxed min-h-0 overflow-y-auto max-h-[max(6rem,20vh)] lg:max-h-none lg:flex-1 [scrollbar-gutter:stable] [scrollbar-width:thin] [scrollbar-color:#c9b6dc_transparent]"
                tabIndex={0}
                aria-label="Product description"
                dangerouslySetInnerHTML={{ __html: product.description }}
              />
            )}
            <div className="mt-auto pt-2 space-y-2 shrink-0">
              <button
                disabled
                className="w-full py-4 rounded-2xl bg-[#c9c3cc] text-white font-bold text-sm cursor-not-allowed flex items-center justify-center gap-2"
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

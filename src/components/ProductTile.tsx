import React from 'react';
import { Sparkles } from 'lucide-react';
import type { Product } from '../types';
import { formatPrice } from '../money';

interface Props {
  product: Product;
  // A link (the Home page opens the shop at this product) or a button (the Shop page opens its pop-up).
  href?: string;
  onOpen?: () => void;
  // Near the top of the page: load the picture right away instead of when it scrolls into view.
  eager?: boolean;
}

// One product in a grid: the picture, the name, a line for perfumes, the price.
export const ProductTile: React.FC<Props> = ({ product: p, href, onOpen, eager }) => {
  const body = (
    <>
      <span className="relative block aspect-square overflow-hidden rounded-card bg-paper-2">
        {p.imageUrl ? (
          <img
            src={p.imageUrl}
            alt={p.name}
            loading={eager ? "eager" : "lazy"}
            className={`h-full w-full object-cover ${p.inStock ? '' : 'opacity-60'}`}
          />
        ) : (
          <span className="grid h-full w-full place-items-center text-accent">
            <Sparkles className="h-10 w-10" aria-hidden />
          </span>
        )}
        {!p.inStock && <span className="absolute inset-x-0 bottom-0 bg-paper px-3 py-2 text-sm font-semibold text-ink">Sold out</span>}
      </span>
      <span className="mt-4 block font-display text-xl font-bold leading-snug [overflow-wrap:anywhere] line-clamp-2 group-hover:underline">{p.name}</span>
      {p.details && <span className="mt-0.5 block text-sm text-muted [overflow-wrap:anywhere] line-clamp-1">Inspired by {p.details.inspiredBy}</span>}
      <span className="mt-1.5 flex items-baseline gap-3 font-semibold text-accent-deep">
        <span className="num">{formatPrice(p.priceCents)}</span>
        {p.details && <span className="text-sm font-medium text-muted">{p.details.concentration}</span>}
      </span>
    </>
  );
  const cls = 'group block w-full rounded-card text-left';
  return href ? (
    <a href={href} className={`${cls} no-underline`}>
      {body}
    </a>
  ) : (
    <button type="button" onClick={onOpen} className={cls}>
      {body}
    </button>
  );
};

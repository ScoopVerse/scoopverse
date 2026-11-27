import React from 'react';
import { Sparkles } from 'lucide-react';
import type { Product } from '../types';
import { formatPrice } from '../money';
import { FramedImage } from './FramedImage';

interface Props {
  product: Product;
  // A link (the Home page opens the shop at this product) or a button (the Shop page opens its pop-up).
  href?: string;
  onOpen?: () => void;
  // Near the top of the page: load the picture right away instead of when it scrolls into view.
  eager?: boolean;
  // The shop owner is live right now: scoops show a "Live now" badge.
  live?: boolean;
}

// One product in a grid: the picture, the name, a line for perfumes, the price.
export const ProductTile: React.FC<Props> = ({ product: p, href, onOpen, eager, live }) => {
  const scoop = p.kind === 'scoop' ? p.details : null;
  const body = (
    <>
      <span className="relative block aspect-square overflow-hidden rounded-card bg-paper-2">
        {p.imageUrl ? (
          <FramedImage src={p.imageUrl} alt={p.name} eager={eager} className={p.inStock ? '' : 'opacity-60'} />
        ) : (
          <span className="grid h-full w-full place-items-center text-accent">
            <Sparkles className="h-10 w-10" aria-hidden />
          </span>
        )}
        {live && p.kind === 'scoop' && p.inStock && (
          <span className="absolute left-3 top-3 rounded-full bg-paper px-3 py-1 text-xs font-bold text-accent-deep">Live now</span>
        )}
        {!p.inStock && <span className="absolute inset-x-0 bottom-0 bg-paper px-3 py-2 text-sm font-semibold text-ink">Sold out</span>}
      </span>
      <span className="mt-4 block font-display text-xl font-bold leading-snug [overflow-wrap:anywhere] line-clamp-2 group-hover:underline">{p.name}</span>
      {p.kind === 'perfume' && p.details && <span className="mt-0.5 block text-sm text-muted [overflow-wrap:anywhere] line-clamp-1">Inspired by {p.details.inspiredBy}</span>}
      {scoop && (
        <span className="mt-0.5 block text-sm text-muted line-clamp-1">
          {scoop.beadsMin === scoop.beadsMax ? scoop.beadsMin : `${scoop.beadsMin}–${scoop.beadsMax}`} perfumes
        </span>
      )}
      <span className="mt-1.5 flex items-baseline gap-3 font-semibold text-accent-deep">
        <span className="num">{formatPrice(scoop ? scoop.offlinePriceCents : p.priceCents)}</span>
        {p.kind === 'perfume' && p.details && <span className="text-sm font-medium text-muted">{p.details.concentration}</span>}
        {scoop && <span className="num text-sm font-medium text-muted">{formatPrice(p.priceCents)} live</span>}
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

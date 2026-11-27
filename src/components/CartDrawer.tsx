import React, { useEffect, useRef, useState } from 'react';
import { Minus, Plus, ShoppingBag, X } from 'lucide-react';
import type { Cart, CartItem } from '../types';
import { formatPrice } from '../money';
import { FramedImage } from './FramedImage';

interface Props {
  cart: Cart | null;
  onClose: () => void;
  onQuantity: (id: string, quantity: number) => Promise<string | null>;
  onRemove: (id: string) => Promise<string | null>;
}

const MODE_NAME = { live: 'Go Live order', offline: 'Offline order', standard: '' };
const round = 'inline-flex h-11 w-11 items-center justify-center rounded-full border border-rule text-ink-2 transition-colors hover:border-accent hover:text-accent disabled:opacity-40 disabled:hover:border-rule disabled:hover:text-ink-2';

// The cart, sliding over the shop from the right. Esc, the dark area or the X close it; Tab stays inside.
export const CartDrawer: React.FC<Props> = ({ cart, onClose, onQuantity, onRemove }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = ref.current!;
    panel.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab') return;
      const items = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href]')];
      if (items.length === 0) return e.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const scroll = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = scroll;
      opener?.focus();
    };
  }, [onClose]);

  const run = async (job: Promise<string | null>) => setError(await job);
  const items = cart?.items ?? [];

  return (
    <div className="fixed inset-0 z-50 bg-ink/40" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Your cart"
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-paper shadow-xl outline-none"
      >
        <div className="flex items-center justify-between gap-4 border-b border-rule px-6 py-4">
          <h2 className="text-2xl">Your cart</h2>
          <button type="button" onClick={onClose} aria-label="Close cart" className={round}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-1 flex-col items-start gap-4 px-6 py-10">
            <ShoppingBag className="h-8 w-8 text-accent" aria-hidden />
            <p className="text-ink-2">{cart ? 'Your cart is empty.' : 'Loading your cart…'}</p>
            {cart && (
              <button type="button" onClick={onClose} className="btn btn-quiet">
                Keep shopping
              </button>
            )}
          </div>
        ) : (
          <ul className="flex-1 divide-y divide-rule overflow-y-auto px-6">
            {items.map((i) => (
              <Line key={i.id} item={i} onQuantity={(q) => run(onQuantity(i.id, q))} onRemove={() => run(onRemove(i.id))} />
            ))}
          </ul>
        )}

        {items.length > 0 && cart && (
          <div className="space-y-3 border-t border-rule px-6 py-5">
            {error && (
              <p role="alert" className="text-sm text-error">
                {error}
              </p>
            )}
            <p className="flex items-baseline justify-between">
              <span className="font-semibold">Subtotal</span>
              <span className="num text-xl font-semibold text-accent-deep">{formatPrice(cart.subtotalCents)}</span>
            </p>
            <p className="text-sm text-muted">Shipping is added at checkout.</p>
            <button type="button" disabled className="btn btn-primary w-full">
              Checkout opens soon
            </button>
            {!cart.canCheckout && <p className="text-sm text-error">Fix the items marked above before checking out.</p>}
          </div>
        )}
      </div>
    </div>
  );
};

const Line: React.FC<{ item: CartItem; onQuantity: (q: number) => void; onRemove: () => void }> = ({ item: i, onQuantity, onRemove }) => (
  <li className="flex gap-4 py-5">
    <span className="relative block h-20 w-20 shrink-0 overflow-hidden rounded-card bg-paper-2">
      {i.imageUrl && <FramedImage src={i.imageUrl} alt="" />}
    </span>
    <div className="min-w-0 flex-1 space-y-1">
      <p className="font-semibold [overflow-wrap:anywhere]">{i.name}</p>
      {MODE_NAME[i.mode] && <p className="text-sm text-muted">{MODE_NAME[i.mode]}</p>}
      {i.problem && (
        <p role="alert" className="text-sm font-semibold text-error">
          {i.problem}
        </p>
      )}
      <p className="num text-sm text-ink-2">{formatPrice(i.unitCents)} each</p>
      <div className="flex items-center gap-1 pt-1">
        <button type="button" onClick={() => onQuantity(i.quantity - 1)} disabled={i.quantity <= 1} aria-label={`One less ${i.name}`} className={round}>
          <Minus className="h-4 w-4" aria-hidden />
        </button>
        <span className="num w-8 text-center font-semibold" aria-label={`Quantity ${i.quantity}`}>
          {i.quantity}
        </span>
        <button type="button" onClick={() => onQuantity(i.quantity + 1)} disabled={i.quantity >= 10} aria-label={`One more ${i.name}`} className={round}>
          <Plus className="h-4 w-4" aria-hidden />
        </button>
        <button type="button" onClick={onRemove} className="ml-auto inline-flex min-h-11 items-center px-2 text-sm font-semibold text-muted underline-offset-4 hover:text-error hover:underline">
          Remove
        </button>
      </div>
    </div>
    <p className="num shrink-0 font-semibold text-accent-deep">{formatPrice(i.unitCents * i.quantity)}</p>
  </li>
);

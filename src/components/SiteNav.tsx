import React, { useEffect, useRef } from 'react';
import { ShoppingBag } from 'lucide-react';
import type { User } from '../types';
import logoImg from '../assets/images/regenerated_image_1785774461998.png';

interface Props {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  // Which page this bar is on, so its link is marked.
  current?: 'shop';
  // Shop only: the cart button and how many items are in it.
  onCart?: () => void;
  cartCount?: number;
}

// The top bar of the storefront (Home and Shop): the logo, the Shop link and the account.
export const SiteNav: React.FC<Props> = ({ user, onLogin, onLogout, current, onCart, cartCount }) => {
  // The cart button pops a little whenever its count goes up (skipped with reduced motion).
  const cartRef = useRef<HTMLButtonElement>(null);
  const lastCount = useRef(cartCount ?? 0);
  useEffect(() => {
    const now = cartCount ?? 0;
    if (now > lastCount.current && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      cartRef.current?.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.3)' }, { transform: 'scale(1)' }], { duration: 350, easing: 'ease-out' });
    }
    lastCount.current = now;
  }, [cartCount]);

  return (
  <header className="sticky top-0 z-40 border-b border-rule bg-paper">
    <div className="page-wrap flex h-(--nav-height) items-center justify-between gap-4">
      <a href="/" aria-label="ScoopVerse, home" className="shrink-0 rounded-card">
        <img src={logoImg} alt="ScoopVerse" className="-my-3 h-20 w-auto sm:h-24" />
      </a>
      <nav aria-label="Main" className="flex items-center gap-2 sm:gap-5">
        <a
          href="/shop"
          aria-current={current === 'shop' ? 'page' : undefined}
          className="inline-flex min-h-11 items-center border-b-2 border-transparent px-1 font-semibold text-ink-2 transition-colors hover:text-accent aria-[current=page]:border-accent aria-[current=page]:text-ink"
        >
          Shop
        </a>
        {onCart && (
          <button ref={cartRef} data-cart-button type="button" onClick={onCart} aria-label={cartCount ? `Cart, ${cartCount} items` : 'Cart'} className="relative inline-flex h-11 w-11 items-center justify-center rounded-full text-ink-2 transition-colors hover:text-accent">
            <ShoppingBag className="h-5 w-5" aria-hidden />
            {cartCount ? (
              <span className="num absolute right-0 top-0 grid h-5 min-w-5 place-items-center rounded-full bg-accent px-1 text-xs font-semibold text-accent-ink">{cartCount}</span>
            ) : null}
          </button>
        )}
        {user ? (
          <>
            <span className="hidden max-w-48 truncate text-sm text-ink-2 md:inline">{user.name}</span>
            <button onClick={onLogout} className="btn btn-quiet">
              Log out
            </button>
          </>
        ) : (
          <button onClick={onLogin} className="btn btn-quiet">
            Log in
          </button>
        )}
      </nav>
    </div>
  </header>
  );
};

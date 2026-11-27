import React from 'react';
import type { User } from '../types';
import logoImg from '../assets/images/regenerated_image_1785774461998.png';

interface Props {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
  // Which page this bar is on, so its link is marked.
  current?: 'shop';
}

// The top bar of the storefront (Home and Shop): the logo, the Shop link and the account.
export const SiteNav: React.FC<Props> = ({ user, onLogin, onLogout, current }) => (
  <header className="sticky top-0 z-40 border-b border-rule bg-paper">
    <div className="page-wrap flex h-(--nav-height) items-center justify-between gap-4">
      <a href="/" aria-label="ScoopVerse, home" className="shrink-0 rounded-card">
        <img src={logoImg} alt="ScoopVerse" className="h-12 w-auto sm:h-14" />
      </a>
      <nav aria-label="Main" className="flex items-center gap-2 sm:gap-5">
        <a
          href="/shop"
          aria-current={current === 'shop' ? 'page' : undefined}
          className="inline-flex min-h-11 items-center border-b-2 border-transparent px-1 font-semibold text-ink-2 transition-colors hover:text-accent aria-[current=page]:border-accent aria-[current=page]:text-ink"
        >
          Shop
        </a>
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

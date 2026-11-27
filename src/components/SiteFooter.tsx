import React, { useState } from 'react';
import { SocialModal } from './SocialModal';
import logoImg from '../assets/images/regenerated_image_1785774461998.png';

// The foot of the storefront: the logo, the pages, and the Instagram and TikTok windows.
export const SiteFooter: React.FC = () => {
  const [platform, setPlatform] = useState<'instagram' | 'tiktok' | null>(null);
  const social = 'inline-flex min-h-11 items-center gap-2 font-semibold text-ink-2 transition-colors hover:text-accent';

  return (
    <footer className="mt-(--section-gap-s) border-t border-rule">
      <div className="page-wrap grid gap-10 py-16 md:grid-cols-12">
        <div className="space-y-4 md:col-span-5">
          <img src={logoImg} alt="ScoopVerse" className="-my-3 h-28 w-auto" />
          <p className="text-ink-2">Mystery Fragrance Scoops</p>
        </div>
        <nav aria-label="Footer" className="md:col-span-3">
          <ul className="space-y-1">
            <li>
              <a href="/" className={social}>Home</a>
            </li>
            <li>
              <a href="/shop" className={social}>Shop</a>
            </li>
          </ul>
        </nav>
        <div className="md:col-span-4">
          <p className="mb-2 font-semibold">Catch us on TikTok and IG</p>
          <ul className="space-y-1">
            <li>
              <button onClick={() => setPlatform('instagram')} className={social}>
                <i className="fa-brands fa-instagram w-5 text-center text-lg" aria-hidden />
                Instagram
              </button>
            </li>
            <li>
              <button onClick={() => setPlatform('tiktok')} className={social}>
                <i className="fa-brands fa-tiktok w-5 text-center text-lg" aria-hidden />
                TikTok
              </button>
            </li>
          </ul>
        </div>
      </div>
      <div className="page-wrap pb-10">
        <p className="text-sm text-muted">© 2024 ScoopVerse Inc. Est. 2023</p>
      </div>
      <SocialModal platform={platform} onClose={() => setPlatform(null)} />
    </footer>
  );
};

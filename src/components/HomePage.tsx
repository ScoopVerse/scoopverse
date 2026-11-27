import React, { useEffect, useState } from 'react';
import type { Product, User } from '../types';
import { formatPrice } from '../money';
import { SiteNav } from './SiteNav';
import { SiteFooter } from './SiteFooter';
import { ProductTile } from './ProductTile';
import { LegendGrid, LegendViewer, OneMoreBanner } from './Legend';
import { useLive } from '../useLive';

interface Props {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

// Why a mystery scoop, in the shop's own words.
const REASONS = [
  {
    title: 'Cost Savings',
    text: "Buying a full-size perfume can be expensive, especially if you’re not sure you’ll love the scent.",
  },
  {
    title: 'Discovery',
    text: 'Our Mystery Scoops let you discover a variety of fragrances at a much lower cost. Instead of committing to one full bottle, you can experience multiple scents and find your favorites before deciding on a larger purchase.',
  },
  {
    title: 'The Fun of the Reveal',
    text: "It’s a fun, affordable way to explore new fragrances while enjoying the excitement of a surprise reveal!",
  },
];

// How a live scoop goes, start to finish.
const STEPS = [
  { title: 'Choose your scoops', text: 'Pick 1, 3 or 5 scoops. We scoop them in a row, so more scoops means more perfumes.' },
  { title: 'We scoop it live', text: 'Join our TikTok or IG live and we scoop on the spot. Prefer offline? It costs less, but a video isn’t promised.' },
  { title: 'Try, then decide', text: 'Every bead is a 2 ml decant to wear and test. Then you know which full bottle to get.' },
];

// "/": what a mystery scoop is, then the scoops themselves at the foot.
export const HomePage: React.FC<Props> = ({ user, onLogin, onLogout }) => {
  const [scoops, setScoops] = useState<Product[]>([]);
  const live = useLive();
  // The tapped legend label (position 0 to 15), or null when the enlarged view is closed.
  const [viewer, setViewer] = useState<number | null>(null);

  useEffect(() => {
    document.title = 'ScoopVerse — Mystery Fragrance Scoops';
    fetch('/api/products')
      .then((res) => (res.ok ? res.json() : { products: [] }))
      .then((data) => setScoops((data.products as Product[]).filter((p) => p.kind === 'scoop').sort((a, b) => a.priceCents - b.priceCents).slice(0, 6)))
      .catch(() => {});
  }, []);

  const featured = scoops.find((p) => p.imageUrl);

  return (
    <div className="site min-h-screen selection:bg-accent/20">
      <SiteNav user={user} onLogin={onLogin} onLogout={onLogout} />

      <main>
        <section className="page-wrap grid min-h-[calc(100svh-var(--nav-height))] items-center gap-x-16 gap-y-10 py-12 lg:grid-cols-2">
          <div className="space-y-6">
            <h1 className="max-w-[14ch]">Can’t smell it online? Scoop it.</h1>
            <p className="lead">Live blind scoops let you try scents before buying a bottle.</p>
            <div className="flex flex-wrap items-center gap-x-6 gap-y-3 pt-2">
              <a href="/shop" className="btn btn-primary">
                Shop the scoops
              </a>
              <a href="#legend" className="font-semibold text-accent hover:text-accent-deep">
                See the 15 scents
              </a>
            </div>
          </div>
          {featured && (
            <a href={`/shop#${featured.id}`} className="group block no-underline">
              <img
                src={featured.imageUrl!}
                alt={featured.name}
                fetchPriority="high"
                className="aspect-square w-full rounded-card object-cover"
              />
              <span className="mt-3 flex items-baseline justify-between gap-4 border-t border-rule pt-3 text-sm">
                <span className="font-semibold text-ink group-hover:underline">{featured.name}</span>
                <span className="num font-semibold text-accent-deep">{formatPrice(featured.priceCents)}</span>
              </span>
            </a>
          )}
        </section>

        <section id="how" className="scroll-mt-(--nav-height) py-(--section-gap-s)">
          <div className="page-wrap">
            <h2 className="max-w-[16ch]">How a live scoop works</h2>
            <ol className="mt-12 grid gap-x-8 gap-y-10 md:grid-cols-3">
              {STEPS.map((s, i) => (
                <li key={s.title} className="space-y-3 border-t-2 border-ink pt-5">
                  <span className="num font-display text-section font-bold leading-none text-accent">{i + 1}</span>
                  <h3>{s.title}</h3>
                  <p className="text-ink-2">{s.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        <section id="legend" aria-labelledby="legend-heading" className="scroll-mt-(--nav-height) bg-ink py-(--section-gap-s) text-paper">
          <div className="page-wrap">
            <div className="mb-12 max-w-[52ch] space-y-3">
              <h2 id="legend-heading" className="text-paper">Meet the 15</h2>
              <p className="lead text-paper/80">Any of these could land in your scoop. Tap a label to see it bigger.</p>
            </div>
            <LegendGrid onPick={setViewer} />
            <div className="mt-12 grid items-center gap-x-12 gap-y-4 border-t border-paper/20 pt-10 md:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
              <OneMoreBanner onPick={setViewer} />
              <p className="max-w-[44ch] text-paper/80">
                The pot also has blank filler beads and the bonus +1 bead. Each +1 bead earns you one more scoop, taken after your scoops from a refreshed bowl.
              </p>
            </div>
          </div>
        </section>

        <section aria-labelledby="scoops-heading" className="py-(--section-gap-s)">
          <div className="page-wrap">
            <div className="mb-12 flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
              <h2 id="scoops-heading">Choose your scoop</h2>
              <a href="/shop" className="font-semibold text-accent hover:text-accent-deep">
                See the whole shop
              </a>
            </div>
            {scoops.length > 0 ? (
              <ul className="grid gap-x-8 gap-y-12 sm:grid-cols-2 lg:grid-cols-3">
                {scoops.map((p) => (
                  <li key={p.id}>
                    <ProductTile product={p} href={`/shop#${p.id}`} eager live={live} />
                  </li>
                ))}
              </ul>
            ) : (
              <p className="max-w-[52ch] text-ink-2">Our scoops are on their way. In the meantime, have a look around the shop.</p>
            )}
          </div>
        </section>

        <section id="why" className="scroll-mt-(--nav-height) bg-paper-2 py-(--section-gap-s)">
          <div className="page-wrap grid gap-x-16 gap-y-10 lg:grid-cols-12">
            <h2 className="lg:col-span-4">Why Mystery Scoops?</h2>
            <ul className="divide-y divide-rule border-y border-rule lg:col-span-8">
              {REASONS.map((r) => (
                <li key={r.title} className="grid gap-x-10 gap-y-2 py-8 md:grid-cols-[2fr_3fr]">
                  <h3>{r.title}</h3>
                  <p className="text-ink-2">{r.text}</p>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </main>

      <SiteFooter />
      {viewer !== null && <LegendViewer index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, X, ZoomIn } from 'lucide-react';
import { LEGEND, ONE_MORE_SCOOP, SCENTS } from '../legend';
import type { LegendEntry } from '../legend';

const altOf = (e: LegendEntry) => (e.inspiredBy ? `${e.name}, inspired by ${e.inspiredBy}` : e.name);

// A label that opens the enlarged view when tapped.
const LabelButton: React.FC<{ entry: LegendEntry; index: number; onPick: (i: number) => void; className?: string }> = ({ entry, index, onPick, className = '' }) => (
  <button
    type="button"
    onClick={() => onPick(index)}
    aria-label={`${altOf(entry)}. Tap to enlarge.`}
    className={`group relative block w-full cursor-pointer rounded-card transition-transform duration-200 ease-out hover:scale-[1.07] focus-visible:scale-[1.07] motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:focus-visible:scale-100 ${className}`}
  >
    <img src={entry.banner} alt="" width={900} height={208} loading="lazy" className="h-auto w-full" />
    {/* A magnifier badge on hover or keyboard focus, so it reads on the dark background (touch screens never hover). */}
    <span className="pointer-events-none absolute right-1 top-1 flex h-8 w-8 items-center justify-center rounded-full bg-paper text-ink opacity-0 shadow-sm transition-opacity duration-200 group-hover:opacity-100 group-focus-visible:opacity-100 motion-reduce:transition-none">
      <ZoomIn className="h-4 w-4" aria-hidden />
    </span>
  </button>
);

// All 15 scent labels as a grid; tapping one calls onPick with its position.
export const LegendGrid: React.FC<{ onPick: (i: number) => void; className?: string }> = ({ onPick, className = '' }) => (
  <ul className={`grid gap-x-6 gap-y-5 sm:grid-cols-2 lg:grid-cols-3 ${className}`}>
    {SCENTS.map((e, i) => (
      <li key={e.name}>
        <LabelButton entry={e} index={i} onPick={onPick} />
      </li>
    ))}
  </ul>
);

// The "One More Scoop" label (position 15, after the 15 scents).
export const OneMoreBanner: React.FC<{ onPick: (i: number) => void; className?: string }> = ({ onPick, className = '' }) => (
  <LabelButton entry={ONE_MORE_SCOOP} index={15} onPick={onPick} className={className} />
);

// One label big and sharp, with its name and "Inspired by" as normal text underneath. Arrows or the arrow keys move on.
export const LegendViewer: React.FC<{ index: number; onIndex: (i: number) => void; onClose: () => void }> = ({ index, onIndex, onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const e = LEGEND[index];
  const prev = () => onIndex((index + LEGEND.length - 1) % LEGEND.length);
  const next = () => onIndex((index + 1) % LEGEND.length);

  // Focus goes in on open and back to the tapped label on close.
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    ref.current?.focus();
    return () => opener?.focus();
  }, []);

  const onKeyDown = (ev: React.KeyboardEvent) => {
    ev.stopPropagation(); // keep any pop-up underneath from reacting too
    if (ev.key === 'Escape') return onClose();
    if (ev.key === 'ArrowLeft') return prev();
    if (ev.key === 'ArrowRight') return next();
    if (ev.key !== 'Tab') return;
    const items = ref.current!.querySelectorAll<HTMLElement>('button');
    const first = items[0];
    const last = items[items.length - 1];
    if (ev.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      last.focus();
      ev.preventDefault();
    } else if (!ev.shiftKey && document.activeElement === last) {
      first.focus();
      ev.preventDefault();
    }
  };

  const nav = 'flex h-12 w-12 items-center justify-center rounded-full bg-paper text-ink-2 transition-colors hover:text-accent';
  return (
    <div
      className="fixed inset-0 z-[70] overflow-y-auto bg-ink/90"
      onClick={(ev) => {
        ev.stopPropagation(); // the legend window this may sit in must stay open
        onClose();
      }}
    >
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={e.name}
          onKeyDown={onKeyDown}
          onClick={(ev) => ev.stopPropagation()}
          className="relative w-full max-w-[1100px] space-y-5 outline-hidden"
        >
          <img src={e.large} alt={altOf(e)} width={1600} height={370} className="h-auto w-full" />
          <div className="space-y-1 px-2 text-center">
            <p className="font-display text-3xl font-bold text-paper [overflow-wrap:anywhere]">{e.name}</p>
            {e.inspiredBy && <p className="text-xl text-paper/90 [overflow-wrap:anywhere]">Inspired by {e.inspiredBy}</p>}
          </div>
          <div className="flex items-center justify-center gap-5">
            <button type="button" onClick={prev} aria-label="Previous scent" className={nav}>
              <ChevronLeft className="h-5 w-5" aria-hidden />
            </button>
            <p className="num min-w-16 text-center text-paper/80" aria-live="polite">
              {index + 1} of {LEGEND.length}
            </p>
            <button type="button" onClick={next} aria-label="Next scent" className={nav}>
              <ChevronRight className="h-5 w-5" aria-hidden />
            </button>
            <button type="button" onClick={onClose} aria-label="Close" className={`${nav} ml-4`}>
              <X className="h-5 w-5" aria-hidden />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

// A row of the 15 beads, one button that opens the full legend.
export const LegendBeads: React.FC<{ onOpen: () => void }> = ({ onOpen }) => (
  <button
    type="button"
    onClick={onOpen}
    aria-label="See all 15 scents in the pot"
    className="group flex w-full shrink-0 flex-wrap items-center gap-x-3 gap-y-2 rounded-card text-left"
  >
    <span className="flex flex-wrap">
      {SCENTS.map((e, i) => (
        <img
          key={e.name}
          src={e.bead}
          alt=""
          width={80}
          height={80}
          className={`h-8 w-8 rounded-full border-2 border-paper bg-ink object-cover ${i > 0 ? '-ml-2' : ''}`}
        />
      ))}
    </span>
    <span className="text-sm font-semibold text-accent group-hover:text-accent-deep group-hover:underline">See all 15 scents</span>
  </button>
);

// The full legend over the pop-up. Esc or the close button closes just this; Tab stays inside.
export const LegendModal: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [viewer, setViewer] = useState<number | null>(null);
  useEffect(() => {
    ref.current?.focus();
  }, []);
  const onKeyDown = (e: React.KeyboardEvent) => {
    // Keep the pop-up underneath from also reacting to Esc or Tab.
    e.stopPropagation();
    if (e.key === 'Escape') return onClose();
    if (e.key !== 'Tab') return;
    // Focusable things inside: the close button and the scrolling list itself (the labels are focusable too, so only the ends matter).
    const items = ref.current!.querySelectorAll<HTMLElement>('button, [tabindex="0"]');
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && (document.activeElement === first || document.activeElement === ref.current)) {
      last.focus();
      e.preventDefault();
    } else if (!e.shiftKey && document.activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  };
  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-ink/70" onClick={onClose}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={ref}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label="The 15 scents in the pot"
          onKeyDown={onKeyDown}
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-5xl rounded-3xl bg-ink p-6 text-paper outline-hidden sm:p-8"
        >
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="absolute right-3 top-3 flex h-11 w-11 items-center justify-center rounded-full bg-paper text-ink-2 transition-colors hover:text-accent"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
          <h2 className="pr-12 font-display text-3xl font-bold text-paper">The 15 scents in the pot</h2>
          <p className="mt-2 max-w-[52ch] text-paper/80">Any of these could land in your scoop. Tap a label to see it bigger. The pot also has blank filler beads and the +1 bead below.</p>
          <div className="mt-6 max-h-[60vh] space-y-5 overflow-y-auto px-3 py-2[scrollbar-color:var(--color-muted)_transparent] [scrollbar-width:thin]" tabIndex={0} aria-label="Scent list">
            <LegendGrid onPick={setViewer} />
            <OneMoreBanner onPick={setViewer} className="max-w-sm" />
          </div>
        </div>
      </div>
      {viewer !== null && <LegendViewer index={viewer} onIndex={setViewer} onClose={() => setViewer(null)} />}
    </div>
  );
};

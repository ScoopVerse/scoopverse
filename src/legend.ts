// The 15 scents in the pot, plus the "One More Scoop" bead. Pictures live in src/assets/legend/: NN.webp and NN-large.webp
// are the label (the scent's name is written in the picture) at grid size and enlarged size, NN-bead.webp is just its bead.
// To change one, replace its files.
const banners = import.meta.glob('./assets/legend/[0-9][0-9].webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const larges = import.meta.glob('./assets/legend/[0-9][0-9]-large.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;
const beads = import.meta.glob('./assets/legend/[0-9][0-9]-bead.webp', { eager: true, query: '?url', import: 'default' }) as Record<string, string>;

export interface LegendEntry {
  name: string;
  inspiredBy: string | null; // null for the "One More Scoop" bead
  banner: string; // grid size
  large: string; // shown when a label is tapped
  bead: string;
}

const NAMES: [string, string | null][] = [
  ['Black Emotion', 'YSL Black Opium'],
  ['La Passion', 'Britney Spears Fantasy'],
  ['Liberty Life Manhattan', 'YSL Libre Intense'],
  ['Loveliness La Passione', 'Giorgio Armani Si Passione'],
  ['Loveliness Sensuelle', 'Giorgio Armani Si'],
  ['Acqua Di Mare', 'Giorgio Armani Acqua di Gioia'],
  ['Night Canyon', 'Giorgio Armani Code'],
  ['Out Of Order', 'Versace Eros'],
  ['Tempting Rumors Women', 'Jean Paul Gaultier Scandal'],
  ['My Flower', 'Gucci Flora'],
  ['Reve Eternal', 'Christian Dior Miss Dior Cherie'],
  ["Roman Empire L'Abssoluto", 'Valentino Born In Roma Intense'],
  ['Roman Empire Woman', 'Valentino Born In Roma'],
  ['Spartanian Lady', 'Paco Rabanne Olympea'],
  ['Wild Action', 'Christian Dior Sauvage'],
  ['One More Scoop', null],
];

const all: LegendEntry[] = NAMES.map(([name, inspiredBy], i) => {
  const id = String(i + 1).padStart(2, '0');
  return {
    name,
    inspiredBy,
    banner: banners[`./assets/legend/${id}.webp`],
    large: larges[`./assets/legend/${id}-large.webp`],
    bead: beads[`./assets/legend/${id}-bead.webp`],
  };
});

export const SCENTS = all.slice(0, 15);
export const ONE_MORE_SCOOP = all[15];
// All 16 in order (the 15 scents, then One More Scoop), for the tap-to-enlarge view.
export const LEGEND = all;

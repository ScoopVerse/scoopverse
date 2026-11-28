// Malaysia's 13 states and 3 federal territories, by ISO 3166-2:MY code (the same codes server/addresses.ts accepts).
export const STATES: { code: string; name: string }[] = [
  { code: 'MY-01', name: 'Johor' },
  { code: 'MY-02', name: 'Kedah' },
  { code: 'MY-03', name: 'Kelantan' },
  { code: 'MY-14', name: 'Kuala Lumpur' },
  { code: 'MY-15', name: 'Labuan' },
  { code: 'MY-04', name: 'Melaka' },
  { code: 'MY-05', name: 'Negeri Sembilan' },
  { code: 'MY-06', name: 'Pahang' },
  { code: 'MY-08', name: 'Perak' },
  { code: 'MY-09', name: 'Perlis' },
  { code: 'MY-07', name: 'Pulau Pinang' },
  { code: 'MY-16', name: 'Putrajaya' },
  { code: 'MY-12', name: 'Sabah' },
  { code: 'MY-13', name: 'Sarawak' },
  { code: 'MY-10', name: 'Selangor' },
  { code: 'MY-11', name: 'Terengganu' },
];

export const stateName = (code: string) => STATES.find((s) => s.code === code)?.name ?? code;

// Delivery is West Malaysia only for now: Sabah, Sarawak and Labuan are left out. Take a code out of this list to open it.
const EAST_MALAYSIA = ['MY-12', 'MY-13', 'MY-15'];
export const deliversTo = (state: string) => !EAST_MALAYSIA.includes(state);
export const WEST_ONLY_MESSAGE = 'Sorry, we only deliver to West Malaysia for now.';

// The state a postcode belongs to. The customer can't choose a state: the form shows this one and the server saves it.
// shortcut: these ranges are written from memory of Pos Malaysia's list, so a few border towns may be off, and a real
// postcode outside them is refused as "not recognised". Fix: load the official postcode list once that shows up.
const POSTCODE_RANGES: [state: string, from: number, to: number][] = [
  ['MY-01', 79000, 86999], // Johor
  ['MY-02', 5000, 9999], // Kedah
  ['MY-03', 15000, 18999], // Kelantan
  ['MY-04', 75000, 78999], // Melaka
  ['MY-05', 70000, 73999], // Negeri Sembilan
  ['MY-06', 25000, 28999], // Pahang
  ['MY-06', 39000, 39999], // Pahang (Cameron Highlands)
  ['MY-06', 49000, 49999], // Pahang (Bukit Fraser)
  ['MY-06', 69000, 69999], // Pahang (Genting Highlands)
  ['MY-07', 10000, 14999], // Pulau Pinang
  ['MY-08', 30000, 36999], // Perak
  ['MY-09', 1000, 2999], // Perlis
  ['MY-10', 40000, 48999], // Selangor
  ['MY-10', 63000, 68999], // Selangor (Cyberjaya, Sepang)
  ['MY-11', 20000, 24999], // Terengganu
  ['MY-12', 88000, 91999], // Sabah
  ['MY-13', 93000, 98999], // Sarawak
  ['MY-14', 50000, 60999], // Kuala Lumpur
  ['MY-15', 87000, 87999], // Labuan
  ['MY-16', 62000, 62999], // Putrajaya
];

// null when it isn't a 5-digit postcode we recognise.
export function stateForPostcode(postcode: string): string | null {
  if (!/^\d{5}$/.test(postcode)) return null;
  const n = Number(postcode);
  return POSTCODE_RANGES.find(([, from, to]) => n >= from && n <= to)?.[0] ?? null;
}

// "+60123456789" as the customer writes it: "0123456789".
export const nationalPhone = (phone: string) => phone.replace(/^\+60/, '0');

export type ActiveView = 'main' | 'simulator' | 'roadmap' | 'vip';

export interface User {
  id: string;
  email: string;
  name: string;
}

export interface Admin {
  id: string;
  email: string;
  name: string;
}

// The listing type. 'scoop' is reserved for later: the admin can't choose it yet.
export type ProductKind = 'perfume' | 'scoop' | 'other';

// The extra fields of a scoop listing (kind = 'scoop'). The product's price is the Live price.
export interface ScoopDetails {
  scoops: number;
  offlinePriceCents: number; // price for offline orders (no video guaranteed), never above the live price
  beadsMin: number; // about how many perfume beads (= 2 ml decants) the whole order gives; filler and +1 beads don't count
  beadsMax: number;
}

export type Gender = 'women' | 'men' | 'unisex';
export const GENDER_LABEL: Record<Gender, string> = { women: 'Women', men: 'Men', unisex: 'Unisex' };

// The extra fields of a perfume listing (kind = 'perfume').
export interface PerfumeDetails {
  inspiredBy: string; // e.g. "Versace Eros"
  concentration: 'EDP' | 'EDT';
  gender?: Gender; // missing on perfumes saved before it existed
  hoursMin: number; // how long it lasts, in hours
  hoursMax: number;
  tagline: string; // one line on who it suits; may be empty
  notes?: PerfumeNotes; // missing on perfumes saved before notes existed
}

// Fragrance notes: short names, any list may be empty.
export interface PerfumeNotes {
  top: string[];
  heart: string[];
  base: string[];
}

// What the public shop sees. The description comes only with the single-product request, not the list.
// The kind decides what "details" holds (null on older listings saved before the type had details).
export type KindDetails =
  | { kind: 'perfume'; details: PerfumeDetails | null }
  | { kind: 'scoop'; details: ScoopDetails | null }
  | { kind: 'other'; details: null };

export type Product = {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  inStock: boolean;
  imageUrl: string | null; // the cover picture
  images?: string[]; // every picture in order (cover first); only with the single-product request
} & KindDetails;

// The cropped part of a picture, in percent of the full picture.
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// One saved picture of a listing, as the admin sees it.
export interface AdminImage {
  id: string;
  url: string;
  hasOriginal: boolean; // the full photo is saved on the server (admin can re-crop it)
  crop: CropArea | null;
}

// What the admin sees: also the stock count, whether it's visible in the shop, and every picture (the first is the cover).
export type AdminProduct = {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  active: boolean;
  imageUrl: string | null; // the cover (first) picture
  images: AdminImage[];
} & KindDetails;

export type DeviceViewport = 'responsive' | 'desktop' | 'tablet' | 'mobile';

// The server's view of a customer's cart (see server/cart.ts). A line with a `problem` can't be bought as it stands.
export interface CartItem {
  id: string;
  productId: string;
  name: string;
  imageUrl: string | null;
  kind: string;
  mode: 'live' | 'offline' | 'standard';
  unitCents: number;
  quantity: number;
  problem: string | null;
}
export interface Cart {
  items: CartItem[];
  subtotalCents: number;
  count: number;
  canCheckout: boolean;
}

export interface ScentNote {
  id: string;
  name: string;
  category: 'Floral' | 'Gourmand' | 'Woody' | 'Fresh' | 'Amber';
  description: string;
  topNotes: string[];
  heartNotes: string[];
  baseNotes: string[];
  color: string;
  badge: string;
}

export interface RoadmapStep {
  id: number;
  title: string;
  status: 'completed' | 'in-progress' | 'upcoming';
  percentage: number;
  description: string;
  targetDate: string;
}

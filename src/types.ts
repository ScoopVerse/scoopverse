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

// The extra fields of a perfume listing (kind = 'perfume').
export interface PerfumeDetails {
  inspiredBy: string; // e.g. "Versace Eros"
  concentration: 'EDP' | 'EDT';
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
export interface Product {
  id: string;
  name: string;
  description?: string;
  priceCents: number;
  inStock: boolean;
  imageUrl: string | null;
  kind: ProductKind;
  details: PerfumeDetails | null;
}

// The cropped part of a picture, in percent of the full picture.
export interface CropArea {
  x: number;
  y: number;
  width: number;
  height: number;
}

// What the admin sees: also the stock count, whether it's visible in the shop, and the saved crop.
export interface AdminProduct {
  id: string;
  name: string;
  description: string;
  priceCents: number;
  stock: number;
  active: boolean;
  imageUrl: string | null;
  hasOriginal: boolean; // the full photo is saved on the server (admin can re-crop it)
  crop: CropArea | null;
  kind: ProductKind;
  details: PerfumeDetails | null;
}

export type DeviceViewport = 'responsive' | 'desktop' | 'tablet' | 'mobile';

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

export type ActiveView = 'main' | 'simulator' | 'roadmap' | 'vip';

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

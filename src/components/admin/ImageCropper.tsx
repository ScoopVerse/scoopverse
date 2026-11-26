import React, { useEffect, useState } from 'react';
import Cropper from 'react-easy-crop';
import { Check, X, ZoomIn, ZoomOut } from 'lucide-react';
import type { CropArea } from '../../types';

// The shop shows square pictures, so the crop is always a square.
interface Props {
  file: File; // the full photo
  initialArea: CropArea | null; // the crop used last time, so zoom and position come back as they were
  onCancel: () => void;
  onDone: (area: CropArea) => void;
}

// Drag to move, slider or scroll to zoom. "Use this crop" hands back the chosen area (in percent of the photo);
// the server does the actual cropping.
export const ImageCropper: React.FC<Props> = ({ file, initialArea, onCancel, onDone }) => {
  const [src, setSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [area, setArea] = useState<CropArea | null>(null);

  useEffect(() => {
    const url = URL.createObjectURL(file);
    setSrc(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  return (
    <div className="fixed inset-0 z-[60] overflow-y-auto bg-[#2d2438]/50 backdrop-blur-sm" onClick={onCancel}>
      <div className="min-h-full flex items-center justify-center p-4">
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Crop picture"
          onClick={(e) => e.stopPropagation()}
          className="relative w-full max-w-lg bg-white rounded-3xl p-6 sm:p-8 border border-white shadow-xl space-y-5"
        >
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close"
            className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#7b757e] hover:text-[#695282] hover:bg-[#efdbff]/50 transition-all"
          >
            <X className="w-4 h-4" />
          </button>
          <div className="space-y-1 pr-10">
            <h2 className="font-serif-display text-2xl font-bold">Crop picture</h2>
            <p className="text-sm text-[#7b757e]">Drag to move. The square is what shoppers will see.</p>
          </div>

          <div className="relative w-full aspect-square rounded-2xl overflow-hidden bg-[#2d2438]">
            {src && (
              <Cropper
                image={src}
                crop={crop}
                zoom={zoom}
                minZoom={1}
                maxZoom={4}
                aspect={1}
                initialCroppedAreaPercentages={initialArea ?? undefined}
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={(percent) => setArea(percent)}
              />
            )}
          </div>

          <div className="flex items-center gap-3">
            <ZoomOut className="w-4 h-4 text-[#7b757e] shrink-0" aria-hidden />
            <input
              type="range"
              min={1}
              max={4}
              step={0.01}
              value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              aria-label="Zoom"
              className="flex-1 accent-[#695282]"
            />
            <ZoomIn className="w-4 h-4 text-[#7b757e] shrink-0" aria-hidden />
            <span className="w-12 text-right text-xs font-bold text-[#4a454e] tabular-nums">{Math.round(zoom * 100)}%</span>
          </div>

          <div className="flex gap-2 justify-end">
            <button type="button" onClick={onCancel} className="text-sm font-bold text-[#7b757e] hover:text-[#4a454e] px-4 py-2 rounded-full">
              Cancel
            </button>
            <button
              type="button"
              onClick={() => area && onDone(area)}
              disabled={!area}
              className="inline-flex items-center gap-2 text-sm font-bold text-white bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 px-6 py-2 rounded-full shadow-sm transition-all"
            >
              <Check className="w-4 h-4 text-[#ffd1b3]" />
              Use this crop
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

import React from 'react';
import { Monitor, Tablet, Smartphone, Sparkles, Compass, CheckCircle2, HeartHandshake, Eye } from 'lucide-react';
import { ActiveView, DeviceViewport } from '../types';

interface Props {
  activeView: ActiveView;
  setActiveView: (view: ActiveView) => void;
  viewport: DeviceViewport;
  setViewport: (vp: DeviceViewport) => void;
}

export const DeviceSimulatorBar: React.FC<Props> = ({
  activeView,
  setActiveView,
  viewport,
  setViewport,
}) => {
  return (
    <header className="sticky top-0 z-50 bg-[#1c1c18]/90 text-white backdrop-blur-md border-b border-white/10 px-3 py-2 sm:px-6">
      <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-3 text-xs">
        
        {/* Left: View switcher tabs */}
        <div className="flex items-center gap-1 overflow-x-auto w-full md:w-auto pb-1 md:pb-0 no-scrollbar">
          <span className="text-white/40 font-semibold text-[10px] uppercase tracking-wider mr-1 shrink-0">
            Screens:
          </span>
          
          <button
            onClick={() => setActiveView('main')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all shrink-0 font-medium ${
              activeView === 'main'
                ? 'bg-[#9d84b7] text-white shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Eye className="w-3.5 h-3.5" />
            <span>Under Development</span>
          </button>

          <button
            onClick={() => setActiveView('simulator')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all shrink-0 font-medium ${
              activeView === 'simulator'
                ? 'bg-[#9d84b7] text-white shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Sparkles className="w-3.5 h-3.5 text-[#ffd1b3]" />
            <span>Mystery Scoop Reveal</span>
          </button>

          <button
            onClick={() => setActiveView('roadmap')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all shrink-0 font-medium ${
              activeView === 'roadmap'
                ? 'bg-[#9d84b7] text-white shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <Compass className="w-3.5 h-3.5" />
            <span>The Reveal Project</span>
          </button>

          <button
            onClick={() => setActiveView('vip')}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full transition-all shrink-0 font-medium ${
              activeView === 'vip'
                ? 'bg-[#9d84b7] text-white shadow-sm'
                : 'text-white/70 hover:text-white hover:bg-white/10'
            }`}
          >
            <HeartHandshake className="w-3.5 h-3.5 text-[#ffd1b3]" />
            <span>VIP Launch Pass</span>
          </button>
        </div>

        {/* Right: Responsive Viewport Switcher */}
        <div className="flex items-center gap-2 shrink-0 bg-white/5 p-1 rounded-full border border-white/10">
          <span className="text-white/40 text-[10px] uppercase font-semibold px-2 hidden sm:inline">
            Device Preview:
          </span>

          <button
            onClick={() => setViewport('responsive')}
            className={`px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              viewport === 'responsive'
                ? 'bg-white text-[#1c1c18] font-semibold shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
            title="Fluid Full Screen"
          >
            Full Width
          </button>

          <button
            onClick={() => setViewport('desktop')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              viewport === 'desktop'
                ? 'bg-white text-[#1c1c18] font-semibold shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
            title="Desktop Frame (1200px)"
          >
            <Monitor className="w-3 h-3" />
            <span className="hidden sm:inline">Desktop</span>
          </button>

          <button
            onClick={() => setViewport('tablet')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              viewport === 'tablet'
                ? 'bg-white text-[#1c1c18] font-semibold shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
            title="Tablet Frame (768px)"
          >
            <Tablet className="w-3 h-3" />
            <span className="hidden sm:inline">Tablet</span>
          </button>

          <button
            onClick={() => setViewport('mobile')}
            className={`flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-medium transition-all ${
              viewport === 'mobile'
                ? 'bg-white text-[#1c1c18] font-semibold shadow-sm'
                : 'text-white/60 hover:text-white'
            }`}
            title="Mobile Frame (375px)"
          >
            <Smartphone className="w-3 h-3" />
            <span className="hidden sm:inline">Mobile</span>
          </button>
        </div>

      </div>
    </header>
  );
};

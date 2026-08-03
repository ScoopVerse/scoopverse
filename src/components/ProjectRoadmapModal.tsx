import React from 'react';
import { ArrowLeft, CheckCircle2, Clock, Sparkles, Wand2, Compass, ArrowRight } from 'lucide-react';
import { RoadmapStep } from '../types';

const ROADMAP_STEPS: RoadmapStep[] = [
  {
    id: 1,
    title: 'Niche Fragrance Curation & Scent Testing',
    status: 'completed',
    percentage: 100,
    description: 'Selected over 500+ luxury artisanal perfumes from Parisian, Mediterranean, and Kyoto fragrance houses.',
    targetDate: 'May 2024',
  },
  {
    id: 2,
    title: 'Custom Scoop Vessel & Ergonomic Bead Design',
    status: 'completed',
    percentage: 100,
    description: 'Engineered eco-friendly, scent-preserving silicone scoop spheres and clear crystal presentation jars.',
    targetDate: 'July 2024',
  },
  {
    id: 3,
    title: 'Curation Scent #482 Quality Assurance',
    status: 'in-progress',
    percentage: 80,
    description: 'Currently testing batch stability, spray atomizer dispersion, and sillage retention for mystery scoop boxes.',
    targetDate: 'August 2024 (Active)',
  },
  {
    id: 4,
    title: 'VIP Founder Box Assembly & Early Access Drop',
    status: 'upcoming',
    percentage: 0,
    description: 'Shipping the first 1,000 Founder Mystery Scoops to waiting list members with custom personalized scent cards.',
    targetDate: 'September 2024',
  }
];

interface Props {
  onBack: () => void;
  onOpenVIP: () => void;
}

export const ProjectRoadmapModal: React.FC<Props> = ({ onBack, onOpenVIP }) => {
  return (
    <div className="min-h-screen bg-[#fdf9f3] bg-luminous-radial text-[#1c1c18] font-sans-ui py-10 px-4 sm:px-6 md:px-12">
      
      {/* Top Header */}
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#695282] hover:text-[#533d6b] bg-white/70 hover:bg-white px-4 py-2 rounded-full border border-[#9d84b7]/20 shadow-xs transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Landing</span>
        </button>

        <div className="flex items-center gap-2 bg-[#efdbff] px-3 py-1 rounded-full text-xs font-bold text-[#533d6b]">
          <Wand2 className="w-3.5 h-3.5 text-[#695282]" />
          <span>Live Project Status: 80%</span>
        </div>
      </div>

      {/* Main Roadmap Card */}
      <div className="max-w-4xl mx-auto space-y-8">
        
        {/* Banner Section */}
        <div className="bg-gradient-to-r from-[#695282] via-[#826b9c] to-[#9d84b7] text-white rounded-3xl p-8 sm:p-10 shadow-xl relative overflow-hidden">
          <div className="absolute right-0 top-0 bottom-0 w-1/2 opacity-10 pointer-events-none bg-radial from-white to-transparent"></div>
          
          <div className="relative z-10 space-y-4 max-w-2xl">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-white/20 text-white text-xs font-bold uppercase tracking-wider">
              <Compass className="w-3.5 h-3.5 text-[#ffd1b3]" />
              <span>Transparent Progress Tracker</span>
            </div>
            
            <h1 className="font-serif-display text-3xl sm:text-4xl font-bold leading-tight">
              The Reveal Project Roadmap
            </h1>
            
            <p className="text-white/80 text-sm sm:text-base leading-relaxed">
              We believe in total transparency as we build ScoopVerse. Follow our live development stages as we prepare the ultimate mystery fragrance scoop experience.
            </p>

            <div className="pt-2">
              <div className="flex items-center justify-between text-xs font-bold uppercase text-white/90 mb-1.5">
                <span>Overall Project Launch Readiness</span>
                <span>80% Complete</span>
              </div>
              <div className="w-full h-3 bg-black/20 rounded-full overflow-hidden p-0.5 backdrop-blur-xs">
                <div className="h-full bg-gradient-to-r from-[#ffd1b3] to-[#d4af37] rounded-full animate-shimmer" style={{ width: '80%' }}></div>
              </div>
            </div>
          </div>
        </div>

        {/* Timeline Steps */}
        <div className="bg-white/80 backdrop-blur-md rounded-3xl p-6 sm:p-10 border border-white shadow-lg space-y-6">
          <h2 className="font-serif-display text-2xl font-bold text-[#1c1c18] border-b border-[#e6e2dc] pb-4">
            Development Milestones
          </h2>

          <div className="space-y-6">
            {ROADMAP_STEPS.map((step) => (
              <div
                key={step.id}
                className={`p-5 rounded-2xl border transition-all ${
                  step.status === 'in-progress'
                    ? 'bg-[#fdf9f3] border-[#9d84b7] shadow-md'
                    : step.status === 'completed'
                    ? 'bg-[#f7f3ed]/60 border-[#e6e2dc]'
                    : 'bg-white/40 border-[#e6e2dc] opacity-75'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-3">
                    {step.status === 'completed' ? (
                      <CheckCircle2 className="w-5 h-5 text-[#695282] shrink-0" />
                    ) : step.status === 'in-progress' ? (
                      <Clock className="w-5 h-5 text-[#d4af37] animate-spin shrink-0" />
                    ) : (
                      <div className="w-5 h-5 rounded-full border-2 border-[#ccc4ce] shrink-0" />
                    )}

                    <h3 className="font-semibold text-base text-[#1c1c18]">
                      {step.title}
                    </h3>
                  </div>

                  <span className={`text-xs font-bold px-3 py-1 rounded-full uppercase tracking-wider shrink-0 ${
                    step.status === 'completed'
                      ? 'bg-[#b9e5d8] text-[#1c1c18]'
                      : step.status === 'in-progress'
                      ? 'bg-[#ffe088] text-[#4e3d00]'
                      : 'bg-[#e6e2dc] text-[#7b757e]'
                  }`}>
                    {step.status === 'in-progress' ? `Active: ${step.percentage}%` : step.status}
                  </span>
                </div>

                <p className="text-sm text-[#4a454e] pl-8 sm:pl-8 leading-relaxed">
                  {step.description}
                </p>

                <div className="mt-3 pl-8 sm:pl-8 text-xs font-semibold text-[#7b757e]">
                  Target Completion: <span className="text-[#1c1c18]">{step.targetDate}</span>
                </div>
              </div>
            ))}
          </div>

          {/* Bottom Action */}
          <div className="pt-6 border-t border-[#e6e2dc] flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-xs text-[#7b757e] text-center sm:text-left">
              Want to get notified the second we hit 100% completion?
            </p>
            <button
              onClick={onOpenVIP}
              className="py-3 px-6 rounded-full bg-[#695282] hover:bg-[#533d6b] text-white font-semibold text-xs shadow-md transition-all flex items-center gap-2"
            >
              <span>Join VIP Launch Access List</span>
              <ArrowRight className="w-4 h-4 text-[#ffd1b3]" />
            </button>
          </div>

        </div>

      </div>

    </div>
  );
};

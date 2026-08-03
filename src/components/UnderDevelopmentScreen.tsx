import React from 'react';
import { Sparkles, Banknote, Compass, Instagram } from 'lucide-react';
import { ScoopVerseLogo } from './ScoopVerseLogo';

interface Props {
  onOpenSocial: (platform: 'instagram' | 'tiktok') => void;
}

export const UnderDevelopmentScreen: React.FC<Props> = ({
  onOpenSocial,
}) => {
  return (
    <div className="relative min-h-screen bg-[#fdf9f3] bg-luminous-radial text-[#1c1c18] font-sans-ui flex flex-col items-center justify-between px-4 sm:px-6 md:px-12 py-10 sm:py-16 selection:bg-[#9d84b7]/20 selection:text-[#2d2438] overflow-x-hidden">
      
      {/* Background magical glowing ambient shapes */}
      <div className="pointer-events-none absolute top-12 left-1/2 -translate-x-1/2 w-[600px] h-[600px] bg-gradient-to-b from-[#efdbff]/40 via-[#ffdcc5]/20 to-transparent blur-3xl rounded-full opacity-60"></div>
      
      {/* Main Content Layout Container */}
      <div className="relative z-10 w-full max-w-4xl mx-auto flex flex-col items-center text-center space-y-10 sm:space-y-12">
        
        {/* 1. Header Logo - Floating Up and Down */}
        <div className="pt-2 sm:pt-4">
          <ScoopVerseLogo size="md" />
        </div>

        {/* 2. Badge Pill */}
        <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-white/60 border border-[#9d84b7]/30 backdrop-blur-sm shadow-xs text-[#533d6b] text-[11px] sm:text-12px font-bold tracking-widest uppercase">
          <Sparkles className="w-3.5 h-3.5 text-[#826b9c] sparkle-icon" />
          <span>SOMETHING MAGICAL IS COMING</span>
        </div>

        {/* 3. Main Headline */}
        <div className="space-y-2 sm:space-y-3">
          <h1 className="font-serif-display text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#1c1c18] leading-[1.15]">
            Our Website is
          </h1>
          <h2 className="font-serif-display text-4xl sm:text-5xl md:text-6xl font-normal italic text-[#695282] tracking-tight leading-[1.15]">
            Under Development
          </h2>
        </div>

        {/* 4. Feature Section Heading & Card Container */}
        <div className="w-full pt-4 sm:pt-6 space-y-6">
          <h3 className="font-serif-display text-2xl sm:text-3xl md:text-4xl font-bold text-[#1c1c18]">
            Why Mystery Scoops?
          </h3>

          {/* Structured Glass Card with 3 Feature Items */}
          <div className="w-full text-left">
            <div className="glass-card rounded-3xl p-6 sm:p-10 md:p-12 border border-white/80 shadow-xl space-y-8 transition-all duration-300 hover:shadow-2xl">
              
              {/* Item 1: Cost Savings */}
              <div className="flex items-start gap-4 sm:gap-6">
                <div className="w-12 h-12 rounded-full bg-[#efdbff]/70 border border-[#9d84b7]/20 flex items-center justify-center text-[#695282] shrink-0 mt-0.5">
                  <Banknote className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-serif-display text-xl sm:text-2xl font-bold text-[#1c1c18]">
                    Cost Savings
                  </h4>
                  <p className="text-[#4a454e] text-sm sm:text-base leading-relaxed">
                    Buying a full-size perfume can be expensive, especially if you&apos;re not sure you&apos;ll love the scent.
                  </p>
                </div>
              </div>

              {/* Item 2: Discovery */}
              <div className="flex items-start gap-4 sm:gap-6">
                <div className="w-12 h-12 rounded-full bg-[#efdbff]/70 border border-[#9d84b7]/20 flex items-center justify-center text-[#695282] shrink-0 mt-0.5">
                  <Compass className="w-6 h-6" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-serif-display text-xl sm:text-2xl font-bold text-[#1c1c18]">
                    Discovery
                  </h4>
                  <p className="text-[#4a454e] text-sm sm:text-base leading-relaxed">
                    Our Mystery Scoops let you discover a variety of fragrances at a much lower cost. Instead of committing to one full bottle, you can experience multiple scents and find your favorites before deciding on a larger purchase.
                  </p>
                </div>
              </div>

              {/* Item 3: The Fun of the Reveal */}
              <div className="flex items-start gap-4 sm:gap-6">
                <div className="w-12 h-12 rounded-full bg-[#efdbff]/70 border border-[#9d84b7]/20 flex items-center justify-center text-[#695282] shrink-0 mt-0.5">
                  <Sparkles className="w-6 h-6 text-[#695282]" />
                </div>
                <div className="space-y-1.5">
                  <h4 className="font-serif-display text-xl sm:text-2xl font-bold text-[#1c1c18]">
                    The Fun of the Reveal
                  </h4>
                  <p className="text-[#7a5840] text-sm sm:text-base italic font-medium leading-relaxed flex items-center gap-1.5 flex-wrap">
                    <span>✨ It&apos;s a fun, affordable way to explore new fragrances while enjoying the excitement of a surprise reveal!</span>
                  </p>
                </div>
              </div>

            </div>
          </div>
        </div>

        {/* 5. Social Media Section */}
        <div className="w-full pt-8 space-y-6">
          <h4 className="text-xs sm:text-sm font-bold tracking-[0.2em] text-[#695282] uppercase">
            CATCH US ON TIKTOK AND IG
          </h4>

          <div className="flex items-center justify-center gap-8 sm:gap-12">
            
            {/* Instagram Button */}
            <button
              onClick={() => onOpenSocial('instagram')}
              className="group flex flex-col items-center gap-2.5 focus:outline-hidden"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white border border-[#ccc4ce]/60 shadow-md flex items-center justify-center text-[#1c1c18] group-hover:text-[#695282] group-hover:border-[#9d84b7] group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
                <i className="fa-brands fa-instagram text-xl sm:text-2xl"></i>
              </div>
              <span className="text-[11px] sm:text-12px font-bold tracking-widest text-[#4a454e] group-hover:text-[#1c1c18] transition-colors uppercase">
                INSTAGRAM
              </span>
            </button>

            {/* TikTok Button */}
            <button
              onClick={() => onOpenSocial('tiktok')}
              className="group flex flex-col items-center gap-2.5 focus:outline-hidden"
            >
              <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full bg-white border border-[#ccc4ce]/60 shadow-md flex items-center justify-center text-[#1c1c18] group-hover:text-[#695282] group-hover:border-[#9d84b7] group-hover:shadow-lg group-hover:scale-110 transition-all duration-300">
                <i className="fa-brands fa-tiktok text-xl sm:text-2xl"></i>
              </div>
              <span className="text-[11px] sm:text-12px font-bold tracking-widest text-[#4a454e] group-hover:text-[#1c1c18] transition-colors uppercase">
                TIKTOK
              </span>
            </button>

          </div>
        </div>

      </div>

      {/* 6. Footer */}
      <footer className="relative z-10 w-full pt-16 sm:pt-20 flex flex-col items-center gap-4 text-center">
        <p className="text-[11px] sm:text-12px font-semibold tracking-widest text-[#7b757e] uppercase">
          © 2024 SCOOPVERSE INC. EST. 2023
        </p>
        <div className="w-px h-8 bg-gradient-to-b from-[#ccc4ce] to-transparent"></div>
      </footer>

    </div>
  );
};

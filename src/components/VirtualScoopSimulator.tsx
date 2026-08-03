import React, { useState } from 'react';
import { Sparkles, RefreshCw, Heart, Check, Droplets, Flame, Flower2, Wine, Gift, ArrowLeft } from 'lucide-react';
import { ScentNote } from '../types';
import scoopJarImg from '../assets/images/mystery_scoop_jar_1785770167492.jpg';

const SCENT_DATABASE: ScentNote[] = [
  {
    id: 'scent-1',
    name: 'Celestial Vanilla & Cashmere Glow',
    category: 'Gourmand',
    description: 'A cozy, luminous blend of warm Madagascar bourbon vanilla, golden amber resin, and soft white cashmere blossom.',
    topNotes: ['Bergamot Blossom', 'Crushed Almond'],
    heartNotes: ['Tahitian Vanilla Orchid', 'Warm Milk'],
    baseNotes: ['Cashmere Musk', 'Amber Resin', 'Sandalwood'],
    color: '#f3e8ff',
    badge: 'Popular Pick ✨',
  },
  {
    id: 'scent-2',
    name: 'Midnight Jasmine & Silk Petals',
    category: 'Floral',
    description: 'An intoxicating evening bloom featuring night-blooming jasmine, velvet rose petals, and subtle sparkling nectar.',
    topNotes: ['Pink Pepper', 'Sparkling Mandarin'],
    heartNotes: ['Night-blooming Jasmine', 'Damask Rose'],
    baseNotes: ['Clear Cedar', 'White Musk'],
    color: '#e0f2fe',
    badge: 'Rare Scoop 🌙',
  },
  {
    id: 'scent-3',
    name: 'Sun-Drenched Citrus & Sea Salt Nectar',
    category: 'Fresh',
    description: 'Bright coastal sunlight captured in crisp Italian bergamot, salty ocean mist, and juicy white nectarine.',
    topNotes: ['Calabrian Bergamot', 'Sea Salt Mist'],
    heartNotes: ['White Nectarine', 'Solar Neroli'],
    baseNotes: ['Driftwood', 'Soft Vetiver'],
    color: '#fef3c7',
    badge: 'Summer Favorite ☀️',
  },
  {
    id: 'scent-4',
    name: 'Ember Rose & Velvet Oud',
    category: 'Woody',
    description: 'A deep, mysterious smoky rose layered over velvety Laos oudwood and caramelized honeyed nectar.',
    topNotes: ['Saffron Nectar', 'Wild Black Raspberry'],
    heartNotes: ['Deep Crimson Rose', 'Smoky Incense'],
    baseNotes: ['Golden Oud', 'Patchouli Leaf'],
    color: '#ffe4e6',
    badge: 'Luxe Edition 👑',
  }
];

interface Props {
  onBack: () => void;
  onOpenVIP: () => void;
}

export const VirtualScoopSimulator: React.FC<Props> = ({ onBack, onOpenVIP }) => {
  const [isScooping, setIsScooping] = useState(false);
  const [revealedScent, setRevealedScent] = useState<ScentNote | null>(null);
  const [savedFavorites, setSavedFavorites] = useState<string[]>([]);

  const handleScoop = () => {
    setIsScooping(true);
    setRevealedScent(null);

    setTimeout(() => {
      const randomIndex = Math.floor(Math.random() * SCENT_DATABASE.length);
      setRevealedScent(SCENT_DATABASE[randomIndex]);
      setIsScooping(false);
    }, 1200);
  };

  const toggleFavorite = (id: string) => {
    if (savedFavorites.includes(id)) {
      setSavedFavorites(savedFavorites.filter((item) => item !== id));
    } else {
      setSavedFavorites([...savedFavorites, id]);
    }
  };

  return (
    <div className="min-h-screen bg-[#fdf9f3] bg-luminous-radial text-[#1c1c18] font-sans-ui py-10 px-4 sm:px-6 md:px-12">
      
      {/* Header Navigation */}
      <div className="max-w-4xl mx-auto flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#695282] hover:text-[#533d6b] bg-white/70 hover:bg-white px-4 py-2 rounded-full border border-[#9d84b7]/20 shadow-xs transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Landing</span>
        </button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold uppercase tracking-wider text-[#79573f]">
            Saved Wishlist: {savedFavorites.length}
          </span>
          <Heart className={`w-4 h-4 ${savedFavorites.length > 0 ? 'fill-[#ba1a1a] text-[#ba1a1a]' : 'text-[#7b757e]'}`} />
        </div>
      </div>

      {/* Main Interactive Stage */}
      <div className="max-w-4xl mx-auto text-center space-y-8">
        
        {/* Title */}
        <div className="space-y-3">
          <div className="inline-flex items-center gap-1.5 px-3.5 py-1 rounded-full bg-[#ffd1b3]/50 text-[#7a5840] text-xs font-bold uppercase tracking-widest">
            <Gift className="w-3.5 h-3.5" />
            <span>Interactive Experience</span>
          </div>
          <h1 className="font-serif-display text-3xl sm:text-5xl font-bold text-[#1c1c18]">
            Virtual Mystery Scoop Experience
          </h1>
          <p className="text-[#4a454e] text-base max-w-xl mx-auto">
            Experience the excitement of a ScoopVerse mystery reveal! Take a virtual scoop from our fragrance bowl to uncover surprise luxury perfume samples.
          </p>
        </div>

        {/* Jar Visual & Scoop Action Area */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 items-center bg-white/80 backdrop-blur-md rounded-3xl p-6 sm:p-8 border border-white shadow-xl">
          
          {/* Scoop Bowl Image */}
          <div className="relative group overflow-hidden rounded-2xl border border-[#9d84b7]/20 bg-[#f7f3ed]">
            <img
              src={scoopJarImg}
              alt="Mystery Scoop Jar"
              referrerPolicy="no-referrer"
              className={`w-full h-64 sm:h-80 object-cover transition-transform duration-700 ${
                isScooping ? 'scale-110 blur-xs' : 'group-hover:scale-105'
              }`}
            />
            
            {/* Animated Scoop Overlay */}
            {isScooping && (
              <div className="absolute inset-0 bg-[#695282]/40 backdrop-blur-xs flex flex-col items-center justify-center text-white space-y-3">
                <Sparkles className="w-10 h-10 animate-spin text-[#ffd1b3]" />
                <p className="font-serif-display italic text-lg text-white font-medium">
                  Scooping magical fragrance beads...
                </p>
              </div>
            )}
            
            {!isScooping && !revealedScent && (
              <div className="absolute bottom-4 left-4 right-4 bg-white/90 backdrop-blur-md p-3 rounded-xl border border-white shadow-md text-xs text-[#4a454e] font-medium text-center">
                ✨ Ready to scoop! Click the button to draw your surprise.
              </div>
            )}
          </div>

          {/* Controls & Revealed Card */}
          <div className="flex flex-col justify-center space-y-6 text-left">
            
            {!revealedScent ? (
              <div className="space-y-6 text-center md:text-left">
                <h3 className="font-serif-display text-2xl font-semibold text-[#1c1c18]">
                  What will you reveal in your scoop?
                </h3>
                <p className="text-sm text-[#7b757e]">
                  Each mystery scoop delivers 3 to 5 curated travel perfume atomizers based on your scent mood.
                </p>

                <button
                  onClick={handleScoop}
                  disabled={isScooping}
                  className="w-full py-4 px-6 rounded-2xl bg-[#695282] hover:bg-[#533d6b] text-white font-bold text-base shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-3 transform active:scale-98"
                >
                  <Sparkles className="w-5 h-5 text-[#ffd1b3] sparkle-icon" />
                  <span>{isScooping ? 'Scooping Fragrances...' : 'TAKE A MYSTERY SCOOP!'}</span>
                </button>
              </div>
            ) : (
              <div className="space-y-5 animate-in fade-in slide-in-from-bottom-4 duration-500">
                
                {/* Badge Header */}
                <div className="flex items-center justify-between">
                  <span className="px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider bg-[#efdbff] text-[#533d6b]">
                    {revealedScent.badge}
                  </span>
                  
                  <button
                    onClick={() => toggleFavorite(revealedScent.id)}
                    className="p-2 rounded-full hover:bg-[#f1ede7] transition-colors"
                  >
                    <Heart
                      className={`w-5 h-5 ${
                        savedFavorites.includes(revealedScent.id)
                          ? 'fill-[#ba1a1a] text-[#ba1a1a]'
                          : 'text-[#7b757e]'
                      }`}
                    />
                  </button>
                </div>

                {/* Scent Title */}
                <div>
                  <span className="text-xs font-bold tracking-widest text-[#79573f] uppercase">
                    Category: {revealedScent.category}
                  </span>
                  <h3 className="font-serif-display text-2xl font-bold text-[#1c1c18] mt-1">
                    {revealedScent.name}
                  </h3>
                  <p className="text-sm text-[#4a454e] mt-2 leading-relaxed">
                    {revealedScent.description}
                  </p>
                </div>

                {/* Olfactory Pyramid Notes */}
                <div className="p-4 rounded-xl bg-[#f7f3ed] border border-[#e6e2dc] space-y-2 text-xs">
                  <div>
                    <span className="font-bold text-[#695282]">Top Notes: </span>
                    <span className="text-[#1c1c18]">{revealedScent.topNotes.join(', ')}</span>
                  </div>
                  <div>
                    <span className="font-bold text-[#695282]">Heart Notes: </span>
                    <span className="text-[#1c1c18]">{revealedScent.heartNotes.join(', ')}</span>
                  </div>
                  <div>
                    <span className="font-bold text-[#695282]">Base Notes: </span>
                    <span className="text-[#1c1c18]">{revealedScent.baseNotes.join(', ')}</span>
                  </div>
                </div>

                {/* Action Row */}
                <div className="flex items-center gap-3 pt-2">
                  <button
                    onClick={handleScoop}
                    className="flex-1 py-3 px-4 rounded-xl bg-[#f1ede7] hover:bg-[#e6e2dc] text-[#1c1c18] font-semibold text-xs transition-all flex items-center justify-center gap-2"
                  >
                    <RefreshCw className="w-4 h-4 text-[#695282]" />
                    <span>Scoop Again</span>
                  </button>

                  <button
                    onClick={onOpenVIP}
                    className="flex-1 py-3 px-4 rounded-xl bg-[#695282] hover:bg-[#533d6b] text-white font-semibold text-xs shadow-sm transition-all flex items-center justify-center gap-1.5"
                  >
                    <Check className="w-4 h-4 text-[#ffd1b3]" />
                    <span>Reserve in Launch Box</span>
                  </button>
                </div>

              </div>
            )}

          </div>

        </div>

      </div>

    </div>
  );
};

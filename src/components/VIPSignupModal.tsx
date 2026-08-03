import React, { useState } from 'react';
import { ArrowLeft, Sparkles, Check, Send, Heart, ShieldCheck } from 'lucide-react';

interface Props {
  onBack: () => void;
}

export const VIPSignupModal: React.FC<Props> = ({ onBack }) => {
  const [email, setEmail] = useState('');
  const [selectedFamilies, setSelectedFamilies] = useState<string[]>(['Gourmand', 'Floral']);
  const [isSubmitted, setIsSubmitted] = useState(false);

  const fragranceFamilies = [
    { id: 'Floral', label: '🌸 Floral & Rose Petals' },
    { id: 'Gourmand', label: '🍦 Gourmand & Warm Vanilla' },
    { id: 'Fresh', label: '🍋 Fresh Citrus & Ocean Air' },
    { id: 'Woody', label: '🪵 Smoky Cedar & Sandalwood' },
    { id: 'Amber', label: '✨ Golden Amber & Musks' },
  ];

  const toggleFamily = (id: string) => {
    if (selectedFamilies.includes(id)) {
      setSelectedFamilies(selectedFamilies.filter((f) => f !== id));
    } else {
      setSelectedFamilies([...selectedFamilies, id]);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setIsSubmitted(true);
  };

  return (
    <div className="min-h-screen bg-[#fdf9f3] bg-luminous-radial text-[#1c1c18] font-sans-ui py-10 px-4 sm:px-6 md:px-12">
      
      {/* Top Header */}
      <div className="max-w-3xl mx-auto flex items-center justify-between mb-8">
        <button
          onClick={onBack}
          className="inline-flex items-center gap-2 text-sm font-semibold text-[#695282] hover:text-[#533d6b] bg-white/70 hover:bg-white px-4 py-2 rounded-full border border-[#9d84b7]/20 shadow-xs transition-all"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Landing</span>
        </button>

        <span className="text-xs font-bold uppercase tracking-wider text-[#79573f]">
          VIP Launch Club
        </span>
      </div>

      {/* Main Form Container */}
      <div className="max-w-2xl mx-auto bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-10 border border-white shadow-xl space-y-6">
        
        {!isSubmitted ? (
          <>
            <div className="text-center space-y-3">
              <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#efdbff] text-[#533d6b] text-xs font-bold uppercase tracking-widest">
                <Sparkles className="w-3.5 h-3.5 text-[#695282]" />
                <span>Exclusive Launch Pass</span>
              </div>

              <h1 className="font-serif-display text-3xl sm:text-4xl font-bold text-[#1c1c18]">
                Be the First to Scoop
              </h1>

              <p className="text-sm text-[#4a454e] leading-relaxed max-w-lg mx-auto">
                Sign up for early access to the initial batch of ScoopVerse Mystery Scoops. Early members receive 20% off their first mystery scoop box + a free bonus travel fragrance atomizer!
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-6 pt-2">
              
              {/* Email Input */}
              <div className="space-y-2 text-left">
                <label className="text-xs font-bold uppercase tracking-wider text-[#1c1c18] block">
                  Your Email Address
                </label>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="enter.your.email@domain.com"
                  className="w-full px-5 py-3.5 rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc] focus:border-[#9d84b7] focus:bg-white focus:outline-hidden text-sm transition-all text-[#1c1c18] placeholder-[#7b757e]"
                />
              </div>

              {/* Scent Preferences */}
              <div className="space-y-3 text-left">
                <label className="text-xs font-bold uppercase tracking-wider text-[#1c1c18] block">
                  Select Your Favorite Fragrance Families (Optional)
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {fragranceFamilies.map((fam) => {
                    const isSelected = selectedFamilies.includes(fam.id);
                    return (
                      <button
                        type="button"
                        key={fam.id}
                        onClick={() => toggleFamily(fam.id)}
                        className={`p-3 rounded-xl text-xs font-medium border text-left flex items-center justify-between transition-all ${
                          isSelected
                            ? 'bg-[#efdbff]/60 border-[#9d84b7] text-[#26113c] font-semibold'
                            : 'bg-[#f7f3ed]/60 border-[#e6e2dc] text-[#4a454e] hover:bg-[#f1ede7]'
                        }`}
                      >
                        <span>{fam.label}</span>
                        {isSelected && <Check className="w-4 h-4 text-[#695282]" />}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                className="w-full py-4 rounded-2xl bg-[#695282] hover:bg-[#533d6b] text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4 text-[#ffd1b3]" />
                <span>CLAIM MY VIP EARLY ACCESS PASS</span>
              </button>

              <div className="flex items-center justify-center gap-2 text-xs text-[#7b757e] pt-1">
                <ShieldCheck className="w-4 h-4 text-[#695282]" />
                <span>No spam. We only send official launch drop announcements.</span>
              </div>

            </form>
          </>
        ) : (
          <div className="text-center py-8 space-y-6">
            <div className="w-16 h-16 rounded-full bg-[#b9e5d8] text-[#1c1c18] flex items-center justify-center mx-auto shadow-md">
              <Check className="w-8 h-8" />
            </div>

            <div className="space-y-2">
              <h2 className="font-serif-display text-3xl font-bold text-[#1c1c18]">
                You&apos;re on the VIP List!
              </h2>
              <p className="text-sm text-[#4a454e] max-w-md mx-auto leading-relaxed">
                We reserved your spot for <span className="font-bold text-[#695282]">{email}</span>. You will receive an exclusive access code when Curation #482 is ready to drop!
              </p>
            </div>

            <div className="p-4 rounded-2xl bg-[#fdf9f3] border border-[#e6e2dc] inline-block text-xs font-mono font-bold text-[#695282]">
              VIP PASS CODE: <span className="text-[#1c1c18]">SCOOP-VIP-2024-REVEAL</span>
            </div>

            <div className="pt-4">
              <button
                onClick={onBack}
                className="py-3 px-8 rounded-full bg-[#1c1c18] hover:bg-[#31302d] text-white font-semibold text-xs shadow-md transition-all"
              >
                Return to ScoopVerse
              </button>
            </div>
          </div>
        )}

      </div>

    </div>
  );
};

import React from 'react';
import { X, Instagram, Copy, Check, ExternalLink, Sparkles } from 'lucide-react';

interface Props {
  platform: 'instagram' | 'tiktok' | null;
  onClose: () => void;
}

export const SocialModal: React.FC<Props> = ({ platform, onClose }) => {
  const [copied, setCopied] = React.useState(false);

  if (!platform) return null;

  const isIG = platform === 'instagram';
  const handle = '@scoopverse.asia';
  const profileUrl = isIG
    ? 'https://instagram.com/scoopverse.asia'
    : 'https://tiktok.com/@scoopverse.asia';

  const handleCopy = () => {
    navigator.clipboard.writeText(handle);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl p-6 sm:p-8 max-w-sm w-full border border-white shadow-2xl relative space-y-6 text-center">
        
        {/* Close Button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-2 rounded-full hover:bg-[#f1ede7] text-[#7b757e] transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Icon Header */}
        <div className="w-16 h-16 rounded-full bg-[#fdf9f3] border border-[#9d84b7]/30 shadow-md flex items-center justify-center mx-auto text-[#695282]">
          {isIG ? (
            <i className="fa-brands fa-instagram text-3xl"></i>
          ) : (
            <i className="fa-brands fa-tiktok text-3xl"></i>
          )}
        </div>

        {/* Content */}
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-widest text-[#79573f]">
            Follow ScoopVerse on {isIG ? 'Instagram' : 'TikTok'}
          </span>
          <h3 className="font-serif-display text-2xl font-bold text-[#1c1c18]">
            {handle}
          </h3>
          <p className="text-xs text-[#4a454e]">
            Catch behind-the-scenes mystery scoop packings, fragrance unboxings, and live scent reveals!
          </p>
        </div>

        {/* Handle Box */}
        <div className="flex items-center justify-between p-3 rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc]">
          <span className="font-mono text-xs font-bold text-[#695282]">{handle}</span>
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-semibold text-[#1c1c18] hover:text-[#695282] transition-colors"
          >
            {copied ? (
              <>
                <Check className="w-3.5 h-3.5 text-[#22c55e]" />
                <span className="text-[#22c55e]">Copied!</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>Copy</span>
              </>
            )}
          </button>
        </div>

        {/* Action Button */}
        <a
          href={profileUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="w-full py-3.5 px-4 rounded-2xl bg-[#695282] hover:bg-[#533d6b] text-white font-bold text-xs shadow-md transition-all flex items-center justify-center gap-2"
        >
          <span>Open {isIG ? 'Instagram' : 'TikTok'} Profile</span>
          <ExternalLink className="w-4 h-4 text-[#ffd1b3]" />
        </a>

      </div>
    </div>
  );
};

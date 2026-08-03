import React from 'react';

// Import generated image or use SVG fallback matching the cosmic badge
import logoImg from '../assets/images/regenerated_image_1785774461998.png';

interface LogoProps {
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const ScoopVerseLogo: React.FC<LogoProps> = ({ className = '', size = 'md' }) => {
  const sizeClasses = {
    sm: 'w-[165px] h-auto',
    md: 'w-[258px] sm:w-[294px] md:w-[331px] h-auto',
    lg: 'w-[331px] sm:w-[368px] md:w-[442px] h-auto',
  };

  return (
    <div className={`relative inline-block text-center group animate-float transition-transform duration-300 hover:scale-[1.02] ${className}`}>
      {/* Outer ambient cosmic glow */}
      <div className="absolute -inset-3 bg-radial from-[#9d84b7]/30 via-[#ffd1b3]/20 to-transparent blur-xl rounded-full opacity-80 group-hover:opacity-100 transition-opacity"></div>
      
      {/* ScoopVerse Cosmic Logo */}
      <img
        src={logoImg}
        alt="ScoopVerse Logo"
        referrerPolicy="no-referrer"
        className={`relative z-10 mx-auto object-contain drop-shadow-lg ${sizeClasses[size]}`}
      />
    </div>
  );
};

import React from 'react';

// A picture shown whole inside its frame. Pictures that are not square get a soft blurred copy of themselves
// filling the empty space, so nothing is cut off and nothing looks bare.
export const FramedImage: React.FC<{ src: string; alt: string; className?: string; eager?: boolean }> = ({ src, alt, className = '', eager }) => (
  <>
    <span className="absolute inset-0 overflow-hidden" aria-hidden>
      <img src={src} alt="" loading={eager ? 'eager' : 'lazy'} className={`h-full w-full scale-125 object-cover blur-2xl opacity-60 ${className}`} />
    </span>
    <img src={src} alt={alt} loading={eager ? 'eager' : 'lazy'} className={`relative h-full w-full object-contain ${className}`} />
  </>
);

import React, { useState } from 'react';
import { UnderDevelopmentScreen } from './components/UnderDevelopmentScreen';
import { SocialModal } from './components/SocialModal';

export default function App() {
  const [socialPlatform, setSocialPlatform] = useState<'instagram' | 'tiktok' | null>(null);

  return (
    <div className="min-h-screen bg-[#fdf9f3] font-sans-ui selection:bg-[#9d84b7]/20 selection:text-[#2d2438]">
      <UnderDevelopmentScreen
        onOpenSocial={(p) => setSocialPlatform(p)}
      />

      {/* Social Modal */}
      <SocialModal
        platform={socialPlatform}
        onClose={() => setSocialPlatform(null)}
      />
    </div>
  );
}


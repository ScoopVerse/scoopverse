import React, { useEffect, useState } from 'react';
import { UnderDevelopmentScreen } from './components/UnderDevelopmentScreen';
import { SocialModal } from './components/SocialModal';
import { AuthButton } from './components/AuthButton';
import { AuthModal } from './components/AuthModal';
import { VerifyEmailPage } from './components/VerifyEmailPage';
import type { User } from './types';

export default function App() {
  const [socialPlatform, setSocialPlatform] = useState<'instagram' | 'tiktok' | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);
  // The verification email links to /verify-email?token=...
  const [verifying, setVerifying] = useState(() => window.location.pathname === '/verify-email');

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => (r.ok ? r.json() : { user: null }))
      .then((d) => setUser(d.user))
      .catch(() => setUser(null));
  }, []);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  if (verifying) {
    return (
      <VerifyEmailPage
        onDone={(openLogin) => {
          window.history.pushState(null, '', '/');
          setVerifying(false);
          setAuthOpen(openLogin);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-[#fdf9f3] font-sans-ui selection:bg-[#9d84b7]/20 selection:text-[#2d2438]">
      <AuthButton user={user} onLogin={() => setAuthOpen(true)} onLogout={logout} />

      <UnderDevelopmentScreen
        onOpenSocial={(p) => setSocialPlatform(p)}
      />

      {/* Social Modal */}
      <SocialModal
        platform={socialPlatform}
        onClose={() => setSocialPlatform(null)}
      />

      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={(u) => {
          setUser(u);
          setAuthOpen(false);
        }}
      />
    </div>
  );
}

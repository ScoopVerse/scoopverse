import React, { useState } from 'react';
import { HomePage } from './components/HomePage';
import { AuthModal } from './components/AuthModal';
import { VerifyEmailPage } from './components/VerifyEmailPage';
import { ResetPasswordPage } from './components/ResetPasswordPage';
import { useAccount } from './useAccount';

export default function App() {
  const { user, setUser, authOpen, setAuthOpen, refresh, logout } = useAccount();
  // The verification email links to /verify-email?token=...
  const [verifying, setVerifying] = useState(() => window.location.pathname === '/verify-email');
  // The password reset email links to /reset-password?token=...
  const [resetting, setResetting] = useState(() => window.location.pathname === '/reset-password');

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

  if (resetting) {
    return (
      <ResetPasswordPage
        onDone={(openLogin) => {
          window.history.pushState(null, '', '/');
          setResetting(false);
          // A successful reset logs the account out everywhere, so refresh who's logged in.
          refresh();
          setAuthOpen(openLogin);
        }}
      />
    );
  }

  return (
    <>
      <HomePage user={user} onLogin={() => setAuthOpen(true)} onLogout={logout} />
      <AuthModal
        open={authOpen}
        onClose={() => setAuthOpen(false)}
        onAuthed={(u) => {
          setUser(u);
          setAuthOpen(false);
        }}
      />
    </>
  );
}

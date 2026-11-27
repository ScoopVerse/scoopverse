import { useCallback, useEffect, useState } from 'react';
import type { User } from './types';

// Who is logged in and whether the login window is open: shared by the Home and Shop pages (and their top bar).
export function useAccount() {
  const [user, setUser] = useState<User | null>(null);
  const [authOpen, setAuthOpen] = useState(false);

  const refresh = useCallback(
    () =>
      fetch('/api/auth/me')
        .then((r) => (r.ok ? r.json() : { user: null }))
        .then((d) => setUser(d.user))
        .catch(() => setUser(null)),
    [],
  );
  useEffect(() => {
    refresh();
  }, [refresh]);

  const logout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    setUser(null);
  };

  return { user, setUser, authOpen, setAuthOpen, refresh, logout };
}

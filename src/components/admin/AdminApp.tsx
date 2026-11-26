import React, { useEffect, useState } from 'react';
import type { Admin } from '../../types';
import { AdminLogin } from './AdminLogin';
import { AdminDashboard } from './AdminDashboard';

// /admin: admin login, then the dashboard. Access to admin data is enforced on the server;
// this only decides which screen to show.
export const AdminApp: React.FC = () => {
  // undefined = still checking whether an admin is logged in.
  const [admin, setAdmin] = useState<Admin | null | undefined>(undefined);

  useEffect(() => {
    document.title = 'ScoopVerse Admin';
    const robots = document.createElement('meta');
    robots.name = 'robots';
    robots.content = 'noindex, nofollow';
    document.head.appendChild(robots);

    fetch('/api/admin/me')
      .then((r) => (r.ok ? r.json() : { admin: null }))
      .then((d) => setAdmin(d.admin))
      .catch(() => setAdmin(null));
    return () => robots.remove();
  }, []);

  const logout = async () => {
    await fetch('/api/admin/logout', { method: 'POST' }).catch(() => {});
    setAdmin(null);
  };

  if (admin === undefined) return <div className="min-h-screen bg-[#fdf9f3]" />;
  if (!admin) return <AdminLogin onLoggedIn={setAdmin} />;
  return <AdminDashboard admin={admin} onLogout={logout} />;
};

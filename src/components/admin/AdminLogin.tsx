import React, { useEffect, useState } from 'react';
import { LogIn, ShieldCheck } from 'lucide-react';
import type { Admin } from '../../types';
import { ScoopVerseLogo } from '../ScoopVerseLogo';
import { PasswordInput } from '../PasswordInput';

interface Props {
  onLoggedIn: (admin: Admin) => void;
}

export const AdminLogin: React.FC<Props> = ({ onLoggedIn }) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  // Password masked whenever the login page appears.
  useEffect(() => setShowPassword(false), []);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowPassword(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setPassword('');
      onLoggedIn(data.admin);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const inputClass =
    'w-full px-5 py-3.5 rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc] focus:border-[#9d84b7] focus:bg-white focus:outline-hidden text-sm transition-all text-[#1c1c18] placeholder-[#7b757e]';

  return (
    <div className="min-h-screen bg-[#fdf9f3] font-sans-ui flex flex-col items-center justify-center px-4 py-10 gap-6">
      <ScoopVerseLogo size="sm" />
      <div className="w-full max-w-md bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-10 border border-white shadow-xl space-y-6">
        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#efdbff] text-[#533d6b] text-xs font-bold uppercase tracking-widest">
            <ShieldCheck className="w-3.5 h-3.5 text-[#695282]" />
            <span>Admin Only</span>
          </div>
          <h1 className="font-serif-display text-3xl font-bold text-[#1c1c18]">Admin Log In</h1>
        </div>

        <form onSubmit={submit} className="space-y-4 text-left">
          <div className="space-y-2">
            <label htmlFor="admin-email" className="text-xs font-bold uppercase tracking-wider text-[#1c1c18] block">
              Email
            </label>
            <input
              id="admin-email"
              type="email"
              required
              autoComplete="username"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="admin@scoopverse.asia"
              className={inputClass}
            />
          </div>
          <PasswordInput
            id="admin-password"
            label="Password"
            value={password}
            onChange={setPassword}
            shown={showPassword}
            onToggleShown={() => setShowPassword((s) => !s)}
            autoComplete="current-password"
            placeholder="••••••••"
          />

          {error && (
            <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={busy}
            className="w-full py-4 rounded-2xl bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4 text-[#ffd1b3]" />
            <span>{busy ? 'PLEASE WAIT…' : 'LOG IN'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

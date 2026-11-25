import React, { useEffect, useState } from 'react';
import { X, Sparkles, LogIn, UserPlus, Eye, EyeOff } from 'lucide-react';
import type { User } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  onAuthed: (user: User) => void;
}

export const AuthModal: React.FC<Props> = ({ open, onClose, onAuthed }) => {
  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  // Password is always masked by default each time the modal opens.
  useEffect(() => {
    if (open) setShowPassword(false);
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setShowPassword(false);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { name, email, password } : { email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setPassword('');
      onAuthed(data.user);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError(null);
    setShowPassword(false);
  };

  const inputClass =
    'w-full px-5 py-3.5 rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc] focus:border-[#9d84b7] focus:bg-white focus:outline-hidden text-sm transition-all text-[#1c1c18] placeholder-[#7b757e]';
  const labelClass = 'text-xs font-bold uppercase tracking-wider text-[#1c1c18] block';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2d2438]/30 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label={mode === 'login' ? 'Log in' : 'Create account'}
        className="relative w-full max-w-md bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-10 border border-white shadow-xl space-y-6 font-sans-ui"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#7b757e] hover:text-[#695282] hover:bg-[#efdbff]/50 transition-all"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="text-center space-y-3">
          <div className="inline-flex items-center gap-2 px-3.5 py-1 rounded-full bg-[#efdbff] text-[#533d6b] text-xs font-bold uppercase tracking-widest">
            <Sparkles className="w-3.5 h-3.5 text-[#695282]" />
            <span>ScoopVerse Account</span>
          </div>
          <h2 className="font-serif-display text-3xl font-bold text-[#1c1c18]">
            {mode === 'login' ? 'Welcome Back' : 'Join the Verse'}
          </h2>
        </div>

        {/* Mode toggle */}
        <div className="grid grid-cols-2 gap-1 p-1 rounded-full bg-[#f7f3ed] border border-[#e6e2dc] text-xs font-bold uppercase tracking-wider">
          {(['login', 'register'] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => switchMode(m)}
              className={`py-2 rounded-full transition-all ${
                mode === m ? 'bg-white text-[#695282] shadow-sm' : 'text-[#7b757e] hover:text-[#4a454e]'
              }`}
            >
              {m === 'login' ? 'Log In' : 'Register'}
            </button>
          ))}
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 text-left">
          {mode === 'register' && (
            <div className="space-y-2">
              <label htmlFor="auth-name" className={labelClass}>Name</label>
              <input
                id="auth-name"
                required
                maxLength={80}
                autoComplete="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Your name"
                className={inputClass}
              />
            </div>
          )}
          <div className="space-y-2">
            <label htmlFor="auth-email" className={labelClass}>Email</label>
            <input
              id="auth-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="enter.your.email@domain.com"
              className={inputClass}
            />
          </div>
          <div className="space-y-2">
            <label htmlFor="auth-password" className={labelClass}>Password</label>
            <div className="relative">
              <input
                id="auth-password"
                type={showPassword ? 'text' : 'password'}
                required
                minLength={mode === 'register' ? 8 : undefined}
                autoComplete={mode === 'login' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
                className={`${inputClass} pr-12`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                aria-label={showPassword ? 'Hide password' : 'Show password'}
                aria-pressed={showPassword}
                className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-[#7b757e] hover:text-[#695282] hover:bg-[#efdbff]/50 transition-all"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

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
            {mode === 'login' ? <LogIn className="w-4 h-4 text-[#ffd1b3]" /> : <UserPlus className="w-4 h-4 text-[#ffd1b3]" />}
            <span>{busy ? 'PLEASE WAIT…' : mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}</span>
          </button>
        </form>
      </div>
    </div>
  );
};

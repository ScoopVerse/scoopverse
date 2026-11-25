import React, { useEffect, useState } from 'react';
import { X, Sparkles, LogIn, UserPlus, Eye, EyeOff, MailCheck, Send } from 'lucide-react';
import type { User } from '../types';
import { formatCountdown, useCountdown } from '../useCountdown';
import { ForgotPasswordView } from './ForgotPasswordView';

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
  // Set after registering: shows the "check your email" view for this address.
  const [checkEmail, setCheckEmail] = useState<string | null>(null);
  // Shows the "forgot password" view.
  const [forgot, setForgot] = useState(false);
  // The email whose login was refused because it isn't verified yet (resend goes here).
  const [unverifiedEmail, setUnverifiedEmail] = useState<string | null>(null);
  // Log In stays greyed out after a "please verify" answer until the email or password is edited,
  // so resubmitting the same details doesn't hit the server again.
  const [loginLocked, setLoginLocked] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  // Seconds until the server allows another verification email.
  const [resendWait, startResendWait] = useCountdown();

  // Each time the modal opens: password masked, back to the form.
  useEffect(() => {
    if (open) {
      setShowPassword(false);
      setCheckEmail(null);
      setForgot(false);
      setNotice(null);
      setLoginLocked(false);
    }
  }, [open]);

  if (!open) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loginLocked) return;
    setShowPassword(false);
    setBusy(true);
    setError(null);
    setNotice(null);
    setUnverifiedEmail(null);
    try {
      const res = await fetch(`/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(mode === 'register' ? { name, email, password } : { email, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.code === 'EMAIL_NOT_VERIFIED') {
          setUnverifiedEmail(email);
          setLoginLocked(true);
          startResendWait(data.resendInSeconds); // this email's real countdown from the server
        }
        setError(data.error ?? 'Something went wrong. Please try again.');
        return;
      }
      setPassword('');
      if (mode === 'register') {
        startResendWait(data.nextResendInSeconds);
        setCheckEmail(email);
      } else {
        onAuthed(data.user);
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const resend = async (address: string) => {
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: address }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        if (data.retryAfterSeconds) startResendWait(data.retryAfterSeconds);
        setError(data.error ?? 'Something went wrong. Please try again.');
      } else {
        // Keep the resend link (with its countdown) visible, so resending again
        // never requires another login attempt.
        startResendWait(data.nextResendInSeconds);
        setNotice('A new verification link has been sent. Check your inbox.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const switchMode = (m: 'login' | 'register') => {
    setMode(m);
    setError(null);
    setNotice(null);
    setUnverifiedEmail(null);
    setLoginLocked(false);
    setShowPassword(false);
  };

  const backToLogin = () => {
    setCheckEmail(null);
    switchMode('login');
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
            {checkEmail ? 'Check Your Email' : forgot ? 'Reset Password' : mode === 'login' ? 'Welcome Back' : 'Join the Verse'}
          </h2>
        </div>

        {forgot ? (
          <ForgotPasswordView
            initialEmail={email}
            onBack={() => {
              setForgot(false);
              switchMode('login');
            }}
          />
        ) : checkEmail ? (
          <div className="text-center space-y-5">
            <div className="w-16 h-16 rounded-full bg-[#efdbff]/70 border border-[#9d84b7]/20 text-[#695282] flex items-center justify-center mx-auto">
              <MailCheck className="w-7 h-7" />
            </div>
            <p className="text-sm text-[#4a454e] leading-relaxed">
              We sent a verification link to <span className="font-bold text-[#695282] break-all">{checkEmail}</span>.
              Click it to activate your account, then log in.
            </p>
            {notice && (
              <p role="status" className="text-sm text-[#2f5d50] bg-[#e6f4ef] border border-[#b9e5d8] rounded-xl px-4 py-2.5">
                {notice}
              </p>
            )}
            {error && (
              <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
                {error}
              </p>
            )}
            <div className="flex flex-col gap-2">
              <button
                type="button"
                onClick={() => resend(checkEmail)}
                disabled={busy || resendWait > 0}
                className="w-full py-3 rounded-2xl bg-white border border-[#9d84b7]/40 text-[#695282] hover:bg-[#efdbff]/40 disabled:opacity-60 disabled:hover:bg-white disabled:cursor-not-allowed font-bold text-sm transition-all flex items-center justify-center gap-2"
              >
                <Send className="w-4 h-4" />
                <span>
                  {busy ? 'PLEASE WAIT…' : resendWait > 0 ? `RESEND IN ${formatCountdown(resendWait)}` : 'RESEND LINK'}
                </span>
              </button>
              <button
                type="button"
                onClick={backToLogin}
                className="w-full py-3 rounded-2xl bg-[#695282] hover:bg-[#533d6b] text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
              >
                <LogIn className="w-4 h-4 text-[#ffd1b3]" />
                <span>BACK TO LOG IN</span>
              </button>
            </div>
          </div>
        ) : (
        <>
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
              onChange={(e) => {
                setEmail(e.target.value);
                setLoginLocked(false);
              }}
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
                onChange={(e) => {
                  setPassword(e.target.value);
                  setLoginLocked(false);
                }}
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
            {mode === 'login' && (
              <button
                type="button"
                onClick={() => {
                  setError(null);
                  setNotice(null);
                  setShowPassword(false);
                  setForgot(true);
                }}
                className="block ml-auto text-xs font-semibold text-[#695282] hover:text-[#533d6b]"
              >
                Forgot password?
              </button>
            )}
          </div>

          {error && (
            <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
              {error}
            </p>
          )}
          {notice && (
            <p role="status" className="text-sm text-[#2f5d50] bg-[#e6f4ef] border border-[#b9e5d8] rounded-xl px-4 py-2.5">
              {notice}
            </p>
          )}
          {/* Outside the error box so it stays (with its countdown) after a resend clears the error. */}
          {unverifiedEmail && (
            <button
              type="button"
              onClick={() => resend(unverifiedEmail)}
              disabled={busy || resendWait > 0}
              className="block mx-auto text-sm font-bold text-[#695282] hover:text-[#533d6b] underline underline-offset-2 disabled:opacity-60 disabled:no-underline disabled:cursor-not-allowed"
            >
              {resendWait > 0
                ? `Resend verification email in ${formatCountdown(resendWait)}`
                : 'Resend verification email'}
            </button>
          )}

          <button
            type="submit"
            disabled={busy || loginLocked}
            className={`w-full py-4 rounded-2xl text-white font-bold text-sm transition-all flex items-center justify-center gap-2 ${
              loginLocked
                ? 'bg-[#c9c3cc] cursor-not-allowed'
                : 'bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 shadow-lg hover:shadow-xl'
            }`}
          >
            {mode === 'login' ? <LogIn className="w-4 h-4 text-[#ffd1b3]" /> : <UserPlus className="w-4 h-4 text-[#ffd1b3]" />}
            <span>{busy ? 'PLEASE WAIT…' : mode === 'login' ? 'LOG IN' : 'CREATE ACCOUNT'}</span>
          </button>
        </form>
        </>
        )}
      </div>
    </div>
  );
};

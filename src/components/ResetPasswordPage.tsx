import React, { useEffect, useRef, useState } from 'react';
import { Check, Clock, X, Loader2, LogIn, ArrowLeft, KeyRound } from 'lucide-react';
import { ScoopVerseLogo } from './ScoopVerseLogo';
import { PasswordInput } from './PasswordInput';

interface Props {
  // Leave this page; openLogin opens the login modal on the landing page.
  onDone: (openLogin: boolean) => void;
}

type Status = 'checking' | 'ready' | 'done' | 'expired' | 'invalid' | 'error';

export const ResetPasswordPage: React.FC<Props> = ({ onDone }) => {
  const [token] = useState(() => new URLSearchParams(window.location.search).get('token') ?? '');
  const [status, setStatus] = useState<Status>('checking');
  const [message, setMessage] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const started = useRef(false);

  // Maps an API error response onto the page state.
  const applyError = (data: { code?: string; error?: string }) => {
    if (data.code === 'EXPIRED') setStatus('expired');
    else if (data.code === 'INVALID') setStatus('invalid');
    else setStatus('error');
    setMessage(data.error ?? 'Something went wrong. Please try again.');
  };

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    // Remove the token from the address bar and history; it's kept in state.
    window.history.replaceState(null, '', '/reset-password');

    fetch('/api/auth/reset-password/check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) setStatus('ready');
        else applyError(data);
      })
      .catch(() => {
        setStatus('error');
        setMessage('Could not reach the server. Please try again.');
      });
  }, [token]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    // Both fields go back to hidden every time the form is submitted.
    setShowPassword(false);
    setShowConfirm(false);
    setFormError(null);
    if (password !== confirm) {
      setFormError("The passwords don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token, password }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setPassword('');
        setConfirm('');
        setStatus('done');
        setMessage(data.message);
      } else if (data.code) {
        applyError(data);
      } else {
        setFormError(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setFormError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const icon = {
    checking: { el: <Loader2 className="w-8 h-8 animate-spin" />, bg: 'bg-[#efdbff]/70 text-[#695282]' },
    ready: { el: <KeyRound className="w-8 h-8" />, bg: 'bg-[#efdbff]/70 text-[#695282]' },
    done: { el: <Check className="w-8 h-8" />, bg: 'bg-[#b9e5d8] text-[#1c1c18]' },
    expired: { el: <Clock className="w-8 h-8" />, bg: 'bg-[#ffdcc5] text-[#7a5840]' },
    invalid: { el: <X className="w-8 h-8" />, bg: 'bg-[#fbeaea] text-[#a33a3a]' },
    error: { el: <X className="w-8 h-8" />, bg: 'bg-[#fbeaea] text-[#a33a3a]' },
  }[status];

  const title = {
    checking: 'Checking your link…',
    ready: 'Choose a New Password',
    done: 'Password Changed',
    expired: 'Link Expired',
    invalid: 'Link Not Valid',
    error: 'Something Went Wrong',
  }[status];

  return (
    <div className="min-h-screen bg-[#fdf9f3] bg-luminous-radial text-[#1c1c18] font-sans-ui flex flex-col items-center px-4 py-10 sm:py-16">
      <ScoopVerseLogo size="sm" />

      <div className="mt-10 w-full max-w-md bg-white/90 backdrop-blur-md rounded-3xl p-6 sm:p-10 border border-white shadow-xl text-center space-y-6">
        <div className={`w-16 h-16 rounded-full flex items-center justify-center mx-auto shadow-md ${icon.bg}`}>{icon.el}</div>

        <div className="space-y-2">
          <h1 className="font-serif-display text-3xl font-bold">{title}</h1>
          {message && status !== 'ready' && <p className="text-sm text-[#4a454e] leading-relaxed">{message}</p>}
          {(status === 'expired' || status === 'invalid') && (
            <p className="text-sm text-[#4a454e] leading-relaxed">
              Use <span className="font-semibold text-[#695282]">Forgot password?</span> on the login screen to get a new link.
            </p>
          )}
        </div>

        {status === 'ready' && (
          <form onSubmit={handleSubmit} className="space-y-4 text-left">
            <PasswordInput
              id="new-password"
              label="New password"
              value={password}
              onChange={setPassword}
              shown={showPassword}
              onToggleShown={() => setShowPassword((s) => !s)}
              autoComplete="new-password"
              placeholder="At least 8 characters"
            />
            <PasswordInput
              id="confirm-password"
              label="Confirm new password"
              value={confirm}
              onChange={setConfirm}
              shown={showConfirm}
              onToggleShown={() => setShowConfirm((s) => !s)}
              autoComplete="new-password"
              placeholder="Type it again"
            />
            {formError && (
              <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
                {formError}
              </p>
            )}
            <button
              type="submit"
              disabled={busy}
              className="w-full py-4 rounded-2xl bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
            >
              <KeyRound className="w-4 h-4 text-[#ffd1b3]" />
              <span>{busy ? 'PLEASE WAIT…' : 'CHANGE PASSWORD'}</span>
            </button>
          </form>
        )}

        {status !== 'checking' && status !== 'ready' && (
          <button
            onClick={() => onDone(true)}
            className="w-full py-4 rounded-2xl bg-[#695282] hover:bg-[#533d6b] text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4 text-[#ffd1b3]" />
            <span>{status === 'done' ? 'LOG IN' : 'GO TO LOG IN'}</span>
          </button>
        )}

        {status !== 'checking' && (
          <button
            onClick={() => onDone(false)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#695282] hover:text-[#533d6b]"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to ScoopVerse</span>
          </button>
        )}
      </div>
    </div>
  );
};

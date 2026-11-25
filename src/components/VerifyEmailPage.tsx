import React, { useEffect, useRef, useState } from 'react';
import { Check, Clock, X, Send, Loader2, LogIn, ArrowLeft } from 'lucide-react';
import { ScoopVerseLogo } from './ScoopVerseLogo';

interface Props {
  // Leave this page; openLogin opens the login modal on the landing page.
  onDone: (openLogin: boolean) => void;
}

type Status = 'verifying' | 'success' | 'expired' | 'invalid' | 'error';

export const VerifyEmailPage: React.FC<Props> = ({ onDone }) => {
  const [status, setStatus] = useState<Status>('verifying');
  const [message, setMessage] = useState('');
  const [email, setEmail] = useState('');
  const [resendState, setResendState] = useState<{ busy: boolean; note: string | null }>({ busy: false, note: null });
  const started = useRef(false);

  useEffect(() => {
    // Links are single-use, so make sure the token is only submitted once
    // (React StrictMode runs effects twice in development).
    if (started.current) return;
    started.current = true;

    const token = new URLSearchParams(window.location.search).get('token') ?? '';
    // Remove the token from the address bar and history.
    window.history.replaceState(null, '', '/verify-email');

    fetch('/api/auth/verify-email', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (res.ok) {
          setStatus('success');
          setMessage(data.message);
        } else if (data.code === 'EXPIRED') {
          setStatus('expired');
          setMessage(data.error);
        } else if (data.code === 'INVALID') {
          setStatus('invalid');
          setMessage(data.error);
        } else {
          setStatus('error');
          setMessage(data.error ?? 'Something went wrong. Please try again.');
        }
      })
      .catch(() => {
        setStatus('error');
        setMessage('Could not reach the server. Please try again.');
      });
  }, []);

  const resend = async (e: React.FormEvent) => {
    e.preventDefault();
    setResendState({ busy: true, note: null });
    try {
      const res = await fetch('/api/auth/resend-verification', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      setResendState({ busy: false, note: data.message ?? data.error ?? 'Something went wrong.' });
    } catch {
      setResendState({ busy: false, note: 'Could not reach the server. Please try again.' });
    }
  };

  const icon = {
    verifying: { el: <Loader2 className="w-8 h-8 animate-spin" />, bg: 'bg-[#efdbff]/70 text-[#695282]' },
    success: { el: <Check className="w-8 h-8" />, bg: 'bg-[#b9e5d8] text-[#1c1c18]' },
    expired: { el: <Clock className="w-8 h-8" />, bg: 'bg-[#ffdcc5] text-[#7a5840]' },
    invalid: { el: <X className="w-8 h-8" />, bg: 'bg-[#fbeaea] text-[#a33a3a]' },
    error: { el: <X className="w-8 h-8" />, bg: 'bg-[#fbeaea] text-[#a33a3a]' },
  }[status];

  const title = {
    verifying: 'Verifying your email…',
    success: 'Email Verified',
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
          {message && <p className="text-sm text-[#4a454e] leading-relaxed">{message}</p>}
        </div>

        {status === 'success' && (
          <button
            onClick={() => onDone(true)}
            className="w-full py-4 rounded-2xl bg-[#695282] hover:bg-[#533d6b] text-white font-bold text-sm shadow-lg hover:shadow-xl transition-all flex items-center justify-center gap-2"
          >
            <LogIn className="w-4 h-4 text-[#ffd1b3]" />
            <span>LOG IN</span>
          </button>
        )}

        {(status === 'expired' || status === 'invalid') && (
          <form onSubmit={resend} className="space-y-3 text-left">
            <label htmlFor="resend-email" className="text-xs font-bold uppercase tracking-wider block">
              Get a new link
            </label>
            <input
              id="resend-email"
              type="email"
              required
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="enter.your.email@domain.com"
              className="w-full px-5 py-3.5 rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc] focus:border-[#9d84b7] focus:bg-white focus:outline-hidden text-sm transition-all placeholder-[#7b757e]"
            />
            <button
              type="submit"
              disabled={resendState.busy}
              className="w-full py-3.5 rounded-2xl bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4 text-[#ffd1b3]" />
              <span>{resendState.busy ? 'PLEASE WAIT…' : 'SEND NEW LINK'}</span>
            </button>
            {resendState.note && (
              <p role="status" className="text-sm text-[#4a454e] bg-[#f7f3ed] border border-[#e6e2dc] rounded-xl px-4 py-2.5">
                {resendState.note}
              </p>
            )}
          </form>
        )}

        {status !== 'verifying' && (
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

import React, { useState } from 'react';
import { KeyRound, Send, ArrowLeft } from 'lucide-react';
import { formatCountdown, useCountdown } from '../useCountdown';

interface Props {
  initialEmail: string;
  onBack: () => void;
}

// "Forgot password?" view inside the login modal: asks for an email and sends a reset link.
export const ForgotPasswordView: React.FC<Props> = ({ initialEmail, onBack }) => {
  const [email, setEmail] = useState(initialEmail);
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  // Seconds until the server allows another reset email.
  const [wait, startWait] = useCountdown();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (wait > 0) return;
    setBusy(true);
    setNotice(null);
    setError(null);
    try {
      const res = await fetch('/api/auth/forgot-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        startWait(data.nextResendInSeconds);
        setNotice(data.message);
      } else {
        if (data.retryAfterSeconds) startWait(data.retryAfterSeconds);
        setError(data.error ?? 'Something went wrong. Please try again.');
      }
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4 text-left">
      <div className="w-16 h-16 rounded-full bg-[#efdbff]/70 border border-[#9d84b7]/20 text-[#695282] flex items-center justify-center mx-auto">
        <KeyRound className="w-7 h-7" />
      </div>
      <p className="text-sm text-[#4a454e] leading-relaxed text-center">
        Enter the email you registered with and we&apos;ll send you a link to choose a new password.
      </p>
      <div className="space-y-2">
        <label htmlFor="forgot-email" className="text-xs font-bold uppercase tracking-wider text-[#1c1c18] block">
          Email
        </label>
        <input
          id="forgot-email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="enter.your.email@domain.com"
          className="w-full px-5 py-3.5 rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc] focus:border-[#9d84b7] focus:bg-white focus:outline-hidden text-sm transition-all text-[#1c1c18] placeholder-[#7b757e]"
        />
      </div>

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

      <button
        type="submit"
        disabled={busy || wait > 0}
        className="w-full py-4 rounded-2xl bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 disabled:hover:bg-[#695282] disabled:cursor-not-allowed text-white font-bold text-sm shadow-lg transition-all flex items-center justify-center gap-2"
      >
        <Send className="w-4 h-4 text-[#ffd1b3]" />
        <span>
          {busy ? 'PLEASE WAIT…' : wait > 0 ? `SEND AGAIN IN ${formatCountdown(wait)}` : notice ? 'SEND AGAIN' : 'SEND RESET LINK'}
        </span>
      </button>

      <button
        type="button"
        onClick={onBack}
        className="flex items-center justify-center gap-2 mx-auto text-sm font-semibold text-[#695282] hover:text-[#533d6b]"
      >
        <ArrowLeft className="w-4 h-4" />
        <span>Back to log in</span>
      </button>
    </form>
  );
};

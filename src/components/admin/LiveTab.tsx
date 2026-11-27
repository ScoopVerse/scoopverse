import React, { useEffect, useState } from 'react';

interface Props {
  onSessionExpired: () => void;
}

// The one-click "Live now" switch: while on, shoppers can pick the Go Live price on scoops.
export const LiveTab: React.FC<Props> = ({ onSessionExpired }) => {
  const [live, setLive] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/products/live')
      .then((r) => r.json())
      .then((d) => setLive(d.live === true))
      .catch(() => setError('Could not load the live status. Please refresh.'));
  }, []);

  const toggle = async () => {
    if (live === null) return;
    setError(null);
    try {
      const res = await fetch('/api/admin/products/live', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ live: !live }),
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Please try again.');
      setLive(data.live);
    } catch {
      setError('Could not reach the server. Please try again.');
    }
  };

  return (
    <div className="space-y-4">
      <div className={`flex items-center gap-5 rounded-3xl border p-6 ${live ? 'bg-[#e6f4ef] border-[#b9e5d8]' : 'bg-white border-[#efe7f5]'}`}>
        <button
          role="switch"
          aria-checked={live === true}
          aria-label="Live now"
          onClick={toggle}
          disabled={live === null}
          className={`relative w-16 h-9 rounded-full shrink-0 transition-colors disabled:opacity-50 ${live ? 'bg-[#2f8f6b]' : 'bg-[#c9c3cc]'}`}
        >
          <span className={`absolute top-1 w-7 h-7 rounded-full bg-white shadow-sm transition-all ${live ? 'left-8' : 'left-1'}`} />
        </button>
        <div className="min-w-0">
          <p className="font-bold text-lg text-[#1c1c18]">{live === null ? 'Loading…' : live ? 'You are live now' : 'Not live'}</p>
          <p className="text-sm text-[#4a454e]">
            {live
              ? 'Shoppers can choose the Go Live price on scoops. Turn this off when your live ends.'
              : 'Turn this on when you start a TikTok or IG live. The Go Live option on scoops stays closed until then.'}
          </p>
        </div>
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}
    </div>
  );
};

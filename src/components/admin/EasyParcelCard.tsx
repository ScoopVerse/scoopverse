import React, { useEffect, useState } from 'react';
import { CircleAlert, CircleCheck, Truck } from 'lucide-react';

interface Status {
  configured: boolean;
  connected: boolean;
  problem?: string;
  wallet?: { wallet?: { balance: number; currency: string }[] } | null;
}

// Overview card for the EasyParcel link: is it connected, and a button to connect (or connect again).
export const EasyParcelCard: React.FC<{ onSessionExpired: () => void }> = ({ onSessionExpired }) => {
  const [status, setStatus] = useState<Status | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  // EasyParcel sends the admin back to /admin?easyparcel=ok or =failed; show that once, then tidy the address.
  const [returned] = useState(() => new URLSearchParams(window.location.search).get('easyparcel'));

  useEffect(() => {
    if (returned) window.history.replaceState(null, '', '/admin#overview');
    fetch('/api/admin/easyparcel')
      .then(async (res) => {
        if (res.status === 401) return onSessionExpired();
        setStatus(await res.json());
      })
      .catch(() => setError('Could not check the EasyParcel connection.'));
  }, []);

  const connect = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/admin/easyparcel/connect', { method: 'POST' });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Please try again.');
      window.location.href = data.url; // EasyParcel's login and "allow access" page
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#efe7f5] shadow-xs space-y-3">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#efdbff]/70 text-[#695282] flex items-center justify-center shrink-0">
          <Truck className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-serif-display text-xl font-bold">Shipping with EasyParcel</h2>
          <p className="text-sm text-[#7b757e]">Used to get delivery prices and book couriers.</p>
        </div>
      </div>

      {returned === 'ok' && (
        <p role="status" className="text-sm text-[#2f5d50] bg-[#e6f4ef] border border-[#b9e5d8] rounded-xl px-4 py-2.5">
          EasyParcel is now connected.
        </p>
      )}
      {returned === 'failed' && (
        <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
          The connection did not finish. Please try again.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      {!status ? (
        <p className="text-sm text-[#7b757e]">Checking…</p>
      ) : !status.configured ? (
        <p className="text-sm text-[#8a5a1c] bg-[#fff4e6] border border-[#f3d9b5] rounded-xl px-4 py-2.5">
          The EasyParcel keys are not set on the server yet (EASYPARCEL_CLIENT_ID and EASYPARCEL_CLIENT_SECRET).
        </p>
      ) : (
        <div className="flex flex-wrap items-center gap-3">
          {status.connected ? (
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[#2f5d50]">
              <CircleCheck className="w-4 h-4" />
              Connected
              {status.wallet?.wallet?.[0] && (
                <span className="font-normal text-[#4a454e] ml-1">
                  Wallet {status.wallet.wallet[0].currency} {status.wallet.wallet[0].balance.toFixed(2)}
                </span>
              )}
            </span>
          ) : (
            <span className="inline-flex items-center gap-2 text-sm font-bold text-[#8a5a1c]">
              <CircleAlert className="w-4 h-4" />
              {status.problem ?? 'Not connected yet'}
            </span>
          )}
          <button
            onClick={connect}
            disabled={busy}
            className="text-sm font-bold text-white bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 px-5 py-2 rounded-full shadow-sm transition-all"
          >
            {busy ? 'Opening…' : status.connected ? 'Connect again' : 'Connect EasyParcel'}
          </button>
        </div>
      )}
    </div>
  );
};

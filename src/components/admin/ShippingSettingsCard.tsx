import React, { useEffect, useState } from 'react';
import { MapPinned } from 'lucide-react';
import { WEST_ONLY_MESSAGE, deliversTo, nationalPhone, stateForPostcode, stateName } from '../../malaysia';
import { centsToDollars, dollarsToCents } from '../../money';

interface Loaded {
  pickup: { name: string; phone: string; line1: string; line2: string; city: string; postcode: string };
  freeOverCents: number;
  saved: boolean;
}

const inputClass =
  'w-full px-4 py-3 rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc] focus:border-[#9d84b7] focus:bg-white focus:outline-hidden text-sm transition-all text-[#1c1c18] placeholder-[#7b757e]';
const labelClass = 'text-xs font-bold uppercase tracking-wider text-[#7b757e] block';

// Overview card: where parcels are picked up from, and the order total above which delivery is free.
export const ShippingSettingsCard: React.FC<{ onSessionExpired: () => void }> = ({ onSessionExpired }) => {
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [pickup, setPickup] = useState<Loaded['pickup'] | null>(null);
  const [freeOver, setFreeOver] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const show = (d: Loaded) => {
    setLoaded(d);
    setPickup({ ...d.pickup, phone: nationalPhone(d.pickup.phone) });
    setFreeOver(centsToDollars(d.freeOverCents));
  };

  useEffect(() => {
    fetch('/api/admin/shipping')
      .then(async (res) => {
        if (res.status === 401) return onSessionExpired();
        show(await res.json());
      })
      .catch(() => setError('Could not load the shipping settings.'));
  }, []);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pickup) return;
    const cents = /^\s*0(\.0{1,2})?\s*$/.test(freeOver) ? 0 : dollarsToCents(freeOver); // 0 = never free
    if (cents === null) return setError('Please enter the free delivery amount in RM, like 150 (0 for never free).');
    setBusy(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch('/api/admin/shipping', { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ pickup, freeOverCents: cents }) });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Please try again.');
      show(data);
      setNotice('Saved.');
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const set = (k: keyof Loaded['pickup'], v: string) => setPickup((p) => p && { ...p, [k]: k === 'postcode' ? v.replace(/\D/g, '') : v });
  const state = pickup ? stateForPostcode(pickup.postcode) : null;
  const field = (k: Exclude<keyof Loaded['pickup'], 'postcode'>, label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <label htmlFor={`ship-${k}`} className={labelClass}>{label}</label>
      <input id={`ship-${k}`} value={pickup![k]} onChange={(e) => set(k, e.target.value)} className={inputClass} {...extra} />
    </div>
  );

  return (
    <div className="bg-white rounded-3xl p-6 border border-[#efe7f5] shadow-xs space-y-4">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-[#efdbff]/70 text-[#695282] flex items-center justify-center shrink-0">
          <MapPinned className="w-5 h-5" />
        </div>
        <div>
          <h2 className="font-serif-display text-xl font-bold">Pickup and free delivery</h2>
          <p className="text-sm text-[#7b757e]">Where couriers collect parcels, and when delivery is free.</p>
        </div>
      </div>

      {loaded && !loaded.saved && (
        <p className="text-sm text-[#8a5a1c] bg-[#fff4e6] border border-[#f3d9b5] rounded-xl px-4 py-2.5">
          These are placeholder details for testing (only the postcode is real). Save your real pickup details before going live.
        </p>
      )}
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

      {!pickup ? (
        <p className="text-sm text-[#7b757e]">Loading…</p>
      ) : (
        <form onSubmit={save} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {field('name', 'Sender name', { required: true, maxLength: 60 })}
            {field('phone', 'Sender phone', { required: true, maxLength: 20, inputMode: 'tel', placeholder: '012-345 6789' })}
            {field('line1', 'Address line 1', { required: true, maxLength: 100 })}
            {field('line2', 'Address line 2 (optional)', { maxLength: 100 })}
            <div className="space-y-1.5">
              <label htmlFor="ship-postcode" className={labelClass}>Postcode</label>
              <input id="ship-postcode" value={pickup.postcode} onChange={(e) => set('postcode', e.target.value)} inputMode="numeric" maxLength={5} pattern="\d{5}" title="5 digits" required className={inputClass} />
            </div>
            {field('city', 'City or town', { required: true, maxLength: 50 })}
            <div className="space-y-1.5">
              <span className={labelClass} id="ship-state">State</span>
              <p aria-labelledby="ship-state" className={`${inputClass} bg-[#efe9f3] ${state ? 'text-[#1c1c18]' : 'text-[#7b757e]'}`}>
                {state ? stateName(state) : 'Filled in from the postcode'}
              </p>
              {pickup.postcode.length === 5 && !state && <p role="alert" className="text-xs text-[#a33a3a]">Postcode not recognised.</p>}
              {state && !deliversTo(state) && <p role="alert" className="text-xs text-[#a33a3a]">{WEST_ONLY_MESSAGE}</p>}
            </div>
            <div className="space-y-1.5">
              <label htmlFor="ship-free" className={labelClass}>Free delivery from (RM)</label>
              <input id="ship-free" value={freeOver} onChange={(e) => setFreeOver(e.target.value)} inputMode="decimal" required className={inputClass} />
              <p className="text-xs text-[#7b757e]">Orders at or above this amount ship free. 0 means never free. 150 is a starting value, not a recommendation.</p>
            </div>
          </div>
          <div className="flex justify-end">
            <button type="submit" disabled={busy} className="text-sm font-bold text-white bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 px-5 py-2 rounded-full shadow-sm transition-all">
              {busy ? 'Saving…' : 'Save'}
            </button>
          </div>
        </form>
      )}
    </div>
  );
};

import React, { useEffect, useRef, useState } from 'react';
import { MapPin, X } from 'lucide-react';
import type { Address } from '../types';
import { nationalPhone, stateForPostcode, stateName } from '../malaysia';

const MAX_ADDRESSES = 5; // must match server/addresses.ts

const round = 'inline-flex h-11 w-11 items-center justify-center rounded-full border border-rule text-ink-2 transition-colors hover:border-accent hover:text-accent';
const link = 'inline-flex min-h-11 items-center px-2 text-sm font-semibold text-accent underline-offset-4 hover:underline';
const field = 'block min-h-11 w-full rounded-card border border-rule bg-paper px-3 text-ink placeholder:text-muted focus:border-accent';
const label = 'block text-sm font-semibold text-ink-2';

// The state is not in the form: it follows from the postcode (shown read-only, and worked out again by the server).
type Form = { name: string; phone: string; line1: string; line2: string; city: string; postcode: string; note: string; isDefault: boolean };
const EMPTY: Form = { name: '', phone: '', line1: '', line2: '', city: '', postcode: '', note: '', isDefault: false };

// The signed-in customer's saved delivery addresses, sliding over the shop from the right (same behaviour as the cart).
export const AddressDrawer: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const ref = useRef<HTMLDivElement>(null);
  const [addresses, setAddresses] = useState<Address[] | null>(null);
  // null = showing the list; otherwise the form, for a new address (id null) or an edit.
  const [editing, setEditing] = useState<{ id: string | null; form: Form } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    let current = true;
    fetch('/api/addresses')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => current && setAddresses(d?.addresses ?? []))
      .catch(() => current && setError('Could not load your addresses. Please try again.'));
    return () => {
      current = false;
    };
  }, []);

  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const panel = ref.current!;
    panel.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') return onClose();
      if (e.key !== 'Tab') return;
      const items = [...panel.querySelectorAll<HTMLElement>('button:not(:disabled), a[href], input, select')];
      if (items.length === 0) return e.preventDefault();
      const first = items[0];
      const last = items[items.length - 1];
      const active = document.activeElement;
      if (e.shiftKey && (active === first || active === panel)) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey);
    const scroll = document.documentElement.style.overflow;
    document.documentElement.style.overflow = 'hidden';
    return () => {
      window.removeEventListener('keydown', onKey);
      document.documentElement.style.overflow = scroll;
      opener?.focus();
    };
  }, [onClose]);

  // Sends one change; on success shows the updated list. Returns true when it worked.
  const send = async (method: string, path: string, body?: unknown) => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/addresses${path}`, { method, headers: body ? { 'Content-Type': 'application/json' } : undefined, body: body ? JSON.stringify(body) : undefined });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError(data.error ?? 'Something went wrong. Please try again.');
        return false;
      }
      setAddresses(data.addresses);
      return true;
    } catch {
      setError('Something went wrong. Please try again.');
      return false;
    } finally {
      setBusy(false);
    }
  };

  const startEdit = (a: Address | null) => {
    setError(null);
    setConfirmDelete(null);
    setEditing(a ? { id: a.id, form: { name: a.name, phone: nationalPhone(a.phone), line1: a.line1, line2: a.line2, city: a.city, postcode: a.postcode, note: a.note, isDefault: a.isDefault } } : { id: null, form: EMPTY });
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editing) return;
    const ok = editing.id ? await send('PUT', `/${editing.id}`, editing.form) : await send('POST', '', editing.form);
    if (ok) setEditing(null);
  };

  const set = (k: keyof Form, v: string | boolean) => setEditing((cur) => cur && { ...cur, form: { ...cur.form, [k]: v } });
  const list = addresses ?? [];
  const f = editing?.form;
  const state = f ? stateForPostcode(f.postcode) : null;
  // Nothing to choose when this is the only address, or it already is the default.
  const showDefaultBox = editing && (editing.id ? list.length > 1 && !f!.isDefault : list.length > 0);

  return (
    <div className="fixed inset-0 z-50 bg-ink/40" onClick={onClose}>
      <div
        ref={ref}
        tabIndex={-1}
        role="dialog"
        aria-modal="true"
        aria-label="Your addresses"
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-y-0 right-0 flex w-full max-w-md flex-col bg-paper shadow-xl outline-none"
      >
        <div className="flex items-center justify-between gap-4 border-b border-rule px-6 py-4">
          <h2 className="text-2xl">{editing ? (editing.id ? 'Edit address' : 'New address') : 'Your addresses'}</h2>
          <button type="button" onClick={onClose} aria-label="Close addresses" className={round}>
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        {editing && f ? (
          <form onSubmit={submit} className="flex min-h-0 flex-1 flex-col">
            <div className="flex-1 space-y-4 overflow-y-auto px-6 py-5">
              <label className="block space-y-1">
                <span className={label}>Receiver’s name</span>
                <input className={field} value={f.name} onChange={(e) => set('name', e.target.value)} autoComplete="name" maxLength={60} required />
              </label>
              <label className="block space-y-1">
                <span className={label}>Phone number</span>
                <input className={field} value={f.phone} onChange={(e) => set('phone', e.target.value)} autoComplete="tel" inputMode="tel" placeholder="012-345 6789" maxLength={20} required />
              </label>
              <label className="block space-y-1">
                <span className={label}>Address line 1</span>
                <input className={field} value={f.line1} onChange={(e) => set('line1', e.target.value)} autoComplete="address-line1" maxLength={100} required />
              </label>
              <label className="block space-y-1">
                <span className={label}>Address line 2 (optional)</span>
                <input className={field} value={f.line2} onChange={(e) => set('line2', e.target.value)} autoComplete="address-line2" maxLength={100} />
              </label>
              <div className="grid grid-cols-[minmax(0,2fr)_minmax(0,3fr)] gap-4">
                <label className="block space-y-1">
                  <span className={label}>Postcode</span>
                  <input className={`${field} num`} value={f.postcode} onChange={(e) => set('postcode', e.target.value.replace(/\D/g, ''))} autoComplete="postal-code" inputMode="numeric" maxLength={5} pattern="\d{5}" title="5 digits" required />
                </label>
                <label className="block space-y-1">
                  <span className={label}>City or town</span>
                  <input className={field} value={f.city} onChange={(e) => set('city', e.target.value)} autoComplete="address-level2" maxLength={50} required />
                </label>
              </div>
              <div className="space-y-1">
                <span className={label} id="address-state-label">State</span>
                <p aria-labelledby="address-state-label" className={`${field} flex items-center bg-paper-2 ${state ? 'text-ink' : 'text-muted'}`}>
                  {state ? stateName(state) : 'Filled in from your postcode'}
                </p>
                {f.postcode.length === 5 && !state && <p role="alert" className="text-sm text-error">We don’t recognise this postcode. Please check it.</p>}
              </div>
              <label className="block space-y-1">
                <span className={label}>Delivery note (optional)</span>
                <input className={field} value={f.note} onChange={(e) => set('note', e.target.value)} maxLength={200} placeholder="e.g. guardhouse, call on arrival" />
              </label>
              <p className="text-sm text-muted">We deliver within Malaysia.</p>
              {showDefaultBox && (
                <label className="flex min-h-11 items-center gap-3">
                  <input type="checkbox" checked={f.isDefault} onChange={(e) => set('isDefault', e.target.checked)} className="h-5 w-5 accent-accent" />
                  <span>Use this as my default address</span>
                </label>
              )}
            </div>
            <div className="space-y-3 border-t border-rule px-6 py-5">
              {error && (
                <p role="alert" className="text-sm text-error">
                  {error}
                </p>
              )}
              <div className="flex gap-3">
                <button type="button" onClick={() => { setEditing(null); setError(null); }} className="btn btn-quiet">
                  Cancel
                </button>
                <button type="submit" disabled={busy} className="btn btn-primary flex-1">
                  {busy ? 'Saving…' : 'Save address'}
                </button>
              </div>
            </div>
          </form>
        ) : (
          <>
            {list.length === 0 ? (
              <div className="flex flex-1 flex-col items-start gap-4 px-6 py-10">
                <MapPin className="h-8 w-8 text-accent" aria-hidden />
                <p className="text-ink-2">{addresses ? 'You have no saved addresses yet.' : 'Loading your addresses…'}</p>
              </div>
            ) : (
              <ul className="flex-1 divide-y divide-rule overflow-y-auto px-6">
                {list.map((a) => (
                  <li key={a.id} className="space-y-1 py-5">
                    <p className="font-semibold [overflow-wrap:anywhere]">
                      {a.name}
                      {a.isDefault && <span className="ml-2 rounded-full bg-paper-3 px-2 py-0.5 text-sm font-semibold text-accent-deep">Default</span>}
                    </p>
                    <p className="text-ink-2 [overflow-wrap:anywhere]">
                      {a.line1}
                      {a.line2 && <>, {a.line2}</>}
                      <br />
                      {a.postcode} {a.city}, {stateName(a.state)}
                    </p>
                    <p className="num text-sm text-muted">{nationalPhone(a.phone)}</p>
                    {a.note && <p className="text-sm text-muted [overflow-wrap:anywhere]">Note: {a.note}</p>}
                    <div className="-ml-2 flex flex-wrap items-center gap-1 pt-1">
                      <button type="button" onClick={() => startEdit(a)} className={link}>
                        Edit
                      </button>
                      {!a.isDefault && (
                        <button type="button" disabled={busy} onClick={() => send('PUT', `/${a.id}`, { ...a, isDefault: true })} className={link}>
                          Make default
                        </button>
                      )}
                      {confirmDelete === a.id ? (
                        <button type="button" disabled={busy} onClick={async () => { if (await send('DELETE', `/${a.id}`)) setConfirmDelete(null); }} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-error underline-offset-4 hover:underline">
                          Yes, delete
                        </button>
                      ) : (
                        <button type="button" onClick={() => setConfirmDelete(a.id)} className="inline-flex min-h-11 items-center px-2 text-sm font-semibold text-muted underline-offset-4 hover:text-error hover:underline">
                          Delete
                        </button>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            )}
            <div className="space-y-3 border-t border-rule px-6 py-5">
              {error && (
                <p role="alert" className="text-sm text-error">
                  {error}
                </p>
              )}
              {list.length >= MAX_ADDRESSES && <p className="text-sm text-muted">You can save up to {MAX_ADDRESSES} addresses. Delete one to add another.</p>}
              <button type="button" onClick={() => startEdit(null)} disabled={!addresses || list.length >= MAX_ADDRESSES} className="btn btn-primary w-full">
                Add an address
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

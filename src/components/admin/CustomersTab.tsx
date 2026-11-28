import React, { useEffect, useRef, useState } from 'react';
import { BadgeCheck, BookUser, Check, ChevronDown, ChevronLeft, ChevronRight, KeyRound, Pencil, Phone, Search, Trash2, UserRound, X } from 'lucide-react';
import type { Address } from '../../types';
import { WEST_ONLY_MESSAGE, deliversTo, nationalPhone, stateForPostcode, stateName } from '../../malaysia';

interface Customer {
  id: string;
  name: string;
  email: string;
  joinedAt: string;
  emailVerified: boolean;
  addresses: Address[]; // default first; not sent back when the customer is edited
}

interface Props {
  // Called when the server says the admin session has ended.
  onSessionExpired: () => void;
}

// Must match BATCH_MAX in server/admin.ts.
const BATCH_MAX = 50;
const RESET_MAX = 20; // must match RESET_MAX in server/admin.ts

const inputClass =
  'w-full px-4 py-3 rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc] focus:border-[#9d84b7] focus:bg-white focus:outline-hidden text-sm transition-all text-[#1c1c18] placeholder-[#7b757e]';
const labelClass = 'text-xs font-bold uppercase tracking-wider text-[#7b757e] block';
const checkboxClass = 'w-4 h-4 rounded accent-[#695282] cursor-pointer';
const COLUMNS = 'grid-cols-[2.5rem_1fr_1.5rem] md:grid-cols-[2.5rem_1fr_1.3fr_10rem_1.5rem]';

const initials = (name: string) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]!.toUpperCase())
    .join('') || '?';

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-SG', { day: 'numeric', month: 'short', year: 'numeric' });

// Page buttons to show, e.g. 1 … 4 5 6 … 20.
function pageList(current: number, last: number): (number | '…')[] {
  if (last <= 7) return Array.from({ length: last }, (_, i) => i + 1);
  const pages = new Set([1, last, current - 1, current, current + 1].filter((p) => p >= 1 && p <= last));
  const sorted = [...pages].sort((a, b) => a - b);
  const out: (number | '…')[] = [];
  sorted.forEach((p, i) => {
    if (i > 0 && p - sorted[i - 1]! > 1) out.push('…');
    out.push(p);
  });
  return out;
}

async function postJson(url: string, body: unknown) {
  const res = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  return { res, data: await res.json().catch(() => ({})) };
}

export const CustomersTab: React.FC<Props> = ({ onSessionExpired }) => {
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [total, setTotal] = useState(0);
  const [pageSize, setPageSize] = useState(15);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState('');
  const [search, setSearch] = useState(''); // query after a short typing pause
  // Email status filters: both on shows everyone, both off shows no one.
  const [showVerified, setShowVerified] = useState(true);
  const [showUnverified, setShowUnverified] = useState(true);
  const [reloadKey, setReloadKey] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<Customer | null>(null);
  // Ticked customers, kept while moving between pages and searches.
  const [selected, setSelected] = useState<Map<string, Customer>>(new Map());
  const [batch, setBatch] = useState<'delete' | 'reset' | null>(null);
  // Ignores answers to requests that have since been replaced by a newer one.
  const requestSeq = useRef(0);

  // Search as you type, after a short pause, starting from page 1.
  useEffect(() => {
    const t = setTimeout(() => {
      setSearch(query.trim());
      setPage(1);
    }, 250);
    return () => clearTimeout(t);
  }, [query]);

  useEffect(() => {
    const seq = ++requestSeq.current;
    setError(null);
    setOpenId(null);
    setEditingId(null);
    // Both filters off: nothing to show.
    if (!showVerified && !showUnverified) {
      setCustomers([]);
      setTotal(0);
      setLoading(false);
      return;
    }
    setLoading(true);
    const verified = showVerified && showUnverified ? '' : showVerified ? 'yes' : 'no';
    fetch(`/api/admin/customers?q=${encodeURIComponent(search)}&verified=${verified}&offset=${(page - 1) * pageSize}`)
      .then(async (res) => {
        if (res.status === 401) return onSessionExpired();
        const data = await res.json();
        if (seq !== requestSeq.current) return;
        if (!res.ok) throw new Error(data.error);
        // The page emptied (e.g. its customers were deleted): go back one.
        if (data.customers.length === 0 && page > 1) return setPage((p) => p - 1);
        setCustomers(data.customers);
        setTotal(data.total);
        setPageSize(data.pageSize);
        setLoading(false);
      })
      .catch(() => {
        if (seq !== requestSeq.current) return;
        setError('Could not load customers. Please try again.');
        setLoading(false);
      });
  }, [search, page, reloadKey, showVerified, showUnverified]);

  const toggleFilter = (which: 'verified' | 'unverified') => {
    if (which === 'verified') setShowVerified((v) => !v);
    else setShowUnverified((v) => !v);
    setPage(1);
  };
  const filtering = !!search || !showVerified || !showUnverified;

  const reload = () => setReloadKey((k) => k + 1);
  const lastPage = Math.max(1, Math.ceil(total / pageSize));

  const toggleOpen = (id: string) => {
    setOpenId((cur) => (cur === id ? null : id));
    setEditingId(null);
  };

  const toggleSelected = (c: Customer) =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (next.has(c.id)) next.delete(c.id);
      else next.set(c.id, c);
      return next;
    });

  const pageAllSelected = customers.length > 0 && customers.every((c) => selected.has(c.id));
  const pageSomeSelected = customers.some((c) => selected.has(c.id));
  const togglePage = () =>
    setSelected((prev) => {
      const next = new Map(prev);
      if (pageAllSelected) customers.forEach((c) => next.delete(c.id));
      else customers.forEach((c) => next.set(c.id, c));
      return next;
    });

  const unselect = (ids: string[]) =>
    setSelected((prev) => {
      const next = new Map(prev);
      ids.forEach((id) => next.delete(id));
      return next;
    });

  const replaceCustomer = (c: Customer) => {
    setCustomers((list) => list.map((x) => (x.id === c.id ? c : x)));
    setSelected((prev) => (prev.has(c.id) ? new Map(prev).set(c.id, c) : prev));
  };

  const first = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const lastShown = Math.min(page * pageSize, total);

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center gap-3 sm:justify-between">
        <div className="relative w-full sm:max-w-sm">
          <Search className="w-4 h-4 text-[#7b757e] absolute left-4 top-1/2 -translate-y-1/2" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name or email"
            aria-label="Search customers"
            className={`${inputClass} pl-11 bg-white`}
          />
        </div>
        <p className="text-sm text-[#7b757e]">
          {total} {total === 1 ? 'customer' : 'customers'}
          {filtering && ' found'}
        </p>
      </div>

      <div role="group" aria-label="Filter by email status" className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-bold uppercase tracking-wider text-[#7b757e] mr-1">Show</span>
        <FilterToggle label="Verified" on={showVerified} tone="green" onClick={() => toggleFilter('verified')} />
        <FilterToggle label="Not Verified" on={showUnverified} tone="amber" onClick={() => toggleFilter('unverified')} />
      </div>

      {/* Batch actions for the ticked customers */}
      {selected.size > 0 && (
        <div className="sticky top-[7.5rem] z-20 flex flex-wrap items-center gap-2 bg-[#2d2438] text-white rounded-2xl px-4 py-3 shadow-lg">
          <span className="text-sm font-bold mr-1">{selected.size} selected</span>
          <button onClick={() => setSelected(new Map())} className="text-sm font-semibold text-[#d9c8ec] hover:text-white underline underline-offset-2">
            Clear
          </button>
          {selected.size > BATCH_MAX ? (
            <span className="text-xs text-[#ffd1b3]">Batch actions work on up to {BATCH_MAX} customers at a time.</span>
          ) : (
            selected.size > RESET_MAX && <span className="text-xs text-[#ffd1b3]">Password resets work on up to {RESET_MAX} customers at a time.</span>
          )}
          <div className="flex gap-2 ml-auto">
            <button
              onClick={() => setBatch('reset')}
              disabled={selected.size > RESET_MAX}
              className="inline-flex items-center gap-2 text-sm font-bold bg-white/10 hover:bg-white/20 disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-full transition-all"
            >
              <KeyRound className="w-4 h-4 text-[#ffd1b3]" />
              Send password reset
            </button>
            <button
              onClick={() => setBatch('delete')}
              disabled={selected.size > BATCH_MAX}
              className="inline-flex items-center gap-2 text-sm font-bold bg-[#a33a3a] hover:bg-[#862e2e] disabled:opacity-40 disabled:cursor-not-allowed px-4 py-2 rounded-full transition-all"
            >
              <Trash2 className="w-4 h-4" />
              Delete
            </button>
          </div>
        </div>
      )}

      {notice && (
        <p role="status" className="flex items-start gap-2 text-sm text-[#2f5d50] bg-[#e6f4ef] border border-[#b9e5d8] rounded-xl px-4 py-2.5">
          <span className="flex-1">{notice}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-[#2f5d50]/70 hover:text-[#2f5d50]">
            <X className="w-4 h-4" />
          </button>
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}

      <div className="bg-white rounded-3xl border border-[#efe7f5] shadow-xs overflow-hidden">
        <div className="flex items-center border-b border-[#efe7f5] bg-[#fdf9f3] text-xs font-bold uppercase tracking-wider text-[#7b757e]">
          <label className="pl-5 pr-1 py-3 flex items-center gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={pageAllSelected}
              ref={(el) => {
                if (el) el.indeterminate = !pageAllSelected && pageSomeSelected;
              }}
              onChange={togglePage}
              disabled={customers.length === 0}
              aria-label="Select all customers on this page"
              className={checkboxClass}
            />
            <span className="md:hidden">Select page</span>
          </label>
          {/* Column headings (wide screens only) */}
          <div className={`hidden md:grid flex-1 ${COLUMNS} gap-4 items-center px-4 py-3`}>
            <span />
            <span>Name</span>
            <span>Email</span>
            <span>Order Status</span>
            <span />
          </div>
        </div>

        {customers.length === 0 && !loading && (
          <div className="px-5 py-14 text-center text-sm text-[#7b757e]">
            {!showVerified && !showUnverified
              ? 'Turn on Verified or Not Verified to see customers.'
              : filtering
                ? 'No customers match your search or filters.'
                : 'No customers yet.'}
          </div>
        )}

        <ul className={`divide-y divide-[#efe7f5] transition-opacity ${loading ? 'opacity-50' : ''}`}>
          {customers.map((c) => (
            <CustomerRow
              key={c.id}
              customer={c}
              open={openId === c.id}
              editing={editingId === c.id}
              selected={selected.has(c.id)}
              onToggleSelected={() => toggleSelected(c)}
              onToggle={() => toggleOpen(c.id)}
              onEdit={() => setEditingId(c.id)}
              onCancelEdit={() => setEditingId(null)}
              onSaved={(updated) => {
                replaceCustomer({ ...updated, addresses: c.addresses });
                setEditingId(null);
              }}
              onAddresses={(addresses) => replaceCustomer({ ...c, addresses })}
              onDelete={() => setDeleting(c)}
              onSessionExpired={onSessionExpired}
            />
          ))}
        </ul>

        {loading && customers.length === 0 && <div className="px-5 py-6 text-center text-sm text-[#7b757e]">Loading…</div>}
      </div>

      {total > 0 && (
        <nav aria-label="Customer pages" className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <p className="text-sm text-[#7b757e]">
            Showing {first === lastShown ? first : `${first}–${lastShown}`} of {total}
          </p>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || loading}
              aria-label="Previous page"
              className="inline-flex items-center gap-1 text-sm font-bold text-[#695282] px-3 py-2 rounded-full hover:bg-[#efdbff]/50 disabled:text-[#c9c3cc] disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
            >
              <ChevronLeft className="w-4 h-4" />
              <span className="hidden sm:inline">Previous</span>
            </button>
            {pageList(page, lastPage).map((p, i) =>
              p === '…' ? (
                <span key={`gap-${i}`} className="w-9 text-center text-sm text-[#7b757e]">…</span>
              ) : (
                <button
                  key={p}
                  onClick={() => setPage(p)}
                  disabled={loading}
                  aria-current={p === page ? 'page' : undefined}
                  className={`w-9 h-9 rounded-full text-sm font-bold transition-all ${
                    p === page ? 'bg-[#695282] text-white shadow-sm' : 'text-[#4a454e] hover:bg-[#efdbff]/50'
                  }`}
                >
                  {p}
                </button>
              ),
            )}
            <button
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= lastPage || loading}
              aria-label="Next page"
              className="inline-flex items-center gap-1 text-sm font-bold text-[#695282] px-3 py-2 rounded-full hover:bg-[#efdbff]/50 disabled:text-[#c9c3cc] disabled:hover:bg-transparent disabled:cursor-not-allowed transition-all"
            >
              <span className="hidden sm:inline">Next</span>
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </nav>
      )}

      {deleting && (
        <DeleteDialog
          customer={deleting}
          onClose={() => setDeleting(null)}
          onDeleted={() => {
            unselect([deleting.id]);
            setDeleting(null);
            reload();
          }}
          onSessionExpired={onSessionExpired}
        />
      )}

      {batch === 'delete' && (
        <BatchDeleteDialog
          customers={[...selected.values()]}
          onClose={() => setBatch(null)}
          onDone={(count) => {
            setSelected(new Map());
            setBatch(null);
            setNotice(`Deleted ${count} ${count === 1 ? 'customer' : 'customers'}.`);
            reload();
          }}
          onSessionExpired={onSessionExpired}
        />
      )}

      {batch === 'reset' && (
        <BatchResetDialog
          customers={[...selected.values()]}
          onClose={() => setBatch(null)}
          onDone={(message) => {
            setSelected(new Map());
            setBatch(null);
            setNotice(message);
          }}
          onSessionExpired={onSessionExpired}
        />
      )}
    </div>
  );
};

interface RowProps {
  customer: Customer;
  open: boolean;
  editing: boolean;
  selected: boolean;
  onToggleSelected: () => void;
  onToggle: () => void;
  onEdit: () => void;
  onCancelEdit: () => void;
  onSaved: (c: Customer) => void;
  onAddresses: (list: Address[]) => void;
  onDelete: () => void;
  onSessionExpired: () => void;
}

const CustomerRow: React.FC<RowProps> = ({ customer: c, open, editing, selected, onToggleSelected, onToggle, onEdit, onCancelEdit, onSaved, onAddresses, onDelete, onSessionExpired }) => {
  const panelId = `customer-${c.id}`;
  return (
    <li className={selected ? 'bg-[#f6effc]' : open ? 'bg-[#fdfbff]' : ''}>
      <div className="flex items-stretch">
        <label className="pl-5 pr-1 flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={selected}
            onChange={onToggleSelected}
            aria-label={`Select ${c.name}`}
            className={checkboxClass}
          />
        </label>
        {/* The three always-visible details. Clicking opens or closes the details below. */}
        <button
          onClick={onToggle}
          aria-expanded={open}
          aria-controls={panelId}
          className={`flex-1 min-w-0 text-left px-4 py-4 grid ${COLUMNS} gap-x-4 gap-y-1 items-center hover:bg-[#f7f3ed]/60 transition-colors`}
        >
          <span className="w-10 h-10 rounded-full bg-[#efdbff]/70 text-[#533d6b] text-sm font-bold flex items-center justify-center row-span-2 md:row-span-1">
            {initials(c.name)}
          </span>
          <span className="font-bold text-[#1c1c18] truncate">{c.name}</span>
          <ChevronDown
            className={`w-5 h-5 text-[#7b757e] transition-transform md:order-last ${open ? 'rotate-180' : ''}`}
          />
          <span className="flex items-center gap-2 min-w-0 col-start-2 md:col-start-auto">
            <span className="text-sm text-[#4a454e] truncate">{c.email}</span>
            {c.emailVerified && <VerifiedTag />}
          </span>
          <span className="col-start-2 md:col-start-auto">
            <span className="inline-flex items-center px-3 py-1 rounded-full bg-[#f7f3ed] border border-[#e6e2dc] text-xs font-semibold text-[#7b757e]">
              No New Order
            </span>
          </span>
        </button>
      </div>

      {open && (
        <div id={panelId} className="px-5 pb-5 md:pl-[6.25rem]">
          {editing ? (
            <EditForm customer={c} onCancel={onCancelEdit} onSaved={onSaved} onSessionExpired={onSessionExpired} />
          ) : (
            <div className="space-y-4">
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                <DetailCard icon={Phone} title="Phone Number">
                  {c.addresses[0] ? (
                    <>
                      <p className="num text-sm text-[#4a454e]">{nationalPhone(c.addresses[0].phone)}</p>
                      <p className="text-xs text-[#7b757e]/80">Taken from the default address in the address book.</p>
                    </>
                  ) : (
                    <p className="text-sm text-[#7b757e]">No phone number yet</p>
                  )}
                </DetailCard>
                <AddressBookCard customerId={c.id} addresses={c.addresses} onChange={onAddresses} onSessionExpired={onSessionExpired} />
                <DetailCard icon={UserRound} title="Account">
                  <p className="text-sm text-[#4a454e]">Joined {formatDate(c.joinedAt)}</p>
                  <span
                    className={`inline-flex px-2.5 py-0.5 rounded-full text-xs font-semibold ${
                      c.emailVerified
                        ? 'bg-[#e6f4ef] text-[#2f5d50] border border-[#b9e5d8]'
                        : 'bg-[#fff4e6] text-[#8a5a1c] border border-[#f3d9b5]'
                    }`}
                  >
                    {c.emailVerified ? 'Email verified' : 'Email not verified'}
                  </span>
                </DetailCard>
              </div>
              <div className="flex flex-wrap gap-2 justify-end">
                <button
                  onClick={onEdit}
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#695282] hover:text-[#533d6b] bg-white px-4 py-2 rounded-full border border-[#9d84b7]/30 hover:border-[#9d84b7]/60 transition-all"
                >
                  <Pencil className="w-4 h-4" />
                  Edit
                </button>
                <button
                  onClick={onDelete}
                  className="inline-flex items-center gap-2 text-sm font-bold text-[#a33a3a] hover:text-white bg-white hover:bg-[#a33a3a] px-4 py-2 rounded-full border border-[#f1cccc] hover:border-[#a33a3a] transition-all"
                >
                  <Trash2 className="w-4 h-4" />
                  Delete
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </li>
  );
};

// Shown beside the email of customers who verified it.
const VerifiedTag: React.FC = () => (
  <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-[#e6f4ef] border border-[#b9e5d8] text-[11px] font-bold text-[#2f5d50]">
    <BadgeCheck className="w-3.5 h-3.5" />
    Verified
  </span>
);

const FILTER_TONES = {
  green: 'bg-[#e6f4ef] border-[#8fd0bc] text-[#2f5d50]',
  amber: 'bg-[#fff4e6] border-[#e8c48f] text-[#8a5a1c]',
};

// On/off pill for the email status filter.
const FilterToggle: React.FC<{ label: string; on: boolean; tone: keyof typeof FILTER_TONES; onClick: () => void }> = ({ label, on, tone, onClick }) => (
  <button
    type="button"
    onClick={onClick}
    aria-pressed={on}
    className={`inline-flex items-center gap-1.5 px-4 py-1.5 rounded-full border text-sm font-bold transition-all ${
      on ? FILTER_TONES[tone] : 'bg-white border-[#e6e2dc] text-[#a49ea8] hover:text-[#4a454e]'
    }`}
  >
    {on ? <Check className="w-4 h-4" /> : <span className="w-4 h-4 rounded-full border-2 border-current opacity-60" />}
    {label}
  </button>
);

// Shared look for the batch confirmation dialogs.
export const Dialog: React.FC<{ title: string; icon: React.ElementType; danger?: boolean; onClose: () => void; children: React.ReactNode }> = ({
  title,
  icon: Icon,
  danger,
  onClose,
  children,
}) => (
  <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2d2438]/30 backdrop-blur-sm" onClick={onClose}>
    <div
      role="alertdialog"
      aria-modal="true"
      aria-label={title}
      className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-white shadow-xl space-y-5"
      onClick={(e) => e.stopPropagation()}
    >
      <button
        onClick={onClose}
        aria-label="Close"
        className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#7b757e] hover:text-[#695282] hover:bg-[#efdbff]/50 transition-all"
      >
        <X className="w-4 h-4" />
      </button>
      <div
        className={`w-12 h-12 rounded-full flex items-center justify-center ${
          danger ? 'bg-[#fbeaea] text-[#a33a3a]' : 'bg-[#efdbff]/70 text-[#695282]'
        }`}
      >
        <Icon className="w-5 h-5" />
      </div>
      <h2 className="font-serif-display text-2xl font-bold">{title}</h2>
      {children}
    </div>
  </div>
);

// "Alice, Bob, Carol and 4 more"
const nameSummary = (list: Customer[]) =>
  list.length <= 3
    ? list.map((c) => c.name).join(', ')
    : `${list.slice(0, 3).map((c) => c.name).join(', ')} and ${list.length - 3} more`;

interface BatchProps<T> {
  customers: Customer[];
  onClose: () => void;
  onDone: (result: T) => void;
  onSessionExpired: () => void;
}

// Permanent, so the admin types e.g. "DELETE 5" to confirm.
const BatchDeleteDialog: React.FC<BatchProps<number>> = ({ customers, onClose, onDone, onSessionExpired }) => {
  const phrase = `DELETE ${customers.length}`;
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await postJson('/api/admin/customers/batch-delete', { ids: customers.map((c) => c.id) });
      if (res.status === 401) return onSessionExpired();
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Please try again.');
      onDone(data.deleted);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Delete ${customers.length} ${customers.length === 1 ? 'customer' : 'customers'}?`} icon={Trash2} danger onClose={onClose}>
      <p className="text-sm text-[#4a454e]">
        <b>{nameSummary(customers)}</b> will be deleted permanently and logged out. This can't be undone.
      </p>
      <div className="space-y-2">
        <label htmlFor="batch-delete-confirm" className={labelClass}>
          Type <span className="text-[#a33a3a]">{phrase}</span> to confirm
        </label>
        <input
          id="batch-delete-confirm"
          autoComplete="off"
          value={typed}
          onChange={(e) => setTyped(e.target.value)}
          placeholder={phrase}
          className={inputClass}
        />
      </div>
      {error && (
        <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="text-sm font-bold text-[#7b757e] hover:text-[#4a454e] px-4 py-2 rounded-full">
          Cancel
        </button>
        <button
          onClick={confirm}
          disabled={typed.trim().toUpperCase() !== phrase || busy}
          className="text-sm font-bold text-white bg-[#a33a3a] hover:bg-[#862e2e] disabled:bg-[#e0c4c4] disabled:cursor-not-allowed px-5 py-2 rounded-full transition-all"
        >
          {busy ? 'Deleting…' : `Delete ${customers.length}`}
        </button>
      </div>
    </Dialog>
  );
};

const BatchResetDialog: React.FC<BatchProps<string>> = ({ customers, onClose, onDone, onSessionExpired }) => {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const count = customers.length;

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const { res, data } = await postJson('/api/admin/customers/batch-reset', { ids: customers.map((c) => c.id) });
      if (res.status === 401) return onSessionExpired();
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Please try again.');
      const sent = `Sent ${data.sent} password reset ${data.sent === 1 ? 'email' : 'emails'}.`;
      if (data.failed.length) return setError(`${sent} These could not be sent: ${data.failed.join(', ')}`);
      onDone(sent);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Dialog title={`Send password reset to ${count} ${count === 1 ? 'customer' : 'customers'}?`} icon={KeyRound} onClose={onClose}>
      <p className="text-sm text-[#4a454e]">
        <b>{nameSummary(customers)}</b> will each get an email with a link to choose a new password. Their current
        password keeps working until they use the link.
      </p>
      {error && (
        <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}
      <div className="flex gap-2 justify-end">
        <button onClick={onClose} className="text-sm font-bold text-[#7b757e] hover:text-[#4a454e] px-4 py-2 rounded-full">
          {error ? 'Close' : 'Cancel'}
        </button>
        {!error?.startsWith('Sent') && (
          <button
            onClick={confirm}
            disabled={busy}
            className="text-sm font-bold text-white bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 px-5 py-2 rounded-full shadow-sm transition-all"
          >
            {busy ? 'Sending…' : `Send ${count} ${count === 1 ? 'email' : 'emails'}`}
          </button>
        )}
      </div>
    </Dialog>
  );
};

// Shows the default address only; "Show N more" widens the card across the row with the addresses side by side.
const AddressBookCard: React.FC<{ customerId: string; addresses: Address[]; onChange: (list: Address[]) => void; onSessionExpired: () => void }> = ({ customerId, addresses, onChange, onSessionExpired }) => {
  const [all, setAll] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const wide = all || editingId !== null;
  const shown = all ? addresses : addresses.slice(0, 1);
  return (
    <DetailCard icon={BookUser} title="Address Book" className={wide ? 'sm:col-span-2 lg:col-span-3' : ''}>
      {addresses.length === 0 ? (
        <p className="text-sm text-[#7b757e]">No addresses yet</p>
      ) : (
        <ul className={wide ? 'grid gap-x-6 gap-y-4 sm:grid-cols-2 lg:grid-cols-3' : ''}>
          {shown.map((a) =>
            editingId === a.id ? (
              <li key={a.id} className="sm:col-span-2 lg:col-span-3">
                <AddressEditForm
                  customerId={customerId}
                  address={a}
                  canChooseDefault={!a.isDefault && addresses.length > 1}
                  onCancel={() => setEditingId(null)}
                  onSaved={(list) => {
                    onChange(list);
                    setEditingId(null);
                  }}
                  onSessionExpired={onSessionExpired}
                />
              </li>
            ) : (
              <li key={a.id} className="text-sm text-[#4a454e]">
                <p className="font-bold text-[#1c1c18]">
                  {a.name}
                  {a.isDefault && <span className="ml-2 px-2 py-0.5 rounded-full bg-[#efdbff]/70 text-[11px] font-bold text-[#533d6b]">Default</span>}
                </p>
                <p className="[overflow-wrap:anywhere]">
                  {a.line1}
                  {a.line2 && `, ${a.line2}`}
                  <br />
                  {a.postcode} {a.city}, {stateName(a.state)}
                </p>
                <p className="num text-[#7b757e]">{nationalPhone(a.phone)}</p>
                {a.note && <p className="text-[#7b757e] [overflow-wrap:anywhere]">Note: {a.note}</p>}
                <button type="button" onClick={() => setEditingId(a.id)} className="mt-1 inline-flex items-center gap-1 text-sm font-bold text-[#695282] hover:text-[#533d6b]">
                  <Pencil className="w-3.5 h-3.5" />
                  Edit address
                </button>
              </li>
            ),
          )}
        </ul>
      )}
      {addresses.length > 1 && (
        <button type="button" onClick={() => setAll((v) => !v)} aria-expanded={all} className="text-sm font-bold text-[#695282] hover:text-[#533d6b] underline underline-offset-2">
          {all ? 'Show less' : `Show ${addresses.length - 1} more`}
        </button>
      )}
    </DetailCard>
  );
};

// Edits one of a customer's addresses on their behalf; the server applies the same checks as in the shop.
const AddressEditForm: React.FC<{ customerId: string; address: Address; canChooseDefault: boolean; onCancel: () => void; onSaved: (list: Address[]) => void; onSessionExpired: () => void }> = ({
  customerId,
  address,
  canChooseDefault,
  onCancel,
  onSaved,
  onSessionExpired,
}) => {
  // The state is not edited: it follows from the postcode (shown read-only, and worked out again by the server).
  const [f, setF] = useState({ name: address.name, phone: nationalPhone(address.phone), line1: address.line1, line2: address.line2, city: address.city, postcode: address.postcode, note: address.note, isDefault: false });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof f, v: string | boolean) => setF((cur) => ({ ...cur, [k]: v }));
  const state = stateForPostcode(f.postcode);
  const id = (k: string) => `addr-${address.id}-${k}`;

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customerId}/addresses/${address.id}`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(f) });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Please try again.');
      onSaved(data.addresses);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  const field = (k: 'name' | 'phone' | 'line1' | 'line2' | 'city' | 'note', label: string, extra: React.InputHTMLAttributes<HTMLInputElement> = {}) => (
    <div className="space-y-1.5">
      <label htmlFor={id(k)} className={labelClass}>{label}</label>
      <input id={id(k)} value={f[k]} onChange={(e) => set(k, e.target.value)} className={inputClass} {...extra} />
    </div>
  );

  return (
    <form onSubmit={save} className="rounded-2xl bg-[#fdfbff] border border-[#efe7f5] p-4 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        {field('name', 'Receiver name', { required: true, maxLength: 60 })}
        {field('phone', 'Phone number', { required: true, maxLength: 20, inputMode: 'tel', placeholder: '012-345 6789' })}
        {field('line1', 'Address line 1', { required: true, maxLength: 100 })}
        {field('line2', 'Address line 2 (optional)', { maxLength: 100 })}
        <div className="space-y-1.5">
          <label htmlFor={id('postcode')} className={labelClass}>Postcode</label>
          <input id={id('postcode')} value={f.postcode} onChange={(e) => set('postcode', e.target.value.replace(/\D/g, ''))} inputMode="numeric" maxLength={5} pattern="\d{5}" title="5 digits" required className={inputClass} />
        </div>
        {field('city', 'City or town', { required: true, maxLength: 50 })}
        <div className="space-y-1.5">
          <span className={labelClass} id={id('state')}>State</span>
          <p aria-labelledby={id('state')} className={`${inputClass} bg-[#efe9f3] ${state ? 'text-[#1c1c18]' : 'text-[#7b757e]'}`}>
            {state ? stateName(state) : 'Filled in from the postcode'}
          </p>
          {f.postcode.length === 5 && !state && <p role="alert" className="text-xs text-[#a33a3a]">Postcode not recognised.</p>}
          {state && !deliversTo(state) && <p role="alert" className="text-xs text-[#a33a3a]">{WEST_ONLY_MESSAGE}</p>}
        </div>
        <div className="sm:col-span-2">{field('note', 'Delivery note (optional)', { maxLength: 200, placeholder: 'e.g. guardhouse, call on arrival' })}</div>
      </div>
      {canChooseDefault && (
        <label className="flex items-center gap-2 text-sm text-[#4a454e] cursor-pointer">
          <input type="checkbox" checked={f.isDefault} onChange={(e) => set('isDefault', e.target.checked)} className={checkboxClass} />
          Make this the default address
        </label>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 justify-end">
        <button type="button" onClick={onCancel} className="text-sm font-bold text-[#7b757e] hover:text-[#4a454e] px-4 py-2 rounded-full">
          Cancel
        </button>
        <button type="submit" disabled={busy} className="text-sm font-bold text-white bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 px-5 py-2 rounded-full shadow-sm transition-all">
          {busy ? 'Saving…' : 'Save address'}
        </button>
      </div>
    </form>
  );
};

const DetailCard: React.FC<{ icon: React.ElementType; title: string; className?: string; children: React.ReactNode }> = ({ icon: Icon, title, className = '', children }) => (
  <div className={`rounded-2xl bg-white border border-[#efe7f5] p-4 space-y-1.5 ${className}`}>
    <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-[#695282]">
      <Icon className="w-4 h-4" />
      {title}
    </div>
    {children}
  </div>
);

interface EditProps {
  customer: Customer;
  onCancel: () => void;
  onSaved: (c: Customer) => void;
  onSessionExpired: () => void;
}

const EditForm: React.FC<EditProps> = ({ customer, onCancel, onSaved, onSessionExpired }) => {
  const [name, setName] = useState(customer.name);
  const [email, setEmail] = useState(customer.email);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const emailChanged = email.trim().toLowerCase() !== customer.email.toLowerCase();

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email }),
      });
      if (res.status === 401) return onSessionExpired();
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return setError(data.error ?? 'Something went wrong. Please try again.');
      onSaved(data.customer);
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={save} className="rounded-2xl bg-white border border-[#efe7f5] p-4 sm:p-5 space-y-4">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <label htmlFor={`edit-name-${customer.id}`} className={labelClass}>Name</label>
          <input
            id={`edit-name-${customer.id}`}
            required
            maxLength={80}
            value={name}
            onChange={(e) => setName(e.target.value)}
            className={inputClass}
          />
        </div>
        <div className="space-y-2">
          <label htmlFor={`edit-email-${customer.id}`} className={labelClass}>Email</label>
          <input
            id={`edit-email-${customer.id}`}
            type="email"
            required
            maxLength={254}
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={inputClass}
          />
        </div>
      </div>
      {emailChanged && (
        <p className="text-sm text-[#8a5a1c] bg-[#fff4e6] border border-[#f3d9b5] rounded-xl px-4 py-2.5">
          Changing the email logs this customer out, and they'll need to verify the new address before they can log in again.
        </p>
      )}
      {error && (
        <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
          {error}
        </p>
      )}
      <div className="flex flex-wrap gap-2 justify-end">
        <button
          type="button"
          onClick={onCancel}
          className="text-sm font-bold text-[#7b757e] hover:text-[#4a454e] px-4 py-2 rounded-full"
        >
          Cancel
        </button>
        <button
          type="submit"
          disabled={busy}
          className="text-sm font-bold text-white bg-[#695282] hover:bg-[#533d6b] disabled:opacity-60 px-5 py-2 rounded-full shadow-sm transition-all"
        >
          {busy ? 'Saving…' : 'Save changes'}
        </button>
      </div>
    </form>
  );
};

interface DeleteProps {
  customer: Customer;
  onClose: () => void;
  onDeleted: () => void;
  onSessionExpired: () => void;
}

// Deleting is permanent, so the admin must type the customer's email to confirm.
const DeleteDialog: React.FC<DeleteProps> = ({ customer, onClose, onDeleted, onSessionExpired }) => {
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const matches = typed.trim().toLowerCase() === customer.email.toLowerCase();

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/admin/customers/${customer.id}`, { method: 'DELETE' });
      if (res.status === 401) return onSessionExpired();
      if (!res.ok && res.status !== 404) {
        const data = await res.json().catch(() => ({}));
        return setError(data.error ?? 'Something went wrong. Please try again.');
      }
      onDeleted(); // 404 means it's already gone, so the list should drop it too.
    } catch {
      setError('Could not reach the server. Please try again.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-[#2d2438]/30 backdrop-blur-sm" onClick={onClose}>
      <div
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="delete-title"
        className="relative w-full max-w-md bg-white rounded-3xl p-6 sm:p-8 border border-white shadow-xl space-y-5"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          className="absolute top-4 right-4 w-9 h-9 rounded-full flex items-center justify-center text-[#7b757e] hover:text-[#695282] hover:bg-[#efdbff]/50 transition-all"
        >
          <X className="w-4 h-4" />
        </button>
        <div className="w-12 h-12 rounded-full bg-[#fbeaea] text-[#a33a3a] flex items-center justify-center">
          <Trash2 className="w-5 h-5" />
        </div>
        <div className="space-y-2">
          <h2 id="delete-title" className="font-serif-display text-2xl font-bold">Delete this customer?</h2>
          <p className="text-sm text-[#4a454e]">
            <b>{customer.name}</b> ({customer.email}) will be deleted permanently and logged out. This can't be undone.
          </p>
        </div>
        <div className="space-y-2">
          <label htmlFor="delete-confirm" className={labelClass}>Type the customer's email to confirm</label>
          <input
            id="delete-confirm"
            autoComplete="off"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
            placeholder={customer.email}
            className={inputClass}
          />
        </div>
        {error && (
          <p role="alert" className="text-sm text-[#a33a3a] bg-[#fbeaea] border border-[#f1cccc] rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}
        <div className="flex gap-2 justify-end">
          <button onClick={onClose} className="text-sm font-bold text-[#7b757e] hover:text-[#4a454e] px-4 py-2 rounded-full">
            Cancel
          </button>
          <button
            onClick={confirm}
            disabled={!matches || busy}
            className="text-sm font-bold text-white bg-[#a33a3a] hover:bg-[#862e2e] disabled:bg-[#e0c4c4] disabled:cursor-not-allowed px-5 py-2 rounded-full transition-all"
          >
            {busy ? 'Deleting…' : 'Delete customer'}
          </button>
        </div>
      </div>
    </div>
  );
};

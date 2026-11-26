import React, { useEffect, useState } from 'react';
import { LayoutDashboard, LogOut, Package, Radio, ShieldCheck, ShoppingBag, UserRound, Users } from 'lucide-react';
import type { Admin } from '../../types';
import { CustomersTab } from './CustomersTab';
import { ProductsTab } from './ProductsTab';

const TABS = [
  { id: 'overview', label: 'Overview', icon: LayoutDashboard },
  { id: 'orders', label: 'Orders', icon: Package },
  { id: 'customers', label: 'Customers', icon: Users },
  { id: 'live', label: 'Live Status', icon: Radio },
  { id: 'products', label: 'Products', icon: ShoppingBag },
] as const;
type TabId = (typeof TABS)[number]['id'];

// What each tab will hold once it's built.
const COMING: Record<Exclude<TabId, 'overview'>, string> = {
  orders: 'Track every order and update its status.',
  customers: 'Browse and search customer accounts.',
  live: 'Switch the "Is Live Now" status on or off with one click.',
  products: 'Add, edit and list products.',
};

// The current tab lives in the URL hash (/admin#orders), so a refresh stays on it.
const tabFromHash = (): TabId => {
  const id = window.location.hash.slice(1);
  return TABS.some((t) => t.id === id) ? (id as TabId) : 'overview';
};

interface Props {
  admin: Admin;
  onLogout: () => void;
}

export const AdminDashboard: React.FC<Props> = ({ admin, onLogout }) => {
  const [tab, setTab] = useState<TabId>(tabFromHash);

  useEffect(() => {
    const onHash = () => setTab(tabFromHash());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  // On narrow screens the tab row scrolls sideways; keep the selected tab visible.
  useEffect(() => {
    document.querySelector('[role="tab"][aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
  }, [tab]);

  const current = TABS.find((t) => t.id === tab)!;

  return (
    <div className="min-h-screen bg-[#fdf9f3] font-sans-ui text-[#1c1c18]">
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur-md border-b border-[#efe7f5]">
        <div className="max-w-6xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <ShieldCheck className="w-5 h-5 text-[#695282] shrink-0" />
            <span className="font-serif-display text-xl font-bold truncate">ScoopVerse Admin</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <span className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-[#4a454e] px-3 py-2">
              <UserRound className="w-4 h-4 text-[#826b9c]" />
              <span className="max-w-[12rem] truncate">{admin.name}</span>
            </span>
            <button
              onClick={onLogout}
              className="inline-flex items-center gap-2 text-sm font-semibold text-[#695282] hover:text-[#533d6b] bg-white px-4 py-2 rounded-full border border-[#9d84b7]/30 hover:border-[#9d84b7]/60 shadow-xs transition-all"
            >
              <LogOut className="w-4 h-4" />
              <span>Log Out</span>
            </button>
          </div>
        </div>

        <nav aria-label="Admin sections" className="max-w-6xl mx-auto px-4 sm:px-6 overflow-x-auto">
          <div role="tablist" className="flex gap-1 pb-2 min-w-max">
            {TABS.map(({ id, label, icon: Icon }) => (
              <a
                key={id}
                href={`#${id}`}
                role="tab"
                aria-selected={tab === id}
                className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-bold transition-all ${
                  tab === id
                    ? 'bg-[#695282] text-white shadow-sm'
                    : 'text-[#7b757e] hover:text-[#533d6b] hover:bg-[#efdbff]/50'
                }`}
              >
                <Icon className={`w-4 h-4 ${tab === id ? 'text-[#ffd1b3]' : ''}`} />
                <span>{label}</span>
              </a>
            ))}
          </div>
        </nav>
      </header>

      <main className="max-w-6xl mx-auto px-4 sm:px-6 py-8 space-y-6" role="tabpanel">
        <h1 className="font-serif-display text-3xl font-bold">{current.label}</h1>

        {tab === 'overview' ? (
          <>
            <p className="text-sm text-[#4a454e]">Welcome back, {admin.name}.</p>
            <div className="grid gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-4">
              {TABS.filter((t) => t.id !== 'overview').map(({ id, label, icon: Icon }) => (
                <a
                  key={id}
                  href={`#${id}`}
                  className="bg-white rounded-3xl p-6 border border-[#efe7f5] shadow-xs hover:shadow-md hover:border-[#9d84b7]/40 transition-all space-y-3"
                >
                  <div className="w-10 h-10 rounded-full bg-[#efdbff]/70 text-[#695282] flex items-center justify-center">
                    <Icon className="w-5 h-5" />
                  </div>
                  <div className="text-xs font-bold uppercase tracking-wider text-[#7b757e]">{label}</div>
                  <div className="font-serif-display text-3xl font-bold text-[#c9c3cc]">—</div>
                  <div className="text-xs text-[#7b757e]">Coming soon</div>
                </a>
              ))}
            </div>
          </>
        ) : tab === 'customers' ? (
          <CustomersTab onSessionExpired={onLogout} />
        ) : tab === 'products' ? (
          <ProductsTab onSessionExpired={onLogout} />
        ) : (
          <div className="bg-white rounded-3xl p-10 border border-[#efe7f5] text-center space-y-3">
            <div className="w-14 h-14 rounded-full bg-[#efdbff]/70 text-[#695282] flex items-center justify-center mx-auto">
              <current.icon className="w-6 h-6" />
            </div>
            <h2 className="font-serif-display text-2xl font-bold">Coming soon</h2>
            <p className="text-sm text-[#4a454e]">{COMING[tab]}</p>
          </div>
        )}
      </main>
    </div>
  );
};

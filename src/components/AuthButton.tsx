import React from 'react';
import { LogIn, LogOut, UserRound } from 'lucide-react';
import type { User } from '../types';

interface Props {
  user: User | null;
  onLogin: () => void;
  onLogout: () => void;
}

const pill =
  'inline-flex items-center gap-2 text-sm font-semibold text-[#695282] hover:text-[#533d6b] bg-white/70 hover:bg-white backdrop-blur-sm px-4 py-2 rounded-full border border-[#9d84b7]/20 hover:border-[#9d84b7]/50 shadow-xs hover:shadow-md transition-all';

export const AuthButton: React.FC<Props> = ({ user, onLogin, onLogout }) => (
  <div className="fixed top-4 right-4 sm:top-6 sm:right-6 z-40 flex items-center gap-2">
    {user ? (
      <>
        <span className="hidden sm:inline-flex items-center gap-2 text-sm font-semibold text-[#4a454e] bg-white/50 backdrop-blur-sm px-4 py-2 rounded-full border border-white/80">
          <UserRound className="w-4 h-4 text-[#826b9c]" />
          <span className="max-w-[12rem] truncate">{user.name}</span>
        </span>
        <button onClick={onLogout} className={pill}>
          <LogOut className="w-4 h-4" />
          <span>Log Out</span>
        </button>
      </>
    ) : (
      <button onClick={onLogin} className={pill}>
        <LogIn className="w-4 h-4" />
        <span>Log In</span>
      </button>
    )}
  </div>
);

import React from 'react';
import { Eye, EyeOff } from 'lucide-react';

interface Props {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  // Visibility is owned by the parent so it can reset it to hidden (e.g. on submit).
  shown: boolean;
  onToggleShown: () => void;
  autoComplete: string;
  placeholder?: string;
}

// Password field with a show/hide eye toggle (hidden by default).
export const PasswordInput: React.FC<Props> = ({ id, label, value, onChange, shown, onToggleShown, autoComplete, placeholder }) => (
  <div className="space-y-2">
    <label htmlFor={id} className="text-xs font-bold uppercase tracking-wider text-[#1c1c18] block">
      {label}
    </label>
    <div className="relative">
      <input
        id={id}
        type={shown ? 'text' : 'password'}
        required
        minLength={8}
        maxLength={200}
        autoComplete={autoComplete}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full px-5 py-3.5 pr-12 rounded-2xl bg-[#f7f3ed] border border-[#e6e2dc] focus:border-[#9d84b7] focus:bg-white focus:outline-hidden text-sm transition-all text-[#1c1c18] placeholder-[#7b757e]"
      />
      <button
        type="button"
        onClick={onToggleShown}
        aria-label={shown ? 'Hide password' : 'Show password'}
        aria-pressed={shown}
        className="absolute right-2 top-1/2 -translate-y-1/2 w-9 h-9 rounded-full flex items-center justify-center text-[#7b757e] hover:text-[#695282] hover:bg-[#efdbff]/50 transition-all"
      >
        {shown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </button>
    </div>
  </div>
);

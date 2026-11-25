import { useEffect, useState } from 'react';

// Seconds remaining until a deadline, ticking every second. start(secs) sets a new deadline.
export function useCountdown() {
  const [deadline, setDeadline] = useState(0);
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (deadline <= now) return;
    const t = setTimeout(() => setNow(Date.now()), 1000);
    return () => clearTimeout(t);
  }, [deadline, now]);

  const secondsLeft = Math.max(0, Math.ceil((deadline - now) / 1000));
  const start = (secs: number | undefined) => {
    setNow(Date.now());
    setDeadline(Date.now() + (secs ?? 0) * 1000);
  };
  return [secondsLeft, start] as const;
}

// 59 -> "0:59", 300 -> "5:00", 7200 -> "2h 0m"
export function formatCountdown(secs: number) {
  if (secs >= 3600) return `${Math.floor(secs / 3600)}h ${Math.floor((secs % 3600) / 60)}m`;
  return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`;
}

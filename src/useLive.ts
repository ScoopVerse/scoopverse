import { useEffect, useState } from 'react';

// Is the shop owner live on TikTok/IG right now (the admin's "Live now" switch)? Read once when the page opens.
export function useLive() {
  const [live, setLive] = useState(false);
  useEffect(() => {
    fetch('/api/products/live')
      .then((r) => r.json())
      .then((d) => setLive(d.live === true))
      .catch(() => {});
  }, []);
  return live;
}

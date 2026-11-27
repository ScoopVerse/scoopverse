import { useCallback, useEffect, useState } from 'react';
import type { Cart, User } from './types';

// The signed-in customer's cart (kept on the server) and whether its drawer is open. Every call returns the whole
// updated cart; the methods that can be refused (stock, live closed) return the message, or null when it worked.
export function useCart(user: User | null) {
  const [cart, setCart] = useState<Cart | null>(null);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!user) return setCart(null);
    let current = true;
    fetch('/api/cart')
      .then((r) => (r.ok ? r.json() : null))
      .then((c) => current && setCart(c))
      .catch(() => {});
    return () => {
      current = false;
    };
  }, [user]);

  const send = useCallback(async (method: string, path: string, body?: unknown): Promise<string | null> => {
    try {
      const res = await fetch(`/api/cart${path}`, {
        method,
        headers: body ? { 'Content-Type': 'application/json' } : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) return data.error ?? 'Something went wrong. Please try again.';
      setCart(data);
      return null;
    } catch {
      return 'Something went wrong. Please try again.';
    }
  }, []);

  return {
    cart,
    open,
    setOpen,
    add: (productId: string, mode: string) => send('POST', '', { productId, mode }),
    setQuantity: (id: string, quantity: number) => send('PATCH', `/${id}`, { quantity }),
    remove: (id: string) => send('DELETE', `/${id}`),
  };
}

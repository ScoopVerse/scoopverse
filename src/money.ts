// Prices are whole cents everywhere (no decimals, so no rounding errors).
export const formatPrice = (cents: number) => `RM${(cents / 100).toFixed(2)}`;

export const centsToDollars = (cents: number) => (cents / 100).toFixed(2);

// "12", "12.5" or "12.50" -> cents. Returns null if it isn't an amount from 0.01 to 999999.99.
export function dollarsToCents(text: string): number | null {
  const m = /^\s*(\d{1,6})(?:\.(\d{1,2}))?\s*$/.exec(text);
  if (!m) return null;
  const cents = Number(m[1]) * 100 + Number((m[2] ?? '').padEnd(2, '0'));
  return cents >= 1 ? cents : null;
}

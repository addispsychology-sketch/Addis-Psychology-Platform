export type Balance = { texts: number; voices: number };
export type Package = { id: string; texts: number; voices: number; price: number };
export const bundles: Package[] = [
  { id: 'starter', texts: 20, voices: 3, price: 250 },
  { id: 'regular', texts: 60, voices: 10, price: 650 },
  { id: 'extended', texts: 150, voices: 25, price: 1400 },
];
export function discountedPrice(price: number, discount: number) {
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(discount) || discount < 0 || discount > 50) throw new Error('Invalid price or discount');
  return Math.round(price * (1 - discount / 100));
}
export function addBundle(balance: Balance, bundle: Package): Balance {
  return { texts: balance.texts + bundle.texts, voices: balance.voices + bundle.voices };
}
export function spendCredit(balance: Balance, type: 'text' | 'voice'): Balance | null {
  const key = type === 'text' ? 'texts' : 'voices';
  if (balance[key] < 1) return null;
  return { ...balance, [key]: balance[key] - 1 };
}

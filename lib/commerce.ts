// Voice balances are integer seconds; purchases and deductions never use floating-point minutes.
export type Balance = { texts: number; voiceSeconds: number };
export type Package = Balance & { id: string; price: number };
export const TEXT_RATE = 1.5;
export const VOICE_MINUTE_RATE = 7;
export const bundles: Package[] = [
  { id: 'text', texts: 100, voiceSeconds: 0, price: 100 * TEXT_RATE },
  { id: 'voice', texts: 0, voiceSeconds: 3600, price: 60 * VOICE_MINUTE_RATE },
  { id: 'comprehensive', texts: 250, voiceSeconds: 15 * 60, price: 250 * TEXT_RATE + 15 * VOICE_MINUTE_RATE },
  { id: 'combined', texts: 100, voiceSeconds: 3600, price: 100 * TEXT_RATE + 60 * VOICE_MINUTE_RATE },
];
export function formatVoiceTime(seconds: number) {
  return Math.floor(seconds / 60) + ':' + String(seconds % 60).padStart(2, '0');
}
export function migrateBalance(balance: { texts?: number; voices?: number; voiceSeconds?: number }): Balance {
  const safe = (n: number | undefined) => Number.isFinite(n) && n! >= 0 ? Math.floor(n!) : 0;
  return { texts: safe(balance.texts), voiceSeconds: balance.voiceSeconds === undefined ? safe(balance.voices) * 60 : safe(balance.voiceSeconds) };
}
export function discountedPrice(price: number, discount: number) {
  if (!Number.isFinite(price) || price < 0 || !Number.isFinite(discount) || discount < 0 || discount > 50) throw new Error('Invalid price or discount');
  return Math.round((price * (1 - discount / 100) + Number.EPSILON) * 100) / 100;
}
export function addBundle(balance: Balance, bundle: Package): Balance {
  return { texts: balance.texts + bundle.texts, voiceSeconds: balance.voiceSeconds + bundle.voiceSeconds };
}
export function spendCredit(balance: Balance, type: 'text' | 'voice', durationSeconds?: number): Balance | null {
  if (type === 'text') return balance.texts >= 1 ? { ...balance, texts: balance.texts - 1 } : null;
  if (!Number.isFinite(durationSeconds) || durationSeconds! <= 0) return null;
  const seconds = Math.ceil(durationSeconds!);
  return balance.voiceSeconds >= seconds ? { ...balance, voiceSeconds: balance.voiceSeconds - seconds } : null;
}

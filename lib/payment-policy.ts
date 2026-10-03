export const TERMS_VERSION = '2026-10-03.2';
export const PAYMENT_DESTINATIONS = { telebirr: '0990171738', cbe: '1000605180519' } as const;
export const PAYEE = 'Dawit Aynalem';
export const PACKAGE_PRINCIPAL = { text: 15000, voice: 42000, combined: 57000 } as const;
export function birrCents(value: unknown) {
 const text = String(value ?? '');
 if (!/^\d{1,7}(?:\.\d{1,2})?$/.test(text)) throw new Error('Enter an amount with at most two decimal places.');
 const [whole, fraction = ''] = text.split('.');
 const cents = Number(whole) * 100 + Number(fraction.padEnd(2, '0'));
 if (!Number.isSafeInteger(cents) || cents < 100 || cents > 100000000) throw new Error('Amount must be between 1 and 1,000,000 ETB.');
 return cents;
}
export const serviceFee = (cents: number) => Math.ceil(cents * 5 / 100);
export const moneyCents = (cents: number) => (cents / 100).toLocaleString('en-GB', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' ETB';
export const canCancel = (startsAt: string, now = Date.now()) => Date.parse(startsAt) - now >= 86400000;

export function dateKey(date = new Date()) { return new Intl.DateTimeFormat('en-CA', { timeZone: 'Africa/Addis_Ababa', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date); }
export function shiftDate(key: string, days: number) { const d = new Date(`${key}T12:00:00+03:00`); d.setUTCDate(d.getUTCDate() + days); return dateKey(d); }
export function slots(start: string, end: string) { const from = Number(start.split(':')[0]); const to = Number(end.split(':')[0]); return Array.from({ length: Math.max(0, to - from) }, (_, i) => `${String(from + i).padStart(2, '0')}:00`); }
export function isFutureSlot(day: string, time: string, now = Date.now()) { return new Date(`${day}T${time}:00+03:00`).getTime() > now; }

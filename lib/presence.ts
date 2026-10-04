export type PresenceSettings = { presence: string; chatDays: number[]; chatStart: string; chatEnd: string; lastSeenAt?: string | null };
export function therapistAvailability(settings: PresenceSettings, now = Date.now()) {
  const local = new Date(now + 10800000);
  const day = local.getUTCDay(), minute = local.getUTCHours() * 60 + local.getUTCMinutes();
  const toMinutes = (value: string) => { const [h,m] = value.split(':').map(Number); return h * 60 + m; };
  const start = toMinutes(settings.chatStart), end = toMinutes(settings.chatEnd);
  const inWindow = end < start
    ? (settings.chatDays.includes(day) && minute >= start) || (settings.chatDays.includes((day + 6) % 7) && minute < end)
    : settings.chatDays.includes(day) && minute >= start && minute < end;
  const elapsed = settings.lastSeenAt ? now - Date.parse(settings.lastSeenAt) : Infinity;
  const active = elapsed >= -5000 && elapsed < 120000;
  const isOnline = settings.presence === 'available' && active;
  return { isOnline, inWindow, minsLeft: isOnline && inWindow ? (end - minute + 1440) % 1440 : 0, start: settings.chatStart, end: settings.chatEnd };
}


export function normalizePhone(value: string) {
  let phone = value.replace(/[\s()-]/g, '');
  if (/^0[79]\d{8}$/.test(phone)) phone = '+251' + phone.slice(1);
  if (/^251[79]\d{8}$/.test(phone)) phone = '+' + phone;
  if (!/^\+[1-9]\d{7,14}$/.test(phone)) throw new Error('Enter your phone number with country code, for example +251…');
  return phone;
}

export function validateBooking(input: Record<string, unknown>, now = Date.now()) {
  const therapist = Number(input.therapist);
  const date = String(input.date || '');
  const time = String(input.time || '');
  const name = String(input.name || '').trim();
  const phone = normalizePhone(String(input.phone || ''));
  const language = String(input.language || '').trim();
  if (!Number.isSafeInteger(therapist) || therapist < 1) throw new Error('Choose a therapist.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^(?:[01]\d|2[0-3]):00$/.test(time)) throw new Error('Choose a valid appointment time.');
  const start = new Date(`${date}T${time}:00+03:00`);
  const localDate = new Date(start.getTime() + 10800000).toISOString().slice(0, 10);
  if (localDate !== date || !Number.isFinite(start.getTime()) || start.getTime() <= now || start.getTime() > now + 64 * 86400000) throw new Error('Choose a future appointment within the next nine weeks.');
  if (name.length < 2 || name.length > 100) throw new Error('Enter your name (2–100 characters).');
  if (language.length > 50) throw new Error('Please shorten your language preference.');
  if (input.medium !== 'online' && input.medium !== 'inperson') throw new Error('Choose online or in-person.');
  if (input.consent !== true) throw new Error('Please agree to share these contact details with your therapist.');
  return { therapist, date, time, name, phone, language, medium: input.medium, starts_at: start.toISOString() };
}

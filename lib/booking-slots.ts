import { dateKey, shiftDate, slots, isFutureSlot } from './calendar';

type Schedule = { days: number[]; start: string; end: string };
type Appointment = { therapist: number; date: string; time: string; status: string };

export function availableBookingSlots(therapist: number, day: string, schedule: Schedule, appointments: Appointment[], now = Date.now()) {
  if (!day || !schedule.days.includes(new Date(`${day}T12:00:00+03:00`).getUTCDay())) return [];
  return slots(schedule.start, schedule.end).filter(time =>
    isFutureSlot(day, time, now) &&
    !appointments.some(a => a.therapist === therapist && a.date === day && a.time === time && a.status !== 'cancelled')
  );
}

export function upcomingBookingDays(therapist: number, schedule: Schedule, appointments: Appointment[], now = Date.now()) {
  const today = dateKey(new Date(now));
  return Array.from({ length: 14 }, (_, i) => shiftDate(today, i))
    .filter(day => availableBookingSlots(therapist, day, schedule, appointments, now).length > 0);
}

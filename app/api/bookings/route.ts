import { authorize } from '@/lib/server-auth';
import { apiError, serviceDb } from '@/lib/server-services';
import { validateBooking } from '@/lib/booking-validation';
import { slots } from '@/lib/calendar';
import { discountedPrice } from '@/lib/commerce';

export async function POST(request: Request) {
  try {
    const { user } = await authorize(request);
    const input = validateBooking(await request.json());
    const db = serviceDb();
    const { data: p, error } = await db.from('practitioners').select('id,user_id,approved,settings,profile').eq('id', input.therapist).single();
    if (error || !p?.approved || p.user_id === user.id) throw new Error('Please select an approved therapist.');
    const conf = p.settings || {};
    if (!(conf.days || [1, 2, 3, 4, 5]).includes(new Date(`${input.date}T12:00:00+03:00`).getUTCDay()) || !slots(conf.start || '09:00', conf.end || '17:00').includes(input.time)) throw new Error('This time is outside the therapist’s availability.');
    const base = Number(input.medium === 'online' ? conf.online ?? p.profile.priceOnline ?? 1200 : conf.inperson ?? p.profile.priceInPerson ?? 1600);
    const price = discountedPrice(base, Number(conf.discount || 0));
    if (!Number.isFinite(price) || price < 0) throw new Error('This therapist’s price needs updating.');
    const { data, error: insertError } = await db.from('appointments').insert({ client_id: user.id, therapist_id: p.id, starts_at: input.starts_at, medium: input.medium, client_name: input.name, phone: input.phone, language: input.language, consent_at: new Date().toISOString(), price }).select('id').single();
    if (insertError?.code === '23505') return Response.json({ error: 'That time has just been booked. Please choose another.' }, { status: 409 });
    if (insertError) throw new Error('Your appointment could not be saved. Please try again.');
    return Response.json({ id: data.id }, { status: 201 });
  } catch (error) { return apiError(error); }
}

export async function PATCH(request: Request) {
  try {
    const { db: scoped, user } = await authorize(request);
    const { id, status } = await request.json();
    if (!['confirmed', 'cancelled', 'completed'].includes(status)) throw new Error('Invalid appointment status.');
    const { data: appointment } = await scoped.from('appointments').select('*').eq('id', id).single();
    if (!appointment) throw new Error('Appointment not found.');
    const { data: p } = await scoped.from('practitioners').select('user_id').eq('id', appointment.therapist_id).single();
    const therapist = p?.user_id === user.id;
    if (!therapist && (appointment.client_id !== user.id || status !== 'cancelled')) throw new Error('You cannot make this change.');
    if (['cancelled', 'completed'].includes(appointment.status)) throw new Error('This appointment is already closed.');
    if (status === 'confirmed' && appointment.status !== 'pending') throw new Error('This appointment is already confirmed.');
    if (status === 'completed' && (appointment.status !== 'confirmed' || Date.parse(appointment.starts_at) > Date.now())) throw new Error('Only a confirmed session that has started can be completed.');
    const { data, error } = await serviceDb().from('appointments').update({ status }).eq('id', id).eq('status', appointment.status).select('id');
    if (error || !data?.length) throw new Error('The appointment changed. Refresh and try again.');
    return Response.json({ ok: true });
  } catch (error) { return apiError(error); }
}

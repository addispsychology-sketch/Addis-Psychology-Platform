'use client';
import { useCallback, useEffect, useState } from 'react';
import type { Appointment } from '@/components/Platform';
import { authenticatedFetch, getSupabase } from './supabase';

export function useAppointments(userId: string | null) {
  const [snapshot, setSnapshot] = useState<{ userId: string; rows: Appointment[] } | null>(null);
  const [error, setError] = useState('');
  const refresh = useCallback(async () => {
    const db = getSupabase();
    if (!db || !userId) return;
    const { data, error } = await db.from('appointments').select('*').order('starts_at', { ascending: false }).limit(500);
    if (error) { setError('Appointments could not be loaded. Please refresh or try again shortly.'); return; }
    setError('');
    setSnapshot({ userId, rows: (data || []).map(a => {
      const local = new Date(Date.parse(a.starts_at) + 10800000).toISOString();
      return { id: a.id, therapist: a.therapist_id, date: local.slice(0, 10), time: local.slice(11, 16), medium: a.medium, status: a.status, price: a.price, client: a.client_name, phone: a.phone, language: a.language };
    }) });
  }, [userId]);
  useEffect(() => {
    const timeout = setTimeout(() => void refresh(), 0);
    const interval = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 30000);
    const focus = () => void refresh();
    window.addEventListener('focus', focus);
    return () => { clearTimeout(timeout); clearInterval(interval); window.removeEventListener('focus', focus); };
  }, [refresh]);
  async function update(id: string, patch: Partial<Appointment>) {
    try {
      await authenticatedFetch('/api/bookings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: patch.status }) });
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
  }
  return { appointments: snapshot?.userId === userId ? snapshot.rows : [], error: userId ? error : '', refresh, update };
}

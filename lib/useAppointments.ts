'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { Appointment } from '@/components/Platform';
import { authenticatedFetch, getSupabase } from './supabase';
import { usePageVisible } from './usePageVisible';
import { subscribePrivate } from './realtime-lifecycle';

export function useAppointments(userId: string | null) {
  const visible = usePageVisible();
  const [snapshot, setSnapshot] = useState<{ userId: string; rows: Appointment[] } | null>(null);
  const [error, setError] = useState('');
  const pending = useRef<{ userId: string; task: Promise<void> } | null>(null);
  const refresh = useCallback(async () => {
    const db = getSupabase();
    if (!db || !userId) return;
    if (pending.current?.userId === userId) return pending.current.task;
    const task = (async () => {
    const { data, error } = await db.from('appointments').select('id,therapist_id,starts_at,medium,status,price,client_name,phone,language').order('starts_at', { ascending: false }).limit(50);
    if (error) { setError('Appointments could not be loaded. Please refresh or try again shortly.'); return; }
    setError('');
    setSnapshot({ userId, rows: (data || []).map(a => {
      const local = new Date(Date.parse(a.starts_at) + 10800000).toISOString();
      return { id: a.id, therapist: a.therapist_id, date: local.slice(0, 10), time: local.slice(11, 16), medium: a.medium, status: a.status, price: a.price, client: a.client_name, phone: a.phone, language: a.language };
    }) });
    })();
    pending.current = { userId, task };
    try { await task; } finally { if (pending.current?.task === task) pending.current = null; }
  }, [userId]);
  useEffect(() => {
    if (!userId || !visible) return;
    let connected = false, lastRefresh = 0;
    const focus = () => { if (document.visibilityState === 'visible' && Date.now() - lastRefresh > (connected ? 300000 : 10000)) { lastRefresh = Date.now(); void refresh(); } };
    const timeout = setTimeout(focus, 0);
    const db = getSupabase();
    const close = db ? subscribePrivate(db, 'appointments:' + userId, channel => channel.on('postgres_changes', { event: '*', schema: 'public', table: 'appointments' }, () => void refresh()).subscribe(status => { connected = status === 'SUBSCRIBED'; if (connected) focus(); })) : null;
    window.addEventListener('focus', focus);
    document.addEventListener('visibilitychange', focus);
    return () => { clearTimeout(timeout); window.removeEventListener('focus', focus); document.removeEventListener('visibilitychange', focus); close?.(); };
  }, [refresh, userId, visible]);
  async function update(id: string, patch: Partial<Appointment>) {
    try {
      await authenticatedFetch('/api/bookings', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id, status: patch.status }) });
      await refresh();
    } catch (error) { setError(error instanceof Error ? error.message : 'Please try again.'); }
  }
  return { appointments: snapshot?.userId === userId ? snapshot.rows : [], error: userId ? error : '', refresh, update };
}

'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase } from './supabase';
import { uploadVoice } from './voice';
import type { Therapist } from './data';
import type { Message, Registration, Settings } from '@/components/Platform';

export type Conversation = { id: string; client_id: string; therapist_id: number };
export function useMessaging() {
  const [userId, setUserId] = useState<string | null>(null);
  const identity = useRef<string | null>(null);
  const [people, setPeople] = useState<Therapist[]>([]);
  const [ownTherapistId, setOwnTherapistId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [cloudSettings, setCloudSettings] = useState<Record<number, Settings>>({});
  const [cloudError, setCloudError] = useState('');
  const [activeConversation, setActiveConversation] = useState('');
  const [historyLimit, setHistoryLimit] = useState(100);
  const refreshPeople = useCallback(async () => {
    const db = getSupabase();
    if (!db) return;
    const { data, error } = await db.from('practitioners').select('*');
    if (identity.current !== userId) return;
    if (error) { setCloudError(error.message); return; }
    setPeople((data || []).map(p => ({ ...p.profile, badge: p.approved ? undefined : 'Pending approval', id: p.id })));
    setOwnTherapistId(data?.find(p => p.user_id === userId)?.id ?? null);
    setCloudSettings(Object.fromEntries((data || []).filter(p => Object.keys(p.settings).length).map(p => [p.id, p.settings])));
  }, [userId]);
  useEffect(() => {
    const db = getSupabase();
    if (!db) return;
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      if (identity.current !== (session?.user.id ?? null)) {
        setMessages([]); setConversations([]); setActiveConversation(''); setPeople([]); setOwnTherapistId(null); setCloudSettings({}); setHistoryLimit(100);
      }
      identity.current = session?.user.id ?? null;
      setUserId(session?.user.id ?? null);
      if (!session) { setMessages([]); setConversations([]); setActiveConversation(''); }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  // Initial fetch synchronizes the directory with the remote database.
  // eslint-disable-next-line react-hooks/set-state-in-effect
  useEffect(() => { void refreshPeople(); }, [refreshPeople]);
  useEffect(() => {
    const db = getSupabase();
    if (!db || !userId) return;
    let alive = true;
    async function refresh() {
      const { data: threads, error: ce } = await db!.from('conversations').select('*');
      const rows = [];
      let me = null;
      for (let offset = 0; offset < historyLimit; offset += 100) {
        const page = await db!.from('messages').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + 99);
        if (page.error) { me = page.error; break; }
        rows.push(...page.data);
        if (page.data.length < 100) break;
      }
      if (!alive || identity.current !== userId) return;
      if (ce || me) { setCloudError((ce || me)!.message); return; }
      setConversations(threads || []);
      setMessages((rows || []).reverse().flatMap(m => {
        const c = threads?.find(c => c.id === m.conversation_id);
        return c ? [{ id: m.id, conversationId: c.id, therapist: c.therapist_id, from: m.sender_id === c.client_id ? 'client' as const : 'therapist' as const, text: m.text || undefined, audio: m.audio_url || undefined, durationSeconds: m.duration_seconds, at: m.created_at }] : [];
      }));
    }
    const channel = db.channel(`messages:${userId}`, { config: { private: true } }).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => void refresh()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => void refresh()).subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
    void refresh();
    const timer = setInterval(() => void refresh(), 15000);
    return () => { alive = false; clearInterval(timer); void db.removeChannel(channel); };
  }, [userId, historyLimit]);
  async function ensureConversation(therapist: number) {
    const db = getSupabase();
    if (!db || !userId) throw new Error('Please sign in from Account first.');
    if (ownTherapistId === therapist) {
      const selected = conversations.find(c => c.id === activeConversation && c.therapist_id === therapist);
      if (!selected) throw new Error('Select a client conversation first.');
      return selected.id;
    }
    const existing = conversations.find(c => c.therapist_id === therapist && c.client_id === userId);
    if (existing) return existing.id;
    const { data, error } = await db.from('conversations').insert({ client_id: userId, therapist_id: therapist }).select().single();
    if (error) {
      const retry = await db.from('conversations').select('id').eq('client_id', userId).eq('therapist_id', therapist).single();
      if (retry.data) return retry.data.id as string;
      throw new Error(error.message);
    }
    setConversations(current => [...current.filter(c => c.id !== data.id), data]);
    return data.id as string;
  }
  async function send(therapist: number, type: 'text' | 'voice', content: string, durationSeconds?: number) {
    try {
      const conversationId = await ensureConversation(therapist);
      const db = getSupabase()!;
      let audioUrl: string | undefined;
      if (type === 'voice') {
        if (!content.startsWith('blob:')) throw new Error('Invalid recording.');
        audioUrl = await uploadVoice(conversationId, await (await fetch(content)).blob());
      }
      const { error } = await db.from('messages').insert({ conversation_id: conversationId, sender_id: userId, text: type === 'text' ? content.trim() : null, audio_url: audioUrl || null, duration_seconds: durationSeconds ? Math.max(1, Math.ceil(durationSeconds)) : null });
      if (error) throw new Error(error.message);
      setCloudError('');
      return true;
    } catch (error) { setCloudError(error instanceof Error ? error.message : 'Message failed. Please retry.'); return false; }
  }
  async function register(r: Registration) {
    if (!userId) throw new Error('Sign in from Account before registering.');
    const profile: Omit<Therapist, 'id'> = { name: r.name, title: r.title, bio: r.bio, specialties: r.specialties || [], education: [], yearsExperience: 0, languages: r.languages, approaches: [], priceOnline: r.onlinePrice || 0, priceInPerson: r.inpersonPrice || 0, rating: 0, reviewCount: 0, availability: '', imageColor: 'from-amber-200 to-yellow-400', gender: 'Unspecified', badge: 'Pending approval' };
    const db = getSupabase()!;
    const application = await db.from('practice_applications').upsert({ user_id: userId, email: r.email, phone: r.phone, license: r.license });
    if (application.error) throw new Error(application.error.message);
    const { data, error } = await db.from('practitioners').insert({ user_id: userId, profile, settings: { online: r.onlinePrice || 0, inperson: r.inpersonPrice || 0, discount: 0, presence: 'offline', days: [1,2,3,4,5], start: '09:00', end: '17:00', chatDays: [1,2,3,4,5], chatStart: '09:00', chatEnd: '17:00', photo: r.photo } }).select('id').single();
    if (error) throw new Error(error.message);
    await refreshPeople();
    return data.id as number;
  }
  async function updateSettings(id: number, settings: Settings) {
      const db = getSupabase();
      if (!db || id !== ownTherapistId) return false;
      const { error } = await db.from('practitioners').update({ settings }).eq('id', id);
      if (error) { setCloudError(error.message); return false; }
      setCloudSettings(current => ({ ...current, [id]: settings }));
      return true;
  }
  return { userId, people, ownTherapistId, conversations, messages, cloudSettings, cloudError, activeConversation, setActiveConversation, ensureConversation, send, register, updateSettings, loadMoreMessages: () => setHistoryLimit(n => n + 100) };
}

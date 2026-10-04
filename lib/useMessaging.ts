'use client';
import { useCallback, useEffect, useRef, useState } from 'react';
import { getSupabase, getPublicSupabase } from './supabase';
import { uploadVoice } from './voice';
import type { Therapist } from './data';
import type { Message, Registration, Settings } from '@/components/Platform';

export type Conversation = { id: string; client_id: string; therapist_id: number };
export function useMessaging() {
  const [userId, setUserId] = useState<string | null>(null);
  const identity = useRef<string | null>(null);
  const [people, setPeople] = useState<Therapist[]>([]);
  const [directoryReady, setDirectoryReady] = useState(false);
  const [directoryError, setDirectoryError] = useState('');
  const [ownTherapistId, setOwnTherapistId] = useState<number | null>(null);
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [messages, setMessages] = useState<Message[]>([]);
  const [messagesReady, setMessagesReady] = useState(false);
  const [reads,setReads]=useState<Record<string,string>>({});
  const [cloudSettings, setCloudSettings] = useState<Record<number, Settings>>({});
  const [cloudError, setCloudError] = useState('');
  const [activeConversation, setActiveConversation] = useState('');
  const [historyLimit, setHistoryLimit] = useState(100);
  const refreshPeople = useCallback(async () => {
    const db = getSupabase();
    const publicDb = getPublicSupabase();
    if (!db || !publicDb) { setDirectoryError('The directory is unavailable. Please try again shortly.'); setDirectoryReady(true); return; }
    const [directory, own] = await Promise.all([
      publicDb.from('practitioners').select('id,profile,settings,approved,last_seen_at').eq('approved', true).order('id'),
      userId ? db.from('practitioners').select('id,profile,settings,approved,last_seen_at,user_id').eq('user_id', userId).maybeSingle() : Promise.resolve({data:null,error:null})
    ]);
    if (identity.current !== userId) return;
    setDirectoryReady(true);
    if (directory.error) { setDirectoryError('Unable to load therapists. Please check your connection and retry.'); return; }
    setDirectoryError('');
    if (own.error) setCloudError(own.error.message);
    const ownPractice = own.data;
    const data = [...(directory.data || []), ...(ownPractice && !directory.data?.some(p => p.id === ownPractice.id) ? [ownPractice] : [])];
    setPeople((data || []).map(p => ({
      ...p.profile,
      priceOnline: p.settings?.online != null && Number(p.settings.online) > 0 ? Number(p.settings.online) : p.profile?.priceOnline,
      priceInPerson: p.settings?.inperson != null && Number(p.settings.inperson) > 0 ? Number(p.settings.inperson) : p.profile?.priceInPerson,
      badge: p.approved ? undefined : 'Pending approval',
      id: p.id
    })));
    if (!own.error) setOwnTherapistId(own.data?.id ?? null);
    setCloudSettings(Object.fromEntries((data || []).filter(p => p.settings && Object.keys(p.settings).length).map(p => [p.id, {...p.settings, lastSeenAt:p.last_seen_at}])));
  }, [userId]);
  useEffect(() => {
    const db = getSupabase();
    if (!db) return;
    const { data } = db.auth.onAuthStateChange((_event, session) => {
      if (identity.current !== (session?.user.id ?? null)) {
        setMessages([]); setMessagesReady(false); setReads({}); setConversations([]); setActiveConversation(''); setPeople(current => current.filter(p => !p.badge)); setOwnTherapistId(null); setCloudSettings({}); setHistoryLimit(100);
      }
      identity.current = session?.user.id ?? null;
      setUserId(session?.user.id ?? null);
      if (!session) { setMessages([]); setConversations([]); setActiveConversation(''); }
    });
    return () => data.subscription.unsubscribe();
  }, []);
  // Initial fetch synchronizes the directory with the remote database.
  useEffect(() => {
    const initial = setTimeout(() => void refreshPeople(), 0);
    const refresh = () => { if (document.visibilityState === 'visible') void refreshPeople(); };
    const timer = setInterval(refresh, userId?120000:30000);
    const db = getSupabase();
    const directory = db && userId?db.channel('directory:'+userId,{config:{private:true}}).on('postgres_changes', {event:'UPDATE',schema:'public',table:'practitioners'}, () => void refreshPeople()).subscribe():null;
    window.addEventListener('focus', refresh);
    return () => { clearTimeout(initial); clearInterval(timer); window.removeEventListener('focus', refresh); if(db && directory) void db.removeChannel(directory); };
  }, [refreshPeople,userId]);
  useEffect(() => {
    const db=getSupabase();
    if(!db || !userId) return;
    const touch=()=>{ if(document.visibilityState==='visible') void db.rpc('touch_activity').then(({error})=>{ if(error) console.warn('Presence update unavailable'); }); };
    touch();
    const timer=setInterval(touch,45000);
    document.addEventListener('visibilitychange',touch);
    return ()=>{clearInterval(timer);document.removeEventListener('visibilitychange',touch);};
  },[userId]);
  useEffect(() => {
    const db = getSupabase();
    if (!db || !userId) return;
    let alive = true;
    async function refresh() {
      const [conversationRows,readRows]=await Promise.all([db!.from('conversations').select('*'),db!.from('conversation_reads').select('conversation_id,read_at')]);
      const {data:threads,error:ce}=conversationRows;
      const rows = [];
      let me = null;
      for (let offset = 0; offset < historyLimit; offset += 100) {
        const page = await db!.from('messages').select('*').order('created_at', { ascending: false }).order('id').range(offset, offset + 99);
        if (page.error) { me = page.error; break; }
        rows.push(...page.data);
        if (page.data.length < 100) break;
      }
      if (!alive || identity.current !== userId) return;
      if (ce || me || readRows.error) { setCloudError((ce || me || readRows.error)!.message); return; }
      setReads(Object.fromEntries((readRows.data||[]).map(r=>[r.conversation_id,r.read_at])));
      setConversations(threads || []);
      setMessages((rows || []).reverse().flatMap(m => {
        const c = threads?.find(c => c.id === m.conversation_id);
        return c ? [{ id: m.id, conversationId: c.id, therapist: c.therapist_id, from: m.sender_id === c.client_id ? 'client' as const : 'therapist' as const, text: m.text || undefined, audio: m.audio_url || undefined, durationSeconds: m.duration_seconds, at: m.created_at, editedAt:m.edited_at }] : [];
      }));
      setMessagesReady(true);
    }
    const channel = db.channel(`messages:${userId}`, { config: { private: true } }).on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, () => void refresh()).on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'conversations' }, () => void refresh()).subscribe(status => { if (status === 'SUBSCRIBED') void refresh(); });
    void refresh();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') void refresh(); }, 60000);
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
      const { data, error } = await db.from('messages').insert({ conversation_id: conversationId, sender_id: userId, text: type === 'text' ? content.trim() : null, audio_url: audioUrl || null, duration_seconds: durationSeconds ? Math.max(1, Math.ceil(durationSeconds)) : null }).select().single();
      if (error) throw new Error(error.message);
      const sent: Message={id:data.id,conversationId,therapist,from:ownTherapistId===therapist?'therapist':'client',text:data.text||undefined,audio:data.audio_url||undefined,durationSeconds:data.duration_seconds,at:data.created_at};
      setMessages(current=>[...current.filter(m=>m.id!==sent.id),sent].sort((a,b)=>a.at.localeCompare(b.at)));
      setCloudError('');
      return { ok: true };
    } catch (error) { const msg = error instanceof Error ? error.message : 'Message failed. Please retry.'; setCloudError(msg); return { ok: false, error: msg }; }
  }
  async function editMessage(id:string,text:string) {
    try {
      const db=getSupabase(),trimmed=text.trim();
      if(!db || !userId) throw new Error('Please sign in first.');
      if(!trimmed || trimmed.length>2000) throw new Error('Use between 1 and 2,000 characters.');
      const {data,error}=await db.from('messages').update({text:trimmed}).eq('id',id).eq('sender_id',userId).select('id,text,edited_at').single();
      if(error || !data) throw new Error('Could not save your edit. Please try again.');
      setMessages(current=>current.map(m=>m.id===data.id?{...m,text:data.text,editedAt:data.edited_at}:m));
      return {ok:true};
    }catch(error){return {ok:false,error:error instanceof Error?error.message:'Could not save your edit.'};}
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
      // Only settings are writable by practitioners; reviewed profile fields are protected.
      const { data, error } = await db.from('practitioners').update({ settings }).eq('id', id).select('id').single();
      if (error || !data) { setCloudError(error?.message || 'Your practice could not be updated. Please sign in again.'); return false; }
      setCloudError('');
      setCloudSettings(current => ({ ...current, [id]: settings }));
      await refreshPeople();
      return true;
  }
  const markAsRead=useCallback(async (conversationId:string,lastMessageId:string)=>{
    const db=getSupabase();if(!db || !userId) return;
    const {error}=await db.rpc('mark_conversation_read',{conversation:conversationId,last_message:lastMessageId});
    if(!error) {
      const result=await db.from('conversation_reads').select('read_at').eq('conversation_id',conversationId).eq('user_id',userId).single();
      if(result.data) setReads(current=>({...current,[conversationId]:result.data.read_at}));
      window.dispatchEvent(new Event('messages-read'));
    }
  },[userId]);
  const unreadConversation=(id:string)=>messages.filter(m=>m.conversationId===id && m.from===(ownTherapistId?'client':'therapist') && Date.parse(m.at)>Date.parse(reads[id]||'1970-01-01')).length;
  return { userId, people, directoryReady, directoryError, refreshPeople, ownTherapistId, conversations, messages, messagesReady, unreadConversation, cloudSettings, cloudError, activeConversation, setActiveConversation, ensureConversation, send, editMessage, register, updateSettings, loadMoreMessages: () => setHistoryLimit(n => n + 100), markAsRead };
}




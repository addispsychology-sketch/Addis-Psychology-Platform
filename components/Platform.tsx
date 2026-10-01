'use client';
/* eslint-disable react-hooks/set-state-in-effect -- One-time hydration from browser storage after the identical server/client first render. */

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { therapists } from '@/lib/data';
import { therapistAm, languagesAm } from '@/lib/localization';
import { Balance, bundles, discountedPrice, addBundle, spendCredit } from '@/lib/commerce';

export type Appointment = { id: string; therapist: number; date: string; time: string; medium: 'online' | 'inperson'; status: 'pending' | 'confirmed' | 'cancelled' | 'completed'; price: number; client: string };
export type Settings = { online: number; inperson: number; discount: number; presence: 'available' | 'busy' | 'offline'; days: number[]; start: string; end: string; photo?: string; chatDays: number[]; chatStart: string; chatEnd: string };
export type Registration = { name: string; email: string; phone: string; title: string; license: string; bio: string; languages: string[]; photo: string };
export type Message = { id: string; therapist: number; from: 'client' | 'therapist'; text?: string; audio?: string; at: string };
export type Receipt = { id: string; therapist: number; bundle: string; amount: number; at: string };
type State = { balances: Record<number, Balance>; appointments: Appointment[]; settings: Record<number, Settings>; receipts: Receipt[]; saved: number[]; registration?: Registration };
const initial: State = { balances: {}, appointments: [], settings: {}, receipts: [], saved: [] };
const key = 'addis-platform-v3';
type API = { lang: 'en' | 'am'; setLang: (lang: 'en' | 'am') => void; t: (en: string, am: string) => string; date: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string; money: (n: number) => string; people: typeof therapists; state: State; ready: boolean; error: string; messages: Message[]; settings: (id: number) => Settings; balance: (id: number) => Balance; buy: (id: number, bundle: string) => boolean; send: (id: number, type: 'text' | 'voice', content: string) => boolean; reply: (id: number, content: string) => void; updateSettings: (id: number, s: Settings) => void; book: (a: Omit<Appointment, 'id' | 'status'>) => boolean; updateAppointment: (id: string, patch: Partial<Appointment>) => void; save: (id: number) => void; register: (r: Registration) => void; clear: () => void };
const Context = createContext<API | null>(null);
export function Platform({ children }: { children: ReactNode }) {
  const [lang, setLanguage] = useState<'en' | 'am'>('en');
  const [state, setState] = useState<State>(initial);
  const stateRef = useRef(state);
  const [messages, setMessages] = useState<Message[]>([]);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');
  useEffect(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored) { const s = JSON.parse(stored); if (s && Array.isArray(s.appointments) && Array.isArray(s.receipts) && s.balances && s.settings && Array.isArray(s.saved)) { stateRef.current = s; setState(s); } }
      if (localStorage.getItem('addis-language') === 'am') setLanguage('am');
    } catch { setError('storage'); }
    setReady(true);
  }, []);
  useEffect(() => { document.documentElement.lang = lang; }, [lang]);
  function commit(next: State) { stateRef.current = next; setState(next); try { localStorage.setItem(key, JSON.stringify(next)); } catch { setError('storage'); } }
  const t = (en: string, am: string) => lang === 'am' ? am : en;
  const settings = (id: number): Settings => state.settings[id] || {
    online: therapists.find(p => p.id === id)?.priceOnline || 1200,
    inperson: therapists.find(p => p.id === id)?.priceInPerson || 1600,
    discount: 0,
    presence: id === 1 || id === 3 ? 'available' : id === 2 ? 'busy' : 'offline',
    days: [1, 2, 3, 4, 5],
    start: '09:00',
    end: '17:00',
    chatDays: [1, 2, 3, 4, 5],
    chatStart: '08:00',
    chatEnd: '20:00',
  };
  const balance = (id: number) => state.balances[id] || { texts: 0, voices: 0 };
  const people = therapists.map((p, i) => lang === 'am' ? { ...p, ...therapistAm[i], languages: p.languages.map(l => languagesAm[l] || l) } : p);
  const api: API = {
    lang, setLang: l => { setLanguage(l); try { localStorage.setItem('addis-language', l); } catch { setError('storage'); } }, t, state, ready, error, messages, settings, balance, people,
    date: (v, opts) => new Date(v).toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' }),
    money: n => `${n.toLocaleString(lang === 'am' ? 'am-ET' : 'en-GB')} ${t('ETB', 'ብር')}`,
    buy: (id, bundleId) => {
      const bundle = bundles.find(b => b.id === bundleId); if (!bundle || !therapists.some(p => p.id === id)) return false;
      const s = stateRef.current;
      commit({ ...s, balances: { ...s.balances, [id]: addBundle(s.balances[id] || { texts: 0, voices: 0 }, bundle) }, receipts: [...s.receipts, { id: crypto.randomUUID(), therapist: id, bundle: bundle.id, amount: discountedPrice(bundle.price, settings(id).discount), at: new Date().toISOString() }] }); return true;
    },
    send: (id, type, content) => {
      if (!content.trim() || (type === 'text' && content.length > 2000)) return false;
      const s = stateRef.current; const next = spendCredit(s.balances[id] || { texts: 0, voices: 0 }, type); if (!next) return false;
      commit({ ...s, balances: { ...s.balances, [id]: next } });
      setMessages(m => [...m, { id: crypto.randomUUID(), therapist: id, from: 'client', at: new Date().toISOString(), ...(type === 'text' ? { text: content } : { audio: content }) }]); return true;
    },
    reply: (id, text) => { if (text.trim()) setMessages(m => [...m, { id: crypto.randomUUID(), therapist: id, from: 'therapist', text, at: new Date().toISOString() }]); },
    updateSettings: (id, value) => commit({ ...stateRef.current, settings: { ...stateRef.current.settings, [id]: value } }),
    book: a => { const s = stateRef.current; if (s.appointments.some(b => b.therapist === a.therapist && b.date === a.date && b.time === a.time && b.status !== 'cancelled')) return false; commit({ ...s, appointments: [...s.appointments, { ...a, id: crypto.randomUUID(), status: 'pending' }] }); return true; },
    updateAppointment: (id, patch) => commit({ ...stateRef.current, appointments: stateRef.current.appointments.map(a => a.id === id ? { ...a, ...patch, id: a.id } : a) }),
    save: id => { const s = stateRef.current; commit({ ...s, saved: s.saved.includes(id) ? s.saved.filter(n => n !== id) : [...s.saved, id] }); },
    register: registration => commit({ ...stateRef.current, registration }),
    clear: () => { messages.forEach(m => { if (m.audio) URL.revokeObjectURL(m.audio); }); setMessages([]); commit(initial); },
  };
  if (!ready) return <div className="platform-loading" role="status">Loading / በመጫን ላይ…</div>;
  return <Context.Provider value={api}>{error && <div className="system-note" role="alert">{t('Browser storage is unavailable. Changes will last only for this visit.', 'የአሳሹ ማስቀመጫ አይሰራም። ለውጦች ለዚህ ጉብኝት ብቻ ይቆያሉ።')}</div>}{children}</Context.Provider>;
}
export function usePlatform() { const api = useContext(Context); if (!api) throw new Error('Platform provider missing'); return api; }
export function statusLabel(status: Appointment['status'], t: API['t']) { return { pending: t('Pending', 'በመጠባበቅ ላይ'), confirmed: t('Confirmed', 'የተረጋገጠ'), cancelled: t('Cancelled', 'የተሰረዘ'), completed: t('Completed', 'የተጠናቀቀ') }[status]; }

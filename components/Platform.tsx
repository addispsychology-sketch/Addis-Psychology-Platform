'use client';
/* eslint-disable react-hooks/set-state-in-effect -- One-time hydration from browser storage after the identical server/client first render. */

import { createContext, useContext, useEffect, useRef, useState, ReactNode } from 'react';
import { Therapist } from '@/lib/data';
import { languagesAm } from '@/lib/localization';
import { Balance } from '@/lib/commerce';
import { useMessaging, type Conversation } from '@/lib/useMessaging';
import {useWallet,type WalletData} from '@/lib/useWallet';
import ClientNav from './ClientNav';
import TermsGate from './TermsGate';
import AudioCalls from './AudioCalls';
import { useAppointments } from '@/lib/useAppointments';

export type Appointment = {
  id: string;
  therapist: number;
  date: string;
  time: string;
  medium: 'online' | 'inperson';
  status: 'pending' | 'confirmed' | 'cancelled' | 'completed';
  price: number;
  client: string;
  phone?: string;
  language?: string;
};

export type Settings = {
  online: number;
  inperson: number;
  discount: number;
  presence: 'available' | 'busy' | 'offline';
  days: number[];
  start: string;
  end: string;
  photo?: string;
  chatDays: number[];
  chatStart: string;
  chatEnd: string;
};

export type Registration = {
  name: string;
  email: string;
  phone: string;
  title: string;
  license: string;
  bio: string;
  languages: string[];
  photo: string;
  specialties?: string[];
  onlinePrice?: number;
  inpersonPrice?: number;
  registeredAt?: string;
  status?: 'active' | 'pending';
};

export type Message = {
  id: string;
  therapist: number;
  conversationId?: string;
  from: 'client' | 'therapist';
  text?: string;
  audio?: string;
  durationSeconds?: number;
  at: string;
};

export type Receipt = {
  id: string;
  therapist: number;
  bundle: string;
  amount: number;
  at: string;
};

type State = {
  balances: Record<number, Balance>;
  appointments: Appointment[];
  settings: Record<number, Settings>;
  receipts: Receipt[];
  saved: number[];
  registration?: Registration;
  registeredTherapists: Therapist[];
};

const initial: State = { balances: {}, appointments: [], settings: {}, receipts: [], saved: [], registeredTherapists: [] };
const key = 'addis-platform-live-v1';

type API = {
  wallet: WalletData | null;
  refreshWallet: () => Promise<void>;
  userId: string | null;
  ownTherapistId: number | null;
  conversations: Conversation[];
  activeConversation: string;
  setActiveConversation: (id: string) => void;
  ensureConversation: (id: number) => Promise<string>;
  loadMoreMessages: () => void;
  lang: 'en' | 'am';
  setLang: (lang: 'en' | 'am') => void;
  theme: 'white' | 'dark' | 'colorful';
  setTheme: (theme: 'white' | 'dark' | 'colorful') => void;
  t: (en: string, am: string) => string;
  date: (value: string | Date, options?: Intl.DateTimeFormatOptions) => string;
  money: (n: number) => string;
  people: Therapist[];
  state: State;
  ready: boolean;
  error: string;
  messages: Message[];
  settings: (id: number) => Settings;
  balance: (id: number) => Balance;
  buy: (id: number, bundle: string) => boolean;
  send: (id: number, type: 'text' | 'voice', content: string, durationSeconds?: number) => Promise<boolean>;
  reply: (id: number, text?: string, audio?: string) => Promise<boolean>;
  updateSettings: (id: number, s: Settings) => Promise<boolean>;
  book: (a: Omit<Appointment, 'id' | 'status'>) => boolean;
  updateAppointment: (id: string, patch: Partial<Appointment>) => void;
  refreshAppointments: () => Promise<void>;
  save: (id: number) => void;
  register: (r: Registration) => Promise<number>;
  deleteTherapist: (id: number) => void;
  clear: () => void;
};

export const Context = createContext<API | null>(null);

export function Platform({ children }: { children: ReactNode }) {
  const cloud = useMessaging();
  const finances = useWallet(cloud.userId);
  const bookings = useAppointments(cloud.userId);
  const messages = cloud.messages;
  const [lang, setLanguage] = useState<'en' | 'am'>('en');
  const [theme, setThemeState] = useState<'white' | 'dark' | 'colorful'>('white');
  const [state, setState] = useState<State>(initial);
  const stateRef = useRef(state);
  const [ready, setReady] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    try {
      // Retire demo storage; never import local demo identities or transcripts.
      for (let version = 1; version <= 4; version++) {
        localStorage.removeItem(`addis-platform-v${version}`);
        localStorage.removeItem(`addis-platform-v${version}-messages`);
      }
      if (localStorage.getItem('addis-language') === 'am') setLanguage('am');
      const storedTheme = localStorage.getItem('addis-theme') as 'white' | 'dark' | 'colorful';
      if (storedTheme && ['white', 'dark', 'colorful'].includes(storedTheme)) {
        setThemeState(storedTheme);
      }
    } catch {
      setError('storage');
    }
    setReady(true);
  }, []);

  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme);
    document.body.classList.remove('theme-white', 'theme-dark', 'theme-colorful');
    document.body.classList.add(`theme-${theme}`);
  }, [theme]);

  function setTheme(t: 'white' | 'dark' | 'colorful') {
    setThemeState(t);
    try {
      localStorage.setItem('addis-theme', t);
    } catch {
      // ignore
    }
  }

  function commit(next: State) {
    stateRef.current = next;
    setState(next);
    try {
      localStorage.setItem(key, JSON.stringify(next));
    } catch {
      setError('storage');
    }
  }

  const t = (en: string, am: string) => (lang === 'am' ? am : en);

  const combinedTherapists = cloud.people.map(p => {
    const s = cloud.cloudSettings[p.id];
    if (!s) return p;
    return {
      ...p,
      priceOnline: s.online !== undefined && s.online > 0 ? Number(s.online) : p.priceOnline,
      priceInPerson: s.inperson !== undefined && s.inperson > 0 ? Number(s.inperson) : p.priceInPerson,
    };
  });

  const settings = (id: number): Settings => {
    const existing = cloud.cloudSettings[id];
    if (existing) return existing;
    const found = combinedTherapists.find(p => p.id === id);
    return {
      online: found?.priceOnline || 1200,
      inperson: found?.priceInPerson || 1600,
      discount: 0,
      presence: 'offline',
      days: [1, 2, 3, 4, 5],
      start: '09:00',
      end: '17:00',
      chatDays: [1, 2, 3, 4, 5],
      chatStart: '08:00',
      chatEnd: '20:00',
    };
  };

  const balance = () => finances.data?.credit_lots.reduce((total,lot)=>({texts:total.texts+lot.texts,voiceSeconds:total.voiceSeconds+lot.voice_seconds}),{texts:0,voiceSeconds:0}) || {texts:0,voiceSeconds:0};

  const people = combinedTherapists.map(p => {
    if (lang === 'am') {
      return {
        ...p,
        languages: p.languages.map(l => languagesAm[l] || l),
      };
    }
    return p;
  });

  const api: API = {
    wallet: finances.data, refreshWallet: finances.refresh,
    loadMoreMessages: cloud.loadMoreMessages,
    userId: cloud.userId, ownTherapistId: cloud.ownTherapistId, conversations: cloud.conversations,
    activeConversation: cloud.activeConversation, setActiveConversation: cloud.setActiveConversation, ensureConversation: cloud.ensureConversation,
    lang,
    setLang: l => {
      setLanguage(l);
      try {
        localStorage.setItem('addis-language', l);
      } catch {
        setError('storage');
      }
    },
    theme,
    setTheme,
    t,
    state: { ...state, appointments: bookings.appointments },
    ready,
    error,
    messages,
    settings,
    balance,
    people,
    date: (v, opts) =>
      new Date(v).toLocaleDateString(lang === 'am' ? 'am-ET' : 'en-GB', opts || { day: 'numeric', month: 'short', year: 'numeric' }),
    money: n => `${n.toLocaleString(lang === 'am' ? 'am-ET' : 'en-GB')} ${t('ETB', 'ብር')}`,
    buy: () => { window.location.assign('/packages'); return false; },
    send: async (...args) => { const sent=await cloud.send(...args); if(sent) await finances.refresh(); return sent; },
    reply: (id, text, audio) => cloud.send(id, audio ? 'voice' : 'text', audio || text || ''),
    updateSettings: cloud.updateSettings,
    book: () => { setError('Online booking is not enabled yet. Please contact the practice.'); return false; },
    updateAppointment: (id, patch) => { void bookings.update(id, patch); },
    refreshAppointments: bookings.refresh,
    save: id => {
      const s = stateRef.current;
      commit({
        ...s,
        saved: s.saved.includes(id) ? s.saved.filter(n => n !== id) : [...s.saved, id],
      });
    },
    register: cloud.register,
    deleteTherapist: id => {
      const s = stateRef.current;
      commit({
        ...s,
        registeredTherapists: (s.registeredTherapists || []).filter(p => p.id !== id),
      });
    },
    clear: () => {
      messages.forEach(m => {
        if (m.audio) URL.revokeObjectURL(m.audio);
      });
      commit(initial);
    },
  };

  if (!ready) return <div className="platform-loading" role="status">Loading / በመጫን ላይ…</div>;

  return (
    <Context.Provider value={api}>
      {(error || cloud.cloudError || bookings.error) && (
        <div className="system-note" role="alert">
          {cloud.cloudError || bookings.error || error}
        </div>
      )}
      <AudioCalls userId={cloud.userId} conversations={cloud.conversations} />
      {children}
      <ClientNav />
      <TermsGate />
    </Context.Provider>
  );
}

export function usePlatform() {
  const api = useContext(Context);
  if (!api) throw new Error('Platform provider missing');
  return api;
}

export function statusLabel(status: Appointment['status'], t: API['t']) {
  return {
    pending: t('Pending', 'በመጠባበቅ ላይ'),
    confirmed: t('Confirmed', 'የተረጋገጠ'),
    cancelled: t('Cancelled', 'የተሰረዘ'),
    completed: t('Completed', 'የተጠናቀቀ'),
  }[status];
}

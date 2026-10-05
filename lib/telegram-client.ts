import { authenticatedFetch, getSupabase } from './supabase';

type TelegramAuthResult = {
  session?: { access_token: string; refresh_token: string };
  needsAccount?: boolean;
  linked?: boolean;
  pending?: boolean;
  id?: string;
  url?: string;
};

type TelegramWebApp = {
  initData: string;
  initDataUnsafe?: { start_param?: string };
  ready: () => void;
  expand: () => void;
  BackButton: { show: () => void; hide: () => void; onClick: (fn: () => void) => void; offClick: (fn: () => void) => void };
};
declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp }; }
}

export function telegramInitData() {
  const init = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initData : undefined;
  return init ? init : null;
}

export function telegramLaunchData() {
  const launch = typeof window !== 'undefined' ? window.Telegram?.WebApp?.initDataUnsafe : undefined;
  return launch ? launch : null;
}

async function jsonRequest(url: string, init: RequestInit): Promise<TelegramAuthResult> {
  const response = await fetch(url, init);
  const data = await response.json();
  if (!response.ok) throw new Error(data.error || 'Server error');
  return data;
}

let pending: Promise<TelegramAuthResult> | null = null;
export async function telegramSignIn(link = false, create = false) {
  if (pending) return pending;
  const initData = telegramInitData();
  const width = 500, height = 650;
  const left = window.innerWidth / 2 - width / 2;
  const top = window.innerHeight / 2 - height / 2;
  const popup = initData ? null : window.open('', 'telegram-auth', `width=${width},height=${height},left=${left},top=${top},toolbar=0,status=0`);

  const request = link ? authenticatedFetch : jsonRequest;
  const task = (async () => {
    let result;
    if (initData) {
      const browserLoginId = new URLSearchParams(window.location.search).get('telegramLogin') || undefined;
      result = await request('/api/telegram/auth', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link, create, initData, browserLoginId }) });
    } else {
      try {
        const started = await request('/api/telegram/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ link }) });
        window.dispatchEvent(new CustomEvent('telegram-browser-login', { detail: { url: started.url } }));
        if (popup) popup.location.href = started.url;
        const deadline = Date.now() + 300000;
        let delay = 2000;
        while (Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, delay));
          if (delay < 10000) delay = Math.min(delay * 2, 10000);
          if (document.visibilityState !== 'visible') continue;
          result = await request('/api/telegram/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ checkId: started.id }) });
          if (!result.pending) break;
        }
        if (!result || result.pending) throw new Error('Telegram sign-in timed out. Please start again.');
      } catch (error) { popup?.close(); throw error; }
      finally { window.dispatchEvent(new CustomEvent('telegram-browser-login', { detail: null })); }
    }
    if (result.session) {
      const db = getSupabase();
      if (!db) throw new Error('Authentication is unavailable.');
      const { error } = await db.auth.setSession(result.session);
      if (error) throw new Error('Please sign in again.');
    }
    window.dispatchEvent(new Event('telegram-linked'));
    return result;
  })();
  pending = task;
  try { return await task; } finally { if (pending === task) pending = null; }
}

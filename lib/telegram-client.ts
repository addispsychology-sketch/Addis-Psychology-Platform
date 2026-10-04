'use client';
import { authenticatedFetch, getSupabase } from './supabase';

type TelegramWebApp = {
  initData: string;
  ready: () => void;
  expand: () => void;
  openTelegramLink: (url: string) => void;
  BackButton: { show: () => void; hide: () => void; onClick: (fn: () => void) => void; offClick: (fn: () => void) => void };
};
declare global {
  interface Window { Telegram?: { WebApp?: TelegramWebApp }; }
}

// Preserve signed launch data across navigation and refresh. The server verifies it;
// initDataUnsafe and a Telegram ID from the URL are never proof of identity.
export function telegramInitData() {
  const fromUrl = new URLSearchParams(window.location.hash.slice(1)).get('tgWebAppData') || new URLSearchParams(window.location.search).get('tgWebAppData');
  const data = window.Telegram?.WebApp?.initData || fromUrl;
  try {
    if (data) { sessionStorage.setItem('addis-telegram-launch', data); return data; }
    return sessionStorage.getItem('addis-telegram-launch') || '';
  } catch { return data || ''; }
}

async function jsonRequest(path: string, init: RequestInit = {}) {
  const response = await fetch(path, { ...init, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || 'Unable to sign in. Please try again.');
  return body;
}

let pending: Promise<Record<string, unknown>> | undefined;
export function telegramSignIn(link = false, create = true) {
  if (pending) return pending;
  const initData = telegramInitData();
  // Keep user activation: mobile browsers block a popup opened after a fetch.
  const popup = !initData ? window.open('about:blank', '_blank') : null;
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
        while (Date.now() < deadline) {
          await new Promise(resolve => setTimeout(resolve, 4000));
          if (document.visibilityState !== 'visible') continue;
          result = await request('/api/telegram/login?id=' + encodeURIComponent(started.id));
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
  void task.finally(() => { if (pending === task) pending = undefined; }).catch(() => {});
  return task;
}

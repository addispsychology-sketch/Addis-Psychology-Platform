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
  interface Window {
    Telegram?: {
      WebApp?: TelegramWebApp;
      Login?: { auth: (options: { client_id: number; scope: string[]; nonce: string }, callback: (result: { id_token?: string; error?: string }) => void) => void };
    };
  }
}

export async function telegramSignIn(link = false, create = true) {
  const initData = window.Telegram?.WebApp?.initData;
  let payload: Record<string, unknown> = { link, create };
  if (initData) payload = { ...payload, initData };
  else {
    const clientId = Number(process.env.NEXT_PUBLIC_TELEGRAM_LOGIN_CLIENT_ID);
    const login = window.Telegram?.Login;
    if (!clientId || !login) throw new Error('Telegram sign-in is not ready yet. You can use email instead.');
    const response = await fetch('/api/telegram/auth');
    if (!response.ok) throw new Error('Please try again.');
    const { nonce } = await response.json();
    const idToken = await new Promise<string>((resolve, reject) => login.auth({ client_id: clientId, scope: ['profile', 'write'], nonce }, result => result.id_token ? resolve(result.id_token) : reject(new Error(result.error || 'Telegram sign-in was cancelled.'))));
    payload.idToken = idToken;
  }
  const init = { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) };
  const result = link ? await authenticatedFetch('/api/telegram/auth', init) : await fetch('/api/telegram/auth', init).then(async r => { const body = await r.json(); if (!r.ok) throw new Error(body.error || 'Unable to sign in.'); return body; });
  if (result.session) {
    const { error } = await getSupabase()!.auth.setSession(result.session);
    if (error) throw new Error('Please sign in again.');
  }
  return result;
}

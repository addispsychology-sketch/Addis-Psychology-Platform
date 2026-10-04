import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
let publicClient: SupabaseClient | undefined;
export function getPublicSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  // Keep public profiles browsable while a Telegram session initializes or refreshes.
  publicClient ??= createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false, storageKey: 'addis-public-directory' } });
  return publicClient;
}
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key);
  return client;
}

export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const db = getSupabase();
  let session = db && (await db.auth.getSession()).data.session;
  if (!session && typeof window !== 'undefined' && !path.startsWith('/api/telegram/')) {
    const { telegramInitData, telegramSignIn } = await import('./telegram-client');
    if (telegramInitData()) { await telegramSignIn(); session = db && (await db.auth.getSession()).data.session; }
  }
  if (!session) throw new Error('Please sign in first.');
  const send = (token: string) => {
    const headers = new Headers(init.headers); headers.set('Authorization', `Bearer ${token}`);
    return fetch(path, { ...init, headers, cache: 'no-store' });
  };
  let response = await send(session.access_token);
  if (response.status === 401 && db) {
    // Unauthorized handlers have not performed the mutation. Retry once after refresh.
    session = (await refreshSession()).data.session;
    if (!session && typeof window !== 'undefined' && !path.startsWith('/api/telegram/')) {
      const { telegramInitData, telegramSignIn } = await import('./telegram-client');
      if (telegramInitData()) { await telegramSignIn(); session = (await db.auth.getSession()).data.session; }
    }
    if (session) response = await send(session.access_token);
  }
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed. Please try again.');
  }
  return response.json();
}

let refreshing: ReturnType<SupabaseClient['auth']['refreshSession']> | undefined;
async function refreshSession() {
  if (refreshing) return refreshing;
  const task = getSupabase()!.auth.refreshSession();
  refreshing = task;
  try { return await task; } finally { if (refreshing === task) refreshing = undefined; }
}

import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let client: SupabaseClient | undefined;
export function getSupabase() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;
  if (!url || !key) return null;
  client ??= createClient(url, key);
  return client;
}

export async function authenticatedFetch(path: string, init: RequestInit = {}) {
  const db = getSupabase();
  const session = db && (await db.auth.getSession()).data.session;
  if (!session) throw new Error('Please sign in first.');
  const response = await fetch(path, { ...init, headers: { ...init.headers, Authorization: `Bearer ${session.access_token}` } });
  if (!response.ok) {
    const body = await response.json().catch(() => ({}));
    throw new Error(body.error || 'Request failed. Please try again.');
  }
  return response.json();
}

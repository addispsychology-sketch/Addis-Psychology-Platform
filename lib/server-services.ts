import 'server-only';
import { createClient } from '@supabase/supabase-js';

export function serviceDb() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;
  if (!url || !key) throw new Error('This service is awaiting setup. Please try again later.');
  return createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
}

export function siteUrl(path = '/') {
  const base = new URL(process.env.APP_URL || 'http://localhost:3000');
  if (process.env.NODE_ENV === 'production' && base.protocol !== 'https:') throw new Error('APP_URL must use HTTPS.');
  return new URL(path, base.origin).toString();
}

export function apiError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Please try again.';
  return Response.json({ error: message }, { status: message === 'Unauthorized' ? 401 : 400, headers: { 'Cache-Control': 'no-store' } });
}

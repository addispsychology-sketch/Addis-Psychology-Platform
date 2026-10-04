import { getPublicSupabase } from '@/lib/supabase';

export async function GET() {
  const db = getPublicSupabase();
  if (!db) return Response.json({ error: 'Directory unavailable.' }, { status: 503 });
  // This client is always anonymous: pending profiles and private accounts cannot
  // enter the shared CDN cache, even when the requesting browser is signed in.
  const { data, error } = await db.from('practitioners').select('id,profile,settings,approved,last_seen_at').eq('approved', true).order('id');
  if (error) return Response.json({ error: 'Directory unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });
  return Response.json(data, { headers: { 'Cache-Control': 'public, max-age=15, s-maxage=30, stale-while-revalidate=30' } });
}

import { getPublicSupabase } from '@/lib/supabase';

type DirectoryEntry = {
  id: number;
  profile: Record<string, unknown> | null;
  settings: Record<string, unknown> | null;
  approved: boolean;
  last_seen_at: string | null;
};

let cache: { at: number; data: DirectoryEntry[] } | null = null;

export async function GET() {
  if (cache && Date.now() - cache.at < 10 * 60_000) {
    return Response.json(cache.data, { headers: { 'Cache-Control': 'public, max-age=600' } });
  }

  const db = getPublicSupabase();
  if (!db) return Response.json({ error: 'Directory unavailable.' }, { status: 503 });

  const { data, error } = await db.from('practitioners').select('id,profile,settings,approved,last_seen_at').eq('approved', true).order('id');
  if (error) return Response.json({ error: 'Directory unavailable.' }, { status: 503, headers: { 'Cache-Control': 'no-store' } });

  cache = { at: Date.now(), data };
  return Response.json(data, { headers: { 'Cache-Control': 'public, max-age=600' } });
}

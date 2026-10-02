import { createHmac } from 'node:crypto';
import { authorize } from '@/lib/server-auth';
export async function GET(request: Request) {
  try {
    const { user } = await authorize(request);
    const iceServers: RTCIceServer[] = [{ urls: 'stun:stun.l.google.com:19302' }];
    if (process.env.TURN_URLS && process.env.TURN_SHARED_SECRET) {
      const username = `${Math.floor(Date.now() / 1000) + 3600}:${user.id}`;
      iceServers.push({ urls: process.env.TURN_URLS.split(',').map(s => s.trim()), username, credential: createHmac('sha1', process.env.TURN_SHARED_SECRET).update(username).digest('base64') });
    }
    return Response.json({ iceServers }, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return Response.json({ error: 'Sign in to make calls.' }, { status: 401 });
  }
}

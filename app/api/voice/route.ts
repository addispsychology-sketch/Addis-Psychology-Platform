import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { authorize } from '@/lib/server-auth';

export const runtime = 'nodejs';
const headers = { 'Cache-Control': 'no-store' };
const voiceBucket = 'voice-notes';
function storage() {
  const { R2_ACCOUNT_ID, R2_ACCESS_KEY_ID, R2_SECRET_ACCESS_KEY, R2_BUCKET_NAME } = process.env;
  if (!R2_ACCOUNT_ID || !R2_ACCESS_KEY_ID || !R2_SECRET_ACCESS_KEY || !R2_BUCKET_NAME) throw new Error('Voice storage is not configured.');
  return { bucket: R2_BUCKET_NAME, client: new S3Client({ region: 'auto', requestChecksumCalculation: 'WHEN_REQUIRED', endpoint: `https://${R2_ACCOUNT_ID}.r2.cloudflarestorage.com`, credentials: { accessKeyId: R2_ACCESS_KEY_ID, secretAccessKey: R2_SECRET_ACCESS_KEY } }) };
}
export async function POST(request: Request) {
  try {
    const { db, user } = await authorize(request);
    const { conversationId, contentType, size } = await request.json();
    const provider = process.env.VOICE_STORAGE || 'supabase';
    if (!['supabase', 'r2'].includes(provider)) throw new Error('Unknown storage provider.');
    const maxMegabytes = provider === 'supabase' ? 50 : 100;
    if (!['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4', 'audio/mp4;codecs=mp4a.40.2'].includes(contentType) || !Number.isSafeInteger(size) || size <= 0 || size > maxMegabytes * 1024 * 1024) return Response.json({ error: `Unsupported audio or file larger than ${maxMegabytes} MB.` }, { status: 400, headers });
    const { data } = await db.from('conversations').select('id').eq('id', conversationId).single();
    if (!data) return Response.json({ error: 'Conversation not found.' }, { status: 403, headers });
    const key = `${conversationId}/${user.id}/${crypto.randomUUID()}`;
    if (provider === 'supabase') {
      const { data: upload, error } = await db.storage.from(voiceBucket).createSignedUploadUrl(key, { upsert: false });
      if (error || !upload) throw new Error('Unable to authorize audio upload.');
      return Response.json({ provider, bucket: voiceBucket, key, token: upload.token, audioUrl: `/api/voice?key=${encodeURIComponent(key)}&storage=supabase` }, { headers });
    }
    const { client, bucket } = storage();
    const uploadUrl = await getSignedUrl(client, new PutObjectCommand({ Bucket: bucket, Key: key, ContentType: contentType, ContentLength: size }), { expiresIn: 300 });
    return Response.json({ uploadUrl, audioUrl: `/api/voice?key=${encodeURIComponent(key)}` }, { headers });
  } catch (error) {
    return Response.json({ error: error instanceof Error && error.message === 'Unauthorized' ? 'Unauthorized' : 'Voice upload is unavailable. Check your server configuration.' }, { status: 400, headers });
  }
}
export async function GET(request: Request) {
  try {
    const { db } = await authorize(request);
    const params = new URL(request.url).searchParams;
    const key = params.get('key');
    const provider = params.get('storage');
    if (provider !== null && provider !== 'supabase') return Response.json({ error: 'Invalid storage reference.' }, { status: 400, headers });
    if (!key || !/^[a-f0-9-]{36}\/[a-f0-9-]{36}\/[a-f0-9-]{36}$/.test(key)) return Response.json({ error: 'Invalid audio reference.' }, { status: 400, headers });
    const audioUrl = `/api/voice?key=${encodeURIComponent(key)}${provider === 'supabase' ? '&storage=supabase' : ''}`;
    const { data } = await db.from('messages').select('id').eq('audio_url', audioUrl).limit(1).single();
    if (!data) return Response.json({ error: 'Audio not found.' }, { status: 403, headers });
    if (provider === 'supabase') {
      const { data: signed, error } = await db.storage.from(voiceBucket).createSignedUrl(key, 3600);
      if (error || !signed) throw new Error('Unable to authorize playback.');
      return Response.json({ url: signed.signedUrl }, { headers });
    }
    const { client, bucket } = storage();
    const url = await getSignedUrl(client, new GetObjectCommand({ Bucket: bucket, Key: key }), { expiresIn: 3600 });
    return Response.json({ url }, { headers });
  } catch {
    return Response.json({ error: 'Audio playback is unavailable.' }, { status: 401, headers });
  }
}

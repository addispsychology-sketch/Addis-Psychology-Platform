import { authenticatedFetch, getSupabase } from './supabase';

export function createVoiceRecorder(stream: MediaStream) {
  const mimeType = ['audio/webm;codecs=opus', 'audio/ogg;codecs=opus', 'audio/mp4'].find(type => MediaRecorder.isTypeSupported(type));
  if (!mimeType) throw new Error('This browser cannot record supported audio.');
  return new MediaRecorder(stream, { mimeType, audioBitsPerSecond: 32000 });
}

export async function uploadVoice(conversationId: string, blob: Blob) {
  const upload = await authenticatedFetch('/api/voice', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ conversationId, contentType: blob.type, size: blob.size }),
  });
  const { uploadUrl, audioUrl } = upload;
  if (upload.provider === 'supabase') {
    const db = getSupabase();
    if (!db) throw new Error('Please sign in first.');
    const { error } = await db.storage.from(upload.bucket).uploadToSignedUrl(upload.key, upload.token, blob, { contentType: blob.type, cacheControl: '3600' });
    if (error) throw new Error('Audio upload failed. Storage may be full; please try again or contact support.');
    return audioUrl as string;
  }
  const result = await fetch(uploadUrl, { method: 'PUT', headers: { 'Content-Type': blob.type }, body: blob, signal: AbortSignal.timeout(300000) });
  if (!result.ok) throw new Error('Audio upload failed. Please try again.');
  return audioUrl as string;
}

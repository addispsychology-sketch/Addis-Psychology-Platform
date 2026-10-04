import 'server-only';
import { createHash } from 'node:crypto';
import { proofType } from './payment-proof';
import { serviceDb } from './server-services';

export async function storeProfilePhoto(userId: string, bytes: Uint8Array) {
  if (!bytes.length || bytes.length > 1048576) throw new Error('Choose a photo smaller than 1 MB.');
  const contentType = proofType(bytes);
  const extension = contentType === 'image/jpeg' ? 'jpg' : contentType === 'image/png' ? 'png' : 'webp';
  const key = `${userId}/${createHash('sha256').update(bytes).digest('hex')}.${extension}`;
  const db = serviceDb();
  const { error } = await db.storage.from('profile-photos').upload(key, bytes, { contentType, cacheControl: '31536000', upsert: false });
  if (error && !('statusCode' in error && String(error.statusCode) === '409')) throw new Error('Photo upload failed. Please try again.');
  return db.storage.from('profile-photos').getPublicUrl(key).data.publicUrl;
}

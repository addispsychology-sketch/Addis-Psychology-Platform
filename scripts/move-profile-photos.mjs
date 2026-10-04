// Upload first, verify the exact bytes, and print a small manifest for an atomic
// photo-only database update. The original image is preserved in an ignored backup.
import { createClient } from '@supabase/supabase-js';
import { createHash } from 'node:crypto';
import { writeFileSync } from 'node:fs';
const db = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const { data: rows, error } = await db.from('practitioners').select('id,user_id,settings');
if (error) throw new Error('Profile lookup failed.');
const backup = rows.filter(row => /^data:image\/(jpeg|png|webp);base64,/.test(row.settings?.photo || ''));
if (!backup.length) { console.log('No inline profile photos remain.'); process.exit(0); }
writeFileSync('.env.profile-photo-backup.json', JSON.stringify(backup));
const changes = [];
for (const row of backup) {
  const original = row.settings.photo;
  const [, format, body] = original.match(/^data:image\/(jpeg|png|webp);base64,(.+)$/);
  const bytes = Buffer.from(body, 'base64'), digest = createHash('sha256').update(bytes).digest('hex');
  const key = `${row.user_id}/${digest}.${format === 'jpeg' ? 'jpg' : format}`;
  const { error: uploadError } = await db.storage.from('profile-photos').upload(key, bytes, { contentType: 'image/' + format, cacheControl: '31536000', upsert: false });
  if (uploadError && String(uploadError.statusCode) !== '409') throw new Error('Photo upload failed. The original database value is unchanged.');
  const url = db.storage.from('profile-photos').getPublicUrl(key).data.publicUrl;
  const response = await fetch(url);
  if (!response.ok || createHash('sha256').update(Buffer.from(await response.arrayBuffer())).digest('hex') !== digest) throw new Error('Photo verification failed. The original database value is unchanged.');
  changes.push({ id: row.id, previousMd5: createHash('md5').update(original).digest('hex'), url, originalCharacters: original.length, imageBytes: bytes.length });
}
writeFileSync('.env.profile-photo-manifest.json', JSON.stringify(changes));
console.log(JSON.stringify(changes, null, 2));

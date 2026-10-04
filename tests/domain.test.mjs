import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { createHmac } from 'node:crypto';
// Import the pure TypeScript domain functions using Node's built-in type stripping.
const commerceSource = readFileSync(new URL('../lib/commerce.ts', import.meta.url), 'utf8');
const { stripTypeScriptTypes } = await import('node:module');
const { addBundle, spendCredit, bundles, discountedPrice, migrateBalance, formatVoiceTime } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(commerceSource)));
const calendarSource = readFileSync(new URL('../lib/calendar.ts', import.meta.url), 'utf8');
const { dateKey, shiftDate, slots, isFutureSlot } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(calendarSource)));
const { verifyMiniApp, equalSecret } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(readFileSync(new URL('../lib/telegram-validation.ts', import.meta.url), 'utf8'))));
const { normalizePhone, validateBooking } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(readFileSync(new URL('../lib/booking-validation.ts', import.meta.url), 'utf8'))));
const { refundableCents } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(readFileSync(new URL('../lib/payment-policy.ts', import.meta.url), 'utf8'))));
const { proofType } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(readFileSync(new URL('../lib/payment-proof.ts', import.meta.url), 'utf8'))));
const {postText,postActions}=await import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(readFileSync(new URL('../lib/channel-post.ts',import.meta.url),'utf8'))));
const {postCaptionLength}=await import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(readFileSync(new URL('../lib/channel-post.ts',import.meta.url),'utf8'))));
const {miniAppLink,miniAppPath}=await import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(readFileSync(new URL('../lib/telegram-links.ts',import.meta.url),'utf8'))));
const {channelMediaSpec,channelMediaType}=await import('data:text/javascript,'+encodeURIComponent(stripTypeScriptTypes(readFileSync(new URL('../lib/channel-media.ts',import.meta.url),'utf8'))));
test('channel buttons launch the Mini App directly and reject unsafe destinations',()=>{
 for(const path of ['/', '/therapists', '/chat?therapist=1', '/schedule/1','/admin']){
  const link=new URL(miniAppLink('addispsychology_bot',path));
  assert.equal(link.searchParams.has('start'),false);
  assert.equal(miniAppPath(link.searchParams.get('startapp')),path);
 }
 const long='/chat?conversation=00000000-0000-4000-8000-000000000001';
 assert.equal(miniAppPath(new URL(miniAppLink('addispsychology_bot',long)).searchParams.get('startapp')),long);
 assert.equal(new URL(miniAppLink('addispsychology_bot','/therapists','addis')).pathname,'/addispsychology_bot/addis');
 const unicode='/chat?label=ድጋፍ';assert.equal(miniAppPath(new URL(miniAppLink('addispsychology_bot',unicode)).searchParams.get('startapp')),unicode);
 for(const path of ['//evil.example','https://evil.example','/chat\\evil','/chat\ninvalid','/unrecognized']){
  assert.throws(()=>miniAppLink('addispsychology_bot',path));
  assert.equal(miniAppPath(Buffer.from(path).toString('base64url')),null);
 }
 assert.equal(miniAppPath('connect'),null);
 assert.equal(miniAppPath('Lw=='),null);
 assert.throws(()=>miniAppLink(undefined,'/'));
});
test('channel media enforces Telegram URL-upload limits, file signatures and full caption length',()=>{
 assert.equal(channelMediaSpec('image/jpeg',5*1024*1024).type,'photo');
 assert.equal(channelMediaSpec('video/mp4',20*1024*1024).type,'video');
 for(const [type,size] of [['image/jpeg',5*1024*1024+1],['video/mp4',20*1024*1024+1],['image/svg+xml',42],['text/html',42],['image/png',0],['image/png',1.5]])assert.throws(()=>channelMediaSpec(type,size));
 assert.equal(channelMediaType(new Uint8Array([255,216,255])),'image/jpeg');
 assert.equal(channelMediaType(new Uint8Array([137,80,78,71,13,10,26,10])),'image/png');
 assert.equal(channelMediaType(new TextEncoder().encode('0000ftypisom0000')),'video/mp4');
 for(const header of ['<svg>','<html>','0000ftypqt  0000'])assert.throws(()=>channelMediaType(new TextEncoder().encode(header)));
 const fixed=postCaptionLength('Heading','');
 assert.equal(postCaptionLength('Heading','&'.repeat(1024-fixed)),1024);
 assert.ok(postText('Heading','&'.repeat(1024-fixed)).length>1024);
});
test('channel posts preserve safe formatting and link to voice, chat and booking',()=>{
 assert.ok(postText('<script>','Private & respectful').includes('&lt;script&gt;'));
 assert.ok(postText('Professional care','Private & respectful').includes('Private &amp; respectful'));
 assert.deepEqual(postActions(1).flat().map(b=>b.path),['/chat?therapist=1','/chat?therapist=1','/schedule/1']);
});

test('refund estimate preserves principal, prorates mixed credits and excludes service fees', () => {
 const lot = {principal_cents:48000,texts:250,voice_seconds:900,initial_texts:250,initial_voice_seconds:900};
 assert.equal(refundableCents(lot),48000);
 assert.equal(refundableCents({...lot,texts:125,voice_seconds:450}),24000);
 assert.equal(refundableCents({...lot,texts:0,voice_seconds:0}),0);
 assert.equal(refundableCents({...lot,texts:249}),47850);
 assert.equal(refundableCents({...lot,initial_texts:0,initial_voice_seconds:0}),0);
});
test('payment proofs accept raster signatures and reject HTML, SVG and empty files', () => {
 assert.equal(proofType(new Uint8Array([137,80,78,71,13,10,26,10])), 'image/png');
 assert.equal(proofType(new Uint8Array([255,216,255])), 'image/jpeg');
 assert.equal(proofType(new TextEncoder().encode('RIFF0000WEBP')), 'image/webp');
 for (const value of ['', '<svg></svg>', '<html>receipt</html>']) assert.throws(() => proofType(new TextEncoder().encode(value)));
});

test('Telegram authentication rejects forgery, stale data, duplicate keys, and missing signatures', () => {
 const token = 'test-only-not-a-real-bot-token';
 const now = Date.parse('2026-10-03T09:00:00Z');
 const params = new URLSearchParams({ auth_date: String(now / 1000), user: JSON.stringify({ id: 123456, first_name: 'Test' }), query_id: 'query-test' });
 const check = [...params.entries()].sort(([a], [b]) => a.localeCompare(b, 'en')).map(([k,v]) => `${k}=${v}`).join('\n');
 params.set('hash', createHmac('sha256', createHmac('sha256', 'WebAppData').update(token).digest()).update(check).digest('hex'));
 assert.deepEqual(verifyMiniApp(params.toString(), token, now), { id: 123456, name: 'Test' });
 assert.throws(() => verifyMiniApp(params.toString(), 'wrong-token', now));
 assert.throws(() => verifyMiniApp(params.toString(), token, now + 301000));
 assert.throws(() => verifyMiniApp(params.toString(), token, now - 31000));
 assert.throws(() => verifyMiniApp(params.toString() + '&user={}', token, now));
 params.set('user', JSON.stringify({ id: 999, first_name: 'Forged' }));
 assert.throws(() => verifyMiniApp(params.toString(), token, now));
 assert.throws(() => verifyMiniApp('auth_date=1&user={}', token, now));
 assert.equal(equalSecret('', ''), false);
 assert.equal(equalSecret('a', 'aa'), false);
});

test('booking contact validation enforces consent, Addis time, valid dates, and international phone format', () => {
 const now = Date.parse('2026-10-03T09:00:00Z');
 const input = { therapist: 1, date: '2026-10-04', time: '09:00', name: 'Test client', phone: '0911 111 111', language: 'Amharic', medium: 'online', consent: true };
 const booking = validateBooking(input, now);
 assert.equal(booking.phone, '+251911111111');
 assert.equal(booking.starts_at, '2026-10-04T06:00:00.000Z');
 assert.equal(normalizePhone('+44 7700 900000'), '+447700900000');
 for (const patch of [{consent:false},{phone:'123'},{name:'X'},{date:'2026-02-30'},{time:'25:00'},{time:'09:30'},{date:'2027-10-04'},{therapist:0},{medium:'unsupported'}]) assert.throws(() => validateBooking({...input,...patch}, now));
});
test('packages use the requested text and per-minute voice rates', () => {
 assert.deepEqual(bundles.map(b => b.price), [150, 420, 480, 570]);
 assert.equal(bundles[1].voiceSeconds, 3600);
 const original = { texts: 4, voiceSeconds: 60 };
 assert.deepEqual(addBundle(original, bundles[3]), { texts: 104, voiceSeconds: 3660 });
 assert.deepEqual(original, { texts: 4, voiceSeconds: 60 });
});
test('voice charges measured seconds, supports recordings over a minute, and rounds up once', () => {
 const b = { texts: 10, voiceSeconds: 3600 };
 assert.deepEqual(spendCredit(b, 'voice', 125.2), { texts: 10, voiceSeconds: 3474 });
 assert.deepEqual(spendCredit(b, 'voice', 3600), { texts: 10, voiceSeconds: 0 });
 assert.equal(spendCredit(b, 'voice', 3600.1), null);
 for (const invalid of [undefined, 0, -1, NaN, Infinity]) assert.equal(spendCredit(b, 'voice', invalid), null);
 assert.deepEqual(spendCredit(b, 'text'), { texts: 9, voiceSeconds: 3600 });
 assert.equal(spendCredit({ texts: 0, voiceSeconds: 60 }, 'text'), null);
});
test('old voice-note balances migrate once to minute balances without losing text credit', () => {
 assert.deepEqual(migrateBalance({ texts: 7, voices: 3 }), { texts: 7, voiceSeconds: 180 });
 assert.deepEqual(migrateBalance({ texts: 7, voices: 3, voiceSeconds: 22 }), { texts: 7, voiceSeconds: 22 });
 assert.deepEqual(migrateBalance({ texts: -1, voices: NaN }), { texts: 0, voiceSeconds: 0 });
 assert.equal(formatVoiceTime(125), '2:05');
});
test('prices preserve cents and validate discounts', () => {
 assert.equal(discountedPrice(1.5, 0), 1.5);
 assert.equal(discountedPrice(650, 15), 552.5);
 assert.equal(discountedPrice(420, 10), 378);
 assert.throws(() => discountedPrice(250, 51));
 assert.throws(() => discountedPrice(-1, 10));
 assert.throws(() => discountedPrice(250, NaN));
});
test('Addis Ababa day boundary and month transitions', () => {
 assert.equal(dateKey(new Date('2026-09-29T22:00:00Z')), '2026-09-30');
 assert.equal(shiftDate('2026-09-30', 1), '2026-10-01');
 assert.equal(shiftDate('2026-01-01', -1), '2025-12-31');
 assert.deepEqual(slots('09:00','12:00'), ['09:00','10:00','11:00']);
 assert.equal(isFutureSlot('2020-01-01','09:00'), false);
 assert.equal(isFutureSlot('invalid','09:00'), false);
});

const emailTemplates = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(readFileSync(new URL('../lib/email-templates.ts', import.meta.url), 'utf8'))));
test('notification email escapes user names, content, and rejects unsafe links', () => {
 const result = emailTemplates.renderAppointmentEmail({ recipientName: '<img src=x>', summary: '<script>bad</script>', appointmentPath: 'https://example.com/appointments', accountPath: 'https://example.com/account' });
 assert.ok(!result.html.includes('<img src=x>'));
 assert.ok(result.html.includes('&lt;script&gt;bad&lt;/script&gt;'));
 assert.throws(() => emailTemplates.renderAnnouncementEmail({ title: 'Hello', message: 'Hi', actionText: 'Open', actionUrl: 'javascript:alert(1)' }));
});

const { therapistAvailability } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(readFileSync(new URL('../lib/presence.ts', import.meta.url), 'utf8'))));
test('live presence expires, respects manual status and works outside scheduled hours', () => {
 const now=Date.parse('2026-10-04T09:00:00Z');
 const settings={presence:'available',chatDays:[1],chatStart:'09:00',chatEnd:'17:00',lastSeenAt:new Date(now-45000).toISOString()};
 assert.equal(therapistAvailability(settings,now).isOnline,true);
 assert.equal(therapistAvailability(settings,now).inWindow,false);
 assert.equal(therapistAvailability({...settings,lastSeenAt:null},now).isOnline,false);
 assert.equal(therapistAvailability({...settings,lastSeenAt:new Date(now-121000).toISOString()},now).isOnline,false);
 for(const presence of ['busy','offline']) assert.equal(therapistAvailability({...settings,presence},now).isOnline,false);
 assert.equal(therapistAvailability({...settings,chatDays:[1],chatStart:'22:00',chatEnd:'02:00'},Date.parse('2026-10-05T22:00:00Z')).inWindow,true);
});
test('auth email preserves provider tokens and routes through explicit confirmation without unsafe interpolation', () => {
 const confirmation = emailTemplates.renderEmailConfirmationTemplate('https://example.com/auth/confirm?token_hash={{ .TokenHash }}&type=email', '<script>alert(1)</script>');
 assert.ok(confirmation.includes('{{ .Token }}'));
 assert.ok(confirmation.includes('token_hash={{ .TokenHash }}&amp;type=email'));
 assert.ok(!confirmation.includes('<script>'));
 assert.ok(confirmation.includes('width="100%"'));
 const recovery = emailTemplates.renderPasswordResetTemplate('https://example.com/auth/confirm?token_hash={{ .TokenHash }}&type=recovery');
 assert.ok(recovery.includes('Choose a new password'));
 assert.ok(!recovery.includes('{{ .Token }}'));
 assert.throws(() => emailTemplates.renderPasswordResetTemplate('javascript:alert(1)'));
});

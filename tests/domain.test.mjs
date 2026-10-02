import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
// Import the pure TypeScript domain functions using Node's built-in type stripping.
const commerceSource = readFileSync(new URL('../lib/commerce.ts', import.meta.url), 'utf8');
const { stripTypeScriptTypes } = await import('node:module');
const { addBundle, spendCredit, bundles, discountedPrice, migrateBalance, formatVoiceTime } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(commerceSource)));
const calendarSource = readFileSync(new URL('../lib/calendar.ts', import.meta.url), 'utf8');
const { dateKey, shiftDate, slots, isFutureSlot } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(calendarSource)));
test('packages use the requested text and per-minute voice rates', () => {
 assert.deepEqual(bundles.map(b => b.price), [150, 420, 570]);
 assert.equal(bundles[1].voiceSeconds, 3600);
 const original = { texts: 4, voiceSeconds: 60 };
 assert.deepEqual(addBundle(original, bundles[2]), { texts: 104, voiceSeconds: 3660 });
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

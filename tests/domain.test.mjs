import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
// Import the pure TypeScript domain functions using Node's built-in type stripping.
const commerceSource = readFileSync(new URL('../lib/commerce.ts', import.meta.url), 'utf8');
const { stripTypeScriptTypes } = await import('node:module');
const { addBundle, spendCredit, bundles, discountedPrice } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(commerceSource)));
const calendarSource = readFileSync(new URL('../lib/calendar.ts', import.meta.url), 'utf8');
const { dateKey, shiftDate, slots, isFutureSlot } = await import('data:text/javascript,' + encodeURIComponent(stripTypeScriptTypes(calendarSource)));
test('a prepaid package adds credits without altering existing balances', () => {
 const original = { texts: 4, voices: 1 };
 assert.deepEqual(addBundle(original, bundles[0]), { texts: 24, voices: 4 });
 assert.deepEqual(original, { texts: 4, voices: 1 });
});
test('text and voice balances are separate and cannot become negative', () => {
 let b = { texts: 1, voices: 0 };
 assert.equal(spendCredit(b, 'voice'), null);
 b = spendCredit(b, 'text');
 assert.deepEqual(b, { texts: 0, voices: 0 });
 assert.equal(spendCredit(b, 'text'), null);
});
test('discount limits and checkout rounding', () => {
 assert.equal(discountedPrice(250, 10), 225);
 assert.equal(discountedPrice(650, 15), 553);
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

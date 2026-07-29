const test = require('node:test');
const assert = require('node:assert/strict');

const { arrayBufferToBase64, base64ToUint8Array, getExpirationTimestamp, formatExpiration } = require('../../site.in/assets/js/client-logic.js');

test('round-trips binary data through base64 helpers', () => {
  const bytes = new Uint8Array([0, 255, 16, 32, 64]);
  const encoded = arrayBufferToBase64(bytes.buffer);
  const decoded = base64ToUint8Array(encoded);

  assert.deepEqual(Array.from(decoded), Array.from(bytes));
});

test('converts an expiration date to an end-of-day timestamp', () => {
  const expected = Math.floor(new Date('2026-07-29T23:59:59').getTime() / 1000);
  assert.equal(getExpirationTimestamp('2026-07-29'), expected);
});

test('returns null for empty expiration values', () => {
  assert.equal(getExpirationTimestamp(''), null);
  assert.equal(getExpirationTimestamp(null), null);
});

test('formats expiration information for stored entries', () => {
  assert.equal(formatExpiration({ expires_at: null }), 'No expiration date');
  assert.match(formatExpiration({ expires_at: 1765000000 }), /Expires/);
});

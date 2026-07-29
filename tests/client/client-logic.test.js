const test = require('node:test');
const assert = require('node:assert/strict');

const { arrayBufferToBase64, base64ToUint8Array, getExpirationTimestamp, formatExpiration, filterFiles, parseShareFragment, buildShareUrl, generateAesKey, exportRawKey, importRawKey, encryptKeyWithParent, decryptKeyWithParent } = require('../../site.in/assets/js/client-logic.js');

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

test('filters files by name or date', () => {
  const files = [
    { name: 'document.pdf', uploaded_at: 1765000000 },
    { name: 'image.png', uploaded_at: 1766000000 },
    { name: 'notes.txt', uploaded_at: 1767000000 }
  ];

  assert.equal(filterFiles(files, 'doc').length, 1);
  assert.equal(filterFiles(files, 'doc')[0].name, 'document.pdf');
  assert.equal(filterFiles(files, '').length, 3);
  assert.equal(filterFiles(files, '  ').length, 3);
});

test('builds and parses share URL fragments correctly', () => {
  const url = buildShareUrl('https://whispers.bannister.us/', 'file-1234', 'key-5678', 'usr-9', 'coll-1');
  assert.equal(url, 'https://whispers.bannister.us/#file=file-1234&key=key-5678&user=usr-9&coll=coll-1');

  const parsed = parseShareFragment('#file=file-1234&key=key-5678&user=usr-9&coll=coll-1');
  assert.deepEqual(parsed, {
    fileUuid: 'file-1234',
    key: 'key-5678',
    userId: 'usr-9',
    collectionId: 'coll-1'
  });

  assert.equal(parseShareFragment(''), null);
  assert.equal(parseShareFragment('#invalid'), null);
});

test('round-trips 3-layer envelope encryption (Master -> Collection -> File -> Data)', async () => {
  const masterKey = await generateAesKey();
  const collectionKey = await generateAesKey();
  const fileKey = await generateAesKey();

  // 1. Encrypt Collection Key with Master Key
  const encryptedCollectionKey = await encryptKeyWithParent(collectionKey, masterKey);

  // 2. Encrypt File Key with Collection Key
  const encryptedFileKey = await encryptKeyWithParent(fileKey, collectionKey);

  // 3. Encrypt payload with File Key
  const crypto = require('node:crypto').webcrypto;
  const plaintext = new TextEncoder().encode('Hello, Whispers Envelope Encryption!');
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const ciphertext = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, fileKey, plaintext);

  // Decryption chain:
  // Master Key -> Decrypt Collection Key
  const unwrappedCollectionKey = await decryptKeyWithParent(encryptedCollectionKey, masterKey);

  // Collection Key -> Decrypt File Key
  const unwrappedFileKey = await decryptKeyWithParent(encryptedFileKey, unwrappedCollectionKey);

  // File Key -> Decrypt Payload
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, unwrappedFileKey, ciphertext);
  assert.equal(new TextDecoder().decode(decrypted), 'Hello, Whispers Envelope Encryption!');

  // Single file share key export & direct decrypt test
  const rawFileKeyStr = await exportRawKey(unwrappedFileKey);
  const recipientFileKey = await importRawKey(rawFileKeyStr);
  const directDecrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, recipientFileKey, ciphertext);
  assert.equal(new TextDecoder().decode(directDecrypted), 'Hello, Whispers Envelope Encryption!');
});




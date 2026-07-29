function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  bytes.forEach((byte) => {
    binary += String.fromCharCode(byte);
  });
  return btoa(binary);
}

function base64ToUint8Array(encoded) {
  const binary = atob(encoded);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

function getExpirationTimestamp(value) {
  if (!value) {
    return null;
  }

  const date = new Date(`${value}T23:59:59`);
  return Math.floor(date.getTime() / 1000);
}

function formatExpiration(entry) {
  if (!entry.expires_at) {
    return 'No expiration date';
  }

  return `Expires ${new Date(entry.expires_at * 1000).toLocaleDateString()}`;
}

function filterFiles(files, query) {
  if (!query || !query.trim()) {
    return files || [];
  }
  const q = query.trim().toLowerCase();
  return (files || []).filter((entry) => {
    const nameMatch = entry.name && entry.name.toLowerCase().includes(q);
    const uploadDate = entry.uploaded_at ? new Date(entry.uploaded_at * 1000) : null;
    const dateStr = uploadDate ? uploadDate.toLocaleDateString().toLowerCase() : '';
    const isoDateStr = uploadDate ? uploadDate.toISOString().toLowerCase() : '';
    const dateMatch = dateStr.includes(q) || isoDateStr.includes(q);
    return nameMatch || dateMatch;
  });
}

function parseShareFragment(hashStr) {
  if (!hashStr) {
    return null;
  }
  const cleanHash = hashStr.startsWith('#') ? hashStr.slice(1) : hashStr;
  if (!cleanHash) {
    return null;
  }
  const params = new URLSearchParams(cleanHash);
  const fileUuid = params.get('file') || params.get('uuid');
  const key = params.get('key');
  const userId = params.get('user') || params.get('user_id');
  const collectionId = params.get('coll') || params.get('collection_id');

  if (fileUuid && key) {
    return { fileUuid, key, userId, collectionId };
  }
  return null;
}

function buildShareUrl(originAndPath, fileUuid, key, userId, collectionId) {
  const params = new URLSearchParams();
  params.set('file', fileUuid);
  params.set('key', key);
  if (userId) {
    params.set('user', userId);
  }
  if (collectionId) {
    params.set('coll', collectionId);
  }
  return `${originAndPath}#${params.toString()}`;
}

function getWebCrypto() {
  if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
    return window.crypto;
  }
  if (typeof globalThis !== 'undefined' && globalThis.crypto && globalThis.crypto.subtle) {
    return globalThis.crypto;
  }
  return require('node:crypto').webcrypto;
}

async function generateAesKey() {
  const c = getWebCrypto();
  return c.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']);
}

async function exportRawKey(key) {
  const c = getWebCrypto();
  const buffer = await c.subtle.exportKey('raw', key);
  return arrayBufferToBase64(buffer);
}

async function importRawKey(base64Key) {
  const c = getWebCrypto();
  const bytes = base64ToUint8Array(base64Key);
  return c.subtle.importKey('raw', bytes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

async function encryptKeyWithParent(childKey, parentKey) {
  const c = getWebCrypto();
  const rawChild = await c.subtle.exportKey('raw', childKey);
  const iv = c.getRandomValues(new Uint8Array(12));
  const cipher = await c.subtle.encrypt({ name: 'AES-GCM', iv }, parentKey, rawChild);
  const payload = new Uint8Array(iv.byteLength + cipher.byteLength);
  payload.set(iv, 0);
  payload.set(new Uint8Array(cipher), iv.byteLength);
  return arrayBufferToBase64(payload.buffer);
}

async function decryptKeyWithParent(encryptedChildBase64, parentKey) {
  const c = getWebCrypto();
  const payload = base64ToUint8Array(encryptedChildBase64);
  const iv = payload.slice(0, 12);
  const cipherText = payload.slice(12);
  const rawChildBuffer = await c.subtle.decrypt({ name: 'AES-GCM', iv }, parentKey, cipherText);
  return c.subtle.importKey('raw', rawChildBuffer, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
}

if (typeof module !== 'undefined') {
  module.exports = {
    arrayBufferToBase64,
    base64ToUint8Array,
    getExpirationTimestamp,
    formatExpiration,
    filterFiles,
    parseShareFragment,
    buildShareUrl,
    generateAesKey,
    exportRawKey,
    importRawKey,
    encryptKeyWithParent,
    decryptKeyWithParent
  };
}

if (typeof window !== 'undefined') {
  window.WhispersClientLogic = {
    arrayBufferToBase64,
    base64ToUint8Array,
    getExpirationTimestamp,
    formatExpiration,
    filterFiles,
    parseShareFragment,
    buildShareUrl,
    generateAesKey,
    exportRawKey,
    importRawKey,
    encryptKeyWithParent,
    decryptKeyWithParent
  };
}




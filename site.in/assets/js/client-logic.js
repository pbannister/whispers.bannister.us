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

if (typeof module !== 'undefined') {
  module.exports = {
    arrayBufferToBase64,
    base64ToUint8Array,
    getExpirationTimestamp,
    formatExpiration
  };
}

if (typeof window !== 'undefined') {
  window.WhispersClientLogic = {
    arrayBufferToBase64,
    base64ToUint8Array,
    getExpirationTimestamp,
    formatExpiration
  };
}

document.addEventListener('DOMContentLoaded', () => {
  const stateEl = document.getElementById('state');
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const uploadResult = document.getElementById('uploadResult');
  const storageList = document.getElementById('storageList');
  const downloadPane = document.getElementById('downloadPane');
  const downloadTitle = document.getElementById('downloadTitle');
  const downloadMeta = document.getElementById('downloadMeta');
  const downloadButton = document.getElementById('downloadButton');

  const keyStorageName = 'whispers.encryptionKey';
  const userStorageName = 'whispers.userId';

  let encryptionKey = null;
  let userId = null;
  let activeFile = null;

  function showMessage(element, message, tone = 'info') {
    element.textContent = message;
    element.style.borderColor = tone === 'error' ? '#ff7f7f' : 'rgba(255,255,255,0.08)';
  }

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

  async function importKey(rawKey) {
    const keyBytes = base64ToUint8Array(rawKey);
    return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, false, ['encrypt', 'decrypt']);
  }

  async function ensureKey() {
    const storedKey = localStorage.getItem(keyStorageName);
    if (storedKey) {
      encryptionKey = await importKey(storedKey);
      return storedKey;
    }

    const generatedKey = crypto.getRandomValues(new Uint8Array(32));
    const exportedKey = await crypto.subtle.exportKey('raw', await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']));
    const encodedKey = arrayBufferToBase64(exportedKey);
    localStorage.setItem(keyStorageName, encodedKey);
    encryptionKey = await importKey(encodedKey);
    return encodedKey;
  }

  async function deriveUserId() {
    const storedUserId = localStorage.getItem(userStorageName);
    if (storedUserId) {
      return storedUserId;
    }

    const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(String(Date.now())));
    const hex = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
    const derived = hex.slice(0, 24);
    localStorage.setItem(userStorageName, derived);
    return derived;
  }

  async function encryptFile(file) {
    const fileBuffer = await file.arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherText = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, encryptionKey, fileBuffer);
    const payload = new Uint8Array(iv.byteLength + cipherText.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(cipherText), iv.byteLength);
    return arrayBufferToBase64(payload.buffer);
  }

  async function decryptPayload(encodedPayload) {
    const payload = base64ToUint8Array(encodedPayload);
    const iv = payload.slice(0, 12);
    const cipherText = payload.slice(12);
    const clearBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, encryptionKey, cipherText);
    return clearBuffer;
  }

  async function refreshFiles() {
    storageList.innerHTML = 'Loading…';
    const response = await fetch('/api/storage.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'list', user_id: userId })
    });

    const payload = await response.json();
    if (!payload.success) {
      storageList.innerHTML = '<em>No files yet.</em>';
      return;
    }

    if (!payload.files.length) {
      storageList.innerHTML = '<em>No files yet.</em>';
      return;
    }

    storageList.innerHTML = '';
    payload.files.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'file-item';
      item.innerHTML = `<span>${entry.name}</span>`;
      const selectButton = document.createElement('button');
      selectButton.type = 'button';
      selectButton.textContent = 'Open';
      selectButton.addEventListener('click', () => {
        activeFile = entry;
        downloadTitle.textContent = entry.name;
        downloadMeta.textContent = `Stored as ${entry.uuid}`;
        downloadPane.classList.remove('hidden');
      });
      item.appendChild(selectButton);
      storageList.appendChild(item);
    });
  }

  async function uploadFile() {
    const file = fileInput.files[0];
    if (!file) {
      showMessage(uploadResult, 'Choose a file first.', 'error');
      return;
    }

    uploadButton.disabled = true;
    uploadButton.textContent = 'Uploading…';
    showMessage(uploadResult, 'Encrypting and uploading…');

    try {
      const encryptedData = await encryptFile(file);
      const response = await fetch('/api/storage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'upload', user_id: userId, file_name: file.name, data: encryptedData })
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Upload failed');
      }

      showMessage(uploadResult, `Uploaded ${file.name} as ${payload.uuid}.`);
      await refreshFiles();
    } catch (error) {
      showMessage(uploadResult, error.message, 'error');
    } finally {
      uploadButton.disabled = false;
      uploadButton.textContent = 'Upload encrypted file';
    }
  }

  async function downloadAndDecrypt() {
    if (!activeFile) {
      showMessage(uploadResult, 'Select a file from the list first.', 'error');
      return;
    }

    try {
      const response = await fetch('/api/storage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', user_id: userId, uuid: activeFile.uuid })
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Download failed');
      }

      const decryptedBuffer = await decryptPayload(payload.data);
      const blob = new Blob([decryptedBuffer]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = payload.name || activeFile.name;
      link.click();
      URL.revokeObjectURL(url);
      showMessage(uploadResult, `Downloaded ${payload.name || activeFile.name}.`);
    } catch (error) {
      showMessage(uploadResult, error.message, 'error');
    }
  }

  async function initialize() {
    try {
      await ensureKey();
      userId = await deriveUserId();
      stateEl.textContent = `Ready. Your browser key is stored locally and your files will be grouped under ${userId}.`;
      uploadButton.addEventListener('click', uploadFile);
      downloadButton.addEventListener('click', downloadAndDecrypt);
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
          showMessage(uploadResult, `${fileInput.files[0].name} is ready to upload.`);
        }
      });
      await refreshFiles();
    } catch (error) {
      stateEl.textContent = `Could not initialize: ${error.message}`;
    }
  }

  initialize();
});

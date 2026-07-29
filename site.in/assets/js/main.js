document.addEventListener('DOMContentLoaded', () => {
  const logic = window.WhispersClientLogic || {};
  const stateEl = document.getElementById('state');
  const fileInput = document.getElementById('fileInput');
  const uploadButton = document.getElementById('uploadButton');
  const uploadResult = document.getElementById('uploadResult');
  const storageList = document.getElementById('storageList');
  const downloadPane = document.getElementById('downloadPane');
  const downloadTitle = document.getElementById('downloadTitle');
  const downloadMeta = document.getElementById('downloadMeta');
  const downloadButton = document.getElementById('downloadButton');
  const keyValue = document.getElementById('keyValue');
  const copyKeyButton = document.getElementById('copyKeyButton');
  const importKeyInput = document.getElementById('importKeyInput');
  const importKeyButton = document.getElementById('importKeyButton');
  const expirationDateInput = document.getElementById('expirationDate');
  const collectionSelect = document.getElementById('collectionSelect');
  const collectionSummary = document.getElementById('collectionSummary');
  const collectionNameInput = document.getElementById('collectionNameInput');
  const collectionDescriptionInput = document.getElementById('collectionDescriptionInput');
  const createCollectionButton = document.getElementById('createCollectionButton');

  const searchInput = document.getElementById('searchInput');
  const viewActiveButton = document.getElementById('viewActiveButton');
  const viewTrashButton = document.getElementById('viewTrashButton');

  const keyStorageName = 'whispers.encryptionKey';
  const userStorageName = 'whispers.userId';
  const collectionStorageName = 'whispers.currentCollection';

  let encryptionKey = null;
  let userId = null;
  let activeFile = null;
  let collections = [];
  let currentCollection = null;
  let loadedFiles = [];
  let viewMode = 'active'; // 'active' or 'trash'

  function showMessage(element, message, tone = 'info') {
    element.textContent = message;
    element.style.borderColor = tone === 'error' ? '#ff7f7f' : 'rgba(255,255,255,0.08)';
  }

  const arrayBufferToBase64 = logic.arrayBufferToBase64 || ((buffer) => {
    const bytes = new Uint8Array(buffer);
    let binary = '';
    bytes.forEach((byte) => {
      binary += String.fromCharCode(byte);
    });
    return btoa(binary);
  });

  const base64ToUint8Array = logic.base64ToUint8Array || ((encoded) => {
    const binary = atob(encoded);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes;
  });

  const getExpirationTimestamp = logic.getExpirationTimestamp || ((value) => {
    if (!value) {
      return null;
    }

    const date = new Date(`${value}T23:59:59`);
    return Math.floor(date.getTime() / 1000);
  });

  const formatExpiration = logic.formatExpiration || ((entry) => {
    if (!entry.expires_at) {
      return 'No expiration date';
    }

    return `Expires ${new Date(entry.expires_at * 1000).toLocaleDateString()}`;
  });

  const parseShareFragment = logic.parseShareFragment || ((hashStr) => {
    if (!hashStr) return null;
    const cleanHash = hashStr.startsWith('#') ? hashStr.slice(1) : hashStr;
    if (!cleanHash) return null;
    const params = new URLSearchParams(cleanHash);
    const fileUuid = params.get('file') || params.get('uuid');
    const key = params.get('key');
    if (fileUuid && key) {
      return { fileUuid, key, userId: params.get('user'), collectionId: params.get('coll') };
    }
    return null;
  });

  const buildShareUrl = logic.buildShareUrl || ((originAndPath, fileUuid, key, userId, collectionId) => {
    const params = new URLSearchParams();
    params.set('file', fileUuid);
    params.set('key', key);
    if (userId) params.set('user', userId);
    if (collectionId) params.set('coll', collectionId);
    return `${originAndPath}#${params.toString()}`;
  });


  const generateAesKey = logic.generateAesKey || (async () => crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']));
  const exportRawKey = logic.exportRawKey || (async (key) => arrayBufferToBase64(await crypto.subtle.exportKey('raw', key)));
  const importRawKey = logic.importRawKey || (async (base64Key) => crypto.subtle.importKey('raw', base64ToUint8Array(base64Key), { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']));

  const encryptKeyWithParent = logic.encryptKeyWithParent || (async (childKey, parentKey) => {
    const rawChild = await crypto.subtle.exportKey('raw', childKey);
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, parentKey, rawChild);
    const payload = new Uint8Array(iv.byteLength + cipher.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(cipher), iv.byteLength);
    return arrayBufferToBase64(payload.buffer);
  });

  const decryptKeyWithParent = logic.decryptKeyWithParent || (async (encryptedChildBase64, parentKey) => {
    const payload = base64ToUint8Array(encryptedChildBase64);
    const iv = payload.slice(0, 12);
    const cipherText = payload.slice(12);
    const rawChildBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, parentKey, cipherText);
    return crypto.subtle.importKey('raw', rawChildBuffer, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  });

  const collectionKeys = {};

  async function getActiveCollectionKey(collection) {
    if (!collection) {
      return encryptionKey;
    }
    if (collectionKeys[collection.uuid]) {
      return collectionKeys[collection.uuid];
    }
    if (collection.encrypted_key) {
      try {
        const key = await decryptKeyWithParent(collection.encrypted_key, encryptionKey);
        collectionKeys[collection.uuid] = key;
        return key;
      } catch (err) {
        // Fallback to Master Key if decryption fails
        return encryptionKey;
      }
    }
    return encryptionKey;
  }

  async function importKey(rawKey) {
    const keyBytes = base64ToUint8Array(rawKey);
    return crypto.subtle.importKey('raw', keyBytes, { name: 'AES-GCM' }, true, ['encrypt', 'decrypt']);
  }

  function updateKeyDisplay(encodedKey) {
    if (keyValue) {
      keyValue.value = encodedKey || '';
    }
  }

  async function storeAndActivateKey(encodedKey) {
    localStorage.setItem(keyStorageName, encodedKey);
    encryptionKey = await importKey(encodedKey);
    updateKeyDisplay(encodedKey);
    return encodedKey;
  }

  async function ensureKey() {
    const storedKey = localStorage.getItem(keyStorageName);
    if (storedKey) {
      encryptionKey = await importKey(storedKey);
      updateKeyDisplay(storedKey);
      return storedKey;
    }

    const exportedKey = await crypto.subtle.exportKey('raw', await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, true, ['encrypt', 'decrypt']));
    const encodedKey = arrayBufferToBase64(exportedKey);
    return storeAndActivateKey(encodedKey);
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

  async function encryptFileWithKey(file, targetKey) {
    const fileBuffer = await file.arrayBuffer();
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const cipherText = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, targetKey, fileBuffer);
    const payload = new Uint8Array(iv.byteLength + cipherText.byteLength);
    payload.set(iv, 0);
    payload.set(new Uint8Array(cipherText), iv.byteLength);
    return arrayBufferToBase64(payload.buffer);
  }

  async function decryptPayloadWithKey(encodedPayload, targetKey) {
    const payload = base64ToUint8Array(encodedPayload);
    const iv = payload.slice(0, 12);
    const cipherText = payload.slice(12);
    const clearBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, targetKey, cipherText);
    return clearBuffer;
  }

  function renderCollections() {
    if (!collectionSelect) {
      return;
    }

    collectionSelect.innerHTML = '';
    collections.forEach((collection) => {
      const option = document.createElement('option');
      option.value = collection.uuid;
      option.textContent = collection.name;
      collectionSelect.appendChild(option);
    });

    if (currentCollection) {
      collectionSelect.value = currentCollection.uuid;
      collectionSummary.textContent = `${currentCollection.name} is the active collection.`;
    }
  }

  async function loadCollections() {
    const response = await fetch('/api/storage.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'listCollections', user_id: userId })
    });

    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Could not load collections');
    }

    collections = payload.collections || [];
    if (!collections.length) {
      return createCollection('Default collection', 'Files you upload first go here.');
    }

    const storedCollectionId = localStorage.getItem(collectionStorageName);
    const fallback = collections.find((collection) => collection.uuid === storedCollectionId) || collections[0];
    currentCollection = fallback;
    renderCollections();
    return fallback;
  }

  async function createCollection(name, description = '') {
    const trimmedName = name.trim();
    if (!trimmedName) {
      showMessage(uploadResult, 'Please enter a collection name.', 'error');
      return null;
    }

    // Envelope encryption: generate Collection Key & encrypt with Master Key
    const collectionKey = await generateAesKey();
    const encryptedCollectionKeyStr = await encryptKeyWithParent(collectionKey, encryptionKey);

    const response = await fetch('/api/storage.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        action: 'createCollection',
        user_id: userId,
        name: trimmedName,
        description,
        encrypted_key: encryptedCollectionKeyStr
      })
    });

    const payload = await response.json();
    if (!payload.success) {
      throw new Error(payload.error || 'Could not create collection');
    }

    collectionKeys[payload.collection.uuid] = collectionKey;
    collections = [...collections, payload.collection];
    currentCollection = payload.collection;
    localStorage.setItem(collectionStorageName, payload.collection.uuid);
    renderCollections();
    showMessage(uploadResult, `Created collection ${payload.collection.name}.`);
    return payload.collection;
  }

  async function selectCollection(collection) {
    currentCollection = collection;
    localStorage.setItem(collectionStorageName, collection.uuid);
    renderCollections();
    await refreshFiles();
  }


  function renderFileList() {
    if (!storageList) {
      return;
    }

    const filtered = filterFiles(loadedFiles, searchInput?.value || '');

    if (!filtered.length) {
      if (searchInput?.value?.trim()) {
        storageList.innerHTML = '<em>No files match your search filter.</em>';
      } else if (viewMode === 'trash') {
        storageList.innerHTML = '<em>Trash is empty.</em>';
      } else {
        storageList.innerHTML = '<em>No files yet in this collection. Upload one to get started.</em>';
      }
      return;
    }

    storageList.innerHTML = '';
    filtered.forEach((entry) => {
      const item = document.createElement('div');
      item.className = 'file-item';

      const details = document.createElement('div');
      details.className = 'file-item-details';

      const name = document.createElement('strong');
      name.textContent = entry.name;
      details.appendChild(name);

      const meta = document.createElement('div');
      meta.className = 'file-item-meta';
      if (viewMode === 'trash') {
        meta.textContent = `Deleted ${new Date((entry.deleted_at || 0) * 1000).toLocaleString()}`;
      } else {
        meta.textContent = `${formatExpiration(entry)} • ${new Date(entry.uploaded_at * 1000).toLocaleString()}`;
      }
      details.appendChild(meta);

      const actions = document.createElement('div');
      actions.className = 'file-item-actions';

      if (viewMode === 'active') {
        const selectButton = document.createElement('button');
        selectButton.type = 'button';
        selectButton.textContent = 'Open';
        selectButton.addEventListener('click', () => {
          activeFile = entry;
          downloadTitle.textContent = entry.name;
          downloadMeta.textContent = `Stored as ${entry.uuid}`;
          downloadPane.classList.remove('hidden');
        });

        const shareLinkButton = document.createElement('button');
        shareLinkButton.type = 'button';
        shareLinkButton.textContent = 'Share link';
        shareLinkButton.addEventListener('click', async () => {
          try {
            const collectionKey = await getActiveCollectionKey(currentCollection);
            let fileKeyStr = '';
            if (entry.encrypted_key) {
              const fileKey = await decryptKeyWithParent(entry.encrypted_key, collectionKey);
              fileKeyStr = await exportRawKey(fileKey);
            } else {
              fileKeyStr = await exportRawKey(collectionKey);
            }
            const shareUrl = buildShareUrl(window.location.origin + window.location.pathname, entry.uuid, fileKeyStr, userId, currentCollection?.uuid || 'default');
            await navigator.clipboard.writeText(shareUrl);
            showMessage(uploadResult, `Direct share link for "${entry.name}" copied to clipboard.`);
          } catch (error) {
            showMessage(uploadResult, 'Failed to copy share link to clipboard.', 'error');
          }
        });


        const deleteButton = document.createElement('button');
        deleteButton.type = 'button';
        deleteButton.textContent = 'Delete';
        deleteButton.addEventListener('click', async () => {
          try {
            const deleteResponse = await fetch('/api/storage.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'delete', user_id: userId, collection_id: currentCollection?.uuid || 'default', uuid: entry.uuid })
            });
            const deletePayload = await deleteResponse.json();
            if (!deletePayload.success) {
              throw new Error(deletePayload.error || 'Delete failed');
            }

            if (activeFile && activeFile.uuid === entry.uuid) {
              activeFile = null;
              downloadPane.classList.add('hidden');
              downloadTitle.textContent = 'Select a file';
              downloadMeta.textContent = 'Choose an entry from the list to decrypt it locally.';
            }

            showMessage(uploadResult, `Moved ${entry.name} to trash.`);
            await refreshFiles();
          } catch (error) {
            showMessage(uploadResult, error.message, 'error');
          }
        });

        actions.appendChild(selectButton);
        actions.appendChild(shareLinkButton);
        actions.appendChild(deleteButton);
      } else {

        // Trash mode: Restore and Delete Permanently
        const restoreButton = document.createElement('button');
        restoreButton.type = 'button';
        restoreButton.textContent = 'Restore';
        restoreButton.addEventListener('click', async () => {
          try {
            const response = await fetch('/api/storage.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'restore', user_id: userId, collection_id: currentCollection?.uuid || 'default', uuid: entry.uuid })
            });
            const payload = await response.json();
            if (!payload.success) {
              throw new Error(payload.error || 'Restore failed');
            }
            showMessage(uploadResult, `Restored ${entry.name}.`);
            await refreshFiles();
          } catch (error) {
            showMessage(uploadResult, error.message, 'error');
          }
        });

        const permDeleteButton = document.createElement('button');
        permDeleteButton.type = 'button';
        permDeleteButton.textContent = 'Delete Permanently';
        permDeleteButton.addEventListener('click', async () => {
          try {
            const response = await fetch('/api/storage.php', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ action: 'deletePermanent', user_id: userId, collection_id: currentCollection?.uuid || 'default', uuid: entry.uuid })
            });
            const payload = await response.json();
            if (!payload.success) {
              throw new Error(payload.error || 'Permanent delete failed');
            }
            showMessage(uploadResult, `Permanently deleted ${entry.name}.`);
            await refreshFiles();
          } catch (error) {
            showMessage(uploadResult, error.message, 'error');
          }
        });

        actions.appendChild(restoreButton);
        actions.appendChild(permDeleteButton);
      }

      item.appendChild(details);
      item.appendChild(actions);
      storageList.appendChild(item);
    });
  }

  async function refreshFiles() {
    if (!storageList) {
      return;
    }

    storageList.innerHTML = 'Loading…';
    const action = viewMode === 'trash' ? 'listTrash' : 'list';
    const response = await fetch('/api/storage.php', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, user_id: userId, collection_id: currentCollection?.uuid || 'default' })
    });

    const payload = await response.json();
    if (!payload.success) {
      storageList.innerHTML = `<em>Error: ${payload.error || 'Failed to load files'}</em>`;
      return;
    }

    loadedFiles = payload.files || [];
    renderFileList();
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
      const collectionKey = await getActiveCollectionKey(currentCollection);
      const fileKey = await generateAesKey();
      const encryptedData = await encryptFileWithKey(file, fileKey);
      const encryptedFileKeyStr = await encryptKeyWithParent(fileKey, collectionKey);

      const response = await fetch('/api/storage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'upload',
          user_id: userId,
          collection_id: currentCollection?.uuid || 'default',
          file_name: file.name,
          data: encryptedData,
          encrypted_key: encryptedFileKeyStr,
          expires_at: getExpirationTimestamp(expirationDateInput?.value || '')
        })
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Upload failed');
      }

      if (expirationDateInput) {
        expirationDateInput.value = '';
      }

      showMessage(uploadResult, `Stored ${file.name}. It is now available for later download and local decryption.`);
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
      const collectionKey = await getActiveCollectionKey(currentCollection);
      const response = await fetch('/api/storage.php', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'download', user_id: userId, collection_id: currentCollection?.uuid || 'default', uuid: activeFile.uuid })
      });
      const payload = await response.json();
      if (!payload.success) {
        throw new Error(payload.error || 'Download failed');
      }

      let decryptedBuffer;
      if (activeFile.encrypted_key) {
        const fileKey = await decryptKeyWithParent(activeFile.encrypted_key, collectionKey);
        decryptedBuffer = await decryptPayloadWithKey(payload.data, fileKey);
      } else {
        decryptedBuffer = await decryptPayloadWithKey(payload.data, collectionKey);
      }

      const blob = new Blob([decryptedBuffer]);
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = payload.name || activeFile.name;
      link.click();
      URL.revokeObjectURL(url);
      showMessage(uploadResult, `Downloaded and decrypted ${payload.name || activeFile.name}. Keep your browser storage intact if you want to access it again later.`);
    } catch (error) {
      showMessage(uploadResult, error.message, 'error');
    }
  }


  async function copyCurrentKey() {
    if (!keyValue || !keyValue.value) {
      showMessage(uploadResult, 'No decryption key is available yet.', 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(keyValue.value);
      showMessage(uploadResult, 'Decryption key copied. Share it only with trusted recipients.');
    } catch (error) {
      showMessage(uploadResult, 'Copy failed. Select and copy the key manually instead.', 'error');
    }
  }

  async function importSharedKey() {
    if (!importKeyInput) {
      return;
    }

    const sharedKey = importKeyInput.value.trim().replace(/\s+/g, '');
    if (!sharedKey) {
      showMessage(uploadResult, 'Paste a decryption key before importing it.', 'error');
      return;
    }

    try {
      await storeAndActivateKey(sharedKey);
      importKeyInput.value = '';
      showMessage(uploadResult, 'Imported a decryption key for this browser. It is stored locally and is not sent to the server.');
    } catch (error) {
      showMessage(uploadResult, 'The shared key could not be imported. Please verify that it was copied correctly.', 'error');
     const sharedFilePane = document.getElementById('sharedFilePane');
  const sharedFileStatus = document.getElementById('sharedFileStatus');

  async function decryptPayloadWithKey(encodedPayload, keyObj) {
    const payload = base64ToUint8Array(encodedPayload);
    const iv = payload.slice(0, 12);
    const cipherText = payload.slice(12);
    const clearBuffer = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, keyObj, cipherText);
    return clearBuffer;
  }

  async function handleSharedFileLink() {
    const parsed = parseShareFragment(window.location.hash);
    if (!parsed || !sharedFilePane) {
      if (sharedFilePane) {
        sharedFilePane.classList.add('hidden');
      }
      return;
    }

    sharedFilePane.classList.remove('hidden');
    if (sharedFileStatus) {
      sharedFileStatus.textContent = `A direct share link for file ${parsed.fileUuid} was detected. Click below to download and decrypt it using the key in the URL fragment.`;
    }

    const downloadSharedBtn = document.getElementById('downloadSharedButton');
    if (downloadSharedBtn) {
      const newBtn = downloadSharedBtn.cloneNode(true);
      downloadSharedBtn.replaceWith(newBtn);
      newBtn.addEventListener('click', async () => {
        newBtn.disabled = true;
        newBtn.textContent = 'Downloading and decrypting…';
        try {
          const response = await fetch('/api/storage.php', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              action: 'downloadShared',
              uuid: parsed.fileUuid,
              user_id: parsed.userId || '',
              collection_id: parsed.collectionId || ''
            })
          });
          const payload = await response.json();
          if (!payload.success) {
            throw new Error(payload.error || 'Failed to download shared file');
          }

          const sharedKeyObj = await importKey(parsed.key);
          const decryptedBuffer = await decryptPayloadWithKey(payload.data, sharedKeyObj);
          const blob = new Blob([decryptedBuffer]);
          const url = URL.createObjectURL(blob);
          const link = document.createElement('a');
          link.href = url;
          link.download = payload.name || 'shared-file.bin';
          link.click();
          URL.revokeObjectURL(url);
          showMessage(uploadResult, `Downloaded and decrypted shared file ${payload.name || parsed.fileUuid}.`);
        } catch (error) {
          showMessage(uploadResult, error.message, 'error');
        } finally {
          newBtn.disabled = false;
          newBtn.textContent = 'Download & Decrypt Shared File';
        }
      });
    }
  }

  async function initialize() {
    try {
      await ensureKey();
      userId = await deriveUserId();
      stateEl.textContent = `No account required. Your browser key is stored locally, and your files will be grouped under ${userId}.`;
      uploadButton.addEventListener('click', uploadFile);
      downloadButton.addEventListener('click', downloadAndDecrypt);
      copyKeyButton?.addEventListener('click', copyCurrentKey);
      importKeyButton?.addEventListener('click', importSharedKey);
      createCollectionButton?.addEventListener('click', async () => {
        await createCollection(collectionNameInput?.value || '', collectionDescriptionInput?.value || '');
        if (collectionNameInput) {
          collectionNameInput.value = '';
        }
        if (collectionDescriptionInput) {
          collectionDescriptionInput.value = '';
        }
      });
      collectionSelect?.addEventListener('change', async (event) => {
        const selected = collections.find((collection) => collection.uuid === event.target.value);
        if (selected) {
          await selectCollection(selected);
        }
      });
      fileInput.addEventListener('change', () => {
        if (fileInput.files.length) {
          showMessage(uploadResult, `${fileInput.files[0].name} is ready to upload.`);
        }
      });
      searchInput?.addEventListener('input', () => {
        renderFileList();
      });
      viewActiveButton?.addEventListener('click', async () => {
        viewMode = 'active';
        viewActiveButton.classList.add('active-tab');
        viewTrashButton?.classList.remove('active-tab');
        await refreshFiles();
      });
      viewTrashButton?.addEventListener('click', async () => {
        viewMode = 'trash';
        viewTrashButton.classList.add('active-tab');
        viewActiveButton?.classList.remove('active-tab');
        await refreshFiles();
      });
      await loadCollections();
      await refreshFiles();
      await handleSharedFileLink();
      window.addEventListener('hashchange', handleSharedFileLink);
    } catch (error) {
      stateEl.textContent = `Could not initialize: ${error.message}`;
    }
  }

  initialize();
});


<?php
header('Content-Type: application/json; charset=utf-8');

$storageRoot = __DIR__ . '/../storage';
if (!is_dir($storageRoot)) {
    mkdir($storageRoot, 0777, true);
}

function ensureUserDirectory($root, $userId) {
    $directory = $root . '/' . $userId;
    if (!is_dir($directory)) {
        mkdir($directory, 0777, true);
    }
    return $directory;
}

function ensureCollectionDirectory($root, $userId, $collectionId) {
    $directory = $root . '/' . $userId . '/collections/' . $collectionId;
    if (!is_dir($directory)) {
        mkdir($directory, 0777, true);
    }
    return $directory;
}

function createUuid() {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
}

function cleanupExpiredFiles($directory) {
    if (!is_dir($directory)) {
        return;
    }

    $now = time();
    $trashMaxAge = 30 * 86400; // 30 days
    foreach (scandir($directory) ?: [] as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }

        if (substr($entry, -10) !== '.meta.json') {
            continue;
        }

        $metaPath = $directory . '/' . $entry;
        $uuid = basename($entry, '.meta.json');
        $meta = json_decode(file_get_contents($metaPath), true);
        if (!is_array($meta)) {
            continue;
        }

        $expiresAt = $meta['expires_at'] ?? null;
        $deletedAt = $meta['deleted_at'] ?? null;
        $shouldDelete = false;

        if (is_numeric($expiresAt) && (int) $expiresAt <= $now) {
            $shouldDelete = true;
        } elseif (is_numeric($deletedAt) && ($now - (int) $deletedAt) >= $trashMaxAge) {
            $shouldDelete = true;
        }

        if ($shouldDelete) {
            $filePath = $directory . '/' . $uuid . '.bin';
            if (is_file($metaPath)) {
                unlink($metaPath);
            }
            if (is_file($filePath)) {
                unlink($filePath);
            }
        }
    }
}

$input = file_get_contents('php://input');
$data = json_decode($input, true);

if (!is_array($data)) {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Invalid JSON body']);
    exit;
}

$action = $data['action'] ?? '';
$userId = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['user_id'] ?? '');

if ($userId === '') {
    http_response_code(400);
    echo json_encode(['success' => false, 'error' => 'Missing user id']);
    exit;
}

$directory = ensureUserDirectory($storageRoot, $userId);

if ($action === 'createCollection') {
    $collectionId = createUuid();
    $collectionName = trim((string) ($data['name'] ?? 'Default collection'));
    $description = trim((string) ($data['description'] ?? ''));
    $encryptedKey = trim((string) ($data['encrypted_key'] ?? ''));
    $collectionPath = ensureCollectionDirectory($storageRoot, $userId, $collectionId);
    $metadataPath = $collectionPath . '/collection.meta.json';

    $metadata = [
        'uuid' => $collectionId,
        'name' => $collectionName !== '' ? $collectionName : 'Default collection',
        'description' => $description,
        'created_at' => time(),
    ];

    if ($encryptedKey !== '') {
        $metadata['encrypted_key'] = $encryptedKey;
    }

    file_put_contents($metadataPath, json_encode($metadata));
    echo json_encode(['success' => true, 'collection' => $metadata]);
    exit;
}

if ($action === 'listCollections') {
    $collections = [];
    $collectionsDirectory = $storageRoot . '/' . $userId . '/collections';
    if (is_dir($collectionsDirectory)) {
        foreach (scandir($collectionsDirectory) as $entry) {
            if ($entry === '.' || $entry === '..') {
                continue;
            }
            $metaPath = $collectionsDirectory . '/' . $entry . '/collection.meta.json';
            if (!is_file($metaPath)) {
                continue;
            }
            $meta = json_decode(file_get_contents($metaPath), true);
            if (is_array($meta)) {
                $collections[] = $meta;
            }
        }
    }

    if (!$collections) {
        $defaultCollection = [
            'uuid' => 'default',
            'name' => 'Default collection',
            'description' => 'Files you upload first go here.',
            'created_at' => time(),
            'encrypted_key' => null, // The default collection uses the master key directly
        ];
        $collections[] = $defaultCollection;
    }

    echo json_encode(['success' => true, 'collections' => $collections]);
    exit;
}

if ($action === 'upload') {
    $base64Data = $data['data'] ?? '';
    $decoded = base64_decode($base64Data, true);
    if ($decoded === false || $decoded === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid encrypted payload']);
        exit;
    }

    $collectionId = trim((string) ($data['collection_id'] ?? 'default'));
    if ($collectionId === '') {
        $collectionId = 'default';
    }

    $collectionDirectory = ensureCollectionDirectory($storageRoot, $userId, $collectionId);
    $uuid = createUuid();
    $filePath = $collectionDirectory . '/' . $uuid . '.bin';
    $metaPath = $collectionDirectory . '/' . $uuid . '.meta.json';

    if (file_put_contents($filePath, $decoded) === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Unable to save file']);
        exit;
    }

    $expiration = $data['expires_at'] ?? null;
    $encryptedKey = $data['encrypted_key'] ?? null;
    $metadata = [
        'uuid' => $uuid,
        'name' => $data['file_name'] ?? 'upload.bin',
        'size' => strlen($decoded),
        'uploaded_at' => time()
    ];
    if ($encryptedKey) {
        $metadata['encrypted_key'] = $encryptedKey;
    }
    if (is_numeric($expiration)) {
        $metadata['expires_at'] = (int) $expiration;
    }
    file_put_contents($metaPath, json_encode($metadata));

    echo json_encode(['success' => true, 'uuid' => $uuid]);
    exit;
}

if ($action === 'list') {
    $collectionId = trim((string) ($data['collection_id'] ?? 'default'));
    if ($collectionId === '') {
        $collectionId = 'default';
    }
    $collectionDirectory = ensureCollectionDirectory($storageRoot, $userId, $collectionId);
    cleanupExpiredFiles($collectionDirectory);

    $files = [];
    foreach (scandir($collectionDirectory) as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        if (substr($entry, -10) === '.meta.json') {
            $metaPath = $collectionDirectory . '/' . $entry;
            $meta = json_decode(file_get_contents($metaPath), true);
            if (is_array($meta) && empty($meta['deleted_at'])) {
                $files[] = [
                    'uuid' => $meta['uuid'] ?? basename($entry, '.meta.json'),
                    'name' => $meta['name'] ?? 'Stored file',
                    'size' => $meta['size'] ?? 0,
                    'uploaded_at' => $meta['uploaded_at'] ?? 0,
                    'expires_at' => $meta['expires_at'] ?? null,
                    'encrypted_key' => $meta['encrypted_key'] ?? null,
                ];
            }
        }
    }

    usort($files, function ($left, $right) {
        return ($right['uploaded_at'] ?? 0) <=> ($left['uploaded_at'] ?? 0);
    });

    echo json_encode(['success' => true, 'files' => $files]);
    exit;
}

if ($action === 'listTrash') {
    $collectionId = trim((string) ($data['collection_id'] ?? 'default'));
    if ($collectionId === '') {
        $collectionId = 'default';
    }
    $collectionDirectory = ensureCollectionDirectory($storageRoot, $userId, $collectionId);
    cleanupExpiredFiles($collectionDirectory);

    $files = [];
    foreach (scandir($collectionDirectory) as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        if (substr($entry, -10) === '.meta.json') {
            $metaPath = $collectionDirectory . '/' . $entry;
            $meta = json_decode(file_get_contents($metaPath), true);
            if (is_array($meta) && !empty($meta['deleted_at'])) {
                $files[] = [
                    'uuid' => $meta['uuid'] ?? basename($entry, '.meta.json'),
                    'name' => $meta['name'] ?? 'Stored file',
                    'size' => $meta['size'] ?? 0,
                    'uploaded_at' => $meta['uploaded_at'] ?? 0,
                    'deleted_at' => $meta['deleted_at'],
                    'expires_at' => $meta['expires_at'] ?? null,
                    'encrypted_key' => $meta['encrypted_key'] ?? null,
                ];
            }
        }
    }

    usort($files, function ($left, $right) {
        return ($right['deleted_at'] ?? 0) <=> ($left['deleted_at'] ?? 0);
    });

    echo json_encode(['success' => true, 'files' => $files]);
    exit;
}

function findFileByUuid($storageRoot, $uuid) {
    if (!preg_match('/^[a-zA-Z0-9_-]+$/', $uuid)) {
        return null;
    }
    try {
        $dirIterator = new RecursiveDirectoryIterator($storageRoot, RecursiveDirectoryIterator::SKIP_DOTS);
        $iterator = new RecursiveIteratorIterator($dirIterator);
        foreach ($iterator as $file) {
            if ($file->getFilename() === $uuid . '.meta.json') {
                $metaPath = $file->getPathname();
                $filePath = dirname($metaPath) . '/' . $uuid . '.bin';
                return [
                    'metaPath' => $metaPath,
                    'filePath' => $filePath,
                    'directory' => dirname($metaPath)
                ];
            }
        }
    } catch (Exception $e) {
        return null;
    }
    return null;
}

if ($action === 'download' || $action === 'downloadShared') {
    $uuid = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['uuid'] ?? '');
    if ($uuid === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing UUID']);
        exit;
    }

    $collectionId = trim((string) ($data['collection_id'] ?? 'default'));
    if ($collectionId === '') {
        $collectionId = 'default';
    }

    $filePath = null;
    $metaPath = null;

    if ($userId !== '') {
        $collectionDirectory = ensureCollectionDirectory($storageRoot, $userId, $collectionId);
        cleanupExpiredFiles($collectionDirectory);
        $candidateFilePath = $collectionDirectory . '/' . $uuid . '.bin';
        $candidateMetaPath = $collectionDirectory . '/' . $uuid . '.meta.json';
        if (is_file($candidateFilePath)) {
            $filePath = $candidateFilePath;
            $metaPath = $candidateMetaPath;
        }
    }

    if (!$filePath) {
        $found = findFileByUuid($storageRoot, $uuid);
        if ($found) {
            cleanupExpiredFiles($found['directory']);
            if (is_file($found['filePath'])) {
                $filePath = $found['filePath'];
                $metaPath = $found['metaPath'];
            }
        }
    }

    if (!$filePath || !is_file($filePath)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'File not found or access revoked']);
        exit;
    }

    $meta = [];
    if (is_file($metaPath)) {
        $meta = json_decode(file_get_contents($metaPath), true) ?: [];
    }

    if (!empty($meta['deleted_at'])) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'File has been deleted by owner']);
        exit;
    }

    $dataPayload = base64_encode(file_get_contents($filePath));

    echo json_encode([
        'success' => true,
        'uuid' => $uuid,
        'name' => $meta['name'] ?? 'download.bin',
        'data' => $dataPayload
    ]);
    exit;
}


if ($action === 'delete') {
    $collectionId = trim((string) ($data['collection_id'] ?? 'default'));
    if ($collectionId === '') {
        $collectionId = 'default';
    }
    $collectionDirectory = ensureCollectionDirectory($storageRoot, $userId, $collectionId);

    $uuid = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['uuid'] ?? '');
    if ($uuid === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing UUID']);
        exit;
    }

    $metaPath = $collectionDirectory . '/' . $uuid . '.meta.json';
    if (is_file($metaPath)) {
        $meta = json_decode(file_get_contents($metaPath), true) ?: [];
        $meta['deleted_at'] = time();
        file_put_contents($metaPath, json_encode($meta));
        echo json_encode(['success' => true, 'soft_deleted' => true]);
        exit;
    }

    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'File not found']);
    exit;
}

if ($action === 'restore') {
    $collectionId = trim((string) ($data['collection_id'] ?? 'default'));
    if ($collectionId === '') {
        $collectionId = 'default';
    }
    $collectionDirectory = ensureCollectionDirectory($storageRoot, $userId, $collectionId);

    $uuid = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['uuid'] ?? '');
    if ($uuid === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing UUID']);
        exit;
    }

    $metaPath = $collectionDirectory . '/' . $uuid . '.meta.json';
    if (!is_file($metaPath)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'File not found']);
        exit;
    }

    $meta = json_decode(file_get_contents($metaPath), true) ?: [];
    unset($meta['deleted_at']);
    file_put_contents($metaPath, json_encode($meta));

    echo json_encode(['success' => true, 'restored' => true]);
    exit;
}

if ($action === 'deletePermanent') {
    $collectionId = trim((string) ($data['collection_id'] ?? 'default'));
    if ($collectionId === '') {
        $collectionId = 'default';
    }
    $collectionDirectory = ensureCollectionDirectory($storageRoot, $userId, $collectionId);

    $uuid = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['uuid'] ?? '');
    if ($uuid === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing UUID']);
        exit;
    }

    $filePath = $collectionDirectory . '/' . $uuid . '.bin';
    $metaPath = $collectionDirectory . '/' . $uuid . '.meta.json';

    $deleted = false;
    if (is_file($filePath)) {
        $deleted = unlink($filePath);
    }
    if (is_file($metaPath)) {
        $deleted = unlink($metaPath) || $deleted;
    }

    if ($deleted) {
        echo json_encode(['success' => true]);
        exit;
    }

    http_response_code(404);
    echo json_encode(['success' => false, 'error' => 'File not found']);
    exit;
}

http_response_code(404);
echo json_encode(['success' => false, 'error' => 'Unknown action']);


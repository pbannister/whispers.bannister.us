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

function createUuid() {
    $data = random_bytes(16);
    $data[6] = chr(ord($data[6]) & 0x0f | 0x40);
    $data[8] = chr(ord($data[8]) & 0x3f | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($data), 4));
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

if ($action === 'upload') {
    $base64Data = $data['data'] ?? '';
    $decoded = base64_decode($base64Data, true);
    if ($decoded === false || $decoded === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Invalid encrypted payload']);
        exit;
    }

    $uuid = createUuid();
    $filePath = $directory . '/' . $uuid . '.bin';
    $metaPath = $directory . '/' . $uuid . '.meta.json';

    if (file_put_contents($filePath, $decoded) === false) {
        http_response_code(500);
        echo json_encode(['success' => false, 'error' => 'Unable to save file']);
        exit;
    }

    $metadata = [
        'uuid' => $uuid,
        'name' => $data['file_name'] ?? 'upload.bin',
        'size' => strlen($decoded),
        'uploaded_at' => time()
    ];
    file_put_contents($metaPath, json_encode($metadata));

    echo json_encode(['success' => true, 'uuid' => $uuid]);
    exit;
}

if ($action === 'list') {
    $files = [];
    foreach (scandir($directory) as $entry) {
        if ($entry === '.' || $entry === '..') {
            continue;
        }
        if (substr($entry, -10) === '.meta.json') {
            $metaPath = $directory . '/' . $entry;
            $meta = json_decode(file_get_contents($metaPath), true);
            if (is_array($meta)) {
                $files[] = [
                    'uuid' => $meta['uuid'] ?? basename($entry, '.meta.json'),
                    'name' => $meta['name'] ?? 'Stored file',
                    'size' => $meta['size'] ?? 0,
                    'uploaded_at' => $meta['uploaded_at'] ?? 0
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

if ($action === 'download') {
    $uuid = preg_replace('/[^a-zA-Z0-9_-]/', '', $data['uuid'] ?? '');
    if ($uuid === '') {
        http_response_code(400);
        echo json_encode(['success' => false, 'error' => 'Missing UUID']);
        exit;
    }

    $filePath = $directory . '/' . $uuid . '.bin';
    $metaPath = $directory . '/' . $uuid . '.meta.json';

    if (!is_file($filePath)) {
        http_response_code(404);
        echo json_encode(['success' => false, 'error' => 'File not found']);
        exit;
    }

    $dataPayload = base64_encode(file_get_contents($filePath));
    $meta = [];
    if (is_file($metaPath)) {
        $meta = json_decode(file_get_contents($metaPath), true) ?: [];
    }

    echo json_encode([
        'success' => true,
        'uuid' => $uuid,
        'name' => $meta['name'] ?? 'download.bin',
        'data' => $dataPayload
    ]);
    exit;
}

http_response_code(404);
echo json_encode(['success' => false, 'error' => 'Unknown action']);

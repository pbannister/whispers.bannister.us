<?php
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    echo json_encode(['status' => 'success', 'message' => 'Data processed']);
    exit;
}

echo json_encode(['status' => 'error', 'message' => 'Invalid method']);
?>

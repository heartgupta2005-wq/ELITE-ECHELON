<?php
// api/get_remarks.php
require 'db.php';
header('Content-Type: application/json');

$complaint_id = $_GET['complaint_id'] ?? '';
if (!$complaint_id) {
    echo json_encode(["status" => "error", "message" => "complaint_id is required."]);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT * FROM remarks WHERE complaint_id = ? ORDER BY created_at ASC");
    $stmt->execute([$complaint_id]);
    echo json_encode(["status" => "success", "data" => $stmt->fetchAll()]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
<?php
// api/add_remark.php — Government users add internal remarks
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true) ?? $_POST;
$complaint_id = trim($data['complaint_id'] ?? '');
$user_id = (int) ($data['user_id'] ?? 0);
$user_name = trim($data['user_name'] ?? 'Officer');
$remark = trim($data['remark'] ?? '');
$role = trim($data['role'] ?? '');

if ($role !== 'government') {
    echo json_encode(["status" => "error", "message" => "Access denied. Government users only."]);
    exit;
}
if (!$complaint_id || !$user_id || empty($remark)) {
    echo json_encode(["status" => "error", "message" => "complaint_id, user_id, and remark are required."]);
    exit;
}

try {
    $pdo->prepare("INSERT INTO remarks (complaint_id, user_id, user_name, remark) VALUES (?, ?, ?, ?)")
        ->execute([$complaint_id, $user_id, $user_name, $remark]);

    logTimeline($pdo, $complaint_id, 'Remark Added', "Internal remark by {$user_name}: " . substr($remark, 0, 100));

    echo json_encode(["status" => "success", "message" => "Remark added."]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
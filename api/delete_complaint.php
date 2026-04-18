<?php
// api/delete_complaint.php - Admin only endpoint to delete a complaint completely
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true);
$complaint_id = $data['id'] ?? null;
$is_admin = $data['is_admin'] ?? 0;

if (!$complaint_id || $is_admin != 1) {
    echo json_encode(["status" => "error", "message" => "Missing parameters or unauthorized."]);
    exit;
}

try {
    // Delete cascading dependencies first due to lack of FK ON DELETE CASCADE setup perhaps?
    // Timeline logs
    $pdo->prepare("DELETE FROM timeline_logs WHERE complaint_id = ?")->execute([$complaint_id]);
    // Remarks
    $pdo->prepare("DELETE FROM remarks WHERE complaint_id = ?")->execute([$complaint_id]);

    // Notifications and others if they exist, but we only have timeline and remarks
    $stmt = $pdo->prepare("DELETE FROM complaints WHERE id = ?");
    if ($stmt->execute([$complaint_id])) {
        echo json_encode(["status" => "success", "message" => "Complaint deleted successfully."]);
    } else {
        echo json_encode(["status" => "error", "message" => "Failed to delete complaint."]);
    }
} catch (Exception $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
<?php
// api/update_status.php
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "Invalid request method. Use POST."]);
    exit;
}

// Get JSON or Form Data
$data = json_decode(file_get_contents("php://input"), true) ?? $_POST;

$id = $data['id'] ?? null;
$new_status = $data['status'] ?? null;
$message = $data['message'] ?? 'Status updated to ' . $new_status;

if (!$id || !$new_status) {
    echo json_encode(["status" => "error", "message" => "Complaint ID and new status are required."]);
    exit;
}

$allowedStatuses = ['Pending', 'In Progress', 'Resolved', 'Escalated L1', 'Escalated L2'];
if (!in_array($new_status, $allowedStatuses)) {
    echo json_encode(["status" => "error", "message" => "Invalid status provided."]);
    exit;
}

try {
    $pdo->beginTransaction();

    // Check if complaint exists
    $stmt = $pdo->prepare("SELECT id FROM complaints WHERE id = ? FOR UPDATE");
    $stmt->execute([$id]);
    if (!$stmt->fetch()) {
        $pdo->rollBack();
        echo json_encode(["status" => "error", "message" => "Complaint not found."]);
        exit;
    }

    // Update status
    $updateStmt = $pdo->prepare("UPDATE complaints SET status = ? WHERE id = ?");
    $updateStmt->execute([$new_status, $id]);

    // Log to timeline
    logTimeline($pdo, $id, 'Status Change', $message);

    $pdo->commit();

    echo json_encode(["status" => "success", "message" => "Status updated successfully."]);
} catch (\PDOException $e) {
    $pdo->rollBack();
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>

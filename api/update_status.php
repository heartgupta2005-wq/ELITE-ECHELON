<?php
// api/update_status.php — Role-aware: officers can only update their dept's complaints
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true) ?? $_POST;
$id = trim($data['id'] ?? '');
$new_status = trim($data['status'] ?? '');
$user_id = (int) ($data['user_id'] ?? 0);
$is_admin = (int) ($data['is_admin'] ?? 0);
$dept_id = (int) ($data['department_id'] ?? 0);
$message = trim($data['message'] ?? 'Status updated to ' . $new_status);

if (!$id || !$new_status) {
    echo json_encode(["status" => "error", "message" => "Complaint ID and status are required."]);
    exit;
}

$allowed = ['Pending', 'In Progress', 'Resolved', 'Escalated L1', 'Escalated L2'];
if (!in_array($new_status, $allowed)) {
    echo json_encode(["status" => "error", "message" => "Invalid status."]);
    exit;
}

try {
    $pdo->beginTransaction();

    // Fetch complaint
    $stmt = $pdo->prepare("SELECT id, department_id FROM complaints WHERE id = ? FOR UPDATE");
    $stmt->execute([$id]);
    $complaint = $stmt->fetch();
    if (!$complaint) {
        $pdo->rollBack();
        echo json_encode(["status" => "error", "message" => "Complaint not found."]);
        exit;
    }

    // Officers can only update complaints in their department
    if (!$is_admin && $dept_id && (int) $complaint['department_id'] !== $dept_id) {
        $pdo->rollBack();
        echo json_encode(["status" => "error", "message" => "Access denied: complaint is not in your department."]);
        exit;
    }

    $pdo->prepare("UPDATE complaints SET status = ? WHERE id = ?")->execute([$new_status, $id]);
    logTimeline($pdo, $id, 'Status Change', $message);

    // --- Threshold Check & Automated Alert ---
    require_once 'alert_system.php';
    checkDepartmentAlert($pdo, $complaint['department_id']);

    $pdo->commit();
    echo json_encode(["status" => "success", "message" => "Status updated successfully."]);
} catch (\PDOException $e) {
    $pdo->rollBack();
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>
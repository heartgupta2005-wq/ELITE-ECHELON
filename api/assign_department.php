<?php
// api/assign_department.php — Admin only
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true) ?? $_POST;
$complaint_id = trim($data['complaint_id'] ?? '');
$department_id = (int) ($data['department_id'] ?? 0);
$is_admin = (int) ($data['is_admin'] ?? 0);
$assigner_name = trim($data['assigner_name'] ?? 'Admin');

if (!$is_admin) {
    echo json_encode(["status" => "error", "message" => "Access denied. Admin only."]);
    exit;
}
if (!$complaint_id || !$department_id) {
    echo json_encode(["status" => "error", "message" => "complaint_id and department_id are required."]);
    exit;
}

try {
    // Verify complaint exists
    $c = $pdo->prepare("SELECT id FROM complaints WHERE id = ?");
    $c->execute([$complaint_id]);
    if (!$c->fetch()) {
        echo json_encode(["status" => "error", "message" => "Complaint not found."]);
        exit;
    }

    // Verify department exists, get name
    $d = $pdo->prepare("SELECT name FROM departments WHERE id = ?");
    $d->execute([$department_id]);
    $dept = $d->fetch();
    if (!$dept) {
        echo json_encode(["status" => "error", "message" => "Department not found."]);
        exit;
    }

    $pdo->prepare("UPDATE complaints SET department_id = ? WHERE id = ?")->execute([$department_id, $complaint_id]);
    logTimeline($pdo, $complaint_id, 'Assigned', "Complaint assigned to '{$dept['name']}' department by $assigner_name.");

    echo json_encode(["status" => "success", "message" => "Department assigned successfully."]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
<?php
// api/add_department.php — Admin CRUD for departments
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true) ?? $_POST;
$action = trim($data['action'] ?? '');   // 'add' | 'edit' | 'delete'
$is_admin = (int) ($data['is_admin'] ?? 0);
$name = trim($data['name'] ?? '');
$desc = trim($data['description'] ?? '');
$dept_id = (int) ($data['id'] ?? 0);

$alert_email = trim($data['alert_email'] ?? '');
$threshold = (int) ($data['complaint_threshold'] ?? 10);

if (!$is_admin) {
    echo json_encode(["status" => "error", "message" => "Access denied. Admin only."]);
    exit;
}

try {
    if ($action === 'add') {
        if (empty($name)) {
            echo json_encode(["status" => "error", "message" => "Department name is required."]);
            exit;
        }
        $pdo->prepare("INSERT INTO departments (name, description, alert_email, complaint_threshold) VALUES (?, ?, ?, ?)")->execute([$name, $desc, $alert_email, $threshold]);
        echo json_encode(["status" => "success", "message" => "Department added.", "id" => $pdo->lastInsertId()]);

    } elseif ($action === 'edit') {
        if (!$dept_id || empty($name)) {
            echo json_encode(["status" => "error", "message" => "ID and name are required for edit."]);
            exit;
        }
        $pdo->prepare("UPDATE departments SET name = ?, description = ?, alert_email = ?, complaint_threshold = ? WHERE id = ?")->execute([$name, $desc, $alert_email, $threshold, $dept_id]);
        echo json_encode(["status" => "success", "message" => "Department updated."]);

    } elseif ($action === 'delete') {
        if (!$dept_id) {
            echo json_encode(["status" => "error", "message" => "Department ID required for delete."]);
            exit;
        }
        // Unassign complaints from this dept first
        $pdo->prepare("UPDATE complaints SET department_id = NULL WHERE department_id = ?")->execute([$dept_id]);
        $pdo->prepare("DELETE FROM departments WHERE id = ?")->execute([$dept_id]);
        echo json_encode(["status" => "success", "message" => "Department deleted."]);

    } else {
        echo json_encode(["status" => "error", "message" => "Invalid action. Use: add, edit, delete."]);
    }
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
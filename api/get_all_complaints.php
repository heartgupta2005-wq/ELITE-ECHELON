<?php
// api/get_all_complaints.php
// Admin: returns all complaints. Officer: returns only their department's complaints.
require 'db.php';
require 'escalation_engine.php';
require 'auto_confirm.php';

// Trigger automatic escalation and auto-confirm checks
checkEscalations($pdo);
checkAutoConfirm($pdo);

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$is_admin = (int) ($_GET['is_admin'] ?? 0);
$dept_id = isset($_GET['department_id']) && $_GET['department_id'] !== '' ? (int) $_GET['department_id'] : null;

// Filters
$status = $_GET['status'] ?? null;
$category = $_GET['category'] ?? null;
$search = $_GET['search'] ?? null;
$date_from = $_GET['date_from'] ?? null;
$date_to = $_GET['date_to'] ?? null;
$filter_dept = isset($_GET['filter_dept']) && $_GET['filter_dept'] !== '' ? (int) $_GET['filter_dept'] : null;

$query = "
    SELECT c.*,
           d.name  AS department_name,
           u.name  AS user_name,
           u.email AS user_email,
           u.phone AS user_phone
    FROM complaints c
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN users u ON c.user_id = u.id
";

$params = [];
$conditions = [];

// Officers are scoped to their department only
if (!$is_admin && $dept_id) {
    $conditions[] = "c.department_id = ?";
    $params[] = $dept_id;
}

if ($status) {
    $conditions[] = "c.status = ?";
    $params[] = $status;
}
if ($category) {
    $conditions[] = "c.category = ?";
    $params[] = $category;
}
if ($search) {
    $conditions[] = "c.id LIKE ?";
    $params[] = "%{$search}%";
}
if ($date_from) {
    $conditions[] = "DATE(c.created_at) >= ?";
    $params[] = $date_from;
}
if ($date_to) {
    $conditions[] = "DATE(c.created_at) <= ?";
    $params[] = $date_to;
}
if ($filter_dept) {
    $conditions[] = "c.department_id = ?";
    $params[] = $filter_dept;
}

if (!empty($conditions)) {
    $query .= " WHERE " . implode(' AND ', $conditions);
}
$query .= " ORDER BY c.escalation_level DESC, c.created_at DESC LIMIT 200";

try {
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $complaints = $stmt->fetchAll();
    echo json_encode(["status" => "success", "data" => $complaints]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
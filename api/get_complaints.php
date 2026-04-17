<?php
// api/get_complaints.php
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$status = $_GET['status'] ?? null;
$department_id = $_GET['department_id'] ?? null;

$query = "
    SELECT c.*, d.name as department_name 
    FROM complaints c
    LEFT JOIN departments d ON c.department_id = d.id
";
$params = [];
$conditions = [];

if ($status) {
    $conditions[] = "c.status = ?";
    $params[] = $status;
}

if ($department_id) {
    $conditions[] = "c.department_id = ?";
    $params[] = $department_id;
}

if (!empty($conditions)) {
    $query .= " WHERE " . implode(' AND ', $conditions);
}

$query .= " ORDER BY c.created_at DESC";

try {
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $complaints = $stmt->fetchAll();
    
    echo json_encode(["status" => "success", "data" => $complaints]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>

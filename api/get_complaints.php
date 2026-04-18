<?php
// api/get_complaints.php - Enhanced with filters, user name join, category
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$status      = $_GET['status']        ?? null;
$category    = $_GET['category']      ?? null;
$dept_id     = $_GET['department_id'] ?? null;
$search      = $_GET['search']        ?? null;
$date_from   = $_GET['date_from']     ?? null;
$date_to     = $_GET['date_to']       ?? null;

$query = "
    SELECT c.*, 
           d.name as department_name,
           u.name as user_name
    FROM complaints c
    LEFT JOIN departments d ON c.department_id = d.id
    LEFT JOIN users u ON c.user_id = u.id
";

$params = [];
$conditions = [];

if ($status)    { $conditions[] = "c.status = ?";        $params[] = $status; }
if ($category)  { $conditions[] = "c.category = ?";      $params[] = $category; }
if ($dept_id)   { $conditions[] = "c.department_id = ?"; $params[] = $dept_id; }
if ($search)    { $conditions[] = "c.id LIKE ?";          $params[] = "%{$search}%"; }
if ($date_from) { $conditions[] = "DATE(c.created_at) >= ?"; $params[] = $date_from; }
if ($date_to)   { $conditions[] = "DATE(c.created_at) <= ?"; $params[] = $date_to; }

if (!empty($conditions)) {
    $query .= " WHERE " . implode(' AND ', $conditions);
}

$query .= " ORDER BY c.created_at DESC LIMIT 100";

try {
    $stmt = $pdo->prepare($query);
    $stmt->execute($params);
    $complaints = $stmt->fetchAll();
    echo json_encode(["status" => "success", "data" => $complaints]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>

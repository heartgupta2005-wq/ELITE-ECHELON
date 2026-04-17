<?php
// api/get_user_complaints.php
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$user_id = $_GET['user_id'] ?? null;

if (!$user_id) {
    echo json_encode(["status" => "error", "message" => "User ID is required."]);
    exit;
}

try {
    $stmt = $pdo->prepare("
        SELECT c.*, d.name as department_name 
        FROM complaints c
        LEFT JOIN departments d ON c.department_id = d.id
        WHERE c.user_id = ?
        ORDER BY c.created_at DESC
    ");
    $stmt->execute([$user_id]);
    $complaints = $stmt->fetchAll();

    echo json_encode(["status" => "success", "data" => $complaints]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>

<?php
// api/get_map_complaints.php
require 'db.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("
        SELECT c.id, c.description, c.status, c.category, c.lat, c.lng,
               c.created_at, c.sla_deadline, c.image_url,
               d.name as department_name,
               u.name as user_name
        FROM complaints c
        LEFT JOIN departments d ON c.department_id = d.id
        LEFT JOIN users u ON c.user_id = u.id
        WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL
        ORDER BY c.created_at DESC
        LIMIT 200
    ");
    $complaints = $stmt->fetchAll();
    echo json_encode(["status" => "success", "data" => $complaints]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>

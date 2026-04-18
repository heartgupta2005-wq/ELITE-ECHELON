<?php
// api/get_departments.php — Public list, used by filters and assignment dropdowns
require 'db.php';
header('Content-Type: application/json');

try {
    $sql = "
        SELECT d.*, 
               (SELECT COUNT(*) FROM complaints WHERE department_id = d.id AND status IN ('Pending', 'In Progress')) AS active_count
        FROM departments d
        ORDER BY d.name ASC
    ";
    $stmt = $pdo->query($sql);
    $departments = $stmt->fetchAll();
    echo json_encode(["status" => "success", "data" => $departments]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
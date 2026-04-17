<?php
// api/get_departments.php — Public list, used by filters and assignment dropdowns
require 'db.php';
header('Content-Type: application/json');

try {
    $stmt = $pdo->query("SELECT id, name, description, total_resolved, total_sla_breached, reputation_score FROM departments ORDER BY name ASC");
    $departments = $stmt->fetchAll();
    echo json_encode(["status" => "success", "data" => $departments]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
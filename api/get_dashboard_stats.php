<?php
// api/get_dashboard_stats.php — Scoped by department_id for officers
require 'db.php';
header('Content-Type: application/json');

$dept_id = isset($_GET['department_id']) && $_GET['department_id'] !== '' ? (int) $_GET['department_id'] : null;

$where = $dept_id ? "WHERE department_id = $dept_id" : '';
$wAnd = $dept_id ? "AND department_id = $dept_id" : '';

try {
    $stats = [];
    $stats['total'] = (int) $pdo->query("SELECT COUNT(*) FROM complaints $where")->fetchColumn();
    $stats['pending'] = (int) $pdo->query("SELECT COUNT(*) FROM complaints WHERE status='Pending' $wAnd")->fetchColumn();
    $stats['in_progress'] = (int) $pdo->query("SELECT COUNT(*) FROM complaints WHERE status='In Progress' $wAnd")->fetchColumn();
    $stats['resolved'] = (int) $pdo->query("SELECT COUNT(*) FROM complaints WHERE status='Resolved' $wAnd")->fetchColumn();
    $stats['escalated'] = (int) $pdo->query("SELECT COUNT(*) FROM complaints WHERE status IN ('Escalated L1','Escalated L2') $wAnd")->fetchColumn();
    $stats['sla_breached'] = (int) $pdo->query("SELECT COUNT(*) FROM complaints WHERE sla_deadline IS NOT NULL AND sla_deadline < NOW() AND status NOT IN ('Resolved') $wAnd")->fetchColumn();

    echo json_encode(["status" => "success", "data" => $stats]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
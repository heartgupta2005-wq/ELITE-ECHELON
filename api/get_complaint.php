<?php
// api/get_complaint.php
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'GET') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$id = $_GET['id'] ?? null;

if (!$id) {
    echo json_encode(["status" => "error", "message" => "Complaint ID is required."]);
    exit;
}

try {
    // Get complaint details
    $stmt = $pdo->prepare("
        SELECT c.*, d.name as department_name 
        FROM complaints c
        LEFT JOIN departments d ON c.department_id = d.id
        WHERE c.id = ?
    ");
    $stmt->execute([$id]);
    $complaint = $stmt->fetch();

    if (!$complaint) {
        echo json_encode(["status" => "error", "message" => "Complaint not found."]);
        exit;
    }

    // Get timeline logs
    $logStmt = $pdo->prepare("
        SELECT * FROM timeline_logs 
        WHERE complaint_id = ? 
        ORDER BY created_at ASC
    ");
    $logStmt->execute([$id]);
    $timeline = $logStmt->fetchAll();

    echo json_encode([
        "status" => "success",
        "data" => [
            "complaint" => $complaint,
            "timeline" => $timeline
        ]
    ]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>

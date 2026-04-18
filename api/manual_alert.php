<?php
// api/manual_alert.php
// Manually trigger a department alert email (not restricted by cooldown/threshold)

require 'db.php';
require 'email_helper.php';

header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true) ?? $_POST;
$dept_id = (int) ($data['department_id'] ?? 0);
$is_admin = (int) ($data['is_admin'] ?? 0);

if (!$is_admin) {
    echo json_encode(["status" => "error", "message" => "Access denied. Admin only."]);
    exit;
}

if (!$dept_id) {
    echo json_encode(["status" => "error", "message" => "Department ID required."]);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT name, alert_email, complaint_threshold FROM departments WHERE id = ?");
    $stmt->execute([$dept_id]);
    $dept = $stmt->fetch();

    if (!$dept || !$dept['alert_email']) {
        echo json_encode(["status" => "error", "message" => "Department not found or has no alert email configured."]);
        exit;
    }

    // Count active complaints for the body
    $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM complaints WHERE department_id = ? AND status IN ('Pending', 'In Progress')");
    $stmtCount->execute([$dept_id]);
    $count = (int) $stmtCount->fetchColumn();

    $subject = "Manual Priority Alert: {$dept['name']}";
    $body = "
    <div style='font-family: sans-serif; padding: 20px; border: 1px solid #4F46E5; border-radius: 12px; max-width: 600px;'>
        <h2 style='color: #4F46E5;'>🔵 Manual Priority Notification</h2>
        <p>This is a manual alert triggered by the System Administrator.</p>
        <hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;'>
        <p><strong>Department:</strong> {$dept['name']}</p>
        <p><strong>Active Complaints:</strong> {$count}</p>
        <p style='margin-top: 20px; background: #e0e7ff; padding: 15px; border-radius: 8px; color: #3730a3;'>
            The System Administrator has flagged this department for immediate attention. Please review the pending queue.
        </p>
        <p style='margin-top: 20px; font-size: 0.875rem; color: #64748b;'>
            Government Portal: <a href='http://localhost/civic/gov.html'>Login Here</a>
        </p>
    </div>
    ";

    if (sendCivicEmail($dept['alert_email'], $subject, $body)) {
        // Update last_alert_sent
        $pdo->prepare("UPDATE departments SET last_alert_sent = NOW() WHERE id = ?")->execute([$dept_id]);
        echo json_encode(["status" => "success", "message" => "Alert email sent to " . $dept['alert_email']]);
    } else {
        echo json_encode(["status" => "error", "message" => "Failed to send email. Check SMTP settings."]);
    }

} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
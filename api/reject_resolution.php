<?php
// api/reject_resolution.php
// Public user rejects the government's resolution → status: Reopened + escalation bump
require_once 'db.php';
require_once 'email_helper.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'POST required.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$complaint_id = trim($data['complaint_id'] ?? '');
$user_id = (int) ($data['user_id'] ?? 0);
$reason = trim($data['reason'] ?? 'User reported that the issue is still unresolved.');

if (!$complaint_id || !$user_id) {
    echo json_encode(['status' => 'error', 'message' => 'Missing complaint_id or user_id.']);
    exit;
}

try {
    // Fetch complaint + department info
    $cStmt = $pdo->prepare("SELECT c.*, d.alert_email AS dept_email, d.name AS dept_name FROM complaints c LEFT JOIN departments d ON c.department_id = d.id WHERE c.id = ?");
    $cStmt->execute([$complaint_id]);
    $complaint = $cStmt->fetch();

    if (!$complaint) {
        echo json_encode(['status' => 'error', 'message' => 'Complaint not found.']);
        exit;
    }
    if ((int) $complaint['user_id'] !== $user_id) {
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized: You can only reject your own complaints.']);
        exit;
    }
    if ($complaint['status'] !== 'Awaiting User Confirmation') {
        echo json_encode(['status' => 'error', 'message' => "Complaint is not awaiting confirmation."]);
        exit;
    }

    // Bump escalation level (max 3)
    $newEscalation = min(3, (int) ($complaint['escalation_level'] ?? 1) + 1);

    $pdo->beginTransaction();

    $upd = $pdo->prepare("UPDATE complaints SET govt_resolved=0, user_confirmed=0, resolved_at=NULL, status='Reopened', escalation_level=?, last_escalation_time=NOW() WHERE id=?");
    $upd->execute([$newEscalation, $complaint_id]);

    logTimeline($pdo, $complaint_id, 'User Rejected', "Public user rejected the resolution. Reason: {$reason}. Escalation level bumped to {$newEscalation}.");

    // Log escalation bump
    $escLog = $pdo->prepare("INSERT INTO escalation_logs (complaint_id, from_level, to_level) VALUES (?, ?, ?)");
    $escLog->execute([$complaint_id, $complaint['escalation_level'], $newEscalation]);

    $pdo->commit();

    // Notify department email
    if (!empty($complaint['dept_email'])) {
        $subject = "🔴 Complaint #{$complaint_id} REOPENED by User";
        $body = "
        <div style='font-family:sans-serif; padding:20px; max-width:600px; border:1px solid #e2e8f0; border-radius:12px;'>
            <h2 style='color:#ef4444;'>Complaint Reopened</h2>
            <p>The complainant has <strong>rejected your resolution</strong> for complaint <strong>#{$complaint_id}</strong>.</p>
            <hr style='border:0;border-top:1px solid #e2e8f0;margin:16px 0;'>
            <p><strong>Category:</strong> {$complaint['category']}</p>
            <p><strong>Issue:</strong> {$complaint['description']}</p>
            <p><strong>User's Reason:</strong> {$reason}</p>
            <p><strong>New Escalation Level:</strong> {$newEscalation}</p>
            <hr style='border:0;border-top:1px solid #e2e8f0;margin:16px 0;'>
            <p style='background:#fee2e2;padding:12px;border-radius:8px;color:#991b1b;'>
                <strong>Immediate Action Required:</strong> Please investigate and re-resolve this complaint as soon as possible.
            </p>
            <p style='font-size:0.8rem;color:#64748b;'>
                <a href='http://localhost/civic/gov.html'>Log in to Government Portal →</a>
            </p>
        </div>";
        sendCivicEmail($complaint['dept_email'], $subject, $body);
    }

    echo json_encode(['status' => 'success', 'message' => 'Complaint reopened. We will investigate again.']);
} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
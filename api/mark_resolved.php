<?php
// api/mark_resolved.php
// Government marks a complaint as resolved — triggers "Awaiting User Confirmation" state.
require_once 'db.php';
require_once 'email_helper.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'POST required.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$complaint_id = trim($data['complaint_id'] ?? '');
$govt_user_id = $data['govt_user_id'] ?? null;
$remark = trim($data['remark'] ?? 'Government has marked this complaint as resolved.');

if (!$complaint_id || !$govt_user_id) {
    echo json_encode(['status' => 'error', 'message' => 'Missing complaint_id or govt_user_id.']);
    exit;
}

try {
    // Verify the user is a government user
    $userStmt = $pdo->prepare("SELECT id, role FROM users WHERE id = ? AND role = 'government'");
    $userStmt->execute([$govt_user_id]);
    $govtUser = $userStmt->fetch();
    if (!$govtUser) {
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized: Government access required.']);
        exit;
    }

    // Fetch the complaint
    $cStmt = $pdo->prepare("SELECT c.*, u.email AS user_email, u.name AS user_name FROM complaints c LEFT JOIN users u ON c.user_id = u.id WHERE c.id = ?");
    $cStmt->execute([$complaint_id]);
    $complaint = $cStmt->fetch();
    if (!$complaint) {
        echo json_encode(['status' => 'error', 'message' => 'Complaint not found.']);
        exit;
    }

    if ($complaint['status'] === 'Completed') {
        echo json_encode(['status' => 'error', 'message' => 'Complaint is already completed.']);
        exit;
    }

    // Mark as "Awaiting User Confirmation"
    $pdo->beginTransaction();
    $upd = $pdo->prepare("UPDATE complaints SET govt_resolved=1, status='Awaiting User Confirmation', resolved_at=NOW() WHERE id=?");
    $upd->execute([$complaint_id]);

    // Log to timeline
    logTimeline($pdo, $complaint_id, 'Govt Resolved', "Government marked complaint as resolved. " . $remark);

    $pdo->commit();

    // Email complainant (if they have email)
    if (!empty($complaint['user_email'])) {
        $subject = "✅ Your Complaint #{$complaint_id} Has Been Marked Resolved";
        $body = "
        <div style='font-family:sans-serif; padding:20px; max-width:600px; border:1px solid #e2e8f0; border-radius:12px;'>
            <h2 style='color:#10b981;'>Your Complaint Has Been Addressed</h2>
            <p>Dear {$complaint['user_name']},</p>
            <p>The government has marked your complaint <strong>#{$complaint_id}</strong> as resolved.</p>
            <hr style='border:0;border-top:1px solid #e2e8f0;margin:16px 0;'>
            <p><strong>Issue:</strong> {$complaint['description']}</p>
            <p><strong>Remark:</strong> {$remark}</p>
            <hr style='border:0;border-top:1px solid #e2e8f0;margin:16px 0;'>
            <p style='background:#f0fdf4; padding:12px; border-radius:8px; color:#065f46;'>
                <strong>Action Required:</strong> Please log in to confirm if your issue has been resolved, or reject if it hasn't.
                You have <strong>48 hours</strong> to respond — otherwise it will be auto-completed.
            </p>
            <p style='font-size:0.8rem;color:#64748b;margin-top:16px;'>
                <a href='http://localhost/civic/index.html'>Visit Civic Engine →</a>
            </p>
        </div>";
        sendCivicEmail($complaint['user_email'], $subject, $body);
    }

    echo json_encode(['status' => 'success', 'message' => 'Complaint marked as awaiting user confirmation.']);
} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
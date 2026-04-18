<?php
// api/confirm_resolution.php
// Public user confirms that their complaint has been resolved → status: Completed
require_once 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(['status' => 'error', 'message' => 'POST required.']);
    exit;
}

$data = json_decode(file_get_contents('php://input'), true);
$complaint_id = trim($data['complaint_id'] ?? '');
$user_id = (int) ($data['user_id'] ?? 0);

if (!$complaint_id || !$user_id) {
    echo json_encode(['status' => 'error', 'message' => 'Missing complaint_id or user_id.']);
    exit;
}

try {
    // Fetch complaint and validate ownership
    $cStmt = $pdo->prepare("SELECT * FROM complaints WHERE id = ?");
    $cStmt->execute([$complaint_id]);
    $complaint = $cStmt->fetch();

    if (!$complaint) {
        echo json_encode(['status' => 'error', 'message' => 'Complaint not found.']);
        exit;
    }
    if ((int) $complaint['user_id'] !== $user_id) {
        echo json_encode(['status' => 'error', 'message' => 'Unauthorized: You can only confirm your own complaints.']);
        exit;
    }
    if ($complaint['status'] !== 'Awaiting User Confirmation') {
        echo json_encode(['status' => 'error', 'message' => "Complaint is not awaiting confirmation (current: {$complaint['status']})."]);
        exit;
    }

    $pdo->beginTransaction();

    $upd = $pdo->prepare("UPDATE complaints SET user_confirmed=1, confirmed_at=NOW(), status='Completed' WHERE id=?");
    $upd->execute([$complaint_id]);

    logTimeline($pdo, $complaint_id, 'User Confirmed', 'Public user confirmed that the issue has been resolved. Status set to Completed.');

    $pdo->commit();

    echo json_encode(['status' => 'success', 'message' => 'Thank you for confirming. Complaint is now marked as Completed!']);
} catch (Exception $e) {
    if ($pdo->inTransaction())
        $pdo->rollBack();
    echo json_encode(['status' => 'error', 'message' => $e->getMessage()]);
}
?>
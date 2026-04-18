<?php
// api/auto_confirm.php
// Auto-confirm engine: if user does not respond within 48h, auto-complete the complaint.
// This is called from get_all_complaints.php on every dashboard load.

function checkAutoConfirm($pdo)
{
    try {
        // Find complaints awaiting user confirmation for more than 48 hours
        $stmt = $pdo->query("
            SELECT id FROM complaints 
            WHERE status = 'Awaiting User Confirmation' 
            AND govt_resolved = 1 
            AND user_confirmed = 0 
            AND resolved_at IS NOT NULL
            AND TIMESTAMPDIFF(HOUR, resolved_at, NOW()) >= 48
        ");
        $pending = $stmt->fetchAll(PDO::FETCH_COLUMN);

        foreach ($pending as $complaint_id) {
            $pdo->beginTransaction();

            $upd = $pdo->prepare("UPDATE complaints SET user_confirmed=1, confirmed_at=NOW(), status='Completed' WHERE id=?");
            $upd->execute([$complaint_id]);

            logTimeline($pdo, $complaint_id, 'Auto Confirmed', 'Complaint auto-completed after 48 hours with no user response.');

            $pdo->commit();
        }
    } catch (Exception $e) {
        if ($pdo->inTransaction())
            $pdo->rollBack();
        error_log("Auto-confirm error: " . $e->getMessage());
    }
}
?>
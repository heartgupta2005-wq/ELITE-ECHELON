<?php
// api/check_sla.php
// Can be triggered via AJAX polling or cron job
require 'db.php';
header('Content-Type: application/json');

try {
    $pdo->beginTransaction();

    // Find breached complaints that are NOT already escalated/resolved
    $stmt = $pdo->query("
        SELECT id FROM complaints
        WHERE sla_deadline IS NOT NULL
          AND sla_deadline < NOW()
          AND status NOT IN ('Resolved', 'Escalated L1', 'Escalated L2')
    ");
    $breached = $stmt->fetchAll(PDO::FETCH_COLUMN);

    $count = 0;
    foreach ($breached as $complaint_id) {
        // Update status to Escalated L1
        $upd = $pdo->prepare("UPDATE complaints SET status = 'Escalated L1' WHERE id = ?");
        $upd->execute([$complaint_id]);

        // Log escalation in timeline
        logTimeline($pdo, $complaint_id, 'Escalated', 'SLA deadline exceeded. Complaint auto-escalated to Level 1.');

        // Insert into escalations table
        $esc = $pdo->prepare("INSERT INTO escalations (complaint_id, level, reason) VALUES (?, 1, 'SLA deadline exceeded automatically.')");
        $esc->execute([$complaint_id]);

        $count++;
    }

    $pdo->commit();
    echo json_encode(["status" => "success", "escalated_count" => $count]);
} catch (\PDOException $e) {
    $pdo->rollBack();
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>

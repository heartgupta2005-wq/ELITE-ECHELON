<?php
// api/escalation_engine.php
// Requires db.php (defines $pdo) and email_helper.php to be included before this file.

/**
 * checkEscalations
 * Main engine to promote unresolved complaints through authority levels.
 * Called automatically when complaints are fetched.
 */
function checkEscalations($pdo)
{
    $query = "SELECT c.*, d.name as dept_name, d.alert_email as dept_head_email 
              FROM complaints c
              LEFT JOIN departments d ON c.department_id = d.id
              WHERE c.status NOT IN ('Resolved', 'Critical')
              AND c.escalation_level IS NOT NULL";

    try {
        $stmt = $pdo->query($query);
        $complaints = $stmt->fetchAll(PDO::FETCH_ASSOC);
    } catch (Exception $e) {
        error_log("Escalation fetch error: " . $e->getMessage());
        return;
    }

    foreach ($complaints as $c) {
        $complaint_id = $c['id'];
        $current_level = (int) ($c['escalation_level'] ?? 1);
        $last_time = strtotime($c['last_escalation_time'] ?? $c['created_at']);
        $now = time();
        $hours_since = ($now - $last_time) / 3600;

        $new_level = $current_level;
        $new_status = $c['status'];
        $log_msg = "";

        // --- ESCALATION RULES ---
        if ($current_level == 1 && $hours_since >= 24) {
            $new_level = 2;
            $new_status = 'Escalated L1';
            $log_msg = "Escalated to Level 2 (Dept Head) due to 24h inactivity.";

            // Notify Dept Head
            if (!empty($c['dept_head_email'])) {
                sendEscalationEmail($c['dept_head_email'], "Department Head", $c, 2);
            }
        } elseif ($current_level == 2 && $hours_since >= 48) {
            $new_level = 3;
            $new_status = 'Escalated L2';
            $log_msg = "Escalated to Level 3 (City Admin) due to 48h inactivity.";

            // Notify Admin
            $admin_email = "aayush.sharma2605@gmail.com";
            sendEscalationEmail($admin_email, "City Authority", $c, 3);
        } elseif ($current_level == 3 && $hours_since >= 72) {
            // Mark as Critical if still unresolved at level 3 for another 24h
            $new_status = 'Critical';
            $log_msg = "Complaint marked as CRITICAL after prolonged Level 3 status (72h+).";
        }

        // --- APPLY UPDATES (only if something changed) ---
        if ($new_level != $current_level || $new_status != $c['status']) {
            try {
                $pdo->beginTransaction();

                // Update Complaint
                $upd = $pdo->prepare("UPDATE complaints SET escalation_level = ?, status = ?, last_escalation_time = NOW() WHERE id = ?");
                $upd->execute([$new_level, $new_status, $complaint_id]);

                // Log to escalation_logs
                if ($new_level != $current_level) {
                    $log = $pdo->prepare("INSERT INTO escalation_logs (complaint_id, from_level, to_level) VALUES (?, ?, ?)");
                    $log->execute([$complaint_id, $current_level, $new_level]);
                }

                // Log to timeline_logs
                if (!empty($log_msg)) {
                    $time = $pdo->prepare("INSERT INTO timeline_logs (complaint_id, event_type, description) VALUES (?, ?, ?)");
                    $time->execute([$complaint_id, 'Escalation', $log_msg]);
                }

                $pdo->commit();
            } catch (Exception $e) {
                if ($pdo->inTransaction())
                    $pdo->rollBack();
                error_log("Escalation Error ID {$complaint_id}: " . $e->getMessage());
            }
        }
    }
}

/**
 * sendEscalationEmail
 */
function sendEscalationEmail($to_email, $recipient_name, $complaint, $level)
{
    $subject = "⚠️ ESCALATION: Complaint #{$complaint['id']} - Level {$level}";

    $levelLabel = $level === 2 ? "Department Head" : "City Authority / Admin";
    $body = "
    <div style='font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;'>
        <h2 style='color: #ef4444;'>⚠️ Complaint Escalation Alert — Level {$level}</h2>
        <p>Dear {$recipient_name},</p>
        <p>The following civic complaint has been automatically escalated to <strong>Level {$level} ({$levelLabel})</strong> due to inactivity beyond the allowed timeframe.</p>
        <hr style='border:0; border-top:1px solid #e2e8f0; margin:16px 0;'>
        <ul>
            <li><strong>Complaint ID:</strong> #{$complaint['id']}</li>
            <li><strong>Category:</strong> {$complaint['category']}</li>
            <li><strong>Description:</strong> {$complaint['description']}</li>
            <li><strong>Current Status:</strong> {$complaint['status']}</li>
            <li><strong>Filed On:</strong> {$complaint['created_at']}</li>
            <li><strong>Department:</strong> " . ($complaint['dept_name'] ?? 'Unassigned') . "</li>
        </ul>
        <p style='margin-top:16px; background:#fee2e2; padding:12px; border-radius:8px; color:#991b1b;'>
            <strong>Action Required:</strong> Please take immediate steps to resolve this issue or escalate further as needed.
        </p>
        <p style='font-size:0.8rem; color:#64748b; margin-top:16px;'>
            This is an automated alert from the <em>Civic Accountability Engine</em>.
            <a href='http://localhost/civic/gov.html'>Log in to the Government Portal →</a>
        </p>
    </div>
    ";

    return sendCivicEmail($to_email, $subject, $body);
}
?>
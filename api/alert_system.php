<?php
// api/alert_system.php
// threshold check logic and email trigger

require_once 'db.php';
require_once 'email_helper.php';

function checkDepartmentAlert($pdo, $dept_id)
{
    if (!$dept_id)
        return;

    try {
        // 1. Fetch department threshold and alert settings
        $stmt = $pdo->prepare("SELECT name, alert_email, complaint_threshold, last_alert_sent FROM departments WHERE id = ?");
        $stmt->execute([$dept_id]);
        $dept = $stmt->fetch();

        if (!$dept || !$dept['alert_email'] || $dept['complaint_threshold'] <= 0)
            return;

        // 2. Count active complaints (Pending or In Progress)
        $stmtCount = $pdo->prepare("SELECT COUNT(*) FROM complaints WHERE department_id = ? AND status IN ('Pending', 'In Progress')");
        $stmtCount->execute([$dept_id]);
        $count = (int) $stmtCount->fetchColumn();

        // 3. Check threshold
        if ($count >= $dept['complaint_threshold']) {

            // 4. Spam Prevention: Check if we sent an alert recently (e.g., in the last 24 hours)
            // Or only send if the count is HIGHER than before, but timestamp is safer.
            $canSend = true;
            if ($dept['last_alert_sent']) {
                $lastSent = strtotime($dept['last_alert_sent']);
                if (time() - $lastSent < 3600 * 24) { // Once per 24 hours
                    $canSend = false;
                }
            }

            if ($canSend) {
                $subject = "⚠️ Complaint Threshold Exceeded: {$dept['name']}";
                $body = generateThresholdAlertBody($dept['name'], $count, $dept['complaint_threshold']);

                if (sendCivicEmail($dept['alert_email'], $subject, $body)) {
                    // Update last_alert_sent
                    $update = $pdo->prepare("UPDATE departments SET last_alert_sent = NOW() WHERE id = ?");
                    $update->execute([$dept_id]);
                    return true;
                }
            }
        }
    } catch (\Exception $e) {
        // Log error (in a real system)
        return false;
    }
    return false;
}

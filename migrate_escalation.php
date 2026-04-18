<?php
require_once 'api/db.php';

try {
    $conn->exec("ALTER TABLE complaints ADD COLUMN escalation_level INT DEFAULT 1");
    echo "Column escalation_level added.\n";
} catch (Exception $e) {
    echo "escalation_level error or already exists: " . $e->getMessage() . "\n";
}

try {
    $conn->exec("ALTER TABLE complaints ADD COLUMN last_escalation_time DATETIME DEFAULT CURRENT_TIMESTAMP");
    echo "Column last_escalation_time added.\n";
} catch (Exception $e) {
    echo "last_escalation_time error or already exists: " . $e->getMessage() . "\n";
}

try {
    $conn->exec("CREATE TABLE IF NOT EXISTS escalation_logs (
        id INT AUTO_INCREMENT PRIMARY KEY,
        complaint_id INT NOT NULL,
        from_level INT NOT NULL,
        to_level INT NOT NULL,
        triggered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE
    )");
    echo "Table escalation_logs created.\n";
} catch (Exception $e) {
    echo "escalation_logs error: " . $e->getMessage() . "\n";
}
?>
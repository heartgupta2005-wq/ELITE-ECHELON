<?php
// api/db.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$host = '127.0.0.1';
$db = 'civic_engine';
$user = 'root';
$pass = ''; // Leave blank for default XAMPP. Change for InfinityFree
$charset = 'utf8mb4';

$options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES => false,
];

try {
    $pdo = new PDO("mysql:host=$host;charset=$charset", $user, $pass, $options);
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
    $pdo->exec("USE `$db`");

    // Auto-init schema if tables don't exist
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    if ($stmt->rowCount() == 0) {
        $schemaPath = __DIR__ . '/../database/schema.sql';
        if (file_exists($schemaPath)) {
            $sql = file_get_contents($schemaPath);
            $pdo->exec($sql);
        }
    } else {
        // ── SAFE MIGRATION ── Add missing columns to existing databases ──
        $cols = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('role', $cols)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN role ENUM('public','government') DEFAULT 'public' AFTER password");
        }
        if (!in_array('is_admin', $cols)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN is_admin TINYINT(1) DEFAULT 0 AFTER role");
        }
        if (!in_array('department_id', $cols)) {
            $pdo->exec("ALTER TABLE users ADD COLUMN department_id INT DEFAULT NULL AFTER is_admin");
            // Add FK only if not yet present
            $fks = $pdo->query("SELECT CONSTRAINT_NAME FROM information_schema.KEY_COLUMN_USAGE 
                WHERE TABLE_SCHEMA='$db' AND TABLE_NAME='users' AND COLUMN_NAME='department_id'")->fetchAll();
            if (empty($fks)) {
                $pdo->exec("ALTER TABLE users ADD CONSTRAINT fk_user_dept2 FOREIGN KEY (department_id) REFERENCES departments(id) ON DELETE SET NULL");
            }
        }

        // Add description to departments if missing
        $dCols = $pdo->query("SHOW COLUMNS FROM departments")->fetchAll(PDO::FETCH_COLUMN);
        if (!in_array('description', $dCols)) {
            $pdo->exec("ALTER TABLE departments ADD COLUMN description VARCHAR(500) DEFAULT NULL AFTER name");
        }

        // Create remarks table if missing
        $pdo->exec("CREATE TABLE IF NOT EXISTS remarks (
            id INT AUTO_INCREMENT PRIMARY KEY,
            complaint_id VARCHAR(50) NOT NULL,
            user_id INT NOT NULL,
            user_name VARCHAR(255) DEFAULT NULL,
            remark TEXT NOT NULL,
            created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (complaint_id) REFERENCES complaints(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
        )");

        // Seed admin if no government user exists
        $adminExists = $pdo->query("SELECT id FROM users WHERE role='government' LIMIT 1")->fetchColumn();
        if (!$adminExists) {
            $hash = password_hash('admin123', PASSWORD_DEFAULT);
            $pdo->exec("INSERT INTO users (name, email, phone, password, role, is_admin) 
                        VALUES ('System Admin', 'admin@civic.gov', '0000000000', '$hash', 'government', 1)");
        }

        // Ensure at least 6 departments exist
        $deptCount = (int) $pdo->query("SELECT COUNT(*) FROM departments")->fetchColumn();
        if ($deptCount < 6) {
            $pdo->exec("INSERT IGNORE INTO departments (name, description) VALUES 
                ('Electricity','Power supply, streetlights, and electrical faults'),
                ('Public Safety','Law enforcement support, hazards, and emergencies'),
                ('Parks & Recreation','Parks, gardens, playgrounds, and green spaces')");
        }
    }

} catch (\PDOException $e) {
    header('Content-Type: application/json');
    echo json_encode(["status" => "error", "message" => "Database connection failed: " . $e->getMessage()]);
    exit;
}

// Utility: log timeline event
function logTimeline($pdo, $complaint_id, $event_type, $description)
{
    $stmt = $pdo->prepare("INSERT INTO timeline_logs (complaint_id, event_type, description) VALUES (?, ?, ?)");
    $stmt->execute([$complaint_id, $event_type, $description]);
}
?>
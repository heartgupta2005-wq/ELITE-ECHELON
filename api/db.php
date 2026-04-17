<?php
// api/db.php
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
header("Access-Control-Allow-Headers: Content-Type");

$host = '127.0.0.1';
$db   = 'civic_engine';
$user = 'root';
$pass = ''; // Leave blank for default XAMPP. Change for InfinityFree
$charset = 'utf8mb4';

$options = [
    PDO::ATTR_ERRMODE            => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
    PDO::ATTR_EMULATE_PREPARES   => false,
];

try {
    // First connect without selecting a database
    $pdo = new PDO("mysql:host=$host;charset=$charset", $user, $pass, $options);
    
    // Create database if it doesn't exist
    $pdo->exec("CREATE DATABASE IF NOT EXISTS `$db` CHARACTER SET utf8mb4 COLLATE utf8mb4_general_ci");
    $pdo->exec("USE `$db`");
    
    // Check if `users` table exists. If not, auto-import the fresh schema to enforce relations.
    $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
    if ($stmt->rowCount() == 0) {
        $schemaPath = __DIR__ . '/../database/schema.sql';
        if (file_exists($schemaPath)) {
            $sql = file_get_contents($schemaPath);
            $pdo->exec($sql);
        }
    }
    
} catch (\PDOException $e) {
    // Return graceful JSON error if DB is down.
    header('Content-Type: application/json');
    echo json_encode(["status" => "error", "message" => "Database connection failed: " . $e->getMessage()]);
    exit;
}

// Utility function to log to timeline
function logTimeline($pdo, $complaint_id, $event_type, $description) {
    $stmt = $pdo->prepare("INSERT INTO timeline_logs (complaint_id, event_type, description) VALUES (?, ?, ?)");
    $stmt->execute([$complaint_id, $event_type, $description]);
}
?>

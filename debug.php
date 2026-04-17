<?php
// debug.php
require 'api/db.php';

header('Content-Type: application/json');
$response = ["status" => "ok", "db" => "connected", "tables" => []];

try {
    $stmt = $pdo->query("SHOW TABLES");
    $response["tables"] = $stmt->fetchAll(PDO::FETCH_COLUMN);
    
    // Check complaints columns
    if (in_array('complaints', $response["tables"])) {
        $stmt = $pdo->query("SHOW COLUMNS FROM complaints");
        $response["complaints_columns"] = $stmt->fetchAll(PDO::FETCH_ASSOC);
    }
} catch (\PDOException $e) {
    $response["status"] = "error";
    $response["message"] = $e->getMessage();
}

echo json_encode($response, JSON_PRETTY_PRINT);
?>

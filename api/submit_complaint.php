<?php
// api/submit_complaint.php
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$description = $_POST['description'] ?? '';
$user_id = $_POST['user_id'] ?? null;
$lat = (isset($_POST['lat']) && trim($_POST['lat']) !== '') ? $_POST['lat'] : null;
$lng = (isset($_POST['lng']) && trim($_POST['lng']) !== '') ? $_POST['lng'] : null;

if (empty($description)) {
    echo json_encode(["status" => "error", "message" => "Description is required."]);
    exit;
}

if (!$user_id) {
    echo json_encode(["status" => "error", "message" => "Authentication required. user_id missing."]);
    exit;
}

// Generate unique ID
$id = 'CIV-' . date('Ymd') . '-' . mt_rand(1000, 9999);

// Handle Image Upload
$image_url = null;
if (isset($_FILES['image']) && $_FILES['image']['error'] == UPLOAD_ERR_OK) {
    $uploadDir = '../uploads/';
    if (!is_dir($uploadDir)) {
        mkdir($uploadDir, 0755, true);
    }
    
    $fileInfo = pathinfo($_FILES['image']['name']);
    $extension = strtolower($fileInfo['extension']);
    $allowedExts = ['jpg', 'jpeg', 'png', 'gif'];
    
    if (in_array($extension, $allowedExts)) {
        $fileName = $id . '.' . $extension;
        $targetFile = $uploadDir . $fileName;
        
        if (move_uploaded_file($_FILES['image']['tmp_name'], $targetFile)) {
            $image_url = 'uploads/' . $fileName; // Relative path for frontend
        }
    }
}

// Calculate SLA Deadline (48 hours from now)
$sla_deadline = date('Y-m-d H:i:s', strtotime('+48 hours'));

try {
    $stmt = $pdo->prepare("
        INSERT INTO complaints (id, user_id, description, image_url, lat, lng, status, sla_deadline) 
        VALUES (?, ?, ?, ?, ?, ?, 'Pending', ?)
    ");
    
    $stmt->execute([$id, $user_id, $description, $image_url, $lat, $lng, $sla_deadline]);
    
    // Log timeline
    logTimeline($pdo, $id, 'Submitted', 'User submitted a new complaint.');
    
    echo json_encode([
        "status" => "success", 
        "data" => [
            "id" => $id,
            "message" => "Complaint submitted successfully."
        ]
    ]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>

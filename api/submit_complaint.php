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

// Handle Image Upload (Standard File)
$image_url = null;
if (isset($_FILES['image']) && $_FILES['image']['error'] == UPLOAD_ERR_OK) {
    $uploadDir = '../uploads/';
    if (!is_dir($uploadDir))
        mkdir($uploadDir, 0755, true);

    $fileInfo = pathinfo($_FILES['image']['name']);
    $extension = strtolower($fileInfo['extension']);
    $allowedExts = ['jpg', 'jpeg', 'png', 'gif'];

    if (in_array($extension, $allowedExts)) {
        $fileName = $id . '.' . $extension;
        if (move_uploaded_file($_FILES['image']['tmp_name'], $uploadDir . $fileName)) {
            $image_url = 'uploads/' . $fileName;
        }
    }
}

// Handle Image (Base64 from Camera)
if (empty($image_url) && !empty($_POST['image_base64'])) {
    $uploadDir = '../uploads/';
    if (!is_dir($uploadDir))
        mkdir($uploadDir, 0755, true);

    $base64Data = $_POST['image_base64'];
    if (preg_match('/^data:image\/(\w+);base64,/', $base64Data, $type)) {
        $base64Data = substr($base64Data, strpos($base64Data, ',') + 1);
        $type = strtolower($type[1]); // jpg, png, etc.
        if (in_array($type, ['jpg', 'jpeg', 'png'])) {
            $base64Data = base64_decode($base64Data);
            if ($base64Data !== false) {
                $fileName = $id . '.' . $type;
                if (file_put_contents($uploadDir . $fileName, $base64Data)) {
                    $image_url = 'uploads/' . $fileName;
                }
            }
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

    // Trigger AI categorization (non-blocking fire-and-forget via cURL)
    // AI categorization will handle department assignment AND threshold alerts.
    $protocol = (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off') ? 'https' : 'http';
    $host = $_SERVER['HTTP_HOST'];
    $aiUrl = $protocol . '://' . $host . '/civic/api/ai_categorize.php';
    $ch = curl_init($aiUrl);
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_TIMEOUT => 2,
        CURLOPT_POSTFIELDS => json_encode(["description" => $description, "complaint_id" => $id]),
        CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
    ]);
    @curl_exec($ch);
    if (curl_errno($ch)) {
        error_log('AI Categorization trigger failed: ' . curl_error($ch));
    }
    curl_close($ch);

    echo json_encode([
        "status" => "success",
        "data" => [
            "id" => $id,
            "message" => "Complaint submitted successfully. AI categorization in progress."
        ]
    ]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>
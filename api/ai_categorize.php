<?php
// api/ai_categorize.php
// Calls external Render Python API for AI categorization.
// Falls back to 'General' gracefully if unavailable.
require 'db.php';
header('Content-Type: application/json');

$data = json_decode(file_get_contents("php://input"), true) ?? $_POST;
$description = trim($data['description'] ?? '');
$complaint_id = trim($data['complaint_id'] ?? '');

if (empty($description) || empty($complaint_id)) {
    echo json_encode(["status" => "error", "message" => "description and complaint_id are required."]);
    exit;
}

// --- Configure your Render AI API endpoint here ---
$AI_API_URL = 'https://your-render-api.onrender.com/categorize'; // TODO: Replace with real URL

$category = 'General';
$department_id = 4; // Default: 'General' department

// Attempt AI categorization
$ch = curl_init($AI_API_URL);
curl_setopt_array($ch, [
    CURLOPT_POST => true,
    CURLOPT_RETURNTRANSFER => true,
    CURLOPT_TIMEOUT => 8,
    CURLOPT_POSTFIELDS => json_encode(["description" => $description]),
    CURLOPT_HTTPHEADER => ['Content-Type: application/json'],
]);
$response = curl_exec($ch);
$httpCode = curl_getinfo($ch, CURLINFO_HTTP_CODE);
curl_close($ch);

if ($httpCode === 200 && $response) {
    $aiResult = json_decode($response, true);
    if (!empty($aiResult['category'])) {
        $category = $aiResult['category'];
    }
}

// Map category name to department
$deptMap = [
    'Sanitation' => 1,
    'Infrastructure' => 2,
    'Water & Utilities' => 3,
    'General' => 4,
    'Roads' => 2,
    'Electricity' => 3,
    'Garbage' => 1,
    'Drainage' => 1,
];
$department_id = $deptMap[$category] ?? 4;

// Update complaint in DB
try {
    $stmt = $pdo->prepare("UPDATE complaints SET category = ?, department_id = ? WHERE id = ?");
    $stmt->execute([$category, $department_id, $complaint_id]);

    logTimeline($pdo, $complaint_id, 'Categorized', "AI assigned category: {$category}, routed to department ID: {$department_id}.");

    // --- Threshold Check & Automated Alert ---
    require_once 'alert_system.php';
    checkDepartmentAlert($pdo, $department_id);

    echo json_encode([
        "status" => "success",
        "category" => $category,
        "department_id" => $department_id
    ]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => $e->getMessage()]);
}
?>
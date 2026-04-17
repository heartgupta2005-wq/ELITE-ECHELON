<?php
// api/register.php — Public users only (role hardcoded to 'public')
require 'db.php';
header('Content-Type: application/json');

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    echo json_encode(["status" => "error", "message" => "Invalid request method."]);
    exit;
}

$data = json_decode(file_get_contents("php://input"), true) ?? $_POST;
$name = trim($data['name'] ?? '');
$email = trim($data['email'] ?? '');
$phone = trim($data['phone'] ?? '');
$password = $data['password'] ?? '';

if (empty($name) || empty($email) || empty($phone) || empty($password)) {
    echo json_encode(["status" => "error", "message" => "All fields are required."]);
    exit;
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    echo json_encode(["status" => "error", "message" => "Invalid email format."]);
    exit;
}
if (strlen($password) < 6) {
    echo json_encode(["status" => "error", "message" => "Password must be at least 6 characters."]);
    exit;
}

try {
    $stmt = $pdo->prepare("SELECT id FROM users WHERE email = ?");
    $stmt->execute([$email]);
    if ($stmt->fetch()) {
        echo json_encode(["status" => "error", "message" => "Email already registered."]);
        exit;
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    // Role is ALWAYS 'public' for self-registration
    $pdo->prepare("INSERT INTO users (name, email, phone, password, role, is_admin) VALUES (?, ?, ?, ?, 'public', 0)")
        ->execute([$name, $email, $phone, $hash]);

    echo json_encode([
        "status" => "success",
        "message" => "Registration successful. You can now log in."
    ]);
} catch (\PDOException $e) {
    echo json_encode(["status" => "error", "message" => "Database error: " . $e->getMessage()]);
}
?>
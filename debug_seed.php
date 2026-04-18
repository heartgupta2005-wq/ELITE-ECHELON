<?php
require 'api/db.php';
// Create a test officer for Sanitation (assuming id=1)
$email = 'officer@sanitation.gov';
$hash = password_hash('officer123', PASSWORD_DEFAULT);

try {
    // Check if sanitation exists, get id
    $dept = $pdo->query("SELECT id FROM departments WHERE name='Sanitation'")->fetch();
    if ($dept) {
        $pdo->exec("DELETE FROM users WHERE email='$email'");
        $pdo->exec("INSERT INTO users (name, email, phone, password, role, is_admin, department_id) VALUES ('Sanitation Officer', '$email', '1234567890', '$hash', 'government', 0, {$dept['id']})");
        echo "Officer seeded successfully!";
    } else {
        echo "Sanitation dept not found.";
    }
} catch (Exception $e) {
    echo $e->getMessage();
}
?>
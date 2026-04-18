<?php
// api/setup_mailer.php
// Script to download PHPMailer files for real email support

$baseUrl = 'https://raw.githubusercontent.com/PHPMailer/PHPMailer/master/src/';
$files = ['PHPMailer.php', 'SMTP.php', 'Exception.php'];
$dir = __DIR__ . '/libs/PHPMailer/';

if (!is_dir($dir)) {
    mkdir($dir, 0777, true);
}

echo "Starting download...\n";

foreach ($files as $file) {
    echo "Downloading $file... ";
    $content = file_get_contents($baseUrl . $file);
    if ($content) {
        file_put_contents($dir . $file, $content);
        echo "Done.\n";
    } else {
        echo "FAILED!\n";
    }
}

echo "\nSetup complete. PHPMailer is now in api/libs/PHPMailer/\n";
?>
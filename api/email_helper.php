<?php
// api/email_helper.php
// A modular wrapper for sending emails using PHPMailer with native mail() fallback.

require_once __DIR__ . '/libs/PHPMailer/Exception.php';
require_once __DIR__ . '/libs/PHPMailer/PHPMailer.php';
require_once __DIR__ . '/libs/PHPMailer/SMTP.php';

use PHPMailer\PHPMailer\PHPMailer;
use PHPMailer\PHPMailer\Exception;

function sendCivicEmail($to, $subject, $body)
{
    $mail = new PHPMailer(true);

    try {
        // --- SMTP CONFIGURATION ---
        $mail->isSMTP();
        $mail->Host = 'smtp.gmail.com';
        $mail->SMTPAuth = true;
        $mail->Username = 'aayush.sharma2605@gmail.com';
        $mail->Password = 'kgmf vjlp kica zxoh';
        $mail->SMTPSecure = PHPMailer::ENCRYPTION_STARTTLS;
        $mail->Port = 587;
        // ---------------------------

        // Recipients
        $mail->setFrom('alerts@civic.gov', 'Civic Engine Alerts');
        $mail->addAddress($to);

        // Content
        $mail->isHTML(true);
        $mail->Subject = $subject;
        $mail->Body = $body;

        return $mail->send();

    } catch (Exception $e) {
        // If PHPMailer fails, record error to log
        $error = $mail->ErrorInfo;

        // Log for manual verification
        $logEntry = "--- [" . date('Y-m-d H:i:s') . "] ---\n";
        $logEntry .= "TO: $to\n";
        $logEntry .= "SUBJECT: $subject\n";
        $logEntry .= "MAILER ERROR: " . $error . "\n";

        // Final Fallback: Attempt native mail()
        $headers = "MIME-Version: 1.0\r\nContent-type:text/html;charset=UTF-8\r\nFrom: Civic Engine <alerts@civic.gov>\r\n";
        $success = @mail($to, $subject, $body, $headers);

        if ($success) {
            $logEntry .= "STATUS: Delivered via native mail() fallback.\n";
        } else {
            $logEntry .= "STATUS: FAILED all delivery methods. Check SMTP/Server logs.\n";
            $logEntry .= "BODY: $body\n";
        }

        $logEntry .= "-----------------------------------\n\n";
        @file_put_contents(__DIR__ . '/../debug_emails.log', $logEntry, FILE_APPEND);

        return $success; // Will be false if both SMTP and mail() fail
    }
}

function generateThresholdAlertBody($dept_name, $count, $threshold)
{
    return "
    <div style='font-family: sans-serif; padding: 20px; border: 1px solid #e2e8f0; border-radius: 12px; max-width: 600px;'>
        <h2 style='color: #ef4444;'>⚠️ Complaint Threshold Exceeded</h2>
        <p>This is an automated alert from the Civic Accountability Engine.</p>
        <hr style='border: 0; border-top: 1px solid #e2e8f0; margin: 20px 0;'>
        <p><strong>Department:</strong> {$dept_name}</p>
        <p><strong>Current Active Complaints:</strong> <span style='color: #ef4444; font-weight: bold;'>{$count}</span></p>
        <p><strong>Configured Threshold:</strong> {$threshold}</p>
        <p style='margin-top: 20px; background: #fee2e2; padding: 15px; border-radius: 8px; color: #991b1b;'>
            The number of pending/in-progress complaints has exceeded the defined limit. Immediate action or additional resource allocation may be required for resolution within SLA guidelines.
        </p>
        <p style='margin-top: 20px; font-size: 0.875rem; color: #64748b;'>
            Please log in to the <a href='http://localhost/civic/gov.html'>Government Portal</a> to manage these issues.
        </p>
    </div>
    ";
}

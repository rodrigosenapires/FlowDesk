<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

$input = read_json();
$to = trim((string)($input["to"] ?? ""));
if ($to === "" || !filter_var($to, FILTER_VALIDATE_EMAIL)) {
  respond(["ok" => false, "error" => "email_invalid"], 400);
}

$token = bin2hex(random_bytes(8));
$sent = send_verification_email($to, $token);
if (!$sent) {
  $detail = function_exists("get_smtp_last_error") ? get_smtp_last_error() : "";
  respond(["ok" => false, "error" => "email_send_failed", "detail" => $detail], 500);
}

respond(["ok" => true]);

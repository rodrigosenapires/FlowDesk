<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

$input = read_json();
$username = trim((string)($input["username"] ?? ""));
$password = (string)($input["password"] ?? "");
$display_name = trim((string)($input["display_name"] ?? ""));
$email = trim((string)($input["email"] ?? ""));
$captcha = trim((string)($input["captcha"] ?? ""));

if ($username === "" || $password === "" || $email === "" || $captcha === "") {
  respond(["ok" => false, "error" => "missing_fields"], 400);
}
if (strlen($password) < 6) {
  respond(["ok" => false, "error" => "weak_password"], 400);
}
if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
  respond(["ok" => false, "error" => "email_invalid"], 400);
}

$expectedCaptcha = isset($_SESSION["captcha_answer"]) ? (string)$_SESSION["captcha_answer"] : "";
$captchaTs = isset($_SESSION["captcha_ts"]) ? (int)$_SESSION["captcha_ts"] : 0;
if (!$expectedCaptcha || !$captchaTs || $captchaTs < (time() - 600)) {
  respond(["ok" => false, "error" => "captcha_expired"], 400);
}
if (trim($expectedCaptcha) !== $captcha) {
  respond(["ok" => false, "error" => "captcha_invalid"], 400);
}
unset($_SESSION["captcha_answer"], $_SESSION["captcha_ts"]);

$usernameStmt = db()->prepare("SELECT id FROM users WHERE username = :username LIMIT 1");
$usernameStmt->execute([":username" => $username]);
if ($usernameStmt->fetch()) {
  respond(["ok" => false, "error" => "username_in_use"], 409);
}
$emailStmt = db()->prepare("SELECT id FROM users WHERE email = :email LIMIT 1");
$emailStmt->execute([":email" => $email]);
if ($emailStmt->fetch()) {
  respond(["ok" => false, "error" => "email_in_use"], 409);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$token = bin2hex(random_bytes(32));
$tokenHash = hash("sha256", $token);
$expiresAt = (new DateTimeImmutable("+24 hours"))->format("Y-m-d H:i:s");
$stmt = db()->prepare(
  "INSERT INTO users (username, display_name, password_hash, email, email_verified, email_verification_token, email_verification_expires_at, created_at, updated_at)
   VALUES (:username, :display_name, :password_hash, :email, 0, :token, :expires_at, NOW(), NOW())"
);
$stmt->execute([
  ":username" => $username,
  ":display_name" => $display_name !== "" ? $display_name : null,
  ":password_hash" => $hash,
  ":email" => $email,
  ":token" => $tokenHash,
  ":expires_at" => $expiresAt,
]);

$mailSent = send_verification_email($email, $token);
if (!$mailSent) {
  respond(["ok" => false, "error" => "email_send_failed"], 500);
}

respond(["ok" => true, "email_verification_required" => true]);

<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

$input = read_json();
$username = trim((string)($input["username"] ?? ""));

if ($username === "") {
  respond(["ok" => false, "error" => "missing_fields"], 400);
}

$stmt = db()->prepare("SELECT id, email, email_verified FROM users WHERE username = :username LIMIT 1");
$stmt->execute([":username" => $username]);
$user = $stmt->fetch();

if (!$user) {
  respond(["ok" => false, "error" => "user_not_found"], 404);
}
$email = trim((string)($user["email"] ?? ""));
if ($email === "" || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  respond(["ok" => false, "error" => "email_invalid"], 400);
}
if ((int)$user["email_verified"] === 1) {
  respond(["ok" => false, "error" => "email_already_verified"], 409);
}

$token = bin2hex(random_bytes(32));
$tokenHash = hash("sha256", $token);
$expiresAt = (new DateTimeImmutable("+24 hours"))->format("Y-m-d H:i:s");
$upd = db()->prepare(
  "UPDATE users
   SET email_verification_token = :token,
       email_verification_expires_at = :expires_at,
       updated_at = NOW()
   WHERE id = :id"
);
$upd->execute([
  ":token" => $tokenHash,
  ":expires_at" => $expiresAt,
  ":id" => (int)$user["id"],
]);

$mailSent = send_verification_email($email, $token);
if (!$mailSent) {
  respond(["ok" => false, "error" => "email_send_failed"], 500);
}

respond(["ok" => true]);

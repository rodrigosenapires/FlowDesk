<?php
declare(strict_types=1);

require_once __DIR__ . "/_init.php";

$input = read_json();
$identifier = trim((string)($input["identifier"] ?? ""));
if ($identifier === "") {
  respond(["ok" => false, "error" => "missing_identifier"], 400);
}

$stmt = db()->prepare("SELECT id, email FROM users WHERE username = :identifier OR email = :identifier LIMIT 1");
$stmt->execute([":identifier" => $identifier]);
$user = $stmt->fetch();
if (!$user) {
  respond(["ok" => false, "error" => "user_not_found"], 404);
}

$email = trim((string)($user["email"] ?? ""));
if ($email === "" || !filter_var($email, FILTER_VALIDATE_EMAIL)) {
  respond(["ok" => false, "error" => "email_invalid"], 400);
}

$token = bin2hex(random_bytes(20));
$hash = hash("sha256", $token);
$expiresAt = (new DateTimeImmutable("+1 hour"))->format("Y-m-d H:i:s");

$update = db()->prepare(
  "UPDATE users
   SET password_reset_token = :token,
       password_reset_expires_at = :expires_at,
       updated_at = NOW()
   WHERE id = :id"
);
$update->execute([
  ":token" => $hash,
  ":expires_at" => $expiresAt,
  ":id" => (int)$user["id"],
]);

$mailSent = send_password_reset_email($email, $token);
if (!$mailSent) {
  respond(["ok" => false, "error" => "email_send_failed"], 500);
}

respond(["ok" => true]);

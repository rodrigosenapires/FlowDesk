<?php
declare(strict_types=1);

require_once __DIR__ . "/_init.php";

$input = read_json();
$token = trim((string)($input["token"] ?? ""));
$password = (string)($input["password"] ?? "");

if ($token === "") {
  respond(["ok" => false, "error" => "token_invalid"], 400);
}
if (strlen($password) < 6) {
  respond(["ok" => false, "error" => "weak_password"], 400);
}

$hash = hash("sha256", $token);
$stmt = db()->prepare(
  "SELECT id, password_reset_expires_at
   FROM users
   WHERE password_reset_token = :token
     AND password_reset_expires_at IS NOT NULL
     AND password_reset_expires_at >= NOW()
   LIMIT 1"
);
$stmt->execute([":token" => $hash]);
$user = $stmt->fetch();

if (!$user) {
  $expiredStmt = db()->prepare(
    "SELECT id
     FROM users
     WHERE password_reset_token = :token
     LIMIT 1"
  );
  $expiredStmt->execute([":token" => $hash]);
  if ($expiredStmt->fetch()) {
    respond(["ok" => false, "error" => "token_expired"], 400);
  }
  respond(["ok" => false, "error" => "token_invalid"], 400);
}

$newHash = password_hash($password, PASSWORD_DEFAULT);
$update = db()->prepare(
  "UPDATE users
   SET password_hash = :password_hash,
       password_reset_token = NULL,
       password_reset_expires_at = NULL,
       updated_at = NOW()
   WHERE id = :id"
);
$update->execute([
  ":password_hash" => $newHash,
  ":id" => (int)$user["id"],
]);

respond(["ok" => true]);

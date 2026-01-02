<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] === "GET") {
  $countStmt = db()->query("SELECT COUNT(*) AS total FROM users");
  $countRow = $countStmt->fetch();
  $total = $countRow ? (int)$countRow["total"] : 0;
  respond(["ok" => true, "needs_setup" => ($total === 0)]);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

// Only allow setup if there are no users yet.
$countStmt = db()->query("SELECT COUNT(*) AS total FROM users");
$countRow = $countStmt->fetch();
$total = $countRow ? (int)$countRow["total"] : 0;
if ($total > 0) {
  respond(["ok" => false, "error" => "already_configured"], 409);
}

$input = read_json();
$username = trim((string)($input["username"] ?? ""));
$password = (string)($input["password"] ?? "");
$display_name = trim((string)($input["display_name"] ?? ""));

if ($username === "" || $password === "") {
  respond(["ok" => false, "error" => "missing_fields"], 400);
}
if (strlen($password) < 6) {
  respond(["ok" => false, "error" => "weak_password"], 400);
}

$hash = password_hash($password, PASSWORD_DEFAULT);
$stmt = db()->prepare(
  "INSERT INTO users (username, display_name, password_hash, created_at, updated_at)
   VALUES (:username, :display_name, :password_hash, NOW(), NOW())"
);
$stmt->execute([
  ":username" => $username,
  ":display_name" => $display_name !== "" ? $display_name : null,
  ":password_hash" => $hash,
]);

$user_id = (int)db()->lastInsertId();
$_SESSION["user_id"] = $user_id;

respond([
  "ok" => true,
  "user" => [
    "id" => $user_id,
    "username" => $username,
    "display_name" => $display_name !== "" ? $display_name : null,
  ]
]);

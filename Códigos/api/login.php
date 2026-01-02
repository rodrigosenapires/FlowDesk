<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

$input = read_json();
$username = trim((string)($input["username"] ?? ""));
$password = (string)($input["password"] ?? "");

if ($username === "" || $password === "") {
  respond(["ok" => false, "error" => "missing_credentials"], 400);
}

$stmt = db()->prepare("SELECT id, username, display_name, password_hash FROM users WHERE username = :username LIMIT 1");
$stmt->execute([":username" => $username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, (string)$user["password_hash"])) {
  respond(["ok" => false, "error" => "invalid_credentials"], 401);
}

$_SESSION["user_id"] = (int)$user["id"];
respond([
  "ok" => true,
  "user" => [
    "id" => (int)$user["id"],
    "username" => $user["username"],
    "display_name" => $user["display_name"],
  ]
]);

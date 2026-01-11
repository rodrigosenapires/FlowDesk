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

$selectColumns = "id, username, display_name, password_hash, email, email_verified, role, owner_user_id, access_blocked, access_pending";
if (users_has_can_manage_users_column()) {
  $selectColumns .= ", can_manage_users";
}
$stmt = db()->prepare("SELECT {$selectColumns} FROM users WHERE username = :username LIMIT 1");
$stmt->execute([":username" => $username]);
$user = $stmt->fetch();

if (!$user || !password_verify($password, (string)$user["password_hash"])) {
  respond(["ok" => false, "error" => "invalid_credentials"], 401);
}
$accessBlocked = (string)($user["access_blocked"] ?? "0");
$accessPending = (string)($user["access_pending"] ?? "0");
if ($accessBlocked === "1") {
  if ($accessPending === "1") {
    respond(["ok" => false, "error" => "access_pending"], 403);
  }
  respond(["ok" => false, "error" => "access_blocked"], 403);
}
if ((int)$user["email_verified"] !== 1) {
  $email = trim((string)($user["email"] ?? ""));
  if ($email === "") {
    // Legacy user without email: allow login.
  } else {
    respond(["ok" => false, "error" => "email_unverified"], 403);
  }
}

$_SESSION["user_id"] = (int)$user["id"];
$now = time();
set_user_storage_value((int)$user["id"], "last_active_at", (string)$now);
$rawLog = get_user_storage_value((int)$user["id"], "activity_log");
$log = [];
if ($rawLog) {
  $decoded = json_decode($rawLog, true);
  if (is_array($decoded)) {
    $log = $decoded;
  }
}
$last = $log ? (int)$log[count($log) - 1] : 0;
if ($last !== $now) {
  $log[] = $now;
}
if (count($log) > 1000) {
  $log = array_slice($log, -1000);
}
set_user_storage_value((int)$user["id"], "activity_log", json_encode($log));
respond([
  "ok" => true,
  "user" => [
    "id" => (int)$user["id"],
    "username" => $user["username"],
    "display_name" => $user["display_name"],
    "role" => normalize_user_role($user["role"] ?? null),
    "owner_user_id" => $user["owner_user_id"],
    "is_admin" => is_admin_user($user),
    "can_manage_users" => (int)(users_has_can_manage_users_column() ? ($user["can_manage_users"] ?? 0) : (get_user_storage_value((int)$user["id"], "can_manage_users") ?? 0)),
  ]
]);

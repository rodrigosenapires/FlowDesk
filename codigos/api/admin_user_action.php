<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

$user_id = require_login();
$current = fetch_user($user_id);
if (!$current) {
  respond(["ok" => false, "error" => "forbidden"], 403);
}

$input = read_json();
$action = (string)($input["action"] ?? "");
$targetId = (int)($input["user_id"] ?? 0);
if ($targetId <= 0) {
  respond(["ok" => false, "error" => "missing_user_id"], 400);
}
if ($targetId === (int)$current["id"]) {
  respond(["ok" => false, "error" => "cannot_modify_self"], 400);
}

$stmt = db()->prepare("SELECT id, username, role, owner_user_id FROM users WHERE id = :id LIMIT 1");
$stmt->execute([":id" => $targetId]);
$target = $stmt->fetch();
if (!$target) {
  respond(["ok" => false, "error" => "user_not_found"], 404);
}
if (is_admin_user($target)) {
  respond(["ok" => false, "error" => "cannot_modify_admin"], 400);
}

$isAdmin = is_admin_user($current);
$isPrincipal = is_principal_user($current);
$isOwner = can_manage_secondary($current, $target);
$canGrant = $isPrincipal && $isOwner;
if (!$isAdmin) {
  if ($action !== "delete" && $action !== "grant_users_access" && $action !== "revoke_users_access") {
    respond(["ok" => false, "error" => "forbidden"], 403);
  }
  if (!$isOwner) {
    respond(["ok" => false, "error" => "forbidden"], 403);
  }
  if (($action === "grant_users_access" || $action === "revoke_users_access") && !$canGrant) {
    respond(["ok" => false, "error" => "forbidden"], 403);
  }
}

if ($action === "block") {
  $stmt = db()->prepare("UPDATE users SET access_blocked = 1, access_pending = 0 WHERE id = :id");
  $stmt->execute([":id" => $targetId]);
  respond(["ok" => true]);
}
if ($action === "unblock") {
  $stmt = db()->prepare("UPDATE users SET access_blocked = 0, access_pending = 0 WHERE id = :id");
  $stmt->execute([":id" => $targetId]);
  respond(["ok" => true]);
}
if ($action === "delete") {
  $delStorage = db()->prepare("DELETE FROM user_storage WHERE user_id = :uid");
  $delStorage->execute([":uid" => $targetId]);
  $delUser = db()->prepare("DELETE FROM users WHERE id = :id");
  $delUser->execute([":id" => $targetId]);
  respond(["ok" => true]);
}
if ($action === "grant_users_access") {
  if (users_has_can_manage_users_column()) {
    $stmt = db()->prepare("UPDATE users SET can_manage_users = 1 WHERE id = :id");
    $stmt->execute([":id" => $targetId]);
  } else {
    set_user_storage_value($targetId, "can_manage_users", "1");
  }
  respond(["ok" => true]);
}
if ($action === "revoke_users_access") {
  if (users_has_can_manage_users_column()) {
    $stmt = db()->prepare("UPDATE users SET can_manage_users = 0 WHERE id = :id");
    $stmt->execute([":id" => $targetId]);
  } else {
    set_user_storage_value($targetId, "can_manage_users", "0");
  }
  respond(["ok" => true]);
}

respond(["ok" => false, "error" => "invalid_action"], 400);

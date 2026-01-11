<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

$user_id = require_login();
$current = fetch_user($user_id);
if (!$current) {
  respond(["ok" => false, "error" => "forbidden"], 403);
}

$isAdmin = is_admin_user($current);
$isPrincipal = is_principal_user($current);
$canViewUsers = can_view_users($current);
if (!$canViewUsers) {
  respond(["ok" => false, "error" => "forbidden"], 403);
}

$manageSelect = users_has_can_manage_users_column() ? "u.can_manage_users" : "cmu.storage_value AS can_manage_users";
$manageJoin = users_has_can_manage_users_column() ? "" : "LEFT JOIN user_storage cmu ON cmu.user_id = u.id AND cmu.storage_key = 'can_manage_users'";
$baseSql = "SELECT u.id, u.username, u.email, u.email_verified, u.password_hash, u.created_at, u.updated_at,
          u.role, u.owner_user_id, u.access_blocked, u.access_pending, {$manageSelect},
          la.storage_value AS last_active_at,
          lo.storage_value AS last_logout_at,
          ps.storage_value AS pause_state,
          psn.storage_value AS pause_since
   FROM users u
   {$manageJoin}
   LEFT JOIN user_storage la
     ON la.user_id = u.id AND la.storage_key = 'last_active_at'
   LEFT JOIN user_storage lo
     ON lo.user_id = u.id AND lo.storage_key = 'last_logout_at'
   LEFT JOIN user_storage ps
     ON ps.user_id = u.id AND ps.storage_key = 'pause_state'
   LEFT JOIN user_storage psn
     ON psn.user_id = u.id AND psn.storage_key = 'pause_since'";

if ($isAdmin) {
  $stmt = db()->query($baseSql . " ORDER BY u.created_at DESC");
  $rows = $stmt->fetchAll();
} else {
  $ownerId = (int)($isPrincipal ? $current["id"] : ($current["owner_user_id"] ?? 0));
  $stmt = db()->prepare($baseSql . " WHERE u.role = 'secundario' AND u.owner_user_id = :owner_id ORDER BY u.created_at DESC");
  $stmt->execute([":owner_id" => $ownerId]);
  $rows = $stmt->fetchAll();
}

respond(["ok" => true, "users" => $rows]);

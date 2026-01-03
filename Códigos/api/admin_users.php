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
if (!$isAdmin && !$isPrincipal) {
  respond(["ok" => false, "error" => "forbidden"], 403);
}

$baseSql = "SELECT u.id, u.username, u.email, u.email_verified, u.password_hash, u.created_at, u.updated_at,
          u.role, u.owner_user_id, u.access_blocked, u.access_pending,
          la.storage_value AS last_active_at,
          lo.storage_value AS last_logout_at
   FROM users u
   LEFT JOIN user_storage la
     ON la.user_id = u.id AND la.storage_key = 'last_active_at'
   LEFT JOIN user_storage lo
     ON lo.user_id = u.id AND lo.storage_key = 'last_logout_at'";

if ($isAdmin) {
  $stmt = db()->query($baseSql . " ORDER BY u.created_at DESC");
  $rows = $stmt->fetchAll();
} else {
  $stmt = db()->prepare($baseSql . " WHERE u.role = 'secundario' AND u.owner_user_id = :owner_id ORDER BY u.created_at DESC");
  $stmt->execute([":owner_id" => (int)$current["id"]]);
  $rows = $stmt->fetchAll();
}

respond(["ok" => true, "users" => $rows]);

<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

$user_id = current_user_id();
if (!$user_id) {
  respond(["ok" => false, "authenticated" => false]);
}

$user = fetch_user($user_id);
if (!$user) {
  respond(["ok" => false, "authenticated" => false]);
}

respond([
  "ok" => true,
  "authenticated" => true,
  "user" => [
    "id" => (int)$user["id"],
    "username" => $user["username"],
    "display_name" => $user["display_name"],
    "role" => normalize_user_role($user["role"] ?? null),
    "owner_user_id" => $user["owner_user_id"],
    "is_admin" => is_admin_user($user),
    "can_manage_users" => (int)($user["can_manage_users"] ?? 0),
  ],
]);

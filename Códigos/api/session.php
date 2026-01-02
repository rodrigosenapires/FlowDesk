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
  "user" => $user,
]);

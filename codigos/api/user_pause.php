<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] === "GET") {
  $user_id = require_login();
  if (!$user_id) {
    respond(["ok" => false, "error" => "forbidden"], 403);
  }
  $pauseState = get_user_storage_value($user_id, "pause_state");
  $pauseSince = get_user_storage_value($user_id, "pause_since");
  respond([
    "ok" => true,
    "pause_state" => $pauseState ? (string)$pauseState : "",
    "pause_since" => $pauseSince ? (int)$pauseSince : null,
  ]);
}

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

$user_id = require_login();
if (!$user_id) {
  respond(["ok" => false, "error" => "forbidden"], 403);
}

$raw = file_get_contents("php://input");
$data = json_decode($raw ?: "{}", true);
if (!is_array($data)) {
  $data = $_POST;
}

$state = isset($data["state"]) ? trim((string)$data["state"]) : "";
$allowed = ["general", "lunch", "off"];
if (!in_array($state, $allowed, true)) {
  respond(["ok" => false, "error" => "invalid_state"], 400);
}

if ($state === "off") {
  set_user_storage_value($user_id, "pause_state", "");
  set_user_storage_value($user_id, "pause_since", "");
  respond(["ok" => true, "pause_state" => "", "pause_since" => null]);
}

$now = time();
set_user_storage_value($user_id, "pause_state", $state);
set_user_storage_value($user_id, "pause_since", (string)$now);

respond(["ok" => true, "pause_state" => $state, "pause_since" => $now]);

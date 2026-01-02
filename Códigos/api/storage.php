<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

$user_id = require_login();
$input = read_json();
$action = (string)($input["action"] ?? "");

if ($action === "getAll") {
  $stmt = db()->prepare("SELECT storage_key, storage_value FROM user_storage WHERE user_id = :uid");
  $stmt->execute([":uid" => $user_id]);
  $data = [];
  while ($row = $stmt->fetch()) {
    $data[$row["storage_key"]] = $row["storage_value"];
  }
  respond(["ok" => true, "data" => $data]);
}

if ($action === "get") {
  $keys = $input["keys"] ?? [];
  if (!is_array($keys) || !$keys) {
    respond(["ok" => true, "data" => []]);
  }
  $placeholders = [];
  $params = [":uid" => $user_id];
  foreach ($keys as $idx => $key) {
    $param = ":k" . $idx;
    $placeholders[] = $param;
    $params[$param] = (string)$key;
  }
  $sql = "SELECT storage_key, storage_value FROM user_storage WHERE user_id = :uid AND storage_key IN (" . implode(",", $placeholders) . ")";
  $stmt = db()->prepare($sql);
  $stmt->execute($params);
  $data = [];
  while ($row = $stmt->fetch()) {
    $data[$row["storage_key"]] = $row["storage_value"];
  }
  respond(["ok" => true, "data" => $data]);
}

if ($action === "set") {
  $key = (string)($input["key"] ?? "");
  $value = (string)($input["value"] ?? "");
  if ($key === "") {
    respond(["ok" => false, "error" => "missing_key"], 400);
  }
  $stmt = db()->prepare(
    "INSERT INTO user_storage (user_id, storage_key, storage_value, updated_at)
     VALUES (:uid, :key, :val, NOW())
     ON DUPLICATE KEY UPDATE storage_value = VALUES(storage_value), updated_at = NOW()"
  );
  $stmt->execute([":uid" => $user_id, ":key" => $key, ":val" => $value]);
  respond(["ok" => true]);
}

if ($action === "setMany") {
  $items = $input["items"] ?? [];
  if (!is_array($items) || !$items) {
    respond(["ok" => true]);
  }
  $stmt = db()->prepare(
    "INSERT INTO user_storage (user_id, storage_key, storage_value, updated_at)
     VALUES (:uid, :key, :val, NOW())
     ON DUPLICATE KEY UPDATE storage_value = VALUES(storage_value), updated_at = NOW()"
  );
  foreach ($items as $key => $value) {
    $stmt->execute([
      ":uid" => $user_id,
      ":key" => (string)$key,
      ":val" => (string)$value,
    ]);
  }
  respond(["ok" => true]);
}

if ($action === "delete") {
  $key = (string)($input["key"] ?? "");
  if ($key === "") {
    respond(["ok" => false, "error" => "missing_key"], 400);
  }
  $stmt = db()->prepare("DELETE FROM user_storage WHERE user_id = :uid AND storage_key = :key");
  $stmt->execute([":uid" => $user_id, ":key" => $key]);
  respond(["ok" => true]);
}

respond(["ok" => false, "error" => "invalid_action"], 400);

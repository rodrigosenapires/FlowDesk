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
$role = normalize_user_role($current["role"] ?? null);
$owner_id = get_account_owner_id($current);

$shared_keys = [
  "baseAtendimento_v5",
  "drawerMenuButtons_v2",
  "quick_links_v1",
  "nuvem_links_v1",
  "stores_v1",
  "search_tags_v1",
  "size_tables_custom_v1",
  "size_tables_overrides_v1",
  "products_custom_v1",
  "personalizacoes_v1",
  "quick_links_transportadoras_seeded",
  "tarefasDiarias_v1",
  "tarefasDiarias_concluidas_v1",
  "calendarHistory_v1",
];

function is_shared_storage_key(string $key, array $shared_keys): bool {
  return in_array($key, $shared_keys, true);
}

function storage_target_user_id(string $key, int $user_id, int $owner_id, string $role, array $shared_keys): int {
  if ($role === "secundario" && is_shared_storage_key($key, $shared_keys) && $owner_id > 0) {
    return $owner_id;
  }
  return $user_id;
}
$input = read_json();
$action = (string)($input["action"] ?? "");

if ($action === "getAll") {
  $data = [];
  if ($role === "secundario" && $owner_id > 0) {
    if ($shared_keys) {
      $placeholders = [];
      $params = [":uid" => $owner_id];
      foreach ($shared_keys as $idx => $key) {
        $param = ":k" . $idx;
        $placeholders[] = $param;
        $params[$param] = (string)$key;
      }
      $sql = "SELECT storage_key, storage_value FROM user_storage WHERE user_id = :uid AND storage_key IN (" . implode(",", $placeholders) . ")";
      $stmt = db()->prepare($sql);
      $stmt->execute($params);
      while ($row = $stmt->fetch()) {
        $data[$row["storage_key"]] = $row["storage_value"];
      }
    }
    if ($shared_keys) {
      $placeholders = [];
      $params = [":uid" => $user_id];
      foreach ($shared_keys as $idx => $key) {
        $param = ":k" . $idx;
        $placeholders[] = $param;
        $params[$param] = (string)$key;
      }
      $sql = "SELECT storage_key, storage_value FROM user_storage WHERE user_id = :uid AND storage_key NOT IN (" . implode(",", $placeholders) . ")";
      $stmt = db()->prepare($sql);
      $stmt->execute($params);
      while ($row = $stmt->fetch()) {
        $data[$row["storage_key"]] = $row["storage_value"];
      }
    } else {
      $stmt = db()->prepare("SELECT storage_key, storage_value FROM user_storage WHERE user_id = :uid");
      $stmt->execute([":uid" => $user_id]);
      while ($row = $stmt->fetch()) {
        $data[$row["storage_key"]] = $row["storage_value"];
      }
    }
  } else {
    $stmt = db()->prepare("SELECT storage_key, storage_value FROM user_storage WHERE user_id = :uid");
    $stmt->execute([":uid" => $user_id]);
    while ($row = $stmt->fetch()) {
      $data[$row["storage_key"]] = $row["storage_value"];
    }
  }
  respond(["ok" => true, "data" => $data]);
}

if ($action === "get") {
  $keys = $input["keys"] ?? [];
  if (!is_array($keys) || !$keys) {
    respond(["ok" => true, "data" => []]);
  }
  $data = [];
  $byUser = [];
  foreach ($keys as $key) {
    $k = (string)$key;
    $target_id = storage_target_user_id($k, $user_id, $owner_id, $role, $shared_keys);
    if (!isset($byUser[$target_id])) $byUser[$target_id] = [];
    $byUser[$target_id][] = $k;
  }
  foreach ($byUser as $target_id => $groupKeys) {
    $placeholders = [];
    $params = [":uid" => (int)$target_id];
    foreach (array_values($groupKeys) as $idx => $key) {
      $param = ":k" . $idx;
      $placeholders[] = $param;
      $params[$param] = (string)$key;
    }
    $sql = "SELECT storage_key, storage_value FROM user_storage WHERE user_id = :uid AND storage_key IN (" . implode(",", $placeholders) . ")";
    $stmt = db()->prepare($sql);
    $stmt->execute($params);
    while ($row = $stmt->fetch()) {
      $data[$row["storage_key"]] = $row["storage_value"];
    }
  }
  respond(["ok" => true, "data" => $data]);
}

if ($action === "set") {
  $key = (string)($input["key"] ?? "");
  $value = (string)($input["value"] ?? "");
  if ($key === "") {
    respond(["ok" => false, "error" => "missing_key"], 400);
  }
  $target_id = storage_target_user_id($key, $user_id, $owner_id, $role, $shared_keys);
  $stmt = db()->prepare(
    "INSERT INTO user_storage (user_id, storage_key, storage_value, updated_at)
     VALUES (:uid, :key, :val, NOW())
     ON DUPLICATE KEY UPDATE storage_value = VALUES(storage_value), updated_at = NOW()"
  );
  $stmt->execute([":uid" => $target_id, ":key" => $key, ":val" => $value]);
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
    $target_id = storage_target_user_id((string)$key, $user_id, $owner_id, $role, $shared_keys);
    $stmt->execute([
      ":uid" => $target_id,
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
  $target_id = storage_target_user_id($key, $user_id, $owner_id, $role, $shared_keys);
  $stmt = db()->prepare("DELETE FROM user_storage WHERE user_id = :uid AND storage_key = :key");
  $stmt->execute([":uid" => $target_id, ":key" => $key]);
  respond(["ok" => true]);
}

respond(["ok" => false, "error" => "invalid_action"], 400);

<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

$user_id = require_login();
if (!$user_id) {
  respond(["ok" => false, "error" => "forbidden"], 403);
}
$current = fetch_user($user_id);
if (!$current) {
  respond(["ok" => false, "error" => "forbidden"], 403);
}

$raw = file_get_contents("php://input");
$data = json_decode($raw ?: "{}", true);
if (!is_array($data)) {
  $data = $_POST;
}

$action = isset($data["action"]) ? trim((string)$data["action"]) : "";
$detail = isset($data["detail"]) ? trim((string)$data["detail"]) : "";
$label = isset($data["label"]) ? trim((string)$data["label"]) : "";
$targetId = isset($data["target_id"]) ? trim((string)$data["target_id"]) : "";
$targetType = isset($data["target_type"]) ? trim((string)$data["target_type"]) : "";
$isExtra = isset($data["is_extra"]) ? (bool)$data["is_extra"] : false;

if ($action === "") {
  respond(["ok" => false, "error" => "missing_action"], 400);
}

$labels = [
  "task_create" => "Tarefa criada",
  "task_close" => "Tarefa encerrada",
  "task_reopen" => "Tarefa reativada",
  "task_delete" => "Tarefa excluída",
  "task_extra_create" => "Tarefa extra criada",
  "task_extra_close" => "Tarefa extra encerrada",
  "task_extra_delete" => "Tarefa extra excluída",
  "search" => "Pesquisa no buscador",
  "personalization_send" => "Personalização enviada",
  "pause_general" => "Pausa geral",
  "pause_lunch" => "Pausa almoço",
  "pause_end" => "Pausa encerrada",
];

if ($label === "") {
  $label = $labels[$action] ?? "Atividade";
}

$now = time();
$entry = [
  "ts" => $now,
  "action" => $action,
  "label" => $label,
];
if ($detail !== "") {
  $entry["detail"] = $detail;
}
if ($targetId !== "") {
  $entry["target_id"] = $targetId;
}
if ($targetType !== "") {
  $entry["target_type"] = $targetType;
}
if ($isExtra) {
  $entry["is_extra"] = true;
}

$rawLog = get_user_storage_value($user_id, "activity_actions");
$log = [];
if ($rawLog) {
  $decoded = json_decode((string)$rawLog, true);
  if (is_array($decoded)) {
    $log = $decoded;
  }
}

$log[] = $entry;
$cutoff = $now - (90 * 86400);
$log = array_values(array_filter($log, function($item) use ($cutoff) {
  $ts = isset($item["ts"]) ? (int)$item["ts"] : 0;
  return $ts >= $cutoff;
}));
if (count($log) > 1000) {
  $log = array_slice($log, -1000);
}

set_user_storage_value($user_id, "activity_actions", json_encode($log));

// Notifica o usuario principal quando um secundario cria/encerra tarefas.
$role = normalize_user_role($current["role"] ?? null);
$owner_id = (int)($current["owner_user_id"] ?? 0);
$notifyActions = ["task_create", "task_close", "task_extra_create", "task_extra_close"];
if ($role === "secundario" && $owner_id > 0 && in_array($action, $notifyActions, true)) {
  $rawNotifications = get_user_storage_value($owner_id, "notifications_v1");
  $notifications = [];
  if ($rawNotifications) {
    $decoded = json_decode((string)$rawNotifications, true);
    if (is_array($decoded)) {
      $notifications = $decoded;
    }
  }
  $byName = trim((string)($current["display_name"] ?? $current["username"] ?? ""));
  $notificationsEntry = [
    "id" => uniqid("n_", true),
    "type" => $action,
    "title" => $label,
    "detail" => $detail,
    "created_at" => date("c", $now),
    "seen" => false,
    "task_id" => $targetId,
    "is_extra" => $isExtra,
    "by_name" => $byName,
  ];
  array_unshift($notifications, $notificationsEntry);
  if (count($notifications) > 200) {
    $notifications = array_slice($notifications, 0, 200);
  }
  set_user_storage_value($owner_id, "notifications_v1", json_encode($notifications));
}

// Notifica o criador da tarefa extra quando outro usuario encerra.
$notify_user_id = isset($data["notify_user_id"]) ? (int)$data["notify_user_id"] : 0;
if ($notify_user_id <= 0 && isset($data["created_by_user_id"])) {
  $notify_user_id = (int)$data["created_by_user_id"];
}
if ($notify_user_id > 0 && $notify_user_id !== $user_id && in_array($action, $notifyActions, true)) {
  $target_user = fetch_user($notify_user_id);
  if ($target_user) {
    $target_role = normalize_user_role($target_user["role"] ?? null);
    $target_owner_id = (int)($target_user["owner_user_id"] ?? 0);
    $shared_owner_id = ($role === "principal") ? (int)$user_id : (int)$owner_id;
    $target_in_account = false;
    if ($target_role === "principal") {
      $target_in_account = ((int)$target_user["id"] === $shared_owner_id);
    } else {
      $target_in_account = ($target_owner_id === $shared_owner_id);
    }
    if ($target_in_account && !($role === "secundario" && $notify_user_id === $owner_id)) {
      $rawNotifications = get_user_storage_value($notify_user_id, "notifications_v1");
      $notifications = [];
      if ($rawNotifications) {
        $decoded = json_decode((string)$rawNotifications, true);
        if (is_array($decoded)) {
          $notifications = $decoded;
        }
      }
      $byName = trim((string)($current["display_name"] ?? $current["username"] ?? ""));
      $notificationsEntry = [
        "id" => uniqid("n_", true),
        "type" => $action,
        "title" => $label,
        "detail" => $detail,
        "created_at" => date("c", $now),
        "seen" => false,
        "task_id" => $targetId,
        "is_extra" => $isExtra,
        "by_name" => $byName,
      ];
      array_unshift($notifications, $notificationsEntry);
      if (count($notifications) > 200) {
        $notifications = array_slice($notifications, 0, 200);
      }
      set_user_storage_value($notify_user_id, "notifications_v1", json_encode($notifications));

      if ($target_role === "secundario" && $shared_owner_id > 0) {
        $rawShared = get_user_storage_value($shared_owner_id, "notifications_shared_v1");
        $sharedList = [];
        if ($rawShared) {
          $decodedShared = json_decode((string)$rawShared, true);
          if (is_array($decodedShared)) {
            $sharedList = $decodedShared;
          }
        }
        $sharedEntry = $notificationsEntry;
        $sharedEntry["target_user_id"] = $notify_user_id;
        array_unshift($sharedList, $sharedEntry);
        if (count($sharedList) > 200) {
          $sharedList = array_slice($sharedList, 0, 200);
        }
        set_user_storage_value($shared_owner_id, "notifications_shared_v1", json_encode($sharedList));
      }
    }
  }
}

respond(["ok" => true]);

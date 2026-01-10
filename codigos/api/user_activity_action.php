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

respond(["ok" => true]);

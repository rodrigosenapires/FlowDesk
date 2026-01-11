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

$targetUserId = isset($_GET["user_id"]) ? (int)$_GET["user_id"] : 0;
if ($targetUserId <= 0) {
  respond(["ok" => false, "error" => "missing_user_id"], 400);
}

$stmt = db()->prepare("SELECT id, username, role, owner_user_id FROM users WHERE id = :id LIMIT 1");
$stmt->execute([":id" => $targetUserId]);
$target = $stmt->fetch();
if (!$target) {
  respond(["ok" => false, "error" => "user_not_found"], 404);
}

$isAdmin = is_admin_user($current);
if (!$isAdmin) {
  $targetUserId = (int)$target["id"];
  if ($targetUserId === (int)$current["id"]) {
    // ok
  } elseif (can_manage_secondary($current, $target)) {
    // ok (principal)
  } elseif (!is_principal_user($current) && !empty($current["can_manage_users"])) {
    $ownerId = (int)($current["owner_user_id"] ?? 0);
    if ((int)($target["owner_user_id"] ?? 0) !== $ownerId || normalize_user_role($target["role"] ?? null) !== "secundario") {
      respond(["ok" => false, "error" => "forbidden"], 403);
    }
  } else {
    respond(["ok" => false, "error" => "forbidden"], 403);
  }
}

$storageStmt = db()->prepare(
  "SELECT storage_key, storage_value
   FROM user_storage
   WHERE user_id = :uid AND storage_key IN ('activity_log','activity_actions','last_active_at','last_logout_at')"
);
$storageStmt->execute([":uid" => $targetUserId]);
$storage = [];
while ($row = $storageStmt->fetch()) {
  $storage[$row["storage_key"]] = $row["storage_value"];
}

$now = time();
$dayParam = isset($_GET["day"]) ? (string)$_GET["day"] : "";
$tzOffset = isset($_GET["tz_offset"]) ? (int)$_GET["tz_offset"] : 0;
$dayTs = 0;
try {
  $baseDay = $dayParam !== "" ? $dayParam : date("Y-m-d", $now);
  if (preg_match("/^\\d{2}\\/\\d{2}\\/\\d{4}$/", $baseDay)) {
    $dt = DateTime::createFromFormat("d/m/Y H:i:s", $baseDay . " 00:00:00", new DateTimeZone("UTC"));
    if (!$dt) {
      throw new Exception("invalid_date");
    }
  } else {
    $dt = new DateTime($baseDay . " 00:00:00", new DateTimeZone("UTC"));
  }
  $dayTs = $dt->getTimestamp();
} catch (Exception $e) {
  $dayTs = strtotime(date("Y-m-d", $now) . " 00:00:00");
}
$dayStart = $dayTs + ($tzOffset * 60);
$dayEnd = $dayStart + 86399;
$filterStart = $dayStart;
$filterEnd = $dayEnd;

$rawLog = isset($storage["activity_log"]) ? (string)$storage["activity_log"] : "[]";
$decoded = json_decode($rawLog, true);
$events = [];
if (is_array($decoded)) {
  foreach ($decoded as $item) {
    $val = (int)$item;
    if ($val > 0) {
      $events[] = $val;
    }
  }
}
$cutoff = $now - (90 * 86400);
$events = array_values(array_filter($events, function($ts) use ($cutoff) {
  return $ts >= $cutoff;
}));
sort($events, SORT_NUMERIC);
if (json_encode($events) !== $rawLog) {
  set_user_storage_value($targetUserId, "activity_log", json_encode($events));
}
$eventsInDay = array_values(array_filter($events, function($ts) use ($filterStart, $filterEnd) {
  return $ts >= $filterStart && $ts <= $filterEnd;
}));
if (!$eventsInDay && $tzOffset !== 0 && $events) {
  $altStart = $dayTs - ($tzOffset * 60);
  $altEnd = $altStart + 86399;
  $altEvents = array_values(array_filter($events, function($ts) use ($altStart, $altEnd) {
    return $ts >= $altStart && $ts <= $altEnd;
  }));
  if ($altEvents) {
    $filterStart = $altStart;
    $filterEnd = $altEnd;
    $eventsInDay = $altEvents;
    $dayStart = $altStart;
    $dayEnd = $altEnd;
  }
}
$events = $eventsInDay;
$rawActions = isset($storage["activity_actions"]) ? (string)$storage["activity_actions"] : "[]";
$decodedActions = json_decode($rawActions, true);
$actions = [];
if (is_array($decodedActions)) {
  foreach ($decodedActions as $item) {
    if (!is_array($item)) {
      continue;
    }
    $ts = isset($item["ts"]) ? (int)$item["ts"] : 0;
    $label = isset($item["label"]) ? (string)$item["label"] : "";
    $action = isset($item["action"]) ? (string)$item["action"] : "";
    $detail = isset($item["detail"]) ? (string)$item["detail"] : "";
    $actionTargetId = isset($item["target_id"]) ? (string)$item["target_id"] : "";
    $targetType = isset($item["target_type"]) ? (string)$item["target_type"] : "";
    $isExtra = !empty($item["is_extra"]);
    if ($ts <= 0 || $label === "") {
      continue;
    }
    $entry = [
      "ts" => $ts,
      "label" => $label,
      "action" => $action,
      "detail" => $detail,
    ];
    if ($actionTargetId !== "") {
      $entry["target_id"] = $actionTargetId;
    }
    if ($targetType !== "") {
      $entry["target_type"] = $targetType;
    }
    if ($isExtra) {
      $entry["is_extra"] = true;
    }
    $actions[] = $entry;
  }
}
$actions = array_values(array_filter($actions, function($item) use ($cutoff) {
  return ((int)$item["ts"]) >= $cutoff;
}));
if (json_encode($actions) !== $rawActions) {
  set_user_storage_value($targetUserId, "activity_actions", json_encode($actions));
}
$actions = array_values(array_filter($actions, function($item) use ($filterStart, $filterEnd) {
  $ts = (int)$item["ts"];
  return $ts >= $filterStart && $ts <= $filterEnd;
}));
usort($actions, function($a, $b) {
  return ($a["ts"] ?? 0) <=> ($b["ts"] ?? 0);
});
$events = array_values(array_filter($events, function($ts) use ($filterStart, $filterEnd) {
  return $ts >= $filterStart && $ts <= $filterEnd;
}));
$active = [];
$inactive = [];

if ($events) {
  $start = $events[0];
  $last = $events[0];

  foreach ($events as $idx => $ts) {
    if ($idx === 0) {
      continue;
    }
    if (($ts - $last) <= 900) {
      $last = $ts;
      continue;
    }
    $active[] = [
      "start" => $start,
      "end" => $last,
      "duration_sec" => max(0, $last - $start),
    ];
    $inactiveStart = $last + 900;
    if ($ts > $inactiveStart) {
      $inactive[] = [
        "start" => $inactiveStart,
        "end" => $ts,
        "duration_sec" => max(0, $ts - $inactiveStart),
      ];
    }
    $start = $ts;
    $last = $ts;
  }

  $activeOngoing = ($now - $last) <= 900;
  $active[] = [
    "start" => $start,
    "end" => $last,
    "duration_sec" => max(0, $last - $start),
    "ongoing" => $activeOngoing,
  ];

  if (($now - $last) > 900) {
    $inactiveStart = $last + 900;
    $inactive[] = [
      "start" => $inactiveStart,
      "end" => $now,
      "duration_sec" => max(0, $now - $inactiveStart),
      "ongoing" => true,
    ];
  }
}

respond([
  "ok" => true,
  "user" => [
    "id" => (int)$target["id"],
    "username" => $target["username"],
  ],
  "summary" => [
    "first_seen" => $events ? $events[0] : null,
    "last_seen" => $events ? $events[count($events) - 1] : null,
    "total_events" => count($events),
    "last_active_at" => isset($storage["last_active_at"]) ? (int)$storage["last_active_at"] : null,
    "last_logout_at" => isset($storage["last_logout_at"]) ? (int)$storage["last_logout_at"] : null,
    "generated_at" => $now,
    "day" => date("Y-m-d", $filterStart),
  ],
  "active_periods" => $active,
  "inactive_periods" => $inactive,
  "actions" => $actions,
]);

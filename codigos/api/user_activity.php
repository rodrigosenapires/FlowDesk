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

$targetId = isset($_GET["user_id"]) ? (int)$_GET["user_id"] : 0;
if ($targetId <= 0) {
  respond(["ok" => false, "error" => "missing_user_id"], 400);
}

$stmt = db()->prepare("SELECT id, username, role, owner_user_id FROM users WHERE id = :id LIMIT 1");
$stmt->execute([":id" => $targetId]);
$target = $stmt->fetch();
if (!$target) {
  respond(["ok" => false, "error" => "user_not_found"], 404);
}

$isAdmin = is_admin_user($current);
if (!$isAdmin) {
  $targetId = (int)$target["id"];
  if ($targetId === (int)$current["id"]) {
    // ok
  } elseif (can_manage_secondary($current, $target)) {
    // ok
  } else {
    respond(["ok" => false, "error" => "forbidden"], 403);
  }
}

$storageStmt = db()->prepare(
  "SELECT storage_key, storage_value
   FROM user_storage
   WHERE user_id = :uid AND storage_key IN ('activity_log','last_active_at','last_logout_at')"
);
$storageStmt->execute([":uid" => $targetId]);
$storage = [];
while ($row = $storageStmt->fetch()) {
  $storage[$row["storage_key"]] = $row["storage_value"];
}

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
sort($events, SORT_NUMERIC);

$now = time();
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
  ],
  "active_periods" => $active,
  "inactive_periods" => $inactive,
]);

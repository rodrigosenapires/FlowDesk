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

$username = strtolower(trim((string)($current["username"] ?? "")));
if (!is_principal_user($current) || $username !== "rodrigosp") {
  respond(["ok" => false, "error" => "forbidden"], 403);
}

$raw = file_get_contents("php://input");
$data = json_decode($raw ?: "{}", true);
if (!is_array($data)) {
  $data = $_POST;
}
$mode = strtolower(trim((string)($data["mode"] ?? "")));
if (!in_array($mode, ["daily", "monthly"], true)) {
  respond(["ok" => false, "error" => "invalid_mode"], 400);
}

define("REPORT_WEB_TRIGGER", true);
require_once __DIR__ . "/report_runner.php";

$summary = run_reports($mode);
if (!is_array($summary)) {
  respond(["ok" => false, "error" => "report_failed"]);
}
respond([
  "ok" => (bool)($summary["ok"] ?? false),
  "summary" => $summary
]);

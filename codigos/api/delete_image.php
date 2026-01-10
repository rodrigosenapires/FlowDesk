<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

require_login();

$input = read_json();
$raw = trim((string)($input["filename"] ?? ""));
$raw = str_replace("\\", "/", $raw);
if ($raw === "" || $raw === "." || $raw === "..") {
  respond(["ok" => false, "error" => "invalid_filename"], 400);
}

$allowed_folders = ["app", "app/geral", "app/personalizacoes", "respostas"];
$candidates = [];
if (strpos($raw, "/") !== false) {
  $parts = array_values(array_filter(explode("/", $raw), "strlen"));
  $name = basename($parts[count($parts) - 1] ?? "");
  $folder = implode("/", array_slice($parts, 0, -1));
  if ($folder === "" || $name === "" || !in_array($folder, $allowed_folders, true)) {
    respond(["ok" => false, "error" => "invalid_filename"], 400);
  }
  $candidates[] = $folder . "/" . $name;
} else {
  $name = basename($raw);
  if ($name === "" || $name === "." || $name === "..") {
    respond(["ok" => false, "error" => "invalid_filename"], 400);
  }
  foreach ($allowed_folders as $folder) {
    $candidates[] = $folder . "/" . $name;
  }
  $candidates[] = $name;
}

$dir = defined("APP_IMAGES_DIR") ? APP_IMAGES_DIR : (__DIR__ . "/../../imagens");
$dir = rtrim($dir, "/\\");
$deleted = false;
foreach ($candidates as $rel) {
  $path = $dir . DIRECTORY_SEPARATOR . str_replace("/", DIRECTORY_SEPARATOR, $rel);
  if (!file_exists($path)) {
    continue;
  }
  if (!is_file($path)) {
    respond(["ok" => false, "error" => "invalid_path"], 400);
  }
  if (!unlink($path)) {
    respond(["ok" => false, "error" => "delete_failed"], 500);
  }
  $deleted = true;
  break;
}

respond(["ok" => true, "deleted" => $deleted]);

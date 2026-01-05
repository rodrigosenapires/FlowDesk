<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

require_login();

$input = read_json();
$name = (string)($input["filename"] ?? "");
$name = basename($name);
if ($name === "" || $name === "." || $name === "..") {
  respond(["ok" => false, "error" => "invalid_filename"], 400);
}

$dir = defined("APP_IMAGES_DIR") ? APP_IMAGES_DIR : (__DIR__ . "/../../imagens");
$dir = rtrim($dir, "/\\");
$path = $dir . DIRECTORY_SEPARATOR . $name;

if (!file_exists($path)) {
  respond(["ok" => true, "deleted" => false]);
}

if (!is_file($path)) {
  respond(["ok" => false, "error" => "invalid_path"], 400);
}

if (!unlink($path)) {
  respond(["ok" => false, "error" => "delete_failed"], 500);
}

respond(["ok" => true, "deleted" => true]);

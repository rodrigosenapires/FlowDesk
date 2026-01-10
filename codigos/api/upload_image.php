<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

require_login();

if (!isset($_FILES["file"]) || !is_array($_FILES["file"])) {
  respond(["ok" => false, "error" => "missing_file"], 400);
}

$file = $_FILES["file"];
if (!empty($file["error"])) {
  respond(["ok" => false, "error" => "upload_error"], 400);
}

$tmp = $file["tmp_name"] ?? "";
if ($tmp === "" || !is_uploaded_file($tmp)) {
  respond(["ok" => false, "error" => "invalid_upload"], 400);
}

$mime = "";
$finfo = finfo_open(FILEINFO_MIME_TYPE);
if ($finfo) {
  $mime = (string)finfo_file($finfo, $tmp);
  finfo_close($finfo);
}

$allowed = [
  "image/jpeg" => "jpg",
  "image/png" => "png",
  "image/webp" => "webp",
  "image/gif" => "gif",
];

if (!isset($allowed[$mime])) {
  respond(["ok" => false, "error" => "invalid_type"], 400);
}

$orig = (string)($file["name"] ?? "");
$base = pathinfo($orig, PATHINFO_FILENAME);
$base = preg_replace("/[^A-Za-z0-9_-]+/", "-", $base ?? "");
$base = trim($base ?? "", "-_");
if ($base === "") {
  $base = "imagem";
}

$ext = $allowed[$mime];
$stamp = date("Ymd_His");
$rand = bin2hex(random_bytes(4));
$filename = $base . "-" . $stamp . "-" . $rand . "." . $ext;

$dir = defined("APP_IMAGES_DIR") ? APP_IMAGES_DIR : (__DIR__ . "/../../imagens");
$dir = rtrim($dir, "/\\");
$folder = trim((string)($_POST["folder"] ?? ""));
$allowed_folders = ["app", "app/geral", "app/personalizacoes", "respostas"];
if (!in_array($folder, $allowed_folders, true)) {
  $folder = "respostas";
}
$dir = $dir . DIRECTORY_SEPARATOR . $folder;
if (!is_dir($dir)) {
  if (!mkdir($dir, 0755, true)) {
    respond(["ok" => false, "error" => "mkdir_failed"], 500);
  }
}

$dest = $dir . DIRECTORY_SEPARATOR . $filename;
if (!move_uploaded_file($tmp, $dest)) {
  respond(["ok" => false, "error" => "move_failed"], 500);
}

$publicName = $folder . "/" . $filename;
respond(["ok" => true, "filename" => $publicName]);

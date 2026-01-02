<?php
declare(strict_types=1);

require_once __DIR__ . "/../config.php";

header("Content-Type: application/json; charset=utf-8");

if (!defined("APP_SESSION_NAME")) {
  http_response_code(500);
  echo json_encode(["ok" => false, "error" => "config_missing"]);
  exit;
}

session_name(APP_SESSION_NAME);
session_start();

function respond(array $data, int $status = 200): void {
  http_response_code($status);
  echo json_encode($data);
  exit;
}

function read_json(): array {
  $raw = file_get_contents("php://input");
  if ($raw === false || trim($raw) === "") {
    return [];
  }
  $decoded = json_decode($raw, true);
  return is_array($decoded) ? $decoded : [];
}

function db(): PDO {
  static $pdo = null;
  if ($pdo instanceof PDO) {
    return $pdo;
  }

  $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
  $options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ];
  $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
  return $pdo;
}

function current_user_id(): ?int {
  if (!isset($_SESSION["user_id"])) {
    return null;
  }
  $val = (int)$_SESSION["user_id"];
  return $val > 0 ? $val : null;
}

function require_login(): int {
  $user_id = current_user_id();
  if (!$user_id) {
    respond(["ok" => false, "error" => "auth_required"], 401);
  }
  return $user_id;
}

function fetch_user(int $user_id): ?array {
  $stmt = db()->prepare("SELECT id, username, display_name FROM users WHERE id = :id LIMIT 1");
  $stmt->execute([":id" => $user_id]);
  $row = $stmt->fetch();
  return $row ? $row : null;
}

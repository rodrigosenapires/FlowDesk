<?php
declare(strict_types=1);

require_once __DIR__ . "/../config.php";

header("Content-Type: application/json; charset=utf-8");

if (!defined("APP_SESSION_NAME")) {
  $status = (defined("APP_DEBUG") && APP_DEBUG) ? 200 : 500;
  http_response_code($status);
  echo json_encode(["ok" => false, "error" => "config_missing"]);
  exit;
}

error_reporting(E_ALL);
ini_set("display_errors", (defined("APP_DEBUG") && APP_DEBUG) ? "1" : "0");
ini_set("log_errors", "1");
$logPath = sys_get_temp_dir() . "/flowdesk_error_log.txt";
ini_set("error_log", $logPath);
set_exception_handler(function (Throwable $err) use ($logPath): void {
  $line = "[" . date("Y-m-d H:i:s") . "] EXCEPTION " . $err->getMessage()
    . " in " . $err->getFile() . ":" . $err->getLine() . "\n";
  @file_put_contents($logPath, $line, FILE_APPEND);
  if (!headers_sent()) {
    $status = (defined("APP_DEBUG") && APP_DEBUG) ? 200 : 500;
    http_response_code($status);
    header("Content-Type: application/json; charset=utf-8");
    $payload = ["ok" => false, "error" => "php_exception"];
    if (defined("APP_DEBUG") && APP_DEBUG) {
      $payload["detail"] = $err->getMessage();
    }
    echo json_encode($payload);
  }
});
register_shutdown_function(function (): void {
  $err = error_get_last();
  if (!$err) {
    return;
  }
  $fatalTypes = [E_ERROR, E_PARSE, E_CORE_ERROR, E_COMPILE_ERROR];
  if (!in_array($err["type"], $fatalTypes, true)) {
    return;
  }
  $logPath = sys_get_temp_dir() . "/flowdesk_error_log.txt";
  $line = "[" . date("Y-m-d H:i:s") . "] FATAL " . $err["message"] . " in " . $err["file"] . ":" . $err["line"] . "\n";
  @file_put_contents($logPath, $line, FILE_APPEND);
  if (headers_sent()) {
    return;
  }
  $status = (defined("APP_DEBUG") && APP_DEBUG) ? 200 : 500;
  http_response_code($status);
  header("Content-Type: application/json; charset=utf-8");
  $payload = ["ok" => false, "error" => "php_fatal"];
  if (defined("APP_DEBUG") && APP_DEBUG) {
    $payload["detail"] = $err["message"] . " in " . $err["file"] . ":" . $err["line"];
  }
  echo json_encode($payload);
});

// Ensure session cookie path matches the app base directory after renames.
$cookiePath = "/";
$scriptName = $_SERVER["SCRIPT_NAME"] ?? "";
if ($scriptName !== "") {
  $dir = str_replace("\\", "/", dirname($scriptName));
  if ($dir !== "/" && substr($dir, -4) === "/api") {
    $dir = substr($dir, 0, -4);
  }
  $dir = $dir === "/" ? "/" : rtrim($dir, "/");
  $cookiePath = $dir === "" ? "/" : $dir;
}
ini_set("session.cookie_path", $cookiePath);
$cookieParams = session_get_cookie_params();
if (PHP_VERSION_ID >= 70300) {
  $cookieParams["path"] = $cookiePath;
  session_set_cookie_params($cookieParams);
} else {
  session_set_cookie_params(
    $cookieParams["lifetime"],
    $cookiePath,
    $cookieParams["domain"],
    $cookieParams["secure"],
    $cookieParams["httponly"]
  );
}

session_name(APP_SESSION_NAME);
session_start();

// Refresh session cookie to ensure the current path is applied after renames.
if (!headers_sent() && session_id() !== "") {
  // Remove any stale session cookie set on "/" so only the scoped path remains.
  setcookie(session_name(), "", time() - 42000, "/");
  $params = session_get_cookie_params();
  $cookie = [
    "expires" => 0,
    "path" => $params["path"] ?? "/",
    "domain" => $params["domain"] ?? "",
    "secure" => $params["secure"] ?? false,
    "httponly" => $params["httponly"] ?? false,
  ];
  if (isset($params["samesite"])) {
    $cookie["samesite"] = $params["samesite"];
  }
  setcookie(session_name(), session_id(), $cookie);
}

if (!function_exists("str_contains")) {
  function str_contains(string $haystack, string $needle): bool {
    if ($needle === "") {
      return true;
    }
    return strpos($haystack, $needle) !== false;
  }
}
if (!function_exists("str_starts_with")) {
  function str_starts_with(string $haystack, string $needle): bool {
    if ($needle === "") {
      return true;
    }
    return strpos($haystack, $needle) === 0;
  }
}
if (!function_exists("str_ends_with")) {
  function str_ends_with(string $haystack, string $needle): bool {
    if ($needle === "") {
      return true;
    }
    $len = strlen($needle);
    if ($len === 0) {
      return true;
    }
    return substr($haystack, -$len) === $needle;
  }
}

function respond(array $data, int $status = 200): void {
  http_response_code($status);
  echo json_encode($data);
  exit;
}

function respond_error(string $code, ?Throwable $err = null): void {
  $payload = ["ok" => false, "error" => $code];
  if (defined("APP_DEBUG") && APP_DEBUG && $err) {
    $payload["detail"] = $err->getMessage();
  }
  $status = (defined("APP_DEBUG") && APP_DEBUG) ? 200 : 500;
  respond($payload, $status);
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

  if (!class_exists("PDO")) {
    respond_error("pdo_missing");
  }
  $drivers = PDO::getAvailableDrivers();
  if (!in_array("mysql", $drivers, true)) {
    respond_error("pdo_mysql_missing");
  }

  $dsn = "mysql:host=" . DB_HOST . ";dbname=" . DB_NAME . ";charset=" . DB_CHARSET;
  $options = [
    PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
    PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
  ];
  try {
    $pdo = new PDO($dsn, DB_USER, DB_PASS, $options);
    return $pdo;
  } catch (Throwable $err) {
    respond_error("db_error", $err);
  }
}

function column_exists(string $table, string $column): bool {
  $stmt = db()->prepare("SHOW COLUMNS FROM `" . $table . "` LIKE :column");
  $stmt->execute([":column" => $column]);
  $row = $stmt->fetch();
  return (bool)$row;
}

function index_exists(string $table, string $index): bool {
  $stmt = db()->prepare("SHOW INDEX FROM `" . $table . "` WHERE Key_name = :index");
  $stmt->execute([":index" => $index]);
  $row = $stmt->fetch();
  return (bool)$row;
}

function ensure_users_schema(): void {
  $updates = [];
  if (!column_exists("users", "email")) {
    $updates[] = "ADD COLUMN email VARCHAR(255) DEFAULT NULL";
  }
  if (!column_exists("users", "email_verified")) {
    $updates[] = "ADD COLUMN email_verified TINYINT(1) NOT NULL DEFAULT 0";
  }
  if (!column_exists("users", "email_verification_token")) {
    $updates[] = "ADD COLUMN email_verification_token VARCHAR(64) DEFAULT NULL";
  }
  if (!column_exists("users", "email_verification_expires_at")) {
    $updates[] = "ADD COLUMN email_verification_expires_at DATETIME DEFAULT NULL";
  }
  if (!column_exists("users", "role")) {
    $updates[] = "ADD COLUMN role VARCHAR(20) NOT NULL DEFAULT 'principal'";
  }
  if (!column_exists("users", "owner_user_id")) {
    $updates[] = "ADD COLUMN owner_user_id INT UNSIGNED DEFAULT NULL";
  }
  if (!column_exists("users", "access_blocked")) {
    $updates[] = "ADD COLUMN access_blocked TINYINT(1) NOT NULL DEFAULT 0";
  }
  if (!column_exists("users", "access_pending")) {
    $updates[] = "ADD COLUMN access_pending TINYINT(1) NOT NULL DEFAULT 0";
  }
  if (!column_exists("users", "password_reset_token")) {
    $updates[] = "ADD COLUMN password_reset_token VARCHAR(64) DEFAULT NULL";
  }
  if (!column_exists("users", "password_reset_expires_at")) {
    $updates[] = "ADD COLUMN password_reset_expires_at DATETIME DEFAULT NULL";
  }
  if ($updates) {
    db()->exec("ALTER TABLE users " . implode(", ", $updates));
  }
  if (!index_exists("users", "users_email_unique")) {
    db()->exec("ALTER TABLE users ADD UNIQUE KEY users_email_unique (email)");
  }
  if (!index_exists("users", "users_owner_user_id_idx")) {
    db()->exec("ALTER TABLE users ADD KEY users_owner_user_id_idx (owner_user_id)");
  }
}

if (!defined("APP_AUTO_MIGRATE") || APP_AUTO_MIGRATE) {
  try {
    ensure_users_schema();
  } catch (Throwable $err) {
    respond_error("db_schema_error", $err);
  }
}

function get_app_base_url(): string {
  if (defined("APP_BASE_URL") && APP_BASE_URL) {
    return rtrim(APP_BASE_URL, "/");
  }
  $scheme = (!empty($_SERVER["HTTPS"]) && $_SERVER["HTTPS"] !== "off") ? "https" : "http";
  $host = $_SERVER["HTTP_HOST"] ?? "";
  if (!$host) {
    return "";
  }
  $script = $_SERVER["SCRIPT_NAME"] ?? "";
  $dir = str_replace("\\", "/", dirname($script));
  $dir = $dir === "/" ? "" : rtrim($dir, "/");
  if ($dir !== "" && str_ends_with($dir, "/api")) {
    $dir = substr($dir, 0, -4);
  }
  return $scheme . "://" . $host . $dir;
}

function encode_mail_header(string $value): string {
  if (function_exists("mb_encode_mimeheader")) {
    return mb_encode_mimeheader($value, "UTF-8", "B", "\r\n");
  }
  return $value;
}

function smtp_read_response($fp): array {
  $data = "";
  while (!feof($fp)) {
    $line = fgets($fp, 515);
    if ($line === false) {
      break;
    }
    $data .= $line;
    if (preg_match("/^\\d{3} /", $line)) {
      break;
    }
  }
  $code = (int)substr(trim($data), 0, 3);
  return [$code, $data];
}

function smtp_send_command($fp, string $command, array $okCodes): bool {
  fwrite($fp, $command . "\r\n");
  [$code] = smtp_read_response($fp);
  return in_array($code, $okCodes, true);
}

function set_smtp_last_error(string $message): void {
  $GLOBALS["SMTP_LAST_ERROR"] = $message;
}

function get_smtp_last_error(): string {
  $val = $GLOBALS["SMTP_LAST_ERROR"] ?? "";
  return is_string($val) ? $val : "";
}

function send_via_smtp(string $from, string $to, string $data): bool {
  set_smtp_last_error("");
  if (!defined("APP_SMTP_HOST") || APP_SMTP_HOST === "") {
    return false;
  }
  $host = APP_SMTP_HOST;
  $port = defined("APP_SMTP_PORT") ? (int)APP_SMTP_PORT : 587;
  $secure = defined("APP_SMTP_SECURE") ? strtolower((string)APP_SMTP_SECURE) : "tls";
  $user = defined("APP_SMTP_USER") ? (string)APP_SMTP_USER : "";
  $pass = defined("APP_SMTP_PASS") ? (string)APP_SMTP_PASS : "";
  $helo = $_SERVER["SERVER_NAME"] ?? "localhost";

  $remote = ($secure === "ssl" ? "ssl://" : "") . $host . ":" . $port;
  $fp = stream_socket_client($remote, $errno, $errstr, 10, STREAM_CLIENT_CONNECT);
  if (!$fp) {
    set_smtp_last_error("connect_failed: " . $errstr . " (" . $errno . ")");
    return false;
  }
  stream_set_timeout($fp, 10);
  [$code, $raw] = smtp_read_response($fp);
  if ($code !== 220) {
    set_smtp_last_error("connect_unexpected: " . trim($raw));
    fclose($fp);
    return false;
  }
  if (!smtp_send_command($fp, "EHLO " . $helo, [250])) {
    set_smtp_last_error("ehlo_failed");
    fclose($fp);
    return false;
  }
  if ($secure === "tls") {
    if (!smtp_send_command($fp, "STARTTLS", [220])) {
      set_smtp_last_error("starttls_failed");
      fclose($fp);
      return false;
    }
    if (!stream_socket_enable_crypto($fp, true, STREAM_CRYPTO_METHOD_TLS_CLIENT)) {
      set_smtp_last_error("tls_handshake_failed");
      fclose($fp);
      return false;
    }
    if (!smtp_send_command($fp, "EHLO " . $helo, [250])) {
      set_smtp_last_error("ehlo_after_tls_failed");
      fclose($fp);
      return false;
    }
  }
  if ($user !== "" && $pass !== "") {
    if (!smtp_send_command($fp, "AUTH LOGIN", [334])) {
      set_smtp_last_error("auth_login_failed");
      fclose($fp);
      return false;
    }
    if (!smtp_send_command($fp, base64_encode($user), [334])) {
      set_smtp_last_error("auth_user_failed");
      fclose($fp);
      return false;
    }
    if (!smtp_send_command($fp, base64_encode($pass), [235])) {
      set_smtp_last_error("auth_pass_failed");
      fclose($fp);
      return false;
    }
  }
  if (!smtp_send_command($fp, "MAIL FROM:<" . $from . ">", [250])) {
    set_smtp_last_error("mail_from_failed");
    fclose($fp);
    return false;
  }
  if (!smtp_send_command($fp, "RCPT TO:<" . $to . ">", [250, 251])) {
    set_smtp_last_error("rcpt_to_failed");
    fclose($fp);
    return false;
  }
  if (!smtp_send_command($fp, "DATA", [354])) {
    set_smtp_last_error("data_cmd_failed");
    fclose($fp);
    return false;
  }

  $lines = preg_split("/\\r\\n|\\n|\\r/", $data);
  $safeLines = [];
  foreach ($lines as $line) {
    $safeLines[] = str_starts_with($line, ".") ? ("." . $line) : $line;
  }
  $payload = implode("\r\n", $safeLines);
  fwrite($fp, $payload . "\r\n.\r\n");
  [$dataCode, $dataRaw] = smtp_read_response($fp);
  smtp_send_command($fp, "QUIT", [221, 250]);
  fclose($fp);
  if ($dataCode !== 250) {
    set_smtp_last_error("data_rejected: " . trim($dataRaw));
    return false;
  }
  return true;
}

function send_verification_email(string $email, string $token): bool {
  $base = get_app_base_url();
  $link = $base ? ($base . "/confirm_email.php?token=" . urlencode($token)) : "";
  $logo = $base ? ($base . "/Extras/logo/logo-fundo-claro.png") : "";
  $hostRaw = $_SERVER["HTTP_HOST"] ?? "localhost";
  $host = preg_replace("/:\\d+$/", "", $hostRaw);
  $from = defined("APP_MAIL_FROM") && APP_MAIL_FROM ? APP_MAIL_FROM : ("no-reply@" . $host);
  $fromName = defined("APP_MAIL_FROM_NAME") && APP_MAIL_FROM_NAME ? APP_MAIL_FROM_NAME : "FlowDesk";
  $subjectRaw = "Confirme seu e-mail para acessar o FlowDesk";
  $subject = encode_mail_header($subjectRaw);
  $plain = "Ola!\n\nRecebemos seu cadastro no FlowDesk.\n\nConfirme seu e-mail para liberar o acesso:\n" . $link . "\n\nSe voce nao solicitou este cadastro, ignore esta mensagem.\n\nEquipe FlowDesk";

  $html = '<!doctype html><html lang="pt-br"><head><meta charset="utf-8" />'
    . '<meta name="viewport" content="width=device-width, initial-scale=1" />'
    . '<title>Confirmacao de e-mail</title></head>'
    . '<body style="margin:0;padding:0;background:#0b1220;color:#e9eef7;font-family:Arial,sans-serif;">'
    . '<div style="max-width:560px;margin:0 auto;padding:32px 20px;">'
    . '<div style="background:#0f1b2e;border:1px solid #20324f;border-radius:16px;padding:28px 24px;">'
    . ($logo ? '<div style="text-align:center;margin-bottom:18px;"><img src="' . htmlspecialchars($logo, ENT_QUOTES, "UTF-8") . '" alt="FlowDesk" style="max-width:160px;height:auto;" /></div>' : '')
    . '<h2 style="margin:0 0 10px;font-size:20px;">Confirme seu e-mail</h2>'
    . '<p style="margin:0 0 16px;line-height:1.5;color:#c5d2e8;">Recebemos seu cadastro no FlowDesk. Para liberar o acesso, confirme seu e-mail.</p>'
    . '<div style="text-align:center;margin:22px 0;">'
    . '<a href="' . htmlspecialchars($link, ENT_QUOTES, "UTF-8") . '" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#7c8cff;color:#0b1220;text-decoration:none;font-weight:bold;">Confirmar e-mail</a>'
    . '</div>'
    . '<p style="margin:0;color:#9fb0c8;font-size:12px;line-height:1.4;">Se voce nao solicitou este cadastro, ignore esta mensagem.</p>'
    . '</div>'
    . '<div style="text-align:center;color:#7b8aa6;font-size:12px;margin-top:12px;">Equipe FlowDesk</div>'
    . '</div></body></html>';

  $boundary = "flowdesk_" . bin2hex(random_bytes(12));
  $messageId = "<" . bin2hex(random_bytes(16)) . "@" . $host . ">";
  $explicitFrom = (defined("APP_MAIL_FROM") && APP_MAIL_FROM);
  $headers = [
    "From: " . encode_mail_header($fromName) . " <" . $from . ">",
    "Reply-To: " . $from,
    "MIME-Version: 1.0",
    "Date: " . gmdate("D, d M Y H:i:s") . " +0000",
    "Message-ID: " . $messageId,
    "X-Mailer: PHP/" . PHP_VERSION,
    "Content-Type: multipart/alternative; boundary=\"" . $boundary . "\"",
  ];
  $body = "--" . $boundary . "\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: 8bit\r\n\r\n"
    . $plain . "\r\n\r\n"
    . "--" . $boundary . "\r\n"
    . "Content-Type: text/html; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: 8bit\r\n\r\n"
    . $html . "\r\n\r\n"
    . "--" . $boundary . "--";

  $params = "";
  if ($explicitFrom && $from && str_contains($from, "@")) {
    $params = "-f" . $from;
  }
  $headersStr = implode("\r\n", $headers);
  $smtpData = "To: " . $email . "\r\n"
    . "Subject: " . $subject . "\r\n"
    . $headersStr . "\r\n\r\n"
    . $body;
  if (defined("APP_SMTP_HOST") && APP_SMTP_HOST !== "" && str_contains($from, "@")) {
    $smtpOk = send_via_smtp($from, $email, $smtpData);
    return $smtpOk;
  }
  $ok = $params
    ? mail($email, $subject, $body, $headersStr, $params)
    : mail($email, $subject, $body, $headersStr);
  if (!$ok && $plain) {
    $fallbackHeaders = [
      "From: " . encode_mail_header($fromName) . " <" . $from . ">",
      "Reply-To: " . $from,
      "Message-ID: " . $messageId,
      "X-Mailer: PHP/" . PHP_VERSION,
      "Content-Type: text/plain; charset=UTF-8",
    ];
    return $params
      ? mail($email, $subject, $plain, implode("\r\n", $fallbackHeaders), $params)
      : mail($email, $subject, $plain, implode("\r\n", $fallbackHeaders));
  }
  return $ok;
}

function send_password_reset_email(string $email, string $token): bool {
  $base = get_app_base_url();
  $link = $base ? ($base . "/?reset=" . urlencode($token)) : "";
  $logo = $base ? ($base . "/Extras/logo/logo-fundo-claro.png") : "";
  $hostRaw = $_SERVER["HTTP_HOST"] ?? "localhost";
  $host = preg_replace("/:\\d+$/", "", $hostRaw);
  $from = defined("APP_MAIL_FROM") && APP_MAIL_FROM ? APP_MAIL_FROM : ("no-reply@" . $host);
  $fromName = defined("APP_MAIL_FROM_NAME") && APP_MAIL_FROM_NAME ? APP_MAIL_FROM_NAME : "FlowDesk";
  $subjectRaw = "Redefinir senha do FlowDesk";
  $subject = encode_mail_header($subjectRaw);
  $plain = "Ola!\n\nRecebemos um pedido para redefinir sua senha.\n\nClique no link para criar uma nova senha:\n"
    . $link . "\n\nSe voce nao solicitou, ignore este e-mail.\n\nEquipe FlowDesk";

  $html = '<!doctype html><html lang="pt-br"><head><meta charset="utf-8" />'
    . '<meta name="viewport" content="width=device-width, initial-scale=1" />'
    . '<title>Redefinir senha</title></head>'
    . '<body style="margin:0;padding:0;background:#0b1220;color:#e9eef7;font-family:Arial,sans-serif;">'
    . '<div style="max-width:560px;margin:0 auto;padding:32px 20px;">'
    . '<div style="background:#0f1b2e;border:1px solid #20324f;border-radius:16px;padding:28px 24px;">'
    . ($logo ? '<div style="text-align:center;margin-bottom:18px;"><img src="' . htmlspecialchars($logo, ENT_QUOTES, "UTF-8") . '" alt="FlowDesk" style="max-width:160px;height:auto;" /></div>' : '')
    . '<h2 style="margin:0 0 10px;font-size:20px;">Redefinir senha</h2>'
    . '<p style="margin:0 0 16px;line-height:1.5;color:#c5d2e8;">Recebemos um pedido para redefinir sua senha.</p>'
    . '<div style="text-align:center;margin:22px 0;">'
    . '<a href="' . htmlspecialchars($link, ENT_QUOTES, "UTF-8") . '" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#7c8cff;color:#0b1220;text-decoration:none;font-weight:bold;">Criar nova senha</a>'
    . '</div>'
    . '<p style="margin:0;color:#9fb0c8;font-size:12px;line-height:1.4;">Se voce nao solicitou, ignore este e-mail.</p>'
    . '</div>'
    . '<div style="text-align:center;color:#7b8aa6;font-size:12px;margin-top:12px;">Equipe FlowDesk</div>'
    . '</div></body></html>';

  $boundary = "flowdesk_" . bin2hex(random_bytes(12));
  $messageId = "<" . bin2hex(random_bytes(16)) . "@" . $host . ">";
  $explicitFrom = (defined("APP_MAIL_FROM") && APP_MAIL_FROM);
  $headers = [
    "From: " . encode_mail_header($fromName) . " <" . $from . ">",
    "Reply-To: " . $from,
    "MIME-Version: 1.0",
    "Date: " . gmdate("D, d M Y H:i:s") . " +0000",
    "Message-ID: " . $messageId,
    "X-Mailer: PHP/" . PHP_VERSION,
    "Content-Type: multipart/alternative; boundary=\"" . $boundary . "\"",
  ];
  $body = "--" . $boundary . "\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: 8bit\r\n\r\n"
    . $plain . "\r\n\r\n"
    . "--" . $boundary . "\r\n"
    . "Content-Type: text/html; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: 8bit\r\n\r\n"
    . $html . "\r\n\r\n"
    . "--" . $boundary . "--";

  $params = "";
  if ($explicitFrom && $from && str_contains($from, "@")) {
    $params = "-f" . $from;
  }
  $headersStr = implode("\r\n", $headers);
  $smtpData = "To: " . $email . "\r\n"
    . "Subject: " . $subject . "\r\n"
    . $headersStr . "\r\n\r\n"
    . $body;
  if (defined("APP_SMTP_HOST") && APP_SMTP_HOST !== "" && str_contains($from, "@")) {
    return send_via_smtp($from, $email, $smtpData);
  }
  $ok = $params
    ? mail($email, $subject, $body, $headersStr, $params)
    : mail($email, $subject, $body, $headersStr);
  if (!$ok && $plain) {
    $fallbackHeaders = [
      "From: " . encode_mail_header($fromName) . " <" . $from . ">",
      "Reply-To: " . $from,
      "Message-ID: " . $messageId,
      "X-Mailer: PHP/" . PHP_VERSION,
      "Content-Type: text/plain; charset=UTF-8",
    ];
    return $params
      ? mail($email, $subject, $plain, implode("\r\n", $fallbackHeaders), $params)
      : mail($email, $subject, $plain, implode("\r\n", $fallbackHeaders));
  }
  return $ok;
}

function send_personalizacao_notification(string $email, array $payload): bool {
  if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
    return false;
  }
  $storeName = (string)($payload["store_name"] ?? "");
  $customerName = (string)($payload["customer_name"] ?? "");
  $sentAt = (string)($payload["sent_at"] ?? "");
  $link = (string)($payload["link"] ?? "");

  $hostRaw = $_SERVER["HTTP_HOST"] ?? "localhost";
  $host = preg_replace("/:\\d+$/", "", $hostRaw);
  $from = defined("APP_MAIL_FROM") && APP_MAIL_FROM ? APP_MAIL_FROM : ("no-reply@" . $host);
  $fromName = defined("APP_MAIL_FROM_NAME") && APP_MAIL_FROM_NAME ? APP_MAIL_FROM_NAME : "FlowDesk";
  $subjectRaw = "Nova personalizacao recebida";
  if ($storeName !== "") {
    $subjectRaw .= " - " . $storeName;
  }
  $subject = encode_mail_header($subjectRaw);

  $plain = "Ola!\n\nChegou uma nova personalizacao no FlowDesk.\n";
  if ($storeName !== "") $plain .= "Loja: " . $storeName . "\n";
  if ($customerName !== "") $plain .= "Cliente: " . $customerName . "\n";
  if ($sentAt !== "") $plain .= "Enviado em: " . $sentAt . "\n";
  if ($link !== "") $plain .= "\nAbrir personalizacoes: " . $link . "\n";
  $plain .= "\nEquipe FlowDesk";

  $html = '<!doctype html><html lang="pt-br"><head><meta charset="utf-8" />'
    . '<meta name="viewport" content="width=device-width, initial-scale=1" />'
    . '<title>Nova personalizacao</title></head>'
    . '<body style="margin:0;padding:0;background:#0b1220;color:#e9eef7;font-family:Arial,sans-serif;">'
    . '<div style="max-width:560px;margin:0 auto;padding:32px 20px;">'
    . '<div style="background:#0f1b2e;border:1px solid #20324f;border-radius:16px;padding:28px 24px;">'
    . '<h2 style="margin:0 0 10px;font-size:20px;">Nova personalizacao recebida</h2>'
    . '<p style="margin:0 0 16px;line-height:1.5;color:#c5d2e8;">Chegou uma nova personalizacao no FlowDesk.</p>';
  if ($storeName !== "") {
    $html .= '<p style="margin:0 0 8px;line-height:1.5;color:#c5d2e8;"><b>Loja:</b> ' . htmlspecialchars($storeName, ENT_QUOTES, "UTF-8") . '</p>';
  }
  if ($customerName !== "") {
    $html .= '<p style="margin:0 0 8px;line-height:1.5;color:#c5d2e8;"><b>Cliente:</b> ' . htmlspecialchars($customerName, ENT_QUOTES, "UTF-8") . '</p>';
  }
  if ($sentAt !== "") {
    $html .= '<p style="margin:0 0 12px;line-height:1.5;color:#c5d2e8;"><b>Enviado em:</b> ' . htmlspecialchars($sentAt, ENT_QUOTES, "UTF-8") . '</p>';
  }
  if ($link !== "") {
    $html .= '<div style="text-align:center;margin:22px 0;">'
      . '<a href="' . htmlspecialchars($link, ENT_QUOTES, "UTF-8") . '" style="display:inline-block;padding:12px 18px;border-radius:10px;background:#7c8cff;color:#0b1220;text-decoration:none;font-weight:bold;">Abrir personalizacoes</a>'
      . '</div>';
  }
  $html .= '</div>'
    . '<div style="text-align:center;color:#7b8aa6;font-size:12px;margin-top:12px;">Equipe FlowDesk</div>'
    . '</div></body></html>';

  $boundary = "flowdesk_" . bin2hex(random_bytes(12));
  $messageId = "<" . bin2hex(random_bytes(16)) . "@" . $host . ">";
  $explicitFrom = (defined("APP_MAIL_FROM") && APP_MAIL_FROM);
  $headers = [
    "From: " . encode_mail_header($fromName) . " <" . $from . ">",
    "Reply-To: " . $from,
    "MIME-Version: 1.0",
    "Date: " . gmdate("D, d M Y H:i:s") . " +0000",
    "Message-ID: " . $messageId,
    "X-Mailer: PHP/" . PHP_VERSION,
    "Content-Type: multipart/alternative; boundary=\"" . $boundary . "\"",
  ];
  $body = "--" . $boundary . "\r\n"
    . "Content-Type: text/plain; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: 8bit\r\n\r\n"
    . $plain . "\r\n\r\n"
    . "--" . $boundary . "\r\n"
    . "Content-Type: text/html; charset=UTF-8\r\n"
    . "Content-Transfer-Encoding: 8bit\r\n\r\n"
    . $html . "\r\n\r\n"
    . "--" . $boundary . "--";

  $params = "";
  if ($explicitFrom && $from && str_contains($from, "@")) {
    $params = "-f" . $from;
  }
  $headersStr = implode("\r\n", $headers);
  $smtpData = "To: " . $email . "\r\n"
    . "Subject: " . $subject . "\r\n"
    . $headersStr . "\r\n\r\n"
    . $body;
  if (defined("APP_SMTP_HOST") && APP_SMTP_HOST !== "" && str_contains($from, "@")) {
    return send_via_smtp($from, $email, $smtpData);
  }
  $ok = $params
    ? mail($email, $subject, $body, $headersStr, $params)
    : mail($email, $subject, $body, $headersStr);
  if (!$ok && $plain) {
    $fallbackHeaders = [
      "From: " . encode_mail_header($fromName) . " <" . $from . ">",
      "Reply-To: " . $from,
      "Message-ID: " . $messageId,
      "X-Mailer: PHP/" . PHP_VERSION,
      "Content-Type: text/plain; charset=UTF-8",
    ];
    return $params
      ? mail($email, $subject, $plain, implode("\r\n", $fallbackHeaders), $params)
      : mail($email, $subject, $plain, implode("\r\n", $fallbackHeaders));
  }
  return $ok;
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
  $stmt = db()->prepare("SELECT id, username, display_name, role, owner_user_id FROM users WHERE id = :id LIMIT 1");
  $stmt->execute([":id" => $user_id]);
  $row = $stmt->fetch();
  return $row ? $row : null;
}

function normalize_user_role(?string $role): string {
  $raw = strtolower((string)$role);
  return $raw === "secundario" ? "secundario" : "principal";
}

function is_admin_user(?array $user): bool {
  if (!$user || empty($user["username"])) {
    return false;
  }
  $admin = defined("APP_ADMIN_USERNAME") ? (string)APP_ADMIN_USERNAME : "";
  $username = strtolower(trim((string)$user["username"]));
  $adminName = strtolower(trim((string)$admin));
  if ($adminName !== "" && $username === $adminName) {
    return true;
  }
  $displayName = strtolower(trim((string)($user["display_name"] ?? "")));
  $adminDisplay = defined("APP_ADMIN_DISPLAY_NAME") ? strtolower(trim((string)APP_ADMIN_DISPLAY_NAME)) : "";
  if ($adminDisplay !== "" && $displayName !== "" && $displayName === $adminDisplay) {
    return true;
  }
  $adminId = defined("APP_ADMIN_USER_ID") ? (int)APP_ADMIN_USER_ID : 0;
  if ($adminId > 0) {
    return (int)$user["id"] === $adminId;
  }
  return false;
}

function is_principal_user(?array $user): bool {
  if (!$user) return false;
  return normalize_user_role($user["role"] ?? null) !== "secundario";
}

function get_account_owner_id(?array $user): int {
  if (!$user || empty($user["id"])) {
    return 0;
  }
  $role = normalize_user_role($user["role"] ?? null);
  if ($role === "secundario") {
    $owner = (int)($user["owner_user_id"] ?? 0);
    if ($owner > 0) return $owner;
  }
  return (int)$user["id"];
}

function can_manage_secondary(?array $current, ?array $target): bool {
  if (!$current || !$target) return false;
  if (is_admin_user($current)) return true;
  if (!is_principal_user($current)) return false;
  if (normalize_user_role($target["role"] ?? null) !== "secundario") return false;
  return (int)($target["owner_user_id"] ?? 0) === (int)$current["id"];
}

function set_user_storage_value(int $user_id, string $key, string $value): void {
  $stmt = db()->prepare(
    "INSERT INTO user_storage (user_id, storage_key, storage_value, updated_at)
     VALUES (:user_id, :key, :value, NOW())
     ON DUPLICATE KEY UPDATE storage_value = VALUES(storage_value), updated_at = NOW()"
  );
  $stmt->execute([
    ":user_id" => $user_id,
    ":key" => $key,
    ":value" => $value,
  ]);
}

function get_user_storage_value(int $user_id, string $key): ?string {
  $stmt = db()->prepare(
    "SELECT storage_value FROM user_storage WHERE user_id = :user_id AND storage_key = :key LIMIT 1"
  );
  $stmt->execute([
    ":user_id" => $user_id,
    ":key" => $key,
  ]);
  $row = $stmt->fetch();
  return $row ? (string)$row["storage_value"] : null;
}

function update_last_active(): void {
  $user_id = current_user_id();
  if (!$user_id) {
    return;
  }
  $user = fetch_user($user_id);
  if (!$user) {
    unset($_SESSION["user_id"]);
    return;
  }
  $now = time();
  $lastPing = isset($_SESSION["last_active_ping"]) ? (int)$_SESSION["last_active_ping"] : 0;
  if ($lastPing > 0 && ($now - $lastPing) < 60) {
    return;
  }
  set_user_storage_value($user_id, "last_active_at", (string)$now);
  $_SESSION["last_active_ping"] = $now;

  $lastLogPing = isset($_SESSION["last_activity_log_ts"]) ? (int)$_SESSION["last_activity_log_ts"] : 0;
  if ($lastLogPing > 0 && ($now - $lastLogPing) < 120) {
    return;
  }
  $raw = get_user_storage_value($user_id, "activity_log");
  $log = [];
  if ($raw) {
    $decoded = json_decode($raw, true);
    if (is_array($decoded)) {
      $log = $decoded;
    }
  }
  $last = 0;
  if ($log) {
    $last = (int)$log[count($log) - 1];
  }
  if ($last !== $now) {
    $log[] = $now;
  }
  $cutoff = $now - (90 * 86400);
  $log = array_values(array_filter($log, function($ts) use ($cutoff) {
    return ((int)$ts) >= $cutoff;
  }));
  if (count($log) > 1000) {
    $log = array_slice($log, -1000);
  }
  set_user_storage_value($user_id, "activity_log", json_encode($log));
  $_SESSION["last_activity_log_ts"] = $now;
}

update_last_active();



<?php
// Do not allow direct access to this file from the browser.
if (php_sapi_name() !== "cli" && basename(__FILE__) === basename($_SERVER["SCRIPT_FILENAME"])) {
  http_response_code(403);
  exit;
}

// Database settings (fill these after creating the MySQL database).
$appHost = strtolower((string)($_SERVER["HTTP_HOST"] ?? $_SERVER["SERVER_NAME"] ?? ""));
$isLocal = ($appHost === "localhost" || $appHost === "127.0.0.1" || str_ends_with($appHost, ".localhost"));
define("DB_HOST", "127.0.0.1");
define("DB_NAME", $isLocal ? "u748231595_flowdesk" : "u748231595_Flowdesk");
define("DB_USER", $isLocal ? "root" : "u748231595_Flowdesk");
define("DB_PASS", $isLocal ? "" : "Rs@252534");
define("DB_CHARSET", "utf8mb4");

// Session settings.
define("APP_SESSION_NAME", "flowdesk_session");
define("APP_DEBUG", true);
define("APP_AUTO_MIGRATE", false);
define("APP_ADMIN_USERNAME", "Rodrigosp");
define("APP_ADMIN_USER_ID", 1);
define("APP_ADMIN_DISPLAY_NAME", "Rodrigo");

// Email settings.
define("APP_BASE_URL", "");
define("APP_MAIL_FROM", "rodrigosenamkt@gmail.com");
define("APP_MAIL_FROM_NAME", "FlowDesk");
define("APP_SMTP_HOST", "smtp.gmail.com");
define("APP_SMTP_PORT", 587);
define("APP_SMTP_USER", "rodrigosenamkt@gmail.com");
define("APP_SMTP_PASS", "lcmbpulmmtbiegfk");
define("APP_SMTP_SECURE", "tls"); // tls, ssl, or none

// Upload settings.
define("APP_PUBLIC_ROOT", realpath(__DIR__) ?: __DIR__);
define("APP_IMAGES_DIR", APP_PUBLIC_ROOT . "/imagens");

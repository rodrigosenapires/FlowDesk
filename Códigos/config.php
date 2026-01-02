<?php
// Do not allow direct access to this file from the browser.
if (php_sapi_name() !== "cli" && basename(__FILE__) === basename($_SERVER["SCRIPT_FILENAME"])) {
  http_response_code(403);
  exit;
}

// Database settings (fill these after creating the MySQL database).
define("DB_HOST", "127.0.0.1");
define("DB_NAME", "u748231595_Flowdesk");
define("DB_USER", "u748231595_Flowdesk");
define("DB_PASS", "Rs@252534");
define("DB_CHARSET", "utf8mb4");

// Session settings.
define("APP_SESSION_NAME", "flowdesk_session");

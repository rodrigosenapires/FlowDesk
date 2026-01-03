<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

require_login();
respond(["ok" => true]);

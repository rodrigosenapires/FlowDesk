<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

header("Cache-Control: no-store, no-cache, must-revalidate, max-age=0");
header("Pragma: no-cache");
header("Expires: 0");

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

$a = random_int(1, 9);
$b = random_int(1, 9);
$_SESSION["captcha_answer"] = (string)($a + $b);
$_SESSION["captcha_ts"] = time();

respond([
  "ok" => true,
  "question" => "Quanto e " . $a . " + " . $b . "?"
]);

<?php
declare(strict_types=1);

require_once __DIR__ . "/_init.php";

if (php_sapi_name() !== "cli" && !defined("REPORT_WEB_TRIGGER")) {
  respond(["ok" => false, "error" => "cli_only"], 403);
}

date_default_timezone_set("America/Sao_Paulo");

const STORAGE_KEY_STORES = "stores_v1";
const STORAGE_KEY_TASKS = "tarefasDiarias_v1";
const STORAGE_KEY_TASKS_DONE = "tarefasDiarias_concluidas_v1";
const REPORT_SENDER_EMAIL = "rodrigosenamkt@gmail.com";

function parse_date_time(string $value): ?DateTimeImmutable {
  $raw = trim($value);
  if ($raw === "") return null;
  try {
    if (preg_match('/^\d{4}-\d{2}-\d{2}$/', $raw)) {
      return new DateTimeImmutable($raw . "T00:00:00");
    }
    return new DateTimeImmutable($raw);
  } catch (Throwable $e) {
    return null;
  }
}

function format_duration(int $seconds): string {
  $seconds = max(0, $seconds);
  $hours = intdiv($seconds, 3600);
  $mins = intdiv($seconds % 3600, 60);
  return sprintf("%02dh %02dm", $hours, $mins);
}

function format_time(int $ts, DateTimeZone $tz): string {
  if ($ts <= 0) return "-";
  return (new DateTimeImmutable("@".$ts))->setTimezone($tz)->format("H:i");
}

function format_datetime(int $ts, DateTimeZone $tz): string {
  if ($ts <= 0) return "-";
  return (new DateTimeImmutable("@".$ts))->setTimezone($tz)->format("d/m/Y H:i");
}

function limit_periods(array $periods, int $limit): array {
  if (count($periods) <= $limit) {
    return [$periods, 0];
  }
  return [array_slice($periods, 0, $limit), count($periods) - $limit];
}

function is_in_range(?DateTimeImmutable $dt, DateTimeImmutable $start, DateTimeImmutable $end): bool {
  if (!$dt) return false;
  return $dt >= $start && $dt <= $end;
}

function normalize_store_name(string $name): string {
  $raw = trim($name);
  if ($raw === "") return "";
  if (preg_match('/Ã.|Â./u', $raw)) {
    $fixed = @iconv("ISO-8859-1", "UTF-8//IGNORE", $raw);
    if (is_string($fixed) && $fixed !== "") {
      return trim($fixed);
    }
  }
  return $raw;
}

function to_pdf_encoding(string $text): string {
  if (function_exists("iconv")) {
    $converted = @iconv("UTF-8", "Windows-1252//TRANSLIT", $text);
    if (is_string($converted) && $converted !== "") {
      return $converted;
    }
  }
  return $text;
}

function escape_pdf_text(string $text): string {
  $encoded = to_pdf_encoding($text);
  $out = str_replace(["\\", "(", ")"], ["\\\\", "\\(", "\\)"], $encoded);
  $out = str_replace(["\r", "\n"], " ", $out);
  return $out;
}

function wrap_pdf_line(string $text, int $maxLen = 90): array {
  $text = trim($text);
  if ($text === "") return [""];
  $words = preg_split('/\s+/', $text);
  $lines = [];
  $current = "";
  foreach ($words as $word) {
    $next = $current === "" ? $word : ($current . " " . $word);
    if (strlen($next) > $maxLen && $current !== "") {
      $lines[] = $current;
      $current = $word;
      continue;
    }
    $current = $next;
  }
  if ($current !== "") $lines[] = $current;
  return $lines;
}

function wrap_pdf_lines(array $lines, int $maxLen = 90): array {
  $out = [];
  foreach ($lines as $line) {
    $raw = (string)$line;
    if ($raw === "") {
      $out[] = "";
      continue;
    }
    if (preg_match('/^(\s*)(.*)$/', $raw, $m)) {
      $indent = $m[1];
      $text = $m[2];
    } else {
      $indent = "";
      $text = $raw;
    }
    if ($text === "") {
      $out[] = $raw;
      continue;
    }
    $limit = max(20, $maxLen - strlen($indent));
    $wrapped = wrap_pdf_line($text, $limit);
    foreach ($wrapped as $idx => $wrappedLine) {
      $out[] = $indent . $wrappedLine;
    }
  }
  return $out;
}

function build_pdf_entries(array $lines): array {
  $entries = [];
  foreach ($lines as $line) {
    $raw = (string)$line;
    if ($raw === "%%DIV%%") {
      $entries[] = ["divider" => true];
      continue;
    }
    $bold = false;
    if (strpos($raw, "%%B%% ") === 0) {
      $bold = true;
      $raw = substr($raw, 6);
    }
    $entries[] = [
      "text" => $raw,
      "bold" => $bold,
      "divider" => false,
    ];
  }
  return $entries;
}

function wrap_pdf_entries(array $entries, int $maxLen = 90): array {
  $out = [];
  foreach ($entries as $entry) {
    if (!empty($entry["divider"])) {
      $out[] = $entry;
      continue;
    }
    $text = (string)($entry["text"] ?? "");
    $bold = !empty($entry["bold"]);
    if ($text === "") {
      $out[] = ["text" => "", "bold" => $bold, "divider" => false];
      continue;
    }
    if (preg_match('/^(\s*)(.*)$/', $text, $m)) {
      $indent = $m[1];
      $body = $m[2];
    } else {
      $indent = "";
      $body = $text;
    }
    if ($body === "") {
      $out[] = ["text" => $text, "bold" => $bold, "divider" => false];
      continue;
    }
    $limit = max(20, $maxLen - strlen($indent));
    $wrapped = wrap_pdf_line($body, $limit);
    foreach ($wrapped as $wrappedLine) {
      $out[] = ["text" => $indent . $wrappedLine, "bold" => $bold, "divider" => false];
    }
  }
  return $out;
}

function build_simple_pdf(string $title, array $lines): string {
  $entries = wrap_pdf_entries(build_pdf_entries($lines), 90);
  $x = 50;
  $y = 800;
  $lineHeight = 14;
  $content = "BT\n/F2 16 Tf 1 0 0 1 " . $x . " " . $y . " Tm (" . escape_pdf_text($title) . ") Tj\nET\n";
  $y = 780;
  foreach ($entries as $entry) {
    if (!empty($entry["divider"])) {
      $y -= 6;
      $lineY = $y;
      $content .= "q\n0.5 w 0.8 G\n" . $x . " " . $lineY . " m 545 " . $lineY . " l S\nQ\n";
      $y -= 8;
      continue;
    }
    $text = (string)($entry["text"] ?? "");
    $font = !empty($entry["bold"]) ? "F2" : "F1";
    $content .= "BT\n/" . $font . " 11 Tf 1 0 0 1 " . $x . " " . $y . " Tm (" . escape_pdf_text($text) . ") Tj\nET\n";
    $y -= $lineHeight;
  }

  $objects = [];
  $objects[] = "1 0 obj << /Type /Catalog /Pages 2 0 R >> endobj\n";
  $objects[] = "2 0 obj << /Type /Pages /Kids [3 0 R] /Count 1 >> endobj\n";
  $objects[] = "3 0 obj << /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >> endobj\n";
  $objects[] = "4 0 obj << /Length " . strlen($content) . " >> stream\n" . $content . "endstream endobj\n";
  $objects[] = "5 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >> endobj\n";
  $objects[] = "6 0 obj << /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >> endobj\n";

  $pdf = "%PDF-1.4\n";
  $offsets = [];
  foreach ($objects as $obj) {
    $offsets[] = strlen($pdf);
    $pdf .= $obj;
  }
  $xref = strlen($pdf);
  $pdf .= "xref\n0 " . (count($objects) + 1) . "\n";
  $pdf .= "0000000000 65535 f \n";
  foreach ($offsets as $off) {
    $pdf .= str_pad((string)$off, 10, "0", STR_PAD_LEFT) . " 00000 n \n";
  }
  $pdf .= "trailer << /Size " . (count($objects) + 1) . " /Root 1 0 R >>\n";
  $pdf .= "startxref\n" . $xref . "\n%%EOF";
  return $pdf;
}

function send_report_email(string $to, string $subject, string $body, string $pdf, string $filename, ?string &$errorOut = null): bool {
  $errorOut = null;
  $from = (defined("APP_MAIL_FROM") && APP_MAIL_FROM) ? APP_MAIL_FROM : REPORT_SENDER_EMAIL;
  $fromName = (defined("APP_MAIL_FROM_NAME") && APP_MAIL_FROM_NAME) ? APP_MAIL_FROM_NAME : "FlowDesk";
  $subjectEncoded = encode_mail_header($subject);
  $boundary = "flowdesk_" . md5((string)microtime(true));
  $headers = [];
  $headers[] = "From: " . encode_mail_header($fromName) . " <" . $from . ">";
  $headers[] = "MIME-Version: 1.0";
  $headers[] = "Content-Type: multipart/mixed; boundary=\"" . $boundary . "\"";

  $message = "--" . $boundary . "\r\n";
  $message .= "Content-Type: text/plain; charset=UTF-8\r\n";
  $message .= "Content-Transfer-Encoding: 8bit\r\n\r\n";
  $message .= $body . "\r\n";

  $message .= "--" . $boundary . "\r\n";
  $message .= "Content-Type: application/pdf; name=\"" . $filename . "\"\r\n";
  $message .= "Content-Transfer-Encoding: base64\r\n";
  $message .= "Content-Disposition: attachment; filename=\"" . $filename . "\"\r\n\r\n";
  $message .= chunk_split(base64_encode($pdf)) . "\r\n";
  $message .= "--" . $boundary . "--";

  $headersStr = implode("\r\n", $headers);
  $smtpData = "To: " . $to . "\r\n"
    . "Subject: " . $subjectEncoded . "\r\n"
    . $headersStr . "\r\n\r\n"
    . $message;
  if (defined("APP_SMTP_HOST") && APP_SMTP_HOST !== "" && str_contains($from, "@")) {
    $smtpOk = send_via_smtp($from, $to, $smtpData);
    if (!$smtpOk) {
      $errorOut = get_smtp_last_error() ?: "smtp_failed";
    }
    return $smtpOk;
  }
  $prevError = error_get_last();
  $ok = @mail($to, $subjectEncoded, $message, $headersStr);
  $err = error_get_last();
  if (!$ok) {
    if ($err && $err !== $prevError) {
      $errorOut = (string)($err["message"] ?? "mail_failed");
    } else {
      $errorOut = "mail_failed";
    }
  }
  return $ok;
}

function load_json_storage(int $userId, string $key): array {
  $raw = get_user_storage_value($userId, $key);
  if (!$raw) return [];
  $decoded = json_decode($raw, true);
  return is_array($decoded) ? $decoded : [];
}

function get_primary_email(array $store): string {
  if (!empty($store["emailList"]) && is_array($store["emailList"])) {
    foreach ($store["emailList"] as $entry) {
      $email = trim((string)($entry["email"] ?? ""));
      if ($email !== "") return $email;
    }
  }
  return "";
}

function get_user_map(int $ownerId): array {
  $stmt = db()->prepare("SELECT id, username, display_name, role, owner_user_id FROM users WHERE id = :id OR owner_user_id = :id");
  $stmt->execute([":id" => $ownerId]);
  $rows = $stmt->fetchAll();
  $map = [];
  foreach ($rows as $row) {
    $id = (string)$row["id"];
    $name = trim((string)($row["display_name"] ?? $row["username"] ?? ""));
    $map[$id] = $name !== "" ? $name : ("User " . $id);
  }
  return $map;
}

function build_stats(array $tasks, array $done, string $storeName, string $defaultStoreName, DateTimeImmutable $start, DateTimeImmutable $end, array $userMap): array {
  $stats = [];
  $ensure = function(string $userId) use (&$stats, $userMap): void {
    if ($userId === "") return;
    if (!isset($stats[$userId])) {
      $stats[$userId] = [
        "name" => $userMap[$userId] ?? ("User " . $userId),
        "created_normal" => 0,
        "created_extra" => 0,
        "closed_normal" => 0,
        "closed_extra" => 0,
      ];
    }
  };
  foreach ($userMap as $uid => $_name) {
    $ensure((string)$uid);
  }
  $storeName = normalize_store_name($storeName);
  $defaultStoreName = normalize_store_name($defaultStoreName);

  foreach ($tasks as $t) {
    $loja = normalize_store_name((string)($t["loja"] ?? ""));
    if ($loja === "" && $defaultStoreName !== "" && $storeName === $defaultStoreName) {
      $loja = $defaultStoreName;
    }
    if ($loja !== $storeName) continue;
    $createdAt = (string)($t["createdAt"] ?? $t["updatedAt"] ?? $t["data"] ?? "");
    $createdDt = parse_date_time($createdAt);
    if (!is_in_range($createdDt, $start, $end)) continue;
    $userId = trim((string)($t["created_by_user_id"] ?? ""));
    if ($userId === "") continue;
    $ensure($userId);
    $isExtra = !empty($t["isExtra"]) || !empty($t["extra"]);
    if ($isExtra) {
      $stats[$userId]["created_extra"]++;
    } else {
      $stats[$userId]["created_normal"]++;
    }
  }

  foreach ($done as $t) {
    $loja = normalize_store_name((string)($t["loja"] ?? ""));
    if ($loja === "" && $defaultStoreName !== "" && $storeName === $defaultStoreName) {
      $loja = $defaultStoreName;
    }
    if ($loja !== $storeName) continue;
    $closedAt = (string)($t["closedAt"] ?? $t["updatedAt"] ?? $t["createdAt"] ?? "");
    $closedDt = parse_date_time($closedAt);
    if (!is_in_range($closedDt, $start, $end)) continue;
    $userId = trim((string)($t["closed_by_user_id"] ?? $t["created_by_user_id"] ?? ""));
    if ($userId === "") continue;
    $ensure($userId);
    $isExtra = !empty($t["isExtra"]) || !empty($t["extra"]);
    if ($isExtra) {
      $stats[$userId]["closed_extra"]++;
    } else {
      $stats[$userId]["closed_normal"]++;
    }
  }

  return $stats;
}

function build_activity_summary(int $userId, DateTimeImmutable $start, DateTimeImmutable $end, DateTimeZone $tz): array {
  $storageKeys = ["activity_log", "activity_actions", "last_active_at", "last_logout_at"];
  $storage = [];
  foreach ($storageKeys as $key) {
    $storage[$key] = get_user_storage_value($userId, $key) ?? "";
  }
  $rawLog = (string)$storage["activity_log"];
  $decoded = json_decode($rawLog, true);
  $events = [];
  if (is_array($decoded)) {
    foreach ($decoded as $item) {
      $val = (int)$item;
      if ($val > 0) $events[] = $val;
    }
  }
  $startTs = (int)$start->getTimestamp();
  $endTs = (int)$end->getTimestamp();
  $events = array_values(array_filter($events, function($ts) use ($startTs, $endTs) {
    return $ts >= $startTs && $ts <= $endTs;
  }));
  sort($events, SORT_NUMERIC);
  $active = [];
  $inactive = [];
  $nowTs = min(time(), $endTs);
  if ($events) {
    $startSeg = $events[0];
    $last = $events[0];
    foreach ($events as $idx => $ts) {
      if ($idx === 0) continue;
      if (($ts - $last) <= 900) {
        $last = $ts;
        continue;
      }
      $active[] = ["start" => $startSeg, "end" => $last, "duration_sec" => max(0, $last - $startSeg)];
      $inactiveStart = $last + 900;
      if ($ts > $inactiveStart) {
        $inactive[] = ["start" => $inactiveStart, "end" => $ts, "duration_sec" => max(0, $ts - $inactiveStart)];
      }
      $startSeg = $ts;
      $last = $ts;
    }
    $active[] = ["start" => $startSeg, "end" => $last, "duration_sec" => max(0, $last - $startSeg)];
    if (($nowTs - $last) > 900) {
      $inactiveStart = $last + 900;
      $inactive[] = ["start" => $inactiveStart, "end" => $nowTs, "duration_sec" => max(0, $nowTs - $inactiveStart)];
    }
  }
  $rawActions = (string)$storage["activity_actions"];
  $decodedActions = json_decode($rawActions, true);
  $actions = [];
  if (is_array($decodedActions)) {
    foreach ($decodedActions as $item) {
      if (!is_array($item)) continue;
      $ts = isset($item["ts"]) ? (int)$item["ts"] : 0;
      $action = isset($item["action"]) ? (string)$item["action"] : "";
      if ($ts <= 0 || $action === "") continue;
      if ($ts < $startTs || $ts > $endTs) continue;
      $actions[] = ["ts" => $ts, "action" => $action];
    }
  }
  usort($actions, function($a, $b){ return ($a["ts"] ?? 0) <=> ($b["ts"] ?? 0); });
  $pausePeriods = [];
  $pauseStart = 0;
  $pauseType = "";
  $pauseSeconds = 0;
  $lunchSeconds = 0;
  foreach ($actions as $item) {
    $action = (string)($item["action"] ?? "");
    $ts = (int)($item["ts"] ?? 0);
    if ($action === "pause_general" || $action === "pause_lunch") {
      $pauseStart = $ts;
      $pauseType = $action;
      continue;
    }
    if ($action === "pause_end" && $pauseStart) {
      $endPause = max($pauseStart, $ts);
      $pausePeriods[] = ["type" => $pauseType, "start" => $pauseStart, "end" => $endPause, "duration_sec" => max(0, $endPause - $pauseStart)];
      $pauseSeconds += max(0, $endPause - $pauseStart);
      if ($pauseType === "pause_lunch") $lunchSeconds += max(0, $endPause - $pauseStart);
      $pauseStart = 0;
      $pauseType = "";
    }
  }
  if ($pauseStart) {
    $endPause = max($pauseStart, $endTs);
    $pausePeriods[] = ["type" => $pauseType, "start" => $pauseStart, "end" => $endPause, "duration_sec" => max(0, $endPause - $pauseStart)];
    $pauseSeconds += max(0, $endPause - $pauseStart);
    if ($pauseType === "pause_lunch") $lunchSeconds += max(0, $endPause - $pauseStart);
  }
  $activeSeconds = 0;
  foreach ($active as $p) $activeSeconds += (int)($p["duration_sec"] ?? 0);
  $inactiveSeconds = 0;
  foreach ($inactive as $p) $inactiveSeconds += (int)($p["duration_sec"] ?? 0);
  $presenceSeconds = $activeSeconds + $inactiveSeconds;
  $workSeconds = max(0, $presenceSeconds - $pauseSeconds);
  $lastActiveAt = (int)($storage["last_active_at"] ?? 0);
  $lastLogoutAt = (int)($storage["last_logout_at"] ?? 0);
  return [
    "first_seen" => $events ? $events[0] : 0,
    "last_seen" => $events ? $events[count($events) - 1] : 0,
    "last_active_at" => $lastActiveAt,
    "last_logout_at" => $lastLogoutAt,
    "active_periods" => $active,
    "inactive_periods" => $inactive,
    "pause_periods" => $pausePeriods,
    "active_seconds" => $activeSeconds,
    "inactive_seconds" => $inactiveSeconds,
    "pause_seconds" => $pauseSeconds,
    "lunch_seconds" => $lunchSeconds,
    "general_pause_seconds" => max(0, $pauseSeconds - $lunchSeconds),
    "presence_seconds" => $presenceSeconds,
    "work_seconds" => $workSeconds,
  ];
}

function build_lines(array $stats, array $activityMap, DateTimeZone $tz): array {
  if (!$stats) return ["Nenhuma atividade registrada no periodo."];
  uasort($stats, function(array $a, array $b): int {
    return strcmp((string)($a["name"] ?? ""), (string)($b["name"] ?? ""));
  });
  $lines = [];
  $userKeys = array_keys($stats);
  foreach ($userKeys as $idx => $userId) {
    $user = $stats[$userId];
    $lines[] = "%%B%% Usuario: " . $user["name"];
    $lines[] = "";
    $activity = $activityMap[$userId] ?? [];
    $firstSeen = format_time((int)($activity["first_seen"] ?? 0), $tz);
    $lastSeen = format_time((int)($activity["last_seen"] ?? 0), $tz);
    $lastActive = format_datetime((int)($activity["last_active_at"] ?? 0), $tz);
    $lastLogout = format_datetime((int)($activity["last_logout_at"] ?? 0), $tz);
    $lines[] = "%%B%% Resumo de Atividades";
    $lines[] = "  - Primeira atividade: " . $firstSeen;
    $lines[] = "  - Ultima atividade: " . $lastSeen;
    $lines[] = "  - Ultimo acesso: " . $lastActive;
    $lines[] = "  - Ultimo logout: " . $lastLogout;
    $lines[] = "";
    $lines[] = "%%B%% Controle de Tempo";
    $lines[] = "  - Tempo ativo: " . format_duration((int)($activity["active_seconds"] ?? 0));
    $lines[] = "  - Tempo inativo: " . format_duration((int)($activity["inactive_seconds"] ?? 0));
    $lines[] = "  - Pausa geral: " . format_duration((int)($activity["general_pause_seconds"] ?? 0));
    $lines[] = "  - Pausa almoco: " . format_duration((int)($activity["lunch_seconds"] ?? 0));
    $lines[] = "  - Presenca total: " . format_duration((int)($activity["presence_seconds"] ?? 0));
    $lines[] = "  - Horas trabalhadas: " . format_duration((int)($activity["work_seconds"] ?? 0));
    $lines[] = "";
    $activePeriods = $activity["active_periods"] ?? [];
    $inactivePeriods = $activity["inactive_periods"] ?? [];
    $pausePeriods = $activity["pause_periods"] ?? [];
    $lines[] = "%%B%% Periodos Ativos";
    if ($activePeriods) {
      [$items, $extra] = limit_periods($activePeriods, 6);
      foreach ($items as $p) {
        $lines[] = "  - " . format_time((int)$p["start"], $tz) . " - " . format_time((int)$p["end"], $tz) . " (" . format_duration((int)$p["duration_sec"]) . ")";
      }
      if ($extra > 0) $lines[] = "  - ... mais " . $extra . " periodo(s)";
    } else {
      $lines[] = "  - Nenhum periodo ativo registrado.";
    }
    $lines[] = "";
    $lines[] = "%%B%% Periodos Inativos";
    if ($inactivePeriods) {
      [$items, $extra] = limit_periods($inactivePeriods, 6);
      foreach ($items as $p) {
        $lines[] = "  - " . format_time((int)$p["start"], $tz) . " - " . format_time((int)$p["end"], $tz) . " (" . format_duration((int)$p["duration_sec"]) . ")";
      }
      if ($extra > 0) $lines[] = "  - ... mais " . $extra . " periodo(s)";
    } else {
      $lines[] = "  - Nenhum periodo inativo registrado.";
    }
    $lines[] = "";
    $lines[] = "%%B%% Pausas";
    if ($pausePeriods) {
      [$items, $extra] = limit_periods($pausePeriods, 6);
      foreach ($items as $p) {
        $label = ($p["type"] === "pause_lunch") ? "Almoco" : "Geral";
        $lines[] = "  - " . $label . ": " . format_time((int)$p["start"], $tz) . " - " . format_time((int)$p["end"], $tz) . " (" . format_duration((int)$p["duration_sec"]) . ")";
      }
      if ($extra > 0) $lines[] = "  - ... mais " . $extra . " pausa(s)";
    } else {
      $lines[] = "  - Nenhuma pausa registrada.";
    }
    $lines[] = "";
    $lines[] = "%%B%% Resumo de Tarefas";
    $lines[] = "  - Criadas (normais): " . $user["created_normal"];
    $lines[] = "  - Criadas (extras): " . $user["created_extra"];
    $lines[] = "  - Encerradas (normais): " . $user["closed_normal"];
    $lines[] = "  - Encerradas (extras): " . $user["closed_extra"];
    $lines[] = "";
    if ($idx < count($userKeys) - 1) {
      $lines[] = "%%DIV%%";
      $lines[] = "";
    }
  }
  return $lines;
}

function run_reports(string $mode): array {
  $today = new DateTimeImmutable("today");
if ($mode === "daily") {
  $start = $today->setTime(0, 0, 0);
  $end = $today->setTime(23, 59, 59);
  $periodLabel = $today->format("d/m/Y");
} else {
  $firstOfThisMonth = $today->modify("first day of this month");
  $start = $firstOfThisMonth->modify("-1 month")->setTime(0, 0, 0);
  $end = $firstOfThisMonth->modify("-1 day")->setTime(23, 59, 59);
  $periodLabel = $start->format("m/Y");
}

// Processa apenas usuarios principais (role nulo conta como principal).
$owners = db()->query("SELECT id FROM users WHERE role IS NULL OR role <> 'secundario'")->fetchAll();
  $summary = [
    "mode" => $mode,
    "sent" => 0,
    "failed" => 0,
    "details" => [],
    "settings" => [
      "smtp" => (defined("APP_SMTP_HOST") && APP_SMTP_HOST) ? APP_SMTP_HOST : (ini_get("SMTP") ?: ""),
      "smtp_port" => (defined("APP_SMTP_PORT") && APP_SMTP_PORT) ? APP_SMTP_PORT : (ini_get("smtp_port") ?: ""),
      "sendmail_from" => (defined("APP_MAIL_FROM") && APP_MAIL_FROM) ? APP_MAIL_FROM : (ini_get("sendmail_from") ?: ""),
    ],
  ];
  foreach ($owners as $row) {
    $ownerId = (int)$row["id"];
    $stores = load_json_storage($ownerId, STORAGE_KEY_STORES);
    if (!$stores) continue;
  $tasks = load_json_storage($ownerId, STORAGE_KEY_TASKS);
  $done = load_json_storage($ownerId, STORAGE_KEY_TASKS_DONE);
  $userMap = get_user_map($ownerId);

    $defaultStoreName = "";
    if (is_array($stores) && count($stores)) {
      $defaultStoreName = (string)($stores[0]["name"] ?? "");
    }
    $tz = new DateTimeZone("America/Sao_Paulo");
    foreach ($stores as $store) {
      $storeName = trim((string)($store["name"] ?? ""));
      if ($storeName === "") continue;
      $to = get_primary_email($store);
      if ($to === "") continue;
      $stats = build_stats($tasks, $done, $storeName, $defaultStoreName, $start, $end, $userMap);
      $activityMap = [];
      foreach ($userMap as $uid => $_name) {
        $activityMap[$uid] = build_activity_summary((int)$uid, $start, $end, $tz);
      }
      $storeLabel = normalize_store_name($storeName);
      $title = ($mode === "daily")
        ? "Relatorio diario - " . $storeLabel . " - " . $periodLabel
        : "Relatorio mensal - " . $storeLabel . " - " . $periodLabel;
      $lines = build_lines($stats, $activityMap, $tz);
      $lines = array_merge(["%%B%% Resumo de atividades", ""], $lines);
      $pdf = build_simple_pdf($title, $lines);
      $body = "Segue o relatorio em PDF.";
      $filename = ($mode === "daily")
        ? "relatorio_diario_" . $storeLabel . "_" . $start->format("Y-m-d") . ".pdf"
        : "relatorio_mensal_" . $storeLabel . "_" . $start->format("Y-m") . ".pdf";
      $filename = preg_replace('/[^A-Za-z0-9_.-]+/', "_", $filename);
      $error = null;
      $sent = send_report_email($to, $title, $body, $pdf, $filename, $error);
      $summary["details"][] = [
        "store" => $storeName,
        "to" => $to,
        "sent" => $sent,
        "error" => $error,
      ];
      if ($sent) {
        $summary["sent"]++;
      } else {
        $summary["failed"]++;
      }
    }
  }

  $logLine = json_encode([
    "ts" => date("c"),
    "summary" => $summary,
  ], JSON_UNESCAPED_UNICODE);
  if ($logLine) {
    @file_put_contents(__DIR__ . "/report_log.txt", $logLine . PHP_EOL, FILE_APPEND);
  }
  $summary["no_recipients"] = ($summary["sent"] === 0 && $summary["failed"] === 0);
  $summary["ok"] = ($summary["sent"] > 0 && $summary["failed"] === 0);
  return $summary;
}

if (php_sapi_name() === "cli") {
  $mode = $argv[1] ?? "";
  $mode = strtolower(trim($mode));
  if (!in_array($mode, ["daily", "monthly"], true)) {
    fwrite(STDERR, "Usage: php report_runner.php [daily|monthly]\n");
    exit(1);
  }
  $summary = run_reports($mode);
  $ok = !empty($summary["ok"]);
  exit($ok ? 0 : 1);
}

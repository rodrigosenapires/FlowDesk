<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "POST") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

function normalize_store_key(string $value): string {
  $raw = trim($value);
  if ($raw === "") return "";
  $ascii = iconv("UTF-8", "ASCII//TRANSLIT", $raw);
  if ($ascii === false) $ascii = $raw;
  $ascii = strtolower($ascii);
  $ascii = preg_replace("/[^a-z0-9]+/", "-", $ascii);
  return trim((string)$ascii, "-");
}

function get_uploaded_file(string $key): ?array {
  if (!isset($_FILES[$key]) || !is_array($_FILES[$key])) {
    return null;
  }
  return $_FILES[$key];
}

function validate_image_upload(array $file, string $label, int $maxBytes, array $allowedMimes): array {
  if (!empty($file["error"])) {
    respond(["ok" => false, "error" => $label . "_upload_error"], 400);
  }
  $tmp = $file["tmp_name"] ?? "";
  if ($tmp === "" || !is_uploaded_file($tmp)) {
    respond(["ok" => false, "error" => $label . "_invalid_upload"], 400);
  }
  $size = (int)($file["size"] ?? 0);
  if ($size <= 0 || $size > $maxBytes) {
    respond(["ok" => false, "error" => $label . "_invalid_size"], 400);
  }
  $mime = "";
  $finfo = finfo_open(FILEINFO_MIME_TYPE);
  if ($finfo) {
    $mime = (string)finfo_file($finfo, $tmp);
    finfo_close($finfo);
  }
  if ($mime !== "image/png") {
    if (!in_array($mime, $allowedMimes, true)) {
      respond(["ok" => false, "error" => $label . "_invalid_type"], 400);
    }
  }
  return $file;
}

function store_uploaded_file(array $file, string $prefix): string {
  $orig = (string)($file["name"] ?? "");
  $base = pathinfo($orig, PATHINFO_FILENAME);
  $base = preg_replace("/[^A-Za-z0-9_-]+/", "-", $base ?? "");
  $base = trim($base ?? "", "-_");
  if ($base === "") {
    $base = $prefix;
  }
  $stamp = date("Ymd_His");
  $rand = bin2hex(random_bytes(4));
  $filename = $prefix . "-" . $base . "-" . $stamp . "-" . $rand . ".png";

  $dir = defined("APP_IMAGES_DIR") ? APP_IMAGES_DIR : (__DIR__ . "/../../imagens");
  $dir = rtrim($dir, "/\\");
  $folder = "app/personalizacoes";
  $targetDir = $dir . DIRECTORY_SEPARATOR . str_replace("/", DIRECTORY_SEPARATOR, $folder);
  if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0755, true)) {
      respond(["ok" => false, "error" => "mkdir_failed"], 500);
    }
  }
  $dest = $targetDir . DIRECTORY_SEPARATOR . $filename;
  if (!move_uploaded_file((string)$file["tmp_name"], $dest)) {
    respond(["ok" => false, "error" => "move_failed"], 500);
  }
  return $folder . "/" . $filename;
}

function store_uploaded_asset(array $file, string $prefix, array $allowedExts): string {
  $orig = (string)($file["name"] ?? "");
  $ext = strtolower(pathinfo($orig, PATHINFO_EXTENSION) ?: "");
  if ($ext === "" || !in_array($ext, $allowedExts, true)) {
    $ext = $allowedExts[0] ?? "bin";
  }
  $base = pathinfo($orig, PATHINFO_FILENAME);
  $base = preg_replace("/[^A-Za-z0-9_-]+/", "-", $base ?? "");
  $base = trim($base ?? "", "-_");
  if ($base === "") {
    $base = $prefix;
  }
  $stamp = date("Ymd_His");
  $rand = bin2hex(random_bytes(4));
  $filename = $prefix . "-" . $base . "-" . $stamp . "-" . $rand . "." . $ext;

  $dir = defined("APP_IMAGES_DIR") ? APP_IMAGES_DIR : (__DIR__ . "/../../imagens");
  $dir = rtrim($dir, "/\\");
  $folder = "app/personalizacoes";
  $targetDir = $dir . DIRECTORY_SEPARATOR . str_replace("/", DIRECTORY_SEPARATOR, $folder);
  if (!is_dir($targetDir)) {
    if (!mkdir($targetDir, 0755, true)) {
      respond(["ok" => false, "error" => "mkdir_failed"], 500);
    }
  }
  $dest = $targetDir . DIRECTORY_SEPARATOR . $filename;
  if (!move_uploaded_file((string)$file["tmp_name"], $dest)) {
    respond(["ok" => false, "error" => "move_failed"], 500);
  }
  return $folder . "/" . $filename;
}

function validate_font_upload(array $file, string $label, int $maxBytes, array $allowedExts, array $allowedMimes): array {
  if (!empty($file["error"])) {
    respond(["ok" => false, "error" => $label . "_upload_error"], 400);
  }
  $tmp = $file["tmp_name"] ?? "";
  if ($tmp === "" || !is_uploaded_file($tmp)) {
    respond(["ok" => false, "error" => $label . "_invalid_upload"], 400);
  }
  $size = (int)($file["size"] ?? 0);
  if ($size <= 0 || $size > $maxBytes) {
    respond(["ok" => false, "error" => $label . "_invalid_size"], 400);
  }
  $ext = strtolower(pathinfo((string)($file["name"] ?? ""), PATHINFO_EXTENSION) ?: "");
  if ($ext === "" || !in_array($ext, $allowedExts, true)) {
    respond(["ok" => false, "error" => $label . "_invalid_type"], 400);
  }
  $mime = "";
  $finfo = finfo_open(FILEINFO_MIME_TYPE);
  if ($finfo) {
    $mime = (string)finfo_file($finfo, $tmp);
    finfo_close($finfo);
  }
  if ($mime !== "" && !in_array($mime, $allowedMimes, true)) {
    respond(["ok" => false, "error" => $label . "_invalid_type"], 400);
  }
  return $file;
}

function read_store_from_payload(): array {
  $storeId = trim((string)($_POST["store_id"] ?? ""));
  if ($storeId === "") {
    respond(["ok" => false, "error" => "missing_store"], 400);
  }
  $storeKey = normalize_store_key($storeId);
  $stmt = db()->prepare("SELECT user_id, storage_value FROM user_storage WHERE storage_key = :key");
  $stmt->execute([":key" => "stores_v1"]);
  while ($row = $stmt->fetch()) {
    $userId = (int)$row["user_id"];
    $raw = (string)$row["storage_value"];
    $list = json_decode($raw, true);
    if (!is_array($list)) {
      continue;
    }
    foreach ($list as $store) {
      if (!is_array($store)) continue;
      $name = trim((string)($store["name"] ?? ""));
      $customId = trim((string)($store["personalizacaoId"] ?? ""));
      $customKey = $customId !== "" ? normalize_store_key($customId) : "";
      $fallback = normalize_store_key($name);
      if ($storeKey !== "" && ($storeKey === $customKey || $storeKey === $fallback)) {
        $storeEmail = "";
        if (!empty($store["emailList"]) && is_array($store["emailList"])) {
          foreach ($store["emailList"] as $entry) {
            $candidate = trim((string)($entry["email"] ?? ""));
            if ($candidate !== "" && filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
              $storeEmail = $candidate;
              break;
            }
          }
        }
        if ($storeEmail === "") {
          $candidate = trim((string)($store["emailAdmin"] ?? ""));
          if ($candidate !== "" && filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
            $storeEmail = $candidate;
          }
        }
        if ($storeEmail === "") {
          $candidate = trim((string)($store["emailAtendimento"] ?? ""));
          if ($candidate !== "" && filter_var($candidate, FILTER_VALIDATE_EMAIL)) {
            $storeEmail = $candidate;
          }
        }
        return [
          "user_id" => $userId,
          "store_name" => $name,
          "store_id" => $storeId,
          "store_email" => $storeEmail
        ];
      }
    }
  }
  respond(["ok" => false, "error" => "store_not_found"], 404);
}

$storeInfo = read_store_from_payload();
$ownerUserId = (int)$storeInfo["user_id"];

$model = trim((string)($_POST["model"] ?? ""));
$color = trim((string)($_POST["color"] ?? ""));
$customText = trim((string)($_POST["custom_text"] ?? ""));
$customTextFont = trim((string)($_POST["custom_text_font"] ?? ""));
$customTextFontLabel = trim((string)($_POST["custom_text_font_label"] ?? ""));
$customTextColor = trim((string)($_POST["custom_text_color"] ?? ""));
$customTextSize = trim((string)($_POST["custom_text_size"] ?? ""));
$customTextBack = "";
$customTextFontBack = "";
$customTextFontLabelBack = "";
$customTextColorBack = "";
$customTextSizeBack = "";
$customFontPathBack = "";
$customerName = trim((string)($_POST["customer_name"] ?? ""));
$customerEmail = trim((string)($_POST["customer_email"] ?? ""));
$customerPhone = trim((string)($_POST["customer_phone"] ?? ""));
$customerNotes = trim((string)($_POST["customer_notes"] ?? ""));
$orderColor = trim((string)($_POST["order_color"] ?? ""));
$orderSize = trim((string)($_POST["order_size"] ?? ""));
$hasBack = ((string)($_POST["has_back"] ?? "") === "1");

if ($model !== "masculino" && $model !== "feminino" && $model !== "proprio") {
  respond(["ok" => false, "error" => "invalid_model"], 400);
}
if ($model !== "proprio" && $color === "") {
  respond(["ok" => false, "error" => "missing_color"], 400);
}
if ($customerName === "" || $customerEmail === "" || $customerPhone === "" || $customerNotes === "" || $orderColor === "" || $orderSize === "") {
  respond(["ok" => false, "error" => "missing_fields"], 400);
}

$maxStampBytes = 15 * 1024 * 1024;
$allowedFontExts = ["ttf", "otf", "woff", "woff2"];
$allowedFontMimes = [
  "font/ttf",
  "font/otf",
  "font/woff",
  "font/woff2",
  "application/font-woff",
  "application/x-font-woff",
  "application/font-sfnt",
  "application/x-font-ttf",
  "application/x-font-otf",
  "application/x-font-opentype",
  "application/vnd.ms-opentype",
  "application/octet-stream"
];
$hasText = ((string)($_POST["has_text"] ?? "") === "1");
$hasTextBack = ((string)($_POST["has_text_back"] ?? "") === "1");
$stampFile = get_uploaded_file("stamp_file");
if (!$stampFile) {
  if (!$hasText) {
    respond(["ok" => false, "error" => "missing_stamp"], 400);
  }
} else {
  $stampFile = validate_image_upload($stampFile, "stamp", $maxStampBytes, ["image/png", "image/jpeg", "image/webp"]);
}

$previewFile = get_uploaded_file("preview_file");
if (!$previewFile) {
  respond(["ok" => false, "error" => "missing_preview"], 400);
}
$previewFile = validate_image_upload($previewFile, "preview", $maxStampBytes, ["image/png"]);

$customFontFile = get_uploaded_file("custom_font_file");
if ($customFontFile) {
  $customFontFile = validate_font_upload($customFontFile, "custom_font", $maxStampBytes, $allowedFontExts, $allowedFontMimes);
}

$mockupFile = get_uploaded_file("mockup_file");
if ($model === "proprio") {
  if (!$mockupFile) {
    respond(["ok" => false, "error" => "missing_mockup"], 400);
  }
  $mockupFile = validate_image_upload($mockupFile, "mockup", $maxStampBytes, ["image/png", "image/jpeg", "image/webp"]);
}

$stampPath = $stampFile ? store_uploaded_file($stampFile, "estampa") : "";
$previewPath = store_uploaded_file($previewFile, "mockup");
$mockupPath = "";
if ($mockupFile) {
  $mockupPath = store_uploaded_file($mockupFile, "mockup-base");
}
$customFontPath = $customFontFile ? store_uploaded_asset($customFontFile, "fonte", $allowedFontExts) : "";

$stampPathBack = "";
$previewPathBack = "";
$mockupPathBack = "";
$areaWBack = 0;
$areaHBack = 0;
$areaXBack = 0;
$areaYBack = 0;
$areaXPctBack = 0.0;
$areaYPctBack = 0.0;
$areaWPctBack = 0.0;
$areaHPctBack = 0.0;
$stampXBack = 0;
$stampYBack = 0;
$stampWBack = 0;
$stampHBack = 0;
$mockupSourceBack = "";

if ($hasBack) {
  $customTextBack = trim((string)($_POST["custom_text_back"] ?? ""));
  $customTextFontBack = trim((string)($_POST["custom_text_font_back"] ?? ""));
  $customTextFontLabelBack = trim((string)($_POST["custom_text_font_label_back"] ?? ""));
  $customTextColorBack = trim((string)($_POST["custom_text_color_back"] ?? ""));
  $customTextSizeBack = trim((string)($_POST["custom_text_size_back"] ?? ""));
  $customFontFileBack = get_uploaded_file("custom_font_file_back");
  if ($customFontFileBack) {
    $customFontFileBack = validate_font_upload($customFontFileBack, "custom_font_back", $maxStampBytes, $allowedFontExts, $allowedFontMimes);
  }

  $stampFileBack = get_uploaded_file("stamp_file_back");
  if (!$stampFileBack) {
    if (!$hasTextBack) {
      respond(["ok" => false, "error" => "missing_stamp_back"], 400);
    }
  } else {
    $stampFileBack = validate_image_upload($stampFileBack, "stamp_back", $maxStampBytes, ["image/png", "image/jpeg", "image/webp"]);
  }

  $previewFileBack = get_uploaded_file("preview_file_back");
  if (!$previewFileBack) {
    respond(["ok" => false, "error" => "missing_preview_back"], 400);
  }
  $previewFileBack = validate_image_upload($previewFileBack, "preview_back", $maxStampBytes, ["image/png"]);

  $mockupFileBack = get_uploaded_file("mockup_file_back");
  if ($model === "proprio") {
    if (!$mockupFileBack) {
      respond(["ok" => false, "error" => "missing_mockup_back"], 400);
    }
    $mockupFileBack = validate_image_upload($mockupFileBack, "mockup_back", $maxStampBytes, ["image/png", "image/jpeg", "image/webp"]);
  }

  $stampPathBack = $stampFileBack ? store_uploaded_file($stampFileBack, "estampa") : "";
  $previewPathBack = store_uploaded_file($previewFileBack, "mockup");
  if ($mockupFileBack) {
    $mockupPathBack = store_uploaded_file($mockupFileBack, "mockup-base");
  }
  $customFontPathBack = $customFontFileBack ? store_uploaded_asset($customFontFileBack, "fonte", $allowedFontExts) : "";

  $areaWBack = (int)($_POST["area_w_back"] ?? 0);
  $areaHBack = (int)($_POST["area_h_back"] ?? 0);
  $areaXBack = (int)($_POST["area_x_back"] ?? 0);
  $areaYBack = (int)($_POST["area_y_back"] ?? 0);
  $areaXPctBack = (float)($_POST["area_x_pct_back"] ?? 0);
  $areaYPctBack = (float)($_POST["area_y_pct_back"] ?? 0);
  $areaWPctBack = (float)($_POST["area_w_pct_back"] ?? 0);
  $areaHPctBack = (float)($_POST["area_h_pct_back"] ?? 0);
  $stampXBack = (int)($_POST["stamp_x_back"] ?? 0);
  $stampYBack = (int)($_POST["stamp_y_back"] ?? 0);
  $stampWBack = (int)($_POST["stamp_w_back"] ?? 0);
  $stampHBack = (int)($_POST["stamp_h_back"] ?? 0);
  $mockupSourceBack = trim((string)($_POST["mockup_source_back"] ?? ""));

  if ($areaWBack <= 0 || $areaHBack <= 0) {
    respond(["ok" => false, "error" => "invalid_area_back"], 400);
  }
  if ($areaXPctBack < 0 || $areaYPctBack < 0 || $areaWPctBack <= 0 || $areaHPctBack <= 0 || $areaXPctBack > 1 || $areaYPctBack > 1 || $areaWPctBack > 1 || $areaHPctBack > 1) {
    respond(["ok" => false, "error" => "invalid_area_pct_back"], 400);
  }
  if ($stampFileBack && ($stampWBack <= 0 || $stampHBack <= 0)) {
    respond(["ok" => false, "error" => "invalid_stamp_position_back"], 400);
  }
}

$areaW = (int)($_POST["area_w"] ?? 0);
$areaH = (int)($_POST["area_h"] ?? 0);
$areaX = (int)($_POST["area_x"] ?? 0);
$areaY = (int)($_POST["area_y"] ?? 0);
$areaXPct = (float)($_POST["area_x_pct"] ?? 0);
$areaYPct = (float)($_POST["area_y_pct"] ?? 0);
$areaWPct = (float)($_POST["area_w_pct"] ?? 0);
$areaHPct = (float)($_POST["area_h_pct"] ?? 0);
$stampX = (int)($_POST["stamp_x"] ?? 0);
$stampY = (int)($_POST["stamp_y"] ?? 0);
$stampW = (int)($_POST["stamp_w"] ?? 0);
$stampH = (int)($_POST["stamp_h"] ?? 0);
$mockupSource = trim((string)($_POST["mockup_source"] ?? ""));

if ($areaW <= 0 || $areaH <= 0) {
  respond(["ok" => false, "error" => "invalid_area"], 400);
}
if ($areaXPct < 0 || $areaYPct < 0 || $areaWPct <= 0 || $areaHPct <= 0 || $areaXPct > 1 || $areaYPct > 1 || $areaWPct > 1 || $areaHPct > 1) {
  respond(["ok" => false, "error" => "invalid_area_pct"], 400);
}
if (!$stampFile && !$hasText) {
  respond(["ok" => false, "error" => "missing_stamp"], 400);
}
if ($stampFile && ($stampW <= 0 || $stampH <= 0)) {
  respond(["ok" => false, "error" => "invalid_stamp_position"], 400);
}

$tz = new DateTimeZone("America/Sao_Paulo");
$now = new DateTimeImmutable("now", $tz);
$nowIso = $now->format(DateTimeInterface::ATOM);
$personalId = "pz-" . date("YmdHis") . "-" . bin2hex(random_bytes(4));

$stmt = db()->prepare("SELECT username, display_name FROM users WHERE id = :id LIMIT 1");
$stmt->execute([":id" => $ownerUserId]);
$owner = $stmt->fetch();
$ownerName = $owner ? ((string)($owner["display_name"] ?? $owner["username"] ?? "")) : "";

$rawPersonal = get_user_storage_value($ownerUserId, "personalizacoes_v1");
$personalList = [];
if ($rawPersonal) {
  $decoded = json_decode($rawPersonal, true);
  if (is_array($decoded)) {
    $personalList = $decoded;
  }
}

$entry = [
  "id" => $personalId,
  "store_id" => $storeInfo["store_id"],
  "store_name" => $storeInfo["store_name"],
  "model" => $model,
  "color" => $color,
  "mockup_source" => $mockupSource,
  "mockup_file" => $mockupPath,
  "stamp_file" => $stampPath,
  "preview_file" => $previewPath,
  "custom_text" => $customText,
  "custom_text_font" => $customTextFont,
  "custom_text_font_label" => $customTextFontLabel,
  "custom_text_color" => $customTextColor,
  "custom_text_size" => $customTextSize,
  "custom_font_file" => $customFontPath,
  "has_back" => $hasBack,
  "mockup_source_back" => $mockupSourceBack,
  "mockup_file_back" => $mockupPathBack,
  "stamp_file_back" => $stampPathBack,
  "preview_file_back" => $previewPathBack,
  "custom_text_back" => $customTextBack ?? "",
  "custom_text_font_back" => $customTextFontBack ?? "",
  "custom_text_font_label_back" => $customTextFontLabelBack ?? "",
  "custom_text_color_back" => $customTextColorBack ?? "",
  "custom_text_size_back" => $customTextSizeBack ?? "",
  "custom_font_file_back" => $customFontPathBack ?? "",
  "final_file" => "",
  "area_w" => $areaW,
  "area_h" => $areaH,
  "area_x" => $areaX,
  "area_y" => $areaY,
  "area_w_back" => $areaWBack,
  "area_h_back" => $areaHBack,
  "area_x_back" => $areaXBack,
  "area_y_back" => $areaYBack,
  "area_x_pct" => $areaXPct,
  "area_y_pct" => $areaYPct,
  "area_w_pct" => $areaWPct,
  "area_h_pct" => $areaHPct,
  "area_x_pct_back" => $areaXPctBack,
  "area_y_pct_back" => $areaYPctBack,
  "area_w_pct_back" => $areaWPctBack,
  "area_h_pct_back" => $areaHPctBack,
  "stamp_x" => $stampX,
  "stamp_y" => $stampY,
  "stamp_w" => $stampW,
  "stamp_h" => $stampH,
  "stamp_x_back" => $stampXBack,
  "stamp_y_back" => $stampYBack,
  "stamp_w_back" => $stampWBack,
  "stamp_h_back" => $stampHBack,
  "customer_name" => $customerName,
  "customer_email" => $customerEmail,
  "customer_phone" => $customerPhone,
  "customer_notes" => $customerNotes,
  "order_color" => $orderColor,
  "order_size" => $orderSize,
  "viewed" => false,
  "status" => "aberta",
  "created_at" => $nowIso,
  "updated_at" => $nowIso,
];

array_unshift($personalList, $entry);
set_user_storage_value($ownerUserId, "personalizacoes_v1", json_encode($personalList));

$rawNotifications = get_user_storage_value($ownerUserId, "notifications_v1");
$notifications = [];
if ($rawNotifications) {
  $decoded = json_decode($rawNotifications, true);
  if (is_array($decoded)) {
    $notifications = $decoded;
  }
}
$notifyEntry = [
  "id" => "nt-" . date("YmdHis") . "-" . bin2hex(random_bytes(4)),
  "type" => "personalizacao_create",
  "title" => "Nova personalizacao",
  "detail" => "Cliente: " . $customerName . " - Loja: " . $storeInfo["store_name"],
  "created_at" => $nowIso,
  "seen" => false,
  "seen_at" => "",
  "customer_name" => $customerName,
  "store_name" => $storeInfo["store_name"],
  "task_id" => "",
  "is_extra" => false,
  "by_name" => "Cliente"
];
array_unshift($notifications, $notifyEntry);
$notifications = array_slice($notifications, 0, 200);
set_user_storage_value($ownerUserId, "notifications_v1", json_encode($notifications));

$rawTasks = get_user_storage_value($ownerUserId, "tarefasDiarias_v1");
$tasks = [];
if ($rawTasks) {
  $decoded = json_decode($rawTasks, true);
  if (is_array($decoded)) {
    $tasks = $decoded;
  }
}

$today = $now->format("Y-m-d");
$taskEntry = [
  "id" => $personalId,
  "data" => $today,
  "cliente" => $customerName,
  "whatsapp" => $customerPhone,
  "loja" => $storeInfo["store_name"],
  "assunto" => "Personalização",
  "status" => "Personalização",
  "proxEtapa" => $today,
  "obs" => $customerNotes ? [[
    "text" => $customerNotes,
    "date" => "",
    "prazo" => "",
    "prazoHora" => "",
    "chamado" => "",
    "etiqueta" => "",
    "novoPedido" => "",
    "rastreio" => "",
    "status" => "",
    "attention" => false,
    "attentionNote" => "",
    "state" => ""
  ]] : [],
  "created_by_user_id" => (string)$ownerUserId,
  "created_by_username" => $ownerName,
  "createdAt" => $nowIso,
  "updatedAt" => $nowIso,
];

array_unshift($tasks, $taskEntry);
set_user_storage_value($ownerUserId, "tarefasDiarias_v1", json_encode($tasks));

$rawCalendar = get_user_storage_value($ownerUserId, "calendarHistory_v1");
$calendar = [];
if ($rawCalendar) {
  $decoded = json_decode($rawCalendar, true);
  if (is_array($decoded)) {
    $calendar = $decoded;
  }
}
$calendarEntry = [
  "id" => $personalId,
  "date" => $today,
  "assunto" => "Personalização",
  "loja" => $storeInfo["store_name"],
  "pedido" => "",
  "rastreio" => "",
  "cliente" => $customerName,
  "whatsapp" => $customerPhone,
  "prazoHora" => "",
  "phaseIdx" => 0,
  "lastPhaseText" => "",
  "open" => true,
  "created_by_user_id" => (string)$ownerUserId,
  "created_by_username" => $ownerName,
  "createdAt" => $nowIso,
  "updatedAt" => $nowIso,
];
array_unshift($calendar, $calendarEntry);
set_user_storage_value($ownerUserId, "calendarHistory_v1", json_encode($calendar));

$storeEmail = (string)($storeInfo["store_email"] ?? "");
if ($storeEmail !== "") {
  $base = get_app_base_url();
  $link = $base ? ($base . "/?view=personalizations") : "";
  $sentAt = $now->format("d/m/Y H:i");
  send_personalizacao_notification($storeEmail, [
    "store_name" => $storeInfo["store_name"],
    "customer_name" => $customerName,
    "sent_at" => $sentAt,
    "link" => $link
  ]);
}

respond(["ok" => true, "id" => $personalId]);

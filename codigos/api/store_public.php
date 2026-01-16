<?php
declare(strict_types=1);
require_once __DIR__ . "/_init.php";

if ($_SERVER["REQUEST_METHOD"] !== "GET") {
  respond(["ok" => false, "error" => "method_not_allowed"], 405);
}

$storeId = trim((string)($_GET["loja"] ?? ""));
if ($storeId === "") {
  respond(["ok" => false, "error" => "missing_store"], 400);
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

function normalize_whatsapp_url(string $value): string {
  $url = trim($value);
  if ($url === "") return "";
  if (!filter_var($url, FILTER_VALIDATE_URL)) {
    return "";
  }
  return $url;
}

function normalize_whatsapp_phone(string $value): string {
  $digits = preg_replace('/\\D+/', '', $value);
  if (!$digits) return "";
  if (strpos($digits, "55") === 0 && strlen($digits) > 11) {
    $digits = substr($digits, 2);
  }
  return $digits;
}

$storeKey = normalize_store_key($storeId);
$stmt = db()->prepare("SELECT storage_value FROM user_storage WHERE storage_key = :key");
$stmt->execute([":key" => "stores_v1"]);
while ($row = $stmt->fetch()) {
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
      $logoUrl = trim((string)($store["logoUrl"] ?? ""));
      $whatsappPhone = normalize_whatsapp_phone((string)($store["whatsappPhone"] ?? ""));
      if ($whatsappPhone === "") {
        $whatsappPhone = normalize_whatsapp_phone((string)($store["whatsappUrl"] ?? ""));
      }
      if ($whatsappPhone === "") {
        $whatsappPhone = normalize_whatsapp_phone((string)($store["supportWhatsapp"] ?? ""));
      }
      $whatsappLink = "";
      if ($whatsappPhone !== "") {
        $whatsappLink = "https://api.whatsapp.com/send?phone=552" . $whatsappPhone;
      }
      $instagramUrl = trim((string)($store["instagramUrl"] ?? ""));
      $facebookUrl = trim((string)($store["facebookUrl"] ?? ""));
      $tiktokUrl = trim((string)($store["tiktokUrl"] ?? ""));
      $youtubeUrl = trim((string)($store["youtubeUrl"] ?? ""));
      $pinterestUrl = trim((string)($store["pinterestUrl"] ?? ""));
      $socialExtras = [];
      if (isset($store["socialExtras"]) && is_array($store["socialExtras"])) {
        foreach ($store["socialExtras"] as $extra) {
          if (!is_array($extra)) continue;
          $label = trim((string)($extra["name"] ?? ""));
          $supportUrl = trim((string)($extra["supportUrl"] ?? $extra["support_url"] ?? $extra["url"] ?? ""));
          $profileUrl = trim((string)($extra["profileUrl"] ?? $extra["profile_url"] ?? ""));
          if ($label !== "" && ($supportUrl !== "" || $profileUrl !== "")) {
            $socialExtras[] = [
              "name" => $label,
              "support_url" => $supportUrl,
              "profile_url" => $profileUrl
            ];
          }
        }
      }
      respond([
        "ok" => true,
        "store" => [
          "name" => $name,
          "logo_url" => $logoUrl,
          "site_url" => trim((string)($store["siteUrl"] ?? "")),
          "whatsapp_phone" => $whatsappPhone,
          "whatsapp_link" => $whatsappLink,
          "instagram_url" => $instagramUrl,
          "facebook_url" => $facebookUrl,
          "tiktok_url" => $tiktokUrl,
          "youtube_url" => $youtubeUrl,
          "pinterest_url" => $pinterestUrl,
          "social_extras" => $socialExtras,
          "personalizacao_config" => $store["personalizacaoConfig"] ?? null
        ]
      ]);
    }
  }
}

respond(["ok" => false, "error" => "store_not_found"], 404);

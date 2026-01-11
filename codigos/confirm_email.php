<?php
declare(strict_types=1);
require_once __DIR__ . "/api/_init.php";

header("Content-Type: text/html; charset=utf-8");

$token = trim((string)($_GET["token"] ?? ""));
$message = "Token inv&aacute;lido.";
$status = "error";

if ($token !== "") {
  $hash = hash("sha256", $token);
  $stmt = db()->prepare(
    "SELECT id, email_verified, email_verification_expires_at
     FROM users WHERE email_verification_token = :token LIMIT 1"
  );
  $stmt->execute([":token" => $hash]);
  $row = $stmt->fetch();
  if (!$row) {
    $message = "Token inv&aacute;lido ou j&aacute; utilizado.";
  } elseif ((int)$row["email_verified"] === 1) {
    $message = "E-mail j&aacute; confirmado.";
    $status = "ok";
  } else {
    $expires = $row["email_verification_expires_at"];
    if ($expires && strtotime($expires) < time()) {
      $message = "Token expirado. Solicite um novo cadastro.";
    } else {
      $upd = db()->prepare(
        "UPDATE users
         SET email_verified = 1,
             email_verification_token = NULL,
             email_verification_expires_at = NULL,
             updated_at = NOW()
         WHERE id = :id"
      );
      $upd->execute([":id" => (int)$row["id"]]);
      $message = "E-mail confirmado com sucesso. Voc&ecirc; j&aacute; pode entrar no app.";
      $status = "ok";
    }
  }
}

?>
<!doctype html>
<html lang="pt-br">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Confirma&ccedil;&atilde;o de e-mail</title>
  <style>
    body{font-family:"Segoe UI",Arial,sans-serif;background:#0b1220;color:#e9eef7;display:flex;min-height:100vh;align-items:center;justify-content:center;padding:24px}
    .card{max-width:560px;background:#0f1b2e;border:1px solid #20324f;border-radius:18px;padding:28px 26px;text-align:center;box-shadow:0 15px 40px rgba(0,0,0,.45)}
    .logoText{margin:0 auto 18px;font-size:22px;font-weight:700;color:#ffffff}
    .title{margin:0 0 8px;font-size:20px}
    .desc{margin:0 0 16px;color:#c5d2e8}
    .ok{color:#22c55e}
    .error{color:#f97316}
    .cta{display:inline-block;margin-top:6px;padding:10px 16px;border-radius:10px;background:#7c8cff;color:#0b1220;text-decoration:none;font-weight:700}
    .muted{margin-top:14px;color:#9fb0c8;font-size:12px}
  </style>
</head>
<body>
  <div class="card">
    <div class="logoText">FlowDesk</div>
    <h2 class="title <?php echo $status === "ok" ? "ok" : "error"; ?>">
      <?php echo $message; ?>
    </h2>
    <p class="desc">Voc&ecirc; pode voltar ao app e continuar normalmente.</p>
    <a class="cta" href="./">Voltar ao app</a>
    <div class="muted">Equipe FlowDesk</div>
  </div>
</body>
</html>


<?php
require 'codigos/api/_init.php';
$stmt = db()->query('SELECT id, username, display_name, email FROM users');
$rows = $stmt ? $stmt->fetchAll(PDO::FETCH_ASSOC) : [];
foreach ($rows as $r) {
  $u = strtolower($r['username'] ?? '');
  $d = strtolower($r['display_name'] ?? '');
  if (strpos($u, 'carla') !== false || strpos($d, 'carla') !== false) {
    echo $r['id'] . "\t" . ($r['username'] ?? '') . "\t" . ($r['display_name'] ?? '') . "\t" . ($r['email'] ?? '') . "\n";
  }
}
?>

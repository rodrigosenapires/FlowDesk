<?php
$pdo = new PDO('mysql:host=127.0.0.1;dbname=u748231595_flowdesk;charset=utf8mb4', 'root', '');
$stmt=$pdo->prepare('SELECT storage_value FROM user_storage WHERE user_id=? AND storage_key=?');
$stmt->execute([1,'tarefasDiarias_v1']);
$row=$stmt->fetch(PDO::FETCH_ASSOC);
$tasks = $row ? json_decode($row['storage_value'], true) : [];
$first = $tasks[0] ?? null;
var_dump($first['loja']);
$storeName = 'Diário Nerdify';
var_dump($storeName);
var_dump($first['loja'] === $storeName);
var_dump(strlen($first['loja']), strlen($storeName));
?>

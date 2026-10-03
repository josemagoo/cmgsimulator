<?php
// Proxy con caché para OpenStreetMap (Overpass): evita CORS y descargas repetidas.
require __DIR__ . '/common.php';
check_origin($CFG);

$q = $_POST['data'] ?? $_GET['data'] ?? '';
// Solo se aceptan las consultas que hace el juego (no es un proxy abierto)
$ok = strlen($q) > 0 && strlen($q) <= 3000
    && preg_match('#^\[out:json\]\[timeout:\d{1,2}\];\(?((way|node)\[[^\]]+\](\[[^\]]+\])*\([^)]*\);)+\)?;?out geom;$#', $q);
if (!$ok) { http_response_code(400); exit; }

$file = CACHE_DIR . '/' . md5($q) . '.json';
header('Content-Type: application/json');
if (is_file($file)) { readfile($file); exit; }

set_time_limit(120);
foreach ($CFG['overpass'] as $url) {
    [$code, $body] = http_fetch($url, $CFG, http_build_query(['data' => $q]), 25);
    if ($code === 200 && strpos($body, '"elements"') !== false) {
        file_put_contents($file, $body, LOCK_EX);
        cache_gc($CFG);
        echo $body; exit;
    }
}
http_response_code(502);
echo '{"error":"overpass no disponible"}';

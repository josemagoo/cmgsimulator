<?php
// Proxy con caché para las teselas de imagen satelital y de relieve.
require __DIR__ . '/common.php';
check_origin($CFG);

$z = (int)($_GET['z'] ?? -1); $y = (int)($_GET['y'] ?? -1); $x = (int)($_GET['x'] ?? -1);
$elev = ($_GET['t'] ?? '') === 'elev';
$maxZ = $elev ? 14 : (int)$CFG['max_zoom_img'];
if ($z < 0 || $z > $maxZ || $x < 0 || $y < 0 || $x >= (1 << $z) || $y >= (1 << $z)) { http_response_code(400); exit; }

$dir = CACHE_DIR . '/tiles';
if (!is_dir($dir)) @mkdir($dir, 0775, true);
$file = $elev ? "$dir/e_{$z}_{$x}_{$y}.png" : "$dir/{$z}_{$y}_{$x}.jpg";
header('Content-Type: ' . ($elev ? 'image/png' : 'image/jpeg'));
header('Cache-Control: public, max-age=604800');
if (is_file($file)) { readfile($file); exit; }

$tpl = $elev ? $CFG['terrain_url'] : $CFG['imagery_url'];
$url = str_replace(['{z}', '{x}', '{y}'], [$z, $x, $y], $tpl);
if (!$elev && $CFG['imagery_query'] !== '') $url .= (strpos($url, '?') === false ? '?' : '&') . $CFG['imagery_query'];
[$code, $body] = http_fetch($url, $CFG, null, 20);
if ($code === 200 && $body !== '') {
    file_put_contents($file, $body, LOCK_EX);
    cache_gc($CFG);
    echo $body; exit;
}
http_response_code(502);

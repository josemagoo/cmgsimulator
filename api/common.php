<?php
// Utilidades compartidas por los proxies: descarga HTTP, comprobación de origen y limpieza de la caché.
ini_set('display_errors', '0');
$CFG = require __DIR__ . '/config.php';
define('CACHE_DIR', __DIR__ . '/_cache');
if (!is_dir(CACHE_DIR)) @mkdir(CACHE_DIR, 0775, true);

// Evita que otros sitios usen tu proxy: el Origin/Referer debe ser tu propio dominio
function check_origin(array $cfg): void {
    $host = strtolower($_SERVER['HTTP_HOST'] ?? '');
    $host = preg_replace('/:\d+$/', '', $host);
    foreach (['HTTP_ORIGIN', 'HTTP_REFERER'] as $h) {
        if (empty($_SERVER[$h])) continue;
        $o = strtolower((string)parse_url($_SERVER[$h], PHP_URL_HOST));
        if ($o !== $host && !in_array($o, array_map('strtolower', $cfg['allowed_hosts']), true)) { http_response_code(403); exit; }
    }
}

// GET o POST con curl (o file_get_contents si no hay curl). Devuelve [código, cuerpo]
function http_fetch(string $url, array $cfg, ?string $post = null, int $timeout = 25): array {
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        $opt = [CURLOPT_RETURNTRANSFER => true, CURLOPT_TIMEOUT => $timeout, CURLOPT_FOLLOWLOCATION => true,
                CURLOPT_SSL_VERIFYPEER => (bool)$cfg['verify_ssl'], CURLOPT_USERAGENT => $cfg['user_agent'], CURLOPT_HTTPHEADER => ['Accept: */*']];
        if ($post !== null) { $opt[CURLOPT_POST] = true; $opt[CURLOPT_POSTFIELDS] = $post; }
        curl_setopt_array($ch, $opt);
        $body = curl_exec($ch); $code = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE); curl_close($ch);
        return [$code, $body === false ? '' : $body];
    }
    $http = ['method' => $post !== null ? 'POST' : 'GET', 'timeout' => $timeout, 'header' => "User-Agent: {$cfg['user_agent']}\r\nAccept: */*\r\n"];
    if ($post !== null) { $http['content'] = $post; $http['header'] .= "Content-Type: application/x-www-form-urlencoded\r\n"; }
    $body = @file_get_contents($url, false, stream_context_create(['http' => $http, 'ssl' => ['verify_peer' => (bool)$cfg['verify_ssl']]]));
    $code = 0;
    if (!empty($http_response_header[0]) && preg_match('#\s(\d{3})\s#', $http_response_header[0], $m)) $code = (int)$m[1];
    return [$code, $body === false ? '' : $body];
}

// Borra lo antiguo y, si la caché es demasiado grande, lo más viejo (se ejecuta en ~1 de cada 300 peticiones)
function cache_gc(array $cfg): void {
    if (mt_rand(1, 300) !== 1) return;
    $files = []; $total = 0; $limit = time() - $cfg['cache_days'] * 86400;
    $it = new RecursiveIteratorIterator(new RecursiveDirectoryIterator(CACHE_DIR, FilesystemIterator::SKIP_DOTS));
    foreach ($it as $f) {
        if (!$f->isFile() || $f->getFilename()[0] === '.') continue;
        if ($f->getMTime() < $limit) { @unlink($f->getPathname()); continue; }
        $files[$f->getPathname()] = [$f->getMTime(), $f->getSize()]; $total += $f->getSize();
    }
    if ($total > $cfg['cache_mb'] * 1048576) {
        uasort($files, fn($a, $b) => $a[0] <=> $b[0]);
        foreach ($files as $p => [$t, $s]) { @unlink($p); $total -= $s; if ($total < $cfg['cache_mb'] * 1048576 * 0.8) break; }
    }
}

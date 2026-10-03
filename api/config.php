<?php
// Configuración del servidor. Para cambios propios crea api/config.local.php (devuelve un array con los valores a sobrescribir).
$cfg = [
    // Imágenes satelitales. IMPORTANTE: revisa los términos de uso de tu proveedor antes de publicar (ver README.md).
    'imagery_url'   => 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
    'imagery_query' => '',          // p. ej. 'token=TU_CLAVE' si tu proveedor exige una clave
    'terrain_url'   => 'https://s3.amazonaws.com/elevation-tiles-prod/terrarium/{z}/{x}/{y}.png',
    'overpass'      => [
        'https://overpass.openstreetmap.fr/api/interpreter',
        'https://overpass-api.de/api/interpreter',
        'https://overpass.kumi.systems/api/interpreter',
    ],
    'user_agent'    => 'CamagueySim/1.0 (simulador de vuelo; contacto: cambia-esto@tu-dominio.com)',
    'verify_ssl'    => true,        // en servidores normales déjalo en true
    'cache_mb'      => 800,         // tamaño máximo de la caché en disco
    'cache_days'    => 90,          // los archivos más viejos se borran
    'allowed_hosts' => [],          // dominios extra autorizados a usar este proxy (vacío = solo tu propio sitio)
    'max_zoom_img'  => 18,
];
if (is_file(__DIR__ . '/config.local.php')) {
    $cfg = array_replace($cfg, (array)require __DIR__ . '/config.local.php');
}
return $cfg;

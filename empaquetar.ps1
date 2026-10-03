# Crea dist/simulatorfly-hosting.zip listo para subir al hosting (sin caché, sin configuración local, sin archivos de prueba)
$root = $PSScriptRoot
$stage = Join-Path $env:TEMP "simulatorfly_stage"
$dist = Join-Path $root "dist"
if (Test-Path $stage) { Remove-Item $stage -Recurse -Force }
New-Item -ItemType Directory -Path $stage, $dist -Force | Out-Null
$items = "index.html","css","js","lib","icon.svg","manifest.webmanifest","sw.js",".htaccess","README.md","api"
foreach ($i in $items) { Copy-Item (Join-Path $root $i) $stage -Recurse -Force }
# la caché va vacía (solo con su .htaccess) y la configuración local no se sube
Get-ChildItem (Join-Path $stage "api\_cache") -Force | Where-Object { $_.Name -ne ".htaccess" } | Remove-Item -Recurse -Force
Remove-Item (Join-Path $stage "api\config.local.php") -ErrorAction SilentlyContinue
$zip = Join-Path $dist "simulatorfly-hosting.zip"
if (Test-Path $zip) { Remove-Item $zip -Force }
Compress-Archive -Path (Join-Path $stage "*") -DestinationPath $zip -Force
Write-Host "Listo: $zip"

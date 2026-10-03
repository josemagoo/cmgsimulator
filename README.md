# Simulador de Vuelo · Camagüey

Simulador de vuelo y conducción en el navegador, sobre el mapa real de Camagüey (Cuba) y otras ciudades:
imágenes satelitales, relieve real, edificios, calles, ríos y aeropuertos reales, tráfico, clima, día y noche.
Se juega con teclado, mando (Xbox 360 y similares) o pantalla táctil (móvil y tablet).

## Vehículos

- **Aviones** (5): desde una avioneta hasta un jet de Mach 2. Tren retráctil, flaps, pérdida de sustentación, viento y turbulencia.
- **Helicópteros** (3): despegue vertical, vuelo estacionario, aterrizaje en cualquier sitio.
- **Autos** (3): por las calles reales de Camagüey, con daños, humo y choques.

## Camagüey, a escala real

El casco histórico y los repartos están construidos como la ciudad real (OpenStreetMap, fotos satelitales, fotos de Wikimedia Commons,
videos de las calles y datos urbanos propios en `js/data/`):

- **Fachadas vano a vano** (atlas de 32 módulos dibujados en `js/world/facades.js`): ventanas coloniales de barrotes de madera torneada,
  rejas de hierro voladizas, puertas de dos hojas con **medio punto de vitrales**, postigos, balcones de hierro y de madera con tejadillo,
  plantas eclécticas y art déco, comercios con cortina metálica, cafeterías y **bodegas** con letrero pintado, toldos de lona, casas de
  reparto con persianas "Miami", portales, paneles prefabricados con balcones y ropa tendida, naves industriales.
  El color de cada casa tiñe solo el estuco; molduras blancas y carpintería de su propio color (madera, verde, azul, turquesa…),
  con humedad en el zócalo, manchas y ladrillo a la vista donde se cayó el repello. Las **medianeras** se detectan y van lisas.
- **Techos de teja criolla** donde la foto satelital muestra teja (a dos o cuatro aguas, con alero y cumbrera, o faldón alrededor de
  patios), y **azoteas** de losa con pretil, tinacos (negros, azules, de fibrocemento), casetas y antenas. Color real de la foto en cada techo.
- **Monumentos** con sus colores actuales: Catedral (torre crema con la estatua de **Cristo Rey**), Sagrado Corazón neogótico (torre de 53 m
  y dos octogonales), La Merced (blanca y granate, torre sobre la portada, claustro), La Soledad (blanca y ocre, cúpula roja), El Carmen
  (amarilla, dos torres), San Juan de Dios, Santa Ana, El Cristo, Teatro Principal, Gran Hotel, Hotel Colón, Edificio Lugareño, estación…
- **Calles**: ancho real, aceras elevadas con contén (abiertas en cada bocacalle), asfalto gastado, adoquín, bulevares peatonales de losas
  (República, Maceo), calles de tierra en los repartos, **autos aparcados**, postes con cables y pocas farolas (como en la ciudad real).
- **Tráfico típico**: Ladas, almendrones de los 50, guaguas, motos, bicicletas, mototaxis, **coches de caballo** y gente por las aceras.
- **Repartos**: casas con jardín delantero y **cercas** (reja sobre murete, malla verde o murete de balaustres), portales con columnas.
- **Árboles** de OSM, de calle y detectados en la foto (copas con su color real), palmas reales y algún flamboyán.

## Minimapa

Tipo radar, con el plano real de la ciudad: calles (las principales en amarillo, peatonales en beige, de tierra en marrón), edificios,
parques, plazas y agua, con el **nombre de las calles cercanas**, iglesias y lugares de interés. Encima se muestra el nombre de la calle
por la que vas. En auto el radar es más grande y se acerca; con + / − cambias el zoom.

## Rendimiento

Probado en una tarjeta integrada **Intel UHD** a 60 fps en calidad Alta. La ciudad se construye en porciones de pocos milisegundos
por fotograma (sin tirones al cargar), las sombras solo las hace el vehículo, el suelo se dibuja una sola vez por píxel, el tráfico y los
árboles usan mallas instanciadas con nivel de detalle por distancia, las fachadas comparten un solo material (una llamada de dibujo por
celda) y el filtro de estilo GTA lleva su propio suavizado barato (FXAA). En tarjetas integradas no se usa superresolución.

## Ayudas de aterrizaje

- **PAPI**: 4 luces junto a la pista (2 blancas + 2 rojas = senda correcta; todas blancas = alto; todas rojas = bajo).
- **Indicador de aproximación**: al alinearte con una pista a menos de 18 km, el horizonte artificial muestra dos agujas
  (vertical = eje de pista, horizontal = senda de 3°) y el aviso en pantalla te dice qué corregir.
- **Asistencia de aterrizaje (X)**: el piloto automático sigue la senda y el eje de pista, ajusta velocidad, baja el tren, pone los flaps,
  redondea al tocar y frena en la pista. Cualquier mando que muevas tú tiene prioridad.

## Misiones y logros

En el menú elige una **misión** antes de empezar: recorrido turístico, aros, aterrizaje de precisión, vuelo a otra ciudad,
entrega en helicóptero y puntos de control en auto. Cada una da puntos; tus mejores marcas y **16 logros** se guardan en el navegador
(⚙ en el menú, o la tecla **O**).

## Controles

| Teclado | |
|---|---|
| Shift / Ctrl (o E / Q) | más / menos gases (helicóptero: subir / bajar) |
| W S · ↑ ↓ | cabeceo (auto: acelerar / frenar; helicóptero: avanzar / retroceder) |
| A D · ← → | inclinar y girar (helicóptero: girar; Q E: de lado) |
| Espacio | frenar |
| G · V · X | tren · flaps · asistencia de aterrizaje |
| F | crucero rápido ×8 (aviones y helicópteros) |
| C · R | cámara (persecución / cabina) · reiniciar |
| Ratón | arrastra para mirar, rueda para zoom |
| I · Z · O | instrumentos · clima · ajustes |
| T Y N · L K M · P | hora · luces, sombras, sonido · menú |
| + / − | acercar o alejar el minimapa |

**Mando:** palanca izquierda mover · gatillos gas/freno · A freno · palanca derecha cámara · Y cámara · X luz · B crucero ·
cruceta ↑ asistencia, ↓ tren, → flaps, ← instrumentos · LB/RB hora (en el menú: cambiar pestaña) · Back reiniciar · Start menú.
Conéctalo y pulsa cualquier botón para que el navegador lo detecte. Solo se usan mandos con mapeo estándar (los dispositivos
HID/virtuales con palancas atascadas se ignoran).

**Móvil (en horizontal):** la palanca aparece donde apoyes el pulgar en la mitad izquierda; a la derecha, el deslizador de
GASES (avión), de ALTURA (helicóptero: vuelve solo al centro) o los pedales GAS / FRENO (auto). Arriba: menú, cámara, reiniciar,
crucero y **⋯** con luces, hora, clima, instrumentos, zoom del radar, sonido, ajustes y pantalla completa. Abajo, en el avión:
asistencia de aterrizaje, tren y flaps. Arrastrar en la mitad derecha mueve la cámara; dos dedos hacen zoom. En Android se juega a
pantalla completa al pulsar Volar. `?touch=1` en la dirección fuerza los controles táctiles para probarlos en el PC.

## Calidad y rendimiento

⚙ → Calidad gráfica: **Baja**, **Media** (la del móvil, aligerada: menos peatones, coches y árboles) o **Alta** (la del PC).
Se aplica al recargar. El juego además ajusta la nitidez según los fps (en el móvil sube hasta 1,5 si le sobra potencia) y, si
aun así va lento, sugiere la calidad Baja. El contador de fotogramas se activa en ajustes.

## Subirlo a tu hosting

**Requisitos:** hosting con **PHP 7.4 o superior** (con `curl`, o `allow_url_fopen` activado) y Apache (cPanel, Hostinger, etc.).
HTTPS recomendado (es obligatorio para instalarlo como app en el móvil).

1. Sube **`simulatorfly-hosting.zip`** a la carpeta del dominio (`public_html` o su subcarpeta) y **extráelo ahí** con el Administrador de archivos.
   (No subas carpetas sueltas: algunos paneles se saltan las subcarpetas. Debe quedar `index.html` junto a `css`, `js`, `lib` y `api`.)
2. Opcional pero recomendado: sube y extrae también **`simulatorfly-cache-camaguey.zip`** en la misma carpeta. Trae los mapas de Camagüey ya
   descargados (calles, edificios, imágenes y relieve), así la primera visita es casi instantánea y se consultan menos los servidores externos.
3. Da permiso de escritura a `api/_cache` (775; algunos hostings piden 777). Ahí se guardan los mapas que se van descargando.
4. Abre `api/config.php` y cambia `user_agent` por el nombre de tu sitio y un correo de contacto real.
5. Prueba: `https://tu-dominio/api/tile.php?z=16&y=28560&x=18300` debe mostrar una imagen satelital, y `https://tu-dominio/` el menú.

**Nginx** (si tu hosting no usa Apache): añade
`location ~ ^/api/(_cache|config|common) { deny all; }` y los tipos MIME `js → text/javascript`, `webmanifest → application/manifest+json`.

## Licencias y términos de uso (importante antes de publicarlo)

- **Mapa, calles, ríos y lugares:** © OpenStreetMap contributors (ODbL). La atribución se muestra en pantalla; mantenla.
- **Imágenes satelitales:** por defecto *Esri World Imagery*. Sin cuenta, sus términos limitan el uso a pruebas y proyectos personales;
  para un sitio público necesitas licencia/clave de Esri o cambiar de proveedor (Mapbox, MapTiler, Bing…) en `api/config.php`
  (`imagery_url`, `imagery_query`), sin tocar el juego.
- **Servidores de OpenStreetMap (Overpass):** públicos y de uso justo. La caché en `api/_cache` reduce mucho las consultas;
  con mucho tráfico conviene un servidor Overpass propio.
- **Relieve:** AWS Terrain Tiles (Mapzen), datos públicos con atribución.
- **Three.js** r128 (MIT) va incluido en `lib/`, sin CDN.

## Estructura

    index.html, css/style.css       página y estilos (también móvil)
    js/main.js                      punto de entrada: une todo
    js/settings.js, config.js       ajustes del jugador y perfiles de calidad
    js/input.js, camera.js          entrada unificada (teclado, ratón, táctil, mando) y cámara
    js/sound.js                     sonido sintetizado por capas
    js/missions.js, achievements.js misiones y logros (usan el bus de eventos js/events.js)
    js/vehicles/                    vehículos: plane, helicopter, car (+ modelos) y registry.js
    js/world/                       cielo y hora, clima, relieve, teselas, agua, aeropuertos, ciudad (osm.js, models.js, roads.js), tráfico, aviones autónomos
    js/data/                        datos urbanos de Camagüey: zonas, lugares emblemáticos, plazas y objetos de plaza
    js/ui/                          HUD, instrumentos y cabina, menú, minimapa, ajustes, controles táctiles
    api/                            proxies PHP con caché (OpenStreetMap, teselas) y configuración
    sw.js, manifest.webmanifest     app instalable (solo con HTTPS)

## Añadir un vehículo nuevo

1. Crea una clase en `js/vehicles/` que extienda `Vehicle` (`spawn`, `update`, `hud`, `instr`, `hint`, `sound`, `cameraSpec`…).
2. Define sus especificaciones y modelo 3D (mira `carModels.js`, el más corto).
3. Regístralo en `js/vehicles/registry.js`. El menú, la cámara, los controles táctiles, los instrumentos y el minimapa lo usan solos.
   Para darle misiones, añade su categoría a `cats` en `js/missions.js`.

## Actualizar el juego después de subirlo

Basta con subir los archivos cambiados: el `.htaccess` hace que el navegador revalide el código en cada visita y `sw.js` lo pide siempre a la red (la copia guardada solo se usa sin conexión), así que nadie mezcla archivos viejos y nuevos. No hace falta cambiar `VERSION` en `sw.js` salvo que cambies el propio `sw.js`.
No subas `api/config.local.php` (es solo para Laragon) ni borres `api/_cache` del servidor.

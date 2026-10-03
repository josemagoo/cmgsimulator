// Punto de entrada: crea el juego y lo une todo (mundo, vehículo, cámara, entrada, interfaz, misiones, sonido).
import { $, env, store, IS_TOUCH } from './util.js';
import { Q } from './config.js';
import { settings, saveSettings } from './settings.js';
import { Bus } from './events.js';
import { Input } from './input.js';
import { Progress } from './progress.js';
import { Fx } from './fx.js';
import { Weapons } from './weapons.js';
import { Sound } from './sound.js';
import { CameraRig } from './camera.js';
import { Grade } from './grade.js';
import { World } from './world/world.js';
import { HUD } from './ui/hud.js';
import { Minimap } from './ui/minimap.js';
import { Hangar } from './ui/hangar.js';
import { TouchUI } from './ui/touch.js';
import { CockpitView } from './ui/instruments.js';
import { SettingsPanel } from './ui/settingsPanel.js';
import { Missions } from './missions.js';
import { Achievements } from './achievements.js';
import { findSpec, create, spawnPlace } from './vehicles/registry.js';

class Game {
  constructor() {
    const r = this.renderer = new THREE.WebGLRenderer({ antialias: Q.antialias && !(settings.gta && Q.grade), powerPreference: 'high-performance' });   // con el filtro de color el suavizado lo hace su propio búfer
    this.pr = Math.min(devicePixelRatio, Q.pixelRatio);
    // tarjetas integradas (Intel, móviles): como mucho la resolución real de la pantalla, sin superresolución
    try { const gl = r.getContext(), ext = gl.getExtension('WEBGL_debug_renderer_info'), name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : ''; this.gpu = name; if (/Intel|UHD|Iris|Mali|Adreno|PowerVR|Apple GPU|SwiftShader/i.test(name)) { this.pr = Math.min(this.pr, 1); this.weakGpu = true; } } catch (e) { /* ok */ }
    r.setPixelRatio(this.pr); r.setSize(innerWidth, innerHeight);
    r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
    r.info.autoReset = false;                 // se cuenta todo el fotograma (escena + filtro de color)
    r.domElement.id = 'gl'; document.body.prepend(r.domElement);
    env.maxAniso = r.capabilities.getMaxAnisotropy();

    this.grade = new Grade(r);
    document.body.classList.toggle('gta', !!settings.gta);
    this.scene = new THREE.Scene();
    this.camera = new THREE.PerspectiveCamera(65, innerWidth / innerHeight, 1, 11000);
    this.settings = settings;
    this.bus = new Bus();
    this.input = new Input(r.domElement);
    this.progress = new Progress();
    this.state = { hangarOpen: false, flying: false };
    this.ready = false;
    this.vehicle = null; this.preview = null; this.spec = null;

    this.hud = new HUD(this);
    this.fx = new Fx(this);
    this.sound = new Sound();
    this.weapons = new Weapons(this);
    this.world = new World(this);
    this.world.sky.onClock = t => this.hud.setClock(t); this.world.sky.applyTime();
    this.rig = new CameraRig(this.camera, this.input);
    this.rig.view = new CockpitView(this.camera, this.scene);
    this.minimap = new Minimap();
    this.hangar = new Hangar(this);
    this.missions = new Missions(this);
    this.achievements = new Achievements(this);
    this.settingsPanel = new SettingsPanel(this);
    this.touch = IS_TOUCH ? new TouchUI(this.input) : null;
    document.body.classList.toggle('touch', IS_TOUCH);
    if (this.touch) this.touch.show(false);

    this.bindInput(); this.bindEvents();
    // Al girar el teléfono algunos navegadores (sobre todo iOS) dan el tamaño nuevo tarde: se ajusta en cuanto avisan,
    // se vuelve a medir durante la animación del giro y además se comprueba en cada fotograma (ver frame), así la imagen
    // siempre ocupa la pantalla entera
    const refit = () => { this.resize(); for (const ms of [60, 180, 400, 800, 1500]) setTimeout(() => this.resize(), ms); };
    addEventListener('resize', () => this.resize()); addEventListener('orientationchange', refit);
    if (screen.orientation && screen.orientation.addEventListener) screen.orientation.addEventListener('change', refit);
    if (window.visualViewport) visualViewport.addEventListener('resize', () => this.resize());
    this.portraitMQ = matchMedia('(orientation: portrait) and (pointer: coarse)');     // el mismo aviso de "gira el teléfono" del CSS
    if (IS_TOUCH) {                       // sin zoom accidental de la página (doble toque o pellizco en iOS): descuadra todo al girar
      document.addEventListener('gesturestart', e => e.preventDefault());
      document.addEventListener('dblclick', e => e.preventDefault(), { passive: false });
    }
    this.onHomeRunway = () => {              // llegó la pista real de Camagüey: recoloca el avión si aún no ha despegado
      const v = this.vehicle;
      if (v && v.spec.category !== 'car' && !v.hasFlown && v.speed < 1) this.respawn();
    };
    this.last = performance.now(); this.slowT = 0; this.frames = 0; this.fpsT = 0;
  }

  resize() {
    const w = innerWidth, h = innerHeight;
    if (!w || !h) return;
    this.vw = w; this.vh = h;
    this.renderer.setSize(w, h);
    this.camera.aspect = w / h; this.camera.updateProjectionMatrix();
    if (scrollX || scrollY) scrollTo(0, 0);           // iOS a veces deja la página corrida después de girar
  }
  haptic(ms) { if (settings.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ok */ } } }

  bindInput() {
    const inp = this.input, sky = this.world.sky;
    const play = (name, fn) => inp.on(name, () => { if (!this.state.hangarOpen && this.ready) fn(); });
    inp.menuOpen = () => this.state.hangarOpen || this.settingsPanel.isOpen;
    inp.combatActive = () => this.weapons.armed && !inp.menuOpen();
    inp.keyHandlers.push(e => this.settingsPanel.handleKey(e) || this.hangar.handleKey(e));
    inp.on('anykey', () => this.sound.start());
    inp.on('pad', on => this.hud.msg(on ? '🎮 Mando conectado' : '🎮 Mando desconectado', 3));
    inp.on('menu', () => { if (!this.ready) return; if (this.hangar.isOpen) this.hangar.close(); else this.hangar.open(); this.sound.click(); });
    play('reset', () => this.respawn());
    play('camera', () => this.rig.toggle());
    for (const a of ['warp', 'light', 'gear', 'flaps', 'assist']) play(a, () => this.vehicle.action(a));
    inp.on('sound', () => this.sound.toggle());
    inp.on('shadows', () => sky.toggleShadows());
    inp.on('timeUp', () => sky.stepHour(1)); inp.on('timeDown', () => sky.stepHour(-1)); inp.on('timeAuto', () => sky.toggleAuto());
    inp.on('instr', () => { settings.instruments = !settings.instruments; saveSettings(); });
    inp.on('settings', () => this.settingsPanel.toggle());
    inp.on('weather', () => { if (this.world.weather) { const w = this.world.weather.cycle(); this.hud.msg('Clima: ' + w, 2); } });
    inp.on('mapIn', () => this.minimap.zoomBy(0.7)); inp.on('mapOut', () => this.minimap.zoomBy(1 / 0.7));
    inp.on('help', () => { const h = $('help'); h.style.display = h.style.display === 'none' ? '' : 'none'; });
  }

  // sonidos y vibración que dependen de lo que pasa en el juego
  bindEvents() {
    const b = this.bus;
    b.on('crash', () => { this.sound.boom(); this.haptic(400); });
    b.on('takeoff', () => this.sound.whoosh());
  }

  // ---- vehículo ----
  setVehicle(spec, place) {
    this.weapons.reset();
    if (this.vehicle) this.vehicle.unmount();
    this.clearPreview();
    const v = this.vehicle = create(spec); this.spec = spec;
    document.body.classList.toggle('drive', spec.category === 'car');           // en auto el minimapa es más grande
    v.mount(this);
    v.spawn(place || spawnPlace(spec, this.world), this.world);
    this.rig.snap(v); this.input.resetOrbit(); this.input.emit('vehicle-reset');
    if (this.touch) this.touch.configure(v.scheme(), !!spec.weapons);
    this.world.forceStream();
  }
  respawn() {
    this.weapons.reset();
    const v = this.vehicle;
    this.fx.clear(); v.spawn(spawnPlace(this.spec, this.world), this.world);
    this.rig.snap(v); this.input.resetOrbit(); this.input.emit('vehicle-reset'); this.hud.msg('');
    this.missions.onRespawn(); this.world.forceStream();
  }
  launch(spec, mission) {
    store.set('vehicle', { category: spec.category, id: spec.id });
    this.setVehicle(spec);
    this.state.hangarOpen = false; this.state.flying = true;
    if (this.touch) this.touch.show(true);
    this.sound.start(); this.sound.whoosh();
    const how = spec.startMsg || (spec.category === 'car' ? 'acelera para conducir' : 'sube los gases para despegar');
    this.hud.msg(`${spec.name} · máx. ${spec.vmax.toLocaleString('es')} km/h — ${how}`, 6);
    this.missions.begin(mission || null);
  }
  // menú: se muestra una copia del vehículo elegido mientras el real queda oculto y en pausa
  enterMenu() {
    this.state.hangarOpen = true; this.state.flying = false;
    if (this.touch) this.touch.show(false);
  }
  leaveMenu() {
    this.clearPreview(); this.vehicle.group.visible = true;
    this.state.hangarOpen = false; this.state.flying = true;
    if (this.touch) this.touch.show(true);
  }
  previewSpec(spec) {
    this.clearPreview();
    const p = create(spec); p.mount(this); p.placeLike(this.vehicle); this.preview = p;
    this.vehicle.group.visible = false;
  }
  clearPreview() { if (this.preview) { this.preview.unmount(); this.preview = null; } }

  // ---- tareas lentas (cada 0,5 s) ----
  slowTick(now) {
    if (now - this.slowT < 500 || !this.ready) return;
    this.slowT = now;
    const w = this.world, cam = this.camera.position, pos = this.vehicle.pos;
    let near = null, nd = 1e9;
    // rótulos: solo los 10 más cercanos (y no más lejos que labelDist) para no llenar la pantalla
    const vis = [];
    for (const c of w.osm.cells.values()) for (const s of c.labels) {
      const d = Math.hypot(s.position.x - cam.x, s.position.y - cam.y, s.position.z - cam.z);
      s.visible = false; if (!this.state.hangarOpen && d < Q.labelDist) vis.push([d, s]);
      const dh = Math.hypot(s.position.x - pos.x, s.position.z - pos.z);
      if (dh < 450 && dh < nd) { nd = dh; near = s.userData.name; }
    }
    vis.sort((a, b) => a[0] - b[0]); for (let i = 0; i < Math.min(10, vis.length); i++) vis[i][1].visible = true;
    $('poi').textContent = near ? '📍 ' + near : '';
    // calle más cercana con nombre (para ubicarse cuando se va en auto o volando bajo)
    let street = '', sd = 26;
    if (this.vehicle.spec.category === 'car' || (this.vehicle.agl || 0) < 250) for (const c of w.osm.cells.values()) for (const r of (c.roadInfos || [])) {
      if (!r.name) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const p = r.pts[i], q = r.pts[i + 1], dx = q.x - p.x, dz = q.z - p.z, l2 = dx * dx + dz * dz || 1, t = Math.max(0, Math.min(1, ((pos.x - p.x) * dx + (pos.z - p.z) * dz) / l2));
        const d = Math.hypot(p.x + dx * t - pos.x, p.z + dz * t - pos.z);
        if (d < sd) { sd = d; street = r.name; }
      }
    }
    if (street !== this.street) { this.street = street; $('street').textContent = street; }
    this.nearPlace = near;
    let bi = 0, bd = 1e12;
    w.airports.list.forEach((a, i) => { const d = Math.hypot(a.x - pos.x, a.z - pos.z); if (d < bd) { bd = d; bi = i; } });
    $('city').textContent = w.airports.list[bi].name + ', Cuba';
    w.airports.prefetch(now, pos, this.progress);
  }

  // resolución dinámica: baja la nitidez si el dispositivo no llega a ~30 fps
  adapt(dt) {
    this.frames++; this.fpsT += dt;
    if (this.fpsT < 2.5) return;
    const fps = this.frames / this.fpsT; this.frames = 0; this.fpsT = 0;
    const max = Math.min(devicePixelRatio, Q.pixelRatio, this.weakGpu ? (IS_TOUCH ? 1.5 : 1) : 9);    // el móvil gana nitidez si le sobra potencia
    // si ni con la nitidez mínima llega a 24 fps, se sugiere (una vez) la calidad baja
    this.slowN = fps < 24 && this.pr <= 0.71 && this.state.flying ? (this.slowN || 0) + 1 : 0;
    if (this.slowN === 3 && settings.quality !== 'low' && !this.slowTold) { this.slowTold = true; this.hud.msg('Va lento: en Ajustes ⚙ elige calidad «Baja»', 7); }
    if (fps < 26 && this.pr > 0.7) this.pr = Math.max(0.7, this.pr - 0.2);
    else if (fps < 42 && this.pr > 1) this.pr = Math.max(1, this.pr - 0.1);
    else if (fps > 56 && this.pr < max) this.pr = Math.min(max, this.pr + 0.1);
    else return;
    this.renderer.setPixelRatio(this.pr); this.resize();
  }

  frame(now) {
    const dt = Math.min((now - this.last) / 1000, 0.05); this.last = now;
    const sz = this.renderer.getSize(this.szV || (this.szV = new THREE.Vector2()));
    if (sz.x !== innerWidth || sz.y !== innerHeight) this.resize();             // un giro de pantalla se nota al momento, siempre
    const portrait = IS_TOUCH && this.portraitMQ.matches;                       // con el aviso de girar el teléfono: en pausa
    this.input.poll(dt, now);
    const menu = this.state.hangarOpen, v = this.vehicle, w = this.world;
    const active = menu && this.preview ? this.preview : v;
    const playing = this.ready && !menu && !this.settingsPanel.isOpen && !portrait;
    if (playing) {
      const previousPos = v.pos.clone(); v.update(dt, this.input, w);
      this.weapons.update(dt, this.input, w, previousPos);
      this.missions.update(dt); this.achievements.update(dt);
    } else this.weapons.bombHeld = this.input.down('KeyB');
    w.update(dt, now, active.pos, this.camera.position, active.approach || null);
    this.fx.update(dt, w);
    v.animate(dt, now, w);
    if (active !== v) active.animate(dt, now, w);
    this.rig.update(dt, now, active, w, menu);
    this.weapons.drawAim(playing);
    if (this.rig.view && this.rig.view.g.visible) this.rig.view.update(v.instr(w), v.steerAngle);
    this.slowTick(now);
    this.hud.update(dt);
    if ((this.mmT = (this.mmT || 0) + dt) > 1 / 15) { this.mmT = 0; this.minimap.draw(this); }      // el minimapa no necesita 60 fps
    this.sound.update(v, { silent: menu || portrait, rain: w.weather ? w.weather.rain : 0, agl: v.agl || 0 });
    if (portrait) { this.frames = 0; this.fpsT = 0; return; }                   // la ciudad sigue cargando, pero no se dibuja tapada
    this.renderer.info.reset();
    if (settings.gta && Q.grade) this.grade.render(this.scene, this.camera, now); else this.renderer.render(this.scene, this.camera);
    this.adapt(dt);
  }

  async start() {
    // vehículo inicial: el último elegido; siempre se empieza en Camagüey
    const saved = store.get('vehicle', null);
    const spec = saved ? findSpec(saved.category, saved.id) : findSpec('plane', null);
    const t0 = performance.now();
    this.setVehicle(spec);
    await this.world.init(this.vehicle.pos);
    this.respawn();
    this.ready = true;
    this.world.startStreaming(this.vehicle.pos);
    this.hangar.prepare();
    this.hangar.open();
    // pantalla de carga con barra de progreso real: espera a tener pista, relieve, imágenes y las primeras calles
    const l = $('loading'), bar = $('loadbar').firstElementChild, info = $('loadinfo');
    const done = () => { l.style.opacity = 0; setTimeout(() => l.remove(), 700); };
    const tick = () => {
      const p = this.world.loadProgress(), el = performance.now() - t0;
      bar.style.width = Math.round(p * 100) + '%';
      info.textContent = p < 0.3 ? 'Descargando pista y relieve…' : p < 0.6 ? 'Cargando imágenes satelitales…' : 'Construyendo la ciudad…';
      if ((p >= 0.9 && el > 1500) || el > 25000) done(); else setTimeout(tick, 250);
    };
    tick();
    requestAnimationFrame(t => { this.last = t; });
  }
  run() { const loop = t => { this.frame(t); requestAnimationFrame(loop); }; requestAnimationFrame(loop); }
}

const game = window.__game = new Game();
game.run();
game.start();

// solo en producción (HTTPS): así no se guardan versiones viejas del código mientras desarrollas.
// Al desplegar, index.html trae <meta name="sw"> con la huella de sw.js para saltarse cualquier copia vieja de la CDN.
if ('serviceWorker' in navigator && location.protocol === 'https:') {
  const meta = document.querySelector('meta[name="sw"]');
  navigator.serviceWorker.register(meta ? meta.content : 'sw.js').catch(() => { /* ok */ });
}

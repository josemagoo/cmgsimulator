// Avión: física arcade con relieve, aterrizaje en pistas reales, tren y flaps, pérdida de sustentación,
// viento y turbulencia, asistencia de aterrizaje y crucero rápido
import { clamp, wrapPi, IS_TOUCH } from '../util.js';
import { bearing } from '../geo.js';
import { glowTex } from '../gfx.js';
import { settings } from '../settings.js';
import { Vehicle } from './vehicle.js';
import { buildPlaneModel } from './planeModels.js';

const G = 9.8;
const _d = new THREE.Vector3();

export class PlaneVehicle extends Vehicle {
  constructor(spec) {
    super(spec);
    this.M = buildPlaneModel(spec);
    this.group.add(this.M.group);
    this.M.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.M.discs.forEach(d => { d.castShadow = false; });
    // mancha de luz de aterrizaje y sombra difusa (para cuando vuelas alto)
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(34, 70), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xfff2c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.pool.rotation.order = 'YXZ'; this.pool.renderOrder = 3;
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: PlaneVehicle.blobTex(), transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1;
    this.extras.push(this.pool, this.blob);
    this.light = true; this.assist = false;
    this.resetState();
  }
  static blobTex() {
    if (!PlaneVehicle._blob) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      PlaneVehicle._blob = new THREE.CanvasTexture(c);
    }
    return PlaneVehicle._blob;
  }

  resetState() {
    Object.assign(this, { pitch: 0, roll: 0, speed: 0, thr: 0, onGround: true, hasFlown: false, crashed: false, landed: false, vy: 0, touch: 0, agl: 0, warp: false,
      gearTarget: 1, gearT: 1, flaps: 0, stallWarn: false, shake: 0, approach: null, autoOn: false, landing: null, world: null });
    this.group.visible = true; this.M.discs.forEach(d => { d.visible = true; });
  }
  scheme() { return 'plane'; }
  // velocidad mínima para volar; los flaps la bajan
  st() { return this.spec.st * (1 - 0.06 * this.flaps); }
  cameraSpec() {
    const k = this.spec.camK;
    return { dist: 12 * k, height: 3.6 * k, look: 25, pitchFollow: 0.3, cockpit: this.M.cockpit, fovBase: 65, fovBoost: 10, boostRatio: clamp(this.speed / this.spec.vm, 0, 1) };
  }

  spawn(place, world) {
    const rw = place.runway;
    const sx = rw.cx - rw.ax * (rw.len / 2 - 120), sz = rw.cz - rw.az * (rw.len / 2 - 120);
    this.resetState();
    this.pos.set(sx, world.terrainH(sx, sz), sz); this.yaw = -rw.hdg;
    this.game.input.throttleSlider = null;
  }

  action(name) {
    const hud = this.game.hud, snd = this.game.sound;
    if (name === 'light') this.light = !this.light;
    if (name === 'warp') this.toggleWarp();
    if (name === 'gear') {
      if (!this.spec.retract) { hud.msg('Esta avioneta lleva el tren fijo', 2); return; }
      if (this.onGround) { hud.msg('No puedes subir el tren en tierra', 2); return; }
      this.gearTarget = this.gearTarget ? 0 : 1; snd.clunk(); hud.msg(this.gearTarget ? '⬇ Tren abajo' : '⬆ Tren arriba', 1.5);
    }
    if (name === 'flaps') { this.flaps = (this.flaps + 1) % 4; snd.click(); hud.msg('Flaps ' + this.flaps + (this.flaps ? ' · más sustentación a baja velocidad' : ''), 1.5); }
    if (name === 'assist') { this.assist = !this.assist; snd.click(); hud.msg(this.assist ? '🛬 Asistencia de aterrizaje ACTIVADA (alinéate con una pista)' : 'Asistencia desactivada', 2.5); }
  }
  toggleWarp() {
    const g = this.game;
    if (this.warp) { this.warp = false; return; }
    if (this.onGround || this.agl < 250) { g.hud.msg('Sube a más de 250 m para el crucero rápido', 3); return; }
    if (g.world.airports.nearestDist(this.pos) < 9000) { g.hud.msg('Aléjate más de 9 km de un aeropuerto', 3); return; }
    this.warp = true;
  }

  crash(reason) {
    this.crashed = true; this.speed = 0; this.warp = false;
    this.group.visible = false; this.M.discs.forEach(d => { d.visible = false; });
    this.game.hud.msg('💥 ' + reason + ' — pulsa R para reintentar');
    this.game.fx.explode(this.pos);
    this.game.bus.emit('crash', { vehicle: this, reason });
  }

  // Piloto automático de aproximación: sigue la senda de 3° y el eje de pista, ajusta velocidad, tren y flaps, y redondea al tocar
  autopilot(world) {
    const a = this.approach, st = this.st(), vApp = st * 1.3, P = this.spec;
    if (P.retract && a.s < 9000) this.gearTarget = 1;
    const fl = a.s < 3000 ? 3 : a.s < 5000 ? 2 : a.s < 7000 ? 1 : 0;
    if (a.s < 9000 && this.flaps !== fl && !this.onGround) this.flaps = Math.max(this.flaps, fl);
    let pitchT = -(3 + clamp(a.dev * 0.8, -2, 2)) * Math.PI / 180;
    if (this.agl < 15) pitchT = Math.max(Math.asin(clamp(-1.0 / Math.max(this.speed, 20), -0.2, 0)), -0.03);   // redondeo: ~1 m/s de descenso
    if (this.onGround) pitchT = 0;
    const yawT = Math.atan2(-a.t.x, -a.t.z), corr = clamp(a.lat / Math.max(a.s, 600) * 1.2, -0.5, 0.5);
    return {
      pitch: clamp((pitchT - this.pitch) * 4, -1, 1),
      roll: clamp(wrapPi(yawT + corr - this.yaw) * 2.2, -1, 1),
      thr: this.onGround ? -1 : clamp((vApp - this.speed) * 0.15, -1, 1),
      brake: this.onGround,
    };
  }

  update(dt, input, world) {
    if (this.crashed) return;
    const P = this.spec, g = this.game, now = performance.now();
    this.world = world;
    if (this.warp && (this.onGround || this.agl < 250 || world.airports.nearestDist(this.pos) < 9000)) this.warp = false;

    this.forward(_d);
    this.approach = world.airports.approach(this.pos, _d);

    // ---- entradas (teclado, mando, táctil) y, si está activada, la asistencia ----
    const inv = settings.invertY ? -1 : 1;
    let pitchIn = inv * input.axis(['KeyW', 'ArrowUp'], ['KeyS', 'ArrowDown'], input.stick.y);     // + = tirar hacia atrás
    let rollIn = -input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight'], input.stick.x);        // + = inclinar a la izquierda
    let thrKey = input.axis(['ControlLeft', 'ControlRight', 'KeyQ'], ['ShiftLeft', 'ShiftRight', 'KeyE'], input.trigger);
    let brake = input.down('Space');
    this.autoOn = false;
    if (this.assist && this.approach) {
      const A = this.autopilot(world); this.autoOn = true;
      if (Math.abs(pitchIn) < 0.1) pitchIn = A.pitch;
      if (Math.abs(rollIn) < 0.1) rollIn = A.roll;
      if (Math.abs(thrKey) < 0.1) thrKey = A.thr;
      if (A.brake) brake = true;
    } else if (this.assist && this.onGround && this.hasFlown && this.speed > 0.5) {   // tras tocar: frena y se mantiene en el eje de pista
      const r = world.onRunway(this.pos);
      if (r) {
        const dir = (-Math.sin(this.yaw) * r.ax - Math.cos(this.yaw) * r.az) >= 0 ? 1 : -1;
        if (Math.abs(rollIn) < 0.1) rollIn = clamp(wrapPi(Math.atan2(-dir * r.ax, -dir * r.az) - this.yaw) * 2.2, -1, 1);
        thrKey = -1; brake = true; this.autoOn = true;
      }
    }
    if (input.throttleSlider !== null && !this.autoOn) this.thr = input.throttleSlider;
    else this.thr = clamp(this.thr + thrKey * 0.45 * dt, 0, 1);
    this.gearT += (this.gearTarget - this.gearT) * Math.min(1, dt * 1.6);

    const st = this.st(), rot = st + 4;
    // ---- cabeceo ----
    this.pitch = clamp(this.pitch + pitchIn * P.pitchRate * dt, -0.6, 0.6);
    if (this.onGround) this.pitch = this.speed < rot ? 0 : Math.max(this.pitch, 0);
    else if (this.speed < st) this.pitch -= (1 - this.speed / st) * 0.8 * dt;

    // ---- giro ----
    if (this.onGround) {                       // en tierra: timón
      this.roll = 0;
      this.yaw += rollIn * 0.6 * Math.min(this.speed / 12, 1) * clamp(40 / Math.max(this.speed, 40), 0.35, 1) * dt;
    } else {                                   // en el aire: inclinas y el avión vira
      this.roll += (rollIn * P.rollMax - this.roll) * Math.min(1, 3 * dt);
      this.yaw += (this.roll / P.rollMax) * P.turn * dt;
    }

    // ---- velocidad ----
    const drag = P.k * (1 + 0.12 * this.flaps) * (P.retract && this.gearT > 0.5 ? 1.06 : 1) * this.speed * this.speed;
    let fric = 0;
    if (this.onGround) fric = (world.onRunway(this.pos) ? 0.3 : 2.5) + (brake ? 9 : 0);
    else if (brake) fric = 2;
    this.speed = Math.max(0, this.speed + (this.thr * P.thrust - drag - G * Math.sin(this.pitch) * 0.9 - (this.speed > 0 ? fric : 0)) * dt);

    // ---- movimiento (con viento y turbulencia) ----
    const sink = this.onGround && this.pitch === 0 ? 0 : Math.max(0, st - this.speed) * 0.9;
    const vy = this.speed * Math.sin(this.pitch) - sink;
    this.forward(_d);
    const tm = this.warp ? 8 : 1;
    this.pos.x += _d.x * this.speed * dt * tm;
    this.pos.z += _d.z * this.speed * dt * tm;
    this.shake = 0;
    const wx = world.weather;
    if (wx && !this.onGround) {
      this.pos.x += wx.wind.x * dt; this.pos.z += wx.wind.z * dt;            // el viento arrastra el avión
      const tb = wx.turb(now, this.agl);
      this.roll += tb.r * dt; this.pitch += tb.p * dt * 0.5; this.pos.y += tb.v * dt; this.shake = tb.mag * 0.6;
    }
    this.stallWarn = !this.onGround && this.hasFlown && this.speed < st * 1.12;
    if (this.stallWarn) this.shake = Math.max(this.shake, clamp((st * 1.12 - this.speed) / (st * 0.25), 0, 1));

    const gh = world.terrainH(this.pos.x, this.pos.z);
    const wasAir = !this.onGround;
    this.pos.y += vy * dt;
    this.vy = vy;

    const agl = this.pos.y - gh;
    if (agl <= 0 || (!wasAir && vy <= 0.4 && agl < 1.5)) {     // toca el suelo, o lo sigue en pendiente
      this.pos.y = gh; this.onGround = true;
      if (wasAir) this.touchdown(-vy, world);
    } else {
      this.onGround = false;
      if (agl > 8) { if (!this.hasFlown) g.bus.emit('takeoff', { vehicle: this }); this.hasFlown = true; this.landed = false; }
    }
    this.agl = this.pos.y - gh;
    if (this.crashed) return;
    if (world.hitsBuilding(this.pos)) return this.crash('Chocaste con un edificio');
    if (this.onGround && this.speed > 15 && !world.onRunway(this.pos) && world.slopeAhead(this.pos, this.yaw, 12) > 0.3) return this.crash('Chocaste contra el terreno');

    if (this.hasFlown && this.onGround && this.speed < 1 && !this.landed) {
      this.landed = true;
      const rr = world.onRunway(this.pos), t = this.touch;
      const stars = t < 2 ? 3 : t < 4 ? 2 : 1;
      g.hud.msg(`${'⭐'.repeat(stars)} ${stars === 3 ? '¡Aterrizaje perfecto!' : stars === 2 ? 'Buen aterrizaje' : 'Aterrizaje duro'} · ${rr ? 'en ' + world.airports.name(rr) : 'fuera de pista'} — R para volar de nuevo`);
      if (rr) g.progress.landedAt(rr, world, g.hud);
      g.bus.emit('landed', { vehicle: this, runway: rr, stars, touch: t, landing: this.landing });
    }
  }

  touchdown(impact, world) {
    const P = this.spec, hud = this.game.hud;
    this.touch = impact;
    const r = world.onRunway(this.pos);
    if (P.retract && this.gearT < 0.8) return this.crash('Aterrizaste con el tren arriba');
    if (!r && this.speed > 20 && world.slopeAhead(this.pos, this.yaw, 15) > 0.25) return this.crash('Chocaste contra el terreno');
    if (impact > (r ? P.maxImpact : 3.5)) return this.crash('Aterrizaje demasiado brusco');
    if (Math.abs(this.roll) > 0.4) return this.crash('Tocaste con un ala');
    if (this.pitch > 0.45) return this.crash('Tocaste con la cola');
    if (r) {
      const rel = Math.abs(wrapPi(this.yaw + r.hdg)), skew = Math.min(rel, Math.PI - rel);
      if (skew > 0.5 && this.speed > 15) return this.crash('Tocaste de lado');
      // distancia al punto de toma ideal (300 m tras el umbral) para las misiones de precisión
      const dir = (-Math.sin(this.yaw) * r.ax - Math.cos(this.yaw) * r.az) >= 0 ? 1 : -1, k = -r.len / 2 + 300;
      const ax = r.cx + dir * r.ax * k, az = r.cz + dir * r.az * k, vx = this.pos.x - ax, vz = this.pos.z - az;
      this.landing = { r, long: vx * dir * r.ax + vz * dir * r.az, lat: vx * -dir * r.az + vz * dir * r.ax, impact, speed: this.speed };
    } else this.landing = null;
    if (this.hasFlown) hud.msg(r ? 'Tocaste pista — frena con Espacio y baja los gases' : 'Aterrizaje fuera de pista', 4);
    this.roll = 0;
    this.game.sound.thump(impact / 3);
    this.game.haptic(30 + impact * 12);
    this.game.bus.emit('touchdown', { vehicle: this, impact, runway: r, landing: this.landing });
  }

  hud() {
    const wx = this.world && this.world.weather;
    return { name: this.spec.name + (this.warp ? ' · ⏩ crucero ×8 (F para salir)' : ''), speedKmh: this.speed * 3.6, mach: this.speed / 340,
      alt: this.agl, vs: this.onGround ? 0 : this.vy, hdg: this.heading(), thr: this.thr,
      extra: [this.spec.retract ? (this.gearT > 0.9 ? '⬇ tren' : this.gearT < 0.1 ? '⬆ tren' : '… tren') : '', this.flaps ? `flaps ${this.flaps}` : '', this.autoOn ? '🛬 asistido' : ''].filter(Boolean).join(' · '),
      wind: wx ? wx.wind : null };
  }
  // datos para los instrumentos
  instr(world) {
    const wx = world.weather;
    return { kind: 'air', pitch: this.pitch, roll: this.roll, hdg: this.heading(), speedKmh: this.speed * 3.6, mach: this.speed / 340, alt: this.agl,
      vs: this.onGround ? 0 : this.vy, thr: this.thr, gear: this.spec.retract ? this.gearT : null, flaps: this.flaps,
      ils: this.approach && !this.onGround ? this.approach : null, assist: this.autoOn, stall: this.stallWarn,
      wind: wx && wx.wind.speed > 0.5 ? { dir: (bearing(wx.wind.x, wx.wind.z) - this.heading()) * Math.PI / 180, speed: wx.wind.speed } : null };
  }
  hint() {
    const P = this.spec, v = this.speed, alt = this.agl, a = this.approach, w = this.world;
    if (this.crashed || this.landed) return '';
    if (this.onGround && !this.hasFlown) return v < 1 ? (IS_TOUCH ? 'Sube GASES al máximo (desliza hacia arriba) para despegar' : 'Sube los gases al máximo para despegar') : v < this.st() + 4 ? 'Acelera al máximo, sigue recto…' : IS_TOUCH ? 'Ahora baja la palanca (tira hacia ti) para despegar' : 'Ahora tira hacia atrás para despegar';
    if (this.stallWarn) return '⚠ ¡Pérdida de sustentación! Baja la nariz y sube gases';
    if (!this.onGround && alt < 60 && this.vy < -5) return '⚠ Desciendes muy rápido: sube la nariz';
    if (a && !this.onGround && alt < 2500 && w) {
      if (P.retract && this.gearT < 0.5 && a.s < 8000 && !this.autoOn) return '🛬 Baja el tren de aterrizaje (G)';
      const vert = a.dev > 0.5 ? 'alto: baja la nariz' : a.dev < -0.5 ? 'bajo: sube la nariz' : 'senda correcta';
      const lat = a.lat > 60 ? 'vira a la izquierda' : a.lat < -60 ? 'vira a la derecha' : 'alineado';
      return `🛬 ${w.airports.name(a.r)} · a ${(a.s / 1000).toFixed(1)} km · ${vert} · ${lat}${this.autoOn ? ' · asistido' : ' · X = asistencia'}`;
    }
    if (this.onGround) return 'Frena y baja los gases';
    if (alt < 250 && this.hasFlown && !this.warp) return `Para aterrizar: gases bajos, ~${Math.round(this.st() * 3.6 * 1.25)} km/h, nariz ligeramente abajo y nivela justo antes de tocar`;
    return '';
  }
  mapRange() { return 10000; }
  sound() {
    const P = this.spec, v = this.speed / P.vm;
    return { freq: P.snd[0] + this.thr * P.snd[1] + this.speed * 0.3, filter: P.snd[2], gain: 0.03 + this.thr * 0.05,
      wind: this.onGround ? v * 0.3 : clamp(v * 1.4, 0, 1), roll: this.onGround ? clamp(this.speed / 60, 0, 1) : 0, stall: this.stallWarn };
  }

  // animaciones y efectos (también con el menú abierto)
  animate(dt, now, world) {
    super.animate(dt, now, world);
    const M = this.M, sky = world.sky, night = sky.nightLevel;
    for (const pr of M.props) pr.rotation.z += (12 + this.thr * 70) * dt;
    for (const d of M.discs) d.material.opacity = clamp(this.thr * 0.35 + (this.speed > 5 ? 0.05 : 0), 0, 0.4);
    if (M.flame) {                                                       // postquemador
      const f = clamp((this.thr - 0.5) / 0.5, 0, 1) * (0.85 + 0.15 * Math.random());
      M.flame.scale.setScalar(M.flameSize * f + 0.01); M.flame.material.opacity = f; M.flame.visible = !this.crashed;
    }
    if (M.gearGroup) { const t = this.gearT; M.gearGroup.visible = t > 0.04; M.gearGroup.position.y = (1 - t) * (M.fy + 0.6); }   // el tren sube al fuselaje
    const navA = 0.35 + 0.65 * night;
    M.navL.material.opacity = M.navR.material.opacity = navA;
    M.navT.material.opacity = navA * (Math.sin(now * 0.008) > 0.6 ? 1 : 0.1);
    M.navL.visible = M.navR.visible = M.navT.visible = !this.crashed;
    const alt = this.agl, gh = this.pos.y - alt;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), px = this.pos.x + fx * 50, pz = this.pos.z + fz * 50;
    this.pool.position.set(px, world.terrainH(px, pz) + 0.5, pz);
    this.pool.rotation.set(-Math.PI / 2, this.yaw, 0);
    this.pool.material.opacity = this.light && !this.crashed && this.game.state.flying ? 0.55 * night * clamp(1 - alt / 120, 0, 1) : 0;
    const sd = sky.sunDir, sy = Math.max(sd.y, 0.2), k = this.spec.camK;
    this.blob.position.set(this.pos.x - sd.x / sy * alt, gh + 0.3, this.pos.z - sd.z / sy * alt);
    this.blob.rotation.z = this.yaw; this.blob.scale.set((13 + alt * 0.02) * k, (9 + alt * 0.02) * k, 1);
    this.blob.material.opacity = clamp((alt - 120) / 200, 0, 1) * clamp(1 - alt / 500, 0, 1) * (1 - night);
    this.blob.visible = !this.crashed;
  }
}

// Helicóptero: ascenso/descenso, vuelo estacionario, avance, giro con pedales y aterrizaje en cualquier sitio
import { clamp, IS_TOUCH } from '../util.js';
import { bearing } from '../geo.js';
import { glowTex } from '../gfx.js';
import { Vehicle } from './vehicle.js';
import { buildHeliModel } from './heliModels.js';

const _d = new THREE.Vector3();

export class HelicopterVehicle extends Vehicle {
  constructor(spec) {
    super(spec);
    this.M = buildHeliModel(spec);
    this.group.add(this.M.group);
    this.M.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.M.discs.forEach(d => { d.castShadow = false; });
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(22, 44), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xfff2c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.pool.rotation.order = 'YXZ'; this.pool.renderOrder = 3;
    this.blob = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshBasicMaterial({ map: HelicopterVehicle.blobTex(), transparent: true, depthWrite: false }));
    this.blob.rotation.x = -Math.PI / 2; this.blob.renderOrder = 1;
    this.extras.push(this.pool, this.blob);
    this.light = true; this.rotor = 1; this.rotAngle = 0;
    this.resetState();
    this.rotor = 1;                              // en el menú las palas ya giran
  }
  static blobTex() {
    if (!HelicopterVehicle._blob) {
      const c = document.createElement('canvas'); c.width = c.height = 64;
      const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 2, 32, 32, 30);
      gr.addColorStop(0, 'rgba(0,0,0,.6)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
      HelicopterVehicle._blob = new THREE.CanvasTexture(c);
    }
    return HelicopterVehicle._blob;
  }

  resetState() {
    Object.assign(this, { pitch: 0, roll: 0, speed: 0, u: 0, w: 0, vy: 0, rotor: 0.3, onGround: true, hasFlown: false, crashed: false, landed: false, touch: 0, agl: 0, warp: false });
    this.group.visible = true; this.M.discs.forEach(d => { d.visible = true; });
  }
  scheme() { return 'heli'; }
  mapRange() { return 6000; }
  cameraSpec() {
    const k = this.spec.camK;
    return { dist: 14 * k, height: 4.6 * k, look: 18, pitchFollow: 0.25, cockpit: this.M.cockpit, fovBase: 65, fovBoost: 8, boostRatio: clamp(this.speed / this.spec.vm, 0, 1) };
  }

  // se coloca junto a la pista (sobre la hierba) para no estorbar a los aviones
  spawn(place, world) {
    const rw = place.runway;
    const sx = rw.cx - rw.ax * (rw.len / 2 - 140) + rw.az * (rw.w / 2 + 45), sz = rw.cz - rw.az * (rw.len / 2 - 140) - rw.ax * (rw.w / 2 + 45);
    this.resetState();
    this.pos.set(sx, world.terrainH(sx, sz), sz); this.yaw = -rw.hdg;
    this.game.input.throttleSlider = null; this.game.input.emit('vehicle-reset');
  }
  action(name) {
    if (name === 'light') this.light = !this.light;
    if (name === 'warp') this.toggleWarp();
  }
  toggleWarp() {
    const g = this.game;
    if (this.warp) { this.warp = false; return; }
    if (this.onGround || this.agl < 250) { g.hud.msg('Sube a más de 250 m para el crucero rápido', 3); return; }
    if (g.world.airports.nearestDist(this.pos) < 9000) { g.hud.msg('Aléjate más de 9 km de un aeropuerto', 3); return; }
    this.warp = true;
  }
  crash(reason) {
    this.crashed = true; this.speed = 0; this.u = this.w = this.vy = 0; this.warp = false;
    this.group.visible = false;
    this.game.hud.msg('💥 ' + reason + ' — pulsa R para reintentar');
    this.game.fx.explode(this.pos);
    this.game.bus.emit('crash', { vehicle: this, reason });
  }

  update(dt, input, world) {
    if (this.crashed) return;
    const s = this.spec, g = this.game; this.world = world;
    if (this.warp && (this.onGround || this.agl < 250 || world.airports.nearestDist(this.pos) < 9000)) this.warp = false;

    // ---- entradas ----
    const fwdIn = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp'], -input.stick.y);          // + = adelante
    const yawIn = input.axis(['KeyD', 'ArrowRight'], ['KeyA', 'ArrowLeft'], -input.stick.x);       // + = girar a la izquierda
    const strafeIn = input.axis(['KeyQ'], ['KeyE']);                                                // + = lateral derecha
    let vIn = input.throttleSlider !== null ? (input.throttleSlider - 0.5) * 2 : input.axis(['ControlLeft', 'ControlRight'], ['ShiftLeft', 'ShiftRight'], input.trigger);
    if (Math.abs(vIn) < 0.07) vIn = 0;
    const brake = input.down('Space');

    // ---- motor y sustentación ----
    this.rotor = Math.min(1, this.rotor + dt / 3.5);               // las palas tardan unos segundos en coger vuelo
    let vyT = vIn > 0 ? vIn * s.climb : vIn * s.descend;
    if (this.rotor < 0.85) vyT = Math.min(vyT, 0);
    if (vyT < 0) vyT = Math.max(vyT, -(0.8 + this.agl * 0.5));     // colchón de aire: la bajada se frena sola cerca del suelo
    this.vy += (vyT - this.vy) * Math.min(1, 2.2 * dt);
    if (this.onGround && this.vy < 0) this.vy = 0;

    // ---- velocidad horizontal con inercia ----
    const tm = this.warp ? 8 : 1;
    const gnd = this.onGround ? 0.15 : 1;
    const uT = fwdIn * (fwdIn > 0 ? s.vm : s.vm * 0.25) * gnd, wT = strafeIn * s.vm * 0.25 * gnd;
    const k = Math.min(1, 0.9 * dt);
    this.u += (uT - this.u) * k; this.w += (wT - this.w) * k;
    if (brake) { const f = Math.exp(-2.5 * dt); this.u *= f; this.w *= f; }
    this.speed = Math.hypot(this.u, this.w);
    this.yaw += yawIn * s.yawRate * dt * (this.onGround && this.rotor < 0.85 ? 0 : 1);

    // ---- inclinación visual: nariz abajo al avanzar, alabeo al girar y al ir de lado ----
    const sr = this.u / s.vm;
    const pT = this.onGround ? 0 : -clamp(sr, -0.3, 1) * 0.32;
    const rT = this.onGround ? 0 : clamp(yawIn * Math.abs(sr) * 0.45, -0.4, 0.4) - clamp(this.w / (s.vm * 0.25), -1, 1) * 0.2;
    this.pitch += (pT - this.pitch) * Math.min(1, 3 * dt); this.roll += (rT - this.roll) * Math.min(1, 3 * dt);

    // ---- movimiento ----
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), rx = Math.cos(this.yaw), rz = -Math.sin(this.yaw);
    this.pos.x += (fx * this.u + rx * this.w) * dt * tm;
    this.pos.z += (fz * this.u + rz * this.w) * dt * tm;
    const gh = world.terrainH(this.pos.x, this.pos.z);
    const wasAir = !this.onGround;
    this.pos.y += this.vy * dt;
    const agl = this.pos.y - gh;
    if (agl <= 0) {                                               // contacto con el suelo
      const impact = -this.vy;
      this.pos.y = gh;
      if (wasAir) {
        const r = world.onRunway(this.pos);
        if (impact > s.maxImpact) return this.crash('Aterrizaje demasiado brusco');
        if (this.speed > 16) return this.crash('Aterrizaste demasiado rápido');
        if (Math.abs(this.pitch) > 0.4 || Math.abs(this.roll) > 0.4) return this.crash('Aterrizaste inclinado');
        this.touch = impact; this.vy = 0; this.onGround = true;
        if (this.hasFlown) g.hud.msg(r ? 'Tocaste pista' : 'Aterrizaje suave', 2.5);
      } else this.vy = Math.max(this.vy, 0);
      this.onGround = true;
    } else if (agl > 0.05 || this.vy > 0.2) {
      this.onGround = false;
      if (agl > 6) { if (!this.hasFlown) g.bus.emit('takeoff', { vehicle: this }); this.hasFlown = true; this.landed = false; }
    }
    this.agl = this.pos.y - gh;
    if (world.hitsBuilding(this.pos)) return this.crash('Chocaste con un edificio');

    if (this.hasFlown && this.onGround && this.speed < 0.5 && !this.landed) {
      this.landed = true;
      const rr = world.onRunway(this.pos);
      g.hud.msg(`Aterrizaste ${rr ? 'en ' + world.airports.name(rr) : 'con suavidad'} — R para volver a empezar`);
      if (rr) g.progress.landedAt(rr, world, g.hud);
      g.bus.emit('landed', { vehicle: this, runway: rr, stars: this.touch < 1.5 ? 3 : this.touch < 3 ? 2 : 1, touch: this.touch, landing: null });
    }
  }

  hud() {
    const wx = this.world && this.world.weather;
    return { name: this.spec.name + (this.warp ? ' · ⏩ crucero ×8 (F para salir)' : ''), speedKmh: this.speed * 3.6, alt: this.agl, vs: this.vy, hdg: this.heading(), wind: wx ? wx.wind : null };
  }
  hint() {
    if (this.crashed || this.landed) return '';
    if (this.onGround && !this.hasFlown) return this.rotor < 0.85 ? 'Arrancando el motor…' : IS_TOUCH ? 'Sube ALTURA para despegar · la palanca avanza y gira · ◀ ▶ de lado' : 'Sube con Shift (gatillo derecho / deslizador) · W avanza · A D giran';
    if (!this.onGround && this.agl < 40 && this.vy < -3) return '⚠ Desciendes muy rápido: frena la bajada';
    if (!this.onGround && this.agl < 60 && this.speed < 6) return 'Baja despacio y posa el helicóptero con suavidad';
    return '';
  }
  instr(world) {
    const wx = world.weather;
    return { kind: 'air', pitch: this.pitch, roll: this.roll, hdg: this.heading(), speedKmh: this.speed * 3.6, mach: 0, alt: this.agl, vs: this.vy,
      gear: null, flaps: null, ils: null, assist: false, stall: false,
      wind: wx && wx.wind.speed > 0.5 ? { dir: (bearing(wx.wind.x, wx.wind.z) - this.heading()) * Math.PI / 180, speed: wx.wind.speed } : null };
  }
  sound() {
    const v = this.speed / this.spec.vm;
    return { freq: 40 + this.rotor * 20 + Math.abs(this.vy) * 1.2, filter: 320 + this.speed * 4, gain: 0.035 + 0.04 * this.rotor,
      chop: { hz: 6 + this.rotor * 9, depth: 0.85 }, wind: this.onGround ? 0 : clamp(v * 1.2, 0, 1) * 0.7, roll: 0 };
  }

  animate(dt, now, world) {
    super.animate(dt, now, world);
    const M = this.M, night = world.sky.nightLevel;
    this.rotAngle += dt * (this.rotor * 38);
    M.rotor.rotation.y = this.rotAngle;
    M.tailRotor.rotation.x = this.rotAngle * 1.6;
    M.discs[0].material.opacity = clamp(this.rotor * 0.14, 0, 0.14);
    const navA = 0.35 + 0.65 * night;
    M.navL.material.opacity = M.navR.material.opacity = navA;
    M.navT.material.opacity = navA * (Math.sin(now * 0.008) > 0.6 ? 1 : 0.1);
    M.navL.visible = M.navR.visible = M.navT.visible = !this.crashed;
    const alt = this.agl, gh = this.pos.y - alt;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), px = this.pos.x + fx * 26, pz = this.pos.z + fz * 26;
    this.pool.position.set(px, world.terrainH(px, pz) + 0.5, pz); this.pool.rotation.set(-Math.PI / 2, this.yaw, 0);
    this.pool.material.opacity = this.light && !this.crashed && this.game.state.flying ? 0.55 * night * clamp(1 - alt / 100, 0, 1) : 0;
    const sd = world.sky.sunDir, sy = Math.max(sd.y, 0.2), k = this.spec.camK;
    this.blob.position.set(this.pos.x - sd.x / sy * alt, gh + 0.3, this.pos.z - sd.z / sy * alt);
    this.blob.rotation.z = this.yaw; this.blob.scale.set((9 + alt * 0.02) * k, (9 + alt * 0.02) * k, 1);
    this.blob.material.opacity = clamp(1 - alt / 250, 0, 1) * (1 - night) * 0.9;
    this.blob.visible = !this.crashed;
  }
}

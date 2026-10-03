// Auto: conducción arcade sobre el relieve real, por las calles de la ciudad, con colisión contra edificios
import { clamp, IS_TOUCH } from '../util.js';
import { glowTex } from '../gfx.js';
import { Vehicle } from './vehicle.js';
import { buildCarModel } from './carModels.js';

const _d = new THREE.Vector3();
const WHEELBASE = 2.9;

export class CarVehicle extends Vehicle {
  constructor(spec) {
    super(spec);
    this.M = buildCarModel(spec);
    this.group.add(this.M.group);
    this.M.group.traverse(o => { if (o.isMesh) o.castShadow = true; });
    this.pool = new THREE.Mesh(new THREE.PlaneGeometry(14, 30), new THREE.MeshBasicMaterial({ map: glowTex, color: 0xfff2c0, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.pool.rotation.order = 'YXZ'; this.pool.renderOrder = 3;
    this.extras.push(this.pool);
    this.light = true;
    this.steerAngle = 0; this.pending = null; this.gear = 'D'; this.damage = 0; this.dist = 0;
    this.smoke = [];
    for (let i = 0; i < 10; i++) {                       // humo del capo cuando el auto esta danado
      const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0x555555, transparent: true, opacity: 0, depthWrite: false }));
      s.scale.set(2, 2, 1); s.userData = { life: 0 }; this.smoke.push(s); this.extras.push(s);
    }
  }
  scheme() { return 'car'; }
  mapRange() { return 340; }
  cameraSpec() {
    const s = this.spec;
    return { dist: s.camDist, height: s.camHeight, look: 10, pitchFollow: 0.6, cockpit: this.M.cockpit, fovBase: 62, fovBoost: 8, boostRatio: clamp(Math.abs(this.speed) / s.vm, 0, 1) };
  }

  // place.near = { x, z }: se coloca en la calle más cercana en cuanto se cargan las calles
  spawn(place, world) {
    this.crashed = false; this.speed = 0; this.steerAngle = 0; this.damage = 0; this.group.visible = true; this.paint();
    const n = place.near;
    this.pos.set(n.x, world.terrainH(n.x, n.z), n.z); this.yaw = place.yaw || 0;
    this.pending = { x: n.x, z: n.z };
    this.game.input.throttleSlider = null;
  }
  action(name) { if (name === 'light') this.light = !this.light; }

  update(dt, input, world) {
    if (this.crashed) return;
    const s = this.spec;
    if (this.pending) {                                   // espera a tener las calles para no aparecer dentro de un edificio
      const p = this.pending;
      if (!world.osm.cellDone(p.x, p.z)) return;
      const r = world.osm.nearestRoad(p.x, p.z);
      if (r) { this.pos.set(r.x, world.terrainH(r.x, r.z), r.z); this.yaw = Math.atan2(-r.tx, -r.tz); }
      this.pending = null;
    }
    const accel = input.axis(['KeyS', 'ArrowDown'], ['KeyW', 'ArrowUp'], -input.stick.y + input.trigger);    // + = acelerar, - = frenar / marcha atrás
    const steerIn = input.axis(['KeyA', 'ArrowLeft'], ['KeyD', 'ArrowRight'], input.stick.x); // + = derecha
    const hand = input.down('Space');
    const maxV = s.vm * (1 - this.damage * 0.004);        // el dano le quita velocidad maxima

    // ---- velocidad ----
    let v = this.speed;
    if (accel > 0.05) {
      if (v < -0.5) v += 14 * accel * dt;                                    // frena si iba marcha atrás
      else v += s.accel * accel * dt;
    } else if (accel < -0.05) {
      if (v > 0.5) v -= 14 * -accel * dt;                                    // frenar
      else v = Math.max(v - s.accel * 0.6 * -accel * dt, -maxV * 0.25);      // marcha atrás
    } else v -= Math.sign(v) * Math.min(Math.abs(v), 1.4 * dt);              // rueda libre
    v -= s.k * v * Math.abs(v) * dt;                                         // resistencia del aire
    if (hand) v -= Math.sign(v) * Math.min(Math.abs(v), 18 * dt);
    this.speed = v = clamp(v, -maxV * 0.25, maxV);
    this.gear = v < -0.5 ? 'R' : 'D';

    // ---- dirección (modelo de bicicleta) ----
    const maxSteer = s.steer / (1 + (Math.abs(v) / 20) ** 2);
    this.steerAngle += (steerIn * maxSteer - this.steerAngle) * Math.min(1, 7 * dt);
    this.yaw += -(v / WHEELBASE) * Math.tan(this.steerAngle) * (hand ? 1.6 : 1) * dt;

    // ---- movimiento con colisión ----
    this.forward(_d); _d.y = 0; _d.normalize();
    const ox = this.pos.x, oz = this.pos.z;
    this.pos.x += _d.x * v * dt; this.pos.z += _d.z * v * dt;
    const front = { x: this.pos.x + _d.x * Math.sign(v || 1) * 2.4, y: 0, z: this.pos.z + _d.z * Math.sign(v || 1) * 2.4 };
    front.y = world.terrainH(front.x, front.z) + 0.8;
    if (world.hitsBuilding(front) || Math.abs(world.slopeAhead(this.pos, this.yaw, 3)) > 0.7) {   // choque: rebota y se daña
      this.pos.x = ox; this.pos.z = oz; this.speed = -v * 0.3;
      if (Math.abs(v) > 4) {
        const dmg = Math.min(60, Math.abs(v) * 1.6); this.damage = Math.min(100, this.damage + dmg); this.paint();
        this.shake = 1; this.game.sound.thump(Math.min(1, Math.abs(v) / 20)); this.game.haptic(60);
        this.game.hud.msg(this.damage >= 100 ? '' : '¡Choque!', 1.2);
        if (this.damage >= 100) { this.crashed = true; this.group.visible = false; this.game.fx.explode(this.pos); this.game.sound.boom(); this.game.hud.msg('💥 Auto destruido — pulsa R para reintentar'); this.game.bus.emit('crash', { vehicle: this, reason: 'Auto destruido' }); }
      }
    }
    this.shake = Math.max(0, this.shake - dt * 3);
    this.dist += Math.abs(this.speed) * dt;

    // ---- pegado al terreno: cabeceo y alabeo según la pendiente ----
    const L = 1.5, Wd = 0.95, cx = this.pos.x, cz = this.pos.z, fx = _d.x, fz = _d.z;
    const h = world.terrainH(cx, cz);
    const hf = world.terrainH(cx + fx * L, cz + fz * L), hb = world.terrainH(cx - fx * L, cz - fz * L);
    const hr = world.terrainH(cx - fz * Wd, cz + fx * Wd), hl = world.terrainH(cx + fz * Wd, cz - fx * Wd);   // derecha / izquierda
    this.pos.y = h;
    this.pitch += (Math.atan2(hf - hb, 2 * L) - this.pitch) * Math.min(1, 8 * dt);
    this.roll += (Math.atan2(hr - hl, 2 * Wd) - this.roll) * Math.min(1, 8 * dt);
  }

  // el color de la carroceria se oscurece con el dano
  paint() { this.M.mats.forEach((m, i) => m.color.setHex(this.M.baseColors[i]).multiplyScalar(1 - this.damage * 0.0075)); }
  hud() { return { name: this.spec.name, speedKmh: Math.abs(this.speed) * 3.6, hdg: this.heading(), gear: this.gear, damage: this.damage || 0 }; }
  instr() { return { kind: 'car', speedKmh: Math.abs(this.speed) * 3.6, vmaxKmh: this.spec.vmax, gear: this.gear, damage: this.damage || 0, hdg: this.heading() }; }
  hint() {
    if (this.pending) return 'Cargando las calles de la ciudad…';
    if (Math.abs(this.speed) >= 1) return '';
    return IS_TOUCH ? 'Pisa el pedal verde y gira con la palanca · FRENO para detenerte' : 'Acelera con W · gira con A D · S frena · espacio = freno de mano';
  }
  sound() { const s = this.spec, v = Math.abs(this.speed); return { freq: s.snd[0] + v * 1.6, filter: s.snd[2], gain: 0.02 + Math.min(0.05, v * 0.002), wind: clamp(v / 70, 0, 1) * 0.5, roll: clamp(v / 25, 0, 1) }; }

  animate(dt, now, world) {
    super.animate(dt, now, world);
    const M = this.M;
    for (const w of M.wheels) w.rotation.x -= this.speed * dt / M.wheelR;      // giran al avanzar
    for (const f of M.front) f.rotation.y = -this.steerAngle;
    const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw), px = this.pos.x + fx * 16, pz = this.pos.z + fz * 16;
    this.pool.position.set(px, world.terrainH(px, pz) + 0.4, pz);
    this.pool.rotation.set(-Math.PI / 2, this.yaw, 0);
    this.pool.material.opacity = this.light && this.game.state.flying ? 0.5 * world.sky.nightLevel : 0;
    // humo: sale del capo cuando el dano pasa del 35 %
    const emit = this.damage > 35 && !this.crashed;
    for (const sp of this.smoke) {
      const u = sp.userData;
      if (u.life <= 0 && emit && Math.random() < dt * (this.damage - 30) * 0.08) {
        u.life = 1.2; const fx = -Math.sin(this.yaw), fz = -Math.cos(this.yaw);
        u.p = new THREE.Vector3(this.pos.x + fx * 1.6, this.pos.y + 1.2, this.pos.z + fz * 1.6);
      }
      if (u.life > 0) { u.life -= dt; u.p.y += dt * 1.8; sp.position.copy(u.p); sp.scale.setScalar(1.2 + (1.2 - u.life) * 2.4); sp.material.opacity = clamp(u.life, 0, 1) * 0.5; } else sp.material.opacity = 0;
    }
  }
}

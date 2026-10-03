// Tráfico de Camagüey: Ladas y Moskvich, almendrones de los años 50, guaguas, motos, bicicletas, mototaxis,
// coches de caballo y peatones por las calles reales, más autos aparcados junto a la acera y farolas.
// Todo se dibuja con una malla instanciada por tipo para toda la ciudad (pocas llamadas de dibujo).
import { Q } from '../config.js';
import { glowTex, boxGeo, mergeGeos } from '../gfx.js';
import { trafficCar } from '../vehicles/carShapes.js';

const W1 = new THREE.Color(1, 1, 1), GL = new THREE.Color(0.1, 0.12, 0.15), TYRE = new THREE.Color(0.08, 0.08, 0.09), CHROME = new THREE.Color(0.78, 0.8, 0.82);
const DK = new THREE.Color(0.14, 0.14, 0.16), HORSE = new THREE.Color(0.42, 0.26, 0.14);
function wheel(r, w, x, y, z, col = TYRE) {
  const g = new THREE.CylinderGeometry(r, r, w, 10).toNonIndexed(); g.rotateZ(Math.PI / 2); g.translate(x, y, z);
  const c = new Float32Array(g.attributes.position.count * 3); for (let i = 0; i < c.length; i += 3) { c[i] = col.r; c[i + 1] = col.g; c[i + 2] = col.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.deleteAttribute('uv'); return g;
}
const wheels4 = (r, track, front, rear, y) => [wheel(r, 0.22, -track, y, front), wheel(r, 0.22, track, y, front), wheel(r, 0.22, -track, y, rear), wheel(r, 0.22, track, y, rear)];
// el frente de todos los modelos mira hacia -z
const MODELS = {
  // Lada 2101/2107: sedán cuadrado
  lada: () => mergeGeos([
    boxGeo(1.62, 0.58, 4.1, 0, 0.62, 0, W1), boxGeo(1.44, 0.5, 2.05, 0, 1.15, 0.2, GL), boxGeo(1.46, 0.07, 1.9, 0, 1.43, 0.25, W1),
    boxGeo(1.66, 0.12, 0.12, 0, 0.45, -2.08, CHROME), boxGeo(1.66, 0.12, 0.12, 0, 0.45, 2.08, CHROME), boxGeo(1.2, 0.2, 0.06, 0, 0.72, -2.06, DK),
    ...wheels4(0.31, 0.72, -1.3, 1.25, 0.31)]),
  // almendrón (Chevrolet / Ford de los 50): largo, bajo, con cola y mucho cromo
  almendron: () => mergeGeos([
    boxGeo(1.86, 0.62, 4.9, 0, 0.66, 0, W1), boxGeo(1.6, 0.48, 2.1, 0, 1.2, 0.35, GL), boxGeo(1.62, 0.08, 1.95, 0, 1.47, 0.38, W1),
    boxGeo(1.9, 0.16, 0.16, 0, 0.5, -2.48, CHROME), boxGeo(1.9, 0.16, 0.16, 0, 0.5, 2.48, CHROME), boxGeo(1.4, 0.26, 0.06, 0, 0.75, -2.46, CHROME),
    boxGeo(0.14, 0.2, 0.9, -0.85, 1.02, 2.0, W1), boxGeo(0.14, 0.2, 0.9, 0.85, 1.02, 2.0, W1),
    ...wheels4(0.34, 0.8, -1.55, 1.5, 0.34)]),
  // guagua (Yutong): larga, alta, con franja de ventanillas
  bus: () => mergeGeos([
    boxGeo(2.5, 2.6, 11.8, 0, 1.85, 0, W1), boxGeo(2.54, 1.0, 10.6, 0, 2.45, 0.4, GL), boxGeo(2.42, 1.3, 0.08, 0, 2.3, -5.9, GL),
    boxGeo(2.52, 0.3, 11.84, 0, 0.75, 0, new THREE.Color(0.75, 0.75, 0.78)),
    ...wheels4(0.5, 1.05, -3.9, 3.6, 0.5)]),
};
const LIGHTS = mergeGeos([
  boxGeo(0.3, 0.18, 0.08, -0.6, 0.72, -2.1, new THREE.Color(1, 0.95, 0.7)), boxGeo(0.3, 0.18, 0.08, 0.6, 0.72, -2.1, new THREE.Color(1, 0.95, 0.7)),
  boxGeo(0.3, 0.16, 0.08, -0.62, 0.78, 2.1, new THREE.Color(0.9, 0.05, 0.05)), boxGeo(0.3, 0.16, 0.08, 0.62, 0.78, 2.1, new THREE.Color(0.9, 0.05, 0.05))]);
// coche de caballo (transporte público de Camagüey): carruaje con toldo, ruedas grandes y caballo
const cartGeo = mergeGeos([
  boxGeo(1.5, 0.75, 2.1, 0, 0.95, 1.1, new THREE.Color(0.12, 0.2, 0.42)), boxGeo(1.62, 0.07, 2.3, 0, 2.05, 1.1, new THREE.Color(0.85, 0.72, 0.25)),
  boxGeo(0.06, 0.75, 0.06, -0.75, 1.65, 0.05, DK), boxGeo(0.06, 0.75, 0.06, 0.75, 1.65, 0.05, DK), boxGeo(0.06, 0.75, 0.06, -0.75, 1.65, 2.15, DK), boxGeo(0.06, 0.75, 0.06, 0.75, 1.65, 2.15, DK),
  wheel(0.55, 0.08, -0.82, 0.55, 1.6, DK), wheel(0.55, 0.08, 0.82, 0.55, 1.6, DK), wheel(0.4, 0.08, -0.82, 0.4, 0.4, DK), wheel(0.4, 0.08, 0.82, 0.4, 0.4, DK),
  boxGeo(0.6, 0.65, 1.55, 0, 1.3, -1.25, HORSE), boxGeo(0.28, 0.75, 0.32, 0, 1.75, -2.05, HORSE), boxGeo(0.26, 0.26, 0.6, 0, 2.05, -2.35, HORSE),
  boxGeo(0.13, 0.95, 0.13, -0.18, 0.48, -0.7, HORSE), boxGeo(0.13, 0.95, 0.13, 0.18, 0.48, -0.7, HORSE), boxGeo(0.13, 0.95, 0.13, -0.18, 0.48, -1.8, HORSE), boxGeo(0.13, 0.95, 0.13, 0.18, 0.48, -1.8, HORSE),
  boxGeo(0.06, 0.06, 1.6, -0.35, 1.1, -0.5, DK), boxGeo(0.06, 0.06, 1.6, 0.35, 1.1, -0.5, DK)]);
// motos, bicicletas y mototaxis; el conductor va encima
const RIDER = new THREE.Color(0.85, 0.85, 0.85), SKIN = new THREE.Color(0.75, 0.55, 0.4);
const motoGeo = mergeGeos([boxGeo(0.34, 0.45, 1.6, 0, 0.6, 0, W1), wheel(0.32, 0.12, 0, 0.32, 0.72, TYRE), wheel(0.32, 0.12, 0, 0.32, -0.72, TYRE),
  boxGeo(0.44, 0.7, 0.36, 0, 1.2, 0.08, RIDER), boxGeo(0.36, 0.42, 0.5, 0, 0.82, 0.12, new THREE.Color(0.2, 0.25, 0.35)), boxGeo(0.26, 0.28, 0.26, 0, 1.72, 0.05, SKIN), boxGeo(0.3, 0.16, 0.3, 0, 1.88, 0.05, DK)]);
const bikeGeo = mergeGeos([boxGeo(0.05, 0.05, 1.0, 0, 0.62, 0, DK), wheel(0.33, 0.04, 0, 0.33, 0.5, DK), wheel(0.33, 0.04, 0, 0.33, -0.5, DK),
  boxGeo(0.4, 0.62, 0.3, 0, 1.25, 0.1, W1), boxGeo(0.3, 0.5, 0.3, 0, 0.75, 0.05, new THREE.Color(0.2, 0.25, 0.35)), boxGeo(0.24, 0.26, 0.24, 0, 1.7, 0.08, SKIN)]);
const trikeGeo = mergeGeos([boxGeo(1.2, 0.6, 1.5, 0, 0.7, 0.5, W1), boxGeo(1.3, 0.08, 1.9, 0, 1.75, 0.4, W1), boxGeo(0.06, 0.9, 0.06, -0.6, 1.2, -0.3, DK), boxGeo(0.06, 0.9, 0.06, 0.6, 1.2, -0.3, DK),
  boxGeo(0.4, 0.5, 1.0, 0, 0.5, -0.9, W1), wheel(0.3, 0.12, 0, 0.3, -1.4, TYRE), wheel(0.3, 0.12, -0.65, 0.3, 0.7, TYRE), wheel(0.3, 0.12, 0.65, 0.3, 0.7, TYRE),
  boxGeo(0.4, 0.6, 0.32, 0, 1.25, -0.7, RIDER), boxGeo(0.24, 0.26, 0.24, 0, 1.68, -0.7, SKIN)]);
// peatones: cuerpo (ropa, piernas más oscuras) y cabeza (piel, pelo oscuro)
const pedBodyGeo = mergeGeos([boxGeo(0.15, 0.82, 0.18, -0.1, 0.41, 0, new THREE.Color(0.45, 0.48, 0.6)), boxGeo(0.15, 0.82, 0.18, 0.1, 0.41, 0, new THREE.Color(0.45, 0.48, 0.6)),
  boxGeo(0.44, 0.62, 0.24, 0, 1.13, 0, W1), boxGeo(0.1, 0.56, 0.12, -0.28, 1.1, 0, W1), boxGeo(0.1, 0.56, 0.12, 0.28, 1.1, 0, W1)]);
const pedHeadGeo = mergeGeos([boxGeo(0.2, 0.24, 0.22, 0, 1.6, 0, W1), boxGeo(0.22, 0.08, 0.24, 0, 1.74, 0.01, new THREE.Color(0.12, 0.1, 0.08))]);

const CAR_COLORS = [0xf2f2f2, 0xc9c9c9, 0xc8282d, 0xc8282d, 0x6fa3d4, 0xd8c9a0, 0xf2f2f2, 0x222222, 0x2a5db0, 0xe8c23a, 0x3f8f4a, 0x9aa89a, 0x7a1f1f, 0x4fb3a8, 0xe07b39].map(c => new THREE.Color(c));
const BUS_COLORS = [0xf2f2f2, 0x2a5db0, 0xe8c23a, 0xd8d8d8].map(c => new THREE.Color(c));
const TRIKE_COLORS = [0x1aa7a7, 0x2a6fd0, 0xe8c23a, 0x1aa7a7, 0xd94a4a].map(c => new THREE.Color(c));
const SKINS = [0xf1c9a5, 0xd9a577, 0xa8714a, 0x6b4428, 0x8d5a3a].map(c => new THREE.Color(c));
const CLOTH = [0xd94a4a, 0x3d6fd1, 0xf2f2f2, 0x2f9c5a, 0xf0c040, 0x8a4fc0, 0x222222, 0xe98a30, 0xf2f2f2, 0x7fc8e0, 0xe57ba0].map(c => new THREE.Color(c));
const CAR_SPACING = 420;       // un auto cada ~420 m de calle (tráfico ligero, como en Camagüey)

const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1), _up = new THREE.Vector3(0, 1, 0);
let rx = 0, ry = 0, rz = 0, rtx = 0, rtz = 0;
function stepOnRoad(a, dt) {
  const r = a.r;
  a.s += a.dir * a.v * dt;
  if (a.s >= r.len) { if (r.oneway) { a.s -= r.len; a.seg = 0; } else { a.s = r.len; a.dir = -1; } }
  else if (a.s <= 0) { if (r.oneway) { a.s += r.len; a.seg = r.n - 2; } else { a.s = 0; a.dir = 1; } }
  while (a.seg < r.n - 2 && r.cum[a.seg + 1] < a.s) a.seg++;
  while (a.seg > 0 && r.cum[a.seg] > a.s) a.seg--;
  const p0 = r.pts[a.seg], p1 = r.pts[a.seg + 1], sl = (r.cum[a.seg + 1] - r.cum[a.seg]) || 1, u = (a.s - r.cum[a.seg]) / sl;
  rtx = (p1.x - p0.x) / sl * a.dir; rtz = (p1.z - p0.z) / sl * a.dir;
  // desplazamiento lateral a la derecha del sentido de marcha (negativo = izquierda)
  rx = p0.x + (p1.x - p0.x) * u - rtz * a.off;
  rz = p0.z + (p1.z - p0.z) * u + rtx * a.off;
  ry = p0.y + (p1.y - p0.y) * u + (a.lift || 0);
}

class Pool {
  constructor(scene, geo, mat, cap, colored) {
    this.mesh = new THREE.InstancedMesh(geo, mat, Math.max(1, cap)); this.mesh.frustumCulled = false;
    if (colored) this.mesh.setColorAt(0, W1);                 // antes de poner count = 0: el búfer de color se crea con el tamaño de count
    this.mesh.count = 0;
    this.cap = Math.max(1, cap); this.n = 0; scene.add(this.mesh);
  }
  put(m, col) { if (this.n >= this.cap) return; this.mesh.setMatrixAt(this.n, m); if (col && this.mesh.instanceColor) this.mesh.setColorAt(this.n, col); this.n++; }
  flush() {
    const m = this.mesh; m.count = this.n; m.visible = this.n > 0;
    if (this.n) {           // solo se sube a la tarjeta la parte usada del búfer
      m.instanceMatrix.updateRange.offset = 0; m.instanceMatrix.updateRange.count = this.n * 16; m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) { m.instanceColor.updateRange.offset = 0; m.instanceColor.updateRange.count = this.n * 3; m.instanceColor.needsUpdate = true; }
    }
    this.n = 0;
  }
}

export class Traffic {
  constructor(world) {
    this.w = world;
    const scene = world.game.scene, lam = () => new THREE.MeshLambertMaterial({ vertexColors: true });
    const lamS = () => new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 80, specular: 0x555555 }), lamD = () => new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const capCars = Q.maxCars * 9 + 200;
    this.P = {
      // autos con silueta real: la carrocería se tiñe con el color de cada auto; cristales, cromos y ruedas van aparte
      lada: new Pool(scene, trafficCar('lada').body, lamS(), capCars, true), ladaT: new Pool(scene, trafficCar('lada').trim, lamD(), capCars, false),
      almendron: new Pool(scene, trafficCar('almendron').body, lamS(), capCars, true), almendronT: new Pool(scene, trafficCar('almendron').trim, lamD(), capCars, false),
      ladaL: new Pool(scene, trafficCar('lada').lights, new THREE.MeshBasicMaterial({ vertexColors: true }), capCars, false),
      almendronL: new Pool(scene, trafficCar('almendron').lights, new THREE.MeshBasicMaterial({ vertexColors: true }), capCars, false),
      bus: new Pool(scene, MODELS.bus(), lam(), 40, true),
      cart: new Pool(scene, cartGeo, lam(), Q.maxCarts * 9 + 4, false), moto: new Pool(scene, motoGeo, lam(), Q.maxCars * 9, true),
      bike: new Pool(scene, bikeGeo, lam(), Q.maxCars * 9, true), trike: new Pool(scene, trikeGeo, lam(), Q.maxCars * 5, true),
      pedB: new Pool(scene, pedBodyGeo, lam(), Q.maxPeds * 9, true), pedH: new Pool(scene, pedHeadGeo, lam(), Q.maxPeds * 9, true),
    };
    // farolas: un solo conjunto de puntos brillantes para toda la ciudad (se rehace al cargar o quitar celdas)
    this.lampGeo = new THREE.BufferGeometry();
    this.lamps = new THREE.Points(this.lampGeo, new THREE.PointsMaterial({ map: glowTex, color: 0xffc070, size: 10, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0 }));
    this.lamps.frustumCulled = false; this.lamps.renderOrder = 3; this.lamps.visible = false; scene.add(this.lamps);
    this.lampsDirty = false;
  }

  // c.roadInfos la rellena Roads (calles con su ancho, aceras y sentido)
  build(c) {
    let seed = Math.abs(c.i * 6733 + c.j * 9173) % 2147483646 + 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    c.roads = (c.roadInfos || []).filter(r => r.len >= 30);
    const cars = [], peds = [], bikes = [];
    let carts = 0;
    for (const r of c.roads) {
      const dirOf = () => (r.oneway ? r.oneway : rnd() < 0.5 ? 1 : -1);
      const laneOff = r.oneway ? 0 : r.w / 4;
      if (r.car && cars.length < Q.maxCars)
        for (let k = Math.floor(r.len / CAR_SPACING + rnd()); k > 0 && cars.length < Q.maxCars; k--) {
          const t = rnd(), base = { r, s: rnd() * r.len, dir: dirOf(), seg: 0 };
          if (t < 0.1 && carts < Q.maxCarts) { carts++; cars.push(Object.assign(base, { type: 'cart', v: 2.2 + rnd() * 0.9, off: r.oneway ? 0.6 : laneOff + 0.3 })); }
          else if (t < 0.16 && /primary|secondary|tertiary/.test(r.hw)) cars.push(Object.assign(base, { type: 'bus', v: 7 + rnd() * 3, off: laneOff, col: BUS_COLORS[rnd() * BUS_COLORS.length | 0] }));
          else cars.push(Object.assign(base, { type: t < 0.45 ? 'almendron' : 'lada', v: 6 + rnd() * 7, off: laneOff, col: CAR_COLORS[rnd() * CAR_COLORS.length | 0], sc: 0.95 + rnd() * 0.1 }));
        }
      if (r.car && r.hw !== 'motorway')
        for (let k = Math.floor(r.len / 300 + rnd()); k > 0 && bikes.length < Q.maxCars * 1.5; k--) {
          const t = rnd(), o = { r, s: rnd() * r.len, dir: dirOf(), seg: 0 };
          if (t < 0.25) bikes.push(Object.assign(o, { type: 'trike', v: 5 + rnd() * 2, off: laneOff + 0.6, col: TRIKE_COLORS[rnd() * TRIKE_COLORS.length | 0] }));
          else if (t < 0.6) bikes.push(Object.assign(o, { type: 'bike', v: 3.5 + rnd() * 2, off: (r.oneway ? 1 : laneOff) + 0.8, col: CLOTH[rnd() * CLOTH.length | 0] }));
          else bikes.push(Object.assign(o, { type: 'moto', v: 7 + rnd() * 6, off: laneOff + 0.4, col: CAR_COLORS[rnd() * CAR_COLORS.length | 0] }));
        }
      if (r.hw !== 'motorway' && r.hw !== 'trunk' && peds.length < Q.maxPeds)
        for (let k = Math.floor(r.len / (r.hw === 'pedestrian' ? 9 : r.zone === 'core' ? 24 : 55) + rnd()); k > 0; k--) {     // el centro está lleno de gente
          const onSide = r.sw > 0, side = rnd() < 0.5 ? -1 : 1, foot = /footway|pedestrian/.test(r.hw), idle = r.zone === 'core' && rnd() < 0.3;
          peds.push({ r, s: rnd() * r.len, dir: rnd() < 0.5 ? 1 : -1, v: idle ? 0 : 0.9 + rnd() * 0.6, seg: 0, ph: rnd() * 6.28,
            off: side * (foot ? (r.hw === 'pedestrian' ? (rnd() - 0.5) * r.w * 0.8 : 0.6) : onSide ? r.w / 2 + r.sw * (idle ? 0.85 : 0.5) : r.w / 2 + 0.5), lift: onSide && !foot ? 0.19 : 0,
            cloth: CLOTH[rnd() * CLOTH.length | 0], skin: SKINS[rnd() * SKINS.length | 0], sc: 0.92 + rnd() * 0.16 });
        }
    }
    // autos aparcados (los da Roads)
    const parked = (c.parked || []).map(p => ({ ...p, y: this.w.terrain.h(p.x, p.z), type: p.r < 0.4 ? 'almendron' : 'lada', col: CAR_COLORS[p.r2 * CAR_COLORS.length | 0] }));
    c.actors = { cars, peds, bikes, parked };
    if (c.lampPts && c.lampPts.length) this.lampsDirty = true;
  }

  dispose(c) { if (c.actors) { c.actors = null; this.lampsDirty = true; } }

  rebuildLamps() {
    const pts = [];
    for (const c of this.w.osm.cells.values()) if (c.actors && c.lampPts) for (let i = 0; i < c.lampPts.length && pts.length < Q.maxLamps * 9; i++) pts.push(c.lampPts[i]);
    this.lampGeo.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    this.lampGeo.computeBoundingSphere();
    this.lampsDirty = false;
  }

  update(dt, cam) {
    const night = this.w.sky.nightLevel, P = this.P;
    if (this.lampsDirty) this.rebuildLamps();
    this.lamps.material.opacity = night * 0.9; this.lamps.visible = night > 0.05;
    const cx = cam ? cam.x : 0, cz = cam ? cam.z : 0, t = performance.now() * 0.001;
    const near = (x, z, R) => (x - cx) * (x - cx) + (z - cz) * (z - cz) < R * R;
    const lightsOn = night > 0.3;
    for (const c of this.w.osm.cells.values()) {
      const A = c.actors; if (!A) continue;
      for (const a of A.cars) {
        stepOnRoad(a, dt);
        if (!near(rx, rz, 1100)) continue;
        _m.compose(_p.set(rx, ry, rz), _q.setFromAxisAngle(_up, Math.atan2(-rtx, -rtz)), a.sc ? _s.set(a.sc, 1, a.sc) : _s.set(1, 1, 1));
        if (a.type === 'cart') P.cart.put(_m);
        else { P[a.type].put(_m, a.col); if (a.type !== 'bus') { P[a.type + 'T'].put(_m); if (lightsOn) P[a.type + 'L'].put(_m); } }
      }
      for (const a of A.bikes) {
        stepOnRoad(a, dt);
        if (!near(rx, rz, 650)) continue;
        _m.compose(_p.set(rx, ry, rz), _q.setFromAxisAngle(_up, Math.atan2(-rtx, -rtz)), _s.set(1, 1, 1));
        P[a.type].put(_m, a.col);
      }
      for (const a of A.parked) {
        if (!near(a.x, a.z, 650)) continue;
        _m.compose(_p.set(a.x, a.y, a.z), _q.setFromAxisAngle(_up, a.yaw), _s.set(1, 1, 1));
        P[a.type].put(_m, a.col); P[a.type + 'T'].put(_m);
      }
      for (const a of A.peds) {
        stepOnRoad(a, dt);
        if (!near(rx, rz, 380)) continue;
        const bob = Math.abs(Math.sin(t * 5.5 * a.v + a.ph)) * 0.05;
        _m.compose(_p.set(rx, ry + bob, rz), _q.setFromAxisAngle(_up, Math.atan2(-rtx, -rtz)), _s.set(a.sc, a.sc, a.sc));
        P.pedB.put(_m, a.cloth); P.pedH.put(_m, a.skin);
      }
    }
    for (const k in P) P[k].flush();
  }
}

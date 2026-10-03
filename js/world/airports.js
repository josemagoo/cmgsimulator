// Aeropuertos y pistas: la de Camagüey y las de las demás ciudades (datos reales de OpenStreetMap)
import { canvasTex, store } from '../util.js';
import { ll2xz, xz2ll, LAT0, LON0 } from '../geo.js';
import { AIRPORTS } from '../config.js';
import { glowTex } from '../gfx.js';
import { overpass } from './net.js';

export function makeRunway(cx, cz, len, w, hdg, approx, apId) {
  return { cx, cz, len, w, hdg, ax: Math.sin(hdg), az: -Math.cos(hdg), approx, apId, elevRel: 0, eRaw: undefined, group: null, lights: null };
}
function longestRunway(els, minLen) {
  let best = null, bestLen = 0;
  for (const e of els || []) {
    if (!e.geometry || !e.tags || e.tags.aeroway !== 'runway') continue;
    const g = e.geometry, A = ll2xz(g[0].lat, g[0].lon), B = ll2xz(g[g.length - 1].lat, g[g.length - 1].lon);
    const len = Math.hypot(B[0] - A[0], B[1] - A[1]);
    if (len > bestLen && len >= minLen) { bestLen = len; best = { A, B, len, w: parseFloat(e.tags.width) || 45 }; }
  }
  return best;
}
function runwayFrom(best, apId) {
  const ax = (best.B[0] - best.A[0]) / best.len, az = (best.B[1] - best.A[1]) / best.len;
  return makeRunway((best.A[0] + best.B[0]) / 2, (best.A[1] + best.B[1]) / 2, best.len, Math.max(best.w, 30), Math.atan2(ax, -az), false, apId);
}

export class Airports {
  constructor(world) {
    this.w = world;
    this.list = AIRPORTS;
    this.home = makeRunway(0, 0, 3100, 45, 40 * Math.PI / 180, true, 'cmw');   // aproximada hasta cargar la real
    this.runways = [this.home];
    this.list[0].rwy = this.home;
    this.start = this.home;               // pista desde la que se despega
    this.tex = null;
    this.build(this.home);
  }

  onRunway(p) {
    for (const r of this.runways) {
      const dx = p.x - r.cx, dz = p.z - r.cz;
      if (Math.abs(dx * r.ax + dz * r.az) < r.len / 2 && Math.abs(-dx * r.az + dz * r.ax) < r.w / 2) return r;
    }
    return null;
  }
  xz(a) { return a.rwy ? [a.rwy.cx, a.rwy.cz] : [a.x, a.z]; }
  name(r) { const a = r && this.list.find(x => x.id === r.apId); return a ? a.name : ''; }
  nearestDist(pos) {
    let d = 1e12;
    for (const a of this.list) { const [x, z] = this.xz(a); d = Math.min(d, Math.hypot(x - pos.x, z - pos.z)); }
    return d;
  }
  nearestRunwayDist(pos) {
    let d = 1e12; for (const r of this.runways) d = Math.min(d, Math.hypot(r.cx - pos.x, r.cz - pos.z)); return d;
  }

  // Dibujo 3D de una pista (encima de la imagen satelital) con luces de borde y de eje
  build(r) {
    const scene = this.w.game.scene, sky = this.w.sky;
    if (r.group) scene.remove(r.group);
    if (r.sock) scene.remove(r.sock);
    r.group = new THREE.Group();
    if (!this.tex) this.tex = canvasTex(256, 2048, (g, w, h) => {
      g.fillStyle = '#3b3b40'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 2500; i++) { g.fillStyle = `rgba(${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},${Math.random() < .5 ? 255 : 0},.03)`; g.fillRect(Math.random() * w, Math.random() * h, 6, 6); }
      g.fillStyle = '#f4f4f4';
      g.fillRect(8, 0, 5, h); g.fillRect(w - 13, 0, 5, h);
      for (let y = 200; y < h - 200; y += 100) g.fillRect(w / 2 - 4, y, 8, 50);
      for (const b of [30, h - 30 - 70]) for (let i = 0; i < 8; i++) g.fillRect(26 + i * 28, b, 14, 70);
      for (const y of [280, h - 280 - 50]) { g.fillRect(50, y, 70, 50); g.fillRect(w - 120, y, 70, 50); }
    });
    const mat = new THREE.MeshBasicMaterial({ map: this.tex }); mat.color = sky.runwayTint;
    const rw = new THREE.Mesh(new THREE.PlaneGeometry(r.w, r.len), mat);
    rw.rotation.x = -Math.PI / 2; rw.position.y = 0.1;
    r.group.add(rw);
    const pts = [], n = Math.floor(r.len / 45);
    for (let i = 0; i <= n; i++) {
      const z = -r.len / 2 + i * (r.len / n);
      pts.push(-(r.w / 2 + 1.5), 0.6, z, r.w / 2 + 1.5, 0.6, z);
    }
    for (let i = 1; i < n * 2; i++) pts.push(0, 0.3, -r.len / 2 + i * (r.len / (n * 2)));
    const lg = new THREE.BufferGeometry(); lg.setAttribute('position', new THREE.Float32BufferAttribute(pts, 3));
    r.lights = new THREE.Points(lg, new THREE.PointsMaterial({ map: glowTex, color: 0xffeeb0, size: 7, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, opacity: 0.4 }));
    r.lights.frustumCulled = false; r.lights.renderOrder = 3;
    r.group.add(r.lights);
    // PAPI: cuatro luces a un lado de la pista, a 300 m del umbral. Blancas = estás alto, rojas = estás bajo (2 y 2 = senda correcta)
    r.papi = [];
    for (const dir of [1, -1]) {
      const pp = [], cc = [];
      for (let i = 0; i < 4; i++) {
        pp.push(dir > 0 ? -(r.w / 2 + 18 + 9 * i) : (r.w / 2 + 18 + 9 * i), 1.2, dir > 0 ? r.len / 2 - 300 : -r.len / 2 + 300);
        cc.push(1, i < 2 ? 1 : 0, i < 2 ? 1 : 0);
      }
      const pg = new THREE.BufferGeometry();
      pg.setAttribute('position', new THREE.Float32BufferAttribute(pp, 3)); pg.setAttribute('color', new THREE.Float32BufferAttribute(cc, 3));
      const pts = new THREE.Points(pg, new THREE.PointsMaterial({ map: glowTex, size: 7, vertexColors: true, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
      pts.frustumCulled = false; pts.renderOrder = 3; r.group.add(pts);
      r.papi.push({ pts, dir, n: 2 });
    }
    // vehiculos de servicio que van y vienen por un camino junto a la pista
    r.crew = [];
    const colors = [0xf0c020, 0xd03030, 0xe8e8e8];
    for (let i = 0; i < 3; i++) {
      const v = new THREE.Group();
      const body = new THREE.Mesh(new THREE.BoxGeometry(2.2, 1.4, 4.6), new THREE.MeshLambertMaterial({ color: colors[i] })); body.position.y = 1.1;
      const cab = new THREE.Mesh(new THREE.BoxGeometry(2, 1, 1.8), new THREE.MeshLambertMaterial({ color: 0x223344 })); cab.position.set(0, 2.1, -1.2);
      v.add(body, cab);
      for (const sx of [-1, 1]) for (const sz of [-1.5, 1.5]) { const w = new THREE.Mesh(new THREE.CylinderGeometry(0.45, 0.45, 0.35, 10), new THREE.MeshLambertMaterial({ color: 0x151515 })); w.rotation.z = Math.PI / 2; w.position.set(sx * 1.05, 0.45, sz); v.add(w); }
      v.userData = { base: (i - 1) * r.len * 0.22, amp: r.len * 0.12, speed: 0.04 + i * 0.015, off: r.w / 2 + 55 + i * 9, ph: i * 2.1 };
      r.group.add(v); r.crew.push(v);
    }
    // manga de viento junto al umbral: apunta hacia donde sopla
    const sock = new THREE.Group(), pole = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.15, 7, 8), new THREE.MeshLambertMaterial({ color: 0xdddddd }));
    pole.position.y = 3.5; sock.add(pole);
    const cone = new THREE.Group(); cone.position.y = 7;
    for (let i = 0; i < 4; i++) {
      const seg = new THREE.Mesh(new THREE.CylinderGeometry(0.62 - i * 0.12, 0.74 - i * 0.12, 0.8, 10, 1, true), new THREE.MeshLambertMaterial({ color: i % 2 ? 0xffffff : 0xff6a00, side: THREE.DoubleSide }));
      seg.rotation.z = Math.PI / 2; seg.position.x = 0.4 + i * 0.8; cone.add(seg);
    }
    sock.add(cone); sock.userData.cone = cone;
    const sx = r.cx - r.ax * (r.len / 2 - 120) - r.az * (r.w / 2 + 28), sz = r.cz - r.az * (r.len / 2 - 120) + r.ax * (r.w / 2 + 28);
    sock.position.set(sx, r.elevRel, sz); r.sock = sock; scene.add(sock);
    r.group.position.set(r.cx, r.elevRel, r.cz);
    r.group.rotation.y = -r.hdg;
    scene.add(r.group);
  }

  async initHome() {                      // pista real de Camagüey (Ignacio Agramonte)
    let best = store.get('rwy', null);
    if (!best) {
      best = longestRunway(await overpass(`[out:json][timeout:20];way["aeroway"="runway"](around:4000,${LAT0},${LON0});out geom;`, 4, 12000), 0);
      if (best) store.set('rwy', best);
    }
    if (!best) return;
    const old = this.home, wasStart = this.start === old;
    const r = runwayFrom(best, 'cmw');
    if (old.group) this.w.game.scene.remove(old.group);
    this.home = r; this.runways[0] = r; this.list[0].rwy = r;
    if (wasStart) this.start = r;
    this.build(r); this.w.terrain.setElev0(); this.w.tiles.reliefAll();
    this.w.game.onHomeRunway?.(old, r);
  }

  async ensure(a) {                       // pista de otra ciudad: se descarga cuando hace falta
    if (a.rwy || a.loading) return;
    a.loading = true;
    try {
      let best = store.get('ap_' + a.id, null);
      if (!best) {
        best = longestRunway(await overpass(`[out:json][timeout:25];way["aeroway"="runway"](around:30000,${a.lat},${a.lon});out geom;`, 4, 20000), 1000);
        if (best) store.set('ap_' + a.id, best);
      }
      if (!best) { a.failedAt = performance.now(); return; }
      const r = runwayFrom(best, a.id), [la, lo] = xz2ll(r.cx, r.cz), T = this.w.terrain;
      await T.loadAt(la, lo);
      const e = T.raw(la, lo);
      if (e !== null) { r.eRaw = e; r.elevRel = T.ELEV0 === null ? 0 : e - T.ELEV0; }
      a.rwy = r; this.runways.push(r);
      this.build(r); T.setElev0(); this.w.tiles.reliefAll();
    } finally { a.loading = false; }
  }

  // descarga las pistas de las ciudades cercanas o elegidas como destino
  prefetch(now, pos, progress) {
    for (let i = 1; i < this.list.length; i++) {
      const a = this.list[i];
      if (a.rwy || a.loading || (a.failedAt && now - a.failedAt < 60000)) continue;
      if (i >= progress.unlockedCount() && i !== progress.dest) continue;
      if (i === progress.dest || Math.hypot(a.x - pos.x, a.z - pos.z) < 80000) { this.ensure(a); break; }
    }
  }

  // Aproximación: si vas alineado con una pista (a menos de 18 km), da tu desviación respecto a la senda de 3° y al eje de pista
  approach(pos, fwd) {
    let best = null;
    const fl = Math.hypot(fwd.x, fwd.z) || 1, fx = fwd.x / fl, fz = fwd.z / fl;
    for (const r of this.runways) for (const dir of [1, -1]) {
      const tx = dir * r.ax, tz = dir * r.az, k = -r.len / 2 + 300;
      const ax = r.cx + tx * k, az = r.cz + tz * k;                 // punto de toma de contacto (300 m tras el umbral)
      const vx = pos.x - ax, vz = pos.z - az, s = -(vx * tx + vz * tz);
      if (s < -150 || s > 18000 || fx * tx + fz * tz < 0.8) continue;
      const lat = vx * -tz + vz * tx;                                // + = a la derecha del eje de pista
      if (Math.abs(lat) > Math.max(300, s * 0.4)) continue;
      const dev = Math.atan2(pos.y - r.elevRel, Math.max(s, 60)) * 180 / Math.PI - 3;   // + = por encima de la senda
      if (!best || s < best.s) best = { r, dir, t: { x: tx, z: tz }, s, lat, dev, aim: { x: ax, z: az } };
    }
    return best;
  }

  update(nightLevel, info, now = 0, weather = null) {
    for (const r of this.runways) {
      for (const v of r.crew || []) {                      // vehiculos de servicio
        const u = v.userData, t = now * 0.001 * u.speed + u.ph;
        v.position.set(u.off, 0, u.base + Math.sin(t) * u.amp);
        v.rotation.y = Math.cos(t) > 0 ? Math.PI : 0;
      }
      if (r.sock && weather) {                            // la manga se orienta con el viento y cuelga si no hay
        const w = weather.wind, cone = r.sock.userData.cone;
        r.sock.rotation.y = Math.atan2(-w.z, w.x);
        cone.rotation.z = -(1 - Math.min(w.speed / 8, 1)) * 1.2;
      }
      if (r.lights) r.lights.material.opacity = 0.35 + 0.65 * nightLevel;
      for (const p of r.papi || []) {
        const n = info && info.r === r && info.dir === p.dir ? [2.5, 2.83, 3.17, 3.5].filter(a => info.dev + 3 > a).length : 2;
        if (n === p.n) continue;
        p.n = n;
        const col = p.pts.geometry.attributes.color;
        for (let i = 0; i < 4; i++) col.setXYZ(i, 1, i < n ? 1 : 0, i < n ? 1 : 0);
        col.needsUpdate = true;
      }
    }
  }
}

// Datos y modelos 3D de los aviones
import { glowTex, phong, addMesh as add, slab } from '../gfx.js';

// vmax: velocidad máxima a pleno gas (km/h); stall: velocidad mínima para volar (km/h); thrust: aceleración a pleno gas (m/s²)
// rollMax: inclinación máxima (rad); turn: velocidad de giro (rad/s) con toda la inclinación
export const PLANE_SPECS = [
  { id: 'cessna', name: 'Avioneta ligera', tag: 'Fácil', desc: 'Lenta y muy estable. Ideal para aprender a despegar y aterrizar.',
    vmax: 230, stall: 108, thrust: 5, rollMax: 0.7, turn: 0.56, pitchRate: 0.6, maxImpact: 6.5, camK: 1, snd: [45, 70, 420] },
  { id: 'turbo', name: 'Turbohélice bimotor', tag: 'Media', desc: 'Dos motores con hélice: más potencia y más velocidad de crucero.',
    vmax: 470, stall: 145, thrust: 7, rollMax: 0.8, turn: 0.5, pitchRate: 0.55, maxImpact: 7, camK: 1.4, snd: [60, 90, 600] },
  { id: 'bizjet', name: 'Jet ejecutivo', tag: 'Difícil', desc: 'Rápido y suave. Necesita pista larga y aproximación a buena velocidad.',
    vmax: 850, stall: 200, thrust: 10, rollMax: 0.9, turn: 0.45, pitchRate: 0.5, maxImpact: 8, camK: 1.7, snd: [55, 110, 900] },
  { id: 'fighter', name: 'Caza a reacción', tag: 'Experto', desc: 'Casi 1.500 km/h, giros cerrados y postquemador.',
    vmax: 1500, stall: 250, thrust: 16, rollMax: 1.1, turn: 0.7, pitchRate: 0.7, maxImpact: 9, camK: 1.8, snd: [50, 140, 1200] },
  { id: 'super', name: 'Súper jet experimental', tag: 'Extremo', desc: 'Mach 2. Cruzas la ciudad en segundos: el mapa apenas alcanza a cargar.',
    vmax: 2400, stall: 290, thrust: 22, rollMax: 1.2, turn: 0.6, pitchRate: 0.7, maxImpact: 9, camK: 2.1, snd: [45, 170, 1500] },
].map(p => ({ ...p, category: 'plane', retract: p.id !== 'cessna', vm: p.vmax / 3.6, st: p.stall / 3.6, rot: p.stall / 3.6 + 4, k: p.thrust / ((p.vmax / 3.6) ** 2) }));

const BLK = phong(0x1a1a1a, 10);
function navLight(parent, x, y, z, color) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(2.4, 2.4, 1); s.position.set(x, y, z); parent.add(s); return s;
}
function discAt(g, x, y, z, r) {
  return add(g, new THREE.CircleGeometry(r, 24), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }), x, y, z);
}
function propAt(g, M, x, y, z, blades, r, spinnerColor) {
  const pg = new THREE.Group(); pg.position.set(x, y, z);
  for (let i = 0; i < blades; i++) add(pg, new THREE.BoxGeometry(0.15, r * 2, 0.04), BLK, 0, 0, 0, 0, 0, i * Math.PI / blades);
  g.add(pg); M.props.push(pg);
  M.discs.push(discAt(g, x, y, z - 0.03, r));
  add(g, new THREE.SphereGeometry(0.3, 12, 8), spinnerColor, x, y, z - 0.1);
}
function gearAt(g, fy, gx, gz, nz) {
  const top = fy - 0.35, len = top - 0.4;
  for (const s of [-1, 1]) {
    add(g, new THREE.CylinderGeometry(0.06, 0.06, len, 6), BLK, s * gx, 0.4 + len / 2, gz);
    add(g, new THREE.CylinderGeometry(0.4, 0.4, 0.25, 14), BLK, s * gx, 0.4, gz, 0, 0, Math.PI / 2);
  }
  add(g, new THREE.CylinderGeometry(0.05, 0.05, len, 6), BLK, 0, 0.4 + len / 2, nz);
  add(g, new THREE.CylinderGeometry(0.3, 0.3, 0.18, 14), BLK, 0, 0.35, nz, 0, 0, Math.PI / 2);
}

// Fuselaje torneado con la decoración pintada por vértice: franja (cheatline) a la altura de las ventanillas,
// línea fina debajo y panza gris. El torno va a lo largo de Y y luego se gira (Z local = arriba).
function liveryLathe(prof, seg, body, stripe, belly, stripeH = 0.18) {
  const g = new THREE.LatheGeometry(prof, seg).toNonIndexed(), p = g.attributes.position, c = new Float32Array(p.count * 3);
  const B = new THREE.Color(body), S = new THREE.Color(stripe), G = new THREE.Color(belly);
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), z = p.getZ(i), r = Math.hypot(x, z) || 1, up = z / r;
    const col = up < -0.6 ? G : Math.abs(up - 0.05) < stripeH ? S : Math.abs(up + 0.2) < 0.04 ? S : B;
    c.set([col.r, col.g, col.b], i * 3);
  }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); g.computeVertexNormals();
  return g;
}
// fila de ventanillas a los dos lados (una sola malla)
function windowRow(g, mat, fy, prof, z0, z1, step, h = 0.26, w = 0.22, yo = 0.2) {
  const parts = [], rAt = z => { const p = -z; for (let i = 0; i < prof.length - 1; i++) { const [ra, pa] = prof[i], [rb, pb] = prof[i + 1]; if (p >= pa && p <= pb) return ra + (rb - ra) * (p - pa) / (pb - pa); } return 0; };
  for (let z = z0; z < z1; z += step) for (const sd of [-1, 1]) {
    const r = rAt(z); if (r < 0.5) continue;
    const b = new THREE.BoxGeometry(0.04, h, w).toNonIndexed(); b.translate(sd * r * Math.sqrt(1 - yo * yo) * 0.99, fy + r * yo, z); parts.push(b);
  }
  if (!parts.length) return;
  let n = 0; for (const p of parts) n += p.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3); let o = 0;
  for (const p of parts) { P.set(p.attributes.position.array, o * 3); N.set(p.attributes.normal.array, o * 3); o += p.attributes.position.count; }
  const geo = new THREE.BufferGeometry(); geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setAttribute('normal', new THREE.BufferAttribute(N, 3));
  g.add(new THREE.Mesh(geo, mat));
}

// Avioneta ligera
function buildCessna() {
  const g = new THREE.Group(), M = { group: g, props: [], discs: [], flame: null, cockpit: new THREE.Vector3(0, 2.3, -1.6) };
  const WHITE = phong(0xf4f4f4, 80), RED = phong(0xc8282d), DARK = phong(0x1c2a38, 120);
  const A = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => add(g, geo, mat, x, y, z, rx, ry, rz);
  const prof = [[0.04, -3.9], [0.22, -3.2], [0.40, -1.8], [0.68, -0.4], [0.78, 0.8], [0.72, 1.8], [0.58, 2.6], [0.30, 3.2], [0.02, 3.35]].map(p => new THREE.Vector2(p[0], p[1]));
  A(liveryLathe(prof, 20, 0xf4f4f4, 0x1f4f9a, 0xd9dcdf, 0.09), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 90 }), 0, 1.5, 0, -Math.PI / 2);
  A(new THREE.CylinderGeometry(0.62, 0.72, 0.9, 20), RED, 0, 1.5, -3.05, Math.PI / 2);
  A(new THREE.BoxGeometry(1.15, 0.5, 1.2), DARK, 0, 2.15, -1.25, -0.35);
  for (const s of [-1, 1]) A(new THREE.BoxGeometry(0.04, 0.42, 1.5), DARK, s * 0.66, 1.95, -0.2);
  A(slab([[-5.4, 0.15], [-5.4, -0.85], [0, -1.25], [5.4, -0.85], [5.4, 0.15], [0, 0.75]], 0.14), WHITE, 0, 1.95, -0.7, -Math.PI / 2);
  A(new THREE.BoxGeometry(0.3, 0.16, 1.0), RED, -5.45, 1.95, -1.05);
  A(new THREE.BoxGeometry(0.3, 0.16, 1.0), RED, 5.45, 1.95, -1.05);
  A(new THREE.BoxGeometry(6.6, 0.05, 0.3), RED, 0, 1.95, 0.05);
  for (const s of [-1, 1]) A(new THREE.CylinderGeometry(0.035, 0.035, 1.5, 6), BLK, s * 1.3, 1.25, -0.6, 0, 0, s * 0.5);
  A(slab([[-1.8, 0.1], [-1.8, -0.5], [0, -0.7], [1.8, -0.5], [1.8, 0.1], [0, 0.45]], 0.08), WHITE, 0, 1.55, 3.3, -Math.PI / 2);
  A(slab([[-0.6, 0], [0.9, 0], [0.2, 1.7], [-0.5, 1.7]], 0.08), RED, 0, 1.6, 3.4, 0, Math.PI / 2);
  for (const s of [-1, 1]) A(new THREE.SphereGeometry(0.5, 10, 6), WHITE, s * 1.2, 0.5, -1.0).scale.set(0.5, 0.7, 1.2);
  gearAt(g, 1.5, 1.2, -1.0, -3.0);
  propAt(g, M, 0, 1.5, -3.75, 2, 1.55, RED);
  M.navL = navLight(g, -5.5, 1.95, -0.9, 0xff2a2a); M.navR = navLight(g, 5.5, 1.95, -0.9, 0x2aff55); M.navT = navLight(g, 0, 3.3, 3.7, 0xffffff);
  return M;
}

// Turbohélice, jet ejecutivo, caza y súper jet
function buildJet(o) {
  const g = new THREE.Group(), M = { group: g, props: [], discs: [], flame: null, cockpit: new THREE.Vector3(0, o.fy + 0.9, o.cockZ) };
  const BODY = phong(o.body, 90), ACC = phong(o.acc, 60), GLASS = phong(0x14202c, 140), DARK = phong(0x2b2b30, 20);
  const A = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => add(g, geo, mat, x, y, z, rx, ry, rz);
  const fy = o.fy;
  if (o.livery) A(liveryLathe(o.prof.map(p => new THREE.Vector2(p[0], p[1])), 28, o.body, o.livery, o.belly || 0xcfd3d8, o.stripeH || 0.12), new THREE.MeshPhongMaterial({ vertexColors: true, shininess: 100, specular: 0x777777 }), 0, fy, 0, -Math.PI / 2);
  else A(new THREE.LatheGeometry(o.prof.map(p => new THREE.Vector2(p[0], p[1])), 24), BODY, 0, fy, 0, -Math.PI / 2);
  if (o.windows) windowRow(g, phong(0x10181f, 160), fy, o.prof, o.windows[0], o.windows[1], o.windows[2]);
  const hs = o.span / 2, w = o.wing;
  A(slab([[-hs, w[2]], [-hs, w[3]], [0, w[1]], [hs, w[3]], [hs, w[2]], [0, w[0]]], o.thick), BODY, 0, fy + o.wy, o.wz, -Math.PI / 2);
  if (o.tail === 'T') {
    A(slab([[-1.2, 0], [1.6, 0], [0.7, 2.8], [-0.5, 2.8]], 0.12), ACC, 0, fy + 0.3, o.tz, 0, Math.PI / 2);
    A(slab([[-2.4, 0.4], [-2.4, -0.4], [0, -0.8], [2.4, -0.4], [2.4, 0.4], [0, 0.9]], 0.1), BODY, 0, fy + 3.05, o.tz - 0.4, -Math.PI / 2);
  } else if (o.tail === 'twin') {
    for (const s of [-1, 1]) {
      const fg = new THREE.Group(); fg.position.set(s * 0.95, fy + 0.35, o.tz); fg.rotation.z = -s * 0.28; g.add(fg);
      add(fg, slab([[-1.4, 0], [1.8, 0], [0.5, 2.6], [-0.9, 2.6]], 0.1), ACC, 0, 0, 0, 0, Math.PI / 2, 0);
    }
    A(slab([[-3.4, -0.6], [-3.4, -1.7], [0, -2.3], [3.4, -1.7], [3.4, -0.6], [0, 0.6]], 0.12), BODY, 0, fy - 0.1, o.tz + 0.5, -Math.PI / 2);
  } else {   // delta: una sola deriva alta y canards
    A(slab([[-2.6, 0], [3.2, 0], [0.6, 3.6], [-1.6, 3.6]], 0.14), ACC, 0, fy + 0.4, o.tz, 0, Math.PI / 2);
    A(slab([[-2, 0.3], [-2, -0.5], [0, -0.8], [2, -0.5], [2, 0.3], [0, 0.8]], 0.1), BODY, 0, fy + 0.1, -5.2, -Math.PI / 2);
  }
  if (o.canopy === 'bubble') {
    const c = A(new THREE.SphereGeometry(0.62, 14, 10), GLASS, 0, fy + 0.62, o.cockZ); c.scale.set(0.85, 0.75, 2.6);
  } else {
    A(new THREE.BoxGeometry(o.r * 1.4, 0.45, 1.3), GLASS, 0, fy + o.r * 0.6, o.cockZ - 0.2, -0.32);
    for (const s of [-1, 1]) A(new THREE.BoxGeometry(0.04, 0.34, 2.2), GLASS, s * (o.r - 0.02), fy + 0.25, o.cockZ + 1.2);
  }
  if (o.engine === 'prop2') {
    for (const s of [-1, 1]) {
      A(new THREE.CylinderGeometry(0.5, 0.42, 3.4, 14), BODY, s * o.ex, fy + o.wy + 0.2, o.wz - 0.6, Math.PI / 2);
      propAt(g, M, s * o.ex, fy + o.wy + 0.2, o.wz - 2.4, 3, 1.6, ACC);
    }
  } else if (o.engine === 'aft') {
    for (const s of [-1, 1]) {
      A(new THREE.CylinderGeometry(0.55, 0.5, 2.8, 16), ACC, s * 1.6, fy + 0.5, o.tz - 1.2, Math.PI / 2);
      A(new THREE.CylinderGeometry(0.4, 0.4, 0.1, 16), DARK, s * 1.6, fy + 0.5, o.tz - 2.62, Math.PI / 2);
      A(new THREE.CylinderGeometry(0.3, 0.3, 0.12, 12), phong(0x9aa0a6, 120), s * 1.6, fy + 0.5, o.tz - 2.6, Math.PI / 2);      // ventilador
      A(new THREE.CylinderGeometry(0.06, 0.06, 0.9, 6), BODY, s * 1.05, fy + 0.5, o.tz - 1.2, 0, 0, Math.PI / 2);              // soporte
      A(new THREE.CylinderGeometry(0.4, 0.45, 0.3, 16), DARK, s * 1.6, fy + 0.5, o.tz + 0.3, Math.PI / 2);
    }
  } else {
    for (const s of o.nozzles) A(new THREE.CylinderGeometry(0.5, 0.42, 0.9, 16), DARK, s * 0.5, fy, o.tailEnd, Math.PI / 2);
    for (const s of [-1, 1]) A(new THREE.BoxGeometry(0.6, 0.75, 1.7), DARK, s * (o.r + 0.05), fy - 0.15, o.cockZ + 2.0);
    const fl = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color: 0xffa040, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
    fl.position.set(0, fy, o.tailEnd + 1.2); g.add(fl); M.flame = fl; M.flameSize = o.flame;
  }
  const gg = new THREE.Group(); g.add(gg); M.gearGroup = gg;   // tren retráctil: se sube y se baja
  gearAt(gg, fy, o.gx, o.gz, o.nz);
  M.fy = fy;
  const tip = o.span / 2;
  if (o.winglet) for (const sd of [-1, 1]) A(slab([[-0.3, 0], [0.9, 0], [0.75, 1.1], [0.15, 1.1]], 0.06), ACC, sd * tip, fy + o.wy, o.wz + (w[2] + w[3]) / 2 - 0.2, 0, Math.PI / 2, -sd * 0.18);
  M.navL = navLight(g, -tip, fy + o.wy, o.wz + (w[2] + w[3]) / 2, 0xff2a2a);
  M.navR = navLight(g, tip, fy + o.wy, o.wz + (w[2] + w[3]) / 2, 0x2aff55);
  M.navT = navLight(g, 0, fy + (o.tail === 'T' ? 3.6 : 3.0), o.tz + 0.2, 0xffffff);
  return M;
}
// wing = [rootLead, rootTrail, tipLead, tipTrail]; prof = [radio, posición a lo largo] de cola a nariz
const LOOKS = {
  turbo: { body: 0xf2f2f2, acc: 0x1f5fa8, livery: 0x1f4f9a, windows: [-2.6, 4.2, 0.62], winglet: false, fy: 1.7, r: 0.9, span: 14.5, wing: [1.4, -1.6, 0.3, -0.9], thick: 0.2, wy: -0.5, wz: -0.2, tail: 'T', tz: 5.0,
    canopy: 'box', cockZ: -3.3, engine: 'prop2', ex: 3.3, gx: 3.3, gz: -0.6, nz: -3.6,
    prof: [[0.05, -5.5], [0.35, -4.5], [0.7, -2.5], [0.9, 0], [0.9, 2.5], [0.75, 4], [0.4, 5], [0.03, 5.5]] },
  bizjet: { body: 0xf6f6f6, acc: 0x8b1e2e, livery: 0x8b1e2e, windows: [-3.4, 3.6, 0.72], winglet: true, fy: 1.9, r: 1.05, span: 13, wing: [1.6, -2.2, -1.6, -2.5], thick: 0.2, wy: -0.6, wz: 0.6, tail: 'T', tz: 5.6,
    canopy: 'box', cockZ: -4.6, engine: 'aft', gx: 1.6, gz: 1.0, nz: -4.6,
    prof: [[0.05, -6.6], [0.3, -5.6], [0.55, -4], [0.95, -1.5], [1.05, 1.5], [0.95, 3.8], [0.7, 5.2], [0.3, 6.2], [0.03, 6.7]] },
  fighter: { body: 0x7d8792, acc: 0x4d565f, livery: 0x6a737d, belly: 0x9aa2aa, stripeH: 0.02, fy: 1.65, r: 0.75, span: 9.6, wing: [3.0, -3.6, -1.4, -3.0], thick: 0.16, wy: -0.25, wz: 0.8, tail: 'twin', tz: 5.6,
    canopy: 'bubble', cockZ: -3.6, engine: 'jet', nozzles: [-1, 1], tailEnd: 7.9, flame: 8, gx: 1.5, gz: 1.2, nz: -4.6,
    prof: [[0.35, -7.5], [0.6, -6.5], [0.75, -4.0], [0.75, 0], [0.65, 3], [0.4, 5.5], [0.15, 7.0], [0.02, 7.6]] },
  super: { body: 0xd9dde3, acc: 0x222a33, fy: 1.75, r: 0.85, span: 11, wing: [5.0, -6.0, -4.0, -5.8], thick: 0.15, wy: -0.2, wz: 0.5, tail: 'delta', tz: 6.6,
    canopy: 'bubble', cockZ: -5.0, engine: 'jet', nozzles: [0], tailEnd: 9.5, flame: 12, gx: 1.8, gz: 1.5, nz: -6.6,
    prof: [[0.4, -9], [0.7, -8], [0.85, -4], [0.8, 0], [0.6, 4], [0.3, 7.5], [0.1, 9], [0.02, 9.9]] },
};

export const buildPlaneModel = spec => spec.id === 'cessna' ? buildCessna() : buildJet(LOOKS[spec.id]);

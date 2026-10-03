// Calles reales con su anchura, aceras elevadas con contén (cortadas en las bocacalles), pavimento (asfalto gastado, adoquín,
// tierra), plazas pavimentadas y autos aparcados junto a la acera, como en las calles estrechas del casco de Camagüey.
import { canvasTex } from '../util.js';
import { ll2xz } from '../geo.js';
import { Q } from '../config.js';
import { SQUARES } from '../data/squares.js';
import { PLAZAS, zoneAt } from '../data/camaguey.js';

// ancho de calzada y de acera por tipo de vía (m). Las calles del casco colonial son más estrechas.
const SPEC = {
  motorway: { w: 14, sw: 0 }, trunk: { w: 12, sw: 0 }, primary: { w: 11, sw: 2.2 }, secondary: { w: 9, sw: 1.9 }, tertiary: { w: 7.6, sw: 1.6 },
  unclassified: { w: 6, sw: 1.2 }, residential: { w: 6, sw: 1.4 }, living_street: { w: 5, sw: 1 }, pedestrian: { w: 6, sw: 0 }, footway: { w: 1.8, sw: 0 },
  service: { w: 4, sw: 0 }, track: { w: 3.5, sw: 0 },
};
const CAR_HW = /^(motorway|trunk|primary|secondary|tertiary|unclassified|residential)$/;
const CURB = 0.17;              // altura del contén
const noise = (g, w, h, n, a, lo, hi) => {
  for (let i = 0; i < n; i++) { const v = lo + Math.random() * (hi - lo) | 0; g.fillStyle = `rgba(${v},${v},${v},${a * (0.4 + Math.random() * 0.6)})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
};
const wear = (g, w, h) => {      // asfalto gastado: parches, grietas y baches
  for (let i = 0; i < 4; i++) { const v = 55 + Math.random() * 25 | 0; g.fillStyle = `rgba(${v},${v},${v + 3},.35)`; g.fillRect(Math.random() * w * 0.8, Math.random() * h, 14 + Math.random() * 26, 10 + Math.random() * 22); }
  for (let i = 0; i < 4; i++) { g.fillStyle = 'rgba(95,92,86,.5)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 6 + Math.random() * 9, 4 + Math.random() * 6, 0, 0, 7); g.fill(); }
  g.strokeStyle = 'rgba(25,25,25,.28)'; g.lineWidth = 1;
  for (let i = 0; i < 3; i++) { g.beginPath(); let x = Math.random() * w, y = Math.random() * h; g.moveTo(x, y); for (let k = 0; k < 4; k++) g.lineTo(x += (Math.random() - 0.5) * 22, y += Math.random() * 14); g.stroke(); }
};

let T = null;
function textures() {
  if (T) return T;
  const rep = t => { t.wrapS = t.wrapT = THREE.RepeatWrapping; return t; };
  const asphalt = rep(canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#6b6d70'; g.fillRect(0, 0, w, h); noise(g, w, h, 1800, 0.5, 70, 150);
    g.fillStyle = 'rgba(50,50,54,.3)'; g.fillRect(w * 0.28, 0, 8, h); g.fillRect(w * 0.62, 0, 8, h);      // huella de las ruedas
    g.fillStyle = 'rgba(40,38,34,.35)'; g.fillRect(0, 0, 5, h); g.fillRect(w - 5, 0, 5, h);                 // suciedad junto al contén
    wear(g, w, h);
  }));
  const marked = rep(canvasTex(128, 256, (g, w, h) => {
    g.fillStyle = '#6e7073'; g.fillRect(0, 0, w, h); noise(g, w, h, 1800, 0.5, 70, 150);
    g.fillStyle = '#e9d36a'; g.fillRect(w / 2 - 2, 0, 4, 45); g.fillRect(w / 2 - 2, 128, 4, 45);
    wear(g, w, h); g.fillStyle = 'rgba(235,235,235,.6)'; g.fillRect(8, 0, 3, h); g.fillRect(w - 11, 0, 3, h);
  }));
  const cobble = rep(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#5a554c'; g.fillRect(0, 0, w, h);
    const bw = 32, bh = 22;
    for (let r = 0; r * bh < h + bh; r++) for (let c = -1; c * bw < w + bw; c++) {
      const x = c * bw + (r % 2 ? bw / 2 : 0), y = r * bh, v = 100 + Math.random() * 60 | 0;
      g.fillStyle = `rgb(${v},${v - 6},${v - 16})`; g.beginPath(); g.roundRect ? g.roundRect(x + 1.5, y + 1.5, bw - 3, bh - 3, 4) : g.rect(x + 1.5, y + 1.5, bw - 3, bh - 3); g.fill();
    }
    noise(g, w, h, 900, 0.35, 60, 140);
  }));
  // acera de losas de hormigón; la franja de arriba de la textura es el canto del contén
  const side = rep(canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#bcbbb6'; g.fillRect(0, 0, w, h); noise(g, w, h, 600, 0.35, 130, 215);
    g.fillStyle = 'rgba(70,66,58,.5)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(w / 2, 0, 2, h / 2);
    for (let i = 0; i < 3; i++) { g.fillStyle = 'rgba(80,72,60,.08)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 10 + Math.random() * 18, 6 + Math.random() * 12, 0, 0, 7); g.fill(); }
  }));
  const dirt = rep(canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#c4a67d'; g.fillRect(0, 0, w, h); noise(g, w, h, 1400, 0.5, 130, 230);
    g.fillStyle = 'rgba(120,92,60,.35)'; g.fillRect(w * 0.3, 0, 10, h); g.fillRect(w * 0.64, 0, 10, h);
    for (let i = 0; i < 5; i++) { g.fillStyle = 'rgba(95,72,48,.3)'; g.beginPath(); g.ellipse(Math.random() * w, Math.random() * h, 8 + Math.random() * 10, 5 + Math.random() * 8, 0, 0, 7); g.fill(); }
  }));
  const slab = rep(canvasTex(128, 128, (g, w, h) => {
    g.fillStyle = '#d4cdbb'; g.fillRect(0, 0, w, h);
    g.fillStyle = '#c3bba7'; g.fillRect(0, 0, w / 2, h / 2); g.fillRect(w / 2, h / 2, w / 2, h / 2);
    noise(g, w, h, 600, 0.3, 150, 235);
    g.fillStyle = 'rgba(90,82,68,.5)'; g.fillRect(0, 0, w, 2); g.fillRect(0, 0, 2, h); g.fillRect(w / 2, 0, 1, h); g.fillRect(0, h / 2, w, 1);
  }));
  // losas grandes de hormigón con franjas de ladrillo cada 12 m (Plaza de la Revolución)
  const plates = rep(canvasTex(256, 256, (g, w, h) => {
    g.fillStyle = '#c9c4b8'; g.fillRect(0, 0, w, h);
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) { const v = 192 + Math.random() * 22 | 0; g.fillStyle = `rgb(${v},${v - 4},${v - 12})`; g.fillRect(18 + i * 59.5, 18 + j * 59.5, 57.5, 57.5); }
    noise(g, w, h, 900, 0.25, 140, 225);
    g.fillStyle = '#a5644a'; g.fillRect(0, 0, w, 17); g.fillRect(0, 0, 17, h);
    g.fillStyle = 'rgba(70,40,30,.35)'; for (let k = 0; k < w; k += 9) { g.fillRect(k, 0, 1, 17); g.fillRect(0, k, 17, 1); }
  }));
  const mk = (map, off, ds) => new THREE.MeshLambertMaterial({ map, polygonOffset: off !== 0, polygonOffsetFactor: off, polygonOffsetUnits: off * 2, side: ds ? THREE.DoubleSide : THREE.FrontSide });
  T = { asphalt: mk(asphalt, -2), marked: mk(marked, -2), cobble: mk(cobble, -2), dirt: mk(dirt, -2), side: mk(side, -1, true), slab: mk(slab, -1), plates: mk(plates, -1) };
  return T;
}

const nearPlaza = (x, z, r) => { for (const p of PLAZAS) if (Math.hypot(x - p.xz[0], z - p.xz[1]) < p.r + r) return true; return false; };

// punto de una polilínea a la distancia s (con su tangente)
function pointAt(pts, cum, s) {
  let i = 0; while (i < pts.length - 2 && cum[i + 1] < s) i++;
  const p = pts[i], q = pts[i + 1], l = (cum[i + 1] - cum[i]) || 1, u = Math.max(0, Math.min(1, (s - cum[i]) / l));
  return { x: p.x + (q.x - p.x) * u, z: p.z + (q.z - p.z) * u, tx: (q.x - p.x) / l, tz: (q.z - p.z) / l };
}
// puntos de s0 a s1: los vértices de la calle y cortes cada ≤12 m (para seguir el relieve)
function between(pts, cum, s0, s1) {
  const out = [pointAt(pts, cum, s0)];
  let last = s0;
  const push = s => { const n = Math.ceil((s - last) / 12); for (let k = 1; k <= n; k++) out.push(pointAt(pts, cum, last + (s - last) * k / n)); last = s; };
  for (let i = 1; i < pts.length - 1; i++) if (cum[i] > s0 + 0.05 && cum[i] < s1 - 0.05) push(cum[i]);
  push(s1);
  return out;
}

export class Roads {
  constructor(world) { this.w = world; this.squares = SQUARES.map(s => ({ ...s, xz: s.p.map(q => ll2xz(q[0], q[1])), hxz: (s.h || []).map(h => h.map(q => ll2xz(q[0], q[1]))) })); }

  // devuelve las mallas de pavimento y la lista de calles (para tráfico, postes, árboles y para no plantar árboles encima)
  async build(c, els, scene, y) {
    const th = (x, z) => this.w.terrain.h(x, z), M = textures(), buf = {};
    const get = k => buf[k] || (buf[k] = { p: [], u: [] });
    const sidewalks = Q.sidewalks;
    let seed = Math.abs(c.i * 5113 + c.j * 9973) % 2147483646 + 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // cinta horizontal entre dos desplazamientos laterales; u a lo ancho (por uMul), v a lo largo (por vTile)
    const strip = (k, P, offA, offB, yy, uMul, vTile, v0 = 0) => {
      const B = get(k), n = P.length;
      let d = v0;
      for (let i = 0; i < n - 1; i++) {
        const p = P[i], q = P[i + 1], l = Math.hypot(q.x - p.x, q.z - p.z);
        const na = [-(i > 0 ? (q.z - P[i - 1].z) : (q.z - p.z)), (i > 0 ? (q.x - P[i - 1].x) : (q.x - p.x))], la = Math.hypot(na[0], na[1]) || 1;
        const nb = [-(i < n - 2 ? (P[i + 2].z - p.z) : (q.z - p.z)), (i < n - 2 ? (P[i + 2].x - p.x) : (q.x - p.x))], lb = Math.hypot(nb[0], nb[1]) || 1;
        const ax = na[0] / la, az = na[1] / la, bx = nb[0] / lb, bz = nb[1] / lb;
        const A = [p.x + ax * offA, p.z + az * offA], Bb = [p.x + ax * offB, p.z + az * offB], Cc = [q.x + bx * offB, q.z + bz * offB], D = [q.x + bx * offA, q.z + bz * offA];
        const vA = d / vTile, vB = (d + l) / vTile; d += l;
        const u1 = Math.abs(offB - offA) * uMul;
        B.p.push(A[0], th(A[0], A[1]) + yy, A[1], Bb[0], th(Bb[0], Bb[1]) + yy, Bb[1], Cc[0], th(Cc[0], Cc[1]) + yy, Cc[1], A[0], th(A[0], A[1]) + yy, A[1], Cc[0], th(Cc[0], Cc[1]) + yy, Cc[1], D[0], th(D[0], D[1]) + yy, D[1]);
        B.u.push(0, vA, u1, vA, u1, vB, 0, vA, u1, vB, 0, vB);
      }
    };
    // cara vertical a lo largo (el canto del contén), de y0 a y1 sobre el terreno, a la distancia lateral off
    const face = (k, P, off, y0, y1) => {
      const B = get(k);
      for (let i = 0; i < P.length - 1; i++) {
        const p = P[i], q = P[i + 1], l = Math.hypot(q.x - p.x, q.z - p.z) || 1, nx = -(q.z - p.z) / l, nz = (q.x - p.x) / l;
        const ax = p.x + nx * off, az = p.z + nz * off, bx = q.x + nx * off, bz = q.z + nz * off, ha = th(ax, az), hb = th(bx, bz);
        B.p.push(ax, ha + y0, az, bx, hb + y0, bz, bx, hb + y1, bz, ax, ha + y0, az, bx, hb + y1, bz, ax, ha + y1, az);
        B.u.push(0, 0, l / 1.5, 0, l / 1.5, 0.12, 0, 0, l / 1.5, 0.12, 0, 0.12);
      }
    };
    const cap = (k, p, a, b, y0, y1) => {    // tapa del extremo de una acera
      const B = get(k), nx = -p.tz, nz = p.tx, ax = p.x + nx * a, az = p.z + nz * a, bx = p.x + nx * b, bz = p.z + nz * b, ha = th(ax, az), hb = th(bx, bz);
      B.p.push(ax, ha + y0, az, bx, hb + y0, bz, bx, hb + y1, bz, ax, ha + y0, az, bx, hb + y1, bz, ax, ha + y1, az);
      B.u.push(0, 0, 1, 0, 1, 0.12, 0, 0, 1, 0.12, 0, 0.12);
    };
    // cruces: nodos que comparten dos o más calles
    const use = new Map(), key = p => p.lat.toFixed(7) + ',' + p.lon.toFixed(7);
    for (const e of els) if (e.type === 'way' && e.geometry && e.tags && SPEC[e.tags.highway]) for (const p of e.geometry) { const k = key(p); use.set(k, (use.get(k) || 0) + 1); }
    const infos = [], parked = [];
    let n = 0;
    for (const e of els) {
      const t = e.tags || {}, hw = t.highway;
      if (e.type !== 'way' || !hw || !e.geometry || !SPEC[hw]) continue;
      if ((++n & 15) === 0 && y && await y()) return { meshes: [], infos: [] };
      const raw = e.geometry.map(p => { const [x, z] = ll2xz(p.lat, p.lon); return { x, z, y: th(x, z) }; });
      if (raw.length < 2) continue;
      const cum = [0]; for (let i = 1; i < raw.length; i++) cum.push(cum[i - 1] + Math.hypot(raw[i].x - raw[i - 1].x, raw[i].z - raw[i - 1].z));
      const len = cum[cum.length - 1]; if (len < 1) continue;
      const mid = pointAt(raw, cum, len / 2), zone = zoneAt(mid.x, mid.z), sp = SPEC[hw];
      let w = sp.w;
      const lanes = parseInt(t.lanes, 10), wt = parseFloat(t.width);
      if (wt > 2) w = wt; else if (lanes > 0 && sp.sw) w = Math.max(w, lanes * 3.1);
      if (zone === 'core' && /^(residential|living_street|unclassified)$/.test(hw)) w = Math.min(w, 5.6);
      if (hw === 'pedestrian' && !(wt > 2) && zone !== 'outer') w = 9;          // bulevares peatonales (República, Maceo…): de fachada a fachada
      let sw = sp.sw; if (zone === 'outer' && /^(residential|unclassified)$/.test(hw)) sw = 0; else if (zone === 'core') sw = Math.min(sw, 1.3);
      // pavimento
      const sf = t.surface || '', unpaved = /unpaved|dirt|ground|gravel|compacted|earth|sand|grass/.test(sf) || hw === 'track';
      const boulevard = hw === 'pedestrian' && !/cobble|sett/.test(sf);
      const stone = /cobble|sett|paving|stone/.test(sf) && !boulevard || (zone === 'core' && hw === 'living_street') || (zone === 'core' && nearPlaza(mid.x, mid.z, 25) && !/primary|secondary/.test(hw));
      const dirtOuter = zone === 'outer' && /^(residential|unclassified)$/.test(hw) && ((e.id * 2654435761) >>> 0) % 100 < 45;   // en los repartos periféricos muchas calles son de tierra
      const kind = unpaved || dirtOuter ? 'dirt' : boulevard ? 'slabSt' : stone ? 'cobble' : (hw === 'footway' ? 'side' : (w >= 8.5 && t.oneway !== 'yes') ? 'marked' : 'asphalt');
      if (kind === 'dirt') sw = 0;
      const oneway = t.oneway === 'yes' || t.oneway === '1' ? 1 : t.oneway === '-1' ? -1 : (w < 7 && zone !== 'outer' ? 1 : 0);   // las calles estrechas del centro son de un solo sentido
      const info = { id: e.id, pts: raw, cum, len, n: raw.length, w, sw: sidewalks && kind !== 'side' ? sw : 0, hw, kind, car: CAR_HW.test(hw), oneway, zone, name: t.name || t.alt_name || '' };
      infos.push(info);
      const P = between(raw, cum, 0, len);
      if (hw === 'footway') { strip('side', P, -w / 2, w / 2, 0.05, 1 / 1.5, 1.5); continue; }
      const uMul = kind === 'cobble' ? 1 / 2.4 : kind === 'dirt' ? 1 / 6 : kind === 'slabSt' ? 1 / 2.4 : 1 / w, vTile = kind === 'cobble' ? 2.4 : kind === 'dirt' ? 6 : kind === 'slabSt' ? 2.4 : kind === 'marked' ? 18 : 12;
      strip(kind, P, -w / 2, w / 2, 0.06, uMul, vTile);
      // aceras elevadas, cortadas en cada bocacalle
      if (info.sw > 0) {
        const J = [];
        e.geometry.forEach((p, i) => { if (use.get(key(p)) > 1) J.push(cum[i]); });
        const gap = 3.2 + w * 0.25, runs = []; let s = 0;
        J.sort((a, b) => a - b);
        for (const j of J) { if (j - gap > s + 1.5) runs.push([s, j - gap]); s = Math.max(s, j + gap); }
        if (len - s > 1.5) runs.push([s, len]);
        info.runs = runs;
        for (const [s0, s1] of runs) {
          const R = between(raw, cum, s0, s1);
          for (const sg of [1, -1]) {
            const a = sg > 0 ? w / 2 : -w / 2 - info.sw, b = sg > 0 ? w / 2 + info.sw : -w / 2;
            strip('side', R, a, b, CURB + 0.02, 1 / 1.5, 1.5);
            face('side', R, sg * w / 2, 0.0, CURB + 0.02);                         // canto del contén
            cap('side', R[0], a, b, 0, CURB + 0.02); cap('side', R[R.length - 1], a, b, 0, CURB + 0.02);
          }
        }
      }
      // autos aparcados junto a la acera (calles estrechas del centro y de los repartos)
      if (Q.props && info.car && info.sw > 0 && w < 7 && zone !== 'outer' && kind !== 'dirt' && info.runs) {
        const pChance = zone === 'core' ? 0.16 : 0.1;
        for (const [s0, s1] of info.runs) for (let s = s0 + 3.5; s < s1 - 3.5; s += 5.6) {
          if (rnd() > pChance) continue;
          const p = pointAt(raw, cum, s), side = oneway ? (rnd() < 0.7 ? 1 : -1) : 1, off = side * (w / 2 - 0.95);
          parked.push({ x: p.x - p.tz * off, z: p.z + p.tx * off, yaw: Math.atan2(-p.tx, -p.tz) + (side < 0 && !oneway ? Math.PI : 0) + (rnd() - 0.5) * 0.06, r: rnd(), r2: rnd() });
        }
      }
    }
    // plazas pavimentadas
    if (Q.sidewalks) {
      const bb = this.cellBounds(c);
      for (const s of this.squares) {
        if (s.k !== 'paved') continue;
        const xz = s.xz; let cx = 0, cz = 0; for (const p of xz) { cx += p[0]; cz += p[1]; } cx /= xz.length; cz /= xz.length;
        if (cx < bb.minx || cx >= bb.maxx || cz < bb.minz || cz >= bb.maxz) continue;
        const V2 = r => r.map(p => new THREE.Vector2(p[0], p[1])), all = xz.concat(...s.hxz);          // con huecos: jardines y monumentos
        const tris = THREE.ShapeUtils.triangulateShape(V2(xz), s.hxz.map(V2)), B = get(s.s === 'cobble' ? 'cobbleSq' : s.s === 'plates' ? 'plates' : 'slab');
        const us = s.s === 'cobble' ? 4 : s.s === 'plates' ? 12 : 5;
        const emit = (a, b, c) => { for (const p of [a, b, c]) { B.p.push(p[0], th(p[0], p[1]) + 0.1, p[1]); B.u.push(p[0] / us, p[1] / us); } };
        // los triángulos grandes se parten (lado < 14 m) para que el pavimento siga el relieve y no flote ni se hunda
        const split = (a, b, c, d) => {
          const ab = (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2, bc = (b[0] - c[0]) ** 2 + (b[1] - c[1]) ** 2, ca = (c[0] - a[0]) ** 2 + (c[1] - a[1]) ** 2, m = Math.max(ab, bc, ca);
          if (m < 196 || d > 12) return emit(a, b, c);
          const mid = (p, q) => [(p[0] + q[0]) / 2, (p[1] + q[1]) / 2];
          if (m === ab) { const p = mid(a, b); split(a, p, c, d + 1); split(p, b, c, d + 1); }
          else if (m === bc) { const p = mid(b, c); split(a, b, p, d + 1); split(a, p, c, d + 1); }
          else { const p = mid(c, a); split(a, b, p, d + 1); split(p, b, c, d + 1); }
        };
        for (const tr of tris) {
          const [a, bq, cq] = tr.map(i => all[i]);
          const up = (bq[1] - a[1]) * (cq[0] - a[0]) - (bq[0] - a[0]) * (cq[1] - a[1]) > 0;      // que el triángulo mire hacia arriba
          if (up) split(a, bq, cq, 0); else split(a, cq, bq, 0);
        }
      }
    }
    if (c.dead) return { meshes: [], infos: [] };
    const meshes = [], order = { side: 2, slab: 1, cobbleSq: 1, plates: 1, slabSt: 3, asphalt: 3, marked: 3, cobble: 3, dirt: 3 };
    for (const k of Object.keys(buf)) {
      const B = buf[k]; if (!B.p.length) continue;
      const g = new THREE.BufferGeometry();
      g.setAttribute('position', new THREE.Float32BufferAttribute(B.p, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(B.u, 2));
      g.computeVertexNormals(); g.computeBoundingSphere();
      const mat = k === 'cobbleSq' ? M.cobble : k === 'slabSt' ? M.slab : M[k];
      const m = new THREE.Mesh(g, mat); m.renderOrder = order[k]; m.matrixAutoUpdate = false; m.userData.k = 'road-' + k; scene.add(m); meshes.push(m);
    }
    c.parked = parked;
    return { meshes, infos };
  }
  cellBounds(c) {
    const s = c.i * 0.01, w = c.j * 0.01, a = ll2xz(s, w), b = ll2xz(s + 0.01, w + 0.01);
    return { minx: Math.min(a[0], b[0]), maxx: Math.max(a[0], b[0]), minz: Math.min(a[1], b[1]), maxz: Math.max(a[1], b[1]) };
  }
}

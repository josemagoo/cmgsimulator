// Ciudad real a partir de OpenStreetMap, con el carácter de cada zona de Camagüey:
//  - casco colonial: fachadas de un vano por módulo (ventanas de barrotes torneados, puertas con medio punto de vitrales, rejas,
//    balcones, comercios), cornisa y pretil, techos de teja criolla donde la foto satelital muestra teja
//  - repartos: casas de persianas y rejas, azoteas con tinacos, techos de zinc o teja
//  - microdistritos: edificios de paneles prefabricados con balcones y ropa tendida
// Se descarga por celdas de ~1 km y se construye poco a poco (unos milisegundos por fotograma) para que el juego no se trabe.
import { clamp, canvasTex } from '../util.js';
import { ll2xz, xz2ll } from '../geo.js';
import { Q } from '../config.js';
import { overpass } from './net.js';
import { Traffic } from './traffic.js';
import { Water } from './water.js';
import { Roads } from './roads.js';
import { Mesher, b255 } from './mesher.js';
import { MOD, SIZE, facadeMaps, facadeMaterial, roofMaterial } from './facades.js';
import { signMaterial, SIGN_COUNT } from './signs.js';
import { buildCellMap } from './citymap.js';
import { frameOf, frameFromSpec, buildChurch, addJar, addSculpture, addStatue, addRoyalPalm, addBench, addLampPost, addPole, addStreetLamp, addTank, C } from './models.js';
import { zoneAt, inPrefabZone, nearestPlaza, landmarkFor, FIXED, PROPS, CORE } from '../data/camaguey.js';
import { MONUMENTS } from '../data/monuments.js';
import { faceFrame, addBust, addStatueFig, addFigure, addObelisk, addBarberan, addStele, addStoneSculpt, addCeiba, addLocomotive, addWaterTower, addLightTower, addCommTower, buildPlazaRev } from './monumentModels.js';

const CELL_DEG = 0.01;               // ~1.1 km por celda
const GRID = 60;                     // rejilla de colisión (m)

// Paletas tomadas de los videos de las calles de Camagüey: estucos saturados y descoloridos
const COLONIAL = [0x7fd1c0, 0x9fd8bb, 0xc2504a, 0xa8484a, 0xe8c040, 0xf0dc8a, 0x8fb8e0, 0xe8a0a8, 0xf2e6c2, 0xf3efe4, 0xd9a45a, 0xe9a98f, 0x6fb8d0, 0xf3efe4, 0xb7d3a0, 0xe7c9a0].map(c => new THREE.Color(c));
const HOUSE = [0xefe2c2, 0xe0b08c, 0xcfe0c8, 0xbdd0e2, 0xecc880, 0xe6e6e0, 0xd9a3a3, 0xf3eeda, 0xf1d9a0, 0xa9cfc7, 0xd7e0e8, 0xe9c9b0, 0x9fd8bb, 0x8fb8e0, 0xf3efe4].map(c => new THREE.Color(c));
const PREFAB = [0xe6e2d6, 0xd9d6cd, 0xece8dc, 0xc8d4dc, 0xe9d4c0, 0xdfe3df, 0xe8dcb0].map(c => new THREE.Color(c));
const FLAT_ROOF = [0x8a8780, 0x9a9690, 0x77736d, 0xa8a39a, 0x6e6a64].map(c => new THREE.Color(c));
const TILE_ROOF = [0xa8583c, 0xb46a4a, 0x9c5a44, 0xb8704e].map(c => new THREE.Color(c));
const ZINC_ROOF = [0x8f969b, 0x9ea4a8, 0x7d8388, 0xa07a62].map(c => new THREE.Color(c));
const NAMED = { white: 0xf5f5f5, gray: 0x999999, grey: 0x999999, red: 0xb03030, yellow: 0xe8c44a, brown: 0x8a5a3a, blue: 0x4a70b0, green: 0x5a8a4a, orange: 0xe08a3a, beige: 0xe6d8b0, cream: 0xf0e6c8, pink: 0xe0a0a8, black: 0x333333, tan: 0xd2b48c, salmon: 0xe9967a };
function tagColor(v) {
  if (!v) return null;
  v = String(v).toLowerCase().trim();
  if (/^#[0-9a-f]{6}$/.test(v)) return new THREE.Color(v);
  return NAMED[v] !== undefined ? new THREE.Color(NAMED[v]) : null;
}
const NOTABLE_AMEN = /^(place_of_worship|theatre|townhall|university|hospital|library|courthouse|marketplace|college|arts_centre|cinema)$/;
const NOTABLE_BLD = /^(church|cathedral|chapel|hospital|university|civic|museum|stadium|hotel|train_station)$/;
const notable = t => !!t.name && (NOTABLE_AMEN.test(t.amenity || '') || t.tourism || t.historic || NOTABLE_BLD.test(t.building || '') || t.leisure === 'stadium' || t.aeroway === 'terminal');

function inPoly(x, z, pts) {
  let ins = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, zi] = pts[i], [xj, zj] = pts[j];
    if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) ins = !ins;
  }
  return ins;
}
const lum = (r, g, b) => 0.3 * r + 0.59 * g + 0.11 * b;
const isTileColor = s => !!s && s[0] > s[1] * 1.06 && s[0] > s[2] * 1.16 && s[0] - (s[1] + s[2]) / 2 > 0.035;   // teja criolla vista desde el satélite

// Color de techo: el de la foto satelital, corregido (sombras, copas de árboles encima) y mezclado con la paleta
function roofFromSample(s, base, out) {
  if (!s) return out.copy(base);
  let [r, g, b] = s; const l = lum(r, g, b);
  if (g > r * 1.12 && g > b * 1.1) return out.copy(base);               // vegetación sobre el techo: no sirve
  if (l < 0.22) { const k = 0.22 / Math.max(l, 0.04); r = Math.min(1, r * k); g = Math.min(1, g * k); b = Math.min(1, b * k); }
  if (l > 0.82) { r *= 0.85; g *= 0.85; b *= 0.85; }
  return out.setRGB(r * 0.8 + base.r * 0.2, g * 0.8 + base.g * 0.2, b * 0.8 + base.b * 0.2);
}
// polígono metido hacia dentro d metros (contorno en sentido horario, A2 < 0); null si se deforma
function inset(pts, d) {
  const n = pts.length, out = [];
  for (let i = 0; i < n; i++) {
    const a = pts[(i + n - 1) % n], b = pts[i], c = pts[(i + 1) % n];
    const l1 = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1, l2 = Math.hypot(c[0] - b[0], c[1] - b[1]) || 1;
    const n1x = (b[1] - a[1]) / l1, n1z = -(b[0] - a[0]) / l1, n2x = (c[1] - b[1]) / l2, n2z = -(c[0] - b[0]) / l2;   // normales interiores
    let mx = n1x + n2x, mz = n1z + n2z; const ml = Math.hypot(mx, mz);
    if (ml < 0.2) return null;
    mx /= ml; mz /= ml; const k = d / Math.max(0.35, mx * n1x + mz * n1z);
    out.push([b[0] + mx * k, b[1] + mz * k]);
  }
  let A = 0; for (let i = 0; i < n; i++) { const p = out[i], q = out[(i + 1) % n]; A += p[0] * q[1] - q[0] * p[1]; }
  let A0 = 0; for (let i = 0; i < n; i++) { const p = pts[i], q = pts[(i + 1) % n]; A0 += p[0] * q[1] - q[0] * p[1]; }
  if (A >= 0 || Math.abs(A) < Math.abs(A0) * 0.12) return null;
  for (let i = 0; i < n; i++) {     // ningún lado puede invertirse
    const p = pts[i], q = pts[(i + 1) % n], P = out[i], R = out[(i + 1) % n];
    if ((q[0] - p[0]) * (R[0] - P[0]) + (q[1] - p[1]) * (R[1] - P[1]) <= 0) return null;
  }
  return out;
}
const nextFrame = () => new Promise(r => requestAnimationFrame(() => r()));

export class Osm {
  constructor(world) {
    this.w = world;
    this.cells = new Map(); this.grid = new Map(); this.ids = new Set(); this.queue = []; this.active = 0;
    this.traffic = new Traffic(world);
    this.water = new Water(world);
    this.roads = new Roads(world);
    this.monuments = MONUMENTS.map((m, i) => ({ ...m, i, xz: ll2xz(m.lat, m.lon), to: m.to ? ll2xz(m.to[0], m.to[1]) : null }));
    this.tickT = 0; this.buildQ = Promise.resolve(); this.buildMs = 0;

    const maps = facadeMaps(world.game.renderer);
    this.facMat = facadeMaterial(maps); world.sky.wallMats.push(this.facMat);
    this.fenceMat = facadeMaterial(maps, true);
    this.roofMat = roofMaterial();
    this.signs = signMaterial();
    this.solidMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    this.glowMat = new THREE.MeshBasicMaterial({ vertexColors: true });
    this.wireMat = new THREE.LineBasicMaterial({ color: 0x1c1c1c });

    // árboles: copa irregular de tres bolas (laurel de la India, mango, almendro), palmas reales y cocoteros
    // copas con índices (los vértices se comparten: la tarjeta gráfica procesa 5 veces menos vértices)
    this.crownGeo = blobs([[0, 4.6, 0, 2.45, 1], [1.3, 4.0, 0.8, 1.85, 1], [-1.2, 4.1, -0.85, 1.9, 1]], 2.2, 6.4);
    this.crownLoGeo = blobs([[0, 4.4, 0, 2.9, 0]], 2.0, 6.8);           // copa de lejos: 8 triángulos
    this.trunkGeo = new THREE.CylinderGeometry(0.2, 0.32, 3.8, 5, 1, true); this.trunkGeo.translate(0, 1.3, 0);          // el tronco entra en el suelo
    this.trunkMat = new THREE.MeshLambertMaterial({ color: 0x5b4130 });
    this.crownMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    this.palmTrunkGeo = new THREE.CylinderGeometry(0.16, 0.3, 9.6, 6); this.palmTrunkGeo.translate(0, 4.2, 0);
    this.palmTrunkMat = new THREE.MeshLambertMaterial({ color: 0x9a8e7a });
    this.palmFrondMat = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
    const parts = [];
    for (let i = 0; i < 9; i++) {           // pencas caídas alrededor de la copa
      const g = new THREE.PlaneGeometry(0.9, 4.4, 1, 3); g.translate(0, 2.2, 0); const p = g.attributes.position;
      for (let k = 0; k < p.count; k++) { const yy = p.getY(k); p.setZ(k, -0.09 * yy * yy); p.setX(k, p.getX(k) * (1 - yy / 5.5)); }
      g.rotateX(-Math.PI / 2 + 0.45); g.rotateY(i * Math.PI * 2 / 9); g.translate(0, 9, 0);
      const ng = g.toNonIndexed(), cc = new Float32Array(ng.attributes.position.count * 3);
      for (let k = 0; k < cc.length; k += 3) { cc[k] = 0.13 + (i % 3) * 0.03; cc[k + 1] = 0.42 + (i % 2) * 0.06; cc[k + 2] = 0.14; }
      ng.setAttribute('color', new THREE.BufferAttribute(cc, 3)); ng.deleteAttribute('uv'); parts.push(ng);
    }
    this.palmFrondGeo = mergeGeoms(parts);
    // un árbol = una sola malla (tronco + copa): la mitad de llamadas de dibujo. El tronco lleva un color que, multiplicado
    // por el verde de cada copa, da un pardo oscuro.
    this.treeHi = mergeIdx([[this.crownGeo], [this.trunkGeo, [1.5, 0.85, 0.9]]]);
    this.treeLo = this.crownLoGeo;
    this.palmGeo = mergeIdx([[this.palmTrunkGeo, [0.6, 0.56, 0.48]], [this.palmFrondGeo]]);
    this.treeMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true });
    this.palmMat = new THREE.MeshLambertMaterial({ color: 0xffffff, vertexColors: true, side: THREE.DoubleSide });
  }

  // ---- carga por celdas ----
  request(pos) {
    const [lat, lon] = xz2ll(pos.x, pos.z);
    const ci = Math.floor(lat / CELL_DEG), cj = Math.floor(lon / CELL_DEG), now = performance.now();
    const want = [];
    const R = Q.cellRing;
    for (let di = -R; di <= R; di++) for (let dj = -R; dj <= R; dj++) {
      const k = (ci + di) + ',' + (cj + dj), lite = Math.max(Math.abs(di), Math.abs(dj)) > 1;   // anillo exterior: edificios simplificados
      let c = this.cells.get(k);
      if (c && c.state === 'fail' && now > c.retryAt) { this.cells.delete(k); c = null; }
      if (c && c.lite && !lite && c.state === 'done') { this.cells.delete(k); c.replacedBy = true; want.push({ i: ci + di, j: cj + dj, k, lite, d: Math.abs(di) + Math.abs(dj), old: c }); continue; }   // al acercarte se recarga completa (sin hueco)
      if (!c) want.push({ i: ci + di, j: cj + dj, k, lite, d: Math.abs(di) + Math.abs(dj) });
    }
    want.sort((a, b) => a.d - b.d);
    for (const w of want) {
      this.cells.set(w.k, { state: 'loading', replacing: w.old || null, lite: w.lite, i: w.i, j: w.j, meshes: [], ids: [], gridKeys: [], trees: [], labels: [], actors: null, roads: [], roadMeshes: [], tint: [], imgTrees: false, pendingRoofs: 0, parked: [] });
      this.queue.push(w.k);
    }
    for (const [k, c] of this.cells) if (Math.abs(c.i - ci) > R + 1 || Math.abs(c.j - cj) > R + 1) this.unload(k, c);
    this.pump();
  }
  pump() {
    while (this.active < 2 && this.queue.length) {
      const k = this.queue.shift(), c = this.cells.get(k);
      if (!c || c.state !== 'loading') continue;
      this.active++;
      this.loadCell(k, c).finally(() => { this.active--; this.pump(); });
    }
  }
  async loadCell(k, c) {
    const s = c.i * CELL_DEG, w = c.j * CELL_DEG, bb = `(${s},${w},${s + CELL_DEG},${w + CELL_DEG})`;
    const q = c.lite ? `[out:json][timeout:25];(way["building"]${bb};);out geom;`
      : `[out:json][timeout:25];(way["building"]${bb};node["natural"="tree"]${bb};way["natural"="wood"]${bb};way["landuse"="forest"]${bb};way["leisure"~"^(park|garden)$"]${bb};way["highway"~"^(motorway|trunk|primary|secondary|tertiary|unclassified|residential|living_street|pedestrian|footway)$"]${bb};node["historic"]["name"]${bb};node["tourism"~"^(attraction|museum|monument|viewpoint|hotel)$"]["name"]${bb};way["waterway"~"^(river|canal|stream)$"]${bb};way["natural"="water"]${bb};);out geom;`;
    const els = await overpass(q);
    if (this.cells.get(k) !== c) return;
    if (!els) { c.state = 'fail'; c.retryAt = performance.now() + 15000; return; }
    c.state = 'building';
    // las celdas se construyen de una en una, repartidas entre fotogramas
    this.buildQ = this.buildQ.then(() => this.build(c, els)).catch(e => { console.error(e); if (!c.dead) c.state = 'done'; });
  }
  unload(k, c) {
    c.dead = true;
    if (c.replacing) { this.releaseData(c.replacing); this.dropMeshes(c.replacing); c.replacing = null; }
    this.dropMeshes(c); this.releaseData(c);
    this.traffic.dispose(c);
    if (this.cells.get(k) === c) this.cells.delete(k);
  }
  // ids y rejilla de colisión de una celda
  releaseData(c) {
    if (c.released) return; c.released = true;
    c.ids.forEach(id => this.ids.delete(id));
    for (const gk of c.gridKeys) { const a = this.grid.get(gk); if (a) { const f = a.filter(b => b.cell !== c); if (f.length) this.grid.set(gk, f); else this.grid.delete(gk); } }
  }
  dropMeshes(c) {
    const scene = this.w.game.scene;
    for (const m of [...c.meshes, ...c.roadMeshes]) if (m) { scene.remove(m); m.geometry.dispose(); }
    c.meshes = []; c.roadMeshes = [];
    if (c.waterMesh) { scene.remove(c.waterMesh); c.waterMesh.geometry.dispose(); }
    for (const m of c.trees) {
      scene.remove(m); m.dispose();
      for (const g of [m.userData.hi, m.userData.lo, m.geometry]) if (g) { g.attributes = {}; g.index = null; g.dispose(); }     // las geometrías comparten datos: solo se suelta la vista
    }
    for (const s of c.labels) { scene.remove(s); s.material.map.dispose(); s.material.dispose(); }
    c.trees = []; c.labels = []; c.waterMesh = null;
  }
  cellDone(x, z) {
    const [lat, lon] = xz2ll(x, z), c = this.cells.get(Math.floor(lat / CELL_DEG) + ',' + Math.floor(lon / CELL_DEG));
    return !!c && c.state === 'done';
  }
  // punto de calle más cercano (para colocar un coche en una calle real)
  nearestRoad(x, z, maxR = 1500) {
    let best = null, bd = maxR * maxR;
    for (const c of this.cells.values()) for (const r of c.roads) {
      if (!r.car) continue;
      for (let i = 0; i < r.pts.length - 1; i++) {
        const p = r.pts[i], q = r.pts[i + 1], d = (p.x - x) ** 2 + (p.z - z) ** 2;
        if (d < bd) { bd = d; const l = Math.hypot(q.x - p.x, q.z - p.z) || 1; best = { x: p.x, z: p.z, tx: (q.x - p.x) / l, tz: (q.z - p.z) / l }; }
      }
    }
    return best;
  }
  hits(p) {
    const list = this.grid.get(Math.floor(p.x / GRID) + ',' + Math.floor(p.z / GRID));
    if (!list) return false;
    for (const b of list) if (p.x > b.minx && p.x < b.maxx && p.z > b.minz && p.z < b.maxz && p.y < b.top && p.y > b.base && inPoly(p.x, p.z, b.pts)) return true;   // rectángulo y luego contorno real
    return false;
  }
  inBuilding(x, z, skip) {
    const list = this.grid.get(Math.floor(x / GRID) + ',' + Math.floor(z / GRID));
    if (!list) return false;
    for (const b of list) if (b !== skip && x > b.minx - 0.5 && x < b.maxx + 0.5 && z > b.minz - 0.5 && z < b.maxz + 0.5 && inPoly(x, z, b.pts)) return true;
    return false;
  }
  // altura de la azotea en (x, z), o null si no hay edificio
  roofAt(x, z) {
    const list = this.grid.get(Math.floor(x / GRID) + ',' + Math.floor(z / GRID)); let top = null;
    if (list) for (const b of list) if (!b.prop && x > b.minx && x < b.maxx && z > b.minz && z < b.maxz && inPoly(x, z, b.pts)) top = Math.max(top === null ? -1e9 : top, b.top);
    return top;
  }
  // obstáculo que no es un edificio (monumentos, tanques, torres): solo cuenta para los choques
  solid(c, pts, base, top) {
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9, A2 = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A2 += p[0] * q[1] - q[0] * p[1]; minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); }
    if (A2 > 0) pts.reverse();
    const bb = { minx, maxx, minz, maxz, top, base, cell: c, pts, prop: true };
    for (let gx = Math.floor(minx / GRID); gx <= Math.floor(maxx / GRID); gx++)
      for (let gz = Math.floor(minz / GRID); gz <= Math.floor(maxz / GRID); gz++) {
        const gk = gx + ',' + gz; if (!this.grid.has(gk)) this.grid.set(gk, []);
        this.grid.get(gk).push(bb); c.gridKeys.push(gk);
      }
  }

  // ---- rótulos ----
  makeLabel(text) {
    const c = document.createElement('canvas'), g = c.getContext('2d');
    const font = 'bold 34px "Segoe UI", Arial';
    g.font = font;
    const w = Math.min(760, Math.ceil(g.measureText(text).width) + 44);
    c.width = w; c.height = 64;
    g.font = font;
    g.fillStyle = 'rgba(8,22,44,.74)'; g.beginPath(); g.roundRect ? g.roundRect(0, 4, w, 56, 16) : g.rect(0, 4, w, 56); g.fill();
    g.fillStyle = '#ffd56b'; g.fillRect(14, 20, 6, 24);
    g.fillStyle = '#fff'; g.textBaseline = 'middle'; g.fillText(text, 30, 33, w - 40);
    const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(c), transparent: true, fog: false, sizeAttenuation: false, depthWrite: false }));
    sp.scale.set(0.032 * w / 64, 0.032, 1); sp.renderOrder = 5;
    return sp;
  }

  // ---- huella de un edificio: contorno en sentido horario, caja y registro de colisión ----
  footprint(c, id, pts, t, ov) {
    let A2 = 0;
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; A2 += p[0] * q[1] - q[0] * p[1]; }
    if (A2 > 0) pts.reverse();
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9, cx = 0, cz = 0;
    for (const p of pts) { minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]); cx += p[0]; cz += p[1]; }
    cx /= pts.length; cz /= pts.length;
    if (!inPoly(cx, cz, pts)) { cx = (minx + maxx) / 2; cz = (minz + maxz) / 2; }
    const bb = { minx, maxx, minz, maxz, top: 0, base: -1e9, cell: c, pts };
    for (let gx = Math.floor(minx / GRID); gx <= Math.floor(maxx / GRID); gx++)
      for (let gz = Math.floor(minz / GRID); gz <= Math.floor(maxz / GRID); gz++) {
        const gk = gx + ',' + gz; if (!this.grid.has(gk)) this.grid.set(gk, []);
        this.grid.get(gk).push(bb); c.gridKeys.push(gk);
      }
    return { id, pts, t, ov, bb, cx, cz, area: Math.abs(A2) / 2 };
  }

  // ---- un edificio ----
  addBuilding(c, M, S, f, labels, detail) {
    const th = (x, z) => this.w.terrain.h(x, z), { pts, t, ov, bb, cx, cz, area } = f;
    let seed = (f.id % 2147483646) + 1; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const y0 = th(cx, cz), zone = zoneAt(cx, cz), rb = rnd() * 255 | 0;
    const church = /^(church|cathedral|chapel)$/.test(t.building) || t.amenity === 'place_of_worship';
    const lm = ov || landmarkFor(t.name), blockOv = lm && lm.kind === 'block' ? lm : null;
    const levels = parseFloat(t['building:levels']), hTag = parseFloat(t.height);
    const sample = this.w.tiles.sample(cx, cz);

    // --- iglesias: modelo propio con nave, fachada y torres ---
    if ((lm && (lm.kind === 'church' || lm.kind === 'gothic')) || (church && area > 90 && area < 2500 && pts.length >= 4)) {
      const F = frameOf(pts);
      if (F && F.hu > 6 && F.hv > 3.5) {
        let sp = lm;
        if (!sp || !sp.nave) {
          const tw = clamp(F.hv * 0.42, 2.4, 4), side = rnd() < 0.5 ? 'L' : 'R';
          sp = { wall: [0xf0e6c8, 0xe8d8a8, 0xf3efe4, 0xe9c6a0][rnd() * 4 | 0], trim: 0xffffff, roof: 0xb15a3a, nave: 7.5 + Math.min(3, F.hv * 0.15), towers: [{ side, h: 15 + F.hu * 0.25, w: tw, bodies: 3, top: 'cupola' }], pediment: rnd() < 0.6 };
        }
        const pl = nearestPlaza(cx, cz), near = pl && Math.hypot(pl.xz[0] - cx, pl.xz[1] - cz) < 140 ? pl.xz : CORE;
        if (f.towerAt) {          // campanarios en su posición real (de OpenStreetMap), con la forma y el remate del estilo
          const base = (sp.towers && sp.towers[0]) || { h: 18, bodies: 3, top: 'cupola' };
          sp = { ...sp, towers: [...f.towerAt.map((tw, i) => ({ ...((sp.towers && sp.towers[i]) || base), at: [tw.x, tw.z], w: Math.min(tw.w, ((sp.towers && sp.towers[i]) || base).w || tw.w), h: Math.max(((sp.towers && sp.towers[i]) || base).h, tw.h || tw.lv * 3.6) })), ...(sp.towers || []).slice(f.towerAt.length)] };
        }
        const r0 = M.count('roof');
        buildChurch(M, F, sp, y0, near);
        S.roofs.push({ s: r0, n: M.count('roof') - r0, x: cx, z: cz, base: C(sp.roof), keep: 0.5 });
        bb.top = y0 + (sp.nave || 8) + F.hv * 0.5 + 6; bb.base = y0 - 1.2;
        if (notable(t) && labels.length < Q.maxLabels - 2) labels.push({ name: t.name, x: cx, z: cz, y: y0 + Math.max(...((sp.towers || []).map(q => q.h)), 14) + 12 });
        return;
      }
    }

    // --- campanario suelto (sin iglesia al lado) ---
    if (/^(tower|belltower|bell_tower|campanile)$/.test(t.building || '')) {
      const F = frameOf(pts);
      if (F) {
        const H = parseFloat(t.height) || (levels ? levels * 3.6 : 18);
        buildChurch.tower(M, F, 0, 0, { side: 'C', h: H, w: Math.max(1.6, Math.min(F.hu, F.hv)), bodies: Math.max(2, Math.min(5, Math.round(H / 7))), top: 'cupola' }, y0, { wall: 0xeee2c0, trim: 0xffffff, roof: 0xb15a3a });
        bb.top = y0 + H + 4; bb.base = y0 - 1.2;
        return;
      }
    }
    // --- estilo según la zona de la ciudad ---
    // Las plantas y la altura de OpenStreetMap mandan siempre: los edificios altos ("26 Plantas", "18 Plantas", "12 Plantas
    // Finlay"…) conservan su tamaño real. El estilo solo decide fachadas y techos.
    const lv = levels > 0 ? Math.round(levels) : 0, ht = hTag > 0 ? hTag : 0;
    const tall = !church && (lv >= 4 || ht >= 14) && !(blockOv && blockOv.h && !lv && !ht);
    const prefab = !blockOv && !church && !tall && inPrefabZone(cx, cz) && area > 140 && (lv >= 3 || area > 260) && !lm;
    const tileSeen = isTileColor(sample);
    let style, wall, h, flat, tiled = false, trim = null, tank = 0, floors = 1, fh0, fhU;
    if (blockOv && !tall) {
      style = 'block'; h = ht || (lv ? 5 + (lv - 1) * 4.2 : blockOv.h); wall = C(blockOv.wall); trim = C(blockOv.trim); flat = blockOv.flat || !blockOv.tiled; tiled = !!blockOv.tiled;
      floors = lv || Math.max(1, Math.round((h - 5) / 4.2) + 1);
    } else if (tall) {                                  // edificios altos (de paneles prefabricados, hoteles, oficinas)
      style = 'prefab'; floors = lv || Math.max(4, Math.round(ht / 3)); h = ht || floors * 3.0;
      wall = blockOv ? C(blockOv.wall) : PREFAB[Math.floor(rnd() * PREFAB.length)].clone(); flat = true; tank = 3;
    } else if (prefab) {
      style = 'prefab'; floors = lv >= 3 ? lv : 4 + Math.floor(rnd() * 2);
      h = ht || floors * 3; wall = PREFAB[Math.floor(rnd() * PREFAB.length)].clone(); flat = true; tank = 2;
    } else if (zone === 'core') {
      style = 'colonial'; wall = COLONIAL[Math.floor(rnd() * COLONIAL.length)].clone().multiplyScalar(0.76 + rnd() * 0.24);
      floors = lv >= 1 ? lv : area > 700 ? (rnd() < 0.6 ? 2 : 1) : rnd() < 0.74 ? 1 : 2;
      h = ht || (floors === 1 ? 5.4 + rnd() * 1.0 : 5.0 + (floors - 1) * (4.3 + rnd() * 0.6));
      tiled = tileSeen ? rnd() < 0.92 : rnd() < 0.22; flat = !tiled;           // en el casco abundan los techos de teja criolla
      trim = wall.clone().lerp(new THREE.Color(1, 1, 1), 0.6); tank = flat && rnd() < 0.2 ? 1 : 0;
    } else if (area > 900 && !church) {                // naves, almacenes, edificios públicos grandes
      style = 'indus'; wall = new THREE.Color(0xdedbd2).multiplyScalar(0.9 + rnd() * 0.1); h = ht || (lv ? lv * 3.3 : 6 + rnd() * 3);
      flat = !(rnd() < 0.55); floors = Math.max(1, lv);
    } else {                                           // casas de los repartos
      style = zone === 'inner' && rnd() < 0.3 ? 'colonial' : 'house';
      wall = HOUSE[Math.floor(rnd() * HOUSE.length)].clone().multiplyScalar(0.82 + rnd() * 0.18);
      floors = lv >= 1 ? lv : rnd() < 0.86 ? 1 : 2;
      h = ht || (style === 'colonial' ? 4.8 + rnd() * 0.8 + (floors - 1) * 3.8 : floors * (3.2 + rnd() * 0.5));
      const pitchedOk = area < 450 && floors <= 2;
      tiled = pitchedOk && (tileSeen ? rnd() < 0.8 : rnd() < (zone === 'inner' ? 0.38 : 0.55)); flat = !tiled;
      tank = flat && rnd() < 0.45 ? 1 : 0;
      if (style === 'colonial') trim = wall.clone().lerp(new THREE.Color(1, 1, 1), 0.55);
    }
    if (church && !lm) { wall = new THREE.Color(0xf2ead6); h = clamp(h, 8, 12); }
    h = clamp(h, 3, 160);
    if (t['roof:shape'] === 'flat') { flat = true; tiled = false; } else if (/gabled|hipped|pyramidal|half-hipped/.test(t['roof:shape'] || '') && !blockOv) { flat = false; tiled = true; }
    const wc = tagColor(t['building:colour']); if (wc) wall = wc;
    const zincy = style === 'house' || style === 'indus' ? rnd() < 0.6 : false;
    const baseRoof = tagColor(t['roof:colour']) || (tiled ? (zincy ? ZINC_ROOF : TILE_ROOF)[Math.floor(rnd() * 4)] : FLAT_ROOF[Math.floor(rnd() * FLAT_ROOF.length)]).clone();
    const yb = y0 - 1.2, yt = y0 + h;
    if (style === 'colonial' || style === 'block') { fh0 = floors === 1 ? h : 5.0; fhU = floors > 1 ? (h - fh0) / (floors - 1) : 0; }
    else { fh0 = h / floors; fhU = fh0; }

    // --- fachadas ---
    // variantes de fachada de cada edificio (todas sus caras las comparten)
    const pick = list => { let r = rnd() * list.reduce((t, x) => t + x[1], 0); for (const [m, w] of list) { if ((r -= w) <= 0) return m; } return list[0][0]; };
    const deco = (style === 'colonial' || style === 'block') && floors >= 2 && zone !== 'outer' && rnd() < 0.12;          // edificios art déco y modernos de los años 30-50
    const shop = !deco && ((style === 'colonial' && floors >= 2 && rnd() < 0.3) || (style === 'block' && rnd() < 0.3) || (style === 'colonial' && floors === 1 && zone === 'core' && rnd() < 0.07));
    const shopA = pick([[MOD.SHOP, 4], [MOD.SHOP_GLASS, 3], [MOD.BODEGA, 2]]);
    const winA = pick([[MOD.COL_WIN, 45], [MOD.COL_GRILLE, 35], [MOD.COL_WIN_SHUT, 20]]);
    const doorA = pick([[MOD.COL_DOOR, 55], [MOD.COL_ARCH, 20], [MOD.COL_DOOR2, 25]]);
    const upA = deco ? MOD.DECO_UP : pick([[MOD.UP_BALC, 30], [MOD.UP_WIN, 20], [MOD.BALC_WOOD, zone === 'core' ? 16 : 4], [MOD.ECLECTIC_UP, 16], [MOD.BALC_IRON_UP, 18]]);
    const hWin = pick([[MOD.HOUSE_WIN, 50], [MOD.HOUSE_MIAMI, 38], [MOD.HOUSE_PLAIN, 12]]), hDoor = rnd() < 0.3 ? MOD.HOUSE_PORCH : MOD.HOUSE_DOOR;
    const seqGround = n => {
      if (style === 'prefab') { const a = new Array(n).fill(MOD.PREFAB); a[Math.floor(rnd() * n)] = MOD.HOUSE_DOOR; return a; }
      if (style === 'indus') return new Array(n).fill(MOD.INDUS);
      if (style === 'house') {
        const a = new Array(n).fill(hWin); a[n === 1 ? 0 : rnd() < 0.5 ? 0 : Math.floor(n / 2)] = n === 1 && rnd() < 0.5 ? hWin : hDoor;
        for (let i = 0; i < n; i++) if (a[i] === hWin && rnd() < 0.15) a[i] = MOD.HOUSE_PLAIN;
        return a;
      }
      if (deco) { const a = new Array(n).fill(MOD.SHOP); a[Math.floor(n / 2)] = MOD.DECO_GROUND; if (n > 2 && rnd() < 0.5) a[0] = MOD.SHOP_GLASS; return a; }
      let a;
      if (n === 1) a = [rnd() < 0.45 ? doorA : winA];
      else {
        a = new Array(n).fill(winA); const d = rnd() < 0.5 ? (rnd() < 0.5 ? 0 : n - 1) : Math.floor(n / 2);
        a[d] = doorA;
        if (n >= 5 && rnd() < 0.5) a[(d + Math.floor(n / 2)) % n] = doorA;
        for (let i = 0; i < n; i++) if (a[i] === winA && rnd() < 0.1) a[i] = MOD.COL_PLAIN;
      }
      if (shop) {           // algunos vanos son tiendas; el letrero pintado aparece una sola vez por fachada
        let signs = 0;
        for (let i = 0; i < n; i++) if (rnd() < 0.5) a[i] = shopA !== MOD.SHOP && signs++ === 0 ? shopA : MOD.SHOP;
      }
      return a;
    };
    let stairK = -1;
    const seqUpper = (n, ground) => {
      if (style === 'prefab') { stairK = n >= 3 ? 1 + Math.floor(rnd() * (n - 2)) : -1; return ground.map((m, i) => (i === stairK ? MOD.PREFAB_STAIR : rnd() < 0.38 ? MOD.PREFAB_B : MOD.PREFAB)); }
      if (style === 'house' || style === 'indus') return ground.map(m => (m === MOD.INDUS ? MOD.INDUS : rnd() < 0.6 ? MOD.HOUSE_UP : MOD.HOUSE_WIN));
      if (upA === MOD.UP_BALC) return ground.map((m, i) => (i % 2 === 0 || m === doorA ? MOD.UP_BALC : MOD.UP_WIN));
      if (upA === MOD.UP_WIN) return ground.map(m => (m === doorA ? MOD.UP_BALC : MOD.UP_WIN));
      return ground.map(() => upA);
    };
    const AWN = [0xc8423b, 0x2f5fa8, 0x2f8c5a, 0xe2a92e, 0xd8d4c8];
    const modW = style === 'prefab' ? SIZE[MOD.PREFAB][0] : style === 'house' ? SIZE[MOD.HOUSE_WIN][0] : style === 'indus' ? SIZE[MOD.INDUS][0] : SIZE[MOD.COL_WIN][0];
    let columnsB = null;                 // prefabricados: los balcones van en columna
    const party = new Array(pts.length).fill(!detail);
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i], q = pts[(i + 1) % pts.length], dx = q[0] - p[0], dz = q[1] - p[1], len = Math.hypot(dx, dz);
      if (len < 0.3) continue;
      const nx = -dz / len, nz = dx / len;
      // punto de referencia por dentro del lado: la cara mira siempre hacia fuera aunque el edificio tenga forma de L o de U
      const ix = (p[0] + q[0]) / 2 - nx, iz = (p[1] + q[1]) / 2 - nz;
      if (!detail) {                     // celdas lejanas: una sola cara repetida por lado
        const mod = style === 'prefab' ? MOD.PREFAB : style === 'house' ? MOD.HOUSE_WIN : style === 'indus' ? MOD.INDUS : winA;
        M.fquad(p[0], p[1], q[0], q[1], yb, yt, wall, 0, Math.max(1, Math.round(len / modW)), (yb - y0) / fh0, (yt - y0) / fh0, mod, rb, ix, iz, 0.78, 1);
        continue;
      }
      // ¿medianera? (pegada a otro edificio): se mira un poco por fuera del lado
      let inside = 0, probes = len > 9 ? 3 : 1;
      for (let k = 0; k < probes; k++) { const tt = probes === 1 ? 0.5 : 0.2 + 0.3 * k; if (this.inBuilding(p[0] + dx * tt + nx * 1.3, p[1] + dz * tt + nz * 1.3, bb)) inside++; }
      if (len < 1.5 || inside * 2 > probes) {
        party[i] = true;
        M.fquad(p[0], p[1], q[0], q[1], yb, yt, wall, 0, Math.max(1, Math.round(len / 6)), (yb - y0) / 4, (yt - y0) / 4, MOD.PARTY, rb, ix, iz, 0.85, 1);
        continue;
      }
      const n = Math.max(1, Math.round(len / modW)), g0 = seqGround(n), up = floors > 1 ? seqUpper(n, g0) : null;
      if (style === 'prefab' && !columnsB) columnsB = up;
      for (let k = 0; k < n; k++) {
        const a0 = k / n, a1 = (k + 1) / n, x0 = p[0] + dx * a0, z0 = p[1] + dz * a0, x1 = p[0] + dx * a1, z1 = p[1] + dz * a1;
        M.fquad(x0, z0, x1, z1, yb, y0 + fh0, wall, 0, 1, (yb - y0) / fh0, 1, g0[k], rb, ix, iz, 0.78, 1);
        if (g0[k] === MOD.SHOP || (g0[k] === MOD.SHOP_GLASS && rnd() < 0.6)) {             // letrero del comercio sobre la banda del cartel
          const [ua, ub, va, vb] = g0[k] === MOD.SHOP ? [0.16, 0.84, 0.74, 0.86] : [0.11, 0.89, 0.72, 0.87], o = 0.05;
          M.sign(x0 + (x1 - x0) * ua + nx * o, z0 + (z1 - z0) * ua + nz * o, x0 + (x1 - x0) * ub + nx * o, z0 + (z1 - z0) * ub + nz * o, y0 + fh0 * va, y0 + fh0 * vb, this.signs.uv(rnd() * SIGN_COUNT | 0), ix, iz);
        }
        if ((g0[k] === MOD.SHOP || g0[k] === MOD.SHOP_GLASS) && rnd() < 0.55) {           // toldo de lona
          const ac = C(AWN[rnd() * AWN.length | 0]), ya = y0 + Math.min(3.75, fh0 - 1.1), out = 1.15, sh = 0.32, ex = dx / len * sh, ez = dz / len * sh;
          const A = [x0 + ex, ya, z0 + ez], B = [x1 - ex, ya, z1 - ez], Cc = [x1 - ex + nx * out, ya - 0.5, z1 - ez + nz * out], D = [x0 + ex + nx * out, ya - 0.5, z0 + ez + nz * out];
          M.quad('solid', A, B, Cc, D, ac, 1.05); M.quad('solid', D, Cc, [Cc[0], Cc[1] - 0.28, Cc[2]], [D[0], D[1] - 0.28, D[2]], ac, 0.9);
        }
        for (let fl = 1; fl < floors; fl++) {
          const ya = y0 + fh0 + (fl - 1) * fhU, yc = Math.min(yt, ya + fhU);
          const mod = style === 'prefab' && up[k] !== MOD.PREFAB_STAIR ? (rnd() < 0.85 ? up[k] : (up[k] === MOD.PREFAB ? MOD.PREFAB_B : MOD.PREFAB)) : up[k];
          M.fquad(x0, z0, x1, z1, ya, yc, wall, 0, 1, 0, (yc - ya) / fhU, mod, rb, ix, iz, 0.95, 1);
        }
      }
      if (style === 'house' && zone !== 'core' && len > 4 && S.fronts) S.fronts.push({ p, q, nx, nz, len, y0, cx, cz, wall, r: rnd() });
      // portal: galería con columnas clásicas frente a la calle (típico de Camagüey y sus calzadas)
      if (style === 'colonial' && zone !== 'outer' && len > 7 && floors <= 2 && !f.portalDone && rnd() < (zone === 'core' ? 0.1 : 0.2)) {
        f.portalDone = true;
        const cn = Math.max(2, Math.floor(len / 3.6)), col = rnd() < 0.8 ? C(0xf1eee6) : C(0x7fd1c0), ph = Math.min(4.4, fh0 - 0.6);
        for (let k = 0; k <= cn; k++) { const ff = k / cn, x = p[0] + dx * ff + nx * 2.2, z = p[1] + dz * ff + nz * 2.2; M.cyl(x, z, 0.24, 0.2, y0, y0 + ph - 0.25, col, 6, false); M.obox({ at: (a, b2) => [x + a, z + b2] }, 0, 0, 0.32, 0.32, y0 + ph - 0.3, y0 + ph, col, 'solid', { cap: false }); }
        M.quad('solid', [p[0] + nx * 2.5, y0 + ph, p[1] + nz * 2.5], [q[0] + nx * 2.5, y0 + ph, q[1] + nz * 2.5], [q[0], y0 + ph, q[1]], [p[0], y0 + ph, p[1]], wall, 0.8);
        M.quad('solid', [p[0] + nx * 2.5, y0 + ph - 0.5, p[1] + nz * 2.5], [q[0] + nx * 2.5, y0 + ph - 0.5, q[1] + nz * 2.5], [q[0] + nx * 2.5, y0 + ph + 0.15, q[1] + nz * 2.5], [p[0] + nx * 2.5, y0 + ph + 0.15, p[1] + nz * 2.5], C(0xf3efe6));
        M.quad('solid', [p[0] + nx * 2.5, y0 + 0.08, p[1] + nz * 2.5], [q[0] + nx * 2.5, y0 + 0.08, q[1] + nz * 2.5], [q[0], y0 + 0.08, q[1]], [p[0], y0 + 0.08, p[1]], C(0xb9b2a4));
      }
    }

    // --- techo ---
    const pr = trim || wall;
    let topY = yt;
    const roofStart = M.count('roof');
    const flatRoof = () => {
      const rise = style === 'prefab' ? 0.5 : style === 'house' ? 0.55 : 0.85;
      for (let i = 0; i < pts.length && detail; i++) {               // pretil (de lejos no se dibuja)
        const p = pts[i], q = pts[(i + 1) % pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]) || 1, nx = -(q[1] - p[1]) / l, nz = (q[0] - p[0]) / l;
        if (detail && !party[i] && (style === 'colonial' || style === 'block')) M.quad('solid', [p[0] + nx * 0.22, yt - 0.5, p[1] + nz * 0.22], [q[0] + nx * 0.22, yt - 0.5, q[1] + nz * 0.22], [q[0] + nx * 0.22, yt + 0.06, q[1] + nz * 0.22], [p[0] + nx * 0.22, yt + 0.06, p[1] + nz * 0.22], pr);
        M.flat(p[0], p[1], q[0], q[1], yt, yt + rise, pr, 0.95);
        if (detail && !party[i] && style !== 'house') M.quad('solid', [p[0], yt + rise, p[1]], [q[0], yt + rise, q[1]], [q[0] - nx * 0.2, yt + rise, q[1] - nz * 0.2], [p[0] - nx * 0.2, yt + rise, p[1] - nz * 0.2], pr, 1.02);
      }
      const tris = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
      for (const tri of tris) M.tri('roof', [pts[tri[0]][0], yt + 0.1, pts[tri[0]][1]], [pts[tri[2]][0], yt + 0.1, pts[tri[2]][1]], [pts[tri[1]][0], yt + 0.1, pts[tri[1]][1]], baseRoof);
      topY = detail ? yt + rise : yt;
    };
    const F = !flat ? frameOf(pts) : null;
    const rect = F && F.ar > 0 && area / (F.ar) > 0.86;
    if (flat) flatRoof();
    else if (rect) {                     // dos o cuatro aguas sobre el rectángulo del edificio, con alero
      const ov2 = 0.35, A = F.hu + ov2, Bh = F.hv + ov2, hip = rnd() < 0.4 || F.hu < F.hv * 1.25, rise = clamp(F.hv * 0.5, 1.0, 3.4), yr = yt + rise;
      const P = (a, b, y) => { const q = F.at(a, b); return [q[0], y, q[1]]; };
      const rA = hip ? Math.max(0.2, A - Bh) : A;
      M.quad('roof', P(-A, -Bh, yt - 0.12), P(A, -Bh, yt - 0.12), P(rA, 0, yr), P(-rA, 0, yr), baseRoof, 0.9);
      M.quad('roof', P(A, Bh, yt - 0.12), P(-A, Bh, yt - 0.12), P(-rA, 0, yr), P(rA, 0, yr), baseRoof, 1.06);
      if (hip) { M.tri('roof', P(A, -Bh, yt - 0.12), P(A, Bh, yt - 0.12), P(rA, 0, yr), baseRoof, 1.0); M.tri('roof', P(-A, Bh, yt - 0.12), P(-A, -Bh, yt - 0.12), P(-rA, 0, yr), baseRoof, 0.96); }
      else { M.tri('solid', P(F.hu, -F.hv, yt), P(F.hu, F.hv, yt), P(F.hu, 0, yr - 0.1), wall, 0.95); M.tri('solid', P(-F.hu, F.hv, yt), P(-F.hu, -F.hv, yt), P(-F.hu, 0, yr - 0.1), wall, 0.92); }
      // remate de la cumbrera
      if (detail) M.quad('roof', P(-rA, -0.12, yr - 0.02), P(rA, -0.12, yr - 0.02), P(rA, 0.12, yr - 0.02), P(-rA, 0.12, yr - 0.02), baseRoof.clone().multiplyScalar(0.85));
      topY = yr;
    } else {                              // contorno irregular: faldón de teja alrededor y azotea en el centro
      const d = clamp(Math.sqrt(area) * 0.18, 1.6, 3.2);
      let ins = inset(pts, d); if (!ins) ins = inset(pts, d * 0.55);
      if (!ins) flatRoof();
      else {
        const rise = (ins === null ? d : d) * 0.45;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], q = pts[(i + 1) % pts.length], P2 = ins[i], Q2 = ins[(i + 1) % pts.length];
          M.quad('roof', [p[0], yt - 0.1, p[1]], [q[0], yt - 0.1, q[1]], [Q2[0], yt + rise, Q2[1]], [P2[0], yt + rise, P2[1]], baseRoof, 0.88 + 0.18 * ((i * 7) % 3) / 2);
        }
        const tris = THREE.ShapeUtils.triangulateShape(ins.map(p => new THREE.Vector2(p[0], p[1])), []);
        for (const tri of tris) M.tri('roof', [ins[tri[0]][0], yt + rise, ins[tri[0]][1]], [ins[tri[2]][0], yt + rise, ins[tri[2]][1]], [ins[tri[1]][0], yt + rise, ins[tri[1]][1]], baseRoof.clone().multiplyScalar(0.92));
        topY = yt + rise;
      }
    }
    S.roofs.push({ s: roofStart, n: M.count('roof') - roofStart, x: cx, z: cz, base: baseRoof, keep: blockOv ? 0.4 : 0 });

    // --- cosas sobre la azotea: tinacos, caseta de la escalera, antenas ---
    if (detail && flat) {
      const spot = (fx, fz) => { const x = cx + (fx - 0.5) * (bb.maxx - bb.minx) * 0.5, z = cz + (fz - 0.5) * (bb.maxz - bb.minz) * 0.5; return inPoly(x, z, pts) ? [x, z] : null; };
      for (let k = 0; k < tank; k++) { const s = spot(rnd(), rnd()); if (s && area > 40) addTank(M, s[0], s[1], yt + 0.1, rnd()); }
      if (floors >= 6 && area > 120) { const s2 = spot(0.5, 0.5) || [cx, cz]; M.obox({ at: (a2, b2) => [s2[0] + a2, s2[1] + b2] }, 0, 0, 2.2, 1.8, yt, yt + 3.2, pr, 'solid', { capCol: C(0x8a8780) }); }
      if (floors >= 2 && area > 90 && rnd() < 0.3) { const s = spot(rnd(), rnd()); if (s) M.obox({ at: (a, b2) => [s[0] + a, s[1] + b2] }, 0, 0, 1.3, 1.1, yt, yt + 2.4, pr, 'solid', { capCol: C(0x8a8780) }); }
      if (rnd() < 0.15) { const s = spot(rnd(), rnd()); if (s) { M.cyl(s[0], s[1], 0.03, 0.03, yt, yt + 3.2, C(0x555555), 4, false); M.obox({ at: (a, b2) => [s[0] + a, s[1] + b2] }, 0, 0, 0.6, 0.02, yt + 2.8, yt + 2.84, C(0x555555), 'solid'); } }
    }
    bb.top = topY + 1; bb.base = yb;
    if (notable(t) && labels.length < Q.maxLabels - 2) labels.push({ name: t.name, x: cx, z: cz, y: topY + (church ? 22 : 12) });
  }

  // ---- construcción de una celda, repartida entre fotogramas ----
  slicer(c) {
    let t0 = performance.now(), last = t0;
    const g = this.w.game;
    return async () => {
      const now = performance.now(); this.buildMs += now - last; last = now;
      const budget = !g.ready || g.state.hangarOpen ? 22 : 5;
      if (now - t0 < budget) return false;
      await nextFrame(); t0 = last = performance.now();
      return !!c.dead;
    };
  }
  async build(c, els) {
    if (c.dead) return;
    if (c.replacing) this.releaseData(c.replacing);
    const y = this.slicer(c), th = (x, z) => this.w.terrain.h(x, z), scene = this.w.game.scene;
    const M = new Mesher(), S = { roofs: [], fronts: c.lite ? null : [] }, labels = [], detail = !c.lite;
    // 1) huellas (antes que nada, para saber qué lados son medianeras)
    const F = [], own = this.roads.cellBounds(c);
    for (const b of els) {
      if (b.type !== 'way' || !b.geometry || !(b.tags && b.tags.building) || this.ids.has(b.id)) continue;
      const pts = b.geometry.map(p => ll2xz(p.lat, p.lon));
      if (pts.length > 3 && pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
      if (pts.length < 3) continue;
      // cada edificio lo construye la celda donde está su centro (así no desaparece al descargar la celda vecina)
      let mx = 0, mz = 0; for (const p of pts) { mx += p[0]; mz += p[1]; } mx /= pts.length; mz /= pts.length;
      if (mx < own.minx || mx >= own.maxx || mz < own.minz || mz >= own.maxz) continue;
      this.ids.add(b.id); c.ids.push(b.id);
      F.push(this.footprint(c, b.id, pts, b.tags || {}, null));
      if ((F.length & 63) === 0 && await y()) return;
    }
    // lugares emblemáticos que en OSM son relaciones: se colocan con su huella real
    const bb = this.roads.cellBounds(c);
    FIXED.forEach((f, i) => {
      const [x, z] = ll2xz(f.lat, f.lon), key = 'fx' + i;
      if (x < bb.minx || x >= bb.maxx || z < bb.minz || z >= bb.maxz || this.ids.has(key)) return;
      this.ids.add(key); c.ids.push(key);
      const Fr = frameFromSpec(x, z, f.ang, f.L, f.W), pts = [Fr.at(-Fr.hu, -Fr.hv), Fr.at(Fr.hu, -Fr.hv), Fr.at(Fr.hu, Fr.hv), Fr.at(-Fr.hu, Fr.hv)];
      F.push(this.footprint(c, 9000 + i, pts, { name: f.name, building: f.style.kind === 'church' ? 'church' : 'hotel', amenity: f.style.kind === 'church' ? 'place_of_worship' : undefined }, f.style));
    });
    // torres que OSM dibuja aparte (campanarios): si están junto a una iglesia, la torre del modelo se pone en su sitio real
    const TOWER = /^(tower|belltower|bell_tower|campanile)$/;
    const towers = F.filter(f => TOWER.test(f.t.building || '') || /bell_tower|tower/.test(f.t['man_made'] || ''));
    if (towers.length) for (const f of F) {
      const ch = /^(church|cathedral|chapel)$/.test(f.t.building) || f.t.amenity === 'place_of_worship' || (f.ov && f.ov.kind === 'church');
      if (!ch || TOWER.test(f.t.building || '')) continue;
      for (const tw of towers) {
        if (tw.skip) continue;
        const d = Math.hypot(tw.cx - f.cx, tw.cz - f.cz), r = Math.sqrt(f.area) * 0.75 + 12;
        if (d > r) continue;
        let hw = 1e9; const Fr = frameOf(tw.pts); if (Fr) hw = Math.min(Fr.hu, Fr.hv);
        (f.towerAt = f.towerAt || []).push({ x: tw.cx, z: tw.cz, w: clamp(hw, 2, 6), lv: parseFloat(tw.t['building:levels']) || 0, h: parseFloat(tw.t.height) || 0 });
        tw.skip = true;
      }
    }
    // 2) edificios
    for (let i = 0; i < F.length; i++) {
      if (F[i].skip) continue;
      try { this.addBuilding(c, M, S, F[i], labels, detail); } catch (e) { if (!this.warned) { this.warned = true; console.warn('edificio con datos raros', F[i].id, e); } }
      if ((i & 15) === 15 && await y()) return;
    }
    // parques con nombre y puntos de interés (monumentos, museos, hoteles…)
    for (const e of els) {
      const t = e.tags || {};
      if (!t.name || labels.length >= Q.maxLabels) continue;
      if (e.type === 'node' && (t.historic || t.tourism)) { const p = ll2xz(e.lat, e.lon); labels.push({ name: t.name, x: p[0], z: p[1], y: th(p[0], p[1]) + 16 }); }
      else if (e.type === 'way' && e.geometry && t.leisure === 'park') {
        let sx = 0, sz = 0; for (const p of e.geometry) { const q = ll2xz(p.lat, p.lon); sx += q[0]; sz += q[1]; }
        sx /= e.geometry.length; sz /= e.geometry.length;
        labels.push({ name: t.name, x: sx, z: sz, y: th(sx, sz) + 22 });
      }
    }
    for (const l of labels) {
      const sp = this.makeLabel(l.name); sp.position.set(l.x, l.y, l.z); sp.userData.name = l.name; sp.visible = false; sp.matrixAutoUpdate = false; sp.updateMatrix();
      scene.add(sp); c.labels.push(sp);
    }
    const spots = [];
    if (detail) {
      if (Q.water) { c.waterMesh = this.water.build(els); if (c.waterMesh) scene.add(c.waterMesh); }
      if (await y()) return;
      const R = await this.roads.build(c, els, scene, y); if (c.dead) return;
      c.roadMeshes = R.meshes; c.roadInfos = R.infos;
      if (Q.props) { await this.furniture(c, M, R.infos, spots, bb, y); if (c.dead) return; await this.fences(c, M, S.fronts, R.infos, y); if (c.dead) return; }
    }
    if (await y()) return;
    this.finish(c, M, S, scene);
    if (await y()) return;
    c.map = buildCellMap(c, bb, F, detail ? els : null, c.roadInfos, detail ? this.roads.squares : null);       // plano para el minimapa
    if (detail) {
      if (await y()) return;
      this.buildTrees(c, els, spots);
      if (await y()) return;
      this.traffic.build(c, els);
    }
    c.state = 'done';
    if (c.replacing) { this.dropMeshes(c.replacing); c.replacing = null; }
  }

  // convierte lo acumulado en mallas de la celda y recoloca los techos con la foto satelital
  finish(c, M, S, scene) {
    const add = (k, mat) => { const m = M.mesh(k, mat); if (m) { scene.add(m); c.meshes.push(m); } return m; };
    c.fac = add('fac', this.facMat);
    c.roofs = add('roof', this.roofMat);
    add('solid', this.solidMat);
    add('glow', this.glowMat);
    add('sign', this.signs.mat);
    add('fence', this.fenceMat);
    c.tint = S.roofs; c.pendingRoofs = S.roofs.length;
    this.retint(c);
  }
  // pinta cada techo con el color real de la foto aérea (si la tesela aún no llegó, se reintenta más tarde)
  retint(c) {
    if (!c.roofs) { c.pendingRoofs = 0; return; }
    const col = c.roofs.geometry.attributes.color, A = col.array, P = c.roofs.geometry.attributes.position.array, tmp = new THREE.Color(); let any = false, pend = 0;
    for (const r of c.tint) {
      if (r.done) continue;
      const s = this.w.tiles.sample(r.x, r.z);
      if (!s) { pend++; continue; }
      roofFromSample(s, r.base, tmp);
      if (r.keep) tmp.lerp(r.base, r.keep);
      // se respeta el sombreado de cada faldón (lo que ya había respecto al color base)
      const br = Math.max(0.01, r.base.r), bg = Math.max(0.01, r.base.g), bbl = Math.max(0.01, r.base.b);
      for (let v = r.s; v < r.s + r.n; v++) {
        const i = v * 3, sh = Math.min(1.3, (A[i] / 255 / br + A[i + 1] / 255 / bg + A[i + 2] / 255 / bbl) / 3);
        A[i] = b255(tmp.r * sh); A[i + 1] = b255(tmp.g * sh); A[i + 2] = b255(tmp.b * sh);
      }
      r.done = true; any = true;
    }
    void P;
    c.pendingRoofs = pend;
    if (any) col.needsUpdate = true;
  }

  // plazas: tinajones, estatua de Agramonte, esculturas, bancos y farolas; postes con cables; árboles de calle
  // Cercas de los repartos: reja sobre murete, malla verde o murete de balaustres delante de las casas, a 2-4 m de la fachada,
  // sin invadir la calle ni la acera ni otros edificios
  async fences(c, M, fronts, infos, y) {
    if (!fronts || !fronts.length) return;
    let seed = Math.abs(c.i * 2203 + c.j * 6637) % 2147483646 + 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647, th = (x, z) => this.w.terrain.h(x, z);
    const mask = new Set(), key = (x, z) => Math.floor(x / 2) * 100003 + Math.floor(z / 2);
    for (const r of infos) for (let i = 0; i < r.pts.length - 1; i++) {
      const p = r.pts[i], q = r.pts[i + 1], l = Math.hypot(q.x - p.x, q.z - p.z), n = Math.ceil(l / 1.5), hw = r.w / 2 + (r.sw || 0) + 0.6;
      const nx = -(q.z - p.z) / (l || 1), nz = (q.x - p.x) / (l || 1);
      for (let k = 0; k <= n; k++) for (let o = -hw; o <= hw; o += 1.6) { const f2 = k / n; mask.add(key(p.x + (q.x - p.x) * f2 + nx * o, p.z + (q.z - p.z) * f2 + nz * o)); }
    }
    if (await y()) return;
    const free = (x, z) => !mask.has(key(x, z)) && !this.inBuilding(x, z);
    let n = 0;
    for (const fr of fronts) {
      if ((++n & 31) === 0 && await y()) return;
      if (fr.r > 0.62) continue;
      const mod = fr.r < 0.27 ? MOD.FENCE_IRON : fr.r < 0.45 ? MOD.FENCE_CHAIN : MOD.FENCE_WALL;
      // la mayor profundidad de jardín que quepa (de 4 m a 1.6 m)
      let d = 0;
      for (const dd of [4, 3.2, 2.4, 1.6]) {
        let ok = true;
        for (let t = 0; t <= 1.001 && ok; t += 0.25) { const x = fr.p[0] + (fr.q[0] - fr.p[0]) * t + fr.nx * dd, z = fr.p[1] + (fr.q[1] - fr.p[1]) * t + fr.nz * dd; ok = free(x, z); }
        if (ok) { d = dd; break; }
      }
      if (!d) continue;
      const A = [fr.p[0] + fr.nx * d, fr.p[1] + fr.nz * d], B = [fr.q[0] + fr.nx * d, fr.q[1] + fr.nz * d];
      const seg = (p, q) => {
        const l = Math.hypot(q[0] - p[0], q[1] - p[1]); if (l < 0.4) return;
        const u1 = Math.max(1, Math.round(l / 3)), yy = th((p[0] + q[0]) / 2, (p[1] + q[1]) / 2) - 0.45, mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
        const ox = -(q[1] - p[1]) / l, oz = (q[0] - p[0]) / l;
        // las dos caras (se ve desde la calle y desde el jardín)
        M.fquad(p[0], p[1], q[0], q[1], yy, yy + 2.3, fr.wall, 0, u1, 0, 1, mod, fr.r * 255 | 0, mx + ox, mz + oz, 0.85, 1, 'fence');      // doble cara en su material
      };
      seg(A, B); seg(fr.p, A); seg(fr.q, B);
    }
  }
  // monumentos, locomotoras, tanques elevados y torres (js/data/monuments.js), con su volumen de choque
  monumentsIn(c, M, inCell, th) {
    for (const m of this.monuments) {
      const [x, z] = m.xz; if (!inCell(x, z)) continue;
      if (m.t !== 'comm' && m.t !== 'plazarev' && this.inBuilding(x, z)) continue;       // p. ej. una tarja dentro de una iglesia
      const g = th(x, z), ang = (m.a || 0) * Math.PI / 180, F = faceFrame(x, z, ang);
      const rect = (a0, a1, b0, b1) => [F.at(a0, b0), F.at(a1, b0), F.at(a1, b1), F.at(a0, b1)];
      const sq = (r, top, base = g - 1) => this.solid(c, rect(-r, r, -r, r), base, top);
      switch (m.t) {
        case 'bust': addBust(M, x, z, g, ang); sq(0.5, g + 2.4); break;
        case 'statue': case 'statueL': { const big = m.t === 'statueL'; addStatueFig(M, x, z, g, ang, big); sq(big ? 3.2 : 1.35, g + (big ? 7.8 : 4.8)); break; }
        case 'figure': addFigure(M, x, z, g, ang); sq(0.5, g + 2); break;
        case 'obelisk': { const h = m.h || 9; addObelisk(M, x, z, g, h, ang); sq(Math.max(0.55, h * 0.07) * 2.8, g + h); break; }
        case 'barberan': addBarberan(M, x, z, g, ang); sq(2.4, g + 11); break;
        case 'stele': addStele(M, x, z, g, ang); sq(1.5, g + 2.6); break;
        case 'sculpt': addStoneSculpt(M, x, z, g, ang); sq(1.0, g + 3); break;
        case 'ceiba': addCeiba(M, x, z, g); sq(1.3, g + 15); break;
        case 'loco': addLocomotive(M, x, z, g, ang, m.i); this.solid(c, rect(-1.45, 1.45, -9.1, 5.1), g - 1, g + 4.1); break;
        case 'wtower': { const h = m.h || 24; addWaterTower(M, x, z, g, h); sq(1.6, g + h - 8, g - 1); sq(5.2, g + h + 0.5, g + h - 8.4); break; }
        case 'light': addLightTower(M, x, z, g, m.h || 34, m.to[0], m.to[1]); sq(0.6, g + (m.h || 34) + 3); break;
        case 'comm': {
          const roof = this.roofAt(x, z), base = roof !== null && roof > g + 2 ? roof : g, h = roof !== null && roof > g + 2 ? m.h * 0.6 : m.h;   // en la azotea si cae sobre un edificio
          addCommTower(M, x, z, base, h); this.solid(c, rect(-Math.max(1.4, h * 0.06), Math.max(1.4, h * 0.06), -Math.max(1.4, h * 0.06), Math.max(1.4, h * 0.06)), base - 1, base + h + 4); break;
        }
        case 'plazarev':
          buildPlazaRev(M, x, z, g, ang);
          this.solid(c, rect(-23, 21, -8.4, 8.3), g - 1, g + 3.2);                // tribuna y escalinatas
          this.solid(c, rect(-6.6, 6.2, -2.6, -0.6), g - 1, g + 27);              // gran marco
          this.solid(c, rect(-32, -15, -1.4, 0.2), g - 1, g + 10);                // vigas y losas
          this.solid(c, rect(14, 29, -1.4, 0.2), g - 1, g + 8);
          break;
      }
    }
  }
  async furniture(c, M, infos, spots, bb, y) {
    const th = (x, z) => this.w.terrain.h(x, z), inCell = (x, z) => x >= bb.minx && x < bb.maxx && z >= bb.minz && z < bb.maxz;
    for (const p of PROPS) {
      const [x, z] = p.xz; if (!inCell(x, z)) continue;
      const yy = th(x, z) + 0.08;
      if (p.type === 'jar') addJar(M, x, z, yy); else if (p.type === 'statue') addStatue(M, x, z, yy);
      else if (p.type === 'sculpture') addSculpture(M, x, z, yy); else if (p.type === 'royalpalm') addRoyalPalm(M, x, z, yy);
    }
    this.monumentsIn(c, M, inCell, th);
    // bancos y farolas siguiendo el borde de las plazas y parques del casco
    for (const s of this.roads.squares) {
      if (s.nb) continue;
      let sx = 0, sz = 0; for (const q of s.xz) { sx += q[0]; sz += q[1]; } sx /= s.xz.length; sz /= s.xz.length;
      if (!inCell(sx, sz)) continue;
      let k = 0;
      for (let i = 0; i < s.xz.length; i++) {
        const p = s.xz[i], q = s.xz[(i + 1) % s.xz.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
        for (let d = 4; d < l - 2 && k < 70; d += 11, k++) {
          const f = d / l, x0 = p[0] + (q[0] - p[0]) * f, z0 = p[1] + (q[1] - p[1]) * f, ix = sx - x0, iz = sz - z0, il = Math.hypot(ix, iz) || 1, ox = x0 + ix / il * 2.6, oz = z0 + iz / il * 2.6;
          if (k % 3 === 0) addLampPost(M, ox, oz, th(ox, oz) + 0.08);
          else addBench(M, ox, oz, th(ox, oz) + 0.08, Math.atan2(iz, ix) + Math.PI);
        }
      }
    }
    if (await y()) return;
    // postes de luz y cables junto a las calles; árboles de calle
    let seed = Math.abs(c.i * 4231 + c.j * 7727) % 2147483646 + 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const wires = [], lamps = []; let poles = 0, n = 0;
    const cap = Q.maxLamps / 3;
    for (const r of infos) {
      if ((++n & 31) === 0 && await y()) return;
      if (/^(motorway|trunk|footway|pedestrian|service|track)$/.test(r.hw)) continue;
      const pts = r.pts, sideSign = rnd() < 0.5 ? 1 : -1, off = r.w / 2 + Math.min(1.2, (r.sw || 1) * 0.7), zone = zoneAt(pts[0].x, pts[0].z);
      let acc = 0, next = 8 + rnd() * 20, prev = null, tacc = 0, tnext = 6 + rnd() * 10;
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1], l = Math.hypot(q.x - p.x, q.z - p.z); if (l < 0.5) continue;
        const tx = (q.x - p.x) / l, tz = (q.z - p.z) / l, nx = -tz * sideSign, nz = tx * sideSign;
        while (acc + l >= next) {
          const f = (next - acc) / l, x = p.x + (q.x - p.x) * f + nx * off, z = p.z + (q.z - p.z) * f + nz * off;
          next += 36 + rnd() * 10;
          if (!inCell(x, z) || this.inBuilding(x, z) || poles >= cap) { prev = null; continue; }
          const yy = th(x, z); poles++;
          addPole(M, x, z, yy, tx, tz, rnd() < 0.09);
          if (rnd() < 0.35) { addStreetLamp(M, x, z, yy, -nx, -nz); lamps.push(x - nx * 1.4, yy + 7.6, z - nz * 1.4); }       // el alumbrado público es escaso
          if (prev) {
            for (const b of [-0.8, 0, 0.8]) {
              const ax = prev.x - prev.tz * b, az = prev.z + prev.tx * b, bx = x - tz * b, bz = z + tx * b, mx = (ax + bx) / 2, mz = (az + bz) / 2;
              if (Math.hypot(bx - ax, bz - az) < 70) wires.push(ax, prev.y + 7.5, az, mx, Math.min(prev.y, yy) + 6.9, mz, mx, Math.min(prev.y, yy) + 6.9, mz, bx, yy + 7.5, bz);
            }
          }
          prev = { x, z, y: yy, tx, tz };
        }
        acc += l;
        // árboles de calle (laureles, almendros, flamboyanes): pocos en el casco estrecho, más en repartos y avenidas
        const chance = zone === 'core' ? 0.1 : /primary|secondary|tertiary/.test(r.hw) ? 0.55 : 0.38;
        while (tacc + l >= tnext) {
          const f = (tnext - tacc) / l; tnext += 15 + rnd() * 10;
          const x = p.x + (q.x - p.x) * f - nx * (off + 0.4), z = p.z + (q.z - p.z) * f - nz * (off + 0.4);
          if (rnd() < chance && inCell(x, z) && !this.inBuilding(x, z)) spots.push([x, z, rnd(), 0.5 + rnd() * 0.5, null, 0.75]);
        }
        tacc += l;
      }
    }
    c.lampPts = lamps;
    if (wires.length) {
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(wires, 3)); g.computeBoundingSphere();
      const ls = new THREE.LineSegments(g, this.wireMat); this.w.game.scene.add(ls); c.meshes.push(ls);
    }
  }

  // ---- árboles y palmas (nodos de OSM + parques y bosques rellenados + calles) ----
  buildTrees(c, els, extra) {
    let seed = Math.abs(c.i * 7919 + c.j * 104729) % 2147483646 + 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    const spots = extra ? extra.slice() : [];
    for (const e of els) {
      const t = e.tags || {};
      if (e.type === 'node' && t.natural === 'tree') { const p = ll2xz(e.lat, e.lon); spots.push([p[0], p[1], rnd(), rnd()]); }
      else if (e.type === 'way' && e.geometry && (t.natural === 'wood' || t.landuse === 'forest' || t.leisure === 'park' || t.leisure === 'garden')) {
        const pts = e.geometry.map(p => ll2xz(p.lat, p.lon));
        let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9, area = 0;
        for (let i = 0; i < pts.length; i++) {
          const p = pts[i], q = pts[(i + 1) % pts.length];
          minx = Math.min(minx, p[0]); maxx = Math.max(maxx, p[0]); minz = Math.min(minz, p[1]); maxz = Math.max(maxz, p[1]);
          area += p[0] * q[1] - q[0] * p[1];
        }
        const n = Math.min(500, Math.abs(area) / 2 / 70);
        for (let tries = 0, got = 0; got < n && tries < n * 4; tries++) {
          const x = minx + rnd() * (maxx - minx), z = minz + rnd() * (maxz - minz);
          if (inPoly(x, z, pts)) { spots.push([x, z, rnd(), rnd()]); got++; }
        }
      }
      if (spots.length > Q.maxTrees) break;
    }
    this.placeTrees(c, spots);
  }
  // spots: [x, z, tamaño 0..1, tipo 0..1, color de la foto o null, escala]
  // Los árboles se agrupan en cuadrantes de ~550 m: cada grupo se recorta solo si no se ve y cambia de detalle según la distancia.
  placeTrees(c, spots) {
    if (!spots.length) return;
    const bb = this.roads.cellBounds(c), mx = (bb.minx + bb.maxx) / 2, mz = (bb.minz + bb.maxz) / 2, groups = [[], [], [], []];
    for (const sp of spots) groups[(sp[0] < mx ? 0 : 1) + (sp[1] < mz ? 0 : 2)].push(sp);
    for (const gr of groups) if (gr.length) this.placeGroup(c, gr);
  }
  placeGroup(c, spots) {
    const th = (x, z) => this.w.terrain.h(x, z), scene = this.w.game.scene;
    const trees = spots.filter(s => s[3] >= 0.2 || s[4]), palms = spots.filter(s => s[3] < 0.2 && !s[4]);   // ~1 de cada 5 es palma real
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), up = new THREE.Vector3(0, 1, 0), pv = new THREE.Vector3(), sv = new THREE.Vector3(), col = new THREE.Color();
    let minx = 1e9, maxx = -1e9, minz = 1e9, maxz = -1e9;
    for (const s of spots) { minx = Math.min(minx, s[0]); maxx = Math.max(maxx, s[0]); minz = Math.min(minz, s[1]); maxz = Math.max(maxz, s[1]); }
    const cy = th((minx + maxx) / 2, (minz + maxz) / 2), sphere = new THREE.Sphere(new THREE.Vector3((minx + maxx) / 2, cy + 6, (minz + maxz) / 2), Math.hypot(maxx - minx, maxz - minz) / 2 + 20);
    const box = { minx, maxx, minz, maxz };
    const view = base => { const g = new THREE.BufferGeometry(); for (const k in base.attributes) g.setAttribute(k, base.attributes[k]); if (base.index) g.setIndex(base.index); g.boundingSphere = sphere; return g; };
    const put = (list, meshes, colorMesh) => {
      list.forEach((sp, i) => {
        const [x, z, r1, r2] = sp, s = (0.7 + r1 * 1.1) * (sp[5] || 1);
        const flam = !sp[4] && r2 > 0.965;                   // flamboyán: copa ancha y aplastada, roja en verano
        m.compose(pv.set(x, th(x, z), z), q.setFromAxisAngle(up, r2 * 6.28 * 4), sv.set(s * (flam ? 1.35 : 1), s * (flam ? 0.65 : 0.9 + r2 * 0.4), s * (flam ? 1.35 : 1)));
        for (const mm of meshes) mm.setMatrixAt(i, m);
        if (colorMesh) {
          if (sp[4]) colorMesh.setColorAt(i, col.setRGB(sp[4][0], sp[4][1], sp[4][2]));
          else if (flam) colorMesh.setColorAt(i, col.setRGB(0.66, 0.26, 0.12));
          else colorMesh.setColorAt(i, col.setHSL(0.23 + (r2 - 0.5) * 0.08, 0.45, 0.22 + r1 * 0.12));
        }
      });
    };
    const make = (geo, mat, n, lo) => { const im = new THREE.InstancedMesh(view(geo), mat, n); im.matrixAutoUpdate = false; im.userData.box = box; if (lo) { im.userData.hi = im.geometry; im.userData.lo = view(lo); } return im; };
    if (trees.length) { const t = make(this.treeHi, this.treeMat, trees.length, this.treeLo); put(trees, [t], t); scene.add(t); c.trees.push(t); }
    if (palms.length) { const t = make(this.palmGeo, this.palmMat, palms.length); put(palms, [t], null); scene.add(t); c.trees.push(t); }
    c.treeFar = undefined;
  }
  // Copas de árboles detectadas en la foto satelital (patios, calles y solares que OSM no registra): se colorean con la foto
  async imageTrees(c) {
    const T = this.w.tiles, bb = this.roads.cellBounds(c), cx = (bb.minx + bb.maxx) / 2, cz = (bb.minz + bb.maxz) / 2;
    if (!T.sample(cx, cz, true)) return false;
    const y = this.slicer(c);
    let seed = Math.abs(c.i * 3571 + c.j * 8209) % 2147483646 + 1;
    const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
    // máscara de calles: celdas de 3 m ocupadas por la calzada y la acera
    const mask = new Set(), key = (x, z) => Math.floor(x / 3) * 100003 + Math.floor(z / 3);
    for (const r of c.roadInfos || []) for (let i = 0; i < r.pts.length - 1; i++) {
      const p = r.pts[i], q = r.pts[i + 1], l = Math.hypot(q.x - p.x, q.z - p.z), n = Math.ceil(l / 2), hw = r.w / 2 + (r.hw === 'footway' ? 0.8 : 2.2);
      const nx = -(q.z - p.z) / (l || 1), nz = (q.x - p.x) / (l || 1);
      for (let k = 0; k <= n; k++) for (let o = -hw; o <= hw; o += 2.4) {
        const f = k / n;
        mask.add(key(p.x + (q.x - p.x) * f + nx * o, p.z + (q.z - p.z) * f + nz * o));
      }
    }
    if (await y()) return true;
    const spots = [], step = 10, lim = Math.floor(Q.maxTrees * 0.5), taken = new Set();
    let n = 0;
    for (let x = bb.minx + 3; x < bb.maxx && spots.length < lim; x += step) {
      if ((++n & 7) === 0 && await y()) return true;
      for (let z = bb.minz + 3; z < bb.maxz && spots.length < lim; z += step) {
        const px = x + (rnd() - 0.5) * 5, pz = z + (rnd() - 0.5) * 5;
        if (mask.has(key(px, pz)) || this.inBuilding(px, pz)) continue;
        const s = T.sample(px, pz, true); if (!s) continue;
        const [r, g, b] = s, l = lum(r, g, b);
        if (g > r * 1.04 && g > b * 1.12 && l < 0.34 && rnd() < 0.85) {
          if (rnd() < 0.07) { spots.push([px, pz, rnd(), 0.1]); continue; }          // cocotero o palma en el patio
          const k2 = Math.floor(px / 5) * 100003 + Math.floor(pz / 5); if (taken.has(k2)) continue; taken.add(k2);
          const k = 1.0 + (0.34 - l) * 0.7;     // más oscuro en la foto = copa más densa
          spots.push([px, pz, rnd(), 0.5 + rnd() * 0.5, [Math.min(1, r * 0.95 * k * 0.8), Math.min(1, g * 1.0 * k * 0.9), Math.min(1, b * 0.9 * k * 0.75)]]);
        }
      }
    }
    if (c.dead) return true;
    this.placeTrees(c, spots);
    return true;
  }

  // tareas periódicas: techos y árboles que esperaban a que llegaran las imágenes
  // árboles de lejos: copa simple y sin tronco
  treeLod() {
    const cam = this.w.game.camera.position, high = cam.y - this.w.terrain.h(cam.x, cam.z) > 450;
    for (const c of this.cells.values()) for (const m of c.trees) {
      const b = m.userData.box; if (!b) continue;
      const dx = Math.max(b.minx - cam.x, 0, cam.x - b.maxx), dz = Math.max(b.minz - cam.z, 0, cam.z - b.maxz);
      const far = high || dx * dx + dz * dz > 260 * 260;
      if (m.userData.far === far) continue; m.userData.far = far;
      if (m.userData.lo) m.geometry = far ? m.userData.lo : m.userData.hi;
    }
  }
  tick(now) {
    if (now - this.tickT < 900 || this.treeBusy) return;
    this.tickT = now;
    this.treeLod();
    let work = 0;
    for (const c of this.cells.values()) {
      if (c.state !== 'done' || work >= 2) continue;
      if (!c.mid) { const b = this.roads.cellBounds(c); c.mid = { x: (b.minx + b.maxx) / 2, z: (b.minz + b.maxz) / 2 }; }
      if (c.pendingRoofs <= 0 && (c.lite || c.imgTrees || !Q.imgTrees)) continue;
      if (!this.w.tiles.sample(c.mid.x, c.mid.z, true)) continue;                 // su imagen aún no llegó
      if (c.pendingRoofs > 0) { this.retint(c); work++; }
      if (!c.lite && !c.imgTrees && Q.imgTrees) {
        c.imgTrees = true; this.treeBusy = true; work++;
        this.imageTrees(c).then(ok => { if (!ok) c.imgTrees = false; }).catch(e => console.error(e)).finally(() => { this.treeBusy = false; });
      }
    }
  }
}

// junta geometrías con o sin índice en una sola con índices: [[geometría, color opcional que sustituye al suyo]]
function mergeIdx(list) {
  const P = [], N = [], C = [], I = [];
  for (const [g0, col] of list) {
    const g = g0, base = P.length / 3, p = g.attributes.position, n = g.attributes.normal, c = g.attributes.color;
    for (let i = 0; i < p.count; i++) {
      P.push(p.getX(i), p.getY(i), p.getZ(i)); N.push(n.getX(i), n.getY(i), n.getZ(i));
      if (col) C.push(col[0], col[1], col[2]); else if (c) C.push(c.getX(i), c.getY(i), c.getZ(i)); else C.push(1, 1, 1);
    }
    if (g.index) for (let i = 0; i < g.index.count; i++) I.push(base + g.index.getX(i));
    else for (let i = 0; i < p.count; i++) I.push(base + i);
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  out.setIndex(I); out.computeBoundingSphere();
  return out;
}
// junta geometrías sin índice (posición, normal, color) en una sola
function mergeGeoms(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), Cc = new Float32Array(n * 3); let o = 0;
  for (const g of list) {
    const c = g.attributes.position.count; P.set(g.attributes.position.array, o * 3);
    if (!g.attributes.normal) g.computeVertexNormals();
    N.set(g.attributes.normal.array, o * 3);
    if (g.attributes.color) Cc.set(g.attributes.color.array, o * 3); else Cc.fill(1, o * 3, (o + c) * 3);
    o += c;
  }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(Cc, 3));
  return out;
}
// copa de árbol hecha de "bolas" con índices: [x, y, z, radio, detalle 1 = icosaedro (12 vértices) | 0 = octaedro (6)]
// más oscura abajo (sombra propia sin sombras en tiempo real)
function blobs(list, y0, y1) {
  const P = [], N = [], Cc = [], I = [];
  const t = (1 + Math.sqrt(5)) / 2;
  const ICO_V = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]];
  const ICO_F = [0, 11, 5, 0, 5, 1, 0, 1, 7, 0, 7, 10, 0, 10, 11, 1, 5, 9, 5, 11, 4, 11, 10, 2, 10, 7, 6, 7, 1, 8, 3, 9, 4, 3, 4, 2, 3, 2, 6, 3, 6, 8, 3, 8, 9, 4, 9, 5, 2, 4, 11, 6, 2, 10, 8, 6, 7, 9, 8, 1];
  const OCT_V = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
  const OCT_F = [0, 2, 4, 0, 4, 3, 0, 3, 5, 0, 5, 2, 1, 2, 5, 1, 5, 3, 1, 3, 4, 1, 4, 2];
  for (const [x, y, z, r, d] of list) {
    const V = d ? ICO_V : OCT_V, Fc = d ? ICO_F : OCT_F, base = P.length / 3;
    for (const v of V) {
      const l = Math.hypot(v[0], v[1], v[2]), nx = v[0] / l, ny = v[1] / l, nz = v[2] / l, py = y + ny * r * 0.92;
      P.push(x + nx * r, py, z + nz * r); N.push(nx, ny, nz);
      const s = 0.62 + 0.42 * clamp((py - y0) / (y1 - y0), 0, 1); Cc.push(s, s, s * 0.96);
    }
    for (const f of Fc) I.push(base + f);
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setAttribute('color', new THREE.Float32BufferAttribute(Cc, 3));
  g.setIndex(I); g.computeBoundingSphere();
  return g;
}
// (para geometrías sin índice) más oscura abajo
function mergeShaded(list, y0, y1) {
  const g = mergeGeoms(list), p = g.attributes.position, c = g.attributes.color;
  for (let i = 0; i < p.count; i++) { const t = clamp((p.getY(i) - y0) / (y1 - y0), 0, 1), v = 0.62 + 0.42 * t; c.setXYZ(i, v, v, v * 0.96); }
  return g;
}
void canvasTex;

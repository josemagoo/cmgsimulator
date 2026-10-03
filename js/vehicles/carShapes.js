// Carrocerías de autos a partir de su silueta lateral real (extruida con bordes redondeados) más los detalles que
// hacen que se reconozcan: parabrisas y luneta inclinados, ventanillas, parrilla, faros, pilotos, defensas cromadas,
// molduras, manillas, espejos, chapa, pasos de rueda y ruedas (con banda blanca en los almendrones).
// Se usa para el auto del jugador y para el tráfico (mallas instanciadas).

// pts: silueta (z hacia delante negativo, y arriba), en orden alrededor del auto; ws / rw: índices de los bordes del parabrisas y la luneta
export const PROFILES = {
  // Chevrolet Bel Air 1955 / Ford de los 50 ("almendrón")
  almendron: { len: 4.95, w: 1.92, wr: 0.36, wz: [-1.55, 1.48], belt: 0.97,
    pts: [[-2.47, 0.36], [-2.5, 0.6], [-2.44, 0.84], [-1.9, 0.9], [-1.0, 0.93], [-0.66, 0.96], [-0.2, 1.43], [0.78, 1.45], [1.38, 0.99], [2.15, 0.94], [2.38, 1.03], [2.5, 1.0], [2.52, 0.62], [2.45, 0.36]],
    ws: [5, 6], rw: [7, 8], side: [[-0.55, 1.0], [-0.18, 1.37], [0.74, 1.39], [1.24, 1.0]], bpil: 0.3,
    round: true, fins: true, strip: true, whitewall: true, grille: 'chrome' },
  // Lada 2107 / 2105 (y los Moskvich de silueta parecida)
  lada: { len: 4.13, w: 1.62, wr: 0.31, wz: [-1.3, 1.24], belt: 0.88,
    pts: [[-2.06, 0.3], [-2.08, 0.72], [-1.98, 0.79], [-0.86, 0.84], [-0.74, 0.86], [-0.26, 1.38], [0.86, 1.4], [1.32, 0.92], [2.0, 0.9], [2.07, 0.74], [2.05, 0.3]],
    ws: [4, 5], rw: [6, 7], side: [[-0.64, 0.9], [-0.25, 1.33], [0.84, 1.35], [1.22, 0.92]], bpil: 0.28,
    round: false, fins: false, strip: false, whitewall: false, grille: 'lada' },
  // todoterreno tipo UAZ / Willys
  jeep: { len: 4.0, w: 1.82, wr: 0.45, wz: [-1.25, 1.25], belt: 1.15,
    pts: [[-1.98, 0.5], [-2.02, 1.02], [-1.3, 1.12], [-0.64, 1.15], [-0.56, 1.86], [1.95, 1.86], [2.0, 1.12], [2.0, 0.5]],
    ws: [3, 4], rw: null, side: [[-0.45, 1.2], [-0.45, 1.78], [1.85, 1.78], [1.85, 1.2]], bpil: 0.5,
    round: true, fins: false, strip: false, whitewall: false, grille: 'slots' },
  // deportivo bajo en cuña
  sport: { len: 4.45, w: 1.95, wr: 0.34, wz: [-1.4, 1.35], belt: 0.8,
    pts: [[-2.2, 0.26], [-2.26, 0.5], [-2.0, 0.66], [-0.95, 0.76], [-0.55, 0.8], [0.15, 1.16], [0.62, 1.18], [1.85, 0.86], [2.2, 0.8], [2.25, 0.55], [2.2, 0.28]],
    ws: [4, 5], rw: [6, 7], side: [[-0.45, 0.84], [0.13, 1.12], [0.6, 1.13], [1.55, 0.88]], bpil: 0,
    round: false, fins: false, strip: false, whitewall: false, grille: 'sport' },
};

const COL = { glass: 0x1b2833, chrome: 0xd6dade, black: 0x17181a, tyre: 0x141414, white: 0xf0f0ec, plate: 0xe6c440, grille: 0x232528, tail: 0x9a1414, lens: 0xf2efe0, arch: 0x101112 };
const cc = new THREE.Color();

// pone color por vértice y deja solo posición, normal y color (para juntar geometrías)
function paint(g, hex) {
  if (g.index) g = g.toNonIndexed();
  g.deleteAttribute('uv'); if (g.attributes.uv2) g.deleteAttribute('uv2');
  if (!g.attributes.normal) g.computeVertexNormals();
  cc.setHex(hex);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) { c[i * 3] = cc.r; c[i * 3 + 1] = cc.g; c[i * 3 + 2] = cc.b; }
  g.setAttribute('color', new THREE.BufferAttribute(c, 3));
  g.clearGroups();
  return g;
}
export function merge(list) {
  let n = 0; for (const g of list) n += g.attributes.position.count;
  const P = new Float32Array(n * 3), N = new Float32Array(n * 3), C = new Float32Array(n * 3); let o = 0;
  for (const g of list) { P.set(g.attributes.position.array, o * 3); N.set(g.attributes.normal.array, o * 3); C.set(g.attributes.color.array, o * 3); o += g.attributes.position.count; }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.BufferAttribute(P, 3)); out.setAttribute('normal', new THREE.BufferAttribute(N, 3)); out.setAttribute('color', new THREE.BufferAttribute(C, 3));
  out.computeBoundingSphere();
  return out;
}
const box = (w, h, d, x, y, z, hex) => { const g = new THREE.BoxGeometry(w, h, d); g.translate(x, y, z); return paint(g, hex); };
// disco o anillo plano en un lado (normal hacia +x o -x) o al frente/detrás (normal ±z)
function disc(r, x, y, z, axis, hex, inner = 0, seg = 14) {
  const g = inner ? new THREE.RingGeometry(inner, r, seg) : new THREE.CircleGeometry(r, seg);
  if (axis === 'x') g.rotateY(Math.PI / 2); else if (axis === '-x') g.rotateY(-Math.PI / 2); else if (axis === 'z') { /* mira a +z */ } else g.rotateY(Math.PI);
  g.translate(x, y, z); return paint(g, hex);
}
// cuadrilátero (4 puntos [x, y, z])
function quad(a, b, c, d, hex) {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([...a, ...b, ...c, ...a, ...c, ...d], 3));
  g.computeVertexNormals(); return paint(g, hex);
}

// carrocería: silueta extruida a lo ancho, con dos tonos (arriba de la cintura otro color) para el auto del jugador
function bodyGeo(P, two, base = 0xffffff) {
  const bev = 0.06, shape = new THREE.Shape(P.pts.map(([z, y]) => new THREE.Vector2(z, y)));
  let g = new THREE.ExtrudeGeometry(shape, { depth: P.w - bev * 2, bevelEnabled: true, bevelThickness: bev, bevelSize: 0.045, bevelSegments: 2, curveSegments: 1, steps: 1 });
  g.translate(0, 0, -(P.w - bev * 2) / 2); g.rotateY(-Math.PI / 2);
  g = paint(g, base);
  if (two !== undefined) {         // techo de otro color (los almendrones de dos tonos)
    const p = g.attributes.position, c = g.attributes.color, top = new THREE.Color(two);
    for (let i = 0; i < p.count; i++) if (p.getY(i) > P.belt + 0.04) c.setXYZ(i, top.r, top.g, top.b);
  }
  return g;
}

// detalles fijos (cristales, cromos, luces, ruedas…) con su color propio
function trimGeo(P, withWheels, simple = false) {
  const L = [], hw = P.w / 2, front = Math.min(...P.pts.map(p => p[0])), rear = Math.max(...P.pts.map(p => p[0]));
  // parabrisas y luneta: siguen la pendiente de la silueta, un poco por fuera
  const slope = (i, j, inset) => {
    const [za, ya] = P.pts[i], [zb, yb] = P.pts[j], dz = zb - za, dy = yb - ya, l = Math.hypot(dz, dy), nz = -dy / l * 0.012, ny = dz / l * 0.012;
    const k = 0.04, A = [za + dz * k + nz, ya + dy * k + ny], B = [zb - dz * k + nz, yb - dy * k + ny];
    L.push(quad([-hw + inset, A[1], A[0]], [hw - inset, A[1], A[0]], [hw - inset, B[1], B[0]], [-hw + inset, B[1], B[0]], COL.glass));
  };
  if (P.ws) slope(P.ws[0], P.ws[1], 0.12);
  if (P.rw) slope(P.rw[0], P.rw[1], 0.16);
  // ventanillas laterales (con el poste central)
  for (const s of [-1, 1]) {
    const x = s * (hw + 0.006);
    const sh = new THREE.Shape(P.side.map(([z, y]) => new THREE.Vector2(z, y)));
    const g = new THREE.ShapeGeometry(sh); g.rotateY(-Math.PI / 2); g.translate(x, 0, 0); L.push(paint(g, COL.glass));
    if (P.bpil) { const zm = (P.side[1][0] + P.side[2][0]) / 2; L.push(box(0.02, P.side[1][1] - P.side[0][1] + 0.05, 0.1, x, (P.side[0][1] + P.side[1][1]) / 2, zm + P.bpil * 0.3, 0x2a2c30)); }
    // pasos de rueda, molduras, manillas y líneas de las puertas
    for (const wz of P.wz) L.push(disc(P.wr + 0.08, x + s * 0.002, P.wr, wz, s > 0 ? 'x' : '-x', COL.arch, 0, 12));
    if (P.strip) L.push(box(0.02, 0.05, P.len * 0.7, x, P.belt - 0.16, 0.1, COL.chrome));
    if (simple) continue;
    L.push(box(0.02, 0.04, 0.16, x + s * 0.01, P.belt - 0.08, -0.25, COL.chrome)); L.push(box(0.02, 0.04, 0.16, x + s * 0.01, P.belt - 0.08, 0.72, COL.chrome));
    for (const dz of [-0.62, 0.55]) L.push(box(0.012, P.belt - 0.42, 0.018, x, (P.belt + 0.42) / 2, dz, 0x2e3034));
    L.push(box(0.12, 0.08, 0.16, x + s * 0.07, P.belt + 0.06, (P.pts[P.ws ? P.ws[0] : 0][0]) + 0.12, COL.black));   // espejo
  }
  // defensas, parrilla, faros, pilotos y chapas
  const fy = 0.42, by = P.belt;
  L.push(box(P.w + 0.06, 0.14, 0.16, 0, Math.max(0.3, P.pts[0][1] + 0.06), front - 0.04, COL.chrome));
  L.push(box(P.w + 0.06, 0.14, 0.16, 0, Math.max(0.3, P.pts[0][1] + 0.06), rear + 0.04, COL.chrome));
  const fz = front - 0.012, rz = rear + 0.012, gy0 = Math.max(0.42, P.pts[0][1] + 0.16), gy1 = Math.min(by - 0.08, gy0 + 0.3);
  if (simple) L.push(quad([-hw + 0.3, gy0, fz], [hw - 0.3, gy0, fz], [hw - 0.3, gy1, fz], [-hw + 0.3, gy1, fz], P.grille === 'chrome' ? 0x9a9ea2 : COL.grille));
  else if (P.grille === 'chrome') { L.push(quad([-hw + 0.3, gy0, fz], [hw - 0.3, gy0, fz], [hw - 0.3, gy1, fz], [-hw + 0.3, gy1, fz], COL.grille)); for (let i = 0; i < 4; i++) L.push(box(P.w - 0.62, 0.025, 0.03, 0, gy0 + 0.04 + i * (gy1 - gy0 - 0.06) / 3, fz - 0.01, COL.chrome)); }
  else if (P.grille === 'lada') { L.push(quad([-hw + 0.2, gy0, fz], [hw - 0.2, gy0, fz], [hw - 0.2, gy1, fz], [-hw + 0.2, gy1, fz], COL.grille)); for (let i = 0; i < 5; i++) L.push(box(0.025, gy1 - gy0, 0.03, -0.3 + i * 0.15, (gy0 + gy1) / 2, fz - 0.01, COL.chrome)); }
  else if (P.grille === 'slots') { for (let i = 0; i < 7; i++) L.push(box(0.06, 0.32, 0.03, -0.45 + i * 0.15, 0.82, fz - 0.005, COL.grille)); }
  else L.push(quad([-hw + 0.45, gy0 - 0.06, fz], [hw - 0.45, gy0 - 0.06, fz], [hw - 0.45, gy0 + 0.1, fz], [-hw + 0.45, gy0 + 0.1, fz], COL.grille));
  const hy = Math.min(by - 0.12, gy1 - 0.04);
  for (const s of [-1, 1]) {
    if (P.round) { L.push(disc(0.13, s * (hw - 0.22), hy, fz - 0.015, '-z', COL.lens)); L.push(disc(0.16, s * (hw - 0.22), hy, fz - 0.012, '-z', COL.chrome, 0.12)); }
    else L.push(box(0.36, 0.17, 0.03, s * (hw - 0.3), hy, fz - 0.01, COL.lens));
    if (P.fins) L.push(disc(0.08, s * (hw - 0.12), by + 0.02, rz + 0.015, 'z', COL.tail));
    else L.push(box(0.42, 0.16, 0.03, s * (hw - 0.3), by - 0.16, rz + 0.01, COL.tail));
  }
  L.push(box(0.36, 0.12, 0.02, 0, gy0 - 0.12, fz - 0.03, COL.plate)); L.push(box(0.36, 0.12, 0.02, 0, by - 0.25, rz + 0.02, COL.plate));
  // ruedas fijas (para el tráfico): neumático, banda blanca, tapacubos
  if (withWheels) for (const wz of P.wz) for (const s of [-1, 1]) L.push(...wheelParts(P, s * (hw - 0.1), wz, P.wr, simple));
  return merge(L);
}
export function wheelParts(P, x, z, y = P.wr, simple = false) {
  const L = [], s = Math.sign(x) || 1, seg = simple ? 8 : 14, t = new THREE.CylinderGeometry(P.wr, P.wr, 0.22, seg, 1, simple); t.rotateZ(Math.PI / 2); t.translate(x, y, z); L.push(paint(t, COL.tyre));
  if (P.whitewall) L.push(disc(P.wr * 0.84, x + s * 0.113, y, z, s > 0 ? 'x' : '-x', COL.white, simple ? 0 : P.wr * 0.56, seg));
  L.push(disc(P.wr * 0.56, x + s * 0.116, y, z, s > 0 ? 'x' : '-x', COL.chrome, 0, seg));
  if (!simple) L.push(disc(P.wr * 0.2, x + s * 0.118, y, z, s > 0 ? 'x' : '-x', 0x8a8e92));
  return L;
}
// luces encendidas (de noche): faros blancos y pilotos rojos, en el mismo sitio que en la carrocería
export function lightsGeo(P) {
  const hw = P.w / 2, front = Math.min(...P.pts.map(p => p[0])), rear = Math.max(...P.pts.map(p => p[0])), by = P.belt, gy0 = Math.max(0.42, P.pts[0][1] + 0.16), hy = Math.min(by - 0.12, gy0 + 0.26), L = [];
  for (const s of [-1, 1]) {
    L.push(box(0.3, 0.16, 0.04, s * (hw - 0.24), hy, front - 0.04, 0xfff2c0));
    L.push(box(0.36, 0.14, 0.04, s * (hw - 0.3), P.fins ? by + 0.02 : by - 0.16, rear + 0.04, 0xe01010));
  }
  return merge(L);
}

const cache = {};
// geometrías para el tráfico: carrocería (se tiñe por auto) y detalles fijos con ruedas
export function trafficCar(type) {
  if (cache[type]) return cache[type];
  const P = PROFILES[type];
  return (cache[type] = { body: bodyGeo(P), trim: trimGeo(P, true, true), lights: lightsGeo(P), P });
}
// piezas para el auto del jugador (las ruedas van aparte porque giran)
export function playerCar(type, roof, base) { const P = PROFILES[type]; return { body: bodyGeo(P, roof, base), trim: trimGeo(P, false), P }; }

// Monumentos, locomotoras, tanques de agua elevados y torres de Camagüey, sobre el acumulador de mallas (mesher.js).
// Todo va en la cubeta 'solid' (luces encendidas en 'glow'). Medidas en metros; y = suelo.
const C = c => new THREE.Color(c);
const MARBLE = C(0xeeeae0), STONE = C(0xd6d1c4), BRONZE = C(0x4f6b5a), DBRONZE = C(0x5e4a35), IRON = C(0x2d3a34), WHITE = C(0xeae7df);

// marco de algo que mira hacia ang (radianes, 0 = norte): at(a, b) con a = a su derecha y b = hacia delante
export function faceFrame(x, z, ang) {
  const fx = Math.sin(ang), fz = -Math.cos(ang), rx = -fz, rz = fx;
  return { x, z, fx, fz, rx, rz, at(a, b) { return [x + rx * a + fx * b, z + rz * a + fz * b]; }, p(a, y, b) { return [x + rx * a + fx * b, y, z + rz * a + fz * b]; } };
}

// base ortonormal perpendicular a u (s: vector "de lado" preferido)
function basis(ux, uy, uz, side) {
  let sx, sy, sz;
  if (side) [sx, sy, sz] = side; else if (Math.abs(uy) < 0.95) { sx = -uz; sy = 0; sz = ux; } else { sx = 1; sy = 0; sz = 0; }
  const d = sx * ux + sy * uy + sz * uz; sx -= d * ux; sy -= d * uy; sz -= d * uz;
  const l = Math.hypot(sx, sy, sz) || 1; sx /= l; sy /= l; sz /= l;
  return [sx, sy, sz, uy * sz - uz * sy, uz * sx - ux * sz, ux * sy - uy * sx];
}
// viga de sección rectangular entre dos puntos cualesquiera: hw = media anchura (perpendicular a "side"), hd = medio fondo (a lo largo de "side")
export function beam(M, a, b, hw, hd, col, side = null, caps = false, k = 'solid') {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz) || 1;
  const [sx, sy, sz, qx, qy, qz] = basis(dx / l, dy / l, dz / l, side);
  const o = [[1, 1], [-1, 1], [-1, -1], [1, -1]].map(([s, t]) => [sx * s * hd + qx * t * hw, sy * s * hd + qy * t * hw, sz * s * hd + qz * t * hw]);
  const A = i => [a[0] + o[i][0], a[1] + o[i][1], a[2] + o[i][2]], B = i => [b[0] + o[i][0], b[1] + o[i][1], b[2] + o[i][2]];
  for (let i = 0; i < 4; i++) { const j = (i + 1) % 4; M.quad(k, A(i), A(j), B(j), B(i), col); }
  if (caps) { M.quad(k, A(0), A(1), A(2), A(3), col); M.quad(k, B(3), B(2), B(1), B(0), col); }
}
// cilindro (o cono truncado) entre dos puntos cualesquiera: calderas, ruedas, chimeneas acostadas
export function tube(M, a, b, r0, r1, col, n = 8, caps = true, k = 'solid') {
  const dx = b[0] - a[0], dy = b[1] - a[1], dz = b[2] - a[2], l = Math.hypot(dx, dy, dz) || 1;
  const [sx, sy, sz, qx, qy, qz] = basis(dx / l, dy / l, dz / l, null);
  const ring = (c, r, i) => { const t = i / n * 6.2832, cs = Math.cos(t) * r, sn = Math.sin(t) * r; return [c[0] + sx * cs + qx * sn, c[1] + sy * cs + qy * sn, c[2] + sz * cs + qz * sn]; };
  for (let i = 0; i < n; i++) {
    M.quad(k, ring(a, r0, i), ring(a, r0, i + 1), ring(b, r1, i + 1), ring(b, r1, i), col, 0.84 + 0.16 * Math.abs(Math.cos((i + 0.5) / n * 6.2832 - 0.8)));
    if (caps) { M.tri(k, a, ring(a, r0, i + 1), ring(a, r0, i), col); M.tri(k, b, ring(b, r1, i), ring(b, r1, i + 1), col); }
  }
}
// caja en el marco F dada por sus límites (a0..a1 a lo ancho, b0..b1 en fondo)
const box = (M, F, a0, a1, b0, b1, y0, y1, col, o) => M.obox(F, (a0 + a1) / 2, (b0 + b1) / 2, (a1 - a0) / 2, (b1 - b0) / 2, y0, y1, col, 'solid', o);

// figura humana de pie, de altura s, en (a, b) del marco F
export function figure(M, F, a, b, y, s, col, stride = 0.09) {
  const k = s / 1.8, G = { at: (u, v) => F.at(a + u, b + v) };
  M.obox(G, -0.1 * k, -stride * k, 0.075 * k, 0.09 * k, y, y + 0.86 * k, col, 'solid');            // piernas (una adelantada)
  M.obox(G, 0.1 * k, stride * k, 0.075 * k, 0.09 * k, y, y + 0.86 * k, col, 'solid');
  M.obox(G, 0, 0, 0.2 * k, 0.12 * k, y + 0.82 * k, y + 1.47 * k, col, 'solid');                       // torso
  M.obox(G, -0.27 * k, 0, 0.055 * k, 0.065 * k, y + 0.8 * k, y + 1.44 * k, col, 'solid');            // brazos
  M.obox(G, 0.27 * k, 0.05 * k, 0.055 * k, 0.065 * k, y + 0.8 * k, y + 1.44 * k, col, 'solid');
  const c = G.at(0, 0.01 * k);
  M.cyl(c[0], c[1], 0.05 * k, 0.05 * k, y + 1.47 * k, y + 1.53 * k, col, 6, false);
  M.cyl(c[0], c[1], 0.095 * k, 0.1 * k, y + 1.53 * k, y + 1.68 * k, col, 6, false); M.dome(c[0], c[1], y + 1.68 * k, 0.1 * k, col, 6, 1.1);
}

// busto de bronce sobre pedestal de mármol
export function addBust(M, x, z, y, ang = 0) {
  const F = faceFrame(x, z, ang);
  M.obox(F, 0, 0, 0.5, 0.5, y - 0.3, y + 0.25, MARBLE, 'solid');
  M.obox(F, 0, 0, 0.32, 0.32, y + 0.25, y + 1.55, MARBLE, 'solid');
  M.obox(F, 0, 0, 0.38, 0.38, y + 1.55, y + 1.66, MARBLE, 'solid');
  M.obox(F, 0, 0, 0.3, 0.16, y + 1.66, y + 1.98, BRONZE, 'solid');                                    // hombros y pecho
  M.cyl(x, z, 0.07, 0.07, y + 1.98, y + 2.05, BRONZE, 6, false);
  M.cyl(x, z, 0.12, 0.13, y + 2.05, y + 2.25, BRONZE, 6, false); M.dome(x, z, y + 2.25, 0.13, BRONZE, 6, 0.95);
  const t = F.at(0, 0.33); M.obox({ at: (u, v) => [t[0] + F.rx * u + F.fx * v, t[1] + F.rz * u + F.fz * v] }, 0, 0, 0.18, 0.012, y + 0.8, y + 1.15, BRONZE, 'solid');   // tarja
}
// estatua de bronce de pie sobre pedestal (big: monumento grande con escalinata)
export function addStatueFig(M, x, z, y, ang = 0, big = false) {
  const F = faceFrame(x, z, ang), w = big ? 1.6 : 0.85, h = big ? 4.2 : 2.3;
  if (big) M.obox(F, 0, 0, w + 1.6, w + 1.6, y - 0.3, y + 0.35, MARBLE, 'solid');
  M.obox(F, 0, 0, w + 0.5, w + 0.5, y - 0.3, y + (big ? 0.7 : 0.3), MARBLE, 'solid');
  M.obox(F, 0, 0, w, w, y + 0.3, y + h, MARBLE, 'solid');
  M.obox(F, 0, 0, w + 0.14, w + 0.14, y + h, y + h + 0.16, MARBLE, 'solid');
  figure(M, F, 0, 0, y + h + 0.16, big ? 3.3 : 2.3, BRONZE);
}
// figura de bronce de tamaño natural, a ras de suelo
export function addFigure(M, x, z, y, ang = 0) {
  const F = faceFrame(x, z, ang);
  M.obox(F, 0, 0, 0.5, 0.5, y - 0.2, y + 0.12, STONE, 'solid');
  figure(M, F, 0, 0, y + 0.12, 1.85, DBRONZE, 0.05);
}
// obelisco: gradas, dado con tarja, fuste que se estrecha y piramidión
export function addObelisk(M, x, z, y, h = 9, ang = 0, col = MARBLE) {
  const F = faceFrame(x, z, ang), b = Math.max(0.55, h * 0.07), t = b * 0.6;
  M.obox(F, 0, 0, b * 2.8, b * 2.8, y - 0.3, y + 0.3, col, 'solid');
  M.obox(F, 0, 0, b * 2.1, b * 2.1, y + 0.3, y + 0.6, col, 'solid');
  M.obox(F, 0, 0, b * 1.5, b * 1.5, y + 0.6, y + 1.9, col, 'solid');
  M.obox(F, 0, 0, b * 1.6, b * 1.6, y + 1.9, y + 2.05, col, 'solid');
  const y0 = y + 2.05, y1 = y + h - b * 1.1;
  const P0 = [F.at(-b, -b), F.at(b, -b), F.at(b, b), F.at(-b, b)], P1 = [F.at(-t, -t), F.at(t, -t), F.at(t, t), F.at(-t, t)], c = F.at(0, 0);
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    M.quad('solid', [P0[i][0], y0, P0[i][1]], [P0[j][0], y0, P0[j][1]], [P1[j][0], y1, P1[j][1]], [P1[i][0], y1, P1[i][1]], col, 0.9 + 0.1 * (i % 2));
    M.tri('solid', [P1[i][0], y1, P1[i][1]], [P1[j][0], y1, P1[j][1]], [c[0], y + h, c[1]], col, 0.92 + 0.08 * (i % 2));
  }
  const p = F.at(0, b * 1.5 + 0.01);
  M.obox({ at: (u, v) => [p[0] + F.rx * u + F.fx * v, p[1] + F.rz * u + F.fz * v] }, 0, 0, b * 0.8, 0.01, y + 0.85, y + 1.6, BRONZE, 'solid');
}
// Barberán y Collar: obelisco con los bustos de los dos aviadores delante
export function addBarberan(M, x, z, y, ang = 0) {
  addObelisk(M, x, z, y, 11, ang);
  const F = faceFrame(x, z, ang);
  for (const s of [-1, 1]) { const p = F.at(s * 2.0, 2.6); addBust(M, p[0], p[1], y, ang); }
}
// monumento sencillo: estela de piedra con tarja de bronce
export function addStele(M, x, z, y, ang = 0) {
  const F = faceFrame(x, z, ang);
  M.obox(F, 0, 0, 1.5, 1.1, y - 0.3, y + 0.25, MARBLE, 'solid');
  M.obox(F, 0, 0, 0.85, 0.32, y + 0.25, y + 2.5, STONE, 'solid');
  const p = F.at(0, 0.33); M.obox({ at: (u, v) => [p[0] + F.rx * u + F.fx * v, p[1] + F.rz * u + F.fz * v] }, 0, 0, 0.45, 0.012, y + 1.2, y + 1.85, BRONZE, 'solid');
}
// escultura de piedra (bloques tallados)
export function addStoneSculpt(M, x, z, y, ang = 0) {
  const F = faceFrame(x, z, ang), S1 = C(0xcfc8b8), S2 = C(0xc2bba9);
  M.obox(F, 0, 0, 1.0, 0.7, y - 0.3, y + 0.4, MARBLE, 'solid');
  M.obox(F, -0.25, 0, 0.42, 0.34, y + 0.4, y + 2.3, S1, 'solid');
  M.obox(F, 0.38, 0.05, 0.32, 0.3, y + 0.4, y + 1.6, S2, 'solid');
  beam(M, F.p(-0.2, y + 2.3, 0), F.p(0.5, y + 2.9, 0.1), 0.18, 0.28, S1, null, true);                 // ala de la paloma
}
// ceiba monumental: tronco gris con raíces tabulares y copa ancha en parasol
export function addCeiba(M, x, z, y) {
  const bark = C(0x9d998a), g1 = C(0x3d6a2c), g2 = C(0x4b7834), g3 = C(0x355f27);
  for (let i = 0; i < 6; i++) {
    const a = i / 6 * 6.2832 + 0.4, cx = Math.cos(a), sz = Math.sin(a);
    M.quad('solid', [x + cx * 0.4, y + 2.6, z + sz * 0.4], [x, y - 0.4, z], [x + cx * 2.9, y - 0.4, z + sz * 2.9], [x + cx * 1.1, y + 0.9, z + sz * 1.1], bark);
  }
  M.cyl(x, z, 1.25, 0.9, y - 0.4, y + 9, bark, 9, false);
  M.cyl(x, z, 0.9, 0.62, y + 9, y + 15, bark, 9, false);
  for (let i = 0; i < 6; i++) { const a = i / 6 * 6.2832 + 1.0; beam(M, [x, y + 12.5 + (i % 2), z], [x + Math.cos(a) * 9.5, y + 16.2, z + Math.sin(a) * 9.5], 0.3, 0.3, bark); }
  M.cyl(x, z, 2.5, 10.5, y + 14.2, y + 15.4, g3, 11, false);
  M.cyl(x, z, 10.5, 14, y + 15.4, y + 17.6, g1, 11, false);
  M.cyl(x, z, 14, 11.5, y + 17.6, y + 19.6, g2, 11, false);
  M.cyl(x, z, 11.5, 4.5, y + 19.6, y + 21.6, g1, 11, true);
}

// locomotora de vapor de central azucarero (con ténder) sobre un tramo de vía; ang = hacia dónde mira el frente
export function addLocomotive(M, x, z, y, ang, seed = 0) {
  const F = faceFrame(x, z, ang), P = F.p.bind(F);
  const BLK = C(0x1e2023), BODY = seed % 3 === 1 ? C(0x24412f) : BLK, RED = C(0x8a2a22), BRASS = C(0xb3913f), SM = C(0x2b2b2b);
  for (let b = -8.6; b <= 5.4; b += 0.8) box(M, F, -1.3, 1.3, b - 0.13, b + 0.13, y - 0.25, y + 0.08, C(0x5c4b3b));     // traviesas
  for (const s of [-0.72, 0.72]) beam(M, P(s, y + 0.15, -9), P(s, y + 0.15, 5.8), 0.05, 0.04, C(0x55524c));            // raíles
  box(M, F, -1.12, 1.12, -4.3, 4.1, y + 0.72, y + 1.12, RED);                                                           // bastidor
  for (const b of [-2.3, -1.0, 0.3]) for (const s of [-1, 1]) tube(M, P(s * 0.86, y + 0.66, b), P(s * 1.02, y + 0.66, b), 0.6, 0.6, RED, 10, true);   // ruedas motrices
  for (const b of [2.5, 3.3]) for (const s of [-1, 1]) tube(M, P(s * 0.86, y + 0.42, b), P(s * 1.0, y + 0.42, b), 0.36, 0.36, RED, 8, true);       // ruedas de guía
  for (const s of [-1, 1]) beam(M, P(s * 1.06, y + 0.66, -2.35), P(s * 1.06, y + 0.66, 0.35), 0.05, 0.03, C(0x8c8c88));                            // biela
  for (const s of [-1, 1]) tube(M, P(s * 1.08, y + 1.06, 2.4), P(s * 1.08, y + 1.06, 3.5), 0.3, 0.3, BLK, 8, true);                                // cilindros
  tube(M, P(0, y + 1.88, -1.9), P(0, y + 1.88, 3.55), 0.78, 0.78, BODY, 12, true);                                       // caldera
  tube(M, P(0, y + 1.88, 3.55), P(0, y + 1.88, 4.3), 0.84, 0.84, SM, 12, true);                                          // caja de humos
  for (const b of [-0.7, 0.9, 2.5]) tube(M, P(0, y + 1.88, b), P(0, y + 1.88, b + 0.09), 0.8, 0.8, BRASS, 12, false);    // aros de latón
  const ch = F.at(0, 3.95); M.cyl(ch[0], ch[1], 0.21, 0.24, y + 2.55, y + 3.3, SM, 8, false); M.cyl(ch[0], ch[1], 0.24, 0.52, y + 3.3, y + 3.85, SM, 8, false); M.cyl(ch[0], ch[1], 0.52, 0.32, y + 3.85, y + 4.1, SM, 8, true);   // chimenea de bulbo
  const dm = F.at(0, 1.5); M.cyl(dm[0], dm[1], 0.32, 0.3, y + 2.55, y + 2.95, BRASS, 8, false); M.dome(dm[0], dm[1], y + 2.95, 0.3, BRASS, 8, 0.6);
  const sd = F.at(0, 0.1); M.cyl(sd[0], sd[1], 0.27, 0.26, y + 2.55, y + 2.85, BODY, 8, false); M.dome(sd[0], sd[1], y + 2.85, 0.26, BODY, 8, 0.6);
  box(M, F, -0.2, 0.2, 4.05, 4.45, y + 2.72, y + 3.08, BLK); box(M, F, -0.14, 0.14, 4.46, 4.47, y + 2.78, y + 3.02, C(0xf3e6a8));   // farol
  M.quad('solid', P(-1.05, y + 0.2, 5.0), P(1.05, y + 0.2, 5.0), P(1.05, y + 1.1, 4.3), P(-1.05, y + 1.1, 4.3), RED);                // limpiavías
  box(M, F, -1.25, 1.25, -4.3, -1.85, y + 1.12, y + 3.5, BODY);                                                                       // cabina
  box(M, F, -1.42, 1.42, -4.55, -1.6, y + 3.5, y + 3.72, BLK);
  for (const s of [-1, 1]) for (const b of [-3.6, -2.6]) M.quad('solid', P(s * 1.26, y + 2.3, b - 0.35), P(s * 1.26, y + 2.3, b + 0.35), P(s * 1.26, y + 3.1, b + 0.35), P(s * 1.26, y + 3.1, b - 0.35), C(0x15171a));
  box(M, F, -1.2, 1.2, -9.0, -4.6, y + 0.75, y + 2.7, BODY);                                                                          // ténder
  box(M, F, -1.0, 1.0, -8.7, -5.4, y + 2.7, y + 3.0, C(0x3b2f23));                                                                    // leña
  for (const b of [-8.3, -7.4, -6.2, -5.3]) for (const s of [-1, 1]) tube(M, P(s * 0.86, y + 0.42, b), P(s * 1.0, y + 0.42, b), 0.4, 0.4, BLK, 8, true);
}

// tanque de agua elevado de hormigón (fuste cilíndrico y depósito arriba)
export function addWaterTower(M, x, z, y, h = 24) {
  const con = C(0xc9c4b7), dk = C(0xa8a397), st = C(0x9a958a);
  M.cyl(x, z, 2.3, 2.3, y - 0.5, y + 0.6, dk, 10, true);
  M.cyl(x, z, 1.55, 1.38, y + 0.6, y + h - 8.4, con, 10, false);
  M.cyl(x, z, 1.38, 5.1, y + h - 8.4, y + h - 6.3, dk, 12, false);
  M.cyl(x, z, 5.1, 5.1, y + h - 6.3, y + h - 4.6, st, 12, false);           // franja con manchas de humedad
  M.cyl(x, z, 5.1, 5.1, y + h - 4.6, y + h - 1.0, con, 12, false);
  M.cyl(x, z, 5.4, 5.4, y + h - 1.0, y + h - 0.6, dk, 12, true);             // cornisa
  M.cyl(x, z, 4.9, 0.7, y + h - 0.6, y + h + 0.5, dk, 12, true);             // techo cónico
  beam(M, [x + 1.62, y + 0.6, z], [x + 1.45, y + h - 8.4, z], 0.05, 0.25, IRON);   // escalera
}
// torre de luz del estadio: poste de acero y marco de reflectores mirando al terreno (tx, tz)
export function addLightTower(M, x, z, y, h, tx, tz) {
  const steel = C(0x8d9296), d = Math.hypot(tx - x, tz - z) || 1, fx = (tx - x) / d, fz = (tz - z) / d, px = -fz, pz = fx;
  M.cyl(x, z, 0.8, 0.8, y - 0.4, y + 0.4, C(0x9a978f), 8, true);
  M.cyl(x, z, 0.46, 0.24, y + 0.4, y + h, steel, 8, false);
  const P = (s, yy, o) => [x + px * s + fx * o, yy, z + pz * s + fz * o], W = 3.4, H0 = y + h - 0.4, H1 = y + h + 3.2, o0 = 0.5, o1 = -0.7;
  M.quad('solid', P(-W, H0, o0), P(W, H0, o0), P(W, H1, o1), P(-W, H1, o1), steel);
  beam(M, [x, H0 - 0.3, z], P(0, H0 - 0.3, o0 + 0.6), 0.1, 0.8, steel, null, true);
  const lamp = C(0xfff4d2);
  for (let i = 0; i < 4; i++) for (let j = 0; j < 3; j++) {
    const s0 = -W + 0.35 + i * (2 * W - 0.7) / 4, s1 = s0 + (2 * W - 0.7) / 4 - 0.28, t0 = 0.06 + j / 3, t1 = t0 + 1 / 3 - 0.12;
    const ya = H0 + (H1 - H0) * t0, yb = H0 + (H1 - H0) * t1, oa = o0 + (o1 - o0) * t0 + 0.08, ob = o0 + (o1 - o0) * t1 + 0.08;
    M.quad('glow', P(s1, ya, oa), P(s0, ya, oa), P(s0, yb, ob), P(s1, yb, ob), lamp);                // vista desde el terreno
  }
}
// torre de celosía de comunicaciones (rojo y blanco arriba), con antenas y luz de balizamiento
export function addCommTower(M, x, z, y, h) {
  const steel = C(0x9aa0a4), red = C(0xc0392b), wht = C(0xe8e8e2);
  const b0 = Math.max(1.4, h * 0.06), b1 = 0.42, lv = Math.max(6, Math.round(h / 4));
  const cn = (s, t, hh) => { const w = b0 + (b1 - b0) * hh / h; return [x + s * w, y + hh, z + t * w]; }, C4 = [[-1, -1], [1, -1], [1, 1], [-1, 1]];
  for (let i = 0; i < lv; i++) {
    const h0 = h * i / lv, h1 = h * (i + 1) / lv, col = i >= lv - Math.max(3, lv >> 2) ? (i % 2 ? red : wht) : steel;
    for (let k = 0; k < 4; k++) {
      const [s0, t0] = C4[k], [s1, t1] = C4[(k + 1) % 4];
      beam(M, cn(s0, t0, h0 - (i ? 0 : 0.5)), cn(s0, t0, h1), 0.08, 0.08, col);
      beam(M, cn(s0, t0, h1), cn(s1, t1, h1), 0.035, 0.035, col);
      beam(M, cn(s0, t0, h0), cn(s1, t1, h1), 0.03, 0.03, col);
      beam(M, cn(s1, t1, h0), cn(s0, t0, h1), 0.03, 0.03, col);
    }
  }
  for (let k = 0; k < 3; k++) {                                   // paneles de telefonía
    const a = k * 2.094 + 0.5, r = b1 + 0.35, px = x + Math.cos(a) * r, pz = z + Math.sin(a) * r;
    M.obox({ at: (u, v) => [px + Math.cos(a) * v - Math.sin(a) * u, pz + Math.sin(a) * v + Math.cos(a) * u] }, 0, 0, 0.18, 0.08, y + h - 3.6, y + h - 1.4, wht, 'solid');
  }
  M.cyl(x, z, 0.06, 0.03, y + h, y + h + 4, steel, 4, true);
  M.cyl(x, z, 0.14, 0.14, y + h + 4, y + h + 4.3, C(0xff3a2a), 6, true, 'glow');
}

// Plaza de la Revolución: tribuna con relieves y escalinatas, Agramonte de bronce ante el grupo escultórico blanco
// (caballos y mambises), gran marco en punta con la estrella, vigas laterales y el muro inclinado "Con la vergüenza"
export function buildPlazaRev(M, x, z, y, ang = 0) {
  const F = faceFrame(x, z, ang), P = F.p.bind(F), fw = [F.fx, 0, F.fz];
  const W = WHITE, G = C(0xd3cec1), R = C(0xb9b3a4), RD = C(0xa69f8e), D = C(0x2c2a27), H = 2.8;
  const bx = (a0, a1, b0, b1, y0, y1, col) => box(M, F, a0, a1, b0, b1, y + y0, y + y1, col);
  bx(-16, 14, -8, 6, -0.6, H, G);                                              // tribuna
  bx(-16.3, 14.3, -8.3, 6.3, H - 0.05, H + 0.35, W);                           // pretil
  for (const [a0, a1] of [[-13.5, -2.2], [2.2, 9.5]]) {                        // friso de relieves (historia de Camagüey)
    bx(a0, a1, 6.0, 6.32, 0.45, H - 0.3, R);
    for (let a = a0 + 0.5; a < a1 - 1; a += 1.7) bx(a, a + 1.0, 6.3, 6.55, 0.7 + ((a * 7) % 3) * 0.12, 1.9 + ((a * 3) % 2) * 0.35, RD);
  }
  M.quad('solid', P(-1.6, y, 6.36), P(1.6, y, 6.36), P(1.6, y + 2.3, 6.36), P(-1.6, y + 2.3, 6.36), D);    // entrada del salón Jimaguayú
  const stairs = (aEdge, dir) => { for (let j = 0; j < 9; j++) { const a0 = aEdge + dir * j * 0.75, a1 = a0 + dir * 0.75; bx(Math.min(a0, a1), Math.max(a0, a1), -6.5, 5.5, -0.4, H * (9 - j) / 9, W); } };
  stairs(14, 1); stairs(-16, -1);
  { const a0 = -15, a1 = 5, b0 = 7.4, b1 = 8.2, h0 = 0.3, h1 = H + 0.25, T = C(0xf2f0ea);   // muro inclinado "Con la vergüenza"
    M.quad('solid', P(a0, y - 0.3, b1), P(a1, y - 0.3, b1), P(a1, y + h1, b1), P(a0, y + h0, b1), T);
    M.quad('solid', P(a0, y - 0.3, b0), P(a1, y - 0.3, b0), P(a1, y + h1, b0), P(a0, y + h0, b0), W);
    M.quad('solid', P(a0, y + h0, b0), P(a1, y + h1, b0), P(a1, y + h1, b1), P(a0, y + h0, b1), W);
    M.quad('solid', P(a1, y - 0.3, b0), P(a1, y - 0.3, b1), P(a1, y + h1, b1), P(a1, y + h1, b0), W);
    for (let i = 0; i < 14; i++) { const a = -9.6 + i * 0.68, hh = h0 + (h1 - h0) * (a - a0) / (a1 - a0); bx(a, a + 0.42, 8.2, 8.23, hh * 0.38, hh * 0.38 + 0.42, D); }    // letras
  }
  // Agramonte de bronce (paso al frente, mirada al norte) sobre su plinto
  bx(-2.1, 2.1, 2.4, 5.4, H, H + 1.1, W);
  figure(M, F, 0, 3.9, y + H + 1.1, 4.6, DBRONZE, 0.12);
  // grupo escultórico blanco, tallado en facetas
  // (visto desde la plaza: los caballos a la izquierda, al este; los mambises a la derecha)
  bx(2.6, 7.8, -0.2, 2.4, H, H + 3.2, W);                                      // cuerpo del caballo
  beam(M, P(6.6, y + H + 2.9, 1.2), P(9.6, y + H + 5.5, 1.7), 0.75, 0.55, W, null, true);       // cuello
  beam(M, P(9.6, y + H + 5.5, 1.7), P(11.4, y + H + 4.8, 1.9), 0.45, 0.42, W, null, true);      // cabeza
  beam(M, P(6.0, y + H + 2.4, 2.2), P(8.4, y + H + 3.9, 2.6), 0.5, 0.4, G, null, true);         // segundo caballo
  bx(-7.0, 2.6, -1.0, 0.9, H, H + 3.4, G);                                     // bloques facetados detrás
  bx(-6.2, -3.4, -0.4, 1.2, H + 3.4, H + 4.4, W);
  bx(2.4, 4.6, -0.6, 1.4, H + 3.2, H + 5.0, W);
  figure(M, F, -3.0, 1.6, y + H + 0.6, 4.3, W, 0.05);                          // mambises
  figure(M, F, -5.3, 1.0, y + H + 1.1, 4.1, W, 0.05);
  figure(M, F, 1.9, 1.5, y + H + 1.4, 4.0, W, 0.05);
  // gran marco de hormigón en punta, con la estrella
  // los brazos se abren hacia el centro y se cierran en punta: la abertura queda ojival, como una llama
  const top = H + 21.5;
  beam(M, P(3.6, y + H, -1.6), P(4.9, y + H + 9.5, -1.6), 1.1, 0.9, W, fw, true);
  beam(M, P(4.9, y + H + 9.5, -1.6), P(0.9, y + top, -1.6), 1.1, 0.9, W, fw, true);
  beam(M, P(-3.8, y + H, -1.6), P(-5.4, y + H + 12, -1.6), 1.1, 0.9, W, fw, true);
  beam(M, P(-5.4, y + H + 12, -1.6), P(-0.9, y + top, -1.6), 1.1, 0.9, W, fw, true);
  beam(M, P(-1.6, y + top - 0.2, -1.6), P(1.6, y + top - 0.2, -1.6), 1.0, 0.9, W, fw, true);
  beam(M, P(0, y + top - 0.4, -1.6), P(0.25, y + top + 2.4, -1.6), 0.7, 0.9, W, fw, true);
  { const c = P(0, y + top + 0.6, -0.55), r = 1.15, rx = F.rx, rz = F.rz, S = C(0xf7f5ee);        // estrella en la punta
    for (let i = 0; i < 10; i++) {
      const t0 = Math.PI / 2 + i * Math.PI / 5, t1 = t0 + Math.PI / 5, r0 = i % 2 ? r * 0.42 : r, r1 = i % 2 ? r : r * 0.42;
      M.tri('solid', c, [c[0] + rx * Math.cos(t0) * r0, c[1] + Math.sin(t0) * r0, c[2] + rz * Math.cos(t0) * r0], [c[0] + rx * Math.cos(t1) * r1, c[1] + Math.sin(t1) * r1, c[2] + rz * Math.cos(t1) * r1], S);
    }
  }
  // vigas laterales sobre pilares; al oeste la atraviesan dos losas inclinadas
  beam(M, P(-31, y + 5.2, -0.6), P(-16, y + 5.2, -0.6), 0.72, 0.62, W, null, true);
  for (const a of [-29.5, -24.5, -19.5]) bx(a - 0.35, a + 0.35, -0.95, -0.25, -0.3, 4.5, G);
  for (const a of [-27.5, -23.5]) beam(M, P(a, y - 0.3, -0.6), P(a - 3.6, y + 9.6, -0.6), 0.34, 1.35, W, fw, true);
  beam(M, P(14, y + 4.8, -0.6), P(28, y + 4.8, -0.6), 0.7, 0.6, W, null, true);
  for (const a of [18.5, 23.5, 27.5]) bx(a - 0.35, a + 0.35, -0.95, -0.25, -0.3, 4.1, G);
  beam(M, P(24, y - 0.3, -0.6), P(27.5, y + 7.8, -0.6), 0.32, 1.2, W, fw, true);
}

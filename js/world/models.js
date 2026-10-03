// Iglesias coloniales, torres, cúpulas y mobiliario urbano de Camagüey, sobre el acumulador de mallas (mesher.js).
import { MOD } from './facades.js';
const C = c => new THREE.Color(c);

// marco de referencia de un edificio: centro, eje largo (a) y corto (b)
export function frameOf(pts) {
  let best = null;
  for (let i = 0; i < pts.length; i++) {          // el eje de cada lado como candidato; gana el rectángulo mínimo
    const p = pts[i], q = pts[(i + 1) % pts.length], l = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (l < 1) continue;
    const ax = (q[0] - p[0]) / l, az = (q[1] - p[1]) / l;
    let u0 = 1e9, u1 = -1e9, v0 = 1e9, v1 = -1e9;
    for (const r of pts) { const u = r[0] * ax + r[1] * az, v = -r[0] * az + r[1] * ax; u0 = Math.min(u0, u); u1 = Math.max(u1, u); v0 = Math.min(v0, v); v1 = Math.max(v1, v); }
    const ar = (u1 - u0) * (v1 - v0);
    if (!best || ar < best.ar) best = { ar, ax, az, u0, u1, v0, v1 };
  }
  if (!best) return null;
  let { ax, az, u0, u1, v0, v1 } = best;
  if (u1 - u0 < v1 - v0) { [ax, az, u0, u1, v0, v1] = [-az, ax, v0, v1, -u1, -u0]; }     // que a sea siempre el eje largo
  const ua = (u0 + u1) / 2, vb = (v0 + v1) / 2, bx = -az, bz = ax;
  return { cx: ua * ax + vb * bx, cz: ua * az + vb * bz, ax, az, bx, bz, hu: (u1 - u0) / 2, hv: (v1 - v0) / 2, ar: best.ar, at(a, b) { return [this.cx + this.ax * a + this.bx * b, this.cz + this.az * a + this.bz * b]; } };
}
export function frameFromSpec(x, z, angDeg, L, W) {
  const r = angDeg * Math.PI / 180, ax = Math.cos(r), az = Math.sin(r);
  let F = { cx: x, cz: z, ax, az, bx: -az, bz: ax, hu: L / 2, hv: W / 2 };
  if (F.hv > F.hu) F = { cx: x, cz: z, ax: -az, az: ax, bx: -ax, bz: -az, hu: W / 2, hv: L / 2 };
  F.at = function (a, b) { return [this.cx + this.ax * a + this.bx * b, this.cz + this.az * a + this.bz * b]; };
  return F;
}

const DOOR = C(0x4a3426), DOOR2 = C(0x5a4030), GLASS = C(0x30363f), DARK = C(0x2b2c30), STONE = C(0xa9a59b);

// Torre-campanario: cuerpos que se estrechan, cornisas, vanos de campanas en arco, pináculos y remate
// (cúpula con linterna, aguja octogonal, pirámide de teja o la estatua de Cristo Rey de la Catedral)
function buildTower(M, F, a, b, T, y0, sp) {
  const wall = C(T.color || sp.wall), trim = C(sp.trim), roof = C(sp.roof);
  const H = T.h, n = Math.max(2, T.bodies), [px, pz] = F.at(a, b), oct = !!T.oct;
  let y = y0 - 1.2, half = T.w;
  for (let i = 0; i < n; i++) {
    const seg = i === 0 ? H * 0.36 : (H * 0.64 - 1.6) / (n - 1), top = y + seg + (i === 0 ? 1.2 : 0), bell = i >= n - 2;
    if (oct) M.cyl(px, pz, half * 1.08, half * 1.04, y, top, wall, 8, false);
    else M.obox(F, a, b, half, half, y, top, wall, i === 0 ? MOD.CHURCH : MOD.COL_PLAIN, { tw: 4.6, th: 4.4, y0, cap: false, rnd: 30 });
    if (bell) {   // vanos de las campanas: arcos oscuros en las cuatro caras
      for (const [sa, sb] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
        const t = sa ? [F.bx, F.bz] : [F.ax, F.az], w = half * (oct ? 0.32 : 0.42), y1 = top - seg * 0.22, y2 = top - seg * 0.8;
        const c = F.at(a + sa * (half * (oct ? 1.06 : 1) + 0.04), b + sb * (half * (oct ? 1.06 : 1) + 0.04));
        M.flat(c[0] - t[0] * (w + 0.25), c[1] - t[1] * (w + 0.25), c[0] + t[0] * (w + 0.25), c[1] + t[1] * (w + 0.25), y2 - 0.25, y1 + 0.35, trim);
        const c2 = F.at(a + sa * (half * (oct ? 1.06 : 1) + 0.08), b + sb * (half * (oct ? 1.06 : 1) + 0.08));
        M.flat(c2[0] - t[0] * w, c2[1] - t[1] * w, c2[0] + t[0] * w, c2[1] + t[1] * w, y2, y1, DARK);
        const steps = 5;
        for (let st = 0; st < steps; st++) {          // medio punto (o arco apuntado en las neogóticas)
          const t0 = st / steps * Math.PI, t1 = (st + 1) / steps * Math.PI, hk = oct ? 1.5 : 0.9;
          const p0 = [c2[0] - t[0] * w * Math.cos(t0), c2[1] - t[1] * w * Math.cos(t0)], p1 = [c2[0] - t[0] * w * Math.cos(t1), c2[1] - t[1] * w * Math.cos(t1)];
          M.quad('solid', [p0[0], y1, p0[1]], [p1[0], y1, p1[1]], [p1[0], y1 + w * Math.sin(t1) * hk, p1[1]], [p0[0], y1 + w * Math.sin(t0) * hk, p0[1]], DARK);
        }
      }
    }
    // cornisa de separación con un poco de vuelo
    if (oct) { M.cyl(px, pz, half * 1.08 + 0.3, half * 1.08 + 0.3, top, top + 0.4, trim, 8, true); }
    else { M.obox(F, a, b, half + 0.35, half + 0.35, top, top + 0.45, trim, 'solid'); M.obox(F, a, b, half + 0.2, half + 0.2, top - 0.25, top, C(0xbcb6a8), 'solid', { cap: false }); }
    // pináculos en las esquinas
    if (i > 0 || n === 2) for (const [sa, sb] of oct ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
      const p = F.at(a + sa * (half + 0.15), b + sb * (half + 0.15));
      M.cyl(p[0], p[1], 0.18, 0.18, top + 0.45, top + 1.0, trim, 4, true); M.spire(p[0], p[1], top + 1.0, 0.16, oct ? 1.4 : 0.7, trim, 4);
    }
    y = top + 0.45; half *= oct ? 0.88 : 0.86;
  }
  const top = T.top;
  if (top === 'spire') { const hh = Math.max(9, H * 0.3); M.spire(px, pz, y, half * (oct ? 1.15 : 1) + 0.4, hh, roof, 8); M.cross(px, pz, y + hh, 1, trim); }
  else if (top === 'pyramid') { M.pyramid(px, pz, y, half + 0.35, half * 1.3, roof); M.cross(px, pz, y + half * 1.3, 0.8, trim); }
  else if (top === 'christ') {
    // balaustrada, pedestal y la estatua de Cristo Rey (desde 1937)
    M.obox(F, a, b, half + 0.2, half + 0.2, y, y + 0.9, trim, 'solid', { cap: false });
    M.obox(F, a, b, half * 0.55, half * 0.55, y, y + 2.2, trim, 'solid');
    const ys = y + 2.2, W = C(0xf4f1e8);
    M.cyl(px, pz, 0.55, 0.38, ys, ys + 2.4, W, 8, false); M.cyl(px, pz, 0.38, 0.3, ys + 2.4, ys + 3.1, W, 8, true);
    M.obox(F, a, b, 0.22, 1.2, ys + 2.55, ys + 2.85, W, 'solid');
    M.dome(px, pz, ys + 3.1, 0.3, W, 8, 1.2);
  } else {
    M.cyl(px, pz, half * 0.9, half * 0.9, y, y + 1.6, wall, 8, false); M.obox(F, a, b, half * 0.95, half * 0.95, y + 1.6, y + 1.85, trim, 'solid');
    M.dome(px, pz, y + 1.85, half * 0.9, roof, 10, 1.05);
    M.cyl(px, pz, 0.35, 0.3, y + 1.85 + half * 0.9, y + 2.9 + half * 0.9, trim, 6, true);             // linterna
    M.cross(px, pz, y + 2.9 + half * 0.9, 0.9, C(0x2a2a2a));
  }
}

// Iglesia colonial: nave con techo de teja a dos aguas, fachada con portada de piedra, frontón, torres y a veces un claustro
export function buildChurch(M, F, sp, y0, toward) {
  const wall = C(sp.wall), trim = C(sp.trim), roofC = C(sp.roof), hu = F.hu, hvF = F.hv, hv = sp.partial ? Math.min(hvF, sp.naveW || 8) : hvF;
  const s = ((toward[0] - F.cx) * F.ax + (toward[1] - F.cz) * F.az) >= 0 ? 1 : -1;
  const aF = s * hu, nl = sp.partial ? Math.min(sp.partial, 2 * hu - 4) : 2 * hu, aB = aF - s * nl, hn = sp.nave, yb = y0 - 1.2, yn = y0 + hn;
  const P = (a, b, y) => { const p = F.at(a, b); return [p[0], y, p[1]]; };
  const ctr = F.at((aF + aB) / 2, 0);
  // paredes laterales de sillería con ventanas de arco
  for (const sb of [-1, 1]) { const p = F.at(aF, sb * hv), q = F.at(aB, sb * hv); M.wall(MOD.CHURCH, p[0], p[1], q[0], q[1], yb, yn, wall, { tw: 5, th: hn, y0, ox: ctr[0], oz: ctr[1], rnd: 40 }); }
  { const p = F.at(aB, -hv), q = F.at(aB, hv); M.wall(MOD.COL_PLAIN, p[0], p[1], q[0], q[1], yb, yn, wall, { tw: 5, th: hn, y0, ox: ctr[0], oz: ctr[1] }); }
  { const p = F.at(aF, -hv), q = F.at(aF, hv); M.flat(p[0], p[1], q[0], q[1], yb, yn + 0.6, wall, 1); }
  // contrafuertes en los muros laterales
  const nb = Math.max(2, Math.round(nl / 7));
  for (const sb of [-1, 1]) for (let k = 1; k < nb; k++) {
    const aa = aF - s * nl * k / nb;
    M.obox(F, aa, sb * (hv + 0.45), 0.55, 0.45, yb, yn - 1.2, wall, 'solid', { capCol: roofC });
  }
  // cornisa corrida
  for (const sb of [-1, 1]) M.quad('solid', P(aF, sb * hv, yn - 0.45), P(aB, sb * hv, yn - 0.45), P(aB, sb * (hv + 0.35), yn + 0.1), P(aF, sb * (hv + 0.35), yn + 0.1), trim);
  // techo de teja a dos aguas (la textura de teja la pone el shader de techos)
  const yr = yn + hv * (sp.gothic ? 0.95 : 0.5);
  M.quad('roof', P(aF, -hv - 0.4, yn), P(aF, 0, yr), P(aB, 0, yr), P(aB, -hv - 0.4, yn), roofC, 0.92);
  M.quad('roof', P(aF, hv + 0.4, yn), P(aF, 0, yr), P(aB, 0, yr), P(aB, hv + 0.4, yn), roofC, 1.05);
  M.tri('solid', P(aB, -hv, yn), P(aB, hv, yn), P(aB, 0, yr), wall, 0.9);
  // fachada: frontón triangular con remates, portada de piedra con columnas, ventana coral y óculo
  M.tri('solid', P(aF, -hv, yn + 0.6), P(aF, hv, yn + 0.6), P(aF, 0, yr + 1.2), sp.pediment ? trim : wall, 1);
  M.quad('solid', P(aF + s * 0.25, -hv - 0.2, yn + 0.25), P(aF + s * 0.25, hv + 0.2, yn + 0.25), P(aF + s * 0.25, hv + 0.2, yn + 0.75), P(aF + s * 0.25, -hv - 0.2, yn + 0.75), trim);
  if (sp.pediment) M.tri('solid', P(aF + s * 0.08, -hv * 0.78, yn + 0.85), P(aF + s * 0.08, hv * 0.78, yn + 0.85), P(aF + s * 0.08, 0, yr + 0.6), wall, 1.0);
  { const top = F.at(aF, 0); M.cross(top[0], top[1], yr + 1.2, 1.1, trim); }
  for (const sb of [-1, 1]) { const p = F.at(aF, sb * (hv - 0.4)); M.cyl(p[0], p[1], 0.32, 0.32, yn + 0.75, yn + 1.5, trim, 6, true); M.dome(p[0], p[1], yn + 1.5, 0.35, trim, 6); }
  const fl = (a0, b0, b1, ya, yb2, col) => { const p = F.at(a0, b0), q = F.at(a0, b1); M.flat(p[0], p[1], q[0], q[1], y0 + ya, y0 + yb2, col, 1); };
  if (sp.gothic) {             // tres portadas de arco apuntado
    for (const bb of [-hv * 0.62, 0, hv * 0.62]) {
      const w = bb === 0 ? 1.7 : 1.15, h0 = bb === 0 ? 5.2 : 4.0;
      fl(aF + s * 0.08, bb - w - 0.35, bb + w + 0.35, 0, h0 + w * 1.6 + 0.4, trim);
      fl(aF + s * 0.12, bb - w, bb + w, 0, h0, DOOR);
      for (let k = 0; k < 4; k++) { const t0 = k / 4 * Math.PI / 2, t1 = (k + 1) / 4 * Math.PI / 2; for (const sg of [-1, 1]) { const e0 = F.at(aF + s * 0.12, bb + sg * w * Math.cos(t0)), e1 = F.at(aF + s * 0.12, bb + sg * w * Math.cos(t1)); M.quad('solid', [e0[0], y0 + h0, e0[1]], [e1[0], y0 + h0, e1[1]], [e1[0], y0 + h0 + w * 1.6 * Math.sin(t1), e1[1]], [e0[0], y0 + h0 + w * 1.6 * Math.sin(t0), e0[1]], DOOR); } }
    }
  } else fl(aF + s * 0.05, -2.9, 2.9, 0, 7.4, STONE);                            // portada de piedra
  if (!sp.gothic) {
    for (const sb of [-1, 1]) { const p = F.at(aF + s * 0.45, sb * 2.45); M.cyl(p[0], p[1], 0.26, 0.24, y0, y0 + 6.2, C(0xd8d2c4), 8, true); }
    fl(aF + s * 0.1, -1.8, 1.8, 0, 5.2, DOOR);
    fl(aF + s * 0.14, -1.45, -0.08, 0.2, 4.9, DOOR2); fl(aF + s * 0.14, 0.08, 1.45, 0.2, 4.9, DOOR2);
  { const p = F.at(aF + s * 0.1, 0); for (let k = 0; k < 5; k++) { const t0 = k / 5 * Math.PI, t1 = (k + 1) / 5 * Math.PI, w = 1.8; const e0 = F.at(aF + s * 0.1, -w * Math.cos(t0)), e1 = F.at(aF + s * 0.1, -w * Math.cos(t1)); M.quad('solid', [e0[0], y0 + 5.2, e0[1]], [e1[0], y0 + 5.2, e1[1]], [e1[0], y0 + 5.2 + w * Math.sin(t1) * 0.7, e1[1]], [e0[0], y0 + 5.2 + w * Math.sin(t0) * 0.7, e0[1]], DOOR); } void p; }
    fl(aF + s * 0.08, -3.3, 3.3, 7.4, 7.8, trim);
  }
  if (hv > 5) fl(aF + s * 0.06, -0.9, 0.9, hn * 0.62, hn * 0.92, GLASS);                       // ventana del coro
  { const p = F.at(aF + s * 0.07, 0); M.cyl(p[0], p[1], 1.0, 1.0, yn + hv * 0.18, yn + hv * 0.18 + 0.06, GLASS, 10, true); void p; }
  if (hv > 7 && !sp.gothic) for (const sb of [-1, 1]) fl(aF + s * 0.06, sb * hv * 0.6 - 0.7, sb * hv * 0.6 + 0.7, hn * 0.3, hn * 0.68, GLASS);
  // torres
  for (const T of sp.towers || []) {
    if (T.at) {                // posición real: se pasa a coordenadas del marco de la iglesia
      const dx = T.at[0] - F.cx, dz = T.at[1] - F.cz;
      buildTower(M, F, dx * F.ax + dz * F.az, dx * F.bx + dz * F.bz, T, y0, sp);
      continue;
    }
    const w = Math.min(T.w, hv * 0.6), b = T.side === 'L' ? -(hv - w) : T.side === 'R' ? (hv - w) : 0;
    buildTower(M, F, s * (hu - w), b, { ...T, w }, y0, sp);
  }
  // cúpula sobre el crucero (las iglesias grandes)
  if (sp.dome) { const p = F.at(aB + s * Math.min(9, nl * 0.25), 0), r = Math.min(hv * 0.8, 6); M.cyl(p[0], p[1], r, r, yn, yn + 3, wall, 10, false); M.dome(p[0], p[1], yn + 3, r, roofC, 12, 0.95); M.cross(p[0], p[1], yn + 3 + r * 0.95, 1, trim); }
  // claustro (iglesias con convento): alas bajas alrededor de un patio, detrás de la nave
  if (sp.partial) {
    const len = 2 * hu - nl, wing = Math.min(9, hvF * 0.3), h = 7, ac = aB - s * len / 2;
    if (len > 2 * wing + 6) {
      const roofG = C(0xa86a4c), o = { capK: 'roof', capCol: roofG, y0, tw: 4.2, th: 5.2, rnd: 77 };
      M.obox(F, ac, -(hvF - wing / 2), len / 2, wing / 2, yb, y0 + h, wall, MOD.COL_WIN, o);
      M.obox(F, ac, hvF - wing / 2, len / 2, wing / 2, yb, y0 + h, wall, MOD.COL_WIN, o);
      M.obox(F, -s * (hu - wing / 2), 0, wing / 2, hvF - wing, yb, y0 + h, wall, MOD.COL_DOOR, o);
      M.obox(F, aB - s * wing / 2, 0, wing / 2, hvF - wing, yb, y0 + h, wall, MOD.COL_ARCH, o);
    }
  }
}

// ---- objetos sueltos en plazas y calles ----
const TERRA = C(0xb0643c), MARBLE = C(0xeeeae0), BRONZE = C(0x4f6b5a), TRUNK = C(0x9a8e7a), IRON = C(0x2d3a34);
const at0 = (x, z) => ({ at: (a, b) => [x + a, z + b] });

export function addJar(M, x, z, y, s = 1) {       // tinajón camagüeyano
  const c = TERRA;
  M.cyl(x, z, 0.35 * s, 0.55 * s, y, y + 0.3 * s, c, 8, false); M.cyl(x, z, 0.55 * s, 0.85 * s, y + 0.3 * s, y + 0.9 * s, c, 8, false);
  M.cyl(x, z, 0.85 * s, 0.7 * s, y + 0.9 * s, y + 1.5 * s, c, 8, false); M.cyl(x, z, 0.7 * s, 0.45 * s, y + 1.5 * s, y + 1.8 * s, c, 8, true);
  M.cyl(x, z, 0.5 * s, 0.5 * s, y + 1.75 * s, y + 1.9 * s, C(0x8d4f2e), 8, true);
}
export function addSculpture(M, x, z, y) {   // figura de bronce de tamaño natural
  const c = IRON;
  M.cyl(x, z, 0.3, 0.2, y, y + 1.15, c, 6, false); M.cyl(x, z, 0.2, 0.22, y + 1.15, y + 1.55, c, 6, true);
  M.cyl(x, z, 0.14, 0.12, y + 1.55, y + 1.8, c, 6, true);
}
export function addStatue(M, x, z, y) {      // estatua ecuestre de Ignacio Agramonte sobre pedestal de mármol
  const F = at0(x, z);
  M.obox(F, 0, 0, 3.2, 3.2, y, y + 0.5, MARBLE, 'solid'); M.obox(F, 0, 0, 2.6, 2.6, y + 0.5, y + 1.0, MARBLE, 'solid');
  M.obox(F, 0, 0, 1.9, 1.1, y + 1.0, y + 3.6, MARBLE, 'solid'); M.obox(F, 0, 0, 2.15, 1.35, y + 3.6, y + 3.9, MARBLE, 'solid');
  const yy = y + 3.9;
  M.obox(F, 0, 0, 1.15, 0.38, yy + 1.0, yy + 2.0, BRONZE, 'solid');
  M.obox(F, 1.55, 0, 0.5, 0.2, yy + 1.7, yy + 2.9, BRONZE, 'solid');
  M.obox(F, 1.95, 0, 0.5, 0.17, yy + 2.4, yy + 2.8, BRONZE, 'solid');
  for (const [a, b] of [[0.8, 0.2], [0.8, -0.2], [-0.8, 0.2], [-0.8, -0.2]]) M.obox(F, a, b, 0.1, 0.1, yy, yy + 1.0, BRONZE, 'solid');
  M.obox(F, -0.1, 0, 0.3, 0.3, yy + 2.0, yy + 3.2, BRONZE, 'solid'); M.cyl(x - 0.1, z, 0.2, 0.2, yy + 3.2, yy + 3.65, BRONZE, 6, true);
}
export function addRoyalPalm(M, x, z, y, h = 15) {
  M.cyl(x, z, 0.38, 0.26, y - 0.5, y + h, TRUNK, 6, false);
  M.cyl(x, z, 0.3, 0.3, y + h - 2.2, y + h, C(0x6f9a4a), 6, true);
  for (let i = 0; i < 9; i++) {
    const a = i / 9 * 6.2832, dx = Math.cos(a), dz = Math.sin(a), px = -dz, pz = dx, t = y + h;
    const col = new THREE.Color(0.12 + (i % 3) * 0.02, 0.4 + (i % 2) * 0.07, 0.13);
    M.quad('solid', [x, t, z], [x + dx * 2.6 + px * 0.5, t + 1.1, z + dz * 2.6 + pz * 0.5], [x + dx * 5.2, t - 1.6, z + dz * 5.2], [x + dx * 2.6 - px * 0.5, t + 1.1, z + dz * 2.6 - pz * 0.5], col);
  }
}
export function addBench(M, x, z, y, ang) {   // banco de mármol
  const F = { at: (a, b) => [x + Math.cos(ang) * a - Math.sin(ang) * b, z + Math.sin(ang) * a + Math.cos(ang) * b] };
  M.obox(F, 0, 0, 0.85, 0.28, y + 0.42, y + 0.5, MARBLE, 'solid');
  M.obox(F, -0.65, 0, 0.12, 0.26, y - 0.45, y + 0.42, MARBLE, 'solid', { cap: false }); M.obox(F, 0.65, 0, 0.12, 0.26, y - 0.45, y + 0.42, MARBLE, 'solid', { cap: false });
  M.obox(F, 0, -0.27, 0.85, 0.04, y + 0.5, y + 0.95, MARBLE, 'solid');
}
// farola ornamental de hierro con globo (la bombilla va en la cubeta "glow", siempre brillante)
export function addLampPost(M, x, z, y) {
  M.cyl(x, z, 0.16, 0.1, y, y + 3.6, IRON, 6, false); M.cyl(x, z, 0.26, 0.26, y - 0.5, y + 0.5, IRON, 6, true);
  M.cyl(x, z, 0.3, 0.2, y + 3.6, y + 3.9, IRON, 6, true);
  M.cyl(x, z, 0.28, 0.28, y + 3.9, y + 4.3, C(0xffe6a8), 6, true, 'glow');
}
// poste de hormigón con travesaño y aisladores
export function addPole(M, x, z, y, ax, az, trafo = false) {
  const F = { at: (a, b) => [x + ax * a - az * b, z + az * a + ax * b] };
  M.obox(F, 0, 0, 0.14, 0.14, y - 0.6, y + 8, C(0x8c8a84), 'solid', { cap: false });
  M.obox(F, 0, 0, 0.08, 0.95, y + 7.4, y + 7.56, C(0x3d3a36), 'solid');
  if (trafo) { const p = F.at(0.42, 0); M.cyl(p[0], p[1], 0.32, 0.32, y + 5.3, y + 6.4, C(0x6f7377), 6, true); M.obox(F, 0.25, 0, 0.1, 0.08, y + 5.6, y + 6.1, C(0x3d3a36), 'solid'); }      // transformador
}
// farol de calle (brazo con luminaria de sodio) para los postes que tienen luz
export function addStreetLamp(M, x, z, y, nx, nz) {
  const ex = x + nx * 1.4, ez = z + nz * 1.4;
  M.quad('solid', [x, y + 7.95, z], [ex, y + 7.95, ez], [ex, y + 8.05, ez], [x, y + 8.05, z], C(0x3d3a36));
  M.obox({ at: (a, b) => [ex + a, ez + b] }, 0, 0, 0.3, 0.16, y + 7.75, y + 7.95, C(0x55585c), 'solid');
  M.quad('glow', [ex - 0.25, y + 7.74, ez - 0.12], [ex + 0.25, y + 7.74, ez - 0.12], [ex + 0.25, y + 7.74, ez + 0.12], [ex - 0.25, y + 7.74, ez + 0.12], C(0xffc470));
}
// tinaco (tanque de agua) en la azotea; caseta de escalera
export function addTank(M, x, z, y, kind) {
  if (kind < 0.35) M.cyl(x, z, 0.62, 0.5, y, y + 1.45, C(0x24282e), 6, true);             // tanque plástico negro
  else if (kind < 0.62) M.cyl(x, z, 0.62, 0.55, y, y + 1.45, C(0x2e64b4), 6, true);       // tanque plástico azul (muy común)
  else if (kind < 0.82) M.cyl(x, z, 0.6, 0.55, y, y + 1.3, C(0xb9c3cc), 6, true);          // de fibrocemento
  else M.obox(at0(x, z), 0, 0, 0.75, 0.75, y, y + 1.1, C(0x9d9a92), 'solid');              // de mampostería
}
export { C };

buildChurch.tower = buildTower;      // campanarios sueltos

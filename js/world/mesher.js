// Acumulador de geometría de la ciudad con buffers tipados e índices: poca memoria, sin conversiones al final
// y con la normal de cada cara calculada al vuelo. Cada "cubeta" acaba siendo una sola malla (una llamada de dibujo).
//   fac   → fachadas con textura del atlas (uv + módulo del atlas + número al azar por edificio)
//   roof  → techos (teja o azotea, el dibujo lo pone el shader)
//   solid → molduras, pretiles, columnas, mobiliario… (solo color)
//   glow  → bombillas y faroles (siempre encendidos)

class Buf {
  constructor(uv) {
    this.cap = 4096; this.n = 0; this.ni = 0;
    this.P = new Float32Array(this.cap * 3); this.N = new Int8Array(this.cap * 3); this.C = new Uint8Array(this.cap * 3);
    this.U = uv ? new Float32Array(this.cap * 2) : null; this.T = uv ? new Uint8Array(this.cap * 4) : null;
    this.I = new Uint32Array(this.cap * 2);
  }
  reserve(nv, ni) {
    if (this.n + nv > this.cap) {
      let c = this.cap; while (this.n + nv > c) c *= 2;
      const g = (A, k) => { const B = new A.constructor(c * k); B.set(A); return B; };
      this.P = g(this.P, 3); this.N = g(this.N, 3); this.C = g(this.C, 3);
      if (this.U) { this.U = g(this.U, 2); this.T = g(this.T, 4); }
      this.cap = c;
    }
    if (this.ni + ni > this.I.length) { let c = this.I.length; while (this.ni + ni > c) c *= 2; const B = new Uint32Array(c); B.set(this.I); this.I = B; }
  }
}

const b255 = v => (v <= 0 ? 0 : v >= 1 ? 255 : (v * 255 + 0.5) | 0);

export class Mesher {
  constructor() { this.b = {}; }
  bucket(k) { return this.b[k] || (this.b[k] = new Buf(k === 'fac' || k === 'sign' || k === 'fence')); }
  // letrero: rectángulo vertical con su trozo del atlas de letreros (u0,v0)-(u1,v1); mira hacia fuera de (ox, oz)
  sign(x0, z0, x1, z1, yb, yt, uv, ox, oz) {
    const B = this.bucket('sign'); B.reserve(4, 6);
    let dx = x1 - x0, dz = z1 - z0; const l = Math.hypot(dx, dz) || 1;
    let nx = -dz / l, nz = dx / l;
    if (((x0 + x1) / 2 - ox) * nx + ((z0 + z1) / 2 - oz) * nz < 0) { let t = x0; x0 = x1; x1 = t; t = z0; z0 = z1; z1 = t; nx = -nx; nz = -nz; }
    const i = this._v(B, x0, yb, z0, nx, 0, nz, 255, 255, 255); this._v(B, x1, yb, z1, nx, 0, nz, 255, 255, 255);
    this._v(B, x1, yt, z1, nx, 0, nz, 255, 255, 255); this._v(B, x0, yt, z0, nx, 0, nz, 255, 255, 255);
    const U = B.U, j = i * 2, [u0, v0, u1, v1] = uv;
    U[j] = u0; U[j + 1] = v0; U[j + 2] = u1; U[j + 3] = v0; U[j + 4] = u1; U[j + 5] = v1; U[j + 6] = u0; U[j + 7] = v1;
    const I = B.I; I[B.ni++] = i; I[B.ni++] = i + 1; I[B.ni++] = i + 2; I[B.ni++] = i; I[B.ni++] = i + 2; I[B.ni++] = i + 3;
  }
  count(k) { const B = this.b[k]; return B ? B.n : 0; }

  // vértice suelto (la normal la pone quien llama)
  _v(B, x, y, z, nx, ny, nz, r, g, b) {
    const i = B.n++, i3 = i * 3;
    B.P[i3] = x; B.P[i3 + 1] = y; B.P[i3 + 2] = z;
    B.N[i3] = nx * 127 | 0; B.N[i3 + 1] = ny * 127 | 0; B.N[i3 + 2] = nz * 127 | 0;
    B.C[i3] = r; B.C[i3 + 1] = g; B.C[i3 + 2] = b;
    return i;
  }
  tri(k, a, b, c, col, sh = 1) {
    const B = this.bucket(k); B.reserve(3, 3);
    let ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const r = b255(col.r * sh), g = b255(col.g * sh), bb = b255(col.b * sh);
    const i = this._v(B, a[0], a[1], a[2], nx, ny, nz, r, g, bb); this._v(B, b[0], b[1], b[2], nx, ny, nz, r, g, bb); this._v(B, c[0], c[1], c[2], nx, ny, nz, r, g, bb);
    B.I[B.ni++] = i; B.I[B.ni++] = i + 1; B.I[B.ni++] = i + 2;
  }
  quad(k, a, b, c, d, col, sh = 1) {
    const B = this.bucket(k); B.reserve(4, 6);
    let ux = c[0] - a[0], uy = c[1] - a[1], uz = c[2] - a[2], vx = d[0] - b[0], vy = d[1] - b[1], vz = d[2] - b[2];
    let nx = uy * vz - uz * vy, ny = uz * vx - ux * vz, nz = ux * vy - uy * vx; const l = Math.hypot(nx, ny, nz) || 1; nx /= l; ny /= l; nz /= l;
    const r = b255(col.r * sh), g = b255(col.g * sh), bb = b255(col.b * sh);
    const i = this._v(B, a[0], a[1], a[2], nx, ny, nz, r, g, bb); this._v(B, b[0], b[1], b[2], nx, ny, nz, r, g, bb);
    this._v(B, c[0], c[1], c[2], nx, ny, nz, r, g, bb); this._v(B, d[0], d[1], d[2], nx, ny, nz, r, g, bb);
    const I = B.I; I[B.ni++] = i; I[B.ni++] = i + 1; I[B.ni++] = i + 2; I[B.ni++] = i; I[B.ni++] = i + 2; I[B.ni++] = i + 3;
  }
  // pared vertical lisa
  flat(x0, z0, x1, z1, yb, yt, col, sh = 1, k = 'solid') { this.quad(k, [x0, yb, z0], [x1, yb, z1], [x1, yt, z1], [x0, yt, z0], col, sh); }

  // Cara de fachada con un módulo del atlas. Mira hacia fuera: hacia el lado contrario de (ox, oz), un punto interior.
  // u0..u1 y v0..v1 en unidades de módulo (se repite con fract en el shader); mod = índice del atlas; rnd = 0..255 por edificio.
  fquad(x0, z0, x1, z1, yb, yt, col, u0, u1, v0, v1, mod, rnd, ox, oz, s0 = 0.8, s1 = 1, k = 'fac') {
    const B = this.bucket(k); B.reserve(4, 6);
    let dx = x1 - x0, dz = z1 - z0; const l = Math.hypot(dx, dz) || 1;
    let nx = -dz / l, nz = dx / l;
    if (((x0 + x1) / 2 - ox) * nx + ((z0 + z1) / 2 - oz) * nz < 0) {      // al revés: se cambia el sentido del borde
      let t = x0; x0 = x1; x1 = t; t = z0; z0 = z1; z1 = t; t = u0; u0 = -u1; u1 = -t; nx = -nx; nz = -nz;
    }
    const r0 = b255(col.r * s0), g0 = b255(col.g * s0), bl0 = b255(col.b * s0), r1 = b255(col.r * s1), g1 = b255(col.g * s1), bl1 = b255(col.b * s1);
    const i = this._v(B, x0, yb, z0, nx, 0, nz, r0, g0, bl0); this._v(B, x1, yb, z1, nx, 0, nz, r0, g0, bl0);
    this._v(B, x1, yt, z1, nx, 0, nz, r1, g1, bl1); this._v(B, x0, yt, z0, nx, 0, nz, r1, g1, bl1);
    const U = B.U, T = B.T, j = i * 2, t4 = i * 4;
    U[j] = u0; U[j + 1] = v0; U[j + 2] = u1; U[j + 3] = v0; U[j + 4] = u1; U[j + 5] = v1; U[j + 6] = u0; U[j + 7] = v1;
    for (let q = 0; q < 4; q++) { T[t4 + q * 4] = mod; T[t4 + q * 4 + 1] = rnd; T[t4 + q * 4 + 2] = 0; T[t4 + q * 4 + 3] = 0; }
    const I = B.I; I[B.ni++] = i; I[B.ni++] = i + 1; I[B.ni++] = i + 2; I[B.ni++] = i; I[B.ni++] = i + 2; I[B.ni++] = i + 3;
  }
  // pared con un módulo repetido (una sola cara): tw/th = tamaño del módulo en metros; y0 = nivel del suelo (v = 0)
  wall(mod, x0, z0, x1, z1, yb, yt, col, o = {}) {
    const len = Math.hypot(x1 - x0, z1 - z0), tw = o.tw || 4.2, th = o.th || 5.2, y0 = o.y0 === undefined ? yb : o.y0;
    const nu = Math.max(1, Math.round(len / tw)), uo = o.uo || 0;
    const ox = o.ox === undefined ? (x0 + x1) / 2 + (z1 - z0) : o.ox, oz = o.oz === undefined ? (z0 + z1) / 2 - (x1 - x0) : o.oz;
    this.fquad(x0, z0, x1, z1, yb, yt, col, uo, uo + nu, (yb - y0) / th, (yt - y0) / th, mod, o.rnd || 0, ox, oz, o.sh0 === undefined ? 0.78 : o.sh0, 1);
  }
  // prisma de contorno cualquiera con cubierta plana
  poly(pts, yb, yt, col, k = 'solid', cap = true) {
    for (let i = 0; i < pts.length; i++) { const p = pts[i], q = pts[(i + 1) % pts.length]; this.flat(p[0], p[1], q[0], q[1], yb, yt, col, 1, k); }
    if (cap) { const tris = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []); for (const t of tris) this.tri(k, [pts[t[0]][0], yt, pts[t[0]][1]], [pts[t[1]][0], yt, pts[t[1]][1]], [pts[t[2]][0], yt, pts[t[2]][1]], col); }
  }
  // caja alineada con un marco (a: eje largo, b: eje corto). kind 'solid' o un módulo del atlas (número)
  obox(F, a, b, ha, hb, yb, yt, col, kind, o = {}) {
    const P = (s, t) => F.at(a + s * ha, b + t * hb), cr = [P(-1, -1), P(1, -1), P(1, 1), P(-1, 1)], ctr = F.at(a, b);
    for (let i = 0; i < 4; i++) {
      const p = cr[i], q = cr[(i + 1) % 4];
      if (kind === 'solid') this.flat(p[0], p[1], q[0], q[1], yb, yt, col);
      else this.wall(kind, p[0], p[1], q[0], q[1], yb, yt, col, Object.assign({ ox: ctr[0], oz: ctr[1] }, o));
    }
    if (o.cap !== false) this.quad(o.capK || 'solid', [cr[0][0], yt, cr[0][1]], [cr[1][0], yt, cr[1][1]], [cr[2][0], yt, cr[2][1]], [cr[3][0], yt, cr[3][1]], o.capCol || col);
  }
  cyl(cx, cz, r0, r1, yb, yt, col, n = 8, cap = true, k = 'solid') {
    for (let i = 0; i < n; i++) {
      const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, c0 = Math.cos(a0), s0 = Math.sin(a0), c1 = Math.cos(a1), s1 = Math.sin(a1);
      this.quad(k, [cx + c0 * r0, yb, cz + s0 * r0], [cx + c1 * r0, yb, cz + s1 * r0], [cx + c1 * r1, yt, cz + s1 * r1], [cx + c0 * r1, yt, cz + s0 * r1], col, 0.86 + 0.14 * Math.abs(Math.cos((a0 + a1) / 2 - 0.8)));
      if (cap && r1 > 0) this.tri(k, [cx, yt, cz], [cx + c0 * r1, yt, cz + s0 * r1], [cx + c1 * r1, yt, cz + s1 * r1], col);
    }
  }
  // media esfera (cúpulas); squash < 1 la aplana
  dome(cx, cz, y, r, col, n = 10, squash = 1, k = 'solid') {
    const R = [[1, 0], [0.92, 0.38], [0.71, 0.71], [0.38, 0.92], [0, 1]];
    for (let j = 0; j < R.length - 1; j++) for (let i = 0; i < n; i++) {
      const a0 = i / n * 6.2832, a1 = (i + 1) / n * 6.2832, A = R[j], B = R[j + 1];
      this.quad(k, [cx + Math.cos(a0) * r * A[0], y + r * A[1] * squash, cz + Math.sin(a0) * r * A[0]], [cx + Math.cos(a1) * r * A[0], y + r * A[1] * squash, cz + Math.sin(a1) * r * A[0]],
        [cx + Math.cos(a1) * r * B[0], y + r * B[1] * squash, cz + Math.sin(a1) * r * B[0]], [cx + Math.cos(a0) * r * B[0], y + r * B[1] * squash, cz + Math.sin(a0) * r * B[0]], col, 0.86 + 0.14 * j / 3);
    }
  }
  pyramid(cx, cz, y, hw, hh, col, k = 'solid') {
    const c = [[cx - hw, cz - hw], [cx + hw, cz - hw], [cx + hw, cz + hw], [cx - hw, cz + hw]];
    for (let i = 0; i < 4; i++) { const p = c[i], q = c[(i + 1) % 4]; this.tri(k, [p[0], y, p[1]], [q[0], y, q[1]], [cx, y + hh, cz], col, 0.85 + 0.12 * (i % 2)); }
  }
  // pirámide de base octogonal (agujas y chapiteles)
  spire(cx, cz, y, r, hh, col, n = 8, k = 'solid') {
    for (let i = 0; i < n; i++) {
      const a0 = i / n * 6.2832 + 0.39, a1 = (i + 1) / n * 6.2832 + 0.39;
      this.tri(k, [cx + Math.cos(a0) * r, y, cz + Math.sin(a0) * r], [cx + Math.cos(a1) * r, y, cz + Math.sin(a1) * r], [cx, y + hh, cz], col, 0.85 + 0.15 * (i % 2));
    }
  }
  cross(cx, cz, y, s, col) {
    this.cyl(cx, cz, 0.07 * s, 0.07 * s, y, y + 1.6 * s, col, 4, true);
    this.obox({ at: (a, b) => [cx + a, cz + b] }, 0, 0, 0.45 * s, 0.07 * s, y + 1.1 * s, y + 1.25 * s, col, 'solid');
  }

  // convierte una cubeta en malla (copia compacta de los datos)
  mesh(k, mat) {
    const B = this.b[k]; if (!B || !B.n) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(B.P.slice(0, B.n * 3), 3));
    g.setAttribute('normal', new THREE.BufferAttribute(B.N.slice(0, B.n * 3), 3, true));
    g.setAttribute('color', new THREE.BufferAttribute(B.C.slice(0, B.n * 3), 3, true));
    if (B.U) { g.setAttribute('uv', new THREE.BufferAttribute(B.U.slice(0, B.n * 2), 2)); g.setAttribute('tileInfo', new THREE.BufferAttribute(B.T.slice(0, B.n * 4), 4, false)); }
    g.setIndex(new THREE.BufferAttribute(B.n > 65535 ? B.I.slice(0, B.ni) : Uint16Array.from(B.I.subarray(0, B.ni)), 1));
    g.computeBoundingSphere();
    const m = new THREE.Mesh(g, mat); m.matrixAutoUpdate = false; m.updateMatrix(); m.userData.k = k;
    return m;
  }
}

export { b255 };

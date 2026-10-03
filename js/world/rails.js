// Vías del tren de Camagüey (Ferrocarril Central y ramales, de OpenStreetMap): balasto, traviesas y carriles en una sola cinta.
import { canvasTex } from '../util.js';
import { ll2xz } from '../geo.js';
import { overpass } from './net.js';

export class Rails {
  constructor(world) { this.w = world; this.mesh = null; this.loading = false; }

  async load() {
    if (this.loading || this.mesh) return;
    this.loading = true;
    const els = await overpass('[out:json][timeout:25];(way["railway"="rail"](21.30,-78.02,21.46,-77.80););out geom;');
    if (!els || !els.length) { this.loading = false; return; }
    const th = (x, z) => this.w.terrain.h(x, z), P = [], U = [];
    for (const e of els) {
      if (!e.geometry || e.geometry.length < 2) continue;
      const raw = e.geometry.map(p => { const [x, z] = ll2xz(p.lat, p.lon); return { x, z }; });
      const pts = [raw[0]];
      for (let i = 1; i < raw.length; i++) {
        const a = raw[i - 1], b = raw[i], n = Math.ceil(Math.hypot(b.x - a.x, b.z - a.z) / 10);
        for (let k = 1; k <= n; k++) pts.push({ x: a.x + (b.x - a.x) * k / n, z: a.z + (b.z - a.z) * k / n });
      }
      let d = 0; const hw = 1.75;
      for (let i = 0; i < pts.length - 1; i++) {
        const p = pts[i], q = pts[i + 1], l = Math.hypot(q.x - p.x, q.z - p.z) || 1, nx = -(q.z - p.z) / l * hw, nz = (q.x - p.x) / l * hw;
        const A = [p.x + nx, p.z + nz], B = [p.x - nx, p.z - nz], C = [q.x - nx, q.z - nz], D = [q.x + nx, q.z + nz];
        const y = v => th(v[0], v[1]) + 0.12, v0 = d / 2.4, v1 = (d + l) / 2.4; d += l;
        P.push(A[0], y(A), A[1], B[0], y(B), B[1], C[0], y(C), C[1], A[0], y(A), A[1], C[0], y(C), C[1], D[0], y(D), D[1]);
        U.push(0, v0, 1, v0, 1, v1, 0, v0, 1, v1, 0, v1);
      }
    }
    if (!P.length) { this.loading = false; return; }
    const tex = canvasTex(64, 256, (g, w, h) => {
      g.fillStyle = '#7d7468'; g.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) { const v = 80 + Math.random() * 90 | 0; g.fillStyle = `rgb(${v},${v - 6},${v - 14})`; g.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      for (let y = 6; y < h; y += 64) { g.fillStyle = '#4a3a2c'; g.fillRect(6, y, w - 12, 20); g.fillStyle = 'rgba(0,0,0,.25)'; g.fillRect(6, y + 18, w - 12, 3); }   // traviesas
      for (const x of [17, 44]) { g.fillStyle = '#b9bcbf'; g.fillRect(x, 0, 3, h); g.fillStyle = '#5a5e62'; g.fillRect(x + 3, 0, 2, h); }                              // carriles
    });
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); geo.setAttribute('uv', new THREE.Float32BufferAttribute(U, 2));
    geo.computeVertexNormals(); geo.computeBoundingSphere();
    const mat = new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -2 });
    this.mesh = new THREE.Mesh(geo, mat); this.mesh.renderOrder = 2; this.mesh.matrixAutoUpdate = false;
    this.w.game.scene.add(this.mesh);
    this.loading = false;
  }
}

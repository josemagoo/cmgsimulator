// Ayudas de dibujo compartidas por vehículos y mundo
import { canvasTex } from './util.js';

export const glowTex = canvasTex(64, 64, (g, w, h) => {
  const gr = g.createRadialGradient(32, 32, 0, 32, 32, 31);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(.25, 'rgba(255,255,255,.5)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, h);
});

export const phong = (c, sh = 50) => new THREE.MeshPhongMaterial({ color: c, shininess: sh });

export function addMesh(parent, geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) {
  const m = new THREE.Mesh(geo, mat); m.position.set(x, y, z); m.rotation.set(rx, ry, rz); parent.add(m); return m;
}

// Forma plana extruida (alas, aletas)
export function slab(pts, depth) {
  const sh = new THREE.Shape(pts.map(p => new THREE.Vector2(p[0], p[1])));
  const g = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false });
  g.translate(0, 0, -depth / 2); return g;
}

// Caja con color por vértice (para fusionar en una sola malla)
export function boxGeo(w, h, d, x, y, z, color) {
  const g = new THREE.BoxGeometry(w, h, d).toNonIndexed(); g.translate(x, y, z);
  const n = g.attributes.position.count, c = new Float32Array(n * 3);
  for (let i = 0; i < n; i++) c.set([color.r, color.g, color.b], i * 3);
  g.setAttribute('color', new THREE.BufferAttribute(c, 3)); return g;
}
export function mergeGeos(list) {
  const P = [], N = [], C = [];
  for (const g of list) { P.push(...g.attributes.position.array); N.push(...g.attributes.normal.array); C.push(...g.attributes.color.array); }
  const out = new THREE.BufferGeometry();
  out.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  out.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
  out.setAttribute('color', new THREE.Float32BufferAttribute(C, 3));
  return out;
}

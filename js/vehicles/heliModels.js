// Datos y modelos 3D de los helicópteros
import { glowTex, phong, addMesh as add, slab } from '../gfx.js';

// vmax: km/h; climb/descend: velocidad vertical máxima (m/s); yawRate: giro con el pedal (rad/s); ease: facilidad 0..1
export const HELI_SPECS = [
  { id: 'heli-light', name: 'Helicóptero ligero', tag: 'Fácil', desc: 'Ágil y estable: ideal para volar bajo sobre la ciudad y aterrizar donde quieras.',
    vmax: 210, climb: 7, descend: 5, yawRate: 1.1, ease: 0.95, maxImpact: 4.5, camK: 1, startMsg: 'sube con Shift (o el gatillo derecho) para despegar' },
  { id: 'heli-rescue', name: 'Helicóptero de rescate', tag: 'Media', desc: 'Grande y potente: sube rápido y aguanta más velocidad de crucero.',
    vmax: 260, climb: 9, descend: 6, yawRate: 0.9, ease: 0.7, maxImpact: 5, camK: 1.3, startMsg: 'sube con Shift (o el gatillo derecho) para despegar' },
  { id: 'heli-combat', name: 'Helicóptero de combate', tag: 'Experto', desc: 'Delgado y muy rápido, con alas cortas: responde con nervio.',
    vmax: 330, climb: 12, descend: 8, yawRate: 1.5, ease: 0.4, maxImpact: 5.5, camK: 1.25, startMsg: 'sube con Shift (o el gatillo derecho) para despegar' },
].map(h => ({ ...h, category: 'heli', vm: h.vmax / 3.6 }));

const LOOKS = {
  'heli-light': { body: 0xc8282d, acc: 0xf2f2f2, sx: 1, len: 1, blades: 2, rotorR: 5.4, tandem: false, stub: false, skid: 1.6 },
  'heli-rescue': { body: 0xf2f2f2, acc: 0xd9431f, sx: 1.25, len: 1.3, blades: 4, rotorR: 6.6, tandem: false, stub: false, skid: 1.9 },
  'heli-combat': { body: 0x4e5a45, acc: 0x2c332a, sx: 0.78, len: 1.25, blades: 4, rotorR: 5.6, tandem: true, stub: true, skid: 1.3 },
};

function navLight(parent, x, y, z, color) {
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, blending: THREE.AdditiveBlending, depthWrite: false }));
  s.scale.set(1.8, 1.8, 1); s.position.set(x, y, z); parent.add(s); return s;
}

export function buildHeliModel(spec) {
  const o = LOOKS[spec.id], g = new THREE.Group();
  const M = { group: g, rotor: null, tailRotor: null, discs: [], cockpit: new THREE.Vector3(0, 1.9 * o.sx, -1.4 * o.len) };
  const BODY = phong(o.body, 90), ACC = phong(o.acc, 60), GLASS = phong(0x14202c, 140), DARK = phong(0x1c1c20, 15);
  const A = (geo, mat, x, y, z, rx = 0, ry = 0, rz = 0) => add(g, geo, mat, x, y, z, rx, ry, rz);
  const w = o.sx, L = o.len;

  // cabina (elipsoide) y cristal delantero
  const cab = A(new THREE.SphereGeometry(1, 20, 14), BODY, 0, 1.75 * w, 0); cab.scale.set(1.05 * w, (o.tandem ? 0.85 : 1.05) * w, 2.0 * L);
  const gl = A(new THREE.SphereGeometry(1, 16, 12), GLASS, 0, 1.85 * w, -0.85 * L); gl.scale.set(0.95 * w, (o.tandem ? 0.7 : 0.85) * w, 1.35 * L);
  if (o.tandem) { const gl2 = A(new THREE.SphereGeometry(1, 16, 12), GLASS, 0, 2.1 * w, -0.1 * L); gl2.scale.set(0.7 * w, 0.55 * w, 0.9 * L); }
  // franja de color
  A(new THREE.BoxGeometry(2.1 * w + 0.02, 0.22, 2.4 * L), ACC, 0, 1.45 * w, 0.4 * L);
  // cola
  const tailLen = 4.6 * L;
  A(new THREE.CylinderGeometry(0.16 * w, 0.42 * w, tailLen, 10), BODY, 0, 2.0 * w, 1.8 * L + tailLen / 2, Math.PI / 2);
  A(slab([[-0.3, 0], [1.1, 0], [0.55, 1.5 * w], [-0.2, 1.5 * w]], 0.08), ACC, 0, 2.0 * w, 1.8 * L + tailLen - 0.2, 0, Math.PI / 2);        // aleta vertical
  A(slab([[-0.9, 0.2], [-0.9, -0.2], [0, -0.3], [0.9, -0.2], [0.9, 0.2], [0, 0.35]], 0.06), BODY, 0, 2.0 * w, 1.8 * L + tailLen * 0.8, -Math.PI / 2); // estabilizador
  // motor y mástil
  A(new THREE.BoxGeometry(1.1 * w, 0.6 * w, 1.6 * L), DARK, 0, 2.75 * w, 0.6 * L);
  A(new THREE.CylinderGeometry(0.11, 0.13, 0.5, 8), DARK, 0, 3.25 * w, 0.3 * L);
  // patines
  for (const s of [-1, 1]) {
    A(new THREE.CylinderGeometry(0.06, 0.06, 3.2 * L, 8), DARK, s * o.skid * 0.75 * w, 0.22, -0.2 * L, Math.PI / 2);
    for (const z of [-0.9, 0.9]) A(new THREE.CylinderGeometry(0.045, 0.045, 1.0 * w, 6), DARK, s * o.skid * 0.7 * w, 0.72 * w, z * L, 0, 0, s * 0.25);
  }
  if (o.stub) for (const s of [-1, 1]) {           // alas cortas con armamento
    A(slab([[0, 0.5], [0, -0.6], [1.9, -0.5], [1.9, 0.1]], 0.1), ACC, s * 1.0, 1.75 * w, 0.2 * L, -Math.PI / 2, 0, 0).scale.x = s;
    A(new THREE.CylinderGeometry(0.16, 0.12, 1.3, 8), DARK, s * 1.9, 1.6 * w, -0.1 * L, Math.PI / 2);
  }
  // rotor principal
  const rotor = new THREE.Group(); rotor.position.set(0, 3.55 * w, 0.3 * L); g.add(rotor); M.rotor = rotor;
  for (let i = 0; i < o.blades; i++) add(rotor, new THREE.BoxGeometry(o.rotorR * 2, 0.05, 0.3), DARK, 0, 0, 0, 0, i * Math.PI / o.blades, 0);
  add(rotor, new THREE.CylinderGeometry(0.22, 0.22, 0.2, 10), DARK, 0, 0.05, 0);
  const disc = add(g, new THREE.CircleGeometry(o.rotorR, 32), new THREE.MeshBasicMaterial({ color: 0x222222, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false }), 0, 3.6 * w, 0.3 * L, -Math.PI / 2);
  M.discs.push(disc);
  // rotor de cola
  const tr = new THREE.Group(); tr.position.set(0.3 * w, 2.0 * w + 0.6 * w, 1.8 * L + tailLen - 0.1); g.add(tr); M.tailRotor = tr;
  for (let i = 0; i < 2; i++) add(tr, new THREE.BoxGeometry(0.05, 1.5 * w, 0.14), DARK, 0, 0, 0, i * Math.PI / 2, 0, 0);
  // luces
  M.navL = navLight(g, -1.1 * w, 1.3 * w, -0.2 * L, 0xff2a2a); M.navR = navLight(g, 1.1 * w, 1.3 * w, -0.2 * L, 0x2aff55); M.navT = navLight(g, 0, 2.9 * w, 1.8 * L + tailLen, 0xffffff);
  return M;
}

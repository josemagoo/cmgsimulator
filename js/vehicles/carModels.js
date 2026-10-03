// Datos y modelos 3D de los autos (carrocerías con silueta real: ver carShapes.js)
import { playerCar, wheelParts, merge } from './carShapes.js';

// vmax: km/h; accel: m/s² a fondo; steer: ángulo máximo de las ruedas (rad); grip: agarre en curva
export const CAR_SPECS = [
  { id: 'almendron', name: 'Almendrón clásico', tag: 'Fácil', desc: 'Chevrolet de 1955 de dos tonos, como los que recorren las calles de Cuba.',
    vmax: 120, accel: 5, steer: 0.55, camDist: 8.5, camHeight: 3.2, snd: [38, 40, 380] },
  { id: 'jeep', name: 'Jeep todoterreno', tag: 'Media', desc: 'Alto y robusto: aguanta bien caminos y terreno irregular.',
    vmax: 150, accel: 6.5, steer: 0.6, camDist: 8.8, camHeight: 3.6, snd: [42, 55, 450] },
  { id: 'sport', name: 'Deportivo', tag: 'Experto', desc: 'Muy rápido y bajo. Cuidado con las curvas y los edificios.',
    vmax: 230, accel: 11, steer: 0.5, camDist: 8, camHeight: 2.6, snd: [50, 90, 700] },
].map(c => ({ ...c, category: 'car', vm: c.vmax / 3.6, k: c.accel / ((c.vmax / 3.6) ** 2) }));

// tipo de carrocería, color y color del techo (dos tonos)
const LOOKS = {
  almendron: { type: 'almendron', body: 0x1fa39a, roof: 0xf2f2ee },
  jeep: { type: 'jeep', body: 0x4b6b3a, roof: 0x3d5a30 },
  sport: { type: 'sport', body: 0xc8282d },
};

export function buildCarModel(spec) {
  const o = LOOKS[spec.id], g = new THREE.Group();
  const parts = playerCar(o.type, o.roof, o.body), P = parts.P;
  const BODY = new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, shininess: 95, specular: 0x666666 });
  const TRIM = new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, shininess: 70, specular: 0x444444, side: THREE.DoubleSide });
  const WHEEL = new THREE.MeshPhongMaterial({ color: 0xffffff, vertexColors: true, shininess: 40, side: THREE.DoubleSide });
  const body = new THREE.Mesh(parts.body, BODY), trim = new THREE.Mesh(parts.trim, TRIM);
  g.add(body, trim);
  // ruedas: el neumático con su tapacubos gira; las delanteras además giran con el volante
  const wheels = [], front = [];
  for (const wz of P.wz) for (const s of [-1, 1]) {
    const pivot = new THREE.Group(); pivot.position.set(s * (P.w / 2 - 0.1), P.wr, wz);
    const wheel = new THREE.Mesh(merge(wheelParts(P, s * 0.001, 0, 0)), WHEEL);
    pivot.add(wheel); g.add(pivot); wheels.push(wheel); if (wz < 0) front.push(pivot);
  }
  const ws = P.ws ? P.pts[P.ws[0]] : [-0.6, P.belt];
  return { group: g, wheels, front, mats: [BODY], baseColors: [0xffffff], cockpit: new THREE.Vector3(-0.36, P.belt + 0.36, ws[0] + 0.55), wheelR: P.wr, len: P.len };
}

// Datos urbanos de Camagüey: centro, plazas y lugares emblemáticos con su estilo.
// Fuentes: OpenStreetMap (posiciones y nombres), UNESCO / EcuRed / Puerto Príncipe (arquitectura) y la propia imagen satelital.
import { ll2xz } from '../geo.js';

const P = (lat, lon) => ll2xz(lat, lon);

// Corazón del casco histórico: el Parque Ignacio Agramonte (antigua Plaza de Armas)
export const CORE = P(21.37908, -77.91838);

// Plazas y plazuelas del casco histórico (centros). Las iglesias abren su fachada hacia la plaza más cercana.
export const PLAZAS = [
  { name: 'Parque Ignacio Agramonte', xz: P(21.37908, -77.91838), r: 55, paving: 'stone' },
  { name: 'Plaza San Juan de Dios', xz: P(21.37595, -77.91755), r: 38, paving: 'cobble' },
  { name: 'Plaza del Carmen', xz: P(21.37995, -77.92350), r: 30, paving: 'cobble' },
  { name: 'Plaza de los Trabajadores', xz: P(21.38232, -77.91875), r: 34, paving: 'stone' },
  { name: 'Plaza de Santa Ana', xz: P(21.38327, -77.92252), r: 26, paving: 'cobble' },
  { name: 'Plaza de San Francisco', xz: P(21.37949, -77.91524), r: 28, paving: 'stone' },
  { name: 'Parque Cristo', xz: P(21.37700, -77.92322), r: 26, paving: 'stone' },
  { name: 'Plaza del Teatro', xz: P(21.38341, -77.91982), r: 18, paving: 'stone' },
  { name: 'Plaza de la Soledad', xz: P(21.38275, -77.91621), r: 22, paving: 'stone' },
];

// Edificios singulares: se reconocen por el nombre que tienen en OpenStreetMap.
// kind: tipo de modelo; wall/trim/roof: colores; towers: lista de torres {side, h, w, bodies, top}
const T = (side, h, w, bodies, top, oct) => ({ side, h, w, bodies, top, oct });
// Colores y torres tomados de fotos actuales (Wikimedia Commons, videos de las plazas):
//  - Catedral: campanario crema de 6 cuerpos con reloj, rematado desde 1937 por la estatua de Cristo Rey
//  - Sagrado Corazón (antigua iglesia de San Francisco, 1912-1919): neogótica de piedra gris, torre central de 53 m y dos laterales octogonales
//  - La Merced: blanca con molduras granate, gran torre sobre la portada, cúpula
//  - La Soledad: blanca con pilastras y marcos ocre, torre de tres cuerpos y cúpula roja
//  - El Carmen: amarilla con blanco, la única de Camagüey con dos torres, y cúpula
//  - San Juan de Dios: amarilla con blanco, torre pequeña junto al antiguo hospital
export const LANDMARKS = [
  { re: /catedral.*candelaria/, kind: 'church', wall: 0xeadcb8, trim: 0xfbf7ec, roof: 0xb15a3a, nave: 14, towers: [T('L', 42, 5.0, 6, 'christ')], pediment: true, tag: 'cathedral' },
  { re: /iglesia de san francisco|sagrado coraz/, kind: 'gothic', wall: 0xa9a69c, trim: 0xc7c3b8, roof: 0x55595f, nave: 15, towers: [T('C', 53, 3.3, 6, 'spire', true), T('L', 27, 1.9, 4, 'spire', true), T('R', 27, 1.9, 4, 'spire', true)], gothic: true, tag: 'gothic' },
  { re: /nuestra se.ora de la merced|iglesia.*merced/, kind: 'church', wall: 0xf3f1ea, trim: 0x8b4a3a, roof: 0xa04c36, nave: 13, towers: [T('C', 38, 4.3, 5, 'cupola')], pediment: true, dome: true, tag: 'baroque' },
  { re: /soledad/, kind: 'church', wall: 0xf3efe6, trim: 0xd8962e, roof: 0xb4402e, nave: 11, towers: [T('L', 30, 4.8, 3, 'pyramid')], dome: true, tag: 'colonial' },
  { re: /iglesia del carmen/, kind: 'church', wall: 0xe8c35a, trim: 0xfaf6ea, roof: 0xb4583a, nave: 11, towers: [T('L', 26, 3.4, 3, 'pyramid'), T('R', 26, 3.4, 3, 'pyramid')], pediment: true, dome: true, tag: 'baroque' },
  { re: /santa ana/, kind: 'church', wall: 0xe9d7a8, trim: 0xfbf6e8, roof: 0xb15a3a, nave: 10, towers: [T('R', 22, 3.8, 3, 'cupola')], tag: 'neoclassic' },
  { re: /iglesia del cristo/, kind: 'church', wall: 0xeee2c0, trim: 0xffffff, roof: 0xb15a3a, nave: 9, towers: [T('L', 20, 3.4, 3, 'cupola')], tag: 'neoclassic' },
  { re: /teatro principal/, kind: 'block', wall: 0xf3e9d2, trim: 0xc8573c, roof: 0xb15a3a, floors: 3, h: 15, portico: true },
  { re: /^gran hotel/, kind: 'block', wall: 0xeee2c4, trim: 0xffffff, roof: 0xa8a39a, floors: 5, h: 22, flat: true },
  { re: /^hotel plaza/, kind: 'block', wall: 0xeab0a2, trim: 0xfff0e0, roof: 0xb15a3a, floors: 3, h: 15 },
  { re: /palacio de pichardo/, kind: 'block', wall: 0xe8b27c, trim: 0xffffff, roof: 0xb15a3a, h: 7, tiled: true },
  { re: /palacio bernal/, kind: 'block', wall: 0xc9dcc2, trim: 0xffffff, roof: 0xb15a3a, h: 7, tiled: true },
  { re: /teatro avellaneda/, kind: 'block', wall: 0xf0dfc0, trim: 0xffffff, roof: 0xb15a3a, h: 11, portico: true },
  { re: /estacion trenes nacionales|antigua estacion de ferrocarriles/, kind: 'block', wall: 0xe8d9a8, trim: 0xffffff, roof: 0x8f5a48, h: 8, tiled: true },
  { re: /edificio lugare/, kind: 'block', wall: 0xe6dfcb, trim: 0xf5f1e6, roof: 0x9a968c, floors: 12, h: 44, flat: true },
];

// Edificios singulares que en OSM son relaciones (no se descargan con las celdas): se colocan por su huella real.
// lat/lon = centro, ang = eje u (grados, en x/z), L y W = tamaño sobre u y sobre su perpendicular.
export const FIXED = [
  { name: 'Iglesia Nuestra Señora de la Merced', lat: 21.382510, lon: -77.918140, ang: 70, L: 63, W: 75.5, style: { kind: 'church', wall: 0xf3f1ea, trim: 0x8b4a3a, roof: 0xa04c36, nave: 13, partial: 30, naveW: 9, towers: [T('C', 38, 4.3, 5, 'cupola')], pediment: true, dome: true } },
  { name: 'Gran Hotel', lat: 21.381840, lon: -77.917327, ang: 54, L: 34.2, W: 32.4, style: { kind: 'block', wall: 0xeee2c4, trim: 0xffffff, roof: 0xa8a39a, h: 24, flat: true } },
  { name: 'Hotel Colón', lat: 21.387328, lon: -77.916255, ang: 87, L: 28.5, W: 60.8, style: { kind: 'block', wall: 0xe9cf8e, trim: 0xffffff, roof: 0xa8a39a, h: 14, flat: true } },
  { name: 'Iglesia de San Juan de Dios', lat: 21.376000, lon: -77.917642, ang: 19, L: 43.4, W: 45.1, style: { kind: 'church', wall: 0xebd36e, trim: 0xfbf7ea, roof: 0xb15a3a, nave: 9, partial: 22, naveW: 7, towers: [T('R', 19, 3.0, 2, 'cupola')], cloister: 'arcade' } },
];

// Objetos de plaza: estatua ecuestre de Agramonte, tinajones, esculturas, bancos…
export const PROPS = [
  { type: 'statue', xz: P(21.37906, -77.91838) },
  // tinajones: la seña de identidad de la ciudad
  ...[[21.37598, -77.91762], [21.37590, -77.91748], [21.37603, -77.91748], [21.37586, -77.91765], [21.37995, -77.92338], [21.37982, -77.92352], [21.38003, -77.92364],
      [21.37912, -77.91853], [21.37900, -77.91823], [21.37919, -77.91826], [21.37898, -77.91850], [21.38322, -77.92246], [21.38234, -77.91868]].map(c => ({ type: 'jar', xz: P(c[0], c[1]) })),
  // esculturas de la Plaza del Carmen (mujeres conversando, de Martha Jiménez)
  ...[[21.37989, -77.92341], [21.37993, -77.92336], [21.37985, -77.92347], [21.37991, -77.92349], [21.37986, -77.92335]].map(c => ({ type: 'sculpture', xz: P(c[0], c[1]) })),
  // palmas reales que recuerdan a los patriotas fusilados en 1851 (Parque Agramonte)
  ...[[21.37926, -77.91856], [21.37926, -77.91820], [21.37890, -77.91856], [21.37890, -77.91820]].map(c => ({ type: 'royalpalm', xz: P(c[0], c[1]) })),
];

// Zonas de edificios multifamiliares de paneles prefabricados (microdistritos)
export const PREFAB_ZONES = [
  { xz: P(21.4015, -77.9440), r: 1300 },   // Microdistrito Ignacio Agramonte
  { xz: P(21.4026, -77.9433), r: 500 },    // Hotel Siboney y alrededores
  { xz: P(21.3935, -77.8900), r: 900 },    // Reparto Julio A. Mella / Universidad
];

// Distancia al centro histórico → zona de la ciudad
export function zoneAt(x, z) {
  const d = Math.hypot(x - CORE[0], z - CORE[1]);
  return d < 1000 ? 'core' : d < 2400 ? 'inner' : 'outer';
}
export function inPrefabZone(x, z) {
  for (const p of PREFAB_ZONES) if (Math.hypot(x - p.xz[0], z - p.xz[1]) < p.r) return true;
  return false;
}
export function nearestPlaza(x, z) {
  let best = null, bd = 1e12;
  for (const p of PLAZAS) { const d = Math.hypot(x - p.xz[0], z - p.xz[1]); if (d < bd) { bd = d; best = p; } }
  return best;
}
export const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
export function landmarkFor(name) {
  const n = norm(name); if (!n) return null;
  return LANDMARKS.find(l => l.re.test(n)) || null;
}

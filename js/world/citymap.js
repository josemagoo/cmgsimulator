// Plano de cada celda para el minimapa (como el radar de GTA): edificios, parques, plazas, agua y calles según su tipo.
// Se dibuja una vez en un lienzo al construir la celda; los nombres de las calles se ponen en vivo en el minimapa.
import { ll2xz } from '../geo.js';
import { Q } from '../config.js';

export const MAP_COLORS = {
  bg: '#1d2429', building: '#3c454c', park: '#2b4d30', square: '#6d6656', water: '#2a5a86',
  casing: '#11161a', primary: '#e3c45f', secondary: '#e8d48a', tertiary: '#e9e5d9', residential: '#c9c5bb', pedestrian: '#b5a789', footway: '#8e8a80', dirt: '#a5865d',
};
const ROAD_W = { motorway: 14, trunk: 12, primary: 11, secondary: 9, tertiary: 7.6, unclassified: 6, residential: 6, living_street: 5, pedestrian: 6, footway: 2, service: 4, track: 3 };

export function buildCellMap(c, bb, footprints, els, infos, squares) {
  const S = c.lite ? 256 : (Q.lowTex ? 512 : 1024), cv = document.createElement('canvas'); cv.width = cv.height = S;
  const g = cv.getContext('2d'), sx = S / (bb.maxx - bb.minx), sz = S / (bb.maxz - bb.minz);
  const X = x => (x - bb.minx) * sx, Z = z => (z - bb.minz) * sz;
  const poly = (pts, fill) => { g.beginPath(); pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); g.closePath(); g.fillStyle = fill; g.fill(); };
  // parques, bosques y agua
  for (const e of els || []) {
    const t = e.tags || {};
    if (e.type !== 'way' || !e.geometry) continue;
    const pts = () => e.geometry.map(p => ll2xz(p.lat, p.lon));
    if (t.leisure === 'park' || t.leisure === 'garden' || t.natural === 'wood' || t.landuse === 'forest') poly(pts(), '#2b4d30');
    else if (t.natural === 'water') poly(pts(), '#2a5a86');
    else if (t.waterway) {
      const P = pts(); g.beginPath(); P.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1]))));
      g.strokeStyle = '#2a5a86'; g.lineWidth = Math.max(2, (t.waterway === 'river' ? 14 : 5) * sx); g.lineCap = 'round'; g.stroke();
    }
  }
  for (const s of squares || []) poly(s.xz, s.k === 'paved' ? '#6d6656' : '#2b4d30');
  // edificios
  g.fillStyle = MAP_COLORS.building;
  for (const f of footprints) { g.beginPath(); f.pts.forEach((p, i) => (i ? g.lineTo(X(p[0]), Z(p[1])) : g.moveTo(X(p[0]), Z(p[1])))); g.closePath(); g.fill(); }
  // calles: primero el borde oscuro de todas y luego el relleno, de las menores a las mayores
  const rank = r => ({ footway: 0, pedestrian: 1, service: 1, track: 1, living_street: 2, residential: 2, unclassified: 2, tertiary: 3, secondary: 4, primary: 5, trunk: 6, motorway: 6 }[r.hw] || 2);
  const list = (infos || []).slice().sort((a, b) => rank(a) - rank(b));
  const line = (r, width, color) => {
    g.beginPath(); r.pts.forEach((p, i) => (i ? g.lineTo(X(p.x), Z(p.z)) : g.moveTo(X(p.x), Z(p.z))));
    g.strokeStyle = color; g.lineWidth = width; g.lineCap = 'round'; g.lineJoin = 'round'; g.stroke();
  };
  const fillOf = r => r.kind === 'dirt' ? MAP_COLORS.dirt : r.hw === 'footway' ? MAP_COLORS.footway : r.hw === 'pedestrian' ? MAP_COLORS.pedestrian
    : /primary|trunk|motorway/.test(r.hw) ? MAP_COLORS.primary : r.hw === 'secondary' ? MAP_COLORS.secondary : r.hw === 'tertiary' ? MAP_COLORS.tertiary : MAP_COLORS.residential;
  const widthOf = r => Math.max(r.hw === 'footway' ? 1 : 2.2, ((r.w || ROAD_W[r.hw] || 6) + (r.sw || 0) * 1.2) * sx * 1.25);
  for (const r of list) if (r.hw !== 'footway') line(r, widthOf(r) + 2.5, MAP_COLORS.casing);
  for (const r of list) line(r, widthOf(r), fillOf(r));
  return { cv, bb };
}

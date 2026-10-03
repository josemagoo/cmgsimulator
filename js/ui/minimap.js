// Minimapa tipo radar (norte arriba): plano de la ciudad con calles, edificios, parques y agua, nombres de las calles
// cercanas, lugares de interés, pistas, destino y tu vehículo. Teclas + / − para acercar o alejar.
import { $ } from '../util.js';
import { AIRPORTS, CITY_XZ } from '../config.js';
import { bearing } from '../geo.js';
import { MAP_COLORS } from '../world/citymap.js';

const CHURCH = /^(iglesia|catedral|templo|capilla|santuario|parroquia)/i, GREEN = /^(parque|plaza|plazuela|jard)/i;

export class Minimap {
  constructor() { this.cv = $('mm'); this.g = this.cv.getContext('2d'); this.zoom = 1; this.lastDist = ''; }
  zoomBy(f) { this.zoom = Math.min(8, Math.max(0.25, this.zoom * f)); }

  draw(game) {
    const g = this.g, W = this.cv.width, c = W / 2, R = c - 6, v = game.vehicle, world = game.world;
    const range = v.mapRange() * this.zoom, k = R / range, pos = v.pos, dest = game.progress.dest, px = W / (this.cv.clientWidth || 190);   // px: píxeles del lienzo por píxel de pantalla
    g.clearRect(0, 0, W, W);
    g.save();
    g.beginPath(); g.arc(c, c, R, 0, 7); g.fillStyle = MAP_COLORS.bg; g.globalAlpha = 0.88; g.fill(); g.globalAlpha = 1; g.clip();
    const tr = (x, z) => [c + (x - pos.x) * k, c + (z - pos.z) * k];
    const edge = (x, z) => { let [ex, ey] = tr(x, z); const d = Math.hypot(ex - c, ey - c); if (d > R - 14) { ex = c + (ex - c) / d * (R - 14); ey = c + (ey - c) / d * (R - 14); } return [ex, ey]; };
    // plano de la ciudad (celdas cargadas)
    for (const cell of world.osm.cells.values()) {
      const m = cell.map; if (!m) continue;
      const [x0, y0] = tr(m.bb.minx, m.bb.minz), [x1, y1] = tr(m.bb.maxx, m.bb.maxz);
      if (x1 < 0 || y1 < 0 || x0 > W || y0 > W) continue;
      g.drawImage(m.cv, x0, y0, x1 - x0, y1 - y0);
    }
    // pistas
    g.strokeStyle = '#ffb400'; g.lineWidth = Math.max(3, 60 * k);
    for (const r of world.airports.runways) {
      const a = tr(r.cx - r.ax * r.len / 2, r.cz - r.az * r.len / 2), b = tr(r.cx + r.ax * r.len / 2, r.cz + r.az * r.len / 2);
      g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(b[0], b[1]); g.stroke();
    }
    // nombres de las calles (de cerca)
    if (range < 1600) this.streetNames(g, world, pos, tr, c, R, px, k);
    // lugares de interés: iglesias con cruz, parques y plazas en verde, el resto con un punto
    if (range < 2500) {
      g.font = `bold ${Math.round(13 * px)}px "Segoe UI", Arial`; g.textAlign = 'center'; g.textBaseline = 'middle';
      for (const cell of world.osm.cells.values()) for (const s of cell.labels) {
        const [lx, ly] = tr(s.position.x, s.position.z); if (Math.hypot(lx - c, ly - c) > R - 8) continue;
        const n = s.userData.name || '';
        if (CHURCH.test(n)) { g.fillStyle = '#ffffff'; g.fillRect(lx - 1.2 * px, ly - 5 * px, 2.4 * px, 10 * px); g.fillRect(lx - 3.5 * px, ly - 2.5 * px, 7 * px, 2.2 * px); }
        else if (GREEN.test(n)) { g.fillStyle = '#7fd36a'; g.beginPath(); g.arc(lx, ly, 3.2 * px, 0, 7); g.fill(); }
        else { g.fillStyle = '#ffd56b'; g.beginPath(); g.arc(lx, ly, 2.6 * px, 0, 7); g.fill(); }
      }
    }
    // la ciudad y el destino (de lejos)
    if (range > 3000) {
      const [cx, cy] = edge(CITY_XZ[0], CITY_XZ[1]);
      g.fillStyle = '#5ec8ff'; g.beginPath(); g.arc(cx, cy, 8, 0, 7); g.fill();
      g.font = 'bold 20px sans-serif'; g.fillStyle = '#fff'; g.textAlign = 'left'; g.fillText('Camagüey', cx - 40, cy - 14);
    }
    if (dest >= 0) {
      const a = AIRPORTS[dest], [dx, dz] = world.airports.xz(a), [ex, ey] = edge(dx, dz);
      g.fillStyle = '#ffd23c'; g.beginPath(); g.moveTo(ex, ey - 12); g.lineTo(ex + 10, ey); g.lineTo(ex, ey + 12); g.lineTo(ex - 10, ey); g.closePath(); g.fill();
      g.textAlign = 'left'; g.font = 'bold 20px sans-serif'; g.fillStyle = '#fff'; g.fillText(a.name, ex - 40, ey - 18);
    }
    g.restore();
    // borde del radar
    g.beginPath(); g.arc(c, c, R, 0, 7); g.lineWidth = 3 * px; g.strokeStyle = 'rgba(0,0,0,.85)'; g.stroke();
    g.beginPath(); g.arc(c, c, R - 3 * px, 0, 7); g.lineWidth = 1.2 * px; g.strokeStyle = 'rgba(255,255,255,.25)'; g.stroke();
    // tu vehículo
    g.save(); g.translate(c, c); g.rotate(-v.yaw);
    g.fillStyle = '#ff4d4d'; g.strokeStyle = '#000'; g.lineWidth = 2;
    g.beginPath(); g.moveTo(0, -15); g.lineTo(10, 12); g.lineTo(0, 7); g.lineTo(-10, 12); g.closePath(); g.fill(); g.stroke();
    g.restore();
    g.fillStyle = '#fff'; g.font = 'bold 22px sans-serif'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.strokeStyle = '#000'; g.lineWidth = 4; g.strokeText('N', c, 26); g.fillText('N', c, 26);

    let t = `Pista ${(world.airports.nearestRunwayDist(pos) / 1000).toFixed(1)} km`;
    if (dest >= 0) {
      const a = AIRPORTS[dest], [dx, dz] = world.airports.xz(a), d = Math.hypot(dx - pos.x, dz - pos.z);
      t += `<br>➤ ${a.name}: ${d > 10000 ? Math.round(d / 1000) : (d / 1000).toFixed(1)} km · rumbo ${String(Math.round(bearing(dx - pos.x, dz - pos.z))).padStart(3, '0')}°`;
    }
    if (t !== this.lastDist) { this.lastDist = t; $('dist').innerHTML = t; }
  }

  // escribe el nombre de cada calle cercana a lo largo de su tramo visible más largo (una vez por nombre)
  streetNames(g, world, pos, tr, c, R, px, k) {
    const best = new Map(), reach = (R / k) * 1.1;
    for (const cell of world.osm.cells.values()) {
      if (!cell.roadInfos || cell.lite) continue;
      for (const r of cell.roadInfos) {
        if (!r.name || r.hw === 'footway') continue;
        for (let i = 0; i < r.pts.length - 1; i++) {
          const p = r.pts[i], q = r.pts[i + 1], mx = (p.x + q.x) / 2, mz = (p.z + q.z) / 2;
          const d = Math.hypot(mx - pos.x, mz - pos.z); if (d > reach) continue;
          const l = Math.hypot(q.x - p.x, q.z - p.z) * k;
          const [ax, ay] = tr(p.x, p.z), [bx, by] = tr(q.x, q.z);
          if (Math.hypot((ax + bx) / 2 - c, (ay + by) / 2 - c) > R - 16 * px) continue;
          const score = l - d * k * 0.15, o = best.get(r.name);
          if (!o || score > o.score) best.set(r.name, { score, ax, ay, bx, by, l, d, major: /primary|secondary|tertiary|pedestrian/.test(r.hw) });
        }
      }
    }
    const list = [...best.entries()].sort((a, b) => a[1].d - b[1].d).slice(0, 14);
    g.textAlign = 'center'; g.textBaseline = 'middle';
    for (const [name, o] of list) {
      const fs = Math.round((o.major ? 12.5 : 11) * px);
      g.font = `bold ${fs}px "Segoe UI", Arial`;
      const tw = g.measureText(name).width;
      if (tw > o.l * 1.6 + 40 * px) continue;                                   // tramo demasiado corto para el nombre
      let ang = Math.atan2(o.by - o.ay, o.bx - o.ax); if (ang > Math.PI / 2) ang -= Math.PI; else if (ang < -Math.PI / 2) ang += Math.PI;
      g.save(); g.translate((o.ax + o.bx) / 2, (o.ay + o.by) / 2); g.rotate(ang);
      g.lineWidth = 3.5 * px; g.strokeStyle = 'rgba(0,0,0,.9)'; g.strokeText(name, 0, 0);
      g.fillStyle = o.major ? '#ffe9a8' : '#ffffff'; g.fillText(name, 0, 0);
      g.restore();
    }
  }
}

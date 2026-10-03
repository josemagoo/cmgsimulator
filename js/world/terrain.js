// Relieve real (AWS Terrain Tiles, formato terrarium). La altura 0 es la pista de Camagüey.
import { clamp, smooth, env } from '../util.js';
import { xz2ll, lon2tx, lat2ty } from '../geo.js';
import { API, Q } from '../config.js';

const ZE = 12;

export class Terrain {
  constructor(world) {
    this.w = world;
    this.elev = new Map();
    this.ELEV0 = null;
  }

  loadElev(tx, ty) {
    const key = tx + ',' + ty;
    if (this.elev.has(key)) return this.elev.get(key).promise;
    const entry = { data: null };
    entry.promise = new Promise(res => {
      const img = new Image();
      if (!env.HTTP) img.crossOrigin = 'anonymous';
      img.onload = () => {
        const c = document.createElement('canvas'); c.width = c.height = 256;
        const g = c.getContext('2d'); g.drawImage(img, 0, 0);
        const px = g.getImageData(0, 0, 256, 256).data, d = new Float32Array(65536);
        for (let i = 0; i < 65536; i++) d[i] = px[i * 4] * 256 + px[i * 4 + 1] + px[i * 4 + 2] / 256 - 32768;
        entry.data = d; this.setElev0(); this.w.tiles.reliefAll(); res();
      };
      img.onerror = () => res();
      img.src = env.HTTP ? `${API.tile}?t=elev&z=${ZE}&x=${tx}&y=${ty}` : `https://s3.amazonaws.com/elevation-tiles-prod/terrarium/${ZE}/${tx}/${ty}.png`;
    });
    this.elev.set(key, entry);
    return entry.promise;
  }
  // descarga las teselas de relieve alrededor de una posición
  update(pos) {
    const [lat, lon] = xz2ll(pos.x, pos.z);
    const cx = Math.floor(lon2tx(lon, ZE)), cy = Math.floor(lat2ty(lat, ZE)), r = Q.elevRing;
    const p = this.loadElev(cx, cy);
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) this.loadElev(cx + dx, cy + dy);
    return p;
  }
  loadAt(lat, lon) { return this.loadElev(Math.floor(lon2tx(lon, ZE)), Math.floor(lat2ty(lat, ZE))); }

  raw(lat, lon) {
    const fx = lon2tx(lon, ZE), fy = lat2ty(lat, ZE), tx = Math.floor(fx), ty = Math.floor(fy);
    let e;
    if (this.lastE && this.lastTx === tx && this.lastTy === ty) e = this.lastE;        // casi siempre es la misma tesela
    else { e = this.elev.get(tx + ',' + ty); if (e && e.data) { this.lastE = e; this.lastTx = tx; this.lastTy = ty; } }
    if (!e || !e.data) return null;
    const px = clamp((fx - tx) * 256 - 0.5, 0, 255), py = clamp((fy - ty) * 256 - 0.5, 0, 255);
    const x0 = Math.floor(px), y0 = Math.floor(py), x1 = Math.min(255, x0 + 1), y1 = Math.min(255, y0 + 1), ux = px - x0, uy = py - y0, d = e.data;
    return (d[y0 * 256 + x0] * (1 - ux) + d[y0 * 256 + x1] * ux) * (1 - uy) + (d[y1 * 256 + x0] * (1 - ux) + d[y1 * 256 + x1] * ux) * uy;
  }

  // La pista de Camagüey define la altura 0; las de otras ciudades guardan su altura relativa
  setElev0() {
    const ap = this.w.airports;
    if (this.ELEV0 === null) {
      const r = ap.home, [la, lo] = xz2ll(r.cx, r.cz), e = this.raw(la, lo);
      if (e === null) return;
      this.ELEV0 = e;
    }
    for (const r of ap.runways) if (r.eRaw !== undefined) { r.elevRel = r.eRaw - this.ELEV0; if (r.group) r.group.position.y = r.elevRel; }
  }

  // Altura del terreno (m); alrededor de cada pista se aplana para que coincida con el dibujo 3D
  h(x, z) {
    if (this.ELEV0 === null) return 0;
    const [lat, lon] = xz2ll(x, z), e = this.raw(lat, lon);
    if (e === null) return 0;
    let best = null, bd = 1e9;
    for (const r of this.w.airports.runways) {
      const dx = x - r.cx, dz = z - r.cz, far = r.len / 2 + 1550;
      if (dx * dx + dz * dz > far * far) continue;                      // lejos de esta pista: no la aplana
      const along = dx * r.ax + dz * r.az, lateral = -dx * r.az + dz * r.ax, half = r.len / 2 + 150;
      const d = Math.hypot(along - clamp(along, -half, half), lateral);
      if (d < bd) { bd = d; best = r; }
    }
    const h = e - this.ELEV0;
    if (!best || bd > 1350) return h;
    const f = smooth((bd - 350) / 1000);
    return best.elevRel * (1 - f) + h * f;
  }

  // Pendiente del terreno por delante de una posición y rumbo
  slopeAhead(pos, yaw, dist) {
    const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
    return (this.h(pos.x + fx * dist, pos.z + fz * dist) - this.h(pos.x, pos.z)) / dist;
  }
}

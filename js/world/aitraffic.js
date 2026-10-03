// Aviones que despegan, vuelan el circuito de tráfico y aterrizan solos en los aeropuertos cercanos.
// No chocan con el jugador: dan vida al aeropuerto y sirven de referencia para el circuito.
import { wrapPi, clamp } from '../util.js';
import { Q } from '../config.js';
import { PLANE_SPECS, buildPlaneModel } from '../vehicles/planeModels.js';

const TYPES = [PLANE_SPECS[0], PLANE_SPECS[1], PLANE_SPECS[0]];

// Circuito a la izquierda: despegue por el sentido +a de la pista, viento cruzado, viento en cola, base, final y aterrizaje
function buildPath(r) {
  const a = { x: r.ax, z: r.az }, L = { x: r.az, z: -r.ax }, len = r.len;
  const A = { x: r.cx - a.x * len / 2, z: r.cz - a.z * len / 2 };
  const P = (along, lat, y) => ({ x: A.x + a.x * along + L.x * lat, z: A.z + a.z * along + L.z * lat, y: r.elevRel + y });
  const ctl = [
    [P(40, 0, 0), 0], [P(250, 0, 0), 14], [P(700, 0, 0), 30], [P(len * 0.8, 0, 8), 36],
    [P(len + 700, 0, 120), 40], [P(len + 1500, 450, 230), 42], [P(len + 1500, 1200, 300), 44],
    [P(len * 0.6, 1600, 320), 44], [P(-600, 1600, 300), 44], [P(-1500, 1200, 250), 42], [P(-2200, 450, 190), 40],
    [P(-2600, 0, 150), 38], [P(-1500, 0, 95), 36], [P(-600, 0, 38), 34], [P(60, 0, 9), 32],
    [P(380, 0, 0.4), 30], [P(900, 0, 0), 18], [P(1500, 0, 0), 4], [P(1700, 0, 0), 0],
  ];
  const curve = new THREE.CatmullRomCurve3(ctl.map(c => new THREE.Vector3(c[0].x, c[0].y, c[0].z)), false, 'centripetal');
  const N = 600, pts = curve.getSpacedPoints(N);
  const cum = [0]; for (let i = 1; i < ctl.length; i++) cum.push(cum[i - 1] + Math.hypot(ctl[i][0].x - ctl[i - 1][0].x, ctl[i][0].z - ctl[i - 1][0].z) + Math.abs(ctl[i][0].y - ctl[i - 1][0].y));
  let total = 0; for (let i = 1; i < pts.length; i++) total += pts[i].distanceTo(pts[i - 1]);
  const speeds = pts.map((_, k) => {                         // velocidad según el tramo (aprox. por distancia entre puntos de control)
    const d = k / N * cum[cum.length - 1]; let i = 1; while (i < cum.length - 1 && cum[i] < d) i++;
    const u = clamp((d - cum[i - 1]) / ((cum[i] - cum[i - 1]) || 1), 0, 1);
    return ctl[i - 1][1] + (ctl[i][1] - ctl[i - 1][1]) * u;
  });
  return { pts, speeds, total, step: total / N };
}

export class AiTraffic {
  constructor(world) { this.w = world; this.list = []; this.paths = new Map(); }

  spawnFor(r) {
    if (this.paths.has(r)) return;
    this.paths.set(r, buildPath(r));
    const n = r === this.w.airports.home ? Math.min(2, Q.aiPlanes) : 1;
    for (let i = 0; i < n; i++) {
      if (this.list.length >= Q.aiPlanes) return;
      const spec = TYPES[this.list.length % TYPES.length], M = buildPlaneModel(spec);
      M.group.visible = false; this.w.game.scene.add(M.group);
      const path = this.paths.get(r);
      this.list.push({ r, M, path, s: i === 0 ? 0 : path.total * 0.45, wait: 4 + Math.random() * 14, yaw: 0 });
    }
  }

  update(dt, now, player) {
    for (const r of this.w.airports.runways) if (!r.approx && !this.paths.has(r) && Math.hypot(r.cx - player.x, r.cz - player.z) < 25000) this.spawnFor(r);
    for (const ai of this.list) {
      const { path, M } = ai, c = path.pts[0];
      const far = Math.hypot(c.x - player.x, c.z - player.z);
      M.group.visible = far < 12000;
      if (far > 25000) continue;
      if (ai.wait > 0) { ai.wait -= dt; }
      else {
        const k = clamp(ai.s / path.step, 0, path.pts.length - 2), i = Math.floor(k);
        ai.s += Math.max(path.speeds[i], 0.5) * dt;
        if (ai.s >= path.total - 2) { ai.s = 0; ai.wait = 10 + Math.random() * 25; }
      }
      const k = clamp(ai.s / path.step, 0, path.pts.length - 2), i = Math.floor(k), f = k - i;
      const p0 = path.pts[i], p1 = path.pts[i + 1], p2 = path.pts[Math.min(i + 4, path.pts.length - 1)];
      const g = M.group;
      g.position.set(p0.x + (p1.x - p0.x) * f, p0.y + (p1.y - p0.y) * f, p0.z + (p1.z - p0.z) * f);
      const dx = p1.x - p0.x, dz = p1.z - p0.z, hl = Math.hypot(dx, dz) || 1;
      const yaw = Math.atan2(-dx, -dz), yaw2 = Math.atan2(-(p2.x - p1.x), -(p2.z - p1.z));
      g.rotation.order = 'YXZ';
      const sp = Math.max(path.speeds[i], 5);
      g.rotation.set(Math.atan2(p1.y - p0.y, hl) * (ai.wait > 0 ? 0 : 1), yaw, ai.wait > 0 ? 0 : clamp(wrapPi(yaw2 - yaw) * sp * 0.012, -0.6, 0.6));
      for (const pr of M.props) pr.rotation.z += (14 + (ai.wait > 0 ? 0 : 55)) * dt;
      const night = this.w.sky.nightLevel;
      M.navL.material.opacity = M.navR.material.opacity = 0.35 + 0.65 * night;
      M.navT.material.opacity = (0.35 + 0.65 * night) * (Math.sin(now * 0.008 + ai.r.cx) > 0.6 ? 1 : 0.1);
    }
  }
}

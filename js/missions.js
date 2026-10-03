// Misiones: objetivos con puntuación (recorrido turístico, aros, aterrizaje de precisión, vuelo a una ciudad,
// entrega en helicóptero y puntos de control en auto). Se eligen en el menú antes de empezar.
import { clamp, store } from './util.js';
import { AIRPORTS } from './config.js';

export const MISSIONS = [
  { id: 'tour', icon: '📍', name: 'Recorrido turístico', desc: 'Pasa cerca de 5 lugares con nombre (4 en helicóptero y auto).', cats: ['plane', 'heli', 'car'] },
  { id: 'rings', icon: '⭕', name: 'Aros', desc: 'Atraviesa 8 aros en el aire lo más rápido que puedas.', cats: ['plane', 'heli'] },
  { id: 'precision', icon: '🎯', name: 'Aterrizaje de precisión', desc: 'Aterriza en una pista lo más cerca posible del punto de toma.', cats: ['plane'] },
  { id: 'flight', icon: '🛫', name: 'Vuelo a otra ciudad', desc: 'Vuela y aterriza en tu destino (o en el desbloqueado más cercano).', cats: ['plane', 'heli'] },
  { id: 'delivery', icon: '📦', name: 'Entrega', desc: 'Recoge una carga aterrizando en el punto naranja y entrégala en el verde.', cats: ['heli'] },
  { id: 'checkpoints', icon: '🏁', name: 'Puntos de control', desc: 'Conduce por 5 puntos de control antes de que se acabe el tiempo.', cats: ['car'] },
];
export const missionsFor = cat => MISSIONS.filter(m => m.cats.includes(cat));
const fmt = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

// Columna de luz + anillo en el suelo para marcar un punto
function beacon(scene, color, r = 8) {
  const g = new THREE.Group();
  const mat = (o) => new THREE.MeshBasicMaterial({ color, transparent: true, opacity: o, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false, fog: false });
  const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, 200, 20, 1, true), mat(0.25)); cyl.position.y = 100;
  const ring = new THREE.Mesh(new THREE.RingGeometry(r * 1.2, r * 1.6, 32), mat(0.7)); ring.rotation.x = -Math.PI / 2; ring.position.y = 0.5;
  g.add(cyl, ring); g.renderOrder = 6; scene.add(g); return g;
}
function dispose(scene, o) { scene.remove(o); o.traverse(c => { if (c.geometry) c.geometry.dispose(); if (c.material) c.material.dispose(); }); }

export class Missions {
  constructor(game) {
    this.game = game; this.cur = null; this.objs = []; this.endT = 0;
    game.bus.on('landed', d => this.cur && this.cur.onLanded && this.cur.onLanded(d));
    game.bus.on('crash', () => this.cur && this.cur.state === 'run' && this.finish('failed', 0, '¡Te estrellaste!'));
  }

  begin(id) {
    this.clear();
    if (!id) return;
    const def = MISSIONS.find(m => m.id === id), v = this.game.vehicle;
    if (!def || !def.cats.includes(v.spec.category)) return;
    this.cur = { def, id, t: 0, state: 'run', score: 0, info: '', targets: 0, got: 0, seen: new Set() };
    this.setup();
    this.game.hud.toast(`<b>${def.name}</b><br>${def.desc}`, def.icon);
  }
  onRespawn() { if (this.cur) { const id = this.cur.id; this.begin(id); } }
  clear() { for (const o of this.objs) dispose(this.game.scene, o); this.objs = []; this.cur = null; }
  add(o) { this.objs.push(o); return o; }

  // ---- preparación de cada misión ----
  setup() {
    const g = this.game, m = this.cur, v = g.vehicle, w = g.world, cat = v.spec.category, sc = g.scene;
    const th = (x, z) => w.terrainH(x, z);
    if (m.id === 'tour') m.targets = cat === 'plane' ? 5 : 4;
    if (m.id === 'rings') {                                       // aros en una trayectoria suave delante del jugador
      const heli = cat === 'heli', n = 8, step = heli ? 380 : 800, R = heli ? 20 : 34;
      let ang = -v.yaw, x = v.pos.x, z = v.pos.z, len = 0; m.rings = [];
      for (let i = 0; i < n; i++) {
        ang += (Math.random() - 0.5) * 0.8;
        const nx = x + Math.sin(ang) * step * (i === 0 ? 1.4 : 1), nz = z - Math.cos(ang) * step * (i === 0 ? 1.4 : 1);
        len += Math.hypot(nx - x, nz - z); x = nx; z = nz;
        const y = th(x, z) + (heli ? 45 + Math.random() * 40 : 110 + Math.random() * 110);
        const ring = this.add(new THREE.Mesh(new THREE.TorusGeometry(R, R * 0.06, 10, 40), new THREE.MeshBasicMaterial({ color: 0xffc93c, fog: false, depthWrite: false, transparent: true, opacity: 0.9 })));
        ring.position.set(x, y, z); ring.lookAt(x + Math.sin(ang), y, z - Math.cos(ang)); ring.visible = i < 2; sc.add(ring); ring.renderOrder = 6;
        m.rings.push({ mesh: ring, R });
      }
      m.targets = n; m.limit = len / (heli ? 28 : 55) + 45;
    }
    if (m.id === 'precision') {
      for (const r of w.airports.runways) for (const dir of [1, -1]) {
        const k = -r.len / 2 + 300, ax = r.cx + dir * r.ax * k, az = r.cz + dir * r.az * k;
        const b = this.add(beacon(sc, 0xffffff, 12)); b.position.set(ax, r.elevRel, az);
      }
      m.targets = 1;
    }
    if (m.id === 'flight') {
      const P = g.progress, un = P.unlockedCount();
      let idx = P.dest > 0 ? P.dest : -1;
      if (idx < 0) { let bd = 1e12; for (let i = 1; i < un; i++) { const a = AIRPORTS[i], d = Math.hypot(a.x - v.pos.x, a.z - v.pos.z); if (d < bd) { bd = d; idx = i; } } }
      P.setDest(idx); m.target = AIRPORTS[idx]; m.targets = 1;
      m.beacon = this.add(beacon(sc, 0x55ff88, 40));
    }
    if (m.id === 'delivery') {
      const pick = (cx, cz, minR, maxR) => {                      // un punto de aterrizaje libre de edificios
        for (let i = 0; i < 30; i++) {
          const a = Math.random() * Math.PI * 2, r = minR + Math.random() * (maxR - minR), x = cx + Math.cos(a) * r, z = cz + Math.sin(a) * r;
          if (!w.hitsBuilding({ x, y: th(x, z) + 2, z })) return { x, z };
        }
        return { x: cx + minR, z: cz };
      };
      m.A = pick(v.pos.x, v.pos.z, 900, 1500); m.B = pick(m.A.x, m.A.z, 1400, 2200); m.phase = 0; m.hold = 0; m.targets = 2;
      m.bA = this.add(beacon(sc, 0xffa030, 14)); m.bB = this.add(beacon(sc, 0x55ff88, 14)); m.bB.visible = false;
      m.bA.position.set(m.A.x, th(m.A.x, m.A.z), m.A.z); m.bB.position.set(m.B.x, th(m.B.x, m.B.z), m.B.z);
      m.limit = (Math.hypot(m.A.x - v.pos.x, m.A.z - v.pos.z) + Math.hypot(m.B.x - m.A.x, m.B.z - m.A.z)) / 25 + 90;
    }
    if (m.id === 'checkpoints') {
      m.cps = []; let x = v.pos.x, z = v.pos.z, len = 0;
      for (let i = 0; i < 5; i++) {
        let best = null;
        for (let k = 0; k < 14 && !best; k++) {                   // puntos sobre calles reales cargadas
          const a = Math.random() * Math.PI * 2, d = 350 + Math.random() * 450;
          best = w.osm.nearestRoad(x + Math.cos(a) * d, z + Math.sin(a) * d, 120);
        }
        if (!best) best = { x: x + 300, z };
        len += Math.hypot(best.x - x, best.z - z); x = best.x; z = best.z; m.cps.push({ x, z });
      }
      m.targets = 5; m.limit = len / 7 + 50;
      m.beacon = this.add(beacon(sc, 0x33ccff, 9)); this.placeCp();
    }
  }
  placeCp() { const m = this.cur, c = m.cps[m.got]; if (c) m.beacon.position.set(c.x, this.game.world.terrainH(c.x, c.z), c.z); }

  // ---- seguimiento ----
  update(dt) {
    const m = this.cur; if (!m) return;
    if (m.state !== 'run') { this.endT -= dt; if (this.endT <= 0) this.clear(); return; }
    const g = this.game, v = g.vehicle, w = g.world, cat = v.spec.category;
    m.t += dt;
    if (m.limit && m.t > m.limit) return this.finish('failed', 0, 'Se acabó el tiempo');
    const near = (x, z) => Math.hypot(v.pos.x - x, v.pos.z - z);

    if (m.id === 'tour') {
      const reach = cat === 'plane' ? 260 : cat === 'heli' ? 180 : 70;
      for (const c of w.osm.cells.values()) for (const s of c.labels) {
        const nm = s.userData.name;
        if (m.seen.has(nm) || near(s.position.x, s.position.z) > reach || (cat === 'plane' && v.agl > 700)) continue;
        m.seen.add(nm); m.got = m.seen.size; m.info = nm; g.sound.beep(1200, 0.12, 0.08); g.hud.toast(`<b>${nm}</b><br>${m.got}/${m.targets}`, '📍');
        if (m.got >= m.targets) return this.finish('done', 150 * m.targets + Math.max(0, 500 - m.t * 3));
      }
    }
    if (m.id === 'rings') {
      const r = m.rings[m.got];
      if (r && Math.hypot(v.pos.x - r.mesh.position.x, v.pos.y - r.mesh.position.y, v.pos.z - r.mesh.position.z) < r.R * 1.15) {
        r.mesh.visible = false; m.got++; g.sound.chime(); if (m.rings[m.got + 1]) m.rings[m.got + 1].mesh.visible = true;
        if (m.got >= m.targets) return this.finish('done', 100 * m.targets + Math.max(0, (m.limit - m.t) * 6));
      }
      if (r) { r.mesh.material.opacity = 0.65 + 0.3 * Math.sin(performance.now() * 0.006); r.mesh.scale.setScalar(1 + 0.04 * Math.sin(performance.now() * 0.006)); }
    }
    if (m.id === 'flight') {
      const [tx, tz] = w.airports.xz(m.target);
      m.beacon.position.set(tx, w.terrainH(tx, tz), tz); m.dist = near(tx, tz);
    }
    if (m.id === 'delivery') {
      const T = m.phase === 0 ? m.A : m.B, d = near(T.x, T.z);
      m.dist = d;
      if (d < 30 && v.onGround && v.speed < 1.5) {
        m.hold += dt;
        if (m.hold > 1.6) {
          m.hold = 0; m.phase++; g.sound.chime(); m.got = m.phase;
          if (m.phase === 1) { m.bA.visible = false; m.bB.visible = true; g.hud.msg('📦 Carga recogida: llévala al punto verde', 4); }
          else return this.finish('done', 600 + Math.max(0, (m.limit - m.t) * 4));
        }
      } else m.hold = 0;
    }
    if (m.id === 'checkpoints') {
      const c = m.cps[m.got]; m.dist = c ? near(c.x, c.z) : 0;
      if (c && m.dist < 16) {
        m.got++; g.sound.chime();
        if (m.got >= m.targets) return this.finish('done', 120 * m.targets + Math.max(0, (m.limit - m.t) * 4));
        this.placeCp();
      }
    }
  }
  onLanded(d) {
    const m = this.cur; if (!m || m.state !== 'run') return;
    if (m.id === 'precision' && d.runway && d.landing) {
      const e = Math.abs(d.landing.long), l = Math.abs(d.landing.lat);
      this.finish('done', Math.max(100, 1000 - e * 2 - l * 8) + d.stars * 150, `A ${Math.round(e)} m del punto de toma`);
    }
    if (m.id === 'flight' && d.runway && d.runway.apId === m.target.id) {
      this.finish('done', 800 + d.stars * 200 + Math.max(0, 600 - m.t / 60 * 20), `Llegaste a ${m.target.name}`);
    }
  }

  finish(state, score, note = '') {
    const m = this.cur; if (!m || m.state !== 'run') return;
    m.state = state; m.score = Math.round(score); this.endT = 7;
    const g = this.game;
    if (state === 'done') {
      const best = store.get('best', {}); const prev = best[m.id] || 0;
      if (m.score > prev) { best[m.id] = m.score; store.set('best', best); store.set('points', store.get('points', 0) + (m.score - prev)); }
      g.sound.chime(); g.haptic(80);
      g.hud.msg(`✅ ${m.def.name} completada · ${m.score} puntos${m.score > prev ? ' · ¡nuevo récord!' : ''}${note ? ' — ' + note : ''}`, 7);
      g.bus.emit('mission', { id: m.id, score: m.score, vehicle: g.vehicle });
    } else {
      g.hud.msg(`❌ ${m.def.name}: ${note}`, 5);
    }
  }

  hudHTML() {
    const m = this.cur; if (!m) return '';
    const name = `${m.def.icon} <b>${m.def.name}</b>`;
    if (m.state === 'done') return `${name}<small>✅ ${m.score} puntos</small>`;
    if (m.state === 'failed') return `${name}<small>❌ fallida</small>`;
    const time = m.limit ? `⏱ ${fmt(Math.max(0, m.limit - m.t))}` : `⏱ ${fmt(m.t)}`;
    const km = d => d > 1500 ? (d / 1000).toFixed(1) + ' km' : Math.round(d) + ' m';
    let line = '';
    if (m.id === 'tour') line = `${m.got}/${m.targets} lugares${m.info ? ' · último: ' + m.info : ''}`;
    if (m.id === 'rings') line = `aros ${m.got}/${m.targets}`;
    if (m.id === 'precision') line = 'aterriza cerca del círculo blanco';
    if (m.id === 'flight') line = `${m.target.name}${m.dist ? ' · ' + km(m.dist) : ''}`;
    if (m.id === 'delivery') line = `${m.phase === 0 ? '📦 recoger (naranja)' : '📍 entregar (verde)'}${m.dist ? ' · ' + km(m.dist) : ''}${m.hold > 0 ? ' · cargando…' : ''}`;
    if (m.id === 'checkpoints') line = `control ${Math.min(m.got + 1, m.targets)}/${m.targets}${m.dist ? ' · ' + km(m.dist) : ''}`;
    return `${name} · ${time}<small>${line}</small>`;
  }
}

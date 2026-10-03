// Indicadores en pantalla: velocidad, altura, instrumentos, mensajes, avisos, misión y logros
import { $, env } from '../util.js';
import { settings } from '../settings.js';
import { InstrumentPanel } from './instruments.js';

export class HUD {
  constructor(game) {
    this.game = game; this.timer = 0; this.clock = '';
    this.rows = { alt: $('altRow'), vs: $('vsRow'), thr: $('thrRow'), mach: $('machBox'), gear: $('gearBox') };
    this.bar = $('bar').firstElementChild;
    this.panel = new InstrumentPanel($('instr'));
    this.fpsAcc = 0; this.fpsN = 0;
    this.cache = new Map(); this.instrT = 0;
  }
  // escribe en la página solo si el texto cambió (tocar el DOM en cada fotograma cuesta)
  txt(id, v) { v = String(v); if (this.cache.get(id) === v) return; this.cache.set(id, v); $(id).textContent = v; }
  vis(el, on) { if (el._on === on) return; el._on = on; el.style.display = on ? '' : 'none'; }
  msg(text, secs = 0) { const m = $('msg'); m.textContent = text; m.style.opacity = text ? 1 : 0; this.timer = secs; }
  setClock(t) { if (t !== this.clock) { this.clock = t; $('clock').textContent = t; $('mmClock').textContent = t; } }     // en el móvil la hora va bajo el radar
  toast(text, icon = '🏆') {
    const d = document.createElement('div'); d.className = 'toast'; d.innerHTML = `<span>${icon}</span><div>${text}</div>`;
    $('toasts').appendChild(d); setTimeout(() => d.classList.add('out'), 4200); setTimeout(() => d.remove(), 4800);
  }

  update(dt) {
    const g = this.game, v = g.vehicle, h = v.hud(), show = (el, on) => this.vis(el, on), T = (id, x) => this.txt(id, x);
    if (this.timer > 0 && (this.timer -= dt) <= 0) this.msg('');
    T('pname', h.name);
    T('weaponStatus', g.state.flying ? g.weapons.status() : '');
    T('spd', Math.round(h.speedKmh));
    show(this.rows.mach, h.mach !== undefined); if (h.mach !== undefined) T('mach', h.mach.toFixed(2));
    show(this.rows.alt, h.alt !== undefined); if (h.alt !== undefined) T('alt', Math.round(h.alt));
    show(this.rows.vs, h.vs !== undefined); if (h.vs !== undefined) T('vs', h.vs.toFixed(1));
    show(this.rows.thr, h.thr !== undefined);
    if (h.thr !== undefined) { const tp = Math.round(h.thr * 100); T('thr', tp); if (this.barW !== tp) { this.barW = tp; this.bar.style.width = tp + '%'; } }
    show(this.rows.gear, h.gear !== undefined); if (h.gear !== undefined) T('gear', h.gear);
    T('hdg', String(h.hdg).padStart(3, '0'));
    const w = g.world.weather;
    T('xtra', [h.extra, h.damage !== undefined ? `daño ${Math.round(h.damage)}%` : '', w ? (w.label + (h.wind && h.wind.speed > 0.5 ? ` · 💨 ${Math.round(h.wind.speed * 3.6)} km/h` : '')) : ''].filter(Boolean).join(' · '));

    // consejos y avisos
    T('hint', g.state.flying && !v.crashed ? v.hint() : '');
    let wn = '';
    if (!env.HTTP) wn = 'Abre el juego desde un servidor (http://…), no con doble clic, para cargar el mapa real';
    else if (g.ready && g.world.tiles.stat.ok === 0 && g.world.tiles.stat.fail > 5) wn = 'No se pudo cargar el mapa satelital (revisa tu conexión a internet)';
    else if (g.world.airports.home.approx) wn = 'No se pudo obtener la pista real: se usa una pista aproximada';
    T('warn', wn);

    // instrumentos en pantalla
    const st = g.state.flying && settings.instruments && !(g.rig.cockpit && !v.crashed) ? v.instr(g.world) : null;   // en cabina se usa el tablero 3D
    const cv = $('instr');
    this.vis(cv, !!st);
    if (st && (this.instrT += dt) > 1 / 30) { this.instrT = 0; this.panel.draw(st); }      // los instrumentos se redibujan a 30 fps

    // misión y contador de fotogramas
    const mp = $('mission'), mh = g.state.flying && g.missions ? g.missions.hudHTML() : '';
    if (mp.innerHTML !== mh) mp.innerHTML = mh;
    this.vis(mp, !!mh);
    if (settings.fps) {
      this.fpsAcc += dt; this.fpsN++;
      if (this.fpsAcc > 0.5) { T('fps', Math.round(this.fpsN / this.fpsAcc) + ' fps · ' + g.renderer.info.render.calls + ' draws · ' + Math.round(g.renderer.info.render.triangles / 1000) + 'k tri'); this.fpsAcc = 0; this.fpsN = 0; }
    } else T('fps', '');
  }
}

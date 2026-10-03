// Entrada unificada: teclado, ratón/táctil sobre el lienzo (cámara) y controles virtuales.
// Los vehículos solo leen esta clase; no saben si el jugador usa teclado o pantalla táctil.
import { clamp } from './util.js';

const ACTION_KEYS = {
  KeyR: 'reset', KeyC: 'camera', KeyF: 'warp', KeyM: 'sound', KeyK: 'shadows', KeyL: 'light',
  KeyT: 'timeUp', KeyY: 'timeDown', KeyN: 'timeAuto', KeyH: 'help', KeyP: 'menu',
  KeyG: 'gear', KeyV: 'flaps', KeyX: 'assist', KeyI: 'instr', KeyO: 'settings', KeyZ: 'weather',
  Equal: 'mapIn', NumpadAdd: 'mapIn', Minus: 'mapOut', NumpadSubtract: 'mapOut', BracketRight: 'mapIn', Slash: 'mapOut',
};
const PREVENT = ['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Tab'];

export class Input {
  constructor(canvas) {
    this.keys = {};                       // estado de teclas (los botones táctiles también las activan)
    this.stick = { x: 0, y: 0 };          // palanca combinada (táctil + mando): x derecha +, y abajo + (tirar hacia atrás)
    this.touch = { x: 0, y: 0 };          // palanca de la pantalla táctil
    this.trigger = 0;                     // gatillos del mando: derecho (+) acelera, izquierdo (−) frena
    this.padHeld = {};                    // botones del mando que equivalen a teclas mantenidas (p. ej. Space)
    this.pad = { on: false }; this.prev = {};
    this.menuOpen = () => false;
    this.throttleSlider = null;           // 0..1 si el jugador usa el deslizador de gases
    this.orbit = { yaw: 0, pitch: 0, zoom: 1, drag: false, last: 0 };   // cámara libre
    this.handlers = {};
    this.keyHandlers = [];                // menús que quieren las teclas antes que el juego
    this.pointers = new Map(); this.pinch = 0;

    addEventListener('keydown', e => {
      this.keys[e.code] = true;
      if (PREVENT.includes(e.code)) e.preventDefault();
      let used = false;
      for (const h of this.keyHandlers) if (h(e)) { used = true; break; }
      if (!used && !e.repeat && ACTION_KEYS[e.code]) this.emit(ACTION_KEYS[e.code]);
      this.emit('anykey');
    });
    addEventListener('keyup', e => { this.keys[e.code] = false; });
    addEventListener('blur', () => { for (const k in this.keys) this.keys[k] = false; });

    addEventListener('gamepadconnected', () => this.emit('pad', true));
    addEventListener('gamepaddisconnected', () => this.emit('pad', false));

    canvas.style.touchAction = 'none';
    canvas.addEventListener('contextmenu', e => e.preventDefault());
    canvas.addEventListener('pointerdown', e => {
      this.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
      this.orbit.drag = true; this.orbit.last = performance.now();
      try { canvas.setPointerCapture(e.pointerId); } catch (err) { /* ok */ }
      this.emit('anykey');
    });
    canvas.addEventListener('pointermove', e => {
      const p = this.pointers.get(e.pointerId); if (!p) return;
      const o = this.orbit, k = e.pointerType === 'touch' ? 1.4 : 1;
      if (this.pointers.size >= 2) {                       // pellizco: zoom
        const [a, b] = [...this.pointers.values()];
        const d0 = Math.hypot(a.x - b.x, a.y - b.y);
        p.x = e.clientX; p.y = e.clientY;
        const d1 = Math.hypot(a.x - b.x, a.y - b.y);
        if (d0 > 0 && d1 > 0) o.zoom = clamp(o.zoom * d0 / d1, 0.4, 4);
      } else {                                              // arrastrar: orbitar
        o.yaw -= (e.clientX - p.x) * 0.006 * k;
        o.pitch = clamp(o.pitch + (e.clientY - p.y) * 0.005 * k, -0.4, 1.3);
        p.x = e.clientX; p.y = e.clientY;
      }
      o.last = performance.now();
    });
    const end = e => { this.pointers.delete(e.pointerId); if (!this.pointers.size) this.orbit.drag = false; this.orbit.last = performance.now(); };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    canvas.addEventListener('wheel', e => { e.preventDefault(); this.orbit.zoom = clamp(this.orbit.zoom * Math.exp(e.deltaY * 0.001), 0.4, 4); }, { passive: false });
    canvas.addEventListener('dblclick', () => { const o = this.orbit; o.yaw = o.pitch = 0; o.zoom = 1; });
  }
  on(name, fn) { (this.handlers[name] = this.handlers[name] || []).push(fn); }
  emit(name, ...a) { for (const f of this.handlers[name] || []) f(...a); }
  down(...codes) { return codes.some(c => this.keys[c] || this.padHeld[c]); }
  // Eje -1..1: teclas negativas, teclas positivas y un valor analógico opcional (palanca)
  axis(neg, pos, analog = 0) { return clamp((this.down(...pos) ? 1 : 0) - (this.down(...neg) ? 1 : 0) + analog, -1, 1); }
  // Mando (Xbox 360 / One / genérico con mapeo estándar). Se llama cada fotograma.
  //   Palanca izq.: inclinar/cabecear o conducir · Gatillos: acelerar / frenar · A: freno · Palanca der.: mirar
  //   Y: cámara · X: luces · B: crucero rápido · Back: reiniciar · LB/RB: hora · Start: menú
  //   Cruceta: ↑ asistencia de aterrizaje · ↓ tren · → flaps · ← instrumentos
  //   En el menú: cruceta o palanca izq. para elegir, A empezar, B cerrar, LB/RB cambiar de pestaña
  poll(dt, now) {
    const pads = navigator.getGamepads ? navigator.getGamepads() : [];
    let p = null; for (const g of pads) if (g && g.connected && this.padUsable(g)) { p = g; break; }
    this.pad.on = !!p;
    if (!p) {
      this.stick.x = this.touch.x; this.stick.y = this.touch.y; this.trigger = 0; this.padHeld.Space = false;
      return;
    }
    const dz = v => { const a = Math.abs(v); return a < 0.15 ? 0 : Math.sign(v) * Math.pow((a - 0.15) / 0.85, 1.4); };
    const ax = p.axes, lx = dz(ax[0] || 0), ly = dz(ax[1] || 0), rx = dz(ax[2] || 0), ry = dz(ax[3] || 0);
    const b = i => !!(p.buttons[i] && p.buttons[i].pressed), v = i => (p.buttons[i] ? p.buttons[i].value : 0);
    this.stick.x = clamp(this.touch.x + lx, -1, 1); this.stick.y = clamp(this.touch.y + ly, -1, 1);
    this.trigger = v(7) - v(6);
    this.padHeld.Space = b(0);
    const o = this.orbit;
    if (rx || ry) { o.yaw -= rx * dt * 2.6; o.pitch = clamp(o.pitch + ry * dt * 1.8, -0.4, 1.3); o.last = now; }

    const edge = (name, on) => { const was = this.prev[name]; this.prev[name] = on; return on && !was; };
    const press = (code, shiftKey = false) => { const e = { code, key: code, shiftKey, repeat: false, preventDefault() {} }; for (const h of this.keyHandlers) if (h(e)) return true; return false; };
    const any = [0, 1, 2, 3, 4, 5, 8, 9].some(b);
    if (any) this.emit('anykey');
    if (this.menuOpen()) {
      if (edge('left', b(14) || lx < -0.6)) press('ArrowLeft');
      if (edge('right', b(15) || lx > 0.6)) press('ArrowRight');
      if (edge('a', b(0))) press('Enter');
      if (edge('b', b(1))) press('Escape');
      if (edge('lbm', b(4))) press('Tab', true);           // LB: pestaña anterior
      if (edge('rbm', b(5))) press('Tab');                 // RB: pestaña siguiente
      if (edge('start', b(9))) press('KeyP');
    } else {
      if (edge('start', b(9))) this.emit('menu');
      if (edge('back', b(8))) this.emit('reset');
      if (edge('y', b(3))) this.emit('camera');
      if (edge('x', b(2))) this.emit('light');
      if (edge('b', b(1))) this.emit('warp');
      if (edge('lb', b(4))) this.emit('timeDown');
      if (edge('rb', b(5))) this.emit('timeUp');
      if (edge('rs', b(11))) this.resetOrbit();
      if (edge('dup', b(12))) this.emit('assist');
      if (edge('ddown', b(13))) this.emit('gear');
      if (edge('dleft', b(14))) this.emit('instr');
      if (edge('dright', b(15))) this.emit('flaps');
    }
  }
  // Solo se usan mandos con el mapeo estándar (Xbox 360/One, PlayStation…) o, si no, los que están en reposo al conectarse:
  // algunos dispositivos HID/virtuales dicen ser mandos pero tienen las palancas atascadas y estropearían los controles.
  padUsable(g) {
    this.padOk = this.padOk || {};
    const key = g.index + g.id;
    if (this.padOk[key] === undefined) {
      const rest = [...g.axes].slice(0, 4).every(v => Math.abs(v) < 0.4);
      this.padOk[key] = (g.mapping === 'standard' && rest) || (g.axes.length >= 4 && g.buttons.length >= 8 && rest);
    }
    return this.padOk[key];
  }
  resetOrbit() { const o = this.orbit; o.yaw = o.pitch = 0; }
}

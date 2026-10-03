// Controles táctiles: palanca flotante (aparece donde apoyas el pulgar), deslizador de gases, pedales y botones.
// Simulan las mismas teclas que el teclado, así los vehículos no necesitan saber nada del táctil.
import { $, clamp } from '../util.js';
import { settings } from '../settings.js';

const buzz = ms => { if (settings.haptics && navigator.vibrate) { try { navigator.vibrate(ms); } catch (e) { /* ok */ } } };

export class TouchUI {
  constructor(input) {
    this.input = input;
    const root = document.createElement('div'); root.id = 'touch';
    root.innerHTML = `
      <div id="tZone"></div>
      <div id="tStick"><div id="tKnob"></div></div>
      <div id="tThr" data-for="plane heli"><div id="tThrFill"></div><i class="tick" style="bottom:25%"></i><i class="tick" style="bottom:50%"></i><i class="tick" style="bottom:75%"></i><div id="tThrHandle"><b id="tThrVal">0</b></div><span id="tThrLbl">GASES</span></div>
      <div id="tPedals" data-for="car"><button id="tGas" data-key="KeyW">▲<small>GAS</small></button><button id="tRev" data-key="KeyS">▼<small>FRENO</small></button></div>
      <button id="tBrake" data-for="plane heli" data-key="Space">FRENO</button>
      <div id="tAct" data-for="plane"><button data-act="assist" title="Asistencia de aterrizaje">🛬<small>AYUDA</small></button><button data-act="gear" title="Tren de aterrizaje">🛞<small>TREN</small></button><button data-act="flaps" title="Flaps">⤵<small>FLAPS</small></button></div>
      <div id="tStrafe" data-for="heli"><button data-key="KeyQ">◀</button><button data-key="KeyE">▶</button></div>
      <button id="tHand" data-for="car" data-key="Space">FRENO<br>MANO</button>
      <div id="tBtns">
        <button data-act="menu" title="Menú">☰</button>
        <button data-act="camera" title="Cámara">📷</button>
        <button data-act="reset" title="Reiniciar">🔄</button>
        <button data-act="warp" data-for="plane heli" title="Crucero rápido">⏩</button>
        <button id="tMoreBtn" title="Más opciones">⋯</button>
      </div>
      <div id="tMore">
        <button data-act="light" title="Luces">💡</button>
        <button data-act="timeUp" title="Cambiar la hora">🕒</button>
        <button data-act="weather" title="Clima">⛅</button>
        <button data-act="instr" data-for="plane heli" title="Instrumentos">🧭</button>
        <button data-act="mapIn" title="Acercar el radar">＋</button>
        <button data-act="mapOut" title="Alejar el radar">－</button>
        <button data-act="sound" title="Sonido">🔊</button>
        <button data-act="settings" title="Ajustes">⚙</button>
        <button id="tFull" title="Pantalla completa">⛶</button>
      </div>`;
    document.body.appendChild(root);
    this.root = root;
    this.buildStick(); this.buildSlider(); this.buildButtons();
    input.on('vehicle-reset', () => this.setSlider(0));
  }

  // 'plane' | 'heli' | 'car': muestra solo los controles que usa el vehículo
  configure(scheme) {
    this.scheme = scheme;
    this.root.querySelectorAll('[data-for]').forEach(el => { el.style.display = el.dataset.for.split(' ').includes(scheme) ? '' : 'none'; });
    $('tThrLbl').textContent = scheme === 'heli' ? 'ALTURA' : 'GASES';
    this.root.classList.toggle('heli', scheme === 'heli');
    this.more(false);
    this.input.throttleSlider = null; this.setSlider(0);
  }
  show(on) { this.root.style.display = on ? 'block' : 'none'; if (!on) this.more(false); }
  more(on) {
    this.root.classList.toggle('more', on);
    clearTimeout(this.moreT); if (on) this.moreT = setTimeout(() => this.more(false), 6000);
  }

  // palanca flotante: se centra donde apoyas el pulgar en la mitad izquierda; al soltar vuelve a su sitio
  buildStick() {
    const zone = $('tZone'), el = $('tStick'), knob = $('tKnob'), st = this.input.touch, R = 56;
    let id = null, cx = 0, cy = 0;
    const set = (x, y) => {
      const d = Math.hypot(x, y), s = d > R ? R / d : 1; x *= s; y *= s;
      knob.style.transform = `translate(${x}px,${y}px)`;
      const f = v => { const a = Math.abs(v) / R, dz = 0.1; return Math.sign(v) * Math.pow(Math.max(0, a - dz) / (1 - dz), 1.3); };
      st.x = f(x); st.y = f(y);
    };
    zone.addEventListener('pointerdown', e => {
      if (id !== null) return;
      id = e.pointerId; try { zone.setPointerCapture(id); } catch (err) { /* ok */ }
      const half = el.offsetWidth / 2;
      cx = clamp(e.clientX, half + 4, innerWidth - half - 4); cy = clamp(e.clientY, half + 4, innerHeight - half - 4);
      el.style.left = (cx - half) + 'px'; el.style.top = (cy - half) + 'px'; el.style.bottom = 'auto';
      el.classList.add('live'); set(e.clientX - cx, e.clientY - cy); e.preventDefault();
    });
    zone.addEventListener('pointermove', e => { if (e.pointerId === id) set(e.clientX - cx, e.clientY - cy); });
    const end = e => { if (e.pointerId !== id) return; id = null; set(0, 0); el.classList.remove('live'); el.style.left = el.style.top = el.style.bottom = ''; };
    zone.addEventListener('pointerup', end); zone.addEventListener('pointercancel', end);
  }

  buildSlider() {
    const el = $('tThr'), input = this.input;
    let id = null;
    const at = e => { const r = el.getBoundingClientRect(); input.throttleSlider = clamp(1 - (e.clientY - r.top - 14) / (r.height - 28), 0, 1); this.paint(); };
    el.addEventListener('pointerdown', e => { id = e.pointerId; el.setPointerCapture(id); at(e); buzz(6); e.preventDefault(); });
    el.addEventListener('pointermove', e => { if (e.pointerId === id) at(e); });
    const end = e => { if (e.pointerId === id) { id = null; if (this.scheme === 'heli') this.setSlider(0); } };   // en el helicóptero vuelve al centro
    el.addEventListener('pointerup', end); el.addEventListener('pointercancel', end);
  }
  // avión: nivel de gases (se queda donde lo dejas) · helicóptero: palanca de altura que vuelve al centro (0,5 = estacionario)
  setSlider(v) {
    if (this.scheme === 'heli') { this.input.throttleSlider = 0.5; this.paint(0.5); return; }
    this.input.throttleSlider = v > 0 ? v : null; this.paint(v);
  }
  paint(v) {
    const t = v !== undefined ? v : (this.input.throttleSlider || 0);
    $('tThrFill').style.height = t * 100 + '%'; $('tThrHandle').style.bottom = `calc(${t * 100}% - ${t * 28}px)`;
    $('tThrVal').textContent = this.scheme === 'heli' ? (t > 0.56 ? '▲' : t < 0.44 ? '▼' : '•') : Math.round(t * 100);
  }

  buildButtons() {
    const input = this.input;
    this.root.querySelectorAll('button').forEach(b => {
      const key = b.dataset.key, act = b.dataset.act;
      if (key) {                                           // botones que se mantienen pulsados = una tecla
        const on = e => { input.keys[key] = true; b.classList.add('on'); buzz(8); try { b.setPointerCapture(e.pointerId); } catch (err) { /* ok */ } e.preventDefault(); };
        const off = () => { input.keys[key] = false; b.classList.remove('on'); };
        b.addEventListener('pointerdown', on); b.addEventListener('pointerup', off); b.addEventListener('pointercancel', off);
      } else if (act) {
        b.addEventListener('pointerdown', e => {
          input.emit(act); input.emit('anykey'); buzz(8); e.preventDefault();
          if (b.parentElement.id === 'tMore') this.more(act === 'settings' ? false : true);      // el panel sigue abierto para tocar varias veces
          else this.more(false);
        });
      }
    });
    $('tMoreBtn').addEventListener('pointerdown', e => { e.preventDefault(); buzz(8); this.more(!this.root.classList.contains('more')); });
    const full = $('tFull');
    if (!document.documentElement.requestFullscreen) { full.style.display = 'none'; return; }
    full.addEventListener('pointerdown', async e => {
      e.preventDefault();
      try {
        if (document.fullscreenElement) await document.exitFullscreen();
        else { await document.documentElement.requestFullscreen(); if (screen.orientation && screen.orientation.lock) await screen.orientation.lock('landscape').catch(() => {}); }
      } catch (err) { /* ok */ }
    });
  }
}

// pantalla completa y horizontal al empezar a jugar desde un móvil (Android; en iPhone no existe y no pasa nada)
export function playFullscreen() {
  const d = document.documentElement;
  if (document.fullscreenElement || !d.requestFullscreen) return;
  d.requestFullscreen({ navigationUI: 'hide' }).then(() => { if (screen.orientation && screen.orientation.lock) return screen.orientation.lock('landscape').catch(() => {}); }).catch(() => {});
}

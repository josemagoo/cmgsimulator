// Panel de ajustes, logros y récords (se abre con la tecla O o desde el menú)
import { store, MOBILE } from '../util.js';
import { settings, saveSettings } from '../settings.js';
import { ACHIEVEMENTS } from '../achievements.js';
import { MISSIONS } from '../missions.js';
import { WEATHER_ORDER } from '../world/weather.js';

const QUALITY = { low: 'Baja (más fluido)', medium: 'Media', high: 'Alta (más bonito)' };
const WEATHER = { clear: '☀ Despejado', cloudy: '☁ Nublado', fog: '🌫 Niebla', rain: '🌧 Lluvia', storm: '⛈ Tormenta' };

export class SettingsPanel {
  constructor(game) {
    this.game = game; this.isOpen = false;
    const el = this.el = document.createElement('div'); el.id = 'settings'; el.style.display = 'none';
    document.body.appendChild(el);
    el.addEventListener('pointerdown', e => e.stopPropagation());
  }

  build() {
    const g = this.game, sky = g.world.sky, wx = g.world.weather;
    const sel = (id, opts, cur) => `<select id="${id}">${Object.entries(opts).map(([k, v]) => `<option value="${k}"${k === cur ? ' selected' : ''}>${v}</option>`).join('')}</select>`;
    const chk = (id, label, on) => `<label class="chk"><input type="checkbox" id="${id}"${on ? ' checked' : ''}> ${label}</label>`;
    const best = store.get('best', {}), pts = store.get('points', 0);
    this.el.innerHTML = `<div class="sbox">
      <h2>⚙ Ajustes <button id="sClose">✕</button></h2>
      <div class="srow"><span>Calidad gráfica</span>${sel('sQ', QUALITY, settings.quality)}<button id="sApply" style="display:none">Aplicar y recargar</button></div>
      <div class="srow"><span>Volumen</span><input type="range" id="sVol" min="0" max="1" step="0.05" value="${settings.volume}"></div>
      <div class="srow"><span>Clima</span>${sel('sW', WEATHER, wx.type)}</div>
      <div class="srow"><span>Hora del día</span><input type="range" id="sHour" min="0" max="23.9" step="0.1" value="${sky.TOD.hour}"> ${chk('sAuto', 'automática', sky.TOD.auto)}</div>
      <div class="srow">${chk('sInst', 'Instrumentos en pantalla', settings.instruments)} ${chk('sInv', 'Invertir cabeceo', settings.invertY)}</div>
      <div class="srow">${chk('sGta', 'Estilo GTA San Andreas', settings.gta)}</div>
      <div class="srow">${chk('sFps', 'Contador de fotogramas', settings.fps)} ${chk('sHap', 'Vibración (móvil)', settings.haptics)}</div>
      <h2>🏆 Logros <small>${g.achievements.got.size}/${ACHIEVEMENTS.length} · ★ ${pts} puntos</small></h2>
      <div class="ach">${ACHIEVEMENTS.map(a => `<div class="a${g.achievements.got.has(a.id) ? ' on' : ''}" title="${a.desc}"><span>${a.icon}</span><b>${a.name}</b><small>${a.desc}</small></div>`).join('')}</div>
      <h2>🎯 Mejores marcas</h2>
      <div class="best">${MISSIONS.map(m => `<div><span>${m.icon} ${m.name}</span><b>${best[m.id] ? best[m.id] + ' pts' : '—'}</b></div>`).join('')}</div>
    </div>`;
    const $ = id => this.el.querySelector('#' + id), orig = settings.quality;
    $('sClose').onclick = () => this.toggle();
    $('sQ').onchange = e => { settings.quality = e.target.value; saveSettings(); $('sApply').style.display = settings.quality !== orig ? '' : 'none'; };
    $('sApply').onclick = () => location.reload();
    $('sVol').oninput = e => { settings.volume = +e.target.value; saveSettings(); g.sound.setVolume(settings.volume); };
    $('sW').onchange = e => { wx.set(e.target.value); };
    $('sHour').oninput = e => { sky.TOD.hour = +e.target.value; sky.applyTime(); };
    $('sAuto').onchange = e => { sky.TOD.auto = e.target.checked; };
    $('sInst').onchange = e => { settings.instruments = e.target.checked; saveSettings(); };
    $('sInv').onchange = e => { settings.invertY = e.target.checked; saveSettings(); };
    $('sGta').onchange = e => { settings.gta = e.target.checked; saveSettings(); document.body.classList.toggle('gta', settings.gta); };
    $('sFps').onchange = e => { settings.fps = e.target.checked; saveSettings(); };
    $('sHap').onchange = e => { settings.haptics = e.target.checked; saveSettings(); };
  }

  toggle() {
    this.isOpen = !this.isOpen;
    if (this.isOpen) { this.build(); this.el.style.display = 'flex'; } else this.el.style.display = 'none';
    this.game.sound.click();
  }
  handleKey(e) {
    if (!this.isOpen) return false;
    if (e.code === 'Escape' || e.code === 'KeyO') { this.toggle(); return true; }
    return /^(Arrow|Tab|Space|Enter)/.test(e.code) || e.code.startsWith('Digit');
  }
}

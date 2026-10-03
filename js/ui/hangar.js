// Menú principal: elegir vehículo (pestañas Aviones / Autos), destino y volar
import { $, clamp, IS_TOUCH, MOBILE } from '../util.js';
import { AIRPORTS } from '../config.js';
import { CATEGORIES, buildModel } from '../vehicles/registry.js';
import { missionsFor } from '../missions.js';
import { store } from '../util.js';
import { ACHIEVEMENTS } from '../achievements.js';
import { playFullscreen } from './touch.js';

const FACTS = [
  'Camagüey fue fundada en 1514 con el nombre de Santa María del Puerto del Príncipe.',
  'Su Centro Histórico es Patrimonio de la Humanidad de la UNESCO desde 2008.',
  'Se la conoce como la «Ciudad de los Tinajones»: las grandes vasijas de barro recogían el agua de lluvia.',
  'También es la «Ciudad de las Iglesias»: verás muchas torres al sobrevolar el centro.',
  'Sus calles irregulares y sin trazado en cuadrícula forman un laberinto: según la tradición, para despistar a los piratas.',
  'Aquí nació el héroe independentista Ignacio Agramonte, que da nombre al aeropuerto.',
  'El río Hatibonico y el río Tínima cruzan la ciudad.',
  'Camagüey es la provincia más extensa de Cuba.',
  'Los coches de caballo siguen siendo un medio de transporte habitual en sus calles.',
  'Nicolás Guillén, el poeta nacional de Cuba, nació en Camagüey.',
];

const bar = (label, v) => `<div class="row"><span>${label}</span><div class="bar"><i style="width:${Math.round(clamp(v, 0.06, 1) * 100)}%"></i></div></div>`;

// Barras y datos según el tipo de vehículo
function statsHTML(p) {
  if (p.category === 'heli') {
    return bar('Velocidad', p.vmax / 330) + bar('Ascenso', p.climb / 12) + bar('Maniobra', p.yawRate / 1.6) + bar('Facilidad', p.ease)
      + `<div class="row" style="margin-top:6px"><span style="width:auto">Aterriza en cualquier sitio</span></div>`;
  }
  if (p.category === 'car') {
    return bar('Velocidad', p.vmax / 230) + bar('Aceleración', p.accel / 11) + bar('Maniobra', p.steer / 0.6) + bar('Facilidad', 1 - (p.vmax - 100) / 160)
      + `<div class="row" style="margin-top:6px"><span style="width:auto">Sale del centro de Camagüey</span></div>`;
  }
  return bar('Velocidad', p.vmax / 2400) + bar('Aceleración', p.thrust / 22) + bar('Maniobra', p.turn * p.rollMax / 0.8) + bar('Facilidad', 1 - (p.stall - 100) / 220)
    + `<div class="row" style="margin-top:6px"><span style="width:auto">Aterriza a ~${Math.round(p.stall * 1.25)} km/h</span></div>`;
}

export class Hangar {
  constructor(game) {
    this.game = game; this.isOpen = false; this.cat = 0; this.sel = 0; this.thumbs = {}; this.mission = null;
    $('hgGo').onclick = () => this.launch(this.sel);
    $('hgSet').onclick = () => game.settingsPanel.toggle();
  }
  get specs() { return CATEGORIES[this.cat].specs; }

  // miniaturas 3D de cada vehículo, dibujadas con un segundo renderer
  prepare() {
    try {
      const W = MOBILE ? 240 : 360, H = MOBILE ? 144 : 216;
      const r = new THREE.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
      r.setSize(W, H); r.setClearColor(0x000000, 0);
      const sc = new THREE.Scene(), cam = new THREE.PerspectiveCamera(30, W / H, 0.5, 400);
      sc.add(new THREE.HemisphereLight(0xffffff, 0x6a7a90, 0.95));
      const dl = new THREE.DirectionalLight(0xffffff, 1.15); dl.position.set(8, 14, 10); sc.add(dl);
      for (const c of CATEGORIES) for (const p of c.specs) {
        const m = buildModel(p);
        [m.navL, m.navR, m.navT, m.flame].forEach(s => { if (s) s.visible = false; });
        const box = new THREE.Box3().setFromObject(m.group), center = box.getCenter(new THREE.Vector3()), size = box.getSize(new THREE.Vector3());
        const pivot = new THREE.Group(); pivot.add(m.group); m.group.position.sub(center);
        pivot.rotation.set(0.05, Math.PI - 0.75, 0); sc.add(pivot);
        const rad = size.length() / 2, d = rad / Math.sin(15 * Math.PI / 180) * 0.78;
        cam.position.set(0, d * 0.34, d); cam.lookAt(0, 0, 0);
        r.render(sc, cam); this.thumbs[p.category + p.id] = r.domElement.toDataURL('image/png');
        sc.remove(pivot); pivot.traverse(o => { if (o.geometry) o.geometry.dispose(); });
      }
      r.dispose(); if (r.forceContextLoss) r.forceContextLoss();
    } catch (e) { this.thumbs = {}; }
  }

  open() {
    const g = this.game, cur = g.spec;
    this.cat = Math.max(0, CATEGORIES.findIndex(c => c.id === cur.category));
    this.sel = Math.max(0, this.specs.findIndex(s => s.id === cur.id));
    this.isOpen = true;
    $('hgFact').textContent = '💡 ' + FACTS[Math.floor(Math.random() * FACTS.length)];
    this.render();
    $('hangar').style.display = 'flex'; document.body.classList.add('hg');
    g.enterMenu();
    g.previewSpec(this.specs[this.sel]);
  }
  close() {
    this.isOpen = false;
    $('hangar').style.display = 'none'; document.body.classList.remove('hg');
    this.game.leaveMenu();
  }
  launch(i) {
    const spec = this.specs[i];
    if (IS_TOUCH) playFullscreen();                     // en el móvil se juega a pantalla completa
    this.isOpen = false;
    $('hangar').style.display = 'none'; document.body.classList.remove('hg');
    this.game.launch(spec, this.mission);
  }
  select(i) {
    this.sel = (i + this.specs.length) % this.specs.length;
    document.querySelectorAll('.card').forEach((el, k) => el.classList.toggle('sel', k === this.sel));
    this.game.previewSpec(this.specs[this.sel]);
  }
  setCat(i) {
    this.cat = i; this.sel = 0;
    const cur = this.game.spec;
    if (CATEGORIES[i].id === cur.category) this.sel = Math.max(0, this.specs.findIndex(s => s.id === cur.id));
    this.render(); this.game.previewSpec(this.specs[this.sel]);
  }

  render() {
    const g = this.game;
    $('hgTabs').innerHTML = CATEGORIES.map((c, i) => `<button class="tab${i === this.cat ? ' on' : ''}" data-c="${i}">${c.icon} ${c.label}</button>`).join('');
    $('hgTabs').querySelectorAll('.tab').forEach(el => { el.onclick = () => this.setCat(+el.dataset.c); });
    $('cards').innerHTML = this.specs.map((p, i) => `<div class="card${i === this.sel ? ' sel' : ''}" data-i="${i}">
      <div class="num">${i + 1}</div>${this.thumbs[p.category + p.id] ? `<img src="${this.thumbs[p.category + p.id]}" alt="">` : ''}
      <h3>${p.name}<span class="tag t${i}">${p.tag}</span></h3>
      <div class="vmax">${p.vmax.toLocaleString('es')} <small>km/h máx.</small></div>
      <p>${p.desc}</p>${statsHTML(p)}</div>`).join('');
    document.querySelectorAll('.card').forEach(el => {
      const i = +el.dataset.i;
      if (!IS_TOUCH) el.onmouseenter = () => this.select(i);       // vista previa al pasar el ratón
      el.onclick = () => { if (IS_TOUCH && this.sel !== i) this.select(i); else this.launch(i); };
    });
    $('hgGo').textContent = CATEGORIES[this.cat].id === 'car' ? '▶ Conducir' : '▶ Volar';
    this.renderDests(); this.renderMissions();
  }

  renderMissions() {
    const cat = CATEGORIES[this.cat].id, list = missionsFor(cat), best = store.get('best', {}), g = this.game;
    if (this.mission && !list.some(m => m.id === this.mission)) this.mission = null;
    $('hgStats').textContent = `★ ${store.get('points', 0)} puntos · 🏆 ${g.achievements.got.size}/${ACHIEVEMENTS.length} logros`;
    $('missionRow').innerHTML = `<span class="lbl">Misión:</span><span class="chip${!this.mission ? ' on' : ''}" data-m="">Vuelo libre</span>` +
      list.map(m => `<span class="chip${this.mission === m.id ? ' on' : ''}" data-m="${m.id}" title="${m.desc}${best[m.id] ? ' · mejor: ' + best[m.id] + ' pts' : ''}">${m.icon} ${m.name}</span>`).join('');
    $('missionRow').querySelectorAll('.chip').forEach(el => { el.onclick = () => { this.mission = el.dataset.m || null; this.game.sound.click(); this.renderMissions(); }; });
  }

  renderDests() {
    const g = this.game, P = g.progress, ap = g.world.airports, row = $('destRow');
    if (CATEGORIES[this.cat].id === 'car') { row.innerHTML = '<span class="lbl">Recorre las calles de Camagüey: edificios reales, tráfico y relieve.</span>'; return; }
    const un = P.unlockedCount();
    let h = `<span class="lbl">Salida: <b>${ap.name(ap.start) || 'Camagüey'}</b></span>`;
    if (ap.start !== ap.home) h += `<span class="chip" data-home="1">🏠 Volver a Camagüey</span>`;
    h += `<span class="lbl" style="margin-left:14px">Destino (${un - 1}/${AIRPORTS.length - 1}):</span><span class="chip${P.dest < 0 ? ' on' : ''}" data-d="-1">Libre</span>`;
    for (let i = 1; i < AIRPORTS.length; i++) {
      const lock = i >= un;
      h += `<span class="chip${lock ? ' lock' : ''}${P.dest === i ? ' on' : ''}" data-d="${i}" title="${lock ? 'Aterriza en otra ciudad para desbloquearlo' : ''}">${lock ? '🔒 ' : ''}${AIRPORTS[i].name}</span>`;
    }
    row.innerHTML = h;
    row.querySelectorAll('.chip').forEach(el => {
      el.onclick = () => {
        if (el.dataset.home) { ap.start = ap.home; this.renderDests(); return; }
        const i = parseInt(el.dataset.d);
        if (i >= P.unlockedCount()) return;
        P.setDest(i); this.renderDests();
      };
    });
  }

  // teclado del menú; devuelve true si la tecla fue consumida
  handleKey(e) {
    if (!this.isOpen) return false;
    const n = parseInt(e.key);
    if (n >= 1 && n <= this.specs.length) this.launch(n - 1);
    else if (e.code === 'ArrowRight') this.select(this.sel + 1);
    else if (e.code === 'ArrowLeft') this.select(this.sel - 1);
    else if (e.code === 'Tab') this.setCat((this.cat + (e.shiftKey ? CATEGORIES.length - 1 : 1)) % CATEGORIES.length);
    else if (e.code === 'Enter') this.launch(this.sel);
    else if (e.code === 'Escape' || e.code === 'KeyP') this.close();
    else return false;
    return true;
  }
}

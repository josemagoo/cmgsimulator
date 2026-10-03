// Instrumentos: horizonte artificial, velocidad, altura, brújula y ayuda de aproximación (ILS).
// Se dibujan en un canvas que se usa en pantalla (panel inferior) y como tablero de la vista de cabina.
import { clamp } from '../util.js';

const W = 640, H = 256;

function ring(g, x, y, r, w, col) { g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.lineWidth = w; g.strokeStyle = col; g.stroke(); }
function text(g, s, x, y, size, col = '#fff', align = 'center', weight = '700') {
  g.font = `${weight} ${size}px "Segoe UI", Arial`; g.fillStyle = col; g.textAlign = align; g.textBaseline = 'middle'; g.fillText(s, x, y);
}

// Horizonte artificial: el mundo gira al revés que el avión
function attitude(g, cx, cy, r, st) {
  g.save();
  g.beginPath(); g.arc(cx, cy, r, 0, Math.PI * 2); g.clip();
  g.translate(cx, cy); g.rotate(st.roll);
  const off = clamp(st.pitch, -0.9, 0.9) * 230;
  const sky = g.createLinearGradient(0, -r * 2 + off, 0, off); sky.addColorStop(0, '#2f6fd0'); sky.addColorStop(1, '#8cc4f0');
  g.fillStyle = sky; g.fillRect(-r * 2, -r * 3 + off, r * 4, r * 3);
  const gnd = g.createLinearGradient(0, off, 0, off + r * 2); gnd.addColorStop(0, '#9a6a3a'); gnd.addColorStop(1, '#4e3418');
  g.fillStyle = gnd; g.fillRect(-r * 2, off, r * 4, r * 3);
  g.strokeStyle = '#fff'; g.lineWidth = 3; g.beginPath(); g.moveTo(-r * 2, off); g.lineTo(r * 2, off); g.stroke();
  g.lineWidth = 2; g.font = '600 13px "Segoe UI", Arial'; g.fillStyle = '#fff'; g.textAlign = 'center';
  for (let d = -30; d <= 30; d += 10) {                       // escalera de cabeceo cada 10°
    if (!d) continue;
    const y = off - d * Math.PI / 180 * 230, hw = d % 20 === 0 ? 44 : 26;
    g.beginPath(); g.moveTo(-hw, y); g.lineTo(hw, y); g.stroke();
    if (d % 20 === 0) { g.fillText(Math.abs(d), -hw - 14, y); g.fillText(Math.abs(d), hw + 14, y); }
  }
  g.restore();
  ring(g, cx, cy, r, 4, '#111'); ring(g, cx, cy, r + 2, 2, 'rgba(255,255,255,.35)');
  // marcas de alabeo fijas
  g.save(); g.translate(cx, cy);
  for (const a of [-60, -45, -30, -20, -10, 0, 10, 20, 30, 45, 60]) {
    g.save(); g.rotate(a * Math.PI / 180); g.fillStyle = '#fff'; g.fillRect(-1.5, -r - 1, 3, a % 30 === 0 ? 14 : 8); g.restore();
  }
  g.restore();
  // avioncito fijo
  g.strokeStyle = '#ffd23c'; g.lineWidth = 5; g.lineCap = 'round';
  g.beginPath(); g.moveTo(cx - 60, cy); g.lineTo(cx - 20, cy); g.lineTo(cx - 20, cy + 10); g.moveTo(cx + 60, cy); g.lineTo(cx + 20, cy); g.lineTo(cx + 20, cy + 10); g.stroke();
  g.fillStyle = '#ffd23c'; g.beginPath(); g.arc(cx, cy, 5, 0, Math.PI * 2); g.fill();
  // ayuda de aproximación: la aguja vertical es la dirección de la pista; la horizontal, la senda de bajada de 3°
  if (st.ils) {
    const x = clamp(-st.ils.lat / Math.max(st.ils.s * 0.12, 120), -1, 1) * (r - 14), y = clamp(st.ils.dev / 1.5, -1, 1) * (r - 14);
    g.strokeStyle = '#ff40ff'; g.lineWidth = 4;
    g.beginPath(); g.moveTo(cx + x, cy - r + 10); g.lineTo(cx + x, cy + r - 10); g.stroke();
    g.beginPath(); g.moveTo(cx - r + 10, cy + y); g.lineTo(cx + r - 10, cy + y); g.stroke();
  }
}

function airKind(g, st) {
  const cx = W / 2, cy = 124;
  attitude(g, cx, cy, 104, st);
  // velocidad
  text(g, 'VELOCIDAD', 110, 32, 15, '#9fb6cc');
  text(g, Math.round(st.speedKmh), 110, 84, 54, st.stall ? '#ff5a4a' : '#fff');
  text(g, 'km/h', 110, 122, 16, '#9fb6cc');
  if (st.mach > 0.3) text(g, 'M ' + st.mach.toFixed(2), 110, 150, 20, '#ffd23c');
  // altura y velocidad vertical
  text(g, 'ALTURA', W - 110, 32, 15, '#9fb6cc');
  text(g, Math.round(st.alt), W - 110, 84, 54);
  text(g, 'm', W - 110, 122, 16, '#9fb6cc');
  const vs = clamp(st.vs, -15, 15), bx = W - 62, by = 150;                      // barra de velocidad vertical
  g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(bx - 50, by + 14, 100, 10);
  g.fillStyle = vs >= 0 ? '#5ad07a' : '#ff9a4a'; g.fillRect(bx, by + 14, vs / 15 * 50, 10);
  text(g, (st.vs >= 0 ? '+' : '') + st.vs.toFixed(1) + ' m/s', bx, by + 40, 15, '#cfe0f0');
  // rumbo
  g.fillStyle = 'rgba(255,255,255,.1)'; g.fillRect(cx - 62, H - 34, 124, 28);
  text(g, 'RUMBO ' + String(st.hdg).padStart(3, '0') + '°', cx, H - 20, 19);
  // brújula pequeña
  g.save(); g.translate(60, H - 52); g.rotate(-st.hdg * Math.PI / 180);
  ring(g, 0, 0, 30, 2, 'rgba(255,255,255,.5)');
  text(g, 'N', 0, -20, 14, '#ff5a4a'); text(g, 'S', 0, 20, 12, '#cfe0f0'); text(g, 'E', 20, 0, 12, '#cfe0f0'); text(g, 'O', -20, 0, 12, '#cfe0f0');
  g.restore();
  g.fillStyle = '#ffd23c'; g.beginPath(); g.moveTo(60, H - 88); g.lineTo(54, H - 80); g.lineTo(66, H - 80); g.fill();
  // estado: tren, flaps, gases, asistencia, viento
  let x = W - 190;
  if (st.gear !== null && st.gear !== undefined) { text(g, st.gear > 0.9 ? '⬇ TREN' : st.gear < 0.1 ? '⬆ TREN' : '… TREN', x, H - 20, 15, st.gear > 0.9 ? '#5ad07a' : '#ffd23c', 'left'); x += 78; }
  if (st.flaps !== null && st.flaps !== undefined) text(g, 'FLAPS ' + st.flaps, x, H - 20, 15, st.flaps ? '#ffd23c' : '#9fb6cc', 'left');
  if (st.thr !== undefined) {
    g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(W - 46, 190, 14, 56);
    g.fillStyle = '#ffb400'; g.fillRect(W - 46, 246 - 56 * st.thr, 14, 56 * st.thr);
  }
  if (st.assist) text(g, 'ASISTENCIA', cx, 18, 15, '#ff7bff');
  else if (st.ils) text(g, 'APROXIMACIÓN', cx, 18, 15, '#ff7bff');
  if (st.wind) {
    g.save(); g.translate(150, H - 52); g.rotate(st.wind.dir);                   // flecha hacia donde sopla el viento (arriba = hacia la nariz)
    g.strokeStyle = '#8fd0ff'; g.lineWidth = 3; g.beginPath(); g.moveTo(0, 18); g.lineTo(0, -16); g.moveTo(-7, -8); g.lineTo(0, -17); g.lineTo(7, -8); g.stroke(); g.restore();
    text(g, Math.round(st.wind.speed * 3.6) + ' km/h', 150, H - 20, 13, '#8fd0ff');
  }
}

function carKind(g, st) {
  const cx = W / 2, cy = 138, r = 100, vmax = st.vmaxKmh;
  ring(g, cx, cy, r, 10, 'rgba(255,255,255,.12)');
  const a0 = Math.PI * 0.75, a1 = Math.PI * 2.25, f = clamp(st.speedKmh / vmax, 0, 1);
  g.lineWidth = 10; g.strokeStyle = f > 0.85 ? '#ff5a4a' : '#ffb400'; g.beginPath(); g.arc(cx, cy, r, a0, a0 + (a1 - a0) * f); g.stroke();
  for (let v = 0; v <= vmax; v += vmax > 150 ? 40 : 20) {
    const a = a0 + (a1 - a0) * v / vmax, x = cx + Math.cos(a) * (r - 22), y = cy + Math.sin(a) * (r - 22);
    text(g, v, x, y, 13, '#cfe0f0');
  }
  g.save(); g.translate(cx, cy); g.rotate(a0 + (a1 - a0) * f);
  g.fillStyle = '#ff5a4a'; g.fillRect(0, -2, r - 8, 4); g.restore();
  text(g, Math.round(st.speedKmh), cx, cy + 22, 58);
  text(g, 'km/h', cx, cy + 62, 16, '#9fb6cc');
  text(g, st.gear, cx - 150, cy, 54, st.gear === 'R' ? '#ff9a4a' : '#5ad07a'); text(g, 'MARCHA', cx - 150, cy + 36, 14, '#9fb6cc');
  text(g, 'RUMBO ' + String(st.hdg).padStart(3, '0') + '°', cx + 150, cy - 20, 18);
  text(g, 'DAÑO', cx + 150, cy + 20, 14, '#9fb6cc');
  g.fillStyle = 'rgba(255,255,255,.15)'; g.fillRect(cx + 100, cy + 34, 100, 12);
  g.fillStyle = st.damage > 70 ? '#ff5a4a' : st.damage > 35 ? '#ffb400' : '#5ad07a'; g.fillRect(cx + 100, cy + 34, st.damage, 12);
}

export function drawInstruments(g, st) {
  g.clearRect(0, 0, W, H);
  g.fillStyle = 'rgba(8,12,18,.88)'; g.beginPath(); g.roundRect ? g.roundRect(0, 0, W, H, 22) : g.rect(0, 0, W, H); g.fill();
  if (st.kind === 'car') carKind(g, st); else airKind(g, st);
}

// Panel en pantalla (parte inferior)
export class InstrumentPanel {
  constructor(el) { this.el = el; this.g = el.getContext('2d'); }
  draw(st) { drawInstruments(this.g, st); }
}

// Tablero 3D pegado a la cámara para la vista de cabina (se dibuja siempre encima del mundo)
export class CockpitView {
  constructor(camera, scene) {
    this.camera = camera; scene.add(camera);
    this.g = new THREE.Group(); this.g.visible = false; camera.add(this.g);
    this.canvas = document.createElement('canvas'); this.canvas.width = W; this.canvas.height = H;
    this.ctx = this.canvas.getContext('2d');
    this.tex = new THREE.CanvasTexture(this.canvas);
    const top = o => { o.renderOrder = 200; o.material.depthTest = false; o.material.depthWrite = false; return o; };
    const dark = () => new THREE.MeshBasicMaterial({ color: 0x11151a });
    const dash = top(new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.7, 0.8), dark())); dash.position.set(0, -1.22, -1.7); dash.rotation.x = 0.22;
    const shield = top(new THREE.Mesh(new THREE.BoxGeometry(3.6, 0.16, 0.5), new THREE.MeshBasicMaterial({ color: 0x1b2128 }))); shield.position.set(0, -0.86, -1.62);
    const panel = top(new THREE.Mesh(new THREE.PlaneGeometry(1.0, 0.4), new THREE.MeshBasicMaterial({ map: this.tex, transparent: true }))); panel.position.set(0, -0.6, -1.3); panel.rotation.x = -0.35;
    this.panel = panel;
    this.g.add(dash, shield, panel);
    for (const s of [-1, 1]) {                                   // montantes del parabrisas
      const p = top(new THREE.Mesh(new THREE.BoxGeometry(0.07, 3, 0.08), dark())); p.position.set(s * 1.85, 0.2, -1.8); p.rotation.z = s * -0.5; this.g.add(p);
    }
    this.wheel = top(new THREE.Mesh(new THREE.TorusGeometry(0.34, 0.035, 8, 28), new THREE.MeshBasicMaterial({ color: 0x0b0b0d })));   // volante del auto
    this.wheel.position.set(-0.55, -0.62, -1.15); this.wheel.rotation.x = -0.35; this.g.add(this.wheel);
  }
  setVisible(on, car) { this.g.visible = on; this.wheel.visible = !!car; this.panel.position.x = car ? 0.2 : 0; }
  update(st, steer) {
    if (!this.g.visible) return;
    drawInstruments(this.ctx, st); this.tex.needsUpdate = true;
    this.wheel.rotation.z = -(steer || 0) * 1.6;
  }
}

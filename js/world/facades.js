// Fachadas de Camagüey dibujadas a mano (en código) en un atlas de 4x4 módulos, más su mapa de luces nocturnas.
// Cada módulo es un vano típico: ventana colonial de barrotes torneados, puerta con medio punto de vitrales, reja de hierro,
// balcón, comercio, casa de reparto, paneles prefabricados, nave, iglesia, medianera…
// El canal alfa dice qué se pinta con el color del edificio:
//   255 = fijo (molduras blancas, vidrio, hierro)   200 = moldura teñida suave   140 = estuco (color de la casa)
//    80 = carpintería (puertas, persianas, balaustres: un color por edificio)
import { env } from '../util.js';
import { Q } from '../config.js';

export const MOD = {
  COL_WIN: 0, COL_DOOR: 1, COL_GRILLE: 2, COL_PLAIN: 3,
  UP_BALC: 4, UP_WIN: 5, SHOP: 6, COL_ARCH: 7,
  HOUSE_WIN: 8, HOUSE_DOOR: 9, HOUSE_PLAIN: 10, PREFAB: 11,
  PREFAB_B: 12, INDUS: 13, CHURCH: 14, PARTY: 15,
  FENCE_IRON: 16, FENCE_CHAIN: 17, FENCE_WALL: 18, BALC_WOOD: 19, ECLECTIC_UP: 20, DECO_UP: 21, DECO_GROUND: 22, SHOP_GLASS: 23,
  HOUSE_PORCH: 24, HOUSE_MIAMI: 25, COL_DOOR2: 26, COL_WIN_SHUT: 27, BALC_IRON_UP: 28, PREFAB_STAIR: 29, HOUSE_UP: 30, BODEGA: 31,
};
// tamaño real de cada módulo (ancho, alto) en metros
export const SIZE = [
  [4.2, 5.2], [4.2, 5.2], [4.2, 5.2], [4.2, 5.2],
  [3.8, 4.2], [3.8, 4.2], [4.5, 5.0], [4.2, 5.2],
  [3.4, 3.3], [3.4, 3.3], [3.4, 3.3], [3.6, 3.0],
  [3.6, 3.0], [6.0, 4.5], [5.0, 6.0], [6.0, 4.0],
  [3.0, 2.0], [3.0, 2.0], [3.0, 2.0], [3.8, 4.2], [3.8, 4.2], [3.6, 3.6], [4.2, 4.6], [4.5, 5.0],
  [3.4, 3.3], [3.4, 3.3], [4.2, 5.2], [4.2, 5.2], [3.8, 4.2], [3.6, 3.0], [3.4, 3.0], [4.5, 4.6],
];
export const COLS = 8, ROWS = 4;

const FIX = 255, HALF = 200, WALL = 140, PAINT = 80;

// "Pluma" que dibuja a la vez el color, la máscara de pintura y el mapa de luces, con medidas en metros (y desde el suelo)
class Pen {
  constructor(g, k, e, S) { this.g = g; this.k = k; this.e = e; this.S = S; }
  cell(i) {
    const S = this.S; this.ox = (i % COLS) * S; this.oy = Math.floor(i / COLS) * S;
    [this.W, this.H] = SIZE[i]; this.sx = S / this.W; this.sy = S / this.H;
    this.seed = 1000 + i * 977;
  }
  rnd() { this.seed = (this.seed * 16807) % 2147483647; return this.seed / 2147483647; }
  X(m) { return this.ox + m * this.sx; }
  Y(m) { return this.oy + (this.H - m) * this.sy; }
  path(ctx, fn) { ctx.beginPath(); fn(ctx); }
  // rectángulo de x0..x1, y0..y1 (metros; y desde el suelo)
  rect(x0, y0, x1, y1, col, mask, glow) {
    const a = this.X(x0), b = this.Y(y1), w = (x1 - x0) * this.sx, h = (y1 - y0) * this.sy;
    this.g.fillStyle = col; this.g.fillRect(a, b, w, h);
    if (mask !== undefined) { this.k.fillStyle = `rgb(${mask},${mask},${mask})`; this.k.fillRect(a, b, w, h); }
    if (glow) { this.e.fillStyle = glow; this.e.fillRect(a / 2, b / 2, w / 2, h / 2); }
  }
  // arco de medio punto (semicírculo) sobre la línea y, de x0 a x1
  arch(x0, x1, y, col, mask, glow, inner = 0) {
    const cx = this.X((x0 + x1) / 2), cy = this.Y(y), rx = (x1 - x0) / 2 * this.sx - inner, ry = (x1 - x0) / 2 * this.sy - inner;
    const p = c => { c.beginPath(); c.ellipse(cx, cy, rx, ry, 0, Math.PI, 0); c.closePath(); };
    p(this.g); this.g.fillStyle = col; this.g.fill();
    if (mask !== undefined) { p(this.k); this.k.fillStyle = `rgb(${mask},${mask},${mask})`; this.k.fill(); }
    if (glow) { this.e.beginPath(); this.e.ellipse(cx / 2, cy / 2, rx / 2, ry / 2, 0, Math.PI, 0); this.e.closePath(); this.e.fillStyle = glow; this.e.fill(); }
  }
  line(x0, y0, x1, y1, col, wpx, mask) {
    const f = c => { c.beginPath(); c.moveTo(this.X(x0), this.Y(y0)); c.lineTo(this.X(x1), this.Y(y1)); c.lineWidth = wpx; c.stroke(); };
    this.g.strokeStyle = col; f(this.g);
    if (mask !== undefined) { this.k.strokeStyle = `rgb(${mask},${mask},${mask})`; f(this.k); }
  }
  // letrero pintado: texto centrado en x, con la base en y y alto h (metros)
  text(str, x, y, h, col, mask) {
    for (const [c, fill] of [[this.g, col], [this.k, `rgb(${mask},${mask},${mask})`]]) {
      c.save(); c.translate(this.X(x), this.Y(y)); c.scale(this.sx / this.sy, 1);
      c.font = `bold ${Math.round(h * this.sy)}px Arial, sans-serif`; c.textAlign = 'center'; c.textBaseline = 'alphabetic'; c.fillStyle = fill; c.fillText(str, 0, 0); c.restore();
    }
  }
  // puntitos y manchas (solo color)
  speckle(x0, y0, x1, y1, n, lo, hi, alpha) {
    const g = this.g;
    for (let i = 0; i < n; i++) {
      const v = lo + this.rnd() * (hi - lo) | 0;
      g.fillStyle = `rgba(${v},${v},${v},${alpha * (0.3 + this.rnd() * 0.7)})`;
      g.fillRect(this.X(x0 + this.rnd() * (x1 - x0)), this.Y(y0 + this.rnd() * (y1 - y0)), 1 + this.rnd() * 2.5, 1 + this.rnd() * 2.5);
    }
  }
  stain(x, y, rx, ry, rgba) {
    const g = this.g, cx = this.X(x), cy = this.Y(y), r = Math.max(rx * this.sx, ry * this.sy);
    const gr = g.createRadialGradient(cx, cy, 0, cx, cy, r); gr.addColorStop(0, rgba); gr.addColorStop(1, 'rgba(0,0,0,0)');
    g.save(); g.translate(cx, cy); g.scale(rx * this.sx / r, ry * this.sy / r); g.translate(-cx, -cy);
    g.fillStyle = gr; g.fillRect(cx - r, cy - r, r * 2, r * 2); g.restore();
  }
  // churretes de agua que bajan desde una cornisa
  streaks(x0, x1, ytop, len, n) {
    const g = this.g;
    for (let i = 0; i < n; i++) {
      const x = this.X(x0 + this.rnd() * (x1 - x0)), y = this.Y(ytop), h = (len * (0.4 + this.rnd() * 0.6)) * this.sy, w = 2 + this.rnd() * 5;
      const gr = g.createLinearGradient(0, y, 0, y + h); gr.addColorStop(0, 'rgba(60,55,45,.22)'); gr.addColorStop(1, 'rgba(60,55,45,0)');
      g.fillStyle = gr; g.fillRect(x, y, w, h);
    }
  }
  // ladrillo a la vista donde se cayó el repello
  bricks(x0, y0, x1, y1) {
    const g = this.g, k = this.k, a = this.X(x0), b = this.Y(y1), w = (x1 - x0) * this.sx, h = (y1 - y0) * this.sy;
    g.save(); k.save();
    const jag = []; for (let i = 0; i < 22; i++) jag.push(0.62 + 0.38 * this.rnd());
    const blob = c => { c.beginPath(); const n = 22; for (let i = 0; i <= n; i++) { const t = i / n * Math.PI * 2, rr = jag[i % n]; c.lineTo(a + w / 2 + Math.cos(t) * w / 2 * rr, b + h / 2 + Math.sin(t) * h / 2 * rr); } c.closePath(); };
    blob(g); g.clip(); blob(k); k.clip();
    g.fillStyle = '#8f5a44'; g.fillRect(a, b, w, h); k.fillStyle = `rgb(${FIX},${FIX},${FIX})`; k.fillRect(a, b, w, h);
    const bh = 0.075 * this.sy, bw = 0.24 * this.sx;
    for (let yy = b, r = 0; yy < b + h; yy += bh, r++) for (let xx = a - (r % 2) * bw / 2; xx < a + w; xx += bw) {
      const v = this.rnd(); g.fillStyle = `rgb(${130 + v * 40 | 0},${76 + v * 25 | 0},${58 + v * 18 | 0})`; g.fillRect(xx + 1, yy + 1, bw - 2, bh - 2);
    }
    g.restore(); k.restore();
    // borde del repello roto
    const ctx = this.g; ctx.save(); ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5; blob(ctx); ctx.stroke(); ctx.restore();
  }
}

// ---- piezas comunes ----
function plaster(P, base = '#eeeeee') {
  P.rect(0, 0, P.W, P.H, base, WALL);
  P.speckle(0, 0, P.W, P.H, 900, 150, 255, 0.18);
  for (let i = 0; i < 4; i++) P.stain(P.rnd() * P.W, P.rnd() * P.H, 0.5 + P.rnd() * 0.9, 0.4 + P.rnd() * 0.8, 'rgba(120,110,95,.06)');
}
function plinth(P, h = 0.7, col = '#c9c9c9') {           // zócalo
  P.rect(0, 0, P.W, h, col, WALL); P.rect(0, h - 0.04, P.W, h + 0.03, '#f8f8f8', HALF);
  P.speckle(0, 0, P.W, h, 160, 90, 170, 0.25);
}
function cornice(P, h = 0.42) {                            // cornisa superior con su sombra
  P.rect(0, P.H - h, P.W, P.H, '#f7f7f7', HALF);
  P.rect(0, P.H - h - 0.06, P.W, P.H - h, '#9a9a9a', HALF);
  P.rect(0, P.H - h * 0.45, P.W, P.H - h * 0.3, '#d8d8d8', HALF);
  P.streaks(0, P.W, P.H - h - 0.05, 1.4, 6);
}
function pilasters(P, w = 0.34) {                          // pilastras en los bordes
  P.rect(0, 0, w, P.H, '#f9f9f9', HALF); P.rect(w - 0.04, 0, w, P.H, '#c4c4c4', HALF);
  P.rect(P.W - w, 0, P.W, P.H, '#f9f9f9', HALF); P.rect(P.W - w, 0, P.W - w + 0.04, P.H, '#e2e2e2', HALF);
}
function frame(P, x0, y0, x1, y1, t = 0.16) {              // marco de moldura alrededor de un vano
  P.rect(x0 - t, y0 - 0.02, x1 + t, y1 + t, '#fbfbfb', HALF);
  P.rect(x1 + t - 0.03, y0, x1 + t, y1 + t, '#cfcfcf', HALF);
}
function sill(P, x0, x1, y) {                              // repisa con sombra
  P.rect(x0 - 0.12, y - 0.1, x1 + 0.12, y, '#fdfdfd', HALF); P.rect(x0 - 0.1, y - 0.16, x1 + 0.1, y - 0.1, '#8c8c8c', HALF);
}
function dripMold(P, x0, x1, y) {                          // guardapolvo sobre el vano
  P.rect(x0 - 0.22, y, x1 + 0.22, y + 0.14, '#fdfdfd', HALF); P.rect(x0 - 0.18, y - 0.05, x1 + 0.18, y, '#9a9a9a', HALF);
}
function woodPanel(P, x0, y0, x1, y1, base = '#c9c9c9') { // tablero de madera pintada (toma el color de carpintería)
  P.rect(x0, y0, x1, y1, base, PAINT);
  const g = P.g;
  for (let i = 0; i < 14; i++) { const x = x0 + P.rnd() * (x1 - x0); g.fillStyle = `rgba(60,50,40,${0.05 + P.rnd() * 0.08})`; g.fillRect(P.X(x), P.Y(y1), 1.2, (y1 - y0) * P.sy); }
}
function raisedPanels(P, x0, y0, x1, y1, cols, rows) {     // cuarterones
  const pw = (x1 - x0) / cols, ph = (y1 - y0) / rows;
  for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
    const a = x0 + c * pw + pw * 0.16, b = y0 + r * ph + ph * 0.12, A = x0 + (c + 1) * pw - pw * 0.16, B = y0 + (r + 1) * ph - ph * 0.12;
    P.rect(a, b, A, B, '#b4b4b4', PAINT); P.rect(a, B - 0.035, A, B, '#e0e0e0', PAINT); P.rect(A - 0.03, b, A, B, '#e0e0e0', PAINT); P.rect(a, b, a + 0.03, B, '#8e8e8e', PAINT);
  }
}
function louvers(P, x0, y0, x1, y1, step = 0.085) {         // persianas de tablillas
  P.rect(x0, y0, x1, y1, '#c4c4c4', PAINT);
  for (let y = y0 + step * 0.5; y < y1; y += step) { P.rect(x0, y, x1, y + step * 0.35, '#8a8a8a', PAINT); P.rect(x0, y + step * 0.35, x1, y + step * 0.45, '#e6e6e6', PAINT); }
  P.rect(x0, y0, x0 + 0.05, y1, '#9a9a9a', PAINT); P.rect(x1 - 0.05, y0, x1, y1, '#9a9a9a', PAINT);
}
function glass(P, x0, y0, x1, y1, glowCol = '#ffcf80') {   // interior oscuro con un reflejo
  P.rect(x0, y0, x1, y1, '#2c2f33', FIX, glowCol);
  const g = P.g, gr = g.createLinearGradient(P.X(x0), P.Y(y1), P.X(x1), P.Y(y0));
  gr.addColorStop(0, 'rgba(160,185,205,.35)'); gr.addColorStop(0.5, 'rgba(160,185,205,.05)'); gr.addColorStop(1, 'rgba(160,185,205,.18)');
  g.fillStyle = gr; g.fillRect(P.X(x0), P.Y(y1), (x1 - x0) * P.sx, (y1 - y0) * P.sy);
}
// barrotes torneados de madera de las ventanas coloniales camagüeyanas: barra recta con anillos y bulbos
function balusters(P, x0, y0, x1, y1) {
  const n = Math.round((x1 - x0) / 0.115), w = (x1 - x0) / n, g = P.g, k = P.k, e = P.e;
  const bar = (cx, ya, yb, hw, shade) => {
    const X0 = P.X(cx - hw), Y0 = P.Y(yb), W = hw * 2 * P.sx, H = (yb - ya) * P.sy;
    const gs = v => 'rgb(' + v + ',' + v + ',' + v + ')';
    const gr = g.createLinearGradient(X0, 0, X0 + W, 0); gr.addColorStop(0, gs(shade - 50)); gr.addColorStop(0.45, gs(shade + 30)); gr.addColorStop(1, gs(shade - 70));
    g.fillStyle = gr; g.fillRect(X0, Y0, W, H);
    k.fillStyle = gs(PAINT); k.fillRect(X0, Y0, W, H);
    e.fillStyle = '#000'; e.fillRect(X0 / 2, Y0 / 2, W / 2 + 0.5, H / 2 + 0.5);
  };
  for (let i = 0; i < n; i++) {
    const cx = x0 + (i + 0.5) * w;
    bar(cx, y0, y1, w * 0.17, 175);
    for (let y = y0 + 0.28; y < y1 - 0.2; y += 0.42) { bar(cx, y, y + 0.05, w * 0.3, 190); bar(cx, y + 0.08, y + 0.2, w * 0.25, 165); bar(cx, y + 0.23, y + 0.28, w * 0.3, 190); }
  }
  P.rect(x0 - 0.04, y1 - 0.12, x1 + 0.04, y1, '#b8b8b8', PAINT); P.rect(x0 - 0.04, y0, x1 + 0.04, y0 + 0.12, '#b8b8b8', PAINT);
  P.rect(x0 - 0.04, (y0 + y1) / 2 - 0.04, x1 + 0.04, (y0 + y1) / 2 + 0.04, '#a8a8a8', PAINT);
}
// reja de hierro con remate de volutas
function ironGrille(P, x0, y0, x1, y1, top = true) {
  const g = P.g, k = P.k;
  const bar = (a, b, A, B) => { P.rect(a, b, A, B, '#1e1f22', FIX); };
  const n = Math.round((x1 - x0) / 0.13);
  for (let i = 0; i <= n; i++) { const x = x0 + (x1 - x0) * i / n; bar(x - 0.018, y0, x + 0.018, y1); }
  for (const y of [y0 + 0.08, y0 + (y1 - y0) * 0.5, y1 - 0.06]) bar(x0, y - 0.025, x1, y + 0.025);
  if (top) {
    g.strokeStyle = '#1e1f22'; k.strokeStyle = `rgb(${FIX},${FIX},${FIX})`; g.lineWidth = k.lineWidth = Math.max(1.5, 0.03 * P.sx);
    for (let i = 0; i < n; i += 2) {
      const cx = P.X(x0 + (x1 - x0) * (i + 1) / n), cy = P.Y(y1 - 0.2), r = 0.1 * P.sx;
      for (const c of [g, k]) { c.beginPath(); c.arc(cx - r, cy, r, 0, Math.PI * 1.6); c.stroke(); c.beginPath(); c.arc(cx + r, cy, r, Math.PI * 1.4, Math.PI * 3); c.stroke(); }
    }
  }
}
// medio punto con vitrales de colores (rojo, azul, amarillo, verde) y su radial de madera
function fanlight(P, x0, x1, y) {
  const cx = P.X((x0 + x1) / 2), cy = P.Y(y), rx = (x1 - x0) / 2 * P.sx, ry = (x1 - x0) / 2 * P.sy, g = P.g, k = P.k, e = P.e;
  const cols = ['#b5372d', '#2f5fa8', '#e2b02e', '#3a8a4c', '#e9e2cf', '#b5372d', '#2f5fa8'], glows = ['#ff6040', '#4080ff', '#ffd040', '#50d070', '#fff0d0', '#ff6040', '#4080ff'];
  const n = 7;
  for (let i = 0; i < n; i++) {
    const a0 = Math.PI + i / n * Math.PI, a1 = Math.PI + (i + 1) / n * Math.PI;
    for (const [c, f] of [[g, cols[i]], [k, `rgb(${FIX},${FIX},${FIX})`], [e, glows[i]]]) {
      const s = c === e ? 0.5 : 1;
      c.beginPath(); c.moveTo(cx * s, cy * s); c.ellipse(cx * s, cy * s, rx * s * 0.92, ry * s * 0.92, 0, a0, a1); c.closePath(); c.fillStyle = f; c.fill();
    }
  }
  // radios y aro blancos
  g.strokeStyle = '#f2f2f2'; k.strokeStyle = `rgb(${FIX},${FIX},${FIX})`; g.lineWidth = k.lineWidth = Math.max(2, 0.04 * P.sx);
  for (const c of [g, k]) {
    for (let i = 0; i <= n; i++) { const a = Math.PI + i / n * Math.PI; c.beginPath(); c.moveTo(cx, cy); c.lineTo(cx + Math.cos(a) * rx * 0.92, cy + Math.sin(a) * ry * 0.92); c.stroke(); }
    c.beginPath(); c.ellipse(cx, cy, rx * 0.3, ry * 0.3, 0, Math.PI, 0); c.stroke();
    c.beginPath(); c.ellipse(cx, cy, rx * 0.92, ry * 0.92, 0, Math.PI, 0); c.stroke();
  }
}
function railing(P, x0, x1, y0, h = 1.0) {                 // baranda de hierro de balcón
  P.rect(x0, y0 + h - 0.05, x1, y0 + h, '#1e1f22', FIX); P.rect(x0, y0 + 0.08, x1, y0 + 0.12, '#1e1f22', FIX);
  for (let x = x0; x <= x1; x += 0.11) P.rect(x - 0.012, y0, x + 0.012, y0 + h, '#1e1f22', FIX);
  const g = P.g, k = P.k; g.strokeStyle = '#1e1f22'; k.strokeStyle = `rgb(${FIX},${FIX},${FIX})`; g.lineWidth = k.lineWidth = Math.max(1.5, 0.025 * P.sx);
  for (let x = x0 + 0.22; x < x1 - 0.1; x += 0.44) for (const c of [g, k]) { c.beginPath(); c.ellipse(P.X(x), P.Y(y0 + h * 0.55), 0.09 * P.sx, 0.2 * P.sy, 0, 0, 7); c.stroke(); }
}
function weather(P, amount = 1) {                          // envejecimiento general
  for (let i = 0; i < 2 * amount; i++) P.stain(P.rnd() * P.W, 0.2 + P.rnd() * 0.8, 0.7 + P.rnd(), 0.4 + P.rnd() * 0.5, 'rgba(95,85,70,.09)');
  if (P.rnd() < 0.35 * amount) { const x = 0.35 + P.rnd() * (P.W - 2.0), y = 0.3 + P.rnd() * (P.H * 0.5); P.bricks(x, y, x + 0.9 + P.rnd() * 0.8, y + 0.6 + P.rnd() * 0.6); }
}

// ---- los 16 módulos ----
const PAINTERS = [
  // 0 ventana colonial de barrotes de madera torneada (la más típica del Camagüey antiguo)
  P => {
    plaster(P); plinth(P); pilasters(P); cornice(P);
    weather(P);
    const x0 = P.W / 2 - 0.8, x1 = P.W / 2 + 0.8;
    frame(P, x0, 0.85, x1, 3.95); glass(P, x0, 0.9, x1, 3.9, '#ffc070');
    woodPanel(P, x0 + 0.05, 0.92, x0 + 0.42, 3.86, '#9c9c9c'); woodPanel(P, x1 - 0.42, 0.92, x1 - 0.05, 3.86, '#9c9c9c');      // postigos abiertos
    balusters(P, x0 - 0.06, 0.85, x1 + 0.06, 3.95);
    sill(P, x0 - 0.06, x1 + 0.06, 0.85); dripMold(P, x0, x1, 4.12);
  },
  // 1 puerta colonial de dos hojas con medio punto de vitrales
  P => {
    plaster(P); plinth(P); pilasters(P); cornice(P);
    weather(P, 0.8);
    const x0 = P.W / 2 - 1.0, x1 = P.W / 2 + 1.0, yd = 3.55;
    frame(P, x0, 0, x1, yd, 0.2); P.arch(x0 - 0.2, x1 + 0.2, yd, '#fbfbfb', HALF);
    fanlight(P, x0, x1, yd);
    P.rect(x0 - 0.05, yd - 0.08, x1 + 0.05, yd + 0.03, '#f4f4f4', HALF);
    woodPanel(P, x0, 0.05, x1, yd - 0.06, '#c4c4c4'); raisedPanels(P, x0 + 0.05, 0.25, P.W / 2 - 0.03, yd - 0.2, 1, 4); raisedPanels(P, P.W / 2 + 0.03, 0.25, x1 - 0.05, yd - 0.2, 1, 4);
    P.rect(P.W / 2 - 0.025, 0.05, P.W / 2 + 0.025, yd - 0.06, '#6a6a6a', PAINT);
    P.rect(P.W / 2 - 0.25, 1.55, P.W / 2 - 0.17, 1.7, '#d4b048', FIX); P.rect(P.W / 2 + 0.17, 1.55, P.W / 2 + 0.25, 1.7, '#d4b048', FIX);     // aldabas
    P.rect(x0 - 0.3, 0, x1 + 0.3, 0.12, '#a4a29c', FIX);                                                        // escalón de piedra
  },
  // 2 ventana con reja de hierro voladiza y persianas francesas
  P => {
    plaster(P); plinth(P); pilasters(P); cornice(P);
    weather(P);
    const x0 = P.W / 2 - 0.75, x1 = P.W / 2 + 0.75;
    frame(P, x0, 1.0, x1, 3.75); glass(P, x0, 1.0, x1, 3.7, '#ffc878');
    louvers(P, x0 + 0.02, 1.02, P.W / 2 - 0.02, 3.66); louvers(P, P.W / 2 + 0.02, 1.02, x1 - 0.02, 3.66);
    P.rect(x0, 1.02, P.W / 2 - 0.35, 3.66, '#2c2f33', FIX, '#ffc878');                                          // una hoja entreabierta
    ironGrille(P, x0 - 0.12, 0.95, x1 + 0.12, 3.95);
    sill(P, x0 - 0.12, x1 + 0.12, 0.95); dripMold(P, x0, x1, 4.1);
  },
  // 3 paño de pared con pilastra, ventanuco alto y desconchados
  P => {
    plaster(P); plinth(P); pilasters(P); cornice(P);
    weather(P, 1.6);
    const x0 = P.W / 2 - 0.35, x1 = P.W / 2 + 0.35;
    frame(P, x0, 3.2, x1, 3.95, 0.1); glass(P, x0, 3.2, x1, 3.95); ironGrille(P, x0, 3.2, x1, 3.95, false);
  },
  // 4 planta alta: puerta balcón con baranda de hierro y frontón
  P => {
    plaster(P); pilasters(P, 0.28); cornice(P, 0.38);
    weather(P, 0.7);
    P.rect(0, 0, P.W, 0.22, '#f4f4f4', HALF); P.rect(0, 0.22, P.W, 0.26, '#a8a8a8', HALF);                  // imposta
    const x0 = P.W / 2 - 0.68, x1 = P.W / 2 + 0.68;
    P.rect(x0 - 0.45, 0.22, x1 + 0.45, 0.36, '#e8e8e8', HALF);                                                  // losa del balcón
    frame(P, x0, 0.36, x1, 3.05); glass(P, x0, 0.36, x1, 3.0, '#ffc070');
    louvers(P, x0 + 0.02, 0.4, P.W / 2 - 0.02, 2.95); P.rect(P.W / 2 + 0.02, 0.4, x1 - 0.02, 2.95, '#2c2f33', FIX, '#ffc070');
    P.rect(x0 - 0.3, 3.2, x1 + 0.3, 3.32, '#fbfbfb', HALF);                                                     // frontoncillo
    P.g.fillStyle = '#fbfbfb'; P.g.beginPath(); P.g.moveTo(P.X(x0 - 0.3), P.Y(3.32)); P.g.lineTo(P.X(P.W / 2), P.Y(3.6)); P.g.lineTo(P.X(x1 + 0.3), P.Y(3.32)); P.g.fill();
    P.k.fillStyle = `rgb(${HALF},${HALF},${HALF})`; P.k.beginPath(); P.k.moveTo(P.X(x0 - 0.3), P.Y(3.32)); P.k.lineTo(P.X(P.W / 2), P.Y(3.6)); P.k.lineTo(P.X(x1 + 0.3), P.Y(3.32)); P.k.fill();
    railing(P, x0 - 0.4, x1 + 0.4, 0.36, 1.0);
  },
  // 5 planta alta: ventana con moldura y antepecho de hierro
  P => {
    plaster(P); pilasters(P, 0.28); cornice(P, 0.38);
    weather(P, 0.7);
    P.rect(0, 0, P.W, 0.22, '#f4f4f4', HALF); P.rect(0, 0.22, P.W, 0.26, '#a8a8a8', HALF);
    const x0 = P.W / 2 - 0.62, x1 = P.W / 2 + 0.62;
    frame(P, x0, 0.9, x1, 2.95); glass(P, x0, 0.9, x1, 2.9, '#ffc878');
    louvers(P, x0 + 0.02, 0.92, x1 - 0.02, 2.86);
    P.rect(x0 + 0.3, 0.92, x1 - 0.3, 2.86, '#2c2f33', FIX, '#ffc878');
    sill(P, x0, x1, 0.9); dripMold(P, x0, x1, 3.1); railing(P, x0, x1, 0.9, 0.6);
  },
  // 6 comercio: cortina metálica a medio subir, cartel desteñido
  P => {
    plaster(P); plinth(P, 0.35); pilasters(P, 0.3); cornice(P, 0.36);
    weather(P, 0.8);
    const x0 = 0.55, x1 = P.W - 0.55;
    P.rect(x0 - 0.12, 0, x1 + 0.12, 3.55, '#fbfbfb', HALF);
    glass(P, x0, 0, x1, 3.35, '#ffe0a0');
    const top = 1.6 + P.rnd() * 1.2;
    for (let y = top; y < 3.35; y += 0.09) { P.rect(x0, y, x1, y + 0.06, '#9da1a5', FIX); P.rect(x0, y + 0.06, x1, y + 0.09, '#6d7175', FIX); }
    P.rect(x0, top - 0.05, x1, top, '#55595d', FIX);
    P.rect(x0 + 0.2, 3.65, x1 - 0.2, 4.35, '#f2f2f2', HALF); P.rect(x0 + 0.35, 3.78, x1 - 0.35, 4.22, '#b9473b', FIX);          // cartel
    P.rect(x0 + 0.55, 3.92, x0 + 1.4, 4.08, '#f0e6d0', FIX); P.rect(x0 + 1.6, 3.92, x1 - 0.6, 4.08, '#f0e6d0', FIX);
    P.speckle(x0 + 0.35, 3.78, x1 - 0.35, 4.22, 200, 200, 255, 0.25);
  },
  // 7 puerta de arco de medio punto con reja (casas del XIX y fondos de portal)
  P => {
    plaster(P); plinth(P); pilasters(P); cornice(P);
    weather(P, 0.8);
    const x0 = P.W / 2 - 0.95, x1 = P.W / 2 + 0.95, ys = 2.95;
    P.rect(x0 - 0.18, 0, x1 + 0.18, ys, '#fbfbfb', HALF); P.arch(x0 - 0.18, x1 + 0.18, ys, '#fbfbfb', HALF);
    P.rect(x0, 0, x1, ys, '#2c2f33', FIX); P.arch(x0, x1, ys, '#2c2f33', FIX, '#ffcf80');
    woodPanel(P, x0 + 0.04, 0.06, x1 - 0.04, ys - 0.1, '#bdbdbd'); raisedPanels(P, x0 + 0.08, 0.3, x1 - 0.08, ys - 0.25, 2, 3);
    fanlight(P, x0 + 0.05, x1 - 0.05, ys);
    P.rect(x0 - 0.3, 0, x1 + 0.3, 0.12, '#a4a29c', FIX);
  },
  // 8 casa de reparto: ventana de persianas con reja
  P => {
    plaster(P, '#efefef'); P.rect(0, 0, P.W, 0.45, '#cdcdcd', WALL); P.rect(0, P.H - 0.25, P.W, P.H, '#f7f7f7', HALF);
    weather(P, 0.9);
    const x0 = P.W / 2 - 0.7, x1 = P.W / 2 + 0.7;
    frame(P, x0, 0.95, x1, 2.35, 0.1); louvers(P, x0, 0.95, x1, 2.35, 0.07);
    ironGrille(P, x0 - 0.05, 0.92, x1 + 0.05, 2.4, false);
    sill(P, x0, x1, 0.95);
  },
  // 9 casa: puerta con montante y lamparita
  P => {
    plaster(P, '#efefef'); P.rect(0, 0, P.W, 0.45, '#cdcdcd', WALL); P.rect(0, P.H - 0.25, P.W, P.H, '#f7f7f7', HALF);
    weather(P, 0.8);
    const x0 = P.W / 2 - 0.5, x1 = P.W / 2 + 0.5;
    frame(P, x0, 0, x1, 2.5, 0.1); woodPanel(P, x0, 0.04, x1, 2.15, '#c4c4c4'); raisedPanels(P, x0 + 0.04, 0.2, x1 - 0.04, 2.0, 1, 3);
    glass(P, x0, 2.18, x1, 2.5, '#ffd090'); ironGrille(P, x0, 2.18, x1, 2.5, false);
    P.rect(x1 + 0.25, 2.1, x1 + 0.4, 2.3, '#f6e7b8', FIX, '#ffe8a0');
    P.rect(x0 - 0.3, 0, x1 + 0.3, 0.1, '#a4a29c', FIX);
  },
  // 10 casa: pared con ventanita de baño y contador eléctrico
  P => {
    plaster(P, '#efefef'); P.rect(0, 0, P.W, 0.45, '#cdcdcd', WALL); P.rect(0, P.H - 0.25, P.W, P.H, '#f7f7f7', HALF);
    weather(P, 1.4);
    const x0 = P.W / 2 - 0.3, x1 = P.W / 2 + 0.3;
    frame(P, x0, 1.8, x1, 2.35, 0.07); louvers(P, x0, 1.8, x1, 2.35, 0.06);
    P.rect(0.4, 1.3, 0.75, 1.75, '#d6d6d2', FIX); P.rect(0.47, 1.45, 0.68, 1.62, '#3a3d40', FIX);
  },
  // 11 edificio de paneles prefabricados: ventana de persianas y juntas
  P => {
    P.rect(0, 0, P.W, P.H, '#e6e3dc', HALF); P.speckle(0, 0, P.W, P.H, 700, 140, 230, 0.2);
    P.rect(0, 0, P.W, 0.05, '#9c9890', HALF); P.rect(0, 0, 0.04, P.H, '#a8a49c', HALF);
    const x0 = P.W / 2 - 0.8, x1 = P.W / 2 + 0.8;
    P.rect(x0 - 0.08, 0.85, x1 + 0.08, 2.35, '#f7f7f5', FIX); glass(P, x0, 0.9, x1, 2.3, '#ffd590'); louvers(P, x0, 0.9, P.W / 2, 2.3, 0.06);
    P.streaks(x0, x1, 0.82, 0.9, 4);
    for (let i = 0; i < 3; i++) P.stain(P.rnd() * P.W, P.rnd() * P.H, 0.6, 0.5, 'rgba(90,85,75,.14)');
  },
  // 12 paneles: balcón (loggia) con ropa tendida
  P => {
    P.rect(0, 0, P.W, P.H, '#e6e3dc', HALF); P.speckle(0, 0, P.W, P.H, 700, 140, 230, 0.2);
    P.rect(0, 0, P.W, 0.05, '#9c9890', HALF); P.rect(0, 0, 0.04, P.H, '#a8a49c', HALF);
    P.rect(0.35, 0.05, P.W - 0.35, 2.75, '#3a3a3a', FIX, '#ffd590');
    P.rect(0.5, 0.9, P.W - 0.5, 2.6, '#575a5c', FIX);
    P.rect(1.1, 1.1, 1.9, 2.2, '#2c2f33', FIX, '#ffd590');
    const cols = ['#c8423b', '#3d6fd1', '#f2f2f2', '#e8c23a', '#2f9c5a', '#e57ba0'];
    for (let i = 0; i < 6; i++) { const x = 0.55 + i * 0.42 + P.rnd() * 0.1; P.rect(x, 1.55 + P.rnd() * 0.2, x + 0.3, 2.3, cols[(i + Math.floor(P.rnd() * 6)) % 6], FIX); }
    P.rect(0.35, 2.3, P.W - 0.35, 2.32, '#cfcfcf', FIX);
    P.rect(0.35, 0.05, P.W - 0.35, 1.0, '#dcd9d2', HALF); P.rect(0.35, 0.96, P.W - 0.35, 1.02, '#8e8a83', HALF);              // antepecho
    P.streaks(0.4, P.W - 0.4, 0.05, 0.6, 5);
  },
  // 13 nave industrial o almacén: chapa ondulada y ventanas altas
  P => {
    P.rect(0, 0, P.W, P.H, '#d9d9d6', HALF);
    for (let x = 0; x < P.W; x += 0.12) P.rect(x, 0, x + 0.05, P.H, '#bdbdba', HALF);
    P.rect(0, 0, P.W, 0.6, '#b8b8b2', WALL);
    for (let i = 0; i < 3; i++) { const x0 = 0.5 + i * 1.9; glass(P, x0, 3.0, x0 + 1.3, 3.9, '#ffe2a8'); louvers(P, x0, 3.0, x0 + 1.3, 3.9, 0.12); }
    P.streaks(0, P.W, 4.4, 3.0, 12);
    for (let i = 0; i < 4; i++) P.stain(P.rnd() * P.W, P.rnd() * 2, 1.2, 0.7, 'rgba(110,80,50,.16)');
  },
  // 14 iglesia: muro de sillería con ventana de arco y vitral
  P => {
    plaster(P, '#ececec');
    for (let y = 0.35; y < P.H; y += 0.42) P.rect(0, y, P.W, y + 0.02, '#cdcdcd', WALL);
    for (let y = 0, r = 0; y < P.H; y += 0.42, r++) for (let x = (r % 2) * 0.45; x < P.W; x += 0.9) P.rect(x, y, x + 0.02, y + 0.42, '#d2d2d2', WALL);
    P.rect(0, 0, 0.55, P.H, '#f6f6f6', HALF); P.rect(0.5, 0, 0.55, P.H, '#bdbdbd', HALF);                      // contrafuerte
    P.rect(P.W - 0.55, 0, P.W, P.H, '#f6f6f6', HALF);
    const x0 = P.W / 2 - 0.7, x1 = P.W / 2 + 0.7;
    P.rect(x0 - 0.15, 2.2, x1 + 0.15, 4.6, '#fbfbfb', HALF); P.arch(x0 - 0.15, x1 + 0.15, 4.6, '#fbfbfb', HALF);
    P.rect(x0, 2.3, x1, 4.6, '#38404c', FIX, '#e8b060'); P.arch(x0, x1, 4.6, '#38404c', FIX, '#e8b060');
    for (let x = x0 + 0.35; x < x1; x += 0.35) P.rect(x - 0.02, 2.3, x + 0.02, 5.3, '#d8d0b8', FIX);
    P.rect(x0, 3.4, x1, 3.44, '#d8d0b8', FIX);
    P.stain(x0 + 0.3, 3.2, 0.25, 0.4, 'rgba(180,60,50,.35)'); P.stain(x1 - 0.3, 3.8, 0.25, 0.4, 'rgba(60,90,170,.35)');
    P.rect(0, 0, P.W, 0.6, '#cfcfcf', WALL);
    weather(P, 1.1);
  },
  // 15 medianera: pared ciega muy curtida, con ladrillo a la vista
  P => {
    plaster(P, '#e7e7e7');
    for (let i = 0; i < 8; i++) P.stain(P.rnd() * P.W, P.rnd() * P.H, 0.8 + P.rnd() * 1.5, 0.5 + P.rnd(), 'rgba(90,80,65,.14)');
    P.streaks(0, P.W, P.H, 3, 14);
    for (let i = 0; i < 3; i++) { const x = P.rnd() * (P.W - 1.2), y = P.rnd() * (P.H - 1); P.bricks(x, y, x + 0.6 + P.rnd() * 0.8, y + 0.4 + P.rnd() * 0.6); }
    P.rect(0, 0, P.W, 0.5, '#d0d0d0', WALL);
  },
  // 16 reja de hierro sobre murete, con pilares (cerca de jardín de los repartos). Lo que no se pinta es transparente.
  P => {
    P.rect(0, 0, P.W, 0.55, '#e8e8e8', WALL); P.rect(0, 0.5, P.W, 0.58, '#f6f6f6', HALF); P.speckle(0, 0, P.W, 0.55, 120, 90, 170, 0.25);
    P.rect(0, 0, 0.32, 1.75, '#ececec', WALL); P.rect(P.W - 0.32, 0, P.W, 1.75, '#ececec', WALL);
    P.rect(-0.02, 1.7, 0.34, 1.82, '#f6f6f6', HALF); P.rect(P.W - 0.34, 1.7, P.W + 0.02, 1.82, '#f6f6f6', HALF);
    for (let x = 0.42; x < P.W - 0.35; x += 0.13) P.rect(x - 0.016, 0.58, x + 0.016, 1.55, '#9a9a9a', PAINT);
    P.rect(0.32, 0.62, P.W - 0.32, 0.67, '#9a9a9a', PAINT); P.rect(0.32, 1.49, P.W - 0.32, 1.55, '#9a9a9a', PAINT);
    for (let x = 0.42; x < P.W - 0.35; x += 0.26) P.rect(x - 0.03, 1.55, x + 0.03, 1.66, '#9a9a9a', PAINT);
  },
  // 17 malla de alambre verde con postes (muy común en los repartos)
  P => {
    const g = P.g, k = P.k;
    for (const x of [0.06, P.W / 2, P.W - 0.06]) P.rect(x - 0.035, 0, x + 0.035, 1.85, '#2f5a3e', FIX);
    P.rect(0, 1.77, P.W, 1.82, '#2f5a3e', FIX); P.rect(0, 0.05, P.W, 0.1, '#2f5a3e', FIX);
    g.strokeStyle = '#3d7a52'; k.strokeStyle = 'rgb(255,255,255)'; g.lineWidth = k.lineWidth = Math.max(1.2, 0.013 * P.sx);
    for (let x = -2; x < P.W + 2; x += 0.11) for (const c of [g, k]) {
      c.beginPath(); c.moveTo(P.X(x), P.Y(0.1)); c.lineTo(P.X(x + 1.67), P.Y(1.77)); c.stroke();
      c.beginPath(); c.moveTo(P.X(x + 1.67), P.Y(0.1)); c.lineTo(P.X(x), P.Y(1.77)); c.stroke();
    }
  },
  // 18 murete repellado con pilares y calados de balaustres de cemento
  P => {
    P.rect(0, 0, P.W, 0.95, '#ececec', WALL); P.rect(0, 0.9, P.W, 1.0, '#f8f8f8', HALF);
    P.speckle(0, 0, P.W, 0.95, 200, 120, 220, 0.2); P.stain(1.2, 0.3, 0.8, 0.3, 'rgba(95,85,70,.12)');
    P.rect(0, 0, 0.36, 1.6, '#ececec', WALL); P.rect(P.W - 0.36, 0, P.W, 1.6, '#ececec', WALL);
    P.rect(-0.02, 1.55, 0.38, 1.66, '#f8f8f8', HALF); P.rect(P.W - 0.38, 1.55, P.W + 0.02, 1.66, '#f8f8f8', HALF);
    for (let x = 0.5; x < P.W - 0.45; x += 0.22) { P.rect(x - 0.05, 1.0, x + 0.05, 1.4, '#e9e9e9', HALF); P.rect(x - 0.075, 1.12, x + 0.075, 1.24, '#e9e9e9', HALF); }
    P.rect(0.36, 1.38, P.W - 0.36, 1.46, '#f6f6f6', HALF);
  },
  // 19 planta alta colonial con balcón corrido de madera, pies derechos y tejadillo de teja
  P => {
    plaster(P); weather(P, 0.6); pilasters(P, 0.26);
    P.rect(0, 0, P.W, 0.25, '#f2f2f2', HALF);
    const x0 = P.W / 2 - 0.7, x1 = P.W / 2 + 0.7;
    frame(P, x0, 0.3, x1, 2.9); woodPanel(P, x0, 0.32, x1, 2.88, '#bdbdbd'); raisedPanels(P, x0 + 0.04, 0.5, x1 - 0.04, 2.7, 2, 3);
    glass(P, x0 + 0.1, 2.55, x1 - 0.1, 2.85, '#ffc070');
    P.rect(0, 0.25, P.W, 0.38, '#a9a9a9', PAINT);
    balusters(P, 0.05, 0.38, P.W - 0.05, 1.3);
    P.rect(0.1, 0.38, 0.22, 3.55, '#9a9a9a', PAINT); P.rect(P.W - 0.22, 0.38, P.W - 0.1, 3.55, '#9a9a9a', PAINT);
    P.rect(0, 3.5, P.W, 3.62, '#8a8a8a', PAINT);
    for (let x = 0; x < P.W; x += 0.18) { P.rect(x, 3.62, x + 0.16, 3.95, '#a95b3c', FIX); P.rect(x + 0.02, 3.62, x + 0.06, 3.95, '#c87a55', FIX); }
    P.rect(0, 3.62, P.W, 3.66, '#5a3020', FIX); P.rect(0, 3.95, P.W, 4.2, '#f0f0f0', HALF);
  },
  // 20 planta alta ecléctica: ventana de arco con clave, balaustrada y ménsulas
  P => {
    plaster(P); weather(P, 0.5); pilasters(P, 0.3); cornice(P, 0.45);
    P.rect(0, 0, P.W, 0.22, '#f4f4f4', HALF);
    const x0 = P.W / 2 - 0.62, x1 = P.W / 2 + 0.62, ys = 2.6;
    P.rect(x0 - 0.18, 0.75, x1 + 0.18, ys, '#fbfbfb', HALF); P.arch(x0 - 0.18, x1 + 0.18, ys, '#fbfbfb', HALF);
    glass(P, x0, 0.8, x1, ys, '#ffc878'); P.arch(x0, x1, ys, '#2c2f33', FIX, '#ffc878');
    louvers(P, x0 + 0.02, 0.82, P.W / 2 - 0.02, ys - 0.05);
    P.rect(P.W / 2 - 0.12, ys + 0.42, P.W / 2 + 0.12, ys + 0.72, '#fbfbfb', HALF);
    P.rect(x0 - 0.45, 0.22, x1 + 0.45, 0.3, '#f2f2f2', HALF); P.rect(x0 - 0.45, 0.82, x1 + 0.45, 0.9, '#f2f2f2', HALF);
    for (let x = x0 - 0.35; x < x1 + 0.4; x += 0.16) { P.rect(x - 0.035, 0.3, x + 0.035, 0.82, '#e8e8e8', HALF); P.rect(x - 0.055, 0.45, x + 0.055, 0.6, '#e8e8e8', HALF); }
    for (let x = 0.5; x < P.W; x += 0.7) P.rect(x - 0.06, P.H - 0.62, x + 0.06, P.H - 0.45, '#f6f6f6', HALF);
  },
  // 21 planta alta art déco: aletas verticales, ventana corrida y escalonado
  P => {
    plaster(P, '#efefef'); weather(P, 0.4);
    P.rect(0, 0, P.W, 0.18, '#f8f8f8', HALF); P.rect(0, P.H - 0.5, P.W, P.H, '#f8f8f8', HALF);
    for (const x of [0.3, P.W - 0.3]) { P.rect(x - 0.14, 0, x + 0.14, P.H, '#f6f6f6', HALF); P.rect(x + 0.1, 0, x + 0.14, P.H, '#c8c8c8', HALF); }
    const x0 = 0.75, x1 = P.W - 0.75;
    P.rect(x0 - 0.08, 0.85, x1 + 0.08, 2.75, '#fbfbfb', HALF); glass(P, x0, 0.9, x1, 2.7, '#ffd090');
    for (let k = 1; k < 3; k++) { const x = x0 + (x1 - x0) * k / 3; P.rect(x - 0.02, 0.9, x + 0.02, 2.7, '#f4f4f4', FIX); }
    P.rect(x0, 2.1, x1, 2.13, '#f4f4f4', FIX);
    P.rect(P.W / 2 - 0.6, 3.0, P.W / 2 + 0.6, 3.08, '#f8f8f8', HALF); P.rect(P.W / 2 - 0.4, 3.08, P.W / 2 + 0.4, 3.16, '#f8f8f8', HALF); P.rect(P.W / 2 - 0.2, 3.16, P.W / 2 + 0.2, 3.24, '#f8f8f8', HALF);
  },
  // 22 planta baja art déco: gran entrada de hierro y vidrio con relieves geométricos
  P => {
    plaster(P, '#efefef'); weather(P, 0.5); P.rect(0, 0, P.W, 0.6, '#c8c8c8', WALL);
    for (const x of [0.3, P.W - 0.3]) P.rect(x - 0.16, 0, x + 0.16, P.H, '#f6f6f6', HALF);
    const x0 = P.W / 2 - 0.95, x1 = P.W / 2 + 0.95;
    P.rect(x0 - 0.15, 0, x1 + 0.15, 3.6, '#fbfbfb', HALF); glass(P, x0, 0, x1, 3.45, '#ffe0a0');
    P.rect(x0, 0, x1, 2.6, '#2a2c30', FIX); for (let x = x0 + 0.2; x < x1; x += 0.35) P.rect(x - 0.02, 0, x + 0.02, 2.6, '#8c8f93', FIX);
    P.rect(x0, 2.6, x1, 2.66, '#8c8f93', FIX);
    for (let k = 0; k < 5; k++) P.line(P.W / 2, 2.7, x0 + (x1 - x0) * k / 4, 3.42, '#8c8f93', 2, FIX);
    P.rect(P.W / 2 - 1.3, 3.75, P.W / 2 + 1.3, 3.9, '#f8f8f8', HALF); P.rect(P.W / 2 - 1.0, 3.9, P.W / 2 + 1.0, 4.05, '#f8f8f8', HALF);
    P.rect(0, P.H - 0.4, P.W, P.H, '#f8f8f8', HALF);
  },
  // 23 tienda con vidriera y letrero pintado ("CAFETERÍA")
  P => {
    plaster(P); weather(P, 0.5); plinth(P, 0.3); pilasters(P, 0.3); cornice(P, 0.36);
    const x0 = 0.5, x1 = P.W - 0.5;
    P.rect(x0 - 0.1, 0, x1 + 0.1, 3.5, '#fbfbfb', HALF);
    glass(P, x0, 0.45, x1, 3.3, '#fff0c0'); P.rect(x0, 0, x1, 0.45, '#d8d8d8', WALL);
    for (let k = 1; k < 3; k++) { const x = x0 + (x1 - x0) * k / 3; P.rect(x - 0.03, 0.45, x + 0.03, 3.3, '#e8e8e8', FIX); }
    for (let i = 0; i < 7; i++) { const x = x0 + 0.2 + P.rnd() * (x1 - x0 - 0.6); P.rect(x, 0.5, x + 0.25, 0.8 + P.rnd() * 0.5, ['#d94a4a', '#3d6fd1', '#f0c040', '#2f9c5a', '#f2f2f2'][i % 5], FIX); }
    P.rect(x0, 3.6, x1, 4.35, '#2f5fa8', FIX); P.text('CAFETERÍA', P.W / 2, 3.78, 0.42, '#f6f1e0', FIX);
  },
  // 24 casa con portal (arco rebajado, columnas, puerta y ventana en la sombra)
  P => {
    plaster(P, '#efefef'); weather(P, 0.6); P.rect(0, P.H - 0.3, P.W, P.H, '#f7f7f7', HALF);
    const x0 = 0.25, x1 = P.W - 0.25;
    P.rect(x0, 0, x1, 2.6, '#4f4c47', FIX);
    P.rect(x0 + 0.45, 0.15, x0 + 1.25, 2.25, '#6a5442', FIX); P.rect(x1 - 1.3, 0.9, x1 - 0.45, 2.0, '#33363a', FIX, '#ffd090');
    for (let y = 1.0; y < 2.0; y += 0.08) P.rect(x1 - 1.3, y, x1 - 0.45, y + 0.03, '#777', FIX);
    P.rect(x0, 2.5, x1, 2.75, '#f6f6f6', HALF);
    P.rect(x0, 0, x0 + 0.24, 2.55, '#f6f6f6', HALF); P.rect(x1 - 0.24, 0, x1, 2.55, '#f6f6f6', HALF);
    P.rect(0, 0, P.W, 0.16, '#b8b4ab', FIX);
    for (let x = x0 + 0.35; x < x1 - 0.3; x += 0.12) P.rect(x - 0.015, 0.16, x + 0.015, 0.95, '#9a9a9a', PAINT);
    P.rect(x0 + 0.24, 0.9, x1 - 0.24, 0.96, '#9a9a9a', PAINT);
  },
  // 25 casa con ventana de persianas de aluminio ("Miami") blancas y reja
  P => {
    plaster(P, '#efefef'); weather(P, 0.7); P.rect(0, 0, P.W, 0.4, '#cdcdcd', WALL); P.rect(0, P.H - 0.25, P.W, P.H, '#f7f7f7', HALF);
    const x0 = P.W / 2 - 0.75, x1 = P.W / 2 + 0.75;
    P.rect(x0 - 0.06, 0.9, x1 + 0.06, 2.3, '#f4f4f2', FIX); glass(P, x0, 0.95, x1, 2.25, '#ffd090');
    for (let y = 1.0; y < 2.22; y += 0.11) { P.rect(x0, y, x1, y + 0.07, '#e9ece9', FIX); P.rect(x0, y + 0.06, x1, y + 0.075, '#9aa0a2', FIX); }
    P.rect(P.W / 2 - 0.02, 0.95, P.W / 2 + 0.02, 2.25, '#f4f4f2', FIX);
    for (let x = x0 - 0.04; x <= x1 + 0.05; x += 0.15) P.rect(x - 0.015, 0.88, x + 0.015, 2.33, '#9a9a9a', PAINT);
    P.rect(x0 - 0.06, 1.6, x1 + 0.06, 1.64, '#9a9a9a', PAINT);
    sill(P, x0, x1, 0.9);
  },
  // 26 puerta colonial sencilla con postigo y montante de barrotes
  P => {
    plaster(P); weather(P, 0.8); plinth(P); pilasters(P); cornice(P);
    const x0 = P.W / 2 - 0.9, x1 = P.W / 2 + 0.9, yd = 3.3;
    frame(P, x0, 0, x1, yd + 0.75, 0.18);
    glass(P, x0, yd + 0.05, x1, yd + 0.7, '#ffc878'); ironGrille(P, x0, yd + 0.05, x1, yd + 0.7, false);
    P.rect(x0, yd - 0.04, x1, yd + 0.05, '#f2f2f2', HALF);
    woodPanel(P, x0, 0.05, x1, yd - 0.04, '#c4c4c4'); raisedPanels(P, x0 + 0.05, 0.2, P.W / 2 - 0.03, yd - 0.2, 1, 3); raisedPanels(P, P.W / 2 + 0.03, 0.2, x1 - 0.05, yd - 0.2, 1, 3);
    P.rect(P.W / 2 + 0.15, 0.25, x1 - 0.15, 1.95, '#a8a8a8', PAINT); P.rect(P.W / 2 + 0.15, 1.92, x1 - 0.15, 1.95, '#e0e0e0', PAINT);     // postigo
    P.rect(P.W / 2 - 0.025, 0.05, P.W / 2 + 0.025, yd - 0.04, '#6a6a6a', PAINT);
    P.rect(x0 - 0.3, 0, x1 + 0.3, 0.12, '#a4a29c', FIX);
  },
  // 27 ventana colonial con los postigos de madera cerrados detrás de la reja
  P => {
    plaster(P); weather(P); plinth(P); pilasters(P); cornice(P);
    const x0 = P.W / 2 - 0.78, x1 = P.W / 2 + 0.78;
    frame(P, x0, 0.9, x1, 3.85);
    woodPanel(P, x0, 0.92, P.W / 2, 3.83, '#bcbcbc'); woodPanel(P, P.W / 2, 0.92, x1, 3.83, '#b4b4b4');
    raisedPanels(P, x0 + 0.05, 1.0, P.W / 2 - 0.03, 3.7, 1, 3); raisedPanels(P, P.W / 2 + 0.03, 1.0, x1 - 0.05, 3.7, 1, 3);
    ironGrille(P, x0 - 0.1, 0.88, x1 + 0.1, 3.95, true);
    sill(P, x0 - 0.1, x1 + 0.1, 0.88); dripMold(P, x0, x1, 4.1);
  },
  // 28 planta alta con balcón corrido de hierro (edificios eclécticos de República, Maceo, Independencia)
  P => {
    plaster(P); weather(P, 0.5); pilasters(P, 0.26); cornice(P, 0.42);
    P.rect(0, 0, P.W, 0.3, '#e9e9e9', HALF); P.rect(0, 0.3, P.W, 0.34, '#9c9c9c', HALF);
    const x0 = P.W / 2 - 0.65, x1 = P.W / 2 + 0.65;
    frame(P, x0, 0.34, x1, 3.0); glass(P, x0, 0.36, x1, 2.95, '#ffc878');
    louvers(P, x0 + 0.02, 0.38, x1 - 0.02, 2.9); P.rect(P.W / 2 - 0.3, 0.38, P.W / 2 + 0.3, 2.9, '#2c2f33', FIX, '#ffc878');
    dripMold(P, x0, x1, 3.12);
    railing(P, 0, P.W, 0.34, 1.0);
  },
  // 29 escalera de los edificios de paneles: franja de bloques de vidrio
  P => {
    P.rect(0, 0, P.W, P.H, '#e6e3dc', HALF); P.speckle(0, 0, P.W, P.H, 700, 140, 230, 0.2);
    const x0 = P.W / 2 - 0.55, x1 = P.W / 2 + 0.55;
    P.rect(x0 - 0.06, 0, x1 + 0.06, P.H, '#f2f2f0', FIX);
    for (let y = 0.05; y < P.H; y += 0.19) for (let x = x0; x < x1 - 0.05; x += 0.19) P.rect(x + 0.015, y + 0.015, x + 0.175, y + 0.175, '#a9c2cc', FIX, '#ffe2a8');
    P.streaks(0, P.W, P.H, 1.5, 5);
  },
  // 30 planta alta de casa: ventana de persianas con balconcito de hormigón
  P => {
    plaster(P, '#efefef'); weather(P, 0.6); P.rect(0, P.H - 0.25, P.W, P.H, '#f7f7f7', HALF); P.rect(0, 0, P.W, 0.15, '#f0f0f0', HALF);
    const x0 = P.W / 2 - 0.6, x1 = P.W / 2 + 0.6;
    frame(P, x0, 0.25, x1, 2.4, 0.08); louvers(P, x0, 0.25, x1, 2.4, 0.07); P.rect(P.W / 2 - 0.25, 0.25, P.W / 2 + 0.25, 2.4, '#2c2f33', FIX, '#ffd090');
    P.rect(x0 - 0.35, 0.15, x1 + 0.35, 0.28, '#dedbd2', HALF);
    for (let x = x0 - 0.3; x <= x1 + 0.31; x += 0.2) P.rect(x - 0.03, 0.28, x + 0.03, 1.05, '#e9e9e9', HALF);
    P.rect(x0 - 0.35, 1.0, x1 + 0.35, 1.08, '#e9e9e9', HALF);
  },
  // 31 bodega (la tienda del barrio): rejas, letrero pintado a mano y pizarra
  P => {
    plaster(P); weather(P, 0.9); plinth(P, 0.5); pilasters(P, 0.3); cornice(P, 0.36);
    const x0 = 0.55, x1 = P.W - 0.55;
    P.rect(x0 - 0.12, 0, x1 + 0.12, 3.3, '#fbfbfb', HALF); glass(P, x0, 0, x1, 3.1, '#ffd890');
    for (let x = x0 + 0.06; x < x1; x += 0.14) P.rect(x - 0.018, 0, x + 0.018, 3.1, '#9a9a9a', PAINT);
    P.rect(x0, 1.1, x1, 1.16, '#9a9a9a', PAINT); P.rect(x0, 2.2, x1, 2.26, '#9a9a9a', PAINT);
    P.rect(x0 + 0.2, 1.3, x0 + 1.0, 1.95, '#26302a', FIX); for (let i = 0; i < 4; i++) P.rect(x0 + 0.3, 1.4 + i * 0.13, x0 + 0.5 + P.rnd() * 0.4, 1.44 + i * 0.13, '#e8e8e0', FIX);
    P.rect(x0, 3.45, x1, 4.2, '#efe6c9', FIX); P.text('BODEGA', P.W / 2, 3.6, 0.48, '#a32a24', FIX);
  },
];

let cache = null;
// Construye el atlas (una sola vez): textura de color con máscara en alfa (DataTexture, sin pérdidas) y textura de luces
export function facadeMaps(renderer) {
  if (cache) return cache;
  const S = Q.lowTex ? 256 : 512, NW = S * COLS, NH = S * ROWS;
  const mk = (w, h) => { const c = document.createElement('canvas'); c.width = w; c.height = h; return c; };
  const cg = mk(NW, NH), ck = mk(NW, NH), ce = mk(NW / 2, NH / 2);
  const g = cg.getContext('2d', { willReadFrequently: true }), k = ck.getContext('2d', { willReadFrequently: true }), e = ce.getContext('2d');
  e.fillStyle = '#000'; e.fillRect(0, 0, NW / 2, NH / 2);
  const P = new Pen(g, k, e, S);
  PAINTERS.forEach((paint, i) => {
    P.cell(i);
    g.save(); k.save(); e.save();
    const clip = c => { c.beginPath(); const s = c === e ? 0.5 : 1; c.rect(P.ox * s, P.oy * s, S * s, S * s); c.clip(); };
    clip(g); clip(k); clip(e);
    paint(P);
    g.restore(); k.restore(); e.restore();
  });
  const col = g.getImageData(0, 0, NW, NH).data, msk = k.getImageData(0, 0, NW, NH).data, data = new Uint8Array(NW * NH * 4);
  for (let y = 0; y < NH; y++) {                    // filas al revés: en la textura v = 0 es abajo
    const src = y * NW * 4, dst = (NH - 1 - y) * NW * 4;
    for (let x = 0; x < NW * 4; x += 4) { data[dst + x] = col[src + x]; data[dst + x + 1] = col[src + x + 1]; data[dst + x + 2] = col[src + x + 2]; data[dst + x + 3] = msk[src + x]; }
  }
  const atlas = new THREE.DataTexture(data, NW, NH, THREE.RGBAFormat);
  atlas.generateMipmaps = true; atlas.minFilter = THREE.LinearMipmapLinearFilter; atlas.magFilter = THREE.LinearFilter;
  atlas.anisotropy = Math.min(4, env.maxAniso); atlas.needsUpdate = true;
  const glow = new THREE.CanvasTexture(ce); glow.flipY = true; glow.generateMipmaps = true; glow.minFilter = THREE.LinearMipmapLinearFilter;
  const webgl2 = !!(renderer && renderer.capabilities.isWebGL2);
  cache = { atlas, glow, webgl2 };
  return cache;
}

const NOISE = `
float h21(vec2 p) { p = fract(p * vec2(0.1031, 0.1030)); p += dot(p, p.yx + 33.33); return fract((p.x + p.y) * p.x); }
float vnoise(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(h21(i), h21(i + vec2(1.0, 0.0)), f.x), mix(h21(i + vec2(0.0, 1.0)), h21(i + vec2(1.0, 1.0)), f.x), f.y); }`;

// colores de la carpintería: madera, verde botella, azul, turquesa, blanco, rojo óxido…
const DOOR_PAL = `
vec3 doorPal(float r) {
  if (r < 0.18) return vec3(0.42, 0.26, 0.15);
  if (r < 0.32) return vec3(0.16, 0.36, 0.27);
  if (r < 0.45) return vec3(0.20, 0.36, 0.60);
  if (r < 0.57) return vec3(0.32, 0.66, 0.66);
  if (r < 0.70) return vec3(0.92, 0.92, 0.88);
  if (r < 0.80) return vec3(0.50, 0.18, 0.13);
  if (r < 0.90) return vec3(0.62, 0.45, 0.28);
  return vec3(0.12, 0.27, 0.22);
}`;

// Material de las fachadas: atlas + color del edificio + carpintería + humedad y manchas + ventanas encendidas al azar de noche
export function facadeMaterial(maps, cutout = false) {
  const m = new THREE.MeshLambertMaterial({ map: maps.atlas, vertexColors: true, emissive: 0xffffff, emissiveMap: maps.glow, emissiveIntensity: 0 });
  m.defines = {}; if (maps.webgl2) m.defines.ATLAS_GRAD = ''; if (cutout) { m.defines.CUTOUT = ''; m.side = THREE.DoubleSide; }
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 tileInfo;\nvarying vec2 vTI;\nvarying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvTI = tileInfo.xy;\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vTI;\nvarying vec3 vWP;\n' + NOISE + DOOR_PAL)
      .replace('#include <map_fragment>', `
        float mi = vTI.x;
        vec2 cellO = vec2(mod(mi, 8.0) * 0.125, (3.0 - floor(mi / 8.0)) * 0.25);
        vec2 fu = fract(vUv);
        vec2 auv = cellO + (vec2(0.006) + fu * 0.988) * vec2(0.125, 0.25);
        vec2 suv = vUv * vec2(0.1235, 0.247);
        #ifdef ATLAS_GRAD
          vec4 tx = textureGrad(map, auv, dFdx(suv), dFdy(suv));
        #else
          vec4 tx = texture2D(map, auv);
        #endif
        float a = tx.a;
        #ifdef CUTOUT
          if (a < 0.12) discard;                    // huecos de rejas y mallas (solo en su material: discard es caro)
        #endif
        float rb = vTI.y / 255.0;
        vec3 wallC = vColor;
        vec3 halfC = mix(vec3(1.0), wallC, 0.35);
        vec3 paintC = doorPal(fract(rb * 7.13)) * 1.3;
        vec3 tint;
        if (a > 0.78) tint = mix(halfC, vec3(1.0), (a - 0.78) / 0.22);
        else if (a > 0.55) tint = mix(wallC, halfC, (a - 0.55) / 0.23);
        else tint = mix(paintC, wallC, clamp((a - 0.31) / 0.24, 0.0, 1.0));
        float plasterW = smoothstep(0.45, 0.53, a) * (1.0 - smoothstep(0.6, 0.7, a));
        float nz = vnoise(vWP.xz * 0.21 + vec2(vWP.y * 0.33, rb * 19.0)) * 0.65 + vnoise(vWP.xz * 1.3 + vWP.y * 1.1) * 0.35;
        float base = (1.0 - smoothstep(0.02, 0.2, vUv.y)) * step(-0.05, vUv.y);
        tint *= 1.0 - plasterW * (0.20 * base + 0.16 * smoothstep(0.55, 0.85, nz));
        tint *= 0.95 + 0.1 * nz;
        diffuseColor.rgb *= tx.rgb * tint;
      `)
      .replace('#include <color_fragment>', '')
      .replace('#include <emissivemap_fragment>', `
        #ifdef ATLAS_GRAD
          vec4 et = textureGrad(emissiveMap, auv, dFdx(suv), dFdy(suv));
        #else
          vec4 et = texture2D(emissiveMap, auv);
        #endif
        float lit = step(0.58, h21(floor(vUv) + vec2(rb * 31.7, mi * 3.1)));
        totalEmissiveRadiance *= et.rgb * lit;
      `);
  };
  m.customProgramCacheKey = () => 'facade-v3' + (maps.webgl2 ? 'g' : '') + (cutout ? 'c' : '');
  return m;
}

// Material de techos: teja criolla en los inclinados (canales y filas) y losa de azotea en los planos, sin texturas
export function roofMaterial() {
  const m = new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide });
  m.onBeforeCompile = sh => {
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvWP = (modelMatrix * vec4(position, 1.0)).xyz;\nvWN = normal;');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vWP;\nvarying vec3 vWN;\n' + NOISE)
      .replace('#include <color_fragment>', `#include <color_fragment>
        {
          vec3 n = normalize(vWN);
          float dist = length(vWP - cameraPosition);
          float fade = 1.0 - smoothstep(70.0, 260.0, dist);
          float age = vnoise(vWP.xz * 0.12) * 0.6 + vnoise(vWP.xz * 0.6) * 0.4;
          if (abs(n.y) < 0.965) {
            vec2 d = normalize(n.xz + vec2(1e-4));
            float along = dot(vWP.xz, d), across = dot(vWP.xz, vec2(-d.y, d.x));
            float ch = abs(fract(across / 0.26) - 0.5) * 2.0;
            float course = fract(along / 0.34);
            float tv = h21(floor(vec2(across / 0.26, along / 0.34)));
            float sh = (0.74 + 0.26 * (1.0 - ch * ch)) * (0.8 + 0.2 * smoothstep(0.0, 0.2, course)) * (0.88 + 0.24 * tv);
            diffuseColor.rgb *= mix(1.0, sh, fade) * (0.84 + 0.26 * age);
          } else {
            vec2 q = vWP.xz / 1.6; vec2 fq = abs(fract(q) - 0.5);
            float joint = smoothstep(0.46, 0.5, max(fq.x, fq.y));
            float g = vnoise(vWP.xz * 0.4) * 0.6 + vnoise(vWP.xz * 2.3) * 0.4;
            diffuseColor.rgb *= (0.84 + 0.22 * g) * mix(1.0, 0.84, joint * fade) * (0.9 + 0.15 * age);
          }
        }`);
  };
  m.customProgramCacheKey = () => 'roof-v1';
  return m;
}

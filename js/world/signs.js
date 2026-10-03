// Letreros de los comercios de Camagüey (pintados en un atlas de 4 x 8): TRD Caribe, CADECA, ETECSA, panadería, farmacia…
// Se ponen sobre la banda de cartel de las tiendas, un poco por delante de la fachada.
import { Q } from '../config.js';

const SIGNS = [
  { t: 'TRD CARIBE', bg: '#c8282d', fg: '#ffffff', sub: 'TIENDA' },
  { t: 'CADECA', bg: '#1f4f9a', fg: '#ffffff', sub: 'CASA DE CAMBIO' },
  { t: 'ETECSA', bg: '#f2f2f2', fg: '#1f4f9a', sub: 'TELEPUNTO' },
  { t: 'PANADERÍA', bg: '#e9d9a8', fg: '#7a3b1c' },
  { t: 'FARMACIA', bg: '#f2f2f2', fg: '#1f8f4a', cross: true },
  { t: 'DULCERÍA', bg: '#f2c6d4', fg: '#9a1f4f' },
  { t: 'BARBERÍA', bg: '#2f2f33', fg: '#f2f2f2', pole: true },
  { t: 'CORREOS DE CUBA', bg: '#f2c230', fg: '#1f3f7a' },
  { t: 'PIZZERÍA', bg: '#2f8c4a', fg: '#ffffff' },
  { t: 'LIBRERÍA', bg: '#5a3a26', fg: '#f2e6c8' },
  { t: 'MERCADO IDEAL', bg: '#2a6fd0', fg: '#ffffff' },
  { t: 'LA PRIMAVERA', bg: '#e8e2d0', fg: '#c8282d' },
  { t: 'PELUQUERÍA', bg: '#e57ba0', fg: '#ffffff' },
  { t: 'RESTAURANTE', bg: '#7a1f1f', fg: '#f2d48a' },
  { t: 'CAFETERÍA EL RÁPIDO', bg: '#e8c23a', fg: '#c8282d' },
  { t: 'AGROMERCADO', bg: '#3f8f4a', fg: '#f2f2e0' },
  { t: 'PALADAR', bg: '#1f1f22', fg: '#e8c23a' },
  { t: 'CASA DEL HABANO', bg: '#5a2a1a', fg: '#e8c88a' },
  { t: 'ÓPTICA', bg: '#f2f2f2', fg: '#2a6fd0' },
  { t: 'FERRETERÍA', bg: '#d8742a', fg: '#ffffff' },
  { t: 'CUBANA DE AVIACIÓN', bg: '#1f3f7a', fg: '#ffffff' },
  { t: 'BANCO METROPOLITANO', bg: '#1f6f8f', fg: '#ffffff' },
  { t: 'ZAPATERÍA', bg: '#e9e2cc', fg: '#3a2a1a' },
  { t: 'HELADERÍA', bg: '#8fd0e8', fg: '#c8282d' },
  { t: 'CASA DE LA CULTURA', bg: '#f2e6c2', fg: '#7a3b1c' },
  { t: 'BAZAR', bg: '#9a3fb0', fg: '#ffffff' },
  { t: 'MINIMERCADO', bg: '#c8282d', fg: '#f2e6c2' },
  { t: 'FOTO ESTUDIO', bg: '#2f2f33', fg: '#8fd0e8' },
  { t: 'SASTRERÍA', bg: '#e8dcc0', fg: '#2f2f33' },
  { t: 'TALLER', bg: '#5a6a72', fg: '#f2f2f2' },
  { t: 'CAFÉ', bg: '#3a2418', fg: '#e8c88a' },
  { t: 'PRODUCTOS VARIOS', bg: '#2a6fd0', fg: '#f2c230' },
];
export const SIGN_COUNT = SIGNS.length;

let cache = null;
export function signMaterial() {
  if (cache) return cache;
  const W = Q.lowTex ? 512 : 1024, H = W * 2, cw = W / 4, ch = H / 8;
  const c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  SIGNS.forEach((s, i) => {
    const x = (i % 4) * cw, y = Math.floor(i / 4) * ch;
    g.save(); g.beginPath(); g.rect(x, y, cw, ch); g.clip();
    g.fillStyle = s.bg; g.fillRect(x, y, cw, ch);
    g.fillStyle = 'rgba(255,255,255,.18)'; g.fillRect(x, y, cw, ch * 0.08);
    g.fillStyle = 'rgba(0,0,0,.22)'; g.fillRect(x, y + ch * 0.9, cw, ch * 0.1);
    g.strokeStyle = 'rgba(0,0,0,.35)'; g.lineWidth = 3; g.strokeRect(x + 2, y + 2, cw - 4, ch - 4);
    const big = s.sub ? 0.46 : 0.58;
    g.fillStyle = s.fg; g.textAlign = 'center'; g.textBaseline = 'middle';
    let fs = Math.round(ch * big); g.font = `bold ${fs}px Arial, sans-serif`;
    while (g.measureText(s.t).width > cw * 0.9 && fs > 8) { fs -= 2; g.font = `bold ${fs}px Arial, sans-serif`; }
    g.fillText(s.t, x + cw / 2, y + ch * (s.sub ? 0.42 : 0.52));
    if (s.sub) { g.font = `bold ${Math.round(ch * 0.2)}px Arial, sans-serif`; g.fillText(s.sub, x + cw / 2, y + ch * 0.78); }
    if (s.cross) { g.fillStyle = '#1f8f4a'; g.fillRect(x + cw * 0.05, y + ch * 0.3, ch * 0.4, ch * 0.13); g.fillRect(x + cw * 0.05 + ch * 0.135, y + ch * 0.165, ch * 0.13, ch * 0.4); }
    // desconchado: el sol y la lluvia de Camagüey
    for (let k = 0; k < 40; k++) { g.fillStyle = `rgba(255,255,255,${Math.random() * 0.12})`; g.fillRect(x + Math.random() * cw, y + Math.random() * ch, 2 + Math.random() * 10, 1 + Math.random() * 4); }
    g.restore();
  });
  const tex = new THREE.CanvasTexture(c); tex.anisotropy = 4; tex.generateMipmaps = true; tex.minFilter = THREE.LinearMipmapLinearFilter;
  const mat = new THREE.MeshLambertMaterial({ map: tex, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2 });
  cache = { mat, uv: i => { const u0 = (i % 4) / 4, v1 = 1 - Math.floor(i / 4) / 8; return [u0 + 0.004, v1 - 1 / 8 + 0.004, u0 + 0.25 - 0.004, v1 - 0.004]; } };
  return cache;
}

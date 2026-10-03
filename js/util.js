// Utilidades compartidas y detección de dispositivo
export const $ = id => document.getElementById(id);
export const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
export const smooth = t => { t = clamp(t, 0, 1); return t * t * (3 - 2 * t); };
export const wrapPi = a => { while (a > Math.PI) a -= 2 * Math.PI; while (a < -Math.PI) a += 2 * Math.PI; return a; };

// Táctil / móvil
export const IS_TOUCH = matchMedia('(pointer: coarse)').matches || navigator.maxTouchPoints > 1 || /[?&]touch=1/.test(location.search);   // ?touch=1 fuerza los controles táctiles (para probar)
export const MOBILE = IS_TOUCH && Math.min(screen.width, screen.height) <= 1000;

// Estado global del entorno
export const env = {
  HTTP: location.protocol.startsWith('http'),   // con file:// el navegador bloquea las descargas (CORS)
  maxAniso: 1,
  proxyDown: false,
};

export function canvasTex(w, h, draw) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c); t.anisotropy = env.maxAniso; return t;
}

// Almacenamiento seguro (puede fallar en modo privado)
export const store = {
  get(k, d) { try { const v = localStorage.getItem('cmw_' + k); return v === null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('cmw_' + k, JSON.stringify(v)); } catch (e) { /* ok */ } },
};

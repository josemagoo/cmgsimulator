// Consultas a OpenStreetMap (Overpass). Primero pasan por el proxy PHP del propio sitio
// (sin CORS y con caché en el servidor); si no existe, se prueba directamente.
import { env } from '../util.js';
import { API } from '../config.js';

const SERVERS = ['https://overpass.openstreetmap.fr/api/interpreter', 'https://overpass-api.de/api/interpreter', 'https://overpass.kumi.systems/api/interpreter'];
let srvIdx = 0;

export async function overpass(query, tries = 4, ms = 25000) {
  const body = 'data=' + encodeURIComponent(query), headers = { 'Content-Type': 'application/x-www-form-urlencoded' };
  if (env.HTTP && !env.proxyDown) {
    try {
      const r = await fetch(API.overpass, { method: 'POST', headers, body });
      if (r.ok) return (await r.json()).elements || [];
      if (r.status === 404 || r.status === 500) env.proxyDown = true;   // PHP no disponible
    } catch (e) { env.proxyDown = true; }
  }
  for (let i = 0; i < tries; i++) {
    const idx = (srvIdx + i) % SERVERS.length;
    try {
      const ctl = new AbortController(); const to = setTimeout(() => ctl.abort(), ms);
      const r = await fetch(SERVERS[idx], { method: 'POST', headers, body, signal: ctl.signal });
      clearTimeout(to);
      if (r.ok) { srvIdx = idx; return (await r.json()).elements || []; }
    } catch (e) { /* siguiente servidor */ }
    await new Promise(r => setTimeout(r, 700));
  }
  return null;
}

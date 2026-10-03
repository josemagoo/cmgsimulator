// Service worker: permite instalar el juego como app y abrirlo sin conexión.
// El código se pide siempre a la red (revalidando) y la copia guardada solo se usa si no hay conexión:
// así una actualización nunca mezcla archivos viejos y nuevos, y no hace falta cambiar VERSION en cada subida.
const VERSION = 'cmw-v9';
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', e => {
  e.waitUntil((async () => {
    const old = (await caches.keys()).filter(k => k !== VERSION);
    await Promise.all(old.map(k => caches.delete(k)));
    await self.clients.claim();
    // hasta la v8 se servía primero la copia guardada: las pestañas que estaban cargando se recargan una vez con el código nuevo
    if (old.some(k => /^cmw-v[1-8]$/.test(k))) for (const c of await self.clients.matchAll({ type: 'window' })) c.navigate(c.url).catch(() => {});
  })());
});
self.addEventListener('fetch', e => {
  const u = new URL(e.request.url);
  if (e.request.method !== 'GET' || u.origin !== location.origin || u.pathname.includes('/api/')) return;   // el mapa nunca pasa por aquí
  e.respondWith((async () => {
    const c = await caches.open(VERSION);
    const req = e.request.mode === 'navigate'
      ? new Request(e.request.url, { cache: 'no-cache', credentials: 'same-origin', redirect: 'manual' })
      : new Request(e.request, { cache: 'no-cache' });
    const key = u.origin + u.pathname;          // una sola copia por archivo, sin la huella ?v= de cada versión
    try {
      const r = await fetch(req);
      if (r.ok && r.type === 'basic') c.put(key, r.clone()).catch(() => {});
      return r;
    } catch (err) {
      const hit = await c.match(key);
      if (hit) return hit;
      throw err;
    }
  })());
});

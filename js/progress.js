// Progreso del jugador: destinos desbloqueados y destino elegido (se guarda en el navegador)
import { store } from './util.js';
import { AIRPORTS } from './config.js';

export class Progress {
  constructor() {
    this.visited = store.get('visited', []);
    this.dest = parseInt(store.get('dest', -1));
    if (isNaN(this.dest) || this.dest >= this.unlockedCount()) this.dest = -1;
  }
  // se empieza con Camagüey + 2 destinos; cada ciudad nueva donde aterrizas desbloquea 2 más
  unlockedCount() { return Math.min(AIRPORTS.length, 3 + 2 * this.visited.length); }
  setDest(i) { this.dest = i; store.set('dest', i); }

  // Al aterrizar en una pista queda como punto de salida; en otra ciudad se desbloquean destinos
  landedAt(r, world, hud) {
    world.airports.start = r;
    if (!r.apId || r.apId === 'cmw' || this.visited.includes(r.apId)) return;
    const before = this.unlockedCount();
    this.visited.push(r.apId); store.set('visited', this.visited);
    if (AIRPORTS.findIndex(a => a.id === r.apId) === this.dest) this.setDest(-1);
    const nuevos = AIRPORTS.slice(before, this.unlockedCount()).map(a => a.name);
    hud.msg(`¡Aterrizaste en ${world.airports.name(r)}!${nuevos.length ? ' Desbloqueaste: ' + nuevos.join(' y ') : ''} — R para despegar desde aquí`);
  }
}

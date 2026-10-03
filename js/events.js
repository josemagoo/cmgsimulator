// Bus de eventos del juego: los vehículos avisan de lo que pasa (despegue, aterrizaje, choque…)
// y las misiones, los logros y el sonido reaccionan sin que los vehículos sepan nada de ellos.
export class Bus {
  constructor() { this.h = {}; }
  on(name, fn) { (this.h[name] = this.h[name] || []).push(fn); return this; }
  emit(name, data) { for (const f of this.h[name] || []) { try { f(data); } catch (e) { console.error(e); } } }
}

// Logros: se desbloquean al jugar y se guardan en el navegador. Reaccionan a los eventos del juego.
import { store } from './util.js';

export const ACHIEVEMENTS = [
  { id: 'takeoff', icon: '🛫', name: 'Primer despegue', desc: 'Despega por primera vez.' },
  { id: 'landing', icon: '🛬', name: 'Primer aterrizaje', desc: 'Aterriza en una pista.' },
  { id: 'perfect', icon: '⭐', name: 'Aterrizaje de manual', desc: 'Consigue un aterrizaje de 3 estrellas.' },
  { id: 'night', icon: '🌙', name: 'Piloto nocturno', desc: 'Aterriza de noche.' },
  { id: 'rain', icon: '🌧', name: 'Contra viento y marea', desc: 'Aterriza con lluvia o tormenta.' },
  { id: 'mach', icon: '💥', name: 'Rompe el sonido', desc: 'Supera los 1.225 km/h.' },
  { id: 'cities3', icon: '🗺', name: 'Viajero', desc: 'Aterriza en 3 ciudades distintas.' },
  { id: 'cities9', icon: '🇨🇺', name: 'Recorriendo Cuba', desc: 'Aterriza en las 9 ciudades.' },
  { id: 'heli', icon: '🚁', name: 'Rotores abajo', desc: 'Aterriza un helicóptero con suavidad.' },
  { id: 'storm', icon: '⛈', name: 'Piloto de tormentas', desc: 'Vuela 60 segundos en una tormenta.' },
  { id: 'car5', icon: '🚗', name: 'Taxista de Camagüey', desc: 'Conduce 5 km por la ciudad.' },
  { id: 'm1', icon: '🏅', name: 'Primera misión', desc: 'Completa una misión.' },
  { id: 'm5', icon: '🥇', name: 'Piloto con experiencia', desc: 'Completa 5 misiones.' },
  { id: 'rings', icon: '⭕', name: 'A través del aro', desc: 'Completa la misión de aros.' },
  { id: 'delivery', icon: '📦', name: 'Entrega a tiempo', desc: 'Completa una entrega en helicóptero.' },
  { id: 'precision', icon: '🎯', name: 'Francotirador', desc: 'Aterrizaje de precisión de más de 1.000 puntos.' },
];

export class Achievements {
  constructor(game) {
    this.game = game;
    this.got = new Set(store.get('ach', []));
    this.stats = Object.assign({ missions: 0, carM: 0 }, store.get('stats', {}));
    this.stormT = 0; this.lastDist = 0; this.saveT = 0;
    const b = game.bus;
    b.on('takeoff', () => this.unlock('takeoff'));
    b.on('landed', d => this.onLanded(d));
    b.on('mission', d => {
      this.stats.missions++; this.unlock('m1'); if (this.stats.missions >= 5) this.unlock('m5');
      if (d.id === 'rings') this.unlock('rings'); if (d.id === 'delivery') this.unlock('delivery'); if (d.id === 'precision' && d.score > 1000) this.unlock('precision');
      this.save();
    });
  }
  unlock(id) {
    if (this.got.has(id)) return;
    const a = ACHIEVEMENTS.find(x => x.id === id); if (!a) return;
    this.got.add(id); store.set('ach', [...this.got]);
    this.game.hud.toast(`<b>Logro: ${a.name}</b><br>${a.desc}`, a.icon); this.game.sound.chime(); this.game.haptic(50);
  }
  save() { store.set('stats', this.stats); }
  onLanded(d) {
    const g = this.game, sky = g.world.sky, wx = g.world.weather, cat = d.vehicle.spec.category;
    if (cat === 'heli') this.unlock('heli');
    if (d.runway) {
      this.unlock('landing');
      if (d.stars === 3) this.unlock('perfect');
      if (sky.nightLevel > 0.7) this.unlock('night');
      if (wx && (wx.type === 'rain' || wx.type === 'storm')) this.unlock('rain');
      const n = g.progress.visited.length; if (n >= 3) this.unlock('cities3'); if (n >= 9) this.unlock('cities9');
    }
  }
  // comprobaciones continuas: velocidad, tiempo en tormenta y kilómetros en auto
  update(dt) {
    const g = this.game, v = g.vehicle, wx = g.world.weather;
    if (v.spec.category === 'plane' && v.speed > 340) this.unlock('mach');
    if (wx && wx.type === 'storm' && v.spec.category !== 'car' && !v.onGround) { this.stormT += dt; if (this.stormT > 60) this.unlock('storm'); }
    if (v.spec.category === 'car') {
      const d = v.dist || 0;
      if (d >= this.lastDist) this.stats.carM += d - this.lastDist; this.lastDist = d;
      if (this.stats.carM >= 5000) this.unlock('car5');
      this.saveT += dt; if (this.saveT > 10) { this.saveT = 0; this.save(); }
    } else this.lastDist = 0;
  }
}

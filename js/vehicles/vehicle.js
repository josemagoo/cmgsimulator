// Clase base de cualquier vehículo controlable (avión, auto, y lo que se añada después: helicóptero, barco…).
// El juego solo usa esta interfaz; cada vehículo decide su física, su modelo y qué muestra en pantalla.
const _e = new THREE.Euler(0, 0, 0, 'YXZ');

export class Vehicle {
  constructor(spec) {
    this.spec = spec;
    this.group = new THREE.Group();           // modelo 3D; mira hacia -Z
    this.group.rotation.order = 'YXZ';
    this.pos = new THREE.Vector3();
    this.yaw = 0; this.pitch = 0; this.roll = 0;   // yaw positivo = giro a la izquierda
    this.speed = 0;                           // m/s
    this.crashed = false; this.shake = 0;       // shake 0..1: vibración de cámara (turbulencia, pérdida, choques)
    this.game = null;
    this.extras = [];                         // objetos sueltos (luces, sombras) que hay que retirar al desmontar
  }

  // ---- ciclo de vida ----
  mount(game) { this.game = game; game.scene.add(this.group); for (const o of this.extras) game.scene.add(o); }
  unmount() {
    const s = this.game.scene;
    s.remove(this.group); for (const o of this.extras) s.remove(o);
    this.group.traverse(o => { if (o.geometry) o.geometry.dispose(); });
  }
  placeLike(o) { this.pos.copy(o.pos); this.yaw = o.yaw; this.pitch = 0; this.roll = 0; }

  // ---- a sobrescribir ----
  spawn(place, world) { /* colocar el vehículo: place = { runway } | { near: {x, z} } */ }
  update(dt, input, world) { /* física */ }
  action(name) { /* acciones especiales: 'warp', 'light'… */ }
  cameraSpec() { return { dist: 12, height: 3.6, look: 25, pitchFollow: 0.3, cockpit: null, fovBase: 65, fovBoost: 0, boostRatio: 0 }; }
  hud() { return { name: this.spec.name, speedKmh: this.speed * 3.6, hdg: this.heading() }; }
  hint() { return ''; }
  instr(world) { return null; }                // datos para el panel de instrumentos (null = sin panel)
  scheme() { return 'plane'; }                // controles táctiles: 'plane' | 'car'
  mapRange() { return 10000; }                // radio del minimapa (m)

  // ---- común ----
  heading() { return Math.round(((-this.yaw * 180 / Math.PI) % 360 + 360) % 360); }
  forward(out) { return out.set(0, 0, -1).applyEuler(_e.set(this.pitch, this.yaw, 0)); }
  // se llama cada fotograma (también con el menú abierto) para animar el modelo
  animate(dt, now, world) {
    this.group.position.copy(this.pos);
    this.group.rotation.set(this.pitch, this.yaw, this.roll);
  }
}

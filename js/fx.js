// Efectos: explosión de un choque
export class Fx {
  constructor(game) { this.game = game; this.p = []; }
  explode(pos) {
    const scene = this.game.scene;
    for (let i = 0; i < 40; i++) {
      const m = new THREE.Mesh(new THREE.BoxGeometry(0.6, 0.6, 0.6), new THREE.MeshBasicMaterial({ color: Math.random() < 0.5 ? 0xff7a00 : 0x333333 }));
      m.position.copy(pos).add(new THREE.Vector3(0, 1.5, 0)); scene.add(m);
      this.p.push({ m, v: new THREE.Vector3((Math.random() - 0.5) * 14, Math.random() * 12, (Math.random() - 0.5) * 14) });
    }
  }
  clear() { for (const p of this.p) { this.game.scene.remove(p.m); p.m.geometry.dispose(); p.m.material.dispose(); } this.p.length = 0; }
  update(dt, world) {
    for (const p of this.p) {
      p.v.y -= 9.8 * dt; p.m.position.addScaledVector(p.v, dt);
      const g0 = world.terrainH(p.m.position.x, p.m.position.z) + 0.3;
      if (p.m.position.y < g0) { p.m.position.y = g0; p.v.multiplyScalar(0.3); }
    }
  }
}

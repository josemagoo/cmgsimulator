// Armamento arcade con impactos en el terreno y edificios cargados.
export class Weapons {
  constructor(game) {
    this.game = game; this.projectiles = []; this.effects = [];
    this.bulletGeo = new THREE.BoxGeometry(0.13, 0.13, 5);
    this.bulletMat = new THREE.MeshBasicMaterial({ color: 0xffe894 });
    this.bombGeo = new THREE.SphereGeometry(0.32, 8, 6);
    this.bombMat = new THREE.MeshPhongMaterial({ color: 0x404a32 });
    this.effectGeo = new THREE.SphereGeometry(1, 8, 6);
    this.reticle = document.createElement('div'); this.reticle.id = 'weaponReticle';
    this.reticle.textContent = '+'; document.body.appendChild(this.reticle); this.reset();
  }
  get armed() { return !!this.game.vehicle?.spec.weapons; }
  reset() {
    for (const p of this.projectiles) this.game.scene.remove(p.mesh);
    for (const e of this.effects) { this.game.scene.remove(e.mesh); e.mesh.material.dispose(); }
    this.projectiles.length = this.effects.length = 0;
    this.rounds = 600; this.bombs = 8; this.cooldown = this.bombCooldown = 0;
    this.bombHeld = true; this.reticle.hidden = true;
  }
  status() { return this.armed ? `CAÑÓN ${this.rounds} · BOMBAS ${this.bombs} · J disparar / B bomba` : ''; }
  update(dt, input, world, previousPos) {
    const v = this.game.vehicle, bomb = input.down('KeyB');
    this.cooldown = Math.max(0, this.cooldown - dt); this.bombCooldown = Math.max(0, this.bombCooldown - dt);
    if (this.armed && !v.crashed && !v.warp) {
      const velocity = v.pos.clone().sub(previousPos).divideScalar(dt || 1);
      if (input.down('KeyJ') && !this.cooldown && this.rounds && this.projectiles.length < 100) {
        this.launch(false, velocity.clone()); this.rounds--; this.cooldown = 0.09; this.game.sound.gun();
      }
      if (bomb && !this.bombHeld && !this.bombCooldown && this.bombs) {
        if (v.pos.y - world.terrainH(v.pos.x, v.pos.z) > 5) {
          this.launch(true, velocity.clone()); this.bombs--; this.bombCooldown = 0.7;
          this.game.sound.clunk(); this.game.hud.msg(`Bomba lanzada · quedan ${this.bombs}`, 1.5);
        } else this.game.hud.msg('Sube a más de 5 m para soltar una bomba', 2);
      }
    }
    this.bombHeld = bomb;
    for (let i = this.projectiles.length - 1; i >= 0; i--) {
      const p = this.projectiles[i], start = p.mesh.position.clone();
      p.velocity.y -= (p.bomb ? 9.8 : 1.5) * dt;
      const end = start.clone().addScaledVector(p.velocity, dt);
      // Segmentos cortos para evitar que un disparo atraviese una pared entre fotogramas.
      const steps = Math.ceil(start.distanceTo(end) / 1.5) || 1, at = new THREE.Vector3(); let hit = false;
      for (let j = 0; j <= steps; j++) {
        at.lerpVectors(start, end, j / steps);
        if (at.y <= world.terrainH(at.x, at.z) + 0.15 || world.hitsBuilding(at)) { hit = true; break; }
      }
      p.mesh.position.copy(hit ? at : end); p.life -= dt;
      if (p.bomb && p.velocity.lengthSq()) p.mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, -1), p.velocity.clone().normalize());
      if (hit || p.life <= 0) {
        if (hit) this.impact(at, p.bomb);
        this.game.scene.remove(p.mesh); this.projectiles.splice(i, 1);
      }
    }
    for (let i = this.effects.length - 1; i >= 0; i--) {
      const e = this.effects[i]; e.age += dt;
      e.mesh.scale.setScalar(e.radius * (0.15 + e.age / e.life)); e.mesh.material.opacity = Math.max(0, 1 - e.age / e.life);
      if (e.age >= e.life) { this.game.scene.remove(e.mesh); e.mesh.material.dispose(); this.effects.splice(i, 1); }
    }
  }
  launch(bomb, velocity) {
    const v = this.game.vehicle, rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(v.pitch, v.yaw, v.roll, 'YXZ'));
    const direction = new THREE.Vector3(0, 0, -1).applyQuaternion(rotation);
    const mesh = new THREE.Mesh(bomb ? this.bombGeo : this.bulletGeo, bomb ? this.bombMat : this.bulletMat);
    const offset = bomb ? new THREE.Vector3(this.bombs % 2 ? -2 : 2, 0.2, 0) : new THREE.Vector3(0, 1, v.spec.category === 'heli' ? -4 : -13);
    mesh.position.copy(v.pos).add(offset.applyQuaternion(rotation)); mesh.quaternion.copy(rotation);
    if (bomb) { mesh.scale.set(1, 1, 2.8); velocity.y -= 2; } else velocity.addScaledVector(direction, 850);
    this.game.scene.add(mesh); this.projectiles.push({ mesh, velocity, bomb, life: bomb ? 90 : 4 });
  }
  impact(pos, bomb) {
    if (this.effects.length >= 48) { const old = this.effects.shift(); this.game.scene.remove(old.mesh); old.mesh.material.dispose(); }
    const mesh = new THREE.Mesh(this.effectGeo, new THREE.MeshBasicMaterial({ color: bomb ? 0xff6a13 : 0xffd773, transparent: true, depthWrite: false }));
    mesh.position.copy(pos); this.game.scene.add(mesh);
    this.effects.push({ mesh, age: 0, life: bomb ? 1.6 : 0.22, radius: bomb ? 16 : 1.4 });
    if (bomb && pos.distanceTo(this.game.vehicle.pos) < 2000) { this.game.sound.boom(); this.game.haptic(90); }
  }
  drawAim(active) {
    const v = this.game.vehicle; this.reticle.hidden = !active || !this.armed || v.crashed || !!v.warp;
    if (this.reticle.hidden) return;
    const rotation = new THREE.Quaternion().setFromEuler(new THREE.Euler(v.pitch, v.yaw, v.roll, 'YXZ'));
    const target = new THREE.Vector3(0, 0, -600).applyQuaternion(rotation).add(v.pos), camera = this.game.camera;
    if (camera.worldToLocal(target.clone()).z >= 0) { this.reticle.hidden = true; return; }
    target.project(camera);
    if (Math.abs(target.x) > 1 || Math.abs(target.y) > 1) { this.reticle.hidden = true; return; }
    this.reticle.style.left = `${(target.x + 1) * innerWidth / 2}px`; this.reticle.style.top = `${(1 - target.y) * innerHeight / 2}px`;
  }
}

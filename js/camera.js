// Cámara: persecución con órbita libre (ratón / dedo), cabina, y giro de exhibición en el menú
import { clamp } from './util.js';

export class CameraRig {
  constructor(camera, input) {
    this.camera = camera; this.input = input;
    this.cockpit = false; this.view = null;      // view: tablero 3D de la cabina (CockpitView)
    this.pos = new THREE.Vector3();
    this.q = new THREE.Quaternion(); this.qO = new THREE.Quaternion();
    this.offs = new THREE.Vector3(); this.look = new THREE.Vector3(); this.tmp = new THREE.Vector3(); this.dir = new THREE.Vector3();
    this.eO = new THREE.Euler(0, 0, 0, 'YXZ'); this.eV = new THREE.Euler(0, 0, 0, 'YXZ');
  }
  toggle() { this.cockpit = !this.cockpit; }
  snap(v) { this.pos.copy(v.pos).add(new THREE.Vector3(0, 6, 15)); }

  update(dt, now, v, world, hangarOpen) {
    const cam = this.camera, spec = v.cameraSpec(), o = this.input.orbit, th = (x, z) => world.terrainH(x, z);

    if (hangarOpen) {                     // exhibición: la cámara gira alrededor del vehículo
      v.group.visible = true; if (this.view) this.view.setVisible(false);
      const a = now * 0.00022 + 0.6, R = spec.dist * 2;
      cam.position.set(v.pos.x + Math.sin(a) * R, v.pos.y + spec.height * 1.5 + Math.sin(now * 0.0004) * spec.height * 0.2, v.pos.z + Math.cos(a) * R);
      cam.position.y = Math.max(cam.position.y, th(cam.position.x, cam.position.z) + 1.5);
      cam.up.set(0, 1, 0);
      cam.lookAt(v.pos.x, v.pos.y - spec.height * 0.3, v.pos.z);
      cam.fov = 45; cam.updateProjectionMatrix();
      return;
    }

    // la vista libre vuelve sola a los 2,5 s de soltar
    if (!o.drag && now - o.last > 2500) { const k = Math.exp(-2 * dt); o.yaw *= k; o.pitch *= k; }
    const inCockpit = this.cockpit && spec.cockpit && !v.crashed;
    v.group.visible = !inCockpit && !v.crashed;
    cam.fov = (spec.fovBase + spec.fovBoost * spec.boostRatio) * (inCockpit ? clamp(0.6 + 0.4 * o.zoom, 0.6, 1.5) : 1);
    cam.updateProjectionMatrix();

    if (this.view) this.view.setVisible(inCockpit, v.spec.category === 'car');
    if (inCockpit) {
      v.group.updateMatrixWorld(true);
      cam.position.copy(v.group.localToWorld(this.tmp.copy(spec.cockpit)));
      cam.quaternion.copy(v.group.quaternion).multiply(this.qO.setFromEuler(this.eO.set(-clamp(o.pitch, -0.9, 0.9), o.yaw, 0)));
      this.shake(v, cam);
      return;
    }
    this.q.setFromEuler(this.eV.set(v.pitch * spec.pitchFollow, v.yaw, 0));
    this.offs.set(0, spec.height, spec.dist * o.zoom).applyEuler(this.eO.set(-o.pitch, o.yaw, 0)).applyQuaternion(this.q);
    this.pos.lerp(this.tmp.copy(v.pos).add(this.offs), 1 - Math.exp(-6 * dt));
    cam.position.copy(this.pos);
    cam.position.y = Math.max(cam.position.y, th(this.pos.x, this.pos.z) + 1.5);
    v.forward(this.dir);
    const mix = clamp(Math.abs(o.yaw) / 1.0 + Math.abs(o.pitch) / 0.9, 0, 1);      // al orbitar, mira al vehículo
    this.look.copy(v.pos).add(this.tmp.set(0, 1.5, 0)).addScaledVector(this.dir, spec.look * (1 - mix));
    cam.up.set(0, 1, 0);
    cam.lookAt(this.look);
    this.shake(v, cam);
  }
  // vibración: turbulencia, pérdida de sustentación y choques
  shake(v, cam) {
    const s = v.shake || 0;
    if (s < 0.01) return;
    cam.position.x += (Math.random() - 0.5) * 0.5 * s; cam.position.y += (Math.random() - 0.5) * 0.5 * s; cam.position.z += (Math.random() - 0.5) * 0.5 * s;
  }
}

// Nubes: cientos de "bolas" de vapor dibujadas de una vez (una malla instanciada que siempre mira a la cámara).
// Antes cada bola era un sprite con su propia llamada de dibujo.
import { Q } from '../config.js';
import { canvasTex } from '../util.js';

const VERT = `
varying vec2 vUv;
#include <fog_pars_vertex>
void main() {
  vUv = uv;
  vec3 c = vec3(instanceMatrix[3]);
  float sx = length(vec3(instanceMatrix[0])), sy = length(vec3(instanceMatrix[1]));
  vec4 mvPosition = viewMatrix * vec4(c, 1.0);
  mvPosition.xy += position.xy * vec2(sx, sy);
  gl_Position = projectionMatrix * mvPosition;
  #include <fog_vertex>
}`;
const FRAG = `
uniform sampler2D map; uniform vec3 tint; uniform float opacity; varying vec2 vUv;
#include <fog_pars_fragment>
void main() {
  vec4 t = texture2D(map, vUv);
  if (t.a < 0.01) discard;
  gl_FragColor = vec4(tint * t.rgb, t.a * opacity);
  #include <fog_fragment>
}`;

export class Clouds {
  constructor(world) {
    this.w = world;
    const tex = canvasTex(128, 128, (g) => {
      const gr = g.createRadialGradient(64, 64, 4, 64, 64, 62);
      gr.addColorStop(0, 'rgba(255,255,255,.95)'); gr.addColorStop(.6, 'rgba(255,255,255,.4)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = gr; g.fillRect(0, 0, 128, 128);
    });
    this.mat = new THREE.ShaderMaterial({
      vertexShader: VERT, fragmentShader: FRAG, transparent: true, depthWrite: false, fog: true,
      uniforms: THREE.UniformsUtils.merge([THREE.UniformsLib.fog, { map: { value: null }, tint: { value: new THREE.Color(1, 1, 1) }, opacity: { value: 0.85 } }]),
    });
    this.mat.uniforms.map.value = tex;
    this.mat.uniforms.tint.value = world.sky.cloudTint;          // el cielo lo oscurece y colorea con la hora
    const n = Q.clouds * 5;
    this.mesh = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1), this.mat, n);
    this.mesh.frustumCulled = false; this.mesh.renderOrder = 6;
    this.list = [];
    for (let i = 0; i < Q.clouds; i++) {
      const cx = (Math.random() - 0.5) * 16000, cz = (Math.random() - 0.5) * 16000, cy = 500 + Math.random() * 500;
      for (let j = 0; j < 5; j++) {
        const sc = 350 + Math.random() * 350;
        this.list.push({ x: cx + (Math.random() - 0.5) * 500, y: cy + Math.random() * 40, z: cz + (Math.random() - 0.5) * 300, sx: sc, sy: sc * 0.55, on: true });
      }
    }
    this.vis = -1; this.write();
    world.game.scene.add(this.mesh);
  }
  write() {
    const m = new THREE.Matrix4(), q = new THREE.Quaternion(), p = new THREE.Vector3(), s = new THREE.Vector3();
    this.list.forEach((c, i) => { m.compose(p.set(c.x, c.y, c.z), q, c.on ? s.set(c.sx, c.sy, 1) : s.set(0, 0, 0)); this.mesh.setMatrixAt(i, m); });
    this.mesh.instanceMatrix.needsUpdate = true;
  }
  // nubosidad (la pone el clima): qué fracción se ve y su opacidad
  setCover(vis, opacity) {
    this.mat.uniforms.opacity.value = opacity;
    const v = Math.round(vis * 20) / 20; if (v === this.vis) return;
    this.vis = v; this.list.forEach((c, i) => { c.on = (i % 10) / 10 < v; }); this.write();
  }
  // las nubes acompañan al jugador (se recolocan al quedar lejos)
  follow(focus) {
    let moved = false;
    for (const c of this.list) {
      if (c.x - focus.x > 8000) { c.x -= 16000; moved = true; } else if (c.x - focus.x < -8000) { c.x += 16000; moved = true; }
      if (c.z - focus.z > 8000) { c.z -= 16000; moved = true; } else if (c.z - focus.z < -8000) { c.z += 16000; moved = true; }
    }
    if (moved) this.write();
  }
}

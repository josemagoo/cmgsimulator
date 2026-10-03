// Ríos, canales y lagos reales (OpenStreetMap) con agua animada: reflejo del cielo, brillo del sol y oleaje suave
import { ll2xz } from '../geo.js';

const RIVER_W = { river: 16, canal: 9, stream: 5 };

export class Water {
  constructor(world) {
    this.w = world;
    this.mat = new THREE.ShaderMaterial({
      transparent: true, depthWrite: false, side: THREE.DoubleSide,
      uniforms: {
        time: { value: 0 }, sunDir: { value: world.sky.sunDir }, skyHor: { value: world.sky.skyU.hor.value }, skyTop: { value: world.sky.skyU.top.value },
        night: { value: 0 }, fogColor: { value: new THREE.Color() }, fogNear: { value: 1800 }, fogFar: { value: 9500 },
      },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `varying vec3 vW; uniform float time, night, fogNear, fogFar; uniform vec3 sunDir, skyHor, skyTop, fogColor;
        void main(){
          vec3 V = normalize(cameraPosition - vW);
          vec2 p = vW.xz * 0.12;
          vec3 N = normalize(vec3(sin(p.x * 3.1 + time * 1.3) * 0.06 + sin(p.y * 5.3 - time * 0.9) * 0.04, 1.0, cos(p.y * 2.7 + time * 1.1) * 0.06 + cos(p.x * 4.1 + time * 0.7) * 0.04));
          float fres = pow(1.0 - max(dot(N, V), 0.0), 3.0);
          vec3 base = vec3(0.07, 0.25, 0.30);
          vec3 refl = mix(skyHor, skyTop, clamp(reflect(-V, N).y, 0.0, 1.0));
          vec3 col = mix(base, refl, 0.25 + 0.6 * fres);
          vec3 H = normalize(V + sunDir);
          col += vec3(1.0, 0.95, 0.8) * pow(max(dot(N, H), 0.0), 90.0) * 1.6 * step(0.0, sunDir.y);
          col *= mix(1.0, 0.2, night);
          float d = length(cameraPosition - vW);
          col = mix(col, fogColor, smoothstep(fogNear, fogFar, d));
          gl_FragColor = vec4(col, 0.9);
        }`,
    });
  }

  update(t) {
    const u = this.mat.uniforms, sky = this.w.sky, f = this.w.game.scene.fog;
    u.time.value = t; u.night.value = sky.nightLevel; u.fogColor.value.copy(f.color); u.fogNear.value = f.near; u.fogFar.value = f.far;
  }

  // Devuelve una malla con todos los ríos y lagos de la celda, o null
  build(els) {
    const th = (x, z) => this.w.terrain.h(x, z), P = [], I = [];
    let v = 0;
    for (const e of els) {
      const t = e.tags || {};
      if (e.type !== 'way' || !e.geometry || e.geometry.length < 2) continue;
      const pts = e.geometry.map(p => ll2xz(p.lat, p.lon));
      if (t.waterway && RIVER_W[t.waterway]) {                        // cinta a lo largo del cauce
        const w = RIVER_W[t.waterway] / 2, y = pts.map(p => th(p[0], p[1]) + 0.25);
        for (let i = 0; i < pts.length; i++) {
          const a = pts[Math.max(0, i - 1)], b = pts[Math.min(pts.length - 1, i + 1)];
          let dx = b[0] - a[0], dz = b[1] - a[1]; const l = Math.hypot(dx, dz) || 1; dx /= l; dz /= l;
          P.push(pts[i][0] - dz * w, y[i], pts[i][1] + dx * w, pts[i][0] + dz * w, y[i], pts[i][1] - dx * w);
          if (i > 0) { const k = v - 2; I.push(k, k + 1, k + 2, k + 1, k + 3, k + 2); }
          v += 2;
        }
      } else if (t.natural === 'water' && pts.length >= 4) {          // lago: polígono plano
        if (pts[0][0] === pts[pts.length - 1][0] && pts[0][1] === pts[pts.length - 1][1]) pts.pop();
        let minY = 1e9; for (const p of pts) minY = Math.min(minY, th(p[0], p[1]));
        const tris = THREE.ShapeUtils.triangulateShape(pts.map(p => new THREE.Vector2(p[0], p[1])), []);
        if (!tris.length) continue;
        for (const p of pts) P.push(p[0], minY + 0.2, p[1]);
        for (const tri of tris) I.push(v + tri[0], v + tri[1], v + tri[2]);
        v += pts.length;
      }
    }
    if (!v) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I);
    const m = new THREE.Mesh(g, this.mat); m.renderOrder = 1; m.frustumCulled = false;
    return m;
  }
}

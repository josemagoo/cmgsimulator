// Cielo, sol, luna, estrellas y hora del día (posición solar real para la latitud de Camagüey)
import { clamp, smooth } from '../util.js';
import { LAT0, Q } from '../config.js';

const C_DAY_H = new THREE.Color(0.75, 0.86, 0.94), C_DAY_T = new THREE.Color(0.14, 0.38, 0.80);
const C_SUN_H = new THREE.Color(1.0, 0.62, 0.36), C_SUN_T = new THREE.Color(0.30, 0.36, 0.62);
const C_NIT_H = new THREE.Color(0.035, 0.045, 0.09), C_NIT_T = new THREE.Color(0.004, 0.008, 0.03);
const C_SUN_L = new THREE.Color(0xfff1d6), C_SUN_LW = new THREE.Color(0xff9a55);
const C_HEM_D = new THREE.Color(0xdcecff), C_HEM_N = new THREE.Color(0x33406a);

export class Sky {
  constructor(game) {
    this.game = game;
    const scene = game.scene;
    this.TOD = { hour: 16, auto: false };
    this.sunDir = new THREE.Vector3(0.5, 0.75, 0.35).normalize();
    this.nightLevel = 0; this.sunAlt = 1;
    this.groundTint = new THREE.Color(1, 1, 1); this.cloudTint = new THREE.Color(1, 1, 1); this.runwayTint = new THREE.Color(1, 1, 1);
    this.wallMats = [];          // materiales de fachada: ventanas encendidas de noche
    this.shadowsOn = Q.shadows;
    this.onClock = null;
    this.wSun = 1; this.wDim = 1; this.hemiBase = 0.75;      // los pone el clima: luz solar, oscurecimiento del suelo y las nubes

    scene.background = new THREE.Color(0xbfdbf0);
    scene.fog = new THREE.Fog(0xbfdbf0, 1800, 9500);

    this.hemi = new THREE.HemisphereLight(0xdcecff, 0x6a7a55, 0.75);
    this.sun = new THREE.DirectionalLight(0xfff1d6, 0.95);
    this.moon = new THREE.DirectionalLight(0x8fa6ff, 0);
    scene.add(this.hemi, this.sun, this.sun.target, this.moon);
    this.sun.castShadow = Q.shadows;
    this.sun.shadow.mapSize.set(Q.shadowMap, Q.shadowMap);
    // solo el vehículo hace sombra (barato y nítido): la cámara de sombras abarca unos 90 m alrededor de su sombra en el suelo
    Object.assign(this.sun.shadow.camera, { left: -48, right: 48, top: 48, bottom: -48, near: 50, far: 1700 });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.sun.shadow.bias = -0.0006; this.sun.shadow.normalBias = 0.05;

    // plano invisible que solo recibe sombras (las imágenes satelitales no las reciben)
    this.recv = new THREE.Mesh(new THREE.PlaneGeometry(110, 110), new THREE.ShadowMaterial({ opacity: 0.45, depthWrite: false }));
    this.recv.rotation.x = -Math.PI / 2; this.recv.receiveShadow = true; this.recv.renderOrder = 2;
    scene.add(this.recv);

    this.skyU = {
      sunDir: { value: this.sunDir }, hor: { value: new THREE.Color() }, top: { value: new THREE.Color() },
      warm: { value: 0 }, sunVis: { value: 1 }, stars: { value: 0 }, overcast: { value: 0 },
    };
    this.dome = new THREE.Mesh(new THREE.SphereGeometry(8000, 32, 16), new THREE.ShaderMaterial({
      side: THREE.BackSide, depthWrite: false, fog: false, uniforms: this.skyU,
      vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `varying vec3 vD; uniform vec3 sunDir, hor, top; uniform float warm, sunVis, stars, overcast;
        float hash(vec3 p){ p = fract(p * 0.3183099 + 0.1); p *= 17.0; return fract(p.x * p.y * p.z * (p.x + p.y + p.z)); }
        void main(){
          vec3 d = normalize(vD);
          vec3 c = mix(hor, top, pow(clamp(d.y, 0.0, 1.0), 0.5));
          float s = max(dot(d, sunDir), 0.0);
          vec3 glow = mix(vec3(1.0, 0.9, 0.7), vec3(1.0, 0.55, 0.25), warm);
          c += glow * (pow(s, 700.0) * 2.5 + pow(s, 10.0) * 0.22) * sunVis * (1.0 - overcast);
          c += vec3(1.0, 0.6, 0.3) * pow(s, 3.0) * 0.25 * warm * (1.0 - overcast);
          float st = step(0.9985, hash(floor(d * 420.0))) * stars * smoothstep(0.03, 0.3, d.y) * (1.0 - overcast);
          float m = max(dot(d, -sunDir), 0.0);
          c += vec3(st) + vec3(0.9, 0.93, 1.0) * pow(m, 1800.0) * 3.0 * stars;
          vec3 grey = vec3(dot(hor, vec3(0.333))) * vec3(0.95, 1.0, 1.06) * (1.0 - 0.4 * overcast);
          c = mix(c, grey, overcast * 0.92);
          gl_FragColor = vec4(c, 1.0);
        }`,
    }));
    this.dome.renderOrder = -10; this.dome.frustumCulled = false;
    scene.add(this.dome);

    // suelo verde por si no cargan las imágenes
    this.baseMat = new THREE.MeshBasicMaterial({ color: 0x5f7f45, depthWrite: false });
    this.base = new THREE.Mesh(new THREE.PlaneGeometry(40000, 40000), this.baseMat);
    this.base.rotation.x = -Math.PI / 2; this.base.position.y = -600; this.base.renderOrder = -6;
    scene.add(this.base);

    this.applyTime();
  }

  applyTime() {
    const H = this.TOD.hour, phi = LAT0 * Math.PI / 180, dec = -2.7 * Math.PI / 180, ha = (H - 12) * 15 * Math.PI / 180;
    const e = -Math.cos(dec) * Math.sin(ha);
    const n = Math.sin(dec) * Math.cos(phi) - Math.cos(dec) * Math.sin(phi) * Math.cos(ha);
    const u = Math.sin(phi) * Math.sin(dec) + Math.cos(phi) * Math.cos(dec) * Math.cos(ha);
    this.sunDir.set(e, u, -n).normalize();
    const alt = this.sunAlt = Math.asin(clamp(u, -1, 1));
    const day = smooth((alt + 0.06) / 0.25);
    const warm = Math.exp(-(((alt - 0.03) / 0.18) ** 2));
    const night = this.nightLevel = 1 - day;
    const U = this.skyU, scene = this.game.scene;

    U.hor.value.copy(C_NIT_H).lerp(C_DAY_H, day).lerp(C_SUN_H, warm * 0.75);
    U.top.value.copy(C_NIT_T).lerp(C_DAY_T, day).lerp(C_SUN_T, warm * 0.45);
    U.warm.value = warm;
    U.sunVis.value = smooth((alt + 0.08) / 0.1);
    U.stars.value = smooth((-alt - 0.03) / 0.15);
    scene.background.copy(U.hor.value); scene.fog.color.copy(U.hor.value);

    this.sun.color.copy(C_SUN_L).lerp(C_SUN_LW, warm * 0.8);
    this.sun.intensity = 0.95 * smooth((alt + 0.02) / 0.15) * this.wSun;
    this.hemi.intensity = this.hemiBase = (0.14 + 0.61 * day) * (0.4 + 0.6 * this.wDim);
    this.hemi.color.copy(C_HEM_N).lerp(C_HEM_D, day);
    this.moon.intensity = 0.22 * night * clamp(-this.sunDir.y * 3, 0, 1);

    const b = 0.12 + 0.88 * day;
    const wd = this.wDim;
    this.groundTint.setRGB(Math.min(1, b * (1 + 0.08 * warm)) * wd, b * (1 - 0.1 * warm) * wd, Math.min(1, b * (1 - 0.25 * warm + 0.15 * night)) * wd);
    const cb = 0.1 + 0.9 * day;
    this.cloudTint.setRGB(Math.min(1, cb * (1 + 0.3 * warm)) * (0.45 + 0.55 * wd), cb * (1 - 0.05 * warm) * (0.45 + 0.55 * wd), cb * (1 - 0.3 * warm) * (0.45 + 0.55 * wd));
    this.runwayTint.setScalar(0.3 + 0.7 * day);
    this.baseMat.color.setRGB(0.37 * b, 0.5 * b, 0.27 * b);
    for (const m of this.wallMats) m.emissiveIntensity = night * 0.85;
    this.recv.material.opacity = 0.4 * day;
    if (this.onClock) {
      const h = Math.floor(H) % 24, mi = Math.floor((H % 1) * 60);
      this.onClock(`${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')} ${alt > 0.05 ? '☀' : alt > -0.1 ? '🌅' : '🌙'}`);
    }
  }
  stepHour(d) { this.TOD.hour = (Math.floor(this.TOD.hour) + d + 24) % 24; this.applyTime(); }
  toggleAuto() { this.TOD.auto = !this.TOD.auto; }
  toggleShadows() { this.shadowsOn = !this.shadowsOn; }

  // focus: posición del vehículo; gh: altura del suelo bajo él
  update(dt, focus, gh, camPos) {
    if (this.TOD.auto) { this.TOD.hour = (this.TOD.hour + dt / 60) % 24; this.applyTime(); }
    const agl = Math.max(0, focus.y - gh), active = this.shadowsOn && this.sunAlt > 0.12 && agl < 220;
    this.sun.castShadow = active; this.recv.visible = active;
    // la sombra cae en el suelo desplazada según la altura del vehículo y la del sol
    const k = agl / Math.max(0.15, this.sunDir.y), sx = focus.x - this.sunDir.x * k, sz = focus.z - this.sunDir.z * k;
    const t = this.sun.target.position;
    t.set(Math.round(sx), gh, Math.round(sz));
    this.sun.position.copy(t).addScaledVector(this.sunDir, 1500);
    this.moon.position.copy(t).addScaledVector(this.sunDir, -1500); this.moon.target.position.copy(t);
    this.recv.position.set(sx, gh + 0.25, sz);
    this.dome.position.copy(camPos);
    this.base.position.x = focus.x; this.base.position.z = focus.z;
  }
}

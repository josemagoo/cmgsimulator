// Clima: viento con ráfagas, turbulencia, niebla, nubosidad, lluvia y tormenta con relámpagos y truenos.
// Los vehículos leen weather.wind (arrastra al avión) y weather.turb() (sacudidas); el cielo y la niebla se ajustan solos.
import { clamp } from '../util.js';
import { Q } from '../config.js';
import { settings, saveSettings } from '../settings.js';

const TYPES = {
  clear:  { label: '☀ Despejado', wind: 3,  turb: 0.05, fogNear: 1800, fogFar: 9500, sun: 1.0,  dim: 1.0,  rain: 0,   cover: 0.85, storm: false },
  cloudy: { label: '☁ Nublado',   wind: 6,  turb: 0.15, fogNear: 1500, fogFar: 8000, sun: 0.55, dim: 0.82, rain: 0,   cover: 1.0,  storm: false },
  fog:    { label: '🌫 Niebla',    wind: 2,  turb: 0.05, fogNear: 120,  fogFar: 2300, sun: 0.5,  dim: 0.85, rain: 0,   cover: 0.9,  storm: false },
  rain:   { label: '🌧 Lluvia',    wind: 8,  turb: 0.3,  fogNear: 400,  fogFar: 4800, sun: 0.3,  dim: 0.62, rain: 0.7, cover: 1.0,  storm: false },
  storm:  { label: '⛈ Tormenta',  wind: 14, turb: 0.65, fogNear: 250,  fogFar: 3300, sun: 0.18, dim: 0.45, rain: 1.0,  cover: 1.0,  storm: true },
};
export const WEATHER_ORDER = Object.keys(TYPES);
const GREY = new THREE.Color(0.62, 0.66, 0.7);

export class Weather {
  constructor(world) {
    this.w = world;
    this.type = TYPES[settings.weather] ? settings.weather : 'clear';
    this.t = { ...TYPES[this.type] };                 // objetivo
    this.cur = { ...TYPES[this.type] };               // valores actuales (se acercan al objetivo poco a poco)
    this.wind = { x: 0, z: 0, speed: 0 };
    this.windDir = Math.random() * Math.PI * 2;       // hacia dónde sopla (radianes, 0 = +x)
    this.flash = 0; this.nextBolt = 8;
    this.rain = 0; this.dirty = true;

    // lluvia: rayitas alrededor de la cámara
    const n = this.n = Q.rain;
    this.pos = new Float32Array(n * 6); this.seed = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) { this.seed[i * 3] = Math.random() * 80 - 40; this.seed[i * 3 + 1] = Math.random() * 50; this.seed[i * 3 + 2] = Math.random() * 80 - 40; }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.BufferAttribute(this.pos, 3));
    this.streaks = new THREE.LineSegments(g, new THREE.LineBasicMaterial({ color: 0xb8c8d8, transparent: true, opacity: 0.35, depthWrite: false, fog: false }));
    this.streaks.frustumCulled = false; this.streaks.renderOrder = 4; this.streaks.visible = false;
    world.game.scene.add(this.streaks);
  }
  get label() { return TYPES[this.type].label; }
  set(type) {
    if (!TYPES[type]) return;
    this.type = type; this.t = { ...TYPES[type] }; settings.weather = type; saveSettings();
  }
  cycle() { this.set(WEATHER_ORDER[(WEATHER_ORDER.indexOf(this.type) + 1) % WEATHER_ORDER.length]); return this.label; }

  // sacudidas del aire (rad/s de alabeo y cabeceo, m/s verticales): más fuertes cerca del suelo y con mal tiempo
  turb(now, agl) {
    const t = now * 0.001, k = this.cur.turb * (1.25 - clamp(agl / 1800, 0, 0.9));
    return {
      r: (Math.sin(t * 1.7) + Math.sin(t * 2.9 + 1.3)) * 0.25 * k,
      p: (Math.sin(t * 1.3 + 2) + Math.sin(t * 3.7)) * 0.12 * k,
      v: (Math.sin(t * 0.9) + Math.sin(t * 2.3 + 0.5)) * 2.2 * k,
      mag: clamp(k * 1.2, 0, 1),
    };
  }

  update(dt, now, camPos) {
    const c = this.cur, tg = this.t, sky = this.w.sky, k = Math.min(1, dt * 0.35);
    let moved = false;
    for (const key of ['wind', 'turb', 'fogNear', 'fogFar', 'sun', 'dim', 'rain', 'cover']) {
      const d = tg[key] - c[key];
      if (Math.abs(d) > 1e-4) { c[key] += d * k; if (key === 'sun' || key === 'dim') moved = true; }
    }
    this.rain = c.rain;
    // viento: dirección que deriva despacio y ráfagas
    this.windDir += Math.sin(now * 0.00007) * dt * 0.05;
    const gust = 1 + 0.3 * Math.sin(now * 0.0007) + 0.2 * Math.sin(now * 0.0019 + 1);
    const sp = c.wind * gust;
    this.wind.speed = sp; this.wind.x = Math.cos(this.windDir) * sp; this.wind.z = -Math.sin(this.windDir) * sp;

    // cielo y niebla
    const scene = this.w.game.scene;
    scene.fog.near = c.fogNear; scene.fog.far = c.fogFar;
    if (moved || this.dirty) { sky.wSun = c.sun; sky.wDim = c.dim; sky.applyTime(); this.dirty = false; }
    const grey = 1 - c.sun;                                              // 0 = despejado, ~1 = cubierto
    sky.skyU.overcast.value = grey;
    scene.fog.color.copy(sky.skyU.hor.value).lerp(GREY.clone().multiplyScalar(0.25 + 0.75 * (1 - sky.nightLevel)), grey * 0.6);
    scene.background.copy(scene.fog.color);
    this.w.cloudLayer.setCover(clamp(c.cover, 0, 1.2), 0.7 + 0.3 * clamp(c.cover, 0, 1));

    // lluvia
    const active = Math.floor(this.n * clamp(c.rain, 0, 1));
    this.streaks.visible = active > 0;
    this.streaks.material.opacity = 0.18 + 0.25 * c.rain;
    if (active > 0) {
      const p = this.pos, sd = this.seed, sx = -this.wind.x * 0.05, sz = -this.wind.z * 0.05;
      for (let i = 0; i < active; i++) {
        sd[i * 3 + 1] -= (38 + (i % 7)) * dt; if (sd[i * 3 + 1] < -10) sd[i * 3 + 1] += 60;
        const x = camPos.x + sd[i * 3], y = camPos.y + sd[i * 3 + 1], z = camPos.z + sd[i * 3 + 2];
        p[i * 6] = x; p[i * 6 + 1] = y; p[i * 6 + 2] = z; p[i * 6 + 3] = x + sx * 1.4; p[i * 6 + 4] = y + 1.5; p[i * 6 + 5] = z + sz * 1.4;
      }
      this.streaks.geometry.setDrawRange(0, active * 2);
      this.streaks.geometry.attributes.position.needsUpdate = true;
    }
    // relámpagos
    if (tg.storm) {
      this.nextBolt -= dt;
      if (this.nextBolt <= 0) { this.flash = 1; this.nextBolt = 5 + Math.random() * 10; this.w.game.sound.thunder(0.4 + Math.random() * 2.2); }
    }
    this.flash = Math.max(0, this.flash - dt * 4.5);
    sky.hemi.intensity = sky.hemiBase + this.flash * 1.6;
    if (this.flash > 0) scene.background.lerp(new THREE.Color(1, 1, 1), this.flash * 0.5);
  }
}

// El mundo: cielo, relieve, imágenes, aeropuertos, ciudad, tráfico y nubes.
// Los vehículos solo hablan con esta clase (altura del terreno, pistas, colisiones con edificios…).
import { Q } from '../config.js';
import { canvasTex } from '../util.js';
import { Sky } from './sky.js';
import { Terrain } from './terrain.js';
import { Tiles } from './tiles.js';
import { Airports } from './airports.js';
import { Osm } from './osm.js';
import { Weather } from './weather.js';
import { AiTraffic } from './aitraffic.js';
import { Clouds } from './clouds.js';
import { Rails } from './rails.js';

export class World {
  constructor(game) {
    this.game = game;
    this.sky = new Sky(game);
    this.airports = new Airports(this);     // primero: el relieve necesita conocer las pistas
    this.terrain = new Terrain(this);
    this.tiles = new Tiles(this);
    this.osm = new Osm(this);
    this.traffic = this.osm.traffic;
    this.lastTile = -1e9;
    this.cloudLayer = new Clouds(this);
    this.rails = new Rails(this);
    this.weather = new Weather(this);
    this.ai = new AiTraffic(this);
  }



  // Carga inicial: pista real de Camagüey y relieve de alrededor
  async init(pos) {
    await Promise.race([Promise.all([this.airports.initHome(), this.terrain.update(pos)]), new Promise(r => setTimeout(r, 15000))]);
    this.terrain.setElev0(); this.tiles.reliefAll();
  }
  // 0..1: cuánto del mundo inicial ya está listo (pista real, relieve, imágenes y primeras calles)
  loadProgress() {
    const cells = [...this.osm.cells.values()].filter(c => c.state === 'done').length;
    return 0.15 * (!this.airports.home.approx) + 0.15 * (this.terrain.ELEV0 !== null) + 0.35 * Math.min(1, this.tiles.stat.ok / 12) + 0.35 * Math.min(1, cells / 4);
  }
  startStreaming(pos) { this.tiles.update(pos); this.osm.request(pos); }

  // --- API para los vehículos ---
  terrainH(x, z) { return this.terrain.h(x, z); }
  slopeAhead(pos, yaw, d) { return this.terrain.slopeAhead(pos, yaw, d); }
  onRunway(p) { return this.airports.onRunway(p); }
  hitsBuilding(p) { return this.osm.hits(p); }

  update(dt, now, focus, camPos, approach = null) {
    const gh = this.terrain.h(focus.x, focus.z);
    this.sky.update(dt, focus, gh, camPos);
    this.airports.update(this.sky.nightLevel, approach, now, this.weather);
    this.weather.update(dt, now, camPos);
    this.osm.water.update(now * 0.001);
    this.ai.update(dt, now, focus);
    this.traffic.update(dt, camPos);
    this.osm.tick(now);
    this.cloudLayer.follow(focus);
    if (this.game.ready && !this.rails.mesh && !this.rails.loading && this.terrain.ELEV0 !== null && now > (this.railsAt = this.railsAt || now + 4000)) this.rails.load();
    if (now - this.lastTile > 800) {
      this.lastTile = now;
      this.tiles.update(focus); this.terrain.update(focus);
      if (this.game.ready) this.osm.request(focus);
    }
  }
  forceStream() { this.lastTile = -1e9; }
}

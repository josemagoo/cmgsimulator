import { ll2xz, LAT0, LON0 } from './geo.js';
import { settings } from './settings.js';
import { MOBILE } from './util.js';

export { LAT0, LON0 };
export const API = { overpass: 'api/overpass.php', tile: 'api/tile.php' };

// Ciudades con aeropuerto, en el orden en que se van desbloqueando (lat/lon = centro de la ciudad)
export const AIRPORTS = [
  { id: 'cmw', name: 'Camagüey', lat: 21.3808, lon: -77.9169 },
  { id: 'ltu', name: 'Las Tunas', lat: 20.9617, lon: -76.9511 },
  { id: 'cav', name: 'Ciego de Ávila', lat: 21.8484, lon: -78.7619 },
  { id: 'bay', name: 'Bayamo', lat: 20.3792, lon: -76.6436 },
  { id: 'hol', name: 'Holguín', lat: 20.8872, lon: -76.2631 },
  { id: 'ssp', name: 'Sancti Spíritus', lat: 21.9297, lon: -79.4433 },
  { id: 'scl', name: 'Santa Clara', lat: 22.4069, lon: -79.9647 },
  { id: 'scu', name: 'Santiago de Cuba', lat: 20.0247, lon: -75.8219 },
  { id: 'vra', name: 'Varadero', lat: 23.1544, lon: -81.2517 },
  { id: 'hav', name: 'La Habana', lat: 23.1136, lon: -82.3666 },
];
AIRPORTS.forEach(a => { [a.x, a.z] = ll2xz(a.lat, a.lon); });
export const CITY_XZ = [AIRPORTS[0].x, AIRPORTS[0].z];

// Perfiles de calidad (cambian con los ajustes del jugador; se aplican al recargar)
const PRESETS = {
  low: {
    pixelRatio: 1.25, antialias: false, shadows: false, shadowMap: 512, cellRing: 1, detail: false, water: true, sidewalks: false, grade: false, lowTex: true, imgTrees: false, props: false,
    tileLayers: [{ z: 16, r: 2, ro: -1, seg: 16 }, { z: 14, r: 2, ro: -2, seg: 12 }, { z: 12, r: 1, ro: -3, seg: 16 }],
    elevRing: 1, maxCars: 14, maxCarts: 3, maxPeds: 40, maxLamps: 600, maxTrees: 1500, maxLabels: 8, clouds: 25, labelDist: 600, rain: 600, aiPlanes: 1,
  },
  medium: {
    pixelRatio: 1.5, antialias: true, shadows: true, shadowMap: 1024, cellRing: 1, detail: true, water: true, sidewalks: true, grade: true, lowTex: false, imgTrees: true, props: true,
    tileLayers: [{ z: 17, r: 2, ro: -1, seg: 16 }, { z: 16, r: 2, ro: -1, seg: 12 }, { z: 14, r: 2, ro: -2, seg: 16 }, { z: 12, r: 1, ro: -3, seg: 24 }],
    elevRing: 2, maxCars: 24, maxCarts: 5, maxPeds: 140, maxLamps: 1500, maxTrees: 2600, maxLabels: 12, clouds: 45, labelDist: 700, rain: 1000, aiPlanes: 2,
  },
  high: {
    pixelRatio: 2, antialias: true, shadows: true, shadowMap: 2048, cellRing: 2, detail: true, water: true, sidewalks: true, grade: true, lowTex: false, imgTrees: true, props: true,
    tileLayers: [{ z: 18, r: 2, ro: -1, seg: 8 }, { z: 17, r: 2, ro: -1, seg: 16 }, { z: 16, r: 2, ro: -2, seg: 8 }, { z: 14, r: 2, ro: -3, seg: 16 }, { z: 12, r: 1, ro: -4, seg: 24 }],
    elevRing: 2, maxCars: 40, maxCarts: 8, maxPeds: 240, maxLamps: 2700, maxTrees: 4000, maxLabels: 16, clouds: 70, labelDist: 800, rain: 1600, aiPlanes: 3,
  },
};
// En el teléfono se aligera lo que más gasta sin quitar lo que se ve: menos peatones, coches, árboles, nubes y rótulos
const MOBILE_TWEAKS = {
  medium: { maxPeds: 60, maxCars: 16, maxCarts: 4, maxTrees: 1800, clouds: 28, labelDist: 520, maxLabels: 8, maxLamps: 1000, rain: 700, aiPlanes: 1 },
  high: { maxPeds: 110, maxCars: 24, maxTrees: 2600, clouds: 40, labelDist: 650, maxLabels: 10, aiPlanes: 2 },
};
export const Q = Object.assign({}, PRESETS[settings.quality], MOBILE ? MOBILE_TWEAKS[settings.quality] : null);

export const ATTRIBUTION = '© OpenStreetMap · Imágenes © Esri, Maxar, Earthstar Geographics · Relieve: Mapzen / AWS';

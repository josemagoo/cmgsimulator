// Registro de vehículos. Para añadir uno nuevo (helicóptero, barco, moto…):
//   1) crea su clase en js/vehicles/ extendiendo Vehicle,
//   2) define sus especificaciones y modelo,
//   3) añádelo a CATEGORIES y a create()/buildModel()/spawnPlace() aquí. El menú, los controles y la cámara lo usan solos.
import { PlaneVehicle } from './plane.js';
import { CarVehicle } from './car.js';
import { PLANE_SPECS, buildPlaneModel } from './planeModels.js';
import { CAR_SPECS, buildCarModel } from './carModels.js';
import { HelicopterVehicle } from './helicopter.js';
import { CORE } from '../data/camaguey.js';
import { HELI_SPECS, buildHeliModel } from './heliModels.js';

export const CATEGORIES = [
  { id: 'plane', label: 'Aviones', icon: '✈', specs: PLANE_SPECS },
  { id: 'heli', label: 'Helicópteros', icon: '🚁', specs: HELI_SPECS },
  { id: 'car', label: 'Autos', icon: '🚗', specs: CAR_SPECS },
];
export const findSpec = (category, id) => (CATEGORIES.find(c => c.id === category) || CATEGORIES[0]).specs.find(s => s.id === id) || CATEGORIES[0].specs[0];
export const create = spec => spec.category === 'car' ? new CarVehicle(spec) : spec.category === 'heli' ? new HelicopterVehicle(spec) : new PlaneVehicle(spec);
export const buildModel = spec => spec.category === 'car' ? buildCarModel(spec) : spec.category === 'heli' ? buildHeliModel(spec) : buildPlaneModel(spec);

// Dónde aparece cada tipo de vehículo: aviones y helicópteros junto a la pista; los autos en el centro de la ciudad
export function spawnPlace(spec, world) {
  if (spec.category === 'car') { return { near: { x: CORE[0], z: CORE[1] }, yaw: Math.PI / 2 };   // el casco histórico, junto al parque Agramonte
  }
  return { runway: world.airports.start };
}

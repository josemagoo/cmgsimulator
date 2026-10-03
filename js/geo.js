// Geografía: el origen (0,0) del mundo es el aeropuerto Ignacio Agramonte (Camagüey).
// x = este (m), z = sur (m).
export const LAT0 = 21.4203, LON0 = -77.8475;
const M_LAT = 110574, M_LON = 111320 * Math.cos(LAT0 * Math.PI / 180);

export const ll2xz = (lat, lon) => [(lon - LON0) * M_LON, -(lat - LAT0) * M_LAT];
export const xz2ll = (x, z) => [LAT0 - z / M_LAT, LON0 + x / M_LON];

// Teselas Web Mercator (slippy map)
export const lon2tx = (lon, z) => (lon + 180) / 360 * 2 ** z;
export const lat2ty = (lat, z) => { const r = lat * Math.PI / 180; return (1 - Math.log(Math.tan(r) + 1 / Math.cos(r)) / Math.PI) / 2 * 2 ** z; };
export const tx2lon = (x, z) => x / 2 ** z * 360 - 180;
export const ty2lat = (y, z) => Math.atan(Math.sinh(Math.PI - 2 * Math.PI * y / 2 ** z)) * 180 / Math.PI;

// Rumbo (0-359°) de un vector (dx, dz) del mundo
export const bearing = (dx, dz) => ((Math.atan2(dx, -dz) * 180 / Math.PI) % 360 + 360) % 360;

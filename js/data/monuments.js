// Monumentos, tanques elevados y torres de Camagüey (posiciones de OpenStreetMap, © colaboradores de OSM, ODbL;
// formas revisadas con fotos de Wikimedia Commons, EcuRed y la imagen satelital).
// t: tipo de modelo · a: hacia dónde mira (grados, 0 = norte, 90 = este) · h: altura en metros
//   bust busto sobre pedestal · statue estatua de pie (statueL: grande) · obelisk obelisco · stele monumento sencillo con tarja
//   sculpt escultura de piedra · figure figura de bronce a ras de suelo · ceiba árbol monumental · loco locomotora de vapor
//   wtower tanque de agua elevado · light torre de luz del estadio · comm torre de comunicaciones · plazarev conjunto de la Plaza de la Revolución
//   barberan obelisco con los bustos de Barberán y Collar
export const MONUMENTS = [
  // Plaza de la Revolución Mayor General Ignacio Agramonte (1989): Agramonte de bronce ante un grupo escultórico blanco
  // de caballos y mambises y un gran marco de hormigón en punta con una estrella; tribuna con relieves y "Con la vergüenza"
  { t: 'plazarev', lat: 21.37935, lon: -77.90873, a: 0 },
  // Parque Casino Campestre y alrededores
  { t: 'barberan', lat: 21.37665, lon: -77.91358, a: 0, n: 'Barberán y Collar' },        // vuelo Sevilla-Camagüey del "Cuatro Vientos" (1933)
  { t: 'obelisk', lat: 21.37640, lon: -77.91271, h: 8, n: 'Obelisco al Maestro' },
  { t: 'ceiba', lat: 21.37639, lon: -77.91172, n: 'Ceiba de La República' },
  { t: 'bust', lat: 21.37640, lon: -77.91257, n: 'Gonzalo de Quesada' },
  { t: 'sculpt', lat: 21.37680, lon: -77.91193, n: 'Monumento a la paz' },
  { t: 'statue', lat: 21.37587, lon: -77.91110, n: 'Manuel Ramón Silva' },
  { t: 'bust', lat: 21.37631, lon: -77.91380, n: 'Enrique José Varona' },
  { t: 'bust', lat: 21.37615, lon: -77.91423, n: 'Jesús Suárez Gayol' },
  { t: 'statue', lat: 21.37602, lon: -77.91095, n: 'Salvador Cisneros' },
  { t: 'statueL', lat: 21.37528, lon: -77.91035, n: 'Libertador Desconocido' },
  { t: 'bust', lat: 21.37767, lon: -77.91113, a: 180, n: 'Cándido González' },
  // casco histórico
  { t: 'bust', lat: 21.38024, lon: -77.91806, a: 180, n: 'Maceo' },
  { t: 'statue', lat: 21.37940, lon: -77.91551, a: 90, n: 'Martí' },
  { t: 'statue', lat: 21.38016, lon: -77.91534, a: 180, n: 'Gertrudis Gómez de Avellaneda' },
  { t: 'figure', lat: 21.38212, lon: -77.91837, a: 180, n: 'Nicolás Guillén' },
  { t: 'bust', lat: 21.38065, lon: -77.92632, n: 'José Martí' },
  { t: 'bust', lat: 21.38554, lon: -77.91884 },
  { t: 'bust', lat: 21.37406, lon: -77.92515 },
  { t: 'stele', lat: 21.38002, lon: -77.92367, n: 'Nuestra Señora del Carmen' },
  { t: 'stele', lat: 21.37243, lon: -77.92154, n: 'Froilán Quirós' },
  // La Vigía, Finlay, estación
  { t: 'bust', lat: 21.38932, lon: -77.91332, n: 'Carlos J. Finlay' },
  { t: 'obelisk', lat: 21.39089, lon: -77.91183, h: 7, n: 'Fusilados en la Guerra de los Diez Años' },
  { t: 'obelisk', lat: 21.40039, lon: -77.91642, h: 10, n: 'Joaquín de Agüero' },
  { t: 'statue', lat: 21.40263, lon: -77.89010, n: 'Camilo Cienfuegos' },
  { t: 'stele', lat: 21.39000, lon: -77.90367, n: 'Piloto Juan Manuel Viamontes' },
  { t: 'stele', lat: 21.37346, lon: -77.90900 },
  { t: 'stele', lat: 21.36775, lon: -77.87308, n: 'Cándido González' },
  { t: 'stele', lat: 21.42051, lon: -77.85311, n: 'Camilo Cienfuegos' },
  { t: 'stele', lat: 21.41400, lon: -77.93890 },
  { t: 'stele', lat: 21.33284, lon: -77.84946 },
  // locomotoras de vapor de los centrales azucareros: "Senado" y "Lugareño" en el Parque van Horne, y otras en el patio de la estación
  { t: 'loco', lat: 21.38896, lon: -77.91504, a: 52, n: 'Senado' },
  { t: 'loco', lat: 21.38903, lon: -77.91497, a: 52, n: 'Lugareño' },
  { t: 'loco', lat: 21.38948, lon: -77.91541, a: 93 },
  { t: 'loco', lat: 21.38950, lon: -77.91600, a: 92 },
  { t: 'loco', lat: 21.38962, lon: -77.91583, a: 82 },
  { t: 'loco', lat: 21.38955, lon: -77.91623, a: 90 },
  { t: 'loco', lat: 21.38957, lon: -77.91562, a: 84 },
  // tanques de agua elevados de los repartos (se ven desde lejos)
  ...[[21.38312, -77.93376], [21.38865, -77.88587], [21.39211, -77.88669], [21.40817, -77.86914], [21.41238, -77.93928],
      [21.42156, -77.91215], [21.41074, -77.94912], [21.35776, -77.89355]].map(([lat, lon], i) => ({ t: 'wtower', lat, lon, h: 22 + (i * 7) % 9 })),
  // torres de luz del Estadio Cándido González (béisbol)
  ...[[21.37929, -77.91074], [21.37825, -77.91081], [21.37820, -77.91089], [21.37802, -77.91116], [21.37824, -77.91182],
      [21.37854, -77.91187], [21.37864, -77.91189], [21.37928, -77.91162], [21.37944, -77.91117], [21.37886, -77.91057]].map(([lat, lon]) => ({ t: 'light', lat, lon, h: 34, to: [21.37870, -77.91113] })),
  // torres de comunicaciones (Radio Cuba y telefonía móvil)
  { t: 'comm', lat: 21.35012, lon: -77.87194, h: 72 },
  { t: 'comm', lat: 21.36217, lon: -77.95822, h: 72 },
  { t: 'comm', lat: 21.36464, lon: -77.87589, h: 42 },
  { t: 'comm', lat: 21.37893, lon: -77.92752, h: 32 },
  { t: 'comm', lat: 21.38028, lon: -77.92358, h: 30 },
  { t: 'comm', lat: 21.37685, lon: -77.91503, h: 32 },
  { t: 'comm', lat: 21.37419, lon: -77.91554, h: 32 },
];

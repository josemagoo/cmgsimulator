// Ajustes del jugador (se guardan en el navegador). La calidad se aplica al recargar la página.
import { store, MOBILE } from './util.js';

const defaults = {
  quality: MOBILE ? 'medium' : 'high', // low | medium | high (en el móvil, medium con ajustes ligeros: ver config.js)
  qv: 2,                              // versión de la calidad por defecto
  invertY: false,                     // invertir el cabeceo (palanca hacia delante = nariz arriba)
  volume: 0.8,                        // 0..1
  fps: false,                         // contador de fotogramas
  haptics: true,                      // vibración en el móvil
  instruments: true,                  // panel de instrumentos en pantalla
  gta: true,                          // estilo gráfico GTA San Andreas (color, bruma y HUD)
  weather: 'clear',                   // clear | cloudy | fog | rain | storm
};
const stored = store.get('settings', {});
export const settings = Object.assign({}, defaults, stored);
if (!['low', 'medium', 'high'].includes(settings.quality)) settings.quality = defaults.quality;
// antes el móvil arrancaba en "low" (sin monumentos, aceras ni estilo GTA): quien lo tenía por defecto pasa a "medium"
if (MOBILE && !stored.qv && settings.quality === 'low') settings.quality = 'medium';
export const saveSettings = () => store.set('settings', settings);

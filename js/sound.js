// Sonido sintetizado (Web Audio), por capas: motor, aspas, viento, rodadura, lluvia y ambiente de ciudad,
// más efectos puntuales (golpe al aterrizar, choque, trueno, avisos y sonidos del menú).
// Cada vehículo dice qué quiere con sound(): { freq, filter, gain, wind, roll, chop:{hz,depth}, stall }.
import { settings } from './settings.js';

export class Sound {
  constructor() { this.ctx = null; this.muted = false; this.nextBeep = 0; }

  start() {
    if (this.ctx) { if (this.ctx.state === 'suspended') this.ctx.resume(); return; }   // el navegador exige un clic o tecla para dar sonido
    try {
      const a = this.ctx = new (window.AudioContext || window.webkitAudioContext)();
      this.master = a.createGain(); this.master.gain.value = settings.volume; this.master.connect(a.destination);

      // motor: diente de sierra + una octava más grave, con filtro; el "chop" modula el volumen (aspas del helicóptero)
      this.osc = a.createOscillator(); this.osc.type = 'sawtooth';
      this.sub = a.createOscillator(); this.sub.type = 'square';
      const subG = a.createGain(); subG.gain.value = 0.45;
      this.engLp = a.createBiquadFilter(); this.engLp.frequency.value = 420;
      this.engGain = a.createGain(); this.engGain.gain.value = 0;
      this.osc.connect(this.engLp); this.sub.connect(subG).connect(this.engLp); this.engLp.connect(this.engGain).connect(this.master);
      this.lfo = a.createOscillator(); this.lfo.frequency.value = 12;
      this.lfoDepth = a.createGain(); this.lfoDepth.gain.value = 0;
      this.lfo.connect(this.lfoDepth).connect(this.engGain.gain);
      this.osc.start(); this.sub.start(); this.lfo.start();

      // ruido en bucle para viento, rodadura, lluvia y ambiente
      const len = a.sampleRate * 2, buf = a.createBuffer(1, len, a.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
      this.noise = buf;
      const layer = (type, freq, q) => {
        const src = a.createBufferSource(); src.buffer = buf; src.loop = true;
        const f = a.createBiquadFilter(); f.type = type; f.frequency.value = freq; if (q) f.Q.value = q;
        const g = a.createGain(); g.gain.value = 0;
        src.connect(f).connect(g).connect(this.master); src.start();
        return { f, g };
      };
      this.wind = layer('bandpass', 600, 0.7);
      this.roll = layer('lowpass', 380);
      this.rain = layer('highpass', 1800);
      this.amb = layer('lowpass', 260);
    } catch (e) { this.ctx = null; }
  }
  toggle() { this.muted = !this.muted; }
  setVolume(v) { if (this.master) this.master.gain.value = v; }

  // vehicle: el vehículo activo; info: { silent, rain, agl }
  update(vehicle, info) {
    const a = this.ctx; if (!a) return;
    const t = a.currentTime, k = this.muted || info.silent ? 0 : 1;
    const s = vehicle.sound ? vehicle.sound() : null;
    const set = (param, v, tc = 0.08) => param.setTargetAtTime(v, t, tc);
    if (s && !vehicle.crashed) {
      set(this.osc.frequency, s.freq); set(this.sub.frequency, s.freq / 2); set(this.engLp.frequency, s.filter);
      set(this.engGain.gain, s.gain * k);
      if (s.chop) { set(this.lfo.frequency, s.chop.hz, 0.2); set(this.lfoDepth.gain, s.chop.depth * s.gain * k); } else set(this.lfoDepth.gain, 0);
      set(this.wind.g.gain, 0);                 // sin el siseo de viento ("ffff") al acelerar: molestaba
      set(this.roll.g.gain, (s.roll || 0) * 0.06 * k);   // rodadura: solo un murmullo grave
      if (s.stall && t > this.nextBeep && k) { this.beep(900, 0.13, 0.06); this.nextBeep = t + 0.32; }
    } else { set(this.engGain.gain, 0); set(this.wind.g.gain, 0); set(this.roll.g.gain, 0); }
    set(this.rain.g.gain, (info.rain || 0) * 0.12 * k, 0.3);
    set(this.amb.g.gain, Math.max(0, 1 - info.agl / 500) * 0.05 * k, 0.4);
  }

  // ---- efectos puntuales ----
  _env(g, peak, dur) { const a = this.ctx, t = a.currentTime; g.gain.setValueAtTime(peak, t); g.gain.exponentialRampToValueAtTime(0.001, t + dur); }
  _noiseBurst(freq, peak, dur) {
    const a = this.ctx; if (!a || this.muted) return;
    const src = a.createBufferSource(); src.buffer = this.noise;
    const f = a.createBiquadFilter(); f.frequency.value = freq;
    const g = a.createGain(); this._env(g, peak, dur);
    src.connect(f).connect(g).connect(this.master); src.start(); src.stop(a.currentTime + dur + 0.05);
  }
  _tone(freq, peak, dur, type = 'sine', slideTo = 0) {
    const a = this.ctx; if (!a || this.muted) return;
    const o = a.createOscillator(); o.type = type; o.frequency.value = freq;
    if (slideTo) o.frequency.exponentialRampToValueAtTime(slideTo, a.currentTime + dur);
    const g = a.createGain(); this._env(g, peak, dur);
    o.connect(g).connect(this.master); o.start(); o.stop(a.currentTime + dur + 0.05);
  }
  thump(k = 1) { this._noiseBurst(240, 0.5 * Math.min(1, k), 0.4); this._tone(80, 0.5 * Math.min(1, k), 0.3, 'sine', 40); }   // golpe de las ruedas
  clunk() { this._noiseBurst(500, 0.25, 0.18); this._tone(110, 0.3, 0.2, 'square', 60); }                                    // tren de aterrizaje
  boom() { this._noiseBurst(500, 0.9, 1.6); this._tone(55, 0.8, 1.4, 'sine', 25); }                                           // choque
  thunder(delay = 0.6) { setTimeout(() => { this._noiseBurst(300, 0.8, 2.6); this._tone(48, 0.5, 2.2, 'sine', 30); }, delay * 1000); }
  beep(f = 880, dur = 0.12, peak = 0.08) { this._tone(f, peak, dur, 'square'); }
  click() { this._tone(1400, 0.06, 0.04, 'square'); }
  chime() { this._tone(660, 0.12, 0.5); setTimeout(() => this._tone(990, 0.12, 0.7), 140); setTimeout(() => this._tone(1320, 0.1, 0.9), 300); }
  whoosh() { /* sin soplido */ }
  gun() { this._noiseBurst(1800, 0.16, 0.07); this._tone(120, 0.1, 0.06, 'square', 55); }
}

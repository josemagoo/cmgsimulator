// Imágenes satelitales por teselas (varios niveles de detalle) con el relieve aplicado
import { env } from '../util.js';
import { ll2xz, xz2ll, lon2tx, lat2ty, tx2lon, ty2lat } from '../geo.js';
import { API, Q } from '../config.js';

// Textura de detalle (grano de hierba y tierra) que se mezcla con la foto satelital solo cerca del suelo
let detailTex = null;
function getDetail() {
  if (detailTex) return detailTex;
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d'); g.fillStyle = '#808080'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 2600; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 1 + Math.random() * 4, v = 90 + Math.random() * 90 | 0;
    g.fillStyle = `rgba(${v},${v},${v},${0.25 + Math.random() * 0.4})`;
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { g.beginPath(); g.arc(x + dx, y + dy, r, 0, 7); g.fill(); }   // se repite sin costuras
  }
  detailTex = new THREE.CanvasTexture(c); detailTex.wrapS = detailTex.wrapT = THREE.RepeatWrapping; detailTex.anisotropy = env.maxAniso;
  return detailTex;
}

export class Tiles {
  constructor(world) {
    this.w = world;
    this.tiles = new Map();
    this.loader = new THREE.TextureLoader(); this.loader.setCrossOrigin('anonymous');
    this.stat = { ok: 0, fail: 0 };
  }

  applyRelief(m) {
    const g = m.geometry, p = g.attributes.position, th = this.w.terrain;
    for (let i = 0; i < p.count; i++) p.setZ(i, th.h(m.position.x + p.getX(i), m.position.z - p.getY(i)));
    p.needsUpdate = true; g.computeBoundingSphere();
  }
  reliefAll() { for (const e of this.tiles.values()) if (e.mesh) this.applyRelief(e.mesh); }

  load(L, tx, ty, key) {
    const entry = { L, tx, ty, mesh: null };
    this.tiles.set(key, entry);
    const direct = `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${L.z}/${ty}/${tx}`;
    const first = env.HTTP ? `${API.tile}?z=${L.z}&y=${ty}&x=${tx}` : direct;
    const onLoad = tex => {
      if (this.tiles.get(key) !== entry) { tex.dispose(); return; }
      tex.anisotropy = env.maxAniso; entry.img = tex.image;
      const [x0, z0] = ll2xz(ty2lat(ty, L.z), tx2lon(tx, L.z));
      const [x1, z1] = ll2xz(ty2lat(ty + 1, L.z), tx2lon(tx + 1, L.z));
      const mat = new THREE.MeshBasicMaterial({ map: tex });
      mat.color = this.w.sky.groundTint;                       // compartido: oscurece con la hora
      if (Q.detail && L.z >= 16) {                             // detalle de suelo: más grano cuanto más cerca estás
        const rep = Math.max(8, Math.round(Math.abs(x1 - x0) / 6)), dt = getDetail();
        mat.onBeforeCompile = sh => {
          sh.uniforms.detailMap = { value: dt };
          sh.vertexShader = sh.vertexShader
            .replace('#include <common>', '#include <common>\nvarying float vDepth;')
            .replace('#include <project_vertex>', '#include <project_vertex>\nvDepth = -mvPosition.z;');
          sh.fragmentShader = sh.fragmentShader
            .replace('#include <common>', '#include <common>\nvarying float vDepth; uniform sampler2D detailMap;')
            .replace('#include <map_fragment>', '#include <map_fragment>\n{ float f = 1.0 - smoothstep(40.0, 420.0, vDepth); vec3 dd = texture2D(detailMap, vUv * ' + rep + '.0).rgb; diffuseColor.rgb *= mix(vec3(1.0), dd * 1.9, 0.4 * f); }');
        };
        mat.customProgramCacheKey = () => 'tileDetail' + rep;
      }
      const m = new THREE.Mesh(new THREE.PlaneGeometry(Math.abs(x1 - x0) * 1.003, Math.abs(z1 - z0) * 1.003, L.seg, L.seg), mat);
      m.rotation.x = -Math.PI / 2;
      // la capa más fina va un poco hundida y se dibuja primero (escribe profundidad): las capas gruesas de debajo ya no se pintan
      // encima (menos trabajo para la tarjeta gráfica) y calles, aceras y pistas quedan siempre por encima de la foto
      const idx = Math.max(0, Q.tileLayers.indexOf(L));
      m.position.set((x0 + x1) / 2, -[0.25, 0.45, 1.0, 2.5, 7][idx], (z0 + z1) / 2);
      m.renderOrder = -5 + idx * 0.1;
      this.applyRelief(m);
      m.matrixAutoUpdate = false; m.updateMatrix();
      this.w.game.scene.add(m); entry.mesh = m; this.stat.ok++;
    };
    this.loader.load(first, onLoad, undefined, () => {
      if (first === direct) { this.stat.fail++; return; }
      this.loader.load(direct, onLoad, undefined, () => { this.stat.fail++; });
    });
  }

  // color real (0-1) de la foto satelital en un punto del mundo, o null si esa tesela aún no ha llegado
  sample(x, z, coarse = false) {
    const [lat, lon] = xz2ll(x, z);
    for (const zz of coarse ? [18, 17, 16, 14] : [18, 17, 16]) {
      const fx = lon2tx(lon, zz), fy = lat2ty(lat, zz), e = this.tiles.get(`${zz}/${Math.floor(fx)}/${Math.floor(fy)}`);
      if (!e || (!e.img && e.px === undefined)) continue;
      if (e.px === undefined) {
        try {
          const c = this.cv || (this.cv = document.createElement('canvas')), im = e.img;
          c.width = im.width; c.height = im.height;
          const g = c.getContext('2d', { willReadFrequently: true });
          g.drawImage(im, 0, 0); e.px = g.getImageData(0, 0, c.width, c.height);
        } catch (err) { e.px = false; }
      }
      if (!e.px) continue;
      const d = e.px, W = d.width, H = d.height;
      const px = Math.min(W - 2, Math.max(1, Math.floor((fx - Math.floor(fx)) * W))), py = Math.min(H - 2, Math.max(1, Math.floor((fy - Math.floor(fy)) * H)));
      let r = 0, g2 = 0, b = 0;
      for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) { const o = ((py + j) * W + px + i) * 4; r += d.data[o]; g2 += d.data[o + 1]; b += d.data[o + 2]; }
      return [r / 2295, g2 / 2295, b / 2295];
    }
    return null;
  }

  update(pos) {
    const [lat, lon] = xz2ll(pos.x, pos.z), scene = this.w.game.scene;
    for (const L of Q.tileLayers) {
      const cx = Math.floor(lon2tx(lon, L.z)), cy = Math.floor(lat2ty(lat, L.z));
      for (let dy = -L.r; dy <= L.r; dy++) for (let dx = -L.r; dx <= L.r; dx++) {
        const key = `${L.z}/${cx + dx}/${cy + dy}`;
        if (!this.tiles.has(key)) this.load(L, cx + dx, cy + dy, key);
      }
    }
    for (const [key, e] of this.tiles) {
      const cx = Math.floor(lon2tx(lon, e.L.z)), cy = Math.floor(lat2ty(lat, e.L.z));
      if (Math.abs(e.tx - cx) > e.L.r + 1 || Math.abs(e.ty - cy) > e.L.r + 1) {
        if (e.mesh) { scene.remove(e.mesh); e.mesh.material.map.dispose(); e.mesh.material.dispose(); e.mesh.geometry.dispose(); }
        this.tiles.delete(key);
      }
    }
  }
}

// Etapa final de color: el aspecto cálido, saturado y con bruma de GTA San Andreas (PS2).
// La escena se dibuja en una textura y un solo filtro la retoca: suavizado de bordes (FXAA, mucho más barato que el
// multimuestreo en tarjetas integradas), contraste, saturación, luces naranjas, sombras frías, bruma, viñeta y grano.
const VERT = 'varying vec2 vUv; void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }';
const FRAG = `
precision highp float; varying vec2 vUv; uniform sampler2D tex; uniform vec2 px; uniform float time;
float lu(vec3 c) { return dot(c, vec3(0.299, 0.587, 0.114)); }
void main() {
  vec3 cM = texture2D(tex, vUv).rgb;
  vec3 cNW = texture2D(tex, vUv + vec2(-1.0, -1.0) * px).rgb, cNE = texture2D(tex, vUv + vec2(1.0, -1.0) * px).rgb;
  vec3 cSW = texture2D(tex, vUv + vec2(-1.0, 1.0) * px).rgb, cSE = texture2D(tex, vUv + vec2(1.0, 1.0) * px).rgb;
  float lM = lu(cM), lNW = lu(cNW), lNE = lu(cNE), lSW = lu(cSW), lSE = lu(cSE);
  float lMin = min(lM, min(min(lNW, lNE), min(lSW, lSE))), lMax = max(lM, max(max(lNW, lNE), max(lSW, lSE)));
  vec3 c = cM;
  if (lMax - lMin > 0.06) {                                   // solo en los bordes
    vec2 dir = vec2(-((lNW + lNE) - (lSW + lSE)), (lNW + lSW) - (lNE + lSE));
    float red = max((lNW + lNE + lSW + lSE) * 0.03125, 0.0078125);
    dir = clamp(dir / (min(abs(dir.x), abs(dir.y)) + red), -8.0, 8.0) * px;
    vec3 a = 0.5 * (texture2D(tex, vUv - dir * 0.1667).rgb + texture2D(tex, vUv + dir * 0.1667).rgb);
    vec3 b = a * 0.5 + 0.25 * (texture2D(tex, vUv - dir * 0.5).rgb + texture2D(tex, vUv + dir * 0.5).rgb);
    float lb = lu(b);
    c = (lb < lMin || lb > lMax) ? a : b;
  }
  float l = lu(c);
  c += max(c - 0.78, 0.0) * 0.45;                              // luces que se "queman" un poco, como en PS2
  c = mix(vec3(l), c, 1.3);                                    // más saturación
  c = (c - 0.5) * 1.12 + 0.5;                                  // más contraste
  c *= mix(vec3(0.95, 0.97, 1.04), vec3(1.09, 1.0, 0.85), smoothstep(0.15, 0.85, l));   // sombras frías, luces naranjas
  c = mix(c, vec3(0.88, 0.74, 0.55), 0.05);                    // velo de bruma cálida
  vec2 d = vUv - 0.5; c *= 1.0 - dot(d, d) * 0.55;             // viñeta
  c += (fract(sin(dot(gl_FragCoord.xy + time, vec2(12.9898, 78.233))) * 43758.5453) - 0.5) * 0.016;   // grano
  gl_FragColor = vec4(max(c, 0.0), 1.0);
}`;

export class Grade {
  constructor(renderer) {
    this.r = renderer; this.rt = null; this.size = '';
    this.scene = new THREE.Scene(); this.cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    this.mat = new THREE.ShaderMaterial({ vertexShader: VERT, fragmentShader: FRAG, depthTest: false, depthWrite: false, uniforms: { tex: { value: null }, px: { value: new THREE.Vector2(1, 1) }, time: { value: 0 } } });
    const q = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), this.mat); q.frustumCulled = false; this.scene.add(q);
    this.v = new THREE.Vector2();
  }
  render(scene, camera, t) {
    const r = this.r; r.getDrawingBufferSize(this.v);
    const w = Math.max(2, this.v.x | 0), h = Math.max(2, this.v.y | 0), key = w + 'x' + h;
    if (key !== this.size) {
      if (this.rt) this.rt.dispose();
      this.rt = new THREE.WebGLRenderTarget(w, h, { minFilter: THREE.LinearFilter, magFilter: THREE.LinearFilter, depthBuffer: true, stencilBuffer: false });
      this.size = key; this.mat.uniforms.px.value.set(1 / w, 1 / h);
    }
    r.setRenderTarget(this.rt); r.render(scene, camera); r.setRenderTarget(null);
    this.mat.uniforms.tex.value = this.rt.texture; this.mat.uniforms.time.value = t % 100;
    r.render(this.scene, this.cam);
  }
}

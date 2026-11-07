/* Long Valley: a relaxing driving sim. One valley, chosen seasons and weather, three vehicles. */
(() => {
'use strict';
const T = window.THREE;
const mb = window.mindblown;
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
if (!T) { $('go').textContent = 'Could not load the 3D library'; return; }

// ---------------------------------------------------------------- tune
let tune = {};
const fromFile = () => fetch('tune.json').then((r) => r.json())
  .then((f) => Object.fromEntries(Object.entries(f).map(([k, e]) => [k, e.value]))).catch(() => ({}));
const tv = (k, d) => (tune[k] !== undefined ? tune[k] : d);

// ---------------------------------------------------------------- vehicles
const VEHICLES = {
  rally: { exh: { y: 0.3, x: [0.42] }, name: 'Rally hatchback', desc: 'Early-90s rally car. Balanced, light, happy to slide.', file: 'assets/car/rallycar.glb', len: 4.0,
    top: 52, accel: 9, grip: 1, offGrip: 0.82, offTop: 0.8, drift: 1.15, steer: 1, roll: 1, susp: 1, mass: 1, bars: { Speed: 0.68, Grip: 0.72, 'Off road': 0.75, Drift: 0.9 } },
  truck: { exh: { y: 0.5, x: [-0.55] }, name: '4x4 truck', desc: 'Tall and heavy. Slow on tarmac, shrugs off dirt, snow and grass.', file: 'assets/car/truck4x4.glb', len: 4.7, flip: false,
    top: 40, accel: 7.2, grip: 0.86, offGrip: 1.08, offTop: 1.0, drift: 0.55, steer: 0.82, roll: 1.9, susp: 1.7, mass: 1.6, bars: { Speed: 0.45, Grip: 0.55, 'Off road': 1, Drift: 0.35 } },
  sports: { exh: { y: 0.3, x: [-0.5, -0.36, 0.36, 0.5] }, name: 'Sports coupe', desc: 'Low and quick with sticky road tyres. Nervous anywhere but tarmac.', file: 'assets/car/sportscar.glb', len: 4.35,
    top: 74, accel: 12.5, grip: 1.22, offGrip: 0.55, offTop: 0.42, drift: 0.85, steer: 1.08, roll: 0.55, susp: 0.55, mass: 0.9, bars: { Speed: 1, Grip: 1, 'Off road': 0.25, Drift: 0.65 } },
  muscle: { exh: { y: 0.3, x: [-0.6, 0.6] }, name: 'Muscle coupe', desc: 'Big V8, long bonnet, loose rear end. Huge pull in a straight line and loves a smoky slide.', file: 'assets/car/musclecar.glb', len: 4.8,
    top: 68, accel: 13.5, grip: 0.96, offGrip: 0.62, offTop: 0.5, drift: 1.35, steer: 0.92, roll: 1.2, susp: 0.9, mass: 1.25, bars: { Speed: 0.92, Grip: 0.6, 'Off road': 0.3, Drift: 1 } },
  buggy: { exh: { y: 1.0, x: [-0.22, 0.22], up: 0.45 }, name: 'Dune buggy', desc: 'Light tube frame on long-travel springs. Made for jumps, dirt and sand; twitchy on tarmac.', file: 'assets/car/buggy.glb', len: 3.6,
    top: 50, accel: 11, grip: 0.9, offGrip: 1.12, offTop: 1.02, drift: 1.05, steer: 1.12, roll: 1.4, susp: 1.9, mass: 0.75, air: 1.35, bars: { Speed: 0.62, Grip: 0.62, 'Off road': 1, Drift: 0.75 } },
};
const RAMP_KINDS = {
  kicker: { name: 'Kicker', len: 7, back: 2.6, w: 4.6, h: 1.5, f: (t) => Math.pow(t, 1.8) },
  big: { name: 'Big jump', len: 13, back: 4.8, w: 6, h: 3.4, f: (t) => Math.pow(t, 1.6) },
  launch: { name: 'Launcher', len: 5.5, back: 3.2, w: 4.2, h: 2.3, f: (t) => Math.pow(t, 2.3) },
  table: { name: 'Tabletop', len: 24, back: 0, w: 7, h: 1.9, table: true },
};
const RAMP_IDS = Object.keys(RAMP_KINDS);
// the wheels are drawn here rather than taken from the generated meshes: round tyres with a real
// tread and sidewall, and a rim with spokes, so they read as wheels when they spin
const WHEEL_STYLE = {
  rally: { rim: 'multi', spokes: 10, rimCol: '#c9ccd0', metal: 0.85, ratio: 0.66, tread: 'road', tyreW: 0.22 },
  truck: { rim: 'steel', spokes: 6, rimCol: '#2b2d30', metal: 0.5, ratio: 0.56, tread: 'knob', tyreW: 0.32, ring: '#b9bcc0' },
  sports: { rim: 'split', spokes: 5, rimCol: '#3a3d42', metal: 0.9, ratio: 0.76, tread: 'road', tyreW: 0.26 },
  muscle: { rim: 'five', spokes: 5, rimCol: '#d8dadc', metal: 1, ratio: 0.68, tread: 'road', tyreW: 0.27 },
  buggy: { rim: 'steel', spokes: 8, rimCol: '#18191b', metal: 0.4, ratio: 0.5, tread: 'knob', tyreW: 0.3, ring: '#e0b52a' },
};

// ---------------------------------------------------------------- player settings
const QUALITY = {
  low: { lens: false, shadows: false, shadowRes: 1024, shadowDist: 40, resScale: 0.7, aa: 0, aniso: 4, sharpen: false, sunRays: false, drawDist: 600, grass: 0.25, dust: 0.6, bloom: false, trees: 0.45, tree3d: false, tree3dDist: 60, sway: false, cloudShadows: false, birds: false },
  medium: { lens: true, shadows: true, shadowRes: 1024, shadowDist: 60, resScale: 0.85, aa: 4, aniso: 8, sharpen: false, sunRays: true, drawDist: 1000, grass: 0.6, dust: 0.85, bloom: true, trees: 0.7, tree3d: true, tree3dDist: 90, sway: true, cloudShadows: true, birds: true },
  high: { lens: true, shadows: true, shadowRes: 2048, shadowDist: 90, resScale: 1, aa: 4, aniso: 16, sharpen: true, sunRays: true, drawDist: 1600, grass: 1, dust: 1, bloom: true, trees: 0.9, tree3d: true, tree3dDist: 150, sway: true, cloudShadows: true, birds: true },
  ultra: { lens: true, shadows: true, shadowRes: 4096, shadowDist: 130, resScale: 1, aa: 8, aniso: 16, sharpen: true, sunRays: true, drawDist: 2200, grass: 1, dust: 1.2, bloom: true, trees: 1, tree3d: true, tree3dDist: 230, sway: true, cloudShadows: true, birds: true },
};
const HANDLING = {
  relaxed: { steer: 0.85, steerSpeed: 0.75, throttle: 0.8, brake: 0.9, assist: true },
  balanced: { steer: 1, steerSpeed: 1, throttle: 1, brake: 1, assist: true },
  rally: { steer: 1.2, steerSpeed: 1.35, throttle: 1.15, brake: 1.1, assist: false },
};
const P = {};
function prefDefaults() {
  return {
    vehicle: 'rally',
    handling: 'balanced', steer: 1, steerSpeed: 1, throttle: 1, brake: 1, handbrake: true, assist: true, units: 'kmh',
    camLag: 1, showFps: false, speedSteer: 1, camAim: 1, cineCut: 85, dynRes: true, brightness: 1, vivid: 1, rainGlass: true, sfxVol: 1,
    showMap: true, showDial: true, showLap: true, showSurface: true,
    camMode: 0, camDist: tv('camdistance', 6.4), camHeight: tv('camheight', 1.9), fov: 58, camShake: true,
    quality: 'high', ...QUALITY.high, weatherAmt: 1, tod: 'season',
    volume: 0.8, engineVol: 1, ambVol: 1, touchShow: 'auto', touchSize: 'normal', hudScale: 1, roadRamps: true, rampKind: 'kicker', infNitro: false,
  };
}
Object.assign(P, prefDefaults());

// ---------------------------------------------------------------- noise
function hash2(i, j) {
  let h = (Math.imul(i, 374761393) + Math.imul(j, 668265263)) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177); h ^= h >>> 16;
  return (h >>> 0) / 4294967296;
}
function vnoise(x, y) {
  const i = Math.floor(x), j = Math.floor(y), fx = x - i, fy = y - j;
  const u = fx * fx * (3 - 2 * fx), v = fy * fy * (3 - 2 * fy);
  const a = hash2(i, j), b = hash2(i + 1, j), c = hash2(i, j + 1), d = hash2(i + 1, j + 1);
  return (a + (b - a) * u + (c - a) * v + (a - b - c + d) * u * v) * 2 - 1;
}
function fbm(x, y, o = 5) { let s = 0, a = 0.5, f = 1; for (let k = 0; k < o; k++) { s += a * vnoise(x * f, y * f); f *= 2.03; a *= 0.5; } return s; }
function ridged(x, y, o = 5) {
  let s = 0, a = 0.5, f = 1, w = 1;
  for (let k = 0; k < o; k++) { let n = 1 - Math.abs(vnoise(x * f, y * f)); n *= n; n *= w; w = Math.min(1, n * 2); s += a * n; f *= 2.1; a *= 0.5; }
  return s;
}
function rng(seed) { return () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }

const WATER = -5.5;
function h0(x, z) {
  const r = Math.hypot(x, z);
  let h = fbm(x * 0.0032 + 7.3, z * 0.0032 - 3.1, 4) * 26 + fbm(x * 0.019, z * 0.019, 3) * 2.6;
  const m = Math.pow(smooth(500, 960, r), 1.5);
  h += m * (50 + 300 * ridged(x * 0.0019 + 11.7, z * 0.0019 + 5.2, 6));
  h += smooth(1100, 2100, r) * 1150 * ridged(x * 0.0009 - 4.4, z * 0.0009 + 9.1, 6);
  h -= 30 * (1 - smooth(70, 235, r));
  // A gently banked river branch feeds the original central lake.
  const riverX=80+Math.sin((z+130)*.012)*45;
  const riverBank=(1-smooth(10,40,Math.abs(x-riverX)))*smooth(-540,-480,z)*(1-smooth(-120,-80,z));
  h=lerp(h,Math.min(h,WATER-2.5),riverBank);
  return h;
}

// ---------------------------------------------------------------- seasons and weather
const SEASONS = ['green', 'dust', 'snow'];
const SEASON_NAME = { green: 'Green', dust: 'Dust', snow: 'Snow' };
const SEASON_TARGET = { green: { dry: 0, snow: 0 }, dust: { dry: 1, snow: 0 }, snow: { dry: 0.25, snow: 1 } };
const WEATHERS = ['clear', 'overcast', 'rain', 'fog', 'snowfall'];
const WEATHER_NAME = { clear: 'Clear', overcast: 'Overcast', rain: 'Rain', fog: 'Fog', snowfall: 'Snowfall' };
const C = (h) => new T.Color(h);
// sky and light per season, blended by weight
const SP = {
  green: { elev: 14, az: 2.45, sun: C('#ffd9a8'), sunI: 3.5, top: C('#5f90c8'), hor: C('#cdd8e2'), fog: 150, cap: 0.8, hemiS: C('#c4d4e4'), hemiG: C('#5d6b45'), grip: 1 },
  dust: { elev: 13, az: 2.45, sun: C('#ffcf94'), sunI: 3.7, top: C('#7299c6'), hor: C('#dcd6ca'), fog: 175, cap: 0.82, hemiS: C('#d8d4c8'), hemiG: C('#8a7650'), grip: 0.96 },
  snow: { elev: 15, az: 2.45, sun: C('#ffecd8'), sunI: 3.2, top: C('#6f98c8'), hor: C('#d6e0ea'), fog: 135, cap: 0.8, hemiS: C('#cfe0f2'), hemiG: C('#b8c6d6'), grip: 0.5 },
};
const WP = {
  clear: { over: 0, cloud: 0.32, fogM: 1, cap: 0, wet: 0, rain: 0, snow: 0, grip: 1, sunM: 1, grey: C('#aab4bd') },
  overcast: { over: 0.75, cloud: 0.85, fogM: 1.5, cap: 0.05, wet: 0, rain: 0, snow: 0, grip: 1, sunM: 0.22, grey: C('#a6adb3') },
  rain: { over: 0.95, cloud: 0.96, fogM: 3.2, cap: 0.1, wet: 1, rain: 1, snow: 0, grip: 0.72, sunM: 0.08, grey: C('#7c848b') },
  fog: { over: 0.88, cloud: 0.8, fogM: 22, cap: 0.1, wet: 0.3, rain: 0, snow: 0, grip: 0.94, sunM: 0.18, grey: C('#c3c8cc') },
  snowfall: { over: 0.92, cloud: 0.92, fogM: 5.5, cap: 0.1, wet: 0, rain: 0, snow: 1, grip: 0.8, sunM: 0.12, grey: C('#c9d0d6') },
};
let season = 'dust', weather = 'clear';
const SV = { dry: 1, snow: 0 }; // live, eased season state
const W = { over: 0, cloud: 0.32, fogM: 1, cap: 0, wet: 0, rain: 0, snow: 0, grip: 1, sunM: 1, grey: C('#aab4bd') };
const seasonW = () => { const s = SV.snow, d = SV.dry * (1 - s); return { green: Math.max(0, 1 - s - d), dust: d, snow: s }; };

// ---------------------------------------------------------------- renderer
const canvas = $('c');
const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
renderer.setPixelRatio(window.devicePixelRatio || 1);
renderer.setSize(innerWidth, innerHeight, false);
renderer.toneMapping = T.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.0;
renderer.outputColorSpace = T.SRGBColorSpace;
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;
let software = false;
try {
  const gl = renderer.getContext(); const ext = gl.getExtension('WEBGL_debug_renderer_info');
  const name = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '';
  software = /swiftshader|llvmpipe|software|basic render|mesa offscreen/i.test(name);
} catch (e) { /* ignore */ }
const MAXANI = renderer.capabilities.getMaxAnisotropy();

// aerial perspective: exponential haze with a ceiling, so the far peaks fade to blue-grey and never vanish on a clear day.
// THREE.Fog carries the numbers: near = density x 1e6, far = the most haze any distance gets.
T.ShaderChunk.fog_fragment = `#ifdef USE_FOG
  #ifdef FOG_EXP2
    float fogFactor = 1.0 - exp( - fogDensity * fogDensity * vFogDepth * vFogDepth );
  #else
    float fogFactor = min( 1.0 - exp( - vFogDepth * fogNear * 0.000001 ), fogFar );
  #endif
  vec3 fogC = fogColor * mix(vec3(1.0), vec3(0.9, 0.96, 1.06), smoothstep(600.0, 4000.0, vFogDepth));
  gl_FragColor.rgb = mix( gl_FragColor.rgb, fogC, fogFactor );
#endif`;

const scene = new T.Scene();
const camera = new T.PerspectiveCamera(58, innerWidth / innerHeight, 0.25, 12000);
const xrWorldPosition=new T.Vector3();
function cameraWorldPosition(){return window.GOAXR?.active()?camera.getWorldPosition(xrWorldPosition):camera.position;}
scene.fog = new T.Fog(0xc9d6e0, 520, 0.9);
const sun = new T.DirectionalLight(0xffffff, 3);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
const SH = 60;
Object.assign(sun.shadow.camera, { left: -SH, right: SH, top: SH, bottom: -SH, near: 1, far: 600 });
sun.shadow.normalBias = 0.04; sun.shadow.bias = -0.0003;
scene.add(sun, sun.target);
const hemi = new T.HemisphereLight(0xcfe6ff, 0x6f8a4a, 0.9);
scene.add(hemi);

// post: gentle bloom that only the sun and its glints reach
let composer = null, bloomPass = null, lensPass = null;
try {
  composer = new T.EffectComposer(renderer, new T.WebGLRenderTarget(innerWidth, innerHeight, { type: T.HalfFloatType, samples: 4 }));
  composer.addPass(new T.RenderPass(scene, camera));
  bloomPass = new T.UnrealBloomPass(new T.Vector2(innerWidth, innerHeight), 0.32, 0.55, 1.05);
  composer.addPass(bloomPass);
  lensPass = new T.ShaderPass({
    uniforms: { tDiffuse: { value: null }, uBlur: { value: 0 }, uVig: { value: 0.3 }, uWarm: { value: 0 }, uSat: { value: 1 }, uSharp: { value: 0 }, uTexel: { value: new T.Vector2(1 / 1280, 1 / 720) }, uSun: { value: new T.Vector3(0.5, 0.5, 0) }, uRays: { value: 0 }, uSunCol: { value: new T.Color(1, 0.9, 0.75) } },
    vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
    fragmentShader: `uniform sampler2D tDiffuse; uniform float uBlur, uVig, uWarm, uSat, uSharp, uRays; uniform vec2 uTexel; uniform vec3 uSun, uSunCol; varying vec2 vUv;
      float lum(vec3 c){ return dot(c, vec3(0.2126, 0.7152, 0.0722)); }
      void main(){
        vec2 d = vUv - vec2(0.5, 0.56); float r = length(d * vec2(1.25, 1.0));
        vec4 c = texture2D(tDiffuse, vUv);
        if (uSharp > 0.001) {
          vec3 nb = texture2D(tDiffuse, vUv + vec2(uTexel.x, 0.0)).rgb + texture2D(tDiffuse, vUv - vec2(uTexel.x, 0.0)).rgb
                  + texture2D(tDiffuse, vUv + vec2(0.0, uTexel.y)).rgb + texture2D(tDiffuse, vUv - vec2(0.0, uTexel.y)).rgb;
          vec3 hp = c.rgb - nb * 0.25;
          c.rgb += clamp(hp, vec3(-0.08), vec3(0.08)) * uSharp;
        }
        if (uBlur > 0.002) {
          float k = uBlur * smoothstep(0.12, 0.65, r); vec3 acc = c.rgb;
          for (int i = 1; i < 9; i++) acc += texture2D(tDiffuse, vUv - d * (float(i) / 8.0) * k * 0.13).rgb;
          c.rgb = acc / 9.0;
        }
        // light shafts: bright sky near the sun smeared toward the viewer, cut by whatever stands in front of it
        if (uRays > 0.001 && uSun.z > 0.001) {
          vec2 toS = uSun.xy - vUv; vec2 asp = vec2(uTexel.y / uTexel.x, 1.0);
          float ds = length(toS * asp);
          vec2 stepv = toS / 28.0; vec2 tc = vUv; float dec = 1.0; vec3 ra = vec3(0.0);
          float jit = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
          tc += stepv * jit;
          for (int i = 0; i < 28; i++) {
            vec3 sm = texture2D(tDiffuse, tc).rgb; float l = lum(sm);
            ra += sm * smoothstep(0.9, 2.2, l) / max(l, 1e-3) * min(l, 3.0) * dec;
            dec *= 0.955; tc += stepv;
          }
          c.rgb += ra / 28.0 * uSunCol * uRays * uSun.z * exp(-ds * 2.2) * 0.9;
        }
        float l = lum(c.rgb);
        c.rgb = mix(vec3(l), c.rgb, 1.08 * uSat);
        c.rgb *= vec3(1.0 + uWarm * 0.05, 1.0, 1.0 - uWarm * 0.06);
        c.rgb *= mix(1.0, smoothstep(1.15, 0.28, r), uVig);
        gl_FragColor = vec4(clamp(c.rgb, 0.0, 64.0), c.a);
      }`,
  });
  composer.addPass(lensPass);
  composer.addPass(new T.OutputPass());
} catch (e) { composer = null; }

// ---------------------------------------------------------------- textures
const loader = new T.TextureLoader();
let pending = 0, loaded = 0;
function tex(url, color = true, rep = true) {
  pending++;
  const t = loader.load(url, () => { loaded++; progress(); }, undefined, () => { loaded++; progress(); });
  if (color) t.colorSpace = T.SRGBColorSpace;
  if (rep) t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = MAXANI;
  return t;
}
function progress() { const el = $('loading'); if (el && !ready) el.textContent = `${Math.round(loaded / Math.max(1, pending) * 100)}%`; }
const TX = {
  gG: tex('assets/tex/grass_green.jpg'), gD: tex('assets/tex/grass_dry.jpg'), dirt: tex('assets/tex/dirt.jpg'), grav: tex('assets/tex/gravel.jpg'),
  rock: tex('assets/tex/rock.jpg'), snow: tex('assets/tex/snow.jpg'), asp: tex('assets/tex/asphalt.jpg'), snowRoad: tex('assets/tex/snowroad.jpg'),
  // retexture: a matching normal map for every ground surface, so pebbles, cracks, grass and snow crust catch the light
  gGN: tex('assets/tex/grass_green_n.jpg', false), gDN: tex('assets/tex/grass_dry_n.jpg', false), dirtN: tex('assets/tex/dirt_n.jpg', false),
  gravN: tex('assets/tex/gravel_n.jpg', false), rockN: tex('assets/tex/rock_n.jpg', false), snowN: tex('assets/tex/snow_n.jpg', false),
  aspN: tex('assets/tex/asphalt_n.jpg', false), snowRoadN: tex('assets/tex/snowroad_n.jpg', false),
  pine: tex('assets/sprites/pine.webp', true, false), pineSnow: tex('assets/sprites/pine_snow.webp', true, false),
  pine2: tex('assets/sprites/pine2.webp', true, false), grass: tex('assets/sprites/grass_clump.webp', true, false),
  firSnow: tex('assets/sprites/fir_snow.webp', true, false),
  spruce: tex('assets/sprites/spruce_tall.webp', true, false), spruceDust: tex('assets/sprites/spruce_tall_dust.webp', true, false), spruceSnow: tex('assets/sprites/spruce_tall_snow.webp', true, false),
  birch: tex('assets/sprites/birch_green.webp', true, false), birchDust: tex('assets/sprites/birch_dust.webp', true, false), birchSnow: tex('assets/sprites/birch_snow.webp', true, false),
};
function canvasTex(w, h, draw, color = true, repeat = true) {
  const c = document.createElement('canvas'); c.width = w; c.height = h;
  const g = c.getContext('2d'); draw(g, w, h);
  const t = new T.CanvasTexture(c);
  if (color) t.colorSpace = T.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = T.RepeatWrapping;
  t.anisotropy = MAXANI;
  return t;
}
function normalFromHeight(w, h, hf, strength) {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const g = c.getContext('2d');
  const d = g.createImageData(w, h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const dx = (hf((x + 1) % w, y) - hf((x - 1 + w) % w, y)) * strength;
    const dy = (hf(x, (y + 1) % h) - hf(x, (y - 1 + h) % h)) * strength;
    const l = Math.hypot(dx, dy, 1); const i = (y * w + x) * 4;
    d.data[i] = (-dx / l * 0.5 + 0.5) * 255; d.data[i + 1] = (dy / l * 0.5 + 0.5) * 255; d.data[i + 2] = (1 / l * 0.5 + 0.5) * 255; d.data[i + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  const t = new T.CanvasTexture(c); t.wrapS = t.wrapT = T.RepeatWrapping; t.anisotropy = MAXANI;
  return t;
}
const softDot = canvasTex(64, 64, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.4, 'rgba(255,255,255,.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
}, false, false);
const waterN = normalFromHeight(256, 256, (x, y) => fbm(x / 18, y / 10, 4) + fbm(x / 5 + 11, y / 6, 3) * 0.25, 3);
waterN.repeat.set(40, 40);
const groundN = normalFromHeight(256, 256, (x, y) => fbm(x / 9, y / 9, 4) + fbm(x / 3 + 40, y / 3, 2) * 0.3, 1.6);

// ---------------------------------------------------------------- shared season uniforms
const U = {
  tGG: { value: TX.gG }, tGD: { value: TX.gD }, tDirt: { value: TX.dirt }, tGrav: { value: TX.grav }, tRock: { value: TX.rock }, tSnow: { value: TX.snow },
  tAsp: { value: TX.asp }, tSnowRoad: { value: TX.snowRoad }, tGN: { value: groundN },
  tGGn: { value: TX.gGN }, tGDn: { value: TX.gDN }, tDirtN: { value: TX.dirtN }, tGravN: { value: TX.gravN }, tRockN: { value: TX.rockN }, tSnowN: { value: TX.snowN },
  uDry: { value: 1 }, uSnow: { value: 0 }, uWet: { value: 0 }, uSnowline: { value: 330 }, uTime: { value: 0 }, uPuddle: { value: 0 },
  uDustCol: { value: C('#cbb48c') },
  uCloudSh: { value: 0 }, uCloudCov: { value: 0.6 }, uCloudOff: { value: new T.Vector2() },
};
// drifting cloud shadows: one shared field, read by the ground, the roads and the trees
const CLOUD_GLSL = `
uniform float uCloudSh, uCloudCov; uniform vec2 uCloudOff;
float ch21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float cvn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(ch21(i), ch21(i + vec2(1, 0)), f.x), mix(ch21(i + vec2(0, 1)), ch21(i + vec2(1, 1)), f.x), f.y); }
float cloudSh(vec2 xz){ if (uCloudSh <= 0.0) return 1.0; vec2 q = xz + uCloudOff;
  float n = cvn(q * 0.0022) * 0.6 + cvn(q * 0.0061 + 7.3) * 0.28 + cvn(q * 0.017 - 3.1) * 0.12;
  return 1.0 - uCloudSh * smoothstep(uCloudCov, uCloudCov + 0.12, n); }
`;
const CLOUD_LIGHT = '#include <lights_fragment_end>\n{ float cS = cloudSh(vWP.xz); reflectedLight.directDiffuse *= cS; reflectedLight.directSpecular *= cS; }';
const GLSL_COMMON = CLOUD_GLSL + `
uniform sampler2D tGG, tGD, tDirt, tGrav, tRock, tSnow, tAsp, tSnowRoad, tGN;
uniform sampler2D tGGn, tGDn, tDirtN, tGravN, tRockN, tSnowN;
// tangent-space normal, sampled with the same two-layer anti-tiling blend as the colour (tx2)
vec3 txn(sampler2D t, vec2 p){
  vec2 q=mat2(0.8,-0.6,0.6,0.8)*p*0.93+vec2(0.37,0.71);
  float textureBlend=smoothstep(0.23,0.77,cvn(p*0.12));
  vec3 a=texture2D(t,p).xyz*2.0-1.0, b=texture2D(t,q).xyz*2.0-1.0;
  b.xy=mat2(0.8,0.6,-0.6,0.8)*b.xy; // undo the layer's rotation so its slopes point the right way
  return mix(a,b,textureBlend*0.68);
}
uniform float uDry, uSnow, uWet, uSnowline, uTime, uPuddle; uniform vec3 uDustCol;
vec3 tx2(sampler2D t, vec2 p){
  vec2 q=mat2(0.8,-0.6,0.6,0.8)*p*0.93+vec2(0.37,0.71);
  float textureBlend=smoothstep(0.23,0.77,cvn(p*0.12));
  return mix(texture2D(t,p).rgb,texture2D(t,q).rgb,textureBlend*0.68);
}
float h21(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vn(vec2 p){ vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f); return mix(mix(h21(i), h21(i + vec2(1, 0)), f.x), mix(h21(i + vec2(0, 1)), h21(i + vec2(1, 1)), f.x), f.y); }
`;

// ---------------------------------------------------------------- roads
const HW_MAIN = 5.6, HW_TRAIL = 3.4;
function sampleCurve(curve, step) {
  const len = curve.getLength(); const n = Math.max(8, Math.round(len / step));
  const pts = curve.getSpacedPoints(n); if (curve.closed) pts.pop();
  return pts;
}
function smoothHeights(arr, win, closed, passes) {
  const n = arr.length;
  for (let p = 0; p < passes; p++) {
    const out = new Float32Array(n);
    for (let i = 0; i < n; i++) {
      let s = 0, c = 0;
      for (let k = -win; k <= win; k++) { let j = i + k; if (closed) j = (j + n) % n; else if (j < 0 || j >= n) continue; s += arr[j]; c++; }
      out[i] = s / c;
    }
    arr.set(out);
  }
}
const mainCtl = [];
for (let i = 0; i < 16; i++) {
  const a = i / 16 * Math.PI * 2;
  const r = 390 + 66 * Math.sin(3 * a + 0.6) + 34 * Math.sin(5 * a + 1.3);
  mainCtl.push(new T.Vector3(Math.cos(a) * r, 0, Math.sin(a) * r));
}
const mainCurve = new T.CatmullRomCurve3(mainCtl, true, 'centripetal');
const mainPts = sampleCurve(mainCurve, 2);
const NM = mainPts.length;
const mainY = new Float32Array(NM);
mainPts.forEach((p, i) => { mainY[i] = Math.max(h0(p.x, p.z), WATER + 2.5); });
smoothHeights(mainY, 30, true, 4);
const A1 = 0.12 * Math.PI * 2, A2 = 0.42 * Math.PI * 2;
function mainPointAtAngle(a) {
  let best = 0, bd = 1e9;
  for (let i = 0; i < NM; i++) { let d = Math.abs(Math.atan2(mainPts[i].z, mainPts[i].x) - a); d = Math.min(d, Math.PI * 2 - d); if (d < bd) { bd = d; best = i; } }
  return best;
}
const j1 = mainPointAtAngle(A1), j2 = mainPointAtAngle(A2);
const trailCtl = [mainPts[j1].clone()];
const trailR = [0, 560, 650, 700, 665, 720, 690, 610, 0];
for (let k = 1; k < trailR.length - 1; k++) {
  const a = lerp(A1, A2, k / (trailR.length - 1)) + Math.sin(k * 2.1) * 0.03;
  trailCtl.push(new T.Vector3(Math.cos(a) * trailR[k], 0, Math.sin(a) * trailR[k]));
}
trailCtl.push(mainPts[j2].clone());
const trailCurve = new T.CatmullRomCurve3(trailCtl, false, 'centripetal');
const trailPts = sampleCurve(trailCurve, 2);
const NT = trailPts.length;
const trailY = new Float32Array(NT);
trailPts.forEach((p, i) => { trailY[i] = Math.max(h0(p.x, p.z), WATER + 2.5); });
smoothHeights(trailY, 6, false, 3);
for (let i = 0; i < NT; i++) {
  const e1 = 1 - smooth(0, 40, i), e2 = 1 - smooth(0, 40, NT - 1 - i);
  trailY[i] = lerp(trailY[i], mainY[j1], e1); trailY[i] = lerp(trailY[i], mainY[j2], e2);
}
const ROADS = [
  { pts: mainPts, y: mainY, closed: true, hw: HW_MAIN, id: 0 },
  { pts: trailPts, y: trailY, closed: false, hw: HW_TRAIL, id: 1 },
];
const CELL = 32, hash = new Map();
const hkey = (ix, iz) => ix * 100003 + iz;
for (const R of ROADS) R.pts.forEach((p, i) => {
  const k = hkey(Math.floor(p.x / CELL), Math.floor(p.z / CELL));
  let l = hash.get(k); if (!l) hash.set(k, l = []); l.push(R.id, i);
});
const _q = { d: 1e9, road: -1, i: 0, y: 0, lat: 0, tx: 1, tz: 0, hw: 6 };
function nearestRoad(x, z, out = _q) {
  out.d = 1e9; out.road = -1;
  const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
  let bestD2 = 1e18, br = -1, bi = 0;
  for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) {
    const l = hash.get(hkey(cx + a, cz + b)); if (!l) continue;
    for (let k = 0; k < l.length; k += 2) {
      const p = ROADS[l[k]].pts[l[k + 1]]; const dx = p.x - x, dz = p.z - z; const d2 = dx * dx + dz * dz;
      const bias = l[k] === 1 ? 4 : 0;
      if (d2 + bias < bestD2) { bestD2 = d2 + bias; br = l[k]; bi = l[k + 1]; }
    }
  }
  if (br < 0) return out;
  const R = ROADS[br], n = R.pts.length;
  let best = null;
  for (const s of [-1, 1]) {
    let j = bi + s; if (R.closed) j = (j + n) % n; else if (j < 0 || j >= n) continue;
    const i0 = s < 0 ? j : bi, i1 = s < 0 ? bi : j;
    const p0 = R.pts[i0], p1 = R.pts[i1];
    const ex = p1.x - p0.x, ez = p1.z - p0.z, L2 = ex * ex + ez * ez || 1;
    const t = clamp(((x - p0.x) * ex + (z - p0.z) * ez) / L2, 0, 1);
    const px = p0.x + ex * t, pz = p0.z + ez * t; const d = Math.hypot(x - px, z - pz);
    if (!best || d < best.d) { const L = Math.sqrt(L2); best = { d, t, i0, i1, tx: ex / L, tz: ez / L, lat: ((x - p0.x) * (-ez) + (z - p0.z) * ex) / L }; }
  }
  if (!best) return out;
  out.d = best.d; out.road = br; out.i = best.t < 0.5 ? best.i0 : best.i1;
  out.y = lerp(R.y[best.i0], R.y[best.i1], best.t); out.lat = best.lat; out.tx = best.tx; out.tz = best.tz; out.hw = R.hw;
  return out;
}
function roadFrame(R, i) {
  const n = R.pts.length; const p = R.pts[i];
  const pn = R.pts[R.closed ? (i + 1) % n : Math.min(i + 1, n - 1)], pp = R.pts[R.closed ? (i - 1 + n) % n : Math.max(i - 1, 0)];
  let tx = pn.x - pp.x, tz = pn.z - pp.z; const L = Math.hypot(tx, tz) || 1; tx /= L; tz /= L;
  return { p, tx, tz, nx: -tz, nz: tx, y: R.y[i] };
}

// ---------------------------------------------------------------- terrain
const TS = 2400, TN = 400, STEP = TS / TN, TV = TN + 1;
const TH = new Float32Array(TV * TV);
const TRD = new Float32Array(TV * TV);
const q2 = {};
for (let j = 0; j < TV; j++) for (let i = 0; i < TV; i++) {
  const x = -TS / 2 + i * STEP, z = -TS / 2 + j * STEP; const k = j * TV + i;
  let h = h0(x, z);
  const q = nearestRoad(x, z, q2);
  let rd = 999;
  if (q.road >= 0) {
    rd = q.d - q.hw;
    const flat = smooth(3.0, 24, rd);
    h = lerp(q.y - 0.08, h, flat);
    if (rd < 2.2) h = Math.min(h, q.y - 0.08);
  }
  TH[k] = h; TRD[k] = rd;
}
function terrainH(x, z) {
  const fx = (x + TS / 2) / STEP, fz = (z + TS / 2) / STEP;
  const i = clamp(Math.floor(fx), 0, TN - 1), j = clamp(Math.floor(fz), 0, TN - 1);
  const u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1);
  const a = TH[j * TV + i], b = TH[j * TV + i + 1], c = TH[(j + 1) * TV + i], d = TH[(j + 1) * TV + i + 1];
  if (u + v <= 1) return a + (b - a) * u + (c - a) * v;
  return d + (c - d) * (1 - u) + (b - d) * (1 - v);
}
function terrainMaterial(far) {
  const m = new T.MeshStandardMaterial({ roughness: 0.95, metalness: 0, normalMap: groundN, normalScale: new T.Vector2(0.2, 0.2) });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec4 aInfo; varying vec4 vInfo; varying vec3 vWP; varying vec3 vWN;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInfo = aInfo; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz; vWN = normalize(mat3(modelMatrix) * objectNormal);');
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec4 vInfo; varying vec3 vWP; varying vec3 vWN;' + GLSL_COMMON)
      .replace('#include <map_fragment>', `
        vec2 p = vWP.xz / 4.5;
        float slope = vInfo.x, rd = vInfo.y, n1 = vInfo.z, n2 = vInfo.w;
        float dist = length(vWP - cameraPosition);
        vec3 col = mix(tx2(tGG, p), tx2(tGD, p), uDry);
        col *= 0.88 + 0.2 * (n1 + 0.5);
        col *= mix(vec3(0.83,1.02,0.76),vec3(1.0),uDry);
        float dirtK = smoothstep(0.18, 0.52, n2 + (vn(vWP.xz * 0.15) - 0.5) * 0.2) * 0.48;
        vec3 dirt = tx2(tDirt, p * 1.2);
        dirt = mix(dirt * vec3(0.55, 0.5, 0.46), dirt, uDry);
        col = mix(col, dirt, dirtK);
        float sh = 1.0 - smoothstep(0.35, 1.8, rd + (vn(vWP.xz*0.7)-0.5)*0.8);
        vec3 grav = tx2(tGrav, p * 1.6) * mix(vec3(0.82), vec3(1.06, 1.02, 0.95), uDry);
        col = mix(col, grav, sh);
        float shore = 1.0 - smoothstep(${(WATER + 0.3).toFixed(2)}, ${(WATER + 2.0).toFixed(2)}, vWP.y);
        col = mix(col, grav * 0.85, shore);
        vec3 nn = normalize(vWN);
        float bx = abs(nn.x) / (abs(nn.x) + abs(nn.z) + 1e-3);
        vec3 blendWeight=pow(abs(nn),vec3(4.0));blendWeight/=max(dot(blendWeight,vec3(1.0)),0.0001);
        vec3 rk=tx2(tRock,vWP.zy/7.5)*blendWeight.x+tx2(tRock,vWP.xz/7.5)*blendWeight.y+tx2(tRock,vWP.xy/7.5)*blendWeight.z;
        float rock = smoothstep(0.14, 0.3, slope + n2 * 0.1);
        col = mix(col, rk * 0.95, rock);
        // the forest beyond the drivable valley: dark conifer cover on the lower and middle slopes, so the ridges read as wooded and haze to blue
        float ringR = length(vWP.xz);
        float forest = ${far ? '1.0' : 'smoothstep(560.0, 950.0, ringR)'} * (1.0 - smoothstep(0.78, 0.97, slope)) * (1.0 - smoothstep(600.0, 760.0, vWP.y + n1 * 200.0)) * smoothstep(0.28, 0.5, vn(vWP.xz * 0.0035) * 0.65 + vn(vWP.xz * 0.011 + 3.7) * 0.35);
        vec3 fcol = mix(vec3(0.03, 0.055, 0.03), vec3(0.045, 0.058, 0.032), uDry) * (0.8 + 0.4 * vn(vWP.xz * 0.05));
        col = mix(col, fcol, forest * 0.94);
        col *= mix(1.0, 0.68, rock * (1.0 - forest) * ${far ? '1.0' : 'smoothstep(560.0, 950.0, ringR)'});
        float steep = smoothstep(0.32, 0.62, slope);
        float hs = smoothstep(uSnowline - 30.0, uSnowline + 40.0, vWP.y + n1 * 70.0);
        float snow = max(uSnow * (1.0 - steep * 0.8), hs * (1.0 - steep * ${far ? '0.35' : '0.75'}));
        snow = clamp(snow * (0.9 + 0.2 * vn(vWP.xz * 0.08)), 0.0, 1.0);
        snow *= 1.0 - forest * 0.45 * (1.0 - hs);
        vec3 sn = tx2(tSnow,p*.75)*mix(vec3(.86,.92,1.0),vec3(1.0),smoothstep(.0,.9,nn.y));
        sn *= .94+.06*vn(vWP.xz*.025);
        col = mix(col, sn, snow);
        float wet = uWet * (1.0 - snow);
        col *= 1.0 - wet * 0.32;
        ${far ? 'col = mix(col, vec3(dot(col, vec3(0.33))) * vec3(0.93, 0.96, 1.02), 0.3);' : ''}
        diffuseColor.rgb *= col;
      `)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
        // per-material normal maps, blended with the same weights as the colours above
        vec3 gN = mix(txn(tGGn, p), txn(tGDn, p), uDry);
        gN = mix(gN, txn(tDirtN, p * 1.2), dirtK);
        gN = mix(gN, txn(tGravN, p * 1.6), max(sh, shore));
        gN = mix(gN, txn(tSnowN, p * .75), snow * (1.0 - rock));
        float fadeN = 1.0 - smoothstep(70.0, 260.0, dist);           // detail fades out with distance so far slopes do not shimmer
        gN.xy *= mix(1.0, 0.55, forest) * fadeN * (1.0 - uWet * 0.35);
        vec3 wn = nn;
        vec3 groundW = normalize(vec3(gN.x + wn.x, abs(gN.z) * wn.y, gN.y + wn.z));
        vec3 nX = txn(tRockN, vWP.zy / 7.5), nY = txn(tRockN, vWP.xz / 7.5), nZ = txn(tRockN, vWP.xy / 7.5);
        nX.xy *= fadeN * 1.25; nY.xy *= fadeN * 1.25; nZ.xy *= fadeN * 1.25;
        nX = vec3(nX.xy + wn.zy, abs(nX.z) * wn.x); nY = vec3(nY.xy + wn.xz, abs(nY.z) * wn.y); nZ = vec3(nZ.xy + wn.xy, abs(nZ.z) * wn.z);
        vec3 rockW = normalize(nX.zyx * blendWeight.x + nY.xzy * blendWeight.y + nZ.xyz * blendWeight.z);
        vec3 worldN = normalize(mix(groundW, rockW, rock * (1.0 - snow * 0.6)));
        normal = normalize((viewMatrix * vec4(worldN, 0.0)).xyz);
      `)
      .replace('#include <roughnessmap_fragment>', 'float roughnessFactor = mix(.94,.86,rock); roughnessFactor = mix(roughnessFactor,.38,wet); roughnessFactor = mix(roughnessFactor,.76,snow*(1.0-rock));')
      .replace('#include <lights_fragment_end>', CLOUD_LIGHT);
  };
  m.customProgramCacheKey = () => 'terrain-realism-v3' + (far ? 'F' : 'N');
  return m;
}
const tGeo = new T.BufferGeometry();
{
  const pos = new Float32Array(TV * TV * 3), uv = new Float32Array(TV * TV * 2), info = new Float32Array(TV * TV * 4);
  for (let j = 0; j < TV; j++) for (let i = 0; i < TV; i++) {
    const k = j * TV + i; const x = -TS / 2 + i * STEP, z = -TS / 2 + j * STEP;
    pos[k * 3] = x; pos[k * 3 + 1] = TH[k]; pos[k * 3 + 2] = z;
    uv[k * 2] = x / 6; uv[k * 2 + 1] = z / 6;
  }
  const idx = [];
  for (let j = 0; j < TN; j++) for (let i = 0; i < TN; i++) {
    const cx = -TS / 2 + (i + 0.5) * STEP, cz = -TS / 2 + (j + 0.5) * STEP;
    if (Math.hypot(cx, cz) > 1205) continue;
    const a = j * TV + i, b = a + 1, c = a + TV, d = c + 1;
    idx.push(a, c, b, b, c, d);
  }
  tGeo.setAttribute('position', new T.BufferAttribute(pos, 3));
  tGeo.setAttribute('uv', new T.BufferAttribute(uv, 2));
  tGeo.setIndex(idx); tGeo.computeVertexNormals();
  const nrm = tGeo.attributes.normal.array;
  for (let k = 0; k < TV * TV; k++) {
    const x = pos[k * 3], z = pos[k * 3 + 2];
    info[k * 4] = 1 - nrm[k * 3 + 1]; info[k * 4 + 1] = TRD[k];
    info[k * 4 + 2] = fbm(x * 0.012 + 3, z * 0.012, 4); info[k * 4 + 3] = fbm(x * 0.05, z * 0.05 + 9, 3) + 0.15;
  }
  tGeo.setAttribute('aInfo', new T.BufferAttribute(info, 4));
  tGeo.computeTangents?.();
}
const terrainMat = terrainMaterial(false);
const terrain = new T.Mesh(tGeo, terrainMat); terrain.receiveShadow = true; scene.add(terrain);
// far mountain ring, same height field, out to the horizon
const farGeo = (() => {
  const AN = 1080, RN = 96, R0 = 1195, R1 = 7000;
  const pos = [], idx = [];
  for (let r = 0; r <= RN; r++) {
    const rr = R0 * Math.pow(R1 / R0, r / RN);
    for (let a = 0; a <= AN; a++) { const ang = a / AN * Math.PI * 2; const x = Math.cos(ang) * rr, z = Math.sin(ang) * rr; pos.push(x, h0(x, z), z); }
  }
  for (let r = 0; r < RN; r++) for (let a = 0; a < AN; a++) { const p = r * (AN + 1) + a, q = p + AN + 1; idx.push(p, p + 1, q, p + 1, q + 1, q); }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  g.setIndex(idx); g.computeVertexNormals();
  const n = g.attributes.normal.array, info = new Float32Array(pos.length / 3 * 4);
  for (let k = 0; k < pos.length / 3; k++) { const x = pos[k * 3], z = pos[k * 3 + 2]; info[k * 4] = 1 - n[k * 3 + 1]; info[k * 4 + 1] = 99; info[k * 4 + 2] = fbm(x * 0.004, z * 0.004, 3); info[k * 4 + 3] = fbm(x * 0.02, z * 0.02, 2); }
  g.setAttribute('aInfo', new T.BufferAttribute(info, 4)); g.setAttribute('uv', new T.Float32BufferAttribute(new Float32Array(pos.length / 3 * 2), 2));
  return g;
})();
const farMesh = new T.Mesh(farGeo, terrainMaterial(true)); scene.add(farMesh);

// road ribbons: asphalt, edge lines and centre line drawn in the shader so they stay sharp up close
function ribbon(R, w, yOff, vScale) {
  const n = R.pts.length, rows = R.closed ? n + 1 : n, COLS = 5;
  const pos = new Float32Array(rows * COLS * 3), uv = new Float32Array(rows * COLS * 2), idx = [];
  let dist = 0;
  for (let r = 0; r < rows; r++) {
    const i = r % n; const f = roadFrame(R, i);
    if (r > 0) dist += R.pts[(r - 1) % n].distanceTo(f.p);
    for (let c = 0; c < COLS; c++) {
      const u = c / (COLS - 1); const s = (u * 2 - 1) * w; const k = r * COLS + c;
      const crown = (1 - Math.pow(u * 2 - 1, 2)) * 0.07;
      pos[k * 3] = f.p.x + f.nx * s; pos[k * 3 + 1] = f.y + yOff + crown; pos[k * 3 + 2] = f.p.z + f.nz * s;
      uv[k * 2] = u; uv[k * 2 + 1] = dist / vScale;
    }
    if (r < rows - 1) for (let c = 0; c < COLS - 1; c++) { const a = r * COLS + c, b = a + 1, d = a + COLS, e = d + 1; idx.push(a, b, d, b, e, d); }
  }
  const g = new T.BufferGeometry(); g.setAttribute('position', new T.BufferAttribute(pos, 3)); g.setAttribute('uv', new T.BufferAttribute(uv, 2));
  g.setIndex(idx); g.computeVertexNormals(); return g;
}
function roadMaterial(kind) {
  const m = new T.MeshStandardMaterial({ roughness: 0.85, metalness: 0, polygonOffset: true, polygonOffsetFactor: kind === 'asp' ? -2 : -1, polygonOffsetUnits: kind === 'asp' ? -2 : -1,
    normalMap: kind === 'asp' ? TX.aspN : TX.dirtN, normalScale: new T.Vector2(kind === 'asp' ? 0.55 : 0.8, kind === 'asp' ? 0.55 : 0.8) });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRU; varying vec3 vWP;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRU = uv; vWP = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    const body = kind === 'asp' ? `
        vec2 ru = vRU; float x = ru.x;
        vec3 col = mix(texture2D(tAsp, vec2(x, ru.y)).rgb, texture2D(tAsp, ru * 0.29 + 0.2).rgb, 0.3) * 1.05;
        float wear = vn(vec2(x * 30.0, ru.y * 6.0)) * 0.6 + vn(vec2(x * 90.0, ru.y * 25.0)) * 0.4;
        float edge = (smoothstep(0.028, 0.034, x) - smoothstep(0.05, 0.056, x)) + (smoothstep(0.944, 0.95, x) - smoothstep(0.966, 0.972, x));
        float dash = step(fract(ru.y * 1.0), 0.42);
        float centre = (smoothstep(0.4925, 0.4955, x) - smoothstep(0.5045, 0.5075, x)) * dash;
        col = mix(col, vec3(0.82, 0.82, 0.79), edge * clamp(1.05 - wear * 0.9, 0.0, 1.0));
        col = mix(col, vec3(0.78, 0.77, 0.72), centre * clamp(0.75 - wear * 0.7, 0.0, 1.0));
        float lanes = exp(-pow((x - 0.25) / 0.06, 2.0)) + exp(-pow((x - 0.75) / 0.06, 2.0));
        col *= 1.0 - 0.06 * lanes;
        float edgeZone = smoothstep(0.78, 1.0, abs(x - 0.5) * 2.0);
        col = mix(col, uDustCol * 0.9, uDry * edgeZone * (0.4 + 0.3 * vn(ru * vec2(10.0, 2.0))));
        float rut = 0.0; for (int k = 0; k < 4; k++) { float c = k == 0 ? 0.185 : k == 1 ? 0.315 : k == 2 ? 0.685 : 0.815; rut += exp(-pow((x - c) / 0.03, 2.0)); }
        vec3 sr = mix(texture2D(tSnowRoad, ru * vec2(1.0, 1.0)).rgb, texture2D(tSnowRoad, ru * 0.37 + 0.5).rgb, 0.35);
        sr = mix(sr, sr * vec3(0.62, 0.64, 0.68), rut * 0.85);
        float bank = smoothstep(0.82, 0.98, abs(x - 0.5) * 2.0);
        sr = mix(sr, texture2D(tSnow, ru * vec2(1.5, 0.8)).rgb * 1.03, bank);
        col = mix(col, sr, uSnow);
        float wet = uWet * (1.0 - uSnow * 0.7);
        float puddle = smoothstep(0.55, 0.8, vn(vWP.xz * 0.35)) * smoothstep(0.2, 0.8, lanes + rut * 0.3) * uPuddle;
        col *= 1.0 - wet * 0.42 - puddle * 0.2;
        diffuseColor.rgb *= col;` : `
        vec2 ru = vRU; float x = ru.x;
        vec3 dirt = mix(texture2D(tDirt, ru * vec2(1.0, 1.0)).rgb, texture2D(tDirt, ru * 0.31 + 0.3).rgb, 0.35);
        vec3 grav = texture2D(tGrav, ru * vec2(1.4, 1.4)).rgb;
        float mid = smoothstep(0.42, 0.5, 1.0 - abs(x - 0.5) * 2.0 + 0.42);
        float rut = exp(-pow((x - 0.28) / 0.07, 2.0)) + exp(-pow((x - 0.72) / 0.07, 2.0));
        vec3 col = mix(dirt, grav, 0.25 + 0.25 * (1.0 - rut));
        col = mix(col * vec3(0.6, 0.55, 0.5), col * vec3(1.05, 1.02, 0.96), uDry);
        col *= 1.0 - rut * 0.16;
        float edge = smoothstep(0.82, 1.0, abs(x - 0.5) * 2.0);
        vec3 grass = mix(texture2D(tGG, vWP.xz / 7.5).rgb, texture2D(tGD, vWP.xz / 7.5).rgb, uDry);
        col = mix(col, grass, edge * 0.7);
        vec3 sn = texture2D(tSnow, ru * vec2(1.0, 0.7)).rgb;
        sn = mix(sn, sn * vec3(0.6, 0.63, 0.68), rut * 0.8);
        col = mix(col, sn, uSnow);
        float wet = uWet * (1.0 - uSnow * 0.7);
        float puddle = rut * smoothstep(0.5, 0.75, vn(vWP.xz * 0.4)) * uPuddle;
        col *= 1.0 - wet * 0.35 - puddle * 0.25;
        diffuseColor.rgb *= col;`;
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vRU; varying vec3 vWP;' + GLSL_COMMON)
      .replace('#include <map_fragment>', body)
      .replace('#include <roughnessmap_fragment>', `float roughnessFactor = roughness; roughnessFactor = mix(roughnessFactor, 0.16, wet); roughnessFactor = mix(roughnessFactor, 0.04, puddle); roughnessFactor = mix(roughnessFactor, 0.55, uSnow);`)
      .replace('#include <lights_fragment_end>', CLOUD_LIGHT);
  };
  m.customProgramCacheKey = () => 'road' + kind;
  return m;
}
const roadMat = roadMaterial('asp');
const road = new T.Mesh(ribbon(ROADS[0], HW_MAIN, 0.0, 12), roadMat); road.receiveShadow = true; scene.add(road);
const trailMat = roadMaterial('dirt');
const trail = new T.Mesh(ribbon(ROADS[1], HW_TRAIL, -0.03, 7), trailMat); trail.receiveShadow = true; scene.add(trail);

// lake
const waterMat = new T.MeshPhysicalMaterial({ color: 0x2a4c56, roughness: 0.05, metalness: 0, normalMap: waterN, normalScale: new T.Vector2(0.25, 0.25), clearcoat: 0.4, clearcoatRoughness: 0.05 });
const lake = new T.Mesh(new T.CircleGeometry(300, 128).rotateX(-Math.PI / 2), waterMat);
lake.position.y = WATER; lake.receiveShadow = true; scene.add(lake);

// ---------------------------------------------------------------- sky, and the environment light made from it
function skyMaterial(oct = 6) {
  return new T.ShaderMaterial({
    defines: { OCT: oct },
    side: T.BackSide, depthWrite: false, fog: false,
    uniforms: { top: { value: C('#6f9ccc') }, hor: { value: C('#c9d6e0') }, sunDir: { value: new T.Vector3(0, 1, 0) }, sunCol: { value: C('#fff') }, cover: { value: 0.3 }, over: { value: 0 }, time: { value: 0 }, grey: { value: C('#999') }, sunVis: { value: 1 }, ground: { value: C('#6b6a58') } },
    vertexShader: 'varying vec3 vD; void main(){ vD = normalize(position); vec4 p = projectionMatrix * modelViewMatrix * vec4(position,1.0); gl_Position = p.xyww; }',
    fragmentShader: `
      uniform vec3 top, hor, sunDir, sunCol, grey, ground; uniform float cover, over, time, sunVis; varying vec3 vD;
      float h(vec2 p){ return fract(sin(dot(p, vec2(127.1,311.7)))*43758.5453); }
      float n(vec2 p){ vec2 i=floor(p), f=fract(p); f=f*f*(3.0-2.0*f); return mix(mix(h(i),h(i+vec2(1,0)),f.x), mix(h(i+vec2(0,1)),h(i+vec2(1,1)),f.x), f.y); }
      float fbm(vec2 p){ float s=0.0,a=0.5; for(int k=0;k<OCT;k++){ s+=a*n(p); p=p*2.03+vec2(1.7,9.2); a*=0.5; } return s; }
      void main(){
        vec3 d = normalize(vD); float y = max(d.y, 0.0);
        vec3 col = mix(hor, top, pow(smoothstep(0.0, 1.0, y), 0.6));
        col = mix(col, grey, over * 0.85);
        float sd = max(dot(d, sunDir), 0.0);
        col += sunCol * (pow(sd, 1600.0) * 60.0 + pow(sd, 60.0) * 0.5 + pow(sd, 6.0) * 0.18) * sunVis;
        if (d.y > 0.0) {
          vec2 uv = d.xz / (d.y + 0.15) * 1.1 + vec2(time * 0.004, time * 0.0015);
          float c = fbm(uv);
          float k = smoothstep(1.0 - cover - 0.02, 1.0 - cover + 0.32, c);
          float body = smoothstep(0.45, 0.95, c);
          vec3 lit = mix(vec3(1.0, 0.98, 0.95), sunCol, 0.35) * (1.0 + pow(sd, 4.0) * 0.6 * sunVis);
          vec3 cc = mix(lit, mix(vec3(0.72, 0.76, 0.82), grey * 0.85, over), body * (0.45 + over * 0.5));
          col = mix(col, cc, k * smoothstep(0.0, 0.18, d.y) * 0.95);
        }
        col = mix(col, hor * (1.0 - over * 0.25) + grey * over * 0.25, smoothstep(0.12, 0.0, d.y));
        if (d.y < 0.0) col = mix(col, ground, smoothstep(0.0, -0.25, d.y));
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
      }`,
  });
}
const skyMat = skyMaterial(software ? 2 : 6);
const sky = new T.Mesh(new T.SphereGeometry(10000, 48, 24), skyMat); sky.frustumCulled = false; sky.renderOrder = -1; scene.add(sky);
const envScene = new T.Scene();
const envSkyMat = skyMaterial(software ? 2 : 6); envSkyMat.side = T.BackSide;
envScene.add(new T.Mesh(new T.SphereGeometry(50, 32, 16), envSkyMat));
const pmrem = new T.PMREMGenerator(renderer);
let envRT = null, envDirty = 1, envTimer = 0;
function rebuildEnv() {
  for (const k of Object.keys(skyMat.uniforms)) { const v = skyMat.uniforms[k].value; if (v && v.copy) envSkyMat.uniforms[k].value.copy(v); else envSkyMat.uniforms[k].value = v; }
  envSkyMat.uniforms.sunVis.value *= 0.25;
  const old=envRT,xrEnabled=renderer.xr.enabled;
  try{renderer.xr.enabled=false;envRT=pmrem.fromScene(envScene,0.02,0.1,200);}finally{renderer.xr.enabled=xrEnabled;}
  scene.environment=envRT.texture;if(old)old.dispose();
}

// ---------------------------------------------------------------- helpers
const merge = (arr) => T.mergeGeometries(arr.map((g) => (g.index ? g.toNonIndexed() : g)), false);
const place = (g, p = [0, 0, 0], r = [0, 0, 0], s = [1, 1, 1]) => g.applyMatrix4(new T.Matrix4().compose(new T.Vector3(...p), new T.Quaternion().setFromEuler(new T.Euler(...r)), new T.Vector3(...s)));
function bumpy(g, amt, freq, seed) {
  const p = g.attributes.position;
  for (let i = 0; i < p.count; i++) {
    const x = p.getX(i), y = p.getY(i), z = p.getZ(i);
    const k = 1 + amt * (vnoise(x * freq + seed, z * freq + y * freq * 0.7) * 0.7 + vnoise(x * freq * 3 + seed, z * freq * 3 - y * freq * 2) * 0.3);
    p.setXYZ(i, x * k, y * (1 + (k - 1) * 0.7), z * k);
  }
  g.computeVertexNormals(); return g;
}
// season-driven scale on a prop material: things settle in instead of popping
function seasonScaled(mat, key) {
  mat.onBeforeCompile = (sh) => {
    sh.uniforms.uK = U[key];
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nuniform float uK;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\ntransformed *= vec3(1.0, uK, 1.0) * smoothstep(0.0, 0.25, uK) + vec3(0.0);');
  };
  mat.customProgramCacheKey = () => 'season-scaled';
  return mat;
}
U.kSnow = { value: 0 }; U.kGreen = { value: 0 }; U.kDust = { value: 1 };

// ---------------------------------------------------------------- billboard trees and grass, lit and shadowed from their own silhouette
const SWAY = { value: 1 };
// near trees are real 3D models; the billboards inside that circle step aside for them
const NEAR3D = { value: new T.Vector3(0, 0, 0) };
const NEAR_ON = [{ value: 0 }, { value: 0 }, { value: 0 }, { value: 0 }];
function billboard(texA, texB, opts) {
  const uni = { tAlt: { value: texB || texA }, tDustT: { value: opts.dustTex || texA }, uDryK: opts.dustTex ? U.uDry : { value: 0 }, uAltK: opts.altK || { value: 0 }, uTint: opts.tint || { value: new T.Vector3(1, 1, 1) }, uHide: opts.hide || { value: 0 }, uSnowCover: opts.snowCover || { value: 0 },
    uSway: SWAY, uSwayAmt: { value: opts.sway ?? 0.02 }, uBT: U.uTime, uNear: NEAR3D, uNearOn: opts.nearOn || { value: 0 }, uCloudSh: U.uCloudSh, uCloudCov: U.uCloudCov, uCloudOff: U.uCloudOff };
  const vert = (withNormal) => (sh) => {
    Object.assign(sh.uniforms, uni);
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uHide, uSway, uSwayAmt, uBT, uNearOn; uniform vec3 uNear; varying float vSeed; varying float vH; varying float vCS;' + CLOUD_GLSL)
      .replace('#include <project_vertex>', `
        vec3 bbC = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        float bbS = length(instanceMatrix[1].xyz);
        vSeed = fract(sin(dot(bbC.xz, vec2(12.9898, 78.233))) * 43758.5453);
        bbS *= 1.0 - step(vSeed, uHide);
        bbS *= 1.0 - uNearOn * step(distance(bbC.xz, uNear.xy), uNear.z);
        vec3 camR = vec3(viewMatrix[0][0], viewMatrix[1][0], viewMatrix[2][0]); camR.y = 0.0; camR = normalize(camR);
        vec3 toCam = vec3(viewMatrix[0][2], viewMatrix[1][2], viewMatrix[2][2]); toCam.y = 0.0; toCam = normalize(toCam);
        vec3 bbW = bbC + camR * position.x * bbS + vec3(0.0, position.y * bbS, 0.0) + toCam * position.z * bbS;
        float swy = position.y * position.y * uSway * uSwayAmt * bbS;
        bbW.xz += vec2(sin(uBT * 0.9 + vSeed * 31.0) + 0.45 * sin(uBT * 2.3 + vSeed * 17.0), cos(uBT * 0.7 + vSeed * 23.0) * 0.6) * swy;
        vH = position.y; vCS = cloudSh(bbC.xz);
        vec4 mvPosition = viewMatrix * vec4(bbW, 1.0);
        gl_Position = projectionMatrix * mvPosition;
        ${withNormal ? 'vec3 nW = normalize(toCam * 0.75 + camR * position.x * 0.9 + vec3(0.0, 0.55, 0.0)); vNormal = normalize((viewMatrix * vec4(nW, 0.0)).xyz);' : ''}
      `).replace('#include <worldpos_vertex>', 'vec4 worldPosition = vec4(bbW, 1.0);');
  };
  const m = new T.MeshStandardMaterial({ map: texA, alphaTest: 0.42, roughness: 0.92, metalness: 0, side: T.DoubleSide });
  m.alphaToCoverage = true;
  m.onBeforeCompile = (sh) => {
    vert(true)(sh);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D tAlt, tDustT; uniform float uAltK, uSnowCover, uDryK; varying float vCS; uniform vec3 uTint; varying float vSeed; varying float vH;')
      .replace('#include <map_fragment>', `
        vec4 sA = mix(texture2D(map, vMapUv), texture2D(tDustT, vMapUv), uDryK); vec4 sB = texture2D(tAlt, vMapUv);
        vec4 sc = mix(sA, sB, uAltK);
        sc.rgb *= uTint * (0.88 + 0.24 * vSeed);
        float lum = dot(sc.rgb, vec3(0.3, 0.59, 0.11));
        sc.rgb = mix(sc.rgb, vec3(0.9, 0.93, 0.97), uSnowCover * smoothstep(0.06, 0.3, lum) * 0.75);
        diffuseColor *= sc;`)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= vCS; reflectedLight.directSpecular *= vCS;');
  };
  const d = new T.MeshDepthMaterial({ depthPacking: T.RGBADepthPacking, map: texA, alphaTest: 0.42, side: T.DoubleSide });
  d.onBeforeCompile = (sh) => vert(false)(sh);
  return { m, d };
}
function cardGeo(aspect, h) { // a vertical card standing on y = 0
  const g = new T.PlaneGeometry(aspect, 1, 1, 1); g.translate(0, 0.5, 0);
  return g;
}
const TREE_HIDE = { value: 0 };
const TREE_TINT = { value: new T.Vector3(1, 1, 1) }, BIRCH_TINT = { value: new T.Vector3(1, 1, 1) };
const pineBB = billboard(TX.pine, TX.pineSnow, { hide: TREE_HIDE, altK: U.uSnow, tint: TREE_TINT, nearOn: NEAR_ON[0] });
const pine2BB = billboard(TX.pine2, TX.firSnow, { hide: TREE_HIDE, altK: U.uSnow, tint: TREE_TINT, nearOn: NEAR_ON[1] });
const spruceBB = billboard(TX.spruce, TX.spruceSnow, { hide: TREE_HIDE, altK: U.uSnow, tint: TREE_TINT, dustTex: TX.spruceDust, sway: 0.016, nearOn: NEAR_ON[2] });
const birchBB = billboard(TX.birch, TX.birchSnow, { hide: TREE_HIDE, altK: U.uSnow, tint: BIRCH_TINT, dustTex: TX.birchDust, sway: 0.035, nearOn: NEAR_ON[3] });

const GRASS_TINT = { value: new T.Vector3(1, 1, 1) }, GRASS_HIDE = { value: 0 };
const grassBB = billboard(TX.grass, null, { tint: GRASS_TINT, hide: GRASS_HIDE, sway: 0.09 });
grassBB.m.alphaTest = 0.5;

const trees = [];
const treeHash = new Map();
const CHUNK = 300;
const chunks = new Map();
function buildTrees(count) {
  const r = rng(42);
  let tries = 0;
  while (trees.length < count && tries < count * 25) {
    tries++;
    const a = r() * Math.PI * 2, rad = 215 + Math.pow(r(), 0.75) * 870;
    const x = Math.cos(a) * rad, z = Math.sin(a) * rad;
    if (Math.abs(x) > 1180 || Math.abs(z) > 1180) continue;
    const q = nearestRoad(x, z, q2); if (q.road >= 0 && q.d < q.hw + 4 + r() * 6) continue;
    const y = terrainH(x, z); if (y < WATER + 1.2 || y > 230) continue;
    const dens = fbm(x * 0.0055 + 20, z * 0.0055, 3) + smooth(440, 720, rad) * 0.45 - smooth(160, 260, y) * 0.5;
    if (dens < 0.04 + r() * 0.16) continue;
    // birch on the low meadows and river flats, tall spruce on the slopes, pines everywhere
    const low = 1 - smooth(WATER + 8, WATER + 60, y), hi = smooth(30, 120, y);
    const rk = r(), pb = 0.42 * low * (0.6 + 0.8 * fbm(x * 0.012 - 9, z * 0.012 + 4, 2)), ps = 0.18 + 0.3 * hi;
    const kind = rk < pb ? 3 : rk < pb + ps ? 2 : rk < pb + ps + 0.2 ? 1 : 0;
    const t = { x, y, z, h: 12 + Math.pow(r(), 1.3) * 16, kind, v: r() };
    if (kind === 1) t.h *= 0.62; else if (kind === 2) t.h *= 1.25; else if (kind === 3) t.h = 10 + r() * 9;
    trees.push(t);
    const k = hkey(Math.floor(x / 16), Math.floor(z / 16)); let l = treeHash.get(k); if (!l) treeHash.set(k, l = []); l.push(t);
    const ck = hkey(Math.floor(x / CHUNK), Math.floor(z / CHUNK)); let c = chunks.get(ck); if (!c) chunks.set(ck, c = { list: [] }); c.list.push(t);
  }
  const GEO = [cardGeo(218 / 512), cardGeo(343 / 512), cardGeo(352 / 1024), cardGeo(518 / 768)], BBS = [pineBB, pine2BB, spruceBB, birchBB];
  const m = new T.Matrix4(), q = new T.Quaternion(), s = new T.Vector3(), p = new T.Vector3();
  for (const c of chunks.values()) {
    c.meshes = [];
    for (const kind of [0, 1, 2, 3]) {
      const list = c.list.filter((t) => t.kind === kind); if (!list.length) continue;
      const bb = BBS[kind];
      const im = new T.InstancedMesh(GEO[kind], bb.m, list.length);
      im.customDepthMaterial = bb.d;
      list.forEach((t, i) => { s.setScalar(t.h); p.set(t.x, t.y - 0.3, t.z); m.compose(p, q, s); im.setMatrixAt(i, m); im.setColorAt(i, _c.setHSL(0.25 + (t.v - 0.5) * 0.05, 0.12, 0.42 + t.v * 0.12).multiplyScalar(2.1)); });
      im.castShadow = true; im.receiveShadow = true;
      im.computeBoundingSphere(); im.boundingSphere.radius += 25;
      scene.add(im); c.meshes.push(im);
    }
    c.cx = c.list.reduce((a, t) => a + t.x, 0) / c.list.length; c.cz = c.list.reduce((a, t) => a + t.z, 0) / c.list.length;
    c.inRange = null;
  }
}
const _c = new T.Color(), _c2 = new T.Color(), _c3 = new T.Color();
function updateTreeRange() {
  const view=cameraWorldPosition();const cx = view.x, cz = view.z, lim = P.drawDist + CHUNK * 0.75;
  for (const c of chunks.values()) {
    const inR = Math.hypot(c.cx - cx, c.cz - cz) < lim;
    if (inR === c.inRange) continue; c.inRange = inR;
    for (const im of c.meshes) im.visible = inR;
  }
}
// ---------------------------------------------------------------- 3D trees near the camera
// The forest close to the road is made of real modelled trees, lit and shadowed for real, that move in the wind and
// carry snow on their upper faces. Past the circle the billboards take over. The circle is the 3D tree distance setting.
const TREE3D_FILES = { spruce: 'assets/trees/sketchfab/pine-forest-lod2.glb', pine: 'assets/trees/sketchfab/pine-forest-lod2.glb' };
const TREE3D_PREFIX = {spruce:'Pine_large_1_LOD2_',pine:'Pine_big_2_LOD2_'};
const KIND3D = ['spruce', 'pine', 'spruce', null]; // birch stays a billboard: its airy crown reads better as a photograph
const KIND3D_W = [1.3, 1.0, 1.0, 1.0]; // width multiplier per billboard kind
const near3d = { models: {}, meshes: [null, null, null, null], x: 1e9, z: 1e9, sig: '', ready: false };
function tree3dMaterial(src, leafy) {
  const m = new T.MeshStandardMaterial({ map: src.map || null, normalMap:src.normalMap||null, roughnessMap:src.roughnessMap||null, aoMap:src.aoMap||null, aoMapIntensity:.75, color: src.color || 0xffffff, roughness: 0.94, metalness: 0, side: T.DoubleSide, alphaTest: src.alphaTest || 0, transparent:false });
  m.normalScale.setScalar(.65); if(m.alphaTest) m.shadowSide=T.DoubleSide;
  if (m.map) { m.map.anisotropy = MAXANI; m.map.colorSpace = T.SRGBColorSpace; }
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, { uSway: SWAY, uBT: U.uTime, uTint: leafy ? BIRCH_TINT : TREE_TINT, uSnowK: U.uSnow, uDryK: U.uDry, uWetK: U.uWet, uCloudSh: U.uCloudSh, uCloudCov: U.uCloudCov, uCloudOff: U.uCloudOff });
    sh.vertexShader = sh.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uSway, uBT; varying float vSeed; varying float vUpN; varying float vCS; varying float vHt;' + CLOUD_GLSL)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        vec3 tC = (modelMatrix * instanceMatrix * vec4(0.0, 0.0, 0.0, 1.0)).xyz;
        vSeed = fract(sin(dot(tC.xz, vec2(12.9898, 78.233))) * 43758.5453);
        vUpN = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal).y;
        vHt = transformed.y; vCS = cloudSh(tC.xz);
        float swy = transformed.y * transformed.y * uSway * ${leafy ? '0.035' : '0.018'};
        transformed.xz += vec2(sin(uBT * 0.9 + vSeed * 31.0) + 0.45 * sin(uBT * 2.3 + vSeed * 17.0), cos(uBT * 0.7 + vSeed * 23.0) * 0.6) * swy;`);
    sh.fragmentShader = sh.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform vec3 uTint; uniform float uSnowK, uDryK, uWetK; varying float vSeed; varying float vUpN; varying float vCS; varying float vHt;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 tc = diffuseColor.rgb;
        float leaf = smoothstep(0.0, 0.06, tc.g - max(tc.r, tc.b) * 0.92);
        ${leafy ? 'tc = mix(tc, vec3(dot(tc, vec3(0.5, 0.4, 0.1))) * vec3(1.35, 1.08, 0.45), leaf * uDryK * 0.75);' : 'tc = mix(tc, tc * vec3(1.06, 1.0, 0.82), leaf * uDryK * 0.6);'}
        tc *= uTint * (0.86 + 0.26 * vSeed) * (0.8 + 0.2 * smoothstep(0.0, 0.45, vHt));
        float sk = uSnowK * smoothstep(-0.05, 0.55, vUpN + (vSeed - 0.5) * 0.25) * smoothstep(0.04, 0.2, vHt);
        tc = mix(tc, vec3(0.9, 0.93, 0.98), sk * 0.88);
        tc *= 1.0 - uWetK * 0.12;
        diffuseColor.rgb = tc;`)
      .replace('#include <lights_fragment_end>', '#include <lights_fragment_end>\nreflectedLight.directDiffuse *= vCS; reflectedLight.directSpecular *= vCS;');
  };
  m.customProgramCacheKey = () => 'tree3d' + (leafy ? 'L' : 'C') + (src.alphaTest ? 'A' : '');
  return m;
}
async function loadTrees3D() {
  const gl=new T.GLTFLoader(),requests=new Map();
  await Promise.all(Object.entries(TREE3D_FILES).map(async([name,url])=>{
    try {
      if(!requests.has(url))requests.set(url,gl.loadAsync(url));
      const g=await requests.get(url);g.scene.updateMatrixWorld(true);
      const parts=[];const bounds=new T.Box3();
      g.scene.traverse(o=>{if(!o.isMesh||!o.name.startsWith(TREE3D_PREFIX[name]))return;
        const geometry=o.geometry.clone().applyMatrix4(o.matrixWorld);geometry.computeBoundingBox();bounds.union(geometry.boundingBox);parts.push({geometry,material:o.material});});
      if(!parts.length)throw new Error('No matching tree meshes');
      const center=bounds.getCenter(new T.Vector3()),scale=1/(bounds.max.y-bounds.min.y),geometries=[],materials=[];
      for(const part of parts){let geo=part.geometry;geo.translate(-center.x,-bounds.min.y,-center.z);geo.scale(scale,scale,scale);if(geo.index)geo=geo.toNonIndexed();for(const attribute of Object.keys(geo.attributes))if(!['position','normal','uv'].includes(attribute))geo.deleteAttribute(attribute);geometries.push(geo);materials.push(tree3dMaterial(part.material,false));}
      const geo=T.mergeGeometries(geometries,true);if(!geo)throw new Error('Tree geometry merge failed');geo.computeBoundingSphere();
      near3d.models[name]={geo,mat:materials,w:Math.max(bounds.max.x-bounds.min.x,bounds.max.z-bounds.min.z)*scale};
    }catch(error){console.warn('Sketchfab tree unavailable; keeping existing billboard forest.',name,error.message);}
  }));
  for(let k=0;k<4;k++){const md=KIND3D[k]&&(near3d.models[KIND3D[k]]||near3d.models.spruce);if(!md)continue;const im=new T.InstancedMesh(md.geo,md.mat,900);im.count=0;im.frustumCulled=false;im.castShadow=im.receiveShadow=true;im.userData.w=md.w;scene.add(im);near3d.meshes[k]=im;}
  near3d.ready=true;near3d.sig='';window.GOALocations?.addForest?.();
}
const n3m = new T.Matrix4(), n3q = new T.Quaternion(), n3s = new T.Vector3(), n3p = new T.Vector3(), n3y = new T.Vector3(0, 1, 0);
const n3cand = [];
function updateNear3D() {
  if (!near3d.ready) return;
  const R = P.tree3d ? P.tree3dDist : 0;
  const birchOK = SV.snow < 0.5; // bare winter birch stays a billboard
  const sig = `${R}|${P.trees}|${birchOK}`;
  const view=cameraWorldPosition();const cx = view.x, cz = view.z;
  if (sig === near3d.sig && Math.hypot(cx - near3d.x, cz - near3d.z) < 5) return;
  near3d.sig = sig; near3d.x = cx; near3d.z = cz;
  for (let k = 0; k < 4; k++) NEAR_ON[k].value = R > 0 && near3d.meshes[k] && (k !== 3 || birchOK) ? 1 : 0;
  if (R <= 0) { for (const im of near3d.meshes) if (im) im.count = 0; NEAR3D.value.set(cx, cz, 0); return; }
  n3cand.length = 0;
  const i0 = Math.floor((cx - R) / 16), i1 = Math.floor((cx + R) / 16), j0 = Math.floor((cz - R) / 16), j1 = Math.floor((cz + R) / 16);
  const keepAbove = 1 - P.trees;
  for (let i = i0; i <= i1; i++) for (let j = j0; j <= j1; j++) {
    const l = treeHash.get(hkey(i, j)); if (!l) continue;
    for (const t of l) {
      if (!NEAR_ON[t.kind].value) continue;
      const d = Math.hypot(t.x - cx, t.z - cz); if (d >= R) continue;
      if (((t.v * 7919.13) % 1) < keepAbove) continue;
      n3cand.push(d, t);
    }
  }
  // nearest first, up to the cap; the circle shrinks to the last one kept so nothing goes missing at the seam
  const idx = []; for (let k = 0; k < n3cand.length; k += 2) idx.push(k);
  idx.sort((a, b) => n3cand[a] - n3cand[b]);
  const cap = Math.round(Math.min(260, R * 2.0));
  let rad = R; if (idx.length > cap) { rad = n3cand[idx[cap]]; idx.length = cap; }
  const cnt = [0, 0, 0, 0];
  for (const k of idx) {
    const t = n3cand[k + 1]; const im = near3d.meshes[t.kind]; if (!im || cnt[t.kind] >= 900) continue;
    const wk = KIND3D_W[t.kind] * (0.85 + ((t.v * 31.7) % 1) * 0.3);
    n3q.setFromAxisAngle(n3y, t.v * 6.283 * 13.0); n3s.set(t.h * wk, t.h, t.h * wk); n3p.set(t.x, t.y - 0.3, t.z);
    n3m.compose(n3p, n3q, n3s); im.setMatrixAt(cnt[t.kind]++, n3m);
  }
  for (let k = 0; k < 4; k++) { const im = near3d.meshes[k]; if (!im) continue; im.count = cnt[k]; im.instanceMatrix.needsUpdate = true; }
  NEAR3D.value.set(cx, cz, rad);
}
// grass clumps that follow the car
const GRASS_TILE = 120;
let grass = null, grassMax = 0, grassBase = null, grassCenter = { x: 1e9, z: 1e9 };
function buildGrass(n) {
  if (!n) return;
  grassMax = n; grass = new T.InstancedMesh(cardGeo(546 / 512), grassBB.m, n); grass.frustumCulled = false;
  const r = rng(77); grassBase = new Float32Array(n * 4);
  for (let i = 0; i < n; i++) { grassBase[i * 4] = r() * GRASS_TILE; grassBase[i * 4 + 1] = r() * GRASS_TILE; grassBase[i * 4 + 2] = 0.45 + r() * 0.6; grassBase[i * 4 + 3] = r(); }
  for (let i = 0; i < n; i++) grass.setColorAt(i, _c.setScalar(0.85 + grassBase[i * 4 + 3] * 0.3));
  scene.add(grass);
}
const gm = new T.Matrix4(), gq = new T.Quaternion(), gs = new T.Vector3(), gp = new T.Vector3();
function updateGrass(cx, cz, force) {
  if (!grass) return;
  const sx = Math.round(cx / 8) * 8, sz = Math.round(cz / 8) * 8;
  if (!force && sx === grassCenter.x && sz === grassCenter.z) return;
  grassCenter.x = sx; grassCenter.z = sz;
  const n = grass.count;
  for (let i = 0; i < n; i++) {
    let x = grassBase[i * 4], z = grassBase[i * 4 + 1];
    x = sx + ((((x - sx) % GRASS_TILE) + GRASS_TILE) % GRASS_TILE) - GRASS_TILE / 2;
    z = sz + ((((z - sz) % GRASS_TILE) + GRASS_TILE) % GRASS_TILE) - GRASS_TILE / 2;
    let sc = grassBase[i * 4 + 2];
    const fx = (x + TS / 2) / STEP, fz = (z + TS / 2) / STEP;
    const k = clamp(Math.round(fz), 0, TN) * TV + clamp(Math.round(fx), 0, TN);
    const y = terrainH(x, z);
    const clump = fbm(x * 0.045 + 3.1, z * 0.045 - 7.7, 3) + (grassBase[i * 4 + 3] - 0.5) * 0.5;
    if (clump < -0.08) sc = 0; else sc *= 0.55 + Math.min(0.9, clump + 0.3);
    if (TRD[k] < 1.2 || y < WATER + 0.8 || y > 200) sc = 0;
    else { const rr = nearestRoad(x, z, q2); if (rr.road >= 0 && rr.d < rr.hw + 0.6) sc = 0; }
    gs.setScalar(sc); gp.set(x, y - 0.05, z);
    gm.compose(gp, gq, gs); grass.setMatrixAt(i, gm);
  }
  grass.instanceMatrix.needsUpdate = true;
}

// ---------------------------------------------------------------- roadside: rocks, guardrails, posts, signs, banners, season props
function scatterInst(geo, mat, n, rule, seed, cast = true) {
  const r = rng(seed); const im = new T.InstancedMesh(geo, mat, n);
  const m = new T.Matrix4(); let k = 0, tries = 0; const cols = [];
  while (k < n && tries < n * 60) {
    tries++; const res = rule(r, k); if (!res) continue;
    m.compose(new T.Vector3(res.x, res.y, res.z), new T.Quaternion().setFromEuler(new T.Euler(res.rx || 0, res.ry || 0, res.rz || 0)), new T.Vector3(...(res.s || [1, 1, 1])));
    im.setMatrixAt(k, m); if (res.c) cols.push(res.c); k++;
  }
  im.count = k;
  if (cols.length) cols.forEach((c, i) => im.setColorAt(i, c));
  im.castShadow = cast; im.receiveShadow = true; im.computeBoundingSphere(); scene.add(im); return im;
}
function roadside(r, minOff, maxOff, roadId = -1) {
  const R = roadId >= 0 ? ROADS[roadId] : (r() < 0.75 ? ROADS[0] : ROADS[1]);
  const i = Math.floor(r() * R.pts.length); const f = roadFrame(R, i);
  const side = r() < 0.5 ? -1 : 1; const off = R.hw + minOff + r() * (maxOff - minOff);
  const x = f.p.x + f.nx * off * side, z = f.p.z + f.nz * off * side;
  return { x, z, y: terrainH(x, z), ang: Math.atan2(f.tx, f.tz), i, R, side, f };
}
function rockMaterial() {
  const m = new T.MeshStandardMaterial({ map: TX.rock, roughness: 0.92, metalness: 0 });
  m.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying float vUp;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvUp = normalize(mat3(modelMatrix * instanceMatrix) * objectNormal).y;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vUp;' + GLSL_COMMON)
      .replace('#include <map_fragment>', '#include <map_fragment>\n diffuseColor.rgb = mix(diffuseColor.rgb, texture2D(tSnow, vMapUv * 2.0).rgb, uSnow * smoothstep(0.35, 0.7, vUp)); diffuseColor.rgb *= 1.0 - uWet * 0.3;');
  };
  return m;
}
const SIGN_DRAW = (lines) => (g, w, h) => {
  g.fillStyle = '#6b4a2e'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 400; i++) { g.fillStyle = `rgba(${40 + Math.random() * 40},${25 + Math.random() * 20},10,${Math.random() * 0.25})`; g.fillRect(0, Math.random() * h, w, 1 + Math.random() * 2); }
  const bh = h / lines.length;
  lines.forEach((t, i) => {
    g.fillStyle = 'rgba(0,0,0,.35)'; g.fillRect(0, i * bh + bh - 3, w, 3);
    g.fillStyle = '#f0e8d8'; g.font = `600 ${Math.round(bh * 0.52)}px Valley, "Arial Narrow", sans-serif`; g.textBaseline = 'middle'; g.fillText(t, 22, i * bh + bh / 2);
    g.beginPath(); g.moveTo(w - 70, i * bh + bh / 2); g.lineTo(w - 30, i * bh + bh / 2); g.moveTo(w - 44, i * bh + bh / 2 - 12); g.lineTo(w - 30, i * bh + bh / 2); g.lineTo(w - 44, i * bh + bh / 2 + 12);
    g.strokeStyle = '#f0e8d8'; g.lineWidth = 5; g.stroke();
  });
};
const props = { green: [], dust: [], snow: [] };
function buildProps() {
  // boulders and scree
  const rockGeo = bumpy(new T.IcosahedronGeometry(1, 4), 0.32, 0.9, 5);
  scatterInst(rockGeo, rockMaterial(), 520, (r) => {
    const near = r() < 0.6;
    let x, z, y;
    if (near) { const p = roadside(r, 1.8, 26); x = p.x; z = p.z; y = p.y; }
    else { const a = r() * 6.283, rad = 450 + r() * 600; x = Math.cos(a) * rad; z = Math.sin(a) * rad; if (Math.abs(x) > 1150 || Math.abs(z) > 1150) return null; y = terrainH(x, z); }
    const q = nearestRoad(x, z, q2); if (q.road >= 0 && q.d < q.hw + 1.2) return null;
    if (y < WATER + 0.5) return null;
    const s = 0.4 + Math.pow(r(), 2.5) * 2.6;
    return { x, y: y - s * 0.3, z, rx: r() * 3, ry: r() * 6, s: [s * (0.9 + r() * 0.5), s * (0.55 + r() * 0.4), s * (0.9 + r() * 0.5)] };
  }, 21);
  // guardrails where the ground falls away beside the road
  const steel = new T.MeshStandardMaterial({ color: 0xb4b8bb, metalness: 0.85, roughness: 0.42 });
  const beamGeo = merge([place(new T.BoxGeometry(0.06, 0.32, 4.05), [0, 0.62, 0]), place(new T.BoxGeometry(0.1, 0.06, 4.05), [0.03, 0.7, 0]), place(new T.BoxGeometry(0.1, 0.06, 4.05), [0.03, 0.54, 0])]);
  const postGeo = place(new T.BoxGeometry(0.1, 0.8, 0.1), [0.06, 0.4, 0]);
  const rails = [];
  for (const R of ROADS) {
    for (let i = 0; i < R.pts.length; i += 2) {
      const f = roadFrame(R, i);
      for (const side of [-1, 1]) {
        const off = R.hw + 0.9; const ox = f.p.x + f.nx * (off + 6) * side, oz = f.p.z + f.nz * (off + 6) * side;
        if (terrainH(ox, oz) < f.y - 2.2) rails.push({ x: f.p.x + f.nx * off * side, z: f.p.z + f.nz * off * side, y: f.y - 0.06, ang: Math.atan2(f.tx, f.tz), side });
      }
    }
  }
  const nR = Math.min(rails.length, 2500);
  scatterInst(beamGeo, steel, nR, (r, k) => { const g = rails[k]; return g && { x: g.x, y: g.y, z: g.z, ry: g.ang + (g.side > 0 ? Math.PI : 0) }; }, 22);
  scatterInst(postGeo, steel, nR, (r, k) => { const g = rails[k]; return g && { x: g.x, y: g.y, z: g.z, ry: g.ang + (g.side > 0 ? Math.PI : 0) }; }, 23);
  // white roadside posts with the black band and red reflector, and kilometre posts
  const postW = new T.BufferGeometry();
  {
    const parts = [place(new T.CylinderGeometry(0.07, 0.08, 1.05, 8), [0, 0.52, 0])];
    const g = merge(parts); const p = g.attributes.position; const col = new Float32Array(p.count * 3);
    for (let i = 0; i < p.count; i++) { const y = p.getY(i); const band = y > 0.75 && y < 0.95; col.set(band ? [0.06, 0.06, 0.06] : [0.92, 0.92, 0.9], i * 3); if (band && p.getZ(i) > 0.05) col.set([0.6, 0.05, 0.04], i * 3); }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); postW.copy(g);
  }
  scatterInst(postW, new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.45 }), 520, (() => { let k = 0; return () => {
    const R = ROADS[0]; const n = R.pts.length; const i = Math.floor((k >> 1) * 12) % n; const side = k & 1 ? 1 : -1; k++;
    const f = roadFrame(R, i); const off = R.hw + 1.1;
    return { x: f.p.x + f.nx * off * side, y: f.y - 0.06, z: f.p.z + f.nz * off * side, ry: Math.atan2(f.tx, f.tz) + (side > 0 ? Math.PI : 0) };
  }; })(), 24);
  // signposts at both trail junctions
  const signMat = new T.MeshStandardMaterial({ map: canvasTex(512, 384, SIGN_DRAW(['Ridge Track', 'Pine Valley', 'Summit 12 km']), true, false), roughness: 0.85 });
  const wood = new T.MeshStandardMaterial({ color: 0x4a3524, roughness: 0.9 });
  for (const [j, R] of [[j1, ROADS[0]], [j2, ROADS[0]]]) {
    const f = roadFrame(R, (j + 10) % NM); const side = -1;
    const g = new T.Group(); g.position.set(f.p.x + f.nx * (HW_MAIN + 3) * side, terrainH(f.p.x + f.nx * (HW_MAIN + 3) * side, f.p.z + f.nz * (HW_MAIN + 3) * side), f.p.z + f.nz * (HW_MAIN + 3) * side);
    g.rotation.y = Math.atan2(f.tx, f.tz) + Math.PI / 2;
    const post = new T.Mesh(new T.BoxGeometry(0.16, 2.8, 0.16), wood); post.position.y = 1.4; post.castShadow = true; g.add(post);
    const board = new T.Mesh(new T.BoxGeometry(1.7, 1.25, 0.05), [wood, wood, wood, wood, signMat, signMat]); board.position.set(0.6, 2.05, 0.1); board.castShadow = true; g.add(board);
    scene.add(g);
  }
  // checkpoint banners: orange and white, beside the road; the start line gets an arch
  const bannerTex = (label) => canvasTex(512, 96, (g, w, h) => {
    for (let x = 0; x < w; x += 48) { g.fillStyle = (x / 48) % 2 ? '#f2eee6' : '#e8742a'; g.fillRect(x, 0, 48, h); }
    g.fillStyle = 'rgba(242,238,230,.96)'; g.fillRect(w * 0.25, 10, w * 0.5, h - 20);
    g.fillStyle = '#1e2226'; g.font = `700 ${Math.round(h * 0.46)}px Valley, "Arial Narrow", sans-serif`; g.textAlign = 'center'; g.textBaseline = 'middle'; g.fillText(label, w / 2, h / 2 + 2);
  }, true, false);
  const poleMat = new T.MeshStandardMaterial({ color: 0xdedad2, roughness: 0.6 });
  [[0.25, 'CHECKPOINT 1'], [0.5, 'CHECKPOINT 2'], [0.75, 'CHECKPOINT 3']].forEach(([frac, label]) => {
    const f = roadFrame(ROADS[0], Math.floor(NM * frac));
    const bm = new T.MeshStandardMaterial({ map: bannerTex(label), roughness: 0.8, side: T.DoubleSide });
    for (const side of [-1, 1]) {
      const g = new T.Group(); const off = HW_MAIN + 2.2;
      g.position.set(f.p.x + f.nx * off * side, f.y, f.p.z + f.nz * off * side); g.rotation.y = Math.atan2(f.tx, f.tz) + Math.PI / 2 + (side > 0 ? 0.35 : -0.35);
      for (const px of [-1.6, 1.6]) { const pl = new T.Mesh(new T.CylinderGeometry(0.05, 0.05, 2.2, 8), poleMat); pl.position.set(px, 1.1, 0); g.add(pl); }
      const b = new T.Mesh(new T.PlaneGeometry(3.3, 0.62), bm); b.position.y = 1.75; b.castShadow = true; g.add(b);
      scene.add(g);
    }
  });
  {
    const f = roadFrame(ROADS[0], 0); const g = new T.Group(); g.position.set(f.p.x, f.y, f.p.z); g.rotation.y = Math.atan2(f.tx, f.tz) + Math.PI / 2;
    const bm = new T.MeshStandardMaterial({ map: bannerTex('START  FINISH'), roughness: 0.8, side: T.DoubleSide });
    for (const px of [-(HW_MAIN + 1), HW_MAIN + 1]) { const pl = new T.Mesh(new T.CylinderGeometry(0.12, 0.14, 5.4, 10), poleMat); pl.position.set(0, 2.7, px); pl.castShadow = true; g.add(pl); }
    const b = new T.Mesh(new T.PlaneGeometry(2 * HW_MAIN + 2.4, 1.1), bm); b.rotation.y = Math.PI / 2; b.position.y = 4.9; b.castShadow = true; g.add(b);
    scene.add(g);
  }
  // season props that grow in and melt away
  const snowMat = seasonScaled(new T.MeshStandardMaterial({ map: TX.snow, roughness: 0.75 }), 'kSnow');
  const bankGeo = bumpy(new T.SphereGeometry(1, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), 0.18, 1.1, 3);
  props.snow.push(scatterInst(bankGeo, snowMat, 1400, (r) => {
    const R = r() < 0.8 ? ROADS[0] : ROADS[1]; const i = Math.floor(r() * R.pts.length); const f = roadFrame(R, i);
    const side = r() < 0.5 ? -1 : 1; const off = R.hw + 0.9 + r() * 1.0; const x = f.p.x + f.nx * off * side, z = f.p.z + f.nz * off * side;
    return { x, y: Math.max(terrainH(x, z), f.y - 0.2) - 0.08, z, ry: Math.atan2(f.tx, f.tz), s: [0.9 + r() * 0.7, 0.35 + r() * 0.35, 2.4 + r() * 2.2] };
  }, 16));
  const flowerGeo = merge([place(new T.IcosahedronGeometry(0.07, 0), [0, 0.3, 0]), place(new T.CylinderGeometry(0.01, 0.01, 0.3, 3), [0, 0.15, 0])]);
  const fcols = ['#f2d24a', '#ffffff', '#c77bd6', '#e86a8a', '#7aa0e8'];
  props.green.push(scatterInst(flowerGeo, seasonScaled(new T.MeshStandardMaterial({ roughness: 0.7 }), 'kGreen'), 7000, (r) => {
    const p = roadside(r, 1.5, 70); if (fbm(p.x * 0.03, p.z * 0.03, 2) < 0.08) return null; if (p.y > 150) return null;
    return { x: p.x, y: p.y, z: p.z, ry: r() * 6, s: [1, 0.7 + r() * 0.8, 1], c: C(fcols[Math.floor(r() * 5)]) };
  }, 11, false));
  const baleGeo = new T.CylinderGeometry(0.75, 0.75, 1.3, 20).rotateZ(Math.PI / 2);
  props.dust.push(scatterInst(baleGeo, seasonScaled(new T.MeshStandardMaterial({ color: 0xd9bf7a, roughness: 1, map: TX.gD }), 'kDust'), 70, (r) => {
    const p = roadside(r, 14, 60, 0); if (p.y > 60) return null; return { x: p.x, y: p.y + 0.7, z: p.z, ry: r() * 6 };
  }, 12));
}

// ---------------------------------------------------------------- the car
const car = new T.Group(); scene.add(car);
const body = new T.Group(); car.add(body);
const carU = { uDirt: { value: 0 }, uDirtCol: { value: C('#8a7556') }, uCarH: { value: 1.5 } };
let wheels = [], veh = VEHICLES.rally, vehModel = null, loadingVeh = null;
const vehCache = {};
const WR_DEF = 0.34;
function dirtify(mat) {
  mat.onBeforeCompile = (sh) => {
    Object.assign(sh.uniforms, carU);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vLoc;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvLoc = (modelMatrix * vec4(transformed, 1.0)).xyz - (modelMatrix * vec4(0.0,0.0,0.0,1.0)).xyz;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nuniform float uDirt, uCarH; uniform vec3 uDirtCol; varying vec3 vLoc;\nfloat dh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }')
      .replace('#include <map_fragment>', `#include <map_fragment>
        float carY = vLoc.y + 0.0;
        float low = 1.0 - smoothstep(0.18 * uCarH, 0.62 * uCarH, carY);
        float spl = fract(sin(dot(floor(vLoc * 22.0), vec3(1.7, 9.2, 3.1))) * 4375.85);
        float dk = clamp(uDirt * low * (0.55 + 0.6 * spl), 0.0, 0.92);
        diffuseColor.rgb = mix(diffuseColor.rgb, uDirtCol, dk);`)
      .replace('#include <roughnessmap_fragment>', '#include <roughnessmap_fragment>\nroughnessFactor = mix(roughnessFactor, 0.95, dk);');
  };
  mat.customProgramCacheKey = () => 'dirt';
}
function fallbackCar() {
  const g = new T.Group();
  const paint = new T.MeshPhysicalMaterial({ color: 0xb8432c, roughness: 0.45, metalness: 0.05, clearcoat: 0.6, clearcoatRoughness: 0.25 }); dirtify(paint);
  const b = new T.Mesh(new T.BoxGeometry(1.7, 0.7, 4.0).translate(0, 0.75, 0), paint); b.castShadow = true; g.add(b);
  const cab = new T.Mesh(new T.BoxGeometry(1.5, 0.55, 2.0).translate(0, 1.35, -0.3), new T.MeshPhysicalMaterial({ color: 0x15191d, roughness: 0.1 })); g.add(cab);
  const ws = [];
  for (const [x, z] of [[0.78, 1.25], [-0.78, 1.25], [0.78, -1.25], [-0.78, -1.25]]) {
    const w = new T.Group(); w.position.set(x, WR_DEF, z); const t = new T.Mesh(new T.CylinderGeometry(WR_DEF, WR_DEF, 0.24, 20).rotateZ(Math.PI / 2), new T.MeshStandardMaterial({ color: 0x151515, roughness: 0.9 })); t.castShadow = true; w.add(t); g.add(w);
    ws.push({ node: w, front: z > 0, r: WR_DEF });
  }
  return { root: g, wheels: ws, h: 1.6, wb: 2.5, trk: 1.56, wr: WR_DEF };
}
async function loadVehicle(id) {
  const V = VEHICLES[id]; if (!V) return null;
  if (vehCache[id]) return vehCache[id];
  const gl = new T.GLTFLoader();
  const gltf = await gl.loadAsync(V.file);
  const root = gltf.scene;
  // fit to length, sit on the ground, centred
  let box = new T.Box3().setFromObject(root); let size = box.getSize(new T.Vector3());
  const s = V.len / Math.max(size.x, size.z); root.scale.setScalar(s);
  if (size.x > size.z) root.rotation.y = Math.PI / 2;
  root.updateMatrixWorld(true);
  box = new T.Box3().setFromObject(root); size = box.getSize(new T.Vector3()); const ctr = box.getCenter(new T.Vector3());
  const holder = new T.Group(); holder.add(root);
  root.position.set(-ctr.x, -box.min.y, -ctr.z);
  holder.updateMatrixWorld(true);
  // which end is the front: the bonnet end is lower than the hatch or cabin end, measured on the body
  const nodes = {}; root.traverse((o) => { nodes[o.name] = o; });
  const bodyNode = nodes.body || root;
  const v = new T.Vector3(); let hiF = 0, nF = 0, hiB = 0, nB = 0;
  bodyNode.traverse((o) => {
    if (!o.isMesh) return; const pa = o.geometry.attributes.position;
    for (let i = 0; i < pa.count; i += 7) { v.fromBufferAttribute(pa, i).applyMatrix4(o.matrixWorld); if (v.z > size.z * 0.3) { hiF += v.y; nF++; } else if (v.z < -size.z * 0.3) { hiB += v.y; nB++; } }
  });
  let flip = V.flip;
  if (flip === undefined) flip = nF && nB ? (hiF / nF > hiB / nB) : false; // +z end higher means it is the back
  if (flip) holder.rotation.y = Math.PI;
  holder.updateMatrixWorld(true);
  // materials: matte the paint a little, add dirt
  root.traverse((o) => {
    if (!o.isMesh) return; o.castShadow = true; o.receiveShadow = true;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    const out = ms.map((m) => {
      const p = new T.MeshPhysicalMaterial({ map: m.map, normalMap: m.normalMap, roughnessMap: m.roughnessMap, metalnessMap: m.metalnessMap, color: m.color, roughness: Math.max(0.35, m.roughness ?? 0.5), metalness: Math.min(0.35, m.metalness ?? 0), clearcoat: 0.5, clearcoatRoughness: 0.18, aoMap: m.aoMap, emissiveMap: m.emissiveMap, emissive: m.emissive });
      if (p.metalnessMap) p.metalness = 0.4;
      dirtify(p); return p;
    });
    o.material = Array.isArray(o.material) ? out : out[0];
  });
  // wheels: named nodes from the split; pivots at the axles
  const ws = [];
  for (const nm of ['wheel_FL', 'wheel_FR', 'wheel_RL', 'wheel_RR']) {
    const n = nodes[nm]; if (!n) continue;
    const wp = new T.Vector3(); n.getWorldPosition(wp); holder.worldToLocal(wp);
    // wrap each wheel in a pivot owned by the car so steering and spin are about car axes
    const pivot = new T.Group(); pivot.position.copy(wp); holder.add(pivot);
    pivot.attach(n);
    const bb = new T.Box3().setFromObject(n); const r = (bb.max.y - bb.min.y) / 2 || WR_DEF;
    const st = WHEEL_STYLE[id] || WHEEL_STYLE.rally;
    const wd = clamp(bb.max.x - bb.min.x, st.tyreW * 0.85, st.tyreW * 1.3);
    n.visible = false;
    pivot.add(buildWheel(st, r, wd, wp.x >= 0 ? 1 : -1));
    ws.push({ node: pivot, front: (flip ? -wp.z : wp.z) > 0, r, spin: flip ? -1 : 1 });
  }
  holder.updateMatrixWorld(true);
  const fz = ws.filter((w) => w.front).map((w) => w.node.position.z), rz = ws.filter((w) => !w.front).map((w) => w.node.position.z);
  const wb = fz.length && rz.length ? Math.abs(fz[0] - rz[0]) : V.len * 0.62;
  const trk = ws.length ? Math.abs(ws[0].node.position.x) * 2 : 1.56;
  const res = { root: holder, wheels: ws, h: size.y, wb, trk, wr: ws[0]?.r || WR_DEF };
  vehCache[id] = res;
  return res;
}
// ---------------------------------------------------------------- wheels, built here
const treadCache = {};
function treadBump(kind, v0, v1) {
  const key = kind + v0.toFixed(3) + v1.toFixed(3); if (treadCache[key]) return treadCache[key];
  const t = canvasTex(1024, 128, (g, w, h) => {
    g.fillStyle = '#7a7a7a'; g.fillRect(0, 0, w, h);
    const y0 = v0 * h, y1 = v1 * h, th = y1 - y0;
    // sidewall: a fine ring of moulded text bands
    g.fillStyle = '#6c6c6c'; g.fillRect(0, y0 * 0.45, w, y0 * 0.12); g.fillRect(0, h - y0 * 0.57, w, y0 * 0.12);
    for (let i = 0; i < 90; i++) { g.fillStyle = i % 3 ? '#848484' : '#666'; g.fillRect(i * w / 90, y0 * 0.62, w / 90 * 0.6, y0 * 0.1); g.fillRect(i * w / 90, h - y0 * 0.72, w / 90 * 0.6, y0 * 0.1); }
    if (kind === 'road') {
      g.fillStyle = '#9a9a9a'; g.fillRect(0, y0, w, th);
      g.fillStyle = '#262626';
      for (const f of [0.27, 0.5, 0.73]) g.fillRect(0, y0 + th * f - 3, w, 6);
      g.strokeStyle = '#3c3c3c'; g.lineWidth = 4;
      for (let i = 0; i < 72; i++) { const x = i * w / 72; g.beginPath(); g.moveTo(x, y0 + th * 0.04); g.lineTo(x + 9, y0 + th * 0.25); g.moveTo(x + 11, y0 + th * 0.3); g.lineTo(x + 4, y0 + th * 0.47); g.moveTo(x + 4, y0 + th * 0.53); g.lineTo(x + 11, y0 + th * 0.7); g.moveTo(x + 9, y0 + th * 0.75); g.lineTo(x, y0 + th * 0.96); g.stroke(); }
    } else {
      g.fillStyle = '#5a5a5a'; g.fillRect(0, y0, w, th);
      g.fillStyle = '#b0b0b0';
      for (let i = 0; i < 22; i++) { const x = i * w / 22; g.fillRect(x + 4, y0 + th * 0.06, w / 22 * 0.55, th * 0.38); g.fillRect(x + w / 44 + 4, y0 + th * 0.56, w / 22 * 0.55, th * 0.38); }
    }
  }, false, true);
  treadCache[key] = t; return t;
}
const KNOBS = 22;
function buildWheel(st, R, Wd, outward) {
  const g = new T.Group();
  const rr = R * st.ratio, hw = Wd / 2, sh = Math.min(0.05, (R - rr) * 0.4);
  // tyre: a lathe around the axle, inner sidewall, rounded shoulder, flat tread, shoulder, outer sidewall
  const prof = [];
  const sideN = 4, shN = 4, trN = 8;
  for (let i = 0; i <= sideN; i++) { const k = i / sideN; prof.push([rr + (R - sh - rr) * k, -hw * (0.86 + 0.14 * Math.sin(k * Math.PI / 2))]); }
  for (let i = 1; i <= shN; i++) { const a = i / shN * Math.PI / 2; prof.push([R - sh + Math.sin(a) * sh, -hw + sh - Math.cos(a) * sh]); }
  const trStart = prof.length - 1;
  for (let i = 1; i < trN; i++) prof.push([R, -hw + sh + (2 * hw - 2 * sh) * i / trN]);
  const trEnd = prof.length;
  for (let i = 0; i <= shN; i++) { const a = i / shN * Math.PI / 2; prof.push([R - sh + Math.cos(a) * sh, hw - sh + Math.sin(a) * sh]); }
  for (let i = 1; i <= sideN; i++) { const k = i / sideN; prof.push([R - sh - (R - sh - rr) * k, hw * (0.86 + 0.14 * Math.cos(k * Math.PI / 2))]); }
  const n = prof.length;
  const lat = new T.LatheGeometry(prof.map(([x, y]) => new T.Vector2(x, y)), st.tread === 'knob' ? 132 : 72);
  if (st.tread === 'knob') {
    const pa = lat.attributes.position, v = new T.Vector3();
    for (let i = 0; i < pa.count; i++) {
      v.fromBufferAttribute(pa, i); const rad = Math.hypot(v.x, v.z); if (rad < R - sh * 1.6) continue;
      const th = Math.atan2(v.z, v.x) / (Math.PI * 2) + 0.5;
      const half = v.y > 0 ? 0.5 : 0; const f = (th * KNOBS + half) % 1;
      const on = f < 0.58 ? 1 : 0; const centre = Math.abs(v.y) < hw * 0.12 ? 0.6 : 1;
      const k = (R + on * 0.032 * centre) / rad; pa.setXYZ(i, v.x * k, v.y, v.z * k);
    }
    lat.computeVertexNormals();
  }
  lat.rotateZ(-Math.PI / 2);
  const tyreMat = new T.MeshStandardMaterial({ color: 0x1c1c1e, roughness: 0.86, metalness: 0, bumpMap: treadBump(st.tread, trStart / (n - 1), trEnd / (n - 1)), bumpScale: 2.2, side: T.DoubleSide });
  const tyre = new T.Mesh(lat, tyreMat); tyre.castShadow = true; tyre.receiveShadow = true; g.add(tyre);
  // rim
  const rimMat = new T.MeshPhysicalMaterial({ color: st.rimCol, metalness: st.metal, roughness: 0.28, clearcoat: 0.6, clearcoatRoughness: 0.15 });
  const darkMat = new T.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.7, metalness: 0.3 });
  const discMat = new T.MeshStandardMaterial({ color: 0x77736e, roughness: 0.45, metalness: 0.9 });
  const rimG = [], darkG = [], discG = [];
  const face = hw * 0.55;
  rimG.push(new T.CylinderGeometry(rr * 0.985, rr * 0.985, Wd * 0.86, 44, 1, true).rotateZ(Math.PI / 2));
  rimG.push(new T.TorusGeometry(rr * 0.985, Math.max(0.012, R * 0.035), 8, 48).rotateY(Math.PI / 2).translate(face + 0.01, 0, 0));
  darkG.push(new T.CircleGeometry(rr * 0.98, 40).rotateY(Math.PI / 2).translate(-hw * 0.5, 0, 0));
  discG.push(new T.CylinderGeometry(rr * 0.74, rr * 0.74, 0.024, 36).rotateZ(Math.PI / 2).translate(-hw * 0.05, 0, 0));
  darkG.push(new T.BoxGeometry(0.06, rr * 0.36, rr * 0.22).translate(-hw * 0.05 + 0.02, rr * 0.55, 0)); // caliper, turns with the wheel but reads as one
  rimG.push(new T.CylinderGeometry(rr * 0.2, rr * 0.24, 0.07, 24).rotateZ(Math.PI / 2).translate(face - 0.015, 0, 0));
  const nS = st.spokes, span = rr * 0.93 - rr * 0.2;
  if (st.rim === 'steel') {
    rimG.push(new T.CircleGeometry(rr * 0.95, 44).rotateY(Math.PI / 2).translate(face - 0.03, 0, 0));
    for (let i = 0; i < nS; i++) { const a = i / nS * Math.PI * 2; darkG.push(new T.CircleGeometry(rr * 0.13, 20).rotateY(Math.PI / 2).translate(face - 0.025, Math.cos(a) * rr * 0.6, Math.sin(a) * rr * 0.6)); }
    if (st.ring) { const ringMat = new T.MeshStandardMaterial({ color: st.ring, metalness: 0.7, roughness: 0.35 }); const ring = new T.Mesh(new T.TorusGeometry(rr * 0.97, 0.022, 8, 48).rotateY(Math.PI / 2).translate(face + 0.025, 0, 0), ringMat); g.add(ring);
      for (let i = 0; i < 16; i++) { const a = i / 16 * Math.PI * 2; rimG.push(new T.CylinderGeometry(0.01, 0.01, 0.03, 6).rotateZ(Math.PI / 2).translate(face + 0.045, Math.cos(a) * rr * 0.97, Math.sin(a) * rr * 0.97)); } }
  } else {
    const wSp = st.rim === 'multi' ? rr * 0.07 : st.rim === 'split' ? rr * 0.06 : rr * 0.2;
    for (let i = 0; i < nS; i++) {
      const a0 = i / nS * Math.PI * 2;
      const offs = st.rim === 'split' ? [-0.11, 0.11] : [0];
      for (const o of offs) {
        const a = a0 + o;
        const sp = new T.BoxGeometry(0.035, span, wSp);
        if (st.rim === 'five') { const pa = sp.attributes.position; for (let k = 0; k < pa.count; k++) { const y = pa.getY(k); pa.setZ(k, pa.getZ(k) * (y > 0 ? 0.55 : 1)); } }
        sp.translate(face - 0.02, rr * 0.2 + span / 2, 0).rotateX(a);
        rimG.push(sp);
      }
    }
  }
  for (let i = 0; i < 5; i++) { const a = i / 5 * Math.PI * 2; darkG.push(new T.CylinderGeometry(0.011, 0.011, 0.03, 6).rotateZ(Math.PI / 2).translate(face + 0.025, Math.cos(a) * rr * 0.12, Math.sin(a) * rr * 0.12)); }
  const rim = new T.Mesh(merge(rimG), rimMat); rim.castShadow = true;
  const dark = new T.Mesh(merge(darkG), darkMat);
  const disc = new T.Mesh(merge(discG), discMat);
  g.add(rim, dark, disc);
  if (outward < 0) g.rotation.y = Math.PI;
  return g;
}
let carGeom = { h: 1.6, wb: 2.5, trk: 1.56, wr: WR_DEF };
function mountVehicle(m) {
  if (vehModel) body.remove(vehModel.root);
  vehModel = m; body.add(m.root); wheels = m.wheels; carGeom = m; carU.uCarH.value = m.h;
  headLight.position.set(0, m.h * 0.5, VEHICLES[P.vehicle]?.len / 2 || 2);
  mountFlames(VEHICLES[P.vehicle] || VEHICLES.rally);
}
async function selectVehicle(id, quiet) {
  if (!VEHICLES[id]) id = 'rally';
  P.vehicle = id; veh = VEHICLES[id];
  window.GOAExtension?.vehicleChanged(id);
  loadingVeh = id;
  try {
    const m = await loadVehicle(id);
    if (loadingVeh !== id) return;
    mountVehicle(m);
    if (!quiet) toast(veh.name);
  } catch (e) {
    console.warn('vehicle', id, e);
    if (!vehModel) mountVehicle(fallbackCar());
    if (!quiet) toast(`${veh.name} could not load`);
  }
  refreshSettings();
}
// workshop hook: renders one vehicle as it is built here into a studio picture (used to make the garage images)
window.__dbg = () => ({ h0, terrainH, trees, P, U, live, scene, renderer });
window.__thumb = async (id, w = 640, h = 380) => {
  const m = await loadVehicle(id); const R = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true });
  R.setSize(w, h); R.toneMapping = T.ACESFilmicToneMapping; R.outputColorSpace = T.SRGBColorSpace; R.shadowMap.enabled = true; R.shadowMap.type = T.PCFSoftShadowMap;
  const sc = new T.Scene(); const es = new T.Scene();
  const sg = new T.SphereGeometry(50, 32, 16); const col = []; const pa = sg.attributes.position;
  for (let i = 0; i < pa.count; i++) { const y = pa.getY(i) / 50; const c = new T.Color('#c9d3dc').lerp(new T.Color('#7f9fc4'), Math.max(0, y)).lerp(new T.Color('#8c7a62'), Math.max(0, -y)); col.push(c.r, c.g, c.b); }
  sg.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  es.add(new T.Mesh(sg, new T.MeshBasicMaterial({ vertexColors: true, side: T.BackSide })));
  const pm = new T.PMREMGenerator(R); sc.environment = pm.fromScene(es, 0.04).texture;
  const holder = m.root; const par = holder.parent; const pp = holder.position.clone(), pr = holder.rotation.clone();
  holder.position.set(0, 0, 0); holder.rotation.set(0, 0, 0); sc.add(holder);
  const sunL = new T.DirectionalLight(0xffe2c0, 2.6); sunL.position.set(-6, 9, 7); sunL.castShadow = true; sunL.shadow.mapSize.set(2048, 2048);
  Object.assign(sunL.shadow.camera, { left: -9, right: 9, top: 9, bottom: -9, near: 1, far: 40 }); sc.add(sunL);
  sc.add(new T.HemisphereLight(0xdde6ee, 0x6b5a46, 0.6));
  const gnd = new T.Mesh(new T.PlaneGeometry(30, 30).rotateX(-Math.PI / 2), new T.ShadowMaterial({ opacity: 0.32 })); gnd.receiveShadow = true; sc.add(gnd);
  const bb = new T.Box3().setFromObject(holder); const sz = bb.getSize(new T.Vector3()); const ct = bb.getCenter(new T.Vector3());
  const cam = new T.PerspectiveCamera(26, w / h, 0.1, 100);
  const L = Math.max(sz.x, sz.z), d = L * 2.75;
  cam.position.set(ct.x + d * 0.78, ct.y + sz.y * 0.55 + d * 0.16, ct.z + d * 0.62); cam.lookAt(ct.x, ct.y * 0.9, ct.z);
  R.render(sc, cam); const url = R.domElement.toDataURL('image/webp', 0.92);
  sc.remove(holder); holder.position.copy(pp); holder.rotation.copy(pr); if (par) par.add(holder);
  R.dispose(); return url;
};
// ---------------------------------------------------------------- nitro: flames, light, contact shadow
const flameMat = new T.ShaderMaterial({
  transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide,
  uniforms: { amt: { value: 0 }, time: { value: 0 }, len: { value: 1 } },
  vertexShader: `uniform float amt, time, len; varying float vT; varying vec3 vN; varying vec3 vV;
    void main(){ vec3 p = position; vT = clamp(-p.z / len, 0.0, 1.0);
      float fl = 0.75 + 0.25 * sin(time * 53.0 + p.x * 40.0) * sin(time * 31.0);
      p.z *= (0.35 + 0.65 * amt) * fl; p.xy *= 0.6 + 0.4 * amt;
      vec4 mv = modelViewMatrix * vec4(p, 1.0); vV = normalize(-mv.xyz); vN = normalize(normalMatrix * normal + vec3(1e-5));
      gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform float amt, time; varying float vT; varying vec3 vN; varying vec3 vV;
    void main(){ float rim = pow(abs(dot(vN, vV)), 1.4);
      vec3 core = vec3(0.55, 0.75, 1.9), mid = vec3(1.9, 0.75, 0.22), tip = vec3(1.2, 0.25, 0.05);
      vec3 c = mix(core, mid, smoothstep(0.0, 0.35, vT)); c = mix(c, tip, smoothstep(0.45, 1.0, vT));
      float a = amt * rim * pow(max(1.0 - vT, 0.0), 1.3) * 0.9;
      if (!(a > 0.0) || a > 10.0) discard;
      gl_FragColor = vec4(c * a, min(a, 1.0)); }`,
});
const FLAME_L = 0.95;
const flameGeo = new T.ConeGeometry(0.085, FLAME_L, 14, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -FLAME_L / 2);
const flameGeo2 = new T.ConeGeometry(0.05, FLAME_L * 0.6, 10, 1, true).rotateX(-Math.PI / 2).translate(0, 0, -FLAME_L * 0.3);
const flames = new T.Group(); body.add(flames);
const nitroLight = new T.PointLight(0xff8a3a, 0, 7, 1.6); flames.add(nitroLight);
function mountFlames(V) {
  flames.clear(); flames.add(nitroLight);
  const ex = V.exh || { y: 0.3, x: [0.4] }, z = -V.len / 2 + 0.06;
  for (const x of ex.x) {
    const f = new T.Mesh(flameGeo, flameMat); f.position.set(x, ex.y, z); f.frustumCulled = false; f.renderOrder = 5;
    if (ex.up) f.rotation.x = -ex.up;
    const f2 = new T.Mesh(flameGeo2, flameMat); f.add(f2);
    flames.add(f);
  }
  nitroLight.position.set(0, ex.y + 0.1, z - 0.6);
}
const blobTex = canvasTex(128, 128, (g, w) => {
  const gr = g.createRadialGradient(w / 2, w / 2, 0, w / 2, w / 2, w / 2);
  gr.addColorStop(0, 'rgba(0,0,0,.85)'); gr.addColorStop(0.55, 'rgba(0,0,0,.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.fillStyle = gr; g.fillRect(0, 0, w, w);
}, false, false);
const blob = new T.Mesh(new T.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ map: blobTex, transparent: true, depthWrite: false, opacity: 0.6, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -3 }));
blob.renderOrder = 1; scene.add(blob);
function updateNitroFx(dt) {
  S.nitroFx = damp(S.nitroFx, S.nitroOn ? 1 : 0, S.nitroOn ? 7 : 4, dt);
  flameMat.uniforms.amt.value = S.nitroFx; flameMat.uniforms.time.value += dt; flameMat.uniforms.len.value = FLAME_L;
  flames.visible = S.nitroFx > 0.01;
  nitroLight.intensity = S.nitroFx * (2 + Math.random() * 1.2);
  const V = VEHICLES[P.vehicle] || VEHICLES.rally, gy = groundY(S.x, S.z), lift = Math.max(0, S.y - gy);
  blob.position.set(S.x, gy + 0.04, S.z); blob.rotation.y = S.yaw;
  blob.scale.set((carGeom.trk || 1.56) * 1.45, 1, V.len * 1.12);
  blob.material.opacity = 0.62 * clamp(1 - lift / 4, 0, 1);
}
const headLight = new T.SpotLight(0xfff2dd, 0, 80, 0.5, 0.5, 1.4);
headLight.position.set(0, 0.8, 2.0); headLight.target.position.set(0, 0, 20); car.add(headLight, headLight.target);

// ---------------------------------------------------------------- particles: rain, snowfall
function wrapPoints(n, box, vert, frag, uniforms, lines = false) {
  const reps = lines ? 2 : 1;
  const base = new Float32Array(n * 3 * reps), seed = new Float32Array(n * reps), end = new Float32Array(n * reps);
  const r = rng(n);
  for (let i = 0; i < n; i++) {
    const x = r() * box.x, y = r() * box.y, z = r() * box.z, s = r();
    for (let e = 0; e < reps; e++) { const k = i * reps + e; base[k * 3] = x; base[k * 3 + 1] = y; base[k * 3 + 2] = z; seed[k] = s; end[k] = e; }
  }
  const g = new T.BufferGeometry();
  g.setAttribute('position', new T.BufferAttribute(base, 3)); g.setAttribute('seed', new T.BufferAttribute(seed, 1)); g.setAttribute('endp', new T.BufferAttribute(end, 1));
  const mat = new T.ShaderMaterial({ uniforms: Object.assign({ time: { value: 0 }, center: { value: new T.Vector3() }, box: { value: box }, alpha: { value: 0 }, scale: { value: innerHeight }, light: { value: 1 } }, uniforms), vertexShader: vert, fragmentShader: frag, transparent: true, depthWrite: false });
  const o = lines ? new T.LineSegments(g, mat) : new T.Points(g, mat); o.frustumCulled = false; o.renderOrder = 2; scene.add(o); return o;
}
const WRAP = 'vec3 wrapP(vec3 p){ vec3 rel = mod(p - center + box*0.5, box) - box*0.5; return center + rel; }';
const rain = wrapPoints(7000, new T.Vector3(60, 34, 60), `
  uniform float time; uniform vec3 center, box, wind; attribute float seed, endp; varying float vA; ${WRAP}
  void main(){ vec3 p = position; p.y -= time * (19.0 + seed * 6.0); p.xz += wind.xz * time * 0.5; p = wrapP(p);
    p += (vec3(0.0, 0.7, 0.0) - wind * 0.03) * endp;
    vec4 mv = modelViewMatrix * vec4(p, 1.0); vA = (1.0 - smoothstep(8.0, 30.0, -mv.z)) * (0.3 + endp * 0.7); gl_Position = projectionMatrix * mv; }`,
'uniform float alpha, light; varying float vA; void main(){ gl_FragColor = vec4(vec3(0.75, 0.79, 0.84) * light, alpha * vA * 0.4); }', { wind: { value: new T.Vector3() } }, true);
const snowfall = wrapPoints(8000, new T.Vector3(70, 36, 70), `
  uniform float time, scale; uniform vec3 center, box, wind; attribute float seed; varying float vA; ${WRAP}
  void main(){ vec3 p = position; p.y -= time * (1.1 + seed * 0.9); p.x += sin(time * 0.6 + seed * 40.0) * 1.0 + wind.x * time * 0.35; p.z += cos(time * 0.5 + seed * 25.0) * 1.0 + wind.z * time * 0.35; p = wrapP(p);
    vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_PointSize = (0.07 + seed * 0.08) * scale / -mv.z; vA = 1.0 - smoothstep(18.0, 35.0, -mv.z); gl_Position = projectionMatrix * mv; }`,
'uniform float alpha, light; varying float vA; void main(){ vec2 c = gl_PointCoord - 0.5; float d = length(c); float a = smoothstep(0.5, 0.1, d); gl_FragColor = vec4(vec3(1.0) * light, a * alpha * vA); }', { wind: { value: new T.Vector3() } });

// dust plumes, smoke, spray, powder: soft sprites that grow, drift with the wind and settle
const DN = 1400;
const dust = { pos: new Float32Array(DN * 3), vel: new Float32Array(DN * 3), life: new Float32Array(DN), max: new Float32Array(DN), size: new Float32Array(DN), s0: new Float32Array(DN), col: new Float32Array(DN * 3), alpha: new Float32Array(DN), a0: new Float32Array(DN), grow: new Float32Array(DN), spark: new Float32Array(DN), heavy: new Float32Array(DN), next: 0 };
const dustGeo = new T.BufferGeometry();
dustGeo.setAttribute('position', new T.BufferAttribute(dust.pos, 3)); dustGeo.setAttribute('psize', new T.BufferAttribute(dust.size, 1));
dustGeo.setAttribute('pcol', new T.BufferAttribute(dust.col, 3)); dustGeo.setAttribute('palpha', new T.BufferAttribute(dust.alpha, 1)); dustGeo.setAttribute('pspark', new T.BufferAttribute(dust.spark, 1));
const dustMat = new T.ShaderMaterial({
  uniforms: { map: { value: softDot }, scale: { value: innerHeight }, light: { value: 1 }, sunCol: { value: C('#fff') }, time: { value: 0 } }, transparent: true, depthWrite: false,
  vertexShader: `uniform float scale; attribute float psize, palpha, pspark; attribute vec3 pcol; varying vec3 vC; varying float vA, vS;
    void main(){ vec4 mv = modelViewMatrix * vec4(position, 1.0); gl_PointSize = psize * scale / -mv.z; vC = pcol; vA = palpha; vS = pspark; gl_Position = projectionMatrix * mv; }`,
  fragmentShader: `uniform sampler2D map; uniform float light, time; uniform vec3 sunCol; varying vec3 vC; varying float vA, vS;
    void main(){ vec4 t = texture2D(map, gl_PointCoord); vec3 c = vC * light * mix(vec3(1.0), sunCol, 0.25);
      float sp = vS * step(0.985, fract(sin(dot(floor(gl_PointCoord * 9.0), vec2(12.9, 78.2)) + time * 3.0) * 43758.5));
      c += sunCol * sp * 4.0;
      gl_FragColor = vec4(c, t.a * vA + sp * 0.6 * vA); }`,
});
const dustPts = new T.Points(dustGeo, dustMat); dustPts.frustumCulled = false; dustPts.renderOrder = 3; scene.add(dustPts);
function emitDust(x, y, z, vx, vy, vz, size, life, col, a, grow, spark = 0, heavy = 0) {
  const i = dust.next; dust.next = (dust.next + 1) % DN;
  dust.pos[i * 3] = x; dust.pos[i * 3 + 1] = y; dust.pos[i * 3 + 2] = z;
  dust.vel[i * 3] = vx; dust.vel[i * 3 + 1] = vy; dust.vel[i * 3 + 2] = vz;
  dust.life[i] = life; dust.max[i] = life; dust.s0[i] = size; dust.size[i] = size; dust.col[i * 3] = col.r; dust.col[i * 3 + 1] = col.g; dust.col[i * 3 + 2] = col.b;
  dust.a0[i] = a; dust.alpha[i] = 0; dust.grow[i] = grow; dust.spark[i] = spark; dust.heavy[i] = heavy;
}
const windV = new T.Vector3(1.4, 0, 0.6);
function updateDust(dt) {
  for (let i = 0; i < DN; i++) {
    if (dust.life[i] <= 0) { dust.alpha[i] = 0; continue; }
    dust.life[i] -= dt; const t = 1 - dust.life[i] / dust.max[i];
    const dr = Math.exp(-(dust.heavy[i] ? 0.6 : 1.4) * dt);
    dust.vel[i * 3] = dust.vel[i * 3] * dr + windV.x * (1 - dr) * 0.6; dust.vel[i * 3 + 2] = dust.vel[i * 3 + 2] * dr + windV.z * (1 - dr) * 0.6;
    dust.vel[i * 3 + 1] = dust.vel[i * 3 + 1] * dr + (dust.heavy[i] ? -9.8 * dt : (0.12 - t * 0.25) * dt);
    dust.pos[i * 3] += dust.vel[i * 3] * dt; dust.pos[i * 3 + 1] += dust.vel[i * 3 + 1] * dt; dust.pos[i * 3 + 2] += dust.vel[i * 3 + 2] * dt;
    dust.size[i] = dust.s0[i] * (1 + t * dust.grow[i]); dust.alpha[i] = dust.a0[i] * Math.sin(Math.min(1, t * 5) * Math.PI / 2) * Math.pow(1 - t, 1.4);
  }
  for (const k of ['position', 'psize', 'palpha', 'pcol', 'pspark']) dustGeo.attributes[k].needsUpdate = true;
}

// tyre marks that persist, then fade
const SKN = 3000;
const skidGeo = new T.PlaneGeometry(0.24, 0.7).rotateX(-Math.PI / 2);
const skidBirth = new T.InstancedBufferAttribute(new Float32Array(SKN).fill(-1e5), 1); skidGeo.setAttribute('aBirth', skidBirth);
const skidMat = new T.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -6, polygonOffsetUnits: -6 });
const skidTime = { value: 0 };
skidMat.onBeforeCompile = (sh) => {
  sh.uniforms.uT = skidTime;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float aBirth; uniform float uT; varying float vFade;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFade = 1.0 - smoothstep(35.0, 70.0, uT - aBirth);');
  sh.fragmentShader = sh.fragmentShader.replace('#include <common>', '#include <common>\nvarying float vFade;').replace('#include <opaque_fragment>', 'diffuseColor.a *= vFade;\n#include <opaque_fragment>');
};
const skids = new T.InstancedMesh(skidGeo, skidMat, SKN);
skids.frustumCulled = false; skids.count = 0; skids.instanceMatrix.setUsage(T.DynamicDrawUsage); scene.add(skids);
skids.instanceColor = new T.InstancedBufferAttribute(new Float32Array(SKN * 3).fill(1), 3);
let skidNext = 0, markGap = 2.5; const lastMark = [null, null];
const skm = new T.Matrix4(), skq = new T.Quaternion(), skv = new T.Vector3(), sks = new T.Vector3(1, 1, 1), YUP = new T.Vector3(0, 1, 0);
function markAt(w, x, y, z, yaw, col, width) {
  const L = lastMark[w];
  if (L && Math.hypot(L.x - x, L.z - z) < 0.6) return;
  if (L && Math.hypot(L.x - x, L.z - z) < markGap) { yaw = Math.atan2(x - L.x, z - L.z); sks.set(width, 1, Math.hypot(L.x - x, L.z - z) / 0.7); skv.set((x + L.x) / 2, y, (z + L.z) / 2); }
  else { sks.set(width, 1, 1); skv.set(x, y, z); }
  skq.setFromAxisAngle(YUP, yaw); skm.compose(skv, skq, sks);
  skids.setMatrixAt(skidNext, skm); skids.setColorAt(skidNext, col); skidBirth.array[skidNext] = clockT;
  skidBirth.needsUpdate = true;
  skidNext = (skidNext + 1) % SKN; skids.count = Math.min(SKN, skids.count + 1);
  skids.instanceMatrix.needsUpdate = true; skids.instanceColor.needsUpdate = true;
  lastMark[w] = { x, z };
}

// ---------------------------------------------------------------- audio
let actx = null, engineSrc = null, engineGain = null, birdsGain = null, windGain = null, rainGain = null, master = null;
let soundOn = mb?.sound ? !!mb.sound.on : true;
async function loadBuf(url) { const r = await fetch(url); const a = await r.arrayBuffer(); return await actx.decodeAudioData(a); }
async function initAudio() {
  if (actx) return; const AC = window.AudioContext || window.webkitAudioContext; if (!AC) return;
  actx = new AC(); master = actx.createGain(); master.gain.value = soundOn ? P.volume : 0; master.connect(actx.destination);
  try {
    const [eng, bir, win] = await Promise.all(['engine', 'birds', 'wind'].map((n) => loadBuf(`assets/audio/${n}.mp3`)));
    const loop = (buf) => { const s = actx.createBufferSource(); s.buffer = buf; s.loop = true; s.loopStart = 0.05; s.loopEnd = buf.duration - 0.05; const gn = actx.createGain(); gn.gain.value = 0; s.connect(gn); gn.connect(master); s.start(); return [s, gn]; };
    [engineSrc, engineGain] = loop(eng); [, birdsGain] = loop(bir); [, windGain] = loop(win);
    const rs = actx.createBufferSource(); rs.buffer = win; rs.loop = true; rs.playbackRate.value = 2.2; const hp = actx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 1400;
    rainGain = actx.createGain(); rainGain.gain.value = 0; rs.connect(hp); hp.connect(rainGain); rainGain.connect(master); rs.start();
  } catch (e) { console.warn('audio', e); }
  loadSfx();
}
const SFX = {};
async function loadSfx() { for (const n of ['nitro', 'land']) { try { SFX[n] = await loadBuf(`assets/sfx/${n}.mp3`); } catch (e) { /* missing sound */ } } }
function playSfx(n, vol = 1) {
  if (!actx || !SFX[n] || !master) return;
  const s = actx.createBufferSource(); s.buffer = SFX[n]; const g = actx.createGain(); g.gain.value = vol * P.sfxVol; s.connect(g); g.connect(master); s.start();
}
function setSound(on) { soundOn = on; if (master) master.gain.value = on ? P.volume : 0; refreshSettings(); }
mb?.sound?.onchange?.((on) => setSound(!!on));

// ---------------------------------------------------------------- state
const S = {
  x: 0, z: 0, y: 0, yaw: 0, vx: 0, vz: 0, w: 0, steer: 0, started: false, ctrl: false,
  lap: 1, lapT: 0, best: null, bestSplits: null, splits: [], last: null, cps: 0, lastIdx: 0, topSpeed: 0,
  driftScore: 0, driftT: 0, driftBest: 0, bodyPitch: 0, bodyRoll: 0, susp: 0, suspV: 0, wheelRot: 0, prevV: 0, dist: 0, sessTop: 0, rpm: 1, gear: 1,
  nitro: 1, nitroOn: false, nitroFx: 0,
  vy: 0, air: false, crash: 0, ap: 0, ar: 0, apv: 0, arv: 0, airT: 0, airMax: 0, gPitch: 0, stuntBest: 0, stuntTotal: 0,
};
const keys = {};
const touch = { l: 0, r: 0, g: 0, b: 0, d: 0, n: 0 };
document.addEventListener('goa-clear-input',()=>{for(const k in touch)touch[k]=0;for(const k in keys)keys[k]=0;});
function resetCar(toStart) {
  let i = 0, R = ROADS[0];
  if (!toStart) { const q = nearestRoad(S.x, S.z, q2); if (q.road >= 0) { R = ROADS[q.road]; i = q.i; } else { i = S.lastIdx; } }
  const f = roadFrame(R, i);
  S.x = f.p.x; S.z = f.p.z; S.yaw = Math.atan2(f.tx, f.tz);
  if (toStart) { S.x -= f.nx * 2.8; S.z -= f.nz * 2.8; S.x -= f.tx * 8; S.z -= f.tz * 8; }
  S.vx = S.vz = S.w = 0; S.y = R.y[i]; S.vy = 0; S.vyS = 0; S.air = false; S.crash = 0; S.ap = S.ar = S.apv = S.arv = 0;
  lastMark[0] = lastMark[1] = null;
}

// ---------------------------------------------------------------- conditions
const ICON = {
  green: '<path d="M12 3 7 10h3l-4 6h5v5h2v-5h5l-4-6h3z"/>',
  dust: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  snow: '<path d="M12 2v20M3.5 7l17 10M3.5 17l17-10M9 4l3 2 3-2M9 20l3-2 3 2"/>',
  clear: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1 7 17M17 7l2.1-2.1"/>',
  overcast: '<path d="M7 18h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 18z"/>',
  rain: '<path d="M7 14h10a4 4 0 0 0 0-8 5.5 5.5 0 0 0-10.6 1.5A3.3 3.3 0 0 0 7 14z"/><path d="M8 17l-1 3M12 17l-1 3M16 17l-1 3"/>',
  fog: '<path d="M4 8h16M3 12h18M5 16h14M7 20h10"/>',
  snowfall: '<path d="M12 4v16M5 8l14 8M5 16l14-8"/>',
};
function condLabel() { const b = $('condbtn'); if (b) b.textContent = `${SEASON_NAME[season]}, ${WEATHER_NAME[weather]}`; }
function setSeason(se, quiet) {
  if (se === 'spring') se = 'green'; if (se === 'summer' || se === 'autumn') se = 'dust'; if (se === 'winter') se = 'snow';
  if (!SEASONS.includes(se)) return;
  season = se;
  document.querySelectorAll('#seasons .tile').forEach((b) => b.classList.toggle('on', b.dataset.k === se));
  condLabel();
  refreshSettings();
  if (!quiet) { mb?.event?.('season', { season: se }); saveSettings(); }
}
function setWeather(w, quiet) {
  if (w === 'cloudy') w = 'overcast'; if (w === 'snow') w = 'snowfall';
  if (!WEATHERS.includes(w)) return;
  weather = w;
  document.querySelectorAll('#weathers .tile').forEach((b) => b.classList.toggle('on', b.dataset.k === w));
  condLabel();
  refreshSettings();
  if (!quiet) { mb?.event?.('weather', { weather: w }); saveSettings(); }
}
function buildCondUI() {
  const mk = (el, list, names, fn) => list.forEach((k, i) => {
    const b = document.createElement('button'); b.className = 'tile'; b.dataset.k = k;
    b.innerHTML = `<svg viewBox="0 0 24 24">${ICON[k]}</svg><span>${names[k].toUpperCase()}</span>`;
    b.onclick = (e) => { e.stopPropagation(); fn(k); b.blur(); }; el.appendChild(b);
  });
  mk($('seasons'), SEASONS, SEASON_NAME, (k) => setSeason(k));
  mk($('weathers'), WEATHERS, WEATHER_NAME, (k) => setWeather(k));
}
let toastTimer = 0;
function toast(t, secs = 2.2) { const el = $('toast'); el.textContent = t; el.style.opacity = 1; toastTimer = secs; }
let noteText = '';
function note(t) { if (t === noteText) return; noteText = t; const el = $('note'); if (t) el.textContent = t; el.style.opacity = t ? 1 : 0; }

// ---------------------------------------------------------------- saves
let saveLoaded = false;
async function loadSettings() {
  try {
    const r = await mb?.load?.('settings'); saveLoaded = true;
    const v = r?.value;
    if (v && v.schemaVersion === 1) return { ...v, schemaVersion: 3, prefs: { camMode: v.cam || 0 } };
    if (v && (v.schemaVersion === 2 || v.schemaVersion === 3)) return v;
  } catch (e) { /* storage unavailable */ }
  return null;
}
let saveTimer = null;
function saveSettings() {
  if (!saveLoaded || !mb?.save) return;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    mb.save('settings', { schemaVersion: 3, season, weather, prefs: { ...P }, best: S.best, bestSplits: S.bestSplits, driftBest: S.driftBest, stuntBest: S.stuntBest, marker: MK.on ? [Math.round(MK.x), Math.round(MK.z)] : null }).catch(async (e) => {
      if (e?.reason === 'REVISION_CONFLICT' || e?.reason === 'AUTH_CHANGED' || e?.reason === 'LOAD_FIRST') { await loadSettings(); }
    });
  }, 800);
}

// ---------------------------------------------------------------- input
const KEYMAP = { ArrowUp: 'g', KeyW: 'g', ArrowDown: 'b', KeyS: 'b', ArrowLeft: 'l', KeyA: 'l', ArrowRight: 'r', KeyD: 'r', Space: 'd', ShiftLeft: 'n', ShiftRight: 'n', KeyN: 'n' };
addEventListener('keydown', (e) => {
  if(window.GOAXR?.active())return;
  if(window.GOAXR?.isOpen()){if(e.code==='Escape')window.GOAXR.close();return;}
  if (window.GOALocations?.isOpen()) { if(e.code==='Escape')window.GOALocations.close(); return; }
  if (window.GOAWildlife?.isOpen()) { if(e.code==='Escape')window.GOAWildlife.close(); return; }
  if (window.GOACampLife?.isOpen()) { if(e.code==='Escape')window.GOACampLife.close(); return; }
  if (window.GOAPlayer?.onFoot() && e.code !== 'Escape' && e.code !== 'KeyM' && e.code !== 'KeyJ' && e.code !== 'KeyG' && e.code !== 'KeyL') return; // on foot: the player module owns the keys
  if (window.GOAExtension?.isOpen()) { if(e.code==='Escape')window.GOAExtension.close(); return; }
  if (e.code === 'Escape') { if (mapOpen()) openMap(false); else openSettings(); e.preventDefault(); return; }
  if (e.code === 'KeyM' && mapOpen()) { openMap(false); return; }
  const inPanel = $('settings').classList.contains('open') && e.target && e.target.closest && e.target.closest('#settings');
  if (inPanel) return;
  if (!S.started) { if (e.code === 'Enter' || e.code === 'Space') { e.preventDefault(); begin(); } return; }
  if (!S.ctrl && $('summary').style.display === 'block') { if (e.code === 'Enter') { e.preventDefault(); driveAgain(); } return; }
  if (KEYMAP[e.code]) { keys[KEYMAP[e.code]] = 1; e.preventDefault(); }
  if (e.repeat) return;
  const d = e.code.match(/^Digit(\d)$/);
  if (d) { const n = +d[1]; if (n >= 1 && n <= 3) setSeason(SEASONS[n - 1]); if (n >= 4 && n <= 8) setWeather(WEATHERS[n - 4]); }
  if (e.code === 'KeyR') resetCar(false);
  if (e.code === 'KeyC') cycleCam();
  if (e.code === 'KeyV') { const ids = Object.keys(VEHICLES); setPref('vehicle', ids[(ids.indexOf(P.vehicle) + 1) % ids.length]); }
  if (e.code === 'KeyH') $('hud').classList.toggle('hidden');
  if (e.code === 'KeyM') openMap();
  if (e.code === 'KeyB') placeRamp();
  if (e.code === 'KeyT') cycleRampKind();
  if (e.code === 'KeyX') removeNearestRamp();
});
addEventListener('keyup', (e) => { if (KEYMAP[e.code]) keys[KEYMAP[e.code]] = 0; });
addEventListener('blur', () => { for (const k in keys) keys[k] = 0; });
const CAMS = ['Chase', 'Far chase', 'Hood', 'Cinematic'];
function cycleCam() { P.camMode = (P.camMode + 1) % CAMS.length; toast(`${CAMS[P.camMode]} camera`, 1.2); cine.pos = null; refreshSettings(); saveSettings(); }
function bindTouch(id, k) {
  const el = $(id);
  const on = (e) => { e.preventDefault(); el.setPointerCapture(e.pointerId); touch[k] = 1; el.classList.add('on'); if (!S.started) begin(); };
  const off = (e) => { e.preventDefault(); touch[k] = 0; el.classList.remove('on'); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
}
bindTouch('tLeft', 'l'); bindTouch('tRight', 'r'); bindTouch('tGas', 'g'); bindTouch('tBrake', 'b'); bindTouch('tDrift', 'd'); bindTouch('tNitro', 'n');
$('tRamp').addEventListener('pointerdown', (e) => { e.preventDefault(); if (!S.started) begin(); placeRamp(); });
$('carbtn').onclick = (e) => { setTab = 'vehicle'; openSettings(true); e.target.blur(); };
$('rampbtn').onclick = (e) => { $('build').classList.toggle('open'); refreshBuild(); e.target.blur(); };
$('buildplace').onclick = (e) => { placeRamp(); e.target.blur(); };
$('buildremove').onclick = (e) => { removeNearestRamp(); e.target.blur(); };
$('buildclear').onclick = (e) => { clearMyRamps(); e.target.blur(); };
$('buildclose').onclick = () => $('build').classList.remove('open');
const isTouch = matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
let sawTouch = false;
if (isTouch) document.body.classList.add('touch');
addEventListener('pointerdown', (e) => { if (e.pointerType === 'touch' && !sawTouch) { sawTouch = true; if (P.touchShow === 'auto') document.body.classList.add('touch'); } }, true);
$('cambtn').onclick = (e) => { if (!S.started) begin(); cycleCam(); e.target.blur(); };
$('resetbtn').onclick = (e) => { resetCar(false); e.target.blur(); };
$('condbtn').onclick = () => $('cond').classList.toggle('open');
$('boardbtn').onclick = () => showBoard();
$('boardclose').onclick = () => { $('board').style.display = 'none'; };
$('hintbtn').onclick = () => showHint(8);

addEventListener('blur', () => { for(const k in touch)touch[k]=0; document.querySelectorAll('.tb.on').forEach(el=>el.classList.remove('on')); });
document.addEventListener('visibilitychange', () => { if(document.hidden){for(const k in touch)touch[k]=0;} });
// ---------------------------------------------------------------- settings panel
const pct = (v) => `${Math.round(v * 100)}%`;
const TABS = {
  vehicle: { label: 'Vehicle', rows: [{ k: 'vehicle', label: 'Choose a vehicle', type: 'vehicles', hint: 'V cycles through them while driving. Each has its own handling, and dirt, dust and snow build up on all of them.' }] },
  driving: { label: 'Driving', rows: [
    { type: 'head', label: 'Feel' },
    { k: 'handling', label: 'Handling style', type: 'choice', options: [['relaxed', 'Relaxed'], ['balanced', 'Balanced'], ['rally', 'Rally'], ['custom', 'Custom']], hint: 'Sets the sensitivities and drift assist below at once. Relaxed is gentle and forgiving, Rally is quick and loose.' },
    { k: 'steer', label: 'Steering sensitivity', type: 'range', min: 0.4, max: 1.8, step: 0.05, fmt: pct, hint: 'How far the wheels turn for a full press.' },
    { k: 'steerSpeed', label: 'Steering speed', type: 'range', min: 0.4, max: 2, step: 0.05, fmt: pct, hint: 'How quickly the wheel follows your input and centres again.' },
    { k: 'speedSteer', label: 'Steering calm at speed', type: 'range', min: 0.3, max: 1.8, step: 0.05, fmt: pct, hint: 'How much the steering softens as you go faster. Higher is steadier on fast roads, lower keeps it sharp.' },
    { k: 'throttle', label: 'Throttle sensitivity', type: 'range', min: 0.4, max: 1.6, step: 0.05, fmt: pct, hint: 'How hard the car pulls when you press gas.' },
    { k: 'brake', label: 'Brake sensitivity', type: 'range', min: 0.4, max: 1.6, step: 0.05, fmt: pct },
    { type: 'head', label: 'Assists' },
    { k: 'assist', label: 'Drift assist', type: 'toggle', hint: 'Catches a slide before it turns into a spin. Off is looser and less forgiving.' },
    { k: 'handbrake', label: 'Handbrake', type: 'toggle', hint: 'Space or the Drift button locks the rear wheels so the car slides.' },
    { type: 'head', label: 'Ramps' },
    { k: 'roadRamps', label: 'Ramps on the roads', type: 'toggle', hint: 'Jumps set on the straights and the dirt track. Ramps you build stay either way.' },
    { k: 'rampKind', label: 'Ramp to build', type: 'choice', options: RAMP_IDS.map((k) => [k, RAMP_KINDS[k].name]), hint: 'B builds it ahead of the car, T changes the kind, X removes your nearest one.' },
    { type: 'head', label: 'Readout' },
    { k: 'units', label: 'Speed units', type: 'choice', options: [['kmh', 'km/h'], ['mph', 'mph']] },
  ] },
  camera: { label: 'Camera', rows: [
    { k: 'camMode', label: 'View', type: 'choice', options: CAMS.map((n, i) => [i, n]), hint: 'C cycles these. Cinematic cuts between roadside spots as you pass.' },
    { type: 'head', label: 'Chase camera' },
    { k: 'camDist', label: 'Distance', type: 'range', min: 4, max: 16, step: 0.2, fmt: (v) => `${v.toFixed(1)} m` },
    { k: 'camHeight', label: 'Height', type: 'range', min: 1.0, max: 7, step: 0.1, fmt: (v) => `${v.toFixed(1)} m` },
    { k: 'camAim', label: 'Aim point', type: 'range', min: 0.3, max: 2, step: 0.05, fmt: pct, hint: 'Lower looks down at the car, higher looks out over it toward the road ahead.' },
    { k: 'camLag', label: 'Smoothing', type: 'range', min: 0.4, max: 2.5, step: 0.05, fmt: pct, hint: 'Higher lets the camera hang back and swing more through a slide. Lower keeps it locked behind.' },
    { type: 'head', label: 'Lens' },
    { k: 'fov', label: 'Field of view', type: 'range', min: 45, max: 90, step: 1, fmt: (v) => `${v}°` },
    { k: 'camShake', label: 'Speed effects', type: 'toggle', hint: 'Wider view at speed and the camera riding the suspension.' },
    { type: 'head', label: 'Cinematic' },
    { k: 'cineCut', label: 'Distance before a cut', type: 'range', min: 40, max: 160, step: 5, fmt: (v) => `${v} m`, hint: 'How far the car drives away from a roadside camera before it cuts to the next one.' },
  ] },
  graphics: { label: 'Graphics', rows: [
    { k: 'quality', label: 'Quality preset', type: 'choice', options: [['low', 'Low'], ['medium', 'Medium'], ['high', 'High'], ['ultra', 'Ultra'], ['custom', 'Custom']], hint: 'Sets everything below at once. Changing one of them makes it Custom.' },
    { k: '_fps', label: 'Frame rate now', type: 'info', get: () => fpsText(), hint: 'If this drops under about 30, try a lower preset, a lower render resolution or a shorter 3D tree distance.' },
    { k: 'dynRes', label: 'Keep it smooth automatically', type: 'toggle', hint: 'Lowers the render resolution a little when the frame rate drops, and raises it again when there is room.' },
    { type: 'head', label: 'Light' },
    { k: 'shadows', label: 'Shadows', type: 'toggle', g: 1 },
    { k: 'shadowRes', label: 'Shadow detail', type: 'choice', options: [[1024, 'Soft'], [2048, 'Sharp'], [4096, 'Very sharp']], g: 1 },
    { k: 'shadowDist', label: 'Shadow distance', type: 'choice', options: [[40, 'Near'], [60, 'Medium'], [90, 'Far'], [130, 'Very far']], g: 1, hint: 'How far from the car trees and props cast shadows.' },
    { k: 'bloom', label: 'Sun glare', type: 'toggle', g: 1, hint: 'A soft bloom where the sun and its glints are.' },
    { k: 'sunRays', label: 'Sun rays', type: 'toggle', g: 1, hint: 'Shafts of light through the trees and over the ridges when you face a low sun.' },
    { k: 'cloudShadows', label: 'Cloud shadows', type: 'toggle', g: 1, hint: 'Patches of shade drift across the valley on a clear or broken sky.' },
    { k: 'brightness', label: 'Brightness', type: 'range', min: 0.7, max: 1.4, step: 0.05, fmt: pct },
    { type: 'head', label: 'Picture' },
    { k: 'resScale', label: 'Render resolution', type: 'range', min: 0.5, max: 1, step: 0.05, fmt: pct, g: 1, hint: 'Lower is faster and softer.' },
    { k: 'aa', label: 'Smooth edges', type: 'choice', options: [[0, 'Off'], [4, '4x'], [8, '8x']], g: 1, hint: 'Anti-aliasing on the edges of trees, rails and the car.' },
    { k: 'aniso', label: 'Ground texture sharpness', type: 'choice', options: [[2, 'Low'], [4, 'Medium'], [8, 'High'], [16, 'Highest']], g: 1, hint: 'Keeps the road and the gravel crisp when they are far ahead and at a low angle.' },
    { k: 'sharpen', label: 'Sharpen', type: 'toggle', g: 1, hint: 'A light sharpening that brings out the gravel, bark and rock.' },
    { k: 'vivid', label: 'Colour', type: 'range', min: 0.6, max: 1.4, step: 0.05, fmt: pct, hint: 'Lower is quieter and closer to film, higher is richer.' },
    { k: 'lens', label: 'Lens effects', type: 'toggle', g: 1, hint: 'A soft vignette and speed blur when going fast or on nitro.' },
    { type: 'head', label: 'Scenery' },
    { k: 'drawDist', label: 'Draw distance', type: 'range', min: 300, max: 2400, step: 50, fmt: (v) => `${v} m`, g: 1, hint: 'How far away trees are drawn. Shorter adds haze.' },
    { k: 'trees', label: 'Forest density', type: 'range', min: 0.2, max: 1, step: 0.05, fmt: pct, g: 1, hint: 'Pines, tall spruce on the slopes and birch along the river flats.' },
    { k: 'tree3d', label: '3D trees near the road', type: 'toggle', g: 1, hint: 'Trees close to you are full modelled trees with real light, shadow and snow on their branches. Off uses flat cut-outs everywhere.' },
    { k: 'tree3dDist', label: '3D tree distance', type: 'range', min: 40, max: 260, step: 10, fmt: (v) => `${v} m`, g: 1, hint: 'Further looks better and costs more.' },
    { k: 'grass', label: 'Grass density', type: 'range', min: 0, max: 1, step: 0.05, fmt: pct, g: 1 },
    { k: 'sway', label: 'Wind in trees and grass', type: 'toggle', g: 1, hint: 'Trees and grass move in the wind, more in rain and under cloud.' },
    { k: 'birds', label: 'Birds', type: 'toggle', g: 1, hint: 'A few flocks wheeling over the valley in fair weather.' },
    { type: 'head', label: 'Effects' },
    { k: 'dust', label: 'Dust, smoke and spray', type: 'range', min: 0, max: 1.5, step: 0.05, fmt: pct, g: 1 },
    { k: 'weatherAmt', label: 'Weather intensity', type: 'range', min: 0, max: 1.5, step: 0.05, fmt: pct, hint: 'How much rain or snow falls, and how thick the fog gets.' },
    { k: 'rainGlass', label: 'Rain on the windscreen', type: 'toggle', hint: 'Droplets run down the glass in the hood view.' },
  ] },
  world: { label: 'World', rows: [
    { k: 'season', label: 'Season', type: 'choice', options: SEASONS.map((x) => [x, SEASON_NAME[x]]), hint: 'Keys 1 to 3. Snow roads are packed and slippery. Changes settle in over a few seconds.' },
    { k: 'weather', label: 'Weather', type: 'choice', options: WEATHERS.map((x) => [x, WEATHER_NAME[x]]), hint: 'Keys 4 to 8. Rain wets the road and fills the ruts.' },
    { k: 'weatherAmt', label: 'Weather intensity', type: 'range', min: 0, max: 1.5, step: 0.05, fmt: pct, hint: 'How much rain or snow falls, and how thick the fog gets.' },
    { k: 'tod', label: 'Time of day', type: 'choice', options: [['season', 'Afternoon'], ['morning', 'Morning'], ['midday', 'Midday'], ['golden', 'Golden hour'], ['night', 'Night']] },
  ] },
  screen: { label: 'Sound', rows: [
    { k: 'sound', label: 'Sound', type: 'toggle' },
    { k: 'volume', label: 'Master volume', type: 'range', min: 0, max: 1, step: 0.05, fmt: pct },
    { k: 'engineVol', label: 'Engine', type: 'range', min: 0, max: 1.5, step: 0.05, fmt: pct },
    { k: 'sfxVol', label: 'Nitro and landings', type: 'range', min: 0, max: 1.5, step: 0.05, fmt: pct },
    { k: 'ambVol', label: 'Birds, wind and rain', type: 'range', min: 0, max: 1.5, step: 0.05, fmt: pct },
  ] },
  display: { label: 'Screen', rows: [
    { type: 'head', label: 'On screen' },
    { k: 'showMap', label: 'Small map', type: 'toggle' },
    { k: 'showDial', label: 'Speed dial', type: 'toggle' },
    { k: 'showLap', label: 'Lap times', type: 'toggle' },
    { k: 'showSurface', label: 'Surface name', type: 'toggle', hint: 'Asphalt, gravel, dirt, grass or snow under the car.' },
    { k: 'showFps', label: 'Frame rate', type: 'toggle', hint: 'A small counter in the corner of the screen.' },
    { k: 'hudScale', label: 'Screen text size', type: 'range', min: 0.75, max: 1.4, step: 0.05, fmt: pct },
    { type: 'head', label: 'Touch' },
    { k: 'touchShow', label: 'Touch buttons', type: 'choice', options: [['auto', 'Automatic'], ['on', 'Always'], ['off', 'Never']] },
    { k: 'touchSize', label: 'Touch button size', type: 'choice', options: [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']] },
  ] },
  mods: { label: 'Mods', rows: [
    { k: 'infNitro', label: 'Unlimited nitro', type: 'toggle', hint: 'The tank stays full and never drains. Laps driven with it on are not put on the lap board.' },
  ] },
  help: { label: 'Help', rows: [] },
};
const HELP_HTML = `<div class="help">
  <h4>Keyboard</h4>
  <div><kbd>W</kbd> <kbd>A</kbd> <kbd>S</kbd> <kbd>D</kbd> or arrows: gas, steer, brake and reverse</div>
  <div><kbd>Space</kbd> handbrake, for drifting</div>
  <div><kbd>B</kbd> build a ramp ahead, <kbd>T</kbd> change the ramp kind, <kbd>X</kbd> remove your nearest ramp</div>
  <div>In the air: steer to spin, <kbd>W</kbd> front flip, <kbd>S</kbd> backflip, <kbd>Space</kbd> plus steer to barrel roll. Land on your wheels.</div>
  <div><kbd>Shift</kbd> or <kbd>N</kbd> nitro. The tank refills slowly, and faster while you drift</div>
  <div><kbd>1</kbd> to <kbd>3</kbd> season, <kbd>4</kbd> to <kbd>8</kbd> weather, <kbd>V</kbd> vehicle</div>
  <div><kbd>C</kbd> camera, <kbd>M</kbd> map, <kbd>R</kbd> back to the nearest road, <kbd>H</kbd> hide the screen, <kbd>Esc</kbd> settings</div>
  <h4>Xbox / PlayStation controller</h4>
  <div>Connect a controller, focus the game, then press a button. Standard browser mapping is required. Left stick steers; RT / R2 accelerates; LT / L2 brakes and reverses; A / Cross handbrakes; B / Circle boosts; X / Square resets; Y / Triangle changes camera.</div>
  <div>Right stick looks around. LB/RB or L1/R1 cycles vehicles. R3 deploys or packs camp while stopped. D-pad Up builds a ramp; Down changes ramp type. Menu / Options pauses; View / Share opens the map.</div>
  <div>Menus: D-pad or left stick navigates; A / Cross selects; B / Circle returns. On the map, left stick moves the cursor and A / Cross sets a marker; D-pad moves to map buttons. Release the triggers and action buttons after closing a menu. A disconnected controller pauses the game.</div>
  <h4>Touch</h4>
  <div>Arrows bottom left steer. Gas and Brake bottom right; hold Brake when stopped to reverse. Drift is the handbrake. Hold Nitro for a boost; the bar at the bottom shows what is left. Ramp builds a jump ahead of you. In the air, steer to spin and press Gas or Brake to flip.</div>
  <h4>What to do</h4>
  <div>Cruise anywhere. Follow the paved loop through the orange checkpoint banners for a timed lap and a place on the lap board. The dirt track at the signpost climbs toward the ridges. Red squares on the map are ramps; jumps, flips, spins and rolls score stunt points and fill the nitro. Slides score drift points. You can leave the road and drive anywhere in the valley: open the Map to set a marker and a beam shows you where it is.</div>
</div>`;
let setTab = 'vehicle';
const TAB_ICON = {
  vehicle: '<path d="M3 15h18v-3l-3-1-2-4H8l-3 4-2 1z"/><circle cx="7.5" cy="16" r="2"/><circle cx="16.5" cy="16" r="2"/>',
  driving: '<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="2"/><path d="M4.5 10.5h5M14.5 10.5h5M12 14v6"/>',
  camera: '<rect x="3" y="7" width="13" height="10" rx="1"/><path d="m16 11 5-3v8l-5-3"/>',
  graphics: '<path d="M3 19 9 9l4 6 3-4 5 8z"/><circle cx="17" cy="6" r="2"/>',
  world: '<path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6 7 7M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/><circle cx="12" cy="12" r="4"/>',
  screen: '<path d="M4 9v6h4l5 4V5L8 9z"/><path d="M16 9c1.5 1.5 1.5 4.5 0 6M18.5 6.5c3 3 3 8 0 11"/>',
  display: '<rect x="3" y="5" width="18" height="12" rx="1"/><path d="M9 20h6M12 17v3"/>',
  mods: '<path d="M13 3 5 13h6l-1 8 8-10h-6z"/>',
  help: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9.5a2.5 2.5 0 1 1 3.5 2.3c-.7.3-1 .9-1 1.7M12 16.5v.5"/>',
};
const prefVal = (k) => (k === 'season' ? season : k === 'weather' ? weather : k === 'sound' ? soundOn : P[k]);
function drawProfile(cv, id) {
  const g = cv.getContext('2d'); const w = cv.width, h = cv.height; g.clearRect(0, 0, w, h);
  g.strokeStyle = '#1e2226'; g.lineWidth = 2; g.lineJoin = 'round'; g.fillStyle = 'rgba(30,34,38,.08)';
  const shapes = {
    rally: [[10, 34], [14, 24], [34, 22], [48, 12], [86, 11], [98, 20], [100, 34]],
    truck: [[6, 36], [8, 22], [30, 20], [38, 8], [62, 8], [64, 20], [104, 20], [104, 36]],
    sports: [[6, 36], [10, 28], [38, 24], [54, 15], [76, 15], [94, 24], [104, 28], [104, 36]],
    muscle: [[4, 34], [6, 27], [40, 24], [52, 14], [74, 14], [88, 22], [106, 24], [106, 34]],
    buggy: [[8, 30], [14, 24], [36, 22], [46, 8], [72, 8], [92, 18], [104, 20], [102, 30]],
  }[id];
  g.beginPath(); shapes.forEach(([x, y], i) => (i ? g.lineTo(x * w / 110, y * h / 50) : g.moveTo(x * w / 110, y * h / 50))); g.closePath(); g.fill(); g.stroke();
  const big = id === 'truck' || id === 'buggy';
  const wr = big ? 8 : id === 'sports' ? 6 : 6.5; const wy = big ? 37 : 36;
  for (const x of big ? [26, 84] : [26, 82]) { g.beginPath(); g.arc(x * w / 110, wy * h / 50, wr * h / 50, 0, Math.PI * 2); g.fillStyle = '#f2eee6'; g.fill(); g.stroke(); }
  if (id === 'rally') { g.beginPath(); g.moveTo(50 * w / 110, 9 * h / 50); g.lineTo(80 * w / 110, 9 * h / 50); g.stroke(); }
}
function buildSettings() {
  const tabs = $('settabs'); tabs.replaceChildren();
  for (const [id, t] of Object.entries(TABS)) {
    const b = document.createElement('button'); b.dataset.t = id;
    b.innerHTML = `<svg viewBox="0 0 24 24" aria-hidden="true">${TAB_ICON[id] || ''}</svg><span>${t.label}</span>`;
    b.onclick = () => { setTab = id; buildSettings(); $('settabs').querySelector('.on')?.scrollIntoView({ block: 'nearest', inline: 'nearest' }); };
    if (id === setTab) b.className = 'on'; tabs.appendChild(b);
  }
  const bodyEl = $('setbody'); bodyEl.replaceChildren();
  $('setreset').style.display = setTab === 'help' || setTab === 'vehicle' ? 'none' : '';
  if (setTab === 'help') { bodyEl.innerHTML = HELP_HTML; return; }
  for (const r of TABS[setTab].rows) {
    if (r.type === 'head') { const h = document.createElement('div'); h.className = 'shead'; h.textContent = r.label; bodyEl.appendChild(h); continue; }
    const row = document.createElement('div'); row.className = 'srow'; row.dataset.k = r.k;
    const top = document.createElement('div'); top.className = 'top';
    const lab = document.createElement('span'); lab.textContent = r.label; top.appendChild(lab);
    row.appendChild(top);
    if (r.type === 'info') {
      const val = document.createElement('span'); val.className = 'val'; val.dataset.info = r.k; val.textContent = r.get(); top.appendChild(val);
    } else if (r.type === 'range') {
      const val = document.createElement('span'); val.className = 'val'; top.appendChild(val);
      const inp = document.createElement('input'); inp.type = 'range'; inp.min = r.min; inp.max = r.max; inp.step = r.step; inp.value = prefVal(r.k);
      inp.setAttribute('aria-label', r.label); val.textContent = r.fmt(+inp.value);
      inp.oninput = () => { setPref(r.k, +inp.value); val.textContent = r.fmt(+inp.value); };
      row.appendChild(inp);
    } else if (r.type === 'toggle') {
      const sw = document.createElement('button'); sw.className = 'sw' + (prefVal(r.k) ? ' on' : ''); sw.setAttribute('aria-label', r.label); sw.setAttribute('role', 'switch');
      sw.setAttribute('aria-checked', String(!!prefVal(r.k)));
      sw.onclick = () => { setPref(r.k, !prefVal(r.k)); sw.classList.toggle('on', !!prefVal(r.k)); sw.setAttribute('aria-checked', String(!!prefVal(r.k))); };
      top.appendChild(sw);
    } else if (r.type === 'choice') {
      const seg = document.createElement('div'); seg.className = 'opts';
      for (const [v, l] of r.options) {
        const b = document.createElement('button'); b.textContent = l; if (String(prefVal(r.k)) === String(v)) b.className = 'on';
        b.onclick = () => { setPref(r.k, v); refreshSettings(); };
        seg.appendChild(b);
      }
      row.appendChild(seg);
    } else if (r.type === 'vehicles') {
      const list = document.createElement('div'); list.className = 'vcards';
      for (const [id, V] of Object.entries(VEHICLES)) {
        const b = document.createElement('button'); b.className = 'vcard' + (P.vehicle === id ? ' on' : '');
        const cv = document.createElement('div'); cv.className = 'vpic';
        if (V.catalog) {
          const im = new Image(); im.src = `assets/garage/catalog/${id}.webp`;
          im.onerror = () => { im.onerror = null; im.src = `assets/garage/${V.baseModel}.webp`; };
          im.alt = `${V.name} — reference design (drives with the ${V.baseModel} 3D model)`; im.decoding = 'async';
          cv.appendChild(im);

        } else {
          const im = new Image(); im.src = `assets/garage/${id}.webp`; im.alt = V.name; im.decoding = 'async'; im.draggable = false;
          im.onerror = () => { const c = document.createElement('canvas'); c.width = 220; c.height = 100; drawProfile(c, id); cv.replaceChildren(c); };
          cv.appendChild(im);
        }
        if (P.vehicle === id) { const tag = document.createElement('span'); tag.className = 'vtag'; tag.textContent = V.catalog ? 'Driving · 3D stand-in' : 'Driving'; cv.appendChild(tag); }
        const txt = document.createElement('div');
        const bars = Object.entries(V.bars).map(([k, v]) => `<span>${k.toUpperCase()}</span><i><em style="width:${Math.round(v * 100)}%"></em></i>`).join('');
        txt.innerHTML = `<b>${V.name.toUpperCase()}</b><small>${V.desc}</small><div class="bars">${bars}</div>`;
        b.append(cv, txt);
        b.onclick = () => { setPref('vehicle', id); refreshSettings(); };
        list.appendChild(b);
      }
      row.appendChild(list);
    }
    if (r.hint) { const h = document.createElement('div'); h.className = 'hint'; h.textContent = r.hint; row.appendChild(h); }
    bodyEl.appendChild(row);
  }
}
function refreshSettings() { if ($('settings')?.classList.contains('open')) { const st = $('setbody').scrollTop; buildSettings(); $('setbody').scrollTop = st; } }
function setPref(k, v) {
  if (k === 'season') { setSeason(v); return; }
  if (k === 'weather') { setWeather(v); return; }
  if (k === 'sound') { const n = mb?.sound ? mb.sound.set(!!v) : !!v; setSound(n === undefined ? !!v : !!n); if (v) initAudio(); return; }
  if (k === 'vehicle') { selectVehicle(v); mb?.event?.('vehicle', { vehicle: v }); saveSettings(); return; }
  P[k] = v;
  if (k === 'quality' && QUALITY[v]) { Object.assign(P, QUALITY[v]); refreshSettings(); }
  else if (k === 'handling' && HANDLING[v]) { Object.assign(P, HANDLING[v]); refreshSettings(); }
  else if (k in HANDLING.balanced) { if (P.handling !== 'custom') { P.handling = 'custom'; refreshSettings(); } }
  else if (TABS.graphics.rows.some((r) => r.k === k && r.g)) { if (P.quality !== 'custom') { P.quality = 'custom'; refreshSettings(); } }
  if (k === 'camMode') cine.pos = null;
  if (k === 'roadRamps') applyRoadRamps();
  if (k === 'rampKind') refreshBuild();
  applyPrefs();
  saveSettings();
}
let appliedShadow = null, appliedShadowRes = null, appliedAA = null, appliedAniso = null, appliedShDist = null;
let dynK = 1;
const fpsText = () => (fpsAcc.last ? `${Math.round(fpsAcc.last)} fps` + (P.dynRes && dynK < 0.999 ? `, picture at ${Math.round(P.resScale * dynK * 100)}%` : '') : '-');
function applyPixelRatio() {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  renderer.setPixelRatio((software ? 1 : dpr) * P.resScale * (P.dynRes ? dynK : 1));
  renderer.setSize(innerWidth, innerHeight, false);
  if (composer) { composer.setPixelRatio(renderer.getPixelRatio()); composer.setSize(innerWidth, innerHeight); }
  if (lensPass) lensPass.uniforms.uTexel.value.set(1 / (innerWidth * renderer.getPixelRatio()), 1 / (innerHeight * renderer.getPixelRatio()));
}
function applyPrefs() {
  applyPixelRatio();
  if (composer && appliedAA !== P.aa) {
    const n = Math.min(+P.aa || 0, renderer.capabilities.maxSamples || 4);
    for (const rt of [composer.renderTarget1, composer.renderTarget2]) { rt.samples = n; rt.dispose(); }
    appliedAA = P.aa;
  }
  if (appliedAniso !== P.aniso) {
    const a = Math.min(+P.aniso || 1, MAXANI);
    const seen = new Set();
    const setA = (t) => { if (t && t.isTexture && !seen.has(t)) { seen.add(t); if (t.anisotropy !== a) { t.anisotropy = a; t.needsUpdate = true; } } };
    Object.values(TX).forEach(setA); Object.values(U).forEach((u) => setA(u.value));
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { setA(m.map); setA(m.normalMap); }); });
    appliedAniso = P.aniso;
  }
  if (appliedShDist !== P.shadowDist) {
    const d = +P.shadowDist || 60; Object.assign(sun.shadow.camera, { left: -d, right: d, top: d, bottom: -d, far: 400 + d * 4 }); sun.shadow.camera.updateProjectionMatrix(); appliedShDist = P.shadowDist;
  }
  if (appliedShadow !== P.shadows) {
    renderer.shadowMap.enabled = P.shadows; sun.castShadow = P.shadows; appliedShadow = P.shadows;
    scene.traverse((o) => { if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => { m.needsUpdate = true; }); });
  }
  if (appliedShadowRes !== P.shadowRes) {
    sun.shadow.mapSize.set(P.shadowRes, P.shadowRes); if (sun.shadow.map) { sun.shadow.map.dispose(); sun.shadow.map = null; } appliedShadowRes = P.shadowRes;
  }
  if (grass) { const n = Math.floor(grassMax * P.grass); if (n !== grass.count) { grass.count = n; grass.visible = n > 0; updateGrass(S.x, S.z, true); } }
  const showTouch = P.touchShow === 'on' || (P.touchShow === 'auto' && (isTouch || sawTouch));
  document.body.classList.toggle('touch', showTouch);
  document.body.classList.toggle('tsmall', P.touchSize === 'small'); document.body.classList.toggle('tlarge', P.touchSize === 'large');
  document.body.classList.toggle('nohand', !P.handbrake);
  $('hud').style.zoom = P.hudScale;
  $('fps').style.display = P.showFps ? '' : 'none';
  const bc = document.body.classList;
  bc.toggle('nomap', !P.showMap); bc.toggle('nodial', !P.showDial); bc.toggle('nolap', !P.showLap); bc.toggle('nosurf', !P.showSurface);
  if (master) master.gain.value = soundOn ? P.volume : 0;
  envDirty = 1;
  resizeUniforms();
}
function resizeUniforms() {
  const sc = innerHeight * renderer.getPixelRatio() / 2 / Math.tan(camera.fov * Math.PI / 360);
  dustMat.uniforms.scale.value = sc;
}
function openSettings(open) {
  const el = $('settings'); const on = open === undefined ? !el.classList.contains('open') : open;
  el.classList.toggle('open', on); if (on) { buildSettings(); for (const k in keys) keys[k] = 0; }
}
$('setbtn').onclick = (e) => { openSettings(); e.target.blur(); };
$('setclose').onclick = () => openSettings(false);
$('setreset').onclick = () => {
  const d = prefDefaults();
  for (const r of TABS[setTab].rows) {
    if (r.k === 'season') setSeason(tv('season', 'dust'));
    else if (r.k === 'weather') setWeather(tv('weather', 'clear'));
    else if (r.k === 'sound' || r.k === 'vehicle') { /* left alone */ }
    else if (r.k in d) P[r.k] = d[r.k];
  }
  if (setTab === 'graphics') Object.assign(P, QUALITY.high, { quality: 'high' });
  applyPrefs(); saveSettings(); buildSettings();
};

// ---------------------------------------------------------------- laps and leaderboard
const fmt = (t) => { if (t == null) return '-'; const m = Math.floor(t / 60), s = t - m * 60; return `${m}:${s < 10 ? '0' : ''}${s.toFixed(1)}`; };
async function showBoard() {
  const el = $('board'), ol = $('boardlist'); el.style.display = 'block'; ol.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'Loading' }));
  try {
    const rows = (await mb?.leaderboard?.top?.('lap_time', { limit: 10 })) || [];
    ol.replaceChildren();
    if (!rows.length) ol.appendChild(Object.assign(document.createElement('li'), { textContent: 'No laps yet. Follow the paved loop through the three checkpoint banners and back to the start.' }));
    rows.forEach((row) => {
      const li = document.createElement('li'); if (row.mine) li.className = 'mine';
      const who = document.createElement(row.profile_url ? 'a' : 'span'); if (row.profile_url) { who.href = row.profile_url; who.target = '_blank'; }
      who.textContent = row.username || 'guest'; li.append(who, ` ${fmt(row.value)}`); ol.appendChild(li);
    });
  } catch (e) { ol.replaceChildren(Object.assign(document.createElement('li'), { textContent: 'The board could not be read just now.' })); }
}
function lapProgress(q) {
  if (q.road !== 0 || q.d > 30) return;
  const i = q.i, n = NM;
  const prev = S.lastIdx; S.lastIdx = i;
  const hit = (bit, a, b, k) => { if (!(S.cps & bit) && i > n * a && i < n * b) { S.cps |= bit; S.splits[k] = S.lapT; showSplit(k); } };
  hit(1, 0.25, 0.3, 0); hit(2, 0.5, 0.55, 1); hit(4, 0.75, 0.8, 2);
  if (prev > n * 0.9 && i < n * 0.1) { if (S.cps === 7) finishLap(); S.cps = 0; S.splits = []; }
}
function showSplit(k) {
  const b = S.bestSplits?.[k];
  $('split').textContent = b != null ? `${S.splits[k] - b >= 0 ? '+' : '-'}${Math.abs(S.splits[k] - b).toFixed(1)}` : fmt(S.splits[k]);
}
function finishLap() {
  const t = S.lapT; S.last = t; const isBest = S.best == null || t < S.best;
  if (isBest) { S.best = t; S.bestSplits = S.splits.slice(); }
  toast(`Lap ${fmt(t)}`, 3);
  window.mindblown?.run?.end({ seconds: Math.round(t * 10) / 10, lap: S.lap, season, weather, vehicle: P.vehicle, top_kmh: Math.round(S.topSpeed * 3.6) });
  mb?.event?.('lap_done', { value: Math.round(t * 10) / 10, season, weather, vehicle: P.vehicle });
  if (!S.lapMod) mb?.leaderboard?.submit?.('lap_time', Math.round(t * 100) / 100, { lower: true })?.catch?.(() => {});
  else toast(`Lap ${fmt(t)}. Mods on, so it is not on the lap board`, 3);
  saveSettings();
  S.lap++; S.lapT = 0; S.topSpeed = 0; S.lapMod = !!P.infNitro;
  window.mindblown?.run?.start();
}

// ---------------------------------------------------------------- ramps: on the roads, and the ones you build
const RAMPS = [];
function rampProf(K, u) {
  if (K.table) { const L = K.len; if (u < 7) return K.h * smooth(0, 7, u); if (u > L - 7) return K.h * (1 - smooth(L - 7, L, u)); return K.h; }
  if (u <= K.len) return K.h * K.f(u / K.len);
  return K.h * Math.max(0, 1 - (u - K.len) / K.back);
}
function rampY(x, z) {
  let best = -1e9;
  for (let i = 0; i < RAMPS.length; i++) {
    const r = RAMPS[i]; if (r.off) continue;
    const ex = x - r.cx, ez = z - r.cz; if (ex * ex + ez * ez > r.rad2) continue;
    const px = x - r.x, pz = z - r.z, u = px * r.dx + pz * r.dz, v = px * r.dz - pz * r.dx;
    if (u < 0 || u > r.Lt || Math.abs(v) > r.K.w / 2) continue;
    const y = r.y0 + (r.y1 - r.y0) * (u / r.Lt) + rampProf(r.K, u); if (y > best) best = y;
  }
  return best;
}
const rampTopTex = canvasTex(256, 512, (g, w, h) => {
  g.fillStyle = '#b38a58'; g.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) { const y = i * h / 16; g.fillStyle = `rgba(${90 + Math.random() * 40},${60 + Math.random() * 25},30,.35)`; g.fillRect(0, y, w, h / 16); g.fillStyle = 'rgba(40,25,10,.55)'; g.fillRect(0, y, w, 2); }
  for (let i = 0; i < 900; i++) { g.fillStyle = `rgba(60,40,20,${Math.random() * 0.18})`; g.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 30, 1); }
  for (let i = 0; i < 40; i++) { g.fillStyle = 'rgba(30,20,10,.6)'; g.fillRect(Math.random() * w, Math.floor(Math.random() * 16) * h / 16 + 6, 3, 3); }
  const stripe = (x0) => { g.save(); g.beginPath(); g.rect(x0, 0, 22, h); g.clip(); g.fillStyle = '#e8b53a'; g.fillRect(x0, 0, 22, h); g.fillStyle = '#1e2226'; for (let y = -40; y < h + 40; y += 32) { g.beginPath(); g.moveTo(x0, y); g.lineTo(x0 + 22, y + 16); g.lineTo(x0 + 22, y + 30); g.lineTo(x0, y + 14); g.fill(); } g.restore(); };
  stripe(0); stripe(w - 22);
});
const rampSideTex = canvasTex(256, 128, (g, w, h) => {
  g.fillStyle = '#4a4f55'; g.fillRect(0, 0, w, h);
  g.strokeStyle = '#2c3034'; g.lineWidth = 6; g.strokeRect(3, 3, w - 6, h - 6);
  g.beginPath(); g.moveTo(0, h); g.lineTo(w / 2, 0); g.lineTo(w, h); g.stroke();
  for (let i = 0; i < 300; i++) { g.fillStyle = `rgba(120,90,60,${Math.random() * 0.12})`; g.fillRect(Math.random() * w, Math.random() * h, 2 + Math.random() * 6, 2); }
});
const rampTopMat = new T.MeshStandardMaterial({ map: rampTopTex, roughness: 0.85, metalness: 0, side: T.DoubleSide });
const rampSideMat = new T.MeshStandardMaterial({ map: rampSideTex, roughness: 0.6, metalness: 0.4, side: T.DoubleSide });
function buildRampMesh(r) {
  const K = r.K, hw = K.w / 2, us = [];
  if (K.table) for (let i = 0; i <= 32; i++) us.push(K.len * i / 32);
  else { for (let i = 0; i <= 22; i++) us.push(K.len * i / 22); for (let i = 1; i <= 3; i++) us.push(K.len + K.back * i / 3); }
  const top = [], tuv = [], side = [], suv = [];
  const yt = (u) => r.y0 + (r.y1 - r.y0) * (u / r.Lt) + rampProf(K, u) - r.oy;
  const yb = (u) => r.y0 + (r.y1 - r.y0) * (u / r.Lt) - 0.7 - r.oy;
  const quad = (arr, uv, a, b, c, d, ua, ub, uc, ud) => { arr.push(...a, ...b, ...c, ...a, ...c, ...d); uv.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud); };
  for (let i = 0; i < us.length - 1; i++) {
    const u0 = us[i], u1 = us[i + 1], t0 = yt(u0), t1 = yt(u1), b0 = yb(u0), b1 = yb(u1);
    quad(top, tuv, [-hw, t0, u0], [hw, t0, u0], [hw, t1, u1], [-hw, t1, u1], [0, u0 / 4], [1, u0 / 4], [1, u1 / 4], [0, u1 / 4]);
    for (const sx of [-hw, hw]) quad(side, suv, [sx, b0, u0], [sx, b1, u1], [sx, t1, u1], [sx, t0, u0], [u0 / 3, 0], [u1 / 3, 0], [u1 / 3, (t1 - b1) / 3], [u0 / 3, (t0 - b0) / 3]);
  }
  const uE = us[us.length - 1], tE = yt(uE), bE = yb(uE);
  if (tE - bE > 0.75) quad(side, suv, [-hw, bE, uE], [hw, bE, uE], [hw, tE, uE], [-hw, tE, uE], [0, 0], [1, 0], [1, 1], [0, 1]);
  const geo = new T.BufferGeometry();
  const pos = new Float32Array([...top, ...side]), uv = new Float32Array([...tuv, ...suv]);
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('uv', new T.BufferAttribute(uv, 2));
  geo.addGroup(0, top.length / 3, 0); geo.addGroup(top.length / 3, side.length / 3, 1);
  geo.computeVertexNormals();
  const m = new T.Mesh(geo, [rampTopMat, rampSideMat]); m.castShadow = true; m.receiveShadow = true;
  m.position.set(r.x, r.oy, r.z); m.rotation.y = r.yaw;
  return m;
}
function addRamp(kind, x, z, yaw, mine) {
  const K = RAMP_KINDS[kind]; if (!K) return null;
  const Lt = K.len + K.back, dx = Math.sin(yaw), dz = Math.cos(yaw);
  const y0 = baseGroundY(x, z), y1 = baseGroundY(x + dx * Lt, z + dz * Lt);
  const r = { kind, K, x, z, yaw, dx, dz, Lt, y0, y1, oy: Math.min(y0, y1), cx: x + dx * Lt / 2, cz: z + dz * Lt / 2, mine: !!mine };
  r.rad2 = (Lt / 2 + K.w / 2 + 0.5) ** 2;
  r.mesh = buildRampMesh(r); scene.add(r.mesh); RAMPS.push(r);
  return r;
}
function removeRamp(r) { const i = RAMPS.indexOf(r); if (i >= 0) RAMPS.splice(i, 1); scene.remove(r.mesh); r.mesh.geometry.dispose(); }
function buildRoadRamps() {
  const heading = (pts, i) => { const a = pts[i], b = pts[i + 1]; return Math.atan2(b.x - a.x, b.z - a.z); };
  const wrap = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
  const pick = (pts, Y, from, to, gap, max, before, after) => {
    const out = []; let last = -1e9;
    for (let i = from; i < to - after - 1 && out.length < max; i += 4) {
      if (i - last < gap) continue;
      let bend = 0; const h0 = heading(pts, i - before);
      for (let k = -before; k <= after; k += 4) bend = Math.max(bend, Math.abs(wrap(heading(pts, i + k) - h0)));
      if (bend > 0.09 || Math.abs(Y[i + after] - Y[i]) > 5 || Y[i] < WATER + 1) continue;
      out.push(i); last = i;
    }
    return out;
  };
  const main = pick(mainPts, mainY, 90, NM - 30, 170, 4, 20, 45);
  const kinds = ['kicker', 'big', 'launch', 'kicker'];
  main.forEach((i, n) => {
    const f = roadFrame(ROADS[0], i); const side = n % 2 ? -1 : 1;
    const r = addRamp(kinds[n % kinds.length], f.p.x + f.nx * 2.6 * side, f.p.z + f.nz * 2.6 * side, Math.atan2(f.tx, f.tz), false);
    if (r) r.road = true;
  });
  const tr = pick(trailPts, trailY, 40, NT - 10, 120, 3, 12, 25);
  tr.forEach((i) => { const f = roadFrame(ROADS[1], i); const r = addRamp('table', f.p.x - f.tx * 12, f.p.z - f.tz * 12, Math.atan2(f.tx, f.tz), false); if (r) r.road = true; });
  applyRoadRamps();
}
function applyRoadRamps() { for (const r of RAMPS) if (r.road) { r.off = !P.roadRamps; r.mesh.visible = !r.off; } }
let rampsLoaded = false, rampSaveT = null;
function saveRamps() {
  if (!rampsLoaded || !mb?.save) return;
  clearTimeout(rampSaveT);
  rampSaveT = setTimeout(() => {
    const list = RAMPS.filter((r) => r.mine).map((r) => [r.kind, Math.round(r.x * 10) / 10, Math.round(r.z * 10) / 10, Math.round(r.yaw * 1000) / 1000]);
    mb.save('ramps', { schemaVersion: 1, list }).catch(async (e) => { if (e?.reason === 'REVISION_CONFLICT' || e?.reason === 'AUTH_CHANGED' || e?.reason === 'LOAD_FIRST') { try { await mb.load('ramps'); } catch (e2) { /* ignore */ } } });
  }, 1200);
}
async function loadRamps() {
  try {
    const r = await mb?.load?.('ramps'); rampsLoaded = !!mb?.load;
    const v = r?.value; if (v && v.schemaVersion === 1 && Array.isArray(v.list)) for (const [k, x, z, yaw] of v.list.slice(0, 40)) if (RAMP_KINDS[k] && isFinite(x) && isFinite(z) && isFinite(yaw)) addRamp(k, x, z, yaw, true);
  } catch (e) { /* storage unavailable */ }
}
const MAX_MINE = 30;
function placeRamp() {
  if (!S.started) return;
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), d = 12 + Math.max(0, Math.hypot(S.vx, S.vz) * 0.4);
  const x = S.x + fx * d, z = S.z + fz * d;
  if (baseGroundY(x, z) < WATER + 0.3) { toast('Too wet to build there', 1.6); return; }
  if (Math.hypot(x, z) > 1060) { toast('Too close to the edge of the valley', 1.6); return; }
  const mine = RAMPS.filter((r) => r.mine);
  if (mine.length >= MAX_MINE) removeRamp(mine[0]);
  addRamp(P.rampKind, x, z, S.yaw, true);
  toast(`${RAMP_KINDS[P.rampKind].name} built ahead`, 1.4); mb?.event?.('ramp_built', { kind: P.rampKind }); saveRamps(); refreshBuild();
}
function removeNearestRamp() {
  let best = null, bd = 45;
  for (const r of RAMPS) { if (!r.mine) continue; const d = Math.hypot(r.cx - S.x, r.cz - S.z); if (d < bd) { bd = d; best = r; } }
  if (!best) { toast('None of your ramps nearby', 1.4); return; }
  removeRamp(best); toast('Ramp removed', 1.2); saveRamps(); refreshBuild();
}
function clearMyRamps() { for (const r of RAMPS.filter((x) => x.mine)) removeRamp(r); toast('Your ramps are cleared', 1.4); saveRamps(); refreshBuild(); }
function cycleRampKind() { const i = RAMP_IDS.indexOf(P.rampKind); P.rampKind = RAMP_IDS[(i + 1) % RAMP_IDS.length]; toast(`Building: ${RAMP_KINDS[P.rampKind].name}`, 1.4); refreshBuild(); refreshSettings(); saveSettings(); }
function refreshBuild() {
  const el = $('buildkinds'); if (!el) return;
  el.replaceChildren(...RAMP_IDS.map((k) => { const b = document.createElement('button'); b.className = 'btn' + (P.rampKind === k ? ' dark' : ''); b.textContent = RAMP_KINDS[k].name; b.onclick = (e) => { P.rampKind = k; refreshBuild(); saveSettings(); e.target.blur(); }; return b; }));
  $('buildcount').textContent = `${RAMPS.filter((r) => r.mine).length} of ${MAX_MINE} built`;
}

// ---------------------------------------------------------------- air time, stunts and wipeouts
const wrapPi = (a) => a - Math.PI * 2 * Math.round(a / (Math.PI * 2));
let stuntT = 0;
function showStunt(name, line) { $('stuntname').textContent = name; $('stuntpts').textContent = line; $('stunt').style.opacity = 1; stuntT = 2.6; }
function launch(inp, pitch, roll) {
  S.air = true; S.ap = pitch; S.ar = roll; S.apv = -0.3; S.arv = 0; S.airT = 0; S.airMax = 0;
  S.flipAcc = 0; S.rollAcc = 0; S.spinAcc = 0; S.airG = !!inp.g; S.airB = !!inp.b;
}
function scoreStunt() {
  const t = S.airT; if (t < 0.55) return;
  const TAU = Math.PI * 2;
  const flips = Math.floor(Math.abs(S.flipAcc) / TAU + 0.2), rolls = Math.floor(Math.abs(S.rollAcc) / TAU + 0.2), halves = Math.floor(Math.abs(S.spinAcc) / Math.PI + 0.15);
  const parts = []; let pts = Math.round(t * 120 + S.airMax * 30);
  if (flips) { parts.push(`${flips > 1 ? flips + 'x ' : ''}${S.flipAcc > 0 ? 'BACKFLIP' : 'FRONTFLIP'}`); pts += 600 * flips; }
  if (rolls) { parts.push(`${rolls > 1 ? rolls + 'x ' : ''}BARREL ROLL`); pts += 500 * rolls; }
  if (halves) { parts.push(`${halves * 180}`); pts += 200 * halves; }
  if (S.nitroOn) pts = Math.round(pts * 1.2);
  const name = parts.length ? parts.join(' + ') : t > 1.6 ? 'BIG AIR' : 'AIR';
  showStunt(name, `${t.toFixed(1)} s in the air · +${pts}`);
  S.stuntTotal = (S.stuntTotal || 0) + pts; S.nitro = Math.min(1, S.nitro + pts / 2500);
  mb?.event?.('stunt', { value: pts, flips, rolls, spin: halves * 180 });
  if (pts > (S.stuntBest || 0)) { S.stuntBest = pts; mb?.leaderboard?.submit?.('stunt', pts)?.catch?.(() => {}); saveSettings(); }
}
function wipeout() {
  S.air = false; S.crash = 1.7; S.vy = 0;
  showStunt('WIPEOUT', 'Back on your wheels in a moment');
  playSfx('land', 1); mb?.event?.('wipeout');
  for (let i = 0; i < 40; i++) emitDust(S.x + (Math.random() - 0.5) * 2, S.y + 0.3, S.z + (Math.random() - 0.5) * 2, (Math.random() - 0.5) * 4, Math.random() * 3, (Math.random() - 0.5) * 4, 1.4, 2.2, _dc.set(SV.snow > 0.5 ? '#f2f6fa' : '#b9a27e'), 0.4, 3);
}
function poseCar(pitch, roll) {
  car.position.set(S.x, S.y, S.z);
  car.rotation.set(-pitch, S.yaw, roll, 'YXZ');
  body.position.y = S.susp; body.rotation.set(S.bodyPitch, 0, S.bodyRoll);
}
function groundFrame() {
  const nfx = Math.sin(S.yaw), nfz = Math.cos(S.yaw), nrx = -Math.cos(S.yaw), nrz = Math.sin(S.yaw);
  const WB = (carGeom.wb || 2.5) / 2, TRK = (carGeom.trk || 1.56) / 2;
  const yF = groundY(S.x + nfx * WB, S.z + nfz * WB), yB = groundY(S.x - nfx * WB, S.z - nfz * WB);
  const yL = groundY(S.x - nrx * TRK, S.z - nrz * TRK), yR = groundY(S.x + nrx * TRK, S.z + nrz * TRK);
  return { y: (yF + yB + yL + yR) / 4, pitch: Math.atan2(yF - yB, 2 * WB), roll: Math.atan2(yL - yR, 2 * TRK) };
}
function crashStep(dt) {
  S.crash -= dt; const k = Math.exp(-2.5 * dt); S.vx *= k; S.vz *= k; S.w *= k;
  S.x += S.vx * dt; S.z += S.vz * dt;
  const gf = groundFrame(); const up = Math.cos(S.ap) * Math.cos(S.ar);
  S.y = damp(S.y, gf.y + carGeom.h * 0.5 * (1 - up), 10, dt);
  S.nitroOn = false; poseCar(S.ap, S.ar); updateNitroFx(dt);
  if (S.crash <= 0) {
    S.crash = 0; S.ap = S.ar = 0; S.vx = S.vz = S.w = S.vy = 0; S.y = gf.y; S.susp = 0; S.suspV = 0;
    if (gf.y < WATER - 0.6) resetCar(false);
  }
  const sp = Math.hypot(S.vx, S.vz);
  return { vf: sp, speed: sp, sliding: false };
}
function airStep(dt, inp) {
  const G = tv('gravity', 14), air = veh.air || 1;
  S.vy -= G * dt;
  if (!inp.g) S.airG = false; if (!inp.b) S.airB = false;
  const pIn = (inp.b && !S.airB ? 1 : 0) - (inp.g && !S.airG ? 1 : 0);
  const hs = Math.hypot(S.vx, S.vz);
  const traj = Math.atan2(S.vy, Math.max(hs, 1)) * 0.55;
  if (pIn) S.apv += pIn * 9 * air * dt;
  else if (Math.abs(wrapPi(S.ap - traj)) < 0.9) S.apv = damp(S.apv, (traj - wrapPi(S.ap)) * 1.6, 2.4, dt);
  S.apv = clamp(S.apv, -7, 7);
  if (inp.d && inp.st) S.arv += inp.st * 9 * air * dt;
  else if (Math.abs(wrapPi(S.ar)) < 0.7) S.arv = damp(S.arv, -wrapPi(S.ar) * 2, 2.2, dt);
  S.arv = clamp(S.arv, -7, 7);
  S.w = damp(S.w, inp.d ? 0 : -inp.st * 3.6 * air, 3, dt);
  S.yaw += S.w * dt; S.ap += S.apv * dt; S.ar += S.arv * dt;
  S.spinAcc += S.w * dt; S.flipAcc += S.apv * dt; S.rollAcc += S.arv * dt;
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
  const nitroOn = !!inp.n && S.nitro > 0.015;
  if (nitroOn && !S.nitroOn) playSfx('nitro', 0.8);
  S.nitroOn = nitroOn;
  if (nitroOn) { S.vx += fx * 9 * dt; S.vz += fz * 9 * dt; S.nitro = Math.max(0, S.nitro - dt * tv('nitroburn', 0.24)); }
  if (P.infNitro) { S.nitro = 1; S.lapMod = true; }
  const drag = Math.exp(-0.03 * dt); S.vx *= drag; S.vz *= drag;
  S.x += S.vx * dt; S.z += S.vz * dt; S.y += S.vy * dt; S.airT += dt;
  const rad = Math.hypot(S.x, S.z); if (rad > 1100) { const k = 1100 / rad; S.x *= k; S.z *= k; S.vx *= 0.5; S.vz *= 0.5; }
  const gf = groundFrame();
  S.airMax = Math.max(S.airMax, S.y - gf.y);
  S.susp = damp(S.susp, 0.06, 4, dt); S.bodyPitch = damp(S.bodyPitch, 0, 3, dt); S.bodyRoll = damp(S.bodyRoll, 0, 3, dt);
  const vf = S.vx * fx + S.vz * fz;
  const landY = S.airT < 0.3 ? Math.min(gf.y, groundY(S.x, S.z)) - 0.15 : gf.y;
  if (S.y <= landY && S.vy <= 0) {
    const dp = wrapPi(S.ap - gf.pitch), dr = wrapPi(S.ar - gf.roll), impact = -S.vy;
    S.lastAir = { t: +S.airT.toFixed(2), h: +S.airMax.toFixed(1), dp: +dp.toFixed(2) };
    S.y = gf.y;
    if (Math.abs(dp) > 1.0 || Math.abs(dr) > 0.95) { S.ap = gf.pitch + dp; S.ar = gf.roll + dr; wipeout(); return crashStep(dt); }
    S.air = false; S.vy = 0; S.vyS = 0; S.ap = gf.pitch; S.ar = gf.roll; S.apv = S.arv = 0;
    S.suspV -= Math.min(4, impact * 0.22) / Math.sqrt(veh.susp); S.susp -= Math.min(0.12, impact * 0.008);
    const loss = 1 - Math.min(0.25, impact * 0.012 + Math.abs(dp) * 0.15); S.vx *= loss; S.vz *= loss;
    if (impact > 4) playSfx('land', clamp(impact / 14, 0.25, 1));
    const n = Math.min(40, impact * 3);
    for (let i = 0; i < n; i++) emitDust(S.x + (Math.random() - 0.5) * 2.4, S.y + 0.2, S.z + (Math.random() - 0.5) * 3, (Math.random() - 0.5) * 5 - S.vx * 0.1, Math.random() * 2.5, (Math.random() - 0.5) * 5 - S.vz * 0.1, 1.2, 1.6, _dc.set(SV.snow > 0.5 ? '#f2f6fa' : surfName === 'asphalt' ? '#cfcfca' : '#b9a27e'), 0.32, 3);
    scoreStunt();
  }
  poseCar(S.ap, S.ar);
  placeWheels(dt, inp, vf, 1, S.ap, S.ar);
  updateNitroFx(dt);
  S.rpm = damp(S.rpm, inp.g ? 6.8 : 2.6, 3, dt);
  if (actx && engineSrc) engineSrc.playbackRate.setTargetAtTime((0.55 + S.rpm / 7 * 1.15) * (1 + S.nitroFx * 0.14), actx.currentTime, 0.06);
  S.dist += hs * dt; S.sessTop = Math.max(S.sessTop, hs);
  return { vf, speed: hs, sliding: false };
}

// ---------------------------------------------------------------- physics
const tmpQ = {};
function surfaceAt(x, z) {
  const q = nearestRoad(x, z, tmpQ);
  if (q.road >= 0 && q.d < q.hw + 0.25) return { kind: q.road === 0 ? 'asphalt' : 'dirt', y: q.y, q };
  return { kind: 'grass', y: terrainH(x, z), q };
}
function baseGroundY(x, z) { const q = nearestRoad(x, z, tmpQ); if (q.road >= 0 && q.d < q.hw + 0.25) return Math.max(q.y + 0.04, terrainH(x, z)); return terrainH(x, z); }
function groundY(x, z) { const y = baseGroundY(x, z); if (!RAMPS.length) return y; const r = rampY(x, z); return r > y ? r : y; }
const DUSTC = { green: C('#5a4632'), dust: C('#cbb38a'), snow: C('#f4f8fc') };
const _dc = new T.Color();
let surfName = 'asphalt';
// wheels are placed in the car's own frame, so they stay on the ground while the body pitches,
// rolls and bounces above them, and each one follows the ground under it
const _wInv = new T.Matrix4(), _wM = new T.Matrix4(), _wR = new T.Matrix4(), _wP = new T.Vector3(), _wE = new T.Euler(0, 0, 0, 'YXZ'), _wQ = new T.Quaternion(), _wS = new T.Vector3();
function placeWheels(dt, inp, nvf, grip, pitch, roll) {
  if (!vehModel || !wheels.length) return;
  const root = vehModel.root;
  body.updateMatrix(); root.updateMatrix();
  _wInv.multiplyMatrices(body.matrix, root.matrix).invert();
  _wR.makeRotationFromQuaternion(root.quaternion);
  const cy = Math.cos(S.yaw), sy = Math.sin(S.yaw), tp = Math.tan(pitch), tr = Math.tan(roll);
  // front wheels roll with the road; rear wheels lock on the handbrake and spin up on a low-grip launch
  const spinUp = inp.g ? clamp((9 - nvf) / 9, 0, 1) * clamp(1.25 - grip, 0.1, 1) * 7 : 0;
  S.wdF = (S.wdF || 0) + nvf * dt;
  if (!(inp.d && Math.abs(nvf) > 0.5)) S.wdR = (S.wdR || 0) + (nvf + spinUp) * dt;
  const steerA = clamp(-S.steer, -0.62, 0.62);
  for (const w of wheels) {
    w.rest ??= w.node.position.clone();
    _wP.copy(w.rest).applyMatrix4(root.matrix); // rest point in the car frame
    const gx = S.x + cy * _wP.x + sy * _wP.z, gz = S.z - sy * _wP.x + cy * _wP.z;
    const err = groundY(gx, gz) - (S.y + _wP.x * tr + _wP.z * tp);
    w.off = damp(w.off || 0, clamp(err, -0.1, 0.12), 20, dt);
    _wE.set((w.front ? S.wdF : S.wdR) / (w.r || WR_DEF), w.front ? steerA : 0, 0, 'YXZ');
    _wQ.setFromEuler(_wE);
    _wM.compose(_wP.set(_wP.x, _wP.y + w.off, _wP.z), _wQ, _wS.set(1, 1, 1)).multiply(_wR);
    _wM.premultiply(_wInv).decompose(w.node.position, w.node.quaternion, w.node.scale);
  }
}
function physics(dt) {
  if ($('settings').classList.contains('open') || mapOpen() || window.GOAExtension?.isOpen() || window.GOALocations?.isOpen() || window.GOAWildlife?.isOpen() || window.GOACampLife?.isOpen() || window.GOAXR?.isOpen() || $('board').style.display==='block' || window.GOADriveUI?.isOpen()) return {vf:0,speed:Math.hypot(S.vx,S.vz),sliding:false};
  const pad = window.GOAXR?.driveInput?.() || window.GOAController?.input() || {}; // VR controllers drive through the same input
  const inp = S.ctrl && !$('settings').classList.contains('open') && !mapOpen() ? {
    g: Math.max(keys.g || 0, touch.g, pad.throttle || 0), b: Math.max(keys.b || 0, touch.b, pad.brake || 0), d: P.handbrake ? Math.max(keys.d || 0, touch.d, pad.handbrake || 0) : 0,
    st: clamp((Math.max(keys.r || 0, touch.r) - Math.max(keys.l || 0, touch.l)) + (pad.steer || 0), -1, 1), n: Math.max(keys.n || 0, touch.n, pad.nitro || 0),
  } : { g: 0, b: 0, d: 0, st: 0, n: 0 };
  if (S.crash > 0) return crashStep(dt);
  if (S.air) return airStep(dt, inp);
  const sf = surfaceAt(S.x, S.z); surfName = sf.kind;
  const sw = seasonW();
  const onRoad = sf.kind === 'asphalt';
  const surfGrip = onRoad ? veh.grip : sf.kind === 'dirt' ? veh.offGrip * 0.95 : veh.offGrip * 0.82;
  const snowGrip = lerp(1, tv('wintergrip', 0.5) / 0.5 * 0.5, SV.snow) * (onRoad ? 1 : lerp(1, 1.15, SV.snow) * (veh.offGrip > 1 ? 1.2 : 1));
  let grip = surfGrip * snowGrip * W.grip * (1 - sw.dust * 0.04 * (onRoad ? 0 : 1));
  grip = clamp(grip, 0.12, 1.3);
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw), rx = -Math.cos(S.yaw), rz = Math.sin(S.yaw);
  let vf = S.vx * fx + S.vz * fz;
  let vmax = tv('topspeed', 52) / 52 * veh.top * (onRoad ? 1 : veh.offTop * (sf.kind === 'dirt' ? 1 : 0.85)) * lerp(1, 0.85, SV.snow);
  const accel = veh.accel * P.throttle * tv('acceleration', 9) / 9;
  const nitroOn = !!inp.n && S.nitro > 0.015 && vf > -1;
  if (nitroOn && !S.nitroOn) { playSfx('nitro', 0.8); mb?.event?.('nitro'); }
  if (!inp.n && S.nitro < 0.015 && S.nitroOn) toast('Nitro empty. Drift to refill it faster.', 1.8);
  S.nitroOn = nitroOn;
  if (nitroOn) { vmax *= tv('nitropower', 1.4); S.nitro = Math.max(0, S.nitro - dt * tv('nitroburn', 0.24)); }
  else S.nitro = Math.min(1, S.nitro + dt * tv('nitrorefill', 0.03));
  if (P.infNitro) { S.nitro = 1; S.lapMod = true; }
  let a = 0;
  if (Math.abs(vf) > 0.6 || inp.g || inp.b) a -= 9.81 * Math.sin(S.gPitch || 0) * tv('slope', 0.75);
  if (nitroOn) a += (8 + accel * 0.5) * (0.55 + Math.min(1, grip) * 0.45) * clamp((vmax - vf) / 6, 0, 1);
  if (inp.g) a += vf < vmax ? accel * (1 - Math.max(0, vf) / vmax * 0.8) * (0.55 + Math.min(1, grip) * 0.45) : -2;
  if (inp.b) { if (vf > 0.8) a -= 14 * P.brake * (0.4 + Math.min(1, grip) * 0.6) / Math.sqrt(veh.mass); else a -= 5; }
  if (inp.b && vf <= 0.8 && vf < -9) a = 2;
  a -= 0.011 * vf * Math.abs(vf) + (sf.kind === 'grass' ? 0.9 : sf.kind === 'dirt' ? 0.35 : 0.12) * vf * 0.12 / (veh.offGrip > 1 ? 1.8 : 1);
  if (!inp.g && !inp.b) a -= Math.sign(vf) * Math.min(Math.abs(vf) / dt, 0.6);
  if (inp.d) a -= Math.sign(vf) * 3.5 * Math.min(1, Math.abs(vf));
  vf += a * dt;
  if (!inp.g && !inp.b && Math.abs(vf) < 0.05) vf = 0;
  const steerTarget = inp.st * 0.6 / (1 + Math.abs(vf) * P.speedSteer / 22) * tv('steering', 1) * P.steer * veh.steer;
  S.steer = damp(S.steer, steerTarget, (inp.st ? 7 : 10) * P.steerSpeed, dt);
  const L = carGeom.wb || 2.5;
  let wTarget = -S.steer * vf / L;
  const latMax = 9.5 * grip * (inp.d ? 1.4 : 1);
  if (Math.abs(wTarget * vf) > latMax && Math.abs(vf) > 1) wTarget = Math.sign(wTarget) * latMax / Math.abs(vf);
  const dr = tv('drift', 1) * veh.drift;
  if (inp.d && Math.abs(vf) > 6) wTarget *= 1.0 + 0.9 * dr;
  S.w = damp(S.w, wTarget, (inp.d ? 3.5 : 7) * (0.4 + Math.min(1, grip) * 0.6) / Math.sqrt(veh.mass), dt);
  S.yaw += S.w * dt;
  const nfx = Math.sin(S.yaw), nfz = Math.cos(S.yaw), nrx = -Math.cos(S.yaw), nrz = Math.sin(S.yaw);
  const speed = Math.hypot(S.vx, S.vz);
  const vfOld = S.vx * fx + S.vz * fz;
  const wx = S.vx + (vf - vfOld) * fx, wz = S.vz + (vf - vfOld) * fz;
  let nvf = wx * nfx + wz * nfz, nvl = wx * nrx + wz * nrz;
  let reAlign = (inp.d ? 0.9 / dr : 6.5 / (0.5 + 0.5 * dr)) * grip * (Math.abs(nvf) < 3 ? 3 : 1);
  if (P.assist) {
    const sl = Math.atan2(Math.abs(nvl), Math.abs(nvf) + 0.01);
    if (sl > 0.55) reAlign *= 1 + (sl - 0.55) * 6;
    if (!inp.d && sl > 0.2) S.w *= Math.exp(-2.5 * dt);
  } else if (!inp.d) reAlign *= 0.75;
  // tyre side force: fast to bite on a small slip, but capped like real rubber, so a big slide
  // scrubs off over time instead of snapping straight. The side speed it removes is lost to the
  // tyres (only part of it carries into a drift), so turning costs speed instead of adding it.
  const before = Math.abs(nvl), m0 = Math.hypot(nvf, nvl);
  const sideCap = 12.5 * grip * (inp.d ? 0.6 : 1) * (P.assist && before > Math.abs(nvf) * 0.6 ? 1.3 : 1);
  const cut = Math.min(before * (1 - Math.exp(-reAlign * dt)), sideCap * dt);
  nvl -= Math.sign(nvl) * cut;
  if (nvf > 1 && cut > 0) {
    const m1 = Math.hypot(nvf, nvl), keep = inp.d ? 0.45 : 0.25;
    const want = m1 + (m0 - m1) * keep;
    nvf = Math.sign(nvf) * Math.sqrt(Math.max(0, want * want - nvl * nvl));
  }
  S.vx = nfx * nvf + nrx * nvl; S.vz = nfz * nvf + nrz * nvl;
  // trees
  const ck = Math.floor(S.x / 16), cz = Math.floor(S.z / 16);
  for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
    const l = treeHash.get(hkey(ck + i, cz + j)); if (!l) continue;
    for (const t of l) {
      const dx = S.x - t.x, dz = S.z - t.z, d = Math.hypot(dx, dz), rr = 1.25 + t.h * 0.015;
      if (d < rr && d > 0.001) {
        const nx = dx / d, nz = dz / d; S.x = t.x + nx * rr; S.z = t.z + nz * rr;
        const vn = S.vx * nx + S.vz * nz; if (vn < 0) { S.vx -= vn * nx * 1.4; S.vz -= vn * nz * 1.4; S.vx *= 0.6; S.vz *= 0.6; }
      }
    }
  }
  S.x += S.vx * dt; S.z += S.vz * dt; S.dist += speed * dt; S.sessTop = Math.max(S.sessTop, speed);
  const rad = Math.hypot(S.x, S.z);
  if (rad > 1100) { const k = 1100 / rad; S.x *= k; S.z *= k; S.vx *= 0.5; S.vz *= 0.5; }
  const gy = groundY(S.x, S.z);
  if (gy < WATER - 0.6) { toast('Too deep. Back to the road.', 1.6); resetCar(false); return null; }
  const WB = (carGeom.wb || 2.5) / 2, TRK = (carGeom.trk || 1.56) / 2;
  const yF = groundY(S.x + nfx * WB, S.z + nfz * WB), yB = groundY(S.x - nfx * WB, S.z - nfz * WB);
  const yL = groundY(S.x - nrx * TRK, S.z - nrz * TRK), yR = groundY(S.x + nrx * TRK, S.z + nrz * TRK);
  const gyAvg = (yF + yB + yL + yR) / 4;
  const pitch = Math.atan2(yF - yB, 2 * WB), roll = Math.atan2(yL - yR, 2 * TRK);
  const G = tv('gravity', 14), vyG = (gyAvg - S.y) / Math.max(dt, 1e-4), ay = (vyG - S.vy) / Math.max(dt, 1e-4);
  S.vyS = damp(S.vyS || 0, clamp(vyG, -40, 40), 20, dt);
  if (S.started && S.vyS > 2 && ay < -G * 1.5 && speed > 5 && groundY(S.x + S.vx * 0.15, S.z + S.vz * 0.15) < gyAvg + S.vyS * 0.15 - G * 0.011 - 0.08) { launch(inp, pitch, roll); S.vy = S.vyS - G * dt; S.y += S.vy * dt; }
  else { S.vy = clamp(vyG, -40, 40); S.y = gyAvg; }
  S.gPitch = pitch;
  const rough = sf.kind === 'grass' ? 0.06 : sf.kind === 'dirt' ? 0.035 : 0.004;
  const kick = (Math.random() - 0.5) * rough * Math.min(1, Math.abs(nvf) / 15) * 60 * veh.susp;
  S.suspV += (-S.susp * 120 / veh.susp - S.suspV * 13 + kick) * dt; S.susp += S.suspV * dt;
  const longA = (nvf - S.prevV) / Math.max(dt, 1e-3); S.prevV = nvf;
  S.bodyPitch = damp(S.bodyPitch, clamp(longA * 0.0065 * veh.roll, -0.07, 0.07), 6, dt);
  S.bodyRoll = damp(S.bodyRoll, clamp(S.w * nvf * 0.005 * veh.roll, -0.1, 0.1), 5, dt);
  car.position.set(S.x, S.y, S.z);
  car.rotation.set(-pitch, S.yaw, roll, 'YXZ');
  body.position.y = S.susp; body.rotation.set(S.bodyPitch, 0, S.bodyRoll);
  placeWheels(dt, inp, nvf, grip, pitch, roll);
  updateNitroFx(dt);
  // drift
  const slip = Math.atan2(Math.abs(nvl), Math.abs(nvf) + 0.01);
  const sliding = speed > 7 && slip > 0.16;
  if (sliding && nvf > 0) { S.driftT += dt; S.driftScore += speed * slip * dt * 10; S.nitro = Math.min(1, S.nitro + speed * slip * dt * 0.004); }
  else if (S.driftT > 0) {
    if (S.driftScore > 40 && S.driftScore > S.driftBest) { S.driftBest = Math.round(S.driftScore); mb?.event?.('drift', { value: S.driftBest }); saveSettings(); }
    S.driftT = 0; S.driftScore = 0;
  }
  const dEl = $('drift'); dEl.style.opacity = S.driftScore > 25 ? 1 : 0;
  if (S.driftScore > 25) dEl.textContent = `DRIFT ${Math.round(S.driftScore)}`;
  // what the tyres throw up
  const pcount = tv('particles', 1) * P.dust;
  const offroad = !onRoad;
  const wetGround = W.wet > 0.4 && SV.snow < 0.5;
  for (const sx of [-1, 1]) {
    const wx2 = S.x - nfx * WB + nrx * TRK * sx, wz2 = S.z - nfz * WB + nrz * TRK * sx;
    const wy = groundY(wx2, wz2);
    const emit = (rate, col, size, life, alpha, up, grow, spark, heavy, spread) => {
      let n = rate * pcount * dt; while (n > 0) {
        if (Math.random() < n) emitDust(wx2 + (Math.random() - 0.5) * 0.5, wy + 0.15, wz2 + (Math.random() - 0.5) * 0.5,
          -S.vx * (heavy ? 0.35 : 0.12) + (Math.random() - 0.5) * spread - nvl * 0.25 * nrx, up * (0.6 + Math.random() * 0.8), -S.vz * (heavy ? 0.35 : 0.12) + (Math.random() - 0.5) * spread - nvl * 0.25 * nrz,
          size * (0.7 + Math.random() * 0.6), life * (0.7 + Math.random() * 0.6), col, alpha, grow, spark, heavy);
        n -= 1;
      }
    };
    const spd = Math.min(1, speed / 22);
    if (offroad && speed > 2) {
      if (SV.snow > 0.5) emit((30 * spd + (sliding ? 40 : 0)), _dc.copy(DUSTC.snow), 0.9, 1.6, 0.55, 1.8, 2.6, 1, 0, 2.2);
      else if (wetGround || sw.green > 0.5) {
        emit((16 * spd + (sliding ? 25 : 0)), _dc.copy(DUSTC.green), 0.14, 0.9, 0.9, 3.2, 0.2, 0, 1, 2.5); // clods
        emit((8 * spd + (sliding ? 10 : 0)), _dc.copy(DUSTC.green).lerp(C('#8a7a60'), 0.5), 0.9, 1.0, 0.18, 0.6, 2, 0, 0, 1.2);
      } else emit((36 * spd + (sliding ? 40 : 0)), _dc.copy(DUSTC.dust), 1.5, 5.5 * (0.8 + sw.dust * 0.6), 0.28, 1.0, 4.5, 0, 0, 1.6); // big slow plumes
    } else if (onRoad && sliding) {
      emit(42 * Math.min(1, slip * 2), _dc.set(SV.snow > 0.5 ? '#f2f6fa' : '#d9d9d6'), 1.1, 2.6, wetGround ? 0.16 : 0.38, 0.7, 3, SV.snow > 0.5 ? 1 : 0, 0, 1.4);
    } else if (onRoad && wetGround && speed > 10) {
      emit(speed * 1.4, _dc.set('#d1d7dc'), 0.6, 0.7, 0.3, 0.5, 2, 0, 0, 1.0);
    } else if (onRoad && SV.snow > 0.5 && speed > 12) {
      emit(speed * 0.7, _dc.set('#ffffff'), 0.5, 0.9, 0.35, 0.7, 2, 1, 0, 1.0);
    }
    markGap = Math.max(2.5, speed * dt * 1.6 + 0.6);
    const markCol = offroad ? (SV.snow > 0.5 ? _c3.set('#b4c0ce') : sw.green > 0.5 || wetGround ? _c3.set('#5a4a38') : _c3.set('#7d6a4e')) : (SV.snow > 0.5 ? _c3.set('#7c8794') : _c3.set('#121212'));
    if ((sliding && speed > 6) || (offroad && speed > 1.5)) markAt(sx > 0 ? 0 : 1, wx2, wy + 0.03, wz2, S.yaw, markCol, offroad ? 0.95 : 1);
    else lastMark[sx > 0 ? 0 : 1] = null;
  }
  // dirt builds up off the tarmac and washes off slowly in rain
  if (offroad && speed > 3) carU.uDirt.value = Math.min(1, carU.uDirt.value + dt * 0.012 * spdK(speed));
  if (W.rain > 0.5) carU.uDirt.value = Math.max(0, carU.uDirt.value - dt * 0.004);
  carU.uDirtCol.value.copy(DUSTC.green).lerp(DUSTC.dust, sw.dust).lerp(C('#dfe6ee'), sw.snow);
  if (sf.q.road >= 0) lapProgress(sf.q);
  const fwdDot = sf.q.road === 0 ? (nfx * sf.q.tx + nfz * sf.q.tz) : 1;
  S.topSpeed = Math.max(S.topSpeed, speed);
  if (sf.q.road < 0) { S.farT = (S.farT || 0) + dt; } else S.farT = 0;
  if (S.farT > 25 && S.farT < 31) note('Off road. The whole valley is open: M opens the map, R returns to the road.');
  else if (Math.hypot(S.x, S.z) > 1080) note('Edge of the valley');
  else if (sf.q.road === 0 && fwdDot < -0.5 && nvf > 6) note('Wrong way for the lap clock');
  else note('');
  // gears and revs, for the dial and the engine
  const v = Math.abs(nvf), top = veh.top * 1.05; const R = [0, 0.18, 0.34, 0.5, 0.68, 0.85, 1.02];
  let g = 1; while (g < 6 && v > R[g] * top) g++;
  const lo = R[g - 1] * top, hi = R[g] * top;
  const target = nvf < -0.5 ? 2.5 + v / 10 * 3 : v < 0.3 && !inp.g ? 0.9 : 1.6 + clamp((v - lo) / Math.max(1, hi - lo), 0, 1) * 5.2 + (inp.g && v < 2 ? 2 : 0);
  S.rpm = damp(S.rpm, target, 8, dt); S.gear = nvf < -0.5 ? 'R' : v < 0.3 && !inp.g ? 'N' : g;
  if (actx && engineSrc) {
    engineSrc.playbackRate.setTargetAtTime((0.55 + S.rpm / 7 * 1.15) * (1 + S.nitroFx * 0.14), actx.currentTime, 0.06);
    engineGain.gain.setTargetAtTime((0.2 + (inp.g ? 0.16 : 0) + Math.min(0.2, speed / 200)) * P.engineVol, actx.currentTime, 0.1);
    const birds = (sw.green * 0.55 + sw.dust * 0.35) * (1 - W.over * 0.8) * (1 - W.rain);
    birdsGain.gain.setTargetAtTime(birds * P.ambVol, actx.currentTime, 0.5);
    windGain.gain.setTargetAtTime((0.06 + sw.snow * 0.22 + W.snow * 0.2 + Math.min(0.35, speed / 120)) * P.ambVol, actx.currentTime, 0.4);
    rainGain.gain.setTargetAtTime(W.rain * 0.35 * P.ambVol, actx.currentTime, 0.6);
  }
  return { vf: nvf, speed, sliding };
}
const spdK = (s) => Math.min(1.5, s / 15);

// ---------------------------------------------------------------- camera
const camPos = new T.Vector3(), camLook = new T.Vector3(), camLookS = new T.Vector3();
const cine = { pos: null, look: new T.Vector3(), t: 0 };
function pickCinePoint() {
  const q = nearestRoad(S.x, S.z, q2); const sp = Math.hypot(S.vx, S.vz);
  let x, z;
  if (q.road >= 0) {
    const R = ROADS[q.road]; const n = R.pts.length;
    const dirSign = (S.vx * q.tx + S.vz * q.tz) >= 0 ? 1 : -1;
    let i = q.i + dirSign * Math.round(30 + Math.random() * 25); i = R.closed ? (i + n) % n : clamp(i, 0, n - 1);
    const f = roadFrame(R, i); const side = Math.random() < 0.5 ? -1 : 1; const off = R.hw + 6 + Math.random() * 10;
    x = f.p.x + f.nx * off * side; z = f.p.z + f.nz * off * side;
  } else {
    const ux = sp > 1 ? S.vx / sp : Math.sin(S.yaw), uz = sp > 1 ? S.vz / sp : Math.cos(S.yaw);
    x = S.x + ux * 60 + uz * 12; z = S.z + uz * 60 - ux * 12;
  }
  cine.pos = new T.Vector3(x, groundY(x, z) + 1.4 + Math.random() * 3, z);
}
let padLookX = 0, padLookY = 0;
function updateCamera(dt, snap) {
  const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
  const sp = Math.hypot(S.vx, S.vz);
  let dx = fx, dz = fz; if (sp > 3) { const ux = S.vx / sp, uz = S.vz / sp; dx = lerp(fx, ux, 0.35); dz = lerp(fz, uz, 0.35); const l = Math.hypot(dx, dz); dx /= l; dz /= l; }
  const aspect = innerWidth / innerHeight;
  camera.fov = (aspect < 1 ? P.fov + 16 : P.fov) + (P.camShake ? Math.min(8, sp * 0.12) : 0) + S.nitroFx * 11;
  camera.updateProjectionMatrix();
  let dist = P.camDist * (VEHICLES[P.vehicle].len / 4) * (1 + S.nitroFx * 0.1), h = P.camHeight * (carGeom.h / 1.5);
  if (aspect < 1) { dist *= 1.3; h *= 1.25; }
  if (P.camMode === 1) { dist *= 1.8; h *= 1.9; }
  if (P.camMode === 2) {
    camPos.set(S.x + fx * 0.4, S.y + carGeom.h * 0.92 + (P.camShake ? body.position.y : 0), S.z + fz * 0.4);
    camLook.set(S.x + fx * 20, S.y + 1.0, S.z + fz * 20); camLookS.copy(camLook);
  } else if (P.camMode === 3) {
    if (!cine.pos || cine.pos.distanceTo(car.position) > P.cineCut || snap) pickCinePoint();
    camPos.copy(cine.pos);
    camLook.set(S.x, S.y + 0.8, S.z);
    camLookS.lerp(camLook, snap ? 1 : 1 - Math.exp(-5 * dt));
    if (camPos.distanceTo(car.position) < 3) pickCinePoint();
  } else {
    const target = new T.Vector3(S.x - dx * dist, S.y + h, S.z - dz * dist);
    const gy = groundY(target.x, target.z) + 0.9; if (target.y < gy) target.y = gy;
    if (snap) camPos.copy(target); else camPos.lerp(target, 1 - Math.exp(-4.5 / P.camLag * dt));
    const g2 = groundY(camPos.x, camPos.z) + 0.7; if (camPos.y < g2) camPos.y = g2;
    camLook.set(S.x + fx * 3.5 * P.camAim, S.y + carGeom.h * 0.65 * P.camAim, S.z + fz * 3.5 * P.camAim);
    if (snap) camLookS.copy(camLook); else camLookS.lerp(camLook, 1 - Math.exp(-8 / P.camLag * dt));
  }
  if (S.inspect != null) { const a = S.yaw + S.inspect; camPos.set(S.x + Math.sin(a) * 5.5, S.y + 1.3, S.z + Math.cos(a) * 5.5); camLookS.set(S.x, S.y + 0.6, S.z); }
  camera.position.copy(camPos); camera.lookAt(camLookS);
  const padLook=window.GOAController?.input() || {};
  padLookX=damp(padLookX,padLook.lookX||0,9,dt); padLookY=damp(padLookY,padLook.lookY||0,9,dt);
  camera.rotateY(-padLookX*1.35); camera.rotateX(-padLookY*.55);
}

// ---------------------------------------------------------------- environment, eased every frame
const TOD = {
  morning: { elev: 13, az: 0.3, sun: C('#ffd9b4'), i: 0.85, hor: C('#ecdccd'), top: C('#7799c4'), horK: 0.5 },
  midday: { elev: 62, az: 1.4, sun: C('#fff8ec'), i: 1.08, hor: C('#d0dce6'), top: C('#5a8fd0'), horK: 0.4 },
  golden: { elev: 5, az: 2.6, sun: C('#ffa860'), i: 0.75, hor: C('#f0c08e'), top: C('#5f7aa6'), horK: 0.75 },
  night: { elev: 24, az: 3.6, sun: C('#7f97d6'), i: 0.16, hor: C('#2a3550'), top: C('#070b16'), horK: 0.6 }, // moonlight, used by Survival
};
const sunDir = new T.Vector3(); const _sunP = new T.Vector3(), _camD = new T.Vector3();
const live = { top: new T.Color('#6f9ccc'), hor: new T.Color('#c9d6e0'), sun: new T.Color('#ffe2bd'), sunI: 3, elev: 20, az: 2.45, fog: 520, cap: 0.9, hemiS: new T.Color(), hemiG: new T.Color() };
const _t1 = new T.Color(), _t2 = new T.Color(), _hor = new T.Color(), _sky = new T.Color();
let envInit = false, lastEnvSig = '';
function blendSeason(key, out) {
  const w = seasonW(); out.setRGB(0, 0, 0);
  for (const s of SEASONS) out.r += SP[s][key].r * w[s], out.g += SP[s][key].g * w[s], out.b += SP[s][key].b * w[s];
  return out;
}
const blendSeasonN = (key) => { const w = seasonW(); return SEASONS.reduce((a, s) => a + SP[s][key] * w[s], 0); };
function updateEnv(dt, time) {
  const k = envInit ? 1 - Math.exp(-1.2 * dt) : 1;
  // seasons settle in over a few seconds
  const tg = SEASON_TARGET[season]; const sk = envInit ? Math.min(1, dt * 1.6) : 1;
  SV.dry = lerp(SV.dry, tg.dry, sk); SV.snow = lerp(SV.snow, tg.snow, sk);
  if (Math.abs(SV.dry - tg.dry) < 0.002) SV.dry = tg.dry; if (Math.abs(SV.snow - tg.snow) < 0.002) SV.snow = tg.snow;
  envInit = true;
  const sw = seasonW();
  U.uDry.value = SV.dry; U.uSnow.value = smooth(0, 1, SV.snow); U.uTime.value = time;
  U.kSnow.value = smooth(0.4, 1, SV.snow); U.kGreen.value = smooth(0.5, 1, sw.green); U.kDust.value = smooth(0.5, 1, sw.dust);
  U.uSnowline.value = lerp(400, 500, sw.dust);
  U.uDustCol.value.copy(DUSTC.dust);
  const wp = WP[weather];
  for (const f of ['over', 'cloud', 'fogM', 'cap', 'wet', 'rain', 'snow', 'grip', 'sunM']) W[f] = lerp(W[f], wp[f], k);
  W.grey.lerp(wp.grey, k);
  U.uWet.value = W.wet; U.uPuddle.value = smooth(0.4, 1, W.wet);
  const td = TOD[P.tod];
  blendSeason('top', _t1); live.top.lerp(td ? _t1.lerp(td.top, td.horK * 0.7) : _t1, k);
  blendSeason('hor', _t1); live.hor.lerp(td ? _t1.lerp(td.hor, td.horK) : _t1, k);
  blendSeason('sun', _t1); live.sun.lerp(td ? td.sun : _t1, k);
  blendSeason('hemiS', _t1); live.hemiS.lerp(_t1, k); blendSeason('hemiG', _t1); live.hemiG.lerp(_t1, k);
  live.sunI = lerp(live.sunI, blendSeasonN('sunI') * (td ? td.i : 1), k);
  live.elev = lerp(live.elev, td ? td.elev : blendSeasonN('elev'), k); live.az = lerp(live.az, td ? td.az : blendSeasonN('az'), k);
  live.fog = lerp(live.fog, blendSeasonN('fog'), k); live.cap = lerp(live.cap, blendSeasonN('cap'), k);
  const el = live.elev * Math.PI / 180;
  sunDir.set(Math.cos(el) * Math.cos(live.az), Math.sin(el), Math.cos(el) * Math.sin(live.az));
  _hor.copy(live.hor).lerp(W.grey, W.over * 0.8);
  _sky.copy(live.top).lerp(W.grey, W.over);
  const su = skyMat.uniforms;
  su.top.value.copy(live.top); su.hor.value.copy(_hor);
  su.grey.value.copy(W.grey); su.over.value = W.over; su.cover.value = W.cloud;
  su.sunDir.value.copy(sunDir); su.sunCol.value.copy(live.sun); su.time.value = time; su.sunVis.value = 1 - W.over * 0.95;
  su.ground.value.copy(live.hemiG).multiplyScalar(0.6);
  sky.position.copy(cameraWorldPosition());
  const fogMul = 1 + (W.fogM - 1) * Math.min(1, P.weatherAmt);
  let dens = live.fog * fogMul;
  if (P.drawDist < 1300) dens = Math.max(dens, 1.15e6 / P.drawDist);
  scene.fog.color.copy(_hor); scene.fog.near = dens; scene.fog.far = Math.min(1, live.cap + W.cap * 10);
  sun.color.copy(live.sun); sun.intensity = live.sunI * W.sunM;
  const cx = S.x, cz = S.z;
  sun.position.set(cx + sunDir.x * 250, S.y + sunDir.y * 250, cz + sunDir.z * 250); sun.target.position.set(cx, S.y, cz);
  hemi.color.copy(live.hemiS).lerp(W.grey, W.over * 0.5); hemi.groundColor.copy(live.hemiG); hemi.intensity = 0.62 + W.over * 0.65;
  scene.environmentIntensity = 0.48 + W.over * 0.35;
  // Survival nights: darken the sky, ambient and fog together (sunlight alone is not enough)
  live.night = lerp(live.night || 0, P.tod === 'night' ? 1 : 0, k);
  if (live.night > 0.001) {
    const nk = live.night;
    hemi.intensity *= 1 - 0.88 * nk; scene.environmentIntensity *= 1 - 0.9 * nk; sun.intensity *= 1 - 0.5 * nk;
    su.top.value.lerp(TOD.night.top, nk); su.hor.value.lerp(TOD.night.hor, nk * 0.9); su.sunVis.value *= 1 - nk * 0.9;
    scene.fog.color.lerp(TOD.night.hor, nk * 0.9); hemi.color.lerp(TOD.night.hor, nk * 0.5);
  }
  renderer.toneMappingExposure = (1.0 + W.over * 0.18 + (P.tod === 'golden' ? 0.1 : 0)) * P.brightness * (1 - 0.42 * (live.night || 0));
  TREE_TINT.value.set(lerp(1, 1.08, sw.dust), lerp(1, 1.0, sw.dust), lerp(1, 0.86, sw.dust)).multiplyScalar(1 - W.wet * 0.15);
  GRASS_TINT.value.set(lerp(0.46, 1.08, sw.dust), lerp(0.86, 0.98, sw.dust), lerp(0.32, 0.78, sw.dust)).multiplyScalar(lerp(1, 0.92, sw.snow) * (1 - W.wet * 0.15));
  GRASS_HIDE.value = smooth(0.15, 0.8, SV.snow) * 0.985;
  BIRCH_TINT.value.copy(TREE_TINT.value).multiplyScalar(lerp(1, 1.06, sw.snow));
  TREE_HIDE.value = 1 - P.trees;
  // cloud shadows: patches of shade drift with the wind on a clear or broken sky; gone under full cloud
  U.uCloudSh.value = P.cloudShadows ? 0.62 * clamp(W.sunM * 1.15, 0, 1) * (1 - W.over * 0.7) : 0;
  U.uCloudCov.value = 0.6 - W.cloud * 0.18;
  U.uCloudOff.value.set(-time * windV.x * 4.5, -time * windV.z * 4.5);
  SWAY.value = P.sway ? 0.7 + W.over * 0.6 + W.rain * 0.7 + W.snow * 0.3 : 0;
  waterMat.color.copy(C('#365e59')).lerp(C('#a6c1cc'),smooth(.6,1,SV.snow));waterMat.roughness=lerp(.14,.48,smooth(.6,1,SV.snow));waterMat.normalScale.setScalar(lerp(.1,.018,SV.snow)+W.rain*.14);waterMat.envMapIntensity=.85;
  const dim = Math.max(1 - W.sunM, P.tod === 'golden' ? 0.6 : 0);
  headLight.intensity = dim > 0.5 ? 70 * dim : 0;
  const lightK = 0.45 + 0.55 * W.sunM;
  dustMat.uniforms.light.value = lightK + 0.2; dustMat.uniforms.sunCol.value.copy(live.sun); dustMat.uniforms.time.value = time;
  if (bloomPass) bloomPass.strength = 0.14 * (1 - W.over * 0.8);
  // precipitation
  const pc = tv('particles', 1) * P.weatherAmt;
  const view=cameraWorldPosition();const ccx = view.x, ccy = view.y, ccz = view.z;
  windV.set(1.4 + W.over * 3, 0, 0.6 + W.over);
  const sc = innerHeight * renderer.getPixelRatio() / 2 / Math.tan(camera.fov * Math.PI / 360);
  for (const Pp of [rain, snowfall]) { const u = Pp.material.uniforms; u.time.value = time; u.center.value.set(ccx, ccy, ccz); u.scale.value = sc; u.light.value = lightK + 0.3; u.wind.value.copy(windV); }
  rain.material.uniforms.alpha.value = W.rain * pc; rain.visible = W.rain * pc > 0.01;
  snowfall.material.uniforms.alpha.value = Math.min(1, W.snow * pc); snowfall.visible = W.snow * pc > 0.01;
  waterN.offset.x = time * 0.004; waterN.offset.y = time * 0.0025;
  skidTime.value = time;
  // environment light from the sky, rebuilt while it changes
  envTimer -= dt;
  const sig = [season, weather, P.tod, Math.round(SV.snow * 20), Math.round(SV.dry * 20), Math.round(W.over * 20)].join();
  if ((sig !== lastEnvSig || envDirty) && envTimer <= 0) { lastEnvSig = sig; envDirty = 0; envTimer = 0.4; rebuildEnv(); }
  // hood camera rain on the glass
  rainFx(dt, P.camMode === 2 && P.rainGlass ? W.rain : 0);
}

// droplets on the windscreen in the hood view
const rfx = $('rainfx'); const rctx = rfx.getContext('2d'); const drops = [];
function rainFx(dt, amt) {
  rfx.style.opacity = amt > 0.05 ? 1 : 0;
  if (amt < 0.05 && !drops.length) return;
  if (rfx.width !== innerWidth || rfx.height !== innerHeight) { rfx.width = innerWidth; rfx.height = innerHeight; }
  rctx.clearRect(0, 0, rfx.width, rfx.height);
  if (Math.random() < amt * dt * 30) drops.push({ x: Math.random() * rfx.width, y: Math.random() * rfx.height * 0.8, r: 2 + Math.random() * 6, v: 0, life: 4 + Math.random() * 4 });
  for (let i = drops.length - 1; i >= 0; i--) {
    const d = drops[i]; d.life -= dt; if (d.r > 5) d.v += dt * 40; d.y += d.v * dt;
    if (d.life <= 0 || d.y > rfx.height + 20) { drops.splice(i, 1); continue; }
    const a = Math.min(1, d.life) * 0.5;
    const g = rctx.createRadialGradient(d.x - d.r * 0.3, d.y - d.r * 0.3, 0, d.x, d.y, d.r);
    g.addColorStop(0, `rgba(255,255,255,${a})`); g.addColorStop(0.7, `rgba(200,210,220,${a * 0.35})`); g.addColorStop(1, 'rgba(120,130,140,0)');
    rctx.fillStyle = g; rctx.beginPath(); rctx.ellipse(d.x, d.y, d.r * 0.8, d.r, 0, 0, Math.PI * 2); rctx.fill();
    if (d.v > 0) { rctx.strokeStyle = `rgba(220,228,236,${a * 0.4})`; rctx.lineWidth = d.r * 0.4; rctx.beginPath(); rctx.moveTo(d.x, d.y - d.r); rctx.lineTo(d.x, d.y - d.r - d.v * 0.4); rctx.stroke(); }
  }
  if (drops.length > 160) drops.splice(0, drops.length - 160);
}

// ---------------------------------------------------------------- HUD: dial, map, cards
const dialEl = $('dial');
(function buildDial() {
  const A0 = -225, A1 = 45, R = 84, cx = 100, cy = 100;
  const pt = (a, r) => [cx + Math.cos(a * Math.PI / 180) * r, cy + Math.sin(a * Math.PI / 180) * r];
  let s = '<svg viewBox="0 0 200 200">';
  for (let i = 0; i <= 8; i++) {
    const a = A0 + (A1 - A0) * i / 8; const [x1, y1] = pt(a, R); const [x2, y2] = pt(a, R - 10); const [tx, ty] = pt(a, R - 22);
    s += `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#1e2226" stroke-width="2"/>`;
    s += `<text x="${tx}" y="${ty + 5}" font-size="14" font-weight="600" text-anchor="middle" fill="#1e2226" font-family="Valley, sans-serif">${i}</text>`;
    if (i < 8) for (let j = 1; j < 4; j++) { const b = A0 + (A1 - A0) * (i + j / 4) / 8; const [a1, b1] = pt(b, R); const [a2, b2] = pt(b, R - 5); s += `<line x1="${a1}" y1="${b1}" x2="${a2}" y2="${b2}" stroke="#1e2226" stroke-width="1"/>`; }
  }
  const arc = (from, to, r) => { const [x1, y1] = pt(A0 + (A1 - A0) * from / 8, r), [x2, y2] = pt(A0 + (A1 - A0) * to / 8, r); return `M${x1} ${y1} A${r} ${r} 0 0 1 ${x2} ${y2}`; };
  s += `<path d="${arc(0, 8, R)}" fill="none" stroke="#1e2226" stroke-width="1"/>`;
  s += `<path d="${arc(6.4, 8, R - 2)}" fill="none" stroke="#E8B53A" stroke-width="5" id="redline" opacity=".35"/>`;
  s += '<line id="needle" x1="100" y1="100" x2="100" y2="34" stroke="#1e2226" stroke-width="2.2" stroke-linecap="round"/><circle cx="100" cy="100" r="5" fill="#1e2226"/>';
  s += '<text id="spd" x="92" y="146" font-size="40" font-weight="700" text-anchor="middle" fill="#1e2226" font-family="Valley, sans-serif" style="font-variant-numeric:tabular-nums">0</text>';
  s += '<text id="unit" x="92" y="164" font-size="12" font-weight="600" text-anchor="middle" fill="#1e2226" font-family="Valley, sans-serif" letter-spacing="1">km/h</text>';
  s += '<line x1="128" y1="118" x2="128" y2="166" stroke="#1e2226" stroke-width="1"/>';
  s += '<text id="gear" x="146" y="152" font-size="30" font-weight="700" text-anchor="middle" fill="#1e2226" font-family="Valley, sans-serif">N</text>';
  s += '</svg>';
  dialEl.innerHTML = s;
})();
const needle = () => dialEl.querySelector('#needle');
// minimap: north up, centred on the car
const mapC = $('mapc'), mctx = mapC.getContext('2d');
const MAP_SPAN = 900;
function drawMap() {
  const w = mapC.width, h = mapC.height, k = w / MAP_SPAN;
  mctx.fillStyle = '#f2eee6'; mctx.fillRect(0, 0, w, h);
  mctx.save(); mctx.translate(w / 2, h / 2); mctx.scale(k, k); mctx.translate(-S.x, -S.z);
  mctx.fillStyle = 'rgba(120,150,170,.35)'; mctx.beginPath(); mctx.arc(0, 0, 205, 0, Math.PI * 2); mctx.fill();
  mctx.strokeStyle = '#1e2226'; mctx.lineCap = 'round'; mctx.lineJoin = 'round';
  mctx.lineWidth = 2.6 / k; mctx.beginPath(); mainPts.forEach((p, i) => (i ? mctx.lineTo(p.x, p.z) : mctx.moveTo(p.x, p.z))); mctx.closePath(); mctx.stroke();
  mctx.lineWidth = 1.6 / k; mctx.setLineDash([5 / k, 4 / k]); mctx.beginPath(); trailPts.forEach((p, i) => (i ? mctx.lineTo(p.x, p.z) : mctx.moveTo(p.x, p.z))); mctx.stroke(); mctx.setLineDash([]);
  const p0 = mainPts[0]; mctx.fillStyle = '#e8742a'; mctx.fillRect(p0.x - 9 / k, p0.z - 3 / k, 18 / k, 6 / k);
  mctx.fillStyle = '#c0392b'; for (const r of RAMPS) if (!r.off) mctx.fillRect(r.cx - 6 / k, r.cz - 6 / k, 12 / k, 12 / k);
  mctx.restore();
  if (MK.on) {
    let dx = (MK.x - S.x) * k, dz = (MK.z - S.z) * k; const lim = w / 2 - 16, m = Math.max(Math.abs(dx), Math.abs(dz));
    if (m > lim) { dx *= lim / m; dz *= lim / m; }
    mctx.fillStyle = '#E8B53A'; mctx.strokeStyle = '#1e2226'; mctx.lineWidth = 2.5;
    mctx.beginPath(); mctx.arc(w / 2 + dx, h / 2 + dz, 9, 0, Math.PI * 2); mctx.fill(); mctx.stroke();
    mctx.fillStyle = '#1e2226'; mctx.font = '700 20px Valley, sans-serif'; mctx.textAlign = 'right';
    mctx.fillText(fmtDist(Math.hypot(MK.x - S.x, MK.z - S.z)), w - 16, h - 18); mctx.textAlign = 'left';
  }
  mctx.save(); mctx.translate(w / 2, h / 2); mctx.rotate(-S.yaw + Math.PI);
  mctx.fillStyle = '#E8B53A'; mctx.strokeStyle = '#1e2226'; mctx.lineWidth = 2;
  mctx.beginPath(); mctx.moveTo(0, -14); mctx.lineTo(10, 11); mctx.lineTo(0, 5); mctx.lineTo(-10, 11); mctx.closePath(); mctx.fill(); mctx.stroke();
  mctx.restore();
  mctx.fillStyle = '#1e2226'; mctx.font = '700 22px Valley, sans-serif'; mctx.fillText('N', w - 34, 32);
  mctx.lineWidth = 2; mctx.beginPath(); mctx.moveTo(22, h - 24); mctx.lineTo(22 + 200 * k, h - 24); mctx.moveTo(22, h - 30); mctx.lineTo(22, h - 18); mctx.moveTo(22 + 200 * k, h - 30); mctx.lineTo(22 + 200 * k, h - 18); mctx.stroke();
  mctx.font = '600 16px Valley, sans-serif'; mctx.fillText('200 m', 28 + 200 * k, h - 18);
}
// ---------------------------------------------------------------- the big map, and a marker you set on it
const MK = { on: false, x: 0, z: 0, reachedT: 0 };
const beamMat = new T.ShaderMaterial({
  transparent: true, depthWrite: false, blending: T.AdditiveBlending, side: T.DoubleSide, fog: false,
  uniforms: { time: { value: 0 }, col: { value: C('#ffb43a') } },
  vertexShader: 'varying vec2 vU; void main(){ vU = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }',
  fragmentShader: 'uniform float time; uniform vec3 col; varying vec2 vU; void main(){ float a = pow(1.0 - vU.y, 2.2) * 0.85 + 0.1 * sin(vU.y * 60.0 - time * 4.0) * (1.0 - vU.y); float edge = 1.0 - abs(vU.x * 2.0 - 1.0); gl_FragColor = vec4(col * a, a); }',
});
const beam = new T.Mesh(new T.CylinderGeometry(1.4, 1.4, 260, 20, 1, true).translate(0, 130, 0), beamMat); beam.visible = false; beam.frustumCulled = false; beam.renderOrder = 4; scene.add(beam);
const ringMk = new T.Mesh(new T.RingGeometry(3.2, 4, 40).rotateX(-Math.PI / 2), new T.MeshBasicMaterial({ color: 0xffb43a, transparent: true, opacity: 0.8, depthWrite: false, polygonOffset: true, polygonOffsetFactor: -4 })); ringMk.visible = false; scene.add(ringMk);
function setMarker(x, z, quiet) {
  if (x === null) { MK.on = false; beam.visible = ringMk.visible = false; if (!quiet) toast('Marker cleared', 1.4); saveSettings(); return; }
  const r = Math.hypot(x, z); if (r > 1080) { x *= 1080 / r; z *= 1080 / r; }
  MK.on = true; MK.x = x; MK.z = z; const y = groundY(x, z);
  beam.position.set(x, y, z); ringMk.position.set(x, y + 0.15, z); beam.visible = ringMk.visible = true;
  if (!quiet) { toast(`Marker set, ${fmtDist(Math.hypot(x - S.x, z - S.z))} away`, 2); mb?.event?.('marker_set'); saveSettings(); }
}
const fmtDist = (m) => (P.units === 'mph' ? (m > 400 ? `${(m / 1609).toFixed(1)} mi` : `${Math.round(m * 1.094)} yd`) : (m > 1000 ? `${(m / 1000).toFixed(1)} km` : `${Math.round(m)} m`));
let mapImg = null;
function buildMapImage() {
  const N = 600, c = document.createElement('canvas'); c.width = c.height = N; const g = c.getContext('2d');
  const d = g.createImageData(N, N); const k = TS / N;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    const x = -TS / 2 + (i + 0.5) * k, z = -TS / 2 + (j + 0.5) * k;
    const h = terrainH(x, z), hx = terrainH(x + k, z) - terrainH(x - k, z), hz = terrainH(x, z + k) - terrainH(x, z - k);
    const shade = clamp(0.82 + (-hx * 0.6 - hz * 0.45) / k * 0.5, 0.45, 1.25);
    const o = (j * N + i) * 4;
    if (h < WATER) { d.data[o] = 150; d.data[o + 1] = 178; d.data[o + 2] = 192; }
    else {
      const t = clamp((h + 10) / 260, 0, 1);
      const r = lerp(222, 200, t), gg = lerp(214, 196, t), b = lerp(190, 186, t);
      d.data[o] = r * shade; d.data[o + 1] = gg * shade; d.data[o + 2] = b * shade;
    }
    d.data[o + 3] = 255;
  }
  g.putImageData(d, 0, 0);
  g.fillStyle = 'rgba(70,98,62,.22)';
  for (let i = 0; i < trees.length; i += 2) { const t = trees[i]; g.fillRect((t.x + TS / 2) / k - 0.8, (t.z + TS / 2) / k - 0.8, 1.6, 1.6); }
  mapImg = c;
}
const bigC = $('bigc'), bctx = bigC.getContext('2d');
let bigView = { ox: 0, oy: 0, s: 1 };
function drawBigMap() {
  const r = bigC.getBoundingClientRect(), dpr = Math.min(2, devicePixelRatio || 1);
  if (bigC.width !== Math.round(r.width * dpr) || bigC.height !== Math.round(r.height * dpr)) { bigC.width = Math.round(r.width * dpr); bigC.height = Math.round(r.height * dpr); }
  const w = bigC.width, h = bigC.height, side = Math.min(w, h), s = side / TS, ox = (w - side) / 2, oy = (h - side) / 2;
  bigView = { ox, oy, s, dpr };
  const X = (x) => ox + (x + TS / 2) * s, Z = (z) => oy + (z + TS / 2) * s;
  bctx.fillStyle = '#e9e4d8'; bctx.fillRect(0, 0, w, h);
  if (!mapImg) buildMapImage();
  bctx.drawImage(mapImg, ox, oy, side, side);
  bctx.strokeStyle = 'rgba(30,34,38,.35)'; bctx.lineWidth = 1.5 * dpr; bctx.beginPath(); bctx.arc(X(0), Z(0), 1100 * s, 0, Math.PI * 2); bctx.stroke();
  bctx.lineCap = 'round'; bctx.lineJoin = 'round';
  bctx.strokeStyle = '#f2eee6'; bctx.lineWidth = 6 * dpr; bctx.beginPath(); mainPts.forEach((p, i) => (i ? bctx.lineTo(X(p.x), Z(p.z)) : bctx.moveTo(X(p.x), Z(p.z)))); bctx.closePath(); bctx.stroke();
  bctx.strokeStyle = '#1e2226'; bctx.lineWidth = 2.6 * dpr; bctx.stroke();
  bctx.setLineDash([6 * dpr, 5 * dpr]); bctx.lineWidth = 2 * dpr; bctx.beginPath(); trailPts.forEach((p, i) => (i ? bctx.lineTo(X(p.x), Z(p.z)) : bctx.moveTo(X(p.x), Z(p.z)))); bctx.stroke(); bctx.setLineDash([]);
  const p0 = mainPts[0]; bctx.fillStyle = '#e8742a'; bctx.fillRect(X(p0.x) - 7 * dpr, Z(p0.z) - 3 * dpr, 14 * dpr, 6 * dpr);
  bctx.font = `600 ${12 * dpr}px Valley, sans-serif`; bctx.fillStyle = '#1e2226'; bctx.fillText('START', X(p0.x) + 10 * dpr, Z(p0.z) + 4 * dpr);
  { bctx.fillStyle = '#c0392b'; for (const rp of RAMPS) if (!rp.off) bctx.fillRect(X(rp.cx) - 2.5 * dpr, Z(rp.cz) - 2.5 * dpr, 5 * dpr, 5 * dpr); }
  for (const place of window.GOALocations?.list() || []) {
    if(place.id==='long-valley')continue;
    bctx.fillStyle=place.id==='river-valley'?'#327a62':'#637f9b';bctx.beginPath();bctx.arc(X(place.x),Z(place.z),6*dpr,0,Math.PI*2);bctx.fill();
    bctx.font=`600 ${11*dpr}px Valley, sans-serif`;bctx.strokeStyle='#f2eee6';bctx.lineWidth=3*dpr;bctx.strokeText(place.name,X(place.x)+10*dpr,Z(place.z)-8*dpr);bctx.fillStyle='#253c2c';bctx.fillText(place.name,X(place.x)+10*dpr,Z(place.z)-8*dpr);
  }
  if (MK.on) {
    const mx = X(MK.x), mz = Z(MK.z);
    bctx.strokeStyle = 'rgba(232,181,58,.9)'; bctx.lineWidth = 2 * dpr; bctx.setLineDash([4 * dpr, 4 * dpr]); bctx.beginPath(); bctx.moveTo(X(S.x), Z(S.z)); bctx.lineTo(mx, mz); bctx.stroke(); bctx.setLineDash([]);
    bctx.fillStyle = '#E8B53A'; bctx.strokeStyle = '#1e2226'; bctx.lineWidth = 2 * dpr;
    bctx.beginPath(); bctx.moveTo(mx, mz); bctx.lineTo(mx - 8 * dpr, mz - 20 * dpr); bctx.arc(mx, mz - 22 * dpr, 8 * dpr, Math.PI * 0.85, Math.PI * 0.15); bctx.closePath(); bctx.fill(); bctx.stroke();
    bctx.fillStyle = '#1e2226'; bctx.fillText(fmtDist(Math.hypot(MK.x - S.x, MK.z - S.z)), mx + 12 * dpr, mz - 18 * dpr);
  }
  for (const layer of window.GOAMapLayers || []) { try { layer(bctx, X, Z, dpr); } catch (e) { /* layer failed */ } }
  if (window.GOAPlayer?.onFoot()) { bctx.fillStyle = '#5a6b4a'; bctx.fillRect(X(S.x) - 4 * dpr, Z(S.z) - 4 * dpr, 8 * dpr, 8 * dpr); }
  const me = window.GOAPlayer?.onFoot() ? window.GOAPlayer.position() : { x: S.x, z: S.z, yaw: S.yaw };
  bctx.save(); bctx.translate(X(me.x), Z(me.z)); bctx.rotate(-(window.GOAPlayer?.onFoot() ? window.GOAPlayer.state.camYaw : S.yaw) + Math.PI);
  bctx.fillStyle = '#E8B53A'; bctx.strokeStyle = '#1e2226'; bctx.lineWidth = 2 * dpr;
  bctx.beginPath(); bctx.moveTo(0, -12 * dpr); bctx.lineTo(9 * dpr, 10 * dpr); bctx.lineTo(0, 5 * dpr); bctx.lineTo(-9 * dpr, 10 * dpr); bctx.closePath(); bctx.fill(); bctx.stroke(); bctx.restore();
  bctx.font = `700 ${18 * dpr}px Valley, sans-serif`; bctx.fillStyle = '#1e2226'; bctx.fillText('N', ox + side - 26 * dpr, oy + 26 * dpr);
}
function mapOpen() { return $('bigmap').classList.contains('open'); }
function panelsOpen() { return $('settings').classList.contains('open') || mapOpen() || !!window.GOAExtension?.isOpen() || !!window.GOALocations?.isOpen() || !!window.GOAWildlife?.isOpen() || !!window.GOACampLife?.isOpen() || !!window.GOAXR?.isOpen() || $('board').style.display === 'block' || !!window.GOADriveUI?.isOpen() || !!$('surv-end')?.classList.contains('open'); }
function openMap(on) {
  const el = $('bigmap'); const v = on === undefined ? !el.classList.contains('open') : on;
  el.classList.toggle('open', v); for (const k in keys) keys[k] = 0;
  if (v) { openSettings(false); drawBigMap(); }
  $('mkclear').disabled = !MK.on; $('mkgo').disabled = !MK.on;
}
bigC.addEventListener('pointerdown', (e) => {
  const r = bigC.getBoundingClientRect(), v = bigView;
  const px = (e.clientX - r.left) * v.dpr, py = (e.clientY - r.top) * v.dpr;
  const x = (px - v.ox) / v.s - TS / 2, z = (py - v.oy) / v.s - TS / 2;
  if (Math.abs(x) > TS / 2 || Math.abs(z) > TS / 2) return;
  setMarker(x, z); $('mkclear').disabled = false; $('mkgo').disabled = false; drawBigMap();
});
$('mapbtn').onclick = (e) => { openMap(); e.target.blur(); };
$('mapclose').onclick = () => openMap(false);
$('mkclear').onclick = () => { setMarker(null); openMap(true); };
$('mkgo').onclick = () => {
  if (!MK.on) return;
  const fx = MK.x - S.x, fz = MK.z - S.z;
  S.x = MK.x - Math.sin(S.yaw) * 14; S.z = MK.z - Math.cos(S.yaw) * 14; if (Math.hypot(fx, fz) > 1) S.yaw = Math.atan2(fx, fz);
  S.x = MK.x - Math.sin(S.yaw) * 14; S.z = MK.z - Math.cos(S.yaw) * 14;
  S.vx = S.vz = S.w = 0; S.vy = 0; S.air = false; S.y = groundY(S.x, S.z); lastMark[0] = lastMark[1] = null;
  if (S.y < WATER) { S.x = MK.x; S.z = MK.z; S.y = groundY(S.x, S.z); }
  openMap(false); updateCamera(0, true); toast('Moved next to the marker', 1.6);
};
function updateMarker(dt) {
  if (!MK.on) return;
  beamMat.uniforms.time.value += dt;
  const d = Math.hypot(MK.x - S.x, MK.z - S.z);
  beamMat.uniforms.col.value.setRGB(1, 0.71, 0.23).multiplyScalar(clamp(d / 60, 0.25, 1));
  if (d < 9 && S.ctrl) { toast('Marker reached', 2); mb?.event?.('marker_reached'); setMarker(null, true); }
  if (mapOpen()) { MK.reachedT += dt; if (MK.reachedT > 0.25) { MK.reachedT = 0; drawBigMap(); } }
}
let hudT = 0, hintT = 0;
function showHint(secs) {
  const el = $('hint');
  el.innerHTML = isTouch || sawTouch
    ? '<div><b>GAS</b> and <b>BRAKE</b> bottom right, arrows bottom left.</div><div><b>DRIFT</b> is the handbrake, <b>NITRO</b> boosts, <b>RAMP</b> builds a jump. In the air, gas and brake flip. <b>MAP</b> sets a marker. Drive anywhere.</div>'
    : '<div><kbd>W</kbd><kbd>A</kbd><kbd>S</kbd><kbd>D</kbd> or arrows to drive, <kbd>Space</kbd> to drift, <kbd>Shift</kbd> nitro</div><div><kbd>B</kbd> build a ramp, <kbd>T</kbd> ramp kind. In the air: steer spins, <kbd>W</kbd>/<kbd>S</kbd> flip</div><div><kbd>1</kbd>-<kbd>3</kbd> season, <kbd>4</kbd>-<kbd>8</kbd> weather, <kbd>V</kbd> vehicle, <kbd>C</kbd> camera</div><div><kbd>M</kbd> map and marker, <kbd>Esc</kbd> settings, <kbd>R</kbd> back to the road</div>';
  el.classList.remove('gone'); hintT = secs;
}
function updateHud(dt, st) {
  hudT -= dt; if (toastTimer > 0) { toastTimer -= dt; if (toastTimer <= 0) $('toast').style.opacity = 0; }
  if (stuntT > 0) { stuntT -= dt; if (stuntT <= 0) $('stunt').style.opacity = 0; }
  if (hintT > 0) { hintT -= dt; if (hintT <= 0) $('hint').classList.add('gone'); }
  const nf = $('nitrofill'); if (nf) { nf.style.width = `${Math.round(S.nitro * 100)}%`; $('nitro').classList.toggle('burn', S.nitroOn); }
  const n = needle(); if (n) n.setAttribute('transform', `rotate(${-135 + clamp(S.rpm, 0, 8) / 8 * 270} 100 100)`);
  dialEl.querySelector('#redline')?.setAttribute('opacity', S.rpm > 6.2 ? '1' : '.35');
  if (hudT > 0) return; hudT = 0.1;
  const mph = P.units === 'mph';
  dialEl.querySelector('#spd').textContent = Math.round(Math.abs(st.vf) * (mph ? 2.237 : 3.6));
  dialEl.querySelector('#unit').textContent = mph ? 'mph' : 'km/h';
  dialEl.querySelector('#gear').textContent = S.gear;
  const sn = SV.snow > 0.5;
  $('surface').textContent = { asphalt: sn ? 'Packed snow' : W.wet > 0.5 ? 'Wet asphalt' : 'Asphalt', dirt: sn ? 'Snow track' : W.wet > 0.5 ? 'Mud track' : 'Dirt track', grass: sn ? 'Deep snow' : 'Meadow' }[surfName];
  $('laptime').textContent = fmt(S.lapT); $('lapn').textContent = S.lap; $('best').textContent = fmt(S.best);
  $('mode').textContent = `${VEHICLES[P.vehicle].name} · ${S.cps ? 'Lap in progress' : 'Free drive'}`;
  drawMap();
}

// ---------------------------------------------------------------- loop
const fpsAcc = { n: 0, t: 0, last: 0 };
// ---------------------------------------------------------------- birds: a few loose flocks wheeling high over the valley floor
const BIRDS_N = 36;
const birdGeo = new T.BufferGeometry();
birdGeo.setAttribute('position', new T.Float32BufferAttribute([0, 0, 0.18, -0.9, 0, -0.1, 0, 0, -0.25, 0, 0, 0.18, 0, 0, -0.25, 0.9, 0, -0.1, 0, 0, 0.35, -0.08, 0, -0.1, 0.08, 0, -0.1], 3));
birdGeo.setAttribute('wing', new T.Float32BufferAttribute([0, 1, 0, 0, 0, 1, 0, 0, 0], 1));
const birdMat = new T.MeshBasicMaterial({ color: 0x2a2724, side: T.DoubleSide, fog: true });
birdMat.onBeforeCompile = (sh) => {
  sh.uniforms.uBT = U.uTime;
  sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nattribute float wing; uniform float uBT;')
    .replace('#include <begin_vertex>', `#include <begin_vertex>
      float ph = instanceMatrix[3].x * 0.37 + instanceMatrix[3].z * 0.21;
      float fl = sin(uBT * 9.0 + ph) * step(0.0, sin(uBT * 0.8 + ph * 3.0) + 0.3);
      transformed.y += wing * fl * 0.55; transformed.x *= 1.0 - wing * abs(fl) * 0.15;`);
};
const birds = new T.InstancedMesh(birdGeo, birdMat, BIRDS_N); birds.frustumCulled = false; scene.add(birds);
const flocks = [0, 1, 2].map((i) => ({ cx: [-260, 340, 60][i], cz: [180, -120, -420][i], r: 70 + i * 25, h: 85 + i * 30, sp: 0.09 + i * 0.03, ph: i * 2.1 }));
const _bm = new T.Matrix4(), _bq = new T.Quaternion(), _be = new T.Euler(), _bs = new T.Vector3(), _bp = new T.Vector3();
let birdK = 0;
function updateBirds(dt, t) {
  const want = P.birds ? (1 - W.rain) * (1 - W.snow * 0.8) * (1 - smooth(0.5, 1, W.fogM / 22)) * (1 - SV.snow * 0.6) : 0;
  birdK = lerp(birdK, want, 1 - Math.exp(-dt * 0.6));
  birds.visible = birdK > 0.02; if (!birds.visible) return;
  for (let i = 0; i < BIRDS_N; i++) {
    const f = flocks[i % 3], j = Math.floor(i / 3), o = j * 0.11;
    const a = t * f.sp + f.ph + o, r = f.r + Math.sin(j * 2.3 + t * 0.2) * 14;
    const gy = terrainH(f.cx, f.cz);
    _bp.set(f.cx + Math.cos(a) * r + Math.sin(j * 7.1) * 6, gy + f.h + Math.sin(t * 0.4 + j) * 6 + Math.cos(j * 3.7) * 5, f.cz + Math.sin(a) * r + Math.cos(j * 5.3) * 6);
    _be.set(0, -a, Math.sin(t * 0.5 + j) * 0.2); _bq.setFromEuler(_be);
    _bs.setScalar((0.7 + (j % 4) * 0.1) * birdK);
    _bm.compose(_bp, _bq, _bs); birds.setMatrixAt(i, _bm);
  }
  birds.instanceMatrix.needsUpdate = true;
}
let lastT = performance.now(), clockT = 0, st = { vf: 0, speed: 0, sliding: false };
let ready = false, sessStart = 0;
const titleCam = { a: 0 };
function frame(now,xrFrame) {
  const dt = Math.min(0.05, (now - lastT) / 1000); lastT = now; clockT += dt;
  if(window.GOAXR?.active()){if(window.GOAXR.previewActive())window.GOAController?.poll(dt);window.GOAXR.frame(dt,clockT,xrFrame);return;}
  window.GOAController?.poll(dt);
  if (S.started) {
    if (window.GOAPlayer?.onFoot()) { window.GOAPlayer.update(dt); }
    else { for (let i = 0; i < 2; i++) { const r = physics(dt / 2); if (r) st = r; } }
    if (S.ctrl && !$('settings').classList.contains('open') && !mapOpen() && !window.GOAExtension?.isOpen() && !window.GOALocations?.isOpen() && !window.GOAWildlife?.isOpen() && !window.GOACampLife?.isOpen() && !window.GOAXR?.isOpen() && $('board').style.display!=='block' && !window.GOADriveUI?.isOpen()) S.lapT += dt;
    if (!window.GOAPlayer?.onFoot()) updateCamera(dt, false);
  } else {
    // a wide, quiet view over the valley toward the mountains, the car parked at the roadside
    car.position.set(S.x, S.y, S.z); car.rotation.set(0, S.yaw, 0);
    titleCam.a += dt * 0.012;
    const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw);
    const bx = S.x - fx * 9 - fz * 4.5, bz = S.z - fz * 9 + fx * 4.5;
    camera.position.set(bx + Math.sin(titleCam.a) * 2, Math.max(groundY(bx, bz) + 2.2, S.y + 2.4), bz);
    camera.fov = innerWidth / innerHeight < 1 ? 70 : 52; camera.updateProjectionMatrix();
    camera.lookAt(S.x + fx * 40 - fz * 6, S.y + 3.5, S.z + fz * 40 + fx * 6);
    camPos.copy(camera.position);
  }
  const pf = window.__prof, t0 = pf ? performance.now() : 0;
  updateDust(dt);
  updateMarker(dt);
  const t1 = pf ? performance.now() : 0;
  updateGrass(S.x, S.z, false);
  updateTreeRange();
  updateNear3D();
  const t2 = pf ? performance.now() : 0;
  updateEnv(dt, clockT);
  updateBirds(dt, clockT);
  window.GOAWildlife?.frame(dt, clockT);
  window.GOACampLife?.frame(dt, clockT); window.GOASurvival?.frame(dt);
  fpsAcc.n++; fpsAcc.t += dt;
  if (fpsAcc.t > 0.75) {
    fpsAcc.last = fpsAcc.n / fpsAcc.t; fpsAcc.n = 0; fpsAcc.t = 0;
    if (P.showFps) $('fps').textContent = `${Math.round(fpsAcc.last)} fps`;
    if (P.dynRes && S.started && document.visibilityState === 'visible') {
      const before = dynK;
      if (fpsAcc.last < 42 && dynK > 0.6) dynK = Math.max(0.6, dynK - 0.07);
      else if (fpsAcc.last > 57 && dynK < 1) dynK = Math.min(1, dynK + 0.04);
      if (dynK !== before) { applyPixelRatio(); resizeUniforms(); }
    } else if (!P.dynRes && dynK !== 1) { dynK = 1; applyPixelRatio(); resizeUniforms(); }
    const inf = document.querySelector('[data-info="_fps"]'); if (inf) inf.textContent = fpsText();
  }
  const t3 = pf ? performance.now() : 0;
  updateHud(dt, st);
  const t4 = pf ? performance.now() : 0;
  if (bloomPass) { bloomPass.enabled = !!P.bloom; bloomPass.strength += S.nitroFx * 0.25; }
  if (lensPass) {
    const lu = lensPass.uniforms;
    const sp = Math.hypot(S.vx, S.vz);
    lu.uBlur.value = P.lens && S.started ? S.nitroFx * 0.75 + (P.camShake ? clamp((sp - 28) / 30, 0, 1) * 0.3 : 0) : 0;
    lu.uVig.value = P.lens ? 0.32 + S.nitroFx * 0.3 : 0; lu.uWarm.value = P.lens ? S.nitroFx : 0;
    lu.uSat.value = P.vivid; lu.uSharp.value = P.sharpen ? 0.9 : 0;
    // where the sun is on screen, and how much of it the camera faces
    _sunP.copy(sunDir).multiplyScalar(5000).add(camera.position).project(camera);
    camera.getWorldDirection(_camD);
    const facing = _camD.dot(sunDir);
    const onScr = 1 - smooth(1.0, 1.6, Math.max(Math.abs(_sunP.x), Math.abs(_sunP.y)));
    lu.uSun.value.set(_sunP.x * 0.5 + 0.5, _sunP.y * 0.5 + 0.5, facing > 0 ? onScr * smooth(0.0, 0.35, facing) * clamp(W.sunM * 1.2, 0, 1) : 0);
    lu.uSunCol.value.copy(live.sun);
    lu.uRays.value = P.sunRays ? 0.55 * (1 - W.over * 0.6) : 0;
  }
  if (composer) composer.render(); else renderer.render(scene, camera);
  if (pf) { const t5 = performance.now(); pf.push([t0 - now, t1 - t0, t2 - t1, t3 - t2, t4 - t3, t5 - t4].map(Math.round).join('/')); }
}
function begin() {
  if (S.started || !ready) return;
  S.started = true; S.ctrl = true;
  $('title').style.display = 'none'; $('hud').classList.remove('pre');
  initAudio();
  updateCamera(0, true);
  window.mindblown?.run?.start();
  S.lapT = 0; S.lapMod = !!P.infNitro; S.cps = 0; S.lastIdx = 0; S.dist = 0; S.sessTop = 0; S.splits = []; sessStart = performance.now();
  showHint(7);
}
function finishDrive() {
  if (!S.started || !S.ctrl) return;
  S.ctrl = false; for (const k in keys) keys[k] = 0;
  const secs = Math.round((performance.now() - sessStart) / 1000);
  const km = S.dist / 1000, mph = P.units === 'mph';
  window.mindblown?.run?.end({ seconds: secs, km: Math.round(km * 100) / 100, laps: S.lap - 1, top_kmh: Math.round(S.sessTop * 3.6), drift: S.driftBest, stunt: S.stuntBest || 0, season, weather, vehicle: P.vehicle });
  mb?.event?.('drive_finished', { seconds: secs, km: Math.round(km * 10) / 10, vehicle: P.vehicle });
  const rows = [['Time', fmt(secs)], ['Distance', mph ? `${(km * 0.6214).toFixed(1)} mi` : `${km.toFixed(1)} km`], ['Top speed', mph ? `${Math.round(S.sessTop * 2.237)} mph` : `${Math.round(S.sessTop * 3.6)} km/h`], ['Laps', String(S.lap - 1)], ['Best lap', fmt(S.best)], ['Best drift', String(S.driftBest)], ['Best stunt', String(S.stuntBest || 0)], ['Vehicle', VEHICLES[P.vehicle].name], ['Conditions', `${SEASON_NAME[season]}, ${WEATHER_NAME[weather].toLowerCase()}`]];
  $('sumbody').replaceChildren(...rows.map(([a, b]) => { const d = document.createElement('div'); const x = document.createElement('span'); x.textContent = a; const y = document.createElement('b'); y.textContent = b; d.append(x, y); return d; }));
  $('summary').style.display = 'block';
}
function driveAgain() {
  $('summary').style.display = 'none';
  S.ctrl = true; S.dist = 0; S.sessTop = 0; S.lap = 1; S.lapT = 0; S.lapMod = !!P.infNitro; S.cps = 0; S.topSpeed = 0; S.splits = [];
  resetCar(true); updateCamera(0, true); sessStart = performance.now();
  window.mindblown?.run?.start();
}
$('endbtn').onclick = (e) => { finishDrive(); e.target.blur(); };
$('sumgo').onclick = () => driveAgain();
$('sumboard').onclick = () => showBoard();
$('go').onclick = (e) => { e.stopPropagation(); begin(); };
addEventListener('resize', () => {
  if(renderer.xr.isPresenting)return;
  renderer.setSize(innerWidth, innerHeight, false); camera.aspect = innerWidth / innerHeight; camera.updateProjectionMatrix();
  applyPixelRatio();
  resizeUniforms();
});
addEventListener('pagehide', () => { if (S.started && S.ctrl) window.mindblown?.run?.end({ seconds: Math.round((performance.now() - sessStart) / 1000), lap: S.lap, finished: false }); });

// ---------------------------------------------------------------- boot
async function boot() {
  tune = await (mb?.tune ? mb.tune() : fromFile());
  Object.assign(P, prefDefaults());
  mb?.tune?.on?.((next) => { tune = next; });
  mb?.measure?.([{ name: 'lap_done', kind: 'value', label: 'Lap time (s)' }, { name: 'season', kind: 'count', label: 'Season changes' }, { name: 'weather', kind: 'count', label: 'Weather changes' }, { name: 'vehicle', kind: 'count', label: 'Vehicle changes' }, { name: 'drift', kind: 'value', label: 'Best drift' }]);
  buildCondUI();
  await new Promise((r) => setTimeout(r, 0));
  buildTrees(Math.round(tv('trees', 6500) * (software ? 0.35 : 1)));
  buildGrass(Math.round(tv('grass', 14000) * (software ? 0.2 : 1)));
  buildProps();
  buildRoadRamps();
  await Promise.race([loadTrees3D(), new Promise((r) => setTimeout(r, 6000))]);
  if (software) Object.assign(P, QUALITY.low, { quality: 'low', resScale: 0.6 });
  const saved = await Promise.race([loadSettings(), new Promise((r) => setTimeout(() => r(null), 3500))]);
  if (saved) {
    S.best = saved.best ?? null; S.bestSplits = saved.bestSplits || null; S.driftBest = saved.driftBest || 0; S.stuntBest = saved.stuntBest || 0;
    const d = prefDefaults();
    for (const k in saved.prefs || {}) if (k in d && typeof saved.prefs[k] === typeof d[k]) P[k] = saved.prefs[k];
    if (saved.schemaVersion < 3) { P.camDist = d.camDist; P.camHeight = d.camHeight; P.fov = d.fov; }
    if (P.camMode > 3) P.camMode = 0;
  }
  await Promise.race([loadRamps(), new Promise((r) => setTimeout(r, 3500))]);
  applyRoadRamps();
  resetCar(true);
  if (Array.isArray(saved?.marker)) setMarker(saved.marker[0], saved.marker[1], true);
  setSeason(saved?.season || tv('season', 'dust'), true);
  setWeather(saved?.weather || tv('weather', 'clear'), true);
  const tg = SEASON_TARGET[season]; SV.dry = tg.dry; SV.snow = tg.snow;
  await window.GOAExtension.init({VEHICLES,WHEEL_STYLE,P,S,keys,scene,groundY,setPref,openSettings,openMap,toast});
  window.GOALocations.init({scene,ROADS,roadFrame,groundY,terrainH,WATER,waterMat,near3d,nearestRoad,P,S,keys,setSeason,setWeather,setPref,setMarker,openSettings,openMap,updateCamera,saveSettings,toast,
   clearInput(){for(const k in keys)keys[k]=0;for(const k in touch)touch[k]=0;lastMark[0]=lastMark[1]=null;},
   snapConditions(){const target=SEASON_TARGET[season];SV.dry=target.dry;SV.snow=target.snow;envInit=false;updateEnv(0,clockT);updateGrass(S.x,S.z,true);}
  });
  applyPrefs();
  await selectVehicle(P.vehicle, true);
  updateEnv(0, 0); rebuildEnv();
  updateGrass(S.x, S.z, true);
  renderer.compile(scene, camera);
  ready = true;
  $('go').disabled = false; $('go').textContent = 'Start driving'; $('loading').textContent = '';
  window.__sim = { scene, renderer, camera, RAMPS, placeRamp, addRamp, openMap, setMarker, MK, finishDrive, driveAgain, P, setPref, openSettings, S, setSeason, setWeather, keys, begin, resetCar, SV, selectVehicle };
  const cursor=document.createElement('div');cursor.id='controller-map-cursor';$('bigmap').append(cursor);bigC.tabIndex=0;bigC.setAttribute('aria-label','Map marker cursor. Move left stick, then A or Cross to set marker. D-pad moves to map controls.');
  let cursorX=.5,cursorY=.5;
  function mapCursor(){const r=bigC.getBoundingClientRect(),p=$('bigmap').getBoundingClientRect();cursor.style.left=(r.left-p.left+r.width*cursorX)+'px';cursor.style.top=(r.top-p.top+r.height*cursorY)+'px';cursor.style.display=mapOpen()?'block':'none';}
  function currentScope(){if(window.GOADriveUI?.isOpen())return $('drive-menu');if(window.GOAXR.previewActive())return $('xr-overlay');if(window.GOAXR.isOpen())return $('xr-panel');if(window.GOALocations.isOpen())return $('destinations');if(window.GOAWildlife?.isOpen())return $('journal');if(window.GOACampLife?.isOpen())return $('adventure');if(window.GOAExtension.isOpen())return $('expedition');if($('board').style.display==='block')return $('board');if($('summary').style.display==='block')return $('summary');if(mapOpen())return $('bigmap');if($('settings').classList.contains('open'))return $('settings');if(!S.started)return $('title');if($('build').classList.contains('open'))return $('build');return null;}
  window.GOAController.setHooks({scope:currentScope,onFoot(){return !!window.GOAPlayer?.onFoot();},footPad(state,pad){window.GOAPlayer?.pad(state,pad);},exitVehicle(){window.GOAPlayer?.exitVehicle();},
   pause(){if(S.started&&S.ctrl)openSettings(true);},
   back(){const s=currentScope();if(s?.id==='drive-menu')window.GOADriveUI.close();else if(s?.id==='xr-overlay')window.GOAXR.end();else if(s?.id==='xr-panel')window.GOAXR.close();else if(s?.id==='destinations')window.GOALocations.close();else if(s?.id==='journal')window.GOAWildlife.close();else if(s?.id==='adventure')window.GOACampLife.close();else if(s?.id==='expedition')window.GOAExtension.close();else if(s?.id==='bigmap')openMap(false);else if(s?.id==='settings')openSettings(false);else if(s?.id==='board')$('board').style.display='none';else if(s?.id==='build')$('build').classList.remove('open');},
   map(){window.GOAXR.close();window.GOALocations.close();window.GOAWildlife?.close();window.GOAExtension.close();openSettings(false);openMap();mapCursor();},
   mapMove(x,y,dt){cursorX=clamp(cursorX+x*dt*.45,.02,.98);cursorY=clamp(cursorY+y*dt*.45,.02,.98);mapCursor();},
   mapPlace(){const x=(cursorX*bigC.width-bigView.ox)/bigView.s-TS/2,z=(cursorY*bigC.height-bigView.oy)/bigView.s-TS/2;if(Math.abs(x)<=TS/2&&Math.abs(z)<=TS/2){setMarker(x,z);drawBigMap();$('mkclear').disabled=false;$('mkgo').disabled=false;}},
   reset(){resetCar(false);},camera:cycleCam,
   vehicle(direction){const ids=Object.keys(VEHICLES);setPref('vehicle',ids[(ids.indexOf(P.vehicle)+direction+ids.length)%ids.length]);},
   ramp:placeRamp,rampKind:cycleRampKind,camp(){window.GOAExtension.deployCamp();}
  });
  window.GOAXR.init({renderer,scene,camera,S,P,TX,WATER,groundY,terrainH,nearestRoad,ROADS,roadFrame,
   clearInput(){for(const k in keys)keys[k]=0;for(const k in touch)touch[k]=0;},
   stop(){S.vx=S.vz=S.w=S.steer=S.vy=0;S.nitroOn=false;S.nitroFx=0;if(actx&&engineGain)engineGain.gain.setTargetAtTime(0,actx.currentTime,.1);if(actx&&windGain)windGain.gain.setTargetAtTime(.06*P.ambVol,actx.currentTime,.2);},
   restoreView(){updateCamera(0,true);queueMicrotask(()=>{if(!renderer.xr.isPresenting){camera.aspect=innerWidth/innerHeight;camera.updateProjectionMatrix();applyPixelRatio();resizeUniforms();}});},openSettings,travel(id){window.GOALocations.travel(id);car.position.set(S.x,S.y,S.z);car.rotation.set(0,S.yaw,0);},
   snow(){return SV.snow;},vehicle(){return vehModel?.root;},treeModel(){return near3d.models.pine;},
   tickVR(dt,time){updateEnv(dt,time);updateTreeRange();updateNear3D();updateGrass(S.x,S.z,false);updateBirds(dt,time);window.GOAWildlife?.frame(dt,time);window.GOACampLife?.frame(dt,time);window.GOASurvival?.frame(dt);},
   physicsStep(dt){if(window.GOAPlayer?.onFoot())return;for(let i=0;i<2;i++)physics(dt/2);},player(){return window.GOAPlayer;},resetCar(){resetCar(false);}
  });
  try{window.GOAWildlife?.init({scene,camera,S,P,keys,WATER,groundY,terrainH,nearestRoad,toast,openSettings,openMap,snow(){return SV.snow;},viewPos(){return cameraWorldPosition();}});}catch(error){console.warn('Wildlife unavailable',error);}
  const outdoorHooks={scene,camera,renderer,S,P,keys,WATER,TX,groundY,terrainH,nearestRoad,toast,openSettings,openMap,setPref,panelsOpen,
   snow(){return SV.snow;},night(){return P.tod==='night';},viewPos(){return cameraWorldPosition();},snapCamera(){updateCamera(0,true);},
   setMarker(x,z){if(x===null||x===undefined)setMarker(null,0,true);else setMarker(x,z,true);},
   travel(id){if(window.GOAPlayer?.onFoot())window.GOAPlayer.enterVehicle(true);window.GOALocations.travel(id);car.position.set(S.x,S.y,S.z);car.rotation.set(0,S.yaw,0);updateCamera(0,true);}};
  for(const m of ['GOAPlayer','GOACampLife','GOAFishing','GOASurvival']){try{window[m]?.init(outdoorHooks);}catch(error){console.warn(m+' unavailable',error);}}
  const requestedLocation=new URLSearchParams(location.search).get('location');
  if(window.GOALocations.list().some(p=>p.id===requestedLocation))window.GOALocations.travel(requestedLocation);
  renderer.setAnimationLoop(frame);
}
boot().catch((e) => { console.error(e); $('go').textContent = 'Something went wrong building the valley'; $('loading').textContent = String(e && e.message || e); });
})();






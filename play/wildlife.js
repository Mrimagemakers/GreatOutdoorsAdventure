/* Great Outdoors Adventure: wildlife.
   Six North American species live around Long Valley, River Valley and Snowy Mountain. Each animal is one skinned mesh
   (a single draw call) built from simple shaded forms on a small skeleton, so dozens can share the valley cheaply.
   They graze, wander as herds, look up when a vehicle approaches and run when it gets close. Animals you watch for a
   moment are logged in the Field Journal, which is kept in this browser. */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp = (a, b, t) => a + (b - a) * t;
const damp = (a, b, k, dt) => lerp(a, b, 1 - Math.exp(-k * dt));
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
let T = null, api = null;

// ------------------------------------------------------------------ species
// Sizes are metres (shoulder height, body length). Colours: coat, belly, legs, face, accent (rump/tail/chest), dark (hooves, nose).
const SPECIES = {
  deer: {
    hp: 90, kg: [45, 110], name: 'White-tailed Deer', latin: 'Odocoileus virginianus',
    note: 'Graceful and alert. Flags its white tail and bounds away when startled. Look along meadow edges at dawn and dusk.',
    habitat: 'Meadows, forest edges', shoulder: 0.95, len: 0.95, bodyR: 0.24, bodyW: 0.82, neckLen: 0.45, neckR: 0.09, neckUp: 0.95,
    headLen: 0.3, headR: 0.085, muzzle: 0.13, ears: 'point', earLen: 0.15, tail: 'flag', tailLen: 0.2, legR: 0.035, feet: 'hoof',
    shape: { chest: 0.24, tuck: 0.24, withers: 0.06 }, coat: '#8a6644', coatWinter: '#6f655b', belly: '#e8e0d2', legs: '#7a5a3c', face: '#9a7652', accent: '#f4efe6', dark: '#1d1714',
    antlers: 'deer', antlerChance: 0.35, walk: 1.2, run: 11, alert: 70, flee: 38, calm: 120, gait: 'bound', spot: 75,
  },
  elk: {
    hp: 150, kg: [180, 330], name: 'Rocky Mountain Elk', latin: 'Cervus canadensis',
    note: 'Massive and social, moving in herds. Bulls carry sweeping antlers; listen for their bugle in autumn.',
    habitat: 'High meadows, open slopes', shoulder: 1.45, len: 1.35, bodyR: 0.36, bodyW: 0.86, neckLen: 0.7, neckR: 0.15, neckUp: 0.85,
    headLen: 0.48, headR: 0.12, muzzle: 0.2, ears: 'point', earLen: 0.2, tail: 'stub', tailLen: 0.1, legR: 0.055, feet: 'hoof',
    shape: { chest: 0.3, tuck: 0.18, withers: 0.12 }, coat: '#a77c52', coatWinter: '#9a7a5c', belly: '#5c4330', legs: '#4a3526', face: '#5a4030', accent: '#e3cfa8', dark: '#1a1411',
    neckCol: '#4e3727', antlers: 'elk', antlerChance: 0.4, walk: 1.3, run: 12, alert: 90, flee: 45, calm: 140, gait: 'trot', spot: 110,
  },
  bear: {
    hp: 170, kg: [80, 200], name: 'American Black Bear', latin: 'Ursus americanus',
    note: 'Curious, powerful and usually shy. Gives wide berth to people. Seen near berries, streams and forest cover.',
    habitat: 'Forest, streams', shoulder: 0.95, len: 1.0, bodyR: 0.4, bodyW: 0.92, neckLen: 0.25, neckR: 0.2, neckUp: 0.15,
    headLen: 0.34, headR: 0.17, muzzle: 0.15, ears: 'round', earLen: 0.09, tail: 'stub', tailLen: 0.06, legR: 0.09, feet: 'paw',
    shape: { chest: 0.12, tuck: 0.02, withers: 0.0, rump: 0.12 }, coat: '#1c1916', coatWinter: '#1c1916', belly: '#161310', legs: '#151210', face: '#8a6a4a', accent: '#2a2420', dark: '#0d0b0a',
    walk: 0.9, run: 8.5, alert: 60, flee: 28, calm: 90, gait: 'amble', spot: 90, hump: true,
  },
  fox: {
    hp: 30, kg: [4, 8], name: 'Red Fox', latin: 'Vulpes vulpes',
    note: 'Quick and clever. A flash of orange with a white-tipped brush of a tail, hunting voles in the grass.',
    habitat: 'Field edges, brush', shoulder: 0.4, len: 0.42, bodyR: 0.1, bodyW: 0.8, neckLen: 0.14, neckR: 0.06, neckUp: 0.55,
    headLen: 0.16, headR: 0.065, muzzle: 0.11, ears: 'point', earLen: 0.09, tail: 'brush', tailLen: 0.42, legR: 0.018, feet: 'paw',
    shape: { chest: 0.18, tuck: 0.28, withers: 0.02 }, coat: '#c75f24', coatWinter: '#c4622a', belly: '#f0e8dc', legs: '#2a1d16', face: '#cf6a2c', accent: '#f6f1e8', dark: '#140f0c',
    walk: 1.4, run: 12.5, alert: 45, flee: 24, calm: 85, gait: 'bound', spot: 50, tailTip: true,
  },
  rabbit: {
    hp: 18, kg: [1, 2.5], name: 'Cottontail & Snowshoe Hare', latin: 'Sylvilagus / Lepus americanus',
    note: 'Small and watchful. Cottontails freeze, then zig-zag. Snowshoe hares turn white for winter on the high ground.',
    habitat: 'Grass, brush, snow', shoulder: 0.2, len: 0.16, bodyR: 0.09, bodyW: 0.95, neckLen: 0.05, neckR: 0.05, neckUp: 0.5,
    headLen: 0.11, headR: 0.055, muzzle: 0.03, ears: 'long', earLen: 0.12, tail: 'puff', tailLen: 0.05, legR: 0.018, feet: 'paw',
    shape: { chest: 0.05, tuck: -0.1, withers: 0.0, rump: 0.25 }, coat: '#8c7a63', coatWinter: '#eceff1', faceWinter: '#e6e8e8', legsWinter: '#dfe2e2', belly: '#efe9df', legs: '#7d6c58', face: '#8f7c64', accent: '#ffffff', dark: '#1a1512',
    walk: 0.8, run: 9, alert: 26, flee: 14, calm: 55, gait: 'hop', spot: 32,
  },
  coyote: {
    hp: 45, kg: [9, 20], name: 'Coyote', latin: 'Canis latrans',
    note: 'Adaptable and vocal, often in pairs or small packs. Grey-tan coat and a bushy tail held low as it trots.',
    habitat: 'Open country, ridges', shoulder: 0.58, len: 0.6, bodyR: 0.14, bodyW: 0.78, neckLen: 0.2, neckR: 0.08, neckUp: 0.45,
    headLen: 0.21, headR: 0.08, muzzle: 0.14, ears: 'point', earLen: 0.1, tail: 'brush', tailLen: 0.38, legR: 0.026, feet: 'paw',
    shape: { chest: 0.2, tuck: 0.3, withers: 0.04 }, coat: '#9a8b73', coatWinter: '#a49784', belly: '#e1d7c4', legs: '#a08a6a', face: '#b39467', accent: '#2a231d', dark: '#16120f',
    walk: 1.3, run: 13, alert: 60, flee: 32, calm: 110, gait: 'trot', spot: 65, tailTip: true,
  },
};
const ORDER = ['deer', 'elk', 'bear', 'fox', 'rabbit', 'coyote'];

// ------------------------------------------------------------------ rigging: rigid parts skinned to a small skeleton
function rig(spec, bull) {
  const H = spec.shoulder - spec.bodyR; // height of the torso's centre line
  const L = spec.len, R = spec.bodyR, W = spec.bodyW;
  const bones = {}, list = [];
  const bone = (name, parent, x, y, z, rx = 0) => { const b = new T.Bone(); b.name = name; b.position.set(x, y, z); b.rotation.x = rx; if (parent) parent.add(b); bones[name] = b; list.push(b); return b; };
  const root = bone('root', null, 0, 0, 0);
  const body = bone('body', root, 0, H, 0);
  const neck = bone('neck', body, 0, R * 0.35, L * 0.5 + R * 0.15, -spec.neckUp);
  const head = bone('head', neck, 0, 0, spec.neckLen, spec.neckUp * 0.92);
  const tail = bone('tail', body, 0, R * 0.25, -L * 0.5 - R * 0.55);
  const legTop = R * 0.25, legLen = H - legTop, up = legLen * 0.5, lo = legLen * 0.5;
  for (const [side, sx] of [['L', 1], ['R', -1]]) for (const [end, sz] of [['F', 1], ['H', -1]]) {
    const hip = bone('hip' + end + side, body, sx * R * W * 0.55, -legTop, sz * L * 0.48);
    bone('knee' + end + side, hip, 0, -up, 0);
  }
  return { bones, list, root, H, L, R, W, up, lo, bull };
}

function buildGeometry(spec, rg, winter) {
  const C = (hex) => new T.Color(hex);
  const parts = [];
  const add = (g, boneName, color, shade) => {
    if (g.index) { g.computeVertexNormals(); g = g.toNonIndexed(); } // smooth normals first, then split
    g.deleteAttribute('uv');
    const n = g.attributes.position.count, col = new Float32Array(n * 3), base = C(color), tmp = new T.Color();
    const p = g.attributes.position;
    for (let i = 0; i < n; i++) {
      tmp.copy(base); if (shade) shade(tmp, p.getX(i), p.getY(i), p.getZ(i));
      col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b;
    }
    g.setAttribute('color', new T.BufferAttribute(col, 3));
    parts.push({ g, bone: rg.bones[boneName] });
  };
  const coat = winter ? spec.coatWinter : spec.coat;
  spec = Object.assign({}, spec, winter ? { face: spec.faceWinter || spec.face, legs: spec.legsWinter || spec.legs } : {});
  const base = SPECIES[Object.keys(SPECIES).find((k) => SPECIES[k].name === spec.name)]; // identity checks below use the original
  const { L, R, W } = rg;
  const belly = C(spec.belly), accent = C(spec.accent);
  // torso: a capsule along z, belly paler, rump patch / chest blaze
  const torso = new T.CapsuleGeometry(R, L, 10, 18).rotateX(Math.PI / 2).scale(W, 1, 1);
  { // sculpt: deep chest, tucked flank, rounded rump, a slight rise at the withers
    const tp = torso.attributes.position, half = L / 2 + R, sp = spec.shape || {};
    const chest = (sp.chest ?? 0.22) * 1.6, tuck = (sp.tuck ?? 0.22) * 1.4, withers = (sp.withers ?? 0.08) * 1.5, rump = sp.rump ?? 0.05;
    for (let i = 0; i < tp.count; i++) {
      let x = tp.getX(i), y = tp.getY(i), z = tp.getZ(i);
      const t = z / half, front = Math.max(0, t), back = Math.max(0, -t);
      if (y < 0) y *= 1 + chest * Math.sin(Math.min(1, front * 1.6) * Math.PI * 0.5) * (1 - front * 0.4) - tuck * Math.sin(Math.min(1, back * 1.7) * Math.PI * 0.5);
      else y *= 1 + withers * Math.exp(-Math.pow((t - 0.55) / 0.22, 2)) + rump * Math.exp(-Math.pow((t + 0.6) / 0.2, 2));
      x *= 1 - 0.12 * front * front + 0.05 * Math.exp(-Math.pow((t + 0.5) / 0.25, 2));
      tp.setXYZ(i, x, y, z);
    }
  }
  add(torso, 'body', coat, (c, x, y, z) => {
    if (y > R * 0.75) c.multiplyScalar(0.84); // darker along the spine
    if (y < -R * 0.5) c.lerp(belly, clamp((-R * 0.5 - y) / (R * 0.35), 0, 1));
    if (base === SPECIES.elk && z < -L * 0.45 && y > -R * 0.4) c.lerp(accent, 0.85);
    if (base === SPECIES.deer && z < -L * 0.55 && y < R * 0.2) c.lerp(accent, 0.55);
    if (base === SPECIES.fox && z > L * 0.3 && y < 0) c.lerp(accent, 0.8);
    c.multiplyScalar(0.93 + 0.1 * Math.sin(x * 23 + z * 17 + y * 11));
  });
  for (const sx of [1, -1]) {
    add(new T.SphereGeometry(R * 0.62, 10, 8).scale(0.55, 1.05, 0.9).translate(sx * R * W * 0.52, -R * 0.12, L * 0.42), 'body', coat);
    add(new T.SphereGeometry(R * 0.7, 10, 8).scale(0.55, 1.0, 1.0).translate(sx * R * W * 0.5, -R * 0.05, -L * 0.42), 'body', coat);
  }
  if (spec.hump) add(new T.SphereGeometry(R * 0.85, 12, 8).scale(W * 0.95, 0.9, 1.1).translate(0, R * 0.25, L * 0.32), 'body', coat);
  // neck
  const nl = spec.neckLen, nr = spec.neckR;
  add(new T.CylinderGeometry(nr * 0.8, nr * 1.65, nl + nr * 1.5, 12, 3).rotateX(Math.PI / 2).scale(1, 1.25, 1).translate(0, 0, nl * 0.42), 'neck', spec.neckCol || coat,
    (c, x, y) => { if (y < -nr * 0.4) c.lerp(belly, 0.35); });
  // head, muzzle, nose, eyes, ears
  const hl = spec.headLen, hr = spec.headR;
  add(new T.SphereGeometry(1, 12, 9).scale(hr * 0.95, hr, hl * 0.5).translate(0, 0, hl * 0.3), 'head', spec.face);
  if (spec.muzzle > 0.04) add(new T.CylinderGeometry(hr * 0.42, hr * 0.7, spec.muzzle, 9).rotateX(Math.PI / 2).translate(0, -hr * 0.25, hl * 0.55 + spec.muzzle * 0.5), 'head', spec.face,
    (c, x, y) => { if (y < -hr * 0.45 && spec !== SPECIES.bear) c.lerp(belly, 0.5); });
  add(new T.SphereGeometry(hr * 0.24, 6, 5).translate(0, -hr * 0.2, hl * 0.55 + spec.muzzle + hr * 0.05), 'head', spec.dark);
  for (const sx of [1, -1]) add(new T.SphereGeometry(hr * 0.13, 6, 5).translate(sx * hr * 0.82, hr * 0.28, hl * 0.42), 'head', spec.dark);
  for (const sx of [1, -1]) {
    let e;
    if (spec.ears === 'round') e = new T.SphereGeometry(spec.earLen, 8, 6).scale(1, 1, 0.45).translate(sx * hr * 0.75, hr * 0.85, hl * 0.12);
    else if (spec.ears === 'long') e = new T.CapsuleGeometry(spec.earLen * 0.18, spec.earLen, 4, 8).scale(1, 1, 0.45).rotateZ(sx * -0.18).rotateX(-0.35).translate(sx * hr * 0.4, hr + spec.earLen * 0.55, hl * 0.05);
    else e = new T.ConeGeometry(spec.earLen * 0.4, spec.earLen, 8).scale(1, 1, 0.5).rotateZ(sx * -0.55).translate(sx * (hr * 0.75 + spec.earLen * 0.2), hr * 0.75 + spec.earLen * 0.3, hl * 0.12);
    add(e, 'head', base === SPECIES.fox ? '#2a1d16' : spec.face);
  }
  // antlers: main beams sweeping back and up, with tines
  if (rg.bull && spec.antlers) {
    const big = spec.antlers === 'elk', r0 = big ? 0.028 : 0.016, beam = big ? 0.95 : 0.42, tines = big ? 5 : 3, tc = '#d8c8a8';
    for (const sx of [1, -1]) {
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(new T.Vector3(sx * (hr * 0.5 + Math.sin(t * 1.4) * beam * 0.4), hr * 0.8 + t * beam * 0.75, hl * 0.15 - Math.sin(t * 2.2) * beam * 0.45 + t * t * beam * 0.25)); }
      const curve = new T.CatmullRomCurve3(pts);
      add(new T.TubeGeometry(curve, 10, r0, 5, false), 'head', tc);
      for (let k = 1; k <= tines; k++) {
        const t = 0.18 + (k / (tines + 0.6)) * 0.78, p = curve.getPoint(t), tl = (big ? 0.32 : 0.16) * (1 - t * 0.35);
        const g = new T.CylinderGeometry(r0 * 0.3, r0 * 0.8, tl, 5).translate(0, tl / 2, 0).rotateX(0.55).rotateZ(-sx * 0.2).translate(p.x, p.y, p.z);
        add(g, 'head', tc);
      }
    }
  }
  // legs: tapered upper and lower, hooves or paws
  const lr = spec.legR, up = rg.up, lo = rg.lo;
  for (const s of ['L', 'R']) for (const e of ['F', 'H']) {
    const thick = e === 'H' ? 1.35 : 1.15;
    add(new T.CylinderGeometry(lr * thick * 1.25, lr * 1.05, up + lr * 2, 7).translate(0, -up / 2, 0), 'hip' + e + s, spec.legs,
      (c, x, y) => { c.lerp(C(coat), clamp((y + up * 0.35) / (up * 0.35), 0, 1)); });
    add(new T.CylinderGeometry(lr, lr * 0.8, lo, 6).translate(0, -lo / 2, 0), 'knee' + e + s, spec.legs);
    if (spec.feet === 'hoof') add(new T.CylinderGeometry(lr * 0.85, lr * 1.05, lr * 1.6, 6).translate(0, -lo + lr * 0.5, lr * 0.15), 'knee' + e + s, spec.dark);
    else add(new T.SphereGeometry(lr * 1.35, 7, 5).scale(1, 0.55, 1.5).translate(0, -lo + lr * 0.5, lr * 0.5), 'knee' + e + s, base === SPECIES.rabbit && e === 'H' ? spec.legs : spec.dark);
  }
  if (base === SPECIES.rabbit) { // big hind haunches
    for (const sx of [1, -1]) add(new T.SphereGeometry(R * 0.7, 9, 7).scale(0.6, 1, 1.2).translate(sx * R * 0.55, -R * 0.15, -L * 0.35), 'body', coat);
  }
  // tail
  const tl = spec.tailLen;
  if (spec.tail === 'brush') add(new T.CapsuleGeometry(tl * 0.17, tl * 0.75, 5, 9).rotateX(Math.PI / 2).translate(0, 0, -tl * 0.5), 'tail', coat,
    (c, x, y, z) => { if (spec.tailTip && z < -tl * 0.86) c.set(spec.accent); });
  else if (spec.tail === 'flag') add(new T.ConeGeometry(tl * 0.3, tl, 8).rotateX(-Math.PI / 2).scale(1, 0.55, 1).translate(0, 0, -tl * 0.4), 'tail', coat,
    (c, x, y) => { if (y < 0) c.set(spec.accent); });
  else if (spec.tail === 'puff') add(new T.SphereGeometry(tl, 8, 6).translate(0, 0, -tl * 0.4), 'tail', spec.accent);
  else add(new T.ConeGeometry(Math.max(tl * 0.45, 0.02), tl, 6).rotateX(-Math.PI / 2).translate(0, 0, -tl * 0.4), 'tail', spec.antlers === 'elk' ? spec.accent : coat);

  // bind: move every part into model space at rest and give it a rigid skin weight to its bone
  rg.root.updateMatrixWorld(true);
  const pos = [], nor = [], col = [], si = [], sw = [];
  for (const { g, bone } of parts) {
    g.applyMatrix4(bone.matrixWorld); // also carries the smooth normals into model space
    const bi = rg.list.indexOf(bone), n = g.attributes.position.count;
    pos.push(...g.attributes.position.array); nor.push(...g.attributes.normal.array); col.push(...g.attributes.color.array);
    for (let i = 0; i < n; i++) { si.push(bi, 0, 0, 0); sw.push(1, 0, 0, 0); }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
  geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.6; // room for running poses
  return geo;
}

// ------------------------------------------------------------------ the herd
const animals = [];
const geoCache = new Map();
let furMat = null;
const GAIT = { // leg phase offsets: LF, RF, LH, RH
  walk: [0.25, 0.75, 0.0, 0.5], trot: [0.0, 0.5, 0.5, 0.0], bound: [0.0, 0.08, 0.5, 0.58], amble: [0.0, 0.5, 0.25, 0.75], hop: [0.0, 0.0, 0.5, 0.5],
};
let seed = 1337;
const rnd = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646; };

function validSpot(x, z) {
  if (Math.abs(x) > 1080 || Math.abs(z) > 1080) return false;
  const y = api.groundY(x, z); if (y < api.WATER + 0.45) return false;
  const q = api.nearestRoad(x, z, {}); if (q.road >= 0 && q.d - q.hw < 3.5) return false;
  const s = Math.abs(api.terrainH(x + 2, z) - api.terrainH(x - 2, z)) + Math.abs(api.terrainH(x, z + 2) - api.terrainH(x, z - 2));
  return s < 2.6; // no cliff faces
}
function findSpot(cx, cz, rMin, rMax, tries = 40) {
  for (let i = 0; i < tries; i++) {
    const a = rnd() * Math.PI * 2, r = rMin + rnd() * (rMax - rMin), x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
    if (validSpot(x, z)) return [x, z];
  }
  return null;
}

function spawn(kind, x, z, home, herd) {
  const spec = SPECIES[kind];
  const bull = !!spec.antlers && rnd() < spec.antlerChance;
  const sc = (kind === 'elk' && bull ? 1.08 : 1) * (0.9 + rnd() * 0.18);
  const winter = api.snow() > 0.5;
  const key = kind + (bull ? 'B' : '') + (winter ? 'W' : '');
  const rg = rig(spec, bull);
  if (!geoCache.has(key)) geoCache.set(key, buildGeometry(spec, rg, winter));
  const mesh = new T.SkinnedMesh(geoCache.get(key), furMat);
  mesh.add(rg.root); mesh.updateMatrixWorld(true); mesh.bind(new T.Skeleton(rg.list));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.scale.setScalar(sc);
  mesh.name = 'wildlife-' + kind;
  api.scene.add(mesh);
  const a = {
    kind, spec, mesh, rg, bull, sc, x, z, yaw: rnd() * Math.PI * 2, speed: 0, want: 0, state: 'graze', t: 2 + rnd() * 8,
    tx: x, tz: z, home, herd, phase: rnd(), chk: rnd() * 0.3, okAhead: true, fdx: 0, fdz: 1, hp: spec.hp * sc, wounded: false, downT: 0, roll: 0, atkT: 0, strikes: 0, graze: 1, alertK: 0, look: 0, vis: 0, logged: false, winter, key, hopY: 0, pitch: 0, flick: 0,
  };
  mesh.position.set(x, api.groundY(x, z), z); mesh.rotation.y = a.yaw;
  animals.push(a);
  return a;
}

function populate() {
  const places = window.GOALocations?.list?.() || [];
  const at = (id) => places.find((p) => p.id === id);
  const plan = {
    'long-valley': [['deer', 4, 60, 150], ['coyote', 2, 90, 220], ['rabbit', 5, 18, 90], ['fox', 1, 40, 120], ['bear', 1, 160, 260]],
    'river-valley': [['deer', 5, 45, 130], ['elk', 3, 110, 210], ['bear', 1, 70, 160], ['fox', 2, 30, 110], ['rabbit', 6, 15, 80]],
    'snowy-mountain': [['elk', 4, 80, 190], ['coyote', 3, 60, 170], ['fox', 1, 35, 110], ['rabbit', 4, 15, 70]],
  };
  for (const [id, groups] of Object.entries(plan)) {
    const p = at(id); if (!p) continue;
    for (const [kind, n, rMin, rMax] of groups) {
      const herdy = kind === 'deer' || kind === 'elk' || kind === 'coyote';
      if (herdy) {
        const c = findSpot(p.x, p.z, rMin, rMax); if (!c) continue;
        const herd = { x: c[0], z: c[1] };
        for (let i = 0; i < n; i++) { const s = findSpot(c[0], c[1], 1, 9) || c; spawn(kind, s[0], s[1], { x: c[0], z: c[1], r: 28 }, herd); }
      } else {
        for (let i = 0; i < n; i++) { const s = findSpot(p.x, p.z, rMin, rMax); if (s) spawn(kind, s[0], s[1], { x: s[0], z: s[1], r: kind === 'bear' ? 45 : 22 }, null); }
      }
    }
  }
  console.info('Wildlife ready:', animals.length, 'animals');
}

// ------------------------------------------------------------------ behaviour
function pickTarget(a) {
  const h = a.herd || a.home;
  for (let i = 0; i < 12; i++) {
    const ang = rnd() * Math.PI * 2, r = rnd() * a.home.r, x = h.x + Math.sin(ang) * r, z = h.z + Math.cos(ang) * r;
    if (validSpot(x, z)) { a.tx = x; a.tz = z; return true; }
  }
  a.tx = a.home.x; a.tz = a.home.z; return false;
}

const carP = { x: 0, z: 0, sp: 0, foot: false };
let hostile = false, night = false;
function think(a, dt) {
  const s = a.spec;
  if (a.state === 'down') { a.speed = 0; return 1e9; }
  const dx = a.x - carP.x, dz = a.z - carP.z, dCar = Math.hypot(dx, dz);
  // on foot you are quieter: walking lets you close in, running gives you away
  const footK = carP.foot ? (carP.sp > 3 ? 0.9 : carP.sp > 0.4 ? 0.55 : 0.4) : 1;
  const scare = api.S.started ? (s.flee + carP.sp * 1.1) * footK : 0;
  const notice = api.S.started ? (s.alert + carP.sp * 1.5) * footK : 0;
  a.t -= dt; a.chk -= dt; a.atkT -= dt;
  // predators turn on you: in Survival, bears and (after dark) coyotes may charge; a wounded bear always might
  const predator = a.kind === 'bear' || a.kind === 'coyote';
  if (carP.foot && predator && a.state !== 'charge' && a.state !== 'flee' && a.strikes < 3 && dCar < (a.kind === 'bear' ? 28 : 22)
      && ((hostile && (a.kind === 'bear' || night)) || (a.kind === 'bear' && a.wounded))) { a.state = 'charge'; a.t = 14; }
  if (a.state === 'charge') {
    a.want = s.run * (a.kind === 'bear' ? 0.75 : 0.85); a.tx = carP.x; a.tz = carP.z;
    if (dCar < (a.kind === 'bear' ? 2.3 : 1.6) && a.atkT <= 0) { a.atkT = a.kind === 'bear' ? 1.7 : 1.1; a.strikes++; window.GOAPlayer?.hurt?.(a.kind === 'bear' ? 22 : 9, a); }
    if (a.t <= 0 || a.strikes >= 3 || !carP.foot || dCar > 70) { a.state = 'flee'; }
  } else if (dCar < scare && a.state !== 'flee') { a.state = 'flee'; a.t = 0; if (a.herd) { a.herd.x = a.x + dx / dCar * 60; a.herd.z = a.z + dz / dCar * 60; } }
  switch (a.state) {
    case 'graze':
      a.want = 0;
      if (dCar < notice) { a.state = 'alert'; a.t = 2 + rnd() * 3; }
      else if (a.t <= 0) { pickTarget(a); a.state = 'walk'; a.t = 25; }
      break;
    case 'walk': {
      a.want = s.walk;
      if (dCar < notice) { a.state = 'alert'; a.t = 2 + rnd() * 3; break; }
      const d = Math.hypot(a.tx - a.x, a.tz - a.z);
      if (d < 1.2 || a.t <= 0) { a.state = 'graze'; a.t = 5 + rnd() * 12; }
      break;
    }
    case 'alert':
      a.want = 0;
      if (dCar > notice * 1.15 && a.t <= 0) { a.state = 'graze'; a.t = 3 + rnd() * 6; }
      break;
    case 'charge': break;
    case 'flee': {
      a.want = s.run * (a.wounded ? 0.8 : 1);
      // run away from the vehicle, bending toward open ground and away from water
      let fx = dx / Math.max(dCar, 0.01), fz = dz / Math.max(dCar, 0.01);
      if (a.kind === 'rabbit') { const zig = Math.sin(performance.now() * 0.004 + a.phase * 20) * 0.7; const c = Math.cos(zig), sn = Math.sin(zig); [fx, fz] = [fx * c - fz * sn, fx * sn + fz * c]; }
      if (a.chk <= 0) {
        let bestX = fx, bestZ = fz;
        if (!validSpot(a.x + fx * 6, a.z + fz * 6)) {
          for (const turn of [0.6, -0.6, 1.2, -1.2, 1.8, -1.8]) {
            const c = Math.cos(turn), sn = Math.sin(turn), nx = fx * c - fz * sn, nz = fx * sn + fz * c;
            if (validSpot(a.x + nx * 6, a.z + nz * 6)) { bestX = nx; bestZ = nz; break; }
          }
        }
        a.fdx = bestX; a.fdz = bestZ;
      }
      a.tx = a.x + a.fdx * 20; a.tz = a.z + a.fdz * 20;
      if (dCar > s.calm && !a.panic) { a.state = 'walk'; a.home.x = a.x; a.home.z = a.z; if (a.herd) { a.herd.x = a.x; a.herd.z = a.z; } pickTarget(a); a.t = 20; }
      break;
    }
  }
  // steer and move
  a.speed = damp(a.speed, a.want, a.want > a.speed ? 3.2 : 4.5, dt);
  if (a.speed > 0.05) {
    const goal = Math.atan2(a.tx - a.x, a.tz - a.z);
    a.yaw += clamp(wrapA(goal - a.yaw), -1, 1) * Math.min(1, dt * (a.state === 'flee' || a.state === 'charge' ? 5 : 2.2));
    if (a.panic > 0) a.panic = Math.max(0, a.panic - dt);
    if (a.chk <= 0 && a.state !== 'flee' && a.state !== 'charge') a.okAhead = validSpot(a.x + Math.sin(a.yaw) * 2.5, a.z + Math.cos(a.yaw) * 2.5);
    if (a.okAhead || a.state === 'flee' || a.state === 'charge') { a.x += Math.sin(a.yaw) * a.speed * dt; a.z += Math.cos(a.yaw) * a.speed * dt; }
    else { pickTarget(a); a.okAhead = true; }
    if (a.state === 'flee' && api.groundY(a.x, a.z) < api.WATER + 0.2) { a.x -= Math.sin(a.yaw) * a.speed * dt; a.z -= Math.cos(a.yaw) * a.speed * dt; a.yaw += 1.2 * dt * 3; }
  } else if (a.state === 'alert') {
    a.yaw += clamp(wrapA(Math.atan2(-dx, -dz) - a.yaw), -1, 1) * dt * 1.2; // turn to face the vehicle
  }
  // never get run over: a firm shove out of the vehicle's way
  if (a.chk <= 0) a.chk = 0.25 + rnd() * 0.1;
  if (dCar < 3.2 && api.S.started && !carP.foot) { a.x = carP.x + dx / Math.max(dCar, 0.01) * 3.2; a.z = carP.z + dz / Math.max(dCar, 0.01) * 3.2; }
  return dCar;
}

function pose(a, dt, time) {
  const { rg, spec } = a, b = rg.bones;
  const gy = a.ground || api.groundY;
  if (a.state === 'down') {
    a.downT += dt; a.roll = Math.min(Math.PI / 2 * 0.92, a.roll + dt * 3.2);
    for (const n of ['hipFL', 'hipFR', 'hipHL', 'hipHR']) b[n].rotation.x = damp(b[n].rotation.x, n.includes('F') ? -0.5 : 0.5, 4, dt);
    for (const n of ['kneeFL', 'kneeFR', 'kneeHL', 'kneeHR']) b[n].rotation.x = damp(b[n].rotation.x, 0.3, 4, dt);
    b.neck.rotation.x = damp(b.neck.rotation.x, 0.25, 3, dt); b.body.position.y = damp(b.body.position.y, rg.R * 0.9, 4, dt);
    a.mesh.position.set(a.x, gy(a.x, a.z) + 0.02, a.z); a.mesh.rotation.set(0, a.yaw, a.roll, 'YXZ');
    return;
  }
  const moving = clamp(a.speed / Math.max(spec.walk, 0.5), 0, 1);
  const running = clamp((a.speed - spec.walk * 1.4) / (spec.run * 0.5), 0, 1);
  const gaitName = running > 0.35 ? spec.gait : (spec.gait === 'hop' ? 'hop' : 'walk');
  const offs = GAIT[gaitName];
  const stride = (rg.up + rg.lo) * (running > 0.35 ? 2.4 : 1.25) * a.sc;
  a.phase = (a.phase + (a.speed * dt) / Math.max(stride, 0.05)) % 1;
  const swing = (0.18 + running * 0.45) * moving;
  const legs = [['hipFL', 'kneeFL'], ['hipFR', 'kneeFR'], ['hipHL', 'kneeHL'], ['hipHR', 'kneeHR']];
  const hoofed = spec.feet === 'hoof', hipRest = hoofed ? 0.32 : 0.22, hockRest = hoofed ? -0.62 : -0.45, fRest = 0.06;
  for (let i = 0; i < 4; i++) {
    const ph = (a.phase + offs[i]) * Math.PI * 2, front = i < 2;
    const lift = Math.max(0, Math.cos(ph)) * (0.5 + running * 0.9) * moving;
    b[legs[i][0]].rotation.x = (front ? -fRest : hipRest) - Math.sin(ph) * swing * (front ? 1 : 1.1);
    b[legs[i][1]].rotation.x = front ? fRest * 1.6 + lift : hockRest - lift * 0.8;
  }
  const drop = rg.up * (1 - Math.cos(hipRest)) + rg.lo * (1 - Math.cos(hipRest + hockRest)) * 0.85;
  // body: bob, rock on the gallop, rabbit hop arc
  let bob = 0, rock = 0;
  if (gaitName === 'hop') { const h = Math.max(0, Math.sin(a.phase * Math.PI * 2)); bob = h * (0.06 + running * 0.22) * moving / a.sc; rock = -Math.cos(a.phase * Math.PI * 2) * 0.25 * moving; }
  else if (running > 0.35 && (gaitName === 'bound')) { bob = Math.abs(Math.sin(a.phase * Math.PI * 2)) * rg.H * 0.18 * running; rock = Math.sin(a.phase * Math.PI * 2) * 0.22 * running; }
  else bob = Math.abs(Math.sin(a.phase * Math.PI * 4)) * rg.H * 0.03 * moving;
  b.body.position.y = rg.H + bob - drop;
  b.body.rotation.x = rock;
  // head: graze low when still, raised and turned when alert, stretched forward on the run
  const grazeT = a.state === 'graze' ? 1 : 0, alertT = a.state === 'alert' || a.state === 'charge' ? 1 : 0;
  a.graze = damp(a.graze, grazeT, 2.2, dt); a.alertK = damp(a.alertK, alertT, 4, dt);
  const nibble = a.graze * Math.max(0, Math.sin(time * 1.7 + a.phase * 9)) * 0.08;
  const down = spec === SPECIES.bear ? 0.55 : spec.neckUp + 0.55;
  b.neck.rotation.x = -spec.neckUp + a.graze * down + nibble - a.alertK * 0.22 + running * spec.neckUp * 0.45;
  b.head.rotation.x = spec.neckUp * 0.92 - a.graze * 0.25 + a.alertK * 0.1;
  const toCar = wrapA(Math.atan2(carP.x - a.x, carP.z - a.z) - a.yaw);
  a.look = damp(a.look, a.alertK * clamp(toCar, -1.1, 1.1), 3, dt);
  b.neck.rotation.y = a.look * 0.6; b.head.rotation.y = a.look * 0.4;
  // tail: deer flag the white tail when alarmed; others flick or stream
  const alarm = a.state === 'flee' ? 1 : a.alertK;
  a.flick = damp(a.flick, alarm, 5, dt);
  // (positive x tips the tail up, negative lets it hang)
  if (spec.tail === 'flag') b.tail.rotation.x = -0.75 + a.flick * 1.9 + Math.sin(time * 9 + a.phase) * 0.05 * (1 - alarm);
  else if (spec.tail === 'brush') b.tail.rotation.x = -(spec === SPECIES.coyote ? 0.75 : 0.45) + running * 0.35 + Math.sin(time * 2.1 + a.phase * 7) * 0.06;
  else b.tail.rotation.x = Math.sin(time * 4 + a.phase * 11) * 0.12;
  // place on the ground, pitched to the slope
  const y = gy(a.x, a.z), half = rg.L * 0.5 * a.sc;
  const yf = gy(a.x + Math.sin(a.yaw) * half, a.z + Math.cos(a.yaw) * half), yb = gy(a.x - Math.sin(a.yaw) * half, a.z - Math.cos(a.yaw) * half);
  a.pitch = damp(a.pitch, clamp(Math.atan2(yb - yf, half * 2), -0.5, 0.5), 8, dt);
  a.mesh.position.set(a.x, y, a.z); a.mesh.rotation.set(a.pitch, a.yaw, 0, 'YXZ');
}

// ------------------------------------------------------------------ field journal
const STORE = 'goa-field-journal-v1';
let journal = {};
try { journal = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { journal = {}; }
function saveJournal() { try { localStorage.setItem(STORE, JSON.stringify(journal)); } catch (e) { /* private mode */ } }
function record(a, dist) {
  const j = journal[a.kind] || (journal[a.kind] = { seen: 0, first: null, closest: 9999, where: '' });
  const first = !j.seen;
  j.seen++; j.closest = Math.min(j.closest, Math.round(dist)); if (!j.first) j.first = new Date().toISOString().slice(0, 10);
  j.where = placeName(a.x, a.z);
  saveJournal(); renderJournal();
  const count = ORDER.filter((k) => journal[k]?.seen).length;
  api.toast(first ? `New species spotted: ${a.spec.name} · Field Journal ${count}/6` : `Spotted: ${a.spec.name}${a.bull ? ' (bull)' : ''}`, first ? 3.4 : 2);
  updateBadge();
}
function placeName(x, z) {
  let best = 'the valley', bd = 1e9;
  for (const p of window.GOALocations?.list?.() || []) { const d = Math.hypot(p.x - x, p.z - z); if (d < bd) { bd = d; best = p.name; } }
  return best;
}
function updateBadge() { const el = $('wild-count'); if (el) el.textContent = `${ORDER.filter((k) => journal[k]?.seen).length}/6`; }

let panel = null;
function renderJournal() {
  if (!panel) return;
  const list = panel.querySelector('#journal-cards'); list.innerHTML = '';
  const near = nearestOf();
  for (const k of ORDER) {
    const s = SPECIES[k], j = journal[k], card = document.createElement('article');
    card.className = j?.seen ? 'seen' : 'unseen';
    const sw = document.createElement('div'); sw.className = 'swatch'; sw.style.background = `linear-gradient(135deg, ${s.coat}, ${s.legs})`;
    sw.innerHTML = `<span>${j?.seen ? '✓' : '?'}</span>`;
    const body = document.createElement('div');
    const h = document.createElement('h3'); h.textContent = s.name;
    const latin = document.createElement('p'); latin.className = 'latin'; latin.textContent = s.latin;
    const note = document.createElement('p'); note.textContent = s.note;
    const meta = document.createElement('p'); meta.className = 'meta';
    meta.textContent = j?.seen ? `Seen ${j.seen}× · closest ${j.closest} m · last near ${j.where}${j.harvested ? ` · harvested ${j.harvested} (best ${j.best} kg)` : ''}` : `Not yet recorded · habitat: ${s.habitat}`;
    body.append(h, latin, note, meta);
    if (near[k]) { const hint = document.createElement('p'); hint.className = 'hint'; hint.textContent = `Nearest: about ${near[k]}`; body.append(hint); }
    card.append(sw, body); list.append(card);
  }
  const extra = panel.querySelector('#journal-extra'); extra.innerHTML = '';
  for (const section of window.GOAJournalSections || []) { try { const el = section(); if (el) extra.append(el); } catch (e) { console.warn(e); } }
}
function nearestOf() {
  const out = {};
  for (const k of ORDER) {
    let bd = 1e9, ba = null;
    for (const a of animals) if (a.kind === k) { const d = Math.hypot(a.x - carP.x, a.z - carP.z); if (d < bd) { bd = d; ba = a; } }
    if (!ba) continue;
    const ang = Math.atan2(ba.x - carP.x, ba.z - carP.z), dirs = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];
    // the map draws +z as south (screen down), so north is -z
    const compass = dirs[(Math.round(((Math.PI - ang) / (Math.PI * 2)) * 8) + 8) % 8];
    out[k] = bd > 1000 ? `${(bd / 1000).toFixed(1)} km ${compass}` : `${Math.round(bd / 10) * 10} m ${compass}`;
  }
  return out;
}
function buildPanel() {
  panel = document.createElement('div'); panel.id = 'journal'; panel.className = 'sheet card'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Field journal');
  panel.innerHTML = '<div class="sethead"><b>FIELD JOURNAL · WILDLIFE</b><button id="journal-close" class="btn">Close</button></div>'
    + '<div class="journal-content"><p>Slow down near meadows, rivers and ridgelines. Keep an animal in view for a moment to log it. Drive gently: animals look up when a vehicle approaches and run if it comes too close.</p>'
    + '<div id="journal-cards"></div><div id="journal-extra"></div><p class="journal-note">Sightings are kept in this browser. <button id="journal-reset" class="btn">Clear journal</button></p></div>';
  document.body.append(panel);
  $('journal-close').onclick = () => open(false);
  $('journal-reset').onclick = () => { journal = {}; saveJournal(); for (const a of animals) a.logged = false; renderJournal(); updateBadge(); };
  const chip = document.createElement('button'); chip.className = 'chip'; chip.id = 'journalbtn'; chip.innerHTML = 'Wildlife <span id="wild-count">0/6</span>'; chip.onclick = () => open();
  $('tools')?.prepend(chip);
  addEventListener('keydown', (e) => { if (e.code === 'KeyJ' && !e.repeat && !e.target.closest('input,select,textarea')) { e.preventDefault(); open(); } });
  updateBadge();
}
function open(value) {
  const show = value === undefined ? !isOpen() : value;
  panel.classList.toggle('open', show);
  if (show) { api.openSettings?.(false); api.openMap?.(false); window.GOALocations?.close?.(); window.GOAExtension?.close?.(); for (const k in api.keys) api.keys[k] = 0; renderJournal(); }
}
function isOpen() { return !!panel?.classList.contains('open'); }

// ------------------------------------------------------------------ frame
let fr = null, projView = null, sph = null, reskinT = 0;
function frame(dt, time) {
  if (!animals.length) return;
  const cam = api.camera, vp = api.viewPos();
  const foot = window.GOAPlayer?.onFoot?.();
  if (foot) { const pp = window.GOAPlayer.position(); carP.x = pp.x; carP.z = pp.z; carP.sp = pp.speed; carP.foot = true; }
  else { carP.x = api.S.x; carP.z = api.S.z; carP.sp = api.S.started ? Math.hypot(api.S.vx || 0, api.S.vz || 0) : 0; carP.foot = false; }
  hostile = !!window.GOASurvival?.active?.(); night = !!window.GOASurvival?.isNight?.();
  cam.updateMatrixWorld(); projView.multiplyMatrices(cam.projectionMatrix, cam.matrixWorldInverse); fr.setFromProjectionMatrix(projView);
  // winter coats follow the season: swap geometry when the snow comes or goes
  reskinT -= dt;
  if (reskinT <= 0) {
    reskinT = 2; const winter = api.snow() > 0.5;
    for (const a of animals) if (a.winter !== winter && (a.kind === 'rabbit' || a.kind === 'deer' || a.kind === 'elk')) {
      a.winter = winter; const key = a.kind + (a.bull ? 'B' : '') + (winter ? 'W' : '');
      if (!geoCache.has(key)) geoCache.set(key, buildGeometry(a.spec, rig(a.spec, a.bull), winter));
      a.mesh.geometry = geoCache.get(key);
    }
  }
  for (const a of animals) {
    const d = Math.hypot(a.x - vp.x, a.z - vp.z);
    if (a.gone) { a.respawnT -= dt; if (a.respawnT <= 0 && d > 160) respawn(a); continue; }
    const active = d < 420 || a.state === 'flee' || a.state === 'charge';
    if (active) think(a, dt);
    const show = d < (a.kind === 'rabbit' ? 160 : a.kind === 'fox' ? 220 : 380);
    a.mesh.visible = show;
    if (!show) { a.vis = 0; continue; }
    pose(a, dt, time);
    a.mesh.castShadow = d < 90;
    // sighting: in view, near enough, for a moment
    sph.center.set(a.x, api.groundY(a.x, a.z) + a.spec.shoulder * a.sc * 0.6, a.z); sph.radius = a.spec.len * a.sc;
    if (a.state !== 'down' && d < a.spec.spot && fr.intersectsSphere(sph) && api.S.started) { a.vis += dt; if (a.vis > 0.9 && !a.logged) { a.logged = true; record(a, d); } }
    else a.vis = Math.max(0, a.vis - dt * 0.5);
  }
  if (isOpen()) { panelT -= dt; if (panelT <= 0) { panelT = 1; renderJournal(); } }
}
let panelT = 0;

function init(hooks) {
  api = hooks; T = window.THREE;
  fr = new T.Frustum(); projView = new T.Matrix4(); sph = new T.Sphere();
  initMaterial();
  buildPanel();
  populate();
}


// ------------------------------------------------------------------ hunting API (used by the on-foot player, AR and VR)
const _o = new Float64Array(3);
/** Find the first animal a shot from (ox,oy,oz) along unit (dx,dy,dz) would hit within maxD metres.
    Bodies are capsules along the spine plus a head sphere; chest and head hits count as vital. */
function raycast(ox, oy, oz, dx, dy, dz, maxD, list = animals) {
  let best = null;
  for (const a of list) {
    if (a.gone || !a.mesh.visible && list === animals) continue;
    const sc = a.sc, R = a.rg.R * sc * 1.05, half = a.rg.L * 0.5 * sc + R * 0.3;
    const fx = Math.sin(a.yaw), fz = Math.cos(a.yaw);
    const by = a.mesh.position.y + (a.state === 'down' ? R : a.rg.H * sc);
    const cx = a.x, cz = a.z;
    // closest approach between the shot ray and the spine segment (cx,by,cz) +/- f*half
    const px = cx - fx * half, pz = cz - fz * half, qx = fx * 2 * half, qz = fz * 2 * half;
    const wx = ox - px, wy = oy - by, wz = oz - pz;
    const aa = dx * dx + dy * dy + dz * dz, bb = dx * qx + dz * qz, cc = qx * qx + qz * qz, dd = dx * wx + dy * wy + dz * wz, ee = qx * wx + qz * wz;
    const den = aa * cc - bb * bb; let t = den > 1e-9 ? (bb * ee - cc * dd) / den : 0, u = den > 1e-9 ? (aa * ee - bb * dd) / den : 0;
    u = clamp(u, 0, 1); t = Math.max(0, (dx * (px + qx * u - ox) + dy * (by - oy) + dz * (pz + qz * u - oz)) / aa);
    if (t > maxD) continue;
    const hx = ox + dx * t - (px + qx * u), hy = oy + dy * t - by, hz = oz + dz * t - (pz + qz * u);
    let hit = Math.hypot(hx, hy, hz) < R, zone = u > 0.62 ? 'vital' : 'body';
    // head
    const hd = a.spec.neckLen * sc + a.spec.headLen * sc * 0.5, hx2 = cx + fx * (half + hd * 0.7), hz2 = cz + fz * (half + hd * 0.7), hy2 = by + hd * 0.55;
    const t2 = Math.max(0, dx * (hx2 - ox) + dy * (hy2 - oy) + dz * (hz2 - oz));
    if (!hit && t2 < maxD && Math.hypot(ox + dx * t2 - hx2, oy + dy * t2 - hy2, oz + dz * t2 - hz2) < a.spec.headR * sc * 1.6) { hit = true; t = t2; zone = 'vital'; }
    if (hit && (!best || t < best.dist)) best = { animal: a, dist: t, zone, point: [ox + dx * t, oy + dy * t, oz + dz * t] };
  }
  return best;
}
/** Apply a hit. Returns 'down', 'wounded' or null. */
function hit(a, damage, zone, fromX, fromZ) {
  if (!a || a.state === 'down' || a.gone) return null;
  a.hp -= damage * (zone === 'vital' ? 1.7 : 1);
  if (a.hp <= 0) {
    a.state = 'down'; a.speed = 0; a.downT = 0; a.roll = 0; a.yaw += (Math.random() - 0.5) * 0.6;
    return 'down';
  }
  a.wounded = true; a.panic = 6;
  if (a.kind === 'bear' && carP.foot && Math.random() < 0.55) { a.state = 'charge'; a.t = 10; }
  else { a.state = 'flee'; if (a.herd) { a.herd.x = a.x + (a.x - fromX) * 2; a.herd.z = a.z + (a.z - fromZ) * 2; } }
  return 'wounded';
}
/** A gunshot or loud noise: everything nearby bolts. */
function noise(x, z, radius) {
  for (const a of animals) {
    if (a.gone || a.state === 'down' || a.state === 'charge') continue;
    if (Math.hypot(a.x - x, a.z - z) < radius * (a.kind === 'bear' ? 0.7 : 1)) { a.state = 'flee'; a.panic = 3; a.fdx = Math.sign(a.x - x) || 1; a.fdz = Math.sign(a.z - z) || 1; a.chk = 0; }
  }
}
function nearestDown(x, z, r) {
  let best = null, bd = r;
  for (const a of animals) if (a.state === 'down' && !a.gone) { const d = Math.hypot(a.x - x, a.z - z); if (d < bd) { bd = d; best = a; } }
  return best;
}
/** Tag a harvested animal: logs the trophy, removes it, and schedules a new animal out of sight later. */
function tag(a) {
  if (!a || a.state !== 'down') return null;
  const kg = Math.round(lerp(a.spec.kg[0], a.spec.kg[1], clamp((a.sc - 0.9) / 0.26, 0, 1) * 0.7 + Math.random() * 0.3) * (a.bull ? 1.15 : 1));
  const j = journal[a.kind] || (journal[a.kind] = { seen: 0, first: null, closest: 9999, where: '' });
  j.harvested = (j.harvested || 0) + 1; j.best = Math.max(j.best || 0, kg); if (!j.seen) { j.seen = 1; j.first = new Date().toISOString().slice(0, 10); }
  j.where = placeName(a.x, a.z); saveJournal(); renderJournal(); updateBadge();
  a.gone = true; a.mesh.visible = false; a.respawnT = 150 + rnd() * 120;
  return { kind: a.kind, name: a.spec.name, kg, bull: a.bull, meat: Math.max(1, Math.round(kg / 12)) };
}
function respawn(a) {
  const h = a.herd || a.home, s = findSpot(h.x, h.z, 10, 60) || [a.home.x, a.home.z];
  Object.assign(a, { x: s[0], z: s[1], gone: false, state: 'graze', t: 5, hp: a.spec.hp * a.sc, wounded: false, downT: 0, roll: 0, strikes: 0, speed: 0, logged: false, panic: 0 });
  a.mesh.visible = true;
}
/** A standalone animal (not part of the valley population), e.g. for AR. ground(x,z) gives the floor height. */
function makeAnimal(kind, opts = {}) {
  if (!T) T = window.THREE;
  if (!furMat) initMaterial();
  const spec = SPECIES[kind], bull = !!opts.bull, winter = !!opts.winter, key = kind + (bull ? 'B' : '') + (winter ? 'W' : '');
  const rg = rig(spec, bull);
  if (!geoCache.has(key)) geoCache.set(key, buildGeometry(spec, rig(spec, bull), winter));
  const mesh = new T.SkinnedMesh(geoCache.get(key), furMat);
  mesh.add(rg.root); mesh.updateMatrixWorld(true); mesh.bind(new T.Skeleton(rg.list)); mesh.castShadow = true;
  const sc = opts.scale || 1; mesh.scale.setScalar(sc);
  const a = { kind, spec, mesh, rg, bull, sc, x: opts.x || 0, z: opts.z || 0, yaw: opts.yaw || 0, speed: 0, want: 0, state: 'graze', t: 3, phase: Math.random(),
    graze: 1, alertK: 0, look: 0, flick: 0, pitch: 0, hp: spec.hp, roll: 0, downT: 0, ground: opts.ground || (() => 0), standalone: true };
  return { animal: a, pose: (dt, time) => pose(a, dt, time) };
}
function initMaterial() {
  furMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 1, metalness: 0 });
  furMat.onBeforeCompile = (sh) => {
    sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat rimK = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0); totalEmissiveRadiance += diffuseColor.rgb * rimK * 0.22;');
  };
  furMat.customProgramCacheKey = () => 'wildlife-fur';
}

window.GOAWildlife = { init, frame, open, isOpen, close() { open(false); }, species: SPECIES, animals, journal: () => journal,
  raycast, hit, noise, nearestDown, tag, makeAnimal, refresh() { renderJournal(); } };
})();

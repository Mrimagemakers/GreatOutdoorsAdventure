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

// ------------------------------------------------------------------ scanned-quality models
/* Deer and elk use a realistic rigged, textured cervid model ("Realistic Deer 3D Model 2.0" by WildMesh 3D, CC BY 4.0).
   Bulls carry its antlers (scaled down for white-tailed bucks); cows and does don't. Deer get a warmer, lighter coat.
   The game's own gait (graze, walk, trot, bound, flee, fall) is copied onto its skeleton every frame. Other species,
   and these two until the file arrives, use the sculpted bodies below. */
const MODEL = {
  url: 'assets/wildlife/cervid.glb', kinds: { elk: { antler: 1 }, deer: { antler: 0.62, recolor: true } },
  map: { body: 'Pelvis', neck: 'Neck1', head: 'Head', tail: 'Tail1', hipFL: 'LegFL1', kneeFL: 'LegFL2', hipFR: 'LegFR1', kneeFR: 'LegFR2', hipHL: 'LegBL1', kneeHL: 'LegBL2', hipHR: 'LegBR1', kneeHR: 'LegBR2' },
};
const RT_ORDER = ['body', 'neck', 'head', 'tail', 'hipFL', 'kneeFL', 'hipFR', 'kneeFR', 'hipHL', 'kneeHL', 'hipHR', 'kneeHR'];
let modelSrc = null, modelLoading = false;
const modelTex = new Map();
function loadModel() {
  if (modelLoading || !T.GLTFLoader) return; modelLoading = true;
  new T.GLTFLoader().load(MODEL.url, (g) => {
    modelSrc = g;
    for (const a of animals) if (MODEL.kinds[a.kind] && !a.model) attachModel(a);
    for (const a of standaloneList) if (MODEL.kinds[a.kind] && !a.model) attachModel(a);
  }, undefined, (e) => console.warn('[wildlife] model unavailable, keeping sculpted deer and elk', e && e.message));
}
const standaloneList = [];
function cloneScene(scene) {
  const root = scene.clone(true), a = [], b = [];
  scene.traverse((o) => a.push(o)); root.traverse((o) => b.push(o));
  root.traverse((o) => { if (o.isSkinnedMesh) { const src = a[b.indexOf(o)]; o.bind(new T.Skeleton(src.skeleton.bones.map((x) => b[a.indexOf(x)])), src.bindMatrix); } });
  return root;
}
/** Deer coat from the elk texture: keep the fur detail, move the colours to tan-brown with a pale belly. */
function deerTexture(map) {
  if (modelTex.has('deer')) return modelTex.get('deer');
  const img = map.image, c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
  const g = c.getContext('2d'); g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, c.width, c.height), px = d.data;
  const stops = [[0, [52, 38, 27]], [0.3, [118, 86, 58]], [0.55, [150, 112, 76]], [0.8, [196, 170, 140]], [1, [236, 228, 214]]];
  for (let i = 0; i < px.length; i += 4) {
    const L = Math.min(1, (0.3 * px[i] + 0.59 * px[i + 1] + 0.11 * px[i + 2]) / 255 * 1.08 + 0.06);
    let k = 1; while (k < stops.length - 1 && stops[k][0] < L) k++;
    const [l0, c0] = stops[k - 1], [l1, c1] = stops[k], t = (L - l0) / (l1 - l0);
    for (let ch = 0; ch < 3; ch++) px[i + ch] = c0[ch] + (c1[ch] - c0[ch]) * t;
  }
  g.putImageData(d, 0, 0);
  const tex = new T.CanvasTexture(c); tex.flipY = map.flipY; tex.colorSpace = T.SRGBColorSpace; tex.wrapS = map.wrapS; tex.wrapT = map.wrapT; tex.anisotropy = 4;
  modelTex.set('deer', tex); return tex;
}
function attachModel(a) {
  if (!modelSrc || a.model) return;
  const cfg = MODEL.kinds[a.kind], mesh = a.mesh;
  const model = cloneScene(modelSrc.scene), bone = {};
  model.traverse((o) => {
    const m = /^([A-Za-z]+[0-9]?[A-Za-z]*\d?)_\d+$/.exec(o.name); if (o.isBone && m) bone[m[1]] = o;
    if (o.isMesh) {
      o.castShadow = true; o.receiveShadow = true; o.frustumCulled = false;
      if (/Antler/i.test(o.name) || /Antler/i.test(o.parent?.name || '')) o.visible = !!a.bull;
      else if (cfg.recolor && o.material?.map) { o.material = o.material.clone(); o.material.map = deerTexture(o.material.map); }
    }
  });
  // white-tailed bucks: shrink the antler racks toward where they meet the skull
  if (a.bull && cfg.antler !== 1 && bone.Head) {
    model.updateMatrixWorld(true);
    const hp = bone.Head.getWorldPosition(new T.Vector3());
    for (const node of bone.Head.children.filter((c) => /Antler/i.test(c.name))) {
      let best = 1e18; const base = new T.Vector3(), v = new T.Vector3();
      node.traverse((m) => { if (!m.isMesh) return; const P = m.geometry.attributes.position;
        for (let i = 0; i < P.count; i += 2) { v.fromBufferAttribute(P, i).applyMatrix4(m.matrixWorld); const dd = v.distanceToSquared(hp); if (dd < best) { best = dd; base.copy(v); } } });
      bone.Head.worldToLocal(base); // the rack's root, in the head's own frame
      node.position.sub(base).multiplyScalar(cfg.antler).add(base); node.scale.multiplyScalar(cfg.antler);
    }
  }
  const holder = new T.Group(); holder.name = 'model'; holder.rotation.y = -Math.PI / 2; holder.add(model);
  // size: the model's torso line (pelvis to chest, ~0.9 m up) to ours
  model.updateMatrixWorld(true);
  const pel = bone.Pelvis.getWorldPosition(new T.Vector3()), che = bone.Chest.getWorldPosition(new T.Vector3());
  const k = a.rg.H / ((pel.y + che.y) / 2); holder.scale.setScalar(k);
  const mid = pel.clone().add(che).multiplyScalar(0.5); // centre the torso over our body bone
  holder.position.set(-mid.z * k, 0, mid.x * k);
  // rest poses: ours from a fresh rig, the model's from its bind pose, both in the animal's own frame
  const fresh = rig(a.spec, a.bull); fresh.root.updateMatrixWorld(true);
  const restO = {}, restT = {}, tb = {};
  for (const n of RT_ORDER) { const t = bone[MODEL.map[n]]; if (!t) continue; tb[n] = t; restO[n] = fresh.bones[n].getWorldQuaternion(new T.Quaternion()); }
  mesh.add(holder); mesh.updateMatrixWorld(true);
  const mq = mesh.getWorldQuaternion(new T.Quaternion()), mi = mq.clone().invert();
  for (const n in tb) restT[n] = mi.clone().multiply(tb[n].getWorldQuaternion(new T.Quaternion()));
  const baseY = holder.position.y, restBody = fresh.bones.body.position.clone();
  a.model = holder; mesh.geometry = EMPTY || mesh.geometry;
  const gq = new T.Quaternion(), gi = new T.Quaternion(), q = new T.Quaternion(), pq = new T.Quaternion(), d = new T.Quaternion(), ID_Q = new T.Quaternion();
  a.retarget = () => {
    if (!holder.parent) return;
    mesh.updateWorldMatrix(true, false); a.rg.root.updateMatrixWorld(true); mesh.getWorldQuaternion(gq); gi.copy(gq).invert();
    const bp = a.rg.bones.body.position; holder.position.y = baseY + (bp.y - restBody.y);
    for (const n of RT_ORDER) {
      const t = tb[n]; if (!t) continue;
      a.rg.bones[n].getWorldQuaternion(q); d.copy(gi).multiply(q).multiply(pq.copy(restO[n]).invert()); // our rotation away from rest
      if (n.startsWith('hip') || n.startsWith('knee')) d.slerp(ID_Q, 0.3); // this skeleton's longer legs need a softer swing
      q.copy(gq).multiply(d).multiply(restT[n]);
      t.parent.updateWorldMatrix(true, false); t.parent.getWorldQuaternion(pq);
      t.quaternion.copy(pq.invert().multiply(q)); t.updateMatrix(); t.updateWorldMatrix(false, false);
    }
  };
  a.retarget();
}

// ------------------------------------------------------------------ sculpted bodies
/* Each animal is one smooth, continuous body: overlapping shapes (barrel, chest, haunches, muscled legs, neck, skull,
   muzzle, tail) are blended with a smooth union and meshed as a single surface, so the neck flows into the shoulders
   and the legs grow out of the body. Skin weights blend between neighbouring bones so joints bend without gaps. Ears,
   eyes, nose and antlers stay separate pieces. Fur grain comes from the material. */
const v3 = (x, y, z) => new T.Vector3(x, y, z);
function sdEllipsoid(x, y, z, rx, ry, rz) {
  const k0 = Math.hypot(x / rx, y / ry, z / rz), k1 = Math.hypot(x / (rx * rx), y / (ry * ry), z / (rz * rz));
  return k1 < 1e-9 ? -Math.min(rx, ry, rz) : k0 * (k0 - 1) / k1;
}
function sdRoundCone(px, py, pz, a, b, r1, r2) { // capsule whose radius runs from r1 at a to r2 at b
  const bax = b.x - a.x, bay = b.y - a.y, baz = b.z - a.z, pax = px - a.x, pay = py - a.y, paz = pz - a.z;
  const l2 = bax * bax + bay * bay + baz * baz, rr = r1 - r2, a2 = l2 - rr * rr, il2 = 1 / l2;
  const y = pax * bax + pay * bay + paz * baz, z = y - l2;
  const xx = (pax * l2 - bax * y), xy = (pay * l2 - bay * y), xz = (paz * l2 - baz * y), x2 = xx * xx + xy * xy + xz * xz;
  const y2 = y * y * l2, z2 = z * z * l2, k = Math.sign(rr) * rr * rr * x2;
  if (Math.sign(z) * a2 * z2 > k) return Math.sqrt(x2 + z2) * il2 - r2;
  if (Math.sign(y) * a2 * y2 < k) return Math.sqrt(x2 + y2) * il2 - r1;
  return (Math.sqrt(x2 * a2 * il2) + y * rr) * il2 - r1;
}
const smin = (a, b, k) => { const h = Math.max(k - Math.abs(a - b), 0) / k; return Math.min(a, b) - h * h * k * 0.25; };

function buildGeometry(spec, rg, winter) {
  const C = (hex) => new T.Color(hex);
  const coat = winter ? spec.coatWinter : spec.coat;
  spec = Object.assign({}, spec, winter ? { face: spec.faceWinter || spec.face, legs: spec.legsWinter || spec.legs } : {});
  const base = SPECIES[Object.keys(SPECIES).find((k) => SPECIES[k].name === spec.name)];
  const { L, R, W, up, lo } = rg, H = rg.H;
  const belly = C(spec.belly), accent = C(spec.accent), coatC = C(coat), legsC = C(spec.legs), faceC = C(spec.face), darkC = C(spec.dark);
  rg.root.updateMatrixWorld(true);
  // ---- shapes, each in its bone's frame
  const prims = [];
  const P = (bone, sd, k, color, cen, rad) => {
    const b = rg.bones[bone]; const m = b.matrixWorld.clone();
    prims.push({ bi: rg.list.indexOf(b), e: m.clone().invert().elements, sd, k, color, c: cen.clone().applyMatrix4(m), r: rad });
  };
  const sp = spec.shape || {}, chest = sp.chest ?? 0.22, tuck = sp.tuck ?? 0.22, withers = sp.withers ?? 0.08, rump = sp.rump ?? 0.05;
  const torsoCol = (c, x, y, z) => {
    c.copy(coatC);
    if (y > R * 0.7) c.multiplyScalar(0.86);
    if (y < -R * 0.45) c.lerp(belly, clamp((-R * 0.45 - y) / (R * 0.4), 0, 1));
    if (base === SPECIES.elk && z < -L * 0.42 && y > -R * 0.4) c.lerp(accent, 0.85);
    if (base === SPECIES.elk && z > L * 0.35) c.lerp(C(spec.neckCol || coat), clamp((z - L * 0.35) / (R * 0.6), 0, 1));
    if (base === SPECIES.deer && z < -L * 0.5 && y < R * 0.3) c.lerp(accent, 0.6);
    if (base === SPECIES.fox && z > L * 0.25 && y < -R * 0.1) c.lerp(accent, 0.85);
  };
  // barrel, chest and hindquarters
  P('body', (x, y, z) => sdEllipsoid(x, y - R * tuck * 0.25, z, R * W, R * (1 - tuck * 0.35), L * 0.5 + R * 0.35), R * 0.6, torsoCol, v3(0, 0, 0), L * 0.6 + R);
  P('body', (x, y, z) => sdEllipsoid(x, y + R * chest * 0.25, z - L * 0.3, R * W * 0.95, R * (1.02 + chest * 0.55), R * 1.15), R * 0.55, torsoCol, v3(0, 0, L * 0.3), R * 1.6);
  P('body', (x, y, z) => sdEllipsoid(x, y - R * rump * 0.4, z + L * 0.33, R * W * 1.02, R * (1.0 + rump * 0.5), R * 1.2), R * 0.55, torsoCol, v3(0, 0, -L * 0.33), R * 1.5);
  if (withers > 0.02) P('body', (x, y, z) => sdEllipsoid(x, y - R * 0.72, z - L * 0.36, R * W * 0.55, R * (0.35 + withers * 1.5), R * 0.75), R * 0.4, torsoCol, v3(0, R * 0.7, L * 0.36), R);
  if (spec.hump) P('body', (x, y, z) => sdEllipsoid(x, y - R * 0.45, z - L * 0.3, R * W * 0.85, R * 0.75, R * 0.9), R * 0.5, torsoCol, v3(0, R * 0.4, L * 0.3), R * 1.2);
  // neck
  const nl = spec.neckLen, nr = spec.neckR;
  const neckCol = (c, x, y) => { c.copy(C(spec.neckCol || coat)); if (y < -nr * 0.35) c.lerp(belly, base === SPECIES.bear ? 0 : 0.4); };
  P('neck', (x, y, z) => sdRoundCone(x, y * 0.85, z, v3(0, 0, -nr * 0.8), v3(0, 0, nl), nr * 1.75, nr * 1.0), nr * 1.2, neckCol, v3(0, 0, nl * 0.4), nl + nr * 2);
  // head: skull and muzzle
  const hl = spec.headLen, hr = spec.headR, mz = spec.muzzle;
  const headCol = (c, x, y, z) => {
    if (base === SPECIES.bear) { c.copy(coatC); c.lerp(faceC, clamp((z - hl * 0.45) / (mz * 0.6 + 1e-3), 0, 1)); return; } // black head, tan muzzle
    c.copy(faceC); if (y < -hr * 0.45) c.lerp(belly, 0.45); if (z > hl * 0.55 + mz * 0.75) c.multiplyScalar(0.72);
  };
  P('head', (x, y, z) => sdEllipsoid(x, y, z - hl * 0.25, hr * 0.98, hr * 1.02, hl * 0.48), hr * 0.5, headCol, v3(0, 0, hl * 0.25), hl * 0.6 + hr);
  if (mz > 0.03) P('head', (x, y, z) => sdRoundCone(x, y, z, v3(0, -hr * 0.18, hl * 0.4), v3(0, -hr * 0.3, hl * 0.55 + mz), hr * 0.62, hr * (base === SPECIES.bear ? 0.42 : 0.3)), hr * 0.55, headCol, v3(0, -hr * 0.2, hl * 0.5 + mz * 0.5), mz + hr);
  P('head', (x, y, z) => sdEllipsoid(x, y + hr * 0.5, z - hl * 0.42, hr * 0.62, hr * 0.42, hl * 0.32), hr * 0.4, headCol, v3(0, -hr * 0.5, hl * 0.42), hr);  // jaw and cheek
  // legs: muscled upper leg rooted in the body, slim lower leg, hoof or paw
  const lr = spec.legR;
  for (const s of ['L', 'R']) for (const e of ['F', 'H']) {
    const hind = e === 'H', hip = 'hip' + e + s, knee = 'knee' + e + s, mus = hind ? 2.7 : 2.2;
    const legCol = (c, x, y) => { c.copy(legsC); c.lerp(coatC, clamp((y + up * 0.25) / (up * 0.45), 0, 1)); if (base === SPECIES.fox) c.lerp(darkC, clamp((-y - up * 0.3) / (up * 0.4), 0, 0.8)); };
    P(hip, (x, y, z) => sdRoundCone(x, y, z, v3(0, R * 0.5, hind ? -lr * 0.8 : lr * 0.4), v3(0, -up * 0.98, 0), lr * mus * (hind ? 1.5 : 1.3), lr * 1.08), lr * 2.2, legCol, v3(0, -up * 0.3, 0), up + R);
    if (hind) P(hip, (x, y, z) => sdEllipsoid(x, y + up * 0.05, z + lr * 1.5, lr * 2.4, up * 0.5, lr * 3.0), lr * 2, legCol, v3(0, 0, -lr), up * 0.6);
    const lowCol = (c) => c.copy(legsC);
    P(knee, (x, y, z) => sdRoundCone(x, y, z, v3(0, 0, hind ? -lr * 0.5 : 0), v3(0, -lo + lr * 1.4, lr * 0.15), lr * 1.15, lr * 0.72), lr * 1.2, lowCol, v3(0, -lo / 2, 0), lo);
    if (spec.feet === 'hoof') P(knee, (x, y, z) => sdRoundCone(x, y, z, v3(0, -lo + lr * 1.3, lr * 0.15), v3(0, -lo + lr * 0.25, lr * 0.4), lr * 0.85, lr * 1.0), lr * 0.5, (c) => c.copy(darkC), v3(0, -lo, 0), lr * 2);
    else P(knee, (x, y, z) => sdEllipsoid(x, y + lo - lr * 0.6, z - lr * 0.6, lr * 1.45, lr * 0.75, lr * 2.0), lr * 0.9, (c) => c.copy(base === SPECIES.rabbit && hind ? legsC : base === SPECIES.bear ? darkC : legsC.clone().lerp(darkC, 0.5)), v3(0, -lo, lr * 0.5), lr * 2.5);
  }
  if (base === SPECIES.rabbit) for (const sx of [1, -1]) P('body', (x, y, z) => sdEllipsoid(x - sx * R * 0.5, y + R * 0.15, z + L * 0.35, R * 0.55, R * 0.95, R * 1.15), R * 0.5, torsoCol, v3(sx * R * 0.5, -R * 0.15, -L * 0.35), R * 1.2);
  // tail
  const tl = spec.tailLen;
  if (spec.tail === 'brush') P('tail', (x, y, z) => sdRoundCone(x, y, z, v3(0, 0, 0), v3(0, -tl * 0.15, -tl * 0.95), tl * 0.13, tl * 0.2), tl * 0.25, (c, x, y, z) => { c.copy(coatC); if (spec.tailTip && z < -tl * 0.8) c.lerp(accent, 0.9); }, v3(0, 0, -tl * 0.5), tl);
  else if (spec.tail === 'flag') P('tail', (x, y, z) => sdEllipsoid(x, y, z + tl * 0.45, tl * 0.28, tl * 0.14, tl * 0.5), tl * 0.25, (c, x, y) => { c.copy(coatC); if (y < 0) c.lerp(accent, 0.95); }, v3(0, 0, -tl * 0.45), tl * 0.6);
  else if (spec.tail === 'puff') P('tail', (x, y, z) => sdEllipsoid(x, y, z + tl * 0.3, tl * 0.9, tl * 0.9, tl * 0.8), tl * 0.5, (c) => c.copy(accent), v3(0, 0, -tl * 0.3), tl);
  else P('tail', (x, y, z) => sdRoundCone(x, y, z, v3(0, 0, 0), v3(0, -tl * 0.2, -tl * 0.8), Math.max(tl * 0.35, 0.02), Math.max(tl * 0.18, 0.012)), tl * 0.3, (c) => c.copy(spec.antlers === 'elk' ? accent : coatC), v3(0, 0, -tl * 0.4), tl);

  // ---- sample the field on a grid and mesh it (surface nets)
  const lo3 = v3(1e9, 1e9, 1e9), hi3 = v3(-1e9, -1e9, -1e9);
  for (const p of prims) { lo3.min(p.c.clone().subScalar(p.r * 1.2)); hi3.max(p.c.clone().addScalar(p.r * 1.2)); }
  lo3.y = Math.max(lo3.y, -0.05);
  const size = hi3.clone().sub(lo3), cell = Math.max(size.x, size.y, size.z) / 72;
  const nx = Math.ceil(size.x / cell) + 2, ny = Math.ceil(size.y / cell) + 2, nz = Math.ceil(size.z / cell) + 2;
  const field = (x, y, z, out) => { // distance and, optionally, each shape's distance
    let d = 1e9;
    for (let i = 0; i < prims.length; i++) {
      const p = prims[i];
      if (!out) { const lb = Math.hypot(x - p.c.x, y - p.c.y, z - p.c.z) - p.r * 1.2; if (lb > d + p.k) continue; } // too far to change the surface here
      const e = p.e, lx = e[0] * x + e[4] * y + e[8] * z + e[12], ly = e[1] * x + e[5] * y + e[9] * z + e[13], lz = e[2] * x + e[6] * y + e[10] * z + e[14];
      const di = p.sd(lx, ly, lz); if (out) { out[i * 4] = di; out[i * 4 + 1] = lx; out[i * 4 + 2] = ly; out[i * 4 + 3] = lz; }
      d = d === 1e9 ? di : smin(d, di, p.k);
    }
    return d;
  };
  const F = new Float32Array(nx * ny * nz), id = (i, j, k) => i + nx * (j + ny * k);
  // coarse pass every 3rd point; fine points only where the surface could be near
  const S3 = 3, cx = Math.ceil((nx - 1) / S3) + 1, cy = Math.ceil((ny - 1) / S3) + 1, cz = Math.ceil((nz - 1) / S3) + 1, Cg = new Float32Array(cx * cy * cz);
  for (let k = 0; k < cz; k++) for (let j = 0; j < cy; j++) for (let i = 0; i < cx; i++) Cg[i + cx * (j + cy * k)] = field(lo3.x + Math.min(i * S3, nx - 1) * cell, lo3.y + Math.min(j * S3, ny - 1) * cell, lo3.z + Math.min(k * S3, nz - 1) * cell);
  const band = cell * S3 * 1.9;
  for (let k = 0; k < nz; k++) for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
    const c = Cg[Math.round(i / S3) + cx * (Math.round(j / S3) + cy * Math.round(k / S3))];
    F[id(i, j, k)] = Math.abs(c) > band ? c : field(lo3.x + i * cell, lo3.y + j * cell, lo3.z + k * cell);
  }
  const vmap = new Int32Array(nx * ny * nz).fill(-1), verts = [];
  const corner = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [1, 1, 0], [0, 0, 1], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
  const edges = [[0, 1], [2, 3], [4, 5], [6, 7], [0, 2], [1, 3], [4, 6], [5, 7], [0, 4], [1, 5], [2, 6], [3, 7]];
  const cv = new Float32Array(8);
  for (let k = 0; k < nz - 1; k++) for (let j = 0; j < ny - 1; j++) for (let i = 0; i < nx - 1; i++) {
    let mask = 0; for (let c = 0; c < 8; c++) { cv[c] = F[id(i + corner[c][0], j + corner[c][1], k + corner[c][2])]; if (cv[c] < 0) mask |= 1 << c; }
    if (mask === 0 || mask === 255) continue;
    let sx = 0, sy = 0, sz = 0, n = 0;
    for (const [a, b] of edges) {
      if ((cv[a] < 0) === (cv[b] < 0)) continue;
      const t = cv[a] / (cv[a] - cv[b]);
      sx += corner[a][0] + (corner[b][0] - corner[a][0]) * t; sy += corner[a][1] + (corner[b][1] - corner[a][1]) * t; sz += corner[a][2] + (corner[b][2] - corner[a][2]) * t; n++;
    }
    vmap[id(i, j, k)] = verts.length / 3;
    verts.push(lo3.x + (i + sx / n) * cell, lo3.y + (j + sy / n) * cell, lo3.z + (k + sz / n) * cell);
  }
  const idx = [];
  const quad = (a, b, c, d, flip) => { if (a < 0 || b < 0 || c < 0 || d < 0) return; if (flip) idx.push(a, b, c, a, c, d); else idx.push(a, c, b, a, d, c); };
  for (let k = 1; k < nz - 1; k++) for (let j = 1; j < ny - 1; j++) for (let i = 1; i < nx - 1; i++) {
    const inside = F[id(i, j, k)] < 0;
    if (i < nx - 1 && inside !== (F[id(i + 1, j, k)] < 0)) quad(vmap[id(i, j - 1, k - 1)], vmap[id(i, j, k - 1)], vmap[id(i, j, k)], vmap[id(i, j - 1, k)], inside);
    if (j < ny - 1 && inside !== (F[id(i, j + 1, k)] < 0)) quad(vmap[id(i - 1, j, k - 1)], vmap[id(i - 1, j, k)], vmap[id(i, j, k)], vmap[id(i, j, k - 1)], inside);
    if (k < nz - 1 && inside !== (F[id(i, j, k + 1)] < 0)) quad(vmap[id(i - 1, j - 1, k)], vmap[id(i, j - 1, k)], vmap[id(i, j, k)], vmap[id(i - 1, j, k)], inside);
  }
  // ---- per vertex: settle onto the surface, normal from the field, colour and skin weights from the nearest shapes
  const nv = verts.length / 3, nor = new Float32Array(nv * 3), col = new Float32Array(nv * 3), si = new Uint16Array(nv * 4), sw = new Float32Array(nv * 4);
  const ds = new Float32Array(prims.length * 4), h = cell * 0.5, cA = new T.Color(), cB = new T.Color();
  for (let v = 0; v < nv; v++) {
    let x = verts[v * 3], y = verts[v * 3 + 1], z = verts[v * 3 + 2];
    let gx = 0, gy = 0, gz = 0;
    for (let it = 0; it < 2; it++) {
      const d = field(x, y, z);
      gx = field(x + h, y, z) - field(x - h, y, z); gy = field(x, y + h, z) - field(x, y - h, z); gz = field(x, y, z + h) - field(x, y, z - h);
      const gl = Math.hypot(gx, gy, gz) || 1; gx /= gl; gy /= gl; gz /= gl;
      x -= gx * d; y -= gy * d; z -= gz * d;
    }
    verts[v * 3] = x; verts[v * 3 + 1] = y; verts[v * 3 + 2] = z; nor[v * 3] = gx; nor[v * 3 + 1] = gy; nor[v * 3 + 2] = gz;
    field(x, y, z, ds);
    // nearest two shapes decide the colour; bones weighted by closeness
    let b1 = -1, b2 = -1, d1 = 1e9, d2 = 1e9;
    for (let i = 0; i < prims.length; i++) { const di = ds[i * 4]; if (di < d1) { d2 = d1; b2 = b1; d1 = di; b1 = i; } else if (di < d2) { d2 = di; b2 = i; } }
    const p1 = prims[b1], p2 = prims[b2 >= 0 ? b2 : b1];
    p1.color(cA, ds[b1 * 4 + 1], ds[b1 * 4 + 2], ds[b1 * 4 + 3]); p2.color(cB, ds[b2 * 4 + 1], ds[b2 * 4 + 2], ds[b2 * 4 + 3]);
    const t = clamp(0.5 - (d2 - d1) / (p1.k * 0.9), 0, 0.5); cA.lerp(cB, t);
    const grain = 0.94 + 0.08 * Math.sin(x * 61 + z * 47 + y * 29) * Math.sin(z * 23 - y * 37);
    col[v * 3] = cA.r * grain; col[v * 3 + 1] = cA.g * grain; col[v * 3 + 2] = cA.b * grain;
    const wb = new Map();
    for (let i = 0; i < prims.length; i++) { const w = Math.exp(-(ds[i * 4] - d1) / Math.max(prims[i].k * 0.45, 1e-4)); if (w > 0.02) wb.set(prims[i].bi, (wb.get(prims[i].bi) || 0) + w); }
    const top = [...wb.entries()].sort((a, b) => b[1] - a[1]).slice(0, 4), tot = top.reduce((s, q) => s + q[1], 0);
    top.forEach(([bi, w], q) => { si[v * 4 + q] = bi; sw[v * 4 + q] = w / tot; });
  }
  // ---- separate details: ears, eyes, nose, antlers (rigid to the head)
  const extra = [];
  const add = (g, boneName, color) => {
    g.computeVertexNormals(); if (g.index) g = g.toNonIndexed(); g.applyMatrix4(rg.bones[boneName].matrixWorld);
    extra.push({ g, bi: rg.list.indexOf(rg.bones[boneName]), c: C(color) });
  };
  add(new T.SphereGeometry(hr * 0.2, 10, 8).scale(1.15, 0.8, 0.9).translate(0, -hr * 0.22, hl * 0.55 + mz + hr * 0.08), 'head', spec.dark);
  for (const sx of [1, -1]) add(new T.SphereGeometry(hr * 0.12, 12, 10).translate(sx * hr * 0.8, hr * 0.3, hl * 0.4), 'head', '#0b0908');
  for (const sx of [1, -1]) {
    let e;
    if (spec.ears === 'round') e = new T.SphereGeometry(spec.earLen, 14, 10).scale(1, 1, 0.42).translate(sx * hr * 0.72, hr * 0.85, hl * 0.1);
    else if (spec.ears === 'long') e = new T.CapsuleGeometry(spec.earLen * 0.18, spec.earLen, 6, 12).scale(1, 1, 0.38).rotateZ(sx * -0.18).rotateX(-0.35).translate(sx * hr * 0.4, hr + spec.earLen * 0.5, hl * 0.05);
    else e = new T.ConeGeometry(spec.earLen * 0.42, spec.earLen, 14, 1, true).scale(1, 1, 0.45).rotateZ(sx * -0.55).translate(sx * (hr * 0.72 + spec.earLen * 0.2), hr * 0.72 + spec.earLen * 0.3, hl * 0.1);
    add(e, 'head', base === SPECIES.fox ? '#2a1d16' : base === SPECIES.bear ? coat : spec.face);
  }
  if (rg.bull && spec.antlers) {
    const big = spec.antlers === 'elk', r0 = big ? 0.028 : 0.016, beam = big ? 0.95 : 0.42, tines = big ? 5 : 3, tc = '#d8c8a8';
    for (const sx of [1, -1]) {
      const pts = []; for (let i = 0; i <= 8; i++) { const t = i / 8; pts.push(v3(sx * (hr * 0.5 + Math.sin(t * 1.4) * beam * 0.4), hr * 0.8 + t * beam * 0.75, hl * 0.15 - Math.sin(t * 2.2) * beam * 0.45 + t * t * beam * 0.25)); }
      const curve = new T.CatmullRomCurve3(pts);
      add(new T.TubeGeometry(curve, 16, r0, 7, false), 'head', tc);
      for (let k = 1; k <= tines; k++) {
        const t = 0.18 + (k / (tines + 0.6)) * 0.78, p = curve.getPoint(t), tl2 = (big ? 0.32 : 0.16) * (1 - t * 0.35);
        add(new T.ConeGeometry(r0 * 0.8, tl2, 7).translate(0, tl2 / 2, 0).rotateX(0.55).rotateZ(-sx * 0.2).translate(p.x, p.y, p.z), 'head', tc);
      }
    }
  }
  // ---- assemble
  let ev = 0; for (const x of extra) ev += x.g.attributes.position.count;
  const N = nv + ev, pos = new Float32Array(N * 3), nrm = new Float32Array(N * 3), cl = new Float32Array(N * 3), sI = new Uint16Array(N * 4), sW = new Float32Array(N * 4);
  pos.set(verts); nrm.set(nor); cl.set(col); sI.set(si); sW.set(sw);
  let o = nv; const index = idx.slice();
  for (const x of extra) {
    const g = x.g, n = g.attributes.position.count;
    pos.set(g.attributes.position.array, o * 3); nrm.set(g.attributes.normal.array, o * 3);
    for (let i = 0; i < n; i++) { cl[(o + i) * 3] = x.c.r; cl[(o + i) * 3 + 1] = x.c.g; cl[(o + i) * 3 + 2] = x.c.b; sI[(o + i) * 4] = x.bi; sW[(o + i) * 4] = 1; index.push(o + i); }
    o += n;
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.BufferAttribute(nrm, 3));
  geo.setAttribute('color', new T.BufferAttribute(cl, 3)); geo.setAttribute('skinIndex', new T.BufferAttribute(sI, 4)); geo.setAttribute('skinWeight', new T.BufferAttribute(sW, 4));
  geo.setIndex(N > 65535 ? new T.Uint32BufferAttribute(index, 1) : new T.Uint16BufferAttribute(index, 1));
  geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.6;
  return geo;
}

// ------------------------------------------------------------------ the herd
const animals = [];
const geoCache = new Map();
/* Sculpting a body takes a few hundred milliseconds, so new kinds are built in the background one at a time and each
   animal appears as soon as its body is ready. */
const geoQueue = [], geoWait = new Map(); let EMPTY = null;
function geoFor(kind, bull, winter, apply) {
  const key = kind + (bull ? 'B' : '') + (winter ? 'W' : '');
  if (geoCache.has(key)) { apply(geoCache.get(key)); return; }
  if (!geoWait.has(key)) { geoWait.set(key, []); geoQueue.push({ key, kind, bull, winter }); if (geoQueue.length === 1) setTimeout(buildNext, 30); }
  geoWait.get(key).push(apply);
}
function buildNext() {
  const job = geoQueue[0]; if (!job) return;
  const g = buildGeometry(SPECIES[job.kind], rig(SPECIES[job.kind], job.bull), job.winter);
  geoCache.set(job.key, g); for (const f of geoWait.get(job.key) || []) f(g); geoWait.delete(job.key);
  geoQueue.shift(); if (geoQueue.length) setTimeout(buildNext, 40);
}
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
  if (!EMPTY) { // a single invisible triangle stands in until the body is built
    EMPTY = new T.BufferGeometry();
    EMPTY.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(9), 3)); EMPTY.setAttribute('normal', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3));
    EMPTY.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(9), 3)); EMPTY.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(12), 4));
    EMPTY.setAttribute('skinWeight', new T.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4)); EMPTY.setIndex([0, 1, 2]); EMPTY.computeBoundingSphere();
  }
  const mesh = new T.SkinnedMesh(EMPTY, furMat);
  const holderA = {};
  geoFor(kind, bull, winter, (g) => { if (!holderA.a?.model) mesh.geometry = g; });
  mesh.add(rg.root); mesh.updateMatrixWorld(true); mesh.bind(new T.Skeleton(rg.list));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.scale.setScalar(sc);
  mesh.name = 'wildlife-' + kind;
  api.scene.add(mesh);
  const a = {
    kind, spec, mesh, rg, bull, sc, x, z, yaw: rnd() * Math.PI * 2, speed: 0, want: 0, state: 'graze', t: 2 + rnd() * 8, model: null, retarget: null,
    tx: x, tz: z, home, herd, phase: rnd(), chk: rnd() * 0.3, okAhead: true, fdx: 0, fdz: 1, hp: spec.hp * sc, wounded: false, downT: 0, roll: 0, atkT: 0, strikes: 0, graze: 1, alertK: 0, look: 0, vis: 0, logged: false, winter, key, hopY: 0, pitch: 0, flick: 0,
  };
  mesh.position.set(x, api.groundY(x, z), z); mesh.rotation.y = a.yaw;
  animals.push(a); holderA.a = a;
  if (MODEL.kinds[kind]) { if (modelSrc) attachModel(a); else loadModel(); }
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

function pose(a, dt, time) { poseRig(a, dt, time); if (a.retarget) a.retarget(); }
function poseRig(a, dt, time) {
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
      a.winter = winter; geoFor(a.kind, a.bull, winter, (g) => { if (a.winter === winter) a.mesh.geometry = g; });
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
  if (MODEL.kinds[kind]) { if (!EMPTY) { EMPTY = new T.BufferGeometry(); EMPTY.setAttribute('position', new T.Float32BufferAttribute(new Float32Array(9), 3)); EMPTY.setAttribute('skinIndex', new T.Uint16BufferAttribute(new Uint16Array(12), 4)); EMPTY.setAttribute('skinWeight', new T.Float32BufferAttribute([1, 0, 0, 0, 1, 0, 0, 0, 1, 0, 0, 0], 4)); EMPTY.setAttribute('normal', new T.Float32BufferAttribute([0, 1, 0, 0, 1, 0, 0, 1, 0], 3)); EMPTY.setAttribute('color', new T.Float32BufferAttribute(new Float32Array(9), 3)); EMPTY.setIndex([0, 1, 2]); EMPTY.computeBoundingSphere(); }
    standaloneList.push(a); if (modelSrc) attachModel(a); else loadModel(); }
  return { animal: a, pose: (dt, time) => pose(a, dt, time) };
}
function initMaterial() {
  furMat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.92, metalness: 0 });
  furMat.onBeforeCompile = (sh) => {
    sh.vertexShader = sh.vertexShader.replace('#include <common>', '#include <common>\nvarying vec3 vFurP;').replace('#include <begin_vertex>', '#include <begin_vertex>\nvFurP = position;');
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
varying vec3 vFurP;
float fh(vec3 p){ return fract(sin(dot(p, vec3(12.9898, 78.233, 37.719))) * 43758.5453); }
float fn(vec3 p){ vec3 i = floor(p), f = fract(p); f = f*f*(3.0-2.0*f);
  return mix(mix(mix(fh(i), fh(i+vec3(1,0,0)), f.x), mix(fh(i+vec3(0,1,0)), fh(i+vec3(1,1,0)), f.x), f.y),
             mix(mix(fh(i+vec3(0,0,1)), fh(i+vec3(1,0,1)), f.x), mix(fh(i+vec3(0,1,1)), fh(i+vec3(1,1,1)), f.x), f.y), f.z); }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
  vec3 fp = vFurP * vec3(260.0, 260.0, 70.0);           // strands run along the body
  float strand = fn(fp) * 0.6 + fn(fp * 2.3) * 0.4;
  float furPatch = fn(vFurP * 9.0);
  diffuseColor.rgb *= 0.8 + 0.32 * strand;
  diffuseColor.rgb *= 0.93 + 0.14 * furPatch;`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
  { vec3 q = vFurP * vec3(220.0, 220.0, 60.0); float e = 0.35;
    vec3 g = vec3(fn(q + vec3(e,0,0)) - fn(q - vec3(e,0,0)), fn(q + vec3(0,e,0)) - fn(q - vec3(0,e,0)), fn(q + vec3(0,0,e)) - fn(q - vec3(0,0,e)));
    normal = normalize(normal + (mat3(viewMatrix) * g) * 0.28); }`)
      .replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat rimK = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 2.5); totalEmissiveRadiance += diffuseColor.rgb * rimK * 0.3;');
  };
  furMat.customProgramCacheKey = () => 'wildlife-fur-2';
}

window.GOAWildlife = { init, frame, open, isOpen, close() { open(false); }, species: SPECIES, animals, journal: () => journal,
  raycast, hit, noise, nearestDown, tag, makeAnimal, refresh() { renderJournal(); } };
})();

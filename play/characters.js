/* Great Outdoors Adventure: people.
   Six original outdoor characters. The one you pick is your on-foot avatar; the others can join your camp as companions.
   Each person is a single skinned mesh (one draw call) built from shaded forms on a small humanoid skeleton, in the
   same style as the wildlife. Poses: idle, walk, run, ready (weapon carried), aim, sit and wave. */
(() => {
'use strict';
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));

const AVATARS = [
  { id: 'hunter', name: 'Marcus Reed', role: 'Big-game hunter', bio: 'Patient on the stalk and steady on the shot. Knows every elk wallow in the high meadows.',
    skin: '#5a3825', hair: '#141110', hairStyle: 'short', beard: true, hat: 'cap', hatCol: '#e2611c', shirt: '#6b6a3c', jacket: '#5f5e36', camo: true, vest: '#ef6a1d',
    pants: '#7a6a4c', boots: '#3a2a1d', build: 'm', height: 1.82 },
  { id: 'ranger', name: 'Elena Vasquez', role: 'Park ranger', bio: 'Keeps the valley wild and the visitors safe. Knows the rules, the roads and where the bears den.',
    skin: '#9a6a48', hair: '#2a1a12', hairStyle: 'bun', hat: 'ranger', hatCol: '#7d6a45', shirt: '#7b7b55', jacket: '#56603e', pants: '#3f4a33', boots: '#2b2219', build: 'f', height: 1.68 },
  { id: 'guide', name: 'Hank Doyle', role: 'Trail guide', bio: 'Forty seasons of trail rides and camp coffee. Tells a story for every switchback.',
    skin: '#d6a585', hair: '#b9b4ab', hairStyle: 'short', beard: true, beardCol: '#c9c4bb', hat: 'cowboy', hatCol: '#8b6a44', shirt: '#9b2f2a', plaid: true, jacket: null,
    pants: '#3f5576', boots: '#5a3b24', build: 'm', height: 1.8 },
  { id: 'camper', name: 'Aiyana Clearwater', role: 'Camp chef & outfitter', bio: 'Builds a fire in the rain and a feast from a cooler. Runs the best camp in the valley.',
    skin: '#a9734f', hair: '#120e0c', hairStyle: 'braid', hat: 'beanie', hatCol: '#c9a13a', shirt: '#2f7a76', jacket: '#2b6c69', pants: '#a3926e', boots: '#4a3626', build: 'f', height: 1.65 },
  { id: 'tracker', name: 'Jamal Okafor', role: 'Wildlife tracker', bio: 'Reads tracks like a newspaper. Can tell a buck from a doe by the print alone.',
    skin: '#3f271a', hair: '#0e0b0a', hairStyle: 'crop', hat: 'none', shirt: '#4e5638', jacket: '#56603a', camo: true, pants: '#4d4a3a', boots: '#2b2016', build: 'm', height: 1.86 },
  { id: 'photographer', name: 'Mei Lin', role: 'Wildlife photographer', bio: 'Waits hours for the perfect light. Her journal photos hang in the ranger station.',
    skin: '#e1b894', hair: '#1a1514', hairStyle: 'bob', hat: 'cap', hatCol: '#3d5a45', shirt: '#d9d2c2', jacket: '#b39a6f', pants: '#5b5d5a', boots: '#3b2f25', build: 'f', height: 1.62 },
];

let T = null, mat = null;
const geoCache = new Map();

function camoTone(c, x, y, z) { // blotchy woodland camo, computed per vertex
  const n = Math.sin(x * 31 + z * 17) + Math.sin(y * 23 - x * 13) * 0.8 + Math.sin(z * 29 + y * 7) * 0.6;
  if (n > 1.0) c.multiplyScalar(0.62); else if (n < -0.9) c.lerp(new T.Color('#8a7d55'), 0.5); else if (n > 0.3) c.lerp(new T.Color('#3b4428'), 0.5);
}
function plaidTone(c, x, y) { const a = Math.sin(y * 70) > 0.55, b = Math.sin(x * 70) > 0.55; if (a && b) c.multiplyScalar(0.45); else if (a || b) c.multiplyScalar(0.72); }

function rig(av) {
  const k = av.height / 1.78, f = av.build === 'f';
  const bones = {}, list = [];
  const bone = (name, parent, x, y, z) => { const b = new T.Bone(); b.name = name; b.position.set(x * k, y * k, z * k); if (parent) parent.add(b); bones[name] = b; list.push(b); return b; };
  const root = bone('root', null, 0, 0, 0);
  const hips = bone('hips', root, 0, 0.96, 0);
  const spine = bone('spine', hips, 0, 0.14, 0);
  const chest = bone('chest', spine, 0, 0.2, 0);
  const neck = bone('neck', chest, 0, 0.2, 0.01);
  bone('head', neck, 0, 0.09, 0.01);
  const sw = f ? 0.175 : 0.2;
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const sh = bone('shoulder' + s, chest, sx * sw, 0.15, 0);
    const ua = bone('upperArm' + s, sh, sx * 0.02, 0, 0);
    const fa = bone('foreArm' + s, ua, 0, -0.29, 0);
    bone('hand' + s, fa, 0, -0.26, 0);
    const th = bone('thigh' + s, hips, sx * (f ? 0.1 : 0.095), -0.04, 0);
    const sn = bone('shin' + s, th, 0, -0.44, 0);
    bone('foot' + s, sn, 0, -0.44, 0);
  }
  return { bones, list, root, k };
}

function buildGeometry(av, rg) {
  const C = (h) => new T.Color(h), parts = [], f = av.build === 'f', k = rg.k;
  const add = (g, boneName, color, shade) => {
    g.scale(k, k, k);
    if (g.index) { g.computeVertexNormals(); g = g.toNonIndexed(); }
    g.deleteAttribute('uv');
    const n = g.attributes.position.count, col = new Float32Array(n * 3), base = C(color), tmp = new T.Color(), p = g.attributes.position;
    for (let i = 0; i < n; i++) { tmp.copy(base); if (shade) shade(tmp, p.getX(i) / k, p.getY(i) / k, p.getZ(i) / k); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); parts.push({ g, bone: rg.bones[boneName] });
  };
  const top = av.jacket || av.shirt, topShade = av.camo ? camoTone : av.plaid ? plaidTone : null;
  // torso: pelvis, belly, chest (tapered capsules)
  add(new T.CapsuleGeometry(f ? 0.15 : 0.14, 0.08, 4, 12).scale(1, 1, 0.72), 'hips', av.pants);
  add(new T.CapsuleGeometry(f ? 0.135 : 0.145, 0.12, 4, 12).scale(1, 1, 0.68).translate(0, 0.02, 0), 'spine', top, topShade);
  add(new T.CapsuleGeometry(f ? 0.15 : 0.17, 0.14, 5, 14).scale(1, 1, 0.66).translate(0, 0.06, 0), 'chest', top, topShade);
  if (av.vest) for (const sx of [1, -1]) { // blaze-orange vest panels
    add(new T.BoxGeometry(0.15, 0.36, 0.25).translate(sx * 0.085, 0.0, 0.0), 'chest', av.vest, (c, x, y, z) => { if (Math.abs(z) > 0.11) c.multiplyScalar(0.92); });
  }
  if (av.id === 'camper' || av.id === 'photographer') add(new T.BoxGeometry(0.28, 0.36, 0.14).translate(0, 0.02, -0.17), 'chest', av.id === 'camper' ? '#53633c' : '#3a3d3f'); // backpack
  // neck and head
  add(new T.CylinderGeometry(0.048, 0.058, 0.12, 10).translate(0, 0.04, 0), 'neck', av.skin);
  add(new T.SphereGeometry(0.105, 16, 12).scale(0.92, 1.08, 1).translate(0, 0.07, 0.005), 'head', av.skin);
  add(new T.SphereGeometry(0.03, 8, 6).scale(1, 0.8, 1).translate(0, 0.05, 0.1), 'head', av.skin); // nose
  for (const sx of [1, -1]) {
    add(new T.SphereGeometry(0.014, 6, 5).translate(sx * 0.035, 0.09, 0.093), 'head', '#1d1714');
    add(new T.SphereGeometry(0.022, 6, 5).scale(0.5, 1, 0.8).translate(sx * 0.098, 0.07, 0), 'head', av.skin);
  }
  if (av.beard) add(new T.SphereGeometry(0.1, 12, 8).scale(0.86, 0.75, 0.9).translate(0, 0.0, 0.025), 'head', av.beardCol || av.hair,
    (c, x, y, z) => { if (y > 0.035 || z < 0) c.set(av.skin); });
  // hair
  // hair: a cap over the crown plus the back of the head (three.js spheres put -z at phi between PI and 2*PI)
  add(new T.SphereGeometry(0.112, 16, 8, 0, Math.PI * 2, 0, Math.PI * (av.hairStyle === 'crop' ? 0.3 : 0.36)).scale(0.95, 1.05, 1.03).translate(0, 0.078, -0.006), 'head', av.hair);
  if (av.hairStyle !== 'crop') add(new T.SphereGeometry(0.114, 14, 10, Math.PI * 1.08, Math.PI * 0.84, 0.2, Math.PI * 0.55).scale(0.95, 1.05, 1.03).translate(0, 0.072, -0.006), 'head', av.hair);
  if (av.hairStyle === 'bun') add(new T.SphereGeometry(0.05, 10, 8).translate(0, 0.1, -0.11), 'head', av.hair);
  if (av.hairStyle === 'braid') add(new T.CapsuleGeometry(0.03, 0.3, 4, 8).translate(0, -0.1, -0.1), 'head', av.hair);
  if (av.hairStyle === 'bob') add(new T.SphereGeometry(0.118, 14, 10, 0, Math.PI * 2, 0.4, Math.PI * 0.42).scale(1.02, 1.05, 1.02).translate(0, 0.07, -0.01), 'head', av.hair);
  // hats
  if (av.hat === 'cap') {
    add(new T.SphereGeometry(0.114, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.45).translate(0, 0.09, 0), 'head', av.hatCol);
    add(new T.CylinderGeometry(0.075, 0.075, 0.012, 14, 1, false, -Math.PI * 0.5, Math.PI).scale(1, 1, 1.25).translate(0, 0.125, 0.1), 'head', av.hatCol);
  } else if (av.hat === 'ranger' || av.hat === 'cowboy') {
    const cow = av.hat === 'cowboy';
    add(new T.CylinderGeometry(0.2, 0.2, 0.012, 22).scale(1, 1, cow ? 0.85 : 1).translate(0, 0.145, 0), 'head', av.hatCol, (c, x, y, z) => { if (cow && Math.abs(x) > 0.15) c.multiplyScalar(0.95); });
    add(new T.CylinderGeometry(cow ? 0.085 : 0.095, 0.112, cow ? 0.12 : 0.1, 16).translate(0, 0.2, 0), 'head', av.hatCol);
    add(new T.CylinderGeometry(0.113, 0.113, 0.022, 16).translate(0, 0.16, 0), 'head', cow ? '#3b2a1c' : '#4d3d24');
  } else if (av.hat === 'beanie') {
    add(new T.SphereGeometry(0.118, 14, 10, 0, Math.PI * 2, 0, Math.PI * 0.52).scale(1, 1.15, 1).translate(0, 0.08, 0), 'head', av.hatCol);
    add(new T.SphereGeometry(0.03, 8, 6).translate(0, 0.215, 0), 'head', av.hatCol);
  }
  // arms and hands
  for (const s of ['L', 'R']) {
    add(new T.CapsuleGeometry(0.048, 0.22, 4, 9).translate(0, -0.14, 0), 'upperArm' + s, top, topShade);
    add(new T.CapsuleGeometry(0.04, 0.2, 4, 9).translate(0, -0.12, 0), 'foreArm' + s, top, topShade);
    add(new T.SphereGeometry(0.042, 9, 7).scale(0.8, 1.15, 0.55).translate(0, -0.05, 0), 'hand' + s, av.skin);
    add(new T.CapsuleGeometry(f ? 0.068 : 0.072, 0.32, 4, 10).translate(0, -0.21, 0), 'thigh' + s, av.pants, av.camo && !av.jacket ? camoTone : null);
    add(new T.CapsuleGeometry(0.055, 0.32, 4, 10).translate(0, -0.2, 0), 'shin' + s, av.pants);
    add(new T.CylinderGeometry(0.06, 0.063, 0.14, 10).translate(0, -0.37, 0.0), 'shin' + s, av.boots);
    add(new T.BoxGeometry(0.1, 0.07, 0.24).translate(0, -0.02, 0.05), 'foot' + s, av.boots, (c, x, y) => { if (y < -0.04) c.multiplyScalar(0.55); });
  }
  rg.root.updateMatrixWorld(true);
  const pos = [], nor = [], col = [], si = [], sw = [];
  for (const { g, bone } of parts) {
    g.applyMatrix4(bone.matrixWorld);
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
  geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.5;
  return geo;
}

function material() {
  if (mat) return mat;
  mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat rimK = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0); totalEmissiveRadiance += diffuseColor.rgb * rimK * 0.18;'); };
  mat.customProgramCacheKey = () => 'goa-people';
  return mat;
}

/** Create a person. Returns { mesh, bones, avatar, pose(state, dt), attach(object, where) }. */
function create(id) {
  T = window.THREE;
  const av = AVATARS.find((a) => a.id === id) || AVATARS[0];
  const rg = rig(av);
  if (!geoCache.has(av.id)) geoCache.set(av.id, buildGeometry(av, rig(av)));
  const mesh = new T.SkinnedMesh(geoCache.get(av.id), material());
  mesh.add(rg.root); mesh.updateMatrixWorld(true); mesh.bind(new T.Skeleton(rg.list));
  mesh.castShadow = true; mesh.receiveShadow = true; mesh.name = 'person-' + av.id;
  const b = rg.bones;
  const st = { phase: Math.random(), aim: 0, ready: 0, sit: 0, wave: 0, run: 0, speed: 0, pitch: 0, recoil: 0, breathe: Math.random() * 6 };
  const holder = new T.Group(); holder.name = 'weapon-holder'; b.chest.add(holder);
  /* state: { speed (m/s), mode: 'idle'|'ready'|'aim'|'sit'|'wave', pitch (radians, aim up/down) } */
  function pose(s, dt) {
    st.speed = damp(st.speed, s.speed || 0, 8, dt);
    st.aim = damp(st.aim, s.mode === 'aim' ? 1 : 0, 12, dt);
    st.ready = damp(st.ready, s.mode === 'ready' || s.mode === 'aim' ? 1 : 0, 8, dt);
    st.sit = damp(st.sit, s.mode === 'sit' ? 1 : 0, 4, dt);
    st.wave = damp(st.wave, s.mode === 'wave' ? 1 : 0, 6, dt);
    st.pitch = damp(st.pitch, s.pitch || 0, 14, dt);
    st.recoil = Math.max(0, st.recoil - dt * 6);
    st.breathe += dt;
    const moving = clamp(st.speed / 1.4, 0, 1), run = clamp((st.speed - 2.2) / 2.5, 0, 1);
    st.phase = (st.phase + dt * st.speed / (1.25 + run * 0.9)) % 1;
    const ph = st.phase * Math.PI * 2, sw = (0.42 + run * 0.35) * moving * (1 - st.sit);
    // legs
    for (const [s2, sg] of [['L', 1], ['R', -1]]) {
      const a = Math.sin(ph) * sg;
      b['thigh' + s2].rotation.x = -a * sw + st.sit * -1.5;
      b['shin' + s2].rotation.x = Math.max(0, Math.cos(ph) * sg) * (0.7 + run * 0.5) * moving * (1 - st.sit) + st.sit * 1.55;
      b['foot' + s2].rotation.x = st.sit * -0.1;
    }
    b.hips.position.y = 0.96 * rg.k - Math.abs(Math.cos(ph)) * 0.03 * moving + st.sit * -0.5 * rg.k;
    b.hips.rotation.y = Math.sin(ph) * 0.08 * moving;
    // torso lean and breath
    b.spine.rotation.x = run * 0.18 + st.aim * 0.03 + st.sit * 0.05;
    b.chest.rotation.x = Math.sin(st.breathe * 1.6) * 0.012 - st.pitch * st.aim * 0.75 - st.pitch * 0.25 * st.ready;
    b.chest.rotation.y = st.aim * 0.18; b.neck.rotation.y = -st.aim * 0.18;
    b.head.rotation.x = -st.pitch * 0.25 * (1 - st.aim);
    // arms: swing when relaxed, carry when ready, shoulder the gun when aiming, wave a hand
    const armSwing = Math.sin(ph) * 0.35 * moving * (1 - st.ready);
    const relaxL = { ux: armSwing, uz: 0.08, fx: -0.15 }, relaxR = { ux: -armSwing, uz: -0.08, fx: -0.15 };
    const readyL = { ux: -0.85, uz: -0.35, fx: -1.0 }, readyR = { ux: -0.45, uz: 0.15, fx: -1.25 };
    const aimL = { ux: -1.45, uz: -0.45, fx: -0.25 }, aimR = { ux: -1.2, uz: 0.55, fx: -1.45 };
    const mix = (r, q, a, t) => ({ ux: r.ux + (q.ux - r.ux) * t + (a.ux - q.ux) * st.aim, uz: r.uz + (q.uz - r.uz) * t + (a.uz - q.uz) * st.aim, fx: r.fx + (q.fx - r.fx) * t + (a.fx - q.fx) * st.aim });
    const L = mix(relaxL, readyL, aimL, st.ready), R = mix(relaxR, readyR, aimR, st.ready);
    const sitArm = st.sit * 0.6;
    b.upperArmL.rotation.set(L.ux - sitArm, 0, L.uz); b.foreArmL.rotation.set(L.fx - sitArm, 0, 0);
    b.upperArmR.rotation.set(R.ux - sitArm + st.wave * -2.6, 0, R.uz + st.wave * 0.4); b.foreArmR.rotation.set(R.fx - sitArm + st.wave * (0.5 + Math.sin(st.breathe * 9) * 0.35), 0, 0);
    // weapon holder: carried across the chest when ready, at the shoulder when aiming
    holder.position.set(lerp3(-0.02, -0.11, st.aim) * rg.k, lerp3(0.0, 0.11, st.aim) * rg.k, lerp3(0.2, 0.12, st.aim) * rg.k);
    holder.rotation.set(lerp3(0.35, 0, st.aim) - st.recoil * 0.3, lerp3(0.95, -0.18, st.aim), lerp3(-0.4, 0, st.aim));
    holder.visible = st.ready > 0.15;
  }
  const lerp3 = (a, c, t) => a + (c - a) * t;
  function attach(obj) { holder.clear(); if (obj) holder.add(obj); }
  return { mesh, bones: b, avatar: av, pose, attach, holder, kick() { st.recoil = 1; }, state: st };
}

window.GOAPeople = { AVATARS, create };
})();

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
    skin: '#65412a', hair: '#141110', hairStyle: 'short', beard: true, beardCol: '#231b16', hat: 'cap', hatCol: '#e2611c', shirt: '#6b6a3c', jacket: '#5f5e36', camo: true, vest: '#ef6a1d',
    pants: '#7a6a4c', boots: '#3a2a1d', eye: '#4a2e1c', age: 38, build: 'm', height: 1.82 },
  { id: 'ranger', name: 'Elena Vasquez', role: 'Park ranger', bio: 'Keeps the valley wild and the visitors safe. Knows the rules, the roads and where the bears den.',
    skin: '#9a6a48', hair: '#2a1a12', hairStyle: 'bun', hat: 'ranger', hatCol: '#7d6a45', shirt: '#7b7b55', jacket: '#56603e', pants: '#3f4a33', boots: '#2b2219', eye: '#5a3a1e', age: 34, build: 'f', height: 1.68 },
  { id: 'guide', name: 'Hank Doyle', role: 'Trail guide', bio: 'Forty seasons of trail rides and camp coffee. Tells a story for every switchback.',
    skin: '#d6a585', hair: '#b9b4ab', hairStyle: 'short', beard: true, beardCol: '#c9c4bb', hat: 'cowboy', hatCol: '#8b6a44', shirt: '#9b2f2a', plaid: true, jacket: null,
    pants: '#3f5576', boots: '#5a3b24', eye: '#6f8494', age: 63, build: 'm', height: 1.8 },
  { id: 'camper', name: 'Aiyana Clearwater', role: 'Camp chef & outfitter', bio: 'Builds a fire in the rain and a feast from a cooler. Runs the best camp in the valley.',
    skin: '#a9734f', hair: '#120e0c', hairStyle: 'braid', hat: 'beanie', hatCol: '#c9a13a', shirt: '#2f7a76', jacket: '#2b6c69', pants: '#a3926e', boots: '#4a3626', eye: '#3a2416', age: 29, build: 'f', height: 1.65 },
  { id: 'tracker', name: 'Jamal Okafor', role: 'Wildlife tracker', bio: 'Reads tracks like a newspaper. Can tell a buck from a doe by the print alone.',
    skin: '#4b2f20', hair: '#0e0b0a', hairStyle: 'crop', hat: 'none', shirt: '#4e5638', jacket: '#56603a', camo: true, pants: '#4d4a3a', boots: '#2b2016', eye: '#2f1d12', age: 31, build: 'm', height: 1.86 },
  { id: 'photographer', name: 'Mei Lin', role: 'Wildlife photographer', bio: 'Waits hours for the perfect light. Her journal photos hang in the ranger station.',
    skin: '#e1b894', hair: '#1a1514', hairStyle: 'bob', hat: 'cap', hatCol: '#3d5a45', shirt: '#d9d2c2', jacket: '#b39a6f', pants: '#5b5d5a', boots: '#3b2f25', eye: '#3b2a1c', age: 27, build: 'f', height: 1.62 },
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

function buildGeometry(av, rg, only, neck = 1) {
  const C = (h) => new T.Color(h), parts = [], f = av.build === 'f', k = rg.k;
  const add = (g, boneName, color, shade, matIndex = 0) => {
    if (only && !only.has(boneName)) return;
    g.scale(k, k, k);
    if (g.index) { if (!matIndex) g.computeVertexNormals(); g = g.toNonIndexed(); }
    if (!matIndex || !g.attributes.uv) { if (g.attributes.uv) g.deleteAttribute('uv'); g.setAttribute('uv', new T.BufferAttribute(new Float32Array(g.attributes.position.count * 2), 2)); }
    const n = g.attributes.position.count, col = new Float32Array(n * 3), base = C(color), tmp = new T.Color(), p = g.attributes.position;
    for (let i = 0; i < n; i++) { tmp.copy(base); if (shade) shade(tmp, p.getX(i) / k, p.getY(i) / k, p.getZ(i) / k); col[i * 3] = tmp.r; col[i * 3 + 1] = tmp.g; col[i * 3 + 2] = tmp.b; }
    g.setAttribute('color', new T.BufferAttribute(col, 3)); parts.push({ g, bone: rg.bones[boneName], mat: matIndex });
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
  add(neck === 1 ? new T.CylinderGeometry(0.048, 0.058, 0.12, 10).translate(0, 0.04, 0) : new T.CylinderGeometry(0.048 * neck, 0.058 * neck, 0.2, 14).translate(0, 0.0, 0), 'neck', av.skin);
  // head: a sculpted sphere carrying the painted face texture (material 1)
  const head = new T.SphereGeometry(0.105, 112, 80);
  const dirs = head.attributes.position.array.slice(); // pre-sculpt directions, to find where the eyes sit
  sculptHead(head, av);
  head.scale(0.93, 1.03, 1).translate(0, 0.068, 0.005);
  // eye centres: just behind the sculpted surface in each socket
  const eyeAt = (sx) => { let bi = 0, bd = -2; const t = new T.Vector3(sx * 0.33, 0.13, 0.93).normalize(); for (let i = 0; i < dirs.length; i += 3) { const d = (dirs[i] * t.x + dirs[i + 1] * t.y + dirs[i + 2] * t.z) / 0.105; if (d > bd) { bd = d; bi = i / 3; } } const pp = head.attributes.position; return [pp.getX(bi), pp.getY(bi), pp.getZ(bi) - 0.0062]; };
  const eyes = [eyeAt(1), eyeAt(-1)];
  add(head, 'head', '#ffffff', null, 1);
  // eyes: whites, coloured iris and pupil on a textured eyeball (material 2), lids above and below
  for (const sx of [1, -1]) {
    const [ex, ey, ez] = eyes[sx > 0 ? 0 : 1];
    add(new T.SphereGeometry(0.0125, 20, 14).rotateY(sx * 0.12).translate(ex, ey, ez), 'head', '#ffffff', null, 2);
    add(new T.SphereGeometry(0.0138, 16, 8, 0, Math.PI * 2, 0, Math.PI * 0.36).rotateX(0.32).translate(ex, ey + 0.0008, ez), 'head', av.skin,
      (c, x, y, z) => { if (z > ez + 0.004 && y < ey + 0.007) c.lerp(new T.Color('#1a1210'), 0.75); else c.multiplyScalar(0.94); });
    add(new T.SphereGeometry(0.0133, 16, 6, 0, Math.PI * 2, Math.PI * 0.76, Math.PI * 0.24).rotateX(-0.2).translate(ex, ey - 0.0004, ez), 'head', av.skin, (c) => c.multiplyScalar(0.9));
    add(new T.SphereGeometry(0.022, 10, 8).scale(0.45, 1, 0.75).rotateY(sx * 0.25).translate(sx * 0.096, 0.068, 0.0), 'head', av.skin, (c, x, y, z) => { if (Math.abs(x) < 0.097) c.multiplyScalar(0.8); });
  }
  // hair
  // hair: a cap over the crown plus the back of the head (three.js spheres put -z at phi between PI and 2*PI)
  add(new T.SphereGeometry(0.112, 16, 8, 0, Math.PI * 2, 0, Math.PI * (av.hairStyle === 'crop' ? 0.3 : 0.36)).scale(0.95, 1.05, 1.03).translate(0, 0.078, -0.006), 'head', av.hair);
  if (av.hairStyle !== 'crop') add(new T.SphereGeometry(0.114, 14, 10, Math.PI * 1.08, Math.PI * 0.84, 0.2, Math.PI * 0.55).scale(0.95, 1.05, 1.03).translate(0, 0.072, -0.006), 'head', av.hair);
  if (av.hairStyle === 'bun') add(new T.SphereGeometry(0.05, 10, 8).translate(0, 0.1, -0.11), 'head', av.hair);
  if (av.hairStyle === 'braid') add(new T.CapsuleGeometry(0.03, 0.3, 4, 8).translate(0, -0.1, -0.1), 'head', av.hair);
  if (av.hairStyle === 'bob') add(new T.SphereGeometry(0.118, 18, 10, Math.PI * 0.8, Math.PI * 1.4, 0.4, Math.PI * 0.42).scale(1.02, 1.05, 1.02).translate(0, 0.07, -0.01), 'head', av.hair);
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
    add(new T.SphereGeometry(0.118, 18, 10, 0, Math.PI * 2, 0, Math.PI * 0.4).scale(1, 1.15, 1.02).translate(0, 0.098, -0.004), 'head', av.hatCol);
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
  const pos = [], nor = [], col = [], uv = [], si = [], sw = [], groups = [];
  parts.sort((a, b) => a.mat - b.mat);
  for (const { g, bone, mat: m } of parts) {
    g.applyMatrix4(bone.matrixWorld);
    const bi = rg.list.indexOf(bone), n = g.attributes.position.count, start = pos.length / 3;
    const app = (dst, src) => { for (let i = 0; i < src.length; i++) dst.push(src[i]); }; // no spread: big heads overflow the call stack
    app(pos, g.attributes.position.array); app(nor, g.attributes.normal.array); app(col, g.attributes.color.array); app(uv, g.attributes.uv.array);
    for (let i = 0; i < n; i++) { si.push(bi, 0, 0, 0); sw.push(1, 0, 0, 0); }
    const last = groups[groups.length - 1]; if (last && last.m === m) last.count += n; else groups.push({ start, count: n, m });
  }
  const geo = new T.BufferGeometry();
  for (const gr of groups) geo.addGroup(gr.start, gr.count, gr.m);
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
  geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4));
  geo.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
  geo.computeBoundingSphere(); geo.boundingSphere.radius *= 1.5;
  return geo;
}


// ------------------------------------------------------------------ faces
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
const gauss = (dx, dy, r) => Math.exp(-(dx * dx + dy * dy) / (r * r));
/** Shape a unit-ish sphere into a head: narrower jaw, a chin, brow ridge, cheekbones, eye sockets and a fuller back. */
function sculptHead(g, av) {
  const p = g.attributes.position, R = 0.105, f = av.build === 'f', beard = !!av.beard;
  for (let i = 0; i < p.count; i++) {
    let x = p.getX(i) / R, y = p.getY(i) / R, z = p.getZ(i) / R;
    const front = smooth(0.1, 0.8, z);
    if (y < -0.25) { const t = (-y - 0.25) / 0.75; x *= 1 - (f ? 0.22 : 0.13) * t * t; z *= 1 - 0.08 * t * (1 - front); }   // jaw taper
    if (!f && y < -0.2) x *= 1 + 0.06 * gauss(0, y + 0.55, 0.25);                                                          // a squarer jaw
    z += front * gauss(x, y + 0.75, 0.26) * (f ? 0.035 : 0.05);                                                           // chin
    z += front * gauss(x * 0.6, y - 0.24, 0.12) * 0.045;                                                                   // brow ridge
    for (const sx of [1, -1]) {
      z -= front * gauss(x - sx * 0.33, y - 0.13, 0.16) * 0.05;                                                            // eye sockets
      z += front * gauss(x - sx * 0.5, y + 0.07, 0.2) * 0.035;                                                             // cheekbones
    }
    z += front * gauss(x, y + 0.42, 0.2) * 0.02;                                                                           // muzzle around the mouth
    { // nose: a bridge from the brow that widens and projects to a rounded tip, with nostril wings
      const ny = clamp((0.12 - y) / 0.42, 0, 1), on = smooth(-0.36, -0.26, y) * smooth(0.16, 0.06, y);
      const w = (f ? 0.055 : 0.065) + 0.06 * ny * ny, h = (0.03 + 0.13 * Math.pow(ny, 1.6)) * (f ? 0.85 : 1);
      z += front * on * h * Math.exp(-(x * x) / (w * w));
      for (const sx of [1, -1]) z += front * gauss((x - sx * 0.1) * 1.4, y + 0.27, 0.07) * 0.035;
    }
    if (beard) { const b = front * smooth(0.0, -0.45, y) * (1 - gauss(x, y + 0.42, 0.12) * 0.6); x *= 1 + b * 0.05; y -= b * 0.03; z += b * 0.06; }
    if (z < 0) z *= 1.06;                                                                                                   // back of the skull
    x *= 0.95;
    p.setXYZ(i, x * R, y * R, z * R);
  }
  g.computeVertexNormals();
}
/** Canvas pixel for a head direction (the sphere's own UV layout: face at u = 0.25). */
function toUV(W, H, x, y, z) {
  const l = Math.hypot(x, y, z); x /= l; y /= l; z /= l;
  let phi = Math.atan2(z, -x); if (phi < 0) phi += Math.PI * 2;
  return [phi / (Math.PI * 2) * W, Math.acos(clamp(y, -1, 1)) / Math.PI * H];
}
function hexRGB(h) { const c = new T.Color(h); return [c.r * 255, c.g * 255, c.b * 255]; }
function mixHex(a, b, t) { const A = hexRGB(a), B = hexRGB(b); return `rgb(${A.map((v, i) => Math.round(v + (B[i] - v) * t)).join(',')})`; }
function paintFace(av) {
  const W = 1024, H = 512, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  const skin = av.skin, light = new T.Color(skin).getHSL({}).l, f = av.build === 'f';
  const P = (x, y, z) => toUV(W, H, x, y, z);
  // base tone with a soft gradient: warmer cheeks and nose, cooler temples and jaw
  g.fillStyle = skin; g.fillRect(0, 0, W, H);
  const shade = light < 0.3 ? 0.5 : 1; // deep skin tones get lighter shading passes so features stay readable
  let gr = g.createLinearGradient(0, 0, 0, H); gr.addColorStop(0, `rgba(0,0,0,${0.1 * shade})`); gr.addColorStop(0.45, 'rgba(0,0,0,0)'); gr.addColorStop(0.8, `rgba(0,0,0,${0.12 * shade})`); g.fillStyle = gr; g.fillRect(0, 0, W, H);
  if (light < 0.3) { const sh = g.createRadialGradient(W * 0.25, H * 0.42, 10, W * 0.25, H * 0.42, 150); sh.addColorStop(0, 'rgba(255,220,190,0.10)'); sh.addColorStop(1, 'rgba(255,220,190,0)'); g.fillStyle = sh; g.fillRect(0, 0, W, H); }
  // pores and tone variation
  let seed = av.id.length * 977; const rnd = () => (seed = (seed * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 9000; i++) { const x = rnd() * W, y = rnd() * H, r = 0.6 + rnd() * 1.8; g.fillStyle = rnd() < 0.5 ? `rgba(0,0,0,${0.03 + rnd() * 0.04})` : `rgba(255,235,220,${0.02 + rnd() * 0.03})`; g.beginPath(); g.arc(x, y, r, 0, 7); g.fill(); }
  const blob = (x, y, rx, ry, color) => { const rg = g.createRadialGradient(x, y, 0, x, y, Math.max(rx, ry)); rg.addColorStop(0, color); rg.addColorStop(1, 'rgba(0,0,0,0)'); g.save(); g.translate(x, y); g.scale(rx / Math.max(rx, ry), ry / Math.max(rx, ry)); g.translate(-x, -y); g.fillStyle = rg; g.beginPath(); g.arc(x, y, Math.max(rx, ry), 0, 7); g.fill(); g.restore(); };
  const warm = light > 0.55 ? 'rgba(210,90,80,0.22)' : light > 0.35 ? 'rgba(170,70,55,0.18)' : 'rgba(120,40,30,0.18)';
  for (const sx of [1, -1]) {
    let [cx, cy] = P(sx * 0.5, -0.12, 0.85); blob(cx, cy, 46, 34, warm);                      // cheeks
    [cx, cy] = P(sx * 0.33, 0.13, 0.93); blob(cx, cy, 34, 22, `rgba(40,20,15,${0.32 * shade})`);         // eye socket shadow
    [cx, cy] = P(sx * 0.82, 0.0, 0.55); blob(cx, cy, 40, 60, 'rgba(0,0,0,0.10)');            // temple / side shade
  }
  let [nx, ny] = P(0, -0.05, 1); blob(nx, ny, 16, 40, 'rgba(255,240,225,0.18)');               // nose bridge highlight
  for (const sx of [1, -1]) { const [ax, ay] = P(sx * 0.1, -0.12, 1); blob(ax, ay, 9, 30, 'rgba(40,20,10,0.22)'); }   // nose sides
  let [tx, ty] = P(0, -0.24, 1); blob(tx, ty, 26, 14, warm);                                     // nose tip warmth
  for (const sx of [1, -1]) { const [ax, ay] = P(sx * 0.065, -0.29, 1); blob(ax, ay, 6, 4, 'rgba(30,12,8,0.6)'); }      // nostrils
  // brows
  g.strokeStyle = av.hair; g.lineCap = 'round';
  for (const sx of [1, -1]) {
    for (let h = 0; h < 26; h++) {
      const t = h / 25, bx = sx * (0.14 + t * 0.32), by = 0.27 + Math.sin(t * Math.PI) * 0.05 - t * 0.03;
      const [x1, y1] = P(bx, by, 0.93), [x2, y2] = P(bx + sx * 0.03, by + 0.02, 0.93);
      g.globalAlpha = 0.55; g.lineWidth = f ? 2.2 : 3.4 - t; g.beginPath(); g.moveTo(x1, y1 + (rnd() - 0.5) * 3); g.lineTo(x2, y2 + (rnd() - 0.5) * 3); g.stroke();
    }
  }
  g.globalAlpha = 1;
  // lips: shaped upper and lower lip with a darker parting line
  const lipCol = mixHex(skin, light > 0.5 ? '#b5525a' : '#6e2f2c', light > 0.5 ? 0.5 : 0.45);
  const [mx, my] = P(0, -0.42, 0.9); const lw = f ? 34 : 38;
  g.fillStyle = lipCol;
  g.beginPath(); g.moveTo(mx - lw, my); g.quadraticCurveTo(mx - lw * 0.4, my - 12, mx - 4, my - 9); g.lineTo(mx, my - 7); g.lineTo(mx + 4, my - 9); g.quadraticCurveTo(mx + lw * 0.4, my - 12, mx + lw, my); g.closePath(); g.fill();
  g.fillStyle = mixHex(skin, light > 0.5 ? '#c2646a' : '#7a3a36', f ? 0.55 : 0.4);
  g.beginPath(); g.moveTo(mx - lw * 0.92, my + 1); g.quadraticCurveTo(mx, my + (f ? 20 : 16), mx + lw * 0.92, my + 1); g.closePath(); g.fill();
  g.strokeStyle = 'rgba(30,10,8,0.65)'; g.lineWidth = 2; g.beginPath(); g.moveTo(mx - lw, my); g.quadraticCurveTo(mx, my + 3, mx + lw, my); g.stroke();
  blob(mx, my + 14, 20, 6, 'rgba(255,240,230,0.12)');
  // smile lines, and more of them with age
  g.strokeStyle = `rgba(40,20,12,${0.12 + av.age / 400})`; g.lineWidth = 2;
  for (const sx of [1, -1]) { const [a1, b1] = P(sx * 0.17, -0.2, 0.96), [a2, b2] = P(sx * 0.26, -0.47, 0.9); g.beginPath(); g.moveTo(a1, b1); g.quadraticCurveTo(a1 + sx * 14, (b1 + b2) / 2, a2, b2); g.stroke(); }
  if (av.age > 50) {
    g.strokeStyle = 'rgba(50,25,15,0.28)'; g.lineWidth = 1.6;
    for (let i = 0; i < 3; i++) { const [a1, b1] = P(-0.3, 0.44 + i * 0.07, 0.86), [a2, b2] = P(0.3, 0.44 + i * 0.07, 0.86); g.beginPath(); g.moveTo(a1, b1); g.quadraticCurveTo((a1 + a2) / 2, b1 - 5, a2, b2); g.stroke(); }
    for (const sx of [1, -1]) for (let i = 0; i < 3; i++) { const [a1, b1] = P(sx * 0.48, 0.12 + (i - 1) * 0.05, 0.85), [a2, b2] = P(sx * 0.6, 0.12 + (i - 1) * 0.08, 0.78); g.beginPath(); g.moveTo(a1, b1); g.lineTo(a2, b2); g.stroke(); }
  }
  // beard and moustache, painted hair by hair over the jaw, chin and upper lip
  if (av.beard) {
    const bc = av.beardCol || av.hair;
    g.strokeStyle = bc; g.lineCap = 'round';
    for (let i = 0; i < 26000; i++) {
      const x = (rnd() - 0.5) * 2, y = -0.25 - rnd() * 0.85, z = Math.sqrt(Math.max(0, 1 - x * x - y * y)); if (z < 0.05) continue;
      const lipGap = Math.abs(y + 0.42) < 0.05 && Math.abs(x) < 0.17;
      const mous = y > -0.4 && y < -0.3 && Math.abs(x) < 0.24, jaw = y < -0.36 || Math.abs(x) > 0.55;
      if (lipGap || !(mous || jaw)) continue;
      const [px, py] = P(x, y, z); g.globalAlpha = 0.18 + rnd() * 0.3; g.lineWidth = 1.2 + rnd();
      g.beginPath(); g.moveTo(px, py); g.lineTo(px + (rnd() - 0.5) * 3, py + 3 + rnd() * 4); g.stroke();
    }
    g.globalAlpha = 1;
  } else if (av.build === 'm') { // a shadow of stubble
    for (let i = 0; i < 5000; i++) { const x = (rnd() - 0.5) * 1.6, y = -0.3 - rnd() * 0.7, z = Math.sqrt(Math.max(0, 1 - x * x - y * y)); if (z < 0.1 || (Math.abs(y + 0.42) < 0.05 && Math.abs(x) < 0.17)) continue; const [px, py] = P(x, y, z); g.fillStyle = `rgba(20,14,10,${0.12 + rnd() * 0.12})`; g.fillRect(px, py, 1.4, 1.4); }
  }
  // hairline: a soft fade into the hair colour at the top and back
  gr = g.createLinearGradient(0, 0, 0, H * 0.3); gr.addColorStop(0, av.hair); gr.addColorStop(0.75, av.hair); gr.addColorStop(1, 'rgba(0,0,0,0)');
  g.globalAlpha = 0.85; g.fillStyle = gr; g.fillRect(0, 0, W, H * 0.3); g.globalAlpha = 1;
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4; return tex;
}
function paintEye(av) {
  const W = 256, H = 128, c = document.createElement('canvas'); c.width = W; c.height = H; const g = c.getContext('2d');
  g.fillStyle = '#ece6df'; g.fillRect(0, 0, W, H);
  const cx = W * 0.25, cy = H * 0.5;
  const rg = g.createRadialGradient(cx, cy, 2, cx, cy, 64); rg.addColorStop(0, 'rgba(0,0,0,0)'); rg.addColorStop(0.7, 'rgba(0,0,0,0)'); rg.addColorStop(1, 'rgba(190,120,110,0.35)'); g.fillStyle = rg; g.fillRect(0, 0, W, H);
  const iris = g.createRadialGradient(cx, cy, 3, cx, cy, 17); iris.addColorStop(0, av.eye); iris.addColorStop(0.75, av.eye); iris.addColorStop(1, '#141010');
  g.fillStyle = iris; g.beginPath(); g.ellipse(cx, cy, 17, 17, 0, 0, 7); g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.12)'; for (let a = 0; a < 40; a++) { const t = a / 40 * 6.283; g.beginPath(); g.moveTo(cx + Math.cos(t) * 7, cy + Math.sin(t) * 7); g.lineTo(cx + Math.cos(t) * 15, cy + Math.sin(t) * 15); g.stroke(); }
  g.fillStyle = '#060404'; g.beginPath(); g.arc(cx, cy, 7, 0, 7); g.fill();
  g.fillStyle = 'rgba(255,255,255,0.9)'; g.beginPath(); g.arc(cx - 5, cy - 5, 3, 0, 7); g.fill();
  const tex = new T.CanvasTexture(c); tex.colorSpace = T.SRGBColorSpace; return tex;
}

const faceMats = new Map();
function materials(av) {
  if (faceMats.has(av.id)) return faceMats.get(av.id);
  const body = material();
  const face = new T.MeshStandardMaterial({ map: paintFace(av), roughness: 0.62, metalness: 0 });
  face.onBeforeCompile = body.onBeforeCompile; face.customProgramCacheKey = () => 'goa-people-face';
  const eye = new T.MeshStandardMaterial({ map: paintEye(av), roughness: 0.18, metalness: 0 });
  const set = [body, face, eye]; faceMats.set(av.id, set); return set;
}
function material() {
  if (mat) return mat;
  mat = new T.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 });
  mat.onBeforeCompile = (sh) => { sh.fragmentShader = sh.fragmentShader.replace('#include <emissivemap_fragment>', '#include <emissivemap_fragment>\nfloat rimK = pow(1.0 - clamp(dot(normalize(vNormal), normalize(vViewPosition)), 0.0, 1.0), 3.0); totalEmissiveRadiance += diffuseColor.rgb * rimK * 0.18;'); };
  mat.customProgramCacheKey = () => 'goa-people';
  return mat;
}

// ------------------------------------------------------------------ full-body models
/* The men stand on rigged, sculpted bodies: the outdoorsman body (from the lumberjack model) for Marcus and Hank, and
   the lean body (from the Blake model) for Jamal. Each keeps his own painted head and face, his own colours and the
   same poses: our small rig is posed as before and its rotations are copied onto the model's skeleton every frame.
   The women keep their built bodies. Until a model has loaded, the built body shows. */
const SIDES = [['L', 'l', 'L'], ['R', 'r', 'R']];
const MODELS = {
  outdoorsman: {
    url: 'assets/characters/outdoorsman.glb', armOut: 0.24, headScale: 1.08, neck: 1.5, curl: 0.42, hide: ['neck_02'], textured: true,
    map: Object.assign({ hips: 'pelvis', spine: 'spine_02', chest: 'spine_04', neck: 'neck_01', head: 'head' },
      ...SIDES.map(([o, t]) => ({ ['upperArm' + o]: 'upperarm_' + t, ['foreArm' + o]: 'lowerarm_' + t, ['hand' + o]: 'hand_' + t, ['thigh' + o]: 'thigh_' + t, ['shin' + o]: 'calf_' + t, ['foot' + o]: 'foot_' + t }))),
  },
  lean: {
    url: 'assets/characters/lean-body.glb', armOut: 0.12, headScale: 1.0, neck: 1, curl: 0.15, hide: ['head'], textured: false,
    map: Object.assign({ hips: 'hips', spine: 'Spine', chest: 'chest', neck: 'neck', head: 'head' },
      ...SIDES.map(([o, , t]) => ({ ['upperArm' + o]: 'upper_arm_' + t, ['foreArm' + o]: 'lower_arm_' + t, ['hand' + o]: 'hand_' + t, ['thigh' + o]: 'upper_leg_' + t, ['shin' + o]: 'lower_leg_' + t, ['foot' + o]: 'foot_' + t }))),
  },
};
const BODY = { hunter: 'outdoorsman', guide: 'outdoorsman', tracker: 'lean' };
const ORDER = ['hips', 'spine', 'chest', 'neck', 'head', 'upperArmL', 'foreArmL', 'handL', 'upperArmR', 'foreArmR', 'handR', 'thighL', 'shinL', 'footL', 'thighR', 'shinR', 'footR'];
const sources = new Map(), loaded = new Map(); // model key -> Promise<prepared source>, and the ones already in

function loadModel(key) {
  if (sources.has(key)) return sources.get(key);
  const spec = MODELS[key];
  const pr = new Promise((res, rej) => new T.GLTFLoader().load(spec.url, (g) => { try { const p = prepare(g.scene, spec); loaded.set(key, p); res(p); } catch (e) { rej(e); } }, undefined, rej));
  pr.catch((e) => console.warn('[people] body model failed, keeping built body:', key, e && e.message));
  sources.set(key, pr); return pr;
}
/** Merge the model's skinned parts into one mesh on one skeleton and drop the head (each man keeps his own). */
function prepare(root, spec) {
  root.updateMatrixWorld(true);
  const skinned = []; root.traverse((o) => { if (o.isSkinnedMesh) skinned.push(o); });
  const first = skinned[0], bones = first.skeleton.bones, inv0 = first.bindMatrix.clone().invert();
  const hideSet = new Set();
  for (const name of spec.hide) { const b = bones.find((x) => x.name === name); if (b) b.traverse((d) => { const i = bones.indexOf(d); if (i >= 0) hideSet.add(i); }); }
  const pos = [], nor = [], uv = [], si = [], sw = [], idx = [];
  const v = new T.Vector3(), n = new T.Vector3(), nm = new T.Matrix3();
  for (const m of skinned) {
    const g = m.geometry, P = g.attributes.position, N = g.attributes.normal, U = g.attributes.uv, J = g.attributes.skinIndex, W = g.attributes.skinWeight;
    const xf = inv0.clone().multiply(m.bindMatrix); nm.getNormalMatrix(xf);
    const remap = m.skeleton.bones.map((b) => bones.indexOf(b));
    const base = pos.length / 3, hidden = new Uint8Array(P.count);
    for (let i = 0; i < P.count; i++) {
      v.fromBufferAttribute(P, i).applyMatrix4(xf); pos.push(v.x, v.y, v.z);
      n.fromBufferAttribute(N, i).applyMatrix3(nm).normalize(); nor.push(n.x, n.y, n.z);
      uv.push(U ? U.getX(i) : 0, U ? U.getY(i) : 0);
      let hw = 0;
      for (let k = 0; k < 4; k++) { const bi = remap[J.getComponent(i, k)], w = W.getComponent(i, k); si.push(Math.max(0, bi)); sw.push(w); if (hideSet.has(bi)) hw += w; }
      hidden[i] = hw > 0.35 ? 1 : 0;
    }
    const I = g.index;
    for (let t = 0; t < (I ? I.count : P.count); t += 3) {
      const a = I ? I.getX(t) : t, b = I ? I.getX(t + 1) : t + 1, c = I ? I.getX(t + 2) : t + 2;
      if (!hidden[a] && !hidden[b] && !hidden[c]) idx.push(base + a, base + b, base + c);
    }
  }
  const geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3)); geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute('uv', new T.Float32BufferAttribute(uv, 2));
  geo.setAttribute('skinIndex', new T.Uint16BufferAttribute(si, 4)); geo.setAttribute('skinWeight', new T.Float32BufferAttribute(sw, 4));
  geo.setIndex(idx); geo.computeBoundingSphere();
  for (const m of skinned) { if (m !== first) m.parent.remove(m); }
  first.geometry = geo; first.name = 'body';
  return { root, mesh: first, spec, material: first.material };
}
/** Copy a prepared model: the scene graph, with the mesh re-bound to its own copy of the skeleton. */
function cloneModel(src) {
  const root = src.root.clone(true), map = new Map(), a = [], b = [];
  src.root.traverse((o) => a.push(o)); root.traverse((o) => b.push(o)); a.forEach((o, i) => map.set(o, b[i]));
  const mesh = map.get(src.mesh), sk = src.mesh.skeleton;
  mesh.bind(new T.Skeleton(sk.bones.map((x) => map.get(x)), sk.boneInverses), src.mesh.bindMatrix);
  const bone = {}; root.traverse((o) => { if (o.isBone) bone[o.name] = o; });
  return { root, mesh, bone };
}
// ---- colours: the outdoorsman's texture is recoloured per man (shirt, trousers, skin); the lean body is painted per vertex
const bodyTex = new Map();
function recolor(src, av) {
  if (bodyTex.has(av.id)) return bodyTex.get(av.id);
  const img = src.material.map && src.material.map.image; if (!img) return null;
  const W = img.width, H = img.height, c = document.createElement('canvas'); c.width = W; c.height = H;
  const g = c.getContext('2d');
  // which texels belong to the trousers: paint the UV triangles of leg-weighted vertices into a mask
  if (!src.legMask) {
    const geo = src.mesh.geometry, U = geo.attributes.uv, J = geo.attributes.skinIndex, Wt = geo.attributes.skinWeight, I = geo.index, bones = src.mesh.skeleton.bones;
    const leg = new Uint8Array(U.count);
    for (let i = 0; i < U.count; i++) { let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = Wt.getComponent(i, k); if (w > bw) { bw = w; best = J.getComponent(i, k); } } leg[i] = /thigh|calf|knee|pelvis/i.test(bones[best].name) ? 1 : 0; }
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H); g.fillStyle = '#fff'; g.strokeStyle = '#fff'; g.lineWidth = 2; g.beginPath();
    for (let t = 0; t < I.count; t += 3) { const a = I.getX(t), b = I.getX(t + 1), e = I.getX(t + 2); if (leg[a] + leg[b] + leg[e] < 2) continue;
      g.moveTo(U.getX(a) * W, U.getY(a) * H); g.lineTo(U.getX(b) * W, U.getY(b) * H); g.lineTo(U.getX(e) * W, U.getY(e) * H); g.closePath(); }
    g.fill(); g.stroke(); const m = g.getImageData(0, 0, W, H).data; src.legMask = new Uint8Array(W * H); for (let i = 0; i < W * H; i++) src.legMask[i] = m[i * 4] > 127 ? 1 : 0;
  }
  g.drawImage(img, 0, 0); const d = g.getImageData(0, 0, W, H), px = d.data, mask = src.legMask;
  const srgb = (h) => new T.Color(h).getRGB({}, T.SRGBColorSpace); // work in the texture's own sRGB values
  const top = srgb(av.jacket || av.shirt), pants = srgb(av.pants), skin = srgb(av.skin), hsl = {}, tmp = new T.Color();
  const sat = (x) => x < 0 ? 0 : x > 1 ? 1 : x;
  for (let i = 0; i < px.length; i += 4) {
    tmp.setRGB(px[i] / 255, px[i + 1] / 255, px[i + 2] / 255, T.SRGBColorSpace); tmp.getHSL(hsl, T.SRGBColorSpace);
    const h = hsl.h * 360, L = hsl.l; let target = null, ref = 0.5, x = (i / 4) % W, y = (i / 4 / W) | 0;
    if (h > 190 && h < 262 && hsl.s > 0.08 && L > 0.15) { if (mask[i / 4]) { target = pants; ref = 0.5; } else { target = top; ref = 0.52; } } // denim / plaid shirt
    else if ((h < 38 || h > 335) && L > 0.45 && hsl.s > 0.25) { target = skin; ref = 0.68; } // skin
    if (!target) continue;
    let k = L / ref;
    if (target === top && av.camo) { const n = Math.sin(x * 0.045 + y * 0.02) + Math.sin(y * 0.05 - x * 0.03) * 0.8 + Math.sin(x * 0.07 + y * 0.06) * 0.5; k *= n > 0.9 ? 0.62 : n < -0.8 ? 1.25 : 1; }
    if (target === top && !av.plaid && !av.camo) k = 0.82 + (k - 0.82) * 0.4; // flatten the check on plain shirts
    px[i] = sat(target.r * k) * 255; px[i + 1] = sat(target.g * k) * 255; px[i + 2] = sat(target.b * k) * 255;
  }
  g.putImageData(d, 0, 0);
  const tex = new T.CanvasTexture(c); tex.flipY = false; tex.colorSpace = T.SRGBColorSpace; tex.anisotropy = 4;
  bodyTex.set(av.id, tex); return tex;
}
function paintLean(geo, bones, av) {
  const P = geo.attributes.position, J = geo.attributes.skinIndex, W = geo.attributes.skinWeight, n = P.count, col = new Float32Array(n * 3);
  geo.computeBoundingBox(); const bb = geo.boundingBox, Hh = bb.max.y - bb.min.y, y0 = bb.min.y;
  const top = av.jacket || av.shirt, topShade = av.camo ? camoTone : av.plaid ? plaidTone : null, c = new T.Color();
  for (let i = 0; i < n; i++) {
    let best = 0, bw = -1; for (let k = 0; k < 4; k++) { const w = W.getComponent(i, k); if (w > bw) { bw = w; best = J.getComponent(i, k); } }
    const name = (bones[best] && bones[best].name || '').toLowerCase(), y = (P.getY(i) - y0) / Hh;
    let hex = top, shade = topShade;
    if (/hand|finger|thumb|index|middle|ring|pinky|neck|head|jaw|lip|eye|brow/.test(name)) { hex = av.skin; shade = null; }
    else if (/foot|toe/.test(name) || y < 0.075) { hex = av.boots; shade = (cc) => { if (y < 0.012) cc.multiplyScalar(0.55); }; }
    else if (/leg/.test(name) || (/hips|bone/.test(name) && y < 0.5)) { hex = av.pants; shade = av.camo && !av.jacket ? camoTone : null; }
    c.set(hex); if (shade) shade(c, P.getX(i) * 0.8, P.getY(i) * 0.8, P.getZ(i) * 0.8);
    col[i * 3] = c.r; col[i * 3 + 1] = c.g; col[i * 3 + 2] = c.b;
  }
  geo.setAttribute('color', new T.BufferAttribute(col, 3));
}
const leanGeo = new Map();
/** Put a model body under the person: scale it to the man's height, straighten its arms to match our rest pose, graft his head. */
function attachBody(person, src) {
  const { av, rg, group } = person, spec = src.spec, mdl = cloneModel(src), q = new T.Quaternion(), v = new T.Vector3();
  if (spec.textured) { const mat = src.material.clone(); const t = recolor(src, av); if (t) mat.map = t; mdl.mesh.material = mat; }
  else { if (!leanGeo.has(av.id)) { const g = src.mesh.geometry.clone(); paintLean(g, src.mesh.skeleton.bones, av); leanGeo.set(av.id, g); } mdl.mesh.geometry = leanGeo.get(av.id); mdl.mesh.material = material(); }
  mdl.mesh.castShadow = true; mdl.mesh.receiveShadow = true; mdl.mesh.frustumCulled = false;
  const body = new T.Group(); body.name = 'body-model'; body.add(mdl.root);
  // scale so the model's head joint sits where ours does
  const tb = {}; for (const k of ORDER) tb[k] = mdl.bone[spec.map[k]];
  mdl.root.updateMatrixWorld(true);
  const ourHead = rg.k * 1.59, theirHead = tb.head.getWorldPosition(v).y;
  body.scale.setScalar(ourHead / theirHead);
  // work in the person group's own frame: park the group at the origin while measuring
  const save = { p: group.position.clone(), q: group.quaternion.clone(), s: group.scale.clone(), parent: group.parent };
  if (save.parent) save.parent.remove(group); group.position.set(0, 0, 0); group.quaternion.identity(); group.scale.set(1, 1, 1);
  group.add(body); group.updateMatrixWorld(true);
  // straighten the A-pose arms toward our rest (hanging, a little out from the body)
  const wp = (o) => o.getWorldPosition(new T.Vector3()), wq = (o) => o.getWorldQuaternion(new T.Quaternion());
  const setWorldQ = (bone, Q) => { const pq = wq(bone.parent); bone.quaternion.copy(pq.invert().multiply(Q)); bone.updateMatrixWorld(true); };
  for (const [s, sx] of [['L', 1], ['R', -1]]) {
    const want = new T.Vector3(sx * Math.sin(spec.armOut), -Math.cos(spec.armOut), 0);
    for (const [a, b] of [['upperArm' + s, 'foreArm' + s], ['foreArm' + s, 'hand' + s]]) {
      const dir = wp(tb[b]).sub(wp(tb[a])).normalize();
      setWorldQ(tb[a], new T.Quaternion().setFromUnitVectors(dir, want).multiply(wq(tb[a])));
    }
  }
  // relax the fingers into a loose grip (the models come with flat, spread hands)
  const zAxis = new T.Vector3(0, 0, 1); const fingers = []; mdl.root.traverse((o) => { if (o.isBone && /^(index|middle|ring|pinky)/i.test(o.name)) fingers.push(o); });
  for (const f of fingers) { const sx = wp(f).x > 0 ? 1 : -1; setWorldQ(f, new T.Quaternion().setFromAxisAngle(zAxis, -sx * spec.curl).multiply(wq(f))); }
  const rest = {}; for (const k of ORDER) rest[k] = wq(tb[k]);
  const hipsRest = wp(tb.hips), hipsRatio = hipsRest.y / (0.96 * rg.k);
  // graft his own head and neck onto the model's head joint
  const hg = buildGeometry(av, rig(av), new Set(['head', 'neck']), spec.neck);
  const head = new T.Mesh(hg, materials(av)); head.castShadow = true; head.name = 'head';
  const ref = rig(av); ref.root.updateMatrixWorld(true); const ourHeadPos = ref.bones.head.getWorldPosition(new T.Vector3());
  head.position.copy(ourHeadPos).multiplyScalar(-spec.headScale); head.scale.setScalar(spec.headScale);
  const holder = new T.Group(); holder.add(head);
  const hm = tb.head.matrixWorld.clone().invert().multiply(new T.Matrix4().makeTranslation(wp(tb.head)));
  hm.decompose(holder.position, holder.quaternion, holder.scale); tb.head.add(holder);
  // restore the group where the game put it
  group.position.copy(save.p); group.quaternion.copy(save.q); group.scale.copy(save.s); if (save.parent) save.parent.add(group);
  person.proc.visible = false;
  const gq = new T.Quaternion(), oq = new T.Quaternion(), pq = new T.Quaternion();
  person.retarget = () => {
    group.updateWorldMatrix(true, false); group.getWorldQuaternion(gq); const gi = gq.clone().invert();
    rg.root.updateWorldMatrix(false, true);
    // hips height (bob, sitting) carried over
    const hp = rg.bones.hips.position, d = new T.Vector3(hp.x, hp.y - 0.96 * rg.k, hp.z).multiplyScalar(hipsRatio);
    const want = group.localToWorld(hipsRest.clone().add(d)); tb.hips.parent.updateWorldMatrix(true, false); tb.hips.position.copy(tb.hips.parent.worldToLocal(want));
    for (const k of ORDER) {
      const ob = rg.bones[k], t = tb[k]; if (!t) continue;
      ob.getWorldQuaternion(oq); const rel = gi.clone().multiply(oq); // our rotation from rest, in the person's frame
      q.copy(gq).multiply(rel).multiply(rest[k]);
      t.parent.updateWorldMatrix(true, false); t.parent.getWorldQuaternion(pq);
      t.quaternion.copy(pq.invert().multiply(q)); t.updateMatrix(); t.updateWorldMatrix(false, false);
    }
  };
  person.retarget();
}

/** Create a person. Returns { mesh, bones, avatar, pose(state, dt), attach(object, where) }. */
function create(id) {
  T = window.THREE;
  const av = AVATARS.find((a) => a.id === id) || AVATARS[0];
  const rg = rig(av);
  if (!geoCache.has(av.id)) geoCache.set(av.id, buildGeometry(av, rig(av)));
  const proc = new T.SkinnedMesh(geoCache.get(av.id), materials(av)); proc.name = 'built-body';
  const mesh = new T.Group(); mesh.add(proc); mesh.add(rg.root); mesh.updateMatrixWorld(true); proc.bind(new T.Skeleton(rg.list));
  proc.castShadow = true; proc.receiveShadow = true; mesh.name = 'person-' + av.id;
  const person = { av, rg, group: mesh, proc, retarget: null };
  if (BODY[av.id]) { if (loaded.has(BODY[av.id])) attachBody(person, loaded.get(BODY[av.id])); else loadModel(BODY[av.id]).then((src) => attachBody(person, src)).catch(() => {}); }
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
    if (person.retarget) person.retarget();
  }
  const lerp3 = (a, c, t) => a + (c - a) * t;
  function attach(obj) { holder.clear(); if (obj) holder.add(obj); }
  return { mesh, bones: b, avatar: av, pose, attach, holder, kick() { st.recoil = 1; }, state: st, get modelReady() { return !!person.retarget; } };
}

/** Start loading the body models (call early so portraits and companions get them). Resolves when all are in. */
function preload() { T = window.THREE; return Promise.all([...new Set(Object.values(BODY))].map((k) => loadModel(k).catch(() => null))); }
const usesModel = (id) => !!BODY[id];
window.GOAPeople = { AVATARS, create, preload, usesModel };
})();

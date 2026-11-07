/* Great Outdoors Adventure: hunting arms, modelled after the supplied weapon reference sheet.
   Every model points down +z with the butt (or grip) at the origin. Handling stats drive the hunting game:
   range is the distance at which a clean shot is still possible, spread is the cone in radians, damage per hit. */
(() => {
'use strict';
const STATS = {
  'rifle-camo':     { family: 'rifle', mag: 4, fire: 1.15, reload: 2.4, range: 260, spread: 0.0018, damage: 105, zoom: 5,   pellets: 1, sound: 'rifle', bipod: true },
  'rifle-wood':     { family: 'rifle', mag: 4, fire: 1.1,  reload: 2.4, range: 240, spread: 0.002,  damage: 100, zoom: 4,   pellets: 1, sound: 'rifle' },
  'rifle-mixed':    { family: 'rifle', mag: 5, fire: 1.0,  reload: 2.3, range: 220, spread: 0.0024, damage: 95,  zoom: 4,   pellets: 1, sound: 'rifle' },
  'shotgun-field':  { family: 'shotgun', mag: 2, fire: 0.35, reload: 2.6, range: 45, spread: 0.045, damage: 16, zoom: 1.4, pellets: 9, sound: 'shotgun' },
  'shotgun-pump':   { family: 'shotgun', mag: 5, fire: 0.85, reload: 3.2, range: 45, spread: 0.05,  damage: 15, zoom: 1.4, pellets: 9, sound: 'shotgun' },
  'shotgun-scoped': { family: 'shotgun', mag: 4, fire: 0.9,  reload: 3.0, range: 60, spread: 0.04,  damage: 16, zoom: 2.5, pellets: 9, sound: 'shotgun' },
  'revolver':       { family: 'handgun', mag: 6, fire: 0.45, reload: 3.0, range: 55, spread: 0.012, damage: 48, zoom: 1.6, pellets: 1, sound: 'pistol' },
};
// ammunition changes the shot: slugs turn a shotgun into a single heavy projectile; premium rounds hit harder
const AMMO = {
  'rifle-standard': { mult: 1 }, 'rifle-premium': { mult: 1.25, range: 1.1 },
  'shotgun-shot': { mult: 1 }, 'shotgun-slug': { slug: true, damage: 90, spread: 0.008, range: 110, pellets: 1 },
  'handgun-standard': { mult: 1 },
};
function stats(weaponId, ammoId) {
  const s = { ...(STATS[weaponId] || STATS['rifle-wood']) }, a = AMMO[ammoId] || {};
  if (a.slug) Object.assign(s, { damage: a.damage, spread: a.spread, range: a.range, pellets: 1 });
  if (a.mult) s.damage *= a.mult; if (a.range) s.range *= a.range;
  return s;
}

let T = null, texCache = {};
function canvasTex(key, draw, size = 128) {
  if (texCache[key]) return texCache[key];
  const c = document.createElement('canvas'); c.width = c.height = size; const g = c.getContext('2d'); draw(g, size);
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; t.wrapS = t.wrapT = T.RepeatWrapping; return (texCache[key] = t);
}
const camo = () => canvasTex('camo', (g, n) => {
  g.fillStyle = '#7d7350'; g.fillRect(0, 0, n, n);
  const cols = ['#4c4a2e', '#2f3121', '#a08d62', '#5f6a3a'];
  let s = 7; const r = () => (s = (s * 16807) % 2147483647) / 2147483647;
  for (let i = 0; i < 46; i++) { g.fillStyle = cols[i % 4]; g.beginPath(); const x = r() * n, y = r() * n; g.ellipse(x, y, 6 + r() * 16, 4 + r() * 9, r() * 3, 0, Math.PI * 2); g.fill(); }
});
const wood = () => canvasTex('wood', (g, n) => {
  const gr = g.createLinearGradient(0, 0, 0, n); gr.addColorStop(0, '#7a3f1f'); gr.addColorStop(0.5, '#9a5a2e'); gr.addColorStop(1, '#6d361a'); g.fillStyle = gr; g.fillRect(0, 0, n, n);
  g.globalAlpha = 0.25; for (let i = 0; i < 40; i++) { g.strokeStyle = i % 2 ? '#3e1d0c' : '#c27a43'; g.beginPath(); g.moveTo(0, i * 3.3); g.bezierCurveTo(n * 0.3, i * 3.3 + 4, n * 0.6, i * 3.3 - 4, n, i * 3.3 + 2); g.stroke(); }
});

function mats() {
  return {
    metal: new T.MeshStandardMaterial({ color: '#1f2224', roughness: 0.35, metalness: 0.85 }),
    black: new T.MeshStandardMaterial({ color: '#202325', roughness: 0.7, metalness: 0.05 }),
    rubber: new T.MeshStandardMaterial({ color: '#111213', roughness: 0.95 }),
    brass: new T.MeshStandardMaterial({ color: '#b5893a', roughness: 0.35, metalness: 0.9 }),
    camo: new T.MeshStandardMaterial({ map: camo(), roughness: 0.75 }),
    wood: new T.MeshStandardMaterial({ map: wood(), roughness: 0.55 }),
    glass: new T.MeshStandardMaterial({ color: '#2b3d4a', roughness: 0.1, metalness: 0.6 }),
  };
}
function stockShape(len, drop, depth) { // side profile of a rifle stock (x along the gun, y up)
  const s = new T.Shape();
  s.moveTo(0, -depth * 0.5); s.lineTo(0, depth * 0.55); s.quadraticCurveTo(len * 0.35, depth * 0.52, len * 0.62, depth * 0.3);
  s.lineTo(len * 0.7, depth * 0.12); s.quadraticCurveTo(len * 0.78, -depth * 0.12 - drop, len * 0.86, -depth * 0.05); s.lineTo(len, -depth * 0.02);
  s.lineTo(len, -depth * 0.3); s.quadraticCurveTo(len * 0.55, -depth * 0.25, len * 0.35, -depth * 0.5); s.closePath(); return s;
}
function profileMesh(shape, width, m) {
  const g = new T.ExtrudeGeometry(shape, { depth: width, bevelEnabled: true, bevelSize: width * 0.25, bevelThickness: width * 0.2, bevelSegments: 2, curveSegments: 6 });
  g.translate(0, 0, -width / 2); g.rotateY(-Math.PI / 2); // x (length) -> +z
  return new T.Mesh(g, m);
}
const cyl = (r1, r2, len, m, seg = 12) => new T.Mesh(new T.CylinderGeometry(r1, r2, len, seg).rotateX(Math.PI / 2).translate(0, 0, len / 2), m);
const box = (w, h, d, m) => new T.Mesh(new T.BoxGeometry(w, h, d), m);

function scope(group, M, z, len, y = 0.07) {
  const tube = cyl(0.017, 0.017, len, M.black); tube.position.set(0, y, z); group.add(tube);
  const front = cyl(0.026, 0.02, 0.07, M.black); front.position.set(0, y, z + len - 0.05); group.add(front);
  const back = cyl(0.02, 0.023, 0.06, M.black); back.position.set(0, y, z - 0.02); group.add(back);
  const lens = new T.Mesh(new T.CircleGeometry(0.022, 16), M.glass); lens.position.set(0, y, z + len + 0.021); group.add(lens);
  for (const dz of [0.08, len - 0.12]) { const ring = box(0.03, 0.04, 0.025, M.metal); ring.position.set(0, y - 0.035, z + dz); group.add(ring); }
  const turret = cyl(0.012, 0.012, 0.03, M.black); turret.rotation.x = -Math.PI / 2; turret.position.set(0, y + 0.03, z + len * 0.45); group.add(turret);
}

function build(id) {
  T = window.THREE; const M = mats(), g = new T.Group(); g.name = 'weapon-' + id;
  const st = STATS[id] || STATS['rifle-wood'];
  let muzzle = 1.1, eye = 0.07;
  if (st.family === 'rifle') {
    const stockMat = id === 'rifle-camo' ? M.camo : M.wood, foreMat = id === 'rifle-mixed' ? M.camo : stockMat;
    const stock = profileMesh(stockShape(0.42, 0.03, 0.13), 0.04, stockMat); g.add(stock);
    const pad = box(0.045, 0.14, 0.02, M.rubber); pad.position.set(0, 0.0, -0.005); g.add(pad);
    const fore = box(0.05, 0.06, 0.36, foreMat); fore.position.set(0, -0.005, 0.6); g.add(fore);
    const receiver = cyl(0.022, 0.022, 0.22, M.metal); receiver.position.set(0, 0.025, 0.38); g.add(receiver);
    const barrel = cyl(0.012, 0.009, 0.62, M.metal); barrel.position.set(0, 0.03, 0.58); g.add(barrel);
    const bolt = cyl(0.007, 0.007, 0.06, M.metal); bolt.rotation.set(0, Math.PI / 2, 0); bolt.position.set(0.02, 0.03, 0.42); g.add(bolt);
    const knob = new T.Mesh(new T.SphereGeometry(0.012, 8, 6), M.metal); knob.position.set(0.075, 0.025, 0.42); g.add(knob);
    const guard = new T.Mesh(new T.TorusGeometry(0.025, 0.004, 6, 12, Math.PI), M.metal); guard.rotation.set(0, Math.PI / 2, Math.PI); guard.position.set(0, -0.03, 0.37); g.add(guard);
    const mag = box(0.03, 0.04, 0.07, M.black); mag.position.set(0, -0.025, 0.43); g.add(mag);
    scope(g, M, 0.3, 0.34); eye = 0.07; muzzle = 1.2;
    if (st.bipod) for (const sx of [1, -1]) { const leg = cyl(0.006, 0.006, 0.22, M.black, 6); leg.rotation.x = Math.PI * 0.62; leg.rotation.z = sx * 0.25; leg.position.set(sx * 0.02, -0.03, 0.74); g.add(leg); }
  } else if (st.family === 'shotgun') {
    const adjustable = id === 'shotgun-pump';
    if (adjustable) { // skeletal adjustable stock and pistol grip
      for (const y of [0.04, -0.04]) { const t = cyl(0.01, 0.01, 0.28, M.black, 8); t.position.set(0, y, 0.02); g.add(t); }
      const plate = box(0.045, 0.14, 0.02, M.rubber); plate.position.set(0, 0, 0.0); g.add(plate);
      const grip = box(0.035, 0.11, 0.045, M.black); grip.rotation.x = -0.35; grip.position.set(0, -0.06, 0.3); g.add(grip);
    } else { const stock = profileMesh(stockShape(0.4, 0.02, 0.12), 0.042, M.black); g.add(stock); }
    const receiver = box(0.05, 0.08, 0.2, M.black); receiver.position.set(0, 0.02, 0.4); g.add(receiver);
    const barrel = cyl(0.013, 0.013, 0.6, M.metal); barrel.position.set(0, 0.045, 0.5); g.add(barrel);
    const tube = cyl(0.011, 0.011, 0.5, M.black); tube.position.set(0, 0.012, 0.5); g.add(tube);
    const pump = cyl(0.02, 0.02, 0.17, M.black); pump.position.set(0, 0.012, 0.64); g.add(pump);
    const bead = new T.Mesh(new T.SphereGeometry(0.004, 6, 5), M.brass); bead.position.set(0, 0.062, 1.09); g.add(bead);
    if (id === 'shotgun-scoped') scope(g, M, 0.3, 0.28, 0.1);
    eye = id === 'shotgun-scoped' ? 0.1 : 0.06; muzzle = 1.1;
  } else { // revolver
    const grip = box(0.03, 0.1, 0.04, M.black); grip.rotation.x = -0.3; grip.position.set(0, -0.035, 0.0); g.add(grip);
    const frame = box(0.028, 0.045, 0.08, M.metal); frame.position.set(0, 0.02, 0.05); g.add(frame);
    const cylinder = cyl(0.022, 0.022, 0.045, M.metal, 8); cylinder.position.set(0, 0.02, 0.03); g.add(cylinder);
    const barrel = cyl(0.008, 0.008, 0.13, M.metal); barrel.position.set(0, 0.035, 0.09); g.add(barrel);
    eye = 0.045; muzzle = 0.22;
  }
  g.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
  g.userData = { muzzle, eye, family: st.family };
  return g;
}

window.GOAWeapons = { STATS, AMMO, stats, build };
})();

/* Great Outdoors Adventure: fishing.
   Equip the rod (Tab), face a river or lake and click (RT) to cast. Wait for the bobber to dip, click again to set the
   hook, then hold to reel. Watch the line tension: ease off when the fish runs or the line snaps. Catches go into your
   inventory (cook them at a fire) and the Field Journal. */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
let T, api;
const FISH = {
  river: [['Rainbow Trout', 0.4, 2.8, 0.55], ['Brown Trout', 0.5, 3.5, 0.65], ['Smallmouth Bass', 0.4, 2.4, 0.7]],
  lake: [['Largemouth Bass', 0.6, 4.5, 0.7], ['Bluegill', 0.15, 0.6, 0.35], ['Channel Catfish', 1.2, 9, 0.85], ['Northern Pike', 1.5, 8, 0.9]],
  alpine: [['Arctic Char', 0.6, 4, 0.65], ['Lake Trout', 1.5, 10, 0.85], ['Cutthroat Trout', 0.4, 2.5, 0.55]],
};
const STORE = 'goa-catch-log-v1';
let log = {};
try { log = JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch (e) { log = {}; }
const st = { phase: 'idle', t: 0, bx: 0, bz: 0, by: 0, dist: 0, tension: 0, fish: null, pull: 0, surgeT: 0, sx: 0, sz: 0, sy: 0, fly: 0, session: 0 };
let rod = null, bobber = null, line = null, ui = null;

function rodModel() {
  T = window.THREE;
  const g = new T.Group(), cork = new T.MeshStandardMaterial({ color: '#b48b5e', roughness: 0.9 }), blank = new T.MeshStandardMaterial({ color: '#2c3b2e', roughness: 0.4, metalness: 0.2 }), reelM = new T.MeshStandardMaterial({ color: '#9aa1a5', metalness: 0.8, roughness: 0.3 });
  const h = new T.Mesh(new T.CylinderGeometry(0.016, 0.014, 0.32, 8).rotateX(Math.PI / 2).translate(0, 0, 0.12), cork); g.add(h);
  const b = new T.Mesh(new T.CylinderGeometry(0.004, 0.011, 1.9, 6).rotateX(Math.PI / 2).translate(0, 0, 1.2), blank); g.add(b);
  const r = new T.Mesh(new T.CylinderGeometry(0.03, 0.03, 0.03, 12).rotateZ(Math.PI / 2).translate(0, -0.04, 0.2), reelM); g.add(r);
  const tip = new T.Object3D(); tip.position.set(0, 0, 2.15); tip.name = 'rod-tip'; g.add(tip);
  g.rotation.x = -0.55; // rod held up
  g.userData = { muzzle: 2.15, tip }; rod = g; return g;
}
function ensureProps() {
  if (bobber) return;
  bobber = new T.Group();
  const top = new T.Mesh(new T.SphereGeometry(0.06, 10, 8, 0, Math.PI * 2, 0, Math.PI / 2), new T.MeshStandardMaterial({ color: '#e0352b', roughness: 0.5 }));
  const bot = new T.Mesh(new T.SphereGeometry(0.06, 10, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), new T.MeshStandardMaterial({ color: '#f4f1ea', roughness: 0.5 }));
  bobber.add(top, bot); bobber.visible = false; api.scene.add(bobber);
  line = new T.Line(new T.BufferGeometry().setFromPoints([new T.Vector3(), new T.Vector3()]), new T.LineBasicMaterial({ color: '#e8e4d8', transparent: true, opacity: 0.8 }));
  line.frustumCulled = false; line.visible = false; api.scene.add(line);
  ui = document.createElement('div'); ui.id = 'fish-ui';
  ui.innerHTML = '<b id="fish-title"></b><div id="fish-meter"><i id="fish-tension"></i><span></span></div><small id="fish-dist"></small>';
  document.body.append(ui);
}
function isWater(x, z) { return api.groundY(x, z) < api.WATER + 0.03; }
function waterKind(x, z) {
  if (api.snow?.() > 0.4 || Math.abs(x - (window.GOALocations?.list?.().find((p) => p.id === 'snowy-mountain')?.x ?? 1e9)) < 400 && Math.abs(z - (window.GOALocations?.list?.().find((p) => p.id === 'snowy-mountain')?.z ?? 1e9)) < 400) return 'alpine';
  const rv = window.GOALocations?.list?.().find((p) => p.id === 'river-valley');
  if (rv && Math.hypot(x - rv.x, z - rv.z) < 520) return 'river';
  return 'lake';
}
/** Where would a cast from here land? Scans ahead of the player for open water. */
function castTarget() {
  const p = window.GOAPlayer.position(), fx = Math.sin(p.yaw), fz = Math.cos(p.yaw);
  for (let d = 4; d <= 26; d += 1) { const x = p.x + fx * d, z = p.z + fz * d; if (isWater(x, z) && isWater(x + fx * 2, z + fz * 2)) return { x: x + fx * Math.min(6, 26 - d), z: z + fz * Math.min(6, 26 - d), d: d + Math.min(6, 26 - d) }; }
  return null;
}
function nearWater() { const p = window.GOAPlayer.position(); for (let a = 0; a < 8; a++) for (const d of [4, 9, 15]) if (isWater(p.x + Math.sin(a * 0.785) * d, p.z + Math.cos(a * 0.785) * d)) return true; return false; }

function use() {
  ensureProps();
  if (st.phase === 'idle') {
    const tgt = castTarget();
    if (!tgt) { api.toast(nearWater() ? 'Turn to face the water to cast' : 'Find a river or lake to fish'); return; }
    Object.assign(st, { phase: 'cast', fly: 0, bx: tgt.x, bz: tgt.z, by: api.WATER + 0.02, dist: tgt.d, tension: 0, fish: null });
    const tip = tipPos(); st.sx = tip.x; st.sy = tip.y; st.sz = tip.z;
    bobber.visible = line.visible = true; window.GOAPlayer.sound('reload', 0.6);
    return;
  }
  if (st.phase === 'wait') { reelIn('You reel in an empty line'); return; }
  if (st.phase === 'bite') { // set the hook
    const kind = waterKind(st.bx, st.bz), table = FISH[kind], pick = table[Math.floor(Math.random() * table.length)];
    const kg = +(pick[1] + Math.pow(Math.random(), 2.2) * (pick[2] - pick[1])).toFixed(2);
    st.fish = { name: pick[0], kg, power: pick[3] * (0.6 + kg / pick[2] * 0.6), kind };
    st.phase = 'fight'; st.tension = 0.35; st.surgeT = 1; api.toast('Fish on! Hold to reel · let go when the line strains', 2.2); return;
  }
}
function reelIn(msg) { st.phase = 'idle'; bobber.visible = line.visible = false; ui?.classList.remove('on'); if (msg) api.toast(msg, 1.6); }
function tipPos() { const v = new T.Vector3(); (rod?.userData.tip || rod || bobber).getWorldPosition(v); return v; }

/** Called every frame while the rod is equipped: held = reel button down. */
function hold(held, dt) {
  if (!bobber || st.phase === 'idle') { ui?.classList.remove('on'); return; }
  const tip = tipPos(), t = performance.now() / 1000;
  if (st.phase === 'cast') {
    st.fly += dt / 0.9; const k = clamp(st.fly, 0, 1);
    bobber.position.set(st.sx + (st.bx - st.sx) * k, st.sy + (st.by - st.sy) * k + Math.sin(k * Math.PI) * (2 + st.dist * 0.15), st.sz + (st.bz - st.sz) * k);
    if (k >= 1) { st.phase = 'wait'; st.t = 3 + Math.random() * 10 * (api.P.tod === 'midday' ? 1.4 : 0.9); }
  } else if (st.phase === 'wait') {
    st.t -= dt; bobber.position.set(st.bx, st.by + Math.sin(t * 2.2) * 0.012, st.bz);
    if (st.t <= 0) { st.phase = 'bite'; st.t = 1.25; window.GOAPlayer.sound('click', 2); }
  } else if (st.phase === 'bite') {
    st.t -= dt; bobber.position.set(st.bx, st.by - 0.06 + Math.sin(t * 30) * 0.03, st.bz);
    if (st.t <= 0) { st.phase = 'wait'; st.t = 4 + Math.random() * 8; api.toast('It stole the bait · too slow on the hook', 1.6); }
  } else if (st.phase === 'fight') {
    const f = st.fish; st.surgeT -= dt;
    if (st.surgeT <= 0) { st.pull = Math.random() < f.power * 0.6 ? 0.7 + Math.random() * 0.5 : Math.random() * 0.35; st.surgeT = 0.6 + Math.random() * 1.4; }
    if (held) { st.dist -= (2.6 - st.pull * 1.6) * dt; st.tension += (0.25 + st.pull * f.power * 0.9) * dt; }
    else { st.dist += st.pull * 1.2 * dt; st.tension -= 0.55 * dt; }
    st.tension = clamp(st.tension, 0, 1.2); st.dist = Math.max(0, st.dist);
    // the fish swims about under the bobber
    const ang = t * 1.7; bobber.position.set(st.bx + Math.sin(ang) * 0.8 * st.pull, st.by - 0.05 * st.pull, st.bz + Math.cos(ang) * 0.8 * st.pull);
    const p = window.GOAPlayer.position(), dx = st.bx - p.x, dz = st.bz - p.z, d0 = Math.hypot(dx, dz);
    if (d0 > 0.1) { const k2 = Math.max(st.dist, 1.2) / d0; st.bx = p.x + dx * k2; st.bz = p.z + dz * k2; if (!isWater(st.bx, st.bz)) { st.by = api.groundY(st.bx, st.bz) + 0.06; } }
    if (st.tension >= 1) { reelIn(`Snap! The ${f.kg > 2 ? 'big one' : 'fish'} broke the line`); return; }
    if (st.dist <= 1.3) { landed(f); return; }
    ui.classList.add('on'); $('fish-title').textContent = 'Fish on · hold to reel'; $('fish-tension').style.width = Math.min(100, st.tension * 100) + '%';
    $('fish-tension').style.background = st.tension > 0.8 ? '#e0644a' : st.tension > 0.55 ? '#e0b44a' : '#9cc46a';
    $('fish-dist').textContent = `${st.dist.toFixed(1)} m · ${held ? 'reeling' : 'line paying out'}`;
  }
  line.geometry.setFromPoints([tip, bobber.position.clone().add(new T.Vector3(0, 0.05, 0))]);
}
function landed(f) {
  reelIn(null);
  window.GOAPlayer.inv.food.rawFish++;
  const e = log[f.name] || (log[f.name] = { count: 0, best: 0 }); e.count++; const record = f.kg > e.best; e.best = Math.max(e.best, f.kg);
  try { localStorage.setItem(STORE, JSON.stringify(log)); } catch (err) { /* no storage */ }
  st.session++;
  api.toast(`Caught a ${f.name} · ${f.kg} kg${record ? ' · personal best!' : ''}`, 3.2);
  window.GOAModes?.onCatch?.(f, st.session); window.GOAWildlife?.refresh?.(); window.GOAPlayer.hud();
}
function status() { return st.phase === 'idle' ? `${window.GOAPlayer.inv.food.rawFish} fish in creel` : st.phase === 'fight' ? 'Fish on!' : st.phase === 'bite' ? 'Bite! Click to hook' : 'Waiting for a bite…'; }
function journalSection() {
  const names = Object.keys(log); if (!names.length) return null;
  const s = document.createElement('section'); s.className = 'journal-section';
  s.innerHTML = '<h3>Catch log</h3>' + names.map((n) => `<p><b>${n}</b> · ${log[n].count} caught · best ${log[n].best} kg</p>`).join('');
  return s;
}
function init(hooks) { api = hooks; T = window.THREE; (window.GOAJournalSections = window.GOAJournalSections || []).push(journalSection); }
window.GOAFishing = { init, use, hold, rodModel, status, log: () => log, isWater, waterKind, cancel: () => bobber && reelIn(null), debugBite() { if (st.phase === 'wait' || st.phase === 'cast') { bobber.position.set(st.bx, st.by, st.bz); st.phase = 'bite'; st.t = 1.25; use(); } }, session: () => st.session, reset() { st.session = 0; } };
})();

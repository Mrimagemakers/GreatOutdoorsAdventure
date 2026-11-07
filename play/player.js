/* Great Outdoors Adventure: on foot.
   Step out of the vehicle (F, or D-pad Left), walk and sprint, look around with the mouse or right stick, carry your
   chosen avatar's weapon, aim (right mouse / LT), fire (left mouse / RT), reload (R / X) and interact (E / A).
   Other modules register interactables (camp, fishing water, survival caches) and items through this API. */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const wrapA = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
let T, api, person = null, weaponObj = null, avatarId = 'hunter';
const P = { on: false, x: 0, y: 0, z: 0, yaw: 0, camYaw: 0, camPitch: -0.1, speed: 0, vx: 0, vz: 0, stamina: 1, health: 100, aim: 0,
  slot: 0, mag: 0, reloadT: 0, fireT: 0, hurtT: 0, swingT: 0, kick: 0, scoped: false, wellFed: 0 };
const AVATAR_KEY = 'goa-avatar-v1';
try { avatarId = localStorage.getItem(AVATAR_KEY) || 'hunter'; } catch (e) { /* no storage */ }

// ------------------------------------------------------------------ inventory
const inv = {
  weapons: [], ammo: { rifle: 0, shotgun: 0, handgun: 0 }, ammoType: {}, mags: {},
  tools: new Set(['knife', 'rod', 'hatchet']), food: { rawMeat: 0, cookedMeat: 0, rawFish: 0, cookedFish: 0, berries: 0 }, wood: 0, water: 0, trophies: [],
};
const TOOL_INFO = {
  knife: { name: 'Hunting knife', hint: 'Tag harvests and fend off attacks up close' },
  rod: { name: 'Fishing rod', hint: 'Cast at a river or lake' },
  hatchet: { name: 'Hatchet', hint: 'Chop deadfall for firewood' },
  canteen: { name: 'Canteen', hint: 'Fill at water, drink any time' },
  firekit: { name: 'Fire kit', hint: 'Flint and tinder to start a fire' },
  tent: { name: 'Tent', hint: 'Pitch it anywhere flat and sleep through the night' },
  compass: { name: 'Compass', hint: 'Shows your heading and the next marker' },
  map: { name: 'Trail map', hint: 'Marks supply caches on the map' },
};
function slots() { return [...inv.weapons, ...(inv.tools.has('rod') ? ['rod'] : []), ...(inv.tools.has('hatchet') ? ['hatchet'] : []), 'knife']; }
function current() { const s = slots(); return s[clamp(P.slot, 0, s.length - 1)]; }
function wStats(id) { return window.GOAWeapons.stats(id, inv.ammoType[id]); }

// ------------------------------------------------------------------ audio: a tiny synthesised report for each family
let actx = null;
function sound(kind, vol = 1) {
  try {
    actx = actx || new (window.AudioContext || window.webkitAudioContext)(); if (actx.state === 'suspended') actx.resume();
    const t = actx.currentTime, len = kind === 'rifle' ? 0.9 : kind === 'shotgun' ? 0.75 : kind === 'click' ? 0.05 : kind === 'reload' ? 0.18 : 0.5;
    const buf = actx.createBuffer(1, Math.ceil(actx.sampleRate * len), actx.sampleRate), d = buf.getChannelData(0);
    for (let i = 0; i < d.length; i++) { const k = i / d.length; d[i] = (Math.random() * 2 - 1) * Math.pow(1 - k, kind === 'click' || kind === 'reload' ? 1 : 3.2); }
    const src = actx.createBufferSource(); src.buffer = buf;
    const f = actx.createBiquadFilter(); f.type = 'lowpass'; f.frequency.value = kind === 'rifle' ? 1700 : kind === 'shotgun' ? 1200 : kind === 'click' ? 4000 : kind === 'reload' ? 2600 : 2200;
    const g = actx.createGain(); g.gain.setValueAtTime((kind === 'click' || kind === 'reload' ? 0.12 : 0.55) * vol * (api.P.volume ?? 0.6) * (api.P.sound === false ? 0 : 1), t);
    src.connect(f); f.connect(g); g.connect(actx.destination); src.start(t);
  } catch (e) { /* audio unavailable */ }
}

// ------------------------------------------------------------------ avatar and held item
function spawnPerson() {
  if (person) { api.scene.remove(person.mesh); }
  person = window.GOAPeople.create(avatarId); person.mesh.visible = P.on; api.scene.add(person.mesh); equip();
}
function equip() {
  if (!person) return;
  const id = current(); weaponObj = null;
  if (window.GOAWeapons.STATS[id]) { weaponObj = window.GOAWeapons.build(id); if (inv.mags[id] === undefined) inv.mags[id] = 0; P.mag = inv.mags[id]; }
  else if (id === 'rod') weaponObj = window.GOAFishing?.rodModel?.() || null;
  else if (id === 'knife') weaponObj = knifeModel();
  else if (id === 'hatchet') weaponObj = hatchetModel();
  person.attach(weaponObj); hud();
}
/* The hatchet is a textured model (from the lumberjack pack). It loads once; each equip gets a copy, lined up so the
   handle sits in the holder and the head points out along +z like the other held items. */
let hatchetSrc = null;
function hatchetModel() {
  const g = new T.Group(); g.userData = { muzzle: 0.45 };
  if (!hatchetSrc) hatchetSrc = new Promise((res) => new T.GLTFLoader().load('assets/tools/hatchet.glb', (gl) => {
    const m = gl.scene; m.updateMatrixWorld(true);
    const box = new T.Box3().setFromObject(m), size = box.getSize(new T.Vector3()), c = box.getCenter(new T.Vector3());
    const ax = size.x >= size.y && size.x >= size.z ? 'x' : size.y >= size.z ? 'y' : 'z';
    // the head is the wider end of the long axis
    let wideHi = 0, wideLo = 0; const v = new T.Vector3();
    m.traverse((o) => { if (!o.isMesh) return; const p = o.geometry.attributes.position; for (let i = 0; i < p.count; i += 3) { v.fromBufferAttribute(p, i).applyMatrix4(o.matrixWorld); const t = v[ax] - c[ax], w = ax === 'x' ? Math.abs(v.y - c.y) + Math.abs(v.z - c.z) : ax === 'y' ? Math.abs(v.x - c.x) + Math.abs(v.z - c.z) : Math.abs(v.x - c.x) + Math.abs(v.y - c.y); if (t > size[ax] * 0.3) wideHi = Math.max(wideHi, w); if (t < -size[ax] * 0.3) wideLo = Math.max(wideLo, w); } });
    const piv = new T.Group(); m.position.sub(c); piv.add(m);
    const dir = new T.Vector3(ax === 'x' ? 1 : 0, ax === 'y' ? 1 : 0, ax === 'z' ? 1 : 0).multiplyScalar(wideHi >= wideLo ? 1 : -1);
    piv.quaternion.setFromUnitVectors(dir, new T.Vector3(0, 0, 1));
    const out = new T.Group(); out.add(piv); const k = 0.42 / size[ax]; out.scale.setScalar(k); out.position.z = 0.21 - 0.06;
    m.traverse((o) => { if (o.isMesh) { o.castShadow = true; } });
    res(out);
  }, undefined, () => res(null)));
  hatchetSrc.then((src) => { if (src) g.add(src.clone(true)); else g.add(knifeModel()); });
  return g;
}
function knifeModel() {
  const g = new T.Group(), steel = new T.MeshStandardMaterial({ color: '#c9ccd0', metalness: 0.9, roughness: 0.3 }), handle = new T.MeshStandardMaterial({ color: '#4a2f1f', roughness: 0.7 });
  const h = new T.Mesh(new T.BoxGeometry(0.025, 0.03, 0.11), handle); h.position.z = 0.05; g.add(h);
  const b = new T.Mesh(new T.BoxGeometry(0.006, 0.03, 0.14), steel); b.position.z = 0.17; g.add(b); g.userData = { muzzle: 0.24 }; return g;
}

// ------------------------------------------------------------------ getting in and out of the vehicle
function exitVehicle() {
  const S = api.S;
  if (P.on || !S.started) return false;
  if (Math.hypot(S.vx, S.vz) > 1.5 || S.air) { api.toast('Stop the vehicle to step out'); return false; }
  const rx = -Math.cos(S.yaw), rz = Math.sin(S.yaw); // vehicle's right-hand side
  let x = S.x - rx * 2.0, z = S.z - rz * 2.0;
  if (api.groundY(x, z) < api.WATER + 0.1) { x = S.x + rx * 2.0; z = S.z + rz * 2.0; }
  S.vx = S.vz = 0;
  Object.assign(P, { on: true, x, z, y: api.groundY(x, z), yaw: S.yaw, camYaw: S.yaw, camPitch: -0.08, speed: 0, aim: 0 });
  if (!person) spawnPerson(); person.mesh.visible = true; equip();
  document.body.classList.add('on-foot'); hud(); api.toast(`On foot as ${person.avatar.name} · F or D-pad Left to drive`, 2.4);
  return true;
}
function enterVehicle(force) {
  if (!P.on) return false;
  if (!force && window.GOASurvival?.noVehicle?.()) { api.toast('The truck won’t start · survive until rescue'); return false; }
  const S = api.S, d = Math.hypot(P.x - S.x, P.z - S.z);
  if (!force && d > 4.5) { api.toast(`Walk back to the vehicle (${Math.round(d)} m)`); return false; }
  P.on = false; P.scoped = false; if (person) person.mesh.visible = false; scopeOverlay(false);
  document.exitPointerLock?.(); document.body.classList.remove('on-foot', 'aiming');
  api.camera.fov = api.P.fov || 58; api.camera.updateProjectionMatrix(); api.snapCamera?.(); hud();
  return true;
}

// ------------------------------------------------------------------ input
const k = { f: 0, b: 0, l: 0, r: 0, run: 0, aim: 0, fire: 0, turnL: 0, turnR: 0 };
let fireHeld = false, firePressed = false, aimHeld = false, padPrev = {};
function inputBlocked() { return !!(api.panelsOpen?.() || window.GOAXR?.active?.()); }
addEventListener('keydown', (e) => {
  if (e.target.closest?.('input,select,textarea')) return;
  if (e.code === 'KeyF' && !e.repeat && !inputBlocked() && api.S?.started) { e.preventDefault(); P.on ? enterVehicle() : exitVehicle(); return; }
  if (!P.on || inputBlocked()) return;
  const c = e.code;
  if (c === 'KeyW' || c === 'ArrowUp') k.f = 1; if (c === 'KeyS' || c === 'ArrowDown') k.b = 1;
  if (c === 'KeyA') k.l = 1; if (c === 'KeyD') k.r = 1; if (c === 'ArrowLeft') k.turnL = 1; if (c === 'ArrowRight') k.turnR = 1;
  if (c === 'ShiftLeft' || c === 'ShiftRight') k.run = 1;
  if (c === 'Space' && !e.repeat) { e.preventDefault(); firePressed = true; fireHeld = true; }
  if (c === 'KeyR' && !e.repeat) reload();
  if (c === 'KeyE' && !e.repeat) { e.preventDefault(); e.stopImmediatePropagation(); interact(); }
  if (c === 'KeyQ' && !e.repeat) { aimHeld = !aimHeld; }
  if (/^Digit[1-6]$/.test(c)) { P.slot = Math.min(+c.slice(5) - 1, slots().length - 1); equip(); }
  if (c === 'Tab') { e.preventDefault(); cycle(1); }
}, true);
addEventListener('keyup', (e) => {
  const c = e.code;
  if (c === 'KeyW' || c === 'ArrowUp') k.f = 0; if (c === 'KeyS' || c === 'ArrowDown') k.b = 0; if (c === 'KeyA') k.l = 0; if (c === 'KeyD') k.r = 0;
  if (c === 'ArrowLeft') k.turnL = 0; if (c === 'ArrowRight') k.turnR = 0; if (c === 'ShiftLeft' || c === 'ShiftRight') k.run = 0; if (c === 'Space') fireHeld = false;
});
function canvasEl() { return api.renderer.domElement; }
function bindMouse() {
  const cv = canvasEl();
  cv.addEventListener('mousedown', (e) => {
    if (!P.on || inputBlocked()) return;
    if (document.pointerLockElement !== cv) { cv.requestPointerLock?.(); if (e.button !== 0) return; }
    if (e.button === 0) { firePressed = true; fireHeld = true; }
    if (e.button === 2) { k.aim = 1; }
  });
  addEventListener('mouseup', (e) => { if (e.button === 0) fireHeld = false; if (e.button === 2) k.aim = 0; });
  cv.addEventListener('contextmenu', (e) => { if (P.on) e.preventDefault(); });
  addEventListener('mousemove', (e) => {
    if (!P.on || document.pointerLockElement !== cv) return;
    const sens = 0.0024 * (P.scoped ? 0.35 : 1);
    P.camYaw -= e.movementX * sens; P.camPitch = clamp(P.camPitch - e.movementY * sens, -1.2, 0.9);
  });
  cv.addEventListener('wheel', (e) => { if (P.on) { e.preventDefault(); cycle(Math.sign(e.deltaY)); } }, { passive: false });
}
function cycle(dir) { const n = slots().length; P.slot = ((P.slot + dir) % n + n) % n; P.reloadT = 0; equip(); }
/** Gamepad while on foot (called by the controller module with its sampled state). */
function pad(state, gp) {
  if (!gp) return;
  const ax = (i) => { const v = gp.axes?.[i] || 0; return Math.abs(v) < 0.18 ? 0 : v; };
  padPrev.move = [ax(0), ax(1)]; padPrev.look = [ax(2), ax(3)];
  padPrev.aim = (gp.buttons[6]?.value || 0) > 0.4; const fire = (gp.buttons[7]?.value || 0) > 0.5;
  if (fire && !padPrev.fire) firePressed = true; padPrev.fire = fire; fireHeld = fire || fireHeld && document.pointerLockElement;
  padPrev.run = !!gp.buttons[10]?.pressed || padPrev.run && Math.hypot(ax(0), ax(1)) > 0.3;
  if (state.pressed[0]) interact(); if (state.pressed[2]) reload();
  if (state.pressed[3] || state.pressed[14]) enterVehicle();
  if (state.pressed[4]) cycle(-1); if (state.pressed[5]) cycle(1);
}

// ------------------------------------------------------------------ interactables
const interactables = [];
function addInteractable(it) { interactables.push(it); return it; }
let focus = null;
function findFocus() {
  let best = null, bd = 1e9;
  const down = window.GOAWildlife?.nearestDown?.(P.x, P.z, 3.2);
  if (down) { best = { label: `Tag harvest · ${down.spec.name}${down.bull ? ' (bull)' : ''}`, action: () => tagAnimal(down) }; bd = 0; }
  for (const it of interactables) {
    if (it.enabled && !it.enabled()) continue;
    const p = it.global ? null : it.pos(); const d0 = it.global ? 50 : Math.hypot(p.x - P.x, p.z - P.z), d = d0 - (it.bias ? it.bias() : 0); // actions you can do anywhere rank below nearby objects
    if ((it.global || d0 < (it.radius || 2.5)) && d < bd) { bd = d; best = it; }
  }
  const S = api.S, dv = Math.hypot(S.x - P.x, S.z - P.z);
  if (dv < 4.2 && dv < bd && !window.GOASurvival?.noVehicle?.()) best = { label: 'Drive', action: () => enterVehicle() };
  return best;
}
function interact() { if (!P.on) return; const f = findFocus(); if (f) f.action(); }
function tagAnimal(a) {
  const r = window.GOAWildlife.tag(a); if (!r) return;
  inv.food.rawMeat += r.meat; inv.trophies.push({ ...r, at: Date.now() });
  api.toast(`Tagged ${r.bull ? 'bull ' : ''}${r.name} · ${r.kg} kg · +${r.meat} meat for camp`, 3);
  window.GOASurvival?.onHarvest?.(r); hud();
}

// ------------------------------------------------------------------ weapons
function reload() {
  const id = current(), st = window.GOAWeapons.STATS[id]; if (!st || P.reloadT > 0) return;
  const fam = st.family; if (inv.mags[id] >= st.mag) return;
  if (inv.ammo[fam] <= 0) { api.toast('Out of ammunition · restock at camp or a supply cache'); sound('click'); return; }
  P.reloadT = st.reload; sound('reload');
}
const _ray = { o: null, d: null };
function fire(rayO, rayD) {
  const id = current();
  if (id === 'rod') { window.GOAFishing?.use?.(); return; }
  if (id === 'knife' || id === 'hatchet') { melee(id); return; }
  const st = wStats(id); if (!st || P.reloadT > 0 || P.fireT > 0) return;
  if ((inv.mags[id] || 0) <= 0) { sound('click'); if (inv.ammo[st.family] > 0) reload(); else api.toast('Out of ammunition'); return; }
  inv.mags[id]--; P.mag = inv.mags[id]; P.fireT = st.fire; P.kick = 1; person?.kick();
  sound(st.sound === 'pistol' ? 'pistol' : st.family);
  const cam = api.camera, o = new T.Vector3(), d = new T.Vector3();
  if (rayO) { o.copy(rayO); d.copy(rayD).normalize(); } else { cam.getWorldPosition(o); cam.getWorldDirection(d); }
  if (!P.scoped && P.aim < 0.5) d.applyAxisAngle(new T.Vector3(0, 1, 0), 0); // hip fire still shoots at the crosshair, but with more spread
  const spread = st.spread * (P.scoped || P.aim > 0.5 || rayO ? 1 : 3.5) * (P.speed > 0.6 ? 2 : 1);
  let best = null, hits = 0;
  for (let i = 0; i < st.pellets; i++) {
    const dd = d.clone(); dd.x += (Math.random() - 0.5) * 2 * spread; dd.y += (Math.random() - 0.5) * 2 * spread; dd.z += (Math.random() - 0.5) * 2 * spread; dd.normalize();
    const blocked = terrainBlock(o, dd, st.range);
    const h = window.GOAWildlife?.raycast(o.x, o.y, o.z, dd.x, dd.y, dd.z, Math.min(st.range * 1.15, blocked));
    if (h) { hits++; const falloff = h.dist > st.range ? 0.45 : 1; const r = window.GOAWildlife.hit(h.animal, st.damage * falloff, h.zone, P.x, P.z); if (r) best = { ...h, result: r }; }
  }
  muzzleFlash();
  window.GOAWildlife?.noise(P.x, P.z, st.family === 'rifle' ? 170 : st.family === 'shotgun' ? 120 : 90);
  if (best) {
    hitMarker(best.zone === 'vital');
    if (best.result === 'down') api.toast(`${best.animal.spec.name} down at ${Math.round(best.dist)} m · walk up and press E to tag`, 3);
    else api.toast(`Hit · the ${best.animal.spec.name.toLowerCase()} is wounded, track it`, 2);
  }
  window.GOAAR?.onShot?.();
}
function terrainBlock(o, d, range) { // march along the shot until the ground gets in the way
  for (let t = 2; t < range * 1.2; t += 1.5) { const x = o.x + d.x * t, y = o.y + d.y * t, z = o.z + d.z * t; if (api.groundY(x, z) > y) return t; }
  return range * 1.2;
}
function melee(kind = 'knife') {
  if (P.fireT > 0) return; P.fireT = kind === 'hatchet' ? 0.75 : 0.6; P.swingT = 0.35;
  const down = window.GOAWildlife?.nearestDown?.(P.x, P.z, 2.8); if (down) { tagAnimal(down); return; }
  if (kind === 'hatchet' && window.GOASurvival?.chop?.(P.x, P.z, P.yaw)) return;
  const fx = Math.sin(P.yaw), fz = Math.cos(P.yaw);
  for (const a of window.GOAWildlife?.animals || []) {
    if (a.gone || a.state === 'down') continue;
    const dx = a.x - P.x, dz = a.z - P.z, d = Math.hypot(dx, dz);
    if (d < 2.6 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.3) { window.GOAWildlife.hit(a, kind === 'hatchet' ? 52 : 34, 'body', P.x, P.z); if (a.state !== 'down') { a.state = 'flee'; a.strikes = 3; } hitMarker(false); api.toast(`You drive off the ${a.spec.name.toLowerCase()}`); return; }
  }
}
let flash = null;
function muzzleFlash() {
  if (!flash) { flash = new T.PointLight('#ffcf8a', 0, 9, 2); api.scene.add(flash); }
  const p = new T.Vector3(); (weaponObj || person.mesh).getWorldPosition(p);
  flash.position.copy(p); flash.intensity = 40; setTimeout(() => { flash.intensity = 0; }, 60);
}
function hurt(dmg, from) {
  if (!P.on) return;
  P.health = Math.max(0, P.health - dmg); P.hurtT = 0.6; P.camYaw += (Math.random() - 0.5) * 0.15;
  api.toast(`The ${from?.spec?.name?.toLowerCase() || 'animal'} attacks! −${dmg} health · shoot or use your knife (left click)`, 1.8);
  if (P.health <= 0) window.GOASurvival?.onDeath?.(from) || (P.health = 30);
  hud();
}

// ------------------------------------------------------------------ HUD
let el = {};
function buildHud() {
  const root = document.createElement('div'); root.id = 'foot-hud';
  root.innerHTML = `<div id="fh-cross"></div><div id="fh-hit">✕</div><div id="fh-scope"><div></div></div><div id="fh-hurt"></div>
    <div id="fh-prompt"></div><div id="fh-weapon"><b id="fh-wname"></b><span id="fh-ammo"></span><small id="fh-tip"></small></div>
    <div id="fh-bars"><label>Health<i><b id="fh-hp"></b></i></label><label>Stamina<i><b id="fh-st"></b></i></label></div>`;
  document.body.append(root);
  for (const id of ['fh-cross', 'fh-hit', 'fh-scope', 'fh-hurt', 'fh-prompt', 'fh-wname', 'fh-ammo', 'fh-tip', 'fh-hp', 'fh-st']) el[id] = $(id);
}
function scopeOverlay(on) { el['fh-scope']?.classList.toggle('on', !!on); }
let hitT = 0;
function hitMarker(vital) { el['fh-hit'].classList.toggle('vital', vital); hitT = 0.35; el['fh-hit'].style.opacity = 1; }
function hud() {
  if (!el['fh-wname']) return;
  const id = current(), st = window.GOAWeapons?.STATS[id];
  const name = st ? (window.GOAExtension?.weaponName?.(id) || id) : TOOL_INFO[id]?.name || id;
  el['fh-wname'].textContent = name;
  el['fh-ammo'].textContent = st ? `${inv.mags[id] || 0} / ${st.mag}  ·  ${inv.ammo[st.family]} spare` : id === 'rod' ? (window.GOAFishing?.status?.() || '') : '';
  el['fh-tip'].textContent = st ? 'Right mouse aim · Left click fire · R reload · Tab switch' : id === 'rod' ? 'Face water · Left click cast, click on the bite, hold to reel' : id === 'hatchet' ? 'Left click: chop deadfall for firewood, tag a harvest or fend off an attack · Tab switch' : 'Left click: tag a harvest or fend off an attack · Tab switch';
  el['fh-hp'].style.width = P.health + '%'; el['fh-st'].style.width = P.stamina * 100 + '%';
}

// ------------------------------------------------------------------ per-frame
function update(dt) {
  if (!P.on) return;
  const S = api.S, blocked = inputBlocked();
  const mx = blocked ? 0 : (k.r - k.l) + (padPrev.move?.[0] || 0), mz = blocked ? 0 : (k.f - k.b) - (padPrev.move?.[1] || 0);
  P.camYaw += ((k.turnL - k.turnR) * 1.9 - (padPrev.look?.[0] || 0) * 2.6 * (P.scoped ? 0.35 : 1)) * dt;
  P.camPitch = clamp(P.camPitch - (padPrev.look?.[1] || 0) * 1.8 * dt * (P.scoped ? 0.35 : 1), -1.2, 0.9);
  const aiming = !blocked && (k.aim || aimHeld || padPrev.aim) && !!window.GOAWeapons.STATS[current()];
  P.aim = damp(P.aim, aiming ? 1 : 0, 14, dt);
  const st = window.GOAWeapons.STATS[current()];
  P.scoped = aiming && P.aim > 0.8 && st && st.zoom > 2;
  const len = Math.min(1, Math.hypot(mx, mz));
  const sprint = (k.run || padPrev.run) && !aiming && len > 0.2 && P.stamina > 0.05;
  const maxSp = aiming ? 1.3 : sprint ? 5.6 : 2.4;
  P.stamina = clamp(P.stamina + (sprint ? -0.16 : 0.1 * (P.wellFed > 0 ? 1.6 : 1)) * dt, 0, 1);
  P.wellFed = Math.max(0, P.wellFed - dt);
  const needSlow = window.GOASurvival?.speedFactor?.() ?? 1;
  const fx = Math.sin(P.camYaw), fz = Math.cos(P.camYaw), rx = -Math.cos(P.camYaw), rz = Math.sin(P.camYaw);
  let wx = (fx * mz + rx * mx), wz = (fz * mz + rz * mx); const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  const tvx = wx * maxSp * needSlow, tvz = wz * maxSp * needSlow;
  P.vx = damp(P.vx, tvx, 9, dt); P.vz = damp(P.vz, tvz, 9, dt);
  let nx = P.x + P.vx * dt, nz = P.z + P.vz * dt;
  const gyN = api.groundY(nx, nz), gy = api.groundY(P.x, P.z);
  const stepLen = Math.max(Math.hypot(nx - P.x, nz - P.z), 1e-3);
  if (gyN < api.WATER - 0.35 || (gyN - gy) / stepLen > 1.6) { nx = P.x; nz = P.z; P.vx *= 0.2; P.vz *= 0.2; } // deep water or a cliff
  // the vehicle is solid
  const cdx = nx - S.x, cdz = nz - S.z, cd = Math.hypot(cdx, cdz); if (cd < 1.7) { nx = S.x + cdx / cd * 1.7; nz = S.z + cdz / cd * 1.7; }
  P.x = clamp(nx, -1150, 1150); P.z = clamp(nz, -1150, 1150);
  P.speed = Math.hypot(P.vx, P.vz);
  P.y = damp(P.y, Math.max(api.groundY(P.x, P.z), api.WATER - 0.5), 18, dt);
  if (aiming) P.yaw = P.camYaw; else if (P.speed > 0.3) P.yaw += wrapA(Math.atan2(P.vx, P.vz) - P.yaw) * Math.min(1, dt * 10);
  P.fireT = Math.max(0, P.fireT - dt); P.kick = Math.max(0, P.kick - dt * 5); P.hurtT = Math.max(0, P.hurtT - dt); P.swingT = Math.max(0, P.swingT - dt);
  if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) { const id = current(), s2 = window.GOAWeapons.STATS[id]; if (s2) { const need = s2.mag - (inv.mags[id] || 0), take = Math.min(need, inv.ammo[s2.family]); inv.ammo[s2.family] -= take; inv.mags[id] = (inv.mags[id] || 0) + take; P.mag = inv.mags[id]; sound('reload'); } hud(); } }
  if (firePressed && !blocked) { firePressed = false; fire(); hud(); } else firePressed = false;
  if (current() === 'rod') window.GOAFishing?.hold?.(fireHeld && !blocked, dt);
  // avatar
  person.mesh.position.set(P.x, P.y, P.z); person.mesh.rotation.y = P.yaw;
  person.pose({ speed: P.speed, mode: aiming ? 'aim' : (st || current() === 'rod') ? 'ready' : 'idle', pitch: aiming ? P.camPitch : 0 }, dt);
  person.mesh.visible = !P.scoped;
  // camera: over the shoulder, closer when aiming, through the scope when zoomed
  const cam = api.camera;
  const eyeY = P.y + 1.62 * (person.avatar.height / 1.78);
  if (P.scoped) {
    cam.position.set(P.x, eyeY, P.z);
    cam.fov = damp(cam.fov, 58 / st.zoom, 18, dt);
  } else {
    const dist = 3.4 - P.aim * 2.0, sh = 0.42 + P.aim * 0.12, up = 0.25 - P.aim * 0.1;
    const cp = Math.cos(P.camPitch), sp = Math.sin(P.camPitch);
    let cx = P.x - fx * dist * cp + rx * sh * -1, cz = P.z - fz * dist * cp + rz * sh * -1, cy = eyeY + up - sp * dist;
    cy = Math.max(cy, api.groundY(cx, cz) + 0.35);
    cam.position.set(cx, cy, cz);
    cam.fov = damp(cam.fov, aiming ? 50 : (api.P.fov || 58), 10, dt);
  }
  cam.updateProjectionMatrix();
  const lookD = 50, lp = P.camPitch + P.kick * 0.04;
  cam.lookAt(cam.position.x + fx * Math.cos(lp) * lookD, cam.position.y + Math.sin(lp) * lookD, cam.position.z + fz * Math.cos(lp) * lookD); // the crosshair is the shot line
  // HUD state
  document.body.classList.toggle('aiming', aiming);
  scopeOverlay(P.scoped);
  if (hitT > 0) { hitT -= dt; el['fh-hit'].style.opacity = Math.max(0, hitT / 0.35); }
  el['fh-hurt'].style.opacity = P.hurtT;
  focus = findFocus();
  el['fh-prompt'].textContent = focus ? `E / A  ·  ${typeof focus.label === 'function' ? focus.label() : focus.label}` : '';
  el['fh-prompt'].style.display = focus && !aiming && !(focus.global && P.speed > 1.2) ? 'block' : 'none';
  hudT -= dt; if (hudT <= 0) { hudT = 0.25; hud(); }
}
let hudT = 0;
/** VR on foot: the headset owns the camera. input = { mx, mz (stick), yaw (head yaw), fire, fireHeld, interact, reload, cycle }. */
function updateXR(dt, input) {
  if (!P.on) return;
  P.camYaw = input.yaw; P.yaw = input.yaw;
  const fx = Math.sin(input.yaw), fz = Math.cos(input.yaw), rx = -Math.cos(input.yaw), rz = Math.sin(input.yaw);
  const sp = 2.6 * (window.GOASurvival?.speedFactor?.() ?? 1);
  let wx = fx * input.mz + rx * input.mx, wz = fz * input.mz + rz * input.mx; const wl = Math.hypot(wx, wz); if (wl > 1) { wx /= wl; wz /= wl; }
  P.vx = damp(P.vx, wx * sp, 8, dt); P.vz = damp(P.vz, wz * sp, 8, dt);
  const nx = P.x + P.vx * dt, nz = P.z + P.vz * dt, gyN = api.groundY(nx, nz), gy = api.groundY(P.x, P.z);
  if (!(gyN < api.WATER - 0.35 || (gyN - gy) / Math.max(Math.hypot(nx - P.x, nz - P.z), 1e-3) > 1.6)) { P.x = nx; P.z = nz; }
  P.speed = Math.hypot(P.vx, P.vz); P.y = damp(P.y, Math.max(api.groundY(P.x, P.z), api.WATER - 0.5), 14, dt);
  P.fireT = Math.max(0, P.fireT - dt); P.stamina = Math.min(1, P.stamina + dt * 0.1);
  if (P.reloadT > 0) { P.reloadT -= dt; if (P.reloadT <= 0) { const id = current(), s2 = window.GOAWeapons.STATS[id]; if (s2) { const take = Math.min(s2.mag - (inv.mags[id] || 0), inv.ammo[s2.family]); inv.ammo[s2.family] -= take; inv.mags[id] = (inv.mags[id] || 0) + take; } } }
  if (input.fire) fire(input.rayO, input.rayD);
  if (current() === 'rod') window.GOAFishing?.hold?.(!!input.fireHeld, dt);
  if (input.interact) interact(); if (input.reload) reload(); if (input.cycle) cycle(1);
  if (person) person.mesh.visible = false;
  focus = findFocus();
}

function init(hooks) {
  api = hooks; T = window.THREE;
  buildHud(); bindMouse();
  // starting kit: the outfitter's weapon with three boxes of ammunition
  const lo = window.GOAExtension?.getLoadout?.();
  setLoadout(lo?.weaponId || 'rifle-wood', lo?.ammoId);
}
function setLoadout(weaponId, ammoId) {
  const st = window.GOAWeapons.STATS[weaponId]; if (!st) return;
  if (!inv.weapons.includes(weaponId)) inv.weapons = [weaponId, ...inv.weapons.filter((w) => w !== weaponId && !window.GOASurvival?.active?.())].slice(0, 3);
  if (ammoId) inv.ammoType[weaponId] = ammoId;
  if (!window.GOASurvival?.active?.()) { inv.ammo[st.family] = Math.max(inv.ammo[st.family], st.family === 'rifle' ? 24 : st.family === 'shotgun' ? 25 : 30); if (!inv.mags[weaponId]) inv.mags[weaponId] = st.mag; }
  P.slot = 0; equip();
}
function setAvatar(id) { avatarId = id; try { localStorage.setItem(AVATAR_KEY, id); } catch (e) { /* no storage */ } spawnPerson(); if (person) person.mesh.visible = P.on; }

window.GOAPlayer = {
  init, update, updateXR, pad, fire, focusLabel: () => focus ? (typeof focus.label === 'function' ? focus.label() : focus.label) : '', exitVehicle, enterVehicle, hurt, addInteractable, setLoadout, setAvatar, equip, hud, sound, cycle,
  onFoot: () => P.on, position: () => ({ x: P.x, y: P.y, z: P.z, speed: P.speed, yaw: P.yaw }), state: P, inv, TOOL_INFO,
  avatar: () => avatarId, current, teleport(x, z, yaw) { P.x = x; P.z = z; P.y = api.groundY(x, z); if (yaw !== undefined) { P.yaw = P.camYaw = yaw; } },
  feed(seconds) { P.wellFed = Math.max(P.wellFed, seconds); P.stamina = 1; }, heal(n) { P.health = Math.min(100, P.health + n); hud(); },
};
})();

/* Great Outdoors Adventure: camp life, companions and the Adventure panel.
   A deployed camp gets a campfire (cook game and fish, warm up), a tent (rest until morning or evening) and a supply box
   (restock ammunition). Companions you choose sit around the fire, wave as you walk up and share tips.
   The Adventure panel (key G, or Menu → Adventure) picks the game mode, your character and your camp companions. */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
let T, api;
const fires = [];
let camp = null, npcs = [], companions = [];
try { companions = JSON.parse(localStorage.getItem('goa-companions-v1') || '["guide","camper"]'); } catch (e) { companions = ['guide', 'camper']; }

// ------------------------------------------------------------------ fire
let flameTex = null;
function flameTexture() {
  if (flameTex) return flameTex;
  const c = document.createElement('canvas'); c.width = 64; c.height = 128; const g = c.getContext('2d');
  const gr = g.createRadialGradient(32, 96, 4, 32, 80, 60); gr.addColorStop(0, 'rgba(255,250,210,1)'); gr.addColorStop(0.25, 'rgba(255,190,70,.95)'); gr.addColorStop(0.6, 'rgba(240,90,20,.55)'); gr.addColorStop(1, 'rgba(120,20,0,0)');
  g.fillStyle = gr; g.beginPath(); g.moveTo(32, 2); g.bezierCurveTo(58, 50, 62, 90, 32, 126); g.bezierCurveTo(2, 90, 6, 50, 32, 2); g.fill();
  flameTex = new T.CanvasTexture(c); flameTex.colorSpace = T.SRGBColorSpace; return flameTex;
}
/** A campfire at (x, z). fuel in seconds (Infinity for camp fires); returns the fire record. */
function makeFire(x, z, fuel = Infinity) {
  const g = new T.Group(); g.name = 'campfire';
  const stone = new T.MeshStandardMaterial({ color: '#7d7a72', roughness: 0.95 }), log = new T.MeshStandardMaterial({ color: '#4b3221', roughness: 0.9 }), ember = new T.MeshStandardMaterial({ color: '#2a1a12', emissive: '#ff5a1a', emissiveIntensity: 0.9, roughness: 1 });
  for (let i = 0; i < 9; i++) { const a = i / 9 * Math.PI * 2, s = new T.Mesh(new T.DodecahedronGeometry(0.16 + Math.random() * 0.05, 0), stone); s.position.set(Math.cos(a) * 0.55, 0.08, Math.sin(a) * 0.55); s.rotation.set(Math.random() * 3, Math.random() * 3, 0); s.castShadow = true; g.add(s); }
  for (let i = 0; i < 4; i++) { const l = new T.Mesh(new T.CylinderGeometry(0.06, 0.07, 0.75, 7), log); l.rotation.set(Math.PI / 2 - 0.45, i * Math.PI / 2 + 0.3, 0); l.position.set(Math.sin(i * Math.PI / 2 + 0.3) * 0.15, 0.18, Math.cos(i * Math.PI / 2 + 0.3) * 0.15); l.castShadow = true; g.add(l); }
  const bed = new T.Mesh(new T.CylinderGeometry(0.32, 0.38, 0.06, 12), ember); bed.position.y = 0.04; g.add(bed);
  const flames = [], mat = new T.MeshBasicMaterial({ map: flameTexture(), transparent: true, blending: T.AdditiveBlending, depthWrite: false, side: T.DoubleSide });
  for (let i = 0; i < 3; i++) { const f = new T.Mesh(new T.PlaneGeometry(0.6, 1.0), mat); f.position.y = 0.55; f.rotation.y = i * Math.PI / 3; g.add(f); flames.push(f); }
  const light = new T.PointLight('#ff9a4a', 6, 14, 1.6); light.position.y = 0.9; g.add(light);
  const smokeMat = new T.MeshBasicMaterial({ color: '#9a9590', transparent: true, opacity: 0.18, depthWrite: false });
  const smoke = []; for (let i = 0; i < 6; i++) { const s = new T.Mesh(new T.SphereGeometry(0.22, 8, 6), smokeMat); s.userData.t = i / 6; g.add(s); smoke.push(s); }
  g.position.set(x, api.groundY(x, z) + 0.02, z); api.scene.add(g);
  const rec = { group: g, x, z, fuel, light, flames, smoke, lit: true, ember };
  fires.push(rec); return rec;
}
function removeFire(rec) { const i = fires.indexOf(rec); if (i >= 0) fires.splice(i, 1); api.scene.remove(rec.group); }
function updateFires(dt, t) {
  for (const f of [...fires]) {
    if (f.fuel !== Infinity) { f.fuel -= dt; if (f.fuel <= 0 && f.lit) { f.lit = false; api.toast('Your fire has burned out · add wood (E) to relight it'); } }
    const on = f.lit ? 1 : 0;
    f.light.intensity = on * (5 + Math.sin(t * 13 + f.x) * 0.9 + Math.sin(t * 7.3) * 0.6) * (api.night?.() ? 2.2 : 1);
    f.flames.forEach((m, i) => { m.visible = !!on; m.scale.set(1 + Math.sin(t * 9 + i) * 0.12, 0.85 + Math.sin(t * 11 + i * 2) * 0.2, 1); m.lookAt(api.camera.position.x, m.getWorldPosition(new T.Vector3()).y, api.camera.position.z); });
    f.ember.emissiveIntensity = on ? 0.9 : 0.08;
    for (const s of f.smoke) { s.userData.t = (s.userData.t + dt * 0.12) % 1; const k = s.userData.t; s.visible = !!on || k < 0.3; s.position.set(Math.sin(k * 6 + f.x) * 0.3 * k, 0.9 + k * 4, Math.cos(k * 5) * 0.3 * k); s.scale.setScalar(0.6 + k * 2.4); s.material.opacity = 0.18 * (1 - k); }
  }
}
function nearFire(x, z, r = 3) { return fires.find((f) => f.lit && Math.hypot(f.x - x, f.z - z) < r); }

// ------------------------------------------------------------------ cooking
function cook() {
  const inv = window.GOAPlayer.inv, f = inv.food;
  if (f.rawMeat > 0) { f.rawMeat--; f.cookedMeat++; api.toast('Cooked venison over the fire · eat it (E) for energy'); }
  else if (f.rawFish > 0) { f.rawFish--; f.cookedFish++; api.toast('Grilled fresh fish over the fire · eat it (E) for energy'); }
  else if (!window.GOASurvival?.active?.()) { window.GOAPlayer.feed(300); api.toast('Hot camp chili and coffee · stamina restored, sprint longer for 5 minutes'); return; }
  else { api.toast('Nothing to cook · hunt, fish or forage first'); return; }
  window.GOAPlayer.sound('reload', 0.4);
}
function eat() {
  const f = window.GOAPlayer.inv.food;
  if (f.cookedMeat > 0) { f.cookedMeat--; window.GOASurvival?.eat?.(45); window.GOAPlayer.feed(420); window.GOAPlayer.heal(15); api.toast('A hearty meal · hunger satisfied, stamina boosted'); return true; }
  if (f.cookedFish > 0) { f.cookedFish--; window.GOASurvival?.eat?.(30); window.GOAPlayer.feed(300); window.GOAPlayer.heal(10); api.toast('Fresh fish · hunger eased, stamina boosted'); return true; }
  if (f.berries > 0) { f.berries--; window.GOASurvival?.eat?.(10); api.toast('A handful of berries'); return true; }
  return false;
}
function hasCookable() { const f = window.GOAPlayer.inv.food; return f.rawMeat > 0 || f.rawFish > 0; }
function hasCooked() { const f = window.GOAPlayer.inv.food; return f.cookedMeat > 0 || f.cookedFish > 0 || f.berries > 0; }

// ------------------------------------------------------------------ the expedition camp
function worldOf(obj) { const v = new T.Vector3(); obj.getWorldPosition(v); return v; }
function onDeploy(group) {
  camp = group;
  group.updateMatrixWorld(true);
  const center = worldOf(group);
  const fx = center.x + Math.sin(group.rotation.y + 0.5) * 4.2, fz = center.z + Math.cos(group.rotation.y + 0.5) * 4.2; // clear of the gear
  camp.userData.fire = makeFire(fx, fz);
  const tent = group.getObjectByName('tent'), box = group.getObjectByName('container') || group.getObjectByName('pack');
  camp.userData.tentPos = tent ? worldOf(tent) : null; camp.userData.boxPos = box ? worldOf(box) : new T.Vector3(center.x, 0, center.z);
  spawnCompanions(fx, fz);
}
function onPack() {
  if (camp?.userData.fire) removeFire(camp.userData.fire);
  for (const n of npcs) api.scene.remove(n.person.mesh); npcs = []; camp = null;
}
function rest() {
  const order = ['morning', 'midday', 'golden'], cur = api.P.tod === 'season' ? 'midday' : api.P.tod;
  const next = cur === 'golden' ? 'morning' : 'golden';
  if (window.GOASurvival?.active?.()) { window.GOASurvival.sleep(); return; }
  api.setPref('tod', next); window.GOAPlayer.state.stamina = 1; window.GOAPlayer.heal(30);
  api.toast(next === 'morning' ? 'You sleep soundly and wake at first light' : 'A long rest · the light turns golden');
  void order;
}
function restock() {
  const inv = window.GOAPlayer.inv; let got = [];
  for (const id of inv.weapons) { const st = window.GOAWeapons.STATS[id]; const cap = st.family === 'rifle' ? 24 : st.family === 'shotgun' ? 25 : 30; if (inv.ammo[st.family] < cap) { inv.ammo[st.family] = cap; got.push(st.family); } }
  window.GOAPlayer.hud(); api.toast(got.length ? `Restocked ${[...new Set(got)].join(' and ')} ammunition` : 'Your ammunition is already full');
}

// ------------------------------------------------------------------ companions
const TIPS = {
  hunter: ['Elk bed on the high meadows past the river bend. Come at them from downwind and on foot.', 'Shoulder shots drop them clean. Aim just behind the front leg.', 'A charging bear? Stand your ground and make every shot count.'],
  ranger: ['Bears are shy until they are hurt. Never wound one and walk away.', 'Fill your canteen from the river, not the meltwater ponds.', 'Night gets cold up on Snowy Mountain. Keep a fire going.'],
  guide: ['Walk slow and the deer will let you close. Run and you will only see white tails.', 'Trout hold in the slow water by the cabins. Cast upstream and let it drift.', 'Follow the compass, not your gut. The valleys all look alike at dusk.'],
  camper: ['Bring me something from the hunt and I will cook it right.', 'Pitch the tent on flat ground, close to the fire, away from the water.', 'A full stomach is a warm body. Eat before you sleep.'],
  tracker: ['Fresh tracks by the treeline · deer moved through within the hour.', 'Coyotes hunt in pairs after dark. Watch your back.', 'Fox dens up in the brush near the field edges.'],
  photographer: ['The golden hour is when the elk come down to drink.', 'Keep an animal in view for a moment to log it in your journal.', 'Hares turn white in winter. Look twice at every snowbank.'],
};
function spawnCompanions(fx, fz) {
  for (const n of npcs) api.scene.remove(n.person.mesh); npcs = [];
  const me = window.GOAPlayer.avatar();
  const list = companions.filter((id) => id !== me).slice(0, 2);
  list.forEach((id, i) => {
    const person = window.GOAPeople.create(id), ang = i === 0 ? 2.3 : -2.0;
    const x = fx + Math.sin(ang) * 1.35, z = fz + Math.cos(ang) * 1.35;
    person.mesh.position.set(x, api.groundY(x, z), z); person.mesh.rotation.y = Math.atan2(fx - x, fz - z); api.scene.add(person.mesh);
    const n = { id, person, x, z, mode: 'sit', tip: 0, waveT: 0 };
    npcs.push(n);
  });
}
function updateNpcs(dt) {
  const pl = window.GOAPlayer.position(), foot = window.GOAPlayer.onFoot();
  for (const n of npcs) {
    const d = Math.hypot(pl.x - n.x, pl.z - n.z);
    if (foot && d < 9 && d > 3 && n.waveT <= 0 && !n.waved) { n.waveT = 2.2; n.waved = true; }
    if (d > 20) n.waved = false;
    n.waveT -= dt;
    n.person.pose({ speed: 0, mode: n.waveT > 0 ? 'wave' : 'sit', pitch: 0 }, dt);
  }
}
function talk(n) {
  const av = window.GOAPeople.AVATARS.find((a) => a.id === n.id), tips = TIPS[n.id] || TIPS.guide;
  api.toast(`${av.name}: “${tips[n.tip++ % tips.length]}”`, 4.5); n.waveT = 1.5;
}

// ------------------------------------------------------------------ interactables
function registerInteractables() {
  const P = window.GOAPlayer;
  P.addInteractable({ radius: 2.8, pos: () => nearestFirePos(), enabled: () => !!nearestFirePos(), bias: () => hasCookable() || hasCooked() ? 2 : 0,
    label: () => hasCookable() ? 'Cook at the fire' : hasCooked() ? 'Eat a meal' : window.GOASurvival?.active?.() ? 'Warm up by the fire' : 'Cook camp chili',
    action: () => { if (hasCookable()) cook(); else if (!eat()) { if (window.GOASurvival?.active?.()) window.GOASurvival.warm(); else cook(); } } });
  P.addInteractable({ radius: 2.6, pos: () => camp?.userData.tentPos || far, enabled: () => !!camp?.userData.tentPos, label: () => 'Rest in the tent', action: rest });
  P.addInteractable({ radius: 2.2, pos: () => camp?.userData.boxPos || far, enabled: () => !!camp && !window.GOASurvival?.active?.(), label: 'Restock ammunition from camp supplies', action: restock });
  P.addInteractable({ global: true, pos: () => far, enabled: () => !camp && !window.GOASurvival?.active?.() && P.onFoot(), label: 'Set up camp here', action: () => window.GOAExtension?.deployCamp?.() });
  P.addInteractable({ global: true, pos: () => far, enabled: () => !!camp && P.onFoot() && !nearestFirePos() && Math.hypot(P.position().x - camp.position.x, P.position().z - camp.position.z) < 14, label: 'Pack up camp', action: () => window.GOAExtension?.deployCamp?.() });
  P.addInteractable({ radius: 2.4, pos: () => nearestNpc() || far, enabled: () => !!nearestNpc(), label: () => `Talk to ${window.GOAPeople.AVATARS.find((a) => a.id === nearestNpc().id).name}`, action: () => talk(nearestNpc()) });
}
const far = { x: 1e9, z: 1e9 };
function nearestFirePos() { const p = window.GOAPlayer.position(); const f = fires.filter((q) => Math.hypot(q.x - p.x, q.z - p.z) < 3.5)[0]; return f ? { x: f.x, z: f.z, fire: f } : null; }
function nearestNpc() { const p = window.GOAPlayer.position(); return npcs.find((n) => Math.hypot(n.x - p.x, n.z - p.z) < 2.6) || null; }

// ------------------------------------------------------------------ Adventure panel: mode, character, companions
let panel = null;
const portraits = {};
function portrait(id) {
  if (portraits[id]) return portraits[id];
  try {
    const r = new T.WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: true }); r.setSize(160, 200); r.outputColorSpace = T.SRGBColorSpace;
    const sc = new T.Scene(); sc.add(new T.HemisphereLight('#f2f0e8', '#6a6050', 1.6)); const d = new T.DirectionalLight('#fff4e2', 2.2); d.position.set(1.5, 2, 3); sc.add(d);
    const p = window.GOAPeople.create(id); p.mesh.rotation.y = 0.25; sc.add(p.mesh); p.pose({ speed: 0, mode: 'idle' }, 0.016);
    p.mesh.updateMatrixWorld(true); const hp = p.bones.head.getWorldPosition(new T.Vector3()); // head-and-shoulders, so faces read
    const cam = new T.PerspectiveCamera(24, 0.8, 0.05, 20); cam.position.set(hp.x + 0.12, hp.y + 0.02, hp.z + 1.25); cam.lookAt(hp.x, hp.y - 0.07, hp.z);
    r.render(sc, cam); const url = r.domElement.toDataURL('image/png'); r.dispose(); r.forceContextLoss?.();
    if (window.GOAPeople.usesModel?.(id) && !p.modelReady) return url; // body still loading: draw again next time
    portraits[id] = url;
  } catch (e) { portraits[id] = ''; }
  return portraits[id];
}
function buildPanel() {
  panel = document.createElement('div'); panel.id = 'adventure'; panel.className = 'sheet card'; panel.setAttribute('role', 'dialog'); panel.setAttribute('aria-label', 'Adventure modes and characters');
  panel.innerHTML = `<div class="sethead"><b>ADVENTURE · MODES & CHARACTERS</b><button class="btn" id="adv-close">Close</button></div>
  <div class="adv-content">
   <h3>Game mode</h3><div id="adv-modes" class="adv-modes"></div>
   <h3>Your character</h3><p>This is who you play when you step out of the vehicle (F or D-pad Left).</p><div id="adv-avatars" class="adv-grid"></div>
   <h3>Camp companions</h3><p>Pick up to two. They gather around your campfire when you deploy camp (E). Walk up and press E to talk.</p><div id="adv-companions" class="adv-grid small"></div>
   <h3>How to play on foot</h3><p class="adv-help">WASD move · Shift sprint · mouse look (click to capture) · right mouse aim · left click fire / cast · R reload · Tab switch item · E interact · F vehicle. Controller: left stick move, right stick look, LT aim, RT fire, A interact, X reload, LB/RB switch, Y or D-pad Left vehicle.</p>
  </div>`;
  document.body.append(panel);
  $('adv-close').onclick = () => open(false);
  const chip = document.createElement('button'); chip.className = 'chip'; chip.id = 'advbtn'; chip.textContent = 'Adventure'; chip.onclick = () => open(); $('tools')?.prepend(chip);
  const pause = document.createElement('button'); pause.className = 'btn'; pause.textContent = 'Adventure'; pause.onclick = () => open(true); $('settings')?.querySelector('.sethead')?.insertBefore(pause, $('setclose'));
  addEventListener('keydown', (e) => { if (e.code === 'KeyG' && !e.repeat && !e.target.closest('input,select,textarea')) { e.preventDefault(); open(); } });
}
const MODES = [
  { id: 'expedition', name: 'Expedition', desc: 'Drive, hunt, fish and camp at your own pace. Restock at camp; animals keep their distance.' },
  { id: 'survival', name: 'Survival', desc: 'Stranded in the wild with a knife. Find water, wood and supply caches with the map and compass, pitch a tent, keep a fire and fight off bears and coyotes.' },
  { id: 'fishing', name: 'Fishing', desc: 'Start on the river with a rod. Catch trout, bass, catfish and char; your biggest fish go in the journal.' },
];
function render() {
  const mode = window.GOAModes?.current?.() || 'expedition';
  const mEl = $('adv-modes'); mEl.innerHTML = '';
  for (const m of MODES) {
    const b = document.createElement('button'); b.className = 'adv-mode' + (m.id === mode ? ' on' : '');
    b.innerHTML = `<b>${m.name}</b><span>${m.desc}</span><em>${m.id === mode ? 'Playing' : 'Start'}</em>`;
    b.onclick = () => { open(false); window.GOAModes.start(m.id); };
    mEl.append(b);
  }
  const me = window.GOAPlayer.avatar(), aEl = $('adv-avatars'); aEl.innerHTML = '';
  for (const av of window.GOAPeople.AVATARS) {
    const b = document.createElement('button'); b.className = 'adv-avatar' + (av.id === me ? ' on' : '');
    b.innerHTML = `<img alt="" src="${portrait(av.id)}"><b>${av.name}</b><span>${av.role}</span><small>${av.bio}</small>`;
    b.onclick = () => { window.GOAPlayer.setAvatar(av.id); if (camp) spawnCompanions(camp.userData.fire.x, camp.userData.fire.z); render(); api.toast(`Playing as ${av.name}`); };
    aEl.append(b);
  }
  const cEl = $('adv-companions'); cEl.innerHTML = '';
  for (const av of window.GOAPeople.AVATARS) {
    if (av.id === me) continue;
    const on = companions.includes(av.id), b = document.createElement('button'); b.className = 'adv-avatar' + (on ? ' on' : '');
    b.innerHTML = `<img alt="" src="${portrait(av.id)}"><b>${av.name}</b><span>${on ? 'In camp ✓' : av.role}</span>`;
    b.onclick = () => {
      companions = on ? companions.filter((c) => c !== av.id) : [...companions.filter((c) => c !== me), av.id].slice(-2);
      try { localStorage.setItem('goa-companions-v1', JSON.stringify(companions)); } catch (e) { /* no storage */ }
      if (camp) spawnCompanions(camp.userData.fire.x, camp.userData.fire.z); render();
    };
    cEl.append(b);
  }
}
function open(v) {
  const show = v === undefined ? !isOpen() : v; panel.classList.toggle('open', show);
  if (show) { api.openSettings?.(false); api.openMap?.(false); window.GOAExtension?.close?.(); window.GOAWildlife?.close?.(); for (const k in api.keys) api.keys[k] = 0; document.exitPointerLock?.(); render(); }
}
function isOpen() { return !!panel?.classList.contains('open'); }

function frame(dt, t) { updateFires(dt, t); updateNpcs(dt); }
function init(hooks) { api = hooks; T = window.THREE; buildPanel(); registerInteractables(); }

window.GOACampLife = { npcCount: () => npcs.length, init, frame, onDeploy, onPack, makeFire, removeFire, nearFire, fires, cook, eat, open, isOpen, close() { open(false); }, campfire: () => camp?.userData.fire || null };
})();

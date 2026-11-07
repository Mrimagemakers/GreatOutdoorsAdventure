/* Great Outdoors Adventure: game modes, and Survival.
   Survival: your truck has broken down and rescue is three nights away. Start with a knife and a trail map that marks
   six supply caches. Keep hunger, thirst and warmth up, find water, gather deadfall, start a fire, pitch a tent, and
   fend off bears and (after dark) coyotes. A compass strip shows your heading and the nearest cache. */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
let T, api;
let mode = 'expedition';
const DAY = 600; // seconds for a full day in Survival
const SV = { on: false, clock: 0, day: 1, hunger: 100, thirst: 100, warmth: 100, dead: false, won: false, caches: [], wood: [], bushes: [], tent: null, fire: null, startX: 0, startZ: 0, lastTod: '' };
const BEST = 'goa-survival-best-v1';

// ------------------------------------------------------------------ the day: morning, midday, golden hour, night
function phaseOf(clock) { const f = (clock % DAY) / DAY; return f < 0.25 ? 'morning' : f < 0.5 ? 'midday' : f < 0.68 ? 'golden' : 'night'; }
function isNight() { return SV.on && phaseOf(SV.clock) === 'night'; }

// ------------------------------------------------------------------ props
function crateMesh() {
  const g = new T.Group(), wood = new T.MeshStandardMaterial({ color: '#7a5a34', roughness: 0.9 }), band = new T.MeshStandardMaterial({ color: '#3a3f3a', metalness: 0.6, roughness: 0.4 });
  const b = new T.Mesh(new T.BoxGeometry(0.9, 0.55, 0.6), wood); b.position.y = 0.28; b.castShadow = true; g.add(b);
  for (const x of [-0.3, 0.3]) { const s = new T.Mesh(new T.BoxGeometry(0.06, 0.57, 0.62), band); s.position.set(x, 0.28, 0); g.add(s); }
  const flag = new T.Mesh(new T.PlaneGeometry(0.5, 0.3), new T.MeshStandardMaterial({ color: '#ef6a1d', side: T.DoubleSide, emissive: '#5a1f00', emissiveIntensity: 0.4 }));
  flag.position.set(0.28, 1.45, 0); g.add(flag);
  const pole = new T.Mesh(new T.CylinderGeometry(0.015, 0.015, 1.5, 5), band); pole.position.set(0.04, 0.95, 0); g.add(pole);
  g.userData.flag = flag; return g;
}
function deadfallMesh() {
  const g = new T.Group(), m = new T.MeshStandardMaterial({ color: '#5a4330', roughness: 1 });
  for (let i = 0; i < 4; i++) { const l = new T.Mesh(new T.CylinderGeometry(0.05, 0.07, 1 + Math.random() * 0.7, 6), m); l.rotation.set(Math.PI / 2, Math.random() * 3, 0); l.position.set((Math.random() - 0.5) * 0.4, 0.06 + i * 0.08, (Math.random() - 0.5) * 0.4); l.castShadow = true; g.add(l); }
  return g;
}
function bushMesh() {
  const g = new T.Group(), leaf = new T.MeshStandardMaterial({ color: '#3f5f2c', roughness: 0.9 }), berry = new T.MeshStandardMaterial({ color: '#7a1f4a', roughness: 0.5 });
  const b = new T.Mesh(new T.IcosahedronGeometry(0.55, 1), leaf); b.scale.set(1, 0.7, 1); b.position.y = 0.35; b.castShadow = true; g.add(b);
  const berries = new T.Group(); for (let i = 0; i < 14; i++) { const s = new T.Mesh(new T.SphereGeometry(0.035, 6, 5), berry); const a = Math.random() * 6.28, y = Math.random(); s.position.set(Math.cos(a) * 0.52 * (1 - y * 0.4), 0.2 + y * 0.45, Math.sin(a) * 0.52 * (1 - y * 0.4)); berries.add(s); }
  g.add(berries); g.userData.berries = berries; return g;
}
const CACHE_LOOT = [
  { tools: ['compass', 'canteen'], food: { berries: 2 }, label: 'compass and canteen' },
  { tools: ['firekit', 'hatchet'], label: 'fire kit and hatchet' },
  { tools: ['tent'], label: 'a lightweight tent' },
  { weapon: 'rifle-wood', ammo: ['rifle', 12], label: 'a wood-stock hunting rifle and 12 rounds' },
  { weapon: 'shotgun-field', ammo: ['shotgun', 14], tools: ['rod'], label: 'a field shotgun, 14 shells and a fishing rod' },
  { weapon: 'revolver', ammo: ['handgun', 18], food: { cookedMeat: 1 }, label: 'a revolver, 18 rounds and jerky' },
];

function place(obj, x, z) { obj.position.set(x, api.groundY(x, z), z); api.scene.add(obj); return obj; }
function spotNear(cx, cz, rMin, rMax) {
  for (let i = 0; i < 60; i++) {
    const a = Math.random() * Math.PI * 2, r = rMin + Math.random() * (rMax - rMin), x = cx + Math.sin(a) * r, z = cz + Math.cos(a) * r;
    if (Math.abs(x) > 1050 || Math.abs(z) > 1050) continue;
    const y = api.groundY(x, z); if (y < api.WATER + 0.5) continue;
    const q = api.nearestRoad(x, z, {}); if (q.road >= 0 && q.d - q.hw < 4) continue;
    const sl = Math.abs(api.terrainH(x + 2, z) - api.terrainH(x - 2, z)) + Math.abs(api.terrainH(x, z + 2) - api.terrainH(x, z - 2)); if (sl > 2) continue;
    return [x, z];
  }
  return [cx + rMin, cz];
}
function clearProps() {
  for (const c of SV.caches) api.scene.remove(c.mesh); for (const w of SV.wood) api.scene.remove(w.mesh); for (const b of SV.bushes) api.scene.remove(b.mesh);
  if (SV.tent) api.scene.remove(SV.tent.group); if (SV.fire) window.GOACampLife.removeFire(SV.fire);
  SV.caches = []; SV.wood = []; SV.bushes = []; SV.tent = null; SV.fire = null;
}

// ------------------------------------------------------------------ start / end
function startSurvival() {
  clearProps();
  const rv = window.GOALocations?.list?.().find((p) => p.id === 'river-valley') || { x: 0, z: 0 };
  // break down beside the River Valley road, then walk into the woods
  api.travel?.('river-valley');
  const [sx, sz] = spotNear(rv.x, rv.z, 60, 110);
  Object.assign(SV, { on: true, clock: DAY * 0.05, day: 1, hunger: 100, thirst: 85, warmth: 100, dead: false, won: false, startX: sx, startZ: sz });
  // inventory: knife and a map; everything else must be found
  const inv = window.GOAPlayer.inv;
  inv.weapons = []; inv.ammo = { rifle: 0, shotgun: 0, handgun: 0 }; inv.mags = {}; inv.tools = new Set(['knife', 'map']);
  inv.food = { rawMeat: 0, cookedMeat: 0, rawFish: 0, cookedFish: 0, berries: 1 }; inv.wood = 0; inv.water = 0;
  if (!window.GOAPlayer.onFoot()) window.GOAPlayer.exitVehicle();
  window.GOAPlayer.teleport(sx, sz, Math.atan2(rv.x - sx, rv.z - sz)); window.GOAPlayer.state.health = 100; window.GOAPlayer.state.slot = 0; window.GOAPlayer.equip();
  // six caches in a loose ring, the first one close by
  CACHE_LOOT.forEach((loot, i) => {
    const [x, z] = spotNear(sx, sz, i === 0 ? 35 : 90 + i * 45, i === 0 ? 60 : 160 + i * 55);
    const mesh = place(crateMesh(), x, z); mesh.rotation.y = Math.random() * 6;
    SV.caches.push({ x, z, mesh, loot, opened: false, n: i + 1 });
  });
  for (let i = 0; i < 36; i++) { const [x, z] = spotNear(sx, sz, 8, 320); SV.wood.push({ x, z, mesh: place(deadfallMesh(), x, z), left: 3 }); }
  for (let i = 0; i < 14; i++) { const [x, z] = spotNear(sx, sz, 15, 300); SV.bushes.push({ x, z, mesh: place(bushMesh(), x, z), regrow: 0 }); }
  setMarkerToCache(); compass(true); document.body.classList.add('survival');
  api.toast('Survival · Day 1. Your truck is dead. Rescue comes after the third night. Check your map (M) for supply caches.', 6);
}
function stopSurvival() {
  if (!SV.on) return; SV.on = false; clearProps(); compass(false); document.body.classList.remove('survival');
  api.setMarker?.(null);
}
function onDeath(from) {
  if (!SV.on || SV.dead) return false;
  SV.dead = true; showEnd(false, from ? `Taken by a ${from.spec?.name?.toLowerCase() || 'wild animal'}` : 'The wilderness won this time'); return true;
}
function showEnd(won, why) {
  const days = SV.day + (SV.clock % DAY) / DAY - 1;
  let best = 0; try { best = +localStorage.getItem(BEST) || 0; if (days > best) localStorage.setItem(BEST, String(days.toFixed(2))); } catch (e) { /* no storage */ }
  const el = $('surv-end'); el.querySelector('h2').textContent = won ? 'Rescued!' : 'You didn’t make it';
  el.querySelector('p').textContent = `${why} · survived ${days.toFixed(1)} days${days > best ? ' · a new personal best' : ` · best ${(+best).toFixed(1)} days`}.`;
  el.classList.add('open'); document.exitPointerLock?.();
}

// ------------------------------------------------------------------ actions
function openCache(c) {
  if (c.opened) return; c.opened = true; c.mesh.userData.flag.visible = false;
  const inv = window.GOAPlayer.inv, L = c.loot;
  for (const t of L.tools || []) inv.tools.add(t);
  if (L.weapon && !inv.weapons.includes(L.weapon)) { inv.weapons.push(L.weapon); inv.mags[L.weapon] = 0; }
  if (L.ammo) inv.ammo[L.ammo[0]] += L.ammo[1];
  for (const [k, v] of Object.entries(L.food || {})) inv.food[k] += v;
  window.GOAPlayer.equip(); setMarkerToCache();
  api.toast(`Supply cache ${c.n}: ${L.label}. ${SV.caches.every((q) => q.opened) ? 'That was the last cache.' : 'Next cache marked on your map.'}`, 4);
}
function gatherWood(w) {
  const hatchet = window.GOAPlayer.inv.tools.has('hatchet'), n = Math.min(w.left, hatchet ? 3 : 1);
  w.left -= n; window.GOAPlayer.inv.wood += n; window.GOAPlayer.sound('reload', 0.8);
  if (w.left <= 0) { api.scene.remove(w.mesh); SV.wood.splice(SV.wood.indexOf(w), 1); }
  api.toast(`+${n} firewood (${window.GOAPlayer.inv.wood})${hatchet ? '' : ' · a hatchet would gather more'}`, 1.6);
}
function buildFire() {
  const inv = window.GOAPlayer.inv, p = window.GOAPlayer.position();
  if (!inv.tools.has('firekit')) { api.toast('You need a fire kit (flint and tinder) · check the supply caches'); return; }
  if (inv.wood < 3) { api.toast(`You need 3 firewood to start a fire (you have ${inv.wood})`); return; }
  inv.wood -= 3; if (SV.fire) window.GOACampLife.removeFire(SV.fire);
  const x = p.x + Math.sin(p.yaw) * 1.6, z = p.z + Math.cos(p.yaw) * 1.6;
  SV.fire = window.GOACampLife.makeFire(x, z, 240); api.toast('You strike the flint and the tinder catches · a fire burns for 4 minutes; add wood to keep it going', 3.5);
}
function feedFire(f) {
  const inv = window.GOAPlayer.inv; if (inv.wood <= 0) { api.toast('No firewood · gather deadfall'); return; }
  inv.wood--; f.fuel = Math.max(f.fuel, 0) + 120; f.lit = true; api.toast(`Fire fed · burns ${Math.round(f.fuel / 60)} more minutes`, 1.6);
}
function pitchTent() {
  const p = window.GOAPlayer.position(), x = p.x + Math.sin(p.yaw) * 3, z = p.z + Math.cos(p.yaw) * 3;
  const hs = [api.groundY(x - 1.4, z - 1.4), api.groundY(x + 1.4, z + 1.4), api.groundY(x - 1.4, z + 1.4), api.groundY(x + 1.4, z - 1.4)];
  if (Math.max(...hs) - Math.min(...hs) > 0.9) { api.toast('Too steep · find flatter ground for the tent'); return; }
  if (SV.tent) api.scene.remove(SV.tent.group);
  const group = window.GOACamp.create(T, ['tent']); const tent = group.getObjectByName('tent'); tent.position.set(0, 0, 0);
  group.position.set(x, api.groundY(x, z) + 0.03, z); group.rotation.y = p.yaw + Math.PI; api.scene.add(group);
  SV.tent = { group, x, z }; api.toast('Tent pitched · sleep in it at night (E)');
}
function sleep() {
  if (!SV.on) return;
  const p = window.GOAPlayer.position();
  const threat = window.GOAWildlife.animals.some((a) => !a.gone && a.state !== 'down' && (a.kind === 'bear' || a.kind === 'coyote') && Math.hypot(a.x - p.x, a.z - p.z) < 45);
  if (threat) { api.toast('Something is prowling nearby · you can’t sleep now'); return; }
  if (!isNight() && phaseOf(SV.clock) !== 'golden') { api.toast('It’s still day · rest at golden hour or after dark'); return; }
  const into = DAY - (SV.clock % DAY); SV.clock += into + 1; // to the next morning
  SV.hunger = Math.max(0, SV.hunger - 22); SV.thirst = Math.max(0, SV.thirst - 26);
  SV.warmth = window.GOACampLife.nearFire(p.x, p.z, 7) ? 100 : 80; window.GOAPlayer.heal(35); window.GOAPlayer.state.stamina = 1;
  api.toast(`You sleep through the night · Day ${Math.floor(SV.clock / DAY) + 1}`, 3);
}
function drink() {
  const inv = window.GOAPlayer.inv;
  if (inv.water > 0 && SV.thirst < 98) { inv.water--; SV.thirst = Math.min(100, SV.thirst + 35); api.toast(`You drink from your canteen (${inv.water} left)`, 1.6); return true; }
  return false;
}
function fillOrDrink() {
  const inv = window.GOAPlayer.inv;
  if (inv.tools.has('canteen') && inv.water < 3) { inv.water = 3; api.toast('Canteen filled · H to drink on the move', 2); }
  else { SV.thirst = Math.min(100, SV.thirst + 30); api.toast('You drink from cupped hands · a canteen would let you carry water', 2); }
}
function nearWater() { const p = window.GOAPlayer.position(); for (let a = 0; a < 8; a++) for (const d of [1.5, 3, 5]) if (window.GOAFishing.isWater(p.x + Math.sin(a * 0.785) * d, p.z + Math.cos(a * 0.785) * d)) return true; return false; }

function registerInteractables() {
  const PL = window.GOAPlayer, far = { x: 1e9, z: 1e9 }, me = () => PL.position();
  const nearest = (list, r, f = () => true) => { const p = me(); let b = null, bd = r; for (const it of list) { if (!f(it)) continue; const d = Math.hypot(it.x - p.x, it.z - p.z); if (d < bd) { bd = d; b = it; } } return b; };
  PL.addInteractable({ radius: 2.2, pos: () => nearest(SV.caches, 2.2, (c) => !c.opened) || far, enabled: () => SV.on && !!nearest(SV.caches, 2.2, (c) => !c.opened), label: () => `Open supply cache ${nearest(SV.caches, 2.2, (c) => !c.opened).n}`, action: () => openCache(nearest(SV.caches, 2.2, (c) => !c.opened)) });
  PL.addInteractable({ radius: 2.0, pos: () => nearest(SV.wood, 2) || far, enabled: () => SV.on && !!nearest(SV.wood, 2), label: () => 'Gather firewood', action: () => gatherWood(nearest(SV.wood, 2)) });
  PL.addInteractable({ radius: 1.9, pos: () => nearest(SV.bushes, 1.9, (b) => b.regrow <= 0) || far, enabled: () => SV.on && !!nearest(SV.bushes, 1.9, (b) => b.regrow <= 0), label: 'Pick berries', action: () => { const b = nearest(SV.bushes, 1.9, (q) => q.regrow <= 0); b.regrow = 240; b.mesh.userData.berries.visible = false; PL.inv.food.berries += 3; api.toast('+3 berries · H to eat'); } });
  PL.addInteractable({ global: true, radius: 99, pos: () => me(), enabled: () => SV.on && nearWater(), label: () => PL.inv.tools.has('canteen') && PL.inv.water < 3 ? 'Fill canteen' : 'Drink from the water', action: fillOrDrink });
  PL.addInteractable({ radius: 2.6, pos: () => SV.fire ? { x: SV.fire.x, z: SV.fire.z } : far, enabled: () => SV.on && !!SV.fire && (!SV.fire.lit || SV.fire.fuel < 60) && PL.inv.wood > 0, label: () => SV.fire.lit ? 'Add wood to the fire' : 'Relight the fire with wood', action: () => feedFire(SV.fire) });
  PL.addInteractable({ global: true, radius: 99, pos: () => me(), enabled: () => SV.on && !window.GOACampLife.nearFire(me().x, me().z, 6) && PL.inv.tools.has('firekit') && PL.inv.wood >= 3, label: 'Build a fire here (3 wood)', action: buildFire });
  PL.addInteractable({ radius: 2.8, pos: () => SV.tent || far, enabled: () => SV.on && !!SV.tent, label: 'Sleep in the tent', action: sleep });
  PL.addInteractable({ global: true, radius: 99, pos: () => me(), enabled: () => SV.on && PL.inv.tools.has('tent') && !SV.tent, label: 'Pitch your tent here', action: pitchTent });
  addEventListener('keydown', (e) => { if (e.code === 'KeyH' && !e.repeat && PL.onFoot() && !e.target.closest('input,select,textarea')) { if (!(SV.on && drink()) && !window.GOACampLife.eat()) api.toast(SV.on ? 'Nothing to eat or drink · fill a canteen, cook game or pick berries' : 'Nothing cooked to eat'); } });
}

// ------------------------------------------------------------------ compass and map
let compassEl = null;
function compass(on) {
  if (!compassEl) {
    compassEl = document.createElement('div'); compassEl.id = 'surv-compass';
    compassEl.innerHTML = '<div id="sc-strip"></div><div id="sc-needle"></div><div id="sc-info"></div>';
    document.body.append(compassEl);
    const vit = document.createElement('div'); vit.id = 'surv-vitals';
    vit.innerHTML = '<label>Hunger<i><b id="sv-h"></b></i></label><label>Thirst<i><b id="sv-t"></b></i></label><label>Warmth<i><b id="sv-w"></b></i></label><p id="sv-day"></p><p id="sv-pack"></p>';
    $('fh-bars')?.append(vit);
    const end = document.createElement('div'); end.id = 'surv-end'; end.className = 'sheet card';
    end.innerHTML = '<h2></h2><p></p><div><button class="btn dark" id="surv-again">Try again</button><button class="btn" id="surv-quit">Back to Expedition</button></div>';
    document.body.append(end);
    $('surv-again').onclick = () => { end.classList.remove('open'); startSurvival(); };
    $('surv-quit').onclick = () => { end.classList.remove('open'); start('expedition'); };
  }
  compassEl.classList.toggle('on', on);
}
function nextCache() { const p = window.GOAPlayer.position(); let b = null, bd = 1e9; for (const c of SV.caches) if (!c.opened) { const d = Math.hypot(c.x - p.x, c.z - p.z); if (d < bd) { bd = d; b = c; } } return b; }
function setMarkerToCache() { const c = nextCache(); api.setMarker?.(c ? c.x : null, c ? c.z : undefined); }
function drawCompass() {
  const p = window.GOAPlayer.onFoot() ? window.GOAPlayer.position() : { x: api.S.x, z: api.S.z, yaw: api.S.yaw };
  const yaw = window.GOAPlayer.onFoot() ? window.GOAPlayer.state.camYaw : api.S.yaw;
  // bearing: 0 = north (-z), clockwise
  const heading = ((Math.PI - yaw) * 180 / Math.PI + 360) % 360;
  const has = window.GOAPlayer.inv.tools.has('compass');
  const strip = $('sc-strip'); let html = '';
  if (has) {
    for (let d = -90; d <= 90; d += 15) {
      const b = Math.round((heading + d + 360) % 360), x = 50 + d / 1.8, lab = { 0: 'N', 45: 'NE', 90: 'E', 135: 'SE', 180: 'S', 225: 'SW', 270: 'W', 315: 'NW' }[(Math.round(b / 15) * 15) % 360];
      html += `<span style="left:${x}%" class="${lab ? 'cd' : ''}">${lab || '·'}</span>`;
    }
    const c = nextCache();
    if (c) { const bc = ((Math.PI - Math.atan2(c.x - p.x, c.z - p.z)) * 180 / Math.PI + 360) % 360; let rel = ((bc - heading + 540) % 360) - 180; rel = clamp(rel, -88, 88); html += `<span class="mark" style="left:${50 + rel / 1.8}%">◆</span>`; }
    if (SV.tent || SV.fire) { const q = SV.fire || SV.tent; const bc = ((Math.PI - Math.atan2(q.x - p.x, q.z - p.z)) * 180 / Math.PI + 360) % 360; let rel = ((bc - heading + 540) % 360) - 180; rel = clamp(rel, -88, 88); html += `<span class="camp" style="left:${50 + rel / 1.8}%">⌂</span>`; }
  } else html = '<span style="left:50%">Find a compass in the first supply cache</span>';
  strip.innerHTML = html;
  const c = nextCache();
  $('sc-info').textContent = has ? `${Math.round(heading)}°${c ? ` · cache ${c.n} ${Math.round(Math.hypot(c.x - p.x, c.z - p.z))} m` : ' · all caches found'}` : '';
}
function mapLayer(ctx, X, Z, dpr) {
  if (!SV.on || !window.GOAPlayer.inv.tools.has('map')) return;
  for (const c of SV.caches) {
    ctx.fillStyle = c.opened ? 'rgba(90,90,90,.6)' : '#ef6a1d'; ctx.strokeStyle = '#1e2226'; ctx.lineWidth = 1.5 * dpr;
    ctx.beginPath(); ctx.moveTo(X(c.x), Z(c.z) - 7 * dpr); ctx.lineTo(X(c.x) + 7 * dpr, Z(c.z)); ctx.lineTo(X(c.x), Z(c.z) + 7 * dpr); ctx.lineTo(X(c.x) - 7 * dpr, Z(c.z)); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#1e2226'; ctx.font = `700 ${10 * dpr}px sans-serif`; ctx.fillText(String(c.n), X(c.x) + 9 * dpr, Z(c.z) + 4 * dpr);
  }
  if (SV.tent) { ctx.fillStyle = '#9b3028'; ctx.fillText('⌂ tent', X(SV.tent.x) + 6 * dpr, Z(SV.tent.z)); }
}

// ------------------------------------------------------------------ per-frame
let lastPhase = '';
function frame(dt) {
  for (const b of SV.bushes) if (b.regrow > 0) { b.regrow -= dt; if (b.regrow <= 0) b.mesh.userData.berries.visible = true; }
  if (!SV.on || SV.dead || SV.won) return;
  SV.clock += dt;
  const ph = phaseOf(SV.clock);
  if (ph !== lastPhase) { lastPhase = ph; api.setPref('tod', ph === 'night' ? 'night' : ph); if (ph === 'night') api.toast('Night falls · it’s getting cold. Stay by a fire and listen for coyotes.', 3.5); if (ph === 'morning' && SV.clock > DAY) api.toast(`Day ${Math.floor(SV.clock / DAY) + 1} · you made it through the night`, 3); }
  SV.day = Math.floor(SV.clock / DAY) + 1;
  if (SV.day >= 4) { SV.won = true; showEnd(true, 'A ranger’s truck finds you at dawn on day 4'); return; }
  const p = window.GOAPlayer.position(), fire = window.GOACampLife.nearFire(p.x, p.z, 6), inTent = SV.tent && Math.hypot(SV.tent.x - p.x, SV.tent.z - p.z) < 3;
  const cold = (ph === 'night' ? 1.4 : ph === 'golden' ? 0.5 : 0.15) + (api.snow?.() || 0) * 0.8;
  SV.hunger = clamp(SV.hunger - dt * 100 / 720, 0, 100);
  SV.thirst = clamp(SV.thirst - dt * 100 / 480 * (window.GOAPlayer.state.speed > 3 ? 1.6 : 1), 0, 100);
  SV.warmth = clamp(SV.warmth + dt * (fire ? 6 : inTent ? 2 : -cold * 1.1), 0, 100);
  const pl = window.GOAPlayer.state;
  if (SV.hunger <= 0 || SV.thirst <= 0 || SV.warmth <= 0) { pl.health = Math.max(0, pl.health - dt * 1.2); if (pl.health <= 0) onDeath(null); }
  else if (SV.hunger > 50 && SV.thirst > 50 && SV.warmth > 50) pl.health = Math.min(100, pl.health + dt * 0.4);
  for (const c of SV.caches) if (!c.opened) c.mesh.userData.flag.rotation.y = Math.sin(performance.now() / 600 + c.n) * 0.4;
  $('sv-h').style.width = SV.hunger + '%'; $('sv-t').style.width = SV.thirst + '%'; $('sv-w').style.width = SV.warmth + '%';
  $('sv-day').textContent = `Day ${SV.day} · ${ph === 'golden' ? 'golden hour' : ph}`;
  const inv = window.GOAPlayer.inv;
  $('sv-pack').textContent = `Wood ${inv.wood} · Water ${inv.water}/3 · Food ${inv.food.cookedMeat + inv.food.cookedFish + inv.food.berries} · Raw ${inv.food.rawMeat + inv.food.rawFish}`;
  drawCompass();
}
function speedFactor() { if (!SV.on) return 1; return (SV.hunger < 15 || SV.thirst < 15 ? 0.7 : 1) * (SV.warmth < 20 ? 0.8 : 1); }

// ------------------------------------------------------------------ modes
function start(id) {
  if (id === mode && id !== 'survival' && id !== 'fishing') return;
  if (mode === 'survival') stopSurvival();
  mode = id;
  document.body.dataset.mode = id;
  if (id === 'expedition') {
    window.GOAFishing.reset(); const lo = window.GOAExtension?.getLoadout?.();
    const inv = window.GOAPlayer.inv; inv.tools.add('rod'); inv.tools.add('knife'); window.GOAPlayer.setLoadout(lo?.weaponId || 'rifle-wood', lo?.ammoId);
    api.setPref('tod', 'season'); api.toast('Expedition · drive, hunt, fish and camp at your own pace', 2.6);
  } else if (id === 'survival') startSurvival();
  else if (id === 'fishing') startFishing();
}
function startFishing() {
  window.GOAFishing.reset();
  const rv = window.GOALocations?.list?.().find((p) => p.id === 'river-valley');
  if (rv) api.travel?.('river-valley');
  // a bank within a few metres of water, facing it
  let best = null;
  for (let r = 10; r < 260 && !best; r += 6) for (let a = 0; a < 24 && !best; a++) {
    const x = (rv?.x || 0) + Math.sin(a / 24 * 6.283) * r, z = (rv?.z || 0) + Math.cos(a / 24 * 6.283) * r;
    if (window.GOAFishing.isWater(x, z)) continue;
    for (let b = 0; b < 12; b++) { const ang = b / 12 * 6.283, wx = x + Math.sin(ang) * 7, wz = z + Math.cos(ang) * 7; if (window.GOAFishing.isWater(wx, wz) && window.GOAFishing.isWater(x + Math.sin(ang) * 12, z + Math.cos(ang) * 12) && api.groundY(x, z) > api.WATER + 0.25) { best = { x, z, yaw: ang }; break; } }
  }
  if (!window.GOAPlayer.onFoot()) window.GOAPlayer.exitVehicle();
  if (best) window.GOAPlayer.teleport(best.x, best.z, best.yaw);
  const inv = window.GOAPlayer.inv; inv.tools.add('rod');
  const slots = [...inv.weapons, 'rod', 'knife']; window.GOAPlayer.state.slot = slots.indexOf('rod'); window.GOAPlayer.equip();
  api.toast('Fishing · face the river and click to cast. Catch five fish to fill your creel.', 4);
}
function onCatch(f, n) {
  if (mode === 'fishing' && n === 5) api.toast('Creel full · five fish! Cook them at a campfire, or keep fishing for a personal best', 4.5);
}
function survivalSection() {
  let best = 0; try { best = +localStorage.getItem(BEST) || 0; } catch (e) { /* no storage */ }
  if (!best) return null;
  const s = document.createElement('section'); s.className = 'journal-section'; s.innerHTML = `<h3>Survival</h3><p>Longest survival: <b>${best.toFixed(1)} days</b></p>`; return s;
}
function init(hooks) {
  api = hooks; T = window.THREE; registerInteractables(); compass(false);
  (window.GOAMapLayers = window.GOAMapLayers || []).push(mapLayer);
  (window.GOAJournalSections = window.GOAJournalSections || []).push(survivalSection);
}

/** A hatchet swing near deadfall chops it for firewood. Returns true when it hit wood. */
function chop(x, z, yaw) {
  if (!SV.on) return false;
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  const w = SV.wood.find((q) => { const dx = q.x - x, dz = q.z - z, d = Math.hypot(dx, dz); return d < 2.8 && (dx * fx + dz * fz) / Math.max(d, 0.01) > 0.2; });
  if (!w) return false; gatherWood(w); return true;
}
window.GOASurvival = { init, frame, chop, active: () => SV.on && !SV.dead && !SV.won, isNight, onDeath, eat(n) { SV.hunger = Math.min(100, SV.hunger + n); }, warm() { SV.warmth = Math.min(100, SV.warmth + 25); api.toast('You warm your hands by the fire'); },
  sleep, speedFactor, noVehicle: () => SV.on, onHarvest() {}, state: SV };
window.GOAModes = { start, current: () => mode, onCatch };
})();

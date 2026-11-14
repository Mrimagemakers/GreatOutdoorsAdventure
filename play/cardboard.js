/* Great Outdoors Adventure: phone VR viewers (Google Cardboard and the plastic "360 video" headsets).
   No WebXR needed, so it also works on iPhone. The phone's motion sensors steer the view, the screen is drawn as two
   side-by-side eyes, and the only button is a tap on the screen (the viewer's lever or a finger through the side).
   Driving: hold to accelerate, tilt your head like a steering wheel. On foot: look to aim, tap to fire or use,
   hold to walk where you look. Look down at your feet for the menu: pick an item by looking at it and tapping, or
   just keep looking at it for a moment. "Watch" drives the valley on its own so you only look around.
   A Bluetooth Xbox or PlayStation controller keeps working on top of all this. */
(() => {
'use strict';
const T = window.THREE;
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const wrap = (a) => { while (a > Math.PI) a -= Math.PI * 2; while (a < -Math.PI) a += Math.PI * 2; return a; };
const deg = Math.PI / 180;
let G = null; // game hooks
let on = false, stereo = true, autopilot = false;
const ui = { root: null, rotate: null };

// ------------------------------------------------------------------ device detection
const isPhone = () => matchMedia('(pointer:coarse)').matches && Math.min(screen.width, screen.height) < 900;
const hasMotion = () => typeof DeviceOrientationEvent !== 'undefined';
let sensorSeen = false;

// ------------------------------------------------------------------ head tracking
const ori = { alpha: 0, beta: 90, gamma: 0 };
const raw = new T.Quaternion(), rel = new T.Quaternion(), zeroQ = new T.Quaternion();
const q1 = new T.Quaternion(-Math.sqrt(0.5), 0, 0, Math.sqrt(0.5)), q0 = new T.Quaternion(), zee = new T.Vector3(0, 0, 1), eul = new T.Euler();
const head = { yaw: 0, pitch: 0, roll: 0 };
let needZero = true, manual = null; // manual: desktop fallback / tests drive the head with the mouse
function onOrient(e) { if (e.alpha === null && e.beta === null) return; sensorSeen = true; ori.alpha = e.alpha || 0; ori.beta = e.beta || 0; ori.gamma = e.gamma || 0; }
function screenAngle() { return (screen.orientation?.angle ?? window.orientation ?? 0) * deg; }
function readHead() {
  if (manual) { eul.set(manual.pitch, manual.yaw, manual.roll, 'YXZ'); rel.setFromEuler(eul); }
  else {
    eul.set(ori.beta * deg, ori.alpha * deg, -ori.gamma * deg, 'YXZ');
    raw.setFromEuler(eul).multiply(q1).multiply(q0.setFromAxisAngle(zee, -screenAngle()));
    if (needZero && sensorSeen) { eul.setFromQuaternion(raw, 'YXZ'); zeroQ.setFromAxisAngle(new T.Vector3(0, 1, 0), -eul.y); needZero = false; }
    rel.copy(zeroQ).multiply(raw);
  }
  eul.setFromQuaternion(rel, 'YXZ'); head.yaw = eul.y; head.pitch = eul.x; head.roll = eul.z;
}
async function askMotion() {
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') return false;
    }
  } catch (err) { return false; }
  addEventListener('deviceorientation', onOrient); return true;
}

// ------------------------------------------------------------------ the 3D overlay: reticle, menu, messages
const overlay = new T.Group(); overlay.name = 'cardboard-overlay'; overlay.visible = false;
const flat = (m) => { m.depthTest = false; m.depthWrite = false; m.transparent = true; m.fog = false; m.toneMapped = false; return m; };
const reticle = new T.Mesh(new T.RingGeometry(0.011, 0.019, 32), flat(new T.MeshBasicMaterial({ color: 0xffffff, opacity: 0.9 })));
const fuse = new T.Mesh(new T.RingGeometry(0.022, 0.03, 32, 1, 0, 0.001), flat(new T.MeshBasicMaterial({ color: 0xefc565, opacity: 0.95 })));
reticle.renderOrder = fuse.renderOrder = 1000; overlay.add(reticle, fuse);
function labelTex(text, w = 512, h = 160, hot = false, sub = '') {
  const c = document.createElement('canvas'); c.width = w; c.height = h; const x = c.getContext('2d');
  x.fillStyle = hot ? 'rgba(239,197,101,.95)' : 'rgba(20,26,30,.82)'; x.beginPath(); x.roundRect(4, 4, w - 8, h - 8, 36); x.fill();
  x.strokeStyle = 'rgba(242,238,230,.75)'; x.lineWidth = 5; x.stroke();
  x.fillStyle = hot ? '#1e2226' : '#f2eee6'; x.textAlign = 'center'; x.textBaseline = 'middle';
  x.font = `700 ${sub ? 54 : 62}px Barlow, system-ui, sans-serif`; x.fillText(text, w / 2, sub ? h * 0.4 : h / 2);
  if (sub) { x.font = '500 34px Barlow, system-ui, sans-serif'; x.globalAlpha = 0.8; x.fillText(sub, w / 2, h * 0.74); }
  const t = new T.CanvasTexture(c); t.colorSpace = T.SRGBColorSpace; return t;
}
const menu = new T.Group(); overlay.add(menu); let items = [], menuOpen = 0;
function makeItem(id, label, sub, act) {
  const m = new T.Mesh(new T.PlaneGeometry(0.7, 0.22), flat(new T.MeshBasicMaterial({ map: labelTex(label, 512, 160, false, sub) })));
  m.renderOrder = 999; m.userData = { id, label, sub, act, hot: false }; return m;
}
function setHot(m, hot) { if (m.userData.hot === hot) return; m.userData.hot = hot; m.material.map.dispose(); m.material.map = labelTex(m.userData.label, 512, 160, hot, m.userData.sub); }
function buildMenu() {
  for (const m of items) { m.material.map.dispose(); m.geometry.dispose(); menu.remove(m); }
  const foot = !!window.GOAPlayer?.onFoot?.();
  const list = foot
    ? [['drive', 'Drive', 'back to the car', () => { window.GOAPlayer?.enterVehicle?.(); }],
       ['watch', 'Watch', 'sit back, look around', () => { window.GOAPlayer?.enterVehicle?.(); setAutopilot(true); }],
       ['switch', 'Switch', 'next item', () => window.GOAPlayer?.touch?.cycle(1)],
       ['reload', 'Reload', '', () => window.GOAPlayer?.touch?.reload()]]
    : [[autopilot ? 'take' : 'watch', autopilot ? 'Take the wheel' : 'Watch', autopilot ? 'you drive' : 'auto drive, look around', () => setAutopilot(!autopilot)],
       ['walk', 'Walk & hunt', 'step out', () => { setAutopilot(false); stopCar(() => window.GOAPlayer?.exitVehicle?.()); }],
       ['view', 'View', G?.P?.camMode === 2 ? 'driver seat' : 'chase', () => { G.P.camMode = G.P.camMode === 2 ? 0 : 2; }],
       ['reset', 'Back on road', '', () => G.resetCar?.(false)]];
  list.push(['centre', 'Recentre', 'face ahead', () => recentre()], ['exit', 'Exit', stereo ? 'leave the viewer' : 'leave look-around', () => exit()]);
  items = list.map(([id, l, s, a], i) => { const m = makeItem(id, l, s, a); const n = list.length, cols = 3, r = Math.floor(i / cols), c = i % cols;
    m.position.set((c - (Math.min(cols, n - r * cols) - 1) / 2) * 0.76, -r * 0.26, 0); menu.add(m); return m; });
}
let msgMesh = null, msgT = 0, msgLast = '';
function message(text, secs = 2.4) {
  if (!text) return; msgLast = text;
  if (!msgMesh) { msgMesh = new T.Mesh(new T.PlaneGeometry(1.1, 0.16), flat(new T.MeshBasicMaterial({ opacity: 1 }))); msgMesh.renderOrder = 998; overlay.add(msgMesh); }
  msgMesh.material.map?.dispose(); msgMesh.material.map = labelTex(text.length > 44 ? text.slice(0, 43) + '…' : text, 1024, 150); msgMesh.material.needsUpdate = true; msgT = secs;
}

// ------------------------------------------------------------------ input: one button (the screen)
let down = false, downT = 0, held = false, tapQueued = false;
function pointerDown(e) { if (!on) return; e.preventDefault(); if (e.target.closest?.('#cb-ui button')) return; down = true; downT = performance.now(); held = false; }
function pointerUp(e) { if (!on || !down) return; e.preventDefault(); down = false; if (!held) tapQueued = true; held = false; window.GOAPlayer?.touch?.move(0, 0, false); }
let stopWait = null;
function stopCar(then) { stopWait = then; }

// ------------------------------------------------------------------ autopilot for Watch
const road = {};
function setAutopilot(v) { autopilot = !!v; message(autopilot ? 'Watch mode · just look around' : 'You have the wheel · hold to go, tilt to steer', 2.6); if (menuOpen) buildMenu(); }
function autoInput() {
  const S = G.S; G.nearestRoad(S.x, S.z, road); if (road.road < 0) return { throttle: 0.4, steer: 0 };
  let tx = road.tx, tz = road.tz; const fx = Math.sin(S.yaw), fz = Math.cos(S.yaw); if (tx * fx + tz * fz < 0) { tx = -tx; tz = -tz; }
  const nx = -road.tz, nz = road.tx; // the side the lateral offset is measured along
  const keep = (road.hw || 4) * 0.35; // drive on the right half of the road
  const side = (tx === road.tx ? 1 : -1);
  const px = S.x - nx * (road.lat - side * keep), pz = S.z - nz * (road.lat - side * keep);
  const ax = px + tx * 14, az = pz + tz * 14;
  const want = Math.atan2(ax - S.x, az - S.z), err = wrap(want - S.yaw);
  const sp = Math.hypot(S.vx, S.vz), target = 13 - Math.min(7, Math.abs(err) * 14);
  return { throttle: sp < target ? clamp((target - sp) * 0.25, 0.15, 0.7) : 0, brake: sp > target + 3 ? 0.4 : 0, steer: clamp(-err * 2.2, -1, 1) };
}

// ------------------------------------------------------------------ per frame, before the game updates
let footBase = 0, lastSet = 0, drive = { throttle: 0, brake: 0, steer: 0 };
function pre(dt) {
  if (!on) return;
  readHead();
  const Pl = window.GOAPlayer, foot = !!Pl?.onFoot?.(), S = G.S;
  if (down && !held && performance.now() - downT > 260) held = true;
  // look at your feet for the menu
  const wantMenu = head.pitch < -0.62 || (menuOpen && head.pitch < -0.38);
  if (wantMenu && !menuOpen) { buildMenu(); menuOpen = 1; }
  else if (!wantMenu && menuOpen) { menuOpen = 0; }
  if (foot) {
    const st = Pl.state;
    footBase += wrap(st.camYaw - lastSet); // keep turns made with a controller stick or keys
    st.camYaw = lastSet = footBase + head.yaw; st.camPitch = clamp(head.pitch, -1.2, 0.9);
    Pl.touch.move(0, held && !menuOpen ? 1 : 0, false);
    if (tapQueued && !menuOpen) { tapQueued = false; if (Pl.focusLabel?.()) Pl.touch.interact(); else { Pl.touch.fire(true); Pl.touch.fire(false); } }
    drive = { throttle: 0, brake: 0, steer: 0 };
  } else {
    if (tapQueued && !menuOpen) tapQueued = false;
    if (stopWait) { const sp = Math.hypot(S.vx, S.vz); drive = { throttle: 0, brake: 1, steer: 0 }; if (sp < 1.2) { const f = stopWait; stopWait = null; f(); footBase = lastSet = Pl?.state?.camYaw ?? S.yaw; } return; }
    if (autopilot) drive = autoInput();
    else {
      const tilt = Math.abs(head.roll) < 0.05 ? 0 : -(head.roll - Math.sign(head.roll) * 0.05) / 0.32;
      drive = { throttle: held && !menuOpen ? 1 : 0, brake: !held && Math.hypot(S.vx, S.vz) > 2 && !menuOpen ? 0.12 : 0, steer: clamp(tilt, -1, 1) };
    }
  }
  if (foot && !wasFoot) { footBase = Pl.state.camYaw - head.yaw; lastSet = Pl.state.camYaw; autopilot = false; }
  if (foot !== wasFoot && menuOpen) buildMenu();
  wasFoot = foot;
}
let wasFoot = false;

// ------------------------------------------------------------------ render: two eyes
const stereoCam = new T.StereoCamera(); stereoCam.eyeSep = 0.064;
const ray = new T.Raycaster(), v1 = new T.Vector3(), v2 = new T.Vector3(), qY = new T.Quaternion(), yAxis = new T.Vector3(0, 1, 0), size = new T.Vector2();
let hover = null, dwell = 0;
function render(renderer, scene, camera, dt) {
  if (!on) return false;
  const foot = !!window.GOAPlayer?.onFoot?.(), S = G.S;
  let baseYaw;
  if (foot) {
    const st = window.GOAPlayer.state, p = window.GOAPlayer.position();
    baseYaw = footBase;
    const f = st.camYaw;
    camera.position.set(p.x + Math.sin(f) * 0.16, p.y + 1.58, p.z + Math.cos(f) * 0.16);
    camera.quaternion.copy(qY.setFromAxisAngle(yAxis, footBase + Math.PI)).multiply(rel);
  } else {
    baseYaw = S.yaw;
    // keep the game's chase or seat position, but the view belongs to your head, levelled to the car's heading
    camera.quaternion.copy(qY.setFromAxisAngle(yAxis, S.yaw + Math.PI)).multiply(q0.setFromAxisAngle(new T.Vector3(1, 0, 0), G.P.camMode === 2 ? 0 : -0.16)).multiply(rel);
  }
  camera.fov = stereo ? 84 : 68; camera.near = Math.min(camera.near, 0.08); camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  // overlay follows the camera
  camera.getWorldDirection(v1); const cp = camera.position;
  reticle.position.copy(cp).addScaledVector(v1, 1.6); reticle.quaternion.copy(camera.quaternion);
  fuse.position.copy(reticle.position); fuse.quaternion.copy(camera.quaternion);
  if (msgMesh) { msgT -= dt; msgMesh.visible = msgT > 0; v2.set(0, -0.26, -2).applyQuaternion(camera.quaternion); msgMesh.position.copy(cp).add(v2); msgMesh.quaternion.copy(camera.quaternion); }
  menu.visible = !!menuOpen;
  let picked = null;
  if (menuOpen) {
    const fx = Math.sin(baseYaw), fz = Math.cos(baseYaw), a = 58 * deg, d = 2.1;
    menu.position.set(cp.x + fx * d * Math.cos(a), cp.y - d * Math.sin(a), cp.z + fz * d * Math.cos(a));
    menu.lookAt(cp); menu.updateMatrixWorld(true);
    ray.set(cp, v1); const hit = ray.intersectObjects(items, false)[0]; picked = hit?.object || null;
    for (const m of items) setHot(m, m === picked);
  }
  if (picked !== hover) { hover = picked; dwell = 0; }
  if (hover) { dwell += dt; if (tapQueued || dwell > 1.6) { tapQueued = false; const act = hover.userData.act; hover = null; dwell = 0; menuOpen = 0; menu.visible = false; try { act(); } catch (err) { console.warn(err); } } }
  else tapQueued = tapQueued && !menuOpen;
  fuse.visible = !!hover && dwell > 0.15;
  if (fuse.visible) { fuse.geometry.dispose(); fuse.geometry = new T.RingGeometry(0.022, 0.03, 32, 1, Math.PI / 2, -Math.PI * 2 * clamp(dwell / 1.6, 0.001, 1)); }
  reticle.scale.setScalar(hover ? 1.4 : 1);
  if (overlay.parent !== scene) scene.add(overlay);
  overlay.visible = true;
  renderer.getSize(size);
  if (!stereo) { renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y); renderer.render(scene, camera); overlay.visible = false; return true; }
  stereoCam.aspect = 0.5; stereoCam.update(camera);
  renderer.setScissorTest(true);
  const w = Math.floor(size.x / 2);
  renderer.setScissor(0, 0, w, size.y); renderer.setViewport(0, 0, w, size.y); renderer.render(scene, stereoCam.cameraL);
  renderer.setScissor(w, 0, size.x - w, size.y); renderer.setViewport(w, 0, size.x - w, size.y); renderer.render(scene, stereoCam.cameraR);
  renderer.setScissorTest(false); renderer.setViewport(0, 0, size.x, size.y);
  overlay.visible = false;
  return true;
}

// ------------------------------------------------------------------ entering and leaving
let wake = null, toastObs = null, savedPR = 1;
async function enter(mode = 'viewer') {
  if (on || !G) return;
  stereo = mode !== 'look';
  const granted = await askMotion(); // must run inside the tap on iPhone
  if (!granted) window.GOAToast?.('Motion access was refused · drag to look instead', 3);
  window.GOAStart?.();
  try { await document.documentElement.requestFullscreen?.({ navigationUI: 'hide' }); } catch (err) { /* iPhone: no fullscreen for pages */ }
  try { await screen.orientation?.lock?.('landscape'); } catch (err) { /* only works fullscreen on Android */ }
  try { wake = await navigator.wakeLock?.request('screen'); } catch (err) { wake = null; }
  on = true; needZero = true; autopilot = false; menuOpen = 0; hover = null;
  document.body.classList.add('cardboard'); document.body.classList.toggle('cardboard-mono', !stereo);
  ui.root.hidden = false;
  savedPR = G.renderer.getPixelRatio(); G.renderer.setPixelRatio(Math.min(savedPR, stereo ? 1.35 : 1.6)); G.renderer.setSize(innerWidth, innerHeight, false);
  const Pl = window.GOAPlayer; if (Pl?.onFoot?.()) { footBase = Pl.state.camYaw; lastSet = footBase; } wasFoot = !!Pl?.onFoot?.();
  // copy the game's messages into the headset
  const t = document.getElementById('toast');
  if (t && !toastObs) { toastObs = new MutationObserver(() => { if (on && t.textContent && t.textContent !== msgLast) message(t.textContent); }); toastObs.observe(t, { childList: true, characterData: true, subtree: true }); }
  setTimeout(() => { if (on && !sensorSeen && !manual) { manual = { yaw: 0, pitch: 0, roll: 0 }; message('No motion sensor · drag to look', 3); } }, 1500);
  message(stereo ? 'Hold to go · tilt to steer · look down for the menu' : 'Move the phone to look · look down for the menu', 4);
  checkRotate();
}
function exit() {
  if (!on) return;
  on = false; autopilot = false; stopWait = null; menuOpen = 0;
  document.body.classList.remove('cardboard', 'cardboard-mono'); ui.root.hidden = true; ui.rotate.hidden = true;
  try { wake?.release?.(); } catch (err) { /* ignore */ } wake = null;
  try { screen.orientation?.unlock?.(); } catch (err) { /* ignore */ }
  if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {});
  window.GOAPlayer?.touch?.reset?.(); G.renderer.setScissorTest(false);
  dispatchEvent(new Event('resize')); // the game restores its own pixel ratio and size
  window.GOAToast?.('Left the phone viewer', 1.6);
}
function recentre() {
  needZero = true; if (manual) manual.yaw = manual.pitch = manual.roll = 0;
  if (window.GOAPlayer?.onFoot?.()) { footBase = window.GOAPlayer.state.camYaw - head.yaw; }
  message('Recentred', 1.2);
}
function checkRotate() { if (!on) return; ui.rotate.hidden = innerWidth > innerHeight; }

// ------------------------------------------------------------------ desktop fallback: drag to look (also handy for testing)
let drag = null;
function md(e) { if (!on || !manual) return; drag = [e.clientX, e.clientY, false]; }
function mm(e) { if (!drag) return; const dx = e.clientX - drag[0], dy = e.clientY - drag[1]; if (Math.abs(dx) + Math.abs(dy) > 3) drag[2] = true; manual.yaw -= dx * 0.005; manual.pitch = clamp(manual.pitch - dy * 0.005, -1.4, 1.4); drag[0] = e.clientX; drag[1] = e.clientY; if (drag[2]) held = false, down = false; }
function mu() { drag = null; }

// ------------------------------------------------------------------ markup
function build() {
  const css = document.createElement('style');
  css.textContent = `
  body.cardboard>*:not(#c):not(#cb-ui):not(#cb-rotate):not(script):not(style){visibility:hidden!important;pointer-events:none!important}
  body.cardboard #c{position:fixed;inset:0;width:100vw!important;height:100vh!important;z-index:1}
  #cb-ui{position:fixed;inset:0;z-index:90;touch-action:none;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none}
  #cb-ui[hidden],#cb-rotate[hidden]{display:none}
  #cb-ui i{position:absolute;left:50%;top:0;bottom:0;width:2px;margin-left:-1px;background:#000}
  body.cardboard-mono #cb-ui i{display:none}
  #cb-ui button{position:absolute;top:max(8px,env(safe-area-inset-top));right:max(8px,env(safe-area-inset-right));opacity:.35;font:600 11px/1 Barlow,system-ui,sans-serif;letter-spacing:.1em;padding:8px 10px;border-radius:14px;border:1px solid #fff8;background:#0008;color:#fff}
  body.cardboard-mono #cb-ui button{opacity:.75}
  #cb-rotate{position:fixed;inset:0;z-index:95;background:#14191ce6;color:#f2eee6;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:14px;text-align:center;font:600 16px/1.4 Barlow,system-ui,sans-serif;padding:24px}
  #cb-rotate b{font-size:44px}
  .cb-entry{display:flex;gap:8px;flex-wrap:wrap;justify-content:center;margin-top:10px}
  .cb-entry button{font:600 13px/1 Barlow,system-ui,sans-serif;padding:10px 14px;border-radius:20px;border:1px solid #f2eee6aa;background:#1e2226cc;color:#f2eee6}
  .cb-entry button.hint{background:#efc565;color:#1e2226;border-color:#fff}`;
  document.head.append(css);
  ui.root = document.createElement('div'); ui.root.id = 'cb-ui'; ui.root.hidden = true;
  ui.root.innerHTML = '<i></i><button type="button" aria-label="Leave the phone viewer">EXIT</button>';
  ui.root.querySelector('button').addEventListener('click', (e) => { e.stopPropagation(); exit(); });
  ui.root.addEventListener('pointerdown', pointerDown); ui.root.addEventListener('pointerup', pointerUp); ui.root.addEventListener('pointercancel', pointerUp);
  ui.root.addEventListener('contextmenu', (e) => e.preventDefault());
  ui.root.addEventListener('pointerdown', md); addEventListener('pointermove', mm); addEventListener('pointerup', mu);
  ui.rotate = document.createElement('div'); ui.rotate.id = 'cb-rotate'; ui.rotate.hidden = true;
  ui.rotate.innerHTML = '<b>⟲</b><div>Turn your phone sideways and slide it into the viewer.</div><div class="cb-entry"><button type="button">Leave viewer mode</button></div>';
  ui.rotate.querySelector('button').onclick = exit;
  document.body.append(ui.root, ui.rotate);
  addEventListener('resize', checkRotate); screen.orientation?.addEventListener?.('change', checkRotate);
  addEventListener('keydown', (e) => { if (on && (e.code === 'Escape' || e.code === 'Backspace')) { e.preventDefault(); e.stopPropagation(); exit(); } }, true);
  document.addEventListener('visibilitychange', async () => { if (on && document.visibilityState === 'visible' && !wake) { try { wake = await navigator.wakeLock?.request('screen'); } catch (err) { /* ignore */ } } });

  // entry points: the VR / AR panel, and the title screen on phones
  const panel = document.querySelector('#xr-panel .xr-content');
  if (panel) {
    const sec = document.createElement('div');
    sec.innerHTML = '<h3>Phone VR viewer (Google Cardboard and 360° video headsets)</h3><p>Slide your phone into any basic viewer. Move your head to look around. Driving: hold the screen (or the viewer button) to go and tilt your head to steer. On foot: look to aim, tap to fire or use, hold to walk. Look down at your feet for the menu, including <b>Watch</b>, which drives the valley for you so you can simply sit back and look around. A Bluetooth controller also works.</p><div class="cb-entry"><button type="button" class="hint" data-cb="viewer">Play in a phone viewer</button><button type="button" data-cb="look">Look around (no viewer)</button></div>';
    panel.insertBefore(sec, panel.querySelector('h3:nth-of-type(2)'));
    sec.querySelectorAll('[data-cb]').forEach((b) => b.addEventListener('click', () => { document.getElementById('xr-close')?.click(); enter(b.dataset.cb); }));
  }
  const title = document.querySelector('#title .t');
  if (title && isPhone() && hasMotion()) {
    const row = document.createElement('div'); row.className = 'cb-entry'; row.id = 'cb-title';
    row.innerHTML = '<button type="button" data-cb="viewer">🥽 Phone VR viewer</button><button type="button" data-cb="look">Look around</button>';
    title.insertBefore(row, document.getElementById('loading'));
    row.querySelectorAll('[data-cb]').forEach((b) => b.addEventListener('click', (e) => { e.stopPropagation(); enter(b.dataset.cb); }));
  }
  // recognise a phone that's already sitting in a viewer: landscape, held upright, and no proper WebXR headset
  if (isPhone() && hasMotion()) {
    let upright = 0;
    const probe = (e) => { if (on || !e.beta) return; const side = innerWidth > innerHeight && Math.abs(Math.abs(e.gamma || 0) - 90) < 30; upright = side ? upright + 1 : 0;
      if (upright > 90) { removeEventListener('deviceorientation', probe); document.querySelectorAll('[data-cb="viewer"]').forEach((b) => b.classList.add('hint')); window.GOAToast?.('In a VR viewer? Tap “Phone VR viewer” to switch to two-eye view', 4); } };
    addEventListener('deviceorientation', probe);
  }
  if (/[?&]cardboard(=|&|$)/.test(location.search)) document.getElementById('go')?.addEventListener('click', () => enter(/cardboard=look/.test(location.search) ? 'look' : 'viewer'), { once: true });
}

function init(hooks) { G = hooks; build(); }

window.GOACardboard = {
  init, pre, render, enter, exit, recentre,
  active: () => on, stereo: () => stereo, autopilot: () => autopilot,
  /** Driving input while in the viewer, merged with keys, touch and controller by the game. */
  driveInput: () => on && !window.GOAPlayer?.onFoot?.() ? drive : null,
  /** For tests and desktop: set the head pose in radians. */
  _head(yaw, pitch, roll = 0) { manual = { yaw, pitch, roll }; },
  _tap() { tapQueued = true; }, _hold(v) { down = !!v; held = !!v; if (!v) window.GOAPlayer?.touch?.move(0, 0, false); },
};
})();

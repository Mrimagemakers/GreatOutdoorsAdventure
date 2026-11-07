/* Great Outdoors Adventure: phone and tablet controls.
   Driving: a slide pad for steering (or arrow buttons, or tilt the phone), tall GAS and BRAKE pedals, and an OUT button.
   On foot: a floating thumbstick on the left (push to the edge to sprint), drag anywhere on the right to look, and
   FIRE, AIM, USE, reload, switch and CAR buttons. Everything here feeds the same inputs as the keyboard and controller. */
(() => {
'use strict';
const $ = (id) => document.getElementById(id);
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
let steerMode = 'wheel', wheel = 0, tilt = 0, tiltZero = null, tiltOn = false, tiltAsked = false;

// ------------------------------------------------------------------ markup
const drive = $('touch');
drive.insertAdjacentHTML('beforeend', `
  <div class="tb tpad" id="tSteer" role="slider" aria-label="Steering: slide left or right" aria-valuemin="-1" aria-valuemax="1" aria-valuenow="0"><i></i><b></b><span>◀ STEER ▶</span></div>
  <div class="tb" id="tTilt" role="button" aria-label="Tilt steering: tap to recentre">TILT<small>tap to centre</small></div>
  <div class="tb" id="tOut" role="button" aria-label="Step out of the vehicle">OUT</div>`);
const foot = document.createElement('div'); foot.id = 'foot-touch';
foot.innerHTML = `
  <div id="ft-look" aria-hidden="true"></div>
  <div id="ft-move" aria-label="Move: drag to walk, push to the edge to sprint"><div id="ft-base"><div id="ft-knob"></div></div><span>MOVE</span></div>
  <button class="ftb" id="ft-fire" aria-label="Fire or use item">FIRE</button>
  <button class="ftb" id="ft-aim" aria-label="Aim (toggle)">AIM</button>
  <button class="ftb" id="ft-use" aria-label="Interact">USE</button>
  <button class="ftb sm" id="ft-reload" aria-label="Reload">⟳</button>
  <button class="ftb sm" id="ft-swap" aria-label="Switch item">⇄</button>
  <button class="ftb sm" id="ft-car" aria-label="Get in the vehicle">CAR</button>`;
document.body.append(foot);

// ------------------------------------------------------------------ helpers
function hold(el, down, up) {
  const on = (e) => { e.preventDefault(); e.stopPropagation(); try { el.setPointerCapture(e.pointerId); } catch (_) { /* old browsers */ } el.classList.add('on'); down(e); };
  const off = (e) => { e.preventDefault(); el.classList.remove('on'); up?.(e); };
  el.addEventListener('pointerdown', on); el.addEventListener('pointerup', off); el.addEventListener('pointercancel', off); el.addEventListener('lostpointercapture', off);
  el.addEventListener('contextmenu', (e) => e.preventDefault());
}
const P = () => window.GOAPlayer;
const buzz = (ms = 12) => { try { navigator.vibrate?.(ms); } catch (_) { /* no vibration */ } };

// ------------------------------------------------------------------ driving: slide pad, tilt, step out
const pad = $('tSteer'), knobBar = pad.querySelector('b');
let padId = null, padX0 = 0;
function setWheel(v) { wheel = clamp(v, -1, 1); knobBar.style.transform = `translateX(${wheel * pad.clientWidth * 0.36}px)`; pad.setAttribute('aria-valuenow', wheel.toFixed(2)); }
pad.addEventListener('pointerdown', (e) => {
  e.preventDefault(); padId = e.pointerId; try { pad.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  const r = pad.getBoundingClientRect(); padX0 = r.left + r.width / 2; pad.classList.add('on');
  setWheel((e.clientX - padX0) / (r.width * 0.36));
  window.GOAStart?.();
});
pad.addEventListener('pointermove', (e) => { if (e.pointerId !== padId) return; const r = pad.getBoundingClientRect(); setWheel((e.clientX - padX0) / (r.width * 0.36)); });
const padOff = (e) => { if (e.pointerId !== padId) return; padId = null; pad.classList.remove('on'); setWheel(0); };
pad.addEventListener('pointerup', padOff); pad.addEventListener('pointercancel', padOff); pad.addEventListener('lostpointercapture', padOff);

// tilt: in landscape the "wheel" angle shows up in beta, in portrait in gamma
let lastOri = null, listening = false;
function angleOf(e) { const ang = screen.orientation?.angle ?? window.orientation ?? 0; return ang === 90 ? e.beta : ang === -90 || ang === 270 ? -e.beta : e.gamma; }
function onOrient(e) {
  if (e.beta === null || e.gamma === null) return;
  lastOri = e; if (tiltZero === null) tiltZero = angleOf(e);
  tilt = clamp((angleOf(e) - tiltZero) / 24, -1, 1); tiltOn = true;
}
async function enableTilt() {
  if (listening) return true;
  try {
    if (typeof DeviceOrientationEvent !== 'undefined' && typeof DeviceOrientationEvent.requestPermission === 'function') {
      const r = await DeviceOrientationEvent.requestPermission(); if (r !== 'granted') { window.GOAToast?.('Tilt steering needs motion access · using the slide pad', 2.5); return false; }
    }
    addEventListener('deviceorientation', onOrient); listening = true; return true;
  } catch (err) { return false; } // iOS refuses unless asked from a tap: the TILT button asks again
}
$('tTilt').addEventListener('pointerdown', async (e) => {
  e.preventDefault(); buzz();
  const ok = await enableTilt();
  tiltZero = lastOri ? angleOf(lastOri) : null; tilt = 0; // hold the phone the way you want to drive, then tap to centre
  if (ok) window.GOAToast?.('Tilt steering centred', 1.2);
});
function setSteer(mode) { steerMode = mode || 'wheel'; if (steerMode === 'tilt') enableTilt(); }
hold($('tOut'), () => { buzz(20); P()?.exitVehicle?.(); });

// ------------------------------------------------------------------ on foot: floating stick, look drag, buttons
const move = $('ft-move'), base = $('ft-base'), knob = $('ft-knob');
let mvId = null, mx0 = 0, my0 = 0;
const R = () => Math.min(64, Math.max(46, innerWidth * 0.07));
function stickTo(x, y) {
  const r = R(); let dx = x - mx0, dy = y - my0; const d = Math.hypot(dx, dy);
  const run = d > r * 1.05; if (d > r) { dx = dx / d * r; dy = dy / d * r; }
  knob.style.transform = `translate(${dx}px,${dy}px)`;
  P()?.touch?.move(dx / r, -dy / r, run); move.classList.toggle('run', run);
}
move.addEventListener('pointerdown', (e) => {
  e.preventDefault(); if (mvId !== null) return; mvId = e.pointerId; try { move.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
  const r = move.getBoundingClientRect(); mx0 = e.clientX; my0 = e.clientY;
  base.style.left = (mx0 - r.left) + 'px'; base.style.top = (my0 - r.top) + 'px'; move.classList.add('on'); stickTo(e.clientX, e.clientY);
});
move.addEventListener('pointermove', (e) => { if (e.pointerId === mvId) stickTo(e.clientX, e.clientY); });
const mvOff = (e) => { if (e.pointerId !== mvId) return; mvId = null; move.classList.remove('on', 'run'); knob.style.transform = ''; P()?.touch?.move(0, 0, false); base.style.left = base.style.top = ''; };
move.addEventListener('pointerup', mvOff); move.addEventListener('pointercancel', mvOff); move.addEventListener('lostpointercapture', mvOff);

const look = $('ft-look'); const lookers = new Map();
look.addEventListener('pointerdown', (e) => { e.preventDefault(); lookers.set(e.pointerId, [e.clientX, e.clientY]); try { look.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ } });
look.addEventListener('pointermove', (e) => { const p = lookers.get(e.pointerId); if (!p) return; P()?.touch?.look(e.clientX - p[0], e.clientY - p[1]); p[0] = e.clientX; p[1] = e.clientY; });
const lookOff = (e) => lookers.delete(e.pointerId);
look.addEventListener('pointerup', lookOff); look.addEventListener('pointercancel', lookOff); look.addEventListener('lostpointercapture', lookOff);

// FIRE also looks: slide your thumb while holding it to track a moving animal
const fireBtn = $('ft-fire'); let fireLook = null;
hold(fireBtn, (e) => { fireLook = [e.clientX, e.clientY]; P()?.touch?.fire(true); buzz(); }, () => { fireLook = null; P()?.touch?.fire(false); });
fireBtn.addEventListener('pointermove', (e) => { if (!fireLook) return; P()?.touch?.look((e.clientX - fireLook[0]) * 0.8, (e.clientY - fireLook[1]) * 0.8); fireLook = [e.clientX, e.clientY]; });
hold($('ft-aim'), () => { const on = P()?.touch?.aim(); $('ft-aim').classList.toggle('lock', !!on); buzz(); });
hold($('ft-use'), () => { P()?.touch?.interact(); buzz(); });
hold($('ft-reload'), () => { P()?.touch?.reload(); buzz(); });
hold($('ft-swap'), () => { P()?.touch?.cycle(1); buzz(); });
hold($('ft-car'), () => { P()?.enterVehicle?.(); buzz(20); });

// ------------------------------------------------------------------ per-frame: labels and visibility
let wasFoot = false;
function frame() {
  const onFoot = !!P()?.onFoot?.();
  if (onFoot !== wasFoot) { wasFoot = onFoot; P()?.touch?.reset(); $('ft-aim').classList.remove('lock'); if (onFoot) P()?.touch?.aim(false); setWheel(0); }
  if (onFoot && document.body.classList.contains('touch')) {
    const label = P().focusLabel?.() || '', use = $('ft-use');
    use.hidden = !label; if (label && use.dataset.l !== label) { use.dataset.l = label; use.textContent = label.length > 18 ? 'USE' : label.split(' ·')[0].toUpperCase(); }
    const id = P().current?.(), st = window.GOAWeapons?.STATS?.[id];
    fireBtn.textContent = st ? 'FIRE' : id === 'rod' ? 'CAST' : id === 'hatchet' ? 'CHOP' : 'SWING';
    $('ft-aim').hidden = !st; $('ft-reload').hidden = !st;
  }
  const S = window.GOAGame?.S;
  $('tOut').classList.toggle('dim', !!S && Math.hypot(S.vx || 0, S.vz || 0) > 1.5);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

window.GOATouch = {
  /** Analog steering from the slide pad or tilt, added to the other inputs while driving. */
  steer() { if (!document.body.classList.contains('touch') || P()?.onFoot?.()) return 0; return steerMode === 'tilt' ? (tiltOn ? tilt : wheel) : steerMode === 'wheel' ? wheel : 0; },
  setSteer, mode: () => steerMode,
};
})();

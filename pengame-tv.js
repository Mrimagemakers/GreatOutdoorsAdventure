/*
 * PenGame Smart TV support. One line near the top of a game's or book's <head>, before the game's own scripts:
 *   <script src="pengame-tv.js"></script>
 *
 * On a smart TV or TV stick (Samsung, LG, Sony, Fire TV, Android/Google TV, Roku, Hisense…), or with ?tv=1
 * in the address (?tv=0 turns it off; the choice is remembered on that device):
 *   - The remote works the menus: arrows move a gold highlight between buttons, OK presses, the page scrolls
 *     to whatever is highlighted.
 *   - Back gives the arrows back to the game (closing any open window first). In the game, Back opens the
 *     game's pause menu (it sends Escape) and puts the highlight on its buttons.
 *   - After OK starts something that hides the menu, the arrows go straight to the game.
 *   - Lighter graphics: the screen resolution games draw at is capped (TV browsers report a high pixel ratio
 *     on a small page, which makes 3D games stutter).
 *   - Everything fits: pages scroll when they're taller than the screen, windows are capped to the screen
 *     height and scroll, and content keeps clear of the TV's edges.
 * Games can check window.PENGAME_TV (true on TVs) or the "tv" class on <html> to make their own changes.
 * Off a TV, nothing changes.
 */
(function () {
  var UA = navigator.userAgent || '';
  var KEY = 'pg:tvMode';
  var tv = (function () {
    try {
      var q = new URLSearchParams(location.search).get('tv');
      if (q === '1' || q === '0') localStorage.setItem(KEY, q === '1' ? 'true' : 'false');
      var p = localStorage.getItem(KEY); if (p === 'true') return true; if (p === 'false') return false;
    } catch (e) {}
    return /SMART-?TV|SmartTV|Tizen|Web0S|webOS|NetCast|BRAVIA|\bAFT[A-Z]|Android ?TV|Google ?TV|CrKey|HbbTV|Roku|VIDAA|Hisense|Viera|Opera TV|AppleTV|\bDTV\b|LargeScreen/i.test(UA) ||
      (/Android/.test(UA) && !/Mobile/.test(UA) && /\bTV\b/.test(UA));
  })();
  window.PENGAME_TV = tv;
  if (!tv) return;
  var root = document.documentElement;
  root.classList.add('tv');

  // Lighter graphics: games size their canvases from devicePixelRatio, so keep it modest on TVs.
  try {
    var real = window.devicePixelRatio || 1;
    if (real > 1.25) Object.defineProperty(window, 'devicePixelRatio', { configurable: true, get: function () { return 1.25; } });
  } catch (e) {}

  var css = document.createElement('style');
  css.textContent =
    'html.tv{--tvx:max(3vw,16px);--tvy:max(3vh,10px)}' +
    'html.tv :focus,html.tv .pg-tv-on{outline:3px solid #ffc21a!important;outline-offset:3px;box-shadow:0 0 0 7px rgba(255,194,26,.35)!important}' +
    'html.tv *{scroll-margin:24px}' +
    'html.tv.pg-tv-scroll,html.tv.pg-tv-scroll body{overflow-y:auto!important;height:auto!important;min-height:100%}' +
    'html.tv dialog,html.tv [role=dialog]:not(body),html.tv [aria-modal=true]{max-height:calc(100vh - 2*var(--tvy))!important;overflow-y:auto!important;overscroll-behavior:contain}' +
    '#pg-tv-toast{position:fixed;left:50%;top:var(--tvy);transform:translateX(-50%);z-index:2147483646;max-width:min(680px,calc(100vw - 2*var(--tvx)));' +
    'padding:12px 18px;border-radius:14px;background:rgba(10,23,48,.94);border:1px solid #d9a53a;color:#f4f5ff;font:600 15px/1.4 system-ui,-apple-system,Segoe UI,Roboto,sans-serif;' +
    'text-align:center;box-shadow:0 10px 30px rgba(0,0,0,.5);transition:opacity .4s;pointer-events:none}';
  (document.head || root).appendChild(css);

  var SEL = 'button,a[href],input,select,textarea,summary,[role=button],[role=link],[role=menuitem],[role=tab],[onclick],[tabindex]:not([tabindex="-1"])';
  var BACK_KEYS = ['Escape', 'GoBack', 'BrowserBack', 'XF86Back'];

  function shown(el) {
    if (!el || el.disabled || !el.getBoundingClientRect) return false;
    if (el.closest && el.closest('[hidden],[inert],[aria-hidden=true]')) return false;
    var r = el.getBoundingClientRect(); if (r.width < 4 || r.height < 4) return false;
    if (r.bottom < -2000 || r.right < 0 || r.left > innerWidth) return false;
    var cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || +cs.opacity < 0.05 || cs.pointerEvents === 'none') return false;
    // something else drawn on top (a closed menu under the game) doesn't count
    var x = Math.min(Math.max(r.left + r.width / 2, 0), innerWidth - 1), y = r.top + r.height / 2;
    if (y >= 0 && y < innerHeight) { var top = document.elementFromPoint(x, y); if (top && top !== el && !el.contains(top) && !top.contains(el) && !(top.closest && top.closest('#pg-gate'))) return false; }
    return true;
  }
  function isUI(el) { return !!(el && el !== document.body && el !== root && el.matches && el.matches(SEL) && el.tagName !== 'CANVAS'); }
  function scope() {
    var gate = document.getElementById('pg-gate'); if (gate) return gate;
    var d = document.querySelectorAll('dialog[open],[aria-modal=true]');
    for (var i = d.length - 1; i >= 0; i--) if (shown(d[i]) || d[i].getBoundingClientRect().height > 4) return d[i];
    return document.body;
  }
  function list(sc) { return Array.prototype.filter.call(sc.querySelectorAll(SEL), function (e) { return e.tagName !== 'CANVAS' && shown(e); }); }
  function typing(el) { return el && /INPUT|TEXTAREA|SELECT/.test(el.tagName) && !/button|checkbox|radio|range|submit|reset|color|file/.test(el.type || ''); }
  function go(el) {
    if (!el) return;
    if (!el.matches('button,a[href],input,select,textarea,summary,[tabindex]')) el.setAttribute('tabindex', '0');
    try { el.focus({ preventScroll: true }); } catch (e) { try { el.focus(); } catch (er) {} }
    try { el.scrollIntoView({ block: 'nearest', inline: 'nearest' }); } catch (e) {}
  }
  function rest() { try { if (document.activeElement && document.activeElement.blur) document.activeElement.blur(); } catch (e) {} }
  // a big visible canvas means a game is running: arrows belong to it unless a menu button is highlighted
  function gameOn() {
    if (Math.max(document.body ? document.body.scrollHeight : 0, root.scrollHeight) > innerHeight * 1.5) return false; // a scrolling page with a decorative canvas
    var cs = document.querySelectorAll('canvas'), area = innerWidth * innerHeight;
    for (var i = 0; i < cs.length; i++) { var r = cs[i].getBoundingClientRect(); if (r.width * r.height > area * 0.4 && getComputedStyle(cs[i]).visibility !== 'hidden') return true; }
    return false;
  }
  function first() {
    var sc = scope(), all = list(sc); if (!all.length) return null;
    var af = sc.querySelector('[autofocus]'); if (af && shown(af)) return af;
    // the main "Start" / "Play" button when there is one, otherwise the first control on the screen
    for (var i = 0; i < all.length; i++) if (/^\W*(start|play|begin|continue|enter|let'?s go|new game|ride|drive|fly)\b/i.test((all[i].textContent || all[i].value || '').trim())) return all[i];
    return all[0];
  }
  function move(dir) {
    var sc = scope(), all = list(sc); if (!all.length) return false;
    var cur = document.activeElement;
    if (!isUI(cur) || !sc.contains(cur) || !shown(cur)) { go(first()); return true; }
    var a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2, best = null, bs = 1e9;
    for (var i = 0; i < all.length; i++) {
      var el = all[i]; if (el === cur || el.contains(cur) || cur.contains(el)) continue;
      var b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2, along, side;
      if (dir === 'up') { if (b.bottom > a.top + 4 && by >= ay - 4) continue; along = ay - by; side = Math.max(0, b.left - a.right, a.left - b.right); }
      else if (dir === 'down') { if (b.top < a.bottom - 4 && by <= ay + 4) continue; along = by - ay; side = Math.max(0, b.left - a.right, a.left - b.right); }
      else if (dir === 'left') { if (b.right > a.left + 4 && bx >= ax - 4) continue; along = ax - bx; side = Math.max(0, b.top - a.bottom, a.top - b.bottom); }
      else { if (b.left < a.right - 4 && bx <= ax + 4) continue; along = bx - ax; side = Math.max(0, b.top - a.bottom, a.top - b.bottom); }
      if (along <= 0) continue; var s = along + side * 3; if (s < bs) { bs = s; best = el; }
    }
    if (best) { go(best); return true; }
    // nothing further that way: scroll the page or panel a little so text below the last button can be read
    var dy = dir === 'down' ? 1 : dir === 'up' ? -1 : 0;
    if (dy) { var p = cur.parentElement; while (p && p !== document.body) { var o = getComputedStyle(p).overflowY; if ((o === 'auto' || o === 'scroll') && p.scrollHeight > p.clientHeight) { p.scrollBy(0, dy * p.clientHeight * 0.6); return true; } p = p.parentElement; } scrollBy(0, dy * innerHeight * 0.6); }
    return true;
  }

  var toastT;
  function toast(msg, ms) {
    var t = document.getElementById('pg-tv-toast');
    if (!t) { t = document.createElement('div'); t.id = 'pg-tv-toast'; t.setAttribute('role', 'status'); (document.body || root).appendChild(t); }
    t.textContent = msg; t.style.opacity = '1'; clearTimeout(toastT); toastT = setTimeout(function () { t.style.opacity = '0'; }, ms || 6000);
  }
  function hint() {
    try { if (localStorage.getItem('pg:tvHint')) return; localStorage.setItem('pg:tvHint', '1'); } catch (e) {}
    toast(gameOn() ? '📺 Remote: arrows move the highlight, OK presses it. Back hands the arrows to the game; press Back again for the menu.'
      : '📺 Remote: arrows move the highlight, OK presses it, Back goes back.', 6000);
  }

  function back(e) {
    var d = document.querySelectorAll('dialog[open]');
    if (d.length && e.key !== 'Escape') { try { d[d.length - 1].close(); } catch (er) {} setTimeout(function () { go(first()); }, 60); return true; }
    if (isUI(document.activeElement) && gameOn()) { rest(); return true; }      // arrows back to the game
    if (e.key === 'Escape') return false;                                          // a real Escape key: let the page have it
    var modal = scope() !== document.body;
    if (!modal && !gameOn()) { if (history.length > 1) { history.back(); return true; } return false; } // a web page: Back goes back
    // TV Back key: send the game an Escape (its pause menu), then highlight whatever menu that shows
    try { var t = document.activeElement && document.activeElement !== document.body ? document.activeElement : (document.querySelector('canvas') || document.body);
      ['keydown', 'keyup'].forEach(function (type) { t.dispatchEvent(new KeyboardEvent(type, { key: 'Escape', code: 'Escape', keyCode: 27, which: 27, bubbles: true })); }); } catch (er) {}
    setTimeout(function () { var f = first(); if (f) go(f); }, 180);
    return true;
  }

  var touched = false, autoPick = null;
  addEventListener('pointerdown', function () { touched = true; }, true);
  addEventListener('keydown', function (e) {
    var k = e.key, code = e.keyCode, act = document.activeElement;
    touched = true;
    if (e.__pgTV) return;
    var isBack = BACK_KEYS.indexOf(k) >= 0 || code === 10009 || code === 461 || (k === 'Backspace' && !typing(act));
    if (isBack) { if (back(e)) { e.preventDefault(); e.stopImmediatePropagation(); } return; }
    var dir = { ArrowUp: 'up', ArrowDown: 'down', ArrowLeft: 'left', ArrowRight: 'right' }[k];
    if (dir) {
      if (typing(act) && (dir === 'left' || dir === 'right')) return;
      if (act && act.type === 'range' && (dir === 'left' || dir === 'right')) return;
      if (isUI(act) && !shown(act)) rest();                                       // the highlight was on a menu that's gone
      var inUI = isUI(document.activeElement) || scope() !== document.body;
      if (!inUI && gameOn()) return;                                              // the game is playing: arrows steer it
      if (move(dir)) { e.preventDefault(); e.stopImmediatePropagation(); hint(); }
      return;
    }
    if ((k === 'Enter' || code === 13) && isUI(act)) {
      // OK on things that aren't real buttons (clickable cards, role=button) presses them too
      if (!act.matches('button,a[href],input,select,textarea,summary')) { e.preventDefault(); act.click(); }
      var pressed = act;
      setTimeout(function () { if (document.activeElement === pressed && !shown(pressed) && gameOn()) rest(); }, 400);
    }
  }, true);

  // pages taller than the screen scroll, even if the game turned scrolling off
  function fit() {
    var tall = Math.max(document.body ? document.body.scrollHeight : 0, root.scrollHeight) > innerHeight + 24;
    root.classList.toggle('pg-tv-scroll', tall && !gameOn());
    // full-screen pop-ups taller than the screen: let them scroll, and stop centering from pushing their top off screen
    var ov = document.querySelectorAll('dialog[open],[role=dialog],[aria-modal=true],.overlay,.modal,body>div');
    for (var i = 0; i < ov.length; i++) {
      var el = ov[i]; if (el.__pgFit || !el.firstElementChild) continue;
      var cs = getComputedStyle(el); if (cs.display === 'none' || (cs.position !== 'fixed' && el.tagName !== 'DIALOG')) continue;
      if (el.scrollHeight <= el.clientHeight + 4 && el.firstElementChild.getBoundingClientRect().height <= el.clientHeight + 4) continue;
      el.__pgFit = true; el.style.overflowY = 'auto';
      if (/flex|grid/.test(cs.display) && el.children.length === 1) {
        el.style.alignItems = 'normal'; el.style.justifyContent = 'normal'; el.style.alignContent = 'normal';
        el.firstElementChild.style.margin = 'auto';
      }
    }
  }
  addEventListener('resize', fit);
  function start() {
    fit(); setInterval(fit, 2000);
    // start with the highlight on the first menu (the game's Start button, or the page's first link)
    // games often build their menus a few seconds after loading, so look again until the player presses something
    [1200, 3000, 6000, 10000].forEach(function (ms) { setTimeout(function () {
      if (touched || document.getElementById('pg-gate')) return;
      var cur = document.activeElement, f = first(); if (!f || typing(f) || f === cur) return;
      if (!isUI(cur) || !shown(cur) || cur === autoPick) { autoPick = f; go(f); }
    }, ms); });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
})();

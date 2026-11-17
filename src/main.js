// Poko's Path: the screens (home with the stage list, and a stage being played), input and sound.
// Plays the same with a finger (buttons or gestures on the board), a mouse, or a keyboard.
import { W, H, waterTop, makeGame, update, move, rotate, hardDrop, setSoft, takeEvents, starsGot, crushGap, canRevive, revive } from './game.js';
import { rewardedReady, showRewarded } from './ads.js';
import { getStage, climbOf } from './stages.js';
import { weekOf, weekStart, weekEnd, weeklyStage, weeklyBlocks } from './gen/weekly.js';
import { CELL, drawBoard, drawPiecePreview, drawPoko, themeOf, scenery } from './draw.js';
import { t, detectLang, setCurrentLang, getCurrentLang, LANGS } from './i18n.js';

// ---------- Saved progress and settings ----------
const KEY = 'poko-path:v1';
const load = () => { try { return JSON.parse(localStorage.getItem(KEY)) || {}; } catch { return {}; } };
const save = (patch) => { try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch { /* ignore */ } };
const bestStars = () => load().stars || {}; // stage number → most stars on a clear
const unlocked = () => Math.max(1, ...Object.keys(bestStars()).map((n) => Number(n) + 1));
// Trial mode: every stage open (to try the tall stages straight away); clears aren't saved.
const MAX_STAGE = 999;
const trial = () => load().trial === true;
// The weekly challenge: week number -> { best: seconds, stars (on that best run), tries }.
const weeklyRecords = () => load().weekly || {};
function saveWeekly(week, rec) { save({ weekly: { ...weeklyRecords(), [week]: rec } }); }
/** Weeks in a row with a clear, up to this one (or last week, if this one isn't done yet). */
function weeklyStreak() {
  const rec = weeklyRecords();
  let w = weekOf();
  if (!rec[w]?.best) w--;
  let n = 0;
  while (rec[w]?.best) { n++; w--; }
  return n;
}
const weeklyOpen = () => trial() || unlocked() > 5; // after the five teaching stages
const secs = (s) => s.toFixed(1);
const dayLabel = (ms) => new Date(ms).toLocaleDateString(getCurrentLang(), { month: 'numeric', day: 'numeric', timeZone: 'UTC' });
const weekRange = (w) => `${dayLabel(weekStart(w))}–${dayLabel(weekEnd(w) - 1)}`;
const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
const totalStars = () => Object.values(bestStars()).reduce((a, b) => a + b, 0);

setCurrentLang(detectLang(load().lang));
document.documentElement.lang = getCurrentLang();
const app = document.getElementById('app');

// ---------- Running as the phone app (Capacitor) or in a browser ----------
const NATIVE = !!window.Capacitor?.isNativePlatform?.();
const plugin = (name) => window.Capacitor?.Plugins?.[name];
// Browsers refuse to vibrate before the player has touched the page.
let touched = false;
for (const ev of ['pointerdown', 'keydown']) window.addEventListener(ev, () => { touched = true; }, { once: true, capture: true });
/** A buzz: a number of ms, or a pattern [on, off, on, ...]. The app uses the phone's own motor. */
function buzz(pattern) {
  if (NATIVE) {
    const h = plugin('Haptics');
    if (!h) return;
    const on = Array.isArray(pattern) ? pattern.filter((_, i) => i % 2 === 0).reduce((a, b) => a + b, 0) : pattern;
    if (on <= 12) h.impact?.({ style: 'LIGHT' }).catch?.(() => {});
    else h.vibrate?.({ duration: on }).catch?.(() => {});
  } else if (touched) navigator.vibrate?.(pattern);
}
if (NATIVE) {
  // Android's back button: from a stage back to the stage list; from the list, close the app.
  plugin('App')?.addListener?.('backButton', () => {
    if (location.hash && location.hash !== '#/' && location.hash !== '#') location.hash = '#/';
    else plugin('App').exitApp?.();
  });
}

// ---------- Sound: tiny synthesized tones, no files ----------
let audio = null;
let soundOn = load().sound !== false;
function tone(freq, len = 0.1, { type = 'sine', gain = 0.1, slide = 1, delay = 0 } = {}) {
  if (!soundOn) return;
  try {
    audio ||= new (window.AudioContext || window.webkitAudioContext)();
    const now = audio.currentTime + delay;
    const o = audio.createOscillator();
    const g = audio.createGain();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    o.frequency.exponentialRampToValueAtTime(freq * slide, now + len);
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.001, now + len);
    o.connect(g).connect(audio.destination);
    o.start(now);
    o.stop(now + len + 0.05);
  } catch { /* no audio */ }
}
const SOUNDS = {
  move: () => tone(520, 0.04, { gain: 0.03, type: 'triangle' }),
  rotate: () => tone(700, 0.06, { gain: 0.05, slide: 1.3, type: 'triangle' }),
  lock: () => tone(170, 0.12, { gain: 0.12, slide: 0.6, type: 'triangle' }),
  boom: () => { tone(90, 0.4, { gain: 0.25, slide: 0.3, type: 'sawtooth' }); tone(60, 0.5, { gain: 0.2, slide: 0.5, type: 'square' }); },
  star: () => { tone(880, 0.1, { gain: 0.1 }); tone(1320, 0.18, { gain: 0.1, delay: 0.08 }); },
  won: () => [523, 659, 784, 1047].forEach((f, k) => tone(f, 0.22, { gain: 0.12, delay: k * 0.11, type: 'triangle' })),
  // "Uh-oh!": a block is about to come down on Poko.
  panic: () => { tone(660, 0.09, { gain: 0.07, type: 'square' }); tone(440, 0.14, { gain: 0.07, type: 'square', delay: 0.1 }); },
  // Knocked flat by a near miss: a thud and a little "boing".
  trip: () => { tone(140, 0.16, { gain: 0.16, slide: 0.5, type: 'triangle' }); tone(520, 0.18, { gain: 0.06, slide: 1.6, type: 'sine', delay: 0.12 }); },
  lost: () => [392, 330, 262].forEach((f, k) => tone(f, 0.28, { gain: 0.1, delay: k * 0.16, slide: 0.9 })),
};

// ---------- Colours (from the stylesheet, so dark mode follows) ----------
let colors = {};
function readColors() {
  const cs = getComputedStyle(document.documentElement);
  for (const k of ['skyTop', 'skyBottom', 'rock', 'rockDot', 'grass', 'water', 'ghost', 'text']) {
    colors[k] = cs.getPropertyValue(`--${k.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`).trim();
  }
}
readColors();
matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', readColors);

// ---------- Routing: #/ is home, #/play/7 is stage 7 ----------
let screen = null; // the running stage's teardown, if any
function route() {
  screen?.();
  screen = null;
  const m = location.hash.match(/^#\/play\/(\d+)$/);
  const wk = location.hash.match(/^#\/weekly(?:\/(\d+))?$/);
  const n = m ? Number(m[1]) : 0;
  if (n >= 1 && n <= (trial() ? MAX_STAGE : unlocked())) screen = playStage(stageSpec(n));
  else if (wk && weeklyOpen()) screen = playStage(weeklySpec(wk[1] && trial() ? Number(wk[1]) : weekOf()));
  else showHome();
}
window.addEventListener('hashchange', route);

function topTools() {
  return `<div class="tools"><button class="sound" aria-pressed="${soundOn}" aria-label="${t('sound')}">${soundOn ? '🔊' : '🔇'}</button><button class="lang" aria-label="Language">${getCurrentLang().toUpperCase()}</button></div>`;
}
function wireTools(rerender) {
  app.querySelector('.sound').onclick = () => { soundOn = !soundOn; save({ sound: soundOn }); rerender(); };
  app.querySelector('.lang').onclick = () => {
    const lang = LANGS[(LANGS.indexOf(getCurrentLang()) + 1) % LANGS.length];
    setCurrentLang(lang);
    save({ lang });
    document.documentElement.lang = lang;
    rerender();
  };
}

// ---------- Home ----------
function showHome() {
  const best = bestStars();
  const open = unlocked();
  const shown = Math.max(20, Math.ceil((open + 5) / 5) * 5);
  const tiles = [];
  for (let n = 1; n <= shown; n++) {
    const s = best[n] ?? -1;
    const climb = trial() && climbOf(getStage(n)) > 0 ? `<span class="tile-climb">${t('climb', climbOf(getStage(n)))}</span>` : '';
    tiles.push(n <= open || trial()
      ? `<a class="tile${n === open ? ' current' : ''}" href="#/play/${n}"><b>${n}</b><span class="tile-stars">${s < 0 ? '' : '★'.repeat(s) + '☆'.repeat(3 - s)}</span>${climb}</a>`
      : `<span class="tile locked" aria-label="${t('locked')}"><b>${n}</b><span class="tile-stars">🔒</span></span>`);
  }
  app.innerHTML = `
    <header class="topbar"><h1 class="title">${t('title')}</h1>${topTools()}</header>
    <section class="hero">
      <canvas class="mascot" width="160" height="120" aria-hidden="true"></canvas>
      <p class="tagline">${t('tagline')}</p>
      <a class="primary" href="#/play/${open}">${open === 1 ? t('play') : t('continueAt', open)}</a>
      <button class="ghost help-btn">${t('help')}</button>
    </section>
    ${weeklyCard()}
    ${trial() ? trialPanel() : ''}
    <h2 class="section">${t('stages')} <span class="total">${t('total', totalStars())}</span></h2>
    <nav class="tiles">${tiles.join('')}</nav>
    <button class="ghost trial-btn" aria-pressed="${trial()}">🧪 ${t(trial() ? 'trialOff' : 'trialOn')}</button>`;
  app.querySelector('.trial-btn').onclick = () => { save({ trial: !trial() }); showHome(); window.scrollTo(0, 0); };
  const jump = app.querySelector('.jump');
  if (jump) jump.onsubmit = (e) => {
    e.preventDefault();
    const v = Math.round(Number(jump.querySelector('input').value));
    if (v >= 1 && v <= MAX_STAGE) location.hash = `#/play/${v}`;
  };
  wireTools(showHome);
  app.querySelector('.help-btn').onclick = () => showHelp(app);
  const m = app.querySelector('.mascot');
  const mc = m.getContext('2d');
  let alive = true;
  const t0 = performance.now();
  const anim = (now) => {
    if (!alive || !m.isConnected) return;
    const time = (now - t0) / 1000;
    mc.clearRect(0, 0, 160, 120);
    mc.save();
    mc.translate(80 + Math.sin(time * 0.8) * 30, 104);
    drawPoko(mc, 0, 0, Math.cos(time * 0.8) >= 0 ? 1 : -1, time, 'walk', 90);
    mc.restore();
    requestAnimationFrame(anim);
  };
  requestAnimationFrame(anim);
  screen = () => { alive = false; };
}

function weeklyCard() {
  const w = weekOf();
  const left = Math.max(0, weekEnd(w) - Date.now());
  const d = Math.floor(left / 86400000), h = Math.floor((left % 86400000) / 3600000);
  const rec = weeklyRecords()[w];
  const streak = weeklyStreak();
  const status = !weeklyOpen() ? t('weeklyLocked')
    : rec?.best ? `${t('weeklyBest', secs(rec.best))} <span class="wk-stars">${starText(rec.stars)}</span>` : t('weeklyNone');
  const inner = `<span class="wk-top"><b>🗓 ${t('weekly')}</b><span class="wk-left">${t('weeklyLeft', d, h)}</span></span>
    <span class="wk-range">${weekRange(w)}</span>
    <span class="wk-best">${status}${streak > 1 ? ` · ${t('streak', streak)}` : ''}</span>`;
  return weeklyOpen() ? `<a class="weekly-card" href="#/weekly">${inner}</a>` : `<div class="weekly-card locked">${inner}</div>`;
}

// Trial mode's panel: type a stage number, or jump to the first stage of each height.
function trialPanel() {
  const picks = [];
  for (const [from, rows] of [[21, 5], [21, 7], [21, 10], [100, 15], [200, 20]]) {
    for (let n = from; n < from + 500; n++) {
      if (climbOf(getStage(n)) === rows) { picks.push([n, rows]); break; }
    }
  }
  return `<section class="trial">
    <p class="trial-note">${t('trialNote')}</p>
    <form class="jump"><label>${t('stageNo')} <input type="number" min="1" max="${MAX_STAGE}" inputmode="numeric" value="100"></label><button class="primary small">${t('play')}</button></form>
    <div class="chips"><a class="chip" href="#/weekly/${weekOf()}">${t('weekly')}<small>${t('thisWeek')}</small></a><a class="chip" href="#/weekly/${weekOf() + 1}">${t('weekly')}<small>${t('nextWeek')}</small></a>${picks.map(([n, c]) => `<a class="chip" href="#/play/${n}">${t('stage', n)}<small>${t('climb', c)}</small></a>`).join('')}</div>
  </section>`;
}

function showHelp(host, onClose) {
  const el = document.createElement('section');
  el.className = 'sheet';
  el.innerHTML = `<div class="sheet-card" role="dialog" aria-label="${t('help')}">
    <h2>${t('help')}</h2><p>${t('tagline')}</p>
    <ul class="howto">${t('howTo').map(([k, v]) => `<li><b>${k}</b><span>${v}</span></li>`).join('')}</ul>
    <p class="keys">${t('keys')}</p>
    <button class="primary close">${t('close')}</button></div>`;
  host.appendChild(el);
  el.querySelector('.close').onclick = () => { el.remove(); onClose?.(); };
}

// ---------- A stage ----------
/** What to play: a numbered stage, or a week's challenge (same blocks for everyone). */
function stageSpec(n) {
  return { n, def: getStage(n), title: `${t('stage', n)}${trial() ? ` · ${t('climb', climbOf(getStage(n)))}` : ''}` };
}
function weeklySpec(week) {
  return { week, def: weeklyStage(week), blocks: () => weeklyBlocks(week), title: t('weeklyShort'), counts: week === weekOf() };
}

function playStage(spec) {
  const { n } = spec;
  const weekly = spec.week !== undefined;
  const rows = (list) => list.map(([k, v]) => `<li><kbd>${k}</kbd><span>${v}</span></li>`).join('');
  app.innerHTML = `
    <canvas class="pc-backdrop" aria-hidden="true"></canvas>
    <aside class="pc-panel">
      <button class="pc-full">⛶ ${t('fullscreen')}</button>
      <h2>${t('controls')}</h2>
      <ul class="pc-keys">${rows(t('pcMouse'))}</ul>
      <ul class="pc-keys">${rows(t('pcKeys'))}</ul>
    </aside>
    <header class="topbar play-bar">
      <a class="icon-btn" href="#/" aria-label="${t('back')}">‹</a>
      <div class="stage-name"><b>${spec.title}</b><span><span class="star-row" aria-label="${t('stars')}"></span>${weekly ? '<span class="timer">0.0</span>' : ''}</span></div>
      <div class="next-box"><span>${t('next')}</span><canvas class="next" width="192" height="192"></canvas></div>
      <button class="icon-btn pause" aria-label="${t('pause')}">Ⅱ</button>
    </header>
    <div class="board-wrap">
      <canvas class="board" aria-label="${t('title')} · ${spec.title}"></canvas>
      <section class="over" hidden></section>
    </div>
    <div class="pad">
      <button class="pad-btn left" aria-label="Left">◀</button>
      <button class="pad-btn rot" aria-label="Rotate">⟳</button>
      <button class="pad-btn right" aria-label="Right">▶</button>
      <button class="pad-btn drop" aria-label="Drop">⤓</button>
    </div>`;
  const $ = (s) => app.querySelector(s);
  const canvas = $('.board');
  const ctx = canvas.getContext('2d');
  const nextCtx = $('.next').getContext('2d');
  const timerEl = $('.timer');

  let g, fx, time, paused, shownEnd, warned, panicking;
  function start() {
    g = makeGame(spec.def, spec.blocks?.());
    g.theme = themeOf(n, spec.week);
    fx = [];
    time = 0;
    paused = false;
    shownEnd = false;
    warned = false;
    panicking = false;
    $('.over').hidden = true;
    renderStars();
    if (weekly) weeklyIntro();
  }
  // Before each weekly try: what this is, and a start button (the clock waits for it).
  function weeklyIntro() {
    paused = true;
    const el = $('.over');
    const rec = weeklyRecords()[spec.week];
    el.innerHTML = `<p class="over-title">🗓 ${t('weekly')}</p>
      <p class="wk-range">${weekRange(spec.week)}</p>
      <p class="weekly-note">${t('weeklyNote')}</p>
      ${rec?.best ? `<p class="wk-best">${t('weeklyBest', secs(rec.best))} ${starText(rec.stars)}</p>` : ''}
      <button class="primary go">${t('start')}</button>
      <a class="ghost" href="#/">${t('home')}</a>`;
    el.hidden = false;
    el.querySelector('.go').onclick = () => { el.hidden = true; paused = false; last = performance.now(); acc = 0; };
  }
  function renderStars() {
    const got = starsGot(g);
    $('.star-row').textContent = '★'.repeat(got) + '☆'.repeat(3 - got);
  }

  // Sizing: the board keeps its 10 × 15 shape and fits the space left for it.
  function resize() {
    const dpr = window.devicePixelRatio || 1;
    const width = canvas.clientWidth;
    canvas.width = Math.round(width * dpr);
    const cols = g ? g.w : W, rows = g ? g.vh : H;
    canvas.height = Math.round(width * (rows / cols) * dpr);
    ctx.setTransform((width / (cols * CELL)) * dpr, 0, 0, (width / (cols * CELL)) * dpr, 0, 0);
  }
  const ro = new ResizeObserver(resize);
  ro.observe(canvas);

  // PC version: the stage's scenery spread across the whole window behind the panels (cover-fit,
  // softened by CSS), and a full-screen switch.
  const backdrop = $('.pc-backdrop');
  function paintBackdrop() {
    if (getComputedStyle($('.pc-panel')).display === 'none') return; // phone layout
    const img = scenery(themeOf(n, spec.week));
    if (!img) return;
    const w = innerWidth, h = innerHeight, dpr = Math.min(2, window.devicePixelRatio || 1);
    backdrop.width = Math.round(w * dpr); backdrop.height = Math.round(h * dpr);
    // Drawn a little larger than cover so the soft edges stay off screen; softened and dimmed
    // in the canvas itself (a CSS filter on a window-sized canvas fails on some graphics chips).
    const s = Math.max(backdrop.width / img.width, backdrop.height / img.height) * 1.04;
    const bc = backdrop.getContext('2d');
    bc.filter = `blur(${Math.round(6 * dpr)}px)`;
    bc.drawImage(img, (backdrop.width - img.width * s) / 2, (backdrop.height - img.height * s) / 2, img.width * s, img.height * s);
    bc.filter = 'none';
    bc.fillStyle = 'rgba(12, 16, 30, 0.3)';
    bc.fillRect(0, 0, backdrop.width, backdrop.height);
  }
  paintBackdrop();
  window.addEventListener('resize', paintBackdrop);
  const toggleFull = () => {
    if (document.fullscreenElement) document.exitFullscreen?.();
    else document.documentElement.requestFullscreen?.().catch(() => {});
  };
  $('.pc-full').onclick = (e) => { toggleFull(); e.currentTarget.blur(); };

  // ----- Input -----
  const act = (fn) => { if (!paused && g.status === 'play') fn(); };
  // Buttons act on press (not release) so they feel instant; ◀ ▶ repeat while held.
  let repeat = null;
  const stopRepeat = () => { clearTimeout(repeat); repeat = null; };
  function holdButton(btn, fn, repeats) {
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      act(fn);
      if (!repeats) return;
      stopRepeat();
      const again = (delay) => { repeat = setTimeout(() => { act(fn); again(70); }, delay); };
      again(200);
    });
    for (const ev of ['pointerup', 'pointerleave', 'pointercancel']) btn.addEventListener(ev, stopRepeat);
    btn.addEventListener('contextmenu', (e) => e.preventDefault());
  }
  holdButton($('.left'), () => move(g, -1), true);
  holdButton($('.right'), () => move(g, 1), true);
  holdButton($('.rot'), () => rotate(g), false);
  holdButton($('.drop'), () => hardDrop(g), false);

  // On the board: drag sideways to move, tap to turn, swipe down to drop.
  let drag = null;
  // With a mouse (the PC version): the block follows the pointer across, a click drops it, a
  // right click or the wheel turns it.
  function followMouse(e) {
    if (!g.piece) return;
    const r = canvas.getBoundingClientRect();
    const col = Math.floor(((e.clientX - r.left) / r.width) * g.w);
    const width = Math.max(...g.piece.cells.map((c) => c[0])) + 1;
    const want = Math.max(0, Math.min(g.w - width, col - Math.floor((width - 1) / 2)));
    for (let k = 0; k < g.w && g.piece.x !== want; k++) {
      const before = g.piece.x;
      act(() => move(g, want > g.piece.x ? 1 : -1));
      if (!g.piece || g.piece.x === before) break; // blocked
    }
  }
  let wheelAt = 0;
  canvas.addEventListener('wheel', (e) => {
    e.preventDefault();
    if (performance.now() - wheelAt < 120) return; // one turn per notch, not per pixel
    wheelAt = performance.now();
    act(() => rotate(g));
  }, { passive: false });
  canvas.addEventListener('contextmenu', (e) => e.preventDefault());
  canvas.addEventListener('pointerdown', (e) => {
    if (e.pointerType === 'mouse') {
      e.preventDefault();
      if (e.button === 2) act(() => rotate(g));
      else if (e.button === 0) { followMouse(e); act(() => hardDrop(g)); }
      return;
    }
    drag = { x: e.clientX, y: e.clientY, at: performance.now(), moved: 0, travelled: 0 };
    try { canvas.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
  });
  canvas.addEventListener('pointermove', (e) => {
    if (e.pointerType === 'mouse') { followMouse(e); return; }
    if (!drag) return;
    const cell = canvas.clientWidth / g.w;
    const cells = Math.trunc((e.clientX - drag.x) / cell);
    drag.travelled = Math.max(drag.travelled, Math.hypot(e.clientX - drag.x, e.clientY - drag.y));
    while (drag.moved < cells) { act(() => move(g, 1)); drag.moved++; }
    while (drag.moved > cells) { act(() => move(g, -1)); drag.moved--; }
  });
  canvas.addEventListener('pointerup', (e) => {
    if (!drag) return;
    const dy = e.clientY - drag.y, dx = e.clientX - drag.x;
    const quick = performance.now() - drag.at < 350;
    const cell = canvas.clientWidth / g.w;
    if (drag.travelled < 10 && quick) act(() => rotate(g));
    else if (dy > cell * 1.5 && dy > Math.abs(dx) * 1.5 && drag.moved === 0) act(() => hardDrop(g));
    drag = null;
  });
  canvas.addEventListener('pointercancel', () => { drag = null; });

  function onKey(e) {
    if (e.target.closest?.('input, textarea')) return;
    const k = e.key;
    if (k === 'Escape' || k === 'p' || k === 'P') { togglePause(); e.preventDefault(); return; }
    if ((k === 'f' || k === 'F') && !e.repeat) { toggleFull(); e.preventDefault(); return; }
    if (k === 'ArrowLeft' || k === 'a' || k === 'A') act(() => move(g, -1));
    else if (k === 'ArrowRight' || k === 'd' || k === 'D') act(() => move(g, 1));
    else if (k === 'ArrowUp' || k === 'x' || k === 'X' || k === 'w' || k === 'W') { if (!e.repeat) act(() => rotate(g)); }
    else if (k === ' ') { if (!e.repeat) act(() => hardDrop(g)); }
    else if (k === 'ArrowDown' || k === 's' || k === 'S') act(() => setSoft(g, true));
    else if (k === 'Enter' && g.status !== 'play') { (g.status === 'won' ? $('.over .next-stage') : $('.over .retry'))?.click(); }
    else return;
    e.preventDefault();
  }
  function onKeyUp(e) {
    if (e.key === 'ArrowDown' || e.key === 's' || e.key === 'S') setSoft(g, false);
  }
  document.addEventListener('keydown', onKey);
  document.addEventListener('keyup', onKeyUp);

  // ----- Pause -----
  function togglePause(force) {
    if (g.status !== 'play') return;
    paused = force ?? !paused;
    const el = $('.over');
    if (!paused) { el.hidden = true; return; }
    el.innerHTML = `<p class="over-title">${t('paused')}</p>
      <button class="primary resume">${t('resume')}</button>
      <button class="ghost retry">${t('retry')}</button>
      <a class="ghost" href="#/">${t('stages')}</a>`;
    el.hidden = false;
    el.querySelector('.resume').onclick = () => togglePause(false);
    el.querySelector('.retry').onclick = start;
  }
  $('.pause').onclick = () => togglePause();
  // Pause when the app goes to the background (a phone call, switching apps).
  const onHide = () => { if (document.hidden) togglePause(true); last = performance.now(); acc = 0; };
  document.addEventListener('visibilitychange', onHide);

  // ----- End of a stage -----
  function showEnd() {
    shownEnd = true;
    const el = $('.over');
    const got = starsGot(g);
    if (weekly) { showWeeklyEnd(el, got); return; }
    if (g.status === 'won') {
      const best = bestStars();
      if (!trial() && (best[n] ?? -1) < got) save({ stars: { ...best, [n]: got } });
      el.innerHTML = `<p class="over-title">${t('clear')}</p>
        <p class="big-stars">${[0, 1, 2].map((k) => `<span class="${k < got ? 'on' : ''}" style="animation-delay:${k * 0.18}s">★</span>`).join('')}</p>
        <a class="primary next-stage" href="#/play/${n + 1}">${t('nextStage')}</a>
        <button class="ghost retry">${t('retry')}</button>
        <a class="ghost" href="#/">${t('stages')}</a>`;
    } else {
      // Once per try: watch a video to carry on from here (only when an ad is available).
      const offer = canRevive(g) && rewardedReady();
      el.innerHTML = `<p class="over-title">${t(g.reason === 'water' ? 'lostWater' : g.reason === 'crushed' ? 'lostCrushed' : 'lostFull')}</p>
        ${offer ? `<button class="primary revive">▶ ${t('reviveAd')}</button>` : ''}
        <button class="${offer ? 'ghost' : 'primary'} retry">${t('retry')}</button>
        <a class="ghost" href="#/">${t('stages')}</a>`;
      const rb = el.querySelector('.revive');
      if (rb) rb.onclick = async () => {
        rb.disabled = true;
        const ok = await showRewarded();
        if (ok && revive(g)) {
          el.hidden = true;
          shownEnd = false;
          endDelay = 0;
          paused = false;
          last = performance.now();
          acc = 0;
        } else rb.disabled = false;
      };
    }
    el.hidden = false;
    el.querySelector('.retry').onclick = start;
  }

  function showWeeklyEnd(el, got) {
    const rec = weeklyRecords()[spec.week] || { tries: 0 };
    const tries = (rec.tries || 0) + 1;
    const won = g.status === 'won';
    const time = g.time;
    const isBest = won && (!rec.best || time < rec.best);
    const now = isBest ? { best: time, stars: got, tries, bestTry: tries } : { ...rec, tries };
    if (spec.counts) saveWeekly(spec.week, now);
    el.innerHTML = won
      ? `<p class="over-title">${t('clear')}</p>
        <p class="big-stars">${[0, 1, 2].map((k) => `<span class="${k < got ? 'on' : ''}" style="animation-delay:${k * 0.18}s">★</span>`).join('')}</p>
        <p class="weekly-time"><b>${t('secs', secs(time))}</b><small>${isBest ? t('newBest') : t('weeklyBest', secs(rec.best))}</small></p>
        <button class="primary share">${t('share')}</button>
        <button class="ghost retry">${t('retry')}</button>
        <a class="ghost" href="#/">${t('home')}</a>`
      : `<p class="over-title">${t(g.reason === 'water' ? 'lostWater' : g.reason === 'crushed' ? 'lostCrushed' : 'lostFull')}</p>
        ${rec.best ? `<p class="weekly-time"><small>${t('weeklyBest', secs(rec.best))}</small></p>` : ''}
        <button class="primary retry">${t('retry')}</button>
        ${rec.best ? `<button class="ghost share">${t('share')}</button>` : ''}
        <a class="ghost" href="#/">${t('home')}</a>`;
    el.hidden = false;
    el.querySelector('.retry').onclick = start;
    const shareBtn = el.querySelector('.share');
    if (shareBtn) {
      const best = won && isBest ? now : rec;
      shareBtn.onclick = () => shareText(t('shareText', weekRange(spec.week), starText(best.stars), secs(best.best), best.bestTry || best.tries), shareBtn);
    }
  }

  // ----- Loop -----
  let last = performance.now();
  let acc = 0;
  let alive = true;
  let endDelay = 0;
  const DT = 1 / 60;
  function loop(now) {
    if (!alive) return;
    acc += Math.min(0.1, (now - last) / 1000);
    last = now;
    while (acc >= DT) {
      acc -= DT;
      time += DT;
      if (!paused) update(g, DT);
      for (const e of takeEvents(g)) {
        const type = typeof e === 'string' ? e : e.type;
        SOUNDS[type]?.();
        if (type === 'lock') buzz(8);
        if (type === 'trip') buzz([25, 30, 50]);
        if (type === 'lost' && g.reason === 'crushed') { SOUNDS.boom(); buzz([40, 40, 40]); }
        if (type === 'boom') { fx.push({ type: 'boom', x: e.x, y: e.y, age: 0, life: 0.35 }); buzz([20, 30, 20]); }
        if (type === 'star') {
          renderStars();
          for (let k = 0; k < 8; k++) {
            const a = (k / 8) * Math.PI * 2;
            fx.push({ type: 'spark', x: e.x * CELL + CELL / 2, y: e.y * CELL + CELL / 2, vx: Math.cos(a) * 120, vy: Math.sin(a) * 120, age: 0, life: 0.5 });
          }
        }
        if (type === 'won' || type === 'lost') endDelay = type === 'won' ? 1.1 : 0.9;
      }
      // A warning buzz once when the water nears Poko.
      if (g.status === 'play' && !warned && waterTop(g) < g.walker.y + 2.2) { warned = true; buzz([30, 60, 30]); }
      // Once each time a block starts coming down on Poko: an "uh-oh" and a little buzz.
      const nowPanic = crushGap(g) >= 0;
      if (nowPanic && !panicking) { SOUNDS.panic(); buzz([15, 40, 15]); }
      panicking = nowPanic;
      for (const f of fx) { f.age += DT; if (f.vx !== undefined) { f.x += f.vx * DT; f.y += f.vy * DT; } }
      fx = fx.filter((f) => f.age < f.life);
      if (g.status !== 'play' && !shownEnd && (endDelay -= DT) <= 0) showEnd();
    }
    if (weekly) timerEl.textContent = t('secs', secs(g.time));
    drawBoard(ctx, g, time, colors, fx);
    if (g.next) drawPiecePreview(nextCtx, g.next, 192, time);
    requestAnimationFrame(loop);
  }

  start();
  resize();
  requestAnimationFrame(loop);
  if (n === 1 && !load().seenHelp) {
    paused = true;
    showHelp(app, () => { save({ seenHelp: true }); paused = false; last = performance.now(); acc = 0; });
  }

  return () => {
    alive = false;
    stopRepeat();
    ro.disconnect();
    window.removeEventListener('resize', paintBackdrop);
    document.removeEventListener('keydown', onKey);
    document.removeEventListener('keyup', onKeyUp);
    document.removeEventListener('visibilitychange', onHide);
  };
}

async function shareText(text, btn) {
  const url = location.href.split('#')[0];
  const full = `${text}\n${url}`;
  try {
    if (navigator.share) { await navigator.share({ text: full }); return; }
  } catch (e) { if (e?.name === 'AbortError') return; }
  try {
    await navigator.clipboard.writeText(full);
    btn.textContent = t('copied');
  } catch {
    const ta = document.createElement('textarea');
    ta.className = 'share-text';
    ta.readOnly = true;
    ta.value = full;
    btn.after(ta);
    ta.select();
  }
}

route();

// (Not in the app: its files are on the phone already.)
if (!NATIVE && 'serviceWorker' in navigator && (location.protocol === 'https:' || location.hostname === 'localhost')) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

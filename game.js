'use strict';

const pause = ms => new Promise(r => setTimeout(r, ms));

// Saved settings and scores used to be stored under names starting with
// "2048"; copy them across once so nobody loses their best score
try {
  ['sound', 'theme', 'haptics', 'best', 'tutorial', 'lbId', 'lbName', 'lbPending'].forEach(k => {
    const old = localStorage.getItem('2048' + k);
    if (old !== null && localStorage.getItem('fruitpicnic.' + k) === null) localStorage.setItem('fruitpicnic.' + k, old);
  });
} catch (_) {}

// ── Audio ─────────────────────────────────────────────────────────────────────
// Kalimba garden: a soft muted thump for every merge, and a short "climbing
// phrase" the first time each new fruit appears (same shape, one step higher
// per fruit). Everything is synthesised with Web Audio; no sound files.
let soundOn = true;
try { soundOn = localStorage.getItem('fruitpicnic.sound') !== 'off'; } catch (_) {}

// Theme: 'fruit' (Fruit Picnic), 'night' (Cocoa Night) or 'halloween' (Spooky Picnic), remembered per phone
let themeId = 'fruit';
try { const saved = localStorage.getItem('fruitpicnic.theme'); if (saved === 'halloween' || saved === 'night') themeId = saved; } catch (_) {}
TILE_ART = THEMES[themeId].art;

let audioCtx = null, audioBus = null, audioVerb = null, noiseBuf = null;

function getAudio() {
  if (!audioCtx) {
    const ctx = audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14; comp.ratio.value = 4;
    comp.connect(ctx.destination);
    audioBus = ctx.createGain(); audioBus.gain.value = 0.9; audioBus.connect(comp);
    // Small generated room reverb for warmth
    audioVerb = ctx.createConvolver();
    const n = Math.floor(ctx.sampleRate * 1.8), ir = ctx.createBuffer(2, n, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const d = ir.getChannelData(ch);
      for (let k = 0; k < n; k++) d[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / n, 3);
    }
    audioVerb.buffer = ir;
    const vg = ctx.createGain(); vg.gain.value = 0.45;
    audioVerb.connect(vg); vg.connect(comp);
    noiseBuf = ctx.createBuffer(1, Math.floor(ctx.sampleRate * 0.1), ctx.sampleRate);
    const nd = noiseBuf.getChannelData(0);
    for (let k = 0; k < nd.length; k++) nd[k] = Math.random() * 2 - 1;
  }
  // iOS uses 'suspended' before the first tap and 'interrupted' after a screen lock
  if (audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
  return audioCtx;
}

function route(node, send, pan = 0) {
  if (pan && audioCtx.createStereoPanner) {
    const p = audioCtx.createStereoPanner(); p.pan.value = pan; node.connect(p); node = p;
  }
  node.connect(audioBus);
  if (send) { const s = audioCtx.createGain(); s.gain.value = send; node.connect(s); s.connect(audioVerb); }
}

function tone(t, { f, type = 'sine', vol = 0.1, a = 0.005, d = 0.3, lp = null, send = 0, from = null, glide = 0.05 }) {
  const osc = audioCtx.createOscillator(), g = audioCtx.createGain();
  osc.type = type;
  if (from) { osc.frequency.setValueAtTime(from, t); osc.frequency.exponentialRampToValueAtTime(f, t + glide); }
  else osc.frequency.setValueAtTime(f, t);
  let last = osc;
  if (lp) { const fl = audioCtx.createBiquadFilter(); fl.type = 'lowpass'; fl.frequency.value = lp; osc.connect(fl); last = fl; }
  last.connect(g);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + a);
  g.gain.exponentialRampToValueAtTime(0.0005, t + a + d);
  route(g, send);
  osc.start(t); osc.stop(t + a + d + 0.05);
}

function tap(t, vol) {
  const src = audioCtx.createBufferSource(), fl = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = noiseBuf;
  fl.type = 'bandpass'; fl.frequency.value = 700; fl.Q.value = 1;
  src.connect(fl); fl.connect(g);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.01);
  route(g, 0);
  src.start(t); src.stop(t + 0.05);
}

// A swipe that doesn't merge: each theme has its own slide sound
function soundSlide(dir) { themeId === 'halloween' ? ghostSwoosh() : paperSwipe(dir); }

// Fruit Picnic: a finger brushing across paper. Noise with a grainy, uneven
// texture (paper fibres), filtered to a soft papery "shhf" that swells and
// fades over the slide. It follows the swipe: left or right in stereo, a touch
// higher for up and lower for down. A little random tilt so no two swipes
// sound the same. Kept a little under the merge sounds.
// gain evens out loudness: panning and the lower tilt both sound a little quieter
const SLIDE_DIRS = {
  left: { pan: -0.45, tilt: 1, gain: 1.45 }, right: { pan: 0.45, tilt: 1, gain: 1.45 },
  up: { pan: 0, tilt: 1.12, gain: 1 }, down: { pan: 0, tilt: 0.88, gain: 1.12 },
};
const PAPER_VOL = 0.0126;
let paperBuf = null;
function paperSwipe(dir) {
  withAudio(t => {
    if (!paperBuf) {
      paperBuf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.25), audioCtx.sampleRate);
      const d = paperBuf.getChannelData(0), grain = Math.floor(audioCtx.sampleRate * 0.004);
      let level = 1;
      for (let k = 0; k < d.length; k++) {
        if (k % grain === 0) level = 0.45 + Math.random() * 0.55;
        d[k] = (Math.random() * 2 - 1) * level;
      }
    }
    const { pan, tilt, gain } = SLIDE_DIRS[dir] || SLIDE_DIRS.left;
    const len = 0.15, w = (0.9 + Math.random() * 0.2) * tilt, vol = PAPER_VOL * gain;
    const src = audioCtx.createBufferSource(), hp = audioCtx.createBiquadFilter(),
      bp = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    src.buffer = paperBuf;
    hp.type = 'highpass'; hp.frequency.value = 900;
    bp.type = 'bandpass'; bp.Q.value = 0.7;
    bp.frequency.setValueAtTime(2200 * w, t);
    bp.frequency.linearRampToValueAtTime(3600 * w, t + len);
    src.connect(hp); hp.connect(bp); bp.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.035);
    g.gain.linearRampToValueAtTime(vol * 0.61, t + len * 0.6);
    g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    route(g, 0.05, pan);
    src.start(t); src.stop(t + len + 0.02);
  });
}

function kalimba(t, f, vol, send = 0.15) {
  tone(t, { f, type: 'triangle', vol, a: 0.003, d: 0.5, lp: 2200, send });
  tone(t, { f: f * 2, vol: vol * 0.3, a: 0.002, d: 0.15, send });
}

// Pentatonic notes: i = 0 is C4, every 5 steps is an octave
const STEPS = [0, 2, 4, 7, 9];
function note(i) {
  const o = Math.floor(i / 5), s = STEPS[((i % 5) + 5) % 5];
  return 261.63 * Math.pow(2, o + s / 12);
}

const BEAT = 0.14;
function playPhrase(t, phrase, vol = 0.09, send = 0.2) {
  let at = t;
  phrase.forEach(([i, beats], k) => {
    const last = k === phrase.length - 1;
    kalimba(at, note(i), last ? vol * 1.15 : vol, send);
    if (!last) at += beats * BEAT;
  });
  return at;
}

function withAudio(fn) {
  if (!soundOn) return;
  try { const t = getAudio().currentTime + 0.01; fn(t); } catch (_) {}
}

// Merges step up the scale as tiles grow: 0 for the smallest merges, up to 4
// for 1024 and above (one step every two tile sizes)
const mergeStep = value => Math.min(Math.max(Math.floor((Math.log2(value || 4) - 2) / 2), 0), 4);

// ── Fruit Picnic sounds ──
// Every merge: a soft, muted woody thump on a note of the scale (E3 up to D4),
// with a quiet octave on top so it still comes through a phone's small speaker
const MERGE_VOL = { fruit: 1, halloween: 0.75 };   // evens out the two themes
function kalimbaMerge(value) {
  withAudio(t => {
    const f = note(-3 + mergeStep(value)) * (0.99 + Math.random() * 0.02), v = MERGE_VOL.fruit;
    tone(t, { f, type: 'triangle', vol: 0.06 * v, a: 0.002, d: 0.06, lp: Math.max(500, f * 3) });
    tone(t, { f: f * 2, vol: 0.042 * v, a: 0.002, d: 0.045, lp: 1600 });
    tap(t, 0.016 * v);
  });
}

// New fruit: the climbing phrase. L = -3 for strawberry (4), 0 for orange (32)
// … 6 for watermelon (2048). Strawberry, grapes and lemon continue the climb
// downward, so orange and up are unchanged.
function kalimbaNewFruit(value) {
  const L = Math.min(Math.max(Math.log2(value) - 5, -3), 6);
  withAudio(t => {
    const b = 2 + L;
    const phrase = L >= 6
      ? [[b, 1], [b + 2, 1], [b + 1, 1], [b + 3, 1], [b + 5, 3]]
      : [[b, 1], [b + 2, 1], [b + 1, 1], [b + 3, 2]];
    const lastAt = playPhrase(t, phrase);
    if (L >= 5) kalimba(lastAt, note(phrase[phrase.length - 1][0] - 5), 0.05, 0.3);
    if (L >= 6) [b - 5, b - 3, b - 2, b].forEach((i, k) => kalimba(lastAt + 0.02 + k * 0.03, note(i), 0.045, 0.4));
  });
}

// ── Spooky Picnic sounds ──
// A creamy keyboard "thock" on every merge, and the same climbing phrase as
// Fruit Picnic for each new tile, played on music-box bells in a minor key.
const MINOR = [0, 3, 5, 7, 10];                      // minor pentatonic
// Tuned to the keyboard sound below: the home note is 170 Hz, so the bells and
// the merge "thock" share a note (darker than standard A3 = 220 Hz)
const KEY = 170;
function mnote(i) {                                   // i = 0 is the home note; 5 steps per octave
  const o = Math.floor(i / 5), s = MINOR[((i % 5) + 5) % 5];
  return KEY * Math.pow(2, o + s / 12);
}
function bell(t, f, vol, d = 0.7, send = 0.2) {
  tone(t, { f, vol, a: 0.003, d, send });
  // low bells get a quiet octave too, or a phone's small speaker loses them
  const low = Math.min(Math.max((260 - f) / 100, 0), 1);
  if (low) {
    tone(t, { f: f * 2, vol: vol * 0.9 * low, a: 0.003, d: d * 0.6, send });
    tone(t, { f: f * 3, vol: vol * 0.35 * low, a: 0.002, d: d * 0.4, send });
  }
  tone(t, { f: f * 2.76, vol: vol * 0.22, a: 0.002, d: d * 0.45, send });
  tone(t, { f: f * 5.4, vol: vol * 0.07, a: 0.002, d: d * 0.25, send });
}
// Every merge: a creamy mechanical-keyboard "thock", a lubed key bottoming
// out. A low muted body on the home note, a soft dark click, a whisper of echo.
function thock(t, vol) {
  const src = audioCtx.createBufferSource(), fl = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
  src.buffer = noiseBuf;
  fl.type = 'lowpass'; fl.frequency.value = 900; fl.Q.value = 0.7;
  src.connect(fl); fl.connect(g);
  g.gain.setValueAtTime(0, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.001);
  g.gain.exponentialRampToValueAtTime(0.0005, t + 0.021);
  route(g, 0);
  src.start(t); src.stop(t + 0.07);
}
// Like Fruit Picnic, the note steps up the scale as tiles grow, with a quiet
// octave on top for small speakers
function keyboardMerge(value) {
  withAudio(t => {
    const f = mnote(mergeStep(value)) * (0.995 + Math.random() * 0.01), v = MERGE_VOL.halloween;
    tone(t, { f, from: f * 1.24, glide: 0.025, type: 'triangle', vol: 0.08 * v, a: 0.001, d: 0.06, lp: Math.max(500, f * 3), send: 0.08 });
    tone(t, { f: f / 2, vol: 0.045 * v, a: 0.001, d: 0.05 });
    tone(t, { f: f * 2, vol: 0.034 * v, a: 0.001, d: 0.04, lp: 1600 });
    thock(t, 0.035 * v);
  });
}
function musicBoxNewTile(value) {
  const L = Math.min(Math.max(Math.log2(value) - 5, -3), 6);
  withAudio(t => {
    const b = 2 + L, beat = 0.17;
    const phrase = L >= 6
      ? [[b, 1], [b + 2, 1], [b + 1, 1], [b + 3, 1], [b + 5, 3]]
      : [[b, 1], [b + 2, 1], [b + 1, 1], [b + 3, 2]];
    let at = t;
    phrase.forEach(([i, beats], k) => {
      const last = k === phrase.length - 1;
      // shorter rings than they used to be, so fast play doesn't pile them up
      bell(at, mnote(i), last ? 0.0805 : 0.07, last ? 0.75 : 0.55, 0.3);
      if (!last) at += beats * beat;
    });
    const top = phrase[phrase.length - 1][0];
    if (L >= 5) bell(at, mnote(top - 5), 0.035, 1.2, 0.5);
    if (L >= 6) [b - 5, b - 3, b - 2, b].forEach((i, k) => bell(at + 0.03 + k * 0.05, mnote(i), 0.03, 1.4, 0.6));
  });
}

// Spooky Picnic: a soft ghostly "whoo". Smooth breath noise through a narrow,
// vowel-like filter that swoops down, with a little more echo than the paper.
let ghostBuf = null;
function ghostSwoosh() {
  withAudio(t => {
    if (!ghostBuf) {
      ghostBuf = audioCtx.createBuffer(1, Math.floor(audioCtx.sampleRate * 0.4), audioCtx.sampleRate);
      const d = ghostBuf.getChannelData(0);
      for (let k = 0; k < d.length; k++) d[k] = Math.random() * 2 - 1;
    }
    const len = 0.22, w = 0.92 + Math.random() * 0.16;
    const src = audioCtx.createBufferSource(), bp = audioCtx.createBiquadFilter(),
      lp = audioCtx.createBiquadFilter(), g = audioCtx.createGain();
    src.buffer = ghostBuf;
    bp.type = 'bandpass'; bp.Q.value = 5;
    bp.frequency.setValueAtTime(1150 * w, t);
    bp.frequency.exponentialRampToValueAtTime(560 * w, t + len);
    lp.type = 'lowpass'; lp.frequency.value = 2400;
    src.connect(bp); bp.connect(lp); lp.connect(g);
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(GHOST_VOL, t + 0.06);
    g.gain.exponentialRampToValueAtTime(0.0005, t + len);
    route(g, 0.25);
    src.start(t); src.stop(t + len + 0.02);
  });
}
const GHOST_VOL = 0.095;

function soundMerge(value) { themeId === 'halloween' ? keyboardMerge(value) : kalimbaMerge(value); }
function soundNewFruit(value) { themeId === 'halloween' ? musicBoxNewTile(value) : kalimbaNewFruit(value); }

// Game sound effects, not music: on iPhone they mix with whatever the player is
// listening to (no pausing their music or podcast) and go quiet when the silent
// switch is on (Safari 16.4+ and the app; older versions ignore this)
function useAmbientAudio() {
  try {
    if (navigator.audioSession && navigator.audioSession.type !== 'ambient') navigator.audioSession.type = 'ambient';
  } catch (_) {}
}
useAmbientAudio();

// iOS only lets audio start from a tap/click/key (not a finger moving), and
// swipes fire on touchmove, so wake the audio on the first real tap or key.
// Runs on every tap (cheap when audio is already running), so it also
// recovers after the phone was locked or the app was in the background.
function unlockAudio() {
  if (!soundOn) return;
  useAmbientAudio();
  try {
    const ctx = getAudio();
    if (ctx.state !== 'running') {
      // Starting a silent sound inside the tap is what fully unlocks iOS audio
      const src = ctx.createBufferSource();
      src.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      src.connect(ctx.destination);
      src.start(0);
    }
  } catch (_) {}
}
['touchend', 'pointerdown', 'pointerup', 'click', 'keydown'].forEach(ev =>
  document.addEventListener(ev, unlockAudio, { capture: true, passive: true }));
document.addEventListener('visibilitychange', () => {
  if (!document.hidden && audioCtx && audioCtx.state !== 'running') audioCtx.resume().catch(() => {});
});

// Header and settings icons share one style: the tiles' ink outline with cream fills, each on
// its own pastel button (colours in style.css)
const ICON_OPEN = '<svg viewBox="0 0 24 24" fill="none" stroke="#6B3F6E" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round">';
const CREAM = '#FFFDF8';
const NOTES = '<path d="M10 17V6.5l9-2V15"/><path d="M10 9l9-2"/>'
  + `<circle cx="7.6" cy="17" r="2.6" fill="${CREAM}"/><circle cx="16.6" cy="15" r="2.6" fill="${CREAM}"/>`;
const SLASH = '<path d="M4 4l16 16" stroke-width="2.2"/>';
// Settings switch for sound: music notes, with a slash when sound is off
function showSoundIcon() {
  document.getElementById('soundIco').innerHTML = ICON_OPEN + NOTES + (soundOn ? '' : SLASH) + '</svg>';
  document.getElementById('soundToggle').setAttribute('aria-checked', soundOn);
}

// ── Haptics (iPhone app only) ─────────────────────────────────────────────────
// In the App Store version the phone gives little taps and bumps. On the
// website there's no vibration on iPhone, so these do nothing there.
const native = window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
const nativePlugin = name => native ? (window.Capacitor.Plugins[name] || window.Capacitor.registerPlugin(name)) : null;
const Haptics = nativePlugin('Haptics');
let hapticsOn = true;
try { hapticsOn = localStorage.getItem('fruitpicnic.haptics') !== 'off'; } catch (_) {}
function haptic(kind) {
  if (!Haptics || !hapticsOn) return;
  try {
    const p = kind === 'win' ? Haptics.notification({ type: 'SUCCESS' })
      : kind === 'lose' ? Haptics.notification({ type: 'WARNING' })
      : Haptics.impact({ style: kind === 'new' ? 'MEDIUM' : 'LIGHT' });
    if (p && p.catch) p.catch(() => {});
  } catch (_) {}
}
function showHapticsIcon() {
  document.getElementById('hapticsIco').innerHTML = ICON_OPEN
    + `<rect x="8" y="3.5" width="8" height="17" rx="2.2" fill="${CREAM}"/>`
    + '<path d="M4.5 8.5v7M19.5 8.5v7M2 10.5v3M22 10.5v3"/>'
    + (hapticsOn ? '' : SLASH) + '</svg>';
  document.getElementById('hapticsToggle').setAttribute('aria-checked', hapticsOn);
}

// Reaching 2048: the watermelon phrase is the finale
function soundVictory() { soundNewFruit(2048); }

// Game over: a gentle phrase stepping down
function soundGameOver() {
  if (themeId === 'halloween') {
    withAudio(t => [7, 5, 4, 2, 0].forEach((i, k) => bell(t + k * 0.2, mnote(i), 0.06, k === 4 ? 1.0 : 0.6, 0.3)));
  } else {
    withAudio(t => playPhrase(t, [[7, 1], [5, 1], [4, 1], [2, 1], [0, 3]], 0.07, 0.25));
  }
}

// ── Confetti ──────────────────────────────────────────────────────────────────
const CC = ['#FF85C2','#CF91F0','#80D5E0','#FFE05A','#B5E48C','#FF99C8','#A8DADC'];

class Particle {
  constructor(canvas) { this.c = canvas; this.reset(); this.y = Math.random() * canvas.height; }
  reset() {
    this.x  = Math.random() * this.c.width;
    this.y  = -20;
    this.w  = 7 + Math.random() * 8;
    this.h  = 4 + Math.random() * 5;
    this.color = CC[Math.floor(Math.random() * CC.length)];
    this.vx = (Math.random() - 0.5) * 1.2;
    this.vy = 1.6 + Math.random() * 2.2;
    this.angle = Math.random() * Math.PI * 2;
    this.va = (Math.random() - 0.5) * 0.1;
    // paper flutter: side-to-side sway and a flip as it falls
    this.sway = Math.random() * Math.PI * 2;
    this.swaySpeed = 0.03 + Math.random() * 0.04;
    this.flip = Math.random() * Math.PI * 2;
    this.flipSpeed = 0.06 + Math.random() * 0.08;
  }
  update() {
    this.sway += this.swaySpeed; this.flip += this.flipSpeed;
    this.x += this.vx + Math.sin(this.sway) * 1.1;
    this.y += this.vy;
    this.angle += this.va;
    if (this.y > this.c.height + 20) this.reset();
  }
  draw(ctx) {
    ctx.save();
    ctx.translate(this.x, this.y);
    ctx.rotate(this.angle);
    ctx.scale(1, Math.cos(this.flip));
    ctx.fillStyle = this.color;
    ctx.fillRect(-this.w / 2, -this.h / 2, this.w, this.h);
    ctx.restore();
  }
}

let particles = [], animId = null;

function startConfetti() {
  const cv = document.getElementById('confetti');
  cv.width = window.innerWidth; cv.height = window.innerHeight;
  const ctx = cv.getContext('2d');
  particles = Array.from({ length: 130 }, () => new Particle(cv));
  const frame = () => {
    ctx.clearRect(0, 0, cv.width, cv.height);
    particles.forEach(p => { p.update(); p.draw(ctx); });
    animId = requestAnimationFrame(frame);
  };
  cancelAnimationFrame(animId); frame();
}

function stopConfetti() {
  cancelAnimationFrame(animId);
  const cv = document.getElementById('confetti');
  cv.getContext('2d').clearRect(0, 0, cv.width, cv.height);
}

// ── Constants & live state ────────────────────────────────────────────────────
const SIZE = 4;
const GAP  = 10;
const SLIDE_MS = 130;   // must match CSS transition duration

// liveTiles: the single source of truth — array of { id, value, r, c, el }
let liveTiles = [];
let nextId = 1;
let score = 0;
let best = parseInt(localStorage.getItem('fruitpicnic.best') || '0', 10);
let celebrationShown = false;
let highestThisGame = 0;      // for the new-fruit chime
let busy = false;             // blocks input during slide+merge animation

const tilesEl = document.getElementById('tiles');

// ── Tile sizing helpers ───────────────────────────────────────────────────────
// Tiles are as wide as the board allows; on tall phones they grow taller to
// fill the screen (up to 1.75× their width), so the board reaches the bottom.
let cachedTileSize = 0, cachedTileH = 0;
function tileSize() {
  if (!cachedTileSize) {
    const w = tilesEl.offsetWidth;
    cachedTileSize = w > 0 ? (w - (SIZE - 1) * GAP) / SIZE : 80;
  }
  return cachedTileSize;
}
function tileH() {
  if (!cachedTileH) {
    const h = tilesEl.offsetHeight;
    cachedTileH = h > 0 ? (h - (SIZE - 1) * GAP) / SIZE : tileSize();
  }
  return cachedTileH;
}
function tileLeft(c) { return c * (tileSize() + GAP); }
function tileTop(r)  { return r * (tileH() + GAP); }

// Stretch the board down to the bottom of the screen (leaving room for the
// "How to play" line); never shorter than square, never taller than 1.75×
function fitBoard() {
  const board = document.getElementById('board'), hint = document.querySelector('.hint');
  const w = board.offsetWidth;
  const tw = (w - 2 * GAP - (SIZE - 1) * GAP) / SIZE;
  const below = (hint ? hint.offsetHeight + 14 : 0) + 22 + (parseFloat(getComputedStyle(document.querySelector('.app')).paddingBottom) || 0);
  const avail = window.innerHeight - board.getBoundingClientRect().top - below;
  const th = Math.max(tw, Math.min(tw * 1.75, (avail - 2 * GAP - (SIZE - 1) * GAP) / SIZE));
  board.style.height = (2 * GAP + SIZE * th + (SIZE - 1) * GAP) + 'px';
}

// ── DOM helpers ───────────────────────────────────────────────────────────────
function tileClass(value) { return 't' + Math.min(value, 8192); }

// Create element and set initial position BEFORE appending to DOM
// (so the CSS left/top transition doesn't fire on first placement)
// Each illustration is shown as an <img>, so the browser rasterises it once
// and reuses the bitmap while tiles slide (live SVG was re-drawn every frame).
const artSrc = {};
// Tall tiles: keep the drawing centred at its normal size and stretch only the
// background (and the bonus tiles' gold frame) to the tile's shape
let artAspect = 1;
function tallArt(svg, aspect) {
  if (aspect <= 1.001) return svg;
  const e = +((100 * aspect - 100) / 2).toFixed(2);
  return svg
    .replace('viewBox="0 0 100 100"', `viewBox="0 ${-e} 100 ${100 + 2 * e}" preserveAspectRatio="none"`)
    .replace(/<rect width="100" height="100"/g, `<rect y="${-e}" width="100" height="${100 + 2 * e}"`)
    .replace(/<rect x="1\.8" y="1\.8" width="96\.4" height="96\.4"/g, `<rect x="1.8" y="${(1.8 - e).toFixed(2)}" width="96.4" height="${(96.4 + 2 * e).toFixed(2)}"`);
}
// When the tile shape changes, redraw the art to match
function syncArtAspect() {
  const aspect = Math.round(tileH() / tileSize() * 100) / 100;
  if (aspect === artAspect) return;
  artAspect = aspect;
  Object.keys(artSrc).forEach(k => delete artSrc[k]);
  liveTiles.forEach(t => applyTileDisplay(t));
}
function artNode(value) {
  if (!artSrc[value]) {
    const svg = TILE_ART[value] || TILE_ART[Math.max(...Object.keys(TILE_ART).map(Number))];
    artSrc[value] = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(tallArt(svg, artAspect));
  }
  const img = new Image();
  img.src = artSrc[value];
  img.alt = '';
  img.draggable = false;
  return img;
}
// Warm the image cache so tiles never pop in blank
Object.keys(TILE_ART).forEach(v => { const i = artNode(v); i.decode && i.decode().catch(() => {}); });

function makeTileEl(value, r, c) {
  const el = document.createElement('div');
  el.className = `tile ${tileClass(value)}`;
  el.dataset.v = value;
  el.appendChild(artNode(value));
  el.style.cssText = `width:${tileSize()}px;height:${tileH()}px;translate:${tileLeft(c)}px ${tileTop(r)}px`;
  return el;
}

function applyTileDisplay(tile) {
  tile.el.className = `tile ${tileClass(tile.value)}`;
  tile.el.dataset.v = tile.value;
  tile.el.replaceChildren(artNode(tile.value));
}

// Position with the compositor-friendly `translate`, not left/top (no layout)
function placeTile(el, r, c) {
  el.style.translate = `${tileLeft(c)}px ${tileTop(r)}px`;
}

function sizeTile(el) {
  el.style.width  = tileSize() + 'px';
  el.style.height = tileH() + 'px';
}

// ── Move computation (pure — does not touch DOM) ───────────────────────────────
//
// Returns { newPos, merges, moved, scoreAdd }
//   newPos  : Map<id, {r,c}> — final grid position for every tile
//   merges  : [{survivorId, removedId, newValue}]
//   moved   : boolean
//   scoreAdd: number

function getRC(dir, pri, sec) {
  switch (dir) {
    case 'left':  return [pri, sec];
    case 'right': return [pri, SIZE - 1 - sec];
    case 'up':    return [sec, pri];
    case 'down':  return [SIZE - 1 - sec, pri];
  }
}

function computeMove(dir) {
  // Build 2D grid of tile refs
  const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(null));
  liveTiles.forEach(t => { g[t.r][t.c] = t; });

  const newPos = new Map();   // id -> {r,c}
  const merges = [];
  let scoreAdd = 0;
  let moved = false;

  for (let pri = 0; pri < SIZE; pri++) {
    // Extract this line in movement direction
    const line = [];
    for (let sec = 0; sec < SIZE; sec++) {
      const [r, c] = getRC(dir, pri, sec);
      line.push(g[r][c]);
    }

    // Slide: compact non-null, then merge adjacent equals
    const arr = line.filter(Boolean);
    const lineMerges = [];
    for (let i = 0; i < arr.length - 1; i++) {
      if (arr[i].value === arr[i + 1].value) {
        lineMerges.push({ survivorId: arr[i].id, removedId: arr[i + 1].id, newValue: arr[i].value * 2 });
        arr.splice(i + 1, 1); // survivor stays in arr, removed is gone
      }
    }
    merges.push(...lineMerges);

    // Map survivors to new grid positions
    arr.forEach((tile, sec) => {
      const [r, c] = getRC(dir, pri, sec);
      newPos.set(tile.id, { r, c });
    });

    // Removed tiles animate to their survivor's destination
    lineMerges.forEach(m => {
      newPos.set(m.removedId, newPos.get(m.survivorId));
      scoreAdd += m.newValue;
    });

    // Detect movement
    line.forEach((tile, sec) => {
      if (!tile) return;
      const [r, c] = getRC(dir, pri, sec);
      const np = newPos.get(tile.id);
      if (np && (np.r !== tile.r || np.c !== tile.c)) moved = true;
    });
  }

  if (merges.length) moved = true;
  return { newPos, merges, moved, scoreAdd };
}

// ── Move execution ────────────────────────────────────────────────────────────
let queuedDir = null;
async function doMove(dir) {
  if (typeof lbIsOpen !== 'undefined' && lbIsOpen) return;   // leaderboard panel is open
  if (typeof howtoOpen !== 'undefined' && howtoOpen) return; // how-to card is open
  if (typeof settingsOpen !== 'undefined' && settingsOpen) return; // settings card is open
  if (busy) { queuedDir = dir; return; }
  const { newPos, merges, moved, scoreAdd } = computeMove(dir);
  if (!moved) return;

  busy = true;
  // Every move gets its theme's slide sound; a merge adds its tap or chime
  // (below) as the tiles land
  soundSlide(dir);

  // ① Slide every tile to its new position (CSS transition animates this)
  const removedIds = new Set(merges.map(m => m.removedId));
  liveTiles.forEach(t => {
    const p = newPos.get(t.id);
    if (!p) return;
    t.r = p.r; t.c = p.c;
    placeTile(t.el, t.r, t.c);
    // Tiles being consumed slide *under* their target
    if (removedIds.has(t.id)) t.el.style.zIndex = '0';
  });

  // ② Wait for slide to finish
  await pause(SLIDE_MS + 5);

  // ③ Apply merges: remove consumed tiles, update survivors, play pop
  merges.forEach(m => {

    const survivor = liveTiles.find(t => t.id === m.survivorId);
    if (survivor) {
      survivor.value = m.newValue;
      applyTileDisplay(survivor);
      survivor.el.style.zIndex = '';
      survivor.el.classList.remove('tile-pop');
      void survivor.el.offsetWidth; // force reflow so animation restarts
      survivor.el.classList.add('tile-pop');
      survivor.el.addEventListener('animationend', () => survivor.el.classList.remove('tile-pop'), { once: true });
    }

    const removed = liveTiles.find(t => t.id === m.removedId);
    if (removed) removed.el.remove();
  });
  liveTiles = liveTiles.filter(t => !removedIds.has(t.id));

  // One merge sound per swipe: a chime for a brand-new fruit, otherwise a soft pop
  if (merges.length) {
    const top = Math.max(...merges.map(m => m.newValue));
    const victoryNext = !celebrationShown && top >= 2048;   // fanfare plays instead
    if (!victoryNext) {
      if (top > highestThisGame && top >= 4) { soundNewFruit(top); haptic('new'); }
      else { soundMerge(top); haptic('merge'); }
    }
    highestThisGame = Math.max(highestThisGame, top);
    if (typeof tutorialMerged === 'function') tutorialMerged(merges);
  }

  // ④ Update score
  if (scoreAdd) updateScore(scoreAdd);

  // ⑤ Spawn new tile in a random empty cell
  spawnTile();

  // ⑥ Win / lose checks
  if (!celebrationShown && liveTiles.some(t => t.value >= 2048)) {
    celebrationShown = true;
    await pause(280);
    showCelebration();
    busy = false;
    queuedDir = null;
    return;
  }
  if (!canMove()) {
    soundGameOver();
    haptic('lose');
    await pause(400);
    showGameOver();
  }

  busy = false;
  if (queuedDir) { const d = queuedDir; queuedDir = null; doMove(d); }
}

// ── Game helpers ──────────────────────────────────────────────────────────────
function canMove() {
  if (liveTiles.length < SIZE * SIZE) return true;
  const g = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  liveTiles.forEach(t => { g[t.r][t.c] = t.value; });
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++) {
      if (c < SIZE - 1 && g[r][c] === g[r][c + 1]) return true;
      if (r < SIZE - 1 && g[r][c] === g[r + 1][c]) return true;
    }
  return false;
}

let spawnOverride = null;   // { value, r, c }, set by the tutorial
function spawnTile() {
  const occupied = new Set(liveTiles.map(t => `${t.r},${t.c}`));
  const empty = [];
  for (let r = 0; r < SIZE; r++)
    for (let c = 0; c < SIZE; c++)
      if (!occupied.has(`${r},${c}`)) empty.push([r, c]);
  if (!empty.length) return;

  // the tutorial can ask for a particular tile in a particular spot, once
  const want = spawnOverride; spawnOverride = null;
  const free = want && empty.some(([er, ec]) => er === want.r && ec === want.c);
  const [r, c] = free ? [want.r, want.c] : empty[Math.floor(Math.random() * empty.length)];
  const value  = want ? want.value : (Math.random() < 0.9 ? 2 : 4);
  const id     = nextId++;
  const el     = makeTileEl(value, r, c);  // position set before append
  tilesEl.appendChild(el);

  // Spring-appear animation starts after layout
  requestAnimationFrame(() => {
    el.classList.add('tile-new');
    el.addEventListener('animationend', () => el.classList.remove('tile-new'), { once: true });
  });

  liveTiles.push({ id, value, r, c, el });
}

// Re-layout all tiles without animation (used on resize)
function relayout() {
  // Phones fire resize events for toolbar changes even when the board stays
  // the same size; only snap tiles into place when the size really changed,
  // otherwise it would cut slide animations short.
  const old = cachedTileSize, oldH = cachedTileH;
  fitBoard();
  cachedTileSize = 0; cachedTileH = 0;
  syncArtAspect();
  if (old && Math.abs(tileSize() - old) < 0.5 && Math.abs(tileH() - oldH) < 0.5) return;
  liveTiles.forEach(t => {
    t.el.classList.add('no-anim');
    sizeTile(t.el);
    placeTile(t.el, t.r, t.c);
  });
  tilesEl.offsetHeight; // force reflow before removing class
  liveTiles.forEach(t => t.el.classList.remove('no-anim'));
}

// ── Score ─────────────────────────────────────────────────────────────────────
// A soft "+4" floating up from a tile; the guided first game uses it to
// teach that matching earns points (normal play stays quiet)
function tilePop(r, c, points) {
  const pop = document.createElement('span');
  pop.className = 'tile-points';
  pop.textContent = '+' + points.toLocaleString();
  pop.style.left = (tileLeft(c) + tileSize() / 2) + 'px';
  pop.style.top = (tileTop(r) + tileH() * 0.42) + 'px';
  tilesEl.appendChild(pop);
  pop.addEventListener('animationend', () => pop.remove(), { once: true });
}
function updateScore(add) {
  score += add;
  const el = document.getElementById('score');
  tweenNumber(el, score);
  el.classList.remove('score-bump');
  void el.offsetWidth;
  el.classList.add('score-bump');
  if (score > best) {
    best = score;
    localStorage.setItem('fruitpicnic.best', best);
    document.getElementById('best').textContent = Number(best).toLocaleString();
  }
}
// Counts a number up to its new value over a third of a second (jumps straight
// there when the phone asks for less motion)
const tweens = new WeakMap();
function tweenNumber(el, to) {
  const from = tweens.get(el)?.value ?? (parseInt(el.textContent.replace(/\D/g, ''), 10) || 0);
  cancelAnimationFrame(tweens.get(el)?.raf);
  if (to <= from || matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = to.toLocaleString(); tweens.set(el, { value: to }); return; }
  const t0 = performance.now(), state = { value: from };
  const tick = now => {
    const k = Math.min(1, (now - t0) / 320), eased = 1 - Math.pow(1 - k, 3);
    state.value = Math.round(from + (to - from) * eased);
    el.textContent = state.value.toLocaleString();
    if (k < 1) state.raf = requestAnimationFrame(tick);
  };
  state.raf = requestAnimationFrame(tick);
  tweens.set(el, state);
}

// ── Overlays ──────────────────────────────────────────────────────────────────
function showCelebration() {
  showStats(document.getElementById('celebration'));
  if (typeof lbShowPost === 'function') lbShowPost(document.getElementById('celebration'));
  soundVictory(); haptic('win'); startConfetti();
  document.getElementById('celebration').classList.add('show');
}
function hideCelebration() {
  stopConfetti();
  document.getElementById('celebration').classList.remove('show');
}
// Name of a tile in the current theme; anything past 2048 keeps the finale's name
function tileName(value) {
  const names = THEME_UI[themeId].tiles;
  return names[Math.min(Math.log2(value) - 1, names.length - 1)];
}
// Fill a card's "top tile" and "score" boxes
function showStats(card) {
  const top = Math.max(...liveTiles.map(t => t.value));
  const $ = k => card.querySelector(`[data-stat="${k}"]`);
  $('tile-art').src = svgURL(TILE_ART[top] || TILE_ART[Math.max(...Object.keys(TILE_ART).map(Number))]);
  $('tile').textContent = tileName(top);
  $('score').textContent = score.toLocaleString();
}
function showGameOver() {
  showStats(document.getElementById('gameover'));
  if (typeof lbShowPost === 'function') lbShowPost(document.getElementById('gameover'));
  document.getElementById('gameover').classList.add('show');
}
function hideGameOver() { document.getElementById('gameover').classList.remove('show'); }

// ── New game ──────────────────────────────────────────────────────────────────
function newGame() {
  hideCelebration(); hideGameOver();
  if (typeof tutorialHide === 'function') tutorialHide();
  liveTiles.forEach(t => t.el.remove());
  liveTiles = [];
  score = 0; celebrationShown = false; busy = false; queuedDir = null; highestThisGame = 0;
  document.getElementById('score').textContent = '0';
  document.getElementById('best').textContent = best;
  spawnTile(); spawnTile();
}

// ── Input ─────────────────────────────────────────────────────────────────────
const KEY_MAP = {
  ArrowLeft:'left', ArrowRight:'right', ArrowUp:'up', ArrowDown:'down',
  a:'left', d:'right', w:'up', s:'down',
};
document.addEventListener('keydown', e => {
  if (e.target.closest && e.target.closest('input, textarea')) return;   // typing a name
  const dir = KEY_MAP[e.key];
  if (dir) { e.preventDefault(); doMove(dir); }
});

// Swipe fires as soon as the finger has travelled far enough (not on release)
const SWIPE_PX = 24;
let tx = 0, ty = 0, swiped = false;
document.addEventListener('touchstart', e => {
  if (!e.touches.length) return;
  tx = e.touches[0].clientX; ty = e.touches[0].clientY; swiped = false;
}, { passive: true });
document.addEventListener('touchmove', e => {
  if (swiped) return;
  const dx = e.touches[0].clientX - tx;
  const dy = e.touches[0].clientY - ty;
  if (Math.max(Math.abs(dx), Math.abs(dy)) < SWIPE_PX) return;
  swiped = true;
  if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 'right' : 'left');
  else                             doMove(dy > 0 ? 'down'  : 'up');
}, { passive: true });

// ── Buttons ───────────────────────────────────────────────────────────────────
document.getElementById('newGameBtn').addEventListener('click', newGame);
document.getElementById('soundToggle').addEventListener('click', () => {
  soundOn = !soundOn;
  if (soundOn) unlockAudio();
  showSoundIcon();
  try { localStorage.setItem('fruitpicnic.sound', soundOn ? 'on' : 'off'); } catch (_) {}
});
document.getElementById('hapticsToggle').addEventListener('click', () => {
  hapticsOn = !hapticsOn;
  showHapticsIcon();
  haptic('merge');
  try { localStorage.setItem('fruitpicnic.haptics', hapticsOn ? 'on' : 'off'); } catch (_) {}
});
document.getElementById('keepGoingBtn').addEventListener('click', hideCelebration);
document.getElementById('celebNewGameBtn').addEventListener('click', newGame);
document.getElementById('gameoverNewGameBtn').addEventListener('click', newGame);

window.addEventListener('resize', relayout);

// Nothing in the game is meant to be selected: stop long-press selection and
// the long-press menu from popping up when a finger rests before swiping
document.addEventListener('selectstart', e => e.preventDefault());
document.addEventListener('contextmenu', e => e.preventDefault());
// iPhone browsers (Safari, Firefox) can still select text from a long-press or
// double-tap. Telling the browser to ignore the touch itself stops that; swipes
// are still read from touchmove, and buttons are left alone so taps work.
document.addEventListener('touchstart', e => {
  if (!e.target.closest('button, a, input, label, .leaderboard-content, .gameover-content, .celebration-content, .steps')) e.preventDefault();
}, { passive: false });

// ── Themes ────────────────────────────────────────────────────────────────────
// Everything that changes with the theme. The board, score and game carry on
// when you switch: the same tiles just show the other theme's art.
const svgURL = svg => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
const THEME_UI = {
  fruit: {
    title: 'Fruit Picnic', win: 'Sweet victory!', winLine: 'You made a watermelon!', lose: 'Picnic’s over!',
    winArt: () => picnicBasketSVG(false, { blanket: true }), winAlt: 'A picnic basket full of fruit',
    loseArt: () => picnicBasketSVG(false, { empty: true, blanket: true, ants: true }), loseAlt: 'An empty picnic basket',
    confetti: ['#FF85C2', '#CF91F0', '#80D5E0', '#FFE05A', '#B5E48C', '#FF99C8', '#A8DADC'],
    tiles: ['Cherries', 'Strawberry', 'Grapes', 'Lemon', 'Orange', 'Apple', 'Peach', 'Pear', 'Pineapple', 'Melon', 'Watermelon',
      'Picnic basket', 'Fruit tart', 'Celebration cake'],
    color: '#FFF8EC', next: 'halloween',
  },
  halloween: {
    title: 'Spooky Picnic', win: 'Spooktacular!', winLine: 'You reached the haunted house!', lose: 'Out of treats!',
    winArt: () => candyBucketSVG({}), winAlt: 'A candy bucket full of sweets',
    loseArt: () => candyBucketSVG({ empty: true, spider: true }), loseAlt: 'An empty candy bucket with a little spider',
    confetti: ['#FF8A2A', '#FFB870', '#8E6CD8', '#B9A2E8', '#7ED36E', '#C8F59A', '#FFF3B0'],
    tiles: ['Candy corn', 'Hard candy', 'Lollipop', 'Candy bucket', 'Spider', 'Potion', 'Witch hat', 'Cauldron', 'Ghost', 'Jack-o’-lantern', 'Haunted house',
      'Witchy cat', 'Sleepy moon', 'Wise owl'],
    color: '#1E1533', next: 'fruit',
  },
};
// Cocoa Night: Fruit Picnic after dark. Same fruit, words and sounds; only the
// colours change (style.css) and the tiles sit on deeper backgrounds (tiles.js).
THEME_UI.night = Object.assign({}, THEME_UI.fruit, { label: 'Cocoa Night', color: '#2A1B17' });
// The order the themes appear in Settings
const THEME_ORDER = ['fruit', 'night', 'halloween'];
// A chunky six-tooth gear; the hole shows the button's own colour
const GEAR_ICON = ICON_OPEN
  + '<path fill="#FFFDF8" d="M9.7 4.8L10.2 2L13.8 2L14.3 4.8L17.1 6.4L19.8 5.4L21.6 8.5L19.4 10.4L19.4 13.6L21.6 15.5L19.8 18.6L17.1 17.6L14.3 19.2L13.8 22L10.2 22L9.7 19.2L6.9 17.6L4.2 18.6L2.4 15.5L4.6 13.6L4.6 10.4L2.4 8.5L4.2 5.4L6.9 6.4z"/>'
  + '<circle cx="12" cy="12" r="3.2" fill="var(--b)"/></svg>';
document.getElementById('settingsBtn').innerHTML = GEAR_ICON;
const TROPHY_ICON = ICON_OPEN
  + '<path fill="#FFFDF8" d="M7.5 4.5h9v4.3a4.5 4.5 0 0 1-9 0z"/>'
  + '<path d="M7.5 6.2H5.1c0 2.4 1.1 3.8 3 4.1M16.5 6.2h2.4c0 2.4-1.1 3.8-3 4.1M12 13.3v3"/>'
  + '<path fill="#FFFDF8" d="M8.8 16.3h6.4v3.4H8.8z"/></svg>';
document.getElementById('boardBtn').innerHTML = TROPHY_ICON;

function applyTheme(id) {
  themeId = id;
  const ui = THEME_UI[id];
  TILE_ART = THEMES[id].art;
  document.documentElement.dataset.skin = id;
  document.querySelector('h1').textContent = ui.title;
  document.title = ui.title;
  document.querySelector('#celebration h2').textContent = ui.win;
  document.querySelector('#celebration .win-line').textContent = ui.winLine;
  document.querySelector('#gameover h2').textContent = ui.lose;
  const winArt = document.getElementById('winArt'), loseArt = document.getElementById('gameoverArt');
  winArt.src = svgURL(ui.winArt()); winArt.alt = ui.winAlt;
  loseArt.src = svgURL(ui.loseArt()); loseArt.alt = ui.loseAlt;
  CC.splice(0, CC.length, ...ui.confetti);
  const meta = document.querySelector('meta[name="theme-color"]');
  if (meta) meta.setAttribute('content', ui.color);
  const bar = nativePlugin('StatusBar');
  if (bar) bar.setStyle({ style: id === 'fruit' ? 'LIGHT' : 'DARK' }).catch(() => {});
  // swap tile art: forget the old pictures, pre-load the new ones, redraw the board
  Object.keys(artSrc).forEach(k => delete artSrc[k]);
  Object.keys(TILE_ART).forEach(v => { const i = artNode(v); i.decode && i.decode().catch(() => {}); });
  liveTiles.forEach(t => applyTileDisplay(t));
  document.querySelectorAll('.theme-opt').forEach(b => b.setAttribute('aria-checked', b.dataset.theme === id));
  try { localStorage.setItem('fruitpicnic.theme', id); } catch (_) {}
  if (typeof tutorialRefresh === 'function') tutorialRefresh();
}

// ── Settings card ─────────────────────────────────────────────────────────────
// Sound, vibration and theme all live behind the gear button.
// Each theme is shown with its 2048 tile, so you can see what you're picking.
const themePick = document.getElementById('themePick');
themePick.setAttribute('role', 'radiogroup');
themePick.setAttribute('aria-label', 'Theme');
THEME_ORDER.forEach(id => {
  const b = document.createElement('button');
  b.type = 'button';
  b.className = 'theme-opt';
  b.dataset.theme = id;
  b.setAttribute('role', 'radio');
  b.innerHTML = `<img alt="" src="${svgURL(THEMES[id].art[2048])}"><span>${THEME_UI[id].label || THEME_UI[id].title}</span>`;
  b.addEventListener('click', () => { if (themeId !== id) applyTheme(id); });
  themePick.appendChild(b);
});
let settingsOpen = false;
function openSettings() {
  settingsOpen = true;
  document.getElementById('settings').classList.add('show');
}
function closeSettings() {
  settingsOpen = false;
  document.getElementById('settings').classList.remove('show');
}
document.getElementById('settingsBtn').addEventListener('click', openSettings);
document.getElementById('settingsClose').addEventListener('click', closeSettings);
// Tapping the dimmed space around the card closes it too
document.getElementById('settings').addEventListener('click', e => { if (e.target.id === 'settings') closeSettings(); });
document.addEventListener('keydown', e => { if (settingsOpen && e.key === 'Escape') closeSettings(); });

// ── Start ─────────────────────────────────────────────────────────────────────
document.getElementById('best').textContent = Number(best).toLocaleString();
fitBoard();
syncArtAspect();
applyTheme(themeId);
// the header can change height once the fonts finish loading
if (document.fonts) document.fonts.ready.then(relayout);
window.addEventListener('load', relayout);
showSoundIcon();
if (native) { document.getElementById('hapticsToggle').hidden = false; showHapticsIcon(); }
newGame();

// Test shortcut: open the game with #almost-win at the end of the link to
// start one swipe (left) away from the watermelon, to try the win screen.
function setUpAlmostWin() {
  newGame();
  liveTiles.forEach(t => t.el.remove());
  liveTiles = [];
  [[0, 0, 1024], [0, 1, 1024], [1, 0, 512], [1, 1, 256], [2, 0, 32], [3, 3, 2]].forEach(([r, c, value]) => {
    const el = makeTileEl(value, r, c);
    tilesEl.appendChild(el);
    liveTiles.push({ id: nextId++, value, r, c, el });
  });
  highestThisGame = 1024;
}
if (location.hash === '#almost-win') setUpAlmostWin();
window.addEventListener('hashchange', () => { if (location.hash === '#almost-win') setUpAlmostWin(); });

// Installable app: keep a copy on the phone so it works offline
// (not needed in the iPhone app, which already has everything built in)
if (!native && 'serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('sw.js').catch(() => {});
}

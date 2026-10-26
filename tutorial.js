'use strict';
// ── How to play ───────────────────────────────────────────────────────────────
// A gentle guided first game, then normal quiet play:
//  1. Two cherries and a little hand: "Swipe to match the cherries!" Matching
//     shows a soft "+4": "Matching makes a bigger fruit, and earns points!"
//  2. A second strawberry appears: "Now match the strawberries!" → "+8":
//     "Bigger fruits earn more points."
//  3. A mystery "?" tile: "Keep matching to discover what comes next!"
// The fruit ladder is never shown, so every new fruit is a surprise.
// The "How to play" link under the board opens a card with the same ideas.
// Add ?tutorial to the link to replay it.

const TUTORIAL_WORDS = {
  fruit: { pair1: 'cherries', pair2: 'strawberries', one: 'fruit' },
  halloween: { pair1: 'candy corns', pair2: 'hard candies', one: 'treat' },
};
const HAND_SVG = '<svg viewBox="0 0 40 44" aria-hidden="true"><path d="M14 30V9.5a3 3 0 0 1 6 0V21l1.6-.6a3 3 0 0 1 4 2.3l.4-.1a3 3 0 0 1 3.9 2.4l.3-.1a3 3 0 0 1 3.8 2.6V33c0 5.5-4.2 9.5-9.6 9.5h-2.2c-3.4 0-5.6-1.5-7.3-4l-4.4-6.6a2.6 2.6 0 0 1 4-3.3z" fill="#FFFDF8" stroke="#6B3F6E" stroke-width="2" stroke-linejoin="round"/>'
  + '<path d="M20 21v6M25.6 22.6v5M29.9 25v4" stroke="#6B3F6E" stroke-width="1.6" stroke-linecap="round"/></svg>';
const REPLAY_TUTORIAL = new URLSearchParams(location.search).has('tutorial');

// Done once they've finished it, or if they'd played before it existed
const tutorialDone = () => {
  if (REPLAY_TUTORIAL && tutorialStage > 0) return false;
  try { return localStorage.getItem('fruitpicnic.tutorial') === 'done' || +(localStorage.getItem('fruitpicnic.best') || 0) > 0; }
  catch (_) { return true; }
};
let coachEl = null, tutorialStage = 0, tutorialTimers = [];   // stage 1: cherries, 2: strawberries, 3: discover
const later = (ms, fn) => tutorialTimers.push(setTimeout(fn, ms));

function tutorialStart() {
  // two lone matching tiles in the second row, with a gap between them
  liveTiles.forEach(t => t.el.remove());
  liveTiles = [];
  [[1, 0], [1, 2]].forEach(([r, c]) => {
    const el = makeTileEl(2, r, c);
    tilesEl.appendChild(el);
    liveTiles.push({ id: nextId++, value: 2, r, c, el });
  });
  coachEl = document.createElement('div');
  coachEl.className = 'coach';
  coachEl.innerHTML = '<div class="coach-bubble"></div><div class="coach-trail"></div><div class="coach-hand">' + HAND_SVG + '</div>';
  document.getElementById('board').appendChild(coachEl);
  tutorialStage = 1;
  tutorialRefresh();
}
function coachSay(html, showHand) {
  if (!coachEl) return;
  const bubble = coachEl.querySelector('.coach-bubble');
  bubble.innerHTML = html;
  bubble.classList.remove('coach-new'); void bubble.offsetWidth; bubble.classList.add('coach-new');
  coachEl.classList.toggle('no-hand', !showHand);
}
// Called by applyTheme so the words match the theme
function tutorialRefresh() {
  const w = TUTORIAL_WORDS[themeId];
  if (tutorialStage === 1) coachSay(`Swipe <b>←</b> to match the ${w.pair1}!`, true);
  if (tutorialStage === 2) coachSay(`Now match the ${w.pair2}!`, true);
}
// Called by newGame: a fresh random board no longer matches the hint
function tutorialHide() {
  tutorialTimers.forEach(clearTimeout); tutorialTimers = [];
  if (coachEl) { coachEl.remove(); coachEl = null; }
  tutorialStage = 0;
  document.querySelector('.score-box')?.classList.remove('score-glow');
}
function glowScore() {
  const box = document.querySelector('.score-box');
  box.classList.remove('score-glow'); void box.offsetWidth; box.classList.add('score-glow');
}
function tutorialFinish() {
  try { localStorage.setItem('fruitpicnic.tutorial', 'done'); } catch (_) {}
  tutorialTimers.forEach(clearTimeout); tutorialTimers = [];
  if (coachEl) { const el = coachEl; coachEl = null; el.classList.add('coach-out'); setTimeout(() => el.remove(), 400); }
  tutorialStage = 0;
}
// Called by doMove whenever tiles merge
function tutorialMerged(merges = []) {
  if (!tutorialStage) return;
  const made = v => merges.find(m => m.newValue === v);
  const popAt = m => { const t = liveTiles.find(x => x.id === m.survivorId); if (t) tilePop(t.r, t.c, m.newValue); };
  if (tutorialStage === 1 && made(4)) {
    tutorialStage = 1.5;
    popAt(made(4)); glowScore();
    coachSay(`Matching makes a bigger ${TUTORIAL_WORDS[themeId].one}, and earns points!`, false);
    spawnOverride = { value: 4, r: 1, c: 3 };          // a second one to match next
    later(2600, () => { tutorialStage = 2; tutorialRefresh(); });
  } else if ((tutorialStage === 2 || tutorialStage === 1.5) && made(8)) {
    tutorialTimers.forEach(clearTimeout); tutorialTimers = [];
    tutorialStage = 3;
    try { localStorage.setItem('fruitpicnic.tutorial', 'done'); } catch (_) {}
    popAt(made(8)); glowScore();
    coachSay(`Bigger ${TUTORIAL_WORDS[themeId].one}s earn more points!`, false);
    later(2600, () => coachSay(`<span class="coach-q">?</span>Keep matching to discover what comes next!`, false));
    later(6200, tutorialFinish);
  }
}

// ── The "How to play" card ──
let howtoOpen = false;
function openHowTo() {
  const u = v => svgURL(TILE_ART[v]);
  document.getElementById('howtoSteps').innerHTML = `
    <div class="step"><span class="num">1</span><div class="txt"><b>Swipe</b> up, down, left or right (or use the arrow keys). Every tile slides that way.<div class="swipe-pic" aria-hidden="true">← ↑ ↓ →</div></div></div>
    <div class="step"><span class="num">2</span><div class="txt"><b>Match two of the same</b> and they join into the next one. Bigger ${TUTORIAL_WORDS[themeId].one}s earn more points.<div class="pics"><img alt="" src="${u(2)}">+<img alt="" src="${u(2)}">=<img alt="" src="${u(4)}"></div></div></div>
    <div class="step"><span class="num">3</span><div class="txt"><b>Keep matching to discover what comes next!</b> If the board fills up with no matches, the game is over.<div class="pics"><span class="mystery-tile" aria-hidden="true">?</span></div></div></div>`;
  howtoOpen = true;
  document.getElementById('howto').classList.add('show');
}
function closeHowTo() {
  howtoOpen = false;
  document.getElementById('howto').classList.remove('show');
}
document.getElementById('howtoBtn').addEventListener('click', openHowTo);
document.getElementById('howtoClose').addEventListener('click', closeHowTo);

if ((REPLAY_TUTORIAL || !tutorialDone()) && location.hash !== '#almost-win') tutorialStart();

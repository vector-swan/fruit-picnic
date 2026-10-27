'use strict';
// ── Friends leaderboard (Supabase) ────────────────────────────────────────────
// Each phone gets a private random id and a name the player picks once. When a
// game ends, the player ticks which boards to post to (Everyone and/or their
// groups, remembered from last time) and the score is sent to Supabase, which
// keeps each player's best on the Everyone board and, separately, in each group
// (counting only games since they joined it). The trophy button shows the boards and the
// player's groups. Players can hide or report other players' names. If the
// settings below are empty, the whole feature stays hidden. The key here is
// Supabase's public "anon" / "publishable" key, which is safe to put in the
// game; the database only lets it call the functions in supabase/leaderboard.sql,
// which check names and keep the private player ids private.

const LEADERBOARD = {
  url: 'https://pjdtvgvmatpqbfefjqgw.supabase.co',
  key: 'sb_publishable_s9KpoAR__MoJhkbz8sCM8g_Cwma0nS_',
};
const LB_SIZE = 15;
// In the iPhone app a link to another page would replace the game, so links
// (the privacy policy, group invites) point at the website instead
const IN_APP = location.protocol === 'capacitor:';
const SITE_URL = IN_APP ? 'https://fruitpicnic.io/' : location.origin + location.pathname.replace(/index\.html$/, '');
const PRIVACY_URL = IN_APP ? 'https://fruitpicnic.io/privacy.html' : 'privacy.html';
document.querySelectorAll('.privacy-link').forEach(a => { a.href = PRIVACY_URL; });

const lbOn = !!(LEADERBOARD.url && LEADERBOARD.key);
const lbStore = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} },
  json(k, fallback) { try { return JSON.parse(this.get(k)) ?? fallback; } catch (_) { return fallback; } },
};
function lbPlayerId() {
  let id = lbStore.get('fruitpicnic.lbId');
  if (!id) {
    id = (crypto.randomUUID && crypto.randomUUID())
      || 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, ch => {
        const r = Math.random() * 16 | 0;
        return (ch === 'x' ? r : (r & 3) | 8).toString(16);
      });
    lbStore.set('fruitpicnic.lbId', id);
  }
  return id;
}
const lbName = () => lbStore.get('fruitpicnic.lbName') || '';
// Groups this phone is in ({ code, name, players, place, started_by }), kept
// here so the list shows up straight away
const lbGroups = () => lbStore.json('fruitpicnic.lbGroups', []);
const lbSetGroups = groups => lbStore.set('fruitpicnic.lbGroups', JSON.stringify(groups));
// Players this phone chose to hide (their public ids)
const lbHidden = () => new Set(lbStore.json('fruitpicnic.lbHidden', []));
const lbSetHidden = set => lbStore.set('fruitpicnic.lbHidden', set.size ? JSON.stringify([...set]) : null);

function lbHeaders() {
  const h = { apikey: LEADERBOARD.key, 'Content-Type': 'application/json' };
  // Older "anon" keys are JWTs and also go in Authorization; newer publishable keys don't
  if (LEADERBOARD.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + LEADERBOARD.key;
  return h;
}
// Calls one of the functions in supabase/leaderboard.sql. A refusal from the
// database (like "name_not_allowed") comes back as the error's message.
async function lbRpc(fn, args) {
  const res = await fetch(`${LEADERBOARD.url}/rest/v1/rpc/${fn}`, {
    method: 'POST', headers: lbHeaders(), body: JSON.stringify(args),
  });
  if (!res.ok) {
    const body = await res.json().catch(() => null);
    throw new Error((body && body.message) || `${fn} ${res.status}`);
  }
  const text = await res.text();   // empty for functions that return nothing
  return text ? JSON.parse(text) : null;
}
const lbFetchTop = () => lbRpc('leaderboard', { p_player: lbPlayerId(), p_code: null, p_limit: LB_SIZE, p_with_me: true });
const lbFetchGroup = code => lbRpc('group_board', { p_player: lbPlayerId(), p_code: code });
const lbPostScore = entry => lbRpc('post_score', {
  p_player: lbPlayerId(), p_name: entry.name, p_score: entry.score, p_tile: entry.tile,
  p_everyone: entry.everyone !== false, p_groups: entry.groups || [],
});
const lbSavePlayer = () => lbRpc('save_player', { p_player: lbPlayerId(), p_name: lbName(), p_groups_only: null });
const lbRemove = () => lbRpc('remove_score', { p_player: lbPlayerId() });

// ── Names ──
// Letters, numbers, spaces and . - _ ' only. The word filter lives in the
// database (so it can't be skipped); checkName asks it before saving.
const NAME_CHARS = /^[\p{L}\p{N} .'_-]+$/u;
const tidyName = s => (s || '').trim().replace(/\s+/g, ' ');
// Returns '' if the name is fine, otherwise what to tell the player
async function lbNameProblem(name, max = 20) {
  if (name.length < 2) return 'Names need at least 2 letters.';
  if (name.length > max) return `Names can be up to ${max} letters.`;
  if (!NAME_CHARS.test(name)) return 'Use letters, numbers and spaces only.';
  try {
    if (!(await lbRpc('check_name', { p_name: name }))) return 'Let’s pick a different name';
  } catch (_) { /* offline: the database checks it again when the score is sent */ }
  return '';
}
// Names and group names are put into the page as text, never as markup
const lbEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lbNum = n => Number(n).toLocaleString();
const lbPlayers = n => n === 1 ? '1 player' : `${n} players`;
// The game's own trophy (the same drawing as the trophy button, from game.js),
// in a small badge, so the leaderboard never falls back to an emoji
const lbTrophy = (size = '') => `<span class="lb-trophy${size ? ' lb-trophy-' + size : ''}" aria-hidden="true">${TROPHY_ICON}</span>`;

// The name box for players who haven't picked a name yet. It sits in its own
// "About you" box so it doesn't read as another question about the group.
const lbFirstTimeFields = id => lbName() ? '' : `<div class="lb-you"><span class="lb-you-h">About you</span>`
  + `<label class="lb-label" for="${id}Name">Username</label>`
  + `<input class="lb-input" id="${id}Name" maxlength="20" placeholder="vectorswan" autocomplete="nickname" autocapitalize="off" enterkeyhint="done"></div>`;
// Checks and saves that box. Returns '' when done, otherwise the problem.
async function lbSaveFirstTime(root, id) {
  if (lbName()) return '';
  const name = tidyName(root.querySelector(`#${id}Name`).value);
  const why = await lbNameProblem(name);
  if (why) return why;
  lbStore.set('fruitpicnic.lbName', name);
  try { await lbSavePlayer(); }
  catch (e) {
    lbStore.set('fruitpicnic.lbName', null);
    return e.message === 'name_not_allowed' ? 'Let’s pick a different name' : LB_OFFLINE;
  }
  return '';
}
const LB_OFFLINE = 'Couldn’t connect. Try again.';

// Where finished games get posted: the boards ticked last time. Kept as what was
// left unticked, so a group joined later starts out ticked.
const lbPostTo = () => lbStore.json('fruitpicnic.lbPostTo', { everyone: true, skip: [] });
const lbSetPostTo = to => lbStore.set('fruitpicnic.lbPostTo', JSON.stringify(to));

// Finished games wait here until they're sent, so scores made offline aren't
// lost. Each one remembers which boards it was posted to.
function lbPending() {
  const p = lbStore.json('fruitpicnic.lbPending', []);
  return Array.isArray(p) ? p : [p];   // older versions kept a single game
}
const lbSetPending = queue => lbStore.set('fruitpicnic.lbPending', queue.length ? JSON.stringify(queue) : null);
function lbQueue(entry) { lbSetPending([...lbPending(), entry].slice(-20)); }
// Sends the waiting games, oldest first, and returns where the last one landed
async function lbFlush() {
  let result = null;
  for (let tries = 0; tries < 20; tries++) {
    const entry = lbPending()[0];
    if (!entry) break;
    try {
      result = await lbPostScore(entry);
    } catch (e) {
      // The database turned the name down: forget it so the player picks a new
      // one next time, instead of failing over and over
      if (e.message === 'name_not_allowed') {
        lbSetPending(lbPending().filter(x => x.name !== entry.name));
        if (lbName() === entry.name) lbStore.set('fruitpicnic.lbName', null);
      }
      throw e;
    }
    // take it off the front, unless another send already did
    const queue = lbPending();
    if (queue.length && JSON.stringify(queue[0]) === JSON.stringify(entry)) queue.shift();
    lbSetPending(queue);
  }
  if (result) lbRefreshGroups();
  return result;
}

// ── The "post" row on the win / game-over cards ──
// Everyone and each of the player's groups with a tick box (remembered from last
// time) and a Post score button, plus a name box the first time. After posting,
// the card shows where the score landed on each board.
function lbCardRow(card) { return card.querySelector('.lb-post'); }
// While Post score is showing it's the card's main button, so the card's own
// buttons step back
const lbDemote = (row, on) => row.closest('.celebration, .gameover')
  .querySelectorAll('.btn-big').forEach(b => b.classList.toggle('btn-quiet', on));
function lbShowPost(card) {
  const row = lbCardRow(card);
  if (!lbOn || !row || score <= 0) { if (row) { row.hidden = true; lbDemote(row, false); } return; }
  row.hidden = false;
  row.dataset.score = score;
  row.dataset.tile = Math.max(...liveTiles.map(t => t.value));
  lbAsk(row);
}
function lbAsk(row, problem = '') {
  const to = lbPostTo();
  const box = (value, label, on) => `<label class="lb-check"><input type="checkbox" value="${lbEsc(value)}"${on ? ' checked' : ''}><span>${lbEsc(label)}</span></label>`;
  row.innerHTML = '<form class="lb-post-form">'
    + (lbName() ? '' : '<input class="lb-input" maxlength="20" placeholder="Username" aria-label="Username for the leaderboard" autocomplete="nickname" enterkeyhint="done">')
    + '<span class="lb-label" id="lbPostToLabel">Post to</span><div class="lb-checks" role="group" aria-labelledby="lbPostToLabel">'
    + box('everyone', 'Everyone', to.everyone !== false)
    + lbGroups().map(g => box(g.code, g.name, !(to.skip || []).includes(g.code))).join('')
    + '</div><p class="lb-note lb-problem" role="alert" hidden></p>'
    + `<button class="btn lb-wide lb-icon-btn" type="submit">${lbTrophy('sm')}Post score</button></form>`
    + (lbName() ? '' : `<p class="lb-note">Shown to other players · <a class="lb-link" href="${PRIVACY_URL}" target="_blank" rel="noopener">Privacy</a></p>`);
  lbDemote(row, true);
  const form = row.querySelector('form'), note = row.querySelector('.lb-problem');
  const say = text => { note.textContent = text; note.hidden = !text; };
  say(problem);
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const ticks = [...form.querySelectorAll('.lb-check input')];
    const everyone = ticks[0].checked, groups = ticks.slice(1).filter(t => t.checked).map(t => t.value);
    if (!everyone && !groups.length) { say('Tick a board to post to.'); return; }
    const input = form.querySelector('.lb-input');
    if (input) {
      const name = tidyName(input.value);
      if (!name) { input.focus(); return; }
      const save = form.querySelector('button');
      save.disabled = true;
      const why = await lbNameProblem(name);
      save.disabled = false;
      if (why) { say(why); input.focus(); return; }
      lbStore.set('fruitpicnic.lbName', name);
      input.blur();
    }
    lbSetPostTo({ everyone, skip: ticks.slice(1).filter(t => !t.checked).map(t => t.value) });
    lbQueue({ name: lbName(), score: +row.dataset.score, tile: +row.dataset.tile, everyone, groups });
    lbPost(row);
  });
}
async function lbPost(row) {
  row.innerHTML = '<p class="lb-note">Posting…</p>';
  let result;
  try {
    result = await lbFlush();
  } catch (e) {
    if (e.message === 'name_not_allowed') { lbAsk(row, 'Let’s pick a different name'); return; }
    row.innerHTML = '<p class="lb-note">Offline. It’ll post when you’re back.</p>';
    lbDemote(row, false);
    return;
  }
  // Each board this score went to, with its place there
  const places = [];
  if (result && result.everyone) places.push({ label: 'Everyone', place: `#${lbNum(result.everyone)}`, best: result.everyone_best });
  ((result && result.groups) || []).forEach(g => places.push({
    label: g.name, place: g.place ? `#${g.place} of ${g.players}` : '–', best: g.best, group: g.code,
  }));
  const shown = places.slice(0, 4);
  row.innerHTML = `<p class="lb-note lb-posted">${lbTrophy('sm')}<span>Posted as <b></b></span></p>`
    + (shown.length ? `<ul class="lb-places">${shown.map((p, i) => `<li><button class="lb-place" type="button" data-i="${i}">`
      + `<span class="lb-place-name">${lbEsc(p.label)}${p.best ? '<span class="lb-tag">New best</span>' : ''}</span><b>${p.place} ›</b></button></li>`).join('')}</ul>`
      : '<button class="lb-link" type="button" data-see>See leaderboard</button>')
    + (places.length > shown.length ? `<p class="lb-note">and ${places.length - shown.length} more</p>` : '')
    + (lbGroups().length ? '' : '<button class="lb-link" type="button" data-start>Start a group with friends</button>');
  row.querySelector('b').textContent = lbName();
  row.querySelectorAll('.lb-place').forEach(b => b.addEventListener('click', () => {
    const p = shown[+b.dataset.i];
    if (p.group) lbOpen('group', p.group); else lbOpen('everyone');
  }));
  row.querySelector('[data-see]')?.addEventListener('click', () => lbOpen());
  row.querySelector('[data-start]')?.addEventListener('click', () => lbOpen('new'));
  lbDemote(row, false);
}

// ── The leaderboard panel ──
// One panel with a few views: the Everyone board, the list of your groups, one
// group's board, and the small steps for starting, joining, sharing or leaving
// a group and for changing your name or where your scores show.
let lbIsOpen = false;
let lbView = 'everyone';   // everyone, groups, group, new, ready, invite, leave, code, join, me, remove
let lbTab = 'everyone';    // Everyone or My groups, for going back from Your leaderboard
let lbGroupCode = null;    // the group being looked at
let lbJoining = null;      // a group found from an invite link or code, before joining
let lbMsg = '';            // a problem to show on the current view
// Each load gets a number, and only the newest one may fill the list. Without
// this, opening the board again while it's still loading (for example after
// changing your name, especially in Safari, which pauses loading while the
// name box is up) showed every score twice.
let lbLoad = 0;
const $lb = id => document.getElementById(id);
const lbGroup = () => lbGroups().find(g => g.code === lbGroupCode);
const lbInviteURL = g => `${SITE_URL}?join=${encodeURIComponent(g.code)}`;
const LB_TINTS = ['#FFD36B', '#FFB0C0', '#C9E8A8', '#CFE3FB', '#E3D4FA', '#FFCB80'];
const lbBack = (view, label) => `<button class="lb-back" type="button" data-view="${view}">‹ ${label}</button>`;
const lbProblem = () => lbMsg ? `<p class="lb-note lb-problem" role="alert">${lbEsc(lbMsg)}</p>` : '';

const LB_VIEWS = {
  everyone() {
    const note = lbName() ? '' : '<p class="lb-note lb-banner">Post a score to join the board.</p>';
    return lbSeg() + note + '<ol class="lb-list" id="lbList"></ol><p class="lb-note" id="lbStatus" role="status">Loading…</p>'
      + '<p class="lb-note" id="lbShowHidden" hidden><button class="lb-link" type="button" data-act="unhide"></button></p>';
  },
  groups() {
    const groups = lbGroups();
    const cards = groups.map((g, i) => `<button class="lb-gcard" type="button" data-group="${lbEsc(g.code)}">`
      + `<span class="lb-gicon" style="background:${LB_TINTS[i % LB_TINTS.length]}" aria-hidden="true">${lbEsc((g.name || '?')[0].toUpperCase())}</span>`
      + `<span class="lb-gtext"><b>${lbEsc(g.name)}</b><small>${g.players ? lbPlayers(g.players) : 'Group'}</small></span>`
      + `<span class="lb-gplace">${g.place ? `<b>#${g.place}</b>of ${g.players}` : 'No score<br>yet'}</span></button>`).join('');
    return lbSeg()
      + (groups.length ? `<div class="lb-gcards">${cards}</div>`
        : '<p class="lb-note lb-empty"><b>No groups yet</b>Private boards for friends and family.</p>')
      + '<p class="lb-note">Have a code? <button class="lb-link" type="button" data-view="code">Join a group</button></p>';
  },
  group() {
    const g = lbGroup();
    if (!g) return LB_VIEWS.groups();
    const meta = [g.players && lbPlayers(g.players), g.started_by && `started by ${lbEsc(g.started_by)}`].filter(Boolean).join(' · ');
    return lbBack('groups', 'My groups')
      + `<h3 class="lb-h">${lbEsc(g.name)}</h3>${meta ? `<p class="lb-note">${meta}</p>` : ''}`
      + '<ol class="lb-list" id="lbList"></ol><p class="lb-note" id="lbStatus" role="status">Loading…</p>'
      + '<p class="lb-note" id="lbShowHidden" hidden><button class="lb-link" type="button" data-act="unhide"></button></p>'
      + '<button class="lb-link lb-quiet" type="button" data-view="leave">Leave group</button>';
  },
  new() {
    return lbBack('groups', 'My groups') + '<h3 class="lb-h">New group</h3>'
      + '<form class="lb-stack" data-form="new"><label class="lb-label" for="lbNewName">Group name</label>'
      + '<input class="lb-input" id="lbNewName" maxlength="24" placeholder="Laughing Lizard" autocomplete="off" enterkeyhint="done">'
      + lbFirstTimeFields('lbNewMe') + lbProblem()
      + '<p class="lb-note">Scores count from today.</p>'
      + '<button class="btn btn-big lb-wide" type="submit">Create group</button></form>';
  },
  ready() { return lbShareView('Your group is ready!', true); },
  invite() { return lbShareView(`Invite friends to ${lbGroup() ? lbGroup().name : 'your group'}`, false); },
  leave() {
    const g = lbGroup();
    if (!g) return LB_VIEWS.groups();
    return `<h3 class="lb-h">Leave ${lbEsc(g.name)}?</h3>`
      + '<p class="lb-note">Your scores here will be deleted.</p>' + lbProblem()
      + '<button class="btn btn-big lb-wide" type="button" data-act="leave">Leave group</button>'
      + '<button class="btn btn-big btn-quiet lb-wide" type="button" data-view="group">Stay</button>';
  },
  code() {
    return lbBack('groups', 'My groups') + '<h3 class="lb-h">Join a group</h3>'
      + '<form class="lb-stack" data-form="code"><label class="lb-label" for="lbCode">Group code</label>'
      + '<input class="lb-input" id="lbCode" maxlength="16" placeholder="Like PLUM-4827" autocapitalize="characters" autocomplete="off" enterkeyhint="go">'
      + lbProblem() + '<button class="btn btn-big lb-wide" type="submit">Find group</button></form>';
  },
  join() {
    const g = lbJoining;
    if (!g) return LB_VIEWS.groups();
    return '<p class="lb-note">You’re invited to join</p>'
      + `<h3 class="lb-h lb-h-big">${lbEsc(g.name)}</h3><p class="lb-note">${lbPlayers(g.members)}</p>`
      + '<form class="lb-stack" data-form="join">' + lbFirstTimeFields('lbJoinMe') + lbProblem()
      + '<p class="lb-note">Your next game counts here.</p>'
      + `<button class="btn btn-big lb-wide" type="submit">Join ${lbEsc(g.name)}</button>`
      + '<button class="lb-link lb-quiet" type="button" data-act="notNow">Not now</button></form>';
  },
  me() {
    return lbBack(lbTab, 'Leaderboard') + '<h3 class="lb-h">Your leaderboard</h3>'
      + '<form class="lb-stack" data-form="rename"><label class="lb-label" for="lbRename">Username</label>'
      + `<div class="lb-form"><input class="lb-input" id="lbRename" maxlength="20" value="${lbEsc(lbName())}" autocomplete="nickname" enterkeyhint="done">`
      + '<button class="btn lb-save" type="submit">Save</button></div></form>' + lbProblem()
      + '<p class="lb-note" id="lbHeldNote" hidden>Reported: others see “Picnic Player” for now.</p>'
      + `<p class="lb-note">Visible to other players · <a class="lb-link" href="${PRIVACY_URL}" target="_blank" rel="noopener">Privacy</a></p>`
      + '<button class="lb-link lb-quiet" type="button" data-view="remove">Remove me from the leaderboard</button>';
  },
  remove() {
    return '<h3 class="lb-h">Remove me?</h3>'
      + '<p class="lb-note">Deletes your name, scores and groups.</p>' + lbProblem()
      + '<button class="btn btn-big lb-wide" type="button" data-act="remove">Remove me</button>'
      + '<button class="btn btn-big btn-quiet lb-wide" type="button" data-view="me">Keep me</button>';
  },
};
// Each board's main action, pinned to the bottom of the panel
const LB_MAIN = {
  groups: () => '<button class="btn btn-big" type="button" data-view="new">＋ New group</button>',
  group: () => '<button class="btn btn-big" type="button" data-view="invite">Invite friends</button>',
};
function lbSeg() {
  const n = lbGroups().length;
  return `<div class="lb-seg" role="group" aria-label="Which leaderboard">`
    + `<button type="button" aria-pressed="${lbView === 'everyone'}" data-view="everyone">Everyone</button>`
    + `<button type="button" aria-pressed="${lbView === 'groups'}" data-view="groups">My groups${n ? ` (${n})` : ''}</button></div>`;
}
// The link to send, with Copy and (where the phone has one) Share
function lbShareView(title, fresh) {
  const g = lbGroup();
  if (!g) return LB_VIEWS.groups();
  return (fresh ? `<img class="lb-badge" alt="" src="${svgURL(THEME_UI[themeId].winArt())}">` : lbBack('group', g.name))
    + `<h3 class="lb-h">${lbEsc(title)}</h3>`
    + (fresh ? `<p class="lb-note"><b>${lbEsc(g.name)}</b></p>` : '')
    + `<p class="lb-linkbox" id="lbLinkText">${lbEsc(lbInviteURL(g).replace(/^https?:\/\//, ''))}</p>`
    // Share is the main button where the phone has it; Copy link otherwise
    + (navigator.share ? '<button class="btn btn-big lb-wide" type="button" data-act="share">Share link…</button>' : '')
    + `<button class="btn btn-big lb-wide${navigator.share ? ' btn-quiet' : ''}" type="button" data-act="copy">Copy link</button>`
    + `<p class="lb-note">Or share the code <b>${lbEsc(g.code)}</b></p>`
    + `<button class="lb-link" type="button" data-view="group">${fresh ? 'Done, go to the group' : 'Done'}</button>`;
}

function lbRender() {
  // a group you're no longer in (left on another phone, or removed) falls back to the list
  if (['group', 'invite', 'leave', 'ready'].includes(lbView) && !lbGroup()) lbView = 'groups';
  const v = LB_VIEWS[lbView] ? lbView : 'everyone';
  $lb('lbView').innerHTML = LB_VIEWS[v]();
  const boards = v === 'everyone' || v === 'groups' || v === 'group';
  $lb('lbFoot').hidden = !(v === 'everyone' || v === 'groups') || !lbName();
  $lb('lbMeName').textContent = lbName();
  $lb('lbFlash').hidden = true;
  $lb('lbActions').hidden = !LB_MAIN[v];
  $lb('lbMain').outerHTML = `<span id="lbMain">${LB_MAIN[v] ? LB_MAIN[v]() : ''}</span>`;
  $lb('lbView').scrollTop = 0;
  if (v === 'everyone') lbFillBoard(null);
  if (v === 'group') lbFillBoard(lbGroupCode);
  if (v === 'groups') lbRefreshGroups();
  if (v === 'me') lbCheckHeld();
  const first = $lb('lbView').querySelector('.lb-input');
  if (first && (v === 'new' || v === 'code')) first.focus();
}
// Switch view. Opens the panel if it's closed.
// With no view given (the trophy button), it reopens the board the player
// looked at last: Everyone, My groups or one group. So someone who mostly
// follows a group lands straight on it.
function lbOpen(view, code) {
  lbIsOpen = true;
  $lb('leaderboard').classList.add('show');
  if (!view) {
    const last = lbStore.get('fruitpicnic.lbLast') || 'everyone';
    const lastGroup = last.startsWith('group:') && lbGroups().find(g => g.code === last.slice(6));
    if (lastGroup) { view = 'group'; code = lastGroup.code; }
    else view = last === 'groups' || last.startsWith('group:') ? 'groups' : 'everyone';
  }
  lbShow(view, code);
}
function lbShow(view, code) {
  if (code) lbGroupCode = code;
  if (view === 'everyone' || view === 'groups') lbTab = view;
  if (view === 'group') lbTab = 'groups';
  if (view === 'everyone' || view === 'groups' || view === 'group') {
    lbStore.set('fruitpicnic.lbLast', view === 'group' ? 'group:' + lbGroupCode : view);
  }
  lbView = view;
  lbMsg = '';
  lbRender();
}
function lbClose() {
  lbIsOpen = false;
  $lb('leaderboard').classList.remove('show');
}
// A short note under the current view, like "Link copied"
function lbFlash(text) {
  const el = $lb('lbFlash');
  el.textContent = text;
  el.hidden = !text;
}
// Show a problem on a form view without losing what was typed
function lbFormProblem(form, text) {
  let el = form.querySelector('.lb-problem');
  if (!el) {
    el = document.createElement('p');
    el.className = 'lb-note lb-problem';
    el.setAttribute('role', 'alert');
    form.querySelector('[type="submit"]').before(el);
  }
  el.textContent = text;
}

// Fill the Everyone board (code null) or one group's board
async function lbFillBoard(code) {
  const load = ++lbLoad;
  const list = $lb('lbList'), status = $lb('lbStatus');
  try {
    await lbFlush().catch(() => {});
    const rows = code ? await lbFetchGroup(code) : await lbFetchTop();
    if (load !== lbLoad || !$lb('lbList')) return;   // a newer load or another view has taken over
    const hidden = lbHidden();
    const shown = rows.filter(r => r.me || !hidden.has(r.id));
    const hiddenCount = rows.length - shown.length;
    status.textContent = shown.length ? ''
      : code ? 'No scores here yet.'
      : 'No scores yet. Be the first!';
    $lb('lbShowHidden').hidden = !hiddenCount;
    $lb('lbShowHidden').querySelector('button').textContent = `Show ${hiddenCount} hidden player${hiddenCount === 1 ? '' : 's'}`;
    const items = [];
    shown.forEach((r, i) => {
      // your own row on Everyone, when you're further down than the top
      if (r.me && i && r.place > shown[i - 1].place + 1) items.push(Object.assign(document.createElement('li'), { className: 'lb-gap', textContent: '•••' }));
      const li = document.createElement('li');
      if (r.me) li.className = 'me';
      const none = !r.score;
      // No top-tile picture: it would spoil the bigger tiles for newer players
      const medal = !none && r.place <= 3 ? ` lb-medal-${r.place}` : '';
      li.innerHTML = `<span class="lb-rank${medal}">${none ? '–' : r.place}</span><span class="lb-name"></span>`
        + `<span class="lb-score${none ? ' lb-none' : ''}">${none ? (r.me ? 'Your next game counts' : 'No score yet') : lbNum(r.score)}</span>`;
      li.querySelector('.lb-name').textContent = r.name + (r.me ? ' (you)' : '');
      if (!r.me) {
        // Tap someone else's name to hide or report it
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        li.setAttribute('aria-label', `${r.name}, ${none ? 'no score yet' : r.score + ' points'}. Hide or report`);
        li.addEventListener('click', () => lbToggleActions(li, r));
        li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lbToggleActions(li, r); } });
      }
      items.push(li);
    });
    list.replaceChildren(...items);
  } catch (_) {
    if (load !== lbLoad || !$lb('lbStatus')) return;
    status.textContent = 'Couldn’t load. Try again.';
  }
}
// "Your name was reported" on the Your leaderboard view
async function lbCheckHeld() {
  try {
    const rows = await lbFetchTop();
    const note = $lb('lbHeldNote');
    if (note) note.hidden = !rows.some(r => r.me && r.held);
  } catch (_) {}
}

// The Hide / Report buttons under a tapped name
function lbToggleActions(li, r) {
  const open = li.nextElementSibling && li.nextElementSibling.classList.contains('lb-acts');
  $lb('lbList').querySelectorAll('.lb-acts').forEach(el => el.remove());
  if (open) return;
  const acts = document.createElement('li');
  acts.className = 'lb-acts';
  acts.innerHTML = '<button class="lb-link" type="button" data-act="hide">Hide this player</button><button class="lb-link" type="button" data-act="report">Report name</button>';
  acts.querySelector('[data-act="hide"]').addEventListener('click', e => {
    e.stopPropagation();
    const hidden = lbHidden(); hidden.add(r.id); lbSetHidden(hidden);
    lbRender();
  });
  const report = acts.querySelector('[data-act="report"]');
  report.addEventListener('click', async e => {
    e.stopPropagation();
    // a second tap confirms, so nobody reports a name by accident
    if (!report.dataset.sure) {
      report.dataset.sure = '1';
      report.textContent = `Tap again to report “${r.name}”`;
      return;
    }
    try {
      await lbRpc('report_name', { p_player: lbPlayerId(), p_target: r.id });
    } catch (_) {
      $lb('lbStatus').textContent = 'Couldn’t send the report. Try again.';
      return;
    }
    const hidden = lbHidden(); hidden.add(r.id); lbSetHidden(hidden);
    lbRender();
    lbFlash('Thanks for reporting. We’ll take a look.');
  });
  li.after(acts);
}

// ── Groups ──
const GROUP_ERRORS = {
  name_not_allowed: 'Let’s pick a different group name',
  too_many_groups: 'You’re in a lot of groups already. Leave one first.',
  group_not_found: 'No group has that code. Check it and try again.',
};
const lbGroupError = e => GROUP_ERRORS[e.message] || LB_OFFLINE;
// Quietly bring the saved group list up to date with the database
async function lbRefreshGroups() {
  try {
    const groups = await lbRpc('group_list', { p_player: lbPlayerId() });
    if (JSON.stringify(groups) === JSON.stringify(lbGroups())) return;
    lbSetGroups(groups);
    // redraw what shows the list, unless the player is typing or reading a board
    if (lbIsOpen && lbView === 'groups') lbRender();
    else if (lbIsOpen && lbView === 'everyone') $lb('lbView').querySelector('.lb-seg').outerHTML = lbSeg();
  } catch (_) { /* offline: keep the saved list */ }
}
function lbAddGroup(g) {
  const groups = lbGroups().filter(x => x.code !== g.code);
  groups.push({ code: g.code, name: g.name, players: g.players || 1, place: null, started_by: g.started_by || null });
  lbSetGroups(groups);
}
async function lbCreateGroup(form) {
  const name = tidyName(form.querySelector('#lbNewName').value);
  if (!name) { form.querySelector('#lbNewName').focus(); return; }
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    let why = await lbNameProblem(name, 24);
    if (why) { lbFormProblem(form, why.replace('name', 'group name')); return; }
    why = await lbSaveFirstTime(form, 'lbNewMe');
    if (why) { lbFormProblem(form, why); return; }
    const [g] = await lbRpc('create_group', { p_player: lbPlayerId(), p_name: name });
    lbAddGroup(Object.assign(g, { started_by: lbName() }));
    lbGroupCode = g.code;
    lbShow('ready');
  } catch (err) { lbFormProblem(form, lbGroupError(err)); }
  finally { button.disabled = false; }
}
async function lbJoinGroup(form) {
  const g = lbJoining, button = form.querySelector('[type="submit"]');
  button.disabled = true;
  try {
    const why = await lbSaveFirstTime(form, 'lbJoinMe');
    if (why) { lbFormProblem(form, why); return; }
    const [joined] = await lbRpc('join_group', { p_player: lbPlayerId(), p_code: g.code });
    lbAddGroup({ code: joined.code, name: joined.name, players: g.members + 1 });
    lbJoining = null;
    lbTab = 'groups';
    lbShow('group', joined.code);
    lbFlash(`You joined ${joined.name}.`);
  } catch (err) { lbFormProblem(form, lbGroupError(err)); }
  finally { button.disabled = false; }
}
// Find a group by code, then show it (if already in it) or offer to join
async function lbFindGroup(code) {
  const [g] = await lbRpc('find_group', { p_code: code });
  if (!g) throw new Error('group_not_found');
  if (lbGroups().some(x => x.code === g.code)) { lbTab = 'groups'; lbShow('group', g.code); return; }
  lbJoining = g;
  lbShow('join');
}
async function lbCopyLink() {
  const g = lbGroup();
  try {
    await navigator.clipboard.writeText(lbInviteURL(g));
    lbFlash('Link copied.');
  } catch (_) {
    // no clipboard: select the link so it can be copied by hand
    const box = $lb('lbLinkText'), range = document.createRange();
    range.selectNodeContents(box);
    getSelection().removeAllRanges(); getSelection().addRange(range);
    lbFlash(`Share this code with your friends: ${g.code}`);
  }
}
async function lbShareLink() {
  const g = lbGroup();
  const text = `Join my Fruit Picnic group “${g.name}”! Tap the link, or open the game and enter code ${g.code}.`;
  try { await navigator.share({ title: 'Fruit Picnic', text, url: lbInviteURL(g) }); }
  catch (err) { if (err.name !== 'AbortError') lbCopyLink(); }
}
async function lbLeaveGroup() {
  const g = lbGroup();
  try {
    await lbRpc('leave_group', { p_player: lbPlayerId(), p_code: g.code });
  } catch (_) { lbMsg = LB_OFFLINE; lbRender(); return; }
  lbSetGroups(lbGroups().filter(x => x.code !== g.code));
  lbShow('groups');
  lbFlash(`You left ${g.name}.`);
}
// fruitpicnic.io/?join=PLUM-4827 opens the board and offers to join
async function lbJoinFromLink() {
  const params = new URLSearchParams(location.search), code = params.get('join');
  if (!code) return;
  params.delete('join');
  history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  lbOpen('code');
  try { await lbFindGroup(code); }
  catch (err) { lbMsg = lbGroupError(err); lbRender(); }
}

// ── Your name, and removing yourself ──
async function lbRename(form) {
  const name = tidyName(form.querySelector('#lbRename').value);
  if (!name || name === lbName()) return;
  const why = await lbNameProblem(name);
  if (why) { lbMsg = why; lbRender(); $lb('lbRename').value = name; return; }
  const old = lbName();
  lbStore.set('fruitpicnic.lbName', name);
  try { await lbSavePlayer(); }
  catch (e) {
    lbStore.set('fruitpicnic.lbName', old);
    lbMsg = e.message === 'name_not_allowed' ? 'Let’s pick a different name' : LB_OFFLINE;
    lbRender(); $lb('lbRename').value = name;
    return;
  }
  lbFlash('Username saved.');
}
async function lbRemoveMe() {
  try {
    await lbRemove();
  } catch (_) { lbMsg = LB_OFFLINE; lbRender(); return; }
  // Forget the name, groups and any unsent score so nothing gets posted
  // again until the player chooses to post a new one
  lbStore.set('fruitpicnic.lbName', null);
  lbStore.set('fruitpicnic.lbPending', null);
  lbSetGroups([]);
  lbShow('everyone');
  lbFlash('You’re off the leaderboard.');
}

if (lbOn) {
  $lb('lbTitle').insertAdjacentHTML('afterbegin', lbTrophy('lg'));
  $lb('boardBtn').hidden = false;
  $lb('boardBtn').addEventListener('click', () => lbOpen());
  $lb('lbClose').addEventListener('click', lbClose);
  document.addEventListener('keydown', e => { if (lbIsOpen && e.key === 'Escape') lbClose(); });
  $lb('lbMeBtn').addEventListener('click', () => lbShow('me'));
  const panel = $lb('lbView');
  $lb('lbMain').parentElement.addEventListener('click', e => {
    const t = e.target.closest('[data-view]');
    if (t) lbShow(t.dataset.view);
  });
  panel.addEventListener('click', e => {
    const t = e.target.closest('[data-view],[data-group],[data-act]');
    if (!t) return;
    if (t.dataset.view) return lbShow(t.dataset.view);
    if (t.dataset.group) return lbShow('group', t.dataset.group);
    switch (t.dataset.act) {
      case 'unhide': lbSetHidden(new Set()); return lbRender();
      case 'copy': return lbCopyLink();
      case 'share': return lbShareLink();
      case 'leave': return lbLeaveGroup();
      case 'remove': return lbRemoveMe();
      case 'notNow': lbJoining = null; return lbClose();
    }
  });
  panel.addEventListener('submit', e => {
    e.preventDefault();
    const form = e.target;
    if (form.dataset.form === 'new') return lbCreateGroup(form);
    if (form.dataset.form === 'join') return lbJoinGroup(form);
    if (form.dataset.form === 'rename') return lbRename(form);
    if (form.dataset.form === 'code') {
      const input = form.querySelector('#lbCode'), code = input.value.trim();
      if (!code) { input.focus(); return; }
      lbFindGroup(code).catch(err => lbFormProblem(form, lbGroupError(err)));
    }
  });
  lbFlush().catch(() => {});
  window.addEventListener('online', () => lbFlush().catch(() => {}));
  lbJoinFromLink();
}

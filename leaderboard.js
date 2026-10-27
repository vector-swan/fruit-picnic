'use strict';
// ── Friends leaderboard (Supabase) ────────────────────────────────────────────
// Each phone gets a private random id and a name the player picks once, along
// with where their scores show: everyone and their groups, or only their
// groups. When a game ends, the score is sent to Supabase, which keeps each
// player's best on the Everyone board and, separately, in each group (counting
// only games since they joined it). The trophy button shows the boards and the
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
// "Only my groups" keeps the player off the Everyone board. Chosen once, with
// the name; players from before this was asked count as "everyone".
const lbGroupsOnly = () => lbStore.get('fruitpicnic.lbVis') === 'groups';
const lbSetGroupsOnly = on => lbStore.set('fruitpicnic.lbVis', on ? 'groups' : 'everyone');
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
const lbPostScore = entry => lbRpc('post_score', { p_player: lbPlayerId(), p_name: entry.name, p_score: entry.score, p_tile: entry.tile, p_groups_only: lbGroupsOnly() });
const lbSavePlayer = () => lbRpc('save_player', { p_player: lbPlayerId(), p_name: lbName(), p_groups_only: lbGroupsOnly() });
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
    if (!(await lbRpc('check_name', { p_name: name }))) return 'Let’s pick a different name 🍓';
  } catch (_) { /* offline: the database checks it again when the score is sent */ }
  return '';
}
// Names and group names are put into the page as text, never as markup
const lbEsc = s => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const lbNum = n => Number(n).toLocaleString();
const lbPlayers = n => n === 1 ? '1 player' : `${n} players`;

// The "where should your scores show?" choice. `compact` is the short version
// for the game-over card.
function lbVisPicker(name, compact) {
  const g = lbGroupsOnly();
  const opt = (value, title, detail, on) => `<label class="lb-opt"><input type="radio" name="${name}" value="${value}"${on ? ' checked' : ''}>`
    + `<span><b>${title}</b>${compact ? '' : `<small>${detail}</small>`}</span></label>`;
  return `<div class="lb-vis" role="radiogroup" aria-label="Where your scores show">`
    + opt('everyone', 'Everyone and my groups', 'Your name and best score show on the Everyone board and in your groups.', !g)
    + opt('groups', 'Only my groups', 'Only friends in your groups see you. Good for kids and family play.', g)
    + `</div>`;
}
const lbPickedVis = (root, name) => {
  const el = root.querySelector(`input[name="${name}"]:checked`);
  return el ? el.value === 'groups' : lbGroupsOnly();
};
// Name and visibility boxes for players who haven't picked a name yet
const lbFirstTimeFields = id => lbName() ? '' : `<label class="lb-label" for="${id}Name">Your name</label>`
  + `<input class="lb-input" id="${id}Name" maxlength="20" placeholder="What friends call you" autocomplete="nickname" enterkeyhint="done">`
  + `<span class="lb-label">Where your scores show</span>${lbVisPicker(id + 'Vis')}`;
// Checks and saves those boxes. Returns '' when done, otherwise the problem.
async function lbSaveFirstTime(root, id) {
  if (lbName()) return '';
  const name = tidyName(root.querySelector(`#${id}Name`).value);
  const why = await lbNameProblem(name);
  if (why) return why;
  const groupsOnly = lbPickedVis(root, id + 'Vis');
  lbStore.set('fruitpicnic.lbName', name);
  lbSetGroupsOnly(groupsOnly);
  try { await lbSavePlayer(); }
  catch (e) {
    lbStore.set('fruitpicnic.lbName', null);
    return e.message === 'name_not_allowed' ? 'Let’s pick a different name 🍓' : LB_OFFLINE;
  }
  return '';
}
const LB_OFFLINE = 'Couldn’t reach the leaderboard. Check your connection and try again.';

// A finished game waits here until it's sent, so scores made offline aren't lost
async function lbFlush() {
  const raw = lbStore.get('fruitpicnic.lbPending');
  if (!raw) return null;
  const entry = JSON.parse(raw);
  let result;
  try {
    result = await lbPostScore(entry);
  } catch (e) {
    // The database turned the name down: forget it so the player picks a new
    // one next time, instead of failing over and over
    if (e.message === 'name_not_allowed') {
      lbStore.set('fruitpicnic.lbPending', null);
      if (lbName() === entry.name) lbStore.set('fruitpicnic.lbName', null);
    }
    throw e;
  }
  // only clear it if nothing newer was queued meanwhile
  if (lbStore.get('fruitpicnic.lbPending') === raw) lbStore.set('fruitpicnic.lbPending', null);
  lbRefreshGroups();
  return result;
}
function lbQueue(score, tile) {
  const prev = lbStore.json('fruitpicnic.lbPending', null);
  if (prev && prev.score >= score && prev.name === lbName()) return;
  lbStore.set('fruitpicnic.lbPending', JSON.stringify({ name: lbName(), score: Math.max(score, prev ? prev.score : 0), tile }));
}

// ── The "post" row on the win / game-over cards ──
// The first time, the player picks a name and where their scores show. After
// that every finished game posts by itself, and the card shows where it landed.
function lbCardRow(card) { return card.querySelector('.lb-post'); }
function lbShowPost(card) {
  const row = lbCardRow(card);
  if (!lbOn || !row || score <= 0) { if (row) row.hidden = true; return; }
  row.hidden = false;
  const top = Math.max(...liveTiles.map(t => t.value));
  row.dataset.score = score; row.dataset.tile = top;
  if (lbName()) lbPost(row);
  else lbAsk(row);
}
function lbAsk(row, problem = '') {
  row.innerHTML = `<form class="lb-post-form"><input class="lb-input" maxlength="20" placeholder="Your name" aria-label="Your name for the leaderboard" autocomplete="nickname" enterkeyhint="done">`
    + `<span class="lb-label">Show my scores to</span>${lbVisPicker('lbCardVis', true)}`
    + `<button class="btn lb-save" type="submit">🏆 Post score</button></form><p class="lb-note lb-problem" role="alert"></p>`
    + `<p class="lb-note">You only choose this once. <a class="lb-link" href="${PRIVACY_URL}" target="_blank" rel="noopener">Privacy</a></p>`;
  const form = row.querySelector('form'), input = row.querySelector('input'), note = row.querySelector('.lb-problem');
  note.textContent = problem;
  note.hidden = !problem;
  input.value = lbName();
  form.addEventListener('submit', async e => {
    e.preventDefault();
    const name = tidyName(input.value);
    if (!name) { input.focus(); return; }
    const save = form.querySelector('button');
    save.disabled = true;
    const why = await lbNameProblem(name);
    save.disabled = false;
    if (why) { note.textContent = why; note.hidden = false; input.focus(); return; }
    lbStore.set('fruitpicnic.lbName', name);
    lbSetGroupsOnly(lbPickedVis(row, 'lbCardVis'));
    input.blur();
    lbPost(row);
  });
}
async function lbPost(row) {
  lbQueue(+row.dataset.score, +row.dataset.tile);
  row.innerHTML = '<p class="lb-note">Posting to the leaderboard…</p>';
  let result;
  try {
    result = await lbFlush();
  } catch (e) {
    if (e.message === 'name_not_allowed') { lbAsk(row, 'Let’s pick a different name 🍓'); return; }
    row.innerHTML = '<p class="lb-note">Couldn’t reach the leaderboard. Your score will be posted next time you’re online.</p>';
    return;
  }
  // Each board this score is on: Everyone (unless "only my groups") and each group
  const places = [];
  if (result && result.everyone) places.push({ label: 'Everyone', place: `#${lbNum(result.everyone)}`, best: result.everyone_best, open: 'everyone' });
  ((result && result.groups) || []).forEach(g => places.push({
    label: g.name, place: g.place ? `#${g.place} of ${g.players}` : '–', best: g.best, group: g.code,
  }));
  const shown = places.slice(0, 4);
  row.innerHTML = `<p class="lb-note">🏆 Posted as <b></b></p>`
    + (shown.length ? `<ul class="lb-places">${shown.map((p, i) => `<li><button class="lb-place" type="button" data-i="${i}">`
      + `<span class="lb-place-name">${lbEsc(p.label)}${p.best ? '<span class="lb-tag">New best</span>' : ''}</span><b>${p.place} ›</b></button></li>`).join('')}</ul>`
      : '')
    + (places.length > shown.length ? `<p class="lb-note">and ${places.length - shown.length} more</p>` : '')
    + (!result ? '<button class="lb-link" type="button" data-see>See leaderboard</button>'
      : !places.length ? '<p class="lb-note">Only your groups see your scores, and you’re not in one yet. <button class="lb-link" type="button" data-start>Start a group</button></p>'
      : '');
  row.querySelector('b').textContent = lbName();
  row.querySelectorAll('.lb-place').forEach(b => b.addEventListener('click', () => {
    const p = shown[+b.dataset.i];
    if (p.group) lbOpen('group', p.group); else lbOpen('everyone');
  }));
  row.querySelector('[data-see]')?.addEventListener('click', () => lbOpen());
  row.querySelector('[data-start]')?.addEventListener('click', () => lbOpen('new'));
}

// ── The leaderboard panel ──
// One panel with a few views: the Everyone board, the list of your groups, one
// group's board, and the small steps for starting, joining, sharing or leaving
// a group and for changing your name or where your scores show.
let lbIsOpen = false;
let lbView = 'everyone';   // everyone, groups, group, new, ready, invite, leave, code, join, me, remove
let lbTab = 'everyone';    // the last of Everyone / My groups, for the trophy button
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
    const note = !lbName() ? '<p class="lb-note lb-banner">Finish a game and post your score to get on the board.</p>'
      : lbGroupsOnly() ? '<p class="lb-note lb-banner">You’re only showing in your groups, so you’re not on this board. <button class="lb-link" type="button" data-act="showMe">Show me here too</button></p>'
      : '';
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
        : '<p class="lb-note lb-empty"><b>No groups yet</b>A group is a private leaderboard for friends or family. Start one and send them the link.</p>')
      + '<button class="btn btn-big lb-wide" type="button" data-view="new">＋ New group</button>'
      + '<p class="lb-note">Have a code? <button class="lb-link" type="button" data-view="code">Join a group</button></p>';
  },
  group() {
    const g = lbGroup();
    if (!g) return LB_VIEWS.groups();
    const meta = [g.players && lbPlayers(g.players), g.started_by && `started by ${lbEsc(g.started_by)}`].filter(Boolean).join(' · ');
    return lbBack('groups', 'My groups')
      + `<h3 class="lb-h">${lbEsc(g.name)}</h3>${meta ? `<p class="lb-note">${meta}</p>` : ''}`
      + '<button class="btn btn-big lb-wide" type="button" data-view="invite">Invite friends</button>'
      + '<ol class="lb-list" id="lbList"></ol><p class="lb-note" id="lbStatus" role="status">Loading…</p>'
      + '<p class="lb-note" id="lbShowHidden" hidden><button class="lb-link" type="button" data-act="unhide"></button></p>'
      + '<p class="lb-note">Scores here count from the day each person joined.</p>'
      + '<button class="lb-link lb-quiet" type="button" data-view="leave">Leave group</button>';
  },
  new() {
    return lbBack('groups', 'My groups') + '<h3 class="lb-h">New group</h3>'
      + '<form class="lb-stack" data-form="new"><label class="lb-label" for="lbNewName">Group name</label>'
      + '<input class="lb-input" id="lbNewName" maxlength="24" placeholder="Smith Family" autocomplete="off" enterkeyhint="done">'
      + lbFirstTimeFields('lbNewMe') + lbProblem()
      + '<p class="lb-note">Your scores in this group start from today.</p>'
      + '<button class="btn btn-big lb-wide" type="submit">Create group</button></form>';
  },
  ready() { return lbShareView('Your group is ready!', true); },
  invite() { return lbShareView(`Invite friends to ${lbGroup() ? lbGroup().name : 'your group'}`, false); },
  leave() {
    const g = lbGroup();
    if (!g) return LB_VIEWS.groups();
    return `<h3 class="lb-h">Leave ${lbEsc(g.name)}?</h3>`
      + '<p class="lb-note">Your scores in this group go away. You can join again with the link, starting fresh.</p>' + lbProblem()
      + '<div class="btn-row"><button class="btn btn-big btn-secondary" type="button" data-view="group">Stay</button>'
      + '<button class="btn btn-big" type="button" data-act="leave">Leave group</button></div>';
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
      + '<p class="lb-note">Your score here starts fresh. Your next game counts.</p>'
      + `<button class="btn btn-big lb-wide" type="submit">Join ${lbEsc(g.name)}</button>`
      + '<button class="lb-link lb-quiet" type="button" data-act="notNow">Not now</button></form>';
  },
  me() {
    return lbBack(lbTab, 'Leaderboard') + '<h3 class="lb-h">Your leaderboard</h3>'
      + '<form class="lb-stack" data-form="rename"><label class="lb-label" for="lbRename">Your name</label>'
      + `<div class="lb-form"><input class="lb-input" id="lbRename" maxlength="20" value="${lbEsc(lbName())}" autocomplete="nickname" enterkeyhint="done">`
      + '<button class="btn lb-save" type="submit">Save</button></div></form>' + lbProblem()
      + `<span class="lb-label">Where your scores show</span>${lbVisPicker('lbMeVis')}`
      + '<p class="lb-note">With “Only my groups” you can still look at the Everyone board. You just won’t be on it.</p>'
      + '<p class="lb-note" id="lbHeldNote" hidden>Your name was reported, so others see “Picnic Player” until it’s reviewed.</p>'
      + '<button class="lb-link lb-quiet" type="button" data-view="remove">Remove me from the leaderboard</button>';
  },
  remove() {
    return '<h3 class="lb-h">Remove me?</h3>'
      + '<p class="lb-note">Your name and scores come off every board, and you leave your groups.</p>' + lbProblem()
      + '<div class="btn-row"><button class="btn btn-big btn-secondary" type="button" data-view="me">Keep me</button>'
      + '<button class="btn btn-big" type="button" data-act="remove">Remove me</button></div>';
  },
};
function lbSeg() {
  const n = lbGroups().length;
  return `<div class="lb-seg" role="tablist" aria-label="Which leaderboard">`
    + `<button type="button" role="tab" aria-selected="${lbView === 'everyone'}" data-view="everyone">Everyone</button>`
    + `<button type="button" role="tab" aria-selected="${lbView === 'groups'}" data-view="groups">My groups${n ? ` (${n})` : ''}</button></div>`;
}
// The link to send, with Copy and (where the phone has one) Share
function lbShareView(title, fresh) {
  const g = lbGroup();
  if (!g) return LB_VIEWS.groups();
  return (fresh ? '<span class="lb-badge" aria-hidden="true">🧺</span>' : lbBack('group', g.name))
    + `<h3 class="lb-h">${lbEsc(title)}</h3>`
    + (fresh ? `<p class="lb-note"><b>${lbEsc(g.name)}</b> · send this link so friends can join.</p>` : '')
    + `<p class="lb-linkbox" id="lbLinkText">${lbEsc(lbInviteURL(g).replace(/^https?:\/\//, ''))}</p>`
    + '<div class="btn-row"><button class="btn btn-big btn-secondary" type="button" data-act="copy">Copy link</button>'
    + (navigator.share ? '<button class="btn btn-big" type="button" data-act="share">Share…</button>' : '') + '</div>'
    + `<p class="lb-note">Friends tap the link to join, or type the code <b>${lbEsc(g.code)}</b> under “Have a code?”.</p>`
    + `<button class="${fresh ? 'btn btn-big lb-wide' : 'lb-link'}" type="button" data-view="group">Done</button>`;
}

function lbRender() {
  const v = LB_VIEWS[lbView] ? lbView : 'everyone';
  $lb('lbView').innerHTML = LB_VIEWS[v]();
  const boards = v === 'everyone' || v === 'groups' || v === 'group';
  $lb('lbFoot').hidden = !boards || !lbName();
  $lb('lbMeName').textContent = lbName();
  $lb('lbMeVis').textContent = lbGroupsOnly() ? 'only in my groups' : 'shown to everyone';
  $lb('lbFlash').hidden = true;
  $lb('lbClose').hidden = !boards;
  const content = $lb('leaderboard').querySelector('.leaderboard-content');
  content.scrollTop = 0;
  if (v === 'everyone') lbFillBoard(null);
  if (v === 'group') lbFillBoard(lbGroupCode);
  if (v === 'groups') lbRefreshGroups();
  if (v === 'me') lbCheckHeld();
  const first = $lb('lbView').querySelector('input:not([type="radio"])');
  if (first && (v === 'new' || v === 'code')) first.focus();
}
// Switch view. Opens the panel if it's closed.
function lbOpen(view, code) {
  lbIsOpen = true;
  $lb('leaderboard').classList.add('show');
  lbShow(view || lbTab, code);
}
function lbShow(view, code) {
  if (code) lbGroupCode = code;
  if (view === 'everyone' || view === 'groups') lbTab = view;
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
      : code ? 'No one has a score here yet. Invite friends and finish a game!'
      : 'No scores yet. Finish a game to be first!';
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
      li.innerHTML = `<span class="lb-rank">${none ? '–' : r.place}</span><span class="lb-name"></span>`
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
    status.textContent = 'Couldn’t load the leaderboard. Check your connection and try again.';
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
      $lb('lbStatus').textContent = 'Couldn’t send the report. Check your connection and try again.';
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
  name_not_allowed: 'Let’s pick a different group name 🍓',
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
    lbFlash(`You joined ${joined.name}. Your next game counts here.`);
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
    lbFlash('Link copied. Paste it in a message to your friends.');
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

// ── Your name and where your scores show ──
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
    lbMsg = e.message === 'name_not_allowed' ? 'Let’s pick a different name 🍓' : LB_OFFLINE;
    lbRender(); $lb('lbRename').value = name;
    return;
  }
  lbFlash('Name saved.');
}
async function lbChangeVis(groupsOnly) {
  const old = lbGroupsOnly();
  lbSetGroupsOnly(groupsOnly);
  try { await lbSavePlayer(); }
  catch (_) { lbSetGroupsOnly(old); lbMsg = LB_OFFLINE; lbRender(); return; }
  if (lbView !== 'me') lbRender();   // the Everyone board changes; the choice itself is already showing on "me"
  lbFlash(groupsOnly ? 'Now only your groups see your scores.' : 'Now everyone sees your best score.');
}
async function lbRemoveMe() {
  try {
    await lbRemove();
  } catch (_) { lbMsg = LB_OFFLINE; lbRender(); return; }
  // Forget the name, groups and any unsent score so nothing gets posted
  // again until the player chooses to post a new one
  lbStore.set('fruitpicnic.lbName', null);
  lbStore.set('fruitpicnic.lbVis', null);
  lbStore.set('fruitpicnic.lbPending', null);
  lbSetGroups([]);
  lbShow('everyone');
  lbFlash('You’re off the leaderboard.');
}

if (lbOn) {
  $lb('boardBtn').hidden = false;
  $lb('boardBtn').addEventListener('click', () => lbOpen());
  $lb('lbClose').addEventListener('click', lbClose);
  $lb('lbMeBtn').addEventListener('click', () => lbShow('me'));
  const panel = $lb('lbView');
  panel.addEventListener('click', e => {
    const t = e.target.closest('[data-view],[data-group],[data-act]');
    if (!t) return;
    if (t.dataset.view) return lbShow(t.dataset.view);
    if (t.dataset.group) return lbShow('group', t.dataset.group);
    switch (t.dataset.act) {
      case 'showMe': return lbChangeVis(false);
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
  panel.addEventListener('change', e => {
    if (e.target.name === 'lbMeVis') lbChangeVis(e.target.value === 'groups');
  });
  lbFlush().catch(() => {});
  window.addEventListener('online', () => lbFlush().catch(() => {}));
  lbJoinFromLink();
}

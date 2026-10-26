'use strict';
// ── Friends leaderboard (Supabase) ────────────────────────────────────────────
// Each phone gets a private random id and a name the player picks once. When a
// game ends, the score is sent to Supabase, which keeps each player's best.
// The trophy button shows the top scores, for everyone or for a friend group
// joined with a code. Players can hide or report other players' names. If the
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
// Groups this phone is in, kept here so the tabs show up straight away
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
const lbFetchTop = code => lbRpc('leaderboard', { p_player: lbPlayerId(), p_code: code || null, p_limit: LB_SIZE });
const lbSubmit = entry => lbRpc('submit_score', { p_player: lbPlayerId(), p_name: entry.name, p_score: entry.score, p_tile: entry.tile });
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

// A finished game waits here until it's sent, so scores made offline aren't lost
async function lbFlush() {
  const raw = lbStore.get('fruitpicnic.lbPending');
  if (!raw) return null;
  const entry = JSON.parse(raw);
  let rank;
  try {
    rank = await lbSubmit(entry);
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
  return rank;
}
function lbQueue(score, tile) {
  const prev = lbStore.json('fruitpicnic.lbPending', null);
  if (prev && prev.score >= score && prev.name === lbName()) return;
  lbStore.set('fruitpicnic.lbPending', JSON.stringify({ name: lbName(), score: Math.max(score, prev ? prev.score : 0), tile }));
}

// ── The "post" row on the win / game-over cards ──
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
  row.innerHTML = `<form class="lb-form"><input class="lb-input" maxlength="20" placeholder="Your name" aria-label="Your name for the leaderboard" autocomplete="nickname" enterkeyhint="done">`
    + `<button class="btn lb-save" type="submit">🏆 Post</button></form><p class="lb-note lb-problem" role="alert"></p>`
    + `<p class="lb-note">Your name and best score will be shown to everyone who plays. <a class="lb-link" href="${PRIVACY_URL}" target="_blank" rel="noopener">Privacy</a></p>`;
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
    input.blur();
    lbPost(row);
  });
}
async function lbPost(row) {
  lbQueue(+row.dataset.score, +row.dataset.tile);
  row.innerHTML = '<p class="lb-note">Posting to the leaderboard…</p>';
  try {
    const rank = await lbFlush();
    row.innerHTML = `<p class="lb-note">🏆 Posted as <b></b>${rank ? ` · you’re #${rank}` : ''}</p><button class="lb-link" type="button">See leaderboard</button>`;
    row.querySelector('b').textContent = lbName();
    row.querySelector('.lb-link').addEventListener('click', () => lbOpen());
  } catch (e) {
    if (e.message === 'name_not_allowed') {
      lbAsk(row, 'Let’s pick a different name 🍓');
      return;
    }
    row.innerHTML = '<p class="lb-note">Couldn’t reach the leaderboard. Your score will be posted next time you’re online.</p>';
  }
}

// ── The leaderboard panel ──
// Tabs: "Everyone", one per group, and "＋ Groups" to start or join one.
// lbTab is null for Everyone, a group code, or 'groups'.
let lbIsOpen = false;
let lbTab = null;
// Each load gets a number, and only the newest one may fill the list. Without
// this, opening the board again while it's still loading (for example after
// changing your name, especially in Safari, which pauses loading while the
// name box is up) showed every score twice.
let lbLoad = 0;
const $lb = id => document.getElementById(id);

function lbRenderTabs() {
  const groups = lbGroups();
  if (lbTab && lbTab !== 'groups' && !groups.some(g => g.code === lbTab)) lbTab = null;
  const tabs = [{ id: null, label: 'Everyone' }, ...groups.map(g => ({ id: g.code, label: g.name })), { id: 'groups', label: '＋ Groups' }];
  $lb('lbTabs').replaceChildren(...tabs.map(t => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'lb-tab'; b.textContent = t.label;
    b.setAttribute('role', 'tab');
    b.setAttribute('aria-selected', t.id === lbTab);
    b.addEventListener('click', () => { lbTab = t.id; lbOpen(); });
    return b;
  }));
  $lb('lbTabs').querySelector('[aria-selected="true"]')?.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}

async function lbOpen() {
  lbIsOpen = true;
  const load = ++lbLoad;
  const list = $lb('lbList'), status = $lb('lbStatus');
  $lb('leaderboard').classList.add('show');
  lbRenderTabs();
  const managing = lbTab === 'groups', group = lbGroups().find(g => g.code === lbTab);
  $lb('lbBoard').hidden = managing;
  $lb('lbGroupsView').hidden = !managing;
  $lb('lbGroupBar').hidden = !group;
  if (group) $lb('lbGroupCode').textContent = group.code;
  $lb('lbMe').hidden = !lbName();
  $lb('lbMeName').textContent = lbName();
  $lb('lbHeld').hidden = true;
  $lb('lbForget').hidden = !lbName();
  $lb('lbShowHidden').hidden = true;
  if (managing) { lbGroupsMsg(''); return; }

  list.innerHTML = '';
  status.textContent = 'Loading…';
  lbRefreshGroups();
  try {
    await lbFlush().catch(() => {});
    const rows = await lbFetchTop(group && group.code);
    if (load !== lbLoad) return;   // a newer load has taken over
    const hidden = lbHidden();
    const shown = rows.filter(r => r.me || !hidden.has(r.id));
    const hiddenCount = rows.length - shown.length;
    status.textContent = shown.length ? ''
      : group ? 'No scores in this group yet. Invite friends and finish a game!'
      : 'No scores yet. Finish a game to be first!';
    $lb('lbShowHidden').hidden = !hiddenCount;
    $lb('lbShowHiddenBtn').textContent = `Show ${hiddenCount} hidden player${hiddenCount === 1 ? '' : 's'}`;
    $lb('lbHeld').hidden = !rows.some(r => r.me && r.held);
    list.replaceChildren(...shown.map((r, i) => {
      const li = document.createElement('li');
      if (r.me) li.className = 'me';
      // No top-tile picture: it would spoil the bigger tiles for newer players
      li.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name"></span><span class="lb-score">${Number(r.score).toLocaleString()}</span>`;
      li.querySelector('.lb-name').textContent = r.name;
      if (!r.me) {
        // Tap someone else's name to hide or report it
        li.tabIndex = 0;
        li.setAttribute('role', 'button');
        li.setAttribute('aria-label', `${r.name}, ${r.score} points. Hide or report`);
        li.addEventListener('click', () => lbToggleActions(li, r));
        li.addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); lbToggleActions(li, r); } });
      }
      return li;
    }));
  } catch (_) {
    if (load !== lbLoad) return;
    status.textContent = 'Couldn’t load the leaderboard. Check your connection and try again.';
  }
}
function lbClose() {
  lbIsOpen = false;
  $lb('leaderboard').classList.remove('show');
}

// The Hide / Report buttons under a tapped name
function lbToggleActions(li, r) {
  const open = li.nextElementSibling && li.nextElementSibling.classList.contains('lb-acts');
  $lb('lbList').querySelectorAll('.lb-acts').forEach(el => el.remove());
  if (open) return;
  const acts = document.createElement('li');
  acts.className = 'lb-acts';
  acts.innerHTML = '<button class="lb-link" type="button" data-act="hide">Hide this player</button><button class="lb-link" type="button" data-act="report">Report name</button>';
  acts.querySelector('[data-act="hide"]').addEventListener('click', () => {
    const hidden = lbHidden(); hidden.add(r.id); lbSetHidden(hidden);
    lbOpen();
  });
  acts.querySelector('[data-act="report"]').addEventListener('click', async () => {
    if (!confirm(`Report “${r.name}” as an offensive name? It will also be hidden for you.`)) return;
    try {
      await lbRpc('report_name', { p_player: lbPlayerId(), p_target: r.id });
    } catch (_) {
      $lb('lbStatus').textContent = 'Couldn’t send the report. Check your connection and try again.';
      return;
    }
    const hidden = lbHidden(); hidden.add(r.id); lbSetHidden(hidden);
    await lbOpen();
    $lb('lbStatus').textContent = 'Thanks for reporting. We’ll take a look.';
  });
  li.after(acts);
}

// ── Groups ──
function lbGroupsMsg(text) {
  const el = $lb('lbGroupsMsg');
  el.textContent = text;
  el.hidden = !text;
}
const GROUP_ERRORS = {
  name_not_allowed: 'Let’s pick a different group name 🍓',
  too_many_groups: 'You’re in a lot of groups already. Leave one first.',
  group_not_found: 'No group has that code. Check it and try again.',
};
const lbGroupError = e => GROUP_ERRORS[e.message] || 'Couldn’t reach the leaderboard. Check your connection and try again.';
function lbAddGroup(g) {
  const groups = lbGroups().filter(x => x.code !== g.code);
  groups.push({ code: g.code, name: g.name });
  lbSetGroups(groups);
}
// Quietly bring the saved group list up to date with the database
async function lbRefreshGroups() {
  try {
    const groups = await lbRpc('my_groups', { p_player: lbPlayerId() });
    if (JSON.stringify(groups) === JSON.stringify(lbGroups())) return;
    lbSetGroups(groups);
    if (lbIsOpen) lbRenderTabs();
  } catch (_) { /* offline: keep the saved list */ }
}
async function lbCreateGroup(e) {
  e.preventDefault();
  const input = $lb('lbNewGroup'), name = tidyName(input.value);
  if (!name) { input.focus(); return; }
  const why = await lbNameProblem(name, 24);
  if (why) { lbGroupsMsg(why.replace('name', 'group name')); return; }
  try {
    const [g] = await lbRpc('create_group', { p_player: lbPlayerId(), p_name: name });
    lbAddGroup(g);
    input.value = '';
    lbTab = g.code;
    await lbOpen();
    lbInvite();
  } catch (err) { lbGroupsMsg(lbGroupError(err)); }
}
async function lbJoinGroup(code) {
  const [g] = await lbRpc('join_group', { p_player: lbPlayerId(), p_code: code });
  lbAddGroup(g);
  lbTab = g.code;
  await lbOpen();
}
async function lbInvite() {
  const g = lbGroups().find(x => x.code === lbTab);
  if (!g) return;
  const url = `${SITE_URL}?join=${encodeURIComponent(g.code)}`;
  const text = `Join my Fruit Picnic group “${g.name}”! Tap the link, or open the game and enter code ${g.code}.`;
  if (navigator.share) {
    try { await navigator.share({ title: 'Fruit Picnic', text, url }); return; }
    catch (err) { if (err.name === 'AbortError') return; }
  }
  try {
    await navigator.clipboard.writeText(`${text} ${url}`);
    $lb('lbStatus').textContent = 'Invite copied. Paste it in a message to your friends.';
  } catch (_) {
    $lb('lbStatus').textContent = `Share this code with your friends: ${g.code}`;
  }
}
async function lbLeaveGroup() {
  const g = lbGroups().find(x => x.code === lbTab);
  if (!g || !confirm(`Leave “${g.name}”? You can join again with the code ${g.code}.`)) return;
  try {
    await lbRpc('leave_group', { p_player: lbPlayerId(), p_code: g.code });
  } catch (_) {
    $lb('lbStatus').textContent = 'Couldn’t reach the leaderboard. Check your connection and try again.';
    return;
  }
  lbSetGroups(lbGroups().filter(x => x.code !== g.code));
  lbTab = null;
  lbOpen();
}
// fruitpicnic.io/?join=PLUM-4827 opens the board and offers to join
async function lbJoinFromLink() {
  const params = new URLSearchParams(location.search), code = params.get('join');
  if (!code) return;
  params.delete('join');
  history.replaceState(null, '', location.pathname + (params.toString() ? '?' + params : '') + location.hash);
  try {
    const [g] = await lbRpc('find_group', { p_code: code });
    if (!g) { lbTab = 'groups'; await lbOpen(); lbGroupsMsg(GROUP_ERRORS.group_not_found); return; }
    if (lbGroups().some(x => x.code === g.code)) { lbTab = g.code; lbOpen(); return; }
    const who = g.members === 1 ? '1 player' : `${g.members} players`;
    if (!confirm(`Join the leaderboard group “${g.name}” (${who})?`)) return;
    await lbJoinGroup(g.code);
  } catch (err) {
    lbTab = 'groups'; await lbOpen(); lbGroupsMsg(lbGroupError(err));
  }
}

if (lbOn) {
  $lb('boardBtn').hidden = false;
  $lb('boardBtn').addEventListener('click', () => lbOpen());
  $lb('lbClose').addEventListener('click', lbClose);
  $lb('lbRename').addEventListener('click', async () => {
    const name = tidyName(prompt('Your name for the leaderboard', lbName()));
    if (!name || name === lbName()) return;
    const why = await lbNameProblem(name);
    if (why) { alert(why); return; }
    lbStore.set('fruitpicnic.lbName', name);
    // re-send your best so the board shows the new name
    const best = +(lbStore.get('fruitpicnic.best') || 0);
    if (best > 0) lbStore.set('fruitpicnic.lbPending', JSON.stringify({ name, score: best, tile: 2 }));
    lbOpen();
  });
  $lb('lbRemove').addEventListener('click', async () => {
    if (!confirm('Remove your name and score from the leaderboard? You’ll also leave your groups.')) return;
    try {
      await lbRemove();
    } catch (_) {
      $lb('lbStatus').textContent = 'Couldn’t reach the leaderboard. Check your connection and try again.';
      return;
    }
    // Forget the name, groups and any unsent score so nothing gets posted
    // again until the player chooses to post a new one
    lbStore.set('fruitpicnic.lbName', null);
    lbStore.set('fruitpicnic.lbPending', null);
    lbSetGroups([]);
    lbTab = null;
    lbOpen();
  });
  $lb('lbShowHiddenBtn').addEventListener('click', () => { lbSetHidden(new Set()); lbOpen(); });
  $lb('lbInvite').addEventListener('click', lbInvite);
  $lb('lbLeave').addEventListener('click', lbLeaveGroup);
  $lb('lbCreateForm').addEventListener('submit', lbCreateGroup);
  $lb('lbJoinForm').addEventListener('submit', async e => {
    e.preventDefault();
    const input = $lb('lbJoinCode'), code = input.value.trim();
    if (!code) { input.focus(); return; }
    try {
      await lbJoinGroup(code);
      input.value = '';
    } catch (err) { lbGroupsMsg(lbGroupError(err)); }
  });
  lbFlush().catch(() => {});
  window.addEventListener('online', () => lbFlush().catch(() => {}));
  lbJoinFromLink();
}

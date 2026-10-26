'use strict';
// ── Friends leaderboard (Supabase) ────────────────────────────────────────────
// Each phone gets a private random id and a name the player picks once. When a
// game ends, the score is sent to Supabase, which keeps each player's best.
// The trophy button shows the top scores. If the settings below are empty, the
// whole feature stays hidden. The key here is Supabase's public "anon" /
// "publishable" key, which is safe to put in the game; the database only allows
// reading the board and saving scores through submit_score (supabase/leaderboard.sql).

const LEADERBOARD = {
  url: 'https://pjdtvgvmatpqbfefjqgw.supabase.co',
  key: 'sb_publishable_s9KpoAR__MoJhkbz8sCM8g_Cwma0nS_',
};
const LB_SIZE = 15;

const lbOn = !!(LEADERBOARD.url && LEADERBOARD.key);
const lbStore = {
  get(k) { try { return localStorage.getItem(k); } catch (_) { return null; } },
  set(k, v) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch (_) {} },
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

function lbHeaders() {
  const h = { apikey: LEADERBOARD.key, 'Content-Type': 'application/json' };
  // Older "anon" keys are JWTs and also go in Authorization; newer publishable keys don't
  if (LEADERBOARD.key.startsWith('eyJ')) h.Authorization = 'Bearer ' + LEADERBOARD.key;
  return h;
}
async function lbFetchTop() {
  const res = await fetch(`${LEADERBOARD.url}/rest/v1/scores?select=name,score,top_tile&order=score.desc,updated_at.asc&limit=${LB_SIZE}`,
    { headers: lbHeaders() });
  if (!res.ok) throw new Error('board ' + res.status);
  return res.json();
}
async function lbSubmit(entry) {
  const res = await fetch(`${LEADERBOARD.url}/rest/v1/rpc/submit_score`, {
    method: 'POST', headers: lbHeaders(),
    body: JSON.stringify({ p_player: lbPlayerId(), p_name: entry.name, p_score: entry.score, p_tile: entry.tile }),
  });
  if (!res.ok) throw new Error('submit ' + res.status);
  return res.json();   // the player's place, 1 = top
}

// A finished game waits here until it's sent, so scores made offline aren't lost
async function lbFlush() {
  const raw = lbStore.get('fruitpicnic.lbPending');
  if (!raw) return null;
  const entry = JSON.parse(raw);
  const rank = await lbSubmit(entry);
  // only clear it if nothing newer was queued meanwhile
  if (lbStore.get('fruitpicnic.lbPending') === raw) lbStore.set('fruitpicnic.lbPending', null);
  return rank;
}
function lbQueue(score, tile) {
  const prev = JSON.parse(lbStore.get('fruitpicnic.lbPending') || 'null');
  if (prev && prev.score >= score) return;
  lbStore.set('fruitpicnic.lbPending', JSON.stringify({ name: lbName(), score, tile }));
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
function lbAsk(row) {
  row.innerHTML = `<form class="lb-form"><input class="lb-input" maxlength="20" placeholder="Your name" aria-label="Your name for the leaderboard" autocomplete="nickname" enterkeyhint="done">`
    + `<button class="btn lb-save" type="submit">🏆 Post</button></form><p class="lb-note">Add your score to the friends leaderboard</p>`;
  const form = row.querySelector('form'), input = row.querySelector('input');
  input.value = lbName();
  form.addEventListener('submit', e => {
    e.preventDefault();
    const name = input.value.trim().slice(0, 20);
    if (!name) { input.focus(); return; }
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
    row.querySelector('.lb-link').addEventListener('click', lbOpen);
  } catch (_) {
    row.innerHTML = '<p class="lb-note">Couldn’t reach the leaderboard. Your score will be posted next time you’re online.</p>';
  }
}

// ── The leaderboard panel ──
let lbIsOpen = false;
// Each load gets a number, and only the newest one may fill the list. Without
// this, opening the board again while it's still loading (for example after
// changing your name, especially in Safari, which pauses loading while the
// name box is up) showed every score twice.
let lbLoad = 0;
async function lbOpen() {
  lbIsOpen = true;
  const load = ++lbLoad;
  const panel = document.getElementById('leaderboard'), list = document.getElementById('lbList'), status = document.getElementById('lbStatus');
  panel.classList.add('show');
  document.getElementById('lbMe').hidden = !lbName();
  document.getElementById('lbMeName').textContent = lbName();
  list.innerHTML = '';
  status.textContent = 'Loading…';
  try {
    await lbFlush().catch(() => {});
    const rows = await lbFetchTop();
    if (load !== lbLoad) return;   // a newer load has taken over
    status.textContent = rows.length ? '' : 'No scores yet. Finish a game to be first!';
    list.replaceChildren(...rows.map((r, i) => {
      const li = document.createElement('li');
      if (lbName() && r.name === lbName()) li.className = 'me';
      // No top-tile picture: it would spoil the bigger tiles for newer players
      li.innerHTML = `<span class="lb-rank">${i + 1}</span><span class="lb-name"></span><span class="lb-score">${Number(r.score).toLocaleString()}</span>`;
      li.querySelector('.lb-name').textContent = r.name;
      return li;
    }));
  } catch (_) {
    if (load !== lbLoad) return;
    status.textContent = 'Couldn’t load the leaderboard. Check your connection and try again.';
  }
}
function lbClose() {
  lbIsOpen = false;
  document.getElementById('leaderboard').classList.remove('show');
}

if (lbOn) {
  document.getElementById('boardBtn').hidden = false;
  document.getElementById('boardBtn').addEventListener('click', lbOpen);
  document.getElementById('lbClose').addEventListener('click', lbClose);
  document.getElementById('lbRename').addEventListener('click', () => {
    const name = (prompt('Your name for the leaderboard', lbName()) || '').trim().slice(0, 20);
    if (!name) return;
    lbStore.set('fruitpicnic.lbName', name);
    // re-send your best so the board shows the new name
    const best = +(lbStore.get('fruitpicnic.best') || 0);
    if (best > 0) lbStore.set('fruitpicnic.lbPending', JSON.stringify({ name, score: best, tile: 2 }));
    lbOpen();
  });
  lbFlush().catch(() => {});
  window.addEventListener('online', () => lbFlush().catch(() => {}));
}

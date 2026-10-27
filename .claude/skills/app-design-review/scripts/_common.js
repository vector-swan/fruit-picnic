// Shared bits for audit.js and shots.js: argument parsing, opening the app
// with stubs and themes, and running a scene.
const fs = require('fs'), path = require('path');

function args(argv) {
  const out = { _: [] };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a.startsWith('--')) { const k = a.slice(2); const v = argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[++i] : true; out[k] = v; }
    else out._.push(a);
  }
  return out;
}
function themes(opt) {
  if (!opt.themes) return [{ label: 'default' }];
  const [attr, vals] = String(opt.themes).includes('=') ? String(opt.themes).split('=') : [null, String(opt.themes)];
  return vals.split(',').map(v => ({ label: v, attr, value: v }));
}
async function openPage(browser, url, opt, theme) {
  const [w, h] = String(opt.viewport || '390x844').split('x').map(Number);
  const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 2, hasTouch: true });
  if (opt.stub) {
    const stub = JSON.parse(fs.readFileSync(opt.stub, 'utf8'));
    await ctx.route('**/*', r => {
      const u = r.request().url(); const key = Object.keys(stub).find(k => u.includes(k));
      if (key === undefined) return r.continue();
      r.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(stub[key]) });
    });
  }
  const page = await ctx.newPage();
  const errors = []; page.on('pageerror', e => errors.push(e.message));
  await page.addInitScript(({ theme, storageKey, init }) => {
    try {
      if (theme.attr && theme.value) { if (storageKey) localStorage.setItem(storageKey, theme.value); else document.documentElement.setAttribute(theme.attr, theme.value); }
      if (init) new Function(init)();
    } catch (_) {}
  }, { theme, storageKey: opt['theme-storage'] || null, init: opt.init || null });
  await page.goto(url); await page.waitForTimeout(700);
  if (theme.attr && theme.value && !opt['theme-storage']) await page.evaluate(([a, v]) => document.documentElement.setAttribute(a, v), [theme.attr, theme.value]);
  return { page, errors };
}
async function runScene(page, scene) {
  if (scene.setup) { try { await page.evaluate(scene.setup); } catch (e) { return 'setup failed: ' + e.message; } }
  await page.waitForTimeout(scene.wait || 500);
  return null;
}
function loadScenes(opt) { return opt.scenes ? JSON.parse(fs.readFileSync(opt.scenes, 'utf8')) : [{ name: 'page' }]; }
module.exports = { args, themes, openPage, runScene, loadScenes, path, fs };

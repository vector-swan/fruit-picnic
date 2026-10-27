#!/usr/bin/env node
// Measures what eyes get wrong: text contrast (WCAG 1.4.3), text size, tap
// target size (Apple 44pt / WCAG 2.5.8), plus axe-core's WCAG 2.2 AA rules,
// for every scene in every theme. Prints a readable report; --json saves it.
const { chromium } = require('playwright');
const { args, themes, openPage, runScene, loadScenes, path, fs } = require('./_common');
const opt = args(process.argv.slice(2));
const url = opt._[0]; if (!url) { console.error('usage: node audit.js <url> --scenes scenes.json [--themes a=b,c] [--stub s.json] [--viewport WxH] [--json out.json]'); process.exit(2); }
let AXE = null; try { AXE = fs.readFileSync(require.resolve('axe-core/axe.min.js'), 'utf8'); } catch (_) { console.warn('axe-core not installed (run npm install here); skipping axe rules'); }

const MEASURE = () => {
  const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  const parse = s => { const m = s && s.match(/rgba?\(([^)]+)\)/); if (!m) return null; const p = m[1].split(/[ ,/]+/).filter(Boolean).map(Number); return [p[0], p[1], p[2], p[3] ?? 1]; };
  const blend = (t, b) => [0, 1, 2].map(i => t[i] * t[3] + b[i] * (1 - t[3])).concat(1);
  function bgOf(el) { const layers = []; for (let e = el; e; e = e.parentElement) { const c = parse(getComputedStyle(e).backgroundColor); if (c && c[3] > 0) { layers.push(c); if (c[3] >= 1) break; } } let base = [255, 255, 255, 1]; for (let i = layers.length - 1; i >= 0; i--) base = blend(layers[i], base); return base; }
  const vis = e => { const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && r.bottom > 0 && r.top < innerHeight && cs.visibility !== 'hidden' && cs.opacity !== '0' && !e.closest('[hidden]') && !e.closest('[aria-hidden="true"]'); };
  // the topmost open dialog/sheet if any, else the page
  const open = [...document.querySelectorAll('[role="dialog"], .show, [open]')].filter(vis).pop();
  const root = open || document.body;
  const text = [], taps = [];
  root.querySelectorAll('*').forEach(e => {
    if (!vis(e)) return;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      const cs = getComputedStyle(e); const fg = parse(cs.color), bg = bgOf(e); if (!fg) return;
      const f = blend(fg, bg); const L1 = lum(f), L2 = lum(bg); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize), w = +cs.fontWeight || 400; const big = size >= 24 || (size >= 18.66 && w >= 700);
      text.push({ text: e.textContent.trim().slice(0, 40), contrast: +cr.toFixed(2), size: +size.toFixed(1), need: big ? 3 : 4.5 });
    }
    // a visually hidden input inside a label isn't the tap target; the label is
    if (e.matches('input') && e.closest('label')) return;
    if (e.matches('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], label:has(input), summary')) {
      const r = e.getBoundingClientRect(); const a = getComputedStyle(e, '::after');
      const extra = a.content !== 'none' && a.position === 'absolute' ? Math.max(0, -(parseFloat(a.top) || 0)) * 2 : 0;
      taps.push({ text: (e.getAttribute('aria-label') || e.textContent.trim() || e.placeholder || e.className).slice(0, 36), w: Math.round(r.width), h: Math.round(r.height + extra) });
    }
  });
  return { text, taps, scope: open ? (open.id || open.className) : 'page' };
};

(async () => {
  const browser = await chromium.launch(); const scenes = loadScenes(opt); const report = []; const axeSeen = {};
  for (const theme of themes(opt)) {
    const { page, errors } = await openPage(browser, url, opt, theme);
    if (AXE) await page.addScriptTag({ content: AXE });
    for (const scene of scenes) {
      if (!scene.keep) { await page.goto(url); await page.waitForTimeout(600); if (AXE) await page.addScriptTag({ content: AXE }); }
      const fail = await runScene(page, scene);
      if (fail) { report.push({ theme: theme.label, scene: scene.name, error: fail }); continue; }
      const m = await page.evaluate(MEASURE);
      const lowContrast = m.text.filter(t => t.contrast < t.need).map(t => `"${t.text}" ${t.contrast}:1 @${t.size}px (needs ${t.need})`);
      const small = m.text.filter(t => t.size < 13).map(t => `"${t.text}" ${t.size}px`);
      const tiny = m.taps.filter(t => t.h < 44 || t.w < 44).map(t => `"${t.text}" ${t.w}×${t.h}px`);
      let axe = [];
      if (AXE) {
        const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
        axe = res.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map(n => n.target[0]) }));
        axe.forEach(v => { (axeSeen[v.id] = axeSeen[v.id] || { impact: v.impact, help: v.help, where: new Set() }); v.nodes.forEach(n => axeSeen[v.id].where.add(`${theme.label}/${scene.name}: ${n}`)); });
      }
      report.push({ theme: theme.label, scene: scene.name, scope: m.scope, lowContrast: [...new Set(lowContrast)], smallText: [...new Set(small)], smallTaps: [...new Set(tiny)], axe, pageErrors: errors.splice(0) });
      const line = x => x.length ? x.join(' | ') : 'none';
      console.log(`\n## ${theme.label} / ${scene.name}  (${m.scope})\n contrast below minimum: ${line(report.at(-1).lowContrast)}\n text under 13px: ${line(report.at(-1).smallText)}\n taps under 44px: ${line(report.at(-1).smallTaps)}`);
    }
    await page.context().close();
  }
  if (AXE) { console.log('\n## axe-core violations (all scenes)'); const ids = Object.keys(axeSeen); if (!ids.length) console.log(' none'); ids.forEach(id => console.log(` [${axeSeen[id].impact}] ${id}: ${axeSeen[id].help}\n   ` + [...axeSeen[id].where].slice(0, 6).join('\n   '))); }
  const totals = report.reduce((a, r) => { a.contrast += (r.lowContrast || []).length; a.text += (r.smallText || []).length; a.taps += (r.smallTaps || []).length; return a; }, { contrast: 0, text: 0, taps: 0 });
  console.log(`\n## Totals: ${totals.contrast} contrast, ${totals.text} small-text, ${totals.taps} tap-size findings across ${report.length} scene/theme pairs`);
  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify({ url, generated: new Date().toISOString(), report, axe: Object.fromEntries(Object.entries(axeSeen).map(([k, v]) => [k, { ...v, where: [...v.where] }])) }, null, 2));
  await browser.close();
})();

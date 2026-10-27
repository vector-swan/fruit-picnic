#!/usr/bin/env node
// Measures what eyes get wrong, for every scene in every theme:
//  - text contrast (WCAG 1.4.3), including the worst case over patterned or
//    gradient backgrounds, sampled from the rendered pixels
//  - text size, including ::before / ::after text (badges, counters)
//  - tap target size (Apple 44pt / WCAG 2.5.8)
//  - control outlines and states against their background (WCAG 1.4.11)
//  - closed panels whose buttons are still reachable by Tab / VoiceOver
//  - axe-core's WCAG 2.2 AA rules
// Prints a readable report; --json saves it.
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
  const text = [], taps = [], controls = [], pseudo = [];
  // the nearest background below an element: a pattern/gradient image means
  // background-color alone can't tell the real contrast
  const overPattern = el => { for (let e = el; e; e = e.parentElement) { const cs = getComputedStyle(e); if (cs.backgroundImage && cs.backgroundImage !== 'none') return true; const c = parse(cs.backgroundColor); if (c && c[3] >= 1) return false; } return false; };
  let pid = 0;
  root.querySelectorAll('*').forEach(e => {
    if (!vis(e)) return;
    const own = [...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());
    if (own) {
      const cs = getComputedStyle(e); const fg = parse(cs.color), bg = bgOf(e); if (!fg) return;
      const f = blend(fg, bg); const L1 = lum(f), L2 = lum(bg); const cr = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
      const size = parseFloat(cs.fontSize), w = +cs.fontWeight || 400; const big = size >= 24 || (size >= 18.66 && w >= 700);
      const item = { text: e.textContent.trim().slice(0, 40), contrast: +cr.toFixed(2), size: +size.toFixed(1), need: big ? 3 : 4.5 };
      if (overPattern(e)) { item.pattern = 'p' + (++pid); e.setAttribute('data-audit-pattern', item.pattern); const r = e.getBoundingClientRect(); item.box = { x: r.x, y: r.y, w: r.width, h: r.height }; item.fg = f; }
      text.push(item);
    }
    for (const pe of ['::before', '::after']) {
      const ps = getComputedStyle(e, pe); const c = ps.content;
      if (c && c !== 'none' && c !== 'normal' && c !== '""' && /[\w\d]/.test(c.replace(/^["']|["']$/g, '')) && ps.display !== 'none') {
        const label = c.startsWith('attr(') ? '' : c.replace(/^["']|["']$/g, '');
        pseudo.push({ text: (label || e.getAttribute('data-v') || e.className).toString().slice(0, 30) + ' ' + pe, size: +parseFloat(ps.fontSize).toFixed(1) });
      }
    }
    if (e.matches('input:not([type=hidden]):not([type=checkbox]):not([type=radio]), select, textarea, .switch, [role=switch]')) {
      const cs = getComputedStyle(e); const b = parse(cs.borderTopColor), bw = parseFloat(cs.borderTopWidth);
      const own = parse(cs.backgroundColor); const around = bgOf(e.parentElement || e);
      const edge = bw > 0 && b && b[3] > 0 ? blend(b, around) : (own && own[3] > 0 ? blend(own, around) : null);
      if (edge) { const L1 = lum(edge), L2 = lum(around); controls.push({ text: (e.getAttribute('aria-label') || e.placeholder || e.id || e.className).slice(0, 30), contrast: +((Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05)).toFixed(2) }); }
    }
    // a visually hidden input inside a label isn't the tap target; the label is
    if (e.matches('input') && e.closest('label')) return;
    if (e.matches('button, a[href], input:not([type=hidden]), select, textarea, [role=button], [role=tab], label:has(input), summary')) {
      const r = e.getBoundingClientRect(); const a = getComputedStyle(e, '::after');
      const extra = a.content !== 'none' && a.position === 'absolute' ? Math.max(0, -(parseFloat(a.top) || 0)) * 2 : 0;
      taps.push({ text: (e.getAttribute('aria-label') || e.textContent.trim() || e.placeholder || e.className).slice(0, 36), w: Math.round(r.width), h: Math.round(r.height + extra) });
    }
  });
  // buttons inside closed panels (faded out, moved off screen, or not clickable)
  // that are still in the Tab / VoiceOver order
  const hiddenFocus = [...document.querySelectorAll('button, a[href], input:not([type=hidden]), select, textarea, [tabindex]:not([tabindex="-1"])')].filter(el => {
    if (el.closest('[hidden], [inert], [aria-hidden="true"]') || el.disabled) return false;
    if (getComputedStyle(el).visibility === 'hidden' || getComputedStyle(el).display === 'none') return false;
    for (let e = el; e && e !== document.body; e = e.parentElement) { const cs = getComputedStyle(e); if (parseFloat(cs.opacity) === 0 || cs.pointerEvents === 'none' && e.matches('[class]') && parseFloat(cs.opacity) < 0.05) return true; }
    const r = el.getBoundingClientRect(); return r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth;
  }).map(el => (el.getAttribute('aria-label') || el.textContent.trim() || el.id).slice(0, 30));
  return { text, taps, controls, pseudo, hiddenFocus: [...new Set(hiddenFocus)].slice(0, 12), scope: open ? (open.id || open.className) : 'page' };
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
      // Text over a pattern or gradient: hide the text, screenshot its box, and take
      // the worst contrast against any background pixel
      for (const t of m.text.filter(t => t.pattern).slice(0, 40)) {
        try {
          await page.evaluate(id => { const st = document.createElement('style'); st.id = 'audit-hide'; st.textContent = `[data-audit-pattern="${id}"], [data-audit-pattern="${id}"] * { color: transparent !important; text-shadow: none !important; text-decoration-color: transparent !important; -webkit-text-stroke: 0 !important; }`; document.head.appendChild(st); }, t.pattern);
          const shot = await page.screenshot({ clip: { x: Math.max(0, t.box.x), y: Math.max(0, t.box.y), width: Math.max(1, t.box.w), height: Math.max(1, t.box.h) }, scale: 'css' });
          await page.evaluate(() => document.getElementById('audit-hide')?.remove());
          const worst = await page.evaluate(async ({ b64, fg }) => {
            const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
            const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
            const d = x.getImageData(0, 0, c.width, c.height).data;
            const lum = (r, g, b) => [r, g, b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }).reduce((a, v, i) => a + v * [0.2126, 0.7152, 0.0722][i], 0);
            const Lf = lum(fg[0], fg[1], fg[2]); let w = 99;
            for (let i = 0; i < d.length; i += 16) { const L = lum(d[i], d[i + 1], d[i + 2]); const cr = (Math.max(L, Lf) + 0.05) / (Math.min(L, Lf) + 0.05); if (cr < w) w = cr; }
            return +w.toFixed(2);
          }, { b64: shot.toString('base64'), fg: t.fg });
          t.contrast = Math.min(t.contrast, worst); t.patternWorst = worst;
        } catch (_) { /* element moved or closed; keep the flat-colour figure */ }
      }
      const lowContrast = m.text.filter(t => t.contrast < t.need).map(t => `"${t.text}" ${t.contrast}:1 @${t.size}px (needs ${t.need})`);
      const small = m.text.filter(t => t.size < 13).map(t => `"${t.text}" ${t.size}px`);
      const tiny = m.taps.filter(t => t.h < 44 || t.w < 44).map(t => `"${t.text}" ${t.w}×${t.h}px`);
      const faintControls = m.controls.filter(c => c.contrast < 3).map(c => `"${c.text}" ${c.contrast}:1`);
      const smallPseudo = m.pseudo.filter(p => p.size < 11).map(p => `"${p.text}" ${p.size}px`);
      const patternNotes = m.text.filter(t => t.patternWorst && t.patternWorst < t.need).map(t => `"${t.text}" ${t.patternWorst}:1 over pattern`);
      let axe = [];
      if (AXE) {
        const res = await page.evaluate(() => axe.run(document, { runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa', 'wcag22aa', 'best-practice'] } }));
        axe = res.violations.map(v => ({ id: v.id, impact: v.impact, help: v.help, nodes: v.nodes.slice(0, 3).map(n => n.target[0]) }));
        axe.forEach(v => { (axeSeen[v.id] = axeSeen[v.id] || { impact: v.impact, help: v.help, where: new Set() }); v.nodes.forEach(n => axeSeen[v.id].where.add(`${theme.label}/${scene.name}: ${n}`)); });
      }
      report.push({ theme: theme.label, scene: scene.name, scope: m.scope, lowContrast: [...new Set(lowContrast)], overPattern: [...new Set(patternNotes)], smallText: [...new Set(small)], smallPseudoText: [...new Set(smallPseudo)], smallTaps: [...new Set(tiny)], faintControls: [...new Set(faintControls)], hiddenButStillFocusable: m.hiddenFocus, axe, pageErrors: errors.splice(0) });
      const r = report.at(-1), line = x => x.length ? x.join(' | ') : 'none';
      console.log(`\n## ${theme.label} / ${scene.name}  (${m.scope})\n contrast below minimum: ${line(r.lowContrast)}\n   of which over a pattern: ${line(r.overPattern)}\n text under 13px: ${line(r.smallText)}\n ::before/::after text under 11px: ${line(r.smallPseudoText)}\n taps under 44px: ${line(r.smallTaps)}\n control outlines under 3:1: ${line(r.faintControls)}\n closed panels still reachable by Tab: ${line(r.hiddenButStillFocusable)}`);
    }
    await page.context().close();
  }
  if (AXE) { console.log('\n## axe-core violations (all scenes)'); const ids = Object.keys(axeSeen); if (!ids.length) console.log(' none'); ids.forEach(id => console.log(` [${axeSeen[id].impact}] ${id}: ${axeSeen[id].help}\n   ` + [...axeSeen[id].where].slice(0, 6).join('\n   '))); }
  const n = k => report.reduce((a, r) => a + (r[k] || []).length, 0);
  console.log(`\n## Totals across ${report.length} scene/theme pairs: ${n('lowContrast')} contrast (${n('overPattern')} over patterns), ${n('smallText')} small text, ${n('smallPseudoText')} small badge text, ${n('smallTaps')} small taps, ${n('faintControls')} faint control outlines, ${n('hiddenButStillFocusable')} hidden-but-focusable`);
  if (opt.json) fs.writeFileSync(opt.json, JSON.stringify({ url, generated: new Date().toISOString(), report, axe: Object.fromEntries(Object.entries(axeSeen).map(([k, v]) => [k, { ...v, where: [...v.where] }])) }, null, 2));
  await browser.close();
})();

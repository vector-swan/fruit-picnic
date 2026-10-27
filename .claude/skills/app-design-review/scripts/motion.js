#!/usr/bin/env node
// Static inventory of motion and a few page-level accessibility facts.
// Reads CSS and HTML files (or a directory) and reports: every animation and
// transition with its duration, infinite or >5s animations (WCAG 2.2.2),
// anything >400ms (Material's UI ceiling), which animations are covered by a
// prefers-reduced-motion rule, and viewport/lang/landmark problems.
// --tokens also counts radii, shadows, font sizes and weights, and dashed borders.
const fs = require('fs'), path = require('path');
const opt = { tokens: process.argv.includes('--tokens') };
const inputs = process.argv.slice(2).filter(a => !a.startsWith('--'));
if (!inputs.length) { console.error('usage: node motion.js <dir or files> [--tokens]'); process.exit(2); }
const files = [];
const walk = p => { const st = fs.statSync(p); if (st.isDirectory()) { if (/node_modules|\.git|dist|www$/.test(p)) return; fs.readdirSync(p).forEach(f => walk(path.join(p, f))); } else if (/\.(css|html?)$/.test(p)) files.push(p); };
inputs.forEach(walk);
const ms = v => { const m = /([\d.]+)(m?s)/.exec(v); return m ? (m[2] === 's' ? parseFloat(m[1]) * 1000 : parseFloat(m[1])) : null; };
const anims = [], trans = [], reduced = new Set(); let viewportIssue = null, lang = null, hasMain = false;
for (const f of files) {
  const src = fs.readFileSync(f, 'utf8');
  if (f.endsWith('.html')) {
    const vp = /<meta[^>]+name="viewport"[^>]+content="([^"]+)"/i.exec(src);
    if (vp && /user-scalable\s*=\s*(no|0)|maximum-scale\s*=\s*1(\.0)?\b/.test(vp[1])) viewportIssue = vp[1];
    const l = /<html[^>]*\blang="([^"]+)"/i.exec(src); lang = l ? l[1] : (lang || 'MISSING');
    if (/<main[\s>]|role="main"/.test(src)) hasMain = true;
    continue;
  }
  // reduced-motion blocks: collect selectors mentioned inside them
  const rm = [...src.matchAll(/@media[^{]*prefers-reduced-motion:\s*reduce[^{]*\{([\s\S]*?)\}\s*\}/g)];
  rm.forEach(m => m[1].split('}').forEach(rule => { const sel = rule.split('{')[0].trim(); if (sel) sel.split(',').forEach(s => reduced.add(s.trim())); }));
  const lines = src.split('\n');
  lines.forEach((line, i) => {
    const a = /animation(?:-duration)?\s*:\s*([^;]+);/.exec(line);
    if (a && !/animation-iteration-count|animation-name|animation:\s*none/.test(line)) {
      const dur = ms(a[1]); const infinite = /infinite/.test(a[1]);
      anims.push({ file: path.basename(f), line: i + 1, decl: a[1].trim().slice(0, 70), dur, infinite });
    }
    const t = /transition\s*:\s*([^;]+);/.exec(line);
    if (t && !/none/.test(t[1])) t[1].split(',').forEach(part => { const d = ms(part); if (d) trans.push({ file: path.basename(f), line: i + 1, decl: part.trim().slice(0, 60), dur: d }); });
  });
}
console.log(`# Motion inventory (${files.length} files)\n`);
console.log(`## Animations (${anims.length})`);
anims.forEach(a => console.log(` ${a.file}:${a.line}  ${a.dur ?? '?'}ms${a.infinite ? '  INFINITE' : ''}${a.dur > 400 && !a.infinite ? '  >400ms' : ''}  ${a.decl}`));
console.log(`\n## Transitions (${trans.length}); over 400ms:`);
const slow = trans.filter(t => t.dur > 400); slow.length ? slow.forEach(t => console.log(` ${t.file}:${t.line}  ${t.dur}ms  ${t.decl}`)) : console.log(' none');
console.log(`\n## Needs a stop (infinite or >5s, WCAG 2.2.2): ${anims.filter(a => a.infinite || a.dur > 5000).length}`);
console.log(`## Reduce Motion coverage: ${reduced.size} selector(s) have a prefers-reduced-motion rule` + (reduced.size ? ':\n ' + [...reduced].join(', ') : ''));
console.log(`\n## Page facts\n viewport: ${viewportIssue ? 'ZOOM DISABLED (' + viewportIssue + ') — fails WCAG 1.4.4' : 'ok'}\n lang: ${lang}\n <main> landmark: ${hasMain ? 'yes' : 'MISSING'}`);
if (opt.tokens) {
  const css = files.filter(f => f.endsWith('.css')).map(f => fs.readFileSync(f, 'utf8')).join('\n');
  const count = re => { const m = {}; for (const x of css.matchAll(re)) m[x[1].trim()] = (m[x[1].trim()] || 0) + 1; return Object.entries(m).sort((a, b) => b[1] - a[1]); };
  const show = (title, list, n = 12) => console.log(`\n## ${title}: ${list.length} distinct\n ` + list.slice(0, n).map(([k, v]) => `${k} ×${v}`).join('\n '));
  show('Border radii', count(/border-radius:\s*([^;]+);/g));
  show('Box shadows', count(/box-shadow:\s*([^;]+);/g));
  show('Font sizes', count(/font-size:\s*([^;]+);/g), 16);
  show('Font weights', count(/font-weight:\s*([^;]+);/g));
  console.log(`\n## Dashed/dotted borders: ${(css.match(/\b(dashed|dotted)\b/g) || []).length} rules`);
}

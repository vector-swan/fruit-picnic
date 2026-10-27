#!/usr/bin/env node
// Screenshots every scene in every theme and builds a contact sheet per theme
// (PNG, via Python Pillow if available; otherwise the individual files remain).
const { chromium } = require('playwright');
const { execFileSync } = require('child_process');
const { args, themes, openPage, runScene, loadScenes, path, fs } = require('./_common');
const opt = args(process.argv.slice(2));
const url = opt._[0]; if (!url) { console.error('usage: node shots.js <url> --scenes scenes.json [--themes ...] [--stub ...] [--viewport WxH] --out dir'); process.exit(2); }
const out = opt.out || 'shots'; fs.mkdirSync(out, { recursive: true });
(async () => {
  const browser = await chromium.launch(); const scenes = loadScenes(opt);
  for (const theme of themes(opt)) {
    const { page } = await openPage(browser, url, opt, theme); const made = [];
    for (const scene of scenes) {
      if (!scene.keep) { await page.goto(url); await page.waitForTimeout(600); }
      const fail = await runScene(page, scene); if (fail) { console.warn(`${theme.label}/${scene.name}: ${fail}`); continue; }
      const f = path.join(out, `${theme.label}-${String(made.length + 1).padStart(2, '0')}-${scene.name}.png`);
      await page.screenshot({ path: f }); made.push(f);
    }
    await page.context().close();
    try {
      execFileSync('python3', ['-c', `
from PIL import Image
import sys
fs=sys.argv[2:]; ims=[Image.open(f) for f in fs]; w=300
ims=[im.resize((w,int(im.height*w/im.width))) for im in ims]
per=6
for k in range(0,len(ims),per):
  row=ims[k:k+per]; W=Image.new('RGB',(w*len(row)+6*(len(row)-1),max(i.height for i in row)),'white'); x=0
  for im in row: W.paste(im,(x,0)); x+=w+6
  W.save(sys.argv[1]+('' if k==0 else '-%d'%(k//per))+'.png')`, path.join(out, `sheet-${theme.label}`), ...made], { stdio: 'inherit' });
      console.log(`${theme.label}: ${made.length} screenshots, contact sheet at ${path.join(out, 'sheet-' + theme.label + '.png')}`);
    } catch (_) { console.log(`${theme.label}: ${made.length} screenshots in ${out} (no Pillow, no contact sheet)`); }
  }
  await browser.close();
})();

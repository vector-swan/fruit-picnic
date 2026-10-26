// Copies the game into a folder ready to publish:
//   node scripts/build-www.mjs        → www/   the iPhone app is built from this
//   node scripts/build-www.mjs --web  → dist/  the website (Vercel), with the
//                                              offline file sw.js included
import { cpSync, rmSync, mkdirSync } from 'node:fs';

const web = process.argv.includes('--web');
const out = web ? 'dist' : 'www';
const FILES = ['index.html', 'style.css', 'game.js', 'tiles.js', 'tutorial.js', 'leaderboard.js', 'manifest.webmanifest', 'fonts', 'icons'];
if (web) FILES.push('sw.js');
rmSync(out, { recursive: true, force: true });
mkdirSync(out);
for (const f of FILES) cpSync(f, `${out}/${f}`, { recursive: true });
console.log(`Copied the game into ${out}/`);

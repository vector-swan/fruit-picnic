'use strict';

// ── Tile illustrations ────────────────────────────────────────────────────────
// Art is grouped into themes (see THEMES at the bottom). Shared helpers come
// first, then the bear-family theme, then the fruit ladder.

// ── Bear family theme ─────────────────────────────────────────────────────────
// One subject per tile, large and centred, so it reads at ~80px:
//   2 sleepy bear · 4 scarf · 8 sapling · 16 berry basket · 32 cream bear
//   64 house · 128 mailbox · 256 cub · 512 cub on a swing · 1024 lantern
//   2048 the whole family · 4096 / 8192 the family, crowned
// Glow is done with gradients (no SVG filters) so sliding tiles stay smooth.

const INK  = '#6B3F6E';   // soft plum outlines
const FEAT = '#4A2A4C';   // eyes, nose, mouth
const BLUSH = '#FF8FB8';
const LW = 1.5;
const LN = `stroke="${INK}" stroke-width="${LW}" stroke-linejoin="round" stroke-linecap="round"`;

const PAL = {
  brown: { hi: '#F6C8A0', lo: '#DA9A6C', inner: '#FCDCC2', ear: '#CF8F62' },
  cream: { hi: '#FFF5E0', lo: '#F3D7A9', inner: '#FFF9F0', ear: '#EBCB9B' },
  cubA:  { hi: '#F0B691', lo: '#D18B62', inner: '#F9D2B4', ear: '#C27D56' },
  cubB:  { hi: '#FFF7E8', lo: '#F7DDB5', inner: '#FFFBF4', ear: '#EFD6AF' },
};

// Backgrounds walk the rainbow: twilight blue at 2, slowly round to pink at 2048
const BG = {
  2: '#C9D5F6',     // twilight blue
  4: '#C8E4FA',     // sky blue
  8: '#C6EFEE',     // aqua
  16: '#D2F2D3',    // mint
  32: '#E5F4C4',    // spring green
  64: '#FFF2BC',    // butter yellow
  128: '#FFE3BC',   // apricot
  256: '#FFD7C4',   // peach
  512: '#FFCCC8',   // coral
  1024: '#FFCCDF',  // rose
  2048: '#FFBDDB',  // pink
  4096: '#FFB2D4', 8192: '#FFA6CC',
};

// ── Small parts ───────────────────────────────────────────────────────────────
const star = (x, y, s, color = '#FFFFFF', o = 0.9) =>
  `<path d="M ${x},${y - s} Q ${x},${y} ${x + s},${y} Q ${x},${y} ${x},${y + s} Q ${x},${y} ${x - s},${y} Q ${x},${y} ${x},${y - s} Z" fill="${color}" opacity="${o}"/>`;

const heart = (x, y, s, color = '#FF6FA5') =>
  `<g transform="translate(${x},${y}) scale(${s})"><path d="M0,2.8 C-3.6,0 -3.6,-3.2 -1.7,-3.2 C-0.6,-3.2 0,-2.3 0,-1.7 C0,-2.3 0.6,-3.2 1.7,-3.2 C3.6,-3.2 3.6,0 0,2.8 Z" fill="${color}" stroke="${INK}" stroke-width="${0.9 / s}" stroke-linejoin="round"/><ellipse cx="-1.2" cy="-1.6" rx="0.7" ry="0.45" fill="white" opacity="0.8"/></g>`;

function backdrop(c, v, o = {}) {
  const dark = !!c.dark;   // night tiles: a faint warm glow and golden sparkles
  const { hx = 50, hy = 52, hr = 44, color = dark ? '#FFE9A8' : '#FFFFFF', op = dark ? 0.35 : 0.75 } = o;
  c.defs += `<radialGradient id="${c.p}bg" cx="50%" cy="45%" r="70%"><stop offset="0" stop-color="#FFFFFF" stop-opacity="${dark ? 0.1 : 0.55}"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0"/></radialGradient>
<radialGradient id="${c.p}halo"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="0.6" stop-color="${color}" stop-opacity="${op * 0.45}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
  const sc = dark ? '#FFF6C4' : '#FFFFFF';
  return `<rect width="100" height="100" fill="${c.bg[v]}"/><rect width="100" height="100" fill="url(#${c.p}bg)"/>`
    + `<circle cx="${hx}" cy="${hy}" r="${hr}" fill="url(#${c.p}halo)"/>`
    + star(14, 80, 3, sc, 0.9) + star(88, 32, 2.4, sc, 0.85) + star(82, 86, 3.2, sc, 0.9) + star(20, 34, 2, sc, 0.75)
    + `<circle cx="10" cy="56" r="1.1" fill="${sc}" opacity="0.7"/><circle cx="92" cy="60" r="1.3" fill="${sc}" opacity="0.7"/><circle cx="70" cy="14" r="1" fill="${sc}" opacity="0.6"/>`;
}

function ground(c, cx, cy, rx) {
  return `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="${rx * 0.14}" fill="#8A5A9A" opacity="0.16"/>`;
}

// A bear head (radius r) centred at (cx, cy)
function face(c, cx, cy, r, pal, o = {}) {
  const id = `${c.p}f${c.n++}`;
  c.defs += `<radialGradient id="${id}" cx="35%" cy="28%" r="85%"><stop offset="0" stop-color="${pal.hi}"/><stop offset="1" stop-color="${pal.lo}"/></radialGradient>
<linearGradient id="${id}s" x1="0" y1="0" x2="0" y2="1"><stop offset="0.55" stop-color="${pal.lo}" stop-opacity="0"/><stop offset="1" stop-color="${pal.lo}" stop-opacity="0.6"/></linearGradient>`;
  let s = '';
  for (const sg of [-1, 1]) {
    s += `<circle cx="${cx + sg * r * 0.78}" cy="${cy - r * 0.72}" r="${r * 0.36}" fill="${pal.ear}" ${LN}/>`;
    s += `<circle cx="${cx + sg * r * 0.78}" cy="${cy - r * 0.68}" r="${r * 0.2}" fill="${pal.inner}"/>`;
  }
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id})" ${LN}/>`;
  s += `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${id}s)"/>`;
  s += `<ellipse cx="${cx - r * 0.38}" cy="${cy - r * 0.55}" rx="${r * 0.3}" ry="${r * 0.15}" fill="white" opacity="0.4" transform="rotate(-28 ${cx - r * 0.38} ${cy - r * 0.55})"/>`;
  if (o.tuft) s += `<path d="M ${cx - r * 0.14},${cy - r * 0.97} q ${-r * 0.12},${-r * 0.3} ${r * 0.1},${-r * 0.36} q ${r * 0.14},${r * 0.14} ${r * 0.04},${r * 0.36}" fill="${pal.lo}" ${LN}/>`;
  // muzzle, nose, mouth
  s += `<ellipse cx="${cx}" cy="${cy + r * 0.36}" rx="${r * 0.46}" ry="${r * 0.33}" fill="${pal.inner}"/>`;
  s += `<ellipse cx="${cx}" cy="${cy + r * 0.2}" rx="${r * 0.16}" ry="${r * 0.11}" fill="${FEAT}"/>`;
  s += `<ellipse cx="${cx - r * 0.05}" cy="${cy + r * 0.17}" rx="${r * 0.05}" ry="${r * 0.03}" fill="white" opacity="0.8"/>`;
  s += `<path d="M ${cx},${cy + r * 0.3} L ${cx},${cy + r * 0.38} M ${cx - r * 0.17},${cy + r * 0.4} q ${r * 0.085},${r * 0.12} ${r * 0.17},0 q ${r * 0.085},${r * 0.12} ${r * 0.17},0" stroke="${FEAT}" stroke-width="${Math.max(1.1, r * 0.06)}" fill="none" stroke-linecap="round" stroke-linejoin="round"/>`;
  // eyes
  const ex = r * 0.42, ey = cy - r * 0.1, sw = Math.max(1.4, r * 0.085);
  for (const sg of [-1, 1]) {
    const x = cx + sg * ex;
    if (o.closed) {
      s += `<path d="M ${x - r * 0.15},${ey + r * 0.05} q ${r * 0.15},${-r * 0.24} ${r * 0.3},0" stroke="${FEAT}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
    } else if (o.sleepy) {
      s += `<path d="M ${x - r * 0.15},${ey} q ${r * 0.15},${r * 0.2} ${r * 0.3},0" stroke="${FEAT}" stroke-width="${sw}" fill="none" stroke-linecap="round"/>`;
      s += `<path d="M ${x + sg * r * 0.15},${ey + r * 0.02} l ${sg * r * 0.08},${-r * 0.06}" stroke="${FEAT}" stroke-width="${sw * 0.6}" stroke-linecap="round"/>`;
    } else {
      const er = r * (o.big ? 0.17 : 0.13);
      s += `<circle cx="${x}" cy="${ey}" r="${er}" fill="${FEAT}"/>`;
      s += `<circle cx="${x - er * 0.35}" cy="${ey - er * 0.38}" r="${er * 0.42}" fill="white"/>`;
      s += `<circle cx="${x + er * 0.4}" cy="${ey + er * 0.4}" r="${er * 0.2}" fill="white" opacity="0.85"/>`;
    }
  }
  s += `<ellipse cx="${cx - r * 0.62}" cy="${cy + r * 0.27}" rx="${r * 0.21}" ry="${r * 0.13}" fill="${BLUSH}" opacity="0.65"/>`;
  s += `<ellipse cx="${cx + r * 0.62}" cy="${cy + r * 0.27}" rx="${r * 0.21}" ry="${r * 0.13}" fill="${BLUSH}" opacity="0.65"/>`;
  if (o.bow) {
    const bx = cx + r * 0.78, by = cy - r * 1.02;
    s += `<g fill="#FF7FB8" ${LN}><ellipse cx="${bx - r * 0.25}" cy="${by}" rx="${r * 0.25}" ry="${r * 0.16}" transform="rotate(-20 ${bx - r * 0.25} ${by})"/><ellipse cx="${bx + r * 0.25}" cy="${by}" rx="${r * 0.25}" ry="${r * 0.16}" transform="rotate(20 ${bx + r * 0.25} ${by})"/></g>`;
    s += `<circle cx="${bx}" cy="${by}" r="${r * 0.11}" fill="#FF5FA5" ${LN}/><ellipse cx="${bx - r * 0.3}" cy="${by - r * 0.05}" rx="${r * 0.08}" ry="${r * 0.04}" fill="white" opacity="0.7"/>`;
  }
  if (o.scarf) {
    const y = cy + r * 0.86;
    s += `<rect x="${cx - r * 0.95}" y="${y}" width="${r * 1.9}" height="${r * 0.44}" rx="${r * 0.22}" fill="#FF6B7D" ${LN}/>`;
    s += `<rect x="${cx + r * 0.22}" y="${y + r * 0.22}" width="${r * 0.44}" height="${r * 0.95}" rx="${r * 0.14}" fill="#FF6B7D" ${LN}/>`;
    for (const k of [-0.55, -0.15]) s += `<rect x="${cx + k * r * 1.6}" y="${y + r * 0.04}" width="${r * 0.16}" height="${r * 0.36}" rx="${r * 0.06}" fill="white" opacity="0.45"/>`;
    s += `<rect x="${cx + r * 0.3}" y="${y + r * 0.7}" width="${r * 0.28}" height="${r * 0.12}" rx="${r * 0.05}" fill="white" opacity="0.45"/>`;
  }
  if (o.crown) {
    const y0 = cy - r * 0.9, w = r * 0.95, h = r * 0.6, g = `${c.p}cr${c.n++}`;
    c.defs += `<linearGradient id="${g}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#FFF08A"/><stop offset="1" stop-color="#FFC531"/></linearGradient>`;
    s += `<path d="M ${cx - w / 2},${y0} L ${cx - w / 2},${y0 - h} L ${cx - w / 6},${y0 - h * 0.45} L ${cx},${y0 - h} L ${cx + w / 6},${y0 - h * 0.45} L ${cx + w / 2},${y0 - h} L ${cx + w / 2},${y0} Z" fill="url(#${g})" ${LN}/>`;
    s += `<circle cx="${cx}" cy="${y0 - h * 0.95}" r="${r * 0.08}" fill="#FF5FA5"/><circle cx="${cx - w / 2}" cy="${y0 - h}" r="${r * 0.06}" fill="#7FE0FF"/><circle cx="${cx + w / 2}" cy="${y0 - h}" r="${r * 0.06}" fill="#7FE0FF"/>`;
  }
  return s;
}

function tile(v, build, bg = BG, key = 'b', dark = false) {
  const c = { p: `${key}${v}`, n: 0, defs: '', bg, dark };
  const body = build(c);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${c.defs}</defs>${body}</svg>`;
}

const grad = (c, id, a, b) => {
  c.defs += `<linearGradient id="${c.p}${id}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></linearGradient>`;
  return `url(#${c.p}${id})`;
};
const rgrad = (c, id, a, b) => {
  c.defs += `<radialGradient id="${c.p}${id}" cx="35%" cy="30%" r="75%"><stop offset="0" stop-color="${a}"/><stop offset="1" stop-color="${b}"/></radialGradient>`;
  return `url(#${c.p}${id})`;
};

// ── Family scene (2048 and up) ────────────────────────────────────────────────
function family(c, v, o = {}) {
  let s = backdrop(c, v, { hy: 56, hr: 48 });
  s += face(c, 32, 48, 17, PAL.brown, { closed: true, scarf: true, crown: o.crown });
  s += face(c, 70, 48, 17, PAL.cream, { closed: true, bow: true, crown: o.crown });
  s += face(c, 38, 79, 12, PAL.cubA, { closed: true, crown: o.crown });
  s += face(c, 63, 79, 12, PAL.cubB, { big: true, crown: o.crown });
  s += heart(51, 20, 1.5) + heart(51, 66, 1.1, '#FFB3D1');
  if (o.hearts) s += heart(14, 70, 1.1, '#FFB3D1') + heart(88, 70, 1.3) + heart(50, 92, 1) + star(50, 10, 4, '#FFFFFF');
  if (o.frame) {
    const g = grad(c, 'gold', '#FFF08A', '#FFB82E');
    s += `<rect x="1.8" y="1.8" width="96.4" height="96.4" rx="9" fill="none" stroke="${g}" stroke-width="3.2"/>`;
    s += star(92, 8, 4, '#FFFFFF') + star(8, 92, 3.4, '#FFFFFF');
  }
  return s;
}

// ── Tiles ─────────────────────────────────────────────────────────────────────
const BEAR_ART = {

  // A sleepy bear, all alone.
  2: tile(2, c => backdrop(c, 2, { hy: 56 }) + ground(c, 50, 86, 26)
    + face(c, 50, 56, 29, PAL.brown, { sleepy: true })
    + `<circle cx="84" cy="16" r="13" fill="#FFF6C8" opacity="0.35"/><path d="M 82,7 a 9,9 0 1 0 9,13 a 7,7 0 1 1 -9,-13 Z" fill="#FFF3B0" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`
    + star(60, 10, 2.4, '#FFFFFF') + star(94, 36, 2, '#FFFFFF')
    + `<g fill="none" stroke="#7C83C9" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M 66,20 h 6 l -6,7 h 6"/><path d="M 58,14 h 4 l -4,4.6 h 4"/></g>`),

  // A warm red scarf.
  4: tile(4, c => backdrop(c, 4, { hy: 52 }) + ground(c, 50, 90, 26)
    + face(c, 50, 48, 28, PAL.brown, { scarf: true })),

  // A sapling, freshly planted.
  8: tile(8, c => {
    const leaf = grad(c, 'l', '#B6F08E', '#5FC055'), dirt = grad(c, 'd', '#C79563', '#9C6E45');
    return backdrop(c, 8, { hy: 54 })
      + `<ellipse cx="50" cy="82" rx="28" ry="9" fill="${dirt}" ${LN}/><ellipse cx="42" cy="79" rx="8" ry="2.4" fill="white" opacity="0.25"/>`
      + `<path d="M 50,80 Q 48,62 50,44" fill="none" stroke="${INK}" stroke-width="5.4" stroke-linecap="round"/><path d="M 50,80 Q 48,62 50,44" fill="none" stroke="#5BAE50" stroke-width="3" stroke-linecap="round"/>`
      + `<path d="M 49,60 Q 20,58 22,36 Q 46,36 49,60 Z" fill="${leaf}" ${LN}/><path d="M 47,56 Q 34,52 27,41" fill="none" stroke="#3E8F43" stroke-width="1" opacity="0.6"/>`
      + `<path d="M 51,52 Q 80,50 78,26 Q 54,28 51,52 Z" fill="${leaf}" ${LN}/><path d="M 53,48 Q 66,44 73,31" fill="none" stroke="#3E8F43" stroke-width="1" opacity="0.6"/>`
      + `<path d="M 50,46 Q 40,34 50,18 Q 60,34 50,46 Z" fill="${leaf}" ${LN}/><path d="M 50,43 L 50,24" stroke="#3E8F43" stroke-width="1" opacity="0.6"/>`
      + `<ellipse cx="30" cy="42" rx="3" ry="1.4" fill="white" opacity="0.5" transform="rotate(-30 30 42)"/>`
      + `<g fill="#9ADBFF" stroke="${INK}" stroke-width="0.8"><path d="M 80,56 q -3,5 0,7 q 3,-2 0,-7 Z"/><path d="M 20,64 q -2.4,4 0,5.6 q 2.4,-1.6 0,-5.6 Z"/></g>`
      + star(78, 12, 3.5, '#FFF') + heart(26, 20, 1.1, '#FFB3D1');
  }),

  // A basket of berries.
  16: tile(16, c => {
    const wood = grad(c, 'w', '#E2A965', '#BC8048'), rim = grad(c, 'r', '#EDBB7A', '#CF9558');
    const berry = rgrad(c, 'b', '#FF8DA3', '#D92A58');
    const b = (x, y, r) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${berry}" ${LN}/><ellipse cx="${x - r * 0.35}" cy="${y - r * 0.4}" rx="${r * 0.22}" ry="${r * 0.14}" fill="white" opacity="0.8"/>`;
    return backdrop(c, 16, { hy: 58 }) + ground(c, 50, 88, 30)
      + `<path d="M 28,52 Q 50,2 72,52" fill="none" stroke="${INK}" stroke-width="5.6" stroke-linecap="round"/><path d="M 28,52 Q 50,2 72,52" fill="none" stroke="#D49A5C" stroke-width="3" stroke-linecap="round"/>`
      + `<path d="M 19,50 L 81,50 L 74,84 Q 50,90 26,84 Z" fill="${wood}" ${LN}/>`
      + `<g fill="none" stroke="#A8703E" stroke-width="1" opacity="0.7"><path d="M 21,60 Q 50,67 79,60"/><path d="M 23,70 Q 50,77 77,70"/><path d="M 25,79 Q 50,85 75,79"/><path d="M 40,52 L 38,84 M 60,52 L 62,84"/></g>`
      + b(33, 46, 8) + b(67, 46, 8) + b(50, 42, 9) + b(41, 34, 7.5) + b(59, 34, 7.5)
      + `<path d="M 50,31 q 6,-8 13,-5 q -3,8 -13,5 Z" fill="#7ED36E" ${LN}/>`
      + `<rect x="15" y="46" width="70" height="9" rx="4.5" fill="${rim}" ${LN}/>`;
  }),

  // A second bear arrives, a cream one with a bow.
  32: tile(32, c => backdrop(c, 32, { hy: 54 }) + ground(c, 50, 90, 26)
    + face(c, 50, 52, 29, PAL.cream, { bow: true, closed: true })
    + heart(18, 28, 1.3) + heart(84, 22, 1)),

  // A little house of their own.
  64: tile(64, c => {
    const roof = grad(c, 'rf', '#FF9DB4', '#EE6A88'), wall = grad(c, 'wl', '#FFFBF2', '#FFEBD2'), pane = grad(c, 'pn', '#E6F6FF', '#A9D8F5');
    const win = x => `<rect x="${x}" y="56" width="11" height="11" rx="2" fill="${pane}" ${LN}/><path d="M ${x + 5.5},56 v 11 M ${x},61.5 h 11" stroke="${INK}" stroke-width="0.9"/>`;
    return backdrop(c, 64, { hy: 56 }) + ground(c, 50, 86, 36)
      + `<circle cx="22" cy="82" r="7" fill="#7ED36E" ${LN}/><circle cx="29" cy="85" r="5.4" fill="#92E080" ${LN}/>`
      + `<rect x="22" y="46" width="56" height="40" rx="3" fill="${wall}" ${LN}/>`
      + `<path d="M 13,51 L 50,17 L 87,51 Z" fill="${roof}" ${LN}/><path d="M 22,47 L 49,22" stroke="white" stroke-width="2.4" stroke-linecap="round" opacity="0.4"/>`
      + `<circle cx="50" cy="38" r="5.2" fill="${pane}" ${LN}/>`
      + win(27) + win(62)
      + `<rect x="43" y="62" width="14" height="24" rx="7" fill="#C98F5F" ${LN}/><circle cx="53.4" cy="75" r="1.4" fill="#FFE27A"/>`
      + `<circle cx="72" cy="85" r="2.4" fill="#FF8FB8" ${LN}/><circle cx="78" cy="86.5" r="2.4" fill="#FFD84A" ${LN}/>`
      + heart(84, 20, 1.2);
  }),

  // A mailbox: the house is now somewhere you get letters.
  128: tile(128, c => {
    const box = grad(c, 'bx', '#8DC3FF', '#5B93E6');
    return backdrop(c, 128, { hy: 52 })
      + `<ellipse cx="50" cy="88" rx="30" ry="5" fill="#9ADF8A" ${LN}/><path d="M 30,87 l 2,-6 l 2,6 M 68,87 l 2,-7 l 2,7" fill="none" stroke="#5FBF55" stroke-width="1.6" stroke-linecap="round"/>`
      + `<circle cx="27" cy="85" r="2.3" fill="#FF8FB8" ${LN}/><circle cx="74" cy="84" r="2.3" fill="#FFD84A" ${LN}/>`
      + `<rect x="47" y="52" width="6" height="36" rx="1.5" fill="#CF9A66" ${LN}/>`
      + `<g transform="rotate(-8 44 26)"><rect x="32" y="12" width="24" height="18" rx="2" fill="white" ${LN}/><path d="M 32,13 L 44,23 L 56,13" fill="none" stroke="${INK}" stroke-width="1.1" stroke-linejoin="round"/></g>`
      + `<rect x="22" y="28" width="56" height="28" rx="14" fill="${box}" ${LN}/><path d="M 30,34 q 20,-4 40,0" stroke="white" stroke-width="2.4" stroke-linecap="round" fill="none" opacity="0.5"/>`
      + `<path d="M 66,29 L 66,55" stroke="${INK}" stroke-width="1.3"/><circle cx="70.5" cy="42" r="1.7" fill="#FFE27A" ${LN}/><rect x="29" y="40" width="22" height="7" rx="3" fill="white" opacity="0.9" ${LN}/>`
      + `<rect x="74" y="12" width="3" height="22" fill="#FF6B7D" ${LN}/><rect x="77" y="12" width="11" height="8" rx="1.5" fill="#FF6B7D" ${LN}/>`
      + heart(17, 24, 1.1) + star(86, 56, 3.4);
  }),

  // A cub!
  256: tile(256, c => backdrop(c, 256, { hy: 56 }) + ground(c, 50, 88, 24)
    + face(c, 50, 57, 25, PAL.cubA, { tuft: true, big: true })
    + heart(20, 26, 1.4) + heart(82, 30, 1.1, '#FFB3D1') + star(80, 78, 3)),

  // The cub on a swing.
  512: tile(512, c => {
    const leaf = grad(c, 'l', '#B6F08E', '#5FC055'), seat = grad(c, 's', '#E2A965', '#BC8048');
    const lf = (x, y, rot) => `<ellipse cx="${x}" cy="${y}" rx="8" ry="4.2" transform="rotate(${rot} ${x} ${y})" fill="${leaf}" ${LN}/>`;
    return backdrop(c, 512, { hy: 52 })
      + `<path d="M 6,14 Q 50,2 94,14" fill="none" stroke="${INK}" stroke-width="6.4" stroke-linecap="round"/><path d="M 6,14 Q 50,2 94,14" fill="none" stroke="#B88454" stroke-width="3.8" stroke-linecap="round"/>`
      + lf(18, 20, 30) + lf(80, 19, -30) + lf(34, 9, -15) + lf(66, 8, 15)
      + `<path d="M 33,10 L 33,70 M 67,10 L 67,70" stroke="${INK}" stroke-width="3.4" stroke-linecap="round"/><path d="M 33,10 L 33,70 M 67,10 L 67,70" stroke="#E5C49A" stroke-width="1.5" stroke-linecap="round"/>`
      + `<ellipse cx="50" cy="66" rx="14" ry="12" fill="${PAL.cubB.lo}" ${LN}/>`
      + face(c, 50, 48, 18, PAL.cubB, { closed: true })
      + `<circle cx="34" cy="60" r="4.2" fill="${PAL.cubB.ear}" ${LN}/><circle cx="66" cy="60" r="4.2" fill="${PAL.cubB.ear}" ${LN}/>`
      + `<rect x="24" y="74" width="52" height="8" rx="4" fill="${seat}" ${LN}/>`
      + heart(14, 52, 1.2) + heart(88, 44, 1, '#FFB3D1') + star(84, 74, 3.2) + star(16, 82, 2.6);
  }),

  // Evening: the lantern is lit.
  1024: tile(1024, c => {
    const glass = grad(c, 'g', '#FFF6BF', '#FFC94D'), flame = grad(c, 'f', '#FFE27A', '#FF8A3D'), metal = grad(c, 'm', '#D3A06C', '#A8744A');
    const fly = (x, y) => `<circle cx="${x}" cy="${y}" r="4.5" fill="#FFD25A" opacity="0.35"/><circle cx="${x}" cy="${y}" r="1.8" fill="#FFC531" stroke="${INK}" stroke-width="0.5"/>`;
    return backdrop(c, 1024, { hy: 50, hr: 46, color: '#FFE08A', op: 0.55 })
      + `<path d="M 38,24 Q 50,0 62,24" fill="none" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M 38,24 Q 50,0 62,24" fill="none" stroke="#E5B97E" stroke-width="2.6" stroke-linecap="round"/>`
      + `<path d="M 35,31 L 65,31 L 58,20 L 42,20 Z" fill="${metal}" ${LN}/><circle cx="50" cy="18" r="2.8" fill="${metal}" ${LN}/>`
      + `<path d="M 36,31 L 64,31 Q 71,52 64,74 L 36,74 Q 29,52 36,31 Z" fill="${glass}" ${LN}/>`
      + `<path d="M 44,31 Q 41,52 44,74 M 56,31 Q 59,52 56,74" stroke="${INK}" stroke-width="1" fill="none" opacity="0.55"/>`
      + `<path d="M 50,68 C 40,60 44,48 50,38 C 56,48 60,60 50,68 Z" fill="${flame}" ${LN}/><path d="M 50,65 C 46,60 47,54 50,49 C 53,54 54,60 50,65 Z" fill="#FFF8D0"/>`
      + `<path d="M 38,38 q -2,12 0,22" stroke="white" stroke-width="2" stroke-linecap="round" fill="none" opacity="0.55"/>`
      + `<rect x="32" y="74" width="36" height="8" rx="3" fill="${metal}" ${LN}/>`
      + fly(18, 40) + fly(84, 52) + fly(76, 22) + fly(24, 72) + fly(82, 80);
  }),

  // Home at last: the whole family together.
  2048: tile(2048, c => family(c, 2048)),

  // Beyond 2048: the same family, crowned.
  4096: tile(4096, c => family(c, 4096, { crown: true, frame: true })),
  8192: tile(8192, c => family(c, 8192, { crown: true, frame: true, hearts: true })),

};

// ── Fruit ladder theme ────────────────────────────────────────────────────────
// Bigger fruit = bigger number: cherry, strawberry, grape, lemon, orange, apple,
// peach, pear, pineapple, melon, watermelon, then golden watermelons.
// Backgrounds run purple → blue → green → yellow → orange → pink.

const FRUIT_BG = {
  2: '#E3D4FA', 4: '#D6DBFB', 8: '#CFE3FB', 16: '#CDEFF2', 32: '#D3F2D6',
  64: '#E6F4C6', 128: '#FFF3BC', 256: '#FFE3B8', 512: '#FFD4B4',
  1024: '#FFCFCB', 2048: '#FFC2DE', 4096: '#FFB4D6', 8192: '#FFA6CC', 16384: '#FF9AC4',
};

// Kawaii face: s is roughly the fruit's radius
function kface(cx, cy, s, o = {}) {
  const ex = s * 0.36, er = Math.max(2, s * 0.115);
  let f = '';
  for (const sg of [-1, 1]) {
    const x = cx + sg * ex;
    if (o.wink && sg === 1) {
      f += `<path d="M ${x - er * 1.2},${cy + er * 0.3} q ${er * 1.2},${-er * 1.6} ${er * 2.4},0" stroke="${FEAT}" stroke-width="${er * 0.8}" fill="none" stroke-linecap="round"/>`;
    } else {
      f += `<circle cx="${x}" cy="${cy}" r="${er}" fill="${FEAT}"/><circle cx="${x - er * 0.35}" cy="${cy - er * 0.4}" r="${er * 0.42}" fill="white"/>`;
    }
  }
  f += `<path d="M ${cx - s * 0.12},${cy + s * 0.13} q ${s * 0.12},${s * 0.13} ${s * 0.24},0" stroke="${FEAT}" stroke-width="${Math.max(1.3, s * 0.065)}" fill="none" stroke-linecap="round"/>`;
  for (const sg of [-1, 1]) f += `<ellipse cx="${cx + sg * s * 0.56}" cy="${cy + s * 0.14}" rx="${s * 0.15}" ry="${s * 0.09}" fill="#FFB0C8" opacity="0.85"/>`;
  return f;
}

const shine = (x, y, rx, ry, rot = -30) =>
  `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" transform="rotate(${rot} ${x} ${y})" fill="white" opacity="0.5"/>`;

const leafAt = (x, y, rot, len, fill) =>
  `<g transform="translate(${x},${y}) rotate(${rot})"><path d="M 0,0 Q ${len * 0.5},${-len * 0.42} ${len},0 Q ${len * 0.5},${len * 0.42} 0,0 Z" fill="${fill}" ${LN}/><path d="M ${len * 0.15},0 L ${len * 0.8},0" stroke="#3E8F43" stroke-width="0.8" opacity="0.6"/></g>`;

const stem = d =>
  `<path d="${d}" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="${d}" fill="none" stroke="#9A6A3E" stroke-width="2.2" stroke-linecap="round"/>`;

function crownAt(c, cx, y0, w, h) {
  const g = grad(c, `cr${c.n++}`, '#FFF08A', '#FFC531');
  return `<path d="M ${cx - w / 2},${y0} L ${cx - w / 2},${y0 - h} L ${cx - w / 6},${y0 - h * 0.45} L ${cx},${y0 - h} L ${cx + w / 6},${y0 - h * 0.45} L ${cx + w / 2},${y0 - h} L ${cx + w / 2},${y0} Z" fill="${g}" ${LN}/>`
    + `<circle cx="${cx}" cy="${y0 - h * 0.95}" r="1.8" fill="#FF5FA5"/><circle cx="${cx - w / 2}" cy="${y0 - h}" r="1.4" fill="#7FE0FF"/><circle cx="${cx + w / 2}" cy="${y0 - h}" r="1.4" fill="#7FE0FF"/>`;
}

// Each fruit's drawing is kept so Cocoa Night can redraw it on a night background
const FRUIT_BUILD = {};
const fruitTile = (v, build) => { FRUIT_BUILD[v] = build; return tile(v, build, FRUIT_BG, 'fr'); };

function watermelon(c, v, o = {}) {
  const gold = !!o.gold;
  const fruit = FRUIT_BODY.watermelon(c, gold);
  let s = backdrop(c, v, { hy: 58, hr: 46 }) + ground(c, 50, 92, 32)
    + fruit
    + `<ellipse cx="50" cy="62" rx="17" ry="11" fill="white" opacity="0.28"/>`
    + kface(50, 61, 30);
  if (gold) s += crownAt(c, 50, 25, 26, 14);
  if (o.frame) {
    const g = grad(c, 'gold', '#FFF08A', '#FFB82E');
    s += `<rect x="1.8" y="1.8" width="96.4" height="96.4" rx="9" fill="none" stroke="${g}" stroke-width="3.2"/>`
      + star(92, 8, 4) + star(8, 92, 3.4);
  }
  if (o.hearts) s += heart(14, 30, 1.2) + heart(86, 76, 1.3, '#FFB3D1') + star(88, 30, 3.4);
  return s;
}

// Fruit drawings without the tile background or face, in tile coordinates
// (100 × 100, centred around 50,58). The game tiles add a backdrop and face;
// the picnic basket places them, smaller, inside the basket.
const FRUIT_BODY = {
  grape(c) {
    const g = rgrad(c, 'g', '#D2AEFF', '#7B4FD0'), lf = grad(c, 'l', '#B6F08E', '#5FC055');
    const pts = [[34, 40], [50, 38], [66, 40], [36, 54], [50, 53], [64, 54], [42, 67], [58, 67], [50, 79]];
    return stem('M 50,32 Q 50,24 54,19') + leafAt(52, 25, -30, 18, lf)
      + pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="9" fill="${g}" ${LN}/>` + shine(x - 3, y - 3.5, 2.4, 1.3)).join('');
  },
  lemon(c) {
    const y = grad(c, 'y', '#FFF6A6', '#FFD23F'), lf = grad(c, 'l', '#B6F08E', '#5FC055');
    return `<ellipse cx="23" cy="63" rx="5" ry="3.6" transform="rotate(-12 23 63)" fill="#FFD84A" ${LN}/><ellipse cx="77" cy="52" rx="5" ry="3.6" transform="rotate(-12 77 52)" fill="#FFD84A" ${LN}/>`
      + `<ellipse cx="50" cy="58" rx="28" ry="21" transform="rotate(-12 50 58)" fill="${y}" ${LN}/>`
      + shine(38, 47, 7, 3)
      + leafAt(64, 40, -40, 17, lf) + stem('M 62,41 q 1,-4 4,-6');
  },
  orange(c) {
    const o = rgrad(c, 'o', '#FFCB80', '#FF8A2A'), lf = grad(c, 'l', '#B6F08E', '#5FC055');
    const dots = [[36, 46], [62, 42], [70, 62], [32, 66], [56, 78], [44, 80], [68, 74]]
      .map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.9" fill="#D9661A" opacity="0.4"/>`).join('');
    return `<circle cx="50" cy="58" r="28" fill="${o}" ${LN}/>` + dots + shine(38, 44, 7, 3.4)
      + stem('M 50,31 q 0,-5 2,-7') + leafAt(51, 29, -25, 19, lf);
  },
  apple(c) {
    const r = rgrad(c, 'a', '#FF9A9A', '#DA2B3D'), lf = grad(c, 'l', '#B6F08E', '#5FC055');
    return `<path d="M 50,36 C 40,27 20,31 20,52 C 20,74 38,88 50,81 C 62,88 80,74 80,52 C 80,31 60,27 50,36 Z" fill="${r}" ${LN}/>`
      + shine(33, 45, 6, 3.4)
      + stem('M 50,38 Q 49,30 53,22') + leafAt(52, 30, -30, 19, lf);
  },
  pear(c) {
    const p = rgrad(c, 'pr', '#F2FBB0', '#A6D24E'), lf = grad(c, 'l', '#B6F08E', '#5FC055');
    return `<path d="M 50,26 C 41,26 39,37 39,44 C 28,50 24,63 28,73 C 33,86 67,86 72,73 C 76,63 72,50 61,44 C 61,37 59,26 50,26 Z" fill="${p}" ${LN}/>`
      + shine(38, 56, 5, 3)
      + stem('M 50,28 Q 50,19 54,14') + leafAt(53, 19, -20, 17, lf);
  },
  watermelon(c, gold = false) {
    const body = rgrad(c, 'wm', gold ? '#FFF6A8' : '#A6EC86', gold ? '#F2B32E' : '#43AE55');
    const clip = `${c.p}wmc`;
    c.defs += `<clipPath id="${clip}"><circle cx="50" cy="58" r="35"/></clipPath>`;
    let stripes = '';
    for (const x of [24, 37, 50, 63, 76]) {
      let d = `M ${x},18`;
      for (let y = 18; y < 98; y += 8) d += ` l 3,4 l -3,4`;
      stripes += `<path d="${d}" fill="none" stroke="${gold ? '#D98E1C' : '#2A8A40'}" stroke-width="3.6" stroke-linejoin="round" opacity="0.8"/>`;
    }
    return `<circle cx="50" cy="58" r="35" fill="${body}" ${LN}/>`
      + `<g clip-path="url(#${clip})">${stripes}</g>`
      + `<circle cx="50" cy="58" r="35" fill="none" ${LN}/>`
      + shine(36, 38, 9, 4.5)
      + stem('M 50,24 q 2,-7 8,-6');
  },
};

// ── Fruit Picnic bonus round (past the 2048 watermelon) ───────────────────────
// 4096 picnic basket · 8192 slice of fruit tart · 16384 celebration cake, each in
// the golden frame of the golden watermelon.
// Golden frame + sparkles (same look as watermelon(..., { frame: true }))
function fb_frame(c) {
  const g = grad(c, 'gold', '#FFF08A', '#FFB82E');
  return `<rect x="1.8" y="1.8" width="96.4" height="96.4" rx="9" fill="none" stroke="${g}" stroke-width="3.2"/>`
    + star(92, 8, 4) + star(8, 92, 3.4);
}

// Happy closed-eye face (^ ^) with an open smile; s is roughly the object's radius
function fb_hface(cx, cy, s) {
  const ex = s * 0.36, er = Math.max(2, s * 0.115);
  let f = '';
  for (const sg of [-1, 1]) {
    const x = cx + sg * ex;
    f += `<path d="M ${x - er * 1.2},${cy + er * 0.4} q ${er * 1.2},${-er * 1.7} ${er * 2.4},0" stroke="${FEAT}" stroke-width="${er * 0.8}" fill="none" stroke-linecap="round"/>`;
  }
  const mw = s * 0.15, my = cy + s * 0.12;
  f += `<path d="M ${cx - mw},${my} Q ${cx},${my + mw * 1.5} ${cx + mw},${my} Z" fill="${FEAT}" stroke="${FEAT}" stroke-width="${Math.max(1, s * 0.04)}" stroke-linejoin="round"/>`;
  f += `<ellipse cx="${cx}" cy="${my + mw * 0.75}" rx="${mw * 0.45}" ry="${mw * 0.3}" fill="#FF8FA8"/>`;
  for (const sg of [-1, 1]) f += `<ellipse cx="${cx + sg * s * 0.58}" cy="${cy + s * 0.15}" rx="${s * 0.15}" ry="${s * 0.09}" fill="#FFB0C8" opacity="0.9"/>`;
  return f;
}

// A FRUIT_BODY drawing placed smaller (same as the picnic basket's place()),
// optionally with its kawaii face [fx, fy, fs] in the fruit's own coordinates
function fb_place(c, draw, x, y, k, tilt = 0, fc) {
  const part = draw(c)
    .split(LN).join(`stroke="${INK}" stroke-width="${(LW / k).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"`)
    .replace(/stroke-width="4\.4"/g, `stroke-width="${(2.6 + LW * 2 / k).toFixed(2)}"`)
    .replace(/stroke-width="2\.2"/g, 'stroke-width="2.6"');
  const f = fc ? kface(fc[0], fc[1], fc[2], fc[3] || {}) : '';
  return `<g transform="translate(${(x - 50 * k).toFixed(2)},${(y - 58 * k).toFixed(2)}) scale(${k}) rotate(${tilt} 50 58)">${part}${f}</g>`;
}

// The app-icon picnic basket, drawn with this tile's ids
function fb_basket(c, o = {}) {
  const P = c.p;
  const wood = grad(c, 'bw', '#E2A866', '#B9783F'), rimG = grad(c, 'br', '#EDBB7A', '#C98A4E');
  const handleG = grad(c, 'bh', '#E8B474', '#C48546');
  const body = 'M 12,67 L 15,86 Q 16,91 22,91 L 78,91 Q 84,91 85,86 L 88,67 Z';
  c.defs += `<clipPath id="${P}bc"><path d="${body}"/></clipPath>`;
  let s = '';
  const arch = 'M 16,66 C 14,4 86,4 84,66';
  s += `<path d="${arch}" fill="none" stroke="${INK}" stroke-width="7.4" stroke-linecap="round"/><path d="${arch}" fill="none" stroke="${handleG}" stroke-width="4.4" stroke-linecap="round"/>`;
  s += o.fruit || '';
  let weave = '';
  const rows = o.face ? [[87, 0]] : [[74, 0], [80, 4], [86, 0]];
  rows.forEach(([y, off]) => { for (let x = 10 + off; x < 92; x += 8) weave += `<path d="M ${x},${y} q 3,2.6 6,0" fill="none" stroke="#8E5A2E" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>`; });
  if (o.face) for (const x of [20, 80]) for (const y of [74, 80]) weave += `<path d="M ${x - 3},${y} q 3,2.6 6,0" fill="none" stroke="#8E5A2E" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>`;
  s += `<path d="${body}" fill="${wood}" ${LN}/><g clip-path="url(#${P}bc)">${weave}</g><path d="${body}" fill="none" ${LN}/>`;
  s += o.front || '';
  s += `<rect x="9" y="62" width="82" height="9" rx="4.5" fill="${rimG}" ${LN}/>`;
  for (let x = 13; x < 88; x += 5) s += `<path d="M ${x},63.5 q 3.4,3 1.6,6" fill="none" stroke="#9A6233" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>`;
  s += `<path d="M 13,64 L 87,64" stroke="white" stroke-width="1.1" stroke-linecap="round" opacity="0.4"/>`;
  s += o.over || '';
  return s;
}

// A little ribbon bow
function fb_bow(x, y, k = 1, fill = '#FF7FB8') {
  return `<g transform="translate(${x},${y}) scale(${k})"><g fill="${fill}" ${LN}>`
    + `<path d="M 0,0 C -4,-6 -11,-5 -10,0 C -11,5 -4,6 0,0 Z"/><path d="M 0,0 C 4,-6 11,-5 10,0 C 11,5 4,6 0,0 Z"/>`
    + `<path d="M -1.5,1.5 L -5,9 L -2,8 Z"/><path d="M 1.5,1.5 L 5,9 L 2,8 Z"/></g>`
    + `<circle cx="0" cy="0" r="2.6" fill="#FF5FA5" ${LN}/><ellipse cx="-6" cy="-1.5" rx="2" ry="1" fill="white" opacity="0.6"/></g>`;
}

// Fruit toppings (tile coordinates)
function fb_strawberry(c, x, y, k = 1, rot = 0) {
  const red = rgrad(c, 'sb', '#FF8A9C', '#E02A4E'), lf = grad(c, 'sl', '#B6F08E', '#5FC055');
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${k})">`
    + `<path d="M 0,9 C -7,5 -8,-3 -6,-5 C -4,-7 4,-7 6,-5 C 8,-3 7,5 0,9 Z" fill="${red}" ${LN}/>`
    + [[-2.5, -2], [2.5, -2], [0, 1.5], [-3, 3], [3, 3], [0, 5.5]].map(([a, b]) => `<ellipse cx="${a}" cy="${b}" rx="0.6" ry="0.9" fill="#FFE27A"/>`).join('')
    + `<path d="M -5,-5.5 L -2,-4 L 0,-7 L 2,-4 L 5,-5.5 L 3,-8 L 0,-9 L -3,-8 Z" fill="${lf}" ${LN}/>`
    + shine(-3, -2.5, 1.6, 0.9) + '</g>';
}
function fb_kiwi(c, x, y, r, rot = 0) {
  return `<g transform="translate(${x},${y}) rotate(${rot})"><ellipse cx="0" cy="0" rx="${r}" ry="${r * 0.62}" fill="#8BC94A" ${LN}/>`
    + `<ellipse cx="0" cy="0" rx="${r * 0.8}" ry="${r * 0.48}" fill="#B9E36A"/>`
    + `<ellipse cx="0" cy="0" rx="${r * 0.3}" ry="${r * 0.18}" fill="#F4F7D2"/>`
    + [0, 60, 120, 180, 240, 300].map(a => { const t = a * Math.PI / 180; return `<circle cx="${(Math.cos(t) * r * 0.5).toFixed(2)}" cy="${(Math.sin(t) * r * 0.31).toFixed(2)}" r="0.6" fill="${FEAT}"/>`; }).join('')
    + '</g>';
}
const fb_berry = (x, y, r = 3, fill = '#7E7BEA') =>
  `<circle cx="${x}" cy="${y}" r="${r}" fill="${fill}" ${LN}/><circle cx="${x - r * 0.35}" cy="${y - r * 0.4}" r="${r * 0.3}" fill="white" opacity="0.6"/>`;
function fb_cherry(c, x, y, r = 6) {
  const red = rgrad(c, 'ch', '#FF8A9C', '#D61F4A');
  return stem(`M ${x},${y - r * 0.8} Q ${x + 1},${y - r * 2} ${x + r * 0.9},${y - r * 2.5}`)
    + `<circle cx="${x}" cy="${y}" r="${r}" fill="${red}" ${LN}/>` + shine(x - r * 0.4, y - r * 0.4, r * 0.3, r * 0.17);
}
function fb_peach(c, x, y, k = 1, rot = 0) {
  const g = grad(c, 'pc', '#FFD49A', '#FF9E6E');
  return `<g transform="translate(${x},${y}) rotate(${rot}) scale(${k})"><path d="M -7,2 Q 0,-8 7,2 Q 0,-2 -7,2 Z" fill="${g}" ${LN}/></g>`;
}
const fb_sprinkles = (pts) => pts.map(([x, y, r, col]) => `<rect x="${x - 1.6}" y="${y - 0.6}" width="3.2" height="1.2" rx="0.6" fill="${col}" transform="rotate(${r} ${x} ${y})"/>`).join('');

function fb_flame(c, x, y) {
  const g = grad(c, 'fl', '#FFF6B0', '#FFA43A');
  return `<circle cx="${x}" cy="${y}" r="5.5" fill="#FFF3A0" opacity="0.45"/><path d="M ${x},${y - 5} C ${x + 3.2},${y - 1} ${x + 2.8},${y + 3} ${x},${y + 3} C ${x - 2.8},${y + 3} ${x - 3.2},${y - 1} ${x},${y - 5} Z" fill="${g}" ${LN}/>`;
}

const FRUIT_ART = {

  // Cherries
  2: fruitTile(2, c => {
    const red = rgrad(c, 'r', '#FF8A9C', '#D61F4A'), lf = grad(c, 'l', '#B6F08E', '#5FC055');
    return backdrop(c, 2, { hy: 58 }) + ground(c, 50, 86, 26)
      + stem('M 50,24 Q 43,40 36,55') + stem('M 50,24 Q 58,40 64,53')
      + leafAt(50, 24, -25, 18, lf)
      + `<circle cx="36" cy="66" r="13" fill="${red}" ${LN}/>` + shine(31, 60, 3.6, 2)
      + `<circle cx="64" cy="64" r="13" fill="${red}" ${LN}/>` + shine(59, 58, 3.6, 2)
      + kface(36, 67, 13) + kface(64, 65, 13, { wink: true });
  }),

  // Strawberry
  4: fruitTile(4, c => {
    const red = rgrad(c, 'r', '#FF8A9C', '#E02A4E'), lf = grad(c, 'l', '#B6F08E', '#5FC055');
    const seeds = [[38, 45], [50, 43], [62, 45], [31, 54], [69, 54], [36, 68], [64, 68], [44, 74], [56, 74], [50, 80]]
      .map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="1.2" ry="1.8" fill="#FFE27A"/>`).join('');
    return backdrop(c, 4, { hy: 58 }) + ground(c, 50, 88, 24)
      + `<path d="M 50,85 C 29,75 21,52 27,42 C 33,32 67,32 73,42 C 79,52 71,75 50,85 Z" fill="${red}" ${LN}/>`
      + seeds + shine(34, 46, 5, 2.6)
      + [150, 200, 340, 30, 90].map(r => leafAt(50, 36, r === 90 ? 180 + 90 : r, 13, lf)).join('')
      + stem('M 50,36 Q 51,29 55,24')
      + kface(50, 58, 26);
  }),

  // Grapes
  8: fruitTile(8, c => {
    const fruit = FRUIT_BODY.grape(c);
    return backdrop(c, 8, { hy: 58 }) + ground(c, 50, 90, 22) + fruit + kface(50, 54, 26);
  }),

  // Lemon
  16: fruitTile(16, c => {
    const fruit = FRUIT_BODY.lemon(c);
    return backdrop(c, 16, { hy: 58 }) + ground(c, 50, 86, 28) + fruit + kface(50, 59, 24);
  }),

  // Orange
  32: fruitTile(32, c => {
    const fruit = FRUIT_BODY.orange(c);
    return backdrop(c, 32, { hy: 58 }) + ground(c, 50, 88, 28) + fruit + kface(50, 60, 27);
  }),

  // Apple
  64: fruitTile(64, c => {
    const fruit = FRUIT_BODY.apple(c);
    return backdrop(c, 64, { hy: 58 }) + ground(c, 50, 88, 30) + fruit + kface(50, 59, 28);
  }),

  // Peach
  128: fruitTile(128, c => {
    const p = rgrad(c, 'p', '#FFE0B8', '#FF8F8A'), lf = grad(c, 'l', '#B6F08E', '#5FC055');
    return backdrop(c, 128, { hy: 58 }) + ground(c, 50, 88, 30)
      + `<path d="M 50,33 C 29,25 18,48 24,65 C 30,83 70,83 76,65 C 82,48 71,25 50,33 Z" fill="${p}" ${LN}/>`
      + `<path d="M 50,34 Q 36,46 34,66" fill="none" stroke="#E0706F" stroke-width="1.2" opacity="0.5" stroke-linecap="round"/>`
      + shine(36, 42, 6, 3)
      + leafAt(50, 32, -150, 16, lf) + leafAt(50, 32, -35, 19, lf)
      + kface(53, 60, 27);
  }),

  // Pear
  256: fruitTile(256, c => {
    const fruit = FRUIT_BODY.pear(c);
    return backdrop(c, 256, { hy: 58 }) + ground(c, 50, 90, 28) + fruit + kface(50, 66, 26);
  }),

  // Pineapple
  512: fruitTile(512, c => {
    const body = grad(c, 'pb', '#FFE98A', '#F2A93B'), lf = grad(c, 'l', '#9BE57E', '#3FA651');
    const clip = `${c.p}pc`;
    c.defs += `<clipPath id="${clip}"><ellipse cx="50" cy="64" rx="23" ry="24"/></clipPath>`;
    let hatch = '';
    for (let k = -50; k <= 50; k += 9) hatch += `<path d="M ${50 + k - 30},34 L ${50 + k + 30},94 M ${50 + k + 30},34 L ${50 + k - 30},94" stroke="#C98A2E" stroke-width="0.9" opacity="0.55"/>`;
    const spike = (tx, ty, w) => `<path d="M ${50 - w},44 Q ${(50 + tx) / 2 - w * 0.6},${(44 + ty) / 2} ${tx},${ty} Q ${(50 + tx) / 2 + w * 0.6},${(44 + ty) / 2} ${50 + w},44 Z" fill="${lf}" ${LN}/>`;
    return backdrop(c, 512, { hy: 58 }) + ground(c, 50, 90, 26)
      + spike(30, 24, 5) + spike(70, 24, 5) + spike(38, 12, 5) + spike(62, 12, 5) + spike(50, 6, 5.5)
      + `<ellipse cx="50" cy="64" rx="23" ry="24" fill="${body}" ${LN}/>`
      + `<g clip-path="url(#${clip})">${hatch}</g>`
      + `<ellipse cx="50" cy="64" rx="23" ry="24" fill="none" ${LN}/>`
      + shine(39, 50, 5, 2.6)
      + kface(50, 64, 25);
  }),

  // Melon
  1024: fruitTile(1024, c => {
    const m = rgrad(c, 'm', '#EEFBC0', '#A9D46A');
    const clip = `${c.p}mc`;
    c.defs += `<clipPath id="${clip}"><circle cx="50" cy="58" r="32"/></clipPath>`;
    let net = '';
    for (const x of [26, 38, 50, 62, 74]) net += `<path d="M ${x},22 Q ${x + 6},40 ${x},58 Q ${x - 6},76 ${x},94" fill="none" stroke="white" stroke-width="1.3" opacity="0.75"/>`;
    for (const y of [36, 48, 60, 72, 84]) net += `<path d="M 16,${y} Q 33,${y - 5} 50,${y} Q 67,${y + 5} 84,${y}" fill="none" stroke="white" stroke-width="1.3" opacity="0.75"/>`;
    return backdrop(c, 1024, { hy: 58, hr: 46 }) + ground(c, 50, 92, 30)
      + `<circle cx="50" cy="58" r="32" fill="${m}" ${LN}/>`
      + `<g clip-path="url(#${clip})">${net}</g>`
      + `<circle cx="50" cy="58" r="32" fill="none" ${LN}/>`
      + `<path d="M 43,27 L 57,27 M 50,27 L 50,21" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/><path d="M 43,27 L 57,27 M 50,27 L 50,21" stroke="#9A6A3E" stroke-width="2.4" stroke-linecap="round"/>`
      + shine(37, 41, 8, 4)
      + `<ellipse cx="50" cy="63" rx="16" ry="10" fill="white" opacity="0.3"/>`
      + kface(50, 62, 28);
  }),

  // Watermelon, then golden watermelons beyond 2048
  2048: fruitTile(2048, c => watermelon(c, 2048)),
  // Bonus round: basket buddy, slice of tart, rainbow tier cake
  4096: fruitTile(4096, c => {
        const fruit = fb_place(c, FRUIT_BODY.watermelon, 50, 52, 0.5, -10)
          + fb_place(c, FRUIT_BODY.apple, 29, 59, 0.44, -16)
          + fb_place(c, FRUIT_BODY.grape, 71, 59, 0.42, 18);
        return backdrop(c, 4096, { hy: 56, hr: 48 }) + ground(c, 50, 92, 36)
          + fb_basket(c, { fruit, face: true, front: kface(50, 79, 22) })
          + fb_frame(c) + star(86, 22, 3);
      }),
  8192: fruitTile(8192, c => {
        const crust = grad(c, 'cr', '#FFDB8E', '#E9A14C'), cream = grad(c, 'cm', '#FFF8DA', '#FFE59C');
        const glaze = grad(c, 'gl', '#FFD0DC', '#FF9FB8');
        let s = backdrop(c, 8192, { hy: 58, hr: 46 });
        // plate
        s += `<ellipse cx="50" cy="83" rx="40" ry="9" fill="#FFFFFF" ${LN}/><ellipse cx="50" cy="82" rx="30" ry="5.5" fill="#F4ECF7"/>`;
        const arc = 'M 76,58 Q 85,53 83,45';
        // outer crust side (right) and top surface
        s += `<path d="${arc} L 83,67 Q 85,75 76,80 Z" fill="${crust}" ${LN}/>`;
        s += `<path d="M 16,58 ${arc.slice(1)} Z" fill="${glaze}" ${LN}/>`;
        // front cut face: fruit layer, custard, crust base and back wall
        s += `<path d="M 16,58 L 76,58 L 76,80 L 16,80 Z" fill="${cream}" ${LN}/>`;
        s += `<path d="M 16,58 L 76,58 L 76,63 L 16,63 Z" fill="#FFB3C6" ${LN}/>`;
        s += `<path d="M 16,74 L 76,74 L 76,80 L 16,80 Z M 70,58 L 76,58 L 76,74 L 70,74 Z" fill="${crust}" ${LN}/>`;
        // thick crust rim along the back arc
        s += `<path d="${arc}" fill="none" stroke="${INK}" stroke-width="7.6" stroke-linecap="round"/><path d="${arc}" fill="none" stroke="#F2B866" stroke-width="4.6" stroke-linecap="round"/>`;
        // toppings
        s += fb_kiwi(c, 33, 55, 5.5, -4) + fb_peach(c, 58, 54, 1, 6);
        s += fb_berry(24, 56, 2.4) + fb_berry(64, 55, 2.4, '#9B6BE0');
        s += fb_strawberry(c, 46, 48, 1.15, -8);
        // whipped cream swirl with a mint leaf
        s += `<path d="M 67,53 Q 65,47 71,46 Q 69,41 75,40 Q 81,41 79,46 Q 84,47 82,53 Z" fill="#FFFFFF" ${LN}/>`;
        s += leafAt(75, 41, -60, 7, grad(c, 'mt', '#B6F08E', '#5FC055'));
        s += kface(43, 68.5, 20, { wink: true });
        return s + fb_frame(c) + heart(14, 26, 1.2) + star(86, 22, 3);
      }),
  16384: fruitTile(16384, c => {
        const pk = grad(c, 't1', '#FFD6E6', '#FFA9C8'), mn = grad(c, 't2', '#DDF7E6', '#A9E6C2'), lv = grad(c, 't3', '#ECDDFF', '#C7AEF5');
        const drip = (x0, x1, y, col) => {
          let d = `M ${x0},${y} L ${x1},${y} L ${x1},${y + 3}`;
          const n = Math.round((x1 - x0) / 7), w = (x1 - x0) / n;
          for (let i = n - 1; i >= 0; i--) {
            const a = x0 + i * w, l = (i % 2 ? 3 : 6);
            d += ` Q ${a + w * 0.75},${y + 3} ${a + w * 0.5},${y + 3 + l * 0.5} Q ${a + w * 0.25},${y + 3 + l} ${a},${y + 3}`;
          }
          return `<path d="${d} Z" fill="${col}" ${LN}/>`;
        };
        let s = backdrop(c, 16384, { hy: 56, hr: 48 });
        s += `<ellipse cx="50" cy="89" rx="38" ry="5" fill="#FFFFFF" ${LN}/>`;
        s += `<rect x="18" y="64" width="64" height="24" rx="4" fill="${pk}" ${LN}/>` + drip(18, 82, 64, '#FFFFFF');
        s += `<rect x="27" y="46" width="46" height="18" rx="4" fill="${mn}" ${LN}/>` + drip(27, 73, 46, '#FFF6FA');
        s += `<rect x="35" y="31" width="30" height="15" rx="4" fill="${lv}" ${LN}/>` + drip(35, 65, 31, '#FFFFFF');
        s += fb_sprinkles([[31, 57, 30, '#FF7FB8'], [40, 59, -20, '#FFC94A'], [60, 58, 40, '#7FB8FF'], [68, 56, -30, '#FF7FB8'], [42, 41, 10, '#FFC94A'], [57, 42, -40, '#FF7FB8'], [24, 84, 20, '#7FB8FF'], [76, 84, -30, '#FFC94A']]);
        s += `<rect x="20" y="66" width="3" height="18" rx="1.5" fill="white" opacity="0.35"/>`;
        s += kface(50, 77, 22);
        s += fb_cherry(c, 50, 25, 6);
        return s + fb_frame(c) + heart(14, 30, 1.2) + heart(86, 30, 1.1, '#FFB3D1') + star(18, 14, 2.6);
      }),

};

// ── Halloween theme (Spooky Picnic) ───────────────────────────────────────────
// Candy (2–16) → spider, potion, witch hat, cauldron (32–256) → friendly ghost,
// glowing jack-o'-lantern (512–1024) → haunted house (2048), golden beyond.
const HALLOWEEN_BG = {
  2: '#DDD3F5', 4: '#D3D8F5', 8: '#CFE0F5', 16: '#CDE9E6', 32: '#D6EEC9',
  64: '#E4EDB8', 128: '#F3EDB5', 256: '#F6DDB0', 512: '#F7CDA8',
  1024: '#F5BE9E', 2048: '#3E2C66', 4096: '#33245A', 8192: '#2A1D4E', 16384: '#24184A',
};
const hwTile = (v, build) => tile(v, build, HALLOWEEN_BG, 'hw');
const outline = d => `<path d="${d}" fill="none" ${LN}/>`;
const heartAt = (x, y, s, fill) => `<path transform="translate(${x},${y}) scale(${s})" d="M 0,3 C -6,-1 -5,-6 -2.5,-6 C -1,-6 0,-5 0,-4 C 0,-5 1,-6 2.5,-6 C 5,-6 6,-1 0,3 Z" fill="${fill}" ${LN}/>`;

// Cute face with golden cat eyes (dark dot eyes vanish on black fur)
function catFace(cx, cy, s) {
  let f = '';
  for (const sg of [-1, 1]) {
    const x = cx + sg * s * 0.36;
    f += `<ellipse cx="${x}" cy="${cy}" rx="${s * 0.16}" ry="${s * 0.18}" fill="#F7E36A" stroke="${INK}" stroke-width="1"/>`
      + `<ellipse cx="${x}" cy="${cy}" rx="${s * 0.05}" ry="${s * 0.13}" fill="${FEAT}"/><circle cx="${x - s * 0.06}" cy="${cy - s * 0.08}" r="${s * 0.04}" fill="white"/>`;
  }
  f += `<path d="M ${cx - s * 0.05},${cy + s * 0.18} l ${s * 0.05},${s * 0.05} l ${s * 0.05},${-s * 0.05} Z" fill="#FF9DBB"/>`
    + `<path d="M ${cx - s * 0.13},${cy + s * 0.26} q ${s * 0.065},${s * 0.08} ${s * 0.13},0 q ${s * 0.065},${s * 0.08} ${s * 0.13},0" fill="none" stroke="#EDE3F7" stroke-width="1.4" stroke-linecap="round"/>`;
  for (const sg of [-1, 1]) f += `<ellipse cx="${cx + sg * s * 0.56}" cy="${cy + s * 0.2}" rx="${s * 0.14}" ry="${s * 0.08}" fill="#FF9DBB" opacity="0.7"/>`;
  return f;
}

function pumpkin(c, opts = {}) {
  const g = rgrad(c, 'p', '#FFC27A', '#EE7418'), lf = grad(c, 'l', '#B6F08E', '#5FC055');
  let s = stem('M 50,34 Q 49,26 54,21') + leafAt(53, 28, -25, 15, lf)
    + `<path d="M 57,24 q 8,-5 11,1 q 1,5 -4,5" fill="none" stroke="#5FC055" stroke-width="1.6" stroke-linecap="round"/>`
    + `<ellipse cx="31" cy="61" rx="17" ry="23" fill="${g}" ${LN}/><ellipse cx="69" cy="61" rx="17" ry="23" fill="${g}" ${LN}/><ellipse cx="50" cy="61" rx="20" ry="26" fill="${g}" ${LN}/>`
    + shine(41, 45, 3.6, 2);
  if (opts.carved) {
    const glow = rgrad(c, 'gl', '#FFF6C0', '#FFB830');
    s += `<path d="M 35,55 L 41,46 L 46,56 Z M 65,55 L 59,46 L 54,56 Z" fill="${opts.lit ? glow : '#6B3A1E'}" ${LN}/>`
      + `<path d="M 34,66 Q 50,79 66,66 L 61,68 L 58.5,64 L 54.5,69 L 50,65 L 45.5,69 L 41.5,64 L 39,68 Z" fill="${opts.lit ? glow : '#6B3A1E'}" ${LN}/>`
      + `<ellipse cx="31" cy="63" rx="3.8" ry="2.3" fill="#FF8FB8" opacity="0.7"/><ellipse cx="69" cy="63" rx="3.8" ry="2.3" fill="#FF8FB8" opacity="0.7"/>`;
  } else {
    s += kface(50, 63, 21);
  }
  return s;
}

// Haunted house (2048), and golden-framed versions for 4096 / 8192
function hauntedHouse(c, v, o = {}) {
    const wall = grad(c, 'hw', '#9C86D0', '#5E4A90'), roof = grad(c, 'rf', '#6E50B0', '#3F2C70'), win = rgrad(c, 'wn', '#FFF6C0', '#FFB830');
  let s = backdrop(c, v, { hy: 56, hr: 48, color: '#FFD27A', op: 0.45 })
    + `<path d="M 80,16 a 9,9 0 1 0 8,13 a 7,7 0 1 1 -8,-13 Z" fill="#FFF3B0" ${LN}/>`
    + star(14, 16, 2.4, '#FFF6C4') + star(30, 8, 1.6, '#FFF6C4') + star(92, 44, 1.8, '#FFF6C4')
    + `<path d="M 16,28 q 3,-3 6,0 q 3,-3 6,0 q -3,1 -6,4 q -3,-3 -6,-4 Z M 60,14 q 2,-2 4,0 q 2,-2 4,0 q -2,1 -4,3 q -2,-2 -4,-3 Z" fill="#2A1D4E"/>`
    + ground(c, 50, 92, 36)
    + `<rect x="26" y="46" width="48" height="44" rx="3" fill="${wall}" ${LN}/>`
    + `<path d="M 18,50 L 50,20 L 82,50 Z" fill="${roof}" ${LN}/>`
    + `<rect x="58" y="22" width="7" height="16" fill="${roof}" ${LN}/>`
    + `<rect x="31" y="53" width="12" height="12" rx="6" fill="${win}" ${LN}/><rect x="57" y="53" width="12" height="12" rx="6" fill="${win}" ${LN}/>`
    + `<circle cx="37" cy="59" r="2.4" fill="${INK}"/><circle cx="63" cy="59" r="2.4" fill="${INK}"/><circle cx="36" cy="58" r="0.9" fill="white"/><circle cx="62" cy="58" r="0.9" fill="white"/>`
    + `<path d="M 43,90 L 43,74 Q 50,66 57,74 L 57,90 Z" fill="#3F2C70" ${LN}/><path d="M 46,72 q 4,3 8,0" fill="none" stroke="${win}" stroke-width="1.6" stroke-linecap="round"/>`
    + `<circle cx="50" cy="40" r="5" fill="${win}" ${LN}/>`
    + `<ellipse cx="30" cy="70" rx="3.6" ry="2.2" fill="#FF8FB8" opacity="0.7"/><ellipse cx="70" cy="70" rx="3.6" ry="2.2" fill="#FF8FB8" opacity="0.7"/>`;
  if (o.frame) {
    const g = grad(c, 'gold', '#FFF08A', '#FFB82E');
    s += `<rect x="1.8" y="1.8" width="96.4" height="96.4" rx="9" fill="none" stroke="${g}" stroke-width="3.2"/>` + star(8, 92, 3.4, '#FFF6C4');
  }
  if (o.extra) s += star(12, 50, 3, '#FFF6C4') + star(90, 74, 2.6, '#FFF6C4') + star(70, 8, 2.2, '#FFF6C4');
  return s;
}

// ── Spooky Picnic bonus round (past the 2048 haunted house) ───────────────────
// 4096 cat on a broomstick · 8192 sleepy moon with bats · 16384 owl on a
// crescent moon, in a gold frame.
// ── Shared bits ──
// Same gold frame + corner sparkle as hauntedHouse({frame}); `extra` adds sparkles
function sb_frame(c, extra = []) {
  const g = grad(c, 'sbgold', '#FFF08A', '#FFB82E');
  let s = `<rect x="1.8" y="1.8" width="96.4" height="96.4" rx="9" fill="none" stroke="${g}" stroke-width="3.2"/>` + star(8, 92, 3.4, '#FFF6C4');
  for (const [x, y, r] of extra) s += star(x, y, r, '#FFF6C4');
  return s;
}
// Re-scale outline widths inside a scaled group so lines stay 1.5 wide on screen
const sb_fix = (str, k) => str.replace(/stroke-width="1\.5"/g, `stroke-width="${(1.5 / k).toFixed(2)}"`);
const sb_glow = (c, id, cx, cy, r, color, op) => {
  c.defs += `<radialGradient id="${c.p}${id}"><stop offset="0" stop-color="${color}" stop-opacity="${op}"/><stop offset="0.55" stop-color="${color}" stop-opacity="${op * 0.45}"/><stop offset="1" stop-color="${color}" stop-opacity="0"/></radialGradient>`;
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="url(#${c.p}${id})"/>`;
};

// Black cat head (radius s) with golden eyes and a lilac rim light
function sb_catHead(c, cx, cy, s) {
  const fur = rgrad(c, `sbfur${c.n++}`, '#5E5086', '#2A2140');
  let h = '';
  for (const sg of [-1, 1]) {
    h += `<path d="M ${cx + sg * s * 0.92},${cy - s * 0.12} L ${cx + sg * s * 0.82},${cy - s * 1.12} L ${cx + sg * s * 0.18},${cy - s * 0.8} Z" fill="${fur}" ${LN}/>`
      + `<path d="M ${cx + sg * s * 0.74},${cy - s * 0.38} L ${cx + sg * s * 0.74},${cy - s * 0.9} L ${cx + sg * s * 0.4},${cy - s * 0.72} Z" fill="#FF9DBB" opacity="0.85"/>`;
  }
  h += `<ellipse cx="${cx}" cy="${cy}" rx="${s}" ry="${s * 0.86}" fill="${fur}" ${LN}/>`
    + `<path d="M ${cx - s * 0.78},${cy - s * 0.32} Q ${cx - s * 0.5},${cy - s * 0.76} ${cx},${cy - s * 0.8}" fill="none" stroke="#B9A6E8" stroke-width="1.3" stroke-linecap="round" opacity="0.8"/>`
    + catFace(cx, cy + s * 0.02, s);
  // whiskers
  for (const sg of [-1, 1]) h += `<path d="M ${cx + sg * s * 0.78},${cy + s * 0.26} l ${sg * s * 0.36},${-s * 0.06} M ${cx + sg * s * 0.78},${cy + s * 0.36} l ${sg * s * 0.34},${s * 0.08}" stroke="#D9CCF2" stroke-width="0.9" stroke-linecap="round" opacity="0.8"/>`;
  return h;
}

// A broom in local coords: bristles at the origin end, handle along +x for `len`
function sb_broom(c, x, y, rot, len) {
  const straw = grad(c, `sbst${c.n++}`, '#FFE08A', '#E3A23C');
  return `<g transform="translate(${x},${y}) rotate(${rot})">`
    + `<path d="M 0,0 L ${len},0" stroke="${INK}" stroke-width="5" stroke-linecap="round"/><path d="M 0,0 L ${len},0" stroke="#B9824E" stroke-width="2.6" stroke-linecap="round"/>`
    + `<path d="M 4,-3.4 L 4,3.4 L -15,10 Q -19,5 -18,0 Q -19,-5 -15,-10 Z" fill="${straw}" ${LN}/>`
    + `<path d="M -3,-2 L -14,-5 M -3,2 L -14,5 M -2,0 L -15,0" stroke="#C98A30" stroke-width="0.9" stroke-linecap="round"/>`
    + `<rect x="1" y="-4.4" width="4.4" height="8.8" rx="1.6" fill="#9C6ADE" ${LN}/></g>`;
}

// Bat in local coords (s=1 → ~34 wide), constant-width outline
function sb_bat(c, cx, cy, s, rot = 0, body = '#4A3A78') {
  const w = (1.5 / s).toFixed(2);
  const ln = `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round"`;
  let b = `<g transform="translate(${cx},${cy}) rotate(${rot}) scale(${s})">`;
  for (const sg of [-1, 1]) {
    b += `<path d="M ${sg * 3},-2 Q ${sg * 9},-10 ${sg * 17},-7 Q ${sg * 16},-3 ${sg * 14.5},-1 Q ${sg * 12},-2.6 ${sg * 10.5},0.6 Q ${sg * 8},-1 ${sg * 6.5},2.6 Q ${sg * 5},1.6 ${sg * 3},3 Z" fill="${body}" ${ln}/>`;
    b += `<path d="M ${sg * 5},-1.5 Q ${sg * 10},-6.5 ${sg * 15},-6" fill="none" stroke="#9C86D0" stroke-width="${(0.9 / s).toFixed(2)}" stroke-linecap="round" opacity="0.8"/>`;
    b += `<path d="M ${sg * 1.6},-4.5 L ${sg * 3.6},-9.5 L ${sg * 4.6},-3.5 Z" fill="${body}" ${ln}/>`;
  }
  b += `<ellipse cx="0" cy="0" rx="5.6" ry="5.4" fill="${body}" ${ln}/>`
    + `<path d="M -3.6,-2.6 Q -1.5,-4.6 1,-4.6" fill="none" stroke="#B9A6E8" stroke-width="${(1 / s).toFixed(2)}" stroke-linecap="round" opacity="0.8"/>`
    + `<circle cx="-2" cy="-0.6" r="1.35" fill="#F7E36A"/><circle cx="2" cy="-0.6" r="1.35" fill="#F7E36A"/>`
    + `<circle cx="-2" cy="-0.5" r="0.6" fill="${FEAT}"/><circle cx="2" cy="-0.5" r="0.6" fill="${FEAT}"/>`
    + `<path d="M -0.9,2 L -0.5,3.2 L -0.1,2 M 0.3,2 L 0.7,3.2 L 1.1,2" fill="white"/>`
    + `<ellipse cx="-3.6" cy="1.6" rx="1.1" ry="0.7" fill="#FF9DBB" opacity="0.8"/><ellipse cx="3.6" cy="1.6" rx="1.1" ry="0.7" fill="#FF9DBB" opacity="0.8"/></g>`;
  return b;
}

// Full moon with a face: 'sleepy' (closed eyes) or 'happy' (open eyes)
function sb_moon(c, cx, cy, r, mood) {
  const g = rgrad(c, `sbmn${c.n++}`, '#FFFCE6', '#FFD45E');
  let m = `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${g}" ${LN}/>`
    + `<circle cx="${cx + r * 0.5}" cy="${cy - r * 0.45}" r="${r * 0.14}" fill="#F2C24E" opacity="0.45"/>`
    + `<circle cx="${cx - r * 0.55}" cy="${cy - r * 0.38}" r="${r * 0.09}" fill="#F2C24E" opacity="0.45"/>`
    + `<circle cx="${cx + r * 0.62}" cy="${cy + r * 0.5}" r="${r * 0.1}" fill="#F2C24E" opacity="0.4"/>`
    + shine(cx - r * 0.42, cy - r * 0.62, r * 0.22, r * 0.1);
  const ey = cy + r * 0.02, ex = r * 0.34, sw = Math.max(1.5, r * 0.07);
  if (mood === 'sleepy') {
    for (const sg of [-1, 1]) m += `<path d="M ${cx + sg * ex - r * 0.13},${ey} q ${r * 0.13},${r * 0.14} ${r * 0.26},0" fill="none" stroke="${FEAT}" stroke-width="${sw}" stroke-linecap="round"/>`;
  } else {
    m += kface(cx, ey, r).replace(/<path[^>]*q[^>]*\/>/, '').replace(/<ellipse[^>]*\/>/g, '');
  }
  m += `<path d="M ${cx - r * 0.12},${cy + r * 0.24} q ${r * 0.12},${r * 0.13} ${r * 0.24},0" stroke="${FEAT}" stroke-width="${sw * 0.9}" fill="none" stroke-linecap="round"/>`;
  for (const sg of [-1, 1]) m += `<ellipse cx="${cx + sg * r * 0.56}" cy="${cy + r * 0.2}" rx="${r * 0.15}" ry="${r * 0.09}" fill="#FF9DBB" opacity="0.75"/>`;
  return m;
}

// The 512 ghost, scaled; (cx, cy) is its face centre
function sb_ghost(c, cx, cy, k) {
  const g = rgrad(c, `sbgh${c.n++}`, '#FFFFFF', '#DCD3F0');
  const body = `<ellipse cx="25" cy="55" rx="7.5" ry="4.6" transform="rotate(35 25 55)" fill="${g}" ${LN}/>`
    + `<ellipse cx="75" cy="52" rx="7.5" ry="4.6" transform="rotate(-40 75 52)" fill="${g}" ${LN}/>`
    + `<path d="M 26,46 C 26,20 74,20 74,46 C 74,62 70,70 74,78 C 77,85 70,90 64,85 C 60,81 57,84 52,83 C 40,81 26,70 26,46 Z" fill="${g}" ${LN}/>`
    + shine(37, 32, 5.5, 2.8) + kface(50, 47, 24);
  return `<g transform="translate(${cx},${cy}) scale(${k}) translate(-50,-47)">${sb_fix(body, k)}</g>`;
}

// The 1024 jack-o'-lantern, scaled; (cx, cy) is its body centre
function sb_pumpkin(c, cx, cy, k) {
  return `<g transform="translate(${cx},${cy}) scale(${k}) translate(-50,-61)">${sb_fix(pumpkin(c, { carved: true, lit: true }), k)}</g>`;
}

// Tiny party hat on a point, tilted
function sb_hat(c, x, y, h, rot, color, dot) {
  return `<g transform="translate(${x},${y}) rotate(${rot})"><path d="M ${-h * 0.4},0 L 0,${-h} L ${h * 0.4},0 Z" fill="${color}" ${LN}/>`
    + `<path d="M ${-h * 0.22},${-h * 0.45} L ${h * 0.22},${-h * 0.45}" stroke="white" stroke-width="1.4" opacity="0.7"/>`
    + `<circle cx="0" cy="${-h}" r="${h * 0.16}" fill="${dot}" ${LN}/></g>`;
}

// Bunting: a sagging string of triangle flags between x0 and x1
function sb_bunting(x0, x1, y, sag, n, colors) {
  let s = `<path d="M ${x0},${y} Q ${(x0 + x1) / 2},${y + sag * 2} ${x1},${y}" fill="none" stroke="#D9CCF2" stroke-width="1.1"/>`;
  for (let i = 0; i < n; i++) {
    const t0 = (i + 0.15) / n, t1 = (i + 0.85) / n, tm = (t0 + t1) / 2;
    const pt = t => [x0 + (x1 - x0) * t, y + sag * 4 * t * (1 - t)];
    const [ax, ay] = pt(t0), [bx, by] = pt(t1), [mx, my] = pt(tm);
    s += `<path d="M ${ax},${ay} L ${bx},${by} L ${mx},${my + 9} Z" fill="${colors[i % colors.length]}" ${LN}/>`;
  }
  return s;
}

const sb_confetti = pts => pts.map(([x, y, col, r]) => r === undefined
  ? `<circle cx="${x}" cy="${y}" r="1.4" fill="${col}"/>`
  : `<rect x="${x - 1.6}" y="${y - 0.8}" width="3.2" height="1.6" rx="0.6" fill="${col}" transform="rotate(${r} ${x} ${y})"/>`).join('');

const HALLOWEEN_ART = {
  // ── Candy ──
  // Candy corn
  2: hwTile(2, c => {
    const shape = 'M 50,26 C 56,26 74,70 74,78 C 74,88 26,88 26,78 C 26,70 44,26 50,26 Z';
    c.defs += `<clipPath id="${c.p}cc"><path d="${shape}"/></clipPath>`;
    return backdrop(c, 2, { hy: 58 }) + ground(c, 50, 89, 24)
      + `<g clip-path="url(#${c.p}cc)"><rect x="20" y="20" width="60" height="24" fill="#FFFDF6"/><rect x="20" y="44" width="60" height="25" fill="#FF8A2A"/><rect x="20" y="69" width="60" height="25" fill="#FFD23F"/></g>`
      + outline(shape) + shine(44, 38, 2.4, 5.5, 22) + kface(50, 60, 19);
  }),
  // Hard candy: orange and white swirl in a clear twisted wrapper
  4: hwTile(4, c => {
    const g = rgrad(c, 'hc', '#FFC27A', '#FF8A2A');
    const end = sx => `<path d="M ${50 + sx * 17},58 L ${50 + sx * 39},43 Q ${50 + sx * 33},58 ${50 + sx * 39},73 Z" fill="#FFFFFF" fill-opacity="0.75" ${LN}/><path d="M ${50 + sx * 24},56 L ${50 + sx * 35},49 M ${50 + sx * 24},60 L ${50 + sx * 35},67" stroke="#B8A8D8" stroke-width="1.1" stroke-linecap="round"/>`;
    let swirl = '';
    for (let a = 0; a < 360; a += 60) swirl += `<path d="M 50,58 Q ${50 + 14 * Math.cos((a + 25) * Math.PI / 180)},${58 + 14 * Math.sin((a + 25) * Math.PI / 180)} ${50 + 21 * Math.cos(a * Math.PI / 180)},${58 + 21 * Math.sin(a * Math.PI / 180)}" fill="none" stroke="white" stroke-width="4" stroke-linecap="round"/>`;
    c.defs += `<clipPath id="${c.p}hcc"><circle cx="50" cy="58" r="20"/></clipPath>`;
    return backdrop(c, 4, { hy: 58 }) + ground(c, 50, 86, 24) + end(-1) + end(1)
      + `<circle cx="50" cy="58" r="20" fill="${g}" ${LN}/><g clip-path="url(#${c.p}hcc)" opacity="0.85">${swirl}</g><circle cx="50" cy="58" r="20" fill="none" ${LN}/>`
      + shine(42, 47, 4, 2) + kface(50, 60, 18);
  }),
  // Lollipop
  8: hwTile(8, c => {
    const g = rgrad(c, 'l', '#FFC2DD', '#FF6FA5');
    return backdrop(c, 8, { hy: 52 }) + ground(c, 50, 92, 14)
      + `<rect x="47" y="62" width="6" height="30" rx="3" fill="#FFF4E0" ${LN}/>`
      + `<circle cx="50" cy="44" r="22" fill="${g}" ${LN}/>`
      + `<path d="M 50,44 m -2,0 a 2,2 0 1 1 4,0 a 6,6 0 1 1 -10,0 a 10,10 0 1 1 18,0 a 14,14 0 1 1 -26,0 a 17,17 0 1 1 32,0" fill="none" stroke="white" stroke-width="2.6" stroke-linecap="round" opacity="0.7"/>`
      + `<path d="M 50,66 l -7,-4 l 0,8 Z M 50,66 l 7,-4 l 0,8 Z" fill="#7ED3C8" ${LN}/><circle cx="50" cy="66" r="2" fill="#3FA99A" ${LN}/>`
      + shine(41, 32, 4, 2) + kface(50, 47, 18);
  }),
  // Candy bucket: teal pail with a few big sweets
  16: hwTile(16, c => {
    const pail = grad(c, 'bk', '#8EE3D6', '#33A898'), pop = rgrad(c, 'lp', '#FFC2DD', '#FF6FA5');
    const corn = (x, y, r) => `<g transform="translate(${x},${y}) rotate(${r}) scale(1.35)"><path d="M 0,-9 C 2,-9 7,5 7,7 C 7,10 -7,10 -7,7 C -7,5 -2,-9 0,-9 Z" fill="#FF8A2A" ${LN}/><path d="M -2.6,-4 L 2.6,-4" stroke="#FFFDF6" stroke-width="3"/><path d="M -6,6 L 6,6" stroke="#FFD23F" stroke-width="3.4"/></g>`;
    return backdrop(c, 16, { hy: 58 }) + ground(c, 50, 90, 28)
      + `<path d="M 25,52 Q 50,14 75,52" fill="none" stroke="${INK}" stroke-width="4.4" stroke-linecap="round"/><path d="M 25,52 Q 50,14 75,52" fill="none" stroke="#D8D2E4" stroke-width="2" stroke-linecap="round"/>`
      + `<rect x="58" y="22" width="4" height="28" rx="2" fill="#FFF4E0" ${LN}/><circle cx="60" cy="22" r="9" fill="${pop}" ${LN}/><path d="M 60,22 m -1.5,0 a 1.5,1.5 0 1 1 3,0 a 4.5,4.5 0 1 1 -7.5,0 a 7,7 0 1 1 12,0" fill="none" stroke="white" stroke-width="1.6" opacity="0.7"/>`
      + corn(38, 44, -18) + corn(48, 46, 12)
      + `<path d="M 22,50 L 78,50 L 72,86 Q 50,90 28,86 Z" fill="${pail}" ${LN}/><rect x="20" y="47" width="60" height="7" rx="3.5" fill="#B5F0E6" ${LN}/>`
      + shine(29, 62, 2.4, 6, 10) + kface(50, 69, 18);
  }),

  // ── Witchy ──
  // Spider: dark, chunky legs, golden eyes, little bow
  32: hwTile(32, c => {
    const g = rgrad(c, 's', '#6A5E86', '#2E2742');
    let legs = '';
    for (const sx of [-1, 1]) for (const [a, b] of [[-14, -8], [-6, 0], [2, 8], [10, 14]])
      legs += `<path d="M ${50 + sx * 14},${60 + a * 0.5} Q ${50 + sx * 28},${50 + a} ${50 + sx * 35},${62 + b}" fill="none" stroke="${INK}" stroke-width="4.2" stroke-linecap="round"/>`
        + `<path d="M ${50 + sx * 14},${60 + a * 0.5} Q ${50 + sx * 28},${50 + a} ${50 + sx * 35},${62 + b}" fill="none" stroke="#4A4166" stroke-width="2" stroke-linecap="round"/>`;
    return backdrop(c, 32, { hy: 58 }) + ground(c, 50, 90, 22)
      + `<path d="M 50,6 L 50,40" stroke="#FFFFFF" stroke-width="1.6"/><path d="M 50,6 L 50,40" stroke="${INK}" stroke-width="0.6" opacity="0.4"/>`
      + legs + `<circle cx="50" cy="60" r="20" fill="${g}" ${LN}/>` + shine(42, 50, 3.6, 1.9)
      + `<path d="M 58,42 l -5,-3.6 l 0,7.2 Z M 58,42 l 5,-3.6 l 0,7.2 Z" fill="#FF7FB8" ${LN}/><circle cx="58" cy="42" r="1.8" fill="#FF5FA5" ${LN}/>`
      + catFace(50, 60, 19);
  }),
  // Potion bottle
  64: hwTile(64, c => {
    const glass = rgrad(c, 'gb', '#F4FBFF', '#C9E2F0'), brew = rgrad(c, 'pb', '#C8F59A', '#4FB848');
    c.defs += `<clipPath id="${c.p}bc"><circle cx="50" cy="63" r="22"/></clipPath>`;
    return backdrop(c, 64, { hy: 58 }) + ground(c, 50, 90, 22)
      + `<rect x="43" y="22" width="14" height="11" rx="3" fill="#C98F5F" ${LN}/>`
      + `<path d="M 44,32 L 44,43 L 56,43 L 56,32 Z" fill="${glass}" ${LN}/>`
      + `<circle cx="50" cy="63" r="22" fill="${glass}" ${LN}/>`
      + `<g clip-path="url(#${c.p}bc)"><rect x="20" y="58" width="60" height="30" fill="${brew}"/><path d="M 26,58 Q 38,54 50,58 Q 62,62 74,58" fill="none" stroke="#E6FFD0" stroke-width="1.6"/></g>`
      + `<circle cx="50" cy="63" r="22" fill="none" ${LN}/>`
      + `<circle cx="58" cy="70" r="2" fill="white" opacity="0.7"/><circle cx="42" cy="76" r="1.4" fill="white" opacity="0.7"/>`
      + `<path d="M 44,36 Q 56,38 58,33" fill="none" stroke="#FF8FB8" stroke-width="2.2" stroke-linecap="round"/>`
      + shine(39, 52, 3, 6, 25) + kface(50, 65, 19);
  }),
  // Witch hat
  128: hwTile(128, c => {
    const g = grad(c, 'h', '#A98AE0', '#5A3F94');
    return backdrop(c, 128, { hy: 58 }) + ground(c, 50, 90, 32)
      + `<ellipse cx="50" cy="77" rx="36" ry="9" fill="${g}" ${LN}/>`
      + `<path d="M 30,76 Q 38,54 45,34 Q 50,18 68,16 Q 59,25 60,40 Q 64,60 70,76 Z" fill="${g}" ${LN}/>`
      + `<path d="M 32,68 Q 50,72 68,68 L 69,75 Q 50,79 31,75 Z" fill="#FF8A2A" ${LN}/><rect x="45.5" y="67.5" width="9" height="8.5" rx="1.6" fill="none" stroke="#FFD23F" stroke-width="2.2"/>`
      + `<path d="M 66,18 l 2,-4 l 2,4 l 4,1 l -3,3 l 1,4 l -4,-2 l -4,2 l 1,-4 l -3,-3 Z" fill="#FFD23F" ${LN}/>`
      + shine(43, 48, 2.4, 6, 18) + kface(50, 57, 16);
  }),
  // Cauldron: a soft purple pot with pink brew and heart bubbles, over a little fire
  256: hwTile(256, c => {
    const pot = rgrad(c, 'pt', '#8A78B8', '#3B2F5E'), brew = rgrad(c, 'br', '#FFD0E6', '#FF7FB4'), fire = grad(c, 'fl', '#FFE07A', '#FF8A2A');
    return backdrop(c, 256, { hy: 54 }) + ground(c, 50, 96, 30)
      + `<path d="M 34,94 Q 30,88 34,82 Q 36,86 39,86 Q 38,80 43,76 Q 44,83 47,85 Q 49,80 52,78 Q 54,84 56,86 Q 58,82 61,80 Q 64,86 62,89 Q 66,88 66,84 Q 70,90 66,94 Z" fill="${fire}" ${LN}/>`
      + `<rect x="28" y="91" width="44" height="5" rx="2.5" fill="#B07A4E" ${LN}/><circle cx="30" cy="93.5" r="2" fill="#E8C49A" ${LN}/><circle cx="70" cy="93.5" r="2" fill="#E8C49A" ${LN}/>`
      + heartAt(38, 27, 0.9, '#FF9DC6') + heartAt(62, 16, 0.6, '#FFC2DD')
      + `<circle cx="54" cy="25" r="4" fill="#FFC2DD" ${LN}/><circle cx="66" cy="30" r="2.4" fill="#FFC2DD" ${LN}/>`
      + `<path d="M 19,42 Q 15,84 50,84 Q 85,84 81,42 Z" fill="${pot}" ${LN}/>`
      + `<ellipse cx="50" cy="41" rx="29" ry="7" fill="${brew}" ${LN}/>`
      + `<rect x="16" y="39" width="68" height="8" rx="4" fill="#5A4A86" ${LN}/>`
      + `<circle cx="42" cy="40" r="2.2" fill="#FFE4F0" ${LN}/><circle cx="58" cy="41" r="1.6" fill="#FFE4F0"/>`
      + shine(27, 56, 2.6, 7, 12) + kface(50, 62, 22);
  }),

  // ── Ghost, jack-o'-lantern, then the spooky house ──
  // Friendly ghost: a floaty wisp with a curly tail and little waving arms
  512: hwTile(512, c => {
    const g = rgrad(c, 'g', '#FFFFFF', '#DCD3F0');
    return backdrop(c, 512, { hy: 54, hr: 46 }) + ground(c, 50, 93, 16)
      + `<ellipse cx="25" cy="55" rx="7.5" ry="4.6" transform="rotate(35 25 55)" fill="${g}" ${LN}/>`
      + `<ellipse cx="75" cy="52" rx="7.5" ry="4.6" transform="rotate(-40 75 52)" fill="${g}" ${LN}/>`
      + `<path d="M 26,46 C 26,20 74,20 74,46 C 74,62 70,70 74,78 C 77,85 70,90 64,85 C 60,81 57,84 52,83 C 40,81 26,70 26,46 Z" fill="${g}" ${LN}/>`
      + shine(37, 32, 5.5, 2.8) + kface(50, 47, 24);
  }),
  1024: hwTile(1024, c => backdrop(c, 1024, { hy: 58, hr: 46, color: '#FFE08A', op: 0.65 }) + ground(c, 50, 90, 32) + pumpkin(c, { carved: true, lit: true })),
  // Haunted house, the finale; golden frame beyond 2048
  2048: hwTile(2048, c => hauntedHouse(c, 2048)),
  // Bonus round: witchy cat on a broom, sleepy moon, wise owl on the moon
  4096: hwTile(4096, c => {
        const fur = rgrad(c, 'sbbody', '#5E5086', '#2A2140'), hat = grad(c, 'sbhat', '#A98AE0', '#5A3F94');
        return backdrop(c, 4096, { hx: 54, hy: 50, hr: 46, color: '#C9B4FF', op: 0.45 })
          // sparkle trail curving up from bottom-left
          + `<path d="M 22,84 Q 10,82 9,66" fill="none" stroke="#FFE08A" stroke-width="1.4" stroke-dasharray="0.5 4" stroke-linecap="round" opacity="0.9"/>`
          + star(12, 76, 2.8, '#FFF6C4', 0.9) + star(10, 62, 2, '#FFF6C4', 0.75)
          // tail
          + `<path d="M 40,68 Q 30,72 26,62 Q 24,54 30,54" fill="none" stroke="${INK}" stroke-width="7" stroke-linecap="round"/><path d="M 40,68 Q 30,72 26,62 Q 24,54 30,54" fill="none" stroke="#3A2F58" stroke-width="4" stroke-linecap="round"/>`
          + sb_broom(c, 39, 80, -32, 54)
          + `<ellipse cx="52" cy="64" rx="12" ry="9.5" transform="rotate(-25 52 64)" fill="${fur}" ${LN}/>`
          + `<ellipse cx="63" cy="62" rx="3.8" ry="3" fill="#3A2F58" ${LN}/>`
          + sb_catHead(c, 52, 44, 14.5)
          // witch hat
          + `<g transform="rotate(-14 52 30)"><ellipse cx="52" cy="31" rx="15" ry="3.6" fill="${hat}" ${LN}/>`
          + `<path d="M 42,30.5 Q 46,20 50,12 Q 54,6 62,6 Q 57,11 57,18 Q 58,25 62,30.5 Z" fill="${hat}" ${LN}/>`
          + `<path d="M 43.5,27 Q 52,29.5 60.5,27 L 61.5,30.5 Q 52,33 42.5,30.5 Z" fill="#FF8A2A" ${LN}/></g>`
          + sb_frame(c, [[90, 14, 2.4]]);
      }),
  8192: hwTile(8192, c => backdrop(c, 8192, { hy: 48, hr: 50, color: '#FFE08A', op: 0.55 })
        + sb_moon(c, 50, 48, 28, 'sleepy')
        + `<path d="M 74,22 h 5 l -5,5 h 5 M 81,13 h 3.6 l -3.6,3.6 h 3.6" fill="none" stroke="#FFF6C4" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`
        + sb_bat(c, 20, 28, 0.78, -12, '#5A4890')
        + sb_bat(c, 76, 77, 0.9, 10, '#4A3A78')
        + sb_bat(c, 38, 86, 0.6, -6, '#5A4890')
        + sb_frame(c, [[12, 52, 3], [90, 52, 2.6], [70, 6, 2.2]])),
  16384: hwTile(16384, c => {
        const moon = rgrad(c, 'sb2mn', '#FFFCE6', '#FFD45E'), owl = rgrad(c, 'sb2ow', '#D9AE82', '#93603E'),
          belly = grad(c, 'sb2bl', '#FFF1DA', '#F2D2A8'), hat = grad(c, 'sb2hat', '#A98AE0', '#5A3F94');
        let s = backdrop(c, 16384, { hy: 56, hr: 48, color: '#FFE08A', op: 0.5 });
        // crescent moon lying like a cradle
        s += `<path d="M 14,66 A 36,30 0 0 0 86,66 A 38,22 0 0 1 14,66 Z" fill="${moon}" ${LN}/>`
          + `<circle cx="30" cy="82" r="2" fill="#F2C24E" opacity="0.5"/><circle cx="70" cy="83" r="2.6" fill="#F2C24E" opacity="0.5"/>`;
        // owl
        s += `<ellipse cx="34" cy="62" rx="5" ry="9" transform="rotate(18 34 62)" fill="#8A5A3A" ${LN}/><ellipse cx="66" cy="62" rx="5" ry="9" transform="rotate(-18 66 62)" fill="#8A5A3A" ${LN}/>`
          + `<ellipse cx="50" cy="58" rx="17" ry="19" fill="${owl}" ${LN}/>`
          + `<ellipse cx="50" cy="66" rx="10" ry="10" fill="${belly}"/>`
          + `<path d="M 45,63 q 2.5,2 5,0 q 2.5,2 5,0 M 43,68 q 2.5,2 5,0 q 2.5,2 5,0 q 2.5,2 5,0" fill="none" stroke="#C99A6E" stroke-width="1" stroke-linecap="round"/>`
          + `<path d="M 36,46 Q 43,44 50,50 Q 57,44 64,46" fill="none" stroke="#6E4428" stroke-width="1.3" stroke-linecap="round"/>`;
        for (const sg of [-1, 1]) {
          const x = 50 + sg * 7.4;
          s += `<circle cx="${x}" cy="53" r="6.4" fill="#FFF6E0" ${LN}/><circle cx="${x}" cy="53" r="4.4" fill="#F7C83A"/><circle cx="${x}" cy="53" r="2.5" fill="${FEAT}"/><circle cx="${x - 1.1}" cy="51.8" r="1.1" fill="white"/>`;
        }
        s += `<path d="M 47.6,58 L 52.4,58 L 50,62.4 Z" fill="#FF9A3C" ${LN}/>`
          + `<ellipse cx="38.5" cy="60.5" rx="2.6" ry="1.5" fill="#FF8FB8" opacity="0.75"/><ellipse cx="61.5" cy="60.5" rx="2.6" ry="1.5" fill="#FF8FB8" opacity="0.75"/>`
          // feet gripping the moon
          + `<path d="M 43,75.5 l 0,3 M 45.5,75.5 l 0,3 M 54.5,75.5 l 0,3 M 57,75.5 l 0,3" stroke="#FF9A3C" stroke-width="2.2" stroke-linecap="round"/>`;
        // witch hat
        s += `<g transform="rotate(-10 50 40)"><ellipse cx="50" cy="40" rx="17" ry="3.8" fill="${hat}" ${LN}/>`
          + `<path d="M 39,39.5 Q 43,28 47,20 Q 51,13 60,12 Q 54,18 55,26 Q 56,33 61,39.5 Z" fill="${hat}" ${LN}/>`
          + `<path d="M 40.5,35.8 Q 50,38.4 59.5,35.8 L 60.6,39.6 Q 50,42.2 39.4,39.6 Z" fill="#FF8A2A" ${LN}/>`
          + `<path d="M 58,11 l 1.2,-2.4 l 1.2,2.4 l 2.4,0.6 l -1.8,1.8 l 0.6,2.4 l -2.4,-1.2 l -2.4,1.2 l 0.6,-2.4 l -1.8,-1.8 Z" fill="#FFD23F" ${LN}/></g>`;
        return s + sb_frame(c, [[14, 22, 2.6], [86, 26, 2.4], [90, 56, 2]]);
      }),
};

// Candy bucket for the win / lose cards (twin of the fruit picnic basket)
function candyBucketSVG(opts = {}) {
  const c = { p: 'cb' + (opts.empty ? 'e' : 'f'), n: 0, defs: '', bg: {} };
  const P = c.p;
  const pail = grad(c, 'bk', '#8EE3D6', '#33A898'), pop = rgrad(c, 'lp', '#FFC2DD', '#FF6FA5'), pop2 = rgrad(c, 'lp2', '#D9B8FF', '#7E4FD0');
  const hard = rgrad(c, 'hc', '#FFC27A', '#FF8A2A');
  c.defs += `<pattern id="${P}bl" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#FFF4E6"/><rect width="4" height="8" fill="#FF8A2A" opacity="0.4"/><rect width="8" height="4" fill="#8E6CD8" opacity="0.4"/></pattern>`;
  const corn = (x, y, r) => `<g transform="translate(${x},${y}) rotate(${r}) scale(1.35)"><path d="M 0,-9 C 2,-9 7,5 7,7 C 7,10 -7,10 -7,7 C -7,5 -2,-9 0,-9 Z" fill="#FF8A2A" ${LN}/><path d="M -2.6,-4 L 2.6,-4" stroke="#FFFDF6" stroke-width="3"/><path d="M -6,6 L 6,6" stroke="#FFD23F" stroke-width="3.4"/></g>`;
  let s = `<rect x="6" y="64" width="88" height="34" rx="2" fill="url(#${P}bl)" ${LN}/>`;
  let b = `<ellipse cx="50" cy="91" rx="30" ry="3.6" fill="#3A2440" opacity="0.25"/>`;
  b += `<path d="M 25,48 Q 50,6 75,48" fill="none" stroke="${INK}" stroke-width="4.6" stroke-linecap="round"/><path d="M 25,48 Q 50,6 75,48" fill="none" stroke="#D8D2E4" stroke-width="2.2" stroke-linecap="round"/>`;
  if (!opts.empty) {
    // a generous heap of big sweets
    b += `<rect x="61" y="12" width="4.4" height="36" rx="2.2" fill="#FFF4E0" ${LN}/><circle cx="63.2" cy="13" r="12" fill="${pop}" ${LN}/><path d="M 63.2,13 m -2,0 a 2,2 0 1 1 4,0 a 6,6 0 1 1 -10,0 a 9.5,9.5 0 1 1 16,0" fill="none" stroke="white" stroke-width="2" opacity="0.7"/>`;
    b += `<rect x="33" y="18" width="4" height="30" rx="2" fill="#FFF4E0" ${LN}/><circle cx="35" cy="19" r="9.5" fill="${pop2}" ${LN}/><path d="M 35,19 m -1.5,0 a 1.5,1.5 0 1 1 3,0 a 5,5 0 1 1 -8,0" fill="none" stroke="white" stroke-width="1.8" opacity="0.6"/>`;
    b += `<g transform="translate(0 -4) scale(1)">` + corn(48, 36, -8) + `</g>` + corn(26, 40, -30) + corn(76, 38, 26);
    b += `<circle cx="50" cy="42" r="8" fill="${hard}" ${LN}/><path d="M 58,42 l 7,-4.5 l 0,9 Z M 42,42 l -7,-4.5 l 0,9 Z" fill="white" fill-opacity="0.85" ${LN}/>`;
    b += `<ellipse cx="46.5" cy="38.5" rx="2.4" ry="1.3" fill="white" opacity="0.7"/>`;
  }
  b += `<path d="M 22,46 L 78,46 L 72,88 Q 50,92 28,88 Z" fill="${pail}" ${LN}/><rect x="20" y="43" width="60" height="7" rx="3.5" fill="#B5F0E6" ${LN}/>`;
  b += shine(29, 60, 2.4, 7, 10);
  s += `<g transform="translate(50 92) scale(0.78) translate(-50 -92)">${b}</g>`;
  if (opts.spider) {
    const sp = rgrad(c, 'sp', '#6A5E86', '#2E2742');
    let legs = '';
    for (const sx of [-1, 1]) for (const [a, d] of [[-3, -2], [-1, 0], [1, 2], [3, 3]])
      legs += `<path d="M ${84 + sx * 3},${40 + a} q ${sx * 3},-3 ${sx * 6},${d}" fill="none" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`;
    s += `<path d="M 84,0 L 84,34" stroke="${INK}" stroke-width="0.7" opacity="0.6"/>` + legs
      + `<circle cx="84" cy="40" r="5.4" fill="${sp}" ${LN.replace('stroke-width="1.5"', 'stroke-width="1.1"')}/>`
      + `<circle cx="82.2" cy="39.5" r="1.1" fill="#F7E36A"/><circle cx="85.8" cy="39.5" r="1.1" fill="#F7E36A"/><circle cx="82.2" cy="39.5" r="0.45" fill="${FEAT}"/><circle cx="85.8" cy="39.5" r="0.45" fill="${FEAT}"/>`;
  }
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${c.defs}</defs>${s}</svg>`;
}

// ── Themes ────────────────────────────────────────────────────────────────────
// ── Cocoa Night ───────────────────────────────────────────────────────────────
// The same fruit after dark: each background is a deeper version of its pastel,
// with a faint warm glow so the tiles don't glare on the dark screen.
const NIGHT_BG = {
  2: '#4B3A78', 4: '#3E4680', 8: '#33507A', 16: '#2C5E66', 32: '#2F6045',
  64: '#4D5E2E', 128: '#6B5A24', 256: '#6E4626', 512: '#6E3A2C',
  1024: '#6E3238', 2048: '#6E2D52', 4096: '#6E2A55', 8192: '#702650', 16384: '#72234C',
};
const NIGHT_ART = Object.fromEntries(Object.entries(FRUIT_BUILD).map(([v, build]) => [v, tile(v, build, NIGHT_BG, 'nf', true)]));

const THEMES = {
  fruit: { name: 'Fruit Picnic', art: FRUIT_ART },
  night: { name: 'Cocoa Night', art: NIGHT_ART },
  halloween: { name: 'Spooky Picnic', art: HALLOWEEN_ART },
  bears: { name: 'Bear family', art: BEAR_ART },
};
// The game swaps this when the player changes theme (see applyTheme in game.js)
let TILE_ART = THEMES.fruit.art;

// ── Picnic basket (app icon and game-over card) ───────────────────────────────
// A round wicker fruit basket with a tall arched handle,
// twisted rope rim and scalloped weave. Fruit sits low so the handle shows:
// a watermelon in the middle with an apple and grapes either side, drawn with
// the game's own fruit art (FRUIT_BODY), without faces, slightly tilted.
// background=true adds the gingham cloth (used for the app icon);
// opts.empty draws it with no fruit; opts.blanket sets it on a gingham picnic
// blanket and opts.ants adds a little ant (all used on the game-over card).
function picnicBasketSVG(background = false, opts = {}) {
  const c = { p: (background ? 'pbi' : 'pb') + (opts.empty ? 'e' : ''), n: 0, defs: '', bg: {} };
  const P = c.p;
  const wood = grad(c, 'w', '#E2A866', '#B9783F'), rimG = grad(c, 'r', '#EDBB7A', '#C98A4E');
  const handleG = grad(c, 'h', '#E8B474', '#C48546');
  const body = 'M 12,67 L 15,86 Q 16,91 22,91 L 78,91 Q 84,91 85,86 L 88,67 Z';   // flat bottom, small rounded corners
  c.defs += `<clipPath id="${P}bc"><path d="${body}"/></clipPath>`;
  if (background) c.defs += `<pattern id="${P}gh" width="20" height="20" patternUnits="userSpaceOnUse"><rect width="20" height="20" fill="#FFF8EC"/><rect width="10" height="20" fill="#FF7891" opacity="0.22"/><rect width="20" height="10" fill="#FF7891" opacity="0.22"/></pattern>`;

  let s = '';
  if (background || opts.blanket) s += `<ellipse cx="50" cy="92" rx="36" ry="4" fill="#A06A3A" opacity="0.2"/>`;

  // tall arched handle (behind the fruit)
  const arch = 'M 16,66 C 14,4 86,4 84,66';
  s += `<path d="${arch}" fill="none" stroke="${INK}" stroke-width="7.4" stroke-linecap="round"/><path d="${arch}" fill="none" stroke="${handleG}" stroke-width="4.4" stroke-linecap="round"/>`;

  // fruit: the game's own fruit drawings (no faces), placed smaller in the
  // basket. Outlines are thickened so they match the basket's line weight.
  const place = (draw, x, y, k, tilt = 0) => {
    const part = draw(c)
      .split(LN).join(`stroke="${INK}" stroke-width="${(LW / k).toFixed(2)}" stroke-linejoin="round" stroke-linecap="round"`)
      .replace(/stroke-width="4\.4"/g, `stroke-width="${(2.6 + LW * 2 / k).toFixed(2)}"`)
      .replace(/stroke-width="2\.2"/g, 'stroke-width="2.6"');
    return `<g transform="translate(${(x - 50 * k).toFixed(2)},${(y - 58 * k).toFixed(2)}) scale(${k}) rotate(${tilt} 50 58)">${part}</g>`;
  };
  if (!opts.empty) {
    // three fruit, each tilted a little so they look naturally tossed in
    s += place(FRUIT_BODY.watermelon, 50, 52, 0.5, -10);
    s += place(FRUIT_BODY.apple, 29, 59, 0.44, -16);
    s += place(FRUIT_BODY.grape, 71, 59, 0.42, 18);
  }

  // basket body with scalloped weave rows
  let weave = '';
  [[74, 0], [80, 4], [86, 0]].forEach(([y, off]) => { for (let x = 10 + off; x < 92; x += 8) weave += `<path d="M ${x},${y} q 3,2.6 6,0" fill="none" stroke="#8E5A2E" stroke-width="1.6" stroke-linecap="round" opacity="0.55"/>`; });
  s += `<path d="${body}" fill="${wood}" ${LN}/><g clip-path="url(#${P}bc)">${weave}</g><path d="${body}" fill="none" ${LN}/>`;

  // twisted rope rim
  s += `<rect x="9" y="62" width="82" height="9" rx="4.5" fill="${rimG}" ${LN}/>`;
  for (let x = 13; x < 88; x += 5) s += `<path d="M ${x},63.5 q 3.4,3 1.6,6" fill="none" stroke="#9A6233" stroke-width="1.4" stroke-linecap="round" opacity="0.7"/>`;
  s += `<path d="M 13,64 L 87,64" stroke="white" stroke-width="1.1" stroke-linecap="round" opacity="0.4"/>`;


  if (opts.ants) {
    // a little ant on the blanket (game over: the basket is empty)
    const ant = (x, y, rot, carry) => {
      let a = `<g transform="translate(${x},${y}) rotate(${rot}) scale(1.3)">`;
      a += `<g stroke="${INK}" stroke-width="0.7" stroke-linecap="round" fill="none">`
        + `<path d="M 0.5,0 l -1.6,2.6 M 0.5,0 l 0.4,3 M 0.5,0 l 2,2.6 M 0.5,0 l -1.6,-2.6 M 0.5,0 l 0.4,-3 M 0.5,0 l 2,-2.6"/>`
        + `<path d="M 3.6,-0.6 q 1.4,-2.2 2.8,-2.2 M 3.6,0.6 q 1.4,2.2 2.8,2.2"/></g>`;
      a += `<ellipse cx="-2.4" cy="0" rx="2.6" ry="2" fill="#4A2A4C"/><circle cx="0.6" cy="0" r="1.3" fill="#4A2A4C"/><circle cx="3.4" cy="0" r="1.6" fill="#4A2A4C"/>`;
      a += `<circle cx="3.9" cy="-0.5" r="0.45" fill="white"/>`;
      if (carry) a += `<circle cx="0.4" cy="-3.4" r="2.6" fill="#9B6BE0" ${LN.replace('stroke-width="1.5"', 'stroke-width="0.7"')}/><circle cx="-0.3" cy="-4.1" r="0.7" fill="white" opacity="0.7"/>`;
      return a + '</g>';
    };
    var ants = ant(18, 92, -6, false);
  }
  if (opts.blanket) {
    // set the basket (a little smaller) on a gingham picnic blanket
    c.defs += `<pattern id="${P}bl" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#FFFFFF"/><rect width="4" height="8" fill="#FF5D7E" opacity="0.45"/><rect width="8" height="4" fill="#FF5D7E" opacity="0.45"/></pattern>`;
    const blanket = `<rect x="6" y="64" width="88" height="34" rx="2" fill="url(#${P}bl)" ${LN}/>`;
    s = blanket + `<g transform="translate(50 84) scale(0.8) translate(-50 -91)">${s}</g>` + (opts.ants ? ants : '');
  } else if (opts.ants) {
    s += ants;
  }

  // on the app icon, zoom the basket in slightly so it fills more of the square
  if (background) s = `<rect width="100" height="100" fill="url(#${P}gh)"/><g transform="translate(50 50) scale(1.06) translate(-50 -50)">${s}</g>`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs>${c.defs}</defs>${s}</svg>`;
}

---
name: app-design-review
description: Full design review of a web app, PWA or Capacitor/iPhone app (and games) against accessibility (WCAG 2.2 AA, Apple's accessibility labels), motion, UX heuristics (Nielsen Norman, Apple HIG) and UI design-system consistency, ending in a prioritised fix plan. Use only when the user explicitly asks for a full or complete review, audit or check of the app's design / accessibility / UX (for example "do a full review", "run the design review", "audit the app before launch"). Do not use it for a single design question, a one-off fix, or feedback on one screen; answer those directly.
---

# App design review

A review in four passes: **measure**, **look**, **compare to standards**, **plan**.
Measuring first matters because opinions about contrast or tap size are
unreliable by eye; a number settles it and tells the user exactly what to
change. Looking matters because scripts can't see clutter, hierarchy or
charm. Keep both.

## 0. Set up (5 minutes)

1. Find how to open the app: a local `index.html`, a dev server, or a deployed
   URL. For a Capacitor app, review the web build; the native shell adds
   only the status bar, safe areas and orientation (check `Info.plist`).
2. Find the **scenes** worth reviewing: the main screen, every dialog, sheet
   or panel, empty states, first-run, error and success states. Write them
   as a scenes file (see `scripts/README.md`): each scene is a name plus a
   line of JavaScript that opens it. Most apps have 6–12.
3. Find the **themes** (light/dark, skins). The scripts take a list of
   `attribute=value` pairs or a localStorage key to switch them.
4. If the app talks to a backend, stub it (the scripts accept a `--stub`
   JSON of canned responses) so screens show realistic data, including a
   "you" row, a long list, and an empty list.

## 1. Measure (run the scripts, don't eyeball)

Run from the skill's `scripts/` folder (needs Node with Playwright; the
`axe-core` package is fetched on first run):

```
node audit.js <url> --scenes scenes.json [--themes data-skin=fruit,night] [--stub stub.json] [--viewport 390x844]
node motion.js <path-to-css-and-html>
node shots.js <url> --scenes scenes.json [--themes ...] --out shots/
```

- `audit.js` reports, per scene and theme: text below WCAG contrast
  (4.5:1, or 3:1 for text ≥24px or ≥18.66px bold), **including the worst
  case over patterned or gradient backgrounds** (sampled from pixels, since
  `background-color` alone misses gingham, photos and gradients), text under
  13px, `::before`/`::after` text under 11px (badges, counters), tap targets
  under 44×44px (Apple), control outlines under 3:1 (WCAG 1.4.11), buttons in
  closed panels that are still reachable by Tab / VoiceOver, and the axe-core
  rule violations.
- `motion.js` lists every animation and transition with its duration, flags
  anything infinite or longer than 5s (WCAG 2.2.2 needs a way to stop it),
  anything over 400ms (Material's upper bound for UI motion), and reports
  which animations are covered by `prefers-reduced-motion`. It also flags
  `user-scalable=no` / `maximum-scale=1` (WCAG 1.4.4 fails), missing `lang`,
  and the lack of a `<main>` landmark.
- `shots.js` screenshots each scene in each theme and builds contact sheets.
  Look at these at full size; most visual problems are only visible there.

Then cover the **devices and settings** the app actually ships to. Most real
bugs hide here, and a desktop-sized check never sees them:

- **Short phone** (375×667, iPhone SE): sheets and cards that fit on a tall
  phone often push their main button off screen.
- **iPad and landscape**, if the native config allows them. Read the
  supported orientations and device families (`Info.plist`
  `UISupportedInterfaceOrientations~ipad`, `UIRequiredDeviceCapabilities`,
  Android `screenOrientation`), then screenshot at 1024×768 and 768×1024.
  A board or canvas cut off in landscape is a common rejection reason.
- **200% text**: set `document.documentElement.style.fontSize = '200%'` (or
  the in-app text size setting) and screenshot the main screens. Apple's
  Larger Text label means everything still fits and works at 200%.
- **Reduce Motion**: run once with `prefers-reduced-motion: reduce` emulated
  (Playwright `reducedMotion: 'reduce'`) and confirm the big motions actually
  stop, rather than trusting the CSS inventory.
- **Offline / backend down**: one pass with the stub removed, to see the
  error and empty states real users hit.

Also read the native project for review blockers the browser can't show:
placeholder text (`[CONTACT EMAIL]`, `TODO`, `lorem`) in the privacy page or
store copy, obsolete capabilities (e.g. `armv7`), a missing privacy policy
link, or a status bar style that doesn't follow the theme.

Record the numbers. The report quotes them ("2.95:1 on white", "19px tall").
When the CSS says one thing and the rendered page another (an infinite
animation overridden to three loops, a colour token changed later in the
file), trust the rendered measurement and say which you checked.

## 2. Look (the designer's pass)

Open the contact sheets and read each screen as a first-time user, then as a
designer. `references/design-checklist.md` is the list; the headline
questions are:

- **Hierarchy:** can you tell in one glance what matters most? Count how
  many font weights, sizes and colours are doing the same job.
- **Consistency:** count distinct border radii, shadows, border styles and
  button treatments in the CSS (`motion.js --tokens` prints these). More
  than ~4 radii or ~3 shadow styles is a sign the system drifted.
- **One primary action per screen.** Two equally bright buttons is the most
  common finding.
- **Native feel on phone:** dialogs vs bottom sheets, back affordance, safe
  areas, grabbers, swipe to dismiss, status bar colour per theme.
- **Signature vs noise:** a motif used once is charm; used everywhere it is
  clutter. Dashed borders, gradients, emoji, drop shadows under text are the
  usual suspects.
- **Copy:** centred text that wraps to 2+ lines reads slowly; keep centred
  text to one line or left-align it. Labels say what happens ("Create
  group", not "Start"). Errors say what to do.
- **Motion:** does it have 2–3 deliberate moments (a sheet slide, a count-up,
  a merge pulse) rather than everything bouncing? Does Reduce Motion give a
  fade instead?

## 3. Compare to standards

Map each finding to the criterion it fails or the guideline it ignores, so
the user knows which are *requirements* and which are *taste*.
`references/standards.md` has the criteria with thresholds and the citations:
WCAG 2.2 (A/AA), Apple HIG (motion, typography, layout, onboarding, game
controls), Apple's accessibility and privacy labels, Nielsen Norman's ten
heuristics, Material motion durations, and the Game Accessibility Guidelines
basics for games. Note which Apple accessibility labels the app could
honestly claim after the fixes.

Common findings and what they map to:

| Finding | Standard |
|---|---|
| Pinch zoom disabled | WCAG 1.4.4 (critical in axe) |
| Swipe is the only touch control | WCAG 2.5.1 Pointer Gestures: add a tap alternative |
| Confetti / bouncing art runs forever | WCAG 2.2.2: stop after ~5s or offer a pause |
| Animations ignore Reduce Motion | WCAG 2.3.3 / Apple Reduced Motion label |
| Text < 4.5:1 | WCAG 1.4.3 |
| Links 19–22px tall | Apple 44pt; WCAG 2.5.8 minimum 24px |
| Dialog doesn't move/trap focus | WCAG 2.4.3 / 2.1.2 |
| Board or canvas silent to screen readers | WCAG 1.1.1, 4.1.3 live region |
| No larger-text support | Apple "Larger Text" label (200%) |
| No dark mode auto-pick | Apple "Dark Interface" label |
| Destructive button with no confirm/undo | NN/g error prevention |

## 4. Plan and report

Write the report with `references/report-template.md`. The shape is:

1. **How I checked** (scenes × themes, scripts, by-hand reads).
2. **Scorecard**: a table of areas with Pass / Fail / Gap and the number.
3. **The plan in phases**, each item with the fix *and* the standard it
   meets. Size it honestly for how the work will actually be done: your own
   working time in minutes (most CSS and copy fixes are a few minutes each;
   a new feature like on-screen controls or a screen-reader layer is tens of
   minutes), plus any steps only the user can do (testing on their phone,
   running a database script, App Store Connect forms). Don't quote human
   developer days; they mislead the user about cost and speed.
   - Phase 1: must-fix requirements (accessibility failures, broken flows)
   - Phase 2: assistive tech and text size (VoiceOver, Larger Text, dark)
   - Phase 3: UX polish (confirmations, copy, empty states)
   - Phase 4: store listing (accessibility and privacy labels)
4. **Sources** as links.

For the **visual** half, don't stop at a list: offer a before/after mock-up
of 2–3 key screens built from the app's real art and palette, with the
proposed token set (radii, shadows, surfaces, type weights) shown
underneath. People approve a direction far faster from a picture than from
a bullet list. Build it as an artifact or HTML page; put real screenshots on
the "today" side.

**Prove proposed fixes before recommending them.** When you suggest new
colours, sizes or spacing, inject them into the page (`page.addStyleTag`)
and re-run `audit.js`, then quote before → after ("link 3.91 → 5.6:1"). A
replacement colour that fails on the gingham, or a bigger label that
overflows on the SE, is caught here instead of by the user.

After fixes land in the code, **re-run `audit.js`** and quote the
before/after numbers. A review that ends "all 11 screens × 3 themes pass" is
worth more than one that ends "looks better".

Save what you measured next to the report (`audit.json`, the scenes and stub
files, the contact sheets) so the next review can compare against it.

## When to run it

Run the full review only when asked for one. Between reviews, keep using
what it taught (contrast, tap size, one primary button, Reduce Motion) when
building, but don't launch the scripts, research and report unprompted.

## Tone with the user

Many people asking for this aren't designers or engineers. Lead with the
three things that matter most, explain *why* a standard exists in one
sentence ("44pt is the width of a fingertip"), and keep jargon out of the
scorecard. Say clearly which findings are legal/accessibility requirements
and which are style opinions, and give a recommendation rather than a menu.

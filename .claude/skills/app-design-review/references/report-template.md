# Report template

Use these headings in this order. Keep the scorecard free of jargon; put
criterion numbers in the plan, not the scorecard.

---

## How I checked
- Scenes × themes measured (e.g., 11 screens × 3 themes, 390×844 and 375×667).
- Scripts: `audit.js` (contrast, text size, tap size, axe-core WCAG 2.2 AA), `motion.js` (animations, Reduce Motion coverage, viewport/lang/landmarks), `shots.js` contact sheets.
- By hand: code read for input methods, focus handling, screen-reader support, timers, orientation, privacy.
- Standards: WCAG 2.2 AA, Apple HIG + accessibility/privacy labels, Nielsen Norman heuristics, Material motion, Game Accessibility Guidelines (if a game).

## What's working (keep)
3–6 bullets. Name the strengths specifically so they aren't "fixed" away.

## Scorecard
| Area | Status | Evidence |
|---|---|---|
| Contrast | Pass / Fail | worst pair and ratio |
| Text size | … | smallest size |
| Tap targets | … | smallest control |
| Colour not the only cue | … | |
| Zoom / text scaling | … | |
| Touch alternatives to gestures | … | |
| Keyboard / focus | … | |
| Screen reader | … | |
| Reduce Motion | … | n of m animations covered |
| Endless motion | … | |
| Flashing | … | |
| Dark appearance | … | |
| Orientation / safe areas | … | |
| Error states and feedback | … | |
| Design-system consistency | … | radii / shadows / weights counts |
| Primary action per screen | … | |
| Copy and empty states | … | |
| Privacy policy and labels | … | |

## The plan
**Phase 1 — must fix (requirements)** · my time ≈ N min · your steps: …
1. Fix → criterion it meets (≈ N min)
**Phase 2 — assistive tech and text size** · my time ≈ N min · your steps: …
**Phase 3 — UX polish** · my time ≈ N min
**Phase 4 — store listing** · your steps in App Store Connect

Sizes are the assistant's own working time plus the user's hands-on steps,
never human developer days.
Legal/compliance note if relevant (one paragraph, "not legal advice").

## Visual direction (if the review covers look and feel)
Before/after mock-up link; the proposed token set (radii, shadows, surfaces, type weights); the 3–5 visible changes.

## Sources
Markdown links to every standard cited.

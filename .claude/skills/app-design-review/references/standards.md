# Standards and thresholds

Quote the criterion and the number in the report. Links at the bottom.

## WCAG 2.2 (Level A / AA) — the ones that bite in apps and games

| Criterion | Threshold / rule | Typical fix |
|---|---|---|
| 1.1.1 Non-text content (A) | Every meaningful image/tile/icon has a text alternative | `alt`, `aria-label`; decorative art `alt=""` |
| 1.3.4 Orientation (AA) | Don't lock orientation unless essential | Allow landscape or justify the lock (games often qualify) |
| 1.4.3 Contrast (AA) | 4.5:1 for text; 3:1 for large text (≥24px, or ≥18.66px bold) | Deeper text shade of the accent; darker neutrals |
| 1.4.4 Resize text (AA) | Text to 200% without loss; **`user-scalable=no` / `maximum-scale=1` fails** | Remove it; use `touch-action: manipulation` to kill double-tap zoom |
| 1.4.10 Reflow (AA) | No horizontal scroll at 320px wide | Wrap, stack, `min-width: 0` |
| 1.4.11 Non-text contrast (AA) | 3:1 for controls' boundaries and state (checkbox, switch, focus ring) | Darker outline or filled state |
| 2.1.1 Keyboard (A) | Everything works from a keyboard (desktop web) | Arrow keys, Enter/Space, Escape |
| 2.1.2 No keyboard trap (A) / 2.4.3 Focus order | Dialogs move focus in, keep it in, return it on close | Focus first control on open; restore on close |
| 2.2.1 Timing adjustable (A) | Auto-advancing content can be paused/extended | Tutorials: let a tap advance; no hard timeouts |
| 2.2.2 Pause, stop, hide (A) | Motion that starts automatically, lasts >5s and sits beside other content needs a stop | Confetti stops at ~4s; loops run 3 times; or a pause control |
| 2.3.1 Three flashes (A) | Nothing flashes >3 times per second | Check celebration effects |
| 2.3.3 Animation from interactions (AAA, but Apple expects it) | Honour `prefers-reduced-motion` | Fades instead of slides/bounces/scales |
| 2.4.7 Focus visible (AA) / 2.4.11 Focus not obscured (AA) | Visible focus ring, not hidden under sticky bars | `:focus-visible` outline 3px, contrast 3:1 |
| 2.5.1 Pointer gestures (A) | Path gestures (swipe, drag) need a single-tap alternative unless essential | On-screen arrows, tap-an-edge, buttons |
| 2.5.7 Dragging movements (AA) | Dragging needs a non-drag alternative | Tap targets or steppers |
| 2.5.8 Target size (AA) | 24×24px minimum (Apple: 44×44pt recommended) | `min-height: 44px`; invisible padding on text links |
| 3.2.6 Consistent help (A) | Help/contact in the same place on every screen | Same footer link position |
| 3.3.1 Error identification (A) / 3.3.3 Suggestion | Say what's wrong and how to fix it, in text, with `role="alert"` | "Names need at least 2 letters." |
| 3.3.7 Redundant entry (A) | Don't ask for the same info twice in a flow | Remember the name once entered |
| 4.1.2 Name, role, value (A) | Controls are real buttons/inputs or have correct ARIA; `li role=button` is wrong | Put a `<button>` inside the `<li>` |
| 4.1.3 Status messages (AA) | Announce results without moving focus | `role="status"` / `aria-live="polite"` region for score, moves, game over |

## Apple Human Interface Guidelines

- **Tap targets:** 44×44pt minimum, with spacing between neighbours.
- **Typography:** nothing below 11pt; body near 17pt; support Dynamic Type (in a web view: `font: -apple-system-body` or an in-app text size setting up to 200%).
- **Motion:** make it optional; when Reduce Motion is on, replace slides, bounces, scaling and parallax with fades or colour changes. Avoid gratuitous motion; durations roughly 200–400ms for UI.
- **Layout:** respect safe areas (`env(safe-area-inset-*)`); one primary action per screen; sheets slide up from the bottom on iPhone with a grabber, centred alerts are for short confirmations.
- **Colour:** one tint for interactive elements; semantic colours separate from the accent; a light and a dark appearance; status bar style follows the theme.
- **Onboarding (games):** short, interactive, skippable; teach in context; don't put onboarding on the launch screen.
- **Game controls:** direct touch where possible; virtual buttons in reachable spots clear of the home indicator; support keyboard/controller where it makes sense.

## Apple accessibility labels (App Store Connect)

Nine declarable features. Claim one only when every common task works with it:
VoiceOver · Voice Control · Larger Text (200%+) · Dark Interface · Differentiate Without Color Alone · Sufficient Contrast · Reduced Motion · Captions · Audio Descriptions.
Voluntary today; Apple has said they will become required for updates.

## Apple privacy label (App Store Connect)

Buckets: Data Used to Track You / Linked to You / Not Linked to You. A random
per-install id plus a chosen nickname and scores, with no account, is
typically "Not linked to you: Identifiers, User Content, Other data". No
third-party ad SDK means "no tracking". Must match the privacy policy.

## Nielsen Norman Group — the ten heuristics, applied to apps

1. Visibility of status: posting…, saved, copied, your place changed.
2. Match the real world: "Create group", not "Start"; "Copy link", not "Code".
3. User control: undo or confirm before destructive actions (New game mid-run); swipe-down to dismiss sheets; Escape.
4. Consistency: same shapes, same button hierarchy, same place for Back/Close.
5. Error prevention: don't stack two look-alike inputs with opposite purposes; disable Post with nothing selected and say why.
6. Recognition over recall: lists instead of codes; remembered choices; last-viewed board reopens.
7. Flexibility: shortcuts for regulars (remembered tick boxes), simple path for newcomers.
8. Aesthetic and minimalist: every border, shadow and label competes with content; one motif per screen.
9. Help users recover: errors in plain words with the next step.
10. Help: How to play reachable from the main screen; privacy and contact in a stable place.

NN/g on text: centred text is fine for a single line; once it wraps, each line starts somewhere new and reading slows. Left-align paragraphs or keep centred text to one line.

## Material motion (useful numbers even on iOS)

Standard UI transitions ~300ms on mobile; entering ~225ms, exiting ~195ms; anything beyond ~400ms feels slow; large full-screen moves up to ~375ms. Standard easing `cubic-bezier(0.2, 0, 0, 1)`; use a slight overshoot only for a deliberate moment (a sheet arriving).

## Game Accessibility Guidelines (basic level)

Remappable/alternative controls; large, well-spaced touch controls; a haptics toggle; separate volume or mutes for effects and music; no essential information by colour alone; readable text size; a tutorial; settings remembered; accessibility features listed on the store page; no essential information by sound alone.

## European Accessibility Act (context, not legal advice)

Applies from 28 June 2025 to apps in listed sectors (e-commerce, banking, transport, telecoms, e-books, etc.); references EN 301 549, which maps to WCAG 2.1 AA. A free puzzle game is usually outside scope; meeting WCAG 2.2 AA covers it anyway.

## Links

- W3C, What's new in WCAG 2.2: https://www.w3.org/WAI/standards-guidelines/wcag/new-in-22/
- WCAG 2.5.1 Pointer Gestures: https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures
- WCAG 2.2.2 Pause, Stop, Hide: https://www.w3.org/WAI/WCAG22/Understanding/pause-stop-hide
- Apple HIG Motion: https://developer.apple.com/design/human-interface-guidelines/motion
- Apple HIG Typography: https://developer.apple.com/design/human-interface-guidelines/typography
- Apple HIG Onboarding: https://developer.apple.com/design/human-interface-guidelines/onboarding
- Apple HIG Game controls: https://developer.apple.com/design/human-interface-guidelines/game-controls
- Apple accessibility labels overview: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/overview-of-accessibility-nutrition-labels
- Apple Reduced Motion evaluation criteria: https://developer.apple.com/help/app-store-connect/manage-app-accessibility/reduced-motion-evaluation-criteria
- Apple privacy labels: https://www.apple.com/privacy/labels/
- Game Accessibility Guidelines (basic): https://gameaccessibilityguidelines.com/basic/
- Material motion duration and easing: https://m1.material.io/motion/duration-easing.html
- NN/g ten usability heuristics: https://www.nngroup.com/articles/ten-usability-heuristics/

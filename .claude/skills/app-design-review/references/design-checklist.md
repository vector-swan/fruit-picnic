# Design checklist (the "look" pass)

Go screen by screen on the contact sheets. Tick, or write the finding with
the screen name. Finish with the token counts from `motion.js --tokens`.

## Hierarchy
- [ ] One glance tells you the most important thing on the screen.
- [ ] At most three type weights doing distinct jobs (display, label, body).
- [ ] Numbers that matter (score, place, price) are the largest non-heading text.
- [ ] Headings don't carry effects (drop shadow, outline) unless it's the brand's one signature.

## Consistency (the token test)
- [ ] ≤4 border radii, used by size class (small controls, cards, containers, pills).
- [ ] ≤3 shadow styles; pressable things share one, static things have none.
- [ ] ≤3 surface treatments (fill, highlight, outline). A dashed/decorative border appears at most once per screen.
- [ ] One tint for interactive elements; semantic colours (good/warn/bad) separate from it.
- [ ] Icons from one family (same stroke, same corner style); no emoji standing in for icons.
- [ ] The same thing is in the same place on every screen (Close, Back, primary action).

## Actions
- [ ] Exactly one primary (filled, bright) button per screen; secondary is outlined or text.
- [ ] Destructive or irreversible actions confirm or offer undo.
- [ ] Labels name the outcome ("Create group", "Copy link", "Post score").
- [ ] Primary action within thumb reach on phone (bottom third), pinned if the content scrolls.

## Phone-native feel (iOS)
- [ ] Panels are bottom sheets with a grabber and swipe-down; alerts are centred and short.
- [ ] Safe areas respected top and bottom; status bar style matches the theme.
- [ ] Back is top-left; Close (X) is top-right; both ≥44pt.
- [ ] Works on a 375×667 screen without clipping the primary action.
- [ ] Dark appearance exists and is picked up from the system when the user hasn't chosen.
- [ ] iPad and landscape either work (nothing cut off, sensible max width) or are switched off in the native config.
- [ ] At 200% text everything still fits; long words wrap instead of clipping.
- [ ] Closed panels are removed from the Tab / VoiceOver order (`inert`, `hidden` or `visibility: hidden`), not just faded out.

## Content and copy
- [ ] Centred text is one line; longer text is left-aligned.
- [ ] Empty states say what will appear and how to get the first item.
- [ ] Loading, offline and error states exist and use plain words with a next step.
- [ ] No duplicate information on one screen (the same note under every list).
- [ ] First-run: name/identity asked once, in its own box, after the user has a reason.
- [ ] No placeholder text anywhere a reviewer will look (privacy page, store copy, About).
- [ ] Alignment follows ownership: sheet titles, empty states and one-line moments centred; form labels, helper text, list rows and multi-line paragraphs left-aligned.

## Motion
- [ ] 2–3 deliberate moments (arrival, reward, result); everything else is quick (≤300ms) or still.
- [ ] Nothing loops forever beside content the user is reading.
- [ ] Reduce Motion: slides/bounces/scales become fades; count-ups jump; confetti becomes a sparkle or nothing.
- [ ] Transitions share one easing; a single overshoot curve is reserved for the arrival moment.

## Charm vs noise (for cozy / playful products)
- [ ] The illustration is the hero; UI chrome around it is quiet.
- [ ] One signature treatment (e.g., chunky bottom shadow) is used everywhere pressable, and nowhere else.
- [ ] Patterned backgrounds sit under cards, never under body text directly.
- [ ] Colour count on a single screen ≤ accent + neutral + the art.

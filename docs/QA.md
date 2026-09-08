# Review verification — 8 September 2026

## Result

48 automated tests pass. The static release builds successfully. The winding-trail interface was exercised in the Codex in-app browser, including a packaged build served beneath `/number-knockout/`. No blocking game, save, or layout defect was found in this coverage.

## Automated coverage

- Exact fractions, rational powers, radical cancellation, precedence, negative powers, zero division, duplicate dice, missing dice, resource limits, and near-integers that must not round into valid moves.
- Every tested Oracle answer rechecked by the exact evaluator; duplicate-die identity remapping and search-range limits.
- Atomic turn commits, restored handoffs, wall ownership and breaking, six-turn draws, and dragon victory.
- Three complete reproducible races (seeds 1, 42, and 9182) ending with verified dragon wins and restorable turn states.
- All 34 trail stones connected to the goal, graph symmetry, two entry stones, fork and wall rules, and the two legal lair approaches.
- No road crossings or roads through unrelated stones.
- The removed upper shortcut cannot be used for movement or wall placement; the full right-hand bend remains connected.
- Shared-stone arrival for either knight, refresh/restoration together, independent departure, wall restrictions, and a single winner from a shared lair approach.
- Reordered/shared-stone equation rejection, allowed alternatives, persistent reminders, Oracle exclusion caching, and the one-method exception with dice 1, 2, 2 and target 21. Stale, absent, failed, and alternative-found checks cannot unlock copying.
- Solo settings and old-save compatibility; computer movement, wall removal, defensive wall placement, exact dragon wins, shared-stone alternatives and the one-method exception.
- Six complete computer races across both styles and three seeds, with legal outcomes and restorable turns.
- Computer turn scheduling commits exactly once; pause, replacement quests, late responses and errors cannot spend an extra turn.
- Draft restoration, corrupt saves, failed storage writes, malformed history repair, and preservation of advanced grid saves.

Run `npm test` from the project root.

## Browser checks

The revised trail was tested with:

- A manual `4 × 2 − 2 = 6` opening, a single handoff to Blue, and occupation of the destination stone.
- All five revised tutorial lessons, including a connected move, free powers, building, remote breaking, and reaching the new lair. Returning restored the real quest's player, turn, and target.
- Progressive Oracle hints and a complete verified dragon attack from the new approach stone.
- An advanced legacy save's recovery notice, temporary play, and refresh showing that the old session stayed protected.
- Small-screen overview, enlarged stones (approximately 59 × 50 CSS pixels at 390px width), target selection, preserved map scroll, and keyboard horizontal panning.
- Packaged artwork, a tutorial move, increased map contrast, reduced motion, and a verified practice result at the retained `calculator.html` route.
- Gold joining Blue, Blue joining Gold, refreshing while sharing, and a knight leaving independently; both figures and the stone number remained visible on the enlarged phone map.
- Reordered `3 + 2 + 1` rejected without spending the turn; Oracle provided `1 × 2 × 3`, which moved the knight onto the shared destination.
- With hints disabled, `1 + 2² + 2⁴ = 21` received the automatic one-method exception. Refresh performed the check again, the move succeeded, and the exception appeared in the Battle Chronicle. The phone layout at 390px had no page overflow.
- One-player setup, named Gold player, Squire/Knight selection, one automatic computer move, and return to human controls.
- Pause and practice kept the computer’s turn unspent; refresh restored the mode and turn. Keyboard and board input were blocked during the computer turn.
- The computer displayed and used the shared-stone one-method exception; a computer dragon victory and same-board solo rematch completed with the alternating starter.
- Solo setup fits 390px and 320px screens with no page overflow. Switching back to two-player mode restored a human-controlled Blue turn with no automatic move.
- No console errors or warnings in the observed flows.

The preceding build checks also covered manual token replacement, custom fractional powers and undo, keyboard arithmetic, all three hints, practice isolation, draft persistence on refresh, pass/draw, same-board rematch and alternating starter, save recovery, and preference persistence. The final automated suite reruns the shared engine coverage against the trail release.

## Layout coverage

| Viewport    | Result                                                                                               |
| ----------- | ---------------------------------------------------------------------------------------------------- |
| 320 × 740   | Full map overview, target selector, and reflowing controls; no page overflow.                        |
| 390 × 844   | Overview and enlarged map inspected; main controls remain separate from the map.                     |
| 768 × 1024  | Portrait tablet reflow; no page overflow.                                                            |
| 1024 × 768  | Landscape tablet; no page overflow.                                                                  |
| 1440 × 1080 | Desktop map and turn panel inspected.                                                                |
| 844 × 390   | Short landscape; ordinary vertical scrolling, no page overflow.                                      |
| 720 × 900   | Narrow-layout check approximating the CSS viewport reduction of 200% desktop zoom; no page overflow. |

All 34 stones were present at every checked width, with no missing loaded images. Overview stones on phones are intentionally compact; Enlarge map and the native target list provide larger interaction options.

Actual application screenshots are included in the local review folder: desktop, full phone layout, and enlarged phone map. They are separate from generated concept artwork.

## Limits and release checks

- This is browser viewport testing, not physical iPhone/iPad/Android testing. Safari, Firefox, screen readers, text-only zoom, and actual speaker playback were not independently verified. The 720px check is not a claim of native browser text-zoom coverage.
- Run the public HTTPS GitHub Pages smoke test after deployment and record the served revision. The local release report records that result separately from these pre-deployment checks.
- The Oracle is bounded and does not prove a number impossible. A legal action is not guaranteed for every roll.
- Human playtesting is still needed for route balance, session length, first-player advantage, and wall bottlenecks.
- Saves are local to a browser/origin. Advanced old-grid quests cannot resume on the new trail; their original data is preserved with explicit recovery choices.
- Artwork uses optimized opaque JPEGs with CSS masks, rather than true transparent character cutouts. System fonts are used. These presentation choices are recorded in the asset notes.

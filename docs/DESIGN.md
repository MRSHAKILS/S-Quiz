# Design principles

Players are on a phone, one-handed, in a loud room, with seconds to react. The host is on a projector. Design for those two situations first.

## Principles
1. **One job per screen.** A player screen shows the question and the options. Nothing else competes.
2. **Big targets, no precision.** Answer buttons fill the lower half of the screen, minimum 56 px tall, thumb-reachable.
3. **Never rely on colour alone.** Options carry a letter and a shape; correct and wrong states add an icon and text.
4. **Numbers must not jitter.** Scores, timers and ranks use tabular numerals.
5. **Motion explains, never decorates.** Rank changes animate position; everything respects `prefers-reduced-motion`.
6. **Fast on bad networks.** System fonts, no webfont fetch, no heavy images, server-rendered first paint.
7. **Readable from the back of a room.** Host view uses large type and a high-contrast, projector-safe palette.

## Visual system
- **Colour:** neutral paper and ink with a single vermilion accent for the primary action and the active state. Success and error colours are reserved for answer feedback. Light and dark themes via tokens in `src/app/globals.css`.
- **Type:** system sans for UI, system monospace for join codes and timers. Display sizes are large and few.
- **Shape:** 8 px controls, 12 px cards, 1 px hairline borders instead of shadows.
- **Spacing:** 4 px base grid, 16 px mobile gutters.

## Screens
| Screen | Primary content | Key decision |
|---|---|---|
| Landing | Join-by-code field | Players outnumber hosts, so joining is the dominant action. |
| Join | Nickname, then lobby | Inline validation, clear full/locked/taken messages. |
| Player question | Timer bar, four large options | Locks after tapping so a mis-tap is not a double submit. Does not reveal correctness until the round ends. |
| Reveal | Correct option, your rank change | Shows delta (+640, up 3) not just a total. |
| Host lobby | Code, QR, live player list, start | Code and QR large enough for a projector. |
| Host live | Question, answered count, reveal/next | Big single primary action per state. |
| Podium | Top three, then full ranking | Shareable result link. |

## Accessibility baseline
Visible focus ring, labelled inputs with described errors, 4.5:1 text contrast in both themes, full keyboard operation of the host screen, live-region announcements for round changes.

# Roadmap

| Phase | Scope | Status |
|---|---|---|
| 1 | Scaffold, domain core, ports and adapters, game service, CI, design tokens, landing | Done |
| 2 | Auth.js (Google, GitHub), dashboard, quiz editor, REST routes | Done |
| 3 | Host session screen, QR and link, guest join, lobby with live count, caps | Done |
| 4 | Live play UI: timer, answers, reveal, leaderboard, reconnect via `snapshot()` | Done |
| 5 | Podium, results history, kick/lock, free-tier error states | Done |
| 6 | Playwright end-to-end test, Redis capacity test | Done |

## Next up
- Rate limiting on join and answer routes (Redis counters).
- Validate Mongo adapter in CI with a `mongo` service container and a contract suite for the repositories.
- Apply push events directly for reveal and end (today they trigger a snapshot refetch) to cut Redis commands per round.
- Accessibility audit with axe, and a projector-optimised host theme.
- Highlight the current player on the leaderboard (expose the player id in the snapshot).

## Later ideas
AI question generation, more question types, image questions, team mode, self-paced mode, CSV import, public quiz library.

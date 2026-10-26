# SQuiz

A live quiz platform: a host builds a quiz, shares a link or QR code, players join from their phones with no install, and the fastest correct answers climb a live leaderboard.

Built as a portfolio project on **free tiers only**, and designed so every technology choice is explicit, justified and replaceable. Start with [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md) and [`docs/DECISIONS.md`](docs/DECISIONS.md).

## Stack at a glance

| Concern | Technology | Why this one (and what else would work) |
|---|---|---|
| App + API | Next.js (App Router), TypeScript, Tailwind | One deployable, typed end to end. |
| Live session state | **Redis** (Upstash) | Atomic ops and sorted sets fit join caps, answer dedupe and leaderboards. |
| Durable data | **MongoDB** (Atlas M0) | A quiz is one document with variably-shaped questions. |
| Push to browsers | Ably (free) | Serverless hosting can't hold sockets; browsers get scoped tokens. |
| Auth | Auth.js (Google, GitHub), guests by nickname | Free, no vendor lock-in. Arrives in phase 2. |
| Hosting | Vercel Hobby | Free, preview deploys. |

Every row sits behind a port interface, so each can be swapped. See [`docs/INTEGRATIONS.md`](docs/INTEGRATIONS.md).

## Run it in 30 seconds (no accounts, no services)

```bash
npm install
cp .env.example .env.local   # defaults are all in-memory
npm run dev
```

With the defaults, state lives in process memory. Good for development and demos.

## Run it against real Redis and MongoDB

```bash
npm run services:up         # local Redis + MongoDB via Docker
# in .env.local: PERSISTENCE=mongo  LIVE_STORE=redis
npm run dev
```

For the cloud setup use an Atlas M0 connection string and an Upstash `rediss://` URL. No code changes are needed.

## Quality gates

```bash
npm run check               # lint + typecheck + tests
REDIS_URL=redis://localhost:6379 npm test   # also runs the contract suite against real Redis
```

The same contract tests run against every `LiveStore` implementation, so a new adapter is trusted only when it passes the shared suite.

## Status

Phase 1 (this commit range): scaffold, domain core, ports and adapters (memory, Redis, MongoDB, Ably), game service, CI, design tokens, landing page.
Next: auth and quiz editor (phase 2), host/lobby/QR (phase 3), live play UI (phase 4). See [`docs/ROADMAP.md`](docs/ROADMAP.md).

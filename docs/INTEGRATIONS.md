# Extending and integrating other technologies

The architecture is built to absorb new technology without touching the game rules. Every integration below is either an adapter for an existing port or a consumer of events that already exist.

## Swap a core technology

| To use... | Implement | Notes |
|---|---|---|
| PostgreSQL / Supabase for quizzes | `QuizRepository`, `ResultsRepository` in `src/adapters/postgres` | Questions as `jsonb` or a child table. Add `PERSISTENCE=postgres` to `env.ts`. |
| Supabase Realtime, Pusher, Socket.IO | `RealtimePublisher` | `issueToken` maps to that vendor's auth. Client subscribes to `session:<code>`. |
| Cloudflare Durable Objects | `LiveStore` | One object per session gives natural atomicity. Pass the shared contract suite. |
| Redis Cluster | `RedisLiveStore` | Keys already use a per-session prefix. Replace the global budget hash with a per-shard approach, since it spans slots. |
| DynamoDB | `QuizRepository` | Single-table design keyed by owner. |

Steps: add the adapter folder, add it to the enum in `src/lib/env.ts`, add one branch in `src/lib/container.ts`, run the contract suite.

## Add capabilities

| Capability | Where it plugs in |
|---|---|
| Question types (true/false, poll, image, free text) | Extend `QuestionType` in `core/types.ts`, add a scorer in `core/scoring.ts`, add a renderer. Mongo needs no migration. |
| AI question generation | New `QuizGenerator` port with a Claude API adapter. A route calls it and saves through `QuizRepository`. |
| Analytics and history | Subscribe to the same events `RealtimePublisher` receives and write them to an event log. Later: ClickHouse or BigQuery, with no change to game code. |
| Event streaming (Kafka, NATS, SQS) | Decorate `RealtimePublisher` with a fan-out that also publishes to the stream. |
| Image uploads | Object storage (Cloudflare R2, S3) behind an `AssetStore` port with signed upload URLs. |
| Rate limiting | Redis counters (`INCR` with expiry) or Upstash Ratelimit on join and answer routes. |
| Observability | OpenTelemetry in route handlers and service methods, Sentry for errors, Vercel Analytics for UX. |
| Public API / webhooks | Add a results-ready webhook emitted from `GameService.finish`. |
| Team workspaces | Add `orgId` to quizzes and an authorization layer. The ownership check is already centralised in `GameService`. |
| Internationalisation | Message catalog in `src/messages`, locale in the route segment. |

## What deliberately stays out
Anything that couples the game rules to a vendor. If a change requires editing `src/core` or `src/services` to name a vendor, the design is being violated.

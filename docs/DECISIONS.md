# Decision log

Short architecture decision records. Each states the choice, the honest trade-off and what would change it.

## 001. Ports and adapters
**Decision:** isolate game rules from every vendor behind interfaces.
**Why:** the stack is deliberately polyglot and free-tier, so vendors may change or hit limits. It also makes the rules testable without infrastructure.
**Cost:** a little indirection and one interface per capability.

## 002. Redis for live session state
**Decision:** Upstash Redis (free: 256 MB, 500K commands/month per Upstash's pricing page).
**Why:** the workload is small, ephemeral, write-heavy and needs atomic check-and-set. Lua scripts make join caps, answer dedupe and "first correct" race-free. Sorted sets are a leaderboard. TTLs remove the need for cleanup jobs. `TIME` gives one authoritative clock.
**Cost:** Redis cannot push to browsers, so it needs a push channel (decision 004). The monthly command quota is a real ceiling: a round costs roughly 3 commands per player plus a few per question.
**Alternatives:** Postgres rows with `SELECT ... FOR UPDATE` (works, heavier per answer); Supabase Realtime Presence; Cloudflare Durable Objects (excellent fit, different platform).

## 003. MongoDB for durable data
**Decision:** MongoDB Atlas M0 for quizzes and results.
**Why:** a quiz is one aggregate (title plus an ordered array of questions whose shape varies by type) that is always read and written whole. New question types need no migration.
**Cost:** no relational integrity or ad-hoc analytics joins. Atlas M0 has connection and throughput limits (check Atlas docs) and no backups.
**Honest note:** Postgres would also be a good fit here and is what I would reach for if reporting across quizzes and users became central. This project uses MongoDB because the data genuinely is document-shaped, and the port makes a Postgres adapter a contained change.

## 004. Hosted pub/sub (Ably) for browser push
**Decision:** the server publishes over REST; browsers subscribe directly with scoped tokens.
**Why:** Vercel serverless functions cannot keep websockets open. Publishing from the server keeps authority server-side. Tokens are subscribe-only and per session.
**Cost:** a third vendor, and free-tier connection and message caps.
**Alternatives:** Pusher, Supabase Realtime, Socket.IO on a small always-on host, SSE (limited by function duration).

## 005. Server-authoritative time and scoring
**Decision:** clients never report time. Elapsed time is measured in Redis between question open and answer arrival.
**Why:** a phone's clock and network latency are untrusted. Everyone is measured by the same clock; latency affects all players alike.
**Cost:** a player on a slow connection is slightly disadvantaged. Mitigated by a fixed grace for lateness, not for ranking.

## 006. Auth.js with guest players
**Decision:** hosts sign in with Google or GitHub; players join as guests with a nickname and a generated id.
**Why:** removes friction for the person scanning a QR code, and keeps hosts accountable for sessions. Free, no vendor lock-in.
**Cost:** guest history is not kept unless they later sign in.

## 007. In-memory defaults
**Decision:** every driver defaults to memory so a reviewer can run the app with zero setup.
**Cost:** memory mode is single-process and not for production. Config validation fails fast if a real driver lacks its connection string.

## 008. Push-first clients with a polling safety net
**Decision:** clients patch state from push events when the event carries enough (lobby count, new question) and otherwise refetch `GET /api/sessions/:code`. They also poll: every 2.5 s without push, every 15 s with it.
**Why:** push can drop (mobile networks, provider outage). The snapshot is derived from the source of truth, so recovering is just another fetch. It also means the app works with `REALTIME=none`.
**Cost:** each snapshot is about 5 Redis commands. At 100 players a round costs roughly 1,500 commands, so the 500K/month free quota allows a few hundred rounds. Direct patching of reveal and end events is on the roadmap to reduce this.

## 009. Hosts authenticate, players are anonymous
**Decision:** only hosts sign in (JWT sessions, no auth database). Players get an httpOnly cookie id.
**Cost:** a player's cookie is a bearer credential for that browser; clearing it loses the seat. Acceptable for a short, low-stakes game, and rejoining by nickname is blocked by design to prevent impersonation.

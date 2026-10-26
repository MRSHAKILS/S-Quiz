import { NextResponse } from "next/server";
import { container } from "@/lib/container";

export const dynamic = "force-dynamic";

/**
 * `GET /api/health`        liveness, touches nothing.
 * `GET /api/health?deep=1` also round-trips the live store and quiz store.
 * The deep check doubles as the keep-alive target: free tiers pause or
 * archive idle databases, and a scheduled ping (see .github/workflows/keepalive.yml)
 * is the only cron this project needs. Game cleanup uses Redis TTLs, not jobs.
 */
export async function GET(req: Request) {
  if (new URL(req.url).searchParams.get("deep") !== "1") {
    return NextResponse.json({ ok: true, service: "squiz" });
  }
  const c = container();
  const started = Date.now();
  try {
    await Promise.all([c.game.ping()]);
    return NextResponse.json({ ok: true, service: "squiz", deep: true, ms: Date.now() - started });
  } catch (err) {
    return NextResponse.json({ ok: false, error: (err as Error).message }, { status: 503 });
  }
}

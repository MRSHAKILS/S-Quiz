import { NextResponse } from "next/server";
import { container } from "@/lib/container";
import { api, optionalUserId, playerId } from "@/lib/http";
import { GameError } from "@/services/game";

/** Subscribe-only realtime credential for one session. `null` means "poll instead". */
export const GET = api(async (_req, { code }) => {
  const c = container();
  const snap = await c.game.snapshot(code!);
  const host = await optionalUserId();
  const pid = await playerId();
  const clientId = host ?? pid;
  if (!clientId) throw new GameError("forbidden", "Join the session first");
  const token = await c.realtime.issueToken(snap.code, clientId, host ? "host" : "player");
  return NextResponse.json({ token }, { headers: { "Cache-Control": "no-store" } });
});

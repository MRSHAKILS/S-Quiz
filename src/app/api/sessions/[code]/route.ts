import { NextResponse } from "next/server";
import { container } from "@/lib/container";
import { api, optionalUserId, playerId } from "@/lib/http";

export const dynamic = "force-dynamic";

export const GET = api(async (_req, { code }) => {
  const snapshot = await container().game.snapshot(code!, { hostId: await optionalUserId(), playerId: await playerId() });
  return NextResponse.json(snapshot, { headers: { "Cache-Control": "no-store" } });
});

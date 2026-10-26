import { NextResponse } from "next/server";
import { z } from "zod";
import { container } from "@/lib/container";
import { api, body, ensurePlayerId } from "@/lib/http";
import { nicknameSchema } from "@/lib/schemas";

export const POST = api(async (req, { code }) => {
  const { nickname } = await body(req, z.object({ nickname: nicknameSchema }));
  const { outcome, playerId } = await container().game.join(code!, nickname, await ensurePlayerId());
  const status = outcome === "joined" || outcome === "rejoined" ? 200 : 409;
  return NextResponse.json({ outcome, playerId: status === 200 ? playerId : undefined }, { status });
});

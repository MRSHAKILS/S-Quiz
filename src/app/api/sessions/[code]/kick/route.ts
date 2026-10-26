import { NextResponse } from "next/server";
import { z } from "zod";
import { container } from "@/lib/container";
import { api, body, requireUserId } from "@/lib/http";

export const POST = api(async (req, { code }) => {
  const hostId = await requireUserId();
  const { playerId } = await body(req, z.object({ playerId: z.string().min(1) }));
  await container().game.kick(code!, hostId, playerId);
  return NextResponse.json({ ok: true });
});

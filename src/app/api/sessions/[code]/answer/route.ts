import { NextResponse } from "next/server";
import { z } from "zod";
import { container } from "@/lib/container";
import { api, body, playerId } from "@/lib/http";
import { GameError } from "@/services/game";

export const POST = api(async (req, { code }) => {
  const pid = await playerId();
  if (!pid) throw new GameError("forbidden", "Join the session first");
  const { optionId } = await body(req, z.object({ optionId: z.string().min(1) }));
  const result = await container().game.submitAnswer(code!, pid, optionId);
  return NextResponse.json({ status: result.status });
});

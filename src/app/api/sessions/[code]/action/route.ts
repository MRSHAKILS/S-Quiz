import { NextResponse } from "next/server";
import { z } from "zod";
import { container } from "@/lib/container";
import { api, body, requireUserId } from "@/lib/http";
import { hostActionSchema } from "@/lib/schemas";
import { InvalidTransitionError } from "@/core/session-machine";
import { GameError } from "@/services/game";

export const POST = api(async (req, { code }) => {
  const hostId = await requireUserId();
  const { action } = await body(req, z.object({ action: hostActionSchema }));
  try {
    const session = await container().game.hostAction(code!, hostId, action);
    return NextResponse.json({ status: session.status });
  } catch (err) {
    if (err instanceof InvalidTransitionError) throw new GameError("locked", err.message);
    throw err;
  }
});

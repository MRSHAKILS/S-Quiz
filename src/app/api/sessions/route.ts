import { NextResponse } from "next/server";
import { z } from "zod";
import { container } from "@/lib/container";
import { api, body, requireUserId } from "@/lib/http";

const schema = z.object({ quizId: z.string().min(1), maxPlayers: z.number().int().min(1).max(500).optional() });

export const POST = api(async (req) => {
  const hostId = await requireUserId();
  const { quizId, maxPlayers } = await body(req, schema);
  const session = await container().game.createSession(hostId, quizId, maxPlayers);
  return NextResponse.json({ code: session.code }, { status: 201 });
});

import { NextResponse } from "next/server";
import { z } from "zod";
import { container } from "@/lib/container";
import { api, body, requireUserId } from "@/lib/http";

export const POST = api(async (req, { code }) => {
  const hostId = await requireUserId();
  const { locked } = await body(req, z.object({ locked: z.boolean() }));
  await container().game.setLocked(code!, hostId, locked);
  return NextResponse.json({ locked });
});

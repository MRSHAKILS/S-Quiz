import { NextResponse } from "next/server";
import { container } from "@/lib/container";
import { api, body, requireUserId } from "@/lib/http";
import { quizInputSchema } from "@/lib/schemas";

export const GET = api(async (_req, { id }) => {
  return NextResponse.json({ quiz: await container().quizzes.get(id!, await requireUserId()) });
});

export const PUT = api(async (req, { id }) => {
  const ownerId = await requireUserId();
  return NextResponse.json({ quiz: await container().quizzes.update(id!, ownerId, await body(req, quizInputSchema)) });
});

export const DELETE = api(async (_req, { id }) => {
  await container().quizzes.remove(id!, await requireUserId());
  return new NextResponse(null, { status: 204 });
});

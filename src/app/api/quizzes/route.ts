import { NextResponse } from "next/server";
import { container } from "@/lib/container";
import { api, body, requireUserId } from "@/lib/http";
import { quizInputSchema } from "@/lib/schemas";

export const GET = api(async () => {
  const quizzes = await container().quizzes.list(await requireUserId());
  return NextResponse.json({ quizzes });
});

export const POST = api(async (req) => {
  const ownerId = await requireUserId();
  const quiz = await container().quizzes.create(ownerId, await body(req, quizInputSchema));
  return NextResponse.json({ quiz }, { status: 201 });
});

import { cookies } from "next/headers";
import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { ZodError, type ZodType } from "zod";
import { auth } from "@/auth";
import { GameError } from "@/services/game";

type Ctx = { params: Promise<Record<string, string>> };
type Handler = (req: Request, params: Record<string, string>) => Promise<Response>;

const STATUS: Record<GameError["code"], number> = {
  not_found: 404, forbidden: 403, locked: 409, bad_request: 400,
};

/** Wraps a route handler with uniform error mapping: one place, no try/catch per route. */
export function api(handler: Handler) {
  return async (req: Request, ctx: Ctx) => {
    try {
      return await handler(req, await ctx.params);
    } catch (err) {
      if (err instanceof GameError) return NextResponse.json({ error: err.message, code: err.code }, { status: STATUS[err.code] });
      if (err instanceof ZodError) {
        return NextResponse.json({ error: err.issues[0]?.message ?? "Invalid input", issues: err.issues }, { status: 400 });
      }
      console.error(err);
      return NextResponse.json({ error: "Something went wrong" }, { status: 500 });
    }
  };
}

export async function body<T>(req: Request, schema: ZodType<T>): Promise<T> {
  const raw = await req.json().catch(() => { throw new GameError("bad_request", "Invalid JSON"); });
  return schema.parse(raw);
}

export async function requireUserId(): Promise<string> {
  const session = await auth();
  if (!session?.user?.id) throw new GameError("forbidden", "Sign in required");
  return session.user.id;
}

export async function optionalUserId(): Promise<string | undefined> {
  return (await auth())?.user?.id;
}

const PLAYER_COOKIE = "sq_pid";

/** Anonymous player identity: an unguessable id in an httpOnly cookie. */
export async function playerId(): Promise<string | undefined> {
  return (await cookies()).get(PLAYER_COOKIE)?.value;
}

export async function ensurePlayerId(): Promise<string> {
  const jar = await cookies();
  const existing = jar.get(PLAYER_COOKIE)?.value;
  if (existing) return existing;
  const id = randomUUID();
  jar.set(PLAYER_COOKIE, id, { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 });
  return id;
}

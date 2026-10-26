import { z } from "zod";

const schema = z.object({
  PERSISTENCE: z.enum(["memory", "mongo"]).default("memory"),
  LIVE_STORE: z.enum(["memory", "redis"]).default("memory"),
  REALTIME: z.enum(["none", "ably"]).default("none"),
  MONGODB_URI: z.string().optional(),
  REDIS_URL: z.string().optional(),
  ABLY_API_KEY: z.string().optional(),
  MAX_PLAYERS_PER_SESSION: z.coerce.number().int().positive().default(100),
  MAX_PLAYERS_GLOBAL: z.coerce.number().int().positive().default(150),
}).superRefine((e, ctx) => {
  const need = (cond: boolean, path: string, why: string) =>
    cond || ctx.addIssue({ code: "custom", path: [path], message: `${path} is required when ${why}` });
  need(e.PERSISTENCE !== "mongo" || !!e.MONGODB_URI, "MONGODB_URI", "PERSISTENCE=mongo");
  need(e.LIVE_STORE !== "redis" || !!e.REDIS_URL, "REDIS_URL", "LIVE_STORE=redis");
  need(e.REALTIME !== "ably" || !!e.ABLY_API_KEY, "ABLY_API_KEY", "REALTIME=ably");
});

export type Env = z.infer<typeof schema>;

/** Fails fast at boot with a readable message instead of at first request. */
export function loadEnv(source: Record<string, string | undefined> = process.env): Env {
  const parsed = schema.safeParse(source);
  if (!parsed.success) {
    throw new Error("Invalid environment:\n" + parsed.error.issues.map((i) => `  - ${i.message}`).join("\n"));
  }
  return parsed.data;
}

import { describe, expect, it } from "vitest";
import { loadEnv } from "@/lib/env";

describe("loadEnv", () => {
  it("defaults to a zero-service configuration", () => {
    expect(loadEnv({})).toMatchObject({ PERSISTENCE: "memory", LIVE_STORE: "memory", REALTIME: "none" });
  });
  it("demands connection strings for the drivers it enables", () => {
    expect(() => loadEnv({ PERSISTENCE: "mongo", LIVE_STORE: "redis", REALTIME: "ably" }))
      .toThrow(/MONGODB_URI[\s\S]*REDIS_URL[\s\S]*ABLY_API_KEY/);
  });
  it("coerces numeric limits", () => {
    expect(loadEnv({ MAX_PLAYERS_GLOBAL: "120" }).MAX_PLAYERS_GLOBAL).toBe(120);
  });
});

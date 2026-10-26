import * as Ably from "ably";
import type { ClientRole, RealtimeEvent, RealtimePublisher } from "@/ports";

/**
 * Ably implementation of the push channel.
 *
 * Why a hosted pub/sub rather than raw websockets: the app runs on
 * serverless hosting, which cannot hold long-lived connections. The server
 * only ever PUBLISHES (over REST); browsers hold the sockets directly with a
 * short-lived, subscribe-only token for ONE session channel, so the API key
 * never leaves the server and a player cannot publish or read other sessions.
 */
export class AblyRealtimePublisher implements RealtimePublisher {
  private rest: Ably.Rest;

  constructor(apiKey: string) {
    this.rest = new Ably.Rest({ key: apiKey });
  }

  static channel(code: string) { return `session:${code}`; }

  async publish(code: string, event: RealtimeEvent) {
    await this.rest.channels.get(AblyRealtimePublisher.channel(code)).publish(event.type, event);
  }

  async issueToken(code: string, clientId: string, _role: ClientRole) {
    return this.rest.auth.createTokenRequest({
      clientId,
      ttl: 2 * 60 * 60 * 1000,
      capability: { [AblyRealtimePublisher.channel(code)]: ["subscribe"] },
    });
  }
}

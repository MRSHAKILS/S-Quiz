import NextAuth, { type NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";
import GitHub from "next-auth/providers/github";
import Google from "next-auth/providers/google";

/**
 * Hosts authenticate; players do not (they get an anonymous cookie id).
 * JWT sessions: no database adapter, so sign-in works in zero-service mode
 * and costs no extra storage. A host's id is `<provider>:<provider account id>`.
 */
const isProd = process.env.NODE_ENV === "production";
const devLogin = process.env.AUTH_DEV_LOGIN === "1" && !isProd;

const providers: NextAuthConfig["providers"] = [];
/** What the login page renders. Tracked explicitly rather than introspected from provider objects. */
export const authProviders: { id: string; name: string }[] = [];

if (process.env.AUTH_GOOGLE_ID) { providers.push(Google); authProviders.push({ id: "google", name: "Google" }); }
if (process.env.AUTH_GITHUB_ID) { providers.push(GitHub); authProviders.push({ id: "github", name: "GitHub" }); }
if (devLogin) {
  authProviders.push({ id: "dev", name: "Dev login" });
  // Local-only shortcut so the app is fully usable without OAuth credentials.
  providers.push(
    Credentials({
      id: "dev",
      name: "Dev login",
      credentials: { name: { label: "Name" } },
      authorize: (c) => {
        const name = String(c?.name ?? "").trim().slice(0, 40);
        return name ? { id: `dev:${name.toLowerCase()}`, name } : null;
      },
    }),
  );
}

export const { handlers, auth, signIn, signOut } = NextAuth({
  providers,
  trustHost: true,
  secret: process.env.AUTH_SECRET ?? (isProd ? undefined : "dev-only-insecure-secret"),
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 14 },
  pages: { signIn: "/login" },
  callbacks: {
    jwt({ token, account, user }) {
      if (account && user) token.uid = user.id?.startsWith("dev:") ? user.id : `${account.provider}:${account.providerAccountId}`;
      return token;
    },
    session({ session, token }) {
      if (typeof token.uid === "string") session.user.id = token.uid;
      return session;
    },
  },
});

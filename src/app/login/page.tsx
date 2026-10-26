import { redirect } from "next/navigation";
import { auth, authProviders, signIn } from "@/auth";
import { Button, Card, inputClass } from "@/components/ui";

export const metadata = { title: "Sign in · SQuiz" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string }> }) {
  const { next } = await searchParams;
  const target = next?.startsWith("/") && !next.startsWith("//") ? next : "/dashboard";
  if ((await auth())?.user) redirect(target);

  const oauth = authProviders.filter((p) => p.id !== "dev");
  const dev = authProviders.some((p) => p.id === "dev");

  return (
    <main className="mx-auto flex min-h-screen max-w-sm flex-col justify-center gap-6 px-4">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Sign in to host</h1>
        <p className="mt-1 text-sm text-muted">Players don&apos;t need an account. Just share the code.</p>
      </div>

      <Card className="flex flex-col gap-3 p-5">
        {oauth.map((p) => (
          <form key={p.id} action={async () => { "use server"; await signIn(p.id, { redirectTo: target }); }}>
            <Button variant="secondary" size="lg" className="w-full" type="submit">Continue with {p.name}</Button>
          </form>
        ))}

        {dev && (
          <form
            className="flex flex-col gap-2"
            action={async (fd: FormData) => { "use server"; await signIn("dev", { name: fd.get("name"), redirectTo: target }); }}
          >
            <label htmlFor="name" className="text-sm font-medium">Local dev login</label>
            <input id="name" name="name" required maxLength={40} placeholder="Your name" className={inputClass} />
            <Button type="submit">Continue</Button>
          </form>
        )}

        {oauth.length === 0 && !dev && (
          <p className="text-sm text-muted">
            No sign-in provider is configured. Set <code className="font-mono">AUTH_GITHUB_ID</code> or{" "}
            <code className="font-mono">AUTH_GOOGLE_ID</code>, or <code className="font-mono">AUTH_DEV_LOGIN=1</code> for local use.
          </p>
        )}
      </Card>
    </main>
  );
}

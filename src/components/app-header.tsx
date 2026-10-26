import Link from "next/link";
import { auth, signOut } from "@/auth";
import { Button } from "./ui";

export async function AppHeader() {
  const session = await auth();
  return (
    <header className="border-b border-line">
      <div className="mx-auto flex h-14 max-w-5xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="text-lg font-bold tracking-tight">SQuiz</Link>
        {session?.user && (
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-muted sm:inline">{session.user.name ?? "Host"}</span>
            <form action={async () => { "use server"; await signOut({ redirectTo: "/" }); }}>
              <Button variant="ghost" type="submit">Sign out</Button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}

import Link from "next/link";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { HostButton } from "@/components/host-button";
import { Card, LinkButton } from "@/components/ui";
import { container } from "@/lib/container";

export const metadata = { title: "Dashboard · SQuiz" };
export const dynamic = "force-dynamic";

export default async function Dashboard() {
  const userId = (await auth())?.user?.id;
  if (!userId) redirect("/login?next=/dashboard");
  const c = container();
  const [quizzes, results] = await Promise.all([c.quizzes.list(userId), c.results.listByHost(userId)]);

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-bold tracking-tight">Your quizzes</h1>
          <LinkButton href="/quiz/new">New quiz</LinkButton>
        </div>

        {quizzes.length === 0 ? (
          <Card className="mt-6 p-8 text-center">
            <p className="font-semibold">No quizzes yet</p>
            <p className="mt-1 text-sm text-muted">Create one with a few multiple-choice questions, then host it.</p>
            <LinkButton href="/quiz/new" className="mt-4">Create your first quiz</LinkButton>
          </Card>
        ) : (
          <ul className="mt-6 flex flex-col gap-3">
            {quizzes.map((q) => (
              <li key={q.id}>
                <Card className="flex items-center justify-between gap-4 p-4">
                  <div className="min-w-0">
                    <p className="truncate font-semibold">{q.title}</p>
                    <p className="text-sm text-muted">{q.questions.length} question{q.questions.length === 1 ? "" : "s"}</p>
                  </div>
                  <div className="flex shrink-0 items-start gap-2">
                    <LinkButton href={`/quiz/${q.id}/edit`} variant="secondary">Edit</LinkButton>
                    <HostButton quizId={q.id} />
                  </div>
                </Card>
              </li>
            ))}
          </ul>
        )}

        <h2 className="mt-12 text-xl font-semibold tracking-tight">Past sessions</h2>
        {results.length === 0 ? (
          <p className="mt-2 text-sm text-muted">Finished sessions appear here with their final ranking.</p>
        ) : (
          <ul className="mt-4 flex flex-col gap-2">
            {results.map((r) => (
              <li key={`${r.code}${r.endedAt}`}>
                <Link href={`/results/${r.code}`} className="flex items-center justify-between rounded-(--radius-control) border border-line bg-surface px-4 py-3 hover:border-ink">
                  <span className="min-w-0 truncate font-medium">{r.quizTitle}</span>
                  <span className="tnum shrink-0 pl-4 text-sm text-muted">
                    {r.ranking.length} players · {new Date(r.endedAt).toLocaleDateString()}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

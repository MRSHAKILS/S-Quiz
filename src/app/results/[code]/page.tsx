import Link from "next/link";
import { notFound } from "next/navigation";
import { Leaderboard, Podium } from "@/components/podium";
import { container } from "@/lib/container";

export const dynamic = "force-dynamic";
export const metadata = { title: "Results · SQuiz" };

export default async function ResultsPage({ params }: { params: Promise<{ code: string }> }) {
  const { code } = await params;
  const result = await container().results.getByCode(code.toUpperCase());
  if (!result) notFound();

  return (
    <main className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
      <p className="text-sm text-muted">Final results · {new Date(result.endedAt).toLocaleDateString()}</p>
      <h1 className="mb-6 text-3xl font-bold tracking-tight">{result.quizTitle}</h1>
      {result.ranking.length === 0 ? <p className="text-muted">Nobody played this session.</p> : (
        <>
          <Podium ranking={result.ranking.slice(0, 3)} />
          <h2 className="mb-1 mt-8 font-semibold">Everyone</h2>
          <Leaderboard entries={result.ranking} />
        </>
      )}
      <Link href="/" className="mt-8 inline-block text-sm font-medium text-accent">Host your own quiz with SQuiz</Link>
    </main>
  );
}

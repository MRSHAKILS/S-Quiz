import Link from "next/link";
import { JoinForm } from "@/components/join-form";

export default function Home() {
  return (
    <div className="mx-auto flex min-h-screen w-full max-w-5xl flex-col px-4 sm:px-6">
      <header className="flex h-16 items-center justify-between">
        <span className="text-lg font-bold tracking-tight">SQuiz</span>
        <Link href="/login" className="text-sm font-medium text-muted hover:text-ink">Sign in</Link>
      </header>

      <main className="grid flex-1 content-center gap-12 py-12 md:grid-cols-2 md:items-center md:gap-20">
        <section>
          <h1 className="text-4xl font-bold tracking-tight text-balance sm:text-5xl">
            Run a live quiz in under a minute.
          </h1>
          <p className="mt-4 max-w-md text-lg text-muted">
            Build the questions, share a link or QR code, and watch the fastest correct answers climb a live leaderboard. Players need nothing but a phone.
          </p>
          <Link
            href="/dashboard"
            className="mt-8 inline-flex h-12 items-center rounded-(--radius-control) border border-line bg-surface px-5 font-semibold hover:border-ink"
          >
            Host a quiz
          </Link>
        </section>

        <section aria-labelledby="join-heading" className="rounded-(--radius-card) border border-line bg-surface p-6 sm:p-8">
          <h2 id="join-heading" className="mb-5 text-xl font-semibold">Playing? Enter your code</h2>
          <JoinForm />
        </section>
      </main>

      <footer className="py-6 text-sm text-muted">Free and open source.</footer>
    </div>
  );
}

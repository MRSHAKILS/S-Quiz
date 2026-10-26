import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { QuizEditor } from "@/components/quiz-editor";
import { container } from "@/lib/container";
import { GameError } from "@/services/game";

export const metadata = { title: "Edit quiz · SQuiz" };
export const dynamic = "force-dynamic";

export default async function EditQuiz({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = (await auth())?.user?.id;
  if (!userId) redirect(`/login?next=/quiz/${id}/edit`);

  const quiz = await container().quizzes.get(id, userId).catch((e) => {
    if (e instanceof GameError) return null;
    throw e;
  });
  if (!quiz) notFound();

  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">Edit quiz</h1>
        <QuizEditor
          initial={{
            id: quiz.id, title: quiz.title,
            questions: quiz.questions.map((q) => ({
              text: q.text, options: q.options.map((o) => o.text),
              correctIndex: q.options.findIndex((o) => o.id === q.correctOptionId),
              timeLimitSec: q.timeLimitSec, points: q.points,
            })),
          }}
        />
      </main>
    </>
  );
}

import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AppHeader } from "@/components/app-header";
import { QuizEditor } from "@/components/quiz-editor";

export const metadata = { title: "New quiz · SQuiz" };

export default async function NewQuiz() {
  if (!(await auth())?.user) redirect("/login?next=/quiz/new");
  return (
    <>
      <AppHeader />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-bold tracking-tight">New quiz</h1>
        <QuizEditor />
      </main>
    </>
  );
}

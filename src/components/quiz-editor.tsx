"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { request } from "@/lib/client";
import { LIMITS, quizInputSchema } from "@/lib/schemas";
import { Button, Card, inputClass } from "./ui";

interface QuestionDraft {
  key: string;
  text: string;
  options: string[];
  correctIndex: number;
  timeLimitSec: number;
  points: number;
}

export interface EditorInitial {
  id?: string;
  title: string;
  questions: Omit<QuestionDraft, "key">[];
}

let seq = 0;
const blank = (): QuestionDraft => ({
  key: `q${++seq}`, text: "", options: ["", ""], correctIndex: 0,
  timeLimitSec: LIMITS.defaultTime, points: LIMITS.defaultPoints,
});
const LETTERS = ["A", "B", "C", "D"];

export function QuizEditor({ initial }: { initial?: EditorInitial }) {
  const router = useRouter();
  const [title, setTitle] = useState(initial?.title ?? "");
  const [questions, setQuestions] = useState<QuestionDraft[]>(
    initial?.questions.map((q) => ({ ...q, key: `q${++seq}` })) ?? [blank()],
  );
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const patch = (key: string, change: Partial<QuestionDraft>) =>
    setQuestions((qs) => qs.map((q) => (q.key === key ? { ...q, ...change } : q)));

  async function save() {
    const payload = {
      title,
      questions: questions.map((q) => ({
        text: q.text, options: q.options.map((text) => ({ text })),
        correctIndex: q.correctIndex, timeLimitSec: q.timeLimitSec, points: q.points,
      })),
    };
    const parsed = quizInputSchema.safeParse(payload);
    if (!parsed.success) {
      const issue = parsed.error.issues[0]!;
      const qi = issue.path[0] === "questions" ? Number(issue.path[1]) + 1 : null;
      setError(qi ? `Question ${qi}: ${issue.message}` : issue.message);
      return;
    }
    setBusy(true); setError(null);
    try {
      if (initial?.id) await request(`/api/quizzes/${initial.id}`, { method: "PUT", body: parsed.data });
      else await request("/api/quizzes", { body: parsed.data });
      router.push("/dashboard");
      router.refresh();
    } catch (e) { setError((e as Error).message); setBusy(false); }
  }

  async function remove() {
    if (!initial?.id || !confirm("Delete this quiz? This can't be undone.")) return;
    setBusy(true);
    try { await request(`/api/quizzes/${initial.id}`, { method: "DELETE" }); router.push("/dashboard"); router.refresh(); }
    catch (e) { setError((e as Error).message); setBusy(false); }
  }

  return (
    <div className="pb-28">
      <div>
        <label htmlFor="title" className="text-sm font-medium">Quiz title</label>
        <input id="title" value={title} onChange={(e) => setTitle(e.target.value)} maxLength={LIMITS.titleMax}
          placeholder="e.g. Friday pub quiz" className={`${inputClass} mt-1 h-12 text-lg`} />
      </div>

      <ol className="mt-6 flex flex-col gap-4">
        {questions.map((q, qi) => (
          <li key={q.key}>
            <Card className="p-4 sm:p-5">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-muted">Question {qi + 1}</h2>
                <div className="flex gap-1">
                  <Button variant="ghost" aria-label={`Duplicate question ${qi + 1}`}
                    onClick={() => setQuestions((qs) => qs.flatMap((x) => x.key === q.key ? [x, { ...x, key: `q${++seq}` }] : [x]))}>Duplicate</Button>
                  <Button variant="ghost" disabled={questions.length === 1} aria-label={`Remove question ${qi + 1}`}
                    onClick={() => setQuestions((qs) => qs.filter((x) => x.key !== q.key))}>Remove</Button>
                </div>
              </div>

              <label htmlFor={`${q.key}-text`} className="sr-only">Question {qi + 1} text</label>
              <textarea id={`${q.key}-text`} value={q.text} rows={2} maxLength={LIMITS.questionMax}
                onChange={(e) => patch(q.key, { text: e.target.value })} placeholder="Ask something…"
                className={`${inputClass} mt-2 h-auto py-2 text-lg`} />

              <fieldset className="mt-4">
                <legend className="text-sm font-medium">Answers <span className="font-normal text-muted">(select the correct one)</span></legend>
                <ul className="mt-2 flex flex-col gap-2">
                  {q.options.map((opt, oi) => (
                    <li key={oi} className="flex items-center gap-2">
                      <input type="radio" name={`${q.key}-correct`} checked={q.correctIndex === oi}
                        onChange={() => patch(q.key, { correctIndex: oi })} aria-label={`Option ${LETTERS[oi]} is correct`}
                        className="size-5 accent-(--color-correct)" />
                      <span aria-hidden className="grid size-8 shrink-0 place-items-center rounded-md border border-line text-sm font-semibold">{LETTERS[oi]}</span>
                      <input value={opt} maxLength={LIMITS.optionMax} aria-label={`Option ${LETTERS[oi]} text`}
                        onChange={(e) => patch(q.key, { options: q.options.map((o, i) => (i === oi ? e.target.value : o)) })}
                        placeholder={`Option ${LETTERS[oi]}`} className={inputClass} />
                      <Button variant="ghost" aria-label={`Remove option ${LETTERS[oi]}`} disabled={q.options.length <= LIMITS.minOptions}
                        onClick={() => patch(q.key, {
                          options: q.options.filter((_, i) => i !== oi),
                          correctIndex: q.correctIndex === oi ? 0 : q.correctIndex > oi ? q.correctIndex - 1 : q.correctIndex,
                        })}>✕</Button>
                    </li>
                  ))}
                </ul>
                {q.options.length < LIMITS.maxOptions && (
                  <Button variant="ghost" className="mt-1" onClick={() => patch(q.key, { options: [...q.options, ""] })}>+ Add option</Button>
                )}
              </fieldset>

              <div className="mt-4 grid grid-cols-2 gap-3 sm:max-w-sm">
                <label className="text-sm font-medium">Time (seconds)
                  <input type="number" min={LIMITS.minTime} max={LIMITS.maxTime} value={q.timeLimitSec} className={`${inputClass} tnum mt-1`}
                    onChange={(e) => patch(q.key, { timeLimitSec: Number(e.target.value) })} />
                </label>
                <label className="text-sm font-medium">Points
                  <input type="number" min={LIMITS.minPoints} max={LIMITS.maxPoints} step={100} value={q.points} className={`${inputClass} tnum mt-1`}
                    onChange={(e) => patch(q.key, { points: Number(e.target.value) })} />
                </label>
              </div>
            </Card>
          </li>
        ))}
      </ol>

      <Button variant="secondary" className="mt-4" disabled={questions.length >= LIMITS.maxQuestions}
        onClick={() => setQuestions((qs) => [...qs, blank()])}>+ Add question</Button>

      <div className="fixed inset-x-0 bottom-0 border-t border-line bg-paper/95 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <p role="alert" className="min-w-0 truncate text-sm text-wrong">{error}</p>
          <div className="flex shrink-0 gap-2">
            {initial?.id && <Button variant="danger" disabled={busy} onClick={remove}>Delete</Button>}
            <Button disabled={busy} onClick={save}>{busy ? "Saving…" : "Save quiz"}</Button>
          </div>
        </div>
      </div>
    </div>
  );
}

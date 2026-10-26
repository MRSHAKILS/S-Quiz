import { z } from "zod";

export const LIMITS = {
  titleMax: 80, questionMax: 200, optionMax: 100,
  minOptions: 2, maxOptions: 4, maxQuestions: 50,
  minTime: 5, maxTime: 60, defaultTime: 20,
  minPoints: 100, maxPoints: 2000, defaultPoints: 1000,
} as const;

const trimmed = (max: number) => z.string().trim().min(1, "Required").max(max, `Max ${max} characters`);

export const questionSchema = z.object({
  text: trimmed(LIMITS.questionMax),
  options: z.array(z.object({ text: trimmed(LIMITS.optionMax) })).min(LIMITS.minOptions).max(LIMITS.maxOptions),
  correctIndex: z.number().int().min(0),
  timeLimitSec: z.number().int().min(LIMITS.minTime).max(LIMITS.maxTime),
  points: z.number().int().min(LIMITS.minPoints).max(LIMITS.maxPoints),
}).refine((q) => q.correctIndex < q.options.length, { path: ["correctIndex"], message: "Pick the correct option" });

/** Wire format for create/update. Ids are generated server-side. */
export const quizInputSchema = z.object({
  title: trimmed(LIMITS.titleMax),
  questions: z.array(questionSchema).min(1, "Add at least one question").max(LIMITS.maxQuestions),
});
export type QuizInput = z.infer<typeof quizInputSchema>;

export const nicknameSchema = z.string().trim().min(1, "Enter a nickname").max(20, "Max 20 characters");
export const codeSchema = z.string().trim().toUpperCase().regex(/^[A-HJ-NP-Z2-9]{6}$/, "Invalid code");
export const hostActionSchema = z.enum(["start", "reveal", "next", "end"]);

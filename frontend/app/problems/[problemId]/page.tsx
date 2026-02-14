'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

type Problem = {
  id: string;
  subject_id: string;
  topic_id: string | null;
  type: "single_choice" | "multiple_choice" | string;
  difficulty: "easy" | "medium" | "hard" | string;
  title: string;
  statement: string;
  explanation: string | null;
  time_limit_sec: number;
  points: number;
  choices: Array<{
    id: string;
    choice_text: string;
    is_correct: boolean;
    order_no: number;
  }>;
  tags: Array<{
    id: string;
    name: string;
  }>;
};

type ProfileResponse = {
  full_name: string | null;
  [key: string]: unknown;
};

type SubmissionResult = {
  submission_id: string;
  problem_id: string;
  status: "pending" | "graded" | "needs_review";
  is_correct: boolean | null;
  score: number | null;
  created_at: string;
  message: string;
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Легкая",
  medium: "Средняя",
  hard: "Сложная",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  hard: "bg-rose-50 text-rose-700",
};

async function submitViaProxy(
  accessToken: string,
  payload: unknown,
): Promise<SubmissionResult> {
  const response = await fetch("/api/submissions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
      Authorization: `Bearer ${accessToken}`,
    },
    body: JSON.stringify(payload),
  });

  const contentType = response.headers.get("content-type") ?? "";
  const isJson = contentType.includes("application/json");
  const body = isJson ? await response.json().catch(() => null) : null;

  if (!response.ok) {
    const message =
      (body && (body.message ?? body.detail)) ??
      `Submission failed with status ${response.status}`;
    throw new Error(message);
  }

  return body as SubmissionResult;
}

export default function ProblemDetailsPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);
  const [answerNumeric, setAnswerNumeric] = useState("");
  const [answerText, setAnswerText] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] = useState<SubmissionResult | null>(
    null,
  );
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!accessToken || !user) return;

    (async () => {
      try {
        const p = await apiGet<ProfileResponse>("/me/profile", accessToken);
        setProfile(p);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          router.replace("/onboarding");
          return;
        }
        setLoadError("Не удалось загрузить профиль.");
      }
    })();
  }, [accessToken, user, router]);

  useEffect(() => {
    if (!accessToken || !profile || !problemId) return;

    (async () => {
      try {
        const data = await apiGet<Problem>(`/problems/${problemId}`, accessToken);
        setProblem(data);
        setSelectedChoiceIds([]);
        setAnswerNumeric("");
        setAnswerText("");
        setSubmitError(null);
        setSubmissionResult(null);
      } catch {
        setLoadError("Не удалось загрузить задачу.");
      }
    })();
  }, [accessToken, profile, problemId]);

  const isChoiceType =
    problem?.type === "single_choice" || problem?.type === "multiple_choice";
  const isNumericType = problem?.type === "numeric";
  const isTextType =
    problem?.type === "short_text" ||
    (problem != null && !isChoiceType && !isNumericType);

  const canSubmit =
    problem != null &&
    (isChoiceType
      ? selectedChoiceIds.length > 0
      : isNumericType
        ? answerNumeric.trim().length > 0
        : answerText.trim().length > 0);

  const toggleChoice = (choiceId: string) => {
    if (!problem) return;
    if (problem.type === "single_choice") {
      setSelectedChoiceIds([choiceId]);
      return;
    }
    setSelectedChoiceIds((prev) =>
      prev.includes(choiceId)
        ? prev.filter((id) => id !== choiceId)
        : [...prev, choiceId],
    );
  };

  const handleSubmit = async () => {
    if (!problem || !accessToken || !canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmissionResult(null);

    try {
      const answer: {
        choice_ids?: string[];
        answer_numeric?: string;
        answer_text?: string;
      } = {};

      if (isChoiceType) {
        answer.choice_ids = selectedChoiceIds;
      } else if (isNumericType) {
        answer.answer_numeric = answerNumeric.trim();
      } else {
        answer.answer_text = answerText.trim();
      }

      const result = await submitViaProxy(accessToken, {
        problem_id: problem.id,
        answer,
      });
      setSubmissionResult(result);
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Не удалось отправить решение. Попробуйте ещё раз.",
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  const userName = profile.full_name ?? user.email.split("@")[0];
  const userRole = user.role ?? "student";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <button
          type="button"
          onClick={() => router.push("/problems")}
          className="mb-4 text-sm font-medium text-blue-600 hover:text-blue-700"
        >
          Назад к задачам
        </button>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {loadError}
          </div>
        )}

        {!problem && !loadError ? (
          <div className="rounded-2xl border border-gray-100 bg-white p-6">
            <div className="mb-3 h-6 w-60 animate-pulse rounded bg-gray-200" />
            <div className="h-4 w-full animate-pulse rounded bg-gray-100" />
          </div>
        ) : (
          problem && (
            <article className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    DIFFICULTY_COLORS[problem.difficulty] ??
                    "bg-slate-100 text-slate-700"
                  }`}
                >
                  {DIFFICULTY_LABELS[problem.difficulty] ?? problem.difficulty}
                </span>
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                  {problem.points} балл.
                </span>
              </div>
              <h1 className="text-2xl font-extrabold text-slate-900">
                {problem.title}
              </h1>
              <p className="mt-4 whitespace-pre-wrap text-sm text-slate-700">
                {problem.statement}
              </p>

              {(problem.type === "single_choice" ||
                problem.type === "multiple_choice") &&
                problem.choices.length > 0 && (
                  <div className="mt-6 space-y-2">
                    {problem.choices.map((choice) => (
                      <label
                        key={choice.id}
                        className="flex items-center gap-3 rounded-lg border border-gray-200 bg-slate-50 px-4 py-3 text-sm text-slate-700"
                      >
                        <input
                          type={
                            problem.type === "single_choice" ? "radio" : "checkbox"
                          }
                          name={`problem-${problem.id}`}
                          checked={selectedChoiceIds.includes(choice.id)}
                          onChange={() => toggleChoice(choice.id)}
                          className="h-4 w-4 text-blue-600"
                        />
                        {choice.choice_text}
                      </label>
                    ))}
                  </div>
                )}

              {problem.type === "numeric" && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-slate-700">
                    Ваш числовой ответ
                  </label>
                  <input
                    type="number"
                    value={answerNumeric}
                    onChange={(e) => setAnswerNumeric(e.target.value)}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Введите число"
                  />
                </div>
              )}

              {isTextType && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-slate-700">
                    Ваш ответ
                  </label>
                  <textarea
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    rows={4}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                    placeholder="Введите ваш ответ"
                  />
                </div>
              )}

              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit || isSubmitting}
                  className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {isSubmitting ? "Отправляем..." : "Отправить решение"}
                </button>
              </div>

              {submitError && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {submitError}
                </p>
              )}

              {submissionResult && (
                <div className="mt-4 rounded-xl border border-gray-200 bg-slate-50 p-4 text-sm">
                  <p className="font-semibold text-slate-900">
                    Результат:{" "}
                    {submissionResult.status === "graded"
                      ? submissionResult.is_correct
                        ? "Верно"
                        : "Неверно"
                      : "На проверке"}
                  </p>
                  {submissionResult.score != null && (
                    <p className="mt-1 text-slate-600">
                      Баллы: {submissionResult.score}
                    </p>
                  )}
                  <p className="mt-1 text-slate-500">{submissionResult.message}</p>
                </div>
              )}

              {problem.explanation && (
                <section className="mt-8 border-t border-gray-100 pt-5">
                  <h2 className="text-sm font-semibold text-slate-900">
                    Объяснение
                  </h2>
                  <p className="mt-2 whitespace-pre-wrap text-sm text-slate-600">
                    {problem.explanation}
                  </p>
                </section>
              )}
            </article>
          )
        )}
      </main>
    </div>
  );
}

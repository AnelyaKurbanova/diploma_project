'use client';

import { useEffect, useState, useCallback, useMemo } from "react";
import { useParams, useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

type Problem = {
  id: string;
  subject_id: string;
  topic_id: string | null;
  type: "single_choice" | "multiple_choice" | "numeric" | "short_text" | string;
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
  images: Array<{
    id: string;
    url: string;
    order_no: number;
    alt_text: string | null;
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

type SubmissionProgress = {
  has_attempt: boolean;
  last_status: "pending" | "graded" | "needs_review" | null;
  last_is_correct: boolean | null;
  last_score: number | null;
  last_answer_choice_ids: string[] | null;
  last_answer_text: string | null;
  last_created_at: string | null;
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
      `Ошибка при отправке решения (статус ${response.status})`;
    throw new Error(message);
  }

  return body as SubmissionResult;
}

function fireConfetti() {
  import("canvas-confetti").then((mod) => {
    const confetti = mod.default;
    const end = Date.now() + 1500;

    const frame = () => {
      confetti({
        particleCount: 3,
        angle: 60,
        spread: 55,
        origin: { x: 0, y: 0.7 },
        colors: ["#10b981", "#34d399", "#6ee7b7"],
      });
      confetti({
        particleCount: 3,
        angle: 120,
        spread: 55,
        origin: { x: 1, y: 0.7 },
        colors: ["#10b981", "#34d399", "#6ee7b7"],
      });
      if (Date.now() < end) requestAnimationFrame(frame);
    };
    frame();
  });
}

export default function ProblemDetailsPage() {
  const { problemId } = useParams<{ problemId: string }>();
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [problem, setProblem] = useState<Problem | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedChoiceIds, setSelectedChoiceIds] = useState<string[]>([]);
  const [answerText, setAnswerText] = useState("");
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [submissionResult, setSubmissionResult] =
    useState<SubmissionResult | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [resultAnimation, setResultAnimation] = useState<
    "correct" | "incorrect" | null
  >(null);
  const [initialProgressLoaded, setInitialProgressLoaded] = useState(false);
  const [imageLightboxIndex, setImageLightboxIndex] = useState<number | null>(null);
  const [navProblemIds, setNavProblemIds] = useState<string[] | null>(null);
  const [navSolvedIds, setNavSolvedIds] = useState<string[]>([]);

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
        setAnswerText("");
        setSubmitError(null);
        setSubmissionResult(null);
        setResultAnimation(null);
      } catch {
        setLoadError("Не удалось загрузить задачу.");
      }
    })();
  }, [accessToken, profile, problemId]);

  // Load last submission progress for this problem to restore state
  useEffect(() => {
    if (!accessToken || !problem || initialProgressLoaded) return;

    (async () => {
      try {
        const progress = await apiGet<SubmissionProgress>(
          `/submissions/last/${problem.id}`,
          accessToken,
        );
        setInitialProgressLoaded(true);
        if (!progress.has_attempt) return;

        if (
          (problem.type === "single_choice" ||
            problem.type === "multiple_choice") &&
          progress.last_answer_choice_ids
        ) {
          setSelectedChoiceIds(progress.last_answer_choice_ids);
        } else if (progress.last_answer_text) {
          setAnswerText(progress.last_answer_text);
        }

        if (progress.last_status) {
          const result: SubmissionResult = {
            submission_id: "last",
            problem_id: problem.id,
            status: progress.last_status,
            is_correct: progress.last_is_correct,
            score: progress.last_score,
            created_at:
              progress.last_created_at ??
              new Date().toISOString(),
            message: "Результат последней попытки.",
          };
          setSubmissionResult(result);
          if (progress.last_status === "graded") {
            if (progress.last_is_correct) {
              setResultAnimation("correct");
            } else if (progress.last_is_correct === false) {
              setResultAnimation("incorrect");
            }
          }
        }
      } catch {
        // ignore
      }
    })();
  }, [accessToken, problem, initialProgressLoaded]);

  useEffect(() => {
    if (imageLightboxIndex === null) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImageLightboxIndex(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [imageLightboxIndex]);

  useEffect(() => {
    if (!problemId || typeof window === "undefined") return;
    try {
      const raw = window.sessionStorage.getItem("problems_nav");
      if (raw) {
        const parsed = JSON.parse(raw) as {
          ids: string[];
          filter?: string;
          solvedIds?: string[];
        };
        const { ids, solvedIds = [] } = parsed;
        if (Array.isArray(ids) && ids.length > 0 && ids.includes(problemId)) {
          setNavProblemIds(ids);
          setNavSolvedIds(Array.isArray(solvedIds) ? solvedIds : []);
          return;
        }
      }
    } catch {
      // ignore
    }
    if (!accessToken) return;
    (async () => {
      try {
        const list = await apiGet<Array<{ id: string }>>("/problems", accessToken);
        const ids = list.map((p) => p.id);
        if (ids.length === 0) return;
        setNavProblemIds(ids);
        const res = await apiGet<{
          items: Array<SubmissionProgress & { problem_id: string }>;
        }>(
          `/submissions/last?problem_ids=${encodeURIComponent(ids.join(","))}`,
          accessToken,
        );
        const solved = (res.items ?? [])
          .filter(
            (i) =>
              i.last_status === "graded" && i.last_is_correct === true,
          )
          .map((i) => i.problem_id);
        setNavSolvedIds(solved);
      } catch {
        setNavSolvedIds([]);
      }
    })();
  }, [problemId, accessToken]);

  const solvedSet = useMemo(() => {
    const set = new Set(navSolvedIds);
    if (
      problemId &&
      submissionResult?.status === "graded" &&
      submissionResult?.is_correct
    ) {
      set.add(problemId);
    }
    return set;
  }, [navSolvedIds, problemId, submissionResult?.status, submissionResult?.is_correct]);

  const unsolvedOrdered =
    navProblemIds?.filter((id) => !solvedSet.has(id)) ?? [];
  const navIndex = problemId ? unsolvedOrdered.indexOf(problemId) : -1;
  const prevProblemId =
    navIndex > 0 ? unsolvedOrdered[navIndex - 1]! : null;
  const nextProblemId =
    navIndex >= 0 && navIndex < unsolvedOrdered.length - 1
      ? unsolvedOrdered[navIndex + 1]!
      : null;

  const isChoiceType =
    problem?.type === "single_choice" || problem?.type === "multiple_choice";
  const isTextType = problem != null && !isChoiceType;

  const canSubmit =
    problem != null &&
    !isSubmitting &&
    !(
      submissionResult &&
      submissionResult.status === "graded" &&
      submissionResult.is_correct
    ) &&
    (isChoiceType
      ? selectedChoiceIds.length > 0
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

  const handleSubmit = useCallback(async () => {
    if (!problem || !accessToken || !canSubmit) return;

    setIsSubmitting(true);
    setSubmitError(null);
    setSubmissionResult(null);
    setResultAnimation(null);

    try {
      const answer: Record<string, unknown> = {};

      if (isChoiceType) {
        answer.choice_ids = selectedChoiceIds;
      } else {
        answer.answer_text = answerText.trim();
      }

      const result = await submitViaProxy(accessToken, {
        problem_id: problem.id,
        answer,
      });

      setSubmissionResult(result);

      if (result.status === "graded") {
        if (result.is_correct) {
          setResultAnimation("correct");
          fireConfetti();
        } else {
          setResultAnimation("incorrect");
        }
      }
    } catch (err) {
      setSubmitError(
        err instanceof Error
          ? err.message
          : "Не удалось отправить решение. Попробуйте ещё раз.",
      );
    } finally {
      setIsSubmitting(false);
    }
  }, [problem, accessToken, canSubmit, isChoiceType, selectedChoiceIds, answerText]);

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

      {/* Full-screen overlay during submission check */}
      {isSubmitting && (
        <div className="animate-overlay-in fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm">
          <div className="animate-spinner-card-in flex flex-col items-center rounded-2xl bg-white px-10 py-8 shadow-2xl">
            <div className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-blue-200 border-t-blue-600" />
            <p className="text-sm font-semibold text-slate-700">
              Проверяем решение...
            </p>
            <p className="mt-1 text-xs text-slate-400">
              Пожалуйста, подождите
            </p>
          </div>
        </div>
      )}

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex flex-wrap items-center gap-3">
          <button
            type="button"
            onClick={() => router.push("/problems")}
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 shadow-sm transition-all duration-200 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 hover:shadow"
          >
            Назад к задачам
          </button>
          {(prevProblemId != null || nextProblemId != null) && (
            <span className="h-6 w-px bg-slate-200" aria-hidden />
          )}
          {prevProblemId != null && (
            <button
              type="button"
              onClick={() => router.push(`/problems/${prevProblemId}`)}
              className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md active:scale-[0.98]"
            >
              <svg
                className="h-4 w-4 transition-transform duration-200 group-hover:-translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
              Предыдущая
            </button>
          )}
          {nextProblemId != null && (
            <button
              type="button"
              onClick={() => router.push(`/problems/${nextProblemId}`)}
              className="group flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-sm transition-all duration-200 hover:scale-[1.02] hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700 hover:shadow-md active:scale-[0.98]"
            >
              Следующая
              <svg
                className="h-4 w-4 transition-transform duration-200 group-hover:translate-x-0.5"
                fill="none"
                viewBox="0 0 24 24"
                strokeWidth={2}
                stroke="currentColor"
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          )}
        </div>

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

              {/* Problem images */}
              {problem.images && problem.images.length > 0 && (
                <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                  {[...problem.images]
                    .sort((a, b) => a.order_no - b.order_no)
                    .map((img, idx) => (
                      <button
                        key={img.id}
                        type="button"
                        onClick={() => setImageLightboxIndex(idx)}
                        className="group relative w-full overflow-hidden rounded-xl border border-gray-200 bg-slate-100 shadow-sm transition hover:border-blue-300 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
                      >
                        <img
                          src={img.url}
                          alt={img.alt_text || `Изображение ${img.order_no + 1}`}
                          className="h-48 w-full object-contain sm:h-56"
                        />
                        <span className="absolute inset-0 flex items-center justify-center rounded-xl bg-black/0 transition group-hover:bg-black/10">
                          <span className="rounded-full bg-white/90 p-2 opacity-0 shadow transition group-hover:opacity-100">
                            <svg className="h-5 w-5 text-slate-700" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
                            </svg>
                          </span>
                        </span>
                      </button>
                    ))}
                </div>
              )}

              {/* Fullscreen image lightbox */}
              {imageLightboxIndex !== null &&
                problem.images &&
                problem.images.length > 0 && (() => {
                  const sorted = [...problem.images].sort((a, b) => a.order_no - b.order_no);
                  const current = sorted[imageLightboxIndex] ?? sorted[0];
                  const goPrev = () =>
                    setImageLightboxIndex((i) => (i === null ? null : i === 0 ? sorted.length - 1 : i - 1));
                  const goNext = () =>
                    setImageLightboxIndex((i) => (i === null ? null : i === sorted.length - 1 ? 0 : i + 1));
                  return (
                    <div
                      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm"
                      role="dialog"
                      aria-modal="true"
                      aria-label="Изображение в полном размере"
                      onClick={() => setImageLightboxIndex(null)}
                    >
                      <button
                        type="button"
                        onClick={() => setImageLightboxIndex(null)}
                        className="absolute right-4 top-4 z-10 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
                        aria-label="Закрыть"
                      >
                        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                      </button>
                      {sorted.length > 1 && (
                        <>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goPrev(); }}
                            className="absolute left-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
                            aria-label="Предыдущее"
                          >
                            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
                            </svg>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); goNext(); }}
                            className="absolute right-4 top-1/2 z-10 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20 focus:outline-none focus:ring-2 focus:ring-white"
                            aria-label="Следующее"
                          >
                            <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                            </svg>
                          </button>
                        </>
                      )}
                      <div
                        className="max-h-[90vh] max-w-[90vw] px-4"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <img
                          src={current.url}
                          alt={current.alt_text || `Изображение`}
                          className="max-h-[90vh] max-w-full object-contain"
                        />
                      </div>
                      <p className="absolute bottom-4 left-1/2 -translate-x-1/2 text-sm text-white/70">
                        {sorted.length > 1 ? `${imageLightboxIndex + 1} / ${sorted.length}` : "Клик вне изображения — закрыть"}
                      </p>
                    </div>
                  );
                })()}

              {/* Choice inputs (single / multiple) */}
              {(problem.type === "single_choice" ||
                problem.type === "multiple_choice") &&
                problem.choices.length > 0 && (
                  <div className="mt-6 space-y-2">
                    {problem.choices.map((choice) => (
                      <label
                        key={choice.id}
                        className={`flex cursor-pointer items-center gap-3 rounded-lg border px-4 py-3 text-sm transition-colors ${
                          selectedChoiceIds.includes(choice.id)
                            ? "border-blue-300 bg-blue-50 text-blue-800"
                            : "border-gray-200 bg-slate-50 text-slate-700 hover:border-gray-300"
                        } ${isSubmitting ? "pointer-events-none opacity-60" : ""}`}
                      >
                        <input
                          type={
                            problem.type === "single_choice"
                              ? "radio"
                              : "checkbox"
                          }
                          name={`problem-${problem.id}`}
                          checked={selectedChoiceIds.includes(choice.id)}
                          onChange={() => toggleChoice(choice.id)}
                          disabled={isSubmitting}
                          className="h-4 w-4 text-blue-600"
                        />
                        {choice.choice_text}
                      </label>
                    ))}
                  </div>
                )}

              {/* Unified text input for numeric + short_text */}
              {isTextType && (
                <div className="mt-6">
                  <label className="block text-sm font-medium text-slate-700">
                    Ваш ответ
                  </label>
                  <input
                    type="text"
                    value={answerText}
                    onChange={(e) => setAnswerText(e.target.value)}
                    disabled={isSubmitting}
                    className="mt-2 w-full rounded-lg border border-gray-300 bg-white px-4 py-3 text-sm text-slate-900 transition-colors focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 disabled:cursor-not-allowed disabled:opacity-60"
                    placeholder={
                      problem.type === "numeric"
                        ? "Введите ответ (число, дробь, с единицами и т.д.)"
                        : "Введите ваш ответ"
                    }
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && canSubmit) {
                        handleSubmit();
                      }
                    }}
                  />
                </div>
              )}

              {/* Submit button */}
              <div className="mt-6">
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 hover:shadow-md active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
                >
                  Отправить решение
                </button>
              </div>

              {/* Error message */}
              {submitError && (
                <p className="mt-3 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
                  {submitError}
                </p>
              )}

              {/* Result banner with animations */}
              {submissionResult && (
                <div
                  className={`mt-5 animate-slide-up-fade rounded-xl border p-5 text-sm ${
                    resultAnimation === "correct"
                      ? "animate-success-pulse border-emerald-200 bg-emerald-50"
                      : resultAnimation === "incorrect"
                        ? "border-rose-200 bg-rose-50"
                        : "border-gray-200 bg-slate-50"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {resultAnimation === "correct" && (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-emerald-100">
                        <svg
                          className="h-5 w-5 text-emerald-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M4.5 12.75l6 6 9-13.5"
                          />
                        </svg>
                      </div>
                    )}
                    {resultAnimation === "incorrect" && (
                      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-rose-100">
                        <svg
                          className="h-5 w-5 text-rose-600"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2.5}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="M6 18L18 6M6 6l12 12"
                          />
                        </svg>
                      </div>
                    )}
                    <div>
                      <p
                        className={`text-base font-bold ${
                          resultAnimation === "correct"
                            ? "text-emerald-700"
                            : resultAnimation === "incorrect"
                              ? "text-rose-700"
                              : "text-slate-900"
                        }`}
                      >
                        {submissionResult.status === "graded"
                          ? submissionResult.is_correct
                            ? "Верно! Отличная работа!"
                            : "Неверно. Попробуйте ещё раз."
                          : "На проверке"}
                      </p>
                      {submissionResult.score != null && (
                        <p className="mt-0.5 text-slate-500">
                          Баллы: {submissionResult.score} из {problem.points}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Shake animation on the answer area when incorrect */}
              {resultAnimation === "incorrect" && isTextType && (
                <style>{`
                  input[type="text"] {
                    animation: shake 0.6s ease-in-out;
                  }
                `}</style>
              )}

              {problem.explanation && submissionResult && (
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

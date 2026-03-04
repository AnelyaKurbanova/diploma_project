'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ProblemContent } from "@/components/ui/problem-content";

type Problem = {
  id: string;
  subject_id: string;
  topic_id: string | null;
  type: string;
  difficulty: "easy" | "medium" | "hard";
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
  avatar_url?: string | null;
  [key: string]: unknown;
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

export default function ProblemsPage() {
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [loadError, setLoadError] = useState<string | null>(null);
   const [progressByProblem, setProgressByProblem] = useState<Record<string, SubmissionProgress>>({});

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
    if (!accessToken || !profile) return;

    (async () => {
      try {
        const data = await apiGet<Problem[]>("/problems", accessToken);
        setProblems(data);
      } catch {
        setLoadError("Не удалось загрузить список задач.");
      }
    })();
  }, [accessToken, profile]);

  useEffect(() => {
    if (!accessToken || !profile) return;
    if (problems.length === 0) return;

    const ids = problems.map((p) => p.id).join(",");
    if (!ids) return;

    (async () => {
      try {
        const res = await apiGet<{ items: Array<SubmissionProgress & { problem_id: string }> }>(
          `/submissions/last?problem_ids=${encodeURIComponent(ids)}`,
          accessToken,
        );
        const map: Record<string, SubmissionProgress> = {};
        for (const item of res.items ?? []) {
          const { problem_id, ...rest } = item;
          map[problem_id] = rest;
        }
        setProgressByProblem(map);
      } catch {
      }
    })();
  }, [accessToken, profile, problems]);

  const filteredProblems = useMemo(() => {
    if (selectedDifficulty === "all") return problems;
    return problems.filter((p) => p.difficulty === selectedDifficulty);
  }, [problems, selectedDifficulty]);

  useEffect(() => {
    if (typeof window === "undefined" || filteredProblems.length === 0) return;
    const solvedIds = filteredProblems
      .filter(
        (p) =>
          progressByProblem[p.id]?.last_status === "graded" &&
          progressByProblem[p.id]?.last_is_correct === true,
      )
      .map((p) => p.id);
    try {
      window.sessionStorage.setItem(
        "problems_nav",
        JSON.stringify({
          ids: filteredProblems.map((p) => p.id),
          filter: selectedDifficulty,
          solvedIds,
        }),
      );
    } catch {
      // ignore
    }
  }, [filteredProblems, selectedDifficulty, progressByProblem]);

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
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={profile.avatar_url ?? null} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-4 animate-page-in">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">Все задачи</h1>
            <p className="mt-1 text-sm text-slate-500">
              Практикуйтесь на задачах разной сложности
            </p>
          </div>
          <div className="rounded-xl bg-white p-1 shadow-sm animate-page-in" style={{ animationDelay: "0.06s" }}>
            {["all", "easy", "medium", "hard"].map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                onClick={() => setSelectedDifficulty(difficulty)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
                  selectedDifficulty === difficulty
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {difficulty === "all"
                  ? "Все"
                  : (DIFFICULTY_LABELS[difficulty] ?? difficulty)}
              </button>
            ))}
          </div>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {loadError}
          </div>
        )}

        {filteredProblems.length === 0 && !loadError ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-slate-400">
            Задачи пока не добавлены
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredProblems.map((problem, idx) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.id}`}
                className="block animate-page-in rounded-2xl border border-gray-100 bg-white p-5 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-blue-100 active:scale-[0.99]"
                style={{ animationDelay: `${Math.min(idx * 0.04, 0.3)}s` }}
              >
                <div className="mb-2 flex items-center gap-2">
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
                  {progressByProblem[problem.id]?.has_attempt &&
                    progressByProblem[problem.id]?.last_status === "graded" && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                          progressByProblem[problem.id]?.last_is_correct
                            ? "bg-emerald-50 text-emerald-700"
                            : "bg-rose-50 text-rose-700"
                        }`}
                      >
                        {progressByProblem[problem.id]?.last_is_correct
                          ? "Решена"
                          : "Пока неверно"}
                      </span>
                    )}
                </div>
                <h2 className="text-base font-semibold text-slate-900">
                  <ProblemContent body={problem.title} variant="inline" />
                </h2>
                <ProblemContent
                  body={problem.statement}
                  className="mt-2 line-clamp-2 text-sm text-slate-600"
                />
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

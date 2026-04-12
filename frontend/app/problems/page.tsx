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

const TYPE_LABELS: Record<string, string> = {
  one_choice: "Один ответ",
  multi_choice: "Несколько ответов",
  text_input: "Текстовый ответ",
};

type SolveStatusFilter = "all" | "solved" | "incorrect" | "unattempted";
type SortOption = "newest" | "difficulty_asc" | "difficulty_desc" | "points_asc" | "points_desc";

const PAGE_SIZE = 12;
const FONT_ROSTOV = "var(--font-rostov)";
const FONT_JOST = "var(--font-jost)";
const FONT_JAKARTA = "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif";

function difficultyRank(value: string): number {
  if (value === "easy") return 1;
  if (value === "medium") return 2;
  if (value === "hard") return 3;
  return 99;
}

export default function ProblemsPage() {
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedStatus, setSelectedStatus] = useState<SolveStatusFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [sortBy, setSortBy] = useState<SortOption>("newest");
  const [currentPage, setCurrentPage] = useState(1);
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
    const query = searchQuery.trim().toLowerCase();
    const base = problems.filter((p) => {
      if (selectedDifficulty !== "all" && p.difficulty !== selectedDifficulty) return false;
      if (selectedType !== "all" && p.type !== selectedType) return false;

      const progress = progressByProblem[p.id];
      if (selectedStatus === "solved") {
        if (!(progress?.last_status === "graded" && progress.last_is_correct === true)) return false;
      } else if (selectedStatus === "incorrect") {
        if (!(progress?.last_status === "graded" && progress.last_is_correct === false)) return false;
      } else if (selectedStatus === "unattempted") {
        if (progress?.has_attempt) return false;
      }

      if (query) {
        const inTitle = p.title.toLowerCase().includes(query);
        const inStatement = p.statement.toLowerCase().includes(query);
        if (!inTitle && !inStatement) return false;
      }
      return true;
    });

    const sorted = [...base];
    if (sortBy === "difficulty_asc") {
      sorted.sort((a, b) => difficultyRank(a.difficulty) - difficultyRank(b.difficulty));
    } else if (sortBy === "difficulty_desc") {
      sorted.sort((a, b) => difficultyRank(b.difficulty) - difficultyRank(a.difficulty));
    } else if (sortBy === "points_asc") {
      sorted.sort((a, b) => a.points - b.points);
    } else if (sortBy === "points_desc") {
      sorted.sort((a, b) => b.points - a.points);
    }
    return sorted;
  }, [
    problems,
    progressByProblem,
    selectedDifficulty,
    selectedType,
    selectedStatus,
    searchQuery,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredProblems.length / PAGE_SIZE));
  const effectiveCurrentPage = Math.min(currentPage, totalPages);
  const paginatedProblems = useMemo(() => {
    const start = (effectiveCurrentPage - 1) * PAGE_SIZE;
    return filteredProblems.slice(start, start + PAGE_SIZE);
  }, [filteredProblems, effectiveCurrentPage]);

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
          filter: {
            difficulty: selectedDifficulty,
            type: selectedType,
            status: selectedStatus,
            search: searchQuery,
            sortBy,
          },
          solvedIds,
        }),
      );
    } catch {
    }
  }, [
    filteredProblems,
    selectedDifficulty,
    selectedType,
    selectedStatus,
    searchQuery,
    sortBy,
    progressByProblem,
  ]);

  if (isLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-[#f8fafc]">
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
    <div className="min-h-screen bg-[#f8fafc] text-[#0f2d51]">
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={profile.avatar_url ?? null} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 flex items-start justify-between gap-4 animate-page-in">
          <div>
            <h1 className="text-2xl sm:text-3xl" style={{ fontFamily: FONT_ROSTOV, letterSpacing: "-0.4px" }}>Все задачи</h1>
            <p className="mt-1 text-sm text-slate-500" style={{ fontFamily: FONT_JOST }}>
              Практикуйтесь на задачах разной сложности
            </p>
          </div>
          <div className="rounded-2xl border border-[#e2e8f0] bg-white px-4 py-2 text-xs font-semibold text-[#5081ba] shadow-sm animate-page-in" style={{ animationDelay: "0.06s", fontFamily: FONT_JAKARTA }}>
            Найдено: {filteredProblems.length}
          </div>
        </div>

        <section className="mb-6 animate-page-in rounded-[24px] border border-[#f1f5f9] bg-white p-5 shadow-[0px_10px_40px_-10px_rgba(15,45,81,0.08)]" style={{ animationDelay: "0.08s" }}>
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            <div className="xl:col-span-2">
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" style={{ fontFamily: FONT_JAKARTA }}>Поиск</label>
              <input
                value={searchQuery}
                onChange={(e) => {
                  setSearchQuery(e.target.value);
                  setCurrentPage(1);
                }}
                placeholder="По названию или условию задачи"
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none transition focus:border-[#5081ba] focus:ring-2 focus:ring-[#dbeafe]"
                style={{ fontFamily: FONT_JOST }}
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" style={{ fontFamily: FONT_JAKARTA }}>Сложность</label>
              <select
                value={selectedDifficulty}
                onChange={(e) => {
                  setSelectedDifficulty(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#5081ba] focus:ring-2 focus:ring-[#dbeafe]"
                style={{ fontFamily: FONT_JOST }}
              >
                <option value="all">Все</option>
                <option value="easy">Легкая</option>
                <option value="medium">Средняя</option>
                <option value="hard">Сложная</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" style={{ fontFamily: FONT_JAKARTA }}>Тип</label>
              <select
                value={selectedType}
                onChange={(e) => {
                  setSelectedType(e.target.value);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#5081ba] focus:ring-2 focus:ring-[#dbeafe]"
                style={{ fontFamily: FONT_JOST }}
              >
                <option value="all">Все</option>
                <option value="one_choice">Один ответ</option>
                <option value="multi_choice">Несколько ответов</option>
                <option value="text_input">Текстовый ответ</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" style={{ fontFamily: FONT_JAKARTA }}>Статус</label>
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value as SolveStatusFilter);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#5081ba] focus:ring-2 focus:ring-[#dbeafe]"
                style={{ fontFamily: FONT_JOST }}
              >
                <option value="all">Все</option>
                <option value="solved">Решенные</option>
                <option value="incorrect">С ошибками</option>
                <option value="unattempted">Без попыток</option>
              </select>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold uppercase tracking-wide text-slate-500" style={{ fontFamily: FONT_JAKARTA }}>Сортировка</label>
              <select
                value={sortBy}
                onChange={(e) => {
                  setSortBy(e.target.value as SortOption);
                  setCurrentPage(1);
                }}
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none transition focus:border-[#5081ba] focus:ring-2 focus:ring-[#dbeafe]"
                style={{ fontFamily: FONT_JOST }}
              >
                <option value="newest">По умолчанию</option>
                <option value="difficulty_asc">Сложность: легкие сначала</option>
                <option value="difficulty_desc">Сложность: сложные сначала</option>
                <option value="points_asc">Баллы: по возрастанию</option>
                <option value="points_desc">Баллы: по убыванию</option>
              </select>
            </div>
          </div>

          <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs text-slate-500" style={{ fontFamily: FONT_JAKARTA }}>
              Страница {effectiveCurrentPage} из {totalPages}
            </p>
            <button
              type="button"
              onClick={() => {
                setSelectedDifficulty("all");
                setSelectedType("all");
                setSelectedStatus("all");
                setSearchQuery("");
                setSortBy("newest");
                setCurrentPage(1);
              }}
              className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
              style={{ fontFamily: FONT_JAKARTA }}
            >
              Сбросить фильтры
            </button>
          </div>
        </section>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600" style={{ fontFamily: FONT_JOST }}>
            {loadError}
          </div>
        )}

        {filteredProblems.length === 0 && !loadError ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-slate-400" style={{ fontFamily: FONT_JOST }}>
            По выбранным фильтрам задач не найдено
          </div>
        ) : (
          <div className="grid gap-4">
            {paginatedProblems.map((problem, idx) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.id}`}
                className="block animate-page-in rounded-[24px] border border-[#f1f5f9] bg-white p-5 transition-all duration-300 ease-out hover:-translate-y-1 hover:shadow-xl hover:border-[#dbeafe] active:scale-[0.99]"
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
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600" style={{ fontFamily: FONT_JAKARTA }}>
                    {problem.points} балл.
                  </span>
                  <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs text-blue-700">
                    {TYPE_LABELS[problem.type] ?? problem.type}
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
                <h2 className="text-base font-semibold text-slate-900" style={{ fontFamily: FONT_JAKARTA }}>
                  <ProblemContent body={problem.title} variant="inline" />
                </h2>
                <div style={{ fontFamily: FONT_JOST }}>
                  <ProblemContent
                    body={problem.statement}
                    className="mt-2 line-clamp-2 text-sm text-slate-600"
                  />
                </div>
              </Link>
            ))}
          </div>
        )}

        {filteredProblems.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={effectiveCurrentPage <= 1}
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontFamily: FONT_JAKARTA }}
            >
              Назад
            </button>
            {Array.from({ length: totalPages }).slice(0, 7).map((_, i) => {
              const pageNum = i + 1;
              return (
                <button
                  key={pageNum}
                  type="button"
                  onClick={() => setCurrentPage(pageNum)}
                  className={`h-9 min-w-9 rounded-xl px-3 text-sm font-semibold transition ${
                    effectiveCurrentPage === pageNum
                      ? "bg-[#0f2d51] text-white"
                      : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                  }`}
                >
                  {pageNum}
                </button>
              );
            })}
            {totalPages > 7 && <span className="px-1 text-slate-400">...</span>}
            {totalPages > 7 && (
              <button
                type="button"
                  onClick={() => setCurrentPage(totalPages)}
                  className={`h-9 min-w-9 rounded-xl px-3 text-sm font-semibold transition ${
                    effectiveCurrentPage === totalPages
                    ? "bg-[#0f2d51] text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {totalPages}
              </button>
            )}
            <button
              type="button"
              disabled={effectiveCurrentPage >= totalPages}
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              style={{ fontFamily: FONT_JAKARTA }}
            >
              Вперед
            </button>
          </div>
        )}
      </main>
    </div>
  );
}

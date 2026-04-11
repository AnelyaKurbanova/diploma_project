'use client';

import { useEffect, useMemo, useState, type ReactNode } from "react";
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

type SubjectRow = {
  id: string;
  code: string;
  name_ru: string;
};

type TopicRow = {
  id: string;
  subject_id: string;
  grade_level: number | null;
  title_ru: string;
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
  single_choice: "Один ответ",
  multiple_choice: "Несколько ответов",
  short_text: "Краткий ответ",
  match: "Сопоставление",
  numeric: "Числовой ответ",
};

function FilterPill({
  active,
  children,
  onClick,
}: {
  active: boolean;
  children: ReactNode;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all duration-200 ${
        active
          ? "bg-brand-navy text-white shadow-sm"
          : "border border-slate-200 bg-white text-slate-600 hover:border-brand-navy/35 hover:text-brand-navy"
      }`}
    >
      {children}
    </button>
  );
}

export default function ProblemsPage() {
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [subjects, setSubjects] = useState<SubjectRow[]>([]);
  const [topics, setTopics] = useState<TopicRow[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<string>("all");
  const [selectedTopic, setSelectedTopic] = useState<string>("all");
  const [selectedGrade, setSelectedGrade] = useState<string>("all");
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [selectedType, setSelectedType] = useState<string>("all");
  const [selectedTag, setSelectedTag] = useState<string>("all");
  const [searchQuery, setSearchQuery] = useState("");
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

    (async () => {
      try {
        const [subj, top] = await Promise.all([
          apiGet<SubjectRow[]>("/subjects", accessToken),
          apiGet<TopicRow[]>("/topics", accessToken),
        ]);
        setSubjects(subj);
        setTopics(top);
      } catch {
        // каталог не критичен — фильтры по предмету/теме останутся пустыми
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

  const topicById = useMemo(() => {
    const m = new Map<string, TopicRow>();
    for (const t of topics) m.set(t.id, t);
    return m;
  }, [topics]);

  const subjectById = useMemo(() => {
    const m = new Map<string, string>();
    for (const s of subjects) m.set(s.id, s.name_ru);
    return m;
  }, [subjects]);

  const topicsForSubject = useMemo(() => {
    if (selectedSubject === "all") return topics;
    return topics.filter((t) => t.subject_id === selectedSubject);
  }, [topics, selectedSubject]);

  /** Если тема не относится к выбранному предмету, не фильтруем по ней */
  const resolvedTopicId = useMemo(() => {
    if (selectedTopic === "all") return "all";
    return topicsForSubject.some((t) => t.id === selectedTopic) ? selectedTopic : "all";
  }, [selectedTopic, topicsForSubject]);

  const gradeOptions = useMemo(() => {
    const set = new Set<number>();
    for (const p of problems) {
      if (!p.topic_id) continue;
      const t = topicById.get(p.topic_id);
      if (t?.grade_level != null) set.add(t.grade_level);
    }
    return [...set].sort((a, b) => a - b);
  }, [problems, topicById]);

  const tagOptions = useMemo(() => {
    const names = new Set<string>();
    for (const p of problems) {
      for (const tag of p.tags) names.add(tag.name);
    }
    return [...names].sort((a, b) => a.localeCompare(b, "ru"));
  }, [problems]);

  const typeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const p of problems) set.add(p.type);
    return [...set].sort();
  }, [problems]);

  const searchTrim = searchQuery.trim().toLowerCase();

  const filteredProblems = useMemo(() => {
    return problems.filter((p) => {
      if (selectedSubject !== "all" && p.subject_id !== selectedSubject) return false;
      if (resolvedTopicId !== "all" && p.topic_id !== resolvedTopicId) return false;
      if (selectedDifficulty !== "all" && p.difficulty !== selectedDifficulty) return false;
      if (selectedType !== "all" && p.type !== selectedType) return false;
      if (selectedTag !== "all" && !p.tags.some((t) => t.name === selectedTag)) return false;
      if (selectedGrade !== "all") {
        const g = Number.parseInt(selectedGrade, 10);
        if (!p.topic_id) return false;
        const t = topicById.get(p.topic_id);
        if (t?.grade_level !== g) return false;
      }
      if (searchTrim) {
        const hay = `${p.title} ${p.statement}`.toLowerCase();
        if (!hay.includes(searchTrim)) return false;
      }
      return true;
    });
  }, [
    problems,
    selectedSubject,
    resolvedTopicId,
    selectedDifficulty,
    selectedType,
    selectedTag,
    selectedGrade,
    searchTrim,
    topicById,
  ]);

  const resetFilters = () => {
    setSelectedSubject("all");
    setSelectedTopic("all");
    setSelectedGrade("all");
    setSelectedDifficulty("all");
    setSelectedType("all");
    setSelectedTag("all");
    setSearchQuery("");
  };

  const hasActiveFilters =
    selectedSubject !== "all" ||
    resolvedTopicId !== "all" ||
    selectedGrade !== "all" ||
    selectedDifficulty !== "all" ||
    selectedType !== "all" ||
    selectedTag !== "all" ||
    searchTrim.length > 0;

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
            subject: selectedSubject,
            topic: resolvedTopicId,
            grade: selectedGrade,
            type: selectedType,
            tag: selectedTag,
            q: searchQuery.trim(),
          },
          solvedIds,
        }),
      );
    } catch {
    }
  }, [
    filteredProblems,
    selectedDifficulty,
    selectedSubject,
    resolvedTopicId,
    selectedGrade,
    selectedType,
    selectedTag,
    searchQuery,
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

  const selectClass =
    "w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none transition-colors focus:border-brand-navy focus:ring-2 focus:ring-brand-navy/20";

  return (
    <div className="min-h-screen bg-slate-100 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={profile.avatar_url ?? null} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 animate-page-in">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <h1 className="text-2xl font-extrabold text-brand-navy sm:text-3xl">Все задачи</h1>
              <p className="mt-1 text-sm text-slate-600">
                Фильтры по предмету, классу, теме, типу и сложности
              </p>
            </div>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={resetFilters}
                className="shrink-0 rounded-xl border border-brand-navy/25 bg-white px-4 py-2 text-sm font-medium text-brand-navy transition-colors hover:bg-brand-navy/5"
              >
                Сбросить фильтры
              </button>
            )}
          </div>
        </div>

        <section
          className="mb-8 animate-page-in rounded-2xl border border-slate-200/90 bg-white p-4 shadow-sm sm:p-5"
          style={{ boxShadow: `0 4px 24px -8px rgba(15, 45, 81, 0.08)` }}
        >
          <div className="mb-4">
            <label htmlFor="problems-search" className="mb-1.5 block text-xs font-medium text-brand-navy">
              Поиск по тексту
            </label>
            <input
              id="problems-search"
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Название или условие…"
              className={selectClass}
              autoComplete="off"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label htmlFor="filter-subject" className="mb-1.5 block text-xs font-medium text-brand-navy">
                Предмет
              </label>
              <select
                id="filter-subject"
                className={selectClass}
                value={selectedSubject}
                onChange={(e) => {
                  setSelectedSubject(e.target.value);
                  setSelectedTopic("all");
                }}
              >
                <option value="all">Все предметы</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name_ru}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="filter-topic" className="mb-1.5 block text-xs font-medium text-brand-navy">
                Тема
              </label>
              <select
                id="filter-topic"
                className={selectClass}
                value={resolvedTopicId}
                onChange={(e) => setSelectedTopic(e.target.value)}
                disabled={topicsForSubject.length === 0}
              >
                <option value="all">Все темы</option>
                {topicsForSubject.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.title_ru}
                    {t.grade_level != null ? ` (${t.grade_level} кл.)` : ""}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {gradeOptions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-brand-navy">Класс</p>
              <div className="flex flex-wrap gap-2">
                <FilterPill active={selectedGrade === "all"} onClick={() => setSelectedGrade("all")}>
                  Все
                </FilterPill>
                {gradeOptions.map((g) => (
                  <FilterPill
                    key={g}
                    active={selectedGrade === String(g)}
                    onClick={() => setSelectedGrade(String(g))}
                  >
                    {g} класс
                  </FilterPill>
                ))}
              </div>
            </div>
          )}

          <div className="mt-4">
            <p className="mb-2 text-xs font-medium text-brand-navy">Сложность</p>
            <div className="flex flex-wrap gap-2">
              {["all", "easy", "medium", "hard"].map((difficulty) => (
                <FilterPill
                  key={difficulty}
                  active={selectedDifficulty === difficulty}
                  onClick={() => setSelectedDifficulty(difficulty)}
                >
                  {difficulty === "all" ? "Все" : (DIFFICULTY_LABELS[difficulty] ?? difficulty)}
                </FilterPill>
              ))}
            </div>
          </div>

          {typeOptions.length > 0 && (
            <div className="mt-4">
              <p className="mb-2 text-xs font-medium text-brand-navy">Тип задачи</p>
              <div className="flex flex-wrap gap-2">
                <FilterPill active={selectedType === "all"} onClick={() => setSelectedType("all")}>
                  Все типы
                </FilterPill>
                {typeOptions.map((t) => (
                  <FilterPill key={t} active={selectedType === t} onClick={() => setSelectedType(t)}>
                    {TYPE_LABELS[t] ?? t}
                  </FilterPill>
                ))}
              </div>
            </div>
          )}

          {tagOptions.length > 0 && (
            <div className="mt-4">
              <label htmlFor="filter-tag" className="mb-1.5 block text-xs font-medium text-brand-navy">
                Тег
              </label>
              <select
                id="filter-tag"
                className={selectClass}
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
              >
                <option value="all">Все теги</option>
                {tagOptions.map((name) => (
                  <option key={name} value={name}>
                    {name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </section>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600" style={{ fontFamily: FONT_JOST }}>
            {loadError}
          </div>
        )}

        {!loadError && problems.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center text-sm text-slate-500">
            Задачи пока не добавлены
          </div>
        )}

        {!loadError && problems.length > 0 && filteredProblems.length === 0 && (
          <div className="rounded-2xl border border-slate-200 bg-white py-16 text-center">
            <p className="text-sm text-slate-600">Нет задач по выбранным фильтрам.</p>
            <button
              type="button"
              onClick={resetFilters}
              className="mt-4 rounded-xl bg-brand-navy px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-brand-navy-hover"
            >
              Сбросить фильтры
            </button>
          </div>
        )}

        {!loadError && filteredProblems.length > 0 && (
          <div className="grid gap-4">
            {filteredProblems.map((problem, idx) => {
              const topic = problem.topic_id ? topicById.get(problem.topic_id) : undefined;
              const subjectName = subjectById.get(problem.subject_id);
              const metaParts = [subjectName, topic?.title_ru].filter(Boolean);
              return (
                <Link
                  key={problem.id}
                  href={`/problems/${problem.id}`}
                  className="block animate-page-in rounded-2xl border border-slate-200 bg-white p-5 transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-brand-navy/25 hover:shadow-[0px_10px_40px_-10px_rgba(15,45,81,0.08)] active:scale-[0.99]"
                  style={{
                    animationDelay: `${Math.min(idx * 0.04, 0.3)}s`,
                  }}
                >
                  <div className="mb-2 flex flex-wrap items-center gap-2">
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        DIFFICULTY_COLORS[problem.difficulty] ?? "bg-slate-100 text-slate-700"
                      }`}
                    >
                      {DIFFICULTY_LABELS[problem.difficulty] ?? problem.difficulty}
                    </span>
                    <span className="rounded-full border border-slate-200/80 bg-slate-50 px-2 py-0.5 text-xs text-brand-navy/90">
                      {TYPE_LABELS[problem.type] ?? problem.type}
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
                          {progressByProblem[problem.id]?.last_is_correct ? "Решена" : "Пока неверно"}
                        </span>
                      )}
                  </div>
                  {metaParts.length > 0 && (
                    <p className="mb-1 text-xs text-slate-500">{metaParts.join(" · ")}</p>
                  )}
                  <h2 className="text-base font-semibold text-brand-navy">
                    <ProblemContent body={problem.title} variant="inline" />
                  </h2>
                  <ProblemContent
                    body={problem.statement}
                    className="mt-2 line-clamp-2 text-sm text-slate-600"
                  />
                </Link>
              );
            })}
          </div>
        )}

        {filteredProblems.length > 0 && (
          <div className="mt-6 flex items-center justify-center gap-2">
            <button
              type="button"
              disabled={currentPage <= 1}
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
                    currentPage === pageNum
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
                    currentPage === totalPages
                    ? "bg-[#0f2d51] text-white"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {totalPages}
              </button>
            )}
            <button
              type="button"
              disabled={currentPage >= totalPages}
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

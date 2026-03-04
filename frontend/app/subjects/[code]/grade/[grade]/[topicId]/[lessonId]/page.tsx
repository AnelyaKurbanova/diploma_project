/* eslint-disable react-hooks/exhaustive-deps */
'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { JSX } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";
import {
  useLesson,
  useProfile,
  useSubjects,
  useTopic,
  useTopicsForSubjectGrade,
  useTopicProgress,
} from "@/lib/swr-hooks";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { LectureContent } from "@/components/ui/lecture-content";
import { LessonPlayerLayout } from "@/components/learning/lesson-player-layout";
import type { BreadcrumbItem } from "@/components/ui/breadcrumbs";
import { ProblemContent } from "@/components/ui/problem-content";

type Subject = { id: string; code: string; name_ru: string };
type Topic = { id: string; title_ru: string };

type BlockProblem = { problem_id: string; order_no: number };

type ContentBlock = {
  id: string;
  block_type: "lecture" | "video" | "problem_set";
  order_no: number;
  title: string | null;
  body: string | null;
  video_url: string | null;
  video_description: string | null;
  problems: BlockProblem[];
};

type LessonDetail = {
  id: string;
  topic_id: string;
  title: string;
  order_no: number;
  theory_body: string | null;
  content_blocks: ContentBlock[];
  problem_ids: string[];
};

type LessonSummary = { id: string; title: string; order_no: number };

const EMPTY_LESSON_LIST: LessonSummary[] = [];

type ProblemPreview = {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
};

type SubmissionProgress = {
  has_attempt: boolean;
  last_status: "pending" | "graded" | "needs_review" | null;
  last_is_correct: boolean | null;
};

type ProfileResponse = {
  full_name: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
};

function hasHtmlTags(input: string): boolean {
  return /<[^>]+>/.test(input);
}

const panelClass =
  "rounded-3xl bg-white border border-gray-100 p-8 shadow-sm transition-all hover:shadow-md hover:border-blue-100";

function LectureBlock({ block }: { block: ContentBlock }) {
  return (
    <section className={panelClass}>
      {block.title && (
        <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">
          <svg
            className="h-5 w-5 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
            />
          </svg>
          {block.title}
        </h2>
      )}

      {block.body &&
        (hasHtmlTags(block.body) ? (
          <div
            className="prose max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-a:text-blue-600 prose-code:text-blue-600 [&_img]:mx-auto [&_img]:my-8 [&_img]:max-h-[520px] [&_img]:w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:object-contain"
            dangerouslySetInnerHTML={{ __html: block.body }}
          />
        ) : (
          <div className="text-slate-800">
            <LectureContent body={block.body} />
          </div>
        ))}
    </section>
  );
}

function VideoBlock({ block }: { block: ContentBlock }) {
  let embedUrl: string | null = null;
  let directVideoUrl: string | null = null;

  if (block.video_url) {
    const ytMatch = block.video_url.match(
      /(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/,
    );
    if (ytMatch) embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
    else directVideoUrl = block.video_url;
  }

  return (
    <section className={panelClass}>
      {block.title && (
        <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">
          <svg
            className="h-5 w-5 text-blue-500"
            fill="none"
            viewBox="0 0 24 24"
            strokeWidth={1.5}
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
            />
          </svg>
          {block.title}
        </h2>
      )}

      {embedUrl && (
        <div className="aspect-video overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-md transition-colors hover:border-blue-400/60">
          <iframe
            src={embedUrl}
            className="h-full w-full"
            allowFullScreen
            title={block.title ?? "Video"}
          />
        </div>
      )}

      {directVideoUrl && (
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-black shadow-md transition-colors hover:border-blue-400/60">
          <video
            src={directVideoUrl}
            className="h-auto w-full"
            controls
            preload="metadata"
            playsInline
          />
        </div>
      )}

      {block.video_description && (
        <p className="mt-4 text-sm text-slate-500">{block.video_description}</p>
      )}
    </section>
  );
}

function ProblemSetBlock({
  block,
  accessToken,
  lessonPath,
}: {
  block: ContentBlock;
  accessToken: string;
  lessonPath: string;
}) {
  const sortedProblems = useMemo(
    () => [...block.problems].sort((a, b) => a.order_no - b.order_no),
    [block.problems],
  );

  const [problemMeta, setProblemMeta] = useState<
    Record<string, { title: string; difficulty: "easy" | "medium" | "hard" }>
  >({});
  const [solvedIds, setSolvedIds] = useState<Set<string>>(new Set());

  const difficultyLabel: Record<"easy" | "medium" | "hard", string> = {
    easy: "Лёгкая",
    medium: "Средняя",
    hard: "Сложная",
  };

  const difficultyClass: Record<"easy" | "medium" | "hard", string> = {
    easy: "bg-emerald-50 text-emerald-700 border border-emerald-100",
    medium: "bg-amber-50 text-amber-700 border border-amber-100",
    hard: "bg-rose-50 text-rose-700 border border-rose-100",
  };

  useEffect(() => {
    if (!accessToken || block.problems.length === 0) return;
    (async () => {
      const problemsToLoad = [...block.problems].sort((a, b) => a.order_no - b.order_no);
      const entries = await Promise.all(
        problemsToLoad.map(async (problem) => {
          try {
            const data = await apiGet<ProblemPreview>(
              `/problems/${problem.problem_id}`,
              accessToken,
            );
            return [problem.problem_id, { title: data.title, difficulty: data.difficulty }] as const;
          } catch {
            return [problem.problem_id, { title: "Без названия", difficulty: "easy" as const }] as const;
          }
        }),
      );
      setProblemMeta(Object.fromEntries(entries));
    })();
  }, [accessToken, block.id, block.problems]);

  useEffect(() => {
    if (!accessToken || block.problems.length === 0) return;
    const ids = block.problems.map((p) => p.problem_id).join(",");
    (async () => {
      try {
        const res = await apiGet<{
          items: Array<SubmissionProgress & { problem_id: string }>;
        }>(
          `/submissions/last?problem_ids=${encodeURIComponent(ids)}`,
          accessToken,
        );

        const solved = new Set(
          (res.items ?? [])
            .filter((i) => i.last_status === "graded" && i.last_is_correct === true)
            .map((i) => i.problem_id),
        );
        setSolvedIds(solved);
      } catch {
        setSolvedIds(new Set());
      }
    })();
  }, [accessToken, block.id, block.problems]);

  const blockTitle = (block.title && block.title.trim().length > 0) ? block.title.trim() : "Задачи";

  return (
    <section className={panelClass}>
      <h2 className="mb-5 flex items-center gap-2 text-lg font-bold text-slate-900">
        <svg
          className="h-5 w-5 text-emerald-500"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z"
          />
        </svg>
        {blockTitle}
      </h2>

      {sortedProblems.length === 0 ? (
        <p className="py-8 text-center text-sm text-slate-500">Задачи ещё не добавлены</p>
      ) : (
        <div className="space-y-3">
          {sortedProblems.map((problem, idx) => (
            <div
              key={problem.problem_id}
              className="flex flex-col gap-3 rounded-2xl border border-gray-100 bg-white p-5 transition-all hover:border-blue-100 hover:shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex min-w-0 items-center gap-3">
                <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-50 text-xs font-bold text-blue-700">
                  {idx + 1}
                </span>

                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="truncate text-sm font-semibold text-slate-900">
                      <ProblemContent
                        body={problemMeta[problem.problem_id]?.title?.trim() || `Задача ${idx + 1}`}
                        variant="inline"
                      />
                    </span>

                    {problemMeta[problem.problem_id]?.difficulty && (
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${difficultyClass[problemMeta[problem.problem_id].difficulty]}`}
                      >
                        {difficultyLabel[problemMeta[problem.problem_id].difficulty]}
                      </span>
                    )}

                    {solvedIds.has(problem.problem_id) && (
                      <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-xs font-semibold text-emerald-700">
                        <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                        </svg>
                        Решено
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <Link
                href={`/problems/${problem.problem_id}?return_to=${encodeURIComponent(lessonPath)}`}
                onClick={() => {
                  try {
                    const ids = sortedProblems.map((p) => p.problem_id);
                    window.sessionStorage.setItem("problems_nav", JSON.stringify({ ids, return_to: lessonPath }));
                  } catch { }
                }}
                className="inline-flex items-center justify-center rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-indigo-500/20 transition-all hover:scale-[1.02] hover:shadow-indigo-500/35 active:scale-[0.98]"
              >
                Решить
              </Link>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

export default function LessonDetailTabsPage() {
  const { code, grade, topicId, lessonId } = useParams<{
    code: string;
    grade: string;
    topicId: string;
    lessonId: string;
  }>();

  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const { profile, error: profileError } = useProfile();
  const { subjects } = useSubjects();
  const { topic } = useTopic(topicId ?? null) as { topic: Topic | null | undefined };
  const { lesson, error: lessonError } = useLesson(lessonId ?? null) as {
    lesson: LessonDetail | null | undefined;
    error: unknown;
  };

  const subject = useMemo(() => subjects.find((s) => s.code === code) ?? null, [subjects, code]);
  const loadError = !!profileError || !!lessonError;

  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [activeTab, setActiveTab] = useState<"lecture" | "video" | "tasks">("lecture");
  const lessonEndRef = useRef<HTMLDivElement | null>(null);

  const numericGrade = Number.parseInt(grade, 10);
  const { topics: gradeTopics } = useTopicsForSubjectGrade(code ?? null, Number.isFinite(numericGrade) ? numericGrade : null);

  const { progressByLessonId, mutate: mutateTopicProgress } = useTopicProgress(topicId ?? null);

  const [navLessons, setNavLessons] = useState<Record<string, LessonSummary[]>>({});
  const [navLoading, setNavLoading] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/auth");
  }, [isLoading, user, router]);

  useEffect(() => {
    if (profileError && (profileError as { status?: number }).status === 404) {
      router.replace("/onboarding");
    }
  }, [profileError, router]);

  useEffect(() => {
    if (!accessToken || !gradeTopics.length) return;

    let cancelled = false;
    setNavLoading(true);

    (async () => {
      try {
        const entries = await Promise.all(
          gradeTopics.map(async (t) => {
            try {
              const data = await apiGet<LessonSummary[]>(`/topics/${t.id}/lessons`, accessToken);
              const sorted = data.slice().sort((a, b) => a.order_no - b.order_no);
              return [t.id, sorted] as const;
            } catch {
              return [t.id, [] as LessonSummary[]] as const;
            }
          }),
        );

        if (cancelled) return;
        const map: Record<string, LessonSummary[]> = {};
        for (const [id, list] of entries) map[id] = list;
        setNavLessons(map);
      } finally {
        if (!cancelled) setNavLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [accessToken, gradeTopics]);

  const handleComplete = useCallback(async () => {
    if (!accessToken || !lessonId || completing || completed) return;
    setCompleting(true);
    try {
      await apiPost(`/lessons/${lessonId}/complete`, undefined, accessToken);
      setCompleted(true);
      await mutateTopicProgress();
    } catch {
    } finally {
      setCompleting(false);
    }
  }, [accessToken, lessonId, completing, completed, mutateTopicProgress]);

  useEffect(() => {
    if (!lesson || completed || !lessonEndRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) handleComplete();
      },
      { threshold: 0.9 },
    );

    observer.observe(lessonEndRef.current);
    return () => observer.disconnect();
  }, [lesson, completed, handleComplete]);

  if (isLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <div className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
          <div className="mb-8">
            <div className="h-9 w-72 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-3xl bg-white" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  const userName = (profile as ProfileResponse).full_name ?? user.email.split("@")[0];
  const userRole = user.role ?? "student";
  const lessonPath = `/subjects/${code}/grade/${grade}/${topicId}/${lessonId}`;

  const lectureBlocks = (lesson?.content_blocks ?? []).filter((b) => b.block_type === "lecture");
  const videoBlocks = (lesson?.content_blocks ?? []).filter((b) => b.block_type === "video");
  const taskBlocks = (lesson?.content_blocks ?? []).filter((b) => b.block_type === "problem_set");

  const showLectureTab = lectureBlocks.length > 0 || !!lesson?.theory_body;
  const showVideoTab = videoBlocks.length > 0;
  const showTasksTab = taskBlocks.length > 0;

  const currentTopicLessons = navLessons[topicId] || EMPTY_LESSON_LIST;
  const totalLessonsInTopic = currentTopicLessons.length;
  const completedLessonsInTopic = totalLessonsInTopic
    ? currentTopicLessons.filter((l) => progressByLessonId[l.id]?.completed).length
    : 0;

  const breadcrumbs: BreadcrumbItem[] = [
    { label: "Предметы", href: "/subjects" },
    { label: subject?.name_ru ?? code, href: `/subjects/${code}` },
    { label: `${grade} класс`, href: `/subjects/${code}/grade/${grade}` },
    { label: topic?.title_ru ?? "...", href: `/subjects/${code}/grade/${grade}/${topicId}` },
    { label: lesson?.title ?? "...", current: true },
  ];

  const sidebar = (
    <div className="space-y-4">
      <div className="rounded-3xl border border-gray-100 bg-white p-5 shadow-sm">
        <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Курс</p>
        <h2 className="mt-2 text-xl font-extrabold tracking-tight text-slate-900">
          {subject?.name_ru ?? code} · {grade} класс
        </h2>
        <p className="mt-1 text-xs text-slate-500">Темы и уроки по программе.</p>
      </div>

      <div className="rounded-3xl border border-gray-100 bg-white p-4 shadow-sm">
        <p className="mb-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">Темы и уроки</p>

        {navLoading && (
          <div className="space-y-2">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-8 animate-pulse rounded-2xl bg-slate-100" />
            ))}
          </div>
        )}

        {!navLoading && gradeTopics.length === 0 && <p className="text-xs text-slate-500">Для этого класса пока нет тем с уроками.</p>}

        {!navLoading && gradeTopics.length > 0 && (
          <div className="space-y-5">
            {gradeTopics.map((t) => {
              const lessonsForTopic = navLessons[t.id] ?? [];

              return (
                <div key={t.id} className="space-y-2">
                  <button
                    type="button"
                    onClick={() => router.push(`/subjects/${code}/grade/${grade}/${t.id}`)}
                    className="flex w-full items-center justify-between rounded-2xl px-2 py-1 text-left transition-colors hover:bg-slate-50"
                  >
                    <span className="text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">{t.title_ru}</span>
                    <span className="text-[10px] text-slate-400">{lessonsForTopic.length} уроков</span>
                  </button>

                  {lessonsForTopic.length > 0 && (
                    <div className="mt-1 space-y-1 border-l border-slate-100 pl-3">
                      {lessonsForTopic.map((l, idx) => {
                        const isActiveLesson = l.id === lessonId;
                        const isCompletedLesson = !!progressByLessonId[l.id]?.completed;

                        return (
                          <Link
                            key={l.id}
                            href={`/subjects/${code}/grade/${grade}/${t.id}/${l.id}`}
                            className={`flex items-center justify-between rounded-2xl px-3 py-2 text-[11px] transition-all ${isActiveLesson
                                ? "bg-blue-50 text-blue-700 shadow-sm"
                                : isCompletedLesson
                                  ? "border border-emerald-100 bg-emerald-50 text-emerald-700"
                                  : "text-slate-700 hover:bg-slate-50"
                              }`}
                          >
                            <span className="flex min-w-0 items-center gap-2">
                              <span
                                className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${isActiveLesson
                                    ? "bg-blue-100 text-blue-700"
                                    : isCompletedLesson
                                      ? "bg-emerald-100 text-emerald-700"
                                      : "bg-slate-100 text-slate-600"
                                  }`}
                              >
                                {idx + 1}
                              </span>
                              <span className="text-[11px] leading-snug text-slate-800">{l.title}</span>
                            </span>

                            {isCompletedLesson && (
                              <span className="ml-2 inline-flex items-center gap-1 text-[10px] font-bold text-emerald-700">
                                <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                                  <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                                </svg>
                              </span>
                            )}
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={(profile as ProfileResponse).avatar_url ?? null} />

      <LessonPlayerLayout breadcrumbs={breadcrumbs} sidebar={sidebar}>
        {loadError && (
          <div className="mb-5 rounded-2xl border border-rose-100 bg-rose-50 px-4 py-3 text-sm text-rose-700">
            Не удалось загрузить урок. Попробуйте обновить страницу.
          </div>
        )}

        {lesson && (
          <>
            <div className="mb-6 animate-page-in animate-stagger-1">
              <h1 className="text-4xl font-extrabold tracking-tight text-slate-900">{lesson.title}</h1>
              <div className="mt-4 flex flex-wrap items-center gap-2 text-sm text-slate-500">
                <span className="inline-flex items-center rounded-full border border-gray-200 bg-white px-3 py-1 font-semibold">
                  Тема: {topic?.title_ru ?? "..."}
                </span>

                {totalLessonsInTopic > 0 && (
                  <span className="inline-flex items-center gap-2 rounded-full border border-emerald-100 bg-emerald-50 px-3 py-1 font-semibold text-emerald-700">
                    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.5 8.25 18 21 6" />
                    </svg>
                    Прогресс по теме: {completedLessonsInTopic}/{totalLessonsInTopic} уроков
                  </span>
                )}
              </div>
            </div>

            <div className="mb-7 flex gap-2 rounded-2xl border border-gray-200 bg-white p-1 text-sm font-semibold shadow-sm">
              {showLectureTab && (
                <button
                  type="button"
                  onClick={() => setActiveTab("lecture")}
                  className={`flex-1 rounded-xl px-4 py-2.5 transition-all ${activeTab === "lecture"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50"
                    }`}
                >
                  Лекция
                </button>
              )}

              {showVideoTab && (
                <button
                  type="button"
                  onClick={() => setActiveTab("video")}
                  className={`flex-1 rounded-xl px-4 py-2.5 transition-all ${activeTab === "video"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50"
                    }`}
                >
                  Видео
                </button>
              )}

              {showTasksTab && (
                <button
                  type="button"
                  onClick={() => setActiveTab("tasks")}
                  className={`flex-1 rounded-xl px-4 py-2.5 transition-all ${activeTab === "tasks"
                      ? "bg-indigo-600 text-white shadow-sm"
                      : "text-slate-500 hover:bg-slate-50"
                    }`}
                >
                  Задачи
                </button>
              )}
            </div>

            <div className="space-y-6">
              {activeTab === "lecture" && (
                <>
                  {lectureBlocks.length > 0 ? (
                    lectureBlocks.map((block, idx) => (
                      <div
                        key={block.id}
                        className="animate-page-in"
                        style={{ animationDelay: `${Math.min(idx * 0.08, 0.4)}s` }}
                      >
                        <LectureBlock block={block} />
                      </div>
                    ))
                  ) : lesson.theory_body ? (
                    <section className={panelClass}>
                      {hasHtmlTags(lesson.theory_body) ? (
                        <div
                          className="prose max-w-none prose-headings:text-slate-900 prose-p:text-slate-700 prose-strong:text-slate-900 prose-a:text-blue-600 prose-code:text-blue-600 [&_img]:mx-auto [&_img]:my-8 [&_img]:max-h-[520px] [&_img]:w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:object-contain"
                          dangerouslySetInnerHTML={{ __html: lesson.theory_body }}
                        />
                      ) : (
                        <div className="text-slate-800">
                          <LectureContent body={lesson.theory_body} />
                        </div>
                      )}
                    </section>
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-100 bg-white py-16 text-center">
                      <p className="text-sm text-slate-500">Лекция для этого урока ещё не добавлена</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === "video" && (
                <>
                  {videoBlocks.length > 0 ? (
                    videoBlocks.map((block, idx) => (
                      <div
                        key={block.id}
                        className="animate-page-in"
                        style={{ animationDelay: `${Math.min(idx * 0.08, 0.4)}s` }}
                      >
                        <VideoBlock block={block} />
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-100 bg-white py-16 text-center">
                      <p className="text-sm text-slate-500">Видео для этого урока ещё не добавлено</p>
                    </div>
                  )}
                </>
              )}

              {activeTab === "tasks" && (
                <>
                  {taskBlocks.length > 0 && accessToken ? (
                    taskBlocks.map((block, idx) => (
                      <div
                        key={block.id}
                        className="animate-page-in"
                        style={{ animationDelay: `${Math.min(idx * 0.08, 0.4)}s` }}
                      >
                        <ProblemSetBlock block={block} accessToken={accessToken} lessonPath={lessonPath} />
                      </div>
                    ))
                  ) : (
                    <div className="flex flex-col items-center justify-center rounded-3xl border border-gray-100 bg-white py-16 text-center">
                      <p className="text-sm text-slate-500">Задачи для этого урока ещё не добавлены</p>
                    </div>
                  )}
                </>
              )}
            </div>

            <div ref={lessonEndRef} className="h-1 w-full" />

            <div className="mt-10 flex justify-center">
              {completed ? (
                <div className="flex items-center gap-2 rounded-2xl border border-emerald-100 bg-emerald-50 px-6 py-3 text-sm font-bold text-emerald-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Урок отмечен как пройденный
                </div>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="rounded-2xl bg-gradient-to-r from-indigo-600 to-violet-600 px-10 py-3 text-sm font-extrabold text-white shadow-xl shadow-indigo-500/20 transition-all hover:scale-[1.02] hover:shadow-indigo-500/35 disabled:opacity-50 disabled:hover:scale-100"
                >
                  {completing ? "Сохранение..." : "Отметить урок пройденным"}
                </button>
              )}
            </div>
          </>
        )}
      </LessonPlayerLayout>
    </div>
  );
}
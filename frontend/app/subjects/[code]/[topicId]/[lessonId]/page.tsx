'use client';

import { useEffect, useState, useCallback, useMemo, useRef } from "react";
import type { JSX } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiPost } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

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

type ProblemPreview = {
  id: string;
  title: string;
  difficulty: "easy" | "medium" | "hard";
};

type ProfileResponse = { full_name: string | null; avatar_url?: string | null; [key: string]: unknown };

function hasHtmlTags(input: string): boolean {
  return /<[^>]+>/.test(input);
}

function renderPlainTextWithImages(body: string): JSX.Element[] {
  const imagePattern = /!\[([^\]]*)\]\((https?:\/\/[^\s)]+)\)/g;
  const nodes: JSX.Element[] = [];
  let lastIndex = 0;
  let match: RegExpExecArray | null;
  let key = 0;

  const pushText = (text: string) => {
    const chunks = text
      .split(/\n{2,}/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (const chunk of chunks) {
      const lines = chunk.split("\n");
      nodes.push(
        <p key={`p-${key++}`} className="mb-5 text-base leading-8 text-slate-700">
          {lines.map((line, idx) => (
            <span key={idx}>
              {line}
              {idx < lines.length - 1 && <br />}
            </span>
          ))}
        </p>,
      );
    }
  };

  while ((match = imagePattern.exec(body)) !== null) {
    const before = body.slice(lastIndex, match.index);
    if (before.trim()) pushText(before);

    nodes.push(
      <figure key={`img-${key++}`} className="my-8 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={match[2]}
          alt={match[1] || "Lecture image"}
          className="mx-auto max-h-[420px] w-full object-contain"
          loading="lazy"
        />
        {match[1] && (
          <figcaption className="border-t border-slate-200 bg-white px-4 py-2 text-center text-xs text-slate-500">
            {match[1]}
          </figcaption>
        )}
      </figure>,
    );
    lastIndex = imagePattern.lastIndex;
  }

  const tail = body.slice(lastIndex);
  if (tail.trim()) pushText(tail);

  return nodes;
}

function LectureBlock({ block }: { block: ContentBlock }) {
  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      {block.title && (
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
          <svg className="h-5 w-5 text-blue-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
          </svg>
          {block.title}
        </h2>
      )}
      {block.body && (
        hasHtmlTags(block.body) ? (
          <div
            className="prose prose-slate mx-auto max-w-3xl prose-p:text-base prose-p:leading-8 prose-headings:font-bold [&_img]:mx-auto [&_img]:my-8 [&_img]:max-h-[420px] [&_img]:w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:object-contain"
            dangerouslySetInnerHTML={{ __html: block.body }}
          />
        ) : (
          <div className="mx-auto max-w-3xl">{renderPlainTextWithImages(block.body)}</div>
        )
      )}
    </section>
  );
}

function VideoBlock({ block }: { block: ContentBlock }) {
  let embedUrl: string | null = null;
  let directVideoUrl: string | null = null;
  if (block.video_url) {
    const ytMatch = block.video_url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([\w-]+)/);
    if (ytMatch) {
      embedUrl = `https://www.youtube.com/embed/${ytMatch[1]}`;
    } else {
      directVideoUrl = block.video_url;
    }
  }

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      {block.title && (
        <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
          <svg className="h-5 w-5 text-indigo-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
          </svg>
          {block.title}
        </h2>
      )}
      {embedUrl && (
        <div className="aspect-video overflow-hidden rounded-xl bg-black">
          <iframe src={embedUrl} className="h-full w-full" allowFullScreen title={block.title ?? "Video"} />
        </div>
      )}
      {directVideoUrl && (
        <div className="overflow-hidden rounded-xl bg-black">
          <video src={directVideoUrl} className="h-auto w-full" controls preload="metadata" playsInline />
        </div>
      )}
      {block.video_description && <p className="mt-3 text-sm text-slate-500">{block.video_description}</p>}
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

  const difficultyLabel: Record<"easy" | "medium" | "hard", string> = {
    easy: "Лёгкая",
    medium: "Средняя",
    hard: "Сложная",
  };

  const difficultyClass: Record<"easy" | "medium" | "hard", string> = {
    easy: "bg-emerald-50 text-emerald-700",
    medium: "bg-amber-50 text-amber-700",
    hard: "bg-rose-50 text-rose-700",
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

  return (
    <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
        <svg className="h-5 w-5 text-emerald-500" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
        </svg>
        {block.title ?? "Задачи"}
      </h2>

      {sortedProblems.length === 0 ? (
        <p className="py-4 text-center text-sm text-slate-400">Задачи ещё не добавлены</p>
      ) : (
        <div className="space-y-3">
          {sortedProblems.map((problem, idx) => (
            <div key={problem.problem_id} className="flex items-center justify-between rounded-xl border border-gray-100 bg-slate-50/50 p-4">
              <div className="flex items-center gap-3">
                <span className="flex h-7 w-7 items-center justify-center rounded-full bg-blue-100 text-xs font-bold text-blue-700">
                  {idx + 1}
                </span>
                <span className="text-sm font-medium text-slate-800">
                  {problemMeta[problem.problem_id]?.title ?? `Задача ${idx + 1}`}
                </span>
                {problemMeta[problem.problem_id]?.difficulty && (
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      difficultyClass[problemMeta[problem.problem_id].difficulty]
                    }`}
                  >
                    {difficultyLabel[problemMeta[problem.problem_id].difficulty]}
                  </span>
                )}
              </div>
              <Link
                href={`/problems/${problem.problem_id}?return_to=${encodeURIComponent(lessonPath)}`}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
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

export default function LessonDetailPage() {
  const { code, topicId, lessonId } = useParams<{ code: string; topicId: string; lessonId: string }>();
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [lesson, setLesson] = useState<LessonDetail | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [completing, setCompleting] = useState(false);
  const [completed, setCompleted] = useState(false);
  const lessonEndRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/auth");
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
        setLoadError(true);
      }
    })();
  }, [accessToken, user, router]);

  useEffect(() => {
    if (!accessToken || !profile || !lessonId) return;
    (async () => {
      try {
        const subjects = await apiGet<Subject[]>("/subjects", accessToken);
        const found = subjects.find((s) => s.code === code);
        if (found) setSubject(found);

        const t = await apiGet<Topic>(`/topics/${topicId}`, accessToken);
        setTopic(t);

        const l = await apiGet<LessonDetail>(`/lessons/${lessonId}`, accessToken);
        setLesson(l);
      } catch {
        setLoadError(true);
      }
    })();
  }, [accessToken, profile, lessonId, topicId, code]);

  const handleComplete = useCallback(async () => {
    if (!accessToken || !lessonId || completing || completed) return;
    setCompleting(true);
    try {
      await apiPost(`/lessons/${lessonId}/complete`, undefined, accessToken);
      setCompleted(true);
    } catch {
      // ignore
    } finally {
      setCompleting(false);
    }
  }, [accessToken, lessonId, completing, completed]);

  useEffect(() => {
    if (!lesson || completed || !lessonEndRef.current) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (entry?.isIntersecting) {
          handleComplete();
        }
      },
      {
        threshold: 0.9,
      },
    );

    observer.observe(lessonEndRef.current);
    return () => observer.disconnect();
  }, [lesson, completed, handleComplete]);

  if (isLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
          <div className="mb-8">
            <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="space-y-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-48 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  const userName = profile.full_name ?? user.email.split("@")[0];
  const userRole = user.role ?? "student";
  const hasBlocks = (lesson?.content_blocks?.length ?? 0) > 0;
  const lessonPath = `/subjects/${code}/${topicId}/${lessonId}`;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={profile.avatar_url ?? null} />

      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <Link href="/subjects" className="transition-colors hover:text-blue-600">Предметы</Link>
          <span>/</span>
          <Link href={`/subjects/${code}`} className="transition-colors hover:text-blue-600">{subject?.name_ru ?? code}</Link>
          <span>/</span>
          <Link href={`/subjects/${code}/${topicId}`} className="transition-colors hover:text-blue-600">{topic?.title_ru ?? "..."}</Link>
          <span>/</span>
          <span className="font-medium text-slate-700">{lesson?.title ?? "..."}</span>
        </nav>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            Не удалось загрузить урок. Попробуйте обновить страницу.
          </div>
        )}

        {lesson && (
          <>
            <div className="mb-8">
              <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">{lesson.title}</h1>
            </div>

            {hasBlocks ? (
              <div className="space-y-6">
                {lesson.content_blocks.map((block) => {
                  switch (block.block_type) {
                    case "lecture":
                      return <LectureBlock key={block.id} block={block} />;
                    case "video":
                      return <VideoBlock key={block.id} block={block} />;
                    case "problem_set":
                      return (
                        <ProblemSetBlock
                          key={block.id}
                          block={block}
                          accessToken={accessToken!}
                          lessonPath={lessonPath}
                        />
                      );
                    default:
                      return null;
                  }
                })}
              </div>
            ) : lesson.theory_body ? (
              <section className="rounded-2xl border border-gray-100 bg-white p-6 shadow-sm">
                {hasHtmlTags(lesson.theory_body) ? (
                  <div
                    className="prose prose-slate mx-auto max-w-3xl prose-p:text-base prose-p:leading-8 prose-headings:font-bold [&_img]:mx-auto [&_img]:my-8 [&_img]:max-h-[420px] [&_img]:w-full [&_img]:rounded-2xl [&_img]:border [&_img]:border-slate-200 [&_img]:bg-white [&_img]:object-contain"
                    dangerouslySetInnerHTML={{ __html: lesson.theory_body }}
                  />
                ) : (
                  <div className="mx-auto max-w-3xl">{renderPlainTextWithImages(lesson.theory_body)}</div>
                )}
              </section>
            ) : (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 text-center">
                <p className="text-sm text-slate-400">Содержание урока ещё не добавлено</p>
              </div>
            )}

            <div ref={lessonEndRef} className="h-1 w-full" />
            <div className="mt-10 flex justify-center">
              {completed ? (
                <div className="flex items-center gap-2 rounded-xl bg-emerald-50 px-6 py-3 text-sm font-semibold text-emerald-700">
                  <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
                  </svg>
                  Урок отмечен как пройденный
                </div>
              ) : (
                <button
                  onClick={handleComplete}
                  disabled={completing}
                  className="rounded-xl bg-blue-600 px-8 py-3 text-sm font-semibold text-white shadow-sm transition-all hover:bg-blue-700 disabled:opacity-50"
                >
                  {completing ? "Сохранение..." : "Отметить урок пройденным"}
                </button>
              )}
            </div>
          </>
        )}
      </main>
    </div>
  );
}

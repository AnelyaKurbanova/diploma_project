'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

type Subject = {
  id: string;
  code: string;
  name_ru: string;
};

type Topic = {
  id: string;
  subject_id: string;
  parent_topic_id: string | null;
  title_ru: string;
  grade_level: number | null;
  order_no: number;
};

type Lesson = {
  id: string;
  topic_id: string;
  title: string;
  order_no: number;
  created_at: string;
};

type LessonProgress = {
  lesson_id: string;
  completed: boolean;
};

type ProfileResponse = {
  full_name: string | null;
  [key: string]: unknown;
};

export default function TopicDetailPage() {
  const { code, topicId } = useParams<{ code: string; topicId: string }>();
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  // Breadcrumb ancestors (from root topic down to parent of current)
  const [ancestors, setAncestors] = useState<Topic[]>([]);
  // Subtopics (children of current topic)
  const [subtopics, setSubtopics] = useState<Topic[]>([]);
  // Lessons (only loaded for leaf topics)
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [progressMap, setProgressMap] = useState<Record<string, boolean>>({});
  const [loadError, setLoadError] = useState(false);
  // Whether we've determined the content mode
  const [contentMode, setContentMode] = useState<
    "loading" | "subtopics" | "lessons"
  >("loading");

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
    if (!accessToken || !profile || !topicId || !code) return;

    // Reset state when topicId changes
    setSubtopics([]);
    setLessons([]);
    setProgressMap({});
    setContentMode("loading");
    setLoadError(false);

    (async () => {
      try {
        // 1. Resolve subject
        const subjects = await apiGet<Subject[]>("/subjects", accessToken);
        const found = subjects.find((s) => s.code === code);
        if (found) setSubject(found);

        // 2. Load current topic
        const t = await apiGet<Topic>(`/topics/${topicId}`, accessToken);
        setTopic(t);

        // 3. Build breadcrumb ancestors chain
        const chain: Topic[] = [];
        let parentId = t.parent_topic_id;
        while (parentId) {
          const parent = await apiGet<Topic>(
            `/topics/${parentId}`,
            accessToken,
          );
          chain.unshift(parent);
          parentId = parent.parent_topic_id;
        }
        setAncestors(chain);

        // 4. Check for subtopics (children of current topic)
        const children = await apiGet<Topic[]>(
          `/topics?parent_topic_id=${topicId}`,
          accessToken,
        );

        if (children.length > 0) {
          // This topic has subtopics — show them
          setSubtopics(children);
          setContentMode("subtopics");
        } else {
          // Leaf topic — load lessons and progress
          setContentMode("lessons");

          const lessonsData = await apiGet<Lesson[]>(
            `/topics/${topicId}/lessons`,
            accessToken,
          );
          setLessons(lessonsData);

          try {
            const prog = await apiGet<LessonProgress[]>(
              `/topics/${topicId}/progress`,
              accessToken,
            );
            const map: Record<string, boolean> = {};
            for (const p of prog) {
              map[p.lesson_id] = p.completed;
            }
            setProgressMap(map);
          } catch {
            // progress endpoint may not be available yet
          }
        }
      } catch {
        setLoadError(true);
        setContentMode("lessons");
      }
    })();
  }, [accessToken, profile, topicId, code]);

  if (isLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="mb-8">
            <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          </div>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  const userName = profile.full_name ?? user.email.split("@")[0];
  const userRole = user.role ?? "student";
  const completedCount = Object.values(progressMap).filter(Boolean).length;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-400">
          <Link href="/subjects" className="transition-colors hover:text-blue-600">
            Предметы
          </Link>
          <span>/</span>
          <Link
            href={`/subjects/${code}`}
            className="transition-colors hover:text-blue-600"
          >
            {subject?.name_ru ?? code}
          </Link>
          {ancestors.map((a) => (
            <span key={a.id} className="contents">
              <span>/</span>
              <Link
                href={`/subjects/${code}/${a.id}`}
                className="transition-colors hover:text-blue-600"
              >
                {a.title_ru}
              </Link>
            </span>
          ))}
          <span>/</span>
          <span className="font-medium text-slate-700">
            {topic?.title_ru ?? "..."}
          </span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {topic?.title_ru ?? "Загрузка..."}
          </h1>
          {contentMode === "subtopics" && subtopics.length > 0 && (
            <p className="mt-1 text-sm text-slate-500">
              {subtopics.length}{" "}
              {subtopics.length === 1
                ? "подтема"
                : subtopics.length < 5
                  ? "подтемы"
                  : "подтем"}
            </p>
          )}
          {contentMode === "lessons" && lessons.length > 0 && (
            <p className="mt-1 text-sm text-slate-500">
              Пройдено {completedCount} из {lessons.length} уроков
            </p>
          )}
        </div>

        {/* Progress bar (only for lessons mode) */}
        {contentMode === "lessons" && lessons.length > 0 && (
          <div className="mb-8">
            <div className="h-2 w-full overflow-hidden rounded-full bg-gray-100">
              <div
                className="h-2 rounded-full bg-blue-600 transition-all duration-500"
                style={{
                  width: `${Math.round((completedCount / lessons.length) * 100)}%`,
                }}
              />
            </div>
          </div>
        )}

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            Не удалось загрузить данные. Попробуйте обновить страницу.
          </div>
        )}

        {/* ====== Subtopics mode ====== */}
        {contentMode === "subtopics" && (
          subtopics.length > 0 ? (
            <div className="space-y-3">
              {subtopics.map((st, idx) => (
                <Link
                  key={st.id}
                  href={`/subjects/${code}/${st.id}`}
                  className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-6 py-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                >
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-indigo-50 text-sm font-bold text-indigo-600">
                    {idx + 1}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700">
                      {st.title_ru}
                    </h3>
                    {st.grade_level != null && (
                      <p className="mt-0.5 text-xs text-slate-400">
                        {st.grade_level} класс
                      </p>
                    )}
                  </div>
                  <svg
                    className="h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-blue-500"
                    fill="none"
                    viewBox="0 0 24 24"
                    strokeWidth={1.5}
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="m8.25 4.5 7.5 7.5-7.5 7.5"
                    />
                  </svg>
                </Link>
              ))}
            </div>
          ) : null
        )}

        {/* ====== Lessons mode ====== */}
        {contentMode === "lessons" && (
          lessons.length > 0 ? (
            <div className="space-y-3">
              {lessons.map((l, idx) => {
                const done = progressMap[l.id];
                return (
                  <Link
                    key={l.id}
                    href={`/subjects/${code}/${topicId}/${l.id}`}
                    className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-6 py-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
                  >
                    <div
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl text-sm font-bold ${
                        done
                          ? "bg-emerald-50 text-emerald-600"
                          : "bg-blue-50 text-blue-600"
                      }`}
                    >
                      {done ? (
                        <svg
                          className="h-5 w-5"
                          fill="none"
                          viewBox="0 0 24 24"
                          strokeWidth={2}
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            d="m4.5 12.75 6 6 9-13.5"
                          />
                        </svg>
                      ) : (
                        idx + 1
                      )}
                    </div>
                    <div className="min-w-0 flex-1">
                      <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700">
                        {l.title}
                      </h3>
                      <p className="mt-0.5 text-xs text-slate-400">
                        Урок {idx + 1}
                        {done && (
                          <span className="ml-2 text-emerald-500">Пройден</span>
                        )}
                      </p>
                    </div>
                    <svg
                      className="h-5 w-5 shrink-0 text-slate-300 transition-colors group-hover:text-blue-500"
                      fill="none"
                      viewBox="0 0 24 24"
                      strokeWidth={1.5}
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="m8.25 4.5 7.5 7.5-7.5 7.5"
                      />
                    </svg>
                  </Link>
                );
              })}
            </div>
          ) : (
            !loadError && (
              <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 text-center">
                <svg
                  className="mb-4 h-12 w-12 text-slate-300"
                  fill="none"
                  viewBox="0 0 24 24"
                  strokeWidth={1.5}
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                  />
                </svg>
                <p className="text-sm text-slate-400">
                  Уроки для этой темы ещё не добавлены
                </p>
              </div>
            )
          )
        )}

        {/* Loading skeleton while determining mode */}
        {contentMode === "loading" && !loadError && (
          <div className="space-y-3">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-20 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

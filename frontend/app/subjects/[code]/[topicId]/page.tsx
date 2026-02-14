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
  title_ru: string;
};

type Problem = {
  id: string;
  type: string;
  difficulty: string;
  title: string;
  statement: string;
  points: number;
};

type ProfileResponse = {
  full_name: string | null;
  [key: string]: unknown;
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

export default function TopicDetailPage() {
  const { code, topicId } = useParams<{ code: string; topicId: string }>();
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        setLoadError("Не удалось загрузить профиль.");
      }
    })();
  }, [accessToken, user, router]);

  useEffect(() => {
    if (!accessToken || !profile || !topicId || !code) return;

    (async () => {
      try {
        const subjects = await apiGet<Subject[]>("/subjects", accessToken);
        const foundSubject = subjects.find((s) => s.code === code) ?? null;
        setSubject(foundSubject);

        const loadedTopic = await apiGet<Topic>(`/topics/${topicId}`, accessToken);
        setTopic(loadedTopic);

        const loadedProblems = await apiGet<Problem[]>(
          `/problems?topic_id=${topicId}`,
          accessToken,
        );
        setProblems(loadedProblems);
      } catch {
        setLoadError("Не удалось загрузить тему и задачи.");
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
      </div>
    );
  }

  const userName = profile.full_name ?? user.email.split("@")[0];
  const userRole = user.role ?? "student";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
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
          <span>/</span>
          <span className="font-medium text-slate-700">
            {topic?.title_ru ?? "Тема"}
          </span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {topic?.title_ru ?? "Загрузка..."}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Задачи по выбранной теме
          </p>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {loadError}
          </div>
        )}

        {problems.length > 0 ? (
          <div className="space-y-3">
            {problems.map((p, idx) => (
              <Link
                key={p.id}
                href={`/problems/${p.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-6 py-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-600">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700">
                    {p.title}
                  </h3>
                  <p className="mt-1 line-clamp-2 text-xs text-slate-500">
                    {p.statement}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      DIFFICULTY_COLORS[p.difficulty] ??
                      "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {DIFFICULTY_LABELS[p.difficulty] ?? p.difficulty}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {p.points} балл.
                  </span>
                </div>
              </Link>
            ))}
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
                  d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z"
                />
              </svg>
              <p className="text-sm text-slate-400">
                Для этой темы пока нет задач
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
}

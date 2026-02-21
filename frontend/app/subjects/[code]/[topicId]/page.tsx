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

type Lesson = {
  id: string;
  title: string;
  order_no: number;
};

type ProfileResponse = {
  full_name: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
};

export default function TopicDetailPage() {
  const { code, topicId } = useParams<{ code: string; topicId: string }>();
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topic, setTopic] = useState<Topic | null>(null);
  const [noLessons, setNoLessons] = useState(false);
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
        setNoLessons(false);
        const subjects = await apiGet<Subject[]>("/subjects", accessToken);
        const foundSubject = subjects.find((s) => s.code === code) ?? null;
        setSubject(foundSubject);

        const loadedTopic = await apiGet<Topic>(`/topics/${topicId}`, accessToken);
        setTopic(loadedTopic);

        const lessons = await apiGet<Lesson[]>(
          `/topics/${topicId}/lessons`,
          accessToken,
        );
        if (lessons.length > 0) {
          router.replace(`/subjects/${code}/${topicId}/${lessons[0].id}`);
          return;
        }
        setNoLessons(true);
      } catch {
        setLoadError("Не удалось открыть тему.");
      }
    })();
  }, [accessToken, profile, topicId, code, router]);

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
            Открываем лекцию...
          </p>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {loadError}
          </div>
        )}

        {!loadError && !noLessons && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 text-center">
            <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
            <p className="mt-3 text-sm text-slate-500">
              Переходим к лекции темы
            </p>
          </div>
        )}

        {!loadError && noLessons && (
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
                d="M3.75 6A2.25 2.25 0 0 1 6 3.75h12A2.25 2.25 0 0 1 20.25 6v12A2.25 2.25 0 0 1 18 20.25H6A2.25 2.25 0 0 1 3.75 18V6Zm3.75 3h9m-9 3h9m-9 3h5.25"
              />
            </svg>
            <p className="text-sm text-slate-400">
              Для этой темы пока нет лекций
            </p>
          </div>
        )}
      </main>
    </div>
  );
}

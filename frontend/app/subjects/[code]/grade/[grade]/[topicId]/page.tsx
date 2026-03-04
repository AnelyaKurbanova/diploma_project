'use client';

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useLesson, useLessonsForTopic, useProfile, useSubjectGrades, useSubjects, useTopic } from "@/lib/swr-hooks";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

type Subject = { id: string; code: string; name_ru: string };
type Topic = { id: string; title_ru: string };
type Lesson = { id: string; title: string; order_no: number };

export default function TopicLessonsByGradePage() {
  const { code, grade, topicId } = useParams<{
    code: string;
    grade: string;
    topicId: string;
  }>();
  const numericGrade = Number.parseInt(grade, 10);

  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const { profile, error: profileError } = useProfile();
  const { subjects } = useSubjects();
  const { topic } = useTopic(topicId ?? null) as { topic: Topic | null | undefined };

  // Для валидации того, что такой grade вообще есть у предмета
  const { grades } = useSubjectGrades(code ?? null);

  const { lessons, error: lessonsError } = useLessonsForTopic(topicId ?? null, false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/auth");
  }, [isLoading, user, router]);

  // После загрузки уроков перенаправляем на первый опубликованный урок темы.
  useEffect(() => {
    if (!accessToken || !user || !topicId || !code || !grade) return;
    if (!lessons || lessons.length === 0) return;

    const sorted = [...lessons].sort((a, b) => a.order_no - b.order_no);
    const first = sorted[0];
    if (!first) return;

    router.replace(`/subjects/${code}/grade/${grade}/${topicId}/${first.id}`);
  }, [accessToken, user, lessons, topicId, code, grade, router]);

  useEffect(() => {
    if (profileError && (profileError as { status?: number }).status === 404) {
      router.replace("/onboarding");
    }
  }, [profileError, router]);

  const subject: Subject | null = subjects.find((s: Subject) => s.code === code) ?? null;
  const loadError = !!profileError || !!lessonsError;

  // Пока идёт редирект или загрузка, показываем skeleton-экран.
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
            <div className="h-8 w-64 animate-pulse rounded bg-gray-200" />
            <div className="mt-2 h-4 w-80 animate-pulse rounded bg-gray-100" />
          </div>
          <div className="space-y-4">
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

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader
        userName={userName}
        userRole={userRole}
        avatarUrl={profile.avatar_url ?? null}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <nav className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-400 animate-page-in">
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
          <Link
            href={`/subjects/${code}/grade/${grade}`}
            className="transition-colors hover:text-blue-600"
          >
            {Number.isFinite(numericGrade) ? `${numericGrade} класс` : "Класс"}
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-700">
            {topic?.title_ru ?? "Тема"}
          </span>
        </nav>

        <div className="mb-8 animate-page-in animate-stagger-1">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Уроки по теме «{topic?.title_ru ?? "..." }»
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Перенаправляем к первому уроку темы...
          </p>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            Не удалось загрузить уроки. Попробуйте обновить страницу.
          </div>
        )}
        {/* Список уроков больше не показываем, эта страница только перенаправляет. */}
      </main>
    </div>
  );
}


'use client';

import { useEffect } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { useProfile, useSubjects, useTopicsForSubjectGrade } from "@/lib/swr-hooks";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

type Subject = { id: string; code: string; name_ru: string };
type Topic = { id: string; title_ru: string };

export default function SubjectGradePage() {
  const { code, grade } = useParams<{ code: string; grade: string }>();
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const { profile, error: profileError } = useProfile();
  const { subjects } = useSubjects();
  const numericGrade = Number.parseInt(grade, 10);
  const { topics, error: topicsError } = useTopicsForSubjectGrade(
    code ?? null,
    Number.isFinite(numericGrade) ? numericGrade : null,
  );

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth");
    }
  }, [isLoading, user, router]);

  // Как только загрузились темы, сразу переходим на первую тему,
  // где уже произойдёт редирект на первый урок и откроется страница курса.
  useEffect(() => {
    if (!code || !grade) return;
    if (!topics || topics.length === 0) return;

    const firstTopic = topics[0];
    if (!firstTopic) return;

    router.replace(`/subjects/${code}/grade/${grade}/${firstTopic.id}`);
  }, [code, grade, topics, router]);

  useEffect(() => {
    if (profileError && (profileError as { status?: number }).status === 404) {
      router.replace("/onboarding");
    }
  }, [profileError, router]);

  const subject: Subject | null =
    subjects.find((s: Subject) => s.code === code) ?? null;
  const loadError = !!profileError || !!topicsError;

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
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-400 animate-page-in">
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
            {Number.isFinite(numericGrade) ? `${numericGrade} класс` : "Класс"}
          </span>
        </nav>

        <div className="mb-8 animate-page-in animate-stagger-1">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {subject?.name_ru ?? "Предмет"} —{" "}
            {Number.isFinite(numericGrade) ? `${numericGrade} класс` : ""}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Открываем курс для этого класса...
          </p>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            Не удалось загрузить темы. Попробуйте обновить страницу.
          </div>
        )}

        {/* Список тем больше не показываем — эта страница только перенаправляет к плееру курса. */}
      </main>
    </div>
  );
}


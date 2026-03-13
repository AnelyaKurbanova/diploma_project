'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { useSubjectGrades } from "@/lib/swr-hooks";

type Subject = {
  id: string;
  code: string;
  name_ru: string;
  topic_count: number;
};

type ProfileResponse = {
  full_name: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
};

export default function SubjectDetailPage() {
  const { code } = useParams<{ code: string }>();
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [loadError, setLoadError] = useState(false);

  const { grades, error: gradesError } = useSubjectGrades(code ?? null);

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
        setLoadError(true);
      }
    })();
  }, [accessToken, user, router]);

  useEffect(() => {
    if (!accessToken || !profile || !code) return;
    (async () => {
      try {
        // Find subject by code from the list
        const subjects = await apiGet<Subject[]>("/subjects", accessToken);
        const found = subjects.find((s) => s.code === code);
        if (!found) {
          setLoadError(true);
          return;
        }
        setSubject(found);
      } catch {
        setLoadError(true);
      }
    })();
  }, [accessToken, profile, code]);

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
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={profile.avatar_url ?? null} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-400 animate-page-in">
          <Link href="/subjects" className="transition-colors hover:text-blue-600">
            Предметы
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-700">
            {subject?.name_ru ?? code}
          </span>
        </nav>

        <div className="mb-8 animate-page-in animate-stagger-1">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {subject?.name_ru ?? "Загрузка..."}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Выберите класс, чтобы посмотреть темы и уроки по этому предмету.
          </p>
        </div>

        {(loadError || gradesError) && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            Не удалось загрузить данные. Попробуйте обновить страницу.
          </div>
        )}

        {grades.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {grades.map((g, idx) => (
              <Link
                key={g}
                href={`/subjects/${code}/grade/${g}`}
                className="group flex flex-col justify-between rounded-2xl border border-gray-100 bg-white p-5 transition-all duration-300 hover:-translate-y-1 hover:border-blue-100 hover:shadow-xl animate-page-in"
                style={{ animationDelay: `${Math.min(idx * 0.06, 0.4)}s` }}
              >
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
                    Класс
                  </p>
                  <h2 className="mt-2 text-xl font-extrabold text-slate-900 group-hover:text-blue-700">
                    {g} класс
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    Темы и уроки по предмету для {g} класса.
                  </p>
                </div>
                <div className="mt-4 flex items-center justify-between text-sm font-medium text-blue-600">
                  <span>Перейти к темам</span>
                  <svg
                    className="h-4 w-4 text-blue-400 transition-transform group-hover:translate-x-1"
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
                </div>
              </Link>
            ))}
          </div>
        ) : (
          !loadError &&
          !gradesError && (
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
                  d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
                />
              </svg>
              <p className="text-sm text-slate-400">
                Для этого предмета пока нет уроков с привязкой к классам
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
}

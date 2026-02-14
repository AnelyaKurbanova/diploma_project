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
  description_ru: string | null;
  topic_count: number;
};

type Topic = {
  id: string;
  subject_id: string;
  parent_topic_id: string | null;
  title_ru: string;
  grade_level: number | null;
  order_no: number;
};

type ProfileResponse = {
  full_name: string | null;
  [key: string]: unknown;
};

export default function SubjectDetailPage() {
  const { code } = useParams<{ code: string }>();
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [subject, setSubject] = useState<Subject | null>(null);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [loadError, setLoadError] = useState(false);

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

        // Load root-level topics for this subject
        const topicsData = await apiGet<Topic[]>(
          `/topics?subject_id=${found.id}`,
          accessToken,
        );
        // Flat topic list for simplified flow: subject -> topic -> tasks
        setTopics(topicsData);
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
      <DashboardHeader userName={userName} userRole={userRole} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        {/* Breadcrumb */}
        <nav className="mb-6 flex items-center gap-2 text-sm text-slate-400">
          <Link href="/subjects" className="transition-colors hover:text-blue-600">
            Предметы
          </Link>
          <span>/</span>
          <span className="font-medium text-slate-700">
            {subject?.name_ru ?? code}
          </span>
        </nav>

        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            {subject?.name_ru ?? "Загрузка..."}
          </h1>
          {subject?.description_ru && (
            <p className="mt-1 text-sm text-slate-500">{subject.description_ru}</p>
          )}
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            Не удалось загрузить данные. Попробуйте обновить страницу.
          </div>
        )}

        {topics.length > 0 ? (
          <div className="space-y-3">
            {topics.map((t, idx) => (
              <Link
                key={t.id}
                href={`/subjects/${code}/${t.id}`}
                className="group flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-6 py-5 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-50 text-sm font-bold text-blue-600">
                  {idx + 1}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900 group-hover:text-blue-700">
                    {t.title_ru}
                  </h3>
                  {t.grade_level != null && (
                    <p className="mt-0.5 text-xs text-slate-400">
                      {t.grade_level} класс
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
                  d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z"
                />
              </svg>
              <p className="text-sm text-slate-400">
                Темы для этого предмета ещё не добавлены
              </p>
            </div>
          )
        )}
      </main>
    </div>
  );
}

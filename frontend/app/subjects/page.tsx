'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { SubjectCard } from "@/components/ui/subject-card";

type Subject = {
  id: string;
  code: string;
  name_ru: string;
  description_ru: string | null;
  topic_count: number;
};

type ProfileResponse = {
  full_name: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
};

export default function SubjectsPage() {
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [subjects, setSubjects] = useState<Subject[]>([]);
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
    if (!accessToken || !profile) return;
    (async () => {
      try {
        const data = await apiGet<Subject[]>("/subjects", accessToken);
        setSubjects(data);
      } catch {
        setLoadError(true);
      }
    })();
  }, [accessToken, profile]);

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
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="h-44 animate-pulse rounded-2xl bg-white" />
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
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Предметы
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Выберите предмет для изучения и просмотра тем
          </p>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            Не удалось загрузить предметы. Попробуйте обновить страницу.
          </div>
        )}

        {subjects.length > 0 ? (
          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {subjects.map((s) => (
              <SubjectCard
                key={s.id}
                code={s.code}
                name={s.name_ru}
                description={s.description_ru}
                topicCount={s.topic_count}
                href={`/subjects/${s.code}`}
              />
            ))}
          </div>
        ) : (
          !loadError && (
            <div className="flex flex-col items-center justify-center rounded-2xl border border-gray-100 bg-white py-16 text-center">
              <svg className="mb-4 h-12 w-12 text-slate-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
              </svg>
              <p className="text-sm text-slate-400">Предметы пока не добавлены</p>
            </div>
          )
        )}
      </main>
    </div>
  );
}

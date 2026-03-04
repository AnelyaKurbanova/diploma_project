'use client';

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  apiGet,
  apiGetStudentAssessmentDetail,
  type StudentAssessmentDetail,
} from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { buttonClasses } from "@/components/ui/button";

type ProfileResponse = {
  full_name: string | null;
  role?: string;
  avatar_url?: string | null;
  onboarding_completed_at: string | null;
  [key: string]: unknown;
};

type SubmissionProgress = {
  has_attempt: boolean;
  last_status: "pending" | "graded" | "needs_review" | null;
  last_is_correct: boolean | null;
};

export default function AssessmentPage() {
  const { assessmentId } = useParams<{ assessmentId: string }>();
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [assessment, setAssessment] = useState<StudentAssessmentDetail | null>(null);
  const [progressByProblem, setProgressByProblem] = useState<Record<string, SubmissionProgress>>({});
  const [loadError, setLoadError] = useState<string | null>(null);
  const [pageLoading, setPageLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!user || !accessToken) {
      router.replace("/auth");
    }
  }, [isLoading, user, accessToken, router]);

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
    if (!accessToken || !profile || !assessmentId) return;
    (async () => {
      setPageLoading(true);
      setLoadError(null);
      try {
        const data = await apiGetStudentAssessmentDetail(assessmentId, accessToken);
        setAssessment(data);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          setLoadError("Контрольная не найдена или недоступна.");
        } else {
          setLoadError("Не удалось загрузить контрольную.");
        }
      } finally {
        setPageLoading(false);
      }
    })();
  }, [accessToken, profile, assessmentId]);

  useEffect(() => {
    if (!accessToken || !assessment) return;
    const ids = assessment.items.map((i) => i.problem_id).join(",");
    if (!ids) return;
    (async () => {
      try {
        const res = await apiGet<{ items: Array<SubmissionProgress & { problem_id: string }> }>(
          `/submissions/last?problem_ids=${encodeURIComponent(ids)}&assessment_id=${encodeURIComponent(assessment.id)}`,
          accessToken,
        );
        const map: Record<string, SubmissionProgress> = {};
        for (const item of res.items ?? []) {
          const { problem_id, ...rest } = item;
          map[problem_id] = rest;
        }
        setProgressByProblem(map);
      } catch {
        setProgressByProblem({});
      }
    })();
  }, [accessToken, assessment]);

  const completion = useMemo(() => {
    if (!assessment || assessment.items.length === 0) return 0;
    const solved = assessment.items.filter((item) => {
      const p = progressByProblem[item.problem_id];
      return p?.last_status === "graded" && p?.last_is_correct === true;
    }).length;
    return Math.round((solved / assessment.items.length) * 100);
  }, [assessment, progressByProblem]);

  const isExpired = Boolean(
    assessment?.due_at && new Date(assessment.due_at).getTime() < Date.now(),
  );

  if (isLoading || !user || !accessToken || !profile || pageLoading) {
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

  const userName = profile.full_name ?? user.email.split("@")[0] ?? "";
  const userRole = profile.role ?? user.role ?? "student";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_#e0e7ff_0%,_#f8fafc_40%,_#f1f5f9_100%)] text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={profile.avatar_url ?? null} />
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        <div className="mb-6 overflow-hidden rounded-3xl border border-indigo-100/70 bg-gradient-to-r from-indigo-600 via-blue-600 to-cyan-600 p-6 text-white shadow-[0_20px_45px_-25px_rgba(37,99,235,0.85)]">
          <button
            type="button"
            onClick={() => router.push("/dashboard")}
            className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/25 hover:text-white"
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
              <path d="m15 18-6-6 6-6" />
            </svg>
            Назад на dashboard
          </button>
          <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
            {assessment?.title ?? "Контрольная"}
          </h1>
          <p className="mt-1 text-sm text-blue-100">
            {assessment?.class_name ?? "Класс"} · {assessment?.items_count ?? 0} задач · {assessment?.total_points ?? 0} баллов
          </p>
        </div>

        {loadError && (
          <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {loadError}
          </div>
        )}

        {assessment && (
          <>
            <section className="mb-6 rounded-2xl border border-gray-100 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
              {isExpired && (
                <div className="mb-3 rounded-lg bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">
                  Дедлайн истек. Отправка новых решений недоступна.
                </div>
              )}
              {assessment.description && (
                <p className="text-sm text-slate-600">{assessment.description}</p>
              )}
              <div className="mt-3 grid gap-3 sm:grid-cols-3">
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Дедлайн: {assessment.due_at ? new Date(assessment.due_at).toLocaleString("ru-RU") : "без дедлайна"}
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Лимит: {assessment.time_limit_min ? `${assessment.time_limit_min} мин` : "без лимита"}
                </div>
                <div className="rounded-xl border border-slate-100 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                  Выполнено: {completion}%
                </div>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
              <h2 className="mb-3 text-base font-bold text-slate-900">Задания контрольной</h2>
              <div className="space-y-3">
                {assessment.items.map((item, idx) => {
                  const p = progressByProblem[item.problem_id];
                  const isSolved = p?.last_status === "graded" && p?.last_is_correct === true;
                  return (
                    <div key={item.id} className="flex items-center justify-between rounded-xl border border-slate-200/80 bg-gradient-to-r from-white to-slate-50 px-4 py-3 shadow-[0_8px_20px_-20px_rgba(15,23,42,0.7)]">
                      <div className="min-w-0 pr-3">
                        <p className="truncate text-sm font-semibold text-slate-900">
                          {idx + 1}. {item.problem_title ?? `Задача ${idx + 1}`}
                        </p>
                        <p className="mt-1 text-xs text-slate-500">
                          {item.points} балл(ов) {isSolved ? "· решена" : ""}
                        </p>
                      </div>
                      <Link
                        href={`/problems/${item.problem_id}?assessmentId=${assessment.id}`}
                        onClick={(e) => {
                          if (isExpired) e.preventDefault();
                        }}
                        className={buttonClasses({
                          variant: isSolved ? "outline" : "primary",
                          size: "sm",
                          className: isExpired ? "pointer-events-none opacity-50" : "",
                        })}
                      >
                        {isExpired ? "Дедлайн истек" : isSolved ? "Открыть" : "Решить"}
                      </Link>
                    </div>
                  );
                })}
              </div>
            </section>
          </>
        )}
      </main>
    </div>
  );
}

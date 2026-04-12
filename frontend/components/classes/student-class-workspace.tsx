'use client';

import Link from "next/link";
import { useRouter } from "next/navigation";
import type { StudentClassWorkspace } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

type ProfileResponse = {
  full_name: string | null;
  role?: string;
  avatar_url?: string | null;
};

type Props = {
  workspace: StudentClassWorkspace;
  profile: ProfileResponse;
  userEmail: string;
};

export function StudentClassWorkspaceView({ workspace, profile, userEmail }: Props) {
  const router = useRouter();
  const userName = profile.full_name ?? userEmail.split("@")[0] ?? "Ученик";
  const userRole = profile.role ?? "student";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_#f8fafc_38%,_#f1f5f9_100%)] text-[#0f2d51]">
      <DashboardHeader
        userName={userName}
        userRole={userRole}
        avatarUrl={profile.avatar_url ?? null}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 overflow-hidden rounded-3xl border border-cyan-100/70 bg-gradient-to-r from-cyan-600 to-blue-700 p-6 text-white shadow-[0_20px_45px_-25px_rgba(8,145,178,0.85)]">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <button
                type="button"
                onClick={() => router.push("/dashboard")}
                className="mb-3 inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1.5 text-sm font-medium text-white/90 transition-colors hover:bg-white/25 hover:text-white"
              >
                <svg
                  className="h-4 w-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="m15 18-6-6 6-6" />
                </svg>
                Назад на главную
              </button>
              <h1 className="text-2xl font-extrabold text-white sm:text-3xl">{workspace.name}</h1>
              <p className="mt-1 text-sm text-cyan-100">
                Учитель: {workspace.teacher_name ?? "—"}
              </p>
              <p className="mt-2 text-xs text-cyan-100/90">
                В классе с{" "}
                {new Date(workspace.joined_at).toLocaleDateString("ru-RU", {
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                })}
              </p>
            </div>
            <div className="rounded-2xl border border-white/30 bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-cyan-100">
                Общий прогресс
              </p>
              <p className="mt-1 text-2xl font-extrabold text-white">
                {workspace.overall_progress ?? 0}%
              </p>
            </div>
          </div>
        </div>

        <section className="rounded-2xl border border-gray-100 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
          <h2 className="mb-1 text-base font-bold text-slate-900">Контрольные работы</h2>
          <p className="mb-4 text-xs text-slate-400">
            Задания от учителя по этому классу. Новые контрольные появляются здесь и приходят в
            уведомления.
          </p>

          {workspace.assessments.length === 0 ? (
            <p className="py-4 text-sm text-slate-400">Пока нет опубликованных контрольных.</p>
          ) : (
            <ul className="space-y-3">
              {workspace.assessments.map((a) => (
                <li key={a.id}>
                  <Link
                    href={`/assessments/${a.id}`}
                    className="block rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white to-slate-50 px-4 py-4 shadow-[0_8px_20px_-20px_rgba(15,23,42,0.7)] transition-all hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md"
                  >
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                      <span className="text-xs text-slate-500">
                        {a.items_count} задач · {a.total_points} баллов
                      </span>
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      {a.due_at
                        ? `Дедлайн: ${new Date(a.due_at).toLocaleString("ru-RU")}`
                        : "Без дедлайна"}
                    </p>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>
    </div>
  );
}

'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";

import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { useAuth } from "@/lib/auth-context";
import { useLeaderboard, useProfile } from "@/lib/swr-hooks";
import type { LeaderboardEntry, LeaderboardMetric } from "@/lib/api";

const METRIC_OPTIONS: Array<{
  value: LeaderboardMetric;
  label: string;
  description: string;
}> = [
  {
    value: "xp",
    label: "Опыт",
    description: "Суммарный опыт за задачи и уроки",
  },
  {
    value: "solved_problems",
    label: "Задачи",
    description: "Количество уникально решённых задач",
  },
  {
    value: "streak",
    label: "Стрик",
    description: "Текущая серия активных дней",
  },
];

function metricValueLabel(metric: LeaderboardMetric, score: number) {
  if (metric === "xp") {
    return `${score.toLocaleString("ru-RU")} XP`;
  }
  if (metric === "solved_problems") {
    return `${score.toLocaleString("ru-RU")} задач`;
  }
  return `${score.toLocaleString("ru-RU")} дней`;
}

function PodiumCard({
  entry,
  metric,
  place,
}: {
  entry: LeaderboardEntry;
  metric: LeaderboardMetric;
  place: number;
}) {
  const avatarSrc = entry.avatar_url || "/images/default-avatar.png";
  const accentClass =
    place === 1
      ? "border-amber-200 bg-amber-50/70"
      : place === 2
        ? "border-slate-200 bg-slate-50"
        : "border-orange-200 bg-orange-50/70";

  return (
    <article className={`rounded-2xl border p-5 ${accentClass}`}>
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-slate-400">
            #{entry.rank}
          </p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">
            {entry.display_name}
          </h3>
          <p className="mt-1 text-sm text-slate-500">
            {entry.city || "Город не указан"}
          </p>
        </div>
        <div className="rounded-full bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 shadow-sm">
          {place} место
        </div>
      </div>

      <div className="mt-4 flex items-center gap-3">
        {}
        <img
          src={avatarSrc}
          alt={entry.display_name}
          className="h-14 w-14 rounded-2xl border border-white object-cover shadow-sm"
        />
        <div>
          <p className="text-2xl font-extrabold text-slate-900">
            {metricValueLabel(metric, entry.score)}
          </p>
          {entry.is_me ? (
            <p className="text-sm font-medium text-blue-600">Это вы</p>
          ) : null}
        </div>
      </div>
    </article>
  );
}

export default function LeaderboardPage() {
  const router = useRouter();
  const { user, isLoading } = useAuth();
  const { profile } = useProfile();
  const [metric, setMetric] = useState<LeaderboardMetric>("xp");
  const { leaderboard, isLoading: leaderboardLoading, error } = useLeaderboard(metric, 20);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth");
    }
  }, [isLoading, router, user]);

  const userName = profile?.full_name ?? user?.email.split("@")[0] ?? "";
  const userRole = user?.role ?? "student";
  const avatarUrl =
    typeof profile?.avatar_url === "string" ? profile.avatar_url : null;

  const topThree = useMemo(() => leaderboard.items.slice(0, 3), [leaderboard.items]);
  const rest = useMemo(() => leaderboard.items.slice(3), [leaderboard.items]);
  const activeMetricMeta =
    METRIC_OPTIONS.find((item) => item.value === metric) ?? METRIC_OPTIONS[0];

  if (isLoading || !user) {
    return <div className="min-h-screen bg-[#f8fafc]" />;
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-[#0f2d51]">
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={avatarUrl} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <section className="rounded-3xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-6 lg:flex-row lg:items-end lg:justify-between">
            <div>
              <p className="text-xs font-medium uppercase tracking-[0.24em] text-[#5081ba]">
                Leaderboard
              </p>
              <h1 className="mt-2 text-3xl font-extrabold text-slate-900">
                Рейтинг учеников
              </h1>
              <p className="mt-2 max-w-2xl text-sm text-slate-500">
                Сравнение по опыту, количеству решённых задач и текущему streak.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              {METRIC_OPTIONS.map((option) => {
                const active = option.value === metric;
                return (
                  <button
                    key={option.value}
                    type="button"
                    onClick={() => setMetric(option.value)}
                    className={`rounded-full px-4 py-2 text-sm font-medium transition ${
                      active
                        ? "bg-[#0f2d51] text-white shadow-sm"
                        : "border border-gray-200 bg-white text-slate-600 hover:border-[#dbeafe] hover:text-[#0f2d51]"
                    }`}
                  >
                    {option.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="mt-6 rounded-2xl bg-slate-50 px-4 py-3 text-sm text-slate-500">
            {activeMetricMeta.description}
          </div>
        </section>

        {leaderboardLoading ? (
          <section className="mt-6 grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={index} className="h-44 animate-pulse rounded-2xl bg-white" />
            ))}
          </section>
        ) : null}

        {!leaderboardLoading && error ? (
          <section className="mt-6 rounded-2xl border border-rose-100 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            Не удалось загрузить рейтинг.
          </section>
        ) : null}

        {!leaderboardLoading && !error && leaderboard.items.length === 0 ? (
          <section className="mt-6 rounded-2xl border border-dashed border-gray-200 bg-white px-5 py-8 text-center text-sm text-slate-500">
            Для этой метрики пока нет данных.
          </section>
        ) : null}

        {!leaderboardLoading && !error && leaderboard.items.length > 0 ? (
          <>
            <section className="mt-6 grid gap-4 lg:grid-cols-3">
              {topThree.map((entry, index) => (
                <PodiumCard
                  key={entry.user_id}
                  entry={entry}
                  metric={metric}
                  place={index + 1}
                />
              ))}
            </section>

            <section className="mt-6 rounded-2xl border border-gray-100 bg-white shadow-sm">
              <div className="border-b border-gray-100 px-5 py-4">
                <h2 className="text-lg font-bold text-slate-900">
                  Общий список
                </h2>
              </div>

              <div className="divide-y divide-gray-100">
                {rest.map((entry) => {
                  const avatarSrc = entry.avatar_url || "/images/default-avatar.png";
                  return (
                    <div
                      key={entry.user_id}
                      className={`flex items-center justify-between gap-4 px-5 py-4 ${
                        entry.is_me ? "bg-[#eff6ff]" : ""
                      }`}
                    >
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-sm font-bold text-slate-600">
                          {entry.rank}
                        </div>
                        {}
                        <img
                          src={avatarSrc}
                          alt={entry.display_name}
                          className="h-11 w-11 shrink-0 rounded-xl border border-slate-200 object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-slate-900">
                            {entry.display_name}
                          </p>
                          <p className="truncate text-xs text-slate-500">
                            {entry.city || "Город не указан"}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="text-sm font-bold text-slate-900">
                          {metricValueLabel(metric, entry.score)}
                        </p>
                        {entry.is_me ? (
                          <p className="text-xs text-[#5081ba]">Вы</p>
                        ) : null}
                      </div>
                    </div>
                  );
                })}
              </div>
            </section>

            {leaderboard.my_entry && !leaderboard.items.some((item) => item.user_id === leaderboard.my_entry?.user_id) ? (
              <section className="mt-6 rounded-2xl border border-[#dbeafe] bg-[#eff6ff] px-5 py-4">
                <p className="text-xs font-medium uppercase tracking-[0.18em] text-[#5081ba]">
                  Ваша позиция
                </p>
                <div className="mt-2 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-lg font-bold text-slate-900">
                      #{leaderboard.my_entry.rank} · {leaderboard.my_entry.display_name}
                    </p>
                    <p className="text-sm text-slate-500">
                      {leaderboard.my_entry.city || "Город не указан"}
                    </p>
                  </div>
                  <p className="text-sm font-bold text-slate-900">
                    {metricValueLabel(metric, leaderboard.my_entry.score)}
                  </p>
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </main>
    </div>
  );
}

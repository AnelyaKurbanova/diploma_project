'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

type MeResponse = {
  id: string;
  email: string;
  role: string;
  is_email_verified: boolean;
  is_active: boolean;
};

type ProfileResponse = {
  full_name: string | null;
  school: string | null;
  city: string | null;
  grade_level: number | null;
  preferred_language: string;
  timezone: string;
};

type DashboardStats = {
  overall_progress: number;
  completed_lectures: number;
  total_lectures: number;
  solved_tasks: number;
  total_tasks: number;
  accuracy: number;
};

type SocialResponse = {
  friends: Array<{
    id: string;
    full_name: string;
    role: "student" | "teacher" | "content_maker" | "moderator" | "admin";
  }>;
  activity: Array<{
    date: string;
    count: number;
  }>;
};

const ROLE_LABELS: Record<string, string> = {
  student: "Ученик",
  teacher: "Учитель",
  admin: "Админ",
  moderator: "Модератор",
  content_maker: "Контент-мейкер",
};

export default function ProfilePage() {
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [social, setSocial] = useState<SocialResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);

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
        const [meData, profileData, statsData, socialData] = await Promise.all([
          apiGet<MeResponse>("/auth/me", accessToken),
          apiGet<ProfileResponse>("/me/profile", accessToken),
          apiGet<DashboardStats>("/me/dashboard", accessToken),
          apiGet<SocialResponse>("/me/social", accessToken),
        ]);
        setMe(meData);
        setProfile(profileData);
        setStats(statsData);
        setSocial(socialData);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Не удалось загрузить профиль");
      }
    })();
  }, [accessToken, user]);

  if (isLoading || !user || !accessToken) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  const userName = profile?.full_name ?? user.email.split("@")[0];
  const userRole = user.role ?? "student";
  const initial = userName.charAt(0).toUpperCase();

  const activityMap = new Map(
    (social?.activity ?? []).map((item) => [item.date, item.count]),
  );
  const activityCells = Array.from({ length: 120 }, (_, idx) => {
    const d = new Date();
    d.setDate(d.getDate() - (119 - idx));
    const key = d.toISOString().slice(0, 10);
    const count = activityMap.get(key) ?? 0;
    if (count <= 0) return 0;
    if (count <= 1) return 1;
    if (count <= 3) return 2;
    return 3;
  });

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <button
            type="button"
            onClick={() => router.back()}
            className="text-sm text-slate-500 hover:text-slate-700"
          >
            ← Назад
          </button>
        </div>

        {loadError && (
          <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {loadError}
          </div>
        )}

        <section className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div className="h-24 bg-[radial-gradient(circle_at_20%_20%,#fff3d4_0%,#f7ecd7_40%,#efe4d2_100%)] sm:h-28" />
          <div className="relative px-4 pb-4 pt-3 sm:px-6">
            <div className="-mt-12 mb-3 flex items-center justify-between gap-3 sm:-mt-14">
              <div className="flex items-end gap-3">
                <div className="flex h-20 w-20 items-center justify-center rounded-2xl border-4 border-white bg-blue-600 text-2xl font-bold text-white shadow-md">
                  {initial}
                </div>
                <div className="pb-1">
                  <h1 className="text-2xl font-extrabold">{userName}</h1>
                  <p className="text-xs font-medium text-blue-600">
                    {me?.role ? ROLE_LABELS[me.role] ?? me.role : "Пользователь"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {profile?.grade_level ? `Ученик ${profile.grade_level} класса` : me?.email || "—"}
                  </p>
                </div>
              </div>
              <Link
                href="/settings"
                className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-gray-50"
              >
                ✎ Редактировать
              </Link>
            </div>
            <p className="text-xs text-slate-400">
              Присоединился недавно · {profile?.city || "Город не указан"}
            </p>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                color="blue"
                icon="◎"
                value={stats?.solved_tasks ?? 0}
                label="Задач выполнено"
              />
              <StatCard
                color="green"
                icon="✿"
                value={`${stats?.overall_progress ?? 0}%`}
                label="Общий прогресс"
              />
              <StatCard
                color="orange"
                icon="🏆"
                value={stats?.completed_lectures ?? 0}
                label="Достижений"
              />
              <StatCard
                color="red"
                icon="🔥"
                value={Math.max(1, Math.round((stats?.accuracy ?? 0) / 12))}
                label="Дней подряд"
              />
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-2xl font-bold">Активность</h2>
              <p className="mb-4 text-xs text-slate-500">
                {(social?.activity ?? []).reduce((acc, x) => acc + x.count, 0)} активностей за последний период
              </p>
              <div className="grid grid-cols-20 gap-1">
                {activityCells.map((level, idx) => (
                  <span
                    key={idx}
                    className={`h-3 w-3 rounded-sm ${
                      level === 0
                        ? "bg-slate-100"
                        : level === 1
                          ? "bg-blue-200"
                          : level === 2
                            ? "bg-blue-400"
                            : "bg-blue-600"
                    }`}
                  />
                ))}
              </div>
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-2xl font-bold">Достижения</h2>
              <div className="grid gap-3 sm:grid-cols-2">
                <AchievementCard
                  title="Первые шаги"
                  subtitle={`Выполнено ${Math.min(5, stats?.solved_tasks ?? 0)} задач`}
                  progress={Math.min(100, ((stats?.solved_tasks ?? 0) / 5) * 100)}
                />
                <AchievementCard
                  title="Ежедневная активность"
                  subtitle={`Серия ${Math.max(1, Math.round((stats?.accuracy ?? 0) / 12))} дней`}
                  progress={Math.min(100, (stats?.accuracy ?? 0) * 1.2)}
                />
                <AchievementCard
                  title="Мастер"
                  subtitle={`Пройдено ${stats?.completed_lectures ?? 0} уроков`}
                  progress={
                    stats?.total_lectures
                      ? Math.min(100, (stats.completed_lectures / stats.total_lectures) * 100)
                      : 0
                  }
                />
                <AchievementCard
                  title="Прогресс"
                  subtitle={`Точность ${stats?.accuracy ?? 0}%`}
                  progress={stats?.accuracy ?? 0}
                />
              </div>
            </section>
          </div>

          <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-2xl font-bold">Друзья</h2>
              <button
                type="button"
                className="rounded-full border border-gray-300 px-3 py-1 text-xs text-slate-600 hover:bg-gray-50"
              >
                + Добавить
              </button>
            </div>
            <div className="space-y-3">
              {(social?.friends ?? []).length > 0 ? (
                (social?.friends ?? []).map((friend) => (
                  <Friend
                    key={friend.id}
                    name={friend.full_name}
                    role={ROLE_LABELS[friend.role] ?? friend.role}
                  />
                ))
              ) : (
                <p className="text-sm text-slate-400">Пока нет друзей</p>
              )}
            </div>
          </aside>
        </div>
      </main>
    </div>
  );
}

function StatCard({
  icon,
  value,
  label,
  color,
}: {
  icon: string;
  value: string | number;
  label: string;
  color: "blue" | "green" | "orange" | "red";
}) {
  const palette: Record<string, string> = {
    blue: "border-blue-500",
    green: "border-green-500",
    orange: "border-orange-500",
    red: "border-red-500",
  };
  return (
    <article className={`rounded-2xl border bg-white p-4 shadow-sm ${palette[color]}`}>
      <p className="text-lg">{icon}</p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
      <p className="mt-1 text-xs text-slate-500">{label}</p>
    </article>
  );
}

function AchievementCard({
  title,
  subtitle,
  progress,
}: {
  title: string;
  subtitle: string;
  progress: number;
}) {
  return (
    <article className="rounded-xl border border-blue-200 bg-blue-50/30 p-3">
      <h3 className="text-lg font-semibold text-slate-900">{title}</h3>
      <p className="mt-1 text-xs text-slate-500">{subtitle}</p>
      <div className="mt-2 h-2 rounded-full bg-slate-200">
        <div
          className="h-2 rounded-full bg-blue-500"
          style={{ width: `${Math.max(0, Math.min(100, progress))}%` }}
        />
      </div>
    </article>
  );
}

function Friend({ name, role }: { name: string; role: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className="flex items-center gap-3 rounded-xl bg-slate-50 px-3 py-2">
      <div className="flex h-9 w-9 items-center justify-center rounded-full bg-amber-200 text-sm font-bold text-slate-700">
        {initial}
      </div>
      <div>
        <p className="text-sm font-semibold text-slate-900">{name}</p>
        <p className="text-xs text-slate-400">{role}</p>
      </div>
    </div>
  );
}

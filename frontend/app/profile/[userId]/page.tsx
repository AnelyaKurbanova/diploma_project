'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

type Friend = {
  id: string;
  full_name: string;
  role: "student" | "teacher" | "content_maker" | "moderator" | "admin";
  avatar_url?: string | null;
};

type PublicProfile = {
  id: string;
  full_name: string;
  role: "student" | "teacher" | "content_maker" | "moderator" | "admin";
  city: string | null;
  avatar_url: string | null;
  grade_level: number | null;
  created_at: string;
  is_friend: boolean;
  friendship_status: "none" | "friends" | "outgoing_request" | "incoming_request";
  friends_count: number;
  stats: {
    overall_progress: number;
    completed_lectures: number;
    total_lectures: number;
    solved_tasks: number;
    total_tasks: number;
    accuracy: number;
  };
  activity: Array<{ date: string; count: number }>;
  friends: Friend[];
};

const ROLE_LABELS: Record<string, string> = {
  student: "Ученик",
  teacher: "Учитель",
  admin: "Админ",
  moderator: "Модератор",
  content_maker: "Контент-мейкер",
};

export default function PublicProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();
  const [data, setData] = useState<PublicProfile | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (isLoading) return;
    if (!user || !accessToken) {
      router.replace("/auth");
    }
  }, [isLoading, user, accessToken, router]);

  useEffect(() => {
    if (!accessToken || !userId) return;
    (async () => {
      try {
        setLoading(true);
        const profile = await apiGet<PublicProfile>(`/me/users/${userId}/profile`, accessToken);
        setData(profile);
        setError(null);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить профиль");
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken, userId]);

  const toggleFriend = async () => {
    if (!accessToken || !data) return;
    setBusy(true);
    setError(null);
    try {
      if (data.friendship_status === "friends") {
        await apiDelete(`/me/friends/${data.id}`, accessToken);
      } else if (data.friendship_status === "outgoing_request") {
        await apiDelete(`/me/friends/requests/${data.id}`, accessToken);
      } else if (data.friendship_status === "incoming_request") {
        await apiPost(`/me/friends/requests/${data.id}/accept`, undefined, accessToken);
      } else {
        await apiPost<{ status: string }>(`/me/friends`, { friend_user_id: data.id }, accessToken);
      }
      const profile = await apiGet<PublicProfile>(`/me/users/${data.id}/profile`, accessToken);
      setData(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при обновлении дружбы");
    } finally {
      setBusy(false);
    }
  };

  const rejectIncoming = async () => {
    if (!accessToken || !data || data.friendship_status !== "incoming_request") return;
    setBusy(true);
    setError(null);
    try {
      await apiPost(`/me/friends/requests/${data.id}/reject`, undefined, accessToken);
      const profile = await apiGet<PublicProfile>(`/me/users/${data.id}/profile`, accessToken);
      setData(profile);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при отклонении заявки");
    } finally {
      setBusy(false);
    }
  };

  if (isLoading || !user || !accessToken || loading) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  if (!data) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <DashboardHeader userName={user.email.split("@")[0]} userRole={user.role ?? "student"} />
        <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          <Link href="/profile" className="text-sm text-slate-500 hover:text-slate-700">
            ← Назад к профилю
          </Link>
          <div className="mt-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error ?? "Профиль не найден"}
          </div>
        </main>
      </div>
    );
  }

  const viewerName = user.email.split("@")[0];
  const viewerRole = user.role ?? "student";
  const avatarSrc = data.avatar_url || "/images/default-avatar.png";

  const activityMap = new Map(data.activity.map((item) => [item.date, item.count]));
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
      <DashboardHeader userName={viewerName} userRole={viewerRole} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <Link href="/profile" className="text-sm text-slate-500 hover:text-slate-700">
            ← Назад к профилю
          </Link>
        </div>

        {error && (
          <div className="mb-4 rounded-lg bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</div>
        )}

        <section className="mb-4 overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
          <div
            className="h-28 bg-cover bg-center sm:h-32"
            style={{ backgroundImage: "url('/images/profile-cover.png')" }}
          />
          <div className="relative px-4 pb-5 pt-5 sm:px-6">
            <div className="-mt-8 mb-3 flex items-end justify-between gap-3 sm:-mt-10">
              <div className="flex items-end gap-3">
                <div className="h-20 w-20 rounded-2xl border-4 border-white bg-white p-1.5 shadow-lg sm:h-24 sm:w-24">
                  <img
                    src={avatarSrc}
                    alt={data.full_name}
                    className="h-full w-full rounded-xl object-cover"
                  />
                </div>
                <div className="pb-1 sm:pb-0">
                  <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl sm:leading-none">{data.full_name}</h1>
                  <p className="text-xs font-medium text-blue-600">
                    {ROLE_LABELS[data.role] ?? data.role}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {data.grade_level ? `Ученик ${data.grade_level} класса` : data.city || "—"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={toggleFriend}
                disabled={busy}
                className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-gray-50 disabled:opacity-50"
              >
                {busy
                  ? "..."
                  : data.friendship_status === "friends"
                    ? "Удалить из друзей"
                    : data.friendship_status === "outgoing_request"
                      ? "Отменить заявку"
                      : data.friendship_status === "incoming_request"
                        ? "Принять заявку"
                        : "Добавить в друзья"}
              </button>
            </div>
            {data.friendship_status === "incoming_request" && (
              <div className="mt-1">
                <button
                  type="button"
                  onClick={rejectIncoming}
                  disabled={busy}
                  className="rounded-full border border-gray-300 bg-white px-3 py-1 text-xs text-slate-700 hover:bg-gray-50 disabled:opacity-50"
                >
                  Отклонить заявку
                </button>
              </div>
            )}
            <p className="text-xs text-slate-400">
              Друзей: {data.friends_count} · {data.city || "Город не указан"}
            </p>
          </div>
        </section>

        <div className="grid gap-4 lg:grid-cols-[2fr_1fr]">
          <div className="space-y-4">
            <section className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                color="blue"
                iconSrc="/icons/stat-progress.png"
                iconAlt="Задачи"
                value={data.stats.solved_tasks}
                label="Задач выполнено"
              />
              <StatCard
                color="green"
                iconSrc="/icons/stat-achievements.png"
                iconAlt="Прогресс"
                value={`${data.stats.overall_progress}%`}
                label="Общий прогресс"
              />
              <StatCard
                color="orange"
                iconSrc="/icons/stat-tasks.png"
                iconAlt="Достижения"
                value={data.stats.completed_lectures}
                label="Достижений"
              />
              <StatCard
                color="red"
                iconSrc="/icons/stat-streak.png"
                iconAlt="Серия"
                value={Math.max(1, Math.round((data.stats.accuracy ?? 0) / 12))}
                label="Дней подряд"
              />
            </section>

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-1 text-xl font-bold">Активность</h2>
              <div className="mb-2 flex justify-end gap-2 text-[10px] text-slate-400">
                <span>Меньше</span>
                <span className="h-2.5 w-2.5 rounded-sm bg-slate-100" />
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-200" />
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-400" />
                <span className="h-2.5 w-2.5 rounded-sm bg-blue-600" />
                <span>Больше</span>
              </div>
              <div className="mt-3 grid grid-cols-20 gap-1">
                {activityCells.map((level, idx) => (
                  <span
                    key={idx}
                    className={`h-3 w-3 rounded-sm ${
                      level === 0 ? "bg-slate-100" : level === 1 ? "bg-blue-200" : level === 2 ? "bg-blue-400" : "bg-blue-600"
                    }`}
                  />
                ))}
              </div>
            </section>
          </div>

          <aside className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">Друзья</h2>
            </div>
            <div className="space-y-3">
              {data.friends.length > 0 ? (
                data.friends.map((friend) => (
                  <Link key={friend.id} href={`/profile/${friend.id}`}>
                    <FriendCard
                      name={friend.full_name}
                      role={ROLE_LABELS[friend.role] ?? friend.role}
                      avatarUrl={friend.avatar_url ?? null}
                    />
                  </Link>
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
  iconSrc,
  iconAlt,
  value,
  label,
  color,
}: {
  iconSrc: string;
  iconAlt: string;
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
    <article className={`aspect-square rounded-2xl border-4 bg-white px-4 py-4 ${palette[color]}`}>
      <div className="grid h-full grid-rows-[40px_1fr_44px] items-center">
        <div className="flex items-center justify-center">
          <img src={iconSrc} alt={iconAlt} className="h-8 w-8 object-contain" />
        </div>
        <p className="text-center text-3xl font-extrabold leading-none text-slate-800 sm:text-4xl">{value}</p>
        <p className="max-w-full text-center text-sm font-medium leading-tight text-slate-500 sm:text-base">
          <span className="line-clamp-2 break-words">{label}</span>
        </p>
      </div>
    </article>
  );
}

function FriendCard({ name, role, avatarUrl }: { name: string; role: string; avatarUrl?: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2">
      <img
        src={avatarUrl || "/images/default-avatar.png"}
        alt={name}
        className="h-9 w-9 rounded-full border border-gray-200 object-cover"
      />
      <div>
        <p className="text-sm font-semibold text-slate-900">{name}</p>
        <p className="text-xs text-slate-400">{role}</p>
      </div>
    </div>
  );
}

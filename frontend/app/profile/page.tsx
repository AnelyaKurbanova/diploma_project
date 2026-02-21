'use client';

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { apiGet, apiPost } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { ActivityHeatmap } from "@/components/profile/activity-heatmap";

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
  avatar_url: string | null;
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
    avatar_url?: string | null;
  }>;
  activity: Array<{
    date: string;
    count: number;
  }>;
  incoming_requests: Array<{
    requester_id: string;
    requester_name: string;
    requester_role: "student" | "teacher" | "content_maker" | "moderator" | "admin";
    created_at: string;
  }>;
  outgoing_request_user_ids: string[];
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
  const [infoMessage, setInfoMessage] = useState<string | null>(null);
  const [friendEmail, setFriendEmail] = useState("");
  const [addingFriend, setAddingFriend] = useState(false);
  const [showAddFriend, setShowAddFriend] = useState(false);

  const loadAll = async (token: string) => {
    const [meData, profileData, statsData, socialData] = await Promise.all([
      apiGet<MeResponse>("/auth/me", token),
      apiGet<ProfileResponse>("/me/profile", token),
      apiGet<DashboardStats>("/me/dashboard", token),
      apiGet<SocialResponse>("/me/social", token),
    ]);
    setMe(meData);
    setProfile(profileData);
    setStats(statsData);
    setSocial(socialData);
  };

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
        await loadAll(accessToken);
      } catch (err) {
        setLoadError(err instanceof Error ? err.message : "Не удалось загрузить профиль");
      }
    })();
  }, [accessToken, user]);

  const handleAddFriend = async () => {
    if (!accessToken) return;
    if (!friendEmail.trim()) return;
    setAddingFriend(true);
    setLoadError(null);
    setInfoMessage(null);
    try {
      const response = await apiPost<{ status: string }>(
        "/me/friends",
        { friend_email: friendEmail.trim() },
        accessToken,
      );
      setFriendEmail("");
      setShowAddFriend(false);
      await loadAll(accessToken);
      if (response.status === "already_friends") {
        setInfoMessage("Вы уже в друзьях");
      } else if (response.status === "already_requested") {
        setInfoMessage("Заявка уже отправлена");
      } else {
        setInfoMessage("Заявка в друзья отправлена");
      }
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Не удалось добавить в друзья");
    } finally {
      setAddingFriend(false);
    }
  };

  const handleAcceptRequest = async (requesterId: string) => {
    if (!accessToken) return;
    setLoadError(null);
    setInfoMessage(null);
    try {
      await apiPost(`/me/friends/requests/${requesterId}/accept`, undefined, accessToken);
      await loadAll(accessToken);
      setInfoMessage("Заявка принята");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Не удалось принять заявку");
    }
  };

  const handleRejectRequest = async (requesterId: string) => {
    if (!accessToken) return;
    setLoadError(null);
    setInfoMessage(null);
    try {
      await apiPost(`/me/friends/requests/${requesterId}/reject`, undefined, accessToken);
      await loadAll(accessToken);
      setInfoMessage("Заявка отклонена");
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Не удалось отклонить заявку");
    }
  };

  if (isLoading || !user || !accessToken) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  const userName = profile?.full_name ?? user.email.split("@")[0];
  const userRole = user.role ?? "student";
  const avatarSrc = profile?.avatar_url || "/images/default-avatar.png";
  const friendsCount = social?.friends?.length ?? 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={avatarSrc} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
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
        {infoMessage && (
          <div className="mb-4 rounded-lg bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {infoMessage}
          </div>
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
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarSrc}
                    alt={userName}
                    className="h-full w-full rounded-xl object-cover"
                  />
                </div>
                <div className="pb-1 sm:pb-0">
                  <h1 className="text-3xl font-extrabold leading-tight sm:text-4xl sm:leading-none">{userName}</h1>
                  <p className="text-xs font-medium text-blue-600">
                    {me?.role ? ROLE_LABELS[me.role] ?? me.role : "Пользователь"}
                  </p>
                  <p className="mt-1 text-sm text-slate-500">
                    {profile?.grade_level ? `Ученик ${profile.grade_level} класса` : me?.email || "—"}
                  </p>
                </div>
              </div>
              <Link href="/settings" className="rounded-full border border-gray-300 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-gray-50">
                ✎ Редактировать
              </Link>
            </div>
            <p className="text-xs text-slate-400">
              Присоединился недавно · {friendsCount} друзей · {profile?.city || "Город не указан"}
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
                value={stats?.solved_tasks ?? 0}
                label="Задач выполнено"
              />
              <StatCard
                color="green"
                iconSrc="/icons/stat-achievements.png"
                iconAlt="Прогресс"
                value={`${stats?.overall_progress ?? 0}%`}
                label="Общий прогресс"
              />
              <StatCard
                color="orange"
                iconSrc="/icons/stat-tasks.png"
                iconAlt="Достижения"
                value={stats?.completed_lectures ?? 0}
                label="Достижений"
              />
              <StatCard
                color="red"
                iconSrc="/icons/stat-streak.png"
                iconAlt="Серия"
                value={Math.max(1, Math.round((stats?.accuracy ?? 0) / 12))}
                label="Дней подряд"
              />
            </section>

            <ActivityHeatmap activity={social?.activity ?? []} />

            <section className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm">
              <h2 className="mb-4 text-xl font-bold">Достижения</h2>
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
            {(social?.incoming_requests?.length ?? 0) > 0 && (
              <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50/50 p-3">
                <h3 className="mb-2 text-sm font-semibold text-amber-800">Входящие заявки</h3>
                <div className="space-y-2">
                  {(social?.incoming_requests ?? []).map((req) => (
                    <div key={req.requester_id} className="rounded-lg bg-white px-3 py-2">
                      <p className="text-sm font-medium text-slate-900">{req.requester_name}</p>
                      <p className="text-xs text-slate-400">
                        {ROLE_LABELS[req.requester_role] ?? req.requester_role}
                      </p>
                      <div className="mt-2 flex gap-2">
                        <button
                          type="button"
                          onClick={() => handleAcceptRequest(req.requester_id)}
                          className="rounded-md bg-emerald-600 px-2 py-1 text-xs font-medium text-white hover:bg-emerald-700"
                        >
                          Принять
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRejectRequest(req.requester_id)}
                          className="rounded-md border border-gray-300 px-2 py-1 text-xs font-medium text-slate-700 hover:bg-gray-50"
                        >
                          Отклонить
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-xl font-bold">Друзья</h2>
              <button
                type="button"
                onClick={() => setShowAddFriend((v) => !v)}
                className="rounded-full border border-gray-300 px-3 py-1 text-xs text-slate-600 hover:bg-gray-50"
              >
                + Добавить
              </button>
            </div>
            {showAddFriend && (
              <div className="mb-3 rounded-xl border border-gray-200 bg-slate-50 p-3">
                <label className="mb-1 block text-xs text-slate-500">Email пользователя</label>
                <div className="flex gap-2">
                  <input
                    type="email"
                    value={friendEmail}
                    onChange={(e) => setFriendEmail(e.target.value)}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                    placeholder="friend@example.com"
                  />
                  <button
                    type="button"
                    onClick={handleAddFriend}
                    disabled={addingFriend}
                    className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50"
                  >
                    {addingFriend ? "..." : "Добавить"}
                  </button>
                </div>
              </div>
            )}
            <div className="space-y-3">
              {(social?.friends ?? []).length > 0 ? (
                (social?.friends ?? []).map((friend) => (
                  <Link key={friend.id} href={`/profile/${friend.id}`}>
                    <Friend
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
          {/* eslint-disable-next-line @next/next/no-img-element */}
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
    <article className="rounded-xl border border-blue-200 bg-white p-3">
      <h3 className="text-base font-semibold text-slate-900">{title}</h3>
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

function Friend({ name, role, avatarUrl }: { name: string; role: string; avatarUrl?: string | null }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-gray-100 bg-white px-3 py-2">
      {/* eslint-disable-next-line @next/next/no-img-element */}
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

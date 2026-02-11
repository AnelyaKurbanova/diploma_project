'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet, apiJoinClassByCode, apiListStudentClasses, type StudentClass } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { StatCard } from "@/components/ui/stat-card";
import { BarChart } from "@/components/ui/bar-chart";
import { DonutChart } from "@/components/ui/donut-chart";
import { SubjectProgressItem } from "@/components/dashboard/subject-progress-item";
import { RecommendationCard } from "@/components/dashboard/recommendation-card";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import { buttonClasses } from "@/components/ui/button";
import Link from "next/link";

type SubjectProgress = {
  code: string;
  name: string;
  mastery: number;
  completed_topics: number;
  total_topics: number;
};

type TaskDistribution = {
  correct: number;
  incorrect: number;
  unsolved: number;
};

type Recommendation = {
  subject_code: string;
  subject_name: string;
  mastery: number;
  message: string;
};

type DashboardStats = {
  overall_progress: number;
  completed_lectures: number;
  total_lectures: number;
  solved_tasks: number;
  total_tasks: number;
  accuracy: number;
  subjects_progress: SubjectProgress[];
  task_distribution: TaskDistribution;
  recommendations: Recommendation[];
};

type ProfileResponse = {
  full_name: string | null;
  onboarding_completed_at: string | null;
  [key: string]: unknown;
};

function TrendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
    </svg>
  );
}

function BookOpenIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function CheckCircleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function TargetIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
    </svg>
  );
}

function LightbulbIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v-5.25m0 0a6.01 6.01 0 0 0 1.5-.189m-1.5.189a6.01 6.01 0 0 1-1.5-.189m3.75 7.478a12.06 12.06 0 0 1-4.5 0m3.75 2.383a14.406 14.406 0 0 1-3 0M14.25 18v-.192c0-.983.658-1.823 1.508-2.316a7.5 7.5 0 1 0-7.517 0c.85.493 1.509 1.333 1.509 2.316V18" />
    </svg>
  );
}

export default function DashboardPage() {
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [studentClasses, setStudentClasses] = useState<StudentClass[]>([]);
  const [classesLoading, setClassesLoading] = useState(false);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

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
        const d = await apiGet<DashboardStats>("/me/dashboard", accessToken);
        setStats(d);
      } catch {
        setLoadError(true);
      }
    })();
  }, [accessToken, profile]);

  // Load classes for students
  useEffect(() => {
    if (!accessToken || !profile || !user || user.role !== "student") return;

    (async () => {
      setClassesLoading(true);
      try {
        const list = await apiListStudentClasses(accessToken);
        setStudentClasses(list);
      } catch {
        // тихо игнорируем, раздел ниже покажет пустой список
        setStudentClasses([]);
      } finally {
        setClassesLoading(false);
      }
    })();
  }, [accessToken, profile, user]);

  const userName = profile?.full_name ?? user?.email.split("@")[0] ?? "";
  const userRole = user?.role ?? "student";
  const isTeacher = userRole === "teacher";

  if (isLoading || !user || !profile || (!isTeacher && !stats && !loadError)) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="h-24 animate-pulse rounded-2xl bg-white" />
            ))}
          </div>
        </main>
      </div>
    );
  }

  if (isTeacher && accessToken) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-900">
        <DashboardHeader userName={userName} userRole={userRole} />
        <TeacherDashboard userName={userName} accessToken={accessToken} />
      </div>
    );
  }

  const barData = (stats?.subjects_progress ?? []).map((s) => ({
    label: s.name,
    value: s.mastery,
  }));

  const donutData = stats
    ? [
        { name: `Правильно: ${stats.task_distribution.correct}`, value: stats.task_distribution.correct, color: "#22c55e" },
        { name: `Неправильно: ${stats.task_distribution.incorrect}`, value: stats.task_distribution.incorrect, color: "#f43f5e" },
        { name: `Не решено: ${stats.task_distribution.unsolved}`, value: stats.task_distribution.unsolved, color: "#e2e8f0" },
      ]
    : [];

  const completedTasks = stats ? stats.task_distribution.correct + stats.task_distribution.incorrect : 0;

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Моя панель управления
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Отслеживайте свой прогресс и достижения
          </p>
        </div>

        <div className="mb-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Общий прогресс"
            value={`${stats?.overall_progress ?? 0}%`}
            icon={<TrendIcon className="h-7 w-7 text-blue-500" />}
          />
          <StatCard
            label="Завершено лекций"
            value={String(stats?.completed_lectures ?? 0)}
            subValue={`из ${stats?.total_lectures ?? 0}`}
            icon={<BookOpenIcon className="h-7 w-7 text-blue-500" />}
          />
          <StatCard
            label="Решено задач"
            value={`${completedTasks}/${stats?.total_tasks ?? 0}`}
            icon={<CheckCircleIcon className="h-7 w-7 text-emerald-500" />}
          />
          <StatCard
            label="Точность"
            value={`${stats?.accuracy ?? 0}%`}
            icon={<TargetIcon className="h-7 w-7 text-rose-500" />}
          />
        </div>

        <div className="mb-8 grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="mb-1 text-base font-bold text-slate-900">
              Уровень освоения по предметам
            </h2>
            <p className="mb-4 text-xs text-slate-400">
              Ваш прогресс в различных предметах
            </p>
            {barData.length > 0 ? (
              <BarChart data={barData} maxValue={100} />
            ) : (
              <div className="flex h-[220px] items-center justify-center text-sm text-slate-400">
                Нет данных
              </div>
            )}
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="mb-1 text-base font-bold text-slate-900">
              Статистика выполнения заданий
            </h2>
            <p className="mb-4 text-xs text-slate-400">
              Распределение решенных задач
            </p>
            <DonutChart data={donutData} />
          </section>
        </div>

        <div className="grid gap-6 lg:grid-cols-2">
          <section className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="mb-1 text-base font-bold text-slate-900">
              Прогресс по предметам
            </h2>
            <p className="mb-5 text-xs text-slate-400">
              Детальная информация о вашем прогрессе
            </p>
            <div className="space-y-5">
              {(stats?.subjects_progress ?? []).map((s, i) => (
                <SubjectProgressItem
                  key={s.code}
                  name={s.name}
                  completedTopics={s.completed_topics}
                  totalTopics={s.total_topics}
                  mastery={s.mastery}
                  index={i}
                />
              ))}
              {(stats?.subjects_progress ?? []).length === 0 && (
                <p className="py-4 text-center text-sm text-slate-400">
                  Предметы пока не добавлены
                </p>
              )}
            </div>
          </section>

          <section className="rounded-2xl border border-gray-100 bg-white p-6">
            <h2 className="mb-1 text-base font-bold text-slate-900">
              Рекомендации
            </h2>
            <p className="mb-5 text-xs text-slate-400">
              Следующие шаги в обучении
            </p>

            {completedTasks > 0 && (
              <div className="mb-4 rounded-xl bg-amber-50 px-4 py-3">
                <div className="flex items-start gap-2">
                  <LightbulbIcon className="mt-0.5 h-5 w-5 shrink-0 text-amber-500" />
                  <div>
                    <p className="text-sm font-semibold text-amber-800">
                      Отличная работа!
                    </p>
                    <p className="text-xs text-amber-600">
                      Вы завершили {completedTasks} заданий. Продолжайте в том же духе!
                    </p>
                  </div>
                </div>
              </div>
            )}

            {(stats?.recommendations ?? []).length > 0 && (
              <div className="mb-4">
                <p className="mb-2 text-xs font-medium text-slate-500">
                  Рекомендуемые действия:
                </p>
                <div className="space-y-2">
                  {stats!.recommendations.map((r) => (
                    <RecommendationCard
                      key={r.subject_code}
                      subjectCode={r.subject_code}
                      subjectName={r.subject_name}
                      mastery={r.mastery}
                      message={r.message}
                    />
                  ))}
                </div>
              </div>
            )}

            <Link
              href="/problems"
              className={buttonClasses({
                variant: "gradient",
                size: "lg",
                className: "mt-2 w-full",
              })}
            >
              Решить больше задач
            </Link>
          </section>
        </div>

        {/* Student classes section */}
        {userRole === "student" && (
          <section className="mt-8 grid gap-6 lg:grid-cols-2">
            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <h2 className="mb-1 text-base font-bold text-slate-900">
                Мои классы
              </h2>
              <p className="mb-4 text-xs text-slate-400">
                Присоединяйтесь к классу по коду, который дал вам учитель
              </p>

              <form
                onSubmit={async (e) => {
                  e.preventDefault();
                  if (!accessToken) return;
                  const trimmed = joinCode.trim();
                  if (!trimmed) return;
                  setJoining(true);
                  setJoinError(null);
                  try {
                    const joined = await apiJoinClassByCode(
                      trimmed,
                      accessToken,
                    );
                    setJoinCode("");
                    // Если класс уже есть в списке, обновим его, иначе добавим
                    setStudentClasses((prev) => {
                      const exists = prev.find((c) => c.id === joined.id);
                      if (exists) {
                        return prev.map((c) => (c.id === joined.id ? joined : c));
                      }
                      return [joined, ...prev];
                    });
                  } catch (err) {
                    const msg =
                      err instanceof Error
                        ? err.message
                        : "Не удалось присоединиться к классу";
                    setJoinError(msg);
                  } finally {
                    setJoining(false);
                  }
                }}
                className="space-y-3"
              >
                <label className="block text-sm">
                  <span className="mb-1 block text-xs font-medium text-slate-500">
                    Код класса
                  </span>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Например, AB3D9F"
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm uppercase tracking-[0.2em] text-slate-900 shadow-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </label>
                {joinError && (
                  <p className="text-xs text-rose-600">{joinError}</p>
                )}
                <button
                  type="submit"
                  disabled={joining || !joinCode.trim()}
                  className="inline-flex w-full items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                >
                  {joining ? "Присоединяем..." : "Присоединиться к классу"}
                </button>
              </form>
            </div>

            <div className="rounded-2xl border border-gray-100 bg-white p-6">
              <h2 className="mb-1 text-base font-bold text-slate-900">
                Классы, в которых вы учитесь
              </h2>
              <p className="mb-4 text-xs text-slate-400">
                Здесь отображаются классы, созданные учителями.
              </p>

              {classesLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 3 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-14 animate-pulse rounded-xl bg-gray-50"
                    />
                  ))}
                </div>
              ) : studentClasses.length === 0 ? (
                <p className="py-4 text-sm text-slate-400">
                  Вы ещё не присоединились ни к одному классу.
                </p>
              ) : (
                <div className="space-y-3">
                  {studentClasses.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-2xl border border-gray-100 bg-slate-50/60 px-4 py-3 text-sm"
                    >
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-semibold text-slate-900">
                          {c.name}
                        </p>
                        <p className="mt-0.5 text-xs text-slate-400">
                          Учитель: {c.teacher_name ?? "—"}
                        </p>
                      </div>
                      <span className="ml-3 text-[10px] text-slate-400">
                        С {new Date(c.joined_at).toLocaleDateString("ru-RU")}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}
      </main>
    </div>
  );
}

'use client';

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import {
  type ClassAssessment,
  type ClassAssessmentDetail,
  type ClassDetail,
  apiCreateClassAssessment,
  apiGetClassAssessmentDetail,
  apiGetClassAssessmentProgress,
  apiGet,
  apiGetClassDetail,
  apiListClassAssessments,
  apiRemoveClassStudent,
  type TeacherAssessmentProgress,
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

type ProblemOption = {
  id: string;
  title: string;
  points: number;
  difficulty: "easy" | "medium" | "hard" | string;
};

export default function ClassDetailsPage() {
  const { classId } = useParams<{ classId: string }>();
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [detail, setDetail] = useState<ClassDetail | null>(null);
  const [pageLoading, setPageLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [removingStudentId, setRemovingStudentId] = useState<string | null>(null);
  const [assessments, setAssessments] = useState<ClassAssessment[]>([]);
  const [assessmentsLoading, setAssessmentsLoading] = useState(false);
  const [activeAssessment, setActiveAssessment] = useState<ClassAssessmentDetail | null>(
    null,
  );
  const [activeAssessmentLoading, setActiveAssessmentLoading] = useState(false);
  const [assessmentProgress, setAssessmentProgress] = useState<TeacherAssessmentProgress | null>(
    null,
  );
  const [assessmentProgressLoading, setAssessmentProgressLoading] = useState(false);
  const [createOpen, setCreateOpen] = useState(false);
  const [problems, setProblems] = useState<ProblemOption[]>([]);
  const [problemsLoading, setProblemsLoading] = useState(false);
  const [newAssessmentTitle, setNewAssessmentTitle] = useState("");
  const [newAssessmentDescription, setNewAssessmentDescription] = useState("");
  const [newAssessmentDueAt, setNewAssessmentDueAt] = useState("");
  const [newAssessmentTimeLimit, setNewAssessmentTimeLimit] = useState("");
  const [selectedProblems, setSelectedProblems] = useState<Record<string, number>>({});
  const [creatingAssessment, setCreatingAssessment] = useState(false);

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
        if (p.role !== "teacher") {
          router.replace("/dashboard");
          return;
        }
        setProfile(p);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          router.replace("/onboarding");
          return;
        }
        setError("Не удалось загрузить профиль.");
      }
    })();
  }, [accessToken, user, router]);

  useEffect(() => {
    if (!accessToken || !profile || !classId) return;
    (async () => {
      setPageLoading(true);
      setError(null);
      try {
        const data = await apiGetClassDetail(classId, accessToken);
        setDetail(data);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          setError("Класс не найден.");
        } else if (status === 403) {
          setError("У вас нет доступа к этому классу.");
        } else {
          setError("Не удалось загрузить данные класса.");
        }
      } finally {
        setPageLoading(false);
      }
    })();
  }, [accessToken, profile, classId]);

  useEffect(() => {
    if (!accessToken || !profile || !classId) return;
    (async () => {
      setAssessmentsLoading(true);
      try {
        const list = await apiListClassAssessments(classId, accessToken);
        setAssessments(list);
      } catch {
        setAssessments([]);
      } finally {
        setAssessmentsLoading(false);
      }
    })();
  }, [accessToken, profile, classId]);

  const handleCopyCode = async () => {
    if (!detail) return;
    try {
      await navigator.clipboard.writeText(detail.join_code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  };

  const handleRemoveStudent = async (studentId: string, nameOrEmail: string) => {
    if (!detail || !accessToken) return;
    if (
      !window.confirm(
        `Удалить ученика "${nameOrEmail}" из класса? Ученик потеряет доступ к классу, но его прогресс сохранится.`,
      )
    ) {
      return;
    }

    setRemovingStudentId(studentId);
    setError(null);
    try {
      await apiRemoveClassStudent(detail.id, studentId, accessToken);
      setDetail((prev) => {
        if (!prev) return prev;
        const nextStudents = prev.students.filter((s) => s.id !== studentId);
        const avg =
          nextStudents.length > 0
            ? Math.round(
                nextStudents.reduce((sum, s) => sum + (s.overall_progress ?? 0), 0) /
                  nextStudents.length,
              )
            : 0;
        return {
          ...prev,
          students: nextStudents,
          stats: {
            total_students: nextStudents.length,
            avg_overall_progress: avg,
          },
        };
      });
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось удалить ученика из класса",
      );
    } finally {
      setRemovingStudentId(null);
    }
  };

  const handleToggleProblem = (problem: ProblemOption) => {
    setSelectedProblems((prev) => {
      if (prev[problem.id] !== undefined) {
        const copy = { ...prev };
        delete copy[problem.id];
        return copy;
      }
      return {
        ...prev,
        [problem.id]: problem.points > 0 ? problem.points : 1,
      };
    });
  };

  const handleLoadProblemsForCreate = async () => {
    if (!accessToken) return;
    setProblemsLoading(true);
    try {
      const list = await apiGet<ProblemOption[]>("/problems", accessToken);
      setProblems(list);
    } catch {
      setProblems([]);
    } finally {
      setProblemsLoading(false);
    }
  };

  const handleCreateAssessment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken || !detail) return;
    const title = newAssessmentTitle.trim();
    const itemEntries = Object.entries(selectedProblems);
    if (!title || itemEntries.length === 0) {
      setError("Укажите название и выберите хотя бы одну задачу.");
      return;
    }

    setCreatingAssessment(true);
    setError(null);
    try {
      let dueAtIso: string | null = null;
      if (newAssessmentDueAt) {
        const parsed = new Date(newAssessmentDueAt);
        if (Number.isNaN(parsed.getTime())) {
          setError("Некорректная дата дедлайна.");
          setCreatingAssessment(false);
          return;
        }
        dueAtIso = parsed.toISOString();
      }

      const created = await apiCreateClassAssessment(
        detail.id,
        {
          title,
          description: newAssessmentDescription.trim() || null,
          due_at: dueAtIso,
          time_limit_min: newAssessmentTimeLimit ? Number(newAssessmentTimeLimit) : null,
          items: itemEntries.map(([problemId, points]) => ({
            problem_id: problemId,
            points: points > 0 ? points : 1,
          })),
        },
        accessToken,
      );
      setAssessments((prev) => [created, ...prev]);
      setCreateOpen(false);
      setNewAssessmentTitle("");
      setNewAssessmentDescription("");
      setNewAssessmentDueAt("");
      setNewAssessmentTimeLimit("");
      setSelectedProblems({});
      try {
        const full = await apiGetClassAssessmentDetail(detail.id, created.id, accessToken);
        setActiveAssessment(full);
        try {
          const progress = await apiGetClassAssessmentProgress(
            detail.id,
            created.id,
            accessToken,
          );
          setAssessmentProgress(progress);
        } catch {
          setAssessmentProgress(null);
        }
      } catch {
        setActiveAssessment(null);
        setAssessmentProgress(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось создать контрольную",
      );
    } finally {
      setCreatingAssessment(false);
    }
  };

  const handleOpenAssessment = async (assessmentId: string) => {
    if (!accessToken || !detail) return;
    setActiveAssessmentLoading(true);
    setAssessmentProgressLoading(true);
    try {
      const full = await apiGetClassAssessmentDetail(detail.id, assessmentId, accessToken);
      setActiveAssessment(full);
      try {
        const progress = await apiGetClassAssessmentProgress(
          detail.id,
          assessmentId,
          accessToken,
        );
        setAssessmentProgress(progress);
      } catch {
        setAssessmentProgress(null);
      }
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить детали контрольной",
      );
    } finally {
      setActiveAssessmentLoading(false);
      setAssessmentProgressLoading(false);
    }
  };

  if (isLoading || !user || !accessToken || !profile || pageLoading) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="h-28 animate-pulse rounded-2xl bg-white" />
          <div className="mt-4 h-64 animate-pulse rounded-2xl bg-white" />
        </main>
      </div>
    );
  }

  const userName = profile.full_name ?? user.email.split("@")[0] ?? "Учитель";
  const userRole = profile.role ?? user.role ?? "teacher";

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_#dbeafe_0%,_#f8fafc_38%,_#f1f5f9_100%)] text-slate-900">
      <DashboardHeader
        userName={userName}
        userRole={userRole}
        avatarUrl={profile.avatar_url ?? null}
      />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6 overflow-hidden rounded-3xl border border-blue-100/70 bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white shadow-[0_20px_45px_-25px_rgba(30,64,175,0.85)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
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
              Назад в панель учителя
            </button>
            <h1 className="text-2xl font-extrabold text-white sm:text-3xl">
              {detail?.name ?? "Класс"}
            </h1>
            <p className="mt-1 text-sm text-blue-100">
              Управление учениками и статистикой класса
            </p>
          </div>

          {detail && (
            <div className="rounded-2xl border border-white/30 bg-white/15 px-4 py-3 backdrop-blur-sm">
              <p className="text-[11px] font-medium uppercase tracking-wide text-blue-100">
                Код подключения
              </p>
              <div className="mt-1 flex items-center gap-2">
                <span className="text-lg font-bold tracking-[0.12em] text-white">
                  {detail.join_code}
                </span>
                <button
                  type="button"
                  onClick={() => void handleCopyCode()}
                  className="rounded-full border border-white/50 bg-white/90 px-2 py-1 text-[10px] font-medium text-blue-700 hover:bg-white"
                >
                  {copied ? "Скопировано" : "Копировать"}
                </button>
              </div>
            </div>
          )}
        </div>
        </div>

        {error && (
          <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {error}
          </div>
        )}

        {detail && (
          <>
            <section className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-2xl border border-blue-100/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Учеников
                </p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  {detail.stats.total_students}
                </p>
              </div>
              <div className="rounded-2xl border border-emerald-100/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Средний прогресс
                </p>
                <p className="mt-2 text-2xl font-extrabold text-emerald-600">
                  {detail.stats.avg_overall_progress}%
                </p>
              </div>
              <div className="rounded-2xl border border-indigo-100/80 bg-white/90 p-5 shadow-sm backdrop-blur-sm">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
                  Дата создания
                </p>
                <p className="mt-2 text-2xl font-extrabold text-slate-900">
                  {new Date(detail.created_at).toLocaleDateString("ru-RU")}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-gray-100 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
              <h2 className="mb-1 text-base font-bold text-slate-900">
                Ученики класса
              </h2>
              <p className="mb-4 text-xs text-slate-400">
                Список подключённых учеников и их общий прогресс
              </p>

              {detail.students.length === 0 ? (
                <p className="py-3 text-sm text-slate-400">
                  В этом классе пока нет учеников.
                </p>
              ) : (
                <div className="space-y-3">
                  {detail.students.map((student) => {
                    const displayName = student.full_name || student.email;
                    const progress = student.overall_progress ?? 0;
                    return (
                      <div
                        key={student.id}
                        className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-white to-slate-50 px-4 py-4 shadow-[0_8px_20px_-20px_rgba(15,23,42,0.7)]"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0">
                            <p className="truncate text-sm font-semibold text-slate-900">
                              {displayName}
                            </p>
                            <p className="truncate text-xs text-slate-500">
                              {student.email}
                            </p>
                            <p className="mt-1 text-[11px] text-slate-400">
                              В классе с{" "}
                              {new Date(student.joined_at).toLocaleDateString("ru-RU")}
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() =>
                              void handleRemoveStudent(student.id, displayName)
                            }
                            disabled={removingStudentId === student.id}
                            className={buttonClasses({
                              variant: "outline",
                              size: "sm",
                              className:
                                "border-rose-200 text-rose-600 hover:bg-rose-50 hover:border-rose-300 disabled:opacity-60",
                            })}
                          >
                            {removingStudentId === student.id
                              ? "Удаляем..."
                              : "Удалить из класса"}
                          </button>
                        </div>
                        <div className="mt-3">
                          <div className="mb-1 flex items-center justify-between text-[11px] text-slate-500">
                            <span>Общий прогресс</span>
                            <span>{progress}%</span>
                          </div>
                          <div className="h-2 overflow-hidden rounded-full bg-slate-200/80">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-teal-500 transition-all"
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </section>

            <section className="mt-6 rounded-2xl border border-gray-100 bg-white/90 p-6 shadow-sm backdrop-blur-sm">
              <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="mb-1 text-base font-bold text-slate-900">
                    Контрольные
                  </h2>
                  <p className="text-xs text-slate-400">
                    Создавайте контрольные для учеников этого класса
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCreateOpen(true);
                    void handleLoadProblemsForCreate();
                  }}
                  className={buttonClasses({ variant: "primary", size: "sm" })}
                >
                  Создать контрольную
                </button>
              </div>

              {assessmentsLoading ? (
                <div className="space-y-2">
                  {Array.from({ length: 2 }).map((_, i) => (
                    <div
                      key={i}
                      className="h-16 animate-pulse rounded-xl bg-slate-100"
                    />
                  ))}
                </div>
              ) : assessments.length === 0 ? (
                <p className="py-2 text-sm text-slate-400">
                  Контрольных пока нет.
                </p>
              ) : (
                <div className="space-y-2">
                  {assessments.map((a) => (
                    <button
                      key={a.id}
                      type="button"
                      onClick={() => void handleOpenAssessment(a.id)}
                      className={`w-full rounded-xl border px-4 py-3 text-left transition-all ${
                        activeAssessment?.id === a.id
                          ? "border-blue-200 bg-gradient-to-r from-blue-50 to-indigo-50 shadow-sm"
                          : "border-gray-100 bg-slate-50/50 hover:-translate-y-0.5 hover:bg-white hover:shadow-sm"
                      }`}
                    >
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="text-sm font-semibold text-slate-900">{a.title}</p>
                        <span className="text-xs text-slate-500">
                          {a.items_count} задач, {a.total_points} баллов
                        </span>
                      </div>
                      <p className="mt-1 text-xs text-slate-500">
                        {a.due_at
                          ? `Дедлайн: ${new Date(a.due_at).toLocaleString("ru-RU")}`
                          : "Без дедлайна"}
                      </p>
                    </button>
                  ))}
                </div>
              )}

              {(activeAssessmentLoading || activeAssessment) && (
                <div className="mt-5 rounded-xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-4">
                  {activeAssessmentLoading ? (
                    <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
                  ) : activeAssessment ? (
                    <>
                      <h3 className="text-sm font-semibold text-slate-900">
                        {activeAssessment.title}
                      </h3>
                      {activeAssessment.description && (
                        <p className="mt-1 text-xs text-slate-600">
                          {activeAssessment.description}
                        </p>
                      )}
                      <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-500">
                        <span>Задач: {activeAssessment.items_count}</span>
                        <span>Баллы: {activeAssessment.total_points}</span>
                        <span>
                          Лимит:{" "}
                          {activeAssessment.time_limit_min
                            ? `${activeAssessment.time_limit_min} мин`
                            : "нет"}
                        </span>
                      </div>
                      <div className="mt-3 space-y-2">
                        {activeAssessment.items.map((item, idx) => (
                          <div
                            key={item.id}
                            className="flex items-center justify-between rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs"
                          >
                            <span className="truncate pr-3 text-slate-700">
                              {idx + 1}. {item.problem_title ?? item.problem_id}
                            </span>
                            <span className="font-semibold text-slate-900">
                              {item.points} б.
                            </span>
                          </div>
                        ))}
                      </div>
                    </>
                  ) : null}
                </div>
              )}

              {(assessmentProgressLoading || assessmentProgress) && (
                <div className="mt-4 rounded-xl border border-gray-100 bg-gradient-to-br from-slate-50 to-white p-4">
                  {assessmentProgressLoading ? (
                    <div className="h-20 animate-pulse rounded-lg bg-slate-100" />
                  ) : assessmentProgress ? (
                    <>
                      <div className="mb-3 flex flex-wrap items-center gap-3 text-xs text-slate-600">
                        <span>
                          Средний прогресс:{" "}
                          <strong>{assessmentProgress.avg_progress_percent}%</strong>
                        </span>
                        <span>
                          Средний балл:{" "}
                          <strong>
                            {assessmentProgress.avg_score}/{assessmentProgress.total_points}
                          </strong>
                        </span>
                      </div>
                      {assessmentProgress.students.length === 0 ? (
                        <p className="text-xs text-slate-500">
                          В классе пока нет учеников.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {assessmentProgress.students.map((s) => {
                            const displayName = s.full_name || s.email;
                            return (
                              <div
                                key={s.student_id}
                                className="rounded-lg border border-slate-100 bg-white px-3 py-2 text-xs"
                              >
                                <div className="flex flex-wrap items-center justify-between gap-2">
                                  <span className="font-semibold text-slate-900">
                                    {displayName}
                                  </span>
                                  <span className="text-slate-600">
                                    {s.score}/{s.total_points} б.
                                  </span>
                                </div>
                                <div className="mt-1 flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500">
                                  <span>
                                    Решено: {s.solved_count}/{s.total_items}
                                  </span>
                                  <span>Попыток: {s.attempted_count}</span>
                                  <span>Прогресс: {s.progress_percent}%</span>
                                </div>
                                <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-200/80">
                                  <div
                                    className="h-full rounded-full bg-gradient-to-r from-blue-500 to-indigo-500"
                                    style={{ width: `${s.progress_percent}%` }}
                                  />
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </>
                  ) : null}
                </div>
              )}
            </section>
          </>
        )}
      </main>

      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 px-4 backdrop-blur-sm">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  Новая контрольная
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  Выберите задачи, баллы и дедлайн
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCreateOpen(false)}
                className="rounded-full p-1 text-slate-400 hover:bg-gray-100 hover:text-slate-600"
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
                  <path d="M6 6l12 12M18 6L6 18" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateAssessment} className="space-y-4">
              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700">Название</span>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={255}
                  value={newAssessmentTitle}
                  onChange={(e) => setNewAssessmentTitle(e.target.value)}
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </label>

              <label className="block space-y-1 text-sm">
                <span className="font-medium text-slate-700">Описание</span>
                <textarea
                  value={newAssessmentDescription}
                  onChange={(e) => setNewAssessmentDescription(e.target.value)}
                  rows={3}
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                />
              </label>

              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Дедлайн</span>
                  <input
                    type="datetime-local"
                    value={newAssessmentDueAt}
                    onChange={(e) => setNewAssessmentDueAt(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </label>
                <label className="block space-y-1 text-sm">
                  <span className="font-medium text-slate-700">Лимит времени (мин)</span>
                  <input
                    type="number"
                    min={1}
                    max={240}
                    value={newAssessmentTimeLimit}
                    onChange={(e) => setNewAssessmentTimeLimit(e.target.value)}
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                  />
                </label>
              </div>

              <div>
                <p className="mb-2 text-sm font-medium text-slate-700">
                  Задачи ({Object.keys(selectedProblems).length} выбрано)
                </p>
                <div className="max-h-64 space-y-2 overflow-auto rounded-xl border border-gray-100 p-2">
                  {problemsLoading ? (
                    <div className="h-24 animate-pulse rounded bg-slate-100" />
                  ) : problems.length === 0 ? (
                    <p className="px-2 py-3 text-xs text-slate-400">
                      Нет опубликованных задач.
                    </p>
                  ) : (
                    problems.map((problem) => {
                      const selected = selectedProblems[problem.id] !== undefined;
                      return (
                        <div
                          key={problem.id}
                          className={`rounded-lg border px-3 py-2 ${
                            selected
                              ? "border-blue-200 bg-blue-50"
                              : "border-gray-100 bg-white"
                          }`}
                        >
                          <div className="flex items-start justify-between gap-3">
                            <button
                              type="button"
                              onClick={() => handleToggleProblem(problem)}
                              className="flex min-w-0 flex-1 items-center gap-2 text-left"
                            >
                              <span
                                className={`mt-0.5 inline-flex h-4 w-4 items-center justify-center rounded border text-[10px] ${
                                  selected
                                    ? "border-blue-500 bg-blue-500 text-white"
                                    : "border-slate-300 bg-white text-transparent"
                                }`}
                              >
                                ✓
                              </span>
                              <span className="truncate text-xs text-slate-700">
                                {problem.title}
                              </span>
                            </button>
                            {selected && (
                              <input
                                type="number"
                                min={1}
                                max={100}
                                value={selectedProblems[problem.id]}
                                onChange={(e) =>
                                  setSelectedProblems((prev) => ({
                                    ...prev,
                                    [problem.id]: Math.max(1, Number(e.target.value) || 1),
                                  }))
                                }
                                className="w-16 rounded border border-gray-300 bg-white px-2 py-1 text-xs text-slate-900"
                              />
                            )}
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setCreateOpen(false)}
                  className={buttonClasses({ variant: "outline", size: "sm" })}
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  disabled={creatingAssessment}
                  className={buttonClasses({ variant: "primary", size: "sm" })}
                >
                  {creatingAssessment ? "Создаём..." : "Создать контрольную"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

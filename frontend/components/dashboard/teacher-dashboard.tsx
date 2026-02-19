'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  TeacherClass,
  apiCreateClass,
  apiListTeacherClasses,
  apiDelete,
} from "@/lib/api";
import { buttonClasses } from "@/components/ui/button";

type TeacherDashboardProps = {
  userName: string;
  accessToken: string;
};

export function TeacherDashboard({ userName, accessToken }: TeacherDashboardProps) {
  void userName;
  const router = useRouter();
  const [classes, setClasses] = useState<TeacherClass[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [createOpen, setCreateOpen] = useState(false);
  const [newClassName, setNewClassName] = useState("");
  const [creating, setCreating] = useState(false);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadClasses = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiListTeacherClasses(accessToken);
      setClasses(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить классы",
      );
      setClasses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadClasses();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newClassName.trim()) return;
    setCreating(true);
    setError(null);
    setLastCreatedCode(null);
    try {
      const created = await apiCreateClass(newClassName.trim(), accessToken);
      // Оставляем модалку открытой и показываем код, чтобы его сразу скопировать
      setNewClassName(created.name);
      setLastCreatedCode(created.join_code);
      await loadClasses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось создать класс",
      );
    } finally {
      setCreating(false);
    }
  };

  const handleCopyCode = async (code: string | null) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setTimeout(() => {
        setCopiedCode((prev) => (prev === code ? null : prev));
      }, 1500);
    } catch {
      // ignore
    }
  };

  const handleDeleteClass = async (cls: TeacherClass) => {
    if (
      !window.confirm(
        `Удалить класс "${cls.name}"? Ученики будут отвязаны от этого класса, прогресс по материалам сохранится.`,
      )
    ) {
      return;
    }
    setDeletingId(cls.id);
    setError(null);
    try {
      await apiDelete<void>(`/classes/${cls.id}`, accessToken);
      await loadClasses();
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось удалить класс",
      );
    } finally {
      setDeletingId(null);
    }
  };

  const totalClasses = classes.length;
  const totalStudents = classes.reduce(
    (sum, c) => sum + (c.students_count ?? 0),
    0,
  );

  return (
    <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <div className="mb-6 flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Панель учителя
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Управляйте классами и отслеживайте прогресс учеников
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setCreateOpen(true);
            setLastCreatedCode(null);
            setNewClassName("");
          }}
          className={buttonClasses({
            variant: "primary",
            size: "lg",
            className: "inline-flex items-center gap-2",
          })}
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
            <path d="M12 5v14" />
            <path d="M5 12h14" />
          </svg>
          Создать класс
        </button>
      </div>

      {/* Summary cards */}
      <div className="mb-8 grid gap-4 sm:grid-cols-3">
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Всего классов
          </p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {totalClasses}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Всего учеников
          </p>
          <p className="mt-2 text-2xl font-extrabold text-slate-900">
            {totalStudents}
          </p>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5 shadow-sm">
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            Средний прогресс
          </p>
          <p className="mt-2 text-2xl font-extrabold text-violet-600">—</p>
          <p className="mt-1 text-xs text-slate-400">
            Детальная статистика будет доступна на странице класса
          </p>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="mb-4 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
          {error}
        </div>
      )}

      {/* My classes */}
      <section className="mb-8 rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="mb-1 text-base font-bold text-slate-900">Мои классы</h2>
        <p className="mb-4 text-xs text-slate-400">
          Список ваших классов и кодов для присоединения
        </p>

        {loading ? (
          <div className="space-y-2">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-16 animate-pulse rounded-xl bg-gray-50" />
            ))}
          </div>
        ) : classes.length === 0 ? (
          <p className="py-4 text-sm text-slate-400">
            Классы ещё не созданы. Нажмите «Создать класс», чтобы начать.
          </p>
        ) : (
          <div className="space-y-3">
            {classes.map((c) => (
              <div
                key={c.id}
                role="button"
                tabIndex={0}
                onClick={() => router.push(`/classes/${c.id}`)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    router.push(`/classes/${c.id}`);
                  }
                }}
                className="flex w-full cursor-pointer items-center justify-between rounded-2xl border border-gray-100 bg-slate-50/60 px-5 py-4 text-left transition-all hover:-translate-y-0.5 hover:bg-white hover:shadow-md"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-slate-900">
                    {c.name}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    Учеников: {c.students_count}
                  </p>
                </div>
                <div className="ml-4 flex flex-col items-end gap-1">
                  <div className="inline-flex items-center gap-2">
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                      Код: {c.join_code}
                    </span>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleCopyCode(c.join_code);
                      }}
                      className="rounded-full border border-blue-100 bg-white/80 px-2 py-1 text-[10px] font-medium text-blue-600 hover:bg-blue-50"
                    >
                      {copiedCode === c.join_code ? "Скопировано" : "Копировать"}
                    </button>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        void handleDeleteClass(c);
                      }}
                      disabled={deletingId === c.id}
                      className="rounded-full border border-rose-100 bg-white/80 px-2 py-1 text-[10px] font-medium text-rose-600 hover:bg-rose-50 disabled:opacity-60"
                    >
                      {deletingId === c.id ? "Удаляем..." : "Удалить"}
                    </button>
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Создан {new Date(c.created_at).toLocaleDateString("ru-RU")}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Quick actions */}
      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">
            Просмотреть материалы
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Изучайте лекции и задания как ученик, чтобы готовить занятия.
          </p>
          <button
            type="button"
            onClick={() => router.push("/subjects")}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            Перейти к материалам
          </button>
        </div>
        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          <h3 className="mb-1 text-sm font-semibold text-slate-900">
            Решать задачи
          </h3>
          <p className="mb-3 text-xs text-slate-500">
            Практикуйтесь вместе с учениками или готовьте домашние задания.
          </p>
          <button
            type="button"
            onClick={() => router.push("/problems")}
            className={buttonClasses({ variant: "outline", size: "sm" })}
          >
            Открыть задачи
          </button>
        </div>
      </section>

      {/* Create class modal */}
      {createOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 px-4">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <h2 className="text-lg font-semibold text-slate-900">
                  {lastCreatedCode ? "Класс создан" : "Создать новый класс"}
                </h2>
                <p className="mt-1 text-xs text-slate-500">
                  {lastCreatedCode
                    ? "Скопируйте код доступа и передайте его ученикам."
                    : "Введите название класса. Будет сгенерирован уникальный код доступа."}
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setCreateOpen(false);
                  setNewClassName("");
                  setLastCreatedCode(null);
                }}
                className="rounded-full p-1 text-slate-400 hover:bg-gray-100 hover:text-slate-600"
              >
                <span className="sr-only">Закрыть</span>
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

            <form onSubmit={handleCreate} className="space-y-4">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Название класса
                </label>
                <input
                  type="text"
                  required
                  minLength={2}
                  maxLength={255}
                  value={newClassName}
                  onChange={(e) => setNewClassName(e.target.value)}
                  placeholder="Например, 9А — Математика"
                  disabled={!!lastCreatedCode}
                  className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-slate-900 shadow-sm focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40 disabled:opacity-70"
                />
              </div>

              {lastCreatedCode && (
                <div className="rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-xs text-blue-800">
                  <p className="font-semibold">
                    Код класса:{" "}
                    <code className="rounded bg-white px-1 py-0.5">
                      {lastCreatedCode}
                    </code>
                  </p>
                  <button
                    type="button"
                    onClick={() => handleCopyCode(lastCreatedCode)}
                    className="mt-1 text-[11px] font-medium text-blue-700 hover:underline"
                  >
                    {copiedCode === lastCreatedCode
                      ? "Скопировано"
                      : "Скопировать код"}
                  </button>
                </div>
              )}

              <div className="mt-4 flex justify-end gap-2">
                {!lastCreatedCode ? (
                  <>
                    <button
                      type="button"
                      onClick={() => {
                        setCreateOpen(false);
                        setNewClassName("");
                        setLastCreatedCode(null);
                      }}
                      className="rounded-xl border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 hover:bg-gray-50"
                    >
                      Отмена
                    </button>
                    <button
                      type="submit"
                      disabled={creating}
                      className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 disabled:opacity-60"
                    >
                      {creating ? "Создаём..." : "Создать"}
                    </button>
                  </>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setCreateOpen(false);
                      setNewClassName("");
                      setLastCreatedCode(null);
                    }}
                    className="rounded-xl bg-blue-600 px-5 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
                  >
                    Готово
                  </button>
                )}
              </div>
            </form>
          </div>
        </div>
      )}
    </main>
  );
}

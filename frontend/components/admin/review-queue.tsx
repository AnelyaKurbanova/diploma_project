'use client';

import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";
import { ProblemEditorModal, type ProblemEditorResult } from "@/components/admin/problem-editor-modal";
import { ProblemContent } from "@/components/ui/problem-content";

type AdminProblem = {
  id: string;
  subject_id: string;
  topic_id: string | null;
  type: string;
  difficulty: string;
  status: string;
  title: string;
  statement: string;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  points: number;
};

type ProblemListResponse = {
  items: AdminProblem[];
  total: number;
  page: number;
  per_page: number;
};

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-gray-100 text-gray-600" },
  pending_review: { label: "На проверке", cls: "bg-amber-50 text-amber-700" },
  published: { label: "Опубликовано", cls: "bg-emerald-50 text-emerald-700" },
  archived: { label: "Архив", cls: "bg-slate-100 text-slate-500" },
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Лёгкий",
  medium: "Средний",
  hard: "Сложный",
};

const TYPE_LABELS: Record<string, string> = {
  single_choice: "Один ответ",
  multiple_choice: "Несколько ответов",
  numeric: "Числовой",
  short_text: "Краткий текст",
  match: "Сопоставление",
};

type ReviewQueueProps = {
  accessToken: string;
  userRole: string;
};

export function ReviewQueue({ accessToken, userRole }: ReviewQueueProps) {
  const [problems, setProblems] = useState<AdminProblem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("pending_review");
  const [loading, setLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const perPage = 20;
  const isModerator = userRole === "moderator" || userRole === "admin";

  const [selectedProblem, setSelectedProblem] = useState<AdminProblem | null>(null);
  const [modalMode, setModalMode] = useState<"view" | "edit">("view");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const loadProblems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      if (statusFilter) params.set("status", statusFilter);
      const data = await apiGet<ProblemListResponse>(
        `/admin/problems?${params.toString()}`,
        accessToken,
      );
      setProblems(data.items);
      setTotal(data.total);
      // Сбрасываем выбор при смене списка
      setSelectedIds([]);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить задачи");
      setProblems([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, page, statusFilter]);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  const handleAction = async (problemId: string, action: "submit-review" | "publish" | "reject" | "archive") => {
    setActionInProgress(problemId);
    setError(null);
    try {
      await apiPost(`/problems/${problemId}/${action}`, undefined, accessToken);
      await loadProblems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при выполнении действия");
    } finally {
      setActionInProgress(null);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={statusFilter}
          onChange={(e) => { setStatusFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        >
          <option value="">Все статусы</option>
          <option value="draft">Черновик</option>
          <option value="pending_review">На проверке</option>
          <option value="published">Опубликовано</option>
          <option value="archived">Архив</option>
        </select>
        <span className="text-xs text-slate-400">{total} задач</span>
      </div>

      {error && (
        <p className="rounded-lg bg-rose-50 px-4 py-2 text-sm text-rose-600">{error}</p>
      )}

      {selectedIds.length > 0 && isModerator && (
        <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-100 bg-amber-50/70 px-3 py-2 text-xs text-amber-800">
          <span>Выбрано задач: {selectedIds.length}</span>
          <button
            type="button"
            disabled={batchDeleting}
            onClick={async () => {
              if (!selectedIds.length) return;
              if (!confirm("Удалить выбранные задачи? Это действие нельзя отменить.")) return;
              setBatchDeleting(true);
              setError(null);
              try {
                await Promise.all(
                  selectedIds.map((id) => apiDelete(`/problems/${id}`, accessToken)),
                );
                setSelectedIds([]);
                await loadProblems();
              } catch (err) {
                setError(
                  err instanceof Error
                    ? err.message
                    : "Ошибка при массовом удалении задач",
                );
              } finally {
                setBatchDeleting(false);
              }
            }}
            className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
          >
            {batchDeleting ? "Удаление..." : "Удалить выбранные"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedIds([])}
            className="text-xs text-amber-700 underline-offset-2 hover:underline"
          >
            Сбросить выбор
          </button>
        </div>
      )}

      <div className="space-y-3">
        {loading ? (
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-24 animate-pulse rounded-xl bg-gray-100" />
          ))
        ) : problems.length === 0 ? (
          <div className="flex flex-col items-center justify-center rounded-xl border border-gray-100 bg-white py-12 text-center">
            <p className="text-sm text-slate-400">Задачи не найдены</p>
          </div>
        ) : (
          problems.map((p) => {
            const statusInfo = STATUS_LABELS[p.status] ?? STATUS_LABELS.draft;
            const checked = selectedIds.includes(p.id);
            return (
              <div
                key={p.id}
                className="rounded-xl border border-gray-100 bg-white p-5 shadow-sm"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      {isModerator && (
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={(e) => {
                            const isNowChecked = e.target.checked;
                            setSelectedIds((prev) =>
                              isNowChecked ? [...prev, p.id] : prev.filter((id) => id !== p.id),
                            );
                          }}
                          className="h-4 w-4 accent-amber-600"
                        />
                      )}
                      <h4 className="truncate font-bold text-slate-900">{p.title}</h4>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <ProblemContent
                      body={p.statement}
                      className="mt-1 line-clamp-2 text-sm text-slate-500"
                    />
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>{TYPE_LABELS[p.type] ?? p.type}</span>
                      <span>{DIFFICULTY_LABELS[p.difficulty] ?? p.difficulty}</span>
                      <span>{p.points} б.</span>
                      <span>{new Date(p.created_at).toLocaleDateString("ru-RU")}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProblem(p);
                        setModalMode("view");
                      }}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-gray-50"
                    >
                      Просмотр
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedProblem(p);
                        setModalMode("edit");
                      }}
                      className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100"
                    >
                      Редактировать
                    </button>
                    {p.status === "draft" && (
                      <button
                        onClick={() => handleAction(p.id, "submit-review")}
                        disabled={actionInProgress === p.id}
                        className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                      >
                        На проверку
                      </button>
                    )}
                    {p.status === "pending_review" && isModerator && (
                      <>
                        <button
                          onClick={() => handleAction(p.id, "publish")}
                          disabled={actionInProgress === p.id}
                          className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                        >
                          Одобрить
                        </button>
                        <button
                          onClick={() => handleAction(p.id, "reject")}
                          disabled={actionInProgress === p.id}
                          className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                        >
                          Отклонить
                        </button>
                      </>
                    )}
                    {p.status === "published" && isModerator && (
                      <button
                        onClick={() => handleAction(p.id, "archive")}
                        disabled={actionInProgress === p.id}
                        className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
                      >
                        В архив
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Далее
          </button>
        </div>
      )}

      {selectedProblem && (
        <ProblemEditorModal
          accessToken={accessToken}
          isOpen={true}
          mode={modalMode}
          subjectId={selectedProblem.subject_id}
          topicId={selectedProblem.topic_id}
          problemId={selectedProblem.id}
          userRole={userRole}
          allowStatusActions
          onClose={() => setSelectedProblem(null)}
          onSaved={(_p: ProblemEditorResult) => {
            void loadProblems();
          }}
          onStatusChanged={() => {
            void loadProblems();
          }}
        />
      )}
    </div>
  );
}

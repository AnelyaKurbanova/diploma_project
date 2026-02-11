'use client';

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type Subject = { id: string; code: string; name_ru: string };
type Topic = { id: string; title_ru: string; subject_id: string };

type Choice = { choice_text: string; is_correct: boolean; order_no: number };

type AdminProblem = {
  id: string;
  subject_id: string;
  topic_id: string | null;
  type: string;
  difficulty: string;
  status: string;
  title: string;
  statement: string;
  explanation: string | null;
  time_limit_sec: number;
  points: number;
  choices: { id: string; choice_text: string; is_correct: boolean; order_no: number }[];
  tags: { id: string; name: string }[];
  answer_key: {
    numeric_answer: number | null;
    text_answer: string | null;
    answer_pattern: string | null;
    tolerance: number | null;
  } | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
};

type ProblemListResponse = {
  items: AdminProblem[];
  total: number;
  page: number;
  per_page: number;
};

type ProblemsFormProps = {
  accessToken: string;
  userRole: string;
  onCreated?: () => void;
};

const PROBLEM_TYPES = [
  { value: "single_choice", label: "Один ответ" },
  { value: "multiple_choice", label: "Несколько ответов" },
  { value: "numeric", label: "Числовой" },
  { value: "short_text", label: "Краткий текст" },
];

const DIFFICULTY_LEVELS = [
  { value: "easy", label: "Лёгкий" },
  { value: "medium", label: "Средний" },
  { value: "hard", label: "Сложный" },
];

const STATUS_LABELS: Record<string, { label: string; cls: string }> = {
  draft: { label: "Черновик", cls: "bg-gray-100 text-gray-600" },
  pending_review: { label: "На проверке", cls: "bg-amber-50 text-amber-700" },
  published: { label: "Опубликовано", cls: "bg-emerald-50 text-emerald-700" },
  archived: { label: "Архив", cls: "bg-slate-100 text-slate-500" },
};

const TYPE_LABELS: Record<string, string> = {
  single_choice: "Один ответ",
  multiple_choice: "Несколько ответов",
  numeric: "Числовой",
  short_text: "Краткий текст",
  match: "Сопоставление",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Лёгкий",
  medium: "Средний",
  hard: "Сложный",
};

const EMPTY_FORM = {
  subject_id: "",
  topic_id: "",
  type: "single_choice",
  difficulty: "easy",
  title: "",
  statement: "",
  explanation: "",
  time_limit_sec: "60",
  points: "1",
};

export function ProblemsForm({ accessToken, userRole, onCreated }: ProblemsFormProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [choices, setChoices] = useState<Choice[]>([
    { choice_text: "", is_correct: true, order_no: 0 },
    { choice_text: "", is_correct: false, order_no: 1 },
  ]);
  const [numericAnswer, setNumericAnswer] = useState("");
  const [textAnswer, setTextAnswer] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // List state
  const [problems, setProblems] = useState<AdminProblem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [listLoading, setListLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);

  const perPage = 20;
  const isModerator = userRole === "moderator" || userRole === "admin";

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Subject[]>("/subjects", accessToken);
        setSubjects(data);
      } catch {
        // subjects load fail
      }
    })();
  }, [accessToken]);

  useEffect(() => {
    if (!form.subject_id) {
      setTopics([]);
      return;
    }
    (async () => {
      try {
        const data = await apiGet<Topic[]>(
          `/topics?subject_id=${form.subject_id}`,
          accessToken,
        );
        setTopics(data);
      } catch {
        setTopics([]);
      }
    })();
  }, [accessToken, form.subject_id]);

  const loadProblems = useCallback(async () => {
    setListLoading(true);
    try {
      const params = new URLSearchParams();
      params.set("page", String(page));
      params.set("per_page", String(perPage));
      if (statusFilter) params.set("status", statusFilter);
      if (subjectFilter) params.set("subject_id", subjectFilter);
      const data = await apiGet<ProblemListResponse>(
        `/admin/problems?${params.toString()}`,
        accessToken,
      );
      setProblems(data.items);
      setTotal(data.total);
    } catch {
      setProblems([]);
    } finally {
      setListLoading(false);
    }
  }, [accessToken, page, statusFilter, subjectFilter]);

  useEffect(() => {
    loadProblems();
  }, [loadProblems]);

  const isChoiceType = form.type === "single_choice" || form.type === "multiple_choice";

  const addChoice = () => {
    setChoices((prev) => [
      ...prev,
      { choice_text: "", is_correct: false, order_no: prev.length },
    ]);
  };

  const removeChoice = (idx: number) => {
    setChoices((prev) => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order_no: i })));
  };

  const resetForm = () => {
    setForm(EMPTY_FORM);
    setEditingId(null);
    setChoices([
      { choice_text: "", is_correct: true, order_no: 0 },
      { choice_text: "", is_correct: false, order_no: 1 },
    ]);
    setNumericAnswer("");
    setTextAnswer("");
    setError(null);
    setSuccess(null);
  };

  const startEdit = async (problem: AdminProblem) => {
    setEditingId(problem.id);
    setShowForm(true);
    setForm({
      subject_id: problem.subject_id,
      topic_id: problem.topic_id ?? "",
      type: problem.type,
      difficulty: problem.difficulty,
      title: problem.title,
      statement: problem.statement,
      explanation: problem.explanation ?? "",
      time_limit_sec: String(problem.time_limit_sec),
      points: String(problem.points),
    });
    if (problem.type === "single_choice" || problem.type === "multiple_choice") {
      setChoices(
        problem.choices.map((c) => ({
          choice_text: c.choice_text,
          is_correct: c.is_correct,
          order_no: c.order_no,
        })),
      );
    }
    if (problem.type === "numeric" && problem.answer_key?.numeric_answer != null) {
      setNumericAnswer(String(problem.answer_key.numeric_answer));
    }
    if (problem.type === "short_text" && problem.answer_key?.text_answer) {
      setTextAnswer(problem.answer_key.text_answer);
    }
    setError(null);
    setSuccess(null);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const body: Record<string, unknown> = {
        subject_id: form.subject_id,
        topic_id: form.topic_id || null,
        type: form.type,
        difficulty: form.difficulty,
        title: form.title,
        statement: form.statement,
        explanation: form.explanation || null,
        time_limit_sec: Number(form.time_limit_sec),
        points: Number(form.points),
      };

      if (isChoiceType) {
        body.choices = choices.map((c) => ({
          choice_text: c.choice_text,
          is_correct: c.is_correct,
          order_no: c.order_no,
        }));
      } else if (form.type === "numeric") {
        body.answer_key = {
          numeric_answer: numericAnswer ? Number(numericAnswer) : null,
        };
      } else if (form.type === "short_text") {
        body.answer_key = {
          text_answer: textAnswer || null,
        };
      }

      if (editingId) {
        await apiPatch(`/problems/${editingId}`, body, accessToken);
        setSuccess("Задача обновлена");
      } else {
        await apiPost("/problems", body, accessToken);
        setSuccess("Задача создана (черновик)");
      }
      resetForm();
      setShowForm(false);
      onCreated?.();
      await loadProblems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении");
    } finally {
      setSubmitting(false);
    }
  };

  const handleAction = async (problemId: string, action: "submit-review" | "publish" | "reject" | "archive") => {
    setActionInProgress(problemId);
    try {
      await apiPost(`/problems/${problemId}/${action}`, undefined, accessToken);
      await loadProblems();
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при выполнении действия");
    } finally {
      setActionInProgress(null);
    }
  };

  const handleDelete = async (problemId: string) => {
    if (!confirm("Удалить задачу? Это действие нельзя отменить.")) return;
    setActionInProgress(problemId);
    try {
      await apiDelete(`/problems/${problemId}`, accessToken);
      if (editingId === problemId) resetForm();
      await loadProblems();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при удалении");
    } finally {
      setActionInProgress(null);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  return (
    <div className="space-y-6">
      {/* Toolbar */}
      <div className="flex flex-wrap items-center gap-3">
        <button
          onClick={() => { resetForm(); setShowForm(!showForm); }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
        >
          {showForm && !editingId ? "Скрыть форму" : "Создать задачу"}
        </button>
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
        <select
          value={subjectFilter}
          onChange={(e) => { setSubjectFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        >
          <option value="">Все предметы</option>
          {subjects.map((s) => (
            <option key={s.id} value={s.id}>{s.name_ru}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{total} задач</span>
      </div>

      {/* Create / Edit form */}
      {showForm && (
        <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-bold text-slate-900">
              {editingId ? "Редактировать задачу" : "Создать задачу"}
            </h3>
            <button
              type="button"
              onClick={() => { resetForm(); setShowForm(false); }}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Закрыть
            </button>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Предмет</label>
              <select
                required
                value={form.subject_id}
                onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value, topic_id: "" }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Выберите предмет</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>{s.name_ru}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Тема</label>
              <select
                value={form.topic_id}
                onChange={(e) => setForm((f) => ({ ...f, topic_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Без привязки к теме</option>
                {topics.map((t) => (
                  <option key={t.id} value={t.id}>{t.title_ru}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Тип</label>
              <select
                value={form.type}
                onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
                disabled={!!editingId}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-60"
              >
                {PROBLEM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Сложность</label>
              <select
                value={form.difficulty}
                onChange={(e) => setForm((f) => ({ ...f, difficulty: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                {DIFFICULTY_LEVELS.map((d) => (
                  <option key={d.value} value={d.value}>{d.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Заголовок</label>
            <input
              type="text"
              required
              maxLength={255}
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Название задачи"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Условие</label>
            <textarea
              required
              rows={4}
              value={form.statement}
              onChange={(e) => setForm((f) => ({ ...f, statement: e.target.value }))}
              placeholder="Текст условия задачи..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Объяснение (необязательно)</label>
            <textarea
              rows={2}
              value={form.explanation}
              onChange={(e) => setForm((f) => ({ ...f, explanation: e.target.value }))}
              placeholder="Объяснение решения..."
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Лимит времени (сек)</label>
              <input
                type="number"
                min={1}
                value={form.time_limit_sec}
                onChange={(e) => setForm((f) => ({ ...f, time_limit_sec: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Баллы</label>
              <input
                type="number"
                min={1}
                value={form.points}
                onChange={(e) => setForm((f) => ({ ...f, points: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
          </div>

          {isChoiceType && (
            <div className="space-y-3">
              <label className="block text-xs font-medium text-slate-500">Варианты ответов</label>
              {choices.map((c, idx) => (
                <div key={idx} className="flex items-center gap-2">
                  <input
                    type={form.type === "single_choice" ? "radio" : "checkbox"}
                    name="correct_choice"
                    checked={c.is_correct}
                    onChange={() => {
                      if (form.type === "single_choice") {
                        setChoices((prev) =>
                          prev.map((ch, i) => ({ ...ch, is_correct: i === idx })),
                        );
                      } else {
                        setChoices((prev) =>
                          prev.map((ch, i) =>
                            i === idx ? { ...ch, is_correct: !ch.is_correct } : ch,
                          ),
                        );
                      }
                    }}
                    className="accent-blue-600"
                  />
                  <input
                    type="text"
                    required
                    value={c.choice_text}
                    onChange={(e) =>
                      setChoices((prev) =>
                        prev.map((ch, i) =>
                          i === idx ? { ...ch, choice_text: e.target.value } : ch,
                        ),
                      )
                    }
                    placeholder={`Вариант ${idx + 1}`}
                    className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                  {choices.length > 2 && (
                    <button type="button" onClick={() => removeChoice(idx)} className="text-xs text-rose-500 hover:text-rose-700">
                      Удалить
                    </button>
                  )}
                </div>
              ))}
              <button
                type="button"
                onClick={addChoice}
                className="text-sm text-blue-600 hover:text-blue-700"
              >
                + Добавить вариант
              </button>
            </div>
          )}

          {form.type === "numeric" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Правильный ответ (число)</label>
              <input
                type="number"
                step="any"
                value={numericAnswer}
                onChange={(e) => setNumericAnswer(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
          )}

          {form.type === "short_text" && (
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Правильный ответ (текст)</label>
              <input
                type="text"
                value={textAnswer}
                onChange={(e) => setTextAnswer(e.target.value)}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              />
            </div>
          )}

          {error && <p className="text-sm text-rose-600">{error}</p>}
          {success && <p className="text-sm text-emerald-600">{success}</p>}

          <div className="flex gap-2">
            <button
              type="submit"
              disabled={submitting}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submitting
                ? "Сохранение..."
                : editingId
                  ? "Сохранить изменения"
                  : "Создать задачу (черновик)"}
            </button>
            {editingId && (
              <button
                type="button"
                onClick={() => { resetForm(); setShowForm(false); }}
                className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-gray-50"
              >
                Отмена
              </button>
            )}
          </div>
        </form>
      )}

      {/* Problems list */}
      <div className="space-y-3">
        {listLoading ? (
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
            const canEdit = p.status === "draft" || p.status === "pending_review";
            return (
              <div
                key={p.id}
                className={`rounded-xl border bg-white p-5 shadow-sm transition-colors ${
                  editingId === p.id ? "border-blue-200 bg-blue-50/30" : "border-gray-100"
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <h4 className="truncate font-bold text-slate-900">{p.title}</h4>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                    </div>
                    <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.statement}</p>
                    <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-400">
                      <span>{TYPE_LABELS[p.type] ?? p.type}</span>
                      <span>{DIFFICULTY_LABELS[p.difficulty] ?? p.difficulty}</span>
                      <span>{p.points} б.</span>
                      <span>{new Date(p.created_at).toLocaleDateString("ru-RU")}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-wrap items-center gap-2">
                    {canEdit && (
                      <button
                        onClick={() => startEdit(p)}
                        disabled={actionInProgress === p.id}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                      >
                        Редактировать
                      </button>
                    )}
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
                    {isModerator && (
                      <button
                        onClick={() => handleDelete(p.id)}
                        disabled={actionInProgress === p.id}
                        className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-100 disabled:opacity-50"
                      >
                        Удалить
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
    </div>
  );
}

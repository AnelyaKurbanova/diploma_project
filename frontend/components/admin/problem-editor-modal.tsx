'use client';

import { useEffect, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { ProblemContent } from "@/components/ui/problem-content";

type ProblemType = "single_choice" | "multiple_choice" | "short_text";

type Choice = {
  choice_text: string;
  is_correct: boolean;
  order_no: number;
};

type AdminProblem = {
  id: string;
  subject_id: string;
  topic_id: string | null;
  type: ProblemType | string;
  difficulty: "easy" | "medium" | "hard" | string;
  status: string;
  title: string;
  statement: string;
  explanation: string | null;
  time_limit_sec: number;
  points: number;
  choices: {
    id: string;
    choice_text: string;
    is_correct: boolean;
    order_no: number;
  }[];
  answer_key: {
    text_answer: string | null;
  } | null;
};

export type ProblemEditorResult = AdminProblem;

type Mode = "create" | "edit" | "view";

type ProblemEditorModalProps = {
  accessToken: string;
  isOpen: boolean;
  mode: Mode;
  subjectId: string;
  topicId: string | null;
  problemId?: string;
  userRole?: string;
  allowStatusActions?: boolean;
  onClose: () => void;
  onSaved?: (problem: ProblemEditorResult) => void;
  onStatusChanged?: () => void;
};

const DIFFICULTY_OPTIONS: { value: "easy" | "medium" | "hard"; label: string }[] = [
  { value: "easy", label: "Лёгкий" },
  { value: "medium", label: "Средний" },
  { value: "hard", label: "Сложный" },
];

const TYPE_OPTIONS: { value: ProblemType; label: string }[] = [
  { value: "single_choice", label: "Один ответ" },
  { value: "multiple_choice", label: "Несколько ответов" },
  { value: "short_text", label: "Текстовый ответ" },
];

export function ProblemEditorModal({
  accessToken,
  isOpen,
  mode,
  subjectId,
  topicId,
  problemId,
  userRole,
  allowStatusActions = false,
  onClose,
  onSaved,
  onStatusChanged,
}: ProblemEditorModalProps) {
  const [loading, setLoading] = useState(mode !== "create");
  const [saving, setSaving] = useState(false);
  const [actionInProgress, setActionInProgress] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [problem, setProblem] = useState<AdminProblem | null>(null);

  const [type, setType] = useState<ProblemType>("single_choice");
  const [difficulty, setDifficulty] = useState<"easy" | "medium" | "hard">("easy");
  const [title, setTitle] = useState("");
  const [statement, setStatement] = useState("");
  const [explanation, setExplanation] = useState("");
  const [points, setPoints] = useState("1");
  const [choices, setChoices] = useState<Choice[]>([
    { choice_text: "", is_correct: true, order_no: 0 },
    { choice_text: "", is_correct: false, order_no: 1 },
  ]);
  const [textAnswer, setTextAnswer] = useState("");

  const isChoiceType = type === "single_choice" || type === "multiple_choice";
  const canEdit = mode !== "view";
  const canModerate = userRole === "moderator" || userRole === "admin";

  useEffect(() => {
    if (!isOpen) return;
    if (mode === "create") {
      setProblem(null);
      setLoading(false);
      setError(null);
      setType("single_choice");
      setDifficulty("easy");
      setTitle("");
      setStatement("");
      setExplanation("");
      setPoints("1");
      setChoices([
        { choice_text: "", is_correct: true, order_no: 0 },
        { choice_text: "", is_correct: false, order_no: 1 },
      ]);
      setTextAnswer("");
      return;
    }

    if (!problemId) return;

    setLoading(true);
    setError(null);
    (async () => {
      try {
        const data = await apiGet<AdminProblem>(`/admin/problems/${problemId}`, accessToken);
        setProblem(data);
        const problemType =
          data.type === "single_choice" || data.type === "multiple_choice" || data.type === "short_text"
            ? data.type
            : "single_choice";
        setType(problemType);
        const diff =
          data.difficulty === "easy" || data.difficulty === "medium" || data.difficulty === "hard"
            ? data.difficulty
            : "easy";
        setDifficulty(diff);
        setTitle(data.title);
        setStatement(data.statement);
        setExplanation(data.explanation ?? "");
        setPoints(String(data.points || 1));
        if (problemType === "single_choice" || problemType === "multiple_choice") {
          const nextChoices = (data.choices ?? [])
            .slice()
            .sort((a, b) => a.order_no - b.order_no)
            .map((c, index) => ({
              choice_text: c.choice_text,
              is_correct: c.is_correct,
              order_no: index,
            }));
          setChoices(
            nextChoices.length > 0
              ? nextChoices
              : [
                  { choice_text: "", is_correct: true, order_no: 0 },
                  { choice_text: "", is_correct: false, order_no: 1 },
                ],
          );
        } else {
          setChoices([
            { choice_text: "", is_correct: true, order_no: 0 },
            { choice_text: "", is_correct: false, order_no: 1 },
          ]);
        }
        setTextAnswer(data.answer_key?.text_answer ?? "");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить задачу");
      } finally {
        setLoading(false);
      }
    })();
  }, [isOpen, mode, problemId, accessToken]);

  if (!isOpen) return null;

  const addChoice = () => {
    setChoices((prev) => [
      ...prev,
      { choice_text: "", is_correct: false, order_no: prev.length },
    ]);
  };

  const removeChoice = (index: number) => {
    setChoices((prev) =>
      prev
        .filter((_, i) => i !== index)
        .map((c, i) => ({ ...c, order_no: i })),
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit || saving) return;

    setSaving(true);
    setError(null);
    try {
      const body: Record<string, unknown> = {
        subject_id: problem?.subject_id ?? subjectId,
        topic_id: (problem?.topic_id ?? topicId) || null,
        type,
        difficulty,
        title,
        statement,
        explanation: explanation || null,
        time_limit_sec: 0,
        points: Number(points) || 1,
      };

      if (isChoiceType) {
        body.choices = choices.map((c, index) => ({
          choice_text: c.choice_text,
          is_correct: c.is_correct,
          order_no: index,
        }));
      } else if (type === "short_text") {
        body.answer_key = {
          text_answer: textAnswer || null,
        };
      }

      let result: AdminProblem;
      if (mode === "edit" && problemId) {
        result = await apiPatch<AdminProblem>(`/problems/${problemId}`, body, accessToken);
      } else {
        result = await apiPost<AdminProblem>("/problems", body, accessToken);
      }

      onSaved?.(result);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении задачи");
    } finally {
      setSaving(false);
    }
  };

  const doStatusAction = async (action: "submit-review" | "publish" | "reject" | "archive") => {
    if (!problemId) return;
    setActionInProgress(true);
    setError(null);
    try {
      await apiPost(`/problems/${problemId}/${action}`, undefined, accessToken);
      onStatusChanged?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при изменении статуса");
    } finally {
      setActionInProgress(false);
    }
  };

  const doDelete = async () => {
    if (!problemId) return;
    if (!confirm("Удалить задачу? Это действие нельзя отменить.")) return;
    setActionInProgress(true);
    setError(null);
    try {
      await apiDelete(`/problems/${problemId}`, accessToken);
      onStatusChanged?.();
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при удалении задачи");
    } finally {
      setActionInProgress(false);
    }
  };

  const currentStatus = problem?.status;

  return (
    <div className="fixed inset-0 z-[120] flex items-center justify-center bg-black/40 p-4 backdrop-blur-sm">
      <div className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl bg-white p-6 shadow-2xl">
        <div className="mb-4 flex items-start justify-between gap-3">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">
              {mode === "create"
                ? "Создание задачи"
                : mode === "edit"
                  ? "Редактирование задачи"
                  : "Просмотр задачи"}
            </p>
            <h2 className="mt-1 text-lg font-bold text-slate-900">
              {title || (problem?.title ?? "Новая задача")}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-full bg-slate-100 px-2 py-1 text-sm text-slate-600 hover:bg-slate-200"
          >
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-5">
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="h-8 animate-pulse rounded-lg bg-slate-100" />
              ))}
            </div>
          ) : (
            <>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Тип задачи
                  </label>
                  <select
                    value={type}
                    onChange={(e) => {
                      const next = e.target.value as ProblemType;
                      setType(next);
                      if (next === "short_text") {
                        setChoices([
                          { choice_text: "", is_correct: true, order_no: 0 },
                          { choice_text: "", is_correct: false, order_no: 1 },
                        ]);
                      } else {
                        setTextAnswer("");
                      }
                    }}
                    disabled={!canEdit || mode === "edit"}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50"
                  >
                    {TYPE_OPTIONS.map((t) => (
                      <option key={t.value} value={t.value}>
                        {t.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Сложность
                  </label>
                  <select
                    value={difficulty}
                    onChange={(e) =>
                      setDifficulty(e.target.value as "easy" | "medium" | "hard")
                    }
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50"
                  >
                    {DIFFICULTY_OPTIONS.map((d) => (
                      <option key={d.value} value={d.value}>
                        {d.label}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Баллы
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={points}
                    onChange={(e) => setPoints(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Заголовок
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Условие
                </label>
                <textarea
                  rows={5}
                  value={statement}
                  onChange={(e) => setStatement(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50"
                />
              </div>

              {isChoiceType && (
                <div className="space-y-2">
                  <label className="block text-xs font-medium text-slate-500">
                    Варианты ответов
                  </label>
                  {choices.map((c, index) => (
                    <div key={index} className="flex items-center gap-2">
                      <input
                        type={type === "single_choice" ? "radio" : "checkbox"}
                        name="correct_choice"
                        checked={c.is_correct}
                        disabled={!canEdit}
                        onChange={() => {
                          if (!canEdit) return;
                          if (type === "single_choice") {
                            setChoices((prev) =>
                              prev.map((ch, i) => ({
                                ...ch,
                                is_correct: i === index,
                              })),
                            );
                          } else {
                            setChoices((prev) =>
                              prev.map((ch, i) =>
                                i === index ? { ...ch, is_correct: !ch.is_correct } : ch,
                              ),
                            );
                          }
                        }}
                        className="h-4 w-4 text-blue-600"
                      />
                      <input
                        type="text"
                        value={c.choice_text}
                        onChange={(e) =>
                          setChoices((prev) =>
                            prev.map((ch, i) =>
                              i === index ? { ...ch, choice_text: e.target.value } : ch,
                            ),
                          )
                        }
                        disabled={!canEdit}
                        className="flex-1 rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50"
                      />
                      {choices.length > 2 && canEdit && (
                        <button
                          type="button"
                          onClick={() => removeChoice(index)}
                          className="text-xs text-rose-500 hover:text-rose-700"
                        >
                          Удалить
                        </button>
                      )}
                    </div>
                  ))}
                  {canEdit && (
                    <button
                      type="button"
                      onClick={addChoice}
                      className="text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      + Добавить вариант
                    </button>
                  )}
                </div>
              )}

              {type === "short_text" && (
                <div className="space-y-2">
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Правильный текстовый ответ
                  </label>
                  <input
                    type="text"
                    value={textAnswer}
                    onChange={(e) => setTextAnswer(e.target.value)}
                    disabled={!canEdit}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50"
                  />
                  {difficulty === "hard" && (
                    <p className="text-[11px] text-slate-400">
                      Для сложных задач старайтесь задавать ответ без специальных символов — только
                      числа, буквы и простые знаки вроде +, -, /.
                    </p>
                  )}
                </div>
              )}

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">
                  Объяснение (необязательно)
                </label>
                <textarea
                  rows={3}
                  value={explanation}
                  onChange={(e) => setExplanation(e.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50"
                />
              </div>

              {mode === "view" && statement && (
                <div className="mt-2 rounded-lg border border-gray-100 bg-slate-50 p-3">
                  <p className="mb-1 text-xs font-semibold text-slate-500">
                    Предпросмотр условия
                  </p>
                  <ProblemContent body={statement} />
                </div>
              )}
            </>
          )}

          {error && (
            <p className="text-sm text-rose-600">
              {error}
            </p>
          )}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            {canEdit && (
              <button
                type="submit"
                disabled={saving || loading}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {saving
                  ? "Сохранение..."
                  : mode === "edit"
                    ? "Сохранить изменения"
                    : "Создать задачу"}
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-gray-50"
            >
              Закрыть
            </button>

            {allowStatusActions && problemId && canModerate && currentStatus && (
              <div className="ml-auto flex flex-wrap items-center gap-2">
                {currentStatus === "draft" && (
                  <button
                    type="button"
                    onClick={() => doStatusAction("submit-review")}
                    disabled={actionInProgress}
                    className="rounded-lg bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-100 disabled:opacity-50"
                  >
                    На проверку
                  </button>
                )}
                {currentStatus === "pending_review" && (
                  <>
                    <button
                      type="button"
                      onClick={() => doStatusAction("publish")}
                      disabled={actionInProgress}
                      className="rounded-lg bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-100 disabled:opacity-50"
                    >
                      Одобрить
                    </button>
                    <button
                      type="button"
                      onClick={() => doStatusAction("reject")}
                      disabled={actionInProgress}
                      className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                    >
                      Отклонить
                    </button>
                  </>
                )}
                {currentStatus === "published" && (
                  <button
                    type="button"
                    onClick={() => doStatusAction("archive")}
                    disabled={actionInProgress}
                    className="rounded-lg bg-gray-100 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-gray-200 disabled:opacity-50"
                  >
                    В архив
                  </button>
                )}
                <button
                  type="button"
                  onClick={doDelete}
                  disabled={actionInProgress}
                  className="rounded-lg bg-rose-50 px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100 disabled:opacity-50"
                >
                  Удалить
                </button>
              </div>
            )}
          </div>
        </form>
      </div>
    </div>
  );
}


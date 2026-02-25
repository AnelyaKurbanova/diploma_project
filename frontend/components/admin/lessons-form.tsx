'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";

type Subject = {
  id: string;
  code: string;
  name_ru: string;
};

type Topic = {
  id: string;
  subject_id: string;
  parent_topic_id: string | null;
  title_ru: string;
  order_no: number;
};

type Lesson = {
  id: string;
  topic_id: string;
  title: string;
  order_no: number;
  status: "draft" | "pending_review" | "published" | "archived";
  created_at: string;
};

type ContentBlockProblem = {
  problem_id: string;
  order_no: number;
};

type ContentBlock = {
  id: string;
  block_type: "lecture" | "video" | "problem_set";
  order_no: number;
  title: string | null;
  body: string | null;
  video_url: string | null;
  video_description: string | null;
  problems: ContentBlockProblem[];
  created_at: string;
  updated_at: string;
};

type LessonDetail = Lesson & {
  content_blocks: ContentBlock[];
  theory_body: string | null;
  problem_ids: string[];
};

type Problem = {
  id: string;
  title: string;
  topic_id: string | null;
  difficulty: string;
  type: string;
};

type ProblemListResponse = {
  items: Problem[];
  total: number;
  page: number;
  per_page: number;
};

type LessonsFormProps = {
  accessToken: string;
  userRole: string;
};

const EMPTY_LESSON_FORM = {
  title: "",
  order_no: "0",
};

const EMPTY_BLOCK_FORM = {
  block_type: "lecture" as "lecture" | "video" | "problem_set",
  order_no: "0",
  title: "",
  body: "",
  video_url: "",
  video_description: "",
};

const BLOCK_LABELS = {
  lecture: "Лекция",
  video: "Видео",
  problem_set: "Задачи",
};

const LESSON_STATUS_LABELS: Record<
  Lesson["status"],
  { label: string; cls: string }
> = {
  draft: { label: "Черновик", cls: "bg-gray-100 text-gray-600" },
  pending_review: { label: "На проверке", cls: "bg-amber-50 text-amber-700" },
  published: { label: "Опубликовано", cls: "bg-emerald-50 text-emerald-700" },
  archived: { label: "Архив", cls: "bg-slate-100 text-slate-500" },
};

export function LessonsForm({ accessToken, userRole }: LessonsFormProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [problems, setProblems] = useState<Problem[]>([]);

  const [selectedSubject, setSelectedSubject] = useState("");
  const [selectedTopic, setSelectedTopic] = useState("");
  const [selectedLessonId, setSelectedLessonId] = useState<string | null>(null);

  const [lessonForm, setLessonForm] = useState(EMPTY_LESSON_FORM);
  const [editingLessonId, setEditingLessonId] = useState<string | null>(null);

  const [lessonDetail, setLessonDetail] = useState<LessonDetail | null>(null);
  const [blockForm, setBlockForm] = useState(EMPTY_BLOCK_FORM);
  const [selectedProblemIds, setSelectedProblemIds] = useState<string[]>([]);
  const [editingBlockId, setEditingBlockId] = useState<string | null>(null);

  const [loadingTopics, setLoadingTopics] = useState(false);
  const [loadingLessons, setLoadingLessons] = useState(false);
  const [loadingLessonDetail, setLoadingLessonDetail] = useState(false);
  const [submittingLesson, setSubmittingLesson] = useState(false);
  const [submittingBlock, setSubmittingBlock] = useState(false);
  const [movingBlock, setMovingBlock] = useState(false);
  const [generatingDraft, setGeneratingDraft] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lessonActionInProgress, setLessonActionInProgress] = useState<string | null>(null);
  const isModerator = userRole === "moderator" || userRole === "admin";

  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Subject[]>("/subjects", accessToken);
        setSubjects(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить предметы");
      }
    })();
  }, [accessToken]);

  useEffect(() => {
    if (!selectedSubject) {
      setTopics([]);
      setLessons([]);
      setSelectedTopic("");
      setSelectedLessonId(null);
      setLessonDetail(null);
      return;
    }

    (async () => {
      setLoadingTopics(true);
      try {
        const data = await apiGet<Topic[]>(
          `/topics?subject_id=${selectedSubject}`,
          accessToken,
        );
        setTopics(data);
      } catch {
        setTopics([]);
      } finally {
        setLoadingTopics(false);
      }
    })();

  }, [accessToken, selectedSubject]);

  useEffect(() => {
    if (!selectedTopic) {
      setProblems([]);
      return;
    }

    (async () => {
      try {
        const data = await apiGet<ProblemListResponse>(
          `/admin/problems?topic_id=${selectedTopic}&per_page=100&page=1`,
          accessToken,
        );
        setProblems(data.items);
      } catch {
        setProblems([]);
      }
    })();
  }, [accessToken, selectedTopic]);

  const loadLessons = useCallback(async () => {
    if (!selectedTopic) {
      setLessons([]);
      setSelectedLessonId(null);
      setLessonDetail(null);
      return;
    }

    setLoadingLessons(true);
    try {
      const data = await apiGet<Lesson[]>(
        `/topics/${selectedTopic}/lessons?admin_view=1`,
        accessToken,
      );
      setLessons(data);
    } catch {
      setLessons([]);
    } finally {
      setLoadingLessons(false);
    }
  }, [accessToken, selectedTopic]);

  useEffect(() => {
    loadLessons();
  }, [loadLessons]);

  const loadLessonDetail = useCallback(async (lessonId: string) => {
    setLoadingLessonDetail(true);
    try {
      const data = await apiGet<LessonDetail>(`/lessons/${lessonId}?admin_view=1`, accessToken);
      setLessonDetail(data);
    } catch (err) {
      setLessonDetail(null);
      setError(err instanceof Error ? err.message : "Не удалось загрузить урок");
    } finally {
      setLoadingLessonDetail(false);
    }
  }, [accessToken]);

  useEffect(() => {
    if (!selectedLessonId) {
      setLessonDetail(null);
      return;
    }
    loadLessonDetail(selectedLessonId);
  }, [selectedLessonId, loadLessonDetail]);

  const topicOptions = useMemo(() => {
    return topics
      .slice()
      .sort((a, b) => a.order_no - b.order_no)
      .map((topic) => ({
        ...topic,
        label: topic.parent_topic_id ? `  - ${topic.title_ru}` : topic.title_ru,
      }));
  }, [topics]);

  const topicHasLesson = lessons.length > 0;
  const usedBlockTypes = new Set(
    (lessonDetail?.content_blocks ?? []).map((block) => block.block_type),
  );
  const canCreateLectureBlock = !usedBlockTypes.has("lecture");
  const canCreateVideoBlock = !usedBlockTypes.has("video");
  const isDuplicatePrimaryBlockType =
    !editingBlockId &&
    ((blockForm.block_type === "lecture" && !canCreateLectureBlock) ||
      (blockForm.block_type === "video" && !canCreateVideoBlock) ||
      (blockForm.block_type === "problem_set" && usedBlockTypes.has("problem_set")));

  useEffect(() => {
    if (lessons.length === 0) {
      if (selectedLessonId) {
        setSelectedLessonId(null);
      }
      setLessonDetail(null);
      return;
    }

    if (!selectedLessonId) {
      setSelectedLessonId(lessons[0].id);
      return;
    }

    const exists = lessons.some((lesson) => lesson.id === selectedLessonId);
    if (!exists) {
      setSelectedLessonId(lessons[0].id);
      setLessonDetail(null);
    }
  }, [lessons, selectedLessonId]);

  useEffect(() => {
    if (editingBlockId) return;
    if (blockForm.block_type === "lecture" && canCreateLectureBlock) return;
    if (blockForm.block_type === "video" && canCreateVideoBlock) return;
    if (blockForm.block_type === "problem_set") return;

    if (canCreateLectureBlock) {
      setBlockForm((f) => ({ ...f, block_type: "lecture" }));
      return;
    }
    if (canCreateVideoBlock) {
      setBlockForm((f) => ({ ...f, block_type: "video" }));
      return;
    }
    setBlockForm((f) => ({ ...f, block_type: "problem_set" }));
  }, [
    editingBlockId,
    blockForm.block_type,
    canCreateLectureBlock,
    canCreateVideoBlock,
  ]);

  const resetLessonForm = () => {
    setLessonForm(EMPTY_LESSON_FORM);
    setEditingLessonId(null);
  };

  const resetBlockForm = () => {
    setBlockForm(EMPTY_BLOCK_FORM);
    setSelectedProblemIds([]);
    setEditingBlockId(null);
  };

  const startEditLesson = (lesson: Lesson) => {
    setEditingLessonId(lesson.id);
    setLessonForm({
      title: lesson.title,
      order_no: String(lesson.order_no),
    });
    setError(null);
    setSuccess(null);
  };

  const startEditBlock = (block: ContentBlock) => {
    setEditingBlockId(block.id);
    setBlockForm({
      block_type: block.block_type,
      order_no: String(block.order_no),
      title: block.title ?? "",
      body: block.body ?? "",
      video_url: block.video_url ?? "",
      video_description: block.video_description ?? "",
    });
    setSelectedProblemIds(block.problems.map((p) => p.problem_id));
    setError(null);
    setSuccess(null);
  };

  const handleLessonSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTopic) {
      setError("Сначала выберите тему");
      return;
    }
    if (!editingLessonId && topicHasLesson) {
      setError("В этой теме уже есть лекция. Можно только редактировать существующую.");
      return;
    }

    setSubmittingLesson(true);
    setError(null);
    setSuccess(null);

    try {
      const body = {
        title: lessonForm.title,
        order_no: Number(lessonForm.order_no),
      };

      if (editingLessonId) {
        await apiPatch(`/lessons/${editingLessonId}`, body, accessToken);
        setSuccess("Урок обновлен");
      } else {
        await apiPost(`/topics/${selectedTopic}/lessons`, body, accessToken);
      setSuccess("Урок создан");
      }

      resetLessonForm();
      await loadLessons();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении урока");
    } finally {
      setSubmittingLesson(false);
    }
  };

  const handleGenerateDraft = async (lessonId: string) => {
    setGeneratingDraft(lessonId);
    setError(null);
    setSuccess(null);
    try {
      await apiPost(`/lessons/${lessonId}/generate-draft`, undefined, accessToken);
      await loadLessonDetail(lessonId);
      setSuccess("Черновик лекции сгенерирован");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при генерации черновика");
    } finally {
      setGeneratingDraft(null);
    }
  };

  const handleLessonAction = async (
    lessonId: string,
    action: "submit-review" | "publish" | "reject" | "archive",
  ) => {
    setLessonActionInProgress(lessonId);
    setError(null);
    setSuccess(null);
    try {
      await apiPost(`/lessons/${lessonId}/${action}`, undefined, accessToken);
      await loadLessons();
      if (selectedLessonId) {
        await loadLessonDetail(selectedLessonId);
      }
      setSuccess("Статус лекции обновлен");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при изменении статуса");
    } finally {
      setLessonActionInProgress(null);
    }
  };

  const handleLessonDelete = async (lessonId: string) => {
    if (!confirm("Удалить урок? Это действие нельзя отменить.")) return;

    setError(null);
    setSuccess(null);

    try {
      await apiDelete(`/lessons/${lessonId}`, accessToken);
      if (selectedLessonId === lessonId) {
        setSelectedLessonId(null);
        setLessonDetail(null);
      }
      if (editingLessonId === lessonId) {
        resetLessonForm();
      }
      await loadLessons();
      setSuccess("Урок удален");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при удалении урока");
    }
  };

  const handleBlockSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedLessonId) {
      setError("Сначала выберите урок");
      return;
    }
    if (isDuplicatePrimaryBlockType) {
      setError(`Блок типа "${BLOCK_LABELS[blockForm.block_type]}" уже существует в этой лекции`);
      return;
    }
    if (blockForm.block_type === "problem_set" && selectedProblemIds.length === 0) {
      setError("Выберите хотя бы одну задачу для блока");
      return;
    }

    setSubmittingBlock(true);
    setError(null);
    setSuccess(null);

    try {
      const payload: Record<string, unknown> = {
        block_type: blockForm.block_type,
        order_no: Number(blockForm.order_no),
        title: blockForm.title || null,
      };

      if (blockForm.block_type === "lecture") {
        payload.body = blockForm.body || null;
      }

      if (blockForm.block_type === "video") {
        payload.video_url = blockForm.video_url || null;
        payload.video_description = blockForm.video_description || null;
      }

      if (blockForm.block_type === "problem_set") {
        payload.problem_ids = selectedProblemIds;
        payload.body = blockForm.body || null;
      }

      if (editingBlockId) {
        delete payload.block_type;
        await apiPatch(`/blocks/${editingBlockId}`, payload, accessToken);
        setSuccess("Блок обновлен");
      } else {
        await apiPost(`/lessons/${selectedLessonId}/blocks`, payload, accessToken);
        setSuccess("Блок создан");
      }

      resetBlockForm();
      await loadLessonDetail(selectedLessonId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении блока");
    } finally {
      setSubmittingBlock(false);
    }
  };

  const handleDeleteBlock = async (blockId: string) => {
    if (!confirm("Удалить блок? Это действие нельзя отменить.")) return;
    if (!selectedLessonId) return;

    setError(null);
    setSuccess(null);

    try {
      await apiDelete(`/blocks/${blockId}`, accessToken);
      if (editingBlockId === blockId) {
        resetBlockForm();
      }
      await loadLessonDetail(selectedLessonId);
      setSuccess("Блок удален");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при удалении блока");
    }
  };

  const handleMoveBlock = async (blockId: string, direction: "up" | "down") => {
    if (!lessonDetail || !selectedLessonId || movingBlock) return;
    const ordered = lessonDetail.content_blocks
      .slice()
      .sort((a, b) => a.order_no - b.order_no);
    const index = ordered.findIndex((block) => block.id === blockId);
    if (index < 0) return;

    const swapIndex = direction === "up" ? index - 1 : index + 1;
    if (swapIndex < 0 || swapIndex >= ordered.length) return;

    const reordered = ordered.slice();
    const [moved] = reordered.splice(index, 1);
    reordered.splice(swapIndex, 0, moved);

    setError(null);
    setSuccess(null);
    setMovingBlock(true);
    try {
      for (let i = 0; i < reordered.length; i++) {
        const block = reordered[i];
        if (block.order_no !== i) {
          await apiPatch(`/blocks/${block.id}`, { order_no: i }, accessToken);
        }
      }
      await loadLessonDetail(selectedLessonId);
      setSuccess("Порядок блоков обновлен");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при изменении порядка блоков");
    } finally {
      setMovingBlock(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm sm:grid-cols-2">
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Предмет</label>
          <select
            value={selectedSubject}
            onChange={(e) => {
              setSelectedSubject(e.target.value);
              setSelectedTopic("");
              setSelectedLessonId(null);
            }}
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
            value={selectedTopic}
            onChange={(e) => {
              setSelectedTopic(e.target.value);
              setSelectedLessonId(null);
              setLessonDetail(null);
              resetLessonForm();
              resetBlockForm();
            }}
            disabled={!selectedSubject || loadingTopics}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50"
          >
            <option value="">{loadingTopics ? "Загрузка тем..." : "Выберите тему"}</option>
            {topicOptions.map((topic) => (
              <option key={topic.id} value={topic.id}>{topic.label}</option>
            ))}
          </select>
        </div>
      </div>

      <form onSubmit={handleLessonSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            {editingLessonId ? "Редактировать лекцию" : "Добавить лекцию в тему"}
          </h3>
          {editingLessonId && (
            <button
              type="button"
              onClick={resetLessonForm}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Отменить редактирование
            </button>
          )}
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Название урока</label>
            <input
              type="text"
              required
              minLength={1}
              maxLength={255}
              value={lessonForm.title}
              onChange={(e) => setLessonForm((f) => ({ ...f, title: e.target.value }))}
              placeholder="Лекция по теме"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Порядок</label>
            <input
              type="number"
              min={0}
              value={lessonForm.order_no}
              onChange={(e) => setLessonForm((f) => ({ ...f, order_no: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submittingLesson || !selectedTopic || (!editingLessonId && topicHasLesson)}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {submittingLesson
            ? "Сохранение..."
            : editingLessonId
              ? "Сохранить лекцию"
              : topicHasLesson
                ? "Лекция уже создана"
                : "Создать лекцию"}
        </button>
      </form>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">Лекция темы</h3>
        </div>

        {!selectedTopic ? (
          <p className="p-6 text-center text-sm text-slate-400">Выберите тему, чтобы увидеть лекцию</p>
        ) : loadingLessons ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : lessons.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">В этой теме пока нет лекции</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {lessons
              .slice()
              .sort((a, b) => a.order_no - b.order_no)
              .map((lesson) => (
                <div
                  key={lesson.id}
                  className={`flex items-center justify-between px-6 py-3 transition-colors ${
                    selectedLessonId === lesson.id ? "bg-blue-50/60" : "hover:bg-gray-50"
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => setSelectedLessonId(lesson.id)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <p className="truncate font-medium text-slate-900">{lesson.title}</p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-400">
                      <span>Порядок: {lesson.order_no}</span>
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${
                          LESSON_STATUS_LABELS[lesson.status].cls
                        }`}
                      >
                        {LESSON_STATUS_LABELS[lesson.status].label}
                      </span>
                    </div>
                  </button>

                  <div className="ml-4 flex shrink-0 items-center gap-2">
                    {lesson.status === "draft" && (
                      <button
                        type="button"
                        onClick={() => handleLessonAction(lesson.id, "submit-review")}
                        disabled={lessonActionInProgress === lesson.id}
                        className="rounded-md px-2 py-1 text-xs font-medium text-amber-700 transition-colors hover:bg-amber-50 disabled:opacity-50"
                      >
                        На проверку
                      </button>
                    )}
                    {lesson.status === "pending_review" && isModerator && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleLessonAction(lesson.id, "publish")}
                          disabled={lessonActionInProgress === lesson.id}
                          className="rounded-md px-2 py-1 text-xs font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
                        >
                          Одобрить
                        </button>
                        <button
                          type="button"
                          onClick={() => handleLessonAction(lesson.id, "reject")}
                          disabled={lessonActionInProgress === lesson.id}
                          className="rounded-md px-2 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:opacity-50"
                        >
                          Отклонить
                        </button>
                      </>
                    )}
                    {lesson.status === "published" && isModerator && (
                      <button
                        type="button"
                        onClick={() => handleLessonAction(lesson.id, "archive")}
                        disabled={lessonActionInProgress === lesson.id}
                        className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-50"
                      >
                        В архив
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => startEditLesson(lesson)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                    >
                      Редактировать
                    </button>
                    <button
                      type="button"
                      onClick={() => handleLessonDelete(lesson.id)}
                      className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                    >
                      Удалить
                    </button>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {selectedLessonId && (
        <div className="space-y-6">
          <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <p className="text-sm text-slate-600">
              Сгенерировать лекцию на основе учебных материалов (RAG). Заменит текущий текст лекции. Сначала загрузите docx в базу знаний.
            </p>
            <button
              type="button"
              onClick={() => handleGenerateDraft(selectedLessonId)}
              disabled={generatingDraft === selectedLessonId}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {generatingDraft === selectedLessonId ? "Генерация..." : "Сгенерировать лекцию"}
            </button>
          </div>
          <form onSubmit={handleBlockSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">
                {editingBlockId ? "Редактировать блок" : "Добавить блок в урок"}
              </h3>
              {editingBlockId && (
                <button
                  type="button"
                  onClick={resetBlockForm}
                  className="text-xs text-slate-500 hover:text-slate-700"
                >
                  Отменить редактирование
                </button>
              )} 
            </div>

            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Тип блока</label>
                <select
                  value={blockForm.block_type}
                  onChange={(e) => {
                    setBlockForm((f) => ({
                      ...f,
                      block_type: e.target.value as "lecture" | "video" | "problem_set",
                      body: "",
                      video_url: "",
                      video_description: "",
                    }));
                    setSelectedProblemIds([]);
                  }}
                  disabled={Boolean(editingBlockId)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:bg-slate-50"
                >
                  <option value="lecture" disabled={!editingBlockId && !canCreateLectureBlock}>Лекция</option>
                  <option value="video" disabled={!editingBlockId && !canCreateVideoBlock}>Видео</option>
                  <option value="problem_set" disabled={!editingBlockId && usedBlockTypes.has("problem_set")}>Задачи</option>
                </select>
                <p className="mt-1 text-[11px] text-slate-400">
                  Для темы допускается по одному блоку лекции, видео и задач.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Порядок</label>
                <input
                  type="number"
                  min={0}
                  value={blockForm.order_no}
                  onChange={(e) => setBlockForm((f) => ({ ...f, order_no: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Заголовок</label>
                <input
                  type="text"
                  maxLength={255}
                  value={blockForm.title}
                  onChange={(e) => setBlockForm((f) => ({ ...f, title: e.target.value }))}
                  placeholder="Необязательно"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
            </div>

            {blockForm.block_type === "lecture" && (
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Текст лекции</label>
                <textarea
                  rows={6}
                  value={blockForm.body}
                  onChange={(e) => setBlockForm((f) => ({ ...f, body: e.target.value }))}
                  placeholder="Поддерживается markdown, включая изображения: ![alt](https://s3-url/image.png)"
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                />
              </div>
            )}

            {blockForm.block_type === "video" && (
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">URL видео</label>
                  <input
                    type="url"
                    value={blockForm.video_url}
                    onChange={(e) => setBlockForm((f) => ({ ...f, video_url: e.target.value }))}
                    placeholder="https://..."
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Описание видео</label>
                  <input
                    type="text"
                    value={blockForm.video_description}
                    onChange={(e) => setBlockForm((f) => ({ ...f, video_description: e.target.value }))}
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>
              </div>
            )}

            {blockForm.block_type === "problem_set" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Выберите задачи темы
                  </label>
                  <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 p-3">
                    {problems.length === 0 ? (
                      <p className="text-xs text-slate-400">
                        В выбранной теме пока нет задач.
                      </p>
                    ) : (
                      <div className="space-y-2">
                        {problems.map((problem) => {
                          const checked = selectedProblemIds.includes(problem.id);
                          return (
                            <label
                              key={problem.id}
                              className="flex cursor-pointer items-start gap-2 rounded px-2 py-1 hover:bg-slate-50"
                            >
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(e) => {
                                  setSelectedProblemIds((prev) =>
                                    e.target.checked
                                      ? [...prev, problem.id]
                                      : prev.filter((id) => id !== problem.id),
                                  );
                                }}
                                className="mt-0.5"
                              />
                              <span className="min-w-0 text-sm text-slate-700">
                                <span className="block truncate font-medium">{problem.title}</span>
                                <span className="text-xs text-slate-400">
                                  {problem.type} • {problem.difficulty}
                                </span>
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Выбрано задач: {selectedProblemIds.length}
                  </p>
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={submittingBlock || isDuplicatePrimaryBlockType}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {submittingBlock
                ? "Сохранение..."
                : editingBlockId
                  ? "Сохранить блок"
                  : "Добавить блок"}
            </button>
            {isDuplicatePrimaryBlockType && (
              <p className="text-xs text-amber-700">
                Этот тип блока уже есть. Выберите другой тип блока.
              </p>
            )}
          </form>

          <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
            <div className="border-b border-gray-100 px-6 py-4">
              <h3 className="text-base font-bold text-slate-900">Контент урока</h3>
            </div>

            {loadingLessonDetail ? (
              <div className="space-y-2 p-6">
                {Array.from({ length: 3 }).map((_, i) => (
                  <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
                ))}
              </div>
            ) : !lessonDetail || lessonDetail.content_blocks.length === 0 ? (
              <p className="p-6 text-center text-sm text-slate-400">Блоки еще не добавлены</p>
            ) : (
              <div className="divide-y divide-gray-50">
                {lessonDetail.content_blocks
                  .slice()
                  .sort((a, b) => a.order_no - b.order_no)
                  .map((block, index, arr) => (
                    <div key={block.id} className="px-6 py-4">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-sm font-semibold text-slate-900">
                            {BLOCK_LABELS[block.block_type]} - {block.title ?? "Без названия"}
                          </p>
                          <p className="text-xs text-slate-400">Порядок: {block.order_no}</p>
                          {block.block_type === "lecture" && block.body && (
                            <p className="mt-2 line-clamp-3 text-sm text-slate-600">{block.body}</p>
                          )}
                          {block.block_type === "video" && block.video_url && (
                            <p className="mt-2 line-clamp-2 text-xs text-slate-500">{block.video_url}</p>
                          )}
                          {block.block_type === "problem_set" && (
                            <p className="mt-2 text-xs text-slate-500">
                              Задач в блоке: {block.problems.length}
                            </p>
                          )}
                        </div>

                        <div className="flex shrink-0 items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(block.id, "up")}
                            disabled={index === 0 || movingBlock}
                            className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
                          >
                            ↑
                          </button>
                          <button
                            type="button"
                            onClick={() => handleMoveBlock(block.id, "down")}
                            disabled={index === arr.length - 1 || movingBlock}
                            className="rounded-md px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100 disabled:opacity-40"
                          >
                            ↓
                          </button>
                          <button
                            type="button"
                            onClick={() => startEditBlock(block)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50"
                          >
                            Редактировать
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteBlock(block.id)}
                            className="rounded-md px-2 py-1 text-xs font-medium text-rose-600 transition-colors hover:bg-rose-50"
                          >
                            Удалить
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
              </div>
            )}
          </div>
        </div>
      )}

      {error && <p className="text-sm text-rose-600">{error}</p>}
      {success && <p className="text-sm text-emerald-600">{success}</p>}
    </div>
  );
}

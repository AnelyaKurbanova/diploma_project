'use client';

import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDelete, apiGet, apiPatch, apiPost } from "@/lib/api";
import { ProblemEditorModal, type ProblemEditorResult } from "@/components/admin/problem-editor-modal";

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
  grade_level: number | null;
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
  status: string;
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
};

const EMPTY_BLOCK_FORM = {
  block_type: "lecture" as "lecture" | "video" | "problem_set",
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
  const [generatingProblems, setGeneratingProblems] = useState<string | null>(null);
  const [problemsCount, setProblemsCount] = useState(10);
  const [problemsGenerationLessonId, setProblemsGenerationLessonId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lessonActionInProgress, setLessonActionInProgress] = useState<string | null>(null);
  const isModerator = userRole === "moderator" || userRole === "admin";

  const [creatingVideoJob, setCreatingVideoJob] = useState(false);

  const [problemModalOpen, setProblemModalOpen] = useState(false);
  const [problemModalMode, setProblemModalMode] = useState<"create" | "edit" | "view">("create");
  const [problemModalProblemId, setProblemModalProblemId] = useState<string | null>(null);

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

  const loadProblemsForTopic = useCallback(async () => {
    if (!selectedTopic) {
      setProblems([]);
      return;
    }

    try {
      const data = await apiGet<ProblemListResponse>(
        `/admin/problems?topic_id=${selectedTopic}&per_page=100&page=1`,
        accessToken,
      );
      const visibleProblems = data.items.filter((problem) => problem.status !== "archived");
      setProblems(visibleProblems);
    } catch {
      setProblems([]);
    }
  }, [accessToken, selectedTopic]);

  useEffect(() => {
    void loadProblemsForTopic();
  }, [loadProblemsForTopic]);

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
        label: topic.title_ru,
      }));
  }, [topics]);

  const usedBlockTypes = new Set(
    (lessonDetail?.content_blocks ?? []).map((block) => block.block_type),
  );
  const lessonProblems = useMemo(
    () => problems.filter((p) => selectedProblemIds.includes(p.id)),
    [problems, selectedProblemIds],
  );
  const canCreateLectureBlock = !usedBlockTypes.has("lecture");
  const canCreateVideoBlock = !usedBlockTypes.has("video");
  const canCreateProblemBlock = !usedBlockTypes.has("problem_set");
  const canAddAnyBlock =
    canCreateLectureBlock || canCreateVideoBlock || canCreateProblemBlock;
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
    });
    setError(null);
    setSuccess(null);
  };

  const startEditBlock = (block: ContentBlock) => {
    setEditingBlockId(block.id);
    setBlockForm({
      block_type: block.block_type,
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

    setSubmittingLesson(true);
    setError(null);
    setSuccess(null);

    try {
      const body = {
        title: lessonForm.title,
        order_no: 0,
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

  const hasLectureBody = (detail: LessonDetail | null): boolean => {
    if (!detail) return false;
    const lecture = detail.content_blocks.find((b) => b.block_type === "lecture");
    return Boolean(lecture?.body?.trim());
  };

  const pollGeneratedDraft = useCallback(
    async (lessonId: string) => {
      const maxAttempts = 36; // 36 * 5с ≈ 3 минуты
      const delayMs = 5000;

      setGeneratingDraft(lessonId);

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const detail = await apiGet<LessonDetail>(
            `/lessons/${lessonId}?admin_view=1`,
            accessToken,
          );

          if (hasLectureBody(detail)) {
            setLessonDetail(detail);
            setGeneratingDraft(null);
            setSuccess("Черновик лекции сгенерирован.");
            return;
          }
        } catch {
          // продолжаем опрос при временных ошибках
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      setGeneratingDraft(null);
      setSuccess(
        "Генерация лекции всё ещё выполняется. Обновите урок вручную чуть позже.",
      );
    },
    [accessToken],
  );

  const handleGenerateDraft = async (lessonId: string) => {
    setError(null);
    setSuccess(null);
    try {
      await apiPost(`/lessons/${lessonId}/generate-draft`, undefined, accessToken);
      setSuccess("Генерация лекции запущена. Ожидайте обновления блока лекции.");
      void pollGeneratedDraft(lessonId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при генерации черновика");
    }
  };

  const countProblemsInLesson = (detail: LessonDetail | null): number => {
    if (!detail) return 0;
    return detail.content_blocks
      .filter((b) => b.block_type === "problem_set")
      .reduce((sum, b) => sum + (b.problems?.length ?? 0), 0);
  };

  const pollGeneratedProblems = useCallback(
    async (lessonId: string, initialCount: number) => {
      const maxAttempts = 60; // 60 * 5с = ~5 минут
      const delayMs = 5000;

      setProblemsGenerationLessonId(lessonId);

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        try {
          const detail = await apiGet<LessonDetail>(
            `/lessons/${lessonId}?admin_view=1`,
            accessToken,
          );

          const currentCount = countProblemsInLesson(detail);

          if (currentCount > initialCount) {
            setLessonDetail(detail);
            setProblemsGenerationLessonId(null);
            const created = currentCount - initialCount;
            setSuccess(
              created > 0
                ? `Генерация задач завершена, добавлено ${created} задач.`
                : "Генерация задач завершена.",
            );
            return;
          }
        } catch (err) {
          // При ошибке продолжаем попытки, чтобы не терять прогресс из-за временных сбоев сети.
          // Если ошибка постоянная, цикл завершится по таймауту.
        }

        await new Promise((resolve) => setTimeout(resolve, delayMs));
      }

      setProblemsGenerationLessonId(null);
      setSuccess(
        "Генерация задач всё ещё выполняется. Обновите урок вручную чуть позже, чтобы увидеть результат.",
      );
    },
    [accessToken],
  );

  const handleGenerateProblems = async (lessonId: string) => {
    if (!Number.isFinite(problemsCount) || problemsCount <= 0 || problemsCount > 100) {
      setError("Введите корректное количество задач (от 1 до 100).");
      return;
    }

    setGeneratingProblems(lessonId);
    setError(null);
    setSuccess(null);
    try {
      const initialCount = countProblemsInLesson(lessonDetail);

      const res = await apiPost<{ status?: string; message?: string }>(
        `/lessons/${lessonId}/generate-problems`,
        { count: problemsCount },
        accessToken,
      );
      setSuccess(
        res?.message ??
          "Генерация задач запущена. Мы автоматически обновим блок задач после завершения.",
      );

      // Не блокируем UI ожиданием — отслеживаем прогресс в фоне.
      void pollGeneratedProblems(lessonId, initialCount);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ошибка при генерации задач для урока",
      );
    } finally {
      setGeneratingProblems(null);
    }
  };

  const persistGeneratedVideoUrl = useCallback(
    async (videoUrl: string) => {
      if (!selectedLessonId) return;

      const existingVideoBlock =
        (editingBlockId
          ? lessonDetail?.content_blocks.find(
              (b) => b.id === editingBlockId && b.block_type === "video",
            )
          : null) ??
        lessonDetail?.content_blocks.find((b) => b.block_type === "video") ??
        null;

      if (existingVideoBlock) {
        await apiPatch(
          `/blocks/${existingVideoBlock.id}`,
          {
            video_url: videoUrl,
          },
          accessToken,
        );
        setEditingBlockId(existingVideoBlock.id);
      } else {
        const maxOrder = Math.max(
          -1,
          ...(lessonDetail?.content_blocks.map((b) => b.order_no) ?? []),
        );
        const created = await apiPost<ContentBlock>(
          `/lessons/${selectedLessonId}/blocks`,
          {
            block_type: "video",
            order_no: maxOrder + 1,
            title: blockForm.title || "Видео",
            video_url: videoUrl,
            video_description: blockForm.video_description || null,
          },
          accessToken,
        );
        setEditingBlockId(created.id);
      }

      setBlockForm((f) => ({
        ...f,
        block_type: "video",
        video_url: videoUrl,
      }));

      await loadLessonDetail(selectedLessonId);
    },
    [
      accessToken,
      blockForm.title,
      blockForm.video_description,
      editingBlockId,
      lessonDetail?.content_blocks,
      loadLessonDetail,
      selectedLessonId,
    ],
  );

  const handleCreateVideoForBlock = async () => {
    if (!selectedTopic || !selectedLessonId) {
      setError("Сначала выберите тему и урок, для которого нужно сгенерировать видео.");
      return;
    }
    setCreatingVideoJob(true);
    setError(null);
    setSuccess(null);
    try {
      // 1) Создаем задачу генерации видео по теме урока
      const createRes = await apiPost<{ job_id: string; status: string }>(
        `/topics/${selectedTopic}/video`,
        { lesson_id: selectedLessonId },
        accessToken,
      );

      // 2) Клиентский опрос статуса раз в 5 секунд
      const jobId = createRes.job_id;
      const maxAttempts = 60; // 60 * 5с = 5 минут
      let lastStatus: string | null = null;
      let lastError: string | null = null;
      let lastS3Url: string | null = null;

      for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
        const job = await apiGet<{
          job_id: string;
          status: string;
          s3_url: string | null;
          presigned_url: string | null;
          error: string | null;
        }>(
          `/video-jobs/${jobId}`,
          accessToken,
        );

        lastStatus = job.status;
        lastError = job.error ?? null;
        lastS3Url = job.s3_url ?? null;

        if (job.status === "done" && job.s3_url) {
          await persistGeneratedVideoUrl(job.s3_url);
          setSuccess("Видео сгенерировано: ссылка автоматически сохранена в блоке и обновлена.");
          return;
        }

        if (job.status === "failed") {
          setError(job.error || "Видео по уроку не удалось сгенерировать.");
          setCreatingVideoJob(false);
          return;
        }

        // Если ещё в процессе — ждём 5 секунд и опрашиваем снова.
        await new Promise(resolve => setTimeout(resolve, 5000));
      }

      // Если вышли по таймауту цикла, показываем последнее известное состояние
      if (lastStatus === "done" && lastS3Url) {
        await persistGeneratedVideoUrl(lastS3Url);
        setSuccess("Видео сгенерировано: ссылка автоматически сохранена в блоке и обновлена.");
      } else if (lastStatus === "failed") {
        setError(lastError || "Видео по уроку не удалось сгенерировать.");
      } else {
        setSuccess("Генерация видео по уроку запущена, но ещё не завершена. Попробуйте снова чуть позже.");
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ошибка при запуске или ожидании генерации видео для урока",
      );
    } finally {
      setCreatingVideoJob(false);
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
        order_no: 0,
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

      {selectedTopic && (
      <form onSubmit={handleLessonSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            {editingLessonId ? "Редактировать урок" : "Добавить урок в тему"}
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
              placeholder="Урок по теме"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
        </div>

        <button
          type="submit"
          disabled={submittingLesson || !selectedTopic}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {submittingLesson
            ? "Сохранение..."
            : editingLessonId
              ? "Сохранить урок"
              : "Создать урок"}
        </button>
      </form>
      )}

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
          <p className="p-6 text-center text-sm text-slate-400">В этой теме пока нет уроков</p>
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
                      {lesson.grade_level != null && (
                        <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 font-medium text-blue-700">
                          {lesson.grade_level} класс
                        </span>
                      )}
                      <span
                        className={`rounded-full px-2 py-0.5 font-medium ${LESSON_STATUS_LABELS[lesson.status].cls}`}
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
          <div className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-gray-100 bg-white p-4 shadow-sm">
            <div className="text-sm text-slate-600">
              <p>
                Сгенерировать задачи по этой теме (RAG) и автоматически добавить их в блок{" "}
                <span className="font-semibold">«Задачи»</span> выбранного урока.
              </p>
              <p className="mt-1 text-xs text-slate-400">
                Генерация идёт в фоне; после завершения задачи появятся в блоке как задачи в статусе «на проверке».
              </p>
              {problemsGenerationLessonId === selectedLessonId && (
                <p className="mt-1 text-xs text-blue-600">
                  Идёт генерация задач для этого урока... Мы периодически обновляем блок задач, пока процесс не завершится.
                </p>
              )}
            </div>
            <div className="flex items-center gap-2">
              <label className="flex items-center gap-1 text-xs text-slate-600">
                <span>Количество задач:</span>
                <input
                  type="number"
                  min={1}
                  max={100}
                  value={problemsCount}
                  onChange={(e) => {
                    const value = Number(e.target.value.replace(/[^\d]/g, "")) || 1;
                    const clamped = Math.max(1, Math.min(100, value));
                    setProblemsCount(clamped);
                  }}
                  className="w-20 rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
                />
              </label>
              <button
                type="button"
                onClick={() => handleGenerateProblems(selectedLessonId)}
                disabled={generatingProblems === selectedLessonId}
                className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
              >
                {generatingProblems === selectedLessonId ? "Генерация задач..." : "Сгенерировать задачи"}
              </button>
            </div>
          </div>

          {(canAddAnyBlock || editingBlockId) ? (
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
              <div className="space-y-4">
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

                <div className="rounded-lg border border-purple-100 bg-purple-50/60 p-3">
                  <p className="mb-2 text-xs font-medium text-purple-800">
                    Сгенерировать видео по уроку
                  </p>
                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleCreateVideoForBlock}
                      disabled={creatingVideoJob || !selectedTopic}
                      className="rounded-lg bg-purple-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-purple-700 disabled:opacity-50"
                    >
                      {creatingVideoJob ? "Запуск..." : "Сгенерировать видео"}
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-purple-700">
                    Будет создана задача генерации объясняющего видео по выбранному уроку (теме).
                    После завершения генерации ссылка на видео автоматически подставится в поле выше.
                  </p>
                </div>
              </div>
            )}

            {blockForm.block_type === "problem_set" && (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">
                      Выберите задачи темы
                    </label>
                    <p className="text-[11px] text-slate-400">
                      Можно создавать новые задачи и редактировать существующие.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setProblemModalMode("create");
                      setProblemModalProblemId(null);
                      setProblemModalOpen(true);
                    }}
                    disabled={!selectedSubject || !selectedTopic}
                    className="rounded-lg bg-emerald-600 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-emerald-700 disabled:opacity-50"
                  >
                    Создать задачу
                  </button>
                </div>
                <div className="max-h-64 overflow-y-auto rounded-lg border border-gray-200 p-3">
                  {problems.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      В выбранной теме пока нет задач.
                    </p>
                  ) : lessonProblems.length === 0 ? (
                    <p className="text-xs text-slate-400">
                      У этого урока пока нет собственных задач. Создайте их вручную или сгенерируйте через ИИ.
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {lessonProblems.map((problem) => {
                        const checked = selectedProblemIds.includes(problem.id);
                        return (
                          <div
                            key={problem.id}
                            className="flex items-start justify-between gap-2 rounded px-2 py-1 hover:bg-slate-50"
                          >
                            <label className="flex cursor-pointer items-start gap-2">
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
                            <div className="mt-0.5 flex shrink-0 flex-col items-end gap-1">
                              <div className="flex gap-1">
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProblemModalMode("view");
                                    setProblemModalProblemId(problem.id);
                                    setProblemModalOpen(true);
                                  }}
                                  className="rounded-md border border-gray-200 px-2 py-0.5 text-[11px] text-slate-600 hover:bg-gray-50"
                                >
                                  Просмотр
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    setProblemModalMode("edit");
                                    setProblemModalProblemId(problem.id);
                                    setProblemModalOpen(true);
                                  }}
                                  className="rounded-md border border-blue-200 px-2 py-0.5 text-[11px] text-blue-600 hover:bg-blue-50"
                                >
                                  Редактировать
                                </button>
                              </div>
                              {problem.status === "draft" && (
                                <button
                                  type="button"
                                  onClick={async () => {
                                    setError(null);
                                    setSuccess(null);
                                    try {
                                      await apiPost(
                                        `/problems/${problem.id}/submit-review`,
                                        undefined,
                                        accessToken,
                                      );
                                      setSuccess("Задача отправлена на проверку");
                                      await loadProblemsForTopic();
                                    } catch (err) {
                                      setError(
                                        err instanceof Error
                                          ? err.message
                                          : "Не удалось отправить задачу на проверку",
                                      );
                                    }
                                  }}
                                  className="rounded-md bg-amber-50 px-2 py-0.5 text-[11px] font-medium text-amber-700 hover:bg-amber-100"
                                >
                                  На проверку
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
                <p className="mt-1 text-xs text-slate-500">
                  Выбрано задач: {selectedProblemIds.length}
                </p>
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
          ) : (
            <div className="rounded-xl border border-gray-100 bg-white p-4 text-sm text-slate-500 shadow-sm">
              Все типы блоков для этого урока уже добавлены.
            </div>
          )}

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

      {problemModalOpen && selectedTopic && selectedSubject && (
        <ProblemEditorModal
          accessToken={accessToken}
          isOpen={problemModalOpen}
          mode={problemModalMode}
          subjectId={selectedSubject}
          topicId={selectedTopic}
          problemId={problemModalProblemId ?? undefined}
          userRole={userRole}
          onClose={() => {
            setProblemModalOpen(false);
            setProblemModalProblemId(null);
          }}
          onSaved={(p: ProblemEditorResult) => {
            void loadProblemsForTopic();
            if (!selectedProblemIds.includes(p.id)) {
              setSelectedProblemIds((prev) => [...prev, p.id]);
            }
          }}
        />
      )}
    </div>
  );
}

'use client';

import type React from "react";
import { useCallback, useEffect, useRef, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";
import { ProblemContent } from "@/components/ui/problem-content";

/* ── Types ─────────────────────────────────────────────────────── */

type Subject = { id: string; code: string; name_ru: string };
type Topic = { id: string; title_ru: string; subject_id: string };
type Choice = { choice_text: string; is_correct: boolean; order_no: number };

type ImageSlot = {
  url: string;
  order_no: number;
  alt_text: string;
  uploading?: boolean;
  file?: File;
};

type DraftState = {
  form: typeof EMPTY_FORM;
  choices: Choice[];
  textAnswer: string;
  images: ImageSlot[];
};

type BulkParsedProblem = {
  title: string;
  type: "single_choice" | "multiple_choice" | "short_text";
  statement: string;
  choices: Choice[];
  textAnswer: string | null;
  explanation: string | null;
};

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
  images: { id: string; url: string; order_no: number; alt_text: string | null }[];
  answer_key: {
    numeric_answer: number | null;
    text_answer: string | null;
    answer_pattern: string | null;
    tolerance: number | null;
    canonical_answer: string | null;
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

/* ── Constants ─────────────────────────────────────────────────── */

const PROBLEM_TYPES = [
  { value: "single_choice", label: "Один ответ" },
  { value: "multiple_choice", label: "Несколько ответов" },
  { value: "short_text", label: "Текстовый ответ" },
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
  short_text: "Текстовый ответ",
  match: "Сопоставление",
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Лёгкий",
  medium: "Средний",
  hard: "Сложный",
};

const SPECIAL_CHARS = [
  "±", "×", "÷", "√", "∞", "≈", "≠", "≤", "≥",
  "°", "π", "α", "β", "γ", "δ", "θ", "λ", "μ",
  "Σ", "Δ", "Ω", "φ", "ε", "²", "³", "⁴", "½",
  "⅓", "¼", "⅔", "¾", "→", "←", "↔", "∈", "∉",
  "⊂", "⊃", "∪", "∩", "∀", "∃", "∅", "ℝ", "ℤ",
];

const EMPTY_FORM = {
  subject_id: "",
  topic_id: "",
  type: "single_choice",
  difficulty: "easy",
  title: "",
  statement: "",
  explanation: "",
  points: "1",
  time_limit_sec: "0",
};

const MAX_IMAGES = 3;

const DIFFICULTY_DEFAULTS: Record<string, { points: string }> = {
  easy: { points: "1" },
  medium: { points: "2" },
  hard: { points: "3" },
};

const LAST_PREFS_KEY = "admin_problems_last_prefs_v1";
const DRAFT_KEY = "admin_problem_draft_v1";

type LastPreferences = {
  subject_id: string;
  topic_id: string;
  type: string;
  difficulty: string;
  points: string;
};

/* ── Component ─────────────────────────────────────────────────── */

export function ProblemsForm({ accessToken, userRole, onCreated }: ProblemsFormProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [choices, setChoices] = useState<Choice[]>([
    { choice_text: "", is_correct: true, order_no: 0 },
    { choice_text: "", is_correct: false, order_no: 1 },
  ]);
  const [textAnswer, setTextAnswer] = useState("");
  const [canonicalPreview, setCanonicalPreview] = useState<string | null>(null);
  const [canonicalLoading, setCanonicalLoading] = useState(false);
  const [images, setImages] = useState<ImageSlot[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const [lastPrefs, setLastPrefs] = useState<LastPreferences | null>(null);
  const [pointsTouched, setPointsTouched] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [restoredFromDraft, setRestoredFromDraft] = useState(false);

  const [mode, setMode] = useState<"single" | "bulk">("single");
  const [previewOpen, setPreviewOpen] = useState(false);

  const [bulkText, setBulkText] = useState("");
  const [bulkParsed, setBulkParsed] = useState<BulkParsedProblem[]>([]);
  const [bulkErrors, setBulkErrors] = useState<string | null>(null);
  const [bulkSubmitting, setBulkSubmitting] = useState(false);

  const [generatingDistractors, setGeneratingDistractors] = useState(false);
  const [generatingExplanation, setGeneratingExplanation] = useState(false);

  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [batchDifficulty, setBatchDifficulty] = useState<string>("");
  const [batchPoints, setBatchPoints] = useState<string>("");
  const [batchTopicId, setBatchTopicId] = useState<string>("");
  const [batchUpdating, setBatchUpdating] = useState(false);
  const [batchDeleting, setBatchDeleting] = useState(false);

  const [generatingFromRag, setGeneratingFromRag] = useState(false);
  const [ragCount, setRagCount] = useState(10);
  const [ragEasyCount, setRagEasyCount] = useState(0);
  const [ragMediumCount, setRagMediumCount] = useState(0);
  const [ragHardCount, setRagHardCount] = useState(0);

  const [problems, setProblems] = useState<AdminProblem[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [statusFilter, setStatusFilter] = useState<string>("");
  const [subjectFilter, setSubjectFilter] = useState<string>("");
  const [listLoading, setListLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [showSpecialChars, setShowSpecialChars] = useState(false);
  const [previewProblem, setPreviewProblem] = useState<AdminProblem | null>(null);

  const statementRef = useRef<HTMLTextAreaElement>(null);
  const canonicalTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);

  const perPage = 20;
  const isModerator = userRole === "moderator" || userRole === "admin";

  /* ── Load subjects ──────────────────────────────────────────── */
  useEffect(() => {
    (async () => {
      try {
        const data = await apiGet<Subject[]>("/subjects", accessToken);
        setSubjects(data);
      } catch { /* ignore */ }
    })();
  }, [accessToken]);

  /* ── Load local preferences and draft on mount ──────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      const prefsRaw = window.localStorage.getItem(LAST_PREFS_KEY);
      if (prefsRaw) {
        const parsed = JSON.parse(prefsRaw) as LastPreferences;
        setLastPrefs(parsed);
        setForm(prev => ({
          ...prev,
          ...parsed,
        }));
      }
      const adv = window.localStorage.getItem("admin_problems_show_advanced");
      if (adv != null) {
        setShowAdvanced(adv === "1");
      }
      const draftRaw = window.localStorage.getItem(DRAFT_KEY);
      if (draftRaw) {
        try {
          const draft = JSON.parse(draftRaw) as DraftState;
          setForm(draft.form);
          setChoices(draft.choices || [
            { choice_text: "", is_correct: true, order_no: 0 },
            { choice_text: "", is_correct: false, order_no: 1 },
          ]);
          setTextAnswer(draft.textAnswer || "");
          setImages(draft.images || []);
          setRestoredFromDraft(true);
          setShowForm(true);
        } catch {
          // ignore malformed draft
        }
      }
    } catch {
      // ignore errors with localStorage
    }
  }, []);

  /* ── Load topics when subject changes ───────────────────────── */
  useEffect(() => {
    if (!form.subject_id) { setTopics([]); return; }
    (async () => {
      try {
        const data = await apiGet<Topic[]>(`/topics?subject_id=${form.subject_id}`, accessToken);
        setTopics(data);
      } catch { setTopics([]); }
    })();
  }, [accessToken, form.subject_id]);

  /* ── Default topic: last in subject ─────────────────────────── */
  useEffect(() => {
    if (!form.subject_id || editingId) return;
    if (!topics.length) return;
    if (form.topic_id) return;
    const last = topics[topics.length - 1];
    if (!last) return;
    setForm(prev => ({ ...prev, topic_id: last.id }));
  }, [topics, form.subject_id, form.topic_id, editingId]);

  /* ── Debounced canonical preview ────────────────────────────── */
  useEffect(() => {
    if (canonicalTimeout.current) clearTimeout(canonicalTimeout.current);
    if (!textAnswer.trim()) {
      setCanonicalPreview(null);
      return;
    }
    canonicalTimeout.current = setTimeout(async () => {
      setCanonicalLoading(true);
      try {
        const res = await apiPost<{ canonical: string | null }>(
          "/problems/answers/canonicalize",
          { text: textAnswer },
          accessToken,
        );
        setCanonicalPreview(res.canonical);
      } catch {
        setCanonicalPreview(null);
      } finally {
        setCanonicalLoading(false);
      }
    }, 500);
    return () => {
      if (canonicalTimeout.current) clearTimeout(canonicalTimeout.current);
    };
  }, [textAnswer, accessToken]);

  /* ── Autosave draft periodically ─────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showForm) return;
    const id = window.setInterval(() => {
      const draft: DraftState = {
        form,
        choices,
        textAnswer,
        images,
      };
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // ignore
      }
    }, 7000);
    return () => {
      window.clearInterval(id);
    };
  }, [showForm, form, choices, textAnswer, images]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showForm) return;

    const handleBeforeUnload = () => {
      const draft: DraftState = {
        form,
        choices,
        textAnswer,
        images,
      };
      try {
        window.localStorage.setItem(DRAFT_KEY, JSON.stringify(draft));
      } catch {
        // ignore
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [showForm, form, choices, textAnswer, images]);

  /* ── Load problems list ─────────────────────────────────────── */
  const loadProblems = useCallback(
    async (opts?: { silent?: boolean }) => {
      if (!opts?.silent) {
        setListLoading(true);
      }
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("per_page", String(perPage));
        if (statusFilter) params.set("status", statusFilter);
        if (subjectFilter) params.set("subject_id", subjectFilter);
        const data = await apiGet<ProblemListResponse>(`/admin/problems?${params.toString()}`, accessToken);
        setProblems(data.items);
        setTotal(data.total);
      } catch {
        setProblems([]);
      } finally {
        if (!opts?.silent) {
          setListLoading(false);
        }
      }
    },
    [accessToken, page, statusFilter, subjectFilter],
  );

  useEffect(() => { loadProblems(); }, [loadProblems]);

  const isChoiceType = form.type === "single_choice" || form.type === "multiple_choice";

  /* ── Helpers ────────────────────────────────────────────────── */
  const applyDifficultyDefaults = (difficultyValue: string) => {
    const defaults = DIFFICULTY_DEFAULTS[difficultyValue];
    if (!defaults) {
      setForm(prev => ({ ...prev, difficulty: difficultyValue }));
      return;
    }
    setForm(prev => ({
      ...prev,
      difficulty: difficultyValue,
      points: pointsTouched ? prev.points : defaults.points,
    }));
  };

  const handleChoicesPaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const text = e.clipboardData.getData("text");
    if (!text.includes("\n")) return;
    e.preventDefault();
    const lines = text
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);
    if (!lines.length) return;
    setChoices(
      lines.map((line, index) => ({
        choice_text: line,
        is_correct: false,
        order_no: index,
      })),
    );
  };

  const shuffleChoices = () => {
    setChoices(prev => {
      const arr = [...prev];
      for (let i = arr.length - 1; i > 0; i -= 1) {
        const j = Math.floor(Math.random() * (i + 1));
        const tmp = arr[i];
        arr[i] = arr[j];
        arr[j] = tmp;
      }
      return arr.map((c, index) => ({ ...c, order_no: index }));
    });
  };

  const persistLastPrefs = (state: typeof EMPTY_FORM = form) => {
    if (typeof window === "undefined") return;
    const prefs: LastPreferences = {
      subject_id: state.subject_id,
      topic_id: state.topic_id,
      type: state.type,
      difficulty: state.difficulty,
      points: state.points,
    };
    setLastPrefs(prefs);
    try {
      window.localStorage.setItem(LAST_PREFS_KEY, JSON.stringify(prefs));
    } catch {
      // ignore
    }
  };

  const addChoice = () => {
    setChoices(prev => [...prev, { choice_text: "", is_correct: false, order_no: prev.length }]);
  };

  const removeChoice = (idx: number) => {
    setChoices(prev => prev.filter((_, i) => i !== idx).map((c, i) => ({ ...c, order_no: i })));
  };

  const insertSpecialChar = (char: string) => {
    const ta = statementRef.current;
    if (!ta) return;
    const start = ta.selectionStart ?? ta.value.length;
    const end = ta.selectionEnd ?? start;
    const before = form.statement.slice(0, start);
    const after = form.statement.slice(end);
    setForm(f => ({ ...f, statement: before + char + after }));
    requestAnimationFrame(() => {
      ta.focus();
      ta.selectionStart = ta.selectionEnd = start + char.length;
    });
  };

  const resetForm = (opts?: { keepMeta?: boolean }) => {
    setEditingId(null);
    setChoices([
      { choice_text: "", is_correct: true, order_no: 0 },
      { choice_text: "", is_correct: false, order_no: 1 },
    ]);
    setTextAnswer("");
    setCanonicalPreview(null);
    setImages([]);
    setError(null);
    setSuccess(null);
    setPointsTouched(false);
    setRestoredFromDraft(false);

    setForm(prev => {
      if (opts?.keepMeta) {
        // Сохранить текущие метаданные, очистив только текстовые поля
        return {
          ...prev,
          title: "",
          statement: "",
          explanation: "",
        };
      }

      const base =
        lastPrefs != null
          ? {
              ...EMPTY_FORM,
              ...lastPrefs,
            }
          : EMPTY_FORM;

      return {
        ...base,
        title: "",
        statement: "",
        explanation: "",
      };
    });
  };

  const startEdit = (problem: AdminProblem) => {
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
      setChoices(problem.choices.map(c => ({
        choice_text: c.choice_text,
        is_correct: c.is_correct,
        order_no: c.order_no,
      })));
    }
    if (problem.answer_key?.text_answer) {
      setTextAnswer(problem.answer_key.text_answer);
    } else {
      setTextAnswer("");
    }
    setImages(
      (problem.images || []).map(img => ({
        url: img.url,
        order_no: img.order_no,
        alt_text: img.alt_text ?? "",
      })),
    );
    setError(null);
    setSuccess(null);
  };

  const duplicateFromProblem = (problem: AdminProblem) => {
    setEditingId(null);
    setShowForm(true);
    setForm({
      subject_id: problem.subject_id,
      topic_id: problem.topic_id ?? "",
      type: problem.type,
      difficulty: problem.difficulty,
      title: `${problem.title} (копия)`,
      statement: problem.statement,
      explanation: problem.explanation ?? "",
      time_limit_sec: String(problem.time_limit_sec),
      points: String(problem.points),
    });
    if (problem.type === "single_choice" || problem.type === "multiple_choice") {
      setChoices(
        problem.choices.map(c => ({
          choice_text: c.choice_text,
          is_correct: c.is_correct,
          order_no: c.order_no,
        })),
      );
    } else {
      setChoices([
        { choice_text: "", is_correct: true, order_no: 0 },
        { choice_text: "", is_correct: false, order_no: 1 },
      ]);
    }
    if (problem.answer_key?.text_answer) {
      setTextAnswer(problem.answer_key.text_answer);
    } else {
      setTextAnswer("");
    }
    setImages(
      (problem.images || []).map(img => ({
        url: img.url,
        order_no: img.order_no,
        alt_text: img.alt_text ?? "",
      })),
    );
    setError(null);
    setSuccess(null);
  };

  /* ── Image upload ───────────────────────────────────────────── */
  const handleImageSelect = async (file: File) => {
    if (images.length >= MAX_IMAGES) return;
    const orderNo = images.length;
    const slot: ImageSlot = {
      url: "",
      order_no: orderNo,
      alt_text: "",
      uploading: true,
      file,
    };
    setImages(prev => [...prev, slot]);

    try {
      const presign = await apiPost<{
        upload_url: string;
        final_url: string;
        key: string;
        content_type: string;
      }>("/problems/images/presign", {
        content_type: file.type,
        file_name: file.name,
      }, accessToken);

      await fetch(presign.upload_url, {
        method: "PUT",
        headers: { "Content-Type": file.type },
        body: file,
      });

      setImages(prev =>
        prev.map((img, i) =>
          i === orderNo
            ? { ...img, url: presign.final_url, uploading: false, file: undefined }
            : img,
        ),
      );
    } catch (err) {
      setImages(prev => prev.filter((_, i) => i !== orderNo));
      setError(err instanceof Error ? err.message : "Ошибка загрузки изображения");
    }
  };

  const removeImage = (idx: number) => {
    setImages(prev =>
      prev.filter((_, i) => i !== idx).map((img, i) => ({ ...img, order_no: i })),
    );
  };

  /* ── Submit form ────────────────────────────────────────────── */
  const handleSubmit = async (e: React.FormEvent, options?: { createNext?: boolean }) => {
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
        time_limit_sec: 0,
        points: Number(form.points),
      };

      if (isChoiceType) {
        body.choices = choices.map(c => ({
          choice_text: c.choice_text,
          is_correct: c.is_correct,
          order_no: c.order_no,
        }));
      } else if (form.type === "short_text") {
        body.answer_key = {
          text_answer: textAnswer || null,
        };
      }

      const uploadedImages = images.filter(img => img.url && !img.uploading);
      if (uploadedImages.length > 0) {
        body.images = uploadedImages.map(img => ({
          url: img.url,
          order_no: img.order_no,
          alt_text: img.alt_text || null,
        }));
      }

      if (editingId) {
        await apiPatch(`/problems/${editingId}`, body, accessToken);
        setSuccess("Задача обновлена");
      } else {
        await apiPost("/problems", body, accessToken);
        setSuccess("Задача создана (черновик)");
      }
      persistLastPrefs();
      // сбрасываем сохранённый черновик
      if (typeof window !== "undefined") {
        try {
          window.localStorage.removeItem(DRAFT_KEY);
        } catch {
          // ignore
        }
      }

      if (options?.createNext) {
        // подготовить следующую задачу на основе текущих метаданных
        resetForm({ keepMeta: true });
        setShowForm(true);
      } else {
        resetForm();
        setShowForm(false);
      }
      onCreated?.();
      await loadProblems({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSaveAndCreateNext = () => {
    const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
    void handleSubmit(fakeEvent, { createNext: true });
  };

  const handleGenerateDistractors = async () => {
    if (!isChoiceType) return;
    if (!form.statement.trim()) {
      setError("Сначала заполните условие задачи.");
      return;
    }
    const correctChoice = choices.find(c => c.is_correct && c.choice_text.trim());
    if (!correctChoice) {
      setError("Отметьте хотя бы один правильный вариант ответа.");
      return;
    }
    setError(null);
    setGeneratingDistractors(true);
    try {
      const res = await apiPost<{ options: string[] }>(
        "/problems/answers/distractors",
        {
          question: form.statement,
          correct_answer: correctChoice.choice_text,
          count: 3,
        },
        accessToken,
      );
      const rawOptions = (res.options || []).map(opt => opt.trim()).filter(Boolean);

      // Дополнительная защита на фронте: если модель вернула несколько чисел
      // в одной строке (например "16 24 64"), разбиваем их на отдельные варианты.
      const expandedOptions: string[] = [];
      for (const opt of rawOptions) {
        const hasLetters = /[A-Za-zА-Яа-я]/.test(opt);
        const nums = opt.match(/\d+/g);
        if (!hasLetters && nums && nums.length >= 2) {
          expandedOptions.push(...nums);
        } else {
          expandedOptions.push(opt);
        }
      }

      const existingTexts = new Set(choices.map(c => c.choice_text.trim()));
      let newOptions = expandedOptions.filter(opt => opt && !existingTexts.has(opt));

      // Если модель вернула только дубликаты существующих вариантов,
      // всё равно добавим их, чтобы автор видел результат.
      if (!newOptions.length && rawOptions.length > 0) {
        newOptions = rawOptions;
      }

      if (!newOptions.length) {
        setSuccess("Модель не смогла предложить неправильные варианты.");
        return;
      }
      setChoices(prev => {
        const start = prev.length;
        const extra = newOptions.map((text, idx) => ({
          choice_text: text,
          is_correct: false,
          order_no: start + idx,
        }));
        return [...prev, ...extra];
      });
      setSuccess(`Добавлены сгенерированные варианты: ${newOptions.length}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации неправильных ответов");
    } finally {
      setGeneratingDistractors(false);
    }
  };

  const handleGenerateExplanation = async () => {
    if (!form.statement.trim()) {
      setError("Сначала заполните условие задачи.");
      return;
    }

    let correct: string | null = null;
    if (isChoiceType) {
      const correctChoice = choices.find(c => c.is_correct && c.choice_text.trim());
      if (!correctChoice) {
        setError("Для генерации объяснения нужен хотя бы один правильный вариант.");
        return;
      }
      correct = correctChoice.choice_text;
    } else if (form.type === "short_text") {
      if (!textAnswer.trim()) {
        setError("Для генерации объяснения задайте правильный текстовый ответ.");
        return;
      }
      correct = textAnswer;
    }

    if (!correct) {
      setError("Не удалось определить правильный ответ для объяснения.");
      return;
    }

    setError(null);
    setGeneratingExplanation(true);
    try {
      const res = await apiPost<{ explanation: string | null }>(
        "/problems/answers/explanation",
        {
          question: form.statement,
          correct_answer: correct,
          choices: isChoiceType ? choices.map(c => c.choice_text) : undefined,
        },
        accessToken,
      );
      if (!res.explanation) {
        setError("Модель не вернула объяснение.");
        return;
      }
      setForm(f => ({ ...f, explanation: res.explanation || "" }));
      setSuccess("Объяснение сгенерировано.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка генерации объяснения");
    } finally {
      setGeneratingExplanation(false);
    }
  };

  const handleCreateVideo = async (problemId: string) => {
    setActionInProgress(problemId);
    setError(null);
    setSuccess(null);
    try {
      const res = await apiPost<{ job_id: string; status: string }>(
        `/problems/${problemId}/video`,
        {},
        accessToken,
      );
      setSuccess(`Видео‑задача создана. ID: ${res.job_id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при создании видео для задачи");
    } finally {
      setActionInProgress(null);
    }
  };

  /* ── Global hotkeys ─────────────────────────────────────────── */
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!showForm || mode !== "single") return;

    const handler = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toLowerCase().includes("mac");
      const cmd = isMac ? e.metaKey : e.ctrlKey;
      if (!cmd) return;
      if (e.key === "Enter") {
        e.preventDefault();
        if (e.shiftKey) {
          handleSaveAndCreateNext();
        } else {
          const fakeEvent = { preventDefault: () => {} } as React.FormEvent;
          void handleSubmit(fakeEvent);
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => {
      window.removeEventListener("keydown", handler);
    };
    // Hotkeys intentionally depend only on visibility/mode here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showForm, mode]);

  const handleAction = async (problemId: string, action: "submit-review" | "publish" | "reject" | "archive") => {
    setActionInProgress(problemId);
    try {
      await apiPost(`/problems/${problemId}/${action}`, undefined, accessToken);
      await loadProblems({ silent: true });
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
      await loadProblems({ silent: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при удалении");
    } finally {
      setActionInProgress(null);
    }
  };

  const totalPages = Math.ceil(total / perPage);

  const availableProblemTypes =
    editingId && form.type === "numeric"
      ? [...PROBLEM_TYPES, { value: "numeric", label: "Числовой (устаревший)" }]
      : PROBLEM_TYPES;

  const handleGenerateFromRag = async () => {
    if (!form.subject_id || !form.topic_id) {
      setError("Сначала выберите предмет и тему для задач.");
      return;
    }

    const totalByLevels = ragEasyCount + ragMediumCount + ragHardCount;

    const body: Record<string, unknown> = {
      subject_id: form.subject_id,
      topic_id: form.topic_id,
    };

    if (totalByLevels > 0) {
      if (totalByLevels > 30) {
        setError("Суммарное количество задач по уровням сложности не должно превышать 30.");
        return;
      }
      body.easy_count = ragEasyCount;
      body.medium_count = ragMediumCount;
      body.hard_count = ragHardCount;
    } else {
      if (!Number.isFinite(ragCount) || ragCount <= 0 || ragCount > 30) {
        setError("Введите корректное количество задач (от 1 до 30).");
        return;
      }
      body.count = ragCount;
    }

    setError(null);
    setSuccess(null);
    setGeneratingFromRag(true);
    try {
      const res = await apiPost<{ items: AdminProblem[]; created_count: number; skipped_duplicates: number }>(
        "/admin/problems/generate-from-rag",
        body,
        accessToken,
      );
      const created = typeof res.created_count === "number" ? res.created_count : (res.items?.length ?? 0);
      const skipped = typeof res.skipped_duplicates === "number" ? res.skipped_duplicates : 0;

      if (created === 0 && skipped > 0) {
        setError("Все сгенерированные задачИ уже существуют по этой теме. Попробуйте изменить параметры генерации.");
      } else if (skipped > 0) {
        setSuccess(
          `Сгенерированы задачи‑черновики по выбранной теме (RAG). Создано: ${created}, пропущено как дубликаты: ${skipped}.`,
        );
      } else {
        setSuccess(`Сгенерированы задачи‑черновики по выбранной теме (RAG). Создано: ${created}.`);
      }
      await loadProblems({ silent: true });
      onCreated?.();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при генерации задач через ИИ");
    } finally {
      setGeneratingFromRag(false);
    }
  };

  /* ── Render ─────────────────────────────────────────────────── */
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
          onChange={e => { setStatusFilter(e.target.value); setPage(1); }}
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
          onChange={e => { setSubjectFilter(e.target.value); setPage(1); }}
          className="rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
        >
          <option value="">Все предметы</option>
          {subjects.map(s => (
            <option key={s.id} value={s.id}>{s.name_ru}</option>
          ))}
        </select>
        <span className="text-xs text-slate-400">{total} задач</span>

        <div className="ml-auto flex items-center gap-1 rounded-lg bg-slate-100 p-1 text-xs">
          <button
            type="button"
            onClick={() => setMode("single")}
            className={`rounded px-2 py-1 ${mode === "single" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Обычный
          </button>
          <button
            type="button"
            onClick={() => setMode("bulk")}
            className={`rounded px-2 py-1 ${mode === "bulk" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500 hover:text-slate-700"}`}
          >
            Bulk
          </button>
        </div>
      </div>

      {/* ── Create / Edit form (single mode) ───────────────────── */}
      {mode === "single" && showForm && (
        <form onSubmit={e => handleSubmit(e)} className="space-y-6 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-base font-bold text-slate-900">
              {editingId ? "Редактировать задачу" : "Создать задачу"}
            </h3>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setPreviewOpen(v => !v)}
                className="rounded-md border border-gray-200 px-2 py-1 text-xs font-medium text-slate-600 transition-colors hover:bg-gray-50"
              >
                {previewOpen ? "Скрыть предпросмотр" : "Предпросмотр"}
              </button>
              <button
                type="button"
                onClick={() => { resetForm(); setShowForm(false); }}
                className="text-xs text-slate-500 hover:text-slate-700"
              >
                Закрыть
              </button>
            </div>
          </div>

          {restoredFromDraft && (
            <p className="rounded-md bg-amber-50 px-3 py-2 text-xs text-amber-700">
              Восстановлен несохранённый черновик задачи.
            </p>
          )}

          {form.subject_id && form.topic_id ? (
            <div className="flex flex-col gap-3 rounded-lg border border-blue-50 bg-blue-50/70 px-4 py-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex-1 text-sm text-slate-700">
                <p>
                  Сгенерировать набор задач по выбранной теме на основе загруженных учебных материалов (RAG).
                  Будут созданы новые черновики задач с автоматическими ответами, которые можно отредактировать.
                </p>
                <div className="mt-2 flex flex-col gap-2 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Количество по сложностям (опционально):</span>
                    <label className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500">Лёгких</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={ragEasyCount}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^\d]/g, "");
                          const num = raw ? Number(raw) : 0;
                          const clamped = Math.max(0, Math.min(30, num));
                          setRagEasyCount(clamped);
                        }}
                        className="w-16 rounded border border-blue-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500">Средних</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={ragMediumCount}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^\d]/g, "");
                          const num = raw ? Number(raw) : 0;
                          const clamped = Math.max(0, Math.min(30, num));
                          setRagMediumCount(clamped);
                        }}
                        className="w-16 rounded border border-blue-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400"
                      />
                    </label>
                    <label className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500">Сложных</span>
                      <input
                        type="number"
                        min={0}
                        max={30}
                        value={ragHardCount}
                        onChange={e => {
                          const raw = e.target.value.replace(/[^\d]/g, "");
                          const num = raw ? Number(raw) : 0;
                          const clamped = Math.max(0, Math.min(30, num));
                          setRagHardCount(clamped);
                        }}
                        className="w-16 rounded border border-blue-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400"
                      />
                    </label>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span>Или общее количество задач:</span>
                    <input
                      type="number"
                      min={1}
                      max={30}
                      value={ragCount}
                      onChange={e => {
                        const value = Number(e.target.value.replace(/[^\d]/g, "")) || 1;
                        const clamped = Math.max(1, Math.min(30, value));
                        setRagCount(clamped);
                      }}
                      className="w-20 rounded border border-blue-200 bg-white px-2 py-1 text-xs outline-none focus:border-blue-400"
                    />
                    <span className="text-[11px] text-slate-400">(от 1 до 30 задач за один запуск)</span>
                  </div>
                </div>
              </div>
              <button
                type="button"
                onClick={handleGenerateFromRag}
                disabled={generatingFromRag}
                className="shrink-0 rounded-lg bg-blue-600 px-4 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
              >
                {generatingFromRag ? "Генерация задач..." : "Сгенерировать задачи по теме"}
              </button>
            </div>
          ) : (
            <div className="rounded-lg border border-dashed border-blue-100 bg-blue-50/40 px-4 py-3 text-xs text-slate-600">
              Чтобы использовать ИИ‑генерацию задач по теме, выберите выше и предмет, и конкретную тему.
            </div>
          )}

          {/* ── Section 1: Metadata ─────────────────────────────── */}
          <fieldset className="space-y-4 rounded-lg border border-gray-100 p-4">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Метаданные
            </legend>
            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Предмет</label>
                <select
                  required
                  value={form.subject_id}
                  onChange={e => setForm(f => ({ ...f, subject_id: e.target.value, topic_id: "" }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="">Выберите предмет</option>
                  {subjects.map(s => (
                    <option key={s.id} value={s.id}>{s.name_ru}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Тема</label>
                <select
                  value={form.topic_id}
                  onChange={e => setForm(f => ({ ...f, topic_id: e.target.value }))}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  <option value="">Без привязки к теме</option>
                  {topics.map(t => (
                    <option key={t.id} value={t.id}>{t.title_ru}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Тип задачи</label>
                <select
                  value={form.type}
                  onChange={e => {
                    const nextType = e.target.value;
                    setForm(f => ({ ...f, type: nextType }));
                    if (nextType === "short_text") {
                      setChoices([
                        { choice_text: "", is_correct: true, order_no: 0 },
                        { choice_text: "", is_correct: false, order_no: 1 },
                      ]);
                    } else if (nextType === "single_choice" || nextType === "multiple_choice") {
                      setTextAnswer("");
                      setCanonicalPreview(null);
                    }
                  }}
                  disabled={!!editingId}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 disabled:opacity-60"
                >
                  {availableProblemTypes.map(t => (
                    <option key={t.value} value={t.value}>{t.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-slate-500">Сложность</label>
                <select
                  value={form.difficulty}
                  onChange={e => applyDifficultyDefaults(e.target.value)}
                  className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                >
                  {DIFFICULTY_LEVELS.map(d => (
                    <option key={d.value} value={d.value}>{d.label}</option>
                  ))}
                </select>
              </div>
            </div>
          </fieldset>

          {/* ── Section 2: Problem Statement ────────────────────── */}
          <fieldset className="space-y-4 rounded-lg border border-gray-100 p-4">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Условие задачи
            </legend>

            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">Заголовок</label>
              <input
                type="text"
                required
                maxLength={255}
                value={form.title}
                onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                placeholder="Название задачи"
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>

            <div>
              <div className="mb-1 flex items-center justify-between">
                <label className="text-xs font-medium text-slate-500">Условие</label>
                <button
                  type="button"
                  onClick={() => setShowSpecialChars(!showSpecialChars)}
                  className="flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-200"
                >
                  <span className="text-base leading-none">∑</span>
                  {showSpecialChars ? "Скрыть символы" : "Спецсимволы"}
                </button>
              </div>

              {showSpecialChars && (
                <div className="mb-2 flex flex-wrap gap-1 rounded-lg border border-gray-100 bg-gray-50 p-2">
                  {SPECIAL_CHARS.map(ch => (
                    <button
                      key={ch}
                      type="button"
                      onClick={() => insertSpecialChar(ch)}
                      className="flex h-8 w-8 items-center justify-center rounded border border-gray-200 bg-white text-sm transition-colors hover:border-blue-300 hover:bg-blue-50"
                      title={ch}
                    >
                      {ch}
                    </button>
                  ))}
                </div>
              )}

              <textarea
                ref={statementRef}
                required
                rows={5}
                value={form.statement}
                onChange={e => setForm(f => ({ ...f, statement: e.target.value }))}
                placeholder="Текст условия задачи... Можно использовать спецсимволы: √, π, ², ≤ и др."
                className="w-full rounded-lg border border-gray-200 px-3 py-2 font-mono text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
              />
            </div>

          </fieldset>

          {/* ── Section 4: Answer ──────────────────────────────── */}
          <fieldset className="space-y-4 rounded-lg border border-gray-100 p-4">
            <legend className="px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              Ответ
            </legend>

            {isChoiceType && (
              <div className="space-y-3">
                <label className="block text-xs font-medium text-slate-500">Варианты ответов</label>
                <p className="text-[11px] text-slate-400">
                  {form.type === "single_choice"
                    ? "Укажите несколько вариантов и отметьте один правильный."
                    : "Отметьте все варианты, которые являются правильными."}
                </p>
                <p className="text-[11px] text-slate-400">
                  Можно использовать markdown и LaTeX как в лекциях: например{" "}
                  <span className="font-mono">$x^2$</span>,{" "}
                  <span className="font-mono">$\\frac{1}{2}$</span> или формулы в блоке $$...$$.
                </p>
                {choices.map((c, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <input
                      type={form.type === "single_choice" ? "radio" : "checkbox"}
                      name="correct_choice"
                      checked={c.is_correct}
                      onChange={() => {
                        if (form.type === "single_choice") {
                          setChoices(prev => prev.map((ch, i) => ({ ...ch, is_correct: i === idx })));
                        } else {
                          setChoices(prev => prev.map((ch, i) => i === idx ? { ...ch, is_correct: !ch.is_correct } : ch));
                        }
                      }}
                      className="accent-blue-600"
                    />
                    <input
                      type="text"
                      required
                      value={c.choice_text}
                      onChange={e =>
                        setChoices(prev => prev.map((ch, i) => i === idx ? { ...ch, choice_text: e.target.value } : ch))
                      }
                      onPaste={idx === 0 ? handleChoicesPaste : undefined}
                      onKeyDown={e => {
                        if (e.key === "Enter" && !e.shiftKey) {
                          e.preventDefault();
                          if (idx === choices.length - 1) {
                            addChoice();
                          }
                        } else if (
                          e.key === "Backspace" &&
                          !e.shiftKey &&
                          c.choice_text === "" &&
                          choices.length > 2
                        ) {
                          e.preventDefault();
                          removeChoice(idx);
                        }
                      }}
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
                <div className="flex flex-wrap gap-3">
                  <button
                    type="button"
                    onClick={addChoice}
                    className="text-sm text-blue-600 hover:text-blue-700"
                  >
                    + Добавить вариант
                  </button>
                  {choices.length > 1 && (
                    <button
                      type="button"
                      onClick={shuffleChoices}
                      className="text-xs text-slate-500 hover:text-slate-700"
                    >
                      Перемешать варианты
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => void handleGenerateDistractors()}
                    disabled={generatingDistractors || submitting}
                    className="text-xs text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                  >
                    {generatingDistractors ? "Генерация вариантов..." : "Сгенерировать неправильные варианты через ИИ"}
                  </button>
                </div>
              </div>
            )}

            {form.type === "short_text" && (
              <div className="space-y-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">
                    Правильный ответ
                  </label>
                  <input
                    type="text"
                    value={textAnswer}
                    onChange={e => setTextAnswer(e.target.value)}
                    placeholder="Например: 36км/ч, Пифагор, 3/5"
                    className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
                  />
                </div>

                {textAnswer.trim() && (
                  <div className="rounded-lg border border-blue-100 bg-blue-50/50 p-3">
                    <p className="mb-1 text-xs font-medium text-blue-700">Каноническая форма:</p>
                    {canonicalLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-3 w-3 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                        <span className="text-xs text-blue-400">Вычисляется...</span>
                      </div>
                    ) : canonicalPreview ? (
                      <p className="font-mono text-sm font-semibold text-blue-900">{canonicalPreview}</p>
                    ) : (
                      <p className="text-xs text-amber-600">
                        Не удалось вычислить каноническую форму. Ответ будет сравниваться как текст.
                      </p>
                    )}
                    <p className="mt-2 text-[11px] leading-tight text-slate-400">
                      Ответы учеников будут приведены к этому же формату перед сравнением.
                      Форматы вроде «36км/ч», «36 км/ч», «36 km/h» будут считаться одинаковыми.
                    </p>
                  </div>
                )}
              </div>
            )}

            {form.type === "numeric" && (
              <div>
                <p className="text-xs text-amber-600">
                  Тип «числовой» устарел. Используйте «текстовый ответ» для новых задач.
                </p>
              </div>
            )}
          </fieldset>

          {/* ── Section 5: Advanced settings ────────────────────── */}
          <fieldset className="space-y-3 rounded-lg border border-dashed border-gray-200 bg-slate-50/60 p-4">
            <legend className="flex items-center justify-between px-2 text-xs font-semibold uppercase tracking-wider text-slate-400">
              <span>Дополнительные настройки</span>
              <button
                type="button"
                onClick={() => {
                  setShowAdvanced(v => {
                    const next = !v;
                    if (typeof window !== "undefined") {
                      try {
                        window.localStorage.setItem("admin_problems_show_advanced", next ? "1" : "0");
                      } catch {
                        // ignore
                      }
                    }
                    return next;
                  });
                }}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                {showAdvanced ? "Скрыть" : "Показать"}
              </button>
            </legend>

            {showAdvanced && (
              <div className="space-y-4">
                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <label className="mb-1 block text-xs font-medium text-slate-500">Баллы</label>
                    <input
                      type="number"
                      min={1}
                      value={form.points}
                      onChange={e => {
                        setPointsTouched(true);
                        setForm(f => ({ ...f, points: e.target.value }));
                      }}
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400"
                    />
                  </div>
                </div>

                <div>
                  <label className="mb-1 block text-xs font-medium text-slate-500">Объяснение (необязательно)</label>
                  <div className="space-y-2">
                    <textarea
                      rows={3}
                      value={form.explanation}
                      onChange={e => setForm(f => ({ ...f, explanation: e.target.value }))}
                      placeholder="Объяснение решения, которое увидит ученик после отправки ответа"
                      className="w-full rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                    <button
                      type="button"
                      onClick={() => void handleGenerateExplanation()}
                      disabled={generatingExplanation || submitting}
                      className="text-xs text-emerald-700 hover:text-emerald-800 disabled:opacity-50"
                    >
                      {generatingExplanation ? "Генерация объяснения..." : "Сгенерировать объяснение через ИИ"}
                    </button>
                  </div>
                </div>

                <div>
                  <div className="mb-2 flex items-center justify-between">
                    <label className="text-xs font-medium text-slate-500">
                      Изображения (до {MAX_IMAGES})
                    </label>
                  </div>
                  <div className="grid gap-4 sm:grid-cols-3">
                    {images.map((img, idx) => (
                      <div key={idx} className="relative rounded-lg border border-gray-200 bg-gray-50 p-2">
                        {img.uploading ? (
                          <div className="flex h-32 items-center justify-center">
                            <div className="h-6 w-6 animate-spin rounded-full border-2 border-blue-200 border-t-blue-600" />
                          </div>
                        ) : (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={img.url}
                            alt={img.alt_text || `Изображение ${idx + 1}`}
                            className="h-32 w-full rounded object-cover"
                          />
                        )}
                        <input
                          type="text"
                          placeholder="Описание (alt)"
                          value={img.alt_text}
                          onChange={e =>
                            setImages(prev =>
                              prev.map((im, i) => (i === idx ? { ...im, alt_text: e.target.value } : im)),
                            )
                          }
                          className="mt-2 w-full rounded border border-gray-200 px-2 py-1 text-xs outline-none focus:border-blue-400"
                        />
                        <button
                          type="button"
                          onClick={() => removeImage(idx)}
                          className="absolute -right-2 -top-2 flex h-5 w-5 items-center justify-center rounded-full bg-rose-500 text-xs text-white shadow hover:bg-rose-600"
                        >
                          ×
                        </button>
                        <span className="absolute left-2 top-2 rounded bg-black/50 px-1.5 py-0.5 text-[10px] text-white">
                          #{idx + 1}
                        </span>
                      </div>
                    ))}

                    {images.length < MAX_IMAGES && (
                      <label className="flex h-44 cursor-pointer flex-col items-center justify-center rounded-lg border-2 border-dashed border-gray-200 bg-gray-50 transition-colors hover:border-blue-300 hover:bg-blue-50/30">
                        <svg className="mb-1 h-8 w-8 text-gray-300" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
                        </svg>
                        <span className="text-xs text-gray-400">Загрузить</span>
                        <span className="text-[10px] text-gray-300">JPG, PNG, GIF, WebP</span>
                        <input
                          type="file"
                          accept="image/jpeg,image/png,image/gif,image/webp"
                          className="hidden"
                          onChange={e => {
                            const file = e.target.files?.[0];
                            if (file) handleImageSelect(file);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    )}
                  </div>
                </div>
              </div>
            )}
          </fieldset>

          {/* ── Preview as student ──────────────────────────────── */}
          {previewOpen && (
            <div className="mt-2 rounded-xl border border-gray-100 bg-white p-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                Предпросмотр (как увидит ученик)
              </p>
              <article className="space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                    {DIFFICULTY_LABELS[form.difficulty] ?? form.difficulty}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-slate-600">
                    {Number(form.points) || 0} балл(ов)
                  </span>
                </div>
                <h4 className="text-lg font-bold text-slate-900">{form.title || "Без заголовка"}</h4>
                <div className="text-sm text-slate-700">
                  <ProblemContent body={form.statement || "Условие задачи..."} />
                </div>

                {images.length > 0 && (
                  <div className="mt-2 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {images
                      .filter(img => img.url)
                      .sort((a, b) => a.order_no - b.order_no)
                      .map((img, idx) => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={`${img.url}-${idx}`}
                          src={img.url}
                          alt={img.alt_text || `Изображение ${idx + 1}`}
                          className="h-24 w-full rounded-lg border border-gray-200 object-cover"
                        />
                      ))}
                  </div>
                )}

                {(form.type === "single_choice" || form.type === "multiple_choice") && (
                  <div className="mt-2 space-y-1">
                    <p className="text-xs text-slate-500">
                      {form.type === "single_choice"
                        ? "Ученику нужно выбрать один правильный вариант."
                        : "Ученику можно выбрать несколько правильных вариантов."}
                    </p>
                    {choices.map(choice => (
                      <label
                        key={choice.order_no}
                        className="flex cursor-default items-center gap-2 rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-sm text-slate-700"
                      >
                        <input
                          type={form.type === "single_choice" ? "radio" : "checkbox"}
                          disabled
                          className="h-4 w-4 text-blue-600"
                        />
                        <span>
                          <ProblemContent
                            body={choice.choice_text || "Вариант ответа"}
                            variant="inline"
                          />
                        </span>
                      </label>
                    ))}
                  </div>
                )}

                {form.type === "short_text" && (
                  <div className="mt-2">
                    <p className="text-xs text-slate-500 mb-1">Ученику будет показано текстовое поле для ввода ответа.</p>
                    <input
                      disabled
                      placeholder="Поле ответа ученика"
                      className="w-full rounded-lg border border-dashed border-gray-300 bg-slate-50 px-3 py-2 text-sm text-slate-500"
                    />
                  </div>
                )}
              </article>
            </div>
          )}

          {/* ── Errors / Success ───────────────────────────────── */}
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
            <button
              type="button"
              disabled={submitting}
              onClick={handleSaveAndCreateNext}
              className="rounded-lg border border-blue-200 px-4 py-2 text-sm font-medium text-blue-700 transition-colors hover:bg-blue-50 disabled:opacity-50"
            >
              Сохранить и создать следующую
            </button>
            {editingId && (
              <button
                type="button"
                disabled={submitting}
                onClick={() => editingId && handleAction(editingId, "publish")}
                className="rounded-lg border border-emerald-200 px-4 py-2 text-sm font-medium text-emerald-700 transition-colors hover:bg-emerald-50 disabled:opacity-50"
              >
                Опубликовать
              </button>
            )}
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

      {/* ── Bulk creation mode ─────────────────────────────────── */}
      {mode === "bulk" && (
        <div className="space-y-3 rounded-xl border border-gray-100 bg-white p-5 shadow-sm">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-base font-bold text-slate-900">Массовое создание задач (Bulk)</h3>
              <p className="mt-1 text-xs text-slate-500">
                Одна задача — один блок с полями TITLE / TYPE / Q / A* / A / EXPL, разделённый строкой &quot;---&quot;.
              </p>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Предмет для всех задач
              </label>
              <select
                required
                value={form.subject_id}
                onChange={e => setForm(f => ({ ...f, subject_id: e.target.value, topic_id: "" }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Выберите предмет</option>
                {subjects.map(s => (
                  <option key={s.id} value={s.id}>{s.name_ru}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-slate-500">
                Тема для всех задач
              </label>
              <select
                value={form.topic_id}
                onChange={e => setForm(f => ({ ...f, topic_id: e.target.value }))}
                className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
              >
                <option value="">Без привязки к теме</option>
                {topics.map(t => (
                  <option key={t.id} value={t.id}>{t.title_ru}</option>
                ))}
              </select>
            </div>
          </div>

          <textarea
            rows={10}
            value={bulkText}
            onChange={e => {
              setBulkText(e.target.value);
              setBulkErrors(null);
              setBulkParsed([]);
            }}
            placeholder={`TITLE: Квадратные уравнения №1
TYPE: multiple
Q: x^2 - 6x + 8 = 0
A*: 2
A*: 4
A: 6
A: 8
EXPL: Короткое объяснение...
---
TITLE: ...`}
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm font-mono outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />

          {bulkErrors && (
            <p className="text-sm text-rose-600">{bulkErrors}</p>
          )}

          {bulkParsed.length > 0 && (
            <div className="rounded-lg border border-emerald-100 bg-emerald-50/60 p-3 text-xs text-emerald-800">
              Распознано задач: {bulkParsed.length}
            </div>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={!bulkText.trim() || bulkSubmitting}
              onClick={() => {
                // простой парсинг без сложной валидации
                const blocks = bulkText.split(/^---$/m).map(b => b.trim()).filter(Boolean);
                const parsed: BulkParsedProblem[] = [];
                const errors: string[] = [];

                const typeMap: Record<string, BulkParsedProblem["type"]> = {
                  single: "single_choice",
                  multiple: "multiple_choice",
                  short_text: "short_text",
                };

                blocks.forEach((block, index) => {
                  const lines = block.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
                  let title = "";
                  let type: BulkParsedProblem["type"] = "single_choice";
                  let statement = "";
                  const choices: Choice[] = [];
                  let textAnswer: string | null = null;
                  let explanation: string | null = null;

                  lines.forEach(line => {
                    if (line.startsWith("TITLE:")) {
                      title = line.slice("TITLE:".length).trim();
                    } else if (line.startsWith("TYPE:")) {
                      const raw = line.slice("TYPE:".length).trim();
                      type = typeMap[raw as keyof typeof typeMap] ?? "single_choice";
                    } else if (line.startsWith("Q:")) {
                      statement = line.slice("Q:".length).trim();
                    } else if (line.startsWith("A*:")) {
                      const text = line.slice("A*:".length).trim();
                      if (type === "short_text") {
                        // трактуем как текстовый ответ
                        textAnswer = text;
                      } else {
                        choices.push({
                          choice_text: text,
                          is_correct: true,
                          order_no: choices.length,
                        });
                      }
                    } else if (line.startsWith("A:")) {
                      const text = line.slice("A:".length).trim();
                      if (type !== "short_text") {
                        choices.push({
                          choice_text: text,
                          is_correct: false,
                          order_no: choices.length,
                        });
                      }
                    } else if (line.startsWith("EXPL:")) {
                      explanation = line.slice("EXPL:".length).trim() || null;
                    }
                  });

                  if (!title || !statement) {
                    errors.push(`Блок ${index + 1}: не заполнены TITLE или Q`);
                    return;
                  }

                  if ((type === "single_choice" || type === "multiple_choice") && choices.length === 0) {
                    errors.push(`Блок ${index + 1}: нет вариантов ответа (A* / A)`);
                    return;
                  }

                  if ((type as string) === "short_text" && !textAnswer) {
                    errors.push(`Блок ${index + 1}: для short_text нужен хотя бы один A*`);
                    return;
                  }

                  parsed.push({
                    title,
                    type,
                    statement,
                    choices,
                    textAnswer,
                    explanation,
                  });
                });

                if (errors.length) {
                  setBulkErrors(errors.join("; "));
                  setBulkParsed([]);
                } else {
                  setBulkErrors(null);
                  setBulkParsed(parsed);
                }
              }}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-gray-50 disabled:opacity-50"
            >
              Проверить формат
            </button>

            <button
              type="button"
              disabled={bulkParsed.length === 0 || bulkSubmitting}
              onClick={async () => {
                setBulkSubmitting(true);
                setError(null);
                setSuccess(null);
                try {
                  for (const item of bulkParsed) {
                    const body: Record<string, unknown> = {
                      subject_id: form.subject_id,
                      topic_id: form.topic_id || null,
                      type: item.type,
                      difficulty: form.difficulty,
                      title: item.title,
                      statement: item.statement,
                      explanation: item.explanation,
                      time_limit_sec: 0,
                      points: Number(form.points),
                    };

                    if (item.type === "short_text") {
                      body.answer_key = { text_answer: item.textAnswer };
                    } else {
                      body.choices = item.choices;
                    }

                    await apiPost("/problems", body, accessToken);
                  }
                  setSuccess(`Создано задач: ${bulkParsed.length}`);
                  setBulkText("");
                  setBulkParsed([]);
                  await loadProblems();
                  onCreated?.();
                } catch (err) {
                  setError(err instanceof Error ? err.message : "Ошибка при массовом создании задач");
                } finally {
                  setBulkSubmitting(false);
                }
              }}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
            >
              {bulkSubmitting ? "Создание..." : "Создать все"}
            </button>
          </div>
        </div>
      )}

      {/* ── Problems list ──────────────────────────────────────── */}
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
          <>
            {selectedIds.length > 0 && (
              <div className="rounded-lg border border-amber-100 bg-amber-50/70 p-3 text-xs text-amber-800">
                <div className="flex flex-wrap items-center gap-3">
                  <span>Выбрано задач: {selectedIds.length}</span>
                  <select
                    value={batchDifficulty}
                    onChange={e => setBatchDifficulty(e.target.value)}
                    className="rounded border border-amber-200 bg-white px-2 py-1 text-xs outline-none focus:border-amber-400"
                  >
                    <option value="">Без изменения сложности</option>
                    {DIFFICULTY_LEVELS.map(d => (
                      <option key={d.value} value={d.value}>{d.label}</option>
                    ))}
                  </select>
                  <input
                    type="number"
                    min={1}
                    placeholder="Новые баллы"
                    value={batchPoints}
                    onChange={e => setBatchPoints(e.target.value)}
                    className="w-24 rounded border border-amber-200 bg-white px-2 py-1 text-xs outline-none focus:border-amber-400"
                  />
                  <select
                    value={batchTopicId}
                    onChange={e => setBatchTopicId(e.target.value)}
                    className="rounded border border-amber-200 bg-white px-2 py-1 text-xs outline-none focus:border-amber-400"
                  >
                    <option value="">Тему не менять</option>
                    {topics.map(t => (
                      <option key={t.id} value={t.id}>{t.title_ru}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    disabled={batchUpdating || (!batchDifficulty && !batchPoints && !batchTopicId)}
                    onClick={async () => {
                      if (!batchDifficulty && !batchPoints && !batchTopicId) return;
                      setBatchUpdating(true);
                      setError(null);
                      try {
                        const updateBodyBase: Record<string, unknown> = {};
                        if (batchDifficulty) updateBodyBase.difficulty = batchDifficulty;
                        if (batchPoints) updateBodyBase.points = Number(batchPoints);
                        if (batchTopicId) updateBodyBase.topic_id = batchTopicId;
                        await Promise.all(
                          selectedIds.map(id =>
                            apiPatch(`/problems/${id}`, updateBodyBase, accessToken),
                          ),
                        );
                        setSuccess("Массовое обновление выполнено.");
                        setSelectedIds([]);
                        setBatchDifficulty("");
                        setBatchPoints("");
                        setBatchTopicId("");
                        await loadProblems({ silent: true });
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Ошибка при массовом обновлении задач");
                      } finally {
                        setBatchUpdating(false);
                      }
                    }}
                    className="rounded bg-amber-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-amber-700 disabled:opacity-50"
                  >
                    {batchUpdating ? "Применение..." : "Применить к выбранным"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedIds([])}
                    className="text-xs text-amber-700 underline-offset-2 hover:underline"
                  >
                    Сбросить выбор
                  </button>
                  {isModerator && (
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
                            selectedIds.map(id =>
                              apiDelete(`/problems/${id}`, accessToken),
                            ),
                          );
                          setSuccess("Выбранные задачи удалены.");
                          setSelectedIds([]);
                          await loadProblems({ silent: true });
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
                      className="text-xs text-rose-700 underline-offset-2 hover:underline disabled:opacity-50"
                    >
                      {batchDeleting ? "Удаление..." : "Удалить выбранные"}
                    </button>
                  )}
                </div>
              </div>
            )}
            {problems.map(p => {
              const statusInfo = STATUS_LABELS[p.status] ?? STATUS_LABELS.draft;
              const canEdit = p.status === "draft" || p.status === "pending_review";
              const checked = selectedIds.includes(p.id);
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
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={e => {
                          const checkedNow = e.target.checked;
                          setSelectedIds(prev =>
                            checkedNow ? [...prev, p.id] : prev.filter(id => id !== p.id),
                          );
                        }}
                        className="h-4 w-4 accent-amber-600"
                      />
                      <h4 className="truncate font-bold text-slate-900">{p.title}</h4>
                      <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-medium ${statusInfo.cls}`}>
                        {statusInfo.label}
                      </span>
                      {(p.images?.length ?? 0) > 0 && (
                        <span className="shrink-0 rounded-full bg-indigo-50 px-2 py-0.5 text-xs text-indigo-600">
                          {p.images.length} фото
                        </span>
                      )}
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
                      onClick={() => setPreviewProblem(p)}
                      className="rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-gray-50"
                    >
                      Просмотр
                    </button>
                    {canEdit && (
                      <button
                        onClick={() => startEdit(p)}
                        disabled={actionInProgress === p.id}
                        className="rounded-lg bg-blue-50 px-3 py-1.5 text-xs font-medium text-blue-700 transition-colors hover:bg-blue-100 disabled:opacity-50"
                      >
                        Редактировать
                      </button>
                    )}
                    <button
                      onClick={() => duplicateFromProblem(p)}
                      disabled={actionInProgress === p.id}
                      className="rounded-lg bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
                    >
                      Копировать
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
                    {p.status === "published" && isModerator && (
                      <button
                        onClick={() => handleCreateVideo(p.id)}
                        disabled={actionInProgress === p.id}
                        className="rounded-lg bg-purple-50 px-3 py-1.5 text-xs font-medium text-purple-700 transition-colors hover:bg-purple-100 disabled:opacity-50"
                      >
                        Сгенерировать видео
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
            })}
          </>
        )}
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-center gap-2">
          <button
            onClick={() => setPage(p => Math.max(1, p - 1))}
            disabled={page <= 1}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Назад
          </button>
          <span className="text-sm text-slate-500">
            {page} / {totalPages}
          </span>
          <button
            onClick={() => setPage(p => Math.min(totalPages, p + 1))}
            disabled={page >= totalPages}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm disabled:opacity-40"
          >
            Далее
          </button>
        </div>
      )}

      {previewProblem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4">
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl"
            onClick={e => e.stopPropagation()}
          >
            <div className="mb-4 flex items-start justify-between gap-3">
              <div>
                <p className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  Просмотр задачи
                </p>
                <h3 className="text-lg font-bold text-slate-900">
                  {previewProblem.title || "Без заголовка"}
                </h3>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {TYPE_LABELS[previewProblem.type] ?? previewProblem.type}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {DIFFICULTY_LABELS[previewProblem.difficulty] ?? previewProblem.difficulty}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {previewProblem.points} б.
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5">
                    {(STATUS_LABELS[previewProblem.status] ?? STATUS_LABELS.draft).label}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setPreviewProblem(null)}
                className="rounded-full bg-slate-100 px-2 py-1 text-sm text-slate-600 hover:bg-slate-200"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <p className="mb-1 text-xs font-medium text-slate-500">Условие</p>
                <div className="text-sm text-slate-800">
                  <ProblemContent body={previewProblem.statement} />
                </div>
              </div>

              {previewProblem.images && previewProblem.images.length > 0 && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Изображения</p>
                  <div className="grid gap-2 sm:grid-cols-2">
                    {previewProblem.images
                      .slice()
                      .sort((a, b) => a.order_no - b.order_no)
                      .map(img => (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          key={img.id}
                          src={img.url}
                          alt={img.alt_text || "Изображение"}
                          className="h-32 w-full rounded-lg border border-gray-200 object-cover"
                        />
                      ))}
                  </div>
                </div>
              )}

              {(previewProblem.type === "single_choice" || previewProblem.type === "multiple_choice") && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Варианты ответа</p>
                  <div className="space-y-1.5">
                    {previewProblem.choices
                      .slice()
                      .sort((a, b) => a.order_no - b.order_no)
                      .map(choice => (
                        <div
                          key={choice.id}
                          className={`flex items-center gap-2 rounded-lg border px-3 py-2 text-sm ${
                            choice.is_correct
                              ? "border-emerald-200 bg-emerald-50"
                              : "border-gray-200 bg-slate-50"
                          }`}
                        >
                          <span
                            className={`rounded-full px-2 py-0.5 text-[11px] ${
                              choice.is_correct
                                ? "bg-emerald-600 text-white"
                                : "bg-gray-200 text-slate-600"
                            }`}
                          >
                            {choice.is_correct ? "Правильный" : "Вариант"}
                          </span>
                          <span className="text-slate-800">
                            <ProblemContent
                              body={choice.choice_text}
                              variant="inline"
                            />
                          </span>
                        </div>
                      ))}
                  </div>
                </div>
              )}

              {previewProblem.type === "short_text" && previewProblem.answer_key?.text_answer && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Правильный ответ</p>
                  <p className="rounded-lg border border-gray-200 bg-slate-50 px-3 py-2 text-sm font-mono text-slate-800">
                    {previewProblem.answer_key.text_answer}
                  </p>
                </div>
              )}

              {previewProblem.explanation && (
                <div>
                  <p className="mb-1 text-xs font-medium text-slate-500">Объяснение</p>
                  <div className="text-sm text-slate-700">
                    <ProblemContent body={previewProblem.explanation} />
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

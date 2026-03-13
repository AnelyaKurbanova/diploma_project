'use client';

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type Subject = {
  id: string;
  code: string;
  name_ru: string;
};

type Topic = {
  id: string;
  subject_id: string;
  grade_level: number | null;
  title_ru: string;
};

type TopicsFormProps = {
  accessToken: string;
};

const EMPTY_FORM = {
  subject_id: "",
  grade_level: "",
  title_ru: "",
};

export function TopicsForm({ accessToken }: TopicsFormProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [topics, setTopics] = useState<Topic[]>([]);
  const [selectedSubject, setSelectedSubject] = useState("");
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

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

  const loadTopics = useCallback(async () => {
    if (!selectedSubject) {
      setTopics([]);
      return;
    }
    setLoading(true);
    try {
      const data = await apiGet<Topic[]>(
        `/topics?subject_id=${selectedSubject}`,
        accessToken,
      );
      setTopics(data);
    } catch {
      setTopics([]);
    } finally {
      setLoading(false);
    }
  }, [accessToken, selectedSubject]);

  useEffect(() => {
    loadTopics();
  }, [loadTopics]);

  const startEdit = (t: Topic) => {
    setEditingId(t.id);
    setForm({
      subject_id: t.subject_id,
      grade_level: t.grade_level != null ? String(t.grade_level) : "",
      title_ru: t.title_ru,
    });
    setError(null);
    setSuccess(null);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
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
        title_ru: form.title_ru,
        title_kk: null,
        title_en: null,
      };

      if (form.grade_level) {
        body.grade_level = Number(form.grade_level);
      }

      if (editingId) {
        await apiPatch(`/topics/${editingId}`, body, accessToken);
        setSuccess("Тема обновлена");
      } else {
        await apiPost("/topics", body, accessToken);
        setSuccess("Тема создана");
      }

      setForm({ ...EMPTY_FORM, subject_id: form.subject_id });
      setEditingId(null);
      if (selectedSubject === form.subject_id || selectedSubject) {
        await loadTopics();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить тему? Это действие нельзя отменить.")) return;
    try {
      await apiDelete(`/topics/${id}`, accessToken);
      if (editingId === id) cancelEdit();
      await loadTopics();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при удалении");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            {editingId ? "Редактировать тему" : "Создать тему"}
          </h3>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="text-xs text-slate-500 hover:text-slate-700"
            >
              Отменить редактирование
            </button>
          )}
        </div>
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Предмет</label>
            <select
              required
              value={form.subject_id}
              onChange={(e) => setForm((f) => ({ ...f, subject_id: e.target.value }))}
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            >
              <option value="">Выберите предмет</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>{s.name_ru}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Название</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={255}
              value={form.title_ru}
              onChange={(e) => setForm((f) => ({ ...f, title_ru: e.target.value }))}
              placeholder="Алгебра"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Класс (1–11)</label>
            <input
              type="number"
              min={1}
              max={11}
              value={form.grade_level}
              onChange={(e) => setForm((f) => ({ ...f, grade_level: e.target.value }))}
              placeholder="Например, 7"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
        </div>

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
                : "Создать тему"}
          </button>
          {editingId && (
            <button
              type="button"
              onClick={cancelEdit}
              className="rounded-lg border border-gray-200 px-4 py-2 text-sm font-medium text-slate-600 transition-colors hover:bg-gray-50"
            >
              Отмена
            </button>
          )}
        </div>
      </form>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">Существующие темы</h3>
          <select
            value={selectedSubject}
            onChange={(e) => setSelectedSubject(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
          >
            <option value="">Выберите предмет</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.id}>{s.name_ru}</option>
            ))}
          </select>
        </div>
        {!selectedSubject ? (
          <p className="p-6 text-center text-sm text-slate-400">Выберите предмет для просмотра тем</p>
        ) : loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : topics.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">Темы ещё не созданы</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {topics.map((t) => (
              <div
                key={t.id}
                className={`flex items-center justify-between px-6 py-3 transition-colors ${
                  editingId === t.id ? "bg-blue-50/50" : "hover:bg-gray-50/50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-900">{t.title_ru}</span>
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => startEdit(t)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => handleDelete(t.id)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-rose-500 transition-colors hover:bg-rose-50 hover:text-rose-700"
                  >
                    Удалить
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

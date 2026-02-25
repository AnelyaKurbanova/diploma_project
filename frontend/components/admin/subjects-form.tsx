'use client';

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost, apiPatch, apiDelete } from "@/lib/api";

type Subject = {
  id: string;
  code: string;
  name_ru: string;
  name_kk: string | null;
  name_en: string | null;
  description_ru: string | null;
  description_kk: string | null;
  description_en: string | null;
  grade_level: number | null;
  topic_count: number;
  created_at: string;
};

type SubjectsFormProps = {
  accessToken: string;
};

const EMPTY_FORM = {
  code: "",
  name_ru: "",
  description_ru: "",
  grade_level: "",
};

export function SubjectsForm({ accessToken }: SubjectsFormProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Subject[]>("/subjects", accessToken);
      setSubjects(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить предметы");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const startEdit = (s: Subject) => {
    setEditingId(s.id);
    setForm({
      code: s.code,
      name_ru: s.name_ru,
      description_ru: s.description_ru ?? "",
      grade_level: s.grade_level != null ? String(s.grade_level) : "",
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
        code: form.code,
        name_ru: form.name_ru,
        name_kk: null,
        name_en: null,
        description_ru: form.description_ru || null,
        description_kk: null,
        description_en: null,
      };
      if (form.grade_level) {
        body.grade_level = Number(form.grade_level);
      }

      if (editingId) {
        await apiPatch(`/subjects/${editingId}`, body, accessToken);
        setSuccess("Предмет обновлён");
      } else {
        await apiPost("/subjects", body, accessToken);
        setSuccess("Предмет создан");
      }
      setForm(EMPTY_FORM);
      setEditingId(null);
      await loadSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при сохранении");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Удалить предмет? Это действие нельзя отменить.")) return;
    try {
      await apiDelete(`/subjects/${id}`, accessToken);
      if (editingId === id) cancelEdit();
      await loadSubjects();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при удалении");
    }
  };

  return (
    <div className="space-y-6">
      <form onSubmit={handleSubmit} className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            {editingId ? "Редактировать предмет" : "Создать предмет"}
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
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Код</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={64}
              value={form.code}
              onChange={(e) => setForm((f) => ({ ...f, code: e.target.value }))}
              placeholder="math"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Название</label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={255}
              value={form.name_ru}
              onChange={(e) => setForm((f) => ({ ...f, name_ru: e.target.value }))}
              placeholder="Математика"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-500">Класс</label>
            <input
              type="number"
              min={1}
              max={11}
              value={form.grade_level}
              onChange={(e) => setForm((f) => ({ ...f, grade_level: e.target.value }))}
              placeholder="1–11 (необязательно)"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
            />
          </div>
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-slate-500">Описание (RU)</label>
          <textarea
            value={form.description_ru}
            onChange={(e) => setForm((f) => ({ ...f, description_ru: e.target.value }))}
            rows={2}
            placeholder="Краткое описание предмета..."
            className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
          />
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
                : "Создать предмет"}
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
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">Существующие предметы</h3>
        </div>
        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : subjects.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">Предметы ещё не созданы</p>
        ) : (
          <div className="divide-y divide-gray-50">
            {subjects.map((s) => (
              <div
                key={s.id}
                className={`flex items-center justify-between px-6 py-3 transition-colors ${
                  editingId === s.id ? "bg-blue-50/50" : "hover:bg-gray-50/50"
                }`}
              >
                <div className="min-w-0 flex-1">
                  <span className="font-medium text-slate-900">{s.name_ru}</span>
                  <span className="ml-2 text-xs text-slate-400">({s.code})</span>
                  <span className="ml-2 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-slate-500">
                    {s.topic_count} тем
                  </span>
                  {s.description_ru && (
                    <p className="mt-0.5 truncate text-xs text-slate-400">{s.description_ru}</p>
                  )}
                </div>
                <div className="ml-4 flex shrink-0 items-center gap-2">
                  <button
                    onClick={() => startEdit(s)}
                    className="rounded-md px-2 py-1 text-xs font-medium text-blue-600 transition-colors hover:bg-blue-50 hover:text-blue-700"
                  >
                    Редактировать
                  </button>
                  <button
                    onClick={() => handleDelete(s.id)}
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

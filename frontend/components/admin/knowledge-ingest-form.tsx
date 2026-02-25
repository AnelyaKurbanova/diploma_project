'use client';

import { useCallback, useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type Subject = {
  id: string;
  code: string;
  name_ru: string;
};

type KnowledgeIngestFormProps = {
  accessToken: string;
};

export function KnowledgeIngestForm({ accessToken }: KnowledgeIngestFormProps) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedCode, setSelectedCode] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const loadSubjects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiGet<Subject[]>("/subjects", accessToken);
      setSubjects(data);
      if (data.length > 0 && !selectedCode) {
        setSelectedCode(data[0].code);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось загрузить предметы");
    } finally {
      setLoading(false);
    }
  }, [accessToken]);

  useEffect(() => {
    loadSubjects();
  }, [loadSubjects]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!file || !selectedCode.trim()) {
      setError("Выберите файл и предмет");
      return;
    }
    if (!file.name.toLowerCase().endsWith(".docx")) {
      setError("Поддерживаются только файлы .docx");
      return;
    }

    setSubmitting(true);
    setError(null);
    setSuccess(null);

    try {
      const formData = new FormData();
      formData.append("file", file);
      formData.append("subject_code", selectedCode.trim());

      const result = await apiPost<{ document_id: string; chunks_count: number }>(
        "/knowledge/ingest",
        formData,
        accessToken,
      );

      setSuccess(
        `Документ загружен: ${result.chunks_count} чанков добавлено в базу знаний`,
      );
      setFile(null);
      const input = document.getElementById("knowledge-file-input") as HTMLInputElement;
      if (input) input.value = "";
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при загрузке документа");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
        <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
        <div className="mt-4 h-32 animate-pulse rounded bg-gray-100" />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-gray-100 bg-white p-6 shadow-sm">
      <h2 className="text-lg font-bold text-slate-900">Загрузка учебников в базу знаний</h2>
      <p className="mt-1 text-sm text-slate-500">
        Загрузите .docx с теорией по предмету. Материалы используются для RAG-генерации лекций.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Предмет
          </label>
          <select
            value={selectedCode}
            onChange={(e) => setSelectedCode(e.target.value)}
            className="w-full max-w-md rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400"
          >
            <option value="">Выберите предмет</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.code}>
                {s.name_ru} ({s.code})
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-slate-700">
            Файл .docx
          </label>
          <input
            id="knowledge-file-input"
            type="file"
            accept=".docx"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full max-w-md text-sm text-slate-500 file:mr-4 file:rounded-lg file:border-0 file:bg-blue-50 file:px-4 file:py-2 file:text-sm file:font-medium file:text-blue-700 hover:file:bg-blue-100"
          />
          {file && (
            <p className="mt-1 text-xs text-slate-400">{file.name}</p>
          )}
        </div>

        {error && (
          <div className="rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-700">
            {error}
          </div>
        )}
        {success && (
          <div className="rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
            {success}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting || !file || !selectedCode}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          {submitting ? "Загрузка..." : "Загрузить в базу знаний"}
        </button>
      </form>
    </div>
  );
}

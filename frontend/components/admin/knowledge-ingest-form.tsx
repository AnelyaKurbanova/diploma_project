'use client';

import { useCallback, useEffect, useState } from "react";
import { apiDelete, apiGet, apiPost } from "@/lib/api";

type Subject = {
  id: string;
  code: string;
  name_ru: string;
};

type KnowledgeDocument = {
  id: string;
  filename: string;
  subject_code: string;
  uploaded_at: string;
  chunks_count: number;
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
  const [documents, setDocuments] = useState<KnowledgeDocument[]>([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [filterCode, setFilterCode] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setDocsLoading(true);
    try {
      const url = filterCode ? `/knowledge/documents?subject_code=${encodeURIComponent(filterCode)}` : "/knowledge/documents";
      const data = await apiGet<KnowledgeDocument[]>(url, accessToken);
      setDocuments(data);
    } catch {
      setDocuments([]);
    } finally {
      setDocsLoading(false);
    }
  }, [accessToken, filterCode]);

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

  useEffect(() => {
    loadDocuments();
  }, [loadDocuments]);

  const handleDelete = async (docId: string, filename: string) => {
    if (!confirm(`Удалить документ «${filename}» и все его чанки?`)) return;
    setDeletingId(docId);
    try {
      await apiDelete(`/knowledge/documents/${docId}`, accessToken);
      setDocuments((prev) => prev.filter((d) => d.id !== docId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось удалить документ");
    } finally {
      setDeletingId(null);
    }
  };

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
      loadDocuments();
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

      <div className="mt-10 border-t border-gray-200 pt-8">
        <h3 className="text-base font-bold text-slate-900">Загруженные документы</h3>
        <p className="mt-1 text-sm text-slate-500">
          Документы в базе знаний по предметам. Удаление удалит и все чанки.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <label className="text-sm text-slate-600">Предмет:</label>
          <select
            value={filterCode}
            onChange={(e) => setFilterCode(e.target.value)}
            className="rounded-lg border border-gray-200 px-3 py-1.5 text-sm outline-none focus:border-blue-400"
          >
            <option value="">Все</option>
            {subjects.map((s) => (
              <option key={s.id} value={s.code}>
                {s.name_ru} ({s.code})
              </option>
            ))}
          </select>
        </div>
        {docsLoading ? (
          <div className="mt-4 h-24 animate-pulse rounded-lg bg-gray-100" />
        ) : documents.length === 0 ? (
          <p className="mt-4 text-sm text-slate-500">Нет загруженных документов</p>
        ) : (
          <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 font-medium text-slate-700">Файл</th>
                  <th className="px-4 py-2 font-medium text-slate-700">Предмет (код)</th>
                  <th className="px-4 py-2 font-medium text-slate-700">Чанков</th>
                  <th className="px-4 py-2 font-medium text-slate-700">Загружен</th>
                  <th className="px-4 py-2 font-medium text-slate-700"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200 bg-white">
                {documents.map((doc) => (
                  <tr key={doc.id}>
                    <td className="px-4 py-2 text-slate-900">{doc.filename}</td>
                    <td className="px-4 py-2 text-slate-600">{doc.subject_code}</td>
                    <td className="px-4 py-2 text-slate-600">{doc.chunks_count}</td>
                    <td className="px-4 py-2 text-slate-500">
                      {new Date(doc.uploaded_at).toLocaleDateString("ru-RU")}
                    </td>
                    <td className="px-4 py-2">
                      <button
                        type="button"
                        onClick={() => handleDelete(doc.id, doc.filename)}
                        disabled={deletingId === doc.id}
                        className="rounded px-2 py-1 text-sm text-rose-600 hover:bg-rose-50 disabled:opacity-50"
                      >
                        {deletingId === doc.id ? "Удаление..." : "Удалить"}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

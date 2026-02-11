'use client';

import { useEffect, useState } from "react";
import { apiGet, apiPost } from "@/lib/api";

type School = {
  id: string;
  name: string;
};

type SchoolsTabProps = {
  accessToken: string;
};

export function SchoolsTab({ accessToken }: SchoolsTabProps) {
  const [schools, setSchools] = useState<School[]>([]);
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [lastCreatedCode, setLastCreatedCode] = useState<string | null>(null);

  const loadSchools = async () => {
    setLoading(true);
    setError(null);
    try {
      // Admin-only endpoint for managing schools
      const data = await apiGet<School[]>("/schools/admin", accessToken);
      setSchools(data);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Не удалось загрузить школы",
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadSchools();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accessToken]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setLastCreatedCode(null);
    try {
      const body = { name: name.trim() };
      const created = await apiPost<{
        id: string;
        name: string;
        teacher_code: string;
      }>("/schools", body, accessToken);

      setSuccess("Школа создана. Код учителя показан ниже один раз.");
      setLastCreatedCode(created.teacher_code);
      setName("");

      // Refresh list
      await loadSchools();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ошибка при создании школы");
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopy = async () => {
    if (!lastCreatedCode) return;
    try {
      await navigator.clipboard.writeText(lastCreatedCode);
      setSuccess("Код скопирован в буфер обмена");
    } catch {
      // ignore
    }
  };

  const handleRegenerate = async (school: School) => {
    if (
      !window.confirm(
        `Сгенерировать новый код учителя для школы "${school.name}"? Старый код сразу перестанет работать.`,
      )
    ) {
      return;
    }

    setRegeneratingId(school.id);
    setError(null);
    setSuccess(null);
    setLastCreatedCode(null);

    try {
      const updated = await apiPost<{
        id: string;
        name: string;
        teacher_code: string;
      }>(`/schools/${school.id}/regenerate`, {}, accessToken);

      setLastCreatedCode(updated.teacher_code);
      setSuccess(
        "Новый код учителя сгенерирован. Он показан ниже один раз, старый код теперь недействителен.",
      );
      await loadSchools();
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Не удалось сгенерировать новый код учителя",
      );
    } finally {
      setRegeneratingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <form
        onSubmit={handleSubmit}
        className="space-y-4 rounded-xl border border-gray-100 bg-white p-6 shadow-sm"
      >
        <div className="flex items-center justify-between">
          <h3 className="text-base font-bold text-slate-900">
            Создать школу и получить код учителя
          </h3>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="sm:col-span-2">
            <label className="mb-1 block text-xs font-medium text-slate-500">
              Название школы
            </label>
            <input
              type="text"
              required
              minLength={2}
              maxLength={255}
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Школа №123, г. Алматы"
              className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            />
          </div>
        </div>

        {lastCreatedCode && (
          <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            <p className="font-semibold">Код учителя для этой школы:</p>
            <div className="mt-1 flex items-center gap-3">
              <code className="rounded bg-white px-2 py-1 font-mono text-sm">
                {lastCreatedCode}
              </code>
              <button
                type="button"
                onClick={handleCopy}
                className="rounded-md bg-amber-600 px-3 py-1 text-xs font-medium text-white hover:bg-amber-700"
              >
                Скопировать
              </button>
            </div>
            <p className="mt-1 text-xs">
              Код показывается только один раз. Сохраните его и передайте
              учителям, чтобы они могли пройти онбординг.
            </p>
          </div>
        )}

        {error && <p className="text-sm text-rose-600">{error}</p>}
        {success && !error && (
          <p className="text-sm text-emerald-600">{success}</p>
        )}

        <div className="flex gap-2">
          <button
            type="submit"
            disabled={submitting}
            className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
          >
            {submitting ? "Создание..." : "Создать школу"}
          </button>
        </div>
      </form>

      <div className="rounded-xl border border-gray-100 bg-white shadow-sm">
        <div className="border-b border-gray-100 px-6 py-4">
          <h3 className="text-base font-bold text-slate-900">
            Список школ (для онбординга)
          </h3>
          <p className="mt-1 text-xs text-slate-400">
            Здесь показываются только название и идентификатор школы. Код
            учителя не хранится в открытом виде, но вы можете сгенерировать
            новый код при необходимости.
          </p>
        </div>
        {loading ? (
          <div className="space-y-2 p-6">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="h-10 animate-pulse rounded bg-gray-100" />
            ))}
          </div>
        ) : schools.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-400">
            Школы ещё не созданы
          </p>
        ) : (
          <div className="divide-y divide-gray-50">
            {schools.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-6 py-3 hover:bg-gray-50/50"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-medium text-slate-900">{s.name}</p>
                  <p className="mt-0.5 break-all text-xs text-slate-400">
                    ID школы: {s.id}
                  </p>
                </div>
                <div className="ml-4 shrink-0">
                  <button
                    type="button"
                    onClick={() => handleRegenerate(s)}
                    disabled={regeneratingId === s.id}
                    className="rounded-md border border-amber-300 bg-amber-50 px-3 py-1.5 text-xs font-medium text-amber-800 transition-colors hover:bg-amber-100 disabled:opacity-60"
                  >
                    {regeneratingId === s.id
                      ? "Обновление..."
                      : "Сгенерировать новый код"}
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


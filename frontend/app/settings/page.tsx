'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { apiGet, apiPatch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

type UserProfile = {
  full_name: string | null;
  school: string | null;
  city: string | null;
  grade_level: number | null;
  preferred_language: string;
  timezone: string;
};

type FormState = {
  full_name: string;
  school: string;
  city: string;
  grade_level: string;
  preferred_language: string;
  timezone: string;
};

function toFormState(profile: UserProfile): FormState {
  return {
    full_name: profile.full_name ?? "",
    school: profile.school ?? "",
    city: profile.city ?? "",
    grade_level: profile.grade_level != null ? String(profile.grade_level) : "",
    preferred_language: profile.preferred_language ?? "ru",
    timezone: profile.timezone ?? "Asia/Almaty",
  };
}

export default function SettingsPage() {
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>({
    full_name: "",
    school: "",
    city: "",
    grade_level: "",
    preferred_language: "ru",
    timezone: "Asia/Almaty",
  });

  useEffect(() => {
    if (isLoading) return;
    if (!user || !accessToken) {
      router.replace("/auth");
    }
  }, [isLoading, user, accessToken, router]);

  useEffect(() => {
    if (!accessToken || !user) return;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const profile = await apiGet<UserProfile>("/me/profile", accessToken);
        setForm(toFormState(profile));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Не удалось загрузить настройки");
      } finally {
        setLoading(false);
      }
    })();
  }, [accessToken, user]);

  const handleSave = async () => {
    if (!accessToken) return;
    setSaving(true);
    setError(null);
    setSuccess(null);
    try {
      await apiPatch<UserProfile>(
        "/me/profile",
        {
          full_name: form.full_name.trim() || null,
          school: form.school.trim() || null,
          city: form.city.trim() || null,
          grade_level:
            form.grade_level.trim() === ""
              ? null
              : Number.parseInt(form.grade_level, 10),
          preferred_language: form.preferred_language.trim() || null,
          timezone: form.timezone.trim() || null,
        },
        accessToken,
      );
      setSuccess("Настройки сохранены");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Не удалось сохранить настройки");
    } finally {
      setSaving(false);
    }
  };

  if (isLoading || !user || !accessToken) {
    return <div className="min-h-screen bg-slate-50" />;
  }

  const userName = user.email.split("@")[0];
  const userRole = user.role ?? "student";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} />
      <main className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <h1 className="mb-6 text-2xl font-extrabold">Настройки</h1>

        <div className="rounded-2xl border border-gray-100 bg-white p-5">
          {loading ? (
            <p className="text-sm text-slate-500">Загрузка...</p>
          ) : (
            <div className="space-y-3">
              <Field
                label="Имя"
                value={form.full_name}
                onChange={(value) => setForm((s) => ({ ...s, full_name: value }))}
              />
              <Field
                label="Школа"
                value={form.school}
                onChange={(value) => setForm((s) => ({ ...s, school: value }))}
              />
              <div className="grid gap-3 sm:grid-cols-2">
                <Field
                  label="Город"
                  value={form.city}
                  onChange={(value) => setForm((s) => ({ ...s, city: value }))}
                />
                <Field
                  label="Класс"
                  type="number"
                  value={form.grade_level}
                  onChange={(value) =>
                    setForm((s) => ({ ...s, grade_level: value }))
                  }
                />
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <label className="block space-y-1 text-sm">
                  <span className="text-slate-600">Язык</span>
                  <select
                    value={form.preferred_language}
                    onChange={(e) =>
                      setForm((s) => ({ ...s, preferred_language: e.target.value }))
                    }
                    className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                  >
                    <option value="ru">Русский</option>
                    <option value="kk">Қазақша</option>
                    <option value="en">English</option>
                  </select>
                </label>
                <Field
                  label="Часовой пояс"
                  value={form.timezone}
                  onChange={(value) =>
                    setForm((s) => ({ ...s, timezone: value }))
                  }
                />
              </div>
            </div>
          )}

          {error && (
            <p className="mt-4 rounded-lg bg-rose-50 px-3 py-2 text-sm text-rose-600">
              {error}
            </p>
          )}
          {success && (
            <p className="mt-4 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              {success}
            </p>
          )}

          <div className="mt-5 flex justify-end">
            <button
              type="button"
              onClick={handleSave}
              disabled={loading || saving}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {saving ? "Сохраняем..." : "Сохранить"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({
  label,
  value,
  onChange,
  type = "text",
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <label className="block space-y-1 text-sm">
      <span className="text-slate-600">{label}</span>
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm text-slate-900 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/30"
      />
    </label>
  );
}

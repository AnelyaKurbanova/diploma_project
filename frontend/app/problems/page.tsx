'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { apiGet } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";

type Problem = {
  id: string;
  subject_id: string;
  topic_id: string | null;
  type: string;
  difficulty: "easy" | "medium" | "hard";
  title: string;
  statement: string;
  explanation: string | null;
  time_limit_sec: number;
  points: number;
  choices: Array<{
    id: string;
    choice_text: string;
    is_correct: boolean;
    order_no: number;
  }>;
  tags: Array<{
    id: string;
    name: string;
  }>;
};

type ProfileResponse = {
  full_name: string | null;
  [key: string]: unknown;
};

const DIFFICULTY_LABELS: Record<string, string> = {
  easy: "Легкая",
  medium: "Средняя",
  hard: "Сложная",
};

const DIFFICULTY_COLORS: Record<string, string> = {
  easy: "bg-emerald-50 text-emerald-700",
  medium: "bg-amber-50 text-amber-700",
  hard: "bg-rose-50 text-rose-700",
};

export default function ProblemsPage() {
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [problems, setProblems] = useState<Problem[]>([]);
  const [selectedDifficulty, setSelectedDifficulty] = useState<string>("all");
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!accessToken || !user) return;

    (async () => {
      try {
        const p = await apiGet<ProfileResponse>("/me/profile", accessToken);
        setProfile(p);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          router.replace("/onboarding");
          return;
        }
        setLoadError("Не удалось загрузить профиль.");
      }
    })();
  }, [accessToken, user, router]);

  useEffect(() => {
    if (!accessToken || !profile) return;

    (async () => {
      try {
        const data = await apiGet<Problem[]>("/problems", accessToken);
        setProblems(data);
      } catch {
        setLoadError("Не удалось загрузить список задач.");
      }
    })();
  }, [accessToken, profile]);

  const filteredProblems = useMemo(() => {
    if (selectedDifficulty === "all") return problems;
    return problems.filter((p) => p.difficulty === selectedDifficulty);
  }, [problems, selectedDifficulty]);

  if (isLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
      </div>
    );
  }

  const userName = profile.full_name ?? user.email.split("@")[0];
  const userRole = user.role ?? "student";

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex items-start justify-between gap-4">
          <div>
            <h1 className="text-2xl font-extrabold sm:text-3xl">Все задачи</h1>
            <p className="mt-1 text-sm text-slate-500">
              Практикуйтесь на задачах разной сложности
            </p>
          </div>
          <div className="rounded-xl bg-white p-1 shadow-sm">
            {["all", "easy", "medium", "hard"].map((difficulty) => (
              <button
                key={difficulty}
                type="button"
                onClick={() => setSelectedDifficulty(difficulty)}
                className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                  selectedDifficulty === difficulty
                    ? "bg-blue-600 text-white"
                    : "text-slate-600 hover:bg-slate-100"
                }`}
              >
                {difficulty === "all"
                  ? "Все"
                  : (DIFFICULTY_LABELS[difficulty] ?? difficulty)}
              </button>
            ))}
          </div>
        </div>

        {loadError && (
          <div className="mb-6 rounded-xl bg-rose-50 px-4 py-3 text-sm text-rose-600">
            {loadError}
          </div>
        )}

        {filteredProblems.length === 0 && !loadError ? (
          <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center text-sm text-slate-400">
            Задачи пока не добавлены
          </div>
        ) : (
          <div className="grid gap-4">
            {filteredProblems.map((problem) => (
              <Link
                key={problem.id}
                href={`/problems/${problem.id}`}
                className="block rounded-2xl border border-gray-100 bg-white p-5 transition-all hover:-translate-y-0.5 hover:shadow-lg"
              >
                <div className="mb-2 flex items-center gap-2">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      DIFFICULTY_COLORS[problem.difficulty] ??
                      "bg-slate-100 text-slate-700"
                    }`}
                  >
                    {DIFFICULTY_LABELS[problem.difficulty] ?? problem.difficulty}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600">
                    {problem.points} балл.
                  </span>
                </div>
                <h2 className="text-base font-semibold text-slate-900">
                  {problem.title}
                </h2>
                <p className="mt-2 line-clamp-2 text-sm text-slate-600">
                  {problem.statement}
                </p>
              </Link>
            ))}
          </div>
        )}
      </main>
    </div>
  );
}

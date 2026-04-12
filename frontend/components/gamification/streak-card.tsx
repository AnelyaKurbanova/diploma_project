import type { UserStreak } from "@/lib/api";

type StreakCardProps = {
  streak: UserStreak;
  isLoading?: boolean;
  error?: unknown;
};

function formatLastActivity(value: string | null) {
  if (!value) return "Пока нет активности";
  const parsed = new Date(`${value}T00:00:00`);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleDateString("ru-RU");
}

export function StreakCard({
  streak,
  isLoading = false,
  error,
}: StreakCardProps) {
  if (isLoading) {
    return <div className="h-[216px] animate-pulse rounded-2xl border border-gray-100 bg-white" />;
  }

  return (
    <section className="flex h-[216px] flex-col rounded-2xl border border-gray-100 bg-white p-6 transition-shadow duration-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-rose-500">
            Streak
          </p>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900">
            {error ? "—" : `${streak.current_streak} дн.`}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {error
              ? "Не удалось загрузить streak"
              : `Лучший результат: ${streak.longest_streak} дн.`}
          </p>
          <p className="mt-1 text-xs text-slate-400">
            {error ? "Сервис временно недоступен" : formatLastActivity(streak.last_activity_date)}
          </p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-rose-50 text-rose-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c1.2 2.66 3.29 4.68 5.84 5.64A7.5 7.5 0 1 1 6.16 8.64C8.71 7.68 10.8 5.66 12 3Z" />
          </svg>
        </div>
      </div>
    </section>
  );
}

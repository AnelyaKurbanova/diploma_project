'use client';

import { useState } from "react";

import type { UserAchievementsResponse, UserAchievement } from "@/lib/api";

type AchievementsPanelProps = {
  achievements: UserAchievementsResponse;
  isLoading?: boolean;
  error?: unknown;
  compact?: boolean;
  unlockedOnly?: boolean;
  limit?: number;
};

function formatUnlockedAt(value: string | null) {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("ru-RU");
}

function AchievementIcon({ iconName }: { iconName: string | null }) {
  const common = "h-5 w-5";
  switch (iconName) {
    case "sparkles":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
        </svg>
      );
    case "bolt":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M13 2 4 14h6l-1 8 9-12h-6l1-8Z" />
        </svg>
      );
    case "book-open":
    case "academic-cap":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
        </svg>
      );
    case "fire":
    case "flame":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3c1.2 2.66 3.29 4.68 5.84 5.64A7.5 7.5 0 1 1 6.16 8.64C8.71 7.68 10.8 5.66 12 3Z" />
        </svg>
      );
    case "trophy":
    case "star":
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 16.5 4.5h-9A2.25 2.25 0 0 0 5.25 6.75v9.75A2.25 2.25 0 0 0 7.5 18.75m9 0v1.125A2.625 2.625 0 0 1 13.875 22.5h-3.75A2.625 2.625 0 0 1 7.5 19.875V18.75" />
        </svg>
      );
    default:
      return (
        <svg className={common} fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 14.59 8.26 20 9.27l-3.91 4.01.92 5.72L12 16.77 6.99 19l.92-5.72L4 9.27l5.41-1.01L12 3Z" />
        </svg>
      );
  }
}

function AchievementItem({
  achievement,
  compact = false,
}: {
  achievement: UserAchievement;
  compact?: boolean;
}) {
  const unlocked = achievement.is_unlocked;
  const unlockedLabel = formatUnlockedAt(achievement.unlocked_at);

  return (
    <article
      className={`rounded-2xl border p-4 transition-all ${
        unlocked
          ? "border-emerald-100 bg-emerald-50/40"
          : "border-gray-100 bg-slate-50/60"
      } ${compact ? "p-2.5" : ""}`}
    >
      <div className={`flex items-start ${compact ? "gap-2.5" : "gap-3"}`}>
        <div
          className={`flex shrink-0 items-center justify-center rounded-2xl ${
            unlocked ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-400"
          } ${compact ? "h-9 w-9" : "h-10 w-10"}`}
        >
          {achievement.icon_url ? (
            <img src={achievement.icon_url} alt="" className="h-5 w-5 object-contain" />
          ) : (
            <AchievementIcon iconName={achievement.icon_name} />
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={`font-semibold text-slate-900 ${compact ? "text-[13px]" : "text-sm"}`}>
              {achievement.title}
            </h3>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                unlocked
                  ? "bg-emerald-100 text-emerald-700"
                  : "bg-slate-200 text-slate-500"
              }`}
            >
              {unlocked ? "Открыто" : "Заблокировано"}
            </span>
          </div>

          {achievement.description && (
            <p className={`mt-1 text-slate-500 ${compact ? "line-clamp-2 text-[11px] leading-4" : "text-xs leading-5"}`}>
              {achievement.description}
            </p>
          )}

          <div className={`mt-1.5 flex flex-wrap items-center gap-2 text-slate-400 ${compact ? "text-[10px] leading-4" : "text-[11px]"}`}>
            {achievement.xp_reward ? <span>Награда: +{achievement.xp_reward} XP</span> : null}
            {unlockedLabel ? <span>Получено: {unlockedLabel}</span> : null}
          </div>
        </div>
      </div>
    </article>
  );
}

function CompactAchievementCard({
  achievement,
}: {
  achievement: UserAchievement;
}) {
  const unlocked = achievement.is_unlocked;

  return (
    <article
      className={`h-full rounded-2xl border p-3 ${
        unlocked
          ? "border-emerald-100 bg-emerald-50/40"
          : "border-gray-100 bg-slate-50/60"
      }`}
    >
      <div className="flex h-full flex-col justify-between">
        <div className="flex items-start gap-3">
          <div
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
              unlocked ? "bg-emerald-100 text-emerald-700" : "bg-white text-slate-400"
            }`}
          >
            {achievement.icon_url ? (
              <img src={achievement.icon_url} alt="" className="h-5 w-5 object-contain" />
            ) : (
              <AchievementIcon iconName={achievement.icon_name} />
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h3 className="line-clamp-2 text-sm font-bold leading-5 text-slate-900">
              {achievement.title}
            </h3>
            <div className="mt-2">
              <span
                className={`inline-flex rounded-full px-2 py-1 text-[10px] font-semibold ${
                  unlocked
                    ? "bg-emerald-100 text-emerald-700"
                    : "bg-slate-200 text-slate-500"
                }`}
              >
                {unlocked ? "Открыто" : "Закрыто"}
              </span>
            </div>
          </div>
        </div>

        <div className="mt-3 flex-1">
          {achievement.description ? (
            <p className="line-clamp-3 text-xs leading-5 text-slate-500">
              {achievement.description}
            </p>
          ) : (
            <p className="text-xs leading-5 text-slate-400">
              Описание недоступно.
            </p>
          )}
        </div>

        <div className="mt-3 border-t border-white/70 pt-2 text-[11px] text-slate-400">
          {achievement.xp_reward ? `Награда: +${achievement.xp_reward} XP` : "Без XP награды"}
        </div>
      </div>
    </article>
  );
}

export function AchievementsPanel({
  achievements,
  isLoading = false,
  error,
  compact = false,
  unlockedOnly = false,
  limit,
}: AchievementsPanelProps) {
  const allFilteredItems = (unlockedOnly
    ? achievements.items.filter((item) => item.is_unlocked)
    : achievements.items);
  const filteredItems = allFilteredItems.slice(0, limit ?? allFilteredItems.length);
  const [activeIndex, setActiveIndex] = useState(0);

  if (isLoading) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <div className="mb-4 h-5 w-40 animate-pulse rounded bg-gray-200" />
        <div className={`grid gap-3 ${compact ? "md:grid-cols-1" : "md:grid-cols-2"}`}>
          {Array.from({ length: compact ? 2 : 4 }).map((_, index) => (
            <div key={index} className="h-28 animate-pulse rounded-2xl bg-slate-50" />
          ))}
        </div>
      </section>
    );
  }

  if (error) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">Достижения</h2>
        <p className="mt-3 text-sm text-rose-600">
          Не удалось загрузить достижения.
        </p>
      </section>
    );
  }

  if (achievements.total === 0) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-6">
        <h2 className="text-base font-bold text-slate-900">Достижения</h2>
        <p className="mt-1 text-xs text-slate-400">
          Открыто {achievements.unlocked_count} из {achievements.total}
        </p>
        <div className="mt-4 rounded-2xl border border-dashed border-gray-200 bg-slate-50/60 px-4 py-6 text-sm text-slate-500">
          Достижения пока не настроены или ещё не загружены в систему.
        </div>
      </section>
    );
  }

  if (filteredItems.length === 0) {
    return (
      <section className="rounded-2xl border border-gray-100 bg-white p-6 transition-shadow duration-300 hover:shadow-md">
        <div className="mb-2">
          <h2 className="text-base font-bold text-slate-900">Достижения</h2>
          <p className="mt-1 text-xs text-slate-400">
            Открыто {achievements.unlocked_count} из {achievements.total}
          </p>
        </div>
        <div className="rounded-2xl border border-dashed border-gray-200 bg-slate-50/60 px-4 py-6 text-sm text-slate-500">
          Пока нет открытых достижений.
        </div>
      </section>
    );
  }

  const safeActiveIndex = Math.min(activeIndex, Math.max(0, filteredItems.length - 1));
  const canGoPrev = safeActiveIndex > 0;
  const canGoNext = safeActiveIndex < filteredItems.length - 1;
  const activeItem = filteredItems[safeActiveIndex] ?? filteredItems[0];

  return (
    <section className={`rounded-2xl border border-gray-100 bg-white p-6 transition-shadow duration-300 hover:shadow-md ${compact ? "flex flex-col" : ""}`}>
      <div className="mb-5 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-base font-bold text-slate-900">Достижения</h2>
          <p className="mt-1 text-xs text-slate-400">
            Открыто {achievements.unlocked_count} из {achievements.total}
          </p>
        </div>
      </div>

      {compact ? (
        <>
          <div>
            <CompactAchievementCard achievement={activeItem} />
          </div>

          {filteredItems.length > 1 && (
            <div className="mt-3 flex shrink-0 items-center justify-between border-t border-gray-100 pt-3">
              <div className="text-xs text-slate-400">
                {safeActiveIndex + 1} / {filteredItems.length}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setActiveIndex((value) => Math.max(0, value - 1))}
                  disabled={!canGoPrev}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Предыдущее достижение"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
                  </svg>
                </button>
                <button
                  type="button"
                  onClick={() => setActiveIndex((value) => Math.min(filteredItems.length - 1, value + 1))}
                  disabled={!canGoNext}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-slate-600 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"
                  aria-label="Следующее достижение"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5 15.75 12l-7.5 7.5" />
                  </svg>
                </button>
              </div>
            </div>
          )}

          {allFilteredItems.length > filteredItems.length && (
            <p className="mt-2 text-xs text-slate-400">
              Ещё {allFilteredItems.length - filteredItems.length}
            </p>
          )}
        </>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {filteredItems.map((achievement) => (
            <AchievementItem key={achievement.id} achievement={achievement} compact={compact} />
          ))}
        </div>
      )}
    </section>
  );
}

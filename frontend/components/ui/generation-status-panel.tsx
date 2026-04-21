"use client";

import {
  formatElapsed,
  type GenerationJobSnapshot,
} from "@/lib/generation-jobs";

function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

type Tone = "slate" | "brand" | "purple" | "emerald";

const TONE_CLASSES: Record<
  Tone,
  {
    container: string;
    label: string;
    bar: string;
    barTrack: string;
    spinner: string;
    successBg: string;
    successText: string;
  }
> = {
  slate: {
    container: "border-slate-200 bg-white text-slate-700",
    label: "text-slate-700",
    bar: "bg-slate-700",
    barTrack: "bg-slate-100",
    spinner: "border-slate-200 border-t-slate-700",
    successBg: "bg-emerald-50",
    successText: "text-emerald-700",
  },
  brand: {
    container: "border-brand-navy/20 bg-brand-navy/5 text-brand-navy",
    label: "text-brand-navy",
    bar: "bg-brand-navy",
    barTrack: "bg-brand-navy/10",
    spinner: "border-brand-navy/20 border-t-brand-navy",
    successBg: "bg-emerald-50",
    successText: "text-emerald-700",
  },
  purple: {
    container: "border-purple-200 bg-purple-50/70 text-purple-900",
    label: "text-purple-900",
    bar: "bg-purple-600",
    barTrack: "bg-purple-100",
    spinner: "border-purple-200 border-t-purple-700",
    successBg: "bg-emerald-50",
    successText: "text-emerald-700",
  },
  emerald: {
    container: "border-emerald-200 bg-emerald-50/70 text-emerald-900",
    label: "text-emerald-900",
    bar: "bg-emerald-600",
    barTrack: "bg-emerald-100",
    spinner: "border-emerald-200 border-t-emerald-700",
    successBg: "bg-emerald-50",
    successText: "text-emerald-800",
  },
};

export type GenerationStatusPanelProps = {
  title: string;
  snapshot: GenerationJobSnapshot | null;
  active: boolean;
  fallbackMessage?: string;
  tone?: Tone;
  onRetry?: () => void;
  onDismiss?: () => void;
  successMessage?: string | null;
  className?: string;
};

export function GenerationStatusPanel({
  title,
  snapshot,
  active,
  fallbackMessage = "Генерация запущена…",
  tone = "brand",
  onRetry,
  onDismiss,
  successMessage,
  className,
}: GenerationStatusPanelProps) {
  const status = snapshot?.status ?? (active ? "running" : "idle");
  const progress = Math.max(0, Math.min(100, snapshot?.progress_percent ?? 0));
  const stageMessage =
    snapshot?.stage_message ||
    (snapshot && snapshot.error ? snapshot.error : null) ||
    fallbackMessage;
  const classes = TONE_CLASSES[tone];

  if (status === "failed") {
    return (
      <div
        className={cx(
          "rounded-lg border bg-rose-50 p-3 text-rose-900 shadow-sm",
          className,
        )}
        role="alert"
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{title}: не удалось завершить</p>
            <p className="mt-1 text-xs text-rose-800/90">
              {snapshot?.error || stageMessage}
            </p>
            <p className="mt-0.5 text-[11px] text-rose-700/80">
              Потрачено времени: {formatElapsed(snapshot?.elapsed_ms ?? 0)}
            </p>
          </div>
          <div className="flex gap-2">
            {onRetry && (
              <button
                type="button"
                onClick={onRetry}
                className="rounded-md bg-rose-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-rose-700"
              >
                Повторить
              </button>
            )}
            {onDismiss && (
              <button
                type="button"
                onClick={onDismiss}
                className="rounded-md px-2 py-1 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-100"
              >
                Закрыть
              </button>
            )}
          </div>
        </div>
      </div>
    );
  }

  if (status === "done") {
    if (!successMessage && !onDismiss) return null;
    return (
      <div
        className={cx(
          "rounded-lg border border-emerald-200 p-3 shadow-sm",
          classes.successBg,
          classes.successText,
          className,
        )}
      >
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div>
            <p className="text-sm font-semibold">{title}: готово</p>
            {successMessage && (
              <p className="mt-1 text-xs">{successMessage}</p>
            )}
          </div>
          {onDismiss && (
            <button
              type="button"
              onClick={onDismiss}
              className="rounded-md px-2 py-1 text-xs font-medium text-emerald-800/80 transition-colors hover:bg-white/40"
            >
              Закрыть
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div
      className={cx(
        "rounded-lg border p-3 shadow-sm",
        classes.container,
        className,
      )}
      role="status"
      aria-live="polite"
    >
      <div className="flex items-start gap-2">
        <span
          className={cx(
            "mt-0.5 inline-block size-4 shrink-0 animate-spin rounded-full border-2",
            classes.spinner,
          )}
          aria-hidden
        />
        <div className="min-w-0 flex-1">
          <p className={cx("text-xs font-semibold", classes.label)}>{title}</p>
          <p className="mt-0.5 truncate text-xs">{stageMessage}</p>
          <div
            className={cx("mt-2 h-1.5 w-full overflow-hidden rounded-full", classes.barTrack)}
          >
            <div
              className={cx(
                "h-full rounded-full transition-all duration-500 ease-out",
                classes.bar,
              )}
              style={{ width: `${Math.max(4, progress)}%` }}
            />
          </div>
          <div className="mt-1 flex items-center justify-between text-[11px] opacity-80">
            <span>{progress}%</span>
            <span>прошло: {formatElapsed(snapshot?.elapsed_ms ?? 0)}</span>
          </div>
        </div>
      </div>
    </div>
  );
}

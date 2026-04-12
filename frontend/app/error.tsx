"use client";

import Link from "next/link";
import { useEffect } from "react";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled page error", error);
  }, [error]);

  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-12 text-[#0f2d51]">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_24px_60px_rgba(15,45,81,0.12)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#5081ba]">
          Ошибка
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          Не удалось загрузить страницу
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Мы уже записали технические детали. Попробуйте обновить страницу, а если
          ошибка повторится, вернитесь на главную панель.
        </p>

        {error.digest && (
          <p className="mt-4 rounded-2xl bg-slate-50 px-4 py-3 text-xs text-slate-500">
            Код ошибки: {error.digest}
          </p>
        )}

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <button
            type="button"
            onClick={reset}
            className="rounded-xl bg-[#0f2d51] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#184070]"
          >
            Попробовать снова
          </button>
          <Link
            href="/dashboard"
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#5081ba] hover:text-[#0f2d51]"
          >
            На главную панель
          </Link>
        </div>
      </section>
    </main>
  );
}

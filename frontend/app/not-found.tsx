import Link from "next/link";

export default function NotFoundPage() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#f8fafc] px-4 py-12 text-[#0f2d51]">
      <section className="w-full max-w-xl rounded-3xl border border-slate-200 bg-white p-8 text-center shadow-[0_24px_60px_rgba(15,45,81,0.12)]">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-[#5081ba]">
          404
        </p>
        <h1 className="mt-3 text-3xl font-bold text-slate-950">
          Страница не найдена
        </h1>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Возможно, ссылка устарела или страница была перемещена. Можно вернуться
          в личный кабинет или перейти к предметам.
        </p>

        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/dashboard"
            className="rounded-xl bg-[#0f2d51] px-5 py-3 text-sm font-semibold text-white transition hover:bg-[#184070]"
          >
            В личный кабинет
          </Link>
          <Link
            href="/subjects"
            className="rounded-xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:border-[#5081ba] hover:text-[#0f2d51]"
          >
            К предметам
          </Link>
        </div>
      </section>
    </main>
  );
}

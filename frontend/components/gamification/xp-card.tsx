import type { UserXp } from "@/lib/api";

type XpCardProps = {
  xp: UserXp;
  isLoading?: boolean;
  error?: unknown;
};

export function XpCard({ xp, isLoading = false, error }: XpCardProps) {
  if (isLoading) {
    return <div className="h-[216px] animate-pulse rounded-2xl border border-gray-100 bg-white" />;
  }

  return (
    <section className="flex h-[216px] flex-col rounded-2xl border border-gray-100 bg-white p-6 transition-shadow duration-300 hover:shadow-md">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-xs font-medium uppercase tracking-[0.18em] text-amber-500">
            XP
          </p>
          <h2 className="mt-2 text-3xl font-extrabold text-slate-900">
            {error ? "—" : xp.total_xp.toLocaleString("ru-RU")}
          </h2>
          <p className="mt-2 text-sm text-slate-500">
            {error
              ? "Не удалось загрузить опыт"
              : "Суммарный опыт за задачи и завершённые уроки"}
          </p>
        </div>

        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-50 text-amber-600">
          <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 3 14.59 8.26 20 9.27l-3.91 4.01.92 5.72L12 16.77 6.99 19l.92-5.72L4 9.27l5.41-1.01L12 3Z" />
          </svg>
        </div>
      </div>
    </section>
  );
}

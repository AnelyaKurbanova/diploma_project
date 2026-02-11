import type { ReactNode } from "react";

type StatCardProps = {
  icon: ReactNode;
  label: string;
  value: string;
  subValue?: string;
};

export function StatCard({ icon, label, value, subValue }: StatCardProps) {
  return (
    <div className="flex items-center gap-4 rounded-2xl border border-gray-100 bg-white px-5 py-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-xs text-slate-500">{label}</span>
        <span className="text-2xl font-extrabold text-slate-900">{value}</span>
        {subValue && (
          <span className="text-xs text-slate-400">{subValue}</span>
        )}
      </div>
      <div className="ml-auto">{icon}</div>
    </div>
  );
}

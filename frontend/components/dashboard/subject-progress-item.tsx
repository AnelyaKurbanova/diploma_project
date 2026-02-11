import { ProgressBar } from "@/components/ui/progress-bar";

const DOT_COLORS = [
  "bg-blue-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-cyan-500",
];

const BAR_COLORS = [
  "bg-blue-600",
  "bg-amber-500",
  "bg-rose-500",
  "bg-emerald-500",
  "bg-indigo-500",
  "bg-cyan-500",
];

type SubjectProgressItemProps = {
  name: string;
  completedTopics: number;
  totalTopics: number;
  mastery: number;
  index: number;
};

export function SubjectProgressItem({
  name,
  completedTopics,
  totalTopics,
  mastery,
  index,
}: SubjectProgressItemProps) {
  const dot = DOT_COLORS[index % DOT_COLORS.length];
  const bar = BAR_COLORS[index % BAR_COLORS.length];

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className={`h-2.5 w-2.5 rounded-full ${dot}`} />
          <span className="text-sm font-semibold text-slate-900">{name}</span>
        </div>
        <span className="text-xs text-slate-500">
          {completedTopics}/{totalTopics} тем
        </span>
      </div>
      <ProgressBar value={mastery} color={bar} size="sm" />
      <p className="text-xs text-slate-400">Освоение: {mastery}%</p>
    </div>
  );
}

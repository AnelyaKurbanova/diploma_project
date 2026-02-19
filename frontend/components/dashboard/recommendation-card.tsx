import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

type RecommendationCardProps = {
  subjectCode: string;
  subjectName: string;
  mastery: number;
  message: string;
};

export function RecommendationCard({
  subjectCode,
  subjectName,
  message,
}: RecommendationCardProps) {
  return (
    <div className="flex items-center justify-between rounded-xl border border-gray-100 bg-white px-4 py-3">
      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-slate-900">
          {subjectName}
        </p>
        <p className="text-xs text-slate-400">{message}</p>
      </div>
      <Link
        href={`/subjects/${subjectCode}`}
        className={buttonClasses({ variant: "outline", size: "sm", className: "shrink-0 ml-3" })}
      >
        Учить
      </Link>
    </div>
  );
}

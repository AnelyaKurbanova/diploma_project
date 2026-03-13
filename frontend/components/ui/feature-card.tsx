import type { ReactNode } from "react";

type FeatureCardProps = {
  icon: ReactNode;
  title: string;
  description: string;
};

export function FeatureCard({ icon, title, description }: FeatureCardProps) {
  return (
    <div className="group rounded-2xl border border-gray-100 bg-white p-6 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-lg">
      <div className="mb-4">{icon}</div>
      <h3 className="mb-2 text-base font-bold text-slate-900">{title}</h3>
      <p className="text-sm leading-relaxed text-slate-500">{description}</p>
    </div>
  );
}

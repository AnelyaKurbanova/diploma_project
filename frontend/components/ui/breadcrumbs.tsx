"use client";

import Link from "next/link";

export type BreadcrumbItem = {
  label: string;
  href?: string;
  current?: boolean;
};

export function Breadcrumbs({ items }: { items: BreadcrumbItem[] }) {
  if (!items.length) return null;

  return (
    <nav aria-label="Breadcrumb" className="mb-6 flex flex-wrap items-center gap-2 text-sm text-slate-400 animate-page-in">
      {items.map((item, idx) => {
        const isLast = idx === items.length - 1;
        const content = item.href && !isLast && !item.current ? (
          <Link href={item.href} className="transition-colors hover:text-blue-600">
            {item.label}
          </Link>
        ) : (
          <span className={`font-medium ${isLast || item.current ? "text-slate-700" : "text-slate-500"}`}>
            {item.label}
          </span>
        );

        return (
          <span key={`${item.label}-${idx}`} className="flex items-center gap-2">
            {idx > 0 && <span>/</span>}
            {content}
          </span>
        );
      })}
    </nav>
  );
}


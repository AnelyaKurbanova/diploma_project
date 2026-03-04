'use client';

import type { ReactNode } from "react";
import { Breadcrumbs, type BreadcrumbItem } from "@/components/ui/breadcrumbs";

type LessonPlayerLayoutProps = {
  breadcrumbs: BreadcrumbItem[];
  sidebar: ReactNode;
  children: ReactNode;
};

export function LessonPlayerLayout({ breadcrumbs, sidebar, children }: LessonPlayerLayoutProps) {
  return (
    <main className="mx-auto w-full px-4 py-8 sm:px-6 lg:px-10">
      <Breadcrumbs items={breadcrumbs} />

      <div className="grid gap-8 lg:grid-cols-[minmax(260px,320px)_minmax(0,1fr)]">
        <aside className="space-y-4 self-start lg:sticky lg:top-24 lg:max-h-[calc(100vh-7rem)] lg:overflow-y-auto lg:pr-2">
          {sidebar}
        </aside>

        <section className="space-y-6">
          {children}
        </section>
      </div>
    </main>
  );
}


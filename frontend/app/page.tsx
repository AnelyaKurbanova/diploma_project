'use client';

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { EntHeader } from "@/components/ent-header";
import { FeatureCard } from "@/components/ui/feature-card";
import { buttonClasses } from "@/components/ui/button";

/* ─── Icon wrapper for feature cards ─── */
function FeatureIcon({
  children,
  className,
}: {
  children: React.ReactNode;
  className: string;
}) {
  return (
    <div
      className={`flex h-12 w-12 items-center justify-center rounded-xl ${className}`}
    >
      {children}
    </div>
  );
}

/* ─── Feature definitions ─── */
const features = [
  {
    icon: (
      <FeatureIcon className="bg-blue-50">
        <svg
          className="h-6 w-6 text-blue-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25"
          />
        </svg>
      </FeatureIcon>
    ),
    title: "Лекции по темам",
    description:
      "Структурированные материалы по всем предметам с подробными объяснениями",
  },
  {
    icon: (
      <FeatureIcon className="bg-indigo-50">
        <svg
          className="h-6 w-6 text-indigo-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
          />
        </svg>
      </FeatureIcon>
    ),
    title: "AI-видео",
    description:
      "Автоматически генерируемые обучающие видео к каждой лекции",
  },
  {
    icon: (
      <FeatureIcon className="bg-rose-50">
        <svg
          className="h-6 w-6 text-rose-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75"
          />
        </svg>
      </FeatureIcon>
    ),
    title: "Практические задания",
    description:
      "Тысячи задач с автоматической проверкой и подробными решениями",
  },
  {
    icon: (
      <FeatureIcon className="bg-emerald-50">
        <svg
          className="h-6 w-6 text-emerald-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941"
          />
        </svg>
      </FeatureIcon>
    ),
    title: "Аналитика прогресса",
    description:
      "Отслеживайте свой прогресс и уровень освоения материала",
  },
  {
    icon: (
      <FeatureIcon className="bg-amber-50">
        <svg
          className="h-6 w-6 text-amber-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M18 18.72a9.094 9.094 0 0 0 3.741-.479 3 3 0 0 0-4.682-2.72m.94 3.198.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0 1 12 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 0 1 6 18.719m12 0a5.971 5.971 0 0 0-.941-3.197m0 0A5.995 5.995 0 0 0 12 12.75a5.995 5.995 0 0 0-5.058 2.772m0 0a3 3 0 0 0-4.681 2.72 8.986 8.986 0 0 0 3.74.477m.94-3.197a5.971 5.971 0 0 0-.94 3.197M15 6.75a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm6 3a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Zm-13.5 0a2.25 2.25 0 1 1-4.5 0 2.25 2.25 0 0 1 4.5 0Z"
          />
        </svg>
      </FeatureIcon>
    ),
    title: "Классы",
    description:
      "Учителя могут создавать классы и отслеживать прогресс учеников",
  },
  {
    icon: (
      <FeatureIcon className="bg-slate-100">
        <svg
          className="h-6 w-6 text-slate-600"
          fill="none"
          viewBox="0 0 24 24"
          strokeWidth={1.5}
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z"
          />
        </svg>
      </FeatureIcon>
    ),
    title: "Модерация контента",
    description: "Весь контент проходит проверку перед публикацией",
  },
];

export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <EntHeader />

      {/* ─── Hero ─── */}
      <section className="bg-linear-to-b from-blue-50/60 to-white px-4 pb-16 pt-20 sm:px-6 sm:pb-24 sm:pt-28">
        <div className="mx-auto max-w-3xl text-center">
          {/* Hero icon */}
          <div className="mx-auto mb-8 flex h-20 w-20 items-center justify-center rounded-2xl bg-blue-600 shadow-lg shadow-blue-600/20">
            <svg
              className="h-10 w-10"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>

          <h1 className="mb-5 text-4xl font-extrabold tracking-tight text-slate-950 sm:text-5xl">
            Платформа подготовки к&nbsp;ЕНТ
          </h1>

          <p className="mx-auto mb-8 max-w-xl text-base leading-relaxed text-slate-500 sm:text-lg">
            Современная образовательная платформа для учеников 5–11 классов
            с&nbsp;AI-видео, интерактивными заданиями и персонализированной
            аналитикой
          </p>

          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link
              href="/auth/register"
              className={buttonClasses({ variant: "primary", size: "lg" })}
            >
              Начать обучение
            </Link>
            <Link
              href="/auth"
              className={buttonClasses({ variant: "outline", size: "lg" })}
            >
              Войти
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Features ─── */}
      <section className="px-4 py-16 sm:px-6 sm:py-24">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-12 text-center text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Возможности платформы
          </h2>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map((f) => (
              <FeatureCard
                key={f.title}
                icon={f.icon}
                title={f.title}
                description={f.description}
              />
            ))}
          </div>
        </div>
      </section>

      {/* ─── CTA Banner ─── */}
      <section className="px-4 pb-16 sm:px-6 sm:pb-24">
        <div className="mx-auto max-w-6xl">
          <div className="rounded-3xl bg-linear-to-r from-blue-600 to-indigo-600 px-6 py-16 text-center sm:px-12 sm:py-20">
            <h2 className="mb-4 text-2xl font-extrabold text-white sm:text-3xl">
              Готовы начать подготовку к&nbsp;ЕНТ?
            </h2>
            <p className="mx-auto mb-8 max-w-lg text-sm leading-relaxed text-blue-100 sm:text-base">
              Присоединяйтесь к тысячам учеников, которые уже используют нашу
              платформу
            </p>
            <Link
              href="/auth/register"
              className="inline-flex h-11 items-center justify-center rounded-xl border-2 border-white bg-white px-8 text-sm font-semibold text-blue-600 transition-all duration-200 hover:-translate-y-px hover:shadow-lg"
            >
              Зарегистрироваться бесплатно
            </Link>
          </div>
        </div>
      </section>

      {/* ─── Footer ─── */}
      <footer className="border-t border-gray-100 bg-white px-4 py-8 sm:px-6">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-slate-400 sm:flex-row">
          <span>&copy; 2026 ENT Platform</span>
          <nav className="flex gap-4">
            <Link href="/auth" className="transition-colors hover:text-slate-600">
              Войти
            </Link>
            <Link
              href="/auth/register"
              className="transition-colors hover:text-slate-600"
            >
              Регистрация
            </Link>
          </nav>
        </div>
      </footer>
    </div>
  );
}

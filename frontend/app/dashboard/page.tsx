'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";
import { EntHeader } from "@/components/ent-header";

type MeResponse = {
  id: string;
  email: string;
  is_email_verified: boolean;
  is_active: boolean;
};

type ProfileResponse = {
  id: string;
  email: string;
  full_name: string | null;
  onboarding_completed_at: string | null;
  [key: string]: unknown;
};

export default function DashboardPage() {
  const { user, isLoading, accessToken, logout } = useAuth();
  const router = useRouter();
  const [profileChecked, setProfileChecked] = useState(false);

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!accessToken || !user) return;
    (async () => {
      try {
        await apiGet<ProfileResponse>("/me/profile", accessToken);
        setProfileChecked(true);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          router.replace("/onboarding");
          return;
        }
        setProfileChecked(true);
      }
    })();
  }, [accessToken, user, router]);

  if (isLoading || (!user && accessToken) || (user && accessToken && !profileChecked)) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <EntHeader />

        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
          <div className="w-full max-w-[1143px] flex justify-center">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.10),0px_20px_25px_-5px_rgba(0,0,0,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-200">
              <p className="text-sm text-slate-500">
                Проверяем вашу сессию, пожалуйста, подождите...
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (!user) {
    // Пока нет пользователя и нет активного токена — показываем краткое сообщение,
    // редирект на /auth произойдёт в эффекте.
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <EntHeader />

        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
          <div className="w-full max-w-[1143px] flex justify-center">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.10),0px_20px_25px_-5px_rgba(0,0,0,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-200">
              <p className="text-sm text-slate-500">
                Перенаправляем на страницу входа...
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <EntHeader
        rightSlot={
          <button
            type="button"
            onClick={logout}
            className="h-9 rounded-xl bg-blue-600 px-4 text-xs font-semibold leading-5 text-white shadow-[0px_2px_4px_-2px_rgba(21,93,252,0.20),0px_4px_6px_-1px_rgba(21,93,252,0.20)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-lg active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            Выйти
          </button>
        }
      />

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
        <div className="w-full max-w-[1143px] flex justify-center">
          <div className="w-full max-w-3xl rounded-2xl bg-white p-10 shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.10),0px_20px_25px_-5px_rgba(0,0,0,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-200">
            <p className="mb-2 text-xs font-medium uppercase tracking-[0.16em] text-blue-600">
              Личный кабинет
            </p>
            <h1 className="mb-3 text-2xl font-semibold text-slate-900 sm:text-3xl">
              Добро пожаловать, {user.email}
            </h1>
            <p className="mb-4 text-sm text-slate-500">
              Это пример защищённой страницы. Доступ к ней возможен только после
              успешной авторизации через Google.
            </p>

            <div className="mt-4 grid gap-3 text-xs text-slate-500 sm:text-sm">
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-blue-600" />
                <p>В будущем здесь будет прогресс по урокам и задачам.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-emerald-500" />
                <p>История отправок решений и результатов проверок.</p>
              </div>
              <div className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-fuchsia-500" />
                <p>Сводка по активным проектам и дедлайнам.</p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


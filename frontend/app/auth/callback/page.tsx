'use client';

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { EntHeader } from "@/components/ent-header";

type CallbackState = "processing" | "error";

export default function AuthCallbackPage() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const { setFromCallback } = useAuth();

  const [state, setState] = useState<CallbackState>("processing");
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const error = searchParams.get("error");
    const accessToken = searchParams.get("access_token");

    if (error) {
      setState("error");
      setMessage("Авторизация через Google не удалась. Попробуйте ещё раз.");
      return;
    }

    if (!accessToken) {
      setState("error");
      setMessage("Не удалось получить токен доступа от сервера.");
      return;
    }

    (async () => {
      try {
        await setFromCallback(accessToken);
        router.replace("/dashboard");
      } catch {
        setState("error");
        setMessage("Не удалось завершить авторизацию. Попробуйте ещё раз.");
      }
    })();
  }, [router, searchParams, setFromCallback]);

  const isError = state === "error";

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <EntHeader />

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
        <div className="w-full max-w-[1143px] flex justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.10),0px_20px_25px_-5px_rgba(0,0,0,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-200">
            <h1 className="mb-3 text-lg font-semibold text-slate-900">
              {isError ? "Ошибка авторизации" : "Завершаем вход"}
            </h1>
            <p className="text-sm text-slate-500">
              {isError
                ? message
                : "Пожалуйста, подождите. Мы проверяем ваши данные и подготавливаем рабочее пространство."}
            </p>

            {!isError && (
              <div className="mt-6 flex justify-center">
                <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-blue-600" />
              </div>
            )}

            {isError && (
              <button
                type="button"
                onClick={() => router.replace("/auth")}
                className="mt-6 inline-flex items-center justify-center rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-[0px_4px_6px_-4px_rgba(21,93,252,0.20),0px_10px_15px_-3px_rgba(21,93,252,0.20)] transition-all duration-200 ease-out hover:-translate-y-[1px] hover:shadow-lg active:translate-y-[1px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
              >
                Вернуться к входу
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}


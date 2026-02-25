'use client';

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { EntHeader } from "@/components/ent-header";
import { Button } from "@/components/ui/button";

export default function AuthPage() {
  const {
    loginWithGoogle,
    isLoading,
    user,
    error,
    startEmailLogin,
    emailFlowError,
  } = useAuth();

  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);
  const [email, setEmail] = useState("");
  const [isEmailSubmitting, setIsEmailSubmitting] = useState(false);
  const [localEmailError, setLocalEmailError] = useState<string | null>(null);

  const handleEmailSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalEmailError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setLocalEmailError("Введите email, чтобы продолжить.");
      return;
    }

    try {
      setIsEmailSubmitting(true);
      await startEmailLogin(trimmed);
      router.push(
        `/auth/email/verify?purpose=login&email=${encodeURIComponent(trimmed)}`,
      );
    } catch {
      // Сообщение уже выставлено в emailFlowError
    } finally {
      setIsEmailSubmitting(false);
    }
  };

  const effectiveEmailError = localEmailError ?? emailFlowError;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <EntHeader />

      {/* Фон и карточка входа */}
      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
        <div className="w-full max-w-[1143px] flex justify-center">
          <div className="w-96 space-y-6 animate-page-in">
            <div className="flex flex-col gap-6 rounded-2xl bg-white shadow-[0px_8px_10px_-6px_rgba(0,0,0,0.10),0px_20px_25px_-5px_rgba(0,0,0,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-200 transition-shadow duration-300 hover:shadow-lg">
              {/* Заголовок */}
              <div className="w-96 px-6 pt-6">
                <h1 className="mb-1 text-2xl font-bold leading-8 text-slate-950">
                  Вход
                </h1>
                <p className="text-sm font-normal leading-5 text-slate-500">
                  Выберите удобный способ входа в систему.
                </p>
              </div>

              {/* Вход через Google и по email */}
              <div className="w-96 px-6 pb-8 space-y-5">
                <Button
                  type="button"
                  onClick={loginWithGoogle}
                  disabled={isLoading}
                  size="lg"
                  className="w-full"
                >
                  {isLoading ? "Входим..." : "Войти через Google"}
                </Button>

                <div className="flex items-center gap-2 text-[11px] text-slate-400">
                  <div className="h-px flex-1 bg-slate-200" />
                  <span>или по почте</span>
                  <div className="h-px flex-1 bg-slate-200" />
                </div>

                <form onSubmit={handleEmailSubmit} className="space-y-3">
                  <label className="block space-y-1 text-sm">
                    <span className="font-semibold leading-5 text-gray-700">
                      Email
                    </span>
                    <input
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="ваш@email.com"
                      className="w-full rounded-xl border border-gray-300 bg-gray-50 px-3 py-2 text-sm leading-5 text-slate-900 shadow-sm transition-all duration-200 ease-out hover:border-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
                    />
                  </label>

                  <Button
                    type="submit"
                    disabled={isEmailSubmitting}
                    size="lg"
                    className="w-full"
                  >
                    {isEmailSubmitting ? "Отправляем код..." : "Продолжить по почте"}
                  </Button>

                  {effectiveEmailError && (
                    <p className="text-xs text-rose-600">{effectiveEmailError}</p>
                  )}
                </form>

                <div className="pt-2 text-center text-xs text-slate-400">
                  Нет аккаунта?
                  <button
                    type="button"
                    onClick={() => router.push("/auth/register")}
                    className="ml-1 font-semibold text-blue-600"
                  >
                    Зарегистрироваться
                  </button>
                </div>
              </div>
            </div>

            {/* Статусы сессии / пояснения */}
            <div className="space-y-2 text-xs text-gray-600">
              {user && (
                <p>
                  Вы уже вошли как{" "}
                  <span className="font-medium">{user.email}</span>.
                </p>
              )}
              {error && <p className="text-rose-600">{error}</p>}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

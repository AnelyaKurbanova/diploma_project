'use client';

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { EntHeader } from "@/components/ent-header";
import { Button } from "@/components/ui/button";

export default function RegisterPage() {
  const { startEmailRegister, emailFlowError, user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    const trimmed = email.trim();
    if (!trimmed) {
      setLocalError("Введите email, чтобы зарегистрироваться.");
      return;
    }

    try {
      setIsSubmitting(true);
      await startEmailRegister(trimmed);
      router.push(
        `/auth/email/verify?purpose=register&email=${encodeURIComponent(trimmed)}`,
      );
    } catch {
      // Сообщение придёт в emailFlowError
    } finally {
      setIsSubmitting(false);
    }
  };

  const effectiveError = localError ?? emailFlowError;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <EntHeader />

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
        <div className="w-full max-w-[1143px] flex justify-center">
          <div className="w-96 space-y-6">
            <div className="flex flex-col gap-6 rounded-2xl bg-white shadow-[0px_8px_10px_-6px_rgба(0,0,0,0.10),0px_20px_25px_-5px_rgба(0,0,0,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-200">
              <div className="w-96 px-6 pt-6">
                <h1 className="mb-1 text-2xl font-bold leading-8 text-slate-950">
                  Регистрация
                </h1>
                <p className="text-sm font-normal leading-5 text-slate-500">
                  Укажите рабочий email, мы отправим на него 6‑значный код для
                  подтверждения регистрации.
                </p>
              </div>

              <div className="w-96 px-6 pb-8">
                <form onSubmit={handleSubmit} className="space-y-3">
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
                    disabled={isSubmitting}
                    size="lg"
                    className="w-full"
                  >
                    {isSubmitting ? "Отправляем код..." : "Продолжить"}
                  </Button>

                  {effectiveError && (
                    <p className="text-xs text-rose-600">{effectiveError}</p>
                  )}
                </form>

                <div className="mt-4 text-center text-xs text-slate-400">
                  Уже есть аккаунт?{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/auth")}
                    className="font-semibold text-blue-600 cursor-pointer"
                  >
                    Войти
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


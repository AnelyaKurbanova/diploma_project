'use client';

import { useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { EntHeader } from "@/components/ent-header";
import { Button, buttonClasses } from "@/components/ui/button";

export default function EmailVerifyPage() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const {
    isLoading,
    pendingEmail,
    pendingPurpose,
    verifyEmailLogin,
    verifyEmailRegister,
    startEmailLogin,
    startEmailRegister,
    emailFlowError,
    user,
  } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  const emailFromParams = searchParams.get("email");
  const purposeFromParams = searchParams.get("purpose") as
    | "login"
    | "register"
    | null;

  const email = emailFromParams ?? pendingEmail ?? "";
  const purpose = (purposeFromParams ?? pendingPurpose) as
    | "login"
    | "register"
    | null;

  const [code, setCode] = useState("");
  const [isVerifying, setIsVerifying] = useState(false);
  const [localError, setLocalError] = useState<string | null>(null);
  const [remainingSeconds, setRemainingSeconds] = useState(180);
  const [canResend, setCanResend] = useState(false);
  const [resendCounter, setResendCounter] = useState(0);

  // Таймер на 3 минуты
  useEffect(() => {
    if (!email || !purpose) return;

    setCanResend(false);
    setRemainingSeconds(180);

    const id = window.setInterval(() => {
      setRemainingSeconds((prev) => {
        if (prev <= 1) {
          window.clearInterval(id);
          setCanResend(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      window.clearInterval(id);
    };
  }, [email, purpose, resendCounter]);

  const formattedTime = (() => {
    const m = Math.floor(remainingSeconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (remainingSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  })();

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setLocalError(null);

    if (!email || !purpose) {
      setLocalError("Не удалось определить email или тип операции.");
      return;
    }

    const trimmed = code.trim();
    if (trimmed.length !== 6) {
      setLocalError("Введите 6‑значный код из письма.");
      return;
    }

    try {
      setIsVerifying(true);
      if (purpose === "login") {
        await verifyEmailLogin(email, trimmed);
      } else {
        await verifyEmailRegister(email, trimmed);
      }
      router.replace("/dashboard");
    } catch {
      // сообщение уже попадёт в emailFlowError
    } finally {
      setIsVerifying(false);
    }
  };

  const handleResend = async () => {
    if (!email || !purpose || !canResend) return;
    setLocalError(null);

    try {
      if (purpose === "login") {
        await startEmailLogin(email);
      } else {
        await startEmailRegister(email);
      }
      setResendCounter((c) => c + 1);
    } catch {
      // Ошибка отразится в emailFlowError
    }
  };

  if (!email || !purpose) {
    return (
      <div className="min-h-screen bg-white text-slate-900">
        <EntHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
          <div className="w-full max-w-[1143px] flex justify-center">
            <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0px_8px_10px_-6px_rgба(0,0,0,0.10),0px_20px_25px_-5px_rgба(0,0,0,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-200">
              <p className="mb-4 text-sm text-slate-500">
                Не удалось определить email или тип операции для подтверждения
                кода.
              </p>
              <Button
                type="button"
                onClick={() => router.replace("/auth")}
                size="md"
              >
                Вернуться к входу
              </Button>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const effectiveError = localError ?? emailFlowError;

  return (
    <div className="min-h-screen bg-white text-slate-900">
      <EntHeader />

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center bg-gradient-to-b from-blue-50 to-white px-4 py-8">
        <div className="w-full max-w-[1143px] flex justify-center">
          <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-[0px_8px_10px_-6px_rgба(0,0,0,0.10),0px_20px_25px_-5px_rgба(0,0,0,0.10)] outline outline-1 outline-offset-[-1px] outline-gray-200">
            <h1 className="mb-3 text-lg font-semibold text-slate-900">
              Подтвердите код
            </h1>
            <p className="mb-4 text-sm text-slate-500">
              Мы отправили 6‑значный код на{" "}
              <span className="font-semibold text-slate-900">{email}</span>.{" "}
              Введите его ниже, чтобы{" "}
              {purpose === "login" ? "войти" : "завершить регистрацию"}.
            </p>

            <form onSubmit={handleSubmit} className="space-y-4">
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={code}
                onChange={(e) => {
                  const v = e.target.value.replace(/\D/g, "").slice(0, 6);
                  setCode(v);
                }}
                autoFocus
                className="mx-auto block w-40 rounded-xl border border-gray-300 bg-gray-50 px-4 py-2 text-center text-lg tracking-[0.5em] text-slate-900 shadow-sm transition-all duration-200 ease-out hover:border-gray-400 focus:border-blue-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/40"
              />

              <Button
                type="submit"
                disabled={isVerifying || isLoading}
                size="lg"
                className="w-full"
              >
                {isVerifying || isLoading ? "Проверяем код..." : "Подтвердить код"}
              </Button>

              {effectiveError && (
                <p className="text-xs text-rose-600">{effectiveError}</p>
              )}
            </form>

            <div className="mt-4 space-y-2 text-xs text-slate-500">
              <p>
                Можно запросить новый код через{" "}
                <span className="font-semibold">{formattedTime}</span>.
              </p>
              <button
                type="button"
                onClick={handleResend}
                disabled={!canResend}
                className={buttonClasses({
                  variant: "subtle",
                  size: "sm",
                  className:
                    "inline-flex px-3 py-1.5 text-xs text-blue-600 disabled:cursor-not-allowed disabled:opacity-50",
                })}
              >
                Отправить код снова
              </button>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}


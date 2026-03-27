'use client';

import { Suspense, useEffect, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { EntHeader } from "@/components/ent-header";

export default function EmailVerifyPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center" style={{ backgroundColor: "#f8fafc" }}>
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-slate-300 border-t-[#0f2d51]" />
        </div>
      }
    >
      <EmailVerifyInner />
    </Suspense>
  );
}

function EmailVerifyInner() {
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
      <div className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
        <EntHeader />
        <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
          <div
            className="w-full max-w-[526px] overflow-hidden rounded-2xl bg-white p-8 text-center"
            style={{ boxShadow: "0px 10px 15px 0px rgba(0,0,0,0.1)" }}
          >
            <p
              className="mb-4 text-[16px] leading-6 text-[#64748b]"
              style={{ fontFamily: "var(--font-jost)" }}
            >
              Не удалось определить email или тип операции для подтверждения кода.
            </p>
            <button
              type="button"
              onClick={() => router.replace("/auth")}
              className="flex h-10 w-full items-center justify-center rounded-xl bg-[#5081ba] px-4 text-[16px] leading-6 tracking-[-0.3125px] text-white transition-colors hover:bg-[#4070a9]"
              style={{
                fontFamily: "var(--font-jost)",
                boxShadow: "0px 10px 15px 0px rgba(0,0,0,0.1)",
              }}
            >
              Вернуться к входу
            </button>
          </div>
        </main>
      </div>
    );
  }

  const effectiveError = localError ?? emailFlowError;

  return (
    <div className="min-h-screen" style={{ backgroundColor: "#f8fafc" }}>
      <EntHeader />

      <main className="flex min-h-[calc(100vh-4rem)] items-center justify-center px-4 py-8">
        {/* Auth card */}
        <div
          className="w-full max-w-[526px] overflow-hidden rounded-2xl bg-white"
          style={{ boxShadow: "0px 10px 15px 0px rgba(0,0,0,0.1)" }}
        >
          {/* Banner illustration */}
          <div className="relative h-[157px] w-full overflow-hidden rounded-t-2xl">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src="/images/auth-banner.png"
              alt=""
              className="absolute left-0 top-[-189px] h-[478px] max-w-none object-cover"
              style={{ width: "592px" }}
            />
          </div>

          {/* Content */}
          <div className="flex flex-col gap-4 pb-8 pt-4">
            {/* Title block */}
            <div className="flex flex-col gap-1 px-[39px]">
              <h1
                className="text-[36px] leading-10 tracking-[-0.5309px] text-[#0f2d51]"
                style={{ fontFamily: "var(--font-rostov)" }}
              >
                Подтвердите код
              </h1>
              <p
                className="text-[16px] leading-6 tracking-[-0.3125px] text-[#64748b]"
                style={{ fontFamily: "var(--font-jost)" }}
              >
                Мы отправили 6‑значный код на{" "}
                <span className="font-semibold text-[#0f2d51]">{email}</span>.{" "}
                Введите его ниже, чтобы{" "}
                {purpose === "login" ? "войти" : "завершить регистрацию"}.
              </p>
            </div>

            {/* Form */}
            <div className="flex flex-col gap-3 px-[39px]">
              <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                <label className="flex flex-col gap-2">
                  <span
                    className="text-[14px] font-semibold leading-5 text-[#364153]"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    Код из письма
                  </span>
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
                    placeholder="000000"
                    className="h-11 w-full rounded-xl border border-[#d1d5dc] bg-[#fafbfc] px-3 text-center text-[20px] tracking-[0.4em] text-black outline-none transition-colors hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    style={{ fontFamily: "var(--font-inter)" }}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isVerifying || isLoading}
                  className="flex h-10 w-full items-center justify-center rounded-xl bg-[#5081ba] px-4 text-[16px] leading-6 tracking-[-0.3125px] text-white transition-colors hover:bg-[#4070a9] disabled:opacity-70"
                  style={{
                    fontFamily: "var(--font-jost)",
                    boxShadow: "0px 10px 15px 0px rgba(0,0,0,0.1)",
                  }}
                >
                  {isVerifying || isLoading ? "Проверяем код..." : "Подтвердить код"}
                </button>

                {effectiveError && (
                  <p className="text-xs text-rose-600">{effectiveError}</p>
                )}
              </form>

              {/* Resend */}
              <div className="flex flex-col items-center gap-2">
                <p
                  className="text-[14px] leading-5 text-[#4a5565]"
                  style={{ fontFamily: "var(--font-inter)" }}
                >
                  {canResend ? (
                    "Можно запросить новый код"
                  ) : (
                    <>
                      Повторный код через{" "}
                      <span className="font-semibold">{formattedTime}</span>
                    </>
                  )}
                </p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={!canResend}
                  className="text-[16px] leading-6 tracking-[-0.3125px] text-[#155dfc] transition-opacity hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                  style={{ fontFamily: "var(--font-jost)" }}
                >
                  Отправить код снова
                </button>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

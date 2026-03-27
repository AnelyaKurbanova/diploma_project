'use client';

import { useEffect, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { EntHeader } from "@/components/ent-header";

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
                Регистрация
              </h1>
              <p
                className="text-[16px] leading-6 tracking-[-0.3125px] text-[#64748b]"
                style={{ fontFamily: "var(--font-jost)" }}
              >
                Укажите рабочий email — мы отправим на него 6‑значный код подтверждения
              </p>
            </div>

            {/* Form */}
            <div className="flex flex-col gap-3 px-[39px]">
              <form onSubmit={handleSubmit} className="flex flex-col gap-2">
                <label className="flex flex-col gap-2">
                  <span
                    className="text-[14px] font-semibold leading-5 text-[#364153]"
                    style={{ fontFamily: "var(--font-inter)" }}
                  >
                    Email
                  </span>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="ваш@email.com"
                    className="h-11 w-full rounded-xl border border-[#d1d5dc] bg-[#fafbfc] px-3 text-[14px] text-black outline-none transition-colors hover:border-gray-400 focus:border-blue-500 focus:ring-2 focus:ring-blue-500/30"
                    style={{ fontFamily: "var(--font-inter)" }}
                  />
                </label>

                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="flex h-10 w-full items-center justify-center rounded-xl bg-[#5081ba] px-4 text-[16px] leading-6 tracking-[-0.3125px] text-white transition-colors hover:bg-[#4070a9] disabled:opacity-70"
                  style={{
                    fontFamily: "var(--font-jost)",
                    boxShadow: "0px 10px 15px 0px rgba(0,0,0,0.1)",
                  }}
                >
                  {isSubmitting ? "Отправляем код..." : "Продолжить"}
                </button>

                {effectiveError && (
                  <p className="text-xs text-rose-600">{effectiveError}</p>
                )}
              </form>

              {/* Login link */}
              <div className="flex items-center justify-center">
                <p
                  className="text-[16px] leading-6 tracking-[-0.3125px] text-[#4a5565]"
                  style={{ fontFamily: "var(--font-jost)" }}
                >
                  Уже есть аккаунт?{" "}
                  <button
                    type="button"
                    onClick={() => router.push("/auth")}
                    className="text-[#155dfc] hover:underline"
                    style={{ fontFamily: "var(--font-jost)" }}
                  >
                    Войти
                  </button>
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

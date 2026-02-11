import Link from "next/link";
import { buttonClasses } from "@/components/ui/button";

type EntHeaderProps = {
  /** Replaces the default "Войти / Регистрация" nav when provided */
  rightSlot?: React.ReactNode;
};

export function EntHeader({ rightSlot }: EntHeaderProps) {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-blue-600 shadow-sm">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="white"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z" />
              <path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z" />
            </svg>
          </div>
          <span className="text-lg font-bold text-slate-900">
            ENT Platform
          </span>
        </Link>

        {/* Right: custom slot or default auth nav */}
        {rightSlot ?? (
          <nav className="flex items-center gap-3">
            <Link
              href="/auth"
              className="text-sm font-medium text-slate-600 transition-colors hover:text-slate-900"
            >
              Войти
            </Link>
            <Link
              href="/auth/register"
              className={buttonClasses({ variant: "primary", size: "sm" })}
            >
              Регистрация
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}

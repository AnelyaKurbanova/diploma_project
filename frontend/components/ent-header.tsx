'use client';

import type { ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { buttonClasses } from "@/components/ui/button";

type EntHeaderProps = {
  rightSlot?: ReactNode;
};

export function EntHeader({ rightSlot }: EntHeaderProps) {
  const { user, logout } = useAuth();
  const router = useRouter();

  const handleLogout = async () => {
    await logout();
    router.replace("/");
  };

  const defaultRightSlot = user ? (
    <div className="flex items-center gap-3">
      <Link
        href="/dashboard"
        className={buttonClasses({
          variant: "ghost",
          size: "sm",
          className: "hidden sm:inline-flex gap-2 text-slate-700 hover:bg-blue-50 hover:text-blue-700",
        })}
      >
        <span>Панель управления</span>
      </Link>
      <button
        type="button"
        onClick={handleLogout}
        className={buttonClasses({ variant: "primary", size: "sm" })}
      >
        Выйти
      </button>
      <div className="flex items-center gap-2">
        <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-600 text-xs font-semibold text-white shadow-sm">
          {(user.email ?? "?").charAt(0).toUpperCase()}
        </div>
        <div className="hidden md:block text-left">
          <div className="text-xs font-medium text-slate-900 truncate max-w-[160px]">
            {user.email}
          </div>
        </div>
      </div>
    </div>
  ) : (
    <div className="flex items-center gap-2">
      <Link
        href="/auth"
        className={buttonClasses({
          variant: "ghost",
          size: "sm",
          className: "text-slate-950",
        })}
      >
        Войти
      </Link>
      <Link
        href="/auth/register"
        className={buttonClasses({
          variant: "gradient",
          size: "sm",
        })}
      >
        Регистрация
      </Link>
    </div>
  );

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md shadow-sm">
      <div className="mx-auto flex h-16 max-w-[1143px] items-center justify-between px-4">
        <Link
          href="/"
          className="flex items-center gap-2.5 text-xl font-semibold group"
        >
          <div className="p-1.5 rounded-lg bg-gradient-to-br from-blue-600 to-indigo-600 text-white shadow-sm group-hover:shadow-md transition-shadow">
            <span className="block text-sm leading-none">ENT</span>
          </div>
          <span className="text-gray-900 transition-colors group-hover:text-blue-600">
            ENT Platform
          </span>
        </Link>

        <div className="flex items-center gap-2">
          {rightSlot ?? defaultRightSlot}
        </div>
      </div>
    </header>
  );
}


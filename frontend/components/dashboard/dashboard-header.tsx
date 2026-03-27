'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";

type DashboardHeaderProps = {
  userName: string;
  userRole: string;
  avatarUrl?: string | null;
};

const NAV_ITEMS = [
  { href: "/dashboard", label: "Панель управления", icon: LayoutPanelIcon },
  { href: "/subjects", label: "Предметы", icon: BooksIcon },
  { href: "/problems", label: "Все задачи", icon: TasksIcon },
];

const ADMIN_ROLES = new Set(["content_maker", "moderator", "admin"]);

function LayoutPanelIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <rect x="2" y="2" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13" y="2" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="2" y="13" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <rect x="13" y="13" width="9" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BooksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function TasksIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function BellIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="24" height="24" viewBox="0 0 24 24" fill="none">
      <path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0 1 18 14.158V11a6.002 6.002 0 0 0-4-5.659V5a2 2 0 1 0-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 1 1-6 0v-1m6 0H9" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function AikaIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ShieldIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="16" height="16" viewBox="0 0 24 24" fill="none">
      <path d="M9 12.75 11.25 15 15 9.75m-3-7.036A11.959 11.959 0 0 1 3.598 6 11.99 11.99 0 0 0 3 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285Z" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const ROLE_LABELS: Record<string, string> = {
  student: "Ученик",
  teacher: "Учитель",
  admin: "Админ",
  moderator: "Модератор",
  content_maker: "Контент-мейкер",
};

export function DashboardHeader({ userName, userRole, avatarUrl }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { logout } = useAuth();

  const avatarSrc = avatarUrl || "/images/default-avatar.png";

  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (
        menuRef.current &&
        event.target instanceof Node &&
        !menuRef.current.contains(event.target)
      ) {
        setMenuOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen]);

  const handleLogout = async () => {
    await logout();
    router.push("/auth");
  };

  return (
    <header
      className="sticky top-0 z-50 bg-white"
      style={{ boxShadow: "0px 10px 15px 0px rgba(0,0,0,0.1)" }}
    >
      <div className="flex h-16 items-center justify-between px-8">
        {/* Logo */}
        <Link
          href="/"
          className="shrink-0 text-[24px] leading-10 tracking-[-0.5309px] text-[#0f2d51] font-normal"
          style={{ fontFamily: "var(--font-rostov)" }}
        >
          ÖrkenAI
        </Link>

        {/* Right side: nav + bell + profile */}
        <div className="flex items-center gap-6">
          {/* Nav tabs */}
          <nav className="flex items-center gap-4">
            {NAV_ITEMS.map((item) => {
              const active =
                pathname === item.href ||
                (item.href !== "/" && pathname.startsWith(`${item.href}/`));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className="flex items-center gap-1 rounded px-1 py-1 text-[16px] leading-6 tracking-[-0.3125px] text-[#0a0a0a] transition-colors"
                  style={{
                    fontFamily: "var(--font-jost)",
                    backgroundColor: active ? "rgba(21,93,252,0.1)" : "transparent",
                  }}
                >
                  <item.icon className="h-4 w-4 shrink-0" />
                  {item.label}
                </Link>
              );
            })}
            <Link
              href="/aika"
              className="flex items-center gap-1 rounded px-1 py-1 text-[16px] leading-6 tracking-[-0.3125px] text-[#0a0a0a] transition-colors"
              style={{
                fontFamily: "var(--font-jost)",
                backgroundColor:
                  pathname === "/aika" || pathname.startsWith("/aika/")
                    ? "rgba(21,93,252,0.1)"
                    : "transparent",
              }}
            >
              <AikaIcon className="h-4 w-4 shrink-0" />
              Aika
            </Link>
            {ADMIN_ROLES.has(userRole) && (
              <Link
                href="/admin"
                className="flex items-center gap-1 rounded px-1 py-1 text-[16px] leading-6 tracking-[-0.3125px] text-[#0a0a0a] transition-colors"
                style={{
                  fontFamily: "var(--font-jost)",
                  backgroundColor: pathname.startsWith("/admin")
                    ? "rgba(21,93,252,0.1)"
                    : "transparent",
                }}
              >
                <ShieldIcon className="h-4 w-4 shrink-0" />
                Админ панель
              </Link>
            )}
          </nav>

          {/* Bell + Profile */}
          <div className="flex items-center">
            {/* Bell notification button */}
            <button
              type="button"
              className="relative flex items-center justify-center p-2"
              aria-label="Уведомления"
            >
              <BellIcon className="h-6 w-6 text-[#0a0a0a]" />
              {/* Red badge */}
              <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full border-2 border-white bg-[#ef4444]" />
            </button>

            {/* Profile */}
            <div ref={menuRef} className="relative ml-1">
              <button
                type="button"
                onClick={() => setMenuOpen((open) => !open)}
                className="flex items-center gap-0 rounded-[10px]"
              >
                {/* Avatar with teal border */}
                <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-[#15fcf4] bg-[#eff6ff]">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={avatarSrc}
                    alt={userName}
                    className="h-full w-full object-cover"
                  />
                </div>
                {/* Name + role */}
                <div className="ml-3.5 flex flex-col items-start">
                  <span
                    className="whitespace-nowrap text-[16px] leading-6 tracking-[-0.3125px] text-[#0a0a0a]"
                    style={{ fontFamily: "var(--font-jost)" }}
                  >
                    {userName}
                  </span>
                  <span
                    className="whitespace-nowrap text-[16px] leading-6 tracking-[-0.3125px] text-[#6a7282]"
                    style={{ fontFamily: "var(--font-jost)" }}
                  >
                    {ROLE_LABELS[userRole] ?? userRole}
                  </span>
                </div>
              </button>

              {menuOpen && (
                <div className="absolute right-0 mt-2 w-60 origin-top-right overflow-hidden rounded-xl border border-gray-100 bg-white shadow-lg ring-1 ring-black/5">
                  <div className="border-b border-gray-100 px-4 py-3">
                    <p className="text-xs font-medium text-slate-400">Мой аккаунт</p>
                    <p className="mt-1 truncate text-sm font-semibold text-slate-900">
                      {userName}
                    </p>
                    <p className="text-xs text-slate-400">
                      {ROLE_LABELS[userRole] ?? userRole}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/profile");
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 hover:bg-gray-50"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4Z" />
                        <path d="M6 20c0-2.21 2.69-4 6-4s6 1.79 6 4" />
                      </svg>
                      <span>Профиль</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/dashboard");
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 hover:bg-gray-50"
                    >
                      <LayoutPanelIcon className="h-4 w-4" />
                      <span>Панель управления</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMenuOpen(false);
                        router.push("/settings");
                      }}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm text-slate-600 hover:bg-gray-50"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 0 0 2.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 0 0 1.065 2.572c1.757.426 1.757 2.924 0 3.35a1.724 1.724 0 0 0-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 0 0-2.572 1.065c-.426 1.757-2.924 1.757-3.35 0a1.724 1.724 0 0 0-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 0 0-1.065-2.572c-1.757-.426-1.757-2.924 0-3.35a1.724 1.724 0 0 0 1.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.573-1.065Z" />
                        <path d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
                      </svg>
                      <span>Настройки</span>
                    </button>
                  </div>
                  <div className="border-t border-gray-100 py-1">
                    <button
                      type="button"
                      onClick={handleLogout}
                      className="flex w-full items-center gap-2 px-4 py-2 text-left text-sm font-medium text-rose-600 hover:bg-rose-50"
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6A2.25 2.25 0 0 0 5.25 5.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15" />
                        <path d="M18 12H9.75" />
                        <path d="m15 9 3 3-3 3" />
                      </svg>
                      <span>Выйти</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}

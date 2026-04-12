'use client';

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { useAuth } from "@/lib/auth-context";
import {
  apiMarkAllNotificationsRead,
  apiMarkNotificationRead,
  type UserNotification,
} from "@/lib/api";
import { useMyNotifications } from "@/lib/swr-hooks";

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

function TrophyIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 18.75h-9m9 0v1.125A2.625 2.625 0 0 1 13.875 22.5h-3.75A2.625 2.625 0 0 1 7.5 19.875V18.75m9 0A2.25 2.25 0 0 0 18.75 16.5V6.75A2.25 2.25 0 0 0 16.5 4.5h-9A2.25 2.25 0 0 0 5.25 6.75V16.5a2.25 2.25 0 0 0 2.25 2.25m0-10.5h9m-9 3h9" />
    </svg>
  );
}

function UserPlusIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M18 7.5v6m3-3h-6M15.75 18.75a6.728 6.728 0 0 0-7.5 0m7.5 0a9 9 0 1 0-7.5 0m7.5 0A8.966 8.966 0 0 1 12 21a8.966 8.966 0 0 1-3.75-.825M15 7.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
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

function formatNotificationTime(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("ru-RU", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function ClipboardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} width="20" height="20" viewBox="0 0 24 24" fill="none">
      <path
        d="M9 12h6m-6 4h6m2 5H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5.586a1 1 0 0 1 .707.293l5.414 5.414a1 1 0 0 1 .293.707V19a2 2 0 0 1-2 2Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function NotificationItemIcon({
  notification,
}: {
  notification: UserNotification;
}) {
  const iconClassName = "h-5 w-5";
  if (notification.type === "achievement_unlocked") {
    return <TrophyIcon className={iconClassName} />;
  }
  if (notification.type === "class_assessment_published") {
    return <ClipboardIcon className={iconClassName} />;
  }
  return <UserPlusIcon className={iconClassName} />;
}

export function DashboardHeader({ userName, userRole, avatarUrl }: DashboardHeaderProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { accessToken, logout } = useAuth();
  const {
    notifications,
    isLoading: notificationsLoading,
    mutate: mutateNotifications,
  } = useMyNotifications();

  const avatarSrc = avatarUrl || "/images/default-avatar.png";

  const [menuOpen, setMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [notificationsBusy, setNotificationsBusy] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);
  const notificationsRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!menuOpen && !notificationsOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (!(event.target instanceof Node)) {
        return;
      }
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setMenuOpen(false);
      }
      if (notificationsRef.current && !notificationsRef.current.contains(event.target)) {
        setNotificationsOpen(false);
      }
    }
    function handleEscape(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMenuOpen(false);
        setNotificationsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleEscape);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleEscape);
    };
  }, [menuOpen, notificationsOpen]);

  const handleLogout = async () => {
    await logout();
    router.push("/auth");
  };

  const handleMarkAllNotificationsRead = async () => {
    if (!accessToken || notifications.unread_count === 0) return;
    setNotificationsBusy(true);
    try {
      await apiMarkAllNotificationsRead(accessToken);
      await mutateNotifications();
    } catch (error) {
      console.error("Failed to mark all notifications as read", error);
    } finally {
      setNotificationsBusy(false);
    }
  };

  const handleNotificationClick = async (notification: UserNotification) => {
    if (!accessToken) {
      setNotificationsOpen(false);
      if (notification.action_url) {
        router.push(notification.action_url);
      }
      return;
    }

    setNotificationsBusy(true);
    try {
      if (!notification.is_read) {
        await apiMarkNotificationRead(notification.id, accessToken);
      }
      await mutateNotifications();
    } catch (error) {
      console.error("Failed to mark notification as read", error);
    } finally {
      setNotificationsBusy(false);
      setNotificationsOpen(false);
    }

    if (notification.action_url) {
      router.push(notification.action_url);
    }
  };

  return (
    <header
      className="sticky top-0 z-50 bg-white"
      style={{ boxShadow: "0px 10px 15px 0px rgba(0,0,0,0.1)" }}
    >
      <div className="flex h-16 items-center justify-between px-8">
        {}
        <Link
          href="/"
          className="shrink-0 text-[24px] leading-10 tracking-[-0.5309px] text-[#0f2d51] font-normal"
          style={{ fontFamily: "var(--font-rostov)" }}
        >
          ÖrkenAI
        </Link>

        {}
        <div className="flex items-center gap-6">
          {}
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

          {}
          <div className="flex items-center">
            <div ref={notificationsRef} className="relative">
              <button
                type="button"
                onClick={() => {
                  setNotificationsOpen((open) => !open);
                  setMenuOpen(false);
                }}
                className="relative flex items-center justify-center p-2"
                aria-label="Уведомления"
              >
                <BellIcon className="h-6 w-6 text-[#0a0a0a]" />
                {notifications.unread_count > 0 ? (
                  <span className="absolute right-0.5 top-0.5 min-w-5 rounded-full bg-[#ef4444] px-1.5 py-0.5 text-center text-[11px] font-semibold leading-none text-white">
                    {notifications.unread_count > 9 ? "9+" : notifications.unread_count}
                  </span>
                ) : null}
              </button>

              {notificationsOpen && (
                <div className="absolute right-0 mt-2 w-[22rem] overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl ring-1 ring-black/5">
                  <div className="flex items-start justify-between gap-3 border-b border-slate-100 px-4 py-3">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Уведомления</p>
                      <p className="text-xs text-slate-500">
                        {notifications.unread_count > 0
                          ? `Непрочитанных: ${notifications.unread_count}`
                          : "Все уведомления прочитаны"}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={handleMarkAllNotificationsRead}
                      disabled={notifications.unread_count === 0 || notificationsBusy}
                      className="text-xs font-medium text-blue-600 transition hover:text-blue-700 disabled:cursor-not-allowed disabled:text-slate-300"
                    >
                      Прочитать все
                    </button>
                  </div>

                  <div className="max-h-96 overflow-y-auto">
                    {notificationsLoading ? (
                      <div className="space-y-3 px-4 py-4">
                        {Array.from({ length: 3 }).map((_, idx) => (
                          <div key={idx} className="animate-pulse rounded-2xl bg-slate-50 p-3">
                            <div className="mb-2 h-3 w-28 rounded bg-slate-200" />
                            <div className="mb-2 h-3 w-full rounded bg-slate-200" />
                            <div className="h-3 w-24 rounded bg-slate-200" />
                          </div>
                        ))}
                      </div>
                    ) : notifications.items.length === 0 ? (
                      <div className="px-4 py-8 text-center text-sm text-slate-500">
                        Пока уведомлений нет.
                      </div>
                    ) : (
                      <div className="divide-y divide-slate-100">
                        {notifications.items.map((notification) => (
                          <button
                            key={notification.id}
                            type="button"
                            onClick={() => handleNotificationClick(notification)}
                            className="flex w-full items-start gap-3 px-4 py-3 text-left transition hover:bg-slate-50"
                          >
                            <div
                              className={`mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl ${
                                notification.type === "achievement_unlocked"
                                  ? "bg-amber-50 text-amber-600"
                                  : notification.type === "class_assessment_published"
                                    ? "bg-violet-50 text-violet-600"
                                    : "bg-blue-50 text-blue-600"
                              }`}
                            >
                              <NotificationItemIcon notification={notification} />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <p className="text-sm font-semibold text-slate-900">
                                  {notification.title}
                                </p>
                                {!notification.is_read ? (
                                  <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-blue-500" />
                                ) : null}
                              </div>
                              <p className="mt-1 text-sm text-slate-600">
                                {notification.message}
                              </p>
                              <p className="mt-2 text-xs text-slate-400">
                                {formatNotificationTime(notification.created_at)}
                              </p>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {}
            <div ref={menuRef} className="relative ml-1">
              <button
                type="button"
                onClick={() => {
                  setMenuOpen((open) => !open);
                  setNotificationsOpen(false);
                }}
                className="flex items-center gap-0 rounded-[10px]"
              >
                {}
                <div className="flex h-[36px] w-[36px] shrink-0 items-center justify-center overflow-hidden rounded-[24px] border border-[#15fcf4] bg-[#eff6ff]">
                  {}
                  <img
                    src={avatarSrc}
                    alt={userName}
                    className="h-full w-full object-cover"
                  />
                </div>
                {}
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

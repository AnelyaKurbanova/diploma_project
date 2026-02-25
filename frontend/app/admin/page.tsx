'use client';

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { apiGet } from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { AdminTabs } from "@/components/admin/admin-tabs";
import { UsersTable } from "@/components/admin/users-table";
import { SubjectsForm } from "@/components/admin/subjects-form";
import { TopicsForm } from "@/components/admin/topics-form";
import { LessonsForm } from "@/components/admin/lessons-form";
import { ProblemsForm } from "@/components/admin/problems-form";
import { ReviewQueue } from "@/components/admin/review-queue";
import { SchoolsTab } from "@/components/admin/schools-tab";
import { KnowledgeIngestForm } from "@/components/admin/knowledge-ingest-form";

type ProfileResponse = {
  full_name: string | null;
  avatar_url?: string | null;
  [key: string]: unknown;
};

const ADMIN_ROLES = new Set(["content_maker", "moderator", "admin"]);

function UsersIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function SubjectsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function SchoolsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M3.75 9.75 12 4.5l8.25 5.25M4.5 10.5v8.25A1.5 1.5 0 0 0 6 20.25h12a1.5 1.5 0 0 0 1.5-1.5V10.5"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M9 20.25v-6a1.5 1.5 0 0 1 1.5-1.5h3A1.5 1.5 0 0 1 15 14.25v6"
      />
    </svg>
  );
}

function TopicsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 12h16.5m-16.5 3.75h16.5M3.75 19.5h16.5M5.625 4.5h12.75a1.875 1.875 0 0 1 0 3.75H5.625a1.875 1.875 0 0 1 0-3.75Z" />
    </svg>
  );
}

function TasksIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.35 3.836c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m8.9-4.414c.376.023.75.05 1.124.08 1.131.094 1.976 1.057 1.976 2.192V16.5A2.25 2.25 0 0 1 18 18.75h-2.25m-7.5-10.5H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V18.75m-7.5-10.5h6.375c.621 0 1.125.504 1.125 1.125v9.375m-8.25-3 1.5 1.5 3-3.75" />
    </svg>
  );
}

function LessonsIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

function ReviewIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
    </svg>
  );
}

function KnowledgeIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" strokeWidth={1.5} stroke="currentColor">
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6.042A8.967 8.967 0 0 0 6 3.75c-1.052 0-2.062.18-3 .512v14.25A8.987 8.987 0 0 1 6 18c2.305 0 4.408.867 6 2.292m0-14.25a8.966 8.966 0 0 1 6-2.292c1.052 0 2.062.18 3 .512v14.25A8.987 8.987 0 0 0 18 18a8.967 8.967 0 0 0-6 2.292m0-14.25v14.25" />
    </svg>
  );
}

export default function AdminPage() {
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();
  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [activeTab, setActiveTab] = useState("subjects");
  const [reviewKey, setReviewKey] = useState(0);

  const userRole = user?.role ?? "student";

  useEffect(() => {
    if (isLoading) return;
    if (!user) {
      router.replace("/auth");
      return;
    }
    if (!ADMIN_ROLES.has(user.role)) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  useEffect(() => {
    if (!accessToken || !user) return;
    (async () => {
      try {
        const p = await apiGet<ProfileResponse>("/me/profile", accessToken);
        setProfile(p);
      } catch (err) {
        const status = (err as { status?: number }).status;
        if (status === 404) {
          router.replace("/onboarding");
        }
      }
    })();
  }, [accessToken, user, router]);

  const tabs = useMemo(() => {
    const items = [];
    if (userRole === "admin") {
      items.push(
        { id: "users", label: "Пользователи", icon: <UsersIcon /> },
        { id: "schools", label: "Школы", icon: <SchoolsIcon /> },
      );
    }
    if (userRole === "moderator" || userRole === "admin") {
      items.push({ id: "knowledge", label: "База знаний", icon: <KnowledgeIcon /> });
    }
    items.push(
      { id: "subjects", label: "Предметы", icon: <SubjectsIcon /> },
      { id: "topics", label: "Темы", icon: <TopicsIcon /> },
      { id: "lessons", label: "Лекции", icon: <LessonsIcon /> },
      { id: "problems", label: "Задачи", icon: <TasksIcon /> },
      { id: "review", label: "На проверке", icon: <ReviewIcon /> },
    );
    return items;
  }, [userRole]);

  if (isLoading || !user || !profile) {
    return (
      <div className="min-h-screen bg-slate-50">
        <div className="sticky top-0 z-50 border-b border-gray-100 bg-white/80 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center px-4 sm:px-6">
            <div className="h-5 w-32 animate-pulse rounded bg-gray-200" />
          </div>
        </div>
        <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
          <div className="h-8 w-48 animate-pulse rounded bg-gray-200" />
          <div className="mt-6 h-64 animate-pulse rounded-xl bg-white" />
        </main>
      </div>
    );
  }

  const userName = profile.full_name ?? user.email.split("@")[0];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900">
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={profile.avatar_url ?? null} />

      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
            Админ панель
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Управление контентом и пользователями платформы
          </p>
        </div>

        <div className="mb-6 overflow-x-auto">
          <AdminTabs tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>

        {activeTab === "users" && userRole === "admin" && (
          <UsersTable accessToken={accessToken!} />
        )}

        {activeTab === "schools" && userRole === "admin" && (
          <SchoolsTab accessToken={accessToken!} />
        )}

        {activeTab === "knowledge" && (userRole === "moderator" || userRole === "admin") && (
          <KnowledgeIngestForm accessToken={accessToken!} />
        )}

        {activeTab === "subjects" && (
          <SubjectsForm accessToken={accessToken!} />
        )}

        {activeTab === "topics" && (
          <TopicsForm accessToken={accessToken!} />
        )}

        {activeTab === "lessons" && (
          <LessonsForm accessToken={accessToken!} userRole={userRole} />
        )}

        {activeTab === "problems" && (
          <ProblemsForm
            accessToken={accessToken!}
            userRole={userRole}
            onCreated={() => setReviewKey((k) => k + 1)}
          />
        )}

        {activeTab === "review" && (
          <ReviewQueue
            key={reviewKey}
            accessToken={accessToken!}
            userRole={userRole}
          />
        )}
      </main>
    </div>
  );
}

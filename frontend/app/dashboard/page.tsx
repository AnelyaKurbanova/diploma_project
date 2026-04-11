'use client';

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useAuth } from "@/lib/auth-context";
import {
  apiGet,
  apiJoinClassByCode,
  apiListStudentClasses,
  type StudentClass,
} from "@/lib/api";
import { DashboardHeader } from "@/components/dashboard/dashboard-header";
import { TeacherDashboard } from "@/components/dashboard/teacher-dashboard";
import {
  useMyAchievements,
  useMyStreak,
  useMyXp,
  useLeaderboard,
} from "@/lib/swr-hooks";

/* ─── Font shortcuts ─── */
const R = "var(--font-rostov)";
const J = "var(--font-jost)";
const K = "var(--font-jakarta), 'Plus Jakarta Sans', sans-serif";

/* ─── Shared card style ─── */
const CARD: React.CSSProperties = {
  background: "white",
  borderRadius: 32,
  border: "1px solid #f1f5f9",
  boxShadow: "0px 10px 40px -10px rgba(15,45,81,0.08)",
};

/* ─── Types ─── */
type SubjectProgress = {
  code: string;
  name: string;
  mastery: number;
  completed_topics: number;
  total_topics: number;
};
type DashboardStats = {
  overall_progress: number;
  completed_lectures: number;
  total_lectures: number;
  solved_tasks: number;
  total_tasks: number;
  accuracy: number;
  subjects_progress: SubjectProgress[];
  task_distribution: { correct: number; incorrect: number; unsolved: number };
};
type ProfileResponse = {
  full_name: string | null;
  role?: string;
  avatar_url?: string | null;
  onboarding_completed_at: string | null;
  [key: string]: unknown;
};

/* ────────────────────────────────────────────
   SMALL COMPONENTS
──────────────────────────────────────────── */

/** Circular SVG progress ring */
function CircleProgress({ pct }: { pct: number }) {
  const r = 44;
  const circ = 2 * Math.PI * r;
  const filled = circ * Math.min(pct, 100) / 100;
  return (
    <div style={{ position: "relative", width: 112, height: 112, flexShrink: 0 }}>
      <svg width="112" height="112" viewBox="0 0 112 112">
        <circle cx="56" cy="56" r={r} fill="none" stroke="#e2e8f0" strokeWidth="12" />
        <circle
          cx="56" cy="56" r={r}
          fill="none" stroke="#06b6d4" strokeWidth="12"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${circ}`}
          transform="rotate(-90 56 56)"
        />
      </svg>
      <div style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center" }}>
        <span style={{ fontFamily: K, fontWeight: 800, fontSize: 20, lineHeight: "28px", color: "#ffffff" }}>{pct}%</span>
        <span style={{ fontFamily: K, fontWeight: 700, fontSize: 8, lineHeight: "12px", color: "rgba(219,234,254,0.7)", textTransform: "uppercase", letterSpacing: 1 }}>Модуль</span>
      </div>
    </div>
  );
}

/** Weekly activity bar chart — static Figma data */
const WEEK_BARS = [
  { day: "ПН", h: 38.39, color: "#f1f5f9" },
  { day: "ВТ", h: 76.8,  color: "#5081ba" },
  { day: "СР", h: 57.59, color: "#5081ba" },
  { day: "ЧТ", h: 88,    color: "#22d3ee" },
  { day: "ПТ", h: 43.19, color: "#5081ba" },
  { day: "СБ", h: 28.8,  color: "#f1f5f9" },
  { day: "ВС", h: 67.19, color: "#5081ba" },
];

function WeeklyActivityChart() {
  return (
    <div style={{ ...CARD, padding: 25, display: "flex", flexDirection: "column", gap: 24 }}>
      <p style={{ fontFamily: J, fontWeight: 500, fontSize: 18, lineHeight: "24px", letterSpacing: "-0.3125px", color: "#0f2d51", margin: 0 }}>
        Активность за неделю
      </p>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {/* Bars */}
        <div style={{ height: 88, display: "flex", alignItems: "flex-end", gap: 8 }}>
          {WEEK_BARS.map((b) => (
            <div
              key={b.day}
              style={{
                flex: 1,
                height: b.h,
                background: b.color,
                borderRadius: "8px 8px 0 0",
              }}
            />
          ))}
        </div>
        {/* Day labels */}
        <div style={{ display: "flex", gap: 8 }}>
          {WEEK_BARS.map((b) => (
            <div
              key={b.day}
              style={{
                flex: 1,
                textAlign: "center",
                fontFamily: K,
                fontWeight: 700,
                fontSize: 10,
                lineHeight: "15px",
                color: "#94a3b8",
              }}
            >
              {b.day}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** Stat card (Задач решено / Точность / Стрик) */
function StatCard({
  label, value, delta, iconBg, icon,
}: {
  label: string;
  value: string;
  delta?: string;
  iconBg: string;
  icon: React.ReactNode;
}) {
  return (
    <div style={{ ...CARD, position: "relative", flex: 1, minHeight: 157 }}>
      <div style={{
        position: "absolute", top: 24, left: 24,
        width: 40, height: 40, borderRadius: 12,
        background: iconBg,
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {icon}
      </div>
      <div style={{ position: "absolute", top: 80, left: 24, right: 24 }}>
        <p style={{ fontFamily: K, fontWeight: 700, fontSize: 10, lineHeight: "15px", color: "#94a3b8", textTransform: "uppercase", letterSpacing: 1, margin: 0 }}>
          {label}
        </p>
      </div>
      <div style={{ position: "absolute", top: 99, left: 24, right: 24, display: "flex", alignItems: "baseline", gap: 6 }}>
        <p style={{ fontFamily: K, fontWeight: 800, fontSize: 24, lineHeight: "32px", color: "#0f2d51", margin: 0 }}>
          {value}
        </p>
        {delta && (
          <span style={{ fontFamily: K, fontWeight: 700, fontSize: 12, lineHeight: "16px", color: "#22c55e" }}>
            {delta}
          </span>
        )}
      </div>
    </div>
  );
}

/** Inner panel for AI Insight (matches former recommendation task cards) */
const insightInnerCard: React.CSSProperties = {
  flex: 1,
  background: "#f8fafc",
  border: "1px solid #f1f5f9",
  borderRadius: 24,
  minHeight: 201,
  padding: 24,
  display: "flex",
  flexDirection: "column",
  gap: 12,
};

/** Leaderboard row */
function LeaderboardRow({
  rank, name, role, xpLabel, delta, isSelf, avatarUrl,
}: {
  rank: number;
  name: string;
  role: string;
  xpLabel: string;
  delta: string;
  isSelf: boolean;
  avatarUrl?: string | null;
}) {
  const rowBg = isSelf ? "#fef3c7" : "#5081ba";
  const nameColor = isSelf ? "#5081ba" : "white";
  const roleColor = isSelf ? "#94a3b8" : "#bfdbfe";
  const xpColor = "white";
  const deltaColor = "#22d3ee";

  return (
    <div style={{
      display: "flex", alignItems: "center",
      background: rowBg, borderRadius: 16, padding: 16, gap: 12,
      boxShadow: "0px 20px 25px -5px rgba(30,58,138,0.1), 0px 8px 10px -6px rgba(30,58,138,0.1)",
    }}>
      <span style={{ fontFamily: K, fontWeight: 800, fontSize: 18, lineHeight: "28px", color: "#22d3ee", width: 24, textAlign: "center", flexShrink: 0 }}>
        {rank}
      </span>
      <div style={{
        width: 40, height: 40, borderRadius: 12,
        border: "2px solid #22d3ee",
        overflow: "hidden", flexShrink: 0, background: "#eff6ff",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        {avatarUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={avatarUrl} alt={name} style={{ width: "100%", height: "100%", objectFit: "cover" }} />
        ) : (
          <span style={{ fontFamily: K, fontWeight: 700, fontSize: 14, color: "#5081ba" }}>
            {name.charAt(0)}
          </span>
        )}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontFamily: K, fontWeight: 700, fontSize: 14, lineHeight: "20px", color: nameColor, margin: 0, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
          {name}
        </p>
        <p style={{ fontFamily: K, fontWeight: 700, fontSize: 10, lineHeight: "15px", color: roleColor, textTransform: "uppercase", margin: 0 }}>
          {role}
        </p>
      </div>
      <div style={{ textAlign: "right", flexShrink: 0 }}>
        <p style={{ fontFamily: K, fontWeight: 800, fontSize: 14, lineHeight: "20px", color: xpColor, margin: 0 }}>{xpLabel}</p>
        <p style={{ fontFamily: K, fontWeight: 700, fontSize: 10, lineHeight: "15px", color: deltaColor, margin: 0 }}>{delta}</p>
      </div>
    </div>
  );
}

/* ────────────────────────────────────────────
   MAIN PAGE
──────────────────────────────────────────── */
export default function DashboardPage() {
  const { user, isLoading, accessToken } = useAuth();
  const router = useRouter();

  const [profile, setProfile] = useState<ProfileResponse | null>(null);
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [studentClasses, setStudentClasses] = useState<StudentClass[]>([]);
  const [joinCode, setJoinCode] = useState("");
  const [joining, setJoining] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);

  const { xp } = useMyXp();
  const { streak } = useMyStreak();
  const { achievements } = useMyAchievements();
  const { leaderboard } = useLeaderboard("xp", 3);

  /* auth redirect */
  useEffect(() => {
    if (isLoading) return;
    if (!user) router.replace("/auth");
  }, [isLoading, user, router]);

  /* profile */
  useEffect(() => {
    if (!accessToken || !user) return;
    (async () => {
      try {
        const p = await apiGet<ProfileResponse>("/me/profile", accessToken);
        setProfile(p);
      } catch (err) {
        if ((err as { status?: number }).status === 404) {
          router.replace("/onboarding");
          return;
        }
        setLoadError(true);
      }
    })();
  }, [accessToken, user, router]);

  /* stats */
  useEffect(() => {
    if (!accessToken || !profile) return;
    (async () => {
      try {
        const d = await apiGet<DashboardStats>("/me/dashboard", accessToken);
        setStats(d);
      } catch {
        setLoadError(true);
      }
    })();
  }, [accessToken, profile]);

  /* classes */
  useEffect(() => {
    const role = profile?.role ?? user?.role ?? "student";
    if (!accessToken || !profile || role !== "student") return;
    (async () => {
      try {
        const list = await apiListStudentClasses(accessToken);
        setStudentClasses(list);
      } catch {
        setStudentClasses([]);
      }
    })();
  }, [accessToken, profile, user]);

  const userName = profile?.full_name ?? user?.email?.split("@")[0] ?? "";
  const firstName = userName.split(" ")[0] || userName;
  const userRole = profile?.role ?? user?.role ?? "student";
  const isTeacher = userRole === "teacher";

  /* Loading skeleton */
  if (isLoading || !user || !profile || (!isTeacher && !stats && !loadError)) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <div style={{ background: "white", boxShadow: "0px 10px 15px rgba(0,0,0,0.1)", height: 69, position: "sticky", top: 0, zIndex: 50 }}>
          <div style={{ height: "100%", display: "flex", alignItems: "center", padding: "0 32px" }}>
            <div style={{ height: 20, width: 120, borderRadius: 8, background: "#e2e8f0" }} className="animate-pulse" />
          </div>
        </div>
        <div style={{ maxWidth: 1083, margin: "36px auto 0", padding: "0 30px", display: "flex", flexDirection: "column", gap: 24 }}>
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} style={{ height: 80, borderRadius: 32, background: "white" }} className="animate-pulse" />
          ))}
        </div>
      </div>
    );
  }

  /* Teacher route */
  if (isTeacher && accessToken) {
    return (
      <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
        <DashboardHeader userName={userName} userRole={userRole} avatarUrl={profile?.avatar_url ?? null} />
        <TeacherDashboard userName={userName} accessToken={accessToken} />
      </div>
    );
  }

  /* ── Derived data ── */
  const progressPct = stats?.overall_progress ?? 0;
  const solvedTasks = stats?.solved_tasks ?? 0;
  const accuracy = stats?.accuracy ?? 0;
  const currentStreak = streak?.current_streak ?? 0;
  const totalXp = xp?.total_xp ?? 0;
  const xpForNextLevel = 500;
  const xpPct = Math.min(Math.round((totalXp % xpForNextLevel) / xpForNextLevel * 100), 100);
  const xpLevel = Math.floor(totalXp / xpForNextLevel) + 1;

  /* current subject for resume card */
  const sortedSubjects = [...(stats?.subjects_progress ?? [])].sort((a, b) => a.mastery - b.mastery);
  const resumeSubject = sortedSubjects[0];

  /* achievements grid (first 2 unlocked + 2 locked placeholders) */
  const unlockedAch = achievements.items.filter((a) => a.unlocked_at).slice(0, 2);
  const lockedAch = achievements.items.filter((a) => !a.unlocked_at).slice(0, 2);
  while (unlockedAch.length < 2) unlockedAch.push(null as unknown as typeof unlockedAch[0]);
  while (lockedAch.length < 2) lockedAch.push(null as unknown as typeof lockedAch[0]);

  /* leaderboard rows */
  const lbItems = leaderboard.items.slice(0, 3);
  const myEntry = leaderboard.my_entry;

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!accessToken) return;
    const trimmed = joinCode.trim();
    if (!trimmed) return;
    setJoining(true);
    setJoinError(null);
    try {
      const joined = await apiJoinClassByCode(trimmed, accessToken);
      setJoinCode("");
      setStudentClasses((prev) => {
        const exists = prev.find((c) => c.id === joined.id);
        return exists ? prev.map((c) => (c.id === joined.id ? joined : c)) : [joined, ...prev];
      });
    } catch (err) {
      setJoinError(err instanceof Error ? err.message : "Не удалось присоединиться к классу");
    } finally {
      setJoining(false);
    }
  };

  return (
    <div style={{ minHeight: "100vh", background: "#f8fafc" }}>
      <DashboardHeader userName={userName} userRole={userRole} avatarUrl={profile?.avatar_url ?? null} />

      <main style={{ paddingTop: 36, paddingBottom: 60 }}>
        <div style={{ maxWidth: 1083, margin: "0 auto", padding: "0 30px", display: "flex", flexDirection: "column", gap: 40 }}>

          {/* ══ WELCOME HEADER ══ */}
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            {/* Left: greeting + subtitle */}
            <div style={{ display: "flex", flexDirection: "column", gap: 7.5 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                <span style={{ fontSize: 24 }}>👋</span>
                <h1 style={{ fontFamily: R, fontSize: 36, lineHeight: "40px", letterSpacing: "-0.5309px", color: "#0f2d51", margin: 0 }}>
                  С возвращением, {firstName}!
                </h1>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.813 15.904 9 18.75l-.813-2.846a4.5 4.5 0 0 0-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 0 0 3.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 0 0 3.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 0 0-3.09 3.09Z" />
                </svg>
                <p style={{ fontFamily: J, fontSize: 16, lineHeight: "24px", letterSpacing: "-0.3125px", color: "#64748b", margin: 0 }}>
                  AI тьютор готов помочь с твоей подготовкой к ЕНТ
                </p>
              </div>
            </div>

            {/* Right: XP level badge */}
            <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, opacity: 0.85 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: K, fontWeight: 800, fontSize: 11, lineHeight: "16.5px", letterSpacing: 2, textTransform: "uppercase", color: "#5081ba" }}>
                  Уровень {xpLevel}
                </span>
                <span style={{ fontFamily: K, fontWeight: 700, fontSize: 11, lineHeight: "16.5px", color: "#94a3b8" }}>
                  {totalXp} XP
                </span>
              </div>
              <div style={{ width: 192, height: 9, borderRadius: 9999, background: "#e2e8f0", overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${xpPct}%`, background: "#06b6d4", borderRadius: 9999 }} />
              </div>
            </div>
          </div>

          {/* ══ ROW 1: Resume + Stats | JoinClass + Activity ══ */}
          <div style={{ display: "flex", gap: 32 }}>
            {/* Left column: 694px */}
            <div style={{ width: 694, flexShrink: 0, display: "flex", flexDirection: "column", gap: 32 }}>

              {/* Resume Learning Card */}
              <div style={{ ...CARD, padding: 5 }}>
                <div style={{
                  borderRadius: 28,
                  background: "linear-gradient(160.74deg, #0f2d51 0%, #1a4579 100%)",
                  padding: 32,
                  display: "flex",
                  alignItems: "center",
                  gap: 32,
                }}>
                  {/* Text content */}
                  <div style={{ flex: 1 }}>
                    {/* Badge */}
                    <div style={{ display: "inline-flex", background: "rgba(255,255,255,0.1)", borderRadius: 8, padding: "4px 12px", marginBottom: 16 }}>
                      <span style={{ fontFamily: K, fontWeight: 700, fontSize: 10, lineHeight: "15px", letterSpacing: 1, textTransform: "uppercase", color: "#dbeafe" }}>
                        Продолжить обучение
                      </span>
                    </div>
                    {/* Course title */}
                    <h2 style={{ fontFamily: J, fontWeight: 500, fontSize: 24, lineHeight: "24px", letterSpacing: "-0.3125px", color: "white", margin: "0 0 12px" }}>
                      {resumeSubject?.name ?? "Математика — Алгебра"}
                    </h2>
                    {/* Description */}
                    <p style={{ fontFamily: J, fontSize: 16, lineHeight: "24px", letterSpacing: "-0.3125px", color: "rgba(219,234,254,0.7)", margin: "0 0 28px" }}>
                      {resumeSubject
                        ? `${resumeSubject.completed_topics} из ${resumeSubject.total_topics} тем завершено`
                        : "Продолжи с того места, где остановился"}
                    </p>
                    {/* CTA */}
                    <Link
                      href="/subjects"
                      style={{
                        display: "inline-flex", alignItems: "center", gap: 12,
                        background: "white", borderRadius: 16, padding: "16px 32px",
                        fontFamily: K, fontWeight: 700, fontSize: 14, lineHeight: "20px", color: "#0f2d51",
                        textDecoration: "none",
                      }}
                    >
                      <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                        <path d="M3 8h10M9 4l4 4-4 4" stroke="#0f2d51" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                      Перейти к урокам
                    </Link>
                  </div>
                  {/* Circle progress */}
                  <CircleProgress pct={progressPct} />
                </div>
              </div>

              {/* Stats grid: 3 cards */}
              <div style={{ display: "flex", gap: 24, height: 157 }}>
                <StatCard
                  label="Задач решено"
                  value={String(solvedTasks)}
                  delta="+5"
                  iconBg="#eff6ff"
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />
                    </svg>
                  }
                />
                <StatCard
                  label="Точность"
                  value={`${accuracy}%`}
                  iconBg="#f1f5f9"
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f2d51" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-4.5a4.5 4.5 0 1 0 0-9 4.5 4.5 0 0 0 0 9Zm0-3a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3Z" />
                    </svg>
                  }
                />
                <StatCard
                  label="Стрик (дней)"
                  value={String(currentStreak)}
                  iconBg="#f1f5f9"
                  icon={
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#0f2d51" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M15.362 5.214A8.252 8.252 0 0 1 12 21 8.25 8.25 0 0 1 6.038 7.047 8.287 8.287 0 0 0 9 9.601a8.983 8.983 0 0 1 3.361-6.867 8.21 8.21 0 0 0 3 2.48Z" />
                    </svg>
                  }
                />
              </div>
            </div>

            {/* Right column: Join Class + Activity */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 32 }}>

              {/* Join Class widget */}
              <div style={{
                ...CARD,
                padding: "25px 25px 25px 28px",
                borderLeft: "4px solid #f1f5f9",
                display: "flex",
                flexDirection: "column",
                gap: 16,
              }}>
                <div>
                  <p style={{ fontFamily: J, fontWeight: 500, fontSize: 18, lineHeight: "24px", letterSpacing: "-0.3125px", color: "#0f2d51", margin: "0 0 4px" }}>
                    Присоединиться к классу
                  </p>
                  <p style={{ fontFamily: J, fontSize: 12, lineHeight: "24px", letterSpacing: "-0.3125px", color: "#94a3b8", margin: 0 }}>
                    Введи код, который выдал учитель
                  </p>
                </div>
                <form onSubmit={handleJoin} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <input
                    type="text"
                    value={joinCode}
                    onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
                    placeholder="Код класса (например AB3D9F)"
                    style={{
                      width: "100%", height: 39, borderRadius: 8,
                      border: "1px solid #d1d1d1", padding: "0 16px",
                      fontFamily: J, fontSize: 14, lineHeight: "24px", letterSpacing: "-0.3125px",
                      color: "#0a0a0a", background: "white",
                      outline: "none", boxSizing: "border-box",
                    }}
                  />
                  {joinError && (
                    <p style={{ fontFamily: J, fontSize: 12, color: "#ef4444", margin: 0 }}>{joinError}</p>
                  )}
                  <button
                    type="submit"
                    disabled={joining || !joinCode.trim()}
                    style={{
                      width: "100%", height: 39, borderRadius: 8,
                      background: "#8aaefd", border: "none", cursor: "pointer",
                      fontFamily: J, fontWeight: 500, fontSize: 20, lineHeight: "24px", letterSpacing: "-0.3125px",
                      color: "white",
                      opacity: joining || !joinCode.trim() ? 0.6 : 1,
                    }}
                  >
                    {joining ? "Присоединяем..." : "Вступить"}
                  </button>
                </form>
                {studentClasses.length > 0 && (
                  <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                    {studentClasses.slice(0, 2).map((c) => (
                      <div key={c.id} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 0", borderTop: "1px solid #f1f5f9" }}>
                        <span style={{ fontFamily: J, fontSize: 13, color: "#0f2d51", fontWeight: 500 }}>{c.name}</span>
                        <span style={{ fontFamily: J, fontSize: 11, color: "#94a3b8" }}>{c.teacher_name ?? "—"}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Weekly Activity */}
              <WeeklyActivityChart />
            </div>
          </div>

          {/* ══ ROW 2: AI Insight + Leaderboard | Achievements ══ */}
          <div style={{ display: "flex", gap: 32 }}>
            {/* Left: 701px */}
            <div style={{ width: 701, flexShrink: 0, display: "flex", flexDirection: "column", gap: 32 }}>

              {/* AI Insight (same shell as former AI Recommendations) */}
              <div style={{
                borderRadius: 32, border: "1px solid #f1f5f9",
                padding: 33, position: "relative", overflow: "hidden",
                boxShadow: "0px 10px 40px -10px rgba(15,45,81,0.08)",
                background: "#184070",
              }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <h2 style={{ fontFamily: R, fontSize: 36, lineHeight: "40px", letterSpacing: "-0.5309px", color: "white", margin: 0 }}>
                    AI Инсайт
                  </h2>
                  <Link href="/problems" style={{ fontFamily: K, fontWeight: 700, fontSize: 12, lineHeight: "16px", color: "#7eb3e8", textDecoration: "none" }}>
                    Смотреть все
                  </Link>
                </div>
                <div style={{ display: "flex", gap: 12, alignItems: "stretch" }}>
                  <div style={insightInnerCard}>
                    <span style={{
                      alignSelf: "flex-start",
                      background: "#e0f2fe",
                      color: "#0369a1",
                      fontFamily: K,
                      fontWeight: 700,
                      fontSize: 10,
                      lineHeight: "15px",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      padding: "4px 12px",
                      borderRadius: 9999,
                    }}>
                      Фокус
                    </span>
                    <p style={{ fontFamily: J, fontSize: 14, lineHeight: "22px", color: "#64748b", margin: 0, flex: 1 }}>
                      Твои слабые места —{" "}
                      <span style={{ color: "#0f2d51", fontWeight: 600 }}>
                        {sortedSubjects[0]?.name ?? "Тригонометрия"}
                      </span>
                      {" "}и{" "}
                      <span style={{ color: "#0f2d51", fontWeight: 600 }}>
                        {sortedSubjects[1]?.name ?? "Логарифмы"}
                      </span>
                      . Уделяй им по 20 минут в день.
                    </p>
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "auto" }}>
                      <span style={{ fontFamily: K, fontWeight: 700, fontSize: 10, lineHeight: "15px", color: "#94a3b8" }}>
                        По прогрессу
                      </span>
                      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ opacity: 0.4 }}>
                        <circle cx="10" cy="10" r="10" fill="#0f2d51" />
                        <path d="M8 6l4 4-4 4" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                      </svg>
                    </div>
                  </div>
                  <div style={insightInnerCard}>
                    <span style={{
                      alignSelf: "flex-start",
                      background: "#fef3c7",
                      color: "#b45309",
                      fontFamily: K,
                      fontWeight: 700,
                      fontSize: 10,
                      lineHeight: "15px",
                      letterSpacing: "0.5px",
                      textTransform: "uppercase",
                      padding: "4px 12px",
                      borderRadius: 9999,
                    }}>
                      Предложение
                    </span>
                    <p style={{ fontFamily: J, fontSize: 14, lineHeight: "22px", color: "#64748b", margin: 0, flex: 1 }}>
                      Пройди блиц-тест по теме «
                      <span style={{ color: "#0f2d51", fontWeight: 600 }}>
                        {sortedSubjects[0]?.name ?? "Тригонометрические уравнения"}
                      </span>
                      » прямо сейчас.
                    </p>
                    <Link
                      href="/problems"
                      style={{
                        display: "block", width: "100%", padding: "10px 0",
                        borderRadius: 12, background: "#0f2d51", textAlign: "center",
                        fontFamily: K, fontWeight: 700, fontSize: 12, lineHeight: "18px",
                        color: "white", textDecoration: "none", marginTop: "auto",
                      }}
                    >
                      НАЧАТЬ БЛИЦ
                    </Link>
                  </div>
                </div>
              </div>

              {/* Leaderboard */}
              <div style={{ ...CARD, padding: 33 }}>
                {/* Header */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                    <p style={{ fontFamily: K, fontWeight: 700, fontSize: 20, lineHeight: "28px", color: "#0f2d51", margin: 0 }}>
                      Доска почета
                    </p>
                    <span style={{ background: "#dbeafe", borderRadius: 8, padding: "4px 12px", fontFamily: K, fontWeight: 800, fontSize: 10, lineHeight: "15px", color: "#5081ba" }}>
                      По XP
                    </span>
                  </div>
                  <span style={{ fontFamily: K, fontWeight: 700, fontSize: 12, lineHeight: "16px", color: "#94a3b8" }}>
                    {leaderboard.items.length} участников
                  </span>
                </div>
                {/* Rows */}
                <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
                  {lbItems.length > 0 ? lbItems.map((item, i) => {
                    const isSelf = myEntry?.user_id === item.user_id;
                    return (
                      <LeaderboardRow
                        key={item.user_id}
                        rank={i + 1}
                        name={item.display_name ?? "Участник"}
                        role={isSelf ? "Rising Star" : "Challenger"}
                        xpLabel={`${(item.score ?? 0).toLocaleString()} XP`}
                        delta={`+${Math.round((item.score ?? 0) * 0.2)} THIS WEEK`}
                        isSelf={isSelf}
                        avatarUrl={item.avatar_url}
                      />
                    );
                  }) : (
                    /* Fallback demo rows */
                    [
                      { rank: 1, name: firstName + " (Ты)", role: "Rising Star", xpLabel: `${totalXp.toLocaleString()} XP`, delta: "+450 THIS WEEK", isSelf: true },
                      { rank: 2, name: "Айгерим К.", role: "Scholar",    xpLabel: "2,180 XP", delta: "+320 THIS WEEK", isSelf: false },
                      { rank: 3, name: "Дамир М.",   role: "Challenger", xpLabel: "1,990 XP", delta: "+280 THIS WEEK", isSelf: false },
                    ].map((row) => <LeaderboardRow key={row.rank} {...row} />)
                  )}
                </div>
              </div>
            </div>

            {/* Right: Achievements */}
            <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 32 }}>

              {/* Achievements */}
              <div style={{ ...CARD, padding: 33 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 20 }}>
                  <p style={{ fontFamily: J, fontWeight: 500, fontSize: 18, lineHeight: "24px", letterSpacing: "-0.3125px", color: "#0f2d51", margin: 0 }}>
                    Достижения
                  </p>
                  <span style={{ fontFamily: K, fontWeight: 700, fontSize: 12, color: "#94a3b8" }}>
                    {achievements.unlocked_count} / {achievements.total}
                  </span>
                </div>
                {/* 2×2 grid */}
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
                  {[...unlockedAch, ...lockedAch].map((ach, i) => {
                    const isLocked = i >= 2 || !ach;
                    return (
                      <div
                        key={i}
                        style={{
                          borderRadius: 16, padding: 17,
                          background: isLocked ? "rgba(241,245,249,0.5)" : "#f8fafc",
                          border: isLocked ? "1px dashed #e2e8f0" : "1px solid #f1f5f9",
                          opacity: isLocked ? 0.5 : 1,
                          display: "flex", flexDirection: "column", alignItems: "center", gap: 8,
                          minHeight: 90,
                        }}
                      >
                        <div style={{
                          width: 40, height: 40,
                          display: "flex", alignItems: "center", justifyContent: "center",
                          boxShadow: isLocked ? "none" : "0px 8px 15px 0px rgba(251,191,36,0.2)",
                        }}>
                          {isLocked ? (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M16.5 10.5V6.75a4.5 4.5 0 1 0-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 0 0 2.25-2.25v-6.75a2.25 2.25 0 0 0-2.25-2.25H6.75a2.25 2.25 0 0 0-2.25 2.25v6.75a2.25 2.25 0 0 0 2.25 2.25Z" />
                            </svg>
                          ) : (
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#fbbf24" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z" />
                            </svg>
                          )}
                        </div>
                        <p style={{
                          fontFamily: K, fontWeight: 800, fontSize: 10, lineHeight: "12.5px",
                          color: isLocked ? "#94a3b8" : "#0f2d51",
                          textTransform: "uppercase", textAlign: "center", margin: 0,
                        }}>
                          {ach?.title ?? (isLocked ? "Заблокировано" : "Достижение")}
                        </p>
                      </div>
                    );
                  })}
                </div>
                <button
                  onClick={() => router.push("/profile")}
                  style={{
                    width: "100%", padding: "18px 2px", borderRadius: 16,
                    border: "2px solid #f1f5f9", background: "transparent", cursor: "pointer",
                    fontFamily: K, fontWeight: 700, fontSize: 11, lineHeight: "16.5px",
                    letterSpacing: "1.1px", textTransform: "uppercase", color: "#94a3b8",
                  }}
                >
                  Все достижения
                </button>
              </div>
            </div>
          </div>

        </div>
      </main>
    </div>
  );
}

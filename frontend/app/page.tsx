'use client';

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { EntHeader } from "@/components/ent-header";

/* ─── Figma asset URLs ─── */
const HERO_BG     = "https://www.figma.com/api/mcp/asset/939666b1-378c-4925-9aa6-54ac74537d8c";
const AVATAR_1    = "https://www.figma.com/api/mcp/asset/d9cb896a-ac89-4ebb-99f7-afae8822f661";
const AVATAR_2    = "https://www.figma.com/api/mcp/asset/8e04bad5-25fb-4875-8be6-4361a3fc07c7";
const AVATAR_3    = "https://www.figma.com/api/mcp/asset/b939f1e6-0700-4069-b9b8-e9ee1a1b10b7";
const CHART_ICON  = "https://www.figma.com/api/mcp/asset/519fc803-c2d4-45e4-a185-81689a9a29dc";
const CHART_LINE  = "https://www.figma.com/api/mcp/asset/968dbc3a-22ae-42f1-b82f-468a9e1efa57";
const CTA_BG      = "https://www.figma.com/api/mcp/asset/6ce222b6-97bf-4cae-8dcf-26b72e90c832";

const JAKARTA = "var(--font-jakarta), 'Plus Jakarta Sans', 'Noto Sans', sans-serif";
const ROSTOV  = "var(--font-rostov)";
const JOST    = "var(--font-jost)";

/* ─── Activity heatmap ─── */
const HEAT_COLORS = ["#EFF6FF", "#BFDBFE", "#93C5FD", "#3B82F6", "#1D4ED8"];
const MONTH_LABELS = ["Янв","Фев","Мар","Апр","Май","Июн","Июл","Авг","Сен","Окт","Ноя","Дек"];
const DAY_LABELS   = ["Пн","","Ср","","Пт","","Вск"];

function heatLevel(w: number, d: number): number {
  const v = ((w * 13 + d * 7 + w * d + 3) % 20);
  if (v < 5) return 0;
  if (v < 9) return 1;
  if (v < 13) return 2;
  if (v < 17) return 3;
  return 4;
}

function ActivityHeatmap() {
  return (
    <div className="overflow-x-auto">
      <div className="flex pl-8 mb-1">
        {MONTH_LABELS.map((m) => (
          <div key={m} style={{ width: "50.72px", flexShrink: 0, fontSize: "10px", color: "#94A3B8", fontFamily: JOST }}>
            {m}
          </div>
        ))}
      </div>
      <div className="flex" style={{ gap: "8px" }}>
        <div className="flex flex-col" style={{ gap: "4px", paddingTop: "2px" }}>
          {DAY_LABELS.map((label, i) => (
            <div key={i} style={{ height: "12px", display: "flex", alignItems: "center", fontSize: "10px", color: "#94A3B8", width: "24px", fontFamily: JOST }}>
              {label}
            </div>
          ))}
        </div>
        <div className="flex" style={{ gap: "4px" }}>
          {Array.from({ length: 52 }, (_, w) => (
            <div key={w} className="flex flex-col" style={{ gap: "4px" }}>
              {Array.from({ length: 7 }, (_, d) => (
                <div
                  key={d}
                  style={{ width: "12px", height: "12px", borderRadius: "2px", backgroundColor: HEAT_COLORS[heatLevel(w, d)], flexShrink: 0 }}
                />
              ))}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Feature cards ─── */
function ArrowSmIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
      <path d="M2 6h8M7 3l3 3-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function CheckCircleIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none" className="shrink-0">
      <circle cx="10" cy="10" r="10" fill="#0F2D51" />
      <path d="M5.5 10l3.5 3.5 5.5-7" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURES = [
  {
    title: "Smart-задачи",
    description: "Автоматическая проверка решений в реальном времени",
    link: "Исследовать",
    href: "/problems",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M9 5H7a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2h-2M9 5a2 2 0 0 0 2 2h2a2 2 0 0 0 2-2M9 5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2m-6 9 2 2 4-4" />
      </svg>
    ),
  },
  {
    title: "AI Видео уроки",
    description: "Генерация объяснений по любой теме за секунды. Твой персональный тьютор 24/7",
    link: "Watch Demo",
    href: "/subjects",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
      </svg>
    ),
  },
  {
    title: "Глубокая аналитика",
    description: "Визуализация прогресса и поиск пробелов с точностью до подтемы",
    link: "View Dashboard",
    href: "/dashboard",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M2.25 18 9 11.25l4.306 4.306a11.95 11.95 0 0 1 5.814-5.518l2.74-1.22m0 0-5.94-2.281m5.94 2.28-2.28 5.941" />
      </svg>
    ),
  },
  {
    title: "UNT Battle",
    description: "Соревнуйся с друзьями, зарабатывай XP и открывай уникальные достижения.",
    link: "Присоединиться",
    href: "/auth/register",
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M16.5 18.75h-9m9 0v1.125A2.625 2.625 0 0 1 13.875 22.5h-3.75A2.625 2.625 0 0 1 7.5 19.875V18.75m9 0A2.25 2.25 0 0 0 18.75 16.5V6.75A2.25 2.25 0 0 0 16.5 4.5h-9A2.25 2.25 0 0 0 5.25 6.75V16.5a2.25 2.25 0 0 0 2.25 2.25m0-10.5h9m-9 3h9" />
      </svg>
    ),
  },
];

/* ─── Main page ─── */
export default function Home() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      router.replace("/dashboard");
    }
  }, [isLoading, user, router]);

  return (
    <div className="min-h-screen bg-white text-slate-900 overflow-x-hidden">
      <EntHeader />

      {/* ══════════════════════════════════════
          HERO SECTION
      ══════════════════════════════════════ */}
      <section className="relative overflow-hidden" style={{ height: "555px" }}>
        {/* Background pattern + overlay */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img alt="" src={HERO_BG} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.1 }} />
          <div className="absolute inset-0" style={{ background: "rgba(80,129,186,0.2)" }} />
        </div>

        {/* Content row */}
        <div
          className="relative mx-auto flex items-center justify-center px-6 h-full"
          style={{ maxWidth: "1280px", gap: "56.658px" }}
        >
          {/* ── Left column ── */}
          <div className="relative shrink-0" style={{ width: "584px", height: "429.5px" }}>

            {/* Badge pill — top: 0 */}
            <div
              className="absolute top-0 left-0 inline-flex items-center gap-2 border border-white rounded-full shadow-sm"
              style={{ padding: "9px 17px", background: "rgba(255,255,255,0.5)" }}
            >
              <span className="shrink-0 rounded-full" style={{ width: 8, height: 8, background: "#22D3EE" }} />
              <span
                style={{
                  fontFamily: JAKARTA,
                  fontWeight: 700,
                  fontSize: 12,
                  lineHeight: "16px",
                  letterSpacing: "0.6px",
                  color: "#64748B",
                  textTransform: "uppercase",
                  whiteSpace: "nowrap",
                }}
              >
                Новый уровень подготовки к ЕНТ
              </span>
            </div>

            {/* H1 — top: 58px */}
            <div className="absolute left-0 right-0" style={{ top: 58 }}>
              <h1
                style={{
                  fontFamily: ROSTOV,
                  fontSize: 64,
                  lineHeight: "72px",
                  letterSpacing: "-0.5309px",
                  color: "#0F2D51",
                  margin: 0,
                }}
              >
                Train{" "}
                <span style={{ color: "#5081BA" }}>Smarter.</span>
                <br />
                Score Higher.
              </h1>
            </div>

            {/* Subtitle — top: 225px */}
            <div className="absolute left-0" style={{ top: 225, right: 72, maxWidth: 512 }}>
              <p
                style={{
                  fontFamily: JOST,
                  fontWeight: 600,
                  fontSize: 20,
                  lineHeight: "24px",
                  letterSpacing: "-0.3125px",
                  color: "#223B5F",
                  margin: 0,
                }}
              >
                Первая в Казахстане AI-платформа для подготовки к ЕНТ, которая адаптируется под твой темп и мгновенно объясняет ошибки.
              </p>
            </div>

            {/* CTA row — top: 363.5px */}
            <div
              className="absolute left-0 right-0 flex items-center"
              style={{ top: 363.5, gap: 16 }}
            >
              {/* Primary CTA */}
              <Link
                href="/auth/register"
                className="flex items-center justify-center text-white text-center transition-opacity hover:opacity-90"
                style={{
                  fontFamily: JOST,
                  fontWeight: 400,
                  fontSize: 20,
                  lineHeight: "24px",
                  letterSpacing: "-0.3125px",
                  background: "#0F2D51",
                  borderRadius: 24,
                  padding: "16px 24px",
                  width: 287,
                  boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
                  flexShrink: 0,
                }}
              >
                Попробовать прямо сейчас
              </Link>

              {/* Social proof pill */}
              <div
                className="flex items-center shrink-0"
                style={{
                  background: "white",
                  border: "1px solid #F1F5F9",
                  borderRadius: 24,
                  padding: "17px 25px",
                  boxShadow: "0px 1px 2px 0px rgba(0,0,0,0.05)",
                  gap: 12,
                }}
              >
                <div className="flex items-center" style={{ paddingRight: 8 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={AVATAR_1} alt="" className="rounded-full object-cover" style={{ width: 32, height: 32, border: "2px solid white", marginRight: -8, position: "relative", zIndex: 3 }} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={AVATAR_2} alt="" className="rounded-full object-cover" style={{ width: 32, height: 32, border: "2px solid white", marginRight: -8, position: "relative", zIndex: 2 }} />
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={AVATAR_3} alt="" className="rounded-full object-cover" style={{ width: 32, height: 32, border: "2px solid white", position: "relative", zIndex: 1 }} />
                </div>
                <p style={{ fontFamily: JAKARTA, fontSize: 12, margin: 0 }}>
                  <span style={{ fontWeight: 700, color: "#0F2D51" }}>+1000</span>
                  <span style={{ fontWeight: 400, color: "#64748B" }}> учеников уже с нами</span>
                </p>
              </div>
            </div>
          </div>

          {/* ── Right column: analytics card ── */}
          <div className="relative shrink-0" style={{ width: 432 }}>
            {/* Cyan blur orb */}
            <div
              className="absolute rounded-full"
              style={{
                width: 96, height: 96,
                background: "#22D3EE",
                filter: "blur(20px)",
                opacity: 0.2,
                mixBlendMode: "multiply",
                top: -29.94, left: -32.66,
                pointerEvents: "none",
              }}
            />
            {/* Amber blur orb */}
            <div
              className="absolute rounded-full"
              style={{
                width: 128, height: 128,
                background: "#FBBF24",
                filter: "blur(20px)",
                opacity: 0.1,
                mixBlendMode: "multiply",
                bottom: -29.94, right: -40.34,
                pointerEvents: "none",
              }}
            />

            {/* Card wrapper (598×451, centered, card is 584×431) */}
            <div className="flex items-center justify-center" style={{ width: 598.686, height: 451.119 }}>
              <div style={{ transform: "rotate(2deg)" }}>
                <div
                  className="bg-white"
                  style={{
                    width: 584,
                    height: 431,
                    borderRadius: 32,
                    border: "1px solid #F1F5F9",
                    boxShadow: "0px 25px 50px -12px rgba(0,0,0,0.25)",
                    position: "relative",
                    overflow: "visible",
                  }}
                >
                  {/* Card header */}
                  <div className="absolute flex items-center" style={{ top: 24, left: 24, right: 24, gap: 16 }}>
                    <div className="flex items-center" style={{ gap: 16 }}>
                      <div
                        className="flex items-center justify-center"
                        style={{ width: 48, height: 48, borderRadius: 16, background: "#F8FAFC", flexShrink: 0 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={CHART_ICON} alt="" style={{ width: 24, height: 24 }} />
                      </div>
                      <div>
                        <p style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 14, lineHeight: "20px", color: "#0F2D51", margin: 0 }}>Прогноз баллов</p>
                        <p style={{ fontFamily: JAKARTA, fontWeight: 400, fontSize: 12, lineHeight: "16px", color: "#94A3B8", margin: 0 }}>на основе 24 тестов</p>
                      </div>
                    </div>
                    <div style={{ background: "#DBEAFE", borderRadius: 9999, padding: "3px 12px 4px" }}>
                      <p style={{ fontFamily: JAKARTA, fontWeight: 800, fontSize: 12, lineHeight: "16px", color: "#16A34A", margin: 0, whiteSpace: "nowrap" }}>+12% IMPROVED</p>
                    </div>
                  </div>

                  {/* Chart area */}
                  <div className="absolute" style={{ top: 104, left: 24, right: 24, height: 192 }}>
                    <div className="relative w-full h-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={CHART_LINE} alt="" className="w-full h-full object-cover" />
                      {/* Tooltip */}
                      <div
                        className="absolute"
                        style={{
                          top: -16, right: -16.84,
                          background: "#FBBF24",
                          borderRadius: 16,
                          padding: "11px 12px 13px",
                          boxShadow: "0px 20px 25px -5px rgba(253,230,138,0.5), 0px 8px 10px -6px rgba(253,230,138,0.5)",
                        }}
                      >
                        <p style={{ fontFamily: JAKARTA, fontWeight: 800, fontSize: 20, lineHeight: "28px", color: "white", margin: 0 }}>138</p>
                        <p style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 10, lineHeight: "15px", color: "white", textTransform: "uppercase", margin: 0 }}>Goal</p>
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="absolute flex" style={{ top: 320, left: 24, right: 24, height: 84, gap: 16 }}>
                    <div
                      className="flex flex-col"
                      style={{
                        width: 259,
                        background: "#EFF6FF",
                        border: "1px solid #DBEAFE",
                        borderRadius: 16,
                        padding: "16px 17px",
                        gap: 4,
                      }}
                    >
                      <p style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 10, lineHeight: "15px", color: "#3B82F6", textTransform: "uppercase", letterSpacing: "-0.25px", margin: 0 }}>Задач решено</p>
                      <p style={{ fontFamily: JAKARTA, fontWeight: 800, fontSize: 24, lineHeight: "32px", color: "#0F2D51", margin: 0 }}>1,240</p>
                    </div>
                    <div
                      className="flex flex-col"
                      style={{
                        width: 259,
                        background: "#F8FAFC",
                        border: "1px solid #F1F5F9",
                        borderRadius: 16,
                        padding: "16px 17px",
                        gap: 4,
                      }}
                    >
                      <p style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 10, lineHeight: "15px", color: "#94A3B8", textTransform: "uppercase", letterSpacing: "-0.25px", margin: 0 }}>Точность</p>
                      <p style={{ fontFamily: JAKARTA, fontWeight: 800, fontSize: 24, lineHeight: "32px", color: "#0F2D51", margin: 0 }}>94%</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FEATURES SECTION
      ══════════════════════════════════════ */}
      <section style={{ paddingTop: 50, paddingBottom: 80 }}>
        <div className="mx-auto px-6" style={{ maxWidth: 1143 }}>
          {/* Heading */}
          <div className="text-center" style={{ marginBottom: 150 }}>
            <h2
              style={{
                fontFamily: ROSTOV,
                fontSize: 36,
                lineHeight: "40px",
                color: "#0F2D51",
                margin: "0 0 16px",
              }}
            >
              Не просто тесты. Система.
            </h2>
            <p
              style={{
                fontFamily: JOST,
                fontSize: 16,
                lineHeight: "24px",
                color: "#64748B",
                maxWidth: 672,
                margin: "0 auto",
              }}
            >
              Мы объединили логику LeetCode и лучшие практики педагогики, чтобы ты понимал суть предмета, а не просто заучивал
            </p>
          </div>

          {/* 4-column feature grid */}
          <div className="grid grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white"
                style={{
                  borderRadius: 16,
                  padding: 32,
                  boxShadow: "0px 4px 24px 0px rgba(0,0,0,0.08)",
                  height: 294,
                  position: "relative",
                }}
              >
                {/* Icon container */}
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 56, height: 56,
                    borderRadius: 16,
                    background: "#F8FAFC",
                    color: "#0F2D51",
                    marginBottom: 24,
                  }}
                >
                  {f.icon}
                </div>

                {/* Title */}
                <h3
                  style={{
                    fontFamily: JOST,
                    fontWeight: 700,
                    fontSize: 20,
                    lineHeight: "24px",
                    color: "#0F2D51",
                    margin: "0 0 16px",
                  }}
                >
                  {f.title}
                </h3>

                {/* Description */}
                <p
                  style={{
                    fontFamily: JOST,
                    fontSize: 14,
                    lineHeight: "20px",
                    color: "#64748B",
                    margin: "0 0 24px",
                  }}
                >
                  {f.description}
                </p>

                {/* Link */}
                <Link
                  href={f.href}
                  className="absolute bottom-8 left-8 flex items-center gap-1 transition-opacity hover:opacity-70"
                  style={{
                    fontFamily: JOST,
                    fontSize: 14,
                    fontWeight: 500,
                    color: "#0F2D51",
                  }}
                >
                  {f.link}
                  <ArrowSmIcon />
                </Link>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          ACTIVITY SECTION
      ══════════════════════════════════════ */}
      <section style={{ padding: "48px 0", background: "#F8FAFC" }}>
        <div className="mx-auto px-6" style={{ maxWidth: 1143 }}>
          <div className="flex items-center" style={{ gap: 80 }}>
            {/* Left: heatmap panel */}
            <div
              className="flex-1 bg-white"
              style={{
                borderRadius: 16,
                padding: 24,
                boxShadow: "0px 1px 4px rgba(0,0,0,0.06)",
                border: "1px solid #F1F5F9",
              }}
            >
              <h3 style={{ fontFamily: JOST, fontWeight: 700, fontSize: 20, lineHeight: "28px", color: "#0F2D51", margin: "0 0 4px" }}>
                Активность
              </h3>
              <p style={{ fontFamily: JOST, fontSize: 12, lineHeight: "20px", color: "#64748B", margin: "0 0 16px" }}>
                2003 активностей за последний год
              </p>
              <ActivityHeatmap />
              <div className="flex items-center mt-3" style={{ gap: 8 }}>
                <span style={{ fontFamily: JOST, fontSize: 10, color: "#94A3B8" }}>Меньше</span>
                {HEAT_COLORS.map((c, i) => (
                  <div key={i} style={{ width: 12, height: 12, borderRadius: 2, background: c, flexShrink: 0 }} />
                ))}
                <span style={{ fontFamily: JOST, fontSize: 10, color: "#94A3B8" }}>Больше</span>
              </div>
            </div>

            {/* Right: motivational text */}
            <div style={{ width: 285, flexShrink: 0 }}>
              <h2 style={{ fontFamily: ROSTOV, fontSize: 36, lineHeight: "40px", color: "#0F2D51", margin: 0 }}>
                Наблюдай за активностью и мотивируй себя расти дальше
              </h2>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          CODE DEMO SECTION
      ══════════════════════════════════════ */}
      <section style={{ padding: "80px 0", background: "white" }}>
        <div className="mx-auto px-6" style={{ maxWidth: 1143 }}>
          <div className="flex items-center" style={{ gap: 64 }}>

            {/* Left: dark code editor */}
            <div className="flex-1 overflow-hidden" style={{ borderRadius: 16, background: "#1E293B" }}>
              {/* Title bar */}
              <div className="flex items-center" style={{ background: "#0F172A", padding: "12px 16px", gap: 18 }}>
                <div className="flex" style={{ gap: 18 }}>
                  <div className="rounded-full" style={{ width: 12, height: 12, background: "#EF4444" }} />
                  <div className="rounded-full" style={{ width: 12, height: 12, background: "#F59E0B" }} />
                  <div className="rounded-full" style={{ width: 12, height: 12, background: "#10B981" }} />
                </div>
                <span style={{ fontFamily: JAKARTA, fontSize: 12, lineHeight: "16px", color: "#94A3B8" }}>
                  Mathematics_Module_04.py
                </span>
              </div>

              {/* Code body */}
              <div style={{ padding: 32 }}>
                <p style={{ fontFamily: "ui-monospace, 'Cascadia Code', 'Source Code Pro', Menlo, Consolas, monospace", fontSize: 14, lineHeight: "23px", color: "#93C5FD", margin: "0 0 16px" }}>
                  import orkenai_math as ai
                </p>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, lineHeight: "22.75px", color: "#475569", margin: "0 0 8px" }}>
                  # Реши уравнение: x² - 5x + 6 = 0
                </p>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, lineHeight: "22.75px", color: "#F1F5F9", margin: "0 0 8px" }}>
                  def solve_quadratic(a, b, c):
                </p>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, lineHeight: "22.75px", color: "#F1F5F9", margin: "0 0 8px", paddingLeft: 32 }}>
                  discriminant = b**2 - 4*a*c
                </p>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, lineHeight: "22.75px", color: "#F1F5F9", margin: "0 0 8px", paddingLeft: 32 }}>
                  x1 = (-b + discriminant**0.5) / (2*a)
                </p>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, lineHeight: "22.75px", color: "#F1F5F9", margin: "0 0 8px", paddingLeft: 32 }}>
                  x2 = (-b - discriminant**0.5) / (2*a)
                </p>
                <p style={{ fontFamily: "ui-monospace, monospace", fontSize: 14, lineHeight: "22.75px", color: "#C084FC", margin: 0, paddingLeft: 32 }}>
                  return x1, x2
                </p>

                <div className="flex items-center" style={{ marginTop: 40, gap: 24 }}>
                  <button
                    className="text-white transition-opacity hover:opacity-80"
                    style={{
                      fontFamily: JOST,
                      fontSize: 14,
                      lineHeight: "44px",
                      background: "#0F2D51",
                      borderRadius: 8,
                      border: "none",
                      padding: "0 16px",
                      cursor: "pointer",
                    }}
                  >
                    Продолжить
                  </button>
                  <span style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 12, lineHeight: "16px", color: "#4ADE80" }}>
                    AI Одобрено: +150 XP
                  </span>
                </div>
              </div>
            </div>

            {/* Right: description */}
            <div className="flex-1">
              <h2 style={{ fontFamily: ROSTOV, fontSize: 36, lineHeight: "44px", color: "#0F2D51", margin: "0 0 32px" }}>
                Ошибайся правильно AI всё исправит
              </h2>
              <p style={{ fontFamily: JOST, fontSize: 16, lineHeight: "24px", color: "#64748B", margin: "0 0 32px" }}>
                Вместо скучного «Неправильно», наш AI анализирует каждый твой шаг. Он видит, где ты ошибся в формуле, и предлагает короткое видео-объяснение именно этой ошибки.
              </p>
              <ul className="flex flex-col" style={{ gap: 16, listStyle: "none", padding: 0, margin: 0 }}>
                {["Пошаговая автопроверка", "Персональные рекомендации", "Видео-подсказки по запросу"].map((item) => (
                  <li key={item} className="flex items-center" style={{ gap: 12 }}>
                    <CheckCircleIcon />
                    <span style={{ fontFamily: JOST, fontWeight: 700, fontSize: 16, lineHeight: "24px", color: "#0F2D51" }}>
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ══════════════════════════════════════
          FINAL CTA SECTION
      ══════════════════════════════════════ */}
      <section className="relative overflow-hidden">
        {/* Backgrounds */}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0" style={{ background: "#0F2D51" }} />
          <div className="absolute inset-0 overflow-hidden" style={{ opacity: 0.2 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              alt=""
              src={CTA_BG}
              className="absolute w-full left-0"
              style={{ height: "198.96%", top: "-49.48%" }}
            />
          </div>
        </div>

        <div className="relative flex flex-col items-center" style={{ padding: "128px 24px" }}>
          <div className="flex flex-col items-center" style={{ maxWidth: 896, width: "100%", gap: 32 }}>

            {/* Heading */}
            <h2
              className="text-center"
              style={{
                fontFamily: ROSTOV,
                fontSize: 64,
                lineHeight: "40px",
                letterSpacing: "-0.5309px",
                margin: 0,
                whiteSpace: "nowrap",
              }}
            >
              <span style={{ color: "white" }}>Готов к своим </span>
              <span style={{ color: "#22D3EE" }}>140 баллам?</span>
            </h2>

            {/* Subtitle */}
            <p
              className="text-center"
              style={{
                fontFamily: JAKARTA,
                fontWeight: 400,
                fontSize: 20,
                lineHeight: "28px",
                color: "#DBEAFE",
                opacity: 0.8,
                margin: 0,
                whiteSpace: "nowrap",
              }}
            >
              Начни подготовку сегодня. абсолютно бесплатно
            </p>

            {/* CTA buttons */}
            <div className="flex items-center justify-center" style={{ gap: 15.99, paddingTop: 16 }}>
              <Link
                href="/auth/register"
                className="flex items-center justify-center text-white transition-opacity hover:opacity-90"
                style={{
                  fontFamily: JAKARTA,
                  fontWeight: 700,
                  fontSize: 20,
                  lineHeight: "28px",
                  background: "#5081BA",
                  borderRadius: 24,
                  padding: "20px 40px",
                  boxShadow: "0px 25px 50px -12px rgba(59,130,246,0.2)",
                  whiteSpace: "nowrap",
                }}
              >
                Создать аккаунт
              </Link>
              <Link
                href="/auth"
                className="flex items-center justify-center text-white transition-opacity hover:opacity-80"
                style={{
                  fontFamily: JAKARTA,
                  fontWeight: 700,
                  fontSize: 20,
                  lineHeight: "28px",
                  border: "2px solid rgba(255,255,255,0.2)",
                  borderRadius: 24,
                  padding: "22px 42px",
                  whiteSpace: "nowrap",
                }}
              >
                Для учителей
              </Link>
            </div>

            {/* Stats */}
            <div className="flex items-center justify-center" style={{ gap: 32, paddingTop: 16 }}>
              <div className="flex flex-col items-center text-center">
                <p style={{ fontFamily: JAKARTA, fontWeight: 800, fontSize: 30, lineHeight: "36px", color: "white", margin: 0 }}>94%</p>
                <p style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 10, lineHeight: "15px", color: "#93C5FD", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>Успех учеников</p>
              </div>
              <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
              <div className="flex flex-col items-center text-center">
                <p style={{ fontFamily: JAKARTA, fontWeight: 800, fontSize: 30, lineHeight: "36px", color: "white", margin: 0 }}>AI agent</p>
                <p style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 10, lineHeight: "15px", color: "#93C5FD", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>для объяснения задач</p>
              </div>
              <div style={{ width: 1, height: 40, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />
              <div className="flex flex-col items-center text-center">
                <p style={{ fontFamily: JAKARTA, fontWeight: 800, fontSize: 30, lineHeight: "36px", color: "white", margin: 0 }}>Улучшай</p>
                <p style={{ fontFamily: JAKARTA, fontWeight: 700, fontSize: 10, lineHeight: "15px", color: "#93C5FD", textTransform: "uppercase", letterSpacing: "1px", margin: 0 }}>Средний балл</p>
              </div>
            </div>

          </div>
        </div>
      </section>
    </div>
  );
}

'use client';

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/auth-context";
import { EntHeader } from "@/components/ent-header";


const HERO_BG     = "images/hero_bg.png";
const AVATAR_1    = "icons/User.png";
const AVATAR_2    = "icons/User_margin.png";
const AVATAR_3    = "icons/User_margin-1.png";
const CTA_BG      = "images/ct_bg.png";

const JAKARTA = "var(--font-jakarta), 'Plus Jakarta Sans', 'Noto Sans', sans-serif";
const ROSTOV  = "var(--font-rostov)";
const JOST    = "var(--font-jost)";


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
    <svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
    <rect x="12" y="2" width="56" height="56" rx="16" fill="#06B6D4"/>
    <g filter="url(#filter0_dd_243_3867)">
    <rect x="12" y="2" width="56" height="56" rx="16" fill="white" fillOpacity="0.01" shapeRendering="crispEdges"/>
    </g>
    <path d="M46 34L50 30L46 26M34 26L30 30L34 34M42.5 22L37.5 38" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
    <defs>
    <filter id="filter0_dd_243_3867" x="0" y="0" width="80" height="80" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
    <feFlood floodOpacity="0" result="BackgroundImageFix"/>
    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
    <feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect1_dropShadow_243_3867"/>
    <feOffset dy="4"/>
    <feGaussianBlur stdDeviation="3"/>
    <feComposite in2="hardAlpha" operator="out"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.647059 0 0 0 0 0.952941 0 0 0 0 0.988235 0 0 0 1 0"/>
    <feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_243_3867"/>
    <feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
    <feMorphology radius="3" operator="erode" in="SourceAlpha" result="effect2_dropShadow_243_3867"/>
    <feOffset dy="10"/>
    <feGaussianBlur stdDeviation="7.5"/>
    <feComposite in2="hardAlpha" operator="out"/>
    <feColorMatrix type="matrix" values="0 0 0 0 0.647059 0 0 0 0 0.952941 0 0 0 0 0.988235 0 0 0 1 0"/>
    <feBlend mode="normal" in2="effect1_dropShadow_243_3867" result="effect2_dropShadow_243_3867"/>
    <feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_243_3867" result="shape"/>
    </filter>
    </defs>
    </svg>

    ),
  },
  {
    title: "AI Видео уроки",
    description: "Генерация объяснений по любой теме за секунды. Твой персональный тьютор 24/7",
    link: "Watch Demo",
    href: "/subjects",
    icon: (
<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="12" y="2" width="56" height="56" rx="16" fill="#EDB98A"/>
<g filter="url(#filter0_dd_243_3886)">
<rect x="12" y="2" width="56" height="56" rx="16" fill="white" fillOpacity="0.01" shapeRendering="crispEdges"/>
</g>
<path d="M37 27.003C36.9995 26.8256 37.0462 26.6511 37.1353 26.4977C37.2245 26.3442 37.3528 26.2173 37.5073 26.1298C37.6617 26.0424 37.8366 25.9976 38.0141 26.0001C38.1915 26.0026 38.3651 26.0523 38.517 26.144L43.514 29.141C43.6628 29.2297 43.786 29.3555 43.8715 29.506C43.9571 29.6566 44.002 29.8268 44.002 30C44.002 30.1732 43.9571 30.3434 43.8715 30.494C43.786 30.6446 43.6628 30.7704 43.514 30.859L38.517 33.856C38.365 33.9478 38.1913 33.9975 38.0138 33.9999C37.8363 34.0024 37.6613 33.9575 37.5068 33.87C37.3524 33.7824 37.224 33.6553 37.1349 33.5017C37.0459 33.3481 36.9993 33.1736 37 32.996V27.003Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
<path d="M40 40C45.5228 40 50 35.5228 50 30C50 24.4772 45.5228 20 40 20C34.4772 20 30 24.4772 30 30C30 35.5228 34.4772 40 40 40Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
<defs>
<filter id="filter0_dd_243_3886" x="0" y="0" width="80" height="80" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
<feFlood floodOpacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect1_dropShadow_243_3886"/>
<feOffset dy="4"/>
<feGaussianBlur stdDeviation="3"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_243_3886"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feMorphology radius="3" operator="erode" in="SourceAlpha" result="effect2_dropShadow_243_3886"/>
<feOffset dy="10"/>
<feGaussianBlur stdDeviation="7.5"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0.1 0"/>
<feBlend mode="normal" in2="effect1_dropShadow_243_3886" result="effect2_dropShadow_243_3886"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_243_3886" result="shape"/>
</filter>
</defs>
</svg>

    ),
  },
  {
    title: "Глубокая аналитика",
    description: "Визуализация прогресса и поиск пробелов с точностью до подтемы",
    link: "View Dashboard",
    href: "/dashboard",
    icon: (
<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="12" y="2" width="56" height="56" rx="16" fill="#F59E0B"/>
<g filter="url(#filter0_dd_243_3905)">
<rect x="12" y="2" width="56" height="56" rx="16" fill="white" fillOpacity="0.01" shapeRendering="crispEdges"/>
</g>
<path d="M49.2099 33.8901C48.5737 35.3946 47.5787 36.7203 46.3118 37.7514C45.0449 38.7825 43.5447 39.4875 41.9424 39.8049C40.34 40.1222 38.6843 40.0422 37.1201 39.5719C35.5558 39.1015 34.1305 38.2551 32.9689 37.1067C31.8073 35.9583 30.9447 34.5428 30.4565 32.984C29.9684 31.4252 29.8695 29.7706 30.1685 28.1647C30.4675 26.5589 31.1554 25.0507 32.172 23.7721C33.1885 22.4935 34.5028 21.4834 35.9999 20.8301" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
<path d="M50 30C50 28.6868 49.7413 27.3864 49.2388 26.1732C48.7362 24.9599 47.9997 23.8575 47.0711 22.9289C46.1425 22.0003 45.0401 21.2638 43.8268 20.7612C42.6136 20.2587 41.3132 20 40 20V30H50Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
<defs>
<filter id="filter0_dd_243_3905" x="0" y="0" width="80" height="80" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
<feFlood floodOpacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect1_dropShadow_243_3905"/>
<feOffset dy="4"/>
<feGaussianBlur stdDeviation="3"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.992157 0 0 0 0 0.901961 0 0 0 0 0.541176 0 0 0 1 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_243_3905"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feMorphology radius="3" operator="erode" in="SourceAlpha" result="effect2_dropShadow_243_3905"/>
<feOffset dy="10"/>
<feGaussianBlur stdDeviation="7.5"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.992157 0 0 0 0 0.901961 0 0 0 0 0.541176 0 0 0 1 0"/>
<feBlend mode="normal" in2="effect1_dropShadow_243_3905" result="effect2_dropShadow_243_3905"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_243_3905" result="shape"/>
</filter>
</defs>
</svg>

    ),
  },
  {
    title: "UNT Battle",
    description: "Соревнуйся с друзьями, зарабатывай XP и открывай уникальные достижения.",
    link: "Присоединиться",
    href: "/auth/register",
    icon: (
<svg width="80" height="80" viewBox="0 0 80 80" fill="none" xmlns="http://www.w3.org/2000/svg">
<rect x="12" y="2" width="56" height="56" rx="16" fill="#A855F7"/>
<g filter="url(#filter0_dd_243_3927)">
<rect x="12" y="2" width="56" height="56" rx="16" fill="white" fillOpacity="0.01" shapeRendering="crispEdges"/>
</g>
<path d="M43.4772 30.8901L44.9922 39.4161C45.0092 39.5165 44.9951 39.6197 44.9519 39.7119C44.9086 39.8041 44.8382 39.8808 44.7502 39.9319C44.6621 39.983 44.5605 40.006 44.459 39.9978C44.3576 39.9897 44.261 39.9507 44.1822 39.8861L40.6022 37.1991C40.4294 37.07 40.2195 37.0003 40.0037 37.0003C39.788 37.0003 39.5781 37.07 39.4052 37.1991L35.8192 39.8851C35.7406 39.9496 35.6441 39.9885 35.5427 39.9967C35.4414 40.0049 35.3399 39.982 35.2519 39.931C35.1639 39.88 35.0935 39.8035 35.0502 39.7115C35.0068 39.6195 34.9925 39.5165 35.0092 39.4161L36.5232 30.8901" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
<path d="M40 32C43.3137 32 46 29.3137 46 26C46 22.6863 43.3137 20 40 20C36.6863 20 34 22.6863 34 26C34 29.3137 36.6863 32 40 32Z" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
<defs>
<filter id="filter0_dd_243_3927" x="0" y="0" width="80" height="80" filterUnits="userSpaceOnUse" colorInterpolationFilters="sRGB">
<feFlood floodOpacity="0" result="BackgroundImageFix"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feMorphology radius="4" operator="erode" in="SourceAlpha" result="effect1_dropShadow_243_3927"/>
<feOffset dy="4"/>
<feGaussianBlur stdDeviation="3"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.913725 0 0 0 0 0.835294 0 0 0 0 1 0 0 0 1 0"/>
<feBlend mode="normal" in2="BackgroundImageFix" result="effect1_dropShadow_243_3927"/>
<feColorMatrix in="SourceAlpha" type="matrix" values="0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 0 127 0" result="hardAlpha"/>
<feMorphology radius="3" operator="erode" in="SourceAlpha" result="effect2_dropShadow_243_3927"/>
<feOffset dy="10"/>
<feGaussianBlur stdDeviation="7.5"/>
<feComposite in2="hardAlpha" operator="out"/>
<feColorMatrix type="matrix" values="0 0 0 0 0.913725 0 0 0 0 0.835294 0 0 0 0 1 0 0 0 1 0"/>
<feBlend mode="normal" in2="effect1_dropShadow_243_3927" result="effect2_dropShadow_243_3927"/>
<feBlend mode="normal" in="SourceGraphic" in2="effect2_dropShadow_243_3927" result="shape"/>
</filter>
</defs>
</svg>

    ),
  },
];


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

      {}
      <section className="relative overflow-hidden" style={{ height: "555px" }}>
        {}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          {}
          <img alt="" src={HERO_BG} className="absolute inset-0 w-full h-full object-cover" style={{ opacity: 0.1 }} />
          <div className="absolute inset-0" style={{ background: "rgba(80,129,186,0.2)" }} />
        </div>

        {}
        <div
          className="relative mx-auto flex items-center justify-center px-6 h-full"
          style={{ maxWidth: "1280px", gap: "56.658px" }}
        >
          {}
          <div className="relative shrink-0" style={{ width: "584px", height: "429.5px" }}>

            {}
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

            {}
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

            {}
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

            {}
            <div
              className="absolute left-0 right-0 flex items-center"
              style={{ top: 363.5, gap: 16 }}
            >
              {}
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

              {}
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
                  {}
                  <img src={AVATAR_1} alt="" className="rounded-full object-cover" style={{ width: 32, height: 32, border: "2px solid white", marginRight: -8, position: "relative", zIndex: 3 }} />
                  {}
                  <img src={AVATAR_2} alt="" className="rounded-full object-cover" style={{ width: 32, height: 32, border: "2px solid white", marginRight: -8, position: "relative", zIndex: 2 }} />
                  {}
                  <img src={AVATAR_3} alt="" className="rounded-full object-cover" style={{ width: 32, height: 32, border: "2px solid white", position: "relative", zIndex: 1 }} />
                </div>
                <p style={{ fontFamily: JAKARTA, fontSize: 12, margin: 0 }}>
                  <span style={{ fontWeight: 700, color: "#0F2D51" }}>+1000</span>
                  <span style={{ fontWeight: 400, color: "#64748B" }}> учеников уже с нами</span>
                </p>
              </div>
            </div>
          </div>

          {}
          <div className="relative shrink-0" style={{ width: 432 }}>
            {}
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
            {}
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

            {}
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
                  {}
                  <div className="absolute flex items-center" style={{ top: 24, left: 24, right: 24, gap: 16 }}>
                    <div className="flex items-center" style={{ gap: 16 }}>
                      <div
                        className="flex items-center justify-center"
                        style={{ width: 48, height: 48, borderRadius: 16, background: "#F8FAFC", flexShrink: 0 }}
                      >
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src="icons/dashboard-icon.svg" alt="dashboard" style={{ width: 24, height: 24 }} />
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

                  {}
                  <div className="absolute" style={{ top: 104, left: 24, right: 24, height: 192 }}>
                    <div className="relative w-full h-full">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src="/images/dashboard.svg" alt="dashboard" className="w-full h-full object-cover" />
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

                  {}
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

      {}
      <section style={{ paddingTop: 50, paddingBottom: 80 }}>
        <div className="mx-auto px-6" style={{ maxWidth: 1143 }}>
          {}
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

          {}
          <div className="grid grid-cols-4 gap-6">
            {FEATURES.map((f) => (
              <div
                key={f.title}
                className="bg-white transition-all duration-300 " 
                style={{
                  borderRadius: 40,
                  padding: 32,
                  boxShadow: "0px 4px 24px 0px rgba(0,0,0,0.08)",
                  height: 294,
                  position: "relative",
                  border: "4px solid #5081BA",
                }}
              >
                {}
                <div
                  className="flex items-center justify-center"
                  style={{
                    width: 56, height: 56,
                    borderRadius: 16,
                    color: "#0F2D51",
                    marginBottom: 24,
                  }}
                >
                  {f.icon}
                </div>

                {}
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

                {}
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

                {}
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

      {}
      <section style={{ padding: "48px 0", background: "#F8FAFC" }}>
        <div className="mx-auto px-6" style={{ maxWidth: 1143 }}>
          <div className="flex items-center" style={{ gap: 80 }}>
            {}
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

            {}
            <div style={{ width: 285, flexShrink: 0 }}>
              <h2 style={{ fontFamily: ROSTOV, fontSize: 36, lineHeight: "40px", color: "#0F2D51", margin: 0 }}>
                Наблюдай за активностью и мотивируй себя расти дальше
              </h2>
            </div>
          </div>
        </div>
      </section>

      {}
      <section style={{ padding: "80px 0", background: "white" }}>
        <div className="mx-auto px-6" style={{ maxWidth: 1143 }}>
          <div className="flex items-center" style={{ gap: 64 }}>

            {}
            <div className="flex-1 overflow-hidden" style={{ borderRadius: 16, background: "#1E293B" }}>
              {}
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

              {}
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

            {}
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

      {}
      <section className="relative overflow-hidden">
        {}
        <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
          <div className="absolute inset-0" style={{ background: "#0F2D51" }} />
          <div className="absolute inset-0 overflow-hidden" style={{ opacity: 0.2 }}>
            {}
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

            {}
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

            {}
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

            {}
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

            {}
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

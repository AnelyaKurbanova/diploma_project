'use client';

import { useMemo, useRef, useState } from "react";

type ActivityItem = {
  date: string;
  count: number;
};

type ActivityHeatmapProps = {
  activity: ActivityItem[];
  className?: string;
};

const RU_MONTHS = ["Янв", "Фев", "Мар", "Апр", "Май", "Июн", "Июл", "Авг", "Сен", "Окт", "Ноя", "Дек"];
const RU_WEEKDAYS = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вск"];

function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function startOfWeekMonday(date: Date): Date {
  const d = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function ruActionsWord(n: number): string {
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 === 1 && mod100 !== 11) return "действие";
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return "действия";
  return "действий";
}

export function ActivityHeatmap({ activity, className = "" }: ActivityHeatmapProps) {
  const sectionRef = useRef<HTMLElement | null>(null);
  const [hovered, setHovered] = useState<{ left: number; top: number; date: string; count: number } | null>(null);
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);

  const activityMap = useMemo(() => {
    const map = new Map<string, number>();
    for (const item of activity) {
      if (!item?.date) continue;
      map.set(item.date.slice(0, 10), Math.max(0, Number(item.count || 0)));
    }
    return map;
  }, [activity]);

  const yearStart = useMemo(() => new Date(today.getFullYear(), 0, 1), [today]);
  const yearEnd = useMemo(() => new Date(today.getFullYear(), 11, 31), [today]);

  const totalYearActivity = useMemo(() => {
    let sum = 0;
    for (let day = new Date(yearStart); day <= today; day.setDate(day.getDate() + 1)) {
      sum += activityMap.get(toIsoDate(day)) ?? 0;
    }
    return sum;
  }, [activityMap, today, yearStart]);

  const grid = useMemo(() => {
    const firstDay = new Date(yearStart);
    const lastDay = new Date(yearEnd);
    const gridStart = startOfWeekMonday(firstDay);
    const weeks: Array<Array<{ key: string; level: number; month: number; inRange: boolean }>> = [];
    const monthLabels: Array<{ weekIndex: number; label: string }> = [];

    const totalWeeks = Math.ceil((lastDay.getTime() - gridStart.getTime() + 1) / (7 * 24 * 60 * 60 * 1000));
    for (let w = 0; w < totalWeeks; w += 1) {
      const col: Array<{ key: string; level: number; month: number; inRange: boolean }> = [];
      const weekBase = new Date(gridStart.getFullYear(), gridStart.getMonth(), gridStart.getDate() + w * 7);

      for (let d = 0; d < 7; d += 1) {
        const current = new Date(weekBase.getFullYear(), weekBase.getMonth(), weekBase.getDate() + d);
        const inRange = current >= firstDay && current <= lastDay;
        const iso = toIsoDate(current);
        const count = inRange ? (activityMap.get(iso) ?? 0) : 0;
        const level = count <= 0 ? 0 : count <= 1 ? 1 : count <= 3 ? 2 : count <= 6 ? 3 : 4;
        col.push({ key: iso, level, month: current.getMonth(), inRange });
      }
      weeks.push(col);
    }

    // Month labels are fixed to Jan..Dec of the selected calendar year (no repeats).
    for (let month = 0; month < 12; month += 1) {
      const firstOfMonth = new Date(yearStart.getFullYear(), month, 1);
      const diffDays = Math.floor(
        (firstOfMonth.getTime() - gridStart.getTime()) / (24 * 60 * 60 * 1000),
      );
      const weekIndex = Math.max(0, Math.floor(diffDays / 7));
      monthLabels.push({ weekIndex, label: RU_MONTHS[month] });
    }

    return { weeks, monthLabels };
  }, [activityMap, yearStart, yearEnd]);

  const colorByLevel = [
    "bg-slate-100 border-slate-200",
    "bg-blue-100 border-blue-200",
    "bg-blue-300 border-blue-300",
    "bg-blue-500 border-blue-500",
    "bg-blue-700 border-blue-700",
  ];

  const stepPx = 12; // 10px cell + 2px gap
  const dateFormatter = useMemo(
    () => new Intl.DateTimeFormat("ru-RU", { day: "numeric", month: "long", year: "numeric" }),
    [],
  );
  return (
    <section ref={sectionRef} className={`relative rounded-2xl border border-gray-200 bg-white p-4 shadow-sm ${className}`}>
      {hovered && (
        <div
          className="pointer-events-none absolute z-30 -translate-x-1/2 -translate-y-[calc(100%+8px)] rounded-md bg-slate-900 px-2 py-1 text-[11px] text-white shadow-lg"
          style={{ left: hovered.left, top: hovered.top }}
        >
          {dateFormatter.format(parseIsoDate(hovered.date))}: {hovered.count} {ruActionsWord(hovered.count)}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold leading-tight text-slate-900">Активность</h2>
          <p className="mt-1 text-sm text-slate-500">
            <span className="font-bold text-slate-900">{totalYearActivity}</span> активностей за последний год
          </p>
        </div>
        <div className="flex items-center gap-1.5 text-xs text-slate-500">
          <span>Меньше</span>
          {colorByLevel.map((color, idx) => (
            <span key={idx} className={`h-2.5 w-2.5 rounded-full border ${color}`} />
          ))}
          <span>Больше</span>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto pb-1">
        <div className="inline-grid min-w-[700px] grid-cols-[24px_auto] gap-x-2">
          <div />
          <div className="relative h-4">
            {grid.monthLabels.map((m) => (
              <span
                key={`${m.label}-${m.weekIndex}`}
                className="absolute top-0 text-[11px] font-medium text-slate-500"
                style={{ left: `${m.weekIndex * stepPx}px` }}
              >
                {m.label}
              </span>
            ))}
          </div>

          <div className="grid grid-rows-7 gap-0.5 pt-0.5 text-xs text-slate-500">
            {RU_WEEKDAYS.map((wd) => (
              <span key={wd} className="flex h-2.5 items-center">
                {wd}
              </span>
            ))}
          </div>

          <div className="grid auto-cols-[10px] grid-flow-col grid-rows-7 gap-0.5">
            {grid.weeks.map((week, wi) =>
              week.map((cell, di) => (
                <span
                  key={`${cell.key}-${wi}-${di}`}
                  className={`h-2.5 w-2.5 rounded-full border ${cell.inRange ? `${colorByLevel[cell.level]} cursor-pointer` : "border-transparent bg-transparent"}`}
                  onMouseEnter={(e) => {
                    if (!cell.inRange || !sectionRef.current) return;
                    const hostRect = sectionRef.current.getBoundingClientRect();
                    const dotRect = e.currentTarget.getBoundingClientRect();
                    const rawLeft = dotRect.left - hostRect.left + dotRect.width / 2;
                    const tooltipHalfWidth = 110;
                    const left = Math.max(
                      tooltipHalfWidth + 8,
                      Math.min(hostRect.width - tooltipHalfWidth - 8, rawLeft),
                    );
                    setHovered({
                      left,
                      top: dotRect.top - hostRect.top,
                      date: cell.key,
                      count: activityMap.get(cell.key) ?? 0,
                    });
                  }}
                  onMouseLeave={() => setHovered(null)}
                />
              )),
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

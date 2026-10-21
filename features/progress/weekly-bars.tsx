"use client";

import { useState } from "react";
import type { WeeklyCount } from "@/lib/progress";
import { formatShortDate } from "@/lib/time";

function ticksFor(max: number) {
  return max <= 4 ? Array.from({ length: max + 1 }, (_, index) => index) : [0, Math.ceil(max / 2), max];
}

const sessionsLabel = (count: number) => `${count} ${count === 1 ? "session" : "sessions"}`;

export function WeeklyBars({ weeks }: { weeks: WeeklyCount[] }) {
  const [active, setActive] = useState<number | null>(null);
  const max = Math.max(1, ...weeks.map((week) => week.count));
  const ticks = ticksFor(max);

  return (
    <figure className="space-y-2">
      <div className="relative h-40 pl-7">
        {ticks.map((tick) => (
          <div key={tick} className="absolute inset-x-0 flex items-center gap-2" style={{ bottom: `${(tick / max) * 100}%` }} aria-hidden>
            <span className="w-5 -translate-y-px text-right text-xs text-muted-foreground tabular-nums">{tick}</span>
            <span className="h-px flex-1 bg-border" />
          </div>
        ))}
        <div className="absolute inset-y-0 right-0 left-7 flex items-end justify-around">
          {weeks.map((week, index) => {
            const percent = (week.count / max) * 100;
            return (
              <button
                key={week.start}
                type="button"
                aria-label={`Week of ${formatShortDate(week.start)}: ${sessionsLabel(week.count)}`}
                className="group relative flex h-full w-full max-w-12 items-end justify-center rounded-md outline-none focus-visible:ring-2 focus-visible:ring-ring/50"
                onMouseEnter={() => setActive(index)}
                onMouseLeave={() => setActive(null)}
                onFocus={() => setActive(index)}
                onBlur={() => setActive(null)}
              >
                <span
                  className="w-full max-w-6 rounded-t-[4px] bg-chart-1 transition-opacity group-hover:opacity-80"
                  style={{ height: `${percent}%` }}
                />
                {active === index && (
                  <span
                    role="tooltip"
                    className="pointer-events-none absolute z-10 rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm"
                    style={{ bottom: `calc(${percent}% + 6px)` }}
                  >
                    <strong className="font-semibold">{week.count}</strong>{" "}
                    <span className="text-muted-foreground">
                      {week.count === 1 ? "session" : "sessions"} · week of {formatShortDate(week.start)}
                    </span>
                  </span>
                )}
              </button>
            );
          })}
        </div>
      </div>
      <div className="flex justify-around pl-7 text-xs text-muted-foreground" aria-hidden>
        {weeks.map((week, index) => (
          <span key={week.start} className={index % 2 === 1 ? "hidden sm:block" : undefined}>
            {formatShortDate(week.start)}
          </span>
        ))}
      </div>
      <table className="sr-only">
        <caption>Completed sessions per week</caption>
        <thead>
          <tr>
            <th scope="col">Week starting</th>
            <th scope="col">Sessions</th>
          </tr>
        </thead>
        <tbody>
          {weeks.map((week) => (
            <tr key={week.start}>
              <td>{formatShortDate(week.start)}</td>
              <td>{week.count}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

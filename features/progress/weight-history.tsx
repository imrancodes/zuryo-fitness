"use client";

import { useState } from "react";
import type { WeightPoint } from "@/lib/progress";
import { formatShortDate } from "@/lib/time";

const WIDTH = 320;
const HEIGHT = 120;
const PAD = 12;

export function WeightHistory({ points }: { points: WeightPoint[] }) {
  const [active, setActive] = useState<number | null>(null);
  const times = points.map((point) => new Date(point.recordedAt).getTime());
  const weights = points.map((point) => point.weight);
  const [minTime, maxTime] = [Math.min(...times), Math.max(...times)];
  const [minWeight, maxWeight] = [Math.floor(Math.min(...weights)) - 1, Math.ceil(Math.max(...weights)) + 1];
  const x = (time: number) => PAD + ((time - minTime) / Math.max(1, maxTime - minTime)) * (WIDTH - PAD * 2);
  const y = (weight: number) => PAD + ((maxWeight - weight) / (maxWeight - minWeight)) * (HEIGHT - PAD * 2);
  const coords = points.map((point, index) => ({ ...point, cx: x(times[index]), cy: y(point.weight) }));
  const latest = coords[coords.length - 1];

  return (
    <figure className="space-y-3">
      <div className="flex gap-2">
        <div className="flex flex-col justify-between py-2 text-xs text-muted-foreground tabular-nums" aria-hidden>
          <span>{maxWeight} kg</span>
          <span>{minWeight} kg</span>
        </div>
        <div className="relative flex-1">
          <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="h-auto w-full overflow-visible" role="img" aria-label={`Weight from ${points[0].weight} kg to ${latest.weight} kg`}>
            <line x1={0} x2={WIDTH} y1={HEIGHT - 1} y2={HEIGHT - 1} className="stroke-border" strokeWidth={1} />
            <polyline
              points={coords.map((point) => `${point.cx},${point.cy}`).join(" ")}
              fill="none"
              className="stroke-chart-1"
              strokeWidth={2}
              strokeLinejoin="round"
              strokeLinecap="round"
            />
            {coords.map((point, index) => (
              <g key={point.recordedAt}>
                <circle cx={point.cx} cy={point.cy} r={4} className="fill-chart-1 stroke-card" strokeWidth={2} />
                <circle
                  cx={point.cx}
                  cy={point.cy}
                  r={12}
                  fill="transparent"
                  tabIndex={0}
                  aria-label={`${formatShortDate(point.recordedAt)}: ${point.weight} kg`}
                  className="cursor-pointer outline-none focus-visible:stroke-ring"
                  onMouseEnter={() => setActive(index)}
                  onMouseLeave={() => setActive(null)}
                  onFocus={() => setActive(index)}
                  onBlur={() => setActive(null)}
                />
              </g>
            ))}
          </svg>
          {active !== null && (
            <span
              role="tooltip"
              className="pointer-events-none absolute z-10 -translate-x-1/2 -translate-y-full rounded-md border bg-popover px-2 py-1 text-xs whitespace-nowrap text-popover-foreground shadow-sm"
              style={{ left: `${(coords[active].cx / WIDTH) * 100}%`, top: `calc(${(coords[active].cy / HEIGHT) * 100}% - 10px)` }}
            >
              <strong className="font-semibold">{coords[active].weight} kg</strong>{" "}
              <span className="text-muted-foreground">{formatShortDate(coords[active].recordedAt)}</span>
            </span>
          )}
        </div>
      </div>
      <ul className="divide-y rounded-xl border text-sm">
        {[...points].reverse().map((point) => (
          <li key={point.recordedAt} className="flex justify-between px-3 py-2">
            <span className="text-muted-foreground">{formatShortDate(point.recordedAt)}</span>
            <span className="font-medium tabular-nums">{point.weight} kg</span>
          </li>
        ))}
      </ul>
    </figure>
  );
}

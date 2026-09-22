"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";

export type CpaPoint = { label: string; cpa: number | null };

const WIDTH = 760;
const HEIGHT = 140;
const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 14;
const PAD_BOTTOM = 24;

// Same indigo used for GHL revenue elsewhere, validated with the dataviz
// skill's palette checker — kept as a single series here since CPA is one
// number, not a GHL-vs-Meta comparison like RevenueChart.
const CPA_COLOR = "#6366f1";

export default function CpaChart({ points }: { points: CpaPoint[] }) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const maxValue = useMemo(() => {
    const values = points.map((p) => p.cpa).filter((v): v is number => v !== null);
    const max = Math.max(1, ...values);
    return max * 1.15;
  }, [points]);

  const n = points.length;
  const x = (i: number) => PAD_LEFT + (n <= 1 ? plotWidth / 2 : (i / (n - 1)) * plotWidth);
  const y = (v: number) => PAD_TOP + plotHeight - (v / maxValue) * plotHeight;

  // Break the line at days with no purchases (cpa === null) instead of
  // drawing a misleading dip to zero — build separate path segments for
  // each unbroken run of known values.
  const segments = useMemo(() => {
    const runs: { x: number; y: number }[][] = [];
    let current: { x: number; y: number }[] = [];
    points.forEach((p, i) => {
      if (p.cpa === null) {
        if (current.length) runs.push(current);
        current = [];
        return;
      }
      current.push({ x: x(i), y: y(p.cpa) });
    });
    if (current.length) runs.push(current);
    return runs;
  }, [points, maxValue]);

  const gridLines = 3;
  const labelStep = Math.max(1, Math.ceil(n / 7));

  if (n === 0) {
    return <div className="flex h-[110px] items-center justify-center text-sm text-ink-400">No data in this range yet</div>;
  }

  return (
    <div className="relative">
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} className="w-full" style={{ maxHeight: 180 }} onMouseLeave={() => setHoverIndex(null)}>
        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const gy = PAD_TOP + (plotHeight / gridLines) * i;
          return (
            <line
              key={i}
              x1={PAD_LEFT}
              y1={gy}
              x2={WIDTH - PAD_RIGHT}
              y2={gy}
              stroke="currentColor"
              className="text-ink-900/[0.06]"
              strokeWidth="1"
            />
          );
        })}

        {Array.from({ length: gridLines + 1 }).map((_, i) => {
          const value = maxValue - (maxValue / gridLines) * i;
          const gy = PAD_TOP + (plotHeight / gridLines) * i;
          return (
            <text key={i} x={4} y={gy + 3} className="fill-ink-400 text-[9px]">
              {value >= 1000 ? `$${(value / 1000).toFixed(1)}k` : `$${Math.round(value)}`}
            </text>
          );
        })}

        {points.map((p, i) =>
          i % labelStep === 0 ? (
            <text key={i} x={x(i)} y={HEIGHT - 6} textAnchor="middle" className="fill-ink-400 text-[9px]">
              {p.label}
            </text>
          ) : null
        )}

        {segments.map((seg, i) => (
          <path
            key={i}
            d={seg.map((pt, j) => `${j === 0 ? "M" : "L"} ${pt.x} ${pt.y}`).join(" ")}
            fill="none"
            stroke={CPA_COLOR}
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
          />
        ))}

        {hoverIndex !== null && points[hoverIndex].cpa !== null && (
          <>
            <line
              x1={x(hoverIndex)}
              y1={PAD_TOP}
              x2={x(hoverIndex)}
              y2={PAD_TOP + plotHeight}
              stroke="currentColor"
              className="text-ink-900/20"
              strokeWidth="1"
            />
            <circle cx={x(hoverIndex)} cy={y(points[hoverIndex].cpa as number)} r="4" fill={CPA_COLOR} stroke="white" strokeWidth="2" />
          </>
        )}

        {points.map((p, i) => (
          <rect
            key={i}
            x={x(i) - plotWidth / n / 2}
            y={PAD_TOP}
            width={Math.max(plotWidth / n, 4)}
            height={plotHeight}
            fill="transparent"
            onMouseEnter={() => setHoverIndex(i)}
          />
        ))}
      </svg>

      {hoverIndex !== null && (
        <div
          className="pointer-events-none absolute top-1 rounded-xl border border-white/60 bg-white/95 px-3 py-2 text-xs shadow-soft backdrop-blur"
          style={{ left: `min(${(x(hoverIndex) / WIDTH) * 100}%, calc(100% - 130px))` }}
        >
          <div className="font-semibold text-ink-900">{points[hoverIndex].label}</div>
          <div className="mt-1 flex items-center gap-1.5 text-ink-700">
            <span className="h-2 w-2 rounded-full" style={{ background: CPA_COLOR }} />
            CPA: {points[hoverIndex].cpa !== null ? formatCurrency(points[hoverIndex].cpa as number) : "No purchases"}
          </div>
        </div>
      )}
    </div>
  );
}

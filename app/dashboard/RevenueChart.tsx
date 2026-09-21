"use client";

import { useMemo, useState } from "react";
import { formatCurrency } from "@/lib/format";

export type ChartPoint = { label: string; ghlRevenue: number; metaRevenue: number };

const WIDTH = 760;
const HEIGHT = 180;
const PAD_LEFT = 48;
const PAD_RIGHT = 16;
const PAD_TOP = 14;
const PAD_BOTTOM = 24;

// Colors validated with the dataviz skill's palette checker (indigo/pink,
// all six checks pass — lightness band, chroma floor, CVD separation at
// both protan and tritan, normal-vision floor, contrast vs. surface).
const GHL_COLOR = "#6366f1";
const META_COLOR = "#ec4899";

export default function RevenueChart({
  points,
  showMetaLine = true,
}: {
  points: ChartPoint[];
  showMetaLine?: boolean;
}) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const plotWidth = WIDTH - PAD_LEFT - PAD_RIGHT;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;

  const maxValue = useMemo(() => {
    const max = Math.max(1, ...points.map((p) => Math.max(p.ghlRevenue, showMetaLine ? p.metaRevenue : 0)));
    return max * 1.15;
  }, [points, showMetaLine]);

  const n = points.length;
  const x = (i: number) => PAD_LEFT + (n <= 1 ? plotWidth / 2 : (i / (n - 1)) * plotWidth);
  const y = (v: number) => PAD_TOP + plotHeight - (v / maxValue) * plotHeight;

  const ghlPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.ghlRevenue)}`).join(" ");
  const metaPath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${x(i)} ${y(p.metaRevenue)}`).join(" ");
  const ghlAreaPath = `${ghlPath} L ${x(n - 1)} ${y(0)} L ${x(0)} ${y(0)} Z`;

  const gridLines = 3;
  const labelStep = Math.max(1, Math.ceil(n / 7));

  if (n === 0) {
    return (
      <div className="flex h-[140px] items-center justify-center text-sm text-ink-400">
        No data in this range yet
      </div>
    );
  }

  return (
    <div className="relative">
      <svg
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        className="w-full"
        style={{ maxHeight: 220 }}
        onMouseLeave={() => setHoverIndex(null)}
      >
        <defs>
          <linearGradient id="ghlArea" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={GHL_COLOR} stopOpacity="0.22" />
            <stop offset="100%" stopColor={GHL_COLOR} stopOpacity="0" />
          </linearGradient>
        </defs>

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

        <path d={ghlAreaPath} fill="url(#ghlArea)" />
        <path d={ghlPath} fill="none" stroke={GHL_COLOR} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {showMetaLine && (
          <path d={metaPath} fill="none" stroke={META_COLOR} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 3" />
        )}

        {hoverIndex !== null && (
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
            <circle cx={x(hoverIndex)} cy={y(points[hoverIndex].ghlRevenue)} r="4" fill={GHL_COLOR} stroke="white" strokeWidth="2" />
            {showMetaLine && (
              <circle cx={x(hoverIndex)} cy={y(points[hoverIndex].metaRevenue)} r="4" fill={META_COLOR} stroke="white" strokeWidth="2" />
            )}
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
          style={{ left: `min(${(x(hoverIndex) / WIDTH) * 100}%, calc(100% - 150px))` }}
        >
          <div className="font-semibold text-ink-900">{points[hoverIndex].label}</div>
          <div className="mt-1 flex items-center gap-1.5 text-ink-700">
            <span className="h-2 w-2 rounded-full" style={{ background: GHL_COLOR }} />
            GHL: {formatCurrency(points[hoverIndex].ghlRevenue)}
          </div>
          {showMetaLine && (
            <div className="mt-0.5 flex items-center gap-1.5 text-ink-700">
              <span className="h-2 w-2 rounded-full" style={{ background: META_COLOR }} />
              Meta: {formatCurrency(points[hoverIndex].metaRevenue)}
            </div>
          )}
        </div>
      )}

      <div className="mt-2 flex items-center gap-4 text-xs text-ink-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-full" style={{ background: GHL_COLOR }} />
          GHL Revenue
        </span>
        {showMetaLine && (
          <span className="flex items-center gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full" style={{ background: META_COLOR }} />
            Meta Reported Revenue
          </span>
        )}
      </div>
    </div>
  );
}

"use client";

import React, { useMemo } from "react";
import { formatAQI, getAQIInfo } from "@/lib/aqi";

export interface AQIGaugeProps {
  value: number | null;
  category?: string;
  isLoading?: boolean;
  min?: number;
  max?: number;
  className?: string;
}

// CPCB standard breakpoint bands
const CPCB_BANDS = [
  { label: "Good",         min: 0,   max: 50,  color: "#3CCB8E" },
  { label: "Satisfactory", min: 50,  max: 100, color: "#A8D85A" },
  { label: "Moderate",     min: 100, max: 200, color: "#F3C969" },
  { label: "Poor",         min: 200, max: 300, color: "#F39A4A" },
  { label: "Very Poor",    min: 300, max: 400, color: "#F05B5B" },
  { label: "Severe",       min: 400, max: 500, color: "#B83B5E" },
];

const MAJOR_TICKS = [0, 50, 100, 150, 200, 250, 300, 350, 400, 450, 500];
const LABELED_TICKS = [0, 100, 200, 300, 400, 500];
const MINOR_TICKS = [25, 75, 125, 175, 225, 275, 325, 375, 425, 475];

// Geometry parameters
const CX = 160;
const CY = 160;
const R_TRACK = 126;
const R_TICK_OUTER = 114;
const R_TICK_MAJOR = 104;
const R_TICK_MINOR = 108;
const R_LABEL = 94;
const R_INNER_RING = 66;
const R_CENTER_PLATE = 62;

const SWEEP_ANGLE = 240; // Total sweep in degrees
const START_ANGLE = -120; // 0 AQI position (approx 8 o'clock)

function aqiToAngle(aqi: number): number {
  const clamped = Math.min(Math.max(aqi, 0), 500);
  return START_ANGLE + (clamped / 500) * SWEEP_ANGLE;
}

function polarToCartesian(cx: number, cy: number, r: number, angleDegrees: number) {
  const rad = (angleDegrees * Math.PI) / 180;
  return {
    x: cx + r * Math.sin(rad),
    y: cy - r * Math.cos(rad),
  };
}

function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
  const start = polarToCartesian(cx, cy, r, startAngle);
  const end = polarToCartesian(cx, cy, r, endAngle);
  const delta = endAngle - startAngle;
  const largeArcFlag = delta <= 180 ? "0" : "1";
  return `M ${start.x.toFixed(2)} ${start.y.toFixed(2)} A ${r} ${r} 0 ${largeArcFlag} 1 ${end.x.toFixed(2)} ${end.y.toFixed(2)}`;
}

export function AQIGauge({
  value,
  category,
  isLoading = false,
  className = "",
}: AQIGaugeProps) {
  const aqi = value ?? 0;
  const info = useMemo(() => getAQIInfo(aqi), [aqi]);
  const activeCategory = category ?? (value != null ? info.category : undefined);
  const currentAngle = aqiToAngle(aqi);

  // Active outer indicator coordinate
  const outerMarkerPos = useMemo(() => {
    return polarToCartesian(CX, CY, R_TRACK + 7, currentAngle);
  }, [currentAngle]);

  const displayAqiStr = value != null ? formatAQI(aqi) : "—";
  const displayCategoryStr = value != null ? (activeCategory ?? info.category) : "STANDBY";

  return (
    <div
      className={`relative flex flex-col items-center justify-center select-none ${className}`}
      role="region"
      aria-label={`Current AQI measurement: ${value != null ? Math.round(value) : "unavailable"} (${activeCategory ?? "N/A"}), on 0 to 500 scale`}
    >
      {/* ── Top Scale Telemetry Header ── */}
      <div className="w-full flex items-center justify-between text-[10px] font-mono text-[#64717E] mb-1 px-2">
        <div className="flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full" style={{ backgroundColor: value != null ? info.color : "#35D0C5" }} />
          <span className="uppercase tracking-widest text-[#9AA7B4] font-semibold">
            Index Dial
          </span>
        </div>
        <span className="text-[#35D0C5] tracking-wider font-semibold">
          0–500 SCALE
        </span>
      </div>

      {/* ── Precision SVG Instrument ── */}
      <div className="relative w-full max-w-[280px] sm:max-w-[320px] aspect-square flex items-center justify-center">
        <svg
          viewBox="0 0 320 320"
          className="w-full h-full overflow-visible"
        >
          <defs>
            {/* Subtle atmospheric glow filter */}
            <filter id="gaugeGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="3" result="blur" />
              <feComposite in="SourceGraphic" in2="blur" operator="over" />
            </filter>

            {/* Needle gradient */}
            <linearGradient id="needleGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={value != null ? info.color : "#35D0C5"} />
              <stop offset="100%" stopColor="#18212B" />
            </linearGradient>
          </defs>

          {/* ── 1. Inactive Background Track ── */}
          <path
            d={describeArc(CX, CY, R_TRACK, START_ANGLE, START_ANGLE + SWEEP_ANGLE)}
            fill="none"
            stroke="#18212B"
            strokeWidth="8"
            strokeLinecap="round"
          />

          {/* ── 2. Calibrated 6-Sector CPCB Color Bands ── */}
          {CPCB_BANDS.map((b) => {
            const segStart = aqiToAngle(b.min);
            const segEnd = aqiToAngle(b.max);
            // Subtle 1-degree gap between sectors for precision instrument look
            const bandArc = describeArc(CX, CY, R_TRACK, segStart + 0.8, segEnd - 0.8);
            const isCurrentBand = value != null && aqi >= b.min && (b.max === 500 ? aqi >= 400 : aqi < b.max);

            return (
              <g key={b.label}>
                <path
                  d={bandArc}
                  fill="none"
                  stroke={b.color}
                  strokeWidth={isCurrentBand ? 10 : 7}
                  strokeLinecap="round"
                  opacity={value != null ? (isCurrentBand ? 1.0 : 0.35) : 0.25}
                  className="transition-all duration-300"
                />
              </g>
            );
          })}

          {/* ── 3. Radial Calibrated Ticks ── */}
          {/* Minor Ticks */}
          {MINOR_TICKS.map((tickVal) => {
            const angle = aqiToAngle(tickVal);
            const p1 = polarToCartesian(CX, CY, R_TICK_OUTER, angle);
            const p2 = polarToCartesian(CX, CY, R_TICK_MINOR, angle);
            return (
              <line
                key={`minor-${tickVal}`}
                x1={p1.x.toFixed(2)}
                y1={p1.y.toFixed(2)}
                x2={p2.x.toFixed(2)}
                y2={p2.y.toFixed(2)}
                stroke="#26313D"
                strokeWidth="1"
              />
            );
          })}

          {/* Major Ticks */}
          {MAJOR_TICKS.map((tickVal) => {
            const angle = aqiToAngle(tickVal);
            const p1 = polarToCartesian(CX, CY, R_TICK_OUTER, angle);
            const p2 = polarToCartesian(CX, CY, R_TICK_MAJOR, angle);
            const isMilestone = tickVal % 100 === 0;
            return (
              <line
                key={`major-${tickVal}`}
                x1={p1.x.toFixed(2)}
                y1={p1.y.toFixed(2)}
                x2={p2.x.toFixed(2)}
                y2={p2.y.toFixed(2)}
                stroke={isMilestone ? "#64717E" : "#3B4754"}
                strokeWidth={isMilestone ? "1.5" : "1"}
              />
            );
          })}

          {/* Numerical Scale Labels (0, 100, 200, 300, 400, 500) - Positioned safely outside central zone */}
          {LABELED_TICKS.map((tickVal) => {
            const angle = aqiToAngle(tickVal);
            const p = polarToCartesian(CX, CY, R_LABEL, angle);
            return (
              <text
                key={`label-${tickVal}`}
                x={p.x.toFixed(2)}
                y={p.y.toFixed(2)}
                fill="#64717E"
                fontSize="8.5"
                fontFamily="var(--font-google-sans), sans-serif"
                fontWeight="500"
                textAnchor="middle"
                dominantBaseline="central"
              >
                {tickVal}
              </text>
            );
          })}

          {/* ── 4. Precision Instrument Needle (Rotates under center plate) ── */}
          <g
            style={{
              transform: `rotate(${currentAngle}deg)`,
              transformOrigin: `${CX}px ${CY}px`,
              transition: "transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {/* Tapered Pointer Body */}
            <path
              d={`M ${CX - 2} ${CY} L ${CX - 0.75} ${CY - 96} L ${CX} ${CY - 106} L ${CX + 0.75} ${CY - 96} L ${CX + 2} ${CY} Z`}
              fill={value != null ? info.color : "#35D0C5"}
              opacity={0.85}
            />

            {/* Glowing Pointer Tip */}
            <circle
              cx={CX}
              cy={CY - 106}
              r="2"
              fill="#FFFFFF"
            />
          </g>

          {/* ── 5. Inner Precision Dotted Ring ── */}
          <circle
            cx={CX}
            cy={CY}
            r={R_INNER_RING}
            fill="none"
            stroke="#26313D"
            strokeWidth="1"
            strokeDasharray="2 3"
          />

          {/* ── 6. Protected Center Instrument Plate ── */}
          <circle
            cx={CX}
            cy={CY}
            r={R_CENTER_PLATE}
            fill="#0E141B"
            stroke="#202A34"
            strokeWidth="1.5"
          />

          {/* ── 7. Active Outer Position Pip Marker ── */}
          {value != null && (
            <g className="transition-transform duration-500 ease-out">
              <circle
                cx={outerMarkerPos.x.toFixed(2)}
                cy={outerMarkerPos.y.toFixed(2)}
                r="3.5"
                fill={info.color}
                filter="url(#gaugeGlow)"
              />
              <circle
                cx={outerMarkerPos.x.toFixed(2)}
                cy={outerMarkerPos.y.toFixed(2)}
                r="1.5"
                fill="#FFFFFF"
              />
            </g>
          )}

          {/* ── 8. Dedicated Center Information Stack (Clearly Separated SVG Text) ── */}
          {/* A. Top: AQI Micro-label */}
          <text
            x={CX}
            y={122}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#64717E"
            fontSize="9"
            fontFamily="var(--font-google-sans), sans-serif"
            fontWeight="600"
            letterSpacing="0.1em"
          >
            AQI
          </text>

          {/* B. Center: Large Dominant AQI Numeric Value (Font Style Preserved) */}
          <text
            x={CX}
            y={154}
            textAnchor="middle"
            dominantBaseline="central"
            fill={value != null ? info.color : "#47535E"}
            fontSize="32"
            fontFamily="var(--font-mono), monospace"
            fontWeight="700"
            letterSpacing="-0.03em"
            className="transition-all duration-300 font-preserved-value"
          >
            {isLoading ? "…" : displayAqiStr}
          </text>

          {/* C. Category Badge Plate & Label */}
          <rect
            x={CX - 36}
            y={172}
            width="72"
            height="15"
            rx="3"
            fill={value != null ? `${info.color}18` : "#18212B"}
            stroke={value != null ? `${info.color}44` : "#26313D"}
            strokeWidth="1"
          />
          <text
            x={CX}
            y={179.5}
            textAnchor="middle"
            dominantBaseline="central"
            fill={value != null ? info.color : "#64717E"}
            fontSize="8.5"
            fontFamily="var(--font-google-sans), sans-serif"
            fontWeight="700"
            letterSpacing="0.05em"
          >
            {displayCategoryStr}
          </text>

          {/* D. Bottom: CPCB Metadata */}
          <text
            x={CX}
            y={198}
            textAnchor="middle"
            dominantBaseline="central"
            fill="#47535E"
            fontSize="7.5"
            fontFamily="var(--font-google-sans), sans-serif"
            fontWeight="500"
            letterSpacing="0.06em"
          >
            CPCB SUB-INDEX
          </text>
        </svg>
      </div>

      {/* ── Bottom Scale Boundaries ── */}
      <div className="w-full flex justify-between text-[10px] font-mono text-[#64717E] px-4 -mt-2">
        <span className="flex items-center gap-1">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3CCB8E]" />
          <span>0 Good</span>
        </span>
        <span className="flex items-center gap-1">
          <span>500 Severe</span>
          <span className="w-1.5 h-1.5 rounded-full bg-[#B83B5E]" />
        </span>
      </div>
    </div>
  );
}

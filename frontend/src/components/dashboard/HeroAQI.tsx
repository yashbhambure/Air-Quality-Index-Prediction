"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useMemo, useRef, useState } from "react";
import { formatAQI, getAQIInfo } from "@/lib/aqi";
import { AQIGauge } from "@/components/dashboard/AQIGauge";
import type { PredictionResult } from "@/types/aqi";

interface HeroAQIProps {
  result: PredictionResult | null;
  isLoading?: boolean;
}

// CPCB standard breakpoint bands
const CPCB_BANDS = [
  { label: "Good",         range: "0–50",    min: 0,   max: 50,  color: "#3CCB8E" },
  { label: "Satisfactory", range: "51–100",  min: 50,  max: 100, color: "#A8D85A" },
  { label: "Moderate",     range: "101–200", min: 100, max: 200, color: "#F3C969" },
  { label: "Poor",         range: "201–300", min: 200, max: 300, color: "#F39A4A" },
  { label: "Very Poor",    range: "301–400", min: 300, max: 400, color: "#F05B5B" },
  { label: "Severe",       range: "401–500", min: 400, max: 500, color: "#B83B5E" },
];

const MAX_TRACE_POINTS = 20;

export function HeroAQI({ result, isLoading }: HeroAQIProps) {
  const aqi = result?.aqi ?? 0;
  const info = useMemo(() => getAQIInfo(aqi), [aqi]);

  // Session-local trace history of readings (only real computed results)
  const [trace, setTrace] = useState<{ time: string; aqi: number; category: string }[]>([]);
  const lastAqiRef = useRef<number | null>(null);

  useEffect(() => {
    if (result && result.aqi !== lastAqiRef.current) {
      lastAqiRef.current = result.aqi;
      const nowStr = new Date().toLocaleTimeString("en-IN", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      });
      setTrace((prev) => [
        ...prev.slice(-(MAX_TRACE_POINTS - 1)),
        { time: nowStr, aqi: Math.round(result.aqi), category: result.category },
      ]);
    }
  }, [result]);

  const timestamp = useMemo(() => {
    return new Date().toLocaleTimeString("en-IN", {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  }, [aqi]);

  // Compute min, max, avg for session trace
  const traceStats = useMemo(() => {
    if (trace.length === 0) return null;
    const values = trace.map((t) => t.aqi);
    return {
      min: Math.min(...values),
      max: Math.max(...values),
      avg: Math.round(values.reduce((a, b) => a + b, 0) / values.length),
      count: values.length,
    };
  }, [trace]);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border transition-all duration-300"
      style={{
        backgroundColor: "#151C24",
        borderColor: "#26313D",
      }}
    >
      {/* Top telemetry bar */}
      <div
        className="flex flex-wrap items-center justify-between px-5 py-3 border-b text-xs font-mono"
        style={{
          borderColor: "#202A34",
          backgroundColor: "#10161D",
        }}
      >
        <div className="flex items-center gap-2.5">
          <span className="w-2 h-2 rounded-full" style={{ backgroundColor: result ? info.color : "#35D0C5" }} />
          <span className="tracking-wider uppercase font-semibold text-[#CBD5E1] text-[11px]">
            Atmospheric Intelligence · CPCB Standard
          </span>
        </div>
        <div className="flex items-center gap-4 text-[11px] text-[#94A3B8]">
          <span>Pipeline: <strong className="text-[#FFFFFF] font-normal">PCA + Random Forest</strong></span>
          <span className="hidden sm:inline">
            Status: <strong className="text-[#3CCB8E] font-normal">● Inferred</strong>
          </span>
          <span className="hidden md:inline">
            {result ? `Updated ${timestamp}` : "Awaiting Input"}
          </span>
        </div>
      </div>

      {/* Main Command Center Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-0">
        {/* ── Left Column: Primary AQI Verdict (Col 1-4) ── */}
        <div
          className="lg:col-span-4 p-6 sm:p-7 flex flex-col justify-between border-b lg:border-b-0 lg:border-r"
          style={{ borderColor: "#202A34" }}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#94A3B8] font-semibold">
                Current Air Quality
              </span>
              {result && (
                <span
                  className="px-2.5 py-0.5 rounded-md text-[10px] font-mono font-semibold border"
                  style={{
                    color: info.color,
                    borderColor: `${info.color}40`,
                    backgroundColor: `${info.color}15`,
                  }}
                >
                  {result.category}
                </span>
              )}
            </div>

            {/* Giant Typographic Readout */}
            <div className="min-h-[96px] flex items-baseline gap-3 my-2">
              <AnimatePresence mode="wait">
                {isLoading ? (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="skeleton h-24 w-44 rounded-xl"
                  />
                ) : result ? (
                  <motion.div
                    key={Math.round(aqi)}
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, ease: "easeOut" }}
                    className="flex items-baseline gap-3"
                  >
                    <span
                      className="font-preserved-value font-bold text-7xl sm:text-8xl leading-none tabular-nums tracking-tight"
                      style={{ color: info.color }}
                    >
                      {formatAQI(aqi)}
                    </span>
                    <span className="text-sm font-mono text-[#94A3B8] uppercase tracking-wider font-semibold">
                      AQI
                    </span>
                  </motion.div>
                ) : (
                  <div className="flex items-baseline gap-3 text-[#94A3B8]">
                    <span className="font-preserved-value font-bold text-7xl sm:text-8xl leading-none tabular-nums text-[#8292A1]">
                      —
                    </span>
                    <span className="text-xs font-mono text-[#94A3B8] uppercase font-semibold">
                      Ready
                    </span>
                  </div>
                )}
              </AnimatePresence>
            </div>

            {/* Health Advisory & Clinical Protocol */}
            <div
              className="mt-3.5 p-3 rounded-xl border flex items-start gap-2.5 transition-colors"
              style={{
                backgroundColor: result ? `${info.color}10` : "#121820",
                borderColor: result ? `${info.color}30` : "#202A34",
              }}
            >
              <div
                className="mt-0.5 w-5 h-5 rounded-md flex items-center justify-center shrink-0 text-xs border"
                style={{
                  backgroundColor: result ? `${info.color}20` : "#18212B",
                  borderColor: result ? `${info.color}45` : "#26313D",
                  color: result ? info.color : "#94A3B8",
                }}
              >
                {result ? (info.severity >= 4 ? "🚨" : info.severity >= 2 ? "⚠" : "🛡") : "ℹ"}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-1">
                  <span
                    className="text-[10px] font-mono font-semibold uppercase tracking-wider"
                    style={{ color: result ? info.color : "#94A3B8" }}
                  >
                    {result ? `${info.category} Advisory Protocol` : "Health Guidance Protocol"}
                  </span>
                </div>
                <p className="text-xs text-[#CBD5E1] leading-relaxed">
                  {result
                    ? info.advice
                    : "Adjust pollutant parameters below to project the atmospheric index using PCA and Random Forest."}
                </p>
              </div>
            </div>
          </div>

          {/* Severity Range Bar */}
          <div className="mt-6 pt-4 border-t" style={{ borderColor: "#202A34" }}>
            <div className="flex items-center justify-between text-[11px] font-mono text-[#94A3B8] mb-1.5 font-medium">
              <span>0 (Pristine)</span>
              <span>250 (Moderate)</span>
              <span>500 (Severe)</span>
            </div>
            <div className="h-1.5 w-full rounded-full bg-[#10161D] overflow-hidden flex gap-0.5">
              {CPCB_BANDS.map((band) => (
                <div
                  key={band.label}
                  className="h-full flex-1 transition-opacity duration-300"
                  style={{
                    backgroundColor: band.color,
                    opacity: result && aqi >= band.min && (band.max === 500 ? aqi >= 400 : aqi < band.max) ? 1 : 0.25,
                  }}
                  title={`${band.label} (${band.range})`}
                />
              ))}
            </div>
          </div>
        </div>

        {/* ── Center Column: Circular Calibrated AQI Instrument (Col 5-7) ── */}
        <div
          className="lg:col-span-3 p-5 sm:p-6 flex flex-col items-center justify-center border-b lg:border-b-0 lg:border-r"
          style={{ borderColor: "#202A34", backgroundColor: "#121820" }}
        >
          <AQIGauge
            value={result ? aqi : null}
            category={result?.category}
            isLoading={isLoading}
            className="w-full"
          />
        </div>

        {/* ── Right Column: Live Session AQI Trace Chart (Col 8-12) ── */}
        <div className="lg:col-span-5 p-6 sm:p-7 flex flex-col justify-between" style={{ backgroundColor: "#151C24" }}>
          <div className="flex items-center justify-between mb-3">
            <div>
              <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#FFFFFF]">
                AQI Trend
              </h3>
              <p className="text-[11px] font-mono text-[#94A3B8]">
                Session Inference Trace ({trace.length} {trace.length === 1 ? "point" : "points"})
              </p>
            </div>
            {traceStats && (
              <div className="flex items-center gap-3 text-[11px] font-mono bg-[#10161D] px-2.5 py-1 rounded-md border border-[#202A34]">
                <span className="text-[#94A3B8]">Min: <strong className="text-[#3CCB8E] font-medium">{traceStats.min}</strong></span>
                <span className="text-[#94A3B8]">Avg: <strong className="text-[#FFFFFF] font-medium">{traceStats.avg}</strong></span>
                <span className="text-[#94A3B8]">Max: <strong className="text-[#F05B5B] font-medium">{traceStats.max}</strong></span>
              </div>
            )}
          </div>

          {/* Chart Area */}
          <div className="relative h-36 w-full flex items-end">
            {trace.length === 0 ? (
              <div className="w-full h-full flex flex-col items-center justify-center border border-dashed border-[#26313D] rounded-xl text-center p-4">
                <span className="text-xs font-mono text-[#CBD5E1] font-medium">No session trace points yet</span>
                <span className="text-[11px] font-mono text-[#94A3B8] mt-1">Compute AQI below to plot chronological readings</span>
              </div>
            ) : (
              <div className="w-full h-full relative">
                {/* SVG Line Trace */}
                <svg viewBox="0 0 400 120" preserveAspectRatio="none" className="w-full h-full overflow-visible">
                  <defs>
                    <linearGradient id="traceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#35D0C5" stopOpacity="0.25" />
                      <stop offset="100%" stopColor="#35D0C5" stopOpacity="0.0" />
                    </linearGradient>
                  </defs>

                  {/* Grid Lines */}
                  <line x1="0" y1="24" x2="400" y2="24" stroke="#202A34" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="0" y1="60" x2="400" y2="60" stroke="#202A34" strokeDasharray="3 3" strokeWidth="1" />
                  <line x1="0" y1="96" x2="400" y2="96" stroke="#202A34" strokeDasharray="3 3" strokeWidth="1" />

                  {/* Polyline Path */}
                  {(() => {
                    const step = trace.length > 1 ? 400 / (trace.length - 1) : 400;
                    const coords = trace.map((t, idx) => {
                      const x = trace.length === 1 ? 200 : idx * step;
                      const y = 110 - (Math.min(t.aqi, 500) / 500) * 100;
                      return { x, y, ...t };
                    });

                    const pathStr = coords.map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`).join(" ");
                    const areaStr = `${pathStr} L ${coords[coords.length - 1].x.toFixed(1)} 120 L ${coords[0].x.toFixed(1)} 120 Z`;

                    return (
                      <>
                        <path d={areaStr} fill="url(#traceGrad)" />
                        <path d={pathStr} fill="none" stroke="#35D0C5" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        {coords.map((c, i) => {
                          const isLast = i === coords.length - 1;
                          const ptColor = getAQIInfo(c.aqi).color;
                          return (
                            <g key={i}>
                              <circle
                                cx={c.x}
                                cy={c.y}
                                r={isLast ? 4 : 2.5}
                                fill={ptColor}
                                stroke="#0B0F14"
                                strokeWidth="1.5"
                              />
                            </g>
                          );
                        })}
                      </>
                    );
                  })()}
                </svg>
              </div>
            )}
          </div>

          {/* Trace Legend / Scale */}
          <div className="flex items-center justify-between text-[11px] font-mono text-[#94A3B8] mt-3 pt-2 border-t border-[#202A34]">
            <span>Baseline 0</span>
            <span>Scale: 0–500 AQI</span>
            <span>Latest: <strong className="text-[#FFFFFF] font-mono">{trace.length > 0 ? trace[trace.length - 1].aqi : "—"}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}


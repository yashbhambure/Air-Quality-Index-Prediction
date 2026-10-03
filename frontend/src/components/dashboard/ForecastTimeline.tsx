"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useState, useMemo } from "react";
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from "recharts";
import { getAQIInfo } from "@/lib/aqi";
import type { PredictionResult } from "@/types/aqi";

interface ForecastTimelineProps {
  latestResult: PredictionResult | null;
}

type Horizon = "24h" | "7d";

function generateForecast(baseAqi: number, horizon: Horizon) {
  const isDay = horizon === "24h";
  const points = isDay ? 24 : 7;
  const noise = isDay ? 0.08 : 0.15;

  const data: { label: string; aqi: number; lower: number; upper: number }[] = [];
  let prev = baseAqi;

  for (let i = 0; i < points; i++) {
    const drift = (Math.random() - 0.48) * baseAqi * noise;
    const val = Math.min(Math.max(prev + drift, 5), 500);
    prev = val;

    const label = isDay
      ? `${String(i).padStart(2, "0")}:00`
      : ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][i % 7];

    data.push({
      label,
      aqi: parseFloat(val.toFixed(1)),
      lower: parseFloat(Math.max(val * 0.9, 1).toFixed(1)),
      upper: parseFloat(Math.min(val * 1.1, 500).toFixed(1)),
    });
  }
  return data;
}

export function ForecastTimeline({ latestResult }: ForecastTimelineProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [horizon, setHorizon] = useState<Horizon>("24h");

  const forecastData = useMemo(() => {
    if (!latestResult) return [];
    return generateForecast(latestResult.aqi, horizon);
  }, [latestResult, horizon]);

  const info = latestResult ? getAQIInfo(latestResult.aqi) : null;

  return (
    <div className="rounded-2xl border border-[#26313D] bg-[#151C24] overflow-hidden transition-all duration-300">
      {/* ── Collapsible Header Toggle ── */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full px-5 py-4 flex items-center justify-between hover:bg-[#18212B] transition-colors text-left"
        aria-expanded={isOpen}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-2 h-2 rounded-full bg-[#35D0C5]" />
          <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#FFFFFF]">
            Temporal Simulation Lookahead
          </h3>
          <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-[#10161D] border border-[#202A34] text-[#35D0C5] font-semibold">
            Statistical Projection
          </span>
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs font-mono text-[#CBD5E1] font-medium">
            {isOpen ? "Hide Projection" : "Expand Projection"}
          </span>
          <motion.span
            animate={{ rotate: isOpen ? 180 : 0 }}
            transition={{ duration: 0.2 }}
            className="text-[#CBD5E1] text-xs font-mono"
          >
            ▼
          </motion.span>
        </div>
      </button>

      {/* ── Collapsible Content ── */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
          >
            <div className="p-5 pt-2 flex flex-col gap-4 border-t border-[#202A34]">
              {/* Disclaimer */}
              <div className="p-3 rounded-lg bg-[#10161D] border border-[#202A34] text-[11px] font-mono text-[#CBD5E1] flex items-center justify-between">
                <span>Synthetic temporal projection anchored on current Random Forest baseline ({latestResult ? Math.round(latestResult.aqi) : "—"} AQI).</span>
                <div className="flex items-center gap-1.5 ml-4">
                  <button
                    type="button"
                    onClick={() => setHorizon("24h")}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors font-medium ${
                      horizon === "24h"
                        ? "bg-[#18212B] text-[#35D0C5] border border-[#26313D]"
                        : "text-[#94A3B8] hover:text-[#FFFFFF]"
                    }`}
                  >
                    24-Hour Horizon
                  </button>
                  <button
                    type="button"
                    onClick={() => setHorizon("7d")}
                    className={`px-2.5 py-1 rounded text-[10px] font-mono transition-colors font-medium ${
                      horizon === "7d"
                        ? "bg-[#18212B] text-[#35D0C5] border border-[#26313D]"
                        : "text-[#94A3B8] hover:text-[#FFFFFF]"
                    }`}
                  >
                    7-Day Horizon
                  </button>
                </div>
              </div>

              {/* Chart */}
              {!latestResult ? (
                <div className="h-48 flex items-center justify-center border border-dashed border-[#26313D] rounded-xl text-center">
                  <p className="text-xs font-mono text-[#94A3B8]">
                    Compute a baseline prediction first to project future temporal envelope.
                  </p>
                </div>
              ) : (
                <div className="h-56 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={forecastData} margin={{ top: 10, right: 16, left: -16, bottom: 0 }}>
                      <defs>
                        <linearGradient id="forecastFill" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={info?.color ?? "#35D0C5"} stopOpacity={0.3} />
                          <stop offset="95%" stopColor={info?.color ?? "#35D0C5"} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="#202A34" />
                      <XAxis dataKey="label" tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "var(--font-google-sans)" }} />
                      <YAxis domain={[0, 500]} tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "var(--font-google-sans)" }} />
                      <Tooltip
                        contentStyle={{ backgroundColor: "#18212B", borderColor: "#26313D", borderRadius: "6px", color: "#FFFFFF", fontFamily: "var(--font-google-sans)", fontSize: "11px" }}
                        formatter={(val: any) => [`${val} AQI`, "Projected"]}
                      />
                      <Area
                        type="monotone"
                        dataKey="aqi"
                        stroke={info?.color ?? "#35D0C5"}
                        strokeWidth={2}
                        fillOpacity={1}
                        fill="url(#forecastFill)"
                      />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

"use client";

import { motion } from "framer-motion";
import { useHistory } from "@/hooks/useHistory";
import { getAQIInfo } from "@/lib/aqi";

interface PollutantMeta {
  key: "PM2.5" | "PM10" | "CO" | "NO2";
  unit: string;
}

const POLLUTANTS: PollutantMeta[] = [
  { key: "PM2.5", unit: "µg/m³" },
  { key: "PM10", unit: "µg/m³" },
  { key: "CO", unit: "mg/m³" },
  { key: "NO2", unit: "µg/m³" },
];

function formatDate(iso: string) {
  try {
    return new Intl.DateTimeFormat("en-IN", {
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

// Balanced 7-Column CSS Grid Template:
// 1. Timestamp (1.4fr, min 135px)
// 2. Predicted AQI (1fr, min 95px, Centered)
// 3. CPCB Tier (1.1fr, min 105px, Centered)
// 4-7. PM2.5, PM10, CO, NO2 (4 equally spaced 1fr columns, min 75px each, Right-aligned)
const GRID_TEMPLATE =
  "grid-cols-[minmax(135px,1.4fr)_minmax(95px,1fr)_minmax(105px,1.1fr)_repeat(4,minmax(75px,1fr))]";

export function HistoryTable() {
  const { data, isLoading, error } = useHistory(10);

  if (isLoading) {
    return (
      <div className="w-full rounded-xl border border-[#26313D] bg-[#10161D]/70 p-4 flex flex-col gap-2.5 font-['Google_Sans',sans-serif]">
        <div className="skeleton h-8 w-full rounded-lg" />
        {[1, 2, 3, 4, 5].map((i) => (
          <div key={i} className="skeleton h-10 w-full rounded-lg" />
        ))}
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-8 text-center border border-dashed border-[#26313D] rounded-xl bg-[#10161D] font-['Google_Sans',sans-serif]">
        <div className="w-8 h-8 rounded-full bg-[#F05B5B]/15 text-[#F05B5B] flex items-center justify-center mx-auto mb-2 text-sm font-semibold">
          !
        </div>
        <p className="text-xs text-[#F05B5B] font-medium font-['Google_Sans',sans-serif]">
          Could not fetch prediction history from SQLite store.
        </p>
        <p className="text-[11px] text-[#94A3B8] mt-1 font-['Google_Sans',sans-serif]">
          Ensure Flask backend is active with history database verified.
        </p>
      </div>
    );
  }

  if (!data || data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-10 px-4 border border-dashed border-[#26313D] rounded-xl text-center bg-[#10161D] font-['Google_Sans',sans-serif]">
        <div className="w-8 h-8 rounded-full bg-[#35D0C5]/10 text-[#35D0C5] flex items-center justify-center mb-2 text-sm font-semibold">
          📋
        </div>
        <p className="text-xs text-[#CBD5E1] font-medium font-['Google_Sans',sans-serif]">
          No prediction logs recorded yet.
        </p>
        <p className="text-[11px] text-[#94A3B8] mt-1 font-['Google_Sans',sans-serif]">
          Calculate an AQI prediction above to automatically log observation snapshots.
        </p>
      </div>
    );
  }

  return (
    <div
      className="w-full rounded-xl border border-[#26313D] bg-[#10161D]/70 overflow-hidden shadow-xl font-['Google_Sans',sans-serif]"
      role="table"
      aria-label="Prediction history ledger"
    >
      <div className="overflow-x-auto no-scrollbar font-['Google_Sans',sans-serif]">
        <div className="w-full min-w-[640px] font-['Google_Sans',sans-serif]">
          {/* ── Table Header Bar (100% Width CSS Grid) ── */}
          <div
            className={`grid ${GRID_TEMPLATE} items-center px-4 py-3 bg-[#131A22] border-b border-[#26313D] text-[#CBD5E1] text-[11px] uppercase tracking-wider font-semibold font-['Google_Sans',sans-serif]`}
            role="row"
          >
            {/* Timestamp */}
            <div className="text-left flex items-center gap-1.5 font-['Google_Sans',sans-serif]" role="columnheader">
              <span>Timestamp</span>
            </div>

            {/* Predicted AQI */}
            <div className="text-center font-['Google_Sans',sans-serif]" role="columnheader">
              Predicted AQI
            </div>

            {/* CPCB Tier */}
            <div className="text-center font-['Google_Sans',sans-serif]" role="columnheader">
              CPCB Tier
            </div>

            {/* 4 Balanced Pollutant Metrics with Units */}
            {POLLUTANTS.map(({ key, unit }) => (
              <div
                key={key}
                className="text-right flex flex-col items-end font-['Google_Sans',sans-serif]"
                role="columnheader"
              >
                <span>{key}</span>
                <span className="text-[9px] text-[#8292A1] normal-case tracking-normal font-normal">
                  {unit}
                </span>
              </div>
            ))}
          </div>

          {/* ── Table Body Rows (Alternating Shading & Interactive Hover) ── */}
          <div className="divide-y divide-[#202A34]/60 font-['Google_Sans',sans-serif]" role="rowgroup">
            {data.map((record, i) => {
              const info = getAQIInfo(record.result.aqi);
              return (
                <motion.div
                  key={`${record.timestamp}-${i}`}
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.02, duration: 0.2 }}
                  className={`grid ${GRID_TEMPLATE} items-center px-4 py-3 ${
                    i % 2 === 0 ? "bg-transparent" : "bg-[#141C24]/30"
                  } hover:bg-[#18232F] transition-colors font-['Google_Sans',sans-serif]`}
                  role="row"
                >
                  {/* Timestamp (Left-aligned, tabular-nums) */}
                  <div
                    className="text-left text-[#CBD5E1] whitespace-nowrap text-xs tabular-nums font-['Google_Sans',sans-serif]"
                    role="cell"
                  >
                    {formatDate(record.timestamp)}
                  </div>

                  {/* Predicted AQI (Center-aligned, colored badge, tabular-nums) */}
                  <div className="flex items-center justify-center font-['Google_Sans',sans-serif]" role="cell">
                    <span
                      className="px-2.5 py-0.5 rounded-md font-bold text-xs tabular-nums border font-['Google_Sans',sans-serif]"
                      style={{
                        color: info.color,
                        backgroundColor: `${info.color}15`,
                        borderColor: `${info.color}35`,
                      }}
                    >
                      {Math.round(record.result.aqi)}
                    </span>
                  </div>

                  {/* CPCB Tier Badge (Center-aligned) */}
                  <div className="flex items-center justify-center font-['Google_Sans',sans-serif]" role="cell">
                    <span
                      className="px-2.5 py-0.5 rounded-full text-[11px] font-medium border font-['Google_Sans',sans-serif]"
                      style={{
                        color: info.color,
                        borderColor: `${info.color}40`,
                        backgroundColor: `${info.color}15`,
                      }}
                    >
                      {record.result.category}
                    </span>
                  </div>

                  {/* 4 Balanced Pollutant Values (Right-aligned, tabular-nums) */}
                  {POLLUTANTS.map(({ key }) => (
                    <div
                      key={key}
                      className="text-right text-[#F2F5F7] font-medium tabular-nums text-xs font-['Google_Sans',sans-serif]"
                      role="cell"
                    >
                      {(record.inputs as unknown as Record<string, number>)[key]?.toFixed(1) ?? "—"}
                    </div>
                  ))}
                </motion.div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Table Footer Status Bar (Eliminates underfit floating void) ── */}
      <div className="px-4 py-2.5 bg-[#121921] border-t border-[#26313D] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#8292A1] font-['Google_Sans',sans-serif]">
        <div className="flex items-center gap-2">
          <span className="w-1.5 h-1.5 rounded-full bg-[#3CCB8E] animate-pulse" />
          <span>Real-time SQLite Persistent Ledger</span>
        </div>
        <span className="tabular-nums">
          Showing latest {data.length} recorded {data.length === 1 ? "entry" : "entries"}
        </span>
      </div>
    </div>
  );
}

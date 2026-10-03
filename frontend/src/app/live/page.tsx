"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import Image from "next/image";
import { motion, AnimatePresence } from "framer-motion";
import { useLiveCity } from "@/hooks/useLiveCity";
import { useMetrics } from "@/hooks/useMetrics";
import { BatchUploadModal } from "@/components/dashboard/BatchUploadModal";
import { ParticleField } from "@/components/ParticleField";
import { InfiniteGrid } from "@/components/effects/InfiniteGrid";
import { FEATURE_SPECS } from "@/lib/constants";
import { getAQIInfo } from "@/lib/aqi";

const QUICK_CITIES = [
  "Delhi",
  "Mumbai",
  "Bengaluru",
  "Hyderabad",
  "Kolkata",
  "Chennai",
  "Pune",
  "Ahmedabad",
  "Jaipur",
  "Lucknow",
];

export default function LiveAQIPage() {
  const [selectedCity, setSelectedCity] = useState("Delhi");
  const [inputCity, setInputCity] = useState("");
  const [isBatchOpen, setIsBatchOpen] = useState(false);

  const { data, isLoading, isError, error, refetch, isFetching } = useLiveCity(selectedCity);
  const { isLoading: metricsLoading, isError: metricsError, data: metricsData } = useMetrics();

  const apiStatus: "connecting" | "connected" | "offline" =
    metricsLoading ? "connecting" : metricsError ? "offline" : metricsData ? "connected" : "connecting";

  const statusColor: Record<typeof apiStatus, string> = {
    connecting: "#F3C969",
    connected:  "#3CCB8E",
    offline:    "#F05B5B",
  };
  const statusLabel: Record<typeof apiStatus, string> = {
    connecting: "Connecting…",
    connected:  "Connected",
    offline:    "Flask Offline",
  };

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    if (inputCity.trim()) {
      setSelectedCity(inputCity.trim());
      setInputCity("");
    }
  };

  // Prediction display formatting
  const predInfo = data ? getAQIInfo(data.predicted_aqi) : null;
  const waqiInfo = data?.live_aqi_reported ? getAQIInfo(data.live_aqi_reported) : null;

  // Derive severity for particulate background
  const particleInfo = useMemo(() => {
    if (!data) return { severity: null, color: null };
    const info = getAQIInfo(data.predicted_aqi);
    return { severity: info.severity, color: info.color };
  }, [data]);

  // Format timestamp
  const formatTimestamp = (raw: string | undefined) => {
    if (!raw) return "Recently measured";
    try {
      const d = new Date(raw);
      return d.toLocaleString("en-IN", {
        timeZone: "Asia/Kolkata",
        dateStyle: "medium",
        timeStyle: "short",
      }) + " IST";
    } catch {
      return raw;
    }
  };

  return (
    <div className="min-h-dvh w-full flex flex-col justify-between selection:bg-[#35D0C5] selection:text-[#0B0F14] relative">
      {/* ── Infinite Continuously Moving Technical Grid & Ambient Radiance ── */}
      <InfiniteGrid
        aqi={data?.predicted_aqi}
        category={data?.category}
        inferenceKey={data ? `${data.city}-${data.measured_at ?? data.predicted_aqi}` : null}
        status={apiStatus}
      />

      {/* ── Background Particulate Canvas ── */}
      <ParticleField severity={particleInfo.severity} color={particleInfo.color} />

      {/* ── Top Atmospheric Navigation ── */}
      <header
        className="w-full border-b sticky top-0 z-40 transition-colors"
        style={{
          borderColor: "#202A34",
          backgroundColor: "#0B0F14",
        }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 h-14 flex items-center justify-between w-full">
          {/* Brand & Subtitle */}
          <div className="flex items-center gap-3">
            <Link href="/" className="flex items-center gap-3 group">
              <Image
                src="/images/aqi-intelligence-logo.png"
                alt="AQI Intelligence Logo"
                width={44}
                height={44}
                priority
                className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 object-contain shrink-0"
              />
              <div className="flex flex-col justify-center">
                <span className="font-mono font-bold text-sm tracking-wider text-[#FFFFFF] uppercase group-hover:text-[#35D0C5] transition-colors">
                  AQI Intelligence
                </span>
                <span className="text-[11px] font-mono text-[#94A3B8] hidden sm:block leading-tight">
                  Live WAQI Sensor Station Feed
                </span>
              </div>
            </Link>
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Switcher */}
            <div className="flex items-center bg-[#10161D] border border-[#202A34] rounded-lg p-0.5 text-xs font-mono">
              <Link
                href="/"
                className="px-3 py-1 rounded-md text-[#CBD5E1] hover:text-[#FFFFFF] transition-colors font-medium"
              >
                Simulator
              </Link>
              <span className="px-3 py-1 rounded-md bg-[#18212B] text-[#35D0C5] font-semibold border border-[#26313D] shadow-sm">
                Live WAQI ⚡
              </span>
            </div>

            {/* Live API Health */}
            <div
              className="flex items-center gap-2 px-3 py-1 rounded-lg bg-[#10161D] border border-[#202A34] text-[11px] font-mono text-[#CBD5E1] hidden md:flex"
              title="Flask backend health on port 5000"
            >
              <span
                className="w-2 h-2 rounded-full"
                style={{ backgroundColor: statusColor[apiStatus] }}
              />
              <span>Flask API:</span>
              <span className="font-medium text-[#FFFFFF]">{statusLabel[apiStatus]}</span>
            </div>

            {/* Batch CSV Trigger */}
            <button
              type="button"
              onClick={() => setIsBatchOpen(true)}
              className="text-xs font-mono text-[#35D0C5] hover:text-[#0B0F14] bg-[#10161D] hover:bg-[#35D0C5] transition-all border border-[#26313D] px-3.5 py-1.5 rounded-lg font-medium"
            >
              Batch CSV ↑
            </button>
          </div>
        </div>
      </header>

      {/* ── Main Content (Solid Opaque Cards on z-10) ── */}
      <main className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8 flex-1">
        
        {/* ── Search & City Quick-Select Header ── */}
        <section className="p-5 sm:p-7 rounded-2xl border border-[#26313D] bg-[#151C24] flex flex-col gap-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <span className="inline-flex items-center px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase bg-[#35D0C5]/10 text-[#35D0C5] border border-[#35D0C5]/30">
                  Real-Time Feed
                </span>
                <span className="text-[11px] font-mono text-[#64717E]">
                  World Air Quality Index (WAQI) Open Ingestion
                </span>
              </div>
              <h1 className="text-xl sm:text-2xl font-mono font-bold text-[#F2F5F7] tracking-tight">
                Live City Atmospheric Telemetry
              </h1>
            </div>

            {/* City Search Bar */}
            <form onSubmit={handleSearch} className="flex items-center gap-2 max-w-md w-full">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Enter Indian city (e.g. Pune, Jaipur)..."
                  value={inputCity}
                  onChange={(e) => setInputCity(e.target.value)}
                  className="w-full px-3.5 py-2 rounded-xl bg-[#10161D] border border-[#202A34] text-xs font-mono text-[#F2F5F7] placeholder:text-[#64717E] focus:outline-none focus:border-[#35D0C5] transition-colors"
                />
              </div>
              <button
                type="submit"
                className="px-4 py-2 rounded-xl bg-[#35D0C5] text-[#0B0F14] text-xs font-mono font-bold hover:bg-[#5CE1E6] active:scale-[0.98] transition-all shadow-md shadow-[rgba(53,208,197,0.25)] flex items-center gap-1.5 shrink-0"
              >
                <span>Search</span>
                <span>→</span>
              </button>
            </form>
          </div>

          {/* Quick-Select Pills */}
          <div className="flex flex-col gap-2 pt-3 border-t border-[#202A34]">
            <span className="text-[11px] font-mono uppercase tracking-wider text-[#64717E]">
              Major Urban Centers:
            </span>
            <div className="flex flex-wrap gap-2">
              {QUICK_CITIES.map((city) => {
                const isActive = selectedCity.toLowerCase() === city.toLowerCase();
                return (
                  <button
                    key={city}
                    type="button"
                    onClick={() => setSelectedCity(city)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-mono transition-all border ${
                      isActive
                        ? "bg-[#35D0C5] text-[#0B0F14] font-bold border-[#35D0C5] shadow-[0_0_12px_rgba(53,208,197,0.3)]"
                        : "bg-[#10161D] text-[#9AA7B4] border-[#202A34] hover:bg-[#18212B] hover:border-[#26313D] hover:text-[#F2F5F7]"
                    }`}
                  >
                    {city}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        {/* ── Error Notification State ── */}
        <AnimatePresence>
          {isError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="p-4 rounded-xl border border-[#F05B5B]/40 bg-[#F05B5B]/10 text-[#F2F5F7] text-xs font-mono flex items-start justify-between gap-3"
            >
              <div className="flex items-start gap-3">
                <span className="text-base">⚠️</span>
                <div>
                  <p className="font-bold text-[#F05B5B]">
                    {error?.message?.includes("key") || error?.message?.includes("503")
                      ? "WAQI Integration Key Not Configured"
                      : error?.message?.toLowerCase().includes("not found") || error?.message?.includes("404")
                      ? "Station Feed Not Found"
                      : error?.message?.includes("502") || error?.message?.toLowerCase().includes("connect")
                      ? "WAQI Live Sensor Feed Temporarily Unavailable"
                      : "Station Telemetry Unreachable"}
                  </p>
                  <p className="text-[#9AA7B4] mt-0.5">
                    {error?.message || `Could not resolve live station feed for "${selectedCity}". Please select another city from the quick list.`}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="px-3 py-1.5 rounded-lg bg-[#18212B] hover:bg-[#202A34] border border-[#26313D] text-[#35D0C5] text-xs font-mono transition-colors shrink-0 disabled:opacity-50"
              >
                {isFetching ? "Retrying…" : "Retry"}
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Live Station Metadata Strip ── */}
        {data && !isError && (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 px-5 py-3 rounded-xl border border-[#26313D] bg-[#151C24] text-xs font-mono text-[#9AA7B4]">
            <div className="flex items-center gap-2">
              <span className="text-base">📍</span>
              <span className="text-[#F2F5F7] font-semibold">{data.station}</span>
            </div>
            <div className="flex items-center gap-4">
              <span>🕒 Measured: <strong className="text-[#F2F5F7] font-normal">{formatTimestamp(data.measured_at)}</strong></span>
              <button
                type="button"
                onClick={() => refetch()}
                disabled={isFetching}
                className="px-2.5 py-1 rounded bg-[#10161D] hover:bg-[#18212B] border border-[#202A34] text-[#35D0C5] transition-colors disabled:opacity-50"
              >
                {isFetching ? "Refreshing…" : "↻ Refresh Feed"}
              </button>
            </div>
          </div>
        )}

        {/* ── Dual AQI Comparison Hero ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Card 1: WAQI Reported Official AQI */}
          <div className="p-6 sm:p-7 rounded-2xl border border-[#26313D] bg-[#151C24] flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#10161D] border border-[#202A34] text-[#9AA7B4]">
                  WAQI Official Station Reading
                </span>
                <span className="text-[10px] font-mono text-[#64717E]">
                  Single Worst Sub-Index
                </span>
              </div>

              <div className="flex items-baseline gap-4 my-2">
                <span
                  className="font-preserved-value font-bold text-6xl sm:text-7xl tabular-nums tracking-tighter"
                  style={{ color: data?.live_aqi_reported != null ? (waqiInfo?.color ?? "#35D0C5") : "#64717E" }}
                >
                  {isLoading ? "…" : data?.live_aqi_reported != null ? Math.round(data.live_aqi_reported) : "—"}
                </span>
                {data?.live_aqi_reported != null && waqiInfo ? (
                  <div className="flex flex-col">
                    <span
                      className="text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border inline-block"
                      style={{
                        backgroundColor: `${waqiInfo.color}15`,
                        color: waqiInfo.color,
                        borderColor: `${waqiInfo.color}40`,
                      }}
                    >
                      {waqiInfo.category}
                    </span>
                    <span className="text-[10px] font-mono text-[#64717E] mt-1">
                      EPA/CPCB Breakpoint Rule
                    </span>
                  </div>
                ) : !isLoading && data ? (
                  <div className="flex flex-col">
                    <span className="text-xs font-mono uppercase tracking-wider px-2.5 py-0.5 rounded border inline-block bg-[#10161D] border-[#26313D] text-[#9AA7B4]">
                      Breakpoint Unreported
                    </span>
                    <span className="text-[10px] font-mono text-[#64717E] mt-1">
                      Sub-Index Pending
                    </span>
                  </div>
                ) : null}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-[#202A34] text-xs text-[#9AA7B4] font-sans">
              <p>
                Calculated directly from the single highest pollutant reading at the {data?.city ?? selectedCity} station using classical breakpoint interpolation formulas.
              </p>
            </div>
          </div>

          {/* Card 2: Model Predicted AQI */}
          <div className="p-6 sm:p-7 rounded-2xl border border-[#26313D] bg-[#151C24] flex flex-col justify-between relative overflow-hidden">
            <div>
              <div className="flex items-center justify-between mb-4">
                <span className="px-2.5 py-1 rounded-md text-[10px] font-mono font-bold uppercase bg-[#35D0C5]/10 border border-[#35D0C5]/30 text-[#35D0C5]">
                  PCA + Random Forest Inference
                </span>
                <span className="text-[10px] font-mono text-[#64717E]">
                  12-Feature Regression
                </span>
              </div>

              <div className="flex items-baseline gap-4 my-2">
                <span
                  className="font-preserved-value font-bold text-6xl sm:text-7xl tabular-nums tracking-tighter"
                  style={{ color: predInfo?.color ?? "#35D0C5" }}
                >
                  {isLoading ? "…" : data?.predicted_aqi != null ? Math.round(data.predicted_aqi) : "…"}
                </span>
                {predInfo && (
                  <div className="flex flex-col">
                    <span
                      className="text-xs font-mono font-bold uppercase tracking-wider px-2.5 py-0.5 rounded border inline-block"
                      style={{
                        backgroundColor: `${predInfo.color}15`,
                        color: predInfo.color,
                        borderColor: `${predInfo.color}40`,
                      }}
                    >
                      {predInfo.category}
                    </span>
                    <span className="text-[10px] font-mono text-[#64717E] mt-1">
                      Composite Prediction
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="pt-4 mt-4 border-t border-[#202A34] flex flex-col gap-1.5 text-xs font-sans">
              <p className="text-[#F2F5F7] font-medium">
                {predInfo?.advice ?? "Computing atmospheric health recommendation…"}
              </p>
              <p className="text-[11px] text-[#64717E]">
                Synthesized across all 12 pollutant dimensions using PCA orthogonal decomposition and tuned Random Forest non-linear ensemble regression.
              </p>
            </div>
          </div>
        </div>

        {/* ── Discrepancy Insight Banner ── */}
        <div className="p-4 sm:p-5 rounded-xl border border-[#26313D] bg-[#10161D] flex items-start gap-3.5">
          <div className="w-8 h-8 rounded-lg bg-[#18212B] border border-[#202A34] flex items-center justify-center shrink-0 text-base">
            💡
          </div>
          <div className="text-xs font-sans leading-relaxed text-[#9AA7B4] flex flex-col gap-1">
            <span className="font-mono font-bold text-[#F2F5F7] text-xs uppercase tracking-wide">
              Why do WAQI reported AQI and our ML Model prediction differ?
            </span>
            <p>
              WAQI publishes a <strong>max-pollutant breakpoint index</strong> (the single worst pollutant&apos;s sub-index dominates the number). In contrast, our Machine Learning model computes a <strong>non-linear composite multivariate index</strong> trained on long-term historical Indian atmospheric data, accounting for cross-pollutant interactions and precursor gases (NO, NOx, NH3, Benzene, Toluene, Xylene).
            </p>
          </div>
        </div>

        {/* ── 12-Feature Decomposition Grid (Live vs Imputed) ── */}
        <section className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base sm:text-lg font-mono font-bold text-[#F2F5F7]">
                12-Pollutant Sensor Decomposition
              </h2>
              <p className="text-xs font-mono text-[#64717E]">
                Source attribution per pollutant: Live station sensors vs Dataset global medians
              </p>
            </div>
            
            {/* Legend */}
            <div className="flex items-center gap-3 text-[11px] font-mono">
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#3CCB8E]" />
                <span className="text-[#F2F5F7]">Live Sensor</span>
              </div>
              <div className="flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#35D0C5]" />
                <span className="text-[#9AA7B4]">Dataset Median</span>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3 sm:gap-4">
            {FEATURE_SPECS.map((spec) => {
              const featureItem = data?.features_used?.[spec.key];
              const isLive = featureItem?.source === "live";
              const val = featureItem?.value ?? spec.defaultValue;

              return (
                <div
                  key={spec.key}
                  className="p-4 rounded-xl border border-[#26313D] bg-[#18212B] flex flex-col justify-between gap-3 hover:border-[#35D0C5]/40 transition-colors"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono font-bold text-sm text-[#F2F5F7] block">
                        {spec.label}
                      </span>
                      <span className="text-[10px] font-sans text-[#64717E] truncate block max-w-[120px]" title={spec.description}>
                        {spec.description}
                      </span>
                    </div>

                    {/* Source Badge */}
                    {isLive ? (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-[#3CCB8E]/10 text-[#3CCB8E] border border-[#3CCB8E]/30 shrink-0">
                        Live
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-[#35D0C5]/10 text-[#35D0C5] border border-[#35D0C5]/30 shrink-0">
                        Estimated
                      </span>
                    )}
                  </div>

                  <div className="flex items-baseline justify-between pt-2 border-t border-[#202A34]">
                    <span className="font-preserved-value font-bold text-lg sm:text-xl text-[#F2F5F7]">
                      {typeof val === "number" ? (val % 1 !== 0 ? val.toFixed(1) : val) : val}
                    </span>
                    <span className="text-[10px] font-mono text-[#64717E]">
                      {spec.unit}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </section>

      </main>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 w-full border-t mt-12 py-5 transition-colors"
        style={{
          borderColor: "#202A34",
          backgroundColor: "#0B0F14",
        }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-2 text-center sm:text-left w-full">
          <p className="text-[12px] font-mono text-[#CBD5E1]">
            AQI Intelligence · WAQI Real-time Sensor Feed Ingestion · Random Forest Regressor
          </p>
          <p className="text-[11px] font-mono text-[#94A3B8]">
            Server-side token verification · Dataset global median imputation for unmonitored gases.
          </p>
        </div>
      </footer>

      {/* ── Batch CSV Modal ── */}
      <BatchUploadModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
      />
    </div>
  );
}

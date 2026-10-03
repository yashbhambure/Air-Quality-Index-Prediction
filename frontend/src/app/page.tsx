"use client";

import { motion, type Variants } from "framer-motion";
import { useMemo, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { HeroAQI } from "@/components/dashboard/HeroAQI";
import { PredictionForm } from "@/components/dashboard/PredictionForm";
import { WhatIfSimulator } from "@/components/dashboard/WhatIfSimulator";
import { AtmosphericIntelligenceTrace } from "@/components/dashboard/AtmosphericIntelligenceTrace";
import { ModelPipeline } from "@/components/dashboard/ModelPipeline";
import { PCABreakdown } from "@/components/dashboard/PCABreakdown";
import { ForecastTimeline } from "@/components/dashboard/ForecastTimeline";
import { MetricsBar } from "@/components/dashboard/MetricsBar";
import { HistoryTable } from "@/components/dashboard/HistoryTable";
import { BatchUploadModal } from "@/components/dashboard/BatchUploadModal";
import { ParticleField } from "@/components/ParticleField";
import { InfiniteGrid } from "@/components/effects/InfiniteGrid";
import { useMetrics } from "@/hooks/useMetrics";
import { getAQIInfo } from "@/lib/aqi";
import { DEFAULT_INPUT } from "@/lib/constants";
import type { PredictionInput, PredictionResult } from "@/types/aqi";

const fadeUp: Variants = {
  hidden: { opacity: 0, y: 12 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.05, duration: 0.35, ease: "easeOut" },
  }),
};

export default function DashboardPage() {
  const [latestResult, setLatestResult] = useState<PredictionResult | null>(null);
  const [inferenceCount, setInferenceCount] = useState(0);
  const [isFormLoading, setIsFormLoading] = useState(false);
  const [currentInputs, setCurrentInputs] = useState<PredictionInput>(DEFAULT_INPUT);
  const [liveInference, setLiveInference] = useState(true);
  const [isBatchOpen, setIsBatchOpen] = useState(false);

  const handleResult = useCallback((res: PredictionResult) => {
    setLatestResult(res);
    setInferenceCount((prev) => prev + 1);
  }, []);

  const handleLoadingChange = useCallback((loading: boolean) => {
    setIsFormLoading(loading);
  }, []);

  const handleInputChange = useCallback((inputs: PredictionInput) => {
    setCurrentInputs(inputs);
  }, []);

  const handleLiveInferenceChange = useCallback((live: boolean) => {
    setLiveInference(live);
  }, []);

  // Live API status
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

  // Particle background severity & color
  const particleInfo = useMemo(() => {
    if (!latestResult) return { severity: null, color: null };
    const info = getAQIInfo(latestResult.aqi);
    return { severity: info.severity, color: info.color };
  }, [latestResult]);

  return (
    <div className="min-h-dvh w-full flex flex-col justify-between selection:bg-[#35D0C5] selection:text-[#0B0F14] relative">
      {/* ── Infinite Continuously Moving Technical Grid & Ambient Radiance ── */}
      <InfiniteGrid
        aqi={latestResult?.aqi}
        category={latestResult?.category}
        inferenceKey={inferenceCount}
        status={apiStatus}
      />

      {/* ── Background Particulate Canvas ── */}
      <ParticleField severity={particleInfo.severity} color={particleInfo.color} />

      {/* ── Top Atmospheric Intelligence Navigation ── */}
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
            <Image
              src="/images/aqi-intelligence-logo.png"
              alt="AQI Intelligence Logo"
              width={44}
              height={44}
              priority
              className="w-9 h-9 sm:w-10 sm:h-10 md:w-11 md:h-11 object-contain shrink-0"
            />
            <div className="flex flex-col justify-center">
              <span className="font-mono font-bold text-sm tracking-wider text-[#FFFFFF] uppercase">
                AQI Intelligence
              </span>
              <span className="text-[11px] font-mono text-[#94A3B8] hidden sm:block leading-tight">
                PCA Dimensionality Reduction · Random Forest Regressor
              </span>
            </div>
          </div>

          {/* Navigation Controls & Status */}
          <div className="flex items-center gap-2 sm:gap-3">
            {/* View Switcher */}
            <div className="flex items-center bg-[#10161D] border border-[#202A34] rounded-lg p-0.5 text-xs font-mono">
              <span className="px-3 py-1 rounded-md bg-[#18212B] text-[#35D0C5] font-semibold border border-[#26313D] shadow-sm">
                Simulator
              </span>
              <Link
                href="/live"
                className="px-3 py-1 rounded-md text-[#CBD5E1] hover:text-[#FFFFFF] transition-colors flex items-center gap-1 font-medium"
              >
                <span>Live WAQI</span>
                <span className="text-[10px]">⚡</span>
              </Link>
            </div>

            {/* Live API Health Chip */}
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

      {/* ── Main Analytical Dashboard Content (Opaque Solid Cards on z-10) ── */}
      <main className="relative z-10 w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8 flex flex-col gap-6 sm:gap-8 flex-1">

        {/* ── Section 1: Hero Command Center (AQI Verdict + Calibrated Gauge + Trace Chart) ── */}
        <motion.section
          id="command-center"
          custom={0}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          aria-label="Atmospheric Intelligence Command Center"
          className="w-full"
        >
          <HeroAQI result={latestResult} isLoading={isFormLoading} />
        </motion.section>

        {/* ── Section 2: Pollutant Input System Matrix ── */}
        <motion.section
          id="pollutant-matrix"
          custom={1}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          aria-label="Speciated pollutant controls"
          className="p-5 sm:p-7 rounded-2xl border border-[#26313D] bg-[#151C24] w-full"
        >
          <PredictionForm
            onResult={handleResult}
            onLoadingChange={handleLoadingChange}
            onInputChange={handleInputChange}
            onLiveInferenceChange={handleLiveInferenceChange}
          />
        </motion.section>

        {/* ── Section 3: What-If AQI Analytical Simulator ── */}
        <motion.section
          id="what-if-simulator-section"
          custom={2}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          aria-label="What-If AQI Perturbation Simulator"
          className="w-full"
        >
          <WhatIfSimulator
            baselineInputs={currentInputs}
            baselineResult={latestResult}
            isModelConnected={apiStatus === "connected"}
          />
        </motion.section>

        {/* ── Section 4: Dynamic Atmospheric Intelligence Trace ── */}
        <motion.section
          id="atmospheric-trace-section"
          custom={3}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          aria-label="Dynamic Atmospheric Intelligence Trace"
          className="w-full"
        >
          <AtmosphericIntelligenceTrace
            currentInputs={currentInputs}
            latestResult={latestResult}
            isInferring={isFormLoading}
            isModelConnected={apiStatus === "connected"}
          />
        </motion.section>

        {/* ── Section 5: Live Telemetry Benchmarks Strip ── */}
        <motion.section
          id="model-benchmarks"
          custom={4}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          aria-label="Model telemetry benchmarks"
          className="w-full"
        >
          <MetricsBar />
        </motion.section>

        {/* ── Section 6: Analytical Depth Grid (PCA Attribution & SQLite Prediction Ledger) ── */}
        <motion.div
          custom={5}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 w-full"
        >
          {/* PCA Attribution & Explained Variance */}
          <section
            id="pca-analytics"
            className="p-5 sm:p-6 rounded-2xl border border-[#26313D] bg-[#151C24] flex flex-col justify-between font-['Google_Sans',sans-serif]"
            aria-label="PCA and feature importance breakdown"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#35D0C5]" />
                <h2 className="text-xs font-['Google_Sans',sans-serif] font-bold text-[#F2F5F7] uppercase tracking-wider">
                  PCA Analytics &amp; Feature Attribution
                </h2>
              </div>
              <span className="text-[10px] font-['Google_Sans',sans-serif] text-[#9AA7B4]">
                Loadings × RF Impurity
              </span>
            </div>
            <PCABreakdown />
          </section>

          {/* Recent Prediction Log */}
          <section
            id="prediction-ledger"
            className="p-5 sm:p-6 rounded-2xl border border-[#26313D] bg-[#151C24] flex flex-col justify-between font-['Google_Sans',sans-serif]"
            aria-label="Recent predictions"
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <div className="w-2 h-2 rounded-full bg-[#3CCB8E]" />
                <h2 className="text-xs font-['Google_Sans',sans-serif] font-bold text-[#F2F5F7] uppercase tracking-wider">
                  Prediction Ledger
                </h2>
              </div>
              <span className="text-[10px] font-['Google_Sans',sans-serif] text-[#9AA7B4]">
                SQLite Persistent Log
              </span>
            </div>
            <HistoryTable />
          </section>
        </motion.div>

        {/* ── Section 7: Temporal Simulation Lookahead ── */}
        <motion.section
          id="forecast-timeline"
          custom={6}
          variants={fadeUp}
          initial="hidden"
          animate="visible"
          aria-label="Temporal simulation lookahead"
          className="w-full"
        >
          <ForecastTimeline latestResult={latestResult} />
        </motion.section>

      </main>

      {/* ── Footer ── */}
      <footer
        className="relative z-10 w-full border-t mt-12 py-6 transition-colors"
        style={{
          borderColor: "#202A34",
          backgroundColor: "#0B0F14",
        }}
      >
        <div className="max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-center sm:text-left w-full">
          <p className="text-[12px] font-mono text-[#CBD5E1]">
            AQI Intelligence · Indian CPCB Sub-Index Standard · Principal Component Analysis · Random Forest Regressor
          </p>
          <p className="text-[11px] font-mono text-[#94A3B8]">
            Academic Environmental Intelligence Platform
          </p>
        </div>
      </footer>

      {/* ── Batch CSV Inference Modal ── */}
      <BatchUploadModal
        isOpen={isBatchOpen}
        onClose={() => setIsBatchOpen(false)}
      />
    </div>
  );
}

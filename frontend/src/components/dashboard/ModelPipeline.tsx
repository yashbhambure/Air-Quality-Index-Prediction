"use client";

import React, { useMemo, useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useMetrics } from "@/hooks/useMetrics";
import { formatAQI, getAQIInfo } from "@/lib/aqi";
import type { PredictionInput, PredictionResult } from "@/types/aqi";

export interface ModelPipelineProps {
  currentInputs?: PredictionInput;
  latestResult?: PredictionResult | null;
  isInferring?: boolean;
  liveInference?: boolean;
  onStageClick?: (stageId: string) => void;
}

type PipelineStatus = "idle" | "input_updated" | "inferring" | "complete" | "error";

export function ModelPipeline({
  currentInputs,
  latestResult,
  isInferring = false,
  liveInference = true,
  onStageClick,
}: ModelPipelineProps) {
  const { data: metricsData, isLoading: metricsLoading } = useMetrics();

  // ── Inference Stage State Machine (1 -> 2 -> 3 -> 4 -> 5) ─────────────
  const [activeStage, setActiveStage] = useState<number>(0); // 0 = idle, 1..5 = active stage
  const [status, setStatus] = useState<PipelineStatus>("idle");
  const prevInputsRef = useRef<PredictionInput | undefined>(currentInputs);
  const stageTimerRef = useRef<NodeJS.Timeout[]>([]);

  // Cleanup stage timers on unmount
  const clearTimers = () => {
    stageTimerRef.current.forEach(clearTimeout);
    stageTimerRef.current = [];
  };

  // Detect input changes while idle
  useEffect(() => {
    if (prevInputsRef.current && currentInputs && !isInferring) {
      const hasChanged = Object.keys(currentInputs).some(
        (k) =>
          currentInputs[k as keyof PredictionInput] !==
          prevInputsRef.current?.[k as keyof PredictionInput]
      );
      if (hasChanged) {
        setStatus("input_updated");
        const t = setTimeout(() => {
          setStatus((prev) => (prev === "input_updated" ? "idle" : prev));
        }, 600);
        stageTimerRef.current.push(t);
      }
    }
    prevInputsRef.current = currentInputs;
  }, [currentInputs, isInferring]);

  // Drive sequential stage progression during inference
  useEffect(() => {
    clearTimers();

    if (isInferring) {
      setStatus("inferring");
      setActiveStage(1);

      // Sequential logical pipeline stages
      const t1 = setTimeout(() => setActiveStage(2), 120);
      const t2 = setTimeout(() => setActiveStage(3), 240);
      const t3 = setTimeout(() => setActiveStage(4), 380);
      stageTimerRef.current = [t1, t2, t3];
    } else if (latestResult) {
      // Final stage activation when inference completes
      setActiveStage(5);
      setStatus("complete");

      const t4 = setTimeout(() => {
        setActiveStage(0);
        setStatus("idle");
      }, 1400);
      stageTimerRef.current = [t4];
    } else {
      setActiveStage(0);
      setStatus("idle");
    }

    return () => clearTimers();
  }, [isInferring, latestResult]);

  // Model metadata
  const originalFeatures = metricsData?.feature_columns?.length ?? 12;
  const pcaComponents = metricsData?.pca_components ?? (metricsLoading ? "…" : "10");
  const rfTrees = metricsData?.best_params?.n_estimators ?? (metricsLoading ? "…" : "400");
  const maxDepth = metricsData?.best_params?.max_depth ?? (metricsLoading ? "…" : "20");

  const varianceRetainedPct = useMemo(() => {
    if (!metricsData?.explained_variance_ratio?.length) return 96.5;
    const sum = metricsData.explained_variance_ratio.reduce((a, b) => a + b, 0);
    return Math.round(sum * 1000) / 10;
  }, [metricsData]);

  const aqi = latestResult?.aqi ?? null;
  const aqiInfo = useMemo(() => (aqi != null ? getAQIInfo(aqi) : null), [aqi]);

  const handleStageNavigation = (targetId: string) => {
    if (onStageClick) {
      onStageClick(targetId);
      return;
    }
    const elem = document.getElementById(targetId);
    if (elem) {
      elem.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  };

  // 6 Primary drivers for the mini telemetry in Stage 1
  const miniDrivers = useMemo(() => {
    if (!currentInputs) return [];
    return [
      { key: "PM2.5", val: currentInputs["PM2.5"], max: 500, unit: "μg/m³" },
      { key: "PM10", val: currentInputs.PM10, max: 500, unit: "μg/m³" },
      { key: "NO₂", val: currentInputs.NO2, max: 200, unit: "μg/m³" },
      { key: "SO₂", val: currentInputs.SO2, max: 150, unit: "μg/m³" },
      { key: "CO", val: currentInputs.CO, max: 10, unit: "mg/m³" },
      { key: "O₃", val: currentInputs.O3, max: 200, unit: "μg/m³" },
    ];
  }, [currentInputs]);

  // Status text and color mapping
  const statusConfig = useMemo(() => {
    switch (status) {
      case "inferring":
        return { text: "◉ PIPELINE ACTIVE", color: "#35D0C5", animate: true };
      case "input_updated":
        return { text: "● INPUT UPDATED", color: "#5CE1E6", animate: false };
      case "complete":
        return { text: "● INFERENCE COMPLETE", color: "#3CCB8E", animate: false };
      case "error":
        return { text: "● PIPELINE ERROR", color: "#F05B5B", animate: false };
      default:
        return { text: "● PIPELINE READY", color: "#9AA7B4", animate: false };
    }
  }, [status]);

  return (
    <div
      id="model-pipeline"
      className="p-5 sm:p-6 rounded-2xl border transition-all duration-300 relative overflow-hidden"
      style={{
        backgroundColor: "#151C24",
        borderColor: status === "inferring" ? "#35D0C5" : "#26313D",
        boxShadow: status === "inferring" ? "0 0 24px rgba(53, 208, 197, 0.12)" : "none",
      }}
    >
      {/* ── Top Header & Telemetry Status ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 pb-4 mb-4 border-b border-[#202A34]">
        <div className="flex items-center gap-3">
          <div className="relative flex items-center justify-center">
            <span
              className={`w-2.5 h-2.5 rounded-full ${
                status === "inferring" ? "bg-[#35D0C5] animate-ping" : "bg-[#35D0C5]"
              }`}
            />
            <span className="w-2 h-2 rounded-full bg-[#35D0C5] absolute" />
          </div>
          <div>
            <h2 className="text-xs font-mono font-bold text-[#F2F5F7] uppercase tracking-wider flex items-center gap-2">
              <span>Machine Learning Pipeline Architecture</span>
              <span className="text-[10px] font-normal text-[#9AA7B4] border border-[#26313D] px-2 py-0.5 rounded bg-[#10161D]">
                PCA + Random Forest
              </span>
            </h2>
          </div>
        </div>

        {/* Live Stream & Latency Indicator */}
        <div className="flex items-center gap-3 text-[10px] font-mono">
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-[#10161D] border transition-colors duration-200"
            style={{ borderColor: `${statusConfig.color}40` }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${statusConfig.animate ? "animate-pulse" : ""}`}
              style={{ backgroundColor: statusConfig.color }}
            />
            <span style={{ color: statusConfig.color }} className="font-semibold">
              {statusConfig.text}
            </span>
          </div>

          {latestResult?.inference_ms != null && (
            <div className="hidden sm:flex items-center gap-1 text-[#64717E]">
              <span>Latency:</span>
              <strong className="text-[#35D0C5] font-semibold">{latestResult.inference_ms} ms</strong>
            </div>
          )}

          <span className="hidden md:inline text-[#64717E]">
            {liveInference ? "Mode: Live Auto-Sync" : "Mode: Manual"}
          </span>
        </div>
      </div>

      {/* ── 5 Pipeline Stages Grid with Dynamic Data Flows ── */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 relative">
        {/* ════════════════════════════════════════════════════════════════════
            STAGE 01 — Raw Atmospheric Input
        ════════════════════════════════════════════════════════════════════ */}
        <div
          onClick={() => handleStageNavigation("pollutant-form")}
          className={`p-3.5 rounded-xl border relative flex flex-col justify-between cursor-pointer group transition-all duration-200 ${
            activeStage === 1 || status === "input_updated"
              ? "border-[#35D0C5] bg-[#18212B] shadow-[0_0_15px_rgba(53,208,197,0.18)]"
              : "border-[#26313D] bg-[#18212B] hover:border-[#35D0C5]/50"
          }`}
          title="Click to adjust pollutant sliders"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-[#64717E]">
                STAGE 01
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold border text-[#35D0C5] border-[#35D0C5]/40 bg-[#35D0C5]/10">
                {activeStage === 1 ? "● STREAMING" : "12 Features"}
              </span>
            </div>

            <h4 className="text-xs font-mono font-bold text-[#F2F5F7] mb-0.5">
              Raw Atmospheric Input
            </h4>
            <p className="text-[11px] font-sans text-[#9AA7B4] mb-2.5">
              Speciated Continuous Vector
            </p>

            {/* Mini Dynamic Input Telemetry Vector */}
            <div className="space-y-1.5 my-2 p-2 rounded-lg bg-[#10161D] border border-[#202A34]">
              {miniDrivers.map((d) => {
                const pct = Math.min(Math.max((d.val / d.max) * 100, 4), 100);
                return (
                  <div key={d.key} className="flex items-center justify-between gap-1.5 text-[9px] font-mono">
                    <span className="text-[#9AA7B4] w-7">{d.key}</span>
                    <div className="flex-1 h-1.5 rounded-full bg-[#18212B] overflow-hidden">
                      <div
                        className="h-full rounded-full bg-[#35D0C5] transition-all duration-300"
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                    <span className="text-[#F2F5F7] font-semibold w-8 text-right tabular-nums">
                      {d.val}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="pt-2 border-t border-[#202A34] text-[10px] font-mono text-[#64717E] flex justify-between items-center">
            <span>Input Vector</span>
            <span className="text-[#35D0C5] text-[9px]">Adjust ↗</span>
          </div>

          {/* Desktop Animated Connector (Stage 1 -> 2) */}
          <DataPulseConnector isActive={activeStage === 1 || activeStage === 2} />
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            STAGE 02 — StandardScaler (Normalization)
        ════════════════════════════════════════════════════════════════════ */}
        <div
          className={`p-3.5 rounded-xl border relative flex flex-col justify-between transition-all duration-200 ${
            activeStage === 2
              ? "border-[#5CE1E6] bg-[#18212B] shadow-[0_0_15px_rgba(92,225,230,0.18)]"
              : "border-[#26313D] bg-[#18212B]"
          }`}
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-[#64717E]">
                STAGE 02
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold border text-[#5CE1E6] border-[#5CE1E6]/40 bg-[#5CE1E6]/10">
                {activeStage === 2 ? "● SCALING…" : "StandardScaler"}
              </span>
            </div>

            <h4 className="text-xs font-mono font-bold text-[#F2F5F7] mb-0.5">
              Feature Normalization
            </h4>
            <p className="text-[11px] font-sans text-[#9AA7B4] mb-2.5">
              Zero Mean &amp; Unit Variance
            </p>

            {/* Standard scaling mathematical preview */}
            <div className="p-2.5 rounded-lg bg-[#10161D] border border-[#202A34] space-y-1 text-[9px] font-mono relative overflow-hidden">
              {activeStage === 2 && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#5CE1E6]/10 to-transparent animate-pulse" />
              )}
              <div className="flex justify-between text-[#64717E]">
                <span>Transform:</span>
                <span className="text-[#5CE1E6]">z = (x - μ) / σ</span>
              </div>
              <div className="flex justify-between text-[#64717E]">
                <span>Variance Scale:</span>
                <span className="text-[#F2F5F7]">σ² = 1.0</span>
              </div>
              <div className="flex justify-between text-[#64717E]">
                <span>Dimensions:</span>
                <span className="text-[#F2F5F7]">12 Scaled Axes</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#202A34] text-[10px] font-mono text-[#64717E] flex justify-between items-center">
            <span>Preconditioning</span>
            <span className="text-[#5CE1E6]">Normalized ●</span>
          </div>

          {/* Desktop Animated Connector (Stage 2 -> 3) */}
          <DataPulseConnector isActive={activeStage === 2 || activeStage === 3} />
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            STAGE 03 — PCA Transformation (Dimensionality Reduction)
        ════════════════════════════════════════════════════════════════════ */}
        <div
          onClick={() => handleStageNavigation("pca-analytics")}
          className={`p-3.5 rounded-xl border relative flex flex-col justify-between cursor-pointer group transition-all duration-200 ${
            activeStage === 3
              ? "border-[#3CCB8E] bg-[#18212B] shadow-[0_0_15px_rgba(60,203,142,0.18)]"
              : "border-[#26313D] bg-[#18212B] hover:border-[#3CCB8E]/50"
          }`}
          title="Click to view PCA loadings and variance radar"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-[#64717E]">
                STAGE 03
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold border text-[#3CCB8E] border-[#3CCB8E]/40 bg-[#3CCB8E]/10">
                {activeStage === 3 ? "● PROJECTING…" : `12 → ${pcaComponents} PCs`}
              </span>
            </div>

            <h4 className="text-xs font-mono font-bold text-[#F2F5F7] mb-0.5">
              PCA Transformation
            </h4>
            <p className="text-[11px] font-sans text-[#9AA7B4] mb-2.5">
              Orthogonal Eigenspace
            </p>

            {/* PCA Subspace Readout */}
            <div className="p-2.5 rounded-lg bg-[#10161D] border border-[#202A34] space-y-1 text-[9px] font-mono relative overflow-hidden">
              {activeStage === 3 && (
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-[#3CCB8E]/10 to-transparent animate-pulse" />
              )}
              <div className="flex justify-between text-[#64717E]">
                <span>Retained Variance:</span>
                <span className="text-[#3CCB8E] font-bold">{varianceRetainedPct}%</span>
              </div>
              <div className="flex justify-between text-[#64717E]">
                <span>Principal Vectors:</span>
                <span className="text-[#F2F5F7]">PC1 → PC{pcaComponents}</span>
              </div>
              <div className="flex justify-between text-[#64717E]">
                <span>De-correlation:</span>
                <span className="text-[#3CCB8E]">Orthogonal</span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#202A34] text-[10px] font-mono text-[#64717E] flex justify-between items-center">
            <span>Subspace</span>
            <span className="text-[#3CCB8E] text-[9px]">Analytics ↗</span>
          </div>

          {/* Desktop Animated Connector (Stage 3 -> 4) */}
          <DataPulseConnector isActive={activeStage === 3 || activeStage === 4} />
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            STAGE 04 — Random Forest Regressor
        ════════════════════════════════════════════════════════════════════ */}
        <div
          onClick={() => handleStageNavigation("model-benchmarks")}
          className={`p-3.5 rounded-xl border relative flex flex-col justify-between cursor-pointer group transition-all duration-200 ${
            activeStage === 4
              ? "border-[#F3C969] bg-[#18212B] shadow-[0_0_15px_rgba(243,201,105,0.18)]"
              : "border-[#26313D] bg-[#18212B] hover:border-[#F3C969]/50"
          }`}
          title="Click to view model benchmark metrics (R², MAE, RMSE)"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-[#64717E]">
                STAGE 04
              </span>
              <span className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold border text-[#F3C969] border-[#F3C969]/40 bg-[#F3C969]/10">
                {activeStage === 4 ? "● INFERRING…" : `${rfTrees} Trees`}
              </span>
            </div>

            <h4 className="text-xs font-mono font-bold text-[#F2F5F7] mb-0.5">
              Random Forest Regressor
            </h4>
            <p className="text-[11px] font-sans text-[#9AA7B4] mb-2.5">
              Ensemble Non-linear Mapping
            </p>

            {/* Random Forest Ensemble Tree Indicators */}
            <div className="p-2.5 rounded-lg bg-[#10161D] border border-[#202A34] space-y-1.5 text-[9px] font-mono">
              <div className="flex justify-between text-[#64717E]">
                <span>Estimators / Depth:</span>
                <span className="text-[#F2F5F7] font-semibold">{rfTrees} / {maxDepth}</span>
              </div>

              {/* Dynamic decision tree nodes pulse */}
              <div className="flex items-center justify-between gap-1 pt-0.5">
                {[1, 2, 3, 4, 5].map((treeIdx) => (
                  <div
                    key={treeIdx}
                    className={`h-1.5 flex-1 rounded-sm transition-all duration-200 ${
                      activeStage === 4
                        ? "bg-[#F3C969] shadow-[0_0_6px_#F3C969]"
                        : "bg-[#F3C969]/30"
                    }`}
                  />
                ))}
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#202A34] text-[10px] font-mono text-[#64717E] flex justify-between items-center">
            <span>Ensemble</span>
            <span className="text-[#F3C969] text-[9px]">Metrics ↗</span>
          </div>

          {/* Desktop Animated Connector (Stage 4 -> 5) */}
          <DataPulseConnector isActive={activeStage === 4 || activeStage === 5} />
        </div>

        {/* ════════════════════════════════════════════════════════════════════
            STAGE 05 — AQI & Advisory Output
        ════════════════════════════════════════════════════════════════════ */}
        <div
          onClick={() => handleStageNavigation("command-center")}
          className={`p-3.5 rounded-xl border relative flex flex-col justify-between cursor-pointer group transition-all duration-300 ${
            activeStage === 5
              ? "border-[#3CCB8E] bg-[#18212B] shadow-[0_0_20px_rgba(60,203,142,0.25)]"
              : "border-[#26313D] bg-[#18212B] hover:border-[#35D0C5]/50"
          }`}
          style={{
            borderColor: aqiInfo && activeStage === 5 ? aqiInfo.color : undefined,
          }}
          title="Click to view primary AQI instrument gauge"
        >
          <div>
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono font-bold text-[#64717E]">
                STAGE 05
              </span>
              <span
                className="px-2 py-0.5 rounded text-[9px] font-mono font-semibold border transition-colors duration-300"
                style={{
                  color: aqiInfo ? aqiInfo.color : "#35D0C5",
                  borderColor: aqiInfo ? `${aqiInfo.color}40` : "#35D0C540",
                  backgroundColor: aqiInfo ? `${aqiInfo.color}15` : "#35D0C515",
                }}
              >
                {activeStage === 5 ? "● VERIFIED" : latestResult?.category ?? "Standby"}
              </span>
            </div>

            <h4 className="text-xs font-mono font-bold text-[#F2F5F7] mb-0.5">
              AQI &amp; Advisory Output
            </h4>
            <p className="text-[11px] font-sans text-[#9AA7B4] mb-2.5">
              CPCB Sub-Index Standard
            </p>

            {/* Dynamic Numeric Result Card */}
            <div
              className="p-2.5 rounded-lg border transition-all duration-300 flex items-center justify-between"
              style={{
                backgroundColor: "#10161D",
                borderColor: aqiInfo ? `${aqiInfo.color}40` : "#202A34",
              }}
            >
              <div className="flex flex-col">
                <span className="text-[9px] font-mono text-[#64717E] uppercase">
                  Predicted Index
                </span>
                <AnimatePresence mode="wait">
                  <motion.span
                    key={aqi != null ? Math.round(aqi) : "none"}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.2 }}
                    className="font-mono font-bold text-xl leading-none tabular-nums tracking-tight transition-colors duration-300"
                    style={{ color: aqiInfo ? aqiInfo.color : "#35D0C5" }}
                  >
                    {isInferring ? "…" : aqi != null ? formatAQI(aqi) : "—"}
                  </motion.span>
                </AnimatePresence>
              </div>

              <div className="text-right">
                <span
                  className="font-mono text-[9px] font-bold uppercase block px-1.5 py-0.5 rounded transition-colors duration-300"
                  style={{
                    color: aqiInfo ? aqiInfo.color : "#9AA7B4",
                    backgroundColor: aqiInfo ? `${aqiInfo.color}18` : "#18212B",
                  }}
                >
                  {latestResult?.category ?? "Standby"}
                </span>
              </div>
            </div>
          </div>

          <div className="pt-2 border-t border-[#202A34] text-[10px] font-mono text-[#64717E] flex justify-between items-center">
            <span>CPCB Sub-Index</span>
            <span style={{ color: aqiInfo?.color ?? "#35D0C5" }} className="text-[9px]">
              Gauge ↗
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

/**
 * Precision Data Flow Connector between pipeline stage cards.
 * Displays an animated traveling luminous cyan particle during active inference.
 */
function DataPulseConnector({ isActive }: { isActive: boolean }) {
  return (
    <div className="hidden lg:block absolute -right-3.5 top-1/2 -translate-y-1/2 z-10 w-4 h-4 pointer-events-none">
      <svg viewBox="0 0 16 16" className="w-full h-full overflow-visible">
        {/* Base Track Line */}
        <line
          x1="0"
          y1="8"
          x2="16"
          y2="8"
          stroke={isActive ? "#35D0C5" : "#26313D"}
          strokeWidth="1.5"
          className="transition-colors duration-200"
        />
        {/* Arrow Tip */}
        <polygon
          points="12,5 16,8 12,11"
          fill={isActive ? "#35D0C5" : "#26313D"}
          className="transition-colors duration-200"
        />
        {/* Traveling Data Pulse Particle */}
        {isActive && (
          <circle cx="8" cy="8" r="2.5" fill="#35D0C5" className="animate-ping" />
        )}
      </svg>
    </div>
  );
}

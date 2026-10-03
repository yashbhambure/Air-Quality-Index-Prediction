"use client";

import React, { useState, useEffect, useMemo, useRef } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FEATURE_SPECS, PRIMARY_FEATURES, type FeatureSpec } from "@/lib/constants";
import { formatAQI, getAQIInfo } from "@/lib/aqi";
import type {
  PredictionInput,
  PredictionResult,
  AtmosphericTrace,
  PCAComponentItem,
} from "@/types/aqi";

interface AtmosphericIntelligenceTraceProps {
  currentInputs: PredictionInput;
  latestResult: PredictionResult | null;
  isInferring?: boolean;
  simulationInputs?: PredictionInput;
  simulationResult?: PredictionResult | null;
  isModelConnected?: boolean;
}

type TraceMode = "live" | "simulation";
type ActiveStage = "overview" | "scaler" | "pca" | "random_forest";

export function AtmosphericIntelligenceTrace({
  currentInputs,
  latestResult,
  isInferring = false,
  simulationInputs,
  simulationResult,
  isModelConnected = true,
}: AtmosphericIntelligenceTraceProps) {
  // Mode selection: Live dashboard inputs vs Simulator inputs
  const [mode, setMode] = useState<TraceMode>("live");
  const [activeTab, setActiveTab] = useState<ActiveStage>("overview");
  const [selectedPC, setSelectedPC] = useState<string>("PC1");

  // Track recently modified features for subtle highlighting
  const prevInputsRef = useRef<PredictionInput>(currentInputs);
  const [changedKey, setChangedKey] = useState<string | null>(null);

  // Active inputs & results based on mode
  const activeInputs = mode === "simulation" && simulationInputs ? simulationInputs : currentInputs;
  const activeResult = mode === "simulation" && simulationResult ? simulationResult : latestResult;
  const trace: AtmosphericTrace | undefined = activeResult?.trace;

  // Detect input changes and briefly flash the changed parameter
  useEffect(() => {
    const keys = Object.keys(activeInputs) as (keyof PredictionInput)[];
    for (const k of keys) {
      if (prevInputsRef.current && prevInputsRef.current[k] !== activeInputs[k]) {
        setChangedKey(k);
        const timer = setTimeout(() => setChangedKey(null), 1200);
        prevInputsRef.current = { ...activeInputs };
        return () => clearTimeout(timer);
      }
    }
    prevInputsRef.current = { ...activeInputs };
  }, [activeInputs]);

  // AQI Info
  const aqiValue = activeResult?.aqi ?? null;
  const aqiInfo = useMemo(() => getAQIInfo(aqiValue), [aqiValue]);

  // Selected PC details
  const selectedPCObject = useMemo(() => {
    if (!trace?.pca?.components) return null;
    return trace.pca.components.find((p) => p.id === selectedPC) || trace.pca.components[0];
  }, [trace, selectedPC]);

  const selectedPCLoadings = useMemo(() => {
    if (!trace?.pca?.loadings || !selectedPCObject) return {};
    return trace.pca.loadings[selectedPCObject.id] || {};
  }, [trace, selectedPCObject]);

  return (
    <div
      id="atmospheric-trace"
      className="relative overflow-hidden rounded-2xl border transition-all duration-300"
      style={{
        backgroundColor: "#151C24",
        borderColor: "#26313D",
      }}
    >
      {/* ── Section Header & Mode Selector ── */}
      <div
        className="flex flex-wrap items-center justify-between px-5 py-3.5 border-b text-xs font-mono"
        style={{
          borderColor: "#202A34",
          backgroundColor: "#10161D",
        }}
      >
        <div className="flex items-center gap-3">
          <div className="w-2.5 h-2.5 rounded-full bg-[#35D0C5] shadow-[0_0_8px_rgba(53,208,197,0.5)]" />
          <div className="flex flex-col sm:flex-row sm:items-center sm:gap-2">
            <span className="font-bold uppercase tracking-wider text-[#F2F5F7]">
              Atmospheric Intelligence Trace
            </span>
            <span className="text-[11px] text-[#64717E] hidden md:inline">
              · StandardScaler → PCA Orthogonal Decomposition → Random Forest Regressor
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 sm:gap-3">
          {/* Mode Switcher: Live Dashboard vs Simulator */}
          <div className="flex items-center p-0.5 rounded-lg bg-[#151C24] border border-[#26313D] text-[11px] font-mono">
            <button
              type="button"
              onClick={() => setMode("live")}
              className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                mode === "live"
                  ? "bg-[#18212B] text-[#35D0C5] font-semibold border border-[#35D0C5]/30 shadow-sm"
                  : "text-[#64717E] hover:text-[#9AA7B4]"
              }`}
            >
              <span className={`w-1.5 h-1.5 rounded-full ${mode === "live" ? "bg-[#35D0C5]" : "bg-[#64717E]"}`} />
              <span>Live Input Mode</span>
            </button>

            {simulationInputs && (
              <button
                type="button"
                onClick={() => setMode("simulation")}
                className={`px-2.5 py-1 rounded-md transition-all flex items-center gap-1.5 ${
                  mode === "simulation"
                    ? "bg-[#18212B] text-[#35D0C5] font-semibold border border-[#35D0C5]/30 shadow-sm"
                    : "text-[#64717E] hover:text-[#9AA7B4]"
                }`}
              >
                <span className={`w-1.5 h-1.5 rounded-full ${mode === "simulation" ? "bg-[#35D0C5]" : "bg-[#64717E]"}`} />
                <span>Simulation Mode</span>
              </button>
            )}
          </div>

          {/* Model Health / Inference Status */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border"
            style={{
              backgroundColor: isInferring
                ? "rgba(53, 208, 197, 0.08)"
                : isModelConnected
                ? "rgba(60, 203, 142, 0.08)"
                : "rgba(240, 91, 91, 0.08)",
              borderColor: isInferring
                ? "rgba(53, 208, 197, 0.3)"
                : isModelConnected
                ? "rgba(60, 203, 142, 0.25)"
                : "rgba(240, 91, 91, 0.25)",
              color: isInferring
                ? "#35D0C5"
                : isModelConnected
                ? "#3CCB8E"
                : "#F05B5B",
            }}
          >
            {isInferring ? (
              <>
                <span className="w-2 h-2 border-2 border-[#35D0C5] border-t-transparent rounded-full animate-spin" />
                <span>Evaluating Vector…</span>
              </>
            ) : (
              <>
                <span className={`w-1.5 h-1.5 rounded-full ${isModelConnected ? "bg-[#3CCB8E]" : "bg-[#F05B5B]"}`} />
                <span>{isModelConnected ? "Trace Synchronized" : "Flask Offline"}</span>
              </>
            )}
          </div>
        </div>
      </div>

      <div className="p-5 sm:p-7 flex flex-col gap-6">
        {/* ── PIPELINE FLOW MATRIX (5-Stage Visual Stepper) ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3 relative">
          {/* Stage 1: Raw Pollutant Input Vector */}
          <div
            onClick={() => setActiveTab("overview")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
              activeTab === "overview"
                ? "bg-[#18212B] border-[#35D0C5] shadow-[0_0_12px_rgba(53,208,197,0.12)]"
                : "bg-[#10161D] border-[#202A34] hover:border-[#26313D]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#64717E] font-bold">
                01 · Input Vector
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#151C24] text-[#9AA7B4] border border-[#26313D]">
                12 Features
              </span>
            </div>
            <div className="my-1">
              <div className="text-sm font-mono font-bold text-[#F2F5F7]">
                Atmospheric Vector
              </div>
              <div className="text-[11px] font-mono text-[#64717E] mt-0.5 truncate">
                PM2.5: {activeInputs["PM2.5"]} · PM10: {activeInputs["PM10"]}
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#35D0C5] pt-2 border-t border-[#202A34] mt-2 flex items-center justify-between">
              <span>{changedKey ? `Δ ${changedKey}` : "Telemetry Active"}</span>
              <span>→</span>
            </div>
          </div>

          {/* Stage 2: StandardScaler */}
          <div
            onClick={() => setActiveTab("scaler")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
              activeTab === "scaler"
                ? "bg-[#18212B] border-[#35D0C5] shadow-[0_0_12px_rgba(53,208,197,0.12)]"
                : "bg-[#10161D] border-[#202A34] hover:border-[#26313D]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#64717E] font-bold">
                02 · Standardization
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#151C24] text-[#9AA7B4] border border-[#26313D]">
                μ=0, σ=1
              </span>
            </div>
            <div className="my-1">
              <div className="text-sm font-mono font-bold text-[#F2F5F7]">
                StandardScaler
              </div>
              <div className="text-[11px] font-mono text-[#64717E] mt-0.5">
                {trace?.scaled_features
                  ? `PM2.5 z-score: ${trace.scaled_features["PM2.5"] >= 0 ? `+${trace.scaled_features["PM2.5"]}` : trace.scaled_features["PM2.5"]}`
                  : "Z-score normalization"}
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#35D0C5] pt-2 border-t border-[#202A34] mt-2 flex items-center justify-between">
              <span>12 Scaled Z-Scores</span>
              <span>→</span>
            </div>
          </div>

          {/* Stage 3: PCA Orthogonal Transformation */}
          <div
            onClick={() => setActiveTab("pca")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
              activeTab === "pca"
                ? "bg-[#18212B] border-[#35D0C5] shadow-[0_0_12px_rgba(53,208,197,0.12)]"
                : "bg-[#10161D] border-[#202A34] hover:border-[#26313D]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#64717E] font-bold">
                03 · PCA Projection
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#151C24] text-[#35D0C5] border border-[#35D0C5]/30 font-semibold">
                {trace?.pca?.total_variance_retained_pct ?? 96.2}% Var
              </span>
            </div>
            <div className="my-1">
              <div className="text-sm font-mono font-bold text-[#F2F5F7]">
                PCA (10 Comps)
              </div>
              <div className="text-[11px] font-mono text-[#64717E] mt-0.5">
                {trace?.pca?.components?.[0]
                  ? `PC1 score: ${trace.pca.components[0].score >= 0 ? `+${trace.pca.components[0].score}` : trace.pca.components[0].score}`
                  : "Orthogonal subspace"}
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#35D0C5] pt-2 border-t border-[#202A34] mt-2 flex items-center justify-between">
              <span>12D → 10D Space</span>
              <span>→</span>
            </div>
          </div>

          {/* Stage 4: Random Forest Ensemble */}
          <div
            onClick={() => setActiveTab("random_forest")}
            className={`p-3.5 rounded-xl border transition-all cursor-pointer flex flex-col justify-between select-none ${
              activeTab === "random_forest"
                ? "bg-[#18212B] border-[#35D0C5] shadow-[0_0_12px_rgba(53,208,197,0.12)]"
                : "bg-[#10161D] border-[#202A34] hover:border-[#26313D]"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#64717E] font-bold">
                04 · Random Forest
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.2 rounded bg-[#151C24] text-[#9AA7B4] border border-[#26313D]">
                {trace?.random_forest?.n_estimators ?? 400} Trees
              </span>
            </div>
            <div className="my-1">
              <div className="text-sm font-mono font-bold text-[#F2F5F7]">
                Ensemble Regressor
              </div>
              <div className="text-[11px] font-mono text-[#64717E] mt-0.5">
                Max Depth: {trace?.random_forest?.max_depth ?? 20}
              </div>
            </div>
            <div className="text-[10px] font-mono text-[#35D0C5] pt-2 border-t border-[#202A34] mt-2 flex items-center justify-between">
              <span>Non-linear Aggregation</span>
              <span>→</span>
            </div>
          </div>

          {/* Stage 5: Final Predicted AQI */}
          <div
            className="p-3.5 rounded-xl border transition-all flex flex-col justify-between relative overflow-hidden"
            style={{
              backgroundColor: "#18212B",
              borderColor: aqiInfo.color ? `${aqiInfo.color}60` : "#26313D",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-wider text-[#64717E] font-bold">
                05 · Predicted Output
              </span>
              <span
                className="text-[9px] font-mono px-1.5 py-0.2 rounded border font-bold uppercase"
                style={{
                  color: aqiInfo.color,
                  borderColor: `${aqiInfo.color}40`,
                  backgroundColor: `${aqiInfo.color}15`,
                }}
              >
                {activeResult?.category ?? aqiInfo.category}
              </span>
            </div>
            <div className="my-1 flex items-baseline gap-2">
              <div
                className="text-2xl font-mono font-extrabold tracking-tight"
                style={{ color: aqiInfo.color }}
              >
                {activeResult ? Math.round(activeResult.aqi) : "—"}
              </div>
              <span className="text-[10px] font-mono text-[#64717E]">AQI (CPCB)</span>
            </div>
            <div className="text-[10px] font-mono text-[#9AA7B4] pt-2 border-t border-[#202A34] mt-2 truncate">
              {activeResult?.inference_ms ? `${activeResult.inference_ms}ms inference` : "Deterministic Output"}
            </div>
          </div>
        </div>

        {/* ── DETAILED INTERACTIVE STAGE EXPLORATION AREA ── */}
        <div
          className="p-5 rounded-xl border transition-all"
          style={{
            backgroundColor: "#10161D",
            borderColor: "#202A34",
          }}
        >
          {/* Tab Navigation Header */}
          <div className="flex flex-wrap items-center justify-between gap-3 pb-3 mb-4 border-b border-[#202A34]">
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#F2F5F7] uppercase tracking-wider">
                Stage Deep-Dive:
              </span>
              <div className="flex items-center p-0.5 rounded-lg bg-[#151C24] border border-[#26313D] text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setActiveTab("overview")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === "overview"
                      ? "bg-[#18212B] text-[#35D0C5] font-semibold border border-[#35D0C5]/30"
                      : "text-[#64717E] hover:text-[#9AA7B4]"
                  }`}
                >
                  Raw Input Vector
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("scaler")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === "scaler"
                      ? "bg-[#18212B] text-[#35D0C5] font-semibold border border-[#35D0C5]/30"
                      : "text-[#64717E] hover:text-[#9AA7B4]"
                  }`}
                >
                  StandardScaler Z-Scores
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("pca")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === "pca"
                      ? "bg-[#18212B] text-[#35D0C5] font-semibold border border-[#35D0C5]/30"
                      : "text-[#64717E] hover:text-[#9AA7B4]"
                  }`}
                >
                  PCA Scores &amp; Loadings
                </button>
                <button
                  type="button"
                  onClick={() => setActiveTab("random_forest")}
                  className={`px-3 py-1 rounded-md transition-all ${
                    activeTab === "random_forest"
                      ? "bg-[#18212B] text-[#35D0C5] font-semibold border border-[#35D0C5]/30"
                      : "text-[#64717E] hover:text-[#9AA7B4]"
                  }`}
                >
                  Random Forest Ensemble
                </button>
              </div>
            </div>

            <div className="text-[11px] font-mono text-[#64717E]">
              {activeTab === "overview" && "12 Raw Atmospheric Measurements"}
              {activeTab === "scaler" && "Z = (X - μ) / σ Standardized Representation"}
              {activeTab === "pca" && "Eigenvector Loadings & Principal Components"}
              {activeTab === "random_forest" && "Multi-Tree Regression Ensemble"}
            </div>
          </div>

          {/* Tab 1: Raw Input Vector View */}
          {activeTab === "overview" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-mono text-[#9AA7B4] leading-relaxed">
                The feature vector consists of 12 speciated atmospheric pollutant concentrations collected from telemetry or user configuration.
              </p>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 pt-2">
                {FEATURE_SPECS.map((spec) => {
                  const val = activeInputs[spec.key];
                  const isChanged = changedKey === spec.key;
                  return (
                    <div
                      key={spec.key}
                      className={`p-3 rounded-lg border transition-all ${
                        isChanged
                          ? "bg-[#18212B] border-[#35D0C5] shadow-[0_0_8px_rgba(53,208,197,0.2)]"
                          : "bg-[#151C24] border-[#26313D]"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] font-mono text-[#64717E]">
                        <span className="font-bold text-[#F2F5F7]">{spec.label}</span>
                        <span>{spec.unit}</span>
                      </div>
                      <div className="text-base font-mono font-bold text-[#F2F5F7] my-1 tabular-nums">
                        {val}
                      </div>
                      <div className="text-[9px] font-mono text-[#47535E] truncate">
                        {spec.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 2: StandardScaler View */}
          {activeTab === "scaler" && (
            <div className="flex flex-col gap-3">
              <p className="text-xs font-mono text-[#9AA7B4] leading-relaxed">
                StandardScaler transforms each raw pollutant concentration by subtracting the empirical training mean (μ) and dividing by the standard deviation (σ), centering features at 0 with unit variance.
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 pt-2">
                {FEATURE_SPECS.map((spec) => {
                  const rawVal = activeInputs[spec.key];
                  const scaledVal = trace?.scaled_features?.[spec.key] ?? 0;
                  const meanVal = trace?.scaler_params?.means?.[spec.key] ?? 0;
                  const scaleVal = trace?.scaler_params?.scales?.[spec.key] ?? 1;
                  const isPositive = scaledVal >= 0;

                  return (
                    <div
                      key={spec.key}
                      className="p-3 rounded-lg bg-[#151C24] border border-[#26313D] flex flex-col justify-between gap-1.5"
                    >
                      <div className="flex items-center justify-between text-xs font-mono">
                        <span className="font-bold text-[#F2F5F7]">{spec.label}</span>
                        <span
                          className="font-bold tabular-nums text-xs px-1.5 py-0.5 rounded border"
                          style={{
                            color: isPositive ? "#F39A4A" : "#35D0C5",
                            borderColor: isPositive ? "#F39A4A40" : "#35D0C540",
                            backgroundColor: isPositive ? "#F39A4A10" : "#35D0C510",
                          }}
                        >
                          z = {isPositive ? `+${scaledVal}` : scaledVal}
                        </span>
                      </div>

                      <div className="flex items-center justify-between text-[11px] font-mono text-[#64717E] pt-1 border-t border-[#202A34]">
                        <span>Raw: <strong className="text-[#F2F5F7]">{rawVal} {spec.unit}</strong></span>
                        <span className="text-[10px] text-[#47535E]">μ={meanVal} · σ={scaleVal}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Tab 3: PCA Orthogonal Decomposition & Loadings View */}
          {activeTab === "pca" && (
            <div className="flex flex-col gap-4">
              <div className="flex flex-wrap items-center justify-between gap-3 text-xs font-mono">
                <p className="text-[#9AA7B4] max-w-xl">
                  PCA projects the 12-dimensional standardized feature space onto 10 orthogonal principal components, eliminating multicollinearity while preserving{" "}
                  <strong className="text-[#35D0C5] font-semibold">{trace?.pca?.total_variance_retained_pct ?? 96.2}%</strong> of total atmospheric variance.
                </p>
                <span className="text-[11px] text-[#64717E]">
                  Click a PC to inspect its component loadings
                </span>
              </div>

              {/* Principal Component Scores Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-5 lg:grid-cols-10 gap-2">
                {trace?.pca?.components?.map((pc) => {
                  const isSelected = pc.id === selectedPC;
                  return (
                    <button
                      key={pc.id}
                      type="button"
                      onClick={() => setSelectedPC(pc.id)}
                      className={`p-2 rounded-lg border text-left transition-all font-mono flex flex-col justify-between ${
                        isSelected
                          ? "bg-[#18212B] border-[#35D0C5] shadow-[0_0_8px_rgba(53,208,197,0.2)]"
                          : "bg-[#151C24] border-[#26313D] hover:border-[#35D0C5]/40"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-[#64717E]">
                        <span className="font-bold text-[#F2F5F7]">{pc.id}</span>
                        <span>{pc.explained_variance_pct}%</span>
                      </div>
                      <div className="text-xs font-bold my-1 tabular-nums text-[#F2F5F7]">
                        {pc.score >= 0 ? `+${pc.score}` : pc.score}
                      </div>
                      <div className="w-full bg-[#202A34] h-1 rounded-full overflow-hidden">
                        <div
                          className="bg-[#35D0C5] h-full"
                          style={{ width: `${Math.min(pc.explained_variance_pct * 2.5, 100)}%` }}
                        />
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Selected PC Loadings Matrix Inspector */}
              {selectedPCObject && (
                <div className="p-4 rounded-xl bg-[#151C24] border border-[#26313D] flex flex-col gap-3 mt-1">
                  <div className="flex items-center justify-between text-xs font-mono">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-[#35D0C5] uppercase tracking-wider">
                        {selectedPCObject.id} Loadings Matrix
                      </span>
                      <span className="text-[#64717E]">
                        (Eigenvector weights projecting features into {selectedPCObject.id})
                      </span>
                    </div>
                    <span className="text-[11px] text-[#9AA7B4]">
                      Explained Variance: <strong>{selectedPCObject.explained_variance_pct}%</strong>
                    </span>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
                    {FEATURE_SPECS.map((spec) => {
                      const loading = selectedPCLoadings[spec.key] ?? 0;
                      const absLoading = Math.abs(loading);
                      const isPositive = loading >= 0;

                      return (
                        <div
                          key={spec.key}
                          className="p-2.5 rounded-lg bg-[#10161D] border border-[#202A34] flex flex-col justify-between gap-1 text-xs font-mono"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-[#F2F5F7] font-semibold">{spec.label}</span>
                            <span
                              className="font-bold tabular-nums text-[11px]"
                              style={{ color: isPositive ? "#35D0C5" : "#F39A4A" }}
                            >
                              {isPositive ? `+${loading}` : loading}
                            </span>
                          </div>

                          <div className="w-full bg-[#18212B] h-1.5 rounded-full overflow-hidden flex items-center">
                            <div
                              className="h-full rounded-full"
                              style={{
                                width: `${Math.min(absLoading * 150, 100)}%`,
                                backgroundColor: isPositive ? "#35D0C5" : "#F39A4A",
                              }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Tab 4: Random Forest Ensemble View */}
          {activeTab === "random_forest" && (
            <div className="flex flex-col gap-4">
              <p className="text-xs font-mono text-[#9AA7B4] leading-relaxed">
                The Random Forest regressor comprises an ensemble of 400 deep decision trees (max depth: {trace?.random_forest?.max_depth ?? 20}) trained on the 10 PCA component subspace. Each tree computes an individual prediction, and the ensemble average forms the final predicted AQI.
              </p>

              {/* Sample Decision Tree Outputs */}
              <div className="flex flex-col gap-2">
                <div className="flex items-center justify-between text-xs font-mono">
                  <span className="font-bold text-[#F2F5F7] uppercase tracking-wider">
                    Ensemble Decision Tree Samples
                  </span>
                  <span className="text-[11px] text-[#64717E]">
                    Sampled across 400 estimator trees
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-8 gap-2">
                  {trace?.random_forest?.tree_samples?.map((tree) => (
                    <div
                      key={tree.tree_id}
                      className="p-2.5 rounded-lg bg-[#151C24] border border-[#26313D] text-center font-mono flex flex-col justify-between gap-1"
                    >
                      <span className="text-[10px] text-[#64717E]">Tree #{tree.tree_id}</span>
                      <span className="text-sm font-bold text-[#F2F5F7] tabular-nums">
                        {Math.round(tree.prediction)}
                      </span>
                      <span className="text-[9px] text-[#47535E]">AQI Sub-estimate</span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Aggregation Summary */}
              <div className="p-3.5 rounded-xl bg-[#151C24] border border-[#26313D] flex flex-wrap items-center justify-between gap-4 text-xs font-mono">
                <div className="flex items-center gap-2">
                  <span className="w-2 h-2 rounded-full bg-[#3CCB8E]" />
                  <span className="text-[#9AA7B4]">Ensemble Aggregation Rule:</span>
                  <strong className="text-[#F2F5F7]">AQI = (1 / 400) · Σ Tree_i(PCA_1..10)</strong>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[#64717E]">Ensemble Mean:</span>
                  <span className="text-base font-bold text-[#35D0C5] tabular-nums">
                    {activeResult ? Math.round(activeResult.aqi) : "—"} AQI
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

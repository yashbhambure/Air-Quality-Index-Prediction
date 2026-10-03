"use client";

import React, { useState, useEffect, useRef, useMemo, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  FEATURE_SPECS,
  PRIMARY_FEATURES,
  ADVANCED_FEATURES,
  SIMULATION_PRESETS,
  type FeatureSpec,
  type SimulationPreset,
} from "@/lib/constants";
import { formatAQI, getAQIInfo } from "@/lib/aqi";
import { fetchPredict } from "@/lib/api";
import type { PredictionInput, PredictionResult, SimulationHistoryItem, AQICategory } from "@/types/aqi";

// CPCB Breakpoints for boundary threshold calculations
const CPCB_THRESHOLDS = [
  { category: "Good" as AQICategory, min: 0, max: 50 },
  { category: "Satisfactory" as AQICategory, min: 51, max: 100 },
  { category: "Moderate" as AQICategory, min: 101, max: 200 },
  { category: "Poor" as AQICategory, min: 201, max: 300 },
  { category: "Very Poor" as AQICategory, min: 301, max: 400 },
  { category: "Severe" as AQICategory, min: 401, max: 500 },
];

function getCategoryThresholdProximity(aqi: number) {
  const currentCategory = getAQIInfo(aqi).category;
  const currentBand = CPCB_THRESHOLDS.find((b) => aqi <= b.max) || CPCB_THRESHOLDS[CPCB_THRESHOLDS.length - 1];
  const roundedAqi = Math.round(aqi);

  if (currentBand.max < 500) {
    const pointsToNext = currentBand.max - roundedAqi;
    const nextBand = CPCB_THRESHOLDS[CPCB_THRESHOLDS.indexOf(currentBand) + 1];
    if (pointsToNext >= 0 && pointsToNext <= 25 && nextBand) {
      return {
        text: `${pointsToNext} ${pointsToNext === 1 ? "point" : "points"} below ${nextBand.category} threshold`,
        isNearBoundary: true,
      };
    }
  }

  const pointsIntoBand = roundedAqi - currentBand.min;
  if (pointsIntoBand >= 0 && pointsIntoBand <= 15 && currentBand.min > 0) {
    return {
      text: `${pointsIntoBand} ${pointsIntoBand === 1 ? "point" : "points"} into ${currentBand.category} range`,
      isNearBoundary: false,
    };
  }

  return {
    text: `Within ${currentBand.category} boundary (${currentBand.min}–${currentBand.max})`,
    isNearBoundary: false,
  };
}

interface WhatIfSimulatorProps {
  baselineInputs: PredictionInput;
  baselineResult: PredictionResult | null;
  isModelConnected?: boolean;
}

/** Animated number counter for smooth AQI transitions */
function AnimatedAqiNumber({ value }: { value: number }) {
  const [displayValue, setDisplayValue] = useState(value);
  const targetValueRef = useRef(value);

  useEffect(() => {
    targetValueRef.current = value;
    const startVal = displayValue;
    const endVal = value;
    if (Math.round(startVal) === Math.round(endVal)) {
      setDisplayValue(endVal);
      return;
    }

    const duration = 500; // ms
    const startTime = performance.now();

    let animationFrameId: number;

    const updateNumber = (currentTime: number) => {
      const elapsed = currentTime - startTime;
      const progress = Math.min(elapsed / duration, 1);
      // ease-out cubic
      const ease = 1 - Math.pow(1 - progress, 3);
      const current = startVal + (endVal - startVal) * ease;

      setDisplayValue(current);

      if (progress < 1) {
        animationFrameId = requestAnimationFrame(updateNumber);
      } else {
        setDisplayValue(endVal);
      }
    };

    animationFrameId = requestAnimationFrame(updateNumber);

    return () => {
      if (animationFrameId) cancelAnimationFrame(animationFrameId);
    };
  }, [value]);

  return <span className="tabular-nums">{Math.round(displayValue)}</span>;
}

export function WhatIfSimulator({
  baselineInputs,
  baselineResult,
  isModelConnected = true,
}: WhatIfSimulatorProps) {
  // Independent simulation input state
  const [simulatedInputs, setSimulatedInputs] = useState<PredictionInput>(baselineInputs);
  const [simulatedResult, setSimulatedResult] = useState<PredictionResult | null>(baselineResult);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simulationError, setSimulationError] = useState<string | null>(null);
  const [isAdvanced, setIsAdvanced] = useState<boolean>(false);
  const [history, setHistory] = useState<SimulationHistoryItem[]>([]);

  // Refs for debouncing, sequencing, and AbortController
  const abortControllerRef = useRef<AbortController | null>(null);
  const reqSeqRef = useRef<number>(0);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const lastSimulatedInputsRef = useRef<string>(JSON.stringify(baselineInputs));
  const isInitialSyncRef = useRef<boolean>(true);

  // Sync simulator to baseline inputs on initial load or when baseline fundamentally resets
  useEffect(() => {
    if (isInitialSyncRef.current) {
      isInitialSyncRef.current = false;
      setSimulatedInputs(baselineInputs);
      setSimulatedResult(baselineResult);
      lastSimulatedInputsRef.current = JSON.stringify(baselineInputs);
      return;
    }

    // If simulatedInputs exactly matches old baseline, follow the new baseline
    const currentSimJson = JSON.stringify(simulatedInputs);
    if (currentSimJson === lastSimulatedInputsRef.current) {
      setSimulatedInputs(baselineInputs);
      setSimulatedResult(baselineResult);
      lastSimulatedInputsRef.current = JSON.stringify(baselineInputs);
    }
  }, [baselineInputs, baselineResult]);

  // Execute inference on simulated inputs
  const executeSimulation = useCallback(
    async (inputsToSimulate: PredictionInput) => {
      const inputsJson = JSON.stringify(inputsToSimulate);
      const baselineJson = JSON.stringify(baselineInputs);

      // If inputs match baseline exactly, reuse baseline prediction directly without network call
      if (inputsJson === baselineJson) {
        if (abortControllerRef.current) {
          abortControllerRef.current.abort();
          abortControllerRef.current = null;
        }
        setIsSimulating(false);
        setSimulationError(null);
        setSimulatedResult(baselineResult);
        lastSimulatedInputsRef.current = inputsJson;
        return;
      }

      // Abort any in-flight requests
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
      }
      const controller = new AbortController();
      abortControllerRef.current = controller;

      const seq = ++reqSeqRef.current;
      setIsSimulating(true);
      setSimulationError(null);

      try {
        const result = await fetchPredict(inputsToSimulate, {
          signal: controller.signal,
        });

        // Ensure only the latest request updates state
        if (seq === reqSeqRef.current) {
          setSimulatedResult(result);
          setIsSimulating(false);
          lastSimulatedInputsRef.current = inputsJson;

          // Record session history snapshot (max 5 items, distinct delta)
          if (baselineResult) {
            const delta = Math.round(result.aqi - baselineResult.aqi);
            if (Math.abs(delta) > 0) {
              const changedPollutants = FEATURE_SPECS.filter(
                (f) => inputsToSimulate[f.key] !== baselineInputs[f.key]
              )
                .map((f) => f.label)
                .join(", ");

              const historyItem: SimulationHistoryItem = {
                id: `sim_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
                timestamp: new Date().toLocaleTimeString("en-IN", {
                  hour: "2-digit",
                  minute: "2-digit",
                  second: "2-digit",
                }),
                label: changedPollutants || "Modified Atmosphere",
                inputs: { ...inputsToSimulate },
                baselineAqi: baselineResult.aqi,
                simulatedAqi: result.aqi,
                baselineCategory: baselineResult.category,
                simulatedCategory: result.category,
                deltaAqi: delta,
              };

              setHistory((prev) => [historyItem, ...prev.slice(0, 4)]);
            }
          }
        }
      } catch (err: unknown) {
        if ((err as { name?: string })?.name === "AbortError") {
          return; // Request was cleanly cancelled
        }
        if (seq === reqSeqRef.current) {
          setIsSimulating(false);
          setSimulationError("Unable to compute simulated prediction from model backend.");
        }
      }
    },
    [baselineInputs, baselineResult]
  );

  // Debounced input change handler
  const handleInputChange = (key: keyof PredictionInput, val: number) => {
    const spec = FEATURE_SPECS.find((f) => f.key === key);
    const clampedVal = spec ? Math.min(Math.max(val, spec.min), spec.max) : val;
    const roundedVal = Math.round(clampedVal * 10) / 10;

    const nextInputs: PredictionInput = {
      ...simulatedInputs,
      [key]: roundedVal,
    };

    setSimulatedInputs(nextInputs);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }

    debounceTimerRef.current = setTimeout(() => {
      executeSimulation(nextInputs);
    }, 350);
  };

  // Quick percentage nudge (-10% or +10%)
  const handleNudge = (key: keyof PredictionInput, percentDelta: number) => {
    const spec = FEATURE_SPECS.find((f) => f.key === key);
    if (!spec) return;

    const currentVal = simulatedInputs[key];
    const delta = (currentVal * percentDelta) / 100;
    const rawNew = currentVal + (delta >= 0 ? Math.max(delta, spec.step) : Math.min(delta, -spec.step));
    const clampedVal = Math.min(Math.max(rawNew, spec.min), spec.max);
    const roundedVal = Math.round(clampedVal * 10) / 10;

    const nextInputs: PredictionInput = {
      ...simulatedInputs,
      [key]: roundedVal,
    };

    setSimulatedInputs(nextInputs);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    debounceTimerRef.current = setTimeout(() => {
      executeSimulation(nextInputs);
    }, 200);
  };

  // Apply scenario preset
  const applyPreset = (preset: SimulationPreset) => {
    const nextInputs: PredictionInput = {
      ...simulatedInputs,
      ...preset.inputs,
    };

    setSimulatedInputs(nextInputs);

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    executeSimulation(nextInputs);
  };

  // Reset simulated values back to current baseline
  const handleResetToCurrent = () => {
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setSimulatedInputs(baselineInputs);
    setSimulatedResult(baselineResult);
    setIsSimulating(false);
    setSimulationError(null);
    lastSimulatedInputsRef.current = JSON.stringify(baselineInputs);
  };

  // Restore scenario from history
  const restoreHistoryItem = (item: SimulationHistoryItem) => {
    setSimulatedInputs(item.inputs);
    executeSimulation(item.inputs);
  };

  // Computed delta between baseline and simulation
  const deltaAqi = useMemo(() => {
    if (!baselineResult || !simulatedResult) return 0;
    return Math.round(simulatedResult.aqi - baselineResult.aqi);
  }, [baselineResult, simulatedResult]);

  const baselineInfo = useMemo(() => {
    return getAQIInfo(baselineResult?.aqi ?? 0);
  }, [baselineResult]);

  const simulatedInfo = useMemo(() => {
    return getAQIInfo(simulatedResult?.aqi ?? 0);
  }, [simulatedResult]);

  const isCategoryChanged = useMemo(() => {
    if (!baselineResult || !simulatedResult) return false;
    return baselineResult.category !== simulatedResult.category;
  }, [baselineResult, simulatedResult]);

  // Changed features list
  const changedFeatures = useMemo(() => {
    return FEATURE_SPECS.filter((spec) => {
      const bVal = baselineInputs[spec.key];
      const sVal = simulatedInputs[spec.key];
      return Math.abs(bVal - sVal) > 0.001;
    }).map((spec) => {
      const bVal = baselineInputs[spec.key];
      const sVal = simulatedInputs[spec.key];
      const diff = sVal - bVal;
      return {
        spec,
        baselineValue: bVal,
        simulatedValue: sVal,
        diff: Math.round(diff * 10) / 10,
      };
    });
  }, [baselineInputs, simulatedInputs]);

  const hasChanges = changedFeatures.length > 0;
  const visibleFeatures = isAdvanced ? FEATURE_SPECS : PRIMARY_FEATURES;
  const simulatedThresholdProximity = useMemo(() => {
    return getCategoryThresholdProximity(simulatedResult?.aqi ?? 0);
  }, [simulatedResult]);

  return (
    <div
      id="what-if-simulator"
      className="relative overflow-hidden rounded-2xl border transition-all duration-300"
      style={{
        backgroundColor: "#151C24",
        borderColor: "#26313D",
      }}
    >
      {/* ── Top Header / Status Bar ── */}
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
              What-If AQI Simulator
            </span>
            <span className="text-[11px] text-[#64717E] hidden md:inline">
              · Model Response to Atmospheric Perturbations
            </span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          {/* Flask Backend Connectivity Badge */}
          <div
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono border"
            style={{
              backgroundColor: isModelConnected ? "rgba(60, 203, 142, 0.08)" : "rgba(240, 91, 91, 0.08)",
              borderColor: isModelConnected ? "rgba(60, 203, 142, 0.25)" : "rgba(240, 91, 91, 0.25)",
              color: isModelConnected ? "#3CCB8E" : "#F05B5B",
            }}
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${
                isModelConnected ? "bg-[#3CCB8E] animate-pulse" : "bg-[#F05B5B]"
              }`}
            />
            <span>{isModelConnected ? "MODEL READY" : "FLASK OFFLINE"}</span>
          </div>

          {/* Reset Action */}
          <button
            type="button"
            onClick={handleResetToCurrent}
            disabled={!hasChanges && !isSimulating}
            className={`px-3 py-1 rounded-md text-xs font-mono transition-all flex items-center gap-1.5 border ${
              hasChanges
                ? "bg-[#18212B] text-[#35D0C5] border-[#35D0C5]/40 hover:bg-[#35D0C5]/10 shadow-sm"
                : "bg-[#10161D] text-[#64717E] border-[#202A34] cursor-not-allowed opacity-50"
            }`}
            title="Reset simulated atmospheric inputs back to current dashboard baseline"
          >
            <svg viewBox="0 0 16 16" fill="none" className="w-3 h-3">
              <path
                d="M3.5 8A4.5 4.5 0 1 1 8 12.5"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              <path
                d="M3.5 4.5V8H7"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
            <span>Reset to Baseline</span>
          </button>
        </div>
      </div>

      <div className="p-5 sm:p-7 flex flex-col gap-6">
        {/* ── Section 1: HERO COMPARISON (Current vs Simulated) ── */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-stretch">
          {/* Baseline Card */}
          <div
            className="md:col-span-5 p-4 sm:p-5 rounded-xl border flex flex-col justify-between relative overflow-hidden"
            style={{
              backgroundColor: "#10161D",
              borderColor: "#202A34",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[10px] font-mono uppercase tracking-widest text-[#64717E] font-semibold">
                Baseline Prediction
              </span>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border"
                style={{
                  color: baselineInfo.color,
                  backgroundColor: baselineInfo.tailwindBg.replace("bg-", "").replace("/10", ""),
                  borderColor: `${baselineInfo.color}40`,
                }}
              >
                {baselineResult?.category ?? baselineInfo.category}
              </span>
            </div>

            <div className="my-2 flex items-baseline gap-2">
              <div
                className="text-4xl sm:text-5xl font-preserved-value font-extrabold tracking-tight"
                style={{ color: baselineInfo.color }}
              >
                {baselineResult ? Math.round(baselineResult.aqi) : "—"}
              </div>
              <span className="text-xs font-mono text-[#64717E]">AQI</span>
            </div>

            <div className="text-[11px] font-mono text-[#9AA7B4] flex items-center justify-between border-t border-[#202A34] pt-2 mt-2">
              <span>Model Reference</span>
              <span className="text-[#64717E]">CPCB Index</span>
            </div>
          </div>

          {/* Middle Delta & Transition Metric */}
          <div
            className="md:col-span-2 p-4 rounded-xl border flex flex-col items-center justify-center text-center gap-1.5"
            style={{
              backgroundColor: "#18212B",
              borderColor: "#26313D",
            }}
          >
            <span className="text-[10px] font-mono uppercase tracking-wider text-[#64717E]">
              AQI Delta
            </span>

            <div className="flex items-center gap-1.5 my-0.5">
              {deltaAqi !== 0 && (
                <span
                  className="text-base font-bold font-mono"
                  style={{
                    color: deltaAqi > 0 ? "#F05B5B" : "#3CCB8E",
                  }}
                >
                  {deltaAqi > 0 ? "▲" : "▼"}
                </span>
              )}
              <span
                className="text-2xl font-preserved-value font-extrabold tracking-tight tabular-nums"
                style={{
                  color:
                    deltaAqi > 0
                      ? "#F05B5B"
                      : deltaAqi < 0
                      ? "#3CCB8E"
                      : "#9AA7B4",
                }}
              >
                {deltaAqi > 0 ? `+${deltaAqi}` : deltaAqi < 0 ? deltaAqi : "0"}
              </span>
            </div>

            {/* Inference Status / Progress Indicator */}
            {isSimulating ? (
              <div className="flex items-center gap-1 text-[10px] font-mono text-[#35D0C5]">
                <span className="w-2.5 h-2.5 border-2 border-[#35D0C5] border-t-transparent rounded-full animate-spin" />
                <span>Simulating…</span>
              </div>
            ) : isCategoryChanged ? (
              <div className="px-2 py-0.5 rounded text-[9px] font-mono font-bold uppercase bg-[#F3C969]/15 text-[#F3C969] border border-[#F3C969]/40 animate-pulse">
                Category Shift
              </div>
            ) : hasChanges ? (
              <span className="text-[10px] font-mono text-[#64717E]">
                Category Stable
              </span>
            ) : (
              <span className="text-[10px] font-mono text-[#64717E]">
                Baseline Match
              </span>
            )}
          </div>

          {/* Simulated Prediction Card */}
          <div
            className="md:col-span-5 p-4 sm:p-5 rounded-xl border flex flex-col justify-between relative overflow-hidden transition-colors duration-300"
            style={{
              backgroundColor: hasChanges ? "#18212B" : "#10161D",
              borderColor: hasChanges ? "#35D0C5" : "#202A34",
            }}
          >
            {hasChanges && (
              <div className="absolute top-0 right-0 w-24 h-24 bg-[#35D0C5]/5 rounded-full blur-xl pointer-events-none" />
            )}

            <div className="flex items-center justify-between mb-2">
              <div className="flex items-center gap-1.5">
                <span
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: simulatedInfo.color }}
                />
                <span className="text-[10px] font-mono uppercase tracking-widest text-[#35D0C5] font-semibold">
                  Simulated Prediction
                </span>
              </div>
              <span
                className="px-2 py-0.5 rounded text-[10px] font-mono font-bold uppercase border transition-colors duration-300"
                style={{
                  color: simulatedInfo.color,
                  backgroundColor: simulatedInfo.tailwindBg.replace("bg-", "").replace("/10", ""),
                  borderColor: `${simulatedInfo.color}40`,
                }}
              >
                {simulatedResult?.category ?? simulatedInfo.category}
              </span>
            </div>

            <div className="my-2 flex items-baseline gap-2">
              <div
                className="text-4xl sm:text-5xl font-preserved-value font-extrabold tracking-tight transition-colors duration-300"
                style={{ color: simulatedInfo.color }}
              >
                {simulatedResult ? (
                  <AnimatedAqiNumber value={simulatedResult.aqi} />
                ) : (
                  "—"
                )}
              </div>
              <span className="text-xs font-mono text-[#64717E]">AQI</span>
            </div>

            <div className="text-[11px] font-mono text-[#9AA7B4] flex items-center justify-between border-t border-[#202A34] pt-2 mt-2">
              <span className="truncate max-w-[200px]">
                {simulatedThresholdProximity.text}
              </span>
              <span className="text-[#35D0C5] text-[10px]">RF Inferred</span>
            </div>
          </div>
        </div>

        {/* ── Category Threshold Alert Banner (If Boundary Crossed) ── */}
        <AnimatePresence>
          {isCategoryChanged && baselineResult && simulatedResult && (
            <motion.div
              initial={{ opacity: 0, y: -6, height: 0 }}
              animate={{ opacity: 1, y: 0, height: "auto" }}
              exit={{ opacity: 0, y: -6, height: 0 }}
              transition={{ duration: 0.25 }}
              className="p-3 rounded-xl border flex flex-wrap items-center justify-between gap-3 text-xs font-mono"
              style={{
                backgroundColor: "rgba(243, 201, 105, 0.08)",
                borderColor: "rgba(243, 201, 105, 0.35)",
              }}
            >
              <div className="flex items-center gap-2">
                <span className="text-sm">⚠</span>
                <span className="font-bold text-[#F3C969]">
                  CATEGORY THRESHOLD CROSSED:
                </span>
                <span className="text-[#F2F5F7]">
                  {baselineResult.category} → {simulatedResult.category}
                </span>
              </div>
              <span className="text-[11px] text-[#9AA7B4]">
                Model classification shifted across CPCB breakpoint
              </span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Error Banner (If Flask Connection Fails) ── */}
        {simulationError && (
          <div className="p-3 rounded-xl border bg-[#F05B5B]/10 border-[#F05B5B]/30 text-xs font-mono text-[#F05B5B] flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span>✕</span>
              <span>{simulationError}</span>
            </div>
            <button
              type="button"
              onClick={() => executeSimulation(simulatedInputs)}
              className="px-2.5 py-1 rounded bg-[#F05B5B]/20 hover:bg-[#F05B5B]/30 border border-[#F05B5B]/40 text-[#F2F5F7] font-semibold transition-colors"
            >
              Retry
            </button>
          </div>
        )}

        {/* ── Section 2: SIMULATION CONTROLS & SCENARIOS ── */}
        <div className="flex flex-col gap-4">
          {/* Controls Bar Header */}
          <div
            className="flex flex-wrap items-center justify-between gap-3 pb-3 border-b"
            style={{ borderColor: "#202A34" }}
          >
            <div className="flex items-center gap-3">
              <span className="text-xs font-mono font-bold text-[#F2F5F7] uppercase tracking-wider">
                Simulated Atmosphere Parameters
              </span>

              {/* View Switcher: Core vs All 12 */}
              <div className="flex items-center p-0.5 rounded-lg bg-[#10161D] border border-[#26313D] text-xs font-mono">
                <button
                  type="button"
                  onClick={() => setIsAdvanced(false)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    !isAdvanced
                      ? "bg-[#18212B] text-[#35D0C5] font-semibold border border-[#26313D]"
                      : "text-[#64717E] hover:text-[#9AA7B4]"
                  }`}
                >
                  Core Drivers (6)
                </button>
                <button
                  type="button"
                  onClick={() => setIsAdvanced(true)}
                  className={`px-2.5 py-1 rounded-md transition-all ${
                    isAdvanced
                      ? "bg-[#18212B] text-[#35D0C5] font-semibold border border-[#26313D]"
                      : "text-[#64717E] hover:text-[#9AA7B4]"
                  }`}
                >
                  All Pollutants (12)
                </button>
              </div>
            </div>

            {/* Scenario Preset Chips */}
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-[10px] font-mono text-[#64717E] uppercase tracking-wider hidden sm:inline mr-1">
                Scenarios:
              </span>
              {SIMULATION_PRESETS.map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset)}
                  className="px-2.5 py-1 rounded-lg text-xs font-mono border transition-all hover:scale-[1.02] active:scale-[0.98]"
                  style={{
                    backgroundColor: "#10161D",
                    borderColor: "#202A34",
                    color: preset.color,
                  }}
                  title={preset.subtitle}
                >
                  {preset.name}
                </button>
              ))}
            </div>
          </div>

          {/* Sliders Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {visibleFeatures.map((spec) => {
              const currentSimVal = simulatedInputs[spec.key];
              const baselineVal = baselineInputs[spec.key];
              const isChanged = Math.abs(currentSimVal - baselineVal) > 0.001;
              const valDelta = currentSimVal - baselineVal;

              return (
                <div
                  key={spec.key}
                  className="p-3.5 rounded-xl border transition-all duration-200 flex flex-col justify-between"
                  style={{
                    backgroundColor: isChanged ? "#18212B" : "#10161D",
                    borderColor: isChanged ? "#35D0C5" : "#202A34",
                  }}
                >
                  {/* Item Header */}
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-1.5">
                      <span className="font-mono font-bold text-xs text-[#F2F5F7]">
                        {spec.label}
                      </span>
                      <span className="text-[10px] font-mono text-[#64717E]">
                        ({spec.unit})
                      </span>
                    </div>

                    <div className="flex items-center gap-1">
                      {isChanged && (
                        <span
                          className="text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded border"
                          style={{
                            color: valDelta > 0 ? "#F05B5B" : "#3CCB8E",
                            borderColor: valDelta > 0 ? "#F05B5B40" : "#3CCB8E40",
                            backgroundColor: valDelta > 0 ? "#F05B5B10" : "#3CCB8E10",
                          }}
                        >
                          {valDelta > 0 ? `+${Math.round(valDelta * 10) / 10}` : Math.round(valDelta * 10) / 10}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Slider & Quick Nudge Row */}
                  <div className="my-2 flex items-center gap-2.5">
                    <input
                      id={`whatif-slider-${spec.key}`}
                      type="range"
                      min={spec.min}
                      max={spec.max}
                      step={spec.step}
                      value={currentSimVal}
                      onChange={(e) =>
                        handleInputChange(spec.key, parseFloat(e.target.value) || 0)
                      }
                      className="flex-1 accent-[#35D0C5] h-1.5 bg-[#151C24] rounded-lg cursor-pointer"
                      aria-label={`Simulated ${spec.label} concentration`}
                    />

                    {/* Numeric Input */}
                    <div className="flex items-center gap-1.5 bg-[#151C24] border border-[#26313D] focus-within:border-[#35D0C5] px-2.5 py-1 rounded-lg shrink-0 transition-colors">
                      <input
                        type="number"
                        min={spec.min}
                        max={spec.max}
                        step={spec.step}
                        value={currentSimVal}
                        onChange={(e) =>
                          handleInputChange(spec.key, parseFloat(e.target.value) || 0)
                        }
                        className="w-[5.5ch] bg-transparent text-left font-mono text-xs font-bold text-[#F2F5F7] focus:outline-none tabular-nums tracking-tight"
                        aria-label={`Simulated ${spec.label} value`}
                      />
                      <span className="text-[10px] font-mono text-[#64717E] shrink-0 select-none">
                        {spec.unit}
                      </span>
                    </div>
                  </div>

                  {/* Nudges & Bounds */}
                  <div className="flex items-center justify-between text-[9px] font-mono text-[#64717E] mt-1 pt-1 border-t border-[#202A34]">
                    <span>
                      Baseline: <strong className="text-[#9AA7B4]">{baselineVal}</strong>
                    </span>
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleNudge(spec.key, -10)}
                        className="px-1.5 py-0.5 rounded bg-[#151C24] hover:bg-[#202A34] text-[#9AA7B4] border border-[#26313D] transition-colors"
                        title="Decrease by 10%"
                      >
                        −10%
                      </button>
                      <button
                        type="button"
                        onClick={() => handleNudge(spec.key, 10)}
                        className="px-1.5 py-0.5 rounded bg-[#151C24] hover:bg-[#202A34] text-[#9AA7B4] border border-[#26313D] transition-colors"
                        title="Increase by 10%"
                      >
                        +10%
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* ── Section 3: "WHAT CHANGED?" & MODEL RESPONSE SUMMARY ── */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
          {/* Parameter Deltas Strip */}
          <div
            className="lg:col-span-7 p-4 rounded-xl border flex flex-col justify-between"
            style={{
              backgroundColor: "#10161D",
              borderColor: "#202A34",
            }}
          >
            <div className="flex items-center justify-between mb-2.5">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#9AA7B4] font-bold">
                Modified Parameters Breakdown
              </span>
              <span className="text-[10px] font-mono text-[#64717E]">
                {changedFeatures.length} {changedFeatures.length === 1 ? "pollutant changed" : "pollutants changed"}
              </span>
            </div>

            {hasChanges ? (
              <div className="flex flex-wrap gap-2 py-1 max-h-[140px] overflow-y-auto">
                {changedFeatures.map((item) => (
                  <div
                    key={item.spec.key}
                    className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-[#18212B] border border-[#26313D] text-xs font-mono"
                  >
                    <span className="font-bold text-[#F2F5F7]">{item.spec.label}:</span>
                    <span className="text-[#64717E]">{item.baselineValue}</span>
                    <span className="text-[#35D0C5]">→</span>
                    <span className="font-semibold text-[#F2F5F7]">{item.simulatedValue}</span>
                    <span
                      className="text-[10px] font-bold ml-1"
                      style={{ color: item.diff > 0 ? "#F05B5B" : "#3CCB8E" }}
                    >
                      ({item.diff > 0 ? `+${item.diff}` : item.diff} {item.spec.unit})
                    </span>
                  </div>
                ))}
              </div>
            ) : (
              <div className="py-4 text-center text-xs font-mono text-[#64717E] flex flex-col items-center justify-center gap-1">
                <span>Ready to Simulate</span>
                <span className="text-[10px] text-[#47535E]">
                  Adjust any pollutant concentration slider above or pick a scenario to observe model response.
                </span>
              </div>
            )}

            <div className="pt-2 mt-2 border-t border-[#202A34] flex items-center justify-between text-[10px] font-mono text-[#64717E]">
              <span>Inference Protocol:</span>
              <span className="text-[#9AA7B4]">StandardScaler → 10 PCA Components → 400 RF Trees</span>
            </div>
          </div>

          {/* Academic Model Sensitivity Insight */}
          <div
            className="lg:col-span-5 p-4 rounded-xl border flex flex-col justify-between"
            style={{
              backgroundColor: "#10161D",
              borderColor: "#202A34",
            }}
          >
            <div className="flex items-center justify-between mb-2">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#9AA7B4] font-bold">
                Model Sensitivity Insight
              </span>
              <span className="text-[9px] font-mono px-1.5 py-0.5 rounded bg-[#35D0C5]/10 text-[#35D0C5] border border-[#35D0C5]/30">
                Non-Causal Predictive
              </span>
            </div>

            <p className="text-xs font-mono text-[#9AA7B4] leading-relaxed my-1">
              {hasChanges && baselineResult && simulatedResult ? (
                <>
                  Under this simulated atmospheric vector, the trained Random Forest model predicts an AQI of{" "}
                  <strong className="text-[#F2F5F7] font-semibold">
                    {Math.round(simulatedResult.aqi)}
                  </strong>{" "}
                  (Δ {deltaAqi > 0 ? `+${deltaAqi}` : deltaAqi} AQI). Category:{" "}
                  <strong className="text-[#F2F5F7] font-semibold">
                    {simulatedResult.category}
                  </strong>.
                </>
              ) : (
                <>
                  The simulator executes the full machine learning inference pipeline on your hypothetical atmospheric vector without mutating baseline dashboard data.
                </>
              )}
            </p>

            <div className="text-[10px] font-mono text-[#47535E] border-t border-[#202A34] pt-2 mt-2">
              Note: Model output reflects statistical sensitivity on historical CPCB telemetry and does not represent a causal or chemical transport model.
            </div>
          </div>
        </div>

        {/* ── Section 4: SESSION SCENARIO HISTORY LOG (If entries exist) ── */}
        {history.length > 0 && (
          <div
            className="p-4 rounded-xl border flex flex-col gap-2.5"
            style={{
              backgroundColor: "#10161D",
              borderColor: "#202A34",
            }}
          >
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono uppercase tracking-wider text-[#64717E] font-bold">
                Recent Session Simulations ({history.length})
              </span>
              <span className="text-[10px] font-mono text-[#47535E]">
                Click any scenario to re-apply
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2">
              {history.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => restoreHistoryItem(item)}
                  className="p-2.5 rounded-lg bg-[#151C24] hover:bg-[#18212B] border border-[#26313D] hover:border-[#35D0C5]/40 text-left transition-all flex flex-col justify-between gap-1"
                >
                  <div className="flex items-center justify-between text-[10px] font-mono text-[#64717E]">
                    <span className="truncate max-w-[120px] font-semibold text-[#9AA7B4]">
                      {item.label}
                    </span>
                    <span>{item.timestamp}</span>
                  </div>

                  <div className="flex items-center justify-between text-xs font-mono">
                    <span className="text-[#64717E]">
                      {Math.round(item.baselineAqi)} →{" "}
                      <strong className="text-[#F2F5F7] font-bold">
                        {Math.round(item.simulatedAqi)}
                      </strong>
                    </span>
                    <span
                      className="font-bold text-[11px]"
                      style={{ color: item.deltaAqi > 0 ? "#F05B5B" : "#3CCB8E" }}
                    >
                      {item.deltaAqi > 0 ? `+${item.deltaAqi}` : item.deltaAqi}
                    </span>
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

"use client";

import { motion, AnimatePresence } from "framer-motion";
import { useEffect, useRef, useState, useCallback } from "react";
import { usePredict } from "@/hooks/usePredict";
import {
  FEATURE_SPECS,
  DEFAULT_INPUT,
  PRIMARY_FEATURES,
  ADVANCED_FEATURES,
  type FeatureSpec,
} from "@/lib/constants";
import type { PredictionInput, PredictionResult } from "@/types/aqi";

interface PredictionFormProps {
  onResult: (result: PredictionResult) => void;
  onLoadingChange?: (loading: boolean) => void;
  onInputChange?: (inputs: PredictionInput) => void;
  onLiveInferenceChange?: (live: boolean) => void;
}

export function PredictionForm({
  onResult,
  onLoadingChange,
  onInputChange,
  onLiveInferenceChange,
}: PredictionFormProps) {
  const [inputs, setInputs] = useState<PredictionInput>(DEFAULT_INPUT);
  const [isAdvanced, setIsAdvanced] = useState(false);
  const [liveInference, setLiveInference] = useState(true);
  const { mutate, isPending } = usePredict();

  const reqSeqRef = useRef(0);
  const hasMountedRef = useRef(false);
  const debounceTimerRef = useRef<NodeJS.Timeout | null>(null);

  const runPrediction = useCallback(
    (valuesToPredict: PredictionInput) => {
      const seq = ++reqSeqRef.current;
      onLoadingChange?.(true);

      mutate(valuesToPredict, {
        onSuccess: (data) => {
          // Prevent older responses from overwriting newer ones
          if (seq === reqSeqRef.current) {
            onResult(data);
            onLoadingChange?.(false);
          }
        },
        onError: () => {
          if (seq === reqSeqRef.current) {
            onLoadingChange?.(false);
          }
        },
      });
    },
    [mutate, onLoadingChange, onResult]
  );

  // Initial mount prediction (runs once on startup)
  useEffect(() => {
    if (!hasMountedRef.current) {
      hasMountedRef.current = true;
      runPrediction(DEFAULT_INPUT);
    }
  }, [runPrediction]);

  // Clean field change handler (guarantees exact flat key update, e.g. "PM2.5")
  const handleFieldChange = (key: keyof PredictionInput, val: number) => {
    const spec = FEATURE_SPECS.find((f) => f.key === key);
    const clampedVal = spec ? Math.min(Math.max(val, spec.min), spec.max) : val;
    const roundedVal = Math.round(clampedVal * 10) / 10;

    const nextInputs: PredictionInput = {
      ...inputs,
      [key]: roundedVal,
    };

    setInputs(nextInputs);
    onInputChange?.(nextInputs);

    if (liveInference) {
      if (debounceTimerRef.current) clearTimeout(debounceTimerRef.current);
      debounceTimerRef.current = setTimeout(() => {
        runPrediction(nextInputs);
      }, 350);
    }
  };

  const toggleLiveInference = () => {
    const next = !liveInference;
    setLiveInference(next);
    onLiveInferenceChange?.(next);
    if (next) {
      runPrediction(inputs);
    }
  };

  const setPreset = (presetType: "delhi_smog" | "clean_monsoon" | "moderate_urban") => {
    let preset: PredictionInput;
    if (presetType === "delhi_smog") {
      preset = {
        "PM2.5": 210,
        PM10: 340,
        NO: 55,
        NO2: 95,
        NOx: 120,
        NH3: 45,
        CO: 3.8,
        SO2: 35,
        O3: 85,
        Benzene: 12,
        Toluene: 28,
        Xylene: 8,
      };
    } else if (presetType === "clean_monsoon") {
      preset = {
        "PM2.5": 18,
        PM10: 35,
        NO: 6,
        NO2: 12,
        NOx: 16,
        NH3: 8,
        CO: 0.4,
        SO2: 5,
        O3: 25,
        Benzene: 0.8,
        Toluene: 1.5,
        Xylene: 0.5,
      };
    } else {
      preset = { ...DEFAULT_INPUT };
    }
    setInputs(preset);
    onInputChange?.(preset);
    runPrediction(preset);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    runPrediction(inputs);
  };

  // Group primary into Particulate and Gaseous
  const particulates = PRIMARY_FEATURES.filter((f) => f.key === "PM2.5" || f.key === "PM10");
  const gases = PRIMARY_FEATURES.filter((f) => f.key !== "PM2.5" && f.key !== "PM10");

  return (
    <form
      onSubmit={handleSubmit}
      className="flex flex-col gap-6"
      id="pollutant-form"
    >
      {/* ── Header Controls & Quick Scenarios ── */}
      <div
        className="flex flex-wrap items-center justify-between gap-4 pb-4 border-b"
        style={{ borderColor: "#202A34" }}
      >
        <div className="flex flex-wrap items-center gap-3">
          {/* Toggle Feature View Mode */}
          <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#10161D] border border-[#26313D]">
            <button
              type="button"
              id="toggle-simple-mode"
              onClick={() => setIsAdvanced(false)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
                !isAdvanced
                  ? "bg-[#18212B] text-[#35D0C5] shadow-sm border border-[#26313D]"
                  : "text-[#CBD5E1] hover:text-[#FFFFFF]"
              }`}
            >
              Core Drivers (6)
            </button>
            <button
              type="button"
              id="toggle-advanced-mode"
              onClick={() => setIsAdvanced(true)}
              className={`px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all ${
                isAdvanced
                  ? "bg-[#18212B] text-[#35D0C5] shadow-sm border border-[#26313D]"
                  : "text-[#CBD5E1] hover:text-[#FFFFFF]"
              }`}
            >
              All Pollutants (12)
            </button>
          </div>

          {/* Live Inference Auto Mode Toggle */}
          <button
            type="button"
            id="toggle-live-inference"
            onClick={toggleLiveInference}
            className={`px-3 py-1.5 rounded-lg text-xs font-mono font-medium border flex items-center gap-2 transition-all ${
              liveInference
                ? "bg-[#35D0C5]/10 border-[#35D0C5]/40 text-[#35D0C5]"
                : "bg-[#10161D] border-[#26313D] text-[#94A3B8] hover:text-[#CBD5E1]"
            }`}
          >
            <span
              className={`w-2 h-2 rounded-full ${
                liveInference ? "bg-[#35D0C5] animate-pulse" : "bg-[#8292A1]"
              }`}
            />
            <span>{liveInference ? "Live Inference Active" : "Manual Compute Mode"}</span>
          </button>
        </div>

        {/* Quick Scenario Selectors */}
        <div className="flex items-center gap-2">
          <span className="text-[11px] font-mono uppercase tracking-wider text-[#CBD5E1] font-medium hidden sm:inline">
            Presets:
          </span>
          <button
            type="button"
            onClick={() => setPreset("clean_monsoon")}
            className="text-xs font-mono px-3 py-1.5 rounded-lg bg-[#10161D] border border-[#202A34] text-[#3CCB8E] hover:border-[#3CCB8E]/50 hover:bg-[#3CCB8E]/10 transition-all font-medium"
          >
            Monsoon Clean
          </button>
          <button
            type="button"
            onClick={() => setPreset("moderate_urban")}
            className="text-xs font-mono px-3 py-1.5 rounded-lg bg-[#10161D] border border-[#202A34] text-[#F3C969] hover:border-[#F3C969]/50 hover:bg-[#F3C969]/10 transition-all font-medium"
          >
            Standard City
          </button>
          <button
            type="button"
            onClick={() => setPreset("delhi_smog")}
            className="text-xs font-mono px-3 py-1.5 rounded-lg bg-[#10161D] border border-[#202A34] text-[#F05B5B] hover:border-[#F05B5B]/50 hover:bg-[#F05B5B]/10 transition-all font-medium"
          >
            Severe Smog
          </button>
        </div>
      </div>

      {/* ── Group 1: Particulate Matter ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#35D0C5]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#FFFFFF]">
              Particulate Matter (PM2.5 &amp; PM10)
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#94A3B8]">
            Dominant Variance Drivers
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {particulates.map((spec) => (
            <FeatureCard
              key={spec.key}
              spec={spec}
              value={inputs[spec.key]}
              onChange={(val) => handleFieldChange(spec.key, val)}
            />
          ))}
        </div>
      </div>

      {/* ── Group 2: Combustion & Gaseous Pollutants ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="w-1.5 h-1.5 rounded-full bg-[#5CE1E6]" />
            <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#FFFFFF]">
              Combustion &amp; Gaseous Pollutants
            </h3>
          </div>
          <span className="text-[11px] font-mono text-[#94A3B8]">
            NO₂, SO₂, CO, O₃
          </span>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {gases.map((spec) => (
            <FeatureCard
              key={spec.key}
              spec={spec}
              value={inputs[spec.key]}
              onChange={(val) => handleFieldChange(spec.key, val)}
            />
          ))}
        </div>
      </div>

      {/* ── Group 3: Advanced Speciation / VOCs (Animated Disclosure) ── */}
      <AnimatePresence initial={false}>
        {isAdvanced && (
          <motion.div
            key="advanced"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: "easeInOut" }}
            style={{ overflow: "hidden" }}
          >
            <div className="pt-4 border-t" style={{ borderColor: "#202A34" }}>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-[#94A3B8]" />
                  <h3 className="text-xs font-mono font-bold uppercase tracking-wider text-[#CBD5E1]">
                    Secondary Speciation &amp; Volatile Organic Compounds (VOCs)
                  </h3>
                </div>
                <span className="text-[11px] font-mono text-[#94A3B8]">
                  Projected into Orthogonal Subspace
                </span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {ADVANCED_FEATURES.map((spec) => (
                  <FeatureCard
                    key={spec.key}
                    spec={spec}
                    value={inputs[spec.key]}
                    onChange={(val) => handleFieldChange(spec.key, val)}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Action Button ── */}
      <div className="pt-2">
        <motion.button
          id="predict-button"
          type="submit"
          disabled={isPending}
          whileTap={{ scale: 0.99 }}
          whileHover={{ scale: 1.005 }}
          className={`
            w-full py-3.5 rounded-xl font-mono font-bold text-sm tracking-wider uppercase
            transition-all duration-200 flex items-center justify-center gap-2.5 shadow-lg
            ${
              isPending
                ? "bg-[#18212B] text-[#94A3B8] border border-[#26313D] cursor-not-allowed"
                : "bg-[#35D0C5] text-[#0B0F14] hover:bg-[#5CE1E6] shadow-[0_0_20px_rgba(53,208,197,0.25)]"
            }
          `}
        >
          {isPending ? (
            <>
              <span className="w-4 h-4 border-2 border-[#94A3B8] border-t-[#35D0C5] rounded-full animate-spin" />
              <span>Projecting Atmosphere via Random Forest…</span>
            </>
          ) : (
            <>
              <svg viewBox="0 0 20 20" fill="currentColor" className="w-4 h-4">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.75-11.25a.75.75 0 00-1.5 0v2.5h-2.5a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z" clipRule="evenodd" />
              </svg>
              <span>{liveInference ? "Re-compute Model Inference" : "Compute AQI & Atmosphere"}</span>
            </>
          )}
        </motion.button>
      </div>
    </form>
  );
}

interface FeatureCardProps {
  spec: FeatureSpec;
  value: number;
  onChange: (val: number) => void;
  error?: string;
}

function FeatureCard({ spec, value, onChange, error }: FeatureCardProps) {
  const val = typeof value === "number" && !isNaN(value) ? value : spec.defaultValue;
  const ratio = (val - spec.min) / (spec.max - spec.min);

  // Status context
  let statusLabel = "Normal";
  let statusColor = "#3CCB8E";
  if (ratio > 0.65) {
    statusLabel = "Critical";
    statusColor = "#F05B5B";
  } else if (ratio > 0.35) {
    statusLabel = "Elevated";
    statusColor = "#F3C969";
  }

  return (
    <div
      className="p-4 rounded-xl border transition-all duration-200 flex flex-col justify-between"
      style={{
        backgroundColor: "#18212B",
        borderColor: "#26313D",
      }}
    >
      {/* Header: Label, Unit & Status */}
      <div className="flex items-center justify-between mb-2">
        <div className="flex flex-col">
          <span className="font-mono font-bold text-sm text-[#FFFFFF]">
            {spec.label}
          </span>
          <span className="text-[11px] font-mono text-[#94A3B8] truncate max-w-[140px] font-medium">
            {spec.description}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <span
            className="px-2 py-0.5 rounded text-[10px] font-mono uppercase font-semibold border"
            style={{
              color: statusColor,
              borderColor: `${statusColor}40`,
              backgroundColor: `${statusColor}15`,
            }}
          >
            {statusLabel}
          </span>
        </div>
      </div>

      {/* Direct Number Input & Slider Track */}
      <div className="my-2.5 flex items-center gap-3">
        <input
          id={`slider-${spec.key}`}
          type="range"
          min={spec.min}
          max={spec.max}
          step={spec.step}
          value={val}
          onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
          className="flex-1 accent-[#35D0C5] h-1.5 bg-[#10161D] rounded-lg cursor-pointer"
          aria-label={`${spec.label} slider`}
        />
        <div className="flex items-center gap-1.5 bg-[#10161D] border border-[#202A34] focus-within:border-[#35D0C5] px-2.5 py-1 rounded-lg shrink-0 transition-colors">
          <input
            type="number"
            min={spec.min}
            max={spec.max}
            step={spec.step}
            value={val}
            onChange={(e) => onChange(parseFloat(e.target.value) || 0)}
            className="w-[5.5ch] bg-transparent text-left font-mono text-xs font-bold text-[#FFFFFF] focus:outline-none tabular-nums tracking-tight"
            aria-label={`${spec.label} value`}
          />
          <span className="text-[11px] font-mono text-[#CBD5E1] shrink-0 select-none font-medium">
            {spec.unit}
          </span>
        </div>
      </div>

      {/* Min / Max bounds */}
      <div className="flex items-center justify-between text-[10px] font-mono text-[#94A3B8] font-medium">
        <span>{spec.min} {spec.unit}</span>
        <span>{spec.max} {spec.unit}</span>
      </div>

      {error && (
        <span className="text-[11px] font-mono text-[#F05B5B] mt-1 font-medium">{error}</span>
      )}
    </div>
  );
}

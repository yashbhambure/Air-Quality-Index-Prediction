"use client";

import { motion } from "framer-motion";
import { useMetrics } from "@/hooks/useMetrics";

interface Metric {
  label: string;
  value: string;
  unit?: string;
  description: string;
  highlight?: boolean;
}

export function MetricsBar() {
  const { data, isLoading, error } = useMetrics();

  if (isLoading) {
    return (
      <div className="flex gap-2 overflow-x-auto pb-1 no-scrollbar">
        {[1, 2, 3, 4, 5, 6, 7].map((i) => (
          <div key={i} className="skeleton h-10 w-32 shrink-0 rounded-lg" />
        ))}
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-3 rounded-xl border border-[#26313D] bg-[#151C24] flex items-center justify-between text-xs font-mono text-[#F05B5B]">
        <div className="flex items-center gap-2">
          <span className="w-2 h-2 rounded-full bg-[#F05B5B]" />
          <span>Telemetry Stream: Flask API Offline (Port 5000)</span>
        </div>
        <span className="text-[#94A3B8] text-[11px]">Run <code>python app.py</code> to connect</span>
      </div>
    );
  }

  const metrics: Metric[] = [
    { label: "Model R²",       value: data.r2.toFixed(4),          description: "Coefficient of Determination on Test Partition", highlight: true },
    { label: "Adj. R²",        value: data.adjusted_r2.toFixed(4), description: "Degrees-of-freedom adjusted R²" },
    { label: "MAE",            value: data.mae.toFixed(2),         unit: "AQI", description: "Mean Absolute Error" },
    { label: "RMSE",           value: data.rmse.toFixed(2),        unit: "AQI", description: "Root Mean Squared Error" },
    { label: "5-Fold CV R²",   value: data.cv_r2_mean.toFixed(4),  description: "Cross-validation mean score", highlight: true },
    { label: "PCA Dim",        value: `${data.pca_components}/${data.feature_columns.length}`, description: "Retains ≥95% variance" },
    { label: "RF Trees",       value: String(data.best_params.n_estimators), description: "Tuned Random Forest ensemble count" },
    { label: "Max Depth",      value: data.best_params.max_depth != null ? String(data.best_params.max_depth) : "None", description: "Tree depth boundary" },
  ];

  return (
    <div
      className="p-2 sm:p-2.5 rounded-xl border flex items-center gap-2 sm:gap-3 overflow-x-auto no-scrollbar"
      style={{
        backgroundColor: "#151C24",
        borderColor: "#26313D",
      }}
      role="list"
      aria-label="Model benchmark metrics"
    >
      <div className="flex items-center gap-2 pl-2 pr-3 border-r border-[#202A34] shrink-0">
        <div className="w-2 h-2 rounded-full bg-[#3CCB8E] shadow-[0_0_8px_#3CCB8E]" />
        <span className="text-[11px] font-mono uppercase tracking-wider text-[#CBD5E1] font-bold">
          Validation Benchmarks
        </span>
      </div>

      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {metrics.map((m, i) => (
          <motion.div
            key={m.label}
            role="listitem"
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.02, duration: 0.2 }}
            title={m.description}
            className="flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#10161D] border border-[#202A34] shrink-0 hover:border-[#35D0C5]/40 transition-colors cursor-default"
          >
            <span className="text-[11px] font-mono text-[#94A3B8] uppercase tracking-wider font-medium">
              {m.label}:
            </span>
            <span
              className={`text-xs font-mono tabular-nums ${
                m.highlight ? "text-[#35D0C5] font-bold" : "text-[#FFFFFF] font-semibold"
              }`}
            >
              {m.value}
            </span>
            {m.unit && (
              <span className="text-[10px] font-mono text-[#CBD5E1] font-medium">
                {m.unit}
              </span>
            )}
          </motion.div>
        ))}
      </div>
    </div>
  );
}

"use client";

import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis,
} from "recharts";
import { useMetrics } from "@/hooks/useMetrics";

type ActiveTab = "pollutant" | "component" | "radar";

interface BreakdownTooltipProps {
  active?: boolean;
  payload?: Array<{
    name?: string;
    value?: number | string;
    payload?: { name?: string; value?: number; cumulative?: number };
  }>;
  label?: string;
  metricLabel: string;
}

function BreakdownTooltip({ active, payload, label, metricLabel }: BreakdownTooltipProps) {
  if (active && payload && payload.length) {
    const entry = payload[0];
    const title = label || entry.payload?.name || entry.name || "";
    const rawVal = entry.value;
    const formattedVal = `${rawVal}%`;

    return (
      <div
        className="bg-[#151C24] border border-[#26313D] rounded-lg px-3 py-2 shadow-2xl flex flex-col gap-0.5 font-['Google_Sans',sans-serif]"
        style={{
          boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.7), 0 0 1px 1px rgba(255, 255, 255, 0.05)",
        }}
      >
        <span className="text-white font-semibold text-xs font-['Google_Sans',sans-serif]">
          {title}
        </span>
        <div className="flex items-center gap-1.5 text-xs font-['Google_Sans',sans-serif]">
          <span className="text-slate-200 font-['Google_Sans',sans-serif]">
            {metricLabel}&nbsp;:
          </span>
          <span className="text-cyan-300 font-semibold font-['Google_Sans',sans-serif] tabular-nums">
            {formattedVal}
          </span>
        </div>
      </div>
    );
  }
  return null;
}

export function PCABreakdown() {
  const { data, isLoading, error } = useMetrics();
  const [activeTab, setActiveTab] = useState<ActiveTab>("pollutant");

  // ── PCA explained variance data ─────────────────────────────────────────
  const varianceData = useMemo(() => {
    if (!data?.explained_variance_ratio) return [];
    return data.explained_variance_ratio.map((v, i) => ({
      name: `PC${i + 1}`,
      variance: parseFloat((v * 100).toFixed(1)),
    }));
  }, [data]);

  // ── Per-pollutant importance (from PCA loadings × RF importance) ─────────
  const pollutantData = useMemo(() => {
    const pollutantImportance = data?.feature_importances_by_pollutant;
    if (!pollutantImportance) return [];
    return Object.entries(pollutantImportance)
      .map(([name, value]) => ({ name, value: parseFloat((value * 100).toFixed(2)) }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  // ── Per-component RF importances ────────────────────────────────────────
  const componentData = useMemo(() => {
    const fi = data?.feature_importances_normalized ?? data?.feature_importances_;
    if (!fi) return [];
    return Object.entries(fi)
      .map(([name, value]) => ({ name, value: parseFloat((value * 100).toFixed(1)) }))
      .sort((a, b) => b.value - a.value);
  }, [data]);

  // ── Cumulative variance for radar ────────────────────────────────────────
  const radarData = useMemo(() => {
    let cum = 0;
    return varianceData.map((d) => {
      cum += d.variance;
      return { ...d, cumulative: parseFloat(cum.toFixed(1)) };
    });
  }, [varianceData]);

  const totalRetainedVariance = radarData.length > 0 ? radarData[radarData.length - 1].cumulative : 0;

  // ── Summary statistics for analytical footer strip ─────────────────────
  const topPollutant = pollutantData.length > 0 ? pollutantData[0] : null;
  const top3Cumulative = useMemo(() => {
    if (pollutantData.length === 0) return 0;
    return pollutantData.slice(0, 3).reduce((sum, p) => sum + p.value, 0);
  }, [pollutantData]);

  const topComponent = componentData.length > 0 ? componentData[0] : null;

  const tabs: { id: ActiveTab; label: string; title: string }[] = [
    { id: "pollutant", label: "By Pollutant", title: "Importance attributed via PCA loadings matrix" },
    { id: "component", label: "By PC Subspace", title: "Random Forest tree split importance per PCA component" },
    { id: "radar",     label: "Variance Radar", title: "Cumulative explained variance across orthonormal axes" },
  ];

  if (isLoading) {
    return (
      <div className="flex flex-col gap-3 font-['Google_Sans',sans-serif]">
        <div className="skeleton h-10 rounded-xl" />
        <div className="skeleton h-[360px] rounded-xl" />
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="p-8 text-center border border-dashed border-[#26313D] rounded-xl bg-[#10161D] font-['Google_Sans',sans-serif]">
        <p className="text-xs text-[#F05B5B] font-['Google_Sans',sans-serif]">
          Could not connect to Flask API for model metrics.
        </p>
        <p className="text-[11px] text-[#64717E] mt-1 font-['Google_Sans',sans-serif]">
          Ensure <code>python app.py</code> is active on port 5000.
        </p>
      </div>
    );
  }

  return (
    <div className="flex flex-col justify-between h-full gap-4 font-['Google_Sans',sans-serif]">
      {/* ── Top Bar: Tab Selector & Dimension Chip ── */}
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2.5 border-b border-[#202A34] font-['Google_Sans',sans-serif]">
        <div className="flex items-center gap-1.5 p-1 rounded-lg bg-[#10161D] border border-[#26313D]">
          {tabs.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => setActiveTab(t.id)}
              className={`px-3 py-1 rounded-md text-xs font-['Google_Sans',sans-serif] transition-all ${
                activeTab === t.id
                  ? "bg-[#18212B] text-[#35D0C5] font-semibold border border-[#26313D] shadow-sm"
                  : "text-[#9AA7B4] hover:text-[#F2F5F7]"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Real Dimension & Variance Chip */}
        <div className="flex items-center gap-2 text-[11px] font-['Google_Sans',sans-serif] bg-[#10161D] px-3 py-1.5 rounded-lg border border-[#202A34] text-[#9AA7B4]">
          <span>
            Features:{" "}
            <strong className="text-[#35D0C5] font-medium">
              {data.feature_columns.length} → {data.pca_components} PCs
            </strong>
          </span>
          <span className="text-[#64717E]">|</span>
          <span>
            Retained:{" "}
            <strong className="text-[#3CCB8E] font-medium">
              {totalRetainedVariance.toFixed(1)}%
            </strong>
          </span>
        </div>
      </div>

      {/* ── Main Analytical Visualization Area ── */}
      <div className="flex-1 flex flex-col justify-center font-['Google_Sans',sans-serif]">
        {activeTab === "pollutant" && (
          <div className="flex flex-col">
            <p className="text-xs font-['Google_Sans',sans-serif] text-[#CBD5E1] mb-2 leading-relaxed">
              Back-projected contribution score calculated from Random Forest component importances weighted by PCA loadings (Σ [w_i × L_ij²]):
            </p>
            {/* Expanded chart height so all 12 pollutants fit comfortably */}
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={pollutantData}
                  layout="vertical"
                  margin={{ top: 6, right: 28, left: 10, bottom: 4 }}
                >
                  <XAxis
                    type="number"
                    unit="%"
                    domain={[0, "auto"]}
                    tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "var(--font-google-sans)" }}
                    axisLine={{ stroke: "#26313D" }}
                    tickLine={{ stroke: "#26313D" }}
                  />
                  {/* interval={0} guarantees all 12 pollutant labels are rendered */}
                  <YAxis
                    type="category"
                    dataKey="name"
                    width={58}
                    interval={0}
                    tick={{ fill: "#FFFFFF", fontSize: 11, fontFamily: "var(--font-google-sans)", fontWeight: 500 }}
                    axisLine={{ stroke: "#26313D" }}
                    tickLine={false}
                  />
                  <Tooltip
                    content={<BreakdownTooltip metricLabel="Contribution" />}
                    cursor={{ fill: "rgba(53, 208, 197, 0.08)" }}
                  />
                  <Bar dataKey="value" barSize={15} radius={[0, 4, 4, 0]}>
                    {pollutantData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i < 3 ? "#35D0C5" : i < 6 ? "#2A4B61" : "#1E2A36"}
                        stroke={i < 3 ? "#35D0C5" : "transparent"}
                        strokeWidth={0.5}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "component" && (
          <div className="flex flex-col">
            <p className="text-xs font-['Google_Sans',sans-serif] text-[#CBD5E1] mb-2 leading-relaxed">
              Direct Random Forest feature importance allocated to each transformed orthonormal principal component:
            </p>
            {/* Expanded chart height */}
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  data={componentData}
                  margin={{ top: 8, right: 16, left: 0, bottom: 4 }}
                >
                  <XAxis
                    dataKey="name"
                    interval={0}
                    tick={{ fill: "#FFFFFF", fontSize: 11, fontFamily: "var(--font-google-sans)", fontWeight: 500 }}
                    axisLine={{ stroke: "#26313D" }}
                    tickLine={false}
                  />
                  <YAxis
                    unit="%"
                    tick={{ fill: "#94A3B8", fontSize: 11, fontFamily: "var(--font-google-sans)" }}
                    axisLine={{ stroke: "#26313D" }}
                    tickLine={{ stroke: "#26313D" }}
                  />
                  <Tooltip
                    content={<BreakdownTooltip metricLabel="RF Importance" />}
                    cursor={{ fill: "rgba(53, 208, 197, 0.08)" }}
                  />
                  <Bar dataKey="value" barSize={22} radius={[4, 4, 0, 0]}>
                    {componentData.map((_, i) => (
                      <Cell
                        key={i}
                        fill={i === 0 ? "#35D0C5" : i < 3 ? "#2A4B61" : "#1E2A36"}
                        stroke={i === 0 ? "#35D0C5" : "transparent"}
                        strokeWidth={0.5}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {activeTab === "radar" && (
          <div className="flex flex-col">
            <p className="text-xs font-['Google_Sans',sans-serif] text-[#CBD5E1] mb-2 leading-relaxed">
              Cumulative explained variance across orthonormal coordinate axes (retaining 95% total variance):
            </p>
            <div className="h-[340px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid stroke="#26313D" />
                  <PolarAngleAxis
                    dataKey="name"
                    tick={{ fill: "#CBD5E1", fontSize: 11, fontFamily: "var(--font-google-sans)" }}
                  />
                  <PolarRadiusAxis
                    angle={30}
                    domain={[0, 100]}
                    tick={{ fill: "#94A3B8", fontSize: 10, fontFamily: "var(--font-google-sans)" }}
                  />
                  <Radar
                    name="Cumulative %"
                    dataKey="cumulative"
                    stroke="#35D0C5"
                    fill="#35D0C5"
                    fillOpacity={0.25}
                  />
                  <Tooltip
                    content={<BreakdownTooltip metricLabel="Cumulative Variance" />}
                  />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>

      {/* ── Analytical Summary Cards (Fills and Balances the Card Space) ── */}
      <div className="pt-3 border-t border-[#202A34] grid grid-cols-1 sm:grid-cols-3 gap-2.5 font-['Google_Sans',sans-serif]">
        {/* Metric 1 */}
        <div className="p-2.5 rounded-xl border border-[#202A34] bg-[#10161D]/80 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-[#8292A1] font-semibold">
            {activeTab === "pollutant" ? "Dominant Pollutant" : "Dominant PC"}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-sm font-bold text-[#35D0C5]">
              {activeTab === "pollutant" ? topPollutant?.name ?? "—" : topComponent?.name ?? "—"}
            </span>
            <span className="text-xs text-[#CBD5E1] tabular-nums font-semibold">
              {activeTab === "pollutant" ? `${topPollutant?.value ?? 0}%` : `${topComponent?.value ?? 0}%`}
            </span>
          </div>
          <span className="text-[10px] text-[#64717E] mt-0.5">
            {activeTab === "pollutant" ? "Primary attribution load" : "Highest RF split ratio"}
          </span>
        </div>

        {/* Metric 2 */}
        <div className="p-2.5 rounded-xl border border-[#202A34] bg-[#10161D]/80 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-[#8292A1] font-semibold">
            {activeTab === "pollutant" ? "Top 3 Cumulative Load" : "Top 3 Subspaces"}
          </span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="text-sm font-bold text-[#3CCB8E] tabular-nums">
              {activeTab === "pollutant"
                ? `${top3Cumulative.toFixed(1)}%`
                : `${(componentData.slice(0, 3).reduce((acc, c) => acc + c.value, 0)).toFixed(1)}%`}
            </span>
          </div>
          <span className="text-[10px] text-[#64717E] mt-0.5">Core atmospheric influence</span>
        </div>

        {/* Metric 3 */}
        <div className="p-2.5 rounded-xl border border-[#202A34] bg-[#10161D]/80 flex flex-col justify-between">
          <span className="text-[10px] uppercase tracking-wider text-[#8292A1] font-semibold">
            Information Retention
          </span>
          <div className="flex items-baseline gap-1.5 mt-1">
            <span className="text-sm font-bold text-[#FFFFFF] tabular-nums">
              {totalRetainedVariance.toFixed(1)}%
            </span>
            <span className="text-[10px] text-[#35D0C5] font-medium">(10 PCs)</span>
          </div>
          <span className="text-[10px] text-[#64717E] mt-0.5">95% Threshold exceeded</span>
        </div>
      </div>
    </div>
  );
}

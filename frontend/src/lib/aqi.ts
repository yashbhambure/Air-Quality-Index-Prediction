// lib/aqi.ts — Client-side AQI category logic, mirrors Python utils.py aqi_category()

import type { AQICategory, AQIDisplayInfo } from "@/types/aqi";

interface CategorySpec {
  category: AQICategory;
  color: string;
  tailwindColor: string;
  tailwindBg: string;
  tailwindBorder: string;
  glowColor: string;
  advice: string;
  severity: number;
}

const CATEGORIES: Array<{ max: number } & CategorySpec> = [
  {
    max: 50,
    category: "Excellent",
    color: "#3CCB8E",
    tailwindColor: "text-[#3CCB8E]",
    tailwindBg: "bg-[#3CCB8E]/10",
    tailwindBorder: "border-[#3CCB8E]/30",
    glowColor: "rgba(60,203,142,0.25)",
    advice: "Optimal ambient air quality with minimal pollutant exposure. Unrestricted outdoor physical activities recommended for all population demographics.",
    severity: 0,
  },
  {
    max: 100,
    category: "Good",
    color: "#A8D85A",
    tailwindColor: "text-[#A8D85A]",
    tailwindBg: "bg-[#A8D85A]/10",
    tailwindBorder: "border-[#A8D85A]/30",
    glowColor: "rgba(168,216,90,0.25)",
    advice: "Air quality is within acceptable regulatory standards. Exceptionally sensitive individuals with chronic asthma or pulmonary conditions should monitor for minor bronchial symptoms.",
    severity: 1,
  },
  {
    max: 200,
    category: "Moderate",
    color: "#F3C969",
    tailwindColor: "text-[#F3C969]",
    tailwindBg: "bg-[#F3C969]/10",
    tailwindBorder: "border-[#F3C969]/30",
    glowColor: "rgba(243,201,105,0.25)",
    advice: "Moderate atmospheric pollution. Children, older adults, and individuals with cardiovascular or respiratory conditions should curtail prolonged strenuous outdoor exertion.",
    severity: 2,
  },
  {
    max: 300,
    category: "Poor",
    color: "#F39A4A",
    tailwindColor: "text-[#F39A4A]",
    tailwindBg: "bg-[#F39A4A]/10",
    tailwindBorder: "border-[#F39A4A]/30",
    glowColor: "rgba(243,154,74,0.25)",
    advice: "Unhealthy particulate exposure threshold reached. Avoid sustained outdoor activity, close exterior windows, and activate indoor HEPA air filtration. N95 respirators advised for sensitive groups.",
    severity: 3,
  },
  {
    max: 400,
    category: "Very Poor",
    color: "#F05B5B",
    tailwindColor: "text-[#F05B5B]",
    tailwindBg: "bg-[#F05B5B]/10",
    tailwindBorder: "border-[#F05B5B]/30",
    glowColor: "rgba(240,91,91,0.25)",
    advice: "Severe pulmonary alert: Elevated toxic concentrations trigger acute airway irritation. Wear certified N95/FFP2 respirators for essential outdoor transit, seal indoor ventilation, and continuously run high-efficiency air purifiers.",
    severity: 4,
  },
  {
    max: Infinity,
    category: "Severe",
    color: "#B83B5E",
    tailwindColor: "text-[#B83B5E]",
    tailwindBg: "bg-[#B83B5E]/10",
    tailwindBorder: "border-[#B83B5E]/30",
    glowColor: "rgba(184,59,94,0.30)",
    advice: "Critical public health emergency: Severe multi-pollutant toxicity presents systemic cardiovascular and respiratory risks across the entire population. Cease all outdoor activity and remain indoors within sealed, air-purified spaces.",
    severity: 5,
  },
];

export function getAQIInfo(aqi: number | null | undefined): AQIDisplayInfo {
  if (aqi == null || !Number.isFinite(aqi) || Number.isNaN(aqi)) {
    return {
      category: "Moderate",
      color: "#94A3B8",
      tailwindColor: "text-[#94A3B8]",
      tailwindBg: "bg-[#94A3B8]/10",
      tailwindBorder: "border-[#94A3B8]/30",
      glowColor: "rgba(148,163,184,0.18)",
      advice: "Measurement currently pending or sensor unmonitored.",
      severity: 0,
    };
  }
  const spec = CATEGORIES.find((c) => aqi <= c.max) ?? CATEGORIES[CATEGORIES.length - 1];
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { max: _max, ...info } = spec;
  return info;
}

/** Normalise an AQI value (0-500) to a 0-1 gauge fraction. */
export function aqiToFraction(aqi: number): number {
  return Math.min(Math.max(aqi / 500, 0), 1);
}

/** Format AQI number for display */
export function formatAQI(aqi: number): string {
  return Math.round(aqi).toString();
}

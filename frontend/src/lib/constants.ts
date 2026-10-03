// lib/constants.ts — Feature column definitions with slider metadata

import type { PredictionInput } from "@/types/aqi";

export interface FeatureSpec {
  key: keyof PredictionInput;
  label: string;
  unit: string;
  min: number;
  max: number;
  step: number;
  defaultValue: number;
  description: string;
  /** true = shown in Simple mode (primary pollutants) */
  isPrimary: boolean;
}

export const FEATURE_SPECS: FeatureSpec[] = [
  {
    key: "PM2.5",
    label: "PM2.5",
    unit: "µg/m³",
    min: 0,
    max: 500,
    step: 0.5,
    defaultValue: 45,
    description: "Fine particulate matter (≤2.5 µm)",
    isPrimary: true,
  },
  {
    key: "PM10",
    label: "PM10",
    unit: "µg/m³",
    min: 0,
    max: 600,
    step: 1,
    defaultValue: 80,
    description: "Coarse particulate matter (≤10 µm)",
    isPrimary: true,
  },
  {
    key: "NO2",
    label: "NO₂",
    unit: "µg/m³",
    min: 0,
    max: 250,
    step: 0.5,
    defaultValue: 30,
    description: "Nitrogen dioxide",
    isPrimary: true,
  },
  {
    key: "SO2",
    label: "SO₂",
    unit: "µg/m³",
    min: 0,
    max: 150,
    step: 0.5,
    defaultValue: 10,
    description: "Sulfur dioxide",
    isPrimary: true,
  },
  {
    key: "CO",
    label: "CO",
    unit: "mg/m³",
    min: 0,
    max: 15,
    step: 0.1,
    defaultValue: 1.0,
    description: "Carbon monoxide",
    isPrimary: true,
  },
  {
    key: "O3",
    label: "O₃",
    unit: "µg/m³",
    min: 0,
    max: 300,
    step: 1,
    defaultValue: 50,
    description: "Ozone",
    isPrimary: true,
  },
  // Advanced-only fields
  {
    key: "NO",
    label: "NO",
    unit: "µg/m³",
    min: 0,
    max: 200,
    step: 0.5,
    defaultValue: 15,
    description: "Nitric oxide",
    isPrimary: false,
  },
  {
    key: "NOx",
    label: "NOx",
    unit: "µg/m³",
    min: 0,
    max: 400,
    step: 1,
    defaultValue: 50,
    description: "Nitrogen oxides (total)",
    isPrimary: false,
  },
  {
    key: "NH3",
    label: "NH₃",
    unit: "µg/m³",
    min: 0,
    max: 200,
    step: 0.5,
    defaultValue: 20,
    description: "Ammonia",
    isPrimary: false,
  },
  {
    key: "Benzene",
    label: "Benzene",
    unit: "µg/m³",
    min: 0,
    max: 50,
    step: 0.1,
    defaultValue: 2,
    description: "Benzene (VOC)",
    isPrimary: false,
  },
  {
    key: "Toluene",
    label: "Toluene",
    unit: "µg/m³",
    min: 0,
    max: 100,
    step: 0.1,
    defaultValue: 5,
    description: "Toluene (VOC)",
    isPrimary: false,
  },
  {
    key: "Xylene",
    label: "Xylene",
    unit: "µg/m³",
    min: 0,
    max: 50,
    step: 0.1,
    defaultValue: 1.5,
    description: "Xylene (VOC)",
    isPrimary: false,
  },
];

export const DEFAULT_INPUT: PredictionInput = Object.fromEntries(
  FEATURE_SPECS.map((f) => [f.key, f.defaultValue])
) as unknown as PredictionInput;

export const PRIMARY_FEATURES = FEATURE_SPECS.filter((f) => f.isPrimary);
export const ADVANCED_FEATURES = FEATURE_SPECS.filter((f) => !f.isPrimary);
export const ALL_FEATURES = FEATURE_SPECS;

export interface SimulationPreset {
  id: string;
  name: string;
  subtitle: string;
  color: string;
  inputs: Partial<PredictionInput>;
}

export const SIMULATION_PRESETS: SimulationPreset[] = [
  {
    id: "clean_monsoon",
    name: "Clean Monsoon",
    subtitle: "Washed air, minimal particulates",
    color: "#3CCB8E",
    inputs: {
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
    },
  },
  {
    id: "traffic_surge",
    name: "Traffic Surge",
    subtitle: "High vehicular NO₂, NOx & CO",
    color: "#F3C969",
    inputs: {
      "PM2.5": 65,
      PM10: 110,
      NO: 40,
      NO2: 68,
      NOx: 88,
      NH3: 22,
      CO: 2.4,
      SO2: 14,
      O3: 45,
      Benzene: 4.5,
      Toluene: 12.0,
      Xylene: 3.2,
    },
  },
  {
    id: "industrial_plume",
    name: "Industrial Plume",
    subtitle: "Elevated SO₂, NO₂ & VOCs",
    color: "#F39A4A",
    inputs: {
      "PM2.5": 85,
      PM10: 140,
      NO: 35,
      NO2: 55,
      NOx: 75,
      NH3: 28,
      CO: 2.1,
      SO2: 48,
      O3: 60,
      Benzene: 8.5,
      Toluene: 18.0,
      Xylene: 6.0,
    },
  },
  {
    id: "winter_smog",
    name: "Winter Smog Spike",
    subtitle: "Severe particulate inversion",
    color: "#F05B5B",
    inputs: {
      "PM2.5": 195,
      PM10: 310,
      NO: 50,
      NO2: 85,
      NOx: 110,
      NH3: 42,
      CO: 3.5,
      SO2: 32,
      O3: 75,
      Benzene: 11.0,
      Toluene: 25.0,
      Xylene: 7.5,
    },
  },
];


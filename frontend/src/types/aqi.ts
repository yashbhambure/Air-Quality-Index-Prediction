// types/aqi.ts — Shared TypeScript interfaces for the AQI prediction platform

export type AQICategory =
  | "Excellent"
  | "Good"
  | "Moderate"
  | "Poor"
  | "Very Poor"
  | "Severe";

/** The 12 feature columns the model accepts */
export interface PredictionInput {
  "PM2.5": number;
  PM10: number;
  NO: number;
  NO2: number;
  NOx: number;
  NH3: number;
  CO: number;
  SO2: number;
  O3: number;
  Benzene: number;
  Toluene: number;
  Xylene: number;
}

export interface PCAComponentItem {
  id: string;
  label: string;
  score: number;
  explained_variance_ratio: number;
  explained_variance_pct: number;
}

export interface TreeSampleItem {
  tree_id: number;
  prediction: number;
}

export interface AtmosphericTrace {
  raw_features: Record<string, number>;
  scaled_features: Record<string, number>;
  scaler_params: {
    means: Record<string, number>;
    scales: Record<string, number>;
  };
  pca: {
    n_components: number;
    total_variance_retained_ratio: number;
    total_variance_retained_pct: number;
    components: PCAComponentItem[];
    loadings: Record<string, Record<string, number>>;
  };
  random_forest: {
    n_estimators: number;
    max_depth: number;
    ensemble_prediction: number;
    tree_samples: TreeSampleItem[];
  };
}

/** Shape returned by POST /api/predict */
export interface PredictionResult {
  aqi: number;
  category: AQICategory;
  /** Hex colour matching the category */
  color: string;
  advice: string;
  inference_ms?: number;
  trace?: AtmosphericTrace;
}

/** Shape returned by GET /api/metrics */
export interface MetricsResponse {
  r2: number;
  adjusted_r2: number;
  mae: number;
  mse: number;
  rmse: number;
  cv_r2_mean: number;
  pca_components: number;
  /** Array of explained variance ratios, one per PCA component */
  explained_variance_ratio: number[];
  best_params: {
    max_depth: number | null;
    min_samples_split: number;
    n_estimators: number;
  };
  feature_columns: string[];
  /** Real RF impurity-based importances keyed by PCA component label */
  feature_importances_?: Record<string, number>;
  feature_importances_normalized?: Record<string, number>;
  /**
   * Importance attributed back to each original pollutant via:
   *   pollutant_importance[j] = Σ_i( rf_importance[i] × loading[i,j]² )
   * Normalised to sum to 1.0. Computed by inject_feature_importances.py.
   */
  feature_importances_by_pollutant?: Record<string, number>;
}

/** Single record in GET /api/history */
export interface HistoryRecord {
  timestamp: string;
  inputs: PredictionInput;
  result: PredictionResult;
}

/** Single feature in GET /api/live/<city> */
export interface LiveFeatureItem {
  value: number;
  source: "live" | "dataset_median";
}

/** Shape returned by GET /api/live/<city> */
export interface LiveCityResult {
  city: string;
  live_aqi_reported: number | null;
  predicted_aqi: number;
  category: AQICategory;
  color: string;
  advice: string;
  features_used: Record<string, LiveFeatureItem>;
  station: string;
  measured_at: string;
}

/** AQI colour + Tailwind class info computed on the client */
export interface AQIDisplayInfo {
  category: AQICategory;
  color: string;
  tailwindColor: string;
  tailwindBg: string;
  tailwindBorder: string;
  glowColor: string;
  advice: string;
  severity: number; // 0-5
}

/** Simulation history snapshot for session logging */
export interface SimulationHistoryItem {
  id: string;
  timestamp: string;
  label: string;
  inputs: PredictionInput;
  baselineAqi: number;
  simulatedAqi: number;
  baselineCategory: AQICategory;
  simulatedCategory: AQICategory;
  deltaAqi: number;
}

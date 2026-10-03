import type { HistoryRecord, LiveCityResult, MetricsResponse, PredictionInput, PredictionResult } from "@/types/aqi";

const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "";

async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, init);
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`API ${res.status}: ${body}`);
  }
  return res.json() as Promise<T>;
}

/** POST /api/predict — run the RF model on a single feature vector */
export async function fetchPredict(input: PredictionInput, init?: RequestInit): Promise<PredictionResult> {
  return apiFetch<PredictionResult>("/api/predict", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(init?.headers || {}) },
    body: JSON.stringify(input),
    ...init,
  });
}

/** GET /api/metrics — model quality metrics + PCA + RF feature importances */
export async function fetchMetrics(): Promise<MetricsResponse> {
  return apiFetch<MetricsResponse>("/api/metrics");
}

/** GET /api/history?limit=N — last N predictions (default 50) */
export async function fetchHistory(limit = 50): Promise<HistoryRecord[]> {
  return apiFetch<HistoryRecord[]>(`/api/history?limit=${limit}`);
}

/** POST /api/batch — upload CSV of 12 features and download result CSV */
export async function fetchBatchPredict(file: File): Promise<Blob> {
  const formData = new FormData();
  formData.append("file", file);

  const res = await fetch(`${API_BASE}/api/batch`, {
    method: "POST",
    body: formData,
  });

  if (!res.ok) {
    const errorText = await res.text();
    throw new Error(`Batch API ${res.status}: ${errorText}`);
  }

  return res.blob();
}

/** GET /api/live/<city> — fetch real-time WAQI feed and model prediction comparison */
export async function fetchLiveCity(city: string, signal?: AbortSignal): Promise<LiveCityResult> {
  const encoded = encodeURIComponent(city.trim());
  const res = await fetch(`${API_BASE}/api/live/${encoded}`, { signal });
  if (!res.ok) {
    let errorMsg = `HTTP ${res.status}`;
    try {
      const data = await res.json();
      if (data && typeof data.error === "string") {
        errorMsg = data.error;
      } else if (data && typeof data.message === "string") {
        errorMsg = data.message;
      }
    } catch {
      // Fallback for non-JSON responses
    }
    throw new Error(errorMsg);
  }
  return res.json() as Promise<LiveCityResult>;
}



"""Load artifacts and predict AQI using a Physics-Informed CPCB Hybrid Predictor.

Architecture:
1. Physics Grounding: Computes CPCB (Central Pollution Control Board) official
   piecewise linear sub-indices across criteria pollutants (PM2.5, PM10, NO2,
   NH3, SO2, CO, O3) plus secondary atmospheric VOC/nitrogen co-exposure.
2. Machine Learning Non-Linear Interactions: Evaluates StandardScaler -> PCA ->
   RandomForestRegressor ensemble for historical multi-pollutant synergies.
3. Physics-Informed Blending:
   - When all pollutants are 0, output is grounded to exactly 0.00.
   - In clean air (sub-index < 50), physics standards dominate.
   - In moderate-to-severe air, ML non-linear atmospheric interactions blend in.
   - Physical lower-bound guarantee: AQI is never lower than max(sub-indices).
"""
from __future__ import annotations

import os
from typing import Any
import joblib
import numpy as np
import pandas as pd

from utils import FEATURE_COLUMNS, aqi_category, get_logger

logger = get_logger("predict")
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODELS_DIR = os.path.join(BASE_DIR, "models")

# Official CPCB (Central Pollution Control Board) Indian National AQI Breakpoints
# (Concentration_Low, Concentration_High, SubIndex_Low, SubIndex_High)
CPCB_BREAKPOINTS: dict[str, list[tuple[float, float, float, float]]] = {
    "PM2.5": [
        (0.0, 30.0, 0.0, 50.0),
        (30.0, 60.0, 50.0, 100.0),
        (60.0, 90.0, 100.0, 200.0),
        (90.0, 120.0, 200.0, 300.0),
        (120.0, 250.0, 300.0, 400.0),
        (250.0, 500.0, 400.0, 500.0),
    ],
    "PM10": [
        (0.0, 50.0, 0.0, 50.0),
        (50.0, 100.0, 50.0, 100.0),
        (100.0, 250.0, 100.0, 200.0),
        (250.0, 350.0, 200.0, 300.0),
        (350.0, 430.0, 300.0, 400.0),
        (430.0, 600.0, 400.0, 500.0),
    ],
    "NO2": [
        (0.0, 40.0, 0.0, 50.0),
        (40.0, 80.0, 50.0, 100.0),
        (80.0, 180.0, 100.0, 200.0),
        (180.0, 280.0, 200.0, 300.0),
        (280.0, 400.0, 300.0, 400.0),
        (400.0, 600.0, 400.0, 500.0),
    ],
    "NH3": [
        (0.0, 200.0, 0.0, 50.0),
        (200.0, 400.0, 50.0, 100.0),
        (400.0, 800.0, 100.0, 200.0),
        (800.0, 1200.0, 200.0, 300.0),
        (1200.0, 1800.0, 300.0, 400.0),
        (1800.0, 2500.0, 400.0, 500.0),
    ],
    "SO2": [
        (0.0, 40.0, 0.0, 50.0),
        (40.0, 80.0, 50.0, 100.0),
        (80.0, 380.0, 100.0, 200.0),
        (380.0, 800.0, 200.0, 300.0),
        (800.0, 1600.0, 300.0, 400.0),
        (1600.0, 2500.0, 400.0, 500.0),
    ],
    "CO": [
        (0.0, 1.0, 0.0, 50.0),
        (1.0, 2.0, 50.0, 100.0),
        (2.0, 10.0, 100.0, 200.0),
        (10.0, 17.0, 200.0, 300.0),
        (17.0, 34.0, 300.0, 400.0),
        (34.0, 50.0, 400.0, 500.0),
    ],
    "O3": [
        (0.0, 50.0, 0.0, 50.0),
        (50.0, 100.0, 50.0, 100.0),
        (100.0, 168.0, 100.0, 200.0),
        (168.0, 208.0, 200.0, 300.0),
        (208.0, 748.0, 300.0, 400.0),
        (748.0, 1000.0, 400.0, 500.0),
    ],
}


def calculate_cpcb_subindex(pollutant: str, concentration: float) -> float:
    """Calculate the official linear CPCB sub-index for a criteria pollutant."""
    if concentration is None or concentration <= 0.0:
        return 0.0
    if pollutant not in CPCB_BREAKPOINTS:
        return 0.0
    table = CPCB_BREAKPOINTS[pollutant]
    for b_lo, b_hi, i_lo, i_hi in table:
        if b_lo <= concentration <= b_hi:
            return i_lo + (i_hi - i_lo) / (b_hi - b_lo) * (concentration - b_lo)
    # Extrapolate linearly beyond highest bracket
    b_lo, b_hi, i_lo, i_hi = table[-1]
    return i_hi + (i_hi - i_lo) / (b_hi - b_lo) * (concentration - b_hi)


def compute_physical_air_profile(row: dict[str, float]) -> tuple[dict[str, float], str, float, float]:
    """Compute individual CPCB sub-indices, dominant criteria pollutant, and atmospheric co-exposure."""
    sub_indices: dict[str, float] = {}
    for p in ["PM2.5", "PM10", "NO2", "NH3", "SO2", "CO", "O3"]:
        sub_indices[p] = round(calculate_cpcb_subindex(p, float(row.get(p, 0.0))), 2)

    dominant_pollutant = max(sub_indices, key=sub_indices.get)
    max_subindex = sub_indices[dominant_pollutant]

    # Secondary VOC and reactive nitrogen burden
    benzene = max(0.0, float(row.get("Benzene", 0.0)))
    toluene = max(0.0, float(row.get("Toluene", 0.0)))
    xylene = max(0.0, float(row.get("Xylene", 0.0)))
    no = max(0.0, float(row.get("NO", 0.0)))
    nox = max(0.0, float(row.get("NOx", 0.0)))
    no2 = max(0.0, float(row.get("NO2", 0.0)))

    voc_sub = min(100.0, benzene * 4.0 + toluene * 0.8 + xylene * 1.5 + no * 0.4 + max(0.0, nox - no2) * 0.3)

    # Co-exposure synergy: other pollutants contribute smooth physical co-exposure
    other_pollutants_effect = sum(v * 0.08 for k, v in sub_indices.items() if k != dominant_pollutant)
    voc_effect = voc_sub * 0.12

    physical_baseline = max_subindex + other_pollutants_effect + voc_effect
    return sub_indices, dominant_pollutant, max_subindex, round(physical_baseline, 2)


class AQIPredictor:
    def __init__(self, models_dir: str = MODELS_DIR):
        self.scaler = joblib.load(os.path.join(models_dir, "scaler.pkl"))
        self.pca = joblib.load(os.path.join(models_dir, "pca.pkl"))
        self.model = joblib.load(os.path.join(models_dir, "random_forest.pkl"))

    def _prepare(self, X: Any) -> np.ndarray:
        if isinstance(X, dict):
            X = np.array([[float(X[c]) for c in FEATURE_COLUMNS]])
        elif isinstance(X, pd.DataFrame):
            X = X[FEATURE_COLUMNS].values
        else:
            X = np.asarray(X, dtype=float)
            if X.ndim == 1:
                X = X.reshape(1, -1)
        return self.pca.transform(self.scaler.transform(X))

    def predict_with_trace(self, row: dict) -> dict:
        """Compute AQI and extract complete transformation trace through Scaler -> PCA -> RF -> Physics Hybrid."""
        raw_dict = {c: float(row.get(c, 0.0)) for c in FEATURE_COLUMNS}
        raw_arr = np.array([[raw_dict[c] for c in FEATURE_COLUMNS]])

        # 1. Evaluate pure ML pipeline trace
        scaled_arr = self.scaler.transform(raw_arr)
        pca_arr = self.pca.transform(scaled_arr)
        rf_raw = float(self.model.predict(pca_arr)[0])

        n_trees = getattr(self.model, "n_estimators", 400)
        sample_indices = [int(i) for i in np.linspace(0, n_trees - 1, min(8, n_trees))]
        tree_samples = [
            {
                "tree_id": idx + 1,
                "prediction": round(float(self.model.estimators_[idx].predict(pca_arr)[0]), 1),
            }
            for idx in sample_indices
        ]

        n_pca = int(self.pca.n_components_)
        loadings = {}
        for i in range(n_pca):
            pc_name = f"PC{i+1}"
            loadings[pc_name] = {
                FEATURE_COLUMNS[j]: round(float(self.pca.components_[i, j]), 4)
                for j in range(len(FEATURE_COLUMNS))
            }

        pca_components_data = [
            {
                "id": f"PC{i+1}",
                "label": f"PC {i+1}",
                "score": round(float(pca_arr[0, i]), 4),
                "explained_variance_ratio": round(float(self.pca.explained_variance_ratio_[i]), 4),
                "explained_variance_pct": round(float(self.pca.explained_variance_ratio_[i] * 100), 2),
            }
            for i in range(n_pca)
        ]

        # 2. Evaluate physical CPCB sub-indices & co-exposure baseline
        sub_indices, dominant_pollutant, max_subindex, physical_baseline = compute_physical_air_profile(raw_dict)

        # 3. Physics-Informed Grounding & Blending
        if max_subindex <= 0.0 and physical_baseline <= 0.0:
            final_aqi = 0.0
        else:
            # In clean air (baseline < 50), CPCB physical standard dominates completely.
            # As air pollution increases, ML Random Forest non-linear multi-pollutant interactions blend in.
            alpha = float(np.clip((physical_baseline - 50.0) / 150.0, 0.0, 0.30))
            blended = (1.0 - alpha) * physical_baseline + alpha * (0.85 * physical_baseline + 0.15 * rf_raw)
            # Physical law constraint: AQI cannot fall below the worst pollutant's sub-index
            final_aqi = max(max_subindex, blended)

        final_aqi = float(round(final_aqi, 2))
        category_info = aqi_category(final_aqi)

        trace = {
            "raw_features": raw_dict,
            "scaled_features": {
                c: round(float(scaled_arr[0, j]), 4) for j, c in enumerate(FEATURE_COLUMNS)
            },
            "scaler_params": {
                "means": {c: round(float(self.scaler.mean_[j]), 4) for j, c in enumerate(FEATURE_COLUMNS)},
                "scales": {c: round(float(self.scaler.scale_[j]), 4) for j, c in enumerate(FEATURE_COLUMNS)},
            },
            "pca": {
                "n_components": n_pca,
                "total_variance_retained_ratio": round(float(sum(self.pca.explained_variance_ratio_)), 4),
                "total_variance_retained_pct": round(float(sum(self.pca.explained_variance_ratio_) * 100), 2),
                "components": pca_components_data,
                "loadings": loadings,
            },
            "random_forest": {
                "n_estimators": n_trees,
                "max_depth": getattr(self.model, "max_depth", 20),
                "ensemble_prediction": round(rf_raw, 2),
                "tree_samples": tree_samples,
            },
            "physics_cpcb": {
                "method": "Physics-Informed CPCB Hybrid",
                "dominant_pollutant": dominant_pollutant,
                "max_subindex": max_subindex,
                "physical_baseline": physical_baseline,
                "sub_indices": sub_indices,
            },
        }

        return {
            "aqi": final_aqi,
            "dominant_pollutant": dominant_pollutant if max_subindex > 0 else "None",
            "cpcb_base_aqi": physical_baseline,
            "ml_raw_aqi": round(rf_raw, 2),
            **category_info.__dict__,
            "trace": trace,
        }

    def predict(self, X: Any, return_trace: bool = False) -> list[dict]:
        """Predict AQI with Physics-Informed CPCB Hybrid calibration."""
        if return_trace and isinstance(X, dict):
            return [self.predict_with_trace(X)]

        if isinstance(X, dict):
            rows = [X]
        elif isinstance(X, pd.DataFrame):
            rows = X[FEATURE_COLUMNS].to_dict(orient="records")
        else:
            arr = np.asarray(X, dtype=float)
            if arr.ndim == 1:
                arr = arr.reshape(1, -1)
            rows = [{c: float(arr[i, j]) for j, c in enumerate(FEATURE_COLUMNS)} for i in range(arr.shape[0])]

        results = []
        for r in rows:
            res = self.predict_with_trace(r)
            if return_trace:
                results.append(res)
            else:
                results.append({
                    "aqi": res["aqi"],
                    "category": res["category"],
                    "color": res["color"],
                    "advice": res.get("advice", ""),
                    "dominant_pollutant": res["dominant_pollutant"],
                })
        return results


if __name__ == "__main__":
    sample = {
        "PM2.5": 90, "PM10": 150, "NO": 20, "NO2": 40, "NOx": 55,
        "NH3": 25, "CO": 1.5, "SO2": 15, "O3": 60,
        "Benzene": 3, "Toluene": 8, "Xylene": 1.5,
    }
    print("Sample prediction:", AQIPredictor().predict(sample))
    zeros = {c: 0 for c in FEATURE_COLUMNS}
    print("Zeros prediction:", AQIPredictor().predict(zeros))

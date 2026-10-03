# -*- coding: utf-8 -*-
"""inject_feature_importances.py

One-shot utility: load the trained RandomForestRegressor + PCA artifacts,
compute feature importances at two levels, and patch models/metrics.json
with three new keys:

``feature_importances_`` (dict)
    Maps each PCA component label ("PC1" ... "PCn") to the RF's
    mean decrease in impurity score for that component.

``feature_importances_normalized`` (dict)
    Same values normalised to sum to 1.0 for easy charting.

``feature_importances_by_pollutant`` (dict)
    Importance attributed back to each of the 12 ORIGINAL pollutants
    (PM2.5, PM10, NO, ...) by multiplying each component's squared
    PCA loadings by the RF importance for that component, then summing
    across all components.

    Formula:
        pollutant_importance[j] = sum_i( rf_importance[i] * loading[i,j]^2 )

    Because PCA components are orthonormal, each row of pca.components_ has
    unit L2 norm, so the squared loadings already sum to 1 per component.
    This gives a faithful decomposition of model reliance onto the original
    feature space — no normalisation artefacts.

Run once after training (or whenever models change):
    python inject_feature_importances.py

────────────────────────────────────────────────────────────────────────────
SANITY CHECK: Raw Pearson r(pollutant, AQI) vs PCA-based importance
────────────────────────────────────────────────────────────────────────────
Verified 2026-08-25 against dataset/city_day.csv (24,850 rows with non-NaN AQI).
Script: sanity_check_correlations.py  |  Full results: models/pearson_vs_pca.json

Pearson ranking (|r| with AQI, highest to lowest):
  #1  PM10     r = +0.8033   (city_day AQI formula weights PM10 heavily)
  #2  CO       r = +0.6833
  #3  PM2.5    r = +0.6592
  #4  NO2      r = +0.5371
  #5  SO2      r = +0.4906
  ...
  #12 Benzene  r = +0.0444

PCA-importance ranking (from metrics.json):
  #1  CO       0.1184
  #2  PM10     0.1119
  #3  PM2.5    0.1082
  #4  NOx      0.0978
  #5  NO2      0.0957

Key observations & explanation:

1.  PM10 dominates Pearson (r=0.80), not PM2.5 — consistent with the
    Indian CPCB AQI formula, which gives PM10 an explicit sub-index that
    frequently caps the composite score. In pollution-monitoring literature
    PM2.5 dominates *health-impact* metrics, but the AQI *formula* in this
    dataset (CPCB standard) is heavily driven by PM10 levels.

2.  CO vs PM2.5 in PCA-importance: CO edges out PM2.5 by ~1 point
    (0.1184 vs 0.1082). This is a PCA-mixing artefact:
    - PC1 (35.4% variance) captures the general urban pollution factor —
      PM2.5, PM10, CO, NOx load together. The RF weights PC1 at 52%.
    - CO also loads substantially on mid-variance components (PC5, PC6,
      PC10) that the RF weights more than average. Summing squared loadings
      across all components, CO accumulates slightly more importance than
      PM2.5 even though PM2.5 has a marginally higher direct correlation.

3.  SO2 and Benzene show the largest rank discrepancies:
    - SO2: Pearson rank #5 but PCA rank #9  (Δ = −4).
      SO2 has moderate direct correlation but its PCA loadings are spread
      thinly across low-weight components, diluting its importance.
    - Benzene: Pearson rank #12 but PCA rank #8  (Δ = +4).
      Benzene has near-zero direct correlation with AQI but high loadings
      on components that the RF happens to rely on (possibly because those
      components separate high-pollution urban days).

Conclusion: the two metrics answer *different* questions.
  - Pearson r    → direct linear predictability of AQI from each pollutant.
  - PCA importance → how much the *model* relies on each original feature
                    as mediated through compressed principal components.
Neither ranking is wrong. The ~2-point spread across the top-5 PCA ranks
(CO=11.8%, PM10=11.2%, PM2.5=10.8%, NOx=9.8%, NO2=9.6%) reflects
orthogonal decomposition across highly-correlated pollutants — attribution
diffuses because the signals are not separable, not because the model fails.
────────────────────────────────────────────────────────────────────────────
"""
from __future__ import annotations
import sys

# Force UTF-8 output on Windows so special chars don't crash
if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import json
import os

import joblib
import numpy as np

MODELS_DIR = "models"
METRICS_PATH = os.path.join(MODELS_DIR, "metrics.json")

# These must match FEATURE_COLUMNS in utils.py
FEATURE_COLUMNS = [
    "PM2.5", "PM10", "NO", "NO2", "NOx", "NH3",
    "CO", "SO2", "O3", "Benzene", "Toluene", "Xylene",
]


def main() -> None:
    # ── Load artifacts ────────────────────────────────────────────────────
    rf_path  = os.path.join(MODELS_DIR, "random_forest.pkl")
    pca_path = os.path.join(MODELS_DIR, "pca.pkl")

    if not os.path.exists(rf_path):
        raise FileNotFoundError(f"Model not found at {rf_path}. Run python train.py first.")

    print(f"Loading RF model from {rf_path} ...")
    model = joblib.load(rf_path)

    print(f"Loading PCA from {pca_path} ...")
    pca = joblib.load(pca_path)

    # ── Validate shapes ───────────────────────────────────────────────────
    rf_importances: np.ndarray = model.feature_importances_  # shape: (n_components,)
    n_components = pca.n_components_
    n_features   = pca.n_features_in_

    if len(rf_importances) != n_components:
        raise ValueError(
            f"Shape mismatch: RF has {len(rf_importances)} importances "
            f"but PCA retained {n_components} components."
        )

    if n_features != len(FEATURE_COLUMNS):
        raise ValueError(
            f"PCA was fitted on {n_features} features but FEATURE_COLUMNS has "
            f"{len(FEATURE_COLUMNS)}. Re-run train.py and then this script."
        )

    # ── Level 1: per-component importances ────────────────────────────────
    labels    = [f"PC{i + 1}" for i in range(n_components)]
    raw       = rf_importances.tolist()
    total     = float(sum(raw))

    fi_dict:  dict[str, float] = {lbl: round(v, 6) for lbl, v in zip(labels, raw)}
    fi_norm:  dict[str, float] = {lbl: round(v / total, 6) for lbl, v in zip(labels, raw)}

    # ── Level 2: per-pollutant importances via PCA loadings ───────────────
    # pca.components_ shape: (n_components, n_features)
    # Each row is a unit-norm vector (orthonormal basis).
    # Squared loadings give the fraction of each component's variance
    # attributable to each original feature.
    loadings: np.ndarray = pca.components_                    # (n_comp, n_feat)
    sq_loadings           = loadings ** 2                      # (n_comp, n_feat)

    # Weighted sum: dot product of RF importances (1-D) with squared loadings
    pollutant_importance  = rf_importances @ sq_loadings       # (n_feat,)

    # Normalise to sum to 1.0
    poll_total = float(pollutant_importance.sum())
    poll_norm  = pollutant_importance / poll_total

    fi_by_pollutant: dict[str, float] = {
        col: round(float(v), 6) for col, v in zip(FEATURE_COLUMNS, poll_norm)
    }

    # ── Patch metrics.json ────────────────────────────────────────────────
    with open(METRICS_PATH) as f:
        metrics = json.load(f)

    metrics["feature_importances_"]            = fi_dict
    metrics["feature_importances_normalized"]  = fi_norm
    metrics["feature_importances_by_pollutant"] = fi_by_pollutant

    with open(METRICS_PATH, "w") as f:
        json.dump(metrics, f, indent=2)

    # ── Report ────────────────────────────────────────────────────────────
    print(f"\n[OK] Patched {METRICS_PATH}")
    print("\n--- PCA Component Importances (RF) ---")
    for lbl, v in fi_dict.items():
        bar = "#" * int(v * 50)
        print(f"  {lbl:>4}  {v:.4f}  {bar}")

    print("\n--- Pollutant-Level Importances (via PCA loadings) ---")
    sorted_poll = sorted(fi_by_pollutant.items(), key=lambda x: x[1], reverse=True)
    for pollutant, v in sorted_poll:
        bar = "#" * int(v * 50)
        print(f"  {pollutant:>10}  {v:.4f}  {bar}")

    print(f"\nTotal component importance: {total:.6f} (should be ~1.0)")
    print(f"Total pollutant importance: {sum(fi_by_pollutant.values()):.6f} (should be ~1.0)")


if __name__ == "__main__":
    main()

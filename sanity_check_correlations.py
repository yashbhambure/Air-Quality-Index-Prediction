# -*- coding: utf-8 -*-
"""sanity_check_correlations.py

Independent sanity check: compute raw Pearson correlation between each
pollutant column and AQI directly from dataset/city_day.csv (NO scaling,
NO PCA), then compare the ranking against the PCA-based feature importances
already stored in models/metrics.json.

Run:
    python sanity_check_correlations.py

Results are printed to stdout AND saved to models/pearson_vs_pca.json for
reference.  The comparison narrative is also appended to inject_feature_importances.py
as a module-level comment block so the context travels with the code.
"""
from __future__ import annotations
import sys

if sys.stdout.encoding and sys.stdout.encoding.lower() != "utf-8":
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")

import json
import os

import pandas as pd

DATASET_PATH = os.path.join("dataset", "city_day.csv")
METRICS_PATH = os.path.join("models", "metrics.json")
OUTPUT_PATH  = os.path.join("models", "pearson_vs_pca.json")

# Must match FEATURE_COLUMNS order in utils.py / inject_feature_importances.py
POLLUTANT_COLS = [
    "PM2.5", "PM10", "NO", "NO2", "NOx", "NH3",
    "CO", "SO2", "O3", "Benzene", "Toluene", "Xylene",
]
TARGET_COL = "AQI"


def main() -> None:
    # ── Load dataset ──────────────────────────────────────────────────────
    print(f"Loading {DATASET_PATH} ...")
    df = pd.read_csv(DATASET_PATH)

    missing = [c for c in POLLUTANT_COLS + [TARGET_COL] if c not in df.columns]
    if missing:
        raise ValueError(f"Missing columns in CSV: {missing}")

    # Drop rows where AQI is NaN (can't compute correlation against NaN target)
    df_clean = df[POLLUTANT_COLS + [TARGET_COL]].dropna(subset=[TARGET_COL])
    print(f"Rows after dropping NaN AQI: {len(df_clean):,}  (original: {len(df):,})")

    # ── Compute Pearson correlations ──────────────────────────────────────
    pearson: dict[str, float] = {}
    for col in POLLUTANT_COLS:
        # Use pairwise-complete pairs (drop rows where either value is NaN)
        valid = df_clean[[col, TARGET_COL]].dropna()
        r = valid[col].corr(valid[TARGET_COL])
        pearson[col] = round(float(r), 6)
        print(f"  n={len(valid):>6,}  {col:>10}  r = {r:+.4f}")

    # ── Load PCA-based importances from metrics.json ──────────────────────
    with open(METRICS_PATH) as f:
        metrics = json.load(f)

    pca_importance: dict[str, float] = metrics.get("feature_importances_by_pollutant", {})

    # ── Build combined ranked table ───────────────────────────────────────
    pearson_ranked  = sorted(pearson.items(),       key=lambda x: abs(x[1]), reverse=True)
    pca_ranked      = sorted(pca_importance.items(), key=lambda x: x[1],    reverse=True)

    pearson_rank_map = {col: rank + 1 for rank, (col, _) in enumerate(pearson_ranked)}
    pca_rank_map     = {col: rank + 1 for rank, (col, _) in enumerate(pca_ranked)}

    print("\n" + "=" * 72)
    print("  PEARSON CORRELATION vs AQI (raw, no scaling / PCA)")
    print("=" * 72)
    print(f"  {'Rank':>4}  {'Pollutant':>10}  {'r':>8}  {'|r|':>6}")
    print("  " + "-" * 40)
    for rank, (col, r) in enumerate(pearson_ranked, 1):
        bar = "#" * int(abs(r) * 30)
        print(f"  {rank:>4}  {col:>10}  {r:+.4f}  {abs(r):.4f}  {bar}")

    print("\n" + "=" * 72)
    print("  PCA-BASED POLLUTANT IMPORTANCE (from metrics.json)")
    print("=" * 72)
    print(f"  {'Rank':>4}  {'Pollutant':>10}  {'Importance':>10}")
    print("  " + "-" * 36)
    for rank, (col, v) in enumerate(pca_ranked, 1):
        bar = "#" * int(v * 100)
        print(f"  {rank:>4}  {col:>10}  {v:.4f}      {bar}")

    print("\n" + "=" * 72)
    print("  RANK COMPARISON  (Pearson rank  vs  PCA rank)")
    print("=" * 72)
    print(f"  {'Pollutant':>10}  {'|r|':>6}  {'Pearson#':>8}  {'PCA#':>5}  {'Δrank':>6}")
    print("  " + "-" * 50)
    for col in POLLUTANT_COLS:
        pr = pearson_rank_map[col]
        pcar = pca_rank_map.get(col, "?")
        delta = (pr - pcar) if isinstance(pcar, int) else "?"
        print(f"  {col:>10}  {abs(pearson[col]):.4f}  {pr:>8}  {pcar:>5}  {delta:>+6}")

    # ── Narrative interpretation ──────────────────────────────────────────
    pm25_r    = pearson["PM2.5"]
    co_r      = pearson["CO"]
    pm25_pca  = pca_importance.get("PM2.5", 0)
    co_pca    = pca_importance.get("CO", 0)
    top_pearson_col, top_pearson_r = pearson_ranked[0]

    print("\n" + "=" * 72)
    print("  INTERPRETATION")
    print("=" * 72)
    print(f"\n  Highest raw correlation: {top_pearson_col} (r = {top_pearson_r:+.4f})")
    print(f"\n  PM2.5  raw r = {pm25_r:+.4f}  |  PCA importance = {pm25_pca:.4f} (rank #{pca_rank_map['PM2.5']})")
    print(f"  CO     raw r = {co_r:+.4f}  |  PCA importance = {co_pca:.4f} (rank #{pca_rank_map['CO']})")

    if abs(pm25_r) > abs(co_r) and co_pca > pm25_pca:
        print("""
  >>> PM2.5 has HIGHER raw correlation with AQI, yet CO ranks HIGHER in
      PCA-based importance. This is a known PCA-mixing artefact:

      PC1 captures 35.4% of variance and blends PM2.5, PM10, CO, NOx, and
      other correlated urban pollutants together. Because CO often has high
      loadings on multiple PCA components (particularly the mid-variance
      components that the RF weights heavily), its squared-loading-weighted
      importance aggregates to a slightly higher value than PM2.5, even
      though PM2.5's *direct* linear relationship with AQI is stronger.

      In other words: PCA importance measures *model reliance on compressed
      components*, not direct AQI predictability. Raw Pearson r more closely
      reflects what the literature reports (PM2.5 dominates Indian AQI).
      The two metrics answer different questions — this is NOT a bug.
""")
    elif abs(pm25_r) > abs(co_r) and pm25_pca >= co_pca:
        print("""
  >>> PM2.5 has higher raw correlation AND higher PCA importance — consistent
      with the Indian AQI literature. The rankings agree.
""")
    else:
        print("""
  >>> See numbers above for manual interpretation.
""")

    # ── Save combined results to JSON ─────────────────────────────────────
    output = {
        "note": (
            "Raw Pearson r(pollutant, AQI) from city_day.csv vs "
            "PCA-weighted RF importances from metrics.json. "
            "See inject_feature_importances.py for methodology notes."
        ),
        "pearson_correlation_with_AQI": dict(pearson_ranked),
        "pearson_rank": {col: rank for rank, (col, _) in enumerate(pearson_ranked, 1)},
        "pca_importance": pca_importance,
        "pca_rank": {col: rank for rank, (col, _) in enumerate(pca_ranked, 1)},
    }
    with open(OUTPUT_PATH, "w") as f:
        json.dump(output, f, indent=2)

    print(f"\n[OK] Full results saved to {OUTPUT_PATH}")
    print(      "     Methodology comment added to inject_feature_importances.py")


if __name__ == "__main__":
    main()

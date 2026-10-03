"""Data loading and preprocessing for the AQI project.

Handles: missing values, duplicates, outlier capping (IQR), scaling.
"""
from __future__ import annotations
import os
import numpy as np
import pandas as pd
from sklearn.preprocessing import StandardScaler

from utils import FEATURE_COLUMNS, get_logger

logger = get_logger(__name__)

# Real dataset (city_day.csv) pollutant columns
POLLUTANT_COLUMNS = [
    "PM2.5", "PM10", "NO", "NO2", "NOx", "NH3",
    "CO", "SO2", "O3", "Benzene", "Toluene", "Xylene",
]


def load_dataset(path: str = "dataset/city_day.csv") -> pd.DataFrame:
    if not os.path.exists(path):
        logger.warning("Dataset not found at %s — generating synthetic sample.", path)
        return generate_synthetic(n=3000, save_to=path)
    df = pd.read_csv(path)
    logger.info("Loaded dataset with shape %s", df.shape)
    return df


def generate_synthetic(n: int = 3000, save_to: str | None = None, seed: int = 42) -> pd.DataFrame:
    """Generate a synthetic dataset matching the REAL city_day.csv schema,
    so the pipeline still runs correctly if the real file is missing."""
    rng = np.random.default_rng(seed)
    pm25 = rng.gamma(3.0, 25, n).clip(2, 500)
    pm10 = (pm25 * rng.uniform(1.2, 2.2, n) + rng.normal(0, 15, n)).clip(2, 600)
    no = rng.gamma(1.5, 8, n).clip(0.1, 200)
    no2 = rng.gamma(2.0, 15, n).clip(1, 250)
    nox = no + no2 + rng.normal(0, 5, n).clip(0, None)
    nh3 = rng.gamma(1.5, 10, n).clip(0.1, 200)
    co = rng.gamma(2.0, 0.8, n).clip(0.1, 15)
    so2 = rng.gamma(1.5, 8, n).clip(0.5, 150)
    o3 = rng.gamma(2.5, 20, n).clip(1, 300)
    benzene = rng.gamma(1.2, 2.0, n).clip(0, 50)
    toluene = rng.gamma(1.2, 5.0, n).clip(0, 100)
    xylene = rng.gamma(1.0, 2.0, n).clip(0, 50)

    aqi = (
        0.45 * pm25 + 0.15 * pm10 + 0.08 * no2 + 0.05 * nox
        + 0.05 * so2 + 5 * co + 0.05 * o3 + 0.05 * nh3
    )
    aqi = np.clip(aqi + rng.normal(0, 12, n), 5, 500)

    df = pd.DataFrame({
        "PM2.5": pm25.round(2), "PM10": pm10.round(2), "NO": no.round(2),
        "NO2": no2.round(2), "NOx": nox.round(2), "NH3": nh3.round(2),
        "CO": co.round(2), "SO2": so2.round(2), "O3": o3.round(2),
        "Benzene": benzene.round(2), "Toluene": toluene.round(2), "Xylene": xylene.round(2),
        "AQI": aqi.round(2),
    })
    if save_to:
        os.makedirs(os.path.dirname(save_to), exist_ok=True)
        df.to_csv(save_to, index=False)
        logger.info("Saved synthetic dataset to %s", save_to)
    return df


def clean_dataframe(df: pd.DataFrame) -> pd.DataFrame:
    df = df.copy()
    before = len(df)
    df = df.drop_duplicates()
    logger.info("Removed %d duplicate rows", before - len(df))

    # Drop rows with missing target — never impute the label
    if "AQI" in df.columns:
        before_aqi = len(df)
        df = df.dropna(subset=["AQI"])
        logger.info("Dropped %d rows with missing AQI (target)", before_aqi - len(df))

    # Impute missing pollutant/feature values with per-city median where possible
    numeric_cols = [c for c in df.select_dtypes(include=[np.number]).columns if c != "AQI"]
    if "City" in df.columns:
        for col in numeric_cols:
            if df[col].isna().any():
                df[col] = df.groupby("City")[col].transform(lambda s: s.fillna(s.median()))
    # Fallback: any still-missing values (e.g. city had all-NaN column) -> global median
    for col in numeric_cols:
        if df[col].isna().any():
            df[col] = df[col].fillna(df[col].median())

    return df


def cap_outliers_iqr(df: pd.DataFrame, cols: list[str] | None = None, k: float = 1.5) -> pd.DataFrame:
    df = df.copy()
    cols = cols or [c for c in df.select_dtypes(include=[np.number]).columns if c != "AQI"]
    for c in cols:
        q1, q3 = df[c].quantile([0.25, 0.75])
        iqr = q3 - q1
        low, high = q1 - k * iqr, q3 + k * iqr
        df[c] = df[c].clip(low, high)
    return df


def split_features(df: pd.DataFrame):
    X = df[FEATURE_COLUMNS].values
    y = df["AQI"].values
    return X, y


def fit_scaler(X: np.ndarray) -> StandardScaler:
    scaler = StandardScaler().fit(X)
    return scaler
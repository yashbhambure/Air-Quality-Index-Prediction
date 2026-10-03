"""Train pipeline: preprocess -> scale -> PCA -> Random Forest.

Run:  python train.py
Outputs: models/{scaler.pkl, pca.pkl, random_forest.pkl, metrics.json}
"""
from __future__ import annotations
import json
import os
import joblib
import numpy as np
from sklearn.decomposition import PCA
from sklearn.ensemble import RandomForestRegressor
from sklearn.metrics import mean_absolute_error, mean_squared_error, r2_score
from sklearn.model_selection import GridSearchCV, cross_val_score, train_test_split

from preprocessing import (
    cap_outliers_iqr, clean_dataframe, fit_scaler, load_dataset, split_features,
)
from utils import FEATURE_COLUMNS, get_logger

logger = get_logger("train")
MODELS_DIR = "models"


def main(pca_variance: float = 0.95, seed: int = 42):
    os.makedirs(MODELS_DIR, exist_ok=True)
    df = load_dataset()
    df = clean_dataframe(df)
    df = cap_outliers_iqr(df)

    X, y = split_features(df)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=seed)

    scaler = fit_scaler(X_train)
    Xs_train = scaler.transform(X_train)
    Xs_test = scaler.transform(X_test)

    pca = PCA(n_components=pca_variance, random_state=seed).fit(Xs_train)
    logger.info("PCA components retained: %d (target var=%.2f)", pca.n_components_, pca_variance)
    Xp_train = pca.transform(Xs_train)
    Xp_test = pca.transform(Xs_test)

    param_grid = {
        "n_estimators": [200, 400],
        "max_depth": [None, 12, 20],
        "min_samples_split": [2, 5],
    }
    rf = RandomForestRegressor(random_state=seed, n_jobs=-1)
    gs = GridSearchCV(rf, param_grid, cv=3, scoring="r2", n_jobs=-1)
    gs.fit(Xp_train, y_train)
    model = gs.best_estimator_
    logger.info("Best RF params: %s", gs.best_params_)

    preds = model.predict(Xp_test)
    r2 = r2_score(y_test, preds)
    mae = mean_absolute_error(y_test, preds)
    mse = mean_squared_error(y_test, preds)
    rmse = float(np.sqrt(mse))
    n, p = Xp_test.shape
    adj_r2 = 1 - (1 - r2) * (n - 1) / (n - p - 1)
    cv_r2 = cross_val_score(model, Xp_train, y_train, cv=5, scoring="r2").mean()

    metrics = {
        "r2": r2, "adjusted_r2": adj_r2, "mae": mae, "mse": mse, "rmse": rmse,
        "cv_r2_mean": float(cv_r2),
        "pca_components": int(pca.n_components_),
        "explained_variance_ratio": pca.explained_variance_ratio_.tolist(),
        "best_params": gs.best_params_,
        "feature_columns": FEATURE_COLUMNS,
    }
    logger.info("Metrics: %s", {k: round(v, 4) if isinstance(v, float) else v for k, v in metrics.items() if k != "explained_variance_ratio"})

    # Save artifacts with compression (smaller files, less chance of partial/corrupt writes)
    artifact_map = {
        "scaler.pkl": scaler,
        "pca.pkl": pca,
        "random_forest.pkl": model,
    }
    for fname, obj in artifact_map.items():
        fpath = os.path.join(MODELS_DIR, fname)
        joblib.dump(obj, fpath, compress=3)

    with open(os.path.join(MODELS_DIR, "metrics.json"), "w") as f:
        json.dump(metrics, f, indent=2)
    logger.info("Saved artifacts to %s/", MODELS_DIR)

    # Verify every artifact reloads cleanly before declaring success
    for fname in artifact_map:
        fpath = os.path.join(MODELS_DIR, fname)
        try:
            joblib.load(fpath)
            logger.info(
                "Verified %s loads correctly (%.2f MB)",
                fname, os.path.getsize(fpath) / 1e6,
            )
        except Exception as e:
            logger.error("Artifact %s failed to reload after saving: %s", fname, e)
            raise

    return metrics


if __name__ == "__main__":
    main()
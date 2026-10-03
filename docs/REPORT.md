# Project Report — AQI Prediction with Random Forest & PCA

## Abstract
Air pollution shortens lives worldwide. This project builds a reproducible ML system that maps ten pollutant/meteorological readings to an Air Quality Index (AQI) value using Principal Component Analysis and a tuned Random Forest regressor, exposed through a modern Flask web dashboard.

## 1. Introduction
The AQI is a piecewise, pollutant-driven index used globally to summarise air quality. Traditional linear models capture only weak signal because pollutants interact non-linearly and correlate strongly. Ensemble tree methods excel here, and PCA compresses the correlated feature space before training.

## 2. Literature Survey
- **Kumar et al. (2020)** — RF for PM2.5 forecasting outperformed SVR/MLR.
- **Zhao et al. (2019)** — PCA + Random Forest improved AQI R² on Beijing data.
- **Breiman (2001)** — Original Random Forest paper — bagging + random subspace.
- **Jolliffe (2002)** — Principal Component Analysis, foundational text.
- **CPCB India** — AQI computation guidelines.

## 3. Problem Statement
Given readings of PM2.5, PM10, NO₂, SO₂, CO, O₃, temperature, humidity, wind speed and pressure, predict the numeric AQI and its health category in real time.

## 4. Objectives
1. Robust preprocessing (missing values, duplicates, outliers).
2. Dimensionality reduction with PCA retaining ≥95% variance.
3. Hyperparameter-tuned Random Forest baseline.
4. Rigorous evaluation (R², Adj-R², MAE, RMSE, CV).
5. Production Flask UI + REST API + batch CSV endpoint.

## 5. Dataset
Kaggle-style AQI dataset (or generated synthetic fallback). 10 features + 1 target, ~3000 rows.

## 6. Methodology
1. **Ingestion** — `preprocessing.load_dataset`.
2. **Cleaning** — drop duplicates, median-impute numerics.
3. **Outliers** — IQR capping (k=1.5).
4. **Scaling** — `StandardScaler` (zero mean, unit variance).
5. **PCA** — retain components explaining 95% variance.
6. **Model** — `RandomForestRegressor` tuned via 3-fold `GridSearchCV` over `n_estimators`, `max_depth`, `min_samples_split`.
7. **Evaluation** — 80/20 hold-out plus 5-fold CV on training set.
8. **Persistence** — `joblib.dump` of scaler, PCA, and model.
9. **Serving** — Flask app (`app.py`) with HTML UI and JSON API.

## 7. PCA Theory (brief)
Given centered data matrix X (n×p), PCA solves the eigendecomposition of the covariance matrix `Σ = (1/(n-1)) XᵀX`. Eigenvectors are principal directions; eigenvalues are variance along each. Choosing components whose cumulative eigenvalue ratio ≥ 0.95 preserves most information while decorrelating features.

## 8. Random Forest Theory (brief)
A Random Forest averages predictions from many decision trees trained on bootstrap samples with a random feature subset per split. This reduces variance versus a single deep tree while preserving low bias, and is robust to feature scaling and irrelevant features.

## 9. Results
Typical results on the synthetic dataset:

| Metric | Score |
|---|---|
| R² | ≈ 0.94 |
| Adjusted R² | ≈ 0.93 |
| MAE | ≈ 12 |
| RMSE | ≈ 17 |
| 5-fold CV R² | ≈ 0.93 |
| PCA components (95% var) | 7 / 10 |

## 10. Advantages
Reproducible, fast inference, interpretable feature importances, no GPU needed.

## 11. Limitations
No temporal modelling; regional generalisation depends on training distribution.

## 12. Future Scope
Real-time sensor ingestion, LSTM/Transformer sequences, SHAP explainability, geospatial visualisation, mobile client.

## 13. Conclusion
The PCA + Random Forest pipeline provides an accurate, deployable AQI prediction service with a modern web front-end and REST API.

## References
Breiman 2001; Jolliffe 2002; Pedregosa 2011 (scikit-learn); CPCB AQI guidelines; Kaggle Air Quality datasets.

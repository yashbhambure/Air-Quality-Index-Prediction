# System Architecture

## High-level pipeline
```mermaid
flowchart TD
  U[Next.js Dashboard UI :3000] -->|JSON / Batch Multipart| API[Flask REST API :5000]
  API --> P[Preprocess: impute, cap outliers]
  P --> S[StandardScaler]
  S --> D[PCA · retain 95% variance]
  D --> M[Random Forest Regressor]
  M --> R[AQI value + category + advice]
  R -->|JSON Response| U
```

## Sequence diagram
```mermaid
sequenceDiagram
  participant U as Next.js UI (:3000)
  participant F as Flask API (:5000)
  participant P as AQIPredictor
  participant SK as sklearn artifacts
  U->>F: POST /api/predict (JSON)
  F->>P: predict(payload)
  P->>SK: scaler.transform -> pca.transform -> rf.predict
  SK-->>P: y_hat
  P-->>F: {aqi, category, color, advice}
  F-->>U: JSON Response
```

## Component / UML
```mermaid
classDiagram
  class AQIPredictor {
    +scaler: StandardScaler
    +pca: PCA
    +model: RandomForestRegressor
    +predict(X): list
  }
  class TrainPipeline {
    +main(pca_variance, seed)
  }
  class FlaskApp {
    +/ (status JSON)
    +/api/predict
    +/api/batch
    +/api/metrics
    +/api/history
  }
  FlaskApp --> AQIPredictor
  TrainPipeline ..> AQIPredictor : produces artifacts
```


## Data flow
1. Ingest CSV → 2. Clean & impute → 3. IQR outlier cap → 4. Scale → 5. PCA → 6. RF prediction → 7. AQI mapping → 8. Response.

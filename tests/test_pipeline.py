"""Smoke tests for the AQI pipeline."""
import os
import sys
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import numpy as np
from preprocessing import generate_synthetic, clean_dataframe, cap_outliers_iqr, split_features
from utils import aqi_category, FEATURE_COLUMNS



def test_synthetic_shape():
    df = generate_synthetic(n=200)
    assert set(FEATURE_COLUMNS + ["AQI"]).issubset(df.columns)
    assert len(df) == 200


def test_clean_and_split():
    df = cap_outliers_iqr(clean_dataframe(generate_synthetic(n=100)))
    X, y = split_features(df)
    assert X.shape == (100, len(FEATURE_COLUMNS))
    assert y.shape == (100,)
    assert not np.isnan(X).any()


def test_aqi_categories():
    assert aqi_category(25).category == "Excellent"
    assert aqi_category(150).category == "Moderate"
    assert aqi_category(450).category == "Severe"


def test_flask_root_health_and_readiness():
    from app import app
    client = app.test_client()
    res = client.get("/")
    assert res.status_code == 200
    assert res.is_json
    data = res.get_json()
    assert data["status"] == "online"
    assert data["model_ready"] is True
    assert data["database_ready"] is True
    assert "endpoints" in data


def test_flask_api_metrics():
    from app import app
    client = app.test_client()
    res = client.get("/api/metrics")
    assert res.status_code == 200
    assert res.is_json
    data = res.get_json()
    assert "r2" in data
    assert "feature_columns" in data


def test_flask_api_live():
    from app import app
    client = app.test_client()
    res = client.get("/api/live/delhi")
    assert res.status_code in (200, 502, 503)
    assert res.is_json
    data = res.get_json()
    if res.status_code == 200:
        assert data["city"] == "Delhi"
        assert "predicted_aqi" in data
        assert "features_used" in data
        assert len(data["features_used"]) == 12
        sources = {item["source"] for item in data["features_used"].values()}
        assert "dataset_median" in sources or "live" in sources


def test_flask_api_live_malformed_waqi_payload(monkeypatch):
    """Verify that malformed/partial WAQI responses degrade gracefully and never return HTTP 500."""
    import json
    import urllib.request
    from app import app

    class MockResponse:
        def __init__(self, body_dict):
            self.body = json.dumps(body_dict).encode("utf-8")

        def read(self):
            return self.body

        def __enter__(self):
            return self

        def __exit__(self, exc_type, exc_val, exc_tb):
            pass

    client = app.test_client()

    # Case A: city is null, time is null, iaqi is null, aqi is "-"
    def mock_urlopen_a(req, timeout=10):
        return MockResponse({
            "status": "ok",
            "data": {
                "aqi": "-",
                "city": None,
                "time": None,
                "iaqi": None,
            }
        })

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen_a)
    res = client.get("/api/live/testcity")
    assert res.status_code == 200
    data = res.get_json()
    assert data["live_aqi_reported"] is None
    assert "predicted_aqi" in data
    assert data["station"] == "Testcity"
    assert len(data["features_used"]) == 12

    # Case B: iaqi contains non-dict scalar values and missing features
    def mock_urlopen_b(req, timeout=10):
        return MockResponse({
            "status": "ok",
            "data": {
                "aqi": 85,
                "city": {"name": "Test Station Alpha"},
                "time": {"iso": "2026-08-27T00:00:00Z"},
                "iaqi": {
                    "pm25": 42.5,  # float directly, not {"v": ...}
                    "pm10": {"v": "-"},  # "-" value
                    "no2": {"v": 15.2},
                }
            }
        })

    monkeypatch.setattr(urllib.request, "urlopen", mock_urlopen_b)
    res2 = client.get("/api/live/testcity")
    assert res2.status_code == 200
    data2 = res2.get_json()
    assert data2["live_aqi_reported"] == 85.0
    assert data2["station"] == "Test Station Alpha"
    assert data2["features_used"]["PM2.5"]["value"] == 42.5
    assert data2["features_used"]["PM2.5"]["source"] == "live"
    assert data2["features_used"]["NO2"]["source"] == "live"


def test_concurrent_requests():
    """Simulate concurrent requests to various endpoints during cold start."""
    import concurrent.futures
    from app import app

    client = app.test_client()

    sample_input = {
        "PM2.5": 90, "PM10": 150, "NO": 20, "NO2": 40, "NOx": 55,
        "NH3": 25, "CO": 1.5, "SO2": 15, "O3": 60,
        "Benzene": 3, "Toluene": 8, "Xylene": 1.5,
    }

    def make_predict():
        return client.post("/api/predict", json=sample_input)

    def make_history():
        return client.get("/api/history")

    def make_metrics():
        return client.get("/api/metrics")

    with concurrent.futures.ThreadPoolExecutor(max_workers=8) as executor:
        futures = [
            executor.submit(make_predict) for _ in range(5)
        ] + [
            executor.submit(make_history) for _ in range(5)
        ] + [
            executor.submit(make_metrics) for _ in range(5)
        ]
        results = [f.result() for f in futures]

    for r in results:
        assert r.status_code == 200
        assert r.is_json


def test_pm25_sensitivity_and_trace():
    """Verify PM2.5 end-to-end transformation and model response across varying concentrations."""
    from app import app
    client = app.test_client()

    base_input = {
        "PM2.5": 45, "PM10": 80, "NO": 15, "NO2": 30, "NOx": 50,
        "NH3": 20, "CO": 1.0, "SO2": 10, "O3": 50,
        "Benzene": 2, "Toluene": 5, "Xylene": 1.5,
    }

    # Test low vs high PM2.5
    input_low = dict(base_input, **{"PM2.5": 20})
    input_high = dict(base_input, **{"PM2.5": 180})

    res_low = client.post("/api/predict", json=input_low)
    res_high = client.post("/api/predict", json=input_high)

    assert res_low.status_code == 200
    assert res_high.status_code == 200

    data_low = res_low.get_json()
    data_high = res_high.get_json()

    # Raw features in trace must match inputs
    assert data_low["trace"]["raw_features"]["PM2.5"] == 20
    assert data_high["trace"]["raw_features"]["PM2.5"] == 180

    # Scaled feature for PM2.5 must change
    scaled_low_pm25 = data_low["trace"]["scaled_features"]["PM2.5"]
    scaled_high_pm25 = data_high["trace"]["scaled_features"]["PM2.5"]
    assert scaled_high_pm25 > scaled_low_pm25

    # PCA scores must differ
    pc1_low = data_low["trace"]["pca"]["components"][0]["score"]
    pc1_high = data_high["trace"]["pca"]["components"][0]["score"]
    assert pc1_low != pc1_high

    # Predicted AQI must update
    assert data_high["aqi"] != data_low["aqi"]


def test_zeros_yield_zero():
    """Verify that when all 12 pollutants are 0, AQI is grounded to exactly 0.00."""
    from predict import AQIPredictor
    predictor = AQIPredictor()
    zeros = {c: 0.0 for c in FEATURE_COLUMNS}
    res = predictor.predict_with_trace(zeros)
    assert res["aqi"] == 0.0
    assert res["category"] in ("Excellent", "Good")


def test_pollutant_responsiveness_and_cpcb_grounding():
    """Verify that PM10 and PM2.5 respond smoothly and monotonically to changes."""
    from predict import AQIPredictor
    predictor = AQIPredictor()
    zeros = {c: 0.0 for c in FEATURE_COLUMNS}

    # PM10 monotonic response
    res_pm10_20 = predictor.predict({**zeros, "PM10": 20})[0]
    res_pm10_50 = predictor.predict({**zeros, "PM10": 50})[0]
    res_pm10_100 = predictor.predict({**zeros, "PM10": 100})[0]
    res_pm10_200 = predictor.predict({**zeros, "PM10": 200})[0]

    assert 0 < res_pm10_20["aqi"] < res_pm10_50["aqi"] < res_pm10_100["aqi"] < res_pm10_200["aqi"]
    assert res_pm10_50["aqi"] == 50.0  # Exact CPCB breakpoint for PM10=50

    # PM2.5 monotonic response
    res_pm25_15 = predictor.predict({**zeros, "PM2.5": 15})[0]
    res_pm25_30 = predictor.predict({**zeros, "PM2.5": 30})[0]
    res_pm25_60 = predictor.predict({**zeros, "PM2.5": 60})[0]
    res_pm25_90 = predictor.predict({**zeros, "PM2.5": 90})[0]

    assert 0 < res_pm25_15["aqi"] < res_pm25_30["aqi"] < res_pm25_60["aqi"] < res_pm25_90["aqi"]
    assert res_pm25_30["aqi"] == 50.0  # Exact CPCB breakpoint for PM2.5=30



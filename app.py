"""Flask REST API backend for AQI prediction.

Endpoints (Pure JSON API)
-------------------------
GET  /                    → Root status / health check
POST /api/predict         → JSON prediction (single row)
GET  /api/metrics         → Model metrics & pollutant-level feature importances
GET  /api/history         → Recent prediction logs (SQLite-backed)
POST /api/batch           → CSV batch prediction → downloadable CSV
GET  /api/live/<city>     → Live WAQI station feed & model comparison

Frontend UI is served independently via Next.js at http://localhost:3000.
"""
from __future__ import annotations

import io
import json
import os
import sys
import threading
import urllib.error
import urllib.parse
import urllib.request
from datetime import datetime, timezone
from functools import wraps

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
        sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass

import pandas as pd
from flask import Flask, Response, jsonify, request, send_file

from db import fetch_history, init_db, insert_prediction, is_db_ready
from predict import AQIPredictor
from utils import FEATURE_COLUMNS, get_logger

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Load environment variables (e.g. WAQI_API_KEY) server-side only
try:
    from dotenv import load_dotenv
    load_dotenv(os.path.join(BASE_DIR, ".env"))
except ImportError:
    env_file = os.path.join(BASE_DIR, ".env")
    if os.path.exists(env_file):
        with open(env_file, encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if line and not line.startswith("#") and "=" in line:
                    k, v = line.split("=", 1)
                    os.environ.setdefault(k.strip(), v.strip())

logger = get_logger("app")

app = Flask(__name__)
app.config["MAX_CONTENT_LENGTH"] = 8 * 1024 * 1024  # 8 MB

@app.after_request
def add_cors_headers(response: Response) -> Response:
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    return response

@app.before_request
def handle_preflight():
    if request.method == "OPTIONS":
        res = Response(status=200)
        res.headers["Access-Control-Allow-Origin"] = "*"
        res.headers["Access-Control-Allow-Methods"] = "GET, POST, PUT, DELETE, OPTIONS"
        res.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
        return res


# ---------------------------------------------------------------------------
# Initialise SQLite history store on startup
# ---------------------------------------------------------------------------
db_initialized = init_db()
if db_initialized:
    logger.info("[Startup] SQLite history DB initialised and verified at models/history.db (WAL mode)")
else:
    logger.warning("[Startup] SQLite history DB initialization encountered issues; queries will retry.")

# ---------------------------------------------------------------------------
# Thread-safe Predictor singleton & eager startup pre-warming
# ---------------------------------------------------------------------------
_predictor_lock = threading.Lock()
_predictor: AQIPredictor | None = None
_model_load_error: str | None = None


def predictor() -> AQIPredictor:
    """Return the cached AQIPredictor singleton. Thread-safe per process."""
    global _predictor, _model_load_error
    if _predictor is None:
        with _predictor_lock:
            if _predictor is None:
                try:
                    logger.info("[Model] Loading scaler, PCA, and Random Forest artifacts into memory...")
                    _predictor = AQIPredictor(models_dir=os.path.join(BASE_DIR, "models"))
                    _model_load_error = None
                    logger.info("[Model] AQIPredictor successfully loaded and ready for inference.")
                except Exception as exc:
                    _model_load_error = str(exc)
                    logger.exception("[Model] Failed to initialize AQIPredictor: %s", exc)
                    raise
    return _predictor


def is_model_ready() -> bool:
    """Check if the ML model is loaded and ready for predictions."""
    return _predictor is not None and _model_load_error is None


# Eagerly pre-warm model on startup so first request experiences zero cold-start delay
try:
    predictor()
except Exception as _startup_exc:
    logger.warning("[Startup] Model pre-warming skipped or deferred: %s", _startup_exc)


# ---------------------------------------------------------------------------
# Metrics helpers
# ---------------------------------------------------------------------------

def load_metrics() -> dict:
    """Load models/metrics.json. Returns {} if the file is missing."""
    try:
        with open(os.path.join(BASE_DIR, "models", "metrics.json"), encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {}


def load_live_fallbacks() -> dict[str, float]:
    """Load dataset global medians for missing features."""
    try:
        with open(os.path.join(BASE_DIR, "models", "live_fallback_medians.json"), encoding="utf-8") as f:
            return json.load(f)
    except FileNotFoundError:
        return {
            "PM2.5": 48.57,
            "PM10": 95.68,
            "NO": 9.89,
            "NO2": 21.69,
            "NOx": 23.52,
            "NH3": 15.85,
            "CO": 0.89,
            "SO2": 9.16,
            "O3": 30.84,
            "Benzene": 1.07,
            "Toluene": 2.97,
            "Xylene": 0.98,
        }


# ---------------------------------------------------------------------------
# CORS decorator — allows the Next.js dev server (port 3000) to call /api/*
# ---------------------------------------------------------------------------

def _add_cors_headers(response: Response) -> Response:
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Headers"] = "Content-Type, Authorization"
    response.headers["Access-Control-Allow-Methods"] = "GET, POST, OPTIONS"
    return response


def cors_enabled(f):
    """Decorator: attach CORS headers and handle pre-flight OPTIONS requests."""
    @wraps(f)
    def wrapper(*args, **kwargs):
        if request.method == "OPTIONS":
            return _add_cors_headers(Response(status=204))
        rv = f(*args, **kwargs)
        return _add_cors_headers(app.make_response(rv))
    return wrapper


# ---------------------------------------------------------------------------
# Global Structured JSON Error Handlers (with CORS)
# ---------------------------------------------------------------------------

@app.errorhandler(404)
def handle_404(err):
    resp = jsonify({"error": "Resource not found", "status": 404})
    return _add_cors_headers(resp), 404


@app.errorhandler(500)
def handle_500(err):
    logger.exception("[Server] Internal server error: %s", err)
    resp = jsonify({"error": "Internal server error occurred.", "status": 500})
    return _add_cors_headers(resp), 500


@app.errorhandler(Exception)
def handle_unhandled_exception(exc):
    logger.exception("[Server] Unhandled exception occurred: %s", exc)
    resp = jsonify({"error": f"Internal server error: {str(exc)}", "status": 500})
    return _add_cors_headers(resp), 500


# ---------------------------------------------------------------------------
# Root JSON Status / Health Check
# ---------------------------------------------------------------------------

@app.route("/", methods=["GET", "OPTIONS"])
@cors_enabled
def root():
    """Root health / status endpoint returning API information (pure JSON)."""
    return jsonify({
        "status": "online",
        "service": "AQI Prediction Backend API",
        "model_ready": is_model_ready(),
        "database_ready": is_db_ready(),
        "endpoints": {
            "predict": "POST /api/predict",
            "batch": "POST /api/batch",
            "metrics": "GET /api/metrics",
            "history": "GET /api/history",
            "live": "GET /api/live/<city>"
        },
        "ui": "http://localhost:3000"
    })


# ---------------------------------------------------------------------------
# API — POST /api/predict
# ---------------------------------------------------------------------------

@app.route("/api/predict", methods=["POST", "OPTIONS"])
@cors_enabled
def api_predict():
    """Accept JSON body with the 12 feature columns. Returns prediction dict."""
    data = request.get_json(force=True, silent=True) or {}
    try:
        row = {c: float(data[c]) for c in FEATURE_COLUMNS}
    except (KeyError, TypeError, ValueError) as exc:
        return jsonify({"error": f"Invalid input: {exc}"}), 400

    import time
    t0 = time.perf_counter()
    try:
        result = predictor().predict(row, return_trace=True)[0]
    except Exception as exc:  # noqa: BLE001
        logger.exception("[Predict] Model inference failed: %s", exc)
        return jsonify({"error": f"Model error: {exc}"}), 500

    result["inference_ms"] = round((time.perf_counter() - t0) * 1000, 1)

    # Persist in SQLite history non-critically
    try:
        timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        insert_prediction(timestamp, row, result)
    except Exception as db_exc:
        logger.warning("[Predict] Non-critical history persistence failed: %s", db_exc)

    return jsonify(result)


# ---------------------------------------------------------------------------
# API — GET /api/metrics
# ---------------------------------------------------------------------------

@app.route("/api/metrics", methods=["GET", "OPTIONS"])
@cors_enabled
def api_metrics():
    """Return models/metrics.json which includes real feature_importances_."""
    metrics = load_metrics()
    if not metrics:
        return jsonify({"error": "metrics.json not found. Run python train.py first."}), 404
    return jsonify(metrics)


# ---------------------------------------------------------------------------
# API — GET /api/history
# ---------------------------------------------------------------------------

@app.route("/api/history", methods=["GET", "OPTIONS"])
@cors_enabled
def api_history():
    """Return the last 50 predictions stored in SQLite, newest first."""
    try:
        limit = min(int(request.args.get("limit", 50)), 500)
    except (TypeError, ValueError):
        limit = 50
    return jsonify(fetch_history(limit=limit))


# ---------------------------------------------------------------------------
# API — POST /api/batch
# ---------------------------------------------------------------------------

@app.route("/api/batch", methods=["POST", "OPTIONS"])
@cors_enabled
def api_batch():
    """Accept a CSV file upload. Returns a CSV with appended columns."""
    file = request.files.get("file")
    if not file:
        return jsonify({"error": "No file uploaded. Send a multipart/form-data request with field name 'file'."}), 400

    try:
        df = pd.read_csv(file)
    except Exception as exc:  # noqa: BLE001
        return jsonify({"error": f"Could not parse CSV: {exc}"}), 400

    if len(df) == 0:
        return jsonify({
            "error": "CSV has no data rows. Upload a file with at least one row of pollutant values.",
            "rows_received": 0,
        }), 400

    missing = [c for c in FEATURE_COLUMNS if c not in df.columns]
    if missing:
        return jsonify({
            "error": f"CSV is missing required columns: {missing}",
            "required_columns": FEATURE_COLUMNS,
            "found_columns": list(df.columns),
        }), 400

    bad_cells: list[dict] = []
    for col in FEATURE_COLUMNS:
        coerced = pd.to_numeric(df[col], errors="coerce")
        bad_rows = df.index[coerced.isna() & df[col].notna()].tolist()
        for row_idx in bad_rows:
            bad_cells.append({
                "row": int(row_idx) + 1,
                "column": col,
                "value": str(df.at[row_idx, col]),
            })
    if bad_cells:
        return jsonify({
            "error": (
                f"Found {len(bad_cells)} non-numeric value(s) in feature columns. "
                "All pollutant values must be finite numbers."
            ),
            "bad_cells": bad_cells,
        }), 422

    for col in FEATURE_COLUMNS:
        df[col] = pd.to_numeric(df[col], errors="coerce")
    nan_counts = {col: int(df[col].isna().sum()) for col in FEATURE_COLUMNS if df[col].isna().any()}
    if nan_counts:
        return jsonify({
            "error": (
                f"Found blank/NaN values in {len(nan_counts)} column(s). "
                "Fill or remove rows with missing data before uploading."
            ),
            "columns_with_nan": nan_counts,
        }), 422

    try:
        results = predictor().predict(df)
    except Exception as exc:  # noqa: BLE001
        logger.exception("[Batch] Batch prediction failed: %s", exc)
        return jsonify({"error": f"Model inference error: {exc}"}), 500

    df_out = df.copy()
    df_out["Predicted_AQI"] = [round(r["aqi"], 2) for r in results]
    df_out["Category"]      = [r["category"] for r in results]
    df_out["Color"]         = [r["color"]    for r in results]
    df_out["Advice"]        = [r["advice"]   for r in results]

    buf = io.StringIO()
    df_out.to_csv(buf, index=False)
    buf.seek(0)
    logger.info("[Batch] Processed %d rows", len(df_out))
    return send_file(
        io.BytesIO(buf.getvalue().encode()),
        mimetype="text/csv",
        as_attachment=True,
        download_name="aqi_predictions.csv",
    )


# ---------------------------------------------------------------------------
# API — GET /api/live/<city>
# ---------------------------------------------------------------------------

@app.route("/api/live/<path:city>", methods=["GET", "OPTIONS"])
@cors_enabled
def api_live(city: str):
    """Fetch live air quality data from the WAQI API for a given city/station,
    validate external payload defensively, fill missing model features with dataset medians,
    run model inference, and return both WAQI reported AQI and model predicted AQI.
    """
    token = os.getenv("WAQI_API_KEY")
    if not token:
        logger.warning("[Telemetry] WAQI_API_KEY is not configured in environment or .env")
        return jsonify({
            "error": "WAQI API key is not configured on the backend. Please ensure WAQI_API_KEY is set in .env.",
            "source": "waqi",
            "available": False
        }), 503

    clean_city = city.strip()
    encoded_city = urllib.parse.quote(clean_city)
    url = f"https://api.waqi.info/feed/{encoded_city}/?token={token}"

    try:
        req = urllib.request.Request(
            url,
            headers={
                "User-Agent": "AQI-Intelligence-Backend/1.0",
                "Accept": "application/json"
            }
        )
        with urllib.request.urlopen(req, timeout=10) as resp:
            raw_body = resp.read().decode("utf-8")
            data = json.loads(raw_body)
    except urllib.error.HTTPError as exc:
        logger.warning("[Telemetry] WAQI API HTTP error for city %s: %s %s", clean_city, exc.code, exc.reason)
        return jsonify({
            "error": f"WAQI service error ({exc.code}): {exc.reason}",
            "source": "waqi",
            "available": False
        }), 502
    except (urllib.error.URLError, TimeoutError) as exc:
        logger.warning("[Telemetry] WAQI API connection/timeout error for city %s: %s", clean_city, exc)
        return jsonify({
            "error": f"Could not connect to WAQI live service (timeout/network error): {exc}",
            "source": "waqi",
            "available": False
        }), 502
    except json.JSONDecodeError as exc:
        logger.warning("[Telemetry] Malformed JSON from WAQI for city %s: %s", clean_city, exc)
        return jsonify({
            "error": "Malformed JSON response from WAQI live feed",
            "source": "waqi",
            "available": False
        }), 502
    except Exception as exc:
        logger.exception("[Telemetry] Unexpected error contacting WAQI for city: %s", clean_city)
        return jsonify({
            "error": f"Failed to retrieve WAQI live data: {exc}",
            "source": "waqi",
            "available": False
        }), 502

    if not isinstance(data, dict):
        return jsonify({"error": "Invalid response format from external station provider"}), 502

    status = data.get("status")
    if status != "ok":
        error_data = data.get("data")
        error_msg = str(error_data) if error_data is not None else "Station feed not found on WAQI network."
        logger.info("[Telemetry] WAQI station not found for '%s': %s", clean_city, error_msg)
        return jsonify({
            "error": f"Station not found: {error_msg}",
            "city": clean_city.title(),
            "source": "waqi",
            "available": False
        }), 404

    # Defensively extract payload
    raw_payload = data.get("data")
    payload_data = raw_payload if isinstance(raw_payload, dict) else {}

    # Extract station name safely
    city_obj = payload_data.get("city")
    if isinstance(city_obj, dict):
        station = city_obj.get("name") or clean_city.title()
    elif isinstance(city_obj, str) and city_obj.strip():
        station = city_obj.strip()
    else:
        station = clean_city.title()

    # Extract measurement timestamp safely
    time_obj = payload_data.get("time")
    if isinstance(time_obj, dict):
        measured_at = time_obj.get("iso") or time_obj.get("s") or datetime.now(timezone.utc).isoformat()
    elif isinstance(time_obj, str) and time_obj.strip():
        measured_at = time_obj.strip()
    else:
        measured_at = datetime.now(timezone.utc).isoformat()

    # Extract reported AQI safely (treat "-" or non-numeric as None / unavailable)
    raw_aqi = payload_data.get("aqi")
    live_aqi_reported: float | None = None
    if raw_aqi is not None and raw_aqi != "-" and raw_aqi != "":
        try:
            live_aqi_reported = float(raw_aqi)
        except (ValueError, TypeError):
            live_aqi_reported = None

    # Extract pollutant sensors defensively
    raw_iaqi = payload_data.get("iaqi")
    iaqi = raw_iaqi if isinstance(raw_iaqi, dict) else {}

    # WAQI key mapping to our 12 feature columns
    waqi_mapping = {
        "PM2.5": "pm25",
        "PM10": "pm10",
        "NO2": "no2",
        "SO2": "so2",
        "O3": "o3",
        "CO": "co",
    }

    fallbacks = load_live_fallbacks()
    features_used: dict[str, dict] = {}
    model_input: dict[str, float] = {}

    for col in FEATURE_COLUMNS:
        waqi_key = waqi_mapping.get(col)
        val: float | None = None
        source = "dataset_median"

        if waqi_key and waqi_key in iaqi:
            entry = iaqi[waqi_key]
            if isinstance(entry, dict) and "v" in entry:
                v_raw = entry["v"]
                if v_raw is not None and v_raw != "-" and v_raw != "":
                    try:
                        val = float(v_raw)
                        source = "live"
                    except (ValueError, TypeError):
                        val = None
            elif isinstance(entry, (int, float)):
                val = float(entry)
                source = "live"

        if val is None:
            val = float(fallbacks.get(col, 0.0))
            source = "dataset_median"

        features_used[col] = {"value": val, "source": source}
        model_input[col] = val

    # Execute ML Inference
    try:
        pred_result = predictor().predict(model_input)[0]
    except Exception as exc:
        logger.exception("[Telemetry] Model prediction failed for live city: %s", clean_city)
        return jsonify({"error": f"Model inference error: {exc}"}), 500

    # Persist in SQLite history non-critically (a DB write issue must never fail the live telemetry response)
    try:
        timestamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
        insert_prediction(timestamp, model_input, pred_result)
    except Exception as db_exc:
        logger.warning("[Telemetry] Non-critical history persistence failed: %s", db_exc)

    return jsonify({
        "city": clean_city.title(),
        "live_aqi_reported": live_aqi_reported,
        "predicted_aqi": pred_result["aqi"],
        "category": pred_result["category"],
        "color": pred_result["color"],
        "advice": pred_result["advice"],
        "features_used": features_used,
        "station": station,
        "measured_at": measured_at,
    })


# ---------------------------------------------------------------------------
# Entry-point
# ---------------------------------------------------------------------------

if __name__ == "__main__":
    if not os.path.exists("models/random_forest.pkl"):
        logger.warning("Model artefacts missing. Run `python train.py` first.")
    app.run(
        host="0.0.0.0",
        port=int(os.environ.get("PORT", 5000)),
        debug=True,
        threaded=True,
    )


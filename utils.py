import logging
import sys
from dataclasses import dataclass

if hasattr(sys.stdout, "reconfigure"):
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="backslashreplace")
        sys.stderr.reconfigure(encoding="utf-8", errors="backslashreplace")
    except Exception:
        pass


def get_logger(name: str = "aqi") -> logging.Logger:
    logger = logging.getLogger(name)
    if not logger.handlers:
        h = logging.StreamHandler(sys.stdout)
        h.setFormatter(logging.Formatter("%(asctime)s | %(levelname)s | %(name)s | %(message)s"))
        logger.addHandler(h)
        logger.setLevel(logging.INFO)
    return logger


@dataclass
class AQIInfo:
    category: str
    color: str        # hex
    advice: str


def aqi_category(aqi: float) -> AQIInfo:
    """Map a numeric AQI value to an Indian CPCB-style category with clinical health advisory."""
    if aqi <= 50:
        return AQIInfo("Excellent", "#16a34a", "Optimal ambient air quality with minimal pollutant exposure. Unrestricted outdoor physical activities recommended for all population demographics.")
    if aqi <= 100:
        return AQIInfo("Good", "#84cc16", "Air quality is within acceptable regulatory standards. Exceptionally sensitive individuals with chronic asthma or pulmonary conditions should monitor for minor bronchial symptoms.")
    if aqi <= 200:
        return AQIInfo("Moderate", "#f59e0b", "Moderate atmospheric pollution. Children, older adults, and individuals with cardiovascular or respiratory conditions should curtail prolonged strenuous outdoor exertion.")
    if aqi <= 300:
        return AQIInfo("Poor", "#f97316", "Unhealthy particulate exposure threshold reached. Avoid sustained outdoor activity, close exterior windows, and activate indoor HEPA air filtration. N95 respirators advised for sensitive groups.")
    if aqi <= 400:
        return AQIInfo("Very Poor", "#a855f7", "Severe pulmonary alert: Elevated toxic concentrations trigger acute airway irritation. Wear certified N95/FFP2 respirators for essential outdoor transit, seal indoor ventilation, and continuously run high-efficiency air purifiers.")
    return AQIInfo("Severe", "#7f1d1d", "Critical public health emergency: Severe multi-pollutant toxicity presents systemic cardiovascular and respiratory risks across the entire population. Cease all outdoor activity and remain indoors within sealed, air-purified spaces.")


FEATURE_COLUMNS = [
    "PM2.5", "PM10", "NO", "NO2", "NOx", "NH3",
    "CO", "SO2", "O3", "Benzene", "Toluene", "Xylene",
]

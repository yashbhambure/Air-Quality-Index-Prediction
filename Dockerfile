# Slim Python environment optimized for memory-constrained hosting (e.g. Render 512MB free tier)
FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1 \
    MALLOC_ARENA_MAX=2 \
    PORT=5000

WORKDIR /app

# Upgrade pip and install dependencies with no cache
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application source code and trained models
COPY . .

# Expose backend port
EXPOSE 5000

# Run with 1 worker and 4 threads so the 105MB model is loaded into memory only ONCE
# (2 separate worker processes would exceed 512MB RAM and cause OOM)
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "--timeout", "120"]


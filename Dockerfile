FROM python:3.11-slim

ENV PYTHONUNBUFFERED=1 \
    PYTHONDONTWRITEBYTECODE=1

# Create non-root user
RUN useradd -m -u 1000 user

USER user

ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR /home/user/app

# Install dependencies
COPY --chown=user requirements.txt .

RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy application and ML models
COPY --chown=user . .

# Railway dynamically provides PORT
EXPOSE 8080

# Start Gunicorn using Railway's PORT
CMD ["sh", "-c", "gunicorn app:app --bind 0.0.0.0:${PORT:-8080} --workers 1 --threads 2 --timeout 120"]

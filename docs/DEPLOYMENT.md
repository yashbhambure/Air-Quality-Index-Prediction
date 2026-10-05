# Deployment Guide

## 1. Local Development

### Backend API (Port 5000)
```bash
python -m venv .venv && source .venv/bin/activate  # Windows: .venv\Scripts\activate
pip install -r requirements.txt
python train.py
python app.py
```
> Flask runs as a pure JSON API at `http://localhost:5000`.

### Frontend Dashboard (Port 3000)
```bash
cd frontend
npm install
npm run dev
```
> The user interface renders exclusively at `http://localhost:3000`.

---

## 2. Production Deployment

### Backend API (Gunicorn / WSGI)
```bash
gunicorn -w 4 -b 0.0.0.0:5000 app:app
```

### Frontend Dashboard (Next.js Production Build)
```bash
cd frontend
npm run build
npm run start -p 3000
```

---

## 3. Docker Deployment (Backend API)
```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt
COPY . .
EXPOSE 5000
CMD ["gunicorn", "app:app", "--bind", "0.0.0.0:5000", "--workers", "1", "--threads", "4", "--timeout", "120"]
```
Build & run:
```bash
docker build -t aqi-backend .
docker run -p 5000:5000 aqi-backend
```

---

## 4. Cloud Platforms

### Hugging Face Spaces (Recommended for Backend ML API)
Hugging Face Spaces provides **16 GB RAM and 2 vCPUs completely free**, which easily fits the ~105MB Random Forest model without memory limits.

1. **Create Space**: On [huggingface.co/new-space](https://huggingface.co/new-space), set SDK to **Docker (Blank)** and hardware to **Free (16 GB RAM)**.
2. **Add Secret**: Under Space **Settings -> Variables and secrets -> Secrets**, add `WAQI_API_KEY`.
3. **Deploy via Git**:
   ```bash
   git remote add space https://huggingface.co/spaces/<username>/<space-name>
   git push space main
   ```
4. **Live API**: The REST endpoints (`/api/predict`, `/api/metrics`, `/api/live/<city>`) will be available at:
   `https://<username>-<space-name>.hf.space`

### Other Backend Options (Railway / Fly.io / Render)
- Point to root repository, set start command `gunicorn app:app --bind 0.0.0.0:$PORT --workers 1 --threads 4`.

### Frontend Dashboard (Vercel / Cloudflare / Netlify)
- Point to the `frontend/` directory.
- Set build command `npm run build`, output `.next`.
- In project environment variables, set:
  ```env
  NEXT_PUBLIC_API_URL=https://<username>-<space-name>.hf.space
  ```

## Environment Variables
- `PORT` — Flask port (defaults to 7860 on Hugging Face Spaces, 5000 locally).
- `WAQI_API_KEY` — World Air Quality Index token for live station benchmarking.
- `NEXT_PUBLIC_API_URL` — Backend API base URL for Next.js (defaults to `http://localhost:5000`).


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
- **Backend (Render / Railway / Fly.io)**: Point to root repository, set start command `gunicorn app:app`, expose port 5000.
- **Frontend (Vercel / Cloudflare / Netlify)**: Point to `frontend/` directory, set build command `npm run build`, output `.next`. Set `NEXT_PUBLIC_API_URL` to the backend URL.

## Environment Variables
- `PORT` — Flask port (defaults to 5000).
- `NEXT_PUBLIC_API_URL` — Backend API base URL for Next.js (defaults to `http://localhost:5000`).


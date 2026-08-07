# ============================================================
# Network Capital — single-container production image (Fly.io)
# Stage 1 builds the React frontend; Stage 2 runs FastAPI which
# serves both /api/* and the built SPA (SERVE_FRONTEND=true).
# ============================================================

# ---------- Stage 1: frontend build ----------
FROM node:20-alpine AS fe
WORKDIR /fe
COPY frontend/package.json frontend/yarn.lock ./
RUN yarn install --frozen-lockfile --network-timeout 600000
COPY frontend/ ./
# Empty => same-origin relative API calls (/api/...) — works on any domain
ARG REACT_APP_BACKEND_URL=""
ENV REACT_APP_BACKEND_URL=$REACT_APP_BACKEND_URL
ENV NODE_OPTIONS=--max-old-space-size=3072
ENV GENERATE_SOURCEMAP=false
RUN yarn build

# ---------- Stage 2: backend + static ----------
FROM python:3.11-slim
WORKDIR /app/backend
ENV PYTHONUNBUFFERED=1
RUN apt-get update && apt-get install -y --no-install-recommends curl && rm -rf /var/lib/apt/lists/*
COPY backend/requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt \
    --extra-index-url https://d33sy5i8bnduwe.cloudfront.net/simple/
COPY backend/ ./
COPY --from=fe /fe/build /app/frontend/build
# Config comes from Fly secrets (never bake .env — excluded via .dockerignore)
ENV SERVE_FRONTEND=true
EXPOSE 8080
CMD ["uvicorn", "server:app", "--host", "0.0.0.0", "--port", "8080"]

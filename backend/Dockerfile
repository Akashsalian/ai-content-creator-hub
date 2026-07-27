# ---- Base image ----
FROM python:3.11-slim

# ---- Working directory inside the container ----
WORKDIR /app

# ---- System deps needed for bcrypt / cryptography builds ----
RUN apt-get update && apt-get install -y --no-install-recommends \
    gcc \
    && rm -rf /var/lib/apt/lists/*

# ---- Install Python deps first (better layer caching) ----
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# ---- Copy the rest of the backend code (main.py, database.py, models.py, routes/) ----
COPY . .

# ---- Port FastAPI/uvicorn runs on ----
EXPOSE 8000

# ---- Env vars (GROQ_API_KEY, MONGO_URI, JWT_SECRET, etc.) are passed at ----
# ---- `docker run` time via --env-file, never baked into the image. ----
# ---- .dockerignore already excludes .env so it can't leak into the image. ----

# ---- Start the app (matches your real "if __name__ == '__main__': uvicorn.run(\"main:app\"...)") ----
# Note: reload=True is removed here — that's a dev-only flag and shouldn't run in production.
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]

# AI Content Creator Hub — Docker + AWS EC2 Deployment Guide
(Verified against your real uploaded project: final2/backend/)

## Where these files go
Your zip structure is:
```
final2/
  backend/     <- Dockerfile, .dockerignore, docker-compose.yml go HERE
    main.py
    database.py
    models.py
    requirements.txt
    routes/
  frontend/    <- stays on Netlify, unaffected
```
Copy the three files (Dockerfile, .dockerignore, docker-compose.yml) into
`final2/backend/` — the same folder as `requirements.txt` and `main.py`.

I verified against your actual code:
- `main.py` uses `app = FastAPI(...)` and the standard `uvicorn.run("main:app", ...)`
  pattern — so `CMD ["uvicorn", "main:app", ...]` in the Dockerfile is exactly correct,
  no changes needed.
- `requirements.txt` installs cleanly with no version conflicts (tested in an isolated
  virtual environment matching what Docker would do).
- `main.py`, `database.py`, `models.py`, and all four route files import successfully
  with no errors.
- Your `database.py` already defaults `MONGO_URI` to `mongodb://localhost:27017` if
  the env var is missing, and uses `tlsAllowInvalidCertificates=True` — this matches
  the Atlas SSL fix you resolved before, so no changes needed there either.
- I removed `reload=True` from the container's startup command — that flag is meant
  for local development (auto-restarts on file changes) and has no place in production.

---

## Part 1 — Test Docker locally (do this BEFORE touching AWS)

1. Confirm `Dockerfile`, `.dockerignore`, `docker-compose.yml` are inside `final2/backend/`.
2. Confirm your real `.env` (not `.env.example`) is also in `final2/backend/` with your
   actual GROQ_API_KEY, MONGO_URI, JWT_SECRET values.
3. From inside `final2/backend/`, build the image:
   ```bash
   docker build -t ai-content-hub .
   ```
4. Run it:
   ```bash
   docker run --env-file .env -p 8000:8000 ai-content-hub
   ```
5. Open `http://localhost:8000/docs` — you should see FastAPI's interactive docs
   listing your auth, generate, history, and favorites endpoints. Try the `/health`
   endpoint too — it should return `{"status": "ok"}`.

If Mongo Atlas is reachable and your `.env` values are correct, registration/login
should work exactly as it did locally without Docker.

---

## Part 2 — Push the image to Docker Hub

```bash
docker login
docker tag ai-content-hub yourdockerhubusername/ai-content-hub:latest
docker push yourdockerhubusername/ai-content-hub:latest
```

---

## Part 3 — Launch an AWS EC2 instance

1. AWS Console → EC2 → **Launch instance**
2. Name: `ai-content-hub-server`
3. AMI: **Ubuntu Server 22.04 LTS**
4. Instance type: **t3.micro**
5. Key pair: create new, download the `.pem` file
6. Security group inbound rules:
   - SSH (22) — Source: My IP
   - Custom TCP (8000) — Source: Anywhere (0.0.0.0/0)
7. Launch

---

## Part 4 — Set up Docker on EC2 and run your container

```bash
chmod 400 your-key.pem
ssh -i "your-key.pem" ubuntu@YOUR_EC2_PUBLIC_IP

sudo apt-get update
sudo apt-get install -y docker.io
sudo systemctl enable docker
sudo systemctl start docker
sudo usermod -aG docker ubuntu
exit
```
SSH back in, then:
```bash
docker pull yourdockerhubusername/ai-content-hub:latest

nano .env
# paste your real GROQ_API_KEY, MONGO_URI, JWT_SECRET, ACCESS_TOKEN_EXPIRE_MINUTES,
# FRONTEND_URL — save with Ctrl+O, Enter, Ctrl+X

docker run -d --env-file .env -p 8000:8000 --restart unless-stopped \
  yourdockerhubusername/ai-content-hub:latest
```

Test: `http://YOUR_EC2_PUBLIC_IP:8000/docs`

---

## Part 5 — Update your frontend

Your `frontend/script.js` currently points at your old Railway URL for API calls.
Find that base URL and replace it with `http://YOUR_EC2_PUBLIC_IP:8000`, then redeploy
to Netlify.

Also update `FRONTEND_URL` in your EC2 `.env` to your real Netlify URL (not `*`) once
this is working, since your CORS middleware currently allows all origins (`allow_origins=["*"]`)
— fine for testing, but worth tightening once it's stable.

---

## Part 6 — Protect yourself from surprise billing

1. AWS Console → Billing → **Budgets** → create alert at ~₹500/$5.
2. Once confirmed working and documented (screenshots for your resume/interview story),
   either monitor the credit balance actively, or **terminate the instance**
   (not just Stop) and move the permanent live link to Oracle Cloud Free Tier or Render.

---

## Talking points this gives you
- "Containerized the FastAPI backend with Docker for dev/prod environment consistency."
- "Deployed to AWS EC2, configured security groups, and set budget alerts to control spend."
- "Kept MongoDB Atlas decoupled from the compute layer so the app server can be rebuilt
  without losing data."

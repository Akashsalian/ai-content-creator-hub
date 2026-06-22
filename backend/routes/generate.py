from fastapi import APIRouter, HTTPException, Depends
from openai import OpenAI
from datetime import datetime
from dotenv import load_dotenv
import os

from models import GenerateRequest, GenerateResponse
from database import get_db
from routes.auth import get_current_user

load_dotenv()

router = APIRouter(prefix="/api", tags=["generate"])

# ── GROQ CLIENT (OpenAI-compatible) ───────────
groq_client = OpenAI(
    api_key=os.getenv("GROQ_API_KEY"),
    base_url="https://api.groq.com/openai/v1"
)

GROQ_MODEL = "llama-3.3-70b-versatile"

# ── PROMPT BUILDER ─────────────────────────────
def build_prompt(req: GenerateRequest) -> str:
    length_map = {
        1: "short and concise (under 80 words)",
        2: "medium length (150-220 words)",
        3: "long and detailed (300+ words)"
    }
    length = length_map.get(req.length, "medium length")

    prompts = {
        "title": (
            f"Generate 5 highly engaging {req.platform} titles about \"{req.topic}\". "
            f"Tone: {req.tone}. Output in {req.language}. "
            f"Number them 1-5. Make them click-worthy and optimized for the platform."
        ),
        "script": (
            f"Write a {length} {req.platform} video script about \"{req.topic}\". "
            f"Tone: {req.tone}. Output in {req.language}. "
            f"Structure it with clearly labeled sections: [HOOK], [MAIN CONTENT], [CALL TO ACTION]."
        ),
        "hashtag": (
            f"Generate 25 relevant hashtags for a {req.platform} post about \"{req.topic}\". "
            f"Tone: {req.tone}. Output in {req.language}. "
            f"Group them into 3 categories: #Niche (5 tags), #Trending (10 tags), #Broad (10 tags). "
            f"Use real hashtag format with # symbol."
        )
    }

    return prompts.get(req.type, f"Generate {req.type} content about \"{req.topic}\" for {req.platform}. Tone: {req.tone}. Language: {req.language}.")

# ── GENERATE ENDPOINT ──────────────────────────
@router.post("/generate", response_model=GenerateResponse)
async def generate(
    req: GenerateRequest,
    current_user=Depends(get_current_user)
):
    if not req.topic.strip():
        raise HTTPException(status_code=400, detail="Topic cannot be empty")

    if req.type not in ["title", "script", "hashtag"]:
        raise HTTPException(status_code=400, detail="Invalid content type")

    prompt = build_prompt(req)

    try:
        response = groq_client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are an expert social media content creator. "
                        "Generate high-quality, engaging content exactly as requested. "
                        "Be creative, platform-aware, and tone-appropriate. "
                        "Return only the content — no preamble, no 'Sure!', no extra commentary."
                    )
                },
                {
                    "role": "user",
                    "content": prompt
                }
            ],
            max_tokens=1024,
            temperature=0.8
        )

        result = response.choices[0].message.content.strip()

    except Exception as e:
        error_msg = str(e)
        if "rate_limit" in error_msg.lower():
            raise HTTPException(status_code=503, detail="AI service busy. Please try again in a moment.")
        if "api_key" in error_msg.lower() or "authentication" in error_msg.lower():
            raise HTTPException(status_code=500, detail="API key error. Check your GROQ_API_KEY in .env")
        raise HTTPException(status_code=500, detail=f"AI generation failed: {error_msg}")

    # Save to history automatically
    db = get_db()
    await db.history.insert_one({
        "user_id":    str(current_user["_id"]),
        "username":   current_user["username"],
        "topic":      req.topic,
        "type":       req.type,
        "result":     result,
        "platform":   req.platform,
        "tone":       req.tone,
        "language":   req.language,
        "created_at": datetime.utcnow()
    })

    return {"result": result}

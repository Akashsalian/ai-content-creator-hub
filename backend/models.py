from pydantic import BaseModel, EmailStr, Field
from typing import Optional
from datetime import datetime

# ── AUTH ──────────────────────────────────────
class UserRegister(BaseModel):
    username: str
    email:    EmailStr
    password: str

class UserLogin(BaseModel):
    username: str
    password: str

class Token(BaseModel):
    access_token: str
    token_type:   str = "bearer"

# ── GENERATE ──────────────────────────────────
class GenerateRequest(BaseModel):
    type:     str                    # title | script | hashtag
    topic:    str
    platform: str  = "YouTube"
    tone:     str  = "Professional"
    language: str  = "English"
    length:   int  = 2              # 1=short 2=medium 3=long

class GenerateResponse(BaseModel):
    result: str

# ── HISTORY ───────────────────────────────────
class HistoryItem(BaseModel):
    topic:    str
    type:     str
    result:   str
    platform: Optional[str] = ""
    tone:     Optional[str] = ""

# ── FAVORITES ─────────────────────────────────
class FavoriteItem(BaseModel):
    topic:    str
    type:     str
    result:   str
    platform: Optional[str] = ""
    tone:     Optional[str] = ""

from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import OAuth2PasswordBearer, OAuth2PasswordRequestForm
from jose import JWTError, jwt
from passlib.context import CryptContext
from datetime import datetime, timedelta
from dotenv import load_dotenv
import os

from database import get_db
from models import UserRegister, Token

load_dotenv()

router = APIRouter(prefix="/api/auth", tags=["auth"])

JWT_SECRET  = os.getenv("JWT_SECRET", "fallback_secret")
ALGORITHM   = "HS256"
EXPIRE_MINS = int(os.getenv("ACCESS_TOKEN_EXPIRE_MINUTES", 1440))

pwd_ctx = CryptContext(
    schemes=["bcrypt"],
    deprecated="auto",
    bcrypt__rounds=12
)
oauth2 = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# ── PASSWORD HELPERS ───────────────────────────
def hash_password(pw: str) -> str:
    pw_bytes = pw.encode("utf-8")[:72]
    return pwd_ctx.hash(pw_bytes.decode("utf-8", errors="ignore"))

def verify_password(plain: str, hashed: str) -> bool:
    pw_bytes = plain.encode("utf-8")[:72]
    return pwd_ctx.verify(pw_bytes.decode("utf-8", errors="ignore"), hashed)

def create_token(data: dict) -> str:
    payload = data.copy()
    payload["exp"] = datetime.utcnow() + timedelta(minutes=EXPIRE_MINS)
    return jwt.encode(payload, JWT_SECRET, algorithm=ALGORITHM)

# ── GET CURRENT USER ───────────────────────────
async def get_current_user(token: str = Depends(oauth2)):
    db = get_db()
    try:
        payload  = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        username = payload.get("sub")
        if not username:
            raise HTTPException(status_code=401, detail="Invalid token")
    except JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = await db.users.find_one({"username": username})
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    return user

# ── REGISTER ───────────────────────────────────
@router.post("/register")
async def register(body: UserRegister):
    try:
        db = get_db()

        # Check username
        existing_user = await db.users.find_one({"username": body.username})
        if existing_user:
            raise HTTPException(status_code=400, detail="Username already taken")

        # Check email
        existing_email = await db.users.find_one({"email": body.email})
        if existing_email:
            raise HTTPException(status_code=400, detail="Email already registered")

        # Validate password length
        if len(body.password) < 4:
            raise HTTPException(status_code=400, detail="Password must be at least 4 characters")

        # Create user
        await db.users.insert_one({
            "username":   body.username,
            "email":      body.email,
            "password":   hash_password(body.password),
            "created_at": datetime.utcnow()
        })

        return {"message": "Account created successfully"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Registration failed: {str(e)}")

# ── LOGIN ──────────────────────────────────────
@router.post("/login", response_model=Token)
async def login(form: OAuth2PasswordRequestForm = Depends()):
    try:
        db   = get_db()
        user = await db.users.find_one({"username": form.username})

        if not user or not verify_password(form.password, user["password"]):
            raise HTTPException(status_code=401, detail="Incorrect username or password")

        token = create_token({"sub": user["username"]})
        return {"access_token": token, "token_type": "bearer"}

    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Login failed: {str(e)}")

# ── ME ─────────────────────────────────────────
@router.get("/me")
async def me(current_user=Depends(get_current_user)):
    return {
        "username": current_user["username"],
        "email":    current_user["email"]
    }
from fastapi import APIRouter, HTTPException, Depends
from bson import ObjectId
from datetime import datetime

from database import get_db
from models import FavoriteItem
from routes.auth import get_current_user

router = APIRouter(prefix="/api/favorites", tags=["favorites"])

def serialize(item):
    item["_id"] = str(item["_id"])
    if "created_at" in item and isinstance(item["created_at"], datetime):
        item["created_at"] = item["created_at"].isoformat()
    return item

# ── GET ALL FAVORITES ──────────────────────────
@router.get("")
async def get_favorites(current_user=Depends(get_current_user)):
    db     = get_db()
    cursor = db.favorites.find({"user_id": str(current_user["_id"])}).sort("created_at", -1)
    items  = []
    async for item in cursor:
        items.append(serialize(item))
    return items

# ── GET SINGLE FAVORITE ────────────────────────
@router.get("/{item_id}")
async def get_favorite(item_id: str, current_user=Depends(get_current_user)):
    db   = get_db()
    item = await db.favorites.find_one({"_id": ObjectId(item_id), "user_id": str(current_user["_id"])})
    if not item:
        raise HTTPException(status_code=404, detail="Favorite not found")
    return serialize(item)

# ── ADD FAVORITE ───────────────────────────────
@router.post("")
async def add_favorite(body: FavoriteItem, current_user=Depends(get_current_user)):
    db = get_db()

    # Prevent duplicates
    existing = await db.favorites.find_one({
        "user_id": str(current_user["_id"]),
        "result":  body.result
    })
    if existing:
        raise HTTPException(status_code=400, detail="Already in favorites")

    await db.favorites.insert_one({
        "user_id":    str(current_user["_id"]),
        "username":   current_user["username"],
        "topic":      body.topic,
        "type":       body.type,
        "result":     body.result,
        "platform":   body.platform,
        "tone":       body.tone,
        "created_at": datetime.utcnow()
    })
    return {"message": "Added to favorites"}

# ── REMOVE FAVORITE ────────────────────────────
@router.delete("/{item_id}")
async def remove_favorite(item_id: str, current_user=Depends(get_current_user)):
    db     = get_db()
    result = await db.favorites.delete_one({"_id": ObjectId(item_id), "user_id": str(current_user["_id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Favorite not found")
    return {"message": "Removed from favorites"}

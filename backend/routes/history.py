from fastapi import APIRouter, HTTPException, Depends, Query
from bson import ObjectId
from datetime import datetime

from database import get_db
from routes.auth import get_current_user

router = APIRouter(prefix="/api/history", tags=["history"])

def serialize(item):
    item["_id"] = str(item["_id"])
    if "created_at" in item and isinstance(item["created_at"], datetime):
        item["created_at"] = item["created_at"].isoformat()
    return item

# ── GET ALL HISTORY ────────────────────────────
@router.get("")
async def get_history(
    search:      str = Query(""),
    type_filter: str = Query(""),
    current_user=Depends(get_current_user)
):
    db    = get_db()
    query = {"user_id": str(current_user["_id"])}

    if type_filter:
        query["type"] = type_filter

    cursor = db.history.find(query).sort("created_at", -1).limit(50)
    items  = []
    async for item in cursor:
        item = serialize(item)
        if search:
            combined = (item.get("topic","") + item.get("result","")).lower()
            if search.lower() not in combined:
                continue
        items.append(item)

    return items

# ── GET SINGLE ITEM ────────────────────────────
@router.get("/{item_id}")
async def get_history_item(item_id: str, current_user=Depends(get_current_user)):
    db   = get_db()
    item = await db.history.find_one({"_id": ObjectId(item_id), "user_id": str(current_user["_id"])})
    if not item:
        raise HTTPException(status_code=404, detail="Item not found")
    return serialize(item)

# ── DELETE SINGLE ITEM ─────────────────────────
@router.delete("/{item_id}")
async def delete_history_item(item_id: str, current_user=Depends(get_current_user)):
    db     = get_db()
    result = await db.history.delete_one({"_id": ObjectId(item_id), "user_id": str(current_user["_id"])})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Item not found")
    return {"message": "Deleted"}

# ── DELETE ALL HISTORY ─────────────────────────
@router.delete("")
async def clear_history(current_user=Depends(get_current_user)):
    db = get_db()
    await db.history.delete_many({"user_id": str(current_user["_id"])})
    return {"message": "History cleared"}

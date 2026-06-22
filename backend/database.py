from motor.motor_asyncio import AsyncIOMotorClient
from dotenv import load_dotenv
import os

load_dotenv()

MONGO_URI = os.getenv("MONGO_URI", "mongodb://localhost:27017")

client = None
db     = None

async def connect_db():
    global client, db
    client = AsyncIOMotorClient(MONGO_URI, tlsAllowInvalidCertificates=True)
    db     = client["ai_creator_hub"]
    print("✅ Connected to MongoDB")

async def close_db():
    if client:
        client.close()
        print("🔌 MongoDB connection closed")

def get_db():
    return db

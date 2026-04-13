import os
from pymongo import MongoClient
from dotenv import load_dotenv

load_dotenv()

_MONGO_URI = os.getenv("MONGO_URI", "")
_DB_NAME = "SeatNow"  # Based on URI

_client = None

def get_mongo_db():
    """Return the MongoDB database instance."""
    global _client
    if not _client:
        _client = MongoClient(_MONGO_URI)
    return _client[_DB_NAME]

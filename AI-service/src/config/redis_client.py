import os
import json
import redis as _redis
from dotenv import load_dotenv

load_dotenv()

REDIS_URL = os.getenv("REDIS_URL", "redis://localhost:6379")
CHAT_HISTORY_TTL = int(os.getenv("CHAT_HISTORY_TTL_SEC", 604800))  # 7 days

_client: _redis.Redis = _redis.Redis.from_url(REDIS_URL, decode_responses=True)


def get_client() -> _redis.Redis:
    return _client


# ─────────────────────── Chat history helpers ───────────────────────

def load_history(session_key: str) -> list[dict]:
    """Load chat history for a session. Returns list of {role, content} dicts."""
    raw = _client.get(session_key)
    if not raw:
        return []
    try:
        return json.loads(raw)
    except Exception:
        return []


def save_history(session_key: str, messages: list[dict]) -> None:
    """Persist chat history to Redis with TTL of 7 days."""
    _client.set(session_key, json.dumps(messages, ensure_ascii=False), ex=CHAT_HISTORY_TTL)


def append_message(session_key: str, role: str, content: str) -> list[dict]:
    """Append a single message to history and re-save. Returns updated history."""
    history = load_history(session_key)
    history.append({"role": role, "parts": [content]})
    save_history(session_key, history)
    return history


def clear_history(session_key: str) -> None:
    """Delete chat history for a session."""
    _client.delete(session_key)


# ─────────────────────── Generic caching helpers ───────────────────────

def get_cache(key: str) -> any:
    """Get JSON-parsed data from Redis cache."""
    raw = _client.get(key)
    if not raw:
        return None
    try:
        return json.loads(raw)
    except Exception:
        return None


def set_cache(key: str, data: any, ttl_sec: int) -> None:
    """Save data as JSON to Redis cache with TTL."""
    _client.set(key, json.dumps(data, ensure_ascii=False, default=str), ex=ttl_sec)


def delete_cache(key: str) -> None:
    """Delete a specific cache key."""
    _client.delete(key)

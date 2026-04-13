from pydantic import BaseModel
from typing import Optional


# ─────────────────────── Customer endpoints ───────────────────────

class ChatRequest(BaseModel):
    message: str
    sessionId: Optional[str] = None
    restaurantId: Optional[str] = None
    lang: Optional[str] = "en"


class RevenueSummaryRequest(BaseModel):
    restaurantId: Optional[str] = None
    lang: Optional[str] = "en"


class PublicRecommendRequest(BaseModel):
    message: str
    lang: Optional[str] = "en"


class ChatResponse(BaseModel):
    reply: str
    session_key: str


class RecommendResponse(BaseModel):
    recommendations: str


# ─────────────────────── Admin endpoints ───────────────────────

class AdminRevenueSummaryResponse(BaseModel):
    summary: str


class AdminChatResponse(BaseModel):
    reply: str
    session_key: str

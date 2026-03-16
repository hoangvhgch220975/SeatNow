from pydantic import BaseModel
from typing import Optional


# ─────────────────────── Customer endpoints ───────────────────────

class ChatRequest(BaseModel):
    message: str


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

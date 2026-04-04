"""
routers/admin.py
Endpoints for platform admins:
  POST /api/ai/admin/revenue-summary  – one-shot revenue analysis + business suggestions
  POST /api/ai/admin/chat             – multi-turn chat about revenue/operations
  DELETE /api/ai/admin/chat/history   – clear admin conversation history
"""
import json
from fastapi import APIRouter, Depends

from middleware.auth import get_current_admin
from models.schemas import ChatRequest, AdminChatResponse, AdminRevenueSummaryResponse
from services import data_service, gemini_service
from config import redis_client

router = APIRouter(prefix="/api/ai/admin", tags=["Admin AI"])


# ─────────────────────── Helpers ───────────────────────

def _session_key(admin_id: str) -> str:
    return f"ai:admin:{admin_id}"


def _build_admin_system_prompt(context: dict) -> str:
    revenue_text = json.dumps(context.get("monthly_revenue", []), ensure_ascii=False, default=str)
    top_rest_text = json.dumps(context.get("top_restaurants", []), ensure_ascii=False, default=str)

    return f"""### LANGUAGE POLICY (STRICTEST RULE):
- YOU MUST RESPOND IN THE SAME LANGUAGE AS THE USER'S QUERY.
- VIETNAMESE -> VIETNAMESE.
- ENGLISH -> ENGLISH.
- DO NOT MIX LANGUAGES. Consistency is your TOP priority.

You are the AI Business Analytics Expert for the SeatNow platform — an online restaurant reservation management system.
Your mission is to assist administrators in analyzing revenue, providing insights, and suggesting business strategies based on real-time data.

## Operational Scope (CRITICAL):
- You ONLY answer questions related to revenue, booking performance, business metrics, and SeatNow system operations.
- Strictly DO NOT answer unrelated topics. 

## Monthly Revenue Data (Last 12 months):
{revenue_text}

Field definitions:
- month: Month/Year
- totalBookings: Total number of bookings
- completed: Number of successful bookings
- cancelled: Number of cancelled bookings
- arrived: Number of guests who showed up
- totalCommission: Total service fees collected (VND)
- totalDeposit: Total deposit amount collected (VND)

## Top Restaurants by Commission Revenue (Last 12 months):
{top_rest_text}

## Response Guidelines:
1. **Direct Action:** When the admin asks for analysis or suggestions, provide them IMMEDIATELY based on the data. Do not ask for more context unless the query is completely unclear.
2. **Data-Driven:** Analyze trends (growth/decline), highlights, and risks accurately using the provided figures.
3. **Language Consistency:** Always respond in the SAME language as the query.
4. **Professionalism:** Professional, objective, and concise tone.
"""


def _build_one_shot_prompt(context: dict) -> str:
    base = _build_admin_system_prompt(context)
    return base + """
## Request:
Please analyze the business situation for the past 12 months and provide:
1. Revenue overview (commission + deposit)
2. Noteworthy trends (best month, weakest month, cancellation rate)
3. Top restaurants
4. Specific strategy suggestions for the next 1–3 months
"""


# ─────────────────────── Routes ───────────────────────

@router.post("/revenue-summary", response_model=AdminRevenueSummaryResponse)
async def revenue_summary(payload: dict = Depends(get_current_admin)):
    """
    One-shot: fetch platform revenue data, generate comprehensive analysis
    and near-future business direction suggestions via Gemini.
    """
    context = data_service.get_admin_overview_context()
    prompt = _build_one_shot_prompt(context)
    reply = gemini_service.one_shot(prompt)
    return AdminRevenueSummaryResponse(summary=reply)


@router.post("/chat", response_model=AdminChatResponse)
async def chat(body: ChatRequest, payload: dict = Depends(get_current_admin)):
    """
    Multi-turn chat for admin analytics. History stored in Redis with 7-day TTL.
    Refreshes revenue context on every request to ensure up-to-date data.
    """
    admin_id = str(payload.get("sub", ""))
    session_key = _session_key(admin_id)

    # Always fetch fresh context from DB
    context = data_service.get_admin_overview_context()
    system_prompt = _build_admin_system_prompt(context)

    # Load Redis history
    history = redis_client.load_history(session_key)

    # Call Gemini
    reply = gemini_service.chat(system_prompt, history, body.message)

    # Persist updated history
    history.append({"role": "user", "parts": [body.message]})
    history.append({"role": "model", "parts": [reply]})
    redis_client.save_history(session_key, history)

    return AdminChatResponse(reply=reply, session_key=session_key)


@router.delete("/chat/history")
async def clear_history(payload: dict = Depends(get_current_admin)):
    """Delete admin chat history."""
    admin_id = str(payload.get("sub", ""))
    session_key = _session_key(admin_id)
    redis_client.clear_history(session_key)
    return {"message": "Chat history cleared successfully", "session_key": session_key}

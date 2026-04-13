"""
routers/admin.py
Endpoints for platform admins:
  POST /api/ai/admin/revenue-summary  – one-shot revenue analysis + business suggestions
  POST /api/ai/admin/chat             – multi-turn chat about revenue/operations
  DELETE /api/ai/admin/chat/history   – clear admin conversation history
"""
import json
from typing import Optional
from fastapi import APIRouter, Depends

from middleware.auth import get_current_admin
from models.schemas import ChatRequest, AdminChatResponse, AdminRevenueSummaryResponse, RevenueSummaryRequest
from services import data_service, gemini_service
from config import redis_client

router = APIRouter(prefix="/api/ai/admin", tags=["Admin AI"])


# ─────────────────────── Helpers ───────────────────────

def _session_key(admin_id: str, sessionId: str = None) -> str:
    base = f"ai:admin:{admin_id}"
    if sessionId:
        base += f":sess:{sessionId}"
    return base


def _build_admin_system_prompt(context: dict, lang: str = "en") -> str:
    revenue_text = json.dumps(context.get("monthly_revenue", []), ensure_ascii=False, default=str)
    top_rest_text = json.dumps(context.get("top_restaurants", []), ensure_ascii=False, default=str)
    
    lang_name = "English" if lang == "en" else "Vietnamese"

    return f"""### CRITICAL: TARGET LANGUAGE IS {lang_name.upper()}.
- You MUST respond ONLY in {lang_name}.
- DO NOT use any other language.
- This is the MOST important rule.

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
3. **Language Consistency:** Always respond in THE SAME language as the query.
4. **Professionalism:** Professional, objective, and concise tone.
"""


def _build_one_shot_prompt(context: dict, lang: str = "en") -> str:
    base = _build_admin_system_prompt(context, lang=lang)
    if lang == "vi":
        return base + """
## Yêu cầu:
Vui lòng cung cấp một bản phân tích tình hình kinh doanh toàn diện cho 12 tháng qua, bao gồm:
1. Tổng quan về doanh thu và lượng đặt bàn trên toàn sàn.
2. Các xu hướng hiệu suất chính và những điểm nổi bật đáng lưu ý.
3. Các gợi ý chiến lược cụ thể để tăng doanh thu phí hoa hồng và cải thiện hiệu quả hệ thống trong tương lai.
"""
    else:
        return base + """
## Request:
Please provide a comprehensive business analysis for the past 12 months, including:
1. Revenue & booking overview across the entire platform.
2. Key performance trends and noteworthy highlights.
3. Specific strategic suggestions to increase commission revenue and improve system efficiency in the future.
"""


# ─────────────────────── Routes ───────────────────────

@router.post("/revenue-summary", response_model=AdminRevenueSummaryResponse)
async def revenue_summary(body: Optional[RevenueSummaryRequest] = None, payload: dict = Depends(get_current_admin)):
    """
    One-shot: fetch platform revenue data, generate comprehensive analysis.
    """
    lang = body.lang if body and body.lang else "en"
    
    context = data_service.get_admin_overview_context()
    prompt = _build_one_shot_prompt(context, lang=lang)
    
    reply = gemini_service.one_shot(prompt)
    return AdminRevenueSummaryResponse(summary=reply)


@router.post("/chat", response_model=AdminChatResponse)
async def chat(body: ChatRequest, payload: dict = Depends(get_current_admin)):
    """
    Multi-turn chat for admin analytics. 
    """
    admin_id = str(payload.get("sub", ""))
    session_key = _session_key(admin_id, body.sessionId)
    lang = body.lang or "en"

    # Always fetch fresh context from DB
    context = data_service.get_admin_overview_context()
    system_prompt = _build_admin_system_prompt(context, lang=lang)

    # Load Redis history
    history = redis_client.load_history(session_key)

    # Call Gemini
    reply = gemini_service.chat(system_prompt, history, body.message)

    # Persist updated history
    history.append({"role": "user", "parts": [body.message]})
    history.append({"role": "model", "parts": [reply]})
    redis_client.save_history(session_key, history)

    return AdminChatResponse(reply=reply, session_key=session_key)


@router.get("/chat/history")
async def get_history(sessionId: Optional[str] = None, payload: dict = Depends(get_current_admin)):
    """Fetch admin chat history from Redis."""
    admin_id = str(payload.get("sub", ""))
    session_key = _session_key(admin_id, sessionId)
    history = redis_client.load_history(session_key)
    return {"history": history, "session_key": session_key}


@router.delete("/chat/history")
async def clear_history(sessionId: Optional[str] = None, payload: dict = Depends(get_current_admin)):
    """Delete admin chat history."""
    admin_id = str(payload.get("sub", ""))
    session_key = _session_key(admin_id, sessionId)
    redis_client.clear_history(session_key)
    return {"message": "Admin chat history cleared successfully", "session_key": session_key}

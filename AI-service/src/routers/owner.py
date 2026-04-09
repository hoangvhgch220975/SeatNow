"""
routers/owner.py
Endpoints for restaurant owners:
  POST /api/ai/owner/revenue-summary  – Analyze revenue and provide business suggestions for the Owner
  POST /api/ai/owner/chat             – Multi-turn conversation for Owner's restaurants
  DELETE /api/ai/owner/chat/history   – Clear Owner's chat history
"""
import json
from fastapi import APIRouter, Depends

from middleware.auth import get_current_owner
from models.schemas import ChatRequest, ChatResponse, AdminRevenueSummaryResponse
from services import data_service, gemini_service
from config import redis_client

router = APIRouter(prefix="/api/ai/owner", tags=["Owner AI"])


# ─────────────────────── Helpers ───────────────────────

def _session_key(owner_id: str) -> str:
    return f"ai:owner:{owner_id}"


def _build_owner_system_prompt(context: dict) -> str:
    revenue_text = json.dumps(context.get("monthly_revenue", []), ensure_ascii=False, default=str)
    restaurants_text = json.dumps(context.get("my_restaurants", []), ensure_ascii=False, default=str)

    return f"""### LANGUAGE POLICY (STRICTEST RULE):
- YOU MUST RESPOND IN THE SAME LANGUAGE AS THE USER'S QUERY.
- VIETNAMESE -> VIETNAMESE.
- ENGLISH -> ENGLISH.
- DO NOT MIX LANGUAGES. Consistency is your TOP priority.

You are the SeatNow Business Advisor — an AI business expert specialized in the F&B industry. 
Your mission is to provide professional advice, analysis, and strategic suggestions to restaurant owners based on their actual performance data on the SeatNow platform.

## Operational Scope (CRITICAL):
- You ONLY answer questions related to the owner's specific restaurants, their revenue trends, booking statistics, customer preferences, and business growth strategies.
- Strictly DO NOT answer unrelated topics.

## Owner's Portfolio (Your context):
### Restaurants:
{restaurants_text}

### Monthly Performance (Combined data for all your restaurants):
{revenue_text}

## Response Guidelines:
1. **Actionable Insights:** Identify strengths, weaknesses, and growth opportunities (e.g., specific busy months, high-performing cuisines).
2. **Professional Tone:** Maintain a professional, encouraging, and data-driven tone. Be concise.
3. **Internal Labels:** Keep technical labels like 'totalCommission', 'totalDeposit', 'cancelled' as English in your conceptual analysis, but translate to the user's language in the response.
4. **Language Consistency:** Always respond in the SAME language as the query.
"""


def _build_one_shot_prompt(context: dict) -> str:
    base = _build_owner_system_prompt(context)
    return base + """
## Request:
Please provide a comprehensive business analysis for the past 12 months, including:
1. Revenue & booking overview across my properties.
2. Key performance trends and noteworthy highlights.
3. Specific actionable suggestions to increase revenue and improve service quality in the coming months.
"""


# ─────────────────────── Routes ───────────────────────

@router.post("/revenue-summary", response_model=AdminRevenueSummaryResponse)
async def revenue_summary(payload: dict = Depends(get_current_owner)):
    """
    One-shot: Lấy dữ liệu của Owner và tạo bản phân tích tình hình kinh doanh tổng thể.
    """
    owner_id = str(payload.get("sub", ""))
    context = data_service.get_owner_overview_context(owner_id)
    prompt = _build_one_shot_prompt(context)
    reply = gemini_service.one_shot(prompt)
    return AdminRevenueSummaryResponse(summary=reply)


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, payload: dict = Depends(get_current_owner)):
    """
    Trò chuyện tư vấn đa lượt dành riêng cho Chủ nhà hàng.
    Lịch sử chat lưu trong Redis với TTL 7 ngày.
    """
    owner_id = str(payload.get("sub", ""))
    session_key = _session_key(owner_id)

    # Luôn lấy ngữ cảnh mới nhất từ DB
    context = data_service.get_owner_overview_context(owner_id)
    system_prompt = _build_owner_system_prompt(context)

    # Tải lịch sử từ Redis
    history = redis_client.load_history(session_key)

    # Gọi Gemini
    reply = gemini_service.chat(system_prompt, history, body.message)

    # Lưu lại lịch sử
    history.append({"role": "user", "parts": [body.message]})
    history.append({"role": "model", "parts": [reply]})
    redis_client.save_history(session_key, history)

    return ChatResponse(reply=reply, session_key=session_key)


@router.delete("/chat/history")
async def clear_history(payload: dict = Depends(get_current_owner)):
    """Xóa lịch sử trò chuyện của Owner."""
    owner_id = str(payload.get("sub", ""))
    session_key = _session_key(owner_id)
    redis_client.clear_history(session_key)
    return {"message": "Owner chat history cleared successfully", "session_key": session_key}

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

    return f"""Bạn là chuyên gia phân tích kinh doanh AI của nền tảng SeatNow — nền tảng quản lý đặt bàn nhà hàng trực tuyến.
Nhiệm vụ của bạn là hỗ trợ admin phân tích doanh thu, đưa ra insight và gợi ý chiến lược kinh doanh.

## Dữ liệu doanh thu theo tháng (12 tháng gần nhất):
{revenue_text}

Giải thích các trường:
- month: Tháng/năm
- totalBookings: Tổng số booking
- completed: Số booking hoàn thành
- cancelled: Số booking hủy
- arrived: Số khách đã đến
- totalCommission: Tổng phí dịch vụ (commission) thu được (VND)
- totalDeposit: Tổng tiền đặt cọc thu được (VND)

## Top nhà hàng theo doanh thu commission (12 tháng gần nhất):
{top_rest_text}

## Hướng dẫn:
- Trả lời bằng tiếng Việt, chuyên nghiệp và súc tích.
- Phân tích xu hướng tăng/giảm, mùa cao điểm/thấp điểm.
- Gợi ý hướng phát triển cụ thể cho tương lai gần (1–3 tháng tới).
- Đề xuất chiến lược tăng trưởng: mở rộng nhà hàng đối tác, cải thiện tỷ lệ hoàn thành, v.v.
- Khi admin hỏi số liệu cụ thể, hãy trích dẫn từ dữ liệu đã cung cấp.
"""


def _build_one_shot_prompt(context: dict) -> str:
    base = _build_admin_system_prompt(context)
    return base + """
## Yêu cầu:
Hãy tổng hợp toàn bộ tình hình kinh doanh 12 tháng qua và đưa ra:
1. Tổng quan doanh thu (commission + đặt cọc)
2. Xu hướng đáng chú ý (tháng tốt nhất, tháng yếu nhất, tỷ lệ hủy)
3. Top nhà hàng nổi bật
4. Gợi ý chiến lược cụ thể cho 1–3 tháng tới
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
    return {"message": "Lịch sử trò chuyện admin đã được xóa", "session_key": session_key}

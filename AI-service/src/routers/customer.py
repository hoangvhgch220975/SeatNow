"""
routers/customer.py
Endpoints for logged-in customers:
  POST /api/ai/customer/recommend      – one-shot restaurant recommendation
  POST /api/ai/customer/chat           – multi-turn chat (history stored in Redis)
  DELETE /api/ai/customer/chat/history – clear conversation history
"""
import json
from fastapi import APIRouter, Depends, Request

from middleware.auth import get_current_customer
from models.schemas import ChatRequest, ChatResponse, RecommendResponse
from services import data_service, gemini_service
from config import redis_client

router = APIRouter(prefix="/api/ai/customer", tags=["Customer AI"])


# ─────────────────────── Helpers ───────────────────────

def _session_key(customer_id: str) -> str:
    return f"ai:customer:{customer_id}"


def _build_system_prompt(booking_history: list[dict], restaurants: list[dict]) -> str:
    history_text = json.dumps(booking_history, ensure_ascii=False, default=str)
    restaurants_text = json.dumps(restaurants, ensure_ascii=False, default=str)

    return f"""Bạn là trợ lý AI của nền tảng đặt bàn nhà hàng SeatNow.
Nhiệm vụ của bạn là gợi ý nhà hàng phù hợp cho khách hàng dựa trên lịch sử đặt bàn của họ.

## Lịch sử đặt bàn của khách hàng (gần nhất):
{history_text}

## Danh sách nhà hàng đang hoạt động trên SeatNow:
{restaurants_text}

## Hướng dẫn:
- Trả lời bằng tiếng Việt, thân thiện và ngắn gọn.
- Dựa vào lịch sử đặt bàn để hiểu sở thích (loại ẩm thực, mức giá, số khách).
- Gợi ý 3–5 nhà hàng phù hợp từ danh sách trên, kèm lý do ngắn gọn.
- Nếu khách chưa có lịch sử, gợi ý nhà hàng phổ biến nhất.
- Không bịa đặt nhà hàng ngoài danh sách đã cho.
"""


# ─────────────────────── Routes ───────────────────────

@router.post("/recommend", response_model=RecommendResponse)
async def recommend(payload: dict = Depends(get_current_customer)):
    """
    One-shot recommendation: fetches customer history + active restaurants,
    asks Gemini to suggest suitable places. No conversation history stored.
    """
    customer_id = str(payload.get("sub", ""))

    booking_history = data_service.get_customer_booking_history(customer_id)
    restaurants = data_service.get_active_restaurants()

    prompt = _build_system_prompt(booking_history, restaurants) + \
        "\n\nHãy gợi ý cho tôi một số nhà hàng phù hợp với sở thích của tôi."

    reply = gemini_service.one_shot(prompt)
    return RecommendResponse(recommendations=reply)


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, payload: dict = Depends(get_current_customer)):
    """
    Multi-turn chat: loads history from Redis, sends to Gemini with system context,
    appends both user message and model reply to Redis (TTL 7 days).
    """
    customer_id = str(payload.get("sub", ""))
    session_key = _session_key(customer_id)

    # Load context from DB
    booking_history = data_service.get_customer_booking_history(customer_id)
    restaurants = data_service.get_active_restaurants()
    system_prompt = _build_system_prompt(booking_history, restaurants)

    # Load existing chat history
    history = redis_client.load_history(session_key)

    # Call Gemini with history
    reply = gemini_service.chat(system_prompt, history, body.message)

    # Persist updated history (user turn + model turn)
    history.append({"role": "user", "parts": [body.message]})
    history.append({"role": "model", "parts": [reply]})
    redis_client.save_history(session_key, history)

    return ChatResponse(reply=reply, session_key=session_key)


@router.delete("/chat/history")
async def clear_history(payload: dict = Depends(get_current_customer)):
    """Delete all chat history for this customer."""
    customer_id = str(payload.get("sub", ""))
    session_key = _session_key(customer_id)
    redis_client.clear_history(session_key)
    return {"message": "Lịch sử trò chuyện đã được xóa", "session_key": session_key}

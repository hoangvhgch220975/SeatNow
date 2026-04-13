"""
routers/customer.py
Endpoints for logged-in customers:
  POST /api/ai/customer/recommend      – one-shot restaurant recommendation
  POST /api/ai/customer/chat           – multi-turn chat (history stored in Redis)
  DELETE /api/ai/customer/chat/history – clear conversation history
"""
import json
from typing import Optional
from fastapi import APIRouter, Depends, Request

from middleware.auth import get_current_customer
from models.schemas import ChatRequest, ChatResponse, RecommendResponse, RevenueSummaryRequest
from services import data_service, gemini_service
from config import redis_client

router = APIRouter(prefix="/api/ai/customer", tags=["Customer AI"])


# ─────────────────────── Helpers ───────────────────────

def _session_key(customer_id: str, sessionId: str = None) -> str:
    base = f"ai:customer:{customer_id}"
    if sessionId:
        base += f":sess:{sessionId}"
    return base


def _build_system_prompt(booking_history: list[dict], restaurants: list[dict], search_results: list[dict] = None, lang: str = "en") -> str:
    history_text = json.dumps(booking_history, ensure_ascii=False, default=str)
    restaurants_text = json.dumps(restaurants, ensure_ascii=False, default=str)
    search_text = json.dumps(search_results or [], ensure_ascii=False, default=str)
    
    lang_name = "English" if lang == "en" else "Vietnamese"

    return f"""### CRITICAL: TARGET LANGUAGE IS {lang_name.upper()}.
- You MUST respond ONLY in {lang_name}.
- DO NOT use any other language.
- This is the MOST important rule.

You are the intelligent AI Assistant for the SeatNow restaurant reservation platform.
Your mission is to assist customers in searching for, suggesting restaurants, and answering inquiries related to dining services on SeatNow.

## Support Scope (CRITICAL):
- You ONLY answer questions about: restaurant recommendations, menu details, pricing, opening hours, locations, and matters related to making reservations on SeatNow.
- Strictly DO NOT answer unrelated topics. 

## DATA CONTEXT:
### Search Results (Matching User Intent - HIGH PRIORITY):
{search_text}

### Customer's Booking History (Latest):
{history_text}

### General List of Active Restaurants (Fallback):
{restaurants_text}

## Response Guidelines:
1. **Prioritize Search Results:** If `Search Results` contains restaurants that match the user's intent, suggest them first.
2. **Personalization:** Use the `Booking History` to tailor your tone and suggest similar cuisines if requested.
3. **No Matches:** If no search results match, use the general list as a fallback.
4. **Tone:** Friendly, polite, and concise.
"""


# ─────────────────────── Routes ───────────────────────

@router.post("/recommend", response_model=RecommendResponse)
async def recommend(body: Optional[RevenueSummaryRequest] = None, payload: dict = Depends(get_current_customer)):
    """
    One-shot recommendation: fetches customer history + active restaurants.
    """
    customer_id = str(payload.get("sub", ""))
    lang = body.lang if body and body.lang else "en"
    
    history = data_service.get_customer_booking_history(customer_id)
    # For one-shot recommend, we just use high-rated ones as context unless we want to search.
    # But since there is no 'message' in customer/recommend (it's personal), we use the active list.
    restaurants = data_service.get_active_restaurants(30)
    
    prompt = _build_system_prompt(history, restaurants, lang=lang)
    
    if lang == "vi":
        prompt += "\n## Yêu cầu:\nDựa trên lịch sử của tôi, hãy đưa ra 3 gợi ý nhà hàng phù hợp."
    else:
        prompt += "\n## Request:\nBased on my history, please provide 3 suitable restaurant recommendations."

    reply = gemini_service.one_shot(prompt)
    return RecommendResponse(recommendations=reply)


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, payload: dict = Depends(get_current_customer)):
    """
    Multi-turn chat for customers.
    """
    customer_id = str(payload.get("sub", ""))
    session_key = _session_key(customer_id, body.sessionId)
    lang = body.lang or "en"

    # Load context from DB
    booking_history = data_service.get_customer_booking_history(customer_id)
    
    # Perform Search based on user message
    search_results = data_service.search_restaurants_by_keyword(body.message)
    fallback_restaurants = data_service.get_active_restaurants(20)
    
    system_prompt = _build_system_prompt(booking_history, fallback_restaurants, search_results=search_results, lang=lang)

    # Load existing chat history
    history = redis_client.load_history(session_key)

    # Call Gemini with history
    reply = gemini_service.chat(system_prompt, history, body.message)

    # Persist updated history
    history.append({"role": "user", "parts": [body.message]})
    history.append({"role": "model", "parts": [reply]})
    redis_client.save_history(session_key, history)

    return ChatResponse(reply=reply, session_key=session_key)


@router.get("/chat/history")
async def get_history(sessionId: Optional[str] = None, payload: dict = Depends(get_current_customer)):
    """Fetch all chat history for this customer from Redis."""
    customer_id = str(payload.get("sub", ""))
    session_key = _session_key(customer_id, sessionId)
    history = redis_client.load_history(session_key)
    return {"history": history, "session_key": session_key}


@router.delete("/chat/history")
async def clear_history(sessionId: Optional[str] = None, payload: dict = Depends(get_current_customer)):
    """Delete all chat history for this customer."""
    customer_id = str(payload.get("sub", ""))
    session_key = _session_key(customer_id, sessionId)
    redis_client.clear_history(session_key)
    return {"message": "Chat history cleared successfully", "session_key": session_key}

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
from models.schemas import ChatRequest, ChatResponse, RecommendResponse, RevenueSummaryRequest
from services import data_service, gemini_service
from config import redis_client

router = APIRouter(prefix="/api/ai/customer", tags=["Customer AI"])


# ─────────────────────── Helpers ───────────────────────

def _session_key(customer_id: str) -> str:
    return f"ai:customer:{customer_id}"


def _build_system_prompt(booking_history: list[dict], restaurants: list[dict]) -> str:
    history_text = json.dumps(booking_history, ensure_ascii=False, default=str)
    restaurants_text = json.dumps(restaurants, ensure_ascii=False, default=str)

    return f"""### LANGUAGE POLICY (STRICTEST RULE):
- YOU MUST RESPOND IN THE SAME LANGUAGE AS THE USER'S QUERY.
- If the user asks in **VIETNAMESE**, you MUST respond in **VIETNAMESE**.
- If the user asks in **ENGLISH**, you MUST respond in **ENGLISH**.
- NEVER mix languages. Language consistency is your TOP priority.

You are the intelligent AI Assistant for the SeatNow restaurant reservation platform.
Your mission is to assist customers in searching for, suggesting restaurants, and answering inquiries related to dining services on SeatNow.

## Support Scope (CRITICAL):
- You ONLY answer questions about: restaurant recommendations, menu details, pricing, opening hours, locations, and matters related to making reservations on SeatNow.
- Strictly DO NOT answer unrelated topics. If asked, respond: "I am sorry, but I am a specialized assistant for SeatNow. I can only help you with searching for and booking restaurants. Would you like me to suggest a great restaurant nearby?"

## Customer's Booking History (Latest):
{history_text}

## List of Active Restaurants on SeatNow (Context):
{restaurants_text}

## Response Guidelines:
1. **Direct Suggestions (PRIORITY):** If the user mentions a specific food (e.g., "Phở"), cuisine, or keyword, search the provided list and suggest matching restaurants IMMEDIATELY. 
2. **No Unnecessary Questions:** If you have enough information to make at least one relevant recommendation from the list, do so immediately. Do not ask follow-up questions before giving options.
3. **Smart Fallback:** If no exact match is found, suggest the most related ones from the list (e.g., suggest "Vietnamese Cuisine" if they ask for "Phở" and no specific Phở place exists).
4. **Accuracy:** Use the history to provide personalized suggestions (taste, budget). Never invent information for restaurants that do not exist on the system.
5. **Tone:** Friendly, polite, and concise.
"""


# ─────────────────────── Routes ───────────────────────

@router.post("/recommend", response_model=RecommendResponse)
async def recommend(body: Optional[RevenueSummaryRequest] = None, payload: dict = Depends(get_current_customer)):
    """
    One-shot recommendation: fetches customer history + active restaurants.
    """
    customer_id = str(payload.get("sub", ""))
    lang = body.lang if body and body.lang else "en"

    booking_history = data_service.get_customer_booking_history(customer_id)
    restaurants = data_service.get_active_restaurants()

    base_prompt = _build_system_prompt(booking_history, restaurants)
    instruction = "\n\nXin hãy gợi ý cho tôi vài nhà hàng phù hợp." if lang == "vi" else "\n\nPlease suggest some restaurants that match my preferences."
    
    prompt = base_prompt + instruction

    reply = gemini_service.one_shot(prompt)
    return RecommendResponse(recommendations=reply)


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, payload: dict = Depends(get_current_customer)):
    """
    Multi-turn chat for customers.
    """
    customer_id = str(payload.get("sub", ""))
    session_key = _session_key(customer_id)
    lang = body.lang or "en"

    # Load context from DB
    booking_history = data_service.get_customer_booking_history(customer_id)
    restaurants = data_service.get_active_restaurants()
    system_prompt = _build_system_prompt(booking_history, restaurants)

    # Load existing chat history
    history = redis_client.load_history(session_key)

    # Call Gemini with history
    reply = gemini_service.chat(system_prompt, history, body.message)

    # Persist updated history
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
    return {"message": "Chat history cleared successfully", "session_key": session_key}

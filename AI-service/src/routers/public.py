"""
routers/public.py
Endpoints for guests (not logged in):
  POST /api/ai/public/recommend – one-shot restaurant recommendation based on trends
"""
import json
from fastapi import APIRouter
from models.schemas import PublicRecommendRequest, RecommendResponse
from services import data_service, gemini_service

router = APIRouter(prefix="/api/ai/public", tags=["Public AI"])

def _build_public_system_prompt(trending: list[dict], newest: list[dict]) -> str:
    trending_text = json.dumps(trending, ensure_ascii=False, default=str)
    newest_text = json.dumps(newest, ensure_ascii=False, default=str)

    return f"""You are the SeatNow Assistant. You provide helpful restaurant recommendations to guests.
You have access to the current trending restaurants (most booked) and newly opened restaurants on our platform.

## DATA CONTEXT:
### Trending Restaurants (Last 30 days):
{trending_text}

### Newest Restaurants:
{newest_text}

## INSTRUCTIONS:
1. Suggest restaurants based on the user's question. 
2. If they ask "what's new", prioritize the newest list. 
3. If they ask "where to go today" or "what's popular", prioritize the trending list.
4. Keep the tone friendly and professional.
5. If the user asks in Vietnamese, respond in Vietnamese. If in English, respond in English.
6. Support scope: Only restaurants and dining.
"""

@router.post("/recommend", response_model=RecommendResponse)
async def public_recommend(body: PublicRecommendRequest):
    """
    Public recommendation for guests. No authentication, no history.
    Takes a message from the user (often a suggested question from FE).
    """
    context = data_service.get_public_context()
    system_prompt = _build_public_system_prompt(
        context.get("trending", []), 
        context.get("newest", [])
    )
    
    # Constructing the final prompt clearly
    full_prompt = f"{system_prompt}\n\nUser question: {body.message}"
    
    # Using one-shot since we don't save guest history
    reply = gemini_service.one_shot(full_prompt)
    return RecommendResponse(recommendations=reply)

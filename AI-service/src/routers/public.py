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

def _build_public_system_prompt(trending: list[dict], newest: list[dict], search_results: list[dict] = None, lang: str = "en") -> str:
    trending_text = json.dumps(trending, ensure_ascii=False, default=str)
    newest_text = json.dumps(newest, ensure_ascii=False, default=str)
    search_text = json.dumps(search_results or [], ensure_ascii=False, default=str)
    
    lang_name = "English" if lang == "en" else "Vietnamese"

    return f"""### CRITICAL: TARGET LANGUAGE IS {lang_name.upper()}.
- You MUST respond ONLY in {lang_name}.
- DO NOT use any other language.
- This is the MOST important rule.

You are the SeatNow Assistant. You provide helpful restaurant recommendations to guests.

## Support Scope (CRITICAL):
- You ONLY answer questions about: restaurant recommendations, newly opened places, trends, and matters related to dining on SeatNow.
- Strictly DO NOT answer unrelated topics. 

## DATA CONTEXT:
### Search Results (Matching User Query - HIGH PRIORITY):
{search_text}

### Trending Restaurants (Last 30 days):
{trending_text}

### Newly Opened Restaurants:
{newest_text}

## Response Guidelines:
1. **Prioritize Search Results:** If `Search Results` contains restaurants that match the user's intent, suggest them first and foremost.
2. **Direct Suggestions:** Suggest restaurants based on the user's question IMMEDIATELY. Do not ask for more details if you can find a match in the context.
3. **No Matches:** If no search results match, use the trending/newest lists as fallbacks.
4. **Tone:** Friendly, polite, and professional.
"""

@router.post("/recommend", response_model=RecommendResponse)
async def public_recommend(body: PublicRecommendRequest):
    """
    Public recommendation for guests. 
    """
    lang = body.lang if body.lang else "en"
    context = data_service.get_public_context()
    
    # 1. Perform Keyword Search in DB
    search_results = data_service.search_restaurants_by_keyword(body.message)
    
    system_prompt = _build_public_system_prompt(
        context.get("trending", []), 
        context.get("newest", []),
        search_results=search_results,
        lang=lang
    )
    
    # Constructing the final prompt clearly
    instruction = "\n\n## Yêu cầu:\nHãy gợi ý cho tôi vài nhà hàng nổi bật phù hợp với yêu cầu." if lang == "vi" else "\n\n## Request:\nPlease suggest some notable restaurants that match my request."
    body_message = body.message if body.message else ""
    full_prompt = f"{system_prompt}\n\nUser context: {body_message}{instruction}"
    
    # Using one-shot since we don't save guest history
    reply = gemini_service.one_shot(full_prompt)
    return RecommendResponse(recommendations=reply)

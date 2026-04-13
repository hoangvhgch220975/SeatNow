"""
routers/owner.py
Endpoints for restaurant owners:
  POST /api/ai/owner/revenue-summary  – Analyze revenue and provide business suggestions for the Owner
  POST /api/ai/owner/chat             – Multi-turn conversation for Owner's restaurants
  DELETE /api/ai/owner/chat/history   – Clear Owner's chat history
"""
import json
from typing import Optional
from fastapi import APIRouter, Depends

from middleware.auth import get_current_owner
from models.schemas import ChatRequest, ChatResponse, AdminRevenueSummaryResponse, RevenueSummaryRequest
from services import data_service, gemini_service
from config import redis_client

router = APIRouter(prefix="/api/ai/owner", tags=["Owner AI"])


# ─────────────────────── Helpers ───────────────────────

def _session_key(owner_id: str, restaurant_id: str = None, sessionId: str = None) -> str:
    base = f"ai:owner:{owner_id}"
    if restaurant_id:
        base += f":rest:{restaurant_id}"
    if sessionId:
        base += f":sess:{sessionId}"
    return base


def _build_owner_system_prompt(context: dict, lang: str = "en") -> str:
    revenue_text = json.dumps(context.get("monthly_revenue", []), ensure_ascii=False, default=str)
    restaurants_text = json.dumps(context.get("my_restaurants", []), ensure_ascii=False, default=str)
    
    lang_name = "English" if lang == "en" else "Vietnamese"

    return f"""### CRITICAL: TARGET LANGUAGE IS {lang_name.upper()}.
- You MUST respond ONLY in {lang_name}.
- DO NOT use any other language.
- This is the MOST important rule.

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

## Booking Status Definitions (IMPORTANT - use this to explain data accurately):
- **totalBookings**: All bookings received in the period (sum of all statuses below)
- **completed**: Customer successfully visited and finished their meal
- **arrived**: Customer checked in but visit not yet marked complete
- **confirmed**: Booking was confirmed by restaurant, customer has not arrived yet
- **cancelled**: Booking was cancelled (by customer or restaurant)
- **noShow**: Customer did not arrive and did not cancel (no-show)
- **totalDeposit**: Total deposit amount collected from customers
- **totalCommission**: Total platform commission fee incurred

## Response Guidelines:
1. **Full Status Breakdown:** Always include ALL 5 booking statuses (completed, arrived, confirmed, cancelled, noShow) in your overview, even if a value is 0.
2. **Actionable Insights:** Identify strengths, weaknesses, and growth opportunities.
3. **Professional Tone:** Maintain a professional, encouraging, and data-driven tone. Be concise.
4. **Language Consistency:** Always respond in the SAME language as the query.
"""


def _build_single_restaurant_system_prompt(context: dict, lang: str = "en") -> str:
    restaurant = context.get("restaurant", {})
    revenue_text = json.dumps(context.get("monthly_revenue", []), ensure_ascii=False, default=str)
    
    lang_name = "English" if lang == "en" else "Vietnamese"

    return f"""### CRITICAL: TARGET LANGUAGE IS {lang_name.upper()}.
- You MUST respond ONLY in {lang_name}.
- DO NOT use any other language.
- This is the MOST important rule.

You are the SeatNow Business Advisor. You are currently analyzing a SPECIFIC restaurant for the owner.

## Target Restaurant:
- Name: {restaurant.get('name')}
- Address: {restaurant.get('address')}
- Cuisine: {json.dumps(restaurant.get('cuisineTypes', []), ensure_ascii=False)}
- Rating: {restaurant.get('ratingAvg')} / 5

## Performance Data (Last 12 months for THIS restaurant):
{revenue_text}

## Booking Status Definitions (IMPORTANT - use this to explain data accurately):
- **totalBookings**: All bookings in the period
- **completed**: Customer successfully visited and finished their meal
- **arrived**: Customer checked in but visit not yet marked complete  
- **confirmed**: Booking confirmed by restaurant, customer has not arrived yet
- **cancelled**: Booking was cancelled (by customer or restaurant)
- **noShow**: Customer did not arrive and did not cancel
- **totalDeposit**: Total deposit amount collected
- **totalCommission**: Total platform commission fee

## Operational Scope:
- Focus your advice specifically on this restaurant.
- Use the data provided to suggest improvements, marketing strategies, or operational changes.

## Response Guidelines:
1. **Full Status Breakdown:** Always include ALL 5 booking statuses (completed, arrived, confirmed, cancelled, noShow) in your overview.
2. **Actionable Insights:** Identify specific trends for this location.
3. **Professional Tone:** Maintain a professional and data-driven tone.
4. **Language Consistency:** Always respond in the SAME language as the query.
"""


def _build_one_shot_prompt(context: dict, is_single: bool = False, lang: str = "en") -> str:
    base = _build_single_restaurant_system_prompt(context, lang=lang) if is_single else _build_owner_system_prompt(context, lang=lang)
    
    if lang == "vi":
        target = "nhà hàng này" if is_single else "các nhà hàng của tôi"
        return base + f"""
## Yêu cầu:
Vui lòng cung cấp một bản phân tích tình hình kinh doanh toàn diện cho 12 tháng qua, bao gồm:
1. Tổng quan về doanh thu và lượng đặt bàn của {target}.
2. Các xu hướng hiệu suất chính và những điểm nổi bật đáng lưu ý.
3. Các gợi ý hành động cụ thể để tăng doanh thu và cải thiện chất lượng dịch vụ trong những tháng tới.
"""
    else:
        target = "this restaurant" if is_single else "my properties"
        return base + f"""
## Request:
Please provide a comprehensive business analysis for the past 12 months, including:
1. Revenue & booking overview across {target}.
2. Key performance trends and noteworthy highlights.
3. Specific actionable suggestions to increase revenue and improve service quality in the coming months.
"""


# ─────────────────────── Routes ───────────────────────

@router.post("/revenue-summary", response_model=AdminRevenueSummaryResponse)
async def revenue_summary(body: Optional[RevenueSummaryRequest] = None, payload: dict = Depends(get_current_owner)):
    """
    One-shot: Lấy dữ liệu của Owner (hoặc 1 nhà hàng cụ thể) và tạo bản phân tích tình hình kinh doanh.
    """
    owner_id = str(payload.get("sub", ""))
    restaurant_id_or_slug = body.restaurantId if body else None
    lang = body.lang if body and body.lang else "en"
    
    if restaurant_id_or_slug:
        context = data_service.get_single_restaurant_context(owner_id, restaurant_id_or_slug)
        if not context:
            return AdminRevenueSummaryResponse(summary="Restaurant not found or you do not have permission to access it.")
        prompt = _build_one_shot_prompt(context, is_single=True, lang=lang)
    else:
        context = data_service.get_owner_overview_context(owner_id)
        prompt = _build_one_shot_prompt(context, is_single=False, lang=lang)
        
    reply = gemini_service.one_shot(prompt)
    return AdminRevenueSummaryResponse(summary=reply)


@router.post("/chat", response_model=ChatResponse)
async def chat(body: ChatRequest, payload: dict = Depends(get_current_owner)):
    """
    Multi-turn conversation for restaurant owners.
    Supports both general portfolio chat and specific restaurant chats.
    """
    owner_id = str(payload.get("sub", ""))
    restaurant_id_or_slug = body.restaurantId
    lang = body.lang or "en"
    
    if restaurant_id_or_slug:
        # Chat cho 1 nhà hàng cụ thể
        context = data_service.get_single_restaurant_context(owner_id, restaurant_id_or_slug)
        if not context:
            return ChatResponse(reply="I'm sorry, I couldn't find information for that restaurant or you don't have access to it.", session_key="")
        
        system_prompt = _build_single_restaurant_system_prompt(context, lang=lang)
        # Use the absolute ID for the session key to avoid slug changes breaking history
        final_id = context["restaurant"]["id"]
        session_key = _session_key(owner_id, final_id, body.sessionId)
    else:
        # Chat tổng quát (Portfolio)
        context = data_service.get_owner_overview_context(owner_id)
        system_prompt = _build_owner_system_prompt(context, lang=lang)
        session_key = _session_key(owner_id, sessionId=body.sessionId)

    # Tải lịch sử từ Redis
    history = redis_client.load_history(session_key)

    # Gọi Gemini
    reply = gemini_service.chat(system_prompt, history, body.message)

    # Lưu lại lịch sử
    history.append({"role": "user", "parts": [body.message]})
    history.append({"role": "model", "parts": [reply]})
    redis_client.save_history(session_key, history)

    return ChatResponse(reply=reply, session_key=session_key)


@router.get("/chat/history")
async def get_history(sessionId: Optional[str] = None, restaurantId: Optional[str] = None, payload: dict = Depends(get_current_owner)):
    """Fetch chat history for this owner (General or per restaurant) from Redis."""
    owner_id = str(payload.get("sub", ""))
    session_key = _session_key(owner_id, restaurantId, sessionId)
    history = redis_client.load_history(session_key)
    return {"history": history, "session_key": session_key}


@router.delete("/chat/history")
async def clear_history(sessionId: Optional[str] = None, restaurantId: Optional[str] = None, payload: dict = Depends(get_current_owner)):
    """Clear Owner's chat history (General or per restaurant)."""
    owner_id = str(payload.get("sub", ""))
    
    # Ở đây chúng ta không cần verify ownership cực đoan vì chỉ là xóa history của chính mình
    # Nhưng nếu có restaurantId, chúng ta nên convert sang ID nếu là slug để xóa đúng key
    session_key = _session_key(owner_id, restaurantId, sessionId)
    redis_client.clear_history(session_key)
    return {"message": "Chat history cleared successfully", "session_key": session_key}

"""
services/data_service.py
Fetches business data from MSSQL to provide context for AI prompts.
"""
import json
import re
from config.db import get_connection
from config.mongo import get_mongo_db
from config import redis_client


# ────────────────── Helpers ──────────────────

def _safe_json(json_str, default):
    try:
        return json.loads(json_str) if json_str else default
    except:
        return default


def _to_vietnamese_regex(query: str) -> str:
    """
    Converts a plain string into a regex pattern that matches both accented and unaccented Vietnamese.
    """
    replacements = {
        'a': '[aàáảãạăằắẳẵặâầấẩẫậ]',
        'e': '[eèéẻẽẹêềếểễệ]',
        'i': '[iìíỉĩị]',
        'o': '[oòóỏõọôồốổỗộơờớởỡợ]',
        'u': '[uùúủũụưừứửữự]',
        'y': '[yỳýỷỹỵ]',
        'd': '[dđ]',
    }
    pattern = ""
    for char in query.lower():
        if char in replacements:
            pattern += replacements[char]
        else:
            pattern += re.escape(char)
    return pattern


def search_restaurants_by_keyword(query: str, limit: int = 20) -> list[dict]:
    """
    Improved search: 
    1. MSSQL (Restaurants: Name, Description, Cuisine) with accent-insensitive collation.
    2. MongoDB (MenuItems: Name, Description) using Regex.
    3. MongoDB (Reviews: Comment) using Regex.
    """
    if not query or len(query.strip()) < 2:
        return []

    # --- PART 0: Check Cache ---
    import hashlib
    query_hash = hashlib.md5(query.strip().lower().encode('utf-8')).hexdigest()
    cache_key = f"ai:cache:search:{query_hash}"
    cached_results = redis_client.get_cache(cache_key)
    if cached_results:
        return cached_results

    # Clean the query
    keywords = query.lower().split()
    fillers = {"cho", "tôi", "nhà", "hàng", "một", "1", "tìm", "giúp", "với", "phát", "ở", "gần", "đây", "có", "nào", "không"}
    clean_words = [w for w in keywords if w not in fillers and len(w) > 1]
    
    if not clean_words:
        clean_words = [query.strip().lower()]

    matched_ids = set()

    # --- PART 1: MSSQL Search (Restaurants) ---
    conn = get_connection()
    cursor = conn.cursor()
    
    mssql_conditions = []
    mssql_params = []
    for word in clean_words:
        pattern = f"%{word}%"
        # We use COLLATE Vietnamese_CI_AI for accent-insensitive and case-insensitive matching
        mssql_conditions.append("(LOWER(name) COLLATE Vietnamese_CI_AI LIKE ? OR LOWER(description) COLLATE Vietnamese_CI_AI LIKE ? OR LOWER(cuisineTypeJson) COLLATE Vietnamese_CI_AI LIKE ?)")
        mssql_params.extend([pattern, pattern, pattern])

    where_clause = " AND ".join(mssql_conditions)
    sql_mssql = f"SELECT id FROM dbo.Restaurants WHERE status = 'active' AND ({where_clause})"
    
    try:
        cursor.execute(sql_mssql, mssql_params)
        for row in cursor.fetchall():
            matched_ids.add(row[0])
    except Exception as e:
        # Fallback if collation is not supported
        sql_fallback = sql_mssql.replace("COLLATE Vietnamese_CI_AI", "")
        cursor.execute(sql_fallback, mssql_params)
        for row in cursor.fetchall():
            matched_ids.add(row[0])

    # --- PART 2: MongoDB Search (MenuItems & Reviews) ---
    try:
        mongo_db = get_mongo_db()
        regex_patterns = [re.compile(_to_vietnamese_regex(w), re.IGNORECASE) for w in clean_words]
        
        # 2a. Search MenuItems
        menu_matches = mongo_db.menuitems.find({
            "$and": [
                {"$or": [{"name": pat}, {"description": pat}, {"category": pat}]}
                for pat in regex_patterns
            ]
        }, {"restaurantId": 1})
        
        for doc in menu_matches:
            if "restaurantId" in doc:
                matched_ids.add(str(doc["restaurantId"]))
                
        # 2b. Search Reviews
        review_matches = mongo_db.reviews.find({
            "$and": [
                {"comment": pat} for pat in regex_patterns
            ]
        }, {"restaurantId": 1}).limit(50) 
        
        for doc in review_matches:
            if "restaurantId" in doc:
                matched_ids.add(str(doc["restaurantId"]))
    except Exception as mongo_err:
        print(f"Mongo search error: {mongo_err}")

    if not matched_ids:
        cursor.close()
        conn.close()
        return []

    # --- PART 3: Fetch Full Details for Matched IDs ---
    placeholders = ",".join(["?"] * len(matched_ids))
    sql_final = f"""
        SELECT TOP (?)
            id, name, address, cuisineTypeJson, priceRange, ratingAvg, ratingCount, description
        FROM dbo.Restaurants
        WHERE id IN ({placeholders}) AND status = 'active'
        ORDER BY isPremium DESC, ratingAvg DESC
    """
    
    cursor.execute(sql_final, [limit] + list(matched_ids))
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    results = []
    for row in rows:
        item = dict(zip(columns, row))
        item["cuisineTypes"] = _safe_json(item.get("cuisineTypeJson"), [])
        del item["cuisineTypeJson"]
        results.append(item)
    
    cursor.close()
    conn.close()

    # --- PART 4: Save to Cache (30 min) ---
    redis_client.set_cache(cache_key, results, 1800)
    
    return results


def get_customer_booking_history(customer_id: str, limit: int = 30) -> list[dict]:
    """
    Returns the customer's recent completed/arrived bookings joined with restaurant info.
    """
    cache_key = f"ai:cache:customer_history:{customer_id}"
    cached_data = redis_client.get_cache(cache_key)
    if cached_data:
        return cached_data

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT TOP (?)
            b.restaurantId,
            b.bookingDate,
            b.bookingTime,
            b.numGuests,
            b.status,
            b.specialRequests,
            r.name        AS restaurantName,
            r.address     AS restaurantAddress,
            r.cuisineTypeJson,
            r.priceRange,
            r.ratingAvg
        FROM dbo.Bookings b
        JOIN dbo.Restaurants r ON r.id = b.restaurantId
        WHERE b.customerId = ?
          AND b.status IN ('COMPLETED', 'ARRIVED', 'CANCELLED')
        ORDER BY b.bookingDate DESC
        """,
        (limit, customer_id)
    )
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    results = []
    for row in rows:
        item = dict(zip(columns, row))
        # Parse JSON fields
        item["cuisineTypes"] = _safe_json(item.get("cuisineTypeJson"), [])
        del item["cuisineTypeJson"]
        results.append(item)
    cursor.close()
    conn.close()

    # Cache for 30 minutes
    redis_client.set_cache(cache_key, results, 1800)
    return results


def get_active_restaurants(limit: int = 80) -> list[dict]:
    """
    Returns top active restaurants ordered by premium + rating — used for recommendation.
    """
    cache_key = "ai:cache:active_restaurants"
    cached_data = redis_client.get_cache(cache_key)
    if cached_data:
        return cached_data

    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT TOP (?)
            id,
            name,
            address,
            cuisineTypeJson,
            priceRange,
            ratingAvg,
            ratingCount,
            description
        FROM dbo.Restaurants
        WHERE status = 'active'
        ORDER BY isPremium DESC, ratingAvg DESC, ratingCount DESC
        """,
        (limit,)
    )
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    results = []
    for row in rows:
        item = dict(zip(columns, row))
        item["cuisineTypes"] = _safe_json(item.get("cuisineTypeJson"), [])
        del item["cuisineTypeJson"]
        results.append(item)
    cursor.close()
    conn.close()

    # Cache for 2 hours
    redis_client.set_cache(cache_key, results, 7200)
    return results


def get_trending_restaurants(limit: int = 5, days: int = 30) -> list[dict]:
    """
    Returns top restaurants by booking count in the last N days.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT TOP (?)
            r.id, r.name, r.address, r.cuisineTypeJson, r.priceRange, r.ratingAvg,
            COUNT(b.id) AS recentBookingCount
        FROM dbo.Bookings b
        JOIN dbo.Restaurants r ON r.id = b.restaurantId
        WHERE b.bookingDate >= DATEADD(DAY, -?, CAST(GETDATE() AS DATE))
          AND r.status = 'active'
        GROUP BY r.id, r.name, r.address, r.cuisineTypeJson, r.priceRange, r.ratingAvg
        ORDER BY recentBookingCount DESC
        """,
        (limit, days)
    )
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    results = []
    for row in rows:
        item = dict(zip(columns, row))
        item["cuisineTypes"] = _safe_json(item.get("cuisineTypeJson"), [])
        del item["cuisineTypeJson"]
        results.append(item)
    cursor.close()
    conn.close()
    return results


def get_newest_restaurants(limit: int = 5) -> list[dict]:
    """
    Returns the most recently joined active restaurants.
    """
    conn = get_connection()
    cursor = conn.cursor()
    # Note: Using createdAt if exists, otherwise id (assuming sequential)
    cursor.execute(
        """
        SELECT TOP (?)
            id, name, address, cuisineTypeJson, priceRange, ratingAvg, createdAt
        FROM dbo.Restaurants
        WHERE status = 'active'
        ORDER BY createdAt DESC, id DESC
        """,
        (limit,)
    )
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    results = []
    for row in rows:
        item = dict(zip(columns, row))
        item["cuisineTypes"] = _safe_json(item.get("cuisineTypeJson"), [])
        del item["cuisineTypeJson"]
        results.append(item)
    cursor.close()
    conn.close()
    return results


def get_public_context() -> dict:
    """Bundle context for guest recommendations (with caching)."""
    cache_key = "ai:cache:public_context"
    cached_data = redis_client.get_cache(cache_key)
    if cached_data:
        return cached_data

    data = {
        "trending": get_trending_restaurants(5, 30),
        "newest": get_newest_restaurants(5)
    }

    # Cache for 4 hours
    redis_client.set_cache(cache_key, data, 14400)
    return data


# ────────────────── Admin context ──────────────────

def get_monthly_revenue_summary(months: int = 12) -> list[dict]:
    """
    Revenue aggregation per month for the last N months.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            FORMAT(b.bookingDate, 'yyyy-MM') AS month,
            COUNT(1)                                                           AS totalBookings,
            SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END)           AS completed,
            SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END)           AS cancelled,
            SUM(CASE WHEN b.status = 'ARRIVED'   THEN 1 ELSE 0 END)           AS arrived,
            ISNULL(SUM(b.commissionFee), 0)                                   AS totalCommission,
            ISNULL(SUM(CASE WHEN b.depositPaid = 1 THEN b.depositAmount ELSE 0 END), 0) AS totalDeposit
        FROM dbo.Bookings b
        WHERE b.bookingDate >= DATEADD(MONTH, -?, CAST(GETDATE() AS DATE))
        GROUP BY FORMAT(b.bookingDate, 'yyyy-MM')
        ORDER BY month DESC
        """,
        (months,)
    )
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    cursor.close()
    conn.close()
    return [dict(zip(columns, row)) for row in rows]


def get_top_restaurants_by_commission(limit: int = 10, months: int = 12) -> list[dict]:
    """
    Top restaurants by total commission earned in last N months.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT TOP (?)
            r.name,
            r.address,
            r.cuisineTypeJson,
            r.priceRange,
            COUNT(b.id)                     AS totalBookings,
            ISNULL(SUM(b.commissionFee), 0) AS totalCommission
        FROM dbo.Bookings b
        JOIN dbo.Restaurants r ON r.id = b.restaurantId
        WHERE b.status IN ('COMPLETED', 'ARRIVED')
          AND b.bookingDate >= DATEADD(MONTH, -?, CAST(GETDATE() AS DATE))
        GROUP BY r.id, r.name, r.address, r.cuisineTypeJson, r.priceRange
        ORDER BY totalCommission DESC
        """,
        (limit, months)
    )
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    results = []
    for row in rows:
        item = dict(zip(columns, row))
        item["cuisineTypes"] = _safe_json(item.get("cuisineTypeJson"), [])
        del item["cuisineTypeJson"]
        results.append(item)
    cursor.close()
    conn.close()
    return results


def get_admin_overview_context() -> dict:
    """Bundle all admin context data in one call (with caching)."""
    cache_key = "ai:cache:admin_overview"
    cached_data = redis_client.get_cache(cache_key)
    if cached_data:
        return cached_data

    data = {
        "monthly_revenue": get_monthly_revenue_summary(12),
        "top_restaurants": get_top_restaurants_by_commission(10, 12),
    }

    # Cache for 6 hours
    redis_client.set_cache(cache_key, data, 21600)
    return data


# ────────────────── Owner context ──────────────────

def get_owner_restaurants(owner_id: str) -> list[dict]:
    """
    Get the list of restaurants owned by the owner.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT id, name, address, cuisineTypeJson, ratingAvg, status
        FROM dbo.Restaurants
        WHERE ownerId = ?
        """,
        (owner_id,)
    )
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    results = []
    for row in rows:
        item = dict(zip(columns, row))
        item["cuisineTypes"] = _safe_json(item.get("cuisineTypeJson"), [])
        del item["cuisineTypeJson"]
        results.append(item)
    cursor.close()
    conn.close()
    return results


def get_owner_monthly_revenue_summary(owner_id: str, months: int = 12) -> list[dict]:
    """
    Get the monthly revenue summary for all restaurants owned by the owner.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            FORMAT(b.bookingDate, 'yyyy-MM') AS month,
            COUNT(1)                                                           AS totalBookings,
            SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END)           AS completed,
            SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END)           AS cancelled,
            SUM(CASE WHEN b.status = 'ARRIVED'   THEN 1 ELSE 0 END)           AS arrived,
            SUM(CASE WHEN b.status = 'CONFIRMED' THEN 1 ELSE 0 END)           AS confirmed,
            SUM(CASE WHEN b.status = 'NO_SHOW'   THEN 1 ELSE 0 END)           AS noShow,
            ISNULL(SUM(b.commissionFee), 0)                                   AS totalCommission,
            ISNULL(SUM(CASE WHEN b.depositPaid = 1 THEN b.depositAmount ELSE 0 END), 0) AS totalDeposit
        FROM dbo.Bookings b
        JOIN dbo.Restaurants r ON r.id = b.restaurantId
        WHERE r.ownerId = ?
          AND b.bookingDate >= DATEADD(MONTH, -?, CAST(GETDATE() AS DATE))
        GROUP BY FORMAT(b.bookingDate, 'yyyy-MM')
        ORDER BY month DESC
        """,
        (owner_id, months)
    )
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    cursor.close()
    conn.close()
    return [dict(zip(columns, row)) for row in rows]


def get_owner_overview_context(owner_id: str) -> dict:
    """
    Get the data context for the owner (with caching).
    """
    cache_key = f"ai:cache:owner_overview:{owner_id}"
    cached_data = redis_client.get_cache(cache_key)
    if cached_data:
        return cached_data

    data = {
        "my_restaurants": get_owner_restaurants(owner_id),
        "monthly_revenue": get_owner_monthly_revenue_summary(owner_id, 12),
    }

    # Cache trong 1 giờ (dữ liệu owner thường biến động nhanh hơn admin)
    redis_client.set_cache(cache_key, data, 3600)
    return data


def get_restaurant_monthly_revenue_summary(restaurant_id: str, months: int = 12) -> list[dict]:
    """
    Get the monthly revenue summary for a specific restaurant.
    """
    conn = get_connection()
    cursor = conn.cursor()
    cursor.execute(
        """
        SELECT
            FORMAT(b.bookingDate, 'yyyy-MM') AS month,
            COUNT(1)                                                           AS totalBookings,
            SUM(CASE WHEN b.status = 'COMPLETED' THEN 1 ELSE 0 END)           AS completed,
            SUM(CASE WHEN b.status = 'CANCELLED' THEN 1 ELSE 0 END)           AS cancelled,
            SUM(CASE WHEN b.status = 'ARRIVED'   THEN 1 ELSE 0 END)           AS arrived,
            SUM(CASE WHEN b.status = 'CONFIRMED' THEN 1 ELSE 0 END)           AS confirmed,
            SUM(CASE WHEN b.status = 'NO_SHOW'   THEN 1 ELSE 0 END)           AS noShow,
            ISNULL(SUM(b.commissionFee), 0)                                   AS totalCommission,
            ISNULL(SUM(CASE WHEN b.depositPaid = 1 THEN b.depositAmount ELSE 0 END), 0) AS totalDeposit
        FROM dbo.Bookings b
        WHERE b.restaurantId = ?
          AND b.bookingDate >= DATEADD(MONTH, -?, CAST(GETDATE() AS DATE))
        GROUP BY FORMAT(b.bookingDate, 'yyyy-MM')
        ORDER BY month DESC
        """,
        (restaurant_id, months)
    )
    rows = cursor.fetchall()
    columns = [col[0] for col in cursor.description]
    cursor.close()
    conn.close()
    return [dict(zip(columns, row)) for row in rows]


def get_single_restaurant_context(owner_id: str, restaurant_id_or_slug: str) -> dict:
    """
    Get context for a single restaurant (with ownership verification).
    """
    # 0. Check Cache
    cache_key = f"ai:cache:owner_rest_context:{owner_id}:{restaurant_id_or_slug}"
    cached_data = redis_client.get_cache(cache_key)
    if cached_data:
        return cached_data

    # 1. Resolve & Verify Ownership
    conn = get_connection()
    cursor = conn.cursor()
    
    # Check if input is UUID or Slug
    is_uuid = False
    try:
        from uuid import UUID
        UUID(restaurant_id_or_slug)
        is_uuid = True
    except:
        pass

    if is_uuid:
        cursor.execute(
            "SELECT id, name, address, cuisineTypeJson, ratingAvg, status FROM dbo.Restaurants WHERE id = ? AND ownerId = ?",
            (restaurant_id_or_slug, owner_id)
        )
    else:
        cursor.execute(
            "SELECT id, name, address, cuisineTypeJson, ratingAvg, status FROM dbo.Restaurants WHERE slug = ? AND ownerId = ?",
            (restaurant_id_or_slug, owner_id)
        )
        
    row = cursor.fetchone()
    if not row:
        cursor.close()
        conn.close()
        return None  # Forbidden or Not Found
        
    columns = [col[0] for col in cursor.description]
    restaurant = dict(zip(columns, row))
    restaurant["cuisineTypes"] = _safe_json(restaurant.get("cuisineTypeJson"), [])
    del restaurant["cuisineTypeJson"]
    
    restaurant_id = restaurant["id"]
    cursor.close()
    conn.close()

    # 2. Get Revenue for this specific restaurant
    data = {
        "restaurant": restaurant,
        "monthly_revenue": get_restaurant_monthly_revenue_summary(restaurant_id, 12)
    }

    # 3. Save to Cache (10 min)
    redis_client.set_cache(cache_key, data, 600)

    return data


# ────────────────── Utilities ──────────────────

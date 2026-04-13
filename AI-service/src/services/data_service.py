"""
services/data_service.py
Fetches business data from MSSQL to provide context for AI prompts.
"""
import json
from config.db import get_connection
from config import redis_client


# ────────────────── Customer context ──────────────────

def _safe_json(json_str, default):
    try:
        return json.loads(json_str) if json_str else default
    except:
        return default


def search_restaurants_by_keyword(query: str, limit: int = 20) -> list[dict]:
    """
    Search restaurants in the database based on keywords in name, description, address, or cuisine types.
    """
    if not query or len(query.strip()) < 2:
        return []

    # Clean the query: remove common filler words
    keywords = query.lower().split()
    fillers = {"cho", "tôi", "nhà", "hàng", "một", "1", "tìm", "giúp", "với", "phát", "ở", "gần", "đây", "có", "nào", "không"}
    clean_words = [w for w in keywords if w not in fillers and len(w) > 1]
    
    if not clean_words:
        # If all words were fillers (or it's just a short word), use the original query trim
        clean_words = [query.strip().lower()]

    conn = get_connection()
    cursor = conn.cursor()
    
    # Construct a query searching for EACH significant keyword
    conditions = []
    params = []
    for word in clean_words:
        pattern = f"%{word}%"
        conditions.append("(LOWER(name) LIKE ? OR LOWER(description) LIKE ? OR LOWER(address) LIKE ? OR LOWER(cuisineTypeJson) LIKE ?)")
        params.extend([pattern, pattern, pattern, pattern])

    limit_param = limit
    where_clause = " AND ".join(conditions)
    sql = f"""
        SELECT TOP (?)
            id, name, address, cuisineTypeJson, priceRange, ratingAvg, ratingCount, description
        FROM dbo.Restaurants
        WHERE status = 'active'
          AND ({where_clause})
        ORDER BY isPremium DESC, ratingAvg DESC
    """
    
    cursor.execute(sql, [limit_param] + params)
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
    return data


# ────────────────── Utilities ──────────────────

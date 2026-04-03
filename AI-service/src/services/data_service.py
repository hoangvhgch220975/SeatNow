"""
services/data_service.py
Fetches business data from MSSQL to provide context for AI prompts.
"""
import json
from config.db import get_connection


# ────────────────── Customer context ──────────────────

def get_customer_booking_history(customer_id: str, limit: int = 30) -> list[dict]:
    """
    Returns the customer's recent completed/arrived bookings joined with restaurant info.
    """
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
    return results


def get_active_restaurants(limit: int = 80) -> list[dict]:
    """
    Returns top active restaurants ordered by premium + rating — used for recommendation.
    """
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
    """Bundle context for guest recommendations."""
    return {
        "trending": get_trending_restaurants(5, 30),
        "newest": get_newest_restaurants(5)
    }


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
    """Bundle all admin context data in one call."""
    return {
        "monthly_revenue": get_monthly_revenue_summary(12),
        "top_restaurants": get_top_restaurants_by_commission(10, 12),
    }


# ────────────────── Utilities ──────────────────

def _safe_json(value, default):
    if not value:
        return default
    try:
        return json.loads(value)
    except Exception:
        return default

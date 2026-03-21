# SeatNow AI Service

Xây dựng một Python FastAPI microservice AI mới tại `Final Project/AI-service/`, phục vụ 2 mục đích:

1. **Customer AI** – gợi ý nhà hàng cho khách hàng đã đăng nhập, dựa trên lịch sử booking và thông tin nhà hàng.
2. **Admin AI** – tổng hợp doanh thu & gợi ý hướng kinh doanh trong tương lai gần.

Cả hai chức năng đều hỗ trợ **multi-turn chat** — lịch sử trò chuyện được lưu vào **Redis với TTL 7 ngày**.

## Proposed Changes

### AI-service (Python FastAPI)

Stack: Python 3.11+, FastAPI, `google-generativeai`, `pyodbc` / `pymssql`, `redis`, `python-dotenv`

---

#### [NEW] [.env](file:///c:/Users/Admin/OneDrive/Desktop/Final%20Project/AI-service/.env)

```
PORT=3007
GEMINI_API_KEY=AIzaSyDVB6Dn0Yx9yiCauB7FnagYJh_sNJTinvc

# MSSQL (same as other services)
DB_SERVER=(localdb)\MSSQLLocalDB
DB_NAME=SeatNow
DB_USER=
DB_PASSWORD=
DB_ENCRYPT=yes
DB_TRUST_CERT=yes
DB_DRIVER=ODBC Driver 17 for SQL Server

# Redis
REDIS_URL=redis://localhost:6379

# JWT (same secret as other services – dùng để verify token)
JWT_ACCESS_SECRET=vhTony_24_access
INTERNAL_SERVICE_TOKEN=vhTony_24_internal_token

# Chat history TTL = 7 ngày (giây)
CHAT_HISTORY_TTL_SEC=604800
```

---

#### [NEW] [requirements.txt](file:///c:/Users/Admin/OneDrive/Desktop/Final%20Project/AI-service/requirements.txt)

```
fastapi
uvicorn[standard]
google-generativeai
pyodbc
redis
python-dotenv
python-jose[cryptography]
pydantic
```

---

#### [NEW] `config/db.py`
Kết nối MSSQL qua `pyodbc` (connection string tương tự booking-service).  
Expose function `get_connection()` → trả về `pyodbc.Connection`.

---

#### [NEW] `config/redis_client.py`
Khởi tạo `redis.Redis` từ `REDIS_URL`.  
Expose:
- `save_history(session_key, messages, ttl)` – lưu list message JSON, expire TTL 7 ngày.
- `load_history(session_key)` – load list message.
- `clear_history(session_key)` – xóa key.

Session key format:
- Customer: `ai:customer:{customerId}`
- Admin: `ai:admin:{adminId}`

---

#### [NEW] `middleware/auth.py`
JWT verify middleware dùng chung secret `JWT_ACCESS_SECRET`.  
Trích xuất `userId` và `role` từ token → inject vào `request.state`.

---

#### [NEW] `services/data_service.py`
Query MSSQL để lấy dữ liệu context cho AI:

**Customer:**
```sql
-- Lịch sử booking của customer (status COMPLETED/ARRIVED, 50 bản ghi gần nhất)
SELECT TOP 50 b.restaurantId, b.bookingDate, b.numGuests, b.status,
       r.name, r.address, r.cuisineTypeJson, r.priceRange, r.ratingAvg
FROM dbo.Bookings b
JOIN dbo.Restaurants r ON r.id = b.restaurantId
WHERE b.customerId = @customerId AND b.status IN ('COMPLETED','ARRIVED')
ORDER BY b.bookingDate DESC

-- Danh sách nhà hàng active để gợi ý (top 100 theo rating)
SELECT TOP 100 id, name, address, cuisineTypeJson, priceRange, ratingAvg, ratingCount, description
FROM dbo.Restaurants
WHERE status = 'active'
ORDER BY isPremium DESC, ratingAvg DESC
```

**Admin:**
```sql
-- Tổng hợp doanh thu theo tháng (12 tháng gần nhất)
SELECT FORMAT(b.bookingDate,'yyyy-MM') AS month,
       COUNT(1) AS totalBookings,
       SUM(CASE WHEN b.status='COMPLETED' THEN 1 ELSE 0 END) AS completed,
       SUM(CASE WHEN b.status='CANCELLED' THEN 1 ELSE 0 END) AS cancelled,
       ISNULL(SUM(b.commissionFee),0) AS totalCommission,
       ISNULL(SUM(CASE WHEN b.depositPaid=1 THEN b.depositAmount ELSE 0 END),0) AS totalDeposit
FROM dbo.Bookings b
WHERE b.bookingDate >= DATEADD(month,-12,GETDATE())
GROUP BY FORMAT(b.bookingDate,'yyyy-MM')
ORDER BY month DESC

-- Top 10 nhà hàng theo commission
SELECT TOP 10 r.name, r.address, r.cuisineTypeJson, r.priceRange,
       COUNT(b.id) AS bookings,
       ISNULL(SUM(b.commissionFee),0) AS commission
FROM dbo.Bookings b
JOIN dbo.Restaurants r ON r.id = b.restaurantId
WHERE b.status IN ('COMPLETED','ARRIVED') AND b.bookingDate >= DATEADD(month,-12,GETDATE())
GROUP BY r.id, r.name, r.address, r.cuisineTypeJson, r.priceRange
ORDER BY commission DESC
```

---

#### [NEW] `services/gemini_service.py`
Wrapper gọi Gemini API (`gemini-2.5-flash`), hỗ trợ:
- `chat_with_history(system_prompt, history, user_message)` → response text
- Truyền `history` dưới dạng Gemini `Content` list để enable multi-turn.

---

#### [NEW] `routers/customer.py`

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/api/ai/customer/recommend` | Gợi ý nhà hàng dựa trên lịch sử (one-shot, không lưu history) |
| `POST` | `/api/ai/customer/chat` | Chat multi-turn, lịch sử lưu Redis |
| `DELETE` | `/api/ai/customer/chat/history` | Xóa lịch sử chat của customer |

**Request body `/chat`:**
```json
{ "message": "string" }
```

**Auth:** Bearer JWT (role = `customer`)

System prompt bao gồm:
- Lịch sử booking của customer (từ `data_service`)
- Danh sách nhà hàng đang active
- Hướng dẫn AI trả lời bằng tiếng Việt, gợi ý nhà hàng phù hợp

---

#### [NEW] `routers/admin.py`

| Method | Path | Mô tả |
|--------|------|--------|
| `POST` | `/api/ai/admin/revenue-summary` | Tổng hợp doanh thu + insight (one-shot) |
| `POST` | `/api/ai/admin/chat` | Chat multi-turn với dữ liệu admin |
| `DELETE` | `/api/ai/admin/chat/history` | Xóa lịch sử chat admin |

**Auth:** Bearer JWT (role = `admin` hoặc `INTERNAL_SERVICE_TOKEN`)

System prompt bao gồm:
- Revenue data 12 tháng
- Top nhà hàng
- Yêu cầu AI phân tích và gợi ý hướng kinh doanh tương lai gần

---

#### [NEW] [main.py](file:///c:/Users/Admin/OneDrive/Desktop/Review%20Services/main.py)
FastAPI app, đăng ký routers, CORS, health check tại `GET /health`.  
Port: `8001`.

---

## Verification Plan

### Manual Testing (sau khi chạy `uvicorn main:app --reload --port 3007`)

1. **Health check:**
   ```
   GET http://localhost:3007/health
   → { "status": "OK" }
   ```

2. **Customer recommendation (cần JWT của customer):**
   ```
   POST http://localhost:3007/api/ai/customer/recommend
   Authorization: Bearer <customer_jwt>
   → trả về gợi ý nhà hàng dạng text
   ```

3. **Customer chat (multi-turn):**
   ```
   POST http://localhost:3007/api/ai/customer/chat
   Authorization: Bearer <customer_jwt>
   Body: { "message": "Tôi muốn ăn đồ Nhật giá rẻ" }
   → trả về response + lưu Redis key ai:customer:{id}
   ```

4. **Verify Redis TTL:**
   ```
   redis-cli TTL ai:customer:{id}
   → khoảng 604800 (7 ngày)
   ```

5. **Admin revenue summary:**
   ```
   POST http://localhost:3007/api/ai/admin/revenue-summary
   Authorization: Bearer <admin_jwt>
   → trả về phân tích doanh thu
   ```

6. **Admin chat:**
   ```
   POST http://localhost:3007/api/ai/admin/chat
   Authorization: Bearer <admin_jwt>
   Body: { "message": "Tháng tới nên tập trung vào nhà hàng nào?" }
   → trả về gợi ý
   ```

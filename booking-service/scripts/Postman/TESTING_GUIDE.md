# SeatNow Booking Service - Testing Guide

## 📋 Mục lục
1. [Chuẩn bị môi trường](#chuẩn-bị-môi-trường)
2. [Import Postman Collection](#import-postman-collection)
3. [Cấu hình biến môi trường](#cấu-hình-biến-môi-trường)
4. [Chuẩn bị dữ liệu test](#chuẩn-bị-dữ-liệu-test)
5. [Hướng dẫn test từng endpoint](#hướng-dẫn-test-từng-endpoint)
6. [Test Scenarios (Kịch bản test)](#test-scenarios)
7. [Kiểm tra Database](#kiểm-tra-database)
8. [Troubleshooting](#troubleshooting)

---

## 🛠 Chuẩn bị môi trường

### 1. Cài đặt dependencies
```bash
cd booking-service
npm install
```

### 2. Cấu hình Database (SQL Server)
Đảm bảo SQL Server đang chạy và connection string trong `.env` đúng:

```env
# Database
DB_SERVER=localhost
DB_NAME=SeatNow
DB_USER=sa
DB_PASSWORD=your_password
DB_ENCRYPT=true
DB_TRUST_SERVER_CERTIFICATE=true

# Redis
REDIS_HOST=localhost
REDIS_PORT=6379

# Service
PORT=3002
NODE_ENV=development

# JWT (để verify token từ auth-service)
JWT_SECRET=your_jwt_secret
```

### 3. Tạo bảng Bookings
Chạy script SQL để tạo bảng (nếu chưa có):

```sql
-- File: sql/create_bookokings.sql
CREATE TABLE Bookings (
    id INT IDENTITY(1,1) PRIMARY KEY,
    bookingCode NVARCHAR(50) UNIQUE NOT NULL,
    customerId INT NULL,
    guestName NVARCHAR(255) NULL,
    guestPhone NVARCHAR(20) NULL,
    guestEmail NVARCHAR(255) NULL,
    restaurantId INT NOT NULL,
    tableId INT NOT NULL,
    bookingDate DATE NOT NULL,
    bookingTime TIME NOT NULL,
    numGuests INT NOT NULL,
    status NVARCHAR(20) NOT NULL DEFAULT 'PENDING',
    notes NVARCHAR(MAX) NULL,
    
    -- Deposit & Commission
    depositRequired BIT DEFAULT 0,
    depositAmount DECIMAL(10,2) NULL,
    depositPaid BIT DEFAULT 0,
    depositPaidAt DATETIME NULL,
    depositRefunded BIT DEFAULT 0,
    commissionFee DECIMAL(10,2) NULL,
    commissionPaid BIT DEFAULT 0,
    
    -- Cancellation tracking
    cancelledBy INT NULL,
    cancellationReason NVARCHAR(500) NULL,
    
    -- Timestamps
    createdAt DATETIME DEFAULT GETDATE(),
    confirmedAt DATETIME NULL,
    arrivedAt DATETIME NULL,
    completedAt DATETIME NULL,
    cancelledAt DATETIME NULL,
    noShowAt DATETIME NULL,
    
    CONSTRAINT CK_Booking_Status CHECK (status IN ('PENDING','CONFIRMED','ARRIVED','COMPLETED','CANCELLED','NO_SHOW'))
);

CREATE INDEX IX_Booking_Status ON Bookings(status);
CREATE INDEX IX_Booking_Restaurant_Date ON Bookings(restaurantId, bookingDate);
CREATE INDEX IX_Booking_Customer ON Bookings(customerId);
CREATE INDEX IX_Booking_Code ON Bookings(bookingCode);
```

### 4. Khởi động service
```bash
npm start
```

Service sẽ chạy tại: `http://localhost:3002`

---

## 📥 Import Postman Collection

1. Mở Postman
2. Click **Import** button
3. Chọn file: `scripts/Postman/SeatNow-Booking-Service.postman_collection.json`
4. Collection sẽ hiện trong sidebar với tên **"SeatNow - Booking Service"**

---

## ⚙️ Cấu hình biến môi trường

### Collection Variables (trong Postman)

Click vào Collection → **Variables** tab và cấu hình:

| Variable | Initial Value | Description |
|----------|--------------|-------------|
| `baseUrl` | `http://localhost:3002/api/v1` | Base URL của booking service |
| `accessToken` | _(để trống)_ | JWT token từ auth service |
| `restaurantId` | `BA3FB828-C52C-4FBE-83E7-4F326A9892A2` | Lẩu Dê Nhất Ly - Hạ Long |
| `tableId` | `AA07C586-38BB-423A-8554-1FE87348D2C1` | T01 - 2 guests |
| `tableId4` | `84A298F5-4582-4E6B-880E-5D450EF5EA09` | T02 - 4 guests |
| `tableId6` | `74C4A3F6-A29C-4F06-9D43-B0BDF3FF637A` | OUT01 - 6 guests outdoor |
| `tableIdVIP` | `4ABCE72D-F331-472F-BAD0-088DEF05A8DD` | VIP01 - 8 guests VIP |
| `bookingId` | _(để trống)_ | ID booking (tự động set sau khi tạo) |
| `bookingCode` | _(để trống)_ | Booking code (tự động set) |
| `customerId` | `832BEBB5-D2E4-46C5-A005-C567F7CAA9F8` | Customer: +84818990222 |
| `ownerId` | `C4E503D9-9B33-4C61-AA19-7EF824D55226` | Owner: +84818990234 |

### Lấy Access Token

**Cách 1: Từ Auth Service**
```bash
# Login bằng auth-service (customer)
POST http://localhost:3001/api/v1/auth/login
{
  "phone": "+84818990222",
  "password": "your_password"
}

# Hoặc login bằng owner account
POST http://localhost:3001/api/v1/auth/login
{
  "phone": "+84818990234",
  "password": "your_password"
}

# Copy accessToken từ response và paste vào Collection Variable
```

**Cách 2: Tạo token test**
Nếu chưa có auth-service, tạm thời skip authentication bằng cách:
- Sửa `jwt_middleware.js` để skip verify (chỉ dùng cho test)
- Hoặc test các endpoint public trước (guest booking)

---

## 📊 Chuẩn bị dữ liệu test

### ✅ Dữ liệu có sẵn trong database

**Restaurants:**
```sql
-- BA3FB828-C52C-4FBE-83E7-4F326A9892A2
Lẩu Dê Nhất Ly - Hạ Long
Số 72 Kênh Liêm, Tổ 1, Khu 1, P. Hạ Long
Phone: (+84) 1900 6005
Owner: C4E503D9-9B33-4C61-AA19-7EF824D55226

-- 1D106F0B-F292-405B-9E3A-76B219141863  
Nhà Hàng Green - Hoàng Quốc Việt
Số 2 Hoàng Quốc Việt, KĐT Mới Bãi Cháy, P. Bãi Cháy, TP. Hạ Long
Phone: (+84) 203 3681 888
Owner: C4E503D9-9B33-4C61-AA19-7EF824D55226

-- 3376E961-D0C6-425A-A6D4-DA241C71A6AE
Quán Phở Hà Nội Truyền Thống
123 Lê Thánh Tông, P. Bạch Đằng, TP. Hạ Long
Phone: (+84) 987 654 321
```

**Tables (Restaurant: Lẩu Dê Nhất Ly):**
```sql
-- AA07C586-38BB-423A-8554-1FE87348D2C1
T01 - 2 guests - Khu A Tầng trệt

-- 84A298F5-4582-4E6B-880E-5D450EF5EA09
T02 - 4 guests - Khu A Tầng trệt

-- 3B4F19B2-852F-4571-8821-8DFDDA98AFA3
T03 - 4 guests - Khu B Tầng 1

-- 74C4A3F6-A29C-4F06-9D43-B0BDF3FF637A
OUT01 - 6 guests - Khu ngoài trời Sân

-- 4ABCE72D-F331-472F-BAD0-088DEF05A8DD
VIP01 - 8 guests - Phòng VIP Tầng 2
```

**Users:**
```sql
-- Customer: 832BEBB5-D2E4-46C5-A005-C567F7CAA9F8
Phone: +84818990222
Email: test@example.com
Role: CUSTOMER

-- Customer 2: F1E452BC-1294-40CE-9973-98206DB830EC
Phone: +84818990221
Email: test12@example.com
Role: CUSTOMER

-- Restaurant Owner: C4E503D9-9B33-4C61-AA19-7EF824D55226
Phone: +84818990234
Email: new@example.com
Role: RESTAURANT_OWNER

-- Admin: 49D42587-056D-4697-853C-52E69EC9A7A9
Phone: +84000000000
Email: admin@seatnow.local
Role: ADMIN
```

### Nếu cần thêm dữ liệu test

#### 1. Thêm nhà hàng mới

```sql
INSERT INTO Restaurants (id, ownerId, name, slug, address, cuisines, priceRange, rating, reviewCount, description, status)
VALUES (
  NEWID(),
  'C4E503D9-9B33-4C61-AA19-7EF824D55226',
  'Nhà hàng test mới',
  'nha-hang-test-moi',
  '123 Test Street',
  '[]',
  2,
  4.0,
  0,
  'Nhà hàng test',
  'active'
);
```

#### 2. Thêm bàn cho nhà hàng

```sql
INSERT INTO Tables (id, restaurantId, tableNumber, capacity, type, location, status)
VALUES 
  (NEWID(), 'BA3FB828-C52C-4FBE-83E7-4F326A9892A2', 'T10', 4, 'standard', 'Tầng 2', 'available'),
  (NEWID(), 'BA3FB828-C52C-4FBE-83E7-4F326A9892A2', 'T11', 6, 'standard', 'Tầng 2', 'available');
```

---

## 🧪 Hướng dẫn test từng endpoint

### **1. Public/Guest Operations**

#### 1.1. Check Availability
**Mục đích:** Kiểm tra bàn trống trước khi đặt

```
GET {{baseUrl}}/restaurants/BA3FB828-C52C-4FBE-83E7-4F326A9892A2/availability?date=2026-02-15&time=19:00&numGuests=4
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "restaurant": {
      "id": "BA3FB828-C52C-4FBE-83E7-4F326A9892A2",
      "name": "Lẩu Dê Nhất Ly - Hạ Long"
    },
    "date": "2026-02-15",
    "time": "19:00",
    "numGuests": 4,
    "availableTables": [
      {
        "id": "84A298F5-4582-4E6B-880E-5D450EF5EA09",
        "tableNumber": "T02",
        "capacity": 4,
        "location": "Khu A - Tầng trệt"
      },
      {
        "id": "3B4F19B2-852F-4571-8821-8DFDDA98AFA3",
        "tableNumber": "T03",
        "capacity": 4,
        "location": "Khu B - Tầng 1"
      }
    ]
  }
}
```

**Test Cases:**
- ✅ Có bàn trống → return danh sách bàn
- ✅ Không có bàn → return empty array
- ✅ Cache hit (lần 2 gọi nhanh hơn)

---

#### 1.2. Create Booking (Guest)
**Mục đích:** Khách không đăng nhập tạo booking

```
POST {{baseUrl}}/bookings
Content-Type: application/json

{
  "restaurantId": "BA3FB828-C52C-4FBE-83E7-4F326A9892A2",
  "tableId": "84A298F5-4582-4E6B-880E-5D450EF5EA09",
  "bookingDate": "2026-02-15",
  "bookingTime": "19:00",
  "numGuests": 4,
  "guestName": "Nguyen Van A",
  "guestPhone": "+84901234567",
  "guestEmail": "nguyenvana@example.com",
  "notes": "Gần cửa sổ, ưu tiên khu yên tĩnh"
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "bookingCode": "BK20260215001",
    "status": "PENDING",
    "customerId": null,
    "guestName": "Nguyen Van A",
    "guestPhone": "+84901234567",
    "guestEmail": "nguyenvana@example.com",
    "restaurantId": "BA3FB828-C52C-4FBE-83E7-4F326A9892A2",
    "tableId": "84A298F5-4582-4E6B-880E-5D450EF5EA09",
    "bookingDate": "2026-02-15",
    "bookingTime": "19:00:00",
    "numGuests": 4,
    "notes": "Gần cửa sổ, ưu tiên khu yên tĩnh",
    "createdAt": "2026-02-05T10:30:00.000Z"
  }
}
```

**Test Cases:**
- ✅ Guest booking thành công
- ✅ Booking code tự động generate (format: BK + YYYYMMDD + sequence)
- ✅ customerId = null (vì là guest)
- ❌ Booking duplicate time/table → error 409
- ❌ Invalid date (quá khứ) → error 400
- ❌ Restaurant/table không tồn tại → error 404

**Lưu ý:** 
- Response trả về `bookingId` và `bookingCode` → Postman tự động save vào variables
- Guest cần lưu `bookingCode` + `phone` để tra cứu sau

---

#### 1.3. Create Booking (Customer - Authenticated)
**Mục đích:** Khách đã đăng nhập tạo booking

```
POST {{baseUrl}}/bookings
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "restaurantId": 1,
  "tableId": 2,
  "bookingDate": "2026-02-20",
  "bookingTime": "20:00",
  "numGuests": 2,
  "notes": "Anniversary dinner"
}
```

**Expected Response (201 Created):**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "bookingCode": "BK20260220001",
    "status": "PENDING",
    "customerId": 100,
    "guestName": null,
    "guestPhone": null,
    "guestEmail": null,
    "restaurantId": 1,
    "tableId": 2,
    "bookingDate": "2026-02-20",
    "bookingTime": "20:00:00",
    "numGuests": 2,
    "notes": "Anniversary dinner",
    "createdAt": "2026-02-05T10:35:00.000Z"
  }
}
```

**Test Cases:**
- ✅ Customer booking → customerId từ JWT token
- ✅ Không cần guestName/guestPhone/guestEmail
- ❌ Token invalid → 401 Unauthorized
- ❌ Token expired → 401

---

#### 1.4. Guest Lookup Booking
**Mục đích:** Guest tra cứu booking bằng code + phone

```
GET {{baseUrl}}/bookings/guest/lookup?bookingCode=BK20260215001&phone=%2B84901234567
```

Note: when calling this endpoint from a browser or constructing URLs, **always URL-encode the plus sign (`+`) as `%2B`** in the query string. If `+` is not encoded it may be decoded as a space and the lookup will fail.

Examples:

Curl (uses data-urlencode to handle `+` correctly):
```bash
curl -G --data-urlencode "bookingCode=BK20260215001" --data-urlencode "guestPhone=+84901234567" "{{baseUrl}}/bookings/guest/lookup"
```

Direct URL (manual encoding):
```
GET {{baseUrl}}/bookings/guest/lookup?bookingCode=BK20260215001&guestPhone=%2B84901234567
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": "550e8400-e29b-41d4-a716-446655440000",
    "bookingCode": "BK20260215001",
    "status": "PENDING",
    "guestName": "Nguyen Van A",
    "guestPhone": "+84901234567",
    "restaurantName": "Lẩu Dê Nhất Ly - Hạ Long",
    "tableNumber": "T02",
    "bookingDate": "2026-02-15",
    "bookingTime": "19:00:00",
    "numGuests": 4,
    "notes": "Gần cửa sổ, ưu tiên khu yên tĩnh",
    "createdAt": "2026-02-05T10:30:00.000Z"
  }
}
```

**Test Cases:**
- ✅ Lookup thành công với code + phone đúng
- ❌ Sai booking code → 404
- ❌ Sai phone number → 404
- ❌ Missing parameters → 400

---

### **2. Customer Operations**

#### 2.1. My Bookings (Customer's booking history)
**Mục đích:** Xem danh sách booking của customer đã đăng nhập

```
GET {{baseUrl}}/bookings/my-bookings?status=PENDING&sortBy=bookingDate&sortOrder=DESC&page=1&limit=10
Authorization: Bearer {{accessToken}}
```

**Query Parameters:**
- `status` (optional): PENDING, CONFIRMED, ARRIVED, COMPLETED, CANCELLED, NO_SHOW
- `sortBy` (optional): bookingDate, createdAt, bookingTime
- `sortOrder` (optional): ASC, DESC
- `page` (optional): default 1
- `limit` (optional): default 10

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": 2,
        "bookingCode": "BK20260220001",
        "status": "PENDING",
        "restaurantName": "Golden Dragon Restaurant",
        "tableNumber": "T02",
        "bookingDate": "2026-02-20",
        "bookingTime": "20:00:00",
        "numGuests": 2,
        "notes": "Anniversary dinner",
        "createdAt": "2026-02-05T10:35:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 10,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

**Test Cases:**
- ✅ Filter by status
- ✅ Pagination works
- ✅ Chỉ show booking của customer (không thấy booking người khác)
- ❌ No token → 401

---

#### 2.2. Cancel Booking (Customer)
**Mục đích:** Customer hủy booking của mình

```
PUT {{baseUrl}}/bookings/{{bookingId}}/cancel
Authorization: Bearer {{accessToken}}
Content-Type: application/json

{
  "cancellationReason": "Change of plans"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 2,
    "bookingCode": "BK20260220001",
    "status": "CANCELLED",
    "cancelledBy": 100,
    "cancellationReason": "Change of plans",
    "cancelledAt": "2026-02-05T11:00:00.000Z"
  }
}
```

**Test Cases:**
- ✅ Cancel thành công → status = CANCELLED
- ✅ cancelledBy = customerId từ token
- ✅ cancellationReason được lưu
- ✅ Socket emit event `booking:changed`
- ❌ Cancel booking của người khác → 403 Forbidden
- ❌ Cancel booking đã CANCELLED → 409 Conflict
- ❌ Cancel booking đã COMPLETED → 409

---

### **3. Restaurant Owner/Admin Operations**

#### 3.1. Get Restaurant Bookings
**Mục đích:** Owner xem tất cả booking của nhà hàng

```
GET {{baseUrl}}/restaurants/1/bookings?date=2026-02-15&status=PENDING&sortBy=bookingTime&sortOrder=ASC&page=1&limit=20
Authorization: Bearer {{accessToken}}
```

**Query Parameters:**
- `date` (optional): Filter by booking date (YYYY-MM-DD)
- `status` (optional): Filter by status
- `sortBy` (optional): bookingTime, createdAt, bookingDate
- `sortOrder` (optional): ASC, DESC
- `page`, `limit`: Pagination

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "bookings": [
      {
        "id": 1,
        "bookingCode": "BK20260215001",
        "status": "PENDING",
        "customerName": "Nguyen Van A",
        "customerPhone": "0901234567",
        "tableNumber": "T01",
        "bookingDate": "2026-02-15",
        "bookingTime": "19:00:00",
        "numGuests": 4,
        "notes": "Near window please",
        "createdAt": "2026-02-05T10:30:00.000Z"
      }
    ],
    "pagination": {
      "page": 1,
      "limit": 20,
      "total": 1,
      "totalPages": 1
    }
  }
}
```

**Test Cases:**
- ✅ Owner chỉ thấy booking của nhà hàng mình
- ✅ Admin thấy tất cả
- ✅ Filter by date chính xác
- ❌ Owner access booking nhà hàng khác → 403

---

#### 3.2. Confirm Booking
**Mục đích:** Owner xác nhận booking từ PENDING → CONFIRMED

```
PUT {{baseUrl}}/bookings/1/confirm
Authorization: Bearer {{accessToken}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "bookingCode": "BK20260215001",
    "status": "CONFIRMED",
    "confirmedAt": "2026-02-05T11:30:00.000Z"
  }
}
```

**Test Cases:**
- ✅ PENDING → CONFIRMED thành công
- ✅ confirmedAt được set
- ✅ Socket emit `booking:changed`
- ❌ Booking không phải PENDING → 409
- ❌ Không phải owner/admin → 403

---

#### 3.3. Mark as Arrived
**Mục đích:** Khách đã đến nhà hàng → CONFIRMED → ARRIVED

```
PUT {{baseUrl}}/bookings/1/arrived
Authorization: Bearer {{accessToken}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "bookingCode": "BK20260215001",
    "status": "ARRIVED",
    "arrivedAt": "2026-02-15T19:05:00.000Z"
  }
}
```

**Test Cases:**
- ✅ CONFIRMED → ARRIVED thành công
- ✅ arrivedAt được set
- ❌ Booking chưa CONFIRMED → 409

---

#### 3.4. Complete Booking
**Mục đích:** Khách ăn xong → ARRIVED → COMPLETED

```
PUT {{baseUrl}}/bookings/1/complete
Authorization: Bearer {{accessToken}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "bookingCode": "BK20260215001",
    "status": "COMPLETED",
    "completedAt": "2026-02-15T21:30:00.000Z"
  }
}
```

**Test Cases:**
- ✅ ARRIVED → COMPLETED thành công
- ✅ completedAt được set
- ❌ Booking chưa ARRIVED → 409

---

#### 3.5. Mark as No-Show
**Mục đích:** Khách không đến → CONFIRMED → NO_SHOW

```
PUT {{baseUrl}}/bookings/1/no-show
Authorization: Bearer {{accessToken}}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "bookingCode": "BK20260215001",
    "status": "NO_SHOW",
    "noShowAt": "2026-02-15T19:30:00.000Z"
  }
}
```

**Test Cases:**
- ✅ CONFIRMED → NO_SHOW thành công
- ✅ noShowAt được set
- ❌ Booking chưa CONFIRMED → 409

---

### **4. Guest Cancel Operations**

#### 4.1. Cancel Booking (Guest - No Auth)
**Mục đích:** Guest hủy booking không cần đăng nhập

```
PUT {{baseUrl}}/bookings/1/cancel/guest
Content-Type: application/json

{
  "cancellationReason": "Unable to attend"
}
```

**Expected Response:**
```json
{
  "success": true,
  "data": {
    "id": 1,
    "bookingCode": "BK20260215001",
    "status": "CANCELLED",
    "cancelledBy": null,
    "cancellationReason": "Unable to attend",
    "cancelledAt": "2026-02-05T12:00:00.000Z"
  }
}
```

**Test Cases:**
- ✅ Guest cancel thành công (không cần token)
- ✅ cancelledBy = null (vì là guest)
- ✅ cancellationReason được lưu
- ❌ Booking đã cancelled → 409

---

## 🎬 Test Scenarios (Kịch bản test end-to-end)

### Scenario 1: Guest Booking Flow (Happy Path)
**Mô tả:** Khách vãng lai đặt bàn → owner confirm → khách đến → hoàn thành

1. **Check availability**
   - GET `/restaurants/1/availability?date=2026-02-15&time=19:00&numGuests=4`
   - ✅ Có bàn T01 available

2. **Create booking (guest)**
   - POST `/bookings` (không có token)
   - Body: guestName, guestPhone, etc.
   - ✅ Nhận bookingCode = "BK20260215001"

3. **Guest lookup**
   - GET `/bookings/guest/lookup?bookingCode=BK20260215001&phone=0901234567`
   - ✅ Thấy booking PENDING

4. **Owner confirm** (cần token owner/admin)
   - PUT `/bookings/1/confirm`
   - ✅ Status → CONFIRMED

5. **Guest arrived** (owner mark)
   - PUT `/bookings/1/arrived`
   - ✅ Status → ARRIVED

6. **Complete booking** (owner mark)
   - PUT `/bookings/1/complete`
   - ✅ Status → COMPLETED

**Expected Result:**
- Booking hoàn tất qua các trạng thái: PENDING → CONFIRMED → ARRIVED → COMPLETED
- Tất cả timestamps được ghi nhận
- Socket events được emit tại mỗi bước

---

### Scenario 2: Customer Booking with Cancellation
**Mô tả:** Customer đặt bàn → tự hủy

1. **Customer login** (auth-service)
   - POST `http://localhost:3001/api/v1/auth/login`
   - ✅ Nhận accessToken

2. **Create booking (customer)**
   - POST `/bookings` với Authorization header
   - Body: không cần guestName/phone
   - ✅ customerId từ token

3. **View my bookings**
   - GET `/bookings/my-bookings`
   - ✅ Thấy booking vừa tạo

4. **Cancel booking**
   - PUT `/bookings/2/cancel` (customer endpoint)
   - Body: `{ "cancellationReason": "Change of plans" }`
   - ✅ Status → CANCELLED, cancelledBy = customerId

**Expected Result:**
- Customer có thể tạo và hủy booking của mình
- cancellationReason được lưu đầy đủ

---

### Scenario 3: Auto-Expire Job (Background)
**Mô tả:** Booking PENDING quá 15 phút → tự động hủy

1. **Create booking**
   - Tạo booking với thời gian hiện tại - 20 phút
   - Status = PENDING

2. **Wait for cron job** (chạy mỗi 5 phút)
   - Job `bookingExpire.job.js` sẽ quét

3. **Check booking status**
   - GET `/bookings/guest/lookup?bookingCode=...`
   - ✅ Status → CANCELLED
   - ✅ cancellationReason = "[AUTO_EXPIRED]"
   - ✅ cancelledBy = null

**Expected Result:**
- Job tự động hủy booking quá hạn
- Invalidate availability cache
- Emit socket event

---

### Scenario 4: No-Show Detection
**Mô tả:** Booking CONFIRMED nhưng khách không đến sau 30 phút

1. **Create and confirm booking**
   - Tạo booking với bookingTime = hiện tại - 35 phút
   - Status = CONFIRMED

2. **Wait for cron job**
   - Job sẽ quét booking quá giờ

3. **Check status**
   - ✅ Status → NO_SHOW
   - ✅ cancellationReason = "[AUTO_NO_SHOW]"

---

## 🔍 Kiểm tra Database

### Query để xem bookings
```sql
-- Xem tất cả bookings
SELECT 
    id,
    bookingCode,
    status,
    COALESCE(guestName, 'Customer #' + CAST(customerId AS NVARCHAR)) AS customerName,
    bookingDate,
    bookingTime,
    numGuests,
    cancelledBy,
    cancellationReason,
    createdAt,
    confirmedAt,
    arrivedAt,
    completedAt,
    cancelledAt
FROM Bookings
ORDER BY createdAt DESC;
```

### Query kiểm tra availability logic
```sql
-- Xem các booking đang "active" (chiếm bàn)
SELECT 
    b.id,
    b.bookingCode,
    b.status,
    b.tableId,
    t.tableNumber,
    b.bookingDate,
    b.bookingTime
FROM Bookings b
JOIN Tables t ON b.tableId = t.id
WHERE b.status IN ('PENDING', 'CONFIRMED', 'ARRIVED')
    AND b.bookingDate = '2026-02-15'
ORDER BY b.bookingTime;
```

### Query kiểm tra cancellation tracking
```sql
-- Xem các booking đã hủy
SELECT 
    id,
    bookingCode,
    status,
    cancelledBy,
    cancellationReason,
    cancelledAt,
    CASE 
        WHEN cancelledBy IS NULL AND cancellationReason LIKE '[AUTO%' THEN 'Auto-cancelled by system'
        WHEN cancelledBy IS NOT NULL THEN 'Cancelled by user #' + CAST(cancelledBy AS NVARCHAR)
        ELSE 'Guest cancelled'
    END AS cancelledType
FROM Bookings
WHERE status = 'CANCELLED'
ORDER BY cancelledAt DESC;
```

---

## 🐛 Troubleshooting

### Lỗi thường gặp

#### 1. **Connection Error (ECONNREFUSED)**
```
Error: connect ECONNREFUSED 127.0.0.1:3002
```
**Giải pháp:**
- Check service có đang chạy: `npm start`
- Check port 3002 không bị chiếm: `netstat -ano | findstr :3002`

---

#### 2. **SQL Error: Invalid column name 'notes'**
```
RequestError: Invalid column name 'notes'
```
**Giải pháp:**
- Check schema bảng Bookings có cột `notes` chưa
- Chạy lại `sql/create_bookokings.sql`

---

#### 3. **401 Unauthorized**
```json
{
  "success": false,
  "error": "Unauthorized"
}
```
**Giải pháp:**
- Check accessToken trong Collection Variables
- Token có thể đã expired → login lại để lấy token mới
- Check JWT_SECRET trong `.env` khớp với auth-service

---

#### 4. **409 Conflict - Table already booked**
```json
{
  "success": false,
  "error": "Table already booked for this time"
}
```
**Giải pháp:**
- Bàn đã có booking PENDING/CONFIRMED/ARRIVED trong khung giờ đó
- Chọn bàn khác hoặc thời gian khác
- Hoặc hủy booking cũ trước

---

#### 5. **Redis Connection Error**
```
Error: Redis connection failed
```
**Giải pháp:**
- Check Redis server đang chạy: `redis-cli ping` (response: PONG)
- Windows: start Redis server
- Service vẫn chạy được nhưng không có cache (performance giảm)

---

#### 6. **Socket not emitting events**
**Giải pháp:**
- Check `src/sockets/booking_socket.js` đã init chưa
- Check client có connect socket đúng URL: `http://localhost:3002`
- Test bằng socket.io-client:
  ```javascript
  const io = require('socket.io-client');
  const socket = io('http://localhost:3002');
  
  socket.on('connect', () => {
    console.log('Connected');
    socket.emit('booking:join', { restaurantId: 1 });
  });
  
  socket.on('booking:changed', (data) => {
    console.log('Booking changed:', data);
  });
  ```

---

## 📝 Notes

### Best Practices
1. **Luôn check availability trước khi tạo booking**
2. **Guest bookings:** Lưu bookingCode + phone để lookup sau
3. **Customer bookings:** Có thể query `/my-bookings` bất kỳ lúc nào
4. **Owner operations:** Cần role RESTAURANT_OWNER hoặc ADMIN
5. **Cancellation:** Nên có cancellationReason để audit

### Performance Tips
- Redis cache giữ availability 60 giây
- Lần query đầu chậm (hit DB), lần sau nhanh (cache)
- Invalidate cache khi booking status thay đổi

### Security Notes
- Guest cancel endpoint (`/cancel/guest`) không cần auth → có thể bị abuse
- Production nên thêm rate limiting
- Xem xét thêm verification (OTP qua SMS/email) cho guest cancel

---

## 🎯 Checklist Test đầy đủ

- [ ] Create booking (guest) - thành công
- [ ] Create booking (customer) - thành công
- [ ] Check availability - có cache
- [ ] Guest lookup - tìm được booking
- [ ] My bookings (customer) - pagination
- [ ] Confirm booking (owner) - status change
- [ ] Mark arrived - timestamp đúng
- [ ] Complete booking - flow hoàn chỉnh
- [ ] Mark no-show - status đúng
- [ ] Cancel (customer) - có cancellationReason
- [ ] Cancel (guest) - cancelledBy = null
- [ ] Auto-expire job - tự động hủy
- [ ] Socket events - emit realtime
- [ ] Error handling - 400/401/403/404/409
- [ ] Database constraints - check in DB

---

**Happy Testing! 🚀**

Nếu gặp vấn đề, check logs trong terminal hoặc query trực tiếp database để debug.

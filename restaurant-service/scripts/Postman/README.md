Hướng dẫn test bằng Postman cho SeatNow - `restaurant-service`
=============================================================

Mục đích
- Tệp collection sẵn sàng để import vào Postman hoặc chạy bằng Newman để kiểm tra các endpoint của `restaurant-service`.

Tệp
- `SeatNow_restaurant-service.postman_collection.json` (thư mục: `scripts/Postman/`)

Yêu cầu trước
- Dịch vụ đang chạy: từ thư mục gốc project chạy `npm start` (mặc định `http://localhost:3003`).
- Có Postman (GUI) hoặc Newman (CLI) nếu muốn chạy tự động.

Import vào Postman (GUI)
1. Mở Postman → Import → Upload Files → chọn `scripts/Postman/SeatNow_restaurant-service.postman_collection.json`.
2. Sau khi import, mở collection. Bạn có thể chỉnh biến collection ở phần "Variables" hoặc tạo Environment.

Biến quan trọng (collection-level)
- `baseUrl`: URL dịch vụ (mặc định `http://localhost:3003`).
- `token`: JWT cho các endpoint cần xác thực (để trống với các endpoint public).
- `restaurantId`, `itemId`, `tableId`: các id mẫu để test (thay bằng id thật nếu cần).

Kiểm tra từng endpoint (tóm tắt)
- Health
	- Method: GET
	- URL: `{{baseUrl}}/health`
	- Auth: none
	- Kỳ vọng: 200 và { ok: true }

- List Restaurants
	- Method: GET
	- URL: `{{baseUrl}}/api/v1/restaurants?limit=2`
	- Auth: optional

- Get Restaurant
	- Method: GET
	- URL: `{{baseUrl}}/api/v1/restaurants/{{restaurantId}}`

- Menu: Get/Create/Update/Delete
	- GET `/api/v1/restaurants/{{restaurantId}}/menu` (public)
	- POST `/api/v1/restaurants/{{restaurantId}}/menu` (Auth: `RESTAURANT_OWNER`/`ADMIN`) — Body JSON ví dụ: { "name":"Pho","price":50000 }
	- PUT `/api/v1/restaurants/{{restaurantId}}/menu/{{itemId}}` (Auth)
	- DELETE `/api/v1/restaurants/{{restaurantId}}/menu/{{itemId}}` (Auth)

- Reviews: List/Create
	- GET `/api/v1/restaurants/{{restaurantId}}/reviews` (public)
	- POST `/api/v1/restaurants/{{restaurantId}}/reviews` (Auth: `CUSTOMER`/`ADMIN`) — Body ví dụ: { "rating":5, "comment":"Excellent" }

- Tables: List/Create/Update/Delete (Auth: `RESTAURANT_OWNER`/`ADMIN`)
	- GET `/api/v1/restaurants/{{restaurantId}}/tables`
	- POST `/api/v1/restaurants/{{restaurantId}}/tables` — Body: { "name":"Table 1","seats":4 }
	- PUT `/api/v1/restaurants/{{restaurantId}}/tables/{{tableId}}`
	- DELETE `/api/v1/restaurants/{{restaurantId}}/tables/{{tableId}}`

- Restaurant CRUD (Auth: `RESTAURANT_OWNER`/`ADMIN`)
	- POST `/api/v1/restaurants` — Body ví dụ: { "name":"Test Restaurant","address":"123" }
	- PUT `/api/v1/restaurants/{{restaurantId}}`
	- PUT `/api/v1/restaurants/{{restaurantId}}/deposit-policy` — Body ví dụ: { "required": true, "amount": 100000 }
	- DELETE `/api/v1/restaurants/{{restaurantId}}` (soft-delete)

- Availability (placeholder)
	- GET `/api/v1/restaurants/{{restaurantId}}/availability` → trả 501 (chưa triển khai)

Chạy collection bằng Newman
1. Cài Newman (nếu cần):

```bash
npm install -g newman
```

2. Chạy:

```bash
newman run scripts/Postman/SeatNow_restaurant-service.postman_collection.json --env-var "baseUrl=http://localhost:3003" --env-var "token=YOUR_TOKEN"
```

Ghi chú
- Đặt `token` bằng JWT trị thực (collection dùng header `Authorization: Bearer {{token}}`).
- Một số endpoint trong codebase là placeholder và có thể trả 404 hoặc 501.

Muốn mình tạo sẵn token test cho role cụ thể (`CUSTOMER`, `RESTAURANT_OWNER`, `ADMIN`), hoặc thêm ví dụ body cho từng request trong collection không? Trả lời role bạn cần và mình sẽ sinh token mẫu hoặc thêm script nhỏ.


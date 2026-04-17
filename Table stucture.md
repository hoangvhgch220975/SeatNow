## Cấu trúc bảng:

## Bảng Users:SELECT TOP (1000) [id]

      ,[phone]
      ,[email]
      ,[name]
      ,[password]
      ,[role]
      ,[avatar]
      ,[loyaltyPoints]
      ,[createdAt]
      ,[updatedAt]

FROM [SeatNow].[dbo].[Users]

## Bảng Restaurants:

SELECT TOP (1000) [id]
,[ownerId]
,[name]
,[slug]
,[address]
,[latitude]
,[longitude]
,[phone]
,[email]
,[cuisineTypeJson]
,[priceRange]
,[ratingAvg]
,[ratingCount]
,[description]
,[imagesJson]
,[openingHoursJson]
,[depositEnabled]
,[depositPolicyJson]
,[commissionRate]
,[status]
,[suspendedBy]
,[isPremium]
,[createdAt]
,[updatedAt]
FROM [SeatNow].[dbo].[Restaurants]

## Bảng Tables:

    SELECT TOP (1000) [id]
      ,[restaurantId]
      ,[tableNumber]
      ,[capacity]
      ,[type]
      ,[location]
      ,[status]
      ,[createdAt]
      ,[updatedAt]

FROM [SeatNow].[dbo].[Tables]

## Bảng Bookings:

SELECT TOP (1000) [id]
,[bookingCode]
,[customerId]
,[restaurantId]
,[tableId]
,[bookingDate]
,[bookingTime]
,[numGuests]
,[status]
,[specialRequests]
,[depositRequired]
,[depositAmount]
,[depositPaid]
,[depositPaidAt]
,[depositRefunded]
,[commissionFee]
,[commissionPaid]
,[confirmedAt]
,[arrivedAt]
,[completedAt]
,[cancelledAt]
,[createdAt]
,[updatedAt]
,[guestName]
,[guestPhone]
,[guestEmail]
,[cancelledBy]
,[cancellationReason]
FROM [SeatNow].[dbo].[Bookings]

## Bảng Wallet:

SELECT TOP (1000) [id]
,[userId]
,[restaurantId]
,[balance]
,[lockedAmount]
,[createdAt]
,[updatedAt]
,[currency]
,[status]
FROM [SeatNow].[dbo].[Wallets]

## Bảng Transactions:

SELECT TOP (1000) [id]
,[walletId]
,[bookingId]
,[type]
,[amount]
,[balanceBefore]
,[balanceAfter]
,[description]
,[paymentMethod]
,[referenceCode]
,[status]
,[createdAt]
,[payerType]
,[provider]
,[providerTxnId]
,[idempotencyKey]
,[metadataJson]
,[completedAt]
,[failedAt]
,[currency]
FROM [SeatNow].[dbo].[Transactions]

## Bảng Notifications:

SELECT TOP (1000) [id]
,[ownerId]
,[restaurantId]
,[type]
,[title]
,[message]
,[metadata]
,[isRead]
,[createdAt]
FROM [SeatNow].[dbo].[Notifications]

## Collections MongoDB:

## reviews:

```json
{
  "_id": {
    "$oid": "697ddabe13a4386ef0d3c761"
  },
  "bookingId": "BK-2025-12-15-001",
  "customerId": "832BEBB5-D2E4-46C5-A005-C567F7CAA9F8",
  "restaurantId": "BA3FB828-C52C-4FBE-83E7-4F326A9892A2",
  "rating": 5,
  "comment": "Lẩu dê rất ngon, thịt dê tươi và mềm. Nhân viên phục vụ nhiệt tình, chu đáo. Không gian rộng rãi, thoáng mát. Sẽ quay lại lần sau cùng gia đình!",
  "images": [
    "https://pasgo.vn/Upload/anh-chi-tiet/slide-lau-de-nhat-ly-1-normal-3635416071181.webp"
  ],
  "foodRating": 5,
  "serviceRating": 5,
  "atmosphereRating": 4,
  "isVerified": true,
  "helpful": 12,
  "createdAt": "2025-12-15T19:30:00.000Z"
}
```

## menuitems:

```json
{
  "_id": {
    "$oid": "697ddaa613a4386ef0d3c755"
  },
  "restaurantId": "BA3FB828-C52C-4FBE-83E7-4F326A9892A2",
  "name": "Dê Ướp Nướng",
  "description": "Thịt dê tươi được ướp với gia vị đặc biệt, nướng trên than hồng",
  "price": 189000,
  "discountPrice": null,
  "category": "Món Nướng",
  "images": [
    "https://cdn.pastaxi-manager.onepas.vn/Content/Uploads/Prices/lẩu%20dê%20nhất%20ly/de-nuong-1.jpg",
    "https://cdn.pastaxi-manager.onepas.vn/Content/Uploads/Prices/lẩu%20dê%20nhất%20ly/de-nuong-2.jpg"
  ],
  "isAvailable": true,
  "preparationTime": 25,
  "tags": ["signature", "spicy", "grilled"],
  "allergens": ["garlic"],
  "createdAt": "2024-01-15T10:00:00.000Z",
  "updatedAt": "2026-01-31T10:00:00.000Z"
}
```

## Constraint:

Bookings CK_Booking_Customer_Or_Guest CHECK
Bookings CK_Bookings_customer_or_guest CHECK
Bookings CK_Bookings_status CHECK
Bookings CK_Bookings_CustomerOrGuest CHECK
Bookings CK_Bookings_NumGuests CHECK
Bookings CK_Bookings_DepositAmount CHECK
Bookings CK_Bookings_CommissionFee CHECK
Bookings PK_Bookings PRIMARY KEY
Bookings UQ_Bookings_bookingCode UNIQUE
Bookings FK_Bookings_customer FOREIGN KEY
Bookings FK_Bookings_restaurant FOREIGN KEY
Bookings FK_Bookings_table FOREIGN KEY
Restaurants PK_Restaurants PRIMARY KEY
Restaurants UQ_Restaurants_slug UNIQUE
Restaurants FK_Restaurants_owner FOREIGN KEY
Restaurants CK_Restaurants_priceRange CHECK
Restaurants CK_Restaurants_status CHECK
Tables PK_Tables PRIMARY KEY
Tables FK_Tables_restaurant FOREIGN KEY
Tables CK_Tables_status CHECK
Tables CK_Tables_location CHECK
Transactions CK_Transactions_type CHECK
Transactions CK_Transactions_Amount CHECK
Transactions CK_Transactions_Currency CHECK
Transactions CK_Transactions_PayerType CHECK
Transactions CK_Transactions_Provider CHECK
Transactions PK_Transactions PRIMARY KEY
Transactions FK_Transactions_wallet FOREIGN KEY
Transactions FK_Transactions_booking FOREIGN KEY
Transactions CK_Transactions_status CHECK
Users PK**Users**3213E83F97F0F9B5 PRIMARY KEY
Users UQ**Users**AB6E6164CCA1F461 UNIQUE
Users UQ**Users**B43B145FB44FBB8D UNIQUE
Users CK**Users**role\_\_4CA06362 CHECK
Wallets PK_Wallets PRIMARY KEY
Wallets FK_Wallets_user FOREIGN KEY
Wallets CK_Wallets_Currency CHECK
Wallets CK_Wallets_Status CHECK
Wallets CK_Wallets_Owner CHECK
Wallets FK_Wallets_restaurant FOREIGN KEY
Notifications PK_Notifications PRIMARY KEY
Notifications CK_Notifications_type CHECK

## Detail:

Bookings FK_Bookings_customer customerId
Bookings FK_Bookings_restaurant restaurantId
Bookings FK_Bookings_table tableId
Bookings PK_Bookings id
Bookings UQ_Bookings_bookingCode bookingCode
Restaurants UQ_Restaurants_slug slug
Restaurants PK_Restaurants id
Restaurants FK_Restaurants_owner ownerId
Tables FK_Tables_restaurant restaurantId
Tables PK_Tables id
Transactions PK_Transactions id
Transactions FK_Transactions_booking bookingId
Transactions FK_Transactions_wallet walletId
Users UQ**Users**AB6E6164CCA1F461 email
Users UQ**Users**B43B145FB44FBB8D phone
Users PK**Users**3213E83F97F0F9B5 id
Wallets PK_Wallets id
Wallets FK_Wallets_restaurant restaurantId
Wallets FK_Wallets_user userId

## Index:

Bookings IX_Bookings_BookingCode NONCLUSTERED bookingCode
Bookings IX_Bookings_BookingDate NONCLUSTERED bookingDate
Bookings IX_Bookings_customerId NONCLUSTERED customerId
Bookings IX_Bookings_GuestEmail NONCLUSTERED guestEmail
Bookings IX_Bookings_GuestPhone NONCLUSTERED guestPhone
Bookings IX_Bookings_Restaurant_Date_Time NONCLUSTERED restaurantId
Bookings IX_Bookings_Restaurant_Date_Time NONCLUSTERED bookingDate
Bookings IX_Bookings_Restaurant_Date_Time NONCLUSTERED bookingTime
Bookings IX_Bookings_restaurantId NONCLUSTERED restaurantId
Bookings IX_Bookings_slot NONCLUSTERED restaurantId
Bookings IX_Bookings_slot NONCLUSTERED bookingDate
Bookings IX_Bookings_slot NONCLUSTERED bookingTime
Bookings IX_Bookings_Status NONCLUSTERED status
Bookings IX_Bookings_TableId NONCLUSTERED tableId
Bookings UQ_Bookings_bookingCode NONCLUSTERED bookingCode
Bookings UX_Bookings_table_slot_active NONCLUSTERED tableId
Bookings UX_Bookings_table_slot_active NONCLUSTERED bookingDate
Bookings UX_Bookings_table_slot_active NONCLUSTERED bookingTime
Restaurants IX_Restaurants_ownerId NONCLUSTERED ownerId
Restaurants UQ_Restaurants_slug NONCLUSTERED slug
Tables IX_Tables_restaurantId NONCLUSTERED restaurantId
Transactions IX_Transactions_BookingId NONCLUSTERED bookingId
Transactions IX_Transactions_BookingId_Type_Status NONCLUSTERED bookingId
Transactions IX_Transactions_BookingId_Type_Status NONCLUSTERED type
Transactions IX_Transactions_BookingId_Type_Status NONCLUSTERED status
Transactions IX_Transactions_ProviderTxnId NONCLUSTERED providerTxnId
Transactions IX_Transactions_Status NONCLUSTERED status
Transactions IX_Transactions_walletId NONCLUSTERED walletId
Transactions UQ_Transactions_ReferenceCode NONCLUSTERED referenceCode
Users UQ**Users**AB6E6164CCA1F461 NONCLUSTERED email
Users UQ**Users**B43B145FB44FBB8D NONCLUSTERED phone
Wallets UQ_Wallets_RestaurantId NONCLUSTERED restaurantId
Wallets UQ_Wallets_UserOnly NONCLUSTERED userId
Notifications IX_Notifications_ownerId NONCLUSTERED ownerId

## Contraints Values:

- **Transactions.type**: `'DEPOSIT_PAYMENT'`, `'TOP_UP'`, `'COMMISSION'`, `'REFUND'`, `'WITHDRAWAL'`, `'SETTLEMENT'`
- **Transactions.status**: `'pending'`, `'completed'`, `'failed'`
- **Wallets.owner**: `(userId IS NOT NULL AND restaurantId IS NULL) OR (userId IS NULL AND restaurantId IS NOT NULL)`
- **Tables.type**: `'standard'`, `'vip'`, `'outdoor'`
- **Tables.status**: `'available'`, `'unavailable'`, `'maintenance'`
- **Tables.location**: `'1st Floor'`, `'2nd Floor'`, `'3rd Floor'`, `'4th Floor'`, `'5th Floor'`, `'Rooftop'`, `'Terrace'`, `'Outdoor'`
- **Restaurants.priceRange**: `BETWEEN 1 AND 4`
- **Restaurants.status**: `'pending'`, `'active'`, `'suspended'`
- **Users.role**: `'CUSTOMER'`, `'RESTAURANT_OWNER'`, `'ADMIN'`
- **Bookings.status**: `'PENDING'`, `'CONFIRMED'`, `'ARRIVED'`, `'COMPLETED'`, `'CANCELLED'`, `'NO_SHOW'`
- **Notifications.type**: `'BOOKING_NEW'`, `'BOOKING_CONFIRMED'`, `'BOOKING_CANCELLED'`, `'BOOKING_NO_SHOW'`, `'TRANSACTION_DEPOSIT'`, `'TRANSACTION_TOPUP'`, `'TRANSACTION_WITHDRAW_APPROVED'`, `'REVIEW_NEW'`, `'COMMISSION_SETTLED'`, `'ADMIN_BROADCAST'`

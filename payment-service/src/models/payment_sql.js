// payment_sql.js
// Muc dich: cac ham truy van SQL phuc vu quy trinh dat coc, cap nhat giao dich
// va dong bo trang thai thanh toan voi ban ghi Booking/Transaction trong MSSQL.

const { sql, getPool } = require('../config/db');

// Lay thong tin booking can thanh toan dat coc theo bookingId.
async function findBookingForDeposit(bookingId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('bookingId', sql.UniqueIdentifier, bookingId)
    .query(`
      SELECT TOP 1
        id,
        bookingCode,
        customerId,
        guestName,
        guestPhone,
        guestEmail,
        restaurantId,
        bookingDate,
        bookingTime,
        status,
        depositRequired,
        depositAmount,
        depositPaid,
        depositPaidAt
      FROM dbo.Bookings
      WHERE id = @bookingId
    `);

  return rs.recordset[0] || null;
}

// Kiem tra booking da co giao dich dat coc hoan tat truoc do hay chua.
async function findCompletedDepositByBookingId(bookingId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('bookingId', sql.UniqueIdentifier, bookingId)
    .query(`
      SELECT TOP 1 *
      FROM dbo.Transactions
      WHERE bookingId = @bookingId
        AND type = 'DEPOSIT_PAYMENT'
        AND status = 'completed'
      ORDER BY createdAt DESC
    `);

  return rs.recordset[0] || null;
}

// Kiem tra booking da co giao dich dat coc dang pending hay chua.
async function findPendingDepositByBookingId(bookingId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('bookingId', sql.UniqueIdentifier, bookingId)
    .query(`
      SELECT TOP 1 *
      FROM dbo.Transactions
      WHERE bookingId = @bookingId
        AND type = 'DEPOSIT_PAYMENT'
        AND status = 'pending'
      ORDER BY createdAt DESC
    `);

  return rs.recordset[0] || null;
}

// Tao giao dich dat coc moi o trang thai pending de cho xu ly thanh toan.
async function createPendingDepositTransaction(data) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('bookingId', sql.UniqueIdentifier, data.bookingId)
    .input('type', sql.NVarChar(30), 'DEPOSIT_PAYMENT')
    .input('amount', sql.Decimal(18, 2), data.amount)
    .input('currency', sql.NVarChar(10), data.currency)
    .input('paymentMethod', sql.NVarChar(50), data.paymentMethod)
    .input('referenceCode', sql.NVarChar(100), data.referenceCode)
    .input('status', sql.NVarChar(20), 'pending')
    .input('payerType', sql.NVarChar(30), data.payerType)
    .input('provider', sql.NVarChar(30), data.provider)
    .input('description', sql.NVarChar(sql.MAX), data.description)
    .input('idempotencyKey', sql.NVarChar(100), data.idempotencyKey || null)
    .query(`
      INSERT INTO dbo.Transactions (
        bookingId, type, amount, currency, paymentMethod,
        referenceCode, status, payerType, provider,
        description, idempotencyKey, createdAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @bookingId, @type, @amount, @currency, @paymentMethod,
        @referenceCode, @status, @payerType, @provider,
        @description, @idempotencyKey, SYSUTCDATETIME()
      )
    `);

  return rs.recordset[0];
}

// Tim vi theo restaurantId.
async function findWalletByRestaurantId(restaurantId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query(`
      SELECT TOP 1 *
      FROM dbo.Wallets
      WHERE restaurantId = @restaurantId
    `);

  return rs.recordset[0] || null;
}

// Tim vi admin theo userId (vi khong gan restaurant).
async function findWalletByUserId(userId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('userId', sql.UniqueIdentifier, userId)
    .query(`
      SELECT TOP 1 *
      FROM dbo.Wallets
      WHERE userId = @userId
        AND restaurantId IS NULL
    `);

  return rs.recordset[0] || null;
}

// Lay lich su giao dich theo wallet (ho tro loc theo type).
async function getWalletTransactions(walletId, type = null) {
  const pool = await getPool();
  const req = pool.request();
  req.input('walletId', sql.UniqueIdentifier, walletId);
  
  let query = `
    SELECT *
    FROM dbo.Transactions
    WHERE walletId = @walletId
  `;

  if (type) {
    req.input('type', sql.NVarChar(50), type);
    query += ' AND type = @type ';
  }

  query += ' ORDER BY createdAt DESC ';

  const rs = await req.query(query);
  return rs.recordset;
}

// Kiem tra vi da co top-up pending de chan click doi tao giao dich trung.
async function findPendingTopupByWalletId(walletId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('walletId', sql.UniqueIdentifier, walletId)
    .query(`
      SELECT TOP 1 *
      FROM dbo.Transactions
      WHERE walletId = @walletId
        AND type = 'TOP_UP'
        AND status = 'pending'
      ORDER BY createdAt DESC
    `);

  return rs.recordset[0] || null;
}

// Tao pending transaction cho top-up vi restaurant.
async function createPendingWalletTopupTransaction({
  walletId,
  amount,
  currency,
  paymentMethod,
  referenceCode,
  provider,
  description,
  idempotencyKey
}) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('walletId', sql.UniqueIdentifier, walletId)
    .input('type', sql.NVarChar(30), 'TOP_UP')
    .input('amount', sql.Decimal(18, 2), amount)
    .input('currency', sql.NVarChar(10), currency)
    .input('paymentMethod', sql.NVarChar(50), paymentMethod)
    .input('referenceCode', sql.NVarChar(100), referenceCode)
    .input('status', sql.NVarChar(20), 'pending')
    .input('payerType', sql.NVarChar(30), 'RESTAURANT')
    .input('provider', sql.NVarChar(30), provider)
    .input('description', sql.NVarChar(sql.MAX), description || null)
    .input('idempotencyKey', sql.NVarChar(100), idempotencyKey || null)
    .query(`
      INSERT INTO dbo.Transactions (
        walletId, type, amount, currency, paymentMethod,
        referenceCode, status, payerType, provider,
        description, idempotencyKey, createdAt
      )
      OUTPUT INSERTED.*
      VALUES (
        @walletId, @type, @amount, @currency, @paymentMethod,
        @referenceCode, @status, @payerType, @provider,
        @description, @idempotencyKey, SYSUTCDATETIME()
      )
    `);

  return rs.recordset[0];
}

// Hoan tat TOP_UP va cong so du vi an toan trong transaction SQL.
async function completeWalletTopupTransactionAndIncreaseBalance({
  referenceCode,
  providerTxnId,
  metadataJson
}) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const req = new sql.Request(tx);

    const txRes = await req
      .input('referenceCode', sql.NVarChar(100), referenceCode)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Transactions WITH (UPDLOCK, ROWLOCK)
        WHERE referenceCode = @referenceCode
      `);

    const row = txRes.recordset[0];
    if (!row) throw new Error('Transaction not found');

    if (row.status === 'completed') {
      await tx.commit();
      return { alreadyCompleted: true };
    }

    const walletRes = await req
      .input('walletId', sql.UniqueIdentifier, row.walletId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Wallets WITH (UPDLOCK, ROWLOCK)
        WHERE id = @walletId
      `);

    const wallet = walletRes.recordset[0];
    if (!wallet) throw new Error('Wallet not found');

    const balanceBefore = Number(wallet.balance);
    const balanceAfter = balanceBefore + Number(row.amount);

    await req
      .input('walletId2', sql.UniqueIdentifier, wallet.id)
      .input('balanceAfter', sql.Decimal(18, 2), balanceAfter)
      .query(`
        UPDATE dbo.Wallets
        SET balance = @balanceAfter,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @walletId2
      `);

    await req
      .input('txId', sql.UniqueIdentifier, row.id)
      .input('providerTxnId', sql.NVarChar(100), providerTxnId || null)
      .input('metadataJson', sql.NVarChar(sql.MAX), metadataJson || null)
      .input('balanceBefore', sql.Decimal(18, 2), balanceBefore)
      .input('balanceAfter2', sql.Decimal(18, 2), balanceAfter)
      .query(`
        UPDATE dbo.Transactions
        SET status = 'completed',
            providerTxnId = @providerTxnId,
            metadataJson = @metadataJson,
            balanceBefore = @balanceBefore,
            balanceAfter = @balanceAfter2,
            completedAt = SYSUTCDATETIME()
        WHERE id = @txId
      `);

    await tx.commit();
    return { success: true };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// Internal transfer: tru commission tu vi restaurant sang vi admin.
async function chargeCommissionFromRestaurantToAdmin({
  restaurantWalletId,
  adminWalletId,
  amount,
  currency,
  description,
  referenceCode,
  idempotencyKey
}) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const req = new sql.Request(tx);

    const restaurantWalletRes = await req
      .input('restaurantWalletId', sql.UniqueIdentifier, restaurantWalletId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Wallets WITH (UPDLOCK, ROWLOCK)
        WHERE id = @restaurantWalletId
      `);

    const adminWalletRes = await req
      .input('adminWalletId', sql.UniqueIdentifier, adminWalletId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Wallets WITH (UPDLOCK, ROWLOCK)
        WHERE id = @adminWalletId
      `);

    const restaurantWallet = restaurantWalletRes.recordset[0];
    const adminWallet = adminWalletRes.recordset[0];

    if (!restaurantWallet) throw new Error('Restaurant wallet not found');
    if (!adminWallet) throw new Error('Admin wallet not found');

    const restaurantBalance = Number(restaurantWallet.balance); // Doanh thu thuan - khong doi
    const lockedBefore = Number(restaurantWallet.lockedAmount || 0);
    
    if (lockedBefore < Number(amount)) {
      throw new Error('Insufficient locked balance for commission');
    }

    const adminBefore = Number(adminWallet.balance);
    const lockedAfter = lockedBefore - Number(amount);
    const adminAfter = adminBefore + Number(amount);

    await req
      .input('restaurantWalletId2', sql.UniqueIdentifier, restaurantWallet.id)
      .input('lockedAfter', sql.Decimal(18, 2), lockedAfter)
      .query(`
        UPDATE dbo.Wallets
        SET lockedAmount = @lockedAfter,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @restaurantWalletId2
      `);

    await req
      .input('adminWalletId2', sql.UniqueIdentifier, adminWallet.id)
      .input('adminAfter', sql.Decimal(18, 2), adminAfter)
      .query(`
        UPDATE dbo.Wallets
        SET balance = @adminAfter,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @adminWalletId2
      `);

    await req
      .input('rwId', sql.UniqueIdentifier, restaurantWallet.id)
      .input('amount1', sql.Decimal(18, 2), amount)
      .input('currency1', sql.NVarChar(10), currency)
      .input('ref1', sql.NVarChar(100), `${referenceCode}-D`)
      .input('idempotencyKey1', sql.NVarChar(100), idempotencyKey || null)
      .input('desc1', sql.NVarChar(sql.MAX), `${description || 'Commission charged from restaurant wallet'} (Deducted from LockedAmount)`)
      .input('rbf', sql.Decimal(18, 2), restaurantBalance)
      .input('raf', sql.Decimal(18, 2), restaurantBalance)
      .query(`
        INSERT INTO dbo.Transactions (
          walletId, type, amount, currency, balanceBefore, balanceAfter,
          description, paymentMethod, referenceCode, status, payerType, provider, idempotencyKey, createdAt, completedAt
        )
        VALUES (
          @rwId, 'COMMISSION', @amount1, @currency1, @rbf, @raf,
          @desc1, 'INTERNAL_WALLET', @ref1, 'completed', 'RESTAURANT', 'INTERNAL', @idempotencyKey1,
          SYSUTCDATETIME(), SYSUTCDATETIME()
        )
      `);

    await req
      .input('awId', sql.UniqueIdentifier, adminWallet.id)
      .input('amount2', sql.Decimal(18, 2), amount)
      .input('currency2', sql.NVarChar(10), currency)
      .input('ref2', sql.NVarChar(100), `${referenceCode}-C`)
      .input('idempotencyKey2', sql.NVarChar(100), idempotencyKey || null)
      .input('desc2', sql.NVarChar(sql.MAX), description || 'Commission received by admin wallet')
      .input('abf', sql.Decimal(18, 2), adminBefore)
      .input('aaf', sql.Decimal(18, 2), adminAfter)
      .query(`
        INSERT INTO dbo.Transactions (
          walletId, type, amount, currency, balanceBefore, balanceAfter,
          description, paymentMethod, referenceCode, status, payerType, provider, idempotencyKey, createdAt, completedAt
        )
        VALUES (
          @awId, 'SETTLEMENT', @amount2, @currency2, @abf, @aaf,
          @desc2, 'INTERNAL_WALLET', @ref2, 'completed', 'ADMIN', 'INTERNAL', @idempotencyKey2,
          SYSUTCDATETIME(), SYSUTCDATETIME()
        )
      `);

    await tx.commit();
    return {
      success: true,
      restaurantLockedAfter: lockedAfter,
      adminBalanceAfter: adminAfter
    };
  } catch (err) {
    if (tx && !tx._aborted && !tx._rolledBack) {
      try { await tx.rollback(); } catch (e) { /* ignore */ }
    }
    throw err;
  }
}

async function findTransactionByIdempotencyKey(idempotencyKey) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('idempotencyKey', sql.NVarChar(100), idempotencyKey)
    .query(`
      SELECT TOP 1 *
      FROM dbo.Transactions
      WHERE idempotencyKey = @idempotencyKey
      ORDER BY createdAt DESC
    `);

  return rs.recordset[0] || null;
}

// Tim giao dich theo id noi bo.
async function findTransactionById(id) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`SELECT TOP 1 * FROM dbo.Transactions WHERE id = @id`);
  return rs.recordset[0] || null;
}

// Tim giao dich theo ma tham chieu gui sang cong thanh toan.
async function findTransactionByReferenceCode(referenceCode) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('referenceCode', sql.NVarChar(100), referenceCode)
    .query(`SELECT TOP 1 * FROM dbo.Transactions WHERE referenceCode = @referenceCode`);
  return rs.recordset[0] || null;
}

// Hoan tat giao dich dat coc va xac nhan booking trong mot transaction SQL.
async function completeDepositTransaction({ referenceCode, providerTxnId, metadataJson }) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const req = new sql.Request(tx);

    const txRes = await req
      .input('referenceCode', sql.NVarChar(100), referenceCode)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Transactions WITH (UPDLOCK, ROWLOCK)
        WHERE referenceCode = @referenceCode
      `);

    const row = txRes.recordset[0];
    if (!row) throw new Error('Transaction not found');

    if (row.status === 'completed') {
      await tx.commit();
      return { alreadyCompleted: true };
    }

    // Lấy thông tin booking
    const bookingRes = await req
      .input('bookingId', sql.UniqueIdentifier, row.bookingId)
      .query(`
        SELECT TOP 1 * 
        FROM dbo.Bookings WITH (UPDLOCK, ROWLOCK)
        WHERE id = @bookingId
      `);
      
    const booking = bookingRes.recordset[0];
    if (!booking) throw new Error('Booking not found');

    // Chinh sua: Khong cong tien vao vi ngay lap tuc. 
    // Chi cap nhat trang thai transaction va booking.
    await req
      .input('txId', sql.UniqueIdentifier, row.id)
      .input('providerTxnId', sql.NVarChar(100), providerTxnId || null)
      .input('metadataJson', sql.NVarChar(sql.MAX), metadataJson || null)
      .query(`
        UPDATE dbo.Transactions
        SET status = 'completed',
            providerTxnId = @providerTxnId,
            metadataJson = @metadataJson,
            completedAt = SYSUTCDATETIME()
        WHERE id = @txId
      `);

    await req
      .query(`
        UPDATE dbo.Bookings
        SET depositPaid = 1,
            depositPaidAt = SYSUTCDATETIME(),
            updatedAt = SYSUTCDATETIME()
        WHERE id = @bookingId
          AND status = 'PENDING'
      `);

    await tx.commit();
    return { success: true, bookingId: row.bookingId };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// Giai ngan tien coc vao vi nha hang (chi chay khi don hang thanh cong hoac khach huy sai quy dinh)
async function settleDepositToWallet(bookingId) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const req = new sql.Request(tx);

    // 1. Kiem tra booking
    const bRes = await req
      .input('bookingId', sql.UniqueIdentifier, bookingId)
      .query(`
        SELECT TOP 1 * 
        FROM dbo.Bookings WITH (UPDLOCK, ROWLOCK)
        WHERE id = @bookingId
      `);
    const booking = bRes.recordset[0];
    if (!booking) throw new Error('Booking not found');
    if (!booking.depositPaid) throw new Error('Deposit not paid yet');
    if (booking.isSettledToWallet) {
      await tx.commit();
      return { alreadySettled: true };
    }

    // 2. Lay transaction deposit tuong ung
    const txRes = await req
      .input('bookingId2', sql.UniqueIdentifier, bookingId)
      .query(`
        SELECT TOP 1 * 
        FROM dbo.Transactions 
        WHERE bookingId = @bookingId2 AND type = 'DEPOSIT_PAYMENT' AND status = 'completed'
      `);
    const origTx = txRes.recordset[0];
    if (!origTx) throw new Error('Deposit transaction not found');

    // 3. Lay vi nha hang
    const walletRes = await req
      .input('restaurantId', sql.UniqueIdentifier, booking.restaurantId)
      .query(`
        SELECT TOP 1 * 
        FROM dbo.Wallets WITH (UPDLOCK, ROWLOCK)
        WHERE restaurantId = @restaurantId
      `);
    const wallet = walletRes.recordset[0];
    if (!wallet) throw new Error('Restaurant wallet not found');

    const depositAmount = Number(origTx.amount);
    const commissionFee = Number(booking.commissionFee || 0);

    const balanceBefore = Number(wallet.balance);
    const lockedBefore = Number(wallet.lockedAmount || 0);

    // Phần tiền nhà hàng nhận được (Net Revenue)
    const netAmount = depositAmount - commissionFee;
    const balanceAfter = balanceBefore + netAmount;
    
    // Phần tiền phí hoa hồng "giữ hộ" Admin
    const lockedAfter = lockedBefore + commissionFee;

    // 4. Cap nhat vi
    await req
      .input('walletId', sql.UniqueIdentifier, wallet.id)
      .input('balanceAfter', sql.Decimal(18, 2), balanceAfter)
      .input('lockedAfter', sql.Decimal(18, 2), lockedAfter)
      .query(`
        UPDATE dbo.Wallets 
        SET balance = @balanceAfter, 
            lockedAmount = @lockedAfter,
            updatedAt = SYSUTCDATETIME() 
        WHERE id = @walletId
      `);

    // 5. Tao transaction SETTLEMENT ghi nhận việc giải ngân tiền cọc
    const refCode = `SETTLE-${booking.bookingCode}`;
    await req
      .input('wId', sql.UniqueIdentifier, wallet.id)
      .input('bId', sql.UniqueIdentifier, bookingId)
      .input('amt', sql.Decimal(18, 2), depositAmount)
      .input('cur', sql.NVarChar(10), booking.currency || 'VND')
      .input('desc', sql.NVarChar(sql.MAX), `Settlement of deposit for booking ${booking.bookingCode}`)
      .input('ref', sql.NVarChar(100), refCode)
      .input('bb', sql.Decimal(18, 2), balanceBefore)
      .input('ba', sql.Decimal(18, 2), balanceAfter)
      .query(`
        INSERT INTO dbo.Transactions (
          walletId, bookingId, type, amount, currency, balanceBefore, balanceAfter,
          description, paymentMethod, referenceCode, status, payerType, provider, createdAt, completedAt
        ) VALUES (
          @wId, @bId, 'SETTLEMENT', @amt, @cur, @bb, @ba,
          @desc, 'INTERNAL_WALLET', @ref, 'completed', 'ADMIN', 'INTERNAL', SYSUTCDATETIME(), SYSUTCDATETIME()
        )
      `);

    // 6. Danh dau booking da giai ngan
    await req.query(`UPDATE dbo.Bookings SET isSettledToWallet = 1, updatedAt = SYSUTCDATETIME() WHERE id = @bookingId`);

    await tx.commit();
    return { success: true, balanceAfter };
  } catch (err) {
    if (tx) await tx.rollback();
    throw err;
  }
}

// Danh dau giao dich that bai khi cong thanh toan tra ket qua loi.
async function failTransaction({ referenceCode, providerTxnId, metadataJson }) {
  const pool = await getPool();
  await pool.request()
    .input('referenceCode', sql.NVarChar(100), referenceCode)
    .input('providerTxnId', sql.NVarChar(100), providerTxnId || null)
    .input('metadataJson', sql.NVarChar(sql.MAX), metadataJson || null)
    .query(`
      UPDATE dbo.Transactions
      SET status = 'failed',
          providerTxnId = @providerTxnId,
          metadataJson = @metadataJson,
          failedAt = SYSUTCDATETIME()
      WHERE referenceCode = @referenceCode
        AND status = 'pending'
    `);
}

// Tạo yêu cầu rút tiền
async function createWithdrawalRequest({ restaurantId, amount, description, referenceCode, idempotencyKey, metadataJson, paymentMethod }) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const req = new sql.Request(tx);

    const walletRes = await req
      .input('restaurantId', sql.UniqueIdentifier, restaurantId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Wallets WITH (UPDLOCK, ROWLOCK)
        WHERE restaurantId = @restaurantId
      `);

    const wallet = walletRes.recordset[0];
    if (!wallet) throw new Error('Restaurant wallet not found');

    const balanceBefore = Number(wallet.balance);
    const lockedBefore = Number(wallet.lockedAmount || 0);
    const withdrawAmount = Number(amount);

    if (balanceBefore < withdrawAmount) {
      throw new Error('Insufficient wallet balance');
    }

    const balanceAfter = balanceBefore - withdrawAmount;
    const pendingAfter = (Number(wallet.pendingWithdrawal) || 0) + withdrawAmount;

    await req
      .input('walletId', sql.UniqueIdentifier, wallet.id)
      .input('balanceAfter', sql.Decimal(18, 2), balanceAfter)
      .input('pendingAfter', sql.Decimal(18, 2), pendingAfter)
      .query(`
        UPDATE dbo.Wallets
        SET balance = @balanceAfter,
            pendingWithdrawal = @pendingAfter,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @walletId
      `);

    const txRes = await req
      .input('amount', sql.Decimal(18, 2), withdrawAmount)
      .input('currency', sql.NVarChar(10), wallet.currency || 'VND')
      .input('referenceCode', sql.NVarChar(100), referenceCode)
      .input('description', sql.NVarChar(sql.MAX), description || 'Withdrawal request')
      .input('idempotencyKey', sql.NVarChar(100), idempotencyKey || null)
      .input('payerType', sql.NVarChar(30), 'RESTAURANT')
      .input('provider', sql.NVarChar(30), 'INTERNAL')
      .input('bb', sql.Decimal(18, 2), balanceBefore)
      .input('ba', sql.Decimal(18, 2), balanceAfter)
      .input('paymentMethod', sql.NVarChar(30), paymentMethod || 'BANK_TRANSFER')
      .input('metadataJson', sql.NVarChar(sql.MAX), metadataJson ? JSON.stringify(metadataJson) : null)
      .query(`
        INSERT INTO dbo.Transactions (
          walletId, type, amount, currency, balanceBefore, balanceAfter,
          description, paymentMethod, referenceCode, status, payerType, provider, idempotencyKey, metadataJson, createdAt
        )
        OUTPUT INSERTED.*
        VALUES (
          @walletId, 'WITHDRAWAL', @amount, @currency, @bb, @ba,
          @description, @paymentMethod, @referenceCode, 'pending', @payerType, @provider, @idempotencyKey, @metadataJson, SYSUTCDATETIME()
        )
      `);

    await tx.commit();
    return txRes.recordset[0];
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// Admin duyệt yêu cầu rút tiền
async function approveWithdrawalRequest(transactionId, { providerTxnId, metadataJson }) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const req = new sql.Request(tx);

    const txRes = await req
      .input('txId', sql.UniqueIdentifier, transactionId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Transactions WITH (UPDLOCK, ROWLOCK)
        WHERE id = @txId AND type = 'WITHDRAWAL'
      `);

    const transaction = txRes.recordset[0];
    if (!transaction) throw new Error('Withdrawal transaction not found');
    if (transaction.status !== 'pending') throw new Error('Transaction is not pending');

    const walletRes = await req
      .input('walletId', sql.UniqueIdentifier, transaction.walletId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Wallets WITH (UPDLOCK, ROWLOCK)
        WHERE id = @walletId
      `);

    const wallet = walletRes.recordset[0];
    if (!wallet) throw new Error('Wallet not found');

    const pendingBefore = Number(wallet.pendingWithdrawal || 0);
    const withdrawAmount = Number(transaction.amount);

    if (pendingBefore < withdrawAmount) {
      throw new Error('Inconsistent wallet pending withdrawal amount');
    }

    const pendingAfter = pendingBefore - withdrawAmount;

    await req
      .input('pendingAfterApprove', sql.Decimal(18, 2), pendingAfter)
      .query(`
        UPDATE dbo.Wallets
        SET pendingWithdrawal = @pendingAfterApprove,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @walletId
      `);

    // Gộp metadata cũ và mới để tránh mất thông tin điểm đến (thẻ/QR)
    let finalMetadata = {};
    if (transaction.metadataJson) {
      try {
        finalMetadata = JSON.parse(transaction.metadataJson);
      } catch (e) {
        finalMetadata = { _raw: transaction.metadataJson };
      }
    }
    const updatedMetadata = { ...finalMetadata, ...metadataJson, approvedAt: new Date() };

    await req
      .input('providerTxnId', sql.NVarChar(100), providerTxnId || null)
      .input('metadataJson', sql.NVarChar(sql.MAX), JSON.stringify(updatedMetadata))
      .query(`
        UPDATE dbo.Transactions
        SET status = 'completed',
            providerTxnId = @providerTxnId,
            metadataJson = @metadataJson,
            completedAt = SYSUTCDATETIME()
        WHERE id = @txId
      `);

    await tx.commit();
    return { success: true };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// Admin từ chối yêu cầu rút tiền
async function rejectWithdrawalRequest(transactionId, { reason }) {
  const pool = await getPool();
  const tx = new sql.Transaction(pool);

  try {
    await tx.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    const req = new sql.Request(tx);

    const txRes = await req
      .input('txId', sql.UniqueIdentifier, transactionId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Transactions WITH (UPDLOCK, ROWLOCK)
        WHERE id = @txId AND type = 'WITHDRAWAL'
      `);

    const transaction = txRes.recordset[0];
    if (!transaction) throw new Error('Withdrawal transaction not found');
    if (transaction.status !== 'pending') throw new Error('Transaction is not pending');

    const walletRes = await req
      .input('walletId', sql.UniqueIdentifier, transaction.walletId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Wallets WITH (UPDLOCK, ROWLOCK)
        WHERE id = @walletId
      `);

    const wallet = walletRes.recordset[0];
    if (!wallet) throw new Error('Wallet not found');

    const balanceBefore = Number(wallet.balance);
    const pendingBefore = Number(wallet.pendingWithdrawal || 0);
    const withdrawAmount = Number(transaction.amount);

    const balanceAfter = balanceBefore + withdrawAmount;
    const pendingAfter = pendingBefore - withdrawAmount;

    await req
      .input('balanceAfterReject', sql.Decimal(18, 2), balanceAfter)
      .input('pendingAfterReject', sql.Decimal(18, 2), pendingAfter)
      .query(`
        UPDATE dbo.Wallets
        SET balance = @balanceAfterReject,
            pendingWithdrawal = @pendingAfterReject,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @walletId
      `);

    // Gộp metadata cũ và lý do từ chối
    let finalMetadata = {};
    if (transaction.metadataJson) {
      try {
        finalMetadata = JSON.parse(transaction.metadataJson);
      } catch (e) {
        finalMetadata = { _raw: transaction.metadataJson };
      }
    }
    const updatedMetadata = { ...finalMetadata, rejectReason: reason, rejectedAt: new Date() };

    await req
      .input('reasonJson', sql.NVarChar(sql.MAX), JSON.stringify(updatedMetadata))
      .input('bb', sql.Decimal(18, 2), balanceBefore)
      .input('ba', sql.Decimal(18, 2), balanceAfter)
      .query(`
        UPDATE dbo.Transactions
        SET status = 'failed',
            balanceBefore = @bb,
            balanceAfter = @ba,
            metadataJson = @reasonJson,
            failedAt = SYSUTCDATETIME()
        WHERE id = @txId
      `);

    await tx.commit();
    return { success: true };
  } catch (err) {
    await tx.rollback();
    throw err;
  }
}

// Lay danh sach 5 giao dich doanh thu gan nhat (joining Bookings & Users)
async function getRecentRestaurantTransactions(restaurantId, limit = 5) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .input('limit', sql.Int, limit)
    .query(`
      SELECT TOP (@limit)
        tx.id,
        tx.bookingId,
        tx.type,
        tx.amount,
        tx.currency,
        tx.status,
        tx.createdAt,
        tx.completedAt,
        b.bookingCode,
        b.commissionFee,
        tx.amount - ISNULL(b.commissionFee, 0) AS netAmount,
        COALESCE(u.name, b.guestName) AS customerName,
        u.avatar AS customerAvatar,
        t.tableNumber,
        t.location AS tableLocation
      FROM dbo.Transactions tx
      INNER JOIN dbo.Bookings b ON tx.bookingId = b.id
      LEFT JOIN dbo.Users u ON b.customerId = u.id
      LEFT JOIN dbo.Tables t ON b.tableId = t.id
      WHERE b.restaurantId = @restaurantId
        AND tx.status = 'completed'
        AND tx.type = 'DEPOSIT_PAYMENT'
      ORDER BY tx.createdAt DESC
    `);
  return rs.recordset;
}

// Lấy thống kê chi tiết ví nhà hàng
async function getWalletStatistics(restaurantId) {
  const pool = await getPool();
  const walletRes = await pool.request()
    .input('restaurantId', sql.UniqueIdentifier, restaurantId)
    .query('SELECT TOP 1 id, balance, lockedAmount, pendingWithdrawal, currency, status FROM dbo.Wallets WHERE restaurantId = @restaurantId');
  
  const wallet = walletRes.recordset[0];
  if (!wallet) return null;

  const statsRes = await pool.request()
    .input('walletId', sql.UniqueIdentifier, wallet.id)
    .query(`
      SELECT 
        ISNULL(SUM(CASE WHEN type = 'WITHDRAWAL' AND status = 'completed' THEN amount ELSE 0 END), 0) as totalWithdrawnSuccess,
        ISNULL(COUNT(CASE WHEN type = 'WITHDRAWAL' THEN 1 END), 0) as totalWithdrawalCount,
        ISNULL(COUNT(*), 0) as totalTransactionCount,
        ISNULL((SELECT TOP 1 amount FROM dbo.Transactions WHERE walletId = @walletId AND type = 'WITHDRAWAL' AND status = 'pending' ORDER BY createdAt DESC), 0) as latestPendingWithdrawal
      FROM dbo.Transactions
      WHERE walletId = @walletId
    `);

  const stats = statsRes.recordset[0];
  return {
    ...wallet,
    ...stats
  };
}

module.exports = {
  findBookingForDeposit,
  findPendingDepositByBookingId,
  findCompletedDepositByBookingId,
  createPendingDepositTransaction,
  findWalletByRestaurantId,
  findWalletByUserId,
  findTransactionByIdempotencyKey,
  getWalletTransactions,
  findPendingTopupByWalletId,
  createPendingWalletTopupTransaction,
  findTransactionById,
  findTransactionByReferenceCode,
  completeDepositTransaction,
  createWithdrawalRequest,
  approveWithdrawalRequest,
  rejectWithdrawalRequest,
  completeWalletTopupTransactionAndIncreaseBalance,
  chargeCommissionFromRestaurantToAdmin,
  failTransaction,
  settleDepositToWallet,
  getRecentRestaurantTransactions,
  getWalletStatistics
};
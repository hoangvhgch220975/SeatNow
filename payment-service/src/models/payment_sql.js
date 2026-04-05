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

// Lay lich su giao dich theo wallet.
async function getWalletTransactions(walletId) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('walletId', sql.UniqueIdentifier, walletId)
    .query(`
      SELECT *
      FROM dbo.Transactions
      WHERE walletId = @walletId
      ORDER BY createdAt DESC
    `);

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

    const restaurantBefore = Number(restaurantWallet.balance);
    if (restaurantBefore < Number(amount)) {
      throw new Error('Insufficient wallet balance');
    }

    const adminBefore = Number(adminWallet.balance);
    const restaurantAfter = restaurantBefore - Number(amount);
    const adminAfter = adminBefore + Number(amount);

    await req
      .input('restaurantWalletId2', sql.UniqueIdentifier, restaurantWallet.id)
      .input('restaurantAfter', sql.Decimal(18, 2), restaurantAfter)
      .query(`
        UPDATE dbo.Wallets
        SET balance = @restaurantAfter,
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
      .input('desc1', sql.NVarChar(sql.MAX), description || 'Commission charged from restaurant wallet')
      .input('rbf', sql.Decimal(18, 2), restaurantBefore)
      .input('raf', sql.Decimal(18, 2), restaurantAfter)
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
      restaurantBalanceAfter: restaurantAfter,
      adminBalanceAfter: adminAfter
    };
  } catch (err) {
    await tx.rollback();
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

    // Lấy ví của nhà hàng để cộng tiền cọc
    const walletRes = await req
      .input('restaurantId', sql.UniqueIdentifier, booking.restaurantId)
      .query(`
        SELECT TOP 1 *
        FROM dbo.Wallets WITH (UPDLOCK, ROWLOCK)
        WHERE restaurantId = @restaurantId
      `);
      
    const wallet = walletRes.recordset[0];
    if (!wallet) throw new Error('Restaurant wallet not found');

    const balanceBefore = Number(wallet.balance);
    const balanceAfter = balanceBefore + Number(row.amount); // Cộng tiền cọc vào ví

    // Cập nhật số dư ví
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
      .input('walletIdTx', sql.UniqueIdentifier, wallet.id)
      .input('balanceBeforeTx', sql.Decimal(18, 2), balanceBefore)
      .input('balanceAfterTx', sql.Decimal(18, 2), balanceAfter)
      .query(`
        UPDATE dbo.Transactions
        SET status = 'completed',
            walletId = @walletIdTx,
            balanceBefore = @balanceBeforeTx,
            balanceAfter = @balanceAfterTx,
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
async function createWithdrawalRequest({ restaurantId, amount, description, referenceCode, idempotencyKey }) {
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
    const lockedAfter = lockedBefore + withdrawAmount;

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
      .query(`
        INSERT INTO dbo.Transactions (
          walletId, type, amount, currency, balanceBefore, balanceAfter,
          description, paymentMethod, referenceCode, status, payerType, provider, idempotencyKey, createdAt
        )
        OUTPUT INSERTED.*
        VALUES (
          @walletId, 'WITHDRAWAL', @amount, @currency, @bb, @ba,
          @description, 'BANK_TRANSFER', @referenceCode, 'pending', @payerType, @provider, @idempotencyKey, SYSUTCDATETIME()
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

    const lockedBefore = Number(wallet.lockedAmount || 0);
    const withdrawAmount = Number(transaction.amount);

    if (lockedBefore < withdrawAmount) {
      throw new Error('Inconsistent wallet locked amount');
    }

    const lockedAfter = lockedBefore - withdrawAmount;

    await req
      .input('lockedAfterApprove', sql.Decimal(18, 2), lockedAfter)
      .query(`
        UPDATE dbo.Wallets
        SET lockedAmount = @lockedAfterApprove,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @walletId
      `);

    await req
      .input('providerTxnId', sql.NVarChar(100), providerTxnId || null)
      .input('metadataJson', sql.NVarChar(sql.MAX), metadataJson ? JSON.stringify(metadataJson) : null)
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
    const lockedBefore = Number(wallet.lockedAmount || 0);
    const withdrawAmount = Number(transaction.amount);

    const balanceAfter = balanceBefore + withdrawAmount;
    const lockedAfter = lockedBefore - withdrawAmount;

    await req
      .input('balanceAfterReject', sql.Decimal(18, 2), balanceAfter)
      .input('lockedAfterReject', sql.Decimal(18, 2), lockedAfter)
      .query(`
        UPDATE dbo.Wallets
        SET balance = @balanceAfterReject,
            lockedAmount = @lockedAfterReject,
            updatedAt = SYSUTCDATETIME()
        WHERE id = @walletId
      `);

    await req
      .input('reason', sql.NVarChar(sql.MAX), reason ? JSON.stringify({ reason }) : null)
      .input('bb', sql.Decimal(18, 2), balanceBefore)
      .input('ba', sql.Decimal(18, 2), balanceAfter)
      .query(`
        UPDATE dbo.Transactions
        SET status = 'failed',
            balanceBefore = @bb,
            balanceAfter = @ba,
            metadataJson = @reason,
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
  failTransaction
};
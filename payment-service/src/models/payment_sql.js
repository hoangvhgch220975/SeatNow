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
      .input('bookingId', sql.UniqueIdentifier, row.bookingId)
      .query(`
        UPDATE dbo.Bookings
        SET depositPaid = 1,
        depositPaidAt = SYSUTCDATETIME(),
        updatedAt = SYSUTCDATETIME()
        WHERE id = @bookingId
       AND status = 'PENDING'
      `);

    await tx.commit();
    return { success: true };
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

module.exports = {
  findBookingForDeposit,
  findPendingDepositByBookingId,
  findCompletedDepositByBookingId,
  createPendingDepositTransaction,
  findTransactionById,
  findTransactionByReferenceCode,
  completeDepositTransaction,
  failTransaction
};
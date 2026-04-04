/**
 * restaurant.sql.js - raw SQL queries for dbo.Restaurants
 * - CommonJS + module.exports
 * - Supports:
 *   - findMany (search thường: q/cuisine/priceRange/bbox + paging)
 *   - findManyNearMe (near-me chuẩn: tính distance trong SQL + ORDER BY distance + paging)
 *   - findById
 *   - createRestaurant
 *   - updateRestaurant (patch)
 *   - updateDepositPolicy
 *   - softDelete
 */
const { sql, getPool } = require('../config/sql');

/* ------------------------- helpers ------------------------- */

function safeJson(v, fallback) {
  if (!v) return fallback;
  try { return JSON.parse(v); } catch { return fallback; }
}

function mapJsonFields(r) {
  return {
    ...r,
    cuisineTypes: safeJson(r.cuisineTypeJson, []),
    images: safeJson(r.imagesJson, []),
    openingHours: safeJson(r.openingHoursJson, {}),
    depositPolicy: safeJson(r.depositPolicyJson, null)
  };
}

function clampInt(n, min, max, def) {
  const x = Number.parseInt(n, 10);
  if (!Number.isFinite(x)) return def;
  return Math.min(Math.max(x, min), max);
}

function normalizePaging({ limit = 20, offset = 0 } = {}) {
  return {
    limit: clampInt(limit, 1, 50, 20),
    offset: clampInt(offset, 0, Number.MAX_SAFE_INTEGER, 0)
  };
}

function addWhere(where, req, key, type, value, clause) {
  if (value === undefined || value === null || value === '') return;
  where.push(clause);
  req.input(key, type, value);
}

function buildOrderBy(sort) {
  // whitelist only
  if (sort === 'newest') return 'isPremium DESC, createdAt DESC';
  // default = rating
  return 'isPremium DESC, ratingAvg DESC, ratingCount DESC, createdAt DESC';
}

/* ------------------------- queries ------------------------- */

/**
 * Search thường (KHÔNG sort distance trong SQL)
 * - bbox chỉ filter thô (nếu có)
 * - sort: 'rating' | 'newest'
 */
async function findMany({ q, cuisine, priceRange, status = 'active', limit = 20, offset = 0, bbox, sort = 'rating' }) {
  const pool = await getPool();
  const req = pool.request();
  const paging = normalizePaging({ limit, offset });

  const where = ['status = @status'];
  req.input('status', sql.NVarChar(30), status);

  if (q) {
    where.push('(name LIKE @q OR address LIKE @q)');
    req.input('q', sql.NVarChar(200), `%${q}%`);
  }

  addWhere(where, req, 'priceRange', sql.Int, priceRange, 'priceRange = @priceRange');

  if (cuisine) {
    where.push(`
      cuisineTypeJson IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM OPENJSON(cuisineTypeJson) WITH (value NVARCHAR(100) '$') j
        WHERE j.value = @cuisine
      )
    `);
    req.input('cuisine', sql.NVarChar(100), cuisine);
  }

  if (bbox) {
    addWhere(where, req, 'minLat', sql.Float, bbox.minLat, 'latitude >= @minLat');
    addWhere(where, req, 'maxLat', sql.Float, bbox.maxLat, 'latitude <= @maxLat');
    addWhere(where, req, 'minLng', sql.Float, bbox.minLng, 'longitude >= @minLng');
    addWhere(where, req, 'maxLng', sql.Float, bbox.maxLng, 'longitude <= @maxLng');
  }

  req.input('limit', sql.Int, paging.limit);
  req.input('offset', sql.Int, paging.offset);

  const rs = await req.query(`
    -- Query 1: Total Count
    SELECT COUNT(*) as Total FROM dbo.Restaurants WHERE ${where.join(' AND ')};

    -- Query 2: Paged Data
    SELECT id, ownerId, name, slug, address, latitude, longitude, phone, email,
           cuisineTypeJson, priceRange, ratingAvg, ratingCount,
           description, imagesJson, openingHoursJson,
           depositEnabled, depositPolicyJson,
           commissionRate, status, isPremium, createdAt, updatedAt
    FROM dbo.Restaurants
    WHERE ${where.join(' AND ')}
    ORDER BY ${buildOrderBy(sort)}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `);

  const total = rs.recordsets[0][0].Total;
  const rows = rs.recordsets[1].map(mapJsonFields);
  return { rows, total };
}

/**
 * Near-me chuẩn:
 * - bbox filter thô (khuyến nghị truyền vào từ service)
 * - tính distanceKm trong SQL
 * - WHERE distanceKm <= radiusKm
 * - ORDER BY distanceKm + paging chuẩn
 */
async function findManyNearMe({
  q,
  cuisine,
  priceRange,
  status = 'active',
  lat,
  lng,
  radiusKm = 5,
  limit = 20,
  offset = 0,
  bbox
}) {
  const pool = await getPool();
  const req = pool.request();
  const paging = normalizePaging({ limit, offset });

  const where = ['r.status = @status'];
  req.input('status', sql.NVarChar(30), status);

  // required for near-me
  req.input('lat', sql.Float, lat);
  req.input('lng', sql.Float, lng);
  req.input('radiusKm', sql.Float, radiusKm);

  if (q) {
    where.push('(r.name LIKE @q OR r.address LIKE @q)');
    req.input('q', sql.NVarChar(200), `%${q}%`);
  }

  addWhere(where, req, 'priceRange', sql.Int, priceRange, 'r.priceRange = @priceRange');

  if (cuisine) {
    where.push(`
      r.cuisineTypeJson IS NOT NULL
      AND EXISTS (
        SELECT 1
        FROM OPENJSON(r.cuisineTypeJson) WITH (value NVARCHAR(100) '$') j
        WHERE j.value = @cuisine
      )
    `);
    req.input('cuisine', sql.NVarChar(100), cuisine);
  }

  if (bbox) {
    addWhere(where, req, 'minLat', sql.Float, bbox.minLat, 'r.latitude >= @minLat');
    addWhere(where, req, 'maxLat', sql.Float, bbox.maxLat, 'r.latitude <= @maxLat');
    addWhere(where, req, 'minLng', sql.Float, bbox.minLng, 'r.longitude >= @minLng');
    addWhere(where, req, 'maxLng', sql.Float, bbox.maxLng, 'r.longitude <= @maxLng');
  }

  req.input('limit', sql.Int, paging.limit);
  req.input('offset', sql.Int, paging.offset);

  // Haversine in SQL (km)
  const rs = await req.query(`
    WITH base AS (
      SELECT
        r.*,
        (6371 * 2 * ASIN(SQRT(
          POWER(SIN((RADIANS(r.latitude - @lat)) / 2), 2) +
          COS(RADIANS(@lat)) * COS(RADIANS(r.latitude)) *
          POWER(SIN((RADIANS(r.longitude - @lng)) / 2), 2)
        ))) AS distanceKm
      FROM dbo.Restaurants r
      WHERE ${where.join(' AND ')}
    ),
    filtered AS (
      SELECT * FROM base WHERE distanceKm <= @radiusKm
    )
    -- Query 1: Total Count
    SELECT COUNT(*) as Total FROM filtered;

    -- Query 2: Paged Data
    SELECT *
    FROM filtered
    ORDER BY distanceKm ASC, isPremium DESC, ratingAvg DESC
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `);

  const total = rs.recordsets[0][0].Total;
  const rows = rs.recordsets[1].map((r) => ({
    ...mapJsonFields(r),
    distanceKm: Number(r.distanceKm)
  }));
  return { rows, total };
}

async function findById(id) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .query(`SELECT TOP 1 * FROM dbo.Restaurants WHERE id=@id`);

  const r = rs.recordset[0];
  return r ? mapJsonFields(r) : null;
}

// Find restaurant by slug (SEO-friendly string)
async function findBySlug(slug) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('slug', sql.NVarChar(200), slug)
    .query(`SELECT TOP 1 * FROM dbo.Restaurants WHERE slug=@slug`);

  const r = rs.recordset[0];
  return r ? mapJsonFields(r) : null;
}

async function createRestaurant({
  ownerId,
  name,
  slug,
  address,
  latitude,
  longitude,
  phone,
  email,
  cuisineTypes,
  priceRange,
  description,
  images,
  openingHours,
  status = 'pending',
  commissionRate = 0.1,
  isPremium = false,
  depositEnabled = false,
  depositPolicy = null
}) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('ownerId', sql.UniqueIdentifier, ownerId)
    .input('name', sql.NVarChar(150), name)
    .input('slug', sql.NVarChar(200), slug)
    .input('address', sql.NVarChar(255), address)
    .input('latitude', sql.Float, latitude)
    .input('longitude', sql.Float, longitude)
    .input('phone', sql.NVarChar(20), phone)
    .input('email', sql.NVarChar(255), email || null)
    .input('cuisineTypeJson', sql.NVarChar(sql.MAX), JSON.stringify(cuisineTypes || []))
    .input('priceRange', sql.Int, priceRange)
    .input('description', sql.NVarChar(sql.MAX), description || null)
    .input('imagesJson', sql.NVarChar(sql.MAX), JSON.stringify(images || []))
    .input('openingHoursJson', sql.NVarChar(sql.MAX), JSON.stringify(openingHours || {}))
    .input('status', sql.NVarChar(30), status)
    .input('commissionRate', sql.Float, commissionRate)
    .input('isPremium', sql.Bit, isPremium ? 1 : 0)
    .input('depositEnabled', sql.Bit, depositEnabled ? 1 : 0)
    .input('depositPolicyJson', sql.NVarChar(sql.MAX), depositPolicy ? JSON.stringify(depositPolicy) : null)
    .query(`
      INSERT INTO dbo.Restaurants
      (ownerId,name,slug,address,latitude,longitude,phone,email,cuisineTypeJson,priceRange,description,imagesJson,openingHoursJson,status,commissionRate,isPremium,depositEnabled,depositPolicyJson)
      OUTPUT INSERTED.*
      VALUES
      (@ownerId,@name,@slug,@address,@latitude,@longitude,@phone,@email,@cuisineTypeJson,@priceRange,@description,@imagesJson,@openingHoursJson,@status,@commissionRate,@isPremium,@depositEnabled,@depositPolicyJson);
    `);

  return mapJsonFields(rs.recordset[0]);
}

async function updateRestaurant(id, patch) {
  const pool = await getPool();
  const req = pool.request().input('id', sql.UniqueIdentifier, id);

  const sets = [];

  const simpleMap = {
    name: ['name', sql.NVarChar(150)],
    slug: ['slug', sql.NVarChar(200)],
    address: ['address', sql.NVarChar(255)],
    latitude: ['latitude', sql.Float],
    longitude: ['longitude', sql.Float],
    phone: ['phone', sql.NVarChar(20)],
    email: ['email', sql.NVarChar(255)],
    priceRange: ['priceRange', sql.Int],
    description: ['description', sql.NVarChar(sql.MAX)],
    status: ['status', sql.NVarChar(30)],
    commissionRate: ['commissionRate', sql.Float],
    isPremium: ['isPremium', sql.Bit]
  };

  for (const k of Object.keys(simpleMap)) {
    if (patch[k] === undefined) continue;
    const [col, type] = simpleMap[k];
    sets.push(`${col}=@${k}`);
    req.input(k, type, patch[k]);
  }

  // JSON fields (undefined = ignore, null = set NULL)
  if (patch.cuisineTypes !== undefined) {
    sets.push('cuisineTypeJson=@cuisineTypeJson');
    req.input('cuisineTypeJson', sql.NVarChar(sql.MAX),
      patch.cuisineTypes === null ? null : JSON.stringify(patch.cuisineTypes || [])
    );
  }
  if (patch.images !== undefined) {
    sets.push('imagesJson=@imagesJson');
    req.input('imagesJson', sql.NVarChar(sql.MAX),
      patch.images === null ? null : JSON.stringify(patch.images || [])
    );
  }
  if (patch.openingHours !== undefined) {
    sets.push('openingHoursJson=@openingHoursJson');
    req.input('openingHoursJson', sql.NVarChar(sql.MAX),
      patch.openingHours === null ? null : JSON.stringify(patch.openingHours || {})
    );
  }

  if (!sets.length) return findById(id);

  const rs = await req.query(`
    UPDATE dbo.Restaurants
    SET ${sets.join(', ')},
        updatedAt=SYSUTCDATETIME()
    OUTPUT INSERTED.*
    WHERE id=@id;
  `);

  const r = rs.recordset[0];
  return r ? mapJsonFields(r) : null;
}

async function updateDepositPolicy(id, { depositEnabled, policy }) {
  const pool = await getPool();
  const rs = await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .input('depositEnabled', sql.Bit, depositEnabled ? 1 : 0)
    .input('depositPolicyJson', sql.NVarChar(sql.MAX), policy ? JSON.stringify(policy) : null)
    .query(`
      UPDATE dbo.Restaurants
      SET depositEnabled=@depositEnabled,
          depositPolicyJson=@depositPolicyJson,
          updatedAt=SYSUTCDATETIME()
      OUTPUT INSERTED.*
      WHERE id=@id;
    `);

  const r = rs.recordset[0];
  return r ? mapJsonFields(r) : null;
}

async function softDelete(id) {
  return updateRestaurant(id, { status: 'suspended' });
}

async function updateRestaurantRating(id, ratingAvg, ratingCount) {
  const pool = await getPool();
  await pool.request()
    .input('id', sql.UniqueIdentifier, id)
    .input('ratingAvg', sql.Float, ratingAvg)
    .input('ratingCount', sql.Int, ratingCount)
    .query(`
      UPDATE dbo.Restaurants
      SET ratingAvg=@ratingAvg, ratingCount=@ratingCount, updatedAt=SYSUTCDATETIME()
      WHERE id=@id;
    `);
}

module.exports = {
  findMany,
  findManyNearMe,
  findById,
  findBySlug,
  createRestaurant,
  updateRestaurant,
  updateDepositPolicy,
  softDelete,
  updateRestaurantRating
};

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
 * Unified Search:
 * - Nếu có lat/lng: Tính toán distanceKm bằng Haversine.
 * - Nếu có radiusKm: Lọc trong bán kính.
 * - Hỗ trợ sort: 'rating' | 'newest' | 'distance'
 */
async function findMany({
  q,
  cuisine,
  priceRange,
  status = 'active',
  lat,
  lng,
  radiusKm,
  limit = 20,
  offset = 0,
  bbox,
  sort = 'rating',
  ownerId
}) {
  const pool = await getPool();
  const req = pool.request();
  const paging = normalizePaging({ limit, offset });

  // 1. Base Where Clause
  const where = [];
  if (status !== 'all') {
    where.push('r.status = @status');
    req.input('status', sql.NVarChar(30), status);
  } else {
    // If 'all', return all except soft-deleted if applicable. 
    // In this simplified model, 'suspended' is the soft-delete state.
    // If we want truly ALL including suspended, we just leave where empty or 1=1.
    where.push('1=1');
  }

  if (q) {
    // Force case-insensitive search by using LOWER() on both column and parameter
    where.push('(LOWER(r.name) LIKE @q OR LOWER(r.address) LIKE @q)');
    req.input('q', sql.NVarChar(200), `%${q.toLowerCase()}%`);
  }

  if (ownerId) {
    where.push('r.ownerId = @ownerId');
    req.input('ownerId', sql.UniqueIdentifier, ownerId);
  }

  // Use addWhere helper safely for priceRange
  if (priceRange !== undefined && priceRange !== null && priceRange !== '') {
    where.push('r.priceRange = @priceRange');
    req.input('priceRange', sql.Int, parseInt(priceRange, 10));
  }

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
    where.push('r.latitude >= @minLat AND r.latitude <= @maxLat AND r.longitude >= @minLng AND r.longitude <= @maxLng');
    req.input('minLat', sql.Float, bbox.minLat);
    req.input('maxLat', sql.Float, bbox.maxLat);
    req.input('minLng', sql.Float, bbox.minLng);
    req.input('maxLng', sql.Float, bbox.maxLng);
  }

  // 2. Distance Logic
  const nLat = parseFloat(lat);
  const nLng = parseFloat(lng);
  const nRadius = parseFloat(radiusKm);
  const hasGeo = !isNaN(nLat) && !isNaN(nLng);
  const hasRadius = !isNaN(nRadius);

  if (hasGeo) {
    req.input('lat', sql.Float, nLat);
    req.input('lng', sql.Float, nLng);
  }
  if (hasRadius) {
    req.input('radiusKm', sql.Float, nRadius);
  }

  req.input('limit', sql.Int, paging.limit);
  req.input('offset', sql.Int, paging.offset);

  const distFormula = `(6371 * 2 * ASIN(SQRT(
    POWER(SIN((RADIANS(r.latitude - @lat)) / 2), 2) +
    COS(RADIANS(@lat)) * COS(RADIANS(r.latitude)) *
    POWER(SIN((RADIANS(r.longitude - @lng)) / 2), 2)
  )))`;

  // --- Query 1: Total Count ---
  const countWhere = [...where];
  if (hasGeo && hasRadius) {
    countWhere.push(`${distFormula} <= @radiusKm`);
  }

  const countQuery = `
    SELECT COUNT(*) as Total
    FROM dbo.Restaurants r
    WHERE ${countWhere.join(' AND ')}
  `;

  const rsCount = await req.query(countQuery);
  const total = rsCount.recordset[0].Total;

  // --- Query 2: Paged Data ---
  // We use a subquery to make distanceKm available for paging filter and sorting
  const finalDataQuery = `
    SELECT * FROM (
      SELECT
        r.*,
        ${hasGeo ? distFormula : 'NULL'} AS distanceKm
      FROM dbo.Restaurants r
      WHERE ${where.join(' AND ')}
    ) as sub
    WHERE 1=1 ${hasGeo && hasRadius ? 'AND distanceKm <= @radiusKm' : ''}
    ORDER BY ${sort === 'distance' && hasGeo ? 'distanceKm ASC, isPremium DESC, ratingAvg DESC' : buildOrderBy(sort)}
    OFFSET @offset ROWS FETCH NEXT @limit ROWS ONLY;
  `;

  const rsData = await req.query(finalDataQuery);
  const rows = rsData.recordset.map((r) => ({
    ...mapJsonFields(r),
    distanceKm: r.distanceKm !== null ? Number(r.distanceKm) : null
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
  suspendedBy = null,
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
    .input('suspendedBy', sql.NVarChar(20), suspendedBy)
    .input('commissionRate', sql.Float, commissionRate)
    .input('isPremium', sql.Bit, isPremium ? 1 : 0)
    .input('depositEnabled', sql.Bit, depositEnabled ? 1 : 0)
    .input('depositPolicyJson', sql.NVarChar(sql.MAX), depositPolicy ? JSON.stringify(depositPolicy) : null)
    .query(`
      INSERT INTO dbo.Restaurants
      (ownerId,name,slug,address,latitude,longitude,phone,email,cuisineTypeJson,priceRange,description,imagesJson,openingHoursJson,status,suspendedBy,commissionRate,isPremium,depositEnabled,depositPolicyJson)
      OUTPUT INSERTED.*
      VALUES
      (@ownerId,@name,@slug,@address,@latitude,@longitude,@phone,@email,@cuisineTypeJson,@priceRange,@description,@imagesJson,@openingHoursJson,@status,@suspendedBy,@commissionRate,@isPremium,@depositEnabled,@depositPolicyJson);
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
    suspendedBy: ['suspendedBy', sql.NVarChar(20)],
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
  findById,
  findBySlug,
  createRestaurant,
  updateRestaurant,
  updateDepositPolicy,
  softDelete,
  updateRestaurantRating
};

/*
 * scripts/test-db-connection-full.js
 * Combined script: tests SQL (via src/config/db.js), MongoDB and Redis.
 * Usage: node scripts/test-db-connection-full.js --all
 * Flags: --sql, --mongo, --redis, --all
 */

require('dotenv').config();
const argv = require('minimist')(process.argv.slice(2));

function timeoutPromise(ms, message) {
  return new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms));
}

const { sql, getPool } = require('../src/config/sql');

async function testSql(timeoutMs = 8000) {
  let pool;
  try {
    pool = await Promise.race([getPool(), timeoutPromise(timeoutMs, 'SQL getPool timed out')]);
    const res = await Promise.race([pool.request().query('SELECT 1 AS ok'), timeoutPromise(timeoutMs, 'SQL query timed out')]);
    return { ok: true, result: res.recordset[0] };
  } catch (err) {
    return { ok: false, reason: err.message || err };
  } finally {
    try {
      if (pool && typeof pool.close === 'function') await pool.close();
      if (sql && typeof sql.close === 'function') await sql.close();
    } catch (e) {}
  }
}

async function testMongo(timeoutMs = 8000) {
  const mongoose = require('mongoose');
  const uri = process.env.MONGO_URI || argv.mongo || argv.m;
  if (!uri) return { ok: true, reason: 'skipped' };
  try {
    await Promise.race([mongoose.connect(uri), timeoutPromise(timeoutMs, 'Mongo connect timed out')]);
    await mongoose.disconnect();
    return { ok: true };
  } catch (err) {
    try { await mongoose.disconnect(); } catch (e) {}
    return { ok: false, reason: err.message || err };
  }
}

async function testRedis(timeoutMs = 5000) {
  const IORedis = require('ioredis');
  const url = process.env.REDIS_URL || argv.redis || argv.r || 'redis://127.0.0.1:6379';
  let client;
  try {
    client = new IORedis(url, { connectTimeout: timeoutMs });
    await Promise.race([client.ping(), timeoutPromise(timeoutMs, 'Redis ping timed out')]);
    await client.quit();
    return { ok: true };
  } catch (err) {
    try { if (client) await client.quit(); } catch (e) {}
    return { ok: false, reason: err.message || err };
  }
}

async function run() {
  const doAll = argv.all || (!argv.sql && !argv.mongo && !argv.redis && !argv.s && !argv.m && !argv.r);
  const checkSql = doAll || argv.sql || argv.s;
  const checkMongo = doAll || argv.mongo || argv.m;
  const checkRedis = doAll || argv.redis || argv.r;

  const results = {};
  if (checkSql) results.sql = await testSql();
  if (checkMongo) results.mongo = await testMongo();
  if (checkRedis) results.redis = await testRedis();

  console.log('\nTest summary:');
  console.log(JSON.stringify(results, null, 2));
  process.exit(Object.values(results).every(r => r && r.ok) ? 0 : 2);
}

if (require.main === module) run().catch(err => { console.error(err); process.exit(2); });

module.exports = { run };

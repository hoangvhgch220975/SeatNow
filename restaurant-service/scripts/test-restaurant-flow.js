#!/usr/bin/env node
/**
 * Comprehensive Test Script for Restaurant Service (Reliable version)
 * This version uses manual JWT generation to bypass login dependencies.
 */

const http = require('http');
const jwt = require('jsonwebtoken');

const RESTAURANT_URL = 'http://localhost:3003/api/v1';
const JWT_SECRET = process.env.JWT_ACCESS_SECRET || 'vhTony_24_access'; // Match with .env

// Real IDs from Database
const ADMIN_ID = '49D42587-056D-4697-853C-52E69EC9A7A9';
const OWNER_ID = 'B0850966-1EF4-432E-AE4F-37B0DA105F95';

function generateToken(id, role) {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function request(baseUrl, path, method = 'GET', body = null, token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(baseUrl + path);
    const options = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: { 'Content-Type': 'application/json' }
    };
    if (token) options.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', (chunk) => data += chunk);
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING RELIABLE RESTAURANT TESTS (Manual JWT) ===');

  const adminToken = generateToken(ADMIN_ID, 'ADMIN');
  const ownerToken = generateToken(OWNER_ID, 'RESTAURANT_OWNER');

  try {
    // 1. OWNER CREATION FLOW (PENDING)
    console.log('\n--- 1. Owner-Initiated Creation ---');
    const newRest = await request(RESTAURANT_URL, '/restaurants', 'POST', {
      name: 'Owner Self-Test Bistro ' + Date.now(),
      address: 'Test Owned St',
      phone: '+84900000001',
      priceRange: 2,
      cuisineTypes: ['Italian'],
      latitude: 10.77,
      longitude: 106.70
    }, ownerToken);

    console.log('Status:', newRest.status);
    if (newRest.status === 201) {
      console.log('Success: Restaurant created with status:', newRest.body.data.status);
    } else {
      console.error('FAIL: Creation failed', newRest.body);
    }

    // 2. ADMIN CREATION FLOW (ACTIVE)
    let adminCreatedId = null;
    console.log('\n--- 2. Admin-Initiated Creation (for Owner) ---');
    const adminRest = await request(RESTAURANT_URL, '/restaurants', 'POST', {
      name: 'Admin Managed Steakhouse ' + Date.now(),
      address: 'Admin Boulevard',
      phone: '+84900000002',
      priceRange: 4,
      ownerId: OWNER_ID,
      commissionRate: 0.12,
      latitude: 10.78,
      longitude: 106.71
    }, adminToken);

    console.log('Status:', adminRest.status);
    if (adminRest.status === 201) {
      adminCreatedId = adminRest.body.data.id;
      console.log('Success: Restaurant created with status:', adminRest.body.data.status);
      if (adminRest.body.data.status !== 'active') {
        console.error('FAIL: Expected status active');
      }
    } else {
      console.error('FAIL: Admin creation failed', adminRest.body);
    }

    // 3. SLUG UPDATE
    if (adminCreatedId) {
      console.log('\n--- 3. Manual Slug Update by Owner ---');
      const newSlug = 'manual-slug-' + Date.now();
      const up = await request(RESTAURANT_URL, `/restaurants/${adminCreatedId}`, 'PUT', {
        slug: newSlug
      }, ownerToken);
      console.log('Status:', up.status);
      if (up.status === 200 && up.body.data.slug === newSlug) {
        console.log('Success: Slug updated correctly');
      } else {
        console.error('FAIL: Slug update failed', up.body);
      }
    }

    // 4. STATISTICS
    console.log('\n--- 4. Global Portfolio Statistics ---');
    const portfolio = await request(RESTAURANT_URL, '/portfolio/summary', 'GET', null, ownerToken);
    console.log('Status:', portfolio.status);
    if (portfolio.status === 200) {
      console.log('Revenue Total:', portfolio.body.data.summary.totalRevenue);
      console.log('Breakdown count:', portfolio.body.data.breakdown?.length);
    }

    if (adminCreatedId) {
      console.log('\n--- 5. Individual Restaurant Stats Summary ---');
      const stats = await request(RESTAURANT_URL, `/restaurants/${adminCreatedId}/stats-summary`, 'GET', null, ownerToken);
      console.log('Status:', stats.status);
      if (stats.status === 200) {
        console.log('Data:', stats.body.data);
      }
    }

    console.log('\n=== ALL TESTS COMPLETED ===');
  } catch (err) {
    console.error('CRITICAL TEST ERROR:', err);
  }
}

runTests();

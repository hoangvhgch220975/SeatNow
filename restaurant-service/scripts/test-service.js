#!/usr/bin/env node
// Enhanced test script for restaurant-service
// Usage: node scripts/test-service.js [ACCESS_TOKEN]

const http = require('http');

const PORT = process.env.PORT || 3003;
const BASE = `http://localhost:${PORT}/api/v1`;
const token = process.argv[2] || process.env.ACCESS_TOKEN;

function doRequest(path, method = 'GET', body = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE + path);
    const opts = {
      hostname: url.hostname,
      port: url.port,
      path: url.pathname + url.search,
      method,
      headers: {
        'Content-Type': 'application/json'
      }
    };
    if (token) opts.headers['Authorization'] = `Bearer ${token}`;

    const req = http.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
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

async function run() {
  console.log('Testing Restaurant Service at:', BASE);
  if (!token) console.warn('Warning: No token provided. Protected routes will fail (401/403).');

  try {
    console.log('\n1) GET /restaurants (public list)');
    const list = await doRequest('/restaurants?limit=1');
    console.log('Status:', list.status);

    const sampleId = list.body?.data?.[0]?.id || '1';

    console.log(`\n2) GET /restaurants/${sampleId} (detail)`);
    const detail = await doRequest(`/restaurants/${sampleId}`);
    console.log('Status:', detail.status);

    console.log('\n3) GET /portfolio/summary (Protected - Owner/Admin)');
    const portfolio = await doRequest('/portfolio/summary');
    console.log('Status:', portfolio.status);
    if (portfolio.status === 200) console.log('Summary Data:', portfolio.body.data?.summary);

    console.log(`\n4) GET /restaurants/${sampleId}/stats-summary (Protected - Owner/Admin)`);
    const stats = await doRequest(`/restaurants/${sampleId}/stats-summary`);
    console.log('Status:', stats.status);

    console.log('\n5) POST /restaurants (Creation Flow Test)');
    const create = await doRequest('/restaurants', 'POST', {
      name: 'Test Restaurant ' + Date.now(),
      address: 'Test Address',
      phone: '+84900111222',
      priceRange: 2,
      cuisineTypes: ['International'],
      latitude: 10.7,
      longitude: 106.7
    });
    console.log('Status:', create.status);
    if (create.status === 201) {
      console.log('Created ID:', create.body.data.id);
      console.log('Initial Status:', create.body.data.status);
    }

    console.log('\nTests completed.');
  } catch (e) {
    console.error('Test failed:', e.message || e);
  }
}

run();

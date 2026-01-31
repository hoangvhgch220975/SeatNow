#!/usr/bin/env node
// Simple test script for restaurant-service
// Usage: node scripts/test-service.js

const http = require('http');
const https = require('https');
const url = require('url');

const BASE = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3003}`;

function doRequest(path, method = 'GET', body = null, headers = {}) {
  return new Promise((resolve, reject) => {
    const u = url.parse(BASE + path);
    const lib = u.protocol === 'https:' ? https : http;
    const opts = { hostname: u.hostname, port: u.port, path: u.path, method, headers };
    const req = lib.request(opts, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => {
        let parsed = data;
        try { parsed = JSON.parse(data); } catch (e) {}
        resolve({ status: res.statusCode, headers: res.headers, body: parsed });
      });
    });
    req.on('error', reject);
    if (body) req.write(typeof body === 'string' ? body : JSON.stringify(body));
    req.end();
  });
}

async function run() {
  console.log('Base URL:', BASE);
  try {
    console.log('\n1) GET /health');
    const h = await doRequest('/health');
    console.log(h.status, JSON.stringify(h.body));

    console.log('\n2) GET /api/v1/restaurants (public list)');
    const list = await doRequest('/api/v1/restaurants?limit=2');
    console.log(list.status, Array.isArray(list.body?.data) ? `data.length=${list.body.data.length}` : JSON.stringify(list.body));

    console.log('\n3) GET /api/v1/restaurants/:id (sample id 1)');
    const detail = await doRequest('/api/v1/restaurants/1');
    console.log(detail.status, JSON.stringify(detail.body));

    console.log('\nDone. If you see connection errors, ensure the service is running (npm start).');
  } catch (e) {
    console.error('Test failed:', e.message || e);
  }
}

run();

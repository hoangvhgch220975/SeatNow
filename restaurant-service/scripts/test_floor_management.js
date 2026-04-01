const http = require('http');
const jwt = require('jsonwebtoken');

const BASE_URL = 'http://localhost:3003/api/v1';
const RESTAURANT_ID = 'BA3FB828-C52C-4FBE-83E7-4F326A9892A2';
const JWT_SECRET = 'vhTony_24_access';
const OWNER_ID = 'B0850966-1EF4-432E-AE4F-37B0DA105F95';

function generateToken(id, role) {
  return jwt.sign({ id, role }, JWT_SECRET, { expiresIn: '1h' });
}

async function request(path, method = 'GET', token = null) {
  return new Promise((resolve, reject) => {
    const url = new URL(BASE_URL + path);
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
    req.end();
  });
}

async function runTests() {
  console.log('=== STARTING FLOOR MANAGEMENT TESTS ===');
  const token = generateToken(OWNER_ID, 'RESTAURANT_OWNER');

  try {
    // 1. Test Filter: 1st Floor
    console.log('\n--- 1. Testing Filter (1st Floor) ---');
    const filter1 = await request(`/restaurants/${RESTAURANT_ID}/tables?location=1st%20Floor`, 'GET');
    console.log('Status:', filter1.status);
    if (filter1.status === 200) {
      console.log('Tables found:', filter1.body.data.length);
      const all1st = filter1.body.data.every(t => t.location === '1st Floor');
      console.log('All matched "1st Floor":', all1st ? '✅' : '❌');
    }

    // 2. Test Statistics
    console.log('\n--- 2. Testing Floor Statistics ---');
    const stats = await request(`/restaurants/${RESTAURANT_ID}/tables/stats`, 'GET', token);
    console.log('Status:', stats.status);
    if (stats.status === 200) {
      console.log('Statistics Data:');
      console.table(stats.body.data);
    } else {
      console.error('FAIL: Statistics failed', stats.body);
    }

    console.log('\n=== TESTS COMPLETED ===');
  } catch (err) {
    console.error('ERROR:', err);
  }
}

runTests();

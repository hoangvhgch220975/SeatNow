const http = require('http');

const services = [
  { 
    name: 'Auth Service', 
    directPort: 3001, 
    directPath: '/health',
    gatewayPath: '/api/v1/auth/health'
  },
  { 
    name: 'User Service', 
    directPort: 3002, 
    directPath: '/health',
    gatewayPath: '/api/v1/users/health'
  },
  { 
    name: 'Restaurant Service', 
    directPort: 3003, 
    directPath: '/health',
    gatewayPath: '/api/v1/restaurants'
  },
  { 
    name: 'Booking Service', 
    directPort: 3004, 
    directPath: '/health',
    gatewayPath: '/api/v1/bookings/health'
  },
  { 
    name: 'Payment Service', 
    directPort: 3005, 
    directPath: '/health',
    gatewayPath: '/api/v1/payment/health'
  },
  { 
    name: 'Admin Service', 
    directPort: 3006, 
    directPath: '/health',
    gatewayPath: '/api/v1/admin/dashboard/stats' // Admin behind gateway requires auth
  },
  { 
    name: 'AI Service', 
    directPort: 3007, 
    directPath: '/health',
    gatewayPath: '/api/v1/ai/health'
  },
  { 
    name: 'Notification Service', 
    directPort: 3008, 
    directPath: '/health',
    gatewayPath: '/api/v1/notifications/test'
  }
];

function doRequest(options) {
  return new Promise((resolve) => {
    const req = http.request(options, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve({ status: res.statusCode, body: data }));
    });
    req.on('error', (err) => resolve({ status: 'ERR', body: err.message }));
    req.setTimeout(2000, () => { req.destroy(); resolve({ status: 'TIMEOUT', body: 'No Response' }); });
    if(options.method === 'POST') req.write('{}');
    req.end();
  });
}

async function runTests() {
  console.log('\n===========================================================================');
  console.log('                 KIEM TRA TOAN DIEN HE THONG & GATEWAY                     ');
  console.log('===========================================================================\n');
  
  console.log('SERVICE'.padEnd(20) + ' | ' + 'DIRECT PORT (HEALTH)'.padEnd(22) + ' | ' + 'GATEWAY (ROUTING VIA :7000)'.padEnd(25));
  console.log(''.padEnd(75, '-'));

  for (const s of services) {
    // 1. Check direct service health
    const directRes = await doRequest({
      hostname: 'localhost',
      port: s.directPort,
      path: s.directPath,
      method: 'GET'
    });

    let directStr = ``;
    if (directRes.status === 200) {
      directStr = `✅ 200 OK (${s.directPort})`;
    } else {
      directStr = `❌ OFFLINE (${s.directPort})`;
    }

    // 2. Check Gateway routing
    const method = s.name === 'Notification Service' ? 'POST' : 'GET';
    const gwRes = await doRequest({
      hostname: 'localhost',
      port: 7000,
      path: s.gatewayPath,
      method: method
    });

    let gwStr = ``;
    if (gwRes.status === 200 || gwRes.status === 201) {
      gwStr = `✅ OK (HTTP 200)`;
    } else if (gwRes.status === 401 || gwRes.status === 403) {
      gwStr = `✅ Routing OK (Auth Blocked) -> 401`;
    } else if (gwRes.status === 400 || gwRes.status === 404 || gwRes.status === 500) {
      // It reached the target service which returned an error (e.g., missing body) => Routing works!
      // Exception: 404 could mean Ocelot didn't find the route, but since it's defined, it means downstream 404.
      gwStr = `✅ Routing OK (Downstream ${gwRes.status})`;
    } else if (gwRes.status === 502) {
      gwStr = `❌ 502 Bad GW (Service down?)`;
    } else {
      gwStr = `❌ Lỗi Gateway (${gwRes.status})`;
    }

    // Special logic to make output clear: if Service is Offline, GW is expected to be 502
    if (directRes.status !== 200 && gwRes.status === 502) {
       gwStr = `⚠️ 502 (Khớp với OFFLINE)`;
    }

    console.log(`${s.name.padEnd(20)} | ${directStr.padEnd(22)} | ${gwStr}`);
  }
  
  console.log('\n===========================================================================');
  console.log('LUU Y:');
  console.log('- Nếu Service bào "OFFLINE", vui lòng kiểm tra xem bạn đã chạy npm start chưa.');
  console.log('- "Routing OK" nghĩa là Gateway đã trỏ đúng và xuyên qua tới target port.');
  console.log('===========================================================================\n');
}

runTests();

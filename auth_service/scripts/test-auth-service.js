// scripts/test-auth-service.js
// Script to exercise basic AuthService flows: register -> login -> refresh -> logout
// Requires a working DB and proper env vars (see .env.example).

require('dotenv').config();

const AuthService = require('../src/services/auth.service');

function randomSuffix() {
  return Date.now().toString(36).slice(-6);
}

async function main() {
  const suffix = randomSuffix();
  const phone = `+8490${Math.floor(Math.random() * 900000 + 100000)}`;
  const email = `test+${suffix}@example.com`;
  const name = `Test User ${suffix}`;
  const password = 'P@ssw0rd!';

  try {
    console.log('Registering user:', phone, email);
    const reg = await AuthService.register({ phone, email, name, password, accountType: 'customer' });
    console.log('Register success:', { user: reg.user });

    console.log('Logging in...');
    const login = await AuthService.login({ identifier: phone, password });
    console.log('Login success:', { user: login.user });

    console.log('Refreshing token...');
    const tokens = await AuthService.refreshToken({ refreshToken: login.refreshToken });
    console.log('Refresh success:', Object.keys(tokens));

    console.log('Logging out...');
    await AuthService.logout({ refreshToken: tokens.refreshToken });
    console.log('Logout completed.');

    process.exitCode = 0;
  } catch (err) {
    console.error('Auth service test failed:', err && err.message ? err.message : err);
    if (err && err.status) console.error('Status:', err.status);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { main };

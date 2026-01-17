// scripts/test-auth-service.js
// Script to exercise basic AuthService flows: register -> login -> refresh -> logout
// Requires a working DB and proper env vars (see .env.example).

require('dotenv').config();

const AuthService = require('../src/services/auth_service');
const { initRedis } = require('../src/config/redis');
const { getPool } = require('../src/config/db');

function randomSuffix() {
  return Date.now().toString(36).slice(-6);
}

async function main() {
  // ensure DB and Redis are initialized before running tests
  await getPool();
  await initRedis();
  const suffix = randomSuffix();
  const phone = `+8412823285`;
  const email = `test+${suffix}@example.com`;
  const name = `Test User ${suffix}`;
  const password = 'P@ssw0rd!';

  try {
    console.log('Requesting OTP for:', phone);
    await AuthService.sendOtp({ phone });
    const { RedisClient } = require('../src/config/redis');
    const redis = RedisClient.getInstance();
    const otpKey = `otp:${phone}`;
    const code = await redis.get(otpKey);
    console.log('Got OTP (from redis):', code);

    // If Twilio is configured, attempt to send the OTP SMS (test-only)
    if (process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN && process.env.TWILIO_FROM) {
      try {
        const twilio = require('twilio');
        const client = twilio(process.env.TWILIO_ACCOUNT_SID, process.env.TWILIO_AUTH_TOKEN);
        await client.messages.create({ body: `Your OTP is ${code}`, from: process.env.TWILIO_FROM, to: phone });
        console.log('OTP sent via Twilio to', phone);
      } catch (err) {
        console.warn('Failed to send SMS via Twilio:', err && err.message);
      }
    } else {
      console.log('Twilio not configured — OTP printed to console (dev).');
    }

    // Prompt user to type the OTP shown on phone/console
    const readline = require('readline');
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    const entered = await new Promise((resolve) => rl.question('Enter OTP received on phone: ', (ans) => { rl.close(); resolve(ans.trim()); }));

    console.log('Registering user:', phone, email);
    const reg = await AuthService.register({ phone, email, name, password, accountType: 'customer', otp: entered });
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

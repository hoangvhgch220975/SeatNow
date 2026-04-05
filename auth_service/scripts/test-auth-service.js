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
  const phone = `+84812823285`;
  const email = `test+${suffix}@example.com`;
  const name = `Test User ${suffix}`;
  const password = 'P@ssw0rd!';

  try {
    console.log('Requesting OTP for:', phone);
    await AuthService.sendOtp({ phone });

    const { RedisClient } = require('../src/config/redis');
    const redis = RedisClient.getInstance();
    const otpKey = `otp:${phone}`;

    // Small delay to ensure Redis write has completed
    await new Promise((r) => setTimeout(r, 100));
    const code = await redis.get(otpKey);
    console.log('Got OTP (from redis):', code ? '<hidden for safety>' : null);

    // If running locally and you want the script to auto-use the OTP, set AUTO_USE_OTP=1
    const autoMode = (process.env.AUTO_USE_OTP === '1' || process.argv.includes('--auto'));
    const maxAttempts = parseInt(process.env.OTP_MAX_VERIFY_ATTEMPTS || '5', 10);

    async function promptOtp() {
      if (autoMode) {
        if (!code) throw new Error('OTP not found in redis');
        console.log('Auto-using OTP from redis');
        return String(code).trim();
      }
      const readline = require('readline');
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      const ans = await new Promise((resolve) => rl.question('Enter OTP received on phone: ', (a) => { rl.close(); resolve(a.trim()); }));
      return ans;
    }

    console.log('Registering user:', phone, email);

    let reg = null;
    let attempt = 0;
    while (attempt < maxAttempts) {
      const entered = await promptOtp();
      try {
        reg = await AuthService.register({ phone, email, name, password, accountType: 'customer', otp: entered });
        console.log('Register success:', { user: reg.user });
        break;
      } catch (err) {
        const msg = err && err.message ? err.message : '';
        if (msg === 'OTP_INCORRECT') {
          attempt += 1;
          const remaining = Math.max(0, maxAttempts - attempt);
          console.error('OTP incorrect. Attempts left:', remaining);
          if (remaining <= 0) {
            console.error('Max attempts reached. You must request a new OTP.');
            // Ask user whether to request a new OTP
            if (autoMode) {
              console.log('Auto mode: requesting new OTP...');
              await AuthService.sendOtp({ phone });
              // refresh code from redis
              await new Promise((r) => setTimeout(r, 100));
              code = await redis.get(otpKey);
              attempt = 0;
              continue;
            } else {
              const readline = require('readline');
              const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
              const answer = await new Promise((resolve) => rl.question('Request new OTP? (y/N): ', (a) => { rl.close(); resolve(a.trim().toLowerCase()); }));
              if (answer === 'y' || answer === 'yes') {
                await AuthService.sendOtp({ phone });
                await new Promise((r) => setTimeout(r, 100));
                code = await redis.get(otpKey);
                attempt = 0;
                continue;
              }
              throw err;
            }
          }
          // otherwise loop to prompt again
          continue;
        }

        if (msg === 'OTP_EXPIRED') {
          console.error('OTP expired. Requesting a new OTP...');
          await AuthService.sendOtp({ phone });
          await new Promise((r) => setTimeout(r, 100));
          code = await redis.get(otpKey);
          attempt = 0;
          continue;
        }

        if (msg === 'OTP_MAX_ATTEMPTS_EXCEEDED') {
          console.error('OTP max attempts exceeded. Request a new OTP to continue.');
          await AuthService.sendOtp({ phone });
          await new Promise((r) => setTimeout(r, 100));
          code = await redis.get(otpKey);
          attempt = 0;
          continue;
        }

        // other errors: rethrow
        throw err;
      }
    }
    if (!reg) throw new Error('Registration failed after OTP attempts');

    console.log('Logging in...');
    const login = await AuthService.login({ identifier: phone, password });
    console.log('Login success:', { user: login.user });

    console.log('Refreshing token...');
    const tokens = await AuthService.refreshToken({ refreshToken: login.refreshToken.refreshToken });
    console.log('Refresh success:', Object.keys(tokens));

    console.log('Logging out...');
    await AuthService.logout({ refreshToken: tokens.refreshToken.refreshToken });
    console.log('Logout completed.');

    // --- New: Test Combined Forgot Password Flow ---
    console.log('--- Testing Combined Forgot Password Flow ---');
    console.log('Requesting reset for:', { phone, email });
    await AuthService.requestPasswordReset({ phone, email });
    
    // Get new OTP from redis
    await new Promise((r) => setTimeout(r, 100));
    const resetOtp = await redis.get(otpKey);
    console.log('Got Reset OTP:', resetOtp ? '<hidden>' : 'NOT_FOUND');
    
    if (resetOtp) {
      console.log('Verifying OTP and resetting password...');
      const resetResult = await AuthService.verifyAndResetPassword({ phone, otp: String(resetOtp) });
      console.log('Reset Result:', resetResult);
    }
    // -----------------------------------------------

    process.exitCode = 0;
  } catch (err) {
    console.error('Auth service test failed:', err && err.message ? err.message : err);
    if (err && err.status) console.error('Status:', err.status);
    process.exitCode = 1;
  }
}

if (require.main === module) main();

module.exports = { main };

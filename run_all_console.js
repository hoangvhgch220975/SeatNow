const { spawn, execSync } = require('child_process');
const path = require('path');
const os = require('os');

const services = [
  { name: 'AUTH', path: 'auth_service', cmd: 'npm', args: ['start'], color: '\x1b[32m' }, // Green
  { name: 'USER', path: 'user_service', cmd: 'npm', args: ['start'], color: '\x1b[34m' }, // Blue
  { name: 'RESTAURANT', path: 'restaurant-service', cmd: 'npm', args: ['start'], color: '\x1b[35m' }, // Magenta
  { name: 'BOOKING', path: 'booking-service', cmd: 'npm', args: ['start'], color: '\x1b[36m' }, // Cyan
  { name: 'PAYMENT', path: 'payment-service', cmd: 'npm', args: ['start'], color: '\x1b[33m' }, // Yellow
  { name: 'ADMIN', path: 'admin-service', cmd: 'npm', args: ['start'], color: '\x1b[31m' }, // Red
  { name: 'NOTI', path: 'notification-service', cmd: 'npm', args: ['start'], color: '\x1b[92m' }, // Light Green
  { name: 'AI', path: 'AI-service', cmd: 'py', args: ['src/main.py'], color: '\x1b[94m' }, // Light Blue
  { name: 'GATEWAY', path: 'SeatNow.GateWay/SeatNow.GateWay', cmd: 'dotnet', args: ['run'], color: '\x1b[95m' }, // Light Magenta
];

console.log('\x1b[1m🚀 Starting SeatNow Microservices in single console...\x1b[0m\n');

const children = [];

services.forEach((service) => {
  const fullPath = path.resolve(process.cwd(), service.path);
  const subprocess = spawn(service.cmd, service.args, {
    cwd: fullPath,
    shell: true,
  });

  children.push(subprocess);

  const prefix = `${service.color}[${service.name}]\x1b[0m `;

  subprocess.stdout.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
        if (line) console.log(`${prefix}${line}`);
    });
  });

  subprocess.stderr.on('data', (data) => {
    const lines = data.toString().trim().split('\n');
    lines.forEach((line) => {
        if (line) console.error(`${prefix}\x1b[31m[ERROR]\x1b[0m ${line}`);
    });
  });

  subprocess.on('close', (code) => {
    console.log(`${prefix}Exited with code ${code}`);
  });
});

process.on('SIGINT', () => {
  console.log('\nStopping all services...');
  if (os.platform() === 'win32') {
    children.forEach((child) => {
      try {
        execSync(`taskkill /pid ${child.pid} /T /F`, { stdio: 'ignore' });
      } catch (e) {
        // Ignore if process is already dead
      }
    });
  } else {
    children.forEach((child) => child.kill('SIGKILL'));
  }
  process.exit();
});

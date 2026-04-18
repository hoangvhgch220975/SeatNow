// money.js
// Purpose: Helper functions for money - formatting, rounding to the smallest currency unit,
// safe arithmetic to avoid floating point errors, converting to/from minor units (cents/xu)

function normalizeAmount(amount) {
  const n = Number(amount);
  if (!Number.isFinite(n) || n <= 0) {
    throw new Error('Invalid amount');
  }
  return Number(n.toFixed(2));
}

module.exports = { normalizeAmount };
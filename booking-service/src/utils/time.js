function toSlotKey(dateStr, timeStr) {
  return `${dateStr}:${timeStr}`;
}

function nowUtc() {
  return new Date();
}

module.exports = { toSlotKey, nowUtc };

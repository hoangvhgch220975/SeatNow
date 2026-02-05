/**
 * qr.service.js - generate QR/QRCode placeholder
 */
async function generateQR(payload) {
  // Return base64 image or buffer in real impl
  return { qr: 'data:image/png;base64,PLACEHOLDER' };
}

module.exports = { generateQR };

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

let firebaseApp = null;

function initFirebase() {
  if (firebaseApp) return firebaseApp;

  // Single method: load service-account JSON from a file path
  const serviceAccountPath = process.env.FIREBASE_SERVICE_ACCOUNT_PATH || './secrets/firebase-sa.json';

  try {
    let p = String(serviceAccountPath || '').trim();
    if ((p.startsWith('"') && p.endsWith('"')) || (p.startsWith("'") && p.endsWith("'"))) p = p.slice(1, -1).trim();
    const fullPath = path.isAbsolute(p) ? p : path.resolve(process.cwd(), p);
    if (!fs.existsSync(fullPath)) {
      console.warn('[Firebase] Service account file not found at', fullPath);
      return null;
    }

    const raw = fs.readFileSync(fullPath, 'utf8');
    const creds = JSON.parse(raw);

    firebaseApp = admin.initializeApp({
      credential: admin.credential.cert(creds)
    });
    console.log('[Firebase] initialized from', fullPath);
    return firebaseApp;
  } catch (err) {
    console.warn('[Firebase] initialization failed:', err.message || err);
    return null;
  }
}

function getFirebaseAdmin() {
  if (!firebaseApp) initFirebase();
  return firebaseApp ? admin : null;
}

function isFirebaseEnabled() {
  return !!getFirebaseAdmin();
}

module.exports = { initFirebase, getFirebaseAdmin, isFirebaseEnabled };

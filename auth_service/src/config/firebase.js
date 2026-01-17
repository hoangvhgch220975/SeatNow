const admin = require('firebase-admin');


let firebaseApp = null;

function initFirebase() {
  if (firebaseApp) return firebaseApp;

  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKeyRaw = process.env.FIREBASE_PRIVATE_KEY;

  if (!projectId || !clientEmail || !privateKeyRaw) {
    console.warn('[Firebase] Missing FIREBASE_* env. Firebase disabled.');
    return null;
  }

  const privateKey = privateKeyRaw.replace(/\\n/g, '\n');

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({ projectId, clientEmail, privateKey })
  });

  console.log('[Firebase] initialized');
  return firebaseApp;
}

function getFirebaseAdmin() {
  if (!firebaseApp) initFirebase();
  return firebaseApp ? admin : null;
}

module.exports = { initFirebase, getFirebaseAdmin };

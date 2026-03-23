/**
 * firebase.service.js - provider adapter for sending push notifications via Firebase Cloud Messaging
 */
const admin = require('firebase-admin');
require('dotenv').config();

let initialized = false;

try {
  // Try to initialize with Service Account if available
  if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY) {
    admin.initializeApp({
      credential: admin.credential.cert({
        projectId: process.env.FIREBASE_PROJECT_ID,
        clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
    });
    initialized = true;
    console.log('Firebase Admin SDK initialized using Service Account');
  } 
  // Fallback: Just Project ID (limited functionality, usually for GCE/GCP environments)
  else if (process.env.FIREBASE_PROJECT_ID) {
    admin.initializeApp({
      projectId: process.env.FIREBASE_PROJECT_ID
    });
    initialized = true;
    console.log(`Firebase Admin SDK initialized using Project ID: ${process.env.FIREBASE_PROJECT_ID}`);
  }
  else {
    console.warn('Firebase credentials missing. Firebase service will run in placeholder mode.');
  }
} catch (error) {
  console.error('Error initializing Firebase Admin SDK:', error);
}

/**
 * Send a push notification (used as SMS replacement)
 * @param {string} token - FCM token or device ID
 * @param {string} title 
 * @param {string} body 
 * @param {object} data - extra data
 */
async function sendPushNotification(token, title, body, data = {}) {
  if (!initialized) {
    console.log('[Placeholder] Sending Firebase Notification to:', token, title, body);
    return { sent: true, placeholder: true };
  }

  try {
    const message = {
      notification: { title, body },
      data: data || {},
      token,
    };

    const response = await admin.messaging().send(message);
    console.log('Successfully sent message:', response);
    return { sent: true, messageId: response };
  } catch (error) {
    console.error('Error sending Firebase message:', error);
    return { sent: false, error: error.message };
  }
}

module.exports = { sendPushNotification };

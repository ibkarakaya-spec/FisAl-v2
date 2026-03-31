import { initializeApp, getApp, getApps } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

export const isFirebaseConfigured = !!firebaseConfig.apiKey;

if (!isFirebaseConfigured) {
  console.error("Firebase API Key is missing! Please set VITE_FIREBASE_API_KEY in your environment variables.");
}

// Initialize Firebase only if config is present and not already initialized
const app = isFirebaseConfigured 
  ? (getApps().length > 0 ? getApp() : initializeApp(firebaseConfig))
  : null;

export const auth = app ? getAuth(app) : null as any;
export const db = app ? getFirestore(app, import.meta.env.VITE_FIREBASE_FIRESTORE_DATABASE_ID) : null as any;

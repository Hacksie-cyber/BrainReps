import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer } from 'firebase/firestore';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
const databaseId = (firebaseConfig as any).firestoreDatabaseId || '(default)';

// Use initializeFirestore to configure settings for proxied environments
const firestoreSettings: any = {
  experimentalForceLongPolling: true,
};

// Some environments benefit from disabling fetch streams
if (typeof window !== 'undefined') {
  firestoreSettings.useFetchStreams = false;
}

export const db = initializeFirestore(app, firestoreSettings, databaseId);

export const auth = getAuth(app);

// Connectivity check
async function testConnection() {
  try {
    // This will succeed if the user is signed in or fail with permission denied if not
    // We just want to check if the SDK can reach the project
    await getDocFromServer(doc(db, '_connection_test_', 'init'));
  } catch (error: any) {
    if (error?.code === 'permission-denied' || error?.message?.includes('permissions')) {
      // This is actually a good sign - it means we connected to the project and rules blocked us
      console.log("Firebase connection reachable (Permissions enforced).");
    } else if (error?.code === 'not-found') {
      console.log("Firebase connection established.");
    } else {
      console.error("Firebase connection error:", error);
    }
  }
}

testConnection();

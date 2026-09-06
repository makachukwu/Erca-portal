import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import firebaseConfig from '../../firebase-applet-config.json';

let app: FirebaseApp;
let db: Firestore;
let auth: Auth | null = null;

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
    tenantId?: string | null;
    providerInfo?: {
      providerId?: string | null;
      email?: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid ?? null,
      email: auth?.currentUser?.email ?? null,
      emailVerified: auth?.currentUser?.emailVerified ?? null,
      isAnonymous: auth?.currentUser?.isAnonymous ?? null,
      tenantId: auth?.currentUser?.tenantId ?? null,
      providerInfo: auth?.currentUser?.providerData?.map((provider) => ({
        providerId: provider.providerId,
        email: provider.email,
      })) || []
    },
    operationType,
    path
  };
  console.warn('Firestore Operation Notice: ', JSON.stringify(errInfo));
  return errInfo;
}

try {
  app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApp();
  
  const dbId = (firebaseConfig as any)?.firestoreDatabaseId;
  const firestoreSettings = {
    experimentalForceLongPolling: true,
  };

  try {
    db = dbId && dbId !== '(default)'
      ? initializeFirestore(app, firestoreSettings, dbId)
      : initializeFirestore(app, firestoreSettings);
  } catch {
    db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
  }

  try {
    auth = getAuth(app);
  } catch (authInitErr) {
    console.warn('Auth initialization note:', authInitErr);
  }
} catch (error) {
  console.error('Firebase initialization error, executing recovery:', error);
  app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
  try {
    const dbId = (firebaseConfig as any)?.firestoreDatabaseId;
    const firestoreSettings = { experimentalForceLongPolling: true };
    try {
      db = dbId && dbId !== '(default)'
        ? initializeFirestore(app, firestoreSettings, dbId)
        : initializeFirestore(app, firestoreSettings);
    } catch {
      db = dbId && dbId !== '(default)' ? getFirestore(app, dbId) : getFirestore(app);
    }
  } catch {
    db = getFirestore(app);
  }
  try {
    auth = getAuth(app);
  } catch {
    auth = null;
  }
}

export { app, db, auth };
export default db;

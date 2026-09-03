'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, Firestore, persistentLocalCache, persistentSingleTabManager, setLogLevel } from 'firebase/firestore';
import { getAuth, Auth } from 'firebase/auth';
import { getStorage, FirebaseStorage } from 'firebase/storage';
import { Loader2 } from 'lucide-react';
import { firebaseConfig } from './config';
import { FirebaseProvider } from './provider';

declare global {
  interface Window {
    __FIREBASE_APP__?: FirebaseApp;
    __FIREBASE_FIRESTORE__?: Firestore;
    __FIREBASE_AUTH__?: Auth;
    __FIREBASE_STORAGE__?: FirebaseStorage;
  }
}

function getFirebaseInstances() {
  if (typeof window === 'undefined') return null;

  if (!window.__FIREBASE_APP__) {
    if (!getApps().length) {
      window.__FIREBASE_APP__ = initializeApp(firebaseConfig);
    } else {
      window.__FIREBASE_APP__ = getApp();
    }
  }

  const app = window.__FIREBASE_APP__;

  if (!window.__FIREBASE_FIRESTORE__) {
    /**
     * Modern Firestore Initialization (SDK v11+)
     * Using persistentLocalCache with specialized settings 
     * to prevent INTERNAL ASSERTION FAILED errors (Unexpected state)
     * which are common in v11.9.x during background sync or hot-reloading.
     */
    try {
      window.__FIREBASE_FIRESTORE__ = initializeFirestore(app, {
        localCache: persistentLocalCache({
          tabManager: persistentSingleTabManager({}),
        }),
        // Force long polling to stabilize the internal watch stream 
        // and prevent assertion failures in managed environments.
        experimentalForceLongPolling: true,
      });
    } catch (e) {
      console.warn("Firestore re-initialization or persistent cache conflict detected.");
      // Standard fallback to prevent the app from crashing
      window.__FIREBASE_FIRESTORE__ = window.__FIREBASE_FIRESTORE__ || initializeFirestore(app, {});
    }

    setLogLevel('silent');
  }

  if (!window.__FIREBASE_AUTH__) {
    window.__FIREBASE_AUTH__ = getAuth(app);
  }

  if (!window.__FIREBASE_STORAGE__) {
    window.__FIREBASE_STORAGE__ = getStorage(app);
  }

  return {
    app: window.__FIREBASE_APP__,
    firestore: window.__FIREBASE_FIRESTORE__,
    auth: window.__FIREBASE_AUTH__,
    storage: window.__FIREBASE_STORAGE__,
  };
}

export const FirebaseClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isInitialized, setIsInitialized] = useState(false);

  const instances = useMemo(() => getFirebaseInstances(), []);

  useEffect(() => {
    setIsInitialized(true);
  }, [instances]);

  if (!instances || !isInitialized) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-indigo-50 font-kalpurush">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-black text-primary animate-pulse">লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  return (
    <FirebaseProvider 
      app={instances.app} 
      firestore={instances.firestore} 
      auth={instances.auth} 
      storage={instances.storage}
    >
      {children}
    </FirebaseProvider>
  );
};

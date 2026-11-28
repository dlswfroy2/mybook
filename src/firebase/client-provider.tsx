'use client';

import React, { useEffect, useState, useMemo } from 'react';
import { initializeApp, getApps, getApp, FirebaseApp } from 'firebase/app';
import { initializeFirestore, getFirestore, Firestore, persistentLocalCache, persistentMultipleTabManager, setLogLevel } from 'firebase/firestore';
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

  try {
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
       * Using persistentLocalCache with persistentMultipleTabManager
       * to allow seamless multi-tab usage without lock conflicts.
       */
      try {
        window.__FIREBASE_FIRESTORE__ = initializeFirestore(app, {
          localCache: persistentLocalCache({
            tabManager: persistentMultipleTabManager(),
          }),
          experimentalForceLongPolling: true,
        });
      } catch (e) {
        console.warn("Firestore re-initialization or persistent cache conflict detected, falling back to getFirestore:", e);
        try {
          window.__FIREBASE_FIRESTORE__ = getFirestore(app);
        } catch (err) {
          console.warn("Firestore fallback error:", err);
        }
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
  } catch (err) {
    console.error("Critical Firebase initialization error:", err);
    try {
      const fallbackApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
      return {
        app: fallbackApp,
        firestore: getFirestore(fallbackApp),
        auth: getAuth(fallbackApp),
        storage: getStorage(fallbackApp),
      };
    } catch (criticalErr) {
      console.error("Fatal fallback failure:", criticalErr);
      return null;
    }
  }
}

export const FirebaseClientProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  // Always start false on client for consistent hydration; SSR skips this component via 'use client'
  const [isInitialized, setIsInitialized] = useState(false);

  const instances = useMemo(() => getFirebaseInstances(), []);

  useEffect(() => {
    // getFirebaseInstances() is synchronous - set initialized immediately on mount
    setIsInitialized(true);
  }, []);

  // Hard safety fallback - maximum 500ms spinner on any device
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialized(true);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

  // Show brief spinner only during Firebase init on client
  if (!isInitialized) {
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-indigo-50 font-kalpurush">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-primary" />
          <p className="font-black text-primary animate-pulse">লোড হচ্ছে...</p>
        </div>
      </div>
    );
  }

  // If Firebase failed entirely, still wrap with provider using empty-ish fallback
  // (auth redirect will happen via AuthContext timeout)
  if (!instances) {
    console.error('[Firebase] Critical: instances is null after initialization');
    return (
      <div className="flex h-screen w-full flex-col items-center justify-center bg-indigo-50 font-kalpurush">
        <div className="flex flex-col items-center gap-4">
          <p className="font-black text-red-600">সংযোগ সমস্যা। পৃষ্ঠা রিলোড করুন।</p>
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


'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser, signOut } from 'firebase/auth';
import { 
  doc, 
  onSnapshot, 
  getDocs, 
  query, 
  collection, 
  limit, 
  setDoc, 
  serverTimestamp 
} from 'firebase/firestore';
import { useAuth as useFirebaseAuth } from '@/firebase';
import { useFirestore } from '@/firebase';
import { User, userFromDoc } from '@/lib/user';
import { defaultPermissions, availablePermissions } from '@/lib/permissions';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

interface AuthContextType {
  user: User | null;
  firebaseUser: FirebaseUser | null;
  loading: boolean;
  hasPermission: (permissionId: string) => boolean;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  firebaseUser: null,
  loading: true,
  hasPermission: () => true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const auth = useFirebaseAuth();
  const db = useFirestore();
  const [user, setUser] = useState<User | null>(null);
  const [firebaseUser, setFirebaseUser] = useState<FirebaseUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth || !db) return;

    let unsubscribeSnapshot: (() => void) | null = null;

    const unsubscribeAuth = onAuthStateChanged(auth, (fbUser) => {
      setFirebaseUser(fbUser);

      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
        unsubscribeSnapshot = null;
      }

      if (fbUser) {
        const userDocRef = doc(db, 'users', fbUser.uid);
        
        // Mark user online immediately on session init
        setDoc(userDocRef, {
          isOnline: true,
          lastActiveAt: serverTimestamp(),
          lastLoginAt: serverTimestamp()
        }, { merge: true }).catch(() => {});

        // Keep presence alive with a 45s heartbeat
        const heartbeatInterval = setInterval(() => {
          if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
            setDoc(userDocRef, {
              isOnline: true,
              lastActiveAt: serverTimestamp()
            }, { merge: true }).catch(() => {});
          }
        }, 45000);

        const handleVisibility = () => {
          if (document.visibilityState === 'visible') {
            setDoc(userDocRef, {
              isOnline: true,
              lastActiveAt: serverTimestamp()
            }, { merge: true }).catch(() => {});
          }
        };

        const handleUnload = () => {
          setDoc(userDocRef, {
            isOnline: false,
            lastActiveAt: serverTimestamp()
          }, { merge: true }).catch(() => {});
        };

        if (typeof window !== 'undefined') {
          window.addEventListener('visibilitychange', handleVisibility);
          window.addEventListener('beforeunload', handleUnload);
        }

        const docUnsub = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userData = userFromDoc(docSnap);
            // Super Admin Bypass
            if (fbUser.email?.toLowerCase() === 'dlswf.roy@gmail.com') {
              userData.role = 'admin';
              userData.permissions = availablePermissions.map(p => p.id);
            }
            setUser(userData);
            setLoading(false);
          } else {
            // Document missing fallback: Mandatory signup enforcement
            // If auth exists but no doc, the user didn't sign up via portal
            await signOut(auth);
            setUser(null);
            setLoading(false);
          }
        }, async (error) => {
            console.error("Auth Snapshot Error:", error);
            setLoading(false);
        });

        unsubscribeSnapshot = () => {
          docUnsub();
          clearInterval(heartbeatInterval);
          if (typeof window !== 'undefined') {
            window.removeEventListener('visibilitychange', handleVisibility);
            window.removeEventListener('beforeunload', handleUnload);
          }
        };
      } else {
        setUser(null);
        setLoading(false);
      }
    });

    return () => {
      if (unsubscribeSnapshot) {
        unsubscribeSnapshot();
      }
      unsubscribeAuth();
    };
  }, [auth, db]);

  const hasPermission = useCallback((permissionId: string): boolean => {
    if (!firebaseUser && !user) {
      return false;
    }
    if (user?.role === 'admin' || firebaseUser?.email?.toLowerCase() === 'dlswf.roy@gmail.com') return true;
    return user?.permissions?.includes(permissionId) ?? false;
  }, [user, firebaseUser]);

  return (
    <AuthContext.Provider value={{ user, firebaseUser, loading, hasPermission }}>
      {children}
    </AuthContext.Provider>
  );
}

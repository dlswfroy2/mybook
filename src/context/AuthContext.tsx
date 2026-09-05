'use client';

import React, { createContext, useState, useEffect, ReactNode, useCallback } from 'react';
import { onAuthStateChanged, User as FirebaseUser } from 'firebase/auth';
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
            if (userData.role === 'admin' || fbUser.email?.toLowerCase() === 'dlswf.roy@gmail.com') {
              userData.role = 'admin';
              userData.permissions = availablePermissions.map(p => p.id);
            }
            setUser(userData);
            setLoading(false);
          } else {
            try {
              const usersCountSnap = await getDocs(query(collection(db, 'users'), limit(2)));
              const isFirst = usersCountSnap.empty || (usersCountSnap.size === 1 && usersCountSnap.docs[0].id === fbUser.uid);
              const isAdm = isFirst || fbUser.email?.toLowerCase() === 'dlswf.roy@gmail.com';
              const initialPermissions = isAdm ? availablePermissions.map(p => p.id) : (defaultPermissions['teacher'] || []);
              
              const fallbackUser: User = {
                uid: fbUser.uid,
                displayName: fbUser.displayName || 'ব্যবহারকারী',
                email: fbUser.email || '',
                role: isAdm ? 'admin' : 'teacher',
                permissions: initialPermissions,
              };

              await setDoc(userDocRef, {
                uid: fbUser.uid,
                displayName: fbUser.displayName || 'ব্যবহারকারী',
                email: fbUser.email || '',
                role: isAdm ? 'admin' : 'teacher',
                status: 'active',
                permissions: initialPermissions,
                createdAt: serverTimestamp()
              }, { merge: true });

              setUser(fallbackUser);
            } catch (err) {
              const isAdm = fbUser.email?.toLowerCase() === 'dlswf.roy@gmail.com';
              const fallbackUser: User = {
                uid: fbUser.uid,
                displayName: fbUser.displayName || 'ব্যবহারকারী',
                email: fbUser.email || '',
                role: isAdm ? 'admin' : 'teacher',
                permissions: isAdm ? availablePermissions.map(p => p.id) : [],
              };
              setUser(fallbackUser);
            }
            setLoading(false);
          }
        }, async (error) => {
            const isAdm = fbUser.email?.toLowerCase() === 'dlswf.roy@gmail.com';
            const fallbackUser: User = {
              uid: fbUser.uid,
              displayName: fbUser.displayName || 'ব্যবহারকারী',
              email: fbUser.email || '',
              role: isAdm ? 'admin' : 'teacher',
              permissions: isAdm ? availablePermissions.map(p => p.id) : [],
            };
            setUser(fallbackUser);
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

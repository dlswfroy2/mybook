'use client';

import React, { createContext, useContext, useState, ReactNode, useMemo, useEffect, useCallback } from 'react';
import { getSchoolInfo, saveSchoolInfo, SchoolInfo, defaultSchoolInfo } from '@/lib/school-info';
import { useFirestore } from '@/firebase';
import { doc, onSnapshot, FirestoreError } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/GoogleTranslateProvider';

type SchoolInfoContextType = {
  schoolInfo: SchoolInfo;
  updateSchoolInfo: (newInfo: Partial<SchoolInfo>) => Promise<void>;
  isLoading: boolean;
};

const SchoolInfoContext = createContext<SchoolInfoContextType | undefined>(undefined);

export function SchoolInfoProvider({ children }: { children: ReactNode }) {
  const db = useFirestore();
  const { user } = useAuth();
  const { currentLang } = useLanguage();
  const [schoolInfo, setSchoolInfo] = useState<SchoolInfo>(defaultSchoolInfo);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) {
        setIsLoading(false);
        return;
    };

    // 1. Initial load from localStorage cache if available
    if (typeof window !== 'undefined') {
      try {
        const cached = localStorage.getItem('cached_school_info');
        if (cached) {
          const parsed = JSON.parse(cached);
          if (parsed && (parsed.name || parsed.logoUrl)) {
            setSchoolInfo(prev => ({ ...prev, ...parsed }));
            setIsLoading(false);
          }
        }
      } catch (e) {}
    }

    const docRef = doc(db, 'school', 'info');
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
        if (docSnap.exists()) {
            const data = docSnap.data();
            // Only update if there is actual meaningful data so we never overwrite with blanks
            if (data && (data.name || data.logoUrl || data.address || data.eiin)) {
              const fullInfo = { ...defaultSchoolInfo, ...data } as SchoolInfo;
              setSchoolInfo(fullInfo);
              if (typeof window !== 'undefined') {
                try { localStorage.setItem('cached_school_info', JSON.stringify(fullInfo)); } catch (e) {}
              }
            }
        }
        setIsLoading(false);
    }, async (error: FirestoreError) => {
        // Fallback to cache on quota/network error, never clear out logo or name!
        console.warn("School info snapshot warning:", error.message || error.code);
        if (typeof window !== 'undefined') {
          try {
            const cached = localStorage.getItem('cached_school_info');
            if (cached) {
              const parsed = JSON.parse(cached);
              if (parsed && (parsed.name || parsed.logoUrl)) {
                setSchoolInfo(prev => ({ ...prev, ...parsed }));
              }
            }
          } catch (e) {}
        }
        setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db, user]);

  const updateSchoolInfo = useCallback(async (newInfo: Partial<SchoolInfo>) => {
    const updatedInfo = { ...schoolInfo, ...newInfo };
    if (typeof window !== 'undefined') {
      try { localStorage.setItem('cached_school_info', JSON.stringify(updatedInfo)); } catch (e) {}
    }
    setSchoolInfo(updatedInfo);
    if (!db) return Promise.reject("Firestore not initialized");
    return saveSchoolInfo(db, updatedInfo);
  }, [db, schoolInfo]);

  const effectiveSchoolInfo = useMemo(() => {
    if (currentLang === 'en' && schoolInfo.nameEn) {
      return {
        ...schoolInfo,
        name: schoolInfo.nameEn,
      };
    }
    return schoolInfo;
  }, [schoolInfo, currentLang]);

  const value = useMemo(() => ({
    schoolInfo: effectiveSchoolInfo,
    updateSchoolInfo,
    isLoading
  }), [effectiveSchoolInfo, updateSchoolInfo, isLoading]);

  return (
    <SchoolInfoContext.Provider value={value}>
      {children}
    </SchoolInfoContext.Provider>
  );
}

export function useSchoolInfo() {
  const context = useContext(SchoolInfoContext);
  if (context === undefined) {
    return {
      schoolInfo: defaultSchoolInfo,
      updateSchoolInfo: async () => {},
      isLoading: false
    };
  }
  return context;
}
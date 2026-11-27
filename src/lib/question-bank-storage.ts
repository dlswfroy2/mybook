'use client';

import { getFirestore, doc, setDoc, deleteDoc, getDocs, collection, writeBatch, Firestore } from 'firebase/firestore';
import { getFirebaseApp } from '@/firebase/config';

export interface BankQuestion {
  id: string;
  classId: string; // e.g. "10", "9", "8", etc.
  subject: string; // e.g. "গণিত"
  chapter: string; // e.g. "২য় অধ্যায়: মুনাফা"
  type: 'mcq' | 'creative' | 'short';
  content: string; // Full formatted question text
  options?: string[]; // (ক) ... (খ) ...
  serialNo: number; // 1, 2, 3... Auto-incremented per (classId + subject + chapter + type)
  createdAt: string; // ISO
  source?: string; // 'create-question' | 'lecture-sheet' | 'manual' | 'ai'
  marks?: number; // e.g. 10 for CQ, 1 for MCQ, 2 for Short
  syncedToCloud?: boolean;
}

const STORAGE_KEY = 'topgrade_question_bank_v1';

export function normalizeText(str?: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Safely get Firestore database instance.
 */
export function getQuestionBankDb(providedDb?: Firestore | null): Firestore | null {
  if (providedDb) return providedDb;
  if (typeof window === 'undefined') return null;
  try {
    const app = getFirebaseApp();
    return getFirestore(app);
  } catch (err) {
    console.warn('Could not initialize Firestore for Question Bank:', err);
    return null;
  }
}

/**
 * Retrieve all questions stored in the local Question Bank (Fast Offline Cache).
 */
export function getBankQuestions(): BankQuestion[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch (err) {
    console.error('Failed to read question bank from localStorage', err);
    return [];
  }
}

/**
 * Save questions into localStorage cache.
 */
function saveLocalBankQuestions(list: BankQuestion[]) {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (err) {
    console.error('Failed to write question bank to localStorage', err);
  }
}

/**
 * Fetch all questions from the Central Server (Firebase Firestore cloud database),
 * and bi-directionally sync with local cache so questions from ALL devices appear!
 */
export async function fetchBankQuestionsFromFirestore(providedDb?: Firestore | null): Promise<BankQuestion[]> {
  const localList = getBankQuestions();
  const db = getQuestionBankDb(providedDb);
  if (!db) return localList;

  try {
    const snap = await getDocs(collection(db, 'questionBank'));
    const cloudQuestions: BankQuestion[] = [];
    snap.forEach(d => {
      const data = d.data() as BankQuestion;
      if (data && data.content) {
        cloudQuestions.push({
          ...data,
          id: data.id || d.id,
          syncedToCloud: true
        });
      }
    });

    // Merge cloud and local questions by ID
    const mergedMap = new Map<string, BankQuestion>();
    
    // 1. Add cloud items first
    for (const q of cloudQuestions) {
      mergedMap.set(q.id, q);
    }

    // 2. Add local items not yet in cloud, and upload them to the central server
    const pendingUploads: BankQuestion[] = [];
    for (const lq of localList) {
      if (!mergedMap.has(lq.id)) {
        mergedMap.set(lq.id, lq);
        pendingUploads.push(lq);
      }
    }

    const unifiedList = Array.from(mergedMap.values());
    saveLocalBankQuestions(unifiedList);

    // Asynchronously push any pending local items to central Firestore cloud
    if (pendingUploads.length > 0) {
      (async () => {
        try {
          const batch = writeBatch(db);
          let count = 0;
          for (const item of pendingUploads) {
            const ref = doc(db, 'questionBank', item.id);
            batch.set(ref, { ...item, syncedToCloud: true }, { merge: true });
            count++;
            if (count >= 400) break; // Firestore batch limit 500
          }
          await batch.commit();
        } catch (e) {
          console.warn('Background sync of local questions to central server failed:', e);
        }
      })();
    }

    return unifiedList;
  } catch (err) {
    console.warn('Central server fetch failed, falling back to local storage cache:', err);
    return localList;
  }
}

/**
 * Save new questions to Question Bank with auto-incremented serial number (ক্রমিক নং).
 * Automatically writes to local cache AND syncs to central cloud Firestore!
 */
export function addQuestionsToBank(
  newItems: Array<{
    classId: string;
    subject: string;
    chapter: string;
    type: 'mcq' | 'creative' | 'short';
    content: string;
    options?: string[];
    source?: string;
    marks?: number;
  }>,
  providedDb?: Firestore | null
): { addedCount: number; savedItems: BankQuestion[] } {
  if (typeof window === 'undefined') return { addedCount: 0, savedItems: [] };
  
  const existing = getBankQuestions();
  const savedItems: BankQuestion[] = [];

  for (const item of newItems) {
    const cleanClass = String(item.classId || '10').trim();
    const cleanSubj = item.subject?.trim() || 'সাধারণ';
    const cleanChap = item.chapter?.trim() || 'সাধারণ অধ্যায়';
    const cleanType = item.type || 'creative';
    const cleanContent = item.content?.trim();

    if (!cleanContent) continue;

    // Filter existing questions that share the EXACT same class, subject, chapter, and type
    const matchingExisting = existing.filter(q => 
      String(q.classId).trim() === cleanClass &&
      normalizeText(q.subject) === normalizeText(cleanSubj) &&
      normalizeText(q.chapter) === normalizeText(cleanChap) &&
      q.type === cleanType
    );

    // Find highest serial number currently recorded for this specific group
    const maxSerial = matchingExisting.reduce((max, q) => Math.max(max, q.serialNo || 0), 0);
    const newSerial = maxSerial + 1;

    const newQuestion: BankQuestion = {
      id: 'qb_' + Date.now().toString(36) + '_' + Math.random().toString(36).substr(2, 7),
      classId: cleanClass,
      subject: cleanSubj,
      chapter: cleanChap,
      type: cleanType,
      content: cleanContent,
      options: item.options || [],
      serialNo: newSerial,
      createdAt: new Date().toISOString(),
      source: item.source || 'ai',
      marks: item.marks || (cleanType === 'creative' ? 10 : cleanType === 'short' ? 2 : 1),
      syncedToCloud: false
    };

    existing.push(newQuestion);
    savedItems.push(newQuestion);
  }

  saveLocalBankQuestions(existing);

  // Sync to Central Cloud Firestore server
  const db = getQuestionBankDb(providedDb);
  if (db && savedItems.length > 0) {
    (async () => {
      try {
        const batch = writeBatch(db);
        for (const item of savedItems) {
          const docRef = doc(db, 'questionBank', item.id);
          batch.set(docRef, { ...item, syncedToCloud: true });
        }
        await batch.commit();
      } catch (cloudErr) {
        console.error('Failed to save questions to central Firestore server:', cloudErr);
      }
    })();
  }

  return { addedCount: savedItems.length, savedItems };
}

/**
 * Delete a question by its unique ID from both local cache and central server.
 */
export function deleteQuestionFromBank(id: string, providedDb?: Firestore | null): boolean {
  if (typeof window === 'undefined') return false;
  const existing = getBankQuestions();
  const filtered = existing.filter(q => q.id !== id);
  if (filtered.length === existing.length) return false;
  
  saveLocalBankQuestions(filtered);

  // Delete from Central Cloud Server
  const db = getQuestionBankDb(providedDb);
  if (db) {
    deleteDoc(doc(db, 'questionBank', id)).catch(err => {
      console.error('Failed to delete question from central Firestore server:', err);
    });
  }

  return true;
}

/**
 * Clear questions matching specific filter criteria from local and central server.
 */
export function clearQuestionsFromBank(filters?: { classId?: string; subject?: string; chapter?: string }): void {
  if (typeof window === 'undefined') return;
  if (!filters || (!filters.classId && !filters.subject && !filters.chapter)) {
    localStorage.removeItem(STORAGE_KEY);
    return;
  }
  const existing = getBankQuestions();
  const remaining = existing.filter(q => {
    if (filters.classId && String(q.classId).trim() === String(filters.classId).trim()) return false;
    if (filters.subject && normalizeText(q.subject) === normalizeText(filters.subject)) return false;
    if (filters.chapter && normalizeText(q.chapter) === normalizeText(filters.chapter)) return false;
    return true;
  });
  saveLocalBankQuestions(remaining);
}

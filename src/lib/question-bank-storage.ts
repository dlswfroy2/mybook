'use client';

import { getFirestore, doc, getDoc, setDoc, deleteDoc, Firestore } from 'firebase/firestore';
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
// Central server document stored in the permitted 'questions' Firestore collection
const CENTRAL_DOC_ID = 'central_question_bank_items';

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
 * Sync entire questions array to Central Cloud Server (Firestore: questions/central_question_bank_items).
 */
async function syncToCentralCloudDoc(db: Firestore, questionsList: BankQuestion[]) {
  try {
    const docRef = doc(db, 'questions', CENTRAL_DOC_ID);
    await setDoc(docRef, {
      id: CENTRAL_DOC_ID,
      isQuestionBank: true,
      title: 'কেন্দ্রীয় প্রশ্ন ব্যাংক ক্লাউড ডাটাবেজ',
      questions: questionsList,
      totalQuestions: questionsList.length,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    console.log(`[QuestionBank] Successfully saved ${questionsList.length} questions to central cloud server.`);
  } catch (err) {
    console.warn('[QuestionBank] Failed to save questions to central cloud server:', err);
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
    const docRef = doc(db, 'questions', CENTRAL_DOC_ID);
    const snap = await getDoc(docRef);

    let cloudQuestions: BankQuestion[] = [];
    if (snap.exists()) {
      const data = snap.data();
      if (Array.isArray(data?.questions)) {
        cloudQuestions = data.questions.map((q: any) => ({
          ...q,
          syncedToCloud: true
        }));
      }
    }

    // Merge cloud and local questions by unique ID
    const mergedMap = new Map<string, BankQuestion>();
    
    // 1. Add cloud items first
    for (const q of cloudQuestions) {
      if (q && q.id && q.content) {
        mergedMap.set(q.id, q);
      }
    }

    // 2. Add local items not yet in cloud
    let hasNewLocal = false;
    for (const lq of localList) {
      if (lq && lq.id && lq.content) {
        if (!mergedMap.has(lq.id)) {
          mergedMap.set(lq.id, { ...lq, syncedToCloud: true });
          hasNewLocal = true;
        }
      }
    }

    const unifiedList = Array.from(mergedMap.values());
    saveLocalBankQuestions(unifiedList);

    // If local had items that weren't in cloud yet, or cloud was empty: upload all unified questions to cloud
    if (hasNewLocal || (cloudQuestions.length === 0 && unifiedList.length > 0)) {
      await syncToCentralCloudDoc(db, unifiedList);
    }

    return unifiedList;
  } catch (err) {
    console.warn('Central server sync failed, falling back to local storage cache:', err);
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
      syncedToCloud: true
    };

    existing.push(newQuestion);
    savedItems.push(newQuestion);
  }

  saveLocalBankQuestions(existing);

  // Sync whole list to Central Cloud Firestore document
  const db = getQuestionBankDb(providedDb);
  if (db && savedItems.length > 0) {
    syncToCentralCloudDoc(db, existing);
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

  // Sync update to Central Cloud Server
  const db = getQuestionBankDb(providedDb);
  if (db) {
    syncToCentralCloudDoc(db, filtered);
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

  const db = getQuestionBankDb();
  if (db) {
    syncToCentralCloudDoc(db, remaining);
  }
}

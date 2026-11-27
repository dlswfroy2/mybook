'use client';

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
}

const STORAGE_KEY = 'topgrade_question_bank_v1';

export function normalizeText(str?: string): string {
  if (!str) return '';
  return str.trim().toLowerCase().replace(/\s+/g, ' ');
}

/**
 * Retrieve all questions stored in the local Question Bank.
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
 * Save new questions to Question Bank with auto-incremented serial number (ক্রমিক নং).
 *
 * Rules:
 * - Serials are maintained independently for each: (classId + subject + chapter + type)
 * - Numbering always starts from 1 (১) for each chapter & type combination.
 * - If 10 MCQs already exist for (Class 10 + Math + Chapter 2), adding more will start from 11.
 * - CQ and Short for that same chapter maintain their own separate 1-based serials.
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
  }>
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
    };

    existing.push(newQuestion);
    savedItems.push(newQuestion);
  }

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(existing));
  } catch (err) {
    console.error('Failed to write question bank to localStorage', err);
  }

  return { addedCount: savedItems.length, savedItems };
}

/**
 * Delete a question by its unique ID.
 */
export function deleteQuestionFromBank(id: string): boolean {
  if (typeof window === 'undefined') return false;
  const existing = getBankQuestions();
  const filtered = existing.filter(q => q.id !== id);
  if (filtered.length === existing.length) return false;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(filtered));
    return true;
  } catch {
    return false;
  }
}

/**
 * Clear questions matching specific filter criteria, or all if none provided.
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
  localStorage.setItem(STORAGE_KEY, JSON.stringify(remaining));
}

'use client';
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  query,
  where,
  Firestore,
  WriteBatch,
  writeBatch,
  serverTimestamp,
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';

export interface RoutineColumnConfig {
  id: string;
  type: 'period' | 'break';
  name: string;
  time?: string;
}

export const DEFAULT_ROUTINE_COLUMNS: RoutineColumnConfig[] = [
  { id: 'p1', type: 'period', name: '১ম', time: '১০:০০ - ১১:২০' },
  { id: 'p2', type: 'period', name: '২য়', time: '১১:২০ - ১২:১০' },
  { id: 'p3', type: 'period', name: '৩য়', time: '১২:১০ - ০১:০০' },
  { id: 'break', type: 'break', name: 'বিরতি', time: 'টিফিন' },
  { id: 'p4', type: 'period', name: '৪র্থ', time: '০২:০০ - ০২:৪০' },
  { id: 'p5', type: 'period', name: '৫ম', time: '০২:৪০ - ৩:২০' },
  { id: 'p6', type: 'period', name: '৬ষ্ঠ', time: '০৩:২০ - ০৪:০০' },
];

export const getRoutineColumns = async (db: Firestore, academicYear: string): Promise<RoutineColumnConfig[]> => {
  if (typeof window !== 'undefined') {
    const cached = localStorage.getItem(`routine_columns_${academicYear}`);
    if (cached) {
      try {
        const parsed = JSON.parse(cached);
        if (Array.isArray(parsed) && parsed.length > 0) return parsed;
      } catch (e) {}
    }
  }
  if (!db) return DEFAULT_ROUTINE_COLUMNS;
  try {
    const docRef = doc(db, ROUTINE_COLLECTION, `columns_${academicYear}`);
    const snap = await getDoc(docRef);
    if (snap.exists() && snap.data().columns) {
      const cols = snap.data().columns as RoutineColumnConfig[];
      if (typeof window !== 'undefined') {
        localStorage.setItem(`routine_columns_${academicYear}`, JSON.stringify(cols));
      }
      return cols;
    }
  } catch (e) {
    console.error('Error fetching routine columns:', e);
  }
  return DEFAULT_ROUTINE_COLUMNS;
};

export const saveRoutineColumns = async (db: Firestore, academicYear: string, columns: RoutineColumnConfig[]) => {
  if (typeof window !== 'undefined') {
    localStorage.setItem(`routine_columns_${academicYear}`, JSON.stringify(columns));
  }
  if (!db) return;
  const docRef = doc(db, ROUTINE_COLLECTION, `columns_${academicYear}`);
  await setDoc(docRef, { academicYear, columns, updatedAt: new Date().toISOString() }, { merge: true });
};

export interface ClassRoutine {
  id?: string;
  academicYear: string;
  className: string;
  day: string; // রবিবার, সোমবার, etc.
  periods: string[]; // Array of strings like "Subject - Teacher"
}

export const ROUTINE_COLLECTION = 'classRoutines';

// This function will create initial data if the routine is empty.
const createInitialRoutine = async (db: Firestore, academicYear: string): Promise<ClassRoutine[]> => {
    const hardcodedData: Record<string, Record<string, string[]>> = {
    '6': {
        'রবিবার': ['বাংলা ১ম - ওবায়দা', 'গণিত - ধনঞ্জয়', 'বিজ্ঞান - শান্তি', 'বা ও বি - জান্নাতুন', 'বাংলা ২য় - যুধিষ্ঠির', 'আইসিটি - শারমিন', ''],
        'সোমবার': ['কৃষি - জান্নাতুন', 'বাংলা ২য় - যুধিষ্ঠির', 'আইসিটি - শারমিন', 'বা ও বি - জান্নাতুন', 'বাংলা ১ম - ওবায়দা', 'বিজ্ঞান - শান্তি', ''],
        'মঙ্গলবার': ['ইংরেজি ১ম - আরিফুর', 'শারীরিক - মাহাবুর', 'ধর্ম - নীলা', 'ইংরেজি ২য় - যুধিষ্ঠির', 'গণিত - ধনঞ্জয়', 'শারীরিক - মাহাবুর', ''],
        'বুধবার': ['কৃষি - জান্নাতুন', 'গণিত - ধনঞ্জয়', 'ধর্ম - নীলা', 'বাংলা ২য় - যুধিষ্ঠির', 'ইংরেজি ১ম - আরিফুর', 'আইসিটি - শারমিন', ''],
        'বৃহস্পতিবার': ['বা ও বি - জান্নাতুন', 'বাংলা ২য় - যুধিষ্ঠির', 'ইংরেজি ১ম - আরিফুর', 'বাংলা ১ম - ওবায়দা', 'ইংরেজি ২য় - যুধিষ্ঠির', 'বিজ্ঞান - শান্তি', ''],
    },
    '7': {
        'রবিবার': ['ইংরেজি ১ম - আরিফুর', 'শারীরিক - ওবায়দা', 'কৃষি - মাহাবুর', 'ধর্ম - আনিছুর/নীলা', 'বিজ্ঞান - শান্তি', 'ইংরেজি ২য় - যুধিষ্ঠির', ''],
        'সোমবার': ['গণিত - ধনঞ্জয়', 'আইসিটি - শারমিন', 'বা ও বি - আনিছুর', 'কৃষি - মাহাবুর', 'কৃষি - মাহাবুর', 'শারীরিক - ওবায়দা', ''],
        'মঙ্গলবার': ['কৃষি - মাহাবুর', 'বাংলা ২য় - যুধিষ্ঠির', 'বিজ্ঞান - শান্তি', 'গণিত - ধনঞ্জয়', 'ধর্ম - আনিছুর/নীলা', 'বা ও বি - আনিছুর', ''],
        'বুধবার': ['বাংলা ১ম - ওবায়দা', 'ইংরেজি ১ম - আরিফুর', 'ইংরেজি ২য় - আরিফুর', 'কৃষি - মাহাবুর', 'গণিত - ধনঞ্জয়', 'শারীরিক - ওবায়দা', ''],
        'বৃহস্পতিবার': ['গণিত - ধনঞ্জয়', 'বা ও বি - আনিছুর', 'ইংরেজি ২য় - আরিফুর', 'বিজ্ঞান - শান্তি', 'ধর্ম - আনিছুর/নীলা', 'বাংলা ১ম - ওবায়দা', ''],
    },
    '8': {
        'রবিবার': ['বাংলা ২য় - যুধিষ্ঠির', 'ধর্ম - মাহাবুর/নীলা', 'ইংরেজি ১ম - আরিফুর', 'বিজ্ঞান - শান্তি', 'বাংলা ১ম - ওবায়দা', 'বা ও বি - আনিছুর', ''],
        'সোমবার': ['বাংলা ১ম - ওবায়দা', 'গণিত - ধনঞ্জয়', 'বাংলা ২য় - যুধিষ্ঠির', 'বাংলা ২য় - যুধিষ্ঠির', 'ইংরেজি ২য় - আরিফুর', 'ধর্ম - মাহাবুর/নীলা', ''],
        'মঙ্গলবার': ['বাংলা ২য় - যুধিষ্ঠির', 'শারীরিক - নীলা', 'বাংলা ১ম - ওবায়দা', 'গণিত - ধনঞ্জয়', 'আইসিটি - শারমিন', 'ধর্ম - মাহাবুর/নীলা', ''],
        'বুধবার': ['গণিত - ধনঞ্জয়', 'বাংলা ১ম - ওবায়দা', 'কৃষি - জান্নাতুন', 'ধর্ম - মাহাবুর/নীলা', 'বাংলা ২য় - যুধিষ্ঠির', 'আইসিটি - শারমিন', ''],
        'Thursday': ['শারীরিক - নীলা', 'কৃষি - জান্নাতুন', 'গণিত - ধনঞ্জয়', 'কৃষি - জান্নাতুন', 'ইংরেজি ১ম - আরিফুর', 'বিজ্ঞান - শান্তি', ''],
    },
    '9': {
        'রবিবার': ['গণিত - ধনঞ্জয়', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'রসায়ন/ভূগোল - ধনঞ্জয়/শারমিন', 'বাংলা ২য় - যুধিষ্ঠির', 'রসায়ন/ভূগোল - ধনঞ্জয়/শারমিন', 'বা ও বি/বিজ্ঞান - আনিছুর/শান্তি', ''],
        'Monday': ['আইসিটি - শারমিন', 'গণিত - ধনঞ্জয়', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'ইংরেজি ১ম - আরিফুর', 'গণিত - ধনঞ্জয়', 'রসায়ন/ভূগোল - ধনঞ্জয়/শারমিন', ''],
        'Tuesday': ['গণিত - ধনঞ্জয়', 'বাংলা ১ম - ওবায়দা', 'পদার্থ/ইতিহাস - ধনঞ্জয়/জান্নাতুন', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'ধর্ম - মাহাবুর/নীলা', 'বা ও বি/বিজ্ঞান - আনিছুর/শান্তি', ''],
        'Wednesday': ['ইংরেজি ২য় - আরিফুর', 'পদার্থ/ইতিহাস - ধনঞ্জয়/জান্নাতুন', 'কৃষি - মাহাবুর', 'শারীরিক - মাহাবুর', 'উচ্চতর গণিত - ধনঞ্জয়', 'কৃষি - মাহাবুর', ''],
        'Thursday': ['পদার্থ/ইতিহাস - ধনঞ্জয়/জান্নাতুন', 'গণিত - ধনঞ্জয়', 'রসায়ন/ভূগোল - ধনঞ্জয়/শারমিন', 'শারীরিক - মাহাবুর', 'উচ্চতর গণিত - ধনঞ্জয়', 'ধর্ম - মাহাবুর/নীলা', ''],
    },
    '10': {
        'রবিবার': ['আইসিটি - শারমিন', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'বাংলা ২য় - যুধিষ্ঠির', 'ইংরেজি ১ম - আরিফুর', 'বাংলা ১ম - ওবায়দা', 'গণিত - ধনঞ্জয়', ''],
        'Monday': ['আইসিটি - শারমিন', 'ধর্ম - মাহাবুর/নীলা', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'বা ও বি - আনিছুর', 'গণিত - ধনঞ্জয়', 'আইসিটি - শারমিন', ''],
        'Tuesday': ['আইসিটি - শারমিন', 'ইংরেজি ২য় - আরিফুর', 'ধর্ম - মাহাবুর/নীলা', 'ইংরেজি ২য় - আরিফুর', 'জীব/পৌরনীতি - শান্তি/জান্নাতুন', 'কৃষি - মাহাবুর', ''],
        'Wednesday': ['আইসিটি - শারমিন', 'বাংলা ১ম - ওবায়দা', 'বাংলা ২য় - যুধিষ্ঠির', 'বাংলা ১ম - ওবায়দা', 'ধর্ম - মাহাবুর/নীলা', 'ইংরেজি ১ম - আরিফুর', ''],
        'Thursday': ['বাংলা ১ম - ওবায়দা', 'ইংরেজি ১ম - আরিফুর', 'কৃষি - মাহাবুর', 'বাংলা ২য় - যুধিষ্ঠির', 'ধর্ম - মাহাবুর/নীলা', 'আইসিটি - শারমিন', ''],
    },
   };

   const routinesToSave: ClassRoutine[] = [];
   Object.keys(hardcodedData).forEach(className => {
       Object.keys(hardcodedData[className]).forEach(day => {
           routinesToSave.push({
               academicYear: academicYear,
               className,
               day,
               periods: hardcodedData[className][day]
           });
       });
   });
   
   await saveRoutinesBatch(db, routinesToSave);
   return routinesToSave;
};


// Function to get the entire routine for an academic year
export const getFullRoutine = async (db: Firestore, academicYear: string): Promise<ClassRoutine[]> => {
  if (!db) return [];
  
  const q = query(collection(db, ROUTINE_COLLECTION), where("academicYear", "==", academicYear));
  try {
    const querySnapshot = await getDocs(q);
    if (querySnapshot.empty) {
      // If no routine is found for the year, create it from hardcoded data
      return await createInitialRoutine(db, academicYear);
    }
    return querySnapshot.docs
      .filter(d => !d.id.startsWith('columns_') && !d.id.startsWith('date_') && !d.id.startsWith('standalone_') && d.data().className && d.data().day)
      .map(doc => ({ id: doc.id, ...doc.data() } as ClassRoutine));
  } catch (e: any) {
    console.error("Error getting full routine:", e);
    if (e.code === 'permission-denied') {
        const permissionError = new FirestorePermissionError({
            path: ROUTINE_COLLECTION,
            operation: 'list',
        } satisfies SecurityRuleContext);
        errorEmitter.emit('permission-error', permissionError);
    }
    return [];
  }
};


// A batch function to save multiple changes
export const saveRoutinesBatch = async (db: Firestore, routines: ClassRoutine[]) => {
    const batch: WriteBatch = writeBatch(db);

    routines.forEach(routine => {
        const { academicYear, className, day } = routine;
        const docId = `${academicYear}_${className}_${day}`;
        const docRef = doc(db, ROUTINE_COLLECTION, docId);
        
        const dataToSave: any = { ...routine };
        delete dataToSave.id;
        
        batch.set(docRef, dataToSave, { merge: true });
    });

    return batch.commit().catch(async (serverError) => {
      console.error("Error saving routines batch:", serverError);
      const permissionError = new FirestorePermissionError({
        path: ROUTINE_COLLECTION,
        operation: 'write',
        requestResourceData: routines,
      } satisfies SecurityRuleContext);
      errorEmitter.emit('permission-error', permissionError);
      throw permissionError;
    });
};

// --- Date-based Main Routine ---
export interface DateRoutineRow {
    id: string;
    date: string; // yyyy-MM-dd
    classes: Record<string, string[]>;
}

export const getDateRoutine = async (db: Firestore, academicYear: string): Promise<DateRoutineRow[]> => {
    const localKey = `date_routine_${academicYear}`;
    if (!db) {
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem(localKey);
                if (raw) return JSON.parse(raw);
            } catch {}
        }
        return [];
    }
    try {
        const docRef = doc(db, ROUTINE_COLLECTION, `date_${academicYear}`);
        const snap = await getDoc(docRef);
        if (snap.exists() && Array.isArray(snap.data()?.rows)) {
            return snap.data().rows as DateRoutineRow[];
        }
    } catch (e) {
        console.warn("Failed to load date routine from Firestore:", e);
    }
    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(localKey);
            if (raw) return JSON.parse(raw);
        } catch {}
    }
    return [];
};

export const saveDateRoutine = async (db: Firestore, academicYear: string, rows: DateRoutineRow[]): Promise<void> => {
    const localKey = `date_routine_${academicYear}`;
    if (typeof window !== 'undefined') {
        try { localStorage.setItem(localKey, JSON.stringify(rows)); } catch {}
    }
    if (!db) return;
    const docRef = doc(db, ROUTINE_COLLECTION, `date_${academicYear}`);
    await setDoc(docRef, {
        academicYear,
        type: 'date_routine',
        rows,
        updatedAt: serverTimestamp()
    }, { merge: true });
};

// --- Standalone Single-Class Routine (not merged into main routine) ---
export interface StandaloneDateRow {
    id: string;
    date: string; // yyyy-MM-dd
    periods: string[];
}

export interface StandaloneClassRoutine {
    className: string;
    academicYear: string;
    title?: string;
    dayData: Record<string, string[]>;
    dateRows: StandaloneDateRow[];
}

export const getStandaloneRoutine = async (db: Firestore, academicYear: string, className: string): Promise<StandaloneClassRoutine> => {
    const empty: StandaloneClassRoutine = { className, academicYear, title: '', dayData: {}, dateRows: [] };
    const localKey = `standalone_routine_${academicYear}_${className}`;
    if (!db) {
        if (typeof window !== 'undefined') {
            try {
                const raw = localStorage.getItem(localKey);
                if (raw) return { ...empty, ...JSON.parse(raw) };
            } catch {}
        }
        return empty;
    }
    try {
        const docRef = doc(db, ROUTINE_COLLECTION, `standalone_${academicYear}_${className}`);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
            const d = snap.data();
            return {
                className,
                academicYear,
                title: d.title || '',
                dayData: d.dayData || {},
                dateRows: Array.isArray(d.dateRows) ? d.dateRows : []
            };
        }
    } catch (e) {
        console.warn("Failed to load standalone routine from Firestore:", e);
    }
    if (typeof window !== 'undefined') {
        try {
            const raw = localStorage.getItem(localKey);
            if (raw) return { ...empty, ...JSON.parse(raw) };
        } catch {}
    }
    return empty;
};

export const saveStandaloneRoutine = async (db: Firestore, data: StandaloneClassRoutine): Promise<void> => {
    const localKey = `standalone_routine_${data.academicYear}_${data.className}`;
    if (typeof window !== 'undefined') {
        try { localStorage.setItem(localKey, JSON.stringify(data)); } catch {}
    }
    if (!db) return;
    const docRef = doc(db, ROUTINE_COLLECTION, `standalone_${data.academicYear}_${data.className}`);
    await setDoc(docRef, {
        ...data,
        type: 'standalone_routine',
        updatedAt: serverTimestamp()
    }, { merge: true });
};
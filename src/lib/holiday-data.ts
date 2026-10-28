'use client';
import {
  collection,
  doc,
  addDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
  Firestore,
  where,
  writeBatch
} from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

export interface Holiday {
  id: string; // Firestore doc ID or generated ID
  date: string; // YYYY-MM-DD
  description: string;
  type?: 'govt' | 'exam' | 'event';
}

export type NewHolidayData = Omit<Holiday, 'id'>;

const HOLIDAYS_COLLECTION_PATH = 'holidays';

export const createInitialHolidays = async (db?: Firestore | null): Promise<Holiday[]> => {
  return getHolidays(db, 2026);
};

/**
 * Automatically generates standard Bangladesh government & school academic calendar holidays
 * for any academic year (fixed national days + religious festivals + school vacations + exams).
 */
export const getDefaultHolidaysForYear = (year: number): NewHolidayData[] => {
  const holidays: NewHolidayData[] = [];

  // Helper to add date range
  const addRange = (startStr: string, endStr: string, description: string, type: 'govt' | 'exam' | 'event' = 'govt') => {
    const cur = new Date(`${startStr}T12:00:00Z`);
    const end = new Date(`${endStr}T12:00:00Z`);
    while (cur <= end) {
      holidays.push({
        date: cur.toISOString().split('T')[0],
        description,
        type
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  };

  // 1. জাতীয় ও ঐতিহাসিক দিবসসমূহ (Fixed National Days)
  holidays.push(
    { date: `${year}-02-21`, description: 'শহিদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস', type: 'govt' },
    { date: `${year}-03-26`, description: 'স্বাধীনতা ও জাতীয় দিবস', type: 'govt' },
    { date: `${year}-04-14`, description: 'বাংলা নববর্ষ (পহেলা বৈশাখ)', type: 'govt' },
    { date: `${year}-05-01`, description: 'মে দিবস ও আন্তর্জাতিক শ্রমিক দিবস', type: 'govt' },
    { date: `${year}-08-05`, description: 'জুলাই গণঅভ্যুত্থান ও জাতীয় ঐক্য দিবস', type: 'govt' },
    { date: `${year}-12-16`, description: 'মহান বিজয় দিবস', type: 'govt' },
    { date: `${year}-12-25`, description: 'যিশু খ্রিস্টের জন্মদিন (বড় দিন)', type: 'govt' }
  );

  // 2. ধর্মীয় উৎসব ও সরকার নির্ধারিত দীর্ঘ স্কুল অবকাশ (Government & School Vacation Ranges)
  if (year === 2026) {
    holidays.push(
      { date: '2026-01-17', description: 'পবিত্র শব-ই-মিরাজ', type: 'govt' },
      { date: '2026-01-23', description: 'শ্রী শ্রী সরস্বতী পূজা', type: 'govt' },
      { date: '2026-02-01', description: 'মাঘী পূর্ণিমা', type: 'govt' },
      { date: '2026-02-04', description: 'পবিত্র শব-ই-বরাত', type: 'govt' },
      { date: '2026-02-15', description: 'শ্রী শ্রী শিবরাত্রি ব্রত', type: 'govt' },
      { date: '2026-03-03', description: 'শুভ দোলযাত্রা', type: 'govt' },
      { date: '2026-04-05', description: 'ইস্টার সানডে', type: 'govt' },
      { date: '2026-04-12', description: 'বৈসাবি উৎসব', type: 'govt' },
      { date: '2026-04-13', description: 'চৈত্র সংক্রান্তি', type: 'govt' },
      { date: '2026-06-26', description: 'পবিত্র আশুরা (মহররম)', type: 'govt' },
      { date: '2026-07-29', description: 'আষাঢ়ী পূর্ণিমা', type: 'govt' },
      { date: '2026-08-12', description: 'আখেরী চাহার সোম্বা', type: 'govt' },
      { date: '2026-08-26', description: 'ঈদ-ই-মিলাদুন্নবী (সা.)', type: 'govt' },
      { date: '2026-09-04', description: 'শুভ জন্মাষ্টমী', type: 'govt' },
      { date: '2026-09-24', description: 'ফাতেমা-ই-ইয়াজদাহম', type: 'govt' },
      { date: '2026-09-26', description: 'মধু পূর্ণিমা', type: 'govt' },
      { date: '2026-10-10', description: 'শুভ মহালয়া', type: 'govt' },
      { date: '2026-10-25', description: 'শ্রী শ্রী লক্ষ্মীপূজা ও প্রবারণা পূর্ণিমা', type: 'govt' },
      { date: '2026-11-08', description: 'শ্রী শ্রী শ্যামাপূজা', type: 'govt' }
    );
    // স্কুল অবকাশসমূহ ২০২৬
    addRange('2026-02-19', '2026-03-26', 'পবিত্র রমজান, শব-ই-কদর ও ঈদ-উল-ফিতর অবকাশ', 'govt');
    addRange('2026-05-24', '2026-06-04', 'ঈদ-উল-আযহা ও গ্রীষ্মকালীন অবকাশ', 'govt');
    addRange('2026-10-18', '2026-10-22', 'শ্রী শ্রী দুর্গাপূজা অবকাশ (বিজয়া দশমী সহ)', 'govt');
    addRange('2026-12-20', '2026-12-31', 'শীতকালীন অবকাশ', 'govt');
  } else if (year === 2025) {
    holidays.push(
      { date: '2025-01-27', description: 'পবিত্র শব-ই-মিরাজ', type: 'govt' },
      { date: '2025-02-03', description: 'শ্রী শ্রী সরস্বতী পূজা', type: 'govt' },
      { date: '2025-02-15', description: 'পবিত্র শব-ই-বরাত', type: 'govt' },
      { date: '2025-03-14', description: 'শুভ দোলযাত্রা', type: 'govt' },
      { date: '2025-07-06', description: 'পবিত্র আশুরা (মহররম)', type: 'govt' },
      { date: '2025-08-16', description: 'শুভ জন্মাষ্টমী', type: 'govt' },
      { date: '2025-09-05', description: 'ঈদ-ই-মিলাদুন্নবী (সা.)', type: 'govt' }
    );
    addRange('2025-03-01', '2025-04-05', 'পবিত্র রমজান, শব-ই-কদর ও ঈদ-উল-ফিতর অবকাশ', 'govt');
    addRange('2025-06-05', '2025-06-16', 'ঈদ-উল-আযহা ও গ্রীষ্মকালীন অবকাশ', 'govt');
    addRange('2025-09-28', '2025-10-02', 'শ্রী শ্রী দুর্গাপূজা অবকাশ', 'govt');
    addRange('2025-12-20', '2025-12-31', 'শীতকালীন অবকাশ', 'govt');
  } else {
    // For other future/past years: auto-generate standard school vacation blocks
    holidays.push(
      { date: `${year}-02-10`, description: 'শ্রী শ্রী সরস্বতী পূজা', type: 'govt' },
      { date: `${year}-03-05`, description: 'পবিত্র শব-ই-বরাত', type: 'govt' },
      { date: `${year}-09-05`, description: 'শুভ জন্মাষ্টমী', type: 'govt' },
      { date: `${year}-09-20`, description: 'ঈদ-ই-মিলাদুন্নবী (সা.)', type: 'govt' }
    );
    addRange(`${year}-03-01`, `${year}-04-02`, 'পবিত্র রমজান, শব-ই-কদর ও ঈদ-উল-ফিতর অবকাশ', 'govt');
    addRange(`${year}-06-01`, `${year}-06-12`, 'ঈদ-উল-আযহা ও গ্রীষ্মকালীন অবকাশ', 'govt');
    addRange(`${year}-10-15`, `${year}-10-19`, 'শ্রী শ্রী দুর্গাপূজা অবকাশ', 'govt');
    addRange(`${year}-12-20`, `${year}-12-31`, 'শীতকালীন অবকাশ', 'govt');
  }

  // 3. একাডেমিক কার্যক্রম ও পরীক্ষা শিডিউল (Academic Exams & School Events)
  holidays.push(
    { date: `${year}-01-01`, description: 'নতুন শিক্ষাবর্ষ শুরু ও পাঠ্যপুস্তক উৎসব', type: 'event' },
    { date: `${year}-01-15`, description: 'অভিভাবক সমাবেশ ও নবীনবরণ', type: 'event' }
  );
  addRange(`${year}-04-16`, `${year}-04-26`, '১ম সাময়িক মূল্যায়ন পরীক্ষা', 'exam');
  addRange(`${year}-07-06`, `${year}-07-19`, 'অর্ধ-বার্ষিক পরীক্ষা ও ফলাফল প্রস্তুত', 'exam');
  addRange(`${year}-11-20`, `${year}-12-05`, 'বার্ষিক মূল্যায়ন পরীক্ষা', 'exam');
  holidays.push(
    { date: `${year}-12-30`, description: 'বার্ষিক পরীক্ষার ফলাফল প্রকাশ ও পুরস্কার বিতরণ', type: 'event' }
  );

  // Return strictly deduplicated by date
  const uniqueMap = new Map<string, NewHolidayData>();
  holidays.forEach(h => {
    uniqueMap.set(h.date, h);
  });

  return Array.from(uniqueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * Fetches all holidays, cleanly deduplicated by date.
 * If Firestore has saved custom holidays or modifications, they are merged cleanly.
 */
export const getHolidays = async (db?: Firestore | null, targetYear?: number): Promise<Holiday[]> => {
  const currentYear = targetYear || new Date().getFullYear();
  const defaultList = getDefaultHolidaysForYear(currentYear);
  const holidayMap = new Map<string, Holiday>();

  // 1. Populate default holidays for the year
  defaultList.forEach((dh, idx) => {
    holidayMap.set(dh.date, {
      id: `default-${currentYear}-${idx}`,
      date: dh.date,
      description: dh.description,
      type: dh.type
    });
  });

  // 2. If Firestore db is available, merge custom holidays/modifications
  if (db) {
    try {
      const q = query(collection(db, HOLIDAYS_COLLECTION_PATH), orderBy('date'));
      const snapshot = await getDocs(q);
      
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as NewHolidayData;
        if (data.date) {
          // Firestore document overrides or adds to calendar
          holidayMap.set(data.date, {
            id: docSnap.id,
            date: data.date,
            description: data.description || 'ছুটি',
            type: data.type || (data.description?.includes('পরীক্ষা') ? 'exam' : 'govt')
          });
        }
      });
    } catch (err) {
      console.warn('Could not load Firestore holidays, using auto-generated defaults:', err);
    }
  }

  // Convert to sorted array
  return Array.from(holidayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const addHoliday = async (db: Firestore, holidayData: NewHolidayData) => {
  const holidaysCollection = collection(db, HOLIDAYS_COLLECTION_PATH);
  
  // Check for duplicate on the exact date and update if already exists
  const q = query(holidaysCollection, where('date', '==', holidayData.date));
  const existing = await getDocs(q);
  
  if (!existing.empty) {
    const existingDoc = existing.docs[0];
    const docRef = doc(db, HOLIDAYS_COLLECTION_PATH, existingDoc.id);
    const batch = writeBatch(db);
    batch.update(docRef, { description: holidayData.description, type: holidayData.type || 'govt' });
    return batch.commit();
  }

  return addDoc(holidaysCollection, holidayData).catch(async (serverError) => {
    console.error('Error adding holiday:', serverError);
    const permissionError = new FirestorePermissionError({
      path: HOLIDAYS_COLLECTION_PATH,
      operation: 'create',
      requestResourceData: holidayData,
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
};

export const deleteHoliday = async (db: Firestore, id: string): Promise<void> => {
  const docRef = doc(db, HOLIDAYS_COLLECTION_PATH, id);
  return deleteDoc(docRef).catch(async (serverError) => {
    console.error('Error deleting holiday:', serverError);
    const permissionError = new FirestorePermissionError({
      path: docRef.path,
      operation: 'delete',
    });
    errorEmitter.emit('permission-error', permissionError);
    throw permissionError;
  });
};

export const isHoliday = async (
  db: Firestore,
  date: string
): Promise<Holiday | undefined> => {
  const holidaysCollection = collection(db, HOLIDAYS_COLLECTION_PATH);
  const q = query(holidaysCollection, where('date', '==', date));
  const querySnapshot = await getDocs(q);
  if (!querySnapshot.empty) {
    const d = querySnapshot.docs[0];
    return { id: d.id, ...d.data() } as Holiday;
  }
  return undefined;
};

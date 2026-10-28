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

export interface SecondaryExam {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  classes: string;
  totalDays: number;
  resultDate?: string;
  notes?: string;
}

export type NewHolidayData = Omit<Holiday, 'id'>;

const HOLIDAYS_COLLECTION_PATH = 'holidays';

export const createInitialHolidays = async (db?: Firestore | null): Promise<Holiday[]> => {
  return getHolidays(db, 2026);
};

/**
 * শিক্ষা মন্ত্রণালয় ও মাধ্যমিক ও উচ্চশিক্ষা অধিদপ্তর (মাউশি) অনুমোদিত
 * মাধ্যমিক ও নিম্ন মাধ্যমিক বিদ্যালয়ের সরকারি বাৎসরিক ছুটির তালিকা (মোট ৭৬ দিন ছুটি)।
 * এতে কোনো পরীক্ষা অন্তর্ভুক্ত নয় - পরীক্ষা সম্পূর্ণ আলাদা একাডেমিক সময়সূচি।
 */
export const getDefaultHolidaysForYear = (year: number): NewHolidayData[] => {
  const holidays: NewHolidayData[] = [];

  // Helper to add date range for secondary school vacations
  const addVacationRange = (startStr: string, endStr: string, description: string) => {
    const cur = new Date(`${startStr}T12:00:00Z`);
    const end = new Date(`${endStr}T12:00:00Z`);
    while (cur <= end) {
      holidays.push({
        date: cur.toISOString().split('T')[0],
        description,
        type: 'govt'
      });
      cur.setUTCDate(cur.getUTCDate() + 1);
    }
  };

  // ১. জাতীয় দিবসসমূহ (মাধ্যমিক বিদ্যালয়)
  holidays.push(
    { date: `${year}-02-21`, description: 'শহিদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস', type: 'govt' },
    { date: `${year}-03-26`, description: 'স্বাধীনতা ও জাতীয় দিবস', type: 'govt' },
    { date: `${year}-04-14`, description: 'বাংলা নববর্ষ (পহেলা বৈশাখ)', type: 'govt' },
    { date: `${year}-05-01`, description: 'মে দিবস ও আন্তর্জাতিক শ্রমিক দিবস', type: 'govt' },
    { date: `${year}-08-05`, description: 'জুলাই গণঅভ্যুত্থান ও জাতীয় ঐক্য দিবস', type: 'govt' },
    { date: `${year}-12-16`, description: 'মহান বিজয় দিবস', type: 'govt' },
    { date: `${year}-12-25`, description: 'যিশু খ্রিস্টের জন্মদিন (বড় দিন)', type: 'govt' }
  );

  // ২. ধর্মীয় ও অন্যান্য সরকারি ছুটি (মাধ্যমিক বিদ্যালয়ের মাউশি গেজেট অনুযায়ী)
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
    // মাধ্যমিক বিদ্যালয়ের প্রধান অবকাশসমূহ (মাউশি নির্ধারিত)
    addVacationRange('2026-02-19', '2026-03-26', 'পবিত্র রমজান, শব-ই-কদর, জুমাতুল বিদা ও ঈদ-উল-ফিতর অবকাশ');
    addVacationRange('2026-05-24', '2026-06-04', 'পবিত্র ঈদ-উল-আযহা ও গ্রীষ্মকালীন অবকাশ');
    addVacationRange('2026-10-18', '2026-10-22', 'শ্রী শ্রী দুর্গাপূজা (বিজয়া দশমী সহ) অবকাশ');
    addVacationRange('2026-12-20', '2026-12-31', 'শীতকালীন অবকাশ');
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
    addVacationRange('2025-03-01', '2025-04-05', 'পবিত্র রমজান, শব-ই-কদর ও ঈদ-উল-ফিতর অবকাশ');
    addVacationRange('2025-06-05', '2025-06-16', 'পবিত্র ঈদ-উল-আযহা ও গ্রীষ্মকালীন অবকাশ');
    addVacationRange('2025-09-28', '2025-10-02', 'শ্রী শ্রী দুর্গাপূজা অবকাশ');
    addVacationRange('2025-12-20', '2025-12-31', 'শীতকালীন অবকাশ');
  } else {
    // অন্যান্য শিক্ষাবর্ষের সাধারণ মাধ্যমিক ছুটি
    holidays.push(
      { date: `${year}-02-10`, description: 'শ্রী শ্রী সরস্বতী পূজা', type: 'govt' },
      { date: `${year}-03-05`, description: 'পবিত্র শব-ই-বরাত', type: 'govt' },
      { date: `${year}-09-05`, description: 'শুভ জন্মাষ্টমী', type: 'govt' },
      { date: `${year}-09-20`, description: 'ঈদ-ই-মিলাদুন্নবী (সা.)', type: 'govt' }
    );
    addVacationRange(`${year}-03-01`, `${year}-04-02`, 'পবিত্র রমজান, শব-ই-কদর ও ঈদ-উল-ফিতর অবকাশ');
    addVacationRange(`${year}-06-01`, `${year}-06-12`, 'পবিত্র ঈদ-উল-আযহা ও গ্রীষ্মকালীন অবকাশ');
    addVacationRange(`${year}-10-15`, `${year}-10-19`, 'শ্রী শ্রী দুর্গাপূজা অবকাশ');
    addVacationRange(`${year}-12-20`, `${year}-12-31`, 'শীতকালীন অবকাশ');
  }

  // ৩. প্রধান শিক্ষকের সংরক্ষিত ছুটি (মাধ্যমিক বিদ্যালয়ের সরকারি নীতিমালায় ৩ দিন)
  holidays.push(
    { date: `${year}-08-20`, description: 'প্রধান শিক্ষকের সংরক্ষিত ছুটি (১ম দিন)', type: 'govt' },
    { date: `${year}-09-15`, description: 'প্রধান শিক্ষকের সংরক্ষিত ছুটি (২য় দিন)', type: 'govt' },
    { date: `${year}-11-10`, description: 'প্রধান শিক্ষকের সংরক্ষিত ছুটি (৩য় দিন)', type: 'govt' }
  );

  // তারিখ অনুযায়ী কঠোরভাবে অনন্যকরণ (Deduplication)
  const uniqueMap = new Map<string, NewHolidayData>();
  holidays.forEach(h => {
    uniqueMap.set(h.date, h);
  });

  return Array.from(uniqueMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};

/**
 * মাধ্যমিক ও নিম্ন মাধ্যমিক বিদ্যালয়ের অফিশিয়াল পরীক্ষা ও মূল্যায়ন সময়সূচি।
 * এটি সম্পূর্ণ আলাদা একাডেমিক কার্যক্রম (পরীক্ষার দিনগুলো স্কুল কর্মদিবসের অন্তর্ভুক্ত)।
 */
export const getSecondarySchoolExamSchedule = (year: number): SecondaryExam[] => {
  return [
    {
      id: `exam-${year}-halfyearly`,
      title: 'ষাণ্মাসিক / অর্ধ-বার্ষিক মূল্যায়ন পরীক্ষা ও প্রাক-নির্বাচনী পরীক্ষা',
      startDate: `${year}-06-08`,
      endDate: `${year}-06-25`,
      classes: '৬ষ্ঠ হতে ১০ম শ্রেণি',
      totalDays: 15,
      resultDate: `${year}-07-10`,
      notes: '১০ম শ্রেণির শিক্ষার্থীদের প্রাক-নির্বাচনী পরীক্ষা এই সময়ে অনুষ্ঠিত হবে।'
    },
    {
      id: `exam-${year}-annual`,
      title: 'বার্ষিক মূল্যায়ন পরীক্ষা ও নির্বাচনী পরীক্ষা (এসএসসি টেস্ট)',
      startDate: `${year}-11-18`,
      endDate: `${year}-12-06`,
      classes: '৬ষ্ঠ হতে ১০ম শ্রেণি',
      totalDays: 16,
      resultDate: `${year}-12-28`,
      notes: '১০ম শ্রেণির নির্বাচনী (টেস্ট) পরীক্ষা ও ৬ষ্ঠ-৯ম শ্রেণির চূড়ান্ত বার্ষিক মূল্যায়ন।'
    },
    {
      id: `exam-${year}-bookfest`,
      title: 'জাতীয় পাঠ্যপুস্তক উৎসব ও ওরিয়েন্টেশন',
      startDate: `${year}-01-01`,
      endDate: `${year}-01-01`,
      classes: '৬ষ্ঠ হতে ১০ম শ্রেণি',
      totalDays: 1,
      notes: 'নতুন বছরের পাঠ্যপুস্তক বিতরণ ও শিক্ষার্থীদের ক্লাস পরিচিতি।'
    }
  ];
};

/**
 * মাধ্যমিক বিদ্যালয়ের ছুটির তালিকা লোড করার ফাংশন (অনন্যকরণ সহ)।
 */
export const getHolidays = async (db?: Firestore | null, targetYear?: number): Promise<Holiday[]> => {
  const currentYear = targetYear || new Date().getFullYear();
  const defaultList = getDefaultHolidaysForYear(currentYear);
  const holidayMap = new Map<string, Holiday>();

  // ১. মাধ্যমিক বিদ্যালয়ের স্ট্যান্ডার্ড ডিফল্ট ছুটি লোড
  defaultList.forEach((dh, idx) => {
    holidayMap.set(dh.date, {
      id: `default-${currentYear}-${idx}`,
      date: dh.date,
      description: dh.description,
      type: 'govt'
    });
  });

  // ২. ফায়ারস্টোরে কাস্টম কোনো ছুটি থাকলে তা মার্জ করা (যদি তা পরীক্ষা না হয়)
  if (db) {
    try {
      const q = query(collection(db, HOLIDAYS_COLLECTION_PATH), orderBy('date'));
      const snapshot = await getDocs(q);
      
      snapshot.docs.forEach((docSnap) => {
        const data = docSnap.data() as NewHolidayData;
        if (data.date) {
          // কোনো পরীক্ষা যদি পূর্বে ফায়ারস্টোরে সেভ হয়েও থাকে, তা ছুটির তালিকায় রাখা যাবে না
          const isExam = data.type === 'exam' || data.description?.includes('পরীক্ষা') || data.description?.includes('মূল্যায়ন');
          if (!isExam) {
            holidayMap.set(data.date, {
              id: docSnap.id,
              date: data.date,
              description: data.description || 'ছুটি',
              type: 'govt'
            });
          }
        }
      });
    } catch (err) {
      console.warn('Could not load Firestore holidays, using auto-generated defaults:', err);
    }
  }

  return Array.from(holidayMap.values()).sort((a, b) => a.date.localeCompare(b.date));
};

export const addHoliday = async (db: Firestore, holidayData: NewHolidayData) => {
  const holidaysCollection = collection(db, HOLIDAYS_COLLECTION_PATH);
  
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

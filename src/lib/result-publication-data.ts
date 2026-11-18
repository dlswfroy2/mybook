import { Firestore, doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';

export type ExamPublicationStatus = 'published' | 'hidden' | 'scheduled';

export interface ExamPublicationRule {
  examName: string;
  academicYear: string;
  status: ExamPublicationStatus;
  publishDateTime?: string; // Format: "YYYY-MM-DDTHH:mm" e.g. "2026-11-20T10:00"
  customNotice?: string;
}

export interface ResultPublicationConfig {
  allowedAcademicYears: string[]; // List of years allowed for public result search e.g. ['2026', '2025']
  globalNotice?: string;
  rules: Record<string, ExamPublicationRule>; // Key: `${academicYear}_${examName}`
  updatedAt?: any;
  updatedBy?: string;
}

export const RESULT_PUBLICATION_DOC = 'result_publication';

export const toBengaliNumber = (str: string | number | undefined | null): string => {
  if (str === undefined || str === null || str === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export const formatBengaliDateTime = (dateTimeStr?: string): string => {
  if (!dateTimeStr) return '';
  try {
    const d = new Date(dateTimeStr);
    if (isNaN(d.getTime())) return dateTimeStr;

    const day = toBengaliNumber(d.getDate());
    const monthNames = [
      'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
      'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
    ];
    const month = monthNames[d.getMonth()];
    const year = toBengaliNumber(d.getFullYear());

    let hours = d.getHours();
    const minutes = toBengaliNumber(d.getMinutes().toString().padStart(2, '0'));
    const ampm = hours >= 12 ? 'বিকাল / সন্ধ্যা' : 'সকাল';
    const displayHours = hours % 12 || 12;
    const hourStr = toBengaliNumber(displayHours);

    return `${day} ${month} ${year}, ${ampm} ${hourStr}:${minutes}`;
  } catch {
    return dateTimeStr;
  }
};

export const getResultPublicationConfig = async (db: Firestore): Promise<ResultPublicationConfig> => {
  try {
    const docRef = doc(db, 'config', RESULT_PUBLICATION_DOC);
    const snap = await getDoc(docRef);
    if (snap.exists()) {
      const data = snap.data() as ResultPublicationConfig;
      return {
        allowedAcademicYears: data.allowedAcademicYears || [],
        globalNotice: data.globalNotice || '',
        rules: data.rules || {},
        updatedAt: data.updatedAt,
        updatedBy: data.updatedBy
      };
    }
  } catch (err) {
    console.error("Error loading result publication config:", err);
  }

  // Default fallback
  const currentYear = new Date().getFullYear().toString();
  return {
    allowedAcademicYears: [currentYear],
    globalNotice: '',
    rules: {}
  };
};

export const saveResultPublicationConfig = async (
  db: Firestore,
  config: Partial<ResultPublicationConfig>,
  userEmail?: string
): Promise<void> => {
  const docRef = doc(db, 'config', RESULT_PUBLICATION_DOC);
  await setDoc(docRef, {
    ...config,
    updatedAt: serverTimestamp(),
    updatedBy: userEmail || 'admin'
  }, { merge: true });
};

export interface VisibilityCheckResult {
  isVisible: boolean;
  reason: 'allowed' | 'year_hidden' | 'exam_hidden' | 'scheduled';
  message: string;
  publishDateTime?: string;
  formattedDateTime?: string;
}

export const checkResultVisibility = (
  config: ResultPublicationConfig | null | undefined,
  academicYear: string,
  examName: string,
  isAdminOrTeacher = false
): VisibilityCheckResult => {
  // Teachers and Admins have unrestricted access
  if (isAdminOrTeacher) {
    return {
      isVisible: true,
      reason: 'allowed',
      message: 'প্রশাসনিক অনুমতি প্রাপ্ত'
    };
  }

  // If no config found yet, allow default view
  if (!config) {
    return {
      isVisible: true,
      reason: 'allowed',
      message: 'প্রকাশিত'
    };
  }

  // 1. Check if Academic Year is allowed
  if (config.allowedAcademicYears && config.allowedAcademicYears.length > 0) {
    if (!config.allowedAcademicYears.includes(academicYear)) {
      return {
        isVisible: false,
        reason: 'year_hidden',
        message: `${toBengaliNumber(academicYear)} শিক্ষাবর্ষের ফলাফল সাধারণ অনুসন্ধানের জন্য বর্তমানে উন্মুক্ত নয়।`
      };
    }
  }

  // 2. Check exam-specific rule
  const ruleKey = `${academicYear}_${examName}`;
  const rule = config.rules?.[ruleKey];

  if (!rule) {
    // If no rule set for this exam, it is visible by default
    return {
      isVisible: true,
      reason: 'allowed',
      message: 'প্রকাশিত'
    };
  }

  // Exam is explicitly hidden
  if (rule.status === 'hidden') {
    return {
      isVisible: false,
      reason: 'exam_hidden',
      message: rule.customNotice?.trim() || `"${examName}"-এর ফলাফল বর্তমানে অপ্রকাশিত/হাইড রয়েছে।`
    };
  }

  // Exam has a scheduled release time
  if (rule.status === 'scheduled') {
    if (rule.publishDateTime) {
      const now = new Date().getTime();
      const scheduledTime = new Date(rule.publishDateTime).getTime();

      if (!isNaN(scheduledTime) && now < scheduledTime) {
        const formatted = formatBengaliDateTime(rule.publishDateTime);
        return {
          isVisible: false,
          reason: 'scheduled',
          publishDateTime: rule.publishDateTime,
          formattedDateTime: formatted,
          message: rule.customNotice?.trim() || `"${examName}"-এর ফলাফল প্রকাশের নির্ধারিত সময়: ${formatted}। নির্ধারিত সময়ের পূর্বে ফলাফল দেখতে পারবেন না।`
        };
      }
    }
    // Time has passed -> visible
    return {
      isVisible: true,
      reason: 'allowed',
      message: 'প্রকাশিত'
    };
  }

  return {
    isVisible: true,
    reason: 'allowed',
    message: 'প্রকাশিত'
  };
};


"use client";

import { useState, useMemo, useEffect, useRef } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, addDoc, deleteDoc, doc, serverTimestamp, updateDoc, orderBy } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  BookOpen, 
  Plus, 
  Trash2, 
  Edit, 
  Save, 
  Calendar, 
  Loader2, 
  ArrowLeft, 
  FileText, 
  Printer,
  ChevronRight,
  AlertTriangle,
  ExternalLink,
  MessageSquare,
  Phone
} from 'lucide-react';
import { CLASSES, getSubjectsForClass, getChaptersForSubject, HIGHER_SUBJECTS } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { format, addDays } from 'date-fns';
import { bn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { Badge } from '@/components/ui/badge';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { getFullRoutine, getDateRoutine, getStandaloneRoutine, ClassRoutine, DateRoutineRow, StandaloneClassRoutine } from '@/lib/routine-data';
import { subjectNameNormalization as baseSubjectNorm } from '@/lib/subjects';

type ChapterStatus = 'planned' | 'running' | 'completed';

type PlanRow = {
  id: string;
  existingId?: string;
  date: string;
  topic: string;
  notes: string;
  lessonTypes: string[];
  chapterStatus: ChapterStatus;
  coveredPortion: string;
};

const CHAPTER_STATUS_META: Record<ChapterStatus, { label: string; badgeClass: string }> = {
  planned: { label: '📝 পরিকল্পিত', badgeClass: 'bg-slate-100 text-slate-800 border-slate-300' },
  running: { label: '⏳ চলমান', badgeClass: 'bg-amber-100 text-amber-900 border-amber-400' },
  completed: { label: '✅ সম্পন্ন', badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-400' },
};

const getLessonTypeOptions = (subject: string): string[] => {
  if (!subject) return [];
  if (subject.includes('ইংরেজি প্রথম')) {
    return ['Passage (Seen/Unseen)', 'Lecture Sheet', 'MCQ & Short Q', 'Summary / Flowchart', 'Writing (Paragraph/Letter)', 'Model Test', 'Home Work'];
  }
  if (subject.includes('ইংরেজি দ্বিতীয়') || subject.includes('ইংরেজি')) {
    return ['Grammar', 'Lecture Sheet', 'Cloze / Gap Filling', 'Paragraph', 'Letter / Application', 'Email / Dialogue', 'Composition / CV', 'Model Test'];
  }
  if (subject.includes('বাংলা দ্বিতীয়')) {
    return ['ব্যাকরণ', 'লেকচার শিট', 'বহুনির্বাচনী (MCQ)', 'অনুচ্ছেদ / সারাংশ', 'পত্র / আবেদনপত্র', 'ভাবসম্প্রসারণ', 'রচনা / প্রতিবেদন', 'শ্রেণি পরীক্ষা'];
  }
  return ['মূল পাঠ / বই', 'লেকচার শিট', 'সৃজনশীল (CQ)', 'বহুনির্বাচনী (MCQ)', 'গাণিতিক সমস্যা / অনুশীলনী', 'শ্রেণি পরীক্ষা', 'বাড়ির কাজ'];
};

const DIARY_SUBJ_NORM: Record<string, string> = {
  ...baseSubjectNorm,
  'শারীরিক': 'শারীরিক শিক্ষা',
  'ধর্ম': 'ধর্ম ও নৈতিক শিক্ষা',
  'বা ও বি': 'বাংলাদেশ ও বিশ্ব পরিচয়',
  'বিজ্ঞান': 'সাধারণ বিজ্ঞান',
  'ইতিহাস': 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা',
  'ভূগোল': 'ভূগোল ও পরিবেশ',
  'পৌরনীতি': 'পৌরনীতি ও নাগরিকতা',
  'জীব': 'জীব বিজ্ঞান',
  'কৃষি': 'কৃষি শিক্ষা',
  'উচ্চতর': 'উচ্চতর গণিত',
  'বাংলা ১ম': 'বাংলা প্রথম',
  'বাংলা ২য়': 'বাংলা দ্বিতীয়',
  'ইংরেজি ১ম': 'ইংরেজি প্রথম',
  'ইংরেজি ২য়': 'ইংরেজি দ্বিতীয়',
  'আইসিটি': 'তথ্য ও যোগাযোগ প্রযুক্তি',
};

const DAY_INDEX_MAP: Record<string, number> = {
  'রবিবার': 0, 'সোমবার': 1, 'মঙ্গলবার': 2, 'বুধবার': 3, 'বৃহস্পতিবার': 4, 'শুক্রবার': 5, 'শনিবার': 6
};

const MONTHS_BN = [
  { id: '01', name: 'জানুয়ারি' },
  { id: '02', name: 'ফেব্রুয়ারি' },
  { id: '03', name: 'মার্চ' },
  { id: '04', name: 'এপ্রিল' },
  { id: '05', name: 'মে' },
  { id: '06', name: 'জুন' },
  { id: '07', name: 'জুলাই' },
  { id: '08', name: 'আগস্ট' },
  { id: '09', name: 'সেপ্টেম্বর' },
  { id: '10', name: 'অক্টোবর' },
  { id: '11', name: 'নভেম্বর' },
  { id: '12', name: 'ডিসেম্বর' },
];

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

export default function TeacherDiaryPage() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const { selectedYear: academicYear } = useAcademicYear();
  const [isAdding, setIsAdding] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [selectedMonth, setSelectedMonth] = useState(format(new Date(), 'MM'));
  const [selectedYear, setSelectedYear] = useState(format(new Date(), 'yyyy'));
  const [filterClass, setFilterClass] = useState('all');
  const [filterSubject, setFilterSubject] = useState('all');

  const [routineRecords, setRoutineRecords] = useState<ClassRoutine[]>([]);
  const [dateRoutineRows, setDateRoutineRows] = useState<DateRoutineRow[]>([]);
  const [standaloneRoutine, setStandaloneRoutine] = useState<StandaloneClassRoutine | null>(null);
  const [routineSourceFilter, setRoutineSourceFilter] = useState<'main' | 'standalone' | 'both'>('main');

  const [formData, setFormData] = useState({
    date: format(new Date(), 'yyyy-MM-dd'),
    classId: '',
    subject: '',
    topic: '',
    notes: ''
  });

  const [planRows, setPlanRows] = useState<PlanRow[]>([
    { id: 'row_1', date: format(new Date(), 'yyyy-MM-dd'), topic: '', notes: '', lessonTypes: [], chapterStatus: 'running', coveredPortion: '' }
  ]);
  const lastLoadedKeyRef = useRef<string>('');

  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!userLoading && !user) window.location.href = '/auth';
  }, [user, userLoading]);

  useEffect(() => {
    if (!db || !academicYear) return;
    Promise.all([
      getFullRoutine(db, academicYear),
      getDateRoutine(db, academicYear)
    ]).then(([full, dateRows]) => {
      setRoutineRecords(full);
      setDateRoutineRows(dateRows);
    });
  }, [db, academicYear]);

  useEffect(() => {
    if (!db || !academicYear || !formData.classId) {
      setStandaloneRoutine(null);
      return;
    }
    getStandaloneRoutine(db, academicYear, formData.classId).then(setStandaloneRoutine);
  }, [db, academicYear, formData.classId]);

  const diaryQuery = useMemo(() => {
    if (!db || !user) return null;
    return query(
      collection(db, 'diary'), 
      where('userId', '==', user.uid),
      orderBy('date', 'asc')
    );
  }, [db, user]);

  const { data: diaryEntries, loading: diaryLoading, error: diaryError } = useCollection(diaryQuery);

  const filteredEntries = useMemo(() => {
    if (!diaryEntries) return [];
    return diaryEntries.filter(entry => {
      const entryDate = new Date(entry.date);
      const m = format(entryDate, 'MM');
      const y = format(entryDate, 'yyyy');
      
      const matchMonth = m === selectedMonth && y === selectedYear;
      const matchClass = filterClass === 'all' || entry.classId === filterClass;
      const matchSubject = filterSubject === 'all' || entry.subject === filterSubject;
      
      return matchMonth && matchClass && matchSubject;
    });
  }, [diaryEntries, selectedMonth, selectedYear, filterClass, filterSubject]);

  const subjectsList = useMemo(() => formData.classId ? getSubjectsForClass(formData.classId) : [], [formData.classId]);
  const chaptersList = useMemo(() => (formData.classId && formData.subject) ? getChaptersForSubject(formData.classId, formData.subject) : [], [formData.classId, formData.subject]);
  const lessonTypeOptions = useMemo(() => getLessonTypeOptions(formData.subject), [formData.subject]);

  const existingPlansForSubject = useMemo(() => {
    if (!diaryEntries || !formData.classId || !formData.subject) return [];
    return diaryEntries
      .filter(e => e.classId === formData.classId && e.subject === formData.subject)
      .sort((a, b) => (a.date || '').localeCompare(b.date || ''));
  }, [diaryEntries, formData.classId, formData.subject]);

  const chapterProgressMap = useMemo(() => {
    const map: Record<string, { status: 'pending' | ChapterStatus; coveredTypes: string[]; lastPortion: string; lastDate: string; count: number }> = {};
    const addRecord = (topic: string, status: ChapterStatus, types: string[], portion: string, date: string) => {
      if (!topic) return;
      if (!map[topic]) {
        map[topic] = { status: 'pending', coveredTypes: [], lastPortion: '', lastDate: '', count: 0 };
      }
      const entry = map[topic];
      entry.count += 1;
      if (status === 'completed') {
        entry.status = 'completed';
      } else if (entry.status !== 'completed') {
        entry.status = status || 'running';
      }
      types.forEach(t => {
        if (t && !entry.coveredTypes.includes(t)) entry.coveredTypes.push(t);
      });
      if (!entry.lastDate || date >= entry.lastDate) {
        entry.lastDate = date;
        if (portion) entry.lastPortion = portion;
      }
    };

    existingPlansForSubject.forEach(p => {
      addRecord(p.topic || '', (p.chapterStatus || 'running') as ChapterStatus, Array.isArray(p.lessonTypes) ? p.lessonTypes : [], p.coveredPortion || '', p.date || '');
    });

    planRows.forEach(r => {
      if (!r.topic || (!r.notes && !r.coveredPortion && r.lessonTypes.length === 0 && !r.existingId)) return;
      if (!r.existingId) {
        addRecord(r.topic, r.chapterStatus, r.lessonTypes, r.coveredPortion, r.date);
      }
    });

    return map;
  }, [existingPlansForSubject, planRows]);

  useEffect(() => {
    if (!isAdding) {
      lastLoadedKeyRef.current = '';
      return;
    }
    if (editingId) return;
    if (!formData.classId || !formData.subject) return;
    const key = `${formData.classId}__${formData.subject}`;
    if (lastLoadedKeyRef.current === key) return;
    lastLoadedKeyRef.current = key;

    if (existingPlansForSubject.length > 0) {
      setPlanRows(
        existingPlansForSubject.map(p => ({
          id: `saved_${p.id}`,
          existingId: p.id,
          date: p.date,
          topic: p.topic || '',
          notes: p.notes || '',
          lessonTypes: Array.isArray(p.lessonTypes) ? p.lessonTypes : [],
          chapterStatus: (p.chapterStatus || 'running') as ChapterStatus,
          coveredPortion: p.coveredPortion || '',
        }))
      );
    } else {
      setPlanRows([{ id: 'row_1', date: format(new Date(), 'yyyy-MM-dd'), topic: '', notes: '', lessonTypes: [], chapterStatus: 'running', coveredPortion: '' }]);
    }
  }, [isAdding, editingId, formData.classId, formData.subject, existingPlansForSubject]);

  const linkedRoutineSchedule = useMemo(() => {
    if (!formData.classId || !formData.subject) return { days: [] as { day: string; period: number; teacher: string; source: string }[], dates: [] as { date: string; period: number; teacher: string; source: string }[] };
    const targetNorm = DIARY_SUBJ_NORM[formData.subject] || formData.subject;

    const cellMatchesSubject = (cell: string) => {
      if (!cell) return { match: false, teacher: '' };
      const parts = cell.trim().split(' - ');
      const teacher = parts.length > 1 ? parts.pop()?.trim() || '' : '';
      const subjPart = parts.join(' - ').trim();
      const subParts = subjPart.split('/').map(s => s.trim());
      const match = subParts.some(sp => {
        const spNorm = DIARY_SUBJ_NORM[sp] || sp;
        return sp === formData.subject || spNorm === targetNorm || spNorm.includes(targetNorm) || targetNorm.includes(spNorm);
      });
      return { match, teacher };
    };

    const days: { day: string; period: number; teacher: string; source: string }[] = [];
    const dates: { date: string; period: number; teacher: string; source: string }[] = [];

    // 1. Main day-based routine
    if (routineSourceFilter === 'main' || routineSourceFilter === 'both') {
      routineRecords
        .filter(r => r.className === formData.classId)
        .forEach(r => {
          (r.periods || []).forEach((cell, idx) => {
            const { match, teacher } = cellMatchesSubject(cell);
            if (match) days.push({ day: r.day, period: idx + 1, teacher, source: 'মেইন রুটিন' });
          });
        });
    }

    // 2. Standalone day-based routine
    if ((routineSourceFilter === 'standalone' || routineSourceFilter === 'both') && standaloneRoutine?.dayData) {
      Object.entries(standaloneRoutine.dayData).forEach(([day, periods]) => {
        (periods || []).forEach((cell, idx) => {
          const { match, teacher } = cellMatchesSubject(cell);
          if (match) days.push({ day, period: idx + 1, teacher, source: standaloneRoutine.title || 'স্বতন্ত্র রুটিন' });
        });
      });
    }

    // 3. Main date-based routine
    if (routineSourceFilter === 'main' || routineSourceFilter === 'both') {
      dateRoutineRows.forEach(row => {
        const periods = row.classes?.[formData.classId] || [];
        periods.forEach((cell, idx) => {
          const { match, teacher } = cellMatchesSubject(cell);
          if (match && row.date) dates.push({ date: row.date, period: idx + 1, teacher, source: 'তারিখ রুটিন' });
        });
      });
    }

    // 4. Standalone date-based routine
    if ((routineSourceFilter === 'standalone' || routineSourceFilter === 'both') && standaloneRoutine?.dateRows) {
      standaloneRoutine.dateRows.forEach(row => {
        (row.periods || []).forEach((cell, idx) => {
          const { match, teacher } = cellMatchesSubject(cell);
          if (match && row.date) dates.push({ date: row.date, period: idx + 1, teacher, source: standaloneRoutine.title || 'স্বতন্ত্র তারিখ রুটিন' });
        });
      });
    }

    return { days, dates };
  }, [formData.classId, formData.subject, routineRecords, dateRoutineRows, standaloneRoutine, routineSourceFilter]);

  const getNearestDateForDay = (dayName: string) => {
    const targetDayIdx = DAY_INDEX_MAP[dayName];
    if (targetDayIdx === undefined) return format(new Date(), 'yyyy-MM-dd');
    const today = new Date();
    const diff = (targetDayIdx - today.getDay() + 7) % 7;
    return format(addDays(today, diff), 'yyyy-MM-dd');
  };

  const getRoutineForDate = (dateStr: string) => {
    if (!dateStr || !formData.classId) return null;
    const d = new Date(dateStr.replace(/-/g, '/'));
    if (isNaN(d.getTime())) return null;
    const dayIdx = d.getDay();
    const dayName = Object.keys(DAY_INDEX_MAP).find(k => DAY_INDEX_MAP[k] === dayIdx) || '';
    const isWeekend = dayIdx === 5 || dayIdx === 6;

    const targetNorm = formData.subject ? (DIARY_SUBJ_NORM[formData.subject] || formData.subject) : '';
    const cellMatches = (cell: string) => {
      if (!cell || !formData.subject) return false;
      const parts = cell.trim().split(' - ');
      const subjPart = (parts.length > 1 ? parts.slice(0, -1).join(' - ') : parts[0]).trim();
      return subjPart.split('/').some(sp => {
        const s = sp.trim();
        const sNorm = DIARY_SUBJ_NORM[s] || s;
        return s === formData.subject || sNorm === targetNorm || sNorm.includes(targetNorm) || targetNorm.includes(sNorm);
      });
    };

    const dayPeriods: { period: number; cell: string; isSubjectMatch: boolean; source: string }[] = [];
    const matchedPeriods: { period: number; cell: string; source: string }[] = [];

    const collectPeriods = (periods: string[] | undefined, source: string) => {
      if (!periods) return;
      periods.forEach((cell, idx) => {
        if (!cell) return;
        const isMatch = cellMatches(cell);
        dayPeriods.push({ period: idx + 1, cell, isSubjectMatch: isMatch, source });
        if (isMatch) matchedPeriods.push({ period: idx + 1, cell, source });
      });
    };

    // Date-based main & standalone for this exact date
    if (routineSourceFilter === 'main' || routineSourceFilter === 'both') {
      const mainDateRow = dateRoutineRows.find(r => r.date === dateStr);
      collectPeriods(mainDateRow?.classes?.[formData.classId], 'তারিখ রুটিন');
    }
    if (routineSourceFilter === 'standalone' || routineSourceFilter === 'both') {
      const standaloneDateRow = standaloneRoutine?.dateRows?.find(r => r.date === dateStr);
      collectPeriods(standaloneDateRow?.periods, standaloneRoutine?.title || 'স্বতন্ত্র তারিখ');
    }

    // Day-based main & standalone for this weekday
    if (routineSourceFilter === 'main' || routineSourceFilter === 'both') {
      const mainDayRec = routineRecords.find(r => r.className === formData.classId && r.day === dayName);
      collectPeriods(mainDayRec?.periods, 'মেইন রুটিন');
    }
    if ((routineSourceFilter === 'standalone' || routineSourceFilter === 'both') && standaloneRoutine?.dayData?.[dayName]) {
      collectPeriods(standaloneRoutine.dayData[dayName], standaloneRoutine.title || 'স্বতন্ত্র রুটিন');
    }

    return {
      dayName,
      isWeekend,
      hasSubject: matchedPeriods.length > 0,
      matchedPeriods,
      dayPeriods
    };
  };

  const applyDateToPlanRow = (dateStr: string) => {
    const alreadyExistsInRows = planRows.some(r => r.date === dateStr);
    if (alreadyExistsInRows) {
      toast({ title: "তারিখটি রয়েছে", description: "এই তারিখের পরিকল্পনা ইতোমধ্যে নিচে দেখানো হয়েছে।" });
      return;
    }
    const saved = existingPlansForSubject.find(p => p.date === dateStr);
    setPlanRows(prev => {
      if (prev.some(r => r.date === dateStr)) return prev;
      const emptyIdx = prev.findIndex(r => !r.existingId && !r.topic && !r.notes && r.lessonTypes.length === 0 && !r.coveredPortion);
      if (emptyIdx !== -1) {
        return prev.map((r, i) =>
          i === emptyIdx
            ? {
                ...r,
                existingId: saved?.id,
                date: dateStr,
                topic: saved?.topic || '',
                notes: saved?.notes || '',
                lessonTypes: Array.isArray(saved?.lessonTypes) ? saved.lessonTypes : [],
                chapterStatus: (saved?.chapterStatus || 'running') as ChapterStatus,
                coveredPortion: saved?.coveredPortion || '',
              }
            : r
        );
      }
      return [
        ...prev,
        {
          id: saved ? `saved_${saved.id}` : `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
          existingId: saved?.id,
          date: dateStr,
          topic: saved?.topic || '',
          notes: saved?.notes || '',
          lessonTypes: Array.isArray(saved?.lessonTypes) ? saved.lessonTypes : [],
          chapterStatus: (saved?.chapterStatus || 'running') as ChapterStatus,
          coveredPortion: saved?.coveredPortion || '',
        },
      ];
    });
  };

  const allPossibleSubjects = useMemo(() => {
    if (filterClass === 'all') return HIGHER_SUBJECTS;
    return getSubjectsForClass(filterClass);
  }, [filterClass]);

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !user) return;
    if (!formData.classId || !formData.subject) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "শ্রেণি ও বিষয় নিশ্চিত করুন।" });
      return;
    }

    const validRows = planRows.filter(r => r.date);
    if (validRows.length === 0) {
      toast({ variant: "destructive", title: "তারিখ নেই", description: "কমপক্ষে একটি তারিখ নিশ্চিত করুন।" });
      return;
    }

    const uniqueDates = new Set(validRows.map(r => r.date));
    if (uniqueDates.size !== validRows.length) {
      toast({
        variant: "destructive",
        title: "ডুপ্লিকেট তারিখ",
        description: "একই তারিখ একাধিকবার রয়েছে। অনুগ্রহ করে ডুপ্লিকেট তারিখ পরিবর্তন বা মুছে ফেলুন।",
      });
      return;
    }

    setIsSaving(true);
    try {
      if (editingId) {
        const row = validRows[0];
        await updateDoc(doc(db, 'diary', editingId), {
          classId: formData.classId,
          subject: formData.subject,
          date: row.date,
          topic: row.topic,
          notes: row.notes,
          lessonTypes: row.lessonTypes,
          chapterStatus: row.chapterStatus,
          coveredPortion: row.coveredPortion,
          userId: user.uid,
          updatedAt: serverTimestamp(),
        });
        toast({ title: "সফল", description: "ডায়েরি আপডেট করা হয়েছে।" });
      } else {
        let addedCount = 0;
        let updatedCount = 0;
        const ops: Promise<any>[] = [];

        for (const row of validRows) {
          const existingEntry = row.existingId
            ? diaryEntries?.find(e => e.id === row.existingId)
            : diaryEntries?.find(e => e.classId === formData.classId && e.subject === formData.subject && e.date === row.date);

          if (existingEntry) {
            const prevTypes = Array.isArray(existingEntry.lessonTypes) ? existingEntry.lessonTypes : [];
            const typesChanged = JSON.stringify(prevTypes) !== JSON.stringify(row.lessonTypes);
            const hasChanged =
              (existingEntry.date || '') !== row.date ||
              (existingEntry.topic || '') !== row.topic ||
              (existingEntry.notes || '') !== row.notes ||
              (existingEntry.chapterStatus || 'running') !== row.chapterStatus ||
              (existingEntry.coveredPortion || '') !== row.coveredPortion ||
              typesChanged;
            if (hasChanged) {
              updatedCount++;
              ops.push(
                updateDoc(doc(db, 'diary', existingEntry.id), {
                  classId: formData.classId,
                  subject: formData.subject,
                  date: row.date,
                  topic: row.topic,
                  notes: row.notes,
                  lessonTypes: row.lessonTypes,
                  chapterStatus: row.chapterStatus,
                  coveredPortion: row.coveredPortion,
                  userId: user.uid,
                  updatedAt: serverTimestamp(),
                })
              );
            }
          } else if (row.topic || row.notes || row.coveredPortion || row.lessonTypes.length > 0 || validRows.length === 1) {
            addedCount++;
            ops.push(
              addDoc(collection(db, 'diary'), {
                classId: formData.classId,
                subject: formData.subject,
                date: row.date,
                topic: row.topic,
                notes: row.notes,
                lessonTypes: row.lessonTypes,
                chapterStatus: row.chapterStatus,
                coveredPortion: row.coveredPortion,
                userId: user.uid,
                createdAt: serverTimestamp(),
                updatedAt: serverTimestamp(),
              })
            );
          }
        }

        if (ops.length === 0) {
          toast({ title: "তথ্য অপরিবর্তিত", description: "নতুন বা পরিবর্তিত কোনো পরিকল্পনা পাওয়া যায়নি।" });
          setIsSaving(false);
          return;
        }

        await Promise.all(ops);
        const parts: string[] = [];
        if (addedCount > 0) parts.push(`${toBengaliNumber(addedCount)}টি নতুন`);
        if (updatedCount > 0) parts.push(`${toBengaliNumber(updatedCount)}টি আপডেট`);
        toast({ title: "সফল", description: `ডায়েরি/পরিকল্পনা সংরক্ষণ করা হয়েছে (${parts.join(', ')})।` });
      }
      lastLoadedKeyRef.current = '';
      setFormData({
        date: format(new Date(), 'yyyy-MM-dd'),
        classId: '',
        subject: '',
        topic: '',
        notes: ''
      });
      setPlanRows([{ id: 'row_1', date: format(new Date(), 'yyyy-MM-dd'), topic: '', notes: '', lessonTypes: [], chapterStatus: 'running', coveredPortion: '' }]);
      setIsAdding(false);
      setEditingId(null);
    } catch (error) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "সেভ করা সম্ভব হয়নি।" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleEdit = (entry: any) => {
    setFormData({
      date: entry.date,
      classId: entry.classId || '',
      subject: entry.subject || '',
      topic: entry.topic || '',
      notes: entry.notes || ''
    });
    setPlanRows([{
      id: entry.id,
      existingId: entry.id,
      date: entry.date,
      topic: entry.topic || '',
      notes: entry.notes || '',
      lessonTypes: Array.isArray(entry.lessonTypes) ? entry.lessonTypes : [],
      chapterStatus: (entry.chapterStatus || 'running') as ChapterStatus,
      coveredPortion: entry.coveredPortion || '',
    }]);
    setEditingId(entry.id);
    setIsAdding(true);
  };

  const handleDelete = async (id: string) => {
    if (!db || !confirm("আপনি কি নিশ্চিত?")) return;
    try {
      await deleteDoc(doc(db, 'diary', id));
      toast({ title: "সফল", description: "ডায়েরি মুছে ফেলা হয়েছে।" });
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "মুছে ফেলা সম্ভব হয়নি।" });
    }
  };

  if (userLoading || diaryLoading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary" />
        <p className="mt-4 text-muted-foreground font-bold font-kalpurush">ডায়েরি লোড হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6 animate-fade-in pb-10 font-kalpurush">
      <header className="flex items-center justify-between border-b pb-6 no-print">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-lg">
            <BookOpen className="w-7 h-7" />
          </div>
          <div>
            <h2 className="text-2xl font-black text-foreground">ডিজিটাল টিচার্স ডায়েরি</h2>
            <p className="text-xs text-muted-foreground font-bold">আপনার প্রতিদিনের ক্লাস রেকর্ড সংরক্ষণ করুন</p>
          </div>
        </div>
        <Button 
          onClick={() => {
            setIsAdding(!isAdding);
            setEditingId(null);
            if (!isAdding) {
              lastLoadedKeyRef.current = '';
              setFormData({ date: format(new Date(), 'yyyy-MM-dd'), classId: '', subject: '', topic: '', notes: '' });
              setPlanRows([{ id: 'row_1', date: format(new Date(), 'yyyy-MM-dd'), topic: '', notes: '', lessonTypes: [], chapterStatus: 'running', coveredPortion: '' }]);
            }
          }}
          className={cn("gap-2 font-bold", isAdding ? "bg-muted text-muted-foreground" : "bg-indigo-600 hover:bg-indigo-700")}
        >
          {isAdding ? <ArrowLeft className="w-4 h-4" /> : <Plus className="w-4 h-4" />}
          {isAdding ? "ফিরে যান" : "নতুন রেকর্ড"}
        </Button>
      </header>

      {isAdding ? (
        <Card className="shadow-2xl border-2 border-black overflow-hidden animate-in fade-in slide-in-from-bottom-4 duration-300 no-print">
          <CardHeader className="bg-indigo-600 text-white py-4 border-b-2 border-black">
            <CardTitle className="text-lg font-black flex items-center gap-2">
              <FileText className="w-5 h-5" /> {editingId ? "ডায়েরি আপডেট করুন" : "নতুন ডায়েরি এন্ট্রি"}
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <form onSubmit={handleSave}>
              <div className="grid grid-cols-1 md:grid-cols-3 border-b-2 border-black">
                <div className="p-4 border-r-0 md:border-r-2 border-b-2 md:border-b-0 border-black bg-slate-50">
                  <label className="block text-xs font-black text-indigo-700 uppercase mb-2 tracking-wider">শ্রেণির ড্রপডাউন</label>
                  <Select onValueChange={v => setFormData(p => ({...p, classId: v}))} value={formData.classId}>
                    <SelectTrigger className="font-bold h-12 border-2 border-black bg-white ring-offset-0 focus:ring-0">
                      <SelectValue placeholder="শ্রেণি নির্বাচন করুন" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black font-kalpurush">
                      {CLASSES.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.label} শ্রেণি</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-4 border-r-0 md:border-r-2 border-b-2 md:border-b-0 border-black bg-slate-50">
                  <label className="block text-xs font-black text-indigo-700 uppercase mb-2 tracking-wider">বিষয়ের ড্রপ ডাউন</label>
                  <Select onValueChange={v => setFormData(p => ({...p, subject: v}))} value={formData.subject} disabled={!formData.classId}>
                    <SelectTrigger className="font-bold h-12 border-2 border-black bg-white ring-offset-0 focus:ring-0">
                      <SelectValue placeholder="বিষয় নির্বাচন করুন" />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black font-kalpurush">
                      {subjectsList.map(s => <SelectItem key={s} value={s} className="font-bold">{s}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="p-4 bg-slate-50">
                  <label className="block text-xs font-black text-indigo-700 uppercase mb-2 tracking-wider">রুটিনের ধরন</label>
                  <Select value={routineSourceFilter} onValueChange={(v: 'main' | 'standalone' | 'both') => setRoutineSourceFilter(v)}>
                    <SelectTrigger className="font-bold h-12 border-2 border-black bg-white ring-offset-0 focus:ring-0">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent className="border-2 border-black font-kalpurush">
                      <SelectItem value="main" className="font-bold">🔗 মেইন রুটিন</SelectItem>
                      <SelectItem value="standalone" className="font-bold text-indigo-700">📌 স্বতন্ত্র রুটিন</SelectItem>
                      <SelectItem value="both" className="font-bold text-emerald-700">📋 উভয় রুটিন (সব)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {formData.classId && formData.subject && (
                <div className="p-4 bg-indigo-50/70 border-b-2 border-black space-y-2.5">
                  <div className="flex items-center gap-2 text-xs font-black text-indigo-800">
                    <Calendar className="w-4 h-4 text-indigo-600" />
                    <span>রুটিন অনুযায়ী নির্ধারিত বার ও তারিখ (ক্লিক করলে তারিখ অটো সেট হবে):</span>
                  </div>
                  {linkedRoutineSchedule.days.length === 0 && linkedRoutineSchedule.dates.length === 0 ? (
                    <p className="text-xs font-bold text-slate-500 italic">
                      এই শ্রেণি ও বিষয়ের জন্য রুটিনে এখনো কোনো নির্ধারিত দিন বা তারিখ পাওয়া যায়নি।
                    </p>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {linkedRoutineSchedule.days.map((item, idx) => (
                        <button
                          key={`day-${idx}`}
                          type="button"
                          onClick={() => applyDateToPlanRow(getNearestDateForDay(item.day))}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white border-2 border-indigo-300 hover:border-indigo-600 hover:bg-indigo-100/60 text-xs font-black text-indigo-900 transition-all shadow-xs cursor-pointer"
                        >
                          <span>📅 {item.day} ({toBengaliNumber(item.period)}ম পিরিয়ড)</span>
                          {item.teacher && <span className="text-[10px] font-bold text-slate-600">• {item.teacher}</span>}
                          <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-indigo-200 bg-indigo-50 text-indigo-700">{item.source}</Badge>
                        </button>
                      ))}
                      {linkedRoutineSchedule.dates.map((item, idx) => {
                        const dObj = new Date(item.date.replace(/-/g, '/'));
                        const dateLabel = isNaN(dObj.getTime()) ? item.date : toBengaliNumber(format(dObj, 'dd-MM-yyyy'));
                        return (
                          <button
                            key={`date-${idx}`}
                            type="button"
                            onClick={() => applyDateToPlanRow(item.date)}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-emerald-50 border-2 border-emerald-400 hover:bg-emerald-100 text-xs font-black text-emerald-900 transition-all shadow-xs cursor-pointer"
                          >
                            <span>📆 {dateLabel} ({toBengaliNumber(item.period)}ম পিরিয়ড)</span>
                            {item.teacher && <span className="text-[10px] font-bold text-slate-600">• {item.teacher}</span>}
                            <Badge variant="outline" className="text-[9px] py-0 px-1.5 border-emerald-300 bg-white text-emerald-700">{item.source}</Badge>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {formData.classId && formData.subject && chaptersList.length > 0 && (() => {
                const completedCount = chaptersList.filter(ch => chapterProgressMap[ch]?.status === 'completed').length;
                const runningCount = chaptersList.filter(ch => chapterProgressMap[ch]?.status === 'running' || chapterProgressMap[ch]?.status === 'planned').length;
                const pendingCount = chaptersList.length - completedCount - runningCount;
                return (
                  <div className="p-4 bg-slate-50/90 border-b-2 border-black space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-2 text-xs font-black text-slate-800">
                        <BookOpen className="w-4 h-4 text-indigo-600" />
                        <span>অধ্যায়ভিত্তিক পাঠ অগ্রগতি ({formData.subject}):</span>
                      </div>
                      <div className="flex flex-wrap items-center gap-1.5 text-[11px] font-black">
                        <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-900 border border-emerald-400">
                          ✅ সম্পন্ন: {toBengaliNumber(completedCount)}
                        </Badge>
                        <Badge className="bg-amber-100 hover:bg-amber-100 text-amber-900 border border-amber-400">
                          ⏳ চলমান: {toBengaliNumber(runningCount)}
                        </Badge>
                        <Badge variant="outline" className="bg-white text-slate-700 border-slate-300">
                          ○ বাকি: {toBengaliNumber(pendingCount)}
                        </Badge>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto pr-1">
                      {chaptersList.map(ch => {
                        const info = chapterProgressMap[ch];
                        const status = info?.status || 'pending';
                        return (
                          <span
                            key={ch}
                            title={info?.lastPortion ? `সর্বশেষ অংশ: ${info.lastPortion}` : undefined}
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-1 rounded-lg border text-[11px] font-bold",
                              status === 'completed'
                                ? "bg-emerald-50 text-emerald-900 border-emerald-400"
                                : status === 'running' || status === 'planned'
                                  ? "bg-amber-50 text-amber-900 border-amber-400"
                                  : "bg-white text-slate-500 border-slate-200"
                            )}
                          >
                            <span>{status === 'completed' ? '✅' : status === 'running' || status === 'planned' ? '⏳' : '○'}</span>
                            <span>{ch}</span>
                            {info?.lastPortion && (
                              <span className="text-[10px] opacity-80">({info.lastPortion})</span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                  </div>
                );
              })()}

              {(!formData.classId || !formData.subject) ? (
                <div className="p-8 text-center bg-slate-50 space-y-2 border-b-2 border-black">
                  <div className="w-12 h-12 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center mx-auto">
                    <BookOpen className="w-6 h-6" />
                  </div>
                  <p className="text-sm font-black text-slate-800">
                    পাঠ পরিকল্পনার টেবিল দেখতে উপরে প্রথমে শ্রেণি ও বিষয় নির্বাচন করুন
                  </p>
                  <p className="text-xs font-bold text-slate-500">
                    শ্রেণি, বিষয় এবং রুটিনের ধরন সিলেক্ট করলে প্রতিদিনের পাঠ পরিকল্পনার ৫টি কলামের টেবিল এখানে প্রদর্শিত হবে।
                  </p>
                </div>
              ) : (
                <div className="overflow-x-auto border-b-2 border-black">
                  <table className="w-full text-left border-collapse min-w-[900px]">
                    <thead>
                      <tr className="bg-slate-100 border-b-2 border-black text-xs font-black text-slate-800">
                        <th className="p-3 border-r-2 border-black w-[20%] min-w-[180px]">১ম কলাম: তারিখ বা বার</th>
                        <th className="p-3 border-r-2 border-black w-[22%] min-w-[200px]">২য় কলাম: অধ্যায়ের ড্রপডাউন বাটন</th>
                        <th className="p-3 border-r-2 border-black w-[18%] min-w-[170px]">৩য় কলাম: আজকের পাঠের ধরন ড্রপ বাটন</th>
                        <th className="p-3 border-r-2 border-black w-[20%] min-w-[190px]">৪র্থ কলাম: আজকের পাঠের ধরন ড্রপ বাটন</th>
                        <th className="p-3 w-[20%] min-w-[200px]">৫ম কলাম: বিস্তারিত রেকর্ড / বাড়ির কাজ</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y-2 divide-black bg-white">
                      {planRows.map((row, rowIdx) => {
                        const dateRoutineInfo = getRoutineForDate(row.date);
                        const savedMatch = existingPlansForSubject.find(p => p.id === row.existingId || p.date === row.date);
                        const isDuplicateDate = Boolean(row.date && planRows.filter(r => r.date === row.date).length > 1);

                        return (
                          <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                            {/* ১ম কলাম: তারিখ বা বার */}
                            <td className="p-3 align-top border-r-2 border-black bg-slate-50/50 space-y-2">
                              <div className="flex items-center justify-between gap-1 flex-wrap">
                                <span className="text-[11px] font-black text-indigo-700 uppercase">
                                  {toBengaliNumber(rowIdx + 1)}. তারিখ
                                </span>
                                <div className="flex items-center gap-1">
                                  {savedMatch && (
                                    <Badge className="bg-emerald-100 hover:bg-emerald-100 text-emerald-900 border border-emerald-400 text-[10px] font-black px-1.5 py-0">
                                      ✓ সংরক্ষিত
                                    </Badge>
                                  )}
                                  {isDuplicateDate && (
                                    <Badge variant="destructive" className="text-[10px] font-black px-1.5 py-0">
                                      ⚠️ ডুপ্লিকেট
                                    </Badge>
                                  )}
                                </div>
                              </div>
                              <Input 
                                type="date" 
                                value={row.date} 
                                onChange={e => {
                                  const newDate = e.target.value;
                                  setPlanRows(prev => prev.map(r => {
                                    if (r.id !== row.id) return r;
                                    if (editingId) return { ...r, date: newDate };
                                    const matched = existingPlansForSubject.find(p => p.date === newDate);
                                    const usedElsewhere = prev.some(other => other.id !== row.id && other.date === newDate);
                                    if (matched && !usedElsewhere) {
                                      return {
                                        ...r,
                                        existingId: matched.id,
                                        date: newDate,
                                        topic: matched.topic || '',
                                        notes: matched.notes || '',
                                        lessonTypes: Array.isArray(matched.lessonTypes) ? matched.lessonTypes : [],
                                        chapterStatus: (matched.chapterStatus || 'running') as ChapterStatus,
                                        coveredPortion: matched.coveredPortion || '',
                                      };
                                    }
                                    return {
                                      ...r,
                                      existingId: r.existingId && r.date === newDate ? r.existingId : undefined,
                                      date: newDate,
                                    };
                                  }));
                                }} 
                                className="font-bold h-9 border-2 border-black bg-white ring-offset-0 focus:ring-0 text-xs"
                              />

                              {dateRoutineInfo && (
                                <div className="space-y-1 pt-0.5">
                                  <div className="flex flex-wrap items-center gap-1">
                                    <Badge variant="outline" className="font-black text-[10px] bg-white border-slate-300">
                                      বার: {dateRoutineInfo.dayName}
                                    </Badge>
                                    {formData.subject && (
                                      dateRoutineInfo.hasSubject ? (
                                        <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-black text-[9px] px-1.5 py-0.5">
                                          ✓ রুটিনে আছে ({dateRoutineInfo.matchedPeriods.map(m => `${toBengaliNumber(m.period)}ম`).join(', ')})
                                        </Badge>
                                      ) : dateRoutineInfo.isWeekend ? (
                                        <Badge variant="secondary" className="font-bold text-[9px] px-1 py-0">
                                          সাপ্তাহিক ছুটি
                                        </Badge>
                                      ) : (
                                        <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-bold text-[9px] px-1 py-0">
                                          ⚠️ রুটিনে নেই
                                        </Badge>
                                      )
                                    )}
                                  </div>
                                </div>
                              )}
                            </td>

                            {/* ২য় কলাম: অধ্যায়ের ড্রপডাউন বাটন ও অবস্থা */}
                            <td className="p-3 align-top border-r-2 border-black space-y-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase block">অধ্যায় নির্বাচন:</label>
                                {chaptersList.length > 0 ? (
                                  <Select
                                    value={row.topic}
                                    onValueChange={v => setPlanRows(prev => prev.map(r => r.id === row.id ? { ...r, topic: v } : r))}
                                  >
                                    <SelectTrigger className="font-bold h-9 border-2 border-black bg-white ring-offset-0 focus:ring-0 text-xs">
                                      <SelectValue placeholder="অধ্যায় সিলেক্ট করুন" />
                                    </SelectTrigger>
                                    <SelectContent className="border-2 border-black font-kalpurush max-h-56">
                                      {chaptersList.map(ch => {
                                        const prog = chapterProgressMap[ch];
                                        const tag = prog?.status === 'completed' ? ' [✅ সম্পন্ন]' : prog ? ' [⏳ চলমান]' : ' [○ বাকি]';
                                        return (
                                          <SelectItem key={ch} value={ch} className="font-bold text-xs">
                                            {ch}{tag}
                                          </SelectItem>
                                        );
                                      })}
                                    </SelectContent>
                                  </Select>
                                ) : (
                                  <Input 
                                    value={row.topic} 
                                    onChange={e => setPlanRows(prev => prev.map(r => r.id === row.id ? { ...r, topic: e.target.value } : r))} 
                                    placeholder="টপিক বা শিরোনাম..." 
                                    className="font-bold h-9 border-2 border-black bg-white ring-offset-0 focus:ring-0 text-xs"
                                  />
                                )}
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase block">অধ্যায়ের অবস্থা:</label>
                                <Select
                                  value={row.chapterStatus}
                                  onValueChange={(v: ChapterStatus) => setPlanRows(prev => prev.map(r => r.id === row.id ? { ...r, chapterStatus: v } : r))}
                                >
                                  <SelectTrigger className="font-bold h-9 border-2 border-black bg-white ring-offset-0 focus:ring-0 text-xs">
                                    <SelectValue placeholder="অবস্থা" />
                                  </SelectTrigger>
                                  <SelectContent className="border-2 border-black font-kalpurush">
                                    <SelectItem value="planned" className="font-bold text-xs">📝 পরিকল্পিত</SelectItem>
                                    <SelectItem value="running" className="font-bold text-amber-800 text-xs">⏳ চলমান</SelectItem>
                                    <SelectItem value="completed" className="font-bold text-emerald-800 text-xs">✅ অধ্যায় সম্পন্ন</SelectItem>
                                  </SelectContent>
                                </Select>
                              </div>
                            </td>

                            {/* ৩য় কলাম: আজকের পাঠের ধরন ড্রপ বাটন (১ম) */}
                            <td className="p-3 align-top border-r-2 border-black space-y-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase block">পাঠের ধরন (১ম):</label>
                                <Select
                                  value={row.lessonTypes?.[0] || 'none'}
                                  onValueChange={v => {
                                    const t1 = v === 'none' ? '' : v;
                                    const t2 = row.lessonTypes?.[1] || '';
                                    const next = [t1, t2].filter(Boolean);
                                    setPlanRows(prev => prev.map(r => r.id === row.id ? { ...r, lessonTypes: next } : r));
                                  }}
                                >
                                  <SelectTrigger className="font-bold h-9 border-2 border-black bg-white ring-offset-0 focus:ring-0 text-xs">
                                    <SelectValue placeholder="ধরন নির্বাচন..." />
                                  </SelectTrigger>
                                  <SelectContent className="border-2 border-black font-kalpurush max-h-56">
                                    <SelectItem value="none" className="text-slate-400 font-bold text-xs">-- ধরন সিলেক্ট করুন --</SelectItem>
                                    {lessonTypeOptions.map(opt => (
                                      <SelectItem key={opt} value={opt} className="font-bold text-xs">
                                        {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              {row.lessonTypes?.[0] && (
                                <div className="pt-0.5">
                                  <Badge className="bg-indigo-600 text-white font-black text-[10px] px-2 py-0.5">
                                    ✓ {row.lessonTypes[0]}
                                  </Badge>
                                </div>
                              )}
                            </td>

                            {/* ৪র্থ কলাম: আজকের পাঠের ধরন ড্রপ বাটন (২য়) ও পড়ানো অংশ */}
                            <td className="p-3 align-top border-r-2 border-black space-y-2">
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase block">পাঠের ধরন (২য় / অতিরিক্ত):</label>
                                <Select
                                  value={row.lessonTypes?.[1] || 'none'}
                                  onValueChange={v => {
                                    const t1 = row.lessonTypes?.[0] || '';
                                    const t2 = v === 'none' ? '' : v;
                                    const next = [t1, t2].filter(Boolean);
                                    setPlanRows(prev => prev.map(r => r.id === row.id ? { ...r, lessonTypes: next } : r));
                                  }}
                                >
                                  <SelectTrigger className="font-bold h-9 border-2 border-black bg-white ring-offset-0 focus:ring-0 text-xs">
                                    <SelectValue placeholder="২য় ধরন (ঐচ্ছিক)..." />
                                  </SelectTrigger>
                                  <SelectContent className="border-2 border-black font-kalpurush max-h-56">
                                    <SelectItem value="none" className="text-slate-400 font-bold text-xs">-- প্রয়োজন নেই / খালি --</SelectItem>
                                    {lessonTypeOptions.map(opt => (
                                      <SelectItem key={opt} value={opt} className="font-bold text-xs">
                                        {opt}
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              </div>
                              <div className="space-y-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase block">পড়ানো অংশ / পৃষ্ঠা সীমা:</label>
                                <Input
                                  value={row.coveredPortion}
                                  onChange={e => setPlanRows(prev => prev.map(r => r.id === row.id ? { ...r, coveredPortion: e.target.value } : r))}
                                  placeholder="যেমন: পৃ: ৪২-৪৫, অনু: ১.২..."
                                  className="font-bold h-9 text-xs border-2 border-slate-300 focus:border-black bg-slate-50/50 ring-offset-0 focus:ring-0"
                                />
                              </div>
                            </td>

                            {/* ৫ম কলাম: বিস্তারিত রেকর্ড / বাড়ির কাজ ও অ্যাকশন বাটন */}
                            <td className="p-3 align-top space-y-2">
                              <div className="flex items-center justify-between gap-1">
                                <label className="text-[10px] font-black text-slate-500 uppercase block">ক্লাস রেকর্ড / বাড়ির কাজ:</label>
                                {!editingId && planRows.length > 1 && !savedMatch && (
                                  <button
                                    type="button"
                                    onClick={() => setPlanRows(prev => prev.filter(r => r.id !== row.id))}
                                    className="text-[10px] font-black text-rose-600 hover:text-rose-700 flex items-center gap-0.5 cursor-pointer hover:bg-rose-50 px-1.5 py-0.5 rounded border border-rose-200"
                                    title="এই রো মুছুন"
                                  >
                                    <Trash2 className="w-3 h-3" /> মুছুন
                                  </button>
                                )}
                              </div>
                              <Textarea 
                                value={row.notes} 
                                onChange={e => setPlanRows(prev => prev.map(r => r.id === row.id ? { ...r, notes: e.target.value } : r))} 
                                placeholder="ক্লাসের বিস্তারিত বিষয়বস্তু বা বাড়ির কাজ লিখুন..." 
                                className="min-h-[85px] font-bold text-xs leading-relaxed border-2 border-black ring-offset-0 focus:ring-0"
                              />
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}

              {!editingId && formData.classId && formData.subject && (
                <div className="p-3 bg-indigo-50/50 border-t-2 border-black flex justify-center">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => {
                      const usedDates = new Set(planRows.map(r => r.date));
                      const lastDate = planRows[planRows.length - 1]?.date || format(new Date(), 'yyyy-MM-dd');
                      let d = new Date(lastDate.replace(/-/g, '/'));
                      if (isNaN(d.getTime())) d = new Date();
                      let candidate = format(addDays(d, 1), 'yyyy-MM-dd');
                      let guard = 0;
                      while (usedDates.has(candidate) && guard < 365) {
                        d = addDays(d, 1);
                        candidate = format(addDays(d, 1), 'yyyy-MM-dd');
                        guard++;
                      }
                      const saved = existingPlansForSubject.find(p => p.date === candidate);
                      setPlanRows(prev => [
                        ...prev,
                        {
                          id: saved ? `saved_${saved.id}` : `row_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
                          existingId: saved?.id,
                          date: candidate,
                          topic: saved?.topic || '',
                          notes: saved?.notes || '',
                          lessonTypes: Array.isArray(saved?.lessonTypes) ? saved.lessonTypes : [],
                          chapterStatus: (saved?.chapterStatus || 'running') as ChapterStatus,
                          coveredPortion: saved?.coveredPortion || '',
                        },
                      ]);
                    }}
                    className="border-2 border-dashed border-indigo-500 text-indigo-700 hover:bg-indigo-100 font-black gap-2"
                  >
                    <Plus className="w-4 h-4 stroke-[3]" /> আরও একটি তারিখ / পরিকল্পনা যোগ করুন
                  </Button>
                </div>
              )}

              <div className="p-4 bg-slate-100 border-t-2 border-black flex justify-end">
                <Button type="submit" disabled={isSaving} className="bg-indigo-600 hover:bg-indigo-700 h-12 px-10 text-lg font-black shadow-lg border-2 border-black text-white">
                  {isSaving ? <Loader2 className="w-5 h-5 animate-spin mr-2" /> : <Save className="w-5 h-5 mr-2" />}
                  সংরক্ষণ করুন
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 items-stretch sm:items-end justify-between bg-indigo-50 p-4 rounded-2xl border-2 border-indigo-200 no-print">
            <div className="grid grid-cols-2 sm:flex sm:flex-wrap gap-3 sm:gap-4 items-end w-full sm:w-auto">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-700 uppercase ml-1">মাস</label>
                <Select value={selectedMonth} onValueChange={setSelectedMonth}>
                  <SelectTrigger className="w-full sm:w-36 font-bold border-2 border-black bg-white h-11">
                    <SelectValue placeholder="মাস" />
                  </SelectTrigger>
                  <SelectContent className="font-kalpurush border-2 border-black">
                    {MONTHS_BN.map(m => <SelectItem key={m.id} value={m.id} className="font-bold">{m.name}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-700 uppercase ml-1">বছর</label>
                <Input 
                  value={selectedYear} 
                  onChange={e => setSelectedYear(e.target.value)} 
                  className="w-full sm:w-28 font-bold border-2 border-black bg-white h-11 text-center"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-700 uppercase ml-1">শ্রেণি ফিল্টার</label>
                <Select value={filterClass} onValueChange={v => { setFilterClass(v); setFilterSubject('all'); }}>
                  <SelectTrigger className="w-full sm:w-36 font-bold border-2 border-black bg-white h-11">
                    <SelectValue placeholder="সব শ্রেণি" />
                  </SelectTrigger>
                  <SelectContent className="font-kalpurush border-2 border-black">
                    <SelectItem value="all" className="font-bold">সব শ্রেণি</SelectItem>
                    {CLASSES.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.label} শ্রেণি</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-indigo-700 uppercase ml-1">বিষয় ফিল্টার</label>
                <Select value={filterSubject} onValueChange={setFilterSubject}>
                  <SelectTrigger className="w-full sm:w-40 font-bold border-2 border-black bg-white h-11">
                    <SelectValue placeholder="সব বিষয়" />
                  </SelectTrigger>
                  <SelectContent className="font-kalpurush border-2 border-black">
                    <SelectItem value="all" className="font-bold">সব বিষয়</SelectItem>
                    {allPossibleSubjects.map(s => <SelectItem key={s} value={s} className="font-bold">{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <Button 
              onClick={() => window.print()}
              variant="outline"
              className="w-full sm:w-auto gap-2 font-black border-2 border-black hover:bg-black hover:text-white transition-all h-11 px-6 shadow-md bg-white"
            >
              <Printer className="w-4 h-4" /> প্রিন্ট করুন
            </Button>
          </div>

          <div className="print-area">
            <div className="hidden print:block text-center space-y-2 mb-6">
              <h1 className="text-3xl font-black underline">মাসিক টিচার্স ডায়েরি রেকর্ড</h1>
              <p className="text-lg font-bold">
                মাস: {MONTHS_BN.find(m => m.id === selectedMonth)?.name} | বছর: {toBengaliNumber(selectedYear)}
                {filterClass !== 'all' && ` | শ্রেণি: ${CLASSES.find(c => c.id === filterClass)?.label} শ্রেণি`}
                {filterSubject !== 'all' && ` | বিষয়: ${filterSubject}`}
              </p>
            </div>

            {diaryError && (diaryError.code === 'failed-precondition' || diaryError.message.includes('index')) ? (
              <div className="text-center py-10 space-y-4 max-w-2xl mx-auto font-kalpurush border-2 border-dashed border-destructive rounded-2xl bg-destructive/5 p-6 no-print">
                <AlertTriangle className={cn("w-12 h-12 text-destructive mx-auto", diaryError.message.includes('building') ? "animate-pulse" : "animate-bounce")} />
                <div className="space-y-2">
                  <p className="text-destructive font-black text-lg">
                    {diaryError.message.includes('building') ? "ইনডেক্স তৈরির কাজ চলছে..." : "ডাটাবেস ইনডেক্স প্রয়োজন"}
                  </p>
                  <p className="text-sm text-muted-foreground font-bold leading-relaxed">
                    {diaryError.message.includes('building') 
                      ? "ফায়ারবেস বর্তমানে ইনডেক্সটি তৈরি করছে। এটি সম্পন্ন হতে ২-৫ মিনিট সময় লাগতে পারে। অনুগ্রহ করে কিছুক্ষণ পর পেজটি রিফ্রেশ করুন।" 
                      : "ডায়েরি রেকর্ডগুলো সঠিকভাবে দেখানোর জন্য ডাটাবেসে একটি ইনডেক্স তৈরি করতে হবে। নিচের লিঙ্কে ক্লিক করে \"Create Index\" বাটনে চাপ দিন:"}
                  </p>
                  {!diaryError.message.includes('building') && (
                    <>
                      <div className="p-3 bg-muted rounded-lg border text-[10px] break-all font-mono select-all text-left overflow-hidden">
                        https://console.firebase.google.com/v1/r/project/birganj-pouro-high-schoo-9d39d/firestore/indexes?create_composite=Clxwcm9qZWN0cy9iaXJnYW5qLXBvdXJvLWhpZ2gtc2Nob28tOWQzOWQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2RpYXJ5L2luZGV4ZXMvXxABGgoKBnVzZXJJZBABGggKBGRhdGUQARoMCghfX25hbWVfXxAB
                      </div>
                      <a 
                        href="https://console.firebase.google.com/v1/r/project/birganj-pouro-high-schoo-9d39d/firestore/indexes?create_composite=Clxwcm9qZWN0cy9iaXJnYW5qLXBvdXJvLWhpZ2gtc2Nob28tOWQzOWQvZGF0YWJhc2VzLyhkZWZhdWx0KS9jb2xsZWN0aW9uR3JvdXBzL2RpYXJ5L2luZGV4ZXMvXxABGgoKBnVzZXJJZBABGggKBGRhdGUQARoMCghfX25hbWVfXxAB" 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 bg-primary text-white px-6 py-2 rounded-lg font-bold hover:bg-primary/90 transition-all mt-2"
                      >
                        <ExternalLink className="w-4 h-4" /> ইনডেক্স তৈরি করুন
                      </a>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <div className="w-full overflow-x-auto touch-pan-x border-2 border-black rounded-xl shadow-xl bg-white print:overflow-visible">
                <table className="w-full min-w-[680px] print:min-w-full border-collapse">
                  <thead>
                    <tr className="bg-indigo-600 text-white border-b-2 border-black">
                      <th className="p-4 border-r-2 border-black text-sm font-black w-24">তারিখ</th>
                      <th className="p-4 border-r-2 border-black text-sm font-black w-32">শ্রেণি</th>
                      <th className="p-4 border-r-2 border-black text-sm font-black w-40">বিষয়</th>
                      <th className="p-4 text-sm font-black">প্রতিদিনের ক্লাস রেকর্ড (টপিক ও বিস্তারিত)</th>
                      <th className="p-4 border-l-2 border-black text-sm font-black w-24 no-print">অ্যাকশন</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEntries.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="p-20 text-center text-muted-foreground font-bold italic border-b-2 border-black">
                          এই মাসে কোনো ডায়েরি রেকর্ড পাওয়া যায়নি।
                        </td>
                      </tr>
                    ) : (
                      filteredEntries.map((entry, index) => (
                        <tr key={entry.id} className={cn("border-b-2 border-black hover:bg-slate-50 transition-colors", index % 2 === 0 ? "bg-white" : "bg-slate-50/50")}>
                          <td className="p-4 border-r-2 border-black text-center">
                            <span className="text-xs font-black bg-indigo-100 text-indigo-800 px-2 py-1 rounded border border-indigo-200">
                              {format(new Date(entry.date), 'dd/MM', { locale: bn })}
                            </span>
                          </td>
                          <td className="p-4 border-r-2 border-black text-center font-black text-sm">
                            {CLASSES.find(c => c.id === entry.classId)?.label} শ্রেণি
                          </td>
                          <td className="p-4 border-r-2 border-black font-bold text-sm text-indigo-700">
                            {entry.subject}
                          </td>
                          <td className="p-4 align-top">
                            <div className="space-y-2">
                              <div className="flex flex-wrap items-center gap-2">
                                <h4 className="font-black text-base text-foreground leading-tight">{entry.topic}</h4>
                                {entry.chapterStatus && CHAPTER_STATUS_META[entry.chapterStatus as ChapterStatus] && (
                                  <Badge variant="outline" className={cn("text-[10px] font-black", CHAPTER_STATUS_META[entry.chapterStatus as ChapterStatus].badgeClass)}>
                                    {CHAPTER_STATUS_META[entry.chapterStatus as ChapterStatus].label}
                                  </Badge>
                                )}
                              </div>
                              {entry.coveredPortion && (
                                <p className="text-xs font-black text-indigo-800 bg-indigo-50 border border-indigo-200 inline-block px-2 py-0.5 rounded">
                                  পড়ানো অংশ: {entry.coveredPortion}
                                </p>
                              )}
                              {Array.isArray(entry.lessonTypes) && entry.lessonTypes.length > 0 && (
                                <div className="flex flex-wrap gap-1">
                                  {entry.lessonTypes.map((lt: string) => (
                                    <span key={lt} className="text-[10px] font-black px-2 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-300">
                                      {lt}
                                    </span>
                                  ))}
                                </div>
                              )}
                              <p className="text-sm font-bold text-muted-foreground whitespace-pre-wrap leading-relaxed">{entry.notes}</p>
                            </div>
                          </td>
                          <td className="p-4 text-center space-x-2 no-print border-l-2 border-black">
                            <div className="flex items-center justify-center gap-2">
                              <Button variant="ghost" size="icon" onClick={() => handleEdit(entry)} className="h-8 w-8 text-indigo-600 hover:bg-indigo-100">
                                <Edit className="w-4 h-4" />
                              </Button>
                              <Button variant="ghost" size="icon" onClick={() => handleDelete(entry.id)} className="h-8 w-8 text-destructive hover:bg-red-100">
                                <Trash2 className="w-4 h-4" />
                              </Button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>
            )}
            
            <div className="hidden print:flex justify-between mt-10 px-4 italic text-sm font-bold opacity-50">
              <span>প্রিন্ট তারিখ: {format(new Date(), 'dd MMMM, yyyy', { locale: bn })}</span>
              <span>ডিজিটাল টিচার্স ডায়েরি - স্মার্ট লার্নিং প্ল্যাটফর্ম</span>
            </div>
          </div>
        </div>
      )}

      <style jsx global>{`
        @media print {
          body * { visibility: hidden; background: white !important; }
          .print-area, .print-area * { visibility: visible; }
          .print-area { position: absolute; left: 0; top: 0; width: 100%; padding: 0 !important; }
          .no-print { display: none !important; }
          .print-area table { border: 2pt solid black !important; }
          .print-area th, .print-area td { border: 1pt solid black !important; color: black !important; }
          .print-area th { background-color: #f1f5f9 !important; color: black !important; }
        }
      `}</style>
    </div>
  );
}

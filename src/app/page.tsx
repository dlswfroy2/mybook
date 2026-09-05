
"use client";

import { useEffect, useMemo, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import Link from 'next/link';
import Image from 'next/image';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { 
  GraduationCap, 
  ArrowRight, 
  BrainCircuit, 
  Loader2, 
  BookOpen, 
  Library, 
  Users, 
  NotebookPen, 
  FileUp, 
  LayoutGrid,
  FileText,
  Bell,
  Megaphone,
  UserPlus,
  Search, 
  CalendarCheck,
  Award,
  Calendar,
  MessageSquare,
  Banknote,
  UserCog,
  FolderOpen,
  Clock,
  UserCheck,
  CheckCircle2,
  XCircle,
  Image as ImageIcon,
  AlertCircle
} from 'lucide-react';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { collection, query, orderBy, limit, onSnapshot, Timestamp, FirestoreError, where, getDocs, doc, QueryDocumentSnapshot } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Notice } from '@/lib/notice-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Student, studentFromDoc } from '@/lib/student-data';
import { getAttendanceForDate, saveDailyAttendance, StudentAttendance, DailyAttendance, getAttendanceForClassAndDate } from '@/lib/attendance-data';
import { isHoliday } from '@/lib/holiday-data';
import { GalleryConfig, defaultGalleryConfig } from '@/lib/gallery-data';
import { StudentFeeDialog } from '@/components/StudentFeeDialog';
import { useToast } from '@/hooks/use-toast';

const classNamesMap: Record<string, string> = {
  '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

const GalleryCard = () => {
    const db = useFirestore();
    const { user } = useUser();
    const [config, setConfig] = useState<GalleryConfig>(defaultGalleryConfig);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !user) return;
        const unsub = onSnapshot(doc(db, 'school', 'gallery'), (snap) => {
            if (snap.exists()) {
                setConfig(snap.data() as GalleryConfig);
            }
            setIsLoading(false);
        }, async (error: FirestoreError) => {
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'school/gallery',
                    operation: 'get',
                }));
            }
        });
        return () => unsub();
    }, [db, user]);

    const activeImages = useMemo(() => config.images.filter(img => img.isActive), [config.images]);

    useEffect(() => {
        if (activeImages.length <= 1) return;
        const interval = setInterval(() => {
            setCurrentIdx(prev => (prev + 1) % activeImages.length);
        }, config.duration * 1000);
        return () => clearInterval(interval);
    }, [activeImages, config.duration]);

    if (isLoading) return <Skeleton className="h-full w-full rounded-xl min-h-[140px]" />;

    return (
        <Card className="relative overflow-hidden bg-white border-2 border-black shadow-sm group hover:shadow-lg transition-all duration-500 rounded-xl">
            <CardHeader className="p-3 bg-primary/5 border-b border-black/10 relative z-20">
                <CardTitle className="text-xs font-black text-primary flex items-center gap-1.5 uppercase">
                    <ImageIcon className="h-3.5 w-3.5" /> বিদ্যালয় গ্যালারি
                </CardTitle>
            </CardHeader>
            <CardContent className="p-0 relative h-28 sm:h-32 overflow-hidden">
                {activeImages.length > 0 ? (
                    <div className="relative w-full h-full">
                        {activeImages.map((img, idx) => (
                            <div 
                                key={img.id}
                                className={cn(
                                    "absolute inset-0 transition-opacity duration-1000",
                                    idx === currentIdx ? "opacity-100 z-10" : "opacity-0 z-0"
                                )}
                            >
                                <Image 
                                    src={img.url} 
                                    alt={img.title} 
                                    fill 
                                    className="object-cover"
                                    data-ai-hint="school landscape"
                                />
                                <div className="absolute bottom-0 left-0 right-0 bg-black/40 backdrop-blur-[2px] p-1 text-center">
                                    <p className="text-[10px] text-white font-black truncate">{img.title}</p>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="w-full h-full flex flex-col items-center justify-center bg-slate-50 text-muted-foreground italic">
                        <ImageIcon className="h-8 w-8 mb-1 opacity-20" />
                        <p className="text-[10px]">ছবি নেই</p>
                    </div>
                )}
            </CardContent>
        </Card>
    );
};

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function chunkArray<T>(array: T[], size: number): T[][] {
  if (array.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

const BENGALI_ORDINALS = [
  '১ম', '২য়', '৩য়', '৪র্থ', '৫ম', '৬ষ্ঠ', '৭ম', '৮ম', '৯ম', '১০ম',
  'একাদশ', 'দ্বাদশ', 'ত্রয়োদশ', 'চতুর্দশ', 'পঞ্চদশ', 'ষোড়শ', 'সপ্তদশ', 'অষ্টাদশ', 'ঊনবিংশ', 'বিংশ'
];

/**
 * Normalized key for robust data mapping.
 */
function getNormalizedKey(name: string): string {
  if (!name) return 'general';
  let n = name.toString().toLowerCase().trim();
  const bnToEn: Record<string, string> = { '০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9' };
  n = n.replace(/[০-৯]/g, m => bnToEn[m]);
  
  const wordMap: Record<string, string> = {
    'প্রথম': '1', '১ম': '1', '১': '1', '1st': '1',
    'দ্বিতীয়': '2', '২য়': '2', '২': '2', '2nd': '2',
    'তৃতীয়': '3', '৩য়': '3', '৩': '3', '3rd': '3',
    'চতুর্থ': '4', '৪র্থ': '4', '৪': '4', '4th': '4',
    'পঞ্চম': '5', '৫ম': '5', '৫': '5', '5th': '5',
    'ষষ্ঠ': '6', '৬ষ্ঠ': '6', '৬': '6', '6th': '6',
    'সপ্তম': '7', '৭ম': '7', '৭': '7', '7th': '7',
    'অষ্টম': '8', '৮ম': '8', '৮': '8', '8th': '8',
    'নবম': '9', '৯ম': '9', '৯': '9', '9th': '9',
    'দশম': '10', '১০ম': '10', '১০': '10', '10th': '10',
    'একাদশ': '11', '১১': '11', '১১শ': '11',
    'দ্বাদশ': '12', '১২': '12', '১২শ': '12',
    'ত্রয়োদশ': '13', '১৩': '13', '১৩শ': '13',
    'চতুর্দশ': '14', '১৪': '14', '১৪শ': '14',
    'পঞ্চদশ': '15', '১৫': '15', '১৫শ': '15'
  };

  for (const [word, val] of Object.entries(wordMap)) {
    if (n.includes(word)) return val;
  }

  const match = n.match(/\d+/);
  return match ? match[0] : n;
}

function formatChapterDisplay(name: string): string {
  if (!name || name === 'general') return 'সাধারণ';
  const key = getNormalizedKey(name);
  const num = parseInt(key);
  
  if (!isNaN(num)) {
    if (num >= 1 && num <= 20) return BENGALI_ORDINALS[num - 1];
    return toBengaliNumber(num);
  }

  return name.split(/[\s:]/)[0] || name;
}

function normalizeForSort(name: string): number {
  const norm = getNormalizedKey(name);
  const num = parseInt(norm);
  return isNaN(num) ? 998 : num;
}

// Scrolling Notice Ticker Component
const NoticeTicker = () => {
    const db = useFirestore();
    const { user } = useUser();
    const [scrollingNotices, setScrollingNotices] = useState<Notice[]>([]);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!db || !user || !isClient) return;
        
        const q = query(collection(db, 'notices'), orderBy('date', 'desc'), limit(15));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const docData = doc.data();
                return {
                    id: doc.id,
                    ...docData,
                    date: docData.date instanceof Timestamp ? docData.date.toDate() : (docData.date ? new Date(docData.date) : new Date()),
                } as Notice;
            });
            const scrolling = data.filter(n => !!n.isScrolling);
            setScrollingNotices(scrolling);
        }, async (error: FirestoreError) => {
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'notices',
                    operation: 'list',
                }));
            }
        });

        return () => unsubscribe();
    }, [db, user, isClient]);

    if (!isClient) return null;

    if (scrollingNotices.length > 0) {
        return (
            <div className="w-full bg-yellow-100 text-red-700 h-8 flex items-center overflow-hidden border-y-2 border-red-500 shadow-md sticky top-16 md:top-20 z-40 font-kalpurush group cursor-default rounded-lg">
                <div className="bg-red-600 text-white px-3 h-full flex items-center gap-1.5 shrink-0 z-10 shadow-lg">
                    <Megaphone className="h-3.5 w-3.5 animate-bounce" />
                    <span className="font-black text-xs whitespace-nowrap leading-none">জরুরি নোটিশ:</span>
                </div>
                <div className="flex-1 relative overflow-hidden h-full flex items-center">
                    <div className="absolute whitespace-nowrap animate-marquee flex items-center gap-10 group-hover:pause-animation">
                        {scrollingNotices.map((notice, idx) => (
                            <span key={`notice-${idx}`} className="font-black text-xs tracking-tight">
                                <span className="text-blue-800">[{notice.title}]</span> - {notice.content.replace(/\n/g, ' ')}
                            </span>
                        ))}
                        {scrollingNotices.map((notice, idx) => (
                            <span key={`notice-loop-${idx}`} className="font-black text-xs tracking-tight">
                                <span className="text-blue-800">[{notice.title}]</span> - {notice.content.replace(/\n/g, ' ')}
                            </span>
                        ))}
                    </div>
                </div>
                <style jsx>{`
                    @keyframes marquee {
                        0% { transform: translateX(0); }
                        100% { transform: translateX(-50%); }
                    }
                    .animate-marquee {
                        animation: marquee 45s linear infinite;
                        display: inline-flex;
                        width: max-content;
                    }
                    .pause-animation {
                        animation-play-state: paused;
                    }
                `}</style>
            </div>
        );
    }

    return null;
};

export default function Home() {
  const { user, loading } = useUser();
  const router = useRouter();
  const db = useFirestore();

  const [selectedSubjects, setSelectedSubjects] = useState<Record<string, string>>({});
  const [selectedDashboardClass, setSelectedDashboardClass] = useState<string>('6');

  const { toast } = useToast();
  const { selectedYear } = useAcademicYear();
  const [totalStudents, setTotalStudents] = useState(0);
  const [totalTeachers, setTotalTeachers] = useState(0);
  const [totalPresent, setTotalPresent] = useState(0);
  const [totalAbsent, setTotalAbsent] = useState(0);

  // Quick Payment States
  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);
  const [quickSearchInput, setQuickSearchInput] = useState('');
  const [quickSearchClass, setQuickSearchClass] = useState<string>('');
  const [studentsForYear, setStudentsForYear] = useState<Student[]>([]);
  const [quickFeeStudent, setQuickFeeStudent] = useState<Student | null>(null);

  // Quick Attendance States
  const [isQuickAttendanceOpen, setIsQuickAttendanceOpen] = useState(false);
  const [quickAttendanceClass, setQuickAttendanceClass] = useState<string>('6');
  const [quickAttendanceInput, setQuickAttendanceInput] = useState('');
  const [isSavingQuickAttendance, setIsSavingQuickAttendance] = useState(false);
  const [isConfirmingQuickAttendance, setIsConfirmingQuickAttendance] = useState(false);

  const refreshDashboardAttendance = useCallback(async (currentStudents?: Student[]) => {
      if (!db) return;
      const list = currentStudents && currentStudents.length > 0 ? currentStudents : studentsForYear;
      const todayStr = format(new Date(), 'yyyy-MM-dd');
      try {
          const todaysAttendance = await getAttendanceForDate(db, todayStr, selectedYear);
          if (todaysAttendance.length > 0) {
              let totalPresentCount = 0;
              let totalAbsentCount = 0;
              todaysAttendance.forEach(classAttendanceRecord => {
                  const className = classAttendanceRecord.className;
                  classAttendanceRecord.attendance.forEach(studentAttendance => {
                      const studentExistsInYear = list.some(s => s.id === studentAttendance.studentId && s.className === className);
                      if (studentExistsInYear) {
                          if (studentAttendance.status === 'present') {
                              totalPresentCount++;
                          } else {
                              totalAbsentCount++;
                          }
                      }
                  });
              });
              setTotalPresent(totalPresentCount);
              setTotalAbsent(totalAbsentCount);
          } else {
              setTotalPresent(0);
              setTotalAbsent(0);
          }
      } catch (e) {}
  }, [db, selectedYear, studentsForYear]);

  useEffect(() => {
      if (!db || !user) return;

      const studentsQuery = query(collection(db, 'students'), where('academicYear', '==', selectedYear));
      
      const unsubscribeStudents = onSnapshot(studentsQuery, async (studentsSnapshot) => {
        const list = studentsSnapshot.docs.map(studentFromDoc);
        setStudentsForYear(list);
        setTotalStudents(list.length);
        refreshDashboardAttendance(list);
      },
      (error: FirestoreError) => {
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'students',
                operation: 'list',
            }));
        }
      });

      const staffQuery = query(collection(db, 'staff'), where('isActive', '==', true), where('staffType', '==', 'teacher'));
      const unsubscribeStaff = onSnapshot(staffQuery, (querySnapshot) => {
        setTotalTeachers(querySnapshot.size);
      },
      (error: FirestoreError) => {
        if (error.code === 'permission-denied') {
            errorEmitter.emit('permission-error', new FirestorePermissionError({
                path: 'staff',
                operation: 'list',
            }));
        }
      });

      return () => {
        unsubscribeStudents();
        unsubscribeStaff();
      };
  }, [selectedYear, db, user, refreshDashboardAttendance]);

  const handleQuickSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const queryStr = quickSearchInput.trim().toLowerCase();
    if (!queryStr) {
        toast({ variant: "destructive", title: "তথ্য দিন", description: "রোল বা আইডি লিখুন।" });
        return;
    }

    const bnToEn = (str: string) => str.toString().replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)].toString());
    const queryEn = bnToEn(queryStr);
    const rollEn = parseInt(queryEn, 10);

    const found = studentsForYear.find(s => {
        if (s.generatedId && s.generatedId.toLowerCase() === queryEn) {
            return true;
        }
        if (quickSearchClass && !isNaN(rollEn)) {
            return s.className === quickSearchClass && s.roll === rollEn;
        }
        return false;
    });

    if (found) {
        setQuickFeeStudent(found);
        setQuickSearchInput('');
        setIsQuickPaymentOpen(false);
    } else {
        toast({
            variant: "destructive",
            title: "শিক্ষার্থী পাওয়া যায়নি",
            description: "সঠিক আইডি লিখুন অথবা রোল এবং শ্রেণি উভয়ই চেক করুন।"
        });
    }
  };

  const handleQuickAttendanceSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db) return;
    if (!quickAttendanceClass) {
        toast({ variant: 'destructive', title: 'শ্রেণি নির্বাচন করুন' });
        return;
    }

    setIsSavingQuickAttendance(true);
    try {
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        const activeHoliday = await isHoliday(db, todayStr);
        const dayOfWeek = new Date().getDay();
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;

        if (activeHoliday || isWeekend) {
            toast({ 
                variant: 'destructive', 
                title: 'আজ ছুটির দিন!', 
                description: activeHoliday ? `আজ ${activeHoliday.description} উপলক্ষে স্কুল বন্ধ।` : 'আজ সাপ্তাহিক ছুটি।' 
            });
            setIsSavingQuickAttendance(false);
            return;
        }

        if (!isConfirmingQuickAttendance) {
            const existing = await getAttendanceForClassAndDate(db, todayStr, quickAttendanceClass, selectedYear);
            if (existing) {
                setIsConfirmingQuickAttendance(true);
                toast({ 
                    variant: 'destructive', 
                    title: 'হাজিরা ইতিমধ্যে নেওয়া হয়েছে!', 
                    description: 'আপনি কি পূর্বের হাজিরা মুছে নতুনভাবে সেভ করতে চান? চাইলে আবার এন্টার দিন।' 
                });
                setIsSavingQuickAttendance(false);
                return;
            }
        }

        const bnToEn = (str: string) => str.replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)].toString());
        const inputRolls = quickAttendanceInput
            .split(/[\s,]+/)
            .map(r => parseInt(bnToEn(r.trim()), 10))
            .filter(r => !isNaN(r));

        let classStudents = (studentsForYear || []).filter(
            (s: Student) => String(s.className) === String(quickAttendanceClass)
        );

        if (classStudents.length === 0) {
            const qSnap = await getDocs(query(
                collection(db, 'students'),
                where('className', '==', quickAttendanceClass),
                where('academicYear', '==', selectedYear)
            ));
            classStudents = qSnap.docs.map((docSnap: QueryDocumentSnapshot) => ({ id: docSnap.id, ...docSnap.data() } as Student));
        }

        if (classStudents.length === 0) {
            toast({ variant: 'destructive', title: 'এই শ্রেণিতে কোনো শিক্ষার্থী পাওয়া যায়নি' });
            setIsSavingQuickAttendance(false);
            return;
        }

        const attendanceData: StudentAttendance[] = classStudents.map((student: Student) => ({
            studentId: student.id,
            status: (student.roll !== undefined && inputRolls.includes(student.roll)) ? 'present' : 'absent'
        }));

        const dailyAttendance: DailyAttendance = {
            date: todayStr,
            academicYear: selectedYear,
            className: quickAttendanceClass,
            attendance: attendanceData,
        };

        await saveDailyAttendance(db, dailyAttendance);

        toast({
            title: `আজকের কুইক হাজিরা সংরক্ষিত হয়েছে (${classNamesMap[quickAttendanceClass] || quickAttendanceClass} শ্রেণি)`,
            description: `${inputRolls.length} জন উপস্থিত হিসেবে সেভ হয়েছে।`
        });
        setQuickAttendanceInput('');
        setIsConfirmingQuickAttendance(false);
        setIsQuickAttendanceOpen(false);

        refreshDashboardAttendance(studentsForYear);
    } catch (err: any) {
        console.error("Error saving quick attendance:", err);
        toast({ variant: 'destructive', title: 'হাজিরা সেভ করতে সমস্যা হয়েছে' });
    } finally {
        setIsSavingQuickAttendance(false);
    }
  };

  const presentPercentage = totalStudents > 0 ? ((totalPresent / totalStudents) * 100).toFixed(1) : "০";
  const absentPercentage = totalStudents > 0 ? ((totalAbsent / totalStudents) * 100).toFixed(1) : "০";

  const qQuery = useMemo(() => (db && user) ? collection(db, 'questions') : null, [db, user]);
  const pQuery = useMemo(() => (db && user) ? collection(db, 'pdf-sheets') : null, [db, user]);
  const lQuery = useMemo(() => (db && user) ? collection(db, 'lecture-sheets') : null, [db, user]);

  const { data: allQuestions } = useCollection(qQuery);
  const { data: allPdfSheets } = useCollection(pQuery);
  const { data: allLectureSheets } = useCollection(lQuery);

  const stats = useMemo(() => {
    const classData: Record<string, Record<string, Record<string, any>>> = {};
    CLASSES.forEach(c => { classData[c.id] = {}; });
    
    const aggregate = (cid: string, sub: string, chRaw: string, type: string) => {
      if (!classData[cid]) return;
      if (!classData[cid][sub]) classData[cid][sub] = {};
      const key = getNormalizedKey(chRaw);
      if (!classData[cid][sub][key]) {
        classData[cid][sub][key] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      }
      classData[cid][sub][key][type]++;
    };

    allPdfSheets?.forEach(item => {
      const type = item.category === 'creative' ? 'creative' : 
                   item.category === 'lecture_sheet' ? 'lectureSheet' :
                   item.category === 'mcq' ? 'mcq' :
                   item.category === 'answer_key' ? 'answerKey' :
                   item.category === 'model_test' ? 'modelTest' : null;
      if (type) aggregate(item.classId, item.subject, item.chapterName || '', type);
    });

    allQuestions?.forEach(item => {
      const type = item.examType === 'model_test' ? 'modelTest' : (item.isMcq ? 'mcq' : 'creative');
      aggregate(item.classId, item.subject, item.chapter || '', type);
    });

    allLectureSheets?.forEach(item => {
      aggregate(item.classId, item.subject, item.topic || '', 'lectureSheet');
    });

    return { classData };
  }, [allQuestions, allPdfSheets, allLectureSheets]);

  useEffect(() => { if (!loading && !user) router.push('/auth'); }, [user, loading, router]);

  if (loading || !user) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-bold">অ্যাক্সেস চেক করা হচ্ছে...</p>
      </div>
    );
  }

  const glassClass = "backdrop-blur-2xl border-2 border-black shadow-[0_12px_40px_rgba(0,0,0,0.15)]";

  return (
    <div className="space-y-8 animate-fade-in font-kalpurush">
      <NoticeTicker />

      {/* Quick Actions Bar */}
      <div className="flex flex-wrap gap-4 items-center justify-center sm:justify-start">
          <Link href="/add-student">
              <Button className="h-12 px-6 rounded-2xl bg-blue-600 hover:bg-blue-700 shadow-lg font-black gap-2 transition-all active:scale-95 text-white">
                  <UserPlus className="h-5 w-5" /> কুইক ভর্তি
              </Button>
          </Link>

          <Dialog open={isQuickPaymentOpen} onOpenChange={setIsQuickPaymentOpen}>
              <DialogTrigger asChild>
                  <Button className="h-12 px-6 rounded-2xl bg-teal-600 hover:bg-teal-700 shadow-lg font-black gap-2 transition-all active:scale-95 text-white">
                      <Banknote className="h-5 w-5" /> কুইক পেমেন্ট
                  </Button>
              </DialogTrigger>
              <DialogContent className="font-kalpurush sm:max-w-md">
                  <DialogHeader>
                      <DialogTitle className="text-xl font-black text-teal-700 flex items-center gap-2">
                          <Banknote /> কুইক পেমেন্ট সার্চ
                      </DialogTitle>
                      <DialogDescription className="font-bold">রোল এবং শ্রেণি নির্বাচন করে শিক্ষার্থী খুঁজুন</DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleQuickSearch} className="space-y-4 py-4">
                      <div className="space-y-2">
                          <Label className="font-bold">শ্রেণি নির্বাচন</Label>
                          <Select value={quickSearchClass} onValueChange={setQuickSearchClass}>
                              <SelectTrigger className="h-11 border-2"><SelectValue placeholder="সিলেক্ট শ্রেণি" /></SelectTrigger>
                              <SelectContent>
                                  {Object.entries(classNamesMap).map(([id, label]) => (
                                      <SelectItem key={id} value={id}>{label} শ্রেণি</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label className="font-bold">রোল অথবা আইডি (ID)</Label>
                          <Input 
                              value={quickSearchInput} 
                              onChange={e => setQuickSearchInput(e.target.value)} 
                              placeholder="এখানে লিখুন..." 
                              className="h-11 border-2 font-black text-lg"
                          />
                      </div>
                      <Button type="submit" className="w-full h-11 bg-teal-600 hover:bg-teal-700 text-white font-black">সার্চ করুন</Button>
                  </form>
              </DialogContent>
          </Dialog>

          <Dialog open={isQuickAttendanceOpen} onOpenChange={(o) => { setIsQuickAttendanceOpen(o); if(!o) setIsConfirmingQuickAttendance(false); }}>
              <DialogTrigger asChild>
                  <Button className="h-12 px-6 rounded-2xl bg-emerald-600 hover:bg-emerald-700 shadow-lg font-black gap-2 transition-all active:scale-95 text-white">
                      <UserCheck className="h-5 w-5" /> কুইক হাজিরা
                  </Button>
              </DialogTrigger>
              <DialogContent className={cn("font-kalpurush sm:max-w-md transition-all duration-300", isConfirmingQuickAttendance && "border-rose-500 ring-4 ring-rose-100")}>
                  <DialogHeader>
                      <DialogTitle className={cn("text-xl font-black flex items-center gap-2", isConfirmingQuickAttendance ? "text-rose-700" : "text-emerald-700")}>
                          {isConfirmingQuickAttendance ? <AlertCircle /> : <UserCheck />}
                          {isConfirmingQuickAttendance ? "পুনরায় সেভ নিশ্চিত করুন" : "আজকের কুইক হাজিরা"}
                      </DialogTitle>
                      <DialogDescription className={cn("font-bold", isConfirmingQuickAttendance && "text-rose-600")}>
                          {isConfirmingQuickAttendance ? "এই শ্রেণির হাজিরা আজ একবার নেওয়া হয়েছে। আপডেট করতে চান?" : "রোল নম্বরগুলো কমা বা স্পেস দিয়ে লিখুন।"}
                      </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={handleQuickAttendanceSubmit} className="space-y-4 py-4">
                      <div className="space-y-2">
                          <Label className="font-bold">শ্রেণি</Label>
                          <Select value={quickAttendanceClass} onValueChange={(v) => { setQuickAttendanceClass(v); setIsConfirmingQuickAttendance(false); }}>
                              <SelectTrigger className="h-11 border-2"><SelectValue placeholder="সিলেক্ট শ্রেণি" /></SelectTrigger>
                              <SelectContent>
                                  {Object.entries(classNamesMap).map(([id, label]) => (
                                      <SelectItem key={id} value={id}>{label} শ্রেণি</SelectItem>
                                  ))}
                              </SelectContent>
                          </Select>
                      </div>
                      <div className="space-y-2">
                          <Label className="font-bold">উপস্থিত রোল নম্বরসমূহ</Label>
                          <Input 
                              value={quickAttendanceInput} 
                              onChange={e => { setQuickAttendanceInput(e.target.value); setIsConfirmingQuickAttendance(false); }} 
                              placeholder="উদা: ১, ২, ৫, ১০" 
                              className={cn("h-11 border-2 font-black text-lg", isConfirmingQuickAttendance && "bg-rose-50")}
                          />
                      </div>
                      <div className="flex gap-2">
                          {isConfirmingQuickAttendance && (
                              <Button type="button" variant="outline" onClick={() => setIsConfirmingQuickAttendance(false)} className="flex-1 font-bold">বাতিল</Button>
                          )}
                          <Button type="submit" disabled={isSavingQuickAttendance} className={cn("flex-1 h-11 font-black text-white", isConfirmingQuickAttendance ? "bg-rose-600 hover:bg-rose-700" : "bg-emerald-600 hover:bg-emerald-700")}>
                              {isSavingQuickAttendance ? <Loader2 className="animate-spin" /> : (isConfirmingQuickAttendance ? 'হ্যাঁ, আপডেট করুন' : 'হাজিরা সম্পন্ন করুন')}
                          </Button>
                      </div>
                  </form>
              </DialogContent>
          </Dialog>
      </div>

      {/* 5 Stat Cards matching user screenshot */}
      <div className="grid gap-4 md:grid-cols-2 md:gap-4 lg:grid-cols-5">
        <GalleryCard />
        
        <Card className="relative overflow-hidden bg-gradient-to-br from-blue-50 to-indigo-100 border-2 border-black shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group rounded-xl">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
             <Users className="h-28 w-28 text-indigo-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-bold text-indigo-900">মোট শিক্ষার্থী</CardTitle>
            <div className="p-2 bg-white/60 rounded-full backdrop-blur-sm shadow-sm">
              <Users className="h-4 w-4 text-indigo-700" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black text-indigo-950 mb-1">{toBengaliNumber(totalStudents)}</div>
            <p className="text-xs text-indigo-700 font-medium">শিক্ষাবর্ষ {toBengaliNumber(selectedYear)}</p>
          </CardContent>
        </Card>
        
         <Card className="relative overflow-hidden bg-gradient-to-br from-emerald-50 to-teal-100 border-2 border-black shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group rounded-xl">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
             <CheckCircle2 className="h-28 w-28 text-teal-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-bold text-teal-900">মোট উপস্থিত</CardTitle>
            <div className="p-2 bg-white/60 rounded-full backdrop-blur-sm shadow-sm">
              <Users className="h-4 w-4 text-teal-700" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-black text-teal-950 mb-1">{toBengaliNumber(totalPresent)}</div>
              <div className="text-sm font-bold text-emerald-700 bg-white/80 px-2 py-0.5 rounded-full border border-emerald-100">{toBengaliNumber(presentPercentage)}%</div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-rose-50 to-red-100 border-2 border-black shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group rounded-xl">
          <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
             <XCircle className="h-28 w-28 text-red-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-bold text-red-900">মোট অনুপস্থিত</CardTitle>
            <div className="p-2 bg-white/60 rounded-full backdrop-blur-sm shadow-sm">
              <Users className="h-4 w-4 text-red-700" />
            </div>
          </CardHeader>            
          <CardContent className="relative z-10">
            <div className="flex items-baseline gap-2">
              <div className="text-3xl font-black text-red-950 mb-1">{toBengaliNumber(totalAbsent)}</div>
              <div className="text-sm font-bold text-rose-700 bg-white/80 px-2 py-0.5 rounded-full border border-rose-100">{toBengaliNumber(absentPercentage)}%</div>
            </div>
          </CardContent>
        </Card>

        <Card className="relative overflow-hidden bg-gradient-to-br from-amber-50 to-orange-100 border-2 border-black shadow-sm hover:shadow-lg transition-all duration-300 hover:-translate-y-1 group rounded-xl">
           <div className="absolute -right-4 -top-4 opacity-5 group-hover:scale-110 transition-transform duration-500">
             <GraduationCap className="h-28 w-28 text-orange-900" />
          </div>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2 relative z-10">
            <CardTitle className="text-sm font-bold text-orange-900">মোট শিক্ষক</CardTitle>
            <div className="p-2 bg-white/60 rounded-full backdrop-blur-sm shadow-sm">
              <GraduationCap className="h-4 w-4 text-orange-700" />
            </div>
          </CardHeader>
          <CardContent className="relative z-10">
            <div className="text-3xl font-black text-orange-950 mb-1">{toBengaliNumber(totalTeachers)}</div>
            <p className="text-xs text-orange-700 font-medium">নিবন্ধিত সক্রিয় শিক্ষক</p>
          </CardContent>
        </Card>
      </div>

      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-1.5 md:gap-2">
        <Link href="/create-question" className="block w-full">
          <div className="bg-[#dc2626] hover:bg-[#b91c1c] border-b-4 border-[#7f1d1d] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <BrainCircuit className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">প্রশ্ন ব্যাংক</span>
          </div>
        </Link>

        <Link href="/notices-management" className="block w-full">
          <div className="bg-[#2563eb] hover:bg-[#1d4ed8] border-b-4 border-[#1e3a8a] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <Bell className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">নোটিশ বোর্ড</span>
          </div>
        </Link>

        <Link href="/create-lecture-sheet" className="block w-full">
          <div className="bg-[#059669] hover:bg-[#047857] border-b-4 border-[#064e3b] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">লেকচার শিট</span>
          </div>
        </Link>

        <Link href="/diary" className="block w-full">
          <div className="bg-[#4f46e5] hover:bg-[#4338ca] border-b-4 border-[#312e81] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <NotebookPen className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">টিচার্স ডায়েরি</span>
          </div>
        </Link>

        <Link href="/student-profile" className="block w-full">
          <div className="bg-[#1e293b] hover:bg-[#0f172a] border-b-4 border-black text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <Search className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">শিক্ষার্থী প্রোফাইল</span>
          </div>
        </Link>

        <Link href="/add-student" className="block w-full">
          <div className="bg-[#0d9488] hover:bg-[#0f766e] border-b-4 border-[#134e4a] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[8.5px] sm:text-[9.5px] md:text-[10px] xl:text-[10.5px] tracking-tight leading-normal text-center whitespace-nowrap drop-shadow-sm">নতুন শিক্ষার্থী ভর্তি</span>
          </div>
        </Link>

        <Link href="/student-list" className="block w-full">
          <div className="bg-[#16a34a] hover:bg-[#15803d] border-b-4 border-[#14532d] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">শিক্ষার্থী তালিকা</span>
          </div>
        </Link>

        <Link href="/attendance" className="block w-full">
          <div className="bg-[#0284c7] hover:bg-[#0369a1] border-b-4 border-[#075985] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <CalendarCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">হাজিরা শাখা</span>
          </div>
        </Link>

        <Link href="/results" className="block w-full">
          <div className="bg-[#7c3aed] hover:bg-[#6d28d9] border-b-4 border-[#4c1d95] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <Award className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">ফলাফল শাখা</span>
          </div>
        </Link>

        <Link href="/accounts" className="block w-full">
          <div className="bg-[#057a55] hover:bg-[#046c4e] border-b-4 border-[#03543f] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <Banknote className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">হিসাব শাখা</span>
          </div>
        </Link>

        <Link href="/messaging" className="block w-full">
          <div className="bg-[#3b82f6] hover:bg-[#2563eb] border-b-4 border-[#1d4ed8] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">মেসেজ শাখা</span>
          </div>
        </Link>

        <Link href="/staff" className="block w-full">
          <div className="bg-[#9333ea] hover:bg-[#7e22ce] border-b-4 border-[#581c87] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <UserCog className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">স্টাফ পোর্টাল</span>
          </div>
        </Link>

        <Link href="/documents" className="block w-full">
          <div className="bg-[#d97706] hover:bg-[#b45309] border-b-4 border-[#78350f] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <FolderOpen className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">ডকুমেন্ট পোর্টাল</span>
          </div>
        </Link>

        <Link href="/routines" className="block w-full">
          <div className="bg-[#6366f1] hover:bg-[#4f46e5] border-b-4 border-[#3730a3] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">রুটিন শাখা</span>
          </div>
        </Link>

        <Link href="/public-exam-records" className="block w-full">
          <div className="bg-[#0891b2] hover:bg-[#0e7490] border-b-4 border-[#164e63] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <Award className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">রেকর্ড শাখা</span>
          </div>
        </Link>

        <Link href="/settings?tab=sheets" className="block w-full">
          <div className="bg-[#ea580c] hover:bg-[#c2410c] border-b-4 border-[#9a3412] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <FileUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">কুইক আপলোড</span>
          </div>
        </Link>

        <Link href="/my-questions" className="block w-full">
          <div className="bg-[#be185d] hover:bg-[#9d174d] border-b-4 border-[#700c35] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <Library className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">আমার লাইব্রেরি</span>
          </div>
        </Link>

        <Link href="/admissions-management" className="block w-full">
          <div className="bg-[#4338ca] hover:bg-[#3730a3] border-b-4 border-[#1e1b4b] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-0.5 w-full">
            <UserCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">ভর্তি আবেদন</span>
          </div>
        </Link>
      </section>

      <section>
        <div className="flex items-center justify-between mb-4 border-b-2 border-black pb-2">
          <h3 className="text-lg font-black text-foreground flex items-center gap-2">
            <GraduationCap className="w-4 h-4 md:w-5 md:h-5 text-primary" />
            বোর্ড বই দেখুন (শ্রেণি নির্বাচন করুন)
          </h3>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 md:gap-3">
          {CLASSES.map((cls) => {
            const classColors: Record<string, { bg: string; hover: string; border: string }> = {
              '6': { bg: 'bg-[#2563eb]', hover: 'hover:bg-[#1d4ed8]', border: 'border-[#1e3a8a]' },
              '7': { bg: 'bg-[#059669]', hover: 'hover:bg-[#047857]', border: 'border-[#064e3b]' },
              '8': { bg: 'bg-[#7c3aed]', hover: 'hover:bg-[#6d28d9]', border: 'border-[#4c1d95]' },
              '9': { bg: 'bg-[#ea580c]', hover: 'hover:bg-[#c2410c]', border: 'border-[#9a3412]' },
              '10': { bg: 'bg-[#dc2626]', hover: 'hover:bg-[#b91c1c]', border: 'border-[#7f1d1d]' },
            };
            const col = classColors[cls.id] || { bg: 'bg-[#4f46e5]', hover: 'hover:bg-[#4338ca]', border: 'border-[#312e81]' };
            return (
              <Link key={cls.id} href={`/class/${cls.id}`} className="block w-full">
                <div className={cn(
                  col.bg,
                  col.hover,
                  "border-b-4",
                  col.border,
                  "text-white h-10 md:h-11 px-2 md:px-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group active:translate-y-0.5 w-full cursor-pointer"
                )}>
                  <BookOpen className="w-4 h-4 md:w-4.5 md:h-4.5 text-white shrink-0 group-hover:scale-110 transition-transform" />
                  <span className="font-black text-xs md:text-sm leading-normal text-center whitespace-nowrap drop-shadow-sm">
                    {cls.label} শ্রেণি
                  </span>
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      <section className="space-y-8">
        <div className="flex items-center justify-between border-b-2 border-black pb-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center animate-bounce shadow-lg border border-white/20">
              <LayoutGrid className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-black text-foreground uppercase tracking-tight">লাইভ কন্টেন্ট ড্যাশবোর্ড</h3>
          </div>
          <div className="flex items-center gap-3">
            <Select value={selectedDashboardClass} onValueChange={setSelectedDashboardClass}>
              <SelectTrigger className="w-[140px] h-8 text-xs font-black border-black bg-white">
                <SelectValue placeholder="শ্রেণি" />
              </SelectTrigger>
              <SelectContent className="font-kalpurush border-2 border-black">
                {CLASSES.map(c => (
                  <SelectItem key={c.id} value={c.id} className="font-bold text-xs">{c.label} শ্রেণি</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Badge className="bg-yellow-400 text-black font-black text-[10px] border border-black hidden md:block">রিয়েল-টাইম আপডেট</Badge>
          </div>
        </div>
        
        <div className="space-y-10">
          {CLASSES.filter(c => c.id === selectedDashboardClass).map((cls) => {
            const allSubjects = getSubjectsForClass(cls.id);
            const selectedSubject = selectedSubjects[cls.id] || allSubjects[0];
            const classChaptersStats = stats.classData[cls.id]?.[selectedSubject] || {};
            
            const predefined = getChaptersForSubject(cls.id, selectedSubject);
            
            const chapterMap = new Map();
            [...predefined, ...Object.keys(classChaptersStats)].forEach(name => {
              const key = getNormalizedKey(name);
              if (!chapterMap.has(key) || (predefined.includes(name) && !predefined.includes(chapterMap.get(key).display))) {
                chapterMap.set(key, { key, display: name });
              }
            });
            
            const sortedChapterList = Array.from(chapterMap.values())
              .sort((a, b) => normalizeForSort(a.display) - normalizeForSort(b.display));
            
            const chapterChunks = chunkArray(sortedChapterList, 20); 

            return (
              <div key={cls.id} className={cn(glassClass, "rounded-xl overflow-hidden bg-white/40 p-1")}>
                <div className="overflow-x-auto custom-scrollbar pb-2">
                  {chapterChunks.length > 0 ? (
                    chapterChunks.map((chunk, chunkIdx) => (
                      <table key={chunkIdx} className="w-full border-collapse border-2 border-black mb-4 last:mb-0">
                        <tbody className="text-slate-900">
                          <tr className="border-b-2 border-black">
                            <td rowSpan={6} className="w-10 border-r-2 border-black bg-white font-black text-center align-middle whitespace-nowrap px-2 text-black" style={{ writingMode: 'vertical-lr', transform: 'rotate(180deg)' }}>
                              শ্রেণি: {cls.label}
                            </td>
                            <td className="w-36 border-r-2 border-black bg-cyan-100 p-1 text-center">
                              <Select 
                                value={selectedSubject} 
                                onValueChange={(val) => setSelectedSubjects(prev => ({...prev, [cls.id]: val}))}
                              >
                                <SelectTrigger className="h-7 text-[10px] font-black border-black bg-white">
                                  <SelectValue placeholder="বিষয়" />
                                </SelectTrigger>
                                <SelectContent className="font-kalpurush border-2 border-black">
                                  {allSubjects.map(sub => (
                                    <SelectItem key={sub} value={sub} className="text-[11px] font-bold">{sub}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                              <div className="text-[8px] font-black mt-0.5 text-cyan-900 uppercase">ড্রপ ডাউন</div>
                            </td>
                            {chunk.map(ch => (
                              <td key={ch.key} className="min-w-[45px] border-r-2 border-black bg-yellow-100 p-1.5 text-center font-black text-[10px] align-middle text-black">
                                {formatChapterDisplay(ch.display)}
                              </td>
                            ))}
                          </tr>

                          <tr className="border-b border-black bg-blue-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-blue-900">লেকচার শিট</td>
                            {chunk.map(ch => (
                              <td key={ch.key} className="border-r-2 border-black p-1 text-center font-black text-[12px]">
                                <Link 
                                  href={`/my-questions?classId=${cls.id}&subject=${encodeURIComponent(selectedSubject)}&chapter=${encodeURIComponent(ch.display)}&category=sheet`}
                                  className="hover:text-blue-600 hover:underline transition-all"
                                >
                                  {toBengaliNumber(classChaptersStats[ch.key]?.lectureSheet || 0)}
                                </Link>
                              </td>
                            ))}
                          </tr>

                          <tr className="border-b border-black bg-orange-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-orange-900">সৃজনশীল</td>
                            {chunk.map(ch => (
                              <td key={ch.key} className="border-r-2 border-black p-1 text-center font-black text-[12px]">
                                <Link 
                                  href={`/my-questions?classId=${cls.id}&subject=${encodeURIComponent(selectedSubject)}&chapter=${encodeURIComponent(ch.display)}&category=creative`}
                                  className="hover:text-orange-600 hover:underline transition-all"
                                >
                                  {toBengaliNumber(classChaptersStats[ch.key]?.creative || 0)}
                                </Link>
                              </td>
                            ))}
                          </tr>

                          <tr className="border-b border-black bg-indigo-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-indigo-900">বহুনির্বাচনী</td>
                            {chunk.map(ch => (
                              <td key={ch.key} className="border-r-2 border-black p-1 text-center font-black text-[12px]">
                                <Link 
                                  href={`/my-questions?classId=${cls.id}&subject=${encodeURIComponent(selectedSubject)}&chapter=${encodeURIComponent(ch.display)}&category=mcq`}
                                  className="hover:text-indigo-600 hover:underline transition-all"
                                >
                                  {toBengaliNumber(classChaptersStats[ch.key]?.mcq || 0)}
                                </Link>
                              </td>
                            ))}
                          </tr>

                          <tr className="border-b border-black bg-green-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-green-900">উত্তরমালা</td>
                            {chunk.map(ch => (
                              <td key={ch.key} className="border-r-2 border-black p-1 text-center font-black text-[12px]">
                                <Link 
                                  href={`/my-questions?classId=${cls.id}&subject=${encodeURIComponent(selectedSubject)}&chapter=${encodeURIComponent(ch.display)}&category=answer`}
                                  className="hover:text-green-600 hover:underline transition-all"
                                >
                                  {toBengaliNumber(classChaptersStats[ch.key]?.answerKey || 0)}
                                </Link>
                              </td>
                            ))}
                          </tr>

                          <tr className="bg-rose-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-rose-900">মডেল টেস্ট</td>
                            {chunk.map(ch => (
                              <td key={ch.key} className="border-r-2 border-black p-1 text-center font-black text-[12px]">
                                <Link 
                                  href={`/my-questions?classId=${cls.id}&subject=${encodeURIComponent(selectedSubject)}&chapter=${encodeURIComponent(ch.display)}&category=model`}
                                  className="hover:text-rose-600 hover:underline transition-all"
                                >
                                  {toBengaliNumber(classChaptersStats[ch.key]?.modelTest || 0)}
                                </Link>
                              </td>
                            ))}
                          </tr>
                        </tbody>
                      </table>
                    ))
                  ) : (
                    <div className="p-10 text-center bg-white/20 border-2 border-black rounded-lg">
                       <p className="text-black font-black text-lg uppercase">এই বিষয়ের কোনো ডাটা পাওয়া যায়নি</p>
                       <p className="text-[10px] font-bold text-muted-foreground">ড্রপ-ডাউন থেকে অন্য বিষয় সিলেক্ট করে দেখুন</p>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Direct Fee Dialog for Quick Search */}
      {quickFeeStudent && (
          <StudentFeeDialog 
            student={quickFeeStudent} 
            open={!!quickFeeStudent} 
            onOpenChange={(o) => !o && setQuickFeeStudent(null)} 
            onFeeCollected={() => {}} 
          />
      )}
      
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: rgba(0,0,0,0.05); }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #000; border-radius: 10px; border: 2px solid white; }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover { background: #333; }
      `}</style>
    </div>
  );
}

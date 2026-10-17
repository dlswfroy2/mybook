"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useUser, useFirestore, useCollection } from '@/firebase';
import Image from 'next/image';
import Link from 'next/link';
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
  ImageIcon,
  AlertCircle,
  Edit3,
  Sparkles,
  Camera,
  FileSearch,
  RefreshCw,
  FileType,
  Save
} from 'lucide-react';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { collection, query, orderBy, limit, onSnapshot, Timestamp, doc, getDocs, where, QueryDocumentSnapshot, addDoc, serverTimestamp, deleteDoc, writeBatch } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogTrigger, DialogClose, DialogFooter } from '@/components/ui/dialog';
import { Skeleton } from '@/components/ui/skeleton';
import { Notice } from '@/lib/notice-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { 
  Select, 
  SelectContent, 
  SelectItem, 
  SelectTrigger, 
  SelectValue 
} from "@/components/ui/select";
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Student, studentFromDoc, sanitizePhotoUrl, getStudentPlaceholderImage } from '@/lib/student-data';
import { getAttendanceForDate, saveDailyAttendance, StudentAttendance, DailyAttendance, getAttendanceForClassAndDate } from '@/lib/attendance-data';
import { isHoliday } from '@/lib/holiday-data';
import { GalleryConfig, defaultGalleryConfig } from '@/lib/gallery-data';
import { StudentFeeDialog } from '@/components/StudentFeeDialog';
import { useToast } from '@/hooks/use-toast';
import { subjectNameNormalization } from '@/lib/subjects';
import { runMultiTaskAi } from '@/ai/flows/multi-task-ai-flow';
import { Textarea } from '@/components/ui/textarea';
import { Progress } from '@/components/ui/progress';
import { DashboardAnalyticsCharts } from '@/components/dashboard/DashboardAnalyticsCharts';

const classNamesMap: Record<string, string> = {
  '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

const toBengaliNumber = (n: number | string | undefined | null): string => {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(n).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const normalize = (name: string) => {
    if (!name) return "";
    const trimmed = name.trim();
    return (subjectNameNormalization[trimmed] || trimmed).toLowerCase();
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

async function processImage(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('ফাইল সাইজ ৫ মেগাবাইটের বেশি হতে পারবে না।');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new window.Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxSide = 400;

        if (width > height) {
          if (width > maxSide) {
            height *= maxSide / width;
            width = maxSide;
          }
        } else {
          if (height > maxSide) {
            width *= maxSide / height;
            height = maxSide;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.7));
      };
      img.onerror = () => reject(new Error('ছবি লোড করা সম্ভব হয়নি।'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('ফাইল পড়া সম্ভব হয়নি।'));
    reader.readAsDataURL(file);
  });
}

function getNormalizedKey(name: string): string {
  if (!name) return 'general';
  let n = name.toString().toLowerCase().trim();
  
  const bnToEn: Record<string, string> = { '০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9' };
  n = n.replace(/[০-৯]/g, m => bnToEn[m]);
  
  const romanMap: Record<string, string> = {
    'viii': '8', 'vii': '7', 'iii': '3', 'ii': '2', 'iv': '4', 'vi': '6', 'ix': '9', 'v': '5', 'x': '10', 'i': '1'
  };
  const sortedRomanKeys = ['viii', 'vii', 'iii', 'ii', 'iv', 'vi', 'ix', 'v', 'x', 'i'];
  for (const r of sortedRomanKeys) {
    const regex = new RegExp(`(^|[-_\\s])${r}([-_\\s]|$)`, 'i');
    if (regex.test(n)) {
      n = n.replace(regex, (match, p1, p2) => `${p1}${romanMap[r]}${p2}`);
    }
  }

  const wordMap: Record<string, string> = {
    'প্রথম': '1', '১ম': '1', '১': '1', '1st': '1',
    'দ্বিতীয়': '2', '২য়': '2', '২': '2', '2nd': '2',
    'তৃতীয়': '3', '৩য়': '3', '৩': '3', '3rd': '3',
    'চতুর্থ': '4', 'চতুথ': '4', '৪র্থ': '4', '৪': '4', '4th': '4',
    'পঞ্চম': '5', '৫ম': '5', '৫': '5', '5th': '5',
    'ষষ্ঠ': '6', '৬ষ্ঠ': '6', '৬': '6', '6th': '6',
    'সপ্তম': '7', '৭ম': '7', '৭': '7', '7th': '7',
    'অষ্টম': '8', '৮ম': '8', '৮': '8', '8th': '8',
    'নবম': '9', '৯ম': '9', '৯': '9', '9th': '9',
    'দশম': '10', '১০ম': '10', '১০': '10', '10th': '10',
    'একাদশ': '11', '১১': '11', '১১শ': '11', 'এগারো': '11',
    'দ্বাদশ': '12', '১২': '12', '১২শ': '12'
  };

  for (const [word, val] of Object.entries(wordMap)) {
    if (n.includes(word)) return val;
  }

  const match = n.match(/\d+/);
  return match ? match[0] : n;
}

function normalizeForSort(name: string): number {
  const norm = getNormalizedKey(name);
  const num = parseInt(norm);
  return isNaN(num) ? 998 : num;
}

function formatChapterDisplay(name: string): string {
  if (!name || name === 'general') return 'সাধারণ';
  const key = getNormalizedKey(name);
  const num = parseInt(key);
  
  const BENGALI_ORDINALS_INTERNAL = [
    '১ম', '২য়', '৩য়', '৪র্থ', '৫ম', '৬ষ্ঠ', '৭ম', '৮ম', '৯ম', '১০ম',
    'একাদশ', 'দ্বাদশ', 'ত্রয়োদশ', 'চতুর্দশ', 'পঞ্চদশ', 'ষোড়শ', 'সপ্তদশ', 'অষ্টাদশ', 'ঊনবিংশ', 'বিংশ'
  ];

  if (!isNaN(num)) {
    if (num >= 1 && num <= 20) return BENGALI_ORDINALS_INTERNAL[num - 1];
    return toBengaliNumber(num);
  }

  return name.split(/[\s:]/)[0] || name;
}

const MONTHS = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];

const GalleryCard = () => {
    const db = useFirestore();
    const { user } = useUser();
    const [config, setConfig] = useState<GalleryConfig>(defaultGalleryConfig);
    const [currentIdx, setCurrentIdx] = useState(0);
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        if (!db || !user?.uid) return;
        const unsub = onSnapshot(doc(db, 'school', 'gallery'), (snap) => {
            if (snap.exists()) {
                setConfig(snap.data() as GalleryConfig);
            }
            setIsLoading(false);
        }, async (error: any) => {
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'school/gallery',
                    operation: 'get',
                }));
            }
        });
        return () => unsub();
    }, [db, user?.uid]);

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

function chunkArray<T>(array: T[], size: number): T[][] {
  if (array.length === 0) return [];
  const chunks = [];
  for (let i = 0; i < array.length; i += size) {
    chunks.push(array.slice(i, i + size));
  }
  return chunks;
}

const NoticeTicker = () => {
    const db = useFirestore();
    const { user } = useUser();
    const [scrollingNotices, setScrollingNotices] = useState<Notice[]>([]);
    const [isClient, setIsClient] = useState(false);

    useEffect(() => {
        setIsClient(true);
    }, []);

    useEffect(() => {
        if (!db || !user?.uid || !isClient) return;
        
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
        }, async (error: any) => {
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({
                    path: 'notices',
                    operation: 'list',
                }));
            }
        });

        return () => unsubscribe();
    }, [db, user?.uid, isClient]);

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

// Smart student matcher to resolve class when not explicitly mentioned in documents
function matchStudentsAndResolveClass(
  extractedStudents: Array<{ roll: number; name?: string; status?: string }>,
  allStudents: Student[]
): { resolvedClass: string | null; matchedMap: Map<number, Student> } {
  if (!extractedStudents || extractedStudents.length === 0) return { resolvedClass: null, matchedMap: new Map() };

  const classScores: Record<string, number> = { '6': 0, '7': 0, '8': 0, '9': 0, '10': 0 };
  const matchedMap = new Map<number, Student>();

  extractedStudents.forEach(item => {
    const candidateMatches = allStudents.filter(s => Number(s.roll) === Number(item.roll));
    if (candidateMatches.length === 1) {
      const s = candidateMatches[0];
      classScores[s.className] = (classScores[s.className] || 0) + 2;
      matchedMap.set(Number(item.roll), s);
    } else if (candidateMatches.length > 1) {
      const cleanedItemName = (item.name || '').replace(/[\s\.\-_]/g, '');
      const nameMatch = candidateMatches.find(s => {
        if (!cleanedItemName) return false;
        const cleanedDbName = (s.studentNameBn || '').replace(/[\s\.\-_]/g, '');
        return cleanedDbName.includes(cleanedItemName) || cleanedItemName.includes(cleanedDbName);
      });
      if (nameMatch) {
        classScores[nameMatch.className] = (classScores[nameMatch.className] || 0) + 5;
        matchedMap.set(Number(item.roll), nameMatch);
      } else {
        candidateMatches.forEach(s => {
          classScores[s.className] = (classScores[s.className] || 0) + 1;
        });
      }
    }
  });

  let bestClass: string | null = null;
  let maxScore = 0;
  Object.entries(classScores).forEach(([cls, score]) => {
    if (score > maxScore) {
      maxScore = score;
      bestClass = cls;
    }
  });

  return { resolvedClass: bestClass, matchedMap };
}

interface ExtractedStudentItem {
  roll: number;
  name?: string;
  className?: string | null;
  status?: 'present' | 'absent';
  dailyAttendance?: Array<{ date: string; status: 'present' | 'absent' }>;
}

interface IndividualAttendanceMatch {
  extractedStudent: ExtractedStudentItem;
  dbStudent?: Student;
  resolvedClass?: string;
  isMatched: boolean;
}

function normalizeClassId(raw?: string | number | null): string | null {
  if (raw === undefined || raw === null) return null;
  const str = String(raw).trim().toLowerCase();
  if (!str) return null;

  if (str === '6' || str === '৬' || str.includes('৬ষ্ঠ') || str.includes('ষষ্ঠ') || str.includes('six')) return '6';
  if (str === '7' || str === '৭' || str.includes('৭ম') || str.includes('সপ্তম') || str.includes('seven')) return '7';
  if (str === '8' || str === '৮' || str.includes('৮ম') || str.includes('অষ্টম') || str.includes('eight')) return '8';
  if (str === '9' || str === '৯' || str.includes('৯ম') || str.includes('নবম') || str.includes('nine')) return '9';
  if (str === '10' || str === '১০' || str.includes('১০ম') || str.includes('দশম') || str.includes('ten')) return '10';

  if (str === '1' || str === '১' || str.includes('১ম') || str.includes('প্রথম') || str.includes('one')) return '1';
  if (str === '2' || str === '২' || str.includes('২য়') || str.includes('দ্বিতীয়') || str.includes('two')) return '2';
  if (str === '3' || str === '৩' || str.includes('৩য়') || str.includes('তৃতীয়') || str.includes('three')) return '3';
  if (str === '4' || str === '৪' || str.includes('৪র্থ') || str.includes('চতুর্থ') || str.includes('four')) return '4';
  if (str === '5' || str === '৫' || str.includes('৫ম') || str.includes('পঞ্চম') || str.includes('five')) return '5';

  return str;
}

function cleanBengaliText(str?: string): string {
  if (!str) return '';
  return str
    .normalize('NFC')
    .toLowerCase()
    .replace(/[.\-_,]/g, ' ')
    .replace(/\b(মো|মোঃ|মোহাম্মদ|মোসা|মোসাম্মৎ|মোহা|শ্রী|শ্রীমতি|md|mst|mohammad|mohammed)\b/gi, '')
    .trim();
}

function getBengaliNameSimilarity(extractedName: string, dbName: string): number {
  if (!extractedName || !dbName) return 0;
  const c1 = cleanBengaliText(extractedName);
  const c2 = cleanBengaliText(dbName);

  if (c1 === c2) return 100;

  const words1 = c1.split(/\s+/).filter(w => w.length >= 2);
  const words2 = c2.split(/\s+/).filter(w => w.length >= 2);

  if (words1.length === 0 || words2.length === 0) return 0;

  let score = 0;
  for (const w1 of words1) {
    for (const w2 of words2) {
      if (w1 === w2) {
        score += 10;
      } else if (w1.includes(w2) || w2.includes(w1)) {
        score += 6;
      } else {
        const w1NoReph = w1.replace(/র্/g, '');
        const w2NoReph = w2.replace(/র্/g, '');
        if (w1NoReph === w2NoReph) {
          score += 8;
        } else if (w1NoReph.includes(w2NoReph) || w2NoReph.includes(w1NoReph)) {
          score += 5;
        }
      }
    }
  }
  return score;
}
interface ExtractedStudentItem {
  roll: number;
  name?: string;
  className?: string | null;
  status?: 'present' | 'absent';
  dailyAttendance?: Array<{ date: string; status: 'present' | 'absent' }>;
}

interface IndividualAttendanceMatch {
  extractedStudent: ExtractedStudentItem;
  dbStudent?: Student;
  resolvedClass?: string;
  isMatched: boolean;
}

function resolveIndividualAttendance(
  extractedList: ExtractedStudentItem[],
  allStudents: Student[]
): {
  matchedList: IndividualAttendanceMatch[];
  unmatchedList: IndividualAttendanceMatch[];
  matchedByClass: Record<string, IndividualAttendanceMatch[]>;
} {
  const matchedList: IndividualAttendanceMatch[] = [];
  const unmatchedList: IndividualAttendanceMatch[] = [];
  const matchedByClass: Record<string, IndividualAttendanceMatch[]> = {};

  extractedList.forEach(item => {
    if (item.roll === undefined || item.roll === null || isNaN(Number(item.roll))) {
      unmatchedList.push({ extractedStudent: item, isMatched: false });
      return;
    }

    const rollNum = Number(item.roll);
    let candidates = allStudents.filter(s => Number(s.roll) === rollNum);

    if (candidates.length === 0) {
      unmatchedList.push({ extractedStudent: item, isMatched: false });
      return;
    }

    let matched: Student | null = null;
    const normItemClass = normalizeClassId(item.className);

    if (candidates.length === 1) {
      matched = candidates[0];
    } else {
      // Multiple candidates share the same roll across different classes.
      // Match primarily by student name similarity!
      if (item.name) {
        let bestCand: Student | null = null;
        let maxScore = 0;

        candidates.forEach(cand => {
          const scoreBn = getBengaliNameSimilarity(item.name || '', cand.studentNameBn || '');
          const scoreEn = getBengaliNameSimilarity(item.name || '', cand.studentNameEn || '');
          let totalScore = Math.max(scoreBn, scoreEn);

          // If the AI-extracted class matches this candidate's class, give a small bonus,
          // but only if the name has at least some match (score >= 3)
          if (normItemClass && normalizeClassId(cand.className) === normItemClass && totalScore >= 3) {
            totalScore += 2;
          }

          if (totalScore > maxScore && totalScore >= 3) {
            maxScore = totalScore;
            bestCand = cand;
          }
        });

        if (bestCand) {
          matched = bestCand;
        }
      }

      // If no name match was found (or item.name was absent), check if explicit className is provided
      if (!matched && normItemClass) {
        const clsCand = candidates.find(s => normalizeClassId(s.className) === normItemClass);
        if (clsCand) {
          matched = clsCand;
        }
      }
    }

    if (matched) {
      const cls = matched.className;
      const record: IndividualAttendanceMatch = {
        extractedStudent: item,
        dbStudent: matched,
        resolvedClass: cls,
        isMatched: true
      };
      matchedList.push(record);
      if (!matchedByClass[cls]) matchedByClass[cls] = [];
      matchedByClass[cls].push(record);
    } else {
      unmatchedList.push({
        extractedStudent: item,
        isMatched: false
      });
    }
  });

  return { matchedList, unmatchedList, matchedByClass };
}
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

  const [isQuickPaymentOpen, setIsQuickPaymentOpen] = useState(false);
  const [quickSearchInput, setQuickSearchInput] = useState('');
  const [quickSearchClass, setQuickSearchClass] = useState<string>('');
  const [studentsForYear, setStudentsForYear] = useState<Student[]>([]);
  const [quickFeeStudent, setQuickFeeStudent] = useState<Student | null>(null);

  const [isQuickAttendanceOpen, setIsQuickAttendanceOpen] = useState(false);
  const [quickAttendanceClass, setQuickAttendanceClass] = useState<string>('6');
  const [quickAttendanceInput, setQuickAttendanceInput] = useState('');
  const [isSavingQuickAttendance, setIsSavingQuickAttendance] = useState(false);
  const [isConfirmingQuickAttendance, setIsConfirmingQuickAttendance] = useState(false);

  // AI Portal States
  const [isAiPortalOpen, setIsAiPortalOpen] = useState(false);
  const [aiTask, setAiTask] = useState<'attendance' | 'results' | 'admission' | 'fees'>('attendance');
  const [aiImage, setAiImage] = useState<string | null>(null);
  const [aiRawText, setAiRawText] = useState('');
  const [aiProcessing, setAiProcessing] = useState(false);
  const [aiResult, setAiResult] = useState<any>(null);
  const [selectedAiDate, setSelectedAiDate] = useState<string>('');
  const [selectedAiClass, setSelectedAiClass] = useState<string>('6');
  const [applyToAllDates, setApplyToAllDates] = useState<boolean>(false);
  const aiFileInputRef = useRef<HTMLInputElement>(null);

  // Quick PDF/Word Upload States
  const [isQuickUploadOpen, setIsQuickUploadOpen] = useState(false);
  const [quickUploadFile, setQuickUploadFile] = useState<File | null>(null);
  const [isQuickUploading, setIsQuickUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);
  const [duplicateId, setDuplicateId] = useState<string | null>(null);
  const [quickUploadMeta, setQuickUploadMeta] = useState({
    category: '',
    classId: '',
    subject: '',
    chapter: ''
  });
  const quickUploadInputRef = useRef<HTMLInputElement>(null);

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
      if (!db || !user?.uid) return;

      const studentsQuery = query(collection(db, 'students'), where('academicYear', '==', selectedYear));
      
      const unsubscribeStudents = onSnapshot(studentsQuery, async (studentsSnapshot) => {
        const list = studentsSnapshot.docs.map(studentFromDoc);
        setStudentsForYear(list);
        setTotalStudents(list.length);
        refreshDashboardAttendance(list);
      },
      (error: any) => {
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
      (error: any) => {
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
  }, [selectedYear, db, user?.uid, refreshDashboardAttendance]);

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
                description: activeHoliday ? `আজ ${activeHoliday.description} উপলক্ষে আজ বিদ্যালয় বন্ধ।` : 'আজ সাপ্তাহিক ছুটি।' 
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

  // Smart Parsing Logic for Filenames
  const parseMetadataFromFilename = (filename: string) => {
    const meta = { category: '', classId: '', subject: '', chapter: '' };
    const name = filename.toLowerCase();

    // 1. Detect Category FIRST
    const catMap: Record<string, string> = {
        'সৃজনশীল': 'creative', 'সৃজনশিল': 'creative', 'cq': 'creative', 'creative': 'creative',
        'বহুনির্বাচনী': 'mcq', 'mcq': 'mcq', 'এমসিকিউ': 'mcq', 'বহুনির্বাচনি': 'mcq',
        'উত্তরমালা': 'answer_key', 'সমাধান': 'answer_key', 'answer': 'answer_key', 'solution': 'answer_key',
        'মডেলটেষ্ট': 'model_test', 'মডেল টেস্ট': 'model_test', 'মডেল': 'model_test', 'model': 'model_test',
        'লেকচার': 'lecture_sheet', 'লেকচার সিট': 'lecture_sheet', 'লেকচার সীট': 'lecture_sheet', 'লেকচার শিট': 'lecture_sheet', 'হ্যান্ডআউট': 'lecture_sheet', 'handout': 'lecture_sheet', 'sheet': 'lecture_sheet'
    };
    for (const [k, v] of Object.entries(catMap)) {
        if (name.includes(k)) { meta.category = v; break; }
    }

    // 2. Detect Class
    const classMap: Record<string, string> = {
        'অষ্টম': '8', 'সপ্তম': '7', 'ষষ্ঠ': '6', 'নবম': '9', 'দশম': '10',
        '৬ষ্ঠ': '6', '৭ম': '7', '৮ম': '8', '৯ম': '9', '১০ম': '10',
        '6': '6', '7': '7', '8': '8', '9': '9', '10': '10',
        'viii': '8', 'vii': '7', 'vi': '6', 'ix': '9', 'x': '10'
    };
    const sortedClassKeys = Object.keys(classMap).sort((a, b) => b.length - a.length);
    let classKeywordUsed = '';
    for (const k of sortedClassKeys) {
        if (name.includes(k)) { 
            meta.classId = classMap[k]; 
            classKeywordUsed = k; 
            break; 
        }
    }

    // 3. Detect Subject
    const subjectSynonyms: Record<string, string> = {
        'পদাথ': 'পদার্থ', 'পদারথ': 'পদার্থ', 'ভূগোল': 'ভূগোল ও পরিবেশ', 'রসায়ন': 'রসায়ন', 'গণিত': 'গণিত', 
        'ইংরেজি': 'ইংরেজি প্রথম', 'বাংলা': 'বাংলা প্রথম', 'আইসিটি': 'তথ্য ও যোগাযোগ প্রযুক্তি', 
        'বিজিএস': 'বাংলাদেশ ও বিশ্ব পরিচয়', 'বা ও বি': 'বাংলাদেশ ও বিশ্ব পরিচয়', 'বাও বি': 'বাংলাদেশ ও বিশ্ব পরিচয়',
        'ইতিহাস': 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা', 'পৌরনীতি': 'পৌরনীতি ও নাগরিকতা',
        'বাংলা১ম': 'বাংলা প্রথম', 'বাংলা ২য়': 'বাংলা দ্বিতীয়', 'ইংরেজি১ম': 'ইংরেজি প্রথম', 'ইংরেজি ২য়': 'ইংরেজি দ্বিতীয়'
    };
    
    let foundSub = '';
    for (const [syn, real] of Object.entries(subjectSynonyms)) {
        if (name.includes(syn)) { foundSub = real; break; }
    }

    if (!foundSub) {
        const testClasses = meta.classId ? [meta.classId] : ['6', '7', '8', '9', '10'];
        for (const cid of testClasses) {
            const currentSubs = getSubjectsForClass(cid);
            for (const sub of currentSubs) {
                const normSub = (subjectNameNormalization[sub] || sub).toLowerCase();
                if (name.includes(normSub) || name.includes(sub.toLowerCase())) {
                    foundSub = sub;
                    break;
                }
            }
            if (foundSub) break;
        }
    }
    if (foundSub) meta.subject = foundSub;

    // 4. Detect Chapter - Improved logic to avoid partial matches (e.g., 1 matching 11)
    if (meta.subject && meta.classId) {
        const chaps = getChaptersForSubject(meta.classId, meta.subject);
        
        // Remove class keyword from filename during chapter matching to prevent confusion
        let strippedName = name;
        if (classKeywordUsed) {
            strippedName = name.replace(classKeywordUsed, '');
        }
        
        const tokens = strippedName.split(/[\s\-_,।]/).filter(t => t.length > 0);
        
        for (const ch of chaps) {
            const normChap = getNormalizedKey(ch);
            const chDisplayName = ch.toLowerCase();
            
            // Check for exact numeric match or display name match
            const isMatch = tokens.some(t => {
                const normT = getNormalizedKey(t);
                // Explicitly check for equality to prevent "1" matching "11"
                return (normT === normChap && normT !== 'general') || t.includes(chDisplayName);
            });

            if (isMatch) {
                meta.chapter = ch;
                break;
            }
        }
    }

    return meta;
  };

  const handleQuickPdfUpload = async (e: React.FormEvent, isConfirmed = false) => {
    e.preventDefault();
    if (!db || !user || !quickUploadFile) {
        toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ', description: 'ফাইল নিশ্চিত করুন।'});
        return;
    }

    const autoMeta = parseMetadataFromFilename(quickUploadFile.name);
    // Detected Meta takes precedence over empty default state
    const finalMeta = {
        category: quickUploadMeta.category || autoMeta.category || 'lecture_sheet',
        classId: quickUploadMeta.classId || autoMeta.classId,
        subject: quickUploadMeta.subject || autoMeta.subject,
        chapter: quickUploadMeta.chapter || autoMeta.chapter
    };

    if (!finalMeta.classId || !finalMeta.subject) {
        toast({ variant: 'destructive', title: 'অসম্পূর্ণ সিলেকশন', description: 'সিস্টেম শ্রেণি বা বিষয় শনাক্ত করতে পারেনি। অনুগ্রহ করে ম্যানুয়ালি সিলেক্ট করুন।' });
        return;
    }

    // Duplicate Check
    if (!isConfirmed) {
        const q = query(
            collection(db, 'pdf-sheets'),
            where('fileName', '==', quickUploadFile.name),
            where('classId', '==', finalMeta.classId),
            where('subject', '==', finalMeta.subject)
        );
        const snap = await getDocs(q);
        if (!snap.empty) {
            setIsConfirmingReplace(true);
            setDuplicateId(snap.docs[0].id);
            toast({ variant: 'destructive', title: 'ফাইলটি ইতিমধ্যে আছে', description: 'রিপ্লেস করতে এন্টার (Enter) চাপুন।' });
            return;
        }
    }

    setIsQuickUploading(true);
    setUploadProgress(10);

    try {
        if (isConfirmed && duplicateId) {
            await deleteDoc(doc(db, 'pdf-sheets', duplicateId));
        }

        const base64String = await fileToBase64(quickUploadFile);
        setUploadProgress(60);

        const sheetData = {
            category: finalMeta.category,
            classId: finalMeta.classId,
            subject: finalMeta.subject,
            chapterName: finalMeta.chapter || 'সাধারণ',
            fileName: quickUploadFile.name,
            pdfUrl: base64String, 
            uploadedAt: serverTimestamp(),
            userId: user.uid
        };

        await addDoc(collection(db, 'pdf-sheets'), sheetData);
        setUploadProgress(100);
        toast({ title: "সফল", description: "ফাইলটি সফলভাবে লাইব্রেরিতে সংরক্ষিত হয়েছে।" });
        setIsQuickUploadOpen(false);
        setQuickUploadFile(null);
        setIsConfirmingReplace(false);
        setDuplicateId(null);
    } catch (e: any) {
        toast({ variant: "destructive", title: "ত্রুটি", description: e.message });
    } finally {
        setIsQuickUploading(false);
    }
  };

  const handleKeyDownInUpload = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && isConfirmingReplace) {
        handleQuickPdfUpload(e as any, true);
    }
  };

  const handleAiFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      if (file.size > 5 * 1024 * 1024) throw new Error('ফাইল সাইজ ৫ মেগাবাইটের বেশি হতে পারবে না।');
      if (file.type === 'application/pdf') {
        const base64 = await fileToBase64(file);
        setAiImage(base64);
      } else {
        const base64 = await processImage(file);
        setAiImage(base64);
      }
      toast({ title: 'ফাইল লোড হয়েছে' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: err.message });
    }
  };

  const handleAiAction = async () => {
    if (!aiImage && !aiRawText.trim()) return;
    setAiProcessing(true);
    setAiResult(null);
    try {
      const result = await runMultiTaskAi({
        photoDataUri: aiImage || undefined,
        rawText: aiRawText,
        taskType: aiTask,
        academicYear: selectedYear
      });

      if (result.error) throw new Error(result.error);
      
      if (result.date) setSelectedAiDate(result.date);
      else setSelectedAiDate(format(new Date(), 'yyyy-MM-dd'));

      if (aiTask === 'attendance') {
        let rawStudentsList: ExtractedStudentItem[] = [];

        // 1. Check classesAttendance first if multiple classes are grouped
        if (Array.isArray(result.classesAttendance) && result.classesAttendance.length > 0) {
          result.classesAttendance.forEach((ca: any) => {
            const classId = normalizeClassId(ca.className);
            if (Array.isArray(ca.students) && ca.students.length > 0) {
              ca.students.forEach((st: any) => {
                rawStudentsList.push({
                  ...st,
                  roll: Number(st.roll),
                  className: normalizeClassId(st.className) || classId
                });
              });
            } else {
              (ca.presentRolls || []).forEach((r: number) => {
                rawStudentsList.push({ roll: Number(r), className: classId, status: 'present' });
              });
              (ca.absentRolls || []).forEach((r: number) => {
                rawStudentsList.push({ roll: Number(r), className: classId, status: 'absent' });
              });
            }
          });
        // 2. Otherwise extract from root students array if classesAttendance was not provided
        } else if (Array.isArray(result.students) && result.students.length > 0) {
          result.students.forEach((s: any) => {
            rawStudentsList.push({
              ...s,
              roll: Number(s.roll),
              className: normalizeClassId(s.className)
            });
          });
        }

        // 3. Fallback to root presentRolls / absentRolls if still empty
        if (rawStudentsList.length === 0) {
          const rootClass = normalizeClassId(result.className);
          (result.presentRolls || []).forEach((r: number) => {
            rawStudentsList.push({ roll: Number(r), className: rootClass, status: 'present' });
          });
          (result.absentRolls || []).forEach((r: number) => {
            rawStudentsList.push({ roll: Number(r), className: rootClass, status: 'absent' });
          });
        }

        // De-duplicate items by roll + normalized name
        const uniqueStudents: ExtractedStudentItem[] = [];
        const seenKeys = new Set<string>();
        rawStudentsList.forEach(st => {
          const cleanName = cleanBengaliText(st.name || '');
          const key = cleanName ? `${st.roll}_${cleanName}` : `${st.roll}_${st.className || ''}`;
          if (!seenKeys.has(key)) {
            seenKeys.add(key);
            uniqueStudents.push(st);
          }
        });

        const { matchedList, unmatchedList, matchedByClass } = resolveIndividualAttendance(
          uniqueStudents,
          studentsForYear
        );

        result.matchedList = matchedList;
        result.unmatchedStudents = unmatchedList;
        result.matchedByClass = matchedByClass;

        const detectedClassList = Object.keys(matchedByClass);
        if (detectedClassList.length > 1) {
          // Multi-class auto mode: set to 'all' so all classes are entered together!
          setSelectedAiClass('all');
          result.autoResolved = true;
        } else if (detectedClassList.length === 1) {
          setSelectedAiClass(detectedClassList[0]);
          result.autoResolved = true;
        } else if (result.className) {
          setSelectedAiClass(normalizeClassId(result.className) || '6');
        }
      } else if (result.className) {
        setSelectedAiClass(normalizeClassId(result.className) || '6');
      }

      setAiResult(result);
      toast({ title: 'তথ্য শনাক্তকরণ সফল' });
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'এআই ত্রুটি', description: err.message });
    } finally {
      setAiProcessing(false);
    }
  };

  const applyAiData = async () => {
    if (!db || !aiResult) return;
    setIsSavingQuickAttendance(true);
    try {
      if (aiTask === 'attendance') {
        const datesToProcess = (applyToAllDates && Array.isArray(aiResult.dates) && aiResult.dates.length > 0) 
          ? aiResult.dates 
          : [selectedAiDate];

        // 1. Fetch holidays in a single bulk query (instead of N sequential network calls)
        const holidayDateSet = new Set<string>();
        try {
          const holidaySnap = await getDocs(collection(db, 'holidays'));
          holidaySnap.docs.forEach(docSnap => {
            const hDate = docSnap.data()?.date;
            if (hDate) holidayDateSet.add(hDate);
          });
        } catch (e) {
          console.warn('Could not fetch bulk holidays:', e);
        }

        const matchedByClass: Record<string, IndividualAttendanceMatch[]> = aiResult.matchedByClass || {};
        const classesToProcess = (selectedAiClass === 'all' || !selectedAiClass)
          ? (Object.keys(matchedByClass).length > 0 ? Object.keys(matchedByClass) : ['6'])
          : [selectedAiClass];

        // 2. Pre-index students by class
        const studentsByClass: Record<string, Student[]> = {};
        studentsForYear.forEach(s => {
          const c = String(s.className);
          if (!studentsByClass[c]) studentsByClass[c] = [];
          studentsByClass[c].push(s);
        });

        // 3. Pre-index matched records by studentId and roll with O(1) map, including daily attendance lookup map
        const classMatchedLookups: Record<string, {
          byId: Map<string, IndividualAttendanceMatch>;
          byRoll: Map<number, IndividualAttendanceMatch>;
          dailyMap: Map<string, Map<string, 'present' | 'absent'>>;
        }> = {};

        for (const cls of classesToProcess) {
          const byId = new Map<string, IndividualAttendanceMatch>();
          const byRoll = new Map<number, IndividualAttendanceMatch>();
          const dailyMap = new Map<string, Map<string, 'present' | 'absent'>>();

          const classMatchedList = matchedByClass[cls] || [];
          classMatchedList.forEach(m => {
            if (m.dbStudent?.id) byId.set(m.dbStudent.id, m);
            if (m.extractedStudent?.roll !== undefined) byRoll.set(Number(m.extractedStudent.roll), m);

            if (Array.isArray(m.extractedStudent.dailyAttendance)) {
              const dMap = new Map<string, 'present' | 'absent'>();
              m.extractedStudent.dailyAttendance.forEach(d => {
                if (d.date && d.status) dMap.set(d.date, d.status);
              });
              if (m.dbStudent?.id) dailyMap.set(`id_${m.dbStudent.id}`, dMap);
              if (m.extractedStudent?.roll !== undefined) dailyMap.set(`roll_${Number(m.extractedStudent.roll)}`, dMap);
            }
          });

          classMatchedLookups[cls] = { byId, byRoll, dailyMap };
        }

        // 4. Pre-index attendanceByDate for rapid lookup
        const attendanceByDateMap = new Map<string, { presentSet: Set<number>; absentSet: Set<number> }>();
        if (Array.isArray(aiResult.attendanceByDate)) {
          aiResult.attendanceByDate.forEach((d: any) => {
            if (d.date) {
              attendanceByDateMap.set(d.date, {
                presentSet: new Set(d.presentRolls || []),
                absentSet: new Set(d.absentRolls || [])
              });
            }
          });
        }
        const rootPresentSet = new Set(Array.isArray(aiResult.presentRolls) ? aiResult.presentRolls.map(Number) : []);

        let totalSavedStudents = 0;
        let holidayFound = false;

        // Batch writer with automatic chunking (Firestore limit is 500 per batch)
        let currentBatch = writeBatch(db);
        let batchOpCount = 0;
        const commitPromises: Promise<void>[] = [];

        for (const dStr of datesToProcess) {
          const isHolidayActive = holidayDateSet.has(dStr);
          const dateObj = new Date(dStr);
          const isWeekend = dateObj.getDay() === 5 || dateObj.getDay() === 6;

          if (isHolidayActive || isWeekend) {
            holidayFound = true;
            continue; 
          }

          const dayDateRes = attendanceByDateMap.get(dStr);

          for (const cls of classesToProcess) {
            const classStudents = studentsByClass[cls] || [];
            if (classStudents.length === 0) continue;

            const lookup = classMatchedLookups[cls];
            totalSavedStudents += (matchedByClass[cls] || []).length;

            const attendanceData: StudentAttendance[] = classStudents.map(student => {
              const matchedRecord = lookup?.byId.get(student.id) || 
                (student.roll !== undefined ? lookup?.byRoll.get(Number(student.roll)) : undefined);

              let status: 'present' | 'absent' = 'absent';

              if (matchedRecord) {
                const sDailyMap = lookup?.dailyMap.get(`id_${student.id}`) || 
                  (student.roll !== undefined ? lookup?.dailyMap.get(`roll_${Number(student.roll)}`) : undefined);

                if (sDailyMap && sDailyMap.has(dStr)) {
                  status = sDailyMap.get(dStr)!;
                } else if (dayDateRes) {
                  if (student.roll !== undefined && dayDateRes.presentSet.has(Number(student.roll))) {
                    status = 'present';
                  } else if (student.roll !== undefined && dayDateRes.absentSet.has(Number(student.roll))) {
                    status = 'absent';
                  } else {
                    status = matchedRecord.extractedStudent.status || 'absent';
                  }
                } else {
                  status = matchedRecord.extractedStudent.status || 'present';
                }
              } else {
                if (dayDateRes && student.roll !== undefined && dayDateRes.presentSet.has(Number(student.roll))) {
                  status = 'present';
                } else if (student.roll !== undefined && rootPresentSet.has(Number(student.roll))) {
                  status = 'present';
                }
              }

              return {
                studentId: student.id,
                status
              };
            });

            const docId = `${dStr}_${cls}_${selectedYear}`;
            const docRef = doc(db, 'attendance', docId);
            currentBatch.set(docRef, {
              date: dStr,
              academicYear: selectedYear,
              className: cls,
              attendance: attendanceData,
              updatedAt: new Date().toISOString()
            }, { merge: true });

            batchOpCount++;
            if (batchOpCount >= 400) {
              commitPromises.push(currentBatch.commit());
              currentBatch = writeBatch(db);
              batchOpCount = 0;
            }
          }
        }

        if (batchOpCount > 0) {
          commitPromises.push(currentBatch.commit());
        }

        if (holidayFound && !applyToAllDates) {
          toast({ variant: 'destructive', title: 'আজ ছুটির দিন!', description: 'ছুটির দিনগুলোতে হাজিরা সেভ করা সম্ভব নয়।'});
          setIsSavingQuickAttendance(false);
          return;
        }

        await Promise.all(commitPromises);
        const classCount = classesToProcess.length;
        toast({ 
          title: classCount > 1 
            ? `${toBengaliNumber(classCount)}টি শ্রেণির হাজিরা সফলভাবে সংরক্ষিত হয়েছে` 
            : 'হাজিরা সফলভাবে সংরক্ষিত হয়েছে', 
          description: holidayFound ? 'ছুটির দিনগুলো স্বয়ংক্রিয়ভাবে বাদ দেওয়া হয়েছে।' : `মোট ${toBengaliNumber(totalSavedStudents)} জন শিক্ষার্থীর হাজিরা আপডেট হয়েছে।` 
        });
        refreshDashboardAttendance(studentsForYear);
      } else {
        toast({ title: 'ধন্যবাদ', description: 'অন্যান্য টাস্কের ডাটা সেভিং ফিচার শীঘ্রই যুক্ত হবে।' });
      }
      setIsAiPortalOpen(false);
      setAiResult(null);
      setAiImage(null);
      setAiRawText('');
    } catch (e: any) {
      console.error(e);
      toast({ variant: 'destructive', title: 'ত্রুটি', description: 'হাজিরা সংরক্ষণে ত্রুটি ঘটেছে।' });
    } finally {
      setIsSavingQuickAttendance(false);
    }
  };

  const presentPercentage = totalStudents > 0 ? ((totalPresent / totalStudents) * 100).toFixed(1) : "০";
  const absentPercentage = totalStudents > 0 ? ((totalAbsent / totalStudents) * 100).toFixed(1) : "০";

  const qQuery = useMemo(() => (db && user?.uid) ? collection(db, 'questions') : null, [db, user?.uid]);
  const pQuery = useMemo(() => (db && user?.uid) ? collection(db, 'pdf-sheets') : null, [db, user?.uid]);
  const lQuery = useMemo(() => (db && user?.uid) ? collection(db, 'lecture-sheets') : null, [db, user?.uid]);

  const { data: allQuestions } = useCollection(qQuery);
  const { data: allPdfSheets } = useCollection(pQuery);
  const { data: allLectureSheets } = useCollection(lQuery);

  const stats = useMemo(() => {
    const classData: Record<string, Record<string, Record<string, any>>> = {};
    CLASSES.forEach(c => { classData[c.id] = {}; });
    
    const aggregate = (cid: string, sub: string, chRaw: string, type: string) => {
      if (!classData[cid]) return;
      
      let targetSub = normalize(sub);

      if (!classData[cid][targetSub]) classData[cid][targetSub] = {};
      const key = getNormalizedKey(chRaw);
      if (!classData[cid][targetSub][key]) {
        classData[cid][targetSub][key] = { creative: 0, lectureSheet: 0, mcq: 0, answerKey: 0, modelTest: 0 };
      }
      classData[cid][targetSub][key][type]++;
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

  useEffect(() => { if (!loading && !user?.uid) router.push('/auth'); }, [user?.uid, loading, router]);

  if (loading || !user?.uid) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-4" />
        <p className="text-muted-foreground font-bold">অ্যাক্সেস চেক করা হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in font-kalpurush">
      <NoticeTicker />

      <div className="flex flex-wrap gap-4 items-center justify-center sm:justify-start">
          <Link href="/add-student">
              <Button className="h-12 px-6 rounded-2xl bg-green-600 hover:bg-green-700 border-b-[6px] border-green-800 shadow-lg font-black gap-2 transition-all active:translate-y-1 text-white">
                  <UserPlus className="h-5 w-5" /> কুইক ভর্তি
              </Button>
          </Link>

          <Dialog open={isQuickPaymentOpen} onOpenChange={setIsQuickPaymentOpen}>
              <DialogTrigger asChild>
                  <Button className="h-12 px-6 rounded-2xl bg-red-600 hover:bg-red-700 border-b-[6px] border-red-800 shadow-lg font-black gap-2 transition-all active:translate-y-1 text-white">
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
                  <Button className="h-12 px-6 rounded-2xl bg-green-600 hover:bg-green-700 border-b-[6px] border-green-800 shadow-lg font-black gap-2 transition-all active:translate-y-1 text-white">
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

          <Dialog open={isQuickUploadOpen} onOpenChange={(o) => { setIsQuickUploadOpen(o); if(!o) setIsConfirmingReplace(false); }}>
              <DialogTrigger asChild>
                  <Button className="h-12 px-6 rounded-2xl bg-orange-600 hover:bg-orange-700 border-b-[6px] border-orange-800 shadow-lg font-black gap-2 transition-all active:translate-y-1 text-white">
                      <FileUp className="h-5 w-5" /> কুইক আপলোড
                  </Button>
              </DialogTrigger>
              <DialogContent className={cn("font-kalpurush sm:max-w-md", isConfirmingReplace && "border-rose-500 ring-4 ring-rose-100")} onKeyDown={handleKeyDownInUpload}>
                  <DialogHeader>
                      <DialogTitle className={cn("text-xl font-black flex items-center gap-2", isConfirmingReplace ? "text-rose-700" : "text-orange-700")}>
                          {isConfirmingReplace ? <AlertCircle /> : <FileUp />}
                          {isConfirmingReplace ? "ফাইল রিপ্লেস নিশ্চিত করুন" : "কুইক আপলোড (PDF/Word)"}
                      </DialogTitle>
                      <DialogDescription className={cn("font-bold", isConfirmingReplace && "text-rose-600")}>
                          {isConfirmingReplace ? "এই নামে একটি ফাইল অলরেডি আছে। রিপ্লেস করতে এন্টার চাপুন।" : "লাইব্রেরিতে সরাসরি PDF বা Word ফাইল আপলোড করুন"}
                      </DialogDescription>
                  </DialogHeader>
                  <form onSubmit={(e) => handleQuickPdfUpload(e)} className="space-y-4 py-4">
                      <div className="space-y-2">
                          <Label className="font-bold">ক্যাটাগরি</Label>
                          <Select value={quickUploadMeta.category} onValueChange={(v) => setQuickUploadMeta({...quickUploadMeta, category: v})}>
                            <SelectTrigger className="h-11 border-2"><SelectValue placeholder="সিলেক্ট ক্যাটাগরি" /></SelectTrigger>
                            <SelectContent className="font-kalpurush">
                                <SelectItem value="lecture_sheet">লেকচার শিট</SelectItem>
                                <SelectItem value="creative">সৃজনশীল প্রশ্ন</SelectItem>
                                <SelectItem value="mcq">বহুনির্বাচনী প্রশ্ন</SelectItem>
                                <SelectItem value="model_test">মডেল টেস্ট</SelectItem>
                                <SelectItem value="answer_key">উত্তরমালা</SelectItem>
                            </SelectContent>
                          </Select>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label className="font-bold">শ্রেণি</Label>
                            <Select value={quickUploadMeta.classId} onValueChange={(v) => {
                                setQuickUploadMeta({...quickUploadMeta, classId: v, subject: '', chapter: ''});
                            }}>
                                <SelectTrigger className="h-11 border-2"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                                <SelectContent>
                                    {Object.entries(classNamesMap).map(([id, label]) => (
                                        <SelectItem key={id} value={id}>{label} শ্রেণি</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold">বিষয়</Label>
                            <Select value={quickUploadMeta.subject} onValueChange={(v) => setQuickUploadMeta({...quickUploadMeta, subject: v, chapter: ''})} disabled={!quickUploadMeta.classId}>
                                <SelectTrigger className="h-11 border-2"><SelectValue placeholder="বিষয়" /></SelectTrigger>
                                <SelectContent>
                                    {getSubjectsForClass(quickUploadMeta.classId || '6').map(s => (
                                        <SelectItem key={s} value={s}>{s}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                      </div>
                      <div className="space-y-2">
                          <Label className="font-bold">অধ্যায় (Chapter)</Label>
                          {quickUploadMeta.classId && quickUploadMeta.subject && getChaptersForSubject(quickUploadMeta.classId, quickUploadMeta.subject).length > 0 ? (
                            <Select value={quickUploadMeta.chapter} onValueChange={(v) => setQuickUploadMeta({...quickUploadMeta, chapter: v})}>
                                <SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="অধ্যায় নির্বাচন করুন" /></SelectTrigger>
                                <SelectContent className="font-kalpurush border-2 border-black">
                                    {getChaptersForSubject(quickUploadMeta.classId, quickUploadMeta.subject).map(ch => (
                                        <SelectItem key={ch} value={ch} className="font-bold">{ch}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                          ) : (
                            <Input 
                                value={quickUploadMeta.chapter} 
                                onChange={e => setQuickUploadMeta({...quickUploadMeta, chapter: e.target.value})} 
                                placeholder="যেমন: ৩য় অধ্যায়" 
                                className="h-11 border-2 font-bold" 
                            />
                          )}
                      </div>
                      <div className="space-y-2">
                          <Label className="font-bold">ফাইল নির্বাচন করুন (PDF/Word)</Label>
                          <div 
                            onClick={() => !isQuickUploading && quickUploadInputRef.current?.click()}
                            className="h-24 border-2 border-dashed border-orange-300 rounded-xl bg-orange-50/30 flex flex-col items-center justify-center cursor-pointer hover:bg-orange-50 transition-all"
                          >
                            {quickUploadFile ? (
                                <p className="text-xs font-black text-orange-800 px-4 text-center truncate w-full">{quickUploadFile.name}</p>
                            ) : (
                                <>
                                    <FileType className="h-6 w-6 text-orange-400 mb-1" />
                                    <span className="text-[10px] font-bold text-orange-700">ক্লিক করে PDF বা Word ফাইল বেছে নিন</span>
                                </>
                            )}
                          </div>
                          <input type="file" ref={quickUploadInputRef} className="hidden" accept=".pdf,.doc,.docx" onChange={e => { setQuickUploadFile(e.target.files?.[0] || null); setIsConfirmingReplace(false); }} />
                      </div>
                      {isQuickUploading && (
                        <div className="space-y-1">
                            <Progress value={uploadProgress} className="h-1.5" />
                            <p className="text-[10px] text-right font-black text-orange-600">{toBengaliNumber(uploadProgress)}%</p>
                        </div>
                      )}
                      <Button type="submit" disabled={isQuickUploading || !quickUploadFile} className={cn("w-full h-12 text-white font-black text-lg shadow-lg", isConfirmingReplace ? "bg-rose-600 hover:bg-rose-700" : "bg-orange-600 hover:bg-orange-700")}>
                        {isQuickUploading ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2" />} 
                        {isConfirmingReplace ? 'হ্যাঁ, রিপ্লেস করুন' : 'সেভ করুন'}
                      </Button>
                  </form>
              </DialogContent>
          </Dialog>

          <Dialog open={isAiPortalOpen} onOpenChange={setIsAiPortalOpen}>
              <DialogTrigger asChild>
                  <Button className="h-12 px-6 rounded-2xl bg-indigo-600 hover:bg-indigo-700 border-b-[6px] border-indigo-800 shadow-lg font-black gap-2 transition-all active:translate-y-1 text-white">
                      <Sparkles className="h-5 w-5" /> এআই অ্যাসিস্ট্যান্ট
                  </Button>
              </DialogTrigger>
              <DialogContent className="font-kalpurush sm:max-w-2xl max-h-[95vh] overflow-y-auto p-0 border-none shadow-2xl rounded-2xl">
                  <DialogHeader className="p-6 bg-indigo-600 text-white rounded-t-2xl">
                      <DialogTitle className="text-2xl font-black flex items-center gap-2">
                          <Sparkles className="h-6 w-6" /> এআই ইন্টেলিজেন্ট পোর্টাল (Smart)
                      </DialogTitle>
                      <DialogDescription className="text-white/80 font-bold">ছবি, PDF বা টেক্সট থেকে স্বয়ংক্রিয়ভাবে তথ্য ইনপুট করুন</DialogDescription>
                  </DialogHeader>
                  <div className="p-8 space-y-6">
                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                        <div className="space-y-2">
                          <Label className="font-black text-slate-700">কি কাজ করতে চান?</Label>
                          <Select value={aiTask} onValueChange={(v: any) => setAiTask(v)}>
                            <SelectTrigger className="h-12 border-2"><SelectValue /></SelectTrigger>
                            <SelectContent className="font-kalpurush">
                                <SelectItem value="attendance">হাজিরা গ্রহণ (Roll P/A)</SelectItem>
                                <SelectItem value="results">ফলাফল ইনপুট (Marks)</SelectItem>
                                <SelectItem value="admission">নতুন ভর্তি (Admission Form)</SelectItem>
                                <SelectItem value="fees">বেতন আদায় (Payment Slip)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-2">
                          <Label className="font-black text-slate-700">ফাইল আপলোড (JPG, PNG, PDF)</Label>
                          <Button 
                            variant="outline" 
                            className="w-full h-12 border-2 border-dashed border-indigo-300 bg-indigo-50 hover:bg-indigo-100 font-bold gap-2"
                            onClick={() => aiFileInputRef.current?.click()}
                          >
                            <FileType className="h-5 w-5" /> {aiImage ? 'ফাইল পরিবর্তন করুন' : 'ফাইল নির্বাচন করুন'}
                          </Button>
                          <input type="file" ref={aiFileInputRef} className="hidden" accept="image/*,.pdf" capture="environment" onChange={handleAiFileChange} />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <Label className="font-black text-slate-700">টেক্সট নির্দেশনা বা ডাটা (ঐচ্ছিক)</Label>
                        <Textarea 
                            placeholder="যেমন: ক্লাস ৯ এর রোল ১, ২, ৫ উপস্থিত... অথবা আজকের তারিখ ১২-০৩-২০২৬" 
                            value={aiRawText}
                            onChange={e => setAiRawText(e.target.value)}
                            className="h-24 border-2 font-bold focus:ring-indigo-500"
                        />
                      </div>

                      {aiImage && (
                          <div className="relative aspect-video rounded-xl overflow-hidden border-2 border-slate-200 shadow-inner group">
                              {aiImage.startsWith('data:application/pdf') ? (
                                  <div className="w-full h-full flex flex-col items-center justify-center bg-slate-100 text-rose-600">
                                      <FileType className="h-16 w-16 mb-2" />
                                      <p className="font-black">পিডিএফ ফাইল লোড হয়েছে</p>
                                  </div>
                              ) : (
                                  <img src={aiImage} className="w-full h-full object-cover" alt="Preview" />
                              )}
                              <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <p className="text-white font-black text-sm">সিলেক্টেড ফাইল</p>
                              </div>
                              <button className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white" onClick={() => setAiImage(null)}><XCircle className="h-6 w-6 text-rose-500" /></button>
                          </div>
                      )}

                      {aiProcessing ? (
                          <div className="py-12 flex flex-col items-center justify-center gap-4 bg-slate-50 rounded-2xl border-2 border-dashed">
                              <Loader2 className="h-10 w-10 animate-spin text-indigo-600" />
                              <p className="font-black text-indigo-700 animate-pulse text-lg">এআই প্রসেসিং হচ্ছে, অনুগ্রহ করে অপেক্ষা করুন...</p>
                          </div>
                      ) : aiResult ? (
                          <Card className="border-2 border-emerald-200 bg-emerald-50/30 rounded-2xl animate-in zoom-in-95 duration-500">
                              <CardHeader className="pb-2 border-b border-emerald-100">
                                  <CardTitle className="text-sm font-black text-emerald-800 flex items-center gap-2"><CheckCircle2 className="h-4 w-4" /> এআই শনাক্তকৃত তথ্য</CardTitle>
                              </CardHeader>
                              <CardContent className="pt-4 overflow-x-auto space-y-4">
                                  {aiResult.description && (
                                      <div className="p-3 bg-white rounded-xl border border-emerald-200">
                                          <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-1">এআই পর্যবেক্ষণ</p>
                                          <p className="text-sm font-bold text-slate-800">{aiResult.description}</p>
                                      </div>
                                  )}

                                  {aiResult.actionPlan && (
                                      <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200">
                                          <p className="text-[10px] font-black text-indigo-800 uppercase tracking-wider mb-1">অ্যাকশন প্ল্যান (কোথায় কীভাবে কার কাছে যুক্ত হবে)</p>
                                          <p className="text-sm font-bold text-indigo-950">{aiResult.actionPlan}</p>
                                      </div>
                                  )}

                                  <div className="p-3.5 bg-white rounded-xl border-2 border-emerald-200/80 shadow-sm space-y-3">
                                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
                                          <div className="space-y-1">
                                              <div className="flex items-center gap-2">
                                                  <Label className="text-xs font-black text-slate-800">শ্রেণি</Label>
                                                  {aiResult.autoResolved && (
                                                      <Badge className="bg-emerald-600 text-[10px] py-0 px-1.5 font-bold">নাম ও রোল দিয়ে শনাক্ত</Badge>
                                                  )}
                                              </div>
                                               <Select value={selectedAiClass} onValueChange={setSelectedAiClass}>
                                                   <SelectTrigger className="h-10 font-black border-2 border-slate-200">
                                                       <SelectValue />
                                                   </SelectTrigger>
                                                   <SelectContent>
                                                       {aiResult.matchedByClass && Object.keys(aiResult.matchedByClass).length > 1 && (
                                                           <SelectItem value="all" className="font-black text-indigo-700 bg-indigo-50">
                                                               ★ সকল শ্রেণি একসাথে ({toBengaliNumber(Object.keys(aiResult.matchedByClass).length)}টি শ্রেণি)
                                                           </SelectItem>
                                                       )}
                                                       {Object.entries(classNamesMap).map(([k, v]) => (
                                                           <SelectItem key={k} value={k} className="font-bold">{v} শ্রেণি</SelectItem>
                                                       ))}
                                                   </SelectContent>
                                               </Select>
                                          </div>

                                          <div className="space-y-1">
                                              <div className="flex items-center gap-2">
                                                  <Label className="text-xs font-black text-slate-800">তারিখ</Label>
                                                  {aiResult.monthName && (
                                                      <Badge variant="outline" className="border-indigo-400 text-indigo-700 text-[10px] py-0 px-1.5 font-bold">মাস: {aiResult.monthName}</Badge>
                                                  )}
                                              </div>
                                              <Input 
                                                  type="date" 
                                                  value={selectedAiDate} 
                                                  onChange={e => { setSelectedAiDate(e.target.value); setApplyToAllDates(false); }}
                                                  className="h-10 font-black border-2 border-slate-200"
                                              />
                                          </div>
                                      </div>

                                      {/* Date results display */}
                                      {Array.isArray(aiResult.dates) && aiResult.dates.length > 0 && (() => {
                                          const byMonth: Record<string, string[]> = {};
                                          aiResult.dates.forEach((dStr: string) => {
                                              const parts = dStr.split('-');
                                              const ym = parts.slice(0, 2).join('-'); 
                                              if (!byMonth[ym]) byMonth[ym] = [];
                                              byMonth[ym].push(dStr);
                                          });
                                          const BENGALI_MONTH_NAMES = ['জানুয়ারি','ফেব্রুয়ারি','মার্চ','এপ্রিল','মে','জুন','জুলাই','আগস্ট','সেপ্টেম্বর','অক্টোবর','নভেম্বর','ডিসেম্বর'];
                                          return (
                                              <div className="pt-2 border-t border-slate-100 space-y-3">
                                                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                                                      <p className="text-[11px] font-black text-slate-700">শনাক্তকৃত তারিখ ({toBengaliNumber(aiResult.dates.length)}টি — {toBengaliNumber(Object.keys(byMonth).length)}টি মাস):</p>
                                                      <label className="flex items-center gap-2 text-xs font-black text-indigo-700 cursor-pointer bg-indigo-50 px-2 py-1 rounded-md">
                                                          <input 
                                                              type="checkbox" 
                                                              checked={applyToAllDates} 
                                                              onChange={e => setApplyToAllDates(e.target.checked)}
                                                              className="rounded text-indigo-600 h-4 w-4"
                                                          />
                                                          সকল তারিখে একসাথে সংরক্ষণ করুন
                                                      </label>
                                                  </div>
                                                  {Object.entries(byMonth).map(([ym, dates]) => {
                                                      const [y, m] = ym.split('-');
                                                      const mName = BENGALI_MONTH_NAMES[parseInt(m, 10) - 1] || m;
                                                      return (
                                                          <div key={ym}>
                                                              <p className="text-[10px] font-black text-indigo-700 mb-1.5">{mName} {toBengaliNumber(y)}</p>
                                                              <div className="flex flex-wrap gap-1.5">
                                                                  {dates.map((dStr: string) => {
                                                                      const bdEntry = Array.isArray(aiResult.attendanceByDate)
                                                                          ? aiResult.attendanceByDate.find((d: any) => d.date === dStr)
                                                                          : null;
                                                                      const pCount = bdEntry?.presentRolls?.length ?? null;
                                                                      return (
                                                                          <button
                                                                              key={dStr}
                                                                              type="button"
                                                                              onClick={() => { setSelectedAiDate(dStr); setApplyToAllDates(false); }}
                                                                              className={cn(
                                                                                  "px-2.5 py-1 text-xs font-black rounded-lg border transition-all",
                                                                                  (selectedAiDate === dStr && !applyToAllDates)
                                                                                      ? "bg-indigo-600 text-white border-indigo-700 shadow-sm"
                                                                                      : "bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100"
                                                                              )}
                                                                          >
                                                                              {toBengaliNumber(dStr.split('-')[2])} তারিখ
                                                                              {pCount !== null && <span className="ml-1 opacity-70">({toBengaliNumber(pCount)}জন)</span>}
                                                                          </button>
                                                                      );
                                                                  })}
                                                              </div>
                                                          </div>
                                                      );
                                                  })}
                                              </div>
                                          );
                                      })()}
                                  </div>

                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                                       <div className="p-2.5 bg-white rounded-xl border">
                                           <p className="text-[10px] font-black text-muted-foreground uppercase">নির্বাচিত শ্রেণি</p>
                                           <p className="font-black text-primary text-base">
                                               {selectedAiClass === 'all' 
                                                   ? `সকল শ্রেণি (${toBengaliNumber(Object.keys(aiResult.matchedByClass || {}).length)}টি)` 
                                                   : `${classNamesMap[selectedAiClass] || selectedAiClass} শ্রেণি`}
                                           </p>
                                       </div>
                                      <div className="p-2.5 bg-white rounded-xl border">
                                          <p className="text-[10px] font-black text-muted-foreground uppercase">তারিখ</p>
                                          <p className="font-black text-primary text-base">
                                              {applyToAllDates && aiResult.dates?.length > 1 
                                                  ? `সকল (${toBengaliNumber(aiResult.dates.length)})টি` 
                                                  : toBengaliNumber(selectedAiDate)}
                                          </p>
                                      </div>
                                      {(aiResult.totalPresent !== undefined || aiResult.presentRolls?.length) && (
                                          <div className="p-2.5 bg-white rounded-xl border">
                                              <p className="text-[10px] font-black text-emerald-700 uppercase">মোট উপস্থিত</p>
                                              <p className="font-black text-emerald-700 text-base">{toBengaliNumber(aiResult.totalPresent ?? aiResult.presentRolls?.length)} জন</p>
                                          </div>
                                      )}
                                      {(aiResult.totalAbsent !== undefined || aiResult.absentRolls?.length) && (
                                          <div className="p-2.5 bg-white rounded-xl border">
                                              <p className="text-[10px] font-black text-rose-700 uppercase">মোট অনুপস্থিত</p>
                                              <p className="font-black text-rose-700 text-base">{toBengaliNumber(aiResult.totalAbsent ?? aiResult.absentRolls?.length)} জন</p>
                                          </div>
                                      )}
                                  </div>

                                   {aiResult.matchedByClass && Object.keys(aiResult.matchedByClass).length > 0 && (
                                       <div className="p-3.5 bg-indigo-50/70 border-2 border-indigo-200 rounded-xl space-y-2">
                                           <div className="flex items-center justify-between">
                                               <p className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                                                   <CheckCircle2 className="w-4 h-4 text-indigo-600" /> 
                                                   শনাক্তকৃত শ্রেণিসমূহ ({toBengaliNumber(Object.keys(aiResult.matchedByClass).length)}টি শ্রেণি, মোট {toBengaliNumber(aiResult.matchedList?.length || 0)} জন):
                                               </p>
                                           </div>
                                           <div className="flex flex-wrap gap-2">
                                               {Object.entries(aiResult.matchedByClass).map(([cls, list]: [string, any]) => (
                                                   <Badge key={cls} variant="secondary" className="bg-white border-2 border-indigo-200 text-indigo-950 font-black text-xs py-1 px-3 shadow-xs">
                                                       {classNamesMap[cls] || cls} শ্রেণি: {toBengaliNumber(list.length)} জন শিক্ষার্থী
                                                   </Badge>
                                               ))}
                                           </div>
                                       </div>
                                   )}

                                   {Array.isArray(aiResult.presentRolls) && aiResult.presentRolls.length > 0 && (
                                       <div className="p-3 bg-white rounded-xl border">
                                           <p className="text-[10px] font-black text-emerald-800 uppercase tracking-wider mb-1.5">উপস্থিত রোলসমূহ ({toBengaliNumber(aiResult.presentRolls.length)} জন)</p>
                                           <div className="flex flex-wrap gap-1.5">
                                               {aiResult.presentRolls.map((r: any) => (
                                                   <span key={r} className="px-2 py-0.5 bg-emerald-100 text-emerald-800 font-black text-xs rounded-md">
                                                       {toBengaliNumber(r)}
                                                   </span>
                                               ))}
                                           </div>
                                       </div>
                                   )}

                                   {Array.isArray(aiResult.unmatchedStudents) && aiResult.unmatchedStudents.length > 0 && (
                                       <div className="p-3.5 bg-rose-50 border-2 border-rose-300 rounded-xl space-y-2">
                                           <p className="text-xs font-black text-rose-800 flex items-center gap-1.5">
                                               <AlertCircle className="w-4 h-4 text-rose-600" />
                                               শ্রেণি মিল পাওয়া যায়নি এমন শিক্ষার্থী ({toBengaliNumber(aiResult.unmatchedStudents.length)} জন):
                                           </p>
                                           <div className="flex flex-wrap gap-1.5">
                                               {aiResult.unmatchedStudents.map((item: any, idx: number) => {
                                                   const st = item.extractedStudent || item;
                                                   return (
                                                       <span key={idx} className="px-2 py-0.5 bg-white text-rose-700 border border-rose-200 font-bold text-xs rounded-md shadow-xs">
                                                           রোল {toBengaliNumber(st.roll)}{st.name ? ` (${st.name})` : ''}
                                                       </span>
                                                   );
                                               })}
                                           </div>
                                           <p className="text-[11px] font-bold text-rose-600">
                                               এই শিক্ষার্থীদের রোল ও নাম ডাটাবেজের কোনো শ্রেণির সাথে মেলেনি, তাই এদের কোনো ভুল শ্রেণিতে এন্ট্রি দেওয়া হয়নি।
                                           </p>
                                       </div>
                                   )}
                                  <div className="mt-4 flex justify-end">
                                       <Button onClick={applyAiData} disabled={isSavingQuickAttendance} className="bg-emerald-600 hover:bg-emerald-700 font-black px-8 h-12 shadow-lg gap-2 text-base">
                                           {isSavingQuickAttendance ? <Loader2 className="animate-spin h-5 w-5" /> : <ArrowRight className="h-5 w-5" />}
                                           {selectedAiClass === 'all'
                                               ? (applyToAllDates && Array.isArray(aiResult.dates) && aiResult.dates.length > 1
                                                   ? `সকল (${toBengaliNumber(Object.keys(aiResult.matchedByClass || {}).length)})টি শ্রেণির (${toBengaliNumber(aiResult.dates.length)})টি তারিখের তথ্য প্রয়োগ করুন`
                                                   : `সকল (${toBengaliNumber(Object.keys(aiResult.matchedByClass || {}).length)})টি শ্রেণির ${toBengaliNumber(aiResult.matchedList?.length || 0)} জন শিক্ষার্থীর তথ্য প্রয়োগ করুন`)
                                               : (applyToAllDates && Array.isArray(aiResult.dates) && aiResult.dates.length > 1 
                                                   ? `সকল (${toBengaliNumber(aiResult.dates.length)})টি তারিখে প্রয়োগ করুন`
                                                   : `${toBengaliNumber(selectedAiDate)} তারিখের তথ্য সিস্টেমে প্রয়োগ করুন`)}
                                       </Button>
                                  </div>
                              </CardContent>
                          </Card>
                      ) : null}

                      {!aiResult && !aiProcessing && (
                          <Button 
                            onClick={handleAiAction} 
                            disabled={!aiImage && !aiRawText.trim()}
                            className="w-full h-14 text-xl font-black bg-indigo-600 hover:bg-indigo-700 shadow-xl gap-2"
                          >
                            <BrainCircuit className="h-6 w-6" /> তথ্য শনাক্ত করুন
                          </Button>
                      )}
                  </div>
                  <DialogFooter className="p-4 bg-slate-50 border-t">
                      <DialogClose asChild><Button variant="ghost" className="font-bold">বন্ধ করুন</Button></DialogClose>
                  </DialogFooter>
              </DialogContent>
          </Dialog>
      </div>

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
              <Users className="h-4 w-4 text-teal-700" />
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

      <DashboardAnalyticsCharts 
        students={studentsForYear} 
        academicYear={selectedYear} 
      />

      <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-6 lg:grid-cols-9 gap-1.5 md:gap-2">
        <Link href="/create-question" className="block w-full">
          <div className="bg-[#dc2626] hover:bg-[#b91c1c] border-b-[6px] border-[#7f1d1d] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <BrainCircuit className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">প্রশ্ন ব্যাংক</span>
          </div>
        </Link>

        <Link href="/notices-management" className="block w-full">
          <div className="bg-[#2563eb] hover:bg-[#1d4ed8] border-b-[6px] border-[#1e3a8a] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <Bell className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">নোটিশ বোর্ড</span>
          </div>
        </Link>

        <Link href="/create-lecture-sheet" className="block w-full">
          <div className="bg-[#059669] hover:bg-[#046c4e] border-b-[6px] border-[#03543f] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <BookOpen className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">লেকচার শিট</span>
          </div>
        </Link>

        <Link href="/diary" className="block w-full">
          <div className="bg-[#4f46e5] hover:bg-[#4338ca] border-b-[6px] border-[#312e81] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <NotebookPen className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">টিচার্স ডায়েরি</span>
          </div>
        </Link>

        <Link href="/student-profile" className="block w-full">
          <div className="bg-[#1e293b] hover:bg-[#0f172a] border-b-[6px] border-black text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <Search className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">শিক্ষার্থী প্রোফাইল</span>
          </div>
        </Link>

        <Link href="/add-student" className="block w-full">
          <div className="bg-[#0d9488] hover:bg-[#0f766e] border-b-[6px] border-[#115e59] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <UserPlus className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">নতুন শিক্ষার্থী ভর্তি</span>
          </div>
        </Link>

        <Link href="/student-list" className="block w-full">
          <div className="bg-[#16a34a] hover:bg-[#15803d] border-b-[6px] border-[#14532d] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <Users className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">শিক্ষার্থী তালিকা</span>
          </div>
        </Link>

        <Link href="/attendance" className="block w-full">
          <div className="bg-[#0284c7] hover:bg-[#0369a1] border-b-[6px] border-[#075985] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <CalendarCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">হাজিরা শাখা</span>
          </div>
        </Link>

        <Link href="/results" className="block w-full">
          <div className="bg-[#7c3aed] hover:bg-[#6d28d9] border-b-[6px] border-[#4c1d95] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <Award className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">ফলাফল শাখা</span>
          </div>
        </Link>

        <Link href="/accounts" className="block w-full">
          <div className="bg-[#057a55] hover:bg-[#046c4e] border-b-[6px] border-[#03543f] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <Banknote className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">হিসাব শাখা</span>
          </div>
        </Link>

        <Link href="/messaging" className="block w-full">
          <div className="bg-[#3b82f6] hover:bg-[#2563eb] border-b-[6px] border-[#1e3a8a] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <MessageSquare className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">মেসেজ শাখা</span>
          </div>
        </Link>

        <Link href="/staff" className="block w-full">
          <div className="bg-[#9333ea] hover:bg-[#7e22ce] border-b-[6px] border-[#581c87] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <UserCog className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">স্টাফ পোর্টাল</span>
          </div>
        </Link>

        <Link href="/documents" className="block w-full">
          <div className="bg-[#d97706] hover:bg-[#b45309] border-b-[6px] border-[#78350f] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <FolderOpen className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">ডকুমেন্ট পোর্টাল</span>
          </div>
        </Link>

        <Link href="/routines" className="block w-full">
          <div className="bg-[#6366f1] hover:bg-[#4f46e5] border-b-[6px] border-[#312e81] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <Clock className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">রুটিন শাখা</span>
          </div>
        </Link>

        <Link href="/public-exam-records" className="block w-full">
          <div className="bg-[#0891b2] hover:bg-[#0e7490] border-b-[6px] border-[#155e75] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <Award className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">রেকর্ড শাখা</span>
          </div>
        </Link>

        <Link href="/results" className="block w-full">
          <div className="bg-[#ea580c] hover:bg-[#c2410c] border-b-[6px] border-[#9a3412] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <FileUp className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">কুইক আপলোড</span>
          </div>
        </Link>

        <Link href="/my-questions" className="block w-full">
          <div className="bg-[#be123c] hover:bg-[#9f1239] border-b-[6px] border-[#701a28] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <Library className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">আমার লাইব্রেরি</span>
          </div>
        </Link>

        <Link href="/admissions-management" className="block w-full">
          <div className="bg-[#3730a3] hover:bg-[#312e81] border-b-[6px] border-[#1e1b4b] text-white h-10 md:h-11 px-1 sm:px-1.5 md:px-2 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-1 sm:gap-1.5 group active:translate-y-1 w-full">
            <UserCheck className="w-3.5 h-3.5 md:w-4 md:h-4 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
            <span className="font-black text-[9.5px] sm:text-[10px] md:text-[10.5px] xl:text-[11px] leading-normal text-center whitespace-nowrap drop-shadow-sm">ভর্তি আবেদন</span>
          </div>
        </Link>
      </section>

      <section id="board-books">
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
                  "border-b-[6px]",
                  col.border,
                  "text-white h-10 md:h-11 px-2 md:px-3 rounded-xl shadow-md hover:shadow-lg transition-all duration-200 flex items-center justify-center gap-2 group active:translate-y-1 w-full cursor-pointer"
                )}>
                  <BookOpen className="w-4 h-4 md:w-4.5 md:h-4.5 text-white shrink-0 group-hover:scale-110 transition-transform drop-shadow-md" />
                  <span className="font-black text-xs md:sm:text-sm leading-normal text-center whitespace-nowrap drop-shadow-sm">
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
            <div className="w-8 h-8 rounded-lg bg-red-600 text-white flex items-center justify-center shadow-lg border border-white/20">
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
            const allSubjects = getSubjectsForClass(cls.id).flatMap(s => {
              if (s === 'ধর্ম ও নৈতিক শিক্ষা') {
                return ['ইসলাম ধর্ম ও নৈতিক শিক্ষা', 'হিন্দু ধর্ম ও নৈতিক শিক্ষা'];
              }
              return s;
            });
            const selectedSubjectRaw = selectedSubjects[cls.id] || allSubjects[0];
            
            let selectedSubjectNormalized = normalize(selectedSubjectRaw);

            const classChaptersStats = stats.classData[cls.id]?.[selectedSubjectNormalized] || {};
            const predefined = getChaptersForSubject(cls.id, selectedSubjectRaw);
            
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
              <div key={cls.id} className="rounded-xl overflow-hidden bg-white/40 p-1">
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
                                value={selectedSubjectRaw} 
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
                              <td key={ch.key} className="min-w-[55px] max-w-[55px] border-r-2 border-black bg-yellow-100 p-1 text-center font-black text-[10px] align-middle text-black whitespace-normal break-words">
                                <div className="leading-tight">{formatChapterDisplay(ch.display)}</div>
                                <div className="text-[8px] font-bold opacity-70 mt-0.5 leading-tight">
                                  {ch.display.includes(':') ? ch.display.split(':')[1].trim() : ''}
                                </div>
                              </td>
                            ))}
                          </tr>

                          <tr className="border-b border-black bg-blue-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-blue-900">লেকচার শিট</td>
                            {chunk.map(ch => {
                              const count = classChaptersStats[ch.key]?.lectureSheet || 0;
                              return (
                                <td key={ch.key} className={cn("border-r-2 border-black p-1 text-center font-black text-[12px]", count > 0 ? "text-blue-600" : "text-red-600")}>
                                  <Link 
                                    href={`/my-questions?classId=${cls.id}&subject=${encodeURIComponent(selectedSubjectRaw)}&chapter=${encodeURIComponent(ch.display)}&category=sheet`}
                                    className="hover:underline transition-all"
                                  >
                                    {toBengaliNumber(count)}
                                  </Link>
                                </td>
                              );
                            })}
                          </tr>

                          <tr className="border-b border-black bg-orange-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-orange-900">সৃজনশীল</td>
                            {chunk.map(ch => {
                              const count = classChaptersStats[ch.key]?.creative || 0;
                              return (
                                <td key={ch.key} className={cn("border-r-2 border-black p-1 text-center font-black text-[12px]", count > 0 ? "text-blue-600" : "text-red-600")}>
                                  <Link 
                                    href={`/my-questions?classId=${cls.id}&subject=${encodeURIComponent(selectedSubjectRaw)}&chapter=${encodeURIComponent(ch.display)}&category=creative`}
                                    className="hover:underline transition-all"
                                  >
                                    {toBengaliNumber(count)}
                                  </Link>
                                </td>
                              );
                            })}
                          </tr>

                          <tr className="border-b border-black bg-indigo-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-indigo-900">বহুনির্বাচনী</td>
                            {chunk.map(ch => {
                              const count = classChaptersStats[ch.key]?.mcq || 0;
                              return (
                                <td key={ch.key} className={cn("border-r-2 border-black p-1 text-center font-black text-[12px]", count > 0 ? "text-blue-600" : "text-red-600")}>
                                  <Link 
                                    href={`/my-questions?classId=${cls.id}&subject=${encodeURIComponent(selectedSubjectRaw)}&chapter=${encodeURIComponent(ch.display)}&category=mcq`}
                                    className="hover:underline transition-all"
                                  >
                                    {toBengaliNumber(count)}
                                  </Link>
                                </td>
                              );
                            })}
                          </tr>

                          <tr className="border-b border-black bg-green-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-green-900">উত্তরমালা</td>
                            {chunk.map(ch => {
                              const count = classChaptersStats[ch.key]?.answerKey || 0;
                              return (
                                <td key={ch.key} className={cn("border-r-2 border-black p-1 text-center font-black text-[12px]", count > 0 ? "text-blue-600" : "text-red-600")}>
                                  <Link 
                                    href={`/my-questions?classId=${cls.id}&subject=${encodeURIComponent(selectedSubjectRaw)}&chapter=${encodeURIComponent(ch.display)}&category=answer`}
                                    className="hover:underline transition-all"
                                  >
                                    {toBengaliNumber(count)}
                                  </Link>
                                </td>
                              );
                            })}
                          </tr>

                          <tr className="bg-rose-50">
                            <td className="border-r-2 border-black p-1 text-center font-black text-[10px] text-rose-900">মডেল টেস্ট</td>
                            {chunk.map(ch => {
                              const count = classChaptersStats[ch.key]?.modelTest || 0;
                              return (
                                <td key={ch.key} className={cn("border-r-2 border-black p-1 text-center font-black text-[12px]", count > 0 ? "text-blue-600" : "text-red-600")}>
                                  <Link 
                                    href={`/my-questions?classId=${cls.id}&subject=${encodeURIComponent(selectedSubjectRaw)}&chapter=${encodeURIComponent(ch.display)}&category=model`}
                                    className="hover:underline transition-all"
                                  >
                                    {toBengaliNumber(count)}
                                  </Link>
                                </td>
                              );
                            })}
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

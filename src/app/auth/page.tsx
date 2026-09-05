"use client";

import { useState, useMemo, useEffect } from 'react';
import { useAuth, useFirestore, useDoc } from '@/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  signOut
} from 'firebase/auth';
import { 
  doc, 
  getDoc, 
  setDoc, 
  serverTimestamp, 
  collection, 
  query, 
  orderBy, 
  limit, 
  onSnapshot,
  where,
  getDocs
} from 'firebase/firestore';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogDescription,
  DialogFooter,
  DialogTrigger 
} from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { toast } from '@/hooks/use-toast';
import { 
  Loader2, 
  LogIn, 
  UserPlus, 
  Search, 
  Users, 
  GraduationCap, 
  Calendar, 
  Trophy, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  ShieldCheck, 
  BarChart3,
  Megaphone,
  Globe,
  BookOpen,
  Printer,
  Info,
  Sparkles,
  ArrowLeft,
  XCircle,
  Award,
  FileBadge
} from 'lucide-react';
import Image from 'next/image';
import { cn } from '@/lib/utils';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { availablePermissions, defaultPermissions } from '@/lib/permissions';
import { studentFromDoc, getStudentPlaceholderImage, sanitizePhotoUrl } from '@/lib/student-data';
import { getExams, Exam } from '@/lib/exam-data';
import { getAllResults } from '@/lib/results-data';
import { getSubjects, Subject as SubjectType } from '@/lib/subjects';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import { GalleryConfig, defaultGalleryConfig } from '@/lib/gallery-data';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';

const toBengaliNumber = (str: string | number | undefined | null) => {
  if (!str && str !== 0) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const classNamesMap: Record<string, string> = {
  '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

const groupMapEn: Record<string, string> = {
  'science': 'Science', 'arts': 'Humanities', 'commerce': 'Business Studies', 'general': 'General'
};

const BackgroundGallery = () => {
  const db = useFirestore();
  const [config, setConfig] = useState<GalleryConfig>(defaultGalleryConfig);
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    if (!db) return;
    const unsub = onSnapshot(doc(db, 'school', 'gallery'), (snap) => {
      if (snap.exists()) {
        setConfig(snap.data() as GalleryConfig);
      }
      setIsLoading(false);
    }, async (error: any) => {
      if (error?.code === 'permission-denied') {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'school/gallery',
          operation: 'get',
        }));
      }
    });
    return () => unsub();
  }, [db]);

  const activeImages = useMemo(() => config?.images?.filter(img => img.isActive) || [], [config?.images]);

  useEffect(() => {
    if (activeImages.length <= 1) return;
    const interval = setInterval(() => {
      setCurrentIdx(prev => (prev + 1) % activeImages.length);
    }, (config?.duration || 5) * 1000);
    return () => clearInterval(interval);
  }, [activeImages, config?.duration]);

  if (isLoading) return <div className="absolute inset-0 bg-slate-900" />;

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden z-0 bg-slate-950">
      {activeImages.length > 0 ? (
        activeImages.map((img, idx) => (
          <div 
            key={img.id || idx}
            className={cn(
              "absolute inset-0 transition-opacity duration-1000 ease-in-out",
              idx === currentIdx ? "opacity-100" : "opacity-0"
            )}
            style={{ transitionProperty: 'opacity', transitionDuration: '2s' }}
          >
            <Image 
              src={img.url} 
              alt={img.title || 'School Gallery'} 
              fill 
              unoptimized
              priority={idx === 0}
              className="object-cover object-center brightness-[1.10] contrast-[1.05]"
            />
            <div className="absolute inset-0 bg-black/40" />
          </div>
        ))
      ) : (
        <div className="absolute inset-0 bg-slate-900" />
      )}
    </div>
  );
};

export default function AuthPage() {
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();
  const { schoolInfo } = useSchoolInfo();

  // Login dialog states
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [activeAuthTab, setActiveAuthTab] = useState<'teacher' | 'admin' | 'signup'>('teacher');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);

  // Result search states
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [searchYear, setSearchYear] = useState(new Date().getFullYear().toString());
  const [searchClass, setSearchClass] = useState('6');
  const [searchExam, setSearchExam] = useState('');
  const [searchExams, setSearchExams] = useState<Exam[]>([]);
  const [searchRoll, setSearchRoll] = useState('');
  const [searchStudentId, setSearchStudentId] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResult, setSearchResult] = useState<StudentProcessedResult | null>(null);
  const [searchSubjects, setSearchSubjects] = useState<SubjectType[]>([]);

  const appName = schoolInfo?.name || '';
  const appLogoUrl = schoolInfo?.logoUrl || '';

  const [scrollingNotices, setScrollingNotices] = useState<any[]>([]);

  // Dynamic Stats States
  const [stats, setStats] = useState({ 
    students: 0, 
    teachers: 0,
    attendanceRate: 0,
    passRate: 0,
    sscYear: new Date().getFullYear().toString()
  });

  useEffect(() => {
    if (!db) return;
    const fetchStats = async () => {
      try {
        const currentYear = new Date().getFullYear().toString();
        const todayStr = format(new Date(), 'yyyy-MM-dd');
        
        const sPromise = getDocs(query(collection(db, 'students'), where('academicYear', '==', currentYear)));
        const tPromise = getDocs(query(collection(db, 'staff'), where('isActive', '==', true), where('staffType', '==', 'teacher')));
        const attPromise = getDocs(query(collection(db, 'attendance'), where('academicYear', '==', currentYear), where('date', '==', todayStr)));
        const sscRecordsPromise = getDocs(query(collection(db, 'publicExamRecords'), where('examType', '==', 'SSC')));

        const [sSnap, tSnap, attSnap, allSscSnap] = await Promise.all([
          sPromise.catch(() => ({ size: 0, docs: [] })),
          tPromise.catch(() => ({ size: 0, docs: [] })),
          attPromise.catch(() => ({ size: 0, docs: [] })),
          sscRecordsPromise.catch(() => ({ size: 0, docs: [] }))
        ]);

        const totalStudentsCount = (sSnap as any).size;
        const activeTeachersCount = (tSnap as any).size;

        let presentCount = 0;
        (attSnap as any).docs.forEach((doc: any) => {
          const data = doc.data();
          if (data.attendance) {
            presentCount += data.attendance.filter((a: any) => a.status === 'present').length;
          }
        });

        let sscYear = currentYear;
        let sscDocs = (allSscSnap as any).docs.filter((d: any) => d.data().academicYear === currentYear);
        
        if (sscDocs.length === 0 && (allSscSnap as any).docs.length > 0) {
          const yearsWithRecords = Array.from(new Set((allSscSnap as any).docs.map((d: any) => d.data().academicYear).filter(Boolean))).sort().reverse();
          if (yearsWithRecords.length > 0) {
            sscYear = yearsWithRecords[0] as string;
            sscDocs = (allSscSnap as any).docs.filter((d: any) => d.data().academicYear === sscYear);
          }
        }

        let passRatePercent = 0;
        if (sscDocs.length > 0) {
          const passedCount = sscDocs.filter((doc: any) => {
            const data = doc.data();
            const grade = (data.grade || '').toString().trim().toUpperCase();
            const gpa = Number(data.gpa) || 0;
            return grade !== '' && grade !== 'F' && gpa > 0;
          }).length;
          passRatePercent = (passedCount / sscDocs.length) * 100;
        } else if ((schoolInfo as any)?.passingRate) {
          passRatePercent = parseFloat((schoolInfo as any).passingRate) || 0;
        }

        setStats({ 
          students: totalStudentsCount, 
          teachers: activeTeachersCount,
          attendanceRate: totalStudentsCount > 0 ? (presentCount / totalStudentsCount) * 100 : 0,
          passRate: passRatePercent,
          sscYear: sscYear
        });
      } catch (e) {
        console.warn('Stats fetch error:', e);
      }
    };
    fetchStats();
  }, [db, schoolInfo]);

  useEffect(() => {
    if (!db) return;
    try {
      const q = query(collection(db, 'notices'), orderBy('date', 'desc'), limit(15));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const scrolling = snapshot.docs
          .map(doc => ({ id: doc.id, ...doc.data() } as any))
          .filter(n => !!n.isScrolling);
        setScrollingNotices(scrolling);
      }, (err) => {
        console.warn('Notice fetch skipped for guest:', err);
      });
      return () => unsubscribe();
    } catch (e) {
      console.warn(e);
    }
  }, [db]);

  useEffect(() => {
    if (!db || !searchYear) return;
    getExams(db, searchYear).then(exams => {
      setSearchExams(exams);
      if (exams.length > 0 && !searchExam) {
        setSearchExam(exams[0].name);
      }
    }).catch(console.error);
  }, [db, searchYear]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    const cleanEmail = email.trim().toLowerCase();
    const isSuperAdmin = cleanEmail === 'dlswf.roy@gmail.com';

    try {
      if (activeAuthTab === 'signup') {
        const staffQuery = query(collection(db, 'staff'), where('email', '==', cleanEmail));
        const staffSnap = await getDocs(staffQuery);
        const isTeacherInStaff = !staffSnap.empty;

        if (!isTeacherInStaff && !isSuperAdmin) {
          toast({
            variant: "destructive",
            title: "নিবন্ধন করা সম্ভব নয়",
            description: "এই ইমেইলটি শিক্ষক তালিকায় অন্তর্ভুক্ত নেই!"
          });
          setLoading(false);
          return;
        }

        const userCredential = await createUserWithEmailAndPassword(auth, cleanEmail, password);
        await updateProfile(userCredential.user, { displayName: name });

        const teacherData = isTeacherInStaff ? staffSnap.docs[0].data() : null;

        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: cleanEmail,
          displayName: name || teacherData?.nameBn || (isSuperAdmin ? 'প্রধান অ্যাডমিন' : 'শিক্ষক'),
          role: isSuperAdmin ? 'admin' : 'teacher',
          status: 'active',
          staffId: isTeacherInStaff ? staffSnap.docs[0].id : null,
          permissions: isSuperAdmin ? availablePermissions.map(p => p.id) : (defaultPermissions['teacher'] || []),
          createdAt: serverTimestamp()
        });

        toast({ title: "সফল নিবন্ধন", description: "এখন লগইন করুন।" });
        setActiveAuthTab('teacher');
        setLoading(false);
        return;
      } else {
        const userCredential = await signInWithEmailAndPassword(auth, cleanEmail, password);
        const fbUser = userCredential.user;
        const userDoc = await getDoc(doc(db, 'users', fbUser.uid));
        
        if (!userDoc.exists()) {
          await signOut(auth);
          toast({ variant: "destructive", title: "অ্যাকাউন্ট পাওয়া যায়নি", description: "আগে অ্যাকাউন্ট তৈরি করুন।" });
          setLoading(false);
          return;
        }

        const userData = userDoc.data();
        const userRole = userData.role;

        if (activeAuthTab === 'admin' && userRole !== 'admin' && !isSuperAdmin) {
            await signOut(auth);
            toast({ variant: "destructive", title: "প্রবেশাধিকার নেই", description: "আপনি অ্যাডমিন নন।" });
            setLoading(false);
            return;
        } else if (activeAuthTab === 'teacher' && userRole !== 'teacher' && !isSuperAdmin) {
            await signOut(auth);
            toast({ variant: "destructive", title: "প্রবেশাধিকার নেই", description: "আপনি শিক্ষক নন।" });
            setLoading(false);
            return;
        }

        if (userData.status === 'inactive' || userData.status === 'blocked') {
            await signOut(auth);
            toast({ variant: "destructive", title: "অ্যাকাউন্ট নিষ্ক্রিয়" });
            setLoading(false);
            return;
        }

        await setDoc(doc(db, 'users', fbUser.uid), {
          isOnline: true,
          lastLoginAt: serverTimestamp(),
          lastActiveAt: serverTimestamp(),
        }, { merge: true }).catch(() => {});

        toast({ title: "সফল লগইন" });
        setIsDialogOpen(false);
        router.push('/');
      }
    } catch (error: any) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "ইমেইল বা পাসওয়ার্ড সঠিক নয়।" });
    } finally {
      setLoading(false);
    }
  };

  const handleResultSearch = async (e: React.FormEvent) => {
    e.preventDefault();
    const bnToEn = (str: string) => str.toString().replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)].toString());
    if (!db || !searchYear || !searchClass || !searchExam || !searchRoll) {
      toast({ variant: 'destructive', title: 'সকল তথ্য সঠিকভাবে দিন' });
      return;
    }

    setIsSearching(true);
    setSearchResult(null);

    try {
      const cleanRoll = parseInt(bnToEn(searchRoll).trim(), 10);
      if (isNaN(cleanRoll)) {
        toast({ variant: 'destructive', title: 'সঠিক রোল নম্বর দিন' });
        setIsSearching(false);
        return;
      }
      const cleanStudentId = searchStudentId ? bnToEn(searchStudentId).trim().toUpperCase().replace(/\s/g, '') : '';

      const studentsQuery = query(
        collection(db, 'students'),
        where('academicYear', '==', searchYear),
        where('className', '==', searchClass),
        where('roll', '==', cleanRoll),
        limit(1)
      );
      const studentSnap = await getDocs(studentsQuery);

      if (studentSnap.empty) {
        toast({ variant: 'destructive', title: 'শিক্ষার্থী পাওয়া যায়নি' });
        setIsSearching(false);
        return;
      }

      const matchedStudent = studentFromDoc(studentSnap.docs[0]);

      if (cleanStudentId) {
        const dbStudentId = bnToEn(matchedStudent.generatedId || '').trim().toUpperCase().replace(/\s/g, '');
        if (dbStudentId !== cleanStudentId && matchedStudent.generatedId !== cleanStudentId) {
          toast({ variant: 'destructive', title: 'শিক্ষার্থী আইডি মিলেনি' });
          setIsSearching(false);
          return;
        }
      }

      const allClassStudentsSnap = await getDocs(
        query(collection(db, 'students'), where('academicYear', '==', searchYear), where('className', '==', searchClass))
      );
      const allStudents = allClassStudentsSnap.docs.map(studentFromDoc);

      const subjects = getSubjects(searchClass, matchedStudent.group).filter(s => s.isExamSubject !== false);
      setSearchSubjects(subjects);

      const allExamResults = await getAllResults(db, searchYear, searchExam);
      const classExamResults = allExamResults.filter(r => r.className === searchClass);

      if (classExamResults.length === 0) {
        toast({ variant: 'destructive', title: 'ফলাফল প্রকাশিত হয়নি' });
        setIsSearching(false);
        return;
      }

      const processedList = processStudentResults(allStudents, classExamResults, subjects);
      const myResult = processedList.find(p => p.student.id === matchedStudent.id) || null;
      if (myResult) {
        setSearchResult(myResult);
      } else {
        toast({ variant: 'destructive', title: 'ফলাফল পাওয়া যায়নি' });
      }
    } catch (err: any) {
      console.error("Result Search Error:", err);
      toast({ variant: 'destructive', title: 'অনুস্থান ত্রুটি' });
    } finally {
      setIsSearching(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-kalpurush bg-slate-50 -mt-20 -mx-4 overflow-x-hidden">
      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(0); }
          100% { transform: translateX(-50%); }
        }
        .animate-marquee {
          animation: marquee 50s linear infinite;
          display: inline-flex;
          width: max-content;
        }
        .pause-animation {
          animation-play-state: paused;
        }
        @media print {
            @page {
                size: A4 portrait;
                margin: 0.5in !important;
            }
            body * { visibility: hidden !important; background: white !important; }
            .printable-area, .printable-area * { visibility: visible !important; }
            .printable-area { 
                position: absolute !important; 
                left: 0 !important; 
                top: 0 !important; 
                width: 100% !important; 
                height: auto !important;
                margin: 0 !important; 
                padding: 0 !important;
                background: white !important;
                border: none !important;
                overflow: hidden !important;
                display: block !important;
            }
            .no-print { display: none !important; }
        }
      `}</style>

      <header className="bg-[#1e293b] text-white py-4 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-full w-14 h-14 flex items-center justify-center overflow-hidden shrink-0">
             {appLogoUrl ? <img src={appLogoUrl} alt="Logo" className="max-w-full" /> : <GraduationCap className="w-10 h-10 text-[#1e293b]" />}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase leading-tight">{appName}</h1>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 tracking-[0.2em] uppercase">Digital Management Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-md overflow-hidden p-0.5">
             <Button variant="ghost" size="sm" className="h-7 text-[10px] font-black px-3 rounded-sm bg-[#4f46e5] text-white hover:bg-[#4f46e5]/90">বাংলা</Button>
             <Button variant="ghost" size="sm" className="h-7 text-[10px] font-black px-3 rounded-sm text-slate-500 hover:bg-slate-100">English</Button>
          </div>
          <div className="bg-[#334155] px-3 py-1 rounded-full border border-slate-500/50">
            <span className="text-[10px] font-black text-slate-200">সেশন: ২০২৫</span>
          </div>
        </div>
      </header>

      {scrollingNotices.length > 0 && (
        <div className="bg-[#ef4444] text-white py-1.5 flex items-center relative overflow-hidden group cursor-default shadow-sm z-30">
          <div className="px-4 bg-[#dc2626] z-10 font-black text-xs flex items-center gap-2 border-r border-white/20 whitespace-nowrap shadow shrink-0">
             <Megaphone className="w-3.5 h-3.5 animate-bounce" /> জরুরি নোটিশ:
          </div>
          <div className="flex-1 overflow-hidden whitespace-nowrap relative h-6 flex items-center">
            <div className="inline-flex animate-marquee items-center gap-10 group-hover:pause-animation">
              {scrollingNotices.map((n, idx) => (
                <span key={`notice-${idx}`} className="font-bold text-xs uppercase tracking-wide py-0.5">
                  <span className="text-yellow-300 font-black">[{n.title}]</span> - {n.content?.replace(/\n/g, ' ')}
                </span>
              ))}
            </div>
          </div>
        </div>
      )}

      <section className="relative min-h-[560px] py-10 flex flex-col justify-between overflow-hidden">
        <BackgroundGallery />
        <div className="absolute inset-0 bg-gradient-to-r from-black/85 via-black/50 to-transparent z-10 pointer-events-none" />
        
        <div className="container mx-auto px-6 md:px-12 relative z-20">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl md:text-5xl font-black text-white leading-tight drop-shadow-md">
                সৃজনশীল শিক্ষায় <span className="text-yellow-400">এক ধাপ এগিয়ে...</span>
              </h2>
              <p className="text-slate-100 text-sm md:text-base font-medium leading-relaxed max-w-lg drop-shadow-md">
                {appName} এর কেন্দ্রীয় ডিজিটাল ম্যানেজমেন্ট পোর্টালে আপনাকে স্বাগতম। আধুনিক শিক্ষা ও প্রশাসনিক কাজে স্বচ্ছতা নিশ্চিত করতে আমাদের এই ডিজিটাল উদ্যোগ।
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <Button 
                onClick={() => setIsSearchOpen(true)}
                className="bg-[#1e293b] hover:bg-black text-white font-black gap-2 h-12 px-6 border-b-4 border-black transition-all shadow-xl"
              >
                <Search className="w-4 h-4" /> ফলাফল অনুসন্ধান
              </Button>

              <Link href="/admission">
                <Button className="bg-[#059669] hover:bg-[#047857] text-white font-black gap-2 h-12 px-6 border-b-4 border-[#064e3b] transition-all shadow-xl">
                  <UserPlus className="w-4 h-4" /> অনলাইন ভর্তি
                </Button>
              </Link>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black gap-2 h-12 px-10 border-b-4 border-[#7f1d1d] transition-all shadow-xl">
                    <LogIn className="w-4 h-4" /> লগইন করুন
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md p-0 overflow-hidden rounded-2xl shadow-2xl z-[150]">
                   <div className="bg-[#1e293b] p-6 text-white text-center space-y-2">
                      <div className="bg-white w-16 h-16 rounded-2xl mx-auto flex items-center justify-center p-2 mb-2 shadow-md">
                         {appLogoUrl ? <img src={appLogoUrl} alt="Logo" className="max-w-full max-h-full object-contain" /> : <GraduationCap className="w-10 h-10 text-[#1e293b]" />}
                      </div>
                      <DialogTitle className="text-xl font-black">প্রশাসনিক লগইন পোর্টাল</DialogTitle>
                      <DialogDescription className="text-xs text-slate-400 font-bold">আপনার নির্ধারিত রোল অনুযায়ী পোর্টালে প্রবেশ করুন</DialogDescription>
                   </div>
                   <div className="p-6 md:p-8 bg-white">
                      <Tabs value={activeAuthTab} onValueChange={(val: any) => setActiveAuthTab(val)} className="w-full">
                        <TabsList className="grid w-full grid-cols-3 bg-slate-100 p-1 mb-6 h-11 rounded-xl">
                          <TabsTrigger value="teacher" className="font-black text-xs rounded-lg data-[state=active]:bg-[#dc2626] data-[state=active]:text-white">শিক্ষক</TabsTrigger>
                          <TabsTrigger value="admin" className="font-black text-xs rounded-lg data-[state=active]:bg-[#dc2626] data-[state=active]:text-white">এডমিন</TabsTrigger>
                          <TabsTrigger value="signup" className="font-black text-xs rounded-lg data-[state=active]:bg-[#dc2626] data-[state=active]:text-white">নিবন্ধন</TabsTrigger>
                        </TabsList>
                        <form onSubmit={handleAuthSubmit} className="space-y-4">
                          {activeAuthTab === 'signup' && (
                            <div className="space-y-1.5">
                              <Label className="text-xs font-black text-slate-700 ml-1">শিক্ষকের পুরো নাম</Label>
                              <Input placeholder="উদা: সহকারী শিক্ষক" value={name} onChange={(e) => setName(e.target.value)} required className="font-bold h-11" />
                            </div>
                          )}
                          <div className="space-y-1.5">
                            <Label className="text-xs font-black text-slate-700 ml-1">ইমেইল এড্রেস</Label>
                            <Input type="email" placeholder="example@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="font-bold h-11" />
                          </div>
                          <div className="space-y-1.5">
                            <Label className="text-xs font-black text-slate-700 ml-1">পাসওয়ার্ড</Label>
                            <Input type="password" placeholder="••••••••" value={password} onChange={(e) => setPassword(e.target.value)} required className="font-bold h-11" />
                          </div>
                          <Button type="submit" className="w-full h-12 font-black text-base gap-2 bg-[#dc2626] shadow-lg mt-2" disabled={loading}>
                            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : <LogIn className="w-5 h-5" />}
                            {activeAuthTab === 'signup' ? 'নিবন্ধন সম্পন্ন করুন' : 'লগইন করুন'}
                          </Button>
                        </form>
                      </Tabs>
                   </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>
        </div>

        <div className="container mx-auto px-6 md:px-12 relative z-20 pt-8 pb-4">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-6xl">
            <Card className="bg-white/95 backdrop-blur-md border border-indigo-200 shadow-xl rounded-2xl md:rounded-3xl group hover:-translate-y-1 transition-all">
               <CardContent className="p-4 md:p-6 flex flex-col gap-3">
                  <div className="bg-indigo-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                     <Users className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-2xl md:text-3xl font-black text-slate-800">{toBengaliNumber(stats.students)}</p>
                    <p className="text-[10px] md:text-xs font-black text-indigo-600 uppercase tracking-wider mt-0.5">শিক্ষার্থী</p>
                  </div>
               </CardContent>
            </Card>
            <Card className="bg-white/95 backdrop-blur-md border border-emerald-200 shadow-xl rounded-2xl md:rounded-3xl group hover:-translate-y-1 transition-all">
               <CardContent className="p-4 md:p-6 flex flex-col gap-3">
                  <div className="bg-emerald-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                     <GraduationCap className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-2xl md:text-3xl font-black text-slate-800">{toBengaliNumber(stats.teachers)}</p>
                    <p className="text-[10px] md:text-xs font-black text-emerald-600 uppercase tracking-wider mt-0.5">শিক্ষক</p>
                  </div>
               </CardContent>
            </Card>
            <Card className="bg-white/95 backdrop-blur-md border border-blue-200 shadow-xl rounded-2xl md:rounded-3xl group hover:-translate-y-1 transition-all">
               <CardContent className="p-4 md:p-6 flex flex-col gap-3">
                  <div className="bg-blue-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                     <Calendar className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-2xl md:text-3xl font-black text-slate-800">{toBengaliNumber(stats.attendanceRate.toFixed(1))}%</p>
                    <p className="text-[10px] md:text-xs font-black text-blue-600 uppercase tracking-wider mt-0.5">উপস্থিতি</p>
                  </div>
               </CardContent>
            </Card>
            <Card className="bg-white/95 backdrop-blur-md border border-rose-200 shadow-xl rounded-2xl md:rounded-3xl group hover:-translate-y-1 transition-all">
               <CardContent className="p-4 md:p-6 flex flex-col gap-3">
                  <div className="bg-rose-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                     <Trophy className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-2xl md:text-3xl font-black text-slate-800">{toBengaliNumber(stats.passRate.toFixed(1))}%</p>
                    <p className="text-[10px] md:text-xs font-black text-rose-600 uppercase tracking-wider mt-0.5">এস এস সি পরীক্ষা-{toBengaliNumber(stats.sscYear)}</p>
                  </div>
               </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <Dialog 
        open={isSearchOpen} 
        onOpenChange={(o) => { 
          setIsSearchOpen(o); 
          if (!o) { 
            setSearchResult(null); 
            setSearchRoll(''); 
            setSearchStudentId(''); 
          }
        }}
      >
        <DialogContent className="sm:max-w-2xl p-0 overflow-hidden border-none shadow-2xl rounded-2xl z-[150] no-print">
          {!searchResult ? (
            <>
              <div className="p-8 bg-[#1e293b] text-white">
                <DialogTitle className="text-3xl font-black flex items-center gap-2">
                  <Search className="h-8 w-8 text-blue-400" /> ফলাফল অনুসন্ধান
                </DialogTitle>
                <DialogDescription className="text-white/70 font-bold mt-1">সঠিক তথ্য দিয়ে ডিজিটাল রেজাল্ট সামারি দেখুন</DialogDescription>
              </div>
              <form onSubmit={handleResultSearch} className="p-8 space-y-6 bg-white">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-black text-xs uppercase text-slate-600">শিক্ষাবর্ষ</Label>
                    <Input value={searchYear} onChange={(e) => setSearchYear(e.target.value)} placeholder="২০২৬" className="h-11 font-bold border-2" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-black text-xs uppercase text-slate-600">শ্রেণি</Label>
                    <Select value={searchClass} onValueChange={setSearchClass}>
                      <SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                      <SelectContent className="z-[200]">
                        {Object.entries(classNamesMap).map(([id, label]) => (
                          <SelectItem key={id} value={id} className="font-bold">{label} শ্রেণি</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label className="font-black text-xs uppercase text-slate-600">পরীক্ষার নাম</Label>
                  <Select value={searchExam} onValueChange={setSearchExam}>
                    <SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="পরীক্ষা নির্বাচন করুন" /></SelectTrigger>
                    <SelectContent className="z-[200]">
                      {searchExams.map(e => <SelectItem key={e.id} value={e.name} className="font-bold">{e.name}</SelectItem>)}
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <Label className="font-black text-xs uppercase text-slate-600">রোল নম্বর</Label>
                    <Input value={searchRoll} onChange={(e) => setSearchRoll(e.target.value)} placeholder="উদা: ১" className="font-black text-lg h-11 border-2" required />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="font-black text-xs uppercase text-slate-600">শিক্ষার্থী আইডি (ID)</Label>
                    <Input value={searchStudentId} onChange={(e) => setSearchStudentId(e.target.value)} placeholder="উদা: ST-1001" className="font-black text-lg h-11 border-2" />
                  </div>
                </div>
                <Button type="submit" className="w-full h-14 text-lg font-black bg-[#1e293b] hover:bg-black text-white shadow-xl" disabled={isSearching}>
                  {isSearching ? <Loader2 className="animate-spin mr-2" /> : <Search className="mr-2" />} ফলাফল দেখুন
                </Button>
              </form>
            </>
          ) : (
            <div className="flex flex-col bg-slate-50">
              <div className="p-6 bg-[#1e293b] text-white flex flex-row items-center gap-6 border-b-0 shadow-lg">
                <Avatar className="h-20 w-20 border-4 border-white/20 shadow-xl">
                  <AvatarImage src={sanitizePhotoUrl(searchResult.student.photoUrl, searchResult.student.gender) || getStudentPlaceholderImage(searchResult.student.gender)} className="object-cover" />
                  <AvatarFallback className="bg-primary/20 text-white font-black">S</AvatarFallback>
                </Avatar>
                <div className="overflow-hidden">
                  <DialogTitle className="text-3xl font-black truncate">{searchResult.student.studentNameBn}</DialogTitle>
                  <DialogDescription className="text-white/80 font-bold text-lg">
                    রোল: {toBengaliNumber(searchResult.student.roll)} | {classNamesMap[searchResult.student.className]} শ্রেণি | {searchExam}
                  </DialogDescription>
                </div>
              </div>

              <div className="p-6 space-y-6 overflow-y-auto max-h-[60vh] custom-scrollbar">
                <div className="grid grid-cols-4 gap-3 text-center">
                  <div className="p-3 bg-white border-2 border-black/5 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-black text-muted-foreground uppercase">মোট নম্বর</p>
                    <p className="text-2xl font-black text-primary">{toBengaliNumber(searchResult.totalMarks)}</p>
                  </div>
                  <div className="p-3 bg-white border-2 border-black/5 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-black text-muted-foreground uppercase">জি.পি.এ</p>
                    <p className="text-2xl font-black text-primary">{toBengaliNumber(searchResult.gpa.toFixed(2))}</p>
                  </div>
                  <div className="p-3 bg-white border-2 border-black/5 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-black text-muted-foreground uppercase">গ্রেড</p>
                    <p className={cn("text-2xl font-black", searchResult.isPass ? "text-emerald-600" : "text-rose-600")}>
                      {searchResult.isPass ? searchResult.finalGrade : 'F'}
                    </p>
                  </div>
                  <div className="p-3 bg-white border-2 border-black/5 rounded-2xl shadow-sm">
                    <p className="text-[10px] font-black text-muted-foreground uppercase">মেধাক্রম</p>
                    <p className="text-2xl font-black text-amber-600">
                      {searchResult.isPass ? toBengaliNumber(searchResult.meritPosition || '-') : 'ফেল'}
                    </p>
                  </div>
                </div>

                <div className="border-2 border-black/5 rounded-2xl overflow-hidden bg-white shadow-sm">
                  <Table>
                    <TableHeader className="bg-slate-100 h-10">
                      <TableRow>
                        <TableHead className="font-black text-black pl-6">বিষয়ের নাম</TableHead>
                        <TableHead className="text-center font-black text-black">প্রাপ্ত নম্বর</TableHead>
                        <TableHead className="text-center font-black text-black">গ্রেড</TableHead>
                        <TableHead className="text-right pr-6 font-black text-black">পয়েন্ট</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {Array.from(searchResult.subjectResults.entries()).map(([subName, res]) => (
                        <TableRow key={subName} className="h-10 hover:bg-slate-50 transition-colors">
                          <TableCell className="font-bold text-slate-700 pl-6">{subName}</TableCell>
                          <TableCell className="text-center font-black text-blue-900">{toBengaliNumber(res.marks)}</TableCell>
                          <TableCell className={cn("text-center font-black", res.isPass ? "text-slate-800" : "text-rose-600")}>{res.grade}</TableCell>
                          <TableCell className="text-right pr-6 font-bold">{toBengaliNumber(res.point.toFixed(2))}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </div>

              <div className="p-6 bg-white border-t flex flex-col sm:flex-row gap-4">
                <Button variant="outline" className="font-black flex-1 h-12 rounded-xl" onClick={() => setSearchResult(null)}>অন্য ফলাফল খুঁজুন</Button>
                <Button className="font-black flex-1 h-12 shadow-xl bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl gap-2" onClick={() => window.print()}>
                  <Printer className="h-5 w-5" /> মার্কশিট প্রিন্ট করুন
                </Button>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Professional English Marksheet for Printing */}
      {searchResult && (
        <div className="hidden print:block printable-area bg-white text-black p-0 w-full min-h-0 mx-auto font-sans">
          <div className="border-[1.5px] border-black p-4 flex flex-col h-full bg-white">
            <header className="text-center border-b-2 border-black pb-4 mb-4 flex flex-col items-center">
                {appLogoUrl && <img src={appLogoUrl} alt="Logo" className="w-16 h-16 object-contain mb-2" />}
                <h1 className="text-2xl font-black uppercase text-[#003366] leading-none mb-1">{schoolInfo.nameEn || schoolInfo.name || ""}</h1>
                <p className="text-sm font-bold text-gray-700">{schoolInfo.address}</p>
                <div className="mt-3 inline-block bg-slate-100 border border-black px-8 py-1 rounded-full font-black text-sm uppercase">PROGRESS REPORT - {searchYear}</div>
            </header>

            <div className="grid grid-cols-2 gap-x-8 gap-y-2 mb-4 text-[11px] border-2 border-black p-4 rounded-xl font-bold bg-slate-50/30">
                <div className="flex border-b border-black/10 pb-1">Name: <span className="uppercase font-black ml-1 flex-1">{searchResult.student.studentNameEn || searchResult.student.studentNameBn}</span></div>
                <div className="flex border-b border-black/10 pb-1">ID No: <span className="font-black ml-1 flex-1">{searchResult.student.generatedId || "-"}</span></div>
                <div className="flex border-b border-black/10 pb-1">Class: <span className="font-black ml-1 flex-1">{searchClass}</span></div>
                <div className="flex border-b border-black/10 pb-1">Roll No: <span className="font-black ml-1 flex-1">{searchResult.student.roll}</span></div>
                <div className="flex border-b border-black/10 pb-1">Group: <span className="font-black ml-1 flex-1 uppercase">{groupMapEn[searchResult.student.group?.toLowerCase() || ''] || searchResult.student.group || "General"}</span></div>
                <div className="flex border-b border-black/10 pb-1">Exam: <span className="font-black ml-1 flex-1">{searchExam}</span></div>
            </div>

            <div className="grid grid-cols-4 border-2 border-black divide-x-2 divide-black text-center text-[11px] bg-blue-900 text-white mb-4 rounded-sm">
                <div className="py-1.5 font-bold">Status: <span className={cn("font-black", searchResult.isPass ? "text-green-400" : "text-red-400")}>{searchResult.isPass ? "PASSED" : "FAILED"}</span></div>
                <div className="py-1.5 font-bold">GPA: <span className="text-amber-300 font-black">{searchResult.gpa.toFixed(2)}</span></div>
                <div className="py-1.5 font-bold">Final Grade: <span className="text-amber-300 font-black">{searchResult.isPass ? searchResult.finalGrade : "F"}</span></div>
                <div className="py-1.5 font-bold">Merit Rank: <span>{searchResult.isPass ? (searchResult.meritPosition || "-") : "-"}</span></div>
            </div>

            <div className="flex-grow">
                <table className="w-full text-[10px] text-center border-collapse border-2 border-black">
                    <thead className="bg-slate-100 border-b-2 border-black">
                    <tr>
                        <th className="border-r border-black font-black p-1 w-8">SL</th>
                        <th className="border-r border-black font-black p-1 pl-4 text-left">Subject Name</th>
                        <th className="border-r border-black font-black p-1 w-12">Full Marks</th>
                        <th className="border-r border-black font-black p-1 w-14">Written</th>
                        <th className="border-r border-black font-black p-1 w-14">MCQ</th>
                        {searchSubjects.some(s => s.practical) && <th className="border-r border-black font-black p-1 w-14">Practical</th>}
                        <th className="border-r border-black font-black p-1 w-16">Obtained</th>
                        <th className="border-r border-black font-black p-1 w-12">Grade</th>
                        <th className="font-black p-1 w-12">Point</th>
                    </tr>
                    </thead>
                    <tbody>
                    {Array.from(searchResult.subjectResults.entries()).map(([subName, res], sIdx) => {
                        const subInfo = searchSubjects.find(s => s.name === subName);
                        const hasPracticalColumn = searchSubjects.some(s => s.practical);
                        return (
                        <tr key={subName} className="h-8 border-b border-black last:border-0 hover:bg-slate-50">
                            <td className="border-r border-black p-1 text-center font-medium text-gray-500">{sIdx + 1}</td>
                            <td className="border-r border-black text-left pl-4 font-bold uppercase">{subInfo?.englishName || subName}</td>
                            <td className="border-r border-black font-bold">{res.fullMarks}</td>
                            <td className="border-r border-black font-medium">{res.written ?? '-'}</td>
                            <td className="border-r border-black font-medium">{res.mcq ?? '-'}</td>
                            {hasPracticalColumn && <td className="border-r border-black font-medium">{res.practical ?? '-'}</td>}
                            <td className={cn("border-r border-black font-black text-[12px]", !res.isPass ? "text-red-600" : "text-blue-900")}>{res.marks}</td>
                            <td className={cn("border-r border-black font-black", !res.isPass && "text-red-600")}>{res.grade}</td>
                            <td className={cn("font-black", !res.isPass && "text-red-600")}>{res.point.toFixed(2)}</td>
                        </tr>
                        );
                    })}
                    </tbody>
                    <tfoot className="bg-slate-100 border-t-2 border-black h-10 font-black">
                    <tr>
                        <td colSpan={searchSubjects.some(s => s.practical) ? 6 : 5} className="border-r border-black text-right pr-6 uppercase text-[10px]">Total Marks & Final Results</td>
                        <td className="border-r border-black text-sm text-blue-900">{searchResult.totalMarks}</td>
                        <td className="border-r border-black text-sm">{searchResult.finalGrade}</td>
                        <td className="text-sm">{searchResult.gpa.toFixed(2)}</td>
                    </tr>
                    </tfoot>
                </table>
            </div>

            <div className="mt-4 p-2 border border-black rounded bg-gray-50/30">
                <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Remarks:</p>
                <p className="text-[11px] font-black italic text-blue-900">
                    "{searchResult.isPass ? (searchResult.gpa >= 5 ? "Excellent results. Keep it up!" : "Satisfactory performance. Aim higher!") : "Work hard to do well in the next exam"}"
                </p>
            </div>

            <div className="mt-auto flex justify-between px-10 pt-8 pb-4">
                <div className="text-center w-40 border-t-2 border-black pt-1 font-black text-[10px] uppercase">Class Teacher</div>
                <div className="text-center w-40 border-t-2 border-black pt-1 font-black text-[10px] uppercase">Headmaster</div>
            </div>
            
            <div className="mt-2 text-[7px] text-slate-400 italic flex justify-between border-t border-dashed pt-2">
                <span>Generated Date: {new Date().toLocaleDateString('en-GB')}</span>
                <span>Digital Management Portal | {schoolInfo.nameEn || institutionName}</span>
            </div>
          </div>
        </div>
      )}

      <footer className="mt-auto bg-[#0f172a] text-slate-400 py-8 px-6 md:px-12 border-t border-white/5 no-print">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 text-[10px] md:text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" /> © ২০২৬ {appName}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#ef4444]" /> {schoolInfo?.address || 'বাংলাদেশ'}
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-[#22c55e]" /> {toBengaliNumber(schoolInfo?.phone || '')}
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter text-blue-500/60">
             <BarChart3 className="w-3.5 h-3.5" /> Digital Management Portal | Version 2.0
          </div>
        </div>
      </footer>
    </div>
  );
}


'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, orderBy, Timestamp } from 'firebase/firestore';
import { Student, sanitizePhotoUrl, getStudentPlaceholderImage } from '@/lib/student-data';
import { FeeCollection, feeCollectionFromDoc } from '@/lib/fees-data';
import { DailyAttendance } from '@/lib/attendance-data';
import { getAllResults } from '@/lib/results-data';
import { getSubjects } from '@/lib/subjects';
import { processStudentResults } from '@/lib/results-calculation';
import { getExams } from '@/lib/exam-data';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { 
    Users, CalendarCheck, Award, Banknote, LogOut, Loader2, Star, CheckCircle2, XCircle, Clock, Wallet, LayoutDashboard, CreditCard, ChevronRight, TrendingUp
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

const classNamesMap: Record<string, string> = {
  '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const BENGALI_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

export default function ParentsDashboardPage() {
  const db = useFirestore();
  const router = useRouter();
  const [student, setStudent] = useState<Student | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  
  const [attendanceRecords, setAttendanceRecords] = useState<DailyAttendance[]>([]);
  const [feeHistory, setFeeHistory] = useState<FeeCollection[]>([]);
  const [academicResults, setAcademicResults] = useState<any[]>([]);

  useEffect(() => {
    const session = localStorage.getItem('parent_student_session');
    if (!session) {
      router.push('/parents/login');
      return;
    }
    setStudent(JSON.parse(session));
  }, [router]);

  useEffect(() => {
    if (!student || !db) return;

    const fetchData = async () => {
      setIsLoading(true);
      try {
        // 1. Fetch Attendance
        const attQuery = query(
          collection(db, 'attendance'),
          where('studentId', '==', student.id),
          where('academicYear', '==', student.academicYear)
        );
        const attSnap = await getDocs(attQuery);
        setAttendanceRecords(attSnap.docs.map(d => d.data() as DailyAttendance));

        // 2. Fetch Fees
        const feeQuery = query(
          collection(db, 'feeCollections'),
          where('studentId', '==', student.id),
          where('academicYear', '==', student.academicYear)
        );
        const feeSnap = await getDocs(feeQuery);
        setFeeHistory(feeSnap.docs.map(feeCollectionFromDoc).filter((f): f is FeeCollection => f !== null));

        // 3. Fetch Academic Results
        const exams = await getExams(db, student.academicYear);
        const resultsData = [];
        
        for (const exam of exams) {
            if (!exam.classes.includes(student.className)) continue;
            const allRes = await getAllResults(db, student.academicYear, exam.name);
            const classRes = allRes.filter(r => r.className === student.className);
            if (classRes.length === 0) continue;

            const subs = getSubjects(student.className, student.group).filter(s => s.isExamSubject !== false);
            const processed = processStudentResults([student], classRes, subs);
            const myRes = processed.find(r => r.student.id === student.id);
            if (myRes) resultsData.push({ exam: exam.name, gpa: myRes.gpa, isPass: myRes.isPass, grade: myRes.finalGrade });
        }
        setAcademicResults(resultsData);

      } catch (e) {
        console.error(e);
      } finally {
        setIsLoading(false);
      }
    };

    fetchData();
  }, [student, db]);

  const stats = useMemo(() => {
    const totalDays = attendanceRecords.length;
    const presentDays = attendanceRecords.filter(r => r.attendance.some(a => a.status === 'present')).length;
    const attPercent = totalDays > 0 ? (presentDays / totalDays) * 100 : 0;
    
    const paidMonths = new Set<string>();
    feeHistory.forEach(f => BENGALI_MONTHS.forEach(m => { if (f.description.includes(m)) paidMonths.add(m); }));
    
    return { attPercent, presentDays, paidCount: paidMonths.size };
  }, [attendanceRecords, feeHistory]);

  const handleLogout = () => {
    localStorage.removeItem('parent_student_session');
    router.push('/parents/login');
  };

  if (isLoading || !student) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-white">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="mt-4 font-black text-primary">ড্যাশবোর্ড প্রস্তুত হচ্ছে...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 font-kalpurush pb-20">
      <header className="bg-primary text-white p-6 shadow-xl relative overflow-hidden">
        <div className="absolute inset-0 bg-white/5 backdrop-blur-[1px] pointer-events-none" />
        <div className="max-w-5xl mx-auto flex items-center justify-between relative z-10">
          <div className="flex items-center gap-4">
            <div className="h-16 w-16 rounded-full border-4 border-white/30 p-0.5 shadow-lg overflow-hidden shrink-0">
                <Image 
                    src={sanitizePhotoUrl(student.photoUrl, student.gender) || getStudentPlaceholderImage(student.gender)} 
                    alt="Student" width={64} height={64} className="object-cover h-full w-full rounded-full" 
                />
            </div>
            <div>
              <h1 className="text-xl sm:text-2xl font-black">{student.studentNameBn}</h1>
              <p className="text-xs font-bold opacity-90">{classNamesMap[student.className]} শ্রেণি | রোল: {toBengaliNumber(student.roll)}</p>
            </div>
          </div>
          <Button variant="ghost" onClick={handleLogout} className="text-white hover:bg-white/20 font-black">
            <LogOut className="mr-2 h-4 w-4" /> লগআউট
          </Button>
        </div>
      </header>

      <main className="max-w-5xl mx-auto p-4 sm:p-8 space-y-8">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
            <Card className="border-[4px] border-black rounded-3xl bg-white shadow-[6px_6px_0px_rgba(0,0,0,0.1)] group hover:-translate-y-1 transition-all">
                <CardContent className="p-6 flex items-center gap-4">
                    <div className="bg-emerald-100 p-3 rounded-2xl text-emerald-700 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                        <CalendarCheck className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">হাজিরা</p>
                        <p className="text-2xl font-black text-emerald-950">{toBengaliNumber(stats.attPercent.toFixed(1))}%</p>
                    </div>
                </CardContent>
            </Card>
            <Card className="border-[4px] border-black rounded-3xl bg-white shadow-[6px_6px_0px_rgba(0,0,0,0.1)] group hover:-translate-y-1 transition-all">
                <CardContent className="p-6 flex items-center gap-4">
                    <div className="bg-amber-100 p-3 rounded-2xl text-amber-700 group-hover:bg-amber-600 group-hover:text-white transition-colors">
                        <Award className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">সর্বশেষ রেজাল্ট</p>
                        <p className="text-2xl font-black text-amber-950">
                            {academicResults.length > 0 ? `GPA ${toBengaliNumber(academicResults[academicResults.length-1].gpa.toFixed(2))}` : 'পাবলিশ হয়নি'}
                        </p>
                    </div>
                </CardContent>
            </Card>
            <Card className="border-[4px] border-black rounded-3xl bg-white shadow-[6px_6px_0px_rgba(0,0,0,0.1)] group hover:-translate-y-1 transition-all">
                <CardContent className="p-6 flex items-center gap-4">
                    <div className="bg-indigo-100 p-3 rounded-2xl text-indigo-700 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                        <Banknote className="h-8 w-8" />
                    </div>
                    <div>
                        <p className="text-[10px] font-black uppercase text-muted-foreground tracking-widest">বেতন পরিশোধিত</p>
                        <p className="text-2xl font-black text-indigo-950">{toBengaliNumber(stats.paidCount)} মাস</p>
                    </div>
                </CardContent>
            </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <Card className="border-[4px] border-black rounded-[32px] overflow-hidden bg-white shadow-[12px_12px_0px_rgba(0,0,0,0.1)]">
                <CardHeader className="bg-primary/5 border-b-[3px] border-black">
                    <CardTitle className="text-xl font-black flex items-center gap-2">
                        <TrendingUp className="h-5 w-5 text-primary" /> একাডেমিক প্রগতি
                    </CardTitle>
                </CardHeader>
                <CardContent className="p-6">
                    {academicResults.length === 0 ? (
                        <div className="py-20 text-center text-muted-foreground italic font-bold">এখনো কোনো ফলাফল প্রকাশিত হয়নি।</div>
                    ) : (
                        <div className="space-y-4">
                            {academicResults.map((res, i) => (
                                <div key={i} className="p-4 border-2 rounded-2xl flex items-center justify-between bg-slate-50 hover:border-primary/30 transition-all">
                                    <div>
                                        <h4 className="font-black text-slate-800">{res.exam}</h4>
                                        <p className={cn("text-xs font-bold", res.isPass ? "text-emerald-600" : "text-rose-600")}>
                                            {res.isPass ? 'কৃতকার্য' : 'অকৃতকার্য'} (গ্রেড: {res.grade})
                                        </p>
                                    </div>
                                    <Badge className="bg-primary h-8 px-4 font-black">GPA: {toBengaliNumber(res.gpa.toFixed(2))}</Badge>
                                </div>
                            ))}
                        </div>
                    )}
                </CardContent>
            </Card>

            <Card className="border-[4px] border-black rounded-[32px] overflow-hidden bg-white shadow-[12px_12px_0px_rgba(0,0,0,0.1)]">
                <CardHeader className="bg-emerald-50 border-b-[3px] border-black">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-xl font-black flex items-center gap-2">
                            <Wallet className="h-5 w-5 text-emerald-700" /> ফি ও বেতন ব্যবস্থাপনা
                        </CardTitle>
                        <Link href="/parents/payment">
                            <Button className="bg-emerald-600 hover:bg-emerald-700 font-black h-9 px-6 rounded-xl shadow-lg border-b-4 border-emerald-800 active:border-b-0">
                                <CreditCard className="mr-2 h-4 w-4" /> বেতন পরিশোধ
                            </Button>
                        </Link>
                    </div>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="space-y-4">
                        <h4 className="text-sm font-black text-slate-700 uppercase tracking-widest border-l-4 border-emerald-500 pl-2">সাম্প্রতিক পেমেন্টসমূহ</h4>
                        <div className="divide-y border rounded-2xl overflow-hidden shadow-sm">
                            {feeHistory.length === 0 ? (
                                <div className="p-10 text-center italic text-muted-foreground">কোনো পেমেন্ট রেকর্ড পাওয়া যায়নি।</div>
                            ) : (
                                feeHistory.slice(0, 5).map(fee => (
                                    <div key={fee.id} className="p-4 flex items-center justify-between hover:bg-slate-50 transition-colors">
                                        <div>
                                            <p className="font-black text-slate-800">{fee.description}</p>
                                            <p className="text-[10px] font-bold text-muted-foreground">{format(fee.collectionDate, 'PPP', { locale: bn })}</p>
                                        </div>
                                        <div className="text-right">
                                            <p className="font-black text-emerald-700 text-lg">{toBengaliNumber(fee.totalAmount)} ৳</p>
                                            <Badge variant="outline" className="text-[8px] uppercase font-black">{fee.method || 'cash'}</Badge>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </CardContent>
            </Card>
        </div>
      </main>
    </div>
  );
}

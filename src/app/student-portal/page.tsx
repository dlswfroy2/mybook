"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  GraduationCap, 
  Search, 
  ArrowLeft, 
  User, 
  Calendar, 
  CheckCircle2, 
  AlertCircle, 
  Banknote, 
  Award, 
  Clock, 
  BookOpen, 
  Phone, 
  Bot, 
  CreditCard,
  ExternalLink,
  ShieldCheck,
  ChevronRight
} from 'lucide-react';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Student, studentFromDoc } from '@/lib/student-data';
import { cn } from '@/lib/utils';
import Image from 'next/image';
import Link from 'next/link';

const classNamesMap: Record<string, string> = {
  '6': '৬ষ্ঠ',
  '7': '৭ম',
  '8': '৮ম',
  '9': '৯ম',
  '10': '১০ম'
};

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function StudentPortalContent() {
  const router = useRouter();
  const db = useFirestore();
  const { selectedYear } = useAcademicYear();

  const softwareDocRef = useMemo(() => db ? doc(db, 'config', 'software') : null, [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';

  const [selectedClass, setSelectedClass] = useState<string>('6');
  const [rollInput, setRollInput] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const [searchedStudent, setSearchedStudent] = useState<Student | null>(null);
  const [notFound, setNotFound] = useState<boolean>(false);

  const handleSearch = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const rollNum = parseInt(rollInput.trim(), 10);
    if (!db || !selectedClass || isNaN(rollNum)) return;

    setLoading(true);
    setNotFound(false);
    setSearchedStudent(null);

    try {
      const q = query(
        collection(db, 'students'),
        where('className', '==', selectedClass),
        where('academicYear', '==', selectedYear),
        where('roll', '==', rollNum)
      );
      const snap = await getDocs(q);
      if (!snap.empty) {
        const student = studentFromDoc(snap.docs[0]);
        setSearchedStudent(student);
      } else {
        setNotFound(true);
      }
    } catch (err) {
      console.error('Error finding student:', err);
      setNotFound(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 font-kalpurush">
      <div className="max-w-2xl mx-auto space-y-6">
        {/* Header Nav */}
        <div className="flex items-center justify-between">
          <Button variant="ghost" onClick={() => router.push('/')} className="font-bold text-slate-700">
            <ArrowLeft className="w-4 h-4 mr-1.5" /> হোম ড্যাশবোর্ড
          </Button>
          <Badge className="bg-indigo-600 text-white font-black text-xs px-3 py-1">
            শিক্ষার্থী ও অভিভাবক হাব
          </Badge>
        </div>

        {/* Hero Card */}
        <div className="bg-gradient-to-r from-indigo-700 via-primary to-indigo-800 text-white p-6 rounded-3xl shadow-xl space-y-2 text-center relative overflow-hidden">
          <div className="w-14 h-14 bg-white/10 rounded-2xl mx-auto flex items-center justify-center border border-white/20 mb-2">
            <GraduationCap className="w-8 h-8 text-yellow-300" />
          </div>
          <h1 className="text-xl md:text-2xl font-black uppercase tracking-wide">{appName}</h1>
          <p className="text-xs font-bold text-indigo-200">
            ডিজিটাল শিক্ষার্থী ও অভিভাবক স্মার্ট মোবাইল পোর্টাল ({toBengaliNumber(selectedYear)})
          </p>
        </div>

        {/* Search Card */}
        <Card className="rounded-3xl shadow-lg border-2 border-slate-200/80 bg-white">
          <CardHeader className="pb-3 text-center">
            <CardTitle className="text-base font-black text-slate-800">
              শিক্ষার্থীর তথ্য অনুসন্ধান করুন
            </CardTitle>
            <CardDescription className="text-xs font-bold">
              শ্রেণি ও রোল নম্বর দিয়ে তাৎক্ষণিক অ্যাকাডেমিক বিবরণ দেখুন
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSearch} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <span className="text-xs font-black text-slate-700">শ্রেণি নির্বাচন</span>
                  <Select value={selectedClass} onValueChange={setSelectedClass}>
                    <SelectTrigger className="h-11 font-bold text-xs bg-slate-50 border-slate-300">
                      <SelectValue placeholder="শ্রেণি" />
                    </SelectTrigger>
                    <SelectContent className="font-kalpurush">
                      {Object.entries(classNamesMap).map(([id, name]) => (
                        <SelectItem key={id} value={id} className="font-bold text-xs">
                          {name} শ্রেণি
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-1.5">
                  <span className="text-xs font-black text-slate-700">রোল নম্বর</span>
                  <Input
                    type="number"
                    value={rollInput}
                    onChange={(e) => setRollInput(e.target.value)}
                    placeholder="যেমন: ১, ২, ৫..."
                    required
                    className="h-11 font-black text-sm bg-slate-50 border-slate-300"
                  />
                </div>
              </div>

              <Button
                type="submit"
                disabled={loading || !rollInput}
                className="w-full h-11 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-sm shadow-md rounded-xl"
              >
                {loading ? 'অনুসন্ধান হচ্ছে...' : (
                  <span className="flex items-center gap-1.5">
                    <Search className="w-4 h-4" /> প্রোফাইল ও রেজাল্ট দেখুন
                  </span>
                )}
              </Button>
            </form>

            {notFound && (
              <div className="mt-4 p-4 bg-rose-50 border border-rose-200 text-rose-800 rounded-2xl text-center text-xs font-bold flex items-center justify-center gap-2">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                উক্ত শ্রেণি ও রোলের কোনো শিক্ষার্থী পাওয়া যায়নি। অনুগ্রহ করে সঠিক শ্রেণি ও রোল দিন।
              </div>
            )}
          </CardContent>
        </Card>

        {/* Student Profile & Quick Actions */}
        {searchedStudent && (
          <div className="space-y-4 animate-in fade-in duration-300">
            {/* Student Info Card */}
            <Card className="rounded-3xl shadow-xl border-2 border-indigo-200 bg-white overflow-hidden">
              <div className="bg-gradient-to-r from-indigo-50 to-slate-50 p-4 border-b border-indigo-100 flex items-center gap-4">
                <div className="w-16 h-16 rounded-2xl border-2 border-indigo-400 p-0.5 bg-white relative overflow-hidden shrink-0 shadow-sm">
                  {searchedStudent.photoUrl ? (
                    <Image src={searchedStudent.photoUrl} alt={searchedStudent.studentNameBn} fill className="object-cover rounded-xl" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center bg-slate-100 text-[10px] text-slate-500 font-bold">ছবি নেই</div>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <h3 className="font-black text-lg text-slate-900 leading-tight">{searchedStudent.studentNameBn}</h3>
                  <p className="text-xs font-bold text-slate-500">{searchedStudent.studentNameEn || 'স্টুডেন্ট'}</p>
                  <div className="flex flex-wrap gap-2 mt-1.5">
                    <span className="text-[10px] font-black bg-indigo-600 text-white px-2 py-0.5 rounded-md">
                      {classNamesMap[searchedStudent.className] || searchedStudent.className} শ্রেণি
                    </span>
                    <span className="text-[10px] font-black bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded-md border border-emerald-200">
                      রোল: {toBengaliNumber(searchedStudent.roll)}
                    </span>
                    {searchedStudent.group && (
                      <span className="text-[10px] font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-md border border-amber-200">
                        {searchedStudent.group}
                      </span>
                    )}
                  </div>
                </div>
              </div>

              <CardContent className="p-4 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs bg-slate-50 p-3 rounded-2xl border border-slate-200">
                  <div>
                    <span className="text-slate-500 text-[10px] font-bold block">পিতার নাম</span>
                    <span className="font-bold text-slate-800">{searchedStudent.fatherNameBn || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] font-bold block">মাতার নাম</span>
                    <span className="font-bold text-slate-800">{searchedStudent.motherNameBn || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] font-bold block">অভিভাবক ফোন</span>
                    <span className="font-bold text-indigo-700">{searchedStudent.guardianMobile || '-'}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 text-[10px] font-bold block">শিক্ষাবর্ষ</span>
                    <span className="font-bold text-slate-800">{toBengaliNumber(searchedStudent.academicYear)}</span>
                  </div>
                </div>

                {/* Quick Next-Gen Action Hub */}
                <div className="space-y-2 pt-2">
                  <p className="text-xs font-black text-slate-700 uppercase tracking-wider">দ্রুত অ্যাকাডেমিক সেবাসমূহ:</p>
                  
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <Link
                      href="/id-cards"
                      className="p-3 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-2xl flex items-center justify-between text-indigo-900 font-black text-xs transition-colors shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <CreditCard className="w-4 h-4 text-indigo-600" />
                        আইডি কার্ড ও প্রবেশপত্র
                      </span>
                      <ChevronRight className="w-4 h-4 text-indigo-400" />
                    </Link>

                    <Link
                      href="/ai-tutor"
                      className="p-3 bg-purple-50 hover:bg-purple-100 border border-purple-200 rounded-2xl flex items-center justify-between text-purple-900 font-black text-xs transition-colors shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <Bot className="w-4 h-4 text-purple-600" />
                        ২৪/৭ এআই স্টাডি টিউটর
                      </span>
                      <ChevronRight className="w-4 h-4 text-purple-400" />
                    </Link>

                    <Link
                      href="/online-exam"
                      className="p-3 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded-2xl flex items-center justify-between text-emerald-900 font-black text-xs transition-colors shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <Award className="w-4 h-4 text-emerald-600" />
                        অনলাইন মূল্যায়ন পরীক্ষা
                      </span>
                      <ChevronRight className="w-4 h-4 text-emerald-400" />
                    </Link>

                    <Link
                      href="/whiteboard"
                      className="p-3 bg-amber-50 hover:bg-amber-100 border border-amber-200 rounded-2xl flex items-center justify-between text-amber-900 font-black text-xs transition-colors shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <BookOpen className="w-4 h-4 text-amber-600" />
                        স্মার্ট হোয়াইটবোর্ড ও নোট
                      </span>
                      <ChevronRight className="w-4 h-4 text-amber-400" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        )}
      </div>
    </div>
  );
}

export default function StudentPortalPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">লোড হচ্ছে...</div>}>
      <StudentPortalContent />
    </Suspense>
  );
}

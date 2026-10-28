"use client";

import React, { useState, useEffect, useMemo, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { collection, query, where, getDocs, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { QRCodeSVG } from 'qrcode.react';
import { 
  Printer, 
  ArrowLeft, 
  Search, 
  CreditCard, 
  FileText, 
  CheckCircle2, 
  GraduationCap, 
  Calendar,
  Layers,
  Sparkles,
  Phone,
  ShieldCheck,
  Award
} from 'lucide-react';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Student, studentFromDoc } from '@/lib/student-data';
import { cn } from '@/lib/utils';
import Image from 'next/image';

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

function IdCardGeneratorContent() {
  const router = useRouter();
  const db = useFirestore();
  const { selectedYear } = useAcademicYear();

  const softwareDocRef = useMemo(() => db ? doc(db, 'config', 'software') : null, [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';
  const appLogoUrl = softwareConfig?.appLogoUrl || '';

  const [selectedClass, setSelectedClass] = useState<string>('6');
  const [viewMode, setViewMode] = useState<'id' | 'admit'>('id');
  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [examTitle, setExamTitle] = useState<string>('বার্ষিক মূল্যায়ন পরীক্ষা');

  useEffect(() => {
    async function loadStudents() {
      if (!db || !selectedClass) return;
      setLoading(true);
      try {
        const q = query(
          collection(db, 'students'),
          where('className', '==', selectedClass),
          where('academicYear', '==', selectedYear)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(d => studentFromDoc(d)).sort((a, b) => a.roll - b.roll);
        setStudents(list);
      } catch (err) {
        console.error('Error fetching students:', err);
      } finally {
        setLoading(false);
      }
    }
    loadStudents();
  }, [db, selectedClass, selectedYear]);

  const filteredStudents = useMemo(() => {
    if (!searchQuery.trim()) return students;
    const q = searchQuery.toLowerCase();
    return students.filter(s => 
      s.studentNameBn?.toLowerCase().includes(q) ||
      s.studentNameEn?.toLowerCase().includes(q) ||
      String(s.roll).includes(q)
    );
  }, [students, searchQuery]);

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-4 font-kalpurush print:bg-white print:p-0">
      {/* Top Toolbar (Hidden when printing) */}
      <div className="max-w-6xl mx-auto mb-6 bg-white p-4 rounded-2xl border-2 border-slate-200 shadow-sm no-print flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold text-slate-700">
            <ArrowLeft className="w-4 h-4" /> ফিরে যান
          </Button>
          <div className="h-6 w-px bg-slate-200" />
          <h2 className="text-lg font-black text-slate-800 flex items-center gap-2">
            <CreditCard className="w-5 h-5 text-indigo-600" /> ডিজিটাল আইডি ও প্রবেশপত্র হাব
          </h2>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Mode Switcher */}
          <div className="flex bg-slate-100 p-1 rounded-xl border">
            <button
              type="button"
              onClick={() => setViewMode('id')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5",
                viewMode === 'id' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <CreditCard className="w-3.5 h-3.5" /> আইডি কার্ড
            </button>
            <button
              type="button"
              onClick={() => setViewMode('admit')}
              className={cn(
                "px-3 py-1.5 rounded-lg text-xs font-black transition-all flex items-center gap-1.5",
                viewMode === 'admit' ? "bg-indigo-600 text-white shadow-xs" : "text-slate-600 hover:text-slate-900"
              )}
            >
              <FileText className="w-3.5 h-3.5" /> প্রবেশপত্র (Admit)
            </button>
          </div>

          {/* Class Selector */}
          <Select value={selectedClass} onValueChange={setSelectedClass}>
            <SelectTrigger className="w-36 h-9 font-bold text-xs bg-slate-50 border-slate-300">
              <SelectValue placeholder="শ্রেণি সিলেক্ট" />
            </SelectTrigger>
            <SelectContent className="font-kalpurush">
              {Object.entries(classNamesMap).map(([id, name]) => (
                <SelectItem key={id} value={id}>{name} শ্রেণি</SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Admit Exam Title */}
          {viewMode === 'admit' && (
            <Input
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="পরীক্ষার নাম..."
              className="w-48 h-9 text-xs font-bold bg-slate-50 border-slate-300"
            />
          )}

          {/* Search */}
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-3 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="নাম বা রোল..."
              className="w-36 pl-8 h-9 text-xs font-bold bg-slate-50 border-slate-300"
            />
          </div>

          {/* Print Button */}
          <Button onClick={() => window.print()} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 shadow-md h-9">
            <Printer className="w-4 h-4" /> প্রিন্ট করুন ({toBengaliNumber(filteredStudents.length)})
          </Button>
        </div>
      </div>

      {/* Main Content Area */}
      <div className="max-w-6xl mx-auto">
        {loading ? (
          <div className="text-center py-20 text-slate-500 font-bold">
            লোড হচ্ছে... অনুগ্রহ করে অপেক্ষা করুন।
          </div>
        ) : filteredStudents.length === 0 ? (
          <div className="bg-white p-12 text-center rounded-2xl border border-slate-200">
            <p className="text-slate-600 font-bold text-base">এই শ্রেণিতে কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।</p>
          </div>
        ) : viewMode === 'id' ? (
          /* ID CARDS GRID */
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6 print:grid-cols-2 print:gap-4 print:p-2">
            {filteredStudents.map((student) => {
              const qrValue = JSON.stringify({
                id: student.id,
                name: student.studentNameBn,
                roll: student.roll,
                class: student.className,
                year: selectedYear,
                guardian: student.guardianMobile
              });

              return (
                <div 
                  key={student.id} 
                  className="w-[320px] mx-auto bg-gradient-to-b from-slate-900 via-indigo-950 to-slate-900 text-white rounded-2xl overflow-hidden shadow-xl border-2 border-indigo-400/30 flex flex-col justify-between print:shadow-none print:break-inside-avoid print:border-black print:mb-4"
                  style={{ height: '480px' }}
                >
                  {/* Card Header */}
                  <div className="bg-gradient-to-r from-indigo-700 via-primary to-indigo-800 p-3 text-center border-b border-indigo-400/30 relative">
                    <div className="flex items-center justify-center gap-2">
                      {appLogoUrl ? (
                        <Image src={appLogoUrl} alt="Logo" width={28} height={28} className="rounded-full bg-white p-0.5 object-cover" />
                      ) : (
                        <GraduationCap className="w-6 h-6 text-yellow-300" />
                      )}
                      <div>
                        <h3 className="font-black text-sm text-yellow-300 tracking-wide uppercase line-clamp-1">{appName}</h3>
                        <p className="text-[10px] text-indigo-200 font-bold tracking-widest uppercase">শিক্ষার্থী পরিচয়পত্র • {toBengaliNumber(selectedYear)}</p>
                      </div>
                    </div>
                  </div>

                  {/* Card Body */}
                  <div className="p-4 flex flex-col items-center flex-1 text-center space-y-2">
                    {/* Photo Container */}
                    <div className="w-24 h-24 rounded-full border-4 border-yellow-400 p-0.5 shadow-lg bg-white overflow-hidden relative mb-1">
                      {student.photoUrl ? (
                        <Image 
                          src={student.photoUrl} 
                          alt={student.studentNameBn} 
                          fill 
                          className="object-cover rounded-full" 
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-slate-200 text-slate-600 font-black text-xs">
                          ছবি নেই
                        </div>
                      )}
                    </div>

                    {/* Name & Roll */}
                    <div>
                      <h4 className="font-black text-base text-white tracking-wide">{student.studentNameBn}</h4>
                      {student.studentNameEn && (
                        <p className="text-[11px] font-bold text-indigo-200 uppercase tracking-wider">{student.studentNameEn}</p>
                      )}
                    </div>

                    {/* Badge Details */}
                    <div className="grid grid-cols-2 gap-2 w-full pt-1">
                      <div className="bg-white/10 rounded-lg p-1.5 border border-white/10">
                        <span className="text-[10px] text-yellow-300 font-bold block">শ্রেণি</span>
                        <span className="text-xs font-black">{classNamesMap[student.className] || student.className} শ্রেণি</span>
                      </div>
                      <div className="bg-white/10 rounded-lg p-1.5 border border-white/10">
                        <span className="text-[10px] text-yellow-300 font-bold block">রোল নম্বর</span>
                        <span className="text-xs font-black">{toBengaliNumber(student.roll)}</span>
                      </div>
                    </div>

                    {/* Details Table */}
                    <div className="w-full text-left text-[11px] bg-black/20 p-2 rounded-xl border border-white/10 space-y-1">
                      {student.fatherNameBn && (
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold">পিতা:</span>
                          <span className="font-bold text-slate-100">{student.fatherNameBn}</span>
                        </div>
                      )}
                      {student.group && (
                        <div className="flex justify-between">
                          <span className="text-slate-400 font-bold">বিভাগ:</span>
                          <span className="font-bold text-slate-100">{student.group}</span>
                        </div>
                      )}
                      <div className="flex justify-between items-center">
                        <span className="text-slate-400 font-bold">অভিভাবক ফোন:</span>
                        <span className="font-bold text-emerald-300">{student.guardianMobile || '-'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Card Footer with QR */}
                  <div className="bg-slate-950 p-2.5 px-4 border-t border-indigo-400/30 flex items-center justify-between">
                    <div className="bg-white p-1 rounded-lg">
                      <QRCodeSVG value={qrValue} size={46} level="M" />
                    </div>
                    <div className="text-right">
                      <p className="text-[9px] text-slate-400 font-bold uppercase">অনুমোদিত স্বাক্ষর</p>
                      <div className="h-5 w-24 border-b border-dashed border-slate-500 mb-0.5 ml-auto" />
                      <p className="text-[8px] text-yellow-400 font-black">অধ্যক্ষ / প্রধান শিক্ষক</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          /* ADMIT CARDS GRID */
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 print:grid-cols-2 print:gap-4 print:p-2">
            {filteredStudents.map((student) => {
              const qrValue = JSON.stringify({
                type: 'ADMIT',
                exam: examTitle,
                roll: student.roll,
                class: student.className,
                name: student.studentNameBn
              });

              return (
                <div 
                  key={student.id} 
                  className="bg-white text-slate-900 rounded-2xl p-5 border-2 border-indigo-700 shadow-xl flex flex-col justify-between print:shadow-none print:break-inside-avoid print:border-black print:mb-6"
                  style={{ minHeight: '440px' }}
                >
                  {/* Admit Header */}
                  <div className="text-center border-b-2 border-indigo-700 pb-2.5 mb-3">
                    <h3 className="font-black text-lg text-indigo-900 uppercase tracking-wide">{appName}</h3>
                    <div className="inline-block bg-indigo-700 text-white px-3 py-0.5 rounded-full text-xs font-black uppercase my-1">
                      {examTitle} • {toBengaliNumber(selectedYear)}
                    </div>
                    <p className="text-xs font-black text-rose-700 uppercase tracking-wider">পরীক্ষার প্রবেশপত্র (EXAM ADMIT CARD)</p>
                  </div>

                  {/* Admit Body */}
                  <div className="flex gap-4 items-start mb-3">
                    <div className="w-20 h-20 rounded-xl border-2 border-indigo-300 p-0.5 bg-slate-100 shrink-0 relative overflow-hidden">
                      {student.photoUrl ? (
                        <Image src={student.photoUrl} alt={student.studentNameBn} fill className="object-cover rounded-lg" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-slate-500 font-bold">ছবি নেই</div>
                      )}
                    </div>

                    <div className="flex-1 grid grid-cols-2 gap-y-1.5 text-xs">
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold block">শিক্ষার্থীর নাম:</span>
                        <span className="font-black text-slate-900 text-sm">{student.studentNameBn}</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold block">রোল নম্বর:</span>
                        <span className="font-black text-indigo-800 text-sm bg-indigo-50 px-2 py-0.5 rounded border border-indigo-200">
                          {toBengaliNumber(student.roll)}
                        </span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold block">শ্রেণি:</span>
                        <span className="font-black text-slate-900">{classNamesMap[student.className] || student.className} শ্রেণি</span>
                      </div>
                      <div>
                        <span className="text-slate-500 text-[10px] font-bold block">শাখা / বিভাগ:</span>
                        <span className="font-black text-slate-900">{student.group || 'সাধারণ'}</span>
                      </div>
                    </div>
                  </div>

                  {/* Exam Guidelines Warning Box */}
                  <div className="bg-amber-50 border border-amber-300 rounded-xl p-2.5 text-[10px] text-amber-900 font-bold space-y-0.5 leading-tight mb-3">
                    <p className="font-black text-amber-950">পরীক্ষার্থীদের জন্য জরুরি নির্দেশনাবলী:</p>
                    <p>১. পরীক্ষা শুরুর অন্তত ১৫ মিনিট পূর্বে কক্ষে উপস্থিত হতে হবে।</p>
                    <p>২. প্রবেশপত্র ব্যতিরেকে কোনো শিক্ষার্থীকে পরীক্ষায় অংশগ্রহণ করতে দেওয়া হবে না।</p>
                    <p>৩. পরীক্ষার হলে মোবাইল ফোন বা কোনো অবৈধ ইলেকট্রনিক ডিভাইস আনা সম্পূর্ণ নিষিদ্ধ।</p>
                  </div>

                  {/* Signatures & QR */}
                  <div className="pt-2 border-t-2 border-dashed border-slate-300 flex items-end justify-between">
                    <div className="bg-slate-50 p-1 rounded-lg border border-slate-200">
                      <QRCodeSVG value={qrValue} size={42} level="M" />
                    </div>
                    <div className="text-center">
                      <div className="h-6 w-24 border-b border-slate-400 mb-1" />
                      <p className="text-[10px] font-bold text-slate-600">শ্রেণি শিক্ষকের স্বাক্ষর</p>
                    </div>
                    <div className="text-center">
                      <div className="h-6 w-24 border-b border-slate-400 mb-1" />
                      <p className="text-[10px] font-black text-indigo-900">প্রধান শিক্ষকের স্বাক্ষর</p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function IdCardsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">লোড হচ্ছে...</div>}>
      <IdCardGeneratorContent />
    </Suspense>
  );
}

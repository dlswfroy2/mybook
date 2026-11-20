"use client";

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc, useUser } from '@/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Printer, ArrowLeft, Scissors, LayoutGrid, FileText, CheckCircle2, RefreshCw, Camera, Key, ChevronDown, ChevronUp, BarChart2, Save, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import { OmrScannerDialog } from '@/components/OmrScannerDialog';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit, 10)]);
}

// Single OMR Sheet component (reusable for 2-in-1 landscape or 1-in-1 portrait)
interface SingleOmrSheetProps {
  examTitle: string;
  examSubtitle: string;
  fullMarks: string;
  questionCount: number;
  rollDigits?: number;
  subjectDigits?: number;
  isCompact?: boolean;
}

function SingleOmrCard({
  examTitle,
  examSubtitle,
  fullMarks,
  questionCount,
  rollDigits = 4,
  subjectDigits = 3,
  isCompact = true,
}: SingleOmrSheetProps) {
  // Determine MCQ columns
  // For 30 questions (SSC standard): 3 cols x 10 rows
  // For 25 questions: 3 cols (10, 10, 5)
  // For 20 questions: 2 cols x 10 rows
  // For 50 questions: 5 cols x 10 rows
  const numColumns = questionCount <= 20 ? 2 : questionCount <= 30 ? 3 : questionCount <= 50 ? 5 : 4;
  const rowsPerColumn = Math.ceil(questionCount / numColumns);

  const columnRanges = useMemo(() => {
    const ranges: { start: number; end: number; count: number }[] = [];
    for (let c = 0; c < numColumns; c++) {
      const start = c * rowsPerColumn + 1;
      const end = Math.min(start + rowsPerColumn - 1, questionCount);
      ranges.push({ start, end, count: end - start + 1 });
    }
    return ranges;
  }, [questionCount, numColumns, rowsPerColumn]);

  const bubbleOptions = ['ক', 'খ', 'গ', 'ঘ'];
  const digitRange = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];

  return (
    <div className={cn(
      "omr-card flex flex-col justify-between bg-white text-black font-kalpurush select-none",
      isCompact ? "w-full max-w-[5.45in] px-2 py-2" : "w-full max-w-[7.5in] p-4"
    )}>
      {/* ── Top Header Row ── */}
      <div className="flex items-center justify-between mb-2 gap-2">
        {/* Left Box: পূর্ণমান & প্রাপ্ত নম্বর */}
        <div className="border border-black rounded-none p-1.5 w-[1.4in] shrink-0 text-left">
          <div className="flex items-center justify-between text-[11px] font-black border-b border-black pb-0.5 mb-0.5">
            <span>পূর্ণমান:</span>
            <span className="font-bold underline">{toBengaliNumber(fullMarks)}</span>
          </div>
          <div className="flex items-center justify-between text-[11px] font-black pt-0.5">
            <span>প্রাপ্ত নম্বর:</span>
            <span className="w-8 border-b border-black border-dashed inline-block h-3"></span>
          </div>
        </div>

        {/* Center / Right: Exam Title & Subtitle */}
        <div className="flex-1 text-center pr-4">
          <h2 className="text-[17px] sm:text-[19px] font-black tracking-tight text-black leading-tight">
            {examTitle || 'এস এস সি পরীক্ষা- ২০২৭'}
          </h2>
          <div className="inline-block relative">
            <h3 className="text-[13px] sm:text-[14px] font-black text-black tracking-wide mt-0.5">
              {examSubtitle || 'মডেল টেস্ট'}
            </h3>
            {/* Styled wavy underline */}
            <div className="w-full h-0.5 border-b border-black border-dotted mt-0.5"></div>
          </div>
        </div>
      </div>

      {/* ── Middle: Student Details Box (3 Columns) ── */}
      <div className="border border-black rounded-none mb-2 overflow-hidden bg-white text-black">
        <div className="grid grid-cols-12 divide-x divide-black">
          {/* Column 1: শিক্ষার্থীর বিবরণ (5 of 12 cols) */}
          <div className="col-span-5 p-1.5 flex flex-col justify-between">
            <div className="text-[11px] font-black text-black border-b border-black pb-0.5 mb-1.5 uppercase">
              শিক্ষার্থীর বিবরণ
            </div>
            <div className="space-y-3.5 pt-1 text-[10.5px] font-bold">
              <div>
                <span className="text-slate-800">নাম:</span>
                <div className="border-b border-black w-full mt-3"></div>
              </div>
              <div>
                <span className="text-slate-800">শাখা / সেকশন:</span>
                <div className="border-b border-black w-full mt-3"></div>
              </div>
              <div>
                <span className="text-slate-800">কক্ষ নম্বর:</span>
                <div className="border-b border-black w-full mt-3"></div>
              </div>
            </div>
            <div className="mt-3 pt-1 border-t border-dashed border-slate-400 text-[8.5px] text-slate-700 leading-tight">
              * কালো বলপয়েন্ট কলম দ্বারা বৃত্ত সম্পূর্ণ ভরাট করুন।
            </div>
          </div>

          {/* Column 2: রোল নম্বর (Roll No) (4 of 12 cols) */}
          <div className="col-span-4 p-1 text-center flex flex-col items-center">
            <div className="text-[10px] font-black text-black border-b border-black pb-0.5 mb-1 w-full">
              রোল নম্বর (Roll No)
            </div>
            {/* 4 Digit Boxes */}
            <div className="grid grid-cols-4 gap-1 w-full max-w-[130px] mb-1">
              {Array.from({ length: rollDigits }).map((_, i) => (
                <div key={i} className="h-5 border border-black bg-slate-50 flex items-center justify-center text-[10px] font-bold"></div>
              ))}
            </div>
            {/* 4 Columns of 0-9 Bubbles */}
            <div className="grid grid-cols-4 gap-1 w-full max-w-[130px]">
              {Array.from({ length: rollDigits }).map((_, colI) => (
                <div key={colI} className="flex flex-col gap-[1.5px]">
                  {digitRange.map((d) => (
                    <div
                      key={d}
                      className="w-[15px] h-[15px] mx-auto rounded-full border border-black flex items-center justify-center text-[8.5px] font-black text-black leading-none bg-white"
                    >
                      {toBengaliNumber(d)}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Column 3: বিষয় কোড (Subject Code) & প্রশ্ন সেট (3 of 12 cols) */}
          <div className="col-span-3 p-1 text-center flex flex-col items-center justify-between">
            <div className="w-full">
              <div className="text-[10px] font-black text-black border-b border-black pb-0.5 mb-1 w-full">
                বিষয় কোড (Subject Code)
              </div>
              {/* 3 Digit Boxes */}
              <div className="grid grid-cols-3 gap-1 w-full max-w-[95px] mb-1 mx-auto">
                {Array.from({ length: subjectDigits }).map((_, i) => (
                  <div key={i} className="h-5 border border-black bg-slate-50 flex items-center justify-center text-[10px] font-bold"></div>
                ))}
              </div>
              {/* 3 Columns of 0-9 Bubbles */}
              <div className="grid grid-cols-3 gap-1 w-full max-w-[95px] mx-auto">
                {Array.from({ length: subjectDigits }).map((_, colI) => (
                  <div key={colI} className="flex flex-col gap-[1.5px]">
                    {digitRange.map((d) => (
                      <div
                        key={d}
                        className="w-[15px] h-[15px] mx-auto rounded-full border border-black flex items-center justify-center text-[8.5px] font-black text-black leading-none bg-white"
                      >
                        {toBengaliNumber(d)}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            {/* প্রশ্ন সেটের কোড (Set) */}
            <div className="w-full border-t border-black pt-1 mt-1">
              <div className="text-[9px] font-black text-black mb-0.5">
                প্রশ্ন সেটের কোড (Set)
              </div>
              <div className="flex justify-center items-center gap-1">
                {bubbleOptions.map((setOpt) => (
                  <div
                    key={setOpt}
                    className="w-[16px] h-[16px] rounded-full border border-black flex items-center justify-center text-[8.5px] font-black bg-white"
                  >
                    {setOpt}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── Bottom: MCQ Answer Tables (Side by Side Columns) ── */}
      <div className={cn(
        "grid gap-2 w-full",
        numColumns === 2 ? "grid-cols-2" : numColumns === 3 ? "grid-cols-3" : numColumns === 5 ? "grid-cols-5" : "grid-cols-4"
      )}>
        {columnRanges.map((col, colIdx) => (
          <div key={colIdx} className="border border-black rounded-none overflow-hidden bg-white">
            {/* Table Header: Pink / Salmon tint (exact Word document style) */}
            <div className="grid grid-cols-12 bg-[#fee2e2] border-b border-black text-center font-black text-[10.5px] py-0.5">
              <div className="col-span-4 border-r border-black">প্রশ্ন</div>
              <div className="col-span-8">উত্তর</div>
            </div>

            {/* Question Rows */}
            <div className="divide-y divide-black/80">
              {Array.from({ length: rowsPerColumn }).map((_, rIdx) => {
                const qNum = col.start + rIdx;
                const isValid = qNum <= col.end;

                if (!isValid) {
                  return (
                    <div key={rIdx} className="grid grid-cols-12 py-1 bg-slate-50/50 opacity-20">
                      <div className="col-span-4 text-center border-r border-black text-[10px] font-black">-</div>
                      <div className="col-span-8 flex justify-around px-0.5"></div>
                    </div>
                  );
                }

                return (
                  <div key={qNum} className="grid grid-cols-12 items-center py-[2px] bg-white hover:bg-slate-50 transition-colors">
                    {/* Question Number */}
                    <div className="col-span-4 text-center border-r border-black font-black text-[10.5px] text-black">
                      {toBengaliNumber(qNum)}
                    </div>
                    {/* 4 Circles (ক, খ, গ, ঘ) */}
                    <div className="col-span-8 flex justify-around items-center px-1">
                      {bubbleOptions.map((opt) => (
                        <div
                          key={opt}
                          className="w-[14.5px] h-[14.5px] rounded-full border border-black flex items-center justify-center text-[8px] font-black text-black leading-none bg-white"
                        >
                          {opt}
                        </div>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function OmrSheetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = searchParams.get('id');
  const countParam = searchParams.get('count');
  const isPrintAuto = searchParams.get('print') === 'true';

  const db = useFirestore();
  const { user } = useUser();
  const [examMeta, setExamMeta] = useState<any>(null);
  
  // Custom Controls State
  const [questionCount, setQuestionCount] = useState<number>(() => {
    const parsed = parseInt(countParam || '30', 10);
    return [20, 25, 30, 50].includes(parsed) ? parsed : 30;
  });

  const [layoutMode, setLayoutMode] = useState<'landscape_2up' | 'portrait_1up'>('landscape_2up');
  const [examTitle, setExamTitle] = useState('এস এস সি পরীক্ষা- ২০২৭');
  const [examSubtitle, setExamSubtitle] = useState('মডেল টেস্ট');
  const [fullMarks, setFullMarks] = useState('৩০');
  const [scannerOpen, setScannerOpen] = useState(false);
  const [masterAnswerKey, setMasterAnswerKey] = useState<Record<number, string>>({});
  const [answerKeyOpen, setAnswerKeyOpen] = useState(false);
  const [savedAnswerKeys, setSavedAnswerKeys] = useState<any[]>([]);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [loadKeyId, setLoadKeyId] = useState('');

  const softwareDocRef = React.useMemo(() => db ? doc(db, 'config', 'software') : null, [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';

  useEffect(() => {
    async function fetchMeta() {
      if (!db || !examId) return;
      try {
        const snap = await getDoc(doc(db, 'questions', examId));
        if (snap.exists()) {
          const d = snap.data();
          setExamMeta(d);
          if (d.exam) setExamTitle(d.exam);
          if (d.subject) setExamSubtitle(d.subject + (d.chapter ? ` (${d.chapter})` : ' - মডেল টেস্ট'));
          if (d.totalMarks) setFullMarks(String(d.totalMarks));
          if (Array.isArray(d.questions) && d.questions.length > 0) {
            const count = d.questions.length;
            if (count <= 20) setQuestionCount(20);
            else if (count <= 25) setQuestionCount(25);
            else if (count <= 30) setQuestionCount(30);
            else setQuestionCount(50);
          }
        }
      } catch (e) {
        console.error(e);
      }
    }
    fetchMeta();
  }, [db, examId]);

  useEffect(() => {
    if (isPrintAuto) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [isPrintAuto]);

  // Load saved answer keys from Firestore
  useEffect(() => {
    async function loadSavedKeys() {
      if (!db) return;
      try {
        const q = query(collection(db, 'omr_answer_keys'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setSavedAnswerKeys(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('উত্তরমালা লোড করতে সমস্যা:', e);
      }
    }
    loadSavedKeys();
  }, [db]);

  const handleSaveAnswerKey = async () => {
    if (!db) return;
    if (!examTitle.trim()) {
      alert('পরীক্ষার শিরোনাম দিন।');
      return;
    }
    if (Object.keys(masterAnswerKey).length === 0) {
      alert('অন্তত একটি উত্তর সেট করুন।');
      return;
    }
    setIsSavingKey(true);
    try {
      await addDoc(collection(db, 'omr_answer_keys'), {
        examTitle: examTitle.trim(),
        examSubtitle: examSubtitle.trim(),
        questionCount,
        answerKey: masterAnswerKey,
        createdAt: serverTimestamp(),
        userId: user?.uid || 'anonymous',
      });
      // Reload
      const q = query(collection(db, 'omr_answer_keys'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setSavedAnswerKeys(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      alert('উত্তরমালা সংরক্ষণ করা হয়েছে! ✅');
    } catch (e) {
      console.error(e);
      alert('সংরক্ষণে সমস্যা হয়েছে।');
    } finally {
      setIsSavingKey(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-200 py-4 sm:py-6 px-2 font-kalpurush print:bg-white print:p-0">
      {/* ── Top Toolbar (No Print) ── */}
      <div className="max-w-[11.69in] mx-auto mb-4 bg-white p-3 sm:p-4 rounded-xl border-2 border-slate-300 shadow-sm no-print space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          {/* Back & Title */}
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 font-bold">
              <ArrowLeft className="w-4 h-4" /> ফিরে যান
            </Button>
            <h1 className="text-base sm:text-lg font-black text-slate-800 flex items-center gap-2 border-l-2 pl-3">
              <FileText className="w-5 h-5 text-indigo-600" /> ওএমআর (OMR) শিট মেকার
            </h1>
          </div>

          {/* Quick Actions */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Question count selector */}
            <div className="flex items-center gap-1.5 bg-slate-100 p-1 rounded-lg border">
              <span className="text-xs font-bold text-slate-600 px-1 hidden sm:inline">প্রশ্ন:</span>
              {[20, 25, 30, 50].map(cnt => (
                <button
                  key={cnt}
                  type="button"
                  onClick={() => {
                    setQuestionCount(cnt);
                    setFullMarks(String(cnt));
                  }}
                  className={cn(
                    "px-2.5 py-1 rounded-md text-xs font-black transition-all",
                    questionCount === cnt
                      ? "bg-indigo-600 text-white shadow-xs"
                      : "text-slate-700 hover:text-slate-900 hover:bg-slate-200/60"
                  )}
                >
                  {toBengaliNumber(cnt)}টি
                </button>
              ))}
            </div>

            {/* Layout Mode (Landscape 2-in-1 vs Portrait 1-in-1) */}
            <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border">
              <button
                type="button"
                onClick={() => setLayoutMode('landscape_2up')}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-black transition-all flex items-center gap-1",
                  layoutMode === 'landscape_2up'
                    ? "bg-emerald-600 text-white shadow-xs"
                    : "text-slate-700 hover:text-slate-900"
                )}
                title="১টি A4 পাতায় পাশাপাশি ২টি ওএমআর শিট (কাগজ সাশ্রয়ী)"
              >
                <Scissors className="w-3.5 h-3.5" /> ২-ইন-১ ল্যান্ডস্কেপ
              </button>
              <button
                type="button"
                onClick={() => setLayoutMode('portrait_1up')}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs font-black transition-all flex items-center gap-1",
                  layoutMode === 'portrait_1up'
                    ? "bg-indigo-600 text-white shadow-xs"
                    : "text-slate-700 hover:text-slate-900"
                )}
                title="১টি A4 পাতায় ১টি ওএমআর শিট"
              >
                <LayoutGrid className="w-3.5 h-3.5" /> ১টি পোর্ট্রেট
              </button>
            </div>

            {/* Print Button */}
            <Button
              onClick={() => window.print()}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black gap-2 shadow-md h-9 px-4 no-print"
            >
              <Printer className="w-4 h-4" /> ওএমআর প্রিন্ট করুন
            </Button>

            {/* Scan Button */}
            <Button
              onClick={() => setScannerOpen(true)}
              className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black gap-2 shadow-md h-9 px-4 no-print"
            >
              <Camera className="w-4 h-4" /> মোবাইলে স্ক্যান
            </Button>

            {/* Results Button */}
            <Button
              onClick={() => router.push('/omr-results')}
              variant="outline"
              className="border-emerald-400 text-emerald-700 hover:bg-emerald-50 font-black gap-2 h-9 px-4 no-print"
            >
              <BarChart2 className="w-4 h-4" /> ফলাফল দেখুন
            </Button>
          </div>
        </div>

        {/* Inline Title / Year / Subtitle Customizer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t text-xs">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">পরীক্ষার শিরোনাম:</label>
            <div className="relative mt-0.5">
              <input
                list="examTitleList"
                value={examTitle}
                onChange={(e) => setExamTitle(e.target.value)}
                placeholder="এস এস সি পরীক্ষা- ২০২৭"
                className="h-8 text-xs font-bold w-full border rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <datalist id="examTitleList">
                {[...new Set(savedAnswerKeys.map((k: any) => k.examTitle).filter(Boolean))].map((t: any) => (
                  <option key={String(t)} value={String(t)} />
                ))}
                <option value="এস এস সি পরীক্ষা- ২০২৭" />
                <option value="জে এস সি পরীক্ষা- ২০২৭" />
                <option value="অর্ধ-বার্ষিক পরীক্ষা- ২০২৬" />
                <option value="বার্ষিক পরীক্ষা- ২০২৬" />
                <option value="মডেল টেস্ট ২০২৭" />
              </datalist>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">উপ-শিরোনাম / বিষয়:</label>
            <div className="relative mt-0.5">
              <input
                list="examSubtitleList"
                value={examSubtitle}
                onChange={(e) => setExamSubtitle(e.target.value)}
                placeholder="মডেল টেস্ট / গণিত"
                className="h-8 text-xs font-bold w-full border rounded-md px-2 bg-white focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
              <datalist id="examSubtitleList">
                {[...new Set(savedAnswerKeys
                  .filter((k: any) => !examTitle || k.examTitle === examTitle)
                  .map((k: any) => k.examSubtitle).filter(Boolean))].map((t: any) => (
                  <option key={String(t)} value={String(t)} />
                ))}
                <option value="বাংলা প্রথম পত্র" />
                <option value="বাংলা দ্বিতীয় পত্র" />
                <option value="ইংরেজি প্রথম পত্র" />
                <option value="ইংরেজি দ্বিতীয় পত্র" />
                <option value="গণিত" />
                <option value="বিজ্ঞান" />
                <option value="সাধারণ বিজ্ঞান" />
                <option value="মডেল টেস্ট" />
              </datalist>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">পূর্ণমান:</label>
            <Input
              value={fullMarks}
              onChange={(e) => setFullMarks(e.target.value)}
              placeholder="৩০"
              className="h-8 text-xs font-bold mt-0.5"
            />
          </div>
        </div>

        {/* ── Answer Key Setup Section ── */}
        <div className="border-t pt-3 mt-1 no-print">
          <button
            type="button"
            onClick={() => setAnswerKeyOpen(!answerKeyOpen)}
            className="flex items-center gap-2 text-sm font-black text-purple-700 hover:text-purple-900 transition-colors mb-2"
          >
            <Key className="w-4 h-4" />
            উত্তরমালা সেট করুন (Answer Key)
            {answerKeyOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            <span className="text-xs font-normal text-slate-500 ml-1">
              ({Object.keys(masterAnswerKey).length}/{questionCount} সেট করা হয়েছে)
            </span>
          </button>

          {answerKeyOpen && (
            <div className="bg-purple-50 border border-purple-200 rounded-xl p-3 mb-3">
              <p className="text-xs text-slate-600 mb-3 font-medium">
                প্রতিটি প্রশ্নের সঠিক উত্তর বাছাই করুন। স্ক্যানের সময় এই উত্তরমালা ব্যবহার হবে।
              </p>
              <div className="grid gap-y-1.5"
                style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}
              >
                {Array.from({ length: questionCount }, (_, i) => i + 1).map((qNum) => (
                  <div key={qNum} className="flex items-center gap-2">
                    <span className="text-xs font-black text-slate-600 w-6 text-right shrink-0">{qNum}.</span>
                    <div className="flex gap-1">
                      {['ক', 'খ', 'গ', 'ঘ'].map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setMasterAnswerKey(prev => {
                              const updated = { ...prev };
                              if (updated[qNum] === opt) {
                                delete updated[qNum];
                              } else {
                                updated[qNum] = opt;
                              }
                              return updated;
                            });
                          }}
                          className={cn(
                            "w-7 h-7 rounded-full text-xs font-black border-2 transition-all",
                            masterAnswerKey[qNum] === opt
                              ? "bg-green-500 border-green-600 text-white shadow-md scale-110"
                              : "bg-white border-slate-300 text-slate-600 hover:border-purple-400 hover:text-purple-700"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-wrap gap-2 mt-3 items-center">
                <button
                  type="button"
                  onClick={() => setMasterAnswerKey({})}
                  className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 border border-red-200 hover:border-red-400 rounded px-2 py-1 transition-colors"
                >
                  সব মুছুন
                </button>
                <span className="text-xs text-slate-500 flex items-center">
                  মোট {Object.keys(masterAnswerKey).length}টি উত্তর সেট করা হয়েছে
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {savedAnswerKeys.length > 0 && (
                    <select
                      value={loadKeyId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setLoadKeyId(id);
                        if (!id) return;
                        const found = savedAnswerKeys.find(k => k.id === id);
                        if (found && found.answerKey) {
                          const loaded: Record<number, string> = {};
                          Object.entries(found.answerKey).forEach(([k, v]) => {
                            loaded[Number(k)] = v as string;
                          });
                          setMasterAnswerKey(loaded);
                          if (found.questionCount) setQuestionCount(found.questionCount);
                        }
                      }}
                      className="h-8 text-xs font-bold border rounded-md px-2 bg-white max-w-[200px]"
                    >
                      <option value="">— সেভ করা উত্তরমালা লোড করুন —</option>
                      {savedAnswerKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.examTitle} / {k.examSubtitle}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveAnswerKey}
                    disabled={isSavingKey}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-black flex items-center gap-1 border border-emerald-300 hover:border-emerald-500 rounded px-3 py-1 transition-colors bg-emerald-50 disabled:opacity-50"
                  >
                    {isSavingKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    উত্তরমালা সেভ করুন
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── OmrScannerDialog ── */}
      <OmrScannerDialog
        open={scannerOpen}
        onOpenChange={setScannerOpen}
        questionCount={questionCount}
        examTitle={examTitle}
        examSubtitle={examSubtitle}
        defaultAnswerKey={masterAnswerKey}
      />

      {/* ── Main Printable Sheet Area ── */}
      <div className="flex justify-center overflow-x-auto pb-8 print:p-0 print:m-0 print:overflow-visible">
        {layoutMode === 'landscape_2up' ? (
          /* ═════════════════════════════════════════════════════════════════
             LANDSCAPE 2-IN-1 VIEW: Exact match of user Word document image
             (A4 Landscape: 11.69in x 8.27in with 2 identical OMR sheets)
             ═════════════════════════════════════════════════════════════════ */
          <div
            className="omr-print-page bg-white shadow-2xl rounded-none border border-slate-400 print:border-none print:shadow-none box-border flex items-stretch text-black"
            style={{
              width: '11.69in',
              minHeight: '8.27in',
              padding: '0.28in 0.35in',
            }}
          >
            {/* Sheet 1 (Left Half) */}
            <div className="flex-1 flex flex-col justify-start pr-3">
              <SingleOmrCard
                examTitle={examTitle}
                examSubtitle={examSubtitle}
                fullMarks={fullMarks}
                questionCount={questionCount}
                isCompact={true}
              />
            </div>

            {/* Vertical Cutting Divider (with Scissors) */}
            <div className="relative flex flex-col items-center justify-between px-1.5 no-print sm:flex">
              <div className="h-full border-r-2 border-dashed border-slate-400 print:border-black flex flex-col items-center justify-between py-2">
                <span className="text-[9px] font-black text-slate-400 rotate-90 whitespace-nowrap select-none">
                  ✂️ কেটে নিন
                </span>
                <span className="text-[9px] font-black text-slate-400 -rotate-90 whitespace-nowrap select-none">
                  ✂️ কেটে নিন
                </span>
              </div>
            </div>

            {/* Sheet 2 (Right Half - Identical) */}
            <div className="flex-1 flex flex-col justify-start pl-3">
              <SingleOmrCard
                examTitle={examTitle}
                examSubtitle={examSubtitle}
                fullMarks={fullMarks}
                questionCount={questionCount}
                isCompact={true}
              />
            </div>
          </div>
        ) : (
          /* ═════════════════════════════════════════════════════════════════
             PORTRAIT 1-IN-1 VIEW (Single Full-Page Sheet)
             ═════════════════════════════════════════════════════════════════ */
          <div
            className="omr-print-page-portrait bg-white shadow-2xl rounded-none border border-slate-400 print:border-none print:shadow-none box-border text-black mx-auto flex justify-center"
            style={{
              width: '8.27in',
              minHeight: '11.69in',
              padding: '0.4in 0.5in',
            }}
          >
            <SingleOmrCard
              examTitle={examTitle}
              examSubtitle={examSubtitle}
              fullMarks={fullMarks}
              questionCount={questionCount}
              isCompact={false}
            />
          </div>
        )}
      </div>

      {/* ── Print Specific Styles ── */}
      <style jsx global>{`
        @media print {
          @page {
            size: ${layoutMode === 'landscape_2up' ? 'A4 landscape' : 'A4 portrait'};
            margin: 4mm 6mm;
          }
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            width: 100% !important;
            height: auto !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .no-print {
            display: none !important;
          }
          .omr-print-page {
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
          .omr-print-page-portrait {
            width: 100% !important;
            min-height: 0 !important;
            height: auto !important;
            box-shadow: none !important;
            border: none !important;
            padding: 0 !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </div>
  );
}

export default function OmrSheetPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">OMR শিট লোড হচ্ছে...</div>}>
      <OmrSheetContent />
    </Suspense>
  );
}

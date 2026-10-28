"use client";

import React, { useState, useEffect, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirestore, useDoc } from '@/firebase';
import { doc, getDoc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Printer, ArrowLeft, Download, CheckCircle2, Sliders } from 'lucide-react';
import { cn } from '@/lib/utils';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function OmrSheetContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = searchParams.get('id');
  const countParam = searchParams.get('count');
  const isPrintAuto = searchParams.get('print') === 'true';

  const db = useFirestore();
  const [examMeta, setExamMeta] = useState<any>(null);
  const [questionCount, setQuestionCount] = useState<number>(() => {
    const parsed = parseInt(countParam || '25', 10);
    return [25, 50, 100].includes(parsed) ? parsed : 25;
  });

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
          if (Array.isArray(d.questions) && d.questions.length > 0) {
            const count = d.questions.length;
            if (count <= 25) setQuestionCount(25);
            else if (count <= 50) setQuestionCount(50);
            else setQuestionCount(100);
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

  const columns = questionCount === 100 ? 4 : questionCount === 50 ? 2 : 1;
  const perCol = questionCount / columns;

  return (
    <div className="min-h-screen bg-slate-100 py-6 px-2 font-kalpurush print:bg-white print:p-0">
      {/* Top Toolbar (No Print) */}
      <div className="max-w-[8.27in] mx-auto mb-6 flex flex-wrap items-center justify-between gap-3 no-print bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm">
        <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold">
          <ArrowLeft className="w-4 h-4" /> ফিরে যান
        </Button>

        <div className="flex items-center gap-2">
          <span className="text-xs font-bold text-slate-700">প্রশ্ন সংখ্যা:</span>
          <div className="flex bg-slate-100 p-1 rounded-lg border">
            {[25, 50, 100].map(cnt => (
              <button
                key={cnt}
                type="button"
                onClick={() => setQuestionCount(cnt)}
                className={cn(
                  "px-3 py-1 rounded-md text-xs font-bold transition-all",
                  questionCount === cnt ? "bg-indigo-600 text-white shadow-xs" : "text-slate-700 hover:text-slate-900"
                )}
              >
                {toBengaliNumber(cnt)}টি
              </button>
            ))}
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button 
            variant="outline" 
            type="button"
            onClick={() => {
              alert('OMR মূল্যায়ন নির্দেশনা:\n১. বলপয়েন্ট কলম দ্বারা বৃত্ত সম্পূর্ণ ভরাট করতে হবে।\n২. প্রতিটি সঠিক উত্তরের জন্য ১ নম্বর যোগ হবে।\n৩. ভুল উত্তর বা একাধিক বৃত্ত ভরাটের ক্ষেত্রে নম্বর কর্তন হবে।');
            }}
            className="font-bold gap-1.5 border-slate-300 text-xs text-slate-700"
          >
            📋 মূল্যায়ন নির্দেশিকা
          </Button>
          <Button onClick={() => window.print()} className="bg-indigo-600 hover:bg-indigo-700 text-white font-bold gap-2 shadow-md">
            <Printer className="w-4 h-4" /> OMR শিট প্রিন্ট করুন
          </Button>
        </div>
      </div>

      {/* Standard A4 Printable OMR Sheet */}
      <div className="w-[8.27in] min-h-[11.69in] mx-auto bg-white p-8 shadow-2xl rounded-none border border-black print:border-none print:shadow-none print:p-6 print:m-0 box-border text-black">
        {/* Header */}
        <div className="text-center border-b-2 border-black pb-3 mb-4 space-y-1">
          <h1 className="text-2xl font-black uppercase tracking-wide">
            {examMeta?.institution || appName}
          </h1>
          <h2 className="text-base font-bold">
            {examMeta?.exam || 'বহুনির্বাচনী মূল্যায়ন পরীক্ষা (OMR ANSWER SHEET)'}
          </h2>
          <div className="flex justify-between text-xs font-bold pt-1 px-4 text-slate-800">
            <span>বিষয়: {examMeta?.subject || '................................'}</span>
            <span>শ্রেণি: {examMeta?.classId ? `${examMeta.classId} শ্রেণি` : '................'}</span>
            <span>তারিখ: ....................</span>
          </div>
        </div>

        {/* Student Identification & Bubbles Section */}
        <div className="grid grid-cols-3 gap-4 border-2 border-black p-3 mb-4 text-xs font-bold">
          {/* Student Info Box */}
          <div className="space-y-2 border-r-2 border-black pr-3">
            <p className="font-black text-sm uppercase underline mb-1">শিক্ষার্থীর বিবরণ</p>
            <div>
              <span className="text-[11px] text-slate-700">নাম:</span>
              <div className="h-6 border-b border-black w-full" />
            </div>
            <div>
              <span className="text-[11px] text-slate-700">শাখা / সেকশন:</span>
              <div className="h-6 border-b border-black w-full" />
            </div>
            <div>
              <span className="text-[11px] text-slate-700">কক্ষ নম্বর:</span>
              <div className="h-6 border-b border-black w-full" />
            </div>
          </div>

          {/* Roll Number Bubble Grid */}
          <div className="border-r-2 border-black pr-3">
            <p className="font-black text-xs text-center mb-1">রোল নম্বর (Roll No)</p>
            <div className="grid grid-cols-4 gap-1 text-center">
              {[0, 1, 2, 3].map(colIdx => (
                <div key={colIdx} className="space-y-0.5">
                  <div className="h-5 border border-black text-[11px] flex items-center justify-center font-bold bg-slate-50" />
                  {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                    <div key={num} className="w-4 h-4 mx-auto rounded-full border border-black text-[9px] flex items-center justify-center font-bold">
                      {num}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </div>

          {/* Subject Code & Set Code Bubbles */}
          <div className="space-y-3">
            <div>
              <p className="font-black text-xs text-center mb-1">বিষয় কোড (Subject Code)</p>
              <div className="grid grid-cols-3 gap-1 text-center">
                {[0, 1, 2].map(colIdx => (
                  <div key={colIdx} className="space-y-0.5">
                    <div className="h-5 border border-black text-[11px] flex items-center justify-center font-bold bg-slate-50" />
                    {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
                      <div key={num} className="w-4 h-4 mx-auto rounded-full border border-black text-[9px] flex items-center justify-center font-bold">
                        {num}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-black pt-1">
              <p className="font-black text-[11px] text-center mb-1">প্রশ্ন সেট কোড (Set)</p>
              <div className="flex justify-center gap-2">
                {['ক', 'খ', 'গ', 'ঘ'].map(s => (
                  <div key={s} className="w-5 h-5 rounded-full border-2 border-black flex items-center justify-center text-[10px] font-black">
                    {s}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* OMR Instruction Warning */}
        <div className="border border-black bg-slate-50 p-2 mb-4 text-[10px] font-bold text-center leading-tight">
          ⚠️ <strong>সতর্কতা:</strong> বলপয়েন্ট কলম দ্বারা বৃত্তটি সম্পূর্ণ ভরাট করুন। কোনো কাটাকাটি বা ফ্লুইড ব্যবহার সম্পূর্ণ নিষিদ্ধ।
          <span className="ml-2 inline-flex items-center gap-1 font-black">
            সঠিক নিয়ম: <span className="w-3.5 h-3.5 rounded-full bg-black inline-block align-middle" />
            &nbsp;ভুল নিয়ম: <span className="w-3.5 h-3.5 rounded-full border border-black inline-block text-[8px] leading-3 text-center">✗</span>
          </span>
        </div>

        {/* MCQ Answer Bubbles Grid */}
        <div className={cn(
          "grid gap-4",
          columns === 4 ? "grid-cols-4" : columns === 2 ? "grid-cols-2" : "grid-cols-1 max-w-sm mx-auto"
        )}>
          {Array.from({ length: columns }).map((_, colI) => {
            const startQ = colI * perCol + 1;
            const endQ = startQ + perCol - 1;
            return (
              <div key={colI} className="border-2 border-black p-2 rounded-sm space-y-1 bg-white">
                <div className="text-center font-black text-xs border-b border-black pb-1 mb-1">
                  প্রশ্ন {toBengaliNumber(startQ)} হতে {toBengaliNumber(endQ)}
                </div>
                {Array.from({ length: perCol }).map((__, rowI) => {
                  const qNum = startQ + rowI;
                  return (
                    <div key={qNum} className="flex items-center justify-between text-xs font-bold py-0.5 border-b border-slate-100 last:border-none">
                      <span className="w-6 text-right font-black mr-1 text-[11px]">{toBengaliNumber(qNum)}.</span>
                      <div className="flex gap-1.5 flex-1 justify-around">
                        {['ক', 'খ', 'গ', 'ঘ'].map(opt => (
                          <div
                            key={opt}
                            className="w-4 h-4 rounded-full border-1.5 border-black text-[9px] flex items-center justify-center font-black"
                          >
                            {opt}
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>

        {/* Signatures Footer */}
        <div className="grid grid-cols-2 gap-8 pt-10 mt-6 border-t border-black text-xs font-bold text-center">
          <div>
            <div className="border-t border-black w-40 mx-auto mb-1" />
            <p>শিক্ষার্থীর স্বাক্ষর</p>
          </div>
          <div>
            <div className="border-t border-black w-40 mx-auto mb-1" />
            <p>কক্ষ পরিদর্শকের স্বাক্ষর</p>
          </div>
        </div>
      </div>
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

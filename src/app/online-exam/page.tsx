"use client";

import React, { useState, useEffect, useMemo, useRef, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { doc, getDoc, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { 
  Clock, 
  CheckCircle2, 
  XCircle, 
  AlertCircle, 
  ArrowLeft, 
  RotateCcw, 
  Printer, 
  Award, 
  Send, 
  HelpCircle,
  FileText,
  User,
  GraduationCap,
  Sparkles,
  Layers,
  Check
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { toast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

interface ParsedMcqQuestion {
  id: string;
  questionText: string;
  options: { key: string; label: string; text: string }[];
  correctAnswerKey?: string;
  rawType: string;
}

function OnlineExamContent() {
  const db = useFirestore();
  const router = useRouter();
  const searchParams = useSearchParams();
  const examId = searchParams.get('id');

  const [loading, setLoading] = useState(true);
  const [examMeta, setExamMeta] = useState<any>(null);
  const [mcqList, setMcqList] = useState<ParsedMcqQuestion[]>([]);

  // Student Info State
  const [studentName, setStudentName] = useState('');
  const [studentRoll, setStudentRoll] = useState('');
  const [studentClass, setStudentClass] = useState('');
  const [isExamStarted, setIsExamStarted] = useState(false);

  // Exam Progress State
  const [userAnswers, setUserAnswers] = useState<Record<string, string>>({});
  const [timeLeftSeconds, setTimeLeftSeconds] = useState(20 * 60); // Default 20 mins
  const [initialDurationSeconds, setInitialDurationSeconds] = useState(20 * 60);
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [confirmSubmitOpen, setConfirmSubmitOpen] = useState(false);
  const [isSavingResult, setIsSavingResult] = useState(false);

  // Timer Ref
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // 1. Fetch Exam Data
  useEffect(() => {
    async function fetchExam() {
      if (!db || !examId) {
        setLoading(false);
        return;
      }
      try {
        const docRef = doc(db, 'questions', examId);
        const snap = await getDoc(docRef);
        if (snap.exists()) {
          const data = snap.data();
          setExamMeta(data);
          if (data.classId) setStudentClass(data.classId);

          // Parse questions to extract MCQ options
          const rawQuestions = data.questions || [];
          const parsed: ParsedMcqQuestion[] = [];

          rawQuestions.forEach((q: any, idx: number) => {
            const qId = q.id || `q_${idx}`;
            if (q.type === 'mcq') {
              const qText = q.mcqQuestion || q.content || `প্রশ্ন ${idx + 1}`;
              const opts = [
                { key: 'ক', label: 'ক', text: q.optA || '' },
                { key: 'খ', label: 'খ', text: q.optB || '' },
                { key: 'গ', label: 'গ', text: q.optC || '' },
                { key: 'ঘ', label: 'ঘ', text: q.optD || '' },
              ].filter(o => o.text.trim().length > 0);

              parsed.push({
                id: qId,
                questionText: qText,
                options: opts.length > 0 ? opts : [
                  { key: 'ক', label: 'ক', text: 'অপশন ১' },
                  { key: 'খ', label: 'খ', text: 'অপশন ২' },
                  { key: 'গ', label: 'গ', text: 'অপশন ৩' },
                  { key: 'ঘ', label: 'ঘ', text: 'অপশন ৪' },
                ],
                correctAnswerKey: q.correctAnswer || 'ক', // default to key or first option
                rawType: 'mcq'
              });
            } else if (q.content && (q.content.includes('ক.') || q.content.includes('খ.'))) {
              // Extract from multiline text
              const lines = q.content.split('\n');
              const qText = lines[0] || '';
              const opts: { key: string; label: string; text: string }[] = [];
              lines.slice(1).forEach((l: string) => {
                const trimmed = l.trim();
                if (trimmed.startsWith('ক.') || trimmed.startsWith('ক)')) opts.push({ key: 'ক', label: 'ক', text: trimmed.substring(2).trim() });
                else if (trimmed.startsWith('খ.') || trimmed.startsWith('খ)')) opts.push({ key: 'খ', label: 'খ', text: trimmed.substring(2).trim() });
                else if (trimmed.startsWith('গ.') || trimmed.startsWith('গ)')) opts.push({ key: 'গ', label: 'গ', text: trimmed.substring(2).trim() });
                else if (trimmed.startsWith('ঘ.') || trimmed.startsWith('ঘ)')) opts.push({ key: 'ঘ', label: 'ঘ', text: trimmed.substring(2).trim() });
              });
              if (opts.length >= 2) {
                parsed.push({
                  id: qId,
                  questionText: qText,
                  options: opts,
                  correctAnswerKey: 'ক',
                  rawType: 'mcq'
                });
              }
            }
          });

          setMcqList(parsed);

          // Calculate duration based on question count: 1 minute per question (minimum 10 mins)
          const duration = Math.max(10, parsed.length > 0 ? parsed.length : 15) * 60;
          setTimeLeftSeconds(duration);
          setInitialDurationSeconds(duration);
        }
      } catch (e) {
        console.error('Failed to load exam:', e);
        toast({ variant: 'destructive', title: 'ত্রুটি', description: 'প্রশ্নপত্র লোড করা যায়নি।' });
      } finally {
        setLoading(false);
      }
    }

    fetchExam();
  }, [db, examId]);

  // 2. Countdown Timer
  useEffect(() => {
    if (!isExamStarted || isSubmitted) {
      if (timerRef.current) clearInterval(timerRef.current);
      return;
    }

    timerRef.current = setInterval(() => {
      setTimeLeftSeconds(prev => {
        if (prev <= 1) {
          if (timerRef.current) clearInterval(timerRef.current);
          handleAutoSubmit();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [isExamStarted, isSubmitted]);

  const handleSelectOption = (qId: string, optKey: string) => {
    if (isSubmitted) return;
    setUserAnswers(prev => ({
      ...prev,
      [qId]: optKey
    }));
  };

  const handleStartExam = () => {
    if (!studentName.trim() || !studentRoll.trim()) {
      toast({
        variant: 'destructive',
        title: 'তথ্য দিন',
        description: 'অনুগ্রহ করে শিক্ষার্থীর নাম ও রোল নম্বর লিখুন।'
      });
      return;
    }
    setIsExamStarted(true);
    toast({
      title: 'পরীক্ষা শুরু হয়েছে! ⏱️',
      description: 'সময় গণনা শুরু হয়েছে। সকল প্রশ্নের উত্তর দিয়ে সাবমিট করুন।'
    });
  };

  const handleAutoSubmit = () => {
    toast({
      variant: 'destructive',
      title: 'সময় শেষ!',
      description: 'আপনার পরীক্ষার সময় শেষ হয়েছে। উত্তরপত্র স্বয়ংক্রিয়ভাবে জমা হয়েছে।'
    });
    finalizeSubmit();
  };

  const finalizeSubmit = async () => {
    setIsSubmitted(true);
    setConfirmSubmitOpen(false);

    // Save exam submission to Firestore
    if (db) {
      setIsSavingResult(true);
      try {
        const scoreData = calculateScore();
        await addDoc(collection(db, 'exam-submissions'), {
          examId: examId || 'direct',
          examTitle: examMeta?.exam || 'অনলাইন পরীক্ষা',
          subject: examMeta?.subject || 'সাধারণ',
          studentName,
          studentRoll,
          studentClass: studentClass || examMeta?.classId || 'সাধারণ',
          totalQuestions: mcqList.length,
          correctCount: scoreData.correct,
          wrongCount: scoreData.wrong,
          unansweredCount: scoreData.unanswered,
          scorePercentage: scoreData.percentage,
          userAnswers,
          submittedAt: serverTimestamp(),
        });
      } catch (e) {
        console.warn('Could not save submission to database:', e);
      } finally {
        setIsSavingResult(false);
      }
    }
  };

  // 3. Auto-Grading Calculation
  const calculateScore = () => {
    let correct = 0;
    let wrong = 0;
    let unanswered = 0;

    mcqList.forEach(q => {
      const ans = userAnswers[q.id];
      if (!ans) {
        unanswered++;
      } else if (ans === q.correctAnswerKey) {
        correct++;
      } else {
        wrong++;
      }
    });

    const total = mcqList.length || 1;
    const percentage = Math.round((correct / total) * 100);

    return { correct, wrong, unanswered, percentage };
  };

  const formatTimer = (secs: number) => {
    const m = Math.floor(secs / 60);
    const s = secs % 60;
    return `${toBengaliNumber(m)} মিনিট ${toBengaliNumber(s < 10 ? '0' + s : s)} সেকেন্ড`;
  };

  const scoreStats = useMemo(() => {
    if (!isSubmitted) return null;
    return calculateScore();
  }, [isSubmitted, userAnswers, mcqList]);

  const answeredCount = Object.keys(userAnswers).length;
  const totalCount = mcqList.length;

  if (loading) {
    return (
      <div className="min-h-[70vh] flex flex-col items-center justify-center space-y-4 font-kalpurush">
        <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin" />
        <p className="text-base font-bold text-slate-700">অনলাইন পরীক্ষার প্রশ্নপত্র লোড হচ্ছে...</p>
      </div>
    );
  }

  // Fallback demo questions if opened without exam ID or questions empty
  const activeQuestions = mcqList.length > 0 ? mcqList : [
    {
      id: 'demo_1',
      questionText: '১. বলের এস.আই (S.I) একক কোনটি?',
      options: [
        { key: 'ক', label: 'ক', text: 'নিউটন (N)' },
        { key: 'খ', label: 'খ', text: 'জুল (J)' },
        { key: 'গ', label: 'গ', text: 'প্যাসকেল (Pa)' },
        { key: 'ঘ', label: 'ঘ', text: 'ওয়াট (W)' },
      ],
      correctAnswerKey: 'ক',
      rawType: 'mcq'
    },
    {
      id: 'demo_2',
      questionText: '২. সমত্বরণে চলমান কোনো বস্তুর বেগ ও সময়ের সম্পর্ক কেমন?',
      options: [
        { key: 'ক', label: 'ক', text: 'বেগ সময়ের সাথে রৈখিকভাবে বৃদ্ধি পায়' },
        { key: 'খ', label: 'খ', text: 'বেগ অপরিবর্তিত থাকে' },
        { key: 'গ', label: 'গ', text: 'বেগ সময়ের বর্গের সমানুপাতিক' },
        { key: 'ঘ', label: 'ঘ', text: 'ত্বরণ সর্বদা শূন্য হয়' },
      ],
      correctAnswerKey: 'ক',
      rawType: 'mcq'
    },
    {
      id: 'demo_3',
      questionText: '৩. কাজ করার সামর্থ্যকে কী বলে?',
      options: [
        { key: 'ক', label: 'ক', text: 'শক্তি' },
        { key: 'খ', label: 'খ', text: 'ক্ষমতা' },
        { key: 'গ', label: 'গ', text: 'বল' },
        { key: 'ঘ', label: 'ঘ', text: 'ভরবেগ' },
      ],
      correctAnswerKey: 'ক',
      rawType: 'mcq'
    }
  ];

  return (
    <div className="max-w-4xl mx-auto px-4 py-8 font-kalpurush space-y-6">
      {/* Header */}
      <header className="flex flex-col sm:flex-row items-center justify-between gap-4 border-b pb-5">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="h-10 w-10">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-indigo-950 flex items-center gap-2">
              <GraduationCap className="w-7 h-7 text-indigo-600" />
              {examMeta?.institution || 'অনলাইন পরীক্ষা কেন্দ্র'}
            </h1>
            <p className="text-xs font-bold text-slate-600 mt-0.5">
              {examMeta?.exam || 'সাপ্তাহিক মূল্যায়ন পরীক্ষা'} • বিষয়: {examMeta?.subject || 'সাধারণ'} • {examMeta?.classId ? `${examMeta.classId} শ্রেণি` : ''}
            </p>
          </div>
        </div>

        {isExamStarted && !isSubmitted && (
          <div className={cn(
            "flex items-center gap-2 px-4 py-2 rounded-xl border-2 font-black shadow-sm transition-all",
            timeLeftSeconds < 120 
              ? "bg-rose-50 text-rose-700 border-rose-300 animate-pulse" 
              : "bg-indigo-50 text-indigo-800 border-indigo-200"
          )}>
            <Clock className="w-5 h-5 text-indigo-600" />
            <div className="text-right">
              <p className="text-[10px] uppercase font-bold text-slate-500">অবশিষ্ট সময়</p>
              <p className="text-sm font-black">{formatTimer(timeLeftSeconds)}</p>
            </div>
          </div>
        )}
      </header>

      {/* Step 1: Pre-Exam Identification Card */}
      {!isExamStarted && !isSubmitted && (
        <Card className="border-2 border-indigo-200 shadow-xl bg-gradient-to-b from-white to-slate-50">
          <CardHeader className="bg-indigo-50/70 border-b">
            <CardTitle className="text-lg font-black text-indigo-950 flex items-center gap-2">
              <User className="w-5 h-5 text-indigo-600" /> শিক্ষার্থীর তথ্য ও পরীক্ষার নিয়মাবলী
            </CardTitle>
            <CardDescription className="font-bold text-slate-600">
              অনলাইন পরীক্ষায় অংশগ্রহণের জন্য আপনার নাম ও রোল নম্বর লিখুন।
            </CardDescription>
          </CardHeader>
          <CardContent className="p-6 space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">শিক্ষার্থীর নাম *</label>
                <Input
                  placeholder="যেমন: মোঃ সাকিব হাসান"
                  value={studentName}
                  onChange={e => setStudentName(e.target.value)}
                  className="font-bold h-11 border-2 border-slate-200 focus:border-indigo-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-black text-slate-700">রোল নম্বর *</label>
                <Input
                  placeholder="যেমন: ০১ বা 01"
                  value={studentRoll}
                  onChange={e => setStudentRoll(e.target.value)}
                  className="font-bold h-11 border-2 border-slate-200 focus:border-indigo-500"
                />
              </div>
            </div>

            <div className="p-4 bg-amber-50/80 border border-amber-300 rounded-xl space-y-2 text-xs font-bold text-amber-950">
              <p className="font-black flex items-center gap-1.5 text-amber-900">
                <AlertCircle className="w-4 h-4 text-amber-600" /> পরীক্ষার নিয়মাবলী:
              </p>
              <ul className="list-disc list-inside space-y-1 text-amber-900/90 pl-1">
                <li>মোট প্রশ্ন সংখ্যা: {toBengaliNumber(activeQuestions.length)}টি বহুনির্বাচনী প্রশ্ন।</li>
                <li>নির্ধারিত সময়: {formatTimer(initialDurationSeconds)}।</li>
                <li>প্রতিটি প্রশ্নের জন্য একটি মাত্র সঠিক উত্তর নির্বাচন করুন।</li>
                <li>সময় শেষ হওয়ার আগেই সাবমিট বাটনে ক্লিক করে পরীক্ষা সম্পন্ন করতে হবে।</li>
              </ul>
            </div>

            <Button
              onClick={handleStartExam}
              className="w-full h-12 bg-indigo-600 hover:bg-indigo-700 text-white font-black text-base shadow-lg transition-all"
            >
              পরীক্ষা শুরু করুন 🚀
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Step 2: Live Exam Interface */}
      {isExamStarted && !isSubmitted && (
        <div className="space-y-6">
          {/* Progress & Quick Palette */}
          <div className="bg-white p-4 rounded-xl border-2 border-slate-200 shadow-sm space-y-3">
            <div className="flex items-center justify-between text-xs font-bold">
              <span className="text-slate-600">
                উত্তর দেওয়া হয়েছে: <strong className="text-indigo-600">{toBengaliNumber(answeredCount)}</strong> / {toBengaliNumber(totalCount)}টি
              </span>
              <span className="text-slate-500">
                অগ্রগতি: {toBengaliNumber(Math.round((answeredCount / (totalCount || 1)) * 100))}%
              </span>
            </div>
            <Progress value={(answeredCount / (totalCount || 1)) * 100} className="h-2.5 bg-slate-100" />

            {/* Jump Question Bubbles */}
            <div className="flex flex-wrap gap-1.5 pt-2 border-t">
              {activeQuestions.map((q, idx) => {
                const isAnswered = !!userAnswers[q.id];
                return (
                  <button
                    key={q.id}
                    type="button"
                    onClick={() => {
                      const el = document.getElementById(`q_card_${q.id}`);
                      if (el) el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }}
                    className={cn(
                      "w-8 h-8 rounded-lg text-xs font-black transition-all flex items-center justify-center",
                      isAnswered 
                        ? "bg-indigo-600 text-white shadow-xs" 
                        : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                    )}
                  >
                    {toBengaliNumber(idx + 1)}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question Cards List */}
          <div className="space-y-4">
            {activeQuestions.map((q, idx) => {
              const selectedOpt = userAnswers[q.id];
              return (
                <Card 
                  key={q.id} 
                  id={`q_card_${q.id}`}
                  className={cn(
                    "border-2 transition-all shadow-sm",
                    selectedOpt ? "border-indigo-400 bg-white" : "border-slate-200 bg-slate-50/50"
                  )}
                >
                  <CardHeader className="py-3 px-5 border-b bg-slate-50 flex flex-row items-center justify-between">
                    <p className="font-black text-sm text-slate-900">
                      প্রশ্ন নং {toBengaliNumber(idx + 1)}
                    </p>
                    {selectedOpt ? (
                      <Badge className="bg-indigo-100 text-indigo-700 font-bold border-indigo-200">উত্তর সম্পন্ন</Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500 font-bold">বাকি আছে</Badge>
                    )}
                  </CardHeader>
                  <CardContent className="p-5 space-y-4">
                    <p className="font-bold text-base text-slate-950 leading-relaxed">
                      {q.questionText}
                    </p>

                    {/* Options Grid */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                      {q.options.map((opt) => {
                        const isChosen = selectedOpt === opt.key;
                        return (
                          <div
                            key={opt.key}
                            onClick={() => handleSelectOption(q.id, opt.key)}
                            className={cn(
                              "flex items-center gap-3 p-3 rounded-xl border-2 transition-all cursor-pointer font-bold text-sm",
                              isChosen
                                ? "border-indigo-600 bg-indigo-50 text-indigo-950 shadow-xs"
                                : "border-slate-200 bg-white hover:border-slate-300 text-slate-800"
                            )}
                          >
                            <div className={cn(
                              "w-7 h-7 rounded-full flex items-center justify-center text-xs font-black shrink-0 transition-all",
                              isChosen 
                                ? "bg-indigo-600 text-white" 
                                : "bg-slate-100 text-slate-700 border border-slate-300"
                            )}>
                              {opt.label}
                            </div>
                            <span className="flex-1">{opt.text}</span>
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>

          {/* Submit Action */}
          <div className="flex justify-end pt-4">
            <Button
              onClick={() => setConfirmSubmitOpen(true)}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black px-8 h-12 text-base shadow-lg gap-2"
            >
              <Send className="w-5 h-5" /> পরীক্ষা সম্পন্ন ও সাবমিট করুন
            </Button>
          </div>

          {/* Confirmation Dialog */}
          <Dialog open={confirmSubmitOpen} onOpenChange={setConfirmSubmitOpen}>
            <DialogContent className="font-kalpurush max-w-md">
              <DialogHeader>
                <DialogTitle className="text-lg font-black text-slate-900">
                  উত্তরপত্র জমা দিতে নিশ্চিত?
                </DialogTitle>
              </DialogHeader>
              <div className="py-2 space-y-2 text-xs font-bold text-slate-600">
                <p>আপনি মোট <strong>{toBengaliNumber(activeQuestions.length)}টি</strong> প্রশ্নের মধ্যে <strong>{toBengaliNumber(answeredCount)}টি</strong> প্রশ্নের উত্তর দিয়েছেন।</p>
                {answeredCount < activeQuestions.length && (
                  <p className="text-rose-600 font-bold">
                    ⚠️ {toBengaliNumber(activeQuestions.length - answeredCount)}টি প্রশ্নের উত্তর এখনো দেওয়া হয়নি!
                  </p>
                )}
                <p>সাবমিট করার পর ফলাফল তাৎক্ষণিকভাবে প্রদর্শিত হবে।</p>
              </div>
              <DialogFooter className="gap-2 sm:gap-0">
                <Button variant="outline" onClick={() => setConfirmSubmitOpen(false)}>ফিরে যান</Button>
                <Button onClick={finalizeSubmit} className="bg-emerald-600 hover:bg-emerald-700 text-white font-bold">
                  হ্যাঁ, সাবমিট করুন
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>
      )}

      {/* Step 3: Instant Results & Auto-Graded Review */}
      {isSubmitted && scoreStats && (
        <div className="space-y-6">
          {/* Result Card */}
          <Card className="border-2 border-indigo-200 shadow-xl overflow-hidden bg-white">
            <div className="bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-700 p-6 sm:p-8 text-white text-center space-y-2">
              <Award className="w-16 h-16 text-amber-300 mx-auto animate-bounce" />
              <h2 className="text-2xl sm:text-3xl font-black">
                {scoreStats.percentage >= 80 ? '🎉 অভিনন্দন! চমৎকার ফলাফল!' : scoreStats.percentage >= 50 ? '👏 ভালো ফলাফল হয়েছে!' : '📚 নিয়মিত আরও অনুশীলন প্রয়োজন!'}
              </h2>
              <p className="text-sm font-bold text-indigo-100">
                শিক্ষার্থী: {studentName} • রোল: {toBengaliNumber(studentRoll)} • বিষয়: {examMeta?.subject || 'সাধারণ'}
              </p>
            </div>

            <CardContent className="p-6 sm:p-8 space-y-6">
              {/* Score Badges */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 text-center">
                <div className="p-4 bg-slate-50 border-2 rounded-xl">
                  <p className="text-xs font-bold text-slate-500 uppercase">মোট প্রশ্ন</p>
                  <p className="text-2xl font-black text-slate-900 mt-1">{toBengaliNumber(activeQuestions.length)}</p>
                </div>
                <div className="p-4 bg-emerald-50 border-2 border-emerald-200 rounded-xl">
                  <p className="text-xs font-bold text-emerald-700 uppercase">সঠিক উত্তর</p>
                  <p className="text-2xl font-black text-emerald-700 mt-1">{toBengaliNumber(scoreStats.correct)}</p>
                </div>
                <div className="p-4 bg-rose-50 border-2 border-rose-200 rounded-xl">
                  <p className="text-xs font-bold text-rose-700 uppercase">ভুল উত্তর</p>
                  <p className="text-2xl font-black text-rose-700 mt-1">{toBengaliNumber(scoreStats.wrong)}</p>
                </div>
                <div className="p-4 bg-indigo-50 border-2 border-indigo-200 rounded-xl">
                  <p className="text-xs font-bold text-indigo-700 uppercase">প্রাপ্ত নম্বর (%)</p>
                  <p className="text-2xl font-black text-indigo-700 mt-1">{toBengaliNumber(scoreStats.percentage)}%</p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-wrap items-center justify-between gap-3 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => window.print()}
                  className="gap-2 font-bold border-2 border-slate-300"
                >
                  <Printer className="w-4 h-4" /> ফলাফল প্রিন্ট করুন
                </Button>
                <Button
                  onClick={() => {
                    setIsSubmitted(false);
                    setIsExamStarted(false);
                    setUserAnswers({});
                    setTimeLeftSeconds(initialDurationSeconds);
                  }}
                  className="gap-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white"
                >
                  <RotateCcw className="w-4 h-4" /> পুনরায় পরীক্ষা দিন
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Detailed Question Review */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-indigo-950 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-indigo-600" /> বিস্তারিত উত্তরপত্র পর্যালোচনা (Review)
            </h3>

            {activeQuestions.map((q, idx) => {
              const userChosen = userAnswers[q.id];
              const isCorrect = userChosen === q.correctAnswerKey;
              return (
                <Card 
                  key={q.id}
                  className={cn(
                    "border-2 transition-all",
                    !userChosen 
                      ? "border-slate-300 bg-slate-50" 
                      : isCorrect 
                        ? "border-emerald-300 bg-emerald-50/20" 
                        : "border-rose-300 bg-rose-50/20"
                  )}
                >
                  <CardHeader className="py-2.5 px-4 border-b flex flex-row items-center justify-between bg-white/60">
                    <p className="font-black text-xs text-slate-800">
                      প্রশ্ন নং {toBengaliNumber(idx + 1)}
                    </p>
                    {isCorrect ? (
                      <Badge className="bg-emerald-600 text-white gap-1 font-bold">
                        <Check className="w-3.5 h-3.5" /> সঠিক (+১)
                      </Badge>
                    ) : userChosen ? (
                      <Badge variant="destructive" className="gap-1 font-bold">
                        <XCircle className="w-3.5 h-3.5" /> ভুল (০)
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-slate-500 font-bold">
                        উত্তর দেওয়া হয়নি (০)
                      </Badge>
                    )}
                  </CardHeader>
                  <CardContent className="p-4 space-y-3">
                    <p className="font-bold text-sm text-slate-900">{q.questionText}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs font-bold">
                      {q.options.map(opt => {
                        const isUserPick = userChosen === opt.key;
                        const isRightAnswer = opt.key === q.correctAnswerKey;
                        return (
                          <div 
                            key={opt.key}
                            className={cn(
                              "p-2.5 rounded-lg border flex items-center gap-2",
                              isRightAnswer
                                ? "bg-emerald-100/70 border-emerald-400 text-emerald-950 font-black"
                                : isUserPick
                                  ? "bg-rose-100/70 border-rose-400 text-rose-950"
                                  : "bg-white border-slate-200 text-slate-700 opacity-80"
                            )}
                          >
                            <span className={cn(
                              "w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black shrink-0",
                              isRightAnswer 
                                ? "bg-emerald-600 text-white" 
                                : isUserPick 
                                  ? "bg-rose-600 text-white" 
                                  : "bg-slate-200 text-slate-800"
                            )}>
                              {opt.label}
                            </span>
                            <span>{opt.text}</span>
                            {isRightAnswer && <span className="ml-auto text-emerald-700 text-[10px] font-black">✓ সঠিক উত্তর</span>}
                            {isUserPick && !isRightAnswer && <span className="ml-auto text-rose-700 text-[10px] font-black">✗ আপনার উত্তর</span>}
                          </div>
                        );
                      })}
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

export default function OnlineExamPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">অনলাইন পরীক্ষা লোড হচ্ছে...</div>}>
      <OnlineExamContent />
    </Suspense>
  );
}

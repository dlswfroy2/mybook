"use client";

import React, { useState, useRef, useMemo, useEffect } from 'react';
import { cn } from '@/lib/utils';
import { 
  Camera, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Award, 
  Printer, 
  Save, 
  RefreshCw, 
  Sparkles,
  ArrowRight,
  User,
  Sliders,
  ChevronRight,
  Eye,
  FileText
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { scanAndEvaluateOmr, ScanOmrOutput } from '@/ai/flows/scan-omr-flow';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit, 10)]);
}

interface OmrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionCount: number;
  examTitle: string;
  examSubtitle: string;
  defaultAnswerKey?: Record<number, string>;
}

export function OmrScannerDialog({
  open,
  onOpenChange,
  questionCount = 30,
  examTitle,
  examSubtitle,
  defaultAnswerKey = {},
}: OmrScannerDialogProps) {
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // States
  const [step, setStep] = useState<'input' | 'scanning' | 'result'>('input');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [negativeMark, setNegativeMark] = useState<number>(0);
  const [activeTab, setActiveTab] = useState<'scan' | 'answerKey'>('scan');

  // Answer Key state
  const [answerKey, setAnswerKey] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (let i = 1; i <= questionCount; i++) {
      initial[i] = defaultAnswerKey[i] || '';
    }
    return initial;
  });

  // Saved answer keys from Firestore
  const [savedAnswerKeys, setSavedAnswerKeys] = useState<any[]>([]);
  const [loadedKeyId, setLoadedKeyId] = useState('');

  // Scanned evaluation result
  const [result, setResult] = useState<ScanOmrOutput | null>(null);
  const [editableStudentName, setEditableStudentName] = useState('');
  const [editableRollNumber, setEditableRollNumber] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const bubbleOptions = ['ক', 'খ', 'গ', 'ঘ'];

  // Load saved answer keys
  useEffect(() => {
    async function loadKeys() {
      if (!db) return;
      try {
        const q = query(collection(db, 'omr_answer_keys'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setSavedAnswerKeys(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('উত্তরমালা লোড করতে সমস্যা:', e);
      }
    }
    if (open) loadKeys();
  }, [db, open]);

  // Handle image selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: 'অনুগ্রহ করে একটি ছবি নির্বাচন করুন।' });
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUri = event.target?.result as string;
      setImagePreview(dataUri);
    };
    reader.readAsDataURL(file);
  };

  // Perform AI Scan
  const handleStartScan = async () => {
    if (!imagePreview) {
      toast({ variant: 'destructive', title: 'ছবি প্রয়োজন', description: 'অনুগ্রহ করে মোবাইল দিয়ে ওএমআর শিটের ছবি তুলুন।' });
      return;
    }

    setStep('scanning');
    try {
      const scanRes = await scanAndEvaluateOmr({
        imageUri: imagePreview,
        questionCount,
        answerKey,
        negativeMark,
      });

      setResult(scanRes);
      setEditableStudentName(scanRes.studentName);
      setEditableRollNumber(scanRes.rollNumber);
      setStep('result');
      toast({ title: 'স্ক্যান সম্পন্ন! 🎉', description: `প্রাপ্ত নম্বর: ${scanRes.obtainedMarks} / ${scanRes.totalMarks}` });
    } catch (err: any) {
      console.error(err);
      setStep('input');
      toast({
        variant: 'destructive',
        title: 'স্ক্যান ব্যর্থ হয়েছে',
        description: err?.message || 'ওএমআর শিট পড়া সম্ভব হয়নি। আলো বাড়িয়ে পুনরায় সোজাভাবে ছবি তুলুন।',
      });
    }
  };

  // Save result to database
  const handleSaveResult = async () => {
    if (!result || !db) return;
    setIsSaving(true);
    try {
      await addDoc(collection(db, 'omr_evaluations'), {
        userId: user?.uid || 'anonymous',
        examTitle,
        examSubtitle,
        studentName: editableStudentName || result.studentName || 'অজ্ঞাত',
        rollNumber: editableRollNumber || result.rollNumber || 'N/A',
        subjectCode: result.subjectCode,
        setCode: result.setCode,
        totalQuestions: result.totalQuestions,
        attemptedCount: result.attemptedCount,
        correctCount: result.correctCount,
        wrongCount: result.wrongCount,
        unansweredCount: result.unansweredCount,
        obtainedMarks: result.obtainedMarks,
        totalMarks: result.totalMarks,
        percentage: result.percentage,
        scannedAt: serverTimestamp(),
      });
      toast({ title: 'সংরক্ষিত হয়েছে! 💾', description: 'ফলাফল সফলভাবে ডাটাবেজে সেভ হয়েছে।' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: 'ফলাফল সংরক্ষণ করা যায়নি।' });
    } finally {
      setIsSaving(false);
    }
  };

  // Reset for next scan
  const handleResetForNext = () => {
    setImagePreview(null);
    setResult(null);
    setStep('input');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[92vh] overflow-y-auto font-kalpurush p-4 sm:p-6 bg-slate-50 border-2 border-indigo-200">
        <DialogHeader className="border-b pb-3">
          <DialogTitle className="text-xl font-black text-indigo-900 flex items-center justify-between">
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" /> মোবাইল ক্যামেরা ওএমআর স্ক্যানার ও মূল্যায়ন
            </span>
            <Badge variant="outline" className="text-xs bg-indigo-50 border-indigo-300 font-bold text-indigo-700">
              {toBengaliNumber(questionCount)} টি প্রশ্ন
            </Badge>
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-slate-600">
            মোবাইল ক্যামেরা দিয়ে উত্তরপত্রের ছবি তুলুন। AI স্বয়ংক্রিয়ভাবে রোল, সেট কোড এবং প্রতিটি বৃত্তের উত্তর বের করে ফলাফল তৈরি করবে।
          </DialogDescription>
        </DialogHeader>

        {/* ── STEP 1: INPUT & ANSWER KEY SETUP ── */}
        {step === 'input' && (
          <div className="space-y-4 py-2">
            {/* Tabs: ছবি স্ক্যান vs সঠিক উত্তরমালা */}
            <div className="flex bg-slate-200/80 p-1 rounded-xl">
              <button
                type="button"
                onClick={() => setActiveTab('scan')}
                className={cn(
                  "flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5",
                  activeTab === 'scan' ? "bg-white text-indigo-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <Camera className="w-4 h-4 text-indigo-600" /> ১. ওএমআর ছবি তুলুন
              </button>
              <button
                type="button"
                onClick={() => setActiveTab('answerKey')}
                className={cn(
                  "flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5",
                  activeTab === 'answerKey' ? "bg-white text-indigo-800 shadow-sm" : "text-slate-600 hover:text-slate-900"
                )}
              >
                <FileText className="w-4 h-4 text-emerald-600" /> ২. সঠিক উত্তরমালা (Answer Key)
                {Object.values(answerKey).filter(Boolean).length > 0 && (
                  <span className="w-2 h-2 rounded-full bg-emerald-500" />
                )}
              </button>
            </div>

            {/* Tab 1: Image Capture */}
            {activeTab === 'scan' && (
              <div className="space-y-4">
                {/* Hidden native file and camera inputs */}
                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleFileChange}
                  className="hidden"
                />
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  onChange={handleFileChange}
                  className="hidden"
                />

                {!imagePreview ? (
                  <div className="border-2 border-dashed border-indigo-300 rounded-2xl p-6 text-center bg-white hover:bg-indigo-50/40 transition-colors">
                    <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center mb-3 shadow-inner">
                      <Camera className="w-8 h-8" />
                    </div>
                    <h3 className="font-black text-base text-slate-800 mb-1">
                      মোবাইল ক্যামেরা দিয়ে ওএমআর শিটের ছবি তুলুন
                    </h3>
                    <p className="text-xs text-slate-500 font-bold max-w-sm mx-auto mb-5 leading-relaxed">
                      কাগজের উপর কোনো ছায়া না ফেলে সোজাভাবে পুরো ওএমআর শিট ফ্রেমের ভেতরে রেখে ছবি তুলুন।
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
                      <Button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm h-11 px-6 shadow-md gap-2"
                      >
                        <Camera className="w-5 h-5" /> ক্যামেরা চালু করুন
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full sm:w-auto font-black text-sm h-11 px-5 border-slate-300 gap-2"
                      >
                        <Upload className="w-4 h-4" /> গ্যালারি / ফাইল থেকে আপলোড
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-indigo-300 rounded-2xl p-3 bg-white space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4 text-emerald-600" /> ওএমআর ছবি প্রস্তুত
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => setImagePreview(null)}
                        className="text-xs text-rose-600 hover:bg-rose-50 font-bold h-7"
                      >
                        অন্য ছবি তুলুন
                      </Button>
                    </div>
                    <div className="max-h-[300px] overflow-hidden rounded-xl border bg-slate-900 flex items-center justify-center">
                      <img src={imagePreview} alt="OMR Sheet" className="max-h-[300px] object-contain" />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="text-[11px] font-bold text-slate-500">
                        সঠিক উত্তরমালা সেট করেছেন: <span className="text-emerald-700 font-black">{toBengaliNumber(Object.values(answerKey).filter(Boolean).length)} / {toBengaliNumber(questionCount)} টি</span>
                      </div>
                      <Button
                        type="button"
                        onClick={handleStartScan}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-sm h-10 px-6 shadow-md gap-2"
                      >
                        <Sparkles className="w-4 h-4" /> ওএমআর মূল্যায়ন শুরু করুন
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Tab 2: Answer Key Setup */}
            {activeTab === 'answerKey' && (
              <div className="space-y-3 bg-white p-4 rounded-2xl border">
                <div className="flex flex-wrap items-center justify-between border-b pb-2 gap-2">
                  <div>
                    <h4 className="font-black text-sm text-slate-800">মাস্টার উত্তরমালা (সঠিক উত্তর)</h4>
                    <p className="text-[11px] text-slate-500 font-bold">প্রতিটি প্রশ্নের সঠিক উত্তরের বৃত্তে ক্লিক করে সিলেক্ট করুন।</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {savedAnswerKeys.length > 0 && (
                      <select
                        value={loadedKeyId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setLoadedKeyId(id);
                          if (!id) return;
                          const found = savedAnswerKeys.find(k => k.id === id);
                          if (found && found.answerKey) {
                            const loaded: Record<number, string> = {};
                            Object.entries(found.answerKey).forEach(([k, v]) => {
                              loaded[Number(k)] = v as string;
                            });
                            setAnswerKey(prev => ({ ...prev, ...loaded }));
                          }
                        }}
                        className="h-8 text-xs font-bold border rounded-md px-2 bg-indigo-50 max-w-[200px]"
                      >
                        <option value="">📂 সেভ করা উত্তরমালা লোড করুন</option>
                        {savedAnswerKeys.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.examTitle} / {k.examSubtitle}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="text-[11px] font-black text-slate-600">নেগেটিভ মার্ক:</label>
                    <select
                      value={negativeMark}
                      onChange={(e) => setNegativeMark(parseFloat(e.target.value))}
                      className="h-8 text-xs font-bold border rounded-md px-2 bg-slate-50"
                    >
                      <option value="0">০.০০ (কোনো নম্বর কাটা যাবে না)</option>
                      <option value="0.25">- ০.২৫ নম্বর</option>
                      <option value="0.50">- ০.৫০ নম্বর</option>
                      <option value="1">- ১.০০ নম্বর</option>
                    </select>
                  </div>
                </div>

                {/* 30 Questions Answer Key Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-2 max-h-[340px] overflow-y-auto pr-1">
                  {Array.from({ length: questionCount }).map((_, i) => {
                    const q = i + 1;
                    const currentVal = answerKey[q] || '';
                    return (
                      <div key={q} className="border rounded-lg p-1.5 bg-slate-50 flex items-center justify-between text-xs">
                        <span className="font-black text-slate-800 w-6">{toBengaliNumber(q)}.</span>
                        <div className="flex gap-1">
                          {bubbleOptions.map((opt) => (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => {
                                setAnswerKey(prev => ({
                                  ...prev,
                                  [q]: prev[q] === opt ? '' : opt
                                }));
                              }}
                              className={cn(
                                "w-6 h-6 rounded-full border text-[10px] font-black transition-all flex items-center justify-center",
                                currentVal === opt
                                  ? "bg-emerald-600 text-white border-emerald-700 shadow-sm scale-110"
                                  : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
                              )}
                            >
                              {opt}
                            </button>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>

                <div className="pt-2 border-t flex justify-between items-center">
                  <span className="text-xs font-bold text-slate-500">
                    মোট সিলেক্ট করা হয়েছে: {toBengaliNumber(Object.values(answerKey).filter(Boolean).length)} টি
                  </span>
                  <Button
                    type="button"
                    onClick={() => setActiveTab('scan')}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-9 px-4"
                  >
                    ছবি স্ক্যান করতে যান <ArrowRight className="w-3.5 h-3.5 ml-1" />
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ── STEP 2: SCANNING IN PROGRESS ── */}
        {step === 'scanning' && (
          <div className="py-12 text-center space-y-4">
            <div className="relative w-20 h-20 mx-auto">
              <div className="absolute inset-0 rounded-full border-4 border-indigo-200 animate-ping opacity-30"></div>
              <div className="w-20 h-20 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg relative">
                <Loader2 className="w-10 h-10 animate-spin" />
              </div>
            </div>
            <div className="space-y-1">
              <h3 className="font-black text-lg text-indigo-950">ওএমআর শিট বিশ্লেষণ করা হচ্ছে...</h3>
              <p className="text-xs font-bold text-slate-600 max-w-sm mx-auto">
                AI মোবাইল ক্যামেরা থেকে শিক্ষার্থীর রোল নম্বর, বিষয় কোড এবং প্রতিটি বৃত্তের উত্তর শনাক্ত করছে।
              </p>
            </div>
          </div>
        )}

        {/* ── STEP 3: RESULT EVALUATION ── */}
        {step === 'result' && result && (
          <div className="space-y-4 py-2 animate-in fade-in duration-300">
            {/* Header Identity Card */}
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-indigo-900 text-white p-3 rounded-xl shadow-sm">
              <div>
                <span className="text-[10px] text-indigo-200 font-bold">শিক্ষার্থীর নাম:</span>
                <Input
                  value={editableStudentName}
                  onChange={(e) => setEditableStudentName(e.target.value)}
                  placeholder="নাম লিখুন"
                  className="h-7 text-xs font-black bg-white/10 text-white border-white/20 mt-0.5"
                />
              </div>
              <div>
                <span className="text-[10px] text-indigo-200 font-bold">রোল নম্বর:</span>
                <Input
                  value={editableRollNumber}
                  onChange={(e) => setEditableRollNumber(e.target.value)}
                  placeholder="রোল নম্বর"
                  className="h-7 text-xs font-black bg-white/10 text-white border-white/20 mt-0.5"
                />
              </div>
              <div className="flex flex-col justify-center text-center">
                <span className="text-[10px] text-indigo-200 font-bold">বিষয় কোড:</span>
                <span className="text-sm font-black mt-0.5">{toBengaliNumber(result.subjectCode || '১০১')}</span>
              </div>
              <div className="flex flex-col justify-center text-center">
                <span className="text-[10px] text-indigo-200 font-bold">প্রশ্ন সেট কোড:</span>
                <span className="text-sm font-black mt-0.5 text-amber-300">সেট: {result.setCode || 'ক'}</span>
              </div>
            </div>

            {/* Score Dashboard Card */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 text-center">
              <Card className="border-2 border-indigo-200 bg-white">
                <CardContent className="p-3">
                  <div className="text-xs font-bold text-slate-500">মোট প্রশ্ন</div>
                  <div className="text-2xl font-black text-indigo-900 mt-1">{toBengaliNumber(result.totalQuestions)}</div>
                </CardContent>
              </Card>
              <Card className="border-2 border-emerald-300 bg-emerald-50/50">
                <CardContent className="p-3">
                  <div className="text-xs font-bold text-emerald-800">সঠিক উত্তর ✅</div>
                  <div className="text-2xl font-black text-emerald-700 mt-1">{toBengaliNumber(result.correctCount)}</div>
                </CardContent>
              </Card>
              <Card className="border-2 border-rose-300 bg-rose-50/50">
                <CardContent className="p-3">
                  <div className="text-xs font-bold text-rose-800">ভুল উত্তর ❌</div>
                  <div className="text-2xl font-black text-rose-700 mt-1">{toBengaliNumber(result.wrongCount)}</div>
                </CardContent>
              </Card>
              <Card className="border-2 border-slate-300 bg-slate-100/60">
                <CardContent className="p-3">
                  <div className="text-xs font-bold text-slate-600">অনুত্তর ⚪</div>
                  <div className="text-2xl font-black text-slate-700 mt-1">{toBengaliNumber(result.unansweredCount)}</div>
                </CardContent>
              </Card>
              <Card className="border-2 border-amber-300 bg-amber-50/60 col-span-2 sm:col-span-1">
                <CardContent className="p-3">
                  <div className="text-xs font-bold text-amber-900">প্রাপ্ত নম্বর 🏆</div>
                  <div className="text-2xl font-black text-amber-800 mt-1">
                    {toBengaliNumber(result.obtainedMarks)} <span className="text-xs font-bold text-slate-500">/ {toBengaliNumber(result.totalMarks)}</span>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Question Breakdown Matrix */}
            <div className="bg-white p-3 rounded-xl border space-y-2">
              <div className="flex items-center justify-between border-b pb-1.5">
                <h4 className="font-black text-xs text-slate-800">প্রতিটি প্রশ্নের বিস্তারিত মূল্যায়ন</h4>
                <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                  <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> সঠিক</span>
                  <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> ভুল</span>
                  <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-slate-400" /> অনুত্তর</span>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 max-h-[260px] overflow-y-auto pr-1">
                {result.questions.map((q) => {
                  const isCorrect = q.status === 'correct';
                  const isWrong = q.status === 'wrong';
                  const isUnanswered = q.status === 'unanswered';
                  const isMultiple = q.status === 'multiple';

                  return (
                    <div
                      key={q.questionNumber}
                      className={cn(
                        "p-1.5 rounded-lg border text-xs font-bold flex items-center justify-between",
                        isCorrect && "bg-emerald-50 border-emerald-300 text-emerald-950",
                        isWrong && "bg-rose-50 border-rose-300 text-rose-950",
                        isUnanswered && "bg-slate-50 border-slate-200 text-slate-600",
                        isMultiple && "bg-amber-50 border-amber-300 text-amber-950"
                      )}
                    >
                      <span className="font-black w-6">{toBengaliNumber(q.questionNumber)}.</span>
                      <div className="flex items-center gap-1">
                        <span className="font-black px-1.5 py-0.5 rounded bg-white border text-[11px] shadow-2xs">
                          {q.scannedAnswer || '—'}
                        </span>
                        {q.correctAnswer && q.correctAnswer !== q.scannedAnswer && (
                          <span className="text-[10px] text-emerald-700 font-black">
                            ({q.correctAnswer})
                          </span>
                        )}
                      </div>
                      <span className="text-xs">
                        {isCorrect ? '✅' : isWrong ? '❌' : isMultiple ? '⚠️' : '⚪'}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Bottom Actions */}
            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleResetForNext}
                className="gap-1.5 font-black text-xs"
              >
                <RefreshCw className="w-3.5 h-3.5" /> পরবর্তী ওএমআর স্ক্যান করুন
              </Button>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="secondary"
                  size="sm"
                  onClick={() => window.print()}
                  className="gap-1.5 font-black text-xs"
                >
                  <Printer className="w-3.5 h-3.5" /> ফলাফল প্রিন্ট করুন
                </Button>
                <Button
                  type="button"
                  size="sm"
                  disabled={isSaving}
                  onClick={handleSaveResult}
                  className="bg-indigo-600 hover:bg-indigo-700 text-white gap-1.5 font-black text-xs shadow-md"
                >
                  {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  ফলাফল সংরক্ষণ করুন
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

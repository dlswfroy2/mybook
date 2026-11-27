'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, 
  Printer, 
  ArrowLeft, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  BrainCircuit, 
  Sparkles, 
  Filter, 
  BookOpen, 
  Download, 
  CheckCircle2, 
  Layers, 
  RefreshCw,
  Search
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  BankQuestion, 
  getBankQuestions, 
  addQuestionsToBank, 
  deleteQuestionFromBank, 
  clearQuestionsFromBank,
  normalizeText 
} from '@/lib/question-bank-storage';
import { CHAPTERS_DATA } from '@/lib/subject-chapters';
import { subjectNameNormalization } from '@/lib/subjects';
import { toBengaliNumber, cn } from '@/lib/utils';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import 'katex/dist/katex.min.css';
import { formatMathToHtml } from '@/lib/math-formatter';

const CLASSES = [
  { id: '6', label: '৬ষ্ঠ' },
  { id: '7', label: '৭ম' },
  { id: '8', label: '৮ম' },
  { id: '9', label: '৯ম' },
  { id: '10', label: '১০ম' },
];

export default function QuestionBankPage() {
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();

  const softwareDocRef = useMemo(() => db ? doc(db, 'config', 'software') : null, [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';

  // Bank Data & Filters
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('10');
  const [selectedSubject, setSelectedSubject] = useState<string>('গণিত');
  const [selectedChapter, setSelectedChapter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected question IDs for paper compilation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Print Mode state
  const [isPrintView, setIsPrintView] = useState(false);
  const [institutionName, setInstitutionName] = useState('টপ গ্রেড টিউটোরিয়ালস');
  const [examName, setExamName] = useState('মূল্যায়ন পরীক্ষা');
  const [examTime, setExamTime] = useState('২ ঘণ্টা ৩০ মিনিট');
  const [examTotalMarks, setExamTotalMarks] = useState('১০০');

  // Add Question Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newType, setNewType] = useState<'creative' | 'mcq' | 'short'>('creative');
  const [newClass, setNewClass] = useState('10');
  const [newSubject, setNewSubject] = useState('গণিত');
  const [newChapter, setNewChapter] = useState('২য় অধ্যায়: মুনাফা');
  const [newContent, setNewContent] = useState('');

  // Load questions from storage
  const reloadQuestions = useCallback(() => {
    const list = getBankQuestions();
    setQuestions(list);
  }, []);

  useEffect(() => {
    reloadQuestions();
  }, [reloadQuestions]);

  useEffect(() => {
    if (appName) {
      setInstitutionName(appName);
    }
  }, [appName]);

  // Available subjects for selected class
  const availableSubjects = useMemo(() => {
    const classData = CHAPTERS_DATA[selectedClass] || {};
    const subjects = Object.keys(classData);
    if (!subjects.includes('গণিত')) subjects.unshift('গণিত');
    return subjects;
  }, [selectedClass]);

  // Available chapters for selected class & subject
  const availableChapters = useMemo(() => {
    const classData = CHAPTERS_DATA[selectedClass] || {};
    const rawChapters = classData[selectedSubject] || [];
    
    // Also include any custom chapters stored in bank questions for this class/subject
    const storedChapters = questions
      .filter(q => String(q.classId) === String(selectedClass) && normalizeText(q.subject) === normalizeText(selectedSubject))
      .map(q => q.chapter)
      .filter(Boolean);

    const merged = Array.from(new Set([...rawChapters, ...storedChapters]));
    return merged;
  }, [selectedClass, selectedSubject, questions]);

  // Set default subject if not available
  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.includes(selectedSubject)) {
      setSelectedSubject(availableSubjects[0]);
    }
  }, [availableSubjects, selectedSubject]);

  // Filtered Questions
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (selectedClass && String(q.classId) !== String(selectedClass)) return false;
      if (selectedSubject && normalizeText(q.subject) !== normalizeText(selectedSubject)) return false;
      if (selectedChapter !== 'all' && normalizeText(q.chapter) !== normalizeText(selectedChapter)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchContent = q.content.toLowerCase().includes(query);
        const matchChapter = q.chapter.toLowerCase().includes(query);
        if (!matchContent && !matchChapter) return false;
      }
      return true;
    });
  }, [questions, selectedClass, selectedSubject, selectedChapter, searchQuery]);

  // Partitioned by type
  const mcqQuestions = useMemo(() => {
    return filteredQuestions
      .filter(q => q.type === 'mcq')
      .sort((a, b) => a.serialNo - b.serialNo);
  }, [filteredQuestions]);

  const creativeQuestions = useMemo(() => {
    return filteredQuestions
      .filter(q => q.type === 'creative')
      .sort((a, b) => a.serialNo - b.serialNo);
  }, [filteredQuestions]);

  const shortQuestions = useMemo(() => {
    return filteredQuestions
      .filter(q => q.type === 'short')
      .sort((a, b) => a.serialNo - b.serialNo);
  }, [filteredQuestions]);

  // Selected questions objects
  const selectedQuestions = useMemo(() => {
    return questions.filter(q => selectedIds.has(q.id));
  }, [questions, selectedIds]);

  const selectedMcqs = useMemo(() => selectedQuestions.filter(q => q.type === 'mcq'), [selectedQuestions]);
  const selectedCreatives = useMemo(() => selectedQuestions.filter(q => q.type === 'creative'), [selectedQuestions]);
  const selectedShorts = useMemo(() => selectedQuestions.filter(q => q.type === 'short'), [selectedQuestions]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllType = (typeList: BankQuestion[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = typeList.every(q => next.has(q.id));
      if (allSelected) {
        typeList.forEach(q => next.delete(q.id));
      } else {
        typeList.forEach(q => next.add(q.id));
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = filteredQuestions.every(q => next.has(q.id));
      if (allSelected) {
        filteredQuestions.forEach(q => next.delete(q.id));
      } else {
        filteredQuestions.forEach(q => next.add(q.id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Delete handler
  const handleDeleteQuestion = (id: string) => {
    if (confirm('আপনি কি এই প্রশ্নটি প্রশ্নব্যাংক থেকে মুছে ফেলতে চান?')) {
      deleteQuestionFromBank(id);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      reloadQuestions();
      toast({ title: 'প্রশ্ন মুছে ফেলা হয়েছে' });
    }
  };

  // Add Question handler
  const handleAddNewQuestion = () => {
    if (!newContent.trim()) {
      toast({ variant: 'destructive', title: 'প্রশ্নের বিবরণ লিখুন' });
      return;
    }

    const res = addQuestionsToBank([{
      classId: newClass,
      subject: newSubject,
      chapter: newChapter,
      type: newType,
      content: newContent.trim(),
      source: 'manual'
    }]);

    reloadQuestions();
    setNewContent('');
    setAddModalOpen(false);
    toast({ 
      title: 'সফলভাবে যুক্ত হয়েছে! 🎉', 
      description: `প্রশ্নটি ক্রমিক নং ${toBengaliNumber(res.savedItems[0]?.serialNo || 1)} হিসেবে সেভ হয়েছে।` 
    });
  };

  // Add Sample Seed Questions for demo/testing if bank is empty
  const handleSeedSampleQuestions = () => {
    const samples = [
      // MCQs for Math Class 10 Ch 2
      {
        classId: '10',
        subject: 'গণিত',
        chapter: '২য় অধ্যায়: সেট ও ফাংশন',
        type: 'mcq' as const,
        content: 'ত্রিভুজের তিন বাহুর দৈর্ঘ্য সেন্টিমিটারে দেওয়া আছে। নিচের কোন ক্ষেত্রে ত্রিভুজ আঁকা সম্ভব নয়?\n(ক) ৩, ৪, ৫     (খ) ২, ৩, ৬     (গ) ৫, ৭, ১০     (ঘ) ৬, ৮, ১০'
      },
      {
        classId: '10',
        subject: 'গণিত',
        chapter: '২য় অধ্যায়: সেট ও ফাংশন',
        type: 'mcq' as const,
        content: 'একটি বৃত্তের ব্যাস ১০ সে.মি. হলে কেন্দ্র থেকে জ্যা এর উপর অঙ্কিত লম্বের দৈর্ঘ্য ৫ সে.মি. হলে জ্যা-এর দৈর্ঘ্য কত?\n(ক) ৫ সেমি.     (খ) ৮ সেমি.     (গ) ১০ সেমি.     (ঘ) ১২ সেমি.'
      },
      // Creatives for Math Class 10 Ch 2
      {
        classId: '10',
        subject: 'গণিত',
        chapter: '২য় অধ্যায়: সেট ও ফাংশন',
        type: 'creative' as const,
        content: `U = {x ∈ ℕ : x < 10}, A = {x ∈ ℕ : x মৌলিক সংখ্যা এবং x < 10}, B = {x ∈ ℕ : x জোড় সংখ্যা এবং x < 10} এবং C = {x ∈ ℤ : x² - 5x + 6 = 0} তিনটি সেট।
ক. C সেটটিকে তালিকা পদ্ধতিতে প্রকাশ কর।
খ. দেখাও যে, (A ∪ B)' = A' ∩ B'।
গ. প্রমাণ কর যে, A × (B ∩ C) = (A × B) ∩ (A × C)।`
      },
      {
        classId: '10',
        subject: 'গণিত',
        chapter: '২য় অধ্যায়: সেট ও ফাংশন',
        type: 'creative' as const,
        content: `কোনো ক্লাসের ৩০ জন শিক্ষার্থীর মধ্যে ২০ জন গণিত পছন্দ করে, ১৫ জন বিজ্ঞান পছন্দ করে এবং ৫ জন কোনোটিই পছন্দ করে না। অন্যদিকে, f(x) = 2x + 1/2x - 1 একটি ফাংশন।
ক. কতজন শিক্ষার্থী উভয় বিষয় পছন্দ করে, তা সেট সূত্রের সাহায্যে নির্ণয় কর।
খ. সার্বিক সেটের সাপেক্ষে ভেনচিত্রের মাধ্যমে প্রমাণ তথ্যটি যাচাই কর।
গ. f(1/x) এর মান নির্ণয় করে দেখাও যে, f(x) + 1/f(x) - 1 = x।`
      },
      // Shorts for Math Class 10 Ch 2
      {
        classId: '10',
        subject: 'গণিত',
        chapter: '২য় অধ্যায়: সেট ও ফাংশন',
        type: 'short' as const,
        content: "U = {x ∈ ℕ : x < 10}, A = {x ∈ ℕ : x মৌলিক সংখ্যা} এবং B = {x ∈ ℕ : x জোড় সংখ্যা} হলে, (A ∪ B)' নির্ণয় কর।"
      },
      {
        classId: '10',
        subject: 'গণিত',
        chapter: '২য় অধ্যায়: সেট ও ফাংশন',
        type: 'short' as const,
        content: "P = {1, 2, 3} সেটের শক্তি সেট (Power Set) নির্ণয় কর এবং দেখাও যে, P(P) এর উপাদানের সংখ্যা 2ⁿ কে সমর্থন করে, যেখানে n হলো P সেটের উপাদানের সংখ্যা।"
      }
    ];

    addQuestionsToBank(samples);
    reloadQuestions();
    toast({ title: 'নমুনা প্রশ্ন যুক্ত হয়েছে!', description: 'ছবিতে প্রদর্শিত নমুনা প্রশ্নগুলো সফলভাবে ব্যাংকে সেভ করা হয়েছে।' });
  };

  // Go to Print Mode
  const handleProceedToPrint = () => {
    if (selectedIds.size === 0) {
      toast({
        variant: 'destructive',
        title: 'প্রশ্ন নির্বাচন করুন',
        description: 'প্রিন্ট করার জন্য অন্তত একটি প্রশ্নের টিক বক্সে ক্লিক করে নির্বাচন করুন।'
      });
      return;
    }
    // Calculate estimated marks & time
    const totalM = (selectedCreatives.length * 10) + (selectedMcqs.length * 1) + (selectedShorts.length * 2);
    setExamTotalMarks(toBengaliNumber(totalM));
    if (totalM <= 25) setExamTime('৪০ মিনিট');
    else if (totalM <= 50) setExamTime('১ ঘণ্টা ১৫ মিনিট');
    else setExamTime('২ ঘণ্টা ৩০ মিনিট');

    setIsPrintView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // ──────────────────────────────────────────────────────────
  // VIEW 1: PRINT VIEW (বোর্ডমানে সরাসরি প্রিন্ট, কোনো এডিট নয়)
  // ──────────────────────────────────────────────────────────
  if (isPrintView) {
    return (
      <div className="min-h-screen bg-slate-200 py-6 px-2 sm:px-6 font-kalpurush">
        {/* Floating Top Control Bar (Hidden during print) */}
        <div className="no-print max-w-[8.27in] mx-auto mb-6 bg-white p-4 rounded-2xl shadow-lg border-2 border-indigo-200 flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <Button 
              variant="outline" 
              onClick={() => setIsPrintView(false)} 
              className="font-bold text-xs gap-1.5 h-9"
            >
              <ArrowLeft className="w-4 h-4" /> তালিকায় ফিরে যান
            </Button>
            <span className="text-xs font-black text-indigo-900 bg-indigo-50 px-3 py-1.5 rounded-lg border border-indigo-200">
              নির্বাচিত প্রশ্ন: {toBengaliNumber(selectedIds.size)}টি (সৃজনশীল: {toBengaliNumber(selectedCreatives.length)}, বহুনির্বাচনী: {toBengaliNumber(selectedMcqs.length)}, সংক্ষিপ্ত: {toBengaliNumber(selectedShorts.length)})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                if (typeof document !== 'undefined') {
                  document.title = `${institutionName} - ${examName} - ${selectedSubject}`;
                }
                window.print();
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-1.5 h-9 px-5 shadow-md"
            >
              <Printer className="w-4 h-4" /> এখনই প্রিন্ট করুন
            </Button>
            <Button
              onClick={() => {
                if (typeof document !== 'undefined') {
                  document.title = `${institutionName} - ${examName} - ${selectedSubject}`;
                }
                window.print();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 h-9 px-4 shadow-md"
            >
              <Download className="w-4 h-4" /> PDF ডাউনলোড
            </Button>
          </div>
        </div>

        {/* The Printable Board A4 Paper */}
        <div className="max-w-[8.27in] mx-auto bg-white shadow-2xl rounded-sm p-6 sm:p-10 border border-slate-300 min-h-[11in] text-black leading-relaxed box-border print:p-0 print:border-none print:shadow-none print:max-w-none">
          {/* Institutional Header */}
          <div className="text-center border-b-2 border-black pb-3 mb-6 select-none">
            <h1 className="font-black text-2xl text-black leading-tight uppercase tracking-wide">
              {institutionName}
            </h1>
            <h2 className="text-base font-bold text-black mt-1 underline">
              {examName}
            </h2>
            <div className="flex justify-center items-center gap-6 sm:gap-10 text-xs font-bold mt-2.5 px-2 flex-wrap">
              <span>শ্রেণি: {CLASSES.find(c => c.id === selectedClass)?.label || selectedClass} শ্রেণি</span>
              <span>বিষয়: {selectedSubject}</span>
              {selectedChapter !== 'all' && <span>অধ্যায়: {selectedChapter}</span>}
            </div>
            <div className="flex justify-between items-center text-xs font-bold mt-2 px-2 italic border-t pt-1 border-dashed border-black">
              <span>সময়: {examTime}</span>
              <span>পূর্ণমান: {examTotalMarks}</span>
            </div>
          </div>

          {/* Section 1: Creative Questions (CQ) */}
          {selectedCreatives.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between border-b border-black pb-1 mb-4">
                <span className="font-black text-sm bg-black text-white px-3 py-0.5 rounded-sm">
                  ক-বিভাগ: সৃজনশীল প্রশ্ন
                </span>
                <span className="text-xs font-bold italic">
                  [যেকোনো {toBengaliNumber(selectedCreatives.length)}টি প্রশ্নের উত্তর দাও: {toBengaliNumber(selectedCreatives.length)} × ১০ = {toBengaliNumber(selectedCreatives.length * 10)}]
                </span>
              </div>
              <div className="space-y-6">
                {selectedCreatives.map((q, idx) => (
                  <div key={q.id} className="text-xs sm:text-sm leading-relaxed">
                    <div className="flex items-start gap-2">
                      <span className="font-black text-base shrink-0">{toBengaliNumber(idx + 1)}।</span>
                      <div 
                        className="space-y-1.5 flex-1 whitespace-pre-line text-justify math-rendered"
                        dangerouslySetInnerHTML={{ __html: formatMathToHtml(q.content) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 2: Multiple Choice Questions (MCQ) */}
          {selectedMcqs.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between border-b border-black pb-1 mb-4">
                <span className="font-black text-sm bg-black text-white px-3 py-0.5 rounded-sm">
                  {selectedCreatives.length > 0 ? 'খ-বিভাগ: বহুনির্বাচনী প্রশ্ন' : 'বহুনির্বাচনী প্রশ্ন'}
                </span>
                <span className="text-xs font-bold italic">
                  [সঠিক উত্তরের বৃত্তটি ভরাট কর। সকল প্রশ্নের উত্তর দিতে হবে: {toBengaliNumber(selectedMcqs.length)} × ১ = {toBengaliNumber(selectedMcqs.length)}]
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4">
                {selectedMcqs.map((q, idx) => (
                  <div key={q.id} className="text-xs leading-relaxed border-b border-slate-200 pb-2">
                    <div className="flex items-start gap-1.5">
                      <span className="font-black shrink-0">{toBengaliNumber(idx + 1)}।</span>
                      <div 
                        className="space-y-1 flex-1 whitespace-pre-line math-rendered"
                        dangerouslySetInnerHTML={{ __html: formatMathToHtml(q.content) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Section 3: Short Questions */}
          {selectedShorts.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center justify-between border-b border-black pb-1 mb-4">
                <span className="font-black text-sm bg-black text-white px-3 py-0.5 rounded-sm">
                  {selectedCreatives.length > 0 && selectedMcqs.length > 0 ? 'গ-বিভাগ: সংক্ষিপ্ত প্রশ্ন' : 'সংক্ষিপ্ত প্রশ্ন'}
                </span>
                <span className="text-xs font-bold italic">
                  [সকল প্রশ্নের উত্তর দাও: {toBengaliNumber(selectedShorts.length)} × ২ = {toBengaliNumber(selectedShorts.length * 2)}]
                </span>
              </div>
              <div className="space-y-3">
                {selectedShorts.map((q, idx) => (
                  <div key={q.id} className="text-xs sm:text-sm leading-relaxed">
                    <div className="flex items-start gap-2">
                      <span className="font-black shrink-0">{toBengaliNumber(idx + 1)}।</span>
                      <div 
                        className="space-y-1 flex-1 whitespace-pre-line math-rendered"
                        dangerouslySetInnerHTML={{ __html: formatMathToHtml(q.content) }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // VIEW 2: QUESTION BANK SELECTION TABLES (ছবির মতো টেবিল ফরমেট)
  // ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-kalpurush pb-32">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/create-question">
              <Button variant="ghost" size="sm" className="gap-1 font-bold text-xs h-8">
                <ArrowLeft className="w-3.5 h-3.5" /> প্রশ্ন তৈরি
              </Button>
            </Link>
            <div className="h-4 w-px bg-slate-300" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-indigo-950 leading-tight">
                  টপ গ্রেড প্রশ্ন ব্যাংক (Question Bank)
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-500 font-bold">
                  হাজার হাজার সংরক্ষিত প্রশ্ন থেকে বাচাই করে এক ক্লিকে বোর্ডমানে সরাসরি প্রিন্ট করুন
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {questions.length === 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleSeedSampleQuestions}
                className="font-bold text-xs text-amber-700 border-amber-300 hover:bg-amber-50 h-8 gap-1.5"
              >
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> নমুনা প্রশ্ন লোড করুন
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="font-bold text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 h-8 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> নতুন প্রশ্ন যুক্ত করুন
            </Button>
            <Button
              onClick={handleProceedToPrint}
              disabled={selectedIds.size === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-8 px-4 gap-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> প্রশ্নপত্র তৈরি ও সরাসরি প্রিন্ট করুন ({toBengaliNumber(selectedIds.size)})
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 pt-5 space-y-6">
        {/* Filter Controls Card */}
        <Card className="border border-slate-200 shadow-xs bg-white">
          <CardContent className="p-3 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
              {/* 1. Class Select */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> শ্রেণি নির্বাচন
                </label>
                <Select value={selectedClass} onValueChange={setSelectedClass}>
                  <SelectTrigger className="h-9 text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLASSES.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs font-bold">
                        {c.label} শ্রেণি
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Subject Select */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" /> বিষয় নির্বাচন
                </label>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                  <SelectTrigger className="h-9 text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map(s => (
                      <SelectItem key={s} value={s} className="text-xs font-bold">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Chapter Select */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" /> অধ্যায় নির্বাচন
                </label>
                <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                  <SelectTrigger className="h-9 text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-bold text-indigo-700">
                      ★ সকল অধ্যায় (সব একসাথে)
                    </SelectItem>
                    {availableChapters.map(ch => (
                      <SelectItem key={ch} value={ch} className="text-xs font-bold">
                        {ch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Search Filter */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-indigo-600" /> প্রশ্ন বা কি-ওয়ার্ড খুঁজুন
                </label>
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="যেমন: ত্রিভুজ, সেট, গতি..."
                  className="h-9 text-xs font-bold"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Floating Selection Summary Banner */}
        <div className="bg-indigo-900 text-white rounded-xl p-3 sm:p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3 text-xs font-bold">
            <span className="bg-indigo-800 px-3 py-1 rounded-md text-amber-300 font-black">
              মোট সংরক্ষিত প্রশ্ন: {toBengaliNumber(filteredQuestions.length)}টি
            </span>
            <span className="bg-indigo-700/80 px-2.5 py-1 rounded-md">
              বহুনির্বাচনী: {toBengaliNumber(mcqQuestions.length)}টি (নির্বাচিত: {toBengaliNumber(selectedMcqs.length)})
            </span>
            <span className="bg-indigo-700/80 px-2.5 py-1 rounded-md">
              সৃজনশীল: {toBengaliNumber(creativeQuestions.length)}টি (নির্বাচিত: {toBengaliNumber(selectedCreatives.length)})
            </span>
            <span className="bg-indigo-700/80 px-2.5 py-1 rounded-md">
              সংক্ষিপ্ত: {toBengaliNumber(shortQuestions.length)}টি (নির্বাচিত: {toBengaliNumber(selectedShorts.length)})
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={handleSelectAllVisible}
              className="text-xs font-bold h-8 text-black bg-white hover:bg-slate-100 border-none"
            >
              সব নির্বাচন করুন
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearSelection}
              className="text-xs font-bold h-8 text-indigo-200 hover:text-white hover:bg-indigo-800"
            >
              নির্বাচন মুছুন
            </Button>
            <Button
              size="sm"
              onClick={handleProceedToPrint}
              disabled={selectedIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-8 px-4 gap-1.5 shadow"
            >
              <Printer className="w-3.5 h-3.5" /> সরাসরি প্রিন্ট করুন ({toBengaliNumber(selectedIds.size)})
            </Button>
          </div>
        </div>

        {/* No questions empty state */}
        {filteredQuestions.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-300 space-y-3">
            <BrainCircuit className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-700">এই শ্রেণি বা বিষয়ে এখনো কোনো প্রশ্ন ব্যাংকে যুক্ত করা হয়নি।</p>
            <p className="text-xs text-slate-500">
              প্রশ্ন তৈরি (`/create-question`) বা লেকচার শিট পেজ থেকে 'প্রশ্ন ব্যাংকে সংরক্ষণ' বাটনে ক্লিক করে প্রশ্ন যোগ করতে পারেন।
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button onClick={handleSeedSampleQuestions} variant="outline" className="font-bold text-xs gap-1.5 border-amber-400 text-amber-800">
                <Sparkles className="w-3.5 h-3.5 text-amber-600" /> ডেমো নমুনা প্রশ্ন লোড করুন
              </Button>
              <Button onClick={() => setAddModalOpen(true)} className="font-bold text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="w-3.5 h-3.5" /> নতুন প্রশ্ন লিখুন
              </Button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* TABLE 1: বহুনির্বাচনী প্রশ্ন (MCQ TABLE)                     */}
        {/* ────────────────────────────────────────────────────────── */}
        {mcqQuestions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border-2 border-black overflow-hidden">
            <table className="w-full border-collapse text-black">
              <thead>
                <tr className="border-b-2 border-black bg-slate-100">
                  <th className="w-[12%] text-center font-black text-xs sm:text-sm py-2.5 px-2 border-r-2 border-black">
                    ক্রমিক নং
                  </th>
                  <th className="text-center font-black text-xs sm:text-sm py-2.5 px-4 border-r-2 border-black flex-1">
                    বহুনির্বাচনী প্রশ্ন ({toBengaliNumber(mcqQuestions.length)}টি)
                  </th>
                  <th className="w-[18%] sm:w-[15%] text-center font-black text-xs sm:text-sm py-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllType(mcqQuestions)}
                      className="hover:underline flex items-center justify-center gap-1 mx-auto"
                      title="সবগুলো নির্বাচন করুন"
                    >
                      টিক চিহ্ন দিয়ে নির্বাচন করুন
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mcqQuestions.map((q) => {
                  const isChecked = selectedIds.has(q.id);
                  return (
                    <tr
                      key={q.id}
                      onClick={() => toggleSelect(q.id)}
                      className={cn(
                        "border-b border-black hover:bg-indigo-50/40 cursor-pointer transition-colors select-none",
                        isChecked && "bg-indigo-50/70"
                      )}
                    >
                      {/* Column 1: Serial No */}
                      <td className="text-center font-bold text-sm sm:text-base py-3 px-2 border-r-2 border-black align-top">
                        {toBengaliNumber(q.serialNo)}।
                      </td>

                      {/* Column 2: Question Content */}
                      <td className="py-3 px-3 sm:px-4 border-r-2 border-black align-top text-xs sm:text-sm leading-relaxed">
                        <div 
                          className="whitespace-pre-line font-medium text-slate-900 math-rendered"
                          dangerouslySetInnerHTML={{ __html: formatMathToHtml(q.content) }}
                        />
                        <div className="text-[10px] text-slate-400 font-bold mt-1 flex items-center justify-between">
                          <span>অধ্যায়: {q.chapter}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuestion(q.id);
                            }}
                            className="text-red-500 hover:text-red-700 hover:underline text-[10px]"
                          >
                            মুছুন
                          </button>
                        </div>
                      </td>

                      {/* Column 3: Checkbox */}
                      <td className="text-center py-3 px-2 align-middle">
                        <div className="flex justify-center items-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 sm:w-6 sm:h-6 accent-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* TABLE 2: সৃজনশীল প্রশ্ন (CREATIVE TABLE)                    */}
        {/* ────────────────────────────────────────────────────────── */}
        {creativeQuestions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border-2 border-black overflow-hidden">
            <table className="w-full border-collapse text-black">
              <thead>
                <tr className="border-b-2 border-black bg-slate-100">
                  <th className="w-[12%] text-center font-black text-xs sm:text-sm py-2.5 px-2 border-r-2 border-black">
                    ক্রমিক নং
                  </th>
                  <th className="text-center font-black text-xs sm:text-sm py-2.5 px-4 border-r-2 border-black flex-1">
                    সৃজনশীল প্রশ্ন ({toBengaliNumber(creativeQuestions.length)}টি)
                  </th>
                  <th className="w-[18%] sm:w-[15%] text-center font-black text-xs sm:text-sm py-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllType(creativeQuestions)}
                      className="hover:underline flex items-center justify-center gap-1 mx-auto"
                      title="সবগুলো নির্বাচন করুন"
                    >
                      টিক চিহ্ন দিয়ে নির্বাচন করুন
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {creativeQuestions.map((q) => {
                  const isChecked = selectedIds.has(q.id);
                  return (
                    <tr
                      key={q.id}
                      onClick={() => toggleSelect(q.id)}
                      className={cn(
                        "border-b border-black hover:bg-indigo-50/40 cursor-pointer transition-colors select-none",
                        isChecked && "bg-indigo-50/70"
                      )}
                    >
                      {/* Column 1: Serial No */}
                      <td className="text-center font-bold text-sm sm:text-base py-3 px-2 border-r-2 border-black align-top">
                        {toBengaliNumber(q.serialNo)}।
                      </td>

                      {/* Column 2: Question Content */}
                      <td className="py-3 px-3 sm:px-4 border-r-2 border-black align-top text-xs sm:text-sm leading-relaxed">
                        <div 
                          className="whitespace-pre-line font-medium text-slate-900 math-rendered"
                          dangerouslySetInnerHTML={{ __html: formatMathToHtml(q.content) }}
                        />
                        <div className="text-[10px] text-slate-400 font-bold mt-1.5 flex items-center justify-between">
                          <span>অধ্যায়: {q.chapter}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuestion(q.id);
                            }}
                            className="text-red-500 hover:text-red-700 hover:underline text-[10px]"
                          >
                            মুছুন
                          </button>
                        </div>
                      </td>

                      {/* Column 3: Checkbox */}
                      <td className="text-center py-3 px-2 align-middle">
                        <div className="flex justify-center items-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 sm:w-6 sm:h-6 accent-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* TABLE 3: সংক্ষিপ্ত প্রশ্ন (SHORT QUESTIONS TABLE)             */}
        {/* ────────────────────────────────────────────────────────── */}
        {shortQuestions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border-2 border-black overflow-hidden">
            <table className="w-full border-collapse text-black">
              <thead>
                <tr className="border-b-2 border-black bg-slate-100">
                  <th className="w-[12%] text-center font-black text-xs sm:text-sm py-2.5 px-2 border-r-2 border-black">
                    ক্রমিক নং
                  </th>
                  <th className="text-center font-black text-xs sm:text-sm py-2.5 px-4 border-r-2 border-black flex-1">
                    সংক্ষিপ্ত প্রশ্ন ({toBengaliNumber(shortQuestions.length)}টি)
                  </th>
                  <th className="w-[18%] sm:w-[15%] text-center font-black text-xs sm:text-sm py-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllType(shortQuestions)}
                      className="hover:underline flex items-center justify-center gap-1 mx-auto"
                      title="সবগুলো নির্বাচন করুন"
                    >
                      টিক চিহ্ন দিয়ে নির্বাচন করুন
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shortQuestions.map((q) => {
                  const isChecked = selectedIds.has(q.id);
                  return (
                    <tr
                      key={q.id}
                      onClick={() => toggleSelect(q.id)}
                      className={cn(
                        "border-b border-black hover:bg-indigo-50/40 cursor-pointer transition-colors select-none",
                        isChecked && "bg-indigo-50/70"
                      )}
                    >
                      {/* Column 1: Serial No */}
                      <td className="text-center font-bold text-sm sm:text-base py-3 px-2 border-r-2 border-black align-top">
                        {toBengaliNumber(q.serialNo)}।
                      </td>

                      {/* Column 2: Question Content */}
                      <td className="py-3 px-3 sm:px-4 border-r-2 border-black align-top text-xs sm:text-sm leading-relaxed">
                        <div 
                          className="whitespace-pre-line font-medium text-slate-900 math-rendered"
                          dangerouslySetInnerHTML={{ __html: formatMathToHtml(q.content) }}
                        />
                        <div className="text-[10px] text-slate-400 font-bold mt-1 flex items-center justify-between">
                          <span>অধ্যায়: {q.chapter}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuestion(q.id);
                            }}
                            className="text-red-500 hover:text-red-700 hover:underline text-[10px]"
                          >
                            মুছুন
                          </button>
                        </div>
                      </td>

                      {/* Column 3: Checkbox */}
                      <td className="text-center py-3 px-2 align-middle">
                        <div className="flex justify-center items-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 sm:w-6 sm:h-6 accent-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* Add New Question Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-lg font-kalpurush bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-indigo-900">
              <Plus className="w-5 h-5 text-indigo-600" /> প্রশ্ন ব্যাংকে নতুন প্রশ্ন যুক্ত করুন
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">প্রশ্নের ধরণ</label>
                <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                  <SelectTrigger className="h-8 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creative">সৃজনশীল প্রশ্ন</SelectItem>
                    <SelectItem value="mcq">বহুনির্বাচনী প্রশ্ন (MCQ)</SelectItem>
                    <SelectItem value="short">সংক্ষিপ্ত প্রশ্ন</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">শ্রেণি</label>
                <Select value={newClass} onValueChange={setNewClass}>
                  <SelectTrigger className="h-8 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">বিষয়</label>
                <Input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="বিষয়..." className="h-8 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">অধ্যায়</label>
                <Input value={newChapter} onChange={e => setNewChapter(e.target.value)} placeholder="অধ্যায়..." className="h-8 font-bold" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">প্রশ্নের বিবরণ ও ক, খ, গ, ঘ বা অপশন</label>
              <Textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="উদ্দীপক এবং ক, খ, গ, ঘ লিখুন বা বহুনির্বাচনী প্রশ্ন ও ৪টি অপশন লিখুন..."
                className="min-h-[140px] font-bold leading-relaxed text-xs"
              />
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * সংরক্ষিত হওয়ার সময় এই শ্রেণি, বিষয় ও অধ্যায়ের ক্রমিক নং স্বয়ংক্রিয়ভাবে পরবর্তী ক্রমিকে সেভ হবে।
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>বাতিল</Button>
            <Button size="sm" onClick={handleAddNewQuestion} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4">
              সংরক্ষণ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style dangerouslySetInnerHTML={{ __html: `
        .math-rendered .katex { font-size: 1.05em; line-height: 1.2; text-indent: 0; }
        .math-rendered .katex-display { margin: 0.5em 0; overflow-x: auto; overflow-y: hidden; }
        .math-rendered .math-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.88em; margin: 0 2px; }
        .math-rendered .math-num { border-bottom: 1px solid currentColor; padding: 0 2px; }
        .math-rendered .math-den { padding: 0 2px; }
        .math-rendered sub { font-size: 0.75em; vertical-align: sub; line-height: 0; }
        .math-rendered sup { font-size: 0.75em; vertical-align: super; line-height: 0; }
      ` }} />
    </div>
  );
}

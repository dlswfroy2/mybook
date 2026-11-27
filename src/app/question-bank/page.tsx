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
  Search,
  Settings2
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
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
  normalizeText 
} from '@/lib/question-bank-storage';
import { CHAPTERS_DATA } from '@/lib/subject-chapters';
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

/**
 * Intelligent chapter normalization and matching.
 * Handles variations like:
 * "১ম অধ্যায়: বাস্তব সংখ্যা" <-> "প্রথম অধ্যায়: বাস্তব সংখ্যা" <-> "বাস্তব সংখ্যা"
 */
function canonicalizeChapter(ch?: string): string {
  if (!ch) return '';
  let s = ch.trim().toLowerCase();

  // Standardize ordinal numbers and words into digits
  s = s
    .replace(/(^|[^০-৯0-9])(প্রথম|১ম|1st|১|1)([^০-৯0-9]|$)/g, '$1#1#$3')
    .replace(/(^|[^০-৯0-9])(দ্বিতীয়|২য়|2nd|২|2)([^০-৯0-9]|$)/g, '$1#2#$3')
    .replace(/(^|[^০-৯0-9])(তৃতীয়|৩য়|3rd|৩|3)([^০-৯0-9]|$)/g, '$1#3#$3')
    .replace(/(^|[^০-৯0-9])(চতুর্থ|৪র্থ|4th|৪|4)([^০-৯0-9]|$)/g, '$1#4#$3')
    .replace(/(^|[^০-৯0-9])(পঞ্চম|৫ম|5th|৫|5)([^০-৯0-9]|$)/g, '$1#5#$3')
    .replace(/(^|[^০-৯0-9])(ষষ্ঠ|৬ষ্ঠ|6th|৬|6)([^০-৯0-9]|$)/g, '$1#6#$3')
    .replace(/(^|[^০-৯0-9])(সপ্তম|৭ম|7th|৭|7)([^০-৯0-9]|$)/g, '$1#7#$3')
    .replace(/(^|[^০-৯0-9])(অষ্টম|৮ম|8th|৮|8)([^০-৯0-9]|$)/g, '$1#8#$3')
    .replace(/(^|[^০-৯0-9])(নবম|৯ম|9th|৯|9)([^০-৯0-9]|$)/g, '$1#9#$3')
    .replace(/(^|[^০-৯0-9])(দশম|১০ম|10th|১০|10)([^০-৯0-9]|$)/g, '$1#10#$3')
    .replace(/(^|[^০-৯0-9])(একাদশ|১১শ|11th|১১|11)([^০-৯0-9]|$)/g, '$1#11#$3')
    .replace(/(^|[^০-৯0-9])(দ্বাদশ|১২শ|12th|১২|12)([^০-৯0-9]|$)/g, '$1#12#$3')
    .replace(/(^|[^০-৯0-9])(ত্রয়োদশ|ত্রয়োদশ|১৩শ|13th|১৩|13)([^০-৯0-9]|$)/g, '$1#13#$3')
    .replace(/(^|[^০-৯0-9])(চতুর্দশ|১৪শ|14th|১৪|14)([^০-৯0-9]|$)/g, '$1#14#$3')
    .replace(/(^|[^০-৯0-9])(পঞ্চদশ|১৫শ|15th|১৫|15)([^০-৯0-9]|$)/g, '$1#15#$3')
    .replace(/(^|[^০-৯0-9])(ষোড়শ|ষোড়শ|১৬শ|16th|১৬|16)([^০-৯0-9]|$)/g, '$1#16#$3')
    .replace(/(^|[^০-৯0-9])(সপ্তদশ|১৭শ|17th|১৭|17)([^০-৯0-9]|$)/g, '$1#17#$3');

  // Strip prefixes like "অধ্যায়", "অধ্যায়", "chapter", colons, and spaces
  s = s.replace(/অধ্যায়|অধ্যায়|chapter|lesson/gi, '');
  s = s.replace(/[:\-–—.,]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function isSameChapter(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const ca = canonicalizeChapter(a);
  const cb = canonicalizeChapter(b);
  if (ca === cb) return true;
  const strippedA = ca.replace(/#[0-9]+#/g, '').trim();
  const strippedB = cb.replace(/#[0-9]+#/g, '').trim();
  if (strippedA && strippedB && (strippedA === strippedB || strippedA.includes(strippedB) || strippedB.includes(strippedA))) {
    return true;
  }
  return false;
}

/**
 * Format questions for board display:
 * Cleans ugly [২], [৪], [2], [4] brackets and converts them into right-aligned board marks.
 */
function formatContentWithBoardMarks(content: string): string {
  if (!content) return '';
  // Convert [২], [৪], [2], [4] at the end of lines or clauses into board mark badge
  let cleaned = content.replace(/(?:\[|\()([০-৯0-9]+)(?:\]|\))\s*(\r?\n|$)/g, (_, num, trailing) => {
    const bnNum = toBengaliNumber(num);
    return `<span class="board-mark">${bnNum}</span>${trailing}`;
  });
  return formatMathToHtml(cleaned);
}

export default function QuestionBankPage() {
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();

  const softwareDocRef = useMemo(() => db ? doc(db, 'config', 'software') : null, [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';

  // Bank Data & Filters
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('9');
  const [selectedSubject, setSelectedSubject] = useState<string>('গণিত');
  const [selectedChapter, setSelectedChapter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Selected question IDs for paper compilation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Setup Popup Modal state (before direct print)
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [isPrintView, setIsPrintView] = useState(false);

  // Board Setup Config values
  const [institutionName, setInstitutionName] = useState('টপ গ্রেড টিউটোরিয়ালস');
  const [examName, setExamName] = useState('মূল্যায়ন পরীক্ষা');
  const [examTime, setExamTime] = useState('২ ঘণ্টা ৩০ মিনিট');
  const [examTotalMarks, setExamTotalMarks] = useState('১০০');

  // Section headline & instruction configs
  const [creativeTitle, setCreativeTitle] = useState('ক-বিভাগ: সৃজনশীল প্রশ্ন');
  const [creativeInstruction, setCreativeInstruction] = useState('যেকোনো ৭টি প্রশ্নের উত্তর দাও');
  const [creativeStartSerial, setCreativeStartSerial] = useState('১');

  const [mcqTitle, setMcqTitle] = useState('খ-বিভাগ: বহুনির্বাচনী প্রশ্ন');
  const [mcqInstruction, setMcqInstruction] = useState('সঠিক উত্তরের বিপরীতের বৃত্তটি বল পয়েন্ট কলম দ্বারা ভরাট কর। সকল প্রশ্নের উত্তর দিতে হবে।');
  const [mcqStartSerial, setMcqStartSerial] = useState('১');

  const [shortTitle, setShortTitle] = useState('গ-বিভাগ: সংক্ষিপ্ত প্রশ্ন');
  const [shortInstruction, setShortInstruction] = useState('সকল প্রশ্নের উত্তর দাও');
  const [shortStartSerial, setShortStartSerial] = useState('১');

  // Add Question Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newType, setNewType] = useState<'creative' | 'mcq' | 'short'>('creative');
  const [newClass, setNewClass] = useState('9');
  const [newSubject, setNewSubject] = useState('গণিত');
  const [newChapter, setNewChapter] = useState('১ম অধ্যায়: বাস্তব সংখ্যা');
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

  // Available chapters for selected class & subject with smart deduplication
  const availableChapters = useMemo(() => {
    const classData = CHAPTERS_DATA[selectedClass] || {};
    const rawChapters = classData[selectedSubject] || [];
    
    // Also include any custom chapters stored in bank questions for this class/subject
    const storedChapters = questions
      .filter(q => String(q.classId) === String(selectedClass) && normalizeText(q.subject) === normalizeText(selectedSubject))
      .map(q => q.chapter)
      .filter(Boolean);

    // Merge and deduplicate using isSameChapter
    const list: string[] = [];
    [...storedChapters, ...rawChapters].forEach(ch => {
      if (!list.some(existing => isSameChapter(existing, ch))) {
        list.push(ch);
      }
    });

    return list;
  }, [selectedClass, selectedSubject, questions]);

  // Set default subject if not available
  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.includes(selectedSubject)) {
      setSelectedSubject(availableSubjects[0]);
    }
  }, [availableSubjects, selectedSubject]);

  // Filtered Questions with robust chapter matching
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (selectedClass && String(q.classId) !== String(selectedClass)) return false;
      if (selectedSubject && normalizeText(q.subject) !== normalizeText(selectedSubject)) return false;
      if (selectedChapter !== 'all' && !isSameChapter(q.chapter, selectedChapter)) return false;
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

  // Open the Board Setup Popup Modal
  const handleOpenSetupModal = () => {
    if (selectedIds.size === 0) {
      toast({
        variant: 'destructive',
        title: 'প্রশ্ন নির্বাচন করুন',
        description: 'প্রিন্ট করার জন্য অন্তত একটি প্রশ্নের টিক বক্সে ক্লিক করে নির্বাচন করুন।'
      });
      return;
    }

    // Auto-calculate full marks & default time
    const totalM = (selectedCreatives.length * 10) + (selectedMcqs.length * 1) + (selectedShorts.length * 2);
    setExamTotalMarks(toBengaliNumber(totalM));
    if (totalM <= 25) setExamTime('৪০ মিনিট');
    else if (totalM <= 50) setExamTime('১ ঘণ্টা ১৫ মিনিট');
    else setExamTime('২ ঘণ্টা ৩০ মিনিট');

    // Auto-configure instructions based on selected count
    if (selectedCreatives.length > 0) {
      const toAnswer = Math.max(1, selectedCreatives.length > 7 ? 7 : selectedCreatives.length);
      setCreativeInstruction(`যেকোনো ${toBengaliNumber(toAnswer)}টি প্রশ্নের উত্তর দাও: ${toBengaliNumber(toAnswer)} × ১০ = ${toBengaliNumber(toAnswer * 10)}`);
    }
    if (selectedMcqs.length > 0) {
      setMcqInstruction(`সঠিক উত্তরের বিপরীতের বৃত্তটি বল পয়েন্ট কলম দ্বারা ভরাট কর। সকল প্রশ্নের উত্তর দিতে হবে: ${toBengaliNumber(selectedMcqs.length)} × ১ = ${toBengaliNumber(selectedMcqs.length)}`);
    }
    if (selectedShorts.length > 0) {
      setShortInstruction(`সকল প্রশ্নের উত্তর দাও: ${toBengaliNumber(selectedShorts.length)} × ২ = ${toBengaliNumber(selectedShorts.length * 2)}`);
    }

    setSetupModalOpen(true);
  };

  // Confirm setup and go to final 2-column print paper
  const handleConfirmAndProceedToPrint = () => {
    setSetupModalOpen(false);
    setIsPrintView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
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

  // ──────────────────────────────────────────────────────────
  // VIEW 1: PRINT VIEW (বোর্ডমানের ২ কলাম রেডিমেড প্রশ্নপত্র)
  // ──────────────────────────────────────────────────────────
  if (isPrintView) {
    return (
      <div className="min-h-screen bg-slate-200 py-6 px-2 sm:px-6 font-kalpurush">
        {/* Floating Top Control Bar (Strictly hidden during print) */}
        <div className="no-print max-w-[8.27in] mx-auto mb-6 bg-white p-3 sm:p-4 rounded-2xl shadow-lg border-2 border-indigo-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsPrintView(false)} 
              className="font-bold text-xs gap-1.5 h-8"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> তালিকায় ফিরে যান
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsPrintView(false);
                setSetupModalOpen(true);
              }}
              className="font-bold text-xs gap-1.5 h-8 border-indigo-300 text-indigo-800"
            >
              <Settings2 className="w-3.5 h-3.5" /> সেটিংস পরিবর্তন
            </Button>
            <span className="text-xs font-black text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 hidden sm:inline">
              মোট প্রশ্ন: {toBengaliNumber(selectedIds.size)}টি | পূর্ণমান: {examTotalMarks}
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
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-1.5 h-8 px-4 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> এখনই প্রিন্ট করুন
            </Button>
            <Button
              onClick={() => {
                if (typeof document !== 'undefined') {
                  document.title = `${institutionName} - ${examName} - ${selectedSubject}`;
                }
                window.print();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 h-8 px-4 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> PDF ডাউনলোড
            </Button>
          </div>
        </div>

        {/* The Printable Board A4 Paper Container */}
        <div className="print-page-container max-w-[8.27in] mx-auto bg-white shadow-2xl rounded-sm p-6 sm:p-10 border border-slate-300 min-h-[11in] text-black leading-relaxed box-border print:p-0 print:border-none print:shadow-none print:max-w-none">
          {/* Institutional Header (Spans across both columns) */}
          <div className="text-center border-b-2 border-black pb-3 mb-5 select-none [column-span:all]">
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

          {/* 2-Column Board Question Flow */}
          <div className="print-two-columns columns-1 md:columns-2 gap-6 [column-rule:0.5pt_solid_#94a3b8]">
            {/* Section 1: Creative Questions (CQ) */}
            {selectedCreatives.length > 0 && (
              <div className="break-inside-avoid-column mb-6">
                <div className="border-b border-black pb-1 mb-3">
                  <div className="font-black text-xs sm:text-sm text-black">
                    {creativeTitle}
                  </div>
                  {creativeInstruction && (
                    <div className="text-[11px] font-bold italic text-slate-700">
                      [{creativeInstruction}]
                    </div>
                  )}
                </div>
                <div className="space-y-4">
                  {selectedCreatives.map((q, idx) => {
                    const startNum = parseInt(creativeStartSerial, 10) || 1;
                    const qNum = toBengaliNumber(startNum + idx);
                    return (
                      <div key={q.id} className="question-item break-inside-avoid text-xs sm:text-[13px] leading-relaxed border-b border-slate-100 pb-3">
                        <div className="flex items-start gap-1.5">
                          <span className="font-black text-sm shrink-0">{qNum}।</span>
                          <div 
                            className="space-y-1.5 flex-1 whitespace-pre-line text-justify math-rendered"
                            dangerouslySetInnerHTML={{ __html: formatContentWithBoardMarks(q.content) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 2: Multiple Choice Questions (MCQ) */}
            {selectedMcqs.length > 0 && (
              <div className="break-inside-avoid-column mb-6">
                <div className="border-b border-black pb-1 mb-3">
                  <div className="font-black text-xs sm:text-sm text-black">
                    {mcqTitle}
                  </div>
                  {mcqInstruction && (
                    <div className="text-[11px] font-bold italic text-slate-700">
                      [{mcqInstruction}]
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {selectedMcqs.map((q, idx) => {
                    const startNum = parseInt(mcqStartSerial, 10) || 1;
                    const qNum = toBengaliNumber(startNum + idx);
                    return (
                      <div key={q.id} className="question-item break-inside-avoid text-xs leading-relaxed border-b border-slate-100 pb-2">
                        <div className="flex items-start gap-1.5">
                          <span className="font-black shrink-0">{qNum}।</span>
                          <div 
                            className="space-y-1 flex-1 whitespace-pre-line math-rendered"
                            dangerouslySetInnerHTML={{ __html: formatContentWithBoardMarks(q.content) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 3: Short Questions */}
            {selectedShorts.length > 0 && (
              <div className="break-inside-avoid-column mb-6">
                <div className="border-b border-black pb-1 mb-3">
                  <div className="font-black text-xs sm:text-sm text-black">
                    {shortTitle}
                  </div>
                  {shortInstruction && (
                    <div className="text-[11px] font-bold italic text-slate-700">
                      [{shortInstruction}]
                    </div>
                  )}
                </div>
                <div className="space-y-3">
                  {selectedShorts.map((q, idx) => {
                    const startNum = parseInt(shortStartSerial, 10) || 1;
                    const qNum = toBengaliNumber(startNum + idx);
                    return (
                      <div key={q.id} className="question-item break-inside-avoid text-xs sm:text-[13px] leading-relaxed border-b border-slate-100 pb-2">
                        <div className="flex items-start gap-1.5">
                          <span className="font-black shrink-0">{qNum}।</span>
                          <div 
                            className="space-y-1 flex-1 whitespace-pre-line math-rendered"
                            dangerouslySetInnerHTML={{ __html: formatContentWithBoardMarks(q.content) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Print Stylesheet: Ensures ZERO clutter and exact 2-column A4 output */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            html, body {
              background: white !important;
              margin: 0 !important;
              padding: 0 !important;
              color: black !important;
            }
            .no-print, header, nav, footer, button, .app-header, .site-header {
              display: none !important;
            }
            @page {
              size: A4 portrait;
              margin: 0.35in 0.4in;
            }
            .print-page-container {
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              box-shadow: none !important;
            }
            .print-two-columns {
              column-count: 2 !important;
              column-gap: 24px !important;
              column-rule: 0.5pt solid #94a3b8 !important;
            }
            .question-item {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
            }
            .board-mark {
              float: right !important;
              font-weight: bold !important;
              margin-left: 8px !important;
            }
          }
        ` }} />
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
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="font-bold text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 h-8 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> নতুন প্রশ্ন যুক্ত করুন
            </Button>
            <Button
              onClick={handleOpenSetupModal}
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
                <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedChapter('all'); }}>
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
                <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSelectedChapter('all'); }}>
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
                  placeholder="যেমন: বাস্তব সংখ্যা, ত্রিভুজ..."
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
              মোট প্রশ্ন: {toBengaliNumber(filteredQuestions.length)}টি
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
              onClick={handleOpenSetupModal}
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
                          dangerouslySetInnerHTML={{ __html: formatContentWithBoardMarks(q.content) }}
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
                          dangerouslySetInnerHTML={{ __html: formatContentWithBoardMarks(q.content) }}
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
                          dangerouslySetInnerHTML={{ __html: formatContentWithBoardMarks(q.content) }}
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

      {/* ── POPUP MODAL: BOARD EXAM CONFIGURATION (বোর্ড সেটআপ ও বিভাগ নির্ধারণ) ── */}
      <Dialog open={setupModalOpen} onOpenChange={setSetupModalOpen}>
        <DialogContent className="max-w-xl font-kalpurush bg-white border-2 border-indigo-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-indigo-950 border-b pb-2">
              <Settings2 className="w-5 h-5 text-indigo-600" /> বোর্ড প্রশ্নপত্র প্রস্তুত ও বিভাগীয় সেটআপ
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Top Exam Header Settings */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <span className="font-black text-slate-800 text-xs">১. পরীক্ষার মূল তথ্য (স্বয়ংক্রিয় প্রস্তুত)</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">প্রতিষ্ঠানের নাম</label>
                  <Input value={institutionName} onChange={e => setInstitutionName(e.target.value)} className="h-8 font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">পরীক্ষার নাম</label>
                  <Input value={examName} onChange={e => setExamName(e.target.value)} className="h-8 font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">পরীক্ষার সময়</label>
                  <Input value={examTime} onChange={e => setExamTime(e.target.value)} className="h-8 font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">পূর্ণমান</label>
                  <Input value={examTotalMarks} onChange={e => setExamTotalMarks(e.target.value)} className="h-8 font-bold" />
                </div>
              </div>
            </div>

            {/* Creative Section Setup (if CQ selected) */}
            {selectedCreatives.length > 0 && (
              <div className="p-3 bg-indigo-50/50 rounded-xl border border-indigo-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-indigo-950 text-xs">সৃজনশীল বিভাগ (ক-বিভাগ: {toBengaliNumber(selectedCreatives.length)}টি প্রশ্ন)</span>
                  <span className="text-[10px] font-bold text-indigo-700">শুরুর ক্রমিক:</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label className="font-bold text-slate-700">বিভাগের শিরোনাম</label>
                    <Input value={creativeTitle} onChange={e => setCreativeTitle(e.target.value)} className="h-8 font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">শুরুর ক্রমিক</label>
                    <Input value={creativeStartSerial} onChange={e => setCreativeStartSerial(e.target.value)} className="h-8 font-bold text-center" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">উত্তর দেওয়ার নির্দেশনা</label>
                  <Input value={creativeInstruction} onChange={e => setCreativeInstruction(e.target.value)} className="h-8 font-bold" />
                </div>
              </div>
            )}

            {/* MCQ Section Setup (if MCQ selected) */}
            {selectedMcqs.length > 0 && (
              <div className="p-3 bg-amber-50/50 rounded-xl border border-amber-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-amber-950 text-xs">বহুনির্বাচনী বিভাগ (খ-বিভাগ: {toBengaliNumber(selectedMcqs.length)}টি প্রশ্ন)</span>
                  <span className="text-[10px] font-bold text-amber-700">শুরুর ক্রমিক:</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label className="font-bold text-slate-700">বিভাগের শিরোনাম</label>
                    <Input value={mcqTitle} onChange={e => setMcqTitle(e.target.value)} className="h-8 font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">শুরুর ক্রমিক</label>
                    <Input value={mcqStartSerial} onChange={e => setMcqStartSerial(e.target.value)} className="h-8 font-bold text-center" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">উত্তর দেওয়ার নির্দেশনা</label>
                  <Input value={mcqInstruction} onChange={e => setMcqInstruction(e.target.value)} className="h-8 font-bold" />
                </div>
              </div>
            )}

            {/* Short Section Setup (if Short selected) */}
            {selectedShorts.length > 0 && (
              <div className="p-3 bg-emerald-50/50 rounded-xl border border-emerald-200 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-950 text-xs">সংক্ষিপ্ত প্রশ্ন বিভাগ (গ-বিভাগ: {toBengaliNumber(selectedShorts.length)}টি প্রশ্ন)</span>
                  <span className="text-[10px] font-bold text-emerald-700">শুরুর ক্রমিক:</span>
                </div>
                <div className="grid grid-cols-3 gap-2">
                  <div className="col-span-2 space-y-1">
                    <label className="font-bold text-slate-700">বিভাগের শিরোনাম</label>
                    <Input value={shortTitle} onChange={e => setShortTitle(e.target.value)} className="h-8 font-bold" />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">শুরুর ক্রমিক</label>
                    <Input value={shortStartSerial} onChange={e => setShortStartSerial(e.target.value)} className="h-8 font-bold text-center" />
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">উত্তর দেওয়ার নির্দেশনা</label>
                  <Input value={shortInstruction} onChange={e => setShortInstruction(e.target.value)} className="h-8 font-bold" />
                </div>
              </div>
            )}

            <div className="p-2.5 bg-blue-50 text-blue-900 rounded-lg text-[11px] font-bold">
              ✓ প্রশ্নপত্রটি স্বয়ংক্রিয়ভাবে ২-কলাম বোর্ড লেআউটে এবং অপ্রয়োজনীয় উপাদান ছাড়াই প্রিন্টের জন্য প্রস্তুত হবে।
            </div>
          </div>

          <DialogFooter className="gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setSetupModalOpen(false)}>বাতিল</Button>
            <Button size="sm" onClick={handleConfirmAndProceedToPrint} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 gap-1.5 shadow-sm">
              <Printer className="w-4 h-4" /> প্রশ্নপত্র প্রস্তুত ও প্রিন্ট ভিউ দেখুন ↗
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
        .board-mark {
          float: right;
          font-weight: bold;
          color: #1e293b;
          margin-left: 8px;
        }
      ` }} />
    </div>
  );
}

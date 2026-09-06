
"use client";

import { useMemo, useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useFirestore, useUser, useCollection } from '@/firebase';
import { collection, query, where, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Edit, 
  Trash2, 
  Loader2, 
  BookOpen, 
  BrainCircuit, 
  ArrowLeft, 
  X, 
  PlusCircle, 
  FilePlus, 
  Layers, 
  LayoutGrid, 
  Download, 
  AlertTriangle, 
  FileType, 
  Eye, 
  Printer,
  CheckCircle2,
  Library,
  ExternalLink,
  ChevronRight
} from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { toast } from '@/hooks/use-toast';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

/**
 * Normalized key for robust data mapping.
 */
function getNormalizedKey(name: string): string {
  if (!name) return 'general';
  let n = name.toString().toLowerCase().trim();
  const bnToEn: Record<string, string> = { '০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9' };
  n = n.replace(/[০-৯]/g, m => bnToEn[m]);
  
  const wordMap: Record<string, string> = {
    'প্রথম': '1', '১ম': '1', '১': '1', '1st': '1',
    'দ্বিতীয়': '2', '২য়': '2', '২': '2', '2nd': '2',
    'তৃতীয়': '3', '৩য়': '3', '৩': '3', '3rd': '3',
    'চতুর্থ': '4', '৪র্থ': '4', '৪': '4', '4th': '4',
    'পঞ্চম': '5', '৫ম': '5', '৫': '5', '5th': '5',
    'ষষ্ঠ': '6', '৬ষ্ঠ': '6', '৬': '6', '6th': '6',
    'সপ্তম': '7', '৭ম': '7', '৭': '7', '7th': '7',
    'অষ্টম': '8', '৮ম': '8', '৮': '8', '8th': '8',
    'নবম': '9', '৯ম': '9', '৯': '9', '9th': '9',
    'দশম': '10', '১০ম': '10', '১০': '10', '10th': '10',
    'একাদশ': '11', '১১': '11', '১১শ': '11',
    'দ্বাদশ': '12', '১২': '12', '১২শ': '12',
    'ত্রয়োদশ': '13', '১৩': '13', '১৩শ': '13',
    'চতুর্দশ': '14', '১৪': '14', '১৪শ': '14',
    'পঞ্চদশ': '15', '১৫': '15', '১৫শ': '15'
  };

  for (const [word, val] of Object.entries(wordMap)) {
    if (n.includes(word)) return val;
  }

  const match = n.match(/\d+/);
  return match ? match[0] : n;
}

function getChapterSortValue(name: string): number {
  const norm = getNormalizedKey(name);
  const num = parseInt(norm);
  return isNaN(num) ? 998 : num;
}

const subjectNameNormalization: { [key: string]: string } = {
    'ধর্ম শিক্ষা': 'ধর্ম ও নৈতিক শিক্ষা',
    'ইসলাম ধর্ম': 'ধর্ম ও নৈতিক শিক্ষা',
    'হিন্দু ধর্ম': 'ধর্ম ও নৈতিক শিক্ষা',
    'বাংলা ১ম': 'বাংলা প্রথম', 'বাংলা 1st': 'বাংলা প্রথম',
    'বাংলা ২য়': 'বাংলা দ্বিতীয়', 'বাংলা 2nd': 'বাংলা দ্বিতীয়',
    'ইংরেজি ১ম': 'ইংরেজি প্রথম', 'ইংরেজি 1st': 'ইংরেজি প্রথম',
    'ইংরেজী ১ম': 'ইংরেজি প্রথম',
    'ইংরেজি ২য়': 'ইংরেজি দ্বিতীয়', 'ইংরেজি 2nd': 'ইংরেজি দ্বিতীয়',
    'ইংরেজী ২য়': 'ইংরেজি দ্বিতীয়',
    'ইংরেজী২য়': 'ইংরেজি দ্বিতীয়',
    'আইসিটি': 'তথ্য ও যোগাযোগ প্রযুক্তি',
    'বিজিএস': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বি ও বি পরিচয়': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বাংলাদেশ ও বিশ্বপরিচয়': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'পদার্থবিজ্ঞান': 'পদার্থ',
    'রসায়ন': 'রসায়ন',
    'জীববিজ্ঞান': 'জীব বিজ্ঞান',
    'সাধারণ গণিত': 'গণিত',
    'সাধারন গণিত': 'গণিত',
    'ম্যাথ': 'গণিত',
    'Mathematics': 'গণিত',
    'Math': 'গণিত',
    'জেনারেল ম্যাথ': 'গণিত',
};

const normalize = (name: string) => {
    if (!name) return "";
    const trimmed = name.trim();
    return (subjectNameNormalization[trimmed] || trimmed).toLowerCase();
};

type ViewMode = 'classes' | 'subjects' | 'chapters' | 'content';
type Category = 'all' | 'sheet' | 'creative' | 'mcq' | 'model' | 'answer';
type FileTypeFilter = 'all' | 'pdf' | 'word' | 'editor';

function MyLibraryContent() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const [viewMode, setViewMode] = useState<ViewMode>('classes');
  const [selectedClass, setSelectedClass] = useState<string | null>(null);
  const [selectedSubject, setSelectedSubject] = useState<string | null>(null);
  const [selectedChapter, setSelectedChapter] = useState<string | null>(null);
  const [activeCategory, setActiveCategory] = useState<Category>('all');
  const [activeFileType, setActiveFileType] = useState<FileTypeFilter>('all');

  const [isSelecting, setIsSelecting] = useState(false);
  const [selectedDocIds, setSelectedDocIds] = useState<string[]>([]);
  const [merging, setMerging] = useState(false);

  const tableContainerRef = useRef<HTMLDivElement>(null);
  const topScrollRef = useRef<HTMLDivElement>(null);

  const handleScrollSync = (source: 'top' | 'table') => {
    const top = topScrollRef.current;
    const table = tableContainerRef.current;
    if (!top || !table) return;

    if (source === 'top') {
      table.scrollLeft = top.scrollLeft;
    } else {
      top.scrollLeft = table.scrollLeft;
    }
  };

  useEffect(() => { if (!userLoading && !user) router.push('/auth'); }, [user, userLoading, router]);

  useEffect(() => {
    const cid = searchParams.get('classId');
    const sub = searchParams.get('subject');
    const ch = searchParams.get('chapter');
    const cat = searchParams.get('category');

    if (cid && sub && ch && cat) {
      setSelectedClass(cid);
      setSelectedSubject(sub);
      setSelectedChapter(ch);
      setActiveCategory(cat as any);
      setViewMode('content');
    }
  }, [searchParams]);

  const questionsQuery = useMemo(() => db && user?.uid ? query(collection(db, 'questions'), where('userId', '==', user.uid)) : null, [db, user?.uid]);
  const sheetsQuery = useMemo(() => db && user?.uid ? query(collection(db, 'lecture-sheets'), where('userId', '==', user.uid)) : null, [db, user?.uid]);
  const pdfSheetsQuery = useMemo(() => db && user?.uid ? query(collection(db, 'pdf-sheets')) : null, [db, user?.uid]);

  const { data: rawQuestions, loading: questionsLoading, error: qError } = useCollection(questionsQuery);
  const { data: rawSheets, loading: sheetsLoading, error: sError } = useCollection(sheetsQuery);
  const { data: rawPdfSheets, loading: pdfSheetsLoading, error: pError } = useCollection(pdfSheetsQuery);

  const libraryData = useMemo(() => ({ 
    questions: rawQuestions || [], 
    sheets: rawSheets || [],
    pdfSheets: rawPdfSheets || []
  }), [rawQuestions, rawSheets, rawPdfSheets]);

  const handleOpenPdf = async (url: string) => {
    if (!url) return;
    const isDataUri = url.startsWith('data:');
    const isPdf = url.startsWith('data:application/pdf');
    const isWord = url.startsWith('data:application/vnd.openxmlformats-officedocument') || url.startsWith('data:application/msword');

    if (isDataUri && (isPdf || isWord)) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } catch (error) {
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  };

  const currentSubjects = useMemo(() => {
    if (!selectedClass) return [];
    const predefined = getSubjectsForClass(selectedClass);
    const fromDb = [
      ...libraryData.questions.filter(q => q.classId === selectedClass).map(q => q.subject),
      ...libraryData.sheets.filter(s => s.classId === selectedClass).map(s => s.subject),
      ...libraryData.pdfSheets.filter(p => p.classId === selectedClass).map(p => p.subject)
    ].filter(Boolean) as string[];
    return Array.from(new Set([...predefined, ...fromDb])).sort((a, b) => a.localeCompare(b, 'bn'));
  }, [selectedClass, libraryData]);

  const currentChapters = useMemo(() => {
    if (!selectedClass || !selectedSubject) return [];
    const predefinedList = getChaptersForSubject(selectedClass, selectedSubject);
    const itemsInSubj = [
       ...libraryData.questions.filter(q => q.classId === selectedClass && q.subject === selectedSubject),
       ...libraryData.sheets.filter(s => s.classId === selectedClass && s.subject === selectedSubject),
       ...libraryData.pdfSheets.filter(p => p.classId === selectedClass && p.subject === selectedSubject)
    ];
    const dbChapters = itemsInSubj.map(i => (i as any).chapter || (i as any).topic || (i as any).chapterName).filter(Boolean) as string[];
    const chapterMap = new Map<string, string>();
    [...predefinedList, ...dbChapters].forEach(name => {
      const key = getNormalizedKey(name);
      if (!chapterMap.has(key) || (predefinedList.includes(name) && !predefinedList.includes(chapterMap.get(key)!))) {
        chapterMap.set(key, name);
      }
    });
    const sortedChapters = Array.from(chapterMap.values()).sort((a, b) => {
      const valA = getChapterSortValue(a);
      const valB = getChapterSortValue(b);
      if (valA !== valB) return valA - valB;
      return a.localeCompare(b, 'bn');
    });
    const hasUncategorized = itemsInSubj.some(i => !(i as any).chapter && !(i as any).topic && !(i as any).chapterName);
    if (hasUncategorized && !chapterMap.has('general')) {
      sortedChapters.unshift('সাধারণ অধ্যায়');
    }
    return sortedChapters.length > 0 ? sortedChapters : ['সাধারণ অধ্যায়'];
  }, [selectedClass, selectedSubject, libraryData]);

  const currentItemsRaw = useMemo(() => {
    let qs = libraryData.questions;
    let ss = libraryData.sheets;
    let ps = libraryData.pdfSheets;

    if (selectedClass) { 
      qs = qs.filter(q => q.classId === selectedClass); 
      ss = ss.filter(s => s.classId === selectedClass);
      ps = ps.filter(p => p.classId === selectedClass);
    }
    if (selectedSubject) { 
      qs = qs.filter(q => q.subject === selectedSubject); 
      ss = ss.filter(s => s.subject === selectedSubject);
      ps = ps.filter(p => p.subject === selectedSubject);
    }
    if (selectedChapter) { 
      const isGeneral = selectedChapter === 'সাধারণ অধ্যায়';
      const selectedKey = getNormalizedKey(selectedChapter);
      qs = qs.filter(q => isGeneral ? (!q.chapter) : (getNormalizedKey(q.chapter) === selectedKey));
      ss = ss.filter(s => isGeneral ? (!s.topic) : (getNormalizedKey(s.topic) === selectedKey));
      ps = ps.filter(p => isGeneral ? (!p.chapterName) : (getNormalizedKey(p.chapterName) === selectedKey));
    }

    if (activeCategory === 'sheet') {
      qs = [];
      ss = ss.filter(s => s.type === 'lecture_sheet' || !s.type);
      ps = ps.filter(p => p.category === 'lecture_sheet');
    } else if (activeCategory === 'creative') {
      qs = qs.filter(q => !q.isMcq && q.examType !== 'model_test');
      ss = ss.filter(s => s.type === 'creative');
      ps = ps.filter(p => p.category === 'creative');
    } else if (activeCategory === 'mcq') {
      qs = qs.filter(q => q.isMcq && q.examType !== 'model_test');
      ss = ss.filter(s => s.type === 'mcq');
      ps = ps.filter(p => p.category === 'mcq');
    } else if (activeCategory === 'model') {
      qs = qs.filter(q => q.examType === 'model_test');
      ss = [];
      ps = ps.filter(p => p.category === 'model_test');
    } else if (activeCategory === 'answer') {
      qs = [];
      ss = [];
      ps = ps.filter(p => p.category === 'answer_key');
    }

    if (activeFileType === 'pdf') {
      qs = [];
      ss = [];
      ps = ps.filter(p => {
        const url = (p.pdfUrl || '').toLowerCase();
        const fName = (p.fileName || '').toLowerCase();
        const isWord = url.includes('officedocument') || url.includes('msword') || fName.endsWith('.doc') || fName.endsWith('.docx');
        const isPdf = (url.startsWith('data:application/pdf') || fName.endsWith('.pdf') || (url.includes('pdf') && url.startsWith('http'))) && !isWord;
        return isPdf;
      });
    } else if (activeFileType === 'word') {
      qs = [];
      ss = [];
      ps = ps.filter(p => {
        const url = (p.pdfUrl || '').toLowerCase();
        const fName = (p.fileName || '').toLowerCase();
        const isWord = url.includes('officedocument') || url.includes('msword') || fName.endsWith('.doc') || fName.endsWith('.docx');
        return isWord;
      });
    } else if (activeFileType === 'editor') {
      ps = [];
    }

    return { questions: qs, sheets: ss, pdfSheets: ps };
  }, [libraryData, selectedClass, selectedSubject, selectedChapter, activeCategory, activeFileType]);

  const combinedItems = useMemo(() => {
    const all = [
      ...currentItemsRaw.sheets.map(i => ({ 
        ...i, 
        source: 'lecture-sheets' as const, 
        displayTitle: i.topic || 'শিরোনামহীন শিট',
        fileType: 'EDITOR' as const 
      })),
      ...currentItemsRaw.pdfSheets.map(i => {
        const url = (i.pdfUrl || '').toLowerCase();
        const fName = (i.fileName || '').toLowerCase();
        const isWord = url.includes('officedocument') || url.includes('msword') || fName.endsWith('.doc') || fName.endsWith('.docx');
        const ft = isWord ? 'WORD' : 'PDF';
        return { 
          ...i, 
          source: 'pdf-sheets' as const, 
          displayTitle: `${i.chapterName} - ${i.subject}`,
          fileType: ft as const
        };
      }),
      ...currentItemsRaw.questions.map(i => ({ 
        ...i, 
        source: 'questions' as const, 
        displayTitle: `${i.exam || 'পরীক্ষা'} - ${i.chapter || 'অধ্যায় নেই'}`,
        fileType: 'EDITOR' as const 
      }))
    ];
    return all.sort((a: any, b: any) => {
      const dateA = a.updatedAt?.toDate?.() || new Date(0);
      const dateB = b.updatedAt?.toDate?.() || new Date(0);
      return dateB.getTime() - dateA.getTime();
    });
  }, [currentItemsRaw]);

  const getChapterStats = (chapterName: string) => {
    const isGeneral = chapterName === 'সাধারণ অধ্যায়';
    const key = getNormalizedKey(chapterName);
    const chapterSheets = libraryData.sheets.filter(s => s.classId === selectedClass && s.subject === selectedSubject && (isGeneral ? !s.topic : getNormalizedKey(s.topic) === key));
    const chapterPdfSheets = libraryData.pdfSheets.filter(p => p.classId === selectedClass && p.subject === selectedSubject && (isGeneral ? !p.chapterName : getNormalizedKey(p.chapterName) === key));
    const chapterQuestionSets = libraryData.questions.filter(q => q.classId === selectedClass && q.subject === selectedSubject && (isGeneral ? !q.chapter : getNormalizedKey(q.chapter) === key));
    
    let totalQuestions = 0, mcqCount = 0, creativeCount = 0;
    chapterQuestionSets.forEach(set => {
      if (set.questions) {
        totalQuestions += set.questions.length;
        set.questions.forEach((q: any) => { if (q.type === 'mcq') mcqCount++; else if (q.type === 'creative') creativeCount++; });
      }
    });
    return { sheets: chapterSheets.length + chapterPdfSheets.length, total: totalQuestions, mcq: mcqCount, creative: creativeCount };
  };

  const getGranularChapterStats = (chapterName: string) => {
    const isGeneral = chapterName === 'সাধারণ অধ্যায়';
    const key = getNormalizedKey(chapterName);
    
    const matches = (val: any) => {
      if (isGeneral) return !val;
      return getNormalizedKey(val || '') === key;
    };

    const chapterSheets = libraryData.sheets.filter(s => s.classId === selectedClass && s.subject === selectedSubject && matches(s.topic));
    const chapterPdfSheets = libraryData.pdfSheets.filter(p => p.classId === selectedClass && p.subject === selectedSubject && matches(p.chapterName));
    const chapterQuestionSets = libraryData.questions.filter(q => q.classId === selectedClass && q.subject === selectedSubject && matches(q.chapter));
    
    const stats = {
      lectureSheet: chapterSheets.length + chapterPdfSheets.filter(p => p.category === 'lecture_sheet').length,
      creative: chapterPdfSheets.filter(p => p.category === 'creative').length,
      mcq: chapterPdfSheets.filter(p => p.category === 'mcq').length,
      modelTest: chapterPdfSheets.filter(p => p.category === 'model_test').length,
      answerKey: chapterPdfSheets.filter(p => p.category === 'answer_key').length,
    };

    chapterQuestionSets.forEach(set => {
      if (set.examType === 'model_test') {
        stats.modelTest++;
      } else {
        if (set.isMcq) stats.mcq++;
        else stats.creative++;
      }
    });

    return stats;
  };

  const toggleSelection = (id: string) => { if (!isSelecting) return; setSelectedDocIds(prev => prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]); };

  const handleMergeAndCreate = async () => {
    if (selectedDocIds.length < 1 || !user?.uid) return;
    setMerging(true);
    try {
      const mergedQuestions: any[] = [];
      const promises = selectedDocIds.map(id => getDocs(query(collection(db!, 'questions'), where('userId', '==', user.uid))));
      const results = await Promise.all(promises);
      results.forEach(snap => snap.docs.forEach(doc => { if (selectedDocIds.includes(doc.id)) { const data = doc.data(); if (data.questions) mergedQuestions.push(...data.questions); } }));
      if (mergedQuestions.length === 0) { toast({ variant: "destructive", title: "ত্রুটি", description: "কোনো প্রশ্ন পাওয়া যায়নি।" }); return; }
      sessionStorage.setItem('merged_questions_data', JSON.stringify(mergedQuestions));
      router.push('/create-question?source=merge');
    } catch (e) { toast({ variant: "destructive", title: "ত্রুটি", description: "প্রশ্ন একত্রীকরণ ব্যর্থ হয়েছে।" }); }
    finally { setMerging(false); }
  };

  const handleDelete = async (id: string, type: 'questions' | 'lecture-sheets' | 'pdf-sheets') => {
    try { await deleteDoc(doc(db!, type, id)); toast({ title: "সফল", description: "আইটেমটি মুছে ফেলা হয়েছে।" }); }
    catch (e) { toast({ variant: "destructive", title: "ত্রুটি", description: "মুছে ফেলা সম্ভব হয়নি।" }); }
  };

  const handleBack = () => {
    if (isSelecting) { setIsSelecting(false); setSelectedDocIds([]); return; }
    if (viewMode === 'content') { setViewMode('chapters'); setSelectedChapter(null); setActiveCategory('all'); setActiveFileType('all'); return; }
    if (viewMode === 'chapters') { setViewMode('subjects'); setSelectedSubject(null); return; }
    if (viewMode === 'subjects') { setViewMode('classes'); setSelectedClass(null); return; }
    router.back();
  };

  const renderClasses = () => (
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-4">
      {CLASSES.map(cls => (
        <Card key={cls.id} onClick={() => { setSelectedClass(cls.id); setViewMode('subjects'); }} className="cursor-pointer hover:border-primary hover:shadow-md transition-all group border-2 border-black">
          <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-white transition-all">
              <GraduationCap className="w-6 h-6" />
            </div>
            <p className="font-black text-base">{cls.label} শ্রেণি</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderSubjects = () => (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      {currentSubjects.map(sub => (
        <Card key={sub} onClick={() => { setSelectedSubject(sub); setViewMode('chapters'); }} className="cursor-pointer hover:border-primary hover:shadow-md transition-all group border-2 border-black">
          <CardContent className="p-6 flex flex-col items-center text-center space-y-3">
            <div className="w-12 h-12 rounded-xl bg-orange-50/10 flex items-center justify-center text-orange-600 group-hover:bg-orange-500 group-hover:text-white transition-all">
              <BookOpen className="w-6 h-6" />
            </div>
            <p className="font-bold text-sm">{sub}</p>
          </CardContent>
        </Card>
      ))}
    </div>
  );

  const renderChapters = () => (
    <div className="border-2 border-black rounded-xl overflow-hidden shadow-xl bg-white animate-in slide-in-from-bottom-4 duration-300">
      <div className="overflow-x-auto">
        <Table className="border-collapse min-w-[1000px]">
          <TableHeader>
            <TableRow className="bg-blue-100 border-b-2 border-black h-12">
              <TableHead className="w-24 text-center font-black border-r-2 border-black text-black">ক্রমিক নং</TableHead>
              <TableHead className="font-black border-r-2 border-black text-black">অধ্যায়ের নাম</TableHead>
              <TableHead className="text-center font-black border-r-2 border-black text-black w-32">লেকচার শিট</TableHead>
              <TableHead className="text-center font-black border-r-2 border-black text-black w-32">সৃজনশীল প্রশ্ন</TableHead>
              <TableHead className="text-center font-black border-r-2 border-black text-black w-32">বহুনির্বাচনী প্রশ্ন</TableHead>
              <TableHead className="text-center font-black border-r-2 border-black text-black w-32">মডেল টেস্ট প্রশ্ন</TableHead>
              <TableHead className="text-center font-black text-black w-32">উত্তরমালা</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentChapters.map((ch, idx) => {
              const stats = getGranularChapterStats(ch);
              return (
                <TableRow 
                  key={ch} 
                  onClick={() => { setSelectedChapter(ch); setViewMode('content'); }}
                  className="h-12 border-b-2 border-black cursor-pointer hover:bg-slate-50 transition-colors"
                >
                  <TableCell className="text-center font-black border-r-2 border-black bg-cyan-400 text-black">
                    {toBengaliNumber(idx + 1).padStart(2, '০')}
                  </TableCell>
                  <TableCell className="font-black border-r-2 border-black bg-green-100 text-black px-4">
                    {ch}
                  </TableCell>
                  <TableCell className="text-center border-r-2 border-black font-black text-xs">
                    {toBengaliNumber(stats.lectureSheet)} টি
                  </TableCell>
                  <TableCell className="text-center border-r-2 border-black font-black text-xs">
                    {toBengaliNumber(stats.creative)} টি
                  </TableCell>
                  <TableCell className="text-center border-r-2 border-black font-black text-xs">
                    {toBengaliNumber(stats.mcq)} টি
                  </TableCell>
                  <TableCell className="text-center border-r-2 border-black font-black text-xs">
                    {toBengaliNumber(stats.modelTest)} টি
                  </TableCell>
                  <TableCell className="text-center font-black text-xs">
                    {toBengaliNumber(stats.answerKey)} টি
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </div>
  );

  const renderSubjectContent = () => (
    <div className="space-y-10">
      <section className="space-y-4">
        <h3 className="text-sm font-black text-primary flex items-center gap-2 border-b-2 border-black pb-2 uppercase tracking-wider"><PlusCircle className="w-4 h-4" /> নতুন তৈরি করুন ({selectedChapter})</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Link href={`/create-lecture-sheet?classId=${selectedClass}&subject=${encodeURIComponent(selectedSubject || '')}&topic=${encodeURIComponent(selectedChapter === 'সাধারণ অধ্যায়' ? '' : (selectedChapter || ''))}`}>
            <Card className="hover:border-orange-500 hover:shadow-lg transition-all group border-l-4 border-l-orange-500 border-t-2 border-r-2 border-black cursor-pointer bg-orange-50/30">
              <CardContent className="p-6 flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-orange-500 flex items-center justify-center text-white group-hover:scale-110 transition-transform"><FilePlus className="w-6 h-6" /></div>
                <div><h4 className="font-black text-orange-700">লেকচার শিট</h4><p className="text-[10px] font-bold text-muted-foreground">এই অধ্যায়ের নোট তৈরি করুন</p></div>
              </CardContent>
            </Card>
          </Link>
          <Dialog>
            <DialogTrigger asChild>
              <Card className="hover:border-primary hover:shadow-lg transition-all group border-l-4 border-l-primary border-t-2 border-r-2 border-black cursor-pointer bg-blue-50/30">
                <CardContent className="p-6 flex items-center gap-4">
                  <div className="w-12 h-12 rounded-xl bg-primary flex items-center justify-center text-white group-hover:scale-110 transition-transform"><BrainCircuit className="w-6 h-6" /></div>
                  <div><h4 className="font-black text-primary">প্রশ্নপত্র</h4><p className="text-[10px] font-bold text-muted-foreground">এই অধ্যায়ের প্রশ্ন তৈরি করুন</p></div>
                </CardContent>
              </Card>
            </DialogTrigger>
            <DialogContent className="font-kalpurush border-2 border-black">
              <DialogHeader><DialogTitle className="font-black text-primary text-xl">প্রশ্নের ধরন নির্বাচন করুন</DialogTitle></DialogHeader>
              <div className="grid grid-cols-1 gap-3 py-4">
                <Button variant="outline" className="h-14 font-bold gap-3 justify-start px-6 border-black" onClick={() => router.push(`/create-question?classId=${selectedClass}&subject=${encodeURIComponent(selectedSubject || '')}&chapter=${encodeURIComponent(selectedChapter === 'সাধারণ অধ্যায়' ? '' : (selectedChapter || ''))}&type=creative`)}>
                  <div className="w-8 h-8 rounded bg-primary/10 text-primary flex items-center justify-center"><FileText className="w-4 h-4" /></div>সৃজনশীল প্রশ্নপত্র</Button>
                <Button variant="outline" className="h-14 font-bold gap-3 justify-start px-6 border-black" onClick={() => router.push(`/create-question?classId=${selectedClass}&subject=${encodeURIComponent(selectedSubject || '')}&chapter=${encodeURIComponent(selectedChapter === 'সাধারণ অধ্যায়' ? '' : (selectedChapter || ''))}&type=mcq`)}>
                  <div className="w-8 h-8 rounded bg-orange-100 text-orange-600 flex items-center justify-center"><BrainCircuit className="w-4 h-4" /></div>বহুনির্বাচনি (MCQ) প্রশ্নপত্র</Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>
      </section>

      <section className="space-y-6">
        <div className="flex flex-col gap-4 border-b-2 border-black pb-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-black text-foreground flex items-center gap-2 uppercase tracking-wider"><LayoutGrid className="w-4 h-4" /> আমার সংগ্রহ ({toBengaliNumber(combinedItems.length)})</h3>
            {currentItemsRaw.questions.length > 0 && (
              <Button variant={isSelecting ? "destructive" : "outline"} size="sm" onClick={() => { setIsSelecting(!isSelecting); setSelectedDocIds([]); }} className="h-8 gap-2 font-bold text-xs border-black">
                {isSelecting ? <X className="w-3.5 h-3.5" /> : <BrainCircuit className="w-3.5 h-3.5" />}{isSelecting ? "বাতিল" : "প্রশ্ন বাছাই করুন"}</Button>
            )}
          </div>
          
          <div className="space-y-2">
            <div className="flex flex-wrap gap-2">
              {[
                { id: 'all', label: 'সকলগুলো', icon: LayoutGrid },
                { id: 'sheet', label: 'লেকচার শিট', icon: BookOpen },
                { id: 'creative', label: 'সৃজনশীল প্রশ্ন', icon: FileText },
                { id: 'mcq', label: 'বহুনির্বাচনী প্রশ্ন', icon: BrainCircuit },
                { id: 'model', label: 'মডেল টেস্ট', icon: BrainCircuit },
                { id: 'answer', label: 'উত্তরমালা', icon: CheckCircle2 }
              ].map((cat) => (
                <Button 
                  key={cat.id} 
                  variant={activeCategory === cat.id ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setActiveCategory(cat.id as any)}
                  className={cn("h-9 gap-2 font-bold text-xs rounded-full border-black", activeCategory === cat.id ? "bg-primary text-white" : "text-muted-foreground")}
                >
                  <cat.icon className="w-3.5 h-3.5" />
                  {cat.label}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap gap-2 mt-2 pt-2 border-t border-black/5">
              {[
                { id: 'all', label: 'সব ফরম্যাট', icon: LayoutGrid },
                { id: 'pdf', label: 'পিডিএফ ফাইল', icon: FileText },
                { id: 'word', label: 'ওয়ার্ড ফাইল', icon: FileType },
                { id: 'editor', label: 'কন্টেন্ট এডিটর', icon: Edit }
              ].map((type) => (
                <Button 
                  key={type.id} 
                  variant={activeFileType === type.id ? 'secondary' : 'ghost'}
                  size="sm"
                  onClick={() => setActiveFileType(type.id as any)}
                  className={cn("h-7 gap-1.5 font-bold text-[10px] rounded-full border border-transparent", 
                    activeFileType === type.id ? "bg-black text-white" : "text-muted-foreground hover:border-black/10")}
                >
                  <type.icon className="w-3 h-3" />
                  {type.label}
                </Button>
              ))}
            </div>
          </div>
        </div>

        <div 
          ref={topScrollRef}
          onScroll={() => handleScrollSync('top')}
          className="overflow-x-auto no-print mb-1 h-3 scrollbar-thin scrollbar-thumb-primary/20"
        >
          <div style={{ width: '1000px', height: '1px' }} />
        </div>

        <div 
          ref={tableContainerRef}
          onScroll={() => handleScrollSync('table')}
          className="border-2 border-black rounded-xl overflow-auto shadow-xl bg-white animate-in slide-in-from-bottom-4 duration-300"
        >
          <Table className="border-collapse min-w-[900px]">
            <TableHeader>
              <TableRow className="bg-blue-100 border-b-2 border-black h-12">
                <TableHead className="w-24 text-center font-black border-r-2 border-black text-black">ক্রমিক নং</TableHead>
                <TableHead className="font-black border-r-2 border-black text-black">শিরোনাম</TableHead>
                <TableHead className="text-center font-black border-r-2 border-black text-black w-32">ধরন</TableHead>
                <TableHead className="text-center font-black text-black w-[200px]">একশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="text-center py-20 text-muted-foreground font-bold italic">এই ক্যাটাগরিতে কোনো তথ্য পাওয়া যায়নি</TableCell>
                </TableRow>
              ) : combinedItems.map((item, idx) => {
                const isSelected = selectedDocIds.includes(item.id);
                return (
                  <TableRow 
                    key={item.id} 
                    className={cn(
                      "h-14 border-b-2 border-black transition-colors hover:bg-slate-50",
                      isSelecting && "cursor-pointer",
                      isSelected && "bg-primary/5"
                    )}
                    onClick={() => isSelecting && toggleSelection(item.id)}
                  >
                    <TableCell className="text-center font-black border-r-2 border-black bg-cyan-400 text-white w-24">
                      {isSelecting ? (
                        <div className={cn("w-6 h-6 mx-auto rounded-full border-2 flex items-center justify-center border-white", isSelected ? "bg-white text-primary" : "")}>
                          {isSelected && <CheckCircle2 className="w-5 h-5" />}
                        </div>
                      ) : toBengaliNumber(idx + 1).padStart(2, '০')}
                    </TableCell>
                    <TableCell className="font-bold border-r-2 border-black bg-green-100 px-4 text-xs md:text-sm">
                      {item.displayTitle}
                    </TableCell>
                    <TableCell className="text-center border-r-2 border-black w-32">
                      <div className="flex items-center justify-center">
                        {item.fileType === 'PDF' && (
                          <div className="flex items-center gap-2 text-rose-600 font-black text-xs">
                             <div className="p-1.5 bg-rose-50 rounded-lg"><FileText className="w-5 h-5" /></div>
                             <span>PDF</span>
                          </div>
                        )}
                        {item.fileType === 'WORD' && (
                          <div className="flex items-center gap-2 text-blue-600 font-black text-xs">
                             <div className="p-1.5 bg-blue-50 rounded-lg"><FileType className="w-5 h-5" /></div>
                             <span>WORD</span>
                          </div>
                        )}
                        {item.fileType === 'EDITOR' && (
                          <div className="flex items-center gap-2 text-orange-600 font-black text-xs">
                             <div className="p-1.5 bg-orange-50 rounded-lg"><Edit className="w-5 h-5" /></div>
                             <span>Editor</span>
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex items-center justify-center gap-2" onClick={e => e.stopPropagation()}>
                        {item.fileType === 'EDITOR' ? (
                          <div className="flex gap-2">
                            {item.source === 'lecture-sheets' ? (
                              <>
                                <Link href={`/create-lecture-sheet?id=${item.id}&print=true`}><Button variant="outline" size="icon" className="h-9 w-9 text-primary border-2 border-primary/20 hover:bg-primary/5" title="দেখুন"><Eye className="h-4 w-4" /></Button></Link>
                                <Link href={`/create-lecture-sheet?id=${item.id}`}><Button variant="outline" size="icon" className="h-9 w-9 text-blue-600 border-2 border-blue-200 hover:bg-blue-50" title="এডিট"><Edit className="w-4 h-4" /></Button></Link>
                                <Link href={`/create-lecture-sheet?id=${item.id}&print=true`}><Button variant="outline" size="icon" className="h-9 w-9 text-orange-600 border-2 border-orange-200 hover:bg-orange-50" title="প্রিন্ট"><Printer className="h-4 w-4" /></Button></Link>
                              </>
                            ) : (
                              <>
                                <Link href={`/create-question?id=${item.id}&print=true`}><Button variant="outline" size="icon" className="h-9 w-9 text-primary border-2 border-primary/20 hover:bg-primary/5" title="দেখুন"><Eye className="h-4 w-4" /></Button></Link>
                                <Link href={`/create-question?id=${item.id}`}><Button variant="outline" size="icon" className="h-9 w-9 text-blue-600 border-2 border-blue-200 hover:bg-blue-50" title="এডিট"><Edit className="w-4 h-4" /></Button></Link>
                                <Link href={`/create-question?id=${item.id}&print=true`}><Button variant="outline" size="icon" className="h-9 w-9 text-orange-600 border-2 border-orange-200 hover:bg-orange-50" title="প্রিন্ট"><Printer className="h-4 w-4" /></Button></Link>
                              </>
                            )}
                          </div>
                        ) : (
                          <div className="flex gap-2">
                             <Button variant="outline" size="icon" className="h-9 w-9 text-primary border-2 border-primary/20" onClick={() => handleOpenPdf(item.pdfUrl)} title="দেখুন"><Eye className="h-4 w-4" /></Button>
                             <Button variant="outline" size="icon" className="h-9 w-9 text-indigo-600 border-2 border-indigo-200" onClick={() => handleOpenPdf(item.pdfUrl)} title="ডাউনলোড"><Download className="h-4 w-4" /></Button>
                          </div>
                        )}
                        
                        {!isSelecting && (
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="ghost" size="icon" className="h-9 w-9 text-rose-500 hover:bg-rose-50" title="মুছে ফেলুন"><Trash2 className="h-4 w-4" /></Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent className="font-kalpurush border-2 border-black">
                              <AlertDialogHeader><AlertDialogTitle className="font-bold">আপনি কি নিশ্চিত?</AlertDialogTitle></AlertDialogHeader>
                              <div className="py-4 text-sm font-bold text-muted-foreground">এই আইটেমটি স্থায়ীভাবে মুছে ফেলা হবে।</div>
                              <AlertDialogFooter>
                                <AlertDialogCancel className="border-black font-bold">বাতিল</AlertDialogCancel>
                                <AlertDialogAction onClick={() => handleDelete(item.id, item.source)} className="bg-destructive text-white font-black">হ্যাঁ, মুছুন</AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        )}
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );

  if (userLoading || questionsLoading || sheetsLoading || pdfSheetsLoading) return <div className="flex flex-col items-center justify-center p-20 min-h-[50vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /><p className="mt-4 text-muted-foreground font-bold">লাইব্রেরি লোড হচ্ছে...</p></div>;

  if (qError || sError || pError) {
    const isBuilding = qError?.message.includes('building') || sError?.message.includes('building') || pError?.message.includes('building');
    return (
      <div className="max-w-xl mx-auto p-10 text-center space-y-6 font-kalpurush">
        <AlertTriangle className={cn("w-16 h-16 text-destructive mx-auto", isBuilding ? "animate-pulse" : "animate-bounce")} />
        <h2 className="text-2xl font-black text-destructive">{isBuilding ? "ইনডেক্স তৈরির কাজ চলছে..." : "লাইব্রেরি লোড হতে সমস্যা হয়েছে"}</h2>
        <p className="text-muted-foreground font-bold">
          {isBuilding 
            ? "ফায়ারবেস বর্তমানে প্রয়োজনীয় ইনডেক্সগুলো তৈরি করছে। এটি সম্পন্ন হতে ২-৫ মিনিট সময় লাগতে পারে। অনুগ্রহ করে কিছুক্ষণ পর পেজটি রিফ্রেশ করুন।" 
            : "ডাটাবেসে ইনডেক্স প্রয়োজন। নিচের লিঙ্কে ক্লিক করে ইনডেক্স তৈরি করুন।"}
        </p>
        {!isBuilding && (
          <a 
            href="https://console.firebase.google.com/v1/r/project/birganj-pouro-high-schoo-9d39d/firestore/indexes" 
            target="_blank" 
            rel="noopener noreferrer"
            className="inline-flex items-center gap-2 bg-indigo-600 text-white px-8 py-3 rounded-xl font-black hover:bg-indigo-700 transition-all shadow-lg"
          >
            <ExternalLink className="w-5 h-5" /> ফায়ারবেস কনসোল
          </a>
        )}
      </div>
    );
  }

  return (
    <div className="max-w-[1200px] mx-auto space-y-6 animate-fade-in pb-16 font-kalpurush">
      <header className="flex flex-col gap-4 border-b-2 border-black pb-6">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-sm border border-white/20"><Library className="w-7 h-7" /></div>
            <div><h2 className="text-2xl font-bold">আমার লাইব্রেরি</h2><p className="text-xs text-muted-foreground font-bold">আপনার সব সংগ্রহ এখানে সুসংগঠিতভাবে সাজানো আছে</p></div>
          </div>
        </div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-secondary/20 p-3 rounded-xl border-2 border-black">
          <div className="flex items-center gap-2 text-xs font-bold overflow-x-auto whitespace-nowrap pb-1 text-muted-foreground scrollbar-hide">
            <span className={cn("cursor-pointer hover:text-primary transition-colors px-1", viewMode === 'classes' && "text-primary")} onClick={() => { setViewMode('classes'); setSelectedClass(null); setSelectedSubject(null); setSelectedChapter(null); setIsSelecting(false); setActiveCategory('all'); setActiveFileType('all'); }}>লাইব্রেরি</span>
            {selectedClass && (<><ChevronRight className="w-3 h-3 shrink-0" /><span className={cn("cursor-pointer hover:text-primary transition-colors px-1", viewMode === 'subjects' && "text-primary")} onClick={() => { setViewMode('subjects'); setSelectedSubject(null); setSelectedChapter(null); setIsSelecting(false); setActiveCategory('all'); setActiveFileType('all'); }}>{CLASSES.find(c => c.id === selectedClass)?.label} শ্রেণি</span></>)}
            {selectedSubject && (<><ChevronRight className="w-3 h-3 shrink-0" /><span className={cn("cursor-pointer hover:text-primary transition-colors px-1", viewMode === 'subjects' && "text-primary")} onClick={() => { setViewMode('subjects'); setSelectedSubject(null); setSelectedChapter(null); setIsSelecting(false); setActiveCategory('all'); setActiveFileType('all'); }}>{selectedSubject}</span></>)}
            {selectedChapter && (<><ChevronRight className="w-3 h-3 shrink-0" /><span className={cn("cursor-pointer hover:text-primary transition-colors px-1", viewMode === 'content' && "text-primary")} onClick={() => { setViewMode('content'); }}>{selectedChapter}</span></>)}
          </div>
          <Button variant="outline" size="sm" onClick={handleBack} className="gap-2 font-bold border-black text-primary h-8 self-end sm:self-center bg-white shadow-sm hover:bg-primary hover:text-white transition-all"><ArrowLeft className="w-3.5 h-3.5" /> ফিরে যান</Button>
        </div>
      </header>
      <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">{viewMode === 'classes' && renderClasses()}{viewMode === 'subjects' && renderSubjects()}{viewMode === 'chapters' && renderChapters()}{viewMode === 'content' && renderSubjectContent()}</div>
      {isSelecting && selectedDocIds.length > 0 && (<div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 animate-in slide-in-from-bottom-10 z-[100]"><Card className="bg-primary text-white shadow-2xl border-2 border-black p-4 flex items-center justify-between"><div className="font-bold flex items-center gap-3"><Badge variant="secondary" className="bg-white text-primary font-black border-black">{toBengaliNumber(selectedDocIds.length)} টি</Badge><span>প্রশ্ন সেট সিলেক্ট করা হয়েছে</span></div><Button onClick={handleMergeAndCreate} disabled={merging} className="bg-white text-primary hover:bg-slate-100 font-black shadow-lg border-black">{merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}বোর্ড প্রশ্ন তৈরি করুন</Button></Card></div>)}
    </div>
  );
}

export default function MyLibraryPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>}>
      <MyLibraryContent />
    </Suspense>
  );
}

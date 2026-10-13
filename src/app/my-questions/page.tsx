
"use client";

import { useMemo, useState, useEffect, Suspense, useCallback, useRef } from 'react';
import { useUser, useFirestore, useCollection } from '@/firebase';
import { collection, query, where, deleteDoc, doc, getDocs } from 'firebase/firestore';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
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
  ChevronRight,
  GraduationCap,
  Filter,
  ListTodo
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
import { subjectNameNormalization } from '@/lib/subjects';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';

const SUBJECT_ORDER = [
  'বাংলা প্রথম', 'বাংলা দ্বিতীয়', 'ইংরেজি প্রথম', 'ইংরেজি দ্বিতীয়', 'গণিত', 
  'ইসলাম ধর্ম ও নৈতিক শিক্ষা', 'হিন্দু ধর্ম ও নৈতিক শিক্ষা', 'বাংলাদেশ ও বিশ্ব পরিচয়', 'সাধারণ বিজ্ঞান', 
  'কৃষি শিক্ষা', 'তথ্য ও যোগাযোগ প্রযুক্তি'
];

const classNamesMap: Record<string, string> = {
  '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function getNormalizedKey(name: string): string {
  if (!name) return 'general';
  let n = name.toString().toLowerCase().trim();
  
  const bnToEn: Record<string, string> = { '০':'0', '১':'1', '২':'2', '৩':'3', '৪':'4', '৫':'5', '৬':'6', '৭':'7', '৮':'8', '৯':'9' };
  n = n.replace(/[০-৯]/g, m => bnToEn[m]);
  
  const romanMap: Record<string, string> = {
    'viii': '8', 'vii': '7', 'iii': '3', 'ii': '2', 'iv': '4', 'vi': '6', 'ix': '9', 'v': '5', 'x': '10', 'i': '1'
  };
  const sortedRomanKeys = ['viii', 'vii', 'iii', 'ii', 'iv', 'vi', 'ix', 'v', 'x', 'i'];
  for (const r of sortedRomanKeys) {
    const regex = new RegExp(`(^|[-_\\s])${r}([-_\\s]|$)`, 'i');
    if (regex.test(n)) {
      n = n.replace(regex, (match, p1, p2) => `${p1}${romanMap[r]}${p2}`);
    }
  }

  const wordMap: Record<string, string> = {
    'প্রথম': '1', '১ম': '1', '১': '1', '1st': '1',
    'দ্বিতীয়': '2', '২য়': '2', '২': '2', '2nd': '2',
    'তৃতীয়': '3', '৩য়': '3', '৩': '3', '3rd': '3',
    'চতুর্থ': '4', 'চতুথ': '4', '৪র্থ': '4', '৪': '4', '4th': '4',
    'পঞ্চম': '5', '৫ম': '5', '৫': '5', '5th': '5',
    'ষষ্ঠ': '6', '৬ষ্ঠ': '6', '৬': '6', '6th': '6',
    'সপ্তম': '7', '৭ম': '7', '৭': '7', '7th': '7',
    'অষ্টম': '8', '৮ম': '8', '৮': '8', '8th': '8',
    'নবম': '9', '৯ম': '9', '৯': '9', '9th': '9',
    'দশম': '10', '১০ম': '10', '১০': '10', '10th': '10',
    'একাদশ': '11', '১১': '11', '১১শ': '11',
    'দ্বাদশ': '12', '১২': '12', '১২শ': '12'
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

  const { data: rawQuestions, loading: questionsLoading } = useCollection(questionsQuery);
  const { data: rawSheets, loading: sheetsLoading } = useCollection(sheetsQuery);
  const { data: rawPdfSheets, loading: pdfSheetsLoading } = useCollection(pdfSheetsQuery);

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
    const baseList = getSubjectsForClass(selectedClass);
    
    const listWithSplitReligion = baseList.flatMap(s => {
      if (s === 'ধর্ম ও নৈতিক শিক্ষা') {
        return ['ইসলাম ধর্ম ও নৈতিক শিক্ষা', 'হিন্দু ধর্ম ও নৈতিক শিক্ষা'];
      }
      return s;
    });

    const fromDb = [
      ...libraryData.questions.filter(q => q.classId === selectedClass).map(q => q.subject),
      ...libraryData.sheets.filter(s => s.classId === selectedClass).map(s => s.subject),
      ...libraryData.pdfSheets.filter(p => p.classId === selectedClass).map(p => p.subject)
    ].filter(Boolean) as string[];
    
    return Array.from(new Set([...listWithSplitReligion, ...fromDb])).sort((a, b) => {
        let indexA = SUBJECT_ORDER.indexOf(a);
        let indexB = SUBJECT_ORDER.indexOf(b);
        if (indexA === -1) indexA = 99;
        if (indexB === -1) indexB = 99;
        if (indexA !== indexB) return indexA - indexB;
        return a.localeCompare(b, 'bn');
    });
  }, [selectedClass, libraryData]);

  const currentChapters = useMemo(() => {
    if (!selectedClass || !selectedSubject) return [];
    const normalizedSubject = normalize(selectedSubject);
    const predefinedList = getChaptersForSubject(selectedClass, selectedSubject);
    
    const itemsInSubj = [
       ...libraryData.questions.filter(q => q.classId === selectedClass && normalize(q.subject) === normalizedSubject),
       ...libraryData.sheets.filter(s => s.classId === selectedClass && normalize(s.subject) === normalizedSubject),
       ...libraryData.pdfSheets.filter(p => p.classId === selectedClass && normalize(p.subject) === normalizedSubject)
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
      const normalizedSub = normalize(selectedSubject);
      qs = qs.filter(q => normalize(q.subject) === normalizedSub); 
      ss = ss.filter(s => normalize(s.subject) === normalizedSub);
      ps = ps.filter(p => normalize(p.subject) === normalizedSub);
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
      ...currentItemsRaw.sheets.map(i => {
        const date = i.updatedAt?.toDate?.() || new Date(0);
        return { 
          ...i, 
          source: 'lecture-sheets' as const, 
          displayTitle: i.topic || 'শিরোনামহীন শিট',
          fileType: 'EDITOR' as const,
          date
        };
      }),
      ...currentItemsRaw.pdfSheets.map(i => {
        const date = i.uploadedAt?.toDate?.() || new Date(0);
        const url = (i.pdfUrl || '').toLowerCase();
        const fName = (i.fileName || '').toLowerCase();
        const isWord = url.includes('officedocument') || url.includes('msword') || fName.endsWith('.doc') || fName.endsWith('.docx');
        const ft: 'WORD' | 'PDF' = isWord ? 'WORD' : 'PDF';
        return { 
          ...i, 
          source: 'pdf-sheets' as const, 
          displayTitle: `${i.chapterName} - ${i.subject}`,
          fileType: ft,
          date
        };
      }),
      ...currentItemsRaw.questions.map(i => {
        const date = i.updatedAt?.toDate?.() || new Date(0);
        return { 
          ...i, 
          source: 'questions' as const, 
          displayTitle: `${i.exam || 'পরীক্ষা'} - ${i.chapter || 'অধ্যায় নেই'}`,
          fileType: 'EDITOR' as const,
          date
        };
      })
    ];
    return all.sort((a: any, b: any) => {
      return b.date.getTime() - a.date.getTime();
    });
  }, [currentItemsRaw]);

  const getGranularChapterStats = (chapterName: string) => {
    const isGeneral = chapterName === 'সাধারণ অধ্যায়';
    const key = getNormalizedKey(chapterName);
    const normalizedSelectedSubject = normalize(selectedSubject || '');
    
    const matches = (val: any) => {
      if (isGeneral) return !val;
      return getNormalizedKey(val || '') === key;
    };

    const chapterSheets = libraryData.sheets.filter(s => s.classId === selectedClass && normalize(s.subject) === normalizedSelectedSubject && matches(s.topic));
    const chapterPdfSheets = libraryData.pdfSheets.filter(p => p.classId === selectedClass && normalize(p.subject) === normalizedSelectedSubject && matches(p.chapterName));
    const chapterQuestionSets = libraryData.questions.filter(q => q.classId === selectedClass && normalize(q.subject) === normalizedSelectedSubject && matches(q.chapter));
    
    const init = () => ({ total: 0, pdf: 0, word: 0, editor: 0 });
    const stats: Record<string, any> = {
      lectureSheet: init(),
      creative: init(),
      mcq: init(),
      modelTest: init(),
      answerKey: init(),
    };

    const getFileType = (p: any) => {
        const url = (p.pdfUrl || '').toLowerCase();
        const fName = (p.fileName || '').toLowerCase();
        const isWord = url.includes('officedocument') || url.includes('msword') || fName.endsWith('.doc') || fName.endsWith('.docx');
        return isWord ? 'word' : 'pdf';
    };

    chapterSheets.forEach(s => {
        stats.lectureSheet.total++;
        stats.lectureSheet.editor++;
    });

    chapterPdfSheets.forEach(p => {
        const mapping: Record<string, string> = {
            'lecture_sheet': 'lectureSheet',
            'creative': 'creative',
            'mcq': 'mcq',
            'model_test': 'modelTest',
            'answer_key': 'answerKey'
        };
        const cat = mapping[p.category] || p.category;
        if (stats[cat]) {
            const type = getFileType(p);
            stats[cat].total++;
            stats[cat][type]++;
        }
    });

    chapterQuestionSets.forEach(set => {
        const cat = set.examType === 'model_test' ? 'modelTest' : (set.isMcq ? 'mcq' : 'creative');
        if (stats[cat]) {
            stats[cat].total++;
            stats[cat].editor++;
        }
    });

    return stats;
  };

  const renderStatCell = (stat: any) => {
    const breakdown = [];
    if (stat.pdf > 0) breakdown.push(`P:${toBengaliNumber(stat.pdf)}`);
    if (stat.word > 0) breakdown.push(`W:${toBengaliNumber(stat.word)}`);
    
    return (
        <div className="flex flex-col items-center justify-center leading-tight">
            <span className={cn("font-black text-xs", stat.total > 0 ? "text-blue-600" : "text-red-600")}>
                {toBengaliNumber(stat.total)} টি
            </span>
            {breakdown.length > 0 && (
                <span className="text-[9px] font-bold text-muted-foreground opacity-60">
                    ({breakdown.join(', ')})
                </span>
            )}
        </div>
    );
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
    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-6">
      {CLASSES.map(cls => {
        const colors: Record<string, string> = {
          '6': 'bg-blue-600 hover:bg-blue-700 border-blue-800',
          '7': 'bg-emerald-600 hover:bg-emerald-700 border-emerald-800',
          '8': 'bg-violet-600 hover:bg-violet-700 border-violet-800',
          '9': 'bg-orange-600 hover:bg-orange-700 border-orange-800',
          '10': 'bg-red-600 hover:bg-red-700 border-red-800',
        };
        const colorClass = colors[cls.id] || 'bg-primary border-primary-foreground';
        
        return (
          <button 
            key={cls.id} 
            onClick={() => { setSelectedClass(cls.id); setViewMode('subjects'); }} 
            className={cn(
              "group relative flex flex-col items-center justify-center p-8 rounded-2xl transition-all duration-200 active:translate-y-1 active:border-b-0 border-b-[6px] shadow-xl text-white",
              colorClass
            )}
          >
            <div className="mb-4 transform group-hover:scale-110 transition-transform duration-300">
              <div className="relative">
                <BookOpen className="w-14 h-14 text-white drop-shadow-[0_4px_4px_rgba(0,0,0,0.5)]" />
              </div>
            </div>
            <span className="font-black text-xl drop-shadow-md">{cls.label} শ্রেণি</span>
          </button>
        );
      })}
    </div>
  );

  const renderSubjects = () => (
    <div className="border-2 border-black rounded-xl overflow-hidden shadow-xl bg-white animate-in slide-in-from-bottom-4 duration-300">
      <div className="overflow-x-auto">
        <Table className="border-collapse min-w-[800px]">
          <TableHeader>
            <TableRow className="bg-blue-100 border-b-2 border-black h-12">
              <TableHead className="w-24 text-center font-black border-r-2 border-black text-black">ক্রমিক নং</TableHead>
              <TableHead className="font-black border-r-2 border-black text-black">বিষয়ের নাম</TableHead>
              <TableHead className="text-center font-black text-black w-48">অধ্যায়সমূহ দেখুন</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {currentSubjects.map((sub, idx) => (
              <TableRow 
                key={sub} 
                onClick={() => { setSelectedSubject(sub); setViewMode('chapters'); }}
                className="h-14 border-b-2 border-black cursor-pointer hover:bg-slate-50 transition-colors"
              >
                <TableCell className="text-center font-black border-r-2 border-black bg-cyan-400 text-black">
                  {toBengaliNumber(idx + 1).padStart(2, '০')}
                </TableCell>
                <TableCell className="font-black border-r-2 border-black bg-green-100 text-black px-4">
                  {sub}
                </TableCell>
                <TableCell className="text-center p-2">
                  <Button 
                    className="bg-red-600 hover:bg-red-700 text-white font-black h-9 px-6 rounded-lg shadow-md border-b-4 border-red-800 active:border-b-0 transition-all"
                  >
                    অধ্যায়সমূহ দেখুন
                  </Button>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
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
                  <TableCell className="text-center border-r-2 border-black">
                    {renderStatCell(stats.lectureSheet)}
                  </TableCell>
                  <TableCell className="text-center border-r-2 border-black">
                    {renderStatCell(stats.creative)}
                  </TableCell>
                  <TableCell className="text-center border-r-2 border-black">
                    {renderStatCell(stats.mcq)}
                  </TableCell>
                  <TableCell className="text-center border-r-2 border-black">
                    {renderStatCell(stats.modelTest)}
                  </TableCell>
                  <TableCell className="text-center">
                    {renderStatCell(stats.answerKey)}
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
    <div className="space-y-4">
        {/* Filter Section based on image */}
        <div className="space-y-4 bg-white/40 p-4 rounded-2xl border-2 border-black/5 shadow-inner no-print">
            <div className="flex items-center gap-2 mb-2">
                <LayoutGrid className="w-5 h-5 text-slate-800" />
                <h3 className="font-black text-slate-800">আমার সংগ্রহ ({toBengaliNumber(combinedItems.length)})</h3>
            </div>

            {/* Category Row */}
            <div className="flex flex-wrap gap-2">
                {[
                    { id: 'all', label: 'সকলগুলো', icon: LayoutGrid },
                    { id: 'sheet', label: 'লেকচার শিট', icon: BookOpen },
                    { id: 'creative', label: 'সৃজনশীল প্রশ্ন', icon: FileText },
                    { id: 'mcq', label: 'বহুনির্বাচনী প্রশ্ন', icon: BrainCircuit },
                    { id: 'model', label: 'মডেল টেস্ট', icon: BrainCircuit },
                    { id: 'answer', label: 'উত্তরমালা', icon: CheckCircle2 }
                ].map((cat) => (
                    <button 
                        key={cat.id} 
                        onClick={() => setActiveCategory(cat.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-4 py-2 rounded-full transition-all font-black text-xs border-2",
                            activeCategory === cat.id 
                                ? "bg-primary text-white border-primary shadow-md" 
                                : "bg-white border-black text-slate-700 hover:bg-slate-50"
                        )}
                    >
                        <cat.icon className="w-3.5 h-3.5" />
                        <span>{cat.label}</span>
                    </button>
                ))}
            </div>

            {/* File Type Row */}
            <div className="flex flex-wrap gap-4 items-center pt-1">
                {[
                    { id: 'all', label: 'সব ফরম্যাট', icon: LayoutGrid },
                    { id: 'pdf', label: 'পিডিএফ ফাইল', icon: FileText },
                    { id: 'word', label: 'ওয়ার্ড ফাইল', icon: FileType },
                    { id: 'editor', label: 'কন্টেন্ট এডিটর', icon: Edit }
                ].map((type) => (
                    <button 
                        key={type.id} 
                        onClick={() => setActiveFileType(type.id as any)}
                        className={cn(
                            "flex items-center gap-2 px-3 py-1.5 transition-all font-black text-xs",
                            activeFileType === type.id 
                                ? "bg-black text-white rounded-lg shadow-md" 
                                : "text-slate-600 hover:text-primary"
                        )}
                    >
                        <type.icon className="w-3.5 h-3.5" />
                        <span>{type.label}</span>
                    </button>
                ))}
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
                <TableHead className="font-black border-r-2 border-black text-black">সেভ নাম (আপলোডের তারিখ ও সময়)</TableHead>
                <TableHead className="text-center font-black border-r-2 border-black text-black w-32">ধরন</TableHead>
                <TableHead className="text-center font-black text-black w-[200px]">একশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {combinedItems.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={5} className="text-center py-20 text-muted-foreground font-bold italic">এই ক্যাটাগরিতে কোনো তথ্য পাওয়া যায়নি</TableCell>
                </TableRow>
              ) : combinedItems.map((item: any, idx) => {
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
                    <TableCell className="font-bold border-r-2 border-black px-4 text-xs">
                      <div className="flex flex-col gap-0.5">
                        <span className="text-slate-900">
                          {item.source === 'pdf-sheets' ? item.fileName : (item.source === 'lecture-sheets' ? item.topic : item.exam) || '-'}
                        </span>
                        <span className="text-red-600 text-[10px]">
                          ({format(item.date, 'dd/MM/yy, hh:mm a', { locale: bn })})
                        </span>
                      </div>
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
    </div>
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 animate-fade-in pb-16 font-kalpurush">
      
      <main className="flex flex-col md:flex-row h-full w-full gap-8">
        
        {/* Sidebar Menubar */}
        <aside className="w-full md:w-72 shrink-0 space-y-6 no-print bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
            <h2 className="text-2xl font-black mb-4 px-4 hidden md:block text-slate-900 tracking-tight">লাইব্রেরি অপশন</h2>
            
            {/* 1. Selectors Section */}
            <Card className="border-2 border-black rounded-2xl overflow-hidden shadow-sm bg-white">
                <CardHeader className="bg-primary/5 p-3 border-b">
                    <CardTitle className="text-xs font-black uppercase text-primary flex items-center gap-2"><Filter className="w-3.5 h-3.5" /> শ্রেণি ও বিষয় নির্বাচন</CardTitle>
                </CardHeader>
                <CardContent className="p-4 space-y-4">
                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">শ্রেণি:</Label>
                        <Select 
                            value={selectedClass || ''} 
                            onValueChange={(val) => {
                                setSelectedClass(val);
                                setViewMode('subjects');
                                setSelectedSubject(null);
                                setSelectedChapter(null);
                                setIsSelecting(false);
                            }}
                        >
                            <SelectTrigger className="h-10 font-bold border-2 border-black"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                            <SelectContent className="font-kalpurush">{CLASSES.map(c => <SelectItem key={c.id} value={c.id} className="font-bold">{c.label} শ্রেণি</SelectItem>)}</SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">বিষয়:</Label>
                        <Select 
                            value={selectedSubject || ''} 
                            onValueChange={(val) => {
                                setSelectedSubject(val);
                                setViewMode('chapters');
                                setSelectedChapter(null);
                                setIsSelecting(false);
                            }}
                            disabled={!selectedClass}
                        >
                            <SelectTrigger className="h-10 font-bold border-2 border-black"><SelectValue placeholder="বিষয় নির্বাচন" /></SelectTrigger>
                            <SelectContent className="font-kalpurush">{currentSubjects.map(s => <SelectItem key={s} value={s} className="font-bold">{s}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-1.5">
                        <Label className="text-[10px] font-black uppercase text-muted-foreground">অধ্যায়:</Label>
                        <Select 
                            value={selectedChapter || ''} 
                            onValueChange={(val) => {
                                setSelectedChapter(val);
                                setViewMode('content');
                            }}
                            disabled={!selectedSubject}
                        >
                            <SelectTrigger className="h-10 font-bold border-2 border-black"><SelectValue placeholder="অধ্যায় নির্বাচন" /></SelectTrigger>
                            <SelectContent className="font-kalpurush">{currentChapters.map(ch => <SelectItem key={ch} value={ch} className="font-bold">{ch}</SelectItem>)}</SelectContent>
                        </Select>
                    </div>
                </CardContent>
            </Card>

            {/* 2. Quick Create Section */}
            {selectedClass && selectedSubject && selectedChapter && (
                <div className="space-y-3 animate-in fade-in zoom-in-95">
                    <p className="text-[10px] font-black uppercase text-slate-500 ml-2">নতুন ফাইল তৈরি</p>
                    <Link href={`/create-lecture-sheet?classId=${selectedClass}&subject=${encodeURIComponent(selectedSubject || '')}&topic=${encodeURIComponent(selectedChapter === 'সাধারণ অধ্যায়' ? '' : (selectedChapter || ''))}`}>
                        <Card className="w-full hover:border-orange-500 hover:shadow-lg transition-all group border-l-4 border-l-orange-500 border-2 border-black border-b-[6px] border-b-orange-800 active:translate-y-1 cursor-pointer bg-orange-50/30 rounded-2xl mb-2">
                            <CardContent className="p-3 flex items-center gap-3">
                                <div className="p-2 rounded-xl bg-orange-500 text-white group-hover:scale-110 transition-transform">
                                    <FilePlus className="w-5 h-5" />
                                </div>
                                <span className="font-black text-orange-900 text-sm">লেকচার শিট</span>
                            </CardContent>
                        </Card>
                    </Link>
                    <Dialog>
                        <DialogTrigger asChild>
                            <Card className="w-full hover:border-primary hover:shadow-lg transition-all group border-l-4 border-l-primary border-2 border-black border-b-[6px] border-b-primary/40 active:translate-y-1 cursor-pointer bg-blue-50/30 rounded-2xl">
                                <CardContent className="p-3 flex items-center gap-3">
                                    <div className="p-2 rounded-xl bg-primary text-white group-hover:scale-110 transition-transform">
                                        <BrainCircuit className="w-5 h-5" />
                                    </div>
                                    <span className="font-black text-primary text-sm">প্রশ্নপত্র</span>
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
            )}

            <Button variant="outline" size="sm" onClick={handleBack} className="w-full gap-2 font-bold border-black text-primary h-11 shrink-0 bg-white shadow-md hover:bg-primary hover:text-white transition-all"><ArrowLeft className="w-4 h-4" /> ফিরে যান</Button>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0 space-y-6">
            <header className="mb-4">
              <h2 className="text-2xl font-black text-foreground">
                {viewMode === 'classes' ? 'শ্রেণি নির্বাচন করুন' : 
                 viewMode === 'subjects' ? `${classNamesMap[selectedClass || '']} শ্রেণির বিষয়সমূহ` :
                 viewMode === 'chapters' ? `${selectedSubject} - অধ্যায়সমূহ` :
                 `${selectedSubject} - ${selectedChapter}`}
              </h2>
              <p className="text-sm font-bold text-muted-foreground mt-1">আপনার সব সংগ্রহ এখানে সুসংগঠিতভাবে সাজানো আছে</p>
            </header>

            <div className="animate-in fade-in slide-in-from-bottom-4 duration-300">
                {viewMode === 'classes' && renderClasses()}
                {viewMode === 'subjects' && renderSubjects()}
                {viewMode === 'chapters' && renderChapters()}
                {viewMode === 'content' && renderSubjectContent()}
            </div>

            {isSelecting && selectedDocIds.length > 0 && (
                <div className="fixed bottom-20 left-1/2 -translate-x-1/2 w-full max-w-lg px-4 animate-in slide-in-from-bottom-10 z-[100]">
                    <Card className="bg-primary text-white shadow-2xl border-2 border-black p-4 flex items-center justify-between">
                        <div className="font-bold flex items-center gap-3">
                            <Badge variant="secondary" className="bg-white text-primary font-black border-black">{toBengaliNumber(selectedDocIds.length)} টি</Badge>
                            <span>প্রশ্ন সেট সিলেক্ট করা হয়েছে</span>
                        </div>
                        <Button onClick={handleMergeAndCreate} disabled={merging} className="bg-white text-primary hover:bg-slate-100 font-black shadow-lg border-black">
                            {merging ? <Loader2 className="w-4 h-4 animate-spin" /> : <BrainCircuit className="w-4 h-4 mr-2" />}বোর্ড প্রশ্ন তৈরি করুন
                        </Button>
                    </Card>
                </div>
            )}
        </div>
      </main>
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

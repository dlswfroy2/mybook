
'use client';

import React, { useState, useEffect, useMemo, useRef, useCallback, Suspense } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from "@/hooks/use-toast";
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Student, studentFromDoc, isFemale, getStudentPlaceholderImage, sanitizePhotoUrl } from '@/lib/student-data';
import { getSubjects, Subject as SubjectType, subjectNameNormalization } from '@/lib/subjects';
import { saveClassResults, getResultsForClass, getAllResults, deleteClassResult, ClassResult, StudentResult } from '@/lib/results-data';
import { processStudentResults, StudentProcessedResult, getGradePoint } from '@/lib/results-calculation';
import Link from 'next/link';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { 
    Trash2, FileUp, Download, FilePen, BookOpen, AlertCircle, Trophy, Printer, Loader2, 
    FileSpreadsheet, CheckCircle2, Save, Star, ChevronRight, LayoutGrid, FileText, 
    Search, Sparkles, Settings, ListTodo, List, XCircle, UserCheck, RefreshCcw, Plus, AlertTriangle, Info, History
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, orderBy, FirestoreError, getDocs, limit, doc, writeBatch, serverTimestamp, Timestamp, QueryDocumentSnapshot } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError, type SecurityRuleContext } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/useAuth';
import { getExams, Exam } from '@/lib/exam-data';
import { Badge } from '@/components/ui/badge';
import Image from 'next/image';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { SpecialClassResult, saveSpecialResults, getSpecialResultsForClass } from '@/lib/special-results-data';
import { Skeleton } from '@/components/ui/skeleton';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter, DialogClose, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useRouter, useSearchParams } from 'next/navigation';

const BENGALI_MONTHS = [
    'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 
    'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const classNamesMap: { [key: string]: string } = { '6': 'ষষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': 'দশম' };
const groupNamesMap: { [key: string]: string } = { 'science': 'বিজ্ঞান', 'arts': 'মানবিক', 'commerce': 'ব্যবসায় শিক্ষা', 'all': 'সকল শাখা' };
const groupMap: Record<string, string> = { 
    'science': 'science', 'বিজ্ঞান': 'science',
    'arts': 'arts', 'মানবিক': 'arts', 'humanities': 'arts',
    'commerce': 'commerce', 'ব্যবসায় শিক্ষা': 'commerce', 'ব্যবসায় শিক্ষা': 'commerce', 'business': 'commerce'
};

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const normalize = (name: string) => {
    if (!name) return "";
    const trimmed = name.trim();
    return (subjectNameNormalization[trimmed] || trimmed).toLowerCase();
};

type Marks = {
    written?: number;
    mcq?: number;
    practical?: number;
}

function ResultsContent() {
    const [isClient, setIsClient] = useState(false); 
    const [allStudents, setAllStudents] = useState<Student[]>([]); 
    const [isLoading, setIsLoading] = useState(true);
    const db = useFirestore(); 
    const { selectedYear } = useAcademicYear(); 
    const { user, hasPermission } = useAuth();
    const { schoolInfo } = useSchoolInfo();
    const searchParams = useSearchParams();
    
    const canViewRes = hasPermission('manage:results') || hasPermission('input:results');
    const canManageFullMarks = hasPermission('manage:full-marks') || hasPermission('manage:results');

    const [activeSection, setActiveSection] = useState<string>('management');
    const [hasInitialSection, setHasInitialSection] = useState(false);
    const [printingReport, setPrintingReport] = useState<any>(null);
    const [fullSheetPrintData, setFullSheetPrintData] = useState<any>(null);
    const [specialPrintData, setSpecialPrintData] = useState<any>(null);

    useEffect(() => {
        setIsClient(true); 
        if (!db || !user?.uid) return;
        const unsubscribe = onSnapshot(query(collection(db, "students")), (snap) => { 
            setAllStudents(snap.docs.map(studentFromDoc)); 
            setIsLoading(false); 
        }, (err) => { 
            console.error("Firestore error:", err);
            setIsLoading(false); 
        });
        return () => unsubscribe();
    }, [db, user?.uid]);

    useEffect(() => {
        const tab = searchParams.get('tab');
        if (tab && !hasInitialSection) {
            setActiveSection(tab);
            setHasInitialSection(true);
        }
    }, [searchParams, hasInitialSection]);

    useEffect(() => {
        if (hasInitialSection || !user?.uid) return;
        
        let section = 'management';
        if (canViewRes) section = 'management';
        else if (canManageFullMarks) section = 'full-marks';
        else if (hasPermission('view:merit-list')) section = 'merit';
        else if (hasPermission('promote:students')) section = 'promotion';
        else if (hasPermission('manage:special-results')) section = 'special-exam';
        
        setActiveSection(section);
        setHasInitialSection(true);
    }, [canViewRes, canManageFullMarks, hasPermission, user?.uid, hasInitialSection]);

    const handleSubjectPrint = (data: any) => {
        setPrintingReport(data);
        setTimeout(() => { window.print(); setPrintingReport(null); }, 300);
    };

    const handleFullSheetPrint = (data: any) => {
        setFullSheetPrintData(data);
        setTimeout(() => { window.print(); setFullSheetPrintData(null); }, 800);
    };

    const handleSpecialPrint = (data: any) => {
        setSpecialPrintData(data);
        setTimeout(() => { window.print(); setSpecialPrintData(null); }, 800);
    };

    const sidebarItems = useMemo(() => {
        return [
            { id: 'management', label: 'নম্বর ইনপুট', icon: FilePen, color: 'text-indigo-600 bg-indigo-50' },
            { id: 'subject-report', label: 'বিষয় ভিত্তিক রিপোর্ট', icon: FileText, color: 'text-emerald-600 bg-emerald-50' },
            { id: 'sheet', label: 'ফলাফল শিট', icon: FileSpreadsheet, color: 'text-blue-600 bg-blue-50' },
            { id: 'search', label: 'ফলাফল অনুসন্ধান', icon: Search, color: 'text-blue-600 bg-blue-50' },
            { id: 'full-marks', label: 'বিষয় ও পূর্ণমান', icon: CheckCircle2, color: 'text-violet-600 bg-violet-50' },
            { id: 'merit', label: 'মেধা তালিকা', icon: Trophy, color: 'text-amber-600 bg-amber-50' },
            { id: 'promotion', label: 'প্রমোশন', icon: Star, color: 'text-rose-600 bg-rose-50' },
            { id: 'upload', label: 'Excel আপলোড', icon: FileUp, color: 'text-blue-600 bg-blue-50' },
            { id: 'special-exam', label: 'বিশেষ পরীক্ষা', icon: Sparkles, color: 'text-amber-600 bg-amber-50' },
        ];
    }, []);

    return (
        <div className="flex min-h-screen w-full flex-col font-kalpurush">
            <main className="flex-1 p-4 md:p-8 no-print pb-20">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-8">
                    <aside className="w-full md:w-64 shrink-0 space-y-1 bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
                        <h2 className="text-2xl font-black mb-6 px-4 hidden md:block text-slate-900 tracking-tight">ফলাফল ব্যবস্থাপনা</h2>
                        <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
                            {sidebarItems.map(item => (
                                <button 
                                    key={item.id} 
                                    onClick={() => setActiveSection(item.id)} 
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold whitespace-nowrap min-w-fit border-2", 
                                        activeSection === item.id ? "bg-white border-primary border-b-4 shadow-xl text-primary scale-105 -translate-y-0.5" : "bg-slate-50/50 border-slate-200 border-b-2 text-muted-foreground hover:bg-white hover:border-primary/30"
                                    )}
                                >
                                    <div className={cn("p-1.5 rounded-lg shrink-0", activeSection === item.id ? item.color : "bg-muted")}>
                                        <item.icon className="h-3.5 w-3.5" />
                                    </div>
                                    <span className="text-sm font-black">{item.label}</span>
                                    {activeSection === item.id && <ChevronRight className="ml-auto h-3.5 w-3.5 hidden md:block" />}
                                </button>
                            ))}
                        </div>
                    </aside>
                    <div className="flex-1 min-w-0 bg-white md:rounded-[32px] shadow-2xl md:border-[1px] border-slate-200/50 overflow-hidden min-h-[700px] flex flex-col transition-all duration-500 animate-in fade-in slide-in-from-right-4">
                        <div className="p-4 sm:p-6 lg:p-8 flex-1">
                            <div className="mb-6 border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print"><div><h2 className="text-2xl font-black text-slate-800">{sidebarItems.find(i => i.id === activeSection)?.label}</h2><p className="text-[10px] font-bold text-muted-foreground mt-1 uppercase tracking-widest">{schoolInfo.name}</p></div></div>
                            {isLoading ? (<div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>) : (
                                <div className="animate-in fade-in duration-500">
                                    {activeSection === 'management' && <MarkManagementTab allStudents={allStudents} />}
                                    {activeSection === 'subject-report' && <SubjectReportTab allStudents={allStudents} onPrintRequested={handleSubjectPrint} />}
                                    {activeSection === 'sheet' && <ResultSheetTab allStudents={allStudents} onPrint={handleFullSheetPrint} />}
                                    {activeSection === 'search' && <ResultSearchTab allStudents={allStudents} />}
                                    {activeSection === 'full-marks' && <FullMarksTab allStudents={allStudents} />}
                                    {activeSection === 'merit' && <MeritListTab allStudents={allStudents} />}
                                    {activeSection === 'promotion' && <PromotionTab allStudents={allStudents} />}
                                    {activeSection === 'upload' && <BulkUploadTab />}
                                    {activeSection === 'special-exam' && <SpecialExamTab allStudents={allStudents} onPrintRequested={handleSpecialPrint} />}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </main>

            {printingReport && (
                <div className="hidden print:block printable-area bg-white text-black p-10 font-kalpurush border-2">
                    <style jsx global>{`
                        @media print {
                            @page { size: A4; margin: 0.4in !important; }
                            .printable-area { padding: 0 !important; margin: 0 !important; border: none !important; }
                            .printable-area table tr { height: auto !important; }
                            .printable-area table td, .printable-area table th { padding: 2px 8px !important; font-size: 11px !important; border: 1px solid black !important; }
                            .no-print { display: none !important; }
                        }
                    `}</style>
                    <header className="flex items-center gap-6 border-b-4 border-emerald-800 pb-4 mb-6">{schoolInfo.logoUrl && <img src={schoolInfo.logoUrl} alt="Logo" className="w-[80px] h-[80px] object-contain" />}<div className="text-center flex-grow"><h1 className="text-3xl font-black text-emerald-950 leading-none mb-1">{schoolInfo.name}</h1><p className="text-sm font-bold text-slate-700">{schoolInfo.address}</p><div className="mt-2 inline-block bg-emerald-50 px-6 py-0.5 rounded-full border-2 border-emerald-800"><h2 className="text-lg font-black uppercase">{printingReport.isBlank ? 'ফাঁকা নম্বর ফর্দ (Blank Mark Sheet)' : 'নম্বর ফর্দ (Mark Sheet)'} - {toBengaliNumber(selectedYear)}</h2></div></div></header>
                    <Table className="border-2 border-black">
                        <TableHeader className="bg-slate-100"><TableRow className="border-b-2 border-black"><TableHead className="w-16 text-center font-black border-r-2 border-black text-black">রোল</TableHead><TableHead className="font-black border-r-2 border-black text-black">শিক্ষার্থীর নাম</TableHead><TableHead className="w-20 text-center font-black border-r-2 border-black text-black">লিখিত</TableHead><TableHead className="w-20 text-center font-black border-r-2 border-black text-black">নৈবেত্তিক</TableHead><TableHead className="w-20 text-center font-black border-r-2 border-black text-black">ব্যবহারিক</TableHead><TableHead className={cn("w-20 text-center font-black text-black", !printingReport.isBlank && "border-r-2 border-black")}>{printingReport.isBlank ? 'মোট' : 'প্রাপ্ত'}</TableHead>{!printingReport.isBlank && <TableHead className="w-20 text-center font-black border-r-2 border-black text-black">গ্রেড</TableHead>}{!printingReport.isBlank && <TableHead className="w-20 text-center font-black text-black">পয়েন্ট</TableHead>}</TableRow></TableHeader>
                        <TableBody>
                          {printingReport.studentData.map((item: any) => (
                            <TableRow key={item.student.id} className={cn("border-b border-slate-400", printingReport.isBlank ? "h-12" : "h-7", !item.isPass && "bg-rose-50/50")}>
                                <TableCell className="text-center font-black border-r-2 border-black">{toBengaliNumber(item.student.roll)}</TableCell>
                                <TableCell className="font-bold border-r-2 border-black">{item.student.studentNameBn}</TableCell>
                                <TableCell className="text-center border-r-2 border-black">{printingReport.isBlank ? '' : toBengaliNumber(item.marks.written ?? '-')}</TableCell>
                                <TableCell className="text-center border-r-2 border-black">{printingReport.isBlank ? '' : toBengaliNumber(item.marks.mcq ?? '-')}</TableCell>
                                <TableCell className="text-center border-r-2 border-black">{printingReport.isBlank ? '' : toBengaliNumber(item.marks.practical ?? '-')}</TableCell>
                                <TableCell className="text-center font-black border-r-2 border-black">{printingReport.isBlank ? '' : toBengaliNumber(item.obtainedMarks)}</TableCell>
                                {!printingReport.isBlank && (
                                    <>
                                        <TableCell className="text-center font-black border-r-2 border-black">{item.grade}</TableCell>
                                        <TableCell className="text-center font-black">{toBengaliNumber(item.point.toFixed(2))}</TableCell>
                                    </>
                                )}
                            </TableRow>
                          ))}
                        </TableBody>
                    </Table>
                    <footer className="mt-20 flex justify-between px-10 no-screen"><div className="text-center w-48 border-t-2 border-black pt-1 font-black">শ্রেণি শিক্ষকের স্বাক্ষর</div><div className="text-center w-48 border-t-2 border-black pt-1 font-black">প্রধান শিক্ষকের স্বাক্ষর</div></footer>
                </div>
            )}

            {fullSheetPrintData && (
                <div className="hidden print:block printable-area bg-white text-black p-4 font-kalpurush w-full">
                    <style jsx global>{`
                        @media print {
                            @page { size: A4 landscape; margin: 5mm !important; }
                            .printable-area { width: 100% !important; padding: 0 !important; }
                            table { border-collapse: collapse !important; border: 1px solid black !important; width: 100% !important; table-layout: auto !important; }
                            th, td { border: 1px solid black !important; padding: 1px !important; font-size: 8px !important; line-height: 1.1 !important; }
                            .no-print { display: none !important; }
                        }
                    `}</style>
                    <header className="text-center border-b-2 border-black pb-2 mb-4 flex flex-col items-center">
                        {schoolInfo.logoUrl && <img src={schoolInfo.logoUrl} alt="Logo" className="w-12 h-12 object-contain mb-1" />}
                        <h1 className="text-xl font-black">{schoolInfo.name}</h1>
                        <p className="text-[12px] font-bold">{schoolInfo.address}</p>
                        <div className="mt-1 inline-block border border-black px-6 py-1 rounded-full font-black text-xs uppercase">
                            {fullSheetPrintData.examName} - ফলাফল বিবরণী শিট ({classNamesMap[fullSheetPrintData.className]})
                        </div>
                        <p className="text-[12px] font-bold mt-1">শিক্ষাবর্ষ: {toBengaliNumber(selectedYear)}</p>
                    </header>

                    {Object.keys(fullSheetPrintData.results).map(groupKey => {
                        const results = fullSheetPrintData.results[groupKey];
                        const className = fullSheetPrintData.className;
                        const classResults = fullSheetPrintData.classResults;
                        
                        const allSubs = getSubjects(className, groupKey === 'all' ? undefined : groupKey);
                        const subjects = allSubs.filter(s => {
                            if (!s.isExamSubject) return false;
                            const matchingRecord = classResults.find((r: any) => {
                                const nameMatch = normalize(r.subject) === normalize(s.name);
                                if (!nameMatch) return false;
                                
                                if (parseInt(className) >= 9) {
                                    const rGroupRaw = (r.group || 'none').toLowerCase().trim();
                                    const rGroupNorm = groupMap[rGroupRaw] || rGroupRaw;
                                    const groupKeyNorm = groupMap[groupKey.toLowerCase().trim()] || groupKey.toLowerCase().trim();
                                    
                                    return rGroupNorm === 'none' || rGroupNorm === groupKeyNorm || groupKey === 'all';
                                }
                                return true;
                            });
                            const effectiveFullMarks = matchingRecord?.fullMarks ?? s.fullMarks;
                            return effectiveFullMarks > 0;
                        });

                        return (
                            <div key={groupKey} className="mb-10 break-after-page">
                                {groupKey !== 'all' && <h3 className="font-black text-sm mb-2 text-primary border-l-4 border-primary pl-2">শাখা: {groupNamesMap[groupKey] || groupKey}</h3>}
                                <table className="w-full border-collapse border-2 border-black">
                                    <thead>
                                        <tr className="bg-slate-100">
                                            <th rowSpan={2} className="border border-black font-black p-1 w-8">রোল</th>
                                            <th rowSpan={2} className="border border-black font-black p-1 min-w-[100px]">শিক্ষার্থীর নাম</th>
                                            {subjects.map(s => (
                                                <th key={s.name} colSpan={s.name.includes('ইংরেজি') ? 3 : (s.practical ? 6 : 5)} className="border border-black font-black p-1 text-[9px]">{s.name}</th>
                                            ))}
                                            <th rowSpan={2} className="border border-black font-black p-1 w-10">মোট</th>
                                            <th rowSpan={2} className="border border-black font-black p-1 w-10">GPA</th>
                                            <th rowSpan={2} className="border border-black font-black p-1 w-10">গ্রেড</th>
                                            <th rowSpan={2} className="border border-black font-black p-1 w-10">মেধা</th>
                                        </tr>
                                        <tr className="bg-slate-50">
                                            {subjects.map(s => {
                                                const isEng = s.name.includes('ইংরেজি');
                                                return (
                                                    <React.Fragment key={`${s.name}-headers`}>
                                                        {!isEng && (
                                                            <>
                                                                <th className="border border-black font-bold p-0.5 text-[8px]">লি:</th>
                                                                <th className="border border-black font-bold p-0.5 text-[8px]">M</th>
                                                                {s.practical && <th className="border border-black font-bold p-0.5 text-[8px]">ব্যাব:</th>}
                                                            </>
                                                        )}
                                                        <th className="border border-black font-black bg-blue-50 p-0.5 text-[8px]">মোট</th>
                                                        <th className="border border-black font-bold p-0.5 text-[8px]">গ্রেড</th>
                                                        <th className="border border-black font-bold p-0.5 text-[8px]">পয়েন্ট</th>
                                                    </React.Fragment>
                                                )
                                            })}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {results.map((res: StudentProcessedResult) => (
                                            <tr key={res.student.id} className="h-8 border border-black hover:bg-slate-50">
                                                <td className="border border-black text-center font-black">{toBengaliNumber(res.student.roll)}</td>
                                                <td className="border border-black font-bold px-2">{res.student.studentNameBn}</td>
                                                {subjects.map(s => {
                                                    const sr = res.subjectResults.get(s.name);
                                                    const isEng = s.name.includes('ইংরেজি');
                                                    return (
                                                        <React.Fragment key={`${res.student.id}-${s.name}`}>
                                                            {!isEng && (
                                                                <>
                                                                    <td className="border-black text-center">{toBengaliNumber(sr?.written ?? '-')}</td>
                                                                    <td className="border border-black text-center">{toBengaliNumber(sr?.mcq ?? '-')}</td>
                                                                    {s.practical && <td className="border border-black text-center">{toBengaliNumber(sr?.practical ?? '-')}</td>}
                                                                </>
                                                            )}
                                                            <td className="border border-black text-center font-black bg-blue-50">{toBengaliNumber(sr?.marks ?? '-')}</td>
                                                            <td className="border border-black text-center font-black">{sr?.grade ?? '-'}</td>
                                                            <td className="border border-black text-center font-bold">{toBengaliNumber(sr?.point?.toFixed(2) ?? '-')}</td>
                                                        </React.Fragment>
                                                    )
                                                })}
                                                <td className="border border-black text-center font-black text-primary">{toBengaliNumber(res.totalMarks)}</td>
                                                <td className="border border-black text-center font-black">{toBengaliNumber(res.gpa.toFixed(2))}</td>
                                                <td className={cn("border border-black text-center font-black", !res.isPass && "text-red-600")}>{res.isPass ? res.finalGrade : `F${toBengaliNumber(res.failedSubjectsCount)}`}</td>
                                                <td className="border border-black text-center font-black">{res.isPass ? toBengaliNumber(res.meritPosition || '-') : 'ফেল'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        );
                    })}

                    <footer className="mt-16 flex justify-between px-16">
                        <div className="text-center w-48 border-t border-black pt-1 font-black text-xs">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                        <div className="text-center w-48 border-t border-black pt-1 font-black text-xs">প্রধান শিক্ষকের স্বাক্ষর</div>
                    </footer>
                </div>
            )}

            {specialPrintData && (
                <div className="hidden print:block printable-area bg-white text-black p-4 font-kalpurush w-full box-border border-[6px] border-double border-black/30">
                    <style jsx global>{`
                        @media print {
                            @page { size: A4 landscape; margin: 5mm !important; }
                            .printable-area { width: 100% !important; padding: 0 !important; }
                            table { border-collapse: collapse !important; border: 1px solid black !important; width: 100% !important; }
                            th, td { border: 1px solid black !important; padding: 1px !important; font-size: 8px !important; }
                        }
                    `}</style>
                    <header className="text-center border-b-2 border-black pb-3 mb-6">
                        {schoolInfo.logoUrl && <img src={schoolInfo.logoUrl} alt="Logo" className="w-16 h-16 mx-auto mb-2" />}
                        <h1 className="text-2xl font-black">{schoolInfo.name}</h1>
                        <p className="text-xs font-bold">{schoolInfo.address}</p>
                        <div className="mt-2 inline-block border-2 border-black px-6 py-0.5 rounded-full font-black text-sm uppercase">{specialPrintData.month} মাসের বিশেষ পরীক্ষার ফলাফল শিট - {toBengaliNumber(specialPrintData.year)}</div>
                    </header>

                    <table className="w-full border-collapse border-2 border-black">
                        <thead>
                            <tr className="bg-slate-100">
                                <th rowSpan={2} className="border-2 border-black font-black p-1 w-10 text-center">রোল</th>
                                <th rowSpan={2} className="border-2 border-black font-black p-1 text-left pl-3">শিক্ষার্থীর নাম</th>
                                {specialPrintData.availableSubjects.map((sub: any) => (
                                    <th key={sub.name} colSpan={3} className="border-2 border-black font-black p-1 text-center">{sub.name}</th>
                                ))}
                                <th rowSpan={2} className="border-2 border-black font-black p-1 w-20 text-center bg-slate-50">মোট</th>
                            </tr>
                            <tr className="bg-slate-50">
                                {specialPrintData.availableSubjects.map((sub: any) => (
                                    <React.Fragment key={`${sub.name}-hp`}>
                                        <th className="border-2 border-black font-black p-0.5 w-8 text-center">প-১</th>
                                        <th className="border-2 border-black font-black p-0.5 w-8 text-center">প-২</th>
                                        <th className="border-2 border-black font-black p-0.5 w-8 text-center">প-৩</th>
                                    </React.Fragment>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {specialPrintData.students.map((student: any) => {
                                let total = 0;
                                return (
                                    <tr key={student.id} className="h-8 border-b border-black">
                                        <td className="border-2 border-black text-center font-black">{toBengaliNumber(student.roll)}</td>
                                        <td className="border-2 border-black font-bold px-2">{student.studentNameBn}</td>
                                        {specialPrintData.availableSubjects.map((sub: any) => (
                                            <React.Fragment key={`${student.id}-${sub.name}`}>
                                                {['বিশেষ পরীক্ষা-১', 'বিশেষ পরীক্ষা-২', 'বিশেষ পরীক্ষা-৩'].map((type) => {
                                                    const match = specialPrintData.allSpecialResults.find((r: any) => {
                                                        const normalizedSearch = normalize(sub.name);
                                                        const normalizedRecord = normalize(r.subject);
                                                        if (sub.isCombined) return sub.subList.some((innerSub: string) => normalizedRecord === normalizedRecord) && r.examType === type;
                                                        return normalizedRecord === normalizedSearch && r.examType === type;
                                                    });
                                                    const marks = match?.results.find((res: any) => res.studentId === student.id)?.marks;
                                                    if (marks !== undefined) total += marks;
                                                    return <td key={type} className={cn("border-2 border-black text-center font-black")}>{marks !== undefined ? toBengaliNumber(marks) : '-'}</td>;
                                                })}
                                            </React.Fragment>
                                        ))}
                                        <td className="border-2 border-black text-center font-black bg-slate-50">{toBengaliNumber(total)}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>

                    <footer className="mt-16 flex justify-between px-10">
                        <div className="text-center w-48 border-t border-black pt-1 font-black text-xs">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                        <div className="text-center w-48 border-t border-black pt-1 font-black text-xs">প্রধান শিক্ষকের স্বাক্ষর</div>
                    </footer>
                </div>
            )}
        </div>
    );
}

export default function ResultsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-20 font-kalpurush"><Loader2 className="animate-spin text-primary" /></div>}>
      <ResultsContent />
    </Suspense>
  );
}

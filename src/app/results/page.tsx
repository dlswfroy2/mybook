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
    Search, Sparkles, Settings, ListTodo, List, XCircle, UserCheck, RefreshCcw, Plus, AlertTriangle, Info, History, FilePlus
} from 'lucide-react';
import * as XLSX from 'xlsx';
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useFirestore } from '@/firebase';
import { collection, onSnapshot, query, where, orderBy, FirestoreError, getDocs, getDoc, limit, doc, writeBatch, serverTimestamp, Timestamp, QueryDocumentSnapshot } from 'firebase/firestore';
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

// --- Sub Tabs Components ---

function MarkManagementTab({ allStudents }: { allStudents: Student[] }) {
    const db = useFirestore();
    const { toast } = useToast();
    const { selectedYear } = useAcademicYear();
    const { hasPermission, user } = useAuth();

    const [selectedExam, setSelectedExam] = useState('');
    const [selectedClass, setSelectedClass] = useState('6');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [exams, setExams] = useState<Exam[]>([]);
    
    const [fullMarks, setFullMarks] = useState(100);
    const [marksData, setMarksData] = useState<Record<string, { written?: number, mcq?: number, practical?: number }>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLoadingResults, setIsLoadingResults] = useState(false);

    useEffect(() => {
        if (db) getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear]);

    const filteredStudents = useMemo(() => {
        return allStudents.filter(s => 
            s.academicYear === selectedYear && 
            s.className === selectedClass && 
            (selectedGroup === 'all' || (s.group || '').toLowerCase() === selectedGroup.toLowerCase())
        ).sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
    }, [allStudents, selectedYear, selectedClass, selectedGroup]);

    const availableSubjects = useMemo(() => getSubjects(selectedClass, selectedGroup === 'all' ? undefined : selectedGroup), [selectedClass, selectedGroup]);
    const currentSubjectInfo = useMemo(() => availableSubjects.find(s => s.name === selectedSubject), [availableSubjects, selectedSubject]);

    const fetchExistingResults = useCallback(async () => {
        if (!db || !selectedExam || !selectedClass || !selectedSubject) return;
        setIsLoadingResults(true);
        try {
            const data = await getResultsForClass(db, selectedYear, selectedExam, selectedClass, selectedSubject, selectedGroup === 'all' ? undefined : selectedGroup);
            if (data) {
                setFullMarks(data.fullMarks || 100);
                const marks: any = {};
                data.results.forEach(r => {
                    marks[r.studentId] = { written: r.written, mcq: r.mcq, practical: r.practical };
                });
                setMarksData(marks);
            } else {
                setFullMarks(currentSubjectInfo?.fullMarks || 100);
                setMarksData({});
            }
        } catch (e) {}
        setIsLoadingResults(false);
    }, [db, selectedYear, selectedExam, selectedClass, selectedSubject, selectedGroup, currentSubjectInfo]);

    useEffect(() => { fetchExistingResults(); }, [fetchExistingResults]);

    const handleMarkChange = (studentId: string, field: 'written' | 'mcq' | 'practical', value: string) => {
        const num = value === '' ? undefined : parseInt(value, 10);
        setMarksData(prev => ({
            ...prev,
            [studentId]: { ...(prev[studentId] || {}), [field]: isNaN(num!) ? undefined : num }
        }));
    };

    const handleSave = async () => {
        if (!db || !selectedExam || !selectedClass || !selectedSubject) return;
        
        // Permission Check: Admin can do anything. Teachers need subject-specific permission.
        if (user?.role !== 'admin') {
            const allowedSubjects = user?.marksPermissions?.[selectedClass] || [];
            if (!allowedSubjects.includes(selectedSubject)) {
                toast({ variant: 'destructive', title: 'অনুমতি নেই', description: `আপনার ${selectedSubject} বিষয়ের নম্বর ইনপুট দেওয়ার অনুমতি নেই।` });
                return;
            }
        }

        setIsSaving(true);
        try {
            const results: StudentResult[] = Object.entries(marksData).map(([id, marks]) => ({
                studentId: id,
                ...marks
            }));

            await saveClassResults(db, {
                academicYear: selectedYear,
                examName: selectedExam,
                className: selectedClass,
                group: selectedGroup === 'all' ? undefined : selectedGroup,
                subject: selectedSubject,
                fullMarks,
                results
            });
            toast({ title: 'নম্বর সফলভাবে সংরক্ষিত হয়েছে' });
        } catch (e) {
            console.error(e);
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-xl border-2 border-dashed border-primary/10">
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-primary">পরীক্ষা</Label>
                    <Select value={selectedExam} onValueChange={setSelectedExam}>
                        <SelectTrigger className="h-9 font-bold bg-white"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                        <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-primary">শ্রেণি</Label>
                    <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedSubject(''); }}>
                        <SelectTrigger className="h-9 font-bold bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-primary">শাখা/গ্রুপ</Label>
                    <Select value={selectedGroup} onValueChange={(v) => { setSelectedGroup(v); setSelectedSubject(''); }}>
                        <SelectTrigger className="h-9 font-bold bg-white"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="all">সকল শাখা</SelectItem>
                            <SelectItem value="science">বিজ্ঞান</SelectItem>
                            <SelectItem value="arts">মানবিক</SelectItem>
                            <SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                <div className="space-y-1">
                    <Label className="text-[10px] font-black uppercase text-primary">বিষয়</Label>
                    <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                        <SelectTrigger className="h-9 font-bold bg-white"><SelectValue placeholder="বিষয় নির্বাচন" /></SelectTrigger>
                        <SelectContent>{availableSubjects.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            {selectedSubject ? (
                <div className="animate-in fade-in duration-300">
                    <div className="flex justify-between items-center mb-4">
                        <div className="flex items-center gap-3">
                            <Badge variant="outline" className="font-black bg-primary/5 text-primary border-primary/20">পূর্ণমান: {toBengaliNumber(fullMarks)}</Badge>
                            <p className="text-xs font-bold text-muted-foreground">শিক্ষার্থী সংখ্যা: {toBengaliNumber(filteredStudents.length)} জন</p>
                        </div>
                        <Button onClick={handleSave} disabled={isSaving} className="font-black shadow-lg">
                            {isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} সেভ করুন
                        </Button>
                    </div>

                    <div className="table-container border-2 rounded-xl overflow-hidden shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-16 text-center font-black">রোল</TableHead>
                                    <TableHead className="font-black">নাম</TableHead>
                                    <TableHead className="w-24 text-center font-black">লিখিত</TableHead>
                                    <TableHead className="w-24 text-center font-black">MCQ</TableHead>
                                    <TableHead className="w-24 text-center font-black">ব্যবহারিক</TableHead>
                                    <TableHead className="w-24 text-right font-black pr-6">মোট প্রাপ্ত</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {isLoadingResults ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-20"><Loader2 className="animate-spin h-8 w-8 mx-auto" /></TableCell></TableRow>
                                ) : filteredStudents.length === 0 ? (
                                    <TableRow><TableCell colSpan={6} className="text-center py-20 italic">শিক্ষার্থী পাওয়া যায়নি।</TableCell></TableRow>
                                ) : filteredStudents.map(student => {
                                    const marks = marksData[student.id] || {};
                                    const total = (marks.written || 0) + (marks.mcq || 0) + (marks.practical || 0);
                                    return (
                                        <TableRow key={student.id} className="h-14 hover:bg-primary/5 transition-colors">
                                            <TableCell className="text-center font-black text-base">{toBengaliNumber(student.roll)}</TableCell>
                                            <TableCell className="font-bold text-slate-800">{student.studentNameBn}</TableCell>
                                            <TableCell className="p-1"><Input type="number" value={marks.written ?? ''} onChange={e => handleMarkChange(student.id, 'written', e.target.value)} className="h-9 font-black text-center text-blue-900 border-none bg-slate-50" /></TableCell>
                                            <TableCell className="p-1"><Input type="number" value={marks.mcq ?? ''} onChange={e => handleMarkChange(student.id, 'mcq', e.target.value)} className="h-9 font-black text-center text-rose-700 border-none bg-slate-50" /></TableCell>
                                            <TableCell className="p-1"><Input type="number" value={marks.practical ?? ''} onChange={e => handleMarkChange(student.id, 'practical', e.target.value)} className="h-9 font-black text-center text-emerald-700 border-none bg-slate-50" /></TableCell>
                                            <TableCell className="text-right pr-6 font-black text-lg text-primary">{toBengaliNumber(total)}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            ) : (
                <div className="flex flex-col items-center justify-center py-20 text-muted-foreground bg-muted/10 rounded-3xl border-4 border-dashed opacity-40">
                    <ListTodo className="h-16 w-16 mb-4" />
                    <p className="text-lg font-black uppercase">উপরে তথ্য সিলেক্ট করুন</p>
                    <p className="text-sm font-bold mt-1">পরীক্ষা, শ্রেণি ও বিষয় নির্বাচন করলে ইনপুট টেবিলটি দেখা যাবে।</p>
                </div>
            )}
        </div>
    );
}

function SubjectReportTab({ allStudents, onPrintRequested }: { allStudents: Student[], onPrintRequested: (data: any) => void }) {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedClass, setSelectedClass] = useState('6');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [results, setResults] = useState<StudentProcessedResult[]>([]);

    useEffect(() => {
        if (db) getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear]);

    const fetchData = useCallback(async () => {
        if (!db || !selectedExam || !selectedClass || !selectedSubject) return;
        setIsLoading(true);
        try {
            const classResults = await getResultsForClass(db, selectedYear, selectedExam, selectedClass, selectedSubject, selectedGroup === 'all' ? undefined : selectedGroup);
            const students = allStudents.filter(s => s.academicYear === selectedYear && s.className === selectedClass && (selectedGroup === 'all' || (s.group || '').toLowerCase() === selectedGroup.toLowerCase()));
            const subjects = getSubjects(selectedClass, selectedGroup === 'all' ? undefined : selectedGroup);
            const processed = processStudentResults(students, classResults ? [classResults] : [], subjects);
            setResults(processed.sort((a, b) => (Number(a.student.roll) || 0) - (Number(b.student.roll) || 0)));
        } catch (e) {}
        setIsLoading(false);
    }, [db, selectedYear, selectedExam, selectedClass, selectedSubject, selectedGroup, allStudents]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handlePrint = (isBlank = false) => {
        const studentData = results.map(r => {
            const sr = r.subjectResults.get(selectedSubject);
            return {
                student: r.student,
                marks: sr || {},
                obtainedMarks: sr?.marks || 0,
                grade: sr?.grade || '-',
                point: sr?.point || 0,
                isPass: sr?.isPass !== false
            };
        });
        onPrintRequested({ studentData, isBlank });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 border rounded-xl bg-white shadow-sm no-print">
                <Select value={selectedExam} onValueChange={setSelectedExam}><SelectTrigger><SelectValue placeholder="পরীক্ষা" /></SelectTrigger><SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent></Select>
                <Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}</SelectContent></Select>
                <Select value={selectedGroup} onValueChange={setSelectedGroup}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সকল শাখা</SelectItem><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent></Select>
                <Select value={selectedSubject} onValueChange={setSelectedSubject}><SelectTrigger><SelectValue placeholder="বিষয়" /></SelectTrigger><SelectContent>{getSubjects(selectedClass, selectedGroup === 'all' ? undefined : selectedGroup).map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select>
            </div>
            
            {selectedSubject && results.length > 0 && (
                <div className="space-y-4">
                    <div className="flex justify-end gap-2 no-print">
                        <Button variant="outline" className="font-bold border-primary text-primary" onClick={() => handlePrint(true)}><FilePlus className="mr-2 h-4 w-4" /> ব্ল্যাঙ্ক শিট</Button>
                        <Button className="font-black shadow-md" onClick={() => handlePrint(false)}><Printer className="mr-2 h-4 w-4" /> রিপোর্ট প্রিন্ট</Button>
                    </div>
                    <div className="border rounded-xl overflow-hidden bg-white shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/50">
                                <TableRow>
                                    <TableHead className="w-16 text-center">রোল</TableHead>
                                    <TableHead>শিক্ষার্থীর নাম</TableHead>
                                    <TableHead className="text-center">প্রাপ্ত নম্বর</TableHead>
                                    <TableHead className="text-center">গ্রেড</TableHead>
                                    <TableHead className="text-right pr-6">পয়েন্ট</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {results.map(r => {
                                    const sr = r.subjectResults.get(selectedSubject);
                                    return (
                                        <TableRow key={r.student.id} className={cn(sr?.isPass === false && "bg-rose-50")}>
                                            <TableCell className="text-center font-black">{toBengaliNumber(r.student.roll)}</TableCell>
                                            <TableCell className="font-bold">{r.student.studentNameBn}</TableCell>
                                            <TableCell className="text-center font-black text-blue-900">{toBengaliNumber(sr?.marks || 0)}</TableCell>
                                            <TableCell className="text-center font-black">{sr?.grade || '-'}</TableCell>
                                            <TableCell className="text-right pr-6 font-bold">{toBengaliNumber(sr?.point?.toFixed(2) || '0.00')}</TableCell>
                                        </TableRow>
                                    );
                                })}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    );
}

function ResultSheetTab({ allStudents, onPrint }: { allStudents: Student[], onPrint: (data: any) => void }) {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();

    const [selectedExam, setSelectedExam] = useState('');
    const [selectedClass, setSelectedClass] = useState('6');
    const [exams, setExams] = useState<Exam[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const [classResults, setClassResults] = useState<ClassResult[]>([]);

    useEffect(() => {
        if (db) getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear]);

    const fetchData = useCallback(async () => {
        if (!db || !selectedExam || !selectedClass) return;
        setIsLoading(true);
        try {
            const allRes = await getAllResults(db, selectedYear, selectedExam);
            setClassResults(allRes.filter(r => r.className === selectedClass));
        } catch (e) {}
        setIsLoading(false);
    }, [db, selectedYear, selectedExam, selectedClass]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const groupedResults = useMemo(() => {
        const students = allStudents.filter(s => s.academicYear === selectedYear && s.className === selectedClass);
        const subjects = getSubjects(selectedClass);
        const results = processStudentResults(students, classResults, subjects);
        
        const groups: Record<string, StudentProcessedResult[]> = {};
        if (parseInt(selectedClass) < 9) {
            groups['all'] = results.sort((a, b) => (a.student.roll || 0) - (b.student.roll || 0));
        } else {
            ['science', 'arts', 'commerce'].forEach(g => {
                groups[g] = results.filter(r => (r.student.group || '').toLowerCase() === g).sort((a, b) => (a.student.roll || 0) - (b.student.roll || 0));
            });
        }
        return groups;
    }, [allStudents, classResults, selectedClass, selectedYear]);

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 p-4 border rounded-xl bg-white shadow-sm items-end no-print">
                <div className="space-y-2">
                    <Label className="font-bold">পরীক্ষা নির্বাচন</Label>
                    <Select value={selectedExam} onValueChange={setSelectedExam}>
                        <SelectTrigger><SelectValue placeholder="সিলেক্ট পরীক্ষা" /></SelectTrigger>
                        <SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent>
                    </Select>
                </div>
                <div className="space-y-2">
                    <Label className="font-bold">শ্রেণি</Label>
                    <Select value={selectedClass} onValueChange={setSelectedClass}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>{Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}</SelectContent>
                    </Select>
                </div>
            </div>

            {selectedExam && (
                <div className="space-y-4">
                    <div className="flex justify-end gap-2 no-print">
                        <Button className="font-black shadow-lg" onClick={() => onPrint({ examName: selectedExam, className: selectedClass, results: groupedResults, classResults })} disabled={isLoading}>
                            <Printer className="mr-2 h-4 w-4" /> ফুল শিট প্রিন্ট করুন
                        </Button>
                    </div>
                    <Card className="border-2 border-dashed rounded-3xl p-16 text-center bg-muted/10 opacity-60">
                        <FileSpreadsheet className="h-16 w-16 mx-auto mb-4 text-primary" />
                        <h3 className="text-xl font-black">ব্রড-শিট প্রিভিউ প্রস্তুত</h3>
                        <p className="font-bold text-muted-foreground mt-2">উপরের বাটন ক্লিক করে সম্পূর্ণ ফলাফল বিবরণী শিট প্রিন্ট করুন।</p>
                    </Card>
                </div>
            )}
        </div>
    );
}

function ResultSearchTab({ allStudents }: { allStudents: Student[] }) {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { schoolInfo } = useSchoolInfo();
    const { toast } = useToast();
    
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedClass, setSelectedClass] = useState('6');
    const [searchRoll, setSearchRoll] = useState('');
    const [isSearching, setIsSearching] = useState(false);
    const [searchResult, setSearchResult] = useState<StudentProcessedResult | null>(null);

    const handleSearch = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!db || !selectedExam || !selectedClass || !searchRoll) return;
        setIsSearching(true);
        try {
            const rollNum = parseInt(searchRoll, 10);
            const student = allStudents.find(s => s.academicYear === selectedYear && s.className === selectedClass && s.roll === rollNum);
            if (!student) { toast({ variant: 'destructive', title: 'শিক্ষার্থী পাওয়া যায়নি' }); setIsSearching(false); return; }

            const allRes = await getAllResults(db, selectedYear, selectedExam);
            const classRes = allRes.filter(r => r.className === selectedClass);
            const subjects = getSubjects(selectedClass, student.group);
            const studentsInClass = allStudents.filter(s => s.academicYear === selectedYear && s.className === selectedClass);
            
            const processed = processStudentResults(studentsInClass, classRes, subjects);
            const res = processed.find(r => r.student.id === student.id);
            if (res) setSearchResult(res);
            else toast({ variant: 'destructive', title: 'ফলাফল পাওয়া যায়নি' });
        } catch (e) {}
        setIsSearching(false);
    };

    return (
        <div className="space-y-8 max-w-2xl mx-auto">
            <Card className="border-2 shadow-lg">
                <CardHeader className="bg-primary/5 border-b py-4">
                    <CardTitle className="text-lg font-black flex items-center gap-2"><Search className="w-5 h-5 text-primary" /> ফলাফল অনুসন্ধান</CardTitle>
                </CardHeader>
                <CardContent className="pt-6">
                    <form onSubmit={handleSearch} className="space-y-6">
                        <div className="grid grid-cols-2 gap-4">
                            <div className="space-y-1.5"><Label className="font-bold">পরীক্ষা</Label><Select onValueChange={setSelectedExam} value={selectedExam}><SelectTrigger className="bg-white"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger><SelectContent><SelectItem value="অর্ধ-বার্ষিক পরীক্ষা">অর্ধ-বার্ষিক পরীক্ষা</SelectItem><SelectItem value="বার্ষিক পরীক্ষা">বার্ষিক পরীক্ষা</SelectItem></SelectContent></Select></div>
                            <div className="space-y-1.5"><Label className="font-bold">শ্রেণি</Label><Select onValueChange={setSelectedClass} value={selectedClass}><SelectTrigger className="bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                        </div>
                        <div className="space-y-1.5"><Label className="font-bold">রোল নম্বর</Label><Input type="number" value={searchRoll} onChange={e => setSearchRoll(e.target.value)} placeholder="উদা: ১" className="h-12 text-lg font-black" /></div>
                        <Button type="submit" disabled={isSearching} className="w-full h-12 text-lg font-black shadow-xl"><Search className="mr-2 h-5 w-5" /> ফলাফল দেখুন</Button>
                    </form>
                </CardContent>
            </Card>

            {searchResult && (
                <div className="animate-in zoom-in-95 duration-500">
                    <Card className="border-[4px] border-black rounded-[32px] overflow-hidden shadow-2xl bg-white">
                        <div className="p-6 bg-slate-900 text-white flex items-center gap-6">
                             <Avatar className="h-20 w-20 border-4 border-white/20"><AvatarImage src={searchResult.student.photoUrl} className="object-cover" /></Avatar>
                             <div><h3 className="text-2xl font-black">{searchResult.student.studentNameBn}</h3><p className="font-bold text-slate-300">রোল: {toBengaliNumber(searchResult.student.roll)} | {classNamesMap[searchResult.student.className]} শ্রেণি</p></div>
                             <div className="ml-auto text-right"><p className="text-xs font-bold text-slate-400 uppercase">ফলাফল</p><p className={cn("text-3xl font-black", searchResult.isPass ? "text-emerald-400" : "text-rose-400")}>{searchResult.isPass ? searchResult.finalGrade : 'F'}</p></div>
                        </div>
                        <CardContent className="p-6">
                             <Table className="border-2 border-black">
                                <TableHeader className="bg-slate-100"><TableRow className="border-b-2 border-black"><TableHead className="font-black text-black">বিষয়ের নাম</TableHead><TableHead className="text-center font-black text-black">নম্বর</TableHead><TableHead className="text-center font-black text-black">গ্রেড</TableHead><TableHead className="text-right pr-6 font-black text-black">পয়েন্ট</TableHead></TableRow></TableHeader>
                                <TableBody>
                                    {Array.from(searchResult.subjectResults.entries()).map(([name, res]) => (
                                        <TableRow key={name} className="border-b border-slate-200 h-10"><TableCell className="font-bold">{name}</TableCell><TableCell className="text-center font-black">{toBengaliNumber(res.marks)}</TableCell><TableCell className="text-center font-black">{res.grade}</TableCell><TableCell className="text-right pr-6 font-bold">{toBengaliNumber(res.point.toFixed(2))}</TableCell></TableRow>
                                    ))}
                                </TableBody>
                             </Table>
                             <div className="mt-8 flex justify-center no-print">
                                <Link href={`/marksheet/${searchResult.student.id}?academicYear=${selectedYear}&examName=${encodeURIComponent(selectedExam)}`}><Button className="h-12 px-10 font-black shadow-lg"><Printer className="mr-2 h-4 w-4" /> পূর্ণাঙ্গ মার্কশিট প্রিন্ট</Button></Link>
                             </div>
                        </CardContent>
                    </Card>
                </div>
            )}
        </div>
    );
}

function FullMarksTab({ allStudents }: { allStudents: Student[] }) {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
    
    const [selectedExam, setSelectedExam] = useState('বার্ষিক পরীক্ষা');
    const [selectedClass, setSelectedClass] = useState('6');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [subjects, setSubjects] = useState<SubjectType[]>([]);
    const [examData, setExamData] = useState<Record<string, { fullMarks: number }>>({});
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        const subs = getSubjects(selectedClass, selectedGroup === 'all' ? undefined : selectedGroup).filter(s => s.isExamSubject !== false);
        setSubjects(subs);
        
        const fetchData = async () => {
            if (!db || !selectedExam) return;
            const q = query(collection(db, 'results'), where('academicYear', '==', selectedYear), where('examName', '==', selectedExam), where('className', '==', selectedClass));
            const snap = await getDocs(q);
            const data: any = {};
            snap.docs.forEach(doc => {
                const docData = doc.data();
                data[normalize(docData.subject)] = { fullMarks: docData.fullMarks };
            });
            setExamData(data);
        };
        fetchData();
    }, [db, selectedYear, selectedExam, selectedClass, selectedGroup]);

    const handleSave = async () => {
        if (!db || !selectedExam) return;
        setIsSaving(true);
        try {
            const batch = writeBatch(db);
            for (const sub of subjects) {
                const normalizedSub = normalize(sub.name);
                const currentFullMarks = examData[normalizedSub]?.fullMarks || sub.fullMarks;
                
                const sanitizedSubject = sub.name.replace(/[^\p{L}\p{N}]+/gu, '-');
                const sanitizedExam = selectedExam.replace(/[^\p{L}\p{N}]+/gu, '-');
                const docId = `${selectedYear}_${sanitizedExam}_${selectedClass}_${selectedGroup}_${sanitizedSubject}`;
                const docRef = doc(db, 'results', docId);
                
                const existingDoc = await getDoc(docRef);
                if (existingDoc.exists()) {
                    batch.update(docRef, { fullMarks: currentFullMarks, updatedAt: serverTimestamp() });
                } else {
                    batch.set(docRef, {
                        academicYear: selectedYear, examName: selectedExam, className: selectedClass, group: selectedGroup === 'all' ? undefined : selectedGroup,
                        subject: sub.name, fullMarks: currentFullMarks, results: [], updatedAt: serverTimestamp(), createdAt: serverTimestamp()
                    });
                }
            }
            await batch.commit();
            toast({ title: 'পূর্ণমান সংরক্ষিত হয়েছে' });
        } catch (e) {
            console.error(e);
        } finally { setIsSaving(false); }
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border rounded-2xl bg-white shadow-sm">
                <div className="space-y-2"><Label className="font-bold">পরীক্ষা</Label><Select value={selectedExam} onValueChange={setSelectedExam}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="অর্ধ-বার্ষিক পরীক্ষা">অর্ধ-বার্ষিক পরীক্ষা</SelectItem><SelectItem value="বার্ষিক পরীক্ষা">বার্ষিক পরীক্ষা</SelectItem></SelectContent></Select></div>
                <div className="space-y-2"><Label className="font-bold">শ্রেণি</Label><Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-2"><Label className="font-bold">গ্রুপ</Label><Select value={selectedGroup} onValueChange={setSelectedGroup}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সকল শাখা</SelectItem><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent></Select></div>
            </div>

            <Card className="border-2 shadow-xl rounded-[32px] overflow-hidden">
                <CardHeader className="bg-muted/30 border-b py-6"><CardTitle className="text-xl font-black">বিষয় ভিত্তিক পূর্ণমান নির্ধারণ করুন</CardTitle></CardHeader>
                <CardContent className="p-0">
                    <Table>
                        <TableHeader className="bg-slate-50"><TableRow><TableHead className="w-20 text-center font-bold">নং</TableHead><TableHead className="font-bold">বিষয়ের নাম</TableHead><TableHead className="text-center font-bold w-48">নির্ধারিত পূর্ণমান (Full Marks)</TableHead></TableRow></TableHeader>
                        <TableBody>
                            {subjects.map((sub, idx) => {
                                const normSub = normalize(sub.name);
                                return (
                                    <TableRow key={sub.name} className="h-14">
                                        <TableCell className="text-center font-bold">{idx + 1}</TableCell>
                                        <TableCell className="font-black text-slate-800">{sub.name}</TableCell>
                                        <TableCell className="text-center">
                                            <div className="flex items-center justify-center gap-2">
                                                <Input 
                                                    type="number" 
                                                    value={examData[normSub]?.fullMarks ?? sub.fullMarks} 
                                                    onChange={e => setExamData(prev => ({ ...prev, [normSub]: { fullMarks: parseInt(e.target.value) || 0 } }))}
                                                    className="w-24 text-center font-black h-9 border-2" 
                                                />
                                                <span className="text-[10px] font-bold text-muted-foreground uppercase">নম্বর</span>
                                            </div>
                                        </TableCell>
                                    </TableRow>
                                );
                            })}
                        </TableBody>
                    </Table>
                </CardContent>
                <CardFooter className="p-6 bg-slate-50 border-t flex justify-end"><Button onClick={handleSave} disabled={isSaving} className="font-black px-12 h-12 shadow-xl">{isSaving ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Save className="mr-2 h-4 w-4" />} পূর্ণমান সেভ করুন</Button></CardFooter>
            </Card>
        </div>
    );
}

function MeritListTab({ allStudents }: { allStudents: Student[] }) {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const router = useRouter();
    
    const [selectedExam, setSelectedExam] = useState('');
    const [selectedClass, setSelectedClass] = useState('6');
    const [selectedGroup, setSelectedGroup] = useState('all');
    const [exams, setExams] = useState<Exam[]>([]);

    useEffect(() => {
        if (db) getExams(db, selectedYear).then(setExams);
    }, [db, selectedYear]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <Card className="max-w-3xl mx-auto border-2 shadow-xl rounded-[32px] overflow-hidden">
                <CardHeader className="bg-primary/5 border-b p-8"><CardTitle className="text-2xl font-black text-primary flex items-center gap-3"><Trophy className="h-8 w-8" /> মেধা তালিকা জেনারেটর</CardTitle><CardDescription className="font-bold">পরীক্ষার ফলাফল অনুযায়ী মেধা তালিকা দেখুন ও প্রিন্ট করুন</CardDescription></CardHeader>
                <CardContent className="p-8 space-y-6">
                    <div className="grid grid-cols-1 gap-6">
                        <div className="space-y-2"><Label className="font-bold text-slate-700">১. পরীক্ষা নির্বাচন করুন</Label><Select value={selectedExam} onValueChange={setSelectedExam}><SelectTrigger className="h-12 border-2 bg-white"><SelectValue placeholder="পরীক্ষা সিলেক্ট করুন" /></SelectTrigger><SelectContent>{exams.map(e => <SelectItem key={e.id} value={e.name}>{e.name}</SelectItem>)}</SelectContent></Select></div>
                        <div className="grid grid-cols-2 gap-6">
                            <div className="space-y-2"><Label className="font-bold text-slate-700">২. শ্রেণি</Label><Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger className="h-12 border-2 bg-white"><SelectValue /></SelectTrigger><SelectContent>{Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                            <div className="space-y-2"><Label className="font-bold text-slate-700">৩. শাখা/বিভাগ</Label><Select value={selectedGroup} onValueChange={setSelectedGroup}><SelectTrigger className="h-12 border-2 bg-white"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">সকল শাখা</SelectItem><SelectItem value="science">বিজ্ঞান</SelectItem><SelectItem value="arts">মানবিক</SelectItem><SelectItem value="commerce">ব্যবসায় শিক্ষা</SelectItem></SelectContent></Select></div>
                        </div>
                    </div>
                </CardContent>
                <CardFooter className="p-8 bg-slate-50 border-t flex justify-end">
                    <Link href={`/results/merit-list?academicYear=${selectedYear}&examName=${encodeURIComponent(selectedExam)}&className=${selectedClass}&group=${selectedGroup}`}>
                        <Button disabled={!selectedExam} className="px-12 h-14 text-xl font-black shadow-xl"><Printer className="mr-2 h-6 w-6" /> মেধা তালিকা দেখুন</Button>
                    </Link>
                </CardFooter>
            </Card>
        </div>
    );
}

function PromotionTab({ allStudents }: { allStudents: Student[] }) {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
    
    const [selectedClass, setSelectedClass] = useState('6');
    const [isLoading, setIsLoading] = useState(false);
    const [processedResults, setProcessedResults] = useState<StudentProcessedResult[]>([]);
    const [promotedRolls, setPromotedRolls] = useState<Record<string, number>>({});

    const fetchData = useCallback(async () => {
        if (!db || !selectedClass) return;
        setIsLoading(true);
        try {
            const students = allStudents.filter(s => s.academicYear === selectedYear && s.className === selectedClass);
            const allRes = await getAllResults(db, selectedYear, 'বার্ষিক পরীক্ষা');
            const subjects = getSubjects(selectedClass);
            const processed = processStudentResults(students, allRes.filter(r => r.className === selectedClass), subjects);
            setProcessedResults(processed);
            
            const nextRolls: any = {};
            processed.filter(r => r.isPass).forEach(r => {
                if (r.meritPosition) nextRolls[r.student.id] = r.meritPosition;
            });
            setPromotedRolls(nextRolls);
        } catch (e) {}
        setIsLoading(false);
    }, [db, selectedYear, selectedClass, allStudents]);

    useEffect(() => { fetchData(); }, [fetchData]);

    const handlePromote = async () => {
        if (!db || processedResults.length === 0) return;
        if (!confirm(`আপনি কি নিশ্চিতভাবে ${classNamesMap[selectedClass]} শ্রেণির শিক্ষার্থীদের পরবর্তী সেশনে প্রমোট করতে চান?`)) return;

        setIsLoading(true);
        try {
            const batch = writeBatch(db);
            const nextYear = (parseInt(selectedYear) + 1).toString();
            const nextClass = String(parseInt(selectedClass) + 1);

            processedResults.forEach(res => {
                if (res.isPass) {
                    const studentRef = doc(collection(db, 'students'));
                    const { id, ...oldData } = res.student;
                    batch.set(studentRef, {
                        ...oldData,
                        academicYear: nextYear,
                        className: nextClass,
                        roll: promotedRolls[res.student.id] || res.student.roll,
                        createdAt: serverTimestamp(),
                        updatedAt: serverTimestamp()
                    });
                }
            });

            await batch.commit();
            toast({ title: 'প্রমোশন সম্পন্ন হয়েছে', description: `${nextYear} সেশনের জন্য নতুন শিক্ষার্থী তৈরি হয়েছে।` });
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'প্রমোশন ব্যর্থ হয়েছে' });
        } finally { setIsLoading(false); }
    };

    return (
        <div className="space-y-6">
            <div className="flex justify-between items-center bg-white p-4 border rounded-xl shadow-sm">
                <div className="flex items-center gap-4"><Label className="font-bold">শ্রেণি নির্বাচন:</Label><Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger className="w-32 h-9"><SelectValue /></SelectTrigger><SelectContent>{['6', '7', '8', '9'].map(c => <SelectItem key={c} value={c}>{classNamesMap[c]} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                <Button onClick={handlePromote} disabled={isLoading || processedResults.length === 0} className="font-black bg-rose-600 hover:bg-rose-700 shadow-md">শিক্ষার্থীদের প্রমোট করুন</Button>
            </div>
            
            <div className="table-container border rounded-xl shadow-sm">
                <Table>
                    <TableHeader className="bg-muted/50">
                        <TableRow>
                            <TableHead className="w-16 text-center">রোল</TableHead>
                            <TableHead>শিক্ষার্থীর নাম</TableHead>
                            <TableHead className="text-center">GPA</TableHead>
                            <TableHead className="text-center">অবস্থা</TableHead>
                            <TableHead className="text-right pr-6">পরবর্তী রোল</TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {isLoading ? <TableRow><TableCell colSpan={5} className="text-center py-10"><Loader2 className="animate-spin h-6 w-6 mx-auto" /></TableCell></TableRow> : 
                         processedResults.length === 0 ? <TableRow><TableCell colSpan={5} className="text-center py-10 italic">তথ্য পাওয়া যায়নি।</TableCell></TableRow> : 
                         processedResults.map(r => (
                            <TableRow key={r.student.id}>
                                <TableCell className="text-center font-bold">{toBengaliNumber(r.student.roll)}</TableCell>
                                <TableCell className="font-black">{r.student.studentNameBn}</TableCell>
                                <TableCell className="text-center font-black">{toBengaliNumber(r.gpa.toFixed(2))}</TableCell>
                                <TableCell className="text-center">{r.isPass ? <Badge className="bg-emerald-600">উত্তীর্ণ</Badge> : <Badge variant="destructive">অনুত্তীর্ণ</Badge>}</TableCell>
                                <TableCell className="text-right pr-6">
                                    {r.isPass && (
                                        <Input 
                                            type="number" 
                                            value={promotedRolls[r.student.id] || ''} 
                                            onChange={e => setPromotedRolls(prev => ({ ...prev, [r.student.id]: parseInt(e.target.value) || 0 }))} 
                                            className="w-20 ml-auto h-8 text-center font-black" 
                                        />
                                    )}
                                </TableCell>
                            </TableRow>
                        ))}
                    </TableBody>
                </Table>
            </div>
        </div>
    );
}

function BulkUploadTab() {
    return (
        <Card className="border-2 border-dashed border-primary/20 bg-primary/5 p-20 text-center rounded-[32px] opacity-60">
            <FileUp className="h-16 w-16 mx-auto mb-4 text-primary" />
            <h3 className="text-xl font-black">Excel নম্বর আপলোড</h3>
            <p className="font-bold text-muted-foreground mt-2">এই মডিউলটি নির্মাণাধীন আছে। শীঘ্রই চালু হবে।</p>
        </Card>
    );
}

function SpecialExamTab({ allStudents, onPrintRequested }: { allStudents: Student[], onPrintRequested: (data: any) => void }) {
    const db = useFirestore();
    const { selectedYear } = useAcademicYear();
    const { toast } = useToast();
    const { hasPermission } = useAuth();
    
    const [selectedMonth, setSelectedMonth] = useState<string>(BENGALI_MONTHS[new Date().getMonth()]);
    const [selectedClass, setSelectedClass] = useState('6');
    const [selectedExam, setSelectedExam] = useState('বিশেষ পরীক্ষা-১');
    const [selectedSubject, setSelectedSubject] = useState('');
    const [marksData, setMarksData] = useState<Record<string, number>>({});
    const [isLoading, setIsLoading] = useState(false);
    const [allSpecialResults, setAllSpecialResults] = useState<SpecialClassResult[]>([]);

    const availableSubjects = useMemo(() => getSubjects(selectedClass), [selectedClass]);

    const fetchResults = useCallback(async () => {
        if (!db || !selectedClass || !selectedMonth) return;
        setIsLoading(true);
        try {
            const data = await getSpecialResultsForClass(db, selectedYear, selectedClass, selectedMonth);
            setAllSpecialResults(data);
            
            const currentSubRes = data.find(r => r.subject === selectedSubject && r.examType === selectedExam);
            const marks: any = {};
            if (currentSubRes) {
                currentSubRes.results.forEach(r => { marks[r.studentId] = r.marks; });
            }
            setMarksData(marks);
        } catch (e) {}
        setIsLoading(false);
    }, [db, selectedYear, selectedClass, selectedMonth, selectedSubject, selectedExam]);

    useEffect(() => { fetchResults(); }, [fetchResults]);

    const handleSave = async () => {
        if (!db || !selectedSubject) return;
        setIsLoading(true);
        try {
            const results = Object.entries(marksData).map(([id, marks]) => ({ studentId: id, marks }));
            await saveSpecialResults(db, {
                academicYear: selectedYear, className: selectedClass, subject: selectedSubject, examType: selectedExam, month: selectedMonth, fullMarks: 20, results
            });
            toast({ title: 'নম্বর সেভ হয়েছে' });
            fetchResults();
        } catch (e) {}
        setIsLoading(false);
    };

    const handlePrint = () => {
        const classStudents = allStudents.filter(s => s.academicYear === selectedYear && s.className === selectedClass).sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
        
        // Define common subject groups for special report
        const reportSubjects = [
            { name: 'বাংলা', isCombined: true, subList: ['বাংলা প্রথম', 'বাংলা দ্বিতীয়'] },
            { name: 'ইংরেজি', isCombined: true, subList: ['ইংরেজি প্রথম', 'ইংরেজি দ্বিতীয়'] },
            { name: 'গণিত', isCombined: false },
            { name: 'সাধারণ বিজ্ঞান', isCombined: false },
            { name: 'বাংলাদেশ ও বিশ্ব পরিচয়', isCombined: false },
            { name: 'ইসলাম ধর্ম', isCombined: false },
        ];

        onPrintRequested({
            students: classStudents,
            allSpecialResults,
            availableSubjects: reportSubjects,
            month: selectedMonth,
            year: selectedYear
        });
    };

    return (
        <div className="space-y-6">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4 bg-muted/20 rounded-xl border no-print">
                <div className="space-y-1"><Label className="font-bold">মাস</Label><Select value={selectedMonth} onValueChange={setSelectedMonth}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{BENGALI_MONTHS.map(m => <SelectItem key={m} value={m}>{m}</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label className="font-bold">শ্রেণি</Label><Select value={selectedClass} onValueChange={setSelectedClass}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                <div className="space-y-1"><Label className="font-bold">পরীক্ষা</Label><Select value={selectedExam} onValueChange={setSelectedExam}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="বিশেষ পরীক্ষা-১">বিশেষ পরীক্ষা-১</SelectItem><SelectItem value="বিশেষ পরীক্ষা-২">বিশেষ পরীক্ষা-২</SelectItem><SelectItem value="বিশেষ পরীক্ষা-৩">বিশেষ পরীক্ষা-৩</SelectItem></SelectContent></Select></div>
                <div className="space-y-1"><Label className="font-bold">বিষয়</Label><Select value={selectedSubject} onValueChange={setSelectedSubject}><SelectTrigger><SelectValue placeholder="বিষয়" /></SelectTrigger><SelectContent>{availableSubjects.map(s => <SelectItem key={s.name} value={s.name}>{s.name}</SelectItem>)}</SelectContent></Select></div>
            </div>

            {selectedSubject && (
                <div className="space-y-4">
                    <div className="flex justify-between items-center">
                        <Badge variant="outline" className="font-black h-8 px-4 bg-amber-50 text-amber-800 border-amber-200">পূর্ণমান: ২০</Badge>
                        <div className="flex gap-2">
                             <Button variant="outline" className="font-bold border-primary text-primary" onClick={handlePrint}><Printer className="mr-2 h-4 w-4" /> রিপোর্ট প্রিন্ট</Button>
                             <Button className="font-black shadow-lg" onClick={handleSave} disabled={isLoading}><Save className="mr-2 h-4 w-4" /> সেভ করুন</Button>
                        </div>
                    </div>
                    <div className="table-container border rounded-xl bg-white shadow-sm">
                        <Table>
                            <TableHeader className="bg-muted/50"><TableRow><TableHead className="w-16 text-center font-bold">রোল</TableHead><TableHead className="font-bold">নাম</TableHead><TableHead className="text-right pr-10 font-bold">প্রাপ্ত নম্বর (২০ এ)</TableHead></TableRow></TableHeader>
                            <TableBody>
                                {allStudents.filter(s => s.academicYear === selectedYear && s.className === selectedClass).sort((a,b) => (Number(a.roll) || 0) - (Number(b.roll) || 0)).map(s => (
                                    <TableRow key={s.id} className="h-12"><TableCell className="text-center font-bold">{toBengaliNumber(s.roll)}</TableCell><TableCell className="font-bold">{s.studentNameBn}</TableCell><TableCell className="text-right pr-6"><Input type="number" value={marksData[s.id] ?? ''} onChange={e => setMarksData(prev => ({ ...prev, [s.id]: parseInt(e.target.value) || 0 }))} className="w-24 ml-auto font-black text-center border-none bg-slate-50 h-8" /></TableCell></TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                </div>
            )}
        </div>
    );
}

// --- Main Components ---

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

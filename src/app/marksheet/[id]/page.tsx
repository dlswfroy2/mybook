'use client';

import { useState, useEffect, useMemo, Suspense } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { Student, studentFromDoc, isFemale, getStudentPlaceholderImage, sanitizePhotoUrl } from '@/lib/student-data';
import { getSubjects, Subject, subjectNameNormalization } from '@/lib/subjects';
import { getAllResults, ClassResult } from '@/lib/results-data';
import { processStudentResults, StudentProcessedResult } from '@/lib/results-calculation';
import { getExams, Exam } from '@/lib/exam-data';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Printer, Loader2, ArrowLeft, Plus, Minus } from 'lucide-react';
import Image from 'next/image';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useFirestore } from '@/firebase';
import { collection, query, getDocs, where, doc, getDoc } from 'firebase/firestore';
import { cn } from '@/lib/utils';

const classMap: { [key: string]: string } = { '6': 'Six', '7': 'Seven', '8': 'Eight', '9': 'Nine', '10': 'Ten' };
const groupMap: { [key: string]: string } = { 'science': 'Science', 'arts': 'Arts', 'commerce': 'Commerce', 'general': 'General' };

const examNameEnglishMap: { [key: string]: string } = {
    'অর্ধ-বার্ষিক পরীক্ষা': 'Half-Yearly Examination',
    'বার্ষিক পরীক্ষা': 'Annual Examination',
    'প্রাক-নির্বাচনী পরীক্ষা': 'Pre-Test Examination',
    'নির্বাচনী পরীক্ষা': 'Test Examination',
    'Half-Yearly Examination': 'Half-Yearly Examination',
    'Annual Examination': 'Annual Examination',
    'Pre-Test Examination': 'Pre-Test Examination',
    'Test Examination': 'Test Examination'
};

const normalize = (name: string) => {
    if (!name) return "";
    const trimmed = name.trim();
    return (subjectNameNormalization[trimmed] || trimmed).toLowerCase();
};

const MarksheetTemplate = ({ result, schoolInfo, examName, academicYear, watermarkOpacity }: any) => {
    const student = result.student;
    const gradingScale = [
        { interval: '80-100', point: '5.00', grade: 'A+' },
        { interval: '70-79', point: '4.00', grade: 'A' },
        { interval: '60-69', point: '3.50', grade: 'A-' },
        { interval: '50-59', point: '3.00', grade: 'B' },
        { interval: '40-49', point: '2.00', grade: 'C' },
        { interval: '33-39', point: '1.00', grade: 'D' },
        { interval: '0-32', point: '0.00', grade: 'F' },
    ];

    const allPossibleSubjects = getSubjects(student.className, student.group);
    const subjects = allPossibleSubjects.filter(s => result.subjectResults.has(s.name));
    
    const sortedSubjects = [...subjects].sort((a,b) => parseInt(a.code) - parseInt(b.code));
    const displayExamName = examNameEnglishMap[examName] || examName;
    const hasPractical = sortedSubjects.some(s => s.practical);

    const renderMeritPosition = (position?: number) => {
        if (!position) return '-';
        if (position % 10 === 1 && position % 100 !== 11) return `${position}st`;
        if (position % 10 === 2 && position % 100 !== 12) return `${position}nd`;
        if (position % 10 === 3 && position % 100 !== 13) return `${position}rd`;
        return `${position}th`;
    }

    const getRemarks = (gpa: number, isPass: boolean) => {
        if (!isPass) return "Work hard to do well in the next exam";
        if (gpa >= 5.0) return "Excellent results. Keep it up!";
        if (gpa >= 4.0) return "Satisfactory performance. Aim higher!";
        return "Keep focusing on studies";
    };

    return (
        <div className="marksheet-inner-content border-[1.5px] border-black p-4 h-full flex flex-col bg-transparent relative box-border">
            {schoolInfo.logoUrl && (
                <div 
                    className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none watermark-layer opacity-10"
                    style={{ opacity: watermarkOpacity }}
                >
                    <img src={schoolInfo.logoUrl} alt="Watermark" className="w-[300px] h-[300px] object-contain" />
                </div>
            )}
            
            <div className="relative z-10 flex flex-col h-full">
                <div className="flex justify-between items-start mb-4">
                    <div className="flex items-center gap-4">
                        {schoolInfo.logoUrl && (
                            <div className="w-20 h-20 relative">
                                <img src={schoolInfo.logoUrl} alt="Logo" className="w-full h-full object-contain" />
                            </div>
                        )}
                        <div className="text-left">
                            <h1 className="text-2xl font-black uppercase text-[#003366] leading-none mb-1">
                                {schoolInfo.nameEn || schoolInfo.name || ""}
                            </h1>
                            <p className="text-sm font-bold text-gray-700">{schoolInfo.address}</p>
                            <div className="mt-2 inline-block bg-[#eef6ff] px-3 py-1 rounded border border-[#b3d7ff]">
                                <p className="text-xs text-[#0056b3] font-bold">Academic Session: {academicYear}</p>
                            </div>
                        </div>
                    </div>
                    <div className="text-[8px]">
                        <table className="border-collapse border border-black text-center w-full">
                            <thead className="bg-gray-100">
                                <tr className="border-b border-black">
                                    <th className="p-1 px-2 border-r border-black font-bold">Range</th>
                                    <th className="p-1 px-2 border-r border-black font-bold">GP</th>
                                    <th className="p-1 px-2 font-bold">Grade</th>
                                </tr>
                            </thead>
                            <tbody>
                                {gradingScale.map(g => (
                                    <tr key={g.grade} className="border-b border-black last:border-b-0">
                                        <td className="p-0.5 border-r border-black">{g.interval}</td>
                                        <td className="p-0.5 border-r border-black">{g.point}</td>
                                        <td className="p-0.5 font-bold">{g.grade}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>

                <div className="text-center mb-4">
                    <h2 className="text-lg font-black underline underline-offset-8 uppercase tracking-widest">
                        {displayExamName.toUpperCase()} - PROGRESS REPORT
                    </h2>
                </div>

                <section className="mb-4 text-[11px] leading-relaxed bg-slate-50/50 p-2 border border-dashed border-gray-300 rounded">
                    <div className="grid grid-cols-[1.5fr_4fr_1fr_2fr] gap-x-4 border-b pb-1">
                        <div className="font-bold text-gray-600 uppercase">Student's Name</div><div className="font-bold uppercase text-blue-900">: {student.studentNameEn || student.studentNameBn}</div>
                        <div className="font-bold text-gray-600 text-right uppercase">Class</div><div className="font-bold">: {classMap[student.className] || student.className}</div>
                    </div>
                    <div className="grid grid-cols-[1.5fr_4fr_1fr_2fr] gap-x-4 mt-1 border-b pb-1">
                        <div className="font-bold text-gray-600 uppercase">Father's Name</div><div>: {student.fatherNameEn || student.fatherNameBn}</div>
                        <div className="font-bold text-gray-600 text-right uppercase">Roll No.</div><div className="font-bold">: {student.roll}</div>
                    </div>
                    <div className="grid grid-cols-[1.5fr_4fr_1fr_2fr] gap-x-4 mt-1 border-b pb-1">
                        <div className="font-bold text-gray-600 uppercase">Mother's Name</div><div>: {student.motherNameEn || student.motherNameBn}</div>
                        <div className="font-bold text-gray-600 text-right uppercase">Group</div><div>: {student.group ? groupMap[student.group.toLowerCase()] || student.group : 'General'}</div>
                    </div>
                    <div className="grid grid-cols-[1.5fr_4fr_1fr_2fr] gap-x-4 mt-1">
                        <div className="font-bold text-gray-600 uppercase">Student ID</div><div className="font-black">: {student.generatedId || '-'}</div>
                        <div className="font-bold text-gray-600 text-right uppercase">Exam</div><div className="font-bold">: {displayExamName}</div>
                    </div>
                </section>

                <div className="grid grid-cols-4 border-2 border-black divide-x-2 divide-black text-center text-[11px] bg-blue-900 text-white mb-4 rounded-sm">
                    <div className="py-1.5 font-bold">Status: <span className={result.isPass ? "text-green-400" : "text-red-400"}>{result.isPass ? 'PASSED' : 'FAILED'}</span></div>
                    <div className="py-1.5 font-bold">GPA: <span className="text-amber-300 font-black">{result.gpa.toFixed(2)}</span></div>
                    <div className="py-1.5 font-bold">Final Grade: <span className="text-amber-300 font-black">{result.isPass ? result.finalGrade : 'F'}</span></div>
                    <div className="py-1.5 font-bold">Merit Rank: <span>{result.isPass ? renderMeritPosition(result.meritPosition) : 'N/A'}</span></div>
                </div>

                <div className="flex-grow">
                    <table className="w-full border-collapse border-[1.5px] border-black text-[10px]">
                        <thead className="bg-gray-100 font-bold">
                            <tr className="border-b-[1.5px] border-black">
                                <th className="border-r border-black p-1 w-8 text-center">SL</th>
                                <th className="border-r border-black p-1 text-left pl-4">Subject Name</th>
                                <th className="border-r border-black p-1 w-12">Full Marks</th>
                                <th className="border-r border-black p-1 w-14">Written</th>
                                <th className="border-r border-black p-1 w-14">MCQ</th>
                                {hasPractical && <th className="border-r border-black p-1 w-14">Practical</th>}
                                <th className="border-r border-black p-1 w-16">Obtained</th>
                                <th className="border-r border-black p-1 w-12">Grade</th>
                                <th className="p-1 w-12">Point</th>
                            </tr>
                        </thead>
                        <tbody>
                            {sortedSubjects.map((sub, sIdx) => {
                                const sr = result.subjectResults.get(sub.name);
                                const isFail = sr?.isPass === false;
                                return (
                                    <tr key={sIdx} className={cn("border-b border-black", isFail && "bg-red-50/50")}>
                                        <td className="border-r border-black p-1 text-center font-medium text-gray-500">{sIdx + 1}</td>
                                        <td className="border-r border-black p-1 text-left pl-4 font-semibold uppercase">{sub.englishName}</td>
                                        <td className="border-r border-black p-1 text-center font-bold">{sr?.fullMarks ?? sub.fullMarks}</td>
                                        <td className="border-r border-black p-1 text-center font-medium">{sr?.written ?? '-'}</td>
                                        <td className="border-r border-black p-1 text-center font-medium">{sr?.mcq ?? '-'}</td>
                                        {hasPractical && <td className="border-r border-black p-1 text-center font-medium">{sr?.practical ?? '-'}</td>}
                                        <td className={cn("border-r border-black p-1 text-center font-black text-[12px]", isFail ? "text-red-600" : "text-blue-900")}>{sr?.marks ?? '-'}</td>
                                        <td className={cn("border-r border-black p-1 text-center font-black", isFail ? "text-red-600" : "")}>{sr?.grade ?? '-'}</td>
                                        <td className={cn("p-1 text-center font-bold", isFail ? "text-red-600" : "")}>{sr?.point !== undefined ? sr.point.toFixed(2) : '-'}</td>
                                    </tr>
                                );
                            })}
                        </tbody>
                        <tfoot>
                            <tr className="border-t-[1.5px] border-black font-black bg-blue-50">
                                <td colSpan={hasPractical ? 6 : 5} className="p-1.5 pr-4 text-right border-r border-black uppercase text-[10px]">Total Marks & Final Results</td>
                                <td className="p-1.5 text-center border-r border-black text-blue-950 text-sm">{result.totalMarks}</td>
                                <td className="p-1.5 text-center border-r border-black text-blue-950 text-sm">{result.isPass ? result.finalGrade : 'F'}</td>
                                <td className="p-1.5 text-center text-blue-950 text-sm">{result.gpa.toFixed(2)}</td>
                            </tr>
                        </tfoot>
                    </table>
                </div>

                <div className="mt-4 p-2 border border-black rounded bg-gray-50/30">
                    <p className="text-[9px] font-bold uppercase text-gray-500 mb-1">Remarks:</p>
                    <p className="text-[11px] font-black italic text-blue-900">"{getRemarks(result.gpa, result.isPass)}"</p>
                </div>

                <footer className="mt-auto pt-6 flex flex-col pb-2">
                    <div className="flex justify-between px-12 mb-4">
                        <div className="text-center w-32 border-t border-black pt-1 font-bold text-[10px] uppercase">Class Teacher</div>
                        <div className="text-center w-32 border-t border-black pt-1 font-bold text-[10px] uppercase">Headmaster</div>
                    </div>
                    <div className="pt-1 border-t border-dashed flex justify-between items-center text-[8px] text-gray-400 italic">
                        <span>Report Date: {new Date().toLocaleDateString('en-GB')}</span>
                        <span>{schoolInfo.nameEn || schoolInfo.name} Digital Portal</span>
                    </div>
                </footer>
            </div>
        </div>
    );
};

function MarksheetContent() {
    const params = useParams();
    const searchParams = useSearchParams();
    const studentId = params.id as string;
    const db = useFirestore();
    const { schoolInfo } = useSchoolInfo();

    const [student, setStudent] = useState<Student | null>(null);
    const [processedResult, setProcessedResult] = useState<StudentProcessedResult | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [allExams, setAllExams] = useState<Exam[]>([]);
    const [watermarkOpacity, setWatermarkOpacity] = useState(0.15);

    const academicYear = searchParams.get('academicYear') || new Date().getFullYear().toString();
    const initialExam = searchParams.get('examName') || 'Annual Examination';
    const [currentExamName, setCurrentExamName] = useState<string>(initialExam);

    useEffect(() => {
        const fetchAllData = async () => {
            if (!db || !studentId) return;
            setIsLoading(true);
            try {
                getExams(db, academicYear).then(data => setAllExams(data));
                const studentDoc = await getDoc(doc(db, 'students', studentId));
                if (!studentDoc.exists()) { setIsLoading(false); return; }
                const studentData = studentFromDoc(studentDoc);
                setStudent(studentData);
                const classQuery = query(collection(db, 'students'), where('academicYear', '==', academicYear), where('className', '==', studentData.className));
                const classSnap = await getDocs(classQuery);
                const studentsList = classSnap.docs.map(studentFromDoc);
                const allResults = await getAllResults(db, academicYear, currentExamName);
                const fetchedResultsBySubject = allResults.filter(r => r.className === studentData.className);
                const allSubjectsForGroup = getSubjects(studentData.className, studentData.group || undefined).filter(s => s.isExamSubject !== false);
                const allFinalResults = processStudentResults(studentsList, fetchedResultsBySubject, allSubjectsForGroup);
                const finalResultForThisStudent = allFinalResults.find(res => res.student.id === studentId);
                if (finalResultForThisStudent) setProcessedResult(finalResultForThisStudent);
            } catch (e) { console.error(e); }
            finally { setIsLoading(false); }
        };
        fetchAllData();
    }, [db, studentId, academicYear, currentExamName]);

    if (isLoading) return <div className="flex items-center justify-center min-h-screen bg-slate-50"><Loader2 className="animate-spin" /></div>;

    if (!student || !processedResult) return <div className="flex items-center justify-center min-h-screen">Marksheet data not found.</div>;

    return (
        <div className="bg-slate-100 min-h-screen p-4 sm:p-8 font-sans print:p-0 print:bg-white flex flex-col items-center">
            <style jsx global>{`
                @media print {
                    @page {
                        size: A4 portrait;
                        margin: 0.5in !important;
                    }
                    html, body {
                        margin: 0 !important;
                        padding: 0 !important;
                        height: 100% !important;
                        width: 100% !important;
                        overflow: hidden !important;
                        background: white !important;
                    }
                    .no-print {
                        display: none !important;
                    }
                    .printable-area {
                        position: absolute !important;
                        top: 0 !important;
                        left: 0 !important;
                        width: 100% !important;
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 0 !important;
                        display: block !important;
                        background: white !important;
                    }
                    .marksheet-inner-content {
                        width: 100% !important;
                        height: 100% !important;
                        margin: 0 !important;
                        padding: 24px !important;
                        border: 1.5px solid black !important;
                        box-sizing: border-box !important;
                        display: flex !important;
                        flex-direction: column !important;
                        page-break-after: avoid !important;
                        page-break-inside: avoid !important;
                    }
                }
            `}</style>

            <div className="w-full max-w-[210mm] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 no-print bg-white p-4 rounded-2xl shadow-sm border">
                <div className="flex items-center gap-3">
                    <Button variant="outline" size="icon" onClick={() => window.history.back()} className="rounded-xl"><ArrowLeft className="h-4 w-4" /></Button>
                    <div>
                        <h1 className="text-lg font-black text-primary">Marksheet Preview</h1>
                        <p className="text-xs font-bold text-muted-foreground">{student.studentNameEn || student.studentNameBn} | Roll: {student.roll}</p>
                    </div>
                </div>

                <div className="flex items-center gap-3 w-full sm:w-auto">
                    <div className="flex items-center gap-2 flex-1 sm:flex-initial bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                        <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setWatermarkOpacity(prev => Math.max(0, parseFloat((prev - 0.05).toFixed(2))))}>
                                <Minus className="h-3.5 w-3.5" />
                            </Button>
                            <span className="text-[11px] font-black w-8 text-center">{Math.round(watermarkOpacity * 100)}%</span>
                            <Button variant="ghost" size="icon" className="h-7 w-7 rounded-lg" onClick={() => setWatermarkOpacity(prev => Math.min(1, parseFloat((prev + 0.05).toFixed(2))))}>
                                <Plus className="h-3.5 w-3.5" />
                            </Button>
                        </div>
                    </div>
                    <Select value={currentExamName} onValueChange={setCurrentExamName}>
                        <SelectTrigger className="h-10 w-[180px] bg-slate-50 border-slate-200 text-xs font-black text-slate-800">
                            <SelectValue placeholder="Select Examination" />
                        </SelectTrigger>
                        <SelectContent className="font-kalpurush">
                            {allExams.map((e) => (
                                <SelectItem key={e.id || e.name} value={e.name} className="font-bold text-xs">
                                    {examNameEnglishMap[e.name] || e.name}
                                </SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                    <Button onClick={() => window.print()} className="shadow-md font-black rounded-xl bg-primary text-white">
                        <Printer className="mr-2 h-4 w-4" />
                        Print (A4)
                    </Button>
                </div>
            </div>
            
            <div className="printable-area w-full max-w-[210mm] bg-white relative flex flex-col box-border shadow-2xl print:shadow-none print:p-0">
                <MarksheetTemplate 
                    result={processedResult} 
                    schoolInfo={schoolInfo} 
                    examName={currentExamName} 
                    academicYear={academicYear}
                    watermarkOpacity={watermarkOpacity}
                />
            </div>
        </div>
    );
}

export default function MarksheetPage() {
    return (
        <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
            <MarksheetContent />
        </Suspense>
    );
}
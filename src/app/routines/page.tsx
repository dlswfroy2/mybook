
'use client';

import React, { useState, useMemo, useEffect, useCallback, useRef } from 'react';

import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { getFullRoutine, saveRoutinesBatch, ClassRoutine, ROUTINE_COLLECTION, RoutineColumnConfig, DEFAULT_ROUTINE_COLUMNS, getRoutineColumns, saveRoutineColumns } from '@/lib/routine-data';
import { useFirestore } from '@/firebase';
import { useToast } from '@/hooks/use-toast';
import { 
    Copy, Printer, FilePen, FilePlus, Users, Info, User, 
    FileUp, Download, CalendarClock, UserMinus, Plus, LayoutGrid, CheckCircle2, Trash2, Loader2, Save, ChevronRight, BarChart3, List, AlertTriangle, UserX, Briefcase, BookOpen, GraduationCap
} from 'lucide-react';
import { Input } from '@/components/ui/input';
import { subjectNameNormalization as baseSubjectNameNormalization, getSubjects } from '@/lib/subjects';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription } from "@/components/ui/dialog";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import Image from 'next/image';
import { useAuth } from '@/hooks/useAuth';
import { Badge } from '@/components/ui/badge';
import * as XLSX from 'xlsx';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { DatePicker } from '@/components/ui/date-picker';
import { getProxyClasses, saveProxyClass, deleteProxyClass, ProxyClass, NewProxyData } from '@/lib/proxy-data';
import { getStaff, Staff } from '@/lib/staff-data';
import { getStaffAttendanceByDate } from '@/lib/staff-attendance-data';
import { collection, query, where, onSnapshot, writeBatch, doc, getDocs } from 'firebase/firestore';
import { TeacherAllocationRecord, SubjectAllocation, saveTeacherAllocation, getTeacherAllocations } from '@/lib/teacher-allocation-data';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';

const classNamesMap: { [key: string]: string } = { '6': 'ষষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };

const dayMap = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শুক্রবার", "শনিবার"];
const periodLabels = ["১ম", "২য়", "৩য়", "৪র্থ", "৫ম", "৬ষ্ঠ"];

const subjectNameNormalization: { [key: string]: string } = {
    ...baseSubjectNameNormalization,
    'শারীরিক': 'শারীরিক শিক্ষা',
    'শারীরিক শিক্ষা': 'শারীরিক শিক্ষা',
    'ধর্ম': 'ধর্ম ও নৈতিক শিক্ষা',
    'বা ও বি': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বাও বি': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বা ও বি পরিচয়': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বিজিএস': 'বাংলাদেশ ও বিশ্ব পরিচয়',
    'বিজ্ঞান': 'সাধারণ বিজ্ঞান',
    'সাধারণ বিজ্ঞান': 'সাধারণ বিজ্ঞান',
    'ইতিহাস': 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা',
    'ভূগোল': 'ভূগোল ও পরিবেশ',
    'পৌরনীতি': 'পৌরনীতি ও নাগরিকতা',
    'পৌর': 'পৌরনীতি ও নাগরিকতা',
    'উচ্চতর গণিত': 'উচ্চতর গণিত',
    'উচ্চতর': 'উচ্চতর গণিত',
    'জীব': 'জীব বিজ্ঞান',
    'জীববিজ্ঞান': 'জীব বিজ্ঞান',
    'কৃষি': 'কৃষি শিক্ষা',
    'বাংলা ১': 'বাংলা প্রথম',
    'বাংলা ২য়': 'বাংলা দ্বিতীয়',
    'ইংরেজি ১': 'ইংরেজি প্রথম',
    'ইংরেজি ২য়': 'ইংরেজি দ্বিতীয়',
    'আইসিটি': 'তথ্য ও যোগাযোগ প্রযুক্তি',
};

const CLASS_9_10_COMBINED_PAIRS: {
    subjects: [string, string];
    shortNames: [string, string];
}[] = [
    { subjects: ['জীব বিজ্ঞান', 'পৌরনীতি ও নাগরিকতা'], shortNames: ['জীব', 'পৌরনীতি'] },
    { subjects: ['রসায়ন', 'ভূগোল ও পরিবেশ'], shortNames: ['রসায়ন', 'ভূগোল'] },
    { subjects: ['পদার্থ', 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা'], shortNames: ['পদার্থ', 'ইতিহাস'] },
    { subjects: ['বাংলাদেশ ও বিশ্ব পরিচয়', 'সাধারণ বিজ্ঞান'], shortNames: ['বা ও বি', 'বিজ্ঞান'] },
    { subjects: ['কৃষি শিক্ষা', 'উচ্চতর গণিত'], shortNames: ['কৃষি', 'উচ্চতর'] },
];

const teacherAllocations: Record<string, Record<string, string[]>> = {
    'ওবায়দা': {
        'বাংলা প্রথম': ['6', '7', '8', '9', '10']
    },
    'যুধিষ্ঠির': {
        'বাংলা দ্বিতীয়': ['6', '7', '8', '9', '10'],
        'ইংরেজি দ্বিতীয়': ['6', '7']
    },
    'আরিফুর': {
        'ইংরেজি প্রথম': ['6', '7', '8', '9', '10'],
        'ইংরেজি দ্বিতীয়': ['8', '9', '10']
    },
    'ধনঞ্জয়': {
        'গণিত': ['6', '7', '8', '9', '10'],
        'পদার্থ': ['9', '10'],
        'রসায়ন': ['9', '10'],
        'উচ্চতর গণিত': ['9']
    },
    'মাহাবুর': {
        'ধর্ম ও নৈতিক শিক্ষা': ['6', '7', '8', '9', '10'],
        'ইসলাম ধর্ম': ['6', '7', '8', '9', '10'],
        'কৃষি শিক্ষা': ['9', '10'],
        'শারীরিক শিক্ষা': ['6', '7', '8', '9', '10']
    },
    'শান্তি': {
        'সাধারণ বিজ্ঞান': ['6', '7', '8', '9', '10'],
        'জীব বিজ্ঞান': ['9', '10']
    },
    'আনিছুর': {
        'বাংলাদেশ ও বিশ্ব পরিচয়': ['6', '7', '8', '9', '10'],
        'কৃষি শিক্ষা': ['6'],
        'ধর্ম ও নৈতিক শিক্ষা': ['6', '7', '8', '9', '10']
    },
    'জান্নাতুন': {
        'কৃষি শিক্ষা': ['7', '8'],
        'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা': ['9', '10'],
        'পৌরনীতি ও নাগরিকতা': ['9', '10']
    },
    'সারমিন': {
        'তথ্য ও যোগাযোগ প্রযুক্তি': ['6', '7', '8', '9', '10'],
        'ভূগোল ও পরিবেশ': ['9', '10']
    },
    'নীলা': {
        'ধর্ম ও নৈতিক শিক্ষা': ['6', '7', '8', '9', '10'],
        'হিন্দু ধর্ম': ['6', '7', '8', '9', '10'],
        'শারীরিক শিক্ষা': ['6', '7', '8', '9', '10']
    }
};

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

const parseSubjectTeacher = (cell: string): { subject: string, teacher: string | null } => {
    if (!cell) return { subject: '', teacher: null };
    const trimmedCell = cell.trim();
    if (!trimmedCell.includes(' - ')) {
        return { subject: trimmedCell, teacher: null };
    }
    const parts = trimmedCell.split(' - ');
    const teacher = parts.pop()?.trim() || null;
    const subject = parts.join(' - ').trim();
    return { subject, teacher };
};

const useRoutineAnalysis = (routine: Record<string, Record<string, string[]>>, columns: RoutineColumnConfig[] = DEFAULT_ROUTINE_COLUMNS) => {
    const analysis = useMemo(() => {
        const colorPalette = [
            '#FDEDEC', '#F5EEF8', '#EAF2F8', '#D6EAF8',
            '#D1F2EB', '#D0ECE7', '#D4EFDF', '#FCF3CF',
            '#FDEBD0', '#FAE5D3', '#F6DDCC', '#FADBD8',
            '#E5E7E9', '#E8DAEF', '#D2B4DE', '#A9CCE3',
            '#A3E4D7', '#A2D9CE', '#ABEBC6', '#F9E79F',
            '#FAD7A0', '#F5CBA7', '#EDBB99', '#D98880'
        ];

        const teacherClashes = new Set<string>();
        const consecutiveClassClashes = new Set<string>();
        const breakClashes = new Set<string>();
        const subjectRepetitionClashes = new Set<string>();
        const teacherSubjectMismatchClashes = new Set<string>();
        
        const teacherStats: { [teacher: string]: { 
            total: number, 
            daily: { [day: string]: { classes: string[], before: number, after: number }},
            fullSchedule: { [day: string]: string[] } 
        } } = {};
        const classStats: { [cls: string]: { [subject: string]: number } } = {};
        
        const allIndividualTeachers = new Set<string>();
        Object.keys(teacherAllocations).forEach(t => allIndividualTeachers.add(t));

        const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];
        const classes = Object.keys(routine);
        const periodColumns = columns.filter(c => c.type === 'period');
        const periodsCount = Math.max(periodColumns.length, 1);

        classes.forEach(cls => {
            days.forEach(day => {
                const dayRoutine = routine[cls]?.[day];
                if (dayRoutine) {
                    dayRoutine.forEach(cell => {
                        if (cell) {
                            const { teacher } = parseSubjectTeacher(cell);
                            if (teacher) {
                                teacher.split('/').forEach(t => {
                                    const trimmedTeacher = t.trim();
                                    if (trimmedTeacher && !allIndividualTeachers.has(trimmedTeacher)) {
                                        allIndividualTeachers.add(trimmedTeacher);
                                    }
                                });
                            }
                        }
                    });
                }
            });
        });

        allIndividualTeachers.forEach(t => {
            teacherStats[t] = { 
                total: 0, 
                daily: { 
                    'রবিবার': { classes: [], before: 0, after: 0 }, 
                    'সোমবার': { classes: [], before: 0, after: 0 }, 
                    'মঙ্গলবার': { classes: [], before: 0, after: 0 }, 
                    'বুধবার': { classes: [], before: 0, after: 0 }, 
                    'বৃহস্পতিবার': { classes: [], before: 0, after: 0 } 
                },
                fullSchedule: {
                    'রবিবার': Array(periodsCount).fill(''),
                    'সোমবার': Array(periodsCount).fill(''),
                    'মঙ্গলবার': Array(periodsCount).fill(''),
                    'বুধবার': Array(periodsCount).fill(''),
                    'বৃহস্পতিবার': Array(periodsCount).fill('')
                }
            };
        });
        
        const sortedTeachers = Array.from(allIndividualTeachers).sort();
        const teacherColorMap = new Map<string, string>();
        sortedTeachers.forEach((teacher, index) => {
            teacherColorMap.set(teacher, colorPalette[index % colorPalette.length]);
        });

        // Calculate break position
        const breakIndexInColumns = columns.findIndex(c => c.type === 'break');
        let periodBeforeBreak = -1;
        let periodAfterBreak = -1;
        if (breakIndexInColumns !== -1) {
            periodBeforeBreak = columns.slice(0, breakIndexInColumns).filter(c => c.type === 'period').length - 1;
            periodAfterBreak = periodBeforeBreak + 1;
        }
        
        days.forEach(day => {
            const teachersBeforeBreak = new Map<string, string[]>();
            const teachersAfterBreak = new Map<string, string[]>();

            for (let periodIdx = 0; periodIdx < periodsCount; periodIdx++) {
                const periodTeachers = new Map<string, string>();
                classes.forEach(cls => {
                    const cell = routine[cls]?.[day]?.[periodIdx];
                    if (cell) {
                        const { subject, teacher } = parseSubjectTeacher(cell);
                        if (teacher) {
                            teacher.split('/').forEach(t => {
                                const trimmedTeacher = t.trim();
                                if (!trimmedTeacher) return;

                                if (teacherStats[trimmedTeacher]) {
                                    teacherStats[trimmedTeacher].fullSchedule[day][periodIdx] = `${subject}|${cls}`;
                                }

                                if (periodTeachers.has(trimmedTeacher)) {
                                    teacherClashes.add(`${cls}-${day}-${periodIdx}`);
                                    const existingCls = periodTeachers.get(trimmedTeacher)!;
                                    teacherClashes.add(`${existingCls}-${day}-${periodIdx}`);
                                } else {
                                    periodTeachers.set(trimmedTeacher, cls);
                                }

                                if (periodBeforeBreak >= 0 && periodIdx === periodBeforeBreak) { 
                                    if (!teachersBeforeBreak.has(trimmedTeacher)) teachersBeforeBreak.set(trimmedTeacher, []);
                                    teachersBeforeBreak.get(trimmedTeacher)!.push(cls);
                                } else if (periodAfterBreak >= 0 && periodIdx === periodAfterBreak) { 
                                    if (!teachersAfterBreak.has(trimmedTeacher)) teachersAfterBreak.set(trimmedTeacher, []);
                                    teachersAfterBreak.get(trimmedTeacher)!.push(cls);
                                }
                            })
                        }
                    }
                });
            }

            if (periodBeforeBreak >= 0 && periodAfterBreak >= 0) {
                teachersBeforeBreak.forEach((classesBefore, teacher) => {
                    if (teachersAfterBreak.has(teacher)) {
                        const classesAfter = teachersAfterBreak.get(teacher)!;
                        classesBefore.forEach(cls => breakClashes.add(`${cls}-${day}-${periodBeforeBreak}`));
                        classesAfter.forEach(cls => breakClashes.add(`${cls}-${day}-${periodAfterBreak}`));
                    }
                });
            }
        });

        classes.forEach(cls => {
            classStats[cls] = {};
            const subjectsInClass = getSubjects(cls);
            days.forEach(day => {
                const dayRoutine = routine[cls]?.[day];
                if (dayRoutine) {
                    const subjectCountInDay = new Map<string, number[]>();

                    dayRoutine.forEach((cell, periodIdx) => {
                        const { subject, teacher } = parseSubjectTeacher(cell);
                        if (!subject && !teacher) return;

                        const subjectsInCell = subject.split('/').map(s => s.trim()).filter(Boolean);
                        const subjectsForStatsCount = (cls === '9' || cls === '10') && subjectsInCell.length > 1
                            ? [subjectsInCell[0]]
                            : subjectsInCell;

                        subjectsForStatsCount.forEach(s => {
                            const normalizedSubject = subjectNameNormalization[s] || s;
                            const subjectInfo = subjectsInClass.find(sub => sub.name === normalizedSubject || sub.name === s);
                            
                            const statKey = subjectInfo ? subjectInfo.name : normalizedSubject;
                            if (!classStats[cls][statKey]) classStats[cls][statKey] = 0;
                            classStats[cls][statKey] += 1;
                        });

                        subjectsInCell.forEach(s => {
                            if (!subjectCountInDay.has(s)) {
                                subjectCountInDay.set(s, []);
                            }
                            subjectCountInDay.get(s)!.push(periodIdx);
                        });

                        if (teacher) {
                            teacher.split('/').forEach(t => {
                                const trimmedTeacher = t.trim();
                                if (!trimmedTeacher || !teacherStats[trimmedTeacher]) return;
                                
                                teacherStats[trimmedTeacher].total++;
                                teacherStats[trimmedTeacher].daily[day].classes.push(`${subject} (${cls} শ্রেণি)`);
                                if (periodIdx < 3) {
                                    teacherStats[trimmedTeacher].daily[day].before++;
                                } else {
                                    teacherStats[trimmedTeacher].daily[day].after++;
                                }
                            });
                        }
                        
                        if (subject && teacher) {
                            const teachersInCell = teacher.split('/').map(t => t.trim()).filter(Boolean);
                            const subjectsInCellNormalized = subjectsInCell.map(s => subjectNameNormalization[s] || s);
                            const classNumber = cls.split('-')[0];

                            teachersInCell.forEach(t => {
                                if (!teacherAllocations[t]) return;
                                
                                let isAllocated = false;
                                for (const subj of subjectsInCellNormalized) {
                                    if (teacherAllocations[t][subj]?.includes(classNumber)) {
                                        isAllocated = true;
                                        break;
                                    }
                                }
                                
                                if (!isAllocated) {
                                    teacherSubjectMismatchClashes.add(`${cls}-${day}-${periodIdx}`);
                                }
                            });
                        }
                    });

                    const pairStrings = ["0,1", "1,2", "3,4", "4,5"];
                    pairStrings.forEach(pair => {
                        const [p1, p2] = pair.split(',').map(Number);
                        const cell1 = dayRoutine[p1];
                        const cell2 = dayRoutine[p2];
                        if (!cell1 || !cell2) return;

                        const teacher1 = parseSubjectTeacher(cell1).teacher;
                        const teacher2 = parseSubjectTeacher(cell2).teacher;
                        if (teacher1 && teacher2) {
                            const teachers1 = teacher1.split('/').map(t => t.trim()).filter(Boolean);
                            const teachers2 = teacher2.split('/').map(t => t.trim()).filter(Boolean);
                            const hasOverlap = teachers1.some(t => teachers2.includes(t));
                            if (hasOverlap) {
                                consecutiveClassClashes.add(`${cls}-${day}-${p1}`);
                                consecutiveClassClashes.add(`${cls}-${day}-${p2}`);
                            }
                        }
                    });
                }
            });
        });

        return { conflicts: { teacherClashes, consecutiveClassClashes, breakClashes, subjectRepetitionClashes, teacherSubjectMismatchClashes }, stats: { teacherStats, classStats }, teacherColorMap };
    }, [routine]);

    return analysis;
};

const ProxyManagementTab = ({ routineData, academicYear }: { routineData: Record<string, Record<string, string[]>>, academicYear: string }) => {
    const db = useFirestore();
    const { toast } = useToast();
    const { hasPermission } = useAuth();
    const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());
    const [absentTeacher, setAbsentTeacher] = useState<string>('');
    const [allStaff, setAllStaff] = useState<Staff[]>([]);
    const [leaveTeachers, setLeaveTeachers] = useState<{id: string, name: string}[]>([]);
    const [proxies, setProxies] = useState<ProxyClass[]>([]);
    const [selections, setSelections] = useState<Map<string, string>>(new Map());
    const [isSaving, setIsSaving] = useState<string | null>(null);
    const [isFetchingLeave, setIsFetchingLeave] = useState(false);

    const canManageProxy = hasPermission('manage:proxy-classes');
    const dayName = selectedDate ? dayMap[selectedDate.getDay()] : '';
    const isWeekend = dayName === 'শুক্রবার' || dayName === 'শনিবার';
    
    const availableTeachersInRoutine = useMemo(() => {
        const teachers = new Set<string>();
        Object.keys(routineData).forEach(cls => {
            if (dayName && routineData[cls][dayName]) {
                routineData[cls][dayName].forEach(cell => {
                    const { teacher } = parseSubjectTeacher(cell);
                    if (teacher) teacher.split('/').forEach(t => teachers.add(t.trim()));
                });
            }
        });
        return Array.from(teachers).sort();
    }, [routineData, dayName]);

    const getBusyTeachersForPeriod = useCallback((periodIdx: number) => {
        if (!dayName || !routineData || !routineData['6']) return new Set<string>();
        const busy = new Set<string>();
        Object.keys(routineData).forEach(cls => {
            const cell = routineData[cls][dayName]?.[periodIdx];
            if (cell) {
                const { teacher } = parseSubjectTeacher(cell);
                if (teacher) {
                    teacher.split('/').forEach(t => {
                        const trimmed = t.trim();
                        if (trimmed) busy.add(trimmed);
                    });
                }
            }
        });
        return busy;
    }, [dayName, routineData]);

    useEffect(() => {
        if (!db || !selectedDate) return;
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        setIsFetchingLeave(true);

        const fetchLeaveAndStaff = async () => {
            try {
                const [attRecord, allStaffData] = await Promise.all([
                    getStaffAttendanceByDate(db, dateStr),
                    getStaff(db)
                ]);
                setAllStaff(allStaffData);

                if (attRecord) {
                    const leaveList = attRecord.attendance
                        .filter(a => a.status === 'leave')
                        .map(l => {
                            const s = allStaffData.find(st => st.id === l.staffId);
                            return { id: l.staffId, name: s?.nameBn || 'অজানা' };
                        });
                    setLeaveTeachers(leaveList);
                } else {
                    setLeaveTeachers([]);
                }
            } catch (e) {
                console.error(e);
            }
            setIsFetchingLeave(false);
        };

        fetchLeaveAndStaff();

        const q = query(
            collection(db, 'proxyClasses'),
            where("date", "==", dateStr),
            where("academicYear", "==", academicYear)
        );

        const unsubscribe = onSnapshot(q, (snapshot) => {
            setProxies(snapshot.docs.map(doc => {
                const data = doc.data();
                return { id: doc.id, ...data } as ProxyClass;
            }));
        });

        return () => unsubscribe();
    }, [db, selectedDate, academicYear]);

    const classesToProxy = useMemo(() => {
        if (!absentTeacher || !dayName) return [];
        const items: any[] = [];
        Object.keys(routineData).forEach(cls => {
            if (routineData[cls][dayName]) {
                routineData[cls][dayName].forEach((cell, idx) => {
                    const { teacher, subject } = parseSubjectTeacher(cell);
                    if (teacher?.includes(absentTeacher)) {
                        items.push({ className: cls, periodIndex: idx, subject, originalTeacher: absentTeacher });
                    }
                });
            }
        });
        return items;
    }, [absentTeacher, dayName, routineData]);

    const handleAssignProxy = (item: any) => {
        if (!db || !selectedDate) return;
        
        if (!canManageProxy) {
            toast({ variant: 'destructive', title: 'দুঃখিত, আপনার এটি করার অনুমতি নেই।' });
            return;
        }

        const selectionKey = `${item.className}-${item.periodIndex}`;
        const proxyTeacher = selections.get(selectionKey);

        if (!proxyTeacher) {
            toast({ variant: 'destructive', title: 'বদলি শিক্ষক নির্বাচন করুন' });
            return;
        }

        setIsSaving(selectionKey);
        const dateStr = format(selectedDate, 'yyyy-MM-dd');
        const newProxy: NewProxyData = {
            date: dateStr,
            academicYear,
            className: item.className,
            periodIndex: item.periodIndex,
            originalTeacher: item.originalTeacher,
            proxyTeacher,
            subject: item.subject
        };

        saveProxyClass(db, newProxy);
        toast({ title: 'বদলি শিক্ষক নিয়োগ সম্পন্ন' });
        setTimeout(() => setIsSaving(null), 500);
    };

    const handleDeleteProxy = (id: string) => {
        if (!db) return;
        if (!canManageProxy) {
            toast({ variant: 'destructive', title: 'দুঃখিত, আপনার এটি করার অনুমতি নেই।' });
            return;
        }
        deleteProxyClass(db, id);
        toast({ title: 'বদলি নিয়োগ বাতিল করা হয়েছে' });
    };

    const boardData = useMemo(() => {
        const columns = periodLabels.map((label, idx) => ({
            label,
            idx,
            items: proxies.filter(p => p.periodIndex === idx)
        }));
        return columns;
    }, [proxies]);

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6 p-6 border rounded-xl bg-white shadow-sm">
                <div className="space-y-2">
                    <Label className="font-bold text-primary flex items-center gap-2"><CalendarClock className="h-4 w-4" /> তারিখ নির্বাচন</Label>
                    <DatePicker value={selectedDate} onChange={setSelectedDate} />
                    {isWeekend && <p className="text-[10px] text-red-600 font-bold">আজ সাপ্তাহিক ছুটি!</p>}
                </div>
                
                <div className="space-y-4 md:col-span-2">
                    <div className="space-y-2">
                        <Label className="font-bold text-red-600 flex items-center gap-2">
                            <UserX className="h-4 w-4" /> অনুপস্থিত শিক্ষক নির্বাচন করুন
                        </Label>
                        
                        {/* Auto-suggest from attendance */}
                        {leaveTeachers.length > 0 && (
                            <div className="p-3 bg-rose-50 border border-rose-100 rounded-lg space-y-2">
                                <p className="text-[10px] font-black text-rose-700 uppercase tracking-wider flex items-center gap-1">
                                    <Info className="h-3 w-3" /> হাজিরা অনুযায়ী ছুটিতে আছেন:
                                </p>
                                <div className="flex flex-wrap gap-2">
                                    {leaveTeachers.map(t => (
                                        <Button 
                                            key={t.id} 
                                            variant={absentTeacher === t.name ? "default" : "outline"}
                                            size="sm" 
                                            className={cn(
                                                "h-8 text-xs font-black shadow-sm transition-all",
                                                absentTeacher === t.name ? "bg-rose-600 hover:bg-rose-700" : "bg-white border-rose-200 text-rose-700 hover:bg-rose-100"
                                            )}
                                            onClick={() => setAbsentTeacher(t.name)}
                                        >
                                            {t.name}
                                        </Button>
                                    ))}
                                </div>
                            </div>
                        )}

                        <div className="flex gap-2">
                            <Select value={absentTeacher} onValueChange={setAbsentTeacher} disabled={isWeekend}>
                                <SelectTrigger className="flex-1 bg-white">
                                    <SelectValue placeholder={isFetchingLeave ? "লোড হচ্ছে..." : "শিক্ষক নির্বাচন করুন (ম্যানুয়ালি)"} />
                                </SelectTrigger>
                                <SelectContent>
                                    {availableTeachersInRoutine.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                                </SelectContent>
                            </Select>
                            {absentTeacher && (
                                <Button variant="ghost" onClick={() => setAbsentTeacher('')} className="text-[10px] h-10 font-bold">ক্লিয়ার</Button>
                            )}
                        </div>
                        <p className="text-[10px] text-muted-foreground italic font-medium">
                            {dayName ? `${dayName} দিনের রুটিন অনুযায়ী ক্লাসগুলো নিচে দেখা যাবে।` : 'তারিখ সিলেক্ট করুন।'}
                        </p>
                    </div>
                </div>
            </div>

            {absentTeacher && classesToProxy.length > 0 && (
                <Card className="border-2 border-dashed border-primary/20 bg-primary/5">
                    <CardHeader className="pb-2">
                        <CardTitle className="text-lg flex items-center gap-2">
                            <Plus className="h-5 w-5" /> বদলি ক্লাস এসাইন করুন: <span className="text-rose-700 font-black">{absentTeacher}</span>
                        </CardTitle>
                        <CardDescription>নিচে {absentTeacher} এর সকল ক্লাস পিরিয়ড অনুযায়ী দেখা যাচ্ছে।</CardDescription>
                    </CardHeader>
                    <CardContent className="pt-4">
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                            {classesToProxy.map((item, idx) => {
                                const selectionKey = `${item.className}-${item.periodIndex}`;
                                const isAssigned = proxies.some(p => p.className === item.className && p.periodIndex === item.periodIndex);
                                const busyTeachersShortNames = getBusyTeachersForPeriod(item.periodIndex);
                                
                                const freeTeachers = allStaff.filter(s => {
                                    if (s.staffType !== 'teacher') return false;
                                    const isTheAbsentTeacher = s.nameBn.includes(absentTeacher) || absentTeacher.includes(s.nameBn);
                                    if (isTheAbsentTeacher) return false;
                                    
                                    const isBusy = Array.from(busyTeachersShortNames).some(busyName => 
                                        s.nameBn.includes(busyName) || busyName.includes(s.nameBn)
                                    );
                                    return !isBusy;
                                });

                                return (
                                    <div key={idx} className="p-4 border rounded-lg bg-white space-y-3 shadow-sm transition-all hover:ring-2 hover:ring-primary/20">
                                        <div className="flex justify-between items-start">
                                            <Badge variant="outline" className="bg-primary/5 text-primary border-primary/20 font-black">{periodLabels[item.periodIndex]} পিরিয়ড</Badge>
                                            <span className="text-xs font-black text-slate-700 uppercase tracking-tighter">{classNamesMap[item.className]} শ্রেণি</span>
                                        </div>
                                        <p className="font-bold text-sm bg-muted/20 p-2 rounded">{item.subject}</p>
                                        <div className="space-y-1">
                                            <Label className="text-[10px] uppercase font-black text-muted-foreground">বদলি শিক্ষক (যারা ফ্রি আছেন)</Label>
                                            <Select 
                                                disabled={isAssigned || isSaving === selectionKey || !canManageProxy}
                                                value={selections.get(selectionKey) || ""}
                                                onValueChange={(val) => setSelections(prev => new Map(prev).set(selectionKey, val))}
                                            >
                                                <SelectTrigger className="h-9 text-xs border-2">
                                                    <SelectValue placeholder={isAssigned ? "ইতিমধ্যে নিয়োগকৃত" : "ফ্রি শিক্ষক নির্বাচন"} />
                                                </SelectTrigger>
                                                <SelectContent>
                                                    {freeTeachers.length === 0 ? (
                                                        <SelectItem value="none" disabled>এই পিরিয়ডে কেউ ফ্রি নেই</SelectItem>
                                                    ) : (
                                                        freeTeachers.map(s => (
                                                            <SelectItem key={s.id} value={s.nameBn}>{s.nameBn}</SelectItem>
                                                        ))
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                        
                                        {!isAssigned ? (
                                            <Button 
                                                size="sm" 
                                                className="w-full h-9 text-xs gap-2 font-black shadow-md"
                                                onClick={() => handleAssignProxy(item)}
                                                disabled={isSaving === selectionKey || !selections.get(selectionKey) || !canManageProxy}
                                            >
                                                {isSaving === selectionKey ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                                                নিয়োগ নিশ্চিত করুন
                                            </Button>
                                        ) : (
                                            <div className="p-2 bg-emerald-50 rounded border border-emerald-100 flex items-center justify-center gap-2">
                                                <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                <span className="text-[10px] text-emerald-700 font-black">নিয়োগ সম্পন্ন হয়েছে</span>
                                            </div>
                                        )}
                                    </div>
                                );
                            })}
                        </div>
                    </CardContent>
                </Card>
            )}

            <div className="space-y-4">
                <div className="flex items-center justify-between px-2">
                    <h3 className="text-xl font-black text-slate-800 flex items-center gap-2">
                        <LayoutGrid className="h-5 w-5 text-primary" /> বদলি ক্লাস বোর্ড (পিরিয়ড ভিত্তিক)
                    </h3>
                    <Badge variant="outline" className="font-black border-primary text-primary bg-primary/5">
                        মোট {toBengaliNumber(proxies.length)} টি ক্লাস
                    </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 overflow-x-auto pb-6 scrollbar-none">
                    {boardData.map((col) => (
                        <div key={col.idx} className="flex flex-col gap-3 min-w-[200px]">
                            <div className="p-3 bg-slate-800 text-white rounded-lg font-black text-sm text-center shadow-md">
                                {col.label} পিরিয়ড
                            </div>
                            <div className="flex flex-col gap-3">
                                {col.items.length === 0 ? (
                                    <div className="h-24 border-2 border-dashed rounded-xl flex items-center justify-center text-[10px] text-muted-foreground bg-white/50 italic text-center px-6">
                                        কোনো বদলি ক্লাস নির্ধারিত নেই
                                    </div>
                                ) : (
                                    col.items.map(proxy => (
                                        <div key={proxy.id} className="p-4 border-2 border-emerald-200 rounded-xl bg-white shadow-lg relative group animate-in slide-in-from-bottom-2 duration-300">
                                            {canManageProxy && (
                                                <Button 
                                                    variant="ghost" 
                                                    size="icon" 
                                                    className="absolute -top-2 -right-2 h-7 w-7 rounded-full bg-red-100 text-red-600 shadow-md opacity-0 group-hover:opacity-100 transition-opacity z-10 hover:bg-red-200"
                                                    onClick={() => handleDeleteProxy(proxy.id)}
                                                >
                                                    <Trash2 className="h-4 w-4" />
                                                </Button>
                                            )}
                                            <div className="text-[10px] font-black text-primary mb-2 uppercase border-b pb-1">{classNamesMap[proxy.className]} শ্রেণি</div>
                                            <p className="text-xs font-black leading-tight text-slate-900 mb-3">{proxy.subject}</p>
                                            <div className="space-y-1.5 pt-2 border-t border-dashed">
                                                <div className="flex items-center justify-between text-[9px] font-bold">
                                                    <span className="text-muted-foreground">মূল শিক্ষক:</span>
                                                    <span className="text-rose-600">{proxy.originalTeacher}</span>
                                                </div>
                                                <div className="flex items-center justify-between text-[9px] font-black">
                                                    <span className="text-muted-foreground">বদলি শিক্ষক:</span>
                                                    <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded">{proxy.proxyTeacher}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
};

const TeacherAllocationTab = ({ staffList, routineData, academicYear, onAllocationUpdated }: { staffList: Staff[], routineData: Record<string, Record<string, string[]>>, academicYear: string, onAllocationUpdated?: () => void }) => {
    const db = useFirestore();
    const { toast } = useToast();
    const { hasPermission } = useAuth();
    const isEn = typeof document !== 'undefined' && document.cookie.includes('googtrans=/bn/en');

    const getTeacherDisplayName = (teacherNameBn: string) => {
        if (!isEn) return teacherNameBn;
        const staff = staffList.find(s => 
            s.nameBn?.trim() === teacherNameBn?.trim() || 
            (s.nameBn && teacherNameBn && (teacherNameBn.includes(s.nameBn) || s.nameBn.includes(teacherNameBn)))
        );
        if (staff && staff.nameEn && staff.nameEn.trim()) {
            return staff.nameEn.trim();
        }
        return teacherNameBn;
    };
    
    const [selectedTeacher, setSelectedTeacher] = useState<string>('');
    const [selectedClass, setSelectedClass] = useState<string>('6');
    const [selectedSubject, setSelectedSubject] = useState<string>('');
    const [isLoading, setIsLoading] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    
    const [allocations, setAllocations] = useState<TeacherAllocationRecord[]>([]);

    const fetchAllocations = useCallback(async () => {
        if (!db) return;
        setIsLoading(true);
        const data = await getTeacherAllocations(db, academicYear);
        
        // Scan current routine to find implicit allocations
        const scanned: Record<string, Set<string>> = {};
        Object.keys(routineData).forEach(cls => {
            Object.values(routineData[cls]).forEach(dayPeriods => {
                dayPeriods.forEach(cell => {
                    const { subject, teacher } = parseSubjectTeacher(cell);
                    if (teacher && subject) {
                        teacher.split('/').forEach(t => {
                            const name = t.trim();
                            if (!name) return;
                            if (!scanned[name]) scanned[name] = new Set();
                            scanned[name].add(`${cls}|${subject}`);
                        });
                    }
                });
            });
        });

        // Merge DB allocations with scanned allocations
        const merged: TeacherAllocationRecord[] = [];
        const seenTeachers = new Set<string>();
        
        // Iterate through all staff who are teachers
        staffList
            .filter(s => s.staffType === 'teacher' && s.nameBn && s.nameBn.trim() !== '' && s.nameBn.toLowerCase() !== 'no data')
            .forEach(staff => {
                if (seenTeachers.has(staff.nameBn)) return;
                seenTeachers.add(staff.nameBn);

                const dbRecord = data.find(r => r.teacherName === staff.nameBn);
                const allocationMap = new Map<string, string>();
                
                if (dbRecord) {
                    // Use saved DB allocations as authoritative source so deletions persist
                    dbRecord.allocations.forEach(a => allocationMap.set(`${a.className}|${a.subjectName}`, a.subjectName));
                } else {
                    // Initial seed from Routine (Sync) only when no DB record exists yet
                    Object.keys(scanned).forEach(shortName => {
                        if (staff.nameBn.includes(shortName) || shortName.includes(staff.nameBn)) {
                            scanned[shortName].forEach(item => {
                                const [cls, sub] = item.split('|');
                                allocationMap.set(`${cls}|${sub}`, sub);
                            });
                        }
                    });
                }

                const finalAllocations: SubjectAllocation[] = Array.from(allocationMap.entries()).map(([key, sub]) => ({
                    className: key.split('|')[0],
                    subjectName: sub
                }));

                merged.push({
                    teacherName: staff.nameBn,
                    academicYear,
                    allocations: finalAllocations
                });
            });

        setAllocations(merged);
        setIsLoading(false);
    }, [db, academicYear, routineData, staffList]);

    useEffect(() => { fetchAllocations(); }, [fetchAllocations]);

    // Subjects already allocated to any teacher in the currently selected class
    const allocatedSubjectsInClass = useMemo(() => {
        const set = new Set<string>();
        allocations.forEach(rec => {
            rec.allocations.forEach(a => {
                if (a.className === selectedClass) {
                    set.add(a.subjectName);
                }
            });
        });
        return set;
    }, [allocations, selectedClass]);

    const availableSubjectsForClass = useMemo(() => {
        return getSubjects(selectedClass).filter(s => !allocatedSubjectsInClass.has(s.name));
    }, [selectedClass, allocatedSubjectsInClass]);

    useEffect(() => {
        if (selectedSubject && !availableSubjectsForClass.some(s => s.name === selectedSubject)) {
            setSelectedSubject('');
        }
    }, [availableSubjectsForClass, selectedSubject]);

    const handleAddAllocation = async () => {
        if (!db || !selectedTeacher || !selectedClass || !selectedSubject) return;
        
        const record = allocations.find(r => r.teacherName === selectedTeacher);
        const nextAllocations = [...(record?.allocations || [])];
        
        if (nextAllocations.some(a => a.className === selectedClass && a.subjectName === selectedSubject)) {
            toast({ variant: 'destructive', title: 'ইতিমধ্যে যুক্ত আছে' });
            return;
        }

        nextAllocations.push({ className: selectedClass, subjectName: selectedSubject });
        
        setIsSaving(true);
        try {
            await saveTeacherAllocation(db, {
                teacherName: selectedTeacher,
                academicYear,
                allocations: nextAllocations
            });
            toast({ title: 'বণ্টন আপডেট হয়েছে' });
            fetchAllocations();
            onAllocationUpdated?.();
        } catch (e) {}
        setIsSaving(false);
    };

    const handleRemoveAllocation = async (teacherName: string, className: string, subjectName: string) => {
        if (!db || !hasPermission('manage:routines')) return;
        
        const record = allocations.find(r => r.teacherName === teacherName);
        if (!record) return;

        const nextAllocations = record.allocations.filter(a => !(a.className === className && a.subjectName === subjectName));
        
        setIsSaving(true);
        try {
            await saveTeacherAllocation(db, {
                teacherName,
                academicYear,
                allocations: nextAllocations
            });
            toast({ title: 'বণ্টন মুছে ফেলা হয়েছে' });
            fetchAllocations();
            onAllocationUpdated?.();
        } catch (e) {}
        setIsSaving(false);
    };

    return (
        <div className="space-y-8 animate-in fade-in duration-500">
            <Card className="border-2 shadow-lg rounded-3xl overflow-hidden">
                <CardHeader className="bg-primary/5 border-b-2 border-primary/10">
                    <CardTitle className="text-xl font-black flex items-center gap-2"><Briefcase className="h-5 w-5 text-primary" /> নতুন বিষয় বণ্টন</CardTitle>
                    <CardDescription className="font-bold">শিক্ষকদের জন্য শ্রেণি ও বিষয় নির্বাচন করুন</CardDescription>
                </CardHeader>
                <CardContent className="p-6">
                    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
                        <div className="space-y-2">
                            <Label className="font-bold">শিক্ষক নির্বাচন</Label>
                            <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="শিক্ষক" /></SelectTrigger>
                                <SelectContent>
                                    {staffList.filter(s => s.staffType === 'teacher' && s.nameBn && s.nameBn.toLowerCase() !== 'no data').map((s, idx) => (
                                        <SelectItem key={`${s.id || s.nameBn}-${idx}`} value={s.nameBn} className="notranslate" translate="no">{getTeacherDisplayName(s.nameBn)}</SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold">শ্রেণি</Label>
                            <Select value={selectedClass} onValueChange={setSelectedClass}>
                                <SelectTrigger className="bg-white"><SelectValue /></SelectTrigger>
                                <SelectContent>{Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{isEn ? `Class ${v}` : `${l} শ্রেণি`}</SelectItem>)}</SelectContent>
                            </Select>
                        </div>
                        <div className="space-y-2">
                            <Label className="font-bold">বিষয়</Label>
                            <Select value={selectedSubject} onValueChange={setSelectedSubject}>
                                <SelectTrigger className="bg-white"><SelectValue placeholder="বিষয়" /></SelectTrigger>
                                <SelectContent>
                                    {availableSubjectsForClass.length === 0 ? (
                                        <div className="py-2 px-3 text-xs text-muted-foreground font-bold text-center">
                                            এই শ্রেণির সকল বিষয় বরাদ্দ করা হয়েছে
                                        </div>
                                    ) : (
                                        availableSubjectsForClass.map((s, idx) => (
                                            <SelectItem key={`${s.name}-${idx}`} value={s.name}>{s.name}</SelectItem>
                                        ))
                                    )}
                                </SelectContent>
                            </Select>
                        </div>
                        <Button onClick={handleAddAllocation} disabled={isSaving || !selectedTeacher || !selectedSubject} className="font-black h-10 shadow-md">
                            {isSaving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4 mr-1.5" />} যুক্ত করুন
                        </Button>
                    </div>
                </CardContent>
            </Card>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {isLoading ? <div className="col-span-full text-center py-20 italic">তথ্য লোড হচ্ছে...</div> : 
                 allocations.map((record, rIdx) => (
                    <Card key={`${record.teacherName || 'teacher'}-${rIdx}`} className="border-2 border-black/5 hover:border-primary/20 transition-all shadow-sm rounded-2xl overflow-hidden bg-white">
                        <CardHeader className="bg-muted/30 p-4 border-b">
                            <div className="flex items-center gap-3">
                                <Avatar className="h-10 w-10 border-2 border-white shadow-sm">
                                    <AvatarFallback className="bg-primary text-white font-black">{getTeacherDisplayName(record.teacherName).charAt(0)}</AvatarFallback>
                                </Avatar>
                                <CardTitle className="text-base font-black text-slate-800 notranslate" translate="no">{getTeacherDisplayName(record.teacherName)}</CardTitle>
                            </div>
                        </CardHeader>
                        <CardContent className="p-4">
                            <div className="space-y-2">
                                {record.allocations.length === 0 ? (
                                    <p className="text-xs text-muted-foreground italic text-center py-4">কোনো বিষয় বণ্টন করা হয়নি</p>
                                ) : (
                                    record.allocations.map((a, idx) => (
                                        <div key={idx} className="flex items-center justify-between p-2 rounded-lg bg-slate-50 border group">
                                            <div className="flex flex-col">
                                                <span className="text-[11px] font-black text-blue-900 leading-none">{a.subjectName}</span>
                                                <span className="text-[9px] font-bold text-muted-foreground mt-1 notranslate" translate="no">{isEn ? `Class ${a.className}` : `${classNamesMap[a.className]} শ্রেণি`}</span>
                                            </div>
                                            <Button 
                                                variant="ghost" 
                                                size="icon" 
                                                className="h-6 w-6 text-rose-500 opacity-0 group-hover:opacity-100 transition-opacity"
                                                onClick={() => handleRemoveAllocation(record.teacherName, a.className, a.subjectName)}
                                            >
                                                <Trash2 className="h-3 w-3" />
                                            </Button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </CardContent>
                    </Card>
                ))}
            </div>
        </div>
    );
};

const RoutineStatistics = ({ stats }: { stats: any }) => {
    const { teacherStats, classStats } = stats;
    const teachers = Object.keys(teacherStats).sort();
    const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];
    const periodLabels = ["১ম", "২য়", "৩য়", "৪র্থ", "৫ম", "৬ষ্ঠ"];
    const classes = ['6', '7', '8', '9', '10'];

    const [selectedTeacher, setSelectedTeacher] = useState<string>('');

    const teacherSummary = useMemo(() => {
        if (!selectedTeacher || !teacherStats[selectedTeacher]) return null;
        const stats = teacherStats[selectedTeacher];
        let totalBefore = 0;
        let totalAfter = 0;
        Object.values(stats.daily).forEach((d: any) => {
            totalBefore += d.before;
            totalAfter += d.after;
        });
        return {
            name: selectedTeacher,
            total: stats.total,
            before: totalBefore,
            after: totalAfter
        };
    }, [selectedTeacher, teacherStats]);

    const subjectRows = [
        { key: 'বাংলা প্রথম', display: 'বাংলা ১ম' },
        { key: 'বাংলা দ্বিতীয়', display: 'বাংলা ২য়' },
        { key: 'ইংরেজি প্রথম', english: 'English 1st', display: 'ইংরেজি ১ম' },
        { key: 'ইংরেজি দ্বিতীয়', english: 'English 2nd', display: 'ইংরেজি ২য়' },
        { key: 'গণিত', display: 'গণিত' },
        { key: 'ধর্ম ও নৈতিক শিক্ষা', display: 'ধর্ম ও নৈতিক শিক্ষা' },
        { key: 'সাধারণ বিজ্ঞান', display: 'সাধারণ বিজ্ঞান' },
        { key: 'বাংলাদেশ ও বিশ্ব পরিচয়', display: 'বাংলাদেশ ও বিশ্ব পরিচয়' },
        { key: 'কৃষি শিক্ষা', display: 'কৃষি শিক্ষা' },
        { key: 'তথ্য ও যোগাযোগ প্রযুক্তি', display: 'তথ্য ও যোগাযোগ প্রযুক্তি' },
        { key: 'পদার্থ', display: 'পদার্থ' },
        { key: 'রসায়ন', display: 'রসায়ন' },
        { key: 'জীব বিজ্ঞান', display: 'জীব বিজ্ঞান' },
        { key: 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা', display: 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা' },
        { key: 'ভূগোল ও পরিবেশ', display: 'ভূগোল ও পরিবেশ' },
        { key: 'পৌরনীতি ও নাগরিকতা', display: 'পৌরনীতি ও নাগরিকতা' },
        { key: 'উচ্চতর গণিত', display: 'উচ্চতর গণিত' },
    ];

    const columnTotals = useMemo(() => {
        const totals: Record<string, number> = {};
        classes.forEach(cls => {
            totals[cls] = 0;
            subjectRows.forEach(row => {
                totals[cls] += (classStats[cls]?.[row.key] || 0);
            });
        });
        return totals;
    }, [classStats, subjectRows, classes]);

    return (
        <Accordion type="multiple" className="w-full space-y-4">
            <AccordionItem value="teacher-schedule-view" className="border-2 rounded-xl bg-white overflow-hidden shadow-sm">
                <AccordionTrigger className="text-lg font-black bg-muted/20 px-6 py-4 hover:no-underline">শিক্ষকের ব্যক্তিগত রুটিন (পিরিয়ড অনুযায়ী)</AccordionTrigger>
                <AccordionContent className="p-6 space-y-6">
                    <div className="max-w-md space-y-2">
                        <Label className="font-bold text-primary">শিক্ষক নির্বাচন করুন</Label>
                        <Select value={selectedTeacher} onValueChange={setSelectedTeacher}>
                            <SelectTrigger className="bg-white">
                                <SelectValue placeholder="শিক্ষকের নাম" />
                            </SelectTrigger>
                            <SelectContent>
                                {teachers.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                            </SelectContent>
                        </Select>
                    </div>

                    {selectedTeacher ? (
                        <div className="border-2 border-green-600 rounded-lg overflow-x-auto bg-white shadow-sm">
                            <Table className="min-w-[800px]">
                                <TableHeader>
                                    <TableRow className="bg-primary text-primary-foreground">
                                        <TableCell colSpan={8} className="font-black py-4 text-center text-base">
                                            শিক্ষকের নাম: {teacherSummary?.name} | 
                                            সাপ্তাহিক মোট ক্লাস: {teacherSummary?.total.toLocaleString('bn-BD')} টি
                                        </TableCell>
                                    </TableRow>
                                    <TableRow className="bg-muted/50">
                                        <TableHead className="font-bold border-r text-center w-24">বার</TableHead>
                                        {periodLabels.map((p, i) => (
                                            <React.Fragment key={p}>
                                                <TableHead className="text-center font-bold border-r">{p} পিরিয়ড</TableHead>
                                                {i === 2 && <TableHead className="text-center font-bold bg-amber-50 text-amber-900 w-16">টিফিন</TableHead>}
                                            </React.Fragment>
                                        ))}
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {days.map(day => (
                                        <TableRow key={day} className="hover:bg-muted/30">
                                            <TableCell className="font-bold border-r text-center bg-gray-50">{day}</TableCell>
                                            {teacherStats[selectedTeacher].fullSchedule[day].map((entry: string, idx: number) => {
                                                const [subj, clsId] = entry ? entry.split('|') : ['', ''];
                                                return (
                                                    <React.Fragment key={`${day}-${idx}`}>
                                                        <TableCell className={cn(
                                                            "text-center border-r font-medium py-3 px-1",
                                                            entry ? "text-primary bg-primary/5" : "text-muted-foreground/30 font-normal"
                                                        )}>
                                                            {entry ? (
                                                                <div className="flex flex-col items-center">
                                                                    <span className="font-black text-[11px] text-blue-900 leading-tight">{subj}</span>
                                                                    <span className="text-[9px] font-bold text-muted-foreground">{classNamesMap[clsId] || clsId} শ্রেণি</span>
                                                                </div>
                                                            ) : '-'}
                                                        </TableCell>
                                                        {idx === 2 && <TableCell className="bg-amber-50/20 border-r" />}
                                                    </React.Fragment>
                                                );
                                            })}
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center justify-center py-12 text-muted-foreground bg-muted/10 rounded-lg border-2 border-dashed">
                            <User className="h-12 w-12 mb-2 opacity-20" />
                            <p className="font-bold">শিক্ষক নির্বাচন করুন।</p>
                        </div>
                    )}
                </AccordionContent>
            </AccordionItem>

            <AccordionItem value="class-stats" className="border-2 rounded-xl bg-white overflow-hidden shadow-sm">
                <AccordionTrigger className="text-lg font-black bg-muted/20 px-6 py-4 hover:no-underline">শ্রেণি ভিত্তিক বিষয় পরিসংখ্যান</AccordionTrigger>
                <AccordionContent className="p-0">
                     <div className="overflow-x-auto">
                        <Table className="border-collapse border-slate-200 border">
                            <TableHeader>
                                <TableRow className="bg-muted/50">
                                    <TableHead className="text-center font-black border-r w-20">ক্রমিক নং</TableHead>
                                    <TableHead className="font-black border-r text-center">বিষয়ের নাম</TableHead>
                                    {classes.map(cls => (
                                        <TableHead key={cls} className="text-center font-black border-r w-24">
                                            {classNamesMap[cls]}
                                        </TableHead>
                                    ))}
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {subjectRows.map((row, index) => (
                                    <TableRow key={row.key} className="hover:bg-muted/20 h-10">
                                        <TableCell className="text-center border-r">
                                            {toBengaliNumber(index + 1).padStart(2, '০')}
                                        </TableCell>
                                        <TableCell className="border-r pl-4 font-bold">{row.display}</TableCell>
                                        {classes.map(cls => {
                                            const count = classStats[cls]?.[row.key] || 0;
                                            return (
                                                <TableCell key={cls} className="text-center border-r font-black">
                                                    {count > 0 ? toBengaliNumber(count) : ''}
                                                </TableCell>
                                            );
                                        })}
                                    </TableRow>
                                ))}
                                <TableRow className="bg-muted/30 font-black h-12">
                                    <TableCell colSpan={2} className="text-left pl-4 border-r">সাপ্তাহিক মোট ক্লাস</TableCell>
                                    {classes.map(cls => (
                                        <TableCell key={cls} className="text-center border-r text-primary">
                                            {toBengaliNumber(columnTotals[cls])}
                                        </TableCell>
                                    ))}
                                </TableRow>
                            </TableBody>
                        </Table>
                    </div>
                </AccordionContent>
            </AccordionItem>
        </Accordion>
    );
};

const CombinedRoutineTable = ({ 
    routineData, 
    conflicts, 
    isEditMode, 
    onCellChange, 
    teacherColorMap, 
    isMounted,
    columns = DEFAULT_ROUTINE_COLUMNS,
    onAddColumn,
    onDeleteColumn,
    onEditColumn,
    selectedClass = 'all',
    allocationsList = []
}: { 
    routineData: Record<string, Record<string, string[]>>, 
    conflicts: any, 
    isEditMode: boolean, 
    onCellChange: (cls: string, day: string, periodIdx: number, value: string) => void, 
    teacherColorMap: Map<string, string>, 
    isMounted: boolean,
    columns?: RoutineColumnConfig[],
    onAddColumn?: (insertAfterIndex: number) => void,
    onDeleteColumn?: (col: RoutineColumnConfig, index: number) => void,
    onEditColumn?: (col: RoutineColumnConfig, index: number) => void,
    selectedClass?: string,
    allocationsList?: { className: string; subjectName: string; teacherName: string }[]
}) => {
    const isEn = typeof document !== 'undefined' && document.cookie.includes('googtrans=/bn/en');
    const days = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];
    const allClasses = ['6', '7', '8', '9', '10'];
    const classes = (selectedClass && selectedClass !== 'all') ? [selectedClass] : allClasses;

    let periodCounter = 0;
    const columnsWithPeriodIdx = (columns || DEFAULT_ROUTINE_COLUMNS).map(col => {
        if (col.type === 'period') {
            const pIdx = periodCounter++;
            return { ...col, periodIdx: pIdx };
        }
        return { ...col, periodIdx: -1 };
    });

    const topScrollRef = useRef<HTMLDivElement>(null);
    const tableScrollRef = useRef<HTMLDivElement>(null);
    const topScrollInnerRef = useRef<HTMLDivElement>(null);
    const scrollSource = useRef<'top' | 'table' | null>(null);

    // Sync top scrollbar inner width with actual table scrollWidth
    useEffect(() => {
        const tableEl = tableScrollRef.current;
        if (!tableEl || !topScrollInnerRef.current) return;
        const syncWidth = () => {
            if (topScrollInnerRef.current && tableEl) {
                topScrollInnerRef.current.style.width = tableEl.scrollWidth + 'px';
            }
        };
        syncWidth();
        const observer = new ResizeObserver(syncWidth);
        observer.observe(tableEl);
        if (tableEl.firstElementChild) {
            observer.observe(tableEl.firstElementChild);
        }
        return () => observer.disconnect();
    }, [columns, routineData, selectedClass]);

    const handleTopScroll = useCallback(() => {
        if (scrollSource.current === 'table') return;
        scrollSource.current = 'top';
        if (tableScrollRef.current && topScrollRef.current) {
            tableScrollRef.current.scrollLeft = topScrollRef.current.scrollLeft;
        }
        requestAnimationFrame(() => { scrollSource.current = null; });
    }, []);

    const handleTableScroll = useCallback(() => {
        if (scrollSource.current === 'top') return;
        scrollSource.current = 'table';
        if (topScrollRef.current && tableScrollRef.current) {
            topScrollRef.current.scrollLeft = tableScrollRef.current.scrollLeft;
        }
        requestAnimationFrame(() => { scrollSource.current = null; });
    }, []);

    return (
        <div className="w-full">
            {/* Top scrollbar - synced with table, always visible */}
            <div
                ref={topScrollRef}
                onScroll={handleTopScroll}
                className="overflow-x-scroll w-full border-x-2 border-t-2 border-green-600 rounded-t-lg bg-slate-100/50 print:hidden"
                style={{ height: '20px', overflowX: 'scroll' }}
            >
                <div ref={topScrollInnerRef} style={{ height: '1px', minWidth: '901px' }} />
            </div>
        <div ref={tableScrollRef} onScroll={handleTableScroll} className="overflow-x-scroll w-full border-2 border-green-600 rounded-b-lg shadow-inner bg-white print:rounded-lg print:border-t-2 print:overflow-visible">
           <table className="w-full caption-bottom text-sm border-collapse min-w-[900px] print:min-w-full print:text-[8px] border-green-600">
                <TableHeader>
                   <TableRow className="bg-muted/50 h-16 print:h-8">
                       <TableHead className="border-r font-bold align-middle text-center w-[90px] print:w-[60px] border-green-600 text-black">
                           বার
                       </TableHead>
                       <TableHead className="border-r font-bold align-middle text-center w-[85px] print:w-[40px] border-green-600 text-black p-1">
                           <div className="flex flex-col items-center justify-between min-h-[58px] print:min-h-0">
                               <span className="text-sm font-black text-slate-800 mt-1">শ্রেণি</span>
                               {onAddColumn && (
                                   <div className="mt-1 no-print pt-1 border-t border-slate-200/60 w-full flex justify-center">
                                       <button
                                           type="button"
                                           onClick={() => onAddColumn(-1)}
                                           className="h-5 px-1.5 text-[9px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded flex items-center gap-0.5 border border-emerald-200 shadow-xs cursor-pointer"
                                           title="১ম পিরিয়ডের আগে নতুন কলাম যোগ করুন"
                                       >
                                           <Plus className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                                           <span>+ কলাম</span>
                                       </button>
                                   </div>
                                )}
                           </div>
                       </TableHead>
                       {columnsWithPeriodIdx.map((col, index) => {
                           const isBreak = col.type === 'break';
                           return (
                               <TableHead 
                                   key={col.id} 
                                   className={cn(
                                       "border-r text-center font-bold p-1 border-green-600",
                                       isBreak ? "bg-amber-50 text-amber-900 min-w-[80px] print:w-[30px] print:text-[7px]" : "min-w-[115px] print:min-w-[70px] text-black"
                                   )}
                               >
                                   <div className="flex flex-col items-center justify-between min-h-[58px] print:min-h-0">
                                       <div className="w-full">
                                           <span className={cn("text-sm font-black leading-tight block", isBreak ? "text-amber-900" : "text-slate-800")}>
                                               {col.name}
                                           </span>
                                           {col.time && (
                                               <span className={cn("font-medium text-[10px] print:hidden block mt-0.5", isBreak ? "text-amber-700/80" : "text-muted-foreground")}>
                                                   {col.time}
                                               </span>
                                           )}
                                       </div>
                                       {(onAddColumn || onDeleteColumn || onEditColumn) && (
                                           <div className="flex items-center justify-center gap-1 mt-1 no-print pt-1 border-t border-slate-200/60 w-full">
                                               {onAddColumn && (
                                                   <button
                                                       type="button"
                                                       onClick={() => onAddColumn(index)}
                                                       className="h-5 px-1.5 text-[9px] bg-emerald-50 hover:bg-emerald-100 text-emerald-700 font-bold rounded flex items-center gap-0.5 border border-emerald-200 shadow-xs cursor-pointer"
                                                       title="ডানে নতুন কলাম যোগ করুন"
                                                   >
                                                       <Plus className="w-2.5 h-2.5 text-emerald-600 stroke-[3]" />
                                                       <span>যোগ</span>
                                                   </button>
                                               )}
                                               {onEditColumn && (
                                                   <button
                                                       type="button"
                                                       onClick={() => onEditColumn(col, index)}
                                                       className="h-5 w-5 flex items-center justify-center bg-slate-50 hover:bg-slate-200 text-slate-600 rounded border border-slate-200 shadow-xs cursor-pointer"
                                                       title="নাম ও সময় পরিবর্তন"
                                                   >
                                                       <FilePen className="w-2.5 h-2.5" />
                                                   </button>
                                               )}
                                               {onDeleteColumn && (
                                                   <button
                                                       type="button"
                                                       onClick={() => onDeleteColumn(col, index)}
                                                       className="h-5 w-5 flex items-center justify-center bg-rose-50 hover:bg-rose-100 text-rose-600 rounded border border-rose-200 shadow-xs cursor-pointer"
                                                       title="এই কলামটি মুছে ফেলুন"
                                                   >
                                                       <Trash2 className="w-2.5 h-2.5 stroke-[2.5]" />
                                                   </button>
                                               )}
                                           </div>
                                       )}
                                   </div>
                               </TableHead>
                           );
                       })}
                       {onAddColumn && (
                           <TableHead className="w-20 border-r text-center font-bold border-green-600 align-middle no-print p-1 bg-emerald-50/40">
                               <button
                                   type="button"
                                   onClick={() => onAddColumn(columns.length - 1)}
                                   className="h-6 px-2 text-[10px] bg-emerald-600 hover:bg-emerald-700 text-white font-black rounded flex items-center gap-1 transition-colors shadow-xs mx-auto whitespace-nowrap cursor-pointer"
                                   title="শেষে নতুন কলাম যোগ করুন"
                               >
                                   <Plus className="w-3 h-3 stroke-[3]" />
                                   <span>+ কলাম</span>
                               </button>
                           </TableHead>
                       )}
                   </TableRow>
               </TableHeader>
               <TableBody>
                   {days.map((day) => (
                       classes.map((cls, classIndex) => (
                           <TableRow 
                             key={`${day}-${cls}`} 
                             className={cn(
                                "h-12 print:h-7 hover:bg-muted/20 transition-colors",
                                classIndex === 0 && "border-t-[3px] border-t-green-600",
                                classIndex === classes.length - 1 && "border-b-[3px] border-b-green-600"
                             )}
                           >
                               {classIndex === 0 && (
                                    <TableCell className="font-black border-r align-middle text-center bg-gray-50 print:bg-white text-sm print:text-[10px] border-l-[4px] border-l-green-600/20 border-green-600" rowSpan={classes.length}>
                                        {day}
                                    </TableCell>
                               )}
                               <TableCell className="font-bold border-r text-center bg-gray-50/50 print:bg-white text-xs print:text-[8px] border-green-600 notranslate" translate="no">{isEn ? `Class ${cls}` : classNamesMap[cls]}</TableCell>
                               {columnsWithPeriodIdx.map((col) => {
                                   if (col.type === 'break') {
                                       if (classIndex === 0) {
                                           return (
                                               <TableCell 
                                                   key={col.id}
                                                   className="border-r text-center bg-amber-50/30 font-black text-[11px] print:text-[8px] align-middle text-amber-800 border-green-600" 
                                                   rowSpan={classes.length}
                                               >
                                                   <div className="[writing-mode:vertical-lr] rotate-180 py-4 print:py-1 tracking-widest uppercase">
                                                       {col.time || col.name || 'টিফিন'}
                                                   </div>
                                               </TableCell>
                                           );
                                       }
                                       return null;
                                   }
                                   const periodIdx = col.periodIdx;
                                   const cellContent = (routineData[cls]?.[day] || [])[periodIdx] || '';
                                   return (
                                       <EditableCell 
                                           key={`${day}-${cls}-${col.id}-${periodIdx}`} 
                                           content={cellContent} 
                                           isEditMode={isEditMode} 
                                           onCellChange={(value) => onCellChange(cls, day, periodIdx, value)} 
                                           conflictKey={`${cls}-${day}-${periodIdx}`} 
                                           conflicts={conflicts} 
                                           teacherColorMap={teacherColorMap} 
                                           isMounted={isMounted}
                                           cls={cls}
                                           day={day}
                                           periodIdx={periodIdx}
                                           routineData={routineData}
                                           columns={columns}
                                           allocationsList={allocationsList}
                                       />
                                   );
                               })}
                               {onAddColumn && (
                                   <TableCell className="border-r text-center align-middle no-print bg-slate-50/30 p-0 border-green-600" />
                               )}
                           </TableRow>
                       ))
                   ))}
               </TableBody>
           </table>
        </div>
        </div>
    );
};

const EditableCell = ({ 
    content, 
    isEditMode, 
    onCellChange, 
    conflictKey, 
    conflicts, 
    teacherColorMap, 
    isMounted,
    cls,
    day,
    periodIdx,
    routineData,
    columns,
    allocationsList = []
}: { 
    content: string, 
    isEditMode: boolean, 
    onCellChange: (value: string) => void, 
    conflictKey: string, 
    conflicts: any, 
    teacherColorMap: Map<string, string>, 
    isMounted: boolean,
    cls?: string,
    day?: string,
    periodIdx?: number,
    routineData?: Record<string, Record<string, string[]>>,
    columns?: RoutineColumnConfig[],
    allocationsList?: { className: string; subjectName: string; teacherName: string }[]
}) => {
    const isEn = typeof document !== 'undefined' && document.cookie.includes('googtrans=/bn/en');
    
    // Check all types of conflicts
    const isTeacherClash = conflicts.teacherClashes.has(conflictKey);
    const isConsecutiveClash = conflicts.consecutiveClassClashes.has(conflictKey);
    const isTeacherSubjectMismatch = conflicts.teacherSubjectMismatchClashes.has(conflictKey);
    const isBreakClash = conflicts.breakClashes.has(conflictKey);
    const isRepetitionClash = conflicts.subjectRepetitionClashes.has(conflictKey);
    
    const isConflict = isTeacherClash || isConsecutiveClash || isTeacherSubjectMismatch || isBreakClash || isRepetitionClash;

    let tooltipContent = '';
    if (isTeacherClash) tooltipContent += 'শিক্ষক সংঘর্ষ: একই সময়ে এই শিক্ষকের অন্য ক্লাসে ক্লাস রয়েছে। ';
    if (isConsecutiveClash) tooltipContent += 'টানা ক্লাস: একই শিক্ষকের এই ক্লাসে পরপর ক্লাস পড়েছে। ';
    if (isTeacherSubjectMismatch) tooltipContent += 'বিষয় অমিল: এই বিষয়ের জন্য নির্ধারিত শিক্ষক নন। ';
    if (isBreakClash) tooltipContent += 'বিরতি সংঘর্ষ: টিফিনের আগে ও পরে একই শিক্ষকের ক্লাস। ';
    if (isRepetitionClash) tooltipContent += 'বিষয় পুনরাবৃত্তি: একই দিনে একই বিষয় একাধিকবার। ';

    const { teacher } = parseSubjectTeacher(content);
    const teachersInCell = teacher ? teacher.split('/').map(t => t.trim()).filter(Boolean) : [];
    const firstTeacher = teachersInCell.length > 0 ? teachersInCell[0] : null;
    const color = firstTeacher ? teacherColorMap.get(firstTeacher) : undefined;

    const displayContent = useMemo(() => {
        if (!content) return '';
        if (isEn) {
            return content
                .replace(/শান্তি আরা/g, 'Shanti Ara')
                .replace(/শান্তি রায়/g, 'Shanti Roy')
                .replace(/শান্তি রায়/g, 'Shanti Roy')
                .replace(/শান্তি/g, 'Shanti Ara')
                .replace(/\bPeace\b/gi, 'Shanti Ara');
        }
        return content;
    }, [content, isEn]);

    const [isPopoverOpen, setIsPopoverOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [customText, setCustomText] = useState('');

    useEffect(() => {
        if (isPopoverOpen) {
            setCustomText(content || '');
            setSearchQuery('');
        }
    }, [isPopoverOpen, content]);

    // 1. Build list of allocated subject-teacher pairs for this class
    const optionsForClass = useMemo(() => {
        if (!cls) return [];
        const list: { subject: string; teacher: string; searchExtra?: string }[] = [];
        const seen = new Set<string>();
        const allocatedByNormSub = new Map<string, string>();
        const rawAllocations: { subject: string; teacher: string }[] = [];

        // From allocationsList
        if (allocationsList && allocationsList.length > 0) {
            allocationsList
                .filter(a => a.className === cls)
                .forEach(a => {
                    const norm = subjectNameNormalization[a.subjectName] || a.subjectName;
                    if (!allocatedByNormSub.has(norm)) {
                        allocatedByNormSub.set(norm, a.teacherName);
                        rawAllocations.push({ subject: a.subjectName, teacher: a.teacherName });
                    }
                });
        }

        // Only fall back to default teacherAllocations if DB allocationsList is empty
        if (!allocationsList || allocationsList.length === 0) {
            Object.entries(teacherAllocations).forEach(([tName, subMap]) => {
                Object.entries(subMap).forEach(([subject, classList]) => {
                    if (classList.includes(cls)) {
                        const norm = subjectNameNormalization[subject] || subject;
                        if (!allocatedByNormSub.has(norm)) {
                            allocatedByNormSub.set(norm, tName);
                            rawAllocations.push({ subject, teacher: tName });
                        }
                    }
                });
            });
        }

        const isNineOrTen = cls === '9' || cls === '10';
        const findCombinedPair = (subName: string) => {
            if (!isNineOrTen) return null;
            const norm = subjectNameNormalization[subName] || subName;
            return CLASS_9_10_COMBINED_PAIRS.find(p =>
                (subjectNameNormalization[p.subjects[0]] || p.subjects[0]) === norm ||
                (subjectNameNormalization[p.subjects[1]] || p.subjects[1]) === norm
            ) || null;
        };

        rawAllocations.forEach(({ subject, teacher }) => {
            const pair = findCombinedPair(subject);
            if (pair) {
                const norm1 = subjectNameNormalization[pair.subjects[0]] || pair.subjects[0];
                const norm2 = subjectNameNormalization[pair.subjects[1]] || pair.subjects[1];
                const t1 = allocatedByNormSub.get(norm1) || '';
                const t2 = allocatedByNormSub.get(norm2) || '';
                const combinedSub = `${pair.shortNames[0]}/${pair.shortNames[1]}`;
                const combinedTeacher = t1 && t2 ? (t1 === t2 ? t1 : `${t1}/${t2}`) : (t1 || t2);
                const key = `${combinedSub}|${combinedTeacher}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push({
                        subject: combinedSub,
                        teacher: combinedTeacher,
                        searchExtra: `${pair.subjects[0]} ${pair.subjects[1]}`
                    });
                }
            } else {
                const key = `${subject}|${teacher}`;
                if (!seen.has(key)) {
                    seen.add(key);
                    list.push({ subject, teacher });
                }
            }
        });

        // From routineData (only for unallocated/custom entries)
        if (routineData && routineData[cls]) {
            Object.values(routineData[cls]).forEach(pList => {
                pList.forEach(cell => {
                    const { subject: s, teacher: t } = parseSubjectTeacher(cell);
                    if (s && t) {
                        const norm = subjectNameNormalization[s] || s;
                        if (allocatedByNormSub.has(norm)) return;
                        const key = `${s}|${t}`;
                        if (!seen.has(key)) {
                            seen.add(key);
                            list.push({ subject: s, teacher: t });
                        }
                    }
                });
            });
        }

        // Add class subjects from getSubjects(cls) if not present
        const classSubjects = getSubjects(cls);
        classSubjects.forEach(s => {
            const norm = subjectNameNormalization[s.name] || s.name;
            if (allocatedByNormSub.has(norm)) return;
            const pair = findCombinedPair(s.name);
            if (pair) {
                const combinedSub = `${pair.shortNames[0]}/${pair.shortNames[1]}`;
                const hasPair = list.some(item => item.subject === combinedSub);
                if (!hasPair) {
                    list.push({
                        subject: combinedSub,
                        teacher: '',
                        searchExtra: `${pair.subjects[0]} ${pair.subjects[1]}`
                    });
                }
                return;
            }
            const hasSub = list.some(item => item.subject === s.name || subjectNameNormalization[item.subject] === s.name);
            if (!hasSub) {
                list.push({ subject: s.name, teacher: '' });
            }
        });

        return list;
    }, [cls, allocationsList, routineData]);

    // 2. Evaluate rules for each option
    const evaluatedOptions = useMemo(() => {
        if (!routineData || !cls || !day || periodIdx === undefined) {
            return optionsForClass.map(o => ({ ...o, busyInClass: '', isConsecutive: false, isBreakClash: false, subjectRepetitionCount: 0, weeklySubjectCount: 0 }));
        }

        const cols = columns || DEFAULT_ROUTINE_COLUMNS;
        const breakIndexInCols = cols.findIndex(c => c.type === 'break');
        let periodBeforeBreak = -1;
        let periodAfterBreak = -1;
        if (breakIndexInCols !== -1) {
            periodBeforeBreak = cols.slice(0, breakIndexInCols).filter(c => c.type === 'period').length - 1;
            periodAfterBreak = periodBeforeBreak + 1;
        }

        return optionsForClass.map(opt => {
            const teachersToCheck = opt.teacher.split('/').map(t => t.trim()).filter(Boolean);
            let busyInClass = '';
            let isConsecutive = false;
            let isBreakClash = false;
            let subjectRepetitionCount = 0;

            const matchesAnyTeacher = (cellTeacherStr: string | null, fuzzy = false) => {
                if (!cellTeacherStr || teachersToCheck.length === 0) return false;
                const cellTeachers = cellTeacherStr.split('/').map(t => t.trim()).filter(Boolean);
                return teachersToCheck.some(tName =>
                    cellTeachers.some(tr =>
                        fuzzy ? (tr === tName || tr.includes(tName) || tName.includes(tr)) : (tr === tName)
                    )
                );
            };

            if (teachersToCheck.length > 0) {
                // Check if any teacher is busy in any other class at this day and periodIdx
                Object.keys(routineData).forEach(otherCls => {
                    if (otherCls !== cls) {
                        const otherCell = routineData[otherCls]?.[day]?.[periodIdx] || '';
                        if (otherCell) {
                            const { teacher: otherTeacher } = parseSubjectTeacher(otherCell);
                            if (matchesAnyTeacher(otherTeacher, true)) {
                                busyInClass = classNamesMap[otherCls] || otherCls;
                            }
                        }
                    }
                });

                // Consecutive class in this class
                if (periodIdx > 0) {
                    const prevCell = routineData[cls]?.[day]?.[periodIdx - 1] || '';
                    const { teacher: prevTeacher } = parseSubjectTeacher(prevCell);
                    if (matchesAnyTeacher(prevTeacher)) {
                        isConsecutive = true;
                    }
                }
                if (periodIdx < (routineData[cls]?.[day]?.length || 0) - 1) {
                    const nextCell = routineData[cls]?.[day]?.[periodIdx + 1] || '';
                    const { teacher: nextTeacher } = parseSubjectTeacher(nextCell);
                    if (matchesAnyTeacher(nextTeacher)) {
                        isConsecutive = true;
                    }
                }

                // Break clash
                if (periodBeforeBreak >= 0 && periodIdx === periodBeforeBreak) {
                    const afterBreakCell = routineData[cls]?.[day]?.[periodAfterBreak] || '';
                    const { teacher: afterTeacher } = parseSubjectTeacher(afterBreakCell);
                    if (matchesAnyTeacher(afterTeacher)) {
                        isBreakClash = true;
                    }
                } else if (periodAfterBreak >= 0 && periodIdx === periodAfterBreak) {
                    const beforeBreakCell = routineData[cls]?.[day]?.[periodBeforeBreak] || '';
                    const { teacher: beforeTeacher } = parseSubjectTeacher(beforeBreakCell);
                    if (matchesAnyTeacher(beforeTeacher)) {
                        isBreakClash = true;
                    }
                }
            }

            // Subject repetition today
            const dayRoutine = routineData[cls]?.[day] || [];
            dayRoutine.forEach((cell, idx) => {
                if (idx !== periodIdx && cell) {
                    const { subject: s } = parseSubjectTeacher(cell);
                    if (s === opt.subject || (subjectNameNormalization[s] || s) === (subjectNameNormalization[opt.subject] || opt.subject)) {
                        subjectRepetitionCount++;
                    }
                }
            });

            // Weekly subject count for this class
            let weeklySubjectCount = 0;
            const classRoutine = routineData[cls] || {};
            Object.values(classRoutine).forEach((pList) => {
                (pList || []).forEach((cell) => {
                    if (cell) {
                        const { subject: s } = parseSubjectTeacher(cell);
                        if (s === opt.subject || (subjectNameNormalization[s] || s) === (subjectNameNormalization[opt.subject] || opt.subject)) {
                            weeklySubjectCount++;
                        }
                    }
                });
            });

            return {
                ...opt,
                busyInClass,
                isConsecutive,
                isBreakClash,
                subjectRepetitionCount,
                weeklySubjectCount
            };
        });
    }, [optionsForClass, routineData, cls, day, periodIdx, columns]);

    const filteredOptions = useMemo(() => {
        if (!searchQuery.trim()) return evaluatedOptions;
        const q = searchQuery.toLowerCase();
        return evaluatedOptions.filter(o => 
            o.subject.toLowerCase().includes(q) || 
            o.teacher.toLowerCase().includes(q) ||
            (o.searchExtra && o.searchExtra.toLowerCase().includes(q))
        );
    }, [evaluatedOptions, searchQuery]);

    const cellInner = isEditMode ? (
        <Popover open={isPopoverOpen} onOpenChange={setIsPopoverOpen}>
            <PopoverTrigger asChild>
                <button
                    type="button"
                    className={cn(
                        "w-full h-full min-h-[46px] p-1.5 flex flex-col items-center justify-center text-center cursor-pointer transition-all rounded hover:bg-amber-100/70 group/cell border-0 bg-transparent",
                        !content && "border border-dashed border-slate-300 bg-slate-50/70 hover:bg-slate-100",
                        isConflict && "bg-red-100/90 text-red-800 font-black ring-2 ring-red-400"
                    )}
                    title={content ? `${content} (ক্লিক করে ড্রপডাউন থেকে পরিবর্তন করুন)` : "ক্লিক করে ড্রপডাউন থেকে বিষয় ও শিক্ষক নির্বাচন করুন"}
                >
                    {content ? (
                        <div className="flex flex-col items-center leading-tight">
                            <span className="text-[11px] font-black text-slate-900">{content.split(' - ')[0]}</span>
                            <span className="text-[10px] font-bold text-primary mt-0.5">{content.split(' - ')[1] || ''}</span>
                        </div>
                    ) : (
                        <span className="text-[10px] font-bold text-slate-400 group-hover/cell:text-primary flex items-center gap-0.5">
                            <Plus className="w-3 h-3 text-emerald-600 stroke-[3]" /> নির্বাচন
                        </span>
                    )}
                </button>
            </PopoverTrigger>
            <PopoverContent 
                className="w-80 p-0 font-kalpurush shadow-2xl rounded-2xl border-2 border-primary/20 z-[200] bg-white" 
                align="center" 
                side="bottom"
            >
                <div className="p-3 bg-muted/40 border-b flex items-center justify-between">
                    <div className="flex items-center gap-1.5">
                        <LayoutGrid className="w-4 h-4 text-primary" />
                        <span className="text-xs font-black text-slate-800">
                            {classNamesMap[cls || ''] || cls} শ্রেণি • {day} • {periodLabels[periodIdx || 0] || `${toBengaliNumber((periodIdx || 0) + 1)}ম`}
                        </span>
                    </div>
                    {content && (
                        <Button 
                            type="button"
                            variant="ghost" 
                            size="sm" 
                            onClick={() => { onCellChange(''); setIsPopoverOpen(false); }}
                            className="h-6 px-2 text-[10px] text-rose-600 hover:bg-rose-50 hover:text-rose-700 font-bold"
                        >
                            <Trash2 className="w-3 h-3 mr-1" /> খালি করুন
                        </Button>
                    )}
                </div>

                <div className="p-2 border-b bg-white">
                    <Input 
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        placeholder="🔍 বিষয় বা শিক্ষকের নাম খুঁজুন..."
                        className="h-8 text-xs font-bold bg-slate-50 border-slate-200"
                    />
                </div>

                <div className="max-h-60 overflow-y-auto p-1.5 space-y-1 divide-y divide-slate-100">
                    {filteredOptions.length === 0 ? (
                        <div className="py-6 text-center text-xs text-muted-foreground font-bold">
                            কোনো বিষয়/শিক্ষক পাওয়া যায়নি
                        </div>
                    ) : (
                        filteredOptions.map((opt, idx) => {
                            const isBusy = !!opt.busyInClass;
                            const isSelected = content === `${opt.subject} - ${opt.teacher}` || content === opt.subject;
                            return (
                                <button
                                    key={idx}
                                    type="button"
                                    onClick={() => {
                                        const val = opt.teacher ? `${opt.subject} - ${opt.teacher}` : opt.subject;
                                        onCellChange(val);
                                        setIsPopoverOpen(false);
                                    }}
                                    className={cn(
                                        "w-full text-left p-2 rounded-xl transition-all flex flex-col gap-1 cursor-pointer",
                                        isSelected ? "bg-primary/10 border border-primary/30" : "hover:bg-slate-100/80",
                                        isBusy && "bg-rose-50/50 border border-rose-200/50"
                                    )}
                                >
                                    <div className="flex items-center justify-between w-full">
                                        <span className="text-xs font-black text-slate-800">
                                            {opt.subject}
                                        </span>
                                        {opt.teacher && (
                                            <span className="text-[11px] font-bold text-primary">
                                                {opt.teacher}
                                            </span>
                                        )}
                                    </div>

                                    <div className="flex flex-wrap gap-1 items-center mt-0.5">
                                        {isBusy ? (
                                            <span className="text-[9px] font-black text-rose-700 bg-rose-100/90 px-1.5 py-0.5 rounded border border-rose-300">
                                                ⚠️ ব্যস্ত ({opt.busyInClass} শ্রেণিতে ক্লাস আছে)
                                            </span>
                                        ) : opt.teacher ? (
                                            <span className="text-[9px] font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.5 rounded border border-emerald-200">
                                                ✓ ফ্রি (উপলব্ধ)
                                            </span>
                                        ) : null}

                                        {opt.isConsecutive && (
                                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                টানা ক্লাস
                                            </span>
                                        )}

                                        {opt.isBreakClash && (
                                            <span className="text-[9px] font-bold text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                                                টিফিন বিরতি সংঘর্ষ
                                            </span>
                                        )}

                                        {opt.subjectRepetitionCount > 0 && (
                                            <span className="text-[9px] font-bold text-blue-700 bg-blue-50 px-1.5 py-0.5 rounded border border-blue-200">
                                                আজ {toBengaliNumber(opt.subjectRepetitionCount)}টি ক্লাস আছে
                                            </span>
                                        )}

                                        <span className="text-[9px] font-bold text-purple-700 bg-purple-50 px-1.5 py-0.5 rounded border border-purple-200">
                                            সপ্তাহে {toBengaliNumber(opt.weeklySubjectCount)}টি
                                        </span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>

                <div className="p-2.5 bg-slate-50 border-t flex items-center gap-1.5">
                    <Input 
                        value={customText}
                        onChange={(e) => setCustomText(e.target.value)}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter' && customText.trim()) {
                                e.preventDefault();
                                onCellChange(customText.trim());
                                setIsPopoverOpen(false);
                            }
                        }}
                        placeholder="কাস্টম: বিষয় - শিক্ষক"
                        className="h-8 text-xs font-bold bg-white"
                    />
                    <Button
                        type="button"
                        size="sm"
                        onClick={() => {
                            if (customText.trim()) {
                                onCellChange(customText.trim());
                                setIsPopoverOpen(false);
                            }
                        }}
                        disabled={!customText.trim()}
                        className="h-8 px-2.5 text-xs font-bold shrink-0"
                    >
                        সেট
                    </Button>
                </div>
            </PopoverContent>
        </Popover>
    ) : (
        <div className="p-2 print:p-0.5 text-[11px] print:text-[8px] text-center leading-tight break-words font-medium">
            {displayContent || <>&nbsp;</>}
        </div>
    );

    if (!isMounted || !isConflict) {
        return (
            <TableCell 
                className={cn("border-r p-0 h-auto align-middle border-green-600 transition-colors", { "bg-red-50": isConflict && !isEditMode })}
                style={!isEditMode && !isConflict && color ? { backgroundColor: color } : {}}
            >
                {cellInner}
            </TableCell>
        );
    }
    
    return (
        <TableCell className="border-r p-0 h-auto align-middle border-green-600">
             <TooltipProvider>
                <Tooltip>
                    <TooltipTrigger asChild>
                         <div
                            className={cn("w-full h-full transition-all", isConflict ? "bg-red-200/80" : "bg-transparent")}
                            style={!isEditMode && !isConflict && color ? { backgroundColor: color } : {}}
                        >
                            {cellInner}
                        </div>
                    </TooltipTrigger>
                    <TooltipContent className="bg-red-600 text-white border-none shadow-xl">
                        <p className="font-black text-xs">{tooltipContent}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
        </TableCell>
    );
};

export default function RoutinesPage() {
    const { selectedYear, setSelectedYear, availableYears } = useAcademicYear();
    const [isClient, setIsClient] = useState(false);
    const [isMounted, setIsMounted] = useState(false);
    
    const db = useFirestore();
    const { toast } = useToast();
    const [originalRoutineData, setOriginalRoutineData] = useState<Record<string, Record<string, string[]>>>({});
    const [routineData, setRoutineData] = useState<Record<string, Record<string, string[]>>>({});
    const [columns, setColumns] = useState<RoutineColumnConfig[]>(DEFAULT_ROUTINE_COLUMNS);
    const [selectedClassFilter, setSelectedClassFilter] = useState<string>('all');
    const [isLoading, setIsLoading] = useState(true);
    const [isEditMode, setIsEditMode] = useState(false);
    const [activeSection, setActiveSection] = useState('class-routine');

    // Dialog state for adding column
    const [addColumnDialogOpen, setAddColumnDialogOpen] = useState(false);
    const [targetInsertIndex, setTargetInsertIndex] = useState<number>(-1);
    const [newColType, setNewColType] = useState<'period' | 'break'>('period');
    const [newColName, setNewColName] = useState('');
    const [newColTime, setNewColTime] = useState('');

    // Dialog state for editing column
    const [editColumnDialogOpen, setEditColumnDialogOpen] = useState(false);
    const [editingCol, setEditingCol] = useState<RoutineColumnConfig | null>(null);
    const [editingColIndex, setEditingColIndex] = useState<number>(-1);
    const [editColName, setEditColName] = useState('');
    const [editColTime, setEditColTime] = useState('');

    // Dialog state for deleting column
    const [deleteColumnDialogOpen, setDeleteColumnDialogOpen] = useState(false);
    const [deletingCol, setDeletingCol] = useState<RoutineColumnConfig | null>(null);
    const [deletingColIndex, setDeletingColIndex] = useState<number>(-1);

    const [targetYear, setTargetYear] = useState('');
    const { schoolInfo } = useSchoolInfo();
    const { user, hasPermission } = useAuth();
    
    const [allStaff, setAllStaff] = useState<Staff[]>([]);
    const [allocationsList, setAllocationsList] = useState<{ className: string; subjectName: string; teacherName: string }[]>([]);

    const canManageRoutines = hasPermission('manage:routines');
    const canViewProxy = hasPermission('view:proxy-classes');
    const canManageProxy = hasPermission('manage:proxy-classes');
    const isAdmin = user?.role === 'admin';

    const fetchData = useCallback(async () => {
        if (!db || !user) return;
        setIsLoading(true);
        const [routinesFromDb, staffData, colsFromDb, allocationsFromDb] = await Promise.all([
            getFullRoutine(db, selectedYear),
            getStaff(db),
            getRoutineColumns(db, selectedYear),
            getTeacherAllocations(db, selectedYear)
        ]);
        setAllStaff(staffData);
        setColumns(colsFromDb);

        const flatAllocations: { className: string; subjectName: string; teacherName: string }[] = [];
        allocationsFromDb.forEach(rec => {
            rec.allocations?.forEach(a => {
                flatAllocations.push({
                    className: a.className,
                    subjectName: a.subjectName,
                    teacherName: rec.teacherName
                });
            });
        });
        setAllocationsList(flatAllocations);
        
        const numPeriods = colsFromDb.filter(c => c.type === 'period').length || 6;
        const transformedData: Record<string, Record<string, string[]>> = {};
        routinesFromDb.forEach(r => {
            if (!transformedData[r.className]) {
                transformedData[r.className] = {};
            }
            const periods = [...(r.periods || [])];
            while (periods.length < numPeriods) {
                periods.push('');
            }
            transformedData[r.className][r.day] = periods.slice(0, numPeriods);
        });
        setRoutineData(transformedData);
        setOriginalRoutineData(transformedData);
        setIsLoading(false);
    }, [db, user, selectedYear]);

    useEffect(() => {
        setIsClient(true);
        fetchData();
    }, [fetchData]);
    
    useEffect(() => {
        if (isClient) {
            setIsMounted(true);
        }
    }, [isClient]);

    const { conflicts, stats, teacherColorMap } = useRoutineAnalysis(routineData, columns);
    
    // Allow managers and admins to see conflicts
    const displayConflicts = (isAdmin || canManageRoutines) ? conflicts : {
        teacherClashes: new Set<string>(),
        consecutiveClassClashes: new Set<string>(),
        breakClashes: new Set<string>(),
        subjectRepetitionClashes: new Set<string>(),
        teacherSubjectMismatchClashes: new Set<string>()
    };

    const handleCellChange = (className: string, day: string, periodIndex: number, value: string) => {
        setRoutineData(prevData => {
            const newData = JSON.parse(JSON.stringify(prevData));
            const numPeriods = columns.filter(c => c.type === 'period').length || 6;
            if (!newData[className]) newData[className] = {};
            if (!newData[className][day]) newData[className][day] = Array(numPeriods).fill('');
            newData[className][day][periodIndex] = value;
            return newData;
        });
    };

    const openAddColumn = (insertAfterIndex: number) => {
        setTargetInsertIndex(insertAfterIndex);
        setNewColType('period');
        
        const currentPeriodCount = columns.filter(c => c.type === 'period').length;
        const ordinals = ['১ম', '২য়', '৩য়', '৪র্থ', '৫ম', '৬ষ্ঠ', '৭ম', '৮ম', '৯ম', '১০ম', '১১তম', '১২তম'];
        const suggestedName = ordinals[currentPeriodCount] || `${toBengaliNumber(currentPeriodCount + 1)}ম`;
        
        const times = [
            '১০:০০ - ১১:২০',
            '১১:২০ - ১২:১০',
            '১২:১০ - ০১:০০',
            '০২:০০ - ০২:৪০',
            '০২:৪০ - ৩:২০',
            '০৩:২০ - ০৪:০০',
            '০৪:০০ - ০৪:৪০',
            '০৪:৪০ - ০৫:২০'
        ];
        const suggestedTime = times[currentPeriodCount] || '';
        
        setNewColName(suggestedName);
        setNewColTime(suggestedTime);
        setAddColumnDialogOpen(true);
    };

    const submitAddColumn = () => {
        if (!newColName.trim()) {
            toast({ variant: 'destructive', title: 'অনুগ্রহ করে কলামের নাম লিখুন।' });
            return;
        }
        const targetIndex = targetInsertIndex + 1; // if -1, insert at 0
        const newCol: RoutineColumnConfig = {
            id: `col_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
            name: newColName.trim(),
            time: newColTime.trim(),
            type: newColType
        };

        if (newColType === 'period') {
            const newPeriodIdx = columns.slice(0, targetIndex).filter(c => c.type === 'period').length;
            setRoutineData(prevData => {
                const nextData = JSON.parse(JSON.stringify(prevData));
                Object.keys(nextData).forEach(cls => {
                    Object.keys(nextData[cls]).forEach(day => {
                        if (Array.isArray(nextData[cls][day])) {
                            nextData[cls][day].splice(newPeriodIdx, 0, '');
                        }
                    });
                });
                return nextData;
            });
        }

        const nextCols = [...columns];
        nextCols.splice(targetIndex, 0, newCol);
        setColumns(nextCols);
        setIsEditMode(true);
        setAddColumnDialogOpen(false);
        toast({ title: `"${newCol.name}" কলাম যোগ করা হয়েছে। পরিবর্তন সেভ করতে 'সেভ করুন' বাটনে ক্লিক করুন।` });
    };

    const openEditColumn = (col: RoutineColumnConfig, index: number) => {
        setEditingCol(col);
        setEditingColIndex(index);
        setEditColName(col.name);
        setEditColTime(col.time || '');
        setEditColumnDialogOpen(true);
    };

    const submitEditColumn = () => {
        if (!editColName.trim() || editingColIndex < 0) return;
        const nextCols = [...columns];
        nextCols[editingColIndex] = {
            ...nextCols[editingColIndex],
            name: editColName.trim(),
            time: editColTime.trim()
        };
        setColumns(nextCols);
        setIsEditMode(true);
        setEditColumnDialogOpen(false);
        toast({ title: 'কলামের নাম ও সময় আপডেট করা হয়েছে।' });
    };

    const openDeleteColumn = (col: RoutineColumnConfig, index: number) => {
        setDeletingCol(col);
        setDeletingColIndex(index);
        setDeleteColumnDialogOpen(true);
    };

    const confirmDeleteColumn = () => {
        if (!deletingCol || deletingColIndex < 0) return;
        
        if (deletingCol.type === 'period') {
            const periodIdx = columns.slice(0, deletingColIndex).filter(c => c.type === 'period').length;
            setRoutineData(prevData => {
                const nextData = JSON.parse(JSON.stringify(prevData));
                Object.keys(nextData).forEach(cls => {
                    Object.keys(nextData[cls]).forEach(day => {
                        if (Array.isArray(nextData[cls][day])) {
                            nextData[cls][day].splice(periodIdx, 1);
                        }
                    });
                });
                return nextData;
            });
        }

        const nextCols = columns.filter((_, idx) => idx !== deletingColIndex);
        setColumns(nextCols);
        setIsEditMode(true);
        setDeleteColumnDialogOpen(false);
        toast({ title: `"${deletingCol.name}" কলামটি মুছে ফেলা হয়েছে।` });
    };

    const handleSaveChanges = async () => {
        if (!db) return;
        if (!canManageRoutines) {
            toast({ variant: 'destructive', title: 'দুঃখিত, আপনার এটি করার অনুমতি নেই।' });
            return;
        }
        
        try {
            await saveRoutineColumns(db, selectedYear, columns);

            const routinesToSave: ClassRoutine[] = [];
            Object.keys(routineData).forEach(className => {
                Object.keys(routineData[className]).forEach(day => {
                    routinesToSave.push({
                        academicYear: selectedYear,
                        className,
                        day,
                        periods: routineData[className][day]
                    });
                });
            });

            await saveRoutinesBatch(db, routinesToSave);
            toast({ title: 'রুটিন ও কলাম সফলভাবে সেভ হয়েছে' });
            setIsEditMode(false);
            setOriginalRoutineData(routineData);
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'সেভ করা যায়নি' });
        }
    };

    const handleCopyRoutine = async () => {
        if (!db || !targetYear || targetYear === selectedYear) {
            toast({ variant: 'destructive', title: 'সঠিক বছর নির্বাচন করুন' });
            return;
        }

        setIsLoading(true);
        try {
            await saveRoutineColumns(db, targetYear, columns);
            const batch = writeBatch(db);
            const currentRoutines = await getFullRoutine(db, selectedYear);
            
            currentRoutines.forEach(r => {
                const docId = `${targetYear}_${r.className}_${r.day}`;
                const docRef = doc(db, ROUTINE_COLLECTION, docId);
                batch.set(docRef, { ...r, academicYear: targetYear }, { merge: true });
            });

            await batch.commit();
            toast({ title: `রুটিন সফলভাবে ${toBengaliNumber(targetYear)} সালে কপি হয়েছে।` });
            setSelectedYear(targetYear);
            setActiveSection('class-routine');
        } catch (e) {
            console.error(e);
            toast({ variant: 'destructive', title: 'কপি করা সম্ভব হয়নি।' });
        } finally {
            setIsLoading(false);
        }
    };

    const handleMakeBlank = async () => {
        if (!db || (!isAdmin && !canManageRoutines)) return;
        
        setIsLoading(true);
        try {
            const numPeriods = columns.filter(c => c.type === 'period').length || 6;
            const batch = writeBatch(db);
            const currentRoutines = await getFullRoutine(db, selectedYear);
            const seenDocIds = new Set<string>();
            
            currentRoutines.forEach(r => {
                const docId = r.id || `${selectedYear}_${r.className}_${r.day}`;
                seenDocIds.add(docId);
                const docRef = doc(db, ROUTINE_COLLECTION, docId);
                batch.set(docRef, {
                    className: r.className,
                    day: r.day,
                    academicYear: selectedYear,
                    periods: Array(numPeriods).fill('')
                }, { merge: true });
            });

            const allClasses = ['6', '7', '8', '9', '10'];
            const allDays = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"];
            allClasses.forEach(cls => {
                allDays.forEach(day => {
                    const docId = `${selectedYear}_${cls}_${day}`;
                    if (!seenDocIds.has(docId)) {
                        const docRef = doc(db, ROUTINE_COLLECTION, docId);
                        batch.set(docRef, {
                            className: cls,
                            day,
                            academicYear: selectedYear,
                            periods: Array(numPeriods).fill('')
                        }, { merge: true });
                    }
                });
            });

            await batch.commit();
            toast({ title: `${toBengaliNumber(selectedYear)} সালের রুটিন খালি করা হয়েছে।` });
            await fetchData();
            setActiveSection('class-routine');
        } catch (e: any) {
            console.error(e);
            toast({ variant: 'destructive', title: 'রুটিন মুছতে সমস্যা হয়েছে', description: e?.message || 'আবার চেষ্টা করুন' });
        } finally {
            setIsLoading(false);
        }
    };

    const sidebarItems = useMemo(() => {
        const items = [
            { id: 'class-routine', label: 'ক্লাস রুটিন', icon: CalendarClock, color: 'text-indigo-600 bg-indigo-50' },
        ];
        if (canViewProxy || canManageProxy) {
            items.push({ id: 'proxy-management', label: 'বদলি ক্লাস (Proxy)', icon: Users, color: 'text-emerald-600 bg-emerald-50' });
        }
        if (isAdmin || canManageRoutines) {
            items.push({ id: 'allocation', label: 'শিক্ষক-বিষয় বণ্টন', icon: Briefcase, color: 'text-emerald-600 bg-emerald-50' });
        }
        items.push({ id: 'exam-routine', label: 'পরীক্ষার রুটিন', icon: List, color: 'text-blue-600 bg-blue-50' });
        
        if (isAdmin) {
            items.push({ id: 'copy-routine', label: 'রুটিন কপি করুন', icon: Copy, color: 'text-amber-600 bg-amber-50' });
            items.push({ id: 'blank-routine', label: 'ফাঁকা রুটিন', icon: FilePlus, color: 'text-slate-600 bg-slate-50' });
            items.push({ id: 'statistics', label: 'পরিসংখ্যান', icon: BarChart3, color: 'text-violet-600 bg-violet-50' });
            items.push({ id: 'upload', label: 'এক্সেল আপলোড', icon: FileUp, color: 'text-rose-600 bg-rose-50' });
        }
        return items;
    }, [isAdmin, canViewProxy, canManageProxy, canManageRoutines]);

    if (!isClient) return null;

    return (
        <div className="flex min-h-screen w-full flex-col bg-[#F6F7F9] font-kalpurush">
            
            <main className="flex-1 p-4 md:p-10 pb-20">
                <div className="max-w-[1600px] mx-auto flex flex-col md:flex-row gap-8">
                    <aside className="w-full md:w-64 shrink-0 space-y-1 no-print bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
                        <h2 className="text-2xl font-black mb-6 px-4 hidden md:block text-slate-900 tracking-tight">রুটিন শাখা</h2>
                        <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
                            {sidebarItems.map(item => (
                                <button
                                    key={item.id}
                                    onClick={() => setActiveSection(item.id)}
                                    className={cn(
                                        "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold whitespace-nowrap min-w-fit",
                                        activeSection === item.id ? "bg-white shadow-md text-primary scale-105" : "text-muted-foreground hover:bg-slate-200/50"
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
                            <div className="mb-6 border-b pb-4 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 no-print">
                                <div>
                                    <h2 className="text-2xl font-black text-slate-800">{sidebarItems.find(i => i.id === activeSection)?.label}</h2>
                                    <p className="text-xs font-bold text-muted-foreground mt-1">শিক্ষাবর্ষ: {Number(selectedYear).toLocaleString('bn-BD')}</p>
                                </div>
                                <div className="flex flex-wrap gap-2 no-print">
                                    {isEditMode ? (
                                        <>
                                            <Button variant="outline" size="sm" onClick={() => setIsEditMode(false)} className="font-bold">বাতিল</Button>
                                            <Button size="sm" onClick={handleSaveChanges} className="font-black shadow-md"><Save className="mr-2 h-4 w-4" /> সেভ করুন</Button>
                                        </>
                                    ) : (
                                        <>
                                            <Button variant="outline" size="sm" onClick={() => window.print()} className="font-bold bg-white"><Printer className="mr-2 h-4 w-4" /> প্রিন্ট</Button>
                                            {canManageRoutines && activeSection === 'class-routine' && (
                                                <Button variant="outline" size="sm" onClick={() => setIsEditMode(true)} className="font-bold bg-white"><FilePen className="mr-2 h-4 w-4" /> এডিট</Button>
                                            )}
                                        </>
                                    )}
                                </div>
                            </div>

                            {isLoading ? (
                                <div className="space-y-4"><Skeleton className="h-12 w-full" /><Skeleton className="h-64 w-full" /></div>
                            ) : (
                                <div className="animate-in fade-in duration-500">
                                    {activeSection === 'class-routine' && (
                                        <div className="space-y-6">
                                            {/* Dropdown for Combined vs Individual Class */}
                                            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gradient-to-r from-slate-50 to-indigo-50/40 p-4 rounded-2xl border border-slate-200 shadow-xs no-print">
                                                <div className="flex items-center gap-3">
                                                    <div className="p-2.5 rounded-xl bg-primary text-white shadow-sm">
                                                        <LayoutGrid className="w-5 h-5" />
                                                    </div>
                                                    <div>
                                                        <Label className="text-[11px] font-black text-slate-500 uppercase tracking-wider block">
                                                            রুটিন ভিউ / শ্রেণি নির্বাচন:
                                                        </Label>
                                                        <div className="flex items-center gap-2 mt-1">
                                                            <Select value={selectedClassFilter} onValueChange={setSelectedClassFilter}>
                                                                <SelectTrigger className="w-[250px] h-10 font-black text-sm bg-white border-2 border-primary/40 rounded-xl shadow-xs focus:ring-primary focus:border-primary">
                                                                    <SelectValue placeholder="শ্রেণি নির্বাচন করুন" />
                                                                </SelectTrigger>
                                                                <SelectContent className="font-kalpurush">
                                                                    <SelectItem value="all" className="font-black py-2 text-primary">
                                                                        📋 সকল শ্রেণি (সমন্বিত রুটিন)
                                                                    </SelectItem>
                                                                    {Object.entries(classNamesMap).map(([val, label]) => (
                                                                        <SelectItem key={val} value={val} className="font-bold py-2">
                                                                            🏫 {label} শ্রেণি
                                                                        </SelectItem>
                                                                    ))}
                                                                </SelectContent>
                                                            </Select>
                                                        </div>
                                                    </div>
                                                </div>

                                                <div className="flex items-center gap-2 text-xs font-bold text-slate-600 bg-white/95 px-4 py-2.5 rounded-xl border border-slate-200 shadow-xs">
                                                    <Info className="w-4 h-4 text-primary shrink-0" />
                                                    {selectedClassFilter === 'all' ? (
                                                        <span>সকল শ্রেণির সমন্বিত মাস্টার রুটিন প্রদর্শিত হচ্ছে।</span>
                                                    ) : (
                                                        <span>
                                                            <strong className="text-primary font-black">{classNamesMap[selectedClassFilter]} শ্রেণি</strong>-র পৃথক রুটিন। এখানে তৈরিকৃত বা পরিবর্তিত রুটিন স্বয়ংক্রিয়ভাবে সমন্বিত রুটিনে যুক্ত হয়ে যাবে।
                                                        </span>
                                                    )}
                                                </div>
                                            </div>

                                            <CombinedRoutineTable 
                                                routineData={routineData} 
                                                conflicts={displayConflicts} 
                                                isEditMode={isEditMode} 
                                                onCellChange={handleCellChange} 
                                                teacherColorMap={teacherColorMap} 
                                                isMounted={isMounted}
                                                columns={columns}
                                                onAddColumn={openAddColumn}
                                                onDeleteColumn={openDeleteColumn}
                                                onEditColumn={openEditColumn}
                                                selectedClass={selectedClassFilter}
                                                allocationsList={allocationsList}
                                            />
                                        </div>
                                    )}
                                    {activeSection === 'proxy-management' && (
                                        <ProxyManagementTab routineData={routineData} academicYear={selectedYear} />
                                    )}
                                    {activeSection === 'allocation' && (
                                        <TeacherAllocationTab staffList={allStaff} routineData={routineData} academicYear={selectedYear} onAllocationUpdated={fetchData} />
                                    )}
                                    {activeSection === 'exam-routine' && (
                                        <ExamRoutineTab />
                                    )}
                                    {activeSection === 'copy-routine' && (
                                        <CopyRoutineTab 
                                            onCopy={handleCopyRoutine} 
                                            targetYear={targetYear} 
                                            setTargetYear={setTargetYear} 
                                            availableYears={availableYears} 
                                            selectedYear={selectedYear}
                                            isProcessing={isLoading}
                                        />
                                    )}
                                    {activeSection === 'blank-routine' && (
                                        <BlankRoutineTab onReset={handleMakeBlank} selectedYear={selectedYear} isProcessing={isLoading} />
                                    )}
                                    {activeSection === 'statistics' && (
                                        <RoutineStatistics stats={stats} />
                                    )}
                                    {activeSection === 'upload' && (
                                        <BulkRoutineUploadTab onRoutineParsed={(d) => { setRoutineData(d); setIsEditMode(true); }} />
                                    )}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* Dialog: নতুন কলাম যোগ */}
                <Dialog open={addColumnDialogOpen} onOpenChange={setAddColumnDialogOpen}>
                    <DialogContent className="sm:max-w-md font-kalpurush">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <Plus className="w-5 h-5 text-emerald-600 stroke-[3]" />
                                নতুন কলাম যোগ করুন
                            </DialogTitle>
                            <DialogDescription className="text-xs font-bold text-muted-foreground">
                                {targetInsertIndex === -1 ? 'টেবিলের শুরুতে (১ম পিরিয়ডের আগে) যোগ হবে' : `‘${columns[targetInsertIndex]?.name}’ কলামের ঠিক ডানে নতুন কলাম যোগ হবে`}
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div>
                                <Label className="text-xs font-black text-slate-700">কলামের ধরণ:</Label>
                                <div className="grid grid-cols-2 gap-2 mt-1.5">
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewColType('period');
                                            const currentPeriodCount = columns.filter(c => c.type === 'period').length;
                                            const ordinals = ['১ম', '২য়', '৩য়', '৪র্থ', '৫ম', '৬ষ্ঠ', '৭ম', '৮ম', '৯ম', '১০ম', '১১তম', '১২তম'];
                                            setNewColName(ordinals[currentPeriodCount] || `${toBengaliNumber(currentPeriodCount + 1)}ম`);
                                        }}
                                        className={cn(
                                            "py-2 px-3 rounded-lg border-2 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer",
                                            newColType === 'period' ? "border-emerald-600 bg-emerald-50 text-emerald-800 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        <CalendarClock className="w-4 h-4 text-emerald-600" />
                                        পিরিয়ড (ক্লাস)
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => {
                                            setNewColType('break');
                                            setNewColName('বিরতি');
                                            setNewColTime('টিফিন');
                                        }}
                                        className={cn(
                                            "py-2 px-3 rounded-lg border-2 text-xs font-black flex items-center justify-center gap-2 transition-all cursor-pointer",
                                            newColType === 'break' ? "border-amber-600 bg-amber-50 text-amber-800 shadow-sm" : "border-slate-200 text-slate-600 hover:bg-slate-50"
                                        )}
                                    >
                                        <span className="text-base">☕</span>
                                        বিরতি (টিফিন)
                                    </button>
                                </div>
                            </div>

                            <div>
                                <Label className="text-xs font-black text-slate-700">কলামের নাম:</Label>
                                <Input
                                    value={newColName}
                                    onChange={(e) => setNewColName(e.target.value)}
                                    placeholder="যেমন: ৬ষ্ঠ, ৭ম, বিশেষ ক্লাস..."
                                    className="font-bold text-sm mt-1"
                                />
                            </div>

                            <div>
                                <Label className="text-xs font-black text-slate-700">
                                    {newColType === 'period' ? 'পিরিয়ডের সময় (ঐচ্ছিক):' : 'বিরতির শিরোনাম বা সময় (ঐচ্ছিক):'}
                                </Label>
                                <Input
                                    value={newColTime}
                                    onChange={(e) => setNewColTime(e.target.value)}
                                    placeholder="যেমন: ০৩:২০ - ০৪:০০"
                                    className="font-bold text-sm mt-1"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setAddColumnDialogOpen(false)} className="font-bold">
                                বাতিল
                            </Button>
                            <Button onClick={submitAddColumn} className="bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md">
                                <Plus className="w-4 h-4 mr-1 stroke-[3]" />
                                কলাম যোগ করুন
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* Dialog: কলামের নাম ও সময় সম্পাদনা */}
                <Dialog open={editColumnDialogOpen} onOpenChange={setEditColumnDialogOpen}>
                    <DialogContent className="sm:max-w-md font-kalpurush">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
                                <FilePen className="w-5 h-5 text-primary" />
                                কলামের নাম ও সময় সম্পাদনা
                            </DialogTitle>
                            <DialogDescription className="text-xs font-bold text-muted-foreground">
                                এই কলামের শিরোনাম ও সময় পরিবর্তন করুন
                            </DialogDescription>
                        </DialogHeader>

                        <div className="space-y-4 py-2">
                            <div>
                                <Label className="text-xs font-black text-slate-700">কলামের নাম:</Label>
                                <Input
                                    value={editColName}
                                    onChange={(e) => setEditColName(e.target.value)}
                                    placeholder="কলামের নাম"
                                    className="font-bold text-sm mt-1"
                                />
                            </div>

                            <div>
                                <Label className="text-xs font-black text-slate-700">সময়:</Label>
                                <Input
                                    value={editColTime}
                                    onChange={(e) => setEditColTime(e.target.value)}
                                    placeholder="যেমন: ১০:০০ - ১১:২০"
                                    className="font-bold text-sm mt-1"
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <Button variant="outline" onClick={() => setEditColumnDialogOpen(false)} className="font-bold">
                                বাতিল
                            </Button>
                            <Button onClick={submitEditColumn} className="bg-primary text-white font-black shadow-md">
                                আপডেট করুন
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>

                {/* AlertDialog: কলাম ডিলিট নিশ্চিতকরণ */}
                <AlertDialog open={deleteColumnDialogOpen} onOpenChange={setDeleteColumnDialogOpen}>
                    <AlertDialogContent className="font-kalpurush">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-xl font-black text-rose-600 flex items-center gap-2">
                                <Trash2 className="w-5 h-5 stroke-[2.5]" />
                                কলামটি কি মুছে ফেলতে চান?
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm font-bold text-slate-700 mt-2">
                                আপনি কি নিশ্চিত যে <span className="text-black font-black underline">"{deletingCol?.name}"</span> কলামটি মুছে ফেলতে চান?
                                {deletingCol?.type === 'period' && (
                                    <span className="block text-rose-600 font-bold mt-1">
                                        সতর্কতা: এই পিরিয়ডের অন্তর্ভুক্ত সকল শ্রেণির ক্লাস তথ্য মুছে যাবে।
                                    </span>
                                )}
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                            <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
                            <AlertDialogAction 
                                onClick={confirmDeleteColumn}
                                className="bg-rose-600 hover:bg-rose-700 text-white font-black shadow-md"
                            >
                                হ্যাঁ, মুছে ফেলুন
                            </AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </main>

            <div className="printable-area routine-print-container text-black bg-white hidden print:flex p-10 flex-col font-kalpurush">
                <header className="flex items-center gap-4 border-b-4 border-emerald-800 pb-2 mb-6">
                    {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" width={60} height={60} className="object-contain" />}
                    <div className="text-center flex-grow">
                        <h1 className="text-2xl font-black">{schoolInfo.name}</h1>
                        <p className="text-xs font-bold">{schoolInfo.address}</p>
                        <h2 className="text-lg font-black mt-2 underline">
                            {selectedClassFilter === 'all' 
                                ? `সমন্বিত ক্লাস রুটিন - ${toBengaliNumber(selectedYear)}` 
                                : `${classNamesMap[selectedClassFilter] || selectedClassFilter} শ্রেণির ক্লাস রুটিন - ${toBengaliNumber(selectedYear)}`
                            }
                        </h2>
                    </div>
                </header>
                <div className="flex-1">
                    <CombinedRoutineTable 
                        routineData={routineData} 
                        conflicts={displayConflicts} 
                        isEditMode={false} 
                        onCellChange={() => {}} 
                        teacherColorMap={teacherColorMap} 
                        isMounted={isMounted}
                        columns={columns}
                        selectedClass={selectedClassFilter}
                        allocationsList={allocationsList}
                    />
                </div>
                <footer className="mt-12 flex justify-between border-t-2 border-black pt-4">
                    <div className="w-40 border-t border-black text-center font-bold text-xs pt-1">রুটিন কমিটির স্বাক্ষর</div>
                    <div className="w-40 border-t border-black text-center font-bold text-xs pt-1">প্রধান শিক্ষকের স্বাক্ষর</div>
                </footer>
            </div>
        </div>
    );
}

function ExamRoutineTab() {
    return (
        <Card className="border-2 border-dashed rounded-3xl p-20 flex flex-col items-center justify-center text-center opacity-60">
            <LayoutGrid className="h-16 w-16 text-muted-foreground mb-4" />
            <h3 className="text-xl font-black text-slate-800">পরীক্ষার রুটিন মডিউল</h3>
            <p className="font-bold text-muted-foreground">এই ফিচারটি নির্মাণাধীন আছে। শীঘ্রই এটি ব্যবহারের জন্য উন্মুক্ত হবে।</p>
        </Card>
    );
}

function CopyRoutineTab({ onCopy, targetYear, setTargetYear, availableYears, selectedYear, isProcessing }: any) {
    return (
        <Card className="border-2 border-amber-100 bg-amber-50/20 rounded-3xl overflow-hidden shadow-lg animate-in zoom-in-95 duration-500">
            <CardHeader className="bg-amber-100/50 pb-6">
                <CardTitle className="text-xl font-black text-amber-900 flex items-center gap-2">
                    <Copy className="h-6 w-6" /> রুটিন কপি করুন
                </CardTitle>
                <CardDescription className="text-amber-800 font-bold">এক বছরের রুটিন অন্য বছরের জন্য হুবহু কপি করার সুবিধা</CardDescription>
            </CardHeader>
            <CardContent className="p-8 space-y-6">
                <div className="bg-white p-6 rounded-2xl border-2 border-amber-200 shadow-sm space-y-4">
                    <div className="space-y-2">
                        <Label className="font-black text-primary">কোন বছর থেকে কপি করবেন?</Label>
                        <div className="p-3 bg-muted/30 rounded-lg border font-black text-lg text-center">{toBengaliNumber(selectedYear)}</div>
                    </div>
                    <div className="space-y-2">
                        <Label className="font-black text-primary">কোন বছরে কপি করবেন?</Label>
                        <Select value={targetYear} onValueChange={setTargetYear}>
                            <SelectTrigger className="h-12 text-lg font-black bg-white border-2 border-amber-200"><SelectValue placeholder="বছর নির্বাচন করুন" /></SelectTrigger>
                            <SelectContent>
                                {availableYears.map((y: string) => (
                                    <SelectItem key={y} value={y} disabled={y === selectedYear}>{toBengaliNumber(y)}</SelectItem>
                                ))}
                            </SelectContent>
                        </Select>
                    </div>
                </div>
                
                <div className="p-4 bg-white/80 rounded-xl border border-dashed border-amber-300 flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0" />
                    <p className="text-xs font-bold text-amber-900 leading-relaxed">
                        সতর্কতা: কপি করার ফলে টার্গেট বছরের বর্তমান রুটিন (যদি থাকে) তা সম্পূর্ণভাবে মুছে যাবে এবং নতুন ডাটা দিয়ে প্রতিস্থাপিত হবে।
                    </p>
                </div>

                <Button onClick={onCopy} disabled={!targetYear || isProcessing} className="w-full h-14 text-lg font-black shadow-xl bg-amber-600 hover:bg-amber-700">
                    {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                    কপি নিশ্চিত করুন
                </Button>
            </CardContent>
        </Card>
    );
}

function BlankRoutineTab({ onReset, selectedYear, isProcessing }: any) {
    return (
        <Card className="border-2 border-rose-100 bg-rose-50/20 rounded-3xl overflow-hidden shadow-lg animate-in zoom-in-95 duration-500">
            <CardHeader className="bg-rose-100/50 pb-6">
                <CardTitle className="text-xl font-black text-rose-900 flex items-center gap-2">
                    <FilePlus className="h-6 w-6" /> ফাঁকা রুটিন (Reset)
                </CardTitle>
                <CardDescription className="text-rose-800 font-bold">বর্তমান বছরের রুটিন পুরোপুরি পরিষ্কার করার সুবিধা</CardDescription>
            </CardHeader>
            <CardContent className="p-6 pb-8 space-y-5 text-center">
                <div className="bg-white p-6 rounded-2xl border-2 border-rose-200 shadow-sm flex flex-col items-center gap-3">
                    <div className="p-4 bg-rose-100 rounded-full">
                        <AlertTriangle className="h-12 w-12 text-rose-600 animate-pulse" />
                    </div>
                    <h4 className="text-xl font-black text-rose-950">{toBengaliNumber(selectedYear)} সালের রুটিন মুছতে চান?</h4>
                    <p className="text-sm font-bold text-muted-foreground max-sm">
                        এটি এই বছরের সকল শ্রেণির সকল দিনের রুটিন ডাটা মুছে ফেলবে। এই কাজটি আর ফিরিয়ে আনা যাবে না।
                    </p>
                </div>

                <AlertDialog>
                    <AlertDialogTrigger asChild>
                        <Button disabled={isProcessing} variant="destructive" className="w-full h-14 text-lg font-black shadow-xl">
                            {isProcessing ? <Loader2 className="animate-spin mr-2 h-4 w-4" /> : <Trash2 className="mr-2" />}
                            রুটিন পুরোপুরি মুছুন
                        </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent className="font-kalpurush">
                        <AlertDialogHeader>
                            <AlertDialogTitle className="text-2xl font-black text-rose-700">আপনি কি নিশ্চিত?</AlertDialogTitle>
                            <AlertDialogDescription className="text-base font-bold">
                                এটি {toBengaliNumber(selectedYear)} সালের সম্পূর্ণ রুটিন ডাটা ডিলিট করে দিবে। আপনি কি রুটিনটি রিসেট করতে চান?
                            </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter className="gap-2">
                            <AlertDialogCancel className="font-bold">বাতিল</AlertDialogCancel>
                            <AlertDialogAction onClick={onReset} className="bg-rose-600 hover:bg-rose-700 font-black">হ্যাঁ, মুছুন</AlertDialogAction>
                        </AlertDialogFooter>
                    </AlertDialogContent>
                </AlertDialog>
            </CardContent>
        </Card>
    );
}

function BulkRoutineUploadTab({ onRoutineParsed }: { onRoutineParsed: (data: Record<string, Record<string, string[]>>) => void }) {
    return (
        <Card className="border-2 border-dashed border-rose-200 bg-rose-50/20 p-12 text-center rounded-3xl">
            <FileUp className="h-16 w-16 text-rose-500 mx-auto mb-4" />
            <h3 className="text-xl font-black mb-2">Excel রুটিন আপলোড</h3>
            <p className="text-sm font-bold text-muted-foreground mb-6">নির্ধারিত ফরম্যাটের এক্সেল ফাইল আপলোড করে এক ক্লিকে রুটিন আপডেট করুন।</p>
            <div className="flex justify-center gap-4">
                <Button variant="outline" className="font-bold"><Download className="mr-2 h-4 w-4" /> ফরম্যাট ডাউনলোড</Button>
                <Button className="font-black"><FileUp className="mr-2 h-4 w-4" /> ফাইল সিলেক্ট করুন</Button>
            </div>
        </Card>
    );
}

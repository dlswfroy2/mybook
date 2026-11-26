'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Checkbox } from '@/components/ui/checkbox';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { 
    SubjectClassLimit, 
    RoutineColumnConfig, 
    DEFAULT_ROUTINE_COLUMNS, 
    saveSubjectClassLimits, 
    getSubjectClassLimits 
} from '@/lib/routine-data';
import { getSubjects, subjectNameNormalization } from '@/lib/subjects';
import { CheckSquare, Save, AlertTriangle, CheckCircle2, Info, RefreshCw, Sparkles, BookOpen } from 'lucide-react';
import { cn } from '@/lib/utils';

const classNamesMap: { [key: string]: string } = {
    '6': 'ষষ্ঠ',
    '7': '৭ম',
    '8': '৮ম',
    '9': '৯ম',
    '10': '১০ম'
};

const toBengaliNumber = (num: number | string | undefined | null) => {
    if (num === undefined || num === null) return '০';
    const bnDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(num).replace(/[0-9]/g, (d) => bnDigits[Number(d)]);
};

const ALL_WEEK_DAYS = [
    { id: 'রবিবার', label: 'রবি' },
    { id: 'সোমবার', label: 'সোম' },
    { id: 'মঙ্গলবার', label: 'মঙ্গল' },
    { id: 'বুধবার', label: 'বুধ' },
    { id: 'বৃহস্পতিবার', label: 'বৃহস্পতি' },
    { id: 'শুক্রবার', label: 'শুক্র' },
    { id: 'শনিবার', label: 'শনি' },
];

interface SubjectLimitsTabProps {
    routineData: Record<string, Record<string, string[]>>;
    academicYear: string;
    columns: RoutineColumnConfig[];
    currentLimitsMap: Record<string, Record<string, SubjectClassLimit>>;
    onLimitsUpdated?: (updatedMap: Record<string, Record<string, SubjectClassLimit>>) => void;
    routineDays?: string[];
}

export default function SubjectLimitsTab({
    routineData,
    academicYear,
    columns = DEFAULT_ROUTINE_COLUMNS,
    currentLimitsMap = {},
    onLimitsUpdated,
    routineDays = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার"]
}: SubjectLimitsTabProps) {
    const db = useFirestore();
    const { toast } = useToast();

    const [selectedClass, setSelectedClass] = useState<string>('6');
    const [selectedGroup, setSelectedGroup] = useState<string>('all');
    const [limits, setLimits] = useState<Record<string, SubjectClassLimit>>({});
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(false);

    // Load limits for the selected class
    useEffect(() => {
        const classLimits = currentLimitsMap[selectedClass] || {};
        setLimits(JSON.parse(JSON.stringify(classLimits)));
    }, [selectedClass, currentLimitsMap]);

    // Subjects of the selected class
    const subjects = useMemo(() => {
        const raw = getSubjects(selectedClass, selectedGroup);
        // Deduplicate subjects by normalized name
        const seen = new Set<string>();
        const list: typeof raw = [];
        raw.forEach(s => {
            const norm = subjectNameNormalization[s.name] || s.name;
            if (!seen.has(norm)) {
                seen.add(norm);
                list.push(s);
            }
        });
        return list;
    }, [selectedClass, selectedGroup]);

    // Calculate total available periods in the routine for this class
    const totalRoutineCapacity = useMemo(() => {
        const periodCols = columns.filter(c => c.type === 'period').length || 6;
        const daysCount = routineDays.length || 5;
        return periodCols * daysCount;
    }, [columns, routineDays]);

    // Current live usage count in routineData for each subject in this class
    const routineUsageMap = useMemo(() => {
        const counts: Record<string, number> = {};
        const classData = routineData[selectedClass] || {};
        Object.values(classData).forEach(periods => {
            periods.forEach(cell => {
                if (cell) {
                    const rawSub = cell.split(' - ')[0]?.trim();
                    if (rawSub) {
                        const norm = subjectNameNormalization[rawSub] || rawSub;
                        counts[norm] = (counts[norm] || 0) + 1;
                        counts[rawSub] = (counts[rawSub] || 0) + 1;
                    }
                }
            });
        });
        return counts;
    }, [routineData, selectedClass]);

    // Sum of currently allocated classes across all subjects
    const totalAllocated = useMemo(() => {
        return subjects.reduce((sum, sub) => {
            const norm = subjectNameNormalization[sub.name] || sub.name;
            const item = limits[norm] || limits[sub.name];
            return sum + (item?.daysCount || 0);
        }, 0);
    }, [subjects, limits]);

    const remainingClasses = totalRoutineCapacity - totalAllocated;
    const isExceeded = totalAllocated > totalRoutineCapacity;

    // Method 1: Checkbox click (টিক দিয়ে সেট করা)
    const handleToggleDay = (subjectName: string, dayName: string) => {
        const norm = subjectNameNormalization[subjectName] || subjectName;
        const current = limits[norm] || limits[subjectName] || {
            subjectName,
            daysCount: 0,
            assignedDays: []
        };
        const currentDays = current.assignedDays || [];
        let nextDays: string[];
        if (currentDays.includes(dayName)) {
            nextDays = currentDays.filter(d => d !== dayName);
        } else {
            nextDays = [...currentDays, dayName];
        }

        setLimits(prev => ({
            ...prev,
            [norm]: {
                subjectName,
                daysCount: nextDays.length,
                assignedDays: nextDays
            }
        }));
    };

    // Method 2: Typing number in input (লিখে সেট করা)
    const handleNumberChange = (subjectName: string, valueStr: string) => {
        const norm = subjectNameNormalization[subjectName] || subjectName;
        const val = parseInt(valueStr, 10);
        const count = isNaN(val) ? 0 : Math.max(0, Math.min(7, val));
        
        // Auto-select the first `count` days from standard week
        const defaultWeek = ["রবিবার", "সোমবার", "মঙ্গলবার", "বুধবার", "বৃহস্পতিবার", "শনিবার", "শুক্রবার"];
        const autoDays = defaultWeek.slice(0, count);

        setLimits(prev => ({
            ...prev,
            [norm]: {
                subjectName,
                daysCount: count,
                assignedDays: autoDays
            }
        }));
    };

    // Save handler
    const handleSave = async () => {
        if (!db) {
            toast({
                title: "ডাটাবেজ সংযোগ পাওয়া যায়নি",
                description: "দয়া করে পেজটি রিলোড করে আবার চেষ্টা করুন।",
                variant: "destructive"
            });
            return;
        }

        setIsSaving(true);
        try {
            await saveSubjectClassLimits(db, academicYear, selectedClass, limits);

            const updatedMap = {
                ...currentLimitsMap,
                [selectedClass]: limits
            };

            if (onLimitsUpdated) {
                onLimitsUpdated(updatedMap);
            }

            toast({
                title: "সংরক্ষণ সফল হয়েছে!",
                description: `${classNamesMap[selectedClass]} শ্রেণির সাপ্তাহিক বিষয় সীমা সফলভাবে সেভ করা হয়েছে।`
            });
        } catch (error: any) {
            console.error("Failed to save subject limits:", error);
            toast({
                title: "সংরক্ষণে ত্রুটি হয়েছে",
                description: error.message || "দয়া করে আবার চেষ্টা করুন।",
                variant: "destructive"
            });
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-300">
            {/* Header & Class Selectors */}
            <div className="bg-gradient-to-r from-rose-50 via-white to-amber-50 p-5 rounded-2xl border-2 border-rose-200/80 shadow-xs">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                    <div>
                        <div className="flex items-center gap-2">
                            <div className="p-2 bg-rose-500 text-white rounded-xl shadow-xs">
                                <CheckSquare className="w-5 h-5" />
                            </div>
                            <h3 className="text-xl font-black text-slate-800">
                                সাপ্তাহিক বিষয় ক্লাস সীমা নির্ধারণ
                            </h3>
                        </div>
                        <p className="text-xs font-bold text-slate-600 mt-1">
                            কোন বিষয়টি সপ্তাহে কত দিন দেওয়া যাবে তা <strong>টিক দিয়ে</strong> অথবা <strong>সংখ্যা লিখে</strong> দুই পদ্ধতিতেই সেট করুন।
                        </p>
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                            <Label className="text-xs font-black text-slate-700 whitespace-nowrap">
                                শ্রেণি:
                            </Label>
                            <Select value={selectedClass} onValueChange={setSelectedClass}>
                                <SelectTrigger className="w-28 h-9 font-black text-sm border-rose-300">
                                    <SelectValue />
                                </SelectTrigger>
                                <SelectContent className="font-kalpurush">
                                    {Object.entries(classNamesMap).map(([val, label]) => (
                                        <SelectItem key={val} value={val} className="font-bold">
                                            {label} শ্রেণি
                                        </SelectItem>
                                    ))}
                                </SelectContent>
                            </Select>
                        </div>

                        {(selectedClass === '9' || selectedClass === '10') && (
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                                <Label className="text-xs font-black text-slate-700 whitespace-nowrap">
                                    গ্রুপ:
                                </Label>
                                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                                    <SelectTrigger className="w-32 h-9 font-black text-sm border-rose-300">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="font-kalpurush">
                                        <SelectItem value="all" className="font-bold">সকল বিষয়</SelectItem>
                                        <SelectItem value="science" className="font-bold">বিজ্ঞান</SelectItem>
                                        <SelectItem value="arts" className="font-bold">মানবিক</SelectItem>
                                        <SelectItem value="commerce" className="font-bold">ব্যবসায় শিক্ষা</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="h-10 px-5 font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md gap-2 rounded-xl"
                        >
                            <Save className="w-4 h-4" />
                            {isSaving ? 'সংরক্ষণ হচ্ছে...' : 'সীমা সেভ করুন'}
                        </Button>
                    </div>
                </div>

                {/* Capacity & Validation Status Bar */}
                <div className="mt-4 pt-3 border-t border-rose-200/60 grid grid-cols-1 sm:grid-cols-3 gap-3">
                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                        <span className="text-xs font-bold text-slate-600">রুটিনের মোট ক্লাস ধারণক্ষমতা:</span>
                        <Badge variant="outline" className="text-xs font-black bg-slate-100 text-slate-800">
                            {toBengaliNumber(totalRoutineCapacity)}টি
                        </Badge>
                    </div>

                    <div className="bg-white p-3 rounded-xl border border-slate-200 flex items-center justify-between shadow-2xs">
                        <span className="text-xs font-bold text-slate-600">আপনার মোট নির্ধারিত ক্লাস:</span>
                        <Badge 
                            variant="outline" 
                            className={cn(
                                "text-xs font-black",
                                isExceeded 
                                    ? "bg-rose-100 text-rose-700 border-rose-300" 
                                    : "bg-emerald-50 text-emerald-700 border-emerald-300"
                            )}
                        >
                            {toBengaliNumber(totalAllocated)}টি
                        </Badge>
                    </div>

                    <div className={cn(
                        "p-3 rounded-xl border flex items-center justify-between shadow-2xs",
                        isExceeded 
                            ? "bg-rose-50 border-rose-300 text-rose-800" 
                            : remainingClasses === 0
                                ? "bg-emerald-50 border-emerald-300 text-emerald-800"
                                : "bg-indigo-50 border-indigo-200 text-indigo-800"
                    )}>
                        <div className="flex items-center gap-1.5">
                            {isExceeded ? (
                                <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                            ) : remainingClasses === 0 ? (
                                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                            ) : (
                                <Info className="w-4 h-4 text-indigo-600 shrink-0" />
                            )}
                            <span className="text-xs font-black">
                                {isExceeded
                                    ? `সীমা বেশি: ${toBengaliNumber(Math.abs(remainingClasses))}টি অতিরিক্ত!`
                                    : remainingClasses === 0
                                        ? "সম্পূর্ণ মিলেছে (০টি বাকি)"
                                        : `বাকি আছে: ${toBengaliNumber(remainingClasses)}টি ক্লাস`}
                            </span>
                        </div>
                        {isExceeded && (
                            <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.5 rounded">
                                কমানো আবশ্যক
                            </span>
                        )}
                    </div>
                </div>

                {isExceeded && (
                    <div className="mt-3 p-2.5 bg-rose-100/90 border border-rose-300 text-rose-800 rounded-xl text-xs font-black flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                            ⚠️ সতর্কবার্তা: রুটিনের মোট ক্লাস ({toBengaliNumber(totalRoutineCapacity)}টি)-এর চেয়ে {toBengaliNumber(Math.abs(remainingClasses))}টি ক্লাস বেশি নির্ধারণ করা হয়েছে! দয়া করে কিছু বিষয়ের দিন/সংখ্যা কমিয়ে সামঞ্জস্য করুন।
                        </span>
                    </div>
                )}
            </div>

            {/* Subject Limits Table */}
            <div className="overflow-hidden border-2 border-slate-200 rounded-2xl bg-white shadow-md">
                <Table className="border-collapse">
                    <TableHeader className="bg-slate-100/80">
                        <TableRow className="h-12 border-b border-slate-300">
                            <TableHead className="w-16 text-center font-black text-slate-800 border-r border-slate-300">
                                ক্রমিক
                            </TableHead>
                            <TableHead className="w-48 font-black text-slate-800 border-r border-slate-300">
                                বিষয়ের নাম
                            </TableHead>
                            <TableHead className="font-black text-slate-800 border-r border-slate-300 text-center">
                                সপ্তাহে কোন কোন দিন দেওয়া যাবে (টিক দিয়ে সেট করুন)
                            </TableHead>
                            <TableHead className="w-36 text-center font-black text-slate-800 border-r border-slate-300">
                                সাপ্তাহিক ক্লাস (সংখ্যা লিখে)
                            </TableHead>
                            <TableHead className="w-32 text-center font-black text-slate-800">
                                বর্তমান রুটিনে
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {subjects.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={5} className="py-10 text-center font-bold text-muted-foreground">
                                    এই শ্রেণির জন্য কোনো বিষয় পাওয়া যায়নি।
                                </TableCell>
                            </TableRow>
                        ) : (
                            subjects.map((sub, idx) => {
                                const norm = subjectNameNormalization[sub.name] || sub.name;
                                const item = limits[norm] || limits[sub.name] || {
                                    subjectName: sub.name,
                                    daysCount: 0,
                                    assignedDays: []
                                };
                                const assignedDays = item.assignedDays || [];
                                const count = item.daysCount || 0;
                                const liveCount = routineUsageMap[norm] || routineUsageMap[sub.name] || 0;

                                return (
                                    <TableRow 
                                        key={sub.code || sub.name}
                                        className={cn(
                                            "hover:bg-slate-50/70 border-b border-slate-200 transition-colors",
                                            count > 0 ? "bg-white" : "bg-slate-50/30 text-slate-400"
                                        )}
                                    >
                                        <TableCell className="text-center font-black text-xs text-slate-600 border-r border-slate-200">
                                            {toBengaliNumber(idx + 1)}
                                        </TableCell>

                                        <TableCell className="font-black text-sm text-slate-900 border-r border-slate-200">
                                            <div className="flex items-center gap-1.5">
                                                <BookOpen className="w-3.5 h-3.5 text-primary shrink-0" />
                                                <span>{sub.name}</span>
                                            </div>
                                        </TableCell>

                                        {/* Method 1: Checkbox for each day */}
                                        <TableCell className="p-2 border-r border-slate-200">
                                            <div className="flex flex-wrap items-center justify-center gap-1.5">
                                                {ALL_WEEK_DAYS.map(day => {
                                                    const isChecked = assignedDays.includes(day.id);
                                                    return (
                                                        <button
                                                            key={day.id}
                                                            type="button"
                                                            onClick={() => handleToggleDay(sub.name, day.id)}
                                                            className={cn(
                                                                "h-7 px-2.5 rounded-lg text-xs font-black transition-all flex items-center gap-1 cursor-pointer border",
                                                                isChecked 
                                                                    ? "bg-rose-500 text-white border-rose-600 shadow-2xs scale-102" 
                                                                    : "bg-slate-100 hover:bg-slate-200 text-slate-600 border-slate-200"
                                                            )}
                                                            title={`${day.id} বারে ${sub.name} ক্লাস দিন`}
                                                        >
                                                            <span>{day.label}</span>
                                                            {isChecked && <span className="text-[10px]">✓</span>}
                                                        </button>
                                                    );
                                                })}
                                            </div>
                                        </TableCell>

                                        {/* Method 2: Typing number */}
                                        <TableCell className="p-2 text-center border-r border-slate-200">
                                            <div className="flex items-center justify-center gap-1.5">
                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={7}
                                                    value={count === 0 ? '' : count}
                                                    onChange={(e) => handleNumberChange(sub.name, e.target.value)}
                                                    placeholder="০"
                                                    className={cn(
                                                        "w-16 h-8 text-center font-black text-sm rounded-lg",
                                                        count > 0 ? "border-rose-400 bg-rose-50/30 text-rose-900" : "border-slate-300"
                                                    )}
                                                />
                                                <span className="text-xs font-bold text-slate-500">দিন</span>
                                            </div>
                                        </TableCell>

                                        {/* Live usage in routine */}
                                        <TableCell className="text-center font-black">
                                            <Badge 
                                                variant="outline"
                                                className={cn(
                                                    "text-xs font-black",
                                                    count > 0 && liveCount > count
                                                        ? "bg-rose-100 text-rose-700 border-rose-300"
                                                        : count > 0 && liveCount === count
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                                            : "bg-slate-100 text-slate-600"
                                                )}
                                            >
                                                {toBengaliNumber(liveCount)}/{count > 0 ? toBengaliNumber(count) : '∞'}টি
                                            </Badge>
                                        </TableCell>
                                    </TableRow>
                                );
                            })
                        )}
                    </TableBody>

                    {/* Table Footer: Total row */}
                    <tfoot className="bg-slate-100/90 font-black border-t-2 border-slate-300">
                        <TableRow className="h-12">
                            <TableCell colSpan={2} className="text-right font-black text-sm text-slate-800 pr-4 border-r border-slate-300">
                                সর্বমোট নির্ধারিত ক্লাস:
                            </TableCell>
                            <TableCell className="text-center text-xs text-slate-600 font-bold border-r border-slate-300">
                                (টিক ও সংখ্যা উভয় পদ্ধতিতেই সেট করা হয়েছে)
                            </TableCell>
                            <TableCell className="text-center font-black text-base border-r border-slate-300">
                                <span className={cn(
                                    isExceeded ? "text-rose-600" : "text-emerald-700"
                                )}>
                                    {toBengaliNumber(totalAllocated)} / {toBengaliNumber(totalRoutineCapacity)} টি
                                </span>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge 
                                    className={cn(
                                        "font-black text-xs",
                                        isExceeded 
                                            ? "bg-rose-600 text-white" 
                                            : remainingClasses === 0
                                                ? "bg-emerald-600 text-white"
                                                : "bg-indigo-600 text-white"
                                    )}
                                >
                                    {isExceeded 
                                        ? `${toBengaliNumber(Math.abs(remainingClasses))}টি বেশি` 
                                        : remainingClasses === 0 
                                            ? 'পরিপূর্ণ' 
                                            : `${toBengaliNumber(remainingClasses)}টি বাকি`}
                                </Badge>
                            </TableCell>
                        </TableRow>
                    </tfoot>
                </Table>
            </div>
        </div>
    );
}

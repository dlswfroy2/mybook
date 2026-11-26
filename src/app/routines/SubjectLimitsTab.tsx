'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useToast } from '@/hooks/use-toast';
import { useFirestore } from '@/firebase';
import { 
    SubjectClassLimit, 
    RoutineColumnConfig, 
    DEFAULT_ROUTINE_COLUMNS, 
    saveSubjectClassLimits 
} from '@/lib/routine-data';
import { getSubjects, subjectNameNormalization } from '@/lib/subjects';
import { CheckSquare, Save, AlertTriangle, CheckCircle2, Info, BookOpen, Plus, Minus, Layers, Sparkles } from 'lucide-react';
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

// 9th and 10th class parallel / coordinated pairs
export const CLASS_9_10_COORDINATED_PAIRS = [
    { 
        id: 'physics_history',
        label: 'পদার্থ / বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা', 
        shortLabel: 'পদার্থ / ইতিহাস',
        groupLabel: 'বিজ্ঞান ও মানবিক',
        subjects: ['পদার্থ', 'বাংলাদেশের ইতিহাস ও বিশ্বসভ্যতা'], 
        shortNames: ['পদার্থ', 'ইতিহাস'] 
    },
    { 
        id: 'chemistry_geography',
        label: 'রসায়ন / ভূগোল ও পরিবেশ', 
        shortLabel: 'রসায়ন / ভূগোল',
        groupLabel: 'বিজ্ঞান ও মানবিক',
        subjects: ['রসায়ন', 'ভূগোল ও পরিবেশ'], 
        shortNames: ['রসায়ন', 'ভূগোল'] 
    },
    { 
        id: 'biology_civics',
        label: 'জীব বিজ্ঞান / পৌরনীতি ও নাগরিকতা', 
        shortLabel: 'জীব / পৌরনীতি',
        groupLabel: 'বিজ্ঞান ও মানবিক',
        subjects: ['জীব বিজ্ঞান', 'পৌরনীতি ও নাগরিকতা'], 
        shortNames: ['জীব', 'পৌরনীতি'] 
    },
    { 
        id: 'bgs_gen_science',
        label: 'বাংলাদেশ ও বিশ্ব পরিচয় / সাধারণ বিজ্ঞান', 
        shortLabel: 'বা ও বি / সাধারণ বিজ্ঞান',
        groupLabel: 'বিজ্ঞান ও মানবিক/ব্যবসায়',
        subjects: ['বাংলাদেশ ও বিশ্ব পরিচয়', 'সাধারণ বিজ্ঞান'], 
        shortNames: ['বা ও বি', 'বিজ্ঞান'] 
    },
    { 
        id: 'higher_math_agri',
        label: 'উচ্চতর গণিত / কৃষি শিক্ষা', 
        shortLabel: 'উচ্চতর / কৃষি',
        groupLabel: 'বিজ্ঞান ও ঐচ্ছিক',
        subjects: ['উচ্চতর গণিত', 'কৃষি শিক্ষা'], 
        shortNames: ['উচ্চতর', 'কৃষি'] 
    },
];

const parseSubjectTeacher = (cell: string): { subject: string; teacher: string | null } => {
    if (!cell) return { subject: '', teacher: null };
    const parts = cell.split(' - ');
    if (parts.length > 1) {
        return { subject: parts[0].trim(), teacher: parts.slice(1).join(' - ').trim() };
    }
    return { subject: cell.trim(), teacher: null };
};

interface DisplaySubjectItem {
    id: string;
    displayName: string;
    subLabel?: string;
    isCoordinated?: boolean;
    groupBadge?: string;
    associatedSubjects: string[];
}

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

    // Load limits for the selected class
    useEffect(() => {
        const classLimits = currentLimitsMap[selectedClass] || {};
        setLimits(JSON.parse(JSON.stringify(classLimits)));
    }, [selectedClass, currentLimitsMap]);

    const isNineOrTen = selectedClass === '9' || selectedClass === '10';

    // Build the list of subjects / coordinated pairs for display
    const displayItems: DisplaySubjectItem[] = useMemo(() => {
        const rawSubjects = getSubjects(selectedClass, selectedGroup);

        if (!isNineOrTen) {
            // Class 6 to 8: simple 1-to-1 subjects
            const seen = new Set<string>();
            const list: DisplaySubjectItem[] = [];
            rawSubjects.forEach(s => {
                const norm = subjectNameNormalization[s.name] || s.name;
                if (!seen.has(norm)) {
                    seen.add(norm);
                    list.push({
                        id: norm,
                        displayName: s.name,
                        associatedSubjects: [s.name, norm]
                    });
                }
            });
            return list;
        }

        // For Class 9 and 10:
        if (selectedGroup === 'all') {
            // Coordinated View (বিজ্ঞান ও মানবিক সমন্বয়)
            const commonSubjects = [
                'বাংলা প্রথম',
                'বাংলা দ্বিতীয়',
                'ইংরেজি প্রথম',
                'ইংরেজি দ্বিতীয়',
                'গণিত',
                'তথ্য ও যোগাযোগ প্রযুক্তি',
                'ধর্ম ও নৈতিক শিক্ষা'
            ];

            const list: DisplaySubjectItem[] = [];

            // 1. Add common subjects first
            commonSubjects.forEach(subName => {
                const norm = subjectNameNormalization[subName] || subName;
                list.push({
                    id: norm,
                    displayName: subName,
                    associatedSubjects: [subName, norm]
                });
            });

            // 2. Add coordinated Science & Humanities pairs
            CLASS_9_10_COORDINATED_PAIRS.forEach(pair => {
                const associated: string[] = [
                    pair.label,
                    pair.shortLabel,
                    `${pair.shortNames[0]}/${pair.shortNames[1]}`,
                    `${pair.shortNames[0]} / ${pair.shortNames[1]}`,
                    ...pair.subjects,
                    ...pair.subjects.map(s => subjectNameNormalization[s] || s),
                    ...pair.shortNames
                ];
                list.push({
                    id: pair.id,
                    displayName: pair.label,
                    subLabel: `বিজ্ঞান: ${pair.subjects[0]} • মানবিক: ${pair.subjects[1]}`,
                    isCoordinated: true,
                    groupBadge: pair.groupLabel,
                    associatedSubjects: Array.from(new Set(associated))
                });
            });

            // 3. Add any commerce-only or other subjects not in common or coordinated pairs
            const commerceExtra = [
                'হিসাব বিজ্ঞান',
                'ফিন্যান্স ও ব্যাংকিং',
                'ব্যবসায় উদ্যোগ'
            ];
            commerceExtra.forEach(cName => {
                const norm = subjectNameNormalization[cName] || cName;
                list.push({
                    id: norm,
                    displayName: cName,
                    subLabel: 'ব্যবসায় শিক্ষা বিভাগ',
                    associatedSubjects: [cName, norm]
                });
            });

            return list;
        }

        // If user specifically filtered by science, arts, or commerce:
        const seen = new Set<string>();
        const list: DisplaySubjectItem[] = [];
        rawSubjects.forEach(s => {
            const norm = subjectNameNormalization[s.name] || s.name;
            if (!seen.has(norm)) {
                seen.add(norm);
                // Check if it belongs to a coordinated pair
                const pair = CLASS_9_10_COORDINATED_PAIRS.find(p => 
                    p.subjects.includes(s.name) || 
                    p.subjects.some(ps => (subjectNameNormalization[ps] || ps) === norm)
                );
                
                const associated = [s.name, norm];
                if (pair) {
                    associated.push(
                        pair.label, 
                        pair.shortLabel, 
                        `${pair.shortNames[0]}/${pair.shortNames[1]}`,
                        ...pair.subjects
                    );
                }

                list.push({
                    id: norm,
                    displayName: s.name,
                    subLabel: pair ? `সমন্বিত বিষয়: ${pair.shortLabel}` : undefined,
                    isCoordinated: !!pair,
                    groupBadge: pair ? 'সমন্বিত বিষয়' : undefined,
                    associatedSubjects: Array.from(new Set(associated))
                });
            }
        });
        return list;
    }, [selectedClass, selectedGroup, isNineOrTen]);

    // Calculate total available periods in the routine for this class
    const totalRoutineCapacity = useMemo(() => {
        const periodCols = columns.filter(c => c.type === 'period').length || 6;
        const daysCount = routineDays.length || 5;
        return periodCols * daysCount;
    }, [columns, routineDays]);

    // Helper to get limit count for an item
    const getItemCount = useCallback((item: DisplaySubjectItem): number => {
        for (const sub of item.associatedSubjects) {
            const found = limits[sub] || limits[subjectNameNormalization[sub] || sub];
            if (found && typeof found.daysCount === 'number') {
                return found.daysCount;
            }
        }
        return 0;
    }, [limits]);

    // Live usage count in routineData for each display item
    const liveUsageMap = useMemo(() => {
        const counts: Record<string, number> = {};
        const classData = routineData[selectedClass] || {};

        displayItems.forEach(item => {
            let usedCount = 0;
            const matchSet = new Set(item.associatedSubjects.map(s => (subjectNameNormalization[s] || s).toLowerCase()));

            Object.values(classData).forEach(periods => {
                periods.forEach(cell => {
                    if (!cell) return;
                    const { subject: cellSub } = parseSubjectTeacher(cell);
                    if (!cellSub) return;
                    const normCell = (subjectNameNormalization[cellSub] || cellSub).toLowerCase();

                    // Check exact normalized match
                    if (matchSet.has(normCell)) {
                        usedCount++;
                        return;
                    }

                    // Check if cell is combined e.g. "পদার্থ/ইতিহাস"
                    const parts = cellSub.split('/').map(p => p.trim());
                    if (parts.length > 1) {
                        const hasMatch = parts.some(p => matchSet.has((subjectNameNormalization[p] || p).toLowerCase()));
                        if (hasMatch) {
                            usedCount++;
                            return;
                        }
                    }

                    // Check partial match for coordinated pairs
                    if (item.isCoordinated) {
                        const pair = CLASS_9_10_COORDINATED_PAIRS.find(p => p.id === item.id);
                        if (pair) {
                            if (cellSub.includes(pair.shortNames[0]) || cellSub.includes(pair.shortNames[1])) {
                                usedCount++;
                            }
                        }
                    }
                });
            });

            counts[item.id] = usedCount;
        });

        return counts;
    }, [routineData, selectedClass, displayItems]);

    // Sum of currently allocated classes across all display items (1 slot = 1 count)
    const totalAllocated = useMemo(() => {
        return displayItems.reduce((sum, item) => sum + getItemCount(item), 0);
    }, [displayItems, getItemCount]);

    const remainingClasses = totalRoutineCapacity - totalAllocated;
    const isExceeded = totalAllocated > totalRoutineCapacity;

    // Number change handler: updates all coordinated subject keys together
    const handleNumberChange = (item: DisplaySubjectItem, valueStr: string) => {
        const val = parseInt(valueStr, 10);
        const count = isNaN(val) ? 0 : Math.max(0, Math.min(20, val));

        setLimits(prev => {
            const next = { ...prev };
            item.associatedSubjects.forEach(sub => {
                const norm = subjectNameNormalization[sub] || sub;
                next[norm] = { subjectName: sub, daysCount: count };
                next[sub] = { subjectName: sub, daysCount: count };
            });
            return next;
        });
    };

    // Quick increment / decrement helper
    const handleAdjustCount = (item: DisplaySubjectItem, delta: number) => {
        const current = getItemCount(item);
        const newCount = Math.max(0, Math.min(20, current + delta));

        setLimits(prev => {
            const next = { ...prev };
            item.associatedSubjects.forEach(sub => {
                const norm = subjectNameNormalization[sub] || sub;
                next[norm] = { subjectName: sub, daysCount: newCount };
                next[sub] = { subjectName: sub, daysCount: newCount };
            });
            return next;
        });
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
            <div className="bg-gradient-to-r from-rose-50 via-white to-indigo-50/40 p-5 rounded-2xl border-2 border-rose-200/80 shadow-xs">
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
                            প্রতিটি বিষয়ের জন্য সপ্তাহে সর্বোচ্চ কতটি ক্লাস বরাদ্দ করা যাবে তা <strong>সংখ্যা লিখে</strong> নির্ধারণ করুন।
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

                        {isNineOrTen && (
                            <div className="flex items-center gap-2 bg-white px-3 py-1.5 rounded-xl border border-slate-200 shadow-2xs">
                                <Label className="text-xs font-black text-slate-700 whitespace-nowrap">
                                    গ্রুপ ভিউ:
                                </Label>
                                <Select value={selectedGroup} onValueChange={setSelectedGroup}>
                                    <SelectTrigger className="w-44 h-9 font-black text-sm border-indigo-300">
                                        <SelectValue />
                                    </SelectTrigger>
                                    <SelectContent className="font-kalpurush">
                                        <SelectItem value="all" className="font-bold">
                                            🔗 সকল বিষয় (সমন্বিত)
                                        </SelectItem>
                                        <SelectItem value="science" className="font-bold">বিজ্ঞান বিভাগ</SelectItem>
                                        <SelectItem value="arts" className="font-bold">মানবিক বিভাগ</SelectItem>
                                        <SelectItem value="commerce" className="font-bold">ব্যবসায় শিক্ষা</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        )}

                        <Button
                            onClick={handleSave}
                            disabled={isSaving}
                            className="h-10 px-5 font-black bg-rose-600 hover:bg-rose-700 text-white shadow-md gap-2 rounded-xl cursor-pointer"
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

                {isNineOrTen && (
                    <div className="mt-3 p-2.5 bg-indigo-50/80 border border-indigo-200 text-indigo-900 rounded-xl text-xs font-bold flex items-center gap-2">
                        <Sparkles className="w-4 h-4 text-indigo-600 shrink-0" />
                        <span>
                            💡 <strong>বিজ্ঞান ও মানবিক সমন্বয়:</strong> ৯ম ও ১০ম শ্রেণিতে বিজ্ঞান ও মানবিক শাখার যেসব বিষয় একই পিরিয়ডে সমান্তরালে চলে (যেমন: পদার্থ/ইতিহাস, রসায়ন/ভূগোল, জীব/পৌরনীতি) সেগুলোকে ১টি পিরিয়ড হিসেবে সমন্বয় করা হয়েছে, যাতে মোট ক্লাসের সীমা সঠিকভাবে মিলে যায়।
                        </span>
                    </div>
                )}

                {isExceeded && (
                    <div className="mt-3 p-2.5 bg-rose-100/90 border border-rose-300 text-rose-800 rounded-xl text-xs font-black flex items-center gap-2">
                        <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                        <span>
                            ⚠️ সতর্কবার্তা: রুটিনের মোট ক্লাস ({toBengaliNumber(totalRoutineCapacity)}টি)-এর চেয়ে {toBengaliNumber(Math.abs(remainingClasses))}টি ক্লাস বেশি নির্ধারণ করা হয়েছে! দয়া করে কিছু বিষয়ের ক্লাস সংখ্যা কমিয়ে সামঞ্জস্য করুন।
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
                            <TableHead className="font-black text-slate-800 border-r border-slate-300">
                                বিষয়ের নাম
                            </TableHead>
                            <TableHead className="w-60 text-center font-black text-slate-800 border-r border-slate-300">
                                সাপ্তাহিক ক্লাস (সংখ্যা লিখে)
                            </TableHead>
                            <TableHead className="w-40 text-center font-black text-slate-800">
                                বর্তমান রুটিনে
                            </TableHead>
                        </TableRow>
                    </TableHeader>
                    <TableBody>
                        {displayItems.length === 0 ? (
                            <TableRow>
                                <TableCell colSpan={4} className="py-10 text-center font-bold text-muted-foreground">
                                    এই শ্রেণির জন্য কোনো বিষয় পাওয়া যায়নি।
                                </TableCell>
                            </TableRow>
                        ) : (
                            displayItems.map((item, idx) => {
                                const count = getItemCount(item);
                                const liveCount = liveUsageMap[item.id] || 0;

                                return (
                                    <TableRow 
                                        key={item.id}
                                        className={cn(
                                            "hover:bg-slate-50/70 border-b border-slate-200 transition-colors",
                                            item.isCoordinated ? "bg-indigo-50/20" : "",
                                            count > 0 ? "bg-white" : "bg-slate-50/30 text-slate-400"
                                        )}
                                    >
                                        <TableCell className="text-center font-black text-xs text-slate-600 border-r border-slate-200">
                                            {toBengaliNumber(idx + 1)}
                                        </TableCell>

                                        <TableCell className="font-black text-slate-900 border-r border-slate-200 py-3">
                                            <div className="flex flex-col gap-1">
                                                <div className="flex items-center gap-2 flex-wrap">
                                                    <BookOpen className="w-4 h-4 text-primary shrink-0" />
                                                    <span className="text-base font-black text-slate-800">
                                                        {item.displayName}
                                                    </span>
                                                    {item.groupBadge && (
                                                        <Badge variant="outline" className="text-[10px] font-black bg-indigo-50 text-indigo-700 border-indigo-200">
                                                            🔗 {item.groupBadge}
                                                        </Badge>
                                                    )}
                                                </div>
                                                {item.subLabel && (
                                                    <span className="text-xs font-bold text-slate-500 pl-6">
                                                        {item.subLabel}
                                                    </span>
                                                )}
                                            </div>
                                        </TableCell>

                                        {/* Weekly Class Count Input */}
                                        <TableCell className="p-2.5 text-center border-r border-slate-200">
                                            <div className="flex items-center justify-center gap-2">
                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleAdjustCount(item, -1)}
                                                    disabled={count <= 0}
                                                    className="h-8 w-8 rounded-lg border-slate-300 hover:bg-rose-50 hover:text-rose-600 cursor-pointer"
                                                >
                                                    <Minus className="w-3.5 h-3.5" />
                                                </Button>

                                                <Input
                                                    type="number"
                                                    min={0}
                                                    max={20}
                                                    value={count === 0 ? '' : count}
                                                    onChange={(e) => handleNumberChange(item, e.target.value)}
                                                    placeholder="০"
                                                    className={cn(
                                                        "w-20 h-9 text-center font-black text-base rounded-lg shadow-2xs",
                                                        count > 0 ? "border-2 border-rose-400 bg-rose-50/40 text-rose-900" : "border-slate-300"
                                                    )}
                                                />

                                                <Button
                                                    type="button"
                                                    variant="outline"
                                                    size="icon"
                                                    onClick={() => handleAdjustCount(item, 1)}
                                                    className="h-8 w-8 rounded-lg border-slate-300 hover:bg-emerald-50 hover:text-emerald-600 cursor-pointer"
                                                >
                                                    <Plus className="w-3.5 h-3.5" />
                                                </Button>

                                                <span className="text-xs font-bold text-slate-600 whitespace-nowrap ml-1">
                                                    টি ক্লাস
                                                </span>
                                            </div>
                                        </TableCell>

                                        {/* Live usage in routine */}
                                        <TableCell className="text-center font-black">
                                            <Badge 
                                                variant="outline"
                                                className={cn(
                                                    "text-xs font-black px-2.5 py-1",
                                                    count > 0 && liveCount > count
                                                        ? "bg-rose-100 text-rose-700 border-rose-300"
                                                        : count > 0 && liveCount === count
                                                            ? "bg-emerald-50 text-emerald-700 border-emerald-300"
                                                            : "bg-slate-100 text-slate-600"
                                                )}
                                            >
                                                {toBengaliNumber(liveCount)}/{count > 0 ? toBengaliNumber(count) : '০'}টি
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
                            <TableCell colSpan={2} className="text-right font-black text-sm text-slate-800 pr-6 border-r border-slate-300">
                                সর্বমোট নির্ধারিত সাপ্তাহিক ক্লাস:
                            </TableCell>
                            <TableCell className="text-center font-black text-base border-r border-slate-300">
                                <span className={cn(
                                    isExceeded ? "text-rose-600 font-black" : "text-emerald-700 font-black"
                                )}>
                                    {toBengaliNumber(totalAllocated)} / {toBengaliNumber(totalRoutineCapacity)} টি
                                </span>
                            </TableCell>
                            <TableCell className="text-center">
                                <Badge 
                                    className={cn(
                                        "font-black text-xs px-2.5 py-1",
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

"use client";

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { 
  Calendar as CalendarIcon, 
  ChevronLeft, 
  ChevronRight, 
  Printer, 
  Plus, 
  Trash2, 
  Search, 
  Clock, 
  Sparkles, 
  School, 
  BookOpen, 
  Award, 
  Users, 
  BellRing, 
  CheckCircle2, 
  AlertCircle,
  FileText,
  CreditCard,
  MessageSquare,
  RefreshCw,
  GraduationCap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from '@/hooks/use-toast';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useFirestore, useUser } from '@/firebase';
import { 
  getHolidays, 
  addHoliday, 
  deleteHoliday, 
  getDefaultHolidaysForYear, 
  getSecondarySchoolExamSchedule,
  Holiday, 
  SecondaryExam 
} from '@/lib/holiday-data';
import { cn } from '@/lib/utils';

const BANGLA_MONTHS = [
  'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন',
  'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'
];

const WEEKDAYS = ['শনি', 'রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র'];

const toBengaliNumber = (n: number | string | undefined | null): string => {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (d) => bengaliDigits[parseInt(d)]);
};

export default function AcademicCalendarPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { schoolInfo } = useSchoolInfo();
  const { selectedYear, setSelectedYear, availableYears } = useAcademicYear();

  const currentYearNum = parseInt(selectedYear, 10) || 2026;

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [syncing, setSyncing] = useState<boolean>(false);

  // Add event modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(`${currentYearNum}-01-01`);
  const [newEndDate, setNewEndDate] = useState('');
  const [savingEvent, setSavingEvent] = useState(false);

  // Fetch holidays with clean deduplication (strictly secondary school holidays, no exams mixed)
  const loadHolidays = async () => {
    setLoading(true);
    try {
      const data = await getHolidays(db, currentYearNum);
      setHolidays(data);
    } catch (e) {
      console.error(e);
      const fallbackList = getDefaultHolidaysForYear(currentYearNum).map((d, i) => ({
        id: `default-${currentYearNum}-${i}`,
        date: d.date,
        description: d.description,
        type: 'govt' as const
      }));
      setHolidays(fallbackList);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [db, selectedYear, currentYearNum]);

  // Combined holidays map by date YYYY-MM-DD
  const holidaysMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    holidays.forEach(h => {
      if (h.date && h.date.startsWith(`${currentYearNum}`)) {
        map.set(h.date, h);
      }
    });
    return map;
  }, [holidays, currentYearNum]);

  // Strictly unique sorted holidays for current academic year
  const uniqueYearHolidays = useMemo(() => {
    return Array.from(holidaysMap.values()).sort((a, b) => a.date.localeCompare(b.date));
  }, [holidaysMap]);

  // Secondary School Official Exam Schedule
  const examSchedule = useMemo(() => {
    return getSecondarySchoolExamSchedule(currentYearNum);
  }, [currentYearNum]);

  // Build a Set of all exam dates for fast lookup (for green coloring in calendar)
  const examDatesSet = useMemo(() => {
    const set = new Set<string>();
    examSchedule.forEach(exam => {
      const cur = new Date(`${exam.startDate}T12:00:00Z`);
      const end = new Date(`${exam.endDate}T12:00:00Z`);
      while (cur <= end) {
        set.add(cur.toISOString().split('T')[0]);
        cur.setUTCDate(cur.getUTCDate() + 1);
      }
    });
    return set;
  }, [examSchedule]);

  // Handle Add Event
  const handleAddEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: 'অনুগ্রহ করে ছুটির নাম ও তারিখ দিন।' });
      return;
    }

    setSavingEvent(true);
    try {
      const datesToAdd: string[] = [];
      if (newEndDate && newEndDate >= newEventDate) {
        let cur = new Date(newEventDate);
        const end = new Date(newEndDate);
        while (cur <= end) {
          datesToAdd.push(cur.toISOString().split('T')[0]);
          cur.setDate(cur.getDate() + 1);
        }
      } else {
        datesToAdd.push(newEventDate);
      }

      if (db) {
        for (const d of datesToAdd) {
          await addHoliday(db, { date: d, description: newEventTitle, type: 'govt' });
        }
        await loadHolidays();
      } else {
        const newItems: Holiday[] = datesToAdd.map((d, i) => ({
          id: `local-${Date.now()}-${i}`,
          date: d,
          description: newEventTitle,
          type: 'govt'
        }));
        setHolidays(prev => {
          const map = new Map<string, Holiday>();
          prev.forEach(h => map.set(h.date, h));
          newItems.forEach(h => map.set(h.date, h));
          return Array.from(map.values()).sort((a, b) => a.date.localeCompare(b.date));
        });
      }

      toast({ title: 'সফল', description: 'নতুন ছুটি সফলভাবে ক্যালেন্ডারে যোগ হয়েছে।' });
      setIsAddOpen(false);
      setNewEventTitle('');
      setNewEndDate('');
    } catch (err) {
      toast({ variant: 'destructive', title: 'ব্যর্থ হয়েছে', description: 'ছুটি যোগ করা সম্ভব হয়নি।' });
    } finally {
      setSavingEvent(false);
    }
  };

  // Re-sync with Secondary School Gazette
  const handleSyncGovernmentGazette = async () => {
    setSyncing(true);
    try {
      const standardList = getDefaultHolidaysForYear(currentYearNum);
      const updatedList: Holiday[] = standardList.map((h, idx) => ({
        id: `govt-gazette-${currentYearNum}-${idx}`,
        date: h.date,
        description: h.description,
        type: 'govt'
      }));
      setHolidays(updatedList);
      toast({ 
        title: 'মাধ্যমিক ছুটির তালিকা আপডেট সম্পন্ন', 
        description: `শিক্ষাবর্ষ ${toBengaliNumber(currentYearNum)} এর শিক্ষা মন্ত্রণালয় ও মাউশি অনুমোদিত মাধ্যমিক স্তরের ছুটির তালিকা সমন্বয় করা হয়েছে।` 
      });
    } catch (err) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: 'আপডেট করা সম্ভব হয়নি।' });
    } finally {
      setSyncing(false);
    }
  };

  // Handle Delete Event
  const handleDeleteEvent = async (id: string, date: string) => {
    if (!confirm('আপনি কি এই ছুটি ক্যালেন্ডার থেকে মুছে ফেলতে চান?')) return;
    try {
      if (db && !id.startsWith('default-') && !id.startsWith('govt-') && !id.startsWith('local-')) {
        await deleteHoliday(db, id);
      }
      setHolidays(prev => prev.filter(h => h.date !== date));
      toast({ title: 'মুছে ফেলা হয়েছে', description: 'ছুটি ক্যালেন্ডার থেকে অপসারিত হয়েছে।' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: 'মুছে ফেলা সম্ভব হয়নি।' });
    }
  };

  // Consolidated Secondary School Holidays List (Groups vacation ranges into single clean items)
  const consolidatedHolidayList = useMemo(() => {
    const list: Array<{
      id: string;
      description: string;
      startDate: string;
      endDate: string;
      totalDays: number;
      dates: string[];
    }> = [];

    let currentGroup: {
      description: string;
      startDate: string;
      endDate: string;
      totalDays: number;
      dates: string[];
      firstId: string;
    } | null = null;

    for (const h of uniqueYearHolidays) {
      if (!currentGroup) {
        currentGroup = {
          description: h.description,
          startDate: h.date,
          endDate: h.date,
          totalDays: 1,
          dates: [h.date],
          firstId: h.id
        };
      } else {
        const prevEnd = new Date(`${currentGroup.endDate}T12:00:00Z`);
        const curDate = new Date(`${h.date}T12:00:00Z`);
        const diffDays = Math.round((curDate.getTime() - prevEnd.getTime()) / (1000 * 60 * 60 * 24));

        if (currentGroup.description === h.description && diffDays === 1) {
          currentGroup.endDate = h.date;
          currentGroup.totalDays += 1;
          currentGroup.dates.push(h.date);
        } else {
          list.push({
            id: currentGroup.firstId,
            description: currentGroup.description,
            startDate: currentGroup.startDate,
            endDate: currentGroup.endDate,
            totalDays: currentGroup.totalDays,
            dates: currentGroup.dates
          });
          currentGroup = {
            description: h.description,
            startDate: h.date,
            endDate: h.date,
            totalDays: 1,
            dates: [h.date],
            firstId: h.id
          };
        }
      }
    }

    if (currentGroup) {
      const finalGroup = currentGroup;
      list.push({
        id: finalGroup.firstId,
        description: finalGroup.description,
        startDate: finalGroup.startDate,
        endDate: finalGroup.endDate,
        totalDays: finalGroup.totalDays,
        dates: finalGroup.dates
      });
    }

    return list;
  }, [uniqueYearHolidays]);

  // Filtered holiday list for search
  const filteredHolidays = useMemo(() => {
    if (!searchQuery.trim()) return consolidatedHolidayList;
    const q = searchQuery.toLowerCase();
    return consolidatedHolidayList.filter(item => 
      item.description.toLowerCase().includes(q) || item.startDate.includes(q) || item.endDate.includes(q)
    );
  }, [consolidatedHolidayList, searchQuery]);

  // Real, Accurate Statistics for Secondary Schools (মাউশি মাধ্যমিক বিদ্যালয় স্ট্যান্ডার্ড)
  const stats = useMemo(() => {
    let workingDays = 0;
    let weekendCount = 0;
    let govtHolidaysCount = 0;

    const holidayDatesSet = new Set<string>();
    uniqueYearHolidays.forEach(h => holidayDatesSet.add(h.date));

    for (let month = 0; month < 12; month++) {
      const daysInMonth = new Date(currentYearNum, month + 1, 0).getDate();
      for (let day = 1; day <= daysInMonth; day++) {
        const d = new Date(currentYearNum, month, day);
        const dayOfWeek = d.getDay(); // 5 = Friday, 6 = Saturday
        const isWeekend = dayOfWeek === 5 || dayOfWeek === 6;
        const dateStr = `${currentYearNum}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
        
        if (isWeekend) {
          weekendCount++;
        } else if (holidayDatesSet.has(dateStr)) {
          govtHolidaysCount++;
        } else {
          workingDays++;
        }
      }
    }

    return {
      totalHolidays: holidayDatesSet.size, // Real secondary school holidays (~76 days)
      examCount: examSchedule.length,      // Distinct examination sessions
      workingDays,                         // Real secondary school working days (~213 days)
      weekendDays: weekendCount            // 104 weekend days
    };
  }, [uniqueYearHolidays, examSchedule, currentYearNum]);

  // Calendar matrix generator for a specific month (0 to 11)
  const generateMonthDays = (monthIdx: number) => {
    const firstDay = new Date(currentYearNum, monthIdx, 1);
    const lastDay = new Date(currentYearNum, monthIdx + 1, 0);
    const daysInMonth = lastDay.getDate();

    const jsDay = firstDay.getDay();
    const bdStartOffset = (jsDay + 1) % 7;

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      holiday?: Holiday;
      isExamDay?: boolean;
    }> = [];

    // Empty slots before month start
    for (let i = 0; i < bdStartOffset; i++) {
      days.push({
        dateStr: '',
        dayNum: 0,
        isCurrentMonth: false,
        isWeekend: false
      });
    }

    // Days in current month
    for (let d = 1; d <= daysInMonth; d++) {
      const monthStr = String(monthIdx + 1).padStart(2, '0');
      const dayStr = String(d).padStart(2, '0');
      const dateStr = `${currentYearNum}-${monthStr}-${dayStr}`;
      
      const dayOfWeek = (bdStartOffset + d - 1) % 7;
      const isWeekend = dayOfWeek === 6 || dayOfWeek === 0; // Friday & Saturday

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isWeekend,
        holiday: holidaysMap.get(dateStr),
        isExamDay: examDatesSet.has(dateStr)
      });
    }

    return days;
  };

  return (
    <div className="space-y-6 pb-12 font-kalpurush">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-primary via-indigo-700 to-primary text-white px-3 py-1.5 rounded-xl shadow-md border border-white/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 backdrop-blur-3xl transform skew-x-12 pointer-events-none" />
        <div className="flex flex-wrap items-center justify-between gap-2 relative z-10">
          {/* Real Statistics Badges */}
          <div className="flex flex-wrap items-center gap-1.5">
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
              <span className="text-[10px] font-bold text-white/70">কর্মদিবস:</span>
              <span className="text-[11px] font-black text-white">{toBengaliNumber(stats.workingDays)} দিন</span>
            </div>
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
              <span className="text-[10px] font-bold text-white/70">অনুমোদিত ছুটি:</span>
              <span className="text-[11px] font-black text-yellow-300">{toBengaliNumber(stats.totalHolidays)} দিন</span>
            </div>
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
              <span className="text-[10px] font-bold text-white/70">পরীক্ষা পর্ব:</span>
              <span className="text-[11px] font-black text-cyan-300">{toBengaliNumber(stats.examCount)} টি</span>
            </div>
            <div className="flex items-center gap-1 bg-white/10 backdrop-blur-md px-2 py-0.5 rounded-md border border-white/10">
              <span className="text-[10px] font-bold text-white/70">সাপ্তাহিক ছুটি:</span>
              <span className="text-[11px] font-black text-emerald-300">শুক্র ও শনিবার</span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Year Selector */}
            <div className="flex items-center gap-1 bg-black/30 border border-white/20 rounded-md px-2 py-0.5 text-white h-7">
              <span className="text-[11px] font-black">শিক্ষাবর্ষ:</span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-5 w-[72px] bg-transparent border-0 text-white font-black text-[11px] focus:ring-0 p-0 shadow-none cursor-pointer">
                  <SelectValue>{toBengaliNumber(selectedYear)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="font-kalpurush font-bold bg-white text-slate-900">
                  {availableYears.map(yr => (
                    <SelectItem key={yr} value={yr}>
                      {toBengaliNumber(yr)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Auto Secondary School Gazette Sync */}
            <Button
              onClick={handleSyncGovernmentGazette}
              disabled={syncing}
              variant="outline"
              size="sm"
              className="font-black text-[11px] gap-1 shadow-sm h-7 px-2.5 bg-white/10 hover:bg-white/20 text-white border-white/30"
              title="মাউশি মাধ্যমিক ছুটির তালিকা অনুযায়ী স্বয়ংক্রিয় ছুটি সিঙ্ক করুন"
            >
              <RefreshCw className={cn("w-3 h-3", syncing && "animate-spin")} />
              মাউশি গেজেট সিঙ্ক
            </Button>

            {/* Print Button */}
            <Button
              onClick={() => window.print()}
              variant="secondary"
              size="sm"
              className="font-black text-[11px] gap-1 shadow-sm h-7 px-2.5 bg-white text-primary hover:bg-slate-100"
            >
              <Printer className="w-3 h-3" />
              ক্যালেন্ডার প্রিন্ট
            </Button>

            {/* Add Event Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button size="sm" className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black text-[11px] gap-1 shadow-sm h-7 px-2.5">
                  <Plus className="w-3.5 h-3.5" />
                  নতুন ছুটি যোগ করুন
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md font-kalpurush">
                <DialogHeader>
                  <DialogTitle className="text-lg font-black text-primary flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-yellow-500" />
                    নতুন ছুটি যোগ করুন
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="font-bold text-xs">ছুটির বিবরণ/নাম *</Label>
                    <Input
                      placeholder="যেমন: স্থানীয় বা বিশেষ ছুটি"
                      value={newEventTitle}
                      onChange={(e) => setNewEventTitle(e.target.value)}
                      className="font-bold"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1.5">
                      <Label className="font-bold text-xs">শুরুর তারিখ *</Label>
                      <Input
                        type="date"
                        value={newEventDate}
                        onChange={(e) => setNewEventDate(e.target.value)}
                        className="font-bold"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label className="font-bold text-xs">শেষের তারিখ (ঐচ্ছিক)</Label>
                      <Input
                        type="date"
                        value={newEndDate}
                        onChange={(e) => setNewEndDate(e.target.value)}
                        className="font-bold"
                      />
                    </div>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddEvent}
                    disabled={savingEvent}
                    className="w-full bg-primary font-black"
                  >
                    {savingEvent ? "সংরক্ষণ হচ্ছে..." : "সংরক্ষণ করুন"}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>
      </div>

      {/* Main Tabs */}
      <Tabs defaultValue="grid" className="space-y-6">
        <TabsList className="bg-white dark:bg-card border-2 border-slate-200 dark:border-border p-1.5 rounded-2xl shadow-sm gap-2">
          <TabsTrigger value="grid" className="font-black text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl">
            <CalendarIcon className="w-4 h-4 mr-1.5" />
            ১২ মাসের ক্যালেন্ডার
          </TabsTrigger>
          <TabsTrigger value="holidays" className="font-black text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl">
            <FileText className="w-4 h-4 mr-1.5" />
            মাধ্যমিক ছুটির তালিকা ({toBengaliNumber(consolidatedHolidayList.length)})
          </TabsTrigger>
          <TabsTrigger value="exams" className="font-black text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl">
            <GraduationCap className="w-4 h-4 mr-1.5 text-yellow-500" />
            পরীক্ষা ও মূল্যায়ন সময়সূচি
          </TabsTrigger>
          <TabsTrigger value="reminders" className="font-black text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl">
            <BellRing className="w-4 h-4 mr-1.5" />
            প্রতিষ্ঠান ও বেতন রিমাইন্ডার
          </TabsTrigger>
        </TabsList>

        {/* 12-Month Grid View */}
        <TabsContent value="grid" className="space-y-6">
          {/* Month Quick Tabs */}
          <div className="flex items-center gap-1.5 overflow-x-auto pb-2 scrollbar-none">
            {BANGLA_MONTHS.map((monthName, idx) => (
              <Button
                key={monthName}
                onClick={() => setSelectedMonth(idx)}
                variant={selectedMonth === idx ? "default" : "outline"}
                size="sm"
                className={cn(
                  "font-black text-xs rounded-xl shrink-0 transition-all",
                  selectedMonth === idx ? "shadow-md scale-105" : "border-slate-200 dark:border-border"
                )}
              >
                {monthName}
              </Button>
            ))}
          </div>

          {/* Single Focused Month Big Card */}
          <Card className="border-2 border-slate-200 dark:border-border shadow-md rounded-[24px] overflow-hidden">
            <CardHeader className="bg-slate-50 dark:bg-card/50 border-b p-4 flex flex-row items-center justify-between">
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setSelectedMonth((prev) => (prev > 0 ? prev - 1 : 11))}
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <CardTitle className="text-lg md:text-xl font-black text-slate-800 dark:text-slate-100">
                  {BANGLA_MONTHS[selectedMonth]} {toBengaliNumber(currentYearNum)}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-8 w-8 rounded-full"
                  onClick={() => setSelectedMonth((prev) => (prev < 11 ? prev + 1 : 0))}
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>

              <div className="flex items-center gap-4 text-xs font-bold text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> মাধ্যমিক ছুটি
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-amber-500 inline-block" /> সাপ্তাহিক ছুটি (শুক্র-শনি)
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-emerald-500 inline-block" /> পরীক্ষার দিন
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2 mb-2 text-center font-black text-xs text-muted-foreground">
                {WEEKDAYS.map((wd, i) => (
                  <div key={wd} className={cn("py-2 rounded-xl", (i === 0 || i === 6) ? "text-rose-500 bg-rose-50 dark:bg-rose-950/30 font-black" : "")}>
                    {wd}
                  </div>
                ))}
              </div>

              {/* Day Cells */}
              <div className="grid grid-cols-7 gap-2">
                {generateMonthDays(selectedMonth).map((d, idx) => {
                  if (!d.isCurrentMonth) {
                    return <div key={`empty-${idx}`} className="h-20 md:h-24 rounded-2xl bg-slate-50/50 dark:bg-slate-900/20 border border-dashed border-slate-200/50" />;
                  }

                  const hasHoliday = !!d.holiday;
                  const isExam = !!d.isExamDay && !hasHoliday;

                  return (
                    <div
                      key={d.dateStr}
                      className={cn(
                        "h-20 md:h-24 p-2 rounded-2xl border transition-all flex flex-col justify-between relative group",
                        d.isWeekend ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40" : "bg-white dark:bg-card border-slate-200 dark:border-border",
                        hasHoliday && "bg-amber-50/70 dark:bg-amber-950/30 border-amber-300",
                        isExam && "bg-emerald-50/70 dark:bg-emerald-950/30 border-emerald-300"
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black",
                          d.isWeekend ? "text-rose-600 bg-rose-100 dark:bg-rose-900/50" : "text-slate-800 dark:text-slate-200",
                          hasHoliday && "bg-rose-600 text-white",
                          isExam && "bg-emerald-600 text-white"
                        )}>
                          {toBengaliNumber(d.dayNum)}
                        </span>
                        {d.isWeekend && !hasHoliday && !isExam && (
                          <span className="text-[10px] text-rose-500 font-bold hidden sm:inline">সাপ্তাহিক ছুটি</span>
                        )}
                        {isExam && (
                          <span className="text-[10px] text-emerald-600 font-bold hidden sm:inline">পরীক্ষা</span>
                        )}
                      </div>

                      {hasHoliday && (
                        <div className="mt-1">
                          <p className="text-[10px] leading-tight font-black line-clamp-2 p-1 rounded-lg bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100">
                            {d.holiday!.description}
                          </p>
                        </div>
                      )}
                      {isExam && (
                        <div className="mt-1">
                          <p className="text-[10px] leading-tight font-black line-clamp-2 p-1 rounded-lg bg-emerald-100 text-emerald-900 dark:bg-emerald-900 dark:text-emerald-100">
                            পরীক্ষা চলছে
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>

          {/* 12-Month Mini Matrix Overview */}
          <div className="space-y-4">
            <h3 className="text-lg font-black text-slate-800 dark:text-slate-100 flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-primary" />
              ১২ মাসের ক্যালেন্ডার এক নজরে ({toBengaliNumber(currentYearNum)})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {BANGLA_MONTHS.map((mName, mIdx) => (
                <Card
                  key={mName}
                  onClick={() => setSelectedMonth(mIdx)}
                  className={cn(
                    "cursor-pointer hover:shadow-md transition-all border-2 rounded-2xl overflow-hidden",
                    selectedMonth === mIdx ? "border-primary ring-2 ring-primary/20" : "border-slate-200 dark:border-border"
                  )}
                >
                  <div className="p-3 bg-slate-50 dark:bg-card/50 border-b flex justify-between items-center">
                    <span className="font-black text-sm text-slate-800 dark:text-slate-200">{mName}</span>
                    <Badge variant="secondary" className="text-[10px] font-bold">
                      {toBengaliNumber(generateMonthDays(mIdx).filter(x => x.holiday).length)} ছুটি
                    </Badge>
                  </div>
                  <div className="p-2.5">
                    <div className="grid grid-cols-7 gap-1 text-center text-[9px] font-black text-muted-foreground mb-1">
                      {WEEKDAYS.map(w => <span key={w}>{w[0]}</span>)}
                    </div>
                    <div className="grid grid-cols-7 gap-1 text-center text-[10px]">
                      {generateMonthDays(mIdx).map((cell, cIdx) => (
                        <div
                          key={`mini-${mIdx}-${cIdx}`}
                          className={cn(
                            "h-5 rounded flex items-center justify-center font-bold text-[9px]",
                            !cell.isCurrentMonth && "opacity-0",
                            cell.isWeekend && "text-rose-500 font-bold",
                            cell.isExamDay && !cell.holiday && "bg-emerald-500 text-white font-black",
                            cell.holiday && "bg-rose-500 text-white font-black"
                          )}
                        >
                          {cell.dayNum ? toBengaliNumber(cell.dayNum) : ''}
                        </div>
                      ))}
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          </div>
        </TabsContent>

        {/* Secondary Holidays List (Strictly Secondary Holidays - No Exams) */}
        <TabsContent value="holidays" className="space-y-4">
          <Card className="border-2 border-slate-200 dark:border-border rounded-[24px]">
            <CardHeader className="p-4 md:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div>
                <CardTitle className="text-lg font-black text-slate-900 dark:text-slate-100 flex items-center gap-2">
                  <FileText className="w-5 h-5 text-primary" />
                  মাধ্যমিক ও নিম্ন মাধ্যমিক বিদ্যালয়ের বাৎসরিক সরকারি ছুটির তালিকা
                </CardTitle>
                <CardDescription className="text-xs font-bold text-muted-foreground mt-0.5">
                  শিক্ষা মন্ত্রণালয় ও মাউশি অনুমোদিত মোট {toBengaliNumber(stats.totalHolidays)} দিনের পূর্ণাঙ্গ তালিকা (কোনো পরীক্ষা এতে অন্তর্ভুক্ত নয়)
                </CardDescription>
              </div>

              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="ছুটির নাম বা তারিখ খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 font-bold text-xs"
                />
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              {filteredHolidays.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground font-bold">
                  কোনো ছুটি পাওয়া যায়নি।
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-border">
                  {filteredHolidays.map((evt, idx) => {
                    const isRange = evt.totalDays > 1;

                    return (
                      <div key={`cons-${evt.startDate}-${idx}`} className="py-4 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-card/50 px-3 rounded-2xl transition-colors">
                        <div className="flex items-center gap-3.5">
                          <div className="w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950 dark:text-rose-200 shadow-sm">
                            <span className="text-sm font-black leading-none">{toBengaliNumber(evt.totalDays)}</span>
                            <span className="text-[9px] font-bold mt-0.5">দিন</span>
                          </div>
                          <div>
                            <p className="font-black text-sm text-slate-800 dark:text-slate-100">
                              {evt.description}
                            </p>
                            <div className="flex flex-wrap items-center gap-2 mt-1">
                              <Badge variant="outline" className="text-[10px] font-black text-rose-600 border-rose-200">
                                সরকারি / মাধ্যমিক অবকাশ
                              </Badge>
                              <span className="text-xs text-muted-foreground font-bold">
                                {isRange ? (
                                  `${toBengaliNumber(evt.startDate)} হতে ${toBengaliNumber(evt.endDate)} (মোট ${toBengaliNumber(evt.totalDays)} দিন)`
                                ) : (
                                  toBengaliNumber(evt.startDate)
                                )}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEvent(evt.id, evt.startDate)}
                          className="h-8 w-8 text-rose-500 hover:bg-rose-50 hover:text-rose-600 rounded-lg shrink-0"
                          title="মুছে ফেলুন"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>
                      </div>
                    );
                  })}
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Secondary Examination Schedule (Separated completely from Holidays) */}
        <TabsContent value="exams" className="space-y-4">
          <Card className="border-2 border-slate-200 dark:border-border rounded-[24px]">
            <CardHeader className="p-4 md:p-6 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-950/20 dark:to-indigo-950/20 border-b">
              <div className="flex items-center gap-3">
                <div className="p-2.5 bg-blue-600 text-white rounded-xl shadow-md">
                  <GraduationCap className="w-6 h-6" />
                </div>
                <div>
                  <CardTitle className="text-lg font-black text-blue-900 dark:text-blue-100">
                    মাধ্যমিক বিদ্যালয়ের একাডেমিক পরীক্ষা ও মূল্যায়ন সময়সূচি ({toBengaliNumber(currentYearNum)})
                  </CardTitle>
                  <CardDescription className="text-xs font-bold text-blue-700 dark:text-blue-300 mt-0.5">
                    পরীক্ষার দিনগুলো স্কুল কর্মদিবসের অন্তর্ভুক্ত (কোনোভাবেই ছুটির অংশ নয়)
                  </CardDescription>
                </div>
              </div>
            </CardHeader>
            <CardContent className="p-6 space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {examSchedule.map((exam, idx) => (
                  <div key={exam.id} className="p-5 border-2 border-blue-100 dark:border-blue-900/40 rounded-2xl bg-white dark:bg-card shadow-sm hover:border-blue-300 transition-all space-y-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <Badge className="bg-blue-600 text-white text-[10px] font-black mb-1">পর্ব {toBengaliNumber(idx + 1)}</Badge>
                        <h4 className="font-black text-base text-slate-900 dark:text-slate-100 leading-tight">
                          {exam.title}
                        </h4>
                      </div>
                      <Badge variant="outline" className="border-blue-300 text-blue-700 dark:text-blue-300 font-bold text-xs shrink-0">
                        {toBengaliNumber(exam.totalDays)} কর্মদিবস
                      </Badge>
                    </div>

                    <div className="bg-blue-50/60 dark:bg-blue-950/30 p-3 rounded-xl border border-blue-100 dark:border-blue-900/30 space-y-1.5 text-xs">
                      <div className="flex justify-between font-bold">
                        <span className="text-muted-foreground">পরীক্ষার সময়কাল:</span>
                        <span className="text-blue-900 dark:text-blue-200 font-black">{toBengaliNumber(exam.startDate)} হতে {toBengaliNumber(exam.endDate)}</span>
                      </div>
                      <div className="flex justify-between font-bold">
                        <span className="text-muted-foreground">শ্রেণিসমূহ:</span>
                        <span className="text-slate-800 dark:text-slate-200 font-bold">{exam.classes}</span>
                      </div>
                      {exam.resultDate && (
                        <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-300 pt-1 border-t border-blue-100 dark:border-blue-900/40">
                          <span>ফলাফল প্রকাশের তারিখ:</span>
                          <span className="font-black">{toBengaliNumber(exam.resultDate)}</span>
                        </div>
                      )}
                    </div>

                    {exam.notes && (
                      <p className="text-[11px] text-muted-foreground italic font-medium">
                        * {exam.notes}
                      </p>
                    )}
                  </div>
                ))}
              </div>

              <div className="p-4 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/40 rounded-2xl flex items-center gap-3 text-xs text-amber-900 dark:text-amber-200 font-bold">
                <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                <span>
                  মাধ্যমিক বিদ্যালয়ের নীতিমালা অনুযায়ী মূল্যায়ন ও পরীক্ষার দিনগুলো সাধারণ কর্মদিবসের মধ্যে সম্পন্ন হয়। শিক্ষক ও পরীক্ষার্থীরা উপস্থিত থেকে পরীক্ষা সম্পন্ন করবেন।
                </span>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Institution & Reminders Tab */}
        <TabsContent value="reminders" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* Fee Collection & Reminders Card */}
            <Card className="border-2 border-slate-200 dark:border-border rounded-[24px] overflow-hidden shadow-sm">
              <CardHeader className="bg-emerald-50 dark:bg-emerald-950/20 border-b p-5">
                <CardTitle className="text-lg font-black text-emerald-900 dark:text-emerald-200 flex items-center gap-2">
                  <CreditCard className="w-5 h-5 text-emerald-600" />
                  মাসিক ফি ও বেতন রিমাইন্ডার সেন্টার
                </CardTitle>
                <CardDescription className="text-xs font-bold text-emerald-700 dark:text-emerald-300">
                  শিক্ষার্থীদের চলতি মাসের টিউশন ফি বকেয়া রিমাইন্ডার ও রিপোর্ট
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="bg-slate-50 dark:bg-card/50 p-4 rounded-2xl border space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>চলতি মাস ({BANGLA_MONTHS[new Date().getMonth()]}) ফি প্রদান পরিস্থিতি:</span>
                    <Badge className="bg-emerald-600 text-white font-black">চালু আছে</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    অভিভাবকদের কাছে স্বয়ংক্রিয় বকেয়া রিমাইন্ডার এসএমএস ও নোটিফিকেশন পাঠাতে নিচের বোতামটি ব্যবহার করুন।
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <Link href="/fee-due-report" className="flex-1">
                    <Button variant="outline" className="w-full font-black text-xs gap-1.5 h-10 border-2 rounded-xl">
                      <FileText className="w-4 h-4 text-primary" />
                      বকেয়া ফি রিপোর্ট দেখুন
                    </Button>
                  </Link>
                  <Link href="/messaging" className="flex-1">
                    <Button className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 h-10 rounded-xl">
                      <MessageSquare className="w-4 h-4" />
                      রিমাইন্ডার এসএমএস পাঠান
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>

            {/* Routine & Class Schedule Card */}
            <Card className="border-2 border-slate-200 dark:border-border rounded-[24px] overflow-hidden shadow-sm">
              <CardHeader className="bg-violet-50 dark:bg-violet-950/20 border-b p-5">
                <CardTitle className="text-lg font-black text-violet-900 dark:text-violet-200 flex items-center gap-2">
                  <Clock className="w-5 h-5 text-violet-600" />
                  ক্লাস রুটিন ও একাডেমি শিডিউল
                </CardTitle>
                <CardDescription className="text-xs font-bold text-violet-700 dark:text-violet-300">
                  প্রতিষ্ঠান ও শ্রেণির দৈনিক পিরিয়ড ও শিক্ষক রুটিন
                </CardDescription>
              </CardHeader>
              <CardContent className="p-6 space-y-4">
                <div className="bg-slate-50 dark:bg-card/50 p-4 rounded-2xl border space-y-2">
                  <div className="flex justify-between items-center text-xs font-bold">
                    <span>রুটিন শাখা স্ট্যাটাস:</span>
                    <Badge variant="outline" className="text-violet-700 border-violet-300 font-black">রুটিন সক্রিয়</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    প্রতিটি শ্রেণির বিষয়ভিত্তিক ক্লাস রুটিন, রুম নম্বর এবং দায়িত্বপ্রাপ্ত শিক্ষক তালিকা তৈরি ও প্রিন্ট করুন।
                  </p>
                </div>

                <div className="flex flex-col sm:flex-row gap-2.5 pt-2">
                  <Link href="/routines" className="flex-1">
                    <Button className="w-full bg-violet-600 hover:bg-violet-700 text-white font-black text-xs gap-1.5 h-10 rounded-xl">
                      <Clock className="w-4 h-4" />
                      ক্লাস রুটিন খুলুন
                    </Button>
                  </Link>
                  <Link href="/digital-attendance" className="flex-1">
                    <Button variant="outline" className="w-full font-black text-xs gap-1.5 h-10 border-2 rounded-xl">
                      <Users className="w-4 h-4 text-violet-600" />
                      ডিজিটাল হাজিরা
                    </Button>
                  </Link>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* PRINT-ONLY SECTION (A4 Printable Secondary School Academic & Holiday Calendar) */}
      <div className="print-only font-kalpurush p-6 bg-white text-black min-h-screen">
        {/* School Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-4">
          <h1 className="text-2xl font-black">{schoolInfo?.name || 'টপ গ্রেড একাডেমি'}</h1>
          <p className="text-xs font-bold mt-0.5">{schoolInfo?.address || 'বাংলাদেশ'}</p>
          <div className="inline-block bg-black text-white px-4 py-1 rounded-full text-xs font-black mt-2">
            মাধ্যমিক ও নিম্ন মাধ্যমিক বিদ্যালয় বাৎসরিক ছুটির তালিকা ও একাডেমিক ক্যালেন্ডার - {toBengaliNumber(currentYearNum)}
          </div>
          <p className="text-[11px] font-bold text-slate-700 mt-1">
            (শিক্ষা মন্ত্রণালয় ও মাধ্যমিক ও উচ্চশিক্ষা অধিদপ্তর - মাউশি অনুমোদিত মোট ৭৬ দিন ছুটি)
          </p>
        </div>

        {/* Holiday Table */}
        <div className="mb-6">
          <h3 className="font-black text-sm mb-2 border-b border-black pb-1">১. বাৎসরিক সরকারি ও সাধারণ ছুটির তালিকা (৭৬ দিন)</h3>
          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-black">
                <th className="border border-black p-1.5 text-center w-12">ক্রমিক</th>
                <th className="border border-black p-1.5 text-left">ছুটির তারিখ / সময়সীমা</th>
                <th className="border border-black p-1.5 text-left">ছুটির বিবরণ</th>
                <th className="border border-black p-1.5 text-center w-20">মোট দিন</th>
              </tr>
            </thead>
            <tbody>
              {consolidatedHolidayList.map((h, idx) => (
                <tr key={`print-hol-${idx}`} className="border-b border-black">
                  <td className="border border-black p-1.5 text-center font-bold">{toBengaliNumber(idx + 1)}</td>
                  <td className="border border-black p-1.5 font-bold">
                    {h.totalDays > 1 ? `${toBengaliNumber(h.startDate)} হতে ${toBengaliNumber(h.endDate)}` : toBengaliNumber(h.startDate)}
                  </td>
                  <td className="border border-black p-1.5 font-bold">{h.description}</td>
                  <td className="border border-black p-1.5 text-center font-bold">{toBengaliNumber(h.totalDays)} দিন</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Exam Schedule Table */}
        <div className="mb-6">
          <h3 className="font-black text-sm mb-2 border-b border-black pb-1">২. মাধ্যমিক স্তরের পরীক্ষা ও মূল্যায়ন সময়সূচি (স্কুল কর্মদিবসের অন্তর্ভুক্ত)</h3>
          <table className="w-full border-collapse border border-black text-xs">
            <thead>
              <tr className="bg-slate-100 border-b border-black">
                <th className="border border-black p-1.5 text-center w-12">ক্রমিক</th>
                <th className="border border-black p-1.5 text-left">পরীক্ষার নাম</th>
                <th className="border border-black p-1.5 text-left">সময়কাল</th>
                <th className="border border-black p-1.5 text-center w-32">শ্রেণি</th>
                <th className="border border-black p-1.5 text-center w-28">ফলাফল প্রকাশ</th>
              </tr>
            </thead>
            <tbody>
              {examSchedule.map((exam, idx) => (
                <tr key={`print-exam-${exam.id}`} className="border-b border-black">
                  <td className="border border-black p-1.5 text-center font-bold">{toBengaliNumber(idx + 1)}</td>
                  <td className="border border-black p-1.5 font-bold">{exam.title}</td>
                  <td className="border border-black p-1.5 font-bold">{toBengaliNumber(exam.startDate)} হতে {toBengaliNumber(exam.endDate)}</td>
                  <td className="border border-black p-1.5 text-center font-bold">{exam.classes}</td>
                  <td className="border border-black p-1.5 text-center font-bold">{exam.resultDate ? toBengaliNumber(exam.resultDate) : '-'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Summary Stats in Print */}
        <div className="mt-4 p-2.5 border border-black text-xs flex justify-between font-bold">
          <span>মোট বার্ষিক কর্মদিবস: {toBengaliNumber(stats.workingDays)} দিন</span>
          <span>অনুমোদিত সরকারি ছুটি: {toBengaliNumber(stats.totalHolidays)} দিন</span>
          <span>সাপ্তাহিক ছুটি: শুক্রবার ও শনিবার (১০৪ দিন)</span>
        </div>

        {/* Footer Signatures */}
        <div className="flex justify-between items-end mt-12 pt-6 px-8">
          <div className="text-center">
            <div className="w-40 border-t border-black mb-1" />
            <p className="text-xs font-bold">একাডেমিক ইনচার্জ</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-t border-black mb-1" />
            <p className="text-xs font-bold">প্রধান শিক্ষকের স্বাক্ষর ও সিল</p>
          </div>
        </div>
      </div>
    </div>
  );
}

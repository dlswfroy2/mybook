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
  MessageSquare
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
import { getHolidays, addHoliday, deleteHoliday, Holiday } from '@/lib/holiday-data';
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

const DEFAULT_ACADEMIC_EVENTS: Array<{ date: string; description: string; type: 'exam' | 'govt' | 'event' }> = [
  { date: '2026-01-01', description: 'নতুন শিক্ষাবর্ষ শুরু ও পাঠ্যপুস্তক উৎসব', type: 'event' },
  { date: '2026-01-15', description: 'অভিভাবক পরিচিতি ও সমন্বয় সভা', type: 'event' },
  { date: '2026-02-21', description: 'শহিদ দিবস ও আন্তর্জাতিক মাতৃভাষা দিবস', type: 'govt' },
  { date: '2026-03-26', description: 'স্বাধীনতা ও জাতীয় দিবস', type: 'govt' },
  { date: '2026-04-14', description: 'বাংলা নববর্ষ (পহেলা বৈশাখ)', type: 'govt' },
  { date: '2026-04-20', description: '১ম সাময়িক মূল্যায়ন পরীক্ষা শুরু', type: 'exam' },
  { date: '2026-04-30', description: '১ম সাময়িক পরীক্ষা সমাপ্তি', type: 'exam' },
  { date: '2026-05-01', description: 'মে দিবস ও বুদ্ধ পূর্ণিমা', type: 'govt' },
  { date: '2026-07-05', description: 'অর্ধ-বার্ষিক পরীক্ষা শুরু', type: 'exam' },
  { date: '2026-07-20', description: 'অর্ধ-বার্ষিক পরীক্ষা সমাপ্তি ও ফলাফল প্রকাশ', type: 'exam' },
  { date: '2026-08-15', description: 'বার্ষিক ক্রীড়া ও সাংস্কৃতিক প্রতিযোগিতা', type: 'event' },
  { date: '2026-10-18', description: 'শ্রী শ্রী দুর্গাপূজা অবকাশ', type: 'govt' },
  { date: '2026-11-20', description: 'বার্ষিক মূল্যায়ন পরীক্ষা ২০২৬ শুরু', type: 'exam' },
  { date: '2026-12-05', description: 'বার্ষিক মূল্যায়ন পরীক্ষা সমাপ্তি', type: 'exam' },
  { date: '2026-12-16', description: 'মহান বিজয় দিবস', type: 'govt' },
  { date: '2026-12-25', description: 'বড় দিন (যিশু খ্রিস্টের জন্মদিন)', type: 'govt' },
  { date: '2026-12-30', description: 'বার্ষিক পরীক্ষার ফলাফল প্রকাশ ও পুরস্কার বিতরণ', type: 'event' }
];

export default function AcademicCalendarPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { schoolInfo } = useSchoolInfo();
  const { selectedYear, setSelectedYear, availableYears } = useAcademicYear();

  const currentYearNum = parseInt(selectedYear, 10) || 2026;

  const [holidays, setHolidays] = useState<Holiday[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [selectedMonth, setSelectedMonth] = useState<number>(0);
  const [filterType, setFilterType] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Add event modal states
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newEventTitle, setNewEventTitle] = useState('');
  const [newEventDate, setNewEventDate] = useState(`${currentYearNum}-01-01`);
  const [newEndDate, setNewEndDate] = useState('');
  const [newEventType, setNewEventType] = useState<'govt' | 'exam' | 'event'>('govt');
  const [savingEvent, setSavingEvent] = useState(false);

  // Fetch holidays from Firestore
  const loadHolidays = async () => {
    setLoading(true);
    try {
      if (db) {
        const data = await getHolidays(db);
        if (data && data.length > 0) {
          setHolidays(data);
        } else {
          // If Firestore is empty, initialize with default list
          setHolidays(
            DEFAULT_ACADEMIC_EVENTS.map((e, idx) => ({
              id: `default-${idx}`,
              date: e.date,
              description: e.description
            }))
          );
        }
      } else {
        setHolidays(
          DEFAULT_ACADEMIC_EVENTS.map((e, idx) => ({
            id: `default-${idx}`,
            date: e.date,
            description: e.description
          }))
        );
      }
    } catch (e) {
      console.error(e);
      setHolidays(
        DEFAULT_ACADEMIC_EVENTS.map((e, idx) => ({
          id: `default-${idx}`,
          date: e.date,
          description: e.description
        }))
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadHolidays();
  }, [db, selectedYear]);

  // Combined holidays map by date YYYY-MM-DD
  const holidaysMap = useMemo(() => {
    const map = new Map<string, Holiday>();
    holidays.forEach(h => {
      map.set(h.date, h);
    });
    return map;
  }, [holidays]);

  // Handle Add Event
  const handleAddEvent = async () => {
    if (!newEventTitle.trim() || !newEventDate) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: 'অনুগ্রহ করে ইভেন্টের নাম ও তারিখ দিন।' });
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
          await addHoliday(db, { date: d, description: newEventTitle });
        }
        await loadHolidays();
      } else {
        const newItems: Holiday[] = datesToAdd.map((d, i) => ({
          id: `local-${Date.now()}-${i}`,
          date: d,
          description: newEventTitle
        }));
        setHolidays(prev => [...prev, ...newItems]);
      }

      toast({ title: 'সফল', description: 'নতুন ইভেন্ট/ছুটি সফলভাবে ক্যালেন্ডারে যোগ হয়েছে।' });
      setIsAddOpen(false);
      setNewEventTitle('');
      setNewEndDate('');
    } catch (err) {
      toast({ variant: 'destructive', title: 'ব্যর্থ হয়েছে', description: 'ইভেন্ট যোগ করা সম্ভব হয়নি।' });
    } finally {
      setSavingEvent(false);
    }
  };

  // Handle Delete Event
  const handleDeleteEvent = async (id: string, date: string) => {
    if (!confirm('আপনি কি এই ইভেন্ট/ছুটি ক্যালেন্ডার থেকে মুছে ফেলতে চান?')) return;
    try {
      if (db && !id.startsWith('default-') && !id.startsWith('local-')) {
        await deleteHoliday(db, id);
      }
      setHolidays(prev => prev.filter(h => h.id !== id));
      toast({ title: 'মুছে ফেলা হয়েছে', description: 'ইভেন্ট ক্যালেন্ডার থেকে অপসারিত হয়েছে।' });
    } catch (e) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: 'মুছে ফেলা সম্ভব হয়নি।' });
    }
  };

  // Filtered event list
  const filteredEvents = useMemo(() => {
    return holidays
      .filter(h => {
        if (!h.date.startsWith(`${currentYearNum}`)) return false;
        if (searchQuery.trim()) {
          const q = searchQuery.toLowerCase();
          return h.description.toLowerCase().includes(q) || h.date.includes(q);
        }
        if (filterType === 'exam') {
          return h.description.includes('পরীক্ষা') || h.description.includes('মূল্যায়ন');
        }
        if (filterType === 'govt') {
          return !h.description.includes('পরীক্ষা') && (h.description.includes('দিবস') || h.description.includes('পূজা') || h.description.includes('ঈদ') || h.description.includes('অবকাশ'));
        }
        return true;
      })
      .sort((a, b) => a.date.localeCompare(b.date));
  }, [holidays, currentYearNum, searchQuery, filterType]);

  // Statistics
  const stats = useMemo(() => {
    const yearHolidays = holidays.filter(h => h.date.startsWith(`${currentYearNum}`));
    const examEvents = yearHolidays.filter(h => h.description.includes('পরীক্ষা') || h.description.includes('মূল্যায়ন'));
    const govtHolidays = yearHolidays.filter(h => !h.description.includes('পরীক্ষা'));
    
    // Total days in year minus weekends & holidays
    const totalDays = 365;
    const estimatedWorkingDays = Math.max(0, 365 - (52 * 2) - govtHolidays.length);

    return {
      totalHolidays: govtHolidays.length,
      examCount: examEvents.length,
      workingDays: estimatedWorkingDays
    };
  }, [holidays, currentYearNum]);

  // Calendar matrix generator for a specific month (0 to 11)
  const generateMonthDays = (monthIdx: number) => {
    const firstDay = new Date(currentYearNum, monthIdx, 1);
    const lastDay = new Date(currentYearNum, monthIdx + 1, 0);
    const daysInMonth = lastDay.getDate();

    // JS getDay(): 0 is Sunday, 1 is Monday... 6 is Saturday.
    // In BD school week starting Saturday:
    // Sat=0, Sun=1, Mon=2, Tue=3, Wed=4, Thu=5, Fri=6
    const jsDay = firstDay.getDay();
    const bdStartOffset = (jsDay + 1) % 7;

    const days: Array<{
      dateStr: string;
      dayNum: number;
      isCurrentMonth: boolean;
      isWeekend: boolean;
      holiday?: Holiday;
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
      const isWeekend = dayOfWeek === 6; // Friday is weekend (and Sat is 0)

      days.push({
        dateStr,
        dayNum: d,
        isCurrentMonth: true,
        isWeekend,
        holiday: holidaysMap.get(dateStr)
      });
    }

    return days;
  };

  return (
    <div className="space-y-6 pb-12 font-kalpurush">
      {/* Top Banner & Title */}
      <div className="bg-gradient-to-r from-primary via-indigo-700 to-primary text-white p-6 md:p-8 rounded-[28px] shadow-xl border border-white/20 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-white/5 backdrop-blur-3xl transform skew-x-12 pointer-events-none" />
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 bg-white/15 px-3 py-1 rounded-full text-xs font-bold mb-2 backdrop-blur-md">
              <School className="w-3.5 h-3.5 text-yellow-300" />
              <span>প্রতিষ্ঠান একাডেমি ও ইভেন্ট প্রশাসন</span>
            </div>
            <h1 className="text-2xl md:text-3xl font-black drop-shadow-md flex items-center gap-2.5">
              <CalendarIcon className="w-8 h-8 text-yellow-400" />
              বার্ষিক একাডেমি ক্যালেন্ডার ও ইভেন্ট ডায়েরি
            </h1>
            <p className="text-white/80 text-xs md:text-sm mt-1 max-w-xl font-medium">
              {schoolInfo?.name || 'টপ গ্রেড একাডেমি'} - শিক্ষাবর্ষ {toBengaliNumber(currentYearNum)} এর সরকারি ছুটি, পরীক্ষা ও ইভেন্ট ক্যালেন্ডার
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Year Selector */}
            <div className="flex items-center gap-1.5 bg-black/30 border border-white/20 rounded-xl px-3 py-1.5 text-white">
              <span className="text-xs font-black">বছর:</span>
              <Select value={selectedYear} onValueChange={setSelectedYear}>
                <SelectTrigger className="h-7 w-[90px] bg-transparent border-0 text-white font-black text-xs focus:ring-0 p-0 shadow-none">
                  <SelectValue>{toBengaliNumber(selectedYear)}</SelectValue>
                </SelectTrigger>
                <SelectContent className="font-kalpurush font-bold">
                  {availableYears.map(yr => (
                    <SelectItem key={yr} value={yr}>
                      {toBengaliNumber(yr)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Print Button */}
            <Button
              onClick={() => window.print()}
              variant="secondary"
              className="font-black text-xs gap-1.5 shadow-lg h-9 bg-white text-primary hover:bg-slate-100"
            >
              <Printer className="w-4 h-4" />
              ক্যালেন্ডার প্রিন্ট
            </Button>

            {/* Add Event Dialog */}
            <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
              <DialogTrigger asChild>
                <Button className="bg-yellow-400 hover:bg-yellow-500 text-slate-900 font-black text-xs gap-1.5 shadow-lg h-9">
                  <Plus className="w-4 h-4" />
                  নতুন ইভেন্ট / ছুটি
                </Button>
              </DialogTrigger>
              <DialogContent className="max-w-md font-kalpurush">
                <DialogHeader>
                  <DialogTitle className="text-lg font-black text-primary flex items-center gap-2">
                    <CalendarIcon className="w-5 h-5 text-yellow-500" />
                    নতুন একাডেমি ইভেন্ট বা ছুটি যোগ করুন
                  </DialogTitle>
                </DialogHeader>
                <div className="space-y-4 py-2">
                  <div className="space-y-1.5">
                    <Label className="font-bold text-xs">ইভেন্ট বা ছুটির নাম *</Label>
                    <Input
                      placeholder="যেমন: ১ম সাময়িক পরীক্ষা / স্বাধীনতা দিবস"
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

                  <div className="space-y-1.5">
                    <Label className="font-bold text-xs">ইভেন্টের ধরণ</Label>
                    <Select value={newEventType} onValueChange={(v: any) => setNewEventType(v)}>
                      <SelectTrigger className="font-bold">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="font-kalpurush">
                        <SelectItem value="govt">সরকারি বা জাতীয় ছুটি</SelectItem>
                        <SelectItem value="exam">পরীক্ষা বা একাডেমি মূল্যায়ন</SelectItem>
                        <SelectItem value="event">স্কুল ইভেন্ট / ক্রীড়া / সমাবেশ</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
                <DialogFooter>
                  <Button
                    onClick={handleAddEvent}
                    disabled={savingEvent}
                    className="w-full bg-primary font-black"
                  >
                    {savingEvent ? 'সংরক্ষণ হচ্ছে...' : 'সংরক্ষণ করুন'}
                  </Button>
                </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Quick Stats Badges */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6 pt-5 border-t border-white/15">
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            <p className="text-[11px] font-bold text-white/80">আনুমানিক কর্মদিবস</p>
            <p className="text-xl md:text-2xl font-black text-white mt-0.5">{toBengaliNumber(stats.workingDays)} দিন</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            <p className="text-[11px] font-bold text-white/80">মোট ছুটি</p>
            <p className="text-xl md:text-2xl font-black text-yellow-300 mt-0.5">{toBengaliNumber(stats.totalHolidays)} দিন</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            <p className="text-[11px] font-bold text-white/80">পরীক্ষা ও মূল্যায়ন</p>
            <p className="text-xl md:text-2xl font-black text-cyan-300 mt-0.5">{toBengaliNumber(stats.examCount)} টি</p>
          </div>
          <div className="bg-white/10 backdrop-blur-md p-3 rounded-2xl border border-white/10">
            <p className="text-[11px] font-bold text-white/80">সাপ্তাহিক ছুটি</p>
            <p className="text-xl md:text-2xl font-black text-emerald-300 mt-0.5">শুক্রবার ও শনিবার</p>
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
          <TabsTrigger value="list" className="font-black text-xs sm:text-sm data-[state=active]:bg-primary data-[state=active]:text-white rounded-xl">
            <FileText className="w-4 h-4 mr-1.5" />
            ছুটি ও ইভেন্ট তালিকা ({toBengaliNumber(filteredEvents.length)})
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

              <div className="flex items-center gap-2 text-xs font-bold text-muted-foreground">
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-rose-500 inline-block" /> সরকারি ছুটি
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> পরীক্ষা
                </span>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6">
              {/* Day Headers */}
              <div className="grid grid-cols-7 gap-2 mb-2 text-center font-black text-xs text-muted-foreground">
                {WEEKDAYS.map((wd, i) => (
                  <div key={wd} className={cn("py-2 rounded-xl", i === 6 ? "text-rose-500 bg-rose-50 dark:bg-rose-950/30" : "")}>
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
                  const isExam = hasHoliday && (d.holiday!.description.includes('পরীক্ষা') || d.holiday!.description.includes('মূল্যায়ন'));

                  return (
                    <div
                      key={d.dateStr}
                      className={cn(
                        "h-20 md:h-24 p-2 rounded-2xl border transition-all flex flex-col justify-between relative group",
                        d.isWeekend ? "bg-rose-50/40 dark:bg-rose-950/20 border-rose-200/60 dark:border-rose-900/40" : "bg-white dark:bg-card border-slate-200 dark:border-border",
                        hasHoliday && (isExam ? "bg-blue-50/60 dark:bg-blue-950/30 border-blue-300" : "bg-amber-50/60 dark:bg-amber-950/30 border-amber-300")
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <span className={cn(
                          "w-6 h-6 rounded-full flex items-center justify-center text-xs font-black",
                          d.isWeekend ? "text-rose-600 bg-rose-100 dark:bg-rose-900/50" : "text-slate-800 dark:text-slate-200",
                          hasHoliday && (isExam ? "bg-blue-600 text-white" : "bg-rose-600 text-white")
                        )}>
                          {toBengaliNumber(d.dayNum)}
                        </span>
                        {d.isWeekend && !hasHoliday && (
                          <span className="text-[10px] text-rose-500 font-bold hidden sm:inline">ছুটি</span>
                        )}
                      </div>

                      {hasHoliday && (
                        <div className="mt-1">
                          <p className={cn(
                            "text-[10px] leading-tight font-black line-clamp-2 p-1 rounded-lg",
                            isExam ? "bg-blue-100 text-blue-900 dark:bg-blue-900 dark:text-blue-100" : "bg-amber-100 text-amber-900 dark:bg-amber-900 dark:text-amber-100"
                          )}>
                            {d.holiday!.description}
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
                      {toBengaliNumber(generateMonthDays(mIdx).filter(x => x.holiday).length)} ইভেন্ট
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
                            cell.isWeekend && "text-rose-500",
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

        {/* List View */}
        <TabsContent value="list" className="space-y-4">
          <Card className="border-2 border-slate-200 dark:border-border rounded-[24px]">
            <CardHeader className="p-4 md:p-6 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
              <div className="relative w-full sm:w-72">
                <Search className="w-4 h-4 absolute left-3 top-3 text-muted-foreground" />
                <Input
                  placeholder="ইভেন্ট বা ছুটির নাম খুঁজুন..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="pl-9 font-bold text-xs"
                />
              </div>

              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={filterType === 'all' ? 'default' : 'outline'}
                  onClick={() => setFilterType('all')}
                  className="font-black text-xs rounded-xl"
                >
                  সবগুলো
                </Button>
                <Button
                  size="sm"
                  variant={filterType === 'exam' ? 'default' : 'outline'}
                  onClick={() => setFilterType('exam')}
                  className="font-black text-xs rounded-xl"
                >
                  পরীক্ষাসমূহ
                </Button>
                <Button
                  size="sm"
                  variant={filterType === 'govt' ? 'default' : 'outline'}
                  onClick={() => setFilterType('govt')}
                  className="font-black text-xs rounded-xl"
                >
                  ছুটিসরূপ
                </Button>
              </div>
            </CardHeader>
            <CardContent className="p-4 md:p-6 pt-0">
              {filteredEvents.length === 0 ? (
                <div className="text-center py-12 text-muted-foreground font-bold">
                  কোনো ইভেন্ট বা ছুটি পাওয়া যায়নি।
                </div>
              ) : (
                <div className="divide-y divide-slate-100 dark:divide-border">
                  {filteredEvents.map((evt) => {
                    const isExam = evt.description.includes('পরীক্ষা') || evt.description.includes('মূল্যায়ন');
                    const [y, m, d] = evt.date.split('-');
                    const monthBangla = BANGLA_MONTHS[parseInt(m, 10) - 1];

                    return (
                      <div key={evt.id} className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 dark:hover:bg-card/50 px-2 rounded-xl transition-colors">
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-12 h-12 rounded-2xl flex flex-col items-center justify-center shrink-0 border",
                            isExam ? "bg-blue-50 border-blue-200 text-blue-700 dark:bg-blue-950 dark:text-blue-200" : "bg-rose-50 border-rose-200 text-rose-700 dark:bg-rose-950 dark:text-rose-200"
                          )}>
                            <span className="text-sm font-black leading-none">{toBengaliNumber(parseInt(d, 10))}</span>
                            <span className="text-[10px] font-bold mt-0.5">{monthBangla?.slice(0, 4)}</span>
                          </div>
                          <div>
                            <p className="font-black text-sm text-slate-800 dark:text-slate-100">
                              {evt.description}
                            </p>
                            <div className="flex items-center gap-2 mt-0.5">
                              <Badge variant="outline" className={cn("text-[10px] font-bold", isExam ? "text-blue-600 border-blue-200" : "text-rose-600 border-rose-200")}>
                                {isExam ? 'পরীক্ষা / মূল্যায়ন' : 'ছুটি / দিবস'}
                              </Badge>
                              <span className="text-[11px] text-muted-foreground font-medium">
                                {toBengaliNumber(evt.date)}
                              </span>
                            </div>
                          </div>
                        </div>

                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeleteEvent(evt.id, evt.date)}
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

      {/* PRINT-ONLY SECTION (A4 Printable Annual Academic Calendar) */}
      <div className="print-only font-kalpurush p-6 bg-white text-black min-h-screen">
        {/* School Header */}
        <div className="text-center border-b-2 border-black pb-4 mb-6">
          <h1 className="text-2xl font-black">{schoolInfo?.name || 'টপ গ্রেড একাডেমি'}</h1>
          <p className="text-xs font-bold mt-1">{schoolInfo?.address || 'বাংলাদেশ'}</p>
          <div className="inline-block bg-black text-white px-4 py-1 rounded-full text-xs font-black mt-2">
            বার্ষিক একাডেমি ক্যালেন্ডার ও ছুটির তালিকা - {toBengaliNumber(currentYearNum)}
          </div>
        </div>

        {/* Holiday Table */}
        <table className="w-full border-collapse border border-black text-xs">
          <thead>
            <tr className="bg-slate-100 border-b border-black">
              <th className="border border-black p-2 text-center w-12">ক্রমিক</th>
              <th className="border border-black p-2 text-left">তারিখ</th>
              <th className="border border-black p-2 text-left">ছুটি / ইভেন্টের বিবরণ</th>
              <th className="border border-black p-2 text-center w-28">ধরন</th>
            </tr>
          </thead>
          <tbody>
            {filteredEvents.map((h, idx) => (
              <tr key={`print-${h.id}`} className="border-b border-black">
                <td className="border border-black p-2 text-center font-bold">{toBengaliNumber(idx + 1)}</td>
                <td className="border border-black p-2 font-bold">{toBengaliNumber(h.date)}</td>
                <td className="border border-black p-2 font-bold">{h.description}</td>
                <td className="border border-black p-2 text-center">
                  {h.description.includes('পরীক্ষা') ? 'পরীক্ষা' : 'ছুটি'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Footer Signatures */}
        <div className="flex justify-between items-end mt-16 pt-8 px-8">
          <div className="text-center">
            <div className="w-40 border-t border-black mb-1" />
            <p className="text-xs font-bold">একাডেমিক ইনচার্জ</p>
          </div>
          <div className="text-center">
            <div className="w-40 border-t border-black mb-1" />
            <p className="text-xs font-bold">প্রধান শিক্ষক / অধ্যক্ষের স্বাক্ষর ও সিল</p>
          </div>
        </div>
      </div>
    </div>
  );
}

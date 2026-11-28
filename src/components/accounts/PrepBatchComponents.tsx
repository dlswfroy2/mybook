'use client';

import React, { useState, useMemo, useEffect } from 'react';
import { Student } from '@/lib/student-data';
import { useFirestore } from '@/firebase';
import { 
  collection, 
  doc, 
  addDoc, 
  updateDoc, 
  writeBatch, 
  serverTimestamp, 
  query, 
  where, 
  orderBy, 
  onSnapshot, 
  increment,
  Timestamp 
} from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  GraduationCap, 
  CreditCard, 
  Banknote, 
  AlertCircle, 
  Receipt, 
  ListChecks, 
  Search, 
  Printer, 
  PlusCircle, 
  Calendar, 
  Save, 
  Loader2, 
  CheckCircle2, 
  Clock, 
  TrendingUp, 
  Coins, 
  PhoneCall, 
  FileSpreadsheet,
  Filter,
  Users
} from 'lucide-react';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { cn } from '@/lib/utils';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { DatePicker } from '@/components/ui/date-picker';
import { useSchoolInfo } from '@/context/SchoolInfoContext';

export interface PrepBatchCollectionRecord {
  id: string;
  studentId: string;
  studentName: string;
  className: string;
  roll: number;
  academicYear: string;
  prepBatchName: string;
  totalBatchFee: number;
  installmentAmount: number;
  remainingDue: number;
  paymentMethod: string;
  paymentDate: Date;
  receiptNo: string;
  collectorName: string;
  notes?: string;
  createdAt?: any;
}

const classNamesMap: { [key: string]: string } = {
  '6': '৬ষ্ঠ শ্রেণি',
  '7': '৭ম শ্রেণি',
  '8': '৮ম শ্রেণি',
  '9': '৯ম শ্রেণি',
  '10': '১০ম শ্রেণি'
};

function toBengaliNumber(str: string | number | undefined | null) {
  if (!str && str !== 0) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
}

// ============================================================================
// 1. PREP BATCH DASHBOARD TAB
// ============================================================================
export function PrepBatchDashboardTab({
  allStudents,
  prepCollections,
  selectedYear,
  onNavigate
}: {
  allStudents: Student[];
  prepCollections: PrepBatchCollectionRecord[];
  selectedYear: string;
  onNavigate: (sectionId: string) => void;
}) {
  const students = useMemo(() => {
    return allStudents.filter(s => (!s.academicYear || s.academicYear === selectedYear) && (Number(s.prepBatchFee) || 0) > 0);
  }, [allStudents, selectedYear]);

  const stats = useMemo(() => {
    const totalEnrolled = students.length;
    const totalFee = students.reduce((sum, s) => sum + (Number(s.prepBatchFee) || 0), 0);
    const totalCollected = prepCollections.reduce((sum, c) => sum + (Number(c.installmentAmount) || 0), 0);
    const totalDue = Math.max(0, totalFee - totalCollected);

    const now = new Date();
    const todayCollected = prepCollections
      .filter(c => {
        const d = new Date(c.paymentDate);
        return d.toDateString() === now.toDateString();
      })
      .reduce((sum, c) => sum + (Number(c.installmentAmount) || 0), 0);

    const thisMonthCollected = prepCollections
      .filter(c => {
        const d = new Date(c.paymentDate);
        return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
      })
      .reduce((sum, c) => sum + (Number(c.installmentAmount) || 0), 0);

    return { totalEnrolled, totalFee, totalCollected, totalDue, todayCollected, thisMonthCollected };
  }, [students, prepCollections]);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Banner */}
      <div className="p-6 rounded-2xl bg-gradient-to-r from-violet-600 via-indigo-600 to-purple-700 text-white shadow-xl flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-white/20 backdrop-blur-sm px-3 py-1 rounded-full text-xs font-black mb-2">
            <GraduationCap className="h-4 w-4" />
            <span>প্রস্তুতি ব্যাচ শাখা ও হিসাব</span>
          </div>
          <h2 className="text-2xl sm:text-3xl font-black">প্রস্তুতি ব্যাচ ড্যাশবোর্ড</h2>
          <p className="text-xs sm:text-sm text-indigo-100 font-bold mt-1">
            এককালীন প্রস্তুতি ফি নির্ধারণ, ভেঙ্গে ভেঙ্গে আদায় এবং পূর্ণাঙ্গ আলাদা হিসাব।
          </p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button
            onClick={() => onNavigate('prep-fee-setup')}
            className="bg-white hover:bg-slate-100 text-indigo-900 font-black text-xs h-9 shadow-md"
          >
            ফি সেটআপ করুন
          </Button>
          <Button
            onClick={() => onNavigate('prep-collection')}
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs h-9 shadow-md"
          >
            <Banknote className="h-4 w-4 mr-1.5" />
            ফি আদায় করুন
          </Button>
        </div>
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Target Fee */}
        <Card className="border-2 border-slate-200/80 shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-all">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-slate-500">মোট নির্ধারিত ফি</p>
              <h3 className="text-2xl font-black text-slate-800 mt-1">
                {toBengaliNumber(stats.totalFee)} ৳
              </h3>
              <p className="text-[11px] font-bold text-slate-500 mt-0.5">
                মোট শিক্ষার্থী: {toBengaliNumber(stats.totalEnrolled)} জন
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-indigo-50 text-indigo-600">
              <Coins className="h-7 w-7" />
            </div>
          </CardContent>
        </Card>

        {/* Total Collected */}
        <Card className="border-2 border-emerald-200/80 shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-all bg-emerald-50/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-emerald-700">মোট আদায়কৃত ফি</p>
              <h3 className="text-2xl font-black text-emerald-800 mt-1">
                {toBengaliNumber(stats.totalCollected)} ৳
              </h3>
              <p className="text-[11px] font-bold text-emerald-600 mt-0.5">
                আদায়ের হার: {stats.totalFee > 0 ? toBengaliNumber(Math.round((stats.totalCollected / stats.totalFee) * 100)) : '০'}%
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-emerald-100 text-emerald-700">
              <TrendingUp className="h-7 w-7" />
            </div>
          </CardContent>
        </Card>

        {/* Total Due */}
        <Card className="border-2 border-rose-200/80 shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-all bg-rose-50/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-rose-700">মোট অবশিষ্ট বকেয়া</p>
              <h3 className="text-2xl font-black text-rose-800 mt-1">
                {toBengaliNumber(stats.totalDue)} ৳
              </h3>
              <p className="text-[11px] font-bold text-rose-600 mt-0.5">
                বকেয়ার হার: {stats.totalFee > 0 ? toBengaliNumber(Math.round((stats.totalDue / stats.totalFee) * 100)) : '০'}%
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-rose-100 text-rose-700">
              <AlertCircle className="h-7 w-7" />
            </div>
          </CardContent>
        </Card>

        {/* Today's Collection */}
        <Card className="border-2 border-amber-200/80 shadow-md rounded-2xl overflow-hidden hover:shadow-lg transition-all bg-amber-50/20">
          <CardContent className="p-5 flex items-center justify-between">
            <div>
              <p className="text-xs font-black uppercase text-amber-700">আজকের আদায়</p>
              <h3 className="text-2xl font-black text-amber-900 mt-1">
                {toBengaliNumber(stats.todayCollected)} ৳
              </h3>
              <p className="text-[11px] font-bold text-amber-600 mt-0.5">
                চলতি মাসে: {toBengaliNumber(stats.thisMonthCollected)} ৳
              </p>
            </div>
            <div className="p-3.5 rounded-2xl bg-amber-100 text-amber-700">
              <Clock className="h-7 w-7" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Recent Collections Table */}
      <Card className="border shadow-lg rounded-2xl overflow-hidden bg-white">
        <CardHeader className="bg-slate-50/80 border-b pb-3 flex flex-row items-center justify-between">
          <div>
            <CardTitle className="text-lg font-black text-slate-800">সর্বশেষ ফি আদায়ের তালিকা</CardTitle>
            <CardDescription className="text-xs font-bold text-slate-500">
              সম্প্রতি সংগৃহীত প্রস্তুতি ফি কিস্তিসমূহের বিবরণ
            </CardDescription>
          </div>
          <Button
            size="sm"
            variant="outline"
            onClick={() => onNavigate('prep-report')}
            className="font-black text-xs"
          >
            সম্পূর্ণ রিপোর্ট দেখুন
          </Button>
        </CardHeader>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-100/60">
              <TableRow className="h-10">
                <TableHead className="font-black text-slate-700 text-xs">রশিদ নং</TableHead>
                <TableHead className="font-black text-slate-700 text-xs">তারিখ</TableHead>
                <TableHead className="font-black text-slate-700 text-xs">শিক্ষার্থী</TableHead>
                <TableHead className="font-black text-slate-700 text-xs text-center">শ্রেণি ও রোল</TableHead>
                <TableHead className="font-black text-slate-700 text-xs">ব্যাচ</TableHead>
                <TableHead className="font-black text-slate-700 text-xs text-right">কিস্তির পরিমাণ</TableHead>
                <TableHead className="font-black text-slate-700 text-xs text-right pr-6">অবশিষ্ট বাকি</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {prepCollections.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={7} className="text-center py-10 text-slate-500 font-bold">
                    এখনও কোনো প্রস্তুতি ফি কিস্তি আদায় রেকর্ড নেই।
                  </TableCell>
                </TableRow>
              ) : (
                prepCollections.slice(0, 5).map((col) => (
                  <TableRow key={col.id} className="h-12 hover:bg-slate-50">
                    <TableCell className="font-mono font-bold text-xs text-primary">{col.receiptNo}</TableCell>
                    <TableCell className="text-xs font-bold text-slate-600">
                      {format(new Date(col.paymentDate), 'PP', { locale: bn })}
                    </TableCell>
                    <TableCell className="font-black text-slate-800 text-sm">{col.studentName}</TableCell>
                    <TableCell className="text-center font-bold text-xs">
                      {classNamesMap[col.className] || col.className} (রোল: {toBengaliNumber(col.roll)})
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-600">{col.prepBatchName || 'প্রস্তুতি ব্যাচ'}</TableCell>
                    <TableCell className="text-right font-black text-emerald-700 text-sm">
                      {toBengaliNumber(col.installmentAmount)} ৳
                    </TableCell>
                    <TableCell className="text-right font-black text-rose-700 text-sm pr-6">
                      {toBengaliNumber(col.remainingDue)} ৳
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// 2. PREP BATCH FEE SETUP TAB
// ============================================================================
export function PrepBatchFeeSetupTab({
  allStudents,
  selectedYear
}: {
  allStudents: Student[];
  selectedYear: string;
}) {
  const db = useFirestore();
  const { toast } = useToast();

  const [selectedClass, setSelectedClass] = useState('10');
  const [defaultBatchName, setDefaultBatchName] = useState('এসএসসি বিশেষ প্রস্তুতি ব্যাচ');
  const [bulkFee, setBulkFee] = useState('');
  const [editedFees, setEditedFees] = useState<Record<string, { fee: number; batchName: string }>>({});
  const [isSaving, setIsSaving] = useState(false);

  const students = useMemo(() => {
    return allStudents
      .filter(s => (!s.academicYear || s.academicYear === selectedYear) && s.className === selectedClass)
      .sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
  }, [allStudents, selectedYear, selectedClass]);

  const handleBulkApply = () => {
    if (!bulkFee) {
      toast({ variant: 'destructive', title: 'অনুগ্রহ করে ফি এর পরিমাণ লিখুন' });
      return;
    }
    const feeNum = parseInt(bulkFee, 10) || 0;
    const next = { ...editedFees };
    students.forEach(s => {
      next[s.id] = {
        fee: feeNum,
        batchName: defaultBatchName
      };
    });
    setEditedFees(next);
    toast({ title: 'সকল শিক্ষার্থীর জন্য মান ধার্য করা হয়েছে', description: `মোট ${toBengaliNumber(students.length)} জনের জন্য ${toBengaliNumber(feeNum)} ৳` });
  };

  const handleStudentFeeChange = (id: string, feeStr: string) => {
    const feeNum = parseInt(feeStr, 10) || 0;
    setEditedFees(prev => ({
      ...prev,
      [id]: {
        fee: feeNum,
        batchName: prev[id]?.batchName || defaultBatchName
      }
    }));
  };

  const handleSaveAll = async () => {
    if (!db || Object.keys(editedFees).length === 0) return;
    setIsSaving(true);
    try {
      const batch = writeBatch(db);
      Object.entries(editedFees).forEach(([id, data]) => {
        const ref = doc(db, 'students', id);
        batch.update(ref, {
          prepBatchFee: data.fee,
          prepBatchName: data.batchName,
          prepBatchEnrolled: data.fee > 0,
          updatedAt: serverTimestamp()
        });
      });

      await batch.commit();
      toast({ title: 'সফলভাবে সংরক্ষিত', description: 'প্রস্তুতি ব্যাচ ফি সেটাপ আপডেট সম্পন্ন হয়েছে।' });
      setEditedFees({});
    } catch (err: any) {
      console.error('Failed to save prep fees:', err);
      toast({ variant: 'destructive', title: 'সংরক্ষণ ব্যর্থ হয়েছে' });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border-2 border-indigo-200/80 shadow-lg rounded-2xl bg-white">
        <CardHeader className="bg-indigo-50/50 border-b pb-4">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
                <GraduationCap className="h-5 w-5 text-primary" />
                <span>প্রস্তুতি ব্যাচ ফি সেটআপ (এককালীন মোট কোর্স ফি)</span>
              </CardTitle>
              <CardDescription className="text-xs font-bold text-slate-500 mt-1">
                প্রতিটি শিক্ষার্থীর জন্য পুরো প্রস্তুতি কোর্সের মোট ফি একবারে নির্ধারণ করুন।
              </CardDescription>
            </div>
            <div className="flex items-center gap-2">
              <Button
                onClick={handleSaveAll}
                disabled={isSaving || Object.keys(editedFees).length === 0}
                className="bg-emerald-600 hover:bg-emerald-700 text-white font-black shadow-md text-xs h-9"
              >
                {isSaving ? <Loader2 className="h-4 w-4 mr-1.5 animate-spin" /> : <Save className="h-4 w-4 mr-1.5" />}
                পরিবর্তন সেভ করুন ({toBengaliNumber(Object.keys(editedFees).length)})
              </Button>
            </div>
          </div>
        </CardHeader>

        <CardContent className="pt-6 space-y-6">
          {/* Controls: Class Selector, Batch Name, Bulk Fee Input */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end bg-slate-50 p-4 rounded-xl border">
            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-black text-slate-700">শ্রেণি নির্বাচন</Label>
              <div className="flex gap-1">
                {['10', '9', '8', '7', '6'].map(cls => (
                  <Button
                    key={cls}
                    size="sm"
                    variant={selectedClass === cls ? 'default' : 'outline'}
                    onClick={() => setSelectedClass(cls)}
                    className={cn(
                      "font-black text-xs h-9 px-3",
                      selectedClass === cls ? "bg-primary text-white" : "bg-white text-slate-700"
                    )}
                  >
                    {toBengaliNumber(cls)}ম
                  </Button>
                ))}
              </div>
            </div>

            <div className="md:col-span-4 space-y-1.5">
              <Label className="text-xs font-black text-slate-700">প্রস্তুতি ব্যাচের নাম</Label>
              <Input
                value={defaultBatchName}
                onChange={(e) => setDefaultBatchName(e.target.value)}
                placeholder="যেমন: এসএসসি বিশেষ প্রস্তুতি ব্যাচ"
                className="h-9 font-bold text-xs bg-white"
              />
            </div>

            <div className="md:col-span-3 space-y-1.5">
              <Label className="text-xs font-black text-slate-700">এককালীন মোট ফি (টাকা)</Label>
              <Input
                type="number"
                value={bulkFee}
                onChange={(e) => setBulkFee(e.target.value)}
                placeholder="যেমন: ৩০০০"
                className="h-9 font-black text-sm bg-white"
              />
            </div>

            <div className="md:col-span-2">
              <Button
                onClick={handleBulkApply}
                className="w-full bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-9 shadow-sm"
              >
                সবার জন্য অ্যাপ্লাই
              </Button>
            </div>
          </div>

          {/* Table */}
          <div className="border rounded-xl overflow-hidden shadow-sm">
            <Table>
              <TableHeader className="bg-slate-100">
                <TableRow className="h-11">
                  <TableHead className="font-black text-slate-800 text-center w-20">রোল</TableHead>
                  <TableHead className="font-black text-slate-800">শিক্ষার্থীর নাম</TableHead>
                  <TableHead className="font-black text-slate-800">অভিভাবক ও মোবাইল</TableHead>
                  <TableHead className="font-black text-slate-800">ব্যাচের নাম</TableHead>
                  <TableHead className="font-black text-slate-800 text-right pr-6 w-48">মোট প্রস্তুতি ফি (৳)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {students.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center py-12 text-slate-500 font-bold">
                      এই শ্রেণিতে কোনো শিক্ষার্থী পাওয়া যায়নি।
                    </TableCell>
                  </TableRow>
                ) : (
                  students.map(student => {
                    const currentFee = editedFees[student.id]?.fee !== undefined 
                      ? editedFees[student.id].fee 
                      : (student.prepBatchFee || 0);

                    return (
                      <TableRow key={student.id} className="h-12 hover:bg-slate-50">
                        <TableCell className="text-center font-black text-primary text-base">
                          {toBengaliNumber(student.roll)}
                        </TableCell>
                        <TableCell className="font-black text-slate-800 text-sm">
                          {student.studentNameBn}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-600">
                          {student.fatherNameBn || '—'} {student.guardianMobile ? `(${student.guardianMobile})` : ''}
                        </TableCell>
                        <TableCell className="text-xs font-bold text-slate-600">
                          {student.prepBatchName || defaultBatchName}
                        </TableCell>
                        <TableCell className="text-right pr-6">
                          <Input
                            type="number"
                            value={currentFee || ''}
                            onChange={(e) => handleStudentFeeChange(student.id, e.target.value)}
                            placeholder="০"
                            className="h-8 w-32 text-right font-black text-sm ml-auto border-slate-300 focus:border-primary"
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================================
// 3. PREP BATCH COLLECTION TAB (WITH PARTIAL/INSTALLMENT PAYMENT)
// ============================================================================
export function PrepBatchCollectionTab({
  allStudents,
  prepCollections,
  selectedYear,
  onRefresh
}: {
  allStudents: Student[];
  prepCollections: PrepBatchCollectionRecord[];
  selectedYear: string;
  onRefresh: () => void;
}) {
  const db = useFirestore();
  const { toast } = useToast();
  const { user } = useAuth();
  const { schoolInfo } = useSchoolInfo();

  const [selectedClass, setSelectedClass] = useState('10');
  const [searchQuery, setSearchQuery] = useState('');

  // Payment Modal State
  const [paymentStudent, setPaymentStudent] = useState<Student | null>(null);
  const [installmentAmount, setInstallmentAmount] = useState<string>('');
  const [paymentMethod, setPaymentMethod] = useState<'cash' | 'bkash' | 'nagad' | 'bank'>('cash');
  const [paymentDate, setPaymentDate] = useState<Date | undefined>(new Date());
  const [notes, setNotes] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Printing Receipt State
  const [printedRecord, setPrintedRecord] = useState<PrepBatchCollectionRecord | null>(null);

  // Calculate student paid amount map
  const studentPaidMap = useMemo(() => {
    const map: Record<string, number> = {};
    prepCollections.forEach(c => {
      map[c.studentId] = (map[c.studentId] || 0) + (Number(c.installmentAmount) || 0);
    });
    return map;
  }, [prepCollections]);

  // Filter students
  const filteredStudents = useMemo(() => {
    return allStudents
      .filter(s => {
        const matchesYear = !s.academicYear || s.academicYear === selectedYear;
        const matchesClass = selectedClass === 'all' || s.className === selectedClass;
        if (!matchesYear || !matchesClass) return false;

        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase().trim();
        const name = (s.studentNameBn || '').toLowerCase();
        const roll = String(s.roll || '');
        const mob = (s.guardianMobile || '').toLowerCase();
        return name.includes(q) || roll.includes(q) || mob.includes(q);
      })
      .sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
  }, [allStudents, selectedYear, selectedClass, searchQuery]);

  const handleOpenPayment = (student: Student) => {
    const totalFee = Number(student.prepBatchFee) || 0;
    const paidSoFar = studentPaidMap[student.id] || 0;
    const remainingDue = Math.max(0, totalFee - paidSoFar);

    setPaymentStudent(student);
    setInstallmentAmount(remainingDue > 0 ? String(remainingDue) : '');
    setPaymentMethod('cash');
    setPaymentDate(new Date());
    setNotes('');
  };

  const handleSavePayment = async () => {
    if (!paymentStudent || !db) return;
    const amountNum = parseInt(installmentAmount, 10);
    if (!amountNum || amountNum <= 0) {
      toast({ variant: 'destructive', title: 'অনুগ্রহ করে কিস্তির সঠিক পরিমাণ লিখুন' });
      return;
    }

    const totalFee = Number(paymentStudent.prepBatchFee) || 0;
    const alreadyPaid = studentPaidMap[paymentStudent.id] || 0;
    const newRemainingDue = Math.max(0, totalFee - (alreadyPaid + amountNum));
    const receiptNo = `PB-${Date.now().toString().slice(-6)}`;

    setIsSubmitting(true);
    try {
      const recordData = {
        studentId: paymentStudent.id,
        studentName: paymentStudent.studentNameBn,
        className: paymentStudent.className,
        roll: Number(paymentStudent.roll) || 0,
        academicYear: selectedYear,
        prepBatchName: paymentStudent.prepBatchName || 'প্রস্তুতি ব্যাচ',
        totalBatchFee: totalFee,
        installmentAmount: amountNum,
        remainingDue: newRemainingDue,
        paymentMethod,
        paymentDate: paymentDate || new Date(),
        receiptNo,
        collectorName: user?.displayName || 'অফিস সহকারী',
        notes: notes.trim(),
        createdAt: serverTimestamp()
      };

      // 1. Add to prepBatchCollections
      const docRef = await addDoc(collection(db, 'prepBatchCollections'), recordData);

      // 2. Add income transaction for global accounts
      await addDoc(collection(db, 'transactions'), {
        date: paymentDate || new Date(),
        type: 'income',
        method: paymentMethod === 'bkash' || paymentMethod === 'nagad' ? 'bank' : paymentMethod,
        accountHead: 'Preparation Batch Fee',
        description: `প্রস্তুতি ব্যাচ ফি আদায়: ${paymentStudent.studentNameBn} (রোল ${toBengaliNumber(paymentStudent.roll)}, ${classNamesMap[paymentStudent.className] || paymentStudent.className}), রশিদ: ${receiptNo}`,
        amount: amountNum,
        academicYear: selectedYear,
        batchType: 'prep_batch',
        prepCollectionId: docRef.id,
        createdAt: serverTimestamp()
      });

      // 3. Update student record prepBatchPaid
      const studentRef = doc(db, 'students', paymentStudent.id);
      await updateDoc(studentRef, {
        prepBatchPaid: increment(amountNum),
        updatedAt: serverTimestamp()
      });

      toast({
        title: 'ফি সফলভাবে আদায় হয়েছে',
        description: `রশিদ নং: ${receiptNo}, পরিমাণ: ${toBengaliNumber(amountNum)} ৳`
      });

      // Show receipt for printing
      setPrintedRecord({
        id: docRef.id,
        ...recordData,
        paymentDate: paymentDate || new Date()
      });

      setPaymentStudent(null);
      onRefresh();
    } catch (err: any) {
      console.error('Failed to collect prep fee:', err);
      toast({ variant: 'destructive', title: 'আদায় ব্যর্থ হয়েছে', description: err.message });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Filter Bar */}
      <Card className="border shadow-md rounded-2xl bg-white p-4">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none w-full md:w-auto">
            <Button
              size="sm"
              variant={selectedClass === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedClass('all')}
              className={cn("font-black text-xs h-9 px-3 shrink-0", selectedClass === 'all' && "bg-primary text-white")}
            >
              সব শ্রেণি
            </Button>
            {['10', '9', '8', '7', '6'].map(cls => (
              <Button
                key={cls}
                size="sm"
                variant={selectedClass === cls ? 'default' : 'outline'}
                onClick={() => setSelectedClass(cls)}
                className={cn("font-black text-xs h-9 px-3 shrink-0", selectedClass === cls && "bg-primary text-white")}
              >
                {classNamesMap[cls] || `${toBengaliNumber(cls)}ম`}
              </Button>
            ))}
          </div>

          <div className="relative w-full md:w-72">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
            <Input
              placeholder="নাম, রোল বা মোবাইল দিয়ে খুঁজুন..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9 h-9 font-bold text-xs"
            />
          </div>
        </div>
      </Card>

      {/* Main Collection Table */}
      <Card className="border shadow-lg rounded-2xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-100/80">
              <TableRow className="h-12">
                <TableHead className="font-black text-slate-800 text-center w-16">রোল</TableHead>
                <TableHead className="font-black text-slate-800">শিক্ষার্থীর নাম</TableHead>
                <TableHead className="font-black text-slate-800 text-center">শ্রেণি</TableHead>
                <TableHead className="font-black text-slate-800">অভিভাবকের মোবাইল</TableHead>
                <TableHead className="font-black text-slate-800 text-right">মোট কোর্স ফি</TableHead>
                <TableHead className="font-black text-slate-800 text-right">মোট পরিশোধ</TableHead>
                <TableHead className="font-black text-slate-800 text-right">অবশিষ্ট বকেয়া</TableHead>
                <TableHead className="font-black text-slate-800 text-center">স্ট্যাটাস</TableHead>
                <TableHead className="font-black text-slate-800 text-right pr-6">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={9} className="text-center py-16 text-slate-500 font-bold">
                    কোনো শিক্ষার্থী পাওয়া যায়নি।
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map(student => {
                  const totalFee = Number(student.prepBatchFee) || 0;
                  const paidSoFar = studentPaidMap[student.id] || 0;
                  const due = Math.max(0, totalFee - paidSoFar);
                  const isFullyPaid = totalFee > 0 && due === 0;
                  const isUnset = totalFee === 0;

                  return (
                    <TableRow key={student.id} className="h-14 hover:bg-slate-50 transition-colors">
                      <TableCell className="font-black text-center text-primary text-base">
                        {toBengaliNumber(student.roll)}
                      </TableCell>
                      <TableCell className="font-black text-slate-800">
                        {student.studentNameBn}
                      </TableCell>
                      <TableCell className="text-center font-bold text-xs">
                        <Badge variant="outline" className="font-bold text-[11px]">
                          {classNamesMap[student.className] || student.className}
                        </Badge>
                      </TableCell>
                      <TableCell className="font-mono font-bold text-xs text-slate-600">
                        {student.guardianMobile || '—'}
                      </TableCell>
                      <TableCell className="text-right font-black text-slate-800 text-sm">
                        {isUnset ? <span className="text-slate-400">নির্ধারণ হয়নি</span> : `${toBengaliNumber(totalFee)} ৳`}
                      </TableCell>
                      <TableCell className="text-right font-black text-emerald-600 text-sm">
                        {toBengaliNumber(paidSoFar)} ৳
                      </TableCell>
                      <TableCell className="text-right font-black text-rose-600 text-sm">
                        {toBengaliNumber(due)} ৳
                      </TableCell>
                      <TableCell className="text-center">
                        {isUnset ? (
                          <Badge variant="outline" className="bg-slate-100 text-slate-600 font-bold text-[10px]">
                            ফি সেট নেই
                          </Badge>
                        ) : isFullyPaid ? (
                          <Badge className="bg-emerald-100 text-emerald-800 hover:bg-emerald-200 border-emerald-300 font-black text-[10px]">
                            পরিশোধিত ✓
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="bg-rose-50 text-rose-700 border-rose-300 font-black text-[10px]">
                            বকেয়া আছে
                          </Badge>
                        )}
                      </TableCell>
                      <TableCell className="text-right pr-6">
                        <Button
                          size="sm"
                          onClick={() => handleOpenPayment(student)}
                          disabled={isUnset || isFullyPaid}
                          className={cn(
                            "font-black text-xs h-8 px-4 shadow-sm",
                            isFullyPaid ? "bg-slate-100 text-slate-400" : "bg-emerald-600 hover:bg-emerald-700 text-white"
                          )}
                        >
                          <Banknote className="h-3.5 w-3.5 mr-1" />
                          ফি আদায়
                        </Button>
                      </TableCell>
                    </TableRow>
                  );
                })
              )}
            </TableBody>
          </Table>
        </div>
      </Card>

      {/* Payment / Installment Dialog */}
      <Dialog open={!!paymentStudent} onOpenChange={(open) => !open && setPaymentStudent(null)}>
        <DialogContent className="max-w-md font-kalpurush">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Banknote className="h-5 w-5 text-emerald-600" />
              <span>প্রস্তুতি ব্যাচ ফি আদায়</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500">
              পুরো ফি একবারে অথবা আংশিক/কিস্তিতে ভেঙ্গে আদায় করতে পারেন।
            </DialogDescription>
          </DialogHeader>

          {paymentStudent && (
            <div className="space-y-4 py-2">
              {/* Student Summary */}
              <div className="p-3.5 rounded-xl bg-slate-50 border space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-black text-slate-800 text-sm">{paymentStudent.studentNameBn}</h4>
                    <p className="text-xs font-bold text-slate-500">
                      শ্রেণি: {classNamesMap[paymentStudent.className] || paymentStudent.className} | রোল: {toBengaliNumber(paymentStudent.roll)}
                    </p>
                  </div>
                  <Badge variant="outline" className="font-black text-xs bg-indigo-50 text-indigo-700 border-indigo-200">
                    {paymentStudent.prepBatchName || 'প্রস্তুতি ব্যাচ'}
                  </Badge>
                </div>

                <div className="grid grid-cols-3 gap-2 pt-2 border-t text-center">
                  <div className="bg-white p-2 rounded-lg border">
                    <span className="text-[10px] font-black text-slate-500 block">মোট ফি</span>
                    <span className="text-sm font-black text-slate-800">
                      {toBengaliNumber(paymentStudent.prepBatchFee || 0)} ৳
                    </span>
                  </div>
                  <div className="bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                    <span className="text-[10px] font-black text-emerald-600 block">পরিশোধিত</span>
                    <span className="text-sm font-black text-emerald-800">
                      {toBengaliNumber(studentPaidMap[paymentStudent.id] || 0)} ৳
                    </span>
                  </div>
                  <div className="bg-rose-50 p-2 rounded-lg border border-rose-200">
                    <span className="text-[10px] font-black text-rose-600 block">বাকি আছে</span>
                    <span className="text-sm font-black text-rose-800">
                      {toBengaliNumber(Math.max(0, (Number(paymentStudent.prepBatchFee) || 0) - (studentPaidMap[paymentStudent.id] || 0)))} ৳
                    </span>
                  </div>
                </div>
              </div>

              {/* Installment Amount Input */}
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-slate-700">এই কিস্তিতে আদায়ের পরিমাণ (টাকা) *</Label>
                <Input
                  type="number"
                  placeholder="টাকার পরিমাণ লিখুন"
                  value={installmentAmount}
                  onChange={(e) => setInstallmentAmount(e.target.value)}
                  className="font-black text-lg h-11 text-emerald-700 border-emerald-300 focus:border-emerald-500"
                />
              </div>

              {/* Payment Method */}
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-slate-700">পেমেন্ট মেথড</Label>
                <div className="grid grid-cols-4 gap-2">
                  {[
                    { id: 'cash', label: 'নগদ' },
                    { id: 'bkash', label: 'বিকাশ' },
                    { id: 'nagad', label: 'নগদ' },
                    { id: 'bank', label: 'ব্যাংক' }
                  ].map(m => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={() => setPaymentMethod(m.id as any)}
                      className={cn(
                        "p-2 rounded-lg border text-xs font-black transition-all",
                        paymentMethod === m.id
                          ? "bg-emerald-600 text-white border-emerald-600 shadow-sm"
                          : "bg-white text-slate-700 border-slate-200 hover:bg-slate-50"
                      )}
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Date */}
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-slate-700">আদায়ের তারিখ</Label>
                <DatePicker value={paymentDate} onChange={setPaymentDate} />
              </div>

              {/* Notes */}
              <div className="space-y-1.5">
                <Label className="text-xs font-black text-slate-700">মন্তব্য বা কিস্তি নং (ঐচ্ছিক)</Label>
                <Input
                  placeholder="যেমন: ১ম কিস্তি বা বিশেষ ছাড়"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  className="text-xs font-bold"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setPaymentStudent(null)}
              disabled={isSubmitting}
              className="font-bold text-xs"
            >
              বাতিল
            </Button>
            <Button
              onClick={handleSavePayment}
              disabled={isSubmitting}
              className="font-black text-xs bg-emerald-600 hover:bg-emerald-700 text-white shadow-md"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  আদায় হচ্ছে...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" />
                  আদায় সম্পন্ন করুন ও রশিদ প্রিন্ট
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Printable Receipt Modal */}
      {printedRecord && (
        <Dialog open={!!printedRecord} onOpenChange={() => setPrintedRecord(null)}>
          <DialogContent className="max-w-md font-kalpurush">
            <DialogHeader>
              <DialogTitle className="text-center font-black text-lg text-slate-800">
                মানি রিসিট (প্রস্তুতি ব্যাচ)
              </DialogTitle>
            </DialogHeader>
            <div id="prep-receipt-print" className="p-4 bg-white border-2 border-dashed border-slate-300 rounded-xl space-y-3 text-xs">
              <div className="text-center border-b pb-2">
                <h3 className="font-black text-base text-slate-900">{schoolInfo?.schoolNameBn || 'টপ গ্রেড টিউটোরিয়ালস'}</h3>
                <p className="text-[10px] text-slate-500 font-bold">{schoolInfo?.schoolAddressBn || 'বীরগঞ্জ, দিনাজপুর'}</p>
                <Badge className="mt-1 bg-indigo-100 text-indigo-900 border-indigo-200 text-[10px]">
                  প্রস্তুতি ফি আদায় রশিদ
                </Badge>
              </div>

              <div className="grid grid-cols-2 gap-2 font-bold text-slate-700">
                <div>রশিদ নং: <span className="font-mono text-primary font-black">{printedRecord.receiptNo}</span></div>
                <div className="text-right">তারিখ: {format(new Date(printedRecord.paymentDate), 'PP', { locale: bn })}</div>
                <div>শিক্ষার্থী: <span className="font-black text-slate-900">{printedRecord.studentName}</span></div>
                <div className="text-right">শ্রেণি: {classNamesMap[printedRecord.className] || printedRecord.className} (রোল {toBengaliNumber(printedRecord.roll)})</div>
                <div>ব্যাচ: {printedRecord.prepBatchName}</div>
                <div className="text-right">পদ্ধতি: {printedRecord.paymentMethod}</div>
              </div>

              <div className="bg-slate-50 p-2.5 rounded-lg border space-y-1 font-bold">
                <div className="flex justify-between">
                  <span>মোট কোর্স ফি:</span>
                  <span>{toBengaliNumber(printedRecord.totalBatchFee)} ৳</span>
                </div>
                <div className="flex justify-between text-emerald-700 font-black text-sm border-t pt-1">
                  <span>পরিশোধকৃত কিস্তি:</span>
                  <span>{toBengaliNumber(printedRecord.installmentAmount)} ৳</span>
                </div>
                <div className="flex justify-between text-rose-700 font-black border-t pt-1">
                  <span>অবশিষ্ট বকেয়া:</span>
                  <span>{toBengaliNumber(printedRecord.remainingDue)} ৳</span>
                </div>
              </div>

              <div className="flex justify-between pt-6 text-[11px] font-bold text-slate-600">
                <div>আদায়কারী: {printedRecord.collectorName}</div>
                <div className="border-t border-slate-400 px-3">কর্তৃপক্ষের স্বাক্ষর</div>
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => setPrintedRecord(null)}
                className="font-bold text-xs"
              >
                বন্ধ করুন
              </Button>
              <Button
                onClick={() => window.print()}
                className="bg-primary text-white font-black text-xs shadow-md"
              >
                <Printer className="h-4 w-4 mr-1.5" />
                রশিদ প্রিন্ট করুন
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

// ============================================================================
// 4. PREP BATCH DEFAULTERS (DUE LIST) TAB
// ============================================================================
export function PrepBatchDefaultersTab({
  allStudents,
  prepCollections,
  selectedYear
}: {
  allStudents: Student[];
  prepCollections: PrepBatchCollectionRecord[];
  selectedYear: string;
}) {
  const [selectedClass, setSelectedClass] = useState('all');

  const studentPaidMap = useMemo(() => {
    const map: Record<string, number> = {};
    prepCollections.forEach(c => {
      map[c.studentId] = (map[c.studentId] || 0) + (Number(c.installmentAmount) || 0);
    });
    return map;
  }, [prepCollections]);

  const defaulters = useMemo(() => {
    return allStudents
      .filter(s => {
        const matchesYear = !s.academicYear || s.academicYear === selectedYear;
        const matchesClass = selectedClass === 'all' || s.className === selectedClass;
        const totalFee = Number(s.prepBatchFee) || 0;
        const paid = studentPaidMap[s.id] || 0;
        const due = totalFee - paid;
        return matchesYear && matchesClass && totalFee > 0 && due > 0;
      })
      .map(s => {
        const totalFee = Number(s.prepBatchFee) || 0;
        const paid = studentPaidMap[s.id] || 0;
        const due = totalFee - paid;
        return { student: s, totalFee, paid, due };
      })
      .sort((a, b) => b.due - a.due);
  }, [allStudents, selectedYear, selectedClass, studentPaidMap]);

  const totalDueAmount = defaulters.reduce((sum, d) => sum + d.due, 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border shadow-md rounded-2xl bg-white p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2 overflow-x-auto pb-1 scrollbar-none">
            <Button
              size="sm"
              variant={selectedClass === 'all' ? 'default' : 'outline'}
              onClick={() => setSelectedClass('all')}
              className={cn("font-black text-xs h-9 px-3 shrink-0", selectedClass === 'all' && "bg-primary text-white")}
            >
              সব শ্রেণি ({toBengaliNumber(defaulters.length)})
            </Button>
            {['10', '9', '8', '7', '6'].map(cls => (
              <Button
                key={cls}
                size="sm"
                variant={selectedClass === cls ? 'default' : 'outline'}
                onClick={() => setSelectedClass(cls)}
                className={cn("font-black text-xs h-9 px-3 shrink-0", selectedClass === cls && "bg-primary text-white")}
              >
                {classNamesMap[cls] || `${toBengaliNumber(cls)}ম`}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Badge className="bg-rose-100 text-rose-800 border-rose-300 font-black text-xs px-3 py-1.5 shadow-sm">
              সর্বমোট বকেয়া: {toBengaliNumber(totalDueAmount)} ৳
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="font-black text-xs h-9"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              তালিকা প্রিন্ট
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border shadow-lg rounded-2xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-rose-50/60 border-b">
              <TableRow className="h-11">
                <TableHead className="font-black text-slate-800 text-center w-16">রোল</TableHead>
                <TableHead className="font-black text-slate-800">শিক্ষার্থীর নাম</TableHead>
                <TableHead className="font-black text-slate-800 text-center">শ্রেণি</TableHead>
                <TableHead className="font-black text-slate-800">পিতা ও মোবাইল</TableHead>
                <TableHead className="font-black text-slate-800 text-right">মোট ফি</TableHead>
                <TableHead className="font-black text-slate-800 text-right">পরিশোধিত</TableHead>
                <TableHead className="font-black text-rose-700 text-right">বকেয়ার পরিমাণ</TableHead>
                <TableHead className="font-black text-slate-800 text-center w-28">যোগাযোগ</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {defaulters.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-emerald-600 font-black text-sm">
                    <CheckCircle2 className="h-10 w-10 mx-auto text-emerald-500 mb-2" />
                    আলহামদুলিল্লাহ! এই শ্রেণিতে কোনো প্রস্তুতি ফি বকেয়া নেই।
                  </TableCell>
                </TableRow>
              ) : (
                defaulters.map(({ student, totalFee, paid, due }) => (
                  <TableRow key={student.id} className="h-14 hover:bg-rose-50/20">
                    <TableCell className="font-black text-center text-primary text-base">
                      {toBengaliNumber(student.roll)}
                    </TableCell>
                    <TableCell className="font-black text-slate-800">
                      {student.studentNameBn}
                    </TableCell>
                    <TableCell className="text-center font-bold text-xs">
                      {classNamesMap[student.className] || student.className}
                    </TableCell>
                    <TableCell className="text-xs font-bold text-slate-600">
                      {student.fatherNameBn || '—'} {student.guardianMobile && `(${student.guardianMobile})`}
                    </TableCell>
                    <TableCell className="text-right font-black text-slate-700 text-sm">
                      {toBengaliNumber(totalFee)} ৳
                    </TableCell>
                    <TableCell className="text-right font-black text-emerald-600 text-sm">
                      {toBengaliNumber(paid)} ৳
                    </TableCell>
                    <TableCell className="text-right font-black text-rose-700 text-base">
                      {toBengaliNumber(due)} ৳
                    </TableCell>
                    <TableCell className="text-center">
                      {student.guardianMobile ? (
                        <a
                          href={`tel:${student.guardianMobile}`}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition text-xs font-black shadow-sm"
                        >
                          <PhoneCall className="h-3.5 w-3.5" />
                          <span>কল</span>
                        </a>
                      ) : (
                        <span className="text-xs text-slate-400 font-medium">নম্বর নেই</span>
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

// ============================================================================
// 5. PREP BATCH REPORT TAB
// ============================================================================
export function PrepBatchReportTab({
  prepCollections,
  selectedYear
}: {
  prepCollections: PrepBatchCollectionRecord[];
  selectedYear: string;
}) {
  const [filterClass, setFilterClass] = useState('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return prepCollections.filter(c => {
      const matchClass = filterClass === 'all' || c.className === filterClass;
      if (!matchClass) return false;
      if (!search.trim()) return true;
      const q = search.toLowerCase().trim();
      return (c.studentName || '').toLowerCase().includes(q) || (c.receiptNo || '').toLowerCase().includes(q);
    });
  }, [prepCollections, filterClass, search]);

  const totalAmount = filtered.reduce((sum, c) => sum + (Number(c.installmentAmount) || 0), 0);

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      <Card className="border shadow-md rounded-2xl bg-white p-4">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <div className="flex items-center gap-2">
            <Button
              size="sm"
              variant={filterClass === 'all' ? 'default' : 'outline'}
              onClick={() => setFilterClass('all')}
              className={cn("font-black text-xs h-9 px-3", filterClass === 'all' && "bg-primary text-white")}
            >
              সব শ্রেণি
            </Button>
            {['10', '9', '8', '7', '6'].map(cls => (
              <Button
                key={cls}
                size="sm"
                variant={filterClass === cls ? 'default' : 'outline'}
                onClick={() => setFilterClass(cls)}
                className={cn("font-black text-xs h-9 px-3", filterClass === cls && "bg-primary text-white")}
              >
                {classNamesMap[cls] || `${toBengaliNumber(cls)}ম`}
              </Button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <Badge className="bg-emerald-100 text-emerald-800 border-emerald-300 font-black text-xs px-3 py-1.5 shadow-sm">
              মোট আদায়: {toBengaliNumber(totalAmount)} ৳
            </Badge>
            <Button
              size="sm"
              variant="outline"
              onClick={() => window.print()}
              className="font-black text-xs h-9"
            >
              <Printer className="h-4 w-4 mr-1.5" />
              রিপোর্ট প্রিন্ট
            </Button>
          </div>
        </div>
      </Card>

      <Card className="border shadow-lg rounded-2xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-100">
              <TableRow className="h-11">
                <TableHead className="font-black text-slate-800">রশিদ নং</TableHead>
                <TableHead className="font-black text-slate-800">আদায়ের তারিখ</TableHead>
                <TableHead className="font-black text-slate-800">শিক্ষার্থীর নাম</TableHead>
                <TableHead className="font-black text-slate-800 text-center">শ্রেণি ও রোল</TableHead>
                <TableHead className="font-black text-slate-800">ব্যাচ</TableHead>
                <TableHead className="font-black text-slate-800">পদ্ধতি</TableHead>
                <TableHead className="font-black text-slate-800 text-right">আদায়ের পরিমাণ</TableHead>
                <TableHead className="font-black text-slate-800 text-right pr-6">অবশিষ্ট বকেয়া</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filtered.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-slate-500 font-bold">
                    কোনো আদায়ের রেকর্ড পাওয়া যায়নি।
                  </TableCell>
                </TableRow>
              ) : (
                filtered.map(item => (
                  <TableRow key={item.id} className="h-12 hover:bg-slate-50">
                    <TableCell className="font-mono font-bold text-xs text-primary">{item.receiptNo}</TableCell>
                    <TableCell className="text-xs font-bold text-slate-600">
                      {format(new Date(item.paymentDate), 'PP', { locale: bn })}
                    </TableCell>
                    <TableCell className="font-black text-slate-800 text-sm">{item.studentName}</TableCell>
                    <TableCell className="text-center font-bold text-xs">
                      {classNamesMap[item.className] || item.className} (রোল: {toBengaliNumber(item.roll)})
                    </TableCell>
                    <TableCell className="text-xs font-medium text-slate-600">{item.prepBatchName}</TableCell>
                    <TableCell className="text-xs font-bold text-slate-700 capitalize">{item.paymentMethod}</TableCell>
                    <TableCell className="text-right font-black text-emerald-700 text-sm">
                      {toBengaliNumber(item.installmentAmount)} ৳
                    </TableCell>
                    <TableCell className="text-right font-black text-rose-700 text-sm pr-6">
                      {toBengaliNumber(item.remainingDue)} ৳
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </Card>
    </div>
  );
}

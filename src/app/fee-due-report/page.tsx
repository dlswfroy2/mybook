'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  CreditCard, 
  Printer, 
  Search, 
  Download, 
  Phone, 
  AlertCircle, 
  CheckCircle2, 
  ArrowLeft,
  Users,
  Wallet
} from 'lucide-react';
import Link from 'next/link';
import * as XLSX from 'xlsx';
import { StudentFeeDialog } from '@/components/StudentFeeDialog';

const CLASS_LIST = [
  { id: 'all', label: 'সকল শ্রেণি' },
  { id: '6', label: '৬ষ্ঠ শ্রেণি' },
  { id: '7', label: '৭ম শ্রেণি' },
  { id: '8', label: '৮ম শ্রেণি' },
  { id: '9', label: '৯ম শ্রেণি' },
  { id: '10', label: '১০ম শ্রেণি' },
];

const toBn = (str: string | number | undefined | null) => {
  if (str === undefined || str === null) return '';
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bn[parseInt(w, 10)]);
};

export default function FeeDueReportPage() {
  const db = useFirestore();
  const { selectedYear } = useAcademicYear();
  const { schoolInfo } = useSchoolInfo();
  const { toast } = useToast();

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [quickFeeStudent, setQuickFeeStudent] = useState<Student | null>(null);

  const institutionName = schoolInfo?.name || 'টপ গ্রেড টিউটোরিয়ালস';

  // Load students for active year
  const loadStudents = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const q = query(
        collection(db, 'students'),
        where('academicYear', '==', selectedYear)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(studentFromDoc);
      setStudents(list);
    } catch (e: any) {
      console.error('Error fetching students:', e);
      toast({
        variant: 'destructive',
        title: 'ডাটা লোড ত্রুটি',
        description: 'শিক্ষার্থী তথ্য লোড করা যায়নি।',
      });
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStudents();
  }, [db, selectedYear]);

  // Compute fee summary: assume monthly fee is present or default to 500
  const studentFeeStats = useMemo(() => {
    return students.map((s) => {
      const monthly = s.monthlyFee || 500;
      // Balance is negative if due, or positive if advance, or 0
      const due = (s.balance !== undefined && s.balance < 0) ? Math.abs(s.balance) : 0;
      const advance = (s.balance !== undefined && s.balance > 0) ? s.balance : 0;
      return {
        student: s,
        monthlyFee: monthly,
        dueAmount: due,
        advanceAmount: advance,
        hasDue: due > 0,
      };
    });
  }, [students]);

  // Filter students
  const filteredList = useMemo(() => {
    return studentFeeStats.filter((item) => {
      const s = item.student;
      const matchClass = selectedClass === 'all' || String(s.className) === selectedClass;
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        String(s.roll) === q ||
        (s.studentNameBn || '').toLowerCase().includes(q) ||
        (s.studentNameEn || '').toLowerCase().includes(q) ||
        (s.guardianMobile || '').includes(q);

      return matchClass && matchSearch;
    });
  }, [studentFeeStats, selectedClass, searchQuery]);

  // Totals
  const totalDueSum = useMemo(() => {
    return filteredList.reduce((acc, curr) => acc + curr.dueAmount, 0);
  }, [filteredList]);

  const totalAdvanceSum = useMemo(() => {
    return filteredList.reduce((acc, curr) => acc + curr.advanceAmount, 0);
  }, [filteredList]);

  const exportToExcel = () => {
    const data = filteredList.map((item, idx) => ({
      'ক্রমিক': idx + 1,
      'রোল': item.student.roll,
      'শ্রেণি': item.student.className,
      'শিক্ষার্থীর নাম': item.student.studentNameBn,
      'পিতার নাম': item.student.fatherNameBn,
      'অভিভাবকের মোবাইল': item.student.guardianMobile || item.student.studentMobile || '',
      'মাসিক ফি (৳)': item.monthlyFee,
      'বকেয়া পরিমাণ (৳)': item.dueAmount,
      'অগ্রিম জমা (৳)': item.advanceAmount,
    }));

    const ws = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Fee_Report');
    XLSX.writeFile(wb, `Fee_Due_Report_${selectedClass}_${selectedYear}.xlsx`);
  };

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 font-kalpurush">
      {/* Top Header */}
      <div className="bg-gradient-to-r from-emerald-700 via-teal-800 to-indigo-900 text-white p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <CreditCard className="h-6 w-6 text-emerald-300" />
            </span>
            <h1 className="text-xl md:text-2xl font-black">ফি বকেয়া ও আদায় কেন্দ্রীয় রিপোর্ট</h1>
            <Badge variant="outline" className="bg-white/20 text-white border-white/40 text-xs font-bold">
              {toBn(selectedYear)} সেশন
            </Badge>
          </div>
          <p className="text-xs md:text-sm text-emerald-100 font-bold">
            {institutionName} • শ্রেণিভিত্তিক বকেয়া তালিকা, রসিদ এন্ট্রি ও এক্সেল ডাউনলোড
          </p>
        </div>

        <div className="flex items-center gap-2 no-print">
          <Button
            onClick={() => window.print()}
            variant="outline"
            size="sm"
            className="bg-white/10 hover:bg-white/20 text-white border-white/30 font-bold"
          >
            <Printer className="h-4 w-4 mr-1.5" /> প্রিন্ট
          </Button>
          <Button
            onClick={exportToExcel}
            size="sm"
            className="bg-emerald-500 hover:bg-emerald-600 text-white font-black"
          >
            <Download className="h-4 w-4 mr-1.5" /> Excel ডাউনলোড
          </Button>
          <Link href="/accounts">
            <Button variant="outline" size="sm" className="bg-white text-emerald-950 hover:bg-emerald-50 font-black border-0">
              <ArrowLeft className="h-4 w-4 mr-1" /> হিসাব শাখা
            </Button>
          </Link>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Card className="border-2 border-indigo-200 bg-white rounded-2xl shadow-sm">
          <CardHeader className="p-3.5 pb-2">
            <CardTitle className="text-xs font-black text-indigo-900">মোট শিক্ষার্থী</CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-2xl font-black text-indigo-950">{toBn(filteredList.length)} জন</div>
            <p className="text-[11px] text-indigo-600 font-bold">বর্তমান ফিল্টারে প্রদর্শিত</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-rose-200 bg-white rounded-2xl shadow-sm">
          <CardHeader className="p-3.5 pb-2">
            <CardTitle className="text-xs font-black text-rose-900">মোট বকেয়া পরিমাণ</CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-2xl font-black text-rose-700">৳ {toBn(totalDueSum)}</div>
            <p className="text-[11px] text-rose-500 font-bold">আদায়যোগ্য মোট বকেয়া</p>
          </CardContent>
        </Card>

        <Card className="border-2 border-emerald-200 bg-white rounded-2xl shadow-sm">
          <CardHeader className="p-3.5 pb-2">
            <CardTitle className="text-xs font-black text-emerald-900">মোট অগ্রিম জমা</CardTitle>
          </CardHeader>
          <CardContent className="p-3.5 pt-0">
            <div className="text-2xl font-black text-emerald-700">৳ {toBn(totalAdvanceSum)}</div>
            <p className="text-[11px] text-emerald-600 font-bold">শিক্ষার্থীদের অগ্রিম প্রদান</p>
          </CardContent>
        </Card>
      </div>

      {/* Filters and Search Bar */}
      <Card className="border border-slate-200 shadow-sm rounded-2xl bg-white p-3 no-print">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs font-black text-slate-700 whitespace-nowrap">শ্রেণি ফিল্টার:</span>
            <Select value={selectedClass} onValueChange={setSelectedClass}>
              <SelectTrigger className="w-36 h-9 font-bold text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CLASS_LIST.map((c) => (
                  <SelectItem key={c.id} value={c.id} className="font-bold text-xs">
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative w-full sm:w-72">
            <Search className="h-4 w-4 absolute left-2.5 top-2.5 text-slate-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="রোল, নাম বা মোবাইল দিয়ে খুঁজুন..."
              className="pl-8 h-9 text-xs font-bold"
            />
          </div>
        </div>
      </Card>

      {/* Report Table */}
      <Card className="border-2 border-slate-200 shadow-md rounded-2xl bg-white overflow-hidden">
        <CardContent className="p-0">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-black border-b border-slate-200">
                  <th className="p-3 w-16 text-center">রোল</th>
                  <th className="p-3 w-20 text-center">শ্রেণি</th>
                  <th className="p-3">শিক্ষার্থীর নাম</th>
                  <th className="p-3">পিতার নাম</th>
                  <th className="p-3">অভিভাবকের মোবাইল</th>
                  <th className="p-3 text-right">মাসিক ফি</th>
                  <th className="p-3 text-right">বকেয়া</th>
                  <th className="p-3 text-right">অগ্রিম</th>
                  <th className="p-3 text-center no-print">অ্যাকশন</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredList.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="p-8 text-center text-slate-500 font-bold">
                      কোনো তথ্য পাওয়া যায়নি।
                    </td>
                  </tr>
                ) : (
                  filteredList.map((item) => {
                    const s = item.student;
                    return (
                      <tr key={s.id} className="hover:bg-slate-50/80 transition-colors">
                        <td className="p-3 text-center font-black text-indigo-950">{toBn(s.roll)}</td>
                        <td className="p-3 text-center font-bold text-slate-700">{toBn(s.className)} শ্রেণি</td>
                        <td className="p-3 font-black text-slate-900">{s.studentNameBn}</td>
                        <td className="p-3 text-slate-600 font-bold">{s.fatherNameBn || '-'}</td>
                        <td className="p-3 text-slate-600 font-bold">
                          {s.guardianMobile || s.studentMobile ? (
                            <span className="flex items-center gap-1 text-slate-700 font-bold">
                              <Phone className="h-3 w-3 text-emerald-600" />
                              {s.guardianMobile || s.studentMobile}
                            </span>
                          ) : (
                            '-'
                          )}
                        </td>
                        <td className="p-3 text-right font-black text-slate-800">৳ {toBn(item.monthlyFee)}</td>
                        <td className="p-3 text-right font-black text-rose-600">
                          {item.dueAmount > 0 ? `৳ ${toBn(item.dueAmount)}` : '০'}
                        </td>
                        <td className="p-3 text-right font-black text-emerald-600">
                          {item.advanceAmount > 0 ? `৳ ${toBn(item.advanceAmount)}` : '০'}
                        </td>
                        <td className="p-2 text-center no-print">
                          <Button
                            size="sm"
                            onClick={() => setQuickFeeStudent(s)}
                            className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-[11px] h-7 px-3 rounded-lg"
                          >
                            ফি আদায়
                          </Button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>

      {/* Quick Fee Collection Dialog */}
      {quickFeeStudent && (
        <StudentFeeDialog
          student={quickFeeStudent}
          open={!!quickFeeStudent}
          onOpenChange={(o) => !o && setQuickFeeStudent(null)}
          onFeeCollected={() => {
            loadStudents();
          }}
        />
      )}
    </div>
  );
}

'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { useFirestore, useUser } from '@/firebase';
import { collection, query, where, getDocs, doc, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { 
  GraduationCap, 
  ArrowRight, 
  CheckCircle2, 
  Loader2, 
  Users, 
  Sparkles, 
  AlertCircle,
  ArrowUpRight,
  ShieldCheck,
  RefreshCw,
  Search
} from 'lucide-react';
import Link from 'next/link';

const CLASS_LIST = [
  { id: '6', label: '৬ষ্ঠ শ্রেণি', next: '7' },
  { id: '7', label: '৭ম শ্রেণি', next: '8' },
  { id: '8', label: '৮ম শ্রেণি', next: '9' },
  { id: '9', label: '৯ম শ্রেণি', next: '10' },
  { id: '10', label: '১০ম শ্রেণি', next: 'passed' },
];

const CLASS_LABELS: Record<string, string> = {
  '6': '৬ষ্ঠ শ্রেণি',
  '7': '৭ম শ্রেণি',
  '8': '৮ম শ্রেণি',
  '9': '৯ম শ্রেণি',
  '10': '১০ম শ্রেণি',
  'passed': 'এসএসসি উত্তীর্ণ (প্রাক্তন)',
};

const toBn = (str: string | number | undefined | null) => {
  if (str === undefined || str === null) return '';
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bn[parseInt(w, 10)]);
};

export default function StudentPromotionPage() {
  const db = useFirestore();
  const { user } = useUser();
  const { selectedYear, availableYears } = useAcademicYear();
  const { toast } = useToast();

  const [fromYear, setFromYear] = useState<string>(selectedYear || '2026');
  const [fromClass, setFromClass] = useState<string>('7');
  const [toYear, setToYear] = useState<string>(String(Number(selectedYear || 2026) + 1));
  const [toClass, setToClass] = useState<string>('8');

  const [students, setStudents] = useState<Student[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [selectedStudentIds, setSelectedStudentIds] = useState<Set<string>>(new Set());
  const [newRolls, setNewRolls] = useState<Record<string, number>>({});
  const [promoting, setPromoting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');

  // Update target class automatically when source class changes
  useEffect(() => {
    const found = CLASS_LIST.find((c) => c.id === fromClass);
    if (found && found.next) {
      setToClass(found.next);
    }
  }, [fromClass]);

  // Update target year when source year changes
  useEffect(() => {
    const nextY = String(Number(fromYear) + 1);
    setToYear(nextY);
  }, [fromYear]);

  // Fetch students for selected year and class
  const fetchStudents = async () => {
    if (!db) return;
    setLoadingStudents(true);
    try {
      const q = query(
        collection(db, 'students'),
        where('academicYear', '==', fromYear),
        where('className', '==', fromClass)
      );
      const snapshot = await getDocs(q);
      const list = snapshot.docs.map(studentFromDoc).sort((a, b) => (a.roll || 0) - (b.roll || 0));
      setStudents(list);

      // Select all by default and initialize rolls
      const allIds = new Set<string>();
      const initialRolls: Record<string, number> = {};
      list.forEach((s, idx) => {
        allIds.add(s.id);
        initialRolls[s.id] = idx + 1; // Default incremental roll in new class
      });
      setSelectedStudentIds(allIds);
      setNewRolls(initialRolls);
    } catch (err: any) {
      console.error('Fetch error:', err);
      toast({
        variant: 'destructive',
        title: 'ত্রুটি',
        description: 'শিক্ষার্থী তালিকা লোড করা যায়নি।',
      });
    } finally {
      setLoadingStudents(false);
    }
  };

  useEffect(() => {
    fetchStudents();
  }, [db, fromYear, fromClass]);

  // Toggle selection
  const handleToggleSelectAll = (checked: boolean) => {
    if (checked) {
      setSelectedStudentIds(new Set(students.map((s) => s.id)));
    } else {
      setSelectedStudentIds(new Set());
    }
  };

  const handleToggleStudent = (id: string) => {
    const next = new Set(selectedStudentIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedStudentIds(next);
  };

  // Perform Promotion
  const handlePromoteBatch = async () => {
    if (!db || selectedStudentIds.size === 0) return;
    setPromoting(true);

    try {
      let successCount = 0;
      const studentsToPromote = students.filter((s) => selectedStudentIds.has(s.id));

      for (const s of studentsToPromote) {
        const targetRoll = newRolls[s.id] || s.roll;
        const newRef = doc(collection(db, 'students'));

        // 1. Create a promoted copy for next year preserving all personal data
        await setDoc(newRef, {
          roll: targetRoll,
          className: toClass,
          academicYear: toYear,
          studentNameBn: s.studentNameBn,
          studentNameEn: s.studentNameEn || '',
          fatherNameBn: s.fatherNameBn,
          fatherNameEn: s.fatherNameEn || '',
          motherNameBn: s.motherNameBn,
          motherNameEn: s.motherNameEn || '',
          dob: s.dob || null,
          birthRegNo: s.birthRegNo || '',
          guardianMobile: s.guardianMobile || '',
          studentMobile: s.studentMobile || '',
          gender: s.gender || 'male',
          religion: s.religion || '',
          group: s.group || '',
          presentVillage: s.presentVillage || '',
          presentUpazila: s.presentUpazila || '',
          presentDistrict: s.presentDistrict || '',
          permanentVillage: s.permanentVillage || '',
          permanentUpazila: s.permanentUpazila || '',
          permanentDistrict: s.permanentDistrict || '',
          photoUrl: s.photoUrl || '',
          balance: 0, // Reset balance in new year
          previousSchool: `টপ গ্রেড টিউটোরিয়ালস (${fromYear} সেশন - শ্রেণি ${fromClass})`,
          _promotedFromId: s.id,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        // 2. Mark previous record as promoted without deleting it
        const oldRef = doc(db, 'students', s.id);
        await updateDoc(oldRef, {
          _promoStatus: `promoted_to_${toClass}_${toYear}`,
          updatedAt: serverTimestamp(),
        });

        successCount++;
      }

      toast({
        title: 'প্রমোশন সফল! 🎉',
        description: `মোট ${toBn(successCount)} জন শিক্ষার্থীকে ${toYear} শিক্ষাবর্ষের ${CLASS_LABELS[toClass] || toClass}-এ উন্নীত করা হয়েছে।`,
      });

      // Refresh list
      fetchStudents();
    } catch (e: any) {
      console.error('Promotion error:', e);
      toast({
        variant: 'destructive',
        title: 'প্রমোশন ব্যর্থ হয়েছে',
        description: e.message || 'অনুগ্রহ করে পুনরায় চেষ্টা করুন।',
      });
    } finally {
      setPromoting(false);
    }
  };

  const filteredList = useMemo(() => {
    if (!searchTerm.trim()) return students;
    const q = searchTerm.toLowerCase();
    return students.filter(
      (s) =>
        (s.studentNameBn || '').toLowerCase().includes(q) ||
        (s.studentNameEn || '').toLowerCase().includes(q) ||
        String(s.roll).includes(q)
    );
  }, [students, searchTerm]);

  return (
    <div className="p-3 sm:p-5 max-w-7xl mx-auto space-y-4 font-kalpurush">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-emerald-600 via-teal-700 to-indigo-800 text-white p-5 rounded-2xl shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span className="p-2 bg-white/20 rounded-xl backdrop-blur-sm">
              <GraduationCap className="h-6 w-6 text-amber-300" />
            </span>
            <h1 className="text-xl md:text-2xl font-black">বার্ষিক প্রমোশন ও শ্রেণি উন্নীতি উইজার্ড</h1>
            <Badge variant="outline" className="bg-white/20 text-white border-white/40 text-xs font-bold">
              নিরাপদ অটোমেশন
            </Badge>
          </div>
          <p className="text-xs md:text-sm text-emerald-100 font-bold max-w-2xl">
            কোনো পূর্ববর্তী ডাটা না মুছে এক ক্লিকে এক শিক্ষাবর্ষের উত্তীর্ণ শিক্ষার্থীদের পরবর্তী শিক্ষাবর্ষ ও শ্রেণিতে স্বয়ংক্রিয়ভাবে উন্নীত করুন।
          </p>
        </div>
        <Link href="/student-list">
          <Button variant="outline" size="sm" className="bg-white text-emerald-900 hover:bg-emerald-50 font-black border-0">
            শিক্ষার্থী তালিকায় ফিরে যান
          </Button>
        </Link>
      </div>

      {/* Control Panel: Source and Destination Selector */}
      <Card className="border-2 border-emerald-200 shadow-md rounded-2xl bg-white overflow-hidden">
        <CardHeader className="p-4 bg-emerald-50/60 border-b border-emerald-100">
          <CardTitle className="text-base font-black text-emerald-950 flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald-600" /> প্রমোশন পরামিতি নির্ধারণ
          </CardTitle>
          <CardDescription className="text-xs text-slate-600 font-medium">
            বর্তমান শ্রেণি থেকে যে শিক্ষাবর্ষ ও শ্রেণিতে শিক্ষার্থীদের স্থানান্তর করতে চান তা নির্ধারণ করুন।
          </CardDescription>
        </CardHeader>
        <CardContent className="p-4 grid grid-cols-1 md:grid-cols-5 gap-3 items-center">
          {/* Source Year & Class */}
          <div className="md:col-span-2 p-3 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
            <span className="text-xs font-black text-slate-700 block">বর্তমান অবস্থান (Source)</span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-slate-500">শিক্ষাবর্ষ</label>
                <Select value={fromYear} onValueChange={setFromYear}>
                  <SelectTrigger className="h-9 font-black text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {availableYears.map((y) => (
                      <SelectItem key={y} value={y} className="font-bold text-xs">
                        {toBn(y)} সেশন
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <label className="text-[11px] font-bold text-slate-500">বর্তমান শ্রেণি</label>
                <Select value={fromClass} onValueChange={setFromClass}>
                  <SelectTrigger className="h-9 font-black text-xs">
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
            </div>
          </div>

          {/* Direction Indicator */}
          <div className="flex flex-col items-center justify-center text-center">
            <div className="p-2.5 bg-emerald-100 text-emerald-700 rounded-full shadow-inner hidden md:block">
              <ArrowRight className="h-5 w-5" />
            </div>
            <span className="text-[10px] font-black text-emerald-700 mt-1">উন্নীত হবে</span>
          </div>

          {/* Target Year & Class */}
          <div className="md:col-span-2 p-3 bg-emerald-50/70 border border-emerald-200 rounded-xl space-y-2">
            <span className="text-xs font-black text-emerald-900 block flex items-center justify-between">
              <span>গন্তব্য অবস্থান (Destination)</span>
              <Badge variant="outline" className="bg-emerald-600 text-white text-[10px]">
                পরবর্তী সেশন
              </Badge>
            </span>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="text-[11px] font-bold text-emerald-800">পরবর্তী শিক্ষাবর্ষ</label>
                <Input
                  value={toYear}
                  onChange={(e) => setToYear(e.target.value)}
                  className="h-9 font-black text-xs bg-white border-emerald-300"
                  placeholder="যেমন: 2027"
                />
              </div>
              <div>
                <label className="text-[11px] font-bold text-emerald-800">উন্নীত শ্রেণি</label>
                <Select value={toClass} onValueChange={setToClass}>
                  <SelectTrigger className="h-9 font-black text-xs bg-white border-emerald-300">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASS_LIST.map((c) => (
                      <SelectItem key={c.id} value={c.id} className="font-bold text-xs">
                        {c.label}
                      </SelectItem>
                    ))}
                    <SelectItem value="passed" className="font-bold text-xs">
                      এসএসসি উত্তীর্ণ
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Student Selection Table */}
      <Card className="border-2 border-indigo-200 shadow-md rounded-2xl bg-white overflow-hidden">
        <CardHeader className="p-4 bg-indigo-50/50 border-b border-indigo-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <CardTitle className="text-base font-black text-indigo-950 flex items-center gap-2">
              <Users className="h-4 w-4 text-indigo-600" /> 
              {CLASS_LABELS[fromClass] || fromClass} ({toBn(fromYear)} সেশন) - শিক্ষার্থী তালিকা
            </CardTitle>
            <CardDescription className="text-xs text-slate-600 font-bold">
              মোট শিক্ষার্থী: {toBn(students.length)} জন | নির্বাচিত: {toBn(selectedStudentIds.size)} জন
            </CardDescription>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative w-44 sm:w-56">
              <Search className="h-3.5 w-3.5 absolute left-2.5 top-3 text-slate-400" />
              <Input
                placeholder="নাম বা রোল দিয়ে খুঁজুন..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs font-bold"
              />
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchStudents}
              disabled={loadingStudents}
              className="h-9 px-2.5"
              title="তাজা করুন"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loadingStudents ? 'animate-spin' : ''}`} />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="p-0">
          {loadingStudents ? (
            <div className="p-12 text-center text-indigo-600 flex flex-col items-center gap-2">
              <Loader2 className="h-8 w-8 animate-spin" />
              <span className="font-bold text-sm">শিক্ষার্থীদের তথ্য লোড হচ্ছে...</span>
            </div>
          ) : students.length === 0 ? (
            <div className="p-10 text-center text-slate-500">
              <AlertCircle className="h-8 w-8 mx-auto text-amber-500 mb-2" />
              <p className="font-black text-sm">এই শিক্ষাবর্ষ ও শ্রেণিতে কোনো শিক্ষার্থী পাওয়া যায়নি।</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-slate-100/80 text-slate-700 font-black border-b border-slate-200">
                    <th className="p-3 w-10 text-center">
                      <Checkbox
                        checked={selectedStudentIds.size === students.length && students.length > 0}
                        onCheckedChange={handleToggleSelectAll}
                      />
                    </th>
                    <th className="p-3 w-20 text-center">বর্তমান রোল</th>
                    <th className="p-3">শিক্ষার্থীর নাম</th>
                    <th className="p-3">পিতার নাম</th>
                    <th className="p-3">মোবাইল</th>
                    <th className="p-3 w-28 text-center text-emerald-800 bg-emerald-50/70 border-x border-emerald-200">
                      পরবর্তী রোল ({toBn(toYear)})
                    </th>
                    <th className="p-3 text-center w-28">বর্তমান স্ট্যাটাস</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {filteredList.map((s, index) => {
                    const isSelected = selectedStudentIds.has(s.id);
                    const isAlreadyPromoted = s._promoStatus && String(s._promoStatus).startsWith('promoted');

                    return (
                      <tr
                        key={s.id}
                        className={`hover:bg-indigo-50/40 transition-colors ${
                          isSelected ? 'bg-indigo-50/20' : ''
                        }`}
                      >
                        <td className="p-3 text-center">
                          <Checkbox
                            checked={isSelected}
                            onCheckedChange={() => handleToggleStudent(s.id)}
                          />
                        </td>
                        <td className="p-3 text-center font-black text-indigo-950">{toBn(s.roll)}</td>
                        <td className="p-3 font-black text-slate-900">
                          {s.studentNameBn || s.studentNameEn}
                          {s.group && (
                            <span className="ml-1.5 text-[10px] text-indigo-600 bg-indigo-50 px-1.5 py-0.5 rounded font-bold">
                              {s.group}
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 font-bold">{s.fatherNameBn || '-'}</td>
                        <td className="p-3 text-slate-500 font-bold">{s.guardianMobile || s.studentMobile || '-'}</td>
                        <td className="p-2 text-center bg-emerald-50/40 border-x border-emerald-200">
                          <Input
                            type="number"
                            value={newRolls[s.id] ?? (index + 1)}
                            onChange={(e) =>
                              setNewRolls((prev) => ({
                                ...prev,
                                [s.id]: parseInt(e.target.value) || 0,
                              }))
                            }
                            className="h-7 w-20 text-center mx-auto font-black text-xs bg-white border-emerald-300"
                          />
                        </td>
                        <td className="p-3 text-center">
                          {isAlreadyPromoted ? (
                            <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold">
                              উন্নীত সম্পন্ন
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="bg-slate-50 text-slate-600 border-slate-200 text-[10px] font-bold">
                              প্রস্তুত
                            </Badge>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>

        {/* Footer Actions */}
        <div className="p-4 bg-slate-50 border-t border-slate-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-600">
            <ShieldCheck className="h-4 w-4 text-emerald-600" />
            <span>পূর্ববর্তী শিক্ষাবর্ষের সকল মার্কশিট, হাজিরা ও ফি রেকর্ড অক্ষুণ্ণ থাকবে।</span>
          </div>

          <Button
            onClick={handlePromoteBatch}
            disabled={promoting || selectedStudentIds.size === 0}
            className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white font-black text-sm h-10 px-6 shadow-md"
          >
            {promoting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" /> প্রমোশন প্রক্রিয়াধীন...
              </>
            ) : (
              <>
                <CheckCircle2 className="h-4 w-4 mr-2" />
                নির্বাচিত {toBn(selectedStudentIds.size)} জনকে {CLASS_LABELS[toClass] || toClass}-এ উন্নীত করুন
              </>
            )}
          </Button>
        </div>
      </Card>
    </div>
  );
}

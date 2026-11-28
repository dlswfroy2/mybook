'use client';

import React, { useState, useMemo, useCallback } from 'react';
import { Student } from '@/lib/student-data';
import { useFirestore } from '@/firebase';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { 
  Phone, 
  PhoneCall, 
  MessageSquare, 
  Search, 
  Edit3, 
  Copy, 
  Check, 
  Smartphone, 
  Users, 
  ExternalLink,
  PlusCircle,
  Save,
  Loader2,
  CheckCircle2,
  Filter
} from 'lucide-react';
import { cn } from '@/lib/utils';

interface PhoneBookTabProps {
  allStudents: Student[];
  selectedYear: string;
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

// Clean phone number for WhatsApp and Dialing
function cleanPhoneNumber(phone?: string): string {
  if (!phone) return '';
  // Remove non-digit chars
  const digits = phone.replace(/\D/g, '');
  // If starts with 880, return as is
  if (digits.startsWith('880')) return digits;
  // If starts with 01, add 88
  if (digits.startsWith('01')) return '88' + digits;
  return digits;
}

export function PhoneBookTab({ allStudents, selectedYear }: PhoneBookTabProps) {
  const db = useFirestore();
  const { toast } = useToast();

  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClass, setSelectedClass] = useState<string>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Edit / Add Phone Dialog state
  const [editingStudent, setEditingStudent] = useState<Student | null>(null);
  const [guardianMobile, setGuardianMobile] = useState('');
  const [studentMobile, setStudentMobile] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  // Filter and sort students for current academic year
  const filteredStudents = useMemo(() => {
    return allStudents
      .filter((student) => {
        const matchesYear = !student.academicYear || student.academicYear === selectedYear;
        const matchesClass = selectedClass === 'all' || student.className === selectedClass;
        
        if (!matchesYear || !matchesClass) return false;
        if (!searchQuery.trim()) return true;

        const q = searchQuery.toLowerCase().trim();
        const nameBn = (student.studentNameBn || '').toLowerCase();
        const nameEn = (student.studentNameEn || '').toLowerCase();
        const roll = String(student.roll || '');
        const gMob = (student.guardianMobile || '').toLowerCase();
        const sMob = (student.studentMobile || '').toLowerCase();

        return nameBn.includes(q) || nameEn.includes(q) || roll.includes(q) || gMob.includes(q) || sMob.includes(q);
      })
      .sort((a, b) => {
        if (a.className !== b.className) {
          return (Number(a.className) || 0) - (Number(b.className) || 0);
        }
        return (Number(a.roll) || 0) - (Number(b.roll) || 0);
      });
  }, [allStudents, selectedYear, selectedClass, searchQuery]);

  // Statistics
  const stats = useMemo(() => {
    const total = filteredStudents.length;
    const withPhone = filteredStudents.filter(s => s.guardianMobile || s.studentMobile).length;
    const missingPhone = total - withPhone;
    return { total, withPhone, missingPhone };
  }, [filteredStudents]);

  const handleCopy = (number: string, id: string) => {
    if (!number) return;
    navigator.clipboard.writeText(number);
    setCopiedId(id);
    toast({ title: 'নম্বর কপি করা হয়েছে', description: number });
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenEdit = (student: Student) => {
    setEditingStudent(student);
    setGuardianMobile(student.guardianMobile || '');
    setStudentMobile(student.studentMobile || '');
  };

  const handleSavePhone = async () => {
    if (!editingStudent || !db) return;
    setIsSaving(true);
    try {
      const studentRef = doc(db, 'students', editingStudent.id);
      await updateDoc(studentRef, {
        guardianMobile: guardianMobile.trim(),
        studentMobile: studentMobile.trim(),
        updatedAt: serverTimestamp()
      });

      toast({
        title: 'সফলভাবে সংরক্ষিত',
        description: `${editingStudent.studentNameBn}-এর ফোন নম্বর তথ্যভাণ্ডারে আপডেট করা হয়েছে।`
      });

      setEditingStudent(null);
    } catch (err: any) {
      console.error('Failed to update phone number:', err);
      toast({
        variant: 'destructive',
        title: 'সংরক্ষণ ব্যর্থ হয়েছে',
        description: 'অনুমতি বা নেটওয়ার্ক সমস্যা দেখা দিয়েছে।'
      });
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-300">
      {/* Top Header Card */}
      <Card className="border-2 border-primary/20 shadow-xl bg-gradient-to-br from-indigo-50/70 via-white to-blue-50/50 overflow-hidden">
        <CardHeader className="pb-3 border-b border-indigo-100/80">
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-3">
            <div>
              <CardTitle className="text-2xl font-black text-slate-800 flex items-center gap-2.5">
                <div className="p-2 rounded-xl bg-primary text-white shadow-md">
                  <Smartphone className="h-6 w-6" />
                </div>
                <span>শিক্ষার্থী ফোন বুক ও কমিউনিকেশন</span>
              </CardTitle>
              <CardDescription className="text-xs font-bold text-slate-600 mt-1">
                শিক্ষার্থী তালিকা থেকে স্বয়ংক্রিয়ভাবে সিঙ্ক হওয়া ফোন ডিরেক্টরি — এক ক্লিকে কল, এসএমএস ও হোয়াটসঅ্যাপ করুন।
              </CardDescription>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="outline" className="bg-emerald-50 text-emerald-800 border-emerald-300 font-black px-3 py-1 text-xs">
                নম্বরযুক্ত: {toBengaliNumber(stats.withPhone)} জন
              </Badge>
              {stats.missingPhone > 0 && (
                <Badge variant="outline" className="bg-amber-50 text-amber-800 border-amber-300 font-black px-3 py-1 text-xs">
                  নম্বরহীন: {toBengaliNumber(stats.missingPhone)} জন
                </Badge>
              )}
            </div>
          </div>
        </CardHeader>
        
        <CardContent className="pt-4 pb-4">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-center">
            {/* Search Box */}
            <div className="relative md:col-span-7">
              <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
              <Input
                placeholder="শিক্ষার্থীর নাম, রোল বা ফোন নম্বর দিয়ে খুঁজুন..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 h-10 border-slate-300 bg-white shadow-sm font-bold text-sm focus:border-primary"
              />
            </div>

            {/* Class Filter */}
            <div className="md:col-span-5 flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none">
              <Button
                size="sm"
                variant={selectedClass === 'all' ? 'default' : 'outline'}
                onClick={() => setSelectedClass('all')}
                className={cn(
                  "font-black text-xs h-9 px-3 shrink-0 rounded-lg transition-all",
                  selectedClass === 'all' ? "bg-primary text-white shadow-md" : "bg-white hover:bg-slate-100 text-slate-700"
                )}
              >
                সব শ্রেণি ({toBengaliNumber(allStudents.filter(s => !s.academicYear || s.academicYear === selectedYear).length)})
              </Button>
              {['6', '7', '8', '9', '10'].map((cls) => {
                const count = allStudents.filter(s => (!s.academicYear || s.academicYear === selectedYear) && s.className === cls).length;
                return (
                  <Button
                    key={cls}
                    size="sm"
                    variant={selectedClass === cls ? 'default' : 'outline'}
                    onClick={() => setSelectedClass(cls)}
                    className={cn(
                      "font-black text-xs h-9 px-3 shrink-0 rounded-lg transition-all",
                      selectedClass === cls ? "bg-primary text-white shadow-md" : "bg-white hover:bg-slate-100 text-slate-700"
                    )}
                  >
                    {classNamesMap[cls] || `${toBengaliNumber(cls)}ম`} ({toBengaliNumber(count)})
                  </Button>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Main Table / Directory List */}
      <Card className="border shadow-lg rounded-2xl overflow-hidden bg-white">
        <div className="overflow-x-auto">
          <Table>
            <TableHeader className="bg-slate-100/80 border-b">
              <TableRow className="h-12">
                <TableHead className="font-black text-slate-800 w-16 text-center">রোল</TableHead>
                <TableHead className="font-black text-slate-800">শিক্ষার্থীর নাম</TableHead>
                <TableHead className="font-black text-slate-800 text-center">শ্রেণি</TableHead>
                <TableHead className="font-black text-slate-800">পিতার নাম / অভিভাবক</TableHead>
                <TableHead className="font-black text-slate-800">অভিভাবকের মোবাইল</TableHead>
                <TableHead className="font-black text-slate-800">শিক্ষার্থীর মোবাইল</TableHead>
                <TableHead className="font-black text-slate-800 text-center w-48">দ্রুত যোগাযোগ (ক্লিক করুন)</TableHead>
                <TableHead className="font-black text-slate-800 text-right pr-4 w-24">অ্যাকশন</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredStudents.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={8} className="text-center py-16 text-slate-500 font-bold">
                    <Users className="h-10 w-10 mx-auto text-slate-300 mb-2" />
                    কোনো শিক্ষার্থীর তথ্য পাওয়া যায়নি।
                  </TableCell>
                </TableRow>
              ) : (
                filteredStudents.map((student) => {
                  const mainPhone = student.guardianMobile || student.studentMobile || '';
                  const cleanMain = cleanPhoneNumber(mainPhone);
                  const hasPhone = Boolean(mainPhone);

                  return (
                    <TableRow key={student.id} className="h-14 hover:bg-slate-50/80 transition-colors">
                      {/* Roll */}
                      <TableCell className="font-black text-center text-primary text-base">
                        {toBengaliNumber(student.roll)}
                      </TableCell>

                      {/* Name */}
                      <TableCell className="font-black text-slate-800">
                        <div>
                          <span>{student.studentNameBn}</span>
                          {student.studentNameEn && (
                            <span className="block text-[11px] text-slate-400 font-normal">
                              {student.studentNameEn}
                            </span>
                          )}
                        </div>
                      </TableCell>

                      {/* Class */}
                      <TableCell className="text-center">
                        <Badge variant="secondary" className="font-bold text-[11px] px-2 py-0.5">
                          {classNamesMap[student.className] || `${toBengaliNumber(student.className)}ম`}
                        </Badge>
                      </TableCell>

                      {/* Father / Guardian */}
                      <TableCell className="font-bold text-xs text-slate-600">
                        {student.fatherNameBn || '—'}
                      </TableCell>

                      {/* Guardian Mobile */}
                      <TableCell>
                        {student.guardianMobile ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-slate-800">
                              {student.guardianMobile}
                            </span>
                            <button
                              onClick={() => handleCopy(student.guardianMobile!, `g-${student.id}`)}
                              className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
                              title="নম্বর কপি করুন"
                            >
                              {copiedId === `g-${student.id}` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-rose-500 font-bold bg-rose-50 px-2 py-0.5 rounded">
                            যুক্ত নেই
                          </span>
                        )}
                      </TableCell>

                      {/* Student Mobile */}
                      <TableCell>
                        {student.studentMobile ? (
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-xs text-slate-700">
                              {student.studentMobile}
                            </span>
                            <button
                              onClick={() => handleCopy(student.studentMobile!, `s-${student.id}`)}
                              className="p-1 hover:bg-slate-200 rounded text-slate-500 hover:text-slate-800 transition"
                              title="নম্বর কপি করুন"
                            >
                              {copiedId === `s-${student.id}` ? (
                                <Check className="h-3.5 w-3.5 text-emerald-600" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-slate-400 font-medium">—</span>
                        )}
                      </TableCell>

                      {/* Quick Communication Actions (Call, SMS, WhatsApp) */}
                      <TableCell className="text-center">
                        {hasPhone ? (
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Direct Call Button */}
                            <a
                              href={`tel:${mainPhone}`}
                              className="inline-flex items-center justify-center p-2 rounded-lg bg-emerald-50 hover:bg-emerald-600 text-emerald-700 hover:text-white border border-emerald-200 transition-all shadow-sm"
                              title={`${mainPhone} নম্বরে সরাসরি কল করুন`}
                            >
                              <PhoneCall className="h-4 w-4" />
                            </a>

                            {/* Direct SMS Button */}
                            <a
                              href={`sms:${mainPhone}`}
                              className="inline-flex items-center justify-center p-2 rounded-lg bg-blue-50 hover:bg-blue-600 text-blue-700 hover:text-white border border-blue-200 transition-all shadow-sm"
                              title={`${mainPhone} নম্বরে সরাসরি এসএমএস পাঠান`}
                            >
                              <MessageSquare className="h-4 w-4" />
                            </a>

                            {/* WhatsApp Button */}
                            <a
                              href={`https://wa.me/${cleanMain}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center justify-center p-2 rounded-lg bg-green-50 hover:bg-green-600 text-green-700 hover:text-white border border-green-200 transition-all shadow-sm"
                              title={`${mainPhone} নম্বরে হোয়াটসঅ্যাপ চ্যাট খুলুন`}
                            >
                              <span className="text-xs font-black">WA</span>
                            </a>
                          </div>
                        ) : (
                          <Button
                            size="sm"
                            variant="ghost"
                            onClick={() => handleOpenEdit(student)}
                            className="text-xs text-primary font-bold hover:bg-primary/10 h-8"
                          >
                            + নম্বর যোগ করুন
                          </Button>
                        )}
                      </TableCell>

                      {/* Edit Button */}
                      <TableCell className="text-right pr-4">
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleOpenEdit(student)}
                          className="h-8 px-2.5 font-bold text-xs border-slate-300 hover:bg-primary hover:text-white hover:border-primary transition-colors"
                          title="নম্বর এডিট বা পরিবর্তন করুন"
                        >
                          <Edit3 className="h-3.5 w-3.5 mr-1" />
                          এডিট
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

      {/* Edit / Add Phone Dialog */}
      <Dialog open={!!editingStudent} onOpenChange={(open) => !open && setEditingStudent(null)}>
        <DialogContent className="max-w-md font-kalpurush">
          <DialogHeader>
            <DialogTitle className="text-xl font-black text-slate-800 flex items-center gap-2">
              <Smartphone className="h-5 w-5 text-primary" />
              <span>ফোন নম্বর হালনাগাদ করুন</span>
            </DialogTitle>
            <DialogDescription className="text-xs font-bold text-slate-500">
              এখানে পরিবর্তিত নম্বর শিক্ষার্থীর মূল ডাটাবেস তথ্যভাণ্ডারে স্বয়ংক্রিয়ভাবে সেভ হবে।
            </DialogDescription>
          </DialogHeader>

          {editingStudent && (
            <div className="space-y-4 py-2">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <p className="font-black text-slate-800 text-sm">{editingStudent.studentNameBn}</p>
                <div className="flex gap-3 text-xs font-bold text-slate-500 mt-1">
                  <span>শ্রেণি: {classNamesMap[editingStudent.className] || editingStudent.className}</span>
                  <span>রোল: {toBengaliNumber(editingStudent.roll)}</span>
                  <span>পিতা: {editingStudent.fatherNameBn || '—'}</span>
                </div>
              </div>

              <div className="space-y-2">
                <Label className="font-black text-xs text-slate-700">অভিভাবকের মোবাইল নম্বর (প্রধান)</Label>
                <Input
                  type="tel"
                  placeholder="যেমন: 01700000000"
                  value={guardianMobile}
                  onChange={(e) => setGuardianMobile(e.target.value)}
                  className="font-mono font-bold text-base"
                />
              </div>

              <div className="space-y-2">
                <Label className="font-black text-xs text-slate-700">শিক্ষার্থীর নিজস্ব মোবাইল নম্বর (ঐচ্ছিক)</Label>
                <Input
                  type="tel"
                  placeholder="যেমন: 01800000000"
                  value={studentMobile}
                  onChange={(e) => setStudentMobile(e.target.value)}
                  className="font-mono font-bold text-base"
                />
              </div>
            </div>
          )}

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setEditingStudent(null)}
              disabled={isSaving}
              className="font-bold"
            >
              বাতিল
            </Button>
            <Button
              onClick={handleSavePhone}
              disabled={isSaving}
              className="font-black bg-primary text-white shadow-md"
            >
              {isSaving ? (
                <>
                  <Loader2 className="h-4 w-4 mr-1.5 animate-spin" />
                  সংরক্ষণ হচ্ছে...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-1.5" />
                  তথ্যভাণ্ডারে সেভ করুন
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

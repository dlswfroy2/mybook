
'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs, limit } from 'firebase/firestore';
import { studentFromDoc } from '@/lib/student-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useToast } from '@/hooks/use-toast';
import { Users, Search, Loader2, ArrowLeft, ShieldCheck } from 'lucide-react';
import Link from 'next/link';

const classNamesMap: Record<string, string> = {
  '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম'
};

export default function ParentsLoginPage() {
  const db = useFirestore();
  const { selectedYear } = useAcademicYear();
  const { toast } = useToast();
  const router = useRouter();

  const [roll, setRoll] = useState('');
  const [className, setClassName] = useState('');
  const [studentId, setStudentId] = useState('');
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!roll || !className || !studentId) {
      toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ' });
      return;
    }

    setLoading(true);
    try {
      const bnToEn = (str: string) => str.replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]);
      const rollNum = parseInt(bnToEn(roll), 10);
      const cleanId = bnToEn(studentId).trim().toUpperCase();

      const q = query(
        collection(db!, 'students'),
        where('academicYear', '==', selectedYear),
        where('className', '==', className),
        where('roll', '==', rollNum),
        where('generatedId', '==', cleanId),
        limit(1)
      );

      const snap = await getDocs(q);

      if (snap.empty) {
        toast({ variant: 'destructive', title: 'শিক্ষার্থী পাওয়া যায়নি', description: 'সঠিক তথ্য প্রদান করুন।' });
      } else {
        const student = studentFromDoc(snap.docs[0]);
        // Simple session simulation
        localStorage.setItem('parent_student_session', JSON.stringify(student));
        toast({ title: 'স্বাগতম!', description: 'প্যারেন্টস পোর্টালে সফলভাবে প্রবেশ করেছেন।' });
        router.push('/parents/dashboard');
      }
    } catch (e) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: 'পুনরায় চেষ্টা করুন।' });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-indigo-50 font-kalpurush flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-md border-t-4 border-t-primary shadow-2xl rounded-2xl overflow-hidden">
        <CardHeader className="bg-primary/5 text-center pb-8 pt-10">
          <div className="bg-primary w-16 h-16 rounded-2xl flex items-center justify-center text-white mx-auto mb-4 shadow-lg">
            <Users className="h-10 w-10" />
          </div>
          <CardTitle className="text-2xl font-black text-primary">অভিভাবক পোর্টাল</CardTitle>
          <CardDescription className="font-bold">আপনার সন্তানের তথ্য দেখতে লগইন করুন</CardDescription>
        </CardHeader>
        <CardContent className="p-8">
          <form onSubmit={handleLogin} className="space-y-5">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label className="font-black text-slate-700">শ্রেণি</Label>
                <Select value={className} onValueChange={setClassName} required>
                  <SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="সিলেক্ট" /></SelectTrigger>
                  <SelectContent className="font-kalpurush">
                    {Object.entries(classNamesMap).map(([id, label]) => (
                      <SelectItem key={id} value={id}>{label} শ্রেণি</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label className="font-black text-slate-700">রোল নম্বর</Label>
                <Input value={roll} onChange={e => setRoll(e.target.value)} required placeholder="উদা: ১" className="h-11 border-2 font-black text-lg" />
              </div>
            </div>
            <div className="space-y-2">
              <Label className="font-black text-slate-700">শিক্ষার্থী আইডি (Student ID)</Label>
              <Input value={studentId} onChange={e => setStudentId(e.target.value)} required placeholder="আইডি লিখুন (উদা: ২৬০৬০০০১)" className="h-11 border-2 font-black text-lg uppercase" />
            </div>

            <Button type="submit" className="w-full h-12 text-lg font-black bg-primary shadow-lg" disabled={loading}>
              {loading ? <Loader2 className="animate-spin mr-2" /> : <ShieldCheck className="mr-2" />} পোর্টালে প্রবেশ করুন
            </Button>
          </form>
        </CardContent>
        <div className="p-4 bg-slate-50 border-t flex justify-center">
            <Link href="/auth">
                <Button variant="ghost" size="sm" className="font-bold text-muted-foreground">
                    <ArrowLeft className="h-4 w-4 mr-2" /> মূল পাতায় ফিরে যান
                </Button>
            </Link>
        </div>
      </Card>
    </div>
  );
}

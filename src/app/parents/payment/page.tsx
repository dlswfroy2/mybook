'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { useFirestore } from '@/firebase';
import { collection, doc, setDoc, serverTimestamp } from 'firebase/firestore';
import { Student } from '@/lib/student-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useToast } from '@/hooks/use-toast';
import { 
  ArrowLeft, 
  Loader2, 
  CheckCircle2, 
  ShieldCheck, 
  CreditCard, 
  Landmark, 
  Smartphone, 
  AlertTriangle,
  Copy,
  Info
} from 'lucide-react';
import { cn } from '@/lib/utils';

const toBn = (str: string | number | undefined | null) => {
  if (str === undefined || str === null) return '';
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bn[parseInt(w, 10)]);
};

export default function OnlinePaymentPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { selectedYear } = useAcademicYear();
  const { schoolInfo } = useSchoolInfo();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [method, setMethod] = useState<'bkash' | 'nagad' | 'rocket'>('bkash');
  const [amount, setAmount] = useState('');
  const [senderMobile, setSenderMobile] = useState('');
  const [transactionId, setTransactionId] = useState('');
  const [description, setDescription] = useState('টিউশন ফি পরিশোধ');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  // Official school payment numbers (Fallback to default if not set in settings)
  const officialNumber = schoolInfo?.phone || '01700000000';

  useEffect(() => {
    const session = localStorage.getItem('parent_student_session');
    if (!session) {
      router.push('/parents/login');
      return;
    }
    setStudent(JSON.parse(session));
  }, [router]);

  const handleCopyNumber = () => {
    navigator.clipboard.writeText(officialNumber);
    toast({ title: 'নম্বর কপি করা হয়েছে! 📋', description: officialNumber });
  };

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !student || !amount || !transactionId.trim() || !senderMobile.trim()) {
      toast({
        variant: 'destructive',
        title: 'অসম্পূর্ণ তথ্য',
        description: 'টাকার পরিমাণ, প্রেরকের মোবাইল নম্বর এবং TrxID পূরণ করা বাধ্যতামূলক।',
      });
      return;
    }

    // Minimum TrxID validation check
    const cleanTrx = transactionId.trim().toUpperCase();
    if (cleanTrx.length < 6) {
      toast({
        variant: 'destructive',
        title: 'ভুল ট্রানজেকশন আইডি',
        description: 'অনুগ্রহ করে সঠিক এবং পূর্ণাঙ্গ TrxID লিখুন।',
      });
      return;
    }

    setIsLoading(true);
    try {
      const payAmount = parseFloat(amount);
      const reqRef = doc(collection(db, 'feePaymentRequests'));

      // SECURITY: Instead of auto-crediting and reducing balance immediately without payment verification,
      // save a verified payment submission request for School Admin to approve.
      await setDoc(reqRef, {
        studentId: student.id,
        studentName: student.studentNameBn || student.studentNameEn,
        roll: student.roll,
        className: student.className,
        academicYear: selectedYear,
        amount: payAmount,
        method: method,
        senderMobile: senderMobile.trim(),
        transactionId: cleanTrx,
        description: description.trim(),
        status: 'pending', // pending verification by administration
        submittedAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      setIsSuccess(true);
      toast({ 
        title: 'পেমেন্ট সাবমিট সফল হয়েছে! ✅',
        description: 'স্কুল কর্তৃপক্ষ ট্রানজেকশন যাচাই করে দ্রুত অনুমোদন দেবে।'
      });
    } catch (e: any) {
      console.error(e);
      toast({ 
        variant: 'destructive', 
        title: 'ত্রুটি', 
        description: e.message || 'পেমেন্ট আবেদন জমা দেওয়া যায়নি।' 
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-4 font-kalpurush">
        <Card className="max-w-md w-full border-4 border-emerald-600 rounded-[32px] text-center p-8 shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-4">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h2 className="text-2xl font-black text-emerald-950 mb-2">আবেদন জমা হয়েছে!</h2>
          <Badge className="bg-amber-100 text-amber-900 border border-amber-300 mb-4 px-3 py-1 font-bold">
            স্ট্যাটাস: যাচাইয়ের অপেক্ষায় (Pending Verification)
          </Badge>
          <div className="bg-white p-4 rounded-xl border border-emerald-200 text-left text-xs space-y-1.5 mb-6 text-slate-700">
            <p><span className="font-bold">শিক্ষার্থী:</span> {student?.studentNameBn} (রোল: {toBn(student?.roll)})</p>
            <p><span className="font-bold">টাকার পরিমাণ:</span> ৳ {toBn(amount)}</p>
            <p><span className="font-bold">মেথড:</span> {method.toUpperCase()}</p>
            <p><span className="font-bold">TrxID:</span> <span className="font-mono font-black text-indigo-700">{transactionId.trim().toUpperCase()}</span></p>
            <p><span className="font-bold">প্রেরক নম্বর:</span> {senderMobile}</p>
          </div>
          <p className="text-xs font-bold text-slate-600 mb-6">
            স্কুল প্রশাসন আপনার ট্রানজেকশন আইডি মিলিয়ে অনুমোদন দিলে মূল রসিদ তৈরি হবে এবং বকেয়া সমন্বয় হবে।
          </p>
          <Button 
            className="w-full h-11 text-base font-black bg-emerald-600 hover:bg-emerald-700 text-white" 
            onClick={() => router.push('/parents/dashboard')}
          >
            অভিভাবক ড্যাশবোর্ডে ফিরে যান
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-100 font-kalpurush flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-lg border-2 border-indigo-200 rounded-[28px] overflow-hidden shadow-2xl bg-white">
        <CardHeader className="bg-gradient-to-r from-indigo-700 to-purple-800 text-white p-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full text-white hover:bg-white/10">
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="text-center flex-1 pr-6">
              <CardTitle className="text-lg md:text-xl font-black flex items-center justify-center gap-2">
                <Landmark className="h-5 w-5 text-amber-300" /> নিরাপদ অনলাইন পেমেন্ট
              </CardTitle>
              <CardDescription className="text-indigo-200 text-xs font-bold">
                বিকাশ, নগদ বা রকেটের মাধ্যমে ফি পরিশোধ
              </CardDescription>
            </div>
          </div>
        </CardHeader>

        <CardContent className="p-6 md:p-8 space-y-6">
          {/* Step 1: School Account Information */}
          <div className="p-4 bg-indigo-50/80 border-2 border-indigo-200 rounded-2xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-xs font-black text-indigo-950 flex items-center gap-1.5">
                <Info className="h-4 w-4 text-indigo-700" /> প্রতিষ্ঠানের পেমেন্ট নম্বর:
              </span>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyNumber}
                className="h-7 text-[11px] font-bold border-indigo-300 text-indigo-800 hover:bg-indigo-100"
              >
                <Copy className="h-3 w-3 mr-1" /> কপি করুন
              </Button>
            </div>
            <div className="flex items-baseline justify-between">
              <span className="text-lg font-mono font-black text-indigo-900 tracking-wider">
                {officialNumber}
              </span>
              <Badge variant="outline" className="bg-white text-indigo-700 border-indigo-300 text-[10px] font-bold">
                Send Money / Cash Out
              </Badge>
            </div>
            <p className="text-[11px] text-slate-600 font-bold leading-tight">
              প্রথমে আপনার মোবাইল ব্যাংকিং অ্যাপ থেকে উপরের নম্বরে নির্দিষ্ট পরিমাণ ফি পাঠান। এরপর প্রেরক নম্বর ও প্রাপ্ত TrxID নিচে লিখুন।
            </p>
          </div>

          <form onSubmit={handlePayment} className="space-y-4">
            {/* Method selection */}
            <div>
              <Label className="font-black text-slate-700 text-xs">পেমেন্ট মেথড নির্বাচন করুন</Label>
              <div className="grid grid-cols-3 gap-2 mt-1.5">
                {[
                  { id: 'bkash', label: 'বিকাশ', color: 'border-[#e2136e] text-[#e2136e] bg-[#e2136e]/5' },
                  { id: 'nagad', label: 'নগদ', color: 'border-[#f7941d] text-[#f7941d] bg-[#f7941d]/5' },
                  { id: 'rocket', label: 'রকেট', color: 'border-[#8c3494] text-[#8c3494] bg-[#8c3494]/5' },
                ].map((m) => (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => setMethod(m.id as any)}
                    className={cn(
                      'p-2.5 rounded-xl border-2 font-black text-xs transition-all flex flex-col items-center gap-1',
                      method === m.id
                        ? `${m.color} ring-2 ring-indigo-400 font-black scale-105`
                        : 'border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300'
                    )}
                  >
                    <span>{m.label}</span>
                    {method === m.id && <CheckCircle2 className="h-3.5 w-3.5" />}
                  </button>
                ))}
              </div>
            </div>

            {/* Amount */}
            <div className="space-y-1">
              <Label className="font-bold text-xs">টাকার পরিমাণ (৳)</Label>
              <Input
                type="number"
                required
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="যেমন: ১০০০"
                className="h-10 text-base font-black border-slate-300"
              />
            </div>

            {/* Sender Mobile */}
            <div className="space-y-1">
              <Label className="font-bold text-xs">প্রেরক মোবাইল নম্বর (যে নম্বর থেকে টাকা পাঠিয়েছেন)</Label>
              <Input
                type="tel"
                required
                value={senderMobile}
                onChange={(e) => setSenderMobile(e.target.value)}
                placeholder="যেমন: 017xxxxxxxx"
                className="h-10 font-bold text-xs border-slate-300"
              />
            </div>

            {/* Mandatory TrxID */}
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <Label className="font-bold text-xs text-indigo-950">ট্রানজেকশন আইডি (TrxID) *</Label>
                <span className="text-[10px] text-rose-600 font-bold">বাধ্যতামূলক</span>
              </div>
              <Input
                required
                value={transactionId}
                onChange={(e) => setTransactionId(e.target.value.toUpperCase())}
                placeholder="যেমন: 9J83KL2M9P"
                className="h-10 font-mono font-black text-sm tracking-wider uppercase border-2 border-indigo-300 focus-visible:ring-indigo-600"
              />
              <p className="text-[10px] text-slate-500 font-bold">টাকা পাঠানোর পর প্রাপ্ত ফিরতি SMS-এর TrxID লিখুন।</p>
            </div>

            {/* Description */}
            <div className="space-y-1">
              <Label className="font-bold text-xs text-slate-700">পেমেন্টের বিবরণ</Label>
              <Input
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="যেমন: মার্চ মাসের মাসিক বেতন"
                className="h-9 font-bold text-xs border-slate-300"
              />
            </div>

            {/* Security Notice */}
            <div className="p-3 bg-amber-50 rounded-xl border border-amber-200 flex items-start gap-2">
              <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
              <p className="text-[11px] font-bold text-amber-900 leading-tight">
                ভুয়া বা ভুল TrxID প্রদান করলে আবেদন বাতিল হবে। সঠিক TrxID দিলে স্কুল কর্তৃপক্ষ যাচাইপূর্বক রসিদ অনুমোদন করবে।
              </p>
            </div>

            {/* Submit Button */}
            <Button
              type="submit"
              disabled={isLoading || !amount || !transactionId.trim() || !senderMobile.trim()}
              className="w-full h-11 text-sm font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-lg"
            >
              {isLoading ? (
                <>
                  <Loader2 className="animate-spin mr-2 h-4 w-4" /> যাচাইপূর্বক জমা হচ্ছে...
                </>
              ) : (
                <>
                  <CreditCard className="mr-2 h-4 w-4" /> পেমেন্ট যাচাইয়ের জন্য জমা দিন
                </>
              )}
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

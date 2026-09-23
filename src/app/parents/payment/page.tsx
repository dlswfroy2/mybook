
'use client';

import { useState, useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useFirestore } from '@/firebase';
import { collection, doc, writeBatch, serverTimestamp, Timestamp, increment } from 'firebase/firestore';
import { Student } from '@/lib/student-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useToast } from '@/hooks/use-toast';
import { ArrowLeft, Loader2, CheckCircle2, ShieldCheck, Wallet, CreditCard, Landmark, Smartphone } from 'lucide-react';
import Image from 'next/image';

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export default function OnlinePaymentPage() {
  const db = useFirestore();
  const router = useRouter();
  const { toast } = useToast();
  const { selectedYear } = useAcademicYear();
  
  const [student, setStudent] = useState<Student | null>(null);
  const [method, setMethod] = useState<'bkash' | 'rocket'>('bkash');
  const [amount, setAmount] = useState('');
  const [description, setDescription] = useState('টিউশন ফি পরিশোধ');
  const [isLoading, setIsLoading] = useState(false);
  const [isSuccess, setIsSuccess] = useState(false);

  useEffect(() => {
    const session = localStorage.getItem('parent_student_session');
    if (!session) {
      router.push('/parents/login');
      return;
    }
    setStudent(JSON.parse(session));
  }, [router]);

  const handlePayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!db || !student || !amount) return;

    setIsLoading(true);
    try {
        const payAmount = parseFloat(amount);
        const batch = writeBatch(db);
        
        const feeCollectionId = doc(collection(db, 'feeCollections')).id;
        const txRef = doc(collection(db, 'transactions'));

        // 1. Create Transaction record
        batch.set(txRef, {
            date: serverTimestamp(),
            type: 'income',
            method: 'bank',
            accountHead: 'Tuition Fee',
            description: `Online Payment (${method.toUpperCase()}) - ${student.studentNameBn}`,
            amount: payAmount,
            academicYear: selectedYear,
            feeCollectionId,
            updatedAt: serverTimestamp()
        });

        // 2. Create Fee Collection record
        batch.set(doc(db, 'feeCollections', feeCollectionId), {
            studentId: student.id,
            academicYear: selectedYear,
            collectionDate: serverTimestamp(),
            description: description + ` (${method.toUpperCase()})`,
            method: 'bank',
            totalAmount: payAmount,
            transactionIds: [txRef.id],
            collectorName: 'Online Gateway',
            breakdown: { tuitionCurrent: payAmount },
            createdAt: serverTimestamp(),
            updatedAt: serverTimestamp()
        });

        // 3. Update student balance
        batch.update(doc(db, 'students', student.id), {
            balance: increment(-payAmount),
            updatedAt: serverTimestamp()
        });

        await batch.commit();
        setIsSuccess(true);
        toast({ title: 'পেমেন্ট সফল হয়েছে' });
    } catch (e) {
        console.error(e);
        toast({ variant: 'destructive', title: 'ত্রুটি', description: 'পেমেন্ট সম্পন্ন করা যায়নি।' });
    } finally {
        setIsLoading(false);
    }
  };

  if (isSuccess) {
    return (
      <div className="min-h-screen bg-emerald-50 flex flex-col items-center justify-center p-4 font-kalpurush">
        <Card className="max-w-md w-full border-4 border-emerald-600 rounded-[32px] text-center p-10 shadow-2xl animate-in zoom-in-95 duration-500">
          <div className="bg-emerald-100 w-20 h-20 rounded-full flex items-center justify-center text-emerald-600 mx-auto mb-6">
            <CheckCircle2 className="h-12 w-12" />
          </div>
          <h2 className="text-3xl font-black text-emerald-900 mb-2">সফল হয়েছে!</h2>
          <p className="font-bold text-emerald-800 mb-8">আপনার পেমেন্টটি আমাদের সিস্টেমে গৃহীত হয়েছে। ধন্যবাদ।</p>
          <Button className="w-full h-12 text-lg font-black bg-emerald-600" onClick={() => router.push('/parents/dashboard')}>
            ড্যাশবোর্ডে ফিরে যান
          </Button>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-indigo-50 font-kalpurush flex flex-col items-center justify-center p-4">
      <Card className="w-full max-w-lg border-[4px] border-black rounded-[32px] overflow-hidden shadow-2xl">
        <CardHeader className="bg-white border-b-[3px] border-black p-6">
          <div className="flex items-center justify-between">
            <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full">
                <ArrowLeft className="h-5 w-5" />
            </Button>
            <div className="text-center flex-1">
                <CardTitle className="text-xl font-black flex items-center justify-center gap-2 text-indigo-900">
                    <Landmark className="h-5 w-5" /> অনলাইন পেমেন্ট গেটওয়ে
                </CardTitle>
                <CardDescription className="font-bold">বিকাশ বা রকেটের মাধ্যমে ফি পরিশোধ করুন</CardDescription>
            </div>
            <div className="w-10"></div>
          </div>
        </CardHeader>
        <CardContent className="p-8 space-y-8 bg-white">
          <form onSubmit={handlePayment} className="space-y-6">
            <div className="space-y-4">
                <Label className="font-black text-slate-700 text-xs uppercase tracking-widest">পেমেন্ট মেথড নির্বাচন করুন</Label>
                <div className="grid grid-cols-2 gap-4">
                    <button 
                        type="button"
                        onClick={() => setMethod('bkash')}
                        className={cn(
                            "relative flex flex-col items-center gap-3 p-6 rounded-3xl border-[4px] transition-all duration-300",
                            method === 'bkash' ? "bg-[#e2136e]/5 border-[#e2136e] shadow-lg scale-105" : "bg-slate-50 border-transparent opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                        )}
                    >
                        <div className="w-12 h-12 relative">
                            <Image src="https://picsum.photos/seed/bkash/200/200" alt="bKash" fill className="object-contain" data-ai-hint="payment logo" />
                        </div>
                        <span className="font-black text-sm text-[#e2136e]">বিকাশ</span>
                        {method === 'bkash' && <div className="absolute -top-2 -right-2 bg-[#e2136e] text-white p-1 rounded-full shadow-lg"><CheckCircle2 className="h-4 w-4" /></div>}
                    </button>

                    <button 
                        type="button"
                        onClick={() => setMethod('rocket')}
                        className={cn(
                            "relative flex flex-col items-center gap-3 p-6 rounded-3xl border-[4px] transition-all duration-300",
                            method === 'rocket' ? "bg-[#8c3494]/5 border-[#8c3494] shadow-lg scale-105" : "bg-slate-50 border-transparent opacity-60 grayscale hover:grayscale-0 hover:opacity-100"
                        )}
                    >
                        <div className="w-12 h-12 relative">
                            <Image src="https://picsum.photos/seed/rocket/200/200" alt="Rocket" fill className="object-contain" data-ai-hint="payment logo" />
                        </div>
                        <span className="font-black text-sm text-[#8c3494]">রকেট</span>
                        {method === 'rocket' && <div className="absolute -top-2 -right-2 bg-[#8c3494] text-white p-1 rounded-full shadow-lg"><CheckCircle2 className="h-4 w-4" /></div>}
                    </button>
                </div>
            </div>

            <div className="space-y-4 pt-4 border-t border-dashed">
                <div className="space-y-2">
                    <Label className="font-bold">টাকার পরিমাণ</Label>
                    <div className="relative">
                        <span className="absolute left-4 top-1/2 -translate-y-1/2 font-black text-xl text-slate-400">৳</span>
                        <Input 
                            type="number" 
                            required 
                            value={amount}
                            onChange={e => setAmount(e.target.value)}
                            placeholder="০০০" 
                            className="h-14 pl-10 text-2xl font-black border-2 border-black/10 focus:ring-4 focus:ring-primary/10 transition-all" 
                        />
                    </div>
                </div>
                <div className="space-y-2">
                    <Label className="font-bold">পেমেন্টের বিবরণ</Label>
                    <Input 
                        value={description}
                        onChange={e => setDescription(e.target.value)}
                        placeholder="উদা: জানুয়ারী মাসের বেতন" 
                        className="h-12 border-2 font-bold" 
                    />
                </div>
            </div>

            <div className="p-4 bg-muted/20 rounded-2xl border-2 border-dashed flex items-start gap-3">
                <ShieldCheck className="h-5 w-5 text-emerald-600 shrink-0" />
                <p className="text-[10px] font-bold text-slate-600 leading-tight">
                    নিরাপদ পেমেন্ট গেটওয়ে। আপনার পেমেন্টটি সম্পন্ন হওয়ার সাথে সাথে রসিদ জেনারেট হবে এবং ড্যাশবোর্ডে আপডেট দেখা যাবে।
                </p>
            </div>

            <Button type="submit" disabled={isLoading || !amount} className={cn(
                "w-full h-16 text-xl font-black shadow-xl transition-all active:scale-95 border-b-[6px] border-black/20",
                method === 'bkash' ? "bg-[#e2136e] hover:bg-[#b50f58]" : "bg-[#8c3494] hover:bg-[#6c2872]"
            )}>
                {isLoading ? <Loader2 className="animate-spin mr-2 h-6 w-6" /> : <CreditCard className="mr-2 h-6 w-6" />}
                পেমেন্ট নিশ্চিত করুন
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}

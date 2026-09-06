
"use client";

import { CLASSES } from '@/lib/constants';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BookOpen, ArrowLeft, GraduationCap } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

export default function BoardBooksPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen w-full flex flex-col bg-slate-50 font-kalpurush pb-20">
      <header className="p-6 border-b bg-white shadow-sm flex items-center justify-between sticky top-0 z-30">
        <div className="flex items-center gap-4">
          <Button variant="ghost" size="icon" onClick={() => router.back()} className="rounded-full hover:bg-slate-100">
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-black text-primary">বোর্ড বই সংগ্রহ</h1>
            <p className="text-xs font-bold text-muted-foreground mt-0.5">আপনার কাঙ্ক্ষিত শ্রেণি নির্বাচন করুন</p>
          </div>
        </div>
        <div className="bg-primary/10 p-2.5 rounded-2xl">
          <GraduationCap className="h-6 w-6 text-primary" />
        </div>
      </header>

      <main className="max-w-6xl mx-auto w-full p-6 mt-8">
        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-6">
          {CLASSES.map((cls) => {
            const classColors: Record<string, { bg: string; hover: string; border: string }> = {
              '6': { bg: 'bg-[#2563eb]', hover: 'hover:bg-[#1d4ed8]', border: 'border-[#1e3a8a]' },
              '7': { bg: 'bg-[#059669]', hover: 'hover:bg-[#047857]', border: 'border-[#064e3b]' },
              '8': { bg: 'bg-[#7c3aed]', hover: 'hover:bg-[#6d28d9]', border: 'border-[#4c1d95]' },
              '9': { bg: 'bg-[#ea580c]', hover: 'hover:bg-[#c2410c]', border: 'border-[#9a3412]' },
              '10': { bg: 'bg-[#dc2626]', hover: 'hover:bg-[#b91c1c]', border: 'border-[#7f1d1d]' },
            };
            const col = classColors[cls.id] || { bg: 'bg-[#4f46e5]', hover: 'hover:bg-[#4338ca]', border: 'border-[#312e81]' };
            
            return (
              <Link key={cls.id} href={`/class/${cls.id}`} className="block w-full">
                <Card className={cn(
                  "relative group cursor-pointer transition-all duration-300 active:translate-y-2 active:border-b-0 border-b-[8px] shadow-xl overflow-hidden rounded-[24px] border-black/20",
                  col.bg,
                  col.hover,
                  col.border
                )}>
                  <CardContent className="p-8 flex flex-col items-center justify-center text-center space-y-4">
                    <div className="relative transform group-hover:scale-110 transition-transform duration-500">
                      <div className="absolute -inset-2 bg-white/20 blur-xl rounded-full opacity-0 group-hover:opacity-100 transition-opacity" />
                      <BookOpen className="w-16 h-16 text-white drop-shadow-[0_8px_8px_rgba(0,0,0,0.4)]" />
                    </div>
                    <span className="font-black text-xl text-white drop-shadow-md tracking-tight">
                      {cls.label} শ্রেণি
                    </span>
                  </CardContent>
                  
                  {/* Decorative Glass Reflection */}
                  <div className="absolute top-0 left-0 w-full h-1/2 bg-gradient-to-b from-white/10 to-transparent pointer-events-none" />
                </Card>
              </Link>
            );
          })}
        </div>

        <div className="mt-20 p-8 border-4 border-dashed border-primary/10 bg-primary/5 rounded-[32px] text-center max-w-2xl mx-auto">
          <Info className="h-10 w-10 text-primary mx-auto mb-4 opacity-30" />
          <p className="text-lg font-black text-slate-700">উপরের বাটন থেকে শ্রেণি নির্বাচন করুন।</p>
          <p className="text-sm font-bold text-muted-foreground mt-2">আপনি যে শ্রেণির বইগুলো দেখতে চান, সেই শ্রেণির বাটনে ক্লিক করুন। সংশ্লিষ্ট শ্রেণির সকল বিষয়ের বোর্ড বইয়ের তালিকা পরবর্তী পাতায় দেখা যাবে।</p>
        </div>
      </main>
    </div>
  );
}


"use client";

import { Suspense, useState } from 'react';
import Link from 'next/link';
import { usePathname, useSearchParams, useRouter } from 'next/navigation';
import { LayoutDashboard, PlusCircle, Settings, BookOpen, Library, Users, NotebookPen, BookOpenText, Search } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useUser } from '@/firebase';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

function BottomNavContent() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const router = useRouter();
  const { user, loading } = useUser();
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const isPrintMode = searchParams.get('print') === 'true';

  if (loading || !user || pathname === '/auth' || isPrintMode) {
    return null;
  }

  const handleMenuSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchQuery.trim().toLowerCase();
    if (!q) return;

    let targetPath = '';

    // Comprehensive Search Mapping
    if (q.includes('ফলাফল') || q.includes('রেজাল্ট')) {
      targetPath = '/results';
    } else if (q.includes('শিট') || q.includes('লেকচার')) {
      targetPath = '/create-lecture-sheet';
    } else if (q.includes('বিষয়') || q.includes('পূর্ণমান') || q.includes('পূণমান')) {
      targetPath = '/results?tab=full-marks';
    } else if (q.includes('হোম') || q.includes('ড্যাশবোর্ড') || q.includes('মূল')) {
      targetPath = '/';
    } else if (q.includes('বই') || q.includes('বোর্ড')) {
      targetPath = '/board-books';
    } else if (q.includes('ডায়েরি') || q.includes('ডায়েরি') || q.includes('ডাইরী')) {
      targetPath = '/diary';
    } else if (q.includes('প্রশ্ন') || q.includes('তৈরি')) {
      targetPath = '/create-question';
    } else if (q.includes('প্রোফাইল') || q.includes('শিক্ষার্থী তথ্য')) {
      targetPath = '/student-profile';
    } else if (q.includes('ভর্তি') && !q.includes('আবেদন')) {
      targetPath = '/add-student';
    } else if (q.includes('তালিকা') || q.includes('লিস্ট')) {
      targetPath = '/student-list';
    } else if (q.includes('হাজিরা') || q.includes('উপস্থিতি')) {
      targetPath = '/attendance';
    } else if (q.includes('হিসাব') || q.includes('টাকা') || q.includes('বেতন') || q.includes('পেমেন্ট')) {
      targetPath = '/accounts';
    } else if (q.includes('মেসেজ') || q.includes('এসএমএস')) {
      targetPath = '/messaging';
    } else if (q.includes('স্টাফ') || q.includes('শিক্ষক')) {
      targetPath = '/staff';
    } else if (q.includes('ডকুমেন্ট') || q.includes('প্রত্যয়ন') || q.includes('প্রশংসা') || q.includes('আইডি')) {
      targetPath = '/documents';
    } else if (q.includes('রুটিন')) {
      targetPath = '/routines';
    } else if (q.includes('রেকর্ড') || q.includes('পাবলিক')) {
      targetPath = '/public-exam-records';
    } else if (q.includes('লাইব্রেরি') || q.includes('সংগ্রহ') || q.includes('লাইব্রেরী')) {
      targetPath = '/my-questions';
    } else if (q.includes('আবেদন')) {
      targetPath = '/admissions-management';
    } else if (q.includes('সেটিংস') || q.includes('নিয়ন্ত্রণ') || q.includes('সেটিং')) {
      targetPath = '/settings';
    }

    if (targetPath) {
      setSearchOpen(false);
      setSearchQuery('');
      
      // Use push with a slight delay or handle same-page refresh
      if (pathname === targetPath || (targetPath.includes('?') && pathname === targetPath.split('?')[0])) {
        router.replace(targetPath);
        router.refresh();
      } else {
        router.push(targetPath);
      }
    }
  };

  const navItems = [
    { label: 'হোম', icon: LayoutDashboard, href: '/' },
    { label: 'বোর্ড বই', icon: BookOpenText, href: '/board-books' },
    { label: 'ডায়েরি', icon: NotebookPen, href: '/diary' },
    { label: 'প্রশ্ন তৈরি', icon: PlusCircle, href: '/create-question' },
    { label: 'শিট তৈরি', icon: BookOpen, href: '/create-lecture-sheet' },
    { label: 'শিক্ষার্থী', icon: Users, href: '/students' },
    { label: 'লাইব্রেরি', icon: Library, href: '/my-questions' },
    { label: 'সেটিংস', icon: Settings, href: '/settings' },
  ];

  return (
    <nav className="fixed bottom-0 left-0 right-0 bg-primary border-t border-primary/20 text-primary-foreground z-50 h-14 shadow-lg no-print">
      <div className="h-full max-w-5xl mx-auto flex items-center justify-around px-4 gap-1">
        {navItems.map((item) => {
          const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex items-center justify-center min-w-[40px] h-12 rounded-lg transition-all relative shrink-0 flex-col",
                isActive 
                  ? "bg-white/20 text-white" 
                  : "text-white/70 hover:bg-white/10 hover:text-white"
              )}
            >
              <item.icon className={cn("w-5 h-5", isActive && "animate-pulse")} />
              <span className="text-[8px] mt-0.5 font-bold whitespace-nowrap">{item.label}</span>
              {isActive && (
                <div className="absolute -bottom-0.5 w-1 h-1 bg-white rounded-full" />
              )}
            </Link>
          );
        })}

        {/* Menu Search Button */}
        <Dialog open={searchOpen} onOpenChange={setSearchOpen}>
          <DialogTrigger asChild>
            <button
              className="flex flex-col items-center justify-center min-w-[40px] h-12 rounded-lg transition-all text-white/70 hover:bg-white/10 hover:text-white shrink-0"
            >
              <Search className="w-5 h-5" />
              <span className="text-[8px] mt-0.5 font-bold whitespace-nowrap">সার্চ</span>
            </button>
          </DialogTrigger>
          <DialogContent className="sm:max-w-md font-kalpurush border-2 border-primary">
            <DialogHeader>
              <DialogTitle className="text-primary font-black text-xl">মেনু অনুসন্ধান</DialogTitle>
            </DialogHeader>
            <form onSubmit={handleMenuSearch} className="space-y-4 py-4">
              <div className="space-y-2">
                <Label className="font-bold">কিওয়ার্ড লিখুন (উদা: ফলাফল, শিট, হাজিরা, স্টাফ, রুটিন ইত্যাদি)</Label>
                <Input 
                  value={searchQuery} 
                  onChange={(e) => setSearchQuery(e.target.value)} 
                  placeholder="এখানে লিখে এন্টার দিন..." 
                  autoFocus 
                  className="h-12 border-2 border-primary/20 text-lg font-bold"
                />
              </div>
              <Button type="submit" className="w-full h-11 font-black shadow-lg">পেজে যান</Button>
            </form>
          </DialogContent>
        </Dialog>
      </div>
    </nav>
  );
}

export function BottomNav() {
  return (
    <Suspense fallback={null}>
      <BottomNavContent />
    </Suspense>
  );
}

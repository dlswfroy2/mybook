"use client";

import { useMemo, Suspense } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { 
  BookOpenText, 
  LogIn, 
  LogOut, 
  Settings as SettingsIcon,
  Menu,
  LayoutDashboard,
  NotebookPen,
  PlusCircle,
  BookOpen,
  Users,
  Library,
  ChevronRight,
  Bell,
  UserPlus,
  Search,
  CalendarCheck,
  Award,
  Calendar,
  MessageSquare,
  Banknote,
  UserCog,
  FileArchive,
  Clock,
  FolderOpen,
  Edit3
} from 'lucide-react';
import { useUser, useAuth, useFirestore, useDoc } from '@/firebase';
import { signOut } from 'firebase/auth';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
  SheetClose,
} from '@/components/ui/sheet';
import { toast } from '@/hooks/use-toast';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { ThemeToggle } from '@/components/ThemeToggle';

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

function NavbarContent() {
  const { user, loading } = useUser();
  const auth = useAuth();
  const db = useFirestore();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const isPrintMode = searchParams.get('print') === 'true';

  const { schoolInfo } = useSchoolInfo();

  const userProfileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  const appName = schoolInfo?.name || '';
  const appLogoUrl = schoolInfo?.logoUrl || '';

  const userName = userProfile?.displayName || user?.displayName || 'ব্যবহারকারী';
  const userPhoto = userProfile?.photoURL || user?.photoURL || '';

  const handleLogout = async () => {
    try {
      if (user) {
        await updateDoc(doc(db, 'users', user.uid), {
          isOnline: false,
          lastActiveAt: serverTimestamp(),
        }).catch(() => {});
      }
      await signOut(auth);
      toast({ title: "লগআউট", description: "আপনি সফলভাবে লগআউট করেছেন।" });
    } catch (error) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "লগআউট করা সম্ভব হয়নি।" });
    }
  };

  const { selectedYear, setSelectedYear, availableYears } = useAcademicYear();

  if (pathname === '/auth' || isPrintMode) {
    return null;
  }

  const navItems = [
    { label: 'হোম', icon: LayoutDashboard, href: '/', bg: 'bg-[#0284c7] hover:bg-[#0369a1] border-b-[2.5px] border-[#075985]', shadow: 'shadow-sky-900/40' },
    { label: 'বার্ষিক ক্যালেন্ডার', icon: Calendar, href: '/calendar', bg: 'bg-[#d97706] hover:bg-[#b45309] border-b-[2.5px] border-[#92400e]', shadow: 'shadow-amber-900/40' },
    { label: 'হোয়াইটবোর্ড', icon: Edit3, href: '/whiteboard', bg: 'bg-[#ea580c] hover:bg-[#c2410c] border-b-[2.5px] border-[#9a3412]', shadow: 'shadow-orange-900/40' },
    { label: 'বোর্ড বই', icon: BookOpenText, href: '/board-books', bg: 'bg-[#2563eb] hover:bg-[#1d4ed8] border-b-[2.5px] border-[#1e40af]', shadow: 'shadow-blue-900/40' },
    { label: 'নোটিশ বোর্ড', icon: Bell, href: '/notices-management', bg: 'bg-[#65a30d] hover:bg-[#4d7c0f] border-b-[2.5px] border-[#3f6212]', shadow: 'shadow-lime-900/40' },
    { label: 'শিক্ষার্থী প্রোফাইল', icon: Search, href: '/student-profile', bg: 'bg-[#f59e0b] hover:bg-[#d97706] border-b-[2.5px] border-[#b45309]', shadow: 'shadow-yellow-900/40' },
    { label: 'নতুন শিক্ষার্থী ভর্তি', icon: UserPlus, href: '/add-student', bg: 'bg-[#9333ea] hover:bg-[#7e22ce] border-b-[2.5px] border-[#6b21a8]', shadow: 'shadow-purple-900/40' },
    { label: 'শিক্ষার্থী তালিকা', icon: Users, href: '/student-list', bg: 'bg-[#db2777] hover:bg-[#be185d] border-b-[2.5px] border-[#9d174d]', shadow: 'shadow-pink-900/40' },
    { label: 'দৈনিক হাজিরা', icon: CalendarCheck, href: '/attendance', bg: 'bg-[#0d9488] hover:bg-[#0f766e] border-b-[2.5px] border-[#115e59]', shadow: 'shadow-teal-900/40' },
    { label: 'ফলাফল ব্যবস্থাপনা', icon: Award, href: '/results', bg: 'bg-[#4f46e5] hover:bg-[#4338ca] border-b-[2.5px] border-[#3730a3]', shadow: 'shadow-indigo-900/40' },
    { label: 'হিসাব শাখা', icon: Banknote, href: '/accounts', bg: 'bg-[#059669] hover:bg-[#047857] border-b-[2.5px] border-[#065f46]', shadow: 'shadow-emerald-900/40' },
    { label: 'মেসেজ শাখা', icon: MessageSquare, href: '/messaging', bg: 'bg-[#3b82f6] hover:bg-[#2563eb] border-b-[2.5px] border-[#1d4ed8]', shadow: 'shadow-blue-900/40' },
    { label: 'স্টাফ পোর্টাল', icon: UserCog, href: '/staff', bg: 'bg-[#b45309] hover:bg-[#92400e] border-b-[2.5px] border-[#78350f]', shadow: 'shadow-amber-900/40' },
    { label: 'ডকুমেন্ট পোর্টাল', icon: FolderOpen, href: '/documents', bg: 'bg-[#c026d3] hover:bg-[#a21caf] border-b-[2.5px] border-[#86198f]', shadow: 'shadow-fuchsia-900/40' },
    { label: 'নথিপত্র (আর্কাইভ)', icon: FileArchive, href: '/documents/archive', bg: 'bg-[#e11d48] hover:bg-[#be123c] border-b-[2.5px] border-[#9f1239]', shadow: 'shadow-rose-900/40' },
    { label: 'রুটিন শাখা', icon: Clock, href: '/routines', bg: 'bg-[#7c3aed] hover:bg-[#6d28d9] border-b-[2.5px] border-[#5b21b6]', shadow: 'shadow-violet-900/40' },
    { label: 'রেকর্ড শাখা', icon: Award, href: '/public-exam-records', bg: 'bg-[#0891b2] hover:bg-[#0e7490] border-b-[2.5px] border-[#155e75]', shadow: 'shadow-cyan-900/40' },
    { label: 'টিচার্স ডায়েরি', icon: NotebookPen, href: '/diary', bg: 'bg-[#4338ca] hover:bg-[#3730a3] border-b-[2.5px] border-[#312e81]', shadow: 'shadow-indigo-900/40' },
    { label: 'প্রশ্ন তৈরি', icon: PlusCircle, href: '/create-question', bg: 'bg-[#f97316] hover:bg-[#ea580c] border-b-[2.5px] border-[#c2410c]', shadow: 'shadow-orange-900/40' },
    { label: 'শিট তৈরি', icon: BookOpen, href: '/create-lecture-sheet', bg: 'bg-[#10b981] hover:bg-[#059669] border-b-[2.5px] border-[#047857]', shadow: 'shadow-emerald-900/40' },
    { label: 'আমার লাইব্রেরি', icon: Library, href: '/my-questions', bg: 'bg-[#be123c] hover:bg-[#9f1239] border-b-[2.5px] border-[#881337]', shadow: 'shadow-rose-900/40' },
    { label: 'সেটিংস', icon: SettingsIcon, href: '/settings', bg: 'bg-[#475569] hover:bg-[#334155] border-b-[2.5px] border-[#1e293b]', shadow: 'shadow-slate-900/40' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 md:h-[78px] bg-primary text-primary-foreground z-[100] shadow-xl flex items-center px-4 md:px-6 no-print border-b border-white/10 font-kalpurush">
      {/* Sidebar Menu Trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="mr-2 text-white hover:bg-white/10 shrink-0">
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[235px] sm:w-[240px] p-0 border-r-white/20 font-kalpurush flex flex-col h-full max-h-screen bg-[#0f172a] overflow-hidden">
          <SheetHeader className="p-3.5 bg-gradient-to-b from-primary to-primary/80 text-white border-b border-white/10 shrink-0 relative overflow-hidden">
            <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px] pointer-events-none" />
            <div className="flex items-center gap-3 relative z-10">
              <div className="bg-white p-2 rounded-2xl text-primary shadow-[0_4px_15px_rgba(255,255,255,0.3)] shrink-0 border-2 border-white/50">
                {appLogoUrl ? (
                  <img src={appLogoUrl} alt="Logo" className="w-6 h-6 object-contain" />
                ) : (
                  <BookOpenText className="w-6 h-6" />
                )}
              </div>
              <SheetTitle className="text-white text-[12px] font-black leading-tight text-left drop-shadow-md">
                {appName}
              </SheetTitle>
            </div>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto py-2 px-2.5 space-y-1.5 bg-[#0f172a] scrollbar-thin scrollbar-thumb-white/20">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between px-2.5 py-1.5 rounded-lg transition-all duration-200 group text-white min-h-[34px]",
                      item.bg,
                      item.shadow,
                      "shadow-sm active:translate-y-0.5 active:border-b-0",
                      isActive ? "ring-1.5 ring-white scale-[1.01] shadow-md" : "hover:brightness-110"
                    )}
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      {/* Crisp White Glass Badge with Icon */}
                      <div className="p-1 rounded-md bg-black/20 text-white shrink-0 border border-white/30 shadow-inner group-hover:scale-105 transition-transform">
                        <item.icon className="w-3 h-3 drop-shadow-sm" />
                      </div>
                      <span className="font-black text-[11px] md:text-xs tracking-tight text-white drop-shadow-sm whitespace-nowrap overflow-hidden text-ellipsis">
                        {item.label}
                      </span>
                    </div>
                    <ChevronRight className={cn(
                      "w-3 h-3 text-white/80 shrink-0 transition-transform",
                      isActive ? "scale-105 opacity-100 translate-x-0.5" : "opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5"
                    )} />
                  </Link>
                </SheetClose>
              );
            })}
          </div>
          
          <div className="shrink-0 p-2.5 border-t border-white/10 bg-black/40 backdrop-blur-md">
             <p className="text-[10px] font-black text-white/40 uppercase tracking-widest text-center">© ২০২৪-২৬ {appName}</p>
          </div>
        </SheetContent>
      </Sheet>

      <Link href="/" className="flex items-center gap-3 group">
        <div className="hidden sm:flex bg-white p-1 rounded-xl text-primary group-hover:scale-105 transition-transform items-center justify-center shadow-lg shrink-0">
          {appLogoUrl ? (
            <img src={appLogoUrl} alt="Logo" className="w-10 h-10 object-contain" />
          ) : (
            <BookOpenText className="w-10 h-10" />
          )}
        </div>
        <div className="flex flex-col">
          <h1 className="text-[25px] md:text-[35px] font-black font-headline tracking-tighter drop-shadow-[0_6px_6px_rgba(0,0,0,1)] leading-tight text-white uppercase scale-y-110 origin-left">
            {appName}
          </h1>
          <p className="text-[10px] md:text-xs font-black text-yellow-400 italic leading-none mt-1 drop-shadow-[0_1px_1px_rgba(0,0,0,0.5)]">
            Smart learning, Bright Future.
          </p>
        </div>
      </Link>
      
      <div className="ml-auto flex items-center gap-2 md:gap-3">
        {/* Academic Year Selector */}
        <div className="flex items-center gap-1.5 bg-black/25 hover:bg-black/35 border border-white/20 rounded-xl px-2.5 py-1 text-white shadow-inner">
          <Calendar className="w-3.5 h-3.5 text-yellow-400 shrink-0" />
          <span className="text-xs font-black hidden sm:inline">শিক্ষাবর্ষ:</span>
          <Select value={selectedYear} onValueChange={setSelectedYear}>
            <SelectTrigger className="h-7 w-[80px] bg-transparent border-0 text-white font-black text-xs focus:ring-0 px-1 py-0 shadow-none cursor-pointer">
              <SelectValue>{toBengaliNumber(selectedYear)}</SelectValue>
            </SelectTrigger>
            <SelectContent className="font-kalpurush font-bold bg-white text-slate-900 shadow-xl border border-slate-200">
              {availableYears.map(yr => (
                <SelectItem key={yr} value={yr}>
                  {toBengaliNumber(yr)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Dark Mode Theme Toggle */}
        <ThemeToggle />

        {!loading && (
          user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-10 w-10 rounded-full border-2 border-white/30 hover:border-white/60 transition-colors p-0 overflow-hidden">
                  <Avatar className="h-full w-full">
                    <AvatarImage src={userPhoto} alt={userName} />
                    <AvatarFallback className="bg-secondary text-primary font-black">
                      {userName.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent className="w-56 font-kalpurush" align="end" forceMount>
                <DropdownMenuLabel className="font-normal">
                  <div className="flex flex-col space-y-1">
                    <p className="text-sm font-bold leading-none">{userName}</p>
                    <p className="text-xs leading-none text-muted-foreground">{user.email}</p>
                  </div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                   <Link href="/settings" className="cursor-pointer">
                    <SettingsIcon className="mr-2 h-4 w-4" />
                    <span>সেটিংস</span>
                   </Link>
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                   <Link href="/calendar" className="cursor-pointer">
                    <Calendar className="mr-2 h-4 w-4" />
                    <span>বার্ষিক ক্যালেন্ডার</span>
                   </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleLogout} className="text-destructive focus:text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" />
                  <span>লগআউট</span>
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Link href="/auth">
              <Button 
                variant="secondary" 
                size="sm" 
                className="gap-2 font-black shadow-lg h-8"
              >
                <LogIn className="w-3.5 h-3.5" />
                লগইন
              </Button>
            </Link>
          )
        )}
      </div>
    </nav>
  );
}

export function Navbar() {
  return (
    <Suspense fallback={null}>
      <NavbarContent />
    </Suspense>
  );
}

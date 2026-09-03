
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
  FolderOpen
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
import { doc } from 'firebase/firestore';
import { cn } from '@/lib/utils';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';

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

  const appName = schoolInfo?.name || 'বীরগঞ্জ পৌর উচ্চ বিদ্যালয়';
  const appLogoUrl = schoolInfo?.logoUrl || '';

  const userName = userProfile?.displayName || user?.displayName || 'ব্যবহারকারী';
  const userPhoto = userProfile?.photoURL || user?.photoURL || '';

  const handleLogout = async () => {
    try {
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
    { label: 'হোম', icon: LayoutDashboard, href: '/' },
    { label: 'নোটিশ বোর্ড', icon: Bell, href: '/notices-management' },
    { label: 'শিক্ষার্থী প্রোফাইল', icon: Search, href: '/student-profile' },
    { label: 'নতুন শিক্ষার্থী ভর্তি', icon: UserPlus, href: '/add-student' },
    { label: 'শিক্ষার্থী তালিকা', icon: Users, href: '/student-list' },
    { label: 'দৈনিক হাজিরা', icon: CalendarCheck, href: '/attendance' },
    { label: 'ফলাফল ব্যবস্থাপনা', icon: Award, href: '/results' },
    { label: 'ফলাফল অনুসন্ধান', icon: Search, href: '/view-results' },
    { label: 'হিসাব শাখা', icon: Banknote, href: '/accounts' },
    { label: 'মেসেজ শাখা', icon: MessageSquare, href: '/messaging' },
    { label: 'স্টাফ পোর্টাল', icon: UserCog, href: '/staff' },
    { label: 'ডকুমেন্ট পোর্টাল', icon: FolderOpen, href: '/documents' },
    { label: 'নথিপত্র (আর্কাইভ)', icon: FileArchive, href: '/documents/archive' },
    { label: 'রুটিন শাখা', icon: Clock, href: '/routines' },
    { label: 'রেকর্ড শাখা', icon: Award, href: '/public-exam-records' },
    { label: 'টিচার্স ডায়েরি', icon: NotebookPen, href: '/diary' },
    { label: 'প্রশ্ন তৈরি', icon: PlusCircle, href: '/create-question' },
    { label: 'শিট তৈরি', icon: BookOpen, href: '/create-lecture-sheet' },
    { label: 'আমার লাইব্রেরি', icon: Library, href: '/my-questions' },
    { label: 'সেটিংস', icon: SettingsIcon, href: '/settings' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 h-14 md:h-[78px] bg-primary text-primary-foreground z-50 shadow-xl flex items-center px-4 md:px-6 no-print border-b border-white/10 font-kalpurush">
      {/* Sidebar Menu Trigger */}
      <Sheet>
        <SheetTrigger asChild>
          <Button variant="ghost" size="icon" className="mr-2 text-white hover:bg-white/10 shrink-0">
            <Menu className="w-6 h-6" />
          </Button>
        </SheetTrigger>
        <SheetContent side="left" className="w-[280px] p-0 border-r-primary/20 font-kalpurush flex flex-col h-full max-h-screen">
          <SheetHeader className="p-6 bg-primary text-white border-b border-white/10 shrink-0">
            <div className="flex items-center gap-3">
              <div className="bg-white p-1.5 rounded-xl text-primary shadow-lg shrink-0">
                {appLogoUrl ? (
                  <img src={appLogoUrl} alt="Logo" className="w-8 h-8 object-contain" />
                ) : (
                  <BookOpenText className="w-8 h-8" />
                )}
              </div>
              <SheetTitle className="text-white text-[14px] font-black leading-tight text-left">
                {appName}
              </SheetTitle>
            </div>
          </SheetHeader>
          
          <div className="flex-1 overflow-y-auto py-2">
            {navItems.map((item) => {
              const isActive = pathname === item.href || (item.href !== '/' && pathname?.startsWith(item.href));
              return (
                <SheetClose asChild key={item.href}>
                  <Link
                    href={item.href}
                    className={cn(
                      "flex items-center justify-between px-5 py-3 transition-all hover:bg-primary/5 group",
                      isActive ? "bg-primary/10 text-primary border-r-4 border-primary" : "text-foreground/70"
                    )}
                  >
                    <div className="flex items-center gap-3.5">
                      <item.icon className={cn("w-4 h-4", isActive ? "text-primary" : "text-muted-foreground group-hover:text-primary")} />
                      <span className={cn("font-bold text-xs md:text-sm", isActive && "text-primary")}>{item.label}</span>
                    </div>
                    <ChevronRight className={cn("w-3.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity", isActive ? "opacity-100 text-primary" : "text-muted-foreground")} />
                  </Link>
                </SheetClose>
              );
            })}
          </div>
          
          <div className="shrink-0 p-4 border-t bg-slate-50">
             <p className="text-[10px] font-black text-muted-foreground uppercase tracking-widest text-center">© ২০২৪-২৬ {appName}</p>
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
      
      <div className="ml-auto flex items-center gap-2 md:gap-4">
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
              <DropdownMenuContent className="w-56" align="end" forceMount>
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


"use client";

import { useState, useMemo } from 'react';
import { useAuth, useFirestore, useDoc } from '@/firebase';
import { 
  createUserWithEmailAndPassword, 
  signInWithEmailAndPassword,
  updateProfile,
  signOut
} from 'firebase/auth';
import { doc, getDoc, setDoc, serverTimestamp } from 'firebase/firestore';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { 
  Dialog, 
  DialogContent, 
  DialogHeader, 
  DialogTitle, 
  DialogTrigger 
} from '@/components/ui/dialog';
import { toast } from '@/hooks/use-toast';
import { 
  Loader2, 
  LogIn, 
  UserPlus, 
  Search, 
  Users, 
  GraduationCap, 
  Calendar, 
  Trophy, 
  MapPin, 
  Phone, 
  CheckCircle2, 
  ShieldCheck, 
  BarChart3,
  Megaphone,
  Globe
} from 'lucide-react';
import { cn } from '@/lib/utils';

export default function AuthPage() {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [loading, setLoading] = useState(false);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  
  const auth = useAuth();
  const db = useFirestore();
  const router = useRouter();

  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appName = softwareConfig?.appName || 'বীরগঞ্জ পৌর উচ্চ বিদ্যালয়';
  const appLogoUrl = softwareConfig?.appLogoUrl || '';

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (isLogin) {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        
        if (user.email !== 'dlswf.roy@gmail.com') {
          const userDoc = await getDoc(doc(db, 'users', user.uid));
          if (!userDoc.exists() || userDoc.data().status !== 'active') {
            await signOut(auth);
            toast({ 
              variant: "destructive", 
              title: "অ্যাকাউন্ট নিষ্ক্রিয়", 
              description: "আপনার অ্যাকাউন্টটি অনুমোদনের জন্য পেন্ডিং আছে।" 
            });
            setLoading(false);
            return;
          }
        }
        toast({ title: "সফল লগইন" });
      } else {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        await updateProfile(userCredential.user, { displayName: name });
        
        const isSuperAdmin = userCredential.user.email === 'dlswf.roy@gmail.com';
        
        await setDoc(doc(db, 'users', userCredential.user.uid), {
          uid: userCredential.user.uid,
          email: userCredential.user.email,
          displayName: name,
          status: isSuperAdmin ? 'active' : 'pending',
          createdAt: serverTimestamp()
        });

        if (!isSuperAdmin) {
          await signOut(auth);
          toast({ title: "আবেদন জমা হয়েছে", description: "অনুমোদন পেলে লগইন করতে পারবেন।" });
          setIsLogin(true);
          setLoading(false);
          return;
        }
        toast({ title: "সফল রেজিস্ট্রেশন" });
      }
      setIsDialogOpen(false);
      router.push('/');
    } catch (error: any) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "অথেনটিকেশন ব্যর্থ হয়েছে।" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col font-kalpurush bg-slate-50 -mt-20 -mx-4 overflow-x-hidden">
      {/* 1. Deep Blue Header */}
      <header className="bg-[#1e293b] text-white py-4 px-6 md:px-12 flex flex-col md:flex-row justify-between items-center gap-4">
        <div className="flex items-center gap-4">
          <div className="bg-white p-1 rounded-full w-14 h-14 flex items-center justify-center overflow-hidden shrink-0">
             {appLogoUrl ? <img src={appLogoUrl} alt="Logo" className="max-w-full" /> : <GraduationCap className="w-10 h-10 text-[#1e293b]" />}
          </div>
          <div>
            <h1 className="text-xl md:text-2xl font-black tracking-tight uppercase leading-tight">{appName}</h1>
            <p className="text-[10px] md:text-xs font-bold text-slate-400 tracking-[0.2em] uppercase">Digital Management Portal</p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="flex bg-white rounded-md overflow-hidden p-0.5">
             <Button variant="ghost" size="sm" className="h-7 text-[10px] font-black px-3 rounded-sm bg-[#4f46e5] text-white hover:bg-[#4f46e5]/90">বাংলা</Button>
             <Button variant="ghost" size="sm" className="h-7 text-[10px] font-black px-3 rounded-sm text-slate-500 hover:bg-slate-100">English</Button>
          </div>
          <div className="bg-[#334155] px-3 py-1 rounded-full border border-slate-500/50">
            <span className="text-[10px] font-black text-slate-200">সেশন: ২০২৫</span>
          </div>
        </div>
      </header>

      {/* 2. Emergency Notice (Marquee) */}
      <div className="bg-[#ef4444] text-white py-1.5 flex items-center relative overflow-hidden">
        <div className="px-4 bg-[#ef4444] z-10 font-black text-xs flex items-center gap-2 border-r border-white/20 whitespace-nowrap">
           <Megaphone className="w-3.5 h-3.5" /> জরুরি নোটিশ:
        </div>
        <div className="flex-1 overflow-hidden whitespace-nowrap">
          <div className="inline-block animate-marquee font-bold text-xs uppercase tracking-wide py-0.5">
            আগামী ২৫ আগস্ট ২০২৪ বুধবার স্কুল বন্ধ থাকবে। এই সময়ে বিদ্যালয়ের সকল শিক্ষা মূলক ও দাপ্তরিক কার্যক্রম সম্পূর্ণরুপে স্থগিত থাকবে। বিদ্যালয় পুনরায় ২৭ আগস্ট ২০২৪ তারিখে যথারীতি খুলবে। কর্তৃপক্ষ নির্দেশক্রমে। 
          </div>
        </div>
      </div>

      {/* 3. Hero Section */}
      <section className="relative h-[550px] flex items-center overflow-hidden">
        {/* Mock Background simulating the wood wall/group photo */}
        <div className="absolute inset-0 bg-gradient-to-r from-black/80 via-black/40 to-transparent z-10" />
        <img 
          src="https://picsum.photos/seed/school/1600/800" 
          alt="School Background" 
          className="absolute inset-0 w-full h-full object-cover"
          data-ai-hint="school building"
        />
        
        <div className="container mx-auto px-6 md:px-12 relative z-20">
          <div className="max-w-2xl space-y-6">
            <div className="space-y-2">
              <h2 className="text-3xl md:text-5xl font-black text-white leading-tight">
                সৃজনশীল শিক্ষায় <span className="text-yellow-400">এক ধাপ এগিয়ে...</span>
              </h2>
              <p className="text-slate-200 text-sm md:text-base font-medium leading-relaxed max-w-lg">
                {appName} এর কেন্দ্রীয় ডিজিটাল ম্যানেজমেন্ট পোর্টালে আপনাকে স্বাগতম। আধুনিক শিক্ষা ও প্রশাসনিক কাজে স্বচ্ছতা নিশ্চিত করতে আমাদের এই ডিজিটাল উদ্যোগ।
              </p>
            </div>

            <div className="flex flex-wrap gap-4 pt-4">
              <Button className="bg-[#1e293b] hover:bg-black text-white font-black gap-2 h-12 px-6 border-b-4 border-black transition-all">
                <Search className="w-4 h-4" /> ফলাফল অনুসন্ধান
              </Button>
              <Button className="bg-[#059669] hover:bg-[#047857] text-white font-black gap-2 h-12 px-6 border-b-4 border-[#064e3b] transition-all">
                <UserPlus className="w-4 h-4" /> অনলাইন ভর্তি
              </Button>
              
              <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                <DialogTrigger asChild>
                  <Button className="bg-[#dc2626] hover:bg-[#b91c1c] text-white font-black gap-2 h-12 px-10 border-b-4 border-[#7f1d1d] transition-all">
                    <LogIn className="w-4 h-4" /> লগইন করুন
                  </Button>
                </DialogTrigger>
                <DialogContent className="sm:max-w-md font-kalpurush border-none p-0 overflow-hidden rounded-2xl shadow-2xl">
                   <div className="bg-[#1e293b] p-6 text-white text-center space-y-2">
                      <div className="bg-white w-16 h-16 rounded-2xl mx-auto flex items-center justify-center p-2 mb-2">
                         <img src={appLogoUrl || "https://placehold.co/100x100?text=Logo"} alt="Logo" className="max-w-full" />
                      </div>
                      <DialogTitle className="text-xl font-black">{isLogin ? 'সদস্য লগইন' : 'নতুন আবেদন'}</DialogTitle>
                      <p className="text-xs text-slate-400 font-bold">সঠিক তথ্য দিয়ে ড্যাশবোর্ডে প্রবেশ করুন</p>
                   </div>
                   <div className="p-8 bg-white">
                      <form onSubmit={handleAuth} className="space-y-5">
                        {!isLogin && (
                          <div className="space-y-1.5">
                            <label className="text-xs font-black text-slate-600 ml-1">আপনার নাম</label>
                            <Input placeholder="পুরো নাম" value={name} onChange={(e) => setName(e.target.value)} required={!isLogin} className="font-bold h-11 bg-slate-50 border-slate-200 focus:ring-slate-400" />
                          </div>
                        )}
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-slate-600 ml-1">ইমেইল এড্রেস</label>
                          <Input type="email" placeholder="example@gmail.com" value={email} onChange={(e) => setEmail(e.target.value)} required className="font-bold h-11 bg-slate-50 border-slate-200 focus:ring-slate-400" />
                        </div>
                        <div className="space-y-1.5">
                          <label className="text-xs font-black text-slate-600 ml-1">পাসওয়ার্ড</label>
                          <Input type="password" placeholder="******" value={password} onChange={(e) => setPassword(e.target.value)} required className="font-bold h-11 bg-slate-50 border-slate-200 focus:ring-slate-400" />
                        </div>
                        <Button className="w-full h-12 font-black text-lg gap-2 bg-[#1e293b] hover:bg-black shadow-lg" disabled={loading}>
                          {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : (isLogin ? <LogIn className="w-5 h-5" /> : <UserPlus className="w-5 h-5" />)}
                          {isLogin ? 'ড্যাশবোর্ডে প্রবেশ করুন' : 'আবেদন জমা দিন'}
                        </Button>
                      </form>
                      <div className="mt-6 pt-6 border-t text-center">
                         <button onClick={() => setIsLogin(!isLogin)} className="text-sm font-black text-[#4f46e5] hover:underline">
                            {isLogin ? 'নতুন অ্যাকাউন্ট আবেদন করতে চান?' : 'ইতিপূর্বে অ্যাকাউন্ট আছে? লগইন করুন'}
                         </button>
                      </div>
                   </div>
                </DialogContent>
              </Dialog>
            </div>

            <div className="flex flex-wrap gap-6 pt-6">
               <div className="flex items-center gap-2 text-white/90 font-bold text-xs">
                  <CheckCircle2 className="w-4 h-4 text-yellow-400" /> ডিজিটাল হাজিরা
               </div>
               <div className="flex items-center gap-2 text-white/90 font-bold text-xs">
                  <ShieldCheck className="w-4 h-4 text-yellow-400" /> নিরাপদ তত্ত্বাবধান
               </div>
               <div className="flex items-center gap-2 text-white/90 font-bold text-xs">
                  <BarChart3 className="w-4 h-4 text-yellow-400" /> স্বচ্ছ হিসাব শাখা
               </div>
            </div>
          </div>
        </div>

        {/* 4. Stats Cards Overlay */}
        <div className="absolute bottom-0 left-0 right-0 z-30 translate-y-1/2 px-6 md:px-12">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 max-w-6xl mx-auto">
            <Card className="bg-white border-none shadow-xl rounded-2xl md:rounded-3xl overflow-hidden group hover:-translate-y-2 transition-all">
               <CardContent className="p-4 md:p-6 flex flex-col gap-4">
                  <div className="bg-blue-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-blue-600 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                     <Users className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-2xl md:text-4xl font-black text-slate-800">১৬৭</p>
                    <p className="text-[10px] md:text-xs font-black text-blue-600 uppercase tracking-wider">শিক্ষার্থী</p>
                  </div>
               </CardContent>
            </Card>
            <Card className="bg-white border-none shadow-xl rounded-2xl md:rounded-3xl overflow-hidden group hover:-translate-y-2 transition-all">
               <CardContent className="p-4 md:p-6 flex flex-col gap-4">
                  <div className="bg-emerald-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-emerald-600 group-hover:bg-emerald-600 group-hover:text-white transition-colors">
                     <GraduationCap className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-2xl md:text-4xl font-black text-slate-800">১০</p>
                    <p className="text-[10px] md:text-xs font-black text-emerald-600 uppercase tracking-wider">শিক্ষক</p>
                  </div>
               </CardContent>
            </Card>
            <Card className="bg-white border-none shadow-xl rounded-2xl md:rounded-3xl overflow-hidden group hover:-translate-y-2 transition-all">
               <CardContent className="p-4 md:p-6 flex flex-col gap-4">
                  <div className="bg-indigo-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-indigo-600 group-hover:bg-indigo-600 group-hover:text-white transition-colors">
                     <Calendar className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-2xl md:text-4xl font-black text-slate-800">০.০%</p>
                    <p className="text-[10px] md:text-xs font-black text-indigo-600 uppercase tracking-wider">উপস্থিতি</p>
                  </div>
               </CardContent>
            </Card>
            <Card className="bg-white border-none shadow-xl rounded-2xl md:rounded-3xl overflow-hidden group hover:-translate-y-2 transition-all">
               <CardContent className="p-4 md:p-6 flex flex-col gap-4">
                  <div className="bg-rose-50 w-10 h-10 md:w-12 md:h-12 rounded-xl flex items-center justify-center text-rose-600 group-hover:bg-rose-600 group-hover:text-white transition-colors">
                     <Trophy className="w-5 h-5 md:w-6 md:h-6" />
                  </div>
                  <div>
                    <p className="text-2xl md:text-4xl font-black text-slate-800">০.০%</p>
                    <p className="text-[10px] md:text-xs font-black text-rose-600 uppercase tracking-wider">এস এস সি পরীক্ষা-২০২৭</p>
                  </div>
               </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <div className="h-32 md:h-40" />

      {/* 5. Footer */}
      <footer className="mt-auto bg-[#0f172a] text-slate-400 py-8 px-6 md:px-12 border-t border-white/5 no-print">
        <div className="container mx-auto flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="flex flex-wrap justify-center gap-4 md:gap-8 text-[10px] md:text-xs font-bold uppercase tracking-wider">
            <div className="flex items-center gap-2">
              <Globe className="w-3.5 h-3.5" /> © ২০২৪ {appName}
            </div>
            <div className="flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#ef4444]" /> Upazila: Birganj, Post: Birganj, Zila: Dinajpur
            </div>
            <div className="flex items-center gap-2">
              <Phone className="w-3.5 h-3.5 text-[#22c55e]" /> ০১৭১৭৫৭৬৩৩০
            </div>
          </div>
          <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-tighter text-blue-500/60">
             <BarChart3 className="w-3.5 h-3.5" /> Digital Management Portal | Version 2.0
          </div>
        </div>
      </footer>

      <style jsx global>{`
        @keyframes marquee {
          0% { transform: translateX(100%); }
          100% { transform: translateX(-100%); }
        }
        .animate-marquee {
          display: inline-block;
          animation: marquee 25s linear infinite;
          padding-left: 100%;
        }
      `}</style>
    </div>
  );
}

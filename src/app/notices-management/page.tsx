'use client';

import { useState, useEffect, useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { 
    Trash2, Plus, Loader2, Bell, Printer, FileText, ExternalLink, Sparkles, AlertCircle, RefreshCw, CheckCircle2, ArrowLeft
} from 'lucide-react';
import { format } from "date-fns";
import { bn } from 'date-fns/locale';
import { toast } from "@/hooks/use-toast";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, onSnapshot, query, orderBy, limit, Timestamp, doc } from 'firebase/firestore';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogClose, DialogFooter, DialogDescription } from '@/components/ui/dialog';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { addNotice, deleteNotice, updateNoticeScrolling, Notice } from '@/lib/notice-data';
import { generateNotice } from '@/ai/flows/generate-notice-flow';
import { cn } from '@/lib/utils';
import { useRouter } from 'next/navigation';
import { Switch } from '@/components/ui/switch';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import Link from 'next/link';

const toBengaliNumber = (str: string | number | undefined | null) => {
    if (!str && str !== 0) return '';
    const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
    return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export default function NoticeManagementPage() {
    const db = useFirestore();
    const { user, loading: authLoading } = useUser();
    const router = useRouter();
    
    const softwareDocRef = useMemo(() => db ? doc(db, 'config', 'software') : null, [db]);
    const { data: softwareConfig } = useDoc(softwareDocRef);
    const institutionName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';
    const institutionLogoUrl = softwareConfig?.appLogoUrl || '';

    const [notices, setNotices] = useState<Notice[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [isAddOpen, setIsAddOpen] = useState(false);
    const [isAiLoading, setIsAiLoading] = useState(false);
    const [aiTopic, setAiTopic] = useState('');
    const [isClient, setIsClient] = useState(false);

    const [newNotice, setNewNotice] = useState({ title: '', content: '', priority: 'normal' as Notice['priority'], pdfUrl: '', isScrolling: true });
    const [printingNotice, setPrintingNotice] = useState<Notice | null>(null);

    useEffect(() => {
        setIsClient(true);
    }, []);

    // Reactive listener for real-time notice list
    useEffect(() => {
        if (!isClient || authLoading || !user || !db) return;
        
        setIsLoading(true);
        const q = query(collection(db, 'notices'), orderBy('date', 'desc'), limit(50));
        
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => {
                const docData = doc.data();
                return {
                    id: doc.id,
                    ...docData,
                    date: docData.date instanceof Timestamp ? docData.date.toDate() : (docData.date ? new Date(docData.date) : null),
                } as Notice;
            });
            setNotices(data);
            setIsLoading(false);
        }, (error) => {
            if (error.code === 'permission-denied') {
                errorEmitter.emit('permission-error', new FirestorePermissionError({ path: 'notices', operation: 'list' }));
            }
            setIsLoading(false);
        });

        return () => unsubscribe();
    }, [db, user, isClient, authLoading]);

    const handleAiGenerate = async () => {
      if (!aiTopic.trim()) {
        toast({ variant: 'destructive', title: 'বিষয় লিখুন', description: 'AI দিয়ে ড্রাফট করতে একটি বিষয় লিখুন।' });
        return;
      }

      setIsAiLoading(true);
      try {
        const result = await generateNotice({ topic: aiTopic });
        setNewNotice(prev => ({
          ...prev,
          title: result.title,
          content: result.content
        }));
        toast({ title: 'AI ড্রাফট তৈরি হয়েছে' });
        setAiTopic('');
      } catch (error) {
        toast({ variant: 'destructive', title: 'AI ত্রুটি', description: 'AI দিয়ে নোটিশ তৈরি করা সম্ভব হয়নি।' });
      } finally {
        setIsAiLoading(false);
      }
    };

    const handleAddNotice = () => {
        if (!db || !user) return;
        if (!newNotice.title.trim() || !newNotice.content.trim()) {
            toast({ variant: 'destructive', title: 'তথ্য অসম্পূর্ণ', description: 'শিরোনাম এবং বিষয়বস্তু উভয়ই লিখুন।' });
            return;
        }

        const senderName = user.displayName || user.email || 'কর্তৃপক্ষ';

        try {
            addNotice(db, {
                title: newNotice.title,
                content: newNotice.content,
                priority: newNotice.priority,
                senderName: senderName,
                pdfUrl: newNotice.pdfUrl.trim() || undefined,
                isScrolling: !!newNotice.isScrolling
            });
            
            toast({ title: 'নোটিশ প্রকাশিত হয়েছে' });
            setIsAddOpen(false);
            setNewNotice({ title: '', content: '', priority: 'normal', pdfUrl: '', isScrolling: true });
        } catch (e: any) {
            console.error("Notice Submit Error:", e);
            toast({ variant: 'destructive', title: 'ত্রুটি', description: 'নোটিশ সেভ করা যায়নি।' });
        }
    };

    const handleToggleScrolling = (id: string, currentStatus: boolean) => {
        if (!db) return;
        updateNoticeScrolling(db, id, !currentStatus);
        toast({ title: 'স্ক্রল স্ট্যাটাস পরিবর্তন হয়েছে' });
    };

    const handleDelete = (id: string) => {
        if (!db) return;
        deleteNotice(db, id);
        toast({ title: 'নোটিশ মুছে ফেলা হয়েছে' });
    };

    const handlePrint = (notice: Notice) => {
        setPrintingNotice(notice);
        setTimeout(() => {
            window.print();
            setPrintingNotice(null);
        }, 300);
    };

    if (!isClient || authLoading) {
        return (
            <div className="flex h-[60vh] items-center justify-center">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
            </div>
        );
    }

    if (!user) {
        return (
            <div className="flex items-center justify-center p-12">
                <Card className="max-w-md w-full border-2 border-rose-200 text-center p-10">
                    <AlertCircle className="h-16 w-16 text-rose-500 mx-auto mb-4" />
                    <CardTitle className="text-2xl font-black text-rose-950 mb-2">প্রবেশাধিকার নেই</CardTitle>
                    <CardDescription className="text-base font-bold">নোটিশ বোর্ড দেখতে অনুগ্রহ করে লগইন করুন।</CardDescription>
                    <Button className="mt-6" onClick={() => router.push('/auth')}>লগইন করুন</Button>
                </Card>
            </div>
        );
    }

    return (
        <div className="space-y-6 font-kalpurush">
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 no-print border-b pb-4">
                <div>
                    <div className="flex items-center gap-2">
                        <Link href="/">
                            <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground hover:text-primary">
                                <ArrowLeft className="h-4 w-4" />
                            </Button>
                        </Link>
                        <h2 className="text-2xl md:text-3xl font-black text-slate-800 flex items-center gap-2">
                            <Bell className="h-7 w-7 text-primary" />
                            নোটিশ বোর্ড
                        </h2>
                    </div>
                    <p className="text-xs md:text-sm font-bold text-muted-foreground mt-1 ml-10">
                        {institutionName}-এর সকল নোটিশ ও গুরুত্বপূর্ণ ঘোষণা পরিচালনা করুন
                    </p>
                </div>
                
                <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
                    <DialogTrigger asChild>
                        <Button className="font-black h-11 px-6 shadow-md text-sm bg-primary hover:bg-primary/90 text-white rounded-xl">
                            <Plus className="mr-1.5 h-5 w-5" /> নতুন নোটিশ প্রকাশ
                        </Button>
                    </DialogTrigger>
                    <DialogContent className="sm:max-w-[650px] font-kalpurush">
                        <DialogHeader>
                            <DialogTitle className="text-xl font-black text-primary flex items-center gap-2">
                                <Bell className="h-5 w-5" /> নতুন নোটিশ তৈরি করুন
                            </DialogTitle>
                            <DialogDescription className="text-xs font-bold text-muted-foreground">
                                প্রয়োজনীয় তথ্য পূরণ করে নোটিশ প্রকাশ করুন অথবা AI-এর সহায়তা নিন।
                            </DialogDescription>
                        </DialogHeader>

                        {/* AI Generator Helper Bar */}
                        <div className="p-3 bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-200 rounded-xl space-y-2">
                            <Label className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                                <Sparkles className="h-3.5 w-3.5 text-indigo-600" /> AI দিয়ে দ্রুত নোটিশ তৈরি করুন
                            </Label>
                            <div className="flex gap-2">
                                <Input 
                                    placeholder="বিষয় লিখুন (যেমন: রমজানের ছুটির নোটিশ)..." 
                                    value={aiTopic}
                                    onChange={(e) => setAiTopic(e.target.value)}
                                    className="bg-white text-xs h-9"
                                    disabled={isAiLoading}
                                    onKeyDown={(e) => e.key === 'Enter' && handleAiGenerate()}
                                />
                                <Button 
                                    type="button"
                                    onClick={handleAiGenerate}
                                    disabled={isAiLoading}
                                    className="bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 font-black text-xs h-9 px-3"
                                >
                                    {isAiLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'AI ড্রাফট'}
                                </Button>
                            </div>
                        </div>

                        <div className="grid gap-4 py-2">
                            <div className="space-y-1.5">
                                <Label htmlFor="title" className="font-black text-xs">নোটিশের শিরোনাম *</Label>
                                <Input 
                                    id="title" 
                                    placeholder="যেমন: গ্রীষ্মকালীন অবকাশ সংক্রান্ত জরুরি নোটিশ" 
                                    value={newNotice.title}
                                    onChange={(e) => setNewNotice({ ...newNotice, title: e.target.value })}
                                    className="font-bold text-sm"
                                />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-1.5">
                                    <Label htmlFor="priority" className="font-black text-xs">গুরুত্ব (Priority)</Label>
                                    <Select 
                                        value={newNotice.priority} 
                                        onValueChange={(val: Notice['priority']) => setNewNotice({ ...newNotice, priority: val })}
                                    >
                                        <SelectTrigger className="font-bold text-xs h-9">
                                            <SelectValue placeholder="গুরুত্ব নির্বাচন" />
                                        </SelectTrigger>
                                        <SelectContent className="font-kalpurush">
                                            <SelectItem value="normal">সাধারণ (Normal)</SelectItem>
                                            <SelectItem value="important">গুরুত্বপূর্ণ (Important)</SelectItem>
                                            <SelectItem value="urgent">জরুরি (Urgent)</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="space-y-1.5">
                                    <Label htmlFor="pdf" className="font-black text-xs">PDF ফাইল লিংক (ঐচ্ছিক)</Label>
                                    <Input 
                                        id="pdf" 
                                        placeholder="https://drive.google.com/..." 
                                        value={newNotice.pdfUrl}
                                        onChange={(e) => setNewNotice({ ...newNotice, pdfUrl: e.target.value })}
                                        className="text-xs h-9"
                                    />
                                </div>
                            </div>

                            <div className="space-y-1.5">
                                <Label htmlFor="content" className="font-black text-xs">নোটিশের বিস্তারিত বিষয়বস্তু *</Label>
                                <Textarea 
                                    id="content" 
                                    placeholder="নোটিশের বিস্তারিত অংশ বাংলায় লিখুন..." 
                                    rows={5}
                                    value={newNotice.content}
                                    onChange={(e) => setNewNotice({ ...newNotice, content: e.target.value })}
                                    className="font-bold text-xs leading-relaxed"
                                />
                            </div>

                            <div className="flex items-center justify-between p-3 bg-yellow-50 rounded-xl border border-yellow-200">
                                <div>
                                    <Label className="font-black text-xs text-yellow-900">হোমপেজে স্ক্রলিং নোটিশে দেখান</Label>
                                    <p className="text-[10px] text-yellow-700 font-bold">হোমপেজের উপরে স্ক্রলিং টিকারে এই নোটিশটি প্রদর্শিত হবে</p>
                                </div>
                                <Switch 
                                    checked={newNotice.isScrolling}
                                    onCheckedChange={(checked) => setNewNotice({ ...newNotice, isScrolling: checked })}
                                />
                            </div>
                        </div>

                        <DialogFooter className="gap-2 sm:gap-0">
                            <DialogClose asChild>
                                <Button variant="outline" className="font-bold text-xs">বাতিল</Button>
                            </DialogClose>
                            <Button onClick={handleAddNotice} className="bg-primary hover:bg-primary/90 font-black text-xs">
                                <CheckCircle2 className="w-4 h-4 mr-1" /> নোটিশ প্রকাশ করুন
                            </Button>
                        </DialogFooter>
                    </DialogContent>
                </Dialog>
            </div>

            {/* List of notices */}
            <Card className="shadow-lg border rounded-2xl overflow-hidden no-print">
                <CardHeader className="bg-slate-50/80 border-b p-4">
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
                            <FileText className="h-4 w-4 text-primary" /> সকল প্রকাশিত নোটিশ ({toBengaliNumber(notices.length)})
                        </CardTitle>
                    </div>
                </CardHeader>
                <CardContent className="p-0">
                    {isLoading ? (
                        <div className="flex h-40 items-center justify-center">
                            <Loader2 className="h-6 w-6 animate-spin text-primary" />
                        </div>
                    ) : notices.length === 0 ? (
                        <div className="text-center py-16 text-muted-foreground font-bold">
                            <Bell className="h-12 w-12 text-slate-300 mx-auto mb-3" />
                            <p className="text-base">বর্তমানে কোনো নোটিশ নেই।</p>
                            <p className="text-xs mt-1">নতুন নোটিশ তৈরি করতে &apos;নতুন নোটিশ প্রকাশ&apos; বাটনে ক্লিক করুন।</p>
                        </div>
                    ) : (
                        <div className="overflow-x-auto">
                            <Table>
                                <TableHeader className="bg-slate-100/60 font-black text-xs">
                                    <TableRow>
                                        <TableHead className="w-[100px]">তারিখ</TableHead>
                                        <TableHead className="w-[90px]">গুরুত্ব</TableHead>
                                        <TableHead>শিরোনাম ও বিবরণ</TableHead>
                                        <TableHead className="w-[110px] text-center">স্ক্রলিং</TableHead>
                                        <TableHead className="w-[140px] text-right">অ্যাকশন</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {notices.map((n) => (
                                        <TableRow key={n.id} className="hover:bg-slate-50/80 transition-colors">
                                            <TableCell className="font-bold text-xs whitespace-nowrap text-slate-600">
                                                {n.date ? toBengaliNumber(format(n.date, 'dd/MM/yyyy')) : 'N/A'}
                                            </TableCell>
                                            <TableCell>
                                                {n.priority === 'urgent' && <Badge className="bg-red-500 hover:bg-red-600 text-[10px] font-black">জরুরি</Badge>}
                                                {n.priority === 'important' && <Badge className="bg-amber-500 hover:bg-amber-600 text-[10px] font-black">গুরুত্বপূর্ণ</Badge>}
                                                {n.priority === 'normal' && <Badge variant="secondary" className="text-[10px] font-bold">সাধারণ</Badge>}
                                            </TableCell>
                                            <TableCell>
                                                <div>
                                                    <p className="font-black text-sm text-slate-900 leading-snug">{n.title}</p>
                                                    <p className="text-xs text-slate-600 mt-1 line-clamp-2 leading-relaxed font-bold">{n.content}</p>
                                                    {n.pdfUrl && (
                                                        <a 
                                                            href={n.pdfUrl} 
                                                            target="_blank" 
                                                            rel="noopener noreferrer" 
                                                            className="inline-flex items-center text-[11px] font-bold text-blue-600 hover:underline mt-1.5 gap-1"
                                                        >
                                                            <ExternalLink className="h-3 w-3" /> PDF ডকুমেন্ট দেখুন
                                                        </a>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell className="text-center">
                                                <Switch 
                                                    checked={!!n.isScrolling}
                                                    onCheckedChange={() => handleToggleScrolling(n.id, !!n.isScrolling)}
                                                />
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <div className="flex items-center justify-end gap-1.5">
                                                    <Button 
                                                        variant="outline" 
                                                        size="sm" 
                                                        onClick={() => handlePrint(n)}
                                                        className="h-8 px-2.5 font-bold text-xs text-slate-700 hover:bg-slate-100"
                                                        title="প্রিন্ট করুন"
                                                    >
                                                        <Printer className="h-3.5 w-3.5 mr-1" /> প্রিন্ট
                                                    </Button>

                                                    <AlertDialog>
                                                        <AlertDialogTrigger asChild>
                                                            <Button 
                                                                variant="ghost" 
                                                                size="sm" 
                                                                className="h-8 w-8 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                                                title="মুছে ফেলুন"
                                                            >
                                                                <Trash2 className="h-4 w-4" />
                                                            </Button>
                                                        </AlertDialogTrigger>
                                                        <AlertDialogContent className="font-kalpurush">
                                                            <AlertDialogHeader>
                                                                <AlertDialogTitle className="font-black text-red-600">নোটিশটি মুছে ফেলতে চান?</AlertDialogTitle>
                                                                <AlertDialogDescription className="font-bold text-xs">
                                                                    &quot;{n.title}&quot; নোটিশটি স্থায়ীভাবে মুছে ফেলা হবে। এটি আর ফিরিয়ে আনা যাবে না।
                                                                </AlertDialogDescription>
                                                            </AlertDialogHeader>
                                                            <AlertDialogFooter>
                                                                <AlertDialogCancel className="font-bold text-xs">বাতিল</AlertDialogCancel>
                                                                <AlertDialogAction 
                                                                    onClick={() => handleDelete(n.id)}
                                                                    className="bg-red-600 hover:bg-red-700 font-black text-xs"
                                                                >
                                                                    মুছে ফেলুন
                                                                </AlertDialogAction>
                                                            </AlertDialogFooter>
                                                        </AlertDialogContent>
                                                    </AlertDialog>
                                                </div>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* Printable Notice Paper Format */}
            {printingNotice && (
                <div className="hidden print:block fixed inset-0 bg-white p-12 text-black z-[99999] font-kalpurush">
                    <div className="border-4 border-double border-slate-900 p-8 h-full flex flex-col justify-between">
                        <div>
                            {/* Institution Header */}
                            <div className="text-center border-b-2 border-slate-900 pb-4 mb-6">
                                {institutionLogoUrl && (
                                    <img src={institutionLogoUrl} alt="Logo" className="w-16 h-16 mx-auto mb-2 object-contain" />
                                )}
                                <h1 className="text-3xl font-black tracking-tight">{institutionName}</h1>
                                <p className="text-sm font-bold text-slate-700 mt-1">ডিজিটাল নোটিশ ও তথ্য বোর্ড</p>
                            </div>

                            {/* Reference and Date */}
                            <div className="flex justify-between items-center text-xs font-bold mb-8 px-2">
                                <span>স্মারক নং: {toBengaliNumber('MB-' + (printingNotice.id.slice(0, 6).toUpperCase()))}</span>
                                <span>তারিখ: {printingNotice.date ? toBengaliNumber(format(printingNotice.date, 'dd MMMM yyyy', { locale: bn })) : ''}</span>
                            </div>

                            {/* Notice Subject */}
                            <div className="text-center mb-8">
                                <span className="inline-block bg-slate-900 text-white px-6 py-1.5 text-lg font-black tracking-widest rounded-md uppercase mb-3">
                                    নোটিশ
                                </span>
                                <h2 className="text-xl font-black text-slate-900 mt-2 underline underline-offset-4">
                                    বিষয়: {printingNotice.title}
                                </h2>
                            </div>

                            {/* Notice Body */}
                            <div className="text-base leading-relaxed text-justify px-4 whitespace-pre-line font-bold">
                                {printingNotice.content}
                            </div>
                        </div>

                        {/* Signatures Footer */}
                        <div className="mt-20 flex justify-between items-end px-6 border-t pt-8">
                            <div className="text-center">
                                <div className="w-32 border-b border-dashed border-black mb-1"></div>
                                <p className="text-xs font-bold text-slate-700">নোটিশ প্রদানকারী</p>
                            </div>
                            <div className="text-center">
                                <div className="w-40 border-b border-dashed border-black mb-1"></div>
                                <p className="text-xs font-black text-slate-900">কর্তৃপক্ষ / অধ্যক্ষ</p>
                                <p className="text-[10px] font-bold text-slate-600">{institutionName}</p>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

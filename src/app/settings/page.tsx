
"use client";

import { useState, useMemo, useEffect, useRef, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { Card, CardContent, CardHeader, CardTitle, CardFooter, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Settings as SettingsIcon, 
  CheckCircle, 
  Trash2, 
  Loader2, 
  Link as LinkIcon, 
  BookCopy, 
  User, 
  Globe, 
  Save, 
  Camera, 
  FileText, 
  Users, 
  ShieldCheck, 
  FileUp, 
  FileType,
  BookOpen,
  School,
  Calendar,
  HardDriveDownload,
  Monitor,
  ImageIcon,
  ChevronRight
} from 'lucide-react';
import { 
  SchoolInfoSettings, 
  HolidaySettings, 
  UserManagementSettings, 
  BackupAndExportSettings, 
  GalleryManagementSettings, 
  SystemUsageInfo 
} from '@/components/settings/BpsSettingsComponents';
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { toast } from '@/hooks/use-toast';
import { useFirestore, useCollection, useUser, useDoc, useStorage } from '@/firebase';
import { collection, addDoc, deleteDoc, doc, getDoc, setDoc, serverTimestamp, query, where, getDocs, updateDoc } from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import { updateProfile } from 'firebase/auth';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Progress } from '@/components/ui/progress';
import { cn } from '@/lib/utils';

async function processImage(file: File): Promise<string> {
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('ফাইল সাইজ ৫ মেগাবাইটের বেশি হতে পারবে না।');
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;
        const maxSide = 512;

        if (width > height) {
          if (width > maxSide) {
            height *= maxSide / width;
            width = maxSide;
          }
        } else {
          if (height > maxSide) {
            width *= maxSide / height;
            height = maxSide;
          }
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.8));
      };
      img.onerror = () => reject(new Error('ছবি লোড করা সম্ভব হয়নি।'));
      img.src = e.target?.result as string;
    };
    reader.onerror = () => reject(new Error('ফাইল পড়া সম্ভব হয়নি।'));
    reader.readAsDataURL(file);
  });
}

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = error => reject(error);
  });
};

function naturalSort(a: any, b: any) {
  if (a.classId !== b.classId) return parseInt(a.classId) - parseInt(b.classId);
  if (a.subject !== b.subject) return a.subject.localeCompare(b.subject, 'bn');
  const nameA = a.chapterName || a.fileName || "";
  const nameB = b.chapterName || b.fileName || "";
  return nameA.localeCompare(nameB, 'bn', { numeric: true, sensitivity: 'base' });
}

function SettingsContent() {
  const db = useFirestore();
  const storage = useStorage();
  const { user, loading: userLoading } = useUser();
  const router = useRouter();
  const searchParams = useSearchParams();
  
  const profileInputRef = useRef<HTMLInputElement>(null);
  const logoInputRef = useRef<HTMLInputElement>(null);
  const sheetInputRef = useRef<HTMLInputElement>(null);

  const [activeTab, setActiveTab] = useState('profile');

  const [classId, setClassId] = useState<string>('');
  const [subject, setSubject] = useState<string>('');
  const [chapterName, setChapterName] = useState<string>('');
  const [pdfUrl, setPdfUrl] = useState<string>('');
  const [coverImageUrl, setCoverImageUrl] = useState<string>('');
  const [bookType, setBookType] = useState<'nctb' | 'guide'>('nctb');
  const [uploading, setUploading] = useState(false);
  
  const [sheetUploadType, setSheetUploadType] = useState<'file' | 'link'>('file');
  const [sheetCategory, setSheetCategory] = useState<string>('');
  const [sheetClassId, setSheetClassId] = useState<string>('');
  const [sheetSubject, setSheetSubject] = useState<string>('');
  const [sheetChapter, setSheetChapter] = useState<string>('');
  const [sheetFile, setSheetFile] = useState<File | null>(null);
  const [sheetManualUrl, setSheetManualUrl] = useState<string>('');
  const [sheetUploading, setSheetUploading] = useState(false);
  const [sheetUploadProgress, setSheetUploadProgress] = useState(0);

  const [viewClassId, setViewClassId] = useState<string>('all');
  const [viewBookType, setViewBookType] = useState<string>('all');
  
  const [isAdmin, setIsAdmin] = useState(false);
  const [adminCheckLoading, setAdminCheckLoading] = useState(true);
  const [displayName, setDisplayName] = useState('');
  const [photoURL, setPhotoURL] = useState('');
  const [savingProfile, setSavingProfile] = useState(false);
  
  const [pendingUsers, setPendingUsers] = useState<any[]>([]);
  const [loadingRequests, setLoadingRequests] = useState(false);

  const softwareDocRef = useMemo(() => doc(db, 'config', 'software'), [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const [appName, setAppName] = useState('');
  const [appLogoUrl, setAppLogoUrl] = useState('');
  const [savingSoftware, setSavingSoftware] = useState(false);

  const userProfileRef = useMemo(() => user ? doc(db, 'users', user.uid) : null, [db, user]);
  const { data: userProfile } = useDoc(userProfileRef);

  useEffect(() => {
    if (!userLoading && !user) router.push('/auth');
  }, [user, userLoading, router]);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam) {
      setActiveTab(tabParam);
    }
  }, [searchParams]);

  useEffect(() => {
    if (userProfile) {
      setDisplayName(userProfile.displayName || user?.displayName || '');
      setPhotoURL(userProfile.photoURL || user?.photoURL || '');
    } else if (user) {
      setDisplayName(user.displayName || '');
      setPhotoURL(user.photoURL || '');
    }
  }, [userProfile, user]);

  useEffect(() => {
    if (softwareConfig) {
      setAppName(softwareConfig.appName || 'টপ গ্রেড টিউটোরিয়ালস');
      setAppLogoUrl(softwareConfig.appLogoUrl || '');
    } else {
      setAppName('টপ গ্রেড টিউটোরিয়ালস');
    }
  }, [softwareConfig]);

  useEffect(() => {
    async function checkAdmin() {
      if (!db || !user) return;
      if (user.email === 'dlswf.roy@gmail.com') {
        setIsAdmin(true);
        setAdminCheckLoading(false);
        return;
      }
      try {
        const adminDoc = await getDoc(doc(db, 'config', 'admin'));
        if (adminDoc.exists() && adminDoc.data().adminUid === user.uid) {
          setIsAdmin(true);
        }
      } catch (e) {} finally {
        setAdminCheckLoading(false);
      }
    }
    if (user && db) checkAdmin();
  }, [user, db]);

  const fetchRequests = async () => {
    if (!isAdmin || !db) return;
    setLoadingRequests(true);
    try {
      const q = query(collection(db, 'users'), where('status', '==', 'pending'));
      const snap = await getDocs(q);
      setPendingUsers(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    } catch (e) {} finally {
      setLoadingRequests(false);
    }
  };

  useEffect(() => {
    if (isAdmin) fetchRequests();
  }, [isAdmin, db]);

  const handleOpenPdf = async (url: string) => {
    if (!url) return;
    const isDataUri = url.startsWith('data:');
    const isPdf = url.startsWith('data:application/pdf');
    const isWord = url.startsWith('data:application/msword') || url.startsWith('data:application/vnd.openxmlformats-officedocument.wordprocessingml.document');

    if (isDataUri && (isPdf || isWord)) {
      try {
        const response = await fetch(url);
        const blob = await response.blob();
        const blobUrl = URL.createObjectURL(blob);
        window.open(blobUrl, '_blank');
      } catch (error) {
        window.open(url, '_blank');
      }
    } else {
      window.open(url, '_blank');
    }
  };

  const handleConfirmUser = async (uid: string) => {
    if (!db) return;
    try {
      await updateDoc(doc(db, 'users', uid), { 
        status: 'active', 
        updatedAt: serverTimestamp() 
      });
      setPendingUsers(prev => prev.filter(u => u.id !== uid));
      toast({ title: "সফল", description: "ইউজার অ্যাকাউন্ট সক্রিয় করা হয়েছে।" });
    } catch (e) {
      toast({ variant: "destructive", title: "ত্রুটি", description: "অনুমোদন ব্যর্থ হয়েছে।" });
    }
  };

  const booksQuery = useMemo(() => db ? collection(db, 'books') : null, [db]);
  const { data: rawBooks, loading: loadingBooks } = useCollection(booksQuery);

  const sheetsQuery = useMemo(() => db ? collection(db, 'pdf-sheets') : null, [db]);
  const { data: rawSheets, loading: loadingSheets } = useCollection(sheetsQuery);

  const sortedBooks = useMemo(() => {
    if (!rawBooks) return [];
    return [...rawBooks].sort(naturalSort);
  }, [rawBooks]);

  const sortedSheets = useMemo(() => {
    if (!rawSheets) return [];
    return [...rawSheets].sort(naturalSort);
  }, [rawSheets]);

  const filteredBooks = useMemo(() => {
    let list = sortedBooks;
    if (viewClassId !== 'all') list = list.filter(b => b.classId === viewClassId);
    if (viewBookType === 'nctb') list = list.filter(b => !b.isGuide);
    else if (viewBookType === 'guide') list = list.filter(b => b.isGuide);
    return list;
  }, [sortedBooks, viewClassId, viewBookType]);

  const subjectsList = useMemo(() => classId ? getSubjectsForClass(classId) : [], [classId]);
  const chaptersList = useMemo(() => (classId && subject) ? getChaptersForSubject(classId, subject) : [], [classId, subject]);

  const sheetSubjectsList = useMemo(() => sheetClassId ? getSubjectsForClass(sheetClassId) : [], [sheetClassId]);
  const sheetChaptersList = useMemo(() => (sheetClassId && sheetSubject) ? getChaptersForSubject(sheetClassId, sheetSubject) : [], [sheetClassId, sheetSubject]);

  const handleProfilePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await processImage(file);
      setPhotoURL(base64);
      toast({ title: "সফল", description: "ছবি প্রসেস করা হয়েছে। সেভ বাটনে ক্লিক করুন।" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "ত্রুটি", description: err.message });
    }
  };

  const handleLogoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const base64 = await processImage(file);
      setAppLogoUrl(base64);
      toast({ title: "সফল", description: "লোগো প্রসেস করা হয়েছে। সেভ বাটনে ক্লিক করুন।" });
    } catch (err: any) {
      toast({ variant: "destructive", title: "ত্রুটি", description: err.message });
    }
  };

  const handleUpdateProfile = async () => {
    if (!user || !userProfileRef) return;
    setSavingProfile(true);
    const profileData = { 
      displayName: displayName || '', 
      photoURL: photoURL || '', 
      updatedAt: serverTimestamp() 
    };
    try {
      await setDoc(userProfileRef, profileData, { merge: true });
      try {
        await updateProfile(user, { displayName });
      } catch (authErr) {}
      toast({ title: "সফল", description: "প্রোফাইল আপডেট করা হয়েছে।" });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: userProfileRef.path, operation: 'write', requestResourceData: profileData
      }));
    } finally {
      setSavingProfile(false);
    }
  };

  const handleUpdateSoftware = async () => {
    if (!isAdmin || !db) return;
    setSavingSoftware(true);
    const data = { appName: appName || '', appLogoUrl: appLogoUrl || '' };
    try {
      await setDoc(softwareDocRef, data, { merge: true });
      toast({ title: "সফল", description: "সফটওয়্যার ব্র্যান্ডিং আপডেট করা হয়েছে।" });
    } catch (e) {
      errorEmitter.emit('permission-error', new FirestorePermissionError({
        path: softwareDocRef.path, operation: 'write', requestResourceData: data
      }));
    } finally {
      setSavingSoftware(false);
    }
  };

  const handleSaveBook = async () => {
    if (!classId || !subject || !db || !isAdmin || !pdfUrl) return;
    setUploading(true);
    const bookData = {
      classId, subject, chapterName: bookType === 'guide' ? (chapterName || '') : '',
      fileName: chapterName || subject, pdfUrl: pdfUrl, coverImageUrl: coverImageUrl || '', isGuide: bookType === 'guide',
      uploadedAt: serverTimestamp(), userId: user?.uid || '',
    };
    addDoc(collection(db!, 'books'), bookData)
      .then(() => {
        setUploading(false); setPdfUrl(''); setCoverImageUrl(''); setClassId(''); setSubject(''); setChapterName('');
        toast({ title: "সফল", description: "বইটি যুক্ত করা হয়েছে।" });
      })
      .catch(async () => {
        setUploading(false);
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: 'books', operation: 'create', requestResourceData: bookData
        }));
      });
  };

  const handleUploadSheet = async () => {
    if (!db || !isAdmin || !sheetCategory || !sheetClassId || !sheetSubject) {
      toast({ variant: "destructive", title: "তথ্য অসম্পূর্ণ", description: "সবগুলো ঘর পূরণ করুন।" });
      return;
    }

    if (sheetUploadType === 'file' && !sheetFile) {
      toast({ variant: "destructive", title: "ফাইল নেই", description: "ফাইল নির্বাচন করুন।" });
      return;
    }

    if (sheetUploadType === 'link' && !sheetManualUrl) {
      toast({ variant: "destructive", title: "লিঙ্ক নেই", description: "ফাইল লিঙ্ক লিখুন।" });
      return;
    }

    setSheetUploading(true);

    if (sheetUploadType === 'link') {
      const sheetData = {
        category: sheetCategory,
        classId: sheetClassId,
        subject: sheetSubject,
        chapterName: sheetChapter || 'সাধারণ',
        fileName: 'External Link',
        pdfUrl: sheetManualUrl,
        uploadedAt: serverTimestamp(),
        userId: user?.uid || ''
      };

      try {
        await addDoc(collection(db, 'pdf-sheets'), sheetData);
        toast({ title: "সফল", description: "লিঙ্কটি যুক্ত করা হয়েছে।" });
        setSheetManualUrl('');
        setSheetChapter('');
      } catch (e) {
        toast({ variant: "destructive", title: "ত্রুটি", description: "সেভ করা সম্ভব হয়নি।" });
      } finally {
        setSheetUploading(false);
      }
      return;
    }

    setSheetUploadProgress(10);
    try {
      const base64String = await fileToBase64(sheetFile!);
      setSheetUploadProgress(70);

      const sheetData = {
        category: sheetCategory,
        classId: sheetClassId,
        subject: sheetSubject,
        chapterName: sheetChapter || 'সাধারণ',
        fileName: sheetFile!.name,
        pdfUrl: base64String, 
        uploadedAt: serverTimestamp(),
        userId: user?.uid || ''
      };

      await addDoc(collection(db, 'pdf-sheets'), sheetData);
      setSheetUploadProgress(100);
      toast({ title: "সফল", description: "ফাইলটি সফলভাবে সংরক্ষিত হয়েছে।" });
      setSheetUploading(false);
      setSheetFile(null);
      setSheetChapter('');
      if (sheetInputRef.current) sheetInputRef.current.value = '';
    } catch (e: any) {
      toast({ variant: "destructive", title: "ত্রুটি", description: e.message });
      setSheetUploading(false);
    }
  };

  const removeBook = (bookId: string) => {
    if (!db || !isAdmin) return;
    if (!confirm("আপনি কি নিশ্চিত?")) return;
    deleteDoc(doc(db, 'books', bookId))
      .then(() => toast({ title: "সফল", description: "বইটি মুছে ফেলা হয়েছে।" }))
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `books/${bookId}`, operation: 'delete'
        }));
      });
  };

  const removeSheet = (sheetId: string) => {
    if (!db || !isAdmin) return;
    if (!confirm("এই ফাইলটি মুছে ফেলতে চান?")) return;
    deleteDoc(doc(db, 'pdf-sheets', sheetId))
      .then(() => toast({ title: "সফল", description: "ফাইলটি মুছে ফেলা হয়েছে।" }))
      .catch(async () => {
        errorEmitter.emit('permission-error', new FirestorePermissionError({
          path: `pdf-sheets/${sheetId}`, operation: 'delete'
        }));
      });
  };

  const sidebarItems = useMemo(() => {
    const items = [
      { id: 'profile', label: 'প্রোফাইল', icon: User, color: 'text-indigo-600 bg-indigo-50' },
    ];
    
    if (isAdmin) {
      items.push({ id: 'school', label: 'প্রতিষ্ঠানের তথ্য', icon: School, color: 'text-emerald-600 bg-emerald-50' });
    }
    
    items.push({ id: 'books', label: 'বই ব্যবস্থাপনা', icon: BookCopy, color: 'text-amber-600 bg-amber-50' });
    
    if (isAdmin) {
      items.push(
        { id: 'sheets', label: 'ফাইল আপলোড', icon: FileUp, color: 'text-blue-600 bg-blue-50' },
        { id: 'requests', label: 'অনুমোদন আবেদন', icon: Users, color: 'text-orange-600 bg-orange-50' },
        { id: 'software', label: 'সফটওয়্যার ব্র্যান্ডিং', icon: Globe, color: 'text-indigo-600 bg-indigo-50' },
        { id: 'holidays', label: 'ছুটির ক্যালেন্ডার', icon: Calendar, color: 'text-rose-600 bg-rose-50' },
        { id: 'users', label: 'ইউজার ও পারমিশন', icon: Users, color: 'text-primary bg-primary/10' },
        { id: 'backup', label: 'ব্যাকআপ ও এক্সপোর্ট', icon: HardDriveDownload, color: 'text-emerald-600 bg-emerald-50' },
        { id: 'gallery', label: 'গ্যালারি', icon: ImageIcon, color: 'text-blue-600 bg-blue-50' },
        { id: 'system', label: 'সিস্টেম ওভারভিউ', icon: Monitor, color: 'text-slate-600 bg-slate-50' }
      );
    }
    return items;
  }, [isAdmin]);

  if (userLoading || adminCheckLoading) {
    return <div className="flex flex-col items-center justify-center min-h-[50vh]"><Loader2 className="w-10 h-10 animate-spin text-primary" /></div>;
  }

  return (
    <div className="max-w-[1600px] mx-auto space-y-6 animate-fade-in pb-20 font-kalpurush">
      <header className="flex items-center gap-4 border-b pb-6 no-print">
        <div className="w-12 h-12 rounded-xl bg-primary text-white flex items-center justify-center shadow-lg">
          <SettingsIcon className="w-7 h-7" />
        </div>
        <div>
          <h2 className="text-2xl font-black text-foreground">সেটিংস ও নিয়ন্ত্রণ কেন্দ্র</h2>
          <p className="text-xs text-muted-foreground font-bold">সিস্টেম কনফিগারেশন এবং প্রোফাইল ব্যবস্থাপনা</p>
        </div>
      </header>

      <div className="flex flex-col md:flex-row gap-8 items-start">
        {/* Sidebar Navigation */}
        <aside className="w-full md:w-64 shrink-0 space-y-1 no-print bg-white md:bg-transparent p-4 md:p-0 border-b md:border-0 sticky top-20 md:top-28 self-start">
            <div className="flex flex-row md:flex-col overflow-x-auto md:overflow-x-visible pb-2 md:pb-0 gap-1 scrollbar-none">
                {sidebarItems.map(item => (
                    <button
                        key={item.id}
                        onClick={() => setActiveTab(item.id)}
                        className={cn(
                            "flex items-center gap-3 px-4 py-3 rounded-xl transition-all duration-300 font-bold whitespace-nowrap min-w-fit",
                            activeTab === item.id ? "bg-white shadow-md text-primary scale-105" : "text-muted-foreground hover:bg-slate-200/50"
                        )}
                    >
                        <div className={cn("p-1.5 rounded-lg shrink-0", activeTab === item.id ? item.color : "bg-muted")}>
                            <item.icon className="h-4 w-4" />
                        </div>
                        <span className="text-sm font-black">{item.label}</span>
                        {activeTab === item.id && <ChevronRight className="ml-auto h-4 w-4 hidden md:block" />}
                    </button>
                ))}
            </div>
        </aside>

        {/* Content Area */}
        <div className="flex-1 min-w-0 flex flex-col gap-6">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            <TabsContent value="profile" className="mt-0">
              <Card className="border-[4px] border-black rounded-[32px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)] bg-white">
                <CardHeader className="bg-primary/5 p-6 border-b-[3px] border-black">
                  <CardTitle className="text-xl font-black">ব্যক্তিগত প্রোফাইল</CardTitle>
                </CardHeader>
                <CardContent className="p-8 space-y-6">
                  <div className="flex flex-col md:flex-row items-center gap-8">
                    <div className="relative group shrink-0">
                      <Avatar className="h-32 w-32 border-[4px] border-black shadow-xl">
                        <AvatarImage src={photoURL || ''} />
                        <AvatarFallback className="text-4xl font-black bg-secondary text-primary">{displayName?.charAt(0) || 'U'}</AvatarFallback>
                      </Avatar>
                      <button onClick={() => profileInputRef.current?.click()} className="absolute -bottom-2 -right-2 bg-primary text-white p-3 rounded-full shadow-lg hover:bg-primary/90 transition-all border-2 border-white">
                        <Camera className="w-5 h-5" />
                      </button>
                      <input type="file" ref={profileInputRef} className="hidden" accept="image/*" onChange={handleProfilePhotoChange} />
                    </div>
                    <div className="flex-1 w-full space-y-6">
                      <div className="space-y-2">
                        <Label className="font-black text-sm text-slate-700">আপনার নাম</Label>
                        <Input value={displayName || ''} onChange={e => setDisplayName(e.target.value)} placeholder="নাম লিখুন" className="h-12 text-lg font-bold border-2" />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-black text-sm text-slate-700">প্রোফাইল ছবির লিঙ্ক (ঐচ্ছিক)</Label>
                        <Input value={photoURL || ''} onChange={e => setPhotoURL(e.target.value)} placeholder="https://..." className="h-10 border-2" />
                      </div>
                    </div>
                  </div>
                </CardContent>
                <CardFooter className="flex justify-end p-6 border-t-[3px] border-black bg-slate-50">
                  <Button onClick={handleUpdateProfile} disabled={savingProfile} className="gap-2 font-black h-12 px-10 shadow-lg text-base">
                    {savingProfile ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} প্রোফাইল সেভ করুন
                  </Button>
                </CardFooter>
              </Card>
            </TabsContent>

            <TabsContent value="school" className="mt-0">
              <div className="bg-white border-[4px] border-black rounded-[32px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)]">
                <div className="p-8">
                  <SchoolInfoSettings />
                </div>
              </div>
            </TabsContent>

            <TabsContent value="books" className="mt-0 space-y-6">
              {isAdmin && (
                <Card className="border-[4px] border-black rounded-[32px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)] bg-white">
                  <CardHeader className="bg-amber-50 p-6 border-b-[3px] border-black">
                    <CardTitle className="text-xl font-black flex items-center gap-2 text-amber-900"><LinkIcon className="w-6 h-6" /> নতুন বই যোগ করুন</CardTitle>
                  </CardHeader>
                  <CardContent className="p-8 space-y-8">
                    <div className="space-y-3">
                      <Label className="font-black text-primary text-lg">বইয়ের ধরন</Label>
                      <RadioGroup value={bookType || 'nctb'} onValueChange={(v) => setBookType(v as 'nctb' | 'guide')} className="flex gap-10">
                        <div className="flex items-center space-x-3"><RadioGroupItem value="nctb" id="nctb" className="h-5 w-5" /><Label htmlFor="nctb" className="cursor-pointer font-black text-base">পাঠ্যবই (NCTB)</Label></div>
                        <div className="flex items-center space-x-3"><RadioGroupItem value="guide" id="guide" className="h-5 w-5" /><Label htmlFor="guide" className="cursor-pointer font-black text-base">গাইড বই (Guide)</Label></div>
                      </RadioGroup>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-sm font-black text-slate-700">শ্রেণি</label><Select onValueChange={setClassId} value={classId || ''}><SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger><SelectContent className="font-kalpurush">{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                      <div className="space-y-2"><label className="text-sm font-black text-slate-700">বিষয়</label><Select onValueChange={setSubject} value={subject || ''} disabled={!classId}><SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="বিষয় নির্বাচন" /></SelectTrigger><SelectContent className="font-kalpurush">{subjectsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                    </div>
                    {bookType === 'guide' && (
                      <div className="space-y-2">
                        <label className="text-sm font-black text-slate-700">অধ্যায়ের নাম</label>
                        {chaptersList.length > 0 ? (
                          <Select onValueChange={setChapterName} value={chapterName || ''}><SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="অধ্যায় নির্বাচন করুন" /></SelectTrigger><SelectContent className="font-kalpurush">{chaptersList.map(ch => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}</SelectContent></Select>
                        ) : (
                          <Input placeholder="অধ্যায়ের নাম লিখুন" value={chapterName || ''} onChange={e => setChapterName(e.target.value)} className="h-11 border-2 font-bold" />
                        )}
                      </div>
                    )}
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                      <div className="space-y-2"><label className="text-sm font-black text-slate-700">পিডিএফ লিঙ্ক (URL)</label><Input placeholder="https://..." value={pdfUrl || ''} onChange={e => setPdfUrl(e.target.value)} disabled={uploading} className="h-11 border-2" /></div>
                      <div className="space-y-2"><label className="text-sm font-black text-slate-700">কভার ইমেজ লিঙ্ক (ঐচ্ছিক)</label><Input placeholder="https://..." value={coverImageUrl || ''} onChange={e => setCoverImageUrl(e.target.value)} disabled={uploading} className="h-11 border-2" /></div>
                    </div>
                  </CardContent>
                  <CardFooter className="flex justify-end p-6 border-t-[3px] border-black bg-slate-50">
                    <Button onClick={handleSaveBook} disabled={uploading || !pdfUrl || !classId || !subject} className="bg-emerald-600 hover:bg-emerald-700 text-white h-14 gap-2 px-12 font-black shadow-xl text-lg">
                      {uploading ? <Loader2 className="w-6 h-6 animate-spin" /> : <CheckCircle className="w-6 h-6" />} বই সেভ করুন
                    </Button>
                  </CardFooter>
                </Card>
              )}

              <div className="space-y-6 pt-6">
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 px-2">
                  <h3 className="font-black text-xl flex items-center gap-2 text-slate-800"><BookOpen className="w-6 h-6 text-primary" /> বর্তমানে থাকা বইসমূহ</h3>
                  <div className="flex items-center gap-2 bg-white p-2 rounded-2xl border-2 border-black shadow-sm">
                    <Select value={viewClassId || 'all'} onValueChange={setViewClassId}>
                      <SelectTrigger className="w-[120px] h-9 text-xs bg-slate-50 font-black border-none focus:ring-0"><SelectValue placeholder="সব শ্রেণি" /></SelectTrigger>
                      <SelectContent className="font-kalpurush"><SelectItem value="all">সব শ্রেণি</SelectItem>{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent>
                    </Select>
                    <Separator orientation="vertical" className="h-6 bg-slate-200" />
                    <Select value={viewBookType || 'all'} onValueChange={setViewBookType}>
                      <SelectTrigger className="w-[120px] h-9 text-xs bg-slate-50 font-black border-none focus:ring-0"><SelectValue placeholder="বইয়ের ধরন" /></SelectTrigger>
                      <SelectContent className="font-kalpurush"><SelectItem value="all">সব বই</SelectItem><SelectItem value="nctb">পাঠ্যবই</SelectItem><SelectItem value="guide">গাইড বই</SelectItem></SelectContent>
                    </Select>
                  </div>
                </div>
                {loadingBooks ? (
                  <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-primary mx-auto" /></div>
                ) : filteredBooks.length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredBooks.map(book => (
                      <div key={book.id} className="p-4 flex items-center justify-between border-2 border-black/5 rounded-2xl hover:border-primary/30 transition-all group bg-white shadow-sm">
                        <div className="flex items-center gap-4">
                          <div className="w-14 h-20 rounded-lg border-2 border-slate-100 bg-slate-50 flex items-center justify-center overflow-hidden shrink-0 relative shadow-inner">
                            {book.coverImageUrl ? <img src={book.coverImageUrl} className="w-full h-full object-cover" alt="cover" /> : <FileText className="w-8 h-8 text-slate-300" />}
                            {book.isGuide && <div className="absolute top-0 right-0 bg-amber-600 text-[7px] px-1.5 py-0.5 text-white font-black uppercase tracking-widest shadow-sm">Guide</div>}
                          </div>
                          <div className="min-w-0">
                            <h4 className="font-black text-base truncate text-slate-900">{book.subject}</h4>
                            <p className="text-xs font-bold text-muted-foreground mt-1">{CLASSES.find(c => c.id === book.classId)?.label || 'অজানা'} শ্রেণি | {book.isGuide ? 'গাইড বই' : 'পাঠ্যবই (বোর্ড)'}</p>
                            <p className="text-[10px] font-bold text-primary mt-1 line-clamp-1">{book.chapterName || 'সম্পূর্ণ বই'}</p>
                          </div>
                        </div>
                        <div className="flex gap-2 shrink-0">
                           <Button variant="outline" size="icon" className="h-10 w-10 border-2 rounded-xl text-primary" onClick={() => handleOpenPdf(book.pdfUrl)}><BookOpen className="w-5 h-5" /></Button>
                           {isAdmin && <Button variant="ghost" size="icon" className="h-10 w-10 text-rose-500 hover:bg-rose-50 hover:text-rose-600" onClick={() => removeBook(book.id)}><Trash2 className="w-5 h-5" /></Button>}
                        </div>
                      </div>
                    ))}
                  </div>
                ) : (
                  <div className="p-20 text-center border-4 border-dashed border-slate-200 bg-slate-50 rounded-[32px] opacity-40"><p className="text-slate-400 font-black text-xl">কোনো বই পাওয়া যায়নি।</p></div>
                )}
              </div>
            </TabsContent>

            {isAdmin && (
              <>
                <TabsContent value="sheets" className="mt-0 space-y-6">
                  <div className="bg-white border-[4px] border-black rounded-[32px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)]">
                    <div className="p-8">
                      <div className="flex items-center gap-4 mb-8">
                        <div className="p-3 bg-indigo-600 text-white rounded-2xl shadow-lg shadow-indigo-200">
                          <FileType className="w-8 h-8" />
                        </div>
                        <div>
                          <h3 className="text-2xl font-black text-slate-900">সরাসরি ফাইল আপলোড (PDF/Word)</h3>
                          <p className="font-bold text-muted-foreground">লেকচার শিট, প্রশ্নপত্র বা উত্তরমালা ডাটাবেসে সেভ করুন</p>
                        </div>
                      </div>
                      
                      <div className="space-y-8">
                        <div className="p-6 bg-indigo-50/50 rounded-2xl border-2 border-indigo-100 space-y-4">
                          <Label className="font-black text-indigo-900 uppercase tracking-widest text-[10px]">১. আপলোড পদ্ধতি</Label>
                          <RadioGroup value={sheetUploadType} onValueChange={(v) => setSheetUploadType(v as 'file' | 'link')} className="flex gap-12">
                            <div className="flex items-center space-x-3"><RadioGroupItem value="file" id="sheet-file" className="h-5 w-5" /><Label htmlFor="sheet-file" className="cursor-pointer font-black text-base text-indigo-900">ফাইল আপলোড</Label></div>
                            <div className="flex items-center space-x-3"><RadioGroupItem value="link" id="sheet-link" className="h-5 w-5" /><Label htmlFor="sheet-link" className="cursor-pointer font-black text-base text-indigo-900">লিঙ্ক আপলোড (URL)</Label></div>
                          </RadioGroup>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                          <div className="space-y-2"><Label className="font-black text-slate-700">ক্যাটাগরি</Label><Select onValueChange={setSheetCategory} value={sheetCategory || ''}><SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="ধরণ নির্বাচন করুন" /></SelectTrigger><SelectContent className="font-kalpurush"><SelectItem value="lecture_sheet">লেকচার শিট</SelectItem><SelectItem value="creative">সৃজনশীল প্রশ্ন</SelectItem><SelectItem value="mcq">বহুনির্বাচনী প্রশ্ন</SelectItem><SelectItem value="model_test">মডেল টেস্ট</SelectItem><SelectItem value="answer_key">উত্তরমালা</SelectItem></SelectContent></Select></div>
                          <div className="space-y-2"><Label className="font-black text-slate-700">শ্রেণি</Label><Select onValueChange={setSheetClassId} value={sheetClassId || ''}><SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="শ্রেণি নির্বাচন" /></SelectTrigger><SelectContent className="font-kalpurush">{CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}</SelectContent></Select></div>
                          <div className="space-y-2"><Label className="font-black text-slate-700">বিষয়</Label><Select onValueChange={setSheetSubject} value={sheetSubject || ''} disabled={!sheetClassId}><SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="বিষয় নির্বাচন" /></SelectTrigger><SelectContent className="font-kalpurush">{sheetSubjectsList.map(s => <SelectItem key={s} value={s}>{s}</SelectItem>)}</SelectContent></Select></div>
                          <div className="space-y-2"><Label className="font-black text-slate-700">অধ্যায় (Chapter)</Label>{sheetChaptersList.length > 0 ? (<Select onValueChange={setSheetChapter} value={sheetChapter || ''}><SelectTrigger className="h-11 border-2 font-bold"><SelectValue placeholder="অধ্যায় নির্বাচন করুন" /></SelectTrigger><SelectContent className="font-kalpurush">{sheetChaptersList.map(ch => <SelectItem key={ch} value={ch}>{ch}</SelectItem>)}</SelectContent></Select>) : (<Input placeholder="অধ্যায়ের নাম লিখুন" value={sheetChapter || ''} onChange={e => setSheetChapter(e.target.value)} className="h-11 border-2 font-bold" />)}</div>
                        </div>

                        <div className="space-y-4 pt-4 border-t border-dashed">
                          {sheetUploadType === 'file' ? (
                            <div className="space-y-4">
                              <Label className="font-black text-slate-700">ফাইল নির্বাচন করুন (PDF/Word)</Label>
                              <div className="flex items-center gap-4">
                                <div onClick={() => !sheetUploading && sheetInputRef.current?.click()} className="flex-1 h-32 border-4 border-dashed border-indigo-200 rounded-[24px] bg-slate-50 flex flex-col items-center justify-center cursor-pointer hover:bg-indigo-50 hover:border-indigo-400 transition-all group overflow-hidden">
                                  {sheetFile ? (<div className="flex items-center gap-3 p-4"><div className="p-3 bg-indigo-600 text-white rounded-xl shadow-lg"><FileText className="w-8 h-8" /></div><div><p className="font-black text-indigo-900">{sheetFile.name}</p><p className="text-[10px] font-bold text-muted-foreground">{(sheetFile.size / 1024).toFixed(1)} KB</p></div></div>) : (<><FileUp className="w-10 h-10 text-slate-300 group-hover:text-indigo-500 transition-colors mb-2" /><p className="text-sm font-black text-slate-400 group-hover:text-indigo-600 transition-colors">ফাইল এখানে ড্রপ করুন অথবা ক্লিক করুন</p></>)}
                                </div>
                                <input type="file" ref={sheetInputRef} className="hidden" accept=".pdf,.doc,.docx" onChange={e => setSheetFile(e.target.files?.[0] || null)} />
                              </div>
                              {sheetUploading && (
                                <div className="space-y-2 animate-in fade-in duration-300">
                                  <div className="flex justify-between text-[10px] font-black text-indigo-600 uppercase tracking-widest"><span>প্রসেসিং ও আপলোড হচ্ছে...</span><span>{toBengaliNumber(sheetUploadProgress)}%</span></div>
                                  <Progress value={sheetUploadProgress} className="h-2 bg-indigo-100" />
                                </div>
                              )}
                            </div>
                          ) : (
                            <div className="space-y-2">
                              <Label className="font-black text-slate-700">ফাইল লিঙ্ক (URL) দিন</Label>
                              <Input placeholder="https://example.com/file.pdf" value={sheetManualUrl} onChange={e => setSheetManualUrl(e.target.value)} className="h-12 border-2 font-bold" disabled={sheetUploading} />
                            </div>
                          )}
                        </div>
                      </div>
                      
                      <div className="mt-10 flex justify-end">
                        <Button onClick={handleUploadSheet} disabled={sheetUploading || (sheetUploadType === 'file' && !sheetFile) || (sheetUploadType === 'link' && !sheetManualUrl)} className="h-16 px-16 text-xl font-black bg-indigo-600 hover:bg-indigo-700 text-white shadow-2xl shadow-indigo-200">
                          {sheetUploading ? <Loader2 className="w-6 h-6 animate-spin mr-2" /> : <Save className="w-6 h-6 mr-2" />} 
                          {sheetUploadType === 'file' ? 'ফাইল সেভ করুন' : 'লিঙ্ক সেভ করুন'}
                        </Button>
                      </div>
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="requests" className="mt-0">
                  <Card className="border-[4px] border-black rounded-[32px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)] bg-white">
                    <CardHeader className="bg-orange-50 p-6 border-b-[3px] border-black">
                      <CardTitle className="text-xl font-black flex items-center gap-2 text-orange-700"><Users className="w-6 h-6" /> একাউন্ট খোলার আবেদনসমূহ</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8">
                      {loadingRequests ? (
                        <div className="p-20 text-center"><Loader2 className="w-10 h-10 animate-spin text-orange-600 mx-auto" /></div>
                      ) : pendingUsers.length > 0 ? (
                        <div className="space-y-4">
                          {pendingUsers.map(userReq => (
                            <div key={userReq.id} className="p-5 border-2 border-black/5 rounded-2xl flex items-center justify-between bg-white hover:border-orange-200 transition-all shadow-sm">
                              <div className="flex items-center gap-4">
                                <Avatar className="h-12 w-12 border-2 border-orange-100">
                                  <AvatarFallback className="bg-orange-50 text-orange-600 font-black text-lg">{userReq.displayName?.charAt(0) || userReq.email?.charAt(0).toUpperCase()}</AvatarFallback>
                                </Avatar>
                                <div>
                                  <h4 className="font-black text-slate-900">{userReq.displayName || 'নামহীন'}</h4>
                                  <p className="text-xs font-bold text-muted-foreground">{userReq.email}</p>
                                </div>
                              </div>
                              <Button onClick={() => handleConfirmUser(userReq.id)} size="lg" className="bg-emerald-600 hover:bg-emerald-700 h-11 px-8 gap-2 font-black shadow-lg shadow-emerald-100">
                                <ShieldCheck className="w-5 h-5" /> কনফার্ম করুন
                              </Button>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="py-20 text-center border-4 border-dashed border-slate-200 rounded-[32px] opacity-40">
                          <Users className="h-16 w-16 mx-auto mb-4 text-slate-300" />
                          <p className="text-slate-400 font-black text-xl italic">বর্তমানে কোনো পেন্ডিং আবেদন নেই।</p>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                </TabsContent>

                <TabsContent value="software" className="mt-0">
                  <Card className="border-[4px] border-black rounded-[32px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)] bg-white">
                    <CardHeader className="bg-indigo-600 text-white p-6 border-b-[3px] border-black">
                      <CardTitle className="text-xl font-black">সফটওয়্যার ব্র্যান্ডিং</CardTitle>
                    </CardHeader>
                    <CardContent className="p-8 space-y-10">
                      <div className="flex flex-col md:flex-row items-center gap-10">
                        <div className="relative group shrink-0">
                          <div className="w-32 h-32 rounded-3xl bg-white flex items-center justify-center p-3 border-[4px] border-black shadow-2xl relative overflow-hidden">
                            {appLogoUrl ? <img src={appLogoUrl} className="max-w-full max-h-full object-contain" alt="logo" /> : <Globe className="w-12 h-12 text-primary" />}
                            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                                <Camera className="text-white w-8 h-8" />
                            </div>
                          </div>
                          <button onClick={() => logoInputRef.current?.click()} className="absolute -bottom-3 -right-3 bg-primary text-white p-3 rounded-full shadow-lg border-2 border-white hover:scale-110 transition-transform">
                            <Camera className="w-5 h-5" />
                          </button>
                          <input type="file" ref={logoInputRef} className="hidden" accept="image/*" onChange={handleLogoChange} />
                        </div>
                        <div className="flex-1 w-full space-y-6">
                          <div className="space-y-2">
                            <Label className="font-black text-slate-700 text-sm uppercase tracking-wider">প্রতিষ্ঠানের নাম (সফটওয়্যারে প্রদর্শিত)</Label>
                            <Input value={appName || ''} onChange={e => setAppName(e.target.value)} placeholder="প্রতিষ্ঠানের নাম লিখুন" className="font-black text-primary text-3xl h-16 border-2 border-black/10 focus:border-primary shadow-inner" />
                          </div>
                          <div className="space-y-2">
                            <Label className="font-black text-slate-700 text-sm uppercase tracking-wider">সফটওয়্যার লোগো লিঙ্ক (URL)</Label>
                            <Input value={appLogoUrl || ''} onChange={e => setAppLogoUrl(e.target.value)} placeholder="https://..." className="h-12 border-2 font-bold" />
                          </div>
                        </div>
                      </div>
                    </CardContent>
                    <CardFooter className="flex justify-end p-6 border-t-[3px] border-black bg-slate-50">
                      <Button onClick={handleUpdateSoftware} disabled={savingSoftware} className="gap-2 font-black h-14 px-12 text-lg shadow-xl">
                        {savingSoftware ? <Loader2 className="w-5 h-5 animate-spin" /> : <Save className="w-5 h-5" />} ব্র্যান্ডিং সেভ করুন
                      </Button>
                    </CardFooter>
                  </Card>
                </TabsContent>

                <TabsContent value="holidays" className="mt-0">
                  <div className="bg-white border-[4px] border-black rounded-[32px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)]">
                    <div className="p-8">
                      <HolidaySettings />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="users" className="mt-0">
                  <div className="bg-white border-[4px] border-black rounded-[32px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)]">
                    <div className="p-8">
                      <UserManagementSettings />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="backup" className="mt-0">
                  <div className="bg-white border-[4px] border-black rounded-[32px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)]">
                    <div className="p-8">
                      <BackupAndExportSettings />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="gallery" className="mt-0">
                  <div className="bg-white border-[4px] border-black rounded-[32px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)]">
                    <div className="p-8">
                      <GalleryManagementSettings />
                    </div>
                  </div>
                </TabsContent>

                <TabsContent value="system" className="mt-0">
                  <div className="bg-white border-[4px] border-black rounded-[32px] overflow-hidden shadow-[12px_12px_0px_rgba(0,0,0,0.1)]">
                    <div className="p-8">
                      <SystemUsageInfo />
                    </div>
                  </div>
                </TabsContent>
              </>
            )}
          </Tabs>
        </div>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="flex justify-center p-20"><Loader2 className="animate-spin text-primary" /></div>}>
      <SettingsContent />
    </Suspense>
  );
}

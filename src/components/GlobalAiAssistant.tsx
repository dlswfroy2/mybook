'use client';

import React, { useState, useRef, useEffect, useCallback } from 'react';
import { 
  Bot, 
  Sparkles, 
  X, 
  Send, 
  Loader2, 
  FileText, 
  UserCheck, 
  CreditCard, 
  Calendar, 
  Users, 
  Maximize2, 
  Minimize2, 
  CheckCircle2, 
  Mic, 
  MicOff, 
  Printer,
  Compass,
  ArrowRight,
  Trash2,
  Search,
  UserCircle2,
  Phone,
  BookOpen,
  History,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { useAuth } from '@/hooks/useAuth';
import { useFirestore } from '@/firebase';
import { addNotice } from '@/lib/notice-data';
import { getStudents, Student } from '@/lib/student-data';
import { getHolidays, Holiday } from '@/lib/holiday-data';
import { getStaff, Staff } from '@/lib/staff-data';
import { usePathname, useRouter } from 'next/navigation';
import { runUniversalAi, ChatMessage, UniversalAiOutput, LiveSchoolContext } from '@/ai/flows/universal-ai-flow';
import { useToast } from '@/hooks/use-toast';

const CHAT_HISTORY_KEY = 'mybook_ai_chat_history_v2';
const MAX_SAVED_MESSAGES = 40;

// Master Section Routing Map for instant navigation to ALL parts of the application
export const ALL_SYSTEM_SECTIONS: Array<{ label: string; path: string; keywords: string[] }> = [
  { label: 'প্রধান ড্যাশবোর্ড', path: '/', keywords: ['হোম', 'হোমপেজ', 'মূল পেজ', 'ড্যাশবোর্ড', 'dashboard', 'home', 'main'] },
  { label: 'শিক্ষার্থী তালিকা', path: '/student-list', keywords: ['ছাত্র তালিকা', 'শিক্ষার্থী তালিকা', 'ছাত্রদের লিস্ট', 'স্টুডেন্ট লিস্ট', 'student-list', 'esif', 'শিক্ষার্থী মডিউল'] },
  { label: 'শিক্ষার্থী প্রোফাইল', path: '/student-profile', keywords: ['শিক্ষার্থী তথ্য', 'ছাত্র প্রোফাইল', 'শিক্ষার্থী প্রোফাইল', 'ব্যক্তিগত তথ্য', 'student profile'] },
  { label: 'নতুন শিক্ষার্থী ভর্তি', path: '/add-student', keywords: ['ভর্তি', 'নতুন ভর্তি', 'নতুন ছাত্র', 'ছাত্র ভর্তি', 'ভর্তি ফরম', 'add student'] },
  { label: 'ভর্তি আবেদন ব্যবস্থাপনা', path: '/admissions-management', keywords: ['ভর্তি আবেদন', 'অনলাইন আবেদন', 'আবেদন তালিকা', 'admissions-management', 'আবেদন'] },
  { label: 'দৈনিক হাজিরা শাখা', path: '/attendance', keywords: ['হাজিরা', 'উপস্থিতি', 'উপস্থিতি শাখা', 'attendance', 'হাজিরা খাতা', 'দৈনিক হাজিরা'] },
  { label: 'ফলাফল ও মার্কশিট শাখা', path: '/results', keywords: ['ফলাফল', 'রেজাল্ট', 'মার্কশিট', 'পরীক্ষার ফলাফল', 'গ্রেড', 'results', 'মেধা তালিকা'] },
  { label: 'হিসাব শাখা ও ফি', path: '/accounts', keywords: ['হিসাব', 'হিসাব শাখা', 'ফি', 'বেতন', 'আদায়', 'বকেয়া', 'টাকা', 'খরচ', 'ভাউচার', 'accounts'] },
  { label: 'নোটিশ বোর্ড', path: '/notices-management', keywords: ['নোটিশ', 'নোটিশ বোর্ড', 'ঘোষণা', 'notices', 'বিজ্ঞপ্তি'] },
  { label: 'মেসেজ শাখা (SMS)', path: '/messaging', keywords: ['মেসেজ', 'এসএমএস', 'বার্তা', 'messaging', 'sms', 'অভিভাবক বার্তা'] },
  { label: 'স্টাফ ও শিক্ষক পোর্টাল', path: '/staff', keywords: ['শিক্ষক', 'স্টাফ', 'টিচার', 'কর্মচারী', 'staff', 'teachers', 'শিক্ষক তালিকা'] },
  { label: 'নতুন শিক্ষক যোগ', path: '/add-staff', keywords: ['নতুন শিক্ষক', 'নতুন স্টাফ', 'শিক্ষক যোগ', 'add staff'] },
  { label: 'ক্লাস রুটিন শাখা', path: '/routines', keywords: ['রুটিন', 'ক্লাস রুটিন', 'সময়সূচী', 'পিরিয়ড', 'routines', 'প্রক্সি'] },
  { label: 'ডকুমেন্ট পোর্টাল', path: '/documents', keywords: ['ডকুমেন্ট', 'দলিল', 'কাগজপত্র', 'documents', 'সনদ'] },
  { label: 'ডিজিটাল আর্কাইভ (নথিপত্র)', path: '/documents/archive', keywords: ['আর্কাইভ', 'নথিপত্র', 'ফাইল সংরক্ষণ', 'archive'] },
  { label: 'আইডি কার্ড তৈরি', path: '/documents/id-card', keywords: ['আইডি কার্ড', 'পরিচয়পত্র', 'id card'] },
  { label: 'প্রবেশ পত্র (Admit Card)', path: '/documents/admit-card', keywords: ['প্রবেশপত্র', 'প্রবেশ পত্র', 'admit card'] },
  { label: 'একাডেমিক মার্কশিট প্রিন্ট', path: '/documents/marksheet', keywords: ['মার্কশিট প্রিন্ট', 'নম্বরপত্র', 'marksheet print'] },
  { label: 'আসন বিন্যাস (Seat Plan)', path: '/documents/seat-plan', keywords: ['আসন বিন্যাস', 'সিট প্ল্যান', 'seat plan'] },
  { label: 'প্রত্যয়ন পত্র', path: '/documents/testimonial', keywords: ['প্রত্যয়ন', 'প্রত্যয়ন পত্র', 'testimonial'] },
  { label: 'প্রশংসাপত্র', path: '/documents/appreciation', keywords: ['প্রশংসাপত্র', 'চারিত্রিক সনদ', 'appreciation'] },
  { label: 'ছাড়পত্র (TC)', path: '/documents/tc', keywords: ['ছাড়পত্র', 'টিসি', 'tc', 'ট্রান্সফার'] },
  { label: 'প্রতিষ্ঠানের প্যাড', path: '/documents/custom-pad', keywords: ['প্যাড', 'লেটারহেড', 'custom pad'] },
  { label: 'পাবলিক পরীক্ষার রেকর্ড', path: '/public-exam-records', keywords: ['পাবলিক পরীক্ষা', 'এসএসসি রেকর্ড', 'জেএসসি রেকর্ড', 'বোর্ড পরীক্ষা', 'public exam'] },
  { label: 'পাবলিক রেজাল্ট পোর্টাল', path: '/public-results', keywords: ['পাবলিক রেজাল্ট', 'অনলাইন রেজাল্ট', 'public results'] },
  { label: 'টিচার্স ডায়েরি', path: '/diary', keywords: ['ডায়েরি', 'টিচার্স ডায়েরি', 'পাঠ পরিকল্পনা', 'diary'] },
  { label: 'ডিজিটাল হোয়াইটবোর্ড', path: '/whiteboard', keywords: ['হোয়াইটবোর্ড', 'বোর্ড', 'আঁকাআঁকি', 'whiteboard', 'স্মার্ট বোর্ড'] },
  { label: 'বোর্ড বই সংগ্রহ', path: '/board-books', keywords: ['বোর্ড বই', 'পাঠ্যবই', 'বই', 'board books'] },
  { label: 'প্রশ্ন ব্যাংক ও প্রশ্ন তৈরি', path: '/create-question', keywords: ['প্রশ্ন', 'প্রশ্ন তৈরি', 'প্রশ্ন ব্যাংক', 'question bank', 'পরীক্ষার প্রশ্ন'] },
  { label: 'লেকচার শিট তৈরি', path: '/create-lecture-sheet', keywords: ['শিট তৈরি', 'লেকচার শিট', 'হ্যান্ডআউট', 'lecture sheet'] },
  { label: 'আমার লাইব্রেরি', path: '/my-questions', keywords: ['লাইব্রেরি', 'আমার লাইব্রেরি', 'সংরক্ষিত প্রশ্ন', 'my library'] },
  { label: 'সিস্টেম সেটিংস', path: '/settings', keywords: ['সেটিংস', 'কনফিগ', 'নিয়ন্ত্রণ', 'settings', 'ব্যবস্থাপনা'] },
];

// Detect student search intent from query text
function detectStudentSearch(text: string): { type: 'name' | 'roll' | 'class'; value: string } | null {
  const clean = text.trim();
  // Roll number search: "রোল ১২", "roll 5", "রোল নম্বর ৩"
  const rollMatch = clean.match(/(?:রোল|roll)\s*(?:নম্বর|number|no)?\s*[:#]?\s*(\d+)/i);
  if (rollMatch) return { type: 'roll', value: rollMatch[1] };
  // Class search: "৭ম শ্রেণির ছাত্র", "class 8 students"
  const classMatch = clean.match(/(?:(?:৬ষ্ঠ|৭ম|৮ম|৯ম|১০ম|class|শ্রেণি)\s*(?:শ্রেণি|class)?\s*(?:র|এর|এ|ছাত্র|তালিকা|শিক্ষার্থী)?)/i);
  const classNumMatch = clean.match(/(?:class|শ্রেণ)\s*[:#]?\s*([৬৭৮৯1-9][০-৯0-9]?)/i);
  if (classNumMatch) return { type: 'class', value: classNumMatch[1].replace(/[৬৭৮৯]/g, (c) => String('৬৭৮৯'.indexOf(c) + 6) ) };
  // Name search: "রাহিম কোথায়", "সাকিবকে খোঁজো"
  const nameKeywords = ['কোথায়', 'কে খোঁজো', 'কোন ক্লাসে', 'খুঁজে বের কর', 'তথ্য দাও', 'কে পড়ে', 'সম্পর্কে'];
  const hasNameIntent = nameKeywords.some(kw => clean.includes(kw));
  if (hasNameIntent) {
    // Extract a potential name (2-4 Bengali words before keyword)
    const nameMatch = clean.match(/^(.{2,20}?)\s*(?:কোথায়|কে খোঁজো|কোন ক্লাসে|খুঁজে বের কর|তথ্য দাও|কে পড়ে|সম্পর্কে)/);
    if (nameMatch && nameMatch[1]) return { type: 'name', value: nameMatch[1].trim() };
  }
  return null;
}

// Search students from cache  
function searchStudents(students: Student[], query: { type: 'name' | 'roll' | 'class'; value: string }): Student[] {
  if (query.type === 'roll') {
    return students.filter(s => String(s.roll) === query.value);
  }
  if (query.type === 'class') {
    return students.filter(s => String(s.className) === query.value).slice(0, 20);
  }
  if (query.type === 'name') {
    const q = query.value.toLowerCase();
    return students.filter(s => 
      (s.studentNameBn || '').toLowerCase().includes(q) ||
      (s.studentNameEn || '').toLowerCase().includes(q)
    ).slice(0, 10);
  }
  return [];
}

// Bengali class name helper
function bengaliClass(cls: string): string {
  const map: Record<string, string> = { '6': '৬ষ্ঠ', '7': '৭ম', '8': '৮ম', '9': '৯ম', '10': '১০ম' };
  return map[cls] || `${cls}`;
}

interface StudentResultCardProps {
  students: Student[];
  onNavigate: (path: string) => void;
}

function StudentResultCard({ students, onNavigate }: StudentResultCardProps) {
  if (students.length === 0) return null;
  return (
    <div className="space-y-2 mt-1">
      {students.slice(0, 5).map((s, i) => (
        <div key={i} className="bg-indigo-50 border border-indigo-200 rounded-xl p-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-indigo-100 rounded-full flex items-center justify-center shrink-0">
              <UserCircle2 className="h-5 w-5 text-indigo-600" />
            </div>
            <div className="min-w-0">
              <p className="font-black text-xs text-indigo-900 truncate">{s.studentNameBn || s.studentNameEn}</p>
              <p className="text-[10px] text-slate-500 font-bold">
                {bengaliClass(String(s.className))} শ্রেণি • রোল: {s.roll}
                {s.group ? ` • ${s.group}` : ''}
              </p>
              {(s.guardianMobile || s.studentMobile) && (
                <p className="text-[10px] text-emerald-700 font-bold flex items-center gap-1">
                  <Phone className="h-2.5 w-2.5" />
                  {s.guardianMobile || s.studentMobile}
                </p>
              )}
            </div>
          </div>
          <button
            onClick={() => onNavigate(`/student-profile?id=${s.id || s.roll}`)}
            className="text-[10px] font-black text-indigo-600 hover:text-white hover:bg-indigo-600 border border-indigo-300 rounded-lg px-2 py-1 shrink-0 transition-all"
          >
            প্রোফাইল
          </button>
        </div>
      ))}
      {students.length > 5 && (
        <p className="text-center text-[10px] text-slate-500 font-bold">... আরো {students.length - 5} জন পাওয়া গেছে</p>
      )}
    </div>
  );
}

export function GlobalAiAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [inputQuery, setInputQuery] = useState('');
  const [messages, setMessages] = useState<ChatMessage[]>(() => {
    // Load from localStorage on first render
    if (typeof window !== 'undefined') {
      try {
        const saved = localStorage.getItem(CHAT_HISTORY_KEY);
        if (saved) {
          const parsed = JSON.parse(saved) as ChatMessage[];
          if (Array.isArray(parsed) && parsed.length > 0) return parsed;
        }
      } catch {}
    }
    return [{
      role: 'ai',
      text: 'আসসালামু আলাইকুম! আমি প্রতিষ্ঠানের কেন্দ্রীয় AI সহকারী। যেকোনো প্রশ্ন করুন, যেকোনো সেকশনে যান, শিক্ষার্থী খুঁজুন বা নোটিশ তৈরি করুন।'
    }];
  });
  const [loading, setLoading] = useState(false);
  const [isTyping, setIsTyping] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lastAction, setLastAction] = useState<UniversalAiOutput['actionData'] | null>(null);
  const [lastActionType, setLastActionType] = useState<string | null>(null);
  const [foundStudents, setFoundStudents] = useState<Student[]>([]);

  // Live database caches for intelligent real-time answers
  const [cachedStudents, setCachedStudents] = useState<Student[]>([]);
  const [cachedHolidays, setCachedHolidays] = useState<Holiday[]>([]);
  const [cachedStaff, setCachedStaff] = useState<Staff[]>([]);

  const { selectedYear } = useAcademicYear();
  const { schoolInfo } = useSchoolInfo();
  const { user } = useAuth();
  const db = useFirestore();
  const pathname = usePathname();
  const router = useRouter();
  const { toast } = useToast();

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const recognitionRef = useRef<any>(null);

  const institutionName = schoolInfo?.name || 'টপ গ্রেড টিউটোরিয়ালস';

  // Save chat history to localStorage whenever messages change
  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const toSave = messages.slice(-MAX_SAVED_MESSAGES);
      localStorage.setItem(CHAT_HISTORY_KEY, JSON.stringify(toSave));
    } catch {}
  }, [messages]);

  // Preload students, staff and holidays in background for fast contextual replies
  useEffect(() => {
    if (!db) return;
    getStudents(db).then(setCachedStudents).catch(() => {});
    getHolidays(db).then(setCachedHolidays).catch(() => {});
    getStaff(db).then(setCachedStaff).catch(() => {});
  }, [db]);

  // Auto scroll to bottom
  useEffect(() => {
    if (isOpen) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, isOpen, loading, isTyping]);

  // Speech Recognition (Web Speech API) setup for Bengali Voice Input
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
      if (SpeechRecognition) {
        const recognition = new SpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.lang = 'bn-BD';

        recognition.onresult = (event: any) => {
          const transcript = event.results[0][0].transcript;
          if (transcript) {
            setInputQuery(prev => (prev ? `${prev} ${transcript}` : transcript));
            toast({ title: 'ভয়েস শনাক্ত হয়েছে 🎙️', description: `"${transcript}"` });
          }
          setIsListening(false);
        };

        recognition.onerror = () => setIsListening(false);
        recognition.onend = () => setIsListening(false);
        recognitionRef.current = recognition;
      }
    }
  }, [toast]);

  const toggleListening = () => {
    if (!recognitionRef.current) {
      toast({ variant: 'destructive', title: 'ভয়েস সাপোর্ট নেই', description: 'Chrome ব্যবহার করুন।' });
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
        toast({ title: 'শুনছি... 🎙️', description: 'স্পষ্ট করে বাংলায় বলুন...' });
      } catch {
        setIsListening(false);
      }
    }
  };

  const handleClearChat = useCallback(() => {
    const initialMsg: ChatMessage = {
      role: 'ai',
      text: 'চ্যাট ইতিহাস মুছে ফেলা হয়েছে। নতুন কোনো প্রশ্ন করুন!'
    };
    setMessages([initialMsg]);
    setLastAction(null);
    setLastActionType(null);
    setFoundStudents([]);
    if (typeof window !== 'undefined') {
      try { localStorage.removeItem(CHAT_HISTORY_KEY); } catch {}
    }
    toast({ title: '✅ চ্যাট পরিষ্কার করা হয়েছে' });
  }, [toast]);

  if (typeof window !== 'undefined' && pathname === '/login') {
    return null;
  }

  // Quick navigation finder based on direct keywords
  const findDestinationPath = (text: string): { label: string; path: string } | null => {
    const clean = text.toLowerCase().trim();
    for (const sec of ALL_SYSTEM_SECTIONS) {
      for (const kw of sec.keywords) {
        if (clean === kw || (clean.startsWith('যাও') && clean.includes(kw)) || (clean.includes(kw) && (clean.includes('যাও') || clean.includes('নিয়ে চল') || clean.includes('খোল') || clean.includes('ওপেন')))) {
          return { label: sec.label, path: sec.path };
        }
      }
    }
    return null;
  };

  const handleSend = async (customPrompt?: string) => {
    const queryToSend = customPrompt || inputQuery;
    if (!queryToSend.trim() || loading) return;

    const userMsg: ChatMessage = { role: 'user', text: queryToSend };
    setMessages(prev => [...prev, userMsg]);
    if (!customPrompt) setInputQuery('');
    setLoading(true);
    setIsTyping(true);
    setLastAction(null);
    setLastActionType(null);
    setFoundStudents([]);

    // 1. Instant student search (client-side, zero latency)
    const studentQuery = detectStudentSearch(queryToSend);
    if (studentQuery) {
      const yearStudentsAll = cachedStudents.filter(s => !s.academicYear || s.academicYear === selectedYear);
      const results = searchStudents(yearStudentsAll, studentQuery);
      if (results.length > 0) {
        setFoundStudents(results);
        const summary = results.length === 1
          ? `✅ **${results[0].studentNameBn || results[0].studentNameEn}** পাওয়া গেছে! ${bengaliClass(String(results[0].className))} শ্রেণি, রোল: ${results[0].roll}।`
          : `✅ মোট **${results.length} জন** শিক্ষার্থী পাওয়া গেছে।`;
        setMessages(prev => [...prev, { role: 'ai', text: summary }]);
        setLoading(false);
        setIsTyping(false);
        return;
      }
    }

    // 2. Check for instant direct navigation match
    const directDest = findDestinationPath(queryToSend);
    if (directDest && !queryToSend.includes('কতটি') && !queryToSend.includes('কী কী')) {
      setMessages(prev => [
        ...prev, 
        { role: 'ai', text: `আপনাকে "${directDest.label}"-এ নিয়ে যাওয়া হচ্ছে...` }
      ]);
      setLoading(false);
      setIsTyping(false);
      router.push(directDest.path);
      toast({ title: 'পেজ পরিবর্তন করা হচ্ছে...', description: directDest.label });
      return;
    }

    // 3. Compute exact class breakdowns from active year cached students
    const yearStudents = cachedStudents.filter(s => !s.academicYear || s.academicYear === selectedYear);
    const classCounts: Record<string, number> = { '6': 0, '7': 0, '8': 0, '9': 0, '10': 0 };
    yearStudents.forEach(s => {
      const cls = String(s.className || '').trim();
      if (classCounts[cls] !== undefined) {
        classCounts[cls]++;
      } else {
        classCounts[cls] = (classCounts[cls] || 0) + 1;
      }
    });

    // Build rich live school context snapshot from cached Firestore data
    const liveContext: LiveSchoolContext = {
      totalStudents: yearStudents.length,
      classCounts,
      totalStaff: cachedStaff.length,
      staffSample: cachedStaff.slice(0, 15).map(st => ({
        name: st.nameBn,
        designation: st.designation,
        subject: st.subject,
        mobile: st.mobile,
      })),
      studentsSample: yearStudents.slice(0, 25).map(s => ({
        roll: s.roll,
        className: s.className,
        name: s.studentNameBn,
        mobile: s.guardianMobile || s.studentMobile,
        gender: s.gender,
        group: s.group,
      })),
      upcomingHolidays: cachedHolidays.slice(0, 10).map(h => ({
        date: h.date,
        description: h.description,
      })),
    };

    try {
      const result = await runUniversalAi({
        query: queryToSend,
        academicYear: selectedYear,
        institutionName: institutionName,
        currentPage: pathname,
        chatHistory: messages,
        liveContext,
      });

      const aiMsg: ChatMessage = { role: 'ai', text: result.response };
      setMessages(prev => [...prev, aiMsg]);

      if (result.actionType && result.actionType !== 'CHAT') {
        setLastActionType(result.actionType);
        setLastAction(result.actionData || null);
      }

      // Handle direct page navigation if requested by AI
      if (result.actionType === 'NAVIGATE' && result.actionData?.path) {
        router.push(result.actionData.path);
        toast({ title: 'পেজ পরিবর্তন করা হচ্ছে...', description: result.actionData.path });
      }
    } catch (err: any) {
      console.error('Universal AI Error:', err);
      setMessages(prev => [
        ...prev, 
        { role: 'ai', text: 'দুঃখিত, এআই সংযোগে সমস্যা হয়েছে। অনুগ্রহ করে আবার চেষ্টা করুন।' }
      ]);
    } finally {
      setLoading(false);
      setIsTyping(false);
    }
  };

  const handlePublishNotice = async () => {
    if (!db || !user || !lastAction?.title || !lastAction?.content) return;
    try {
      addNotice(db, {
        title: lastAction.title,
        content: lastAction.content,
        priority: lastAction.priority || 'normal',
        senderName: user.displayName || user.email || 'প্রধান শিক্ষক',
        isScrolling: true,
      });
      toast({ title: 'নোটিশ প্রকাশিত হয়েছে! ✅', description: 'নোটিশ বোর্ডে স্বয়ংক্রিয়ভাবে যুক্ত হয়েছে।' });
      setLastAction(null);
      setLastActionType(null);
      setMessages(prev => [
        ...prev,
        { role: 'ai', text: '✅ আপনার নোটিশটি সফলভাবে নোটিশ বোর্ডে প্রকাশ করা হয়েছে। নোটিশ বোর্ডে গিয়ে দেখতে পাবেন।' }
      ]);
    } catch {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: 'নোটিশ সংরক্ষণ করা যায়নি।' });
    }
  };

  const handlePrintOrExport = (textToPrint: string) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;
    printWindow.document.write(`
      <html>
        <head>
          <title>${institutionName} - রিপোর্ট</title>
          <style>
            body { font-family: 'SolaimanLipi', 'Kalpurush', sans-serif; padding: 40px; color: #111; line-height: 1.6; }
            h2 { color: #1e3a8a; border-bottom: 2px solid #e2e8f0; padding-bottom: 10px; margin-bottom: 20px; }
            .date { font-size: 13px; color: #64748b; margin-bottom: 20px; }
            .content { white-space: pre-wrap; font-size: 15px; }
          </style>
        </head>
        <body>
          <h2>${institutionName}</h2>
          <div class="date">তারিখ: ${new Date().toLocaleDateString('bn-BD')} | শিক্ষাবর্ষ: ${selectedYear}</div>
          <div class="content">${textToPrint}</div>
          <script>window.onload = function() { window.print(); window.close(); }<\/script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const quickPrompts = [
    { label: 'সকল সেকশন', query: 'এখানে মোট কতটি সেকশন আছে বিস্তারিত বলো', icon: Compass },
    { label: 'নোটিশ ড্রাফট', query: 'আগামীকাল প্রতিষ্ঠান বন্ধের জন্য একটি জরুরি নোটিশ তৈরি করো', icon: FileText },
    { label: 'উপস্থিতি', query: 'আজকের ক্লাসের হাজিরা অবস্থা কেমন?', icon: UserCheck },
    { label: 'বকেয়া ফি', query: 'ফি আদায় ও বকেয়ার সারাংশ দাও', icon: CreditCard },
    { label: 'ছুটির তালিকা', query: 'এই শিক্ষাবর্ষের পরবর্তী ছুটিগুলো কবে?', icon: Calendar },
    { label: 'শ্রেণিভিত্তিক ছাত্র', query: '৬ষ্ঠ থেকে ১০ম শ্রেণিতে মোট কতজন শিক্ষার্থী আছে?', icon: Users },
    { label: 'শিক্ষার্থী খোঁজ', query: '', icon: Search, isSearchMode: true },
  ];

  const [searchMode, setSearchMode] = useState(false);

  return (
    <>
      {/* Floating Action Button */}
      <div className="fixed bottom-6 right-6 z-50 no-print flex flex-col items-end gap-2">
        {!isOpen && (
          <button
            onClick={() => setIsOpen(true)}
            className="group relative flex items-center gap-2.5 bg-gradient-to-r from-indigo-600 via-indigo-700 to-purple-600 text-white px-4 py-3 rounded-full shadow-2xl hover:shadow-indigo-500/50 hover:scale-105 active:scale-95 transition-all duration-300 border-2 border-white/20"
            title="AI সহকারী ওপেন করুন"
          >
            <div className="relative">
              <Bot className="h-6 w-6 text-white group-hover:rotate-12 transition-transform duration-300" />
              <span className="absolute -top-1 -right-1 flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-500"></span>
              </span>
            </div>
            <span className="font-kalpurush font-black text-sm tracking-wide pr-1">AI সহকারী</span>
            <Sparkles className="h-4 w-4 text-amber-300 animate-pulse" />
          </button>
        )}

        {/* Chat Portal Modal */}
        {isOpen && (
          <div 
            className={`flex flex-col bg-white rounded-2xl shadow-2xl border border-indigo-200 overflow-hidden font-kalpurush transition-all duration-300 ${
              isExpanded 
                ? 'w-[95vw] md:w-[760px] h-[88vh] max-h-[850px]' 
                : 'w-[92vw] sm:w-[460px] h-[640px] max-h-[88vh]'
            }`}
          >
            {/* Header */}
            <div className="bg-gradient-to-r from-indigo-700 via-indigo-800 to-purple-800 text-white p-4 flex items-center justify-between shadow-md">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-white/10 rounded-xl backdrop-blur-sm border border-white/10">
                  <Bot className="h-6 w-6 text-amber-300" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-black text-base leading-tight">স্মার্ট কন্ট্রোল সেন্টার (AI)</h3>
                    <Badge variant="outline" className="text-[10px] bg-white/10 text-emerald-300 border-emerald-400/30 px-1.5 py-0">
                      লাইভ ডাটা
                    </Badge>
                  </div>
                  <p className="text-[11px] text-indigo-200 font-bold mt-0.5">
                    {institutionName} • {selectedYear} সেশন
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                {/* History badge showing saved count */}
                {messages.length > 1 && (
                  <Badge variant="outline" className="text-[9px] bg-white/10 text-white/70 border-white/20 px-1.5 h-5 gap-1 hidden sm:flex">
                    <History className="h-2.5 w-2.5" /> {messages.length} বার্তা
                  </Badge>
                )}
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleClearChat}
                  className="h-8 w-8 text-white/70 hover:text-white hover:bg-red-500/30 rounded-lg"
                  title="চ্যাট মুছে দিন"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsExpanded(!isExpanded)}
                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                  title={isExpanded ? 'সংক্ষিপ্ত করুন' : 'বড় করুন'}
                >
                  {isExpanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsOpen(false)}
                  className="h-8 w-8 text-white/80 hover:text-white hover:bg-white/10 rounded-lg"
                  title="বন্ধ করুন"
                >
                  <X className="h-5 w-5" />
                </Button>
              </div>
            </div>

            {/* Quick Suggestions Chips */}
            <div className="bg-indigo-50/70 border-b border-indigo-100 p-2 overflow-x-auto flex gap-1.5 scrollbar-none">
              {quickPrompts.map((item, idx) => {
                const Icon = item.icon;
                const isSearch = (item as any).isSearchMode;
                return (
                  <button
                    key={idx}
                    onClick={() => {
                      if (isSearch) {
                        setSearchMode(true);
                        setInputQuery('রোল ');
                      } else {
                        handleSend(item.query);
                      }
                    }}
                    disabled={loading}
                    className="flex items-center gap-1.5 text-[11px] font-black bg-white hover:bg-indigo-600 hover:text-white text-indigo-900 border border-indigo-200 px-2.5 py-1 rounded-full whitespace-nowrap shadow-sm transition-all"
                  >
                    <Icon className="h-3 w-3" />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </div>

            {/* Messages Scroll Area */}
            <div className="flex-1 overflow-y-auto p-4 space-y-3.5 bg-slate-50/60 text-sm">
              {messages.map((msg, index) => (
                <div
                  key={index}
                  className={`flex flex-col ${msg.role === 'user' ? 'items-end' : 'items-start'}`}
                >
                  <div
                    className={`max-w-[88%] rounded-2xl p-3.5 shadow-sm leading-relaxed ${
                      msg.role === 'user'
                        ? 'bg-indigo-600 text-white rounded-br-none font-medium'
                        : 'bg-white text-slate-800 border border-slate-200/80 rounded-bl-none font-normal'
                    }`}
                  >
                    <p className="whitespace-pre-wrap">{msg.text}</p>
                  </div>
                  {/* Print / Export Action Button on AI responses */}
                  {msg.role === 'ai' && index > 0 && (
                    <div className="flex gap-2 mt-1 px-1">
                      <button
                        onClick={() => handlePrintOrExport(msg.text)}
                        className="text-[10px] text-slate-500 hover:text-indigo-600 flex items-center gap-1 font-bold transition-colors"
                        title="প্রিন্ট বা PDF হিসেবে সংরক্ষণ করুন"
                      >
                        <Printer className="h-3 w-3" /> প্রিন্ট / এক্সপোর্ট
                      </button>
                    </div>
                  )}
                </div>
              ))}

              {/* Student Search Results Card */}
              {foundStudents.length > 0 && (
                <StudentResultCard
                  students={foundStudents}
                  onNavigate={(path) => {
                    router.push(path);
                    toast({ title: 'প্রোফাইল পেজে নিয়ে যাওয়া হচ্ছে...' });
                  }}
                />
              )}

              {/* Action Preview Card (For Notice Draft) */}
              {lastActionType === 'NOTICE_DRAFT' && lastAction && (
                <div className="p-3.5 bg-amber-50 border-2 border-amber-300 rounded-xl space-y-2.5 shadow-sm animate-in fade-in">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-black text-amber-900 flex items-center gap-1.5">
                      <FileText className="h-4 w-4 text-amber-700" /> নোটিশ ড্রাফট প্রস্তুত
                    </span>
                    <Badge variant="outline" className="bg-white text-amber-800 border-amber-300 text-[10px]">
                      এক ক্লিকে প্রকাশ
                    </Badge>
                  </div>
                  <div className="bg-white p-3 rounded-lg border border-amber-200 space-y-1">
                    <h4 className="font-black text-sm text-slate-900">{lastAction.title}</h4>
                    <p className="text-xs text-slate-600 line-clamp-3 whitespace-pre-wrap">{lastAction.content}</p>
                  </div>
                  <div className="flex justify-between gap-2 pt-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handlePrintOrExport(`${lastAction.title}\n\n${lastAction.content}`)}
                      className="text-xs h-8 px-3 font-bold border-amber-300 text-amber-800 hover:bg-amber-50"
                    >
                      <Printer className="h-3 w-3 mr-1" /> প্রিন্ট
                    </Button>
                    <Button
                      size="sm"
                      onClick={handlePublishNotice}
                      className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-8 px-4"
                    >
                      <CheckCircle2 className="h-3.5 w-3.5 mr-1" /> নোটিশ বোর্ডে প্রকাশ করুন
                    </Button>
                  </div>
                </div>
              )}

              {/* Action Preview Card (For Navigation Action) */}
              {lastActionType === 'NAVIGATE' && lastAction?.path && (
                <div className="p-3 bg-indigo-50 border border-indigo-200 rounded-xl flex items-center justify-between shadow-sm">
                  <span className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
                    <ArrowRight className="h-4 w-4 text-indigo-600" /> সংশ্লিষ্ট সেকশন: {lastAction.path}
                  </span>
                  <Button
                    size="sm"
                    onClick={() => router.push(lastAction.path!)}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs h-7 px-3 font-bold"
                  >
                    ওপেন করুন
                  </Button>
                </div>
              )}

              {/* Typing Indicator */}
              {isTyping && (
                <div className="flex justify-start">
                  <div className="bg-white border border-indigo-100 rounded-2xl rounded-bl-none p-3.5 shadow-sm flex items-center gap-2 text-indigo-700 font-bold text-xs">
                    <div className="flex gap-1 items-center">
                      <span className="w-2 h-2 bg-indigo-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                      <span className="w-2 h-2 bg-indigo-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                      <span className="w-2 h-2 bg-indigo-600 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                    </div>
                    <span>AI বিশ্লেষণ করছে...</span>
                  </div>
                </div>
              )}

              <div ref={messagesEndRef} />
            </div>

            {/* Quick Section Navigator Dropdown Bar */}
            <div className="px-3 py-1.5 bg-slate-100/80 border-t border-slate-200 flex items-center justify-between text-[11px]">
              <span className="text-slate-500 font-bold flex items-center gap-1">
                <Compass className="h-3 w-3 text-indigo-600" /> কুইক জাম্প:
              </span>
              <div className="flex gap-1 overflow-x-auto scrollbar-none max-w-[75%]">
                {[
                  { label: 'হোম', path: '/' },
                  { label: 'ছাত্র', path: '/student-list' },
                  { label: 'হাজিরা', path: '/attendance' },
                  { label: 'হিসাব', path: '/accounts' },
                  { label: 'ফলাফল', path: '/results' },
                  { label: 'রুটিন', path: '/routines' },
                  { label: 'নোটিশ', path: '/notices-management' },
                  { label: 'স্টাফ', path: '/staff' },
                  { label: 'প্রশ্ন', path: '/create-question' },
                ].map((s, idx) => (
                  <button
                    key={idx}
                    onClick={() => {
                      router.push(s.path);
                      toast({ title: `${s.label} পেজে নিয়ে যাওয়া হচ্ছে...` });
                    }}
                    className="px-2 py-0.5 bg-white border border-slate-200 rounded text-slate-700 hover:text-indigo-600 hover:border-indigo-400 font-bold whitespace-nowrap text-[10px]"
                  >
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Input Bar with Bengali Voice Support */}
            <div className="p-3 bg-white border-t border-slate-200 flex gap-2 items-center">
              <Button
                type="button"
                variant={isListening ? 'destructive' : 'outline'}
                size="icon"
                onClick={toggleListening}
                className={`h-10 w-10 shrink-0 transition-all ${
                  isListening ? 'animate-pulse ring-2 ring-rose-500' : 'border-indigo-200 hover:bg-indigo-50 text-indigo-700'
                }`}
                title={isListening ? 'রেকর্ডিং বন্ধ করুন' : 'মুখে বাংলায় বলুন (ভয়েস ইনপুট)'}
              >
                {isListening ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </Button>

              <Input
                placeholder={
                  isListening 
                    ? 'শুনছি... মুখে বলুন...' 
                    : searchMode 
                      ? 'রোল নম্বর বা নাম লিখুন...'
                      : 'বাংলায় যেকোনো প্রশ্ন লিখুন বা বলুন...'
                }
                value={inputQuery}
                onChange={e => { setInputQuery(e.target.value); if (searchMode && e.target.value === '') setSearchMode(false); }}
                onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSend()}
                disabled={loading}
                className="flex-1 font-medium text-xs md:text-sm h-10 border-indigo-200 focus-visible:ring-indigo-600"
              />

              <Button
                onClick={() => handleSend()}
                disabled={loading || !inputQuery.trim()}
                className="bg-indigo-600 hover:bg-indigo-700 text-white h-10 px-4 font-black text-xs shrink-0 shadow-md"
              >
                {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}

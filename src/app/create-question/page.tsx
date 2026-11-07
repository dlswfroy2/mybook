"use client";

import React, { useState, useEffect, Suspense, useMemo, useRef, useCallback } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { CLASSES, getSubjectsForClass, getChaptersForSubject } from '@/lib/constants';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Badge } from '@/components/ui/badge';
import { Checkbox } from '@/components/ui/checkbox';
import { 
  Printer, 
  Shuffle,
  GraduationCap,
  Plus, 
  Minus,
  Trash2, 
  BookOpen, 
  Save, 
  FileText, 
  ArrowLeft, 
  Loader2, 
  Image as ImageIcon, 
  X, 
  ScanText, 
  CheckCircle2,
  BrainCircuit,
  Search,
  Layers,
  LayoutGrid,
  Eye,
  QrCode,
  LayoutTemplate,
  Sparkles,
  ListChecks,
  Code2
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useFirestore, useUser, useDoc } from '@/firebase';
import { collection, setDoc, doc, getDoc, serverTimestamp } from 'firebase/firestore';
import { errorEmitter } from '@/firebase/error-emitter';
import { FirestorePermissionError } from '@/firebase/errors';
import { cn } from '@/lib/utils';
import { generatePracticeQuestions } from '@/ai/flows/generate-practice-questions';
import { expandLectureContent, generateLectureSheet } from '@/ai/flows/generate-lecture-sheet-flow';
import { performAiOcr } from '@/ai/flows/ocr-flow';
import { QuestionPrintView } from '@/components/QuestionPrintView';
import { formatQuestionToBoardStandardHtml, stripAnswers, parseGeneratedQuestions } from '@/lib/question-formatter';
import { format } from 'date-fns';

type Question = {
  id: string;
  type: 'creative' | 'short' | 'mcq';
  content: string;
  imageUrl?: string;
  isFromBank?: boolean;
  section?: string;
};

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit)]);
}

function stripDirtyHtml(html: string): string {
  if (!html) return '';
  return html
    .replace(/<\/p\s*>\s*<\s*p\s*style\s*=[^>]*0px0px4px[^>]*>/gi, '<br/>')
    .replace(/<\/p\s*>\s*<\s*p\s*style\s*=[^>]*margin[^>]*>/gi, '<br/>');
}

function formatMath(text: string): string {
  if (!text) return '';
  let formatted = text.replace(/\$|\\\(|\\\)|\\\[|\\\]|###|\*\*/g, '');
  formatted = formatted.replace(/\(\((.*?)\)\)/g, '$1').replace(/\[\[(.*?)\]\]/g, '$1').trim();
  formatted = formatted.replace(/\\text\{([^}]+)\}/g, '<span class="math-text">$1</span>');
  const fracRegex = /\\frac\{((?:[^{}]|\{[^{}]*\})*)\}\s*\{((?:[^{}]|\{[^{}]*\})*)\}/g;
  formatted = formatted.replace(fracRegex, '<span class="math-frac"><span class="math-num">$1</span><span class="math-den">$2</span></span>');
  formatted = formatted.replace(/\\sqrt\[([^\]]+)\]\{([^}]+)\}/g, '<span class="math-sqrt"><sup class="math-root">$1</sup>√<span class="math-sqrt-stem">$2</span></span>');
  formatted = formatted.replace(/\\sqrt\{([^}]+)\}/g, '<span class="math-sqrt">√<span class="math-sqrt-stem">$1</span></span>');
  formatted = formatted.replace(/\^\{([^}]+)\}/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/\^(\d+|[a-z]|[A-Z])/g, '<sup class="math-sup">$1</sup>');
  formatted = formatted.replace(/_\{([^}]+)\}/g, '<sub class="math-sub">$1</sub>');
  formatted = formatted.replace(/_(\d+|[a-z]|[A-Z])/g, '<sub class="math-sub">$1</sub>');
  const symbolMap: Record<string, string> = {
    '\\\\log': 'log', '\\\\triangle': '△', '\\\\angle': '∠', '\\\\circ': '°',
    '\\\\theta': 'θ', '\\\\pi': 'π', '\\\\pm': '±', '\\\\times': '×',
    '\\\\neq': '≠', '\\\\ne': '≠', '\\\\leq': '≤', '\\\\geq': '≥',
    '\\\\degree': '°', '\\\\cdot': '·', '\\\\infty': '∞', '\\\\approx': '≈',
    '\\\\sum': '∑', '\\\\prod': '∏', '\\\\alpha': 'α', '\\\\beta': 'β',
    '\\\\gamma': 'γ', '\\\\delta': 'δ', '\\\\sigma': 'σ', '\\\\phi': 'φ', '\\\\omega': 'ω',
    '\\\\eta': 'η', '\\\\rho': 'র', '\\\\lambda': 'λ', '\\\\mu': 'μ',
    '\\\\div': '÷', '\\\\rightarrow': '→', '\\\\to': '→', '\\\\arrow': '→',
    '\\\\in': '∈', '\\\\mathbb\\{N\\}': 'ℕ', '\\\\mathbb\\{R\\}': 'ℝ', '\\\\mathbb\\{Z\\}': 'ℤ',
    '\\\\mathbb\\{Q\\}': 'ℚ', '\\\\subset': '⊂', '\\\\subseteq': '⊆', '\\\\cup': '∪',
    '\\\\cap': '∩', '\\\\emptyset': '∅', '\\\\forall': '∀', '\\\\exists': '∃', 
    '\\\\Rightarrow': '⇒', '\\\\leftarrow': '←', '\\\\Leftarrow': '⇐', 
    '\\\\leftrightarrow': '↔', '\\\\Leftrightarrow': '⇔',
    '\\\\left': '', '\\\\right': '', '\\\\%': '%', '\\\\setminus': '\\', '\\\\backslash': '\\',
    '\\\\propto': '∝', '\\\\parallel': '∥', '\\\\perp': '⊥'
  };
  Object.entries(symbolMap).forEach(([key, val]) => { formatted = formatted.replace(new RegExp(key, 'g'), val); });
  formatted = formatted.replace(/\\dot\{([^}]+)\}/g, '<span class="math-dot">$1</span>');
  formatted = formatted.replace(/\\/g, '');
  return formatted;
}

function CreateQuestionContent() {
  const db = useFirestore();
  const { user, loading: userLoading } = useUser();
  const searchParams = useSearchParams();
  const router = useRouter();
  const editId = searchParams.get('id');
  const source = searchParams.get('source');
  const isPrintMode = searchParams.get('print') === 'true';
  const { toast } = useToast();
  
  const [loading, setLoading] = useState(!!editId || source === 'merge');
  const [saving, setSaving] = useState(false);
  const [activeMainTab, setActiveMainTab] = useState<'editor' | 'cards' | 'raw_code'>('editor');
  
  const softwareDocRef = useMemo(() => db ? doc(db, 'config', 'software') : null, [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';
  
  const [meta, setMeta] = useState({
    institution: 'টপ গ্রেড টিউটোরিয়ালস', 
    exam: 'সাপ্তাহিক পরীক্ষা', 
    examType: 'creative',
    chapter: '', 
    classId: '', 
    subject: '', 
    time: '২ ঘণ্টা ৩০ মিনিট', 
    totalMarks: '১০০',
    creativeInstruction: 'যেকোনো ৭টি প্রশ্নের উত্তর দাও', 
    shortInstruction: 'সকল প্রশ্নের উত্তর দাও',
    mcqInstruction: 'সঠিক উত্তরের বিপরীতের বৃত্তটি বল পয়েন্ট কলম দ্বারা ভরাট কর। সকল প্রশ্নের উত্তর দিতে হবে।', 
    marksA: 1, marksB: 2, marksC: 3, marksD: 4, shortMarks: 2, mcqMarks: 1,
    currentSection: '',
    content: ''
  });
  
  const [questions, setQuestions] = useState<Question[]>([]);
  const [questionsB, setQuestionsB] = useState<Question[]>([]);
  const [activeSet, setActiveSet] = useState<'A' | 'B'>('A');
  const [selectedChapters, setSelectedChapters] = useState<string[]>([]);
  const [aiAssistantChapters, setAiAssistantChapters] = useState<string[]>([]);

  // Document Content for Live Visual Editor & Print
  const [documentContent, setDocumentContent] = useState<string>('');
  const contentEditableRef = useRef<HTMLDivElement>(null);

  // Sync questions to document content when questions change
  const syncQuestionsToContent = useCallback((qList: Question[], qbList: Question[] = []) => {
    const isEng = meta.subject?.toLowerCase().includes('english') || meta.subject?.toLowerCase().includes('ইংরেজি');
    const parts: string[] = [];
    if (qList.length > 0) {
      qList.forEach((q, idx) => {
        parts.push(formatQuestionToBoardStandardHtml(q.content || '', idx, Boolean(isEng), q.type));
      });
    }
    if (qbList.length > 0) {
      parts.push(`<div class="set-b-header" style="page-break-before: always; margin-top: 24px; border-top: 2px dashed #000; padding-top: 12px; text-align: center; font-weight: bold; font-size: 13pt;">--- সেট: খ (B) ---</div>`);
      qbList.forEach((q, idx) => {
        parts.push(formatQuestionToBoardStandardHtml(q.content || '', idx, Boolean(isEng), q.type));
      });
    }
    const res = parts.join('\n');
    setDocumentContent(res);
    setMeta(prev => ({ ...prev, content: res }));
  }, [meta.subject]);

  const insertSnippet = useCallback((snippetHtml: string) => {
    setDocumentContent(prev => {
      const updated = prev ? `${prev}\n\n${snippetHtml}` : snippetHtml;
      setMeta(m => ({ ...m, content: updated }));
      return updated;
    });
  }, []);

  // 1. AI Full Paper Generator Dialog State
  const [aiModalOpen, setAiModalOpen] = useState(false);
  const [aiGenerating, setAiGenerating] = useState(false);
  const [aiType, setAiType] = useState<'creative' | 'short' | 'mcq' | 'mixed'>('creative');
  const [aiCount, setAiCount] = useState<number>(3);
  const [aiTopic, setAiTopic] = useState('');

  // 2. AI Assistant (Multi-Question & Difficulty Dialog) State
  const [aiAssistantOpen, setAiAssistantOpen] = useState(false);
  const [aiAssistantPrompt, setAiAssistantPrompt] = useState('');
  const [aiAssistantClassId, setAiAssistantClassId] = useState<string>('9');
  const [aiAssistantSubject, setAiAssistantSubject] = useState<string>('পদার্থবিজ্ঞান');
  const [aiAssistantChapter, setAiAssistantChapter] = useState<string>('');
  const [aiAssistantDifficulty, setAiAssistantDifficulty] = useState<'easy' | 'medium' | 'hard' | 'mixed'>('medium');
  const [isAiExpanding, setIsAiExpanding] = useState(false);
  const [aiQuestionTypes, setAiQuestionTypes] = useState({
    creative: true,
    creativeCount: 3,
    short: false,
    shortCount: 5,
    mcq: false,
    mcqCount: 10,
    knowledge: false,
    knowledgeCount: 5,
    fillInBlanks: false,
    fillInBlanksCount: 5,
  });

  const totalAiQuestionsCount = useMemo(() => {
    let count = 0;
    if (aiQuestionTypes.creative) count += aiQuestionTypes.creativeCount;
    if (aiQuestionTypes.short) count += aiQuestionTypes.shortCount;
    if (aiQuestionTypes.mcq) count += aiQuestionTypes.mcqCount;
    if (aiQuestionTypes.knowledge) count += aiQuestionTypes.knowledgeCount;
    if (aiQuestionTypes.fillInBlanks) count += aiQuestionTypes.fillInBlanksCount;
    return count;
  }, [aiQuestionTypes]);

  const handleOpenAiAssistant = useCallback(() => {
    setAiAssistantClassId(meta.classId || '9');
    setAiAssistantSubject(meta.subject || 'পদার্থবিজ্ঞান');
    setAiAssistantChapter(meta.chapter || '');
    setAiAssistantOpen(true);
  }, [meta.classId, meta.subject, meta.chapter]);

  const handleAiAssistantSubmit = useCallback(async () => {
    setIsAiExpanding(true);
    try {
      const generated = await expandLectureContent({
        topicPrompt: aiAssistantPrompt.trim(),
        className: aiAssistantClassId,
        subject: aiAssistantSubject,
        chapter: aiAssistantChapter,
        difficulty: aiAssistantDifficulty,
        mode: 'questions',
        questionCounts: {
          creative: aiQuestionTypes.creative ? aiQuestionTypes.creativeCount : 0,
          short: aiQuestionTypes.short ? aiQuestionTypes.shortCount : 0,
          mcq: aiQuestionTypes.mcq ? aiQuestionTypes.mcqCount : 0,
          knowledge: aiQuestionTypes.knowledge ? aiQuestionTypes.knowledgeCount : 0,
          fillInBlanks: aiQuestionTypes.fillInBlanks ? aiQuestionTypes.fillInBlanksCount : 0,
        },
        totalQuestions: totalAiQuestionsCount,
        type: 'qa'
      });

      if (generated) {
        // Strip any answers and parse into individual board-standard questions
        const parsedQuestions = parseGeneratedQuestions(generated);
        const newQList: Question[] = parsedQuestions.map(pq => ({
          id: Math.random().toString(36).substr(2, 9),
          type: pq.type,
          content: pq.content,
          imageUrl: '',
          section: meta.currentSection
        }));

        if (activeSet === 'B') {
          const updatedB = [...questionsB, ...newQList];
          setQuestionsB(updatedB);
          syncQuestionsToContent(questions, updatedB);
        } else {
          const updatedA = [...questions, ...newQList];
          setQuestions(updatedA);
          syncQuestionsToContent(updatedA, questionsB);
        }

        toast({ title: 'AI প্রশ্ন তৈরি সম্পন্ন! ✨', description: `মোট ${newQList.length}টি প্রশ্ন নির্ভুল ফরম্যাটে যুক্ত হয়েছে।` });
        setAiAssistantOpen(false);
        setAiAssistantPrompt('');
      }
    } catch (e: any) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: e.message || 'প্রশ্ন তৈরি করা সম্ভব হয়নি।' });
    } finally {
      setIsAiExpanding(false);
    }
  }, [
    aiAssistantPrompt,
    aiAssistantClassId,
    aiAssistantSubject,
    aiAssistantChapter,
    aiAssistantDifficulty,
    aiQuestionTypes,
    totalAiQuestionsCount,
    insertSnippet,
    activeSet,
    meta.currentSection,
    toast
  ]);

  // 3. Ready-made Question Paper Templates
  const [templateModalOpen, setTemplateModalOpen] = useState(false);
  const QUESTION_TEMPLATES = useMemo(() => [
    {
      id: 'cq_standard',
      title: '📝 সৃজনশীল প্রশ্ন কাঠামো (CQ Standard)',
      desc: 'বোর্ড স্ট্যান্ডার্ড উদ্দীপক ও ক, খ, গ, ঘ প্রশ্ন এবং নম্বর বণ্টন [১, ২, ৩, ৪]',
      content: `<div class="template-section my-3">
<div style="background-color: #f8fafc; border: 1px solid #cbd5e1; border-radius: 6px; padding: 12px; margin-bottom: 8px;">
  <p><strong>১। উদ্দীপক:</strong> একটি গতিশীল বস্তুর ক্ষেত্রে পর্যবেক্ষণে দেখা গেল যে, আদিবেগ ২০ মি./সে. থেকে সমত্বরণে ৫ সেকেন্ডে বেগ ৪০ মি./সে. হলো। বস্তুর ভর ছিল ৫০ কেজি।</p>
</div>
<ol type="a" style="padding-left: 20px; line-height: 1.8;">
  <li><strong>ক.</strong> ত্বরণ কাকে বলে? <span style="float: right; font-weight: bold;">[১]</span></li>
  <li><strong>খ.</strong> সুষম বেগ ও সমত্বরণের মধ্যে পার্থক্য লিখো। <span style="float: right; font-weight: bold;">[২]</span></li>
  <li><strong>গ.</strong> উদ্দীপকের বস্তুটির ত্বরণ ও অতিক্রান্ত দূরত্ব নির্ণয় করো। <span style="float: right; font-weight: bold;">[৩]</span></li>
  <li><strong>ঘ.</strong> উদ্দীপকের তথ্যানুযায়ী বলের মান পরিবর্তন হলে কী ঘটবে তা গাণিতিকভাবে বিশ্লেষণ করো। <span style="float: right; font-weight: bold;">[৪]</span></li>
</ol>
</div>`
    },
    {
      id: 'mcq_grid',
      title: '🔘 বহুনির্বাচনী প্র্যাকটিস গ্রিড (MCQ Grid)',
      desc: '৪টি অপশনসহ সাজানো বহুনির্বাচনী প্রশ্ন কাঠামো',
      content: `<div class="template-section my-3">
<div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">
  <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px;">
    <p><strong>১. মৌলিক রাশি কোনটি?</strong></p>
    <p style="font-size: 0.9em; margin-top: 4px;">(ক) বেগ &nbsp;&nbsp;&nbsp; (খ) ত্বরণ<br/>(গ) দৈর্ঘ্য &nbsp;&nbsp;&nbsp; (ঘ) বল</p>
  </div>
  <div style="border: 1px solid #e2e8f0; border-radius: 6px; padding: 8px;">
    <p><strong>২. কাজের এস.আই একক কী?</strong></p>
    <p style="font-size: 0.9em; margin-top: 4px;">(ক) জুল &nbsp;&nbsp;&nbsp; (খ) ওয়াট<br/>(গ) নিউটন &nbsp;&nbsp;&nbsp; (ঘ) ক্যালরি</p>
  </div>
</div>
</div>`
    },
    {
      id: 'knowledge_comprehension',
      title: '💡 জ্ঞান ও অনুধাবনমূলক প্রশ্নোত্তর সেট',
      desc: 'সংক্ষিপ্ত সংজ্ঞা, একক, সমীকরণ ও ব্যাখ্যাধর্মী প্রশ্ন',
      content: `<div class="template-section my-3">
<div style="margin-bottom: 12px;">
  <p><strong>১। (জ্ঞানমূলক):</strong> নির্দিষ্ট বৈজ্ঞানিক/পাঠ্য বিষয় কাকে বলে? <span style="float: right; font-weight: bold;">[১]</span></p>
  <p style="color: #1f2937; padding-left: 16px;"><strong>উত্তর:</strong> পাঠ্যবইয়ের প্রমিত ভাষা অনুযায়ী সুনির্দিষ্ট এক লাইনের সংজ্ঞা লিখুন।</p>
</div>
<div style="margin-bottom: 12px;">
  <p><strong>২। (অনুধাবনমূলক):</strong> উক্তিটির তাৎপর্য ব্যাখ্যা করো। <span style="float: right; font-weight: bold;">[২]</span></p>
  <p style="color: #1f2937; padding-left: 16px;"><strong>উত্তর:</strong> প্রথমে মূল বিষয় উল্লেখ করে দুই-তিন বাক্যে কারণ ও প্রভাব ব্যাখ্যা করুন।</p>
</div>
</div>`
    },
    {
      id: 'model_test_header',
      title: '🏆 পূর্ণাঙ্গ মডেল টেস্ট কাঠামো',
      desc: 'বিভাগ ক (সৃজনশীল) ও বিভাগ খ (বহুনির্বাচনী) সমন্বিত',
      content: `<div class="template-section my-3">
<div style="text-align: center; border-bottom: 2px solid #000; padding-bottom: 6px; margin-bottom: 12px;">
  <h3 style="font-weight: bold; font-size: 13pt; margin: 0;">ক-বিভাগ (সৃজনশীল প্রশ্ন)</h3>
  <p style="font-size: 10pt; margin: 2px 0 0 0; font-style: italic;">(যেকোনো ৪টি প্রশ্নের উত্তর দাও: ৪ × ১০ = ৪০)</p>
</div>
<p><strong>১। উদ্দীপক:</strong> এখানে প্রথম সৃজনশীল প্রশ্নের উদ্দীপক ও ক, খ, গ, ঘ লিখুন।</p>
</div>`
    }
  ], []);

  // 4. QR Code Generator Dialog
  const [qrModalOpen, setQrModalOpen] = useState(false);
  const [qrUrl, setQrUrl] = useState('');
  const [qrCaption, setQrCaption] = useState('অনলাইন সমাধান ও বিস্তারিত দেখতে স্ক্যান করুন');
  const [qrSize, setQrSize] = useState('110');

  const handleInsertQrCode = useCallback(() => {
    if (!qrUrl.trim()) {
      toast({ variant: 'destructive', title: 'লিংক প্রয়োজন', description: 'দয়া করে একটি সঠিক URL দিন।' });
      return;
    }
    const safeUrl = qrUrl.trim();
    const qrImgSrc = `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(safeUrl)}&size=${qrSize}x${qrSize}&margin=2`;
    const qrHtml = `<div class="qr-container my-3 p-2 bg-slate-50 border border-slate-200 rounded-lg inline-flex flex-col items-center gap-1.5" style="display: inline-flex; text-align: center;">
  <img src="${qrImgSrc}" alt="QR Code" width="${qrSize}" height="${qrSize}" style="border-radius: 4px;" />
  <span style="font-size: 9pt; font-weight: bold; color: #4b5563;">${qrCaption || 'স্ক্যান করুন'}</span>
</div>`;
    insertSnippet(qrHtml);
    setQrModalOpen(false);
    setQrUrl('');
    toast({ title: 'QR কোড যুক্ত হয়েছে! 📱', description: 'প্রশ্নপত্রে QR কোড সফলভাবে যুক্ত হয়েছে।' });
  }, [qrUrl, qrSize, qrCaption, insertSnippet, toast]);

  // 5. OCR Scanner State
  const [isScanning, setIsScanning] = useState(false);
  const ocrInputRef = useRef<HTMLInputElement>(null);

  const handleOCR = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsScanning(true);
    try {
      const reader = new FileReader();
      reader.onload = async () => {
        const fileDataUri = reader.result as string;
        const result = await performAiOcr({ fileDataUri, mimeType: file.type });
        if (result?.text) {
          const text = result.text;
          const newQ: Question = {
            id: Math.random().toString(36).substr(2, 9),
            type: 'creative',
            content: text,
            imageUrl: '',
            section: meta.currentSection
          };
          if (activeSet === 'B') setQuestionsB(prev => [...prev, newQ]);
          else setQuestions(prev => [...prev, newQ]);
          insertSnippet(`<div class="ocr-scanned-block my-3 p-3 bg-amber-50/50 border border-amber-200 rounded-lg"><p><strong>স্ক্যানকৃত প্রশ্ন:</strong></p>${text.replace(/\n/g, '<br/>')}</div>`);
          toast({ title: 'এআই স্ক্যান সফল!', description: 'প্রশ্নপত্রে কন্টেন্ট যুক্ত হয়েছে।' });
        }
      };
      reader.readAsDataURL(file);
    } catch (err: any) {
      toast({ variant: 'destructive', title: 'স্ক্যান ত্রুটি', description: err.message || 'স্ক্যান ব্যর্থ হয়েছে।' });
    } finally {
      setIsScanning(false);
      if (ocrInputRef.current) ocrInputRef.current.value = '';
    }
  };

  // Random Question Paper Generator
  const [randomGenerating, setRandomGenerating] = useState(false);
  const handleGenerateRandomPaper = async () => {
    if (!meta.classId || !meta.subject) {
      toast({
        variant: 'destructive',
        title: 'তথ্য দিন',
        description: 'র‍্যান্ডম প্রশ্নপত্র তৈরির জন্য শ্রেণি এবং বিষয় নির্বাচন করুন।'
      });
      return;
    }
    setRandomGenerating(true);
    try {
      const count = meta.examType === 'mcq' ? 20 : 5;
      const result = await generatePracticeQuestions({
        classId: meta.classId,
        subject: meta.subject,
        chapter: meta.chapter || 'সম্পূর্ণ বইয়ের গুরুত্বপূর্ণ অধ্যায়সমূহ',
        type: meta.examType === 'mcq' ? 'mcq' : 'mixed',
        count: count,
        institutionName: meta.institution,
      });

      if (!result.questions || result.questions.length === 0) {
        throw new Error('র‍্যান্ডম প্রশ্ন জেনারেট করা সম্ভব হয়নি।');
      }

      const generatedList: Question[] = result.questions.map((q) => ({
        id: Math.random().toString(36).substr(2, 9),
        type: q.type,
        content: q.formattedText,
        imageUrl: '',
        isFromBank: false,
        section: meta.currentSection,
      }));

      setQuestions(generatedList);
      syncQuestionsToContent(generatedList, questionsB);
      toast({
        title: 'র‍্যান্ডম প্রশ্নপত্র প্রস্তুত! 🎲',
        description: `মোট ${generatedList.length}টি প্রশ্ন দিয়ে সম্পূর্ণ প্রশ্নপত্র তৈরি করা হয়েছে।`
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'ত্রুটি',
        description: err.message || 'র‍্যান্ডম প্রশ্নপত্র তৈরি ব্যর্থ হয়েছে।'
      });
    } finally {
      setRandomGenerating(false);
    }
  };

  // Full AI Question Paper Generator
  const handleGenerateAiQuestions = async () => {
    if (!meta.classId || !meta.subject) {
      toast({
        variant: 'destructive',
        title: 'অসম্পূর্ণ তথ্য',
        description: 'দয়া করে শ্রেণি এবং বিষয় নির্বাচন করুন।',
      });
      return;
    }

    setAiGenerating(true);
    try {
      const result = await generatePracticeQuestions({
        classId: meta.classId,
        subject: meta.subject,
        chapter: meta.chapter ? `${meta.chapter}${aiTopic ? ` - ${aiTopic}` : ''}` : aiTopic,
        type: aiType,
        count: aiCount,
        institutionName: meta.institution,
      });

      if (!result.questions || result.questions.length === 0) {
        throw new Error('কোনো প্রশ্ন জেনারেট হয়নি।');
      }

      const newGeneratedList: Question[] = result.questions.map((q) => ({
        id: Math.random().toString(36).substr(2, 9),
        type: q.type,
        content: q.formattedText,
        imageUrl: '',
        isFromBank: false,
        section: meta.currentSection,
      }));

      if (activeSet === 'B') {
        const updatedB = [...questionsB, ...newGeneratedList];
        setQuestionsB(updatedB);
        syncQuestionsToContent(questions, updatedB);
      } else {
        const updatedA = [...questions, ...newGeneratedList];
        setQuestions(updatedA);
        syncQuestionsToContent(updatedA, questionsB);
      }
      setAiModalOpen(false);
      toast({
        title: 'প্রশ্নপত্র প্রস্তুত! 🎉',
        description: `সফলভাবে ${result.questions.length}টি প্রশ্ন বোর্ডে যুক্ত করা হয়েছে।`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'ব্যর্থ হয়েছে',
        description: err.message || 'প্রশ্ন তৈরি করা যায়নি। পুনরায় চেষ্টা করুন।',
      });
    } finally {
      setAiGenerating(false);
    }
  };

  // Load from DB or Session
  useEffect(() => {
    if (!editId && source !== 'merge') {
      const classIdParam = searchParams.get('classId');
      const subjectParam = searchParams.get('subject');
      const chapterParam = searchParams.get('chapter');
      const typeParam = searchParams.get('type');
      if (classIdParam || subjectParam || chapterParam) { 
        setMeta(prev => ({ ...prev, classId: classIdParam || prev.classId, subject: subjectParam || prev.subject, chapter: chapterParam || prev.chapter, examType: typeParam || 'creative' })); 
      }
      if (typeParam === 'creative' || typeParam === 'mcq' || typeParam === 'short') { 
        const initQ: Question[] = [{ id: Math.random().toString(36).substr(2, 9), type: typeParam === 'mcq' ? 'mcq' : (typeParam === 'creative' ? 'creative' : 'short'), content: '', imageUrl: '', section: '' }];
        setQuestions(initQ);
        syncQuestionsToContent(initQ);
      }
    }
  }, [searchParams, editId, source, syncQuestionsToContent]);

  useEffect(() => { 
    if (!userLoading && !user) router.push('/auth'); 
  }, [user, userLoading, router]);
  
  useEffect(() => {
    async function loadQuestions() {
      if (!db || !user) return;
      if (editId) {
        try {
          const docRef = doc(db, 'questions', editId);
          const docSnap = await getDoc(docRef);
          if (docSnap.exists()) {
            const data = docSnap.data();
            setMeta(prev => ({ ...prev, ...data }));
            if (data.content) {
              setDocumentContent(data.content);
            }
            const reconstructed = (data.questions || []).map((q: any) => {
              const id = Math.random().toString(36).substr(2, 9);
              const commonFields = { id, type: q.type, imageUrl: q.imageUrl || '', section: q.section || '' };
              if (q.type === 'mcq') return { ...commonFields, content: `${q.mcqQuestion || ''}\nক. ${q.optA || ''}\nখ. ${q.optB || ''}\nগ. ${q.optC || ''}\nঘ. ${q.optD || ''}`.trim() };
              if (q.type === 'creative') return { ...commonFields, content: `${q.stimulus || ''}\nক. ${q.qA || ''}\nখ. ${q.qB || ''}\nগ. ${q.qC || ''}\nঘ. ${q.qD || ''}`.trim() };
              return { ...commonFields, content: (q.shortText || '').trim() };
            });
            setQuestions(reconstructed);
            if (!data.content && reconstructed.length > 0) {
              syncQuestionsToContent(reconstructed);
            }
          }
        } catch (e) {} finally { setLoading(false); }
      } else if (source === 'merge') {
        const stored = sessionStorage.getItem('merged_questions_data');
        if (stored) {
          const mergedData = JSON.parse(stored);
          const reconstructed = mergedData.map((q: any) => {
            const id = Math.random().toString(36).substr(2, 9);
            const commonFields = { id, type: q.type, imageUrl: q.imageUrl || '', section: q.section || '' };
            if (q.type === 'mcq') return { ...commonFields, content: `${q.mcqQuestion || ''}\nক. ${q.optA || ''}\nখ. ${q.optB || ''}\nগ. ${q.optC || ''}\nঘ. ${q.optD || ''}`.trim() };
            if (q.type === 'creative') return { ...commonFields, content: `${q.stimulus || ''}\nক. ${q.qA || ''}\nখ. ${q.qB || ''}\nগ. ${q.qC || ''}\nঘ. ${q.qD || ''}`.trim() };
            return { ...commonFields, content: (q.shortText || '').trim() };
          });
          setQuestions(reconstructed);
          syncQuestionsToContent(reconstructed);
          sessionStorage.removeItem('merged_questions_data');
        }
        setLoading(false);
      }
    }
    if (user && db) loadQuestions();
  }, [editId, source, db, user, syncQuestionsToContent]);

  const subjects = useMemo(() => meta.classId ? getSubjectsForClass(meta.classId) : [], [meta.classId]);
  const chapters = useMemo(() => (meta.classId && meta.subject) ? getChaptersForSubject(meta.classId, meta.subject) : [], [meta.classId, meta.subject]);

  const handleAddQuestion = (type: 'creative' | 'short' | 'mcq') => {
    const newQ: Question = { id: Math.random().toString(36).substr(2, 9), type, content: '', imageUrl: '', section: meta.currentSection };
    if (activeSet === 'B') {
      const updated = [...questionsB, newQ];
      setQuestionsB(updated);
      syncQuestionsToContent(questions, updated);
    } else {
      const updated = [...questions, newQ];
      setQuestions(updated);
      syncQuestionsToContent(updated, questionsB);
    }
  };

  const handleSaveToDb = () => {
    if (!user || !db) return; 
    setSaving(true);
    const formattedQuestions = questions.map(q => {
      const parts = { main: '', k: '', kh: '', g: '', gh: '' };
      const markers = ['ক', 'খ', 'গ', 'ঘ'];
      const findMarkerPos = (m: string, fromIndex: number = 0) => { 
        const patterns = [ m + '.', m + ')', m + ' .', m + ' )', '(' + m + ')', '(' + m + ' )', '\n' + m + '.', '\n' + m + ')', '\n' + '(' + m + ')' ]; 
        let minIdx = -1; 
        for (const p of patterns) { 
          let idx = q.content.indexOf(p, fromIndex); 
          if (idx !== -1) { if (minIdx === -1 || idx < minIdx) minIdx = idx; } 
        } 
        return minIdx; 
      };
      let firstM = -1; 
      for (const m of markers) { 
        const pos = findMarkerPos(m); 
        if (pos !== -1 && (firstM === -1 || pos < firstM)) firstM = pos; 
      }
      if (firstM !== -1) { 
        parts.main = q.content.substring(0, firstM).trim(); 
        const extract = (m: string) => { 
          const startIdx = findMarkerPos(m); 
          if (startIdx === -1) return ''; 
          let markerEnd = startIdx; 
          while (markerEnd < q.content.length && ( q.content[markerEnd] === ' ' || q.content[markerEnd] === '\n' || q.content[markerEnd] === '(' || markers.includes(q.content[markerEnd]) || ['.', ')'].includes(q.content[markerEnd]) )) markerEnd++; 
          let end = q.content.length; 
          for (const otherM of markers) { 
            if (otherM === m) continue; 
            const e = findMarkerPos(otherM, markerEnd); 
            if (e !== -1 && e < end) end = e; 
          } 
          return q.content.substring(markerEnd, end).trim(); 
        }; 
        parts.k = extract('ক'); 
        parts.kh = extract('খ'); 
        parts.g = extract('গ'); 
        parts.gh = extract('ঘ'); 
      } else { 
        parts.main = q.content.trim(); 
      }
      const common = { type: q.type, imageUrl: q.imageUrl || '', section: q.section || '' };
      if (q.type === 'creative') return { ...common, stimulus: parts.main, qA: parts.k, qB: parts.kh, qC: parts.g, qD: parts.gh };
      if (q.type === 'mcq') return { ...common, mcqQuestion: parts.main, optA: parts.k, optB: parts.kh, optC: parts.g, optD: parts.gh };
      return { ...common, shortText: q.content };
    });

    const docId = editId || doc(collection(db, 'questions')).id;
    const data: any = { 
      ...meta, 
      content: documentContent,
      questions: formattedQuestions, 
      userId: user.uid, 
      updatedAt: serverTimestamp(), 
      isMcq: questions.some(q => q.type === 'mcq') 
    };
    if (!editId) data.createdAt = serverTimestamp();
    const ref = doc(db, 'questions', docId);
    setDoc(ref, data, { merge: true }).then(() => { 
      setSaving(false); 
      toast({ title: "সফল!", description: "প্রশ্নপত্র সফলভাবে সেভ হয়েছে।" }); 
      if (!editId) router.replace(`/create-question?id=${docId}`); 
    }).catch(async () => { 
      setSaving(false); 
      errorEmitter.emit('permission-error', new FirestorePermissionError({ path: ref.path, operation: 'write', requestResourceData: data })); 
    });
  };

  const isEnglish = meta.subject?.toLowerCase().includes('english') || meta.subject?.toLowerCase().includes('ইংরেজি');

  return (
    <div className="max-w-[1400px] mx-auto space-y-8 pb-16 font-kalpurush">
      <div className={cn("no-print space-y-8", isPrintMode && "hidden")}>
        {/* Header */}
        <header className="flex items-center justify-between border-b pb-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-indigo-600 text-white flex items-center justify-center shadow-sm">
              <FileText className="w-7 h-7" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-indigo-950">প্রশ্নপত্র নির্মাতা ও লাইভ এডিটর</h2>
              <p className="text-xs text-slate-500 font-bold mt-0.5">বোর্ড পরীক্ষার মানসম্পন্ন প্রশ্নপত্র তৈরি, এআই সহায়তা ও পূর্ণাঙ্গ ওয়ার্ড লেআউট</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="ghost" onClick={() => router.back()} className="gap-2 font-bold">
              <ArrowLeft className="w-4 h-4" /> ফিরে যান
            </Button>
            <Button 
              variant="default" 
              onClick={() => { 
                const p = new URLSearchParams(window.location.search); 
                p.set('print', 'true'); 
                if(editId) p.set('id', editId); 
                router.push(`${window.location.pathname}?${p.toString()}`); 
              }} 
              className="gap-2 font-bold bg-indigo-600 hover:bg-indigo-700 text-white shadow-md"
            >
              <Printer className="w-4 h-4" /> প্রিন্ট ও পেজ লেআউট
            </Button>
            {editId && (
              <Button variant="outline" onClick={() => router.push(`/online-exam?id=${editId}`)} className="gap-2 font-bold border-emerald-500 text-emerald-700 hover:bg-emerald-50">
                <GraduationCap className="w-4 h-4" /> অনলাইন পরীক্ষা
              </Button>
            )}
            <Button variant="outline" onClick={() => router.push(editId ? `/omr-sheet?id=${editId}` : `/omr-sheet?count=${questions.length || 25}`)} className="gap-2 font-bold border-purple-500 text-purple-700 hover:bg-purple-50">
              <CheckCircle2 className="w-4 h-4" /> OMR শিট
            </Button>
          </div>
        </header>

        {/* 2-Column Layout: Left Sidebar + Right Main Editor Area */}
        <div className="flex flex-col lg:flex-row gap-8 items-start">
          {/* Left Sidebar: Controls & AI Actions */}
          <aside className="w-full lg:w-80 shrink-0 space-y-6 sticky top-24">
            <Card className="shadow-md border-indigo-100 border-2">
              <CardHeader className="bg-indigo-50/60 border-b py-3">
                <CardTitle className="text-base flex items-center gap-2 font-bold text-indigo-900">
                  <FileText className="w-4 h-4 text-indigo-600" /> পরীক্ষার তথ্য ও এআই টুলস
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4 space-y-4">
                {/* 1. AI Quick Full Generator */}
                <Button
                  type="button"
                  onClick={() => setAiModalOpen(true)}
                  className="w-full bg-gradient-to-r from-purple-600 via-indigo-600 to-blue-600 hover:from-purple-700 hover:to-indigo-700 text-white font-black text-xs h-10 shadow-md"
                >
                  <BrainCircuit className="w-4 h-4 mr-2 text-amber-300 animate-pulse" /> AI দিয়ে প্রশ্নপত্র তৈরি করুন
                </Button>

                {/* 2. AI Multi-type Assistant */}
                <Button
                  type="button"
                  onClick={handleOpenAiAssistant}
                  className="w-full bg-gradient-to-r from-emerald-600 via-teal-600 to-indigo-700 hover:from-emerald-700 hover:to-indigo-800 text-white font-black text-xs h-10 shadow-md"
                >
                  <Sparkles className="w-4 h-4 mr-2 text-amber-300 animate-spin" /> AI সহকারী (মান ও ধরণ নিয়ন্ত্রণ)
                </Button>

                {/* 3. Ready-made Template Dialog */}
                <Button
                  type="button"
                  onClick={() => setTemplateModalOpen(true)}
                  variant="outline"
                  className="w-full font-bold text-xs h-9 border-indigo-200 text-indigo-800 hover:bg-indigo-50 gap-2"
                >
                  <LayoutTemplate className="w-4 h-4 text-indigo-600" /> রেডিমেড প্রশ্নপত্র টেমপ্লেট
                </Button>

                {/* 4. QR Code Insert Dialog */}
                <Button
                  type="button"
                  onClick={() => setQrModalOpen(true)}
                  variant="outline"
                  className="w-full font-bold text-xs h-9 border-slate-200 text-slate-700 hover:bg-slate-50 gap-2"
                >
                  <QrCode className="w-4 h-4 text-purple-600" /> প্রশ্নপত্রে QR কোড যুক্ত করুন
                </Button>

                <div className="pt-2 border-t space-y-3">
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">প্রতিষ্ঠানের নাম</label>
                    <Input 
                      value={meta.institution || ''} 
                      onChange={e => setMeta(prev => ({...prev, institution: e.target.value}))} 
                      className="h-8 text-xs font-bold" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">পরীক্ষার নাম</label>
                    <Select 
                      value={['সাপ্তাহিক পরীক্ষা', 'মাসিক পরীক্ষা', 'মডেল টেস্ট', '১ম সাময়িক পরীক্ষা', '২য় সাময়িক পরীক্ষা', 'অর্ধ-বার্ষিক পরীক্ষা', 'বার্ষিক পরীক্ষা', 'প্রাক-নির্বাচনি পরীক্ষা', 'নির্বাচনি (টেস্ট) পরীক্ষা', 'ক্লাস টেস্ট'].includes(meta.exam) ? meta.exam : 'custom'} 
                      onValueChange={v => {
                        if (v !== 'custom') setMeta(prev => ({...prev, exam: v}));
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs font-bold"><SelectValue placeholder="পরীক্ষা বেছে নিন" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="সাপ্তাহিক পরীক্ষা" className="text-xs font-bold">সাপ্তাহিক পরীক্ষা</SelectItem>
                        <SelectItem value="মাসিক পরীক্ষা" className="text-xs font-bold">মাসিক পরীক্ষা</SelectItem>
                        <SelectItem value="মডেল টেস্ট" className="text-xs font-bold">মডেল টেস্ট</SelectItem>
                        <SelectItem value="১ম সাময়িক পরীক্ষা" className="text-xs font-bold">১ম সাময়িক পরীক্ষা</SelectItem>
                        <SelectItem value="২য় সাময়িক পরীক্ষা" className="text-xs font-bold">২য় সাময়িক পরীক্ষা</SelectItem>
                        <SelectItem value="অর্ধ-বার্ষিক পরীক্ষা" className="text-xs font-bold">অর্ধ-বার্ষিক পরীক্ষা</SelectItem>
                        <SelectItem value="বার্ষিক পরীক্ষা" className="text-xs font-bold">বার্ষিক পরীক্ষা</SelectItem>
                        <SelectItem value="প্রাক-নির্বাচনি পরীক্ষা" className="text-xs font-bold">প্রাক-নির্বাচনি পরীক্ষা</SelectItem>
                        <SelectItem value="নির্বাচনি (টেস্ট) পরীক্ষা" className="text-xs font-bold">নির্বাচনি (টেস্ট) পরীক্ষা</SelectItem>
                        <SelectItem value="ক্লাস টেস্ট" className="text-xs font-bold">ক্লাস টেস্ট</SelectItem>
                        <SelectItem value="custom" className="text-xs font-bold">কাস্টম নাম লিখুন...</SelectItem>
                      </SelectContent>
                    </Select>
                    <Input 
                      value={meta.exam || ''} 
                      onChange={e => setMeta(prev => ({...prev, exam: e.target.value}))} 
                      placeholder="পরীক্ষার নাম..." 
                      className="h-8 text-xs font-bold mt-1" 
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">শ্রেণি</label>
                    <Select onValueChange={v => setMeta(prev => ({...prev, classId: v}))} value={meta.classId}>
                      <SelectTrigger className="h-8 text-xs font-bold"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                      <SelectContent>{CLASSES.map(c => <SelectItem key={c.id} value={c.id} className="text-xs font-bold">{c.label} শ্রেণি</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-bold text-slate-700">বিষয়</label>
                    <Select onValueChange={v => setMeta(prev => ({...prev, subject: v}))} value={meta.subject} disabled={!meta.classId}>
                      <SelectTrigger className="h-8 text-xs font-bold"><SelectValue placeholder="বিষয়" /></SelectTrigger>
                      <SelectContent>{subjects.map(s => <SelectItem key={s} value={s} className="text-xs font-bold">{s}</SelectItem>)}</SelectContent>
                    </Select>
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center justify-between">
                      <label className="text-xs font-bold text-slate-700">অধ্যায় নির্বাচন (একাধিক যুক্ত করুন)</label>
                      {chapters.length > 0 && (
                        <button
                          type="button"
                          onClick={() => {
                            if (selectedChapters.length === chapters.length) {
                              setSelectedChapters([]);
                              setMeta(prev => ({ ...prev, chapter: '' }));
                            } else {
                              setSelectedChapters([...chapters]);
                              setMeta(prev => ({ ...prev, chapter: chapters.join(', ') }));
                            }
                          }}
                          className="text-[10px] text-indigo-600 hover:underline font-bold"
                        >
                          {selectedChapters.length === chapters.length ? 'মুছুন' : 'সব অধ্যায়'}
                        </button>
                      )}
                    </div>
                    {chapters.length > 0 ? (
                      <div className="border border-slate-200 rounded-lg p-2 max-h-36 overflow-y-auto space-y-1 bg-slate-50/60">
                        {chapters.map(ch => {
                          const isChecked = selectedChapters.includes(ch) || (meta.chapter && meta.chapter.includes(ch));
                          return (
                            <label key={ch} className="flex items-center gap-2 text-xs font-bold cursor-pointer hover:bg-white p-1 rounded transition-colors select-none">
                              <Checkbox
                                checked={Boolean(isChecked)}
                                onCheckedChange={(c) => {
                                  let updated = isChecked 
                                    ? selectedChapters.filter(item => item !== ch)
                                    : [...selectedChapters, ch];
                                  setSelectedChapters(updated);
                                  setMeta(prev => ({ ...prev, chapter: updated.join(', ') }));
                                }}
                              />
                              <span className="leading-tight text-slate-800">{ch}</span>
                            </label>
                          );
                        })}
                      </div>
                    ) : null}
                    <Input 
                      value={meta.chapter || ''} 
                      onChange={e => {
                        setMeta(prev => ({ ...prev, chapter: e.target.value }));
                        setSelectedChapters(e.target.value.split(',').map(s => s.trim()).filter(Boolean));
                      }} 
                      placeholder="যেমন: ১ম অধ্যায়, ২য় অধ্যায়..." 
                      className="h-8 text-xs font-bold mt-1" 
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">সময়</label>
                      <Select 
                        value={['২০ মিনিট', '২৫ মিনিট', '৩০ মিনিট', '৪০ মিনিট', '৪৫ মিনিট', '৫০ মিনিট', '১ ঘণ্টা', '১ ঘণ্টা ১৫ মিনিট', '১ ঘণ্টা ২০ মিনিট', '১ ঘণ্টা ৩০ মিনিট', '১ ঘণ্টা ৪৫ মিনিট', '২ ঘণ্টা', '২ ঘণ্টা ১৫ মিনিট', '২ ঘণ্টা ৩০ মিনিট', '৩ ঘণ্টা'].includes(meta.time) ? meta.time : 'custom'} 
                        onValueChange={v => {
                          if (v !== 'custom') setMeta(prev => ({...prev, time: v}));
                        }}
                      >
                        <SelectTrigger className="h-8 text-xs font-bold"><SelectValue placeholder="সময়" /></SelectTrigger>
                        <SelectContent>
                          <SelectItem value="২০ মিনিট" className="text-xs font-bold">২০ মিনিট</SelectItem>
                          <SelectItem value="২৫ মিনিট" className="text-xs font-bold">২৫ মিনিট</SelectItem>
                          <SelectItem value="৩০ মিনিট" className="text-xs font-bold">৩০ মিনিট</SelectItem>
                          <SelectItem value="৪০ মিনিট" className="text-xs font-bold">৪০ মিনিট</SelectItem>
                          <SelectItem value="৪৫ মিনিট" className="text-xs font-bold">৪৫ মিনিট</SelectItem>
                          <SelectItem value="৫০ মিনিট" className="text-xs font-bold">৫০ মিনিট</SelectItem>
                          <SelectItem value="১ ঘণ্টা" className="text-xs font-bold">১ ঘণ্টা</SelectItem>
                          <SelectItem value="১ ঘণ্টা ১৫ মিনিট" className="text-xs font-bold">১ ঘণ্টা ১৫ মিনিট</SelectItem>
                          <SelectItem value="১ ঘণ্টা ২০ মিনিট" className="text-xs font-bold">১ ঘণ্টা ২০ মিনিট</SelectItem>
                          <SelectItem value="১ ঘণ্টা ৩০ মিনিট" className="text-xs font-bold">১ ঘণ্টা ৩০ মিনিট</SelectItem>
                          <SelectItem value="২ ঘণ্টা" className="text-xs font-bold">২ ঘণ্টা</SelectItem>
                          <SelectItem value="২ ঘণ্টা ১৫ মিনিট" className="text-xs font-bold">২ ঘণ্টা ১৫ মিনিট</SelectItem>
                          <SelectItem value="২ ঘণ্টা ৩০ মিনিট" className="text-xs font-bold">২ ঘণ্টা ৩০ মিনিট</SelectItem>
                          <SelectItem value="৩ ঘণ্টা" className="text-xs font-bold">৩ ঘণ্টা</SelectItem>
                          <SelectItem value="custom" className="text-xs font-bold">কাস্টম...</SelectItem>
                        </SelectContent>
                      </Select>
                      <Input 
                        value={meta.time || ''} 
                        onChange={e => setMeta(prev => ({...prev, time: e.target.value}))} 
                        placeholder="যেমন: ২ ঘণ্টা ৩০ মিনিট" 
                        className="h-8 text-xs font-bold mt-1" 
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-xs font-bold text-slate-700">পূর্ণমান</label>
                      <Input value={meta.totalMarks || ''} onChange={e => setMeta(prev => ({...prev, totalMarks: e.target.value}))} className="h-8 text-xs font-bold" />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>
          </aside>

          {/* Right Main Editor Area */}
          <div className="flex-1 min-w-0 space-y-6">
            <Tabs value={activeMainTab} onValueChange={(v: any) => setActiveMainTab(v)} className="w-full">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
                <TabsList className="bg-slate-100 p-1 h-10 border border-slate-200">
                  <TabsTrigger value="editor" className="font-bold text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-indigo-700">
                    <Eye className="w-3.5 h-3.5" /> লাইভ প্রশ্নপত্র এডিটর
                  </TabsTrigger>
                  <TabsTrigger value="cards" className="font-bold text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-indigo-700">
                    <ListChecks className="w-3.5 h-3.5" /> কার্ডভিত্তিক প্রশ্ন তালিকা ({toBengaliNumber(activeSet === 'A' ? questions.length : questionsB.length)})
                  </TabsTrigger>
                  <TabsTrigger value="raw_code" className="font-bold text-xs gap-1.5 data-[state=active]:bg-white data-[state=active]:text-indigo-700">
                    <Code2 className="w-3.5 h-3.5" /> এইচটিএমএল কোড
                  </TabsTrigger>
                </TabsList>

                {/* Quick Editor Action Toolbar */}
                <div className="flex flex-wrap items-center gap-2">
                  <Button
                    type="button"
                    onClick={() => setTemplateModalOpen(true)}
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 font-bold border-indigo-200 text-indigo-800 hover:bg-indigo-50 text-xs"
                    title="রেডিমেড প্রশ্নপত্র টেমপ্লেট বেছে নিন"
                  >
                    <LayoutTemplate className="w-3.5 h-3.5 text-indigo-600" /> টেমপ্লেট
                  </Button>
                  <Button
                    type="button"
                    onClick={() => setQrModalOpen(true)}
                    size="sm"
                    variant="outline"
                    className="h-8 gap-1.5 font-bold border-purple-200 text-purple-800 hover:bg-purple-50 text-xs"
                    title="প্রশ্নপত্রে QR কোড যুক্ত করুন"
                  >
                    <QrCode className="w-3.5 h-3.5 text-purple-600" /> QR কোড
                  </Button>
                  <Button
                    type="button"
                    onClick={handleOpenAiAssistant}
                    size="sm"
                    className="h-8 gap-1.5 font-bold bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700 text-white shadow-xs text-xs"
                    title="মান ও টপিক অনুযায়ী AI দিয়ে প্রশ্ন তৈরি করুন"
                  >
                    <Sparkles className="w-3.5 h-3.5 text-amber-300 animate-spin" /> AI সহকারী
                  </Button>
                  <input type="file" ref={ocrInputRef} className="hidden" accept="image/*,application/pdf" onChange={handleOCR} />
                  <Button 
                    onClick={() => ocrInputRef.current?.click()} 
                    disabled={isScanning} 
                    variant="outline" 
                    size="sm" 
                    className="h-8 gap-1.5 border-emerald-500 text-emerald-700 hover:bg-emerald-50 font-bold text-xs"
                  >
                    {isScanning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ScanText className="w-3.5 h-3.5" />} এআই স্ক্যান
                  </Button>
                </div>
              </div>

              {/* Tab 1: Live Visual Paper Editor */}
              <TabsContent value="editor" className="mt-0 space-y-4">
                <Card className="shadow-lg border-2 border-slate-200 bg-slate-100/50">
                  <CardHeader className="py-2.5 px-4 bg-white border-b flex flex-row items-center justify-between">
                    <span className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                      📄 লাইভ প্রিন্ট-স্টাইল লেআউট (এখানে সরাসরি ক্লিক করে সম্পাদনা বা টেবিল বসানো যাবে)
                    </span>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={() => {
                        const p = new URLSearchParams(window.location.search);
                        p.set('print', 'true');
                        if (editId) p.set('id', editId);
                        router.push(`${window.location.pathname}?${p.toString()}`);
                      }}
                      className="text-xs font-bold text-indigo-700 hover:bg-indigo-50 h-7"
                    >
                      পূর্ণাঙ্গ ওয়ার্ড ভিউতে খুলুন ↗
                    </Button>
                  </CardHeader>
                  <CardContent className="p-4 sm:p-8 flex justify-center">
                    {/* Visual A4 Paper Preview */}
                    <div className="w-full max-w-[8.27in] bg-white rounded-xl shadow-2xl border-2 border-slate-300 p-8 sm:p-12 font-kalpurush min-h-[11in] text-slate-900 leading-relaxed text-sm">
                      {/* Institutional Header */}
                      <div className="text-center border-b-2 border-black pb-3 mb-6 select-none">
                        <h1 className="font-black text-2xl text-black leading-tight uppercase tracking-wide">
                          {meta.institution || appName}
                        </h1>
                        <h2 className="text-base font-bold text-black mt-1 underline">
                          {meta.exam || 'পরীক্ষা'}
                        </h2>
                        <div className="flex justify-between items-center text-xs font-bold mt-4 px-2">
                          <span>শ্রেণি: {CLASSES.find(c => c.id === meta.classId)?.label || ''}</span>
                          {questionsB.length > 0 && <span className="text-xs font-black border border-black px-2 py-0.5">সেট: ক (A)</span>}
                          <span>বিষয়: {meta.subject} {meta.chapter && `(${meta.chapter})`}</span>
                        </div>
                        <div className="flex justify-between items-center text-[11px] font-bold mt-1.5 px-2 italic border-t pt-1 border-dashed border-slate-300">
                          <span>সময়: {meta.time}</span>
                          <span>পূর্ণমান: {toBengaliNumber(meta.totalMarks)}</span>
                        </div>
                      </div>

                      {/* ContentEditable Live Area */}
                      <div
                        ref={contentEditableRef}
                        contentEditable
                        suppressContentEditableWarning
                        onBlur={(e) => {
                          const newHtml = e.currentTarget.innerHTML;
                          setDocumentContent(newHtml);
                          setMeta(prev => ({ ...prev, content: newHtml }));
                        }}
                        className="outline-none focus:ring-2 focus:ring-indigo-300 rounded-lg p-3 min-h-[600px] space-y-3 prose max-w-none text-slate-900 leading-relaxed"
                        dangerouslySetInnerHTML={{
                          __html: formatMath(stripDirtyHtml(documentContent || '')) || '<p class="text-slate-400 italic">এখানে আপনার প্রশ্নপত্রের কন্টেন্ট সরাসরি লিখুন বা এআই দিয়ে স্বয়ংক্রিয়ভাবে তৈরি করুন...</p>'
                        }}
                      />
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 2: Item-by-item Cards View */}
              <TabsContent value="cards" className="mt-0 space-y-4">
                <Card className="shadow-md border-slate-200">
                  <CardHeader className="py-3 px-6 bg-slate-50 border-b flex flex-row items-center justify-between">
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-bold text-slate-800">সেট নির্বাচন:</span>
                      <div className="flex items-center gap-1 bg-white border border-slate-300 rounded-lg p-0.5">
                        <button
                          type="button"
                          onClick={() => setActiveSet('A')}
                          className={cn("px-3 py-1 text-xs font-black rounded-md transition-all", activeSet === 'A' ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-slate-100")}
                        >সেট A</button>
                        <button
                          type="button"
                          onClick={() => setActiveSet('B')}
                          className={cn("px-3 py-1 text-xs font-black rounded-md transition-all", activeSet === 'B' ? "bg-indigo-600 text-white shadow" : "text-slate-600 hover:bg-slate-100")}
                        >সেট B</button>
                      </div>
                    </div>

                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        onClick={handleGenerateRandomPaper}
                        disabled={randomGenerating}
                        size="sm"
                        className="bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs h-8 gap-1.5"
                      >
                        {randomGenerating ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Shuffle className="w-3.5 h-3.5" />} র‍্যান্ডম প্রশ্ন তৈরি
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleAddQuestion('creative')} className="h-8 border-indigo-500 text-indigo-700 font-bold text-xs">
                        <Plus className="w-3 h-3 mr-1" /> সৃজনশীল
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleAddQuestion('short')} className="h-8 border-emerald-500 text-emerald-700 font-bold text-xs">
                        <Plus className="w-3 h-3 mr-1" /> সংক্ষিপ্ত
                      </Button>
                      <Button variant="outline" size="sm" onClick={() => handleAddQuestion('mcq')} className="h-8 border-orange-500 text-orange-600 font-bold text-xs">
                        <Plus className="w-3 h-3 mr-1" /> বহুনির্বাচনি
                      </Button>
                    </div>
                  </CardHeader>

                  <CardContent className="p-6 space-y-4">
                    {(activeSet === 'A' ? questions : questionsB).length === 0 ? (
                      <div className="text-center py-16 text-slate-400">
                        <FileText className="w-12 h-12 mx-auto mb-2 opacity-40" />
                        <p className="font-bold text-base">কোনো প্রশ্ন কার্ড যোগ করা হয়নি।</p>
                        <p className="text-xs text-slate-500 mt-1">বাম পাশের AI বাটন বা ওপরের বাটন ব্যবহার করে প্রশ্ন যোগ করুন।</p>
                      </div>
                    ) : (
                      (activeSet === 'A' ? questions : questionsB).map((q, idx) => (
                        <Card key={q.id} className={cn("relative border-l-4 shadow-xs transition-all", q.type === 'mcq' ? 'border-l-orange-500' : q.type === 'short' ? 'border-l-emerald-500' : 'border-l-indigo-600')}>
                          <div className="absolute top-2 right-2 no-print flex gap-1">
                            <Button 
                              variant="ghost" 
                              size="icon" 
                              className="text-destructive h-8 w-8 hover:bg-red-50" 
                              onClick={() => {
                                if (activeSet === 'A') {
                                  const updated = questions.filter(item => item.id !== q.id);
                                  setQuestions(updated);
                                  syncQuestionsToContent(updated, questionsB);
                                } else {
                                  const updated = questionsB.filter(item => item.id !== q.id);
                                  setQuestionsB(updated);
                                  syncQuestionsToContent(questions, updated);
                                }
                              }}
                            >
                              <Trash2 className="w-4 h-4" />
                            </Button>
                          </div>
                          <CardContent className="pt-4 space-y-3">
                            <div className="flex items-center gap-2">
                              <span className={cn("px-2 py-0.5 text-[10px] font-bold rounded", q.type === 'mcq' ? 'bg-orange-100 text-orange-700' : q.type === 'short' ? 'bg-emerald-100 text-emerald-700' : 'bg-indigo-100 text-indigo-700')}>
                                {q.type === 'mcq' ? 'বহুনির্বাচনি' : q.type === 'short' ? 'সংক্ষিপ্ত' : 'সৃজনশীল'}
                              </span>
                              <span className="text-xs font-black text-slate-700">
                                প্রশ্ন নং: {isEnglish ? (idx + 1) : toBengaliNumber(idx + 1)}
                              </span>
                            </div>
                            <Textarea 
                              placeholder="উদ্দীপক ও প্রশ্ন ক. খ. গ. ঘ. সহ লিখুন..." 
                              value={q.content} 
                              onChange={e => {
                                const newContent = e.target.value;
                                if (activeSet === 'A') {
                                  const updated = questions.map(item => item.id === q.id ? { ...item, content: newContent } : item);
                                  setQuestions(updated);
                                  syncQuestionsToContent(updated, questionsB);
                                } else {
                                  const updated = questionsB.map(item => item.id === q.id ? { ...item, content: newContent } : item);
                                  setQuestionsB(updated);
                                  syncQuestionsToContent(questions, updated);
                                }
                              }} 
                              className="min-h-[100px] text-xs font-bold leading-relaxed" 
                            />
                          </CardContent>
                        </Card>
                      ))
                    )}
                  </CardContent>
                </Card>
              </TabsContent>

              {/* Tab 3: Raw HTML Code */}
              <TabsContent value="raw_code" className="mt-0">
                <Card className="shadow-md bg-slate-900 border-slate-800">
                  <CardHeader className="py-2.5 px-4 border-b border-slate-800">
                    <span className="text-xs font-mono text-emerald-400 font-bold">HTML / Source Code View</span>
                  </CardHeader>
                  <CardContent className="p-4">
                    <Textarea
                      value={documentContent}
                      onChange={e => {
                        setDocumentContent(e.target.value);
                        setMeta(prev => ({ ...prev, content: e.target.value }));
                      }}
                      className="min-h-[550px] font-mono text-xs leading-relaxed text-emerald-300 bg-transparent border-none focus-visible:ring-0 p-0 resize-y"
                    />
                  </CardContent>
                </Card>
              </TabsContent>
            </Tabs>

            {/* Bottom Actions */}
            <div className="flex items-center gap-4 pt-4 border-t">
              <Button onClick={handleSaveToDb} disabled={saving} className="gap-2 px-8 font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-md">
                {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />} সেভ করুন
              </Button>
              <Button 
                onClick={() => { 
                  const p = new URLSearchParams(window.location.search); 
                  p.set('print', 'true'); 
                  if(editId) p.set('id', editId); 
                  router.push(`${window.location.pathname}?${p.toString()}`); 
                }} 
                variant="secondary" 
                className="gap-2 px-10 shadow-lg font-black bg-indigo-50 border-2 border-indigo-300 text-indigo-900 hover:bg-indigo-100"
              >
                <Printer className="w-4 h-4 text-indigo-600" /> প্রিন্ট ও পেজ লেআউট
              </Button>
            </div>
          </div>
        </div>

        {/* ── Dialog 1: AI Full Paper Generator Modal ── */}
        <Dialog open={aiModalOpen} onOpenChange={setAiModalOpen}>
          <DialogContent className="font-kalpurush max-w-md bg-white border-2 border-indigo-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2 text-indigo-900">
                <BrainCircuit className="h-5 w-5 text-indigo-600" /> AI প্রশ্নপত্র জেনারেটর
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 py-2">
              <p className="text-xs text-slate-600 font-bold">
                বোর্ড পরীক্ষার সিলেবাস অনুযায়ী স্বয়ংক্রিয়ভাবে মানসম্পন্ন প্রশ্ন তৈরি হবে।
              </p>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">প্রশ্নের ধরণ</label>
                <Select value={aiType} onValueChange={(v: any) => setAiType(v)}>
                  <SelectTrigger className="h-9 font-bold text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creative">সৃজনশীল প্রশ্ন (উদ্দীপক + ক, খ, গ, ঘ)</SelectItem>
                    <SelectItem value="mcq">বহুনির্বাচনি (MCQ + ৪টি অপশন)</SelectItem>
                    <SelectItem value="short">সংক্ষিপ্ত ও জ্ঞানমূলক প্রশ্ন</SelectItem>
                    <SelectItem value="mixed">মিশ্রিত প্রশ্ন (সৃজনশীল ও MCQ)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">প্রশ্নের সংখ্যা</label>
                <Select value={String(aiCount)} onValueChange={(v) => setAiCount(Number(v))}>
                  <SelectTrigger className="h-9 font-bold text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="1">১টি প্রশ্ন</SelectItem>
                    <SelectItem value="2">২টি প্রশ্ন</SelectItem>
                    <SelectItem value="3">৩টি প্রশ্ন (স্ট্যান্ডার্ড)</SelectItem>
                    <SelectItem value="5">৫টি প্রশ্ন</SelectItem>
                    <SelectItem value="10">১০টি প্রশ্ন</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <label className="text-xs font-bold text-slate-700">নির্দিষ্ট টপিক বা বিষয়বস্তু (ঐচ্ছিক)</label>
                <Input
                  placeholder="যেমন: বল ও গতির সমীকরণ, সালোকসংশ্লেষণ..."
                  value={aiTopic}
                  onChange={(e) => setAiTopic(e.target.value)}
                  className="h-9 text-xs font-bold"
                />
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setAiModalOpen(false)}>বাতিল</Button>
              <Button
                onClick={handleGenerateAiQuestions}
                disabled={aiGenerating}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs"
              >
                {aiGenerating ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 mr-1.5 animate-spin" /> তৈরি হচ্ছে...
                  </>
                ) : (
                  'প্রশ্ন তৈরি করুন'
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog 2: AI Multi-type & Difficulty Assistant Modal ── */}
        <Dialog open={aiAssistantOpen} onOpenChange={setAiAssistantOpen}>
          <DialogContent className="font-kalpurush max-w-2xl max-h-[92vh] overflow-y-auto bg-white border-2 border-purple-200 p-5 sm:p-6 custom-scrollbar">
            <DialogHeader className="border-b pb-3">
              <DialogTitle className="text-lg font-black flex items-center gap-2 text-purple-950">
                <Sparkles className="h-5 w-5 text-amber-500 animate-spin" /> AI সহকারী — উন্নত প্রশ্নমালা ও মান নিয়ন্ত্রণ
              </DialogTitle>
              <p className="text-xs text-slate-600 font-bold mt-1">
                নির্দিষ্ট অধ্যায়, টপিক, কাঠিন্য মান (সহজ/মধ্যম/কঠিন) এবং প্রশ্নের ধরণ অনুযায়ী মানসম্পন্ন প্রশ্ন তৈরি করুন।
              </p>
            </DialogHeader>

            <div className="space-y-4 py-3">
              {/* Class & Subject */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">শ্রেণি</label>
                  <Select
                    value={aiAssistantClassId}
                    onValueChange={(val) => {
                      setAiAssistantClassId(val);
                      const availableSubs = getSubjectsForClass(val);
                      if (availableSubs.length > 0) {
                        setAiAssistantSubject(availableSubs[0]);
                        const chaps = getChaptersForSubject(val, availableSubs[0]);
                        if (chaps.length > 0) setAiAssistantChapter(chaps[0]);
                      }
                    }}
                  >
                    <SelectTrigger className="h-9 font-bold text-xs bg-slate-50 border-purple-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {CLASSES.map((c) => (
                        <SelectItem key={c.id} value={c.id} className="font-bold text-xs">{c.label} শ্রেণি</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">বিষয়</label>
                  <Select
                    value={aiAssistantSubject}
                    onValueChange={(val) => {
                      setAiAssistantSubject(val);
                      const chaps = getChaptersForSubject(aiAssistantClassId, val);
                      if (chaps.length > 0) setAiAssistantChapter(chaps[0]);
                    }}
                  >
                    <SelectTrigger className="h-9 font-bold text-xs bg-slate-50 border-purple-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {getSubjectsForClass(aiAssistantClassId).map((s) => (
                        <SelectItem key={s} value={s} className="font-bold text-xs">{s}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Chapter & Difficulty */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-black text-slate-700">📖 অধ্যায় নির্বাচন (একসাথে একাধিক সম্ভব)</label>
                    {getChaptersForSubject(aiAssistantClassId, aiAssistantSubject).length > 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const allCh = getChaptersForSubject(aiAssistantClassId, aiAssistantSubject);
                          if (aiAssistantChapters.length === allCh.length) {
                            setAiAssistantChapters([]);
                            setAiAssistantChapter('');
                          } else {
                            setAiAssistantChapters([...allCh]);
                            setAiAssistantChapter(allCh.join(', '));
                          }
                        }}
                        className="text-[10px] text-purple-700 hover:underline font-bold"
                      >
                        {aiAssistantChapters.length === getChaptersForSubject(aiAssistantClassId, aiAssistantSubject).length ? 'মুছুন' : 'সব অধ্যায়'}
                      </button>
                    )}
                  </div>
                  {getChaptersForSubject(aiAssistantClassId, aiAssistantSubject).length > 0 ? (
                    <div className="border border-purple-200 rounded-lg p-2 max-h-36 overflow-y-auto space-y-1 bg-slate-50">
                      {getChaptersForSubject(aiAssistantClassId, aiAssistantSubject).map(ch => {
                        const isChecked = aiAssistantChapters.includes(ch) || (aiAssistantChapter && aiAssistantChapter.includes(ch));
                        return (
                          <label key={ch} className="flex items-center gap-2 text-xs font-bold cursor-pointer hover:bg-purple-50 p-1 rounded transition-colors select-none">
                            <Checkbox
                              checked={Boolean(isChecked)}
                              onCheckedChange={(c) => {
                                let updated = isChecked
                                  ? aiAssistantChapters.filter(item => item !== ch)
                                  : [...aiAssistantChapters, ch];
                                setAiAssistantChapters(updated);
                                setAiAssistantChapter(updated.join(', '));
                              }}
                            />
                            <span className="leading-tight text-slate-800">{ch}</span>
                          </label>
                        );
                      })}
                    </div>
                  ) : null}
                  <Input
                    placeholder="অধ্যায়ের নাম বা নম্বর লিখুন..."
                    value={aiAssistantChapter}
                    onChange={e => {
                      setAiAssistantChapter(e.target.value);
                      setAiAssistantChapters(e.target.value.split(',').map(s => s.trim()).filter(Boolean));
                    }}
                    className="h-8 font-bold text-xs bg-slate-50 border-purple-200 mt-1"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-xs font-black text-slate-700">🎯 প্রশ্নের কাঠিন্য মান (Difficulty)</label>
                  <Select
                    value={aiAssistantDifficulty}
                    onValueChange={(val: any) => setAiAssistantDifficulty(val)}
                  >
                    <SelectTrigger className="h-9 font-bold text-xs bg-slate-50 border-purple-200"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="easy" className="font-bold text-xs">🟢 সহজ মান (Easy - মূল বই ও সংজ্ঞা)</SelectItem>
                      <SelectItem value="medium" className="font-bold text-xs">🟡 মধ্যম মান (Medium - বোর্ড পরীক্ষার আদর্শ মান)</SelectItem>
                      <SelectItem value="hard" className="font-bold text-xs">🔴 কঠিন মান (Hard - উচ্চতর চিন্তন ও বিশ্লেষণ)</SelectItem>
                      <SelectItem value="mixed" className="font-bold text-xs">🟣 মিশ্র মান (Mixed - সহজ, মধ্যম ও কঠিন)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              {/* Question Types & Individual Counters */}
              <div className="p-4 rounded-xl border-2 border-purple-100 bg-purple-50/30 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-black text-purple-900 flex items-center gap-1.5">
                    <ListChecks className="w-4 h-4 text-purple-600" /> প্রশ্নের ধরণ নির্বাচন ও কোনটি কয়টি তৈরি হবে:
                  </span>
                  <Badge className="bg-purple-600 text-white font-black text-xs px-2.5 py-0.5">
                    মোট প্রশ্ন: {toBengaliNumber(totalAiQuestionsCount)}টি
                  </Badge>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                  {/* সৃজনশীল */}
                  <div className={cn("flex items-center justify-between p-2.5 rounded-lg border transition-all", aiQuestionTypes.creative ? "bg-white border-purple-300 shadow-xs" : "bg-slate-50/60 border-slate-200 opacity-60")}>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={aiQuestionTypes.creative}
                        onCheckedChange={(c) => setAiQuestionTypes(prev => ({ ...prev, creative: !!c }))}
                      />
                      <span className="text-xs font-black text-slate-800">📝 সৃজনশীল প্রশ্ন (CQ)</span>
                    </label>
                    {aiQuestionTypes.creative && (
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setAiQuestionTypes(prev => ({ ...prev, creativeCount: Math.max(1, prev.creativeCount - 1) }))}><Minus className="w-3 h-3 text-purple-700" /></Button>
                        <Input type="number" min={1} max={20} value={aiQuestionTypes.creativeCount} onChange={(e) => setAiQuestionTypes(prev => ({ ...prev, creativeCount: parseInt(e.target.value) || 1 }))} className="h-6 w-10 text-center font-bold text-xs p-0 border-purple-200" />
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setAiQuestionTypes(prev => ({ ...prev, creativeCount: Math.min(20, prev.creativeCount + 1) }))}><Plus className="w-3 h-3 text-purple-700" /></Button>
                        <span className="text-[11px] font-bold text-slate-500 ml-1">টি</span>
                      </div>
                    )}
                  </div>

                  {/* সংক্ষিপ্ত */}
                  <div className={cn("flex items-center justify-between p-2.5 rounded-lg border transition-all", aiQuestionTypes.short ? "bg-white border-purple-300 shadow-xs" : "bg-slate-50/60 border-slate-200 opacity-60")}>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={aiQuestionTypes.short}
                        onCheckedChange={(c) => setAiQuestionTypes(prev => ({ ...prev, short: !!c }))}
                      />
                      <span className="text-xs font-black text-slate-800">✍️ সংক্ষিপ্ত প্রশ্নাবলী</span>
                    </label>
                    {aiQuestionTypes.short && (
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setAiQuestionTypes(prev => ({ ...prev, shortCount: Math.max(1, prev.shortCount - 1) }))}><Minus className="w-3 h-3 text-purple-700" /></Button>
                        <Input type="number" min={1} max={50} value={aiQuestionTypes.shortCount} onChange={(e) => setAiQuestionTypes(prev => ({ ...prev, shortCount: parseInt(e.target.value) || 1 }))} className="h-6 w-10 text-center font-bold text-xs p-0 border-purple-200" />
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setAiQuestionTypes(prev => ({ ...prev, shortCount: Math.min(50, prev.shortCount + 1) }))}><Plus className="w-3 h-3 text-purple-700" /></Button>
                        <span className="text-[11px] font-bold text-slate-500 ml-1">টি</span>
                      </div>
                    )}
                  </div>

                  {/* বহুনির্বাচনী */}
                  <div className={cn("flex items-center justify-between p-2.5 rounded-lg border transition-all", aiQuestionTypes.mcq ? "bg-white border-purple-300 shadow-xs" : "bg-slate-50/60 border-slate-200 opacity-60")}>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={aiQuestionTypes.mcq}
                        onCheckedChange={(c) => setAiQuestionTypes(prev => ({ ...prev, mcq: !!c }))}
                      />
                      <span className="text-xs font-black text-slate-800">🔘 বহুনির্বাচনী (MCQ)</span>
                    </label>
                    {aiQuestionTypes.mcq && (
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setAiQuestionTypes(prev => ({ ...prev, mcqCount: Math.max(1, prev.mcqCount - 1) }))}><Minus className="w-3 h-3 text-purple-700" /></Button>
                        <Input type="number" min={1} max={50} value={aiQuestionTypes.mcqCount} onChange={(e) => setAiQuestionTypes(prev => ({ ...prev, mcqCount: parseInt(e.target.value) || 1 }))} className="h-6 w-10 text-center font-bold text-xs p-0 border-purple-200" />
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setAiQuestionTypes(prev => ({ ...prev, mcqCount: Math.min(50, prev.mcqCount + 1) }))}><Plus className="w-3 h-3 text-purple-700" /></Button>
                        <span className="text-[11px] font-bold text-slate-500 ml-1">টি</span>
                      </div>
                    )}
                  </div>

                  {/* জ্ঞানমূলক */}
                  <div className={cn("flex items-center justify-between p-2.5 rounded-lg border transition-all", aiQuestionTypes.knowledge ? "bg-white border-purple-300 shadow-xs" : "bg-slate-50/60 border-slate-200 opacity-60")}>
                    <label className="flex items-center gap-2 cursor-pointer select-none">
                      <Checkbox
                        checked={aiQuestionTypes.knowledge}
                        onCheckedChange={(c) => setAiQuestionTypes(prev => ({ ...prev, knowledge: !!c }))}
                      />
                      <span className="text-xs font-black text-slate-800">💡 জ্ঞানমূলক প্রশ্নোত্তর</span>
                    </label>
                    {aiQuestionTypes.knowledge && (
                      <div className="flex items-center gap-1">
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setAiQuestionTypes(prev => ({ ...prev, knowledgeCount: Math.max(1, prev.knowledgeCount - 1) }))}><Minus className="w-3 h-3 text-purple-700" /></Button>
                        <Input type="number" min={1} max={50} value={aiQuestionTypes.knowledgeCount} onChange={(e) => setAiQuestionTypes(prev => ({ ...prev, knowledgeCount: parseInt(e.target.value) || 1 }))} className="h-6 w-10 text-center font-bold text-xs p-0 border-purple-200" />
                        <Button type="button" variant="outline" size="icon" className="h-6 w-6" onClick={() => setAiQuestionTypes(prev => ({ ...prev, knowledgeCount: Math.min(50, prev.knowledgeCount + 1) }))}><Plus className="w-3 h-3 text-purple-700" /></Button>
                        <span className="text-[11px] font-bold text-slate-500 ml-1">টি</span>
                      </div>
                    )}
                  </div>
                </div>
              </div>

              {/* Custom Topic Input */}
              <div className="space-y-1">
                <label className="text-xs font-black text-slate-700">📌 নির্দিষ্ট টপিক বা ফোকাস এরিয়া (ঐচ্ছিক)</label>
                <Input
                  placeholder="যেমন: সমত্বরণ ও গতির সমীকরণসমূহ, নিউটনের ৩য় সূত্র..."
                  value={aiAssistantPrompt}
                  onChange={(e) => setAiAssistantPrompt(e.target.value)}
                  className="h-9 font-bold text-xs bg-slate-50 border-purple-200"
                />
              </div>
            </div>

            <DialogFooter className="gap-2 sm:gap-0 border-t pt-3">
              <Button variant="outline" size="sm" onClick={() => setAiAssistantOpen(false)}>বাতিল</Button>
              <Button
                onClick={handleAiAssistantSubmit}
                disabled={isAiExpanding || totalAiQuestionsCount === 0}
                className="font-black bg-gradient-to-r from-purple-600 via-indigo-600 to-emerald-600 hover:from-purple-700 hover:to-emerald-700 text-white text-xs h-9 shadow-md"
              >
                {isAiExpanding ? (
                  <>
                    <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> তৈরি হচ্ছে...
                  </>
                ) : (
                  `✨ ${toBengaliNumber(totalAiQuestionsCount)}টি প্রশ্ন তৈরি ও যুক্ত করুন`
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* ── Dialog 3: Ready-made Templates Modal ── */}
        <Dialog open={templateModalOpen} onOpenChange={setTemplateModalOpen}>
          <DialogContent className="font-kalpurush max-w-2xl bg-white border-2 border-indigo-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2 text-indigo-950">
                <LayoutTemplate className="h-5 w-5 text-indigo-600" /> রেডিমেড প্রশ্নপত্র টেমপ্লেট
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2 max-h-[70vh] overflow-y-auto pr-1">
              <p className="text-xs text-slate-600 font-bold">
                যেকোনো একটি রেডিমেড কাঠামো বেছে নিন। এটি বর্তমান প্রশ্নপত্রে ফরম্যাটসহ স্বয়ংক্রিয়ভাবে যুক্ত হবে।
              </p>
              <div className="grid grid-cols-1 gap-2.5">
                {QUESTION_TEMPLATES.map(tmpl => (
                  <div
                    key={tmpl.id}
                    className="p-3 border-2 border-slate-200 hover:border-indigo-500 rounded-xl transition-all cursor-pointer bg-slate-50/50 hover:bg-indigo-50/30 flex items-center justify-between"
                    onClick={() => {
                      insertSnippet(tmpl.content);
                      setTemplateModalOpen(false);
                      toast({ title: 'টেমপ্লেট যুক্ত হয়েছে! 📑', description: `${tmpl.title} সফলভাবে যুক্ত হয়েছে।` });
                    }}
                  >
                    <div>
                      <p className="font-black text-sm text-slate-900">{tmpl.title}</p>
                      <p className="text-xs text-slate-500 font-bold mt-0.5">{tmpl.desc}</p>
                    </div>
                    <Button size="sm" className="font-bold bg-indigo-600 hover:bg-indigo-700 text-white shrink-0 ml-3">
                      যুক্ত করুন
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          </DialogContent>
        </Dialog>

        {/* ── Dialog 4: QR Code Modal ── */}
        <Dialog open={qrModalOpen} onOpenChange={setQrModalOpen}>
          <DialogContent className="font-kalpurush max-w-md bg-white border-2 border-indigo-200">
            <DialogHeader>
              <DialogTitle className="text-lg font-black flex items-center gap-2 text-indigo-950">
                <QrCode className="h-5 w-5 text-indigo-600" /> প্রশ্নপত্রে QR কোড যুক্ত করুন
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 py-2">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">লিংক বা ইউআরএল (URL) *</label>
                <Input
                  placeholder="যেমন: https://youtube.com/watch?v=... বা ড্রাইভ লিংক"
                  value={qrUrl}
                  onChange={e => setQrUrl(e.target.value)}
                  className="h-9 text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">ক্যাপশন / শিরোনাম</label>
                <Input
                  placeholder="যেমন: ক্লাসের ভিডিও দেখতে স্ক্যান করুন"
                  value={qrCaption}
                  onChange={e => setQrCaption(e.target.value)}
                  className="h-9 text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700">সাইজ</label>
                <Select value={qrSize} onValueChange={setQrSize}>
                  <SelectTrigger className="h-9 font-bold text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="90" className="font-bold text-xs">ছোট (90px)</SelectItem>
                    <SelectItem value="110" className="font-bold text-xs">মাঝারি (110px)</SelectItem>
                    <SelectItem value="140" className="font-bold text-xs">বড় (140px)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <DialogFooter className="gap-2 sm:gap-0">
              <Button variant="outline" size="sm" onClick={() => setQrModalOpen(false)}>বাতিল</Button>
              <Button onClick={handleInsertQrCode} className="font-bold bg-indigo-600 hover:bg-indigo-700 text-white">QR কোড বসান</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {/* ── Print & Word-like Full-screen Mode ── */}
      {isPrintMode && (
        <QuestionPrintView
          meta={meta}
          questions={questions}
          questionsB={questionsB}
          appName={appName}
          softwareConfig={softwareConfig}
          onSave={async (updatedContent, styles) => {
            if (!user || !db) return;
            const docId = editId || doc(collection(db, 'questions')).id;
            const dataToSave: any = {
              ...meta,
              content: updatedContent,
              pageStyles: styles,
              userId: user.uid,
              updatedAt: serverTimestamp(),
              isMcq: questions.some(q => q.type === 'mcq'),
            };
            if (!editId) dataToSave.createdAt = serverTimestamp();
            await setDoc(doc(db, 'questions', docId), dataToSave, { merge: true });
            if (!editId) router.replace(`/create-question?id=${docId}&print=true`);
          }}
          onBack={() => {
            const p = new URLSearchParams(window.location.search);
            p.delete('print');
            router.push(`${window.location.pathname}?${p.toString()}`);
          }}
        />
      )}

      <style dangerouslySetInnerHTML={{ __html: `
        @media screen {
          .math-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.85em; margin: 0 2px; }
          .math-num { border-bottom: 0.5pt solid black; padding: 0 1px; }
          .math-den { padding: 0 1px; }
          .math-sqrt { display: inline-flex; align-items: center; }
          .math-sqrt-stem { border-top: 0.5pt solid black; padding-top: 1px; }
          .math-sup { font-size: 0.7em; vertical-align: super; }
          .math-sub { font-size: 0.7em; vertical-align: sub; }
          .cq-item > div,
          .cq-item div,
          .short-item div {
            display: block !important;
          }
          .cq-mark,
          .short-mark {
            float: right !important;
            display: inline-block !important;
            user-select: none !important;
          }
        }
        @media print {
          html, body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            height: auto !important;
            min-height: 0 !important;
            width: 100% !important;
            overflow: visible !important;
            position: static !important;
          }
          .no-print,
          nav,
          header,
          aside,
          .no-print * {
            display: none !important;
          }
          body > div,
          #__next,
          .min-h-screen {
            position: static !important;
            display: block !important;
            height: auto !important;
            min-height: 0 !important;
            max-height: none !important;
            width: 100% !important;
            overflow: visible !important;
            margin: 0 !important;
            padding: 0 !important;
            background: transparent !important;
          }
          @page {
            size: auto;
            margin: 0 !important;
          }
        }
      `}} />
    </div>
  );
}

export default function CreateQuestionPage() { 
  return (
    <Suspense fallback={<div className="flex justify-center p-20 font-kalpurush"><Loader2 className="animate-spin text-primary" /></div>}>
      <CreateQuestionContent />
    </Suspense>
  ); 
}

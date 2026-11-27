'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { 
  FileText, 
  Printer, 
  ArrowLeft, 
  CheckSquare, 
  Square, 
  Plus, 
  Trash2, 
  BrainCircuit, 
  Sparkles, 
  Filter, 
  BookOpen, 
  Download, 
  CheckCircle2, 
  Layers, 
  Search,
  Settings2,
  Columns,
  Type,
  SlidersHorizontal,
  Split,
  Cloud,
  RefreshCw
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { useToast } from '@/hooks/use-toast';
import { 
  BankQuestion, 
  getBankQuestions, 
  addQuestionsToBank, 
  deleteQuestionFromBank, 
  fetchBankQuestionsFromFirestore,
  normalizeText 
} from '@/lib/question-bank-storage';
import { CHAPTERS_DATA } from '@/lib/subject-chapters';
import { toBengaliNumber, cn } from '@/lib/utils';
import { useFirestore, useDoc } from '@/firebase';
import { doc } from 'firebase/firestore';
import 'katex/dist/katex.min.css';
import { formatMathToHtml } from '@/lib/math-formatter';

// Font & Typography configuration for board print - starts from 8px as requested!
const FONT_SIZE_CONFIG: Record<string, { label: string; font: string; line: string; serial: string }> = {
  '8': { label: '৮ px (অতি ক্ষুদ্র)', font: '8px', line: '1.2', serial: '9px' },
  '9': { label: '৯ px (ক্ষুদ্র)', font: '9px', line: '1.25', serial: '10px' },
  '10': { label: '১০ px (খুব ছোট)', font: '10px', line: '1.3', serial: '11px' },
  '11': { label: '১১ px (ছোট)', font: '11px', line: '1.35', serial: '12px' },
  '12': { label: '১২ px (পরিমিত)', font: '12px', line: '1.4', serial: '13px' },
  '13': { label: '১৩ px (স্বাভাবিক - বোর্ড মান)', font: '13px', line: '1.45', serial: '14px' },
  '14': { label: '১৪ px (বড়)', font: '14px', line: '1.5', serial: '15px' },
  '15': { label: '১৫ px (অনেক বড়)', font: '15px', line: '1.55', serial: '16px' },
  '16': { label: '১৬ px (সর্বোচ্চ বড়)', font: '16px', line: '1.6', serial: '17px' },
};

const FONT_FAMILY_CONFIG = {
  kalpurush: { label: 'কালপুরুষ (Kalpurush - ডিফল্ট)', font: "'Kalpurush', 'Inter', sans-serif" },
  solaiman: { label: 'সোলাইমান লিপি (SolaimanLipi)', font: "'SolaimanLipi', 'Kalpurush', sans-serif" },
  nikosh: { label: 'নিকোশ (Nikosh)', font: "'Nikosh', 'Kalpurush', sans-serif" },
  sans: { label: 'আধুনিক বাংলা (System Sans)', font: "'Inter', -apple-system, BlinkMacSystemFont, sans-serif" }
};

const LINE_SPACING_CONFIG = {
  compact: { label: 'আঁটসাঁট / কম্প্যাক্ট', line: '1.25' },
  normal: { label: 'স্বাভাবিক (বোর্ড মান)', line: '1.45' },
  relaxed: { label: 'আরামদায়ক (বেশি ফাঁকা)', line: '1.65' }
};

const CLASSES = [
  { id: '6', label: '৬ষ্ঠ' },
  { id: '7', label: '৭ম' },
  { id: '8', label: '৮ম' },
  { id: '9', label: '৯ম' },
  { id: '10', label: '১০ম' },
];

/**
 * Intelligent chapter normalization and matching.
 * Handles variations like:
 * "১ম অধ্যায়: বাস্তব সংখ্যা" <-> "প্রথম অধ্যায়: বাস্তব সংখ্যা" <-> "বাস্তব সংখ্যা"
 */
function canonicalizeChapter(ch?: string): string {
  if (!ch) return '';
  let s = ch.trim().toLowerCase();

  // Standardize ordinal numbers and words into digits
  s = s
    .replace(/(^|[^০-৯0-9])(প্রথম|১ম|1st|১|1)([^০-৯0-9]|$)/g, '$1#1#$3')
    .replace(/(^|[^০-৯0-9])(দ্বিতীয়|২য়|2nd|২|2)([^০-৯0-9]|$)/g, '$1#2#$3')
    .replace(/(^|[^০-৯0-9])(তৃতীয়|৩য়|3rd|৩|3)([^০-৯0-9]|$)/g, '$1#3#$3')
    .replace(/(^|[^০-৯0-9])(চতুর্থ|৪র্থ|4th|৪|4)([^০-৯0-9]|$)/g, '$1#4#$3')
    .replace(/(^|[^০-৯0-9])(পঞ্চম|৫ম|5th|৫|5)([^০-৯0-9]|$)/g, '$1#5#$3')
    .replace(/(^|[^০-৯0-9])(ষষ্ঠ|৬ষ্ঠ|6th|৬|6)([^০-৯0-9]|$)/g, '$1#6#$3')
    .replace(/(^|[^০-৯0-9])(সপ্তম|৭ম|7th|৭|7)([^০-৯0-9]|$)/g, '$1#7#$3')
    .replace(/(^|[^০-৯0-9])(অষ্টম|৮ম|8th|৮|8)([^০-৯0-9]|$)/g, '$1#8#$3')
    .replace(/(^|[^০-৯0-9])(নবম|৯ম|9th|৯|9)([^০-৯0-9]|$)/g, '$1#9#$3')
    .replace(/(^|[^০-৯0-9])(দশম|১০ম|10th|১০|10)([^০-৯0-9]|$)/g, '$1#10#$3')
    .replace(/(^|[^০-৯0-9])(একাদশ|১১শ|11th|১১|11)([^০-৯0-9]|$)/g, '$1#11#$3')
    .replace(/(^|[^০-৯0-9])(দ্বাদশ|১২শ|12th|১২|12)([^০-৯0-9]|$)/g, '$1#12#$3')
    .replace(/(^|[^০-৯0-9])(ত্রয়োদশ|ত্রয়োদশ|১৩শ|13th|১৩|13)([^০-৯0-9]|$)/g, '$1#13#$3')
    .replace(/(^|[^০-৯0-9])(চতুর্দশ|১৪শ|14th|১৪|14)([^০-৯0-9]|$)/g, '$1#14#$3')
    .replace(/(^|[^০-৯0-9])(পঞ্চদশ|১৫শ|15th|১৫|15)([^০-৯0-9]|$)/g, '$1#15#$3')
    .replace(/(^|[^০-৯0-9])(ষোড়শ|ষোড়শ|১৬শ|16th|১৬|16)([^০-৯0-9]|$)/g, '$1#16#$3')
    .replace(/(^|[^০-৯0-9])(সপ্তদশ|১৭শ|17th|১৭|17)([^০-৯0-9]|$)/g, '$1#17#$3');

  // Strip prefixes like "অধ্যায়", "অধ্যায়", "chapter", colons, and spaces
  s = s.replace(/অধ্যায়|অধ্যায়|chapter|lesson/gi, '');
  s = s.replace(/[:\-–—.,]/g, ' ');
  s = s.replace(/\s+/g, ' ').trim();
  return s;
}

function isSameChapter(a?: string, b?: string): boolean {
  if (!a || !b) return false;
  if (a === b) return true;
  const ca = canonicalizeChapter(a);
  const cb = canonicalizeChapter(b);
  if (ca === cb) return true;
  const strippedA = ca.replace(/#[0-9]+#/g, '').trim();
  const strippedB = cb.replace(/#[0-9]+#/g, '').trim();
  if (strippedA && strippedB && (strippedA === strippedB || strippedA.includes(strippedB) || strippedB.includes(strippedA))) {
    return true;
  }
  return false;
}

/**
 * Format questions for board display:
 * - Separates sub-questions (ক, খ, গ, ঘ) and aligns their marks (২, ৪, ৪)
 * - Math CQ standard marks: ক=২, খ=৪, গ=৪
 * - Science / Other subjects CQ standard marks: ক=১, খ=২, গ=৩, ঘ=৪
 * - For Short Questions (isShortQuestion = true): Trailing marks like [২] are completely stripped as per board standard!
 */
function formatContentWithBoardMarks(
  content: string, 
  options?: { subject?: string; isShortQuestion?: boolean }
): string {
  if (!content) return '';
  // Strip any duplicate leading serial number like "১। " or "১. " or "1. " from start
  let cleaned = content.replace(/^[০-৯0-9]+[।.)]\s*/, '').trim();

  // If this is a Short Question, strip all trailing/embedded marks like [২], [2], (২), etc.
  if (options?.isShortQuestion) {
    cleaned = cleaned
      .replace(/\[\s*[০-৯0-9]+\s*\]/g, '')
      .replace(/\(\s*[০-৯0-9]+\s*\)/g, '')
      .replace(/(?:(।|\.)\s*|\s+)[১-৯1-9][০-৯0-9]?\s*$/gm, '$1')
      .trim();
  }

  const rawLines = cleaned.split(/\r?\n/).map(l => l.trim()).filter(Boolean);
  
  const rendered = rawLines.map(line => {
    // If Short Question, render clean text without any trailing marks
    if (options?.isShortQuestion) {
      const strippedLine = line
        .replace(/\[\s*[০-৯0-9]+\s*\]/g, '')
        .replace(/\(\s*[০-৯0-9]+\s*\)/g, '')
        .replace(/(?:(।|\.)\s*|\s+)[১-৯1-9][০-৯0-9]?\s*$/, '$1')
        .replace(/\s+/g, ' ')
        .trim();
      return `<div class="leading-relaxed text-justify my-0.5 math-rendered">${formatMathToHtml(strippedLine)}</div>`;
    }

    // Check if line is an MCQ options line with multiple options like "(ক) ... (খ) ..."
    const isMcqOptionsLine = /\([খ-ঘb-d]\)|\b[খ-ঘb-d]\./i.test(line);

    // Check if line is a sub-question: e.g. "ক. ... [২]" or "(ক) ... [৪]" or "ক. ...। ২"
    const subMatch = line.match(/^([ক-ঘa-d]\.|\([ক-ঘa-d]\))\s*(.*)$/i);
    if (subMatch && !isMcqOptionsLine) {
      const prefix = subMatch[1];
      let rest = subMatch[2].trim();
      let mark = '';

      // 1. Bracketed mark e.g. [2], [২], (2), (২)
      const bracketMatch = rest.match(/(?:\[|\()\s*([০-৯0-9]+)\s*(?:\]|\))\s*$/);
      if (bracketMatch) {
        mark = toBengaliNumber(bracketMatch[1]);
        rest = rest.slice(0, bracketMatch.index).trim();
      } else {
        // 2. Bare trailing mark e.g. '। ২', '। 2', ' 2', ' 4', '। ৪'
        const bareMatch = rest.match(/(?:(।|\.)\s*|\s+)([১-৯1-9][০-৯0-9]?)\s*$/);
        if (bareMatch) {
          mark = toBengaliNumber(bareMatch[2]);
          const punct = bareMatch[1] || '';
          rest = rest.slice(0, bareMatch.index).trim() + punct;
        }
      }

      const norm = prefix.replace(/[^ক-ঘa-d]/gi, '').toLowerCase();
      const isMath = !options?.subject || /গণিত|math/i.test(options.subject);

      if (isMath) {
        // Math standard board marks: ক=২, খ=৪, গ=৪
        if (!mark) {
          if (norm === 'ক' || norm === 'a') mark = '২';
          else if (norm === 'খ' || norm === 'b') mark = '৪';
          else if (norm === 'গ' || norm === 'c') mark = '৪';
          else if (norm === 'ঘ' || norm === 'd') mark = '৪';
        }
      } else {
        // Other subjects (Science, Arts, Business, etc. Board CQ): ক=১, খ=২, গ=৩, ঘ=৪
        if (norm === 'ক' || norm === 'a') mark = '১';
        else if (norm === 'খ' || norm === 'b') mark = '২';
        else if (norm === 'গ' || norm === 'c') mark = '৩';
        else if (norm === 'ঘ' || norm === 'd') mark = '৪';
        else if (!mark) mark = '১';
      }

      const formattedText = formatMathToHtml(`${prefix} ${rest}`);
      return `<div class="flex items-start justify-between gap-2 w-full my-0.5"><div class="flex-1 leading-relaxed text-justify math-rendered">${formattedText}</div>${mark ? `<div class="w-6 text-right font-black text-slate-950 shrink-0 select-none pl-1 text-sm">${mark}</div>` : ''}</div>`;
    }

    // Normal stimulus or MCQ line
    return `<div class="leading-relaxed text-justify my-0.5 math-rendered">${formatMathToHtml(line)}</div>`;
  });

  return rendered.join('');
}

/**
 * Intelligent MCQ Options Formatter:
 * - Automatically detects options (ক, খ, গ, ঘ) from content or options array.
 * - Formats in strict Board Standard Grid layouts:
 *     * 1 Line (4 columns): Short options all fit on 1 line.
 *     * 2 Lines (2 columns: 2 on row 1, 2 on row 2): Medium options.
 *     * 4 Lines (1 column: 1 per row): Long sentences.
 *     * STRICT RULE: Never 3 lines!
 *     * Ensures (ক) aligns under (ক), (খ) under (খ), etc.
 */
function renderMcqFormatted(content: string, rawOptions?: string[]) {
  // Strip duplicate leading serial like "১। " or "1. " from start
  let cleaned = content.replace(/^[০-৯0-9]+[।.)]\s*/, '').trim();

  let stem = cleaned;
  let options: Array<{ letter: string; text: string }> = [];

  if (rawOptions && rawOptions.length >= 4) {
    const letters = ['(ক)', '(খ)', '(গ)', '(ঘ)'];
    options = rawOptions.slice(0, 4).map((opt, i) => ({
      letter: letters[i],
      text: opt.replace(/^\(?[ক-ঘa-d]\)?[.)]\s*/i, '').trim()
    }));
  } else {
    // Check if options are inside cleaned text
    const marker = /(?:^|\n|\s)(?:\(|)([কaA])(?:[\.\)]|\))\s+/;
    const match = cleaned.match(marker);
    if (match && match.index !== undefined) {
      stem = cleaned.slice(0, match.index).trim();
      const optionsPart = cleaned.slice(match.index).trim();

      const splitRegex = /(?:^|\s+)(?:\(|)([ক-ঘa-d])(?:[\.\)]|\))\s*/gi;
      const matches = [...optionsPart.matchAll(splitRegex)];
      if (matches.length >= 4) {
        const letters = ['(ক)', '(খ)', '(গ)', '(ঘ)'];
        for (let i = 0; i < 4; i++) {
          const cur = matches[i];
          const start = cur.index + cur[0].length;
          const end = (i + 1 < matches.length) ? matches[i + 1].index : optionsPart.length;
          options.push({
            letter: letters[i],
            text: optionsPart.slice(start, end).trim()
          });
        }
      }
    }
  }

  // If we could not extract 4 distinct options, fallback to standard markdown renderer
  if (options.length !== 4) {
    return (
      <div 
        className="leading-relaxed text-justify my-0.5 math-rendered"
        dangerouslySetInnerHTML={{ __html: formatMathToHtml(cleaned) }}
      />
    );
  }

  // Clean and measure visible text length
  const cleanOptionLengths = options.map(o => {
    const plain = o.text
      .replace(/\\(?:sqrt|frac|text|dot|vec|log)\b/g, '')
      .replace(/[{}\[\]$()\\_]/g, '')
      .replace(/\s+/g, ' ')
      .trim();
    return plain.length;
  });
  const maxLen = Math.max(...cleanOptionLengths);
  const totalLen = cleanOptionLengths.reduce((a, b) => a + b, 0);

  // Strict Board Standard Layout selection:
  // - 1 line (4 columns across): ONLY if ALL 4 options are very short digits/symbols (<= 4 chars, e.g. N, Z, 0, 1)
  // - 2 lines (2 columns each: row 1 (ক, খ), row 2 (গ, ঘ)): medium options up to 15 chars (e.g. দুই প্রকার, তিন প্রকার, ধনাত্মক সংখ্যা)
  // - 4 lines (1 column each: 1 option per line): longer sentences or phrases
  // STRICT RULE: Never wrap text to a second line within an option!
  let gridClass = 'grid-cols-4';
  let isNowrap = false;

  if (maxLen <= 4 && totalLen <= 16) {
    gridClass = 'grid-cols-4'; // 1 Line (4 options across)
    isNowrap = true;
  } else if (maxLen <= 16 && totalLen <= 60) {
    gridClass = 'grid-cols-2'; // 2 Lines (2 options per row: row 1 (ক, খ), row 2 (গ, ঘ))
    isNowrap = true;
  } else {
    gridClass = 'grid-cols-1'; // 4 Lines (1 option per row)
    isNowrap = false;
  }

  return (
    <div className="w-full">
      {/* Question stem */}
      <div 
        className="font-medium text-justify my-0.5 math-rendered"
        dangerouslySetInnerHTML={{ __html: formatMathToHtml(stem) }}
      />
      {/* 4 options in exact mathematical grid */}
      <div className={cn("grid gap-x-3 gap-y-0.5 mt-1 text-slate-900 select-none", gridClass)}>
        {options.map((opt, i) => (
          <div key={i} className={cn("flex items-start gap-1 math-rendered", isNowrap && "whitespace-nowrap")}>
            <span className="font-bold shrink-0">{opt.letter}</span>
            <span 
              className={cn("flex-1 text-left", isNowrap && "whitespace-nowrap")}
              dangerouslySetInnerHTML={{ __html: formatMathToHtml(opt.text) }}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

export default function QuestionBankPage() {
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();

  const softwareDocRef = useMemo(() => db ? doc(db, 'config', 'software') : null, [db]);
  const { data: softwareConfig } = useDoc(softwareDocRef);
  const appName = softwareConfig?.appName || 'টপ গ্রেড টিউটোরিয়ালস';

  // Bank Data & Filters
  const [questions, setQuestions] = useState<BankQuestion[]>([]);
  const [selectedClass, setSelectedClass] = useState<string>('9');
  const [selectedSubject, setSelectedSubject] = useState<string>('গণিত');
  const [selectedChapter, setSelectedChapter] = useState<string>('all');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Interactive Tab: 'all' | 'creative' | 'mcq' | 'short'
  const [activeTab, setActiveTab] = useState<'all' | 'creative' | 'mcq' | 'short'>('all');

  // Selected question IDs for paper compilation
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Setup Popup Modal state (before direct print)
  const [setupModalOpen, setSetupModalOpen] = useState(false);
  const [isPrintView, setIsPrintView] = useState(false);
  const [columnLayout, setColumnLayout] = useState<'1' | '2'>('2');

  // Board Setup Config values
  const [institutionName, setInstitutionName] = useState('টপ গ্রেড টিউটোরিয়ালস');
  const [examName, setExamName] = useState('মূল্যায়ন পরীক্ষা');
  const [examTime, setExamTime] = useState('২ ঘণ্টা ৩০ মিনিট');
  const [examTotalMarks, setExamTotalMarks] = useState('১০০');

  // Section headline, inclusion & instruction configs
  const [includeCreative, setIncludeCreative] = useState(true);
  const [creativeTitle, setCreativeTitle] = useState('ক-বিভাগ: সৃজনশীল প্রশ্ন');
  const [creativeInstruction, setCreativeInstruction] = useState('যেকোনো ৩টি প্রশ্নের উত্তর দাও: ৩ × ১০ = ৩০');
  const [creativeStartSerial, setCreativeStartSerial] = useState('১');

  // Creative Questions multiple sections (ক-বিভাগ, খ-বিভাগ, গ-বিভাগ, ঘ-বিভাগ ইত্যাদি)
  const [creativeSections, setCreativeSections] = useState<Array<{
    id: string;
    title: string;
    instruction: string;
    startSerial: string;
    fromQ: number;
    toQ: number;
  }>>([
    {
      id: 'cq-sec-1',
      title: 'ক-বিভাগ: সৃজনশীল প্রশ্ন',
      instruction: 'যেকোনো ৩টি প্রশ্নের উত্তর দাও: ৩ × ১০ = ৩০',
      startSerial: '১',
      fromQ: 1,
      toQ: 11
    }
  ]);

  // Print typography controls - default is 13px (board standard), options start from 8px!
  const [printFontSize, setPrintFontSize] = useState<string>('13');
  const [printFontFamily, setPrintFontFamily] = useState<'kalpurush' | 'solaiman' | 'nikosh' | 'sans'>('kalpurush');
  const [printLineSpacing, setPrintLineSpacing] = useState<'compact' | 'normal' | 'relaxed'>('normal');

  const [includeMcq, setIncludeMcq] = useState(true);
  const [mcqTitle, setMcqTitle] = useState('খ-বিভাগ: বহুনির্বাচনী প্রশ্ন');
  const [mcqInstruction, setMcqInstruction] = useState('সঠিক উত্তরের বিপরীতের বৃত্তটি বল পয়েন্ট কলম দ্বারা ভরাট কর। সকল প্রশ্নের উত্তর দিতে হবে।');
  const [mcqStartSerial, setMcqStartSerial] = useState('১');

  const [includeShort, setIncludeShort] = useState(true);
  const [shortTitle, setShortTitle] = useState('গ-বিভাগ: সংক্ষিপ্ত প্রশ্ন');
  const [shortInstruction, setShortInstruction] = useState('সকল প্রশ্নের উত্তর দাও');
  const [shortStartSerial, setShortStartSerial] = useState('১');

  // Add Question Modal state
  const [addModalOpen, setAddModalOpen] = useState(false);
  const [newType, setNewType] = useState<'creative' | 'mcq' | 'short'>('creative');
  const [newClass, setNewClass] = useState('9');
  const [newSubject, setNewSubject] = useState('গণিত');
  const [newChapter, setNewChapter] = useState('১ম অধ্যায়: বাস্তব সংখ্যা');
  const [newContent, setNewContent] = useState('');
  const [isSyncingCloud, setIsSyncingCloud] = useState(false);

  // Load questions from storage & sync with central cloud Firestore
  const reloadQuestions = useCallback(async () => {
    // 1. Instant load from local cache
    const list = getBankQuestions();
    setQuestions(list);

    // 2. Fetch and bi-directionally sync with Central Server (Firestore)
    if (db) {
      setIsSyncingCloud(true);
      try {
        const unified = await fetchBankQuestionsFromFirestore(db);
        setQuestions(unified);
      } catch (err) {
        console.warn('Central server sync error:', err);
      } finally {
        setIsSyncingCloud(false);
      }
    }
  }, [db]);

  useEffect(() => {
    reloadQuestions();
  }, [reloadQuestions]);

  useEffect(() => {
    if (appName) {
      setInstitutionName(appName);
    }
  }, [appName]);

  // Available subjects for selected class
  const availableSubjects = useMemo(() => {
    const classData = CHAPTERS_DATA[selectedClass] || {};
    const subjects = Object.keys(classData);
    if (!subjects.includes('গণিত')) subjects.unshift('গণিত');
    return subjects;
  }, [selectedClass]);

  // Available chapters for selected class & subject with smart deduplication
  const availableChapters = useMemo(() => {
    const classData = CHAPTERS_DATA[selectedClass] || {};
    const rawChapters = classData[selectedSubject] || [];
    
    // Also include any custom chapters stored in bank questions for this class/subject
    const storedChapters = questions
      .filter(q => String(q.classId) === String(selectedClass) && normalizeText(q.subject) === normalizeText(selectedSubject))
      .map(q => q.chapter)
      .filter(Boolean);

    // Merge and deduplicate using isSameChapter
    const list: string[] = [];
    [...storedChapters, ...rawChapters].forEach(ch => {
      if (!list.some(existing => isSameChapter(existing, ch))) {
        list.push(ch);
      }
    });

    return list;
  }, [selectedClass, selectedSubject, questions]);

  // Set default subject if not available
  useEffect(() => {
    if (availableSubjects.length > 0 && !availableSubjects.includes(selectedSubject)) {
      setSelectedSubject(availableSubjects[0]);
    }
  }, [availableSubjects, selectedSubject]);

  // Filtered Questions with robust chapter matching
  const filteredQuestions = useMemo(() => {
    return questions.filter(q => {
      if (selectedClass && String(q.classId) !== String(selectedClass)) return false;
      if (selectedSubject && normalizeText(q.subject) !== normalizeText(selectedSubject)) return false;
      if (selectedChapter !== 'all' && !isSameChapter(q.chapter, selectedChapter)) return false;
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase();
        const matchContent = q.content.toLowerCase().includes(query);
        const matchChapter = q.chapter.toLowerCase().includes(query);
        if (!matchContent && !matchChapter) return false;
      }
      return true;
    });
  }, [questions, selectedClass, selectedSubject, selectedChapter, searchQuery]);

  // Partitioned by type
  const mcqQuestions = useMemo(() => {
    return filteredQuestions
      .filter(q => q.type === 'mcq')
      .sort((a, b) => a.serialNo - b.serialNo);
  }, [filteredQuestions]);

  const creativeQuestions = useMemo(() => {
    return filteredQuestions
      .filter(q => q.type === 'creative')
      .sort((a, b) => a.serialNo - b.serialNo);
  }, [filteredQuestions]);

  const shortQuestions = useMemo(() => {
    return filteredQuestions
      .filter(q => q.type === 'short')
      .sort((a, b) => a.serialNo - b.serialNo);
  }, [filteredQuestions]);

  // Selected questions objects
  const selectedQuestions = useMemo(() => {
    return questions.filter(q => selectedIds.has(q.id));
  }, [questions, selectedIds]);

  const selectedMcqs = useMemo(() => selectedQuestions.filter(q => q.type === 'mcq'), [selectedQuestions]);
  const selectedCreatives = useMemo(() => selectedQuestions.filter(q => q.type === 'creative'), [selectedQuestions]);
  const selectedShorts = useMemo(() => selectedQuestions.filter(q => q.type === 'short'), [selectedQuestions]);

  // Selection handlers
  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const handleSelectAllType = (typeList: BankQuestion[]) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = typeList.every(q => next.has(q.id));
      if (allSelected) {
        typeList.forEach(q => next.delete(q.id));
      } else {
        typeList.forEach(q => next.add(q.id));
      }
      return next;
    });
  };

  const handleSelectAllVisible = () => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      const allSelected = filteredQuestions.every(q => next.has(q.id));
      if (allSelected) {
        filteredQuestions.forEach(q => next.delete(q.id));
      } else {
        filteredQuestions.forEach(q => next.add(q.id));
      }
      return next;
    });
  };

  const handleClearSelection = () => {
    setSelectedIds(new Set());
  };

  // Delete handler
  const handleDeleteQuestion = (id: string) => {
    if (confirm('আপনি কি এই প্রশ্নটি প্রশ্নব্যাংক থেকে মুছে ফেলতে চান?')) {
      deleteQuestionFromBank(id, db);
      setSelectedIds(prev => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
      reloadQuestions();
      toast({ title: 'প্রশ্ন মুছে ফেলা হয়েছে' });
    }
  };

  // Open the Board Setup Popup Modal
  const handleOpenSetupModal = () => {
    if (selectedIds.size === 0) {
      toast({
        variant: 'destructive',
        title: 'প্রশ্ন নির্বাচন করুন',
        description: 'প্রিন্ট করার জন্য অন্তত একটি প্রশ্নের টিক বক্সে ক্লিক করে নির্বাচন করুন।'
      });
      return;
    }

    // Auto-calculate full marks & default time
    const totalM = (selectedCreatives.length * 10) + (selectedMcqs.length * 1) + (selectedShorts.length * 2);
    setExamTotalMarks(toBengaliNumber(totalM));
    if (totalM <= 25) setExamTime('৪০ মিনিট');
    else if (totalM <= 50) setExamTime('১ ঘণ্টা ১৫ মিনিট');
    else setExamTime('২ ঘণ্টা ৩০ মিনিট');

    // Auto-set section inclusion
    const hasCq = selectedCreatives.length > 0;
    const hasMcq = selectedMcqs.length > 0;
    const hasShort = selectedShorts.length > 0;

    setIncludeCreative(hasCq);
    setIncludeMcq(hasMcq);
    setIncludeShort(hasShort);

    // If an exam consists of only ONE section, omit the "ক/খ/গ-বিভাগ" prefix so it's a clean standalone test!
    const isSingleSectionOnly = (hasMcq && !hasCq && !hasShort) || (hasCq && !hasMcq && !hasShort) || (hasShort && !hasCq && !hasMcq);

    if (hasMcq && !hasCq && !hasShort) {
      setMcqTitle(''); // No "খ-বিভাগ" needed for standalone MCQ test
      setCreativeTitle('ক-বিভাগ: সৃজনশীল প্রশ্ন');
      setShortTitle('গ-বিভাগ: সংক্ষিপ্ত প্রশ্ন');
    } else if (hasCq && !hasMcq && !hasShort) {
      setCreativeTitle(''); // No "ক-বিভাগ" needed for standalone CQ test
      setMcqTitle('খ-বিভাগ: বহুনির্বাচনী প্রশ্ন');
      setShortTitle('গ-বিভাগ: সংক্ষিপ্ত প্রশ্ন');
    } else if (hasShort && !hasCq && !hasMcq) {
      setShortTitle('');
      setCreativeTitle('ক-বিভাগ: সৃজনশীল প্রশ্ন');
      setMcqTitle('খ-বিভাগ: বহুনির্বাচনী প্রশ্ন');
    } else {
      setCreativeTitle('ক-বিভাগ: সৃজনশীল প্রশ্ন');
      setMcqTitle('খ-বিভাগ: বহুনির্বাচনী প্রশ্ন');
      setShortTitle('গ-বিভাগ: সংক্ষিপ্ত প্রশ্ন');
    }

    // Auto-calculate continuous serial numbers across sections
    setCreativeStartSerial('1');
    const cqEnd = selectedCreatives.length > 0 ? selectedCreatives.length : 0;
    
    const mcqStart = (cqEnd > 0 && hasCq) ? cqEnd + 1 : 1;
    setMcqStartSerial(String(mcqStart));

    // Short question serial number ALWAYS starts from 1 as per board standard and user request!
    setShortStartSerial('1');

    // Auto-configure instructions based on selected count
    const cqAns = Math.max(1, selectedCreatives.length > 7 ? 7 : (selectedCreatives.length || 1));
    const defaultCqTitle = isSingleSectionOnly ? '' : 'ক-বিভাগ: সৃজনশীল প্রশ্ন';
    const defaultCqInstruction = `যেকোনো ${toBengaliNumber(cqAns)}টি প্রশ্নের উত্তর দাও: ${toBengaliNumber(cqAns)} × ১০ = ${toBengaliNumber(cqAns * 10)}`;
    setCreativeInstruction(defaultCqInstruction);

    // Initialize creative sections (supports multiple sections: ক, খ, গ, ঘ বিভাগ)
    setCreativeSections([
      {
        id: 'cq-sec-1',
        title: defaultCqTitle,
        instruction: defaultCqInstruction,
        startSerial: '১',
        fromQ: 1,
        toQ: Math.max(1, selectedCreatives.length)
      }
    ]);
    
    const mcqCount = selectedMcqs.length || 20;
    setMcqInstruction(`সঠিক উত্তরের বিপরীতের বৃত্তটি বল পয়েন্ট কলম দ্বারা ভরাট কর। সকল প্রশ্নের উত্তর দিতে হবে: ${toBengaliNumber(mcqCount)} × ১ = ${toBengaliNumber(mcqCount)}`);
    
    const shortCount = selectedShorts.length || 10;
    setShortInstruction(`সকল প্রশ্নের উত্তর দাও: ${toBengaliNumber(shortCount)} × ২ = ${toBengaliNumber(shortCount * 2)}`);

    setSetupModalOpen(true);
  };

  // Helper to add a new creative sub-section
  const handleAddCreativeSection = () => {
    setCreativeSections(prev => {
      const nextIndex = prev.length + 1;
      const letters = ['ক', 'খ', 'গ', 'ঘ', 'ঙ', 'চ'];
      const letter = letters[prev.length] || `বিভাগ ${toBengaliNumber(nextIndex)}`;
      const lastSec = prev[prev.length - 1];
      const cqTotal = selectedCreatives.length || 1;
      const fromQ = lastSec ? Math.min(cqTotal, lastSec.toQ + 1) : 1;
      const toQ = Math.min(cqTotal, fromQ + 2);
      const startSerial = toBengaliNumber(fromQ);

      return [
        ...prev,
        {
          id: `cq-sec-${Date.now()}`,
          title: `${letter}-বিভাগ`,
          instruction: 'যেকোনো ২টি প্রশ্নের উত্তর দাও: ২ × ১০ = ২০',
          startSerial: startSerial,
          fromQ: fromQ,
          toQ: Math.max(fromQ, toQ)
        }
      ];
    });
  };

  // Helper to remove a creative sub-section
  const handleRemoveCreativeSection = (id: string) => {
    setCreativeSections(prev => {
      if (prev.length <= 1) return prev;
      return prev.filter(s => s.id !== id);
    });
  };

  // Helper to update a section
  const handleUpdateCreativeSection = (id: string, field: string, value: any) => {
    setCreativeSections(prev => prev.map(s => {
      if (s.id !== id) return s;
      return { ...s, [field]: value };
    }));
  };

  // Preset 4-Section Template (Board Standard for Math)
  const handleApplyBoard4SectionPreset = () => {
    const totalQ = selectedCreatives.length || 11;
    setCreativeSections([
      {
        id: 'cq-sec-1',
        title: 'ক-বিভাগ: বীজগণিত',
        instruction: 'যেকোনো ২টি প্রশ্নের উত্তর দাও: ২ × ১০ = ২০',
        startSerial: '১',
        fromQ: 1,
        toQ: Math.min(totalQ, 3)
      },
      {
        id: 'cq-sec-2',
        title: 'খ-বিভাগ: জ্যামিতি',
        instruction: 'যেকোনো ২টি প্রশ্নের উত্তর দাও: ২ × ১০ = ২০',
        startSerial: '৪',
        fromQ: Math.min(totalQ, 4),
        toQ: Math.min(totalQ, 6)
      },
      {
        id: 'cq-sec-3',
        title: 'গ-বিভাগ: ত্রিকোণমিতি ও পরিমিতি',
        instruction: 'যেকোনো ২টি প্রশ্নের উত্তর দাও: ২ × ১০ = ২০',
        startSerial: '৭',
        fromQ: Math.min(totalQ, 7),
        toQ: Math.min(totalQ, 9)
      },
      {
        id: 'cq-sec-4',
        title: 'ঘ-বিভাগ: পরিসংখ্যান',
        instruction: 'যেকোনো ১টি প্রশ্নের উত্তর দাও: ১ × ১০ = ১০',
        startSerial: '১০',
        fromQ: Math.min(totalQ, 10),
        toQ: totalQ
      }
    ]);
  };

  // Reset to single creative section
  const handleResetToSingleSection = () => {
    const totalQ = selectedCreatives.length || 1;
    const ansQ = Math.max(1, totalQ > 7 ? 7 : totalQ);
    setCreativeSections([
      {
        id: 'cq-sec-1',
        title: 'ক-বিভাগ: সৃজনশীল প্রশ্ন',
        instruction: `যেকোনো ${toBengaliNumber(ansQ)}টি প্রশ্নের উত্তর দাও: ${toBengaliNumber(ansQ)} × ১০ = ${toBengaliNumber(ansQ * 10)}`,
        startSerial: '১',
        fromQ: 1,
        toQ: totalQ
      }
    ]);
  };

  // Confirm setup and go to final 2-column print paper
  const handleConfirmAndProceedToPrint = () => {
    setSetupModalOpen(false);
    setIsPrintView(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // Add Question handler
  const handleAddNewQuestion = () => {
    if (!newContent.trim()) {
      toast({ variant: 'destructive', title: 'প্রশ্নের বিবরণ লিখুন' });
      return;
    }

    const res = addQuestionsToBank([{
      classId: newClass,
      subject: newSubject,
      chapter: newChapter,
      type: newType,
      content: newContent.trim(),
      source: 'manual'
    }], db);

    reloadQuestions();
    setNewContent('');
    setAddModalOpen(false);
    toast({ 
      title: 'সফলভাবে যুক্ত হয়েছে! 🎉', 
      description: `প্রশ্নটি ক্রমিক নং ${toBengaliNumber(res.savedItems[0]?.serialNo || 1)} হিসেবে সেভ হয়েছে।` 
    });
  };

  // ──────────────────────────────────────────────────────────
  // VIEW 1: PRINT VIEW (বোর্ডমানের রেডিমেড প্রশ্নপত্র)
  // ──────────────────────────────────────────────────────────
  if (isPrintView) {
    const isOnlyMcq = includeMcq && !includeCreative && !includeShort;
    const isOnlyCreative = includeCreative && !includeMcq && !includeShort;
    const isOnlyShort = includeShort && !includeCreative && !includeMcq;
    const isSingleTypeExam = isOnlyMcq || isOnlyCreative || isOnlyShort;
    const singleTypeInstruction = isOnlyMcq ? mcqInstruction : isOnlyCreative ? creativeInstruction : shortInstruction;

    const activeFont = FONT_FAMILY_CONFIG[printFontFamily]?.font || FONT_FAMILY_CONFIG.kalpurush.font;
    const activeSize = FONT_SIZE_CONFIG[printFontSize] || FONT_SIZE_CONFIG.base;
    const activeLeading = LINE_SPACING_CONFIG[printLineSpacing]?.line || activeSize.line;

    return (
      <div 
        style={{ fontFamily: activeFont }}
        className="print-wrapper min-h-screen bg-slate-200 py-6 px-2 sm:px-6 font-kalpurush print:bg-white print:p-0 print:m-0 print:min-h-0 print:w-full"
      >
        {/* Floating Top Control Bar (Strictly hidden during print) */}
        <div className="no-print max-w-[8.27in] mx-auto mb-6 bg-white p-3 sm:p-4 rounded-2xl shadow-lg border-2 border-indigo-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 flex-wrap">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => setIsPrintView(false)} 
              className="font-bold text-xs gap-1.5 h-8"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> তালিকায় ফিরে যান
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setIsPrintView(false);
                setSetupModalOpen(true);
              }}
              className="font-bold text-xs gap-1.5 h-8 border-indigo-300 text-indigo-800"
            >
              <Settings2 className="w-3.5 h-3.5" /> সেটিংস পরিবর্তন
            </Button>
            
            {/* Quick 1-column vs 2-column switcher */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300">
              <button
                type="button"
                onClick={() => setColumnLayout('1')}
                className={cn("px-2 py-1 text-xs font-bold rounded transition-colors", columnLayout === '1' ? "bg-white shadow text-indigo-700 font-black" : "text-slate-600")}
              >
                ১ কলাম
              </button>
              <button
                type="button"
                onClick={() => setColumnLayout('2')}
                className={cn("px-2 py-1 text-xs font-bold rounded transition-colors", columnLayout === '2' ? "bg-white shadow text-indigo-700 font-black" : "text-slate-600")}
              >
                ২ কলাম
              </button>
            </div>

            {/* Quick Font Size Stepper (৮ px থেকে ১৬ px) */}
            <div className="flex items-center bg-slate-100 p-0.5 rounded-lg border border-slate-300 gap-1">
              <span className="text-[10px] font-bold text-slate-500 pl-1.5 flex items-center gap-0.5">
                <Type className="w-3 h-3" /> ফন্ট:
              </span>
              <button
                type="button"
                onClick={() => {
                  const cur = parseInt(printFontSize, 10) || 13;
                  setPrintFontSize(String(Math.max(8, cur - 1)));
                }}
                disabled={parseInt(printFontSize, 10) <= 8}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white text-slate-700 font-black text-xs disabled:opacity-30"
                title="ফন্ট সাইজ ছোট করুন (৮ পর্যন্ত)"
              >
                −
              </button>
              <span className="px-1 text-[11px] font-black text-indigo-700 min-w-[36px] text-center">
                {toBengaliNumber(printFontSize)} px
              </span>
              <button
                type="button"
                onClick={() => {
                  const cur = parseInt(printFontSize, 10) || 13;
                  setPrintFontSize(String(Math.min(16, cur + 1)));
                }}
                disabled={parseInt(printFontSize, 10) >= 16}
                className="w-5 h-5 flex items-center justify-center rounded hover:bg-white text-slate-700 font-black text-xs disabled:opacity-30"
                title="ফন্ট সাইজ বড় করুন (১৬ পর্যন্ত)"
              >
                +
              </button>
              <div className="h-3 w-px bg-slate-300 mx-0.5" />
              {['8', '10', '12', '13', '15'].map(sz => (
                <button
                  key={sz}
                  type="button"
                  onClick={() => setPrintFontSize(sz)}
                  className={cn(
                    "px-1.5 py-0.5 text-[10px] font-bold rounded transition-colors",
                    printFontSize === sz ? "bg-white shadow text-indigo-700 font-black" : "text-slate-600 hover:text-slate-900"
                  )}
                  title={`${sz} px ফন্ট সাইজ`}
                >
                  {toBengaliNumber(sz)}
                </button>
              ))}
            </div>

            <span className="text-xs font-black text-indigo-900 bg-indigo-50 px-2.5 py-1 rounded-lg border border-indigo-200 hidden sm:inline">
              মোট প্রশ্ন: {toBengaliNumber(selectedIds.size)}টি | পূর্ণমান: {examTotalMarks}
            </span>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              onClick={() => {
                if (typeof document !== 'undefined') {
                  document.title = `${institutionName} - ${examName} - ${selectedSubject}`;
                }
                window.print();
              }}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs gap-1.5 h-8 px-4 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> এখনই প্রিন্ট করুন
            </Button>
            <Button
              onClick={() => {
                if (typeof document !== 'undefined') {
                  document.title = `${institutionName} - ${examName} - ${selectedSubject}`;
                }
                window.print();
              }}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs gap-1.5 h-8 px-4 shadow-sm"
            >
              <Download className="w-3.5 h-3.5" /> PDF ডাউনলোড
            </Button>
          </div>
        </div>

        {/* The Printable Board A4 Paper Container */}
        <div 
          style={{ fontFamily: activeFont, fontSize: activeSize.font }}
          className="print-page-container max-w-[8.27in] mx-auto bg-white shadow-lg p-6 sm:p-10 border-0 min-h-[11in] text-black leading-normal box-border print:p-0 print:border-none print:shadow-none print:max-w-none"
        >
          {/* Institutional Header (Spans across full width of both columns) */}
          <div className="text-center border-b border-black pb-2 mb-2 select-none [column-span:all]">
            <h1 className="font-black text-2xl text-black leading-tight uppercase tracking-wide">
              {institutionName}
            </h1>
            <h2 className="text-base font-bold text-black mt-0.5 underline">
              {examName}
            </h2>
            <div className="flex justify-center items-center gap-6 sm:gap-10 text-xs font-bold mt-1 px-2 flex-wrap">
              <span>শ্রেণি: {CLASSES.find(c => c.id === selectedClass)?.label || selectedClass} শ্রেণি</span>
              <span>বিষয়: {selectedSubject}</span>
              {selectedChapter !== 'all' && <span>অধ্যায়: {selectedChapter}</span>}
            </div>
            <div className="flex justify-between items-center text-xs font-bold mt-1 px-2 italic">
              <span>সময়: {examTime}</span>
              <span>পূর্ণমান: {examTotalMarks}</span>
            </div>

            {/* When single section (e.g. only MCQ test or only CQ test), display instruction centered across full page width */}
            {isSingleTypeExam && singleTypeInstruction && (
              <div className="text-xs font-bold text-slate-900 mt-1">
                [{singleTypeInstruction}]
              </div>
            )}
          </div>

          {/* Question Flow (1 or 2 columns based on columnLayout) */}
          <div className={cn(
            "print-question-flow gap-5",
            columnLayout === '2' 
              ? "columns-1 md:columns-2 print:columns-2 [column-rule:0.5pt_solid_black]" 
              : "columns-1 print:columns-1"
          )}>
            {/* Section 1: Creative Questions (CQ) - Supports multiple sections (ক, খ, গ, ঘ বিভাগ) */}
            {includeCreative && selectedCreatives.length > 0 && creativeSections.map((sec, secIdx) => {
              const startIdx = Math.max(0, (sec.fromQ || 1) - 1);
              const endIdx = Math.min(selectedCreatives.length, sec.toQ || selectedCreatives.length);
              const secQuestions = selectedCreatives.slice(startIdx, endIdx);

              if (secQuestions.length === 0) return null;

              const showHeader = !isSingleTypeExam || creativeSections.length > 1;

              return (
                <div key={sec.id || secIdx} className="section-block mb-2">
                  {/* Centered Section Header Banner (NO big column-wide line, ONLY section title underline) */}
                  {showHeader && (sec.title || sec.instruction) && (
                    <div className="section-header text-center my-1.5 break-after-avoid break-inside-avoid">
                      {sec.title && (
                        <div className="inline-block font-black text-xs sm:text-sm text-black border-b border-black pb-0.5 uppercase tracking-wide">
                          {sec.title}
                        </div>
                      )}
                      {sec.instruction && (
                        <div className="text-[11px] font-bold italic text-slate-800 mt-0.5">
                          [{sec.instruction}]
                        </div>
                      )}
                    </div>
                  )}
                  <div className="space-y-1">
                    {secQuestions.map((q, idx) => {
                      // Continuous serial numbering across all creative sections: ১, ২, ৩, ৪...
                      const qNum = toBengaliNumber(startIdx + idx + 1);
                      return (
                        <div key={q.id} className="question-item break-inside-avoid text-xs sm:text-[13px] leading-relaxed mb-1">
                          <div className="flex items-start gap-1.5">
                            <span className="font-black text-sm shrink-0">{qNum}।</span>
                            <div 
                              className="flex-1 math-rendered"
                              dangerouslySetInnerHTML={{ __html: formatContentWithBoardMarks(q.content, { subject: selectedSubject }) }}
                            />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}

            {/* Section 2: Multiple Choice Questions (MCQ) */}
            {includeMcq && selectedMcqs.length > 0 && (
              <div className="section-block mb-2">
                {/* Centered Section Header Banner (Omitted if single-type exam) */}
                {!isSingleTypeExam && (mcqTitle || mcqInstruction) && (
                  <div className="section-header text-center my-1.5 break-after-avoid break-inside-avoid">
                    {mcqTitle && (
                      <div className="inline-block font-black text-xs sm:text-sm text-black border-b border-black pb-0.5 uppercase tracking-wide">
                        {mcqTitle}
                      </div>
                    )}
                    {mcqInstruction && (
                      <div className="text-[11px] font-bold italic text-slate-800 mt-0.5">
                        [{mcqInstruction}]
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  {selectedMcqs.map((q, idx) => {
                    const startNum = parseInt(mcqStartSerial, 10) || 1;
                    const qNum = toBengaliNumber(startNum + idx);
                    return (
                      <div key={q.id} className="question-item break-inside-avoid text-xs leading-normal mb-1">
                        <div className="flex items-start gap-1.5">
                          <span className="font-black shrink-0 text-xs">{qNum}।</span>
                          <div className="flex-1 math-rendered">
                            {renderMcqFormatted(q.content, q.options)}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Section 3: Short Questions - ALWAYS starts from 1 by default (১, ২, ৩...) */}
            {includeShort && selectedShorts.length > 0 && (
              <div className="section-block mb-2">
                {/* Centered Section Header Banner (Omitted if single-type exam) */}
                {!isSingleTypeExam && (shortTitle || shortInstruction) && (
                  <div className="section-header text-center my-1.5 break-after-avoid break-inside-avoid">
                    {shortTitle && (
                      <div className="inline-block font-black text-xs sm:text-sm text-black border-b border-black pb-0.5 uppercase tracking-wide">
                        {shortTitle}
                      </div>
                    )}
                    {shortInstruction && (
                      <div className="text-[11px] font-bold italic text-slate-800 mt-0.5">
                        [{shortInstruction}]
                      </div>
                    )}
                  </div>
                )}
                <div className="space-y-1">
                  {selectedShorts.map((q, idx) => {
                    // Strictly starts from 1 for short questions
                    const qNum = toBengaliNumber(idx + 1);
                    return (
                      <div key={q.id} className="question-item break-inside-avoid text-xs sm:text-[13px] leading-relaxed mb-1">
                        <div className="flex items-start gap-1.5">
                          <span className="font-black shrink-0 text-xs">{qNum}।</span>
                          <div 
                            className="flex-1 math-rendered"
                            dangerouslySetInnerHTML={{ __html: formatContentWithBoardMarks(q.content, { isShortQuestion: true }) }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Global Print Stylesheet: ZERO clutter, no grey borders, clean hairlines, custom font */}
        <style dangerouslySetInnerHTML={{ __html: `
          @media print {
            *, *::before, *::after {
              -webkit-print-color-adjust: exact !important;
              print-color-adjust: exact !important;
            }
            html, body, .print-wrapper, .min-h-screen {
              background: #ffffff !important;
              background-color: #ffffff !important;
              color: #000000 !important;
              margin: 0 !important;
              padding: 0 !important;
              width: 100% !important;
              height: auto !important;
              min-height: 0 !important;
              font-family: ${activeFont} !important;
            }
            .no-print, header, nav, footer, button, .app-header, .site-header {
              display: none !important;
            }
            @page {
              size: A4 portrait;
              margin: 8mm 10mm 8mm 10mm;
            }
            .print-page-container {
              width: 100% !important;
              max-width: 100% !important;
              padding: 0 !important;
              margin: 0 !important;
              border: none !important;
              outline: none !important;
              box-shadow: none !important;
              min-height: auto !important;
              height: auto !important;
              background: #ffffff !important;
              background-color: #ffffff !important;
              font-family: ${activeFont} !important;
            }
            .print-question-flow {
              column-count: ${columnLayout} !important;
              column-gap: ${columnLayout === '2' ? '20px' : '0'} !important;
              column-rule: ${columnLayout === '2' ? '0.5pt solid black' : 'none'} !important;
              width: 100% !important;
            }
            .section-block {
              break-inside: auto !important;
              page-break-inside: auto !important;
            }
            .section-header {
              break-inside: avoid !important;
              break-after: avoid !important;
              page-break-after: avoid !important;
              border: none !important;
              border-bottom: none !important;
              margin-top: 4px !important;
              margin-bottom: 4px !important;
              padding: 0 !important;
            }
            .question-item {
              break-inside: avoid !important;
              page-break-inside: avoid !important;
              border: none !important;
              border-bottom: none !important;
              margin-bottom: 4px !important;
            }
            .question-item, .question-item .math-rendered, .question-item div, .question-item span:not(.font-black) {
              font-size: ${activeSize.font} !important;
              line-height: ${activeLeading} !important;
            }
            .question-item span.shrink-0 {
              font-size: ${activeSize.serial} !important;
            }
          }
        ` }} />
      </div>
    );
  }

  // ──────────────────────────────────────────────────────────
  // VIEW 2: QUESTION BANK SELECTION TABLES (ছবির মতো টেবিল ফরমেট)
  // ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-slate-50 font-kalpurush pb-32">
      {/* Top Header */}
      <header className="bg-white border-b border-slate-200 sticky top-0 z-30 shadow-xs">
        <div className="max-w-[1400px] mx-auto px-3 sm:px-6 py-3 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Link href="/create-question">
              <Button variant="ghost" size="sm" className="gap-1 font-bold text-xs h-8">
                <ArrowLeft className="w-3.5 h-3.5" /> প্রশ্ন তৈরি
              </Button>
            </Link>
            <div className="h-4 w-px bg-slate-300" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-lg bg-indigo-600 text-white flex items-center justify-center font-black">
                <BrainCircuit className="w-4 h-4" />
              </div>
              <div>
                <h1 className="text-base sm:text-lg font-black text-indigo-950 leading-tight">
                  টপ গ্রেড প্রশ্ন ব্যাংক (Question Bank)
                </h1>
                <p className="text-[10px] sm:text-xs text-slate-500 font-bold">
                  হাজার হাজার সংরক্ষিত প্রশ্ন থেকে বাচাই করে এক ক্লিকে বোর্ডমানে সরাসরি প্রিন্ট করুন
                </p>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => reloadQuestions()}
              disabled={isSyncingCloud}
              className="font-bold text-xs text-emerald-800 bg-emerald-50 border-emerald-300 hover:bg-emerald-100 h-8 gap-1.5 shadow-2xs"
              title="কেন্দ্রীয় ক্লাউড সার্ভারের সাথে রিয়েলটাইম সিঙ্ক করুন"
            >
              <Cloud className={cn("w-3.5 h-3.5 text-emerald-600", isSyncingCloud && "animate-spin")} />
              <span>{isSyncingCloud ? 'সার্ভার সিঙ্ক হচ্ছে...' : 'সার্ভার সিঙ্ক'}</span>
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setAddModalOpen(true)}
              className="font-bold text-xs text-indigo-700 border-indigo-200 hover:bg-indigo-50 h-8 gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" /> নতুন প্রশ্ন যুক্ত করুন
            </Button>
            <Button
              onClick={handleOpenSetupModal}
              disabled={selectedIds.size === 0}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-8 px-4 gap-1.5 shadow-sm"
            >
              <Printer className="w-3.5 h-3.5" /> প্রশ্নপত্র তৈরি ও সরাসরি প্রিন্ট করুন ({toBengaliNumber(selectedIds.size)})
            </Button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-[1400px] mx-auto px-3 sm:px-6 pt-5 space-y-6">
        {/* Filter Controls Card */}
        <Card className="border border-slate-200 shadow-xs bg-white">
          <CardContent className="p-3 sm:p-5">
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 items-end">
              {/* 1. Class Select */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <BookOpen className="w-3.5 h-3.5 text-indigo-600" /> শ্রেণি নির্বাচন
                </label>
                <Select value={selectedClass} onValueChange={(v) => { setSelectedClass(v); setSelectedChapter('all'); }}>
                  <SelectTrigger className="h-9 text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLASSES.map(c => (
                      <SelectItem key={c.id} value={c.id} className="text-xs font-bold">
                        {c.label} শ্রেণি
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 2. Subject Select */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Layers className="w-3.5 h-3.5 text-indigo-600" /> বিষয় নির্বাচন
                </label>
                <Select value={selectedSubject} onValueChange={(v) => { setSelectedSubject(v); setSelectedChapter('all'); }}>
                  <SelectTrigger className="h-9 text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {availableSubjects.map(s => (
                      <SelectItem key={s} value={s} className="text-xs font-bold">
                        {s}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 3. Chapter Select */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Filter className="w-3.5 h-3.5 text-indigo-600" /> অধ্যায় নির্বাচন
                </label>
                <Select value={selectedChapter} onValueChange={setSelectedChapter}>
                  <SelectTrigger className="h-9 text-xs font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all" className="text-xs font-bold text-indigo-700">
                      ★ সকল অধ্যায় (সব একসাথে)
                    </SelectItem>
                    {availableChapters.map(ch => (
                      <SelectItem key={ch} value={ch} className="text-xs font-bold">
                        {ch}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              {/* 4. Search Filter */}
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-700 flex items-center gap-1">
                  <Search className="w-3.5 h-3.5 text-indigo-600" /> প্রশ্ন বা কি-ওয়ার্ড খুঁজুন
                </label>
                <Input
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  placeholder="যেমন: বাস্তব সংখ্যা, ত্রিভুজ..."
                  className="h-9 text-xs font-bold"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Floating Category Filter Tabs Banner */}
        <div className="bg-indigo-950 text-white rounded-xl p-3 sm:p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5 sm:gap-2 text-xs font-bold">
            {/* Tab 1: All */}
            <button
              type="button"
              onClick={() => setActiveTab('all')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'all'
                  ? "bg-amber-400 text-indigo-950 shadow-sm"
                  : "bg-indigo-900/80 hover:bg-indigo-800 text-white"
              )}
            >
              <span>সকল প্রশ্ন</span>
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-black", activeTab === 'all' ? "bg-indigo-950 text-amber-300" : "bg-black/30 text-white")}>
                {toBengaliNumber(filteredQuestions.length)}
              </span>
            </button>

            {/* Tab 2: Creative (CQ) */}
            <button
              type="button"
              onClick={() => setActiveTab('creative')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'creative'
                  ? "bg-amber-400 text-indigo-950 shadow-sm"
                  : "bg-indigo-800/80 hover:bg-indigo-700 text-white"
              )}
            >
              <span>সৃজনশীল</span>
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-black", activeTab === 'creative' ? "bg-indigo-950 text-amber-300" : "bg-black/30 text-white")}>
                {toBengaliNumber(creativeQuestions.length)}
                {selectedCreatives.length > 0 && ` (নির্বাচিত: ${toBengaliNumber(selectedCreatives.length)})`}
              </span>
            </button>

            {/* Tab 3: MCQ */}
            <button
              type="button"
              onClick={() => setActiveTab('mcq')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'mcq'
                  ? "bg-amber-400 text-indigo-950 shadow-sm"
                  : "bg-indigo-800/80 hover:bg-indigo-700 text-white"
              )}
            >
              <span>বহুনির্বাচনী</span>
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-black", activeTab === 'mcq' ? "bg-indigo-950 text-amber-300" : "bg-black/30 text-white")}>
                {toBengaliNumber(mcqQuestions.length)}
                {selectedMcqs.length > 0 && ` (নির্বাচিত: ${toBengaliNumber(selectedMcqs.length)})`}
              </span>
            </button>

            {/* Tab 4: Short */}
            <button
              type="button"
              onClick={() => setActiveTab('short')}
              className={cn(
                "px-3 py-1.5 rounded-lg font-black transition-all flex items-center gap-1.5 cursor-pointer",
                activeTab === 'short'
                  ? "bg-amber-400 text-indigo-950 shadow-sm"
                  : "bg-indigo-800/80 hover:bg-indigo-700 text-white"
              )}
            >
              <span>সংক্ষিপ্ত</span>
              <span className={cn("px-1.5 py-0.5 rounded text-[10px] font-black", activeTab === 'short' ? "bg-indigo-950 text-amber-300" : "bg-black/30 text-white")}>
                {toBengaliNumber(shortQuestions.length)}
                {selectedShorts.length > 0 && ` (নির্বাচিত: ${toBengaliNumber(selectedShorts.length)})`}
              </span>
            </button>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                if (activeTab === 'creative') handleSelectAllType(creativeQuestions);
                else if (activeTab === 'mcq') handleSelectAllType(mcqQuestions);
                else if (activeTab === 'short') handleSelectAllType(shortQuestions);
                else handleSelectAllVisible();
              }}
              className="text-xs font-bold h-8 text-black bg-white hover:bg-slate-100 border-none"
            >
              {activeTab === 'creative' ? 'সব সৃজনশীল নির্বাচন' : activeTab === 'mcq' ? 'সব বহুনির্বাচনী নির্বাচন' : activeTab === 'short' ? 'সব সংক্ষিপ্ত নির্বাচন' : 'সব নির্বাচন করুন'}
            </Button>
            <Button
              size="sm"
              variant="ghost"
              onClick={handleClearSelection}
              className="text-xs font-bold h-8 text-indigo-200 hover:text-white hover:bg-indigo-800"
            >
              নির্বাচন মুছুন
            </Button>
            <Button
              size="sm"
              onClick={handleOpenSetupModal}
              disabled={selectedIds.size === 0}
              className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-8 px-4 gap-1.5 shadow"
            >
              <Printer className="w-3.5 h-3.5" /> সরাসরি প্রিন্ট করুন ({toBengaliNumber(selectedIds.size)})
            </Button>
          </div>
        </div>

        {/* No questions empty state */}
        {filteredQuestions.length === 0 && (
          <div className="text-center py-16 bg-white rounded-2xl border-2 border-dashed border-slate-300 space-y-3">
            <BrainCircuit className="w-12 h-12 text-slate-300 mx-auto" />
            <p className="text-base font-bold text-slate-700">এই শ্রেণি বা বিষয়ে এখনো কোনো প্রশ্ন ব্যাংকে যুক্ত করা হয়নি।</p>
            <p className="text-xs text-slate-500">
              প্রশ্ন তৈরি (`/create-question`) বা লেকচার শিট পেজ থেকে 'প্রশ্ন ব্যাংকে সংরক্ষণ' বাটনে ক্লিক করে প্রশ্ন যোগ করতে পারেন।
            </p>
            <div className="pt-2 flex justify-center gap-3">
              <Button onClick={() => setAddModalOpen(true)} className="font-bold text-xs gap-1.5 bg-indigo-600 hover:bg-indigo-700 text-white">
                <Plus className="w-3.5 h-3.5" /> নতুন প্রশ্ন লিখুন
              </Button>
            </div>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* TABLE 1: বহুনির্বাচনী প্রশ্ন (MCQ TABLE)                     */}
        {/* ────────────────────────────────────────────────────────── */}
        {(activeTab === 'all' || activeTab === 'mcq') && mcqQuestions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border-2 border-black overflow-hidden">
            <table className="w-full border-collapse text-black">
              <thead>
                <tr className="border-b-2 border-black bg-slate-100">
                  <th className="w-[12%] text-center font-black text-xs sm:text-sm py-2.5 px-2 border-r-2 border-black">
                    ক্রমিক নং
                  </th>
                  <th className="text-center font-black text-xs sm:text-sm py-2.5 px-4 border-r-2 border-black flex-1">
                    বহুনির্বাচনী প্রশ্ন ({toBengaliNumber(mcqQuestions.length)}টি)
                  </th>
                  <th className="w-[18%] sm:w-[15%] text-center font-black text-xs sm:text-sm py-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllType(mcqQuestions)}
                      className="hover:underline flex items-center justify-center gap-1 mx-auto"
                      title="সবগুলো নির্বাচন করুন"
                    >
                      টিক চিহ্ন দিয়ে নির্বাচন করুন
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {mcqQuestions.map((q) => {
                  const isChecked = selectedIds.has(q.id);
                  return (
                    <tr
                      key={q.id}
                      onClick={() => toggleSelect(q.id)}
                      className={cn(
                        "border-b border-black hover:bg-indigo-50/40 cursor-pointer transition-colors select-none",
                        isChecked && "bg-indigo-50/70"
                      )}
                    >
                      {/* Column 1: Serial No */}
                      <td className="text-center font-bold text-sm sm:text-base py-3 px-2 border-r-2 border-black align-top">
                        {toBengaliNumber(q.serialNo)}।
                      </td>

                      {/* Column 2: Question Content with formatted options */}
                      <td className="py-3 px-3 sm:px-4 border-r-2 border-black align-top text-xs sm:text-sm leading-relaxed">
                        <div className="font-medium text-slate-900 math-rendered">
                          {renderMcqFormatted(q.content, q.options)}
                        </div>
                        <div className="text-[10px] text-slate-400 font-bold mt-1.5 flex items-center justify-between">
                          <span>অধ্যায়: {q.chapter}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuestion(q.id);
                            }}
                            className="text-red-500 hover:text-red-700 hover:underline text-[10px]"
                          >
                            মুছুন
                          </button>
                        </div>
                      </td>

                      {/* Column 3: Checkbox */}
                      <td className="text-center py-3 px-2 align-middle">
                        <div className="flex justify-center items-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 sm:w-6 sm:h-6 accent-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* TABLE 2: সৃজনশীল প্রশ্ন (CREATIVE TABLE)                    */}
        {/* ────────────────────────────────────────────────────────── */}
        {(activeTab === 'all' || activeTab === 'creative') && creativeQuestions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border-2 border-black overflow-hidden">
            <table className="w-full border-collapse text-black">
              <thead>
                <tr className="border-b-2 border-black bg-slate-100">
                  <th className="w-[12%] text-center font-black text-xs sm:text-sm py-2.5 px-2 border-r-2 border-black">
                    ক্রমিক নং
                  </th>
                  <th className="text-center font-black text-xs sm:text-sm py-2.5 px-4 border-r-2 border-black flex-1">
                    সৃজনশীল প্রশ্ন ({toBengaliNumber(creativeQuestions.length)}টি)
                  </th>
                  <th className="w-[18%] sm:w-[15%] text-center font-black text-xs sm:text-sm py-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllType(creativeQuestions)}
                      className="hover:underline flex items-center justify-center gap-1 mx-auto"
                      title="সবগুলো নির্বাচন করুন"
                    >
                      টিক চিহ্ন দিয়ে নির্বাচন করুন
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {creativeQuestions.map((q) => {
                  const isChecked = selectedIds.has(q.id);
                  return (
                    <tr
                      key={q.id}
                      onClick={() => toggleSelect(q.id)}
                      className={cn(
                        "border-b border-black hover:bg-indigo-50/40 cursor-pointer transition-colors select-none",
                        isChecked && "bg-indigo-50/70"
                      )}
                    >
                      {/* Column 1: Serial No */}
                      <td className="text-center font-bold text-sm sm:text-base py-3 px-2 border-r-2 border-black align-top">
                        {toBengaliNumber(q.serialNo)}।
                      </td>

                      {/* Column 2: Question Content */}
                      <td className="py-2.5 px-3 sm:px-4 border-r-2 border-black align-top text-xs sm:text-sm leading-relaxed">
                        <div 
                          className="font-medium text-slate-900 math-rendered space-y-0.5"
                          dangerouslySetInnerHTML={{ __html: formatContentWithBoardMarks(q.content, { subject: selectedSubject }) }}
                        />
                        <div className="text-[10px] text-slate-400 font-bold mt-1.5 flex items-center justify-between">
                          <span>অধ্যায়: {q.chapter}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuestion(q.id);
                            }}
                            className="text-red-500 hover:text-red-700 hover:underline text-[10px]"
                          >
                            মুছুন
                          </button>
                        </div>
                      </td>

                      {/* Column 3: Checkbox */}
                      <td className="text-center py-3 px-2 align-middle">
                        <div className="flex justify-center items-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 sm:w-6 sm:h-6 accent-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* ────────────────────────────────────────────────────────── */}
        {/* TABLE 3: সংক্ষিপ্ত প্রশ্ন (SHORT QUESTIONS TABLE)             */}
        {/* ────────────────────────────────────────────────────────── */}
        {(activeTab === 'all' || activeTab === 'short') && shortQuestions.length > 0 && (
          <div className="bg-white rounded-lg shadow-sm border-2 border-black overflow-hidden">
            <table className="w-full border-collapse text-black">
              <thead>
                <tr className="border-b-2 border-black bg-slate-100">
                  <th className="w-[12%] text-center font-black text-xs sm:text-sm py-2.5 px-2 border-r-2 border-black">
                    ক্রমিক নং
                  </th>
                  <th className="text-center font-black text-xs sm:text-sm py-2.5 px-4 border-r-2 border-black flex-1">
                    সংক্ষিপ্ত প্রশ্ন ({toBengaliNumber(shortQuestions.length)}টি)
                  </th>
                  <th className="w-[18%] sm:w-[15%] text-center font-black text-xs sm:text-sm py-2.5 px-2">
                    <button
                      type="button"
                      onClick={() => handleSelectAllType(shortQuestions)}
                      className="hover:underline flex items-center justify-center gap-1 mx-auto"
                      title="সবগুলো নির্বাচন করুন"
                    >
                      টিক চিহ্ন দিয়ে নির্বাচন করুন
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {shortQuestions.map((q) => {
                  const isChecked = selectedIds.has(q.id);
                  return (
                    <tr
                      key={q.id}
                      onClick={() => toggleSelect(q.id)}
                      className={cn(
                        "border-b border-black hover:bg-indigo-50/40 cursor-pointer transition-colors select-none",
                        isChecked && "bg-indigo-50/70"
                      )}
                    >
                      {/* Column 1: Serial No */}
                      <td className="text-center font-bold text-sm sm:text-base py-3 px-2 border-r-2 border-black align-top">
                        {toBengaliNumber(q.serialNo)}।
                      </td>

                      {/* Column 2: Question Content */}
                      <td className="py-2.5 px-3 sm:px-4 border-r-2 border-black align-top text-xs sm:text-sm leading-relaxed">
                        <div 
                          className="font-medium text-slate-900 math-rendered space-y-0.5"
                          dangerouslySetInnerHTML={{ __html: formatContentWithBoardMarks(q.content, { isShortQuestion: true }) }}
                        />
                        <div className="text-[10px] text-slate-400 font-bold mt-1 flex items-center justify-between">
                          <span>অধ্যায়: {q.chapter}</span>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeleteQuestion(q.id);
                            }}
                            className="text-red-500 hover:text-red-700 hover:underline text-[10px]"
                          >
                            মুছুন
                          </button>
                        </div>
                      </td>

                      {/* Column 3: Checkbox */}
                      <td className="text-center py-3 px-2 align-middle">
                        <div className="flex justify-center items-center">
                          <input
                            type="checkbox"
                            checked={isChecked}
                            onChange={() => toggleSelect(q.id)}
                            onClick={(e) => e.stopPropagation()}
                            className="w-5 h-5 sm:w-6 sm:h-6 accent-indigo-600 rounded cursor-pointer"
                          />
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ── POPUP MODAL: BOARD EXAM CONFIGURATION (বোর্ড সেটআপ ও বিভাগ নির্ধারণ) ── */}
      <Dialog open={setupModalOpen} onOpenChange={setSetupModalOpen}>
        <DialogContent className="max-w-xl font-kalpurush bg-white border-2 border-indigo-200 max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-indigo-950 border-b pb-2">
              <Settings2 className="w-5 h-5 text-indigo-600" /> বোর্ড প্রশ্নপত্র প্রস্তুত ও বিভাগীয় সেটআপ
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* Top Exam Header Settings */}
            <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
              <span className="font-black text-slate-800 text-xs">১. পরীক্ষার মূল তথ্য (স্বয়ংক্রিয় প্রস্তুত)</span>
              <div className="grid grid-cols-2 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">প্রতিষ্ঠানের নাম</label>
                  <Input value={institutionName} onChange={e => setInstitutionName(e.target.value)} className="h-8 font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">পরীক্ষার নাম</label>
                  <Input value={examName} onChange={e => setExamName(e.target.value)} className="h-8 font-bold" />
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">পরীক্ষার সময়</label>
                  <Input value={examTime} onChange={e => setExamTime(e.target.value)} className="h-8 font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">পূর্ণমান</label>
                  <Input value={examTotalMarks} onChange={e => setExamTotalMarks(e.target.value)} className="h-8 font-bold" />
                </div>
                <div className="space-y-1">
                  <label className="font-bold text-slate-700 flex items-center gap-1">
                    <Columns className="w-3.5 h-3.5 text-indigo-600" /> কলাম সংখ্যা (লেআউট)
                  </label>
                  <Select value={columnLayout} onValueChange={(v: '1' | '2') => setColumnLayout(v)}>
                    <SelectTrigger className="h-8 font-bold text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="2" className="text-xs font-bold">২ কলাম (বোর্ড স্ট্যান্ডার্ড - ডিফল্ট)</SelectItem>
                      <SelectItem value="1" className="text-xs font-bold">১ কলাম (ফুল পেজ লেআউট)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Typography & Font Settings (২. প্রিন্ট লেখার ফন্ট ও সাইজ নির্ধারণ) */}
            <div className="p-3 bg-indigo-50/60 rounded-xl border border-indigo-200 space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-black text-indigo-950 text-xs flex items-center gap-1.5">
                  <Type className="w-4 h-4 text-indigo-600" /> ২. প্রিন্ট লেখার ফন্ট ও সাইজ নির্ধারণ
                </span>
                <span className="text-[10px] text-indigo-700 bg-white px-2 py-0.5 rounded border border-indigo-200 font-bold">
                  কাস্টম ফন্ট ও সাইজ
                </span>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                {/* Font Size (starts from 8px) */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">ফন্ট সাইজ (লেখার আকার)</label>
                  <Select value={printFontSize} onValueChange={(v: any) => setPrintFontSize(v)}>
                    <SelectTrigger className="h-8 font-bold text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {Object.entries(FONT_SIZE_CONFIG).map(([val, cfg]) => (
                        <SelectItem key={val} value={val} className="text-xs font-bold">
                          {cfg.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Font Family */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">ফন্ট পরিবার (লিপি)</label>
                  <Select value={printFontFamily} onValueChange={(v: any) => setPrintFontFamily(v)}>
                    <SelectTrigger className="h-8 font-bold text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="kalpurush" className="text-xs font-bold">কালপুরুষ (Kalpurush - ডিফল্ট)</SelectItem>
                      <SelectItem value="solaiman" className="text-xs font-bold">সোলাইমান লিপি (SolaimanLipi)</SelectItem>
                      <SelectItem value="nikosh" className="text-xs font-bold">নিকোশ (Nikosh)</SelectItem>
                      <SelectItem value="sans" className="text-xs font-bold">সিস্টেম বাংলা (Bangla Sans)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>

                {/* Line Height */}
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">লাইনের ফাঁকা (স্পেসিং)</label>
                  <Select value={printLineSpacing} onValueChange={(v: any) => setPrintLineSpacing(v)}>
                    <SelectTrigger className="h-8 font-bold text-xs bg-white"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="compact" className="text-xs font-bold">আঁটসাঁট / কম্প্যাক্ট</SelectItem>
                      <SelectItem value="normal" className="text-xs font-bold">স্বাভাবিক (বোর্ড মান)</SelectItem>
                      <SelectItem value="relaxed" className="text-xs font-bold">আরামদায়ক (বেশি ফাঁকা)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </div>

            {/* Section 1 Setup: Creative (ক-বিভাগ, খ-বিভাগ ইত্যাদি - একাধিক বিভাগ সাপোর্ট) */}
            <div className={cn("p-3 rounded-xl border space-y-3 transition-all", includeCreative ? "bg-indigo-50/50 border-indigo-200" : "bg-slate-50 border-slate-200 opacity-70")}>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="flex items-center gap-2 font-black text-indigo-950 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeCreative}
                    onChange={e => setIncludeCreative(e.target.checked)}
                    className="w-4 h-4 accent-indigo-600 rounded"
                  />
                  <span>৩. সৃজনশীল বিভাগ (একাধিক বিভাগ যোগ করার সুবিধা)</span>
                </label>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", selectedCreatives.length > 0 ? "bg-indigo-100 text-indigo-800" : "bg-slate-200 text-slate-600")}>
                  {selectedCreatives.length > 0 ? `নির্বাচিত: ${toBengaliNumber(selectedCreatives.length)}টি প্রশ্ন` : 'বর্তমানে নির্বাচিত নেই'}
                </span>
              </div>

              {includeCreative && (
                <div className="space-y-3 pt-1">
                  {/* Preset & Add Section Action Buttons */}
                  <div className="flex flex-wrap items-center gap-1.5 p-1.5 bg-white rounded-lg border border-indigo-100">
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleAddCreativeSection}
                      className="text-[11px] font-bold h-7 gap-1 text-indigo-700 border-indigo-300 hover:bg-indigo-50"
                    >
                      <Plus className="w-3.5 h-3.5" /> + আরেকটি বিভাগ যোগ করুন
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleApplyBoard4SectionPreset}
                      className="text-[11px] font-bold h-7 gap-1 text-purple-700 border-purple-300 hover:bg-purple-50"
                    >
                      <Split className="w-3.5 h-3.5" /> বোর্ড ৪-বিভাগ (বীজগণিত, জ্যামিতি...)
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={handleResetToSingleSection}
                      className="text-[11px] font-bold h-7 text-slate-600 hover:text-slate-900"
                    >
                      একক বিভাগ (রিসেট)
                    </Button>
                  </div>

                  {/* Render Creative Sections list */}
                  {creativeSections.map((sec, secIdx) => (
                    <div key={sec.id} className="p-2.5 bg-white rounded-lg border border-indigo-200 space-y-2 shadow-2xs">
                      <div className="flex items-center justify-between border-b pb-1">
                        <span className="font-black text-xs text-indigo-950 flex items-center gap-1.5">
                          <span className="w-5 h-5 rounded bg-indigo-600 text-white flex items-center justify-center text-[10px]">
                            {toBengaliNumber(secIdx + 1)}
                          </span>
                          বিভাগ {toBengaliNumber(secIdx + 1)}: {sec.title || 'শিরোনামহীন'}
                        </span>
                        {creativeSections.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemoveCreativeSection(sec.id)}
                            className="text-red-500 hover:text-red-700 text-[11px] font-bold flex items-center gap-0.5 hover:underline"
                          >
                            <Trash2 className="w-3 h-3" /> বিভাগ মুছুন
                          </button>
                        )}
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-2">
                        <div className="sm:col-span-2 space-y-1">
                          <label className="font-bold text-slate-700 text-[11px]">বিভাগের শিরোনাম</label>
                          <Input 
                            value={sec.title} 
                            onChange={e => handleUpdateCreativeSection(sec.id, 'title', e.target.value)} 
                            placeholder="যেমন: ক-বিভাগ: বীজগণিত"
                            className="h-7 text-xs font-bold" 
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 text-[11px]">প্রশ্ন পরিসীমা</label>
                          <div className="flex items-center gap-1">
                            <Input 
                              type="number" 
                              value={sec.fromQ} 
                              onChange={e => handleUpdateCreativeSection(sec.id, 'fromQ', parseInt(e.target.value, 10) || 1)} 
                              className="h-7 text-xs font-bold text-center px-1" 
                            />
                            <span className="text-slate-400 font-bold">-</span>
                            <Input 
                              type="number" 
                              value={sec.toQ} 
                              onChange={e => handleUpdateCreativeSection(sec.id, 'toQ', parseInt(e.target.value, 10) || 1)} 
                              className="h-7 text-xs font-bold text-center px-1" 
                            />
                          </div>
                        </div>
                        <div className="space-y-1">
                          <label className="font-bold text-slate-700 text-[11px]">শুরুর ক্রমিক</label>
                          <div className="h-7 px-2 bg-slate-100 rounded border border-slate-300 flex items-center justify-center font-bold text-xs text-indigo-700">
                            {toBengaliNumber(sec.fromQ || (secIdx + 1))} (ক্রমান্বয়ে)
                          </div>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="font-bold text-slate-700 text-[11px]">উত্তর দেওয়ার নির্দেশনা</label>
                        <Input 
                          value={sec.instruction} 
                          onChange={e => handleUpdateCreativeSection(sec.id, 'instruction', e.target.value)} 
                          placeholder="যেমন: যেকোনো ২টি প্রশ্নের উত্তর দাও: ২ × ১০ = ২০"
                          className="h-7 text-xs font-bold" 
                        />
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Section 2 Setup: MCQ (খ-বিভাগ) */}
            <div className={cn("p-3 rounded-xl border space-y-2 transition-all", includeMcq ? "bg-amber-50/50 border-amber-200" : "bg-slate-50 border-slate-200 opacity-70")}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 font-black text-amber-950 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeMcq}
                    onChange={e => setIncludeMcq(e.target.checked)}
                    className="w-4 h-4 accent-amber-600 rounded"
                  />
                  <span>৪. বহুনির্বাচনী বিভাগ (MCQ)</span>
                </label>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", selectedMcqs.length > 0 ? "bg-amber-100 text-amber-800" : "bg-slate-200 text-slate-600")}>
                  {selectedMcqs.length > 0 ? `নির্বাচিত: ${toBengaliNumber(selectedMcqs.length)}টি প্রশ্ন` : 'বর্তমানে নির্বাচিত নেই'}
                </span>
              </div>
              {includeMcq && (
                <>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="col-span-2 space-y-1">
                      <label className="font-bold text-slate-700">বিভাগের শিরোনাম</label>
                      <Input value={mcqTitle} onChange={e => setMcqTitle(e.target.value)} className="h-8 font-bold" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700">শুরুর ক্রমিক</label>
                      <Input value={mcqStartSerial} onChange={e => setMcqStartSerial(e.target.value)} className="h-8 font-bold text-center" />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">উত্তর দেওয়ার নির্দেশনা</label>
                    <Input value={mcqInstruction} onChange={e => setMcqInstruction(e.target.value)} className="h-8 font-bold" />
                  </div>
                </>
              )}
            </div>

            {/* Section 3 Setup: Short (গ-বিভাগ) - Serial always starts from 1 */}
            <div className={cn("p-3 rounded-xl border space-y-2 transition-all", includeShort ? "bg-emerald-50/50 border-emerald-200" : "bg-slate-50 border-slate-200 opacity-70")}>
              <div className="flex items-center justify-between">
                <label className="flex items-center gap-2 font-black text-emerald-950 text-xs cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeShort}
                    onChange={e => setIncludeShort(e.target.checked)}
                    className="w-4 h-4 accent-emerald-600 rounded"
                  />
                  <span>৫. সংক্ষিপ্ত প্রশ্ন বিভাগ</span>
                </label>
                <span className={cn("text-[10px] font-bold px-2 py-0.5 rounded", selectedShorts.length > 0 ? "bg-emerald-100 text-emerald-800" : "bg-slate-200 text-slate-600")}>
                  {selectedShorts.length > 0 ? `নির্বাচিত: ${toBengaliNumber(selectedShorts.length)}টি প্রশ্ন` : 'বর্তমানে নির্বাচিত নেই'}
                </span>
              </div>
              {includeShort && (
                <>
                  <div className="grid grid-cols-3 gap-2 pt-1">
                    <div className="col-span-2 space-y-1">
                      <label className="font-bold text-slate-700">বিভাগের শিরোনাম</label>
                      <Input value={shortTitle} onChange={e => setShortTitle(e.target.value)} className="h-8 font-bold" />
                    </div>
                    <div className="space-y-1">
                      <label className="font-bold text-slate-700 flex items-center justify-between">
                        <span>শুরুর ক্রমিক</span>
                        <span className="text-[10px] text-emerald-700 font-bold">(ডিফল্ট ১)</span>
                      </label>
                      <Input 
                        value={shortStartSerial} 
                        onChange={e => setShortStartSerial(e.target.value)} 
                        className="h-8 font-bold text-center bg-white border-emerald-300" 
                      />
                    </div>
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-slate-700">উত্তর দেওয়ার নির্দেশনা</label>
                    <Input value={shortInstruction} onChange={e => setShortInstruction(e.target.value)} className="h-8 font-bold" />
                  </div>
                  <div className="text-[10px] font-bold text-emerald-800 bg-emerald-100/70 p-1.5 rounded">
                    ★ সংক্ষিপ্ত প্রশ্নের ক্রমিক বোর্ড মান অনুযায়ী সব সময় ১ থেকে শুরু হবে।
                  </div>
                </>
              )}
            </div>

            <div className="p-2.5 bg-blue-50 text-blue-900 rounded-lg text-[11px] font-bold">
              ✓ প্রশ্নপত্রটি স্বয়ংক্রিয়ভাবে ২-কলাম বোর্ড লেআউটে এবং উপ-প্রশ্নের মানগুলো (২, ৪, ৪) নিখুঁতভাবে এক লাইনে সারিবদ্ধ হয়ে প্রিন্ট হবে।
            </div>
          </div>

          <DialogFooter className="gap-2 border-t pt-3">
            <Button variant="outline" size="sm" onClick={() => setSetupModalOpen(false)}>বাতিল</Button>
            <Button size="sm" onClick={handleConfirmAndProceedToPrint} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-5 gap-1.5 shadow-sm">
              <Printer className="w-4 h-4" /> প্রশ্নপত্র প্রস্তুত ও প্রিন্ট ভিউ দেখুন ↗
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add New Question Modal */}
      <Dialog open={addModalOpen} onOpenChange={setAddModalOpen}>
        <DialogContent className="max-w-lg font-kalpurush bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-black flex items-center gap-2 text-indigo-900">
              <Plus className="w-5 h-5 text-indigo-600" /> প্রশ্ন ব্যাংকে নতুন প্রশ্ন যুক্ত করুন
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">প্রশ্নের ধরণ</label>
                <Select value={newType} onValueChange={(v: any) => setNewType(v)}>
                  <SelectTrigger className="h-8 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="creative">সৃজনশীল প্রশ্ন</SelectItem>
                    <SelectItem value="mcq">বহুনির্বাচনী প্রশ্ন (MCQ)</SelectItem>
                    <SelectItem value="short">সংক্ষিপ্ত প্রশ্ন</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">শ্রেণি</label>
                <Select value={newClass} onValueChange={setNewClass}>
                  <SelectTrigger className="h-8 font-bold"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {CLASSES.map(c => <SelectItem key={c.id} value={c.id}>{c.label} শ্রেণি</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">বিষয়</label>
                <Input value={newSubject} onChange={e => setNewSubject(e.target.value)} placeholder="বিষয়..." className="h-8 font-bold" />
              </div>
              <div className="space-y-1">
                <label className="font-bold text-slate-700">অধ্যায়</label>
                <Input value={newChapter} onChange={e => setNewChapter(e.target.value)} placeholder="অধ্যায়..." className="h-8 font-bold" />
              </div>
            </div>

            <div className="space-y-1">
              <label className="font-bold text-slate-700">প্রশ্নের বিবরণ ও ক, খ, গ, ঘ বা অপশন</label>
              <Textarea
                value={newContent}
                onChange={e => setNewContent(e.target.value)}
                placeholder="উদ্দীপক এবং ক, খ, গ, ঘ লিখুন বা বহুনির্বাচনী প্রশ্ন ও ৪টি অপশন লিখুন..."
                className="min-h-[140px] font-bold leading-relaxed text-xs"
              />
            </div>
            <p className="text-[11px] text-slate-500 italic">
              * সংরক্ষিত হওয়ার সময় এই শ্রেণি, বিষয় ও অধ্যায়ের ক্রমিক নং স্বয়ংক্রিয়ভাবে পরবর্তী ক্রমিকে সেভ হবে।
            </p>
          </div>

          <DialogFooter className="gap-2">
            <Button variant="outline" size="sm" onClick={() => setAddModalOpen(false)}>বাতিল</Button>
            <Button size="sm" onClick={handleAddNewQuestion} className="bg-indigo-600 hover:bg-indigo-700 text-white font-black px-4">
              সংরক্ষণ করুন
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <style dangerouslySetInnerHTML={{ __html: `
        .math-rendered .katex { font-size: 1.05em; line-height: 1.2; text-indent: 0; }
        .math-rendered .katex-display { margin: 0.5em 0; overflow-x: auto; overflow-y: hidden; }
        .math-rendered .math-frac { display: inline-flex; flex-direction: column; vertical-align: middle; text-align: center; font-size: 0.88em; margin: 0 2px; }
        .math-rendered .math-num { border-bottom: 1px solid currentColor; padding: 0 2px; }
        .math-rendered .math-den { padding: 0 2px; }
        .math-rendered sub { font-size: 0.75em; vertical-align: sub; line-height: 0; }
        .math-rendered sup { font-size: 0.75em; vertical-align: super; line-height: 0; }
      ` }} />
    </div>
  );
}

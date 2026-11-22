'use client';

import React, { useState } from 'react';
import { Card, CardHeader, CardTitle, CardContent, CardDescription, CardFooter } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { 
  Award, 
  Sparkles, 
  Loader2, 
  CheckCircle2, 
  Copy, 
  Check, 
  PlusCircle, 
  Building2, 
  Calendar, 
  BookOpen, 
  HelpCircle, 
  FileText,
  AlertCircle
} from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { generateBoardQuestions, GenerateBoardQuestionsOutput } from '@/ai/flows/generate-board-questions';

const BOARDS = [
  'দিনাজপুর বোর্ড',
  'ঢাকা বোর্ড',
  'রাজশাহী বোর্ড',
  'কুমিল্লা বোর্ড',
  'চট্টগ্রাম বোর্ড',
  'বরিশাল বোর্ড',
  'সিলেট বোর্ড',
  'যশোর বোর্ড',
  'ময়মনসিংহ বোর্ড',
  'মাদ্রাসা শিক্ষা বোর্ড',
  'কারিগরি শিক্ষা বোর্ড',
];

const EXAMS = [
  'এসএসসি (SSC)',
  'দাখিল (Dakhil)',
  'এইচএসসি (HSC)',
  'আলিম (Alim)',
  'জেএসসি (JSC)',
  '১০ম শ্রেণি',
  '৯ম শ্রেণি',
  '৮ম শ্রেণি',
  '৭ম শ্রেণি',
  '৬ষ্ঠ শ্রেণি',
];

const YEARS = [
  '২০২৪',
  '২০২৩',
  '২০২২',
  '২০২১',
  '২০২০',
  '২০১৯',
  '২০১৮',
  '২০১৭',
  '২০১৬',
  '২০১৫',
];

const COMMON_SUBJECTS = [
  'বাংলা ১ম পত্র',
  'বাংলা ২য় পত্র',
  'English 1st Paper',
  'English 2nd Paper',
  'গণিত',
  'পদার্থবিজ্ঞান',
  'রসায়ন',
  'জীববিজ্ঞান',
  'উচ্চতর গণিত',
  'সাধারণ বিজ্ঞান',
  'বাংলাদেশ ও বিশ্বপরিচয়',
  'ইসলাম ও নৈতিক শিক্ষা',
  'হিন্দুধর্ম ও নৈতিক শিক্ষা',
  'তথ্য ও যোগাযোগ প্রযুক্তি',
  'কৃষি শিক্ষা',
  'হিসাববিজ্ঞান',
  'ব্যবসায় উদ্যোগ',
  'ফিন্যান্স ও ব্যাংকিং',
];

interface BoardQuestionSectionProps {
  onInsertQuestions?: (questions: Array<{ type: 'creative' | 'short' | 'mcq'; content: string }>, rawText?: string) => void;
  className?: string;
  defaultSubject?: string;
  defaultClassId?: string;
}

export function BoardQuestionSection({
  onInsertQuestions,
  className = '',
  defaultSubject = '',
  defaultClassId = '',
}: BoardQuestionSectionProps) {
  const { toast } = useToast();

  const [examName, setExamName] = useState(defaultClassId ? `${defaultClassId} শ্রেণি` : 'এসএসসি (SSC)');
  const [board, setBoard] = useState('দিনাজপুর বোর্ড');
  const [year, setYear] = useState('২০২৪');
  const [subject, setSubject] = useState(defaultSubject || 'পদার্থবিজ্ঞান');
  const [chapter, setChapter] = useState('');
  const [type, setType] = useState<'mcq' | 'creative' | 'short' | 'english' | 'all'>('mcq');

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<GenerateBoardQuestionsOutput | null>(null);
  const [copied, setCopied] = useState(false);

  const handleGenerate = async () => {
    if (!board || !year || !subject) {
      toast({
        variant: 'destructive',
        title: 'অসম্পূর্ণ তথ্য',
        description: 'দয়া করে বোর্ড, সাল ও বিষয় নির্বাচন করুন।',
      });
      return;
    }

    setLoading(true);
    try {
      const data = await generateBoardQuestions({
        examName,
        board,
        year,
        subject,
        chapter: chapter.trim() || undefined,
        type,
      });

      setResult(data);
      toast({
        title: 'বোর্ড প্রশ্ন প্রস্তুত! 🏛️',
        description: `${board}-এর ${subject} (${year}) বিষয়ের প্রশ্ন প্রস্তুত করা হয়েছে।`,
      });
    } catch (err: any) {
      toast({
        variant: 'destructive',
        title: 'ত্রুটি',
        description: err.message || 'বোর্ড প্রশ্ন তৈরি করা যায়নি।',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleCopy = () => {
    if (!result?.formattedText) return;
    navigator.clipboard.writeText(result.formattedText);
    setCopied(true);
    toast({ title: 'কপি হয়েছে!', description: 'প্রশ্নমালা ক্লিপবোর্ডে কপি করা হয়েছে।' });
    setTimeout(() => setCopied(false), 2000);
  };

  const handleInsert = () => {
    if (!result || !onInsertQuestions) return;
    onInsertQuestions(result.questions, result.formattedText);
    toast({
      title: 'প্রশ্নপত্রে যুক্ত করা হয়েছে! ✍️',
      description: 'বোর্ড প্রশ্ন সফলভাবে আপনার প্রশ্নপত্রে যুক্ত হয়েছে।',
    });
  };

  return (
    <Card className={`border-2 border-amber-300 shadow-md bg-white font-kalpurush ${className}`}>
      <CardHeader className="bg-gradient-to-r from-amber-50 via-orange-50 to-amber-100/70 border-b border-amber-200 py-3.5 px-4 sm:px-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-600 text-white shadow-xs">
              <Award className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base sm:text-lg font-black text-amber-950 flex items-center gap-2">
                বোর্ড প্রশ্ন ব্যাংক ও এআই জেনারেটর
                <Badge variant="outline" className="bg-amber-200/80 text-amber-900 border-amber-400 text-[10px] font-bold">
                  বোর্ড স্পেসিফিক
                </Badge>
              </CardTitle>
              <CardDescription className="text-xs text-amber-800/80 font-bold mt-0.5">
                শুধু নিশ্চিত ও যাচাইকৃত বোর্ড প্রশ্ন — কোনো অনুমান বা অন্য বোর্ডের প্রশ্ন নয়
              </CardDescription>
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="p-4 sm:p-6 space-y-5">
        {/* Rules Disclaimer Alert Box */}
        <div className="p-3 bg-amber-50/80 rounded-xl border border-amber-200 text-xs text-amber-900 space-y-1 font-bold">
          <div className="flex items-center gap-1.5 text-amber-800 font-black">
            <AlertCircle className="w-4 h-4 shrink-0 text-amber-600" />
            <span>কঠোর শর্তাবলী ও প্রম্পট নিয়ম:</span>
          </div>
          <ul className="list-disc list-inside space-y-0.5 pl-1 text-[11.5px] font-medium text-amber-900">
            <li>শুধু নির্বাচিত বোর্ডের নির্দিষ্ট সালের প্রশ্ন আসবে, অন্য কোনো বোর্ডের প্রশ্ন আসবে না।</li>
            <li>MCQ-এর ৪টি অপশন এক লাইনে পাশাপাশি থাকবে এবং সঠিক উত্তর শেষে উত্তরমালায় থাকবে।</li>
            <li>CQ-এর উদ্দীপক ও ক, খ, গ, ঘ শেষে কোন সাল ও বোর্ডের তা উল্লেখ থাকবে।</li>
            <li><strong>কোনো প্রশ্নের বোর্ড সম্পর্কে নিশ্চিত না হলে সেটি বাদ দেওয়া হবে, অনুমান করে লেখা হবে না।</strong></li>
          </ul>
        </div>

        {/* Form Controls Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
          {/* Exam Name */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1">
              <BookOpen className="w-3.5 h-3.5 text-amber-600" /> পরীক্ষার নাম / শ্রেণি
            </label>
            <Select value={examName} onValueChange={setExamName}>
              <SelectTrigger className="h-9 font-bold text-xs bg-slate-50 border-amber-200">
                <SelectValue placeholder="পরীক্ষা নির্বাচন করুন" />
              </SelectTrigger>
              <SelectContent>
                {EXAMS.map((e) => (
                  <SelectItem key={e} value={e} className="text-xs font-bold">{e}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Board */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1">
              <Building2 className="w-3.5 h-3.5 text-amber-600" /> শিক্ষা বোর্ড
            </label>
            <Select value={board} onValueChange={setBoard}>
              <SelectTrigger className="h-9 font-bold text-xs bg-slate-50 border-amber-200">
                <SelectValue placeholder="বোর্ড নির্বাচন করুন" />
              </SelectTrigger>
              <SelectContent>
                {BOARDS.map((b) => (
                  <SelectItem key={b} value={b} className="text-xs font-bold">{b}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Year */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1">
              <Calendar className="w-3.5 h-3.5 text-amber-600" /> পরীক্ষার সাল
            </label>
            <Select value={year} onValueChange={setYear}>
              <SelectTrigger className="h-9 font-bold text-xs bg-slate-50 border-amber-200">
                <SelectValue placeholder="সাল নির্বাচন করুন" />
              </SelectTrigger>
              <SelectContent>
                {YEARS.map((y) => (
                  <SelectItem key={y} value={y} className="text-xs font-bold">{y}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-700 flex items-center gap-1">
              <FileText className="w-3.5 h-3.5 text-amber-600" /> বিষয়
            </label>
            <Select value={subject} onValueChange={setSubject}>
              <SelectTrigger className="h-9 font-bold text-xs bg-slate-50 border-amber-200">
                <SelectValue placeholder="বিষয় নির্বাচন করুন" />
              </SelectTrigger>
              <SelectContent>
                {COMMON_SUBJECTS.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs font-bold">{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Row 2: Chapter & Question Type */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5 pt-1">
          {/* Chapter / Topic (Optional) */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-700">অধ্যায় / বিষয়বস্তু (ঐচ্ছিক)</label>
            <Input 
              value={chapter}
              onChange={(e) => setChapter(e.target.value)}
              placeholder="যেমন: বল ও গতির সমীকরণ, ১ম অধ্যায়, ইত্যাদি..."
              className="h-9 text-xs font-bold bg-slate-50 border-amber-200"
            />
          </div>

          {/* Question Type */}
          <div className="space-y-1">
            <label className="text-xs font-black text-slate-700">প্রশ্নের ধরণ</label>
            <Select value={type} onValueChange={(v: any) => setType(v)}>
              <SelectTrigger className="h-9 font-bold text-xs bg-slate-50 border-amber-200">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="mcq" className="text-xs font-bold">
                  🎯 বহুনির্বাচনী প্রশ্ন (MCQ - ৪টি অপশন পাশাপাশি ও উত্তরমালা)
                </SelectItem>
                <SelectItem value="creative" className="text-xs font-bold">
                  📝 সৃজনশীল প্রশ্ন (CQ - উদ্দীপক + ক, খ, গ, ঘ ও সাল/বোর্ড উল্লেখ)
                </SelectItem>
                <SelectItem value="short" className="text-xs font-bold">
                  ✏️ সংক্ষিপ্ত প্রশ্ন (Short Questions ও সাল/বোর্ড উল্লেখ)
                </SelectItem>
                <SelectItem value="english" className="text-xs font-bold">
                  🌐 ইংরেজি প্রশ্নমালা (English Board Exam Items)
                </SelectItem>
                <SelectItem value="all" className="text-xs font-bold">
                  📚 পূর্ণাঙ্গ বোর্ড প্রশ্নমালা / তালিকা
                </SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Generate Button */}
        <div className="pt-2">
          <Button
            onClick={handleGenerate}
            disabled={loading}
            className="w-full sm:w-auto min-w-[200px] h-10 font-black text-xs bg-gradient-to-r from-amber-600 via-orange-600 to-amber-700 hover:from-amber-700 hover:to-orange-800 text-white shadow-md gap-2"
          >
            {loading ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>বোর্ড প্রশ্ন প্রস্তুত হচ্ছে...</span>
              </>
            ) : (
              <>
                <Sparkles className="w-4 h-4 text-amber-200 animate-spin" />
                <span>বোর্ড প্রশ্ন তৈরি করুন</span>
              </>
            )}
          </Button>
        </div>

        {/* Results Area */}
        {result && (
          <div className="mt-6 pt-5 border-t border-amber-200 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-amber-50 p-3 rounded-lg border border-amber-200">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span className="font-black text-xs text-amber-950">
                  {result.board} • {result.subject} ({result.year})
                </span>
                <Badge variant="outline" className="bg-white text-emerald-800 border-emerald-300 text-[10px] font-bold">
                  {result.questions.length} টি প্রশ্ন পাওয়া গেছে
                </Badge>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  onClick={handleCopy}
                  size="sm"
                  variant="outline"
                  className="h-8 gap-1.5 text-xs font-bold border-amber-300 hover:bg-amber-100 text-amber-900"
                >
                  {copied ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                  <span>{copied ? 'কপি হয়েছে' : 'কপি করুন'}</span>
                </Button>
                {onInsertQuestions && (
                  <Button
                    onClick={handleInsert}
                    size="sm"
                    className="h-8 gap-1.5 text-xs font-black bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs"
                  >
                    <PlusCircle className="w-3.5 h-3.5" />
                    <span>প্রশ্নপত্রে যুক্ত করুন</span>
                  </Button>
                )}
              </div>
            </div>

            {/* Formatted Text Preview */}
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl max-h-[450px] overflow-y-auto custom-scrollbar font-kalpurush">
              <pre className="whitespace-pre-wrap font-sans text-xs text-slate-800 leading-relaxed font-normal">
                {result.formattedText}
              </pre>
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

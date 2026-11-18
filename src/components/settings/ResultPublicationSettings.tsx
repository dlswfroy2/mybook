'use client';

import { useState, useEffect } from 'react';
import { Firestore } from 'firebase/firestore';
import { 
  Trophy, 
  Calendar, 
  Clock, 
  Eye, 
  EyeOff, 
  Save, 
  Loader2, 
  AlertCircle, 
  CheckCircle2, 
  Sparkles,
  Info,
  CalendarCheck,
  Plus
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Badge } from '@/components/ui/badge';
import { Switch } from '@/components/ui/switch';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { getExams, Exam } from '@/lib/exam-data';
import { 
  ResultPublicationConfig, 
  ExamPublicationRule, 
  ExamPublicationStatus,
  getResultPublicationConfig, 
  saveResultPublicationConfig,
  formatBengaliDateTime,
  toBengaliNumber
} from '@/lib/result-publication-data';

interface ResultPublicationSettingsProps {
  db: Firestore;
  userEmail?: string;
}

export function ResultPublicationSettings({ db, userEmail }: ResultPublicationSettingsProps) {
  const { toast } = useToast();
  const { availableYears, selectedYear: currentContextYear } = useAcademicYear();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [activeConfigYear, setActiveConfigYear] = useState<string>(currentContextYear || new Date().getFullYear().toString());
  const [allowedYears, setAllowedYears] = useState<string[]>([]);
  const [globalNotice, setGlobalNotice] = useState<string>('');
  const [rules, setRules] = useState<Record<string, ExamPublicationRule>>({});
  const [exams, setExams] = useState<Exam[]>([]);
  const [customExamName, setCustomExamName] = useState('');

  // Load config on mount
  useEffect(() => {
    let isMounted = true;
    const fetchConfig = async () => {
      setLoading(true);
      try {
        const conf = await getResultPublicationConfig(db);
        if (isMounted) {
          setAllowedYears(conf.allowedAcademicYears || [currentContextYear]);
          setGlobalNotice(conf.globalNotice || '');
          setRules(conf.rules || {});
        }
      } catch (err) {
        console.error("Failed to load result publication config:", err);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchConfig();
    return () => { isMounted = false; };
  }, [db, currentContextYear]);

  // Load exams when activeConfigYear changes
  useEffect(() => {
    let isMounted = true;
    const fetchExams = async () => {
      try {
        const fetched = await getExams(db, activeConfigYear);
        if (isMounted) setExams(fetched);
      } catch (err) {
        console.error("Error fetching exams for settings:", err);
      }
    };
    fetchExams();
    return () => { isMounted = false; };
  }, [db, activeConfigYear]);

  // Toggle year in allowedYears
  const toggleYearAllowed = (year: string) => {
    setAllowedYears(prev => {
      if (prev.includes(year)) {
        return prev.filter(y => y !== year);
      } else {
        return [...prev, year];
      }
    });
  };

  // Helper to get rule for an exam
  const getRule = (examName: string): ExamPublicationRule => {
    const key = `${activeConfigYear}_${examName}`;
    return rules[key] || {
      examName,
      academicYear: activeConfigYear,
      status: 'published'
    };
  };

  // Update rule for an exam
  const updateRule = (examName: string, updates: Partial<ExamPublicationRule>) => {
    const key = `${activeConfigYear}_${examName}`;
    const current = getRule(examName);
    setRules(prev => ({
      ...prev,
      [key]: {
        ...current,
        ...updates
      }
    }));
  };

  // Add a custom exam name to current year if not present
  const handleAddCustomExam = () => {
    if (!customExamName.trim()) return;
    const trimmed = customExamName.trim();
    if (exams.some(e => e.name === trimmed)) {
      toast({ variant: 'destructive', title: 'পরীক্ষাটি তালিকায় বিদ্যমান' });
      return;
    }
    const newExam: Exam = {
      id: `custom_${Date.now()}`,
      name: trimmed,
      academicYear: activeConfigYear,
      classes: ['6', '7', '8', '9', '10']
    };
    setExams(prev => [...prev, newExam]);
    updateRule(trimmed, { status: 'published' });
    setCustomExamName('');
    toast({ title: 'পরীক্ষা যোগ করা হয়েছে', description: `এখন "${trimmed}"-এর প্রকাশ সেটিংস কনফিগার করতে পারেন।` });
  };

  // Save all settings
  const handleSave = async () => {
    setSaving(true);
    try {
      await saveResultPublicationConfig(db, {
        allowedAcademicYears: allowedYears,
        globalNotice,
        rules
      }, userEmail);

      toast({
        title: "সফলভাবে সংরক্ষিত!",
        description: "ফলাফল প্রকাশের তারিখ, সময়সূচি এবং হাইড সেটিংস আপডেট হয়েছে।"
      });
    } catch (err: any) {
      console.error(err);
      toast({
        variant: "destructive",
        title: "সংরক্ষণে ব্যর্থ",
        description: err.message || "দয়া করে পুনরায় চেষ্টা করুন।"
      });
    } finally {
      setSaving(false);
    }
  };

  // Format helper for datetime-local default (adds local offset if needed)
  const getDefaultDateTime = () => {
    const now = new Date();
    now.setHours(now.getHours() + 24);
    now.setMinutes(0);
    return now.toISOString().slice(0, 16);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-12 min-h-[400px]">
        <Loader2 className="w-10 h-10 animate-spin text-primary mb-3" />
        <p className="font-bold text-slate-600 text-sm">ফলাফল প্রকাশ সেটিংস লোড হচ্ছে...</p>
      </div>
    );
  }

  // Combined list of all exams for active year
  const allExamNames = Array.from(new Set([
    ...exams.map(e => e.name),
    ...Object.values(rules)
      .filter(r => r.academicYear === activeConfigYear)
      .map(r => r.examName)
  ]));

  return (
    <div className="space-y-8 font-kalpurush">
      {/* Header Banner */}
      <div className="bg-gradient-to-r from-purple-900 via-indigo-900 to-slate-900 text-white p-6 sm:p-8 rounded-[28px] border-4 border-black shadow-[8px_8px_0px_rgba(0,0,0,0.15)] flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="space-y-1.5">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-white/10 rounded-2xl border border-white/20 shadow-inner">
              <Trophy className="w-7 h-7 text-amber-300" />
            </div>
            <div>
              <h3 className="text-2xl sm:text-3xl font-black tracking-tight">ফলাফল প্রকাশ ও সময়সূচি নিয়ন্ত্রণ</h3>
              <p className="text-white/80 text-xs sm:text-sm font-bold">
                অভিভাবক ও শিক্ষার্থীরা কোন শিক্ষাবর্ষ এবং কোন পরীক্ষার ফলাফল কখন দেখতে পারবে তা নির্ধারণ করুন
              </p>
            </div>
          </div>
        </div>

        <Button 
          onClick={handleSave} 
          disabled={saving}
          className="bg-amber-400 hover:bg-amber-300 text-black font-black text-sm px-6 h-12 rounded-xl border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] transition-all shrink-0 gap-2"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          সেটিংস সংরক্ষণ করুন
        </Button>
      </div>

      {/* Section 1: Academic Year Access Controls */}
      <Card className="border-[4px] border-black rounded-[28px] overflow-hidden shadow-[8px_8px_0px_rgba(0,0,0,0.08)] bg-white">
        <CardHeader className="bg-slate-50 border-b-2 border-slate-200 py-4 px-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <Calendar className="w-5 h-5 text-indigo-600" />
              <CardTitle className="text-lg font-black text-slate-800">১. শিক্ষাবর্ষ (Academic Year) অনুসন্ধান নিয়ন্ত্রণ</CardTitle>
            </div>
            <Badge variant="outline" className="font-bold border-black/30">
              সক্রিয় বছর: {allowedYears.length} টি
            </Badge>
          </div>
          <CardDescription className="text-xs font-bold text-slate-500">
            লগইন পেজ এবং পাবলিক পোর্টালে অভিভাবকরা শুধুমাত্র সক্রিয় শিক্ষাবর্ষের ফলাফল অনুসন্ধান করতে পারবেন।
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <div className="flex flex-wrap gap-3">
            {availableYears.map(year => {
              const isAllowed = allowedYears.includes(year);
              return (
                <button
                  type="button"
                  key={year}
                  onClick={() => toggleYearAllowed(year)}
                  className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl border-2 font-black text-sm transition-all shadow-sm ${
                    isAllowed 
                      ? 'bg-emerald-50 border-emerald-600 text-emerald-800 shadow-emerald-100 ring-2 ring-emerald-500/20' 
                      : 'bg-slate-50 border-slate-300 text-slate-400 opacity-60 hover:opacity-100'
                  }`}
                >
                  {isAllowed ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  ) : (
                    <EyeOff className="w-4 h-4 text-slate-400 shrink-0" />
                  )}
                  <span>{toBengaliNumber(year)} শিক্ষাবর্ষ</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-black ${isAllowed ? 'bg-emerald-200 text-emerald-900' : 'bg-slate-200 text-slate-600'}`}>
                    {isAllowed ? 'উন্মুক্ত' : 'লুকানো'}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="text-xs font-bold text-slate-500 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 text-blue-600 shrink-0" />
            লুকানো শিক্ষাবর্ষের ফলাফল কোনো সাধারণ অভিভাবক বা বহিরাগত দেখতে পারবে না।
          </p>
        </CardContent>
      </Card>

      {/* Section 2: Exam Publication & Date/Time Scheduling */}
      <Card className="border-[4px] border-black rounded-[28px] overflow-hidden shadow-[8px_8px_0px_rgba(0,0,0,0.08)] bg-white">
        <CardHeader className="bg-slate-50 border-b-2 border-slate-200 py-4 px-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2.5">
              <Clock className="w-5 h-5 text-purple-600" />
              <CardTitle className="text-lg font-black text-slate-800">২. পরীক্ষা ভিত্তিক প্রকাশ, তারিখ ও হাইড নিয়ন্ত্রণ</CardTitle>
            </div>
            <CardDescription className="text-xs font-bold text-slate-500">
              প্রতিটি পরীক্ষার ফলাফল প্রকাশের নির্দিষ্ট তারিখ ও সময় সেট করুন অথবা সম্পূর্ণ হাইড রাখুন
            </CardDescription>
          </div>

          {/* Academic Year Selector for Exams */}
          <div className="flex items-center gap-2">
            <Label className="text-xs font-black text-slate-600 whitespace-nowrap">কনফিগারেশন বছর:</Label>
            <Select value={activeConfigYear} onValueChange={setActiveConfigYear}>
              <SelectTrigger className="h-10 w-36 font-black border-2 border-black rounded-xl">
                <SelectValue placeholder="বছর নির্বাচন" />
              </SelectTrigger>
              <SelectContent>
                {availableYears.map(y => (
                  <SelectItem key={y} value={y} className="font-bold">{toBengaliNumber(y)} শিক্ষাবর্ষ</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </CardHeader>

        <CardContent className="p-6 space-y-6">
          {/* Quick Add Custom Exam Row */}
          <div className="flex items-center gap-3 bg-slate-50 p-3 rounded-2xl border border-slate-200">
            <Input 
              value={customExamName} 
              onChange={e => setCustomExamName(e.target.value)} 
              placeholder="নতুন পরীক্ষার নাম (যেমন: মডেল টেস্ট বা শ্রেণি মূল্যায়ন)"
              className="h-10 font-bold border-2 border-slate-300 rounded-xl"
              onKeyDown={e => { if (e.key === 'Enter') { e.preventDefault(); handleAddCustomExam(); } }}
            />
            <Button 
              type="button" 
              onClick={handleAddCustomExam} 
              variant="outline"
              className="h-10 px-4 font-black border-2 border-black rounded-xl gap-1 shrink-0 bg-white hover:bg-slate-100"
            >
              <Plus className="w-4 h-4" /> পরীক্ষা যুক্ত করুন
            </Button>
          </div>

          {/* Exam Cards Grid */}
          {allExamNames.length === 0 ? (
            <div className="text-center py-10 bg-slate-50/50 rounded-2xl border-2 border-dashed border-slate-300">
              <CalendarCheck className="w-10 h-10 text-slate-400 mx-auto mb-2" />
              <p className="font-bold text-slate-600 text-sm">এই শিক্ষাবর্ষের জন্য কোনো পরীক্ষা পাওয়া যায়নি।</p>
              <p className="text-xs text-slate-400 mt-1">উপরে নাম লিখে সরাসরি পরীক্ষা যুক্ত করতে পারেন।</p>
            </div>
          ) : (
            <div className="space-y-4">
              {allExamNames.map((examName) => {
                const rule = getRule(examName);
                const status = rule.status;

                return (
                  <div 
                    key={examName}
                    className={`p-5 rounded-2xl border-2 transition-all space-y-4 ${
                      status === 'published'
                        ? 'bg-emerald-50/40 border-emerald-300'
                        : status === 'scheduled'
                        ? 'bg-amber-50/50 border-amber-300'
                        : 'bg-rose-50/40 border-rose-300'
                    }`}
                  >
                    {/* Top Row: Exam Name, Status Badge, and Status Selector */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b pb-3 border-black/10">
                      <div className="flex items-center gap-3">
                        <span className="font-black text-base text-slate-900">{examName}</span>
                        {status === 'published' && (
                          <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-black text-xs gap-1">
                            <Eye className="w-3 h-3" /> প্রকাশিত (লাইভ)
                          </Badge>
                        )}
                        {status === 'scheduled' && (
                          <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-black text-xs gap-1">
                            <Clock className="w-3 h-3" /> নির্ধারিত সময়ে প্রকাশ
                          </Badge>
                        )}
                        {status === 'hidden' && (
                          <Badge className="bg-rose-600 hover:bg-rose-600 text-white font-black text-xs gap-1">
                            <EyeOff className="w-3 h-3" /> অপ্রকাশিত (হাইড)
                          </Badge>
                        )}
                      </div>

                      {/* Status Selector Dropdown */}
                      <div className="flex items-center gap-2">
                        <Label className="text-xs font-black text-slate-600 whitespace-nowrap">স্ট্যাটাস:</Label>
                        <Select 
                          value={status} 
                          onValueChange={(val: ExamPublicationStatus) => {
                            updateRule(examName, { 
                              status: val,
                              publishDateTime: val === 'scheduled' && !rule.publishDateTime ? getDefaultDateTime() : rule.publishDateTime
                            });
                          }}
                        >
                          <SelectTrigger className="h-9 w-48 font-black border-2 border-slate-400 bg-white rounded-xl text-xs">
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="published" className="font-bold text-emerald-700">🟢 প্রকাশিত (সবার জন্য উন্মুক্ত)</SelectItem>
                            <SelectItem value="scheduled" className="font-bold text-amber-700">⏰ নির্ধারিত সময়ে প্রকাশ</SelectItem>
                            <SelectItem value="hidden" className="font-bold text-rose-700">🔴 অপ্রকাশিত / হাইড (লুকানো)</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>

                    {/* Middle Row: Date & Time Picker (if scheduled) */}
                    {status === 'scheduled' && (
                      <div className="bg-white p-4 rounded-xl border border-amber-200 space-y-3">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                          <div className="space-y-1.5">
                            <Label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                              <Calendar className="w-3.5 h-3.5 text-amber-600" /> প্রকাশের তারিখ ও সময় নির্বাচন করুন:
                            </Label>
                            <Input 
                              type="datetime-local" 
                              value={rule.publishDateTime || getDefaultDateTime()}
                              onChange={e => updateRule(examName, { publishDateTime: e.target.value })}
                              className="h-10 font-bold border-2 border-slate-300 rounded-xl"
                            />
                          </div>

                          <div className="space-y-1.5">
                            <Label className="text-xs font-black text-slate-700 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-amber-600" /> অভিভাবক যা দেখবেন (বাংলায় প্রিভিউ):
                            </Label>
                            <div className="h-10 px-3 bg-amber-50 border border-amber-200 rounded-xl flex items-center font-bold text-xs text-amber-900">
                              {rule.publishDateTime ? formatBengaliDateTime(rule.publishDateTime) : 'তারিখ নির্ধারিত হয়নি'}
                            </div>
                          </div>
                        </div>

                        <p className="text-[11px] font-bold text-amber-800 flex items-center gap-1">
                          <Sparkles className="w-3.5 h-3.5 text-amber-600 shrink-0" />
                          এই নির্দিষ্ট তারিখ ও সময়ের পর ফলাফল অভিভাবক ও শিক্ষার্থীদের জন্য স্বয়ংক্রিয়ভাবে উন্মুক্ত হয়ে যাবে।
                        </p>
                      </div>
                    )}

                    {/* Bottom Row: Custom Notice when hidden or scheduled */}
                    <div className="space-y-1">
                      <Label className="text-xs font-black text-slate-600">
                        কাস্টম নোটিশ/বার্তা (ঐচ্ছিক - অভিভাবক ফলাফল সার্চ করলে যা প্রদর্শিত হবে):
                      </Label>
                      <Input 
                        value={rule.customNotice || ''}
                        onChange={e => updateRule(examName, { customNotice: e.target.value })}
                        placeholder={
                          status === 'scheduled' 
                            ? `উদা: "${examName}"-এর ফলাফল প্রকাশের কার্যক্রম চলছে, নির্ধারিত সময়ে ফলাফল পাওয়া যাবে।`
                            : `উদা: "${examName}"-এর ফলাফল এখনো চূড়ান্ত হয়নি, অতিসত্বর প্রকাশ করা হবে।`
                        }
                        className="h-9 text-xs font-bold bg-white border border-slate-300 rounded-xl"
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Section 3: Global Notice & Sticky Save Bar */}
      <Card className="border-[4px] border-black rounded-[28px] overflow-hidden shadow-[8px_8px_0px_rgba(0,0,0,0.08)] bg-white">
        <CardHeader className="bg-slate-50 border-b-2 border-slate-200 py-4 px-6">
          <CardTitle className="text-base font-black text-slate-800 flex items-center gap-2">
            <Info className="w-4 h-4 text-blue-600" /> সার্বিক ফলাফল নোটিশ (Global Notice)
          </CardTitle>
          <CardDescription className="text-xs font-bold text-slate-500">
            লগইন পেজে ফলাফল অনুসন্ধান ডায়ালগে সবার জন্য কোনো সাধারণ বার্তা দেখাতে চাইলে লিখুন
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6 space-y-4">
          <Textarea 
            value={globalNotice}
            onChange={e => setGlobalNotice(e.target.value)}
            placeholder="উদা: কোনো শিক্ষার্থীর ফলাফলে অসঙ্গতি পরিলক্ষিত হলে ফলাফল প্রকাশের ৩ দিনের মধ্যে প্রধান শিক্ষকের নিকট আবেদন করতে হবে।"
            className="min-h-[80px] font-bold text-sm border-2 border-slate-300 rounded-xl"
          />

          <div className="pt-2 flex justify-end">
            <Button 
              onClick={handleSave} 
              disabled={saving}
              className="bg-primary hover:bg-primary/90 text-white font-black text-sm px-8 h-12 rounded-xl border-2 border-black shadow-[4px_4px_0px_rgba(0,0,0,1)] gap-2"
            >
              {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
              পরিবর্তনসমূহ সংরক্ষণ করুন
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

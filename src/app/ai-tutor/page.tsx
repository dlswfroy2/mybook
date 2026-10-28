"use client";

import React, { useState, useRef, useEffect, Suspense } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  Bot, 
  Send, 
  Sparkles, 
  ArrowLeft, 
  Volume2, 
  Copy, 
  CheckCircle2, 
  BookOpen, 
  HelpCircle, 
  Lightbulb, 
  RefreshCw,
  GraduationCap,
  MessageSquare
} from 'lucide-react';
import { solveWhiteboardProblem } from '@/ai/flows/whiteboard-solver-flow';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

interface TutorMessage {
  id: string;
  sender: 'student' | 'tutor';
  text: string;
  subject?: string;
  timestamp: string;
}

const SUBJECT_OPTIONS = [
  'সাধারণ গণিত',
  'উচ্চতর গণিত',
  'পদার্থবিজ্ঞান',
  'রসায়ন',
  'জীববিজ্ঞান',
  'ইংরেজি (Grammar & Writing)',
  'বাংলা ব্যাকরণ ও সাহিত্য',
  'হিসাববিজ্ঞান ও ফিন্যান্স',
  'আইসিটি (ICT)',
  'বাংলাদেশ ও বিশ্বপরিচয়'
];

const SUGGESTED_QUESTIONS: Record<string, string[]> = {
  'সাধারণ গণিত': [
    'পীথাগোরাসের উপপাদ্যটি সহজ ভাষায় বুঝিয়ে দাও।',
    'দ্বিঘাত সমীকরণ কীভাবে সহজে সমাধান করতে হয়?',
    'ত্রিকোণমিতির সূত্র মনে রাখার সহজ উপায় কী?'
  ],
  'পদার্থবিজ্ঞান': [
    'নিউটনের গতির দ্বিতীয় সূত্রটি ব্যাখ্যা করো।',
    'কাজ, ক্ষমতা ও শক্তির মধ্যে মূল পার্থক্য কী?',
    'আর্কিমিডিসের নীতিটি বুঝিয়ে বলো।'
  ],
  'ইংরেজি (Grammar & Writing)': [
    'Right forms of verbs এর প্রধান ৫টি নিয়ম বলো।',
    'Narration পরিবর্তনের সহজ কৌশল কী?',
    'Complex থেকে Simple Sentence কীভাবে করতে হয়?'
  ]
};

function AiTutorContent() {
  const router = useRouter();
  const { toast } = useToast();

  const [subject, setSubject] = useState<string>('সাধারণ গণিত');
  const [messages, setMessages] = useState<TutorMessage[]>([
    {
      id: 'welcome',
      sender: 'tutor',
      text: 'স্বাগতম! আমি তোমার ২৪/৭ এআই স্টাডি টিউটর। তোমার পড়ার যেকোনো বিষয়ে কোনো অংক, সূত্র বা প্রশ্ন বুঝতে সমস্যা হলে আমাকে নির্দ্বিধায় জিজ্ঞাসা করতে পারো।',
      timestamp: 'এখন'
    }
  ]);
  const [inputQuestion, setInputQuestion] = useState<string>('');
  const [loading, setLoading] = useState<boolean>(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, loading]);

  const handleAsk = async (customPrompt?: string) => {
    const q = (customPrompt || inputQuestion).trim();
    if (!q || loading) return;

    const userMsg: TutorMessage = {
      id: String(Date.now()),
      sender: 'student',
      text: q,
      subject,
      timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
    };

    setMessages(prev => [...prev, userMsg]);
    setInputQuestion('');
    setLoading(true);

    try {
      // Create a clean instruction for Gemini
      // Tiny 1x1 blank image payload for multimodal API contract
      const dummyJpg = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////wgALCAABAAEBAREA/8QAFBABAAAAAAAAAAAAAAAAAAAAAP/aAAgBAQABPxA=';
      
      const promptInstruction = `বিষয়: ${subject}\nশিক্ষার্থীর প্রশ্ন: ${q}\n\nনির্দেশনা: একজন বন্ধুসুলভ আদর্শ শিক্ষকের মতো সহজ বাংলায় বুঝিয়ে ধাপে ধাপে সমাধান ও মনে রাখার কৌশল উপস্থাপন করো।`;
      
      const res = await solveWhiteboardProblem(dummyJpg, promptInstruction);

      const aiReplyText = res.success && res.solution 
        ? res.solution 
        : 'দুঃখিত, এই মুহূর্তে উত্তর তৈরিতে কিছুটা সমস্যা হয়েছে। প্রশ্নটি একটু স্পষ্ট করে পুনরায় জিজ্ঞাসা করো।';

      const tutorMsg: TutorMessage = {
        id: String(Date.now() + 1),
        sender: 'tutor',
        text: aiReplyText,
        subject,
        timestamp: new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit' })
      };

      setMessages(prev => [...prev, tutorMsg]);
    } catch (e: any) {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'tutor',
          text: 'ইন্টারনেট সংযোগে ত্রুটি হয়েছে। অনুগ্রহ করে আবার চেষ্টা করো।',
          timestamp: 'ত্রুটি'
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const speakText = (text: string) => {
    if (!window.speechSynthesis) {
      toast({ title: 'ত্রুটি', description: 'ভয়েস ফিচার আপনার ব্রাউজারে সাপোর্ট করে না।' });
      return;
    }
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text.slice(0, 300));
    utterance.lang = 'bn-BD';
    window.speechSynthesis.speak(utterance);
  };

  const copyText = (text: string) => {
    navigator.clipboard.writeText(text);
    toast({ title: 'কপি হয়েছে', description: 'উত্তরটি ক্লিপবোর্ডে কপি করা হয়েছে।' });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-kalpurush">
      {/* Header */}
      <header className="bg-white border-b-2 border-slate-200 sticky top-0 z-20 shadow-xs px-4 py-3">
        <div className="max-w-4xl mx-auto flex items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => router.back()} className="font-bold text-slate-700">
              <ArrowLeft className="w-4 h-4 mr-1" /> ফিরে যান
            </Button>
            <div className="h-6 w-px bg-slate-200" />
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-primary flex items-center justify-center text-white shadow-md">
                <Bot className="w-5 h-5" />
              </div>
              <div>
                <h1 className="font-black text-slate-900 text-base flex items-center gap-1.5">
                  ২৪/৭ এআই স্টাডি টিউটর
                  <Badge variant="outline" className="bg-emerald-50 text-emerald-700 border-emerald-300 text-[10px] font-bold">
                    সক্রিয়
                  </Badge>
                </h1>
                <p className="text-[11px] text-slate-500 font-bold">তোমার ব্যক্তিগত ডিজিটাল প্রাইভেট শিক্ষক</p>
              </div>
            </div>
          </div>

          {/* Subject Dropdown */}
          <Select value={subject} onValueChange={setSubject}>
            <SelectTrigger className="w-44 h-9 font-black text-xs bg-indigo-50 border-indigo-200 text-indigo-900">
              <SelectValue placeholder="বিষয় সিলেক্ট করুন" />
            </SelectTrigger>
            <SelectContent className="font-kalpurush">
              {SUBJECT_OPTIONS.map(opt => (
                <SelectItem key={opt} value={opt} className="font-bold text-xs">
                  {opt}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </header>

      {/* Chat Messages Body */}
      <main className="flex-1 max-w-4xl w-full mx-auto p-4 space-y-4 overflow-y-auto">
        {/* Suggested Prompts Banner */}
        {messages.length <= 1 && SUGGESTED_QUESTIONS[subject] && (
          <div className="bg-white p-4 rounded-2xl border border-indigo-100 shadow-xs space-y-2">
            <p className="text-xs font-black text-indigo-900 flex items-center gap-1.5">
              <Lightbulb className="w-4 h-4 text-amber-500" /> {subject} বিষয়ের জনপ্রিয় কিছু প্রশ্ন:
            </p>
            <div className="flex flex-wrap gap-2">
              {SUGGESTED_QUESTIONS[subject].map((q, idx) => (
                <button
                  key={idx}
                  type="button"
                  onClick={() => handleAsk(q)}
                  className="text-left text-xs bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-800 p-2 px-3 rounded-xl border border-slate-200 hover:border-indigo-300 font-bold transition-all shadow-2xs"
                >
                  {q}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-3 max-w-[88%]",
              msg.sender === 'student' ? "ml-auto flex-row-reverse" : "mr-auto"
            )}
          >
            <div className={cn(
              "w-8 h-8 rounded-full flex items-center justify-center shrink-0 shadow-xs text-white",
              msg.sender === 'student' ? "bg-indigo-600" : "bg-gradient-to-tr from-primary to-indigo-700"
            )}>
              {msg.sender === 'student' ? <GraduationCap className="w-4 h-4" /> : <Bot className="w-4 h-4" />}
            </div>

            <div className={cn(
              "p-4 rounded-2xl shadow-sm text-sm font-bold leading-relaxed space-y-2",
              msg.sender === 'student' 
                ? "bg-indigo-600 text-white rounded-tr-none" 
                : "bg-white text-slate-800 border-2 border-slate-200 rounded-tl-none"
            )}>
              {msg.subject && msg.sender === 'student' && (
                <Badge className="bg-indigo-700 text-indigo-200 text-[9px] mb-1">
                  {msg.subject}
                </Badge>
              )}

              <div className="whitespace-pre-wrap">{msg.text}</div>

              {msg.sender === 'tutor' && msg.id !== 'welcome' && (
                <div className="flex items-center justify-between pt-2 border-t border-slate-100 text-[10px] text-slate-400">
                  <span>{msg.timestamp}</span>
                  <div className="flex gap-1.5">
                    <button 
                      type="button" 
                      onClick={() => speakText(msg.text)} 
                      className="p-1 hover:text-indigo-600 rounded"
                      title="পড়ে শোনান"
                    >
                      <Volume2 className="w-3.5 h-3.5" />
                    </button>
                    <button 
                      type="button" 
                      onClick={() => copyText(msg.text)} 
                      className="p-1 hover:text-indigo-600 rounded"
                      title="কপি করুন"
                    >
                      <Copy className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex gap-3 mr-auto max-w-[85%] items-center">
            <div className="w-8 h-8 rounded-full bg-primary flex items-center justify-center text-white shrink-0">
              <Bot className="w-4 h-4" />
            </div>
            <div className="bg-white p-4 rounded-2xl rounded-tl-none border-2 border-indigo-200 text-slate-700 font-bold text-xs flex items-center gap-2 shadow-sm">
              <RefreshCw className="w-4 h-4 text-indigo-600 animate-spin" />
              টিউটর সমস্যাটি বিশ্লেষণ করে সমাধান প্রস্তুত করছে...
            </div>
          </div>
        )}

        <div ref={messagesEndRef} />
      </main>

      {/* Input Footer */}
      <footer className="bg-white border-t-2 border-slate-200 p-4 sticky bottom-0 z-20 shadow-md">
        <div className="max-w-4xl mx-auto flex gap-2 items-end">
          <Textarea
            value={inputQuestion}
            onChange={(e) => setInputQuestion(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleAsk();
              }
            }}
            placeholder={`[${subject}] বিষয়ে তোমার প্রশ্ন বা অংকটি এখানে লিখো... (Enter চাপলে সেন্ড হবে)`}
            rows={2}
            className="font-bold text-sm bg-slate-50 border-2 border-slate-300 focus:border-indigo-600 resize-none rounded-xl"
          />
          <Button
            onClick={() => handleAsk()}
            disabled={loading || !inputQuestion.trim()}
            className="h-14 px-5 bg-indigo-600 hover:bg-indigo-700 text-white font-black shadow-lg rounded-xl shrink-0"
          >
            <Send className="w-5 h-5 mr-1" /> জিজ্ঞাসা
          </Button>
        </div>
      </footer>
    </div>
  );
}

export default function AiTutorPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">লোড হচ্ছে...</div>}>
      <AiTutorContent />
    </Suspense>
  );
}

"use client";

import React, { useState, useRef, useMemo, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';
import { 
  Camera, 
  Upload, 
  Loader2, 
  CheckCircle2, 
  XCircle, 
  HelpCircle, 
  Award, 
  Printer, 
  Save, 
  RefreshCw, 
  Sparkles,
  ArrowRight,
  User,
  Sliders,
  ChevronRight,
  Eye,
  FileText,
  ListOrdered,
  ExternalLink,
  Zap,
  Check,
  BarChart2
} from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { scanAndEvaluateOmr, ScanOmrOutput } from '@/ai/flows/scan-omr-flow';
import { useFirestore, useUser } from '@/firebase';
import { collection, addDoc, updateDoc, doc, serverTimestamp, getDocs, query, orderBy, where } from 'firebase/firestore';
import { CLASSES, getSubjectsForClass } from '@/lib/constants';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

// Client-side image compression to prevent payload limits and speed up mobile scanning
function compressImage(dataUrl: string, maxDim = 1600, quality = 0.85): Promise<string> {
  if (typeof window === 'undefined') return Promise.resolve(dataUrl);
  return new Promise((resolve) => {
    const img = new window.Image();
    img.onload = () => {
      let { width, height } = img;
      if (width > maxDim || height > maxDim) {
        if (width > height) {
          height = Math.round((height * maxDim) / width);
          width = maxDim;
        } else {
          width = Math.round((width * maxDim) / height);
          height = maxDim;
        }
      }
      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#FFFFFF';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      } else {
        resolve(dataUrl);
      }
    };
    img.onerror = () => resolve(dataUrl);
    img.src = dataUrl;
  });
}

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (digit) => bengaliDigits[parseInt(digit, 10)]);
}

export interface SessionBatchStudent {
  docId: string;
  rollNumber: string;
  studentName: string;
  className?: string;
  subjectName?: string;
  setCode: string;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  time: string;
}

export interface OmrScannerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  questionCount: number;
  examTitle: string;
  examSubtitle: string;
  classId?: string;
  subject?: string;
  examType?: string;
  defaultAnswerKey?: Record<number, string>;
  answerKeysBySet?: Record<string, Record<number, string>>;
  negativeMark?: number;
}

export function OmrScannerDialog({
  open,
  onOpenChange,
  questionCount = 30,
  examTitle,
  examSubtitle,
  classId = '10',
  subject = 'গণিত',
  examType = 'মডেল টেস্ট',
  defaultAnswerKey = {},
  answerKeysBySet = {},
  negativeMark: initialNegativeMark = 0,
}: OmrScannerDialogProps) {
  const router = useRouter();
  const { toast } = useToast();
  const db = useFirestore();
  const { user } = useUser();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);

  // Active Subject & Class states (Synced from props or overridden inside dialog)
  const [activeClassId, setActiveClassId] = useState<string>(classId || '10');
  const [activeSubject, setActiveSubject] = useState<string>(subject || 'গণিত');
  const [activeExamType, setActiveExamType] = useState<string>(examType || 'মডেল টেস্ট');
  const [activeNegativeMark, setActiveNegativeMark] = useState<number>(initialNegativeMark);

  // States
  const [step, setStep] = useState<'input' | 'scanning' | 'result'>('input');
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'scan' | 'answerKey' | 'batch'>('scan');

  // Answer Key state
  const [answerKey, setAnswerKey] = useState<Record<number, string>>(() => {
    const initial: Record<number, string> = {};
    for (let i = 1; i <= questionCount; i++) {
      initial[i] = defaultAnswerKey[i] || '';
    }
    return initial;
  });

  const [activeAnswerKeysBySet, setActiveAnswerKeysBySet] = useState<Record<string, Record<number, string>>>(
    answerKeysBySet && Object.keys(answerKeysBySet).length > 0
      ? answerKeysBySet
      : { 'ক': defaultAnswerKey || {}, 'খ': {}, 'গ': {}, 'ঘ': {} }
  );

  // Saved answer keys from Firestore
  const [savedAnswerKeys, setSavedAnswerKeys] = useState<any[]>([]);
  const [loadedKeyId, setLoadedKeyId] = useState('');

  // Scanned evaluation result & Last saved document
  const [result, setResult] = useState<ScanOmrOutput | null>(null);
  const [editableStudentName, setEditableStudentName] = useState('');
  const [editableRollNumber, setEditableRollNumber] = useState('');
  const [lastSavedDocId, setLastSavedDocId] = useState<string | null>(null);

  // Continuous Session Batch List (50+ students in one session without closing modal)
  const [sessionBatch, setSessionBatch] = useState<SessionBatchStudent[]>([]);

  // Official class student list for instant roll-to-name lookup
  const [classStudents, setClassStudents] = useState<any[]>([]);

  // Live Auto-Capture Camera (QR-style) states
  const [liveCameraActive, setLiveCameraActive] = useState(false);
  const [stabilityProgress, setStabilityProgress] = useState(0);
  const [autoCaptureStatus, setAutoCaptureStatus] = useState<string>('ওএমআর শিট ফ্রেমের ভেতর স্থির রাখুন...');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const prevFrameRef = useRef<Uint8ClampedArray | null>(null);
  const steadyCountRef = useRef<number>(0);
  const isCapturingRef = useRef<boolean>(false);

  const bubbleOptions = ['ক', 'খ', 'গ', 'ঘ'];
  const availableSubjects = useMemo(() => getSubjectsForClass(activeClassId), [activeClassId]);

  // Pre-load students of activeClassId from Firestore for instant roll -> name resolution
  useEffect(() => {
    if (!db || !open || !activeClassId) return;
    const q = query(collection(db, 'students'), where('className', '==', activeClassId));
    getDocs(q).then(snap => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setClassStudents(list);
    }).catch(console.error);
  }, [db, open, activeClassId]);

  // Helper to stop live camera stream cleanly
  const stopLiveCamera = () => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
    setLiveCameraActive(false);
    setStabilityProgress(0);
    steadyCountRef.current = 0;
    prevFrameRef.current = null;
    isCapturingRef.current = false;
  };

  // Stop camera when dialog closes
  useEffect(() => {
    if (!open) {
      stopLiveCamera();
    }
  }, [open]);

  // Sync props when opened
  useEffect(() => {
    if (open) {
      if (classId) setActiveClassId(classId);
      if (subject) setActiveSubject(subject);
      if (examType) setActiveExamType(examType);
      if (initialNegativeMark !== undefined) setActiveNegativeMark(initialNegativeMark);
      if (defaultAnswerKey && Object.keys(defaultAnswerKey).length > 0) {
        setAnswerKey(defaultAnswerKey);
      }
      if (answerKeysBySet && Object.keys(answerKeysBySet).length > 0) {
        setActiveAnswerKeysBySet(answerKeysBySet);
      }
    }
  }, [open, classId, subject, examType, defaultAnswerKey, answerKeysBySet, initialNegativeMark]);

  // Load saved answer keys from Firestore
  useEffect(() => {
    async function loadKeys() {
      if (!db) return;
      try {
        const q = query(collection(db, 'omr_answer_keys'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        const keys = snap.docs.map(d => ({ id: d.id, ...d.data() }));
        setSavedAnswerKeys(keys);

        // Auto-match for current class and subject
        const matched = keys.find(
          (k: any) => (k.classId === activeClassId || k.className === activeClassId) && (k.subject === activeSubject || k.examSubtitle === activeSubject)
        );
        if (matched) {
          setLoadedKeyId(matched.id);
          if (matched.answerKeysBySet) {
            setActiveAnswerKeysBySet(matched.answerKeysBySet);
            setAnswerKey(matched.answerKeysBySet['ক'] || matched.answerKey || {});
          } else if (matched.answerKey) {
            setAnswerKey(matched.answerKey);
            setActiveAnswerKeysBySet({ 'ক': matched.answerKey, 'খ': {}, 'গ': {}, 'ঘ': {} });
          }
          if (matched.negativeMark !== undefined) setActiveNegativeMark(matched.negativeMark);
        }
      } catch (e) {
        console.error('উত্তরমালা লোড করতে সমস্যা:', e);
      }
    }
    if (open) loadKeys();
  }, [db, open, activeClassId, activeSubject]);

  // Auto-switch answer keys when user changes class/subject in dialog
  const handleDialogClassChange = (newCid: string) => {
    setActiveClassId(newCid);
    const subjs = getSubjectsForClass(newCid);
    const newSub = subjs.includes(activeSubject) ? activeSubject : subjs[0] || 'গণিত';
    setActiveSubject(newSub);

    const matched = savedAnswerKeys.find(
      (k: any) => (k.classId === newCid || k.className === newCid) && (k.subject === newSub || k.examSubtitle === newSub)
    );
    if (matched) {
      setLoadedKeyId(matched.id);
      if (matched.answerKeysBySet) {
        setActiveAnswerKeysBySet(matched.answerKeysBySet);
        setAnswerKey(matched.answerKeysBySet['ক'] || matched.answerKey || {});
      } else if (matched.answerKey) {
        setAnswerKey(matched.answerKey);
      }
    }
  };

  const handleDialogSubjectChange = (newSub: string) => {
    setActiveSubject(newSub);
    const matched = savedAnswerKeys.find(
      (k: any) => (k.classId === activeClassId || k.className === activeClassId) && (k.subject === newSub || k.examSubtitle === newSub)
    );
    if (matched) {
      setLoadedKeyId(matched.id);
      if (matched.answerKeysBySet) {
        setActiveAnswerKeysBySet(matched.answerKeysBySet);
        setAnswerKey(matched.answerKeysBySet['ক'] || matched.answerKey || {});
      } else if (matched.answerKey) {
        setAnswerKey(matched.answerKey);
      }
    }
  };

  // Perform AI Scan & Auto-Save
  const executeScan = async (imgUri: string) => {
    setStep('scanning');
    try {
      const scanRes = await scanAndEvaluateOmr({
        imageUri: imgUri,
        questionCount,
        answerKey,
        answerKeysBySet: activeAnswerKeysBySet,
        negativeMark: activeNegativeMark,
        classId: activeClassId,
        subject: activeSubject,
        examType: activeExamType,
      });

      // ── ROLL-TO-NAME AUTO LOOKUP FROM OFFICIAL STUDENT LIST ──
      const rollClean = (scanRes.rollNumber || '').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]).trim();
      const rollNum = parseInt(rollClean, 10);

      let matchedStudent: any = null;
      if (!isNaN(rollNum)) {
        matchedStudent = classStudents.find(s => {
          const sRoll = parseInt(String(s.roll || '').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]).trim(), 10);
          return !isNaN(sRoll) && sRoll === rollNum;
        });
      }

      const studentNameClean = matchedStudent
        ? (matchedStudent.studentNameBn || matchedStudent.studentNameEn || `রোল ${rollClean}`)
        : (rollClean ? `রোল: ${toBengaliNumber(rollClean)} (তালিকায় নেই)` : 'অজ্ঞাত রোল');
      const studentIdClean = matchedStudent?.id || '';

      setResult({ ...scanRes, studentName: studentNameClean, rollNumber: rollClean });
      setEditableStudentName(studentNameClean);
      setEditableRollNumber(rollClean);
      setStep('result');

      // ── AUTO-SAVE TO FIRESTORE DIRECTLY ──
      if (db) {
        const className = CLASSES.find(c => c.id === activeClassId)?.label || activeClassId;

        const docRef = await addDoc(collection(db, 'omr_evaluations'), {
          userId: user?.uid || 'anonymous',
          classId: activeClassId,
          className: className,
          subject: activeSubject,
          examType: activeExamType,
          examTitle: examTitle || `${className} শ্রেণি - ${activeExamType}`,
          examSubtitle: activeSubject,
          studentId: studentIdClean,
          studentName: studentNameClean,
          rollNumber: rollClean || 'N/A',
          subjectCode: scanRes.subjectCode || '',
          setCode: scanRes.setCode || 'ক',
          totalQuestions: scanRes.totalQuestions,
          attemptedCount: scanRes.attemptedCount,
          correctCount: scanRes.correctCount,
          wrongCount: scanRes.wrongCount,
          unansweredCount: scanRes.unansweredCount,
          obtainedMarks: scanRes.obtainedMarks,
          totalMarks: scanRes.totalMarks,
          percentage: scanRes.percentage,
          scannedAt: serverTimestamp(),
        });

        setLastSavedDocId(docRef.id);

        // Add to continuous session batch
        const nowTime = new Date().toLocaleTimeString('bn-BD', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
        setSessionBatch(prev => [
          {
            docId: docRef.id,
            rollNumber: rollClean || 'N/A',
            studentName: studentNameClean,
            className: className,
            subjectName: activeSubject,
            setCode: scanRes.setCode || 'ক',
            obtainedMarks: scanRes.obtainedMarks,
            totalMarks: scanRes.totalMarks,
            percentage: scanRes.percentage,
            time: nowTime,
          },
          ...prev,
        ]);

        toast({
          title: '✅ মূল্যায়ন ও সংরক্ষণ সম্পন্ন!',
          description: `${studentNameClean} (রোল: ${toBengaliNumber(rollClean)}) | নম্বর: ${toBengaliNumber(scanRes.obtainedMarks)} / ${toBengaliNumber(scanRes.totalMarks)}`,
        });
      }
    } catch (err: any) {
      console.error(err);
      setStep('input');
      toast({
        variant: 'destructive',
        title: 'স্ক্যান ব্যর্থ হয়েছে',
        description: err?.message || 'ওএমআর শিট পড়া সম্ভব হয়নি। আলো বাড়িয়ে সোজাভাবে ফ্রেমের ভেতরে ছবি তুলুন।',
      });
    }
  };

  // Play a short subtle beep when auto-capture locks
  const playCaptureBeep = () => {
    try {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtx) return;
      const ctx = new AudioCtx();
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, ctx.currentTime);
      gain.gain.setValueAtTime(0.15, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.15);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      osc.stop(ctx.currentTime + 0.15);
    } catch {}
  };

  // Capture current frame from live video element
  const captureLiveFrame = () => {
    if (!videoRef.current || isCapturingRef.current) return;
    isCapturingRef.current = true;
    const video = videoRef.current;
    const vw = video.videoWidth;
    const vh = video.videoHeight;
    if (!vw || !vh) {
      isCapturingRef.current = false;
      return;
    }

    const maxDim = 1600;
    let w = vw;
    let h = vh;
    if (w > maxDim || h > maxDim) {
      if (w > h) {
        h = Math.round((h * maxDim) / w);
        w = maxDim;
      } else {
        w = Math.round((w * maxDim) / h);
        h = maxDim;
      }
    }

    const canvas = document.createElement('canvas');
    canvas.width = w;
    canvas.height = h;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(video, 0, 0, w, h);
      const compressedUri = canvas.toDataURL('image/jpeg', 0.85);
      playCaptureBeep();
      stopLiveCamera();
      setImagePreview(compressedUri);
      executeScan(compressedUri);
    } else {
      isCapturingRef.current = false;
    }
  };

  // Start Live QR-Style Auto-Capture Camera
  const startLiveCamera = async () => {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      toast({
        title: 'সাধারণ ক্যামেরা চালু হচ্ছে',
        description: 'সরাসরি লাইভ অটো-স্ক্যানারের জন্য HTTPS সংযোগ প্রয়োজন। তাই ক্যামেরা অ্যাপ দিয়ে ছবি তুলুন।',
      });
      cameraInputRef.current?.click();
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: 'environment',
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      streamRef.current = stream;
      setLiveCameraActive(true);
      setStabilityProgress(0);
      setAutoCaptureStatus('ওএমআর শিট ফ্রেমের ভেতর স্থির রাখুন...');
      steadyCountRef.current = 0;
      prevFrameRef.current = null;
      isCapturingRef.current = false;

      setTimeout(() => {
        if (videoRef.current && streamRef.current) {
          videoRef.current.srcObject = streamRef.current;
          videoRef.current.play().catch(console.error);
        }
      }, 100);
    } catch (err: any) {
      console.warn('Live camera unavailable, falling back to native input:', err);
      toast({
        title: 'ক্যামেরা পারমিশন বা সাপোর্ট পাওয়া যায়নি',
        description: 'সাধারণ ক্যামেরা থেকে ছবি তোলার অপশন খোলা হচ্ছে।',
      });
      cameraInputRef.current?.click();
    }
  };

  // Stability detection loop (like QR scanner auto-lock) when liveCameraActive
  useEffect(() => {
    if (!liveCameraActive) return;
    const sampleCanvas = document.createElement('canvas');
    sampleCanvas.width = 64;
    sampleCanvas.height = 64;
    const sampleCtx = sampleCanvas.getContext('2d', { willReadFrequently: true });

    const interval = setInterval(() => {
      if (!videoRef.current || !sampleCtx || isCapturingRef.current) return;
      const video = videoRef.current;
      if (video.readyState < 2) return;

      sampleCtx.drawImage(video, 0, 0, 64, 64);
      const data = sampleCtx.getImageData(0, 0, 64, 64).data;

      if (prevFrameRef.current) {
        let diffSum = 0;
        for (let i = 0; i < data.length; i += 4) {
          const lum1 = (data[i] + data[i + 1] + data[i + 2]) / 3;
          const lum2 = (prevFrameRef.current[i] + prevFrameRef.current[i + 1] + prevFrameRef.current[i + 2]) / 3;
          diffSum += Math.abs(lum1 - lum2);
        }
        const avgDiff = diffSum / (64 * 64);

        if (avgDiff < 7.5) {
          steadyCountRef.current += 1;
          const prog = Math.min(100, Math.round((steadyCountRef.current / 4) * 100));
          setStabilityProgress(prog);
          setAutoCaptureStatus(prog >= 75 ? 'ফোকাস লক হয়েছে! অটো ছবি তোলা হচ্ছে...' : 'স্থির রাখুন, ফোকাস হচ্ছে...');
          if (steadyCountRef.current >= 4) {
            captureLiveFrame();
          }
        } else {
          steadyCountRef.current = 0;
          setStabilityProgress(0);
          setAutoCaptureStatus('ওএমআর শিট ফ্রেমের ভেতর স্থির রাখুন...');
        }
      }
      prevFrameRef.current = new Uint8ClampedArray(data);
    }, 280);

    return () => clearInterval(interval);
  }, [liveCameraActive]);

  // Handle image capture / selection
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      toast({ variant: 'destructive', title: 'ত্রুটি', description: 'অনুগ্রহ করে একটি ছবি নির্বাচন করুন।' });
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      const rawDataUri = event.target?.result as string;
      const compressedUri = await compressImage(rawDataUri);
      setImagePreview(compressedUri);
      // Auto-trigger scan on capture for lightning-fast flow
      executeScan(compressedUri);
    };
    reader.readAsDataURL(file);
  };

  // Inline update roll & auto-sync student name from database
  const handleUpdateStudentDetails = async () => {
    if (!lastSavedDocId || !db) return;
    try {
      const rollClean = editableRollNumber.replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]).trim();
      const rollNum = parseInt(rollClean, 10);

      let matchedStudent: any = null;
      if (!isNaN(rollNum)) {
        matchedStudent = classStudents.find(s => {
          const sRoll = parseInt(String(s.roll || '').replace(/[০-৯]/g, d => "0123456789"["০১২৩৪৫৬৭৮৯".indexOf(d)]).trim(), 10);
          return !isNaN(sRoll) && sRoll === rollNum;
        });
      }

      const resolvedName = matchedStudent
        ? (matchedStudent.studentNameBn || matchedStudent.studentNameEn)
        : (editableStudentName.trim() || `রোল: ${toBengaliNumber(rollClean)}`);
      const resolvedId = matchedStudent?.id || '';

      setEditableStudentName(resolvedName);
      setEditableRollNumber(rollClean);

      await updateDoc(doc(db, 'omr_evaluations', lastSavedDocId), {
        studentId: resolvedId,
        studentName: resolvedName,
        rollNumber: rollClean || 'N/A',
      });
      // Update session list as well
      setSessionBatch(prev => prev.map(s => s.docId === lastSavedDocId ? {
        ...s,
        studentName: resolvedName,
        rollNumber: rollClean || s.rollNumber,
      } : s));
      toast({ title: 'আপডেট হয়েছে! ✓', description: `${resolvedName} (রোল: ${toBengaliNumber(rollClean)})` });
    } catch (e) {
      console.error(e);
    }
  };

  // Trigger next scan without closing modal (Continuous Rapid Loop)
  const handleNextScan = () => {
    setImagePreview(null);
    setResult(null);
    setStep('input');
    setActiveTab('scan');
    if (fileInputRef.current) fileInputRef.current.value = '';
    if (cameraInputRef.current) cameraInputRef.current.value = '';
    // Automatically launch live QR-style scanner if supported
    if (typeof navigator !== 'undefined' && navigator.mediaDevices && typeof navigator.mediaDevices.getUserMedia === 'function') {
      startLiveCamera();
    } else if (cameraInputRef.current) {
      cameraInputRef.current.click();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl max-h-[94vh] overflow-y-auto font-kalpurush p-3 sm:p-5 bg-slate-50 border-2 border-indigo-200">
        <DialogHeader className="border-b pb-2.5">
          <DialogTitle className="text-lg sm:text-xl font-black text-indigo-950 flex flex-wrap items-center justify-between gap-2">
            <span className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-amber-500 animate-pulse" /> 
              স্মার্ট ওএমআর স্ক্যানার (Universal AI Scanner)
            </span>
            <div className="flex items-center gap-1.5">
              <Badge variant="outline" className="text-xs bg-indigo-50 border-indigo-300 font-bold text-indigo-800">
                {toBengaliNumber(questionCount)} টি প্রশ্ন
              </Badge>
              {sessionBatch.length > 0 && (
                <Badge className="text-xs bg-emerald-600 text-white font-black">
                  স্ক্যান হয়েছে: {toBengaliNumber(sessionBatch.length)} জন
                </Badge>
              )}
            </div>
          </DialogTitle>
          <DialogDescription className="text-xs font-bold text-slate-600">
            মোবাইল ক্যামেরা দিয়ে যেকোনো ফরম্যাটের ওএমআর খাতার ছবি তুলুন। AI স্বয়ংক্রিয়ভাবে খাতা পড়ে নম্বর হিসাব করে সরাসরি ডাটাবেজে সংরক্ষণ করবে।
          </DialogDescription>
        </DialogHeader>

        {/* ── Active Exam Context Strip (Class, Subject, Exam Type) ── */}
        <div className="bg-white border border-indigo-100 rounded-xl p-2.5 shadow-2xs grid grid-cols-1 sm:grid-cols-3 gap-2 text-xs">
          {/* Class Selector */}
          <div>
            <label className="text-[10px] font-black text-slate-600 uppercase">শ্রেণি (Class):</label>
            <Select value={activeClassId} onValueChange={handleDialogClassChange}>
              <SelectTrigger className="h-7 text-xs font-bold bg-slate-50 mt-0.5">
                <SelectValue placeholder="শ্রেণি" />
              </SelectTrigger>
              <SelectContent>
                {CLASSES.map(c => (
                  <SelectItem key={c.id} value={c.id} className="text-xs font-bold">{c.label} শ্রেণি</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Subject Selector */}
          <div>
            <label className="text-[10px] font-black text-slate-600 uppercase">বিষয় (Subject):</label>
            <Select value={activeSubject} onValueChange={handleDialogSubjectChange}>
              <SelectTrigger className="h-7 text-xs font-bold bg-slate-50 mt-0.5">
                <SelectValue placeholder="বিষয়" />
              </SelectTrigger>
              <SelectContent>
                {availableSubjects.map((s) => (
                  <SelectItem key={s} value={s} className="text-xs font-bold">{s}</SelectItem>
                ))}
                {activeSubject && !availableSubjects.includes(activeSubject) && (
                  <SelectItem value={activeSubject} className="text-xs font-bold">{activeSubject}</SelectItem>
                )}
              </SelectContent>
            </Select>
          </div>

          {/* Exam Type Selector */}
          <div>
            <label className="text-[10px] font-black text-slate-600 uppercase">পরীক্ষার ধরন:</label>
            <Select value={activeExamType} onValueChange={setActiveExamType}>
              <SelectTrigger className="h-7 text-xs font-bold bg-slate-50 mt-0.5">
                <SelectValue placeholder="পরীক্ষার ধরন" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="সাপ্তাহিক পরীক্ষা" className="text-xs font-bold">সাপ্তাহিক পরীক্ষা</SelectItem>
                <SelectItem value="মডেল টেস্ট" className="text-xs font-bold">মডেল টেস্ট</SelectItem>
                <SelectItem value="অর্ধ-বার্ষিক পরীক্ষা" className="text-xs font-bold">অর্ধ-বার্ষিক পরীক্ষা</SelectItem>
                <SelectItem value="বার্ষিক পরীক্ষা" className="text-xs font-bold">বার্ষিক পরীক্ষা</SelectItem>
                <SelectItem value="প্রাক-নির্বাচনি পরীক্ষা" className="text-xs font-bold">প্রাক-নির্বাচনি পরীক্ষা</SelectItem>
                <SelectItem value="নির্বাচনি (টেস্ট) পরীক্ষা" className="text-xs font-bold">নির্বাচনি (টেস্ট) পরীক্ষা</SelectItem>
                <SelectItem value="ক্লাস টেস্ট" className="text-xs font-bold">ক্লাস টেস্ট</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex bg-slate-200/80 p-1 rounded-xl gap-1">
          <button
            type="button"
            onClick={() => setActiveTab('scan')}
            className={cn(
              "flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5",
              activeTab === 'scan' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <Camera className="w-4 h-4 text-indigo-600" /> ১. ক্যামেরা স্ক্যান
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('answerKey')}
            className={cn(
              "flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5",
              activeTab === 'answerKey' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <FileText className="w-4 h-4 text-emerald-600" /> ২. উত্তরমালা (Answer Key)
            {Object.values(answerKey).filter(Boolean).length > 0 && (
              <span className="w-2 h-2 rounded-full bg-emerald-500" />
            )}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('batch')}
            className={cn(
              "flex-1 py-1.5 text-xs font-black rounded-lg transition-all flex items-center justify-center gap-1.5",
              activeTab === 'batch' ? "bg-white text-indigo-900 shadow-xs" : "text-slate-600 hover:text-slate-900"
            )}
          >
            <ListOrdered className="w-4 h-4 text-purple-600" /> ৩. স্ক্যানকৃত তালিকা ({toBengaliNumber(sessionBatch.length)})
          </button>
        </div>

        {/* ── Hidden Native Camera & File Inputs ── */}
        <input
          ref={cameraInputRef}
          type="file"
          accept="image/*"
          capture="environment"
          onChange={handleFileChange}
          className="hidden"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleFileChange}
          className="hidden"
        />

        {/* ══════════════════════════════════════════════════════════
            TAB 1: CAMERA SCANNER & CONTINUOUS LOOP
            ══════════════════════════════════════════════════════════ */}
        {activeTab === 'scan' && (
          <div className="space-y-3">
            {/* When Scanning is in progress */}
            {step === 'scanning' && (
              <div className="py-12 text-center space-y-4 bg-white rounded-2xl border border-indigo-100 p-6">
                <div className="relative w-20 h-20 mx-auto">
                  <div className="absolute inset-0 rounded-full border-4 border-indigo-200 animate-ping opacity-30"></div>
                  <div className="w-20 h-20 rounded-full bg-indigo-600 text-white flex items-center justify-center shadow-lg relative">
                    <Loader2 className="w-10 h-10 animate-spin" />
                  </div>
                </div>
                <div className="space-y-1">
                  <h3 className="font-black text-lg text-indigo-950">ওএমআর খাতা বিশ্লেষণ ও মূল্যায়ন হচ্ছে...</h3>
                  <p className="text-xs font-bold text-slate-600 max-w-sm mx-auto">
                    AI স্বয়ংক্রিয়ভাবে রোল নম্বর, প্রশ্ন সেট এবং প্রতিটি বৃত্তের উত্তর পড়ে সরাসরি ডাটাবেজে সংরক্ষণ করছে।
                  </p>
                </div>
              </div>
            )}

            {/* When at Input / Prompt to Capture */}
            {step === 'input' && (
              <div className="space-y-3">
                {liveCameraActive ? (
                  <div className="relative rounded-2xl overflow-hidden bg-black border-2 border-indigo-500 shadow-xl">
                    <video
                      ref={videoRef}
                      autoPlay
                      playsInline
                      muted
                      className="w-full h-[320px] sm:h-[400px] object-cover"
                    />
                    {/* QR-Style Viewfinder Overlay */}
                    <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-6">
                      <div className="relative w-full h-full max-w-sm border-2 border-white/40 rounded-xl">
                        <div className="absolute -top-1 -left-1 w-7 h-7 border-t-4 border-l-4 border-emerald-400 rounded-tl-lg" />
                        <div className="absolute -top-1 -right-1 w-7 h-7 border-t-4 border-r-4 border-emerald-400 rounded-tr-lg" />
                        <div className="absolute -bottom-1 -left-1 w-7 h-7 border-b-4 border-l-4 border-emerald-400 rounded-bl-lg" />
                        <div className="absolute -bottom-1 -right-1 w-7 h-7 border-b-4 border-r-4 border-emerald-400 rounded-br-lg" />
                      </div>
                    </div>

                    {/* Top Status & Stability Bar */}
                    <div className="absolute top-3 inset-x-3 flex flex-col items-center gap-1.5 pointer-events-none">
                      <div className="bg-black/75 backdrop-blur-xs text-white px-3 py-1.5 rounded-full text-xs font-black flex items-center gap-2 shadow">
                        <span className={cn("w-2.5 h-2.5 rounded-full", stabilityProgress >= 75 ? "bg-emerald-400 animate-ping" : "bg-amber-400 animate-pulse")} />
                        {autoCaptureStatus}
                      </div>
                      <div className="w-48 h-1.5 bg-white/30 rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-400 transition-all duration-200"
                          style={{ width: `${stabilityProgress}%` }}
                        />
                      </div>
                    </div>

                    {/* Bottom Controls */}
                    <div className="absolute bottom-3 inset-x-3 flex items-center justify-center gap-2">
                      <Button
                        type="button"
                        onClick={captureLiveFrame}
                        className="bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs h-9 px-4 rounded-full shadow-lg gap-1.5"
                      >
                        <Camera className="w-4 h-4" /> এখনই স্ক্যান করুন
                      </Button>
                      <Button
                        type="button"
                        variant="destructive"
                        onClick={stopLiveCamera}
                        className="font-black text-xs h-9 px-4 rounded-full shadow-lg"
                      >
                        ✕ বন্ধ করুন
                      </Button>
                    </div>
                  </div>
                ) : (
                  <div className="border-2 border-dashed border-indigo-300 rounded-2xl p-5 sm:p-6 text-center bg-white hover:bg-indigo-50/40 transition-colors">
                    <div className="w-16 h-16 rounded-full bg-indigo-100 text-indigo-600 mx-auto flex items-center justify-center mb-3 shadow-inner">
                      <Camera className="w-8 h-8" />
                    </div>
                    <h3 className="font-black text-base text-slate-800 mb-1">
                      QR স্ক্যানারের মতো অটো ওএমআর স্ক্যান করুন
                    </h3>
                    <p className="text-xs text-slate-500 font-bold max-w-md mx-auto mb-5 leading-relaxed">
                      অটো স্ক্যানার চালু করে ওএমআর শিট সামনে ধরুন — আলাদা করে ছবি তুলতে হবে না! শুধু রোল স্ক্যান করেই শিক্ষার্থীদের তালিকা হতে অটো নাম নিয়ে ফলাফল সেভ করবে।
                    </p>

                    <div className="flex flex-col sm:flex-row flex-wrap items-center justify-center gap-2.5">
                      <Button
                        type="button"
                        onClick={startLiveCamera}
                        className="w-full sm:w-auto bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-700 hover:to-teal-700 text-white font-black text-sm h-11 px-6 shadow-md gap-2"
                      >
                        <Zap className="w-5 h-5" /> অটো স্ক্যানার চালু করুন (QR স্টাইল)
                      </Button>
                      <Button
                        type="button"
                        onClick={() => cameraInputRef.current?.click()}
                        className="w-full sm:w-auto bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-700 hover:to-purple-700 text-white font-black text-sm h-11 px-5 shadow-md gap-2"
                      >
                        <Camera className="w-4 h-4" /> ক্যামেরায় ছবি তুলুন
                      </Button>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => fileInputRef.current?.click()}
                        className="w-full sm:w-auto font-black text-sm h-11 px-4 border-slate-300 gap-2"
                      >
                        <Upload className="w-4 h-4" /> ফাইল আপলোড
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* When Scan is Complete & Result is Ready */}
            {step === 'result' && result && (
              <div className="space-y-3 animate-in fade-in duration-200">
                {/* ── Continuous Rapid Action Banner ── */}
                <div className="bg-gradient-to-r from-emerald-600 to-teal-700 text-white p-3 sm:p-4 rounded-xl shadow-md flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center shrink-0">
                      <Check className="w-6 h-6 text-white stroke-[3]" />
                    </div>
                    <div>
                      <div className="text-sm sm:text-base font-black">
                        রোল: {toBengaliNumber(result.rollNumber)} {result.studentName ? `(${result.studentName})` : ''} — প্রাপ্ত নম্বর: {toBengaliNumber(result.obtainedMarks)} / {toBengaliNumber(result.totalMarks)}
                      </div>
                      <div className="text-xs text-emerald-100 font-bold flex items-center gap-2 mt-0.5">
                        <span>✅ ডাটাবেজে স্বয়ংক্রিয় সংরক্ষিত!</span>
                        <span>•</span>
                        <span>সেশনে মোট স্ক্যান: {toBengaliNumber(sessionBatch.length)} জন</span>
                      </div>
                    </div>
                  </div>

                  {/* ⚡ ONE-CLICK NEXT SCAN BUTTON */}
                  <Button
                    type="button"
                    onClick={handleNextScan}
                    className="w-full sm:w-auto bg-white text-emerald-900 hover:bg-emerald-50 font-black text-xs sm:text-sm h-10 px-4 shadow-md shrink-0 gap-1.5"
                  >
                    <Camera className="w-4 h-4 text-emerald-700" />
                    পরবর্তী খাতা স্ক্যান করুন ➔
                  </Button>
                </div>

                {/* Quick Edit Student Details if AI misread handwritten digits */}
                <div className="grid grid-cols-1 sm:grid-cols-4 gap-2 bg-slate-100 p-2.5 rounded-xl border text-xs">
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">শিক্ষার্থীর নাম:</label>
                    <Input
                      value={editableStudentName}
                      onChange={(e) => setEditableStudentName(e.target.value)}
                      onBlur={handleUpdateStudentDetails}
                      placeholder="নাম লিখুন"
                      className="h-7 text-xs font-bold bg-white mt-0.5"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-bold text-slate-500">রোল নম্বর:</label>
                    <Input
                      value={editableRollNumber}
                      onChange={(e) => setEditableRollNumber(e.target.value)}
                      onBlur={handleUpdateStudentDetails}
                      placeholder="রোল নম্বর"
                      className="h-7 text-xs font-bold bg-white mt-0.5"
                    />
                  </div>
                  <div className="flex flex-col justify-center text-center">
                    <span className="text-[10px] font-bold text-slate-500">প্রশ্ন সেট কোড:</span>
                    <span className="text-xs font-black text-purple-700 mt-1">সেট: {result.setCode || 'ক'}</span>
                  </div>
                  <div className="flex flex-col justify-center text-center">
                    <span className="text-[10px] font-bold text-slate-500">শতকরা প্রাপ্তি:</span>
                    <span className="text-xs font-black text-emerald-700 mt-1">{toBengaliNumber(result.percentage)}%</span>
                  </div>
                </div>

                {/* Score Stats Grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-center text-xs">
                  <div className="p-2 bg-emerald-50 border border-emerald-200 rounded-lg">
                    <div className="text-[11px] font-bold text-emerald-800">সঠিক উত্তর ✅</div>
                    <div className="text-lg font-black text-emerald-700 mt-0.5">{toBengaliNumber(result.correctCount)}টি</div>
                  </div>
                  <div className="p-2 bg-rose-50 border border-rose-200 rounded-lg">
                    <div className="text-[11px] font-bold text-rose-800">ভুল উত্তর ❌</div>
                    <div className="text-lg font-black text-rose-700 mt-0.5">{toBengaliNumber(result.wrongCount)}টি</div>
                  </div>
                  <div className="p-2 bg-slate-100 border border-slate-200 rounded-lg">
                    <div className="text-[11px] font-bold text-slate-600">অনুত্তর ⚪</div>
                    <div className="text-lg font-black text-slate-700 mt-0.5">{toBengaliNumber(result.unansweredCount)}টি</div>
                  </div>
                  <div className="p-2 bg-amber-50 border border-amber-200 rounded-lg">
                    <div className="text-[11px] font-bold text-amber-900">মোট নম্বর 🏆</div>
                    <div className="text-lg font-black text-amber-800 mt-0.5">
                      {toBengaliNumber(result.obtainedMarks)} / {toBengaliNumber(result.totalMarks)}
                    </div>
                  </div>
                </div>

                {/* Detailed Questions Breakdown Matrix */}
                <div className="bg-white p-3 rounded-xl border space-y-2">
                  <div className="flex items-center justify-between border-b pb-1">
                    <h4 className="font-black text-xs text-slate-800">প্রশ্নের মূল্যায়ন বিস্তারিত:</h4>
                    <div className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-emerald-500" /> সঠিক</span>
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-rose-500" /> ভুল</span>
                      <span className="flex items-center gap-0.5"><span className="w-2 h-2 rounded-full bg-slate-400" /> অনুত্তর</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 max-h-[180px] overflow-y-auto pr-1">
                    {result.questions.map((q) => {
                      const isCorrect = q.status === 'correct';
                      const isWrong = q.status === 'wrong';
                      const isUnanswered = q.status === 'unanswered';
                      const isMultiple = q.status === 'multiple';

                      return (
                        <div
                          key={q.questionNumber}
                          className={cn(
                            "p-1.5 rounded-lg border text-xs font-bold flex items-center justify-between",
                            isCorrect && "bg-emerald-50 border-emerald-300 text-emerald-950",
                            isWrong && "bg-rose-50 border-rose-300 text-rose-950",
                            isUnanswered && "bg-slate-50 border-slate-200 text-slate-600",
                            isMultiple && "bg-amber-50 border-amber-300 text-amber-950"
                          )}
                        >
                          <span className="font-black w-5">{toBengaliNumber(q.questionNumber)}.</span>
                          <div className="flex items-center gap-1">
                            <span className="font-black px-1 py-0.2 rounded bg-white border text-[10.5px]">
                              {q.scannedAnswer || '—'}
                            </span>
                            {q.correctAnswer && q.correctAnswer !== q.scannedAnswer && (
                              <span className="text-[10px] text-emerald-700 font-black">
                                ({q.correctAnswer})
                              </span>
                            )}
                          </div>
                          <span className="text-xs">
                            {isCorrect ? '✅' : isWrong ? '❌' : isMultiple ? '⚠️' : '⚪'}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* Bottom Actions */}
                <div className="flex flex-wrap items-center justify-between gap-2 pt-1 border-t">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleNextScan}
                    className="gap-1 font-black text-xs bg-indigo-50 border-indigo-200 text-indigo-700 hover:bg-indigo-100"
                  >
                    <Camera className="w-3.5 h-3.5" /> পরবর্তী খাতা স্ক্যান করুন
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => router.push('/omr-results')}
                    className="gap-1 font-bold text-xs text-emerald-700 hover:bg-emerald-50"
                  >
                    <BarChart2 className="w-3.5 h-3.5" /> সম্পূর্ণ ক্লাসের ফলাফল শিট দেখুন ↗
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 2: ANSWER KEY SETUP & SUBJECT-WISE PRESETS
            ══════════════════════════════════════════════════════════ */}
        {activeTab === 'answerKey' && (
          <div className="space-y-3 bg-white p-3.5 rounded-2xl border">
            <div className="flex flex-wrap items-center justify-between border-b pb-2 gap-2">
              <div>
                <h4 className="font-black text-sm text-slate-800">
                  {CLASSES.find(c => c.id === activeClassId)?.label} শ্রেণি — {activeSubject} এর উত্তরমালা
                </h4>
                <p className="text-[11px] text-slate-500 font-bold">নিচের বৃত্তগুলোতে ক্লিক করে সঠিক উত্তরমালা সেট বা পরিবর্তন করুন।</p>
              </div>

              {/* Set selector for answer key */}
              <div className="flex items-center gap-1 bg-slate-100 p-0.5 rounded-lg border">
                <span className="text-[10px] font-bold text-slate-600 px-1">সেট:</span>
                {(['ক', 'খ', 'গ', 'ঘ'] as const).map(setOpt => (
                  <button
                    key={setOpt}
                    type="button"
                    onClick={() => {
                      if (activeAnswerKeysBySet[setOpt]) {
                        setAnswerKey(activeAnswerKeysBySet[setOpt]);
                      }
                    }}
                    className={cn(
                      "px-2 py-0.5 text-xs font-black rounded-md transition-all",
                      "bg-white border text-slate-700 hover:bg-slate-200"
                    )}
                  >
                    {setOpt}
                  </button>
                ))}
              </div>
            </div>

            {/* Answer Key Question Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 gap-1.5 max-h-[300px] overflow-y-auto pr-1">
              {Array.from({ length: questionCount }).map((_, i) => {
                const q = i + 1;
                const currentVal = answerKey[q] || '';
                return (
                  <div key={q} className="border rounded-lg p-1.5 bg-slate-50 flex items-center justify-between text-xs">
                    <span className="font-black text-slate-800 w-5">{toBengaliNumber(q)}.</span>
                    <div className="flex gap-1">
                      {bubbleOptions.map((opt) => (
                        <button
                          key={opt}
                          type="button"
                          onClick={() => {
                            setAnswerKey(prev => ({
                              ...prev,
                              [q]: prev[q] === opt ? '' : opt
                            }));
                          }}
                          className={cn(
                            "w-6 h-6 rounded-full border text-[10px] font-black transition-all flex items-center justify-center",
                            currentVal === opt
                              ? "bg-emerald-600 text-white border-emerald-700 shadow-xs scale-105"
                              : "bg-white text-slate-700 border-slate-300 hover:border-slate-500"
                          )}
                        >
                          {opt}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="pt-2 border-t flex flex-wrap justify-between items-center gap-2">
              <span className="text-xs font-bold text-slate-600">
                মোট উত্তর সেট হয়েছে: <span className="text-emerald-700 font-black">{toBengaliNumber(Object.values(answerKey).filter(Boolean).length)} / {toBengaliNumber(questionCount)}</span>
              </span>
              <Button
                type="button"
                onClick={() => setActiveTab('scan')}
                className="bg-indigo-600 hover:bg-indigo-700 text-white font-black text-xs h-8 px-4"
              >
                স্ক্যান করতে যান <ArrowRight className="w-3.5 h-3.5 ml-1" />
              </Button>
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════
            TAB 3: CURRENT SESSION BATCH LIST (50+ STUDENTS)
            ══════════════════════════════════════════════════════════ */}
        {activeTab === 'batch' && (
          <div className="space-y-3 bg-white p-3.5 rounded-2xl border">
            <div className="flex flex-wrap items-center justify-between border-b pb-2 gap-2">
              <div>
                <h4 className="font-black text-sm text-slate-800">
                  বর্তমান সেশনে মূল্যায়িত খাতা ({toBengaliNumber(sessionBatch.length)} জন)
                </h4>
                <p className="text-[11px] text-slate-500 font-bold">
                  {CLASSES.find(c => c.id === activeClassId)?.label} শ্রেণি — {activeSubject} ({activeExamType})
                </p>
              </div>
              <Button
                size="sm"
                variant="outline"
                onClick={() => router.push('/omr-results')}
                className="text-xs font-bold text-indigo-700 border-indigo-200 hover:bg-indigo-50 h-8 gap-1"
              >
                <ExternalLink className="w-3.5 h-3.5" /> ফলাফল শিট ও প্রিন্ট
              </Button>
            </div>

            {sessionBatch.length === 0 ? (
              <div className="py-8 text-center text-slate-400 font-bold text-xs">
                এই সেশনে এখনো কোনো ওএমআর শিট স্ক্যান করা হয়নি। "ক্যামেরা স্ক্যান" ট্যাবে গিয়ে ছবি তুলুন।
              </div>
            ) : (
              <div className="max-h-[300px] overflow-y-auto rounded-lg border divide-y text-xs">
                {sessionBatch.map((st, idx) => (
                  <div key={st.docId || idx} className="p-2.5 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="flex items-center gap-2.5">
                      <span className="w-6 text-center font-black text-slate-400">{toBengaliNumber(idx + 1)}.</span>
                      <div>
                        <div className="font-black text-slate-800">
                          রোল: {toBengaliNumber(st.rollNumber)} — {st.studentName}
                        </div>
                        <div className="text-[10px] text-slate-500 font-bold">
                          সেট: {st.setCode} • সময়: {st.time}
                        </div>
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-black text-emerald-700 text-sm">
                        {toBengaliNumber(st.obtainedMarks)} / {toBengaliNumber(st.totalMarks)}
                      </div>
                      <Badge variant="outline" className="text-[9px] bg-emerald-50 text-emerald-800 border-emerald-300 font-black">
                        {toBengaliNumber(st.percentage)}%
                      </Badge>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

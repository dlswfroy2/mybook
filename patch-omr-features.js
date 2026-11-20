const fs = require('fs');
const path = require('path');

// ═══════════════════════════════════════════════════════════════════════
// Patch 1: src/app/omr-sheet/page.tsx
// ═══════════════════════════════════════════════════════════════════════
const omrSheetPath = path.join(__dirname, 'src/app/omr-sheet/page.tsx');
let omrSheet = fs.readFileSync(omrSheetPath, 'utf8');

// 1a) Update imports - add new firebase functions and BarChart2
omrSheet = omrSheet.replace(
  `import { doc, getDoc } from 'firebase/firestore';`,
  `import { doc, getDoc, collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';`
);

omrSheet = omrSheet.replace(
  `import { Printer, ArrowLeft, Scissors, LayoutGrid, FileText, CheckCircle2, RefreshCw, Camera, Key, ChevronDown, ChevronUp } from 'lucide-react';`,
  `import { Printer, ArrowLeft, Scissors, LayoutGrid, FileText, CheckCircle2, RefreshCw, Camera, Key, ChevronDown, ChevronUp, BarChart2, Save, Loader2 } from 'lucide-react';`
);

// 1b) Add new state variables after existing states
omrSheet = omrSheet.replace(
  `  const [answerKeyOpen, setAnswerKeyOpen] = useState(false);`,
  `  const [answerKeyOpen, setAnswerKeyOpen] = useState(false);
  const [savedAnswerKeys, setSavedAnswerKeys] = useState<any[]>([]);
  const [isSavingKey, setIsSavingKey] = useState(false);
  const [loadKeyId, setLoadKeyId] = useState('');`
);

// 1c) Add useFirestore-based useUser import - check if useUser is already imported
// We also need useUser for saving answer keys with userId
omrSheet = omrSheet.replace(
  `import { useFirestore, useDoc } from '@/firebase';`,
  `import { useFirestore, useDoc, useUser } from '@/firebase';`
);

// 1d) Add useUser hook usage after db declaration
omrSheet = omrSheet.replace(
  `  const db = useFirestore();`,
  `  const db = useFirestore();
  const { user } = useUser();`
);

// 1e) Add useEffect to load saved answer keys + handleSaveAnswerKey function
// Insert after the isPrintAuto useEffect
omrSheet = omrSheet.replace(
  `  useEffect(() => {
    if (isPrintAuto) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [isPrintAuto]);`,
  `  useEffect(() => {
    if (isPrintAuto) {
      setTimeout(() => {
        window.print();
      }, 500);
    }
  }, [isPrintAuto]);

  // Load saved answer keys from Firestore
  useEffect(() => {
    async function loadSavedKeys() {
      if (!db) return;
      try {
        const q = query(collection(db, 'omr_answer_keys'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setSavedAnswerKeys(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('উত্তরমালা লোড করতে সমস্যা:', e);
      }
    }
    loadSavedKeys();
  }, [db]);

  const handleSaveAnswerKey = async () => {
    if (!db) return;
    if (!examTitle.trim()) {
      alert('পরীক্ষার শিরোনাম দিন।');
      return;
    }
    if (Object.keys(masterAnswerKey).length === 0) {
      alert('অন্তত একটি উত্তর সেট করুন।');
      return;
    }
    setIsSavingKey(true);
    try {
      await addDoc(collection(db, 'omr_answer_keys'), {
        examTitle: examTitle.trim(),
        examSubtitle: examSubtitle.trim(),
        questionCount,
        answerKey: masterAnswerKey,
        createdAt: serverTimestamp(),
        userId: user?.uid || 'anonymous',
      });
      // Reload
      const q = query(collection(db, 'omr_answer_keys'), orderBy('createdAt', 'desc'));
      const snap = await getDocs(q);
      setSavedAnswerKeys(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      alert('উত্তরমালা সংরক্ষণ করা হয়েছে! ✅');
    } catch (e) {
      console.error(e);
      alert('সংরক্ষণে সমস্যা হয়েছে।');
    } finally {
      setIsSavingKey(false);
    }
  };`
);

// 1f) Replace title/subtitle/fullmarks inputs with datalist combos + add results button
const oldTitleSection = `        {/* Inline Title / Year / Subtitle Customizer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t text-xs">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">পরীক্ষার শিরোনাম:</label>
            <Input
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              placeholder="এস এস সি পরীক্ষা- ২০২৭"
              className="h-8 text-xs font-bold mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">উপ-শিরোনাম / বিষয়:</label>
            <Input
              value={examSubtitle}
              onChange={(e) => setExamSubtitle(e.target.value)}
              placeholder="মডেল টেস্ট / গণিত"
              className="h-8 text-xs font-bold mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">পূর্ণমান:</label>
            <Input
              value={fullMarks}
              onChange={(e) => setFullMarks(e.target.value)}
              placeholder="৩০"
              className="h-8 text-xs font-bold mt-0.5"
            />
          </div>
        </div>`;

const newTitleSection = `        {/* Inline Title / Year / Subtitle Customizer */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 pt-2 border-t text-xs">
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">পরীক্ষার শিরোনাম:</label>
            <datalist id="exam-title-list">
              {Array.from(new Set(savedAnswerKeys.map(k => k.examTitle).filter(Boolean))).map(t => (
                <option key={t} value={t} />
              ))}
            </datalist>
            <Input
              value={examTitle}
              onChange={(e) => setExamTitle(e.target.value)}
              list="exam-title-list"
              placeholder="এস এস সি পরীক্ষা- ২০২৭"
              className="h-8 text-xs font-bold mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">উপ-শিরোনাম / বিষয়:</label>
            <datalist id="exam-subtitle-list">
              {Array.from(new Set(savedAnswerKeys
                .filter(k => !examTitle || k.examTitle === examTitle)
                .map(k => k.examSubtitle).filter(Boolean))).map(s => (
                <option key={s} value={s} />
              ))}
            </datalist>
            <Input
              value={examSubtitle}
              onChange={(e) => setExamSubtitle(e.target.value)}
              list="exam-subtitle-list"
              placeholder="মডেল টেস্ট / গণিত"
              className="h-8 text-xs font-bold mt-0.5"
            />
          </div>
          <div>
            <label className="text-[10px] font-black text-slate-500 uppercase">পূর্ণমান:</label>
            <Input
              value={fullMarks}
              onChange={(e) => setFullMarks(e.target.value)}
              placeholder="৩০"
              className="h-8 text-xs font-bold mt-0.5"
            />
          </div>
        </div>

        {/* Results page link */}
        <div className="flex justify-end pt-1">
          <button
            type="button"
            onClick={() => router.push('/omr-results')}
            className="text-xs font-black text-indigo-700 hover:text-indigo-900 border border-indigo-300 hover:border-indigo-500 rounded-lg px-3 py-1.5 flex items-center gap-1.5 transition-colors"
          >
            <BarChart2 className="w-3.5 h-3.5" /> 📊 ফলাফল দেখুন
          </button>
        </div>`;

omrSheet = omrSheet.replace(oldTitleSection, newTitleSection);

// 1g) Replace the answer key footer buttons (সব মুছুন section) to add save & load
const oldAnswerKeyFooter = `              <div className="flex gap-2 mt-3">
                <button
                  type="button"
                  onClick={() => setMasterAnswerKey({})}
                  className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 border border-red-200 hover:border-red-400 rounded px-2 py-1 transition-colors"
                >
                  সব মুছুন
                </button>
                <span className="text-xs text-slate-500 flex items-center">
                  মোট {Object.keys(masterAnswerKey).length}টি উত্তর সেট করা হয়েছে
                </span>
              </div>`;

const newAnswerKeyFooter = `              <div className="flex flex-wrap gap-2 mt-3 items-center">
                <button
                  type="button"
                  onClick={() => setMasterAnswerKey({})}
                  className="text-xs text-red-500 hover:text-red-700 font-bold flex items-center gap-1 border border-red-200 hover:border-red-400 rounded px-2 py-1 transition-colors"
                >
                  সব মুছুন
                </button>
                <span className="text-xs text-slate-500 flex items-center">
                  মোট {Object.keys(masterAnswerKey).length}টি উত্তর সেট করা হয়েছে
                </span>
                <div className="ml-auto flex items-center gap-2">
                  {savedAnswerKeys.length > 0 && (
                    <select
                      value={loadKeyId}
                      onChange={(e) => {
                        const id = e.target.value;
                        setLoadKeyId(id);
                        if (!id) return;
                        const found = savedAnswerKeys.find(k => k.id === id);
                        if (found && found.answerKey) {
                          const loaded: Record<number, string> = {};
                          Object.entries(found.answerKey).forEach(([k, v]) => {
                            loaded[Number(k)] = v as string;
                          });
                          setMasterAnswerKey(loaded);
                          if (found.questionCount) setQuestionCount(found.questionCount);
                        }
                      }}
                      className="h-8 text-xs font-bold border rounded-md px-2 bg-white max-w-[200px]"
                    >
                      <option value="">— সেভ করা উত্তরমালা লোড করুন —</option>
                      {savedAnswerKeys.map((k) => (
                        <option key={k.id} value={k.id}>
                          {k.examTitle} / {k.examSubtitle}
                        </option>
                      ))}
                    </select>
                  )}
                  <button
                    type="button"
                    onClick={handleSaveAnswerKey}
                    disabled={isSavingKey}
                    className="text-xs text-emerald-700 hover:text-emerald-900 font-black flex items-center gap-1 border border-emerald-300 hover:border-emerald-500 rounded px-3 py-1 transition-colors bg-emerald-50 disabled:opacity-50"
                  >
                    {isSavingKey ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />}
                    উত্তরমালা সেভ করুন
                  </button>
                </div>
              </div>`;

omrSheet = omrSheet.replace(oldAnswerKeyFooter, newAnswerKeyFooter);

fs.writeFileSync(omrSheetPath, omrSheet, 'utf8');
console.log('✅ omr-sheet/page.tsx patched successfully');

// ═══════════════════════════════════════════════════════════════════════
// Patch 2: src/components/OmrScannerDialog.tsx
// ═══════════════════════════════════════════════════════════════════════
const scannerPath = path.join(__dirname, 'src/components/OmrScannerDialog.tsx');
let scanner = fs.readFileSync(scannerPath, 'utf8');

// 2a) Update firebase/firestore import to add getDocs, query, orderBy
scanner = scanner.replace(
  `import { collection, addDoc, serverTimestamp } from 'firebase/firestore';`,
  `import { collection, addDoc, serverTimestamp, getDocs, query, orderBy } from 'firebase/firestore';`
);

// 2b) Add imports for useEffect
scanner = scanner.replace(
  `import React, { useState, useRef, useMemo } from 'react';`,
  `import React, { useState, useRef, useMemo, useEffect } from 'react';`
);

// 2c) Add savedAnswerKeys state after existing states
scanner = scanner.replace(
  `  // Scanned evaluation result
  const [result, setResult] = useState<ScanOmrOutput | null>(null);`,
  `  // Saved answer keys from Firestore
  const [savedAnswerKeys, setSavedAnswerKeys] = useState<any[]>([]);
  const [loadedKeyId, setLoadedKeyId] = useState('');

  // Scanned evaluation result
  const [result, setResult] = useState<ScanOmrOutput | null>(null);`
);

// 2d) Add useEffect to load saved answer keys
scanner = scanner.replace(
  `  const bubbleOptions = ['ক', 'খ', 'গ', 'ঘ'];`,
  `  const bubbleOptions = ['ক', 'খ', 'গ', 'ঘ'];

  // Load saved answer keys
  useEffect(() => {
    async function loadKeys() {
      if (!db) return;
      try {
        const q = query(collection(db, 'omr_answer_keys'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);
        setSavedAnswerKeys(snap.docs.map(d => ({ id: d.id, ...d.data() })));
      } catch (e) {
        console.error('উত্তরমালা লোড করতে সমস্যা:', e);
      }
    }
    if (open) loadKeys();
  }, [db, open]);`
);

// 2e) Add "সেভ করা উত্তরমালা" section in Tab 2 (Answer Key tab), after the negative mark selector
const oldAnswerKeyHeader = `                <div className="flex items-center justify-between border-b pb-2">
                  <div>
                    <h4 className="font-black text-sm text-slate-800">মাস্টার উত্তরমালা (সঠিক উত্তর)</h4>
                    <p className="text-[11px] text-slate-500 font-bold">প্রতিটি প্রশ্নের সঠিক উত্তরের বৃত্তে ক্লিক করে সিলেক্ট করুন।</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <label className="text-[11px] font-black text-slate-600">ভুল উত্তরের নেগেটিভ মার্ক:</label>
                    <select
                      value={negativeMark}
                      onChange={(e) => setNegativeMark(parseFloat(e.target.value))}
                      className="h-8 text-xs font-bold border rounded-md px-2 bg-slate-50"
                    >
                      <option value="0">০.০০ (কোনো নম্বর কাটা যাবে না)</option>
                      <option value="0.25">- ০.২৫ নম্বর</option>
                      <option value="0.50">- ০.৫০ নম্বর</option>
                      <option value="1">- ১.০০ নম্বর</option>
                    </select>
                  </div>
                </div>`;

const newAnswerKeyHeader = `                <div className="flex flex-wrap items-center justify-between border-b pb-2 gap-2">
                  <div>
                    <h4 className="font-black text-sm text-slate-800">মাস্টার উত্তরমালা (সঠিক উত্তর)</h4>
                    <p className="text-[11px] text-slate-500 font-bold">প্রতিটি প্রশ্নের সঠিক উত্তরের বৃত্তে ক্লিক করে সিলেক্ট করুন।</p>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    {savedAnswerKeys.length > 0 && (
                      <select
                        value={loadedKeyId}
                        onChange={(e) => {
                          const id = e.target.value;
                          setLoadedKeyId(id);
                          if (!id) return;
                          const found = savedAnswerKeys.find(k => k.id === id);
                          if (found && found.answerKey) {
                            const loaded: Record<number, string> = {};
                            Object.entries(found.answerKey).forEach(([k, v]) => {
                              loaded[Number(k)] = v as string;
                            });
                            setAnswerKey(prev => ({ ...prev, ...loaded }));
                          }
                        }}
                        className="h-8 text-xs font-bold border rounded-md px-2 bg-indigo-50 max-w-[200px]"
                      >
                        <option value="">📂 সেভ করা উত্তরমালা লোড করুন</option>
                        {savedAnswerKeys.map((k) => (
                          <option key={k.id} value={k.id}>
                            {k.examTitle} / {k.examSubtitle}
                          </option>
                        ))}
                      </select>
                    )}
                    <label className="text-[11px] font-black text-slate-600">নেগেটিভ মার্ক:</label>
                    <select
                      value={negativeMark}
                      onChange={(e) => setNegativeMark(parseFloat(e.target.value))}
                      className="h-8 text-xs font-bold border rounded-md px-2 bg-slate-50"
                    >
                      <option value="0">০.০০ (কোনো নম্বর কাটা যাবে না)</option>
                      <option value="0.25">- ০.২৫ নম্বর</option>
                      <option value="0.50">- ০.৫০ নম্বর</option>
                      <option value="1">- ১.০০ নম্বর</option>
                    </select>
                  </div>
                </div>`;

scanner = scanner.replace(oldAnswerKeyHeader, newAnswerKeyHeader);

fs.writeFileSync(scannerPath, scanner, 'utf8');
console.log('✅ OmrScannerDialog.tsx patched successfully');
console.log('');
console.log('All patches applied! Now run: npx tsc --noEmit');

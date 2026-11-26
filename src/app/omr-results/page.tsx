"use client";

import React, { useState, useEffect, Suspense, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { collection, getDocs, query, orderBy, deleteDoc, doc } from 'firebase/firestore';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Printer, BarChart2, Trash2, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

function toBengaliNumber(n: number | string | undefined | null): string {
  if (n === undefined || n === null || n === '') return '০';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return n.toString().replace(/\d/g, (d) => bengaliDigits[parseInt(d, 10)]);
}

function getGrade(pct: number): { grade: string; color: string } {
  if (pct >= 80) return { grade: 'A+', color: 'text-emerald-700 bg-emerald-100' };
  if (pct >= 70) return { grade: 'A', color: 'text-green-700 bg-green-100' };
  if (pct >= 60) return { grade: 'A-', color: 'text-lime-700 bg-lime-100' };
  if (pct >= 50) return { grade: 'B', color: 'text-blue-700 bg-blue-100' };
  if (pct >= 40) return { grade: 'C', color: 'text-yellow-700 bg-yellow-100' };
  if (pct >= 33) return { grade: 'D', color: 'text-orange-700 bg-orange-100' };
  return { grade: 'F', color: 'text-red-700 bg-red-100' };
}

interface OmrResult {
  id: string;
  examTitle: string;
  examSubtitle?: string;
  classId?: string;
  className?: string;
  subject?: string;
  examType?: string;
  studentName: string;
  rollNumber: string;
  subjectCode?: string;
  setCode?: string;
  totalQuestions: number;
  correctCount: number;
  wrongCount: number;
  unansweredCount: number;
  obtainedMarks: number;
  totalMarks: number;
  percentage: number;
  scannedAt?: any;
}

function OmrResultsContent() {
  const router = useRouter();
  const db = useFirestore();

  const [allResults, setAllResults] = useState<OmrResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterExam, setFilterExam] = useState('');
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const loadResults = async () => {
    if (!db) return;
    setLoading(true);
    try {
      const snap = await getDocs(query(
        collection(db, 'omr_evaluations'),
        orderBy('scannedAt', 'desc')
      ));
      setAllResults(snap.docs.map(d => ({ id: d.id, ...d.data() } as OmrResult)));
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadResults(); }, [db]);

  const classes = useMemo(() =>
    [...new Set(allResults.map(r => r.className || (r.classId ? `শ্রেণি: ${r.classId}` : '')).filter(Boolean))],
    [allResults]
  );

  const subjects = useMemo(() =>
    [...new Set(allResults
      .filter(r => !filterClass || (r.className === filterClass || r.classId === filterClass))
      .map(r => r.subject || r.examSubtitle).filter(Boolean))],
    [allResults, filterClass]
  );

  const examTitles = useMemo(() =>
    [...new Set(allResults
      .filter(r => (!filterClass || (r.className === filterClass || r.classId === filterClass)) &&
                   (!filterSubject || (r.subject === filterSubject || r.examSubtitle === filterSubject)))
      .map(r => r.examTitle || r.examType).filter(Boolean))],
    [allResults, filterClass, filterSubject]
  );

  const filtered = useMemo(() =>
    allResults.filter(r => {
      const matchClass = !filterClass || r.className === filterClass || r.classId === filterClass;
      const matchSub = !filterSubject || r.subject === filterSubject || r.examSubtitle === filterSubject;
      const matchExam = !filterExam || r.examTitle === filterExam || r.examType === filterExam;
      return matchClass && matchSub && matchExam;
    }).sort((a, b) => {
      const rollA = parseInt(a.rollNumber || '9999', 10);
      const rollB = parseInt(b.rollNumber || '9999', 10);
      return rollA - rollB;
    }),
    [allResults, filterClass, filterSubject, filterExam]
  );

  const handleDelete = async (id: string) => {
    if (!db) return;
    if (!confirm('এই ফলাফল মুছে ফেলবেন?')) return;
    setDeletingId(id);
    try {
      await deleteDoc(doc(db, 'omr_evaluations', id));
      setAllResults(prev => prev.filter(r => r.id !== id));
    } catch (e) {
      alert('মুছতে সমস্যা হয়েছে।');
    } finally {
      setDeletingId(null);
    }
  };

  const handleExportCsv = () => {
    if (!filtered.length) return;
    const headers = ['রোল', 'নাম', 'শ্রেণি', 'বিষয়', 'সেট', 'সঠিক', 'ভুল', 'অনুত্তর', 'প্রাপ্ত নম্বর', 'মোট নম্বর', 'শতকরা (%)', 'গ্রেড'];
    const rows = filtered.map(r => {
      const { grade } = getGrade(r.percentage || 0);
      return [
        `"${r.rollNumber || ''}"`,
        `"${(r.studentName || '').replace(/"/g, '""')}"`,
        `"${r.className || r.classId || ''}"`,
        `"${r.subject || r.examSubtitle || ''}"`,
        `"${r.setCode || ''}"`,
        r.correctCount || 0,
        r.wrongCount || 0,
        r.unansweredCount || 0,
        r.obtainedMarks || 0,
        r.totalMarks || 0,
        (r.percentage || 0).toFixed(1),
        `"${grade}"`
      ].join(',');
    });
    const csvContent = '\uFEFF' + [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const fileName = [filterClass, filterSubject, filterExam, 'ফলাফল'].filter(Boolean).join('_') || 'omr_results';
    link.setAttribute('download', `${fileName}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    const origTitle = document.title;
    const docTitle = [filterClass, filterSubject, filterExam, 'ফলাফল'].filter(Boolean).join(' - ') || 'ওএমআর ফলাফল শিট';
    document.title = docTitle;
    window.print();
    setTimeout(() => { document.title = origTitle; }, 1500);
  };

  const stats = useMemo(() => {
    if (!filtered.length) return null;
    const avg = filtered.reduce((s, r) => s + (r.percentage || 0), 0) / filtered.length;
    const highest = Math.max(...filtered.map(r => r.obtainedMarks || 0));
    const passed = filtered.filter(r => (r.percentage || 0) >= 33).length;
    return { avg: avg.toFixed(1), highest, passed, total: filtered.length };
  }, [filtered]);

  const showClassCol = !filterClass;
  const showExamCol = !filterExam;
  const showSubjectCol = !filterSubject;
  const baseColCount = 3 + (showExamCol ? 1 : 0) + (showSubjectCol ? 1 : 0) + 5; // sl+roll+name + optional + correct+wrong+unansw+marks+pct+grade

  return (
    <div className="min-h-screen bg-slate-100 font-kalpurush print:bg-white">
      {/* ── Toolbar ── */}
      <div className="no-print bg-white border-b shadow-sm px-3 py-2 flex flex-wrap items-center gap-2 sticky top-0 z-10">
        <Button variant="ghost" size="sm" onClick={() => router.back()} className="gap-1.5 font-bold">
          <ArrowLeft className="w-4 h-4" /> ফিরে যান
        </Button>
        <h1 className="text-base font-black text-slate-800 flex items-center gap-2 border-l pl-3">
          <BarChart2 className="w-5 h-5 text-emerald-600" /> ওএমআর ফলাফল শিট
        </h1>
        <div className="ml-auto flex flex-wrap items-center gap-2">
          <Button size="sm" variant="outline" onClick={loadResults} className="gap-1 font-bold text-xs h-8">
            <RefreshCw className="w-3.5 h-3.5" /> রিফ্রেশ
          </Button>
          <Button size="sm" variant="outline" onClick={handleExportCsv} className="gap-1.5 font-bold text-xs h-8 text-emerald-700 border-emerald-300 hover:bg-emerald-50">
            📊 CSV এক্সপোর্ট
          </Button>
          <Button size="sm" onClick={handlePrint}
            className="gap-1.5 font-black text-xs h-8 bg-indigo-600 hover:bg-indigo-700 text-white">
            <Printer className="w-3.5 h-3.5" /> প্রিন্ট করুন
          </Button>
        </div>
      </div>

      <div className="max-w-6xl mx-auto p-3 sm:p-5 space-y-4">
        {/* ── Filter ── */}
        <div className="no-print bg-white rounded-xl border p-3 flex flex-wrap gap-3 items-end shadow-sm">
          <div className="flex-1 min-w-[140px]">
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">শ্রেণি:</label>
            <select
              value={filterClass}
              onChange={(e) => { setFilterClass(e.target.value); setFilterSubject(''); setFilterExam(''); }}
              className="w-full h-9 border rounded-md px-2 text-sm font-bold bg-white"
            >
              <option value="">— সব শ্রেণি —</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[150px]">
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">বিষয়:</label>
            <select
              value={filterSubject}
              onChange={(e) => { setFilterSubject(e.target.value); setFilterExam(''); }}
              className="w-full h-9 border rounded-md px-2 text-sm font-bold bg-white"
            >
              <option value="">— সব বিষয় —</option>
              {subjects.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="flex-1 min-w-[160px]">
            <label className="text-[10px] font-black text-slate-500 uppercase block mb-1">পরীক্ষার নাম:</label>
            <select
              value={filterExam}
              onChange={(e) => setFilterExam(e.target.value)}
              className="w-full h-9 border rounded-md px-2 text-sm font-bold bg-white"
            >
              <option value="">— সব পরীক্ষা —</option>
              {examTitles.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>
          <div className="text-xs font-bold text-slate-500 self-center pt-3">
            মোট: <span className="text-indigo-800 font-black">{toBengaliNumber(filtered.length)}</span> জন
          </div>
        </div>

        {/* ── Print Header ── */}
        <div className="hidden print:block text-center mb-4">
          <h2 className="text-2xl font-black">{filterExam || 'ওএমআর মূল্যায়ন ফলাফল'}</h2>
          <p className="text-sm font-bold text-slate-600">
            {[filterClass, filterSubject, 'ফলাফল শিট'].filter(Boolean).join(' • ')}
          </p>
        </div>

        {/* ── Summary Stats ── */}
        {stats && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'মোট শিক্ষার্থী', value: toBengaliNumber(stats.total), color: 'bg-indigo-600' },
              { label: 'উত্তীর্ণ', value: toBengaliNumber(stats.passed), color: 'bg-emerald-600' },
              { label: 'সর্বোচ্চ নম্বর', value: toBengaliNumber(stats.highest), color: 'bg-amber-500' },
              { label: 'গড় শতাংশ', value: `${stats.avg}%`, color: 'bg-purple-600' },
            ].map(s => (
              <div key={s.label} className={`${s.color} text-white rounded-xl p-3 text-center shadow-sm`}>
                <div className="text-xs font-bold opacity-80">{s.label}</div>
                <div className="text-2xl font-black mt-0.5">{s.value}</div>
              </div>
            ))}
          </div>
        )}

        {/* ── Results Table ── */}
        {loading ? (
          <div className="text-center py-16 text-slate-500 font-bold">
            <RefreshCw className="w-8 h-8 animate-spin mx-auto mb-3 text-indigo-400" />
            ফলাফল লোড হচ্ছে...
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-slate-400 font-bold bg-white rounded-xl border">
            <BarChart2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
            <p>কোনো ফলাফল পাওয়া যায়নি।</p>
            <p className="text-xs mt-1">ওএমআর স্ক্যান করে ফলাফল সেভ করুন।</p>
            <Button className="mt-4" onClick={() => router.push('/omr-sheet')}>ওএমআর শিটে যান</Button>
          </div>
        ) : (
          <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs sm:text-sm">
                <thead>
                  <tr className="bg-indigo-900 text-white">
                    <th className="px-3 py-2.5 text-left font-black">#</th>
                    <th className="px-3 py-2.5 text-left font-black">রোল</th>
                    <th className="px-3 py-2.5 text-left font-black">নাম</th>
                    {showClassCol && <th className="px-3 py-2.5 text-left font-black">শ্রেণি</th>}
                    {showSubjectCol && <th className="px-3 py-2.5 text-left font-black">বিষয়</th>}
                    <th className="px-3 py-2.5 text-center font-black">সেট</th>
                    {showExamCol && <th className="px-3 py-2.5 text-left font-black">পরীক্ষা</th>}
                    <th className="px-3 py-2.5 text-center font-black text-emerald-300">সঠিক</th>
                    <th className="px-3 py-2.5 text-center font-black text-rose-300">ভুল</th>
                    <th className="px-3 py-2.5 text-center font-black text-slate-300">অনুত্তর</th>
                    <th className="px-3 py-2.5 text-center font-black text-amber-300">নম্বর</th>
                    <th className="px-3 py-2.5 text-center font-black text-purple-300">%</th>
                    <th className="px-3 py-2.5 text-center font-black">গ্রেড</th>
                    <th className="px-3 py-2.5 text-center font-black no-print">অ্যাকশন</th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((r, idx) => {
                    const { grade, color } = getGrade(r.percentage || 0);
                    return (
                      <tr key={r.id} className={cn(
                        "border-b transition-colors hover:bg-indigo-50/40",
                        idx % 2 === 0 ? "bg-white" : "bg-slate-50/60"
                      )}>
                        <td className="px-3 py-2 font-black text-slate-400">{toBengaliNumber(idx + 1)}</td>
                        <td className="px-3 py-2 font-black text-indigo-900">{r.rollNumber || '—'}</td>
                        <td className="px-3 py-2 font-bold">{r.studentName || 'অজ্ঞাত'}</td>
                        {showClassCol && <td className="px-3 py-2 text-xs text-slate-600 font-bold">{r.className || r.classId || '—'}</td>}
                        {showSubjectCol && <td className="px-3 py-2 text-xs text-slate-600 font-bold">{r.subject || r.examSubtitle || '—'}</td>}
                        <td className="px-3 py-2 text-center font-black">
                          {r.setCode ? <span className="inline-block px-1.5 py-0.5 rounded bg-indigo-100 text-indigo-800 font-bold text-xs">{r.setCode}</span> : '—'}
                        </td>
                        {showExamCol && <td className="px-3 py-2 text-xs text-slate-600 font-bold max-w-[120px] truncate">{r.examTitle || r.examType}</td>}
                        <td className="px-3 py-2 text-center font-black text-emerald-700">{toBengaliNumber(r.correctCount)}</td>
                        <td className="px-3 py-2 text-center font-black text-rose-600">{toBengaliNumber(r.wrongCount)}</td>
                        <td className="px-3 py-2 text-center font-black text-slate-500">{toBengaliNumber(r.unansweredCount)}</td>
                        <td className="px-3 py-2 text-center font-black text-amber-800">
                          {toBengaliNumber(r.obtainedMarks)}<span className="text-[10px] text-slate-400 font-normal">/{toBengaliNumber(r.totalMarks)}</span>
                        </td>
                        <td className="px-3 py-2 text-center font-black">{(r.percentage || 0).toFixed(1)}%</td>
                        <td className="px-3 py-2 text-center">
                          <span className={cn("px-2 py-0.5 rounded-full text-xs font-black", color)}>{grade}</span>
                        </td>
                        <td className="px-3 py-2 text-center no-print">
                          <div className="flex items-center justify-center gap-1">
                            <button
                              title="এই শিক্ষার্থীর ফলাফল প্রিন্ট"
                              onClick={() => {
                                const win = window.open('', '_blank');
                                if (!win) return;
                                const { grade: g } = getGrade(r.percentage || 0);
                                win.document.write(`<!DOCTYPE html><html><head><title>ফলাফল - ${r.studentName || 'শিক্ষার্থী'}</title>
                                  <style>body{font-family:sans-serif;padding:30px;} table{width:100%;border-collapse:collapse;margin-top:16px;} th,td{border:1px solid #ccc;padding:8px 12px;text-align:center;} th{background:#1e3a5f;color:white;} h2{text-align:center;margin-bottom:4px;} p{text-align:center;color:#555;margin:0 0 16px;}</style>
                                  </head><body>
                                  <h2>${r.examTitle || 'ওএমআর পরীক্ষা'}</h2><p>${r.className ? r.className + ' • ' : ''}${r.subject || r.examSubtitle || ''} ${r.setCode ? '(সেট: ' + r.setCode + ')' : ''}</p>
                                  <table><tr><th>নাম</th><th>রোল</th><th>সেট</th><th>সঠিক</th><th>ভুল</th><th>অনুত্তর</th><th>প্রাপ্ত নম্বর</th><th>শতকরা</th><th>গ্রেড</th></tr>
                                  <tr><td>${r.studentName || 'অজ্ঞাত'}</td><td>${r.rollNumber || '—'}</td><td>${r.setCode || '—'}</td><td>${r.correctCount}</td><td>${r.wrongCount}</td><td>${r.unansweredCount}</td><td>${r.obtainedMarks}/${r.totalMarks}</td><td>${(r.percentage || 0).toFixed(1)}%</td><td>${g}</td></tr>
                                  </table></body></html>`);
                                win.document.close();
                                win.print();
                              }}
                              className="p-1.5 rounded hover:bg-indigo-100 text-indigo-600 transition-colors"
                            >
                              <Printer className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDelete(r.id)}
                              disabled={deletingId === r.id}
                              title="মুছুন"
                              className="p-1.5 rounded hover:bg-rose-100 text-rose-500 transition-colors disabled:opacity-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
                {filtered.length > 1 && (
                  <tfoot>
                    <tr className="bg-slate-100 border-t-2 font-black text-sm">
                      <td colSpan={3 + (showClassCol ? 1 : 0) + (showSubjectCol ? 1 : 0) + 1 + (showExamCol ? 1 : 0)}
                        className="px-3 py-2 text-right text-xs text-slate-700">মোট / গড়:
                      </td>
                      <td className="px-3 py-2 text-center text-emerald-700">
                        {toBengaliNumber(filtered.reduce((s, r) => s + (r.correctCount || 0), 0))}
                      </td>
                      <td className="px-3 py-2 text-center text-rose-600">
                        {toBengaliNumber(filtered.reduce((s, r) => s + (r.wrongCount || 0), 0))}
                      </td>
                      <td className="px-3 py-2 text-center text-slate-500">
                        {toBengaliNumber(filtered.reduce((s, r) => s + (r.unansweredCount || 0), 0))}
                      </td>
                      <td className="px-3 py-2 text-center text-amber-800">
                        {toBengaliNumber(filtered.reduce((s, r) => s + (r.obtainedMarks || 0), 0))}
                      </td>
                      <td className="px-3 py-2 text-center">
                        {(filtered.reduce((s, r) => s + (r.percentage || 0), 0) / filtered.length).toFixed(1)}%
                      </td>
                      <td colSpan={2}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        )}
      </div>

      <style jsx global>{`
        @media print {
          .no-print { display: none !important; }
          @page { size: A4 landscape; margin: 10mm; }
        }
      `}</style>
    </div>
  );
}

export default function OmrResultsPage() {
  return (
    <Suspense fallback={<div className="p-10 text-center font-bold">ফলাফল লোড হচ্ছে...</div>}>
      <OmrResultsContent />
    </Suspense>
  );
}

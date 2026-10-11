'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useFirestore } from '@/firebase';
import { getStudents, Student } from '@/lib/student-data';
import { getStaff, Staff } from '@/lib/staff-data';
import { ALL_SYSTEM_SECTIONS } from '@/components/GlobalAiAssistant';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useAuth } from '@/hooks/useAuth';
import { 
  Dialog, 
  DialogContent 
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { 
  Search, 
  User, 
  GraduationCap, 
  Compass, 
  ArrowRight, 
  Sparkles,
  Command,
  CornerDownLeft,
  X
} from 'lucide-react';

const toBn = (str: string | number | undefined | null) => {
  if (str === undefined || str === null) return '';
  const bn = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bn[parseInt(w, 10)]);
};

export function GlobalCommandPalette() {
  const [open, setOpen] = useState(false);
  const [queryText, setQueryText] = useState('');
  const [students, setStudents] = useState<Student[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);

  const router = useRouter();
  const db = useFirestore();
  const { selectedYear } = useAcademicYear();
  const { user } = useAuth();

  // Preload students & staff only for authenticated users
  useEffect(() => {
    if (!db || !user?.uid) return;
    getStudents(db).then(setStudents).catch(() => {});
    getStaff(db).then(setStaff).catch(() => {});
  }, [db, user?.uid]);

  // Global Ctrl+K / Cmd+K key listener
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((prev) => !prev);
      }
      if (e.key === 'Escape') {
        setOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!user) return null;

  const handleSelectPath = (path: string) => {
    setOpen(false);
    setQueryText('');
    router.push(path);
  };

  // Filter sections
  const filteredSections = useMemo(() => {
    if (!queryText.trim()) return ALL_SYSTEM_SECTIONS.slice(0, 8);
    const q = queryText.toLowerCase().trim();
    return ALL_SYSTEM_SECTIONS.filter(
      (sec) =>
        sec.label.toLowerCase().includes(q) ||
        sec.keywords.some((k) => k.toLowerCase().includes(q))
    ).slice(0, 6);
  }, [queryText]);

  // Filter students
  const filteredStudents = useMemo(() => {
    if (!queryText.trim()) return [];
    const q = queryText.toLowerCase().trim();
    return students
      .filter(
        (s) =>
          (!s.academicYear || s.academicYear === selectedYear) &&
          (String(s.roll) === q ||
            (s.studentNameBn || '').toLowerCase().includes(q) ||
            (s.studentNameEn || '').toLowerCase().includes(q) ||
            (s.guardianMobile || '').includes(q))
      )
      .slice(0, 5);
  }, [students, queryText, selectedYear]);

  // Filter staff
  const filteredStaff = useMemo(() => {
    if (!queryText.trim()) return [];
    const q = queryText.toLowerCase().trim();
    return staff
      .filter(
        (st) =>
          (st.nameBn || '').toLowerCase().includes(q) ||
          (st.designation || '').toLowerCase().includes(q) ||
          (st.subject || '').toLowerCase().includes(q)
      )
      .slice(0, 4);
  }, [staff, queryText]);

  return (
    <>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="p-0 max-w-2xl bg-white/95 backdrop-blur-xl border-2 border-indigo-200 shadow-2xl rounded-2xl overflow-hidden font-kalpurush gap-0 top-[35%]">
          {/* Search Header Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-indigo-100 bg-indigo-50/50">
            <Search className="h-5 w-5 text-indigo-600 shrink-0" />
            <Input
              value={queryText}
              onChange={(e) => setQueryText(e.target.value)}
              placeholder="যেকোনো সেকশন, শিক্ষার্থী বা শিক্ষক খুঁজুন... (যেমন: রেজাল্ট, রোল ৫, রহিম)"
              className="border-0 shadow-none focus-visible:ring-0 text-sm md:text-base font-bold bg-transparent p-0 h-9 placeholder:text-slate-400"
              autoFocus
            />
            {queryText && (
              <button
                onClick={() => setQueryText('')}
                className="text-slate-400 hover:text-slate-600 p-1 rounded-md"
              >
                <X className="h-4 w-4" />
              </button>
            )}
            <Badge variant="outline" className="hidden sm:flex text-[10px] bg-white font-mono px-1.5 py-0.5 border-slate-300">
              ESC
            </Badge>
          </div>

          {/* Results List */}
          <div className="max-h-[380px] overflow-y-auto p-2 divide-y divide-slate-100">
            {/* 1. Students Results */}
            {filteredStudents.length > 0 && (
              <div className="p-2 space-y-1">
                <span className="text-[11px] font-black text-indigo-800 uppercase px-2 flex items-center gap-1.5">
                  <User className="h-3.5 w-3.5 text-indigo-600" /> শিক্ষার্থী ফলাফল
                </span>
                {filteredStudents.map((s) => (
                  <div
                    key={s.id}
                    onClick={() => handleSelectPath(`/student-profile?id=${s.id || s.roll}`)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-indigo-50/80 cursor-pointer transition-all group"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-indigo-100 text-indigo-700 flex items-center justify-center font-black text-xs">
                        {toBn(s.roll)}
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 group-hover:text-indigo-900">
                          {s.studentNameBn || s.studentNameEn}
                        </p>
                        <p className="text-[10px] text-slate-500 font-bold">
                          শ্রেণি: {toBn(s.className)} • পিতা: {s.fatherNameBn || '-'}
                        </p>
                      </div>
                    </div>
                    <span className="text-[11px] text-indigo-600 font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      প্রোফাইল <CornerDownLeft className="h-3 w-3" />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 2. Staff Results */}
            {filteredStaff.length > 0 && (
              <div className="p-2 space-y-1">
                <span className="text-[11px] font-black text-emerald-800 uppercase px-2 flex items-center gap-1.5">
                  <GraduationCap className="h-3.5 w-3.5 text-emerald-600" /> শিক্ষক ও স্টাফ
                </span>
                {filteredStaff.map((st) => (
                  <div
                    key={st.id}
                    onClick={() => handleSelectPath('/staff')}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-emerald-50/80 cursor-pointer transition-all group"
                  >
                    <div>
                      <p className="text-xs font-black text-slate-900 group-hover:text-emerald-900">
                        {st.nameBn}
                      </p>
                      <p className="text-[10px] text-slate-500 font-bold">
                        {st.designation} {st.subject ? `• ${st.subject}` : ''}
                      </p>
                    </div>
                    <span className="text-[11px] text-emerald-600 font-bold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      স্টাফ পোর্টাল <CornerDownLeft className="h-3 w-3" />
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* 3. System Navigation Sections */}
            <div className="p-2 space-y-1">
              <span className="text-[11px] font-black text-slate-600 uppercase px-2 flex items-center gap-1.5">
                <Compass className="h-3.5 w-3.5 text-indigo-600" /> দ্রুত পেজ জাম্প
              </span>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-1">
                {filteredSections.map((sec, idx) => (
                  <div
                    key={idx}
                    onClick={() => handleSelectPath(sec.path)}
                    className="flex items-center justify-between p-2 rounded-xl hover:bg-slate-100 cursor-pointer transition-all group"
                  >
                    <span className="text-xs font-black text-slate-800 group-hover:text-indigo-600 flex items-center gap-1.5">
                      <ArrowRight className="h-3 w-3 text-slate-400 group-hover:text-indigo-600" />
                      {sec.label}
                    </span>
                    <span className="text-[10px] font-mono text-slate-400 group-hover:text-slate-600">
                      {sec.path}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Footer Shortcuts */}
          <div className="bg-slate-50 px-4 py-2 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500 font-bold">
            <span className="flex items-center gap-1">
              <Command className="h-3 w-3 text-indigo-600" /> কুইক সার্চ উইন্ডো
            </span>
            <span className="hidden sm:inline">যেকোনো সময় খুলতে <kbd className="bg-white border rounded px-1 text-[10px] font-mono">Ctrl</kbd> + <kbd className="bg-white border rounded px-1 text-[10px] font-mono">K</kbd> চাপুন</span>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}

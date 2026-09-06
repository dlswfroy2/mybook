'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useFirestore } from '@/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { Student, studentFromDoc } from '@/lib/student-data';
import { useAcademicYear } from '@/context/AcademicYearContext';
import { useSchoolInfo } from '@/context/SchoolInfoContext';
import { Printer, ArrowLeft, FileText, Info, Settings2, Type, FilePen, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Rows3 } from 'lucide-react';
import Link from 'next/link';
import Image from 'next/image';
import { format } from 'date-fns';
import { bn } from 'date-fns/locale';
import { Skeleton } from '@/components/ui/skeleton';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { Separator } from '@/components/ui/separator';

const classNamesMap: { [key: string]: string } = {
  '6': 'ষষ্ঠ', '7': 'সপ্তম', '8': 'অষ্টম', '9': 'নবম', '10': 'দশম',
};

const toBengaliNumber = (str: string | number | undefined | null) => {
  if (!str && str !== 0) return '';
  const bengaliDigits = ['০', '১', '২', '৩', '৪', '৫', '৬', '৭', '৮', '৯'];
  return String(str).replace(/[0-9]/g, (w) => bengaliDigits[parseInt(w, 10)]);
};

export default function TCGeneratorPage() {
  const db = useFirestore();
  const { selectedYear } = useAcademicYear();
  const { schoolInfo } = useSchoolInfo();

  const [isClient, setIsClient] = useState(false);
  const [className, setClassName] = useState<string>('10');
  const [students, setStudents] = useState<Student[]>([]);
  const [selectedStudent, setSelectedStudent] = useState<Student | null>(null);
  const [isLoadingStudents, setIsLoadingStudents] = useState(false);
  const [isEditable, setIsEditable] = useState(false);
  const [editableBody, setEditableBody] = useState<string>('');

  // Customization Settings
  const [customSettings, setCustomSettings] = useState({
    watermarkOpacity: 0.05,
    borderStyle: 'border-double',
    fontSize: 20,
    lineHeight: 2.1,
    bold: false,
    italic: false,
    underline: false,
    color: '#000000',
    align: 'justify',
    borderWidth: 'border-8'
  });

  const [formData, setFormData] = useState({
    smarakNo: `ছাড়পত্র/${new Date().getFullYear()}/`,
    reason: 'অভিভাবকের স্থানান্তর / পারিবারিক কারণ',
    conduct: 'অত্যন্ত প্রশংসনীয় ও সন্তোষজনক',
    status: 'উত্তীর্ণ হয়ে পরবর্তী শ্রেণিতে ভর্তির যোগ্য',
    dues: 'বিদ্যালয়ের সকল দেনা-পাওনা পরিশোধিত',
    issueDate: format(new Date(), "d MMMM, yyyy", { locale: bn })
  });

  useEffect(() => {
    setIsClient(true);
  }, []);

  useEffect(() => {
    if (!db || !className || !isClient) return;

    const fetchStudents = async () => {
      setIsLoadingStudents(true);
      try {
        const q = query(
          collection(db, 'students'),
          where('className', '==', className),
          where('academicYear', '==', selectedYear)
        );
        const snap = await getDocs(q);
        const list = snap.docs.map(studentFromDoc);
        list.sort((a, b) => (Number(a.roll) || 0) - (Number(b.roll) || 0));
        setStudents(list);
        if (list.length > 0) setSelectedStudent(list[0]);
        else setSelectedStudent(null);
      } catch (e) { console.error(e); }
      setIsLoadingStudents(false);
    };
    fetchStudents();
  }, [db, className, selectedYear, isClient]);

  // Sync Content
  const studentDob = useMemo(() => selectedStudent?.dob ? toBengaliNumber(format(new Date(selectedStudent.dob), "d MMMM, yyyy", { locale: bn })) : 'প্রযোজ্য নয়', [selectedStudent]);

  useEffect(() => {
    if (selectedStudent) {
      const defaultBody = `<p class="indent-16">
          এতদ্বারা প্রত্যয়ন করা যাচ্ছে যে, <span class="font-black border-b-2 border-black border-dotted px-2">${selectedStudent.studentNameBn}</span>, 
          পিতা: <span class="border-b-2 border-black border-dotted px-2">${selectedStudent.fatherNameBn}</span>, 
          মাতা: <span class="border-b-2 border-black border-dotted px-2">${selectedStudent.motherNameBn}</span>, 
          গ্রাম: <span class="border-b-2 border-black border-dotted px-2">${selectedStudent.permanentVillage || selectedStudent.presentVillage || 'বিবিধ'}</span>।
      </p>
      <p>
          সে অত্র বিদ্যালয়ে <span class="font-black px-2">${toBengaliNumber(selectedYear)}</span> শিক্ষাবর্ষে <span class="font-black px-2">${classNamesMap[selectedStudent.className] || selectedStudent.className}</span> শ্রেণিতে (রোল নম্বর: <span className="font-black px-2">${toBengaliNumber(selectedStudent.roll)}</span>) নিয়মিত শিক্ষার্থী হিসেবে অধ্যয়ন সম্পন্ন করেছে। বিদ্যালয়ের রেকর্ড অনুযায়ী তার জন্ম তারিখ: <span className="font-black px-2">${studentDob}</span>।
      </p>
      <p>
          আমার জানামতে সে কোনো প্রকার রাষ্ট্রবিরোধী বা প্রতিষ্ঠানিক শৃঙ্খলা-পরিপন্থী কাজের সাথে জড়িত ছিল না। তার চরিত্র <span class="font-black border-b-2 border-black border-dotted px-2">${formData.conduct}</span>। পড়াশোনার অগ্রগতি ও ফলাফল <span class="font-black border-b-2 border-black border-dotted px-2">${formData.status}</span>।
      </p>
      <p>বিদ্যালয় ত্যাগের কারণ: <span className="font-black border-b-2 border-black border-dotted px-2">${formData.reason}</span>। বিদ্যালয়ের পাওনা সংক্রান্ত অবস্থা: <span className="font-black border-b-2 border-black border-dotted px-2">${formData.dues}</span>।</p>
      <p class="italic text-emerald-950 font-black text-center pt-8">
          আমি তার উজ্জ্বল ভবিষ্যৎ ও জীবনের সর্বাঙ্গীণ সাফল্য কামনা করি।
      </p>`;
      setEditableBody(defaultBody);
    }
  }, [selectedStudent, selectedYear, studentDob, formData]);

  const handleFieldChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  const handleFormatting = useCallback((command: string, value: string | null = null) => {
    if (isEditable) {
      document.execCommand(command, false, value || '');
    } else {
      setCustomSettings(prev => {
        const next = { ...prev };
        if (command === 'bold') next.bold = !prev.bold;
        else if (command === 'italic') next.italic = !prev.italic;
        else if (command === 'underline') next.underline = !prev.underline;
        else if (command === 'foreColor') next.color = value || '#000000';
        else if (command.startsWith('justify')) {
          const alignMap: any = { justifyLeft: 'left', justifyCenter: 'center', justifyRight: 'right', justifyFull: 'justify' };
          next.align = alignMap[command];
        }
        return next;
      });
    }
  }, [isEditable]);

  if (!isClient) {
    return (
        <div className="flex min-h-screen w-full flex-col bg-slate-100">
            <main className="p-8">
                <Skeleton className="h-64 w-full rounded-xl" />
            </main>
        </div>
    );
  }

  return (
    <div className="flex min-h-screen w-full flex-col bg-slate-100 font-kalpurush">
      <main className="flex-1 p-4 md:p-8 no-print">
        <div className="max-w-[1400px] mx-auto space-y-6">
            <div className="flex items-center gap-4">
                <Link href="/documents">
                    <Button variant="outline" size="icon" className="border-2 border-b-4 shadow-xl text-primary"><ArrowLeft className="h-4 w-4" /></Button>
                </Link>
                <div>
                    <h1 className="text-2xl font-black text-primary">ছাড়পত্র (TC) জেনারেটর</h1>
                    <p className="text-sm text-muted-foreground">লাইভ প্রিভিউ দেখে ডকুমেন্ট তৈরি করুন</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <Card className="shadow-lg border-2">
                        <CardHeader className="bg-amber-50 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileText className="h-5 w-5 text-amber-700" /> ছাড়পত্রের বিবরণ
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-bold">শ্রেণি</Label>
                                    <Select value={className} onValueChange={setClassName}>
                                        <SelectTrigger className="bg-white"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">শিক্ষার্থী</Label>
                                    <Select value={selectedStudent?.id || ''} onValueChange={(v) => setSelectedStudent(students.find(s => s.id === v) || null)}>
                                        <SelectTrigger className="bg-white"><SelectValue placeholder="সিলেক্ট করুন" /></SelectTrigger>
                                        <SelectContent>
                                            {students.map(s => <SelectItem key={s.id} value={s.id}>রোল {s.roll} - {s.studentNameBn}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-4 border-t pt-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2"><Label className="font-bold">স্মারক নং</Label><Input value={formData.smarakNo} onChange={e => handleFieldChange('smarakNo', e.target.value)} /></div>
                                    <div className="space-y-2"><Label className="font-bold">ইস্যুর তারিখ</Label><Input value={formData.issueDate} onChange={e => handleFieldChange('issueDate', e.target.value)} /></div>
                                </div>
                                <div className="space-y-2"><Label className="font-bold">ত্যাগের কারণ</Label><Input value={formData.reason} onChange={e => handleFieldChange('reason', e.target.value)} /></div>
                                <div className="space-y-2"><Label className="font-bold">আচরণ</Label><Input value={formData.conduct} onChange={e => handleFieldChange('conduct', e.target.value)} /></div>
                                <div className="space-y-2"><Label className="font-bold">অ্যাকাডেমিক অবস্থা</Label><Input value={formData.status} onChange={e => handleFieldChange('status', e.target.value)} /></div>
                                <div className="space-y-2"><Label className="font-bold">দেনা-পাওনা</Label><Input value={formData.dues} onChange={e => handleFieldChange('dues', e.target.value)} /></div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Live Customization Card - Word like tools */}
                    <Card className="shadow-lg border-2 border-amber-200">
                        <CardHeader className="bg-amber-50 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Settings2 className="h-5 w-5 text-amber-700" /> টেক্সট ফরম্যাটিং (Word-like Tools)
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                                <div className="space-y-4">
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs flex items-center gap-2">জলছাপ ব্রাইটনেস</Label>
                                        <Slider value={[customSettings.watermarkOpacity * 100]} min={0} max={20} step={1} onValueChange={([v]) => setCustomSettings(prev => ({ ...prev, watermarkOpacity: v / 100 }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs">টেক্সট অ্যালাইনমেন্ট</Label>
                                        <div className="flex gap-1">
                                          <Button variant={customSettings.align === 'left' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handleFormatting('justifyLeft')}><AlignLeft className="h-4 w-4" /></Button>
                                          <Button variant={customSettings.align === 'center' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handleFormatting('justifyCenter')}><AlignCenter className="h-4 w-4" /></Button>
                                          <Button variant={customSettings.align === 'right' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handleFormatting('justifyRight')}><AlignRight className="h-4 w-4" /></Button>
                                          <Button variant={customSettings.align === 'justify' ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handleFormatting('justifyFull')}><AlignJustify className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs">টেক্সট স্টাইল</Label>
                                        <div className="flex gap-2">
                                            <Button variant={customSettings.bold ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handleFormatting('bold')}><Bold className="h-4 w-4" /></Button>
                                            <Button variant={customSettings.italic ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handleFormatting('italic')}><Italic className="h-4 w-4" /></Button>
                                            <Button variant={customSettings.underline ? 'default' : 'outline'} size="icon" className="h-8 w-8" onClick={() => handleFormatting('underline')}><Underline className="h-4 w-4" /></Button>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <Label className="font-bold text-xs flex items-center gap-2"><Type className="h-4 w-4" /> ফন্ট সাইজ</Label>
                                            <Badge variant="outline" className="font-black h-5">{toBengaliNumber(customSettings.fontSize)}px</Badge>
                                        </div>
                                        <Slider value={[customSettings.fontSize]} min={12} max={36} step={1} onValueChange={([v]) => setCustomSettings(prev => ({ ...prev, fontSize: v }))} />
                                    </div>
                                    <div className="space-y-4">
                                        <div className="flex justify-between items-center">
                                            <Label className="font-bold text-xs flex items-center gap-2"><Rows3 className="h-4 w-4" /> লাইন স্পেসিং</Label>
                                            <Badge variant="outline" className="font-black h-5">{toBengaliNumber(customSettings.lineHeight)}</Badge>
                                        </div>
                                        <Slider value={[customSettings.lineHeight * 10]} min={10} max={40} step={1} onValueChange={([v]) => setCustomSettings(prev => ({ ...prev, lineHeight: v / 10 }))} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold text-xs">রং (Color)</Label>
                                        <input type="color" value={customSettings.color} onChange={(e) => handleFormatting('foreColor', e.target.value)} className="w-full h-8 rounded cursor-pointer" />
                                    </div>
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    <Button onClick={() => window.print()} size="lg" className="w-full font-black h-14 text-xl shadow-xl bg-amber-700 hover:bg-amber-800" disabled={!selectedStudent}>
                        <Printer className="mr-2 h-6 w-6" /> ছাড়পত্র প্রিন্ট করুন
                    </Button>
                </div>

                <div className="sticky top-24">
                    <div className="flex justify-between items-center mb-2 px-1">
                        <h3 className="text-sm font-bold text-muted-foreground flex items-center gap-2">
                            <Info className="h-4 w-4" /> লাইভ প্রিভিউ (A4 সাইজ)
                        </h3>
                        {selectedStudent && (
                            <Button 
                                variant="outline" 
                                size="sm" 
                                className={cn("h-8 font-black gap-2", isEditable ? "bg-amber-100 border-amber-500 text-amber-700" : "bg-white border-2 border-b-4 shadow-xl")}
                                onClick={() => setIsEditable(!isEditable)}
                            >
                                <FilePen className="h-4 w-4" /> {isEditable ? 'এডিট মোড বন্ধ' : 'ম্যানুয়ালি এডিট'}
                            </Button>
                        )}
                    </div>
                    <div className="bg-white border-4 border-black/10 rounded-xl overflow-hidden shadow-2xl origin-top-left scale-[0.45] sm:scale-[0.52] lg:scale-[0.55] xl:scale-[0.7] min-w-[210mm] min-h-[297mm]">
                        {selectedStudent ? (
                            <TCTemplate 
                                student={selectedStudent} 
                                schoolInfo={schoolInfo} 
                                formData={formData} 
                                settings={customSettings} 
                                isEditable={isEditable}
                                content={editableBody}
                                onContentChange={setEditableBody}
                            />
                        ) : (
                            <div className="w-[210mm] h-[297mm] bg-white flex flex-col items-center justify-center text-muted-foreground italic">
                                <Info className="h-12 w-12 mb-4 opacity-10" />
                                <p>শিক্ষার্থী নির্বাচন করুন</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </main>

      <div className="hidden print:block printable-area">
        {selectedStudent && <TCTemplate student={selectedStudent} schoolInfo={schoolInfo} formData={formData} settings={customSettings} content={editableBody} />}
      </div>
    </div>
  );
}

function TCTemplate({ student, schoolInfo, formData, settings, isEditable = false, content, onContentChange }: any) {
    return (
        <div className={cn(
            "tc-container bg-white mx-auto relative text-black flex flex-col p-12 box-border border-emerald-800 font-kalpurush overflow-hidden",
            settings?.borderWidth || 'border-8',
            settings?.borderStyle || 'border-double'
        )}>
            <style jsx global>{`
                @media print {
                    @page { size: A4; margin: 0.5in !important; }
                    html, body { margin: 0 !important; padding: 0 !important; }
                    .printable-area { padding: 0 !important; margin: 0 !important; border: none !important; width: 100% !important; height: auto !important; }
                    .tc-container { width: 100% !important; min-height: 275mm !important; height: auto !important; padding: 10mm !important; border-width: 4px !important; margin: 0 !important; }
                }
                @media screen {
                    .tc-container { width: 210mm; min-height: 297mm; }
                }
            `}</style>

            <div className="text-center border-b-2 border-emerald-800 pb-3 mb-6 flex justify-between items-center px-4">
                <div className="w-20 h-20 relative">{schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" fill className="object-contain" />}</div>
                <div className="flex-grow">
                    <h1 className="text-3xl font-black text-emerald-900 mb-0.5">{schoolInfo.name}</h1>
                    <p className="text-sm font-bold text-gray-700">{schoolInfo.address} | EIIN: {toBengaliNumber(schoolInfo.eiin)}</p>
                </div>
                <div className="w-20 h-20 border border-gray-300 p-0.5 rounded overflow-hidden shadow-sm shrink-0">
                    {student.photoUrl ? (
                        <Image src={student.photoUrl} alt="Student" width={80} height={80} className="object-cover w-full h-full" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">ছবি নেই</div>
                    )}
                </div>
            </div>

            <div className="text-center mb-8"><span className="inline-block bg-emerald-800 text-white text-xl font-bold px-10 py-1.5 rounded-full border-2 border-emerald-900 shadow-sm">ছাড়পত্র (TC)</span></div>

            <div className="flex justify-between font-bold text-sm mb-10 px-4"><span>স্মারক নং: {formData.smarakNo}</span><span>তারিখ: {toBengaliNumber(formData.issueDate)} ইং</span></div>

            {schoolInfo.logoUrl && (
                <div 
                    className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none"
                    style={{ opacity: settings?.watermarkOpacity || 0.05 }}
                >
                    <Image src={schoolInfo.logoUrl} alt="Watermark" width={450} height={450} />
                </div>
            )}

            <div 
                className={cn(
                    "relative z-10 flex-grow space-y-6 font-semibold px-4 text-justify outline-none pb-4 text-slate-900",
                    isEditable && "bg-amber-50/50 p-2 rounded-xl ring-2 ring-amber-200"
                )}
                style={{ 
                  fontSize: `${settings?.fontSize || 20}px`,
                  lineHeight: settings?.lineHeight || 2.1,
                  fontWeight: settings?.bold ? 'bold' : 'inherit',
                  fontStyle: settings?.italic ? 'italic' : 'inherit',
                  textDecoration: settings?.underline ? 'underline' : 'inherit',
                  color: settings?.color || '#000000',
                  textAlign: settings?.align as any || 'justify'
                }}
                contentEditable={isEditable}
                suppressContentEditableWarning={true}
                onBlur={(e) => isEditable && onContentChange?.(e.currentTarget.innerHTML)}
                dangerouslySetInnerHTML={{ __html: content }}
            />

            <footer className="relative z-10 px-10 bg-white pb-6 pt-12 print:pt-6 mt-auto">
                <div className="flex justify-around items-end">
                    <div className="text-center">
                        <div className="w-48 border-t border-black pt-1 font-bold text-sm">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                        <div className="w-48 border-t border-black pt-1 font-bold">
                            <p className="text-sm">প্রধান শিক্ষকের স্বাক্ষর ও সিল</p>
                        </div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

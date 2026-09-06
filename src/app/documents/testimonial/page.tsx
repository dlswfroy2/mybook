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
import { Printer, ArrowLeft, GraduationCap, Info, FileBadge, Settings2, Type, FilePen, Bold, Italic, Underline, AlignLeft, AlignCenter, AlignRight, AlignJustify, Rows3 } from 'lucide-react';
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

export default function TestimonialGeneratorPage() {
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
    smarak: `প্রত্যয়ন/${new Date().getFullYear()}/`,
    conduct: 'অত্যন্ত প্রশংসনীয় ও সন্তোষজনক',
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
      } catch (e) {
        console.error('Error fetching students:', e);
      } finally {
        setIsLoadingStudents(false);
      }
    };

    fetchStudents();
  }, [db, className, selectedYear, isClient]);

  // Construct and Sync Default Content
  const studentDob = useMemo(() => selectedStudent?.dob ? toBengaliNumber(format(new Date(selectedStudent.dob), "d MMMM, yyyy", { locale: bn })) : 'প্রযোজ্য নয়', [selectedStudent]);
  
  useEffect(() => {
    if (selectedStudent) {
      const defaultBody = `<p class="indent-16">
          এতদ্বারা প্রত্যয়ন করা যাচ্ছে যে, <span class="text-2xl font-black border-b-2 border-black border-dotted px-2">${selectedStudent.studentNameBn}</span>, 
          পিতা: <span class="border-b-2 border-black border-dotted px-2">${selectedStudent.fatherNameBn}</span>, 
          মাতা: <span class="border-b-2 border-black border-dotted px-2">${selectedStudent.motherNameBn}</span>, 
          গ্রাম: <span class="border-b-2 border-black border-dotted px-2">${selectedStudent.permanentVillage || selectedStudent.presentVillage || 'বিবিধ'}</span>, 
          ডাকঘর: <span class="border-b-2 border-black border-dotted px-2">${selectedStudent.presentPostOffice || selectedStudent.permanentPostOffice || 'বিবিধ'}</span>, 
          উপজেলা: <span class="border-b-2 border-black border-dotted px-2">${selectedStudent.permanentUpazila || selectedStudent.presentUpazila || ''}</span>, 
          জেলা: <span class="border-b-2 border-black border-dotted px-2">${selectedStudent.permanentDistrict || selectedStudent.presentDistrict || ''}</span>।
      </p>
      <p>
          সে অত্র বিদ্যালয়ে <span class="text-2xl font-black px-2">${toBengaliNumber(selectedYear)}</span> শিক্ষাবর্ষে <span class="text-2xl font-black px-2">${classNamesMap[selectedStudent.className] || selectedStudent.className}</span> শ্রেণিতে (রোল নম্বর: <span className="font-black px-2">${toBengaliNumber(selectedStudent.roll)}</span>) নিয়মিত শিক্ষার্থী হিসেবে অধ্যয়নরত আছে। বিদ্যালয়ের রেকর্ড অনুযায়ী তার জন্ম তারিখ: <span className="font-black px-2">${studentDob}</span>।
      </p>
      <p>
          আমার জানামতে সে কোনো প্রকার রাষ্ট্রবিরোধী বা প্রতিষ্ঠানিক শৃঙ্খলা-পরিপন্থী কাজের সাথে জড়িত ছিল না। তার চরিত্র <span class="text-2xl font-black px-2 border-b-2 border-black border-dotted">${formData.conduct}</span>।
      </p>
      <p class="italic text-emerald-950 text-2xl font-black text-center pt-6">
          আমি তার উজ্জ্বল ভবিষ্যৎ ও জীবনের সর্বাঙ্গীণ সাফল্য কামনা করি।
      </p>`;
      setEditableBody(defaultBody);
    }
  }, [selectedStudent, selectedYear, studentDob, formData.conduct]);

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
                    <h1 className="text-2xl font-black text-primary">প্রত্যয়ন পত্র (Testimonial) জেনারেটর</h1>
                    <p className="text-sm text-muted-foreground">লাইভ প্রিভিউ দেখে ডকুমেন্ট তৈরি ও প্রিন্ট করুন</p>
                </div>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                <div className="space-y-6">
                    <Card className="shadow-lg border-2">
                        <CardHeader className="bg-primary/5 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <FileBadge className="h-5 w-5 text-primary" /> তথ্য ও বিবরণ
                            </CardTitle>
                        </CardHeader>
                        <CardContent className="p-6 space-y-6">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="space-y-2">
                                    <Label className="font-bold">১. শ্রেণি নির্বাচন করুন</Label>
                                    <Select value={className} onValueChange={setClassName}>
                                        <SelectTrigger className="bg-white"><SelectValue placeholder="শ্রেণি" /></SelectTrigger>
                                        <SelectContent>
                                            {Object.entries(classNamesMap).map(([v, l]) => <SelectItem key={v} value={v}>{l} শ্রেণি</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">২. শিক্ষার্থী নির্বাচন করুন</Label>
                                    <Select 
                                        value={selectedStudent?.id || ''} 
                                        onValueChange={(val) => setSelectedStudent(students.find(s => s.id === val) || null)}
                                        disabled={students.length === 0}
                                    >
                                        <SelectTrigger className="bg-white">
                                            <SelectValue placeholder={isLoadingStudents ? "লোড হচ্ছে..." : (students.length === 0 ? "শিক্ষার্থী নেই" : "শিক্ষার্থী সিলেক্ট করুন")} />
                                        </SelectTrigger>
                                        <SelectContent>
                                            {students.map(s => <SelectItem key={s.id} value={s.id}>রোল {s.roll} - {s.studentNameBn}</SelectItem>)}
                                        </SelectContent>
                                    </Select>
                                </div>
                            </div>

                            <div className="space-y-4 border-t pt-4">
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <Label className="font-bold">স্মারক নম্বর</Label>
                                        <Input value={formData.smarak} onChange={(e) => handleFieldChange('smarak', e.target.value)} />
                                    </div>
                                    <div className="space-y-2">
                                        <Label className="font-bold">ইস্যুর তারিখ</Label>
                                        <Input value={formData.issueDate} onChange={(e) => handleFieldChange('issueDate', e.target.value)} />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <Label className="font-bold">আচরণ ও চরিত্র</Label>
                                    <Input value={formData.conduct} onChange={(e) => handleFieldChange('conduct', e.target.value)} placeholder="উদা: অত্যন্ত প্রশংসনীয় ও সন্তোষজনক" />
                                </div>
                            </div>
                        </CardContent>
                    </Card>

                    {/* Live Customization Card - Word like tools */}
                    <Card className="shadow-lg border-2 border-primary/10">
                        <CardHeader className="bg-muted/30 border-b">
                            <CardTitle className="text-lg flex items-center gap-2">
                                <Settings2 className="h-5 w-5 text-primary" /> টেক্সট ফরম্যাটিং (Word-like Tools)
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

                    <Button onClick={() => window.print()} size="lg" className="w-full font-black shadow-xl h-14 text-xl" disabled={!selectedStudent}>
                        <Printer className="mr-2 h-6 w-6" /> প্রত্যয়ন পত্র প্রিন্ট করুন
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
                            <TestimonialTemplate 
                                student={selectedStudent} 
                                schoolInfo={schoolInfo} 
                                formData={formData} 
                                selectedYear={selectedYear}
                                settings={customSettings}
                                isEditable={isEditable}
                                content={editableBody}
                                onContentChange={setEditableBody}
                            />
                        ) : (
                            <div className="w-[210mm] h-[297mm] flex flex-col items-center justify-center bg-white text-muted-foreground gap-4">
                                <GraduationCap className="h-16 w-16 opacity-10" />
                                <p className="font-bold">শিক্ষার্থী সিলেক্ট করলে এখানে প্রিভিউ দেখা যাবে</p>
                            </div>
                        )}
                    </div>
                </div>
            </div>
        </div>
      </main>

      <div className="hidden print:block printable-area">
        {selectedStudent && (
            <TestimonialTemplate 
                student={selectedStudent} 
                schoolInfo={schoolInfo} 
                formData={formData} 
                selectedYear={selectedYear}
                settings={customSettings}
                content={editableBody}
            />
        )}
      </div>
    </div>
  );
}

function TestimonialTemplate({ student, schoolInfo, formData, selectedYear, settings, isEditable = false, content, onContentChange }: any) {
    return (
        <div className={cn(
            "testimonial-container bg-white mx-auto relative text-black flex flex-col p-10 box-border border-emerald-900 overflow-hidden font-kalpurush",
            settings?.borderWidth || 'border-8',
            settings?.borderStyle || 'border-double'
        )}>
            <style jsx global>{`
                @media print {
                    @page { size: A4; margin: 0.5in !important; }
                    html, body { margin: 0 !important; padding: 0 !important; }
                    .printable-area { padding: 0 !important; margin: 0 !important; border: none !important; width: 100% !important; height: auto !important; }
                    .testimonial-container { width: 100% !important; min-height: 275mm !important; height: auto !important; padding: 10mm !important; border-width: 4px !important; margin: 0 !important; }
                }
                @media screen {
                    .testimonial-container { width: 210mm; min-height: 297mm; }
                }
            `}</style>

            <div className="text-center border-b-4 border-emerald-900 pb-3 mb-6 relative z-10 flex justify-between items-center px-4">
                <div className="w-24 h-24 relative">
                    {schoolInfo.logoUrl && <Image src={schoolInfo.logoUrl} alt="Logo" fill className="object-contain" />}
                </div>
                <div className="flex-grow text-center">
                    <h1 className="text-4xl font-black text-emerald-900 mb-0.5 leading-tight">{schoolInfo.name}</h1>
                    <p className="text-lg font-bold text-gray-700">{schoolInfo.address}</p>
                    <p className="text-sm font-bold text-gray-600 mt-0.5">
                        EIIN: {toBengaliNumber(schoolInfo.eiin)} | স্থাপিত: ২০১৯ ইং
                    </p>
                </div>
                <div className="w-24 h-24 border-2 border-black p-0.5 rounded overflow-hidden shadow-sm">
                    {student.photoUrl ? (
                        <Image src={student.photoUrl} alt="Student" width={96} height={96} className="object-cover w-full h-full" />
                    ) : (
                        <div className="w-full h-full flex items-center justify-center text-[10px] text-gray-400">ছবি</div>
                    )}
                </div>
            </div>

            <div className="flex justify-between font-bold text-sm mb-6 relative z-10 px-4">
                <span>স্মারক নং: {formData.smarak}</span>
                <span>তারিখ: {toBengaliNumber(formData.issueDate)} ইং</span>
            </div>

            {schoolInfo.logoUrl && (
                <div 
                    className="absolute inset-0 flex items-center justify-center z-0 pointer-events-none"
                    style={{ opacity: settings?.watermarkOpacity || 0.05 }}
                >
                    <Image src={schoolInfo.logoUrl} alt="Watermark" width={500} height={500} />
                </div>
            )}

            <div className="relative z-10 text-center mb-6">
                <h2 className="inline-block text-3xl font-black border-b-4 border-black pb-1.5 px-12 uppercase tracking-widest">প্রত্যয়ন পত্র</h2>
            </div>

            <div 
                className={cn(
                    "relative z-10 flex-grow text-justify font-semibold px-4 outline-none pb-4 text-slate-900",
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

            <footer className="relative z-10 px-16 bg-white pb-6 pt-12 print:pt-6 mt-auto">
                <div className="flex justify-between items-end">
                    <div className="text-center">
                        <div className="w-56 border-t-2 border-black pt-1.5 font-black text-lg text-gray-800">শ্রেণি শিক্ষকের স্বাক্ষর</div>
                    </div>
                    <div className="text-center">
                        <div className="w-56 border-t-2 border-black pt-1.5 font-black text-lg text-gray-800">প্রধান শিক্ষকের স্বাক্ষর ও সিল</div>
                    </div>
                </div>
            </footer>
        </div>
    );
}

'use server';
/**
 * @fileOverview A multi-tasking AI agent for school administration.
 * Extracts data from images, PDFs, or text for attendance, results, admission, and fees.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MultiTaskAiInputSchema = z.object({
  photoDataUri: z.string().optional().describe("Image or PDF as data URI (base64)"),
  rawText: z.string().optional().describe("Manual text instructions or raw data to process"),
  taskType: z.enum(['attendance', 'results', 'admission', 'fees']).describe("The administrative task to perform"),
  academicYear: z.string().optional().describe("Current academic year (e.g. 2026)"),
});

export type MultiTaskAiInput = z.infer<typeof MultiTaskAiInputSchema>;

export const multiTaskAiFlow = ai.defineFlow(
  {
    name: 'multiTaskAiFlow',
    inputSchema: MultiTaskAiInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    const parts: any[] = [];
    if (input.photoDataUri) {
      parts.push({ media: { url: input.photoDataUri } });
    }

    const year = input.academicYear || '2026';

    const taskInstructions: Record<string, string> = {
      attendance: `TASK: ATTENDANCE EXTRACTION (হাজিরা গ্রহণ - হস্তলিখিত ও মুদ্রিত উভয় প্রকার)
1. DATES IDENTIFICATION (তারিখ শনাক্তকরণ - অত্যন্ত গুরুত্বপূর্ণ):
   - Documents or images may contain ONE or MULTIPLE dates in various formats (হাতে লেখা বা টাইপ করা):
     * Comma/slash/dot separated: '01.02, 03' (1st and 3rd Feb), '01/02, 02/02, 03/02', '01/02/26', '01-02-26', '1, 2, 3 Feb'.
     * Bengali dates or month names: '১লা ফেব্রুয়ারি', '২রা ফেব্রুয়ারি', 'মার্চ', 'ফেব্রুয়ারি ২০২৬'.
     * Register columns: day columns (1..31) under a month name.
   - For ANY format, convert every date into standard ISO 'YYYY-MM-DD' (using academic year ${year}).
   - Always return:
     * dates: Array of all detected dates in 'YYYY-MM-DD' order (e.g. ["${year}-02-01", "${year}-02-02", "${year}-02-03"]).
     * date: The primary date (first date or latest marked date) in 'YYYY-MM-DD'.
     * monthName: Bengali month name if mentioned or implied (e.g. 'জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', ইত্যাদি).
     * attendanceByDate: If attendance is recorded per date, an array of objects:
       [{ date: "${year}-02-01", presentRolls: [1, 2, 3], absentRolls: [4] }, { date: "${year}-02-02", presentRolls: [1, 3], absentRolls: [2, 4] }]

2. MULTI-CLASS & HANDWRITING RECOGNITION (একাধিক শ্রেণি ও হাতের লেখা শনাক্তকরণ):
   - HANDWRITING: Accurately read handwritten Bengali rolls (১, ২, ৩...), handwritten names, and attendance marks (টিক চিহ্ন ✓, P, উপস্থিত, cross ✗, A, অনুপস্থিত, বা ফাঁকা ঘর)।
   - MULTIPLE CLASSES SUPPORT: If the document contains attendance for MORE THAN ONE CLASS (e.g. ৬ষ্ঠ ও ৭ম শ্রেণি একসাথে, বা একাধিক শ্রেণির রোল লেখা আছে):
     * Extract attendance grouped by class in 'classesAttendance' array:
       [
         { className: "6", presentRolls: [1, 2, 3], absentRolls: [4], students: [{ roll: 1, name: "...", status: "present" }] },
         { className: "7", presentRolls: [1, 5], absentRolls: [2], students: [{ roll: 1, name: "...", status: "present" }] }
       ]
   - IF SINGLE CLASS:
     * Set className ('6', '7', '8', '9', '10' or null if not written).
     * If no class is explicitly written, set className to null; the system will match student names and rolls with database.
   - For EVERY student in the document, extract:
     * roll: integer (convert Bengali digits ১..১০ to standard 1..10)
     * name: student name in Bengali (hastily handwritten names should be interpreted to closest Bengali phonetic match)
     * className: class if identifiable ('6', '7', '8', '9', '10') or null
     * status: 'present' (if marked P, উপস্থিত, টিকচিহ্ন ✓, বা রোল লেখা আছে), or 'absent' (if marked A, অনুপস্থিত, ক্রস ✗, বা ফাঁকা).
   - presentRolls: array of present roll numbers (e.g. [1, 2, 3])
   - absentRolls: array of absent roll numbers (e.g. [4])
   - totalStudents, totalPresent, totalAbsent
   - description: Bengali summary of what was extracted (e.g. '৬ষ্ঠ শ্রেণির ১০ জন ও ৭ম শ্রেণির ১২ জন শিক্ষার্থীর হাজিরা শনাক্ত হয়েছে।')
   - actionPlan: "নির্দিষ্ট শ্রেণি ও তারিখসমূহ অনুযায়ী স্বয়ংক্রিয়ভাবে ডাটাবেজে সংরক্ষণ করা হবে।"`,

      fees: `TASK: FEE PAYMENT EXTRACTION (বেতন আদায়)
1. DATES & MONTH:
   - Identify payment date (YYYY-MM-DD). If day/month notation (01.02, 01/02), format as ${year}-MM-DD.
   - dates: Array of all payment dates found.
   - date: Primary payment date.
   - monthName: Bengali fee month name (যেমন 'জানুয়ারি', 'ফেব্রুয়ারি').
2. CLASS & STUDENTS:
   - Identify student roll, name, className ('6'..'10' or null if missing).
3. HOW:
   - collections: array of [{ roll: number, name: string, className: string | null, amount: number, feeHead: string, month: string, date: string }]
   - totalAmount: sum of amounts
   - description: Bengali summary of payment records.
   - actionPlan: "শিক্ষার্থীর বেতন আদায় ভাউচারে ডাটা যুক্ত হবে।"`,

      results: `TASK: EXAM RESULTS EXTRACTION (ফলাফল ইনপুট)
1. DATES & EXAM:
   - Exam Name (অর্ধবার্ষিক, বার্ষিক, প্রাক-নির্বাচনী, নির্বাচনী), Subject (বিষয়), Date (YYYY-MM-DD if present).
   - dates: Array of dates found.
2. CLASS & STUDENTS:
   - Class ('6'..'10' or null if missing).
   - results: [{ roll: number, name: string, written: number, mcq: number, practical: number, total: number }]
   - description: Bengali summary of marks detected.
   - actionPlan: "পরীক্ষার ফলাফল এন্ট্রি টেবিলে ডাটা যুক্ত হবে।"`,

      admission: `TASK: ADMISSION FORM EXTRACTION (নতুন ভর্তি)
1. DETAILS:
   - Class ('6'..'10'), academicYear ('${year}').
   - student: { studentNameBn: string, fatherNameBn: string, motherNameBn: string, roll: number, phone: string, className: string, address: string }
   - description: Bengali summary of student admission form.
   - actionPlan: "শিক্ষার্থী ভর্তি রেজিস্টারে নতুন প্রোফাইল তৈরি হবে।"`,
    };

    const taskPrompt = taskInstructions[input.taskType] || taskInstructions.attendance;

    parts.push({
      text: `You are an expert school administrative AI assistant in Bangladesh.
Academic Year: ${year}.

Your mission is to analyze this document (image, PDF, or text) and determine WHERE, HOW, and TO WHOM the data should be assigned.

${taskPrompt}

ADDITIONAL USER INSTRUCTIONS:
${input.rawText || 'None provided'}

GENERAL RULES:
- Convert all Bengali numbers (০-৯) to standard integers (0-9).
- Accurately read handwritten or printed Bengali names and rolls.
- MULTI-DATE SUPPORT: If multiple dates appear (e.g. '01.02, 03' -> ['${year}-02-01', '${year}-02-03']), include all in 'dates' array.
- BENGALI MONTHS: If Bengali month names are written (জানুয়ারি=01, ফেব্রুয়ারি=02, মার্চ=03, এপ্রিল=04, মে=05, জুন=06, জুলাই=07, আগস্ট=08, সেপ্টেম্বর=09, অক্টোবর=10, নভেম্বর=11, ডিসেম্বর=12), map them accurately.
- Output MUST be valid JSON only, without any markdown formatting or surrounding backticks.`
    });

    const response = await ai.generate({
      prompt: parts,
      config: {
        responseMimeType: 'application/json',
      },
    });

    const text = response.text?.trim() || '';
    if (!text) {
      return { error: 'এআই থেকে কোনো তথ্য পাওয়া যায়নি।' };
    }

    try {
      const cleanJson = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      return { error: 'এআই রেসপন্স পার্স করতে ব্যর্থ হয়েছে।', raw: text };
    }
  }
);

/**
 * Server action to run the multi-task AI flow.
 */
export async function runMultiTaskAi(input: MultiTaskAiInput) {
  try {
    return await multiTaskAiFlow(input);
  } catch (error: any) {
    console.error("AI Error:", error);
    const msg = error?.message || 'AI প্রসেসিং ব্যর্থ হয়েছে।';
    return { error: `AI ত্রুটি: ${msg}` };
  }
}


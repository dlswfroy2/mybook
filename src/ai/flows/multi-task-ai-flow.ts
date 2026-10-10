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

    const taskInstructions: Record<string, string> = {
      attendance: `TASK: ATTENDANCE EXTRACTION (হাজিরা গ্রহণ)
1. WHERE (কোথায়):
   - Identify the Class (শ্রেণি: '6', '7', '8', '9', '10') from document header/text. If uncertain, leave as '6'.
   - Identify Date (YYYY-MM-DD) or Month (e.g. March/মার্চ) or Day column (1..31). If the image is a monthly register table with day columns, pick the latest marked day column or today's day number.
2. TO WHOM (কার কাছে):
   - For EVERY student in the image/text, extract:
     * roll: integer number (convert Bengali digits ১..১০ to 1..10)
     * name: student name in Bengali
     * status: 'present' if marked 'P' / 'উপস্থিত' / '✓'; 'absent' if marked 'A' / 'অনুপস্থিত' / '✗' / blank.
3. HOW (কিভাবে):
   - presentRolls: array of present roll numbers (e.g. [1, 3, 4])
   - absentRolls: array of absent roll numbers (e.g. [2])
   - totalStudents, totalPresent, totalAbsent
   - description: Bengali natural language explanation of what was extracted from the image.
   - actionPlan: "শ্রেণি অনুযায়ী হাজিরা সিস্টেমে স্বয়ংক্রিয়ভাবে ইনপুট দেওয়া হবে।"`,

      fees: `TASK: FEE PAYMENT EXTRACTION (বেতন আদায়)
1. WHERE (কোথায়):
   - Target: হিসাব শাখা (Accounts / Fee Collection)
   - Date: Payment date (YYYY-MM-DD)
2. TO WHOM (কার কাছে):
   - Identify student by roll, name, and className (6-10).
3. HOW (কিভাবে):
   - collections: array of [{ roll: number, name: string, className: string, amount: number, feeHead: string (যেমন মাসিক বেতন, ভর্তি ফি), month: string }]
   - totalAmount: sum of amounts
   - description: Bengali summary of payment details.
   - actionPlan: "শিক্ষার্থীর বেতন আদায় ভাউচারে ডাটা যুক্ত হবে।"`,

      results: `TASK: EXAM RESULTS EXTRACTION (ফলাফল ইনপুট)
1. WHERE (কোথায়):
   - Class (6-10), Exam Name (যেমন অর্ধবার্ষিক, বার্ষিক, প্রাক-নির্বাচনী), Subject (বিষয়).
2. TO WHOM (কার কাছে):
   - List of students with roll and name.
3. HOW (কিভাবে):
   - results: [{ roll: number, name: string, written: number, mcq: number, practical: number, total: number }]
   - description: Bengali summary of marks detected.
   - actionPlan: "পরীক্ষার ফলাফল এন্ট্রি টেবিলে ডাটা যুক্ত হবে।"`,

      admission: `TASK: ADMISSION FORM EXTRACTION (নতুন ভর্তি)
1. WHERE (কোথায়):
   - Class for admission (6-10), academicYear.
2. TO WHOM (কার কাছে):
   - student: { studentNameBn: string, fatherNameBn: string, motherNameBn: string, roll: number, phone: string, className: string, address: string }
3. HOW (কিভাবে):
   - description: Bengali summary of student details.
   - actionPlan: "শিক্ষার্থী ভর্তি রেজিস্টারে নতুন প্রোফাইল তৈরি হবে।"`,
    };

    const taskPrompt = taskInstructions[input.taskType] || taskInstructions.attendance;

    parts.push({
      text: `You are an expert school administrative AI assistant in Bangladesh.
Your mission is to analyze this document (image, PDF, or text) and determine WHERE, HOW, and TO WHOM the data should be assigned.

${taskPrompt}

ADDITIONAL USER INSTRUCTIONS:
${input.rawText || 'None provided'}

GENERAL RULES:
- Convert all Bengali numbers (০-৯) to standard numbers (0-9).
- Accurately read handwritten or printed Bengali names and rolls.
- If a table has multiple day columns, extract the latest marked day column or specified day.
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
  } catch (error) {
    console.error("AI Error:", error);
    throw new Error('AI প্রসেসিং ব্যর্থ হয়েছে।');
  }
}

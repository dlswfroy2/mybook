'use server';
/**
 * @fileOverview A multi-tasking AI agent for school administration.
 * Extracts data from images for attendance, results, admission, and fees.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';

const MultiTaskAiInputSchema = z.object({
  photoDataUri: z.string().describe("Image as data URI (base64)"),
  taskType: z.enum(['attendance', 'results', 'admission', 'fees']).describe("The administrative task to perform"),
});

export type MultiTaskAiInput = z.infer<typeof MultiTaskAiInputSchema>;

const prompt = ai.definePrompt({
  name: 'multiTaskAiPrompt',
  input: { schema: MultiTaskAiInputSchema },
  prompt: `You are an intelligent school administrative assistant. 
  Your task is to analyze the provided image and extract information for the specific task: {{taskType}}.

  INSTRUCTIONS FOR EACH TASK:
  1. 'attendance': Find handwritten or printed roll numbers and their status (P/A, or present/absent). Return as JSON: { "students": [{ "roll": number, "status": "present" | "absent" }] }.
  2. 'results': Find student roll numbers and their marks in written, mcq, and practical. Return as JSON: { "results": [{ "roll": number, "written": number, "mcq": number, "practical": number }] }.
  3. 'admission': Extract student personal details from a filled admission form. Return as JSON: { "student": { "studentNameBn": "...", "fatherNameBn": "...", "roll": number, "phone": "...", "className": "6-10" } }.
  4. 'fees': Extract fee payment details. Return as JSON: { "collections": [{ "roll": number, "amount": number, "month": "Bengali Month Name" }] }.

  CRITICAL: 
  - Return ONLY raw JSON code. No explanations or markdown markers.
  - Interpret Bengali numbers (০-৯) correctly and convert to standard numeric values.
  - If a value is missing, use null or omit the field.

  Image: {{media url=photoDataUri}}`,
});

export const multiTaskAiFlow = ai.defineFlow(
  {
    name: 'multiTaskAiFlow',
    inputSchema: MultiTaskAiInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    const { text } = await prompt(input);
    if (!text) return { error: "AI failed to parse image" };
    
    try {
      const cleanJson = text.replace(/```json|```/g, '').trim();
      return JSON.parse(cleanJson);
    } catch (e) {
      return { error: "Invalid JSON format from AI", raw: text };
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

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

const prompt = ai.definePrompt({
  name: 'multiTaskAiPrompt',
  input: { schema: MultiTaskAiInputSchema },
  prompt: `You are an intelligent school administrative assistant. 
  Your task is to analyze the provided input (image, PDF, or text) and extract information for the specific task: {{taskType}}.

  GENERAL EXTRACTION RULES:
  - ALWAYS identify and extract the Date (e.g., 2026-03-12), Month (e.g., March/মার্চ), and Class (e.g., 6-10) if present in the input.
  - If text instructions are provided in 'rawText', follow them strictly (e.g., "Roll 1 to 5 absent" means rolls 1,2,3,4,5 are absent).
  - Interpret Bengali numbers (০-৯) correctly and convert to standard numeric values.
  - Return ONLY raw JSON code. No explanations or markdown markers.

  INSTRUCTIONS FOR EACH TASK:
  1. 'attendance': Find handwritten or printed roll numbers and their status (P/A, or present/absent). 
     Return JSON: { "date": "YYYY-MM-DD", "month": "string", "className": "6-10", "students": [{ "roll": number, "status": "present" | "absent" }] }.
  
  2. 'results': Find student roll numbers and their marks. 
     Return JSON: { "date": "YYYY-MM-DD", "class": "string", "results": [{ "roll": number, "written": number, "mcq": number, "practical": number }] }.
  
  3. 'admission': Extract student personal details from a filled admission form or descriptive text. 
     Return JSON: { "student": { "studentNameBn": "...", "fatherNameBn": "...", "roll": number, "phone": "...", "className": "6-10" } }.
  
  4. 'fees': Extract fee payment details from receipts or text. 
     Return JSON: { "date": "YYYY-MM-DD", "collections": [{ "roll": number, "amount": number, "month": "Bengali Month Name" }] }.

  Input Data:
  {{#if photoDataUri}} File: {{media url=photoDataUri}} {{/if}}
  {{#if rawText}} Text Instructions: {{{rawText}}} {{/if}}`,
});

export const multiTaskAiFlow = ai.defineFlow(
  {
    name: 'multiTaskAiFlow',
    inputSchema: MultiTaskAiInputSchema,
    outputSchema: z.any(),
  },
  async (input) => {
    const { text } = await prompt(input);
    if (!text) return { error: "AI failed to parse input" };
    
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

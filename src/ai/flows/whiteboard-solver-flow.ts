'use server';

/**
 * @fileOverview High-power AI OCR and Academic Problem Solver for the Whiteboard module.
 * Uses Gemini Vision to directly read handwritten/typed text, math formulas,
 * science problems, diagrams and provides clean, rigorous step-by-step solutions
 * completely free of raw LaTeX artifacts ($$, \mathbf, \qquad, etc.).
 */

import { createAiClient, getAvailableApiKeys } from '@/ai/genkit';

const OCR_PROMPT = `তুমি একজন বিশ্বমানের অ্যাকাডেমিক ও বৈজ্ঞানিক OCR বিশেষজ্ঞ AI। 
হোয়াইটবোর্ডের দেওয়া ছবিটিতে শিক্ষক বা শিক্ষার্থী যা কিছু লিখেছেন (হাতে লেখা বা টাইপকৃত টেক্সট, অংক, সমীকরণ, জ্যামিতিক তথ্য, বিজ্ঞান/হিসাববিজ্ঞানের সূত্র বা প্রশ্ন) তা অত্যন্ত গভীরভাবে ও নিখুঁতভাবে উদ্ধার করো।

কঠোর নিয়মাবলী:
১. কোনো প্রকার কাঁচা LaTeX কোড বা সাংকেতিক চিহ্ন (যেমন: $$, $, \\mathbf, \\text, \\qquad, \\dots, \\frac ইত্যাদি) ব্যবহার করবে না।
২. সাধারণ পাঠ্যপুস্তকের মতো পরিষ্কার ও স্বাভাবিক গাণিতিক সমীকরণ লিখবে (যেমন: (a + b)² = a² + 2ab + b²)।
৩. স্কয়ার বা ঘাতের জন্য সাধারণ ইউনিকোড লিখবে (², ³, ⁴, ⁿ)।
৪. কোনো অপ্রয়োজনীয় ভূমিকা বা সমাপ্তি ছাড়া শুধুমাত্র উদ্ধারকৃত বিষয়বস্তু পরিচ্ছন্ন বাংলায় উপস্থাপন করো।`;

const SOLVER_PROMPT = `তুমি একজন শীর্ষস্থানীয় সর্বজনীন অ্যাকাডেমিক শিক্ষক ও বিশেষজ্ঞ AI (স্কুল, কলেজ ও বিশ্ববিদ্যালয় স্তরের সকল বিষয়ের শিক্ষক)।
হোয়াইটবোর্ডের ছবিটিতে যে প্রশ্ন, অংক, তত্ত্ব বা সমস্যা উপস্থাপন করা হয়েছে (তা গণিত, পদার্থবিজ্ঞান, রসায়ন, জীববিজ্ঞান, হিসাববিজ্ঞান, ফিন্যান্স, ইংরেজি, বাংলা, আইসিটি, মানবিক বা যেকোনো বিষয়ের হতে পারে), তা গভীরভাবে বিশ্লেষণ করে অত্যন্ত পরিষ্কার, নির্ভুল ও পূর্ণাঙ্গ সমাধান দাও।

কঠোর নিষেধাজ্ঞা (কোনো অপ্রয়োজনীয় কোড বা চিহ্ন পুরোপুরি নিষিদ্ধ):
১. কোনো প্রকার কাঁচা LaTeX কোড বা সাংকেতিক চিহ্ন (যেমন: $$, $, \\mathbf, \\text, \\qquad, \\dots, \\frac, \\sqrt ইত্যাদি) লিখবে না!
২. সরাসরি পাঠ্যবইয়ের মতো পরিষ্কার ও স্বাভাবিক ভাষা এবং গাণিতিক সমীকরণ লিখবে।
   - ঘাত বা স্কয়ারের জন্য সরাসরি ইউনিকোড ব্যবহার করবে: ², ³, ⁴, ⁿ ইত্যাদি।
   - সমীকরণের নম্বরের জন্য সাধারণ বন্ধনী লিখবে: যেমন (১), (২)।
   - ভগ্নাংশের জন্য সাধারণ / বা পরিষ্কার রূপ লিখবে।
   - গুণের জন্য × এবং ভাগের জন্য ÷ লিখবে।
৩. কোনো অপ্রয়োজনীয় ডাবল স্টার্কস (**) বা অপ্রাসঙ্গিক সাংকেতিক চিহ্ন ব্যবহার করবে না।

সমস্যা সমাধানের সুবিন্যস্ত কাঠামো (বিষয়ের ধরন অনুযায়ী প্রাসঙ্গিকভাবে সাজাও):
১. চিহ্নিত প্রশ্ন / বিষয়বস্তু:
হোয়াইটবোর্ডে থাকা মূল প্রশ্ন, অংক বা বিষয়টি পরিষ্কারভাবে তুলে ধরো।

২. মূল নিয়ম, সূত্র বা তত্ত্ব:
এই বিষয়ের প্রাসঙ্গিক সূত্র, গ্রামার রুলস, অ্যাকাডেমিক তত্ত্ব বা নীতি পরিষ্কারভাবে উল্লেখ করো (যদি প্রযোজ্য হয়)।

৩. ধারাবাহিক ও বিস্তারিত সমাধান / ব্যাখ্যা:
কোনো ধাপ বাদ না দিয়ে প্রতিটি অংশ যুক্তি, হিসাব বা সহজ বর্ণনাসহ প্রাঞ্জল ভাষায় উপস্থাপন করো।

৪. চূড়ান্ত ফলাফল / সঠিক উত্তর:
চূড়ান্ত উত্তরটি বা সারসংক্ষেপ আলাদা লাইনে স্পষ্টভাবে তুলে ধরো।

৫. শিক্ষার্থীদের জন্য টিপস:
এই টপিক বা নিয়ম সহজে মনে রাখার বিশেষ টেকনিক বা সতর্কতা।`;

const CANDIDATE_MODELS = [
  'googleai/gemini-flash-lite-latest',
  'googleai/gemini-3.5-flash-lite',
  'googleai/gemini-3.1-flash-lite',
];

export interface WhiteboardOcrResult {
  success: boolean;
  text?: string;
  error?: string;
}

export interface WhiteboardSolutionResult {
  success: boolean;
  solution?: string;
  error?: string;
}

export interface WhiteboardDiagramResult {
  success: boolean;
  svg?: string;
  error?: string;
}

/**
 * Perform high-accuracy AI Vision OCR on the whiteboard canvas image.
 */
export async function performWhiteboardVisionOcr(imageDataUri: string): Promise<WhiteboardOcrResult> {
  if (!imageDataUri || !imageDataUri.startsWith('data:image')) {
    return { success: false, error: 'বোর্ডের কোনো ছবি পাওয়া যায়নি।' };
  }

  const availableKeys = getAvailableApiKeys();
  let lastErrorMsg = '';

  for (const key of availableKeys) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const client = createAiClient(key, model);
        const generatePromise = client.generate({
          model,
          prompt: [
            { text: OCR_PROMPT },
            { media: { url: imageDataUri } },
          ],
        });
        const resp = await Promise.race([
          generatePromise,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT_15S')), 15000))
        ]) as any;

        const text = resp.text?.trim();
        if (text && text.length > 0) {
          return { success: true, text };
        }
      } catch (err: any) {
        lastErrorMsg = err?.message || String(err);
        console.warn(`[Whiteboard OCR Failover] ${model} failed: ${lastErrorMsg}`);
      }
    }
  }

  return { 
    success: false, 
    error: lastErrorMsg || 'হোয়াইটবোর্ডের লেখা শনাক্ত করা সম্ভব হয়নি। অনুগ্রহ করে স্পষ্ট করে লিখে পুনরায় চেষ্টা করুন।' 
  };
}

/**
 * Perform deep academic problem solving using Gemini Vision directly on the whiteboard image.
 */
export async function solveWhiteboardProblem(imageDataUri: string, userInstruction?: string): Promise<WhiteboardSolutionResult> {
  if (!imageDataUri || !imageDataUri.startsWith('data:image')) {
    return { success: false, error: 'বোর্ডের কোনো ছবি পাওয়া যায়নি।' };
  }

  const promptText = userInstruction 
    ? `${SOLVER_PROMPT}\n\nঅতিরিক্ত নির্দেশনা: ${userInstruction}`
    : SOLVER_PROMPT;

  const availableKeys = getAvailableApiKeys();
  let lastErrorMsg = '';

  for (const key of availableKeys) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const client = createAiClient(key, model);
        const generatePromise = client.generate({
          model,
          prompt: [
            { text: promptText },
            { media: { url: imageDataUri } },
          ],
        });
        const resp = await Promise.race([
          generatePromise,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT_15S')), 15000))
        ]) as any;

        const solution = resp.text?.trim();
        if (solution && solution.length > 10) {
          return {
            success: true,
            solution,
          };
        }
      } catch (err: any) {
        lastErrorMsg = err?.message || String(err);
        console.warn(`[Whiteboard Solver Failover] ${model} failed: ${lastErrorMsg}`);
      }
    }
  }

  return {
    success: false,
    error: lastErrorMsg || 'AI দ্বারা সমস্যা সমাধান করা সম্ভব হয়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ পরীক্ষা করে পুনরায় চেষ্টা করুন।'
  };
}

const DIAGRAM_PROMPT = `You are a world-class SVG diagram expert and educational illustrator.
The user will provide a name or description of a diagram. Create a detailed, accurate, and educational SVG diagram for it.

STRICT RULES:
1. Return ONLY valid SVG code - starting with <svg ...> and ending with </svg>.
2. No markdown backticks, no explanation, no introduction - ONLY SVG code.
3. SVG must have viewBox="0 0 800 600" and width="800" height="600".
4. Add necessary labels (Bengali or English) so the diagram is clear for students.
5. Make the diagram as detailed, accurate and professional as possible.
6. Use colors to make the diagram attractive and easy to understand.
7. Can draw any subject: biology, physics, chemistry, math, geography, history, architecture, etc.`;

export interface WhiteboardDiagramResult {
  success: boolean;
  svg?: string;
  error?: string;
}

export async function generateWhiteboardDiagram(description: string): Promise<WhiteboardDiagramResult> {
  if (!description || description.trim().length < 2) {
    return { success: false, error: 'Please provide a description for the diagram.' };
  }

  const availableKeys = getAvailableApiKeys();
  let lastErrorMsg = '';

  for (const key of availableKeys) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const client = createAiClient(key, model);
        const generatePromise = client.generate({
          model,
          prompt: [
            { text: `${DIAGRAM_PROMPT}\n\nDiagram subject: ${description.trim()}` },
          ],
        });
        const resp = await Promise.race([
          generatePromise,
          new Promise<never>((_, rej) => setTimeout(() => rej(new Error('TIMEOUT_20S')), 20000))
        ]) as any;

        const rawText = resp.text?.trim();
        if (!rawText) continue;

        let svg = rawText;
        const svgMatch = rawText.match(/<svg[\s\S]*<\/svg>/i);
        if (svgMatch) svg = svgMatch[0];

        if (svg && svg.includes('<svg')) {
          return { success: true, svg };
        }
      } catch (err: any) {
        lastErrorMsg = err?.message || String(err);
        console.warn(`[Whiteboard Diagram Failover] ${model} failed: ${lastErrorMsg}`);
      }
    }
  }

  return {
    success: false,
    error: lastErrorMsg || 'AI could not generate the diagram. Please try again.'
  };
}

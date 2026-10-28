'use server';

/**
 * @fileOverview High-power AI OCR and Problem Solver for the Whiteboard module.
 * Uses Gemini Vision to directly read handwritten/typed text, math formulas,
 * science problems, diagrams and provides rigorous step-by-step solutions.
 */

import { createAiClient, getAvailableApiKeys } from '@/ai/genkit';

const OCR_PROMPT = `তুমি একজন বিশ্বমানের অ্যাকাডেমিক ও বৈজ্ঞানিক OCR বিশেষজ্ঞ AI। 
হোয়াইটবোর্ডের দেওয়া ছবিটিতে শিক্ষক বা শিক্ষার্থী যা কিছু লিখেছেন (হাতে লেখা বা টাইপকৃত টেক্সট, অংক, সমীকরণ, জ্যামিতিক ডায়াগ্রামের তথ্য, পদার্থ/রসায়ন/জীববিজ্ঞান/হিসাববিজ্ঞানের সূত্র বা প্রশ্ন) তা অত্যন্ত গভীরভাবে ও নিখুঁতভাবে উদ্ধার করো।

নিয়মাবলী:
১. বাংলা, ইংরেজি বা গাণিতিক প্রতীকসমূহ হুবহু ও পূর্ণাঙ্গভাবে পড়বে।
২. গাণিতিক সমীকরণসমূহ পরিষ্কারভাবে লিখবে (যেমন: x^2 + 5x + 6 = 0, \\frac{a}{b}, \\sqrt{x}, \\int, \\sum ইত্যাদি)।
৩. কোনো তথ্য বাদ দেবে না।
৪. কোনো অপ্রয়োজনীয় ভূমিকা বা সমাপ্তি ছাড়া শুধুমাত্র উদ্ধারকৃত বিষয়বস্তু সুন্দর করে উপস্থাপন করো।`;

const SOLVER_PROMPT = `তুমি একজন শীর্ষস্থানীয় অ্যাকাডেমিক প্রফেসর, গণিতবিদ ও বিজ্ঞান বিশেষজ্ঞ AI (মাধ্যমিক, উচ্চ-মাধ্যমিক ও বিশ্ববিদ্যালয় স্তরের শিক্ষক)।
হোয়াইটবোর্ডের ছবিটিতে যে প্রশ্ন, অংক, গাণিতিক সমীকরণ বা সমস্যা উপস্থাপন করা হয়েছে, তা গভীরভাবে বিশ্লেষণ করে সম্পূর্ণ নির্ভুল ও পূর্ণাঙ্গ সমাধান দাও।

সমস্যা সমাধানের কাঠামো (কঠোরভাবে মানতে হবে):
### ১. 📋 চিহ্নিত প্রশ্ন ও সমস্যা (Identified Problem)
হোয়াইটবোর্ডে থাকা মূল প্রশ্ন বা গাণিতিক সমীকরণটি পরিষ্কারভাবে তুলে ধরো।

### ২. 📐 প্রয়োজনীয় সূত্র ও তত্ত্ব (Formulas & Concepts)
এই সমস্যা সমাধানের জন্য যেসব সূত্র, উপপাদ্য, বা সমীকরণ প্রযোজ্য হবে তা স্পষ্টভাবে উল্লেখ করো।

### ৩. ✍️ ধারাবাহিক ও বিস্তারিত সমাধান (Step-by-Step Solution)
কোনো লাইন বা ধাপ সংক্ষেপ না করে প্রতিটি ধাপ স্পষ্ট ক্যালকুলেশন ও যৌক্তিক ব্যাখ্যামূলক বর্ণনা দিয়ে বাংলায় সমাধান করো। সমীকরণগুলো পরিষ্কার লাইনে উপস্থাপন করো।

### ৪. 🎯 চূড়ান্ত ফলাফল / উত্তর (Final Answer)
স্পষ্টভাবে চূড়ান্ত উত্তরটি প্রদর্শন করো (একক থাকলে তা উল্লেখ করো)।

### ৫. 💡 শিক্ষক ও শিক্ষার্থীদের জন্য টিপস (Key Takeaways & Tips)
এই ধরনের সমস্যা সহজে মনে রাখা বা পরীক্ষায় দ্রুত নির্ভুলভাবে সমাধানের বিশেষ কৌশল।

যেকোনো বড় ও জটিল সমস্যা অত্যন্ত সহজে বোধগম্য ও আকর্ষণীয় ভাষায় উপস্থাপন করো।`;

const CANDIDATE_MODELS = [
  'googleai/gemini-flash-latest',
  'googleai/gemini-2.0-flash',
  'googleai/gemini-3.5-flash',
  'googleai/gemini-flash-lite-latest',
];

export interface WhiteboardOcrResult {
  success: boolean;
  text?: string;
  error?: string;
}

export interface WhiteboardSolutionResult {
  success: boolean;
  identifiedProblem?: string;
  solution?: string;
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
        const resp = await client.generate({
          model,
          prompt: [
            { text: OCR_PROMPT },
            { media: { url: imageDataUri } },
          ],
        });

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
    ? `${SOLVER_PROMPT}\n\nব্যবহারকারীর অতিরিক্ত নির্দেশনা: ${userInstruction}`
    : SOLVER_PROMPT;

  const availableKeys = getAvailableApiKeys();
  let lastErrorMsg = '';

  for (const key of availableKeys) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const client = createAiClient(key, model);
        const resp = await client.generate({
          model,
          prompt: [
            { text: promptText },
            { media: { url: imageDataUri } },
          ],
        });

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

'use server';

/**
 * @fileOverview AI Flow for generating professional NCTB Board Standard Lecture Sheets.
 */

import { createAiClient, getAvailableApiKeys } from '@/ai/genkit';

export interface GenerateLectureSheetInput {
  className: string;
  subject: string;
  chapter: string;
  topic?: string;
  institutionName?: string;
}

export interface GenerateLectureSheetOutput {
  title: string;
  summary: string;
  keyConcepts: Array<{ heading: string; details: string }>;
  formulasOrRules?: string[];
  solvedExamples?: Array<{ question: string; solution: string }>;
  practiceTasks: string[];
  fullFormattedContent: string;
}

export async function generateLectureSheet(
  input: GenerateLectureSheetInput
): Promise<GenerateLectureSheetOutput> {
  const school = input.institutionName || 'টপ গ্রেড টিউটোরিয়ালস';
  const topicText = input.topic ? `নির্দিষ্ট টপিক: "${input.topic}"` : '';

  const prompt = `তুমি বাংলাদেশের জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (NCTB)-এর একজন অভিজ্ঞ মাস্টার ট্রেইনার ও সেরা শিক্ষক।
প্রতিষ্ঠান: "${school}"
শ্রেণি: ${input.className} শ্রেণি
বিষয়: ${input.subject}
অধ্যায়: ${input.chapter}
${topicText}

উপরের শ্রেণি, বিষয় ও অধ্যায়ের ওপর ভিত্তি করে শিক্ষার্থীদের জন্য একটি অত্যন্ত আকর্ষণীয়, গোছানো ও পূর্ণাঙ্গ "লেকচার শিট / হ্যান্ডআউট" তৈরি করো।

নিয়মাবলী:
১. ভাষা হবে প্রাঞ্জল, সহজবোধ্য ও নির্ভুল প্রমিত বাংলা।
২. বৈজ্ঞানিক বা গাণিতিক চিহ্নের সঠিক ব্যবহার করবে (যেমন: H₂O, √x, x², ±, θ)।
৩. লেকচার শিটটিতে নিম্নলিখিত অংশগুলো স্পষ্টভাবে সাজানো থাকতে হবে:
   - পাঠের শিরোনাম ও সারসংক্ষেপ
   - মূল ধারণাসমূহ ও প্রয়োজনীয় সংজ্ঞা
   - গুরুত্বপূর্ণ সূত্রাবলী বা নিয়মনীতি (যদি প্রযোজ্য হয়)
   - নমুনা সমস্যা বা উদাহরণ ও তার সমাধান
   - শিক্ষার্থীদের ক্লাসের কাজ (CW) ও বাড়ির কাজ (HW)

Output must be in JSON format only (no markdown backticks):
{
  "title": "অধ্যায়ের আকর্ষণীয় লেকচার শিরোনাম",
  "summary": "পাঠের মূল বিষয়বস্তুর সংক্ষিপ্ত ব্যাখ্যা",
  "keyConcepts": [
    { "heading": "বিষয়/সংজ্ঞা ১", "details": "বিস্তারিত সহজ ব্যাখ্যা" },
    { "heading": "বিষয়/সংজ্ঞা ২", "details": "বিস্তারিত সহজ ব্যাখ্যা" }
  ],
  "formulasOrRules": ["সূত্র বা নিয়ম ১", "সূত্র বা নিয়ম ২"],
  "solvedExamples": [
    { "question": "উদাহরণ প্রশ্ন ১", "solution": "ধাপে ধাপে সমাধান" }
  ],
  "practiceTasks": ["অনুশীলন কাজ ১", "অনুশীলন কাজ ২", "বাড়ির কাজ"],
  "fullFormattedContent": "প্রিন্ট করার জন্য সম্পূর্ণ পাঠ্য যা প্যারাগ্রাফ আকারে সুন্দর করে সাজানো"
}`;

  const availableKeys = getAvailableApiKeys();
  const candidateModels = [
    'googleai/gemini-flash-lite-latest',
    'googleai/gemini-flash-latest',
    'googleai/gemini-3.5-flash',
  ];

  let rawText = '';

  for (const key of availableKeys) {
    for (const model of candidateModels) {
      try {
        const client = createAiClient(key, model);
        const resp = await client.generate({
          model,
          prompt,
          config: { responseMimeType: 'application/json' },
        });
        rawText = resp.text?.trim() || '';
        if (rawText) break;
      } catch (err) {
        // failover
      }
    }
    if (rawText) break;
  }

  if (!rawText) {
    throw new Error('লেকচার শিট তৈরি করা যায়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
  }

  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    return JSON.parse(clean) as GenerateLectureSheetOutput;
  } catch {
    return {
      title: `${input.subject} - ${input.chapter}`,
      summary: rawText,
      keyConcepts: [],
      practiceTasks: [],
      fullFormattedContent: rawText,
    };
  }
}

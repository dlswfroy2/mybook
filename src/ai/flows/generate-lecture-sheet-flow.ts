'use server';

/**
 * @fileOverview AI Flow for generating professional NCTB Board Standard Lecture Sheets, Creative Questions & Model Tests.
 */

import { createAiClient, getAvailableApiKeys } from '@/ai/genkit';

export interface GenerateLectureSheetInput {
  className: string;
  subject: string;
  chapter: string;
  sheetType?: 'lecture_sheet' | 'creative' | 'model_test' | 'mcq' | 'answer_key';
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

const TYPE_NAMES: Record<string, string> = {
  lecture_sheet: 'লেকচার শিট ও হ্যান্ডআউট (সারসংক্ষেপ, সংজ্ঞা, সূত্র ও উদাহরণ)',
  creative: 'সৃজনশীল প্রশ্নপত্র (উদ্দীপক + ক, খ, গ, ঘ উপ-প্রশ্ন)',
  model_test: 'পূর্ণাঙ্গ মডেল টেস্ট পরীক্ষা প্রশ্নপত্র',
  mcq: 'বহুনির্বাচনী প্রশ্নপত্র (MCQ + ৪টি অপশন)',
  answer_key: 'উত্তরমালা ও বিস্তারিত সমাধান',
};

export async function generateLectureSheet(
  input: GenerateLectureSheetInput
): Promise<GenerateLectureSheetOutput> {
  const school = input.institutionName || 'টপ গ্রেড টিউটোরিয়ালস';
  const topicText = input.topic ? `নির্দিষ্ট টপিক: "${input.topic}"` : '';
  const selectedType = input.sheetType || 'lecture_sheet';
  const typeDescription = TYPE_NAMES[selectedType] || TYPE_NAMES['lecture_sheet'];

  const prompt = `তুমি বাংলাদেশের জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (NCTB)-এর একজন অভিজ্ঞ মাস্টার ট্রেইনার ও সেরা শিক্ষক।
প্রতিষ্ঠান: "${school}"
শ্রেণি: ${input.className} শ্রেণি
বিষয়: ${input.subject}
অধ্যায়: ${input.chapter}
শিটের ধরণ: ${typeDescription}
${topicText}

উপরের শ্রেণি, বিষয় ও অধ্যায়ের ওপর ভিত্তি করে শিক্ষার্থীদের জন্য একটি অত্যন্ত আকর্ষণীয়, বোর্ড স্ট্যান্ডার্ড ও সম্পূর্ণ প্রস্তুত "${typeDescription}" তৈরি করো।

কঠোর নিয়মাবলী:
১. ভাষা হবে প্রাঞ্জল, সহজবোধ্য ও নির্ভুল প্রমিত বাংলা।
২. বৈজ্ঞানিক বা গাণিতিক চিহ্নের সঠিক রূপ ব্যবহার করবে (যেমন: H₂O, √x, x², ±, θ, সরণ s, বেগ v)।
৩. যদি সৃজনশীল বা মডেল টেস্ট হয়, তবে বোর্ড স্ট্যান্ডার্ড উদ্দীপক ও উপ-প্রশ্ন সাজাবে।
৪. যদি লেকচার শিট হয়, তবে শিরোনাম, মূল ধারণা, সূত্র, উদাহরণ ও অনুশীলনী সাজাবে।
৫. সম্পূর্ণ কন্টেন্টটি সাধারণ পরিষ্কার টেক্সট হিসেবে দিবে যা প্রিন্ট প্রিভিউয়ের মতো চমৎকার দেখাবে।

Output must be in JSON format only (no markdown backticks):
{
  "title": "অধ্যায়ের আকর্ষণীয় শিরোনাম",
  "summary": "পাঠের মূল বিষয়বস্তুর সংক্ষিপ্ত ব্যাখ্যা",
  "keyConcepts": [
    { "heading": "বিষয়/সংজ্ঞা ১", "details": "বিস্তারিত সহজ ব্যাখ্যা" },
    { "heading": "বিষয়/সংজ্ঞা ২", "details": "বিস্তারিত সহজ ব্যাখ্যা" }
  ],
  "formulasOrRules": ["সূত্র বা নিয়ম ১", "সূত্র বা নিয়ম ২"],
  "solvedExamples": [
    { "question": "উদাহরণ/প্রশ্ন ১", "solution": "ধাপে ধাপে সমাধান" }
  ],
  "practiceTasks": ["অনুশীলন কাজ ১", "অনুশীলন কাজ ২", "বাড়ির কাজ"],
  "fullFormattedContent": "প্রিন্ট করার জন্য সম্পূর্ণ পাঠ্য"
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
      } catch (err) {}
    }
    if (rawText) break;
  }

  if (!rawText) {
    throw new Error('কন্টেন্ট তৈরি করা সম্ভব হয়নি। অনুগ্রহ করে পুনরায় চেষ্টা করুন।');
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

export interface ExpandLectureContentInput {
  topicPrompt: string;
  className?: string;
  subject?: string;
  type?: 'bullet_points' | 'detailed' | 'qa' | 'formula_examples';
}

export async function expandLectureContent(
  input: ExpandLectureContentInput
): Promise<string> {
  const typeDescriptions: Record<string, string> = {
    bullet_points: 'গুরুত্বপূর্ণ বুলেট পয়েন্ট ও সারসংক্ষেপ',
    detailed: 'বিস্তারিত প্রাঞ্জল আলোচনা ও উদাহরণ',
    qa: 'জ্ঞানমূলক ও অনুধাবনমূলক প্রশ্ন এবং নির্ভুল উত্তর',
    formula_examples: 'গাণিতিক সূত্র, একক ও সমাধানকৃত সমস্যা'
  };

  const styleDesc = typeDescriptions[input.type || 'bullet_points'] || 'সংক্ষিপ্ত ও সাজানো পয়েন্ট';

  const prompt = `তুমি একজন অভিজ্ঞ শিক্ষক। নিচের বিষয়ের ওপর ভিত্তি করে শিক্ষার্থীদের জন্য লেকচার শিটে ব্যবহারযোগ্য পরিচ্ছন্ন বাংলা কন্টেন্ট তৈরি করো।
শ্রেণি: ${input.className || 'সাধারণ'} শ্রেণি
বিষয়: ${input.subject || 'সাধারণ'}
টপিক/নির্দেশনা: "${input.topicPrompt}"
কন্টেন্টের ধরণ: ${styleDesc}

নির্দেশনা:
১. সরাসরি লেকচার শিটে বসানোর উপযোগী পরিচ্ছন্ন টেক্সট প্রদান করো।
২. কোনো অপ্রয়োজনীয় ভূমিকা বা সম্ভাষণ রাখবে না, সরাসরি পাঠ্য বিষয় শুরু করো।
৩. প্রমিত বাংলা এবং বৈজ্ঞানিক/গাণিতিক চিহ্নের সঠিক রূপ ব্যবহার করো।`;

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
        });
        rawText = resp.text?.trim() || '';
        if (rawText) break;
      } catch (err) {}
    }
    if (rawText) break;
  }

  if (!rawText) {
    throw new Error('কন্টেন্ট জেনারেট করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।');
  }

  return rawText;
}

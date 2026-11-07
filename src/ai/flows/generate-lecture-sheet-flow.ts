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

export interface QuestionTypeCounts {
  creative?: number;
  short?: number;
  mcq?: number;
  knowledge?: number;
  fillInBlanks?: number;
}

export interface ExpandLectureContentInput {
  topicPrompt?: string;
  className?: string;
  subject?: string;
  chapter?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
  mode?: 'questions' | 'notes';
  questionCounts?: QuestionTypeCounts;
  totalQuestions?: number;
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

  const difficultyDescriptions: Record<string, string> = {
    easy: 'সহজ মান (প্রাথমিক ধারণা ও সরাসরি পাঠ্যবই নির্ভর)',
    medium: 'মধ্যম মান (বোর্ড পরীক্ষার স্বাভাবিক স্ট্যান্ডার্ড মান)',
    hard: 'কঠিন মান (উচ্চতর চিন্তন দক্ষতা, বিশ্লেষণধর্মী ও প্যাঁচানো প্রশ্ন)',
    mixed: 'মিশ্র মান (সহজ, মধ্যম ও কঠিন মানের সুষম সমন্বয়)',
  };

  const styleDesc = typeDescriptions[input.type || 'bullet_points'] || 'সংক্ষিপ্ত ও সাজানো পয়েন্ট';
  const diffDesc = difficultyDescriptions[input.difficulty || 'medium'] || difficultyDescriptions.medium;

  let questionsRequirement = '';
  if (input.questionCounts) {
    const list: string[] = [];
    if (input.questionCounts.creative && input.questionCounts.creative > 0) {
      list.push(`• সৃজনশীল প্রশ্ন (CQ): ${input.questionCounts.creative}টি (প্রতিটিতে বাস্তবধর্মী উদ্দীপক এবং ক, খ, গ, ঘ উপ-প্রশ্ন থাকবে)`);
    }
    if (input.questionCounts.short && input.questionCounts.short > 0) {
      list.push(`• সংক্ষিপ্ত প্রশ্ন: ${input.questionCounts.short}টি (১, ২, ৩... ধারাবাহিক নম্বরে সংক্ষিপ্ত প্রশ্ন ও যথাযথ উত্তর)`);
    }
    if (input.questionCounts.mcq && input.questionCounts.mcq > 0) {
      list.push(`• বহুনির্বাচনী প্রশ্ন (MCQ): ${input.questionCounts.mcq}টি (১, ২, ৩... নম্বরে প্রশ্ন এবং (ক), (খ), (গ), (ঘ) অপশন ও সঠিক উত্তর)`);
    }
    if (input.questionCounts.knowledge && input.questionCounts.knowledge > 0) {
      list.push(`• জ্ঞান ও অনুধাবনমূলক প্রশ্ন: ${input.questionCounts.knowledge}টি (ক. জ্ঞানমূলক ও খ. অনুধাবনমূলক প্রশ্নোত্তর)`);
    }
    if (input.questionCounts.fillInBlanks && input.questionCounts.fillInBlanks > 0) {
      list.push(`• শূন্যস্থান পূরণ: ${input.questionCounts.fillInBlanks}টি (১, ২, ৩... বাক্যের নির্দিষ্ট স্থানে শূন্যস্থান ও উত্তর)`);
    }
    if (list.length > 0) {
      questionsRequirement = `\nতৈরি করতে হবে নিচের নির্দিষ্ট ধরনের প্রশ্নসমূহ:\n${list.join('\n')}\n`;
    }
  }

  const isQuestionsMode = input.mode === 'questions' || !!questionsRequirement;

  let prompt = '';
  if (isQuestionsMode) {
    prompt = `তুমি বাংলাদেশের জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (NCTB)-এর একজন অভিজ্ঞ মাস্টার ট্রেইনার ও সেরা প্রশ্ন প্রণেতা।
প্রতিষ্ঠান: "টপ গ্রেড টিউটোরিয়ালস"
শ্রেণি: ${input.className ? input.className + ' শ্রেণি' : 'বিদ্যালয় শ্রেণি'}
বিষয়: ${input.subject || 'সাধারণ বিষয়'}
${input.chapter ? `অধ্যায়: ${input.chapter}` : ''}
${input.topicPrompt ? `টপিক বা বিশেষ নির্দেশনা: "${input.topicPrompt}"` : ''}
প্রশ্নের কাঠিন্য মাত্রা: ${diffDesc}
${questionsRequirement}
মোট প্রশ্ন সংখ্যা: ${input.totalQuestions || 'প্রয়োজন অনুযায়ী'}টি

কঠোর নিয়মাবলী:
১. NCTB বোর্ডের সর্বশেষ প্রশ্ন প্রণয়ন নির্দেশিকা ও মান বণ্টন সম্পূর্ণ বজায় রেখে প্রশ্ন তৈরি করো।
২. ভাষা হবে প্রাঞ্জল, নির্ভুল প্রমিত বাংলা।
৩. প্রতিটি প্রশ্নের ধরণ স্পষ্ট হেডিং দিয়ে সাজাও (যেমন: **সৃজনশীল প্রশ্ন**, **সংক্ষিপ্ত প্রশ্নাবলী**, **বহুনির্বাচনী প্রশ্ন (MCQ)**)।
৪. গাণিতিক বা বৈজ্ঞানিক সমীকরণের ক্ষেত্রে KaTeX সামঞ্জস্যপূর্ণ ফরম্যাট ব্যবহার করবে যেমন $x^2 + y^2 = r^2$, $\\frac{a}{b}$, $\\sqrt{x}$।
৫. কোনো অপ্রয়োজনীয় ভূমিকা বা সম্ভাষণ রাখবে না, সরাসরি পাঠ্য প্রশ্নাবলী শুরু করবে যাতে এটি লেকচার শিট বা প্রশ্নপত্রে প্রিন্ট করার উপযোগী হয়।`;
  } else {
    prompt = `তুমি একজন অভিজ্ঞ শিক্ষক। নিচের বিষয়ের ওপর ভিত্তি করে শিক্ষার্থীদের জন্য লেকচার শিটে ব্যবহারযোগ্য পরিচ্ছন্ন বাংলা কন্টেন্ট তৈরি করো।
শ্রেণি: ${input.className || 'সাধারণ'} শ্রেণি
বিষয়: ${input.subject || 'সাধারণ'}
${input.chapter ? `অধ্যায়: ${input.chapter}` : ''}
টপিক/নির্দেশনা: "${input.topicPrompt || ''}"
কন্টেন্টের ধরণ: ${styleDesc}

নির্দেশনা:
১. সরাসরি লেকচার শিটে বসানোর উপযোগী পরিচ্ছন্ন টেক্সট প্রদান করো।
২. কোনো অপ্রয়োজনীয় ভূমিকা বা সম্ভাষণ রাখবে না, সরাসরি পাঠ্য বিষয় শুরু করো।
৩. প্রমিত বাংলা এবং বৈজ্ঞানিক/গাণিতিক চিহ্নের সঠিক রূপ ($ KaTeX $ সহ) ব্যবহার করো।`;
  }

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

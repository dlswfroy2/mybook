'use server';

/**
 * @fileOverview AI Flow for generating professional NCTB Board Standard Lecture Sheets, Creative Questions & Model Tests.
 */

function cleanMarkdownSymbols(text: string): string {
  if (!text) return '';
  let cleaned = text
    // Replace markdown headers
    .replace(/^#{1,6}\s*(.+)$/gm, '$1')
    .replace(/(?:<p[^>]*>)\s*#{1,6}\s*/gi, '')
    // Convert **bold** to clean text
    .replace(/\*\*([^*]+?)\*\*/g, '$1')
    .replace(/\*([^*]+?)\*/g, '$1')
    // Convert bullet points starting with * or - to •
    .replace(/^[\*\-]\s+/gm, '• ')
    // Remove any remaining stray * or # symbols
    .replace(/[*#]/g, '');

  // ১. সৃজনশীল প্রশ্নের অপ্রয়োজনীয় বড় হেডিং যেমন "সৃজনশীল প্রশ্ন ১ : উদ্দীপক:" বা "সৃজনশীল প্রশ্ন ১" সরাসরি "১। " দিয়ে রূপান্তর
  cleaned = cleaned.replace(
    /(?:^|\r?\n)\s*(?:সৃজনশীল\s*প্রশ্ন\s*([০-৯0-9]+)\s*[:।-]?\s*(?:\r?\n)?)?\s*(?:উদ্দীপক\s*[:।-]?\s*)/gi,
    (match, p1) => {
      if (p1) return `\n${p1}। `;
      return '\n';
    }
  );
  cleaned = cleaned.replace(
    /(?:^|\r?\n)\s*সৃজনশীল\s*প্রশ্ন\s*([০-৯0-9]+)\s*[:।-]?\s*(?:\r?\n)?/gi,
    '\n$1। '
  );
  // Remove standalone "উদ্দীপক:" or "উদ্দীপক -"
  cleaned = cleaned.replace(/^(?:\s*উদ্দীপক\s*[:।-]\s*)/gmi, '');

  // ২. সৃজনশীল প্রশ্নের উপ-প্রশ্ন ক. খ. গ. ঘ. যদি কোনো কারণে এক লাইনে থাকে, তবে সেগুলোকে নিশ্চিতভাবে আলাদা আলাদা নতুন লাইনে সাজানো
  cleaned = cleaned.replace(/([^\r\n]+?)[ \t]+([খbB]\.[ \t]+[^\r\n]+)/g, '$1\n$2');
  cleaned = cleaned.replace(/([^\r\n]+?)[ \t]+([গcC]\.[ \t]+[^\r\n]+)/g, '$1\n$2');
  cleaned = cleaned.replace(/([^\r\n]+?)[ \t]+([ঘdD]\.[ \t]+[^\r\n]+)/g, '$1\n$2');

  // ৩. বহুনির্বাচনী প্রশ্ন (MCQ)-এর অপশনগুলো যদি আলাদা লাইনে থাকে, তবে এক লাইনে রো (Row) আকারে সাজানো
  // শুধুমাত্র ব্র্যাকেটযুক্ত অপশন যেমন ক), (ক), খ), (খ)... মেলানো হবে; সৃজনশীলের ক. খ. গ. ঘ. কখনোই মেলানো হবে না!
  cleaned = cleaned.replace(
    /(?:^|\r?\n)[ \t]*(\(?[কaA]\)[ \t\:][^\r\n]+?)[ \t]*\r?\n[ \t]*(\(?[খbB]\)[ \t\:][^\r\n]+?)[ \t]*\r?\n[ \t]*(\(?[গcC]\)[ \t\:][^\r\n]+?)[ \t]*\r?\n[ \t]*(\(?[ঘdD]\)[ \t\:][^\r\n]+?)(?=\r?\n|$)/g,
    '\n$1    $2    $3    $4'
  );
  cleaned = cleaned.replace(
    /(?:^|\r?\n)[ \t]*(\(?[কaA]\)[ \t\:][^\r\n]+?[ \t]+[ \t]*\(?[খbB]\)[ \t\:][^\r\n]+?)[ \t]*\r?\n[ \t]*(\(?[গcC]\)[ \t\:][^\r\n]+?[ \t]+[ \t]*\(?[ঘdD]\)[ \t\:][^\r\n]+?)(?=\r?\n|$)/g,
    '\n$1    $2'
  );

  return cleaned.trim();
}

import { createAiClient, getAvailableApiKeys } from '@/ai/genkit';

/**
 * Executes an AI generation request with a strict timeout to prevent slow/hanging API models.
 */
async function generateWithTimeout(client: any, options: any, timeoutMs = 12000): Promise<any> {
  return Promise.race([
    client.generate(options),
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(`AI generation timed out after ${timeoutMs}ms`)), timeoutMs)
    ),
  ]);
}

export interface LectureTopicItem {
  topicNumber: string; // যেমন: "১.১", "১.২" ... "১.২০"
  topicTitle: string; // যেমন: "বাস্তব সংখ্যার ধারণা ও শ্রেণিবিন্যাস"
  detailedExplanation: string; // পাঠ্যবই অনুযায়ী বিস্তারিত ও গভীর ব্যাখ্যা
  examples?: Array<{ question: string; solution: string } | string>; // প্রতিটি টপিকের উদাহরণ ও সমাধান
}

export interface GenerateLectureSheetInput {
  className: string;
  subject: string;
  chapter: string;
  sheetType?: 'lecture_sheet' | 'creative' | 'model_test' | 'mcq' | 'answer_key';
  topic?: string;
  institutionName?: string;
  difficulty?: 'easy' | 'medium' | 'hard' | 'mixed';
}

export interface GenerateLectureSheetOutput {
  title: string;
  summary: string;
  topics?: LectureTopicItem[];
  keyConcepts: Array<{ heading: string; details: string }>;
  formulasOrRules?: string[];
  solvedExamples?: Array<{ question: string; solution: string }>;
  practiceTasks: string[];
  fullFormattedContent: string;
}

const TYPE_NAMES: Record<string, string> = {
  lecture_sheet: 'পূর্ণাঙ্গ লেকচার শিট (পাঠ্যবইয়ের সকল টপিক ১.১ থেকে ১.২০+ পুঙ্খানুপুঙ্খ আলোচনা, উদাহরণ ও সমাধান)',
  creative: 'সৃজনশীল প্রশ্নপত্র (সরাসরি ১। ২। নম্বরে উদ্দীপক + নিচে ক, খ, গ, ঘ উপ-প্রশ্ন আলাদা লাইনে)',
  model_test: 'পূর্ণাঙ্গ মডেল টেস্ট পরীক্ষা প্রশ্নপত্র',
  mcq: 'বহুনির্বাচনী প্রশ্নপত্র (MCQ - রো আকারে পাশাপাশি সাজানো অপশন ক) খ) গ) ঘ))',
  answer_key: 'উত্তরমালা ও বিস্তারিত সমাধান',
};

export async function generateLectureSheet(
  input: GenerateLectureSheetInput
): Promise<GenerateLectureSheetOutput> {
  const school = input.institutionName || 'টপ গ্রেড টিউটোরিয়ালস';
  const topicText = input.topic ? `নির্দিষ্ট টপিক/ফোকাস: "${input.topic}"` : '';
  const selectedType = input.sheetType || 'lecture_sheet';
  const typeDescription = TYPE_NAMES[selectedType] || TYPE_NAMES['lecture_sheet'];

  const prompt = `তুমি বাংলাদেশের জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (NCTB)-এর একজন অত্যন্ত অভিজ্ঞ মাস্টার ট্রেইনার ও সেরা শিক্ষক।
প্রতিষ্ঠান: "${school}"
শ্রেণি: ${input.className} শ্রেণি
বিষয়: ${input.subject}
অধ্যায়: ${input.chapter}
শিটের ধরণ: ${typeDescription}
${topicText}

উপরের শ্রেণি, বিষয় ও অধ্যায়ের ওপর ভিত্তি করে শিক্ষার্থীদের জন্য একটি অত্যন্ত সমৃদ্ধ, ১০০% বোর্ড ও মূল পাঠ্যবই স্ট্যান্ডার্ড "${typeDescription}" তৈরি করো।

কঠোর ও অলঙ্ঘনীয় নিয়মাবলী:
১. পাঠ্যবইয়ের সম্পূর্ণ ও সকল টপিক কাভারেজ (১.১ থেকে ১.২০ বা তদূর্ধ্ব - অত্যন্ত বাধ্যতামূলক):
   - পাঠ্যবইয়ের সংশ্লিষ্ট অধ্যায়ে যতগুলো অনুচ্ছেদ বা টপিক রয়েছে (যেমন ১.১, ১.২, ১.৩, ১.৪ ... ১.১৫, ১.২০ বা তার বেশি যতগুলো টপিক পাঠ্যবইয়ে রয়েছে), তার সবকটি টপিক ক্রমানুসারে শুরু থেকে শেষ পর্যন্ত একে একে প্রতিটি অন্তর্ভুক্ত করতে হবে।
   - কোনো অবস্থাতেই কেবল ৩ থেকে ৫টি টপিক দিয়ে সংক্ষিপ্ত করবে না! যদি অধ্যায়ে ১০টি, ১৫টি বা ২০টি টপিক থাকে (যেমন ১.১ থেকে ১.২০), তবে ২০টি টপিকের প্রতিটিই বিস্তারিত তালিকাভুক্ত করতে হবে। কোনো একটি টপিকও বাদ দেওয়া সম্পূর্ণ নিষিদ্ধ।
   - প্রতিটি টপিকের অধীনে:
     * টপিকের সঠিক ক্রমিক নম্বর ও নাম (যেমন: "১.১ ...", "১.২ ...", ... "১.২০ ...")
     * মূল বিষয়বস্তু, তত্ত্ব ও পুঙ্খানুপুঙ্খ সংজ্ঞা
     * প্রতিটি টপিকের জন্য বাস্তবধর্মী বা গাণিতিক উদাহরণ ও ধাপে ধাপে সমাধান
২. প্রশ্ন তৈরির ক্ষেত্রে নম্বরিং ও বিন্যাস নিয়ম:
   - সৃজনশীল প্রশ্ন: "সৃজনশীল প্রশ্ন ১" বা "উদ্দীপক:" এভাবে বাড়তি কোনো শিরোনাম লিখবে না! সরাসরি ধারাবাহিক নম্বর দিয়ে শুরু করবে:
     ১। [এখানে বাস্তবধর্মী উদ্দীপকের মূল পাঠ্য/তথ্য সরাসরি শুরু হবে]
     ক. [জ্ঞানমূলক প্রশ্ন - ১ নম্বর]
     খ. [অনুধাবনমূলক প্রশ্ন - ২ নম্বর]
     গ. [প্রয়োগমূলক প্রশ্ন - ৩ নম্বর]
     ঘ. [উচ্চতর দক্ষতামূলক প্রশ্ন - ৪ নম্বর]
     ২। [পরবর্তী উদ্দীপক সরাসরি শুরু হবে]
     ক. ...
     খ. ...
     গ. ...
     ঘ. ...
     সতর্কবাণী: সৃজনশীলের ক., খ., গ., ঘ. চারটি উপ-প্রশ্ন অবশ্যই আলাদা আলাদা নতুন লাইনে থাকবে! কোনোভাবেই ক. খ. গ. ঘ. এক লাইনে পাশাপাশি দেওয়া যাবে না!
   - সংক্ষিপ্ত প্রশ্ন: সরাসরি "১। ", "২। ", "৩। " ধারাবাহিক নম্বরে প্রশ্ন ও নির্ভুল উত্তর দিবে।
   - বহুনির্বাচনী প্রশ্ন (MCQ): সরাসরি "১। ", "২। " ধারাবাহিক নম্বরে প্রশ্ন দিবে। প্রতিটি প্রশ্নের ৪টি অপশন ক), খ), গ), ঘ) অবশ্যই এক লাইনে রো (Row / অনুভূমিক / পাশাপাশি) আকারে সাজানো থাকবে, কোনো অবস্থাতেই কলাম আকারে খাড়াখাড়ি সাজানো যাবে না!
৩. ভাষা হবে প্রাঞ্জল, নির্ভুল প্রমিত বাংলা। বৈজ্ঞানিক ও গাণিতিক সূত্রের ক্ষেত্রে সঠিক রূপ ব্যবহার করবে।
৪. কোনো অপ্রয়োজনীয় মার্কডাউন চিহ্ন (*, **, #, ## ইত্যাদি) ব্যবহার করবে না। সম্পূর্ণ লেখা পরিষ্কার টেক্সট আকারে হবে।

Output must be in JSON format only (no markdown backticks):
{
  "title": "অধ্যায়ের আকর্ষণীয় মূল শিরোনাম",
  "summary": "অধ্যায়ের মূল প্রতিপাদ্য ও সারসংক্ষেপ",
  "topics": [
    {
      "topicNumber": "১.১",
      "topicTitle": "প্রথম টপিকের নাম",
      "detailedExplanation": "পাঠ্যবই অনুযায়ী এই টপিকের পুঙ্খানুপুঙ্খ সহজবোধ্য বিস্তারিত ব্যাখ্যা ও মূল সংজ্ঞা",
      "examples": [
        "উদাহরণ ১: সমস্যা ও ধাপে ধাপে সমাধান",
        "উদাহরণ ২: ব্যবহারিক বা গাণিতিক প্রয়োগ"
      ]
    },
    {
      "topicNumber": "১.২",
      "topicTitle": "দ্বিতীয় টপিকের নাম",
      "detailedExplanation": "পাঠ্যবই অনুযায়ী এই টপিকের বিস্তারিত আলোচনা",
      "examples": [
        "উদাহরণ ১: সমস্যা ও সমাধান"
      ]
    }
  ],
  "formulasOrRules": ["প্রয়োজনীয় সূত্র বা নিয়ম ১", "প্রয়োজনীয় সূত্র বা নিয়ম ২"],
  "practiceTasks": ["অনুশীলন কাজ ১", "অনুশীলন কাজ ২", "বাড়ির পড়া"],
  "fullFormattedContent": "প্রিন্ট করার জন্য সম্পূর্ণ পাঠ্য"
}`;

  const availableKeys = getAvailableApiKeys();
  // gemini-flash-lite-latest responds in 2-3 seconds; fastest and most responsive model
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
        const resp = await generateWithTimeout(
          client,
          {
            model,
            prompt,
            config: { 
              responseMimeType: 'application/json',
              maxOutputTokens: 6144,
              temperature: 0.2,
            },
          },
          15000 // 15s max timeout to prevent hangs
        );
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
    const parsed = JSON.parse(clean) as GenerateLectureSheetOutput;
    return parsed;
  } catch {
    return {
      title: `${input.subject} - ${input.chapter}`,
      summary: cleanMarkdownSymbols(rawText),
      keyConcepts: [],
      practiceTasks: [],
      fullFormattedContent: cleanMarkdownSymbols(rawText),
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
    detailed: 'পাঠ্যবইয়ের সকল টপিকভিত্তিক (১.১ থেকে ১.২০+) বিস্তারিত প্রাঞ্জল আলোচনা ও সমাধানকৃত উদাহরণ',
    qa: 'জ্ঞানমূলক ও অনুধাবনমূলক প্রশ্ন এবং নির্ভুল উত্তর',
    formula_examples: 'গাণিতিক সূত্র, একক ও সমাধানকৃত সমস্যা'
  };

  const difficultyInstructions: Record<string, string> = {
    easy: `[১০০% খাঁটি সহজ মান (Easy Level) - কঠোরভাবে পালনীয়]:
• সকল প্রশ্ন সম্পূর্ণ সরাসরি পাঠ্যবই ভিত্তিক, মৌলিক সংজ্ঞা ও সরাসরি তথ্যের ওপর হতে হবে।
• কোনো প্যাঁচানো ভাষা, বিভ্রান্তিকর অপশন বা একাধিক ধাপের জটিল হিসাব রাখা যাবে না।
• শিক্ষার্থীরা যাতে সরাসরি সাধারণ ধারণা বা পাঠ্যবই মনে করে সহজে উত্তর দিতে পারে এমন জ্ঞান ও সহজ অনুধাবন স্তরের প্রশ্ন হবে।
• কোনোক্রমেই মধ্যম বা কঠিন মানের প্রশ্ন তৈরি করবে না; এটি যেন ১০০% খাঁটি সহজ মান বজায় রাখে।`,

    medium: `[বোর্ড স্ট্যান্ডার্ড মধ্যম মান (Medium Level)]:
• NCTB বোর্ড ফাইনাল পরীক্ষার স্বাভাবিক আদর্শ মান অনুযায়ী প্রশ্ন তৈরি করো।
• জ্ঞান, অনুধাবন ও সাধারণ প্রয়োগের সুষম সমন্বয় থাকবে।`,

    hard: `[১০০% খাঁটি কঠিন মান (Hard Level) - কঠোরভাবে পালনীয়]:
• সকল প্রশ্ন অত্যন্ত মানসম্মত, চ্যালেঞ্জিং ও উচ্চতর চিন্তন দক্ষতা (Higher Order Thinking Skills) সমৃদ্ধ হতে হবে।
• সৃজনশীল প্রশ্নের উদ্দীপক হবে বাস্তবসম্মত কিন্তু জটিল ও গভীর বিশ্লেষণধর্মী; এবং উপ-প্রশ্ন (বিশেষ করে গ ও ঘ) হবে বহু-ধাপ বিশিষ্ট জটিল প্রয়োগ, সূক্ষ্ম গাণিতিক সমস্যা বা উচ্চতর তুলনামূলক মূল্যায়নভিত্তিক।
• কোনো সরাসরি সহজ প্রশ্ন বা সাধারণ তথ্যভিত্তিক সহজ প্রশ্ন রাখা যাবে না।
• বহুনির্বাচনী প্রশ্নের ক্ষেত্রে অপশনগুলো সূক্ষ্ম বিভ্রান্তিকর এবং বহুপদী সমাপ্তিসূচক (i, ii, iii সমন্বিত) বা বিশ্লেষণধর্মী হবে।
• কোনোক্রমেই যেন সহজ বা সাধারণ মানের প্রশ্ন না হয়; এটি ১০০% খাঁটি কঠিন মান বজায় রাখতে হবে।`,

    mixed: `[মিশ্র মান (Mixed Level)]:
• বোর্ডের নিয়ম অনুযায়ী ৩০% সহজ, ৫০% মধ্যম এবং ২০% উচ্চতর দক্ষতাসম্পন্ন কঠিন মানের প্রশ্ন তৈরি করবে।`,
  };

  const styleDesc = typeDescriptions[input.type || 'bullet_points'] || 'সংক্ষিপ্ত ও সাজানো পয়েন্ট';
  const diffDesc = difficultyInstructions[input.difficulty || 'medium'] || difficultyInstructions.medium;

  let questionsRequirement = '';
  if (input.questionCounts) {
    const list: string[] = [];
    if (input.questionCounts.creative && input.questionCounts.creative > 0) {
      list.push(`• সৃজনশীল প্রশ্ন (CQ): ${input.questionCounts.creative}টি
  - নম্বরিং ও ফরম্যাট নিয়ম (বাধ্যতামূলক): "সৃজনশীল প্রশ্ন ১" বা "উদ্দীপক:" এভাবে আলাদা কোনো হেডিং দিবে না! সরাসরি ধারাবাহিক নম্বর দিয়ে শুরু করবে এবং ক, খ, গ, ঘ প্রতিটি উপ-প্রশ্ন অবশ্যই আলাদা আলাদা নতুন লাইনে সাজাবে (এক লাইনে পাশাপাশি নয়):
    ১। [এখানে বাস্তবধর্মী উদ্দীপক / তথ্য / সমীকরণ সরাসরি শুরু হবে]
    ক. [জ্ঞানমূলক প্রশ্ন - ১ নম্বর]
    খ. [অনুধাবনমূলক প্রশ্ন - ২ নম্বর]
    গ. [প্রয়োগমূলক প্রশ্ন - ৩ নম্বর]
    ঘ. [উচ্চতর দক্ষতামূলক প্রশ্ন - ৪ নম্বর]

    ২। [পরবর্তী উদ্দীপক সরাসরি শুরু হবে]
    ক. [জ্ঞানমূলক প্রশ্ন - ১ নম্বর]
    খ. [অনুধাবনমূলক প্রশ্ন - ২ নম্বর]
    গ. [প্রয়োগমূলক প্রশ্ন - ৩ নম্বর]
    ঘ. [উচ্চতর দক্ষতামূলক প্রশ্ন - ৪ নম্বর]`);
    }
    if (input.questionCounts.short && input.questionCounts.short > 0) {
      list.push(`• সংক্ষিপ্ত প্রশ্ন: ${input.questionCounts.short}টি
  - নম্বরিং ও ফরম্যাট নিয়ম: সরাসরি ১। ২। ৩। এভাবে ধারাবাহিক নম্বরে প্রশ্ন ও যথাযথ উত্তর দিবে:
    ১। [প্রশ্ন বাক্য]?
    উত্তর: [সংক্ষিপ্ত ও যথাযথ উত্তর]
    ২। [প্রশ্ন বাক্য]?
    উত্তর: [সংক্ষিপ্ত ও যথাযথ উত্তর]`);
    }
    if (input.questionCounts.mcq && input.questionCounts.mcq > 0) {
      list.push(`• বহুনির্বাচনী প্রশ্ন (MCQ): ${input.questionCounts.mcq}টি
  - নম্বরিং ও অপশন বিন্যাস নিয়ম (অত্যন্ত গুরুত্বপূর্ণ): সরাসরি ১। ২। ৩। নম্বরে প্রশ্ন লিখবে। প্রতিটি প্রশ্নের ৪টি অপশন ক), খ), গ), ঘ) অবশ্যই এক লাইনে রো (Row / অনুভূমিক / পাশাপাশি) আকারে সাজানো থাকবে, কলাম আকারে খাড়াখাড়ি সাজানো যাবে না!
  - উদাহরণ ফরম্যাট:
    ১। [প্রশ্ন বাক্য]?
    ক) [অপশন ১]      খ) [অপশন ২]      গ) [অপশন ৩]      ঘ) [অপশন ৪]
    সঠিক উত্তর: ক

    ২। [প্রশ্ন বাক্য]?
    ক) [অপশন ১]      খ) [অপশন ২]      গ) [অপশন ৩]      ঘ) [অপশন ৪]
    সঠিক উত্তর: খ`);
    }
    if (input.questionCounts.knowledge && input.questionCounts.knowledge > 0) {
      list.push(`• জ্ঞান ও অনুধাবনমূলক প্রশ্ন: ${input.questionCounts.knowledge}টি
  - সরাসরি ১। ২। ৩। ধারাবাহিক নম্বরে প্রশ্ন ও উত্তর সাজাবে।`);
    }
    if (input.questionCounts.fillInBlanks && input.questionCounts.fillInBlanks > 0) {
      list.push(`• শূন্যস্থান পূরণ: ${input.questionCounts.fillInBlanks}টি
  - সরাসরি ১। ২। ৩। ধারাবাহিক নম্বরে বাক্যের নির্দিষ্ট স্থানে শূন্যস্থান ও নিচে উত্তর সাজাবে।`);
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

${diffDesc}

${questionsRequirement}
মোট প্রশ্ন সংখ্যা: ${input.totalQuestions || 'প্রয়োজন অনুযায়ী'}টি

কঠোর ও অলঙ্ঘনীয় নিয়মাবলী:
১. প্রশ্নের মানের শতভাগ নির্ভুলতা: যে কাঠিন্য মান (সহজ/কঠিন/মধ্যম) নির্ধারণ করা হয়েছে, প্রতিটি প্রশ্ন ১০০% সেই মান বজায় রেখে তৈরি করতে হবে। কঠিন বললে অবশ্যই খাঁটি কঠিন ও বিশ্লেষণধর্মী হতে হবে; সহজ বললে অবশ্যই খাঁটি সহজ ও সরাসরি পাঠ্যবই নির্ভর হতে হবে। কোনোক্রমেই মানের ভুল বা হেরফের করা যাবে না।
২. সৃজনশীল প্রশ্নের ফরম্যাট: "সৃজনশীল প্রশ্ন ১" বা "উদ্দীপক:" ইত্যাদি কোনো বাড়তি হেডিং দিবে না! সরাসরি "১। ", "২। " দিয়ে উদ্দীপকের পাঠ্য শুরু করবে।
   সতর্কবাণী: প্রতিটি উদ্দীপকের নিচে ক., খ., গ., ঘ. চারটি উপ-প্রশ্ন অবশ্যই আলাদা আলাদা লাইনে (একটার নিচে একটা) সাজাবে, কোনোভাবেই ক. খ. গ. ঘ. এক লাইনে পাশাপাশি দিবে না!
   উদাহরণ:
   ১। [উদ্দীপকের মূল পাঠ্য/দৃশ্যকল্প...]
   ক. [জ্ঞানমূলক প্রশ্ন - ১]
   খ. [অনুধাবনমূলক প্রশ্ন - ২]
   গ. [প্রয়োগমূলক প্রশ্ন - ৩]
   ঘ. [উচ্চতর দক্ষতামূলক প্রশ্ন - ৪]
৩. সংক্ষিপ্ত প্রশ্নের ফরম্যাট: সরাসরি "১। ", "২। " দিয়ে প্রশ্ন ও যথাযথ উত্তর দিবে।
৪. বহুনির্বাচনী (MCQ) প্রশ্নের ফরম্যাট (বাধ্যতামূলক): প্রতিটি প্রশ্নের নম্বর "১। ", "২। " দিয়ে শুরু করবে। অপশনগুলো ক) খ) গ) ঘ) অবশ্যই এক লাইনে রো (Row) আকারে পাশাপাশি সাজানো থাকবে, কোনো অবস্থাতেই কলাম আকারে একটার নিচে একটা অপশন দিবে না!
   যেমন:
   ১। প্রশ্ন বাক্য?
   ক) অপশন ১      খ) অপশন ২      গ) অপশন ৩      ঘ) অপশন ৪
   সঠিক উত্তর: ক
৫. NCTB বোর্ডের সর্বশেষ প্রশ্ন প্রণয়ন নির্দেশিকা ও মান বণ্টন সম্পূর্ণ বজায় রেখে প্রশ্ন তৈরি করো।
৬. ভাষা হবে প্রাঞ্জল, নির্ভুল প্রমিত বাংলা। কোনো অপ্রয়োজনীয় ভূমিকা বা সম্ভাষণ রাখবে না, সরাসরি পাঠ্য প্রশ্নাবলী শুরু করবে যাতে এটি লেকচার শিট বা প্রশ্নপত্রে প্রিন্ট করার উপযোগী হয়।
৭. কোনো অপ্রয়োজনীয় মার্কডাউন চিহ্ন যেমন *, **, #, ## ইত্যাদি ব্যবহার করবে না। সম্পূর্ণ লেখাটি সরাসরি পরিষ্কার বাংলা টেক্সট ও প্যারাগ্রাফ আকারে সাজাবে।
৮. গাণিতিক বা বৈজ্ঞানিক সমীকরণের ক্ষেত্রে KaTeX সামঞ্জস্যপূর্ণ ফরম্যাট ব্যবহার করবে যেমন $x^2 + y^2 = r^2$, $\\frac{a}{b}$, $\\sqrt{x}$।`;
  } else {
    prompt = `তুমি বাংলাদেশের জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (NCTB)-এর একজন অভিজ্ঞ মাস্টার ট্রেইনার ও সেরা শিক্ষক।
নিচের বিষয়ের ওপর ভিত্তি করে শিক্ষার্থীদের জন্য পাঠ্যবই স্ট্যান্ডার্ড পূর্ণাঙ্গ লেকচার শিট তৈরি করো।
প্রতিষ্ঠান: "টপ গ্রেড টিউটোরিয়ালস"
শ্রেণি: ${input.className || 'সাধারণ'} শ্রেণি
বিষয়: ${input.subject || 'সাধারণ'}
${input.chapter ? `অধ্যায়: ${input.chapter}` : ''}
টপিক/নির্দেশনা: "${input.topicPrompt || ''}"
কন্টেন্টের ধরণ: ${styleDesc}

কঠোর ও অলঙ্ঘনীয় নিয়মাবলী (১০০% বাধ্যতামূলক):
১. পাঠ্যবইয়ের সম্পূর্ণ ও সকল টপিক কাভারেজ (১.১ থেকে ১.২০ বা তদূর্ধ্ব):
   - নির্বাচিত অধ্যায়ের জন্য NCTB মূল পাঠ্যবইয়ে যতগুলো ক্রমিক টপিক রয়েছে (যেমন অধ্যায় ১ হলে: ১.১, ১.২, ১.৩, ১.৪ ... ১.১৫, ১.২০ বা তার বেশি যতগুলো টপিক পাঠ্যবইয়ে রয়েছে), পাঠ্যবইয়ের ঠিক সেই ক্রমিক নম্বর ধরে প্রতিটি টপিক শুরু থেকে শেষ পর্যন্ত ক্রমানুসারে পুঙ্খানুপুঙ্খভাবে আলোচনা করতে হবে।
   - কোনো অবস্থাতেই কেবল ৩-৫টি টপিক দিয়ে সংক্ষিপ্ত করবে না। অধ্যায়ের সম্পূর্ণ সিলেবাসের প্রতিটি টপিক (১.১ থেকে ১.২০ বা তদূর্ধ্ব সবকটি) অবশ্যই অন্তর্ভুক্ত করতে হবে।
   - প্রতিটি টপিকের অধীনে:
     * টপিকের ক্রমিক নম্বর ও স্পষ্ট শিরোনাম (যেমন: ১.১ ...)
     * মূল তত্ত্ব, বিশদ আলোচনা ও সংজ্ঞা।
     * প্রতিটি টপিকের জন্য পর্যাপ্ত বাস্তবধর্মী বা গাণিতিক উদাহরণ ও তার সুস্পষ্ট সমাধান।
২. সরাসরি লেকচার শিটে বসানোর উপযোগী পরিচ্ছন্ন টেক্সট প্রদান করো। কোনো অপ্রয়োজনীয় ভূমিকা বা সম্ভাষণ রাখবে না, সরাসরি পাঠ্য বিষয় শুরু করো।
৩. কোনো অপ্রয়োজনীয় মার্কডাউন চিহ্ন (*, **, #, ## ইত্যাদি) ব্যবহার করবে না।
৪. প্রমিত বাংলা এবং বৈজ্ঞানিক/গাণিতিক চিহ্নের সঠিক রূপ ($ KaTeX $ সহ) ব্যবহার করো।`;
  }

  const availableKeys = getAvailableApiKeys();
  // gemini-flash-lite-latest responds in 2-3 seconds; ultra-fast response
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
        const resp = await generateWithTimeout(
          client,
          {
            model,
            prompt,
            config: {
              maxOutputTokens: 4096,
              temperature: 0.2,
            },
          },
          12000 // 12s max timeout
        );
        rawText = resp.text?.trim() || '';
        if (rawText) break;
      } catch (err) {}
    }
    if (rawText) break;
  }

  if (!rawText) {
    throw new Error('কন্টেন্ট জেনারেট করা সম্ভব হয়নি। পুনরায় চেষ্টা করুন।');
  }

  return cleanMarkdownSymbols(rawText);
}

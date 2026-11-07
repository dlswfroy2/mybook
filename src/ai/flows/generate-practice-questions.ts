'use server';

/**
 * @fileOverview Genkit/Gemini failover flow for generating structured NCTB board-style questions.
 */

import { createAiClient, getAvailableApiKeys } from '@/ai/genkit';

export interface GeneratedQuestionItem {
  type: 'creative' | 'short' | 'mcq';
  stimulus?: string;
  qA?: string;
  qB?: string;
  qC?: string;
  qD?: string;
  shortText?: string;
  mcqQuestion?: string;
  optA?: string;
  optB?: string;
  optC?: string;
  optD?: string;
  correctOpt?: string;
  formattedText: string;
}

export interface GeneratePracticeQuestionsInput {
  classId: string;
  subject: string;
  chapter?: string;
  type: 'creative' | 'short' | 'mcq' | 'mixed';
  count: number;
  institutionName?: string;
}

export interface GeneratePracticeQuestionsOutput {
  questions: GeneratedQuestionItem[];
}

export async function generatePracticeQuestions(
  input: GeneratePracticeQuestionsInput
): Promise<GeneratePracticeQuestionsOutput> {
  const chapterText = input.chapter ? `অধ্যায়: "${input.chapter}"` : '';
  const typeText =
    input.type === 'creative'
      ? 'সৃজনশীল প্রশ্ন (উদ্দীপক + ক, খ, গ, ঘ)'
      : input.type === 'mcq'
      ? 'বহুনির্বাচনি প্রশ্ন (প্রশ্ন + ৪টি অপশন ক, খ, গ, ঘ এবং সঠিক উত্তর)'
      : input.type === 'short'
      ? 'সংক্ষিপ্ত ও জ্ঞানমূলক প্রশ্ন'
      : 'সৃজনশীল ও বহুনির্বাচনি মিশ্রিত প্রশ্ন';

  const prompt = `তুমি বাংলাদেশের জাতীয় শিক্ষাক্রম (NCTB)-এর একজন অভিজ্ঞ প্রশ্নপ্রণেতা ও বোর্ড পরীক্ষক।
প্রতিষ্ঠান: "${input.institutionName || 'টপ গ্রেড টিউটোরিয়ালস'}"
শ্রেণি: ${input.classId} শ্রেণি
বিষয়: ${input.subject}
${chapterText}
প্রশ্নের ধরণ: ${typeText}
মোট প্রশ্নের সংখ্যা: ${input.count} টি

কঠোর ও অলঙ্ঘনীয় নিয়মাবলী (১০০% মান্য):
১. শুধুমাত্র প্রশ্নপত্র তৈরি করতে হবে: কোনো অবস্থাতেই প্রশ্নের উত্তর, সমাধান বা সঠিক উত্তরের কোনো প্রকার ক্লু দেওয়া যাবে না! [সঠিক উত্তর: ...] বা "সঠিক উত্তর:" বা "উত্তর:" ইত্যাদি কোনো উত্তরমালা লেখা কঠোরভাবে নিষিদ্ধ।
২. প্রতিটি সৃজনশীল প্রশ্নের ক্ষেত্রে একটি মানসম্পন্ন উদ্দীপক (stimulus) এবং ৪টি ধারাবাহিক উপ-প্রশ্ন আলাদা আলাদা লাইনে থাকবে এবং ডানপাশে মান বণ্টন থাকবে:
   - ক. (জ্ঞানমূলক) [১]
   - খ. (অনুধাবনমূলক) [২]
   - গ. (প্রয়োগমূলক) [৩]
   - ঘ. (উচ্চতর দক্ষতামূলক) [৪]
৩. বহুনির্বাচনির ক্ষেত্রে ৪টি স্পষ্ট অপশন (ক, খ, গ, ঘ) থাকবে, কিন্তু কোনো অবস্থাতেই সঠিক উত্তর উল্লেখ থাকবে না!
৪. গাণিতিক/বিজ্ঞান বিষয়ের চিহ্নের সঠিক রূপ থাকবে।
৫. ভাষা হবে শতভাগ নির্ভুল ও প্রমিত বাংলা।

Output strictly in JSON format (no markdown backticks):
{
  "questions": [
    {
      "type": "creative",
      "stimulus": "উদ্দীপকের দৃশ্যকল্প...",
      "qA": "জ্ঞানমূলক প্রশ্ন...",
      "qB": "অনুধাবনমূলক প্রশ্ন...",
      "qC": "প্রয়োগমূলক প্রশ্ন...",
      "qD": "উচ্চতর দক্ষতামূলক প্রশ্ন...",
      "formattedText": "উদ্দীপক...\\nক. জ্ঞানমূলক প্রশ্ন... [১]\\nখ. অনুধাবনমূলক প্রশ্ন... [২]\\nগ. প্রয়োগমূলক প্রশ্ন... [৩]\\nঘ. উচ্চতর দক্ষতামূলক প্রশ্ন... [৪]"
    },
    {
      "type": "mcq",
      "mcqQuestion": "প্রশ্ন...",
      "optA": "অপশন ১",
      "optB": "অপশন ২",
      "optC": "অপশন ৩",
      "optD": "অপশন ৪",
      "formattedText": "প্রশ্ন...\\n(ক) অপশন ১  (খ) অপশন ২\\n(গ) অপশন ৩  (ঘ) অপশন ৪"
    }
  ]
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
    throw new Error('প্রশ্ন তৈরি করা সম্ভব হয়নি। অনুগ্রহ করে আবার চেষ্টা করুন।');
  }

  try {
    const clean = rawText.replace(/```json|```/g, '').trim();
    const parsed = JSON.parse(clean);

    const stripAnswers = (txt: string) => {
      if (!txt) return '';
      return txt
        .replace(/\[\s*(?:সঠিক উত্তর|উত্তরঃ?|উত্তর)[^\]]*\]/gi, '')
        .replace(/\(\s*(?:সঠিক উত্তর|উত্তরঃ?|উত্তর)[^)]*\)/gi, '')
        .replace(/(?:সঠিক উত্তর|উত্তরঃ?|উত্তর)\s*:\s*[^\n]+/gi, '')
        .trim();
    };

    return {
      questions: (parsed.questions || []).map((q: any) => {
        let fText = q.formattedText || '';
        if (!fText) {
          if (q.type === 'creative') {
            const qA = q.qA?.includes('[') ? q.qA : `${q.qA || ''} [১]`;
            const qB = q.qB?.includes('[') ? q.qB : `${q.qB || ''} [২]`;
            const qC = q.qC?.includes('[') ? q.qC : `${q.qC || ''} [৩]`;
            const qD = q.qD?.includes('[') ? q.qD : `${q.qD || ''} [৪]`;
            fText = `${q.stimulus || ''}\nক. ${qA}\nখ. ${qB}\nগ. ${qC}\nঘ. ${qD}`.trim();
          } else if (q.type === 'mcq') {
            fText = `${q.mcqQuestion || ''}\n(ক) ${q.optA || ''}  (খ) ${q.optB || ''}\n(গ) ${q.optC || ''}  (ঘ) ${q.optD || ''}`.trim();
          } else {
            fText = q.shortText || '';
          }
        }
        return {
          ...q,
          correctOpt: undefined,
          formattedText: stripAnswers(fText),
          stimulus: stripAnswers(q.stimulus || ''),
          mcqQuestion: stripAnswers(q.mcqQuestion || ''),
          shortText: stripAnswers(q.shortText || ''),
        };
      }),
    };
  } catch {
    const stripAnswers = (txt: string) => {
      if (!txt) return '';
      return txt
        .replace(/\[\s*(?:সঠিক উত্তর|উত্তরঃ?|উত্তর)[^\]]*\]/gi, '')
        .replace(/\(\s*(?:সঠিক উত্তর|উত্তরঃ?|উত্তর)[^)]*\)/gi, '')
        .replace(/(?:সঠিক উত্তর|উত্তরঃ?|উত্তর)\s*:\s*[^\n]+/gi, '')
        .trim();
    };
    return {
      questions: [
        {
          type: 'short',
          shortText: stripAnswers(rawText),
          formattedText: stripAnswers(rawText),
        },
      ],
    };
  }
}

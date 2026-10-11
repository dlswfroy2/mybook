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

কঠোর নিয়মাবলী:
১. প্রতিটি সৃজনশীল প্রশ্নের ক্ষেত্রে একটি মানসম্পন্ন উদ্দীপক (stimulus) এবং ৪টি ধারাবাহিক উপ-প্রশ্ন থাকবে:
   - ক (জ্ঞানমূলক - ১ নম্বর)
   - খ (অনুধাবনমূলক - ২ নম্বর)
   - গ (প্রয়োগমূলক - ৩ নম্বর)
   - ঘ (উচ্চতর দক্ষতামূলক - ৪ নম্বর)
২. বহুনির্বাচনির ক্ষেত্রে ৪টি স্পষ্ট অপশন (ক, খ, গ, ঘ) এবং সঠিক উত্তর উল্লেখ থাকবে।
৩. গাণিতিক/বিজ্ঞান বিষয়ের চিহ্নের সঠিক রূপ থাকবে।
৪. ভাষা হবে শতভাগ নির্ভুল ও প্রমিত বাংলা।

Output strictly in JSON format (no markdown backticks):
{
  "questions": [
    {
      "type": "creative",
      "stimulus": "উদ্দীপক...",
      "qA": "ক. প্রশ্ন...",
      "qB": "খ. প্রশ্ন...",
      "qC": "গ. প্রশ্ন...",
      "qD": "ঘ. প্রশ্ন...",
      "formattedText": "উদ্দীপক...\\nক. ...\\nখ. ...\\nগ. ...\\nঘ. ..."
    },
    {
      "type": "mcq",
      "mcqQuestion": "প্রশ্ন...",
      "optA": "ক) অপশন...",
      "optB": "খ) অপশন...",
      "optC": "গ) অপশন...",
      "optD": "ঘ) অপশন...",
      "correctOpt": "ক",
      "formattedText": "প্রশ্ন...\\n(ক) ...  (খ) ...\\n(গ) ...  (ঘ) ...\\n[সঠিক উত্তর: ক]"
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
    return {
      questions: (parsed.questions || []).map((q: any) => ({
        ...q,
        formattedText:
          q.formattedText ||
          (q.type === 'creative'
            ? `${q.stimulus || ''}\nক. ${q.qA || ''}\nখ. ${q.qB || ''}\nগ. ${q.qC || ''}\nঘ. ${q.qD || ''}`.trim()
            : q.type === 'mcq'
            ? `${q.mcqQuestion || ''}\n(ক) ${q.optA || ''} (খ) ${q.optB || ''}\n(গ) ${q.optC || ''} (ঘ) ${q.optD || ''}`.trim()
            : q.shortText || ''),
      })),
    };
  } catch {
    return {
      questions: [
        {
          type: 'short',
          shortText: rawText,
          formattedText: rawText,
        },
      ],
    };
  }
}

'use server';

/**
 * @fileOverview Genkit/Gemini failover flow for generating structured NCTB board-style questions.
 */

import { createAiClient, getAvailableApiKeys } from '@/ai/genkit';
import { getSubjectCategory } from '@/lib/subject-utils';

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
  const category = getSubjectCategory(input.subject);
  const chapterText = input.chapter ? `অধ্যায়/টপিক: "${input.chapter}"` : '';

  let prompt = '';

  if (category === 'english_1st') {
    prompt = `You are a Chief Examiner and official Question Setter for Bangladesh National Curriculum and Textbook Board (NCTB) for English First Paper (Classes 6-10 / SSC).
Institution: "${input.institutionName || 'Top Grade Tutorials'}"
Class: Class ${input.classId}
Subject: English 1st Paper
${chapterText}
Number of Items to generate: ${input.count} item(s)

CRITICAL NCTB BOARD QUESTION GUIDELINES (100% STRICT COMPLIANCE):
1. LANGUAGE: 100% IN PROPER, FLAWLESS ENGLISH. No Bengali words or scripts!
2. QUESTION PATTERNS (Generate authentic NCTB English 1st items based on the lesson/unit):
   - SEEN PASSAGE READING TEST:
     * A rich, textbook-grade passage (150-250 words) from the Unit/Lesson.
     * Item 1: Multiple Choice Questions (MCQ) [1 mark each] - Choose the correct answer from the following alternatives: 5 to 7 questions with options (a), (b), (c), (d).
     * Item 2: Answering Questions [2 marks each: 2 x 5 = 10] - 5 inferential & comprehension questions (a, b, c, d, e).
     * Item 3: Fill in the blanks with suitable words based on the passage [1 x 5 = 5] - with blanks (a) to (e).
   - UNSEEN PASSAGE:
     * An informative biographical or factual unseen passage.
     * Item 4: Information Transfer Table [1 x 5 = 5] with columns (Who/What, Event/Activity, Where/Place, When/Year).
     * Item 5: Write a summary of the passage in 5-6 sentences [10 marks].
   - VOCABULARY & SYNTAX:
     * Item 6: Matching parts of sentences (Table with Column A, Column B, Column C) to make 5 complete sentences [1 x 5 = 5].
     * Item 7: Put the following jumbled sentences (a to h) in correct order (Rearranging) [8 or 10 marks].
   - GUIDED WRITING:
     * Item 8: Write a paragraph answering 5 questions [10 marks].
     * Item 9: Complete the story following the beginning lines [10 marks].
     * Item 10: Describing a graph/chart OR writing an informal letter/email [10 marks].
     * Item 11: Dialogue writing between two friends [10 marks].
3. STRICT PROHIBITION: DO NOT WRITE ANY ANSWERS, SOLUTIONS, OR ANSWER KEYS. ONLY the question paper items!

Output strictly in JSON format (no markdown backticks):
{
  "questions": [
    {
      "type": "creative",
      "stimulus": "Read the following passage carefully and answer the questions following it:\\n\\n[Passage text here...]",
      "qA": "1. Choose the correct answer from the following alternatives:\\n(a) ... (i) ... (ii) ... (iii) ... (iv) ...\\n(b) ... (i) ... (ii) ... (iii) ... (iv) ...\\n(c) ...",
      "qB": "2. Answer the following questions in 2-3 sentences each:\\n(a) ... [2]\\n(b) ... [2]\\n(c) ... [2]\\n(d) ... [2]\\n(e) ... [2]",
      "qC": "3. Fill in the blanks with suitable words based on the passage: [1 x 5 = 5]\\nPassage with (a) ... (b) ... (c) ... (d) ... (e) ...",
      "formattedText": "Read the following passage carefully and answer the questions following it:\\n\\n[Passage text]\\n\\n1. Choose the correct answer from the following alternatives:\\n(a) ...\\n(b) ...\\n\\n2. Answer the following questions:\\n(a) ... [2]\\n(b) ... [2]\\n(c) ... [2]\\n(d) ... [2]\\n(e) ... [2]"
    }
  ]
}`;
  } else if (category === 'english_2nd') {
    prompt = `You are a Chief Examiner and official Question Setter for Bangladesh National Curriculum and Textbook Board (NCTB) for English Second Paper (Grammar & Composition - Classes 6-10 / SSC).
Institution: "${input.institutionName || 'Top Grade Tutorials'}"
Class: Class ${input.classId}
Subject: English 2nd Paper (Grammar & Composition)
${chapterText}
Number of Items to generate: ${input.count} item(s)

CRITICAL NCTB BOARD QUESTION GUIDELINES (100% STRICT COMPLIANCE):
1. LANGUAGE: 100% IN STANDARD ENGLISH. No Bengali text!
2. QUESTION PATTERNS (Authentic NCTB Board Exam Grammar & Composition items):
   - Item 1: Fill in the blanks with the words from the box. You may need to change the forms of some words. [0.5 x 10 = 5]
     (Provide a clue box with 10 words, followed by an interesting text with blanks (a) to (j))
   - Item 2: Fill in the blanks with suitable words (without clues) [0.5 x 10 = 5] (Blanks (a) to (j) focusing on prepositions, articles, parts of speech)
   - Item 3: Make 5 meaningful sentences using parts of sentences from each column of the substitution table [1 x 5 = 5] (Table with 3 columns: Column A, B, C)
   - Item 4: Complete the text with right forms of the verbs given in the box [0.5 x 10 = 5 or 1 x 10 = 10] (Box with 10 base verbs, passage with blanks (a) to (j))
   - Item 5: Change the narrative style of the following text (Direct to Indirect Speech) [5 marks] (A passage with direct dialogue between two characters)
   - Item 6: Change the sentences according to directions [1 x 10 = 10]
     (10 distinct sentences with bracketed instructions: (a) ... (Passive), (b) ... (Complex), (c) ... (Negative), (d) ... (Simple), (e) ... (Comparative), (f) ... (Compound), (g) ... (Exclamatory), (h) ... (Interrogative), (i) ... (Positive), (j) ... (Active))
   - Item 7: Complete the sentences [1 x 5 = 5]
     (5 incomplete sentences testing conditionals and connectors: (a) If you ..., (b) It is high time ..., (c) Walk fast lest ..., (d) Unless you ..., (e) Though he ...)
   - Item 8: Complete the text adding suffixes, prefixes or both with the root words given in the parenthesis [0.5 x 10 = 5] (Passage with 10 bracketed root words (a) to (j))
   - Item 9: Make tag questions of these statements [1 x 5 = 5] (5 distinct statements (a) to (e))
   - Item 10: Complete the passage using suitable sentence connectors / linkers [1 x 5 = 5] (Passage with blanks (a) to (e))
   - Item 11: Use capitals and punctuation marks where necessary in the following text [5 marks] (Unpunctuated text)
   - Item 12: Write a CV with cover letter for the post of ... OR a formal application to the Headmaster/Principal [8 or 10 marks]
   - Item 13: Write a Paragraph on ... [10 marks]
   - Item 14: Write a Composition on ... [12 marks]
3. STRICT PROHIBITION: DO NOT WRITE ANY ANSWERS, SOLUTIONS, OR ANSWER KEYS. ONLY the question paper items!

Output strictly in JSON format (no markdown backticks):
{
  "questions": [
    {
      "type": "short",
      "shortText": "1. Complete the following text with right forms of the verbs given in the box: [0.5 x 10 = 5]\\n\\n[ box: take | be | work | succeed | call | do | follow | see | know | rise ]\\n\\nText with (a) ---- (b) ---- (c) ---- (d) ---- (e) ---- (f) ---- (g) ---- (h) ---- (i) ---- (j) ----",
      "formattedText": "1. Complete the following text with right forms of the verbs given in the box: [0.5 x 10 = 5]\\n\\n[ box: take | be | work | succeed | call | do | follow | see | know | rise ]\\n\\nText with (a) ---- (b) ---- (c) ---- (d) ---- (e) ---- (f) ---- (g) ---- (h) ---- (i) ---- (j) ----"
    }
  ]
}`;
  } else if (category === 'math') {
    prompt = `তুমি বাংলাদেশের জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (NCTB)-এর গণিত বিষয়ের একজন সিনিয়র প্রশ্নপ্রণেতা ও প্রধান পরীক্ষক।
প্রতিষ্ঠান: "${input.institutionName || 'টপ গ্রেড টিউটোরিয়ালস'}"
শ্রেণি: ${input.classId} শ্রেণি
বিষয়: ${input.subject}
${chapterText}
প্রশ্নের ধরণ: ${input.type === 'mcq' ? 'বহুনির্বাচনি (MCQ)' : 'সৃজনশীল প্রশ্ন (CQ [২+৪+৪=১০])'}
মোট প্রশ্নের সংখ্যা: ${input.count} টি

কঠোর ও অলঙ্ঘনীয় NCTB বোর্ড পরীক্ষার নিয়মাবলী:
১. গণিত সৃজনশীল প্রশ্ন (CQ) কাঠামো:
   - প্রতিটি সৃজনশীল প্রশ্নে বাস্তবসম্মত উদ্দীপক (বীজগাণিতিক সমীকরণ, জ্যামিতিক চিত্র বা তথ্যের বিবরণ) থাকবে।
   - উপ-প্রশ্ন হবে ঠিক ৩টি: ক, খ এবং গ (কোনো অবস্থাতেই ঘ বা ৪টি উপ-প্রশ্ন হবে না! গণিতে ৩টি উপ-প্রশ্ন ক, খ, গ থাকবে)।
   - মান বণ্টন হবে কঠোরভাবে:
     * ক. [জ্ঞানমূলক / সংক্ষিপ্ত সমাধান - ২ নম্বর]
     * খ. [প্রয়োগমূলক প্রমাণ বা সমস্যা সমাধান - ৪ নম্বর]
     * গ. [উচ্চতর দক্ষতামূলক বিকল্প সমাধান বা দ্বিতীয় প্রমাণ - ৪ নম্বর]
     * মোট মান: [২ + ৪ + ৪ = ১০]
   - সমীকরণ ও প্রতীক KaTeX ফরম্যাটে লিখবে (যেমন $A \\cup B$, $f(x) = \\frac{3x+1}{3x-1}$, $\\sqrt{6} + \\sqrt{5}$, $x^2 - 3x + 1 = 0$, $\\sin \\theta$, ইত্যাদি)।
২. গণিত বহুনির্বাচনি (MCQ) কাঠামো:
   - সাধারণ বহুনির্বাচনি: স্পষ্ট প্রশ্ন + ৪টি অপশন ক), খ), গ), ঘ)
   - বহুপদী সমাপ্তিসূচক:
     i. ...
     ii. ...
     iii. ...
     নিচের কোনটি সঠিক?
     (ক) i ও ii   (খ) i ও iii   (গ) ii ও iii   (ঘ) i, ii ও iii
   - অভিন্ন তথ্যভিত্তিক বহুনির্বাচনি (একটি উদ্দীপকের ভিত্তিতে দুটি প্রশ্ন)।
৩. কঠোর নিষেধাজ্ঞা: কোনো অবস্থাতেই সঠিক উত্তর বা সমাধানমালা লেখা যাবে না!

Output strictly in JSON format (no markdown backticks):
{
  "questions": [
    {
      "type": "creative",
      "stimulus": "উদ্দীপকের গাণিতিক রাশি বা সমীকরণ...",
      "qA": "ক. জ্ঞানমূলক বা সংক্ষিপ্ত মান নির্ণয় করো। [২]",
      "qB": "খ. প্রমাণ করো যে, ...। [৪]",
      "qC": "গ. উচ্চতর গাণিতিক বিশ্লেষণ বা মান নির্ণয় করো। [৪]",
      "formattedText": "উদ্দীপকের গাণিতিক রাশি বা সমীকরণ...\\nক. জ্ঞানমূলক বা সংক্ষিপ্ত মান নির্ণয় করো। [২]\\nখ. প্রমাণ করো যে, ...। [৪]\\nগ. উচ্চতর গাণিতিক বিশ্লেষণ বা মান নির্ণয় করো। [৪]"
    },
    {
      "type": "mcq",
      "mcqQuestion": "প্রশ্ন বাক্য?",
      "optA": "অপশন ১",
      "optB": "অপশন ২",
      "optC": "অপশন ৩",
      "optD": "অপশন ৪",
      "formattedText": "প্রশ্ন বাক্য?\\n(ক) অপশন ১  (খ) অপশন ২\\n(গ) অপশন ৩  (ঘ) অপশন ৪"
    }
  ]
}`;
  } else {
    // Science, Bangla, or General subjects
    const isBangla2nd = category === 'bangla_2nd';
    prompt = `তুমি বাংলাদেশের জাতীয় শিক্ষাক্রম (NCTB)-এর একজন অভিজ্ঞ প্রশ্নপ্রণেতা ও বোর্ড পরীক্ষক।
প্রতিষ্ঠান: "${input.institutionName || 'টপ গ্রেড টিউটোরিয়ালস'}"
শ্রেণি: ${input.classId} শ্রেণি
বিষয়: ${input.subject}
${chapterText}
প্রশ্নের ধরণ: ${input.type === 'creative' ? 'সৃজনশীল প্রশ্ন' : input.type === 'mcq' ? 'বহুনির্বাচনি প্রশ্ন' : 'সংক্ষিপ্ত প্রশ্ন'}
মোট প্রশ্নের সংখ্যা: ${input.count} টি

কঠোর ও অলঙ্ঘনীয় নিয়মাবলী:
১. কোনো অবস্থাতেই প্রশ্নের উত্তর বা সমাধান দেওয়া যাবে না!
২. ${isBangla2nd ? 'বাংলা ২য় পত্রের ক্ষেত্রে ব্যাকরণ ও নির্মিতি অংশের বোর্ড প্যাটার্ন অনুযায়ী প্রশ্ন তৈরি করো।' : 'সৃজনশীল প্রশ্নের ক্ষেত্রে উদ্দীপক এবং ৪টি উপ-প্রশ্ন আলাদা আলাদা লাইনে থাকবে: ক. [১], খ. [২], গ. [৩], ঘ. [৪]।'}
৩. বহুনির্বাচনির ক্ষেত্রে ৪টি স্পষ্ট অপশন (ক, খ, গ, ঘ) থাকবে।
৪. ভাষা হবে শতভাগ নির্ভুল ও প্রমিত বাংলা।

Output strictly in JSON format (no markdown backticks):
{
  "questions": [
    {
      "type": "${input.type === 'mcq' ? 'mcq' : 'creative'}",
      "stimulus": "উদ্দীপকের দৃশ্যকল্প...",
      "qA": "জ্ঞানমূলক প্রশ্ন...",
      "qB": "অনুধাবনমূলক প্রশ্ন...",
      "qC": "প্রয়োগমূলক প্রশ্ন...",
      "qD": "উচ্চতর দক্ষতামূলক প্রশ্ন...",
      "formattedText": "উদ্দীপক...\\nক. জ্ঞানমূলক প্রশ্ন... [১]\\nখ. অনুধাবনমূলক প্রশ্ন... [২]\\nগ. প্রয়োগমূলক প্রশ্ন... [৩]\\nঘ. উচ্চতর দক্ষতামূলক প্রশ্ন... [৪]"
    }
  ]
}`;
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

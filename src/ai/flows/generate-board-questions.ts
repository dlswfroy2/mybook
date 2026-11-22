'use server';

/**
 * @fileOverview AI flow for generating verified NCTB Board Questions based strictly on Exam, Board, Year & Subject.
 */

import { createAiClient, getAvailableApiKeys, CANDIDATE_MODELS } from '@/ai/genkit';

export interface GenerateBoardQuestionsInput {
  examName: string; // যেমন: এসএসসি, এইচএসসি, দাখিল, জেএসসি বা শ্রেণি
  board: string;    // যেমন: দিনাজপুর বোর্ড, ঢাকা বোর্ড, ইত্যাদি
  year: string;     // যেমন: ২০২৪, ২০২৩, ২০২২, ইত্যাদি
  subject: string;  // যেমন: পদার্থবিজ্ঞান, গণিত, বাংলা ১ম, English 1st, ইত্যাদি
  chapter?: string; // অধ্যায় / টপিক (ঐচ্ছিক)
  type: 'mcq' | 'creative' | 'short' | 'english' | 'all';
}

export interface BoardQuestionItem {
  id: string;
  type: 'creative' | 'short' | 'mcq';
  content: string;
}

export interface GenerateBoardQuestionsOutput {
  formattedText: string;
  questions: BoardQuestionItem[];
  board: string;
  year: string;
  subject: string;
  examName: string;
  answerKey?: string;
}

/**
 * Clean up LaTeX, math syntax, and redundant board labels
 */
function cleanMathAndLatex(raw: string): string {
  if (!raw) return '';
  return raw
    .replace(/\\text\s*\{([^}]+)\}/g, '$1')
    .replace(/\\circ/g, '°')
    .replace(/\\times/g, '×')
    .replace(/\\div/g, '÷')
    .replace(/\\pm/g, '±')
    .replace(/\\degree/g, '°')
    .replace(/\\Omega/g, 'Ω')
    .replace(/\\mu/g, 'μ')
    .replace(/\\alpha/g, 'α')
    .replace(/\\beta/g, 'β')
    .replace(/\\theta/g, 'θ')
    .replace(/\\lambda/g, 'λ')
    .replace(/\\pi/g, 'π')
    .replace(/\\,/g, ' ')
    .replace(/\\;/g, ' ')
    .replace(/\\quad/g, ' ')
    .replace(/\\frac\{([^}]+)\}\{([^}]+)\}/g, '($1/$2)')
    .replace(/\^\{?(-?\d+)\}?/g, (_, p1) => {
      const superMap: Record<string, string> = {
        '0': '⁰', '1': '¹', '2': '²', '3': '³', '4': '⁴',
        '5': '⁵', '6': '⁶', '7': '⁷', '8': '⁸', '9': '⁹',
        '-': '⁻'
      };
      return p1.split('').map((c: string) => superMap[c] || c).join('');
    })
    .replace(/\$([^\$\n]+)\$/g, '$1')
    .replace(/\$/g, '')
    // Remove repeated board names from individual question lines e.g. [দিনাজপুর বোর্ড-২০২৪]
    .replace(/\[\s*[^\]\n]*(?:বোর্ড|Board)[^\]\n]*\]/gi, '')
    .trim();
}

export async function generateBoardQuestions(
  input: GenerateBoardQuestionsInput
): Promise<GenerateBoardQuestionsOutput> {
  const { examName, board, year, subject, chapter, type } = input;

  const typeLabel =
    type === 'mcq'
      ? 'বহুনির্বাচনী প্রশ্ন (MCQ)'
      : type === 'creative'
      ? 'সৃজনশীল প্রশ্ন (CQ)'
      : type === 'english'
      ? 'English Question Paper'
      : 'সংক্ষিপ্ত প্রশ্ন';

  let typeSpecificInstruction = '';
  if (type === 'mcq') {
    typeSpecificInstruction = `
- এটি বহুনির্বাচনী (MCQ) পরীক্ষা। এই বিষয়ের বোর্ড পরীক্ষায় যতগুলো MCQ এসেছিল (সাধারণত বিজ্ঞান/আইসিটি বিষয়ে ২৫টি, অন্যান্য বিষয়ে ৩০টি), তার সম্পূর্ণ সবকটি প্রশ্ন ক্রমানুসারে (১ থেকে ২৫ বা ৩০ পর্যন্ত) প্রদান করুন।
- প্রতিটি প্রশ্নের চারটি অপশন এক লাইনে পাশাপাশি রাখুন: (ক) ... (খ) ... (গ) ... (ঘ) ...
- সবকটি প্রশ্নের শেষে আলাদা করে একবারে 'উত্তরমালা' দিন (যেমন: উত্তরমালা: ১. ক, ২. খ...)।
`;
  } else if (type === 'creative') {
    typeSpecificInstruction = `
- এটি সৃজনশীল (CQ) পরীক্ষা। এই বিষয়ের বোর্ড পরীক্ষায় যতগুলো সৃজনশীল প্রশ্ন এসেছিল (বিজ্ঞান বিভাগে ৮টি, অন্যান্য বিষয়ে ১১টি), তার সম্পূর্ণ সবকটি সৃজনশীল প্রশ্ন ক্রমানুসারে (১ থেকে ৮ বা ১১ পর্যন্ত) সম্পূর্ণ উদ্দীপক ও ক, খ, গ, ঘ সহ ক্রমানুসারে প্রদান করুন। কোনো প্রশ্ন বাদ দেবেন না।
`;
  } else if (type === 'english') {
    typeSpecificInstruction = `
- এটি ইংরেজি বিষয়ের পরীক্ষা। বোর্ড পরীক্ষায় আসা সম্পূর্ণ প্রশ্নপত্রের সকল আইটেম (Part A: Reading Test এবং Part B: Writing Test অথবা Grammar এবং Composition) ক্রমানুসারে প্রদান করুন।
- NCTB-এর পূর্ণাঙ্গ অফিসিয়াল ধারায় প্রস্তুত করুন।
`;
  } else {
    typeSpecificInstruction = `
- এই বিষয়ের বোর্ড পরীক্ষায় আসা সম্পূর্ণ প্রশ্নপত্রের সকল প্রশ্ন ক্রমানুসারে প্রদান করুন।
`;
  }

  const prompt = `
আপনি বাংলাদেশ জাতীয় শিক্ষাক্রম ও পাঠ্যপুস্তক বোর্ড (NCTB) এবং সকল শিক্ষা বোর্ডের প্রশ্ন বিশেষজ্ঞ।
আপনাকে শুধু ${board}-এর ${examName ? `${examName} পরীক্ষার ` : ''}${year} সালের ${subject} বিষয়ের সম্পূর্ণ বোর্ড প্রশ্নপত্রটি দিতে হবে। ${chapter ? `(অধ্যায়/বিষয়বস্তু: ${chapter})` : ''}

কঠোর শর্তাবলী ও বিন্যাস নির্দেশিকা (১০০% অনুসরণীয়):
১. হেডারের বিন্যাস:
   শুধুমাত্র প্রশ্নপত্রের শুরুতে হেডারে একবার স্পষ্টভাবে পরীক্ষার পরিচয় লিখুন:
   ${examName ? `${examName} পরীক্ষা ` : ''}${year} • ${board}
   বিষয়: ${subject} (${typeLabel})
   [সম্পূর্ণ বোর্ড প্রশ্নপত্র]
২. প্রশ্নের ভেতরের প্রতিটি লাইনে (যেমন ক, খ, গ, ঘ বা উদ্দীপকের শেষে) বোর্ডের নাম ও সাল কখনোই লিখবেন না। শুধুমাত্র উপরের হেডারে থাকবে।
${typeSpecificInstruction}
৩. কোনো অপ্রয়োজনীয় ল্যাটেক্স বা কাঁচা কোড (যেমন: $1\\text{ mm}$, $4.2\\text{ cm}$, $7800\\text{ kg/m}^3$, $16\\text{ ms}^{-1}$) লিখবেন না। সরাসরি সাধারণ বাংলা বা ইংরেজি সংকেত লিখুন (যেমন: ৪.২ cm, ১ mm, ১৫০ g, ৭৮০০ kg/m³, ১৬ ms⁻¹)।
৪. জিরো-অনুমান (Zero Hallucination): কোনো অবস্থাতেই কাল্পনিক বা অনুমাননির্ভর প্রশ্ন তৈরি করবেন না। শুধুমাত্র নিশ্চিতভাবে ${board}-এর ${year} সালে এই পরীক্ষায় আসা প্রশ্নগুলোই অন্তর্ভুক্ত করবেন। কোনো প্রশ্ন সম্পর্কে নিশ্চিত না হলে সেটি বাদ দেবেন, অনুমান করে লিখবেন না।
`;

  const availableKeys = getAvailableApiKeys();
  let rawText = '';

  for (const key of availableKeys) {
    for (const model of CANDIDATE_MODELS) {
      try {
        const client = createAiClient(key, model);
        const resp = await client.generate({
          model,
          prompt,
          config: { maxOutputTokens: 8192 },
        });
        rawText = resp.text?.trim() || '';
        if (rawText) break;
      } catch (err) {}
    }
    if (rawText) break;
  }

  if (!rawText) {
    throw new Error('বোর্ড প্রশ্ন তৈরি করা সম্ভব হয়নি। অনুগ্রহ করে ইন্টারনেট সংযোগ চেক করে আবার চেষ্টা করুন।');
  }

  // Clean raw LaTeX & math artifacts
  const cleanedText = cleanMathAndLatex(rawText);

  // Parse questions from cleanedText into distinct array of items
  const questions: BoardQuestionItem[] = [];
  let answerKey = '';

  if (type === 'mcq') {
    const parts = cleanedText.split(/(?:উত্তরমালা|সঠিক উত্তরমালা|উত্তরসমূহ|Answer Key)[:\n]/i);
    const questionsBlock = parts[0];
    answerKey = parts.length > 1 ? parts[1].trim() : '';

    const qMatches = questionsBlock.split(/(?=\n\s*[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\)])/);
    for (const qm of qMatches) {
      const trimmed = qm.trim();
      // Skip top header if it doesn't start with a number
      if (trimmed && trimmed.match(/^[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\)]/)) {
        questions.push({
          id: Math.random().toString(36).substring(2, 9),
          type: 'mcq',
          content: trimmed,
        });
      }
    }

    if (answerKey) {
      questions.push({
        id: Math.random().toString(36).substring(2, 9),
        type: 'short',
        content: `উত্তরমালা:\n${answerKey}`,
      });
    }
  } else if (type === 'creative') {
    // Split by horizontal lines or question numbered headings
    const blocks = cleanedText.split(/\n\s*---\s*\n/);
    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i].trim();
      if (!block) continue;
      // If it has multiple sub-numbered questions
      const sub = block.split(/(?=\n\s*(?:###\s*)?(?:\*\*)?(?:প্রশ্ন\s*)?[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\*])/);
      for (const s of sub) {
        const trimmed = s.trim();
        if (trimmed && trimmed.match(/(?:^|\n)\s*(?:###\s*)?(?:\*\*)?(?:প্রশ্ন\s*)?[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\*]/)) {
          questions.push({
            id: Math.random().toString(36).substring(2, 9),
            type: 'creative',
            content: trimmed,
          });
        }
      }
    }
  } else {
    // English or short
    const blocks = cleanedText.split(/\n\s*---\s*\n/);
    for (const block of blocks) {
      const trimmed = block.trim();
      if (trimmed) {
        // If block starts with question or item
        if (trimmed.match(/^(?:###\s*)?(?:\*\*)?(?:Item|Question|Part|[১-৯১২৩৪৫৬৭৮৯০0-9]+)[.\*]/i)) {
          questions.push({
            id: Math.random().toString(36).substring(2, 9),
            type: type === 'short' ? 'short' : 'creative',
            content: trimmed,
          });
        }
      }
    }
  }

  // Fallback: If array is empty, wrap whole text or split by lines
  if (questions.length === 0) {
    const fallbackMatches = cleanedText.split(/(?=\n\s*(?:[১-৯১২৩৪৫৬৭৮৯০0-9]+[.\)]|প্রশ্ন\s*[১-৯১২৩৪৫৬৭৮৯০0-9]+))/);
    for (const fm of fallbackMatches) {
      const trimmed = fm.trim();
      if (trimmed) {
        questions.push({
          id: Math.random().toString(36).substring(2, 9),
          type: type === 'mcq' ? 'mcq' : (type === 'creative' ? 'creative' : 'short'),
          content: trimmed,
        });
      }
    }
  }

  if (questions.length === 0) {
    questions.push({
      id: Math.random().toString(36).substring(2, 9),
      type: type === 'mcq' ? 'mcq' : (type === 'creative' ? 'creative' : 'short'),
      content: cleanedText,
    });
  }

  return {
    formattedText: cleanedText,
    questions,
    board,
    year,
    subject,
    examName,
    answerKey,
  };
}
